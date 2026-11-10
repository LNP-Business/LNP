-- 054_crm_setting.sql : le suivi du setter. Un lead entre (quiz, VSL, quiz abandonné, saisi à la main), le setter le fait avancer
-- par ses actions, iClosed le fait avancer seul (RDV réservé, absent, tenu, annulé) ; le setter ne voit que ses leads et reçoit
-- leurs alertes.
do $$
declare adm uuid := gen_random_uuid(); st uuid := gen_random_uuid(); rep uuid := gen_random_uuid();
        p1 uuid; p2 uuid; p3 uuid; p4 uuid; c2 uuid; k2 uuid; r jsonb; s text; n int; d timestamptz;
begin
  insert into auth.users (id, email) values (adm, 'se.adm@x.com'), (st, 'se.set@x.com'), (rep, 'se.rep@x.com');
  insert into members (user_id, email, role) values (adm, 'se.adm@x.com', 'admin'), (st, 'se.set@x.com', 'member'), (rep, 'se.rep@x.com', 'member');
  insert into crm_members (id, member_key, full_name, email, role) values (adm, 'seadm', 'Se Admin', 'se.adm@x.com', 'admin'),
    (st, 'seset', 'Se Setter', 'se.set@x.com', 'sales'), (rep, 'serep', 'Se Rep', 'se.rep@x.com', 'sales')
  on conflict (id) do update set role = excluded.role, full_name = excluded.full_name, active = true;
  s := crm_set_member_role(st, 'setter');
  assert s = 'setter' and (select role::text from crm_members where id = st) = 'setter', 'fonction setter';
  begin perform crm_set_member_role(adm, 'setter'); raise exception 'FAIL: un administrateur changé en setter'; exception when sqlstate 'P0002' then null; end;

  -- 1. un lead du quiz entre : setter attribué, « Lead à contacter », échéance dans une plage couverte + 5 min
  p1 := crm_lead_item('{"source_id":"funnel:q1","occurred_at":"2026-11-10T09:00:00Z","identity":{"email":"Lea.Quiz@x.com","name":"Léa Quiz","phone":"+33611110001"},"data":{"source":"quiz","answers":{"matiere":"SVT","objectif":"2000"}}}');
  select setting_status, setting_due_at into s, d from crm_people where id = p1;
  assert s = 'a_contacter' and (select setter_id from crm_people where id = p1) = st and (select quiz->>'matiere' from crm_people where id = p1) = 'SVT', 'lead à contacter';
  assert d = '2026-11-10T11:05:00Z'::timestamptz, 'lundi 10 h à Paris : couvert à 12 h, échéance 12 h 05 : ' || d;
  assert exists (select 1 from crm_events where person_id = p1 and type = 'lead_in'), 'événement lead_in';
  assert crm_lead_item('{"source_id":"funnel:q1","identity":{"email":"lea.quiz@x.com"},"data":{"source":"quiz"}}') = p1, 'reçu deux fois : un seul lead';

  -- 2. qui voit quoi
  perform set_config('request.jwt.claim.sub', st::text, true);
  assert (select count(*) from crm_people_without_cycle where id = p1) = 1, 'le setter voit son lead';
  perform set_config('request.jwt.claim.sub', rep::text, true);
  assert not crm_sees_person(p1), 'un commercial ne voit pas le lead du setter';
  begin perform crm_setter_action(p1, 'joint'); raise exception 'FAIL: action sur le lead d''un autre'; exception when sqlstate '42501' then null; end;

  -- 3. les actions du setter
  perform set_config('request.jwt.claim.sub', st::text, true);
  r := crm_setter_action(p1, 'appel_sans_reponse');
  assert r->>'status' = 'relance' and (r->>'attempts')::int = 1 and r->>'due_at' is not null, 'relance 1/6 : ' || r;
  r := crm_setter_action(p1, 'msg_relance', 'WhatsApp envoyé');
  assert r->>'status' = 'relance', 'message de relance : même statut';
  r := crm_setter_action(p1, 'joint');
  assert r->>'status' = 'qualification', 'joint : appel de qualification';
  r := crm_setter_action(p1, 'rdv_pose');
  assert r->>'status' = 'rdv_pose', 'RDV posé';
  begin perform crm_setter_action(p1, 'joint'); raise exception 'FAIL: joint après RDV posé'; exception when sqlstate '22023' then null; end;
  assert (select count(*) from crm_events where person_id = p1 and type = 'setter_action') = 5, 'chaque action dans le fil';
  assert (select setting_last_action from crm_people where id = p1) = 'RDV posé dans iClosed', 'dernière action';

  -- 4. iClosed : le RDV posé par le setter arrive, le statut reste « RDV posé » ; puis « OK » reçu
  insert into crm_cycles (person_id, owner_id, opened_at) values (p1, rep, now()) returning id into c2;
  insert into crm_calls (cycle_id, rank, scheduled_start, scheduled_end, status) values (c2, 1, now() + interval '2 days', now() + interval '2 days 45 minutes', 'scheduled');
  assert (select setting_status from crm_people where id = p1) = 'rdv_pose', 'réservation du RDV posé : reste RDV posé';
  r := crm_setter_action(p1, 'ok_recu');
  assert r->>'status' = 'rdv_confirme' and r->>'due_at' is null, 'RDV confirmé : rien à faire avant les rappels';

  -- 5. un RDV auto-booké (VSL) : à confirmer, message, appel, absent, rattrapage, tenu
  perform set_config('request.jwt.claim.sub', '', true);
  p2 := crm_lead_item('{"source_id":"funnel:v1","identity":{"email":"vsl@x.com","name":"Victor VSL"},"data":{"source":"vsl","booked":true}}');
  assert (select setting_status from crm_people where id = p2) is null, 'booké : pas « à contacter », iClosed dira la suite';
  insert into crm_cycles (person_id, owner_id, opened_at) values (p2, rep, now()) returning id into c2;
  insert into crm_calls (cycle_id, rank, scheduled_start, scheduled_end, status) values (c2, 1, now() + interval '1 day', now() + interval '1 day 45 minutes', 'scheduled') returning id into k2;
  assert (select setting_status from crm_people where id = p2) = 'rdv_a_confirmer', 'réservé seul : RDV à confirmer';
  perform set_config('request.jwt.claim.sub', st::text, true);
  assert (crm_setter_action(p2, 'msg_confirmation'))->>'status' = 'appel_confirmation', 'message de confirmation : appel de confirmation';
  assert (crm_setter_action(p2, 'confirmation_faite'))->>'status' = 'rdv_confirme', 'confirmé';
  assert crm_owns_cycle(c2), 'le setter voit le cycle de son lead';
  update crm_calls set status = 'no_show' where id = k2;
  assert (select setting_status from crm_people where id = p2) = 'absent_rattrapage', 'absent : rattrapage';
  update crm_calls set status = 'held' where id = k2;
  assert (select setting_status from crm_people where id = p2) = 'transmis' and (select setting_due_at from crm_people where id = p2) is null, 'tenu : au commercial';

  -- 6. quiz abandonné : 2 tentatives puis injoignable ; repris plus tard
  perform set_config('request.jwt.claim.sub', '', true);
  p3 := crm_lead_item('{"source_id":"funnel:a1","identity":{"phone":"+33611110003"},"data":{"source":"quiz_abandon"}}');
  perform set_config('request.jwt.claim.sub', st::text, true);
  perform crm_setter_action(p3, 'appel_sans_reponse');
  assert (crm_setter_action(p3, 'appel_sans_reponse'))->>'status' = 'injoignable', 'quiz abandonné : injoignable après 2 appels';
  assert (crm_setter_action(p3, 'relancer'))->>'status' = 'a_contacter', 'repris : à contacter';

  -- 7. saisie à la main par le setter
  p4 := crm_create_lead('Nina Main', '', '06 12 34 56 78', 'webinaire');
  assert (select setter_id from crm_people where id = p4) = st and (select lead_source from crm_people where id = p4) = 'webinaire'
     and (select setting_status from crm_people where id = p4) = 'a_contacter', 'saisi à la main : à contacter, au setter';

  -- 8. les alertes du setter : un lead sans cycle, adressée au setter
  perform set_config('request.jwt.claim.sub', '', true);
  assert jsonb_array_length(crm_setting_snapshot()) >= 2, 'les leads en cours';
  r := crm_sync_sla_alerts(jsonb_build_array(jsonb_build_object('key', 'p:' || p4 || ':SE-1:0', 'person_id', p4, 'owner_id', st, 'sla', 'SE-1',
    'level', 'late', 'name', 'Premier appel du setter', 'started_at', now(), 'crossed_at', now())));
  assert (r->>'opened')::int = 1, 'alerte du setter ouverte : ' || r;
  perform set_config('request.jwt.claim.sub', st::text, true);
  r := crm_sla_alerts_open();
  assert exists (select 1 from jsonb_array_elements(r->'alerts') x where x->>'sla' = 'SE-1' and x->>'person' = 'Nina Main'), 'le setter voit son alerte : ' || r;
  perform set_config('request.jwt.claim.sub', rep::text, true);
  assert not exists (select 1 from jsonb_array_elements(crm_sla_alerts_open()->'alerts') x where x->>'sla' = 'SE-1'), 'pas le commercial';
  perform set_config('request.jwt.claim.sub', '', true);
end $$;
select 'setting SQL checks: all passed';
