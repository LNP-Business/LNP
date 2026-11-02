-- SKL OS CRM — call analysis on the board (web/supabase/021_crm_call_analysis_board.sql), after 020.
-- crm_ca_board(): one row per past R1 / R2 sales call the caller may analyse (CRM admins: every call; a sales rep: the calls
-- of his own cycles; others: none), with the state of its latest analysis. The CRM pipeline, the lead list and Sales cycle
-- read it once per load to show a chip per lead ("Add transcript", "Analysing…", the four scores) and open the analysis.
-- Same rules as crm_ca_call_info (020), computed for every call in one query. Safe to run again.

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
                        from crm_ca_results x where x.job_id = d.job_id))
           order by e.cycle_id, e.sales_round), '[]'::jsonb)
    from e
    join crm_calls k on k.id = e.id
    left join lateral (select * from crm_ca_jobs j where j.call_id = e.id order by j.created_at desc limit 1) j on true
    left join lateral (select r2.job_id from crm_ca_records r2 where r2.call_id = e.id order by r2.created_at desc limit 1) d on true
$$;

revoke execute on function crm_ca_board() from public, anon;
grant execute on function crm_ca_board() to authenticated;
