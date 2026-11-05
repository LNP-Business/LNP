-- 046 · Lead qualification in the call analysis (Romain, 2026-11-05: « chaque appel R1 doit aboutir à définir l'état de la
-- qualification ; cela fait partie de l'analyse d'appel »). Rules « Qualification SQL des appels LNP » version 2.1
-- (call-analysis/qualification: the model extracts the facts in two readings, qualification_lnp.py decides).
-- The call analysis worker qualifies every R1 it analyses (call-analysis/worker/callqa_worker/qualif.py) and stores it here,
-- with the analysis job:
--   crm_lead_qualifications.job_id   the analysis it was made with
--   crm_qualif_context(call)          the call date, the recorder and what was entered in iClosed (service role)
--   crm_qualif_store(…, p_job)        one more argument, the job
--   crm_ca_record(job)                + qualification: {status, result, verification, versions} (the facts stay here)
--   crm_ca_board()                    + qualification: {status, solution_aware} per R1 (the chip of the lead)
--   crm_qualif_candidates             default prompt version 2.1 (the manual backfill, .github/workflows/qualification.yml)
-- Nothing here queues an analysis. Safe to run again.

alter table crm_lead_qualifications add column if not exists job_id uuid references crm_ca_jobs(id) on delete set null;
create index if not exists lead_qualifications_job on crm_lead_qualifications (job_id);

create or replace function crm_qualif_context(p_call uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'call_id', k.id, 'cycle_id', k.cycle_id, 'round', k.rank,
    'date_appel', to_char(coalesce(k.recording_start, k.scheduled_start) at time zone 'Europe/Paris', 'YYYY-MM-DD'),
    'recorded_by', k.recorded_by,
    'saisie', (select jsonb_build_object('outcome', e.data->>'iclosed_outcome', 'no_sale_reason', e.data->>'no_sale_reason')
                 from crm_events e where e.cycle_id = k.cycle_id and e.type = 'call_booked'
                  and (e.data->>'iclosed_call_id' = k.iclosed_call_id or k.iclosed_call_id is null)
                order by e.occurred_at desc limit 1))
    from crm_calls k where k.id = p_call
$$;

drop function if exists crm_qualif_store(uuid, text, jsonb, jsonb, jsonb, jsonb, text, text);
create or replace function crm_qualif_store(p_call uuid, p_status text, p_result jsonb, p_readings jsonb, p_verification jsonb,
                                            p_usage jsonb, p_prompt_version text, p_rules_version text, p_job uuid default null) returns bigint
language sql security definer set search_path = public as $$
  insert into crm_lead_qualifications (call_id, cycle_id, status, result, readings, verification, usage, prompt_version, rules_version, job_id)
  select p_call, k.cycle_id, p_status, coalesce(p_result, '{}'), coalesce(p_readings, '[]'), coalesce(p_verification, '[]'),
         p_usage, p_prompt_version, p_rules_version, p_job
    from crm_calls k where k.id = p_call
  returning id
$$;

create or replace function crm_qualif_candidates(p_limit int default 30, p_again boolean default false,
                                                 p_prompt_version text default 'lnp-sql-v2.1-2026-11-05') returns jsonb
language sql stable security definer set search_path = public as $$
  with r1 as (
    select distinct on (k.cycle_id) k.*, c.person_id
      from crm_calls k join crm_cycles c on c.id = k.cycle_id
     where k.rank = 1 and coalesce(k.recording_start, k.scheduled_start) < now() and k.status <> 'canceled'
       and not crm_person_internal(c.person_id)
     order by k.cycle_id, (k.recorded_by is not null) desc, coalesce(k.recording_start, k.scheduled_start) desc)
  select coalesce(jsonb_agg(x order by x->>'at' desc), '[]') from (
    select jsonb_build_object(
      'call_id', r1.id, 'cycle_id', r1.cycle_id, 'at', coalesce(r1.recording_start, r1.scheduled_start),
      'date_appel', to_char(coalesce(r1.recording_start, r1.scheduled_start) at time zone 'Europe/Paris', 'YYYY-MM-DD'),
      'recorded_by', r1.recorded_by, 'transcript', case when r1.recorded_by is not null then r1.transcript end,
      'saisie', (select jsonb_build_object('outcome', e.data->>'iclosed_outcome', 'no_sale_reason', e.data->>'no_sale_reason')
                   from crm_events e where e.cycle_id = r1.cycle_id and e.type = 'call_booked'
                    and (e.data->>'iclosed_call_id' = r1.iclosed_call_id or r1.iclosed_call_id is null)
                  order by e.occurred_at desc limit 1)) x
      from r1
     where p_again or not exists (select 1 from crm_lead_qualifications q where q.call_id = r1.id and q.prompt_version = p_prompt_version)
     order by coalesce(r1.recording_start, r1.scheduled_start) desc
     limit greatest(1, least(coalesce(p_limit, 30), 200))) s
