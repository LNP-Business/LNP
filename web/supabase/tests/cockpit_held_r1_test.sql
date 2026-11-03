-- 038_crm_cockpit_held_r1.sql: only a lead's first held R1 counts as held.
do $$
declare pid uuid; cid uuid; r jsonb;
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
  assert (r->>'held')::int = 0, 'the first R1 was held before this period ' || r;
end $$;
select 'cockpit held R1 SQL checks: all passed';
