-- 053_crm_alertes.sql : le centre d'alertes du CRM. Une alerte s'ouvre, monte de niveau, se ferme seule ; un commercial ne voit
-- que les alertes de ses cycles (jamais les techniques), un administrateur voit tout.
do $$
declare adm uuid := gen_random_uuid(); r1 uuid := gen_random_uuid(); r2 uuid := gen_random_uuid(); p1 uuid; p2 uuid; c1 uuid; c2 uuid;
        r jsonb; n int;
begin
  insert into auth.users (id, email) values (adm, 'al.adm@x.com'), (r1, 'al.r1@x.com'), (r2, 'al.r2@x.com');
  insert into members (user_id, email, role) values (adm, 'al.adm@x.com', 'admin'), (r1, 'al.r1@x.com', 'member'), (r2, 'al.r2@x.com', 'member');
  insert into crm_members (id, member_key, full_name, email, role) values (adm, 'aladm', 'Al Admin', 'al.adm@x.com', 'admin'),
    (r1, 'alr1', 'Al Un', 'al.r1@x.com', 'sales'), (r2, 'alr2', 'Al Deux', 'al.r2@x.com', 'sales')
  on conflict (id) do update set role = excluded.role, full_name = excluded.full_name, active = true;
  insert into crm_people (full_name) values ('Prospect Alerte Un') returning id into p1;
  insert into crm_people (full_name) values ('Prospect Alerte Deux') returning id into p2;
  insert into crm_cycles (person_id, owner_id, opened_at) values (p1, r1, now() - interval '2 hours') returning id into c1;
  insert into crm_cycles (person_id, owner_id, opened_at) values (p2, r2, now() - interval '2 hours') returning id into c2;

  r := crm_sync_sla_alerts(jsonb_build_array(
    jsonb_build_object('key', c1 || ':SH-2:0', 'cycle_id', c1, 'sla', 'SH-2', 'kind', 'sales', 'level', 'late', 'name', 'Premier contact du commercial',
      'detail', 'depuis la prise de RDV', 'target', '5 min', 'started_at', now() - interval '2 hours', 'crossed_at', now() - interval '105 minutes'),
    jsonb_build_object('key', c2 || ':SH-11:30', 'cycle_id', c2, 'sla', 'SH-11', 'kind', 'sales', 'level', 'warn', 'name', 'Issue déclarée',
      'started_at', now() - interval '20 minutes', 'crossed_at', now() - interval '10 minutes'),
    jsonb_build_object('key', c2 || ':CO-5:0', 'cycle_id', c2, 'sla', 'CO-5', 'kind', 'tech', 'level', 'crit', 'name', 'Heures d’envoi automatique',
      'started_at', now() - interval '2 hours', 'crossed_at', now() - interval '1 hour')));
  assert (r->>'opened')::int = 3, 'trois alertes ouvertes : ' || r;
  -- rejoué : rien de neuf ; SH-11 monte en retard
  r := crm_sync_sla_alerts(jsonb_build_array(
    jsonb_build_object('key', c1 || ':SH-2:0', 'cycle_id', c1, 'sla', 'SH-2', 'level', 'late', 'name', 'x', 'started_at', now(), 'crossed_at', now()),
    jsonb_build_object('key', c2 || ':SH-11:30', 'cycle_id', c2, 'sla', 'SH-11', 'level', 'late', 'name', 'x', 'started_at', now(), 'crossed_at', now()),
    jsonb_build_object('key', c2 || ':CO-5:0', 'cycle_id', c2, 'sla', 'CO-5', 'kind', 'tech', 'level', 'crit', 'name', 'x', 'started_at', now(), 'crossed_at', now())));
  assert (r->>'opened')::int = 0 and (r->>'updated')::int = 1 and (select level from crm_sla_alerts where key = c2 || ':SH-11:30') = 'late', 'niveau monté : ' || r;
  assert (select owner_id from crm_sla_alerts where key = c1 || ':SH-2:0') = r1, 'alerte au commercial du cycle';

  -- ce que chacun voit
  perform set_config('request.jwt.claim.sub', r1::text, true);
  r := crm_sla_alerts_open();
  assert jsonb_array_length(r->'alerts') = 1 and r->'alerts'->0->>'sla' = 'SH-2' and r->'alerts'->0->>'person' = 'Prospect Alerte Un'
     and not (r->>'sees_all')::boolean, 'le commercial 1 ne voit que la sienne : ' || r;
  perform set_config('request.jwt.claim.sub', r2::text, true);
  r := crm_sla_alerts_open();
  assert jsonb_array_length(r->'alerts') = 1 and r->'alerts'->0->>'sla' = 'SH-11', 'le commercial 2 ne voit pas l''alerte technique : ' || r;
  perform set_config('request.jwt.claim.sub', adm::text, true);
  r := crm_sla_alerts_open();
  assert jsonb_array_length(r->'alerts') = 3 and (r->>'sees_all')::boolean and r->'alerts'->0->>'level' = 'crit', 'l''administrateur voit tout, critique d''abord : ' || r;
  assert jsonb_array_length(crm_sla_alerts_open(r1)->'alerts') = 1, 'filtre par commercial';

  -- l'action est faite (SH-2 n'est plus dans la liste) ; le cycle 2 est perdu
  update crm_cycles set status = 'lost', closed_at = now() where id = c2;
  r := crm_sync_sla_alerts(jsonb_build_array(
    jsonb_build_object('key', c2 || ':SH-11:30', 'cycle_id', c2, 'sla', 'SH-11', 'level', 'late', 'name', 'x', 'started_at', now(), 'crossed_at', now())));
  assert (select resolution from crm_sla_alerts where key = c1 || ':SH-2:0') = 'done', 'SH-2 fermée : action faite';
  assert (select count(*) from crm_sla_alerts where cycle_id = c2 and resolved_at is null) = 0, 'cycle terminé : alertes fermées';
  assert (crm_sla_alerts_open()->>'closed_today')::int = 3, 'trois fermées aujourd''hui';
  -- une alerte fermée qui revient (nouveau départ) s'ouvre à nouveau
  r := crm_sync_sla_alerts(jsonb_build_array(
    jsonb_build_object('key', c1 || ':SH-2:0', 'cycle_id', c1, 'sla', 'SH-2', 'level', 'crit', 'name', 'x', 'started_at', now(), 'crossed_at', now())));
  assert (r->>'opened')::int = 1, 'rouverte : ' || r;
  perform set_config('request.jwt.claim.sub', '', true);
  begin perform crm_sla_alerts_open(); raise exception 'FAIL: sans rôle'; exception when sqlstate '42501' then null; end;
end $$;
select 'alertes SQL checks: all passed';