$$;

create or replace function crm_ca_record(p_job uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'job', r.job_id, 'call_id', r.call_id, 'status', r.status, 'flags', r.flags, 'phases', r.phases, 'meta', r.meta,
    'provisional', (select provisional from crm_ca_config), 'created_at', r.created_at,
    'turns', (select jsonb_agg(jsonb_build_object('id', t.turn_id, 'ts', t.ts, 'role', t.role, 'speaker', t.speaker, 'text', t.text,
                                                 'repaired', t.repaired, 'attribution_doubtful', t.doubtful) order by t.idx)
                from crm_ca_turns t where t.job_id = r.job_id),
    'results', (select jsonb_object_agg(x.competence, jsonb_build_object('competence', x.competence, 'rules_version', x.rules_version,
                 'status', x.status, 'verdict', x.verdict, 'reasons', x.reasons, 'score', x.score, 'items', x.items, 'flags', x.flags,
                 'details', x.details, 'concordance', x.concordance)) from crm_ca_results x where x.job_id = r.job_id),
    -- 046: the lead qualification made with this analysis (an R1), else the latest of the call; the facts (readings) stay in
    -- crm_lead_qualifications
    'qualification', (select jsonb_build_object('status', q.status, 'result', q.result, 'verification', q.verification,
                        'prompt_version', q.prompt_version, 'rules_version', q.rules_version, 'created_at', q.created_at)
                        from crm_lead_qualifications q where q.call_id = r.call_id
                       order by (q.job_id = r.job_id) desc nulls last, q.created_at desc limit 1))
  from crm_ca_records r where r.job_id = p_job and crm_ca_can_read(r.call_id)
$$;

create or replace function crm_ca_board() returns jsonb
language sql stable security definer set search_path = public as $$
  with vis as (
    select c.id from crm_cycles c
     where coalesce(crm_role() = 'admin', false) or c.owner_id = auth.uid()),
  b as (
    select k.id, k.cycle_id, k.scheduled_start, k.status,
           (select e.data->>'event_name' from crm_events e where e.call_id = k.id and e.type = 'call_booked'
             order by e.occurred_at desc limit 1) ev
      from crm_calls k join vis on vis.id = k.cycle_id),
  s as (
    select b.*, coalesce(b.ev, '') ~* '(onboarding|case stud)' other_kind from b),
  r as materialized (
    select s.*, count(*) filter (where not s.other_kind and s.status <> 'canceled')
                  over (partition by s.cycle_id order by s.scheduled_start, s.id) sales_round
      from s),
  e as (
    select r.* from r
     where not r.other_kind and r.status <> 'canceled' and r.sales_round between 1 and 2 and r.scheduled_start < now())
  select coalesce(jsonb_agg(jsonb_build_object(
           'call_id', e.id, 'cycle_id', e.cycle_id, 'round', e.sales_round, 'start', e.scheduled_start,
           'transcript', k.transcript_raw is not null,
           'job', j.id, 'status', j.status, 'error', j.error, 'queued_at', j.created_at, 'started_at', j.started_at,
           'done_job', d.job_id,
           'scores', (select jsonb_object_agg(x.competence, jsonb_build_object('score', x.score, 'status', x.status, 'verdict', x.verdict))
                        from crm_ca_results x where x.job_id = d.job_id),
           -- 046: the lead qualification of an R1 (its latest run)
           'qualification', (select jsonb_build_object('status', q.status, 'solution_aware', coalesce((q.result->>'solution_aware')::boolean, false))
                               from crm_lead_qualifications q where q.call_id = e.id order by q.created_at desc limit 1))
           order by e.cycle_id, e.sales_round), '[]'::jsonb)
    from e
    join crm_calls k on k.id = e.id
    left join lateral (select * from crm_ca_jobs j where j.call_id = e.id order by j.created_at desc limit 1) j on true
    left join lateral (select r2.job_id from crm_ca_records r2 where r2.call_id = e.id order by r2.created_at desc limit 1) d on true
$$;

revoke execute on function crm_qualif_context(uuid), crm_qualif_store(uuid, text, jsonb, jsonb, jsonb, jsonb, text, text, uuid),
  crm_qualif_candidates(int, boolean, text) from public, anon, authenticated;
grant execute on function crm_qualif_context(uuid), crm_qualif_store(uuid, text, jsonb, jsonb, jsonb, jsonb, text, text, uuid),
  crm_qualif_candidates(int, boolean, text) to service_role;
revoke execute on function crm_ca_board() from public, anon;
grant execute on function crm_ca_board() to authenticated;
