-- 047_crm_pipeline_stage_moves.sql: a move with nothing to declare is kept; never back to a round reached, never a round
-- skipped, never past a call ahead, an outcome to declare or a no-show.
create temp table sm_ids (k text primary key, v uuid);
do $$
declare adm uuid := gen_random_uuid(); pid uuid; c_new uuid; c_held uuid; c_ahead uuid; c_due uuid; c_ns uuid; c_lost uuid; k uuid; refused boolean;
begin
  insert into auth.users (id, email) values (adm, 'sm.adm@x.com');
  insert into members (user_id, email, role) values (adm, 'sm.adm@x.com', 'admin');
  insert into crm_members (id, member_key, full_name, email, role) values (adm, 'smadm', 'Sm Admin', 'sm.adm@x.com', 'admin')
  on conflict (id) do update set role = 'admin', active = true;
  insert into crm_people (full_name) values ('Stage Lead') returning id into pid;
  insert into crm_cycles (person_id, opened_at) values (pid, now() - interval '9 days') returning id into c_new;
  insert into crm_people (full_name) values ('Stage Lead') returning id into pid;
  insert into crm_cycles (person_id, opened_at) values (pid, now() - interval '9 days') returning id into c_held;
  insert into crm_people (full_name) values ('Stage Lead') returning id into pid;
  insert into crm_cycles (person_id, opened_at) values (pid, now() - interval '9 days') returning id into c_ahead;
  insert into crm_people (full_name) values ('Stage Lead') returning id into pid;
  insert into crm_cycles (person_id, opened_at) values (pid, now() - interval '9 days') returning id into c_due;
  insert into crm_people (full_name) values ('Stage Lead') returning id into pid;
  insert into crm_cycles (person_id, opened_at) values (pid, now() - interval '9 days') returning id into c_ns;
  insert into crm_people (full_name) values ('Stage Lead') returning id into pid;
  insert into crm_cycles (person_id, opened_at, status) values (pid, now() - interval '9 days', 'lost') returning id into c_lost;
  insert into crm_calls (cycle_id, rank, status, scheduled_start, scheduled_end) values (c_held, 1, 'scheduled', now() - interval '3 days', now() - interval '3 days' + interval '45 minutes') returning id into k;
  insert into sm_ids values ('held_call', k);
  -- an R1 held has its Fathom recording (029 / 030: only a complete recorded call counts as a round)
  insert into crm_calls (cycle_id, rank, status, scheduled_start, scheduled_end, recorded_by, recording_start, recording_end) values
    (c_ahead, 1, 'held', now() - interval '5 days', now() - interval '5 days' + interval '45 minutes', 'sam@lesnouveauxprofs.fr',
     now() - interval '5 days', now() - interval '5 days' + interval '40 minutes');
  insert into crm_call_outcomes (call_id, attendance, decision, declared_at, declared_by)
  select id, 'held', 'follow_up', now() - interval '5 days', adm from crm_calls where cycle_id = c_ahead and rank = 1;
  insert into crm_calls (cycle_id, rank, status, scheduled_start, scheduled_end) values
    (c_ahead, 2, 'scheduled', now() + interval '2 days', now() + interval '2 days' + interval '45 minutes'),
    (c_due, 1, 'scheduled', now() - interval '2 hours', now() - interval '1 hour'),
    (c_ns, 1, 'no_show', now() - interval '2 days', now() - interval '2 days' + interval '45 minutes');
  insert into sm_ids values ('adm', adm), ('new', c_new), ('held', c_held), ('ahead', c_ahead), ('due', c_due), ('ns', c_ns), ('lost', c_lost);
  perform set_config('request.jwt.claim.sub', adm::text, true);
  perform crm_declare_outcome(k, '{"attendance": "held", "decision": "follow_up", "next_step": "R2"}');
end $$;
-- new transactions: the moves come after the outcome
do $$
declare ids jsonb := (select jsonb_object_agg(k, v) from sm_ids); refused boolean; r jsonb;
begin
  perform set_config('request.jwt.claim.sub', ids->>'adm', true);
  -- no call: R1 at once; R3 refused (a round is never skipped)
  r := crm_move_cycle((ids->>'new')::uuid, 'r1');
  assert r->>'to' = 'r1' and exists (select 1 from crm_events where cycle_id = (ids->>'new')::uuid and type = 'stage_moved' and source = 'manual'), 'moved to R1';
  refused := false; begin perform crm_move_cycle((ids->>'new')::uuid, 'r3'); exception when others then refused := true; end;
  assert refused, 'R3 before R2 refused';
  -- R1 held and declared: R2 at once; then never back to R1
  perform crm_move_cycle((ids->>'held')::uuid, 'r2');
  refused := false; begin perform crm_move_cycle((ids->>'held')::uuid, 'r1'); exception when others then refused := true; end;
  assert refused, 'R2 → R1 refused';
  refused := false; begin perform crm_move_cycle((ids->>'held')::uuid, 'r3'); exception when others then refused := true; end;
  assert refused, 'R3 before the R2 is held refused';
  -- an R2 ahead: R1 refused (already in R2), R3 refused (the R2 has not happened)
  refused := false; begin perform crm_move_cycle((ids->>'ahead')::uuid, 'r1'); exception when others then refused := true; end;
  assert refused, 'back from R2 refused';
  refused := false; begin perform crm_move_cycle((ids->>'ahead')::uuid, 'r3'); exception when others then refused := true; end;
  assert refused, 'past a call ahead refused';
  -- an outcome to declare: the next round waits for it
  refused := false; begin perform crm_move_cycle((ids->>'due')::uuid, 'r2'); exception when others then refused := true; end;
  assert refused, 'outcome to declare first';
  -- a no-show: back to R1 (to reschedule), never R2
  perform crm_move_cycle((ids->>'ns')::uuid, 'r1');
  refused := false; begin perform crm_move_cycle((ids->>'ns')::uuid, 'r2'); exception when others then refused := true; end;
  assert refused, 'R2 after a no-show refused';
  -- Relance longue at once; a closed lead is refused; an unknown column too
  perform crm_move_cycle((ids->>'ahead')::uuid, 'longfu');
  refused := false; begin perform crm_move_cycle((ids->>'lost')::uuid, 'r1'); exception when others then refused := true; end;
  assert refused, 'a closed lead is reopened first';
  refused := false; begin perform crm_move_cycle((ids->>'new')::uuid, 'close'); exception when others then refused := true; end;
  assert refused, 'Gagné is never a move by hand';
  assert exists (select 1 from crm_audit_log where action = 'move_cycle'), 'audited';
end $$;
drop table sm_ids;
select 'stage moves SQL checks: all passed';
