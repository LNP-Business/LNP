-- 052 · WhatsApp à la place de Sendblue (Romain 2026-11-09 : « je veux remplacer Sendblue par WhatsApp complètement »).
-- Les messages de l'équipe arrivent par WhatsApp Business (API officielle en coexistence, fonction whatsapp-in, lecture
-- supabase/functions/_shared/mappers/whatsapp.ts, docs/crm/07-integration-whatsapp.md). Sendblue n'a jamais envoyé de données
-- à LNP (crm_webhook_log et crm_events sans aucune ligne sendblue au 9 novembre) : rien à reprendre.
-- · source 'whatsapp' ; la fiche d'équipe garde le numéro WhatsApp Business de chacun (l'ancienne colonne de la ligne Sendblue) ;
-- · un message devient un événement du prospect, rattaché au membre de l'équipe dont c'est le numéro (crm_events.member_id) ;
-- · un même message (même identifiant WhatsApp) n'est compté qu'une fois : un statut met à jour son état ; un message d'abord vu
--   par son seul statut (envoyé par l'API, donc automatique) devient « commercial » si l'application le renvoie ensuite ;
-- · process-inbox lit la source whatsapp chaque minute.
-- Sans danger si rejoué.

alter type event_source add value if not exists 'whatsapp';

do $$ begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'crm_members' and column_name = 'sendblue_number') then
    alter table crm_members rename column sendblue_number to whatsapp_number;
  end if;
  if exists (select 1 from pg_class where relname = 'team_members_sendblue_uq') then
    alter index team_members_sendblue_uq rename to team_members_whatsapp_uq;
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'crm_outbound_messages' and column_name = 'sendblue_message_handle') then
    alter table crm_outbound_messages rename column sendblue_message_handle to whatsapp_message_id;
  end if;
end $$;
comment on column crm_members.whatsapp_number is 'Numéro WhatsApp Business de la personne, au format +33612345678 : rattache ses messages';

-- le paramètre change de nom : la fonction est recréée
drop function if exists crm_admin_set_member(text, text, text, member_role, text, text, text, text, boolean);
create function crm_admin_set_member(
  p_email text, p_member_key text, p_full_name text, p_role member_role,
  p_lead_key text default null, p_iclosed_email text default null, p_fathom_email text default null,
  p_whatsapp_number text default null, p_active boolean default true
) returns uuid language plpgsql security definer set search_path = public as $$
declare uid uuid; lead uuid; before jsonb; actor uuid;
begin
  if coalesce(public.my_role(), '') <> 'admin' and coalesce(crm_role()::text, '') <> 'admin' then
    raise exception 'Seul un administrateur peut définir les membres du CRM' using errcode = '42501';
  end if;
  select user_id into uid from members where lower(email) = lower(trim(p_email));
  if uid is null then raise exception 'Aucun compte avec l''adresse e-mail % (invitez d''abord la personne)', p_email; end if;
  if p_lead_key is not null then
    select id into lead from crm_members where member_key = p_lead_key;
    if lead is null then raise exception 'Responsable inconnu % : définissez d''abord le responsable', p_lead_key; end if;
    if lead = uid then raise exception 'Un membre ne peut pas être son propre responsable'; end if;
  end if;
  select to_jsonb(m) into before from crm_members m where id = uid;
  insert into crm_members (id, member_key, full_name, email, role, lead_id, iclosed_email, fathom_email, whatsapp_number, active)
  values (uid, p_member_key, p_full_name, lower(trim(p_email)), p_role, lead, p_iclosed_email, p_fathom_email, p_whatsapp_number, p_active)
  on conflict (id) do update set member_key = excluded.member_key, full_name = excluded.full_name, email = excluded.email,
    role = excluded.role, lead_id = excluded.lead_id, iclosed_email = excluded.iclosed_email,
    fathom_email = excluded.fathom_email, whatsapp_number = excluded.whatsapp_number, active = excluded.active;
  select id into actor from crm_members where id = auth.uid();
  perform crm_audit(actor, 'set_member', 'crm_members', uid::text, before, (select to_jsonb(m) from crm_members m where id = uid));
  return uid;
