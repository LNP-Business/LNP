-- 016_crm_sales_cockpit.sql: the dashboard figures from the CRM tables (as an admin, who sees every cycle).
do $$
declare uid uuid := gen_random_uuid(); pid uuid; cid uuid; k1 uuid; k2 uuid; r jsonb; n jsonb;
begin
  insert into auth.users (id, email) values (uid, 'cockpit@x.com');
  insert into members (user_id, email, role) values (uid, 'cockpit@x.com', 'admin');
  perform set_config('request.jwt.claim.sub', uid::text, true);
  insert into crm_people (full_name) values ('Cockpit Lead') returning id into pid;
  insert into crm_cycles (person_id, owner_id, opened_at) values (pid, uid, now() - interval '5 days') returning id into cid;
  insert into crm_calls (cycle_id, rank, scheduled_start, scheduled_end, status) values (cid, 1, now() - interval '3 days', now() - interval '3 days' + interval '45 minutes', 'held') returning id into k1;
  insert into crm_calls (cycle_id, rank, scheduled_start, status) values (cid, 2, now() - interval '2 days', 'no_show') returning id into k2;
  insert into crm_events (person_id, cycle_id, call_id, occurred_at, actor, channel, type, data, source, source_id)
  values (pid, cid, k1, now() - interval '4 days', 'prospect', 'booking', 'call_booked', '{}', 'import', 'import:cockpit:1'),
         (pid, cid, k1, now() - interval '3 days' + interval '2 hours', 'sales', 'whatsapp', 'message_out', '{}', 'whatsapp', 'whatsapp:cockpit:1');
  insert into crm_deals (cycle_id, product, amount_sold, currency, yes_at) values (cid, 'Atlas', 4000, 'EUR', now() - interval '1 day');
  insert into crm_payments (deal_id, cycle_id, whop_payment_id, amount, refunded_amount, status, paid_at)
  select id, cid, 'pay_cockpit_1', 2000, 100, 'paid', now() - interval '1 day' from crm_deals where cycle_id = cid;
  r := crm_sales_cockpit();
  n := r #> '{periods,7,now}';
  assert (n->>'held')::int >= 1 and (n->>'no_show')::int >= 1, 'held and no-show counted: ' || n::text;
  assert (n->>'booked')::int >= 1, 'booking counted';
  assert (n->>'signed')::numeric >= 4000 and (n->>'cash')::numeric >= 1900, 'signed and cash net of refunds: ' || n::text;
  assert (n->>'follow_done')::int >= 1, 'follow-up within 24 h counted';
  assert jsonb_array_length(r->'weekly') = 8, '8 weekly points';
  assert r ? 'alerts' and r ? 'pipeline', 'alerts and pipeline';
  -- 017: a sales rep sees only their own cycles; the window function is not callable by signed-in people
  declare rep uuid := gen_random_uuid(); r2 jsonb;
  begin
    insert into auth.users (id, email) values (rep, 'rep.cockpit@x.com');
    insert into members (user_id, email, role) values (rep, 'rep.cockpit@x.com', 'member');
    update crm_members set role = 'sales' where id = rep;
    perform set_config('request.jwt.claim.sub', rep::text, true);
    r2 := crm_sales_cockpit();
    assert (r2 #>> '{periods,7,now,held}')::int = 0 and (r2 #>> '{periods,7,now,signed}')::numeric = 0, 'a sales rep does not see others'' cycles: ' || (r2 #> '{periods,7,now}')::text;
    assert not has_function_privilege('authenticated', 'crm_sales_cockpit_window(timestamptz, timestamptz, uuid[], boolean, uuid, boolean)', 'execute'), 'window closed';
  end;
  perform set_config('request.jwt.claim.sub', '', true);
  -- 018: a won cycle's past call with no outcome becomes held, the cycle stays won; the team shows the call's host
  declare p2 uuid; c2 uuid; k3 uuid; res jsonb;
  begin
    insert into crm_people (full_name) values ('Won Lead') returning id into p2;
    insert into crm_cycles (person_id, opened_at) values (p2, now() - interval '20 days') returning id into c2;
    insert into crm_calls (cycle_id, rank, scheduled_start, status) values (c2, 1, now() - interval '15 days', 'scheduled') returning id into k3;
    insert into crm_events (person_id, cycle_id, call_id, occurred_at, actor, channel, type, data, source, source_id) values
      (p2, c2, k3, now() - interval '18 days', 'prospect', 'booking', 'call_booked', '{"host_email":"valentino@academy.test"}', 'import', 'import:won:booked'),
      (p2, c2, null, now() - interval '10 days', 'system', 'crm', 'cycle_won', '{}', 'import', 'import:won:close');
    update crm_cycles set status = 'won', closed_at = now() - interval '10 days' where id = c2;
    res := crm_mark_won_calls_held(true);
    assert (select status from crm_calls where id = k3) = 'scheduled', 'dry run changes nothing: ' || res::text;
    res := crm_mark_won_calls_held(false);
    assert (select status from crm_calls where id = k3) = 'held', 'call held';
    assert (select status from crm_cycles where id = c2) = 'won', 'cycle still won';
    perform set_config('request.jwt.claim.sub', uid::text, true);
    res := crm_sales_cockpit();
    -- 019: only the current team (crm_sales_team: Valentino) gets a row; the owner-based cycles above count in the totals only
    assert jsonb_array_length(res #> '{team,30}') = 1 and res #>> '{team,30,0,id}' = 'valentino' and res #>> '{team,30,0,name}' = 'Valentino',
      'team = Valentino only: ' || (res #> '{team,30}')::text;
  end;
  perform set_config('request.jwt.claim.sub', '', true);
end $$;
select 'cockpit SQL checks: all passed';
