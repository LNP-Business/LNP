-- SKL OS CRM — iClosed "Contact updated": the lead's own details (web/supabase/023_crm_contact_update.sql), after 022.
-- Romain 2026-10-27: only the details are taken over (name, email, phone); a lead's status stays decided in the CRM
-- (Sales cycle outcomes, 004 / 005), so the iClosed status (QUALIFIED, …_CALL_BOOKED) is never read. The mapper sends an
-- item only when iClosed lists one of those details in updatedAttributes. The person is found by their iClosed contact id;
-- the old email or phone stays an identity (matching keeps working), the new one becomes the primary. A new email or phone
-- that already belongs to someone else is not moved: the row goes to crm_unmatched_inbox. No event is written (the Sales
-- cycle story is about the sale). Used by process-inbox. Safe to run again.

create or replace function crm_apply_contact(p_inbox bigint, p_items jsonb) returns text
language plpgsql security definer set search_path = public as $$
declare it jsonb; pid uuid; changed text[]; name text; email text; phone text; other uuid[]; result text := 'ignored';
begin
  for it in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    if it->>'type' <> 'contact_updated' then continue; end if;
    pid := (crm_people_for(jsonb_build_object('iclosed_contact_id', it#>>'{identity,iclosed_contact_id}')))[1];
    if pid is null then
      insert into crm_unmatched_inbox (inbox_id, source, reason, summary)
      values (p_inbox, 'iclosed', 'Mise à jour d''un contact inconnu du CRM', it#>>'{data,summary}');
      if result <> 'processed' then result := 'unmatched'; end if;
      continue;
    end if;
    changed := array(select jsonb_array_elements_text(coalesce(it#>'{data,changed}', '[]'::jsonb)));
    name := nullif(trim(it#>>'{identity,name}'), '');
    email := nullif(it#>>'{identity,email}', '');
    phone := nullif(it#>>'{identity,phone}', '');
    -- a new email or phone that already points to someone else: leave both people as they are
    other := array(select x from unnest(crm_people_for(jsonb_strip_nulls(jsonb_build_object(
               'email', case when 'email' = any(changed) then email end,
               'phone', case when 'phone' = any(changed) then phone end)))) x where x <> pid);
    if cardinality(other) > 0 then
      insert into crm_unmatched_inbox (inbox_id, source, reason, summary, candidate_person_ids)
      values (p_inbox, 'iclosed', 'Nouvel e-mail ou téléphone déjà attribué à une autre personne', it#>>'{data,summary}', pid || other);
      if result <> 'processed' then result := 'unmatched'; end if;
      continue;
    end if;
    update crm_people set
      full_name = case when 'name' = any(changed) and name is not null then name else full_name end,
      primary_email = case when 'email' = any(changed) and email is not null then email::citext else primary_email end,
      primary_phone = case when 'phone' = any(changed) and phone is not null then phone else primary_phone end,
      updated_at = now()
     where id = pid;
    perform crm_add_identities(pid, jsonb_strip_nulls(jsonb_build_object(
      'email', case when 'email' = any(changed) then email end,
      'phone', case when 'phone' = any(changed) then phone end)), 'iclosed');
    result := 'processed';
  end loop;
  update crm_webhook_log set status = result::inbox_status, processed_at = now(), error = null where id = p_inbox;
  return result;
end $$;

revoke execute on function crm_apply_contact(bigint, jsonb) from public, anon, authenticated;
grant execute on function crm_apply_contact(bigint, jsonb) to service_role;
