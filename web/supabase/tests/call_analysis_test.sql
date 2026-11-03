-- 020_crm_call_analysis.sql: which calls are analysed, who adds a transcript, the worker's claim / store / fail, who reads.
create table ca_test_ids (k text primary key, v uuid);
grant select on ca_test_ids to authenticated;
do $$
declare adm uuid := gen_random_uuid(); rep uuid := gen_random_uuid(); rep2 uuid := gen_random_uuid();
        pid uuid; cid uuid; k1 uuid; k2 uuid; k3 uuid; k4 uuid; k5 uuid; info jsonb; r jsonb; job uuid; ok boolean;
        raw text := repeat('[00:06] Valentino: Hello there, how are you doing today? ', 3) || repeat('[00:12] Jane Doe: I am fine thanks, I want more clients. ', 3);
begin
  insert into auth.users (id, email) values (adm, 'ca.admin@x.com'), (rep, 'ca.rep@x.com'), (rep2, 'ca.rep2@x.com');
  insert into members (user_id, email, role) values (adm, 'ca.admin@x.com', 'admin'), (rep, 'ca.rep@x.com', 'member'), (rep2, 'ca.rep2@x.com', 'member');
  update crm_members set role = 'sales' where id in (rep, rep2);
  insert into crm_people (full_name) values ('Jane Doe') returning id into pid;
  insert into crm_cycles (person_id, owner_id, opened_at) values (pid, rep, now() - interval '30 days') returning id into cid;
  insert into crm_calls (cycle_id, rank, scheduled_start, status) values (cid, 1, now() - interval '20 days', 'held') returning id into k1;
  insert into crm_calls (cycle_id, rank, scheduled_start, status) values (cid, 2, now() - interval '15 days', 'held') returning id into k2;
  insert into crm_calls (cycle_id, rank, scheduled_start, status) values (cid, 3, now() - interval '10 days', 'held') returning id into k3;
  insert into crm_calls (cycle_id, rank, scheduled_start, status) values (cid, 4, now() - interval '5 days', 'held') returning id into k4;
  insert into crm_calls (cycle_id, rank, scheduled_start, status) values (cid, 5, now() + interval '2 days', 'scheduled') returning id into k5;
  insert into crm_events (person_id, cycle_id, call_id, occurred_at, actor, channel, type, data, source, source_id) values
    (pid, cid, k1, now() - interval '21 days', 'prospect', 'booking', 'call_booked', '{"event_name":"Design Career Roadmap Call","host_email":"valentino@academy.test"}', 'import', 'ca:1'),
    (pid, cid, k2, now() - interval '16 days', 'prospect', 'booking', 'call_booked', '{"event_name":"Your Interior Academy Onboarding Call"}', 'import', 'ca:2'),
    (pid, cid, k3, now() - interval '11 days', 'prospect', 'booking', 'call_booked', '{"event_name":"Design Career Roadmap 2"}', 'import', 'ca:3'),
    (pid, cid, k4, now() - interval '6 days', 'prospect', 'booking', 'call_booked', '{"event_name":"Interior Academy Follow Up"}', 'import', 'ca:4'),
    (pid, cid, k5, now() - interval '1 day', 'prospect', 'booking', 'call_booked', '{"event_name":"Design Career Roadmap Call"}', 'import', 'ca:5');

  -- which calls: R1 and R2 sales calls; onboarding / case study, a third sales call and a future call are not analysed
  info := crm_ca_call_info(k1);
  assert (info->>'eligible')::boolean and (info->>'sales_round')::int = 1, 'R1 eligible: ' || info::text;
  assert info->>'timezone' = 'Asia/Dubai', 'time zone from the owner';
  info := crm_ca_call_info(k2);
  assert not (info->>'eligible')::boolean and info->>'reason' like 'pas un appel de vente%', 'onboarding left out: ' || info::text;
  info := crm_ca_call_info(k3);
  assert (info->>'eligible')::boolean and (info->>'sales_round')::int = 2, 'R2 (onboarding does not count): ' || info::text;
  assert not (crm_ca_call_info(k4)->>'eligible')::boolean, 'R3 left out';
  assert not (crm_ca_call_info(k5)->>'eligible')::boolean, 'future call left out';

  -- who adds a transcript: the cycle's owner or an admin, never another sales rep; a bad speaker map is refused
  perform set_config('request.jwt.claim.sub', rep2::text, true);
  begin perform crm_ca_add_transcript(k1, raw, '{"Valentino":"SALES","Jane Doe":"PROSPECT"}'); ok := false;
  exception when sqlstate '42501' then ok := true; end;
  assert ok, 'another sales rep cannot add a transcript';
  perform set_config('request.jwt.claim.sub', rep::text, true);
  begin perform crm_ca_add_transcript(k1, raw, '{"Valentino":"SALES","Jane Doe":"SALES"}'); ok := false;
  exception when sqlstate '22023' then ok := true; end;
  assert ok, 'a map with no prospect is refused';
  begin perform crm_ca_add_transcript(k4, raw, '{"Valentino":"SALES","Jane Doe":"PROSPECT"}'); ok := false;
  exception when sqlstate '22023' then ok := true; end;
  assert ok, 'R3 refused';
  r := crm_ca_add_transcript(k1, raw, '{"Valentino":"SALES","Jane Doe":"PROSPECT"}');
  job := (r->>'job')::uuid;
  assert (select status from crm_ca_jobs where id = job) = 'queued', 'job queued';
  assert exists (select 1 from crm_events where call_id = k1 and type = 'transcript_added'), 'event written';

  -- the worker (service role: no user)
  perform set_config('request.jwt.claim.sub', '', true);
  r := crm_ca_claim('test');
  assert (r->>'job')::uuid = job and r->>'transcript' = raw and r #>> '{config,tiers,strong}' = 'claude-sonnet-5-5', 'claim: ' || left(r::text, 300);
  assert r #>> '{call,sales_id}' is not null and (r #>> '{call,sales_round}')::int = 1, 'call metadata';
  assert crm_ca_claim('test') is null, 'nothing else queued';
  -- a failure is retried (queued again, later), the third one is final
  r := crm_ca_fail(job, 'model_error');
  assert r->>'status' = 'queued' and (select not_before from crm_ca_jobs where id = job) > now(), 'retried later';
  update crm_ca_jobs set not_before = now() where id = job;
  r := crm_ca_claim('test');
  assert (r->>'attempt')::int = 2, 'second attempt';
  r := crm_ca_store(job, jsonb_build_object('status', 'ok', 'flags', '[]'::jsonb, 'phases', '{"pitch_start":"T002"}'::jsonb,
         'turns', '[{"id":"T001","ts":"00:06","role":"SALES","speaker":"Valentino","text":"Hello"},{"id":"T002","ts":"41:10","role":"PROSPECT","speaker":"Jane Doe","text":"Fine"}]'::jsonb,
         'results', '{"SPIN":{"competence":"SPIN","rules_version":"SPIN-1.1","status":"scored","score":72,"items":[],"details":{}},
                      "GAP":{"competence":"GAP","rules_version":"GAP-1.3","status":"scored","verdict":"absent","score":0,"reasons":["no_restitution"]}}'::jsonb,
         'audit', '[{"task":"spin.gates","unit":"sol:T001","pass":1}]'::jsonb), '{"model_calls": 1}', 'test');
  assert (r->>'results')::int = 2, 'results stored';
  assert (select status from crm_ca_jobs where id = job) = 'done', 'job done';
  assert (select meta->>'duration' from crm_ca_records where job_id = job) = '41:10', 'duration = last turn';
  assert (select meta #>> '{rules,GAP}' from crm_ca_records where job_id = job) = 'GAP-1.3', 'rules versions kept';
  assert exists (select 1 from crm_events where call_id = k1 and type = 'analysis_ready'), 'analysis_ready event';

  -- who reads: the owner and admins; not another sales rep
  perform set_config('request.jwt.claim.sub', rep::text, true);
  r := crm_ca_latest(array[k1, k3]);
  assert jsonb_array_length(r) = 1 and r #>> '{0,status}' = 'done' and (r #>> '{0,scores,SPIN,score}')::numeric = 72, 'owner reads: ' || r::text;
  r := crm_ca_record(job);
  assert jsonb_array_length(r->'turns') = 2 and r #>> '{results,GAP,verdict}' = 'absent' and (r->>'provisional')::boolean, 'record';
  perform set_config('request.jwt.claim.sub', rep2::text, true);
  assert jsonb_array_length(crm_ca_latest(array[k1])) = 0 and crm_ca_record(job) is null, 'another sales rep reads nothing';
  -- 021: the board lists the owner's past R1 / R2 sales calls with their analysis state; nothing for another sales rep
  perform set_config('request.jwt.claim.sub', rep::text, true);
  r := crm_ca_board();
  assert jsonb_array_length(r) = 2 and r #>> '{0,call_id}' = k1::text and r #>> '{0,status}' = 'done' and (r #>> '{0,scores,SPIN,score}')::numeric = 72
     and r #>> '{1,call_id}' = k3::text and (r #>> '{1,round}')::int = 2 and r #>> '{1,status}' is null, 'board: ' || r::text;
  perform set_config('request.jwt.claim.sub', rep2::text, true);
  assert jsonb_array_length(crm_ca_board()) = 0, 'board: another sales rep sees nothing';
  perform set_config('request.jwt.claim.sub', adm::text, true);
  assert jsonb_array_length(crm_ca_board()) >= 2, 'board: admin sees every call';
  assert jsonb_array_length(crm_ca_latest(array[k1])) = 1, 'admin reads';
  -- run again: a new job, the old record stays
  r := crm_ca_retry(k1);
  assert r->>'status' = 'queued' and (select count(*) from crm_ca_records where call_id = k1) = 1, 'retry queues a new run';
  perform set_config('request.jwt.claim.sub', '', true);
  insert into ca_test_ids values ('rep', rep), ('rep2', rep2), ('adm', adm), ('k1', k1);
end $$;

-- row-level security on the tables themselves
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', (select v::text from ca_test_ids where k = 'rep2'), true);
do $$ begin
  assert (select count(*) from crm_ca_results) = 0 and (select count(*) from crm_ca_turns) = 0, 'another sales rep sees no result or turn';
end $$;
select set_config('request.jwt.claim.sub', (select v::text from ca_test_ids where k = 'rep'), true);
do $$ begin
  assert (select count(*) from crm_ca_results) = 2 and (select count(*) from crm_ca_turns) = 2, 'the owner sees his results';
  assert (select count(*) from crm_ca_audit) = 0 and (select count(*) from crm_ca_config) = 0, 'audit and config: admins only';
  assert not has_function_privilege('authenticated', 'crm_ca_claim(text)', 'execute'), 'the worker functions are closed';
end $$;
select set_config('request.jwt.claim.sub', (select v::text from ca_test_ids where k = 'adm'), true);
do $$ begin
  assert (select count(*) from crm_ca_audit) = 1 and (select count(*) from crm_ca_config) = 1, 'admin sees audit and config';
end $$;
commit;
drop table ca_test_ids;
select 'call analysis SQL checks: all passed';
