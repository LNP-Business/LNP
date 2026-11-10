-- Import checks: dry run writes nothing, real run creates, re-run and a second source do not duplicate.
\set ON_ERROR_STOP 1
insert into crm_people (id, full_name, primary_email) values ('10000000-0000-0000-0000-0000000000a1', 'From iClosed', 'jane@ex.com');
insert into crm_person_identities (person_id, kind, value, source) values ('10000000-0000-0000-0000-0000000000a1', 'email', 'jane@ex.com', 'iclosed');
insert into crm_import_runs (id, source, dry_run) values ('20000000-0000-0000-0000-0000000000a1', 'import', true);

create function t_items() returns jsonb language sql as $$ select '[
  {"source_ref":"lead_1:cont_1","name":"Jane Roe","identity":{"email":["Jane@Ex.com"],"phone":["+14155552671"],"close_contact_id":"cont_1"},"data":{"status_label":"Won"}},
  {"source_ref":"lead_2:cont_2","name":"Bob","identity":{"email":["bob@ex.com"],"close_contact_id":"cont_2"},"data":{"status_label":"Lost"}},
  {"source_ref":"lead_2:cont_3","name":"Bob again","identity":{"email":["bob@ex.com"],"close_contact_id":"cont_3"},"data":{"status_label":"Lost"}},
  {"source_ref":"lead_3:cont_4","name":"No ids","identity":{"phone":["0612345678"]},"data":{}}
]'::jsonb $$;

