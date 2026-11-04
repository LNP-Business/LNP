-- 037_crm_iclosed_deals.sql: iClosed deals become the cycle's deal and payments; run again = same result.
do $$
declare pid uuid; pid2 uuid; cid uuid; cid2 uuid; cid3 uuid; pid3 uuid; r jsonb;
begin
  insert into crm_people (full_name) values ('Deal Lead') returning id into pid;
  insert into crm_cycles (person_id, opened_at) values (pid, now() - interval '20 days') returning id into cid;
  insert into crm_calls (cycle_id, rank, iclosed_call_id, scheduled_start, status) values (cid, 1, 'call-d-1', now() - interval '10 days', 'held');
  insert into crm_people (full_name) values ('Deposit Lead') returning id into pid2;
  insert into crm_person_identities (person_id, kind, value, source) values (pid2, 'iclosed_contact_id', 'c-d-2', 'import');
  insert into crm_cycles (person_id, opened_at) values (pid2, now() - interval '30 days') returning id into cid2;
  insert into crm_people (full_name) values ('Manual Lead') returning id into pid3;
  insert into crm_cycles (person_id, opened_at) values (pid3, now() - interval '30 days') returning id into cid3;
  insert into crm_calls (cycle_id, rank, iclosed_call_id, scheduled_start, status) values (cid3, 1, 'call-d-3', now() - interval '9 days', 'held');
  insert into crm_deals (cycle_id, amount_sold, currency, yes_at) values (cid3, 5000, 'EUR', now() - interval '9 days');
  perform crm_recompute_cycle(cid); perform crm_recompute_cycle(cid2);
  r := crm_import_deals('[{"iclosed_deal_id":"d1","iclosed_call_id":"call-d-1","iclosed_contact_id":"x","type":"WON","value":"3000","product":"LNP 3000","at":"2026-10-20T10:00:00Z"},
                          {"iclosed_deal_id":"d2","iclosed_call_id":"nope","iclosed_contact_id":"c-d-2","type":"DEPOSIT","value":"500","product":"Acompte","at":"2026-10-21T10:00:00Z"},
                          {"iclosed_deal_id":"d3","iclosed_call_id":"call-d-3","type":"WON","value":"2100","at":"2026-10-22T10:00:00Z"},
                          {"iclosed_deal_id":"d4","iclosed_call_id":"nope","iclosed_contact_id":"none","type":"WON","value":"3000"}]', true);
  assert (r->>'matched')::int = 3 and (r->>'unmatched')::int = 1 and (r->>'new')::int = 3, 'dry run counts ' || r;
  assert not exists (select 1 from crm_payments where source = 'iclosed'), 'dry run writes nothing';
  for i in 1..2 loop
    r := crm_import_deals('[{"iclosed_deal_id":"d1","iclosed_call_id":"call-d-1","iclosed_contact_id":"x","type":"WON","value":"3000","product":"LNP 3000","at":"2026-10-20T10:00:00Z"},
                            {"iclosed_deal_id":"d2","iclosed_call_id":"nope","iclosed_contact_id":"c-d-2","type":"DEPOSIT","value":"500","product":"Acompte","at":"2026-10-21T10:00:00Z"},
                            {"iclosed_deal_id":"d3","iclosed_call_id":"call-d-3","type":"WON","value":"2100","at":"2026-10-22T10:00:00Z"}]', false);
  end loop;
  assert (r->>'updated')::int = 3 and (r->>'new')::int = 0, 'second run updates ' || r;
  assert (select count(*) from crm_payments where source = 'iclosed') = 3, 'one payment per deal, once';
  assert (select count(*) from crm_events where source = 'iclosed' and type = 'payment_succeeded') = 3, 'one event per deal';
  assert (select amount_sold from crm_deals where cycle_id = cid) = 3000 and (select product from crm_deals where cycle_id = cid) = 'LNP 3000', 'deal from the call';
  -- 041: a 500 € advance is an advance on the default offer (3 000 €), flagged to check
  assert (select amount_sold from crm_deals where cycle_id = cid2) = 3000 and (select plan_match from crm_deals where cycle_id = cid2) = 'to_check', 'deposit via the contact id';
  assert (select method from crm_payments where iclosed_deal_id = 'd2') = 'deposit', 'deposit method';
  assert (select amount_sold from crm_deals where cycle_id = cid3) = 5000, 'an amount entered by hand stays';
  assert (select count(*) from crm_payments where cycle_id = cid3) = 1, 'its payment is still recorded';
  assert (select status from crm_cycles where id = cid) = 'won' and (select status from crm_cycles where id = cid2) = 'won', 'won at the payment';
  assert (select closed_at from crm_cycles where id = cid) = '2026-10-20T10:00:00Z'::timestamptz, 'closed at the deal time';
  -- the cockpit counts them
  r := crm_sales_cockpit_window('2026-10-01'::timestamptz, '2026-11-01'::timestamptz, array[cid, cid2, cid3], true);
  assert (r->>'received')::numeric = 5600 and (r->>'deals')::int = 3 and (r->>'signed')::numeric = 11000, 'cockpit money ' || r;
end $$;
select 'iclosed_deals_test ok';
