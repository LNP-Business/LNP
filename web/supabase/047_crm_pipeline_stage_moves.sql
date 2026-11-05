-- 047 · Pipeline moves with no action to declare (Romain, 2026-11-05: « si il n'y a pas d'action, on peut déplacer le lead
-- sans aucune action ; impossible de passer d'un lead R2 à R1 : s'il a déjà fait son R1, il ne peut plus être en R1 »).
-- The board's columns come from the calls (R1, Absent, R2, R3+) and from the activity (Relance longue). A move that needs
-- nothing to be declared is kept as an event stage_moved (source manual, data {to}), shown by the board until newer data
-- about the calls (a booking, an outcome, a recording, a closing) says where the lead is:
--   crm_move_cycle(cycle, 'r1' | 'r2' | 'r3' | 'longfu')
-- The rules are checked here too: a round already done is never a target (a lead whose R1 was held is never put back in
-- R1), a round is never skipped (R1 → R3), and the round in progress must be over (no outcome left to declare, no call
-- ahead). Moves that need an action go through crm_declare_outcome (004), crm_close_cycle / crm_reopen_cycle (045).
-- Admin, sales lead, or the sales rep who owns the cycle. Safe to run again.

-- the events that say where a lead is from its calls: a manual move older than the latest of them no longer counts
create or replace function crm_stage_data_types() returns text[] language sql immutable as $$
  select array['call_booked', 'call_rescheduled', 'call_canceled', 'call_missed', 'call_recorded', 'outcome_held', 'outcome_no_show',
               'outcome_yes', 'outcome_follow_up', 'outcome_no', 'outcome_disqualified', 'cycle_reopened', 'cycle_won', 'cycle_lost',
               'cycle_disqualified', 'payment_succeeded']
$$;

create or replace function crm_move_cycle(p_cycle uuid, p_to text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me crm_members; cy crm_cycles; n int; last_rank int; ahead int; due int; mv text; cur int; held_cur boolean;
begin
  me := crm_require(array['admin', 'sales_lead']::member_role[], p_cycle);
  select * into cy from crm_cycles where id = p_cycle;
  if cy.id is null then raise exception 'Prospect inconnu'; end if;
  if cy.status <> 'active' then raise exception 'Ce prospect est clos : rouvrez-le d''abord' using errcode = '22023'; end if;
  if p_to not in ('r1', 'r2', 'r3', 'longfu') then raise exception 'Colonne non déplaçable à la main : %', p_to using errcode = '22023'; end if;
  if p_to like 'r%' then
    n := substr(p_to, 2)::int;
    -- the round the lead is in: its last call (not canceled), or a later manual move still valid
    select coalesce(max(rank) filter (where status <> 'canceled'), 0),
           count(*) filter (where status = 'scheduled' and scheduled_start > now()),
           count(*) filter (where (status in ('scheduled', 'outcome_pending') and coalesce(scheduled_end, scheduled_start) < now())
                               or (status = 'held' and recorded_by is not null
                                   and not exists (select 1 from crm_call_outcomes o where o.call_id = k.id and o.superseded_at is null)))
      into last_rank, ahead, due
      from crm_calls k where k.cycle_id = p_cycle;
    select e.data->>'to' into mv from crm_events e
     where e.cycle_id = p_cycle and e.type = 'stage_moved' and e.data->>'to' like 'r%'
       and e.occurred_at > coalesce((select max(x.occurred_at) from crm_events x where x.cycle_id = p_cycle and x.type = any(crm_stage_data_types())), '-infinity')
     order by e.occurred_at desc limit 1;
    cur := least(greatest(last_rank, coalesce(substr(mv, 2)::int, 0)), 3);
    select exists (select 1 from crm_calls where cycle_id = p_cycle and status = 'held' and rank >= cur and cur > 0) into held_cur;
    if n < cur then
      raise exception 'Ce prospect est déjà en R% : il ne revient pas en R%. Mettez à jour son statut (issue de l''appel, relance, perte).', cur, n
        using errcode = '22023';
    end if;
    if n > cur + 1 then raise exception 'Un prospect passe par chaque tour : pas de R% avant le R%', n, cur + 1 using errcode = '22023'; end if;
    if n = cur + 1 then
      if due > 0 then raise exception 'Déclarez d''abord l''issue de l''appel passé' using errcode = '22023'; end if;
      if ahead > 0 then raise exception 'Le R% n''a pas encore eu lieu', cur using errcode = '22023'; end if;
      if cur > 0 and not held_cur then raise exception 'Le R% n''a pas été honoré : pas de R% avant lui', cur, n using errcode = '22023'; end if;
    end if;
  end if;
  insert into crm_events (person_id, cycle_id, occurred_at, actor, member_id, channel, type, data, source, source_id)
  values (cy.person_id, cy.id, clock_timestamp(), 'sales', me.id, 'crm', 'stage_moved', jsonb_build_object('to', p_to), 'manual',
    'manual:move:' || cy.id || ':' || gen_random_uuid());
  perform crm_audit(me.id, 'move_cycle', 'crm_cycles', cy.id::text, null, jsonb_build_object('to', p_to));
  return jsonb_build_object('cycle', cy.id, 'to', p_to);
end $$;

revoke execute on function crm_move_cycle(uuid, text) from public, anon;
grant execute on function crm_move_cycle(uuid, text) to authenticated;
