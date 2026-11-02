-- 022_crm_manual_cash.sql: amount signed and payments entered by hand, who may, and the cycle status they drive.
do $$
declare adm uuid := gen_random_uuid(); rep uuid := gen_random_uuid(); rep2 uuid := gen_random_uuid(); pid uuid; cid uuid; pay uuid; ok boolean; d uuid;
begin
  insert into auth.users (id, email) values (adm, 'cash.admin@x.com'), (rep, 'cash.rep@x.com'), (rep2, 'cash.rep2@x.com');
  insert into members (user_id, email, role) values (adm, 'cash.admin@x.com', 'admin'), (rep, 'cash.rep@x.com', 'member'), (rep2, 'cash.rep2@x.com', 'member');
  update crm_members set role = 'sales' where id in (rep, rep2);
  insert into crm_people (full_name) values ('Cash Lead') returning id into pid;
  insert into crm_cycles (person_id, owner_id, opened_at) values (pid, rep, now() - interval '10 days') returning id into cid;
  perform crm_recompute_cycle(cid);
  assert (select status from crm_cycles where id = cid) = 'active', 'starts active';
  -- another sales rep may not; the owner may
  perform set_config('request.jwt.claim.sub', rep2::text, true);
  begin perform crm_add_payment(cid, 1000, now(), 'card'); ok := false; exception when sqlstate '42501' then ok := true; end;
  assert ok, 'another sales rep cannot enter cash';
  perform set_config('request.jwt.claim.sub', rep::text, true);
  d := crm_set_deal(cid, 4800, 'eur');
  assert (select amount_sold from crm_deals where cycle_id = cid) = 4800 and (select currency from crm_deals where cycle_id = cid) = 'EUR', 'amount signed';
  begin perform crm_add_payment(cid, 0, now(), 'card'); ok := false; exception when sqlstate '22023' then ok := true; end;
  assert ok, 'zero refused';
  begin perform crm_add_payment(cid, 100, now() + interval '3 days', 'card'); ok := false; exception when sqlstate '22023' then ok := true; end;
  assert ok, 'future refused';
  begin perform crm_add_payment(cid, 100, now(), 'crypto'); ok := false; exception when sqlstate '22023' then ok := true; end;
  assert ok, 'unknown method refused';
  pay := crm_add_payment(cid, 1600, now() - interval '1 day', 'bank_transfer', 'First instalment');
  assert (select source from crm_payments where id = pay) = 'manual' and (select deal_id from crm_payments where id = pay) = d, 'manual payment on the deal';
  assert exists (select 1 from crm_events where cycle_id = cid and type = 'payment_succeeded' and source_id = 'payment:' || pay), 'payment event';
  assert (select status from crm_cycles where id = cid) = 'won', 'the first payment wins the cycle';
  assert exists (select 1 from crm_audit_log where action = 'add_payment' and entity_id = pay::text), 'audited';
  -- a Whop payment cannot be removed here; the manual one can, and the cycle goes back to active
  insert into crm_payments (deal_id, cycle_id, whop_payment_id, amount, status, paid_at) values (d, cid, 'pay_whop_cash_1', 10, 'paid', now()) returning id into d;
  begin perform crm_delete_payment(d); ok := false; exception when sqlstate '42501' then ok := true; end;
  assert ok, 'a Whop payment cannot be removed';
  delete from crm_payments where id = d;
  perform crm_delete_payment(pay);
  assert not exists (select 1 from crm_payments where id = pay) and not exists (select 1 from crm_events where source_id = 'payment:' || pay), 'removed';
  assert (select status from crm_cycles where id = cid) = 'active', 'back to active';
  perform set_config('request.jwt.claim.sub', adm::text, true);
  pay := crm_add_payment(cid, 500, now(), 'cash');
  assert (select status from crm_cycles where id = cid) = 'won', 'admin can enter cash';
  perform set_config('request.jwt.claim.sub', '', true);
end $$;
select 'manual cash SQL checks: all passed';
