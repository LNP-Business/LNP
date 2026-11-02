-- SKL OS CRM — event pipeline (web/supabase/005_crm_pipeline.sql), after 004_crm_rpc.sql. Phase 2.
-- process-inbox (Edge Function) maps each raw crm_webhook_log row into canonical items (docs/crm/04 §2) and hands them
-- to crm_apply_items, which matches the person and the cycle (03), writes entities and events and recomputes the
-- cycle, all in one transaction. crm_recompute_cycle is the projector (04 §3): a cycle's derived state is rebuilt
-- from its events, calls, outcomes and payments, sorted by occurred_at, so running it twice gives the same result.
-- Safe to run again (create or replace). Service-role only, except crm_recompute_all (admins).

-- ───────────────────────── projector ─────────────────────────
create or replace function crm_recompute_cycle(p_cycle uuid) returns void
language plpgsql security definer set search_path = public as $$
declare cy crm_cycles; st record; prev_stage text; prev_at timestamptz; new_status cycle_status := 'active';
        close_at timestamptz; reason text; o record; lost_at timestamptz; reopen_at timestamptz; won_at timestamptz;
        nm jsonb; nxt crm_calls; late crm_calls; last_call crm_calls; t timestamptz := now();
begin
  select * into cy from crm_cycles where id = p_cycle for update;
  if cy.id is null then return; end if;

  -- stages: entered at the first event whose type the stage lists; the current stage is the furthest reached
  delete from crm_stage_history where cycle_id = p_cycle;
  prev_stage := null; prev_at := null;
  for st in
    select d.key, (select min(e.occurred_at) from crm_events e where e.cycle_id = p_cycle and e.type = any(d.enter_on)) as at
      from crm_stage_definitions d where d.active order by d.position
  loop
    continue when st.at is null;
    if prev_stage is not null then
      update crm_stage_history set exited_at = greatest(st.at, entered_at) where cycle_id = p_cycle and stage = prev_stage;
    end if;
    insert into crm_stage_history (cycle_id, stage, entered_at) values (p_cycle, st.key, st.at);
    prev_stage := st.key; prev_at := st.at;
  end loop;

  -- status: won at the first succeeded payment; lost / disqualified at the latest current outcome no / disqualified
  -- (or a rules cycle_lost event); back to active after a later cycle_reopened
  select min(occurred_at) into won_at from crm_events where cycle_id = p_cycle and type = 'payment_succeeded';
  select oc.decision, oc.reason_code, oc.declared_at into o from crm_call_outcomes oc join crm_calls c on c.id = oc.call_id
   where c.cycle_id = p_cycle and oc.superseded_at is null order by oc.declared_at desc limit 1;
  select max(occurred_at) into reopen_at from crm_events where cycle_id = p_cycle and type = 'cycle_reopened';
  if won_at is not null then
    new_status := 'won'; close_at := won_at; reason := null;
  elsif o.decision in ('no', 'disqualified') and (reopen_at is null or o.declared_at > reopen_at) then
    new_status := case when o.decision = 'no' then 'lost' else 'disqualified' end; close_at := o.declared_at; reason := o.reason_code;
  elsif o.declared_at is null and exists (select 1 from crm_events where cycle_id = p_cycle and source = 'import' and type in ('cycle_won', 'cycle_lost', 'cycle_disqualified')
                  and (reopen_at is null or occurred_at > reopen_at)) then
    -- closed in the tool the lead came from (008 / 009 / 013 imports), until a declared outcome or a reopening says otherwise
    select substr(type, 7)::cycle_status, occurred_at, data->>'reason' into new_status, close_at, reason from crm_events
     where cycle_id = p_cycle and source = 'import' and type in ('cycle_won', 'cycle_lost', 'cycle_disqualified') order by occurred_at desc limit 1;
  else
    select occurred_at, data->>'reason' into lost_at, reason from crm_events
     where cycle_id = p_cycle and type = 'cycle_lost' and source = 'rules' order by occurred_at desc limit 1;
    if lost_at is not null and (reopen_at is null or lost_at > reopen_at) then
      new_status := 'lost'; close_at := lost_at;
    else
      reason := null;
    end if;
  end if;
  if new_status <> cy.status and new_status <> 'active' then
    insert into crm_events (person_id, cycle_id, occurred_at, actor, channel, type, data, source, source_id)
    values (cy.person_id, p_cycle, close_at, 'system', 'crm', 'cycle_' || new_status::text, jsonb_build_object('reason', reason),
      'crm', 'status:' || p_cycle || ':' || new_status::text || ':' || close_at)
    on conflict (source, source_id) do nothing;
  end if;

  -- who must act (DEFERRED wording and logic, 10 §3): outcome missing, then the next call, then rebook, then follow up
  select * into late from crm_calls where cycle_id = p_cycle and status = 'scheduled' and scheduled_end < t
   order by scheduled_end limit 1;
  select * into nxt from crm_calls where cycle_id = p_cycle and status = 'scheduled' and scheduled_start >= t
   order by scheduled_start limit 1;
  select * into last_call from crm_calls where cycle_id = p_cycle order by rank desc limit 1;
  nm := case
    when new_status <> 'active' then null
    when late.id is not null then jsonb_build_object('who', 'sales', 'code', 'declare_outcome', 'label', 'Declare the call outcome', 'due_at', late.scheduled_end)
    when nxt.id is not null then jsonb_build_object('who', 'prospect', 'code', 'attend_call', 'label', 'Call R' || nxt.rank, 'due_at', nxt.scheduled_start)
    when last_call.status = 'canceled' then jsonb_build_object('who', 'sales', 'code', 'rebook', 'label', 'Rebook the call')
    else jsonb_build_object('who', 'sales', 'code', 'follow_up', 'label', 'Follow up') end;

  update crm_cycles set
    current_stage = prev_stage, stage_entered_at = prev_at,
    calls_held = (select count(*) from crm_calls where cycle_id = p_cycle and status = 'held'),
    no_shows = (select count(*) from crm_calls where cycle_id = p_cycle and status = 'no_show'),
    sales_attempts = (select count(*) from crm_events where cycle_id = p_cycle and actor = 'sales' and type in ('message_out', 'phone_call_out')),
    last_prospect_at = (select max(occurred_at) from crm_events where cycle_id = p_cycle and actor = 'prospect' and type in ('message_in', 'phone_call_in')),
    last_sales_at = (select max(occurred_at) from crm_events where cycle_id = p_cycle and actor = 'sales' and type in ('message_out', 'phone_call_out')),
    last_event_at = (select max(occurred_at) from crm_events where cycle_id = p_cycle),
    status = new_status, closed_at = case when new_status = 'active' then null else close_at end,
    close_reason = case when new_status in ('lost', 'disqualified') then reason end,
    next_move = nm, projected_at = t
  where id = p_cycle;
