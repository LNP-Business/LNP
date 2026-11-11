-- 057_crm_simulateur.sql : chacun lit ses simulations (un administrateur toutes), l'équipe lit les offres et les prospects
-- actifs, personne n'écrit depuis le navigateur ; l'historique ne montre que ce que la personne peut voir.
create temp table simt (k text primary key, v uuid);
grant select on simt to authenticated;
do $$
declare adm uuid := gen_random_uuid(); s1 uuid := gen_random_uuid(); s2 uuid := gen_random_uuid(); off uuid; sim bigint;
begin
  insert into auth.users (id, email) values (adm, 'sim.adm@x.com'), (s1, 'sim.s1@x.com'), (s2, 'sim.s2@x.com');
  insert into members (user_id, email, role) values (adm, 'sim.adm@x.com', 'admin'), (s1, 'sim.s1@x.com', 'member'), (s2, 'sim.s2@x.com', 'member');
  insert into crm_members (id, member_key, full_name, email, role) values
    (adm, 'simadm', 'Sim Admin', 'sim.adm@x.com', 'admin'), (s1, 'sims1', 'Sim Un', 'sim.s1@x.com', 'sales'), (s2, 'sims2', 'Sim Deux', 'sim.s2@x.com', 'sales')
  on conflict (id) do update set role = excluded.role, full_name = excluded.full_name, active = true;
  insert into simt values ('adm', adm), ('s1', s1), ('s2', s2);
  insert into crm_sim_offers (name, data) values ('Accompagnement LNP', '{"offer_identity": {"company_name": "LNP"}}') returning id into off;
  insert into crm_sim_personas (id, offer_id, first_name, difficulty, full_persona_data) values
    ('lnp-claire', off, 'Claire', 'moyen', '{}'), ('lnp-retire', off, 'Ancien', 'expert', '{}');
  update crm_sim_personas set active = false where id = 'lnp-retire';
  insert into crm_sim_simulations (user_id, prospect_name, persona_id, offer_id, simulation_mode) values (s1, 'Claire', 'lnp-claire', off, 'full') returning id into sim;
  insert into crm_sim_messages (simulation_id, role, content) values (sim, 'commercial', 'Bonjour Claire'), (sim, 'prospect', 'Oui bonjour ?');
  insert into crm_sim_analyses (simulation_id, user_id, status, result) values (sim, s1, 'completed', '{"score_total": 72, "niveau": "diagnostic"}');
  insert into crm_sim_feedback (simulation_id, user_id, rating) values (sim, s1, 4);
  insert into crm_sim_simulations (user_id, prospect_name, simulation_mode, difficulty) values (s2, 'Autre', 'objections', 'expert');
end $$;
set role authenticated;
do $$
declare ids jsonb := (select jsonb_object_agg(k, v) from simt); refused boolean; h jsonb;
begin
  perform set_config('request.jwt.claim.sub', ids->>'s1', true);
  assert (select count(*) from crm_sim_simulations) = 1, 'a sales rep sees only their own simulations';
  assert (select count(*) from crm_sim_messages) = 2, 'and their messages';
  assert (select count(*) from crm_sim_personas) = 1, 'the active prospects only';
  assert (select count(*) from crm_sim_offers where name = 'Accompagnement LNP') = 1, 'the offers';   -- 058 adds the LNP offer
  assert (select count(*) from crm_sim_config) = 1, 'the settings';
  h := crm_sim_history(null, 50);
  assert jsonb_array_length(h) = 1 and (h->0->>'messages')::int = 2 and (h->0->>'rating')::int = 4
    and (h->0->'analysis'->>'score')::int = 72 and h->0->>'offer_name' = 'Accompagnement LNP', 'the history row';
  refused := false; begin insert into crm_sim_messages (simulation_id, role, content) select id, 'commercial', 'x' from crm_sim_simulations; exception when others then refused := true; end;
  assert refused, 'no message written from the browser';
  refused := false; begin update crm_sim_config set claude_model = 'claude-haiku-5-5'; exception when others then refused := true; end;
  assert refused, 'no setting changed from the browser';
  refused := false; begin delete from crm_sim_simulations; exception when others then refused := true; end;
  assert refused, 'no simulation deleted from the browser';

  perform set_config('request.jwt.claim.sub', ids->>'adm', true);
  assert (select count(*) from crm_sim_simulations) = 2, 'an admin sees every simulation';
  assert (select count(*) from crm_sim_personas) = 2, 'and the retired prospects';
  assert jsonb_array_length(crm_sim_history((ids->>'s2')::uuid, 50)) = 1, 'the history of one person';

  perform set_config('request.jwt.claim.sub', gen_random_uuid()::text, true);
  assert (select count(*) from crm_sim_personas) = 0, 'nothing for someone outside the team';
end $$;
reset role;
select 'simulateur ok';
