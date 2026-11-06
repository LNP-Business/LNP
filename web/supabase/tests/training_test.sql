-- 049_crm_training.sql: Maîtrise de l'offre progress (own row, the trainer reads all), the training results (append only,
-- own rows, never a Claude mark from the browser) and the training dashboard (own row; an admin sees everyone).
create temp table acy (k text primary key, v uuid);
grant select on acy to authenticated;
do $$
declare adm uuid := gen_random_uuid(); s1 uuid := gen_random_uuid(); s2 uuid := gen_random_uuid(); pid uuid; cyc uuid;
begin
  insert into auth.users (id, email) values (adm, 'acy.adm@x.com'), (s1, 'acy.s1@x.com'), (s2, 'acy.s2@x.com');
  insert into members (user_id, email, role) values (adm, 'acy.adm@x.com', 'admin'), (s1, 'acy.s1@x.com', 'member'), (s2, 'acy.s2@x.com', 'member');
  insert into crm_members (id, member_key, full_name, email, role) values
    (adm, 'acyadm', 'Acy Admin', 'acy.adm@x.com', 'admin'), (s1, 'acys1', 'Acy Un', 'acy.s1@x.com', 'sales'), (s2, 'acys2', 'Acy Deux', 'acy.s2@x.com', 'sales')
  on conflict (id) do update set role = excluded.role, full_name = excluded.full_name, active = true;
  insert into acy values ('adm', adm), ('s1', s1), ('s2', s2);
  -- s1 held two calls and sold 3 000 € in the last week
  insert into crm_people (full_name) values ('Lead Acy') returning id into pid;
  insert into crm_cycles (person_id, owner_id, opened_at) values (pid, s1, now() - interval '6 days') returning id into cyc;
  insert into crm_calls (cycle_id, rank, scheduled_start, scheduled_end, status) values
    (cyc, 1, now() - interval '5 days', now() - interval '5 days' + interval '45 minutes', 'held'),
    (cyc, 2, now() - interval '3 days', now() - interval '3 days' + interval '45 minutes', 'held');
  insert into crm_deals (cycle_id, product, amount_sold, currency, yes_at) values (cyc, 'Accompagnement 4 mois', 3000, 'EUR', now() - interval '3 days');
  update crm_cycles set status = 'won', closed_at = now() - interval '3 days' where id = cyc;
