-- 060_crm_appel_deux_personnes.sql: a call is honoured when two people speak in its Fathom recording, whatever its length;
-- one person only (the sales rep alone) is an absence; without a transcript, the length rule waits.
do $$
declare inbox bigint; r text; j jsonb; c_two uuid; c_one uuid; k_two uuid; k_one uuid; t1 timestamptz := now() - interval '5 days';
        t2 timestamptz := now() - interval '4 days'; two jsonb; one jsonb; iso text := 'YYYY-MM-DD"T"HH24:MI:SS"Z"';
begin
  update crm_settings set value = value || jsonb_build_object('since', now() - interval '20 days') where key = 'no_show_rule';
  insert into crm_sales_team (rep, name) values ('deuxpers', 'Deux Pers') on conflict (rep) do nothing;
  two := '[{"speaker":{"display_name":"Deux Pers - Les Nouveaux Profs"},"text":"Bonjour","timestamp":"00:00:01"},
           {"speaker":{"display_name":"Paul Prospect"},"text":"Bonjour","timestamp":"00:00:03"}]';
  one := '[{"speaker":{"display_name":"Deux Pers - Les Nouveaux Profs"},"text":"Allo ?","timestamp":"00:00:01"},
           {"speaker":{"display_name":"Deux Pers - Les Nouveaux Profs"},"text":"Personne","timestamp":"00:02:00"}]';
  assert crm_transcript_people(two) = 2 and crm_transcript_people(one) = 1 and crm_transcript_people(null) = 0, 'people counted';
  assert crm_transcript_people('"un texte"') = 0 and crm_transcript_people('{"a":1}') = 0 and crm_transcript_people('["ligne"]') = 0,
    'a transcript that is not a list of speakers counts as none (the length rule then applies)';

  -- two booked calls (iClosed)
  insert into crm_webhook_log (source, headers, body, auth_ok) values ('iclosed', '{}', '{}', true) returning id into inbox;
  r := crm_apply_items(inbox, jsonb_build_array(
    jsonb_build_object('type', 'call_booked', 'source', 'iclosed', 'source_id', 'dp:b1', 'occurred_at', to_char((t1 - interval '2 days') at time zone 'UTC', iso),
      'identity', jsonb_build_object('email', 'deux.paul@example.com', 'name', 'Paul Prospect'), 'refs', jsonb_build_object('iclosed_call_id', 'DP-1'),
      'data', jsonb_build_object('start', to_char(t1 at time zone 'UTC', iso), 'end', to_char((t1 + interval '45 minutes') at time zone 'UTC', iso), 'host_email', 'deuxpers@lesnouveauxprofs.fr')),
    jsonb_build_object('type', 'call_booked', 'source', 'iclosed', 'source_id', 'dp:b2', 'occurred_at', to_char((t2 - interval '2 days') at time zone 'UTC', iso),
      'identity', jsonb_build_object('email', 'deux.seul@example.com', 'name', 'Sam Seul'), 'refs', jsonb_build_object('iclosed_call_id', 'DP-2'),
      'data', jsonb_build_object('start', to_char(t2 at time zone 'UTC', iso), 'end', to_char((t2 + interval '45 minutes') at time zone 'UTC', iso), 'host_email', 'deuxpers@lesnouveauxprofs.fr'))));
  assert r = 'processed', 'bookings applied: ' || r;
  select id into c_two from crm_cycles where person_id = (crm_people_for('{"email":"deux.paul@example.com"}'))[1];
  select id into c_one from crm_cycles where person_id = (crm_people_for('{"email":"deux.seul@example.com"}'))[1];
  select id into k_two from crm_calls where cycle_id = c_two; select id into k_one from crm_calls where cycle_id = c_one;

  -- a 10-minute recording with the prospect: honoured, however short
  j := crm_apply_recording_item(jsonb_build_object('source_id', 'fathom:recorded:dp1', 'occurred_at', to_char(t1 at time zone 'UTC', iso),
    'refs', jsonb_build_object('fathom_recording_id', 991001, 'recorder_email', 'deuxpers@lesnouveauxprofs.fr'), 'identity', '{"emails":["deux.paul@example.com"]}'::jsonb,
    'data', jsonb_build_object('start', to_char(t1 at time zone 'UTC', iso), 'end', to_char((t1 + interval '10 minutes') at time zone 'UTC', iso), 'transcript', two)), true);
  assert j->>'status' = 'linked', 'linked: ' || j;
  assert (select status::text from crm_calls where id = k_two) = 'held', 'two people, 10 minutes: honoured';
  assert (select crm_call_complete(k) from crm_calls k where id = k_two), 'complete';

  -- a 40-minute recording with the sales rep alone: not honoured, then absent by the rule
  j := crm_apply_recording_item(jsonb_build_object('source_id', 'fathom:recorded:dp2', 'occurred_at', to_char(t2 at time zone 'UTC', iso),
    'refs', jsonb_build_object('fathom_recording_id', 991002, 'recorder_email', 'deuxpers@lesnouveauxprofs.fr'), 'identity', '{"emails":["deux.seul@example.com"]}'::jsonb,
    'data', jsonb_build_object('start', to_char(t2 at time zone 'UTC', iso), 'end', to_char((t2 + interval '40 minutes') at time zone 'UTC', iso), 'transcript', one)), true);
  assert (select status::text from crm_calls where id = k_one) = 'scheduled', 'one person, 40 minutes: not honoured';
  assert not (select crm_call_complete(k) from crm_calls k where id = k_one), 'not complete';
  perform crm_apply_no_show_rule(false, c_one);
  assert (select status::text from crm_calls where id = k_one) = 'no_show', 'the sales rep alone in the meeting: absent';
  assert exists (select 1 from crm_events where call_id = k_one and type = 'outcome_no_show' and data->>'rule' = 'one_person_on_recording'), 'why it is absent';

  -- the same recording, imported again with the prospect in it: honoured
  update crm_calls set status = 'scheduled' where id = k_one;
  j := crm_apply_recording_item(jsonb_build_object('source_id', 'fathom:recorded:dp2', 'occurred_at', to_char(t2 at time zone 'UTC', iso),
    'refs', jsonb_build_object('fathom_recording_id', 991002, 'recorder_email', 'deuxpers@lesnouveauxprofs.fr'), 'identity', '{"emails":["deux.seul@example.com"]}'::jsonb,
    'data', jsonb_build_object('start', to_char(t2 at time zone 'UTC', iso), 'end', to_char((t2 + interval '40 minutes') at time zone 'UTC', iso), 'transcript', two)), true);
  assert (select status::text from crm_calls where id = k_one) = 'held', 'two people now: honoured';

  -- and back with one person only and no outcome declared: back to « à déclarer »
  j := crm_apply_recording_item(jsonb_build_object('source_id', 'fathom:recorded:dp2', 'occurred_at', to_char(t2 at time zone 'UTC', iso),
    'refs', jsonb_build_object('fathom_recording_id', 991002, 'recorder_email', 'deuxpers@lesnouveauxprofs.fr'), 'identity', '{"emails":["deux.seul@example.com"]}'::jsonb,
    'data', jsonb_build_object('start', to_char(t2 at time zone 'UTC', iso), 'end', to_char((t2 + interval '40 minutes') at time zone 'UTC', iso), 'transcript', one)), true);
  assert (select status::text from crm_calls where id = k_one) = 'scheduled', 'held by the import alone, one person: à déclarer';
end $$;
select 'appel deux personnes SQL checks: all passed';
