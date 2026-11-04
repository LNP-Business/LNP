-- 040_crm_cockpit_rep_by_fathom.sql: a call booked on a shared calendar belongs to who recorded it in Fathom.
do $$
declare uid uuid := gen_random_uuid(); pid uuid; cid uuid; k uuid; res jsonb; names text[];
begin
  insert into auth.users (id, email) values (uid, 'rep.fathom@x.com');
  insert into members (user_id, email, role) values (uid, 'rep.fathom@x.com', 'admin');
  insert into crm_sales_team (rep, name) values ('shared', 'Shared'), ('holder', 'Holder') on conflict (rep) do nothing;
  insert into crm_people (full_name, first_seen_at) values ('Shared Lead', now() - interval '6 days') returning id into pid;
  insert into crm_cycles (person_id, opened_at) values (pid, now() - interval '6 days') returning id into cid;
  alter table crm_calls disable trigger user;
  insert into crm_calls (cycle_id, rank, scheduled_start, status, recorded_by, recording_start)
  values (cid, 1, now() - interval '2 days', 'held', 'holder@team.test', now() - interval '2 days') returning id into k;
  alter table crm_calls enable trigger user;
  insert into crm_events (person_id, cycle_id, call_id, occurred_at, actor, channel, type, data, source, source_id)
  values (pid, cid, k, now() - interval '5 days', 'prospect', 'booking', 'call_booked', '{"host_email":"shared@team.test"}', 'import', 'import:rep:1');
  -- a won cycle: the call after the sale (onboarding by someone else) does not take the sale
  declare p2 uuid; c2 uuid;
  begin
    insert into crm_people (full_name, first_seen_at) values ('Sold Lead', now() - interval '6 days') returning id into p2;
    insert into crm_cycles (person_id, opened_at) values (p2, now() - interval '6 days') returning id into c2;
    alter table crm_calls disable trigger user;
    insert into crm_calls (cycle_id, rank, scheduled_start, status, recorded_by, recording_start) values
      (c2, 1, now() - interval '4 days', 'held', 'holder@team.test', now() - interval '4 days'),
      (c2, 2, now() - interval '1 day', 'held', 'onboarder@team.test', now() - interval '1 day');
    alter table crm_calls enable trigger user;
    update crm_cycles set status = 'won', closed_at = now() - interval '4 days' where id = c2;
    insert into crm_sales_team (rep, name) values ('onboarder', 'Onboarder') on conflict (rep) do nothing;
  end;
  perform set_config('request.jwt.claim.sub', uid::text, true);
  res := crm_sales_cockpit();
  select array_agg(x->>'name') into names from jsonb_array_elements(res #> '{team,7}') x;
  assert 'Holder' = any(names) and not ('Shared' = any(coalesce(names, '{}'))), 'the recorder gets the call: ' || (res #> '{team,7}')::text;
  assert not ('Onboarder' = any(names)) and (select (x #>> '{figures,won}')::int from jsonb_array_elements(res #> '{team,7}') x where x->>'name' = 'Holder') = 1,
    'the sale stays with who sold: ' || (res #> '{team,7}')::text;
  assert not (select active from crm_sales_team where rep = 'contact') or not exists (select 1 from crm_sales_team where rep = 'contact'),
    'Antoine is a former sales rep';
  perform set_config('request.jwt.claim.sub', '', true);
end $$;
select 'cockpit rep by Fathom SQL checks: all passed';
