-- 032_crm_fathom_closest.sql: among back-to-back calls a recording goes to the closest booking; a tie stays ambiguous and
-- its calls are never made no-shows.
do $$
declare inbox bigint; r text; j jsonb; pa uuid; pb uuid; pc uuid; ka uuid; kb uuid; kc uuid;
begin
  insert into crm_webhook_log (source, headers, body, auth_ok) values ('iclosed', '{}', '{}', true) returning id into inbox;
  r := crm_apply_items(inbox, '[
    {"type":"call_booked","source":"iclosed","source_id":"cl:a","occurred_at":"2026-09-01T10:00:00Z","identity":{"email":"cla@example.com","name":"Cla A"},
     "refs":{"iclosed_call_id":"CL-A"},"data":{"start":"2026-09-10T15:00:00Z","end":"2026-09-10T15:45:00Z","host_email":"valentino@theinterioracademy.com","event_name":"Design Career Roadmap Call"}},
    {"type":"call_booked","source":"iclosed","source_id":"cl:b","occurred_at":"2026-09-01T10:00:00Z","identity":{"email":"clb@example.com","name":"Clb B"},
     "refs":{"iclosed_call_id":"CL-B"},"data":{"start":"2026-09-10T16:00:00Z","end":"2026-09-10T16:45:00Z","host_email":"valentino@theinterioracademy.com","event_name":"Design Career Roadmap Call"}},
    {"type":"call_booked","source":"iclosed","source_id":"cl:c","occurred_at":"2026-09-01T10:00:00Z","identity":{"email":"clc@example.com","name":"Clc C"},
     "refs":{"iclosed_call_id":"CL-C"},"data":{"start":"2026-09-10T16:00:00Z","end":"2026-09-10T16:45:00Z","host_email":"valentino@theinterioracademy.com","event_name":"Design Career Roadmap Call"}}]');
  assert r = 'processed', 'bookings applied';
  select id into ka from crm_calls where iclosed_call_id = 'CL-A';
  select id into kb from crm_calls where iclosed_call_id = 'CL-B';
  select id into kc from crm_calls where iclosed_call_id = 'CL-C';
  -- 15:03, 40 min: A's call starts 3 min away, B's and C's 57 min away → A
  j := crm_apply_recording_item('{"source_id":"fathom:recorded:901","occurred_at":"2026-09-10T15:03:00Z",
    "refs":{"fathom_recording_id":901,"recorder_email":"valentino@theinterioracademy.com"},"identity":{"emails":[]},
    "data":{"start":"2026-09-10T15:03:00Z","end":"2026-09-10T15:43:00Z","title":"Design Career Roadmap Call"}}', false);
  assert j->>'status' = 'linked' and j->>'rule' = 'booking_closest', 'closest booking wins: ' || j::text;
  assert (select fathom_recording_id from crm_calls where id = ka) = 901, 'A''s call filled';
  -- 16:02: B and C both booked at 16:00 → still ambiguous
  j := crm_apply_recording_item('{"source_id":"fathom:recorded:902","occurred_at":"2026-09-10T16:02:00Z",
    "refs":{"fathom_recording_id":902,"recorder_email":"valentino@theinterioracademy.com"},"identity":{"emails":[]},
    "data":{"start":"2026-09-10T16:02:00Z","end":"2026-09-10T16:40:00Z","title":"Design Career Roadmap Call"}}', false);
  assert j->>'status' = 'ambiguous', 'a tie stays ambiguous: ' || j::text;
  -- the no-show rule leaves B's and C's calls alone while that recording may be theirs
  update crm_settings set value = value || jsonb_build_object('since', '2026-09-01T00:00:00Z') where key = 'no_show_rule';
  perform crm_apply_no_show_rule(false, (select cycle_id from crm_calls where id = kb));
  perform crm_apply_no_show_rule(false, (select cycle_id from crm_calls where id = kc));
  assert (select status::text from crm_calls where id = kb) = 'scheduled' and (select status::text from crm_calls where id = kc) = 'scheduled', 'no false no-show';
end $$;
select 'fathom closest SQL checks: all passed';
-- 032: the cockpit counts leads: shown (a complete call of 30 min), pending (a call booked ahead), no-show (the rest)
do $$
declare pid uuid; c1 uuid; c2 uuid; c3 uuid; j jsonb;
begin
  insert into crm_people (full_name) values ('Lead Shown') returning id into pid;
  insert into crm_cycles (person_id, opened_at) values (pid, now() - interval '10 days') returning id into c1;
  insert into crm_calls (cycle_id, rank, status, scheduled_start, scheduled_end, recorded_by, recording_start, recording_end)
  values (c1, 1, 'held', now() - interval '3 days', now() - interval '3 days' + interval '45 minutes', 'valentino', now() - interval '3 days', now() - interval '3 days' + interval '35 minutes');
  insert into crm_people (full_name) values ('Lead Short') returning id into pid;
  insert into crm_cycles (person_id, opened_at) values (pid, now() - interval '10 days') returning id into c2;
  insert into crm_calls (cycle_id, rank, status, scheduled_start, scheduled_end, recorded_by, recording_start, recording_end)
  values (c2, 1, 'held', now() - interval '3 days', now() - interval '3 days' + interval '45 minutes', 'valentino', now() - interval '3 days', now() - interval '3 days' + interval '12 minutes');
  insert into crm_people (full_name) values ('Lead Ahead') returning id into pid;
  insert into crm_cycles (person_id, opened_at) values (pid, now() - interval '10 days') returning id into c3;
  insert into crm_calls (cycle_id, rank, status, scheduled_start, scheduled_end) values (c3, 1, 'canceled', now() - interval '3 days', now() - interval '3 days' + interval '45 minutes');
  insert into crm_calls (cycle_id, rank, status, scheduled_start, scheduled_end) values (c3, 1, 'scheduled', now() + interval '2 days', now() + interval '2 days' + interval '45 minutes');
  j := crm_sales_cockpit_window(now() - interval '7 days', now(), array[c1, c2, c3], false);
  -- 038: an R1 held in iClosed shows even with a short recording; a lead whose R1 calls in the period were all canceled is left out
  assert (j->>'shown_leads')::int = 2 and (j->>'no_show_leads')::int = 0 and (j->>'pending_leads')::int = 0, 'lead counts: ' || j::text;
end $$;
select 'cockpit lead counts SQL checks: all passed';
