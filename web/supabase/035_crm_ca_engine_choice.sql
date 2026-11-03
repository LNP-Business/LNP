-- LNP CRM — choice of the call analysis engine (web/supabase/035_crm_ca_engine_choice.sql), after 034.
-- crm_ca_config.engine: 'full' (the engine of call-analysis/engine, about 540 closed questions a call, three passes and
-- the arbiter) or 'lite' (call-analysis/lite, 2026-11-03: five whole-transcript steps, one pass, the code still checks
-- every quote and decides every score; target under 0.10 USD a call). The worker reads it in the claim (config.engine).
-- Switch: update crm_ca_config set engine = 'lite';   back: update crm_ca_config set engine = 'full';
-- crm_ca_claim: the definition of 020 with config.engine added. crm_ca_store: the definition of 020, and the record's
-- meta.engine ('lite') and meta.engine_steps (what each step dropped) are kept in crm_ca_records.meta.
-- Safe to run again.

alter table crm_ca_config add column if not exists engine text not null default 'full';
do $$ begin
  alter table crm_ca_config add constraint crm_ca_config_engine_check check (engine in ('full', 'lite'));
exception when duplicate_object then null; end $$;

create or replace function crm_ca_claim(p_worker text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare j crm_ca_jobs; k crm_calls; info jsonb; cfg crm_ca_config;
begin
  select * into j from crm_ca_jobs
   where (status = 'queued' and not_before <= now()) or (status = 'running' and started_at < now() - interval '2 hours')
   order by created_at limit 1 for update skip locked;
  if j.id is null then return null; end if;
  update crm_ca_jobs set status = 'running', attempts = attempts + 1, worker = p_worker, started_at = now(), error = null
   where id = j.id;
  select * into k from crm_calls where id = j.call_id;
  select * into cfg from crm_ca_config;
  info := crm_ca_call_info(j.call_id);
  return jsonb_build_object(
    'job', j.id, 'attempt', j.attempts + 1, 'call', info,
    'transcript', k.transcript_raw, 'speaker_map', k.speaker_map,
    'config', jsonb_build_object('tiers', cfg.tiers, 'passes', cfg.passes, 'engine', coalesce(cfg.engine, 'full')),
    'offer_reference', coalesce((select data from crm_ca_offer where active), '{}'::jsonb),
    'case_library', coalesce((select jsonb_agg(to_jsonb(c) - 'created_at' - 'active') from crm_ca_cases c where c.active), '[]'::jsonb),
    -- earlier analysed sales calls of the same cycle (Objections H5 reads them)
    'prior', coalesce((select jsonb_agg(jsonb_build_object('call_id', r.call_id, 'start_utc', k2.scheduled_start, 'results',
                         (select jsonb_object_agg(x.competence, x.details) from crm_ca_results x where x.job_id = r.job_id)) order by k2.scheduled_start)
                         from crm_ca_records r join crm_calls k2 on k2.id = r.call_id
                        where k2.cycle_id = k.cycle_id and k2.scheduled_start < k.scheduled_start
                          and r.job_id = (select r2.job_id from crm_ca_records r2 where r2.call_id = r.call_id order by r2.created_at desc limit 1)), '[]'::jsonb));
end $$;

-- the worker: store a finished call record (pipeline.result_record, or the lite engine's record) in one transaction
create or replace function crm_ca_store(p_job uuid, p_record jsonb, p_usage jsonb, p_engine text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare j crm_ca_jobs; info jsonb; c record; n int;
begin
  select * into j from crm_ca_jobs where id = p_job for update;
  if j.id is null or j.status <> 'running' then raise exception 'Job % is not running', p_job using errcode = '22023'; end if;
  info := crm_ca_call_info(j.call_id);
  insert into crm_ca_records (job_id, call_id, status, flags, phases, meta)
  values (p_job, j.call_id, p_record->>'status', coalesce(p_record->'flags', '[]'), coalesce(p_record->'phases', '{}'),
          info || jsonb_build_object('engine', p_engine,
            'rules', (select jsonb_object_agg(kk, v->>'rules_version') from jsonb_each(coalesce(p_record->'results', '{}')) x(kk, v)),
            'duration', (select t->>'ts' from jsonb_array_elements(coalesce(p_record->'turns', '[]')) with ordinality a(t, o) order by o desc limit 1))
          -- 035: the lite engine says so in its record ("engine": "lite"); the version stays in engine_version
          || jsonb_strip_nulls(jsonb_build_object('engine', p_record #>> '{meta,engine}', 'engine_version',
               case when p_record #>> '{meta,engine}' is not null then p_engine end, 'engine_steps', p_record #> '{meta,steps}')));
  insert into crm_ca_turns (job_id, idx, turn_id, ts, role, speaker, text, repaired, doubtful)
  select p_job, o, t->>'id', t->>'ts', t->>'role', t->>'speaker', coalesce(t->>'text', ''),
         coalesce((t->>'repaired')::boolean, false), coalesce((t->>'attribution_doubtful')::boolean, false)
    from jsonb_array_elements(coalesce(p_record->'turns', '[]')) with ordinality a(t, o);
  insert into crm_ca_results (job_id, call_id, competence, rules_version, status, verdict, reasons, score, items, flags, details, concordance)
  select p_job, j.call_id, kk, v->>'rules_version', v->>'status', v->>'verdict', coalesce(v->'reasons', '[]'),
         (v->>'score')::numeric, coalesce(v->'items', '[]'), coalesce(v->'flags', '[]'), coalesce(v->'details', '{}'), v->>'concordance'
    from jsonb_each(coalesce(p_record->'results', '{}')) x(kk, v);
  insert into crm_ca_audit (job_id, seq, entry)
  select p_job, o, e from jsonb_array_elements(coalesce(p_record->'audit', '[]')) with ordinality a(e, o);
  update crm_ca_jobs set status = 'done', finished_at = now(), usage = coalesce(p_usage, '{}'), engine_version = p_engine where id = p_job;
  select k.cycle_id, cy.person_id into c from crm_calls k join crm_cycles cy on cy.id = k.cycle_id where k.id = j.call_id;
  insert into crm_events (person_id, cycle_id, call_id, occurred_at, actor, channel, type, data, source, source_id)
  values (c.person_id, c.cycle_id, j.call_id, now(), 'system', 'analysis', 'analysis_ready',
          jsonb_build_object('job', p_job, 'status', p_record->>'status',
            'scores', (select jsonb_object_agg(kk, v->'score') from jsonb_each(coalesce(p_record->'results', '{}')) x(kk, v))),
          'crm', 'analysis:' || p_job)
  on conflict (source, source_id) do nothing;
  select count(*) into n from crm_ca_results where job_id = p_job;
  return jsonb_build_object('job', p_job, 'results', n);
end $$;

revoke execute on function crm_ca_claim(text), crm_ca_store(uuid, jsonb, jsonb, text) from public, anon, authenticated;
