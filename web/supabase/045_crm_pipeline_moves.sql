-- 045 · Move a lead in CRM › Pipeline (Romain, 2026-11-05: « il faut pouvoir mettre à jour le statut de chaque lead … en le
-- déplaçant dans la colonne appropriée ; s'il faut déclarer l'issue d'un appel, un popup invite à le faire »).
-- A move that is an outcome goes through crm_declare_outcome (004: a past call to declare, or the correction of the latest
-- one). The two moves that have no call to declare are here:
--   crm_close_cycle(cycle, 'no' | 'disqualified', reason, note): a lead with no past call, closed lost or disqualified with a
--     reason of the list; event cycle_lost / cycle_disqualified, source manual;
--   crm_reopen_cycle(cycle): a lost or disqualified lead back in the pipeline (event cycle_reopened, which the projector
--     already reads); a won lead is never reopened here.
-- crm_recompute_cycle: 034's definition, plus the manual closes (a later declared outcome or reopening wins over them).
-- Admin, sales lead, or the sales rep who owns the cycle (crm_require). Idempotent.

alter type event_source add value if not exists 'manual';

create or replace function crm_recompute_cycle(p_cycle uuid) returns void
language plpgsql security definer set search_path = public as $$
declare cy crm_cycles; st record; prev_stage text; prev_at timestamptz; new_status cycle_status := 'active';
        close_at timestamptz; reason text; o record; lost_at timestamptz; reopen_at timestamptz; won_at timestamptz; refund_at timestamptz;
        nm jsonb; nxt crm_calls; late crm_calls; last_call crm_calls; t timestamptz := now(); close_type text;
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
    -- 045: or closed by hand from the Pipeline (source manual: a lead with no call to declare), unless a later outcome
    -- or a reopening says otherwise
    select occurred_at, data->>'reason', type into lost_at, reason, close_type from crm_events
     where cycle_id = p_cycle and ((type = 'cycle_lost' and source = 'rules')
        or (type in ('cycle_lost', 'cycle_disqualified') and source = 'manual' and (o.declared_at is null or occurred_at > o.declared_at)))
     order by occurred_at desc limit 1;
    if lost_at is not null and (reopen_at is null or lost_at > reopen_at) then
      new_status := case when close_type = 'cycle_disqualified' then 'disqualified' else 'lost' end; close_at := lost_at;
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
    when late.id is not null then jsonb_build_object('who', 'sales', 'code', 'declare_outcome', 'label', 'Déclarer l''issue de l''appel', 'due_at', coalesce(late.recording_end, late.scheduled_end))
    when nxt.id is not null then jsonb_build_object('who', 'prospect', 'code', 'attend_call', 'label', 'Appel R' || nxt.rank, 'due_at', nxt.scheduled_start)
    when last_call.status::text = 'missed' then jsonb_build_object('who', 'sales', 'code', 'rebook', 'label', 'Replanifier l''appel', 'missed', last_call.rank)
    when last_call.status = 'canceled' then jsonb_build_object('who', 'sales', 'code', 'rebook', 'label', 'Reprendre un rendez-vous')
    else jsonb_build_object('who', 'sales', 'code', 'follow_up', 'label', 'Relancer') end;

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


create or replace function crm_close_cycle(p_cycle uuid, p_decision text, p_reason text, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare me crm_members; cy crm_cycles; rk reason_kind;
begin
  me := crm_require(array['admin', 'sales_lead']::member_role[], p_cycle);
  select * into cy from crm_cycles where id = p_cycle;
  if cy.id is null then raise exception 'Prospect inconnu'; end if;
  if cy.status <> 'active' then raise exception 'Ce prospect est déjà clos'; end if;
  if p_decision not in ('no', 'disqualified') then raise exception 'Décision inconnue : %', p_decision using errcode = '22023'; end if;
  select kind into rk from crm_reason_codes where code = p_reason and active;
  if rk is null then raise exception 'Un motif de la liste est obligatoire'; end if;
  if (p_decision = 'no' and rk <> 'lost') or (p_decision = 'disqualified' and rk <> 'disqualified') then
    raise exception 'Le motif % ne correspond pas à la décision %', p_reason, p_decision;
  end if;
  insert into crm_events (person_id, cycle_id, occurred_at, actor, member_id, channel, type, content, data, source, source_id)
  values (cy.person_id, cy.id, clock_timestamp(), 'sales', me.id, 'crm', case when p_decision = 'no' then 'cycle_lost' else 'cycle_disqualified' end,
    nullif(btrim(coalesce(p_note, '')), ''), jsonb_build_object('reason', p_reason), 'manual', 'manual:close:' || cy.id || ':' || gen_random_uuid());
  perform crm_audit(me.id, 'close_cycle', 'crm_cycles', cy.id::text, jsonb_build_object('status', cy.status),
    jsonb_build_object('decision', p_decision, 'reason', p_reason));
  perform crm_recompute_cycle(cy.id);
end $$;

create or replace function crm_reopen_cycle(p_cycle uuid) returns void
language plpgsql security definer set search_path = public as $$
declare me crm_members; cy crm_cycles;
begin
  me := crm_require(array['admin', 'sales_lead']::member_role[], p_cycle);
  select * into cy from crm_cycles where id = p_cycle;
  if cy.id is null then raise exception 'Prospect inconnu'; end if;
  if cy.status = 'active' then raise exception 'Ce prospect est déjà en cours'; end if;
  if cy.status = 'won' then raise exception 'Une vente payée ne se rouvre pas'; end if;
  insert into crm_events (person_id, cycle_id, occurred_at, actor, member_id, channel, type, data, source, source_id)
  values (cy.person_id, cy.id, clock_timestamp(), 'sales', me.id, 'crm', 'cycle_reopened', jsonb_build_object('from', cy.status), 'manual',
    'manual:reopen:' || cy.id || ':' || gen_random_uuid());
  perform crm_audit(me.id, 'reopen_cycle', 'crm_cycles', cy.id::text, jsonb_build_object('status', cy.status), null);
  perform crm_recompute_cycle(cy.id);
end $$;

revoke execute on function crm_close_cycle(uuid, text, text, text), crm_reopen_cycle(uuid) from public, anon;
grant execute on function crm_close_cycle(uuid, text, text, text), crm_reopen_cycle(uuid) to authenticated;
