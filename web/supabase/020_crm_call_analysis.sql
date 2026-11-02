-- SKL OS CRM — call analysis storage and job queue (web/supabase/020_crm_call_analysis.sql), after 019.
-- The SKL call analysis engine (call-analysis/, plan call-analysis/PLAN.md) reads a sales call transcript and scores four
-- competences (SPIN, Gap, Pitch, Objections). The engine runs in a worker outside the database (GitHub Actions); this file
-- holds what it reads and writes:
--   crm_calls        + transcript_raw (engine format "[mm:ss] Speaker: text"), speaker_map (label → SALES / PROSPECT /
--                      OTHER), transcript_source, transcript_added_at
--   crm_ca_config    one row: model id per tier, passes, the default time zone, the "provisional" switch
--   crm_ca_offer     versioned offer reference (price, guarantees, the nine mechanisms…); empty until Romain provides it
--   crm_ca_cases     case library (consent, starting point); empty until cases with consent exist
--   crm_ca_jobs      one row per analysis run (queued → running → done / failed), usage and errors
--   crm_ca_records   the call record of a run (status, flags, phases, metadata), crm_ca_turns its repaired turns,
--                    crm_ca_results one row per competence, crm_ca_audit every model pass (admins only)
-- Which calls (Romain, 2026-10-25): sales calls R1 and R2 only; onboarding and case-study calls are left out (iClosed event
-- name). Who reads the analysis (Romain, 2026-10-25): CRM admins, and the sales rep who owns the cycle, on his own calls.
-- Writes from the browser: crm_ca_add_transcript (admins, the cycle's owner), crm_ca_retry. The worker calls crm_ca_claim,
-- crm_ca_store and crm_ca_fail with the service role. A stored score is never edited: a new run makes a new record (C8).
-- Safe to run again.

alter table crm_calls add column if not exists transcript_raw text;
alter table crm_calls add column if not exists speaker_map jsonb;
alter table crm_calls add column if not exists transcript_source text;
alter table crm_calls add column if not exists transcript_added_at timestamptz;

create table if not exists crm_ca_config (
  id               boolean primary key default true check (id),
  tiers            jsonb not null,
  passes           int not null default 3 check (passes in (1, 3)),
  default_timezone text not null default 'Asia/Dubai',
  provisional      boolean not null default true,
  updated_at       timestamptz not null default now()
);
-- Romain, 2026-10-25: fast = Haiku, strong = Sonnet, arbiter = Opus
insert into crm_ca_config (tiers) values ('{"fast": "claude-haiku-5-5", "strong": "claude-sonnet-5-5", "arbiter": "claude-opus-5-5"}')
on conflict (id) do nothing;

create table if not exists crm_ca_offer (
  id         uuid primary key default gen_random_uuid(),
  version    text not null unique,
  data       jsonb not null,
  active     boolean not null default false,
  created_at timestamptz not null default now(),
  created_by uuid references crm_members(id)
);
create unique index if not exists crm_ca_offer_one_active on crm_ca_offer (active) where active;

create table if not exists crm_ca_cases (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  consent       boolean not null default false,
  start_value   numeric,
  start_unit    text,
  start_profile text,
  figures       jsonb not null default '{}'::jsonb,
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);

create table if not exists crm_ca_jobs (
  id             uuid primary key default gen_random_uuid(),
  call_id        uuid not null references crm_calls(id) on delete cascade,
  status         text not null default 'queued' check (status in ('queued', 'running', 'done', 'failed')),
  attempts       int not null default 0,
  not_before     timestamptz not null default now(),
  worker         text,
  error          text,
  engine_version text,
  usage          jsonb not null default '{}'::jsonb,   -- model calls, input / output / cached tokens per tier
  created_by     uuid references crm_members(id),
  created_at     timestamptz not null default now(),
  started_at     timestamptz,
  finished_at    timestamptz
);
create index if not exists crm_ca_jobs_call on crm_ca_jobs (call_id, created_at desc);
create index if not exists crm_ca_jobs_queue on crm_ca_jobs (status, not_before);

create table if not exists crm_ca_records (
  job_id     uuid primary key references crm_ca_jobs(id) on delete cascade,
  call_id    uuid not null references crm_calls(id) on delete cascade,
  status     text not null,                 -- ok / no_transcript / no_diarization / diarization_suspect
  flags      jsonb not null default '[]'::jsonb,
  phases     jsonb not null default '{}'::jsonb,
  meta       jsonb not null default '{}'::jsonb,   -- round, sales id, start, time zone, rules versions, duration
  created_at timestamptz not null default now()
);
create index if not exists crm_ca_records_call on crm_ca_records (call_id, created_at desc);

create table if not exists crm_ca_turns (
  job_id   uuid not null references crm_ca_jobs(id) on delete cascade,
  idx      int not null,
  turn_id  text not null,
  ts       text,
  role     text not null,
  speaker  text,
  text     text not null,
  repaired boolean not null default false,
  doubtful boolean not null default false,
  primary key (job_id, idx)
);

create table if not exists crm_ca_results (
  job_id        uuid not null references crm_ca_jobs(id) on delete cascade,
  call_id       uuid not null references crm_calls(id) on delete cascade,
  competence    text not null check (competence in ('SPIN', 'GAP', 'PITCH', 'OBJECTIONS')),
  rules_version text not null,
  status        text not null,
  verdict       text,
  reasons       jsonb not null default '[]'::jsonb,
  score         numeric,
  items         jsonb not null default '[]'::jsonb,
  flags         jsonb not null default '[]'::jsonb,
  details       jsonb not null default '{}'::jsonb,
  concordance   text,
  primary key (job_id, competence)
);
create index if not exists crm_ca_results_call on crm_ca_results (call_id);

create table if not exists crm_ca_audit (
  job_id uuid not null references crm_ca_jobs(id) on delete cascade,
  seq    int not null,
  entry  jsonb not null,
  primary key (job_id, seq)
);

-- who may read the analysis of a call: CRM admins, and the owner of its cycle
create or replace function crm_ca_can_read(p_call uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(crm_role() = 'admin', false)
      or exists (select 1 from crm_calls k join crm_cycles c on c.id = k.cycle_id where k.id = p_call and c.owner_id = auth.uid())
$$;

-- a call's place among its cycle's sales calls (onboarding and case-study calls do not count), its sales rep and time zone
create or replace function crm_ca_call_info(p_call uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  with b as (
    select k.id, k.cycle_id, k.scheduled_start, k.status,
           (select e.data from crm_events e where e.call_id = k.id and e.type = 'call_booked' order by e.occurred_at desc limit 1) bk
      from crm_calls k
     where k.cycle_id = (select cycle_id from crm_calls where id = p_call)),
  s as (
    select b.*, coalesce(b.bk->>'event_name', '') ~* '(onboarding|case stud)' as other_kind,
           lower(nullif(b.bk->>'host_email', '')) host
      from b),
  r as (
    select s.*, case when not s.other_kind and s.status <> 'canceled'
                     then count(*) filter (where not s.other_kind and s.status <> 'canceled')
                            over (order by s.scheduled_start, s.id) end as sales_round
      from s)
  select jsonb_build_object(
    'call_id', r.id, 'cycle_id', r.cycle_id, 'start_utc', r.scheduled_start, 'event_name', r.bk->>'event_name',
    'sales_round', r.sales_round,
    'eligible', coalesce(not r.other_kind and r.sales_round between 1 and 2 and r.scheduled_start < now(), false),
    'reason', case when r.other_kind then 'not a sales call (onboarding or case study)'
                   when r.status = 'canceled' then 'call canceled'
                   when r.scheduled_start >= now() then 'call not held yet'
                   when r.sales_round > 2 then 'only R1 and R2 sales calls are analysed' end,
    'sales_id', coalesce(cm.member_key, nullif(split_part(r.host, '@', 1), ''), 'none'),
    'sales_name', coalesce(cm.full_name, st.name, initcap(nullif(split_part(split_part(r.host, '@', 1), '.', 1), ''))),
    'timezone', coalesce(cm.timezone, (select default_timezone from crm_ca_config)),
    'person', (select coalesce(p.full_name, p.primary_email) from crm_cycles c join crm_people p on p.id = c.person_id where c.id = r.cycle_id))
  from r
  left join crm_cycles cy on cy.id = r.cycle_id
  left join crm_members cm on cm.id = cy.owner_id
  left join crm_sales_team st on st.rep = nullif(split_part(r.host, '@', 1), '')
  where r.id = p_call
$$;

-- the browser: add (or replace) a call's transcript and queue its analysis
create or replace function crm_ca_add_transcript(p_call uuid, p_raw text, p_speaker_map jsonb, p_source text default 'upload')
returns jsonb language plpgsql security definer set search_path = public as $$
declare info jsonb; k crm_calls; j uuid; roles text[];
begin
  select * into k from crm_calls where id = p_call;
  if k.id is null then raise exception 'Unknown call' using errcode = 'P0002'; end if;
  if not (coalesce(crm_role() = 'admin', false) or crm_owns_cycle(k.cycle_id)) then
    raise exception 'Only an admin or the sales rep of this lead can add a transcript' using errcode = '42501';
  end if;
  info := crm_ca_call_info(p_call);
  if not (info->>'eligible')::boolean then raise exception 'Not analysed: %', info->>'reason' using errcode = '22023'; end if;
  if coalesce(length(trim(p_raw)), 0) < 200 then raise exception 'The transcript is empty or too short' using errcode = '22023'; end if;
  select array_agg(distinct v) into roles from jsonb_each_text(coalesce(p_speaker_map, '{}')) x(kk, v);
  if roles is null or not (roles @> array['SALES', 'PROSPECT']) or not (roles <@ array['SALES', 'PROSPECT', 'OTHER']) then
    raise exception 'Map every speaker to Sales, Prospect or Other, with at least one Sales and one Prospect' using errcode = '22023';
  end if;
  update crm_calls set transcript_raw = p_raw, speaker_map = p_speaker_map, transcript_source = p_source, transcript_added_at = now()
   where id = p_call;
  update crm_ca_jobs set status = 'failed', error = 'replaced by a new transcript', finished_at = now()
   where call_id = p_call and status = 'queued';
  insert into crm_ca_jobs (call_id, created_by) values (p_call, auth.uid()) returning id into j;
  insert into crm_events (person_id, cycle_id, call_id, occurred_at, actor, member_id, channel, type, data, source, source_id)
  select c.person_id, c.id, p_call, now(), 'sales', auth.uid(), 'analysis', 'transcript_added',
         jsonb_build_object('source', p_source, 'job', j), 'crm', 'transcript:' || j
    from crm_cycles c where c.id = k.cycle_id;
  return jsonb_build_object('job', j, 'status', 'queued');
end $$;

-- the browser: run the analysis again (after a failure, or on a new rules version)
create or replace function crm_ca_retry(p_call uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare k crm_calls; j uuid;
begin
  select * into k from crm_calls where id = p_call;
  if k.id is null then raise exception 'Unknown call' using errcode = 'P0002'; end if;
  if not (coalesce(crm_role() = 'admin', false) or crm_owns_cycle(k.cycle_id)) then raise exception 'Not allowed' using errcode = '42501'; end if;
  if k.transcript_raw is null then raise exception 'Add a transcript first' using errcode = '22023'; end if;
  if exists (select 1 from crm_ca_jobs where call_id = p_call and status in ('queued', 'running')) then
    return jsonb_build_object('status', 'already queued');
  end if;
  insert into crm_ca_jobs (call_id, created_by) values (p_call, auth.uid()) returning id into j;
  return jsonb_build_object('job', j, 'status', 'queued');
end $$;

-- the worker: take the oldest queued job (a job left running for 2 hours is taken again), with everything the engine needs
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
    'config', jsonb_build_object('tiers', cfg.tiers, 'passes', cfg.passes),
    'offer_reference', coalesce((select data from crm_ca_offer where active), '{}'::jsonb),
    'case_library', coalesce((select jsonb_agg(to_jsonb(c) - 'created_at' - 'active') from crm_ca_cases c where c.active), '[]'::jsonb),
    -- earlier analysed sales calls of the same cycle (Objections H5 reads them)
    'prior', coalesce((select jsonb_agg(jsonb_build_object('call_id', r.call_id, 'start_utc', k2.scheduled_start, 'results',
                         (select jsonb_object_agg(x.competence, x.details) from crm_ca_results x where x.job_id = r.job_id)) order by k2.scheduled_start)
                         from crm_ca_records r join crm_calls k2 on k2.id = r.call_id
                        where k2.cycle_id = k.cycle_id and k2.scheduled_start < k.scheduled_start
                          and r.job_id = (select r2.job_id from crm_ca_records r2 where r2.call_id = r.call_id order by r2.created_at desc limit 1)), '[]'::jsonb));
end $$;

-- the worker: store a finished call record (pipeline.result_record) in one transaction
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
            'duration', (select t->>'ts' from jsonb_array_elements(coalesce(p_record->'turns', '[]')) with ordinality a(t, o) order by o desc limit 1)));
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

-- the worker: a failed run; retried twice, 10 minutes apart, unless the error is final
create or replace function crm_ca_fail(p_job uuid, p_error text, p_final boolean default false) returns jsonb
language plpgsql security definer set search_path = public as $$
declare j crm_ca_jobs; again boolean;
begin
  select * into j from crm_ca_jobs where id = p_job for update;
  if j.id is null then raise exception 'Unknown job' using errcode = 'P0002'; end if;
  again := not p_final and j.attempts < 3;
  update crm_ca_jobs set status = case when again then 'queued' else 'failed' end, error = left(p_error, 2000),
         not_before = now() + interval '10 minutes', finished_at = case when again then null else now() end
   where id = p_job;
  return jsonb_build_object('job', p_job, 'status', case when again then 'queued' else 'failed' end);
end $$;

-- the browser: the latest run of each call (job state, and the record once done), read through crm_ca_can_read
create or replace function crm_ca_latest(p_calls uuid[]) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'call_id', j.call_id, 'job', j.id, 'status', j.status, 'error', j.error, 'queued_at', j.created_at,
           'started_at', j.started_at, 'finished_at', j.finished_at,
           'scores', (select jsonb_object_agg(x.competence, jsonb_build_object('score', x.score, 'status', x.status, 'verdict', x.verdict))
                        from crm_ca_results x where x.job_id = d.job_id),
           'done_job', d.job_id, 'provisional', (select provisional from crm_ca_config))), '[]'::jsonb)
    from unnest(p_calls) c(id)
    join lateral (select * from crm_ca_jobs j where j.call_id = c.id order by j.created_at desc limit 1) j on true
    left join lateral (select r.job_id from crm_ca_records r where r.call_id = c.id order by r.created_at desc limit 1) d on true
   where crm_ca_can_read(c.id)
