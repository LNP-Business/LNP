-- 055_crm_regle_absence.sql: absent only with no recording and no attendance given; the leads still open from before a date
-- become lost, in long-term follow-up.
do $$
declare pid uuid; cid uuid; k1 uuid; k2 uuid; k3 uuid; k4 uuid; r jsonb;
        p_old uuid; c_old uuid; p_late uuid; c_late uuid; p_paid uuid; c_paid uuid; p_won uuid; c_won uuid; p_new uuid; c_new uuid;
        cut timestamptz := now() - interval '15 days';
begin
  update crm_settings set value = value || jsonb_build_object('since', now() - interval '20 days') where key = 'no_show_rule';
  assert (select (value->>'enabled')::boolean from crm_settings where key = 'no_show_rule'), 'the rule is on';
  assert (select (value->>'min_minutes')::int from crm_settings where key = 'no_show_rule') = 30, 'a complete call: 30 minutes';

  insert into crm_people (full_name) values ('Absence Lead') returning id into pid;
  insert into crm_cycles (person_id, opened_at) values (pid, now() - interval '12 days') returning id into cid;
  -- the first booking, nothing recorded, nothing declared: absent
  insert into crm_calls (cycle_id, rank, status, scheduled_start, scheduled_end) values (cid, 1, 'scheduled', now() - interval '10 days', now() - interval '10 days' + interval '45 minutes') returning id into k1;
  -- given as held by iClosed, no recording: the sales rep decides
  insert into crm_calls (cycle_id, rank, status, scheduled_start, scheduled_end) values (cid, 1, 'held', now() - interval '8 days', now() - interval '8 days' + interval '45 minutes') returning id into k2;
  -- a 40-minute recording: held, outcome awaited
  insert into crm_calls (cycle_id, rank, status, scheduled_start, scheduled_end, recorded_by, recording_start, recording_end)
  values (cid, 1, 'held', now() - interval '6 days', now() - interval '6 days' + interval '45 minutes', 'valentino', now() - interval '6 days', now() - interval '6 days' + interval '40 minutes') returning id into k3;
  -- one hour ago: still within the 3 hours
  insert into crm_calls (cycle_id, rank, status, scheduled_start, scheduled_end) values (cid, 2, 'scheduled', now() - interval '2 hours', now() - interval '1 hour') returning id into k4;
  r := crm_apply_no_show_rule(false, cid);
  assert (select status::text from crm_calls where id = k1) = 'no_show', 'no recording, nothing declared: absent';
  assert (select status::text from crm_calls where id = k2) = 'held', 'held in iClosed: left to the sales rep';
  assert (select status::text from crm_calls where id = k3) = 'held', 'a complete call stays held';
  assert (select status::text from crm_calls where id = k4) = 'scheduled', 'not before 3 hours';
  assert (select next_move->>'code' from crm_cycles where id = cid) = 'declare_outcome', 'the outcome of the complete call is awaited';

  -- before the cut: an open lead with nothing since → lost, in long-term follow-up
  insert into crm_people (full_name) values ('Old Open Lead') returning id into p_old;
  insert into crm_cycles (person_id, opened_at) values (p_old, now() - interval '30 days') returning id into c_old;
  insert into crm_calls (cycle_id, rank, status, scheduled_start, scheduled_end) values (c_old, 1, 'held', now() - interval '28 days', now() - interval '28 days' + interval '45 minutes');
  -- opened before, but booked after the cut: stays open
  insert into crm_people (full_name) values ('Late Booking Lead') returning id into p_late;
  insert into crm_cycles (person_id, opened_at) values (p_late, now() - interval '30 days') returning id into c_late;
  insert into crm_calls (cycle_id, rank, status, scheduled_start, scheduled_end) values (c_late, 1, 'scheduled', now() + interval '2 days', now() + interval '2 days' + interval '45 minutes');
  -- opened before, with a payment: stays
  insert into crm_people (full_name) values ('Paid Lead') returning id into p_paid;
  insert into crm_cycles (person_id, opened_at) values (p_paid, now() - interval '30 days') returning id into c_paid;
  insert into crm_payments (cycle_id, whop_payment_id, amount, status, paid_at) values (c_paid, 'pay_absence_1', 100, 'paid', now() - interval '25 days');
  -- opened after the cut: stays
  insert into crm_people (full_name) values ('New Lead') returning id into p_new;
  insert into crm_cycles (person_id, opened_at) values (p_new, now() - interval '5 days') returning id into c_new;

  r := crm_close_before(cut, true);
  assert (select status::text from crm_cycles where id = c_old) = 'active', 'a dry run writes nothing';
  r := crm_close_before(cut, false);
  assert (select status::text from crm_cycles where id = c_old) = 'lost', 'open before the cut, nothing since: lost';
  assert (select close_reason from crm_cycles where id = c_old) = 'timing', 'reason: not the right time';
  assert exists (select 1 from crm_nurture_tracks where person_id = p_old and status = 'active' and origin_cycle_id = c_old and intensity = 'standard'),
    'in long-term follow-up';
  assert (select status::text from crm_cycles where id = c_late) = 'active', 'a booking after the cut keeps the lead open';
  assert (select status::text from crm_cycles where id = c_paid) <> 'lost', 'a paid lead is never lost';
  assert (select status::text from crm_cycles where id = c_new) = 'active', 'a lead opened after the cut stays open';
  r := crm_close_before(cut, false);
  assert (r->>'lost')::int = 0, 'runs again without change: ' || r::text;
  assert (select count(*) from crm_nurture_tracks where person_id = p_old) = 1, 'one follow-up only';
end $$;
select 'absence rule SQL checks: all passed';
