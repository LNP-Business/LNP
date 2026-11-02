-- 026_crm_refunds.sql: a refund on a payment, who may, and a cycle refunded in full is lost (reason refunded).
do $$
declare rep uuid := gen_random_uuid(); rep2 uuid := gen_random_uuid(); pid uuid; cid uuid; p1 uuid; p2 uuid; ok boolean;
begin
  insert into auth.users (id, email) values (rep, 'refund.rep@x.com'), (rep2, 'refund.rep2@x.com');
  insert into members (user_id, email, role) values (rep, 'refund.rep@x.com', 'member'), (rep2, 'refund.rep2@x.com', 'member');
  update crm_members set role = 'sales' where id in (rep, rep2);
  insert into crm_people (full_name) values ('Refund Lead') returning id into pid;
  insert into crm_cycles (person_id, owner_id, opened_at) values (pid, rep, now() - interval '20 days') returning id into cid;
  perform set_config('request.jwt.claim.sub', rep::text, true);
  p1 := crm_add_payment(cid, 1000, now() - interval '10 days', 'card');
  p2 := crm_add_payment(cid, 500, now() - interval '5 days', 'card');
  assert (select status from crm_cycles where id = cid) = 'won', 'paid: won';
  perform set_config('request.jwt.claim.sub', rep2::text, true);
  begin perform crm_add_refund(p1); ok := false; exception when sqlstate '42501' then ok := true; end;
  assert ok, 'another sales rep cannot refund';
  perform set_config('request.jwt.claim.sub', rep::text, true);
  begin perform crm_add_refund(p1, 1200); ok := false; exception when sqlstate '22023' then ok := true; end;
  assert ok, 'a refund cannot exceed the payment';
  assert crm_add_refund(p1, 400) = 400, 'partial refund';
  assert (select status from crm_cycles where id = cid) = 'won', 'a partial refund keeps the cycle won';
  perform crm_add_refund(p1);   -- the rest of it
  assert (select refunded_amount from crm_payments where id = p1) = 1000, 'refunded in full';
  assert (select status from crm_cycles where id = cid) = 'won', 'one payment still paid: won';
  perform crm_add_refund(p2, null, now() - interval '1 day');
  assert (select status from crm_cycles where id = cid) = 'lost' and (select close_reason from crm_cycles where id = cid) = 'refunded',
    'every payment refunded: lost, reason refunded';
  assert (select closed_at from crm_cycles where id = cid) = (select max(occurred_at) from crm_events where cycle_id = cid and type = 'payment_refunded'), 'closed at the last refund';
  assert exists (select 1 from crm_events where cycle_id = cid and type = 'payment_refunded' and (data->>'full')::boolean), 'refund events';
  assert exists (select 1 from crm_audit_log where action = 'add_refund'), 'audited';
  begin perform crm_add_refund(p2); ok := false; exception when sqlstate '22023' then ok := true; end;
  assert ok, 'nothing left to refund';
  -- a new payment wins it again
  perform crm_add_payment(cid, 300, now(), 'card');
  assert (select status from crm_cycles where id = cid) = 'won', 'paid again: won';
end $$;
select 'refunds SQL checks: all passed';
