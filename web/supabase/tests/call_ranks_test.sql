-- 029_crm_call_ranks.sql: a new R number only after a call with a recording or a transcript.
do $$
declare pid uuid; cid uuid; k1 uuid; k2 uuid; k3 uuid; k4 uuid;
begin
  insert into crm_people (full_name) values ('Rank Lead') returning id into pid;
  insert into crm_cycles (person_id, opened_at) values (pid, now() - interval '10 days') returning id into cid;
  -- R1 booked then canceled, a new booking (as iClosed sends them: max + 1)
  insert into crm_calls (cycle_id, rank, status, scheduled_start, scheduled_end) values (cid, 1, 'canceled', now() - interval '8 days', now() - interval '8 days' + interval '45 minutes') returning id into k1;
  insert into crm_calls (cycle_id, rank, status, scheduled_start, scheduled_end) values (cid, 2, 'scheduled', now() - interval '6 days', now() - interval '6 days' + interval '45 minutes') returning id into k2;
  assert (select rank from crm_calls where id = k2) = 1, 'the new booking of a canceled R1 is R1';
  -- a no-show, then a rebooking: still R1
  update crm_calls set status = 'no_show' where id = k2;
  insert into crm_calls (cycle_id, rank, status, scheduled_start, scheduled_end) values (cid, 3, 'scheduled', now() - interval '4 days', now() - interval '4 days' + interval '45 minutes') returning id into k3;
  assert (select rank from crm_calls where id = k3) = 1, 'after a no-show, still R1';
  -- the call is held with a transcript: R1; the next booking is R2
  update crm_calls set status = 'held', transcript_raw = '[00:01] Sales: hello' where id = k3;
  insert into crm_calls (cycle_id, rank, status, scheduled_start, scheduled_end) values (cid, 4, 'scheduled', now() + interval '1 day', now() + interval '1 day 45 minutes') returning id into k4;
  assert (select rank from crm_calls where id = k3) = 1 and (select rank from crm_calls where id = k4) = 2, 'R2 only after an analysable R1';
  assert (select rank from crm_calls where id = k1) = 1 and (select rank from crm_calls where id = k2) = 1, 'earlier calls stay R1';
end $$;
select 'call ranks SQL checks: all passed';
