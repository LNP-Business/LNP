-- Phase 2 checks: crm_apply_items (matching, cycles, calls, events, idempotency, order) and the projector.
\set ON_ERROR_STOP 1
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000b2', 'romain@example.com'), ('00000000-0000-0000-0000-0000000000c2', 'valentino@example.com');
insert into members (user_id, email, role) values ('00000000-0000-0000-0000-0000000000b2', 'romain@example.com', 'admin'), ('00000000-0000-0000-0000-0000000000c2', 'valentino@example.com', 'member');
insert into crm_members (id, member_key, full_name, email, role, iclosed_email) values
  ('00000000-0000-0000-0000-0000000000b2', 'romain', 'Romain', 'romain@example.com', 'sales_lead', null),
  ('00000000-0000-0000-0000-0000000000c2', 'sales', 'Valentino', 'valentino@example.com', 'sales', 'v.iclosed@example.com');

-- a raw row per test delivery
create function t_row() returns bigint language sql as $$ insert into crm_webhook_log (source, headers, body, auth_ok) values ('iclosed', '{}', '{}', true) returning id $$;
create function t_item(typ text, call text, at text, extra jsonb default '{}') returns jsonb language sql as $$
  select jsonb_build_object('source', 'iclosed', 'source_id', 'iclosed:' || typ || ':' || call || ':' || at, 'type', typ, 'occurred_at', at,
    'actor', 'prospect', 'channel', 'booking',
    'identity', jsonb_build_object('email', 'jane@example.com', 'phone', '+15551230001', 'iclosed_contact_id', 'k1', 'name', 'Jane Prospect'),
    'refs', jsonb_build_object('iclosed_call_id', call),
    'data', jsonb_build_object('start', '2026-10-27T15:00:00Z', 'end', '2026-10-27T15:45:00Z', 'host_email', 'V.iclosed@example.com', 'summary', 'Jane')) || extra
$$;

-- 1. booking: person + identities + cycle (stage Show, owner from the host email) + call R1 + event
do $$ declare r text; cy crm_cycles; begin
  r := crm_apply_items(t_row(), jsonb_build_array(t_item('call_booked', 'c1', '2026-10-24T09:00:00Z')));
  assert r = 'processed', 'booking processed';
  assert (select count(*) from crm_people) = 1 and (select count(*) from crm_person_identities) = 3, 'person and 3 identities';
  select * into cy from crm_cycles;
  assert cy.status = 'active' and cy.current_stage = 'show' and cy.owner_id = '00000000-0000-0000-0000-0000000000c2', 'cycle in Show, owned by Valentino';
  assert (select rank from crm_calls where iclosed_call_id = 'c1') = 1, 'call R1';
  assert (select count(*) from crm_events where type = 'call_booked') = 1, 'event';
  assert (select status from crm_webhook_log order by id desc limit 1) = 'processed', 'raw row marked';
  assert (select count(*) from crm_stage_history) = 1, 'stage history';
end $$;

-- 2. same delivery again (same source_id): nothing new
do $$ begin
  perform crm_apply_items(t_row(), jsonb_build_array(t_item('call_booked', 'c1', '2026-10-24T09:00:00Z')));
  assert (select count(*) from crm_events) = 1 and (select count(*) from crm_calls) = 1, 'idempotent';
end $$;

-- 3. reschedule, then a LATE older booking update must not overwrite the newer time
do $$ begin
  perform crm_apply_items(t_row(), jsonb_build_array(t_item('call_rescheduled', 'c1', '2026-10-24T11:00:00Z',
    '{"data":{"start":"2026-10-28T16:00:00Z","end":"2026-10-28T16:45:00Z"}}')));
  assert (select scheduled_start from crm_calls where iclosed_call_id = 'c1') = '2026-10-28T16:00:00Z', 'rescheduled';
  perform crm_apply_items(t_row(), jsonb_build_array(t_item('call_rescheduled', 'c1', '2026-10-24T10:00:00Z',
    '{"data":{"start":"2026-10-26T08:00:00Z","end":"2026-10-26T08:45:00Z"}}')));
  assert (select scheduled_start from crm_calls where iclosed_call_id = 'c1') = '2026-10-28T16:00:00Z', 'late event does not win';
  perform crm_apply_items(t_row(), jsonb_build_array(t_item('call_rescheduled', 'c1', '2026-10-24T11:30:00Z',
    '{"data":{"start":"2026-10-29T16:00:00Z"}}')));
  assert (select scheduled_end - scheduled_start from crm_calls where iclosed_call_id = 'c1') = interval '45 minutes', 'length kept';
  assert (select count(*) from crm_events where type = 'call_rescheduled') = 3, 'every fact kept in the journal';
end $$;

-- 4. cancel, then a second booking of the same person: same cycle, call R2, found by phone only
do $$ begin
  perform crm_apply_items(t_row(), jsonb_build_array(t_item('call_canceled', 'c1', '2026-10-24T12:00:00Z')));
  assert (select status from crm_calls where iclosed_call_id = 'c1') = 'canceled', 'canceled';
  assert (select next_move->>'code' from crm_cycles) = 'rebook', 'next move: rebook';
  perform crm_apply_items(t_row(), jsonb_build_array(t_item('call_booked', 'c2', '2026-10-24T13:00:00Z',
    '{"identity":{"phone":"+15551230001"}}')));
  assert (select count(*) from crm_cycles) = 1, 'same cycle';
  assert (select rank from crm_calls where iclosed_call_id = 'c2') = 2, 'R2';