end $$;
set role authenticated;
do $$
declare ids jsonb := (select jsonb_object_agg(k, v) from acy); refused boolean; d jsonb; p jsonb; n int;
begin
  -- the progress of Maîtrise de l'offre
  perform set_config('request.jwt.claim.sub', ids->>'s1', true);
  insert into crm_academy_progress (exos) values ('{"A1": {"best": 6.5, "last": 6.5, "tries": 1, "at": "2026-11-06T10:00:00Z"}}');
  perform set_config('request.jwt.claim.sub', ids->>'s2', true);
  insert into crm_academy_progress (exos) values ('{"B1": {"best": 9, "last": 9, "tries": 1}}');
  assert (select count(*) from crm_academy_progress) = 1, 'a sales rep sees only their own row';
  update crm_academy_progress set exos = '{}' where user_id = (ids->>'s1')::uuid;
  perform set_config('request.jwt.claim.sub', ids->>'s1', true);
  assert (select exos->'A1'->>'best' from crm_academy_progress) = '6.5', 'nobody else can change it';
  refused := false; begin insert into crm_academy_progress (user_id, exos) values ((ids->>'s2')::uuid, '{}'); exception when others then refused := true; end;
  assert refused, 'no row for someone else';

  -- the results: s1 plays 10 coups (8 justes), 2 cases of La lettre imposée (3 + 2) and two attempts on A1 (5, then 9)
  insert into crm_training_results (cid, module, case_id, score, max, mode, duration_s)
  select 'coup-test-' || i, 'coup', i::text, case when i <= 8 then 1 else 0 end, 1, 'regles', 40 from generate_series(1, 10) i;
  insert into crm_training_results (cid, module, case_id, score, max, mode, duration_s, details) values
    ('lettre-test-1', 'lettre', '1', 3, 3, 'regles', 120, '{"liens": [true, true, true]}'),
    ('lettre-test-2', 'lettre', '2', 2, 3, 'regles', 100, '{}'),
    ('acad-test-1', 'academie', 'A1', 5, 10, 'auto', 200, '{}'),
    ('acad-test-2', 'academie', 'A1', 9, 10, 'auto', 140, '{}');
  -- the same result sent twice is kept once
  refused := false; begin insert into crm_training_results (cid, module, case_id, score, max, mode) values ('coup-test-1', 'coup', '1', 1, 1, 'regles'); exception when unique_violation then refused := true; end;
  assert refused, 'a result sent twice is refused';
  -- never a mark by Claude from the browser, never for someone else, never a score above the maximum
  refused := false; begin insert into crm_training_results (cid, module, case_id, score, max, mode) values ('acad-test-3', 'academie', 'A2', 10, 10, 'claude'); exception when others then refused := true; end;
  assert refused, 'a mark by Claude only comes from the server';
  refused := false; begin insert into crm_training_results (user_id, cid, module, case_id, score, max, mode) values ((ids->>'s2')::uuid, 'coup-test-x', 'coup', '1', 1, 1, 'regles'); exception when others then refused := true; end;
  assert refused, 'no result for someone else';
  refused := false; begin insert into crm_training_results (cid, module, case_id, score, max, mode) values ('coup-test-y', 'coup', '1', 2, 1, 'regles'); exception when others then refused := true; end;
  assert refused, 'no score above the maximum';
  refused := false; begin insert into crm_training_results (cid, module, case_id, score, max, mode) values ('coup-test-z', 'coup', '1', 1, 1, 'auto'); exception when others then refused := true; end;
  assert refused, 'Découverte is marked by its rules';
  -- results are never changed nor deleted
  refused := false; begin update crm_training_results set score = 1 where cid = 'coup-test-9'; exception when others then refused := true; end;
  assert refused, 'no one changes a result';
  refused := false; begin delete from crm_training_results where cid = 'coup-test-10'; exception when others then refused := true; end;
  assert refused, 'no one deletes their results';
  assert (select count(*) from crm_training_results) = 14, 'nothing deleted';
  assert (select score from crm_training_results where cid = 'coup-test-9') = 0, 'nothing changed';

  -- the dashboard, for s1: only their own row
  d := crm_training_dashboard(30);
  assert jsonb_array_length(d->'people') = 1 and (d->'people'->0->>'me')::boolean, 'a sales rep sees only their own figures: ' || d::text;
  p := d->'people'->0;
  -- coup 8/50 = 16, lettre 5/60 = 8, académie 9/1000 = 1 → (16 + 8.3 + 0.9) / 3 = 8
  assert (p->'parts'->>'coup')::int = 16 and (p->'parts'->>'lettre')::int = 8 and (p->'parts'->>'academie')::int = 1, 'parts: ' || p::text;
  assert (p->>'score')::int = 8, 'score: ' || p::text;
  assert (p #>> '{academie,validated}')::int = 1 and (p #>> '{academie,tried}')::int = 1, 'A1 validated at 9';
  assert (p #>> '{period,n}')::int = 14 and (p #>> '{period,time_s}')::int = 400 + 220 + 340, 'exercises and time: ' || (p->'period')::text;
  assert (p #>> '{period,modules,coup,ok}')::int = 80, '80 % of coups justes';
  assert (p #>> '{sales,calls}')::int = 2 and (p #>> '{sales,won}')::int = 1 and (p #>> '{sales,signed}')::numeric = 3000, 'sales: ' || (p->'sales')::text;

  perform set_config('request.jwt.claim.sub', ids->>'s2', true);
  assert not exists (select 1 from crm_training_results), 's2 does not read s1''s results';
  d := crm_training_dashboard(7);
  assert jsonb_array_length(d->'people') = 1 and (d->'people'->0->>'score')::int = 0, 'nothing done yet: 0';

  perform set_config('request.jwt.claim.sub', ids->>'adm', true);
  assert (select count(*) from crm_academy_progress where user_id in ((ids->>'s1')::uuid, (ids->>'s2')::uuid)) = 2, 'the trainer reads everyone';
  assert not exists (select 1 from crm_academy_corrections), 'the corrections log is closed to the browser';
  assert (select count(*) from crm_training_results where user_id = (ids->>'s1')::uuid) = 14, 'an admin reads everyone''s results';
  d := crm_training_dashboard(0);
  assert (d->>'admin')::boolean and jsonb_array_length(d->'people') >= 3, 'an admin sees the team: ' || d::text;
  select count(*) into n from jsonb_array_elements(d->'people') x where x->>'name' in ('Acy Un', 'Acy Deux', 'Acy Admin');
  assert n = 3, 'the two sales reps and the admin';
  perform set_config('request.jwt.claim.sub', '', true);
end $$;
reset role;
-- not even the service deletes a result
do $$ declare refused boolean := false; begin
  begin delete from crm_training_results; exception when others then refused := true; end;
  assert refused, 'no one deletes a result';
  refused := false; begin truncate crm_training_results; exception when others then refused := true; end;
  assert refused, 'no one empties the results';
end $$;
drop table acy;
select 'training SQL checks: all passed';
