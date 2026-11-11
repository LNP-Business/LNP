-- 058_crm_simulateur_offre_lnp.sql : l'offre LNP est là une seule fois (rejouée deux fois), prête, avec les champs lus par le
-- prospect, et sans prospect (un administrateur les génère depuis l'écran).
do $$
declare o crm_sim_offers;
begin
  assert (select count(*) from crm_sim_offers where name = 'Accompagnement Les Nouveaux Profs') = 1, 'one LNP offer';
  select * into o from crm_sim_offers where id = 'b1a7c0de-0000-4000-8000-000000000057';
  assert o.status = 'ready' and o.price = '3 000 €' and not o.archived, 'ready, priced';
  assert o.data->'offer_identity'->>'company_name' = 'Les Nouveaux Profs', 'company name for the prospect';
  assert o.data->'offer_details'->'main_offer'->>'price' = '3 000 €' and o.data->'offer_details'->'main_offer'->>'duration' = '4 mois', 'price and duration';
  assert jsonb_array_length(o.data->'offer_details'->'main_offer'->'financing_options') >= 4, 'payment plans';
  assert (o.data->'pricing'->'main_offer'->>'price')::int = 3000 and o.data->'pricing'->'guarantee'->>'duration' = '4 mois', 'V3 pricing';
  assert jsonb_array_length(o.data->'target_audience'->'ideal_profiles') between 2 and 4, 'two to four target profiles';
  assert jsonb_array_length(o.data->'tools_taught') > 0, 'tools';
  assert (select count(*) from crm_sim_personas where offer_id = o.id) = 0, 'no prospects in SQL';
end $$;
select 'simulateur offre LNP ok';
