-- 046_crm_qualif_in_analysis.sql: the lead qualification of an R1 is kept with its analysis job, read with the analysis and
-- shown on the board; the worker's functions stay closed to the browser.
do $$
declare adm uuid := gen_random_uuid(); pid uuid; cid uuid; k1 uuid; job uuid; r jsonb; b jsonb; ctx jsonb;
begin
  insert into auth.users (id, email) values (adm, 'qa.admin@x.com');
  insert into members (user_id, email, role) values (adm, 'qa.admin@x.com', 'admin');
  insert into crm_members (id, member_key, full_name, email, role) values (adm, 'qaadm', 'Qa Admin', 'qa.admin@x.com', 'admin')
  on conflict (id) do update set role = 'admin', active = true;
  insert into crm_people (full_name) values ('Qualif Lead') returning id into pid;
  insert into crm_cycles (person_id, owner_id, opened_at) values (pid, adm, now() - interval '3 days') returning id into cid;
  insert into crm_calls (cycle_id, rank, scheduled_start, status, recorded_by) values (cid, 1, now() - interval '2 days', 'held', 'sam@lesnouveauxprofs.fr') returning id into k1;
  insert into crm_events (person_id, cycle_id, call_id, occurred_at, actor, channel, type, data, source, source_id) values
    (pid, cid, k1, now() - interval '3 days', 'prospect', 'booking', 'call_booked', '{"event_name":"Appel découverte","iclosed_outcome":"LOST","no_sale_reason":"NOT_INTERESTED"}', 'import', 'qa:1');
  ctx := crm_qualif_context(k1);
  assert ctx->>'recorded_by' = 'sam@lesnouveauxprofs.fr' and ctx->'saisie'->>'no_sale_reason' = 'NOT_INTERESTED' and (ctx->>'round')::int = 1, 'context: ' || ctx::text;
  insert into crm_ca_jobs (call_id, status) values (k1, 'done') returning id into job;
  insert into crm_ca_records (job_id, call_id, status, flags, phases, meta) values (job, k1, 'ok', '[]', '{}', '{}');
  perform crm_qualif_store(k1, 'SQL OUVERT', '{"statut":"SQL OUVERT","solution_aware":true,"portes":{}}', '[{"meta":{}}]', '[]', '{}',
                           'lnp-sql-v2.1-2026-11-05', 'qualification_lnp-v2.1', job);
  assert (select job_id from crm_lead_qualifications where call_id = k1) = job, 'kept with its job';
  perform set_config('request.jwt.claim.sub', adm::text, true);
  r := crm_ca_record(job);
  assert r->'qualification'->>'status' = 'SQL OUVERT' and r->'qualification'->>'rules_version' = 'qualification_lnp-v2.1', 'read with the analysis: ' || coalesce(r->>'qualification', 'none');
  assert not (r->'qualification' ? 'readings'), 'the facts are not sent to the screen';
  select x into b from jsonb_array_elements(crm_ca_board()) x where x->>'call_id' = k1::text;
  assert b->'qualification'->>'status' = 'SQL OUVERT' and (b->'qualification'->>'solution_aware')::boolean, 'on the board: ' || coalesce(b::text, 'none');
  perform set_config('request.jwt.claim.sub', '', true);
  assert not has_function_privilege('authenticated', 'crm_qualif_context(uuid)', 'execute'), 'context closed to the browser';
  assert not has_function_privilege('authenticated', 'crm_qualif_store(uuid, text, jsonb, jsonb, jsonb, jsonb, text, text, uuid)', 'execute'), 'store closed to the browser';
end $$;
select 'qualification in the analysis SQL checks: all passed';
