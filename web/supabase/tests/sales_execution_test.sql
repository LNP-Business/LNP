-- 050_crm_sales_execution.sql: Cockpit commercial › Exécution, Qualité, Impact. Un administrateur voit tout, un commercial ses
-- cycles ; un prospect tenu, qualifié, payé dans les 14 jours compte comme vente ; les portes de la qualification sont comptées.
do $$
declare adm uuid := gen_random_uuid(); rep uuid := gen_random_uuid(); p1 uuid; p2 uuid; c1 uuid; c2 uuid; k1 uuid; d1 uuid; r jsonb; d jsonb;
begin
  insert into auth.users (id, email) values (adm, 'sx.adm@x.com'), (rep, 'sx.rep@x.com');
  insert into members (user_id, email, role) values (adm, 'sx.adm@x.com', 'admin'), (rep, 'sx.rep@x.com', 'member');
  insert into crm_members (id, member_key, full_name, email, role) values (adm, 'sxadm', 'Sx Admin', 'sx.adm@x.com', 'admin'), (rep, 'sxrep', 'Sx Rep', 'sx.rep@x.com', 'sales')
  on conflict (id) do update set role = excluded.role, full_name = excluded.full_name, active = true;
  -- c1 (au commercial) : RDV pris il y a 40 jours, R1 tenu il y a 30 jours, qualifié (SQL OUVERT), payé 3 jours après, contacté en 2 min
  insert into crm_people (full_name) values ('Lead Sx Un') returning id into p1;
  insert into crm_cycles (person_id, owner_id, opened_at) values (p1, rep, now() - interval '40 days') returning id into c1;
  insert into crm_calls (cycle_id, rank, scheduled_start, scheduled_end, status, recording_end, fathom_recording_id)
  values (c1, 1, now() - interval '30 days', now() - interval '30 days' + interval '45 minutes', 'held', now() - interval '30 days' + interval '45 minutes', 990001) returning id into k1;
  insert into crm_events (person_id, cycle_id, call_id, occurred_at, actor, channel, type, data, source, source_id) values
    (p1, c1, k1, now() - interval '40 days', 'prospect', 'booking', 'call_booked', '{}', 'import', 'import:sx:1'),
    (p1, c1, null, now() - interval '40 days' + interval '2 minutes', 'sales', 'whatsapp', 'message_out', '{}', 'whatsapp', 'whatsapp:sx:1'),
    (p1, c1, null, now() - interval '30 days' + interval '75 minutes', 'sales', 'whatsapp', 'message_out', '{}', 'whatsapp', 'whatsapp:sx:2');
  insert into crm_deals (cycle_id, product, amount_sold, currency, yes_at) values (c1, 'Accompagnement 4 mois', 3000, 'EUR', now() - interval '28 days') returning id into d1;
  insert into crm_payments (deal_id, cycle_id, whop_payment_id, amount, refunded_amount, status, paid_at)
  values (d1, c1, 'pay_sx_1', 850, 0, 'paid', now() - interval '27 days');
  insert into crm_lead_qualifications (call_id, cycle_id, status, result) values (k1, c1, 'SQL OUVERT',
    '{"statut": "SQL OUVERT", "portes": {"metier": {"statut": "OUVERTE"}, "financement": {"statut": "OUVERTE"}, "decision_timing": {"statut": "NON VÉRIFIÉE"}, "douleur_projet": {"statut": "FERMÉE"}}}');
  -- c2 (à l'administrateur) : absent au R1 il y a 10 jours, jamais recontacté
  insert into crm_people (full_name) values ('Lead Sx Deux') returning id into p2;
  insert into crm_cycles (person_id, owner_id, opened_at) values (p2, adm, now() - interval '12 days') returning id into c2;
  insert into crm_calls (cycle_id, rank, scheduled_start, status) values (c2, 1, now() - interval '10 days', 'no_show');

  perform set_config('request.jwt.claim.sub', adm::text, true);
  r := crm_sales_execution(90);
  assert jsonb_array_length(r->'delays') = 11, 'onze délais : ' || jsonb_array_length(r->'delays');
  select x into d from jsonb_array_elements(r->'delays') x where x->>'id' = 'speed_to_lead';
  assert (d->>'met')::int >= 1 and d->>'rule' = 'SH-2' and d->>'label' = 'Premier contact du commercial après la prise de RDV', 'premier contact dans les temps : ' || d::text;
  select x into d from jsonb_array_elements(r->'delays') x where x->>'id' = 'recap_60';
  assert (d->>'n')::int >= 1 and (d->>'met')::int >= 1, 'récap 30 min après la fin de l''appel : dans les temps ' || d::text;
  assert (r #>> '{cohort,matured}')::int >= 1 and (r #>> '{cohort,won14}')::int >= 1, 'une vente dans les 14 jours : ' || (r->'cohort')::text;
  assert (r #>> '{reactivation,no_show,n}')::int >= 1 and (r #>> '{reactivation,no_show,never_contacted}')::int >= 1, 'l''absence jamais recontactée : ' || (r->'reactivation')::text;
  assert (r #>> '{quality,recorded}')::int >= 1, 'appel enregistré';
  assert jsonb_array_length(r #> '{quality,criteria}') = 3, 'trois portes (sans douleur et projet) : ' || (r #> '{quality,criteria}')::text;
  select x into d from jsonb_array_elements(r #> '{quality,criteria}') x where x->>'k' = 'metier';
  assert d->>'name' = 'Métier' and (d->>'pass')::int >= 1, 'porte Métier ouverte : ' || d::text;
  select x into d from jsonb_array_elements(r #> '{quality,criteria}') x where x->>'k' = 'decision_timing';
  assert (d->>'unknown')::int >= 1, 'Décision et timing non vérifiée';
  -- le commercial ne voit que son cycle : pas l'absence de c2
  perform set_config('request.jwt.claim.sub', rep::text, true);
  r := crm_sales_execution(90);
  assert (r #>> '{reactivation,no_show,n}')::int = 0, 'un commercial ne voit pas les cycles des autres';
  assert (r #>> '{cohort,held}')::int >= 1, 'il voit le sien';
  -- 7 jours acceptés
  assert (crm_sales_execution(7)->>'days')::int = 7, '7 jours';
  perform set_config('request.jwt.claim.sub', '', true);
end $$;
select 'sales execution SQL checks: all passed';
