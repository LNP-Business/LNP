-- 045_crm_pipeline_moves.sql: a lead with no call closed by hand from the Pipeline, reopened; a later outcome wins.
do $$
declare adm uuid := gen_random_uuid(); rep uuid := gen_random_uuid(); other uuid := gen_random_uuid(); pid uuid; cid uuid; kid uuid; refused boolean;
begin
  insert into auth.users (id, email) values (adm, 'mvadm@x.com'), (rep, 'mvrep@x.com'), (other, 'mvoth@x.com');
  insert into members (user_id, email, role) values (adm, 'mvadm@x.com', 'admin'), (rep, 'mvrep@x.com', 'member'), (other, 'mvoth@x.com', 'member');
  insert into crm_members (id, member_key, full_name, email, role) values
    (adm, 'mvadm', 'Mv Admin', 'mvadm@x.com', 'admin'), (rep, 'mvrep', 'Mv Rep', 'mvrep@x.com', 'sales'), (other, 'mvoth', 'Mv Other', 'mvoth@x.com', 'sales')
  on conflict (id) do update set role = excluded.role, active = true;
  insert into crm_people (full_name) values ('Move Lead') returning id into pid;
  insert into crm_cycles (person_id, opened_at, last_event_at, owner_id) values (pid, now() - interval '3 days', now(), rep) returning id into cid;

  -- another sales rep cannot close it; a wrong reason is refused
  perform set_config('request.jwt.claim.sub', other::text, true);
  refused := false; begin perform crm_close_cycle(cid, 'no', 'price'); exception when others then refused := true; end;
  assert refused, 'not their lead';
  perform set_config('request.jwt.claim.sub', rep::text, true);
  refused := false; begin perform crm_close_cycle(cid, 'no', 'dq_off_target'); exception when others then refused := true; end;
  assert refused, 'a disqualification reason for a no';
  -- the owner closes it lost, by hand
  perform crm_close_cycle(cid, 'no', 'price', 'Ne répond plus');
  assert (select status from crm_cycles where id = cid) = 'lost' and (select close_reason from crm_cycles where id = cid) = 'price', 'closed lost';
  assert exists (select 1 from crm_events where cycle_id = cid and type = 'cycle_lost' and source = 'manual' and content = 'Ne répond plus'), 'manual event';
  refused := false; begin perform crm_close_cycle(cid, 'no', 'price'); exception when others then refused := true; end;
  assert refused, 'already closed';
  -- reopened: back in the pipeline; then disqualified
  perform crm_reopen_cycle(cid);
  assert (select status from crm_cycles where id = cid) = 'active', 'reopened';
  perform pg_sleep(0.01);
  perform crm_close_cycle(cid, 'disqualified', 'dq_off_target');
  assert (select status from crm_cycles where id = cid) = 'disqualified', 'disqualified by hand';
  perform crm_reopen_cycle(cid);
  -- a call held later, declared follow-up: active, even after an earlier manual close
  perform set_config('request.jwt.claim.sub', adm::text, true);
  perform pg_sleep(0.01);
  perform crm_close_cycle(cid, 'no', 'price');
  create temp table mv_ids as select cid as cid, adm as adm;
end $$;
-- a new transaction: the outcome is declared after the manual close
do $$
declare cid uuid := (select cid from mv_ids); adm uuid := (select adm from mv_ids); kid uuid; refused boolean;
begin
  perform set_config('request.jwt.claim.sub', adm::text, true);
  insert into crm_calls (cycle_id, rank, status, scheduled_start, scheduled_end) values (cid, 1, 'scheduled', now() - interval '2 hours', now() - interval '1 hour') returning id into kid;
  perform crm_declare_outcome(kid, '{"attendance": "held", "decision": "follow_up", "next_step": "Relancer"}');
  assert (select status from crm_cycles where id = cid) = 'active', 'a later outcome wins over the manual close';
  -- a won lead is never reopened
  update crm_cycles set status = 'won' where id = cid;
  refused := false; begin perform crm_reopen_cycle(cid); exception when others then refused := true; end;
  assert refused, 'no reopening of a sale';
  perform set_config('request.jwt.claim.sub', '', true);
  assert exists (select 1 from crm_audit_log where action = 'close_cycle' and entity_id = cid::text), 'audited';
end $$;
drop table mv_ids;
select 'pipeline moves SQL checks: all passed';
