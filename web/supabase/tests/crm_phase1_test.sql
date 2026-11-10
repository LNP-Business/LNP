-- Phase 1 checks (docs/crm/15-build-plan.md): who sees what (RLS), who may write (RPC role checks), audit, events,
-- and the merge of the CRM alert rules into config/alerts. Run with web/supabase/tests/run.sh (local Postgres).
\set ON_ERROR_STOP 1
\set amin  '''00000000-0000-0000-0000-00000000000a'''
\set romain '''00000000-0000-0000-0000-00000000000b'''
\set vale  '''00000000-0000-0000-0000-00000000000c'''
\set mich  '''00000000-0000-0000-0000-00000000000d'''

insert into auth.users (id, email) values (:amin, 'amin@example.com'), (:romain, 'romain@example.com'),
  (:vale, 'valentino@example.com'), (:mich, 'michael@example.com');
insert into members (user_id, email, role) values (:amin, 'amin@example.com', 'admin'), (:romain, 'romain@example.com', 'admin'),
  (:vale, 'valentino@example.com', 'member'), (:mich, 'michael@example.com', 'member');
insert into docs (col, id, body) values ('config', 'alerts', '{"id":"alerts","alerts":{"a1":{"on":false,"sev":"Low","who":[1,0,0],"ch":[1,0,0]}},"values":{"a1":5},"escH":12}');

-- team: an app admin links the accounts (lead first)
begin; set local role authenticated; set local request.jwt.claim.sub = :romain;
select crm_admin_set_member('amin@example.com', 'amin', 'Amin', 'admin');
select crm_admin_set_member('Romain@Example.com ', 'romain', 'Romain', 'sales_lead', 'amin');
select crm_admin_set_member('valentino@example.com', 'sales', 'Valentino', 'sales', 'romain');
commit;
do $$ begin
  assert (select count(*) from crm_members) = 3, 'three CRM members';
  assert (select l.member_key from crm_members m join crm_members l on l.id = m.lead_id where m.member_key = 'sales') = 'romain', 'Valentino -> Romain';
  assert (select l.member_key from crm_members m join crm_members l on l.id = m.lead_id where m.member_key = 'romain') = 'amin', 'Romain -> Amin';
  assert (select count(*) from crm_audit_log where action = 'set_member') = 3, 'member changes audited';
end $$;

-- a member who is not an admin cannot change the team; an unknown email is refused
begin; set local role authenticated; set local request.jwt.claim.sub = :vale;
do $$ begin perform crm_admin_set_member('valentino@example.com', 'sales', 'V', 'admin'); raise exception 'FAIL: member made himself admin';
exception when insufficient_privilege then null; end $$;
rollback;
begin; set local role authenticated; set local request.jwt.claim.sub = :romain;
do $$ begin perform crm_admin_set_member('nobody@example.com', 'x', 'X', 'sales'); raise exception 'FAIL: unknown email accepted';
exception when raise_exception then if sqlerrm like 'FAIL%' then raise; end if; end $$;
rollback;

-- data written by the server (service role): one cycle for Valentino, one for Romain
insert into crm_people (id, full_name, primary_email) values
  ('10000000-0000-0000-0000-000000000001', 'Prospect V', 'pv@example.com'),
  ('10000000-0000-0000-0000-000000000002', 'Prospect R', 'pr@example.com');
insert into crm_cycles (id, person_id, owner_id, opened_at) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', :vale, now() - interval '3 days'),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', :romain, now() - interval '2 days');
insert into crm_calls (id, cycle_id, rank, scheduled_start, scheduled_end) values
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 1, now() - interval '1 day', now() - interval '23 hours'),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 1, now() - interval '1 day', now() - interval '23 hours');
insert into crm_webhook_log (source, headers, body, auth_ok) values ('iclosed', '{}', '{}', true);

-- Valentino sees only his cycle, its person and its call; nothing of the raw log; he cannot write tables
begin; set local role authenticated; set local request.jwt.claim.sub = :vale;
do $$ begin
  assert (select count(*) from crm_cycles) = 1, 'Valentino sees only his cycle';
  assert (select count(*) from crm_people) = 1, 'Valentino sees only his prospect';
  assert (select count(*) from crm_calls) = 1, 'Valentino sees only his call';
  assert (select count(*) from crm_members) = 3, 'the team list is readable';
end $$;
do $$ begin perform count(*) from crm_webhook_log; raise exception 'FAIL: raw log readable';
exception when insufficient_privilege then null; end $$;
do $$ begin insert into crm_people (full_name) values ('x'); raise exception 'FAIL: direct insert allowed';
exception when insufficient_privilege then null; end $$;
do $$ begin perform crm_require(array['admin']::member_role[]); raise exception 'FAIL: helper callable';
exception when insufficient_privilege then null; end $$;
rollback;

-- Romain (sales lead) and Amin (admin) see every cycle; Michael (no CRM profile) sees none; anonymous: nothing
begin; set local role authenticated; set local request.jwt.claim.sub = :romain;
do $$ begin assert (select count(*) from crm_cycles) = 2, 'Romain sees all cycles'; end $$; rollback;
begin; set local role authenticated; set local request.jwt.claim.sub = :amin;
do $$ begin assert (select count(*) from crm_cycles) = 2, 'Amin sees all cycles'; end $$; rollback;
begin; set local role authenticated; set local request.jwt.claim.sub = :mich;
do $$ begin assert (select count(*) from crm_cycles) = 0, 'Michael sees no cycle'; end $$; rollback;
begin; set local role anon;
do $$ begin perform count(*) from crm_cycles; raise exception 'FAIL: anonymous read';
exception when insufficient_privilege then null; end $$;
rollback;

