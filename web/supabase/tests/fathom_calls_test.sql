-- 025_crm_fathom_calls.sql: Fathom is the source of truth of the sales calls (FL-1 to FL-6, docs/crm/06 §0).
do $$
declare inbox bigint; r text; j jsonb; pa uuid; pb uuid; pc uuid; cy uuid; k1 uuid; tr text; adm uuid := gen_random_uuid();
begin
  insert into auth.users (id, email) values (adm, 'fa.admin@x.com');
  insert into members (user_id, email, role) values (adm, 'fa.admin@x.com', 'admin');
  tr := repeat('[00:00:05] Valentino D: Tell me where you are today with the business. ', 3) ||
        repeat('[00:00:20] Ann Prospect: I have no clients at the moment and it hurts. ', 3);
  -- two booked calls by Valentino (iClosed), one canceled then rebooked
  insert into crm_webhook_log (source, headers, body, auth_ok) values ('iclosed', '{}', '{}', true) returning id into inbox;
  r := crm_apply_items(inbox, '[
    {"type":"call_booked","source":"iclosed","source_id":"fa:b1","occurred_at":"2026-10-01T10:00:00Z","identity":{"email":"ann@example.com","name":"Ann Prospect"},
     "refs":{"iclosed_call_id":"FA-1"},"data":{"start":"2026-10-05T15:00:00Z","end":"2026-10-05T16:00:00Z","host_email":"valentino@theinterioracademy.com","event_name":"Design Career Roadmap Call"}},
    {"type":"call_booked","source":"iclosed","source_id":"fa:b2","occurred_at":"2026-10-06T10:00:00Z","identity":{"email":"ann@example.com"},
     "refs":{"iclosed_call_id":"FA-2"},"data":{"start":"2026-10-08T15:00:00Z","end":"2026-10-08T16:00:00Z","host_email":"valentino@theinterioracademy.com","event_name":"Design Career Roadmap Call"}},
    {"type":"call_canceled","source":"iclosed","source_id":"fa:c2","occurred_at":"2026-10-07T10:00:00Z","refs":{"iclosed_call_id":"FA-2"}},
    {"type":"call_booked","source":"iclosed","source_id":"fa:b3","occurred_at":"2026-10-07T11:00:00Z","identity":{"email":"ann@example.com"},
     "refs":{"iclosed_call_id":"FA-3"},"data":{"start":"2026-10-09T15:00:00Z","end":"2026-10-09T16:00:00Z","host_email":"valentino@theinterioracademy.com","event_name":"Design Career Roadmap Call"}}]');
  assert r = 'processed', 'bookings applied';
  select person_id, id into pa, cy from crm_cycles where person_id = (crm_people_for('{"email":"ann@example.com"}'))[1];

  -- FL-1: a recording by someone who is not a sales rep is not a sales call
  j := crm_apply_recording_item('{"source_id":"fathom:recorded:1","occurred_at":"2026-10-05T15:02:00Z",
    "refs":{"fathom_recording_id":1,"recorder_email":"success@theinterioracademy.com"},"identity":{"emails":["ann@example.com"]},
    "data":{"start":"2026-10-05T15:02:00Z","end":"2026-10-05T15:50:00Z","title":"Onboarding"}}', true);
  assert j->>'status' = 'not_sales_recorder', 'FL-1 ' || j;

  -- FL-2 (b): no invitee email, the booked call at that time finds Ann; FL-4: the booking becomes a held recorded call
  insert into crm_webhook_log (source, headers, body, auth_ok) values ('fathom', '{}', '{}', true) returning id into inbox;
  r := crm_apply_recordings(inbox, jsonb_build_array(jsonb_build_object('source_id', 'fathom:recorded:2', 'occurred_at', '2026-10-05T15:04:00Z',
    'refs', '{"fathom_recording_id":2,"recorder_email":"valentino@theinterioracademy.com"}'::jsonb, 'identity', '{"emails":[]}'::jsonb,
    'data', jsonb_build_object('start', '2026-10-05T15:04:00Z', 'end', '2026-10-05T15:58:00Z', 'title', 'Design Career Roadmap Call',
      'recorder_name', 'Valentino D', 'names', '["Sue P"]'::jsonb, 'transcript_raw', tr,
      'speakers', '[{"name":"Valentino D","email":"valentino@theinterioracademy.com"},{"name":"Ann Prospect","email":null}]'::jsonb))));
  assert r = 'processed', 'recording processed';
  assert (select rule from crm_fathom_recordings where recording_id = 2) = 'booking', 'FL-2 b';
  select id into k1 from crm_calls where iclosed_call_id = 'FA-1';
  assert (select fathom_recording_id from crm_calls where id = k1) = 2, 'booked call filled';
  assert (select status from crm_calls where id = k1) = 'held', 'held from Fathom';
  assert (select speaker_map from crm_calls where id = k1) = '{"Valentino D":"SALES","Ann Prospect":"PROSPECT"}', 'speakers mapped';
  assert exists (select 1 from crm_ca_jobs where call_id = k1 and status = 'queued'), 'webhook R1 queued for analysis';
  assert (crm_ca_call_info(k1)->>'sales_round')::int = 1, 'R1';
  -- FL-6: a recording with no outcome asks for it
  assert (select next_move->>'code' from crm_cycles where id = cy) = 'declare_outcome', 'outcome asked';

  -- FL-2 (a) and FL-4: the second call was not booked at that time (10 Oct): a new call, R2; the canceled and the
  -- unrecorded bookings take the number of the next sales call
  j := crm_import_recordings(jsonb_build_array(jsonb_build_object('source_id', 'fathom:recorded:3', 'occurred_at', '2026-10-10T18:00:00Z',
    'refs', '{"fathom_recording_id":3,"recorder_email":"valentino@theinterioracademy.com"}'::jsonb, 'identity', '{"emails":["ANN@example.com"]}'::jsonb,
    'data', jsonb_build_object('start', '2026-10-10T18:00:00Z', 'end', '2026-10-10T18:40:00Z', 'title', 'Ann follow-up', 'transcript_raw', tr,
      'recorder_name', 'Valentino D', 'speakers', '[{"name":"Valentino D"},{"name":"Ann P."}]'::jsonb))), false);
  assert (j->>'linked')::int = 1 and (j->>'rule_email')::int = 1, 'FL-2 a ' || j;
  assert (select rank from crm_calls where fathom_recording_id = 3) = 2, 'R2 = second recording';
  assert (select rank from crm_calls where iclosed_call_id = 'FA-2') = 2, 'canceled booking before R2 carries R2';
  assert (select rank from crm_calls where iclosed_call_id = 'FA-3') = 2, 'unrecorded booking before R2 carries R2';
  assert not exists (select 1 from crm_ca_jobs where call_id = (select id from crm_calls where fathom_recording_id = 3)), 'an import never queues';
  assert (select transcript_source from crm_calls where fathom_recording_id = 3) = 'fathom', 'transcript stored';
  assert crm_ca_call_info((select id from crm_calls where iclosed_call_id = 'FA-3'))->>'eligible' = 'false', 'no recording, no analysis';

  -- FL-2 (c): a full name; FL-3: nobody → not a sales call; ambiguity
  insert into crm_people (full_name) values ('Bob Builder') returning id into pb;
  j := crm_apply_recording_item('{"source_id":"fathom:recorded:4","occurred_at":"2026-10-12T09:00:00Z",
    "refs":{"fathom_recording_id":4,"recorder_email":"valentino@theinterioracademy.com"},"identity":{"emails":[]},
    "data":{"start":"2026-10-12T09:00:00Z","title":"Bob  builder x Design Career Roadmap Call","names":["Bob  builder"]}}', false);
  assert j->>'status' = 'linked' and j->>'rule' = 'name', 'FL-2 c ' || j;
  assert exists (select 1 from crm_cycles where person_id = pb), 'a lead with no cycle gets one';
  j := crm_apply_recording_item('{"source_id":"fathom:recorded:5","occurred_at":"2026-10-12T11:00:00Z",
    "refs":{"fathom_recording_id":5,"recorder_email":"valentino@theinterioracademy.com"},"identity":{"emails":[]},
    "data":{"start":"2026-10-12T11:00:00Z","title":"Training w/ Tristan","names":["Tristan Steckler"]}}', false);
  assert j->>'status' = 'not_sales', 'FL-3 ' || j;
  assert (select count(*) from crm_people where full_name ilike '%tristan%') = 0, 'never a new person';
  insert into crm_people (full_name) values ('Bob Builder') returning id into pc;
  j := crm_apply_recording_item('{"source_id":"fathom:recorded:6","occurred_at":"2026-10-13T09:00:00Z",
    "refs":{"fathom_recording_id":6,"recorder_email":"valentino@theinterioracademy.com"},"identity":{"emails":[]},
    "data":{"start":"2026-10-13T09:00:00Z","names":["Bob Builder"]}}', false);
  assert j->>'status' = 'ambiguous', 'two people with the name';
  assert (select cardinality(candidates) from crm_fathom_recordings where recording_id = 6) = 2, 'candidates kept';

  -- the same recording again changes nothing (idempotent)
  j := crm_import_recordings(jsonb_build_array(jsonb_build_object('source_id', 'fathom:recorded:3', 'occurred_at', '2026-10-10T18:00:00Z',
    'refs', '{"fathom_recording_id":3,"recorder_email":"valentino@theinterioracademy.com"}'::jsonb, 'identity', '{"emails":[]}'::jsonb,
    'data', '{"start":"2026-10-10T18:00:00Z","end":"2026-10-10T18:40:00Z"}'::jsonb)), false);
  assert j->>'rule_known' = '1', 'known recording';
  assert (select count(*) from crm_calls where fathom_recording_id = 3) = 1, 'one call';
  assert (select count(*) from crm_events where source = 'fathom' and source_id = 'fathom:recorded:3') = 1, 'one event';

  -- the hourly import queues the R1 / R2 analysis (a lead's first recording, by email)
  insert into crm_people (full_name, primary_email) values ('Cy Hourly', 'cy@example.com') returning id into pc;
  perform crm_add_identities(pc, '{"email":"cy@example.com"}', 'iclosed');
  j := crm_import_recordings(jsonb_build_array(jsonb_build_object('source_id', 'fathom:recorded:8', 'occurred_at', '2026-10-15T18:00:00Z',
    'refs', '{"fathom_recording_id":8,"recorder_email":"valentino@theinterioracademy.com"}'::jsonb, 'identity', '{"emails":["cy@example.com"]}'::jsonb,
    'data', jsonb_build_object('start', '2026-10-15T18:00:00Z', 'end', '2026-10-15T18:40:00Z', 'transcript_raw', tr, 'recorder_name', 'Valentino D',
      'speakers', '[{"name":"Valentino D"},{"name":"Cy H"}]'::jsonb))), false, true);
  assert j->>'queued' = '1', 'hourly import queues ' || j;
  assert exists (select 1 from crm_ca_jobs where call_id = (select id from crm_calls where fathom_recording_id = 8) and status = 'queued'), 'job queued';

  -- a dry run writes nothing
  j := crm_import_recordings('[{"source_id":"fathom:recorded:7","occurred_at":"2026-10-14T09:00:00Z",
    "refs":{"fathom_recording_id":7,"recorder_email":"valentino@theinterioracademy.com"},"identity":{"emails":["ann@example.com"]},
    "data":{"start":"2026-10-14T09:00:00Z"}}]', true, true);
  assert j->>'linked' = '1', 'dry run counts';
  assert not exists (select 1 from crm_fathom_recordings where recording_id = 7), 'dry run rolled back';

  -- an outcome declared stops the question
  insert into crm_call_outcomes (call_id, attendance, decision, declared_by)
  select k1, 'held', 'follow_up', adm;
  insert into crm_call_outcomes (call_id, attendance, decision, declared_by)
  select id, 'held', 'follow_up', adm from crm_calls where fathom_recording_id = 3;
  perform crm_recompute_cycle(cy);
  -- the recorded calls no longer ask; the booking of 9 Oct, never recorded, still does (no-show?)
  assert (select (next_move->>'due_at')::timestamptz from crm_cycles where id = cy) = '2026-10-09T16:00:00Z', 'only the unrecorded booking asks';
  update crm_calls set status = 'no_show' where iclosed_call_id = 'FA-3';
  perform crm_recompute_cycle(cy);
  assert (select next_move->>'code' from crm_cycles where id = cy) <> 'declare_outcome', 'outcomes declared';
end $$;
select 'fathom calls SQL checks: all passed';
