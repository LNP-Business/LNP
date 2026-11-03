-- 035_crm_ca_engine_choice.sql: crm_ca_config.engine ('full' by default, or 'lite') reaches the worker in the claim; the
-- lite record's meta.engine is kept with the stored record.
set client_min_messages = warning;
do $$
declare pid uuid; cid uuid; k uuid; job uuid; r jsonb; ok boolean;
begin
  update crm_ca_jobs set status = 'failed' where status in ('queued', 'running');   -- jobs left by the earlier checks
  assert (select engine from crm_ca_config) = 'full', 'full engine by default';
  insert into crm_people (full_name) values ('Engine Choice Lead') returning id into pid;
  insert into crm_cycles (person_id, opened_at) values (pid, now() - interval '3 days') returning id into cid;
  insert into crm_calls (cycle_id, rank, scheduled_start, status, transcript_raw, speaker_map)
  values (cid, 1, now() - interval '2 days', 'held', '[00:01] Sam: Hello', '{"Sam":"SALES"}') returning id into k;
  insert into crm_ca_jobs (call_id) values (k) returning id into job;
  r := crm_ca_claim('test');
  assert (r->>'job')::uuid = job and r #>> '{config,engine}' = 'full' and (r #>> '{config,passes}')::int = 3, 'claim, full: ' || left(r::text, 300);
  perform crm_ca_fail(job, 'test', true);

  update crm_ca_config set engine = 'lite';
  insert into crm_ca_jobs (call_id) values (k) returning id into job;
  r := crm_ca_claim('test');
  assert (r->>'job')::uuid = job and r #>> '{config,engine}' = 'lite' and r #>> '{config,tiers,fast}' = 'claude-haiku-5-5', 'claim, lite: ' || left(r::text, 300);
  r := crm_ca_store(job, jsonb_build_object('status', 'ok', 'flags', '[]'::jsonb, 'phases', '{}'::jsonb,
         'meta', '{"engine": "lite", "steps": {"S1": {"dropped": 2}}, "person": "not taken"}'::jsonb,
         'turns', '[{"id":"T001","ts":"00:01","role":"SALES","speaker":"Sam","text":"Hello"}]'::jsonb,
         'results', '{"SPIN":{"competence":"SPIN","rules_version":"SPIN-1.3","status":"not_applicable","score":null}}'::jsonb,
         'audit', '[]'::jsonb), '{"tiers": {}}', 'callqa-lite-1.0');
  assert (select meta->>'engine' from crm_ca_records where job_id = job) = 'lite', 'meta.engine = lite';
  assert (select meta->>'engine_version' from crm_ca_records where job_id = job) = 'callqa-lite-1.0', 'meta.engine_version';
  assert (select meta #>> '{engine_steps,S1,dropped}' from crm_ca_records where job_id = job) = '2', 'meta.engine_steps';
  assert (select coalesce(meta->>'person', '') from crm_ca_records where job_id = job) <> 'not taken', 'only the engine keys of the record meta are kept';
  assert (select engine_version from crm_ca_jobs where id = job) = 'callqa-lite-1.0', 'job engine version';
  begin update crm_ca_config set engine = 'other'; ok := false;
  exception when check_violation then ok := true; end;
  assert ok, 'only full or lite';
end $$;

-- a second run keeps the choice
\ir ../035_crm_ca_engine_choice.sql
do $$ begin
  assert (select engine from crm_ca_config) = 'lite', 'engine kept after a second run';
  update crm_ca_config set engine = 'full';
end $$;
select 'engine choice SQL checks: all passed';