end $$;
revoke execute on function crm_admin_set_member(text, text, text, member_role, text, text, text, text, boolean) from public, anon;
grant execute on function crm_admin_set_member(text, text, text, member_role, text, text, text, text, boolean) to authenticated, service_role;

-- le numéro WhatsApp d'une personne de l'équipe (Paramètres › Compte › Accès de l'équipe) ; null l'efface. Appelée seulement par
-- web/api/team.js (clé de service), qui vérifie que la personne connectée est administratrice.
create or replace function crm_set_member_whatsapp(p_member uuid, p_number text) returns text
language plpgsql security definer set search_path = public as $$
declare n text := nullif(regexp_replace(coalesce(p_number, ''), '[^0-9+]', '', 'g'), ''); other text;
begin
  if n like '00%' then n := '+' || substr(n, 3); end if;
  if n is not null and n !~ '^\+[1-9][0-9]{7,14}$' then
    raise exception 'Numéro WhatsApp invalide : écrivez-le avec l''indicatif, par exemple +33 6 12 34 56 78' using errcode = '22023';
  end if;
  select coalesce(full_name, email) into other from crm_members where whatsapp_number = n and id <> p_member;
  if other is not null then raise exception 'Ce numéro est déjà celui de %', other using errcode = '23505'; end if;
  update crm_members set whatsapp_number = n where id = p_member;
  if not found then raise exception 'Membre du CRM inconnu' using errcode = 'P0002'; end if;
  return n;
end $$;
revoke execute on function crm_set_member_whatsapp(uuid, text) from public, anon, authenticated;
grant execute on function crm_set_member_whatsapp(uuid, text) to service_role;

create or replace function crm_apply_message_item(it jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare typ text := it->>'type'; persons uuid[]; pid uuid; cid uuid; at timestamptz := (it->>'occurred_at')::timestamptz;
        src text := coalesce(it->>'source', 'whatsapp'); who uuid;
begin
  if typ not in ('message_in', 'message_out', 'phone_call_in', 'phone_call_out', 'opt_out') then return null; end if;
  persons := crm_people_for(it->'identity');
  if array_length(persons, 1) > 1 then raise exception 'several people have the number %', it#>>'{identity,phone}' using errcode = 'P0M02'; end if;
  pid := persons[1];
  if pid is null then
    -- règle d'équipe : le WhatsApp Business déclaré ne sert qu'avec des prospects ; un numéro inconnu est un nouveau prospect
    insert into crm_people (primary_phone, full_name) values (it#>>'{identity,phone}', nullif(it#>>'{identity,name}', '')) returning id into pid;
    perform crm_add_identities(pid, it->'identity', src::event_source);
  end if;
  if typ = 'opt_out' then
    update crm_people set opted_out_at = coalesce(opted_out_at, at), updated_at = now() where id = pid;
  end if;
  -- la personne de l'équipe : celle dont c'est le numéro WhatsApp Business
  select id into who from crm_members where whatsapp_number is not null and whatsapp_number = it#>>'{data,line}';
  -- le cycle du message : le dernier ouvert avant lui, sinon le premier (un message avant toute prise de RDV)
  select id into cid from crm_cycles where person_id = pid
   order by (opened_at <= at) desc, case when opened_at <= at then opened_at end desc nulls last, opened_at limit 1;
  insert into crm_events (person_id, cycle_id, occurred_at, actor, member_id, channel, type, content, data, source, source_id)
  values (pid, cid, at, (it->>'actor')::actor_kind, who, it->>'channel', typ, it->>'content', coalesce(it->'data', '{}'::jsonb),
          src::event_source, it->>'source_id')
  on conflict (source, source_id) do update
    set data = crm_events.data || jsonb_strip_nulls(excluded.data),
        content = coalesce(nullif(excluded.content, ''), crm_events.content),
        actor = case when excluded.actor = 'sales' or crm_events.actor = 'sales' then 'sales'::actor_kind else crm_events.actor end,
        member_id = coalesce(crm_events.member_id, excluded.member_id),
        occurred_at = least(crm_events.occurred_at, excluded.occurred_at);
  return cid;
end $$;

create or replace function crm_apply_messages(p_inbox bigint, p_items jsonb) returns text
language plpgsql security definer set search_path = public as $$
declare it jsonb; c uuid; touched uuid[] := '{}'; result text := 'ignored';
begin
  for it in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    begin
      c := crm_apply_message_item(it);
      if c is not null then touched := touched || c; end if;
      result := 'processed';
    exception when sqlstate 'P0M02' then
      insert into crm_unmatched_inbox (inbox_id, source, reason, summary, candidate_person_ids)
      values (p_inbox, coalesce(it->>'source', 'whatsapp')::event_source, 'Plusieurs personnes ont ce numéro de téléphone', it#>>'{identity,phone}', crm_people_for(it->'identity'));
      if result <> 'processed' then result := 'unmatched'; end if;
    end;
  end loop;
  foreach c in array coalesce((select array_agg(distinct x) from unnest(touched) x), '{}') loop perform crm_recompute_cycle(c); end loop;
  update crm_webhook_log set status = result::inbox_status, processed_at = now(), error = null where id = p_inbox;
  return result;
end $$;

-- un lot de messages déjà lus (historique) : les mêmes items ; une simulation est annulée et ne rend que des comptes
create or replace function crm_import_messages(p_items jsonb, p_dry boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
declare it jsonb; c uuid; touched uuid[] := '{}'; st jsonb := '{"items":0,"new":0,"known":0,"new_people":0,"no_cycle":0,"conflicts":0}';
        before int; people0 int;
begin
  begin
    select count(*) into people0 from crm_people;
    for it in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
      st := jsonb_set(st, '{items}', to_jsonb((st->>'items')::int + 1));
      select count(*) into before from crm_events where source::text = coalesce(it->>'source', 'whatsapp') and source_id = it->>'source_id';
      begin
        c := crm_apply_message_item(it);
      exception when sqlstate 'P0M02' then
        st := jsonb_set(st, '{conflicts}', to_jsonb((st->>'conflicts')::int + 1)); continue;
      end;
      st := jsonb_set(st, case when before = 0 then '{new}'::text[] else '{known}'::text[] end,
                      to_jsonb((st->>(case when before = 0 then 'new' else 'known' end))::int + 1));
      if c is null then st := jsonb_set(st, '{no_cycle}', to_jsonb((st->>'no_cycle')::int + 1)); else touched := touched || c; end if;
    end loop;
    st := jsonb_set(st, '{new_people}', to_jsonb((select count(*) from crm_people) - people0));
    foreach c in array coalesce((select array_agg(distinct x) from unnest(touched) x), '{}') loop perform crm_recompute_cycle(c); end loop;
    if p_dry then raise exception 'dry run' using errcode = 'P0D01'; end if;
  exception when sqlstate 'P0D01' then
    null;
  end;
  return st;
end $$;

revoke execute on function crm_apply_message_item(jsonb) from public, anon, authenticated;
revoke execute on function crm_apply_messages(bigint, jsonb) from public, anon, authenticated;
revoke execute on function crm_import_messages(jsonb, boolean) from public, anon, authenticated;
grant execute on function crm_apply_messages(bigint, jsonb) to service_role;
grant execute on function crm_import_messages(jsonb, boolean) to service_role;

-- process-inbox lit WhatsApp (à la place de Sendblue)
do $$ begin
  if exists (select 1 from pg_namespace where nspname = 'cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'crm-process-inbox';
    perform cron.schedule('crm-process-inbox', '* * * * *', $job$
  select net.http_post(
    url := (select value #>> '{}' from public.crm_settings where key = 'functions_url') || '/process-inbox',
    body := '{}'::jsonb,
    headers := '{"content-type": "application/json"}'::jsonb,
    timeout_milliseconds := 30000)
  where exists (select 1 from public.crm_settings where key = 'functions_url')
    and exists (select 1 from public.crm_webhook_log
                 where source::text in ('iclosed', 'whatsapp', 'fathom') and status in ('received', 'failed') and attempts < 8)
$job$);
  end if;
end $$;
