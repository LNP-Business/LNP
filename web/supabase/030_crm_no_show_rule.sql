-- 030: no Fathom recording = no-show, on R1 only (Romain 2026-10-31).
-- "Si il n'y a pas de fathom record d'un appel effectué qui dure plus de 7 minutes pour un lead, alors le lead est un no
-- show. Un no show que pour les R1. Si un lead a déjà effectué un call complet et qu'il est no show sur R2, il reste en R2
-- avec comme action de planifier un reschedule."
-- A call is complete when it has a Fathom recording of at least no_show_rule.min_minutes (7), or a transcript added by hand
-- (020). Only complete calls take a new number (029 counted any recording or transcript; a 3-minute recording no longer counts).
-- crm_apply_no_show_rule (every hour, 006) reads every past call of a cycle not won, not canceled, with no outcome declared
-- in the CRM and no complete recording, once grace_hours have passed after its end (Fathom is read every hour):
--   * no complete call before it in the cycle (R1 phase) → status no_show + event outcome_no_show (source rules);
--   * a complete call before it (R2, R3…) → status missed + event call_missed; the lead stays in its round and the next
--     move is "Plan a reschedule" (projector below).
-- Calls before no_show_rule.since are never read (the date the Fathom history starts: set when it is imported), and the
-- hourly job runs only when no_show_rule.enabled is true. A recording that comes later puts the call back to held.

alter type call_status add value if not exists 'missed';

insert into crm_settings (key, value, is_proposal)
values ('no_show_rule', jsonb_build_object('enabled', false, 'min_minutes', 7, 'grace_hours', 3, 'since', null), true)
on conflict (key) do nothing;

create or replace function crm_no_show_setting(p_key text) returns text
language sql stable security definer set search_path = public as $$
  select value ->> p_key from crm_settings where key = 'no_show_rule'
$$;

-- a complete call: a Fathom recording of min_minutes or more, or a transcript added by hand
create or replace function crm_call_complete(k crm_calls) returns boolean
language sql stable security definer set search_path = public as $$
  select (k.recorded_by is not null and k.recording_start is not null and k.recording_end is not null
          and k.recording_end - k.recording_start >= make_interval(mins => coalesce(crm_no_show_setting('min_minutes')::int, 7)))
      or (coalesce(k.transcript_raw, '') <> '' and k.transcript_source is distinct from 'fathom')
$$;

-- 029 with the 7-minute rule: a new R number only after a complete call
create or replace function crm_rank_calls(p_cycle uuid) returns void
language plpgsql security definer set search_path = public as $$
declare k crm_calls; n int := 0; r int;
begin
  for k in select * from crm_calls where cycle_id = p_cycle
            order by coalesce(recording_start, scheduled_start, created_at), created_at, id loop
    if crm_call_complete(k) then n := n + 1; r := n; else r := n + 1; end if;
    if k.rank is distinct from r then update crm_calls set rank = r where id = k.id; end if;
  end loop;
end $$;
revoke execute on function crm_rank_calls(uuid) from public, anon, authenticated;
grant execute on function crm_rank_calls(uuid) to service_role;

