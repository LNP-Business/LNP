-- 027_crm_yes_keeps_deal.sql: a yes outcome without an amount keeps the deal; a yes with an amount still sets it.
do $$
declare rep uuid := gen_random_uuid(); pid uuid; cid uuid; k1 uuid; k2 uuid; d crm_deals;
begin
  insert into auth.users (id, email) values (rep, 'yes.rep@x.com');
  insert into members (user_id, email, role) values (rep, 'yes.rep@x.com', 'member');
  update crm_members set role = 'sales' where id = rep;
  perform set_config('request.jwt.claim.sub', rep::text, true);
  insert into crm_people (full_name) values ('Yes Lead') returning id into pid;
  insert into crm_cycles (person_id, owner_id, opened_at) values (pid, rep, now() - interval '5 days') returning id into cid;
  insert into crm_calls (cycle_id, rank, status, scheduled_start, scheduled_end) values (cid, 1, 'scheduled', now() - interval '2 days', now() - interval '2 days' + interval '45 minutes') returning id into k1;
  insert into crm_calls (cycle_id, rank, status, scheduled_start, scheduled_end) values (cid, 2, 'scheduled', now() - interval '1 day', now() - interval '1 day' + interval '45 minutes') returning id into k2;
  perform crm_set_payment_plan(cid, 5800, 'USD', '[{"due":"2026-10-28","amount":1933},{"due":"2026-11-27","amount":1933},{"due":"2026-12-27","amount":1934}]');
  perform crm_declare_outcome(k1, '{"attendance":"held","decision":"yes","next_step":"Confirm the first payment"}');
  select * into d from crm_deals where cycle_id = cid;
  assert d.amount_sold = 5800 and d.currency = 'USD' and d.payment_plan = '3 instalments' and jsonb_array_length(d.schedule) = 3,
    'a yes without amount keeps the amount signed, currency and plan';
  assert d.yes_at is not null, 'the yes date is set';
  perform crm_declare_outcome(k2, '{"attendance":"held","decision":"yes","amount_sold":"6000","currency":"USD","payment_plan":"Paid in full"}');
  select * into d from crm_deals where cycle_id = cid;
  assert d.amount_sold = 6000 and d.payment_plan = 'Paid in full', 'a yes with an amount still sets it';
end $$;
select 'yes keeps deal SQL checks: all passed';
