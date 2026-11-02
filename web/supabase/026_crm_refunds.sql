-- 026: a refund un-wins a cycle (Romain 2026-10-30: "les remboursements en perdu").
-- A cycle whose payments are all refunded is lost with the reason "Refunded" (automatic), dated at the last refund; the
-- cash collected already nets refunds (amount - refunded_amount). A partial refund keeps the cycle won.
-- crm_add_refund records a refund on a payment (by hand until Whop sends refund.created, phase 5): admins and sales leads,
-- like crm_add_payment (022); event payment_refunded; the projector below is 025's with the refund rule added.

insert into crm_reason_codes (code, kind, label, nurture_default, automatic, position)
values ('refunded', 'lost', 'Refunded', 'none', true, 8)
on conflict (code) do update set kind = excluded.kind, label = excluded.label, automatic = excluded.automatic;

create or replace function crm_add_refund(p_payment uuid, p_amount numeric default null, p_refunded_at timestamptz default null, p_note text default null)
returns numeric language plpgsql security definer set search_path = public as $$
declare me crm_members; p crm_payments; cy crm_cycles; amt numeric; at timestamptz := coalesce(p_refunded_at, now());
begin
  select * into p from crm_payments where id = p_payment;
  if p.id is null then raise exception 'Unknown payment' using errcode = 'P0002'; end if;
  me := crm_require(array['admin', 'sales_lead']::member_role[], p.cycle_id);
  amt := coalesce(p_amount, p.amount - p.refunded_amount);   -- default: the rest of the payment
  if amt is null or amt <= 0 then raise exception 'The refund must be more than zero' using errcode = '22023'; end if;
  if p.refunded_amount + amt > p.amount then raise exception 'A refund cannot exceed the payment' using errcode = '22023'; end if;
  if at > now() + interval '1 day' then raise exception 'A refund cannot be in the future' using errcode = '22023'; end if;
  select * into cy from crm_cycles where id = p.cycle_id;
  update crm_payments set refunded_amount = refunded_amount + amt, updated_at = now(),
         note = coalesce(nullif(trim(coalesce(p_note, '')), ''), note) where id = p.id;
  insert into crm_events (person_id, cycle_id, occurred_at, actor, member_id, channel, type, data, source, source_id)
  values (cy.person_id, p.cycle_id, at, 'sales', me.id, 'payment', 'payment_refunded',
          jsonb_build_object('amount', amt, 'currency', p.currency, 'payment_id', p.id, 'full', p.refunded_amount + amt >= p.amount),
          'crm', 'refund:' || p.id || ':' || (p.refunded_amount + amt));
  perform crm_recompute_cycle(p.cycle_id);
  perform crm_audit(me.id, 'add_refund', 'crm_payments', p.id::text, to_jsonb(p), jsonb_build_object('refunded', amt, 'at', at));
  return p.refunded_amount + amt;
end $$;
revoke execute on function crm_add_refund(uuid, numeric, timestamptz, text) from public, anon;
grant execute on function crm_add_refund(uuid, numeric, timestamptz, text) to authenticated;

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

-- cycles already refunded in full (a refund entered before this file) take the rule now
select crm_recompute_cycle(c.id) from crm_cycles c
 where c.status = 'won' and exists (select 1 from crm_payments x where x.cycle_id = c.id and x.refunded_amount > 0);
