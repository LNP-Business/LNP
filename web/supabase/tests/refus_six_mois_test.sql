-- 055_crm_refus_six_mois.sql: a refusal (lost) with no new RDV for 6 months goes to disqualified (crm_refusal_tick), stays so,
-- and the other lost leads (recent, unreachable, refunded, back with a new cycle) are not touched.
do $$
declare p1 uuid; p2 uuid; p3 uuid; p4 uuid; c1 uuid; c2 uuid; c3 uuid; c4 uuid; c4b uuid; n int;
begin
  insert into crm_people (full_name) values ('Refus Ancien') returning id into p1;
  insert into crm_people (full_name) values ('Refus Récent') returning id into p2;
  insert into crm_people (full_name) values ('Injoignable Ancien') returning id into p3;
  insert into crm_people (full_name) values ('Revenu') returning id into p4;
  insert into crm_cycles (person_id, opened_at) values (p1, now() - interval '220 days') returning id into c1;
  insert into crm_cycles (person_id, opened_at) values (p2, now() - interval '120 days') returning id into c2;
  insert into crm_cycles (person_id, opened_at) values (p3, now() - interval '220 days') returning id into c3;
  insert into crm_cycles (person_id, opened_at) values (p4, now() - interval '220 days') returning id into c4;
  -- refusals closed by hand (lost, reason price), and a lead lost by the rules as unreachable
  insert into crm_events (person_id, cycle_id, occurred_at, actor, channel, type, data, source, source_id) values
    (p1, c1, now() - interval '200 days', 'sales', 'crm', 'cycle_lost', '{"reason":"price"}', 'manual', 't055:c1'),
    (p2, c2, now() - interval '100 days', 'sales', 'crm', 'cycle_lost', '{"reason":"price"}', 'manual', 't055:c2'),
    (p3, c3, now() - interval '200 days', 'system', 'crm', 'cycle_lost', '{"reason":"unreachable"}', 'rules', 't055:c3'),
    (p4, c4, now() - interval '200 days', 'sales', 'crm', 'cycle_lost', '{"reason":"price"}', 'manual', 't055:c4');
  perform crm_recompute_cycle(c1); perform crm_recompute_cycle(c2); perform crm_recompute_cycle(c3); perform crm_recompute_cycle(c4);
  assert (select status from crm_cycles where id = c1) = 'lost' and (select close_reason from crm_cycles where id = c1) = 'price', 'a refusal is lost (Clos)';
  assert (select status from crm_cycles where id = c3) = 'lost' and (select close_reason from crm_cycles where id = c3) = 'unreachable', 'unreachable: lost';
  -- the lead of c4 came back: a newer cycle
  insert into crm_cycles (person_id, opened_at) values (p4, now() - interval '10 days') returning id into c4b;

  n := crm_refusal_tick();   -- the other tests of the run may leave old refusals too
  assert n >= 1, 'at least the refusal of 200 days: ' || n;
  assert (select status from crm_cycles where id = c1) = 'disqualified', 'refusal of 200 days: disqualified';
  assert (select close_reason from crm_cycles where id = c1) = 'refus_6_mois', 'reason refus_6_mois';
  assert exists (select 1 from crm_events where cycle_id = c1 and type = 'cycle_disqualified' and source = 'rules'), 'a rules event says why';
  assert (select status from crm_cycles where id = c2) = 'lost', 'refusal of 100 days: still lost (Relance après refus)';
  assert (select status from crm_cycles where id = c3) = 'lost', 'unreachable: not a refusal, untouched';
  assert (select status from crm_cycles where id = c4) = 'lost', 'came back with a new cycle: untouched';
  assert (select status from crm_cycles where id = c4b) = 'active', 'the new cycle stays active';

  -- it stays disqualified when the cycle is computed again, and the tick does nothing twice
  perform crm_recompute_cycle(c1);
  assert (select status from crm_cycles where id = c1) = 'disqualified', 'still disqualified after a recompute';
  assert crm_refusal_tick() = 0, 'nothing left to do';
  assert (select count(*) from crm_events where cycle_id = c1 and type = 'cycle_disqualified' and source = 'rules') = 1, 'one event only';

  -- a reopening brings it back into the pipeline
  insert into crm_events (person_id, cycle_id, occurred_at, actor, channel, type, data, source, source_id)
  values (p1, c1, now(), 'sales', 'crm', 'cycle_reopened', '{}', 'manual', 't055:c1:reopen');
  perform crm_recompute_cycle(c1);
  assert (select status from crm_cycles where id = c1) = 'active', 'reopened: active again';
end $$;
select 'refus six mois SQL checks: all passed';