end $$;

create or replace function crm_recompute_all() returns int
language plpgsql security definer set search_path = public as $$
declare c uuid; n int := 0;
begin
  if auth.uid() is not null and coalesce(crm_role()::text, '') <> 'admin' then
    raise exception 'Only an admin can recompute every cycle' using errcode = '42501';
  end if;
  for c in select id from crm_cycles loop perform crm_recompute_cycle(c); n := n + 1; end loop;
  return n;
end $$;

-- ───────────────────────── matching (03) ─────────────────────────
-- Persons pointed to by these normalised identifiers ({kind: value}), following merges.
create or replace function crm_people_for(p_identity jsonb) returns uuid[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(distinct coalesce(p.merged_into, p.id)), '{}')
    from jsonb_each_text(coalesce(p_identity, '{}'::jsonb)) k
    join crm_person_identities i on i.kind::text = k.key and i.value = k.value
    join crm_people p on p.id = i.person_id
   where k.key in ('iclosed_contact_id', 'phone', 'email', 'whop_user_id', 'whop_member_id') and coalesce(k.value, '') <> ''
$$;

create or replace function crm_add_identities(p_person uuid, p_identity jsonb, p_source event_source) returns void
language sql security definer set search_path = public as $$
  insert into crm_person_identities (person_id, kind, value, source)
  select p_person, k.key::identity_kind, k.value, p_source from jsonb_each_text(coalesce(p_identity, '{}'::jsonb)) k
   where k.key in ('iclosed_contact_id', 'phone', 'email', 'whop_user_id', 'whop_member_id') and coalesce(k.value, '') <> ''
  on conflict (kind, value) do nothing
$$;

