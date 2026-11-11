-- 055 · Relance après refus, puis disqualifié après 6 mois (Romain, 2026-11-11 : « il reste classé clos dans le cycle de vente
-- et ce statut signifie automatiquement ce follow up avec des actions de relance. Après 6 mois, il est mis dans disqualifié pour
-- qu'il ne soit plus jamais traité comme tous les disqualifiés »).
-- Un refus d'achat clôt le cycle en « perdu » (Clos dans Cycle de vente) : c'est la branche « Relance après refus » des étapes
-- du lead (LNP_ETAPES dans app/lnp.html). Six mois après la clôture (crm_rules.nurture_cadence.archive_after_days, 182 jours,
-- « archivage après 6 mois décidé »), sans nouveau cycle ni réouverture, crm_refusal_tick le passe en « disqualifié », motif
-- « refus_6_mois » (automatique) : événement cycle_disqualified, source rules, que crm_recompute_cycle garde ensuite.
-- Un refus est un « non » après un appel tenu. Ne sont pas concernés : les perdus sans aucun appel tenu (anciens imports jamais
-- joints), les remboursés (refunded) et les injoignables (unreachable), qui ne sont pas des refus.
-- Une fois par jour (pg_cron, 03 h 17 UTC). Sans danger si rejoué.

insert into crm_reason_codes (code, kind, label, nurture_default, automatic, position, is_proposal)
values ('refus_6_mois', 'disqualified', 'Refus sans suite depuis 6 mois', 'none', true, 99, false)
on conflict (code) do update set kind = excluded.kind, label = excluded.label, automatic = true, active = true;

-- latest definition: 045, plus the disqualification after 6 months
create or replace function crm_recompute_cycle(p_cycle uuid) returns void
language plpgsql security definer set search_path = public as $$
declare cy crm_cycles; st record; prev_stage text; prev_at timestamptz; new_status cycle_status := 'active';
        close_at timestamptz; reason text; o record; lost_at timestamptz; reopen_at timestamptz; won_at timestamptz; refund_at timestamptz;
        nm jsonb; nxt crm_calls; late crm_calls; last_call crm_calls; t timestamptz := now(); close_type text;
        dq_at timestamptz; dq_reason text;
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
  -- 055: a refusal (lost) with no new RDV for 6 months is disqualified by crm_refusal_tick (event cycle_disqualified, source
  -- rules), unless a later reopening says otherwise; it then stays disqualified, as every disqualified lead
  if new_status = 'lost' then
    select occurred_at, data->>'reason' into dq_at, dq_reason from crm_events
     where cycle_id = p_cycle and type = 'cycle_disqualified' and source = 'rules' and occurred_at >= close_at
       and (reopen_at is null or occurred_at > reopen_at)
     order by occurred_at desc limit 1;
    if dq_at is not null then new_status := 'disqualified'; close_at := dq_at; reason := dq_reason; end if;
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

create or replace function crm_refusal_tick(p_now timestamptz default now()) returns int
language plpgsql security definer set search_path = public as $$
declare days int := coalesce((select (params->>'archive_after_days')::int from crm_rules where key = 'nurture_cadence'), 182);
        c record; n int := 0;
begin
  for c in
    select cy.id, cy.person_id from crm_cycles cy
     where cy.status = 'lost' and cy.closed_at < p_now - make_interval(days => days)
       and coalesce(cy.close_reason, '') not in ('refunded', 'unreachable')
       -- a refusal is a no after a call held (Romain 2026-11-11: « les 128 vrais refus ») ; a lead lost without any call held
       -- (an old import, never reached) is not a refusal and stays lost
       and exists (select 1 from crm_calls k where k.cycle_id = cy.id and k.status = 'held' and k.scheduled_start <= cy.closed_at)
       -- the lead came back: a newer cycle of the same person
       and not exists (select 1 from crm_cycles c2 where c2.person_id = cy.person_id and c2.id <> cy.id and c2.opened_at > cy.closed_at)
  loop
    insert into crm_events (person_id, cycle_id, occurred_at, actor, channel, type, data, source, source_id)
    values (c.person_id, c.id, p_now, 'system', 'crm', 'cycle_disqualified',
            jsonb_build_object('reason', 'refus_6_mois', 'after_days', days), 'rules', 'rules:refus_6_mois:' || c.id)
    on conflict (source, source_id) do nothing;
    perform crm_recompute_cycle(c.id);
    n := n + 1;
  end loop;
  return n;
end $$;
revoke execute on function crm_refusal_tick(timestamptz) from public, anon, authenticated;

do $$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'crm-refusal-daily';
    perform cron.schedule('crm-refusal-daily', '17 3 * * *', $job$ select public.crm_refusal_tick() $job$);
  end if;
end $$;