do $$ declare r jsonb; begin
  r := crm_import_people('20000000-0000-0000-0000-0000000000a1', 'import', t_items(), true);
  assert (r->>'created')::int = 1 and (r->>'matched')::int = 2 and (r->>'skipped')::int = 1, 'dry run counts: ' || r;
  assert (r#>>'{statuses,Lost}')::int = 2 and (r#>>'{statuses,(none)}')::int = 1, 'statuses counted';
  assert (select count(*) from crm_people) = 1 and (select count(*) from crm_events) = 0, 'dry run wrote nothing';
end $$;

do $$ declare r jsonb; begin
  r := crm_import_people('20000000-0000-0000-0000-0000000000a1', 'import', t_items(), false);
  assert (select count(*) from crm_people) = 2, 'Jane matched the iClosed person, Bob created once: ' || r;
  assert (select count(*) from crm_person_identities where person_id = '10000000-0000-0000-0000-0000000000a1') = 3, 'Jane got phone + Close contact id';
  assert (select count(*) from crm_events where type = 'imported') = 3, 'history kept per contact';
  r := crm_import_people('20000000-0000-0000-0000-0000000000a1', 'import', t_items(), false);
  assert (select count(*) from crm_people) = 2 and (select count(*) from crm_events) = 3, 'second run: no duplicate';
  assert (r->>'created')::int = 0, 'nothing created the second time';
end $$;

-- a contact whose email is one person and phone another: not guessed
do $$ declare r jsonb; begin
  r := crm_import_people('20000000-0000-0000-0000-0000000000a1', 'import',
    '[{"source_ref":"x","identity":{"email":["bob@ex.com"],"phone":["+14155552671"]},"data":{}}]', false);
  assert (r->>'conflicts')::int = 1, 'conflict reported';
end $$;

do $$ begin
  perform crm_import_save('20000000-0000-0000-0000-0000000000a1', '{"skip":100}', '{"created":1}', 'done');
  assert (select status from crm_import_runs) = 'done' and (select finished_at from crm_import_runs) is not null, 'run saved';
end $$;

-- iClosed DISQUALIFIED -> one closed cycle with the CRM status disqualified (008), read the same way by the projector
do $$ declare r jsonb; pid uuid; begin
  perform crm_import_people('20000000-0000-0000-0000-0000000000a1', 'import', '[
    {"source_ref":"iclosed:7","name":"Dq","identity":{"email":["dq@ex.com"],"iclosed_contact_id":"7"},"occurred_at":"2026-10-01T10:00:00Z","data":{"status_label":"DISQUALIFIED"}},
    {"source_ref":"iclosed:8","name":"Ok","identity":{"email":["ok@ex.com"],"iclosed_contact_id":"8"},"data":{"status_label":"POTENTIAL"}},
    {"source_ref":"iclosed:9","name":"Busy","identity":{"email":["busy@ex.com"],"iclosed_contact_id":"9"},"data":{"status_label":"DISQUALIFIED"}}]', false);
  select person_id into pid from crm_person_identities where value = 'busy@ex.com';
  insert into crm_cycles (person_id, opened_at) values (pid, now());
  r := crm_import_iclosed_disqualified(true);
  assert (r->>'created')::int = 1 and (r->>'already_had_a_cycle')::int = 1, 'dry counts: ' || r;
  assert (select count(*) from crm_cycles where status = 'disqualified') = 0, 'dry run wrote nothing';
  r := crm_import_iclosed_disqualified(false);
  select person_id into pid from crm_person_identities where value = 'dq@ex.com';
  assert (select count(*) from crm_cycles where person_id = pid and status = 'disqualified' and close_reason = 'dq_off_target'
          and closed_at = '2026-10-01T10:00:00Z') = 1, 'disqualified cycle created';
  perform crm_recompute_cycle((select id from crm_cycles where person_id = pid));
  assert (select status from crm_cycles where person_id = pid) = 'disqualified', 'projector keeps it disqualified';
  r := crm_import_iclosed_disqualified(false);
  assert (r->>'created')::int = 0 and (select count(*) from crm_cycles where person_id = pid) = 1, 'second run: no duplicate';
end $$;

-- iClosed calls (009): a cycle per person with its calls, closed by the history unless a call is ahead; the 008 cycle kept
do $$ declare r jsonb; pid uuid; cid uuid; begin
  r := crm_import_calls('[
    {"name":"Ok","identity":{"email":["ok@ex.com"],"iclosed_contact_id":"8"},"calls":[
      {"iclosed_call_id":"c1","booked_at":"2026-03-01T09:00:00Z","start":"2026-03-02T10:00:00Z","end":"2026-03-02T10:45:00Z","status":"no_show","data":{"no_sale_reason":"NO_SHOW"}},
      {"iclosed_call_id":"c2","booked_at":"2026-03-03T09:00:00Z","start":"2026-03-04T10:00:00Z","end":"2026-03-04T10:45:00Z","status":"canceled","canceled_at":"2026-03-03T12:00:00Z","data":{}}],
     "close":{"status":"lost","reason":"unreachable","at":"2026-03-04T10:00:00Z"}},
    {"name":"Dq","identity":{"email":["dq@ex.com"],"iclosed_contact_id":"7"},"calls":[
      {"iclosed_call_id":"c3","start":"2026-09-01T10:00:00Z","status":"held","data":{"iclosed_outcome":"NO_SALE"}}],
     "close":{"status":"lost","reason":"timing","at":"2026-09-01T10:00:00Z"}},
    {"name":"Soon","identity":{"email":["soon@ex.com"]},"calls":[
      {"iclosed_call_id":"c4","start":"2099-01-01T10:00:00Z","status":"scheduled","data":{}}],
     "close":{"status":"lost","reason":"timing","at":"2026-01-01T10:00:00Z"}}]', true);
  assert (r->>'calls')::int = 4 and (r->>'cycles_opened')::int = 2 and (r->>'created_people')::int = 1, 'dry counts: ' || r;
  assert not exists (select 1 from crm_calls), 'dry run wrote nothing';
  r := crm_import_calls('[
    {"name":"Ok","identity":{"email":["ok@ex.com"],"iclosed_contact_id":"8"},"calls":[
      {"iclosed_call_id":"c1","booked_at":"2026-03-01T09:00:00Z","start":"2026-03-02T10:00:00Z","end":"2026-03-02T10:45:00Z","status":"no_show","data":{"no_sale_reason":"NO_SHOW"}},
      {"iclosed_call_id":"c2","booked_at":"2026-03-03T09:00:00Z","start":"2026-03-04T10:00:00Z","end":"2026-03-04T10:45:00Z","status":"canceled","canceled_at":"2026-03-03T12:00:00Z","data":{}}],
     "close":{"status":"lost","reason":"unreachable","at":"2026-03-04T10:00:00Z"}},
    {"name":"Dq","identity":{"email":["dq@ex.com"],"iclosed_contact_id":"7"},"calls":[
      {"iclosed_call_id":"c3","start":"2026-09-01T10:00:00Z","status":"held","data":{"iclosed_outcome":"NO_SALE"}}],
     "close":{"status":"lost","reason":"timing","at":"2026-09-01T10:00:00Z"}},
    {"name":"Soon","identity":{"email":["soon@ex.com"]},"calls":[
      {"iclosed_call_id":"c4","start":"2099-01-01T10:00:00Z","status":"scheduled","data":{}}],
     "close":{"status":"lost","reason":"timing","at":"2026-01-01T10:00:00Z"}}]', false);
  select person_id into pid from crm_person_identities where value = 'ok@ex.com';
  select id into cid from crm_cycles where person_id = pid;
  assert (select status from crm_cycles where id = cid) = 'lost' and (select close_reason from crm_cycles where id = cid) = 'unreachable', 'lost, unreachable';
  assert (select opened_at from crm_cycles where id = cid) = '2026-03-01T09:00:00Z', 'opened at the first booking';
  -- 029 (Romain 2026-10-31): no call was recorded or transcribed, so the no-show and the canceled booking are both R1
  assert (select string_agg(rank || ':' || status, ',' order by rank, status) from crm_calls where cycle_id = cid) = '1:canceled,1:no_show', 'no analysable call: both R1';
  assert (select count(*) from crm_events where cycle_id = cid and type = 'cycle_lost') = 1, 'one closing step only';
  perform crm_recompute_cycle(cid);
  assert (select status from crm_cycles where id = cid) = 'lost', 'projector keeps it lost';
  select person_id into pid from crm_person_identities where value = 'dq@ex.com';
  assert (select count(*) from crm_cycles where person_id = pid) = 1 and (select status from crm_cycles where person_id = pid) = 'disqualified', '008 cycle kept, calls attached';
  assert (select count(*) from crm_calls k join crm_cycles c on c.id = k.cycle_id where c.person_id = pid) = 1, 'call attached to the 008 cycle';
  select person_id into pid from crm_person_identities where value = 'soon@ex.com';
  assert (select status from crm_cycles where person_id = pid) = 'active', 'a call ahead keeps the cycle active';
  r := crm_import_calls('[{"name":"Ok","identity":{"email":["ok@ex.com"]},"calls":[{"iclosed_call_id":"c1","start":"2026-03-02T10:00:00Z","status":"no_show"}],"close":null}]', false);
  assert (r->>'calls_known')::int = 1 and (select count(*) from crm_calls) = 4, 'second run: no duplicate call';
  assert (select count(*) from crm_people_without_cycle where primary_email = 'bob@ex.com') = 1, 'Bob never booked: No booking';
  assert not exists (select 1 from crm_people_without_cycle where primary_email = 'ok@ex.com'), 'a person with a cycle is not listed';
end $$;

-- first_seen_at (010): the earliest event, kept up to date on new events
do $$ declare pid uuid; begin
  select person_id into pid from crm_person_identities where value = 'ok@ex.com';
  assert (select first_seen_at from crm_people where id = pid) = '2026-03-01T09:00:00Z', 'backfilled from the first booking: ' || (select first_seen_at from crm_people where id = pid);
  insert into crm_events (person_id, occurred_at, actor, channel, type, source, source_id) values (pid, '2025-01-01T00:00:00Z', 'system', 'crm', 'note', 'crm', 't-first');
  assert (select first_seen_at from crm_people where id = pid) = '2025-01-01T00:00:00Z', 'an older event moves it back';
  insert into crm_events (person_id, occurred_at, actor, channel, type, source, source_id) values (pid, now(), 'system', 'crm', 'note', 'crm', 't-later');
  assert (select first_seen_at from crm_people where id = pid) = '2025-01-01T00:00:00Z', 'a later event does not';
  assert (select first_seen_at from crm_people_without_cycle where primary_email = 'bob@ex.com') is not null, 'view has it';
end $$;

-- 011: every LNP member is a CRM member, now and when invited later; saved screen lists are cleared
do $$ declare u uuid := '30000000-0000-0000-0000-0000000000b1'; v uuid := '30000000-0000-0000-0000-0000000000b2'; begin
  insert into auth.users (id, email, raw_app_meta_data) values (u, 'michael@ex.com', '{"screens":["crm"],"provider":"email"}'), (v, 'vic@ex.com', '{}');
  update auth.users set raw_app_meta_data = raw_app_meta_data - 'screens' where raw_app_meta_data ? 'screens';
  assert (select raw_app_meta_data from auth.users where id = u) = '{"provider":"email"}', 'screens cleared, rest kept';
  insert into members (user_id, email, role) values (u, 'Michael@ex.com', 'admin');
  insert into members (user_id, email, role) values (v, 'vic@ex.com', 'viewer');
  assert (select role::text || ':' || member_key from crm_members where id = u) = 'admin:michael', 'invited admin = CRM admin';
  assert (select role::text from crm_members where id = v) = 'viewer', 'viewer stays a viewer';
  perform set_config('request.jwt.claim.sub', u::text, true);
  assert crm_sees_all(), 'Michael sees the whole CRM';
  perform set_config('request.jwt.claim.sub', '', true);
  perform crm_member_from_team(u);
  assert (select count(*) from crm_members where id = u) = 1, 'run again: no duplicate';
end $$;

-- 012 / 052: WhatsApp messages on the right cycle, statuses on one handle, unknown numbers kept, STOP
do $$ declare pid uuid; cid uuid; r jsonb; inbox bigint; begin
  select person_id into pid from crm_person_identities where value = 'ok@ex.com';
  insert into crm_person_identities (person_id, kind, value, source) values (pid, 'phone', '+33611111111', 'import');
  select id into cid from crm_cycles where person_id = pid;
  r := crm_import_messages('[
    {"type":"message_in","source_id":"whatsapp:h1","occurred_at":"2026-03-05T10:00:00Z","actor":"prospect","channel":"whatsapp","content":"Hello","identity":{"phone":"+33611111111"},"data":{"status":"RECEIVED"}},
    {"type":"message_out","source_id":"whatsapp:h2","occurred_at":"2026-03-05T10:05:00Z","actor":"sales","channel":"whatsapp","content":"Hi!","identity":{"phone":"+33611111111"},"data":{"status":"SENT"}},
    {"type":"message_in","source_id":"whatsapp:h3","occurred_at":"2026-03-05T11:00:00Z","actor":"prospect","channel":"sms","content":"Who?","identity":{"phone":"+33699999999"},"data":{}}]', true);
  assert (r->>'new')::int = 3 and (r->>'new_people')::int = 1 and (r->>'no_cycle')::int = 1, 'dry counts: ' || r;
  assert not exists (select 1 from crm_events where source = 'whatsapp'), 'dry run wrote nothing';
  r := crm_import_messages('[
    {"type":"message_in","source_id":"whatsapp:h1","occurred_at":"2026-03-05T10:00:00Z","actor":"prospect","channel":"whatsapp","content":"Hello","identity":{"phone":"+33611111111"},"data":{"status":"RECEIVED"}},
    {"type":"message_out","source_id":"whatsapp:h2","occurred_at":"2026-03-05T10:05:00Z","actor":"sales","channel":"whatsapp","content":"Hi!","identity":{"phone":"+33611111111"},"data":{"status":"SENT"}},
    {"type":"message_in","source_id":"whatsapp:h3","occurred_at":"2026-03-05T11:00:00Z","actor":"prospect","channel":"sms","content":"Who?","identity":{"phone":"+33699999999"},"data":{}}]', false);
  assert (select count(*) from crm_events where source = 'whatsapp' and cycle_id = cid) = 2, 'both messages on the cycle';
  assert exists (select 1 from crm_people p join crm_person_identities i on i.person_id = p.id where i.value = '+33699999999'), 'unknown number kept as a person';
  insert into crm_webhook_log (source, headers, body, auth_ok) values ('whatsapp', '{}', '{}', true) returning id into inbox;
  assert crm_apply_messages(inbox, '[{"type":"message_out","source_id":"whatsapp:h2","occurred_at":"2026-03-05T10:05:00Z","actor":"sales","channel":"whatsapp","content":"Hi!","identity":{"phone":"+33611111111"},"data":{"status":"READ","error_code":null}}]') = 'processed', 'webhook applied';
  assert (select count(*) from crm_events where source_id = 'whatsapp:h2') = 1 and (select data->>'status' from crm_events where source_id = 'whatsapp:h2') = 'READ', 'status updated on the same message';
  assert (select status from crm_webhook_log where id = inbox) = 'processed', 'inbox row processed';
  insert into crm_webhook_log (source, headers, body, auth_ok) values ('whatsapp', '{}', '{}', true) returning id into inbox;
  perform crm_apply_messages(inbox, '[{"type":"opt_out","source_id":"whatsapp:optout:h9","occurred_at":"2026-03-06T10:00:00Z","actor":"prospect","channel":"whatsapp","identity":{"phone":"+33611111111"},"data":{}}]');
  assert (select opted_out_at from crm_people where id = pid) is not null, 'STOP sets opted_out_at';
end $$;

-- 013: won from an onboarding call or Close Customer; a canceled REJECTED call is not a disqualification
do $$ declare r jsonb; a uuid; b uuid; ca uuid; cb uuid; begin
  perform crm_import_people('20000000-0000-0000-0000-0000000000a1', 'import', '[
    {"source_ref":"iclosed:21","name":"Onb","identity":{"email":["onb@ex.com"],"iclosed_contact_id":"21"},"data":{"status_label":"STRATEGY_CALL_BOOKED"}},
    {"source_ref":"lead_9:cont_9","name":"Rej","identity":{"email":["rej@ex.com"]},"data":{"status_label":"New"}}]', false);
  perform crm_import_calls('[
    {"name":"Onb","identity":{"email":["onb@ex.com"]},"calls":[
      {"iclosed_call_id":"o1","start":"2026-05-01T10:00:00Z","status":"canceled","data":{"iclosed_outcome":"REJECTED","no_sale_reason":"ADMIN_CANCELLED"}},
      {"iclosed_call_id":"o2","start":"2026-05-05T10:00:00Z","status":"scheduled","data":{"event_name":"Your Interior Academy Onboarding Call"}}],
     "close":{"status":"disqualified","reason":"dq_off_target","at":"2026-05-01T10:00:00Z"}},
    {"name":"Rej","identity":{"email":["rej@ex.com"]},"calls":[
      {"iclosed_call_id":"r1","start":"2026-05-01T10:00:00Z","status":"canceled","data":{"iclosed_outcome":"REJECTED","no_sale_reason":"CONTACT_CANCELLED"}}],
     "close":{"status":"disqualified","reason":"dq_off_target","at":"2026-05-01T10:00:00Z"}}]', false);
  select person_id into a from crm_person_identities where value = 'onb@ex.com';
  select person_id into b from crm_person_identities where value = 'rej@ex.com';
  select id into ca from crm_cycles where person_id = a; select id into cb from crm_cycles where person_id = b;
  assert (select status from crm_cycles where id = ca) = 'disqualified' and (select status from crm_cycles where id = cb) = 'disqualified', 'before: both disqualified';
  r := crm_reclassify_imported(true);
  assert (select status from crm_cycles where id = ca) = 'disqualified', 'dry run changes nothing';
  r := crm_reclassify_imported(false);
  assert (select status from crm_cycles where id = ca) = 'won', 'onboarding call = won: ' || r;
  assert (select status from crm_cycles where id = cb) = 'lost' and (select close_reason from crm_cycles where id = cb) = 'timing', 'canceled REJECTED = lost, not disqualified';
  assert (select count(*) from crm_events where cycle_id = ca and type like 'cycle_%') = 1, 'one closing step';
  perform crm_recompute_cycle(ca);
  assert (select status from crm_cycles where id = ca) = 'won', 'projector keeps it won';
  select person_id into a from crm_person_identities where value = 'dq@ex.com';
  assert (select status from crm_cycles where person_id = a) = 'disqualified', 'iClosed contact status DISQUALIFIED stays disqualified';
  r := crm_reclassify_imported(false);
  assert (select status from crm_cycles where id = ca) = 'won', 'run again: same result';
end $$;

-- phase 3: a declared outcome overrides the status the import gave the cycle; next step and amount kept on the event
do $$ declare pid uuid; cid uuid; k uuid; begin
  select person_id into pid from crm_person_identities where value = 'ok@ex.com';
  select id into cid from crm_cycles where person_id = pid;
  select id into k from crm_calls where cycle_id = cid and iclosed_call_id = 'c1';
  assert (select status from crm_cycles where id = cid) = 'lost', 'imported as lost';
  perform set_config('request.jwt.claim.sub', '30000000-0000-0000-0000-0000000000b1', true);
  perform crm_declare_outcome(k, '{"attendance":"held","decision":"follow_up","next_step":"Call back on Thursday"}');
  assert (select status from crm_cycles where id = cid) = 'active', 'follow-up reopens the imported lost cycle';
  assert (select data->>'next_step' from crm_events where cycle_id = cid and type = 'outcome_follow_up') = 'Call back on Thursday', 'next step kept';
  perform crm_declare_outcome(k, '{"attendance":"held","decision":"yes","amount_sold":"6000","payment_plan":"3 instalments"}');
  assert (select status from crm_cycles where id = cid) = 'active' and (select current_stage from crm_cycles where id = cid) = 'cash', 'yes: cash stage, won at the first payment';
  assert (select amount_sold from crm_deals where cycle_id = cid) = 6000, 'deal written';
  perform crm_declare_outcome(k, '{"attendance":"held","decision":"no","reason_code":"price"}');
  assert (select status::text || '/' || close_reason from crm_cycles where id = cid) = 'lost/price', 'no: lost with its reason';
  assert (select count(*) from crm_call_outcomes where call_id = k and superseded_at is null) = 1, 'one current outcome, corrections kept';
  perform set_config('request.jwt.claim.sub', '', true);
end $$;
select 'import SQL checks: all passed';
