-- 062_crm_ca_board_rounds.sql : la fiche (crm_ca_board) liste et numérote les appels comme l'analyse (crm_ca_call_info).
-- Cas réel : deux absences puis un R1 honoré et enregistré par Fathom, analysé ; il doit apparaître en R1 avec son analyse.
do $$
declare adm uuid := gen_random_uuid(); pid uuid; cid uuid; n1 uuid; n2 uuid; k1 uuid; k2 uuid; ob uuid; job uuid;
        pid2 uuid; cid2 uuid; m1 uuid; m2 uuid; m3 uuid; b jsonb; x jsonb; info jsonb;
begin
  insert into auth.users (id, email) values (adm, 'rounds.admin@x.com');
  insert into members (user_id, email, role) values (adm, 'rounds.admin@x.com', 'admin');
  insert into crm_members (id, member_key, full_name, email, role) values (adm, 'rndadm', 'Rounds Admin', 'rounds.admin@x.com', 'admin')
  on conflict (id) do update set role = 'admin', active = true;

  -- un cycle enregistré par Fathom : deux absences, le R1 honoré et analysé, un R2 (enregistrements de 40 et 45 min : le rang
  -- avance après un appel complet, 030), un appel d'accueil non enregistré
  insert into crm_people (full_name) values ('Trois Rendez-vous') returning id into pid;
  insert into crm_cycles (person_id, owner_id, opened_at) values (pid, adm, now() - interval '40 days') returning id into cid;
  insert into crm_calls (cycle_id, rank, scheduled_start, status) values (cid, 1, now() - interval '30 days', 'no_show') returning id into n1;
  insert into crm_calls (cycle_id, rank, scheduled_start, status) values (cid, 1, now() - interval '20 days', 'no_show') returning id into n2;
  insert into crm_calls (cycle_id, rank, scheduled_start, status, recorded_by, recording_start, recording_end) values (cid, 1, now() - interval '10 days', 'held', 'emma@x.com', now() - interval '10 days', now() - interval '10 days' + interval '40 minutes') returning id into k1;
  insert into crm_calls (cycle_id, rank, scheduled_start, status, recorded_by, recording_start, recording_end) values (cid, 2, now() - interval '5 days', 'held', 'emma@x.com', now() - interval '5 days', now() - interval '5 days' + interval '45 minutes') returning id into k2;
  insert into crm_calls (cycle_id, rank, scheduled_start, status) values (cid, 3, now() - interval '2 days', 'held') returning id into ob;
  insert into crm_ca_jobs (call_id, status) values (k1, 'done') returning id into job;
  insert into crm_ca_records (job_id, call_id, status, flags, phases, meta) values (job, k1, 'ok', '[]', '{}', '{}');

  -- un cycle sans Fathom : on compte les appels de vente non annulés (règle inchangée)
  insert into crm_people (full_name) values ('Sans Fathom') returning id into pid2;
  insert into crm_cycles (person_id, owner_id, opened_at) values (pid2, adm, now() - interval '20 days') returning id into cid2;
  insert into crm_calls (cycle_id, rank, scheduled_start, status) values (cid2, 1, now() - interval '15 days', 'canceled') returning id into m1;
  insert into crm_calls (cycle_id, rank, scheduled_start, status) values (cid2, 1, now() - interval '10 days', 'held') returning id into m2;
  insert into crm_calls (cycle_id, rank, scheduled_start, status) values (cid2, 2, now() - interval '5 days', 'held') returning id into m3;

  perform set_config('request.jwt.claim.sub', adm::text, true);
  b := crm_ca_board();

  -- Fathom : le R1 honoré est listé en R1, avec son analyse ; le R2 en R2 ; ni les absences ni l'appel non enregistré
  select y into x from jsonb_array_elements(b) y where y->>'call_id' = k1::text;
  assert x is not null and (x->>'round')::int = 1 and x->>'done_job' = job::text, 'R1 analysé visible : ' || coalesce(x::text, 'absent');
  select y into x from jsonb_array_elements(b) y where y->>'call_id' = k2::text;
  assert x is not null and (x->>'round')::int = 2, 'R2 : ' || coalesce(x::text, 'absent');
  assert not exists (select 1 from jsonb_array_elements(b) y where y->>'call_id' in (n1::text, n2::text, ob::text)), 'absences et appel non enregistré écartés';

  -- sans Fathom : l'annulé ne compte pas, R1 puis R2
  select y into x from jsonb_array_elements(b) y where y->>'call_id' = m2::text;
  assert (x->>'round')::int = 1, 'sans Fathom, R1 : ' || coalesce(x::text, 'absent');
  select y into x from jsonb_array_elements(b) y where y->>'call_id' = m3::text;
  assert (x->>'round')::int = 2, 'sans Fathom, R2 : ' || coalesce(x::text, 'absent');

  -- la fiche et l'analyse sont d'accord : chaque appel listé est un appel analysable, avec le même numéro
  for x in select y from jsonb_array_elements(b) y where y->>'cycle_id' in (cid::text, cid2::text) loop
    info := crm_ca_call_info((x->>'call_id')::uuid);
    assert (info->>'eligible')::boolean and (info->>'sales_round')::int = (x->>'round')::int, 'même règle que l''analyse : ' || info::text;
  end loop;
  perform set_config('request.jwt.claim.sub', '', true);
end $$;
select 'fiche : numéros des appels SQL checks: all passed';
