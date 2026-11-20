-- 063 (2026-11-20) : corriger une lettre SPIN dans l'analyse d'appel, et garder chaque correction.
--
-- Romain, point 6 du plan qualité : un administrateur corrige à l'écran la lettre d'une question de la découverte (S, P, I,
-- N ou hors découverte). Méthode, partie C, C8 : « une personne peut corriger un verdict ; personne ne modifie une note à la
-- main ; chaque correction est gardée avec la question, la lecture, la décision, l'auteur et la date ». Donc :
-- - la table crm_ca_corrections ne reçoit que des ajouts (pas de modification ni d'effacement : aucune règle d'écriture,
--   l'écriture passe par crm_ca_correct) ;
-- - la note de l'analyse n'est pas recalculée ; l'écran montre la lettre corrigée à côté de celle du moteur ;
-- - les corrections alimentent le jeu de référence de la mesure (call-analysis/qa).
-- Rejouable.

create table if not exists crm_ca_corrections (
  id          bigserial primary key,
  job_id      uuid not null references crm_ca_jobs(id),
  call_id     uuid not null references crm_calls(id),
  competence  text not null default 'SPIN',
  unit_id     text not null,                        -- the solicitation id of the record (Q030.1)
  field       text not null default 'letter',
  engine_value text,                                -- what the engine decided
  value       text not null,                        -- what the person decided
  note        text,
  author      uuid default auth.uid(),
  created_at  timestamptz not null default now()
);
create index if not exists crm_ca_corrections_job on crm_ca_corrections (job_id);

alter table crm_ca_corrections enable row level security;
drop policy if exists crm_ca_corrections_read on crm_ca_corrections;
create policy crm_ca_corrections_read on crm_ca_corrections for select to authenticated using (crm_ca_can_read(call_id));
revoke insert, update, delete on crm_ca_corrections from anon, authenticated;

create or replace function crm_ca_correct(p_job uuid, p_unit text, p_value text, p_note text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare k uuid; eng text; c crm_ca_corrections;
begin
  if not coalesce(crm_role() = 'admin', false) then
    raise exception 'Action non autorisée' using errcode = '42501';
  end if;
  if p_value is null or p_value not in ('S', 'P', 'I', 'N', 'OUT') then
    raise exception 'Lettre inconnue : S, P, I, N ou hors découverte' using errcode = '22023';
  end if;
  select r.call_id into k from crm_ca_records r where r.job_id = p_job;
  if k is null then raise exception 'Analyse inconnue' using errcode = 'P0002'; end if;
  select coalesce(s->>'letter', 'OUT') into eng
    from crm_ca_results x, jsonb_array_elements(coalesce(x.details->'solicitations', '[]'::jsonb)) s
   where x.job_id = p_job and x.competence = 'SPIN' and s->>'id' = p_unit limit 1;
  if not found then raise exception 'Question inconnue dans cette analyse' using errcode = 'P0002'; end if;
  insert into crm_ca_corrections (job_id, call_id, unit_id, engine_value, value, note)
  values (p_job, k, p_unit, eng, p_value, nullif(btrim(coalesce(p_note, '')), '')) returning * into c;
  return to_jsonb(c);
end $$;

revoke execute on function crm_ca_correct(uuid, text, text, text) from public, anon;
grant execute on function crm_ca_correct(uuid, text, text, text) to authenticated;

-- the record now carries its corrections (the latest per question first) and whether the reader may correct
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
                       order by (q.job_id = r.job_id) desc nulls last, q.created_at desc limit 1),
    -- 063: the corrections made by a person (C8), newest first, and whether the reader may correct
    'corrections', (select coalesce(jsonb_agg(jsonb_build_object('unit_id', c.unit_id, 'field', c.field,
                       'engine_value', c.engine_value, 'value', c.value, 'note', c.note, 'created_at', c.created_at,
                       'author', coalesce(m.full_name, m.email)) order by c.created_at desc, c.id desc), '[]'::jsonb)
                      from crm_ca_corrections c left join crm_members m on m.id = c.author where c.job_id = r.job_id),
    'can_correct', coalesce(crm_role() = 'admin', false))
  from crm_ca_records r where r.job_id = p_job and crm_ca_can_read(r.call_id)
$$;
