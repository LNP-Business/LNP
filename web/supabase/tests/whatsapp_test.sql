-- 052_crm_whatsapp.sql: WhatsApp à la place de Sendblue. Le numéro WhatsApp Business d'une personne de l'équipe rattache ses
-- messages ; un message vu d'abord par son statut (envoyé par l'API) devient « commercial » quand l'application le renvoie ;
-- un numéro inconnu devient un prospect ; STOP est retenu.
do $$
declare rep uuid := gen_random_uuid(); other uuid := gen_random_uuid(); inbox bigint; e record; pid uuid; n text;
begin
  insert into auth.users (id, email) values (rep, 'wa.rep@x.com'), (other, 'wa.other@x.com');
  insert into members (user_id, email, role) values (rep, 'wa.rep@x.com', 'member'), (other, 'wa.other@x.com', 'member');
  insert into crm_members (id, member_key, full_name, email, role) values (rep, 'warep', 'Wa Rep', 'wa.rep@x.com', 'sales'), (other, 'waother', 'Wa Other', 'wa.other@x.com', 'sales')
  on conflict (id) do update set role = excluded.role, full_name = excluded.full_name, active = true;
  -- le numéro : écrit librement, gardé au format international ; refusé s'il est invalide ou déjà pris
  n := crm_set_member_whatsapp(rep, '+33 6 12 34 56 78');
  assert n = '+33612345678' and (select whatsapp_number from crm_members where id = rep) = '+33612345678', 'numéro normalisé : ' || coalesce(n, 'null');
  assert crm_set_member_whatsapp(other, '0033 7 00 00 00 01') = '+33700000001', 'indicatif 00';
  begin perform crm_set_member_whatsapp(other, '06 12'); raise exception 'FAIL: numéro invalide accepté'; exception when sqlstate '22023' then null; end;
  begin perform crm_set_member_whatsapp(other, '+33612345678'); raise exception 'FAIL: numéro pris deux fois'; exception when sqlstate '23505' then null; end;
  n := crm_set_member_whatsapp(other, '');
  assert n is null and (select whatsapp_number from crm_members where id = other) is null, 'numéro effacé';

  insert into crm_webhook_log (source, headers, body, auth_ok) values ('whatsapp', '{}', '{}', true) returning id into inbox;
  -- un message reçu d'un numéro inconnu : un nouveau prospect, avec le nom de son profil WhatsApp
  assert crm_apply_messages(inbox, '[{"source":"whatsapp","type":"message_in","source_id":"whatsapp:wamid.A","occurred_at":"2026-11-09T09:00:00Z","actor":"prospect","channel":"whatsapp","content":"Bonjour","identity":{"phone":"+33655555555","name":"Léa Prospect"},"data":{"wamid":"wamid.A","line":"+33612345678"}}]') = 'processed', 'message reçu';
  select person_id into pid from crm_events where source = 'whatsapp' and source_id = 'whatsapp:wamid.A';
  assert (select full_name from crm_people where id = pid) = 'Léa Prospect', 'prospect créé avec son nom';
  -- d'abord le seul statut (automatique), puis l'écho de l'application : un seul message, du commercial, rattaché à lui
  perform crm_apply_messages(inbox, '[{"source":"whatsapp","type":"message_out","source_id":"whatsapp:wamid.B","occurred_at":"2026-11-09T09:05:00Z","actor":"auto","channel":"whatsapp","content":"","identity":{"phone":"+33655555555"},"data":{"wamid":"wamid.B","line":"+33612345678","status":"sent"}}]');
  perform crm_apply_messages(inbox, '[{"source":"whatsapp","type":"message_out","source_id":"whatsapp:wamid.B","occurred_at":"2026-11-09T09:04:30Z","actor":"sales","channel":"whatsapp","content":"Merci, à demain !","identity":{"phone":"+33655555555"},"data":{"wamid":"wamid.B","line":"+33612345678","status":"sent"}}]');
  perform crm_apply_messages(inbox, '[{"source":"whatsapp","type":"message_out","source_id":"whatsapp:wamid.B","occurred_at":"2026-11-09T09:06:00Z","actor":"auto","channel":"whatsapp","content":"","identity":{"phone":"+33655555555"},"data":{"wamid":"wamid.B","line":"+33612345678","status":"read"}}]');
  select * into e from crm_events where source = 'whatsapp' and source_id = 'whatsapp:wamid.B';
  assert (select count(*) from crm_events where source_id = 'whatsapp:wamid.B') = 1, 'un seul événement';
  assert e.actor::text = 'sales' and e.member_id = rep and e.content = 'Merci, à demain !' and e.data->>'status' = 'read'
     and e.occurred_at = '2026-11-09T09:04:30Z'::timestamptz, 'écho du commercial : ' || row_to_json(e)::text;
  -- un message envoyé par l'API seulement reste automatique
  perform crm_apply_messages(inbox, '[{"source":"whatsapp","type":"message_out","source_id":"whatsapp:wamid.C","occurred_at":"2026-11-09T10:00:00Z","actor":"auto","channel":"whatsapp","content":"","identity":{"phone":"+33655555555"},"data":{"wamid":"wamid.C","line":"+33612345678","status":"delivered"}}]');
  assert (select actor::text from crm_events where source_id = 'whatsapp:wamid.C') = 'auto', 'rappel automatique';
  -- STOP
  perform crm_apply_messages(inbox, '[{"source":"whatsapp","type":"opt_out","source_id":"whatsapp:optout:wamid.D","occurred_at":"2026-11-09T11:00:00Z","actor":"prospect","channel":"whatsapp","identity":{"phone":"+33655555555"},"data":{"wamid":"wamid.D"}}]');
  assert (select opted_out_at from crm_people where id = pid) is not null, 'STOP retenu';
  assert (select status from crm_webhook_log where id = inbox) = 'processed', 'ligne traitée';
end $$;
select 'whatsapp SQL checks: all passed';
