-- 028_crm_sla_alerts.sql: the snapshot sla-tick reads, the claim that posts each miss once, closed to the browser.
do $$
declare pid uuid; cid uuid; snap jsonb; got jsonb;
begin
  insert into crm_people (full_name) values ('Sla Lead') returning id into pid;
  insert into crm_cycles (person_id, opened_at, last_event_at) values (pid, now() - interval '2 hours', now()) returning id into cid;
  insert into crm_calls (cycle_id, rank, status, scheduled_start, scheduled_end) values (cid, 1, 'scheduled', now() + interval '1 day', now() + interval '1 day 45 minutes');
  insert into crm_events (person_id, cycle_id, occurred_at, actor, channel, type, data, source, source_id)
  values (pid, cid, now() - interval '2 hours', 'prospect', 'iclosed', 'call_booked', '{}', 'crm', 'sla-test-1');
  snap := crm_sla_snapshot(60);
  select x into snap from jsonb_array_elements(snap) x where x->>'id' = cid::text;
  assert snap->>'person' = 'Sla Lead' and jsonb_array_length(snap->'events') = 1 and jsonb_array_length(snap->'calls') = 1, 'snapshot of an active cycle';
  assert not (snap->'events'->0 ? 'content'), 'no message text';
  got := crm_sla_claim(jsonb_build_array(jsonb_build_object('key', cid || ':SH-2:0:crit', 'cycle_id', cid, 'sla', 'SH-2', 'level', 'crit', 'crossed_at', now())));
  assert jsonb_array_length(got) = 1, 'first claim';
  got := crm_sla_claim(jsonb_build_array(jsonb_build_object('key', cid || ':SH-2:0:crit', 'cycle_id', cid, 'sla', 'SH-2', 'level', 'crit', 'crossed_at', now())));
  assert jsonb_array_length(got) = 0, 'never twice';
  assert (crm_sla_settings())->>'channel' = '#sales-cycle', 'settings';
  assert not has_function_privilege('authenticated', 'crm_sla_snapshot(int)', 'execute'), 'closed to the browser';
end $$;
select 'sla alerts SQL checks: all passed';
