-- 033_crm_noshow_audit.sql: a tie goes to the lead whose call the sales rep declared held; a won lead counts as shown.
do $$
declare inbox bigint; r text; j jsonb; kd uuid; ke uuid; cd uuid; m uuid;
begin
  insert into crm_webhook_log (source, headers, body, auth_ok) values ('iclosed', '{}', '{}', true) returning id into inbox;
  r := crm_apply_items(inbox, '[
    {"type":"call_booked","source":"iclosed","source_id":"au:d","occurred_at":"2026-09-01T10:00:00Z","identity":{"email":"aud@example.com","name":"Aud D"},
     "refs":{"iclosed_call_id":"AU-D"},"data":{"start":"2026-09-12T16:00:00Z","end":"2026-09-12T16:45:00Z","host_email":"valentino@theinterioracademy.com","event_name":"Design Career Roadmap Call"}},
    {"type":"call_booked","source":"iclosed","source_id":"au:e","occurred_at":"2026-09-01T10:00:00Z","identity":{"email":"aue@example.com","name":"Aue E"},
     "refs":{"iclosed_call_id":"AU-E"},"data":{"start":"2026-09-12T16:00:00Z","end":"2026-09-12T16:45:00Z","host_email":"valentino@theinterioracademy.com","event_name":"Design Career Roadmap Call"}}]');
  select id, cycle_id into kd, cd from crm_calls where iclosed_call_id = 'AU-D';
  select id into ke from crm_calls where iclosed_call_id = 'AU-E';
  select id into m from crm_members limit 1;
  insert into crm_call_outcomes (call_id, attendance, decision, declared_at, declared_by) values (kd, 'held', 'follow_up', '2026-09-12T17:00:00Z', m);
  j := crm_apply_recording_item('{"source_id":"fathom:recorded:951","occurred_at":"2026-09-12T16:02:00Z",
    "refs":{"fathom_recording_id":951,"recorder_email":"valentino@theinterioracademy.com"},"identity":{"emails":[]},
    "data":{"start":"2026-09-12T16:02:00Z","end":"2026-09-12T16:50:00Z","title":"Design Career Roadmap Call"}}', false);
  assert j->>'status' = 'linked' and j->>'rule' = 'booking_declared', 'the declared held call takes the tie: ' || j::text;
  assert (select fathom_recording_id from crm_calls where id = kd) = 951 and (select fathom_recording_id from crm_calls where id = ke) is null, 'D''s call filled';
  -- a won lead is shown even without a recording
  update crm_calls set fathom_recording_id = null, recorded_by = null, recording_start = null, recording_end = null where id = kd;
  update crm_cycles set status = 'won' where id = cd;
  j := crm_sales_cockpit_window('2026-09-01', now(), array[cd], false);
  assert (j->>'shown_leads')::int = 1, 'won = shown: ' || j::text;
end $$;
select 'no-show audit SQL checks: all passed';
