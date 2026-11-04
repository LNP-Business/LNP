-- 041_crm_cockpit_collected.sql: offer price from the amount entered in iClosed, instalments, collected to date.
do $$
declare pid uuid; c1 uuid; c2 uuid; c3 uuid; d uuid; r jsonb; pl jsonb;
begin
  pl := crm_plan_for_amount(850);
  assert pl->>'match' = 'instalment' and (pl->>'total')::numeric = 3400 and (pl->>'n')::int = 4, 'an instalment of 4 x 850: ' || pl;
  pl := crm_plan_for_amount(3400);
  assert pl->>'match' = 'total' and (pl->>'n')::int = 4, 'the total of 4 x 850: ' || pl;
  pl := crm_plan_for_amount(3000);
  assert (pl->>'n')::int = 1, 'paid once';
  pl := crm_plan_for_amount(300);
  assert pl->>'match' = 'to_check' and (pl->>'total')::numeric = 3000, 'an advance on the default offer: ' || pl;
  -- an amount out of the grid above the default price: paid once, its own total
  assert (crm_auto_schedule(crm_plan_for_amount(3250), '2026-09-01') #>> '{0,amount}')::numeric = 3250, 'out of the grid: ' || crm_auto_schedule(crm_plan_for_amount(3250), '2026-09-01');
  assert jsonb_array_length(crm_auto_schedule(crm_plan_for_amount(850), '2026-09-01')) = 4
     and crm_auto_schedule(crm_plan_for_amount(850), '2026-09-01') #>> '{3,due}' = '2026-12-01', 'one instalment a month';
  -- a 4 x 850 sale 40 days ago: 2 instalments due (1 700 collected of 3 400)
  insert into crm_people (full_name) values ('Plan Lead') returning id into pid;
  insert into crm_cycles (person_id, opened_at) values (pid, now() - interval '50 days') returning id into c1;
  insert into crm_deals (cycle_id, amount_sold, currency, yes_at, iclosed_deal_ids) values (c1, 0, 'EUR', now() - interval '40 days', '{p1}') returning id into d;
  insert into crm_payments (deal_id, cycle_id, amount, currency, status, paid_at, refunded_amount, source, method, iclosed_deal_id)
  values (d, c1, 850, 'EUR', 'paid', now() - interval '40 days', 0, 'iclosed', 'deposit', 'p1');
  perform crm_apply_auto_plans();
  assert (select amount_sold from crm_deals where id = d) = 3400 and (select plan_source from crm_deals where id = d) = 'auto', 'auto plan';
  assert crm_deal_collected(d, now()) = 1700, 'collected to date: ' || crm_deal_collected(d, now());
  r := crm_sales_cockpit_window(now() - interval '56 days', now(), array[c1], true);
  assert (r->>'signed')::numeric = 3400 and (r->>'collected')::numeric = 1700 and (r->>'remaining')::numeric = 1700, 'cockpit: ' || r;
  r := crm_sales_cockpit_window(now() - interval '30 days', now(), array[c1], true);
  assert (r->>'received')::numeric = 850, 'cash of the period = the instalment due in it: ' || r;
  -- a plan set by hand is kept
  update crm_deals set schedule = '[{"due":"2026-01-01","amount":3400}]', amount_sold = 3400 where id = d;
  assert (select plan_source from crm_deals where id = d) = 'manual', 'marked manual';
  perform crm_apply_auto_plans();
  assert (select schedule #>> '{0,due}' from crm_deals where id = d) = '2026-01-01', 'manual plan kept';
  assert crm_deal_collected(d, now()) = 850, 'a manual plan collects the payments received';
end $$;
select 'cockpit collected SQL checks: all passed';