end $$;

-- 5. a cancellation of an unknown call and identifiers pointing to two people go to the unmatched inbox
do $$ declare r text; begin
  r := crm_apply_items(t_row(), jsonb_build_array(t_item('call_canceled', 'zz', '2026-10-24T14:00:00Z')));
  assert r = 'unmatched', 'unknown cancel unmatched';
  insert into crm_people (id, full_name) values ('10000000-0000-0000-0000-0000000000f1', 'Other');
  insert into crm_person_identities (person_id, kind, value, source) values ('10000000-0000-0000-0000-0000000000f1', 'email', 'other@example.com', 'import');
  r := crm_apply_items(t_row(), jsonb_build_array(t_item('call_booked', 'c3', '2026-10-24T15:00:00Z',
    '{"identity":{"email":"other@example.com","phone":"+15551230001"}}')));
  assert r = 'unmatched', 'conflict unmatched';
  assert (select count(*) from crm_unmatched_inbox) = 2, 'two unmatched items';
  assert (select array_length(candidate_person_ids, 1) from crm_unmatched_inbox where reason like 'Les identifiants%') = 2, 'candidates kept';
end $$;

-- 6. outcome no -> lost (projector), a new booking within 30 days reopens the same cycle
do $$ declare cid uuid; begin
  update crm_calls set status = 'held' where iclosed_call_id = 'c2';
  insert into crm_call_outcomes (call_id, attendance, decision, reason_code, declared_by, declared_at)
  values ((select id from crm_calls where iclosed_call_id = 'c2'), 'held', 'no', 'price', '00000000-0000-0000-0000-0000000000c2', '2026-10-25T10:00:00Z');
  select id into cid from crm_cycles;
  perform crm_recompute_cycle(cid);
  assert (select status from crm_cycles) = 'lost' and (select close_reason from crm_cycles) = 'price', 'lost by outcome';
  assert (select count(*) from crm_events where type = 'cycle_lost') = 1, 'status event';
  perform crm_recompute_cycle(cid);
  assert (select count(*) from crm_events where type = 'cycle_lost') = 1, 'projector idempotent';
  perform crm_apply_items(t_row(), jsonb_build_array(t_item('call_booked', 'c4', '2026-10-30T09:00:00Z',
    '{"data":{"start":"2026-11-02T15:00:00Z","end":"2026-11-02T15:45:00Z"}}')));
  assert (select count(*) from crm_cycles) = 1, 'reopened, not a new cycle';
  assert (select status from crm_cycles) = 'active', 'active again';
  assert (select count(*) from crm_events where type = 'cycle_reopened') = 1, 'reopen event';
  assert (select rank from crm_calls where iclosed_call_id = 'c4') = 3, 'R3';
end $$;

-- 7. a booking after the 30 days opens a new cycle; unknown host -> default owner (sales)
do $$ declare r text; begin
  r := crm_apply_items(t_row(), jsonb_build_array(jsonb_build_object('source', 'iclosed', 'source_id', 'iclosed:call_booked:d1:x', 'type', 'call_booked',
    'occurred_at', '2026-10-24T09:00:00Z', 'identity', jsonb_build_object('email', 'new@example.com'), 'refs', jsonb_build_object('iclosed_call_id', 'd1'),
    'data', jsonb_build_object('start', '2026-10-29T10:00:00Z', 'host_email', 'nobody@example.com'))));
  assert (select owner_id from crm_cycles c join crm_people p on p.id = c.person_id where p.primary_email = 'new@example.com') = '00000000-0000-0000-0000-0000000000c2', 'default owner';
end $$;

-- 8. RLS: Valentino reads both of his cycles; the worker functions are not callable from the browser
begin; set local role authenticated; set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c2';
do $$ begin assert (select count(*) from crm_cycles) = 2, 'Valentino sees his cycles'; end $$;
do $$ begin perform crm_apply_items(1, '[]'); raise exception 'FAIL: worker callable';
exception when insufficient_privilege then null; end $$;
rollback;

-- 9. queue: failed rows come back after their back-off, not before; 8 attempts max
do $$ declare i bigint; begin
  i := t_row();
  perform crm_inbox_mark(i, 'failed', 'boom');
  assert not exists (select 1 from crm_inbox_pending(array['iclosed']) where id = i), 'waits 1 minute';
  update crm_webhook_log set processed_at = now() - interval '2 minutes' where id = i;
  assert exists (select 1 from crm_inbox_pending(array['iclosed']) where id = i), 'retried after back-off';
  update crm_webhook_log set attempts = 8 where id = i;
  assert not exists (select 1 from crm_inbox_pending(array['iclosed']) where id = i), 'gives up after 8';
  assert not exists (select 1 from crm_inbox_pending(array['fathom'])), 'only the sources asked';
end $$;

select 'phase 2 SQL checks: all passed';
