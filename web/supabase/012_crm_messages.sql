-- LNP CRM — messages (web/supabase/012_crm_messages.sql), after 011. Written for Sendblue, abandoned on 2026-11-09: every
-- function below is redefined for WhatsApp by 052_crm_whatsapp.sql (docs/crm/07-integration-whatsapp.md).
-- Every iMessage / SMS of the sales' Sendblue lines becomes an event on the prospect (found by phone number), attached to
-- the prospect's cycle (the latest one opened before the message), so the Sales cycle shows 100 % of the conversation. A message is
-- one event, found again by its handle (source_id "sendblue:<handle>"): a later webhook only updates its status
-- (SENT → DELIVERED → READ). A number the CRM does not know yet becomes a new person (team rule: a Sendblue line is only
-- used with prospects), so no message is ever dropped. Used by process-inbox (webhooks, crm_apply_messages) and by
-- crm-import (history, crm_import_messages). Safe to run again.

create or replace function crm_apply_message_item(it jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare typ text := it->>'type'; persons uuid[]; pid uuid; cid uuid; at timestamptz := (it->>'occurred_at')::timestamptz;
begin
  if typ not in ('message_in', 'message_out', 'phone_call_in', 'phone_call_out', 'opt_out') then return null; end if;
  persons := crm_people_for(it->'identity');
  if array_length(persons, 1) > 1 then raise exception 'several people have the number %', it#>>'{identity,phone}' using errcode = 'P0M02'; end if;
  pid := persons[1];
  if pid is null then
    insert into crm_people (primary_phone) values (it#>>'{identity,phone}') returning id into pid;
    perform crm_add_identities(pid, it->'identity', 'sendblue');
  end if;
  if typ = 'opt_out' then
    update crm_people set opted_out_at = coalesce(opted_out_at, at), updated_at = now() where id = pid;
  end if;
  -- the cycle the message belongs to: the latest one opened before it, else the first one (a message before any booking)
  select id into cid from crm_cycles where person_id = pid
   order by (opened_at <= at) desc, case when opened_at <= at then opened_at end desc nulls last, opened_at limit 1;
  insert into crm_events (person_id, cycle_id, occurred_at, actor, channel, type, content, data, source, source_id)
  values (pid, cid, at, (it->>'actor')::actor_kind, it->>'channel', typ, it->>'content', coalesce(it->'data', '{}'::jsonb),
          'sendblue', it->>'source_id')
  on conflict (source, source_id) do update
    set data = crm_events.data || jsonb_strip_nulls(excluded.data),
        content = coalesce(nullif(excluded.content, ''), crm_events.content);
  return cid;
end $$;

-- webhooks (process-inbox): one raw row, its items, one transaction; a number shared by several people goes to Unmatched
create or replace function crm_apply_messages(p_inbox bigint, p_items jsonb) returns text
language plpgsql security definer set search_path = public as $$
declare it jsonb; c uuid; touched uuid[] := '{}'; result text := 'ignored';
begin
  for it in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    begin
      c := crm_apply_message_item(it);
      if c is not null then touched := touched || c; end if;
      result := 'processed';
    exception when sqlstate 'P0M02' then
      insert into crm_unmatched_inbox (inbox_id, source, reason, summary, candidate_person_ids)
      values (p_inbox, 'sendblue', 'Plusieurs personnes ont ce numéro de téléphone', it#>>'{identity,phone}', crm_people_for(it->'identity'));
      if result <> 'processed' then result := 'unmatched'; end if;
    end;
  end loop;
  foreach c in array coalesce((select array_agg(distinct x) from unnest(touched) x), '{}') loop perform crm_recompute_cycle(c); end loop;
  update crm_webhook_log set status = result::inbox_status, processed_at = now(), error = null where id = p_inbox;
  return result;
end $$;

-- history (crm-import ?source=sendblue): the same items, many at a time; a dry run is rolled back and returns counts only
create or replace function crm_import_messages(p_items jsonb, p_dry boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
declare it jsonb; c uuid; touched uuid[] := '{}'; st jsonb := '{"items":0,"new":0,"known":0,"new_people":0,"no_cycle":0,"conflicts":0}';
        before int; people0 int;
begin
  begin
    select count(*) into people0 from crm_people;
    for it in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
      st := jsonb_set(st, '{items}', to_jsonb((st->>'items')::int + 1));
      select count(*) into before from crm_events where source = 'sendblue' and source_id = it->>'source_id';
      begin
        c := crm_apply_message_item(it);
      exception when sqlstate 'P0M02' then
        st := jsonb_set(st, '{conflicts}', to_jsonb((st->>'conflicts')::int + 1)); continue;
      end;
      st := jsonb_set(st, case when before = 0 then '{new}'::text[] else '{known}'::text[] end,
                      to_jsonb((st->>(case when before = 0 then 'new' else 'known' end))::int + 1));
      if c is null then st := jsonb_set(st, '{no_cycle}', to_jsonb((st->>'no_cycle')::int + 1)); else touched := touched || c; end if;
    end loop;
    st := jsonb_set(st, '{new_people}', to_jsonb((select count(*) from crm_people) - people0));
    foreach c in array coalesce((select array_agg(distinct x) from unnest(touched) x), '{}') loop perform crm_recompute_cycle(c); end loop;
    if p_dry then raise exception 'dry run' using errcode = 'P0D01'; end if;
  exception when sqlstate 'P0D01' then
    null;
  end;
  return st;
end $$;

revoke execute on function crm_apply_message_item(jsonb) from public, anon, authenticated;
revoke execute on function crm_apply_messages(bigint, jsonb) from public, anon, authenticated;
revoke execute on function crm_import_messages(jsonb, boolean) from public, anon, authenticated;
grant execute on function crm_apply_messages(bigint, jsonb) to service_role;
grant execute on function crm_import_messages(jsonb, boolean) to service_role;