-- Valentino declares the outcome of his call; not of Romain's
begin; set local role authenticated; set local request.jwt.claim.sub = :vale;
select crm_declare_outcome('30000000-0000-0000-0000-000000000001', '{"attendance":"held","decision":"follow_up","next_step":"R2 Thursday"}');
do $$ begin perform crm_declare_outcome('30000000-0000-0000-0000-000000000002', '{"attendance":"no_show"}');
  raise exception 'FAIL: outcome on another owner''s call';
exception when insufficient_privilege then null; end $$;
do $$ begin perform crm_declare_outcome('30000000-0000-0000-0000-000000000001', '{"attendance":"held","decision":"no"}');
  raise exception 'FAIL: no without reason';
exception when raise_exception then if sqlerrm like 'FAIL%' then raise; end if; end $$;
do $$ begin perform crm_declare_outcome('30000000-0000-0000-0000-000000000001', '{"attendance":"held","decision":"no","reason_code":"dq_fake"}');
  raise exception 'FAIL: disqualification reason accepted for a no';
exception when raise_exception then if sqlerrm like 'FAIL%' then raise; end if; end $$;
-- correction: yes with an amount supersedes the first outcome and opens the deal
select crm_declare_outcome('30000000-0000-0000-0000-000000000001', '{"attendance":"held","decision":"yes","amount_sold":"3500","currency":"USD","product":"Signature"}');
select crm_add_note('20000000-0000-0000-0000-000000000001', 'Wants to start in November');
do $$ begin perform crm_update_config('crm_settings', 'default_owner', '"romain"'); raise exception 'FAIL: sales changed config';
exception when insufficient_privilege then null; end $$;
commit;
do $$ begin
  assert (select count(*) from crm_call_outcomes where call_id = '30000000-0000-0000-0000-000000000001') = 2, 'history kept';
  assert (select decision from crm_call_outcomes where call_id = '30000000-0000-0000-0000-000000000001' and superseded_at is null) = 'yes', 'current = yes';
  assert (select amount_sold from crm_deals where cycle_id = '20000000-0000-0000-0000-000000000001') = 3500, 'deal opened';
  assert (select status from crm_calls where id = '30000000-0000-0000-0000-000000000001') = 'held', 'call held';
  assert (select count(*) from crm_events where cycle_id = '20000000-0000-0000-0000-000000000001' and type like 'outcome_%') = 4, 'outcome events';
  assert (select count(*) from crm_events where type = 'note') = 1, 'note event';
  assert (select count(*) from crm_audit_log where action in ('declare_outcome', 'correct_outcome', 'add_note')) = 3, 'writes audited';
end $$;

-- the sales lead changes configuration (audited, no longer a proposal), reassigns, merges people
begin; set local role authenticated; set local request.jwt.claim.sub = :romain;
select crm_update_config('crm_rules', 'next_move', '{"params":{"reply_hours":3,"follow_up_hours":48,"reopen_days":30}}');
select crm_update_config('crm_stage_definitions', 'show', '{"target_hours":72}');
select crm_reassign_cycle('20000000-0000-0000-0000-000000000001', :romain);
select crm_reassign_cycle('20000000-0000-0000-0000-000000000001', :vale);
do $$ begin perform crm_merge_people('10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002');
  raise exception 'FAIL: merge of two active cycles';
exception when raise_exception then if sqlerrm like 'FAIL%' then raise; end if; end $$;
commit;
do $$ begin
  assert (select (params->>'reply_hours')::int from crm_rules where key = 'next_move') = 3, 'rule saved';
  assert not (select is_proposal from crm_rules where key = 'next_move'), 'no longer a proposal';
  assert (select target_hours from crm_stage_definitions where key = 'show') = 72, 'stage saved';
  assert (select critical_hours from crm_stage_definitions where key = 'show') = 168, 'other columns kept';
  assert (select count(*) from crm_audit_log where action = 'reassign_cycle') = 2, 'reassign audited';
end $$;

-- CRM alert rules join config/alerts: a1..a18 untouched, c1..c18 added once, thresholds as values["cN.param"]
begin; set local role authenticated; set local request.jwt.claim.sub = :vale;
do $$ begin perform crm_merge_alert_defaults(); raise exception 'FAIL: member changed alert rules';
exception when insufficient_privilege then null; end $$;
rollback;
begin; set local role authenticated; set local request.jwt.claim.sub = :romain;
do $$ begin
  assert crm_merge_alert_defaults() = 18, 'c1..c18 added';
  assert crm_merge_alert_defaults() = 0, 'second run adds nothing';
end $$;
commit;
do $$ declare b jsonb := (select body from docs where col = 'config' and id = 'alerts'); begin
  assert b->'alerts'->'a1' = '{"on":false,"sev":"Low","who":[1,0,0],"ch":[1,0,0]}'::jsonb, 'a1 untouched';
  assert (b->'values'->>'a1')::int = 5 and (b->>'escH')::int = 12, 'values and settings untouched';
  assert b->'alerts'->'c6' = '{"on":true,"sev":"Critical","who":[1,1,0],"ch":[1,0,0],"crm":true}'::jsonb, 'c6 shape';
  assert (b->'values'->>'c2.hours')::int = 2 and (b->'values'->>'c17.whatsapp_hours')::int = 6, 'thresholds';
end $$;

-- no config/alerts row yet (production today): the merge creates it with c1..c18 only; Settings adds a1..a18 defaults
delete from docs where col = 'config' and id = 'alerts';
do $$ declare b jsonb; begin
  assert crm_merge_alert_defaults() = 18, 'created from nothing';
  b := (select body from docs where col = 'config' and id = 'alerts');
  assert b->>'id' = 'alerts' and not (b->'alerts') ? 'a1', 'only CRM rules, a-rules left to their defaults';
end $$;

select 'phase 1 SQL checks: all passed' as result;
