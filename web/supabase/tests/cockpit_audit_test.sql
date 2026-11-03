-- 039_crm_cockpit_audit.sql: pending R1 for 48 h, internal test records left out, former reps without a team row.
do $$
declare pid uuid; c1 uuid; c2 uuid; c3 uuid; c4 uuid; r jsonb;
begin
  -- c1 held, c2 undeclared R1 of 5 h ago (pending), c3 undeclared R1 of 3 days ago (no-show), c4 an internal test lead
  insert into crm_people (full_name, first_seen_at) values ('A', now() - interval '6 days') returning id into pid;
  insert into crm_cycles (person_id, opened_at) values (pid, now() - interval '6 days') returning id into c1;
  insert into crm_people (full_name, first_seen_at) values ('B', now() - interval '6 days') returning id into pid;
  insert into crm_cycles (person_id, opened_at) values (pid, now() - interval '6 days') returning id into c2;
  insert into crm_people (full_name, first_seen_at) values ('C', now() - interval '6 days') returning id into pid;
  insert into crm_cycles (person_id, opened_at) values (pid, now() - interval '6 days') returning id into c3;
  insert into crm_people (full_name, first_seen_at) values ('Test Interne', now() - interval '6 days') returning id into pid;
  insert into crm_person_identities (person_id, kind, value, source) values (pid, 'email', 'test@lesnouveauxprofs.fr', 'import');
  insert into crm_cycles (person_id, opened_at) values (pid, now() - interval '6 days') returning id into c4;
  alter table crm_calls disable trigger user;
  insert into crm_calls (cycle_id, rank, scheduled_start, status) values (c1, 1, now() - interval '2 days', 'held'),
    (c2, 1, now() - interval '5 hours', 'scheduled'), (c3, 1, now() - interval '3 days', 'scheduled'), (c4, 1, now() - interval '2 days', 'held');
  alter table crm_calls enable trigger user;
  r := crm_sales_cockpit_window(now() - interval '7 days', now(), array[c1, c2, c3, c4], true);
  assert (r->>'shown_leads')::int = 1 and (r->>'pending_leads')::int = 1 and (r->>'no_show_leads')::int = 1, 'show counts ' || r;
  assert (r->>'held')::int = 1, 'held = shown ' || r;
  assert crm_person_internal(pid) and not crm_person_internal((select person_id from crm_cycles where id = c1)), 'internal';
  assert (select count(*) from crm_sales_team where not active and rep = 'lucasphilippe21') = (select count(*) from crm_sales_team where rep = 'lucasphilippe21'), 'former rep inactive';
end $$;
select 'cockpit audit SQL checks: all passed';
