-- SKL OS CRM — cycles from iClosed's past calls (web/supabase/009_crm_import_calls.sql), after 008.
-- The Edge Function crm-import (?source=iclosed_calls) groups iClosed's calls by contact, translates iClosed's results into
-- the CRM's own statuses (Romain, 2026-10-24: REJECTED = disqualified) and hands one item per person to crm_import_calls:
-- the person's cycle (the existing one, else a new one opened at the first booking), its calls R1, R2… with their real
-- dates and status, the call events (source import) and, when the history closes it, one closing event read by the 005
-- projector. A cycle already closed by an import (008) or with a call still ahead is never closed again. People with no
-- call at all have no cycle: crm_people_without_cycle lists them for the CRM's "No booking" status.
-- A dry run is rolled back and returns counts only. Safe to run again (calls are found again by their iClosed id).

-- p_items: [{identity: {email: [..], phone: [..], iclosed_contact_id}, name,
--            calls: [{iclosed_call_id, booked_at, start, end, host_email, status: scheduled|canceled|held|no_show,
--                     canceled_at, data: {...iClosed result}}],                      (sorted by start)
--            close: null | {status: won|lost|disqualified, reason, at}}]
create or replace function crm_import_calls(p_items jsonb, p_dry boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare it jsonb; c jsonb; ids jsonb; persons uuid[]; pid uuid; cid uuid; call_id uuid; owner uuid; v text; em text; ph text;
        st jsonb := '{"people":0,"created_people":0,"cycles_opened":0,"calls":0,"calls_known":0,"closed":{},"conflicts":0,"skipped":0}';
        first_at timestamptz; cl text;
begin
  begin
    for it in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
      ids := '[]'::jsonb;
      for em in select lower(trim(x)) from jsonb_array_elements_text(coalesce(it#>'{identity,email}', '[]')) x where x like '%@%' loop
        ids := ids || jsonb_build_object('k', 'email', 'v', em);
      end loop;
      for ph in select x from jsonb_array_elements_text(coalesce(it#>'{identity,phone}', '[]')) x where x ~ '^\+[0-9]{8,15}$' loop
        ids := ids || jsonb_build_object('k', 'phone', 'v', ph);
      end loop;
      v := nullif(trim(it#>>'{identity,iclosed_contact_id}'), '');
      if v is not null then ids := ids || jsonb_build_object('k', 'iclosed_contact_id', 'v', v); end if;
      if jsonb_array_length(ids) = 0 or jsonb_array_length(coalesce(it->'calls', '[]')) = 0 then
        st := jsonb_set(st, '{skipped}', to_jsonb((st->>'skipped')::int + 1)); continue;
      end if;
      select coalesce(array_agg(distinct coalesce(p.merged_into, p.id)), '{}') into persons
        from jsonb_array_elements(ids) x
        join crm_person_identities i on i.kind::text = x->>'k' and i.value = x->>'v'
        join crm_people p on p.id = i.person_id;
      if array_length(persons, 1) > 1 then
        st := jsonb_set(st, '{conflicts}', to_jsonb((st->>'conflicts')::int + 1)); continue;   -- never guess
      end if;
      pid := persons[1];
      if pid is null then
        insert into crm_people (full_name, primary_email, primary_phone)
        values (nullif(trim(it->>'name'), ''),
                (select x->>'v' from jsonb_array_elements(ids) x where x->>'k' = 'email' limit 1),
                (select x->>'v' from jsonb_array_elements(ids) x where x->>'k' = 'phone' limit 1))
        returning id into pid;
        st := jsonb_set(st, '{created_people}', to_jsonb((st->>'created_people')::int + 1));
      end if;
      insert into crm_person_identities (person_id, kind, value, source)
      select pid, (x->>'k')::identity_kind, x->>'v', 'import' from jsonb_array_elements(ids) x
      on conflict (kind, value) do nothing;
      st := jsonb_set(st, '{people}', to_jsonb((st->>'people')::int + 1));

      -- the cycle: the one already holding one of these calls, else the person's latest, else a new one
      select k.cycle_id into cid from crm_calls k
       where k.iclosed_call_id in (select x->>'iclosed_call_id' from jsonb_array_elements(it->'calls') x) limit 1;
      if cid is null then select id into cid from crm_cycles where person_id = pid order by opened_at desc limit 1; end if;
      first_at := (select min(coalesce(nullif(x->>'booked_at', ''), x->>'start')::timestamptz) from jsonb_array_elements(it->'calls') x);
      if cid is null then
        insert into crm_cycles (person_id, owner_id, opened_at)
        values (pid, crm_owner_for(it#>>'{calls,0,host_email}'), first_at) returning id into cid;
        st := jsonb_set(st, '{cycles_opened}', to_jsonb((st->>'cycles_opened')::int + 1));
      else
        update crm_cycles set opened_at = least(opened_at, first_at) where id = cid;
      end if;

      for c in select * from jsonb_array_elements(it->'calls') loop
        if exists (select 1 from crm_calls where iclosed_call_id = c->>'iclosed_call_id') then
          st := jsonb_set(st, '{calls_known}', to_jsonb((st->>'calls_known')::int + 1)); continue;   -- seen live or earlier
        end if;
        owner := crm_owner_for(c->>'host_email');
        insert into crm_calls (cycle_id, rank, iclosed_call_id, scheduled_start, scheduled_end, status, host_id)
        values (cid, (select coalesce(max(rank), 0) + 1 from crm_calls where cycle_id = cid), c->>'iclosed_call_id',
                nullif(c->>'start', '')::timestamptz, nullif(c->>'end', '')::timestamptz, (c->>'status')::call_status, owner)
        returning id into call_id;
        insert into crm_events (person_id, cycle_id, call_id, occurred_at, actor, channel, type, data, source, source_id)
        values (pid, cid, call_id, coalesce(nullif(c->>'booked_at', ''), c->>'start')::timestamptz, 'prospect', 'booking', 'call_booked',
                coalesce(c->'data', '{}') || jsonb_build_object('start', c->>'start', 'end', c->>'end', 'host_email', c->>'host_email'),
                'import', 'import:call:' || (c->>'iclosed_call_id') || ':booked')
        on conflict (source, source_id) do nothing;
        if c->>'status' = 'canceled' then
          insert into crm_events (person_id, cycle_id, call_id, occurred_at, actor, channel, type, data, source, source_id)
          values (pid, cid, call_id, coalesce(nullif(c->>'canceled_at', ''), c->>'start')::timestamptz, 'system', 'booking', 'call_canceled',
                  jsonb_build_object('cancel_reason', c#>>'{data,cancel_reason}'), 'import', 'import:call:' || (c->>'iclosed_call_id') || ':canceled')
          on conflict (source, source_id) do nothing;
        elsif c->>'status' in ('held', 'no_show') then
          insert into crm_events (person_id, cycle_id, call_id, occurred_at, actor, channel, type, data, source, source_id)
          values (pid, cid, call_id, coalesce(nullif(c->>'end', ''), c->>'start')::timestamptz, 'system', 'crm',
                  case when c->>'status' = 'held' then 'outcome_held' else 'outcome_no_show' end,
                  jsonb_build_object('from', 'iclosed'), 'import', 'import:call:' || (c->>'iclosed_call_id') || ':' || (c->>'status'))
          on conflict (source, source_id) do nothing;
        end if;
        st := jsonb_set(st, '{calls}', to_jsonb((st->>'calls')::int + 1));
      end loop;

      cl := it#>>'{close,status}';
      if cl in ('won', 'lost', 'disqualified')
         and not exists (select 1 from crm_events where cycle_id = cid and source = 'import' and type in ('cycle_won', 'cycle_lost', 'cycle_disqualified'))
         and not exists (select 1 from crm_calls where cycle_id = cid and status = 'scheduled' and scheduled_start > now()) then
        insert into crm_events (person_id, cycle_id, occurred_at, actor, channel, type, data, source, source_id)
        values (pid, cid, (it#>>'{close,at}')::timestamptz, 'system', 'crm', 'cycle_' || cl,
                jsonb_build_object('reason', it#>>'{close,reason}', 'from', 'iclosed call history'), 'import', 'import:close:' || cid)
        on conflict (source, source_id) do nothing;
        -- the import event is the cycle's closing step: set the status here so the projector adds no second one
        update crm_cycles set status = cl::cycle_status, closed_at = (it#>>'{close,at}')::timestamptz,
          close_reason = case when cl = 'won' then null else it#>>'{close,reason}' end where id = cid;
        st := jsonb_set(st, array['closed', cl], to_jsonb(coalesce((st#>>array['closed', cl])::int, 0) + 1));
      end if;
      perform crm_recompute_cycle(cid);
    end loop;
    if p_dry then raise exception 'dry run' using errcode = 'P0D01'; end if;
  exception when sqlstate 'P0D01' then
    null;   -- dry run: everything above is rolled back, the counts stay
  end;
  return st;
end $$;

revoke execute on function crm_import_calls(jsonb, boolean) from public, anon, authenticated;
grant execute on function crm_import_calls(jsonb, boolean) to service_role;

-- People with no cycle (never booked): the CRM shows them with the status "No booking". Row-level security of crm_people
-- applies (security_invoker): admins, sales leads and viewers see everyone, a sales rep nobody here (no cycle to own).
create or replace view crm_people_without_cycle with (security_invoker = true) as
  select p.id, p.full_name, p.primary_email, p.primary_phone, p.created_at,
         (select e.data->>'status_label' from crm_events e
           where e.person_id = p.id and e.type = 'imported' and e.source_id like 'import:import:iclosed:%'
           order by e.occurred_at desc limit 1) as iclosed_status,
         (select max(e.occurred_at) from crm_events e where e.person_id = p.id) as last_event_at
    from crm_people p
   where p.merged_into is null and not exists (select 1 from crm_cycles c where c.person_id = p.id);
revoke all on crm_people_without_cycle from anon;
grant select on crm_people_without_cycle to authenticated;
