-- 015_crm_owners.sql: an owner-less cycle goes to the member who hosted its latest booked call, on invitation too.
do $$
declare uid uuid := gen_random_uuid(); pid uuid; cid uuid; kid uuid; r jsonb;
begin
  insert into crm_people (full_name) values ('Owner Test') returning id into pid;
  insert into crm_cycles (person_id, opened_at) values (pid, now() - interval '3 days') returning id into cid;
  insert into crm_calls (cycle_id, rank, scheduled_start, status) values (cid, 1, now() - interval '2 days', 'held') returning id into kid;
  insert into crm_events (person_id, cycle_id, call_id, occurred_at, actor, channel, type, data, source, source_id)
  values (pid, cid, kid, now() - interval '3 days', 'prospect', 'booking', 'call_booked', '{"host_email":"Rep.Test@Example.com"}', 'import', 'import:test:owner');
  r := crm_assign_owners_from_hosts(true);
  assert (select owner_id from crm_cycles where id = cid) is null, 'no member yet: nothing assigned';
  -- the rep is invited: their CRM member row appears (011 trigger) and takes their leads (015 trigger)
  insert into auth.users (id, email) values (uid, 'rep.test@example.com');
  insert into members (user_id, email, role) values (uid, 'rep.test@example.com', 'member');
  assert (select owner_id from crm_cycles where id = cid) = uid, 'invited rep owns the cycle';
  assert (select host_id from crm_calls where id = kid) = uid, 'and hosts the call';
  -- an owner already set is never changed
  update crm_cycles set owner_id = null where id = cid;
  update crm_cycles set owner_id = (select id from crm_members where id <> uid limit 1) where id = cid and exists (select 1 from crm_members where id <> uid);
  perform crm_assign_owners_from_hosts(false);
  assert (select owner_id from crm_cycles where id = cid) is distinct from null, 'owner kept';
end $$;
select 'owners SQL checks: all passed';
