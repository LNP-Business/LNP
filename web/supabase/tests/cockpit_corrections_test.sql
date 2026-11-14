-- 060_crm_cockpit_corrections.sql : la cohorte « appels tenus » d'Exécution, Qualité et Impact est le premier appel tenu du cycle ;
-- un appel tenu plus tard (après-vente) ne fait pas entrer dans la période un prospect déjà payé ; les sources branchées sont rendues.
do $$
declare adm uuid := gen_random_uuid(); p1 uuid; c1 uuid; k1 uuid; d1 uuid; r jsonb; d jsonb; base int; base_h int;
begin
  insert into auth.users (id, email) values (adm, 'cc.adm@x.com');
  insert into members (user_id, email, role) values (adm, 'cc.adm@x.com', 'admin');
  insert into crm_members (id, member_key, full_name, email, role) values (adm, 'ccadm', 'Cc Admin', 'cc.adm@x.com', 'admin')
  on conflict (id) do update set role = 'admin', active = true;
  perform set_config('request.jwt.claim.sub', adm::text, true);
  r := crm_sales_execution(30); base := (r #>> '{cohort,held}')::int;
  select (x->>'n')::int into base_h from jsonb_array_elements(r->'delays') x where x->>'id' = 'handover_2h';
  -- R1 tenu il y a 50 jours, payé 2 jours après ; un appel d'après-vente tenu il y a 10 jours
  insert into crm_people (full_name) values ('Lead Cc Un') returning id into p1;
  insert into crm_cycles (person_id, owner_id, opened_at) values (p1, adm, now() - interval '55 days') returning id into c1;
  insert into crm_calls (cycle_id, rank, scheduled_start, scheduled_end, status)
  values (c1, 1, now() - interval '50 days', now() - interval '50 days' + interval '45 minutes', 'held') returning id into k1;
  insert into crm_calls (cycle_id, rank, scheduled_start, scheduled_end, status)
  values (c1, 2, now() - interval '10 days', now() - interval '10 days' + interval '30 minutes', 'held');
  insert into crm_deals (cycle_id, product, amount_sold, currency, yes_at) values (c1, 'LNP 3000', 3000, 'EUR', now() - interval '49 days') returning id into d1;
  insert into crm_payments (deal_id, cycle_id, whop_payment_id, amount, refunded_amount, status, paid_at)
  values (d1, c1, 'pay_cc_1', 850, 0, 'paid', now() - interval '48 days'), (d1, c1, 'pay_cc_2', 850, 0, 'paid', now() - interval '18 days');
  r := crm_sales_execution(30);
  assert (r #>> '{cohort,held}')::int = base, 'le R1 d''il y a 50 jours n''entre pas dans les 30 jours par l''appel d''après-vente : ' || (r->'cohort')::text;
  select x into d from jsonb_array_elements(r->'delays') x where x->>'id' = 'decision_72';
  assert d->>'median' is null or (d->>'median')::numeric >= 0, 'jamais une décision avant l''appel : ' || d::text;
  select x into d from jsonb_array_elements(r->'delays') x where x->>'id' = 'handover_2h';
  assert (d->>'n')::int = base_h, 'l''échéance du mois n''est pas un « premier paiement » : ' || d::text;
  r := crm_sales_execution(90);
  assert (r #>> '{cohort,held}')::int >= base + 1, 'sur 90 jours, le R1 compte : ' || (r->'cohort')::text;
  assert r ? 'sources', 'les sources branchées sont rendues';
  perform set_config('request.jwt.claim.sub', '', true);
end $$;
select 'cockpit corrections SQL checks: all passed';
