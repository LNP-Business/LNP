-- 038_crm_cockpit_held_r1.sql: only a lead's first held R1 counts as held.
do $$
declare pid uuid; cid uuid; cid2 uuid; cid3 uuid; r jsonb;
begin
  insert into crm_people (full_name, first_seen_at) values ('R1 Lead', now() - interval '6 days') returning id into pid;
  insert into crm_cycles (person_id, opened_at) values (pid, now() - interval '6 days') returning id into cid;
  -- two held R1 (the first had no recording, so the next call keeps rank 1), then an R2: one held call
  alter table crm_calls disable trigger user;
  insert into crm_calls (cycle_id, rank, scheduled_start, status) values
    (cid, 1, now() - interval '5 days', 'held'), (cid, 1, now() - interval '4 days', 'held'), (cid, 2, now() - interval '3 days', 'held'),
    (cid, 1, now() - interval '6 days', 'no_show');
  alter table crm_calls enable trigger user;
  r := crm_sales_cockpit_window(now() - interval '7 days', now(), array[cid], true);
  assert (r->>'held')::int = 1, 'one held R1 ' || r;
  assert (r->>'no_show')::int = 1, 'no-shows unchanged ' || r;
  r := crm_sales_cockpit_window(now() - interval '4 days 12 hours', now(), array[cid], true);
  -- 039: held = the leads who showed at an R1 due in the period (here the second R1)
  assert (r->>'held')::int = 1, 'a lead who showed at an R1 of the period ' || r;
  -- show rate: leads with an R1 due; a past R1 with no outcome = no-show, all canceled = left out
  insert into crm_people (full_name) values ('Ghost') returning id into pid;
  insert into crm_cycles (person_id, opened_at) values (pid, now() - interval '6 days') returning id into cid2;
  insert into crm_people (full_name) values ('Canceled') returning id into pid;
  insert into crm_cycles (person_id, opened_at) values (pid, now() - interval '6 days') returning id into cid3;
  alter table crm_calls disable trigger user;
  insert into crm_calls (cycle_id, rank, scheduled_start, status) values (cid2, 1, now() - interval '2 days', 'scheduled'), (cid3, 1, now() - interval '2 days', 'canceled');
  alter table crm_calls enable trigger user;
  r := crm_sales_cockpit_window(now() - interval '7 days', now(), array[cid, cid2, cid3], true);
  assert (r->>'shown_leads')::int = 1 and (r->>'no_show_leads')::int = 1, 'show rate counts ' || r;
end $$;
select 'cockpit held R1 SQL checks: all passed';
