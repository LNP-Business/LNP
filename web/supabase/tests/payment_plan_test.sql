-- 024_crm_payment_plan.sql: the payment plan of a signed client, who may set it, and its checks.
do $$
declare rep uuid := gen_random_uuid(); rep2 uuid := gen_random_uuid(); pid uuid; cid uuid; ok boolean; d crm_deals;
begin
  insert into auth.users (id, email) values (rep, 'plan.rep@x.com'), (rep2, 'plan.rep2@x.com');
  insert into members (user_id, email, role) values (rep, 'plan.rep@x.com', 'member'), (rep2, 'plan.rep2@x.com', 'member');
  update crm_members set role = 'sales' where id in (rep, rep2);
  insert into crm_people (full_name) values ('Plan Lead') returning id into pid;
  insert into crm_cycles (person_id, owner_id, opened_at) values (pid, rep, now() - interval '5 days') returning id into cid;
  perform set_config('request.jwt.claim.sub', rep2::text, true);
  begin perform crm_set_payment_plan(cid, 5800, 'USD', '[{"due":"2026-10-19","amount":5800}]'); ok := false; exception when sqlstate '42501' then ok := true; end;
  assert ok, 'another sales rep cannot set the plan';
  perform set_config('request.jwt.claim.sub', rep::text, true);
  perform crm_set_payment_plan(cid, 5800, 'usd', '[{"due":"2026-10-22","amount":2800},{"due":"2026-10-19","amount":3000}]');
  select * into d from crm_deals where cycle_id = cid;
  assert d.amount_sold = 5800 and d.currency = 'USD' and d.payment_plan = '2 échéances', 'amount, currency and label';
  assert d.schedule = '[{"due":"2026-10-19","amount":3000},{"due":"2026-10-22","amount":2800}]'::jsonb, 'instalments in due order';
  perform crm_set_payment_plan(cid, 5800, null, '[{"due":"2026-10-19","amount":5800}]');
  select * into d from crm_deals where cycle_id = cid;
  assert d.payment_plan = 'Payé en une fois' and d.currency = 'USD', 'paid in full keeps the currency';
  begin perform crm_set_payment_plan(cid, 5800, 'USD', '[{"due":"2026-10-19","amount":5000}]'); ok := false; exception when sqlstate '22023' then ok := true; end;
  assert ok, 'instalments must add up to the amount signed';
  begin perform crm_set_payment_plan(cid, 5800, 'USD', '[{"due":"soon","amount":5800}]'); ok := false; exception when sqlstate '22023' then ok := true; end;
  assert ok, 'a date is needed';
  begin perform crm_set_payment_plan(cid, 5800, 'USD', '[]'); ok := false; exception when sqlstate '22023' then ok := true; end;
  assert ok, 'at least one instalment';
  begin perform crm_set_payment_plan(cid, 5800, 'USD', '[{"due":"2026-10-19","amount":6000},{"due":"2026-11-19","amount":-200}]'); ok := false; exception when sqlstate '22023' then ok := true; end;
  assert ok, 'no negative instalment';
  assert exists (select 1 from crm_audit_log where action = 'set_payment_plan'), 'audited';
end $$;
select 'payment plan SQL checks: all passed';
