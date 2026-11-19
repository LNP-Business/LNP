-- 062 (2026-11-19) : la fiche d'un lead montre l'appel analysé, avec le bon numéro (R1, R2).
--
-- Bug : crm_ca_board() (la liste des appels de la fiche, ligne « Appels ») numérotait les appels en comptant tous ceux qui
-- n'étaient pas annulés, absences comprises. Un lead absent deux fois puis présent avait son appel honoré compté « R3 », donc
-- écarté (seuls R1 et R2 sont listés) : son analyse existait mais ne s'affichait pas (Maria D, R1 du 3 novembre). Sur la base
-- en ligne, 124 appels enregistrés R1 / R2 étaient ainsi cachés et 142 affichés avec un mauvais numéro.
--
-- Correction : la fiche numérote les appels exactement comme crm_ca_call_info(), qui décide quels appels sont analysés
-- (025) : dans un cycle enregistré par Fathom, un appel de vente est un appel enregistré par un commercial et son numéro est
-- son rang ; sinon, on compte les appels de vente non annulés (onboarding et étude de cas exclus). La fiche liste donc les
-- appels que l'analyse traite, ni plus ni moins. Rejouable.

create or replace function crm_ca_board() returns jsonb
language sql stable security definer set search_path = public as $$
  with vis as (
    select c.id from crm_cycles c
     where coalesce(crm_role() = 'admin', false) or c.owner_id = auth.uid()),
  b as (
    select k.id, k.cycle_id, k.scheduled_start, k.status, k.recorded_by, k.rank,
           (select e.data->>'event_name' from crm_events e where e.call_id = k.id and e.type = 'call_booked'
             order by e.occurred_at desc limit 1) ev
      from crm_calls k join vis on vis.id = k.cycle_id),
  f as (
    select b.cycle_id, bool_or(b.recorded_by is not null) fathom from b group by b.cycle_id),
  s as (
    -- the same rule as crm_ca_call_info (025)
    select b.*, f.fathom,
           case when f.fathom then b.recorded_by is null
                else coalesce(b.ev, '') ~* '(onboarding|case stud)' end other_kind
      from b join f on f.cycle_id = b.cycle_id),
  r as materialized (
    select s.*,
           case when s.fathom then case when s.recorded_by is not null then s.rank end
                when not s.other_kind and s.status <> 'canceled'
                then count(*) filter (where not s.other_kind and s.status <> 'canceled')
                       over (partition by s.cycle_id order by s.scheduled_start, s.id) end sales_round
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
           order by e.cycle_id, e.sales_round, e.scheduled_start), '[]'::jsonb)
    from e
    join crm_calls k on k.id = e.id
    left join lateral (select * from crm_ca_jobs j where j.call_id = e.id order by j.created_at desc limit 1) j on true
    left join lateral (select r2.job_id from crm_ca_records r2 where r2.call_id = e.id order by r2.created_at desc limit 1) d on true
$$;

revoke execute on function crm_ca_board() from public, anon;
grant execute on function crm_ca_board() to authenticated;
