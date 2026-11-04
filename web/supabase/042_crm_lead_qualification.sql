-- LNP CRM — lead qualification agent (web/supabase/042_crm_lead_qualification.sql), after 041.
-- Romain, 2026-11-04: « Qualification SQL des appels LNP — version 2 » (call-analysis/qualification): the model extracts the
-- facts of an R1 from its Fathom transcript (two readings), qualification_lnp.py applies the four-gate rule and decides
-- (SQL GAGNÉ, SQL OUVERT, SQL PERDU, NON SQL, MQL EN ATTENTE, À REVOIR). Run by .github/workflows/qualification.yml.
--   crm_lead_qualifications       one row per qualification run of a call (the latest per call is the current one)
--   crm_qualif_config()           the model tiers (crm_ca_config)
--   crm_qualif_candidates(p_limit, p_again)   the latest R1 of the most recent leads: past, not canceled, team test
--       records left out (crm_person_internal, 039); with the transcript, the call date and what was entered in iClosed;
--       without p_again, a call already qualified with the current prompt version is skipped
--   crm_qualif_store(...)         stores one result
-- Service role only (the worker); nothing is shown on a screen yet. Safe to run again.

create table if not exists crm_lead_qualifications (
  id bigint generated always as identity primary key,
  call_id uuid not null references crm_calls(id) on delete cascade,
  cycle_id uuid references crm_cycles(id) on delete cascade,
  status text not null,
  result jsonb not null,
  readings jsonb not null default '[]',
  verification jsonb not null default '[]',
  usage jsonb,
  prompt_version text, rules_version text,
  created_at timestamptz not null default now());
create index if not exists lead_qualifications_call on crm_lead_qualifications (call_id, created_at desc);
alter table crm_lead_qualifications enable row level security;

create or replace function crm_qualif_config() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('tiers', (select tiers from crm_ca_config limit 1))
$$;

create or replace function crm_qualif_candidates(p_limit int default 30, p_again boolean default false,
                                                 p_prompt_version text default 'lnp-sql-v2-2026-11-04') returns jsonb
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

create or replace function crm_qualif_store(p_call uuid, p_status text, p_result jsonb, p_readings jsonb, p_verification jsonb,
                                            p_usage jsonb, p_prompt_version text, p_rules_version text) returns bigint
language sql security definer set search_path = public as $$
  insert into crm_lead_qualifications (call_id, cycle_id, status, result, readings, verification, usage, prompt_version, rules_version)
  select p_call, k.cycle_id, p_status, coalesce(p_result, '{}'), coalesce(p_readings, '[]'), coalesce(p_verification, '[]'),
         p_usage, p_prompt_version, p_rules_version
    from crm_calls k where k.id = p_call
  returning id
$$;

revoke execute on function crm_qualif_config(), crm_qualif_candidates(int, boolean, text),
  crm_qualif_store(uuid, text, jsonb, jsonb, jsonb, jsonb, text, text) from public, anon, authenticated;
grant execute on function crm_qualif_config(), crm_qualif_candidates(int, boolean, text),
  crm_qualif_store(uuid, text, jsonb, jsonb, jsonb, jsonb, text, text) to service_role;