-- The team member hosting a call (iClosed host email), else crm_settings.default_owner, else nobody.
create or replace function crm_owner_for(p_host_email text) returns uuid
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select id from crm_members where active and p_host_email is not null
        and (iclosed_email = lower(trim(p_host_email))::citext or email = lower(trim(p_host_email))::citext) limit 1),
    (select m.id from crm_members m, crm_settings s where s.key = 'default_owner' and m.member_key = s.value #>> '{}' and m.active))
$$;

-- Opens the cycle of a first booking (03 §4): reopen a recent loss, reactivate nurture, or open a new one.
create or replace function crm_open_cycle(p_person uuid, p_at timestamptz, p_owner uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare last crm_cycles; nur crm_nurture_tracks; days int; cid uuid;
begin
  select * into last from crm_cycles where person_id = p_person order by opened_at desc limit 1;
  select * into nur from crm_nurture_tracks where person_id = p_person and status = 'active';
  select coalesce((params->>'reopen_days')::int, 30) into days from crm_rules where key = 'next_move';
  days := coalesce(days, 30);
  if nur.id is null and last.status = 'lost' and last.closed_at > p_at - make_interval(days => days) then
    update crm_cycles set status = 'active' where id = last.id;
    insert into crm_events (person_id, cycle_id, occurred_at, actor, channel, type, source, source_id)
    values (p_person, last.id, p_at, 'system', 'crm', 'cycle_reopened', 'crm', 'reopen:' || last.id || ':' || p_at)
    on conflict (source, source_id) do nothing;
    return last.id;
  end if;
  insert into crm_cycles (person_id, owner_id, status, origin, previous_cycle_id, opened_at)
  values (p_person, p_owner, 'active', case when nur.id is not null then 'nurture' else 'new' end::cycle_origin,
    case when nur.id is not null then nur.origin_cycle_id else last.id end, p_at)
  returning id into cid;
  if nur.id is not null then
    update crm_nurture_tracks set status = 'reactivated', ended_at = p_at, reactivated_cycle_id = cid where id = nur.id;
    insert into crm_events (person_id, cycle_id, occurred_at, actor, channel, type, data, source, source_id)
    values (p_person, cid, p_at, 'system', 'crm', 'nurture_reactivated', jsonb_build_object('nurture_id', nur.id),
      'crm', 'crm:crm_nurture_tracks:' || nur.id || ':reactivated')
    on conflict (source, source_id) do nothing;
  end if;
  return cid;
end $$;

-- ───────────────────────── apply canonical items ─────────────────────────
-- p_items: [{source, source_id, type, occurred_at, actor, channel, content, identity{}, refs{}, data{}}] for one raw row.
-- Phase 2 handles the iClosed calendar facts: call_booked, call_rescheduled, call_canceled. Writes everything, marks the
-- raw row processed (or unmatched / ignored) and returns that status, in one transaction.
create or replace function crm_apply_items(p_inbox bigint, p_items jsonb) returns text
language plpgsql security definer set search_path = public as $$
declare it jsonb; typ text; at timestamptz; src event_source; persons uuid[]; pid uuid; cid uuid; call crm_calls;
        owner uuid; result text := 'ignored'; touched uuid[] := '{}'; c uuid; name text;
begin
  for it in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    typ := it->>'type'; at := (it->>'occurred_at')::timestamptz; src := (it->>'source')::event_source;
    if typ not in ('call_booked', 'call_rescheduled', 'call_canceled') then continue; end if;
    select * into call from crm_calls where iclosed_call_id = it#>>'{refs,iclosed_call_id}';
    if call.id is null and typ = 'call_rescheduled' then typ := 'call_booked'; end if;   -- unknown call: treat as a booking
    if call.id is not null then
      cid := call.cycle_id; select person_id into pid from crm_cycles where id = cid;
    else
      if typ = 'call_canceled' then
        insert into crm_unmatched_inbox (inbox_id, source, reason, summary)
        values (p_inbox, src, 'Cancellation of a call the CRM never saw', it#>>'{data,summary}');
        if result <> 'processed' then result := 'unmatched'; end if;
        continue;
      end if;
      persons := crm_people_for(it->'identity');
      if array_length(persons, 1) > 1 then
        insert into crm_unmatched_inbox (inbox_id, source, reason, summary, candidate_person_ids)
        values (p_inbox, src, 'Identifiers point to several people', it#>>'{data,summary}', persons);
        if result <> 'processed' then result := 'unmatched'; end if;
        continue;
      end if;
      pid := persons[1];
      name := nullif(trim(it#>>'{identity,name}'), '');
      if pid is null then
        insert into crm_people (full_name, primary_email, primary_phone)
        values (name, nullif(it#>>'{identity,email}', ''), nullif(it#>>'{identity,phone}', '')) returning id into pid;
      else
        update crm_people set full_name = coalesce(full_name, name),
          primary_email = coalesce(primary_email, nullif(it#>>'{identity,email}', '')::citext),
          primary_phone = coalesce(primary_phone, nullif(it#>>'{identity,phone}', '')), updated_at = now()
         where id = pid;
      end if;
    end if;
    perform crm_add_identities(pid, it->'identity', src);

    if typ = 'call_booked' and call.id is null then
      owner := crm_owner_for(it#>>'{data,host_email}');
      select id into cid from crm_cycles where person_id = pid and status = 'active';
      if cid is null then cid := crm_open_cycle(pid, at, owner); end if;
      insert into crm_calls (cycle_id, rank, iclosed_call_id, scheduled_start, scheduled_end, status, host_id)
      values (cid, (select coalesce(max(rank), 0) + 1 from crm_calls where cycle_id = cid), it#>>'{refs,iclosed_call_id}',
        nullif(it#>>'{data,start}', '')::timestamptz, nullif(it#>>'{data,end}', '')::timestamptz, 'scheduled', owner)
      returning * into call;
    elsif typ in ('call_booked', 'call_rescheduled') then
      -- a booking for a known call id is a reschedule (05 §4); an older event never overwrites a newer one
      if not exists (select 1 from crm_events where call_id = call.id and type in ('call_booked', 'call_rescheduled') and occurred_at > at) then
        -- a new start without an end keeps the call's length
        update crm_calls set scheduled_start = coalesce(nullif(it#>>'{data,start}', '')::timestamptz, scheduled_start),
          scheduled_end = coalesce(nullif(it#>>'{data,end}', '')::timestamptz,
            nullif(it#>>'{data,start}', '')::timestamptz + (scheduled_end - scheduled_start), scheduled_end),
          status = case when status = 'canceled' then 'scheduled' else status end
         where id = call.id;
      end if;
      typ := case when exists (select 1 from crm_events where call_id = call.id and type = 'call_booked') then 'call_rescheduled' else 'call_booked' end;
    elsif typ = 'call_canceled' then
      if not exists (select 1 from crm_events where call_id = call.id and type in ('call_booked', 'call_rescheduled') and occurred_at > at) then
        update crm_calls set status = 'canceled' where id = call.id and status in ('scheduled', 'outcome_pending');
      end if;
    end if;

    insert into crm_events (person_id, cycle_id, call_id, occurred_at, actor, channel, type, content, data, source, source_id, inbox_id)
    values (pid, cid, call.id, at, coalesce(nullif(it->>'actor', ''), 'prospect')::actor_kind, coalesce(nullif(it->>'channel', ''), 'booking'),
      typ, it->>'content', coalesce(it->'data', '{}'::jsonb) - 'summary', src, it->>'source_id', p_inbox)
    on conflict (source, source_id) do nothing;
    touched := touched || cid;
    result := 'processed';
  end loop;
  foreach c in array coalesce((select array_agg(distinct x) from unnest(touched) x), '{}') loop perform crm_recompute_cycle(c); end loop;
  update crm_webhook_log set status = result::inbox_status, processed_at = now(), error = null where id = p_inbox;
  return result;
end $$;

-- ───────────────────────── the queue for process-inbox ─────────────────────────
-- Rows to work on: received, or failed with back-off 1, 2, 4… minutes, at most 8 attempts.
create or replace function crm_inbox_pending(p_sources text[], p_limit int default 50)
returns table (id bigint, source text, headers jsonb, body text, auth_ok boolean, attempts int, received_at timestamptz)
language sql stable security definer set search_path = public as $$
  select w.id, w.source::text, w.headers, w.body, w.auth_ok, w.attempts, w.received_at from crm_webhook_log w
   where w.source::text = any(p_sources) and w.attempts < 8
     and (w.status = 'received'
          or (w.status = 'failed' and coalesce(w.processed_at, w.received_at) + make_interval(mins => power(2, greatest(w.attempts - 1, 0))::int) <= now()))
   order by w.id limit p_limit
$$;

create or replace function crm_inbox_mark(p_inbox bigint, p_status inbox_status, p_error text default null) returns void
language sql security definer set search_path = public as $$
  update crm_webhook_log set status = p_status, error = left(p_error, 2000), processed_at = now(),
    attempts = attempts + case when p_status = 'failed' then 1 else 0 end
   where id = p_inbox
$$;

-- ───────────────────────── privileges ─────────────────────────
do $$ declare f text; begin
  foreach f in array array['crm_recompute_cycle(uuid)', 'crm_people_for(jsonb)', 'crm_add_identities(uuid, jsonb, event_source)',
    'crm_owner_for(text)', 'crm_open_cycle(uuid, timestamptz, uuid)', 'crm_apply_items(bigint, jsonb)',
    'crm_inbox_pending(text[], int)', 'crm_inbox_mark(bigint, inbox_status, text)'] loop
    execute 'revoke execute on function ' || f || ' from public, anon, authenticated';
    execute 'grant execute on function ' || f || ' to service_role';
  end loop;
end $$;
revoke execute on function crm_recompute_all() from public, anon;
grant execute on function crm_recompute_all() to authenticated, service_role;
