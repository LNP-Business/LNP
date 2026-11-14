-- 060 · Simulateur, référentiel v0.13 (Romain 2026-11-14 : « le simulateur parle très peu par rapport à la réalité des appels »).
-- La mesure de réalisme de chaque simulation terminée (part de parole du prospect, mots par réponse, longues réponses,
-- questions du prospect, comparées aux 549 vrais appels R1), écrite par la fonction `simulateur` dans
-- crm_sim_simulations.usage.realisme, est rendue dans l'historique (crm_sim_history). Peut être rejoué.
create or replace function crm_sim_history(p_user uuid default null, p_limit int default 200) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(x order by x->>'started_at' desc), '[]') from (
    select jsonb_build_object(
      'id', s.id, 'user_id', s.user_id, 'name', coalesce(m.full_name, m.email), 'status', s.status,
      'started_at', s.started_at, 'ended_at', s.ended_at, 'duration_seconds', s.duration_seconds,
      'prospect_name', s.prospect_name, 'persona_id', s.persona_id, 'offer_id', s.offer_id, 'offer_name', o.name,
      'mode', s.simulation_mode, 'difficulty', s.difficulty, 'voice', s.voice, 'version_referentiel', s.version_referentiel,
      'messages', (select count(*) from crm_sim_messages k where k.simulation_id = s.id),
      'analysis', (select jsonb_build_object('id', a.id, 'status', a.status, 'reason', a.reason,
                     'score', a.result->'score_total', 'niveau', a.result->>'niveau') from crm_sim_analyses a where a.simulation_id = s.id),
      'rating', (select f.rating from crm_sim_feedback f where f.simulation_id = s.id),
      'realisme', s.usage->'realisme') x
    from crm_sim_simulations s
    left join crm_members m on m.id = s.user_id
    left join crm_sim_offers o on o.id = s.offer_id
    where (s.user_id = auth.uid() or crm_role() = 'admin')
      and (p_user is null or s.user_id = p_user)
    order by s.started_at desc
    limit least(greatest(coalesce(p_limit, 200), 1), 1000)) q
$$;
revoke execute on function crm_sim_history(uuid, int) from public, anon;
grant execute on function crm_sim_history(uuid, int) to authenticated;
