-- 030_crm_no_show_rule.sql: no complete Fathom recording = no-show on R1, missed (reschedule) on R2+.
-- 056: only a call with no recording and no attendance given; a short recording is left to the sales rep.
do $$
declare pid uuid; cid uuid; k1 uuid; k2 uuid; k3 uuid; k4 uuid; old uuid; r jsonb;
begin
  update crm_settings set value = value || jsonb_build_object('since', now() - interval '30 days') where key = 'no_show_rule';
  insert into crm_people (full_name) values ('No Show Lead') returning id into pid;
  insert into crm_cycles (person_id, opened_at) values (pid, now() - interval '40 days') returning id into cid;
  -- before the Fathom history: never read
  insert into crm_calls (cycle_id, rank, status, scheduled_start, scheduled_end) values (cid, 1, 'held', now() - interval '35 days', now() - interval '35 days' + interval '45 minutes') returning id into old;
  -- R1 booked, nothing recorded
  insert into crm_calls (cycle_id, rank, status, scheduled_start, scheduled_end) values (cid, 1, 'scheduled', now() - interval '10 days', now() - interval '10 days' + interval '45 minutes') returning id into k1;
  -- R1 again, a 3-minute recording only (not complete)
  insert into crm_calls (cycle_id, rank, status, scheduled_start, scheduled_end, recorded_by, recording_start, recording_end)
  values (cid, 1, 'held', now() - interval '8 days', now() - interval '8 days' + interval '45 minutes', 'valentino', now() - interval '8 days', now() - interval '8 days' + interval '3 minutes') returning id into k2;
  -- a complete R1 (40 minutes)
  insert into crm_calls (cycle_id, rank, status, scheduled_start, scheduled_end, recorded_by, recording_start, recording_end)
  values (cid, 1, 'held', now() - interval '6 days', now() - interval '6 days' + interval '45 minutes', 'valentino', now() - interval '6 days', now() - interval '6 days' + interval '40 minutes') returning id into k3;
  insert into crm_call_outcomes (call_id, attendance, decision, declared_at, declared_by) select k3, 'held', 'follow_up', now() - interval '6 days', id from crm_members limit 1;
  -- the R2, not recorded
  insert into crm_calls (cycle_id, rank, status, scheduled_start, scheduled_end) values (cid, 2, 'scheduled', now() - interval '2 days', now() - interval '2 days' + interval '45 minutes') returning id into k4;
  assert (select rank from crm_calls where id = k2) = 1 and (select rank from crm_calls where id = k3) = 1 and (select rank from crm_calls where id = k4) = 2,
    'a recording under 7 minutes does not take a number';
  r := crm_apply_no_show_rule(true, cid);
  assert (r->>'no_show_r1')::int = 1 and (r->>'missed_r2_plus')::int = 1, 'dry run counts: ' || r::text;
  assert (select status::text from crm_calls where id = k1) = 'scheduled', 'a dry run writes nothing';
  r := crm_apply_no_show_rule(false, cid);
  assert (select status::text from crm_calls where id = old) = 'held', 'calls before since are untouched';
  assert (select status::text from crm_calls where id = k1) = 'no_show', 'R1 with no recording = no-show';
  assert (select status::text from crm_calls where id = k2) = 'held', '056: a short recording is left to the sales rep';
  assert (select status::text from crm_calls where id = k3) = 'held', 'the complete R1 stays held';
  assert (select status::text from crm_calls where id = k4) = 'missed', 'a missed R2 is not a no-show';
  assert (select next_move->>'label' from crm_cycles where id = cid) = 'Déclarer l''issue de l''appel', '056: the short recording asks the sales rep first';
  assert (select no_shows from crm_cycles where id = cid) = 1, 'no-shows counted: R1 only';
  r := crm_apply_no_show_rule(false, cid);
  assert (r->>'no_show_r1')::int = 0 and (r->>'missed_r2_plus')::int = 0, 'runs again without change';
  -- the recording comes later: held again, the rule's event goes
  update crm_calls set recorded_by = 'valentino', recording_start = scheduled_start, recording_end = scheduled_start + interval '30 minutes' where id = k4;
  assert (select status::text from crm_calls where id = k4) = 'held', 'a late complete recording wins';
  assert not exists (select 1 from crm_events where source_id = 'noshow:' || k4), 'the rule event is removed';
  -- won cycles are never read
  update crm_calls set status = 'scheduled' where id = k1;
  delete from crm_events where source_id = 'noshow:' || k1;
  insert into crm_events (person_id, cycle_id, occurred_at, actor, channel, type, source, source_id)
  values (pid, cid, now() - interval '1 day', 'prospect', 'payment', 'payment_succeeded', 'crm', 'test:pay:' || cid);
  perform crm_recompute_cycle(cid);
  r := crm_apply_no_show_rule(false, cid);
  assert (select status::text from crm_calls where id = k1) = 'scheduled', 'a won cycle is left alone';
end $$;
select 'no-show rule SQL checks: all passed';
