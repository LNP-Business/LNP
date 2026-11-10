-- 023_crm_contact_update.sql: iClosed "Contact updated" changes the lead's name, email and phone, never its status.
do $$
declare pid uuid; pid2 uuid; inbox bigint; r text;
begin
  insert into crm_people (full_name, primary_email, primary_phone) values ('Old Name', 'old@example.com', '+33600000011') returning id into pid;
  perform crm_add_identities(pid, '{"iclosed_contact_id":"9100","email":"old@example.com","phone":"+33600000011"}', 'iclosed');
  insert into crm_webhook_log (source, headers, body, auth_ok) values ('iclosed', '{}', '{}', true) returning id into inbox;
  r := crm_apply_contact(inbox, '[{"type":"contact_updated","source_id":"iclosed:contact_updated:9100:t1","occurred_at":"2026-10-26T10:00:00Z",
    "identity":{"iclosed_contact_id":"9100","email":"new@example.com","phone":"+33600000012","name":"New Name"},"data":{"changed":["email","name"]}}]');
  assert r = 'processed', 'applied';
  assert (select full_name from crm_people where id = pid) = 'New Name', 'name taken over';
  assert (select primary_email from crm_people where id = pid) = 'new@example.com', 'email taken over';
  assert (select primary_phone from crm_people where id = pid) = '+33600000011', 'phone not listed as changed: kept';
  assert (crm_people_for('{"email":"old@example.com"}'))[1] = pid, 'old email still finds the person';
  assert (crm_people_for('{"email":"new@example.com"}'))[1] = pid, 'new email finds the person';
  assert (select status from crm_webhook_log where id = inbox) = 'processed', 'row processed';
  assert not exists (select 1 from crm_events where person_id = pid), 'no event in the story';
  -- a phone that belongs to someone else is not moved
  insert into crm_people (full_name, primary_phone) values ('Someone Else', '+33600000099') returning id into pid2;
  perform crm_add_identities(pid2, '{"phone":"+33600000099"}', 'whatsapp');
  insert into crm_webhook_log (source, headers, body, auth_ok) values ('iclosed', '{}', '{}', true) returning id into inbox;
  r := crm_apply_contact(inbox, '[{"type":"contact_updated","identity":{"iclosed_contact_id":"9100","phone":"+33600000099"},"data":{"changed":["phone"]}}]');
  assert r = 'unmatched', 'conflict goes to review';
  assert (select primary_phone from crm_people where id = pid) = '+33600000011', 'phone unchanged';
  -- an unknown contact
  insert into crm_webhook_log (source, headers, body, auth_ok) values ('iclosed', '{}', '{}', true) returning id into inbox;
  assert crm_apply_contact(inbox, '[{"type":"contact_updated","identity":{"iclosed_contact_id":"nobody"},"data":{"changed":["name"]}}]') = 'unmatched', 'unknown contact';
end $$;
select 'contact update SQL checks: all passed';
