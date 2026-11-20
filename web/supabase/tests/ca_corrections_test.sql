-- 063_crm_ca_corrections.sql : un administrateur corrige la lettre d'une question ; chaque correction est gardée (C8).
do $$
declare adm uuid := gen_random_uuid(); rep uuid := gen_random_uuid(); pid uuid; cid uuid; k1 uuid; job uuid;
        r jsonb; c jsonb; ok boolean;
begin
  insert into auth.users (id, email) values (adm, 'corr.admin@x.com'), (rep, 'corr.rep@x.com');
  insert into members (user_id, email, role) values (adm, 'corr.admin@x.com', 'admin'), (rep, 'corr.rep@x.com', 'member');
  insert into crm_members (id, member_key, full_name, email, role) values (adm, 'coradm', 'Coach Admin', 'corr.admin@x.com', 'admin')
  on conflict (id) do update set role = 'admin', full_name = 'Coach Admin', active = true;
  update crm_members set role = 'sales' where id = rep;
  insert into crm_people (full_name) values ('Lettre Corrigée') returning id into pid;
  insert into crm_cycles (person_id, owner_id, opened_at) values (pid, rep, now() - interval '20 days') returning id into cid;
  insert into crm_calls (cycle_id, rank, scheduled_start, status) values (cid, 1, now() - interval '10 days', 'held') returning id into k1;
  insert into crm_ca_jobs (call_id, status) values (k1, 'done') returning id into job;
  insert into crm_ca_records (job_id, call_id, status, flags, phases, meta) values (job, k1, 'ok', '[]', '{}', '{}');
  insert into crm_ca_results (job_id, call_id, competence, rules_version, status, score, details)
  values (job, k1, 'SPIN', 'SPIN-1.3', 'scored', 40,
          '{"solicitations": [{"id": "Q005.1", "letter": "S"}, {"id": "Q009.1", "letter": null, "out_reason": "agreement"}]}');

  -- a sales person cannot correct, even on their own call
  perform set_config('request.jwt.claim.sub', rep::text, true);
  ok := false;
  begin perform crm_ca_correct(job, 'Q005.1', 'P'); exception when insufficient_privilege then ok := true; end;
  assert ok, 'un commercial ne corrige pas';

  -- the admin corrects: the engine's letter is kept beside the person's
  perform set_config('request.jwt.claim.sub', adm::text, true);
  c := crm_ca_correct(job, 'Q005.1', 'P', '  la question demande la difficulté  ');
  assert c->>'engine_value' = 'S' and c->>'value' = 'P' and c->>'note' = 'la question demande la difficulté', 'correction : ' || c::text;
  c := crm_ca_correct(job, 'Q009.1', 'N');
  assert c->>'engine_value' = 'OUT', 'hors découverte : ' || c::text;
  ok := false;
  begin perform crm_ca_correct(job, 'Q005.1', 'X'); exception when invalid_parameter_value then ok := true; end;
  assert ok, 'lettre inconnue refusée';
  ok := false;
  begin perform crm_ca_correct(job, 'Q999.1', 'S'); exception when no_data_found then ok := true; end;
  assert ok, 'question inconnue refusée';

  -- the record carries the corrections, newest first, with the author's name; only an admin may correct
  r := crm_ca_record(job);
  assert jsonb_array_length(r->'corrections') = 2 and r->'corrections'->0->>'unit_id' = 'Q009.1'
     and r->'corrections'->1->>'author' = 'Coach Admin' and (r->>'can_correct')::boolean, 'record : ' || (r->'corrections')::text;
  assert (select score from crm_ca_results where job_id = job and competence = 'SPIN') = 40, 'la note ne change pas (C8)';
  perform set_config('request.jwt.claim.sub', rep::text, true);
  r := crm_ca_record(job);
  assert jsonb_array_length(r->'corrections') = 2 and not (r->>'can_correct')::boolean, 'le commercial lit les corrections';
  perform set_config('request.jwt.claim.sub', '', true);

  -- additions only: nobody writes the table directly
  assert not has_table_privilege('authenticated', 'crm_ca_corrections', 'insert')
     and not has_table_privilege('authenticated', 'crm_ca_corrections', 'update')
     and not has_table_privilege('authenticated', 'crm_ca_corrections', 'delete'), 'ajout seulement, par la fonction';
end $$;
select 'analyse : corrections des lettres SQL checks: all passed';
