-- 048_crm_admin_only_sees_all.sql: an admin sees every lead; a sales rep, a sales lead and a viewer see only the leads whose
-- cycle they own (calls, events, payments, people included), in the tables and in the Sales cockpit.
create temp table ac_ids (k text primary key, v uuid);
grant select on ac_ids to authenticated;
do $$
declare adm uuid := gen_random_uuid(); s1 uuid := gen_random_uuid(); s2 uuid := gen_random_uuid(); sl uuid := gen_random_uuid(); vw uuid := gen_random_uuid();
        p1 uuid; p2 uuid; c1 uuid; c2 uuid;
begin
  insert into auth.users (id, email) values (adm, 'ac.adm@x.com'), (s1, 'ac.s1@x.com'), (s2, 'ac.s2@x.com'), (sl, 'ac.sl@x.com'), (vw, 'ac.vw@x.com');
  insert into members (user_id, email, role) values (adm, 'ac.adm@x.com', 'admin'), (s1, 'ac.s1@x.com', 'member'), (s2, 'ac.s2@x.com', 'member'),
    (sl, 'ac.sl@x.com', 'member'), (vw, 'ac.vw@x.com', 'viewer');
  insert into crm_members (id, member_key, full_name, email, role) values
    (adm, 'acadm', 'Ac Admin', 'ac.adm@x.com', 'admin'), (s1, 'acs1', 'Ac Un', 'ac.s1@x.com', 'sales'), (s2, 'acs2', 'Ac Deux', 'ac.s2@x.com', 'sales'),
    (sl, 'acsl', 'Ac Lead', 'ac.sl@x.com', 'sales_lead'), (vw, 'acvw', 'Ac Viewer', 'ac.vw@x.com', 'viewer')
  on conflict (id) do update set role = excluded.role, active = true;
  insert into crm_people (full_name) values ('Lead de Un') returning id into p1;
  insert into crm_people (full_name) values ('Lead de Deux') returning id into p2;
  insert into crm_cycles (person_id, owner_id, opened_at) values (p1, s1, now() - interval '2 days') returning id into c1;
  insert into crm_cycles (person_id, owner_id, opened_at) values (p2, s2, now() - interval '2 days') returning id into c2;
  insert into crm_calls (cycle_id, rank, status, scheduled_start) values (c1, 1, 'scheduled', now() + interval '1 day'), (c2, 1, 'scheduled', now() + interval '1 day');
  insert into crm_events (person_id, cycle_id, occurred_at, actor, channel, type, data, source, source_id) values
    (p1, c1, now(), 'prospect', 'booking', 'call_booked', '{}', 'import', 'ac:1'), (p2, c2, now(), 'prospect', 'booking', 'call_booked', '{}', 'import', 'ac:2');
  insert into ac_ids values ('adm', adm), ('s1', s1), ('sl', sl), ('vw', vw), ('c1', c1), ('c2', c2);
end $$;
set role authenticated;
do $$
declare ids jsonb := (select jsonb_object_agg(k, v) from ac_ids); n int;
begin
  perform set_config('request.jwt.claim.sub', ids->>'adm', true);
  assert (select count(*) from crm_cycles where id in ((ids->>'c1')::uuid, (ids->>'c2')::uuid)) = 2, 'an admin sees every lead';
  perform set_config('request.jwt.claim.sub', ids->>'s1', true);
  assert (select count(*) from crm_cycles where id in ((ids->>'c1')::uuid, (ids->>'c2')::uuid)) = 1
     and exists (select 1 from crm_cycles where id = (ids->>'c1')::uuid), 'a sales rep sees their own lead only';
  assert not exists (select 1 from crm_people where full_name = 'Lead de Deux'), 'not the person of another rep';
  assert not exists (select 1 from crm_calls where cycle_id = (ids->>'c2')::uuid), 'nor their calls';
  assert not exists (select 1 from crm_events where cycle_id = (ids->>'c2')::uuid), 'nor their events';
  perform set_config('request.jwt.claim.sub', ids->>'sl', true);
  assert not exists (select 1 from crm_cycles where id in ((ids->>'c1')::uuid, (ids->>'c2')::uuid)), 'a sales lead sees only their own leads (here: none)';
  perform set_config('request.jwt.claim.sub', ids->>'vw', true);
  assert not exists (select 1 from crm_cycles where id in ((ids->>'c1')::uuid, (ids->>'c2')::uuid)), 'a viewer sees no other lead';
  perform set_config('request.jwt.claim.sub', '', true);
end $$;
reset role;
drop table ac_ids;
select 'access scope SQL checks: all passed';
