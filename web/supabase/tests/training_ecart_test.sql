-- 064_crm_training_ecart.sql: the results of Reformulation de l'écart (module « ecart », on 10, corrected by the code).
do $$
declare s uuid := gen_random_uuid(); refused boolean;
begin
  insert into auth.users (id, email) values (s, 'ecart.s@x.com');
  insert into members (user_id, email, role) values (s, 'ecart.s@x.com', 'member');
  insert into crm_members (id, member_key, full_name, email, role) values (s, 'ecarts', 'Ecart Test', 'ecart.s@x.com', 'sales')
  on conflict (id) do update set role = excluded.role, active = true;
  perform set_config('request.jwt.claim.sub', s::text, true);
  set local role authenticated;
  insert into crm_training_results (cid, module, case_id, score, max, mode, duration_s, details)
    values ('ecart-test-1', 'ecart', 'E1', 8.5, 10, 'regles', 240, '{"present": true}');
  assert (select count(*) from crm_training_results where module = 'ecart') = 1, 'a gap restitution is kept';
  refused := false; begin insert into crm_training_results (cid, module, case_id, score, max, mode) values ('ecart-test-2', 'ecart', 'E1', 3, 3, 'regles'); exception when others then refused := true; end;
  assert refused, 'a gap restitution is marked on 10';
  refused := false; begin insert into crm_training_results (cid, module, case_id, score, max, mode) values ('ecart-test-3', 'ecart', 'E1', 9, 10, 'claude'); exception when others then refused := true; end;
  assert refused, 'never a mark of Claude: the code corrects it';
  refused := false; begin insert into crm_training_results (cid, module, case_id, score, max, mode) values ('ecart-test-4', 'autre', 'E1', 9, 10, 'regles'); exception when others then refused := true; end;
  assert refused, 'no other module';
  reset role;
end $$;
select 'training ecart SQL checks: all passed';