create or replace function crm_apply_no_show_rule(p_dry boolean default true, p_cycle uuid default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare since timestamptz := nullif(crm_no_show_setting('since'), '')::timestamptz;
        grace interval := make_interval(hours => coalesce(crm_no_show_setting('grace_hours')::int, 3));
        cy record; k crm_calls; seen boolean; ns int := 0; ms int := 0; cycles uuid[] := '{}';
begin
  if since is null then return jsonb_build_object('error', 'no_show_rule.since is not set (the date the Fathom history starts)'); end if;
  for cy in select c.id, c.person_id from crm_cycles c where c.status <> 'won' and (p_cycle is null or c.id = p_cycle)
             and exists (select 1 from crm_calls x where x.cycle_id = c.id and x.scheduled_start >= since) loop
    seen := false;
    for k in select * from crm_calls where cycle_id = cy.id order by coalesce(recording_start, scheduled_start, created_at), created_at, id loop
      if crm_call_complete(k) then seen := true; continue; end if;
      continue when k.status in ('canceled', 'missed') or (k.status = 'no_show' and not seen)
        or k.scheduled_start is null or k.scheduled_start < since
        or coalesce(k.scheduled_end, k.scheduled_start) + grace > now()
        or exists (select 1 from crm_call_outcomes oc where oc.call_id = k.id and oc.superseded_at is null);
      if not seen then ns := ns + 1; else ms := ms + 1; end if;
      cycles := array_append(cycles, cy.id);
      continue when p_dry;
      update crm_calls set status = case when seen then 'missed' else 'no_show' end::call_status where id = k.id;
      insert into crm_events (person_id, cycle_id, call_id, occurred_at, actor, channel, type, data, source, source_id)
      values (cy.person_id, cy.id, k.id, coalesce(k.scheduled_end, k.scheduled_start), 'system', 'crm',
              case when seen then 'call_missed' else 'outcome_no_show' end,
              jsonb_build_object('rule', 'no_fathom_recording', 'min_minutes', coalesce(crm_no_show_setting('min_minutes')::int, 7)),
              'rules', 'noshow:' || k.id)
      on conflict (source, source_id) do nothing;
    end loop;
  end loop;
  if not p_dry then
    perform crm_recompute_cycle(c) from (select distinct unnest(cycles) c) x;
  end if;
  return jsonb_build_object('dry', p_dry, 'since', since, 'no_show_r1', ns, 'missed_r2_plus', ms,
                            'cycles', (select count(distinct c) from unnest(cycles) c));
end $$;
revoke execute on function crm_apply_no_show_rule(boolean, uuid) from public, anon, authenticated;
grant execute on function crm_apply_no_show_rule(boolean, uuid) to service_role;

-- the hourly job (006): only once the rule is switched on
create or replace function crm_no_show_tick() returns jsonb
language sql security definer set search_path = public as $$
  select case when coalesce(crm_no_show_setting('enabled')::boolean, false) then crm_apply_no_show_rule(false) end
$$;
revoke execute on function crm_no_show_tick() from public, anon, authenticated;

-- a complete recording that comes later wins over the rule: the call is held again and the rule's event goes
create or replace function crm_calls_recorded_trigger() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status::text in ('no_show', 'missed') and crm_call_complete(new)
     and not exists (select 1 from crm_call_outcomes oc where oc.call_id = new.id and oc.superseded_at is null) then
    update crm_calls set status = 'held' where id = new.id;
    delete from crm_events where source = 'rules' and source_id = 'noshow:' || new.id;
    perform crm_recompute_cycle(new.cycle_id);
  end if;
  return null;
end $$;
drop trigger if exists crm_calls_recorded on crm_calls;
create trigger crm_calls_recorded after update of recorded_by, recording_end, transcript_raw on crm_calls
  for each row execute function crm_calls_recorded_trigger();

-- 026's projector; the next move after a missed call (or a canceled one) is "Plan a reschedule"
create or replace function crm_recompute_cycle(p_cycle uuid) returns void
language plpgsql security definer set search_path = public as $$
declare cy crm_cycles; st record; prev_stage text; prev_at timestamptz; new_status cycle_status := 'active';
        close_at timestamptz; reason text; o record; lost_at timestamptz; reopen_at timestamptz; won_at timestamptz; refund_at timestamptz;
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
  -- 026: every payment refunded = lost, reason refunded, at the last refund (Romain 2026-10-30)
  if won_at is not null and exists (select 1 from crm_payments where cycle_id = p_cycle and refunded_amount > 0)
     and not exists (select 1 from crm_payments where cycle_id = p_cycle and amount - refunded_amount > 0) then
    select max(occurred_at) into refund_at from crm_events where cycle_id = p_cycle and type = 'payment_refunded';
    if refund_at is null then select max(updated_at) into refund_at from crm_payments where cycle_id = p_cycle; end if;
    new_status := 'lost'; close_at := refund_at; reason := 'refunded';
  elsif won_at is not null then
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
  -- (025, FL-6: a Fathom recording with no current outcome counts as a call whose outcome is missing)
  select * into late from crm_calls k where k.cycle_id = p_cycle and coalesce(k.recording_end, k.scheduled_end) < t
     and (k.status = 'scheduled'
          or (k.status = 'held' and k.recorded_by is not null
              and not exists (select 1 from crm_call_outcomes oc where oc.call_id = k.id and oc.superseded_at is null)))
   order by coalesce(k.recording_end, k.scheduled_end) limit 1;
  select * into nxt from crm_calls where cycle_id = p_cycle and status = 'scheduled' and scheduled_start >= t
   order by scheduled_start limit 1;
  select * into last_call from crm_calls where cycle_id = p_cycle order by rank desc, coalesce(recording_start, scheduled_start) desc limit 1;
  nm := case
    when new_status <> 'active' then null
    when late.id is not null then jsonb_build_object('who', 'sales', 'code', 'declare_outcome', 'label', 'Declare the call outcome', 'due_at', coalesce(late.recording_end, late.scheduled_end))
    when nxt.id is not null then jsonb_build_object('who', 'prospect', 'code', 'attend_call', 'label', 'Call R' || nxt.rank, 'due_at', nxt.scheduled_start)
    when last_call.status::text = 'missed' then jsonb_build_object('who', 'sales', 'code', 'rebook', 'label', 'Plan a reschedule', 'missed', last_call.rank)
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


-- the new numbers of the cycles with a recording (one under min_minutes no longer counts); the rule itself runs after the Fathom history import
do $$ declare c record; begin
  for c in select distinct cycle_id id from crm_calls where recorded_by is not null loop perform crm_rank_calls(c.id); end loop;
end $$;
