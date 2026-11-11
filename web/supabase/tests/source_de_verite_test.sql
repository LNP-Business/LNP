-- 059_crm_source_de_verite.sql : iClosed ne donne que le lead, la date des RDV et un montant pour information ; le statut est
-- celui du CRM. Webinaire : le setter seulement si présent sans RDV, ou absent sans réponse (48 h au webinaire, 24 h au RDV).
do $$
declare r jsonb; pid uuid; cid uuid; p1 uuid; p2 uuid; p3 uuid; p4 uuid; s text; st uuid := gen_random_uuid(); n int;
begin
  -- 1. un appel passé qu'iClosed donne « tenu » puis une clôture « perdu » : le CRM garde l'appel, sans issue ni clôture
  r := crm_import_calls('[
    {"name":"Sv One","identity":{"email":["sv.one@x.com"]},"calls":[
      {"iclosed_call_id":"sv-c1","booked_at":"2026-11-01T09:00:00Z","start":"2026-11-02T10:00:00Z","end":"2026-11-02T10:45:00Z","status":"held","data":{}},
      {"iclosed_call_id":"sv-c2","booked_at":"2026-11-03T09:00:00Z","start":"2026-11-04T10:00:00Z","end":"2026-11-04T10:45:00Z","status":"no_show","data":{}},
      {"iclosed_call_id":"sv-c3","booked_at":"2026-11-05T09:00:00Z","start":"2026-11-06T10:00:00Z","end":"2026-11-06T10:45:00Z","status":"canceled","canceled_at":"2026-11-05T12:00:00Z","data":{}}],
     "close":{"status":"lost","reason":"timing","at":"2026-11-06T10:00:00Z"}}]', false);
  select person_id into pid from crm_person_identities where value = 'sv.one@x.com';
  select id into cid from crm_cycles where person_id = pid;
  assert (r->>'calls')::int = 3, 'trois appels : ' || r;
  assert (select status::text from crm_cycles where id = cid) = 'active', 'iClosed ne clôt jamais un cycle';
  assert not exists (select 1 from crm_events where cycle_id = cid and type in ('outcome_held', 'outcome_no_show', 'cycle_lost', 'cycle_won', 'cycle_disqualified')),
    'aucune issue ni clôture venue d''iClosed';
  assert (select string_agg(status::text, ',' order by scheduled_start) from crm_calls where cycle_id = cid) in ('scheduled,scheduled,canceled'),
    'dates gardées, annulation gardée, tenu et absent ignorés : ' || (select string_agg(status::text, ',' order by scheduled_start) from crm_calls where cycle_id = cid);
  assert exists (select 1 from crm_events where cycle_id = cid and type = 'call_canceled'), 'l''annulation est une date d''agenda : gardée';

  -- 2. une vente iClosed : un montant pour information, ni paiement, ni « Gagné »
  r := crm_import_deals('[{"iclosed_deal_id":"sv-d1","iclosed_call_id":"sv-c1","type":"WON","value":"3000","product":"LNP 3000","at":"2026-11-02T11:00:00Z"}]', false);
  assert (r->>'new')::int = 1 and (r->>'info_only')::boolean, 'compté : ' || r;
  assert not exists (select 1 from crm_payments where cycle_id = cid), 'aucun paiement iClosed';
  assert not exists (select 1 from crm_deals where cycle_id = cid), 'aucune vente déclarée par iClosed';
  assert (select status::text from crm_cycles where id = cid) = 'active', 'pas gagné';
  assert (select content from crm_events where cycle_id = cid and type = 'iclosed_deal') like 'iClosed (pour information) : vente de 3%000 € · LNP 3000%',
    'le montant dans la fiche : ' || (select content from crm_events where cycle_id = cid and type = 'iclosed_deal');
  perform crm_import_deals('[{"iclosed_deal_id":"sv-d1","iclosed_call_id":"sv-c1","type":"WON","value":"3000","at":"2026-11-02T11:00:00Z"}]', false);
  assert (select count(*) from crm_events where cycle_id = cid and type = 'iclosed_deal') = 1, 'rejoué : une seule information';
  assert not exists (select 1 from jsonb_array_elements(crm_sla_snapshot(60)) c, jsonb_array_elements(c->'events') e
                      where (c->>'id')::uuid = cid and e->>'type' = 'iclosed_deal'), 'l''information n''entre pas dans les alertes';

  -- 3. webinaire : présent sans RDV → setter ; absent → attente 48 h ; RDV pris → commercial seulement
  insert into auth.users (id, email) values (st, 'sv.set@x.com');
  insert into members (user_id, email, role) values (st, 'sv.set@x.com', 'member');
  insert into crm_members (id, member_key, full_name, email, role) values (st, 'svset', 'Sv Setter', 'sv.set@x.com', 'setter')
  on conflict (id) do update set role = 'setter', active = true;
  update crm_settings set value = value || jsonb_build_object('default_setter', st) where key = 'setting';
  p1 := crm_lead_item('{"source_id":"funnel:sv-w1","occurred_at":"2026-11-10T18:00:00Z","identity":{"email":"sv.w1@x.com","name":"W Présent"},"data":{"source":"webinaire","attended":true}}');
  assert (select setting_status from crm_people where id = p1) = 'a_contacter' and (select setter_id from crm_people where id = p1) is not null,
    'présent au webinaire sans RDV : au setter';
  p2 := crm_lead_item('{"source_id":"funnel:sv-w2","occurred_at":"2026-11-10T18:00:00Z","identity":{"email":"sv.w2@x.com","name":"W Absent"},"data":{"source":"webinaire","attended":false}}');
  assert (select setting_status from crm_people where id = p2) = 'webinaire_absent' and (select setter_id from crm_people where id = p2) is null,
    'absent au webinaire : en attente, sans setter';
  assert (select setting_due_at from crm_people where id = p2) = '2026-11-12T18:00:00Z'::timestamptz, 'attente de 48 h';
  p3 := crm_lead_item('{"source_id":"funnel:sv-w3","occurred_at":"2026-11-10T18:00:00Z","identity":{"email":"sv.w3@x.com","name":"W RDV"},"data":{"source":"webinaire","attended":true,"booked":true}}');
  assert (select setting_status from crm_people where id = p3) is null and (select setter_id from crm_people where id = p3) is null,
    'RDV pris au webinaire : le commercial seulement';
  p4 := crm_lead_item('{"source_id":"funnel:sv-w4","occurred_at":"2026-11-10T18:00:00Z","identity":{"email":"sv.w4@x.com","name":"W Répond"},"data":{"source":"webinaire","attended":false}}');
  insert into crm_events (person_id, occurred_at, actor, channel, type, source, source_id)
  values (p4, '2026-11-11T09:00:00Z', 'prospect', 'whatsapp', 'message_in', 'whatsapp', 'sv-msg-4');

  -- 4. le passage au setter : sans réponse après 48 h ; une réponse le laisse hors du setter
  r := crm_setting_tick('2026-11-11T18:00:00Z');
  assert (select setting_status from crm_people where id = p2) = 'webinaire_absent', 'avant 48 h : toujours en attente';
  assert (select setting_status from crm_people where id = p4) is null, 'a répondu : pas au setter';
  r := crm_setting_tick('2026-11-12T18:05:00Z');
  assert (select setting_status from crm_people where id = p2) = 'a_contacter' and (select setter_id from crm_people where id = p2) = st,
    'absent au webinaire et sans réponse en 48 h : au setter ' || r;

  -- 5. lead webinaire avec un RDV de vente : réservé seul, pas de « RDV à confirmer » ; absent → attente 24 h puis setter
  insert into crm_cycles (person_id, opened_at) values (p3, now()) returning id into cid;
  insert into crm_calls (cycle_id, rank, iclosed_call_id, scheduled_start, scheduled_end, status)
  values (cid, 1, 'sv-w3-call', now() + interval '1 day', now() + interval '1 day 45 minutes', 'scheduled');
  assert (select setting_status from crm_people where id = p3) is null, 'RDV de vente webinaire : pas de confirmation par le setter';
  update crm_calls set status = 'no_show' where iclosed_call_id = 'sv-w3-call';
  assert (select setting_status from crm_people where id = p3) = 'absent_attente', 'absent au RDV : attente d''une réponse';
  update crm_people set setting_since = now() - interval '25 hours' where id = p3;
  perform crm_setting_tick(now());
  assert (select setting_status from crm_people where id = p3) = 'absent_rattrapage' and (select setter_id from crm_people where id = p3) is not null,
    'absent au RDV sans réponse en 24 h : le setter rattrape';

  -- 6. un lead quiz garde ses règles : absent au RDV → le setter rattrape tout de suite
  p1 := crm_lead_item('{"source_id":"funnel:sv-q1","occurred_at":"2026-11-10T09:00:00Z","identity":{"email":"sv.q1@x.com","name":"Q"},"data":{"source":"quiz"}}');
  insert into crm_cycles (person_id, opened_at) values (p1, now()) returning id into cid;
  insert into crm_calls (cycle_id, rank, iclosed_call_id, scheduled_start, scheduled_end, status)
  values (cid, 1, 'sv-q1-call', now() + interval '1 day', now() + interval '1 day 45 minutes', 'scheduled');
  update crm_calls set status = 'no_show' where iclosed_call_id = 'sv-q1-call';
  assert (select setting_status from crm_people where id = p1) = 'absent_rattrapage', 'quiz : rattrapage immédiat';
end $$;
select 'source de vérité SQL checks: all passed';