$$;

-- the browser: one full call record (the analysis screen)
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
                 'details', x.details, 'concordance', x.concordance)) from crm_ca_results x where x.job_id = r.job_id))
  from crm_ca_records r where r.job_id = p_job and crm_ca_can_read(r.call_id)
$$;

alter table crm_ca_config  enable row level security;
alter table crm_ca_offer   enable row level security;
alter table crm_ca_cases   enable row level security;
alter table crm_ca_jobs    enable row level security;
alter table crm_ca_records enable row level security;
alter table crm_ca_turns   enable row level security;
alter table crm_ca_results enable row level security;
alter table crm_ca_audit   enable row level security;
drop policy if exists ca_config_admin on crm_ca_config;
create policy ca_config_admin on crm_ca_config for select using (coalesce(crm_role() = 'admin', false));
drop policy if exists ca_offer_read on crm_ca_offer;
create policy ca_offer_read on crm_ca_offer for select using (crm_role() is not null);
drop policy if exists ca_cases_read on crm_ca_cases;
create policy ca_cases_read on crm_ca_cases for select using (crm_role() is not null);
drop policy if exists ca_jobs_read on crm_ca_jobs;
create policy ca_jobs_read on crm_ca_jobs for select using (crm_ca_can_read(call_id));
drop policy if exists ca_records_read on crm_ca_records;
create policy ca_records_read on crm_ca_records for select using (crm_ca_can_read(call_id));
drop policy if exists ca_turns_read on crm_ca_turns;
create policy ca_turns_read on crm_ca_turns for select using (crm_ca_can_read((select call_id from crm_ca_jobs where id = job_id)));
drop policy if exists ca_results_read on crm_ca_results;
create policy ca_results_read on crm_ca_results for select using (crm_ca_can_read(call_id));
drop policy if exists ca_audit_admin on crm_ca_audit;
create policy ca_audit_admin on crm_ca_audit for select using (coalesce(crm_role() = 'admin', false));

revoke all on crm_ca_config, crm_ca_offer, crm_ca_cases, crm_ca_jobs, crm_ca_records, crm_ca_turns, crm_ca_results, crm_ca_audit from anon;
grant select on crm_ca_config, crm_ca_offer, crm_ca_cases, crm_ca_jobs, crm_ca_records, crm_ca_turns, crm_ca_results, crm_ca_audit to authenticated;
revoke execute on function crm_ca_claim(text), crm_ca_store(uuid, jsonb, jsonb, text), crm_ca_fail(uuid, text, boolean),
  crm_ca_call_info(uuid) from public, anon, authenticated;
revoke execute on function crm_ca_add_transcript(uuid, text, jsonb, text), crm_ca_retry(uuid), crm_ca_latest(uuid[]), crm_ca_record(uuid),
  crm_ca_can_read(uuid) from public, anon;
grant execute on function crm_ca_add_transcript(uuid, text, jsonb, text), crm_ca_retry(uuid), crm_ca_latest(uuid[]), crm_ca_record(uuid),
  crm_ca_can_read(uuid) to authenticated;
