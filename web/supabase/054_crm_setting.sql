-- 054 · Le suivi du setter dans le CRM (Romain 2026-11-09 : « tracker toutes les étapes du setter pour chaque lead grâce au CRM,
-- et surtout à l'écran Leads » ; workflow « Cycle de vente LNP » ; brief setter des funnels Quiz et VSL).
-- Chaque lead a un statut setter, gardé sur la personne (crm_people) : un lead sans RDV n'a pas encore de cycle de vente.
--   statut (setting_status)  · dernière action (setting_last_action, setting_last_at) · échéance de l'action actuelle
--   (setting_due_at) · tentatives d'appel (setting_attempts) · setter (setter_id) · source (lead_source) · réponses du quiz (quiz).
-- Le setter fait avancer le statut par crm_setter_action (une action = un événement « setter_action » dans le fil du prospect) ;
-- iClosed le fait avancer seul : un R1 réservé → « RDV à confirmer », annulé → « À replanifier », absent → « Absent ·
-- rattrapage », tenu → « RDV tenu · au commercial ». Les leads des funnels entrent par crm_apply_leads (fonction lead-in).
-- Un rôle « setter » : il voit les leads qui lui sont confiés (crm_sees_person, crm_owns_cycle) et reçoit leurs alertes SE.
-- Sans danger si rejoué.

alter type member_role add value if not exists 'setter';
alter type event_source add value if not exists 'funnel';

alter table crm_people add column if not exists setter_id uuid references crm_members(id) on delete set null;
alter table crm_people add column if not exists lead_source text;           -- quiz | vsl | quiz_abandon | webinaire | iclosed | manuel
alter table crm_people add column if not exists quiz jsonb;                 -- réponses du quiz, telles que reçues
alter table crm_people add column if not exists setting_status text;
alter table crm_people add column if not exists setting_since timestamptz;  -- entrée dans le statut
alter table crm_people add column if not exists setting_last_action text;
alter table crm_people add column if not exists setting_last_at timestamptz;
alter table crm_people add column if not exists setting_due_at timestamptz;  -- échéance de l'action actuelle (null : rien à faire)
alter table crm_people add column if not exists setting_attempts int not null default 0;
create index if not exists crm_people_setting on crm_people(setting_status) where setting_status is not null;
create index if not exists crm_people_setter on crm_people(setter_id) where setter_id is not null;

-- réglages : heures de couverture du setter (heure de Paris ; lundi = 1 … dimanche = 7), tentatives, setter par défaut
insert into crm_settings (key, value, is_proposal) values ('setting', jsonb_build_object(
  'coverage', jsonb_build_object('1', '[["12:00","13:30"],["17:00","20:00"]]'::jsonb, '2', '[["12:00","13:30"],["17:00","20:00"]]'::jsonb,
    '3', '[["12:00","13:30"],["17:00","20:00"]]'::jsonb, '4', '[["12:00","13:30"],["17:00","20:00"]]'::jsonb,
    '5', '[["12:00","13:30"],["17:00","20:00"]]'::jsonb, '6', '[["09:00","12:00"]]'::jsonb),
  'max_attempts', 6, 'abandon_attempts', 2, 'default_setter', null), true)
on conflict (key) do nothing;

-- ───────────── qui voit quoi : le setter voit ses leads (et leurs cycles), comme un commercial voit les siens ─────────────
create or replace function crm_sets_person(p uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from crm_people where id = p and setter_id = auth.uid())
$$;
create or replace function crm_owns_cycle(c uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from crm_cycles where id = c and (owner_id = auth.uid() or crm_sets_person(person_id)))
$$;
create or replace function crm_sees_person(p uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select crm_sees_all() or crm_sets_person(p) or exists (select 1 from crm_cycles where person_id = p and owner_id = auth.uid())
$$;
drop policy if exists read_cycles on crm_cycles;
create policy read_cycles on crm_cycles for select using (crm_sees_all() or owner_id = auth.uid() or crm_sets_person(person_id));

-- un setter écrit sur les cycles de ses leads (note, issue) comme un commercial sur les siens
create or replace function crm_require(p_roles member_role[], p_cycle uuid default null) returns crm_members
language plpgsql stable security definer set search_path = public as $$
declare me crm_members;
begin
  select * into me from crm_members where id = auth.uid() and active;
  if me.id is null then raise exception 'Vous n''êtes pas membre du CRM' using errcode = '42501'; end if;
  if me.role = any(p_roles) then return me; end if;
  if me.role = 'sales' and p_cycle is not null and exists (select 1 from crm_cycles where id = p_cycle and owner_id = me.id) then
    return me;
  end if;
  if me.role::text = 'setter' and p_cycle is not null
     and exists (select 1 from crm_cycles c join crm_people p on p.id = c.person_id where c.id = p_cycle and p.setter_id = me.id) then
    return me;
  end if;
  raise exception 'Action non autorisée pour le rôle %', me.role using errcode = '42501';
end $$;

-- les prospects sans RDV, avec leur suivi setter (écran Prospects)
create or replace view crm_people_without_cycle with (security_invoker = true) as
  select p.id, p.full_name, p.primary_email, p.primary_phone, p.created_at,
         (select e.data->>'status_label' from crm_events e
           where e.person_id = p.id and e.type = 'imported' and e.source_id like 'import:import:iclosed:%'
           order by e.occurred_at desc limit 1) as iclosed_status,
         (select max(e.occurred_at) from crm_events e where e.person_id = p.id) as last_event_at,
         p.first_seen_at, p.setter_id, p.lead_source, p.quiz, p.setting_status, p.setting_since, p.setting_last_action,
         p.setting_last_at, p.setting_due_at, p.setting_attempts
    from crm_people p
   where p.merged_into is null and not exists (select 1 from crm_cycles c where c.person_id = p.id);
revoke all on crm_people_without_cycle from anon;
grant select on crm_people_without_cycle to authenticated;

-- ───────────── échéances ─────────────
-- la prochaine heure couverte par le setter à partir de t (t lui-même s'il est dans une plage) ; sans plage : t
create or replace function crm_setting_open_at(t timestamptz) returns timestamptz
language plpgsql stable security definer set search_path = public as $$
declare cov jsonb := (select value->'coverage' from crm_settings where key = 'setting'); d int; day date; r jsonb; a timestamptz; b timestamptz;
        loc timestamp := t at time zone 'Europe/Paris';
begin
  if cov is null or cov = '{}'::jsonb then return t; end if;
  for d in 0..7 loop
    day := (loc::date + d);
    for r in select * from jsonb_array_elements(coalesce(cov->(extract(isodow from day)::int)::text, '[]'::jsonb)) loop
      a := (day + (r->>0)::time) at time zone 'Europe/Paris';
      b := (day + (r->>1)::time) at time zone 'Europe/Paris';
      if t < b then return greatest(t, a); end if;
    end loop;
  end loop;
  return t;
end $$;

-- 21 h (heure de Paris) le jour de t ; après 19 h : 21 h le lendemain
create or replace function crm_setting_end_of_day(t timestamptz) returns timestamptz
language sql stable set search_path = public as $$
  select case when (t at time zone 'Europe/Paris')::time >= time '19:00'
              then (((t at time zone 'Europe/Paris')::date + 1) + time '21:00') at time zone 'Europe/Paris'
              else (((t at time zone 'Europe/Paris')::date) + time '21:00') at time zone 'Europe/Paris' end
$$;

-- l'échéance de l'action actuelle d'un statut (cadence du brief : T0, +2 h, fin de journée, J+1, J+2, J+4)
create or replace function crm_setting_due(p_person uuid, p_status text, p_since timestamptz, p_attempts int) returns timestamptz
language plpgsql stable security definer set search_path = public as $$
declare p crm_people; rdv timestamptz; t0 timestamptz; src text;
begin
  select * into p from crm_people where id = p_person;
  src := coalesce(p.lead_source, '');
  select k.scheduled_start into rdv from crm_calls k join crm_cycles c on c.id = k.cycle_id
   where c.person_id = p_person and c.status::text = 'active' and k.status::text = 'scheduled' and k.scheduled_start > now()
   order by k.scheduled_start limit 1;
  case p_status
    when 'a_contacter' then return crm_setting_open_at(p_since) + interval '5 minutes';
    when 'relance' then
      t0 := coalesce((select min(e.occurred_at) from crm_events e where e.person_id = p_person and e.type = 'setter_action'
                       and e.data->>'action' = 'appel_sans_reponse' and e.occurred_at >= coalesce(p.first_seen_at, p_since) - interval '1 day'), p_since);
      if src = 'quiz_abandon' then return crm_setting_open_at(t0 + interval '24 hours'); end if;
      return crm_setting_open_at(case p_attempts
        when 1 then t0 + interval '2 hours'
        when 2 then greatest(t0 + interval '3 hours', crm_setting_end_of_day(t0) - interval '2 hours')
        when 3 then (((t0 at time zone 'Europe/Paris')::date + 1) + time '17:00') at time zone 'Europe/Paris'
        when 4 then (((t0 at time zone 'Europe/Paris')::date + 2) + time '17:00') at time zone 'Europe/Paris'
        else (((t0 at time zone 'Europe/Paris')::date + 4) + time '17:00') at time zone 'Europe/Paris' end);
    when 'qualification' then return crm_setting_end_of_day(p_since);
    when 'rdv_a_confirmer' then return p_since + interval '1 hour';
    when 'appel_confirmation' then return coalesce(p.setting_due_at, p_since + interval '1 hour');
    when 'rdv_pose' then return case when rdv is null then null else greatest(p_since + interval '1 hour', rdv - interval '24 hours') end;
    when 'reconfirmation' then return least(p_since + interval '4 hours', coalesce(rdv - interval '2 hours', p_since + interval '4 hours'));
    when 'a_replanifier' then return crm_setting_end_of_day(p_since);
    when 'absent_rattrapage' then return p_since + interval '15 minutes';
    else return null;   -- rdv_confirme (les rappels partent seuls), transmis, injoignable, non_qualifie
  end case;
end $$;

-- change le statut setter d'une personne (et l'inscrit dans son fil) ; p_action : ce qui vient d'être fait
create or replace function crm_setting_move(p_person uuid, p_to text, p_action text, p_label text, p_note text, p_actor uuid,
                                            p_attempts int default null, p_at timestamptz default now()) returns void
language plpgsql security definer set search_path = public as $$
declare p crm_people; cid uuid; tries int;
begin
  select * into p from crm_people where id = p_person for update;
  if p.id is null then return; end if;
  tries := coalesce(p_attempts, case when p_to is distinct from p.setting_status and p_to in ('a_contacter', 'qualification', 'rdv_a_confirmer', 'rdv_pose') then 0 else p.setting_attempts end);
  update crm_people set setting_status = p_to,
         setting_since = case when p_to is distinct from setting_status then p_at else coalesce(setting_since, p_at) end,
         setting_last_action = p_label, setting_last_at = p_at, setting_attempts = tries, updated_at = now()
   where id = p_person;
  update crm_people set setting_due_at = crm_setting_due(p_person, p_to, setting_since, tries) where id = p_person;
  select id into cid from crm_cycles where person_id = p_person and status::text = 'active' order by opened_at desc limit 1;
  insert into crm_events (person_id, cycle_id, occurred_at, actor, member_id, channel, type, content, data, source, source_id)
  values (p_person, cid, p_at, case when p_actor is null then 'system' else 'sales' end::actor_kind, p_actor, 'crm', 'setter_action', nullif(p_note, ''),
          jsonb_build_object('action', p_action, 'label', p_label, 'from', p.setting_status, 'to', p_to, 'attempts', tries),
          'crm', 'setting:' || p_person || ':' || p_action || ':' || extract(epoch from clock_timestamp()));
end $$;
revoke execute on function crm_setting_move(uuid, text, text, text, text, uuid, int, timestamptz) from public, anon, authenticated;

-- ───────────── les actions du setter (écran Prospects, fiche du prospect) ─────────────
create or replace function crm_setter_action(p_person uuid, p_action text, p_note text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me crm_members; p crm_people; s text; t text; lbl text; tries int; maxa int; open_states text[] :=
  array['a_contacter', 'relance', 'qualification', 'rdv_a_confirmer', 'appel_confirmation', 'rdv_pose', 'rdv_confirme', 'reconfirmation', 'a_replanifier', 'absent_rattrapage'];
begin
  select * into me from crm_members where id = auth.uid() and active;
  if me.id is null then raise exception 'Vous n''êtes pas membre du CRM' using errcode = '42501'; end if;
  select * into p from crm_people where id = p_person;
  if p.id is null then raise exception 'Prospect inconnu' using errcode = 'P0002'; end if;
  if not (me.role::text = 'admin' or p.setter_id = me.id
          or exists (select 1 from crm_cycles c where c.person_id = p_person and c.owner_id = me.id)) then
    raise exception 'Ce lead n''est pas le vôtre' using errcode = '42501';
  end if;
  s := coalesce(p.setting_status, 'a_contacter'); tries := p.setting_attempts;
  maxa := case when p.lead_source = 'quiz_abandon' then coalesce((select (value->>'abandon_attempts')::int from crm_settings where key = 'setting'), 2)
               else coalesce((select (value->>'max_attempts')::int from crm_settings where key = 'setting'), 6) end;
  case p_action
    when 'appel_sans_reponse' then
      lbl := 'Appel sans réponse';
      if s in ('a_contacter', 'relance') then
        tries := tries + 1; t := case when tries >= maxa then 'injoignable' else 'relance' end;
        if t = 'injoignable' then lbl := 'Appel sans réponse (' || tries || 'e) · classé injoignable'; end if;
      elsif s in ('appel_confirmation', 'reconfirmation', 'a_replanifier', 'absent_rattrapage', 'rdv_a_confirmer') then tries := tries + 1; t := s;
      end if;
    when 'msg_relance' then lbl := 'Message de relance envoyé'; if s = any(open_states) then t := s; end if;
    when 'msg_confirmation' then lbl := 'Message de confirmation envoyé';
      if s = 'rdv_a_confirmer' then t := 'appel_confirmation'; elsif s in ('rdv_pose', 'appel_confirmation') then t := s; end if;
    when 'joint' then lbl := 'Joint au téléphone';
      if s in ('a_contacter', 'relance', 'injoignable', 'non_qualifie') then t := 'qualification'; end if;
    when 'rdv_pose' then lbl := 'RDV posé dans iClosed';
      if s in ('a_contacter', 'relance', 'qualification', 'a_replanifier', 'absent_rattrapage', 'rdv_a_confirmer', 'injoignable', 'non_qualifie') then t := 'rdv_pose'; end if;
    when 'non_qualifie' then lbl := 'Non qualifié';
      if s in ('a_contacter', 'relance', 'qualification', 'rdv_a_confirmer', 'appel_confirmation') then t := 'non_qualifie'; end if;
    when 'ok_recu' then lbl := '« OK » reçu';
      if s in ('rdv_pose', 'rdv_a_confirmer', 'appel_confirmation', 'reconfirmation') then t := 'rdv_confirme'; end if;
    when 'confirmation_faite' then lbl := 'Appel de confirmation fait';
      if s in ('rdv_a_confirmer', 'appel_confirmation', 'reconfirmation', 'rdv_pose') then t := 'rdv_confirme'; end if;
    when 'rappel_j1' then lbl := 'Rappel J−1 envoyé'; if s in ('rdv_pose', 'rdv_confirme') then t := s; end if;
    when 'sans_ok_j1' then lbl := 'Pas de « OK » à J−1'; if s in ('rdv_pose', 'rdv_confirme') then t := 'reconfirmation'; end if;
    when 'rappel_h2' then lbl := 'Rappel H−2 envoyé'; if s in ('rdv_confirme', 'rdv_pose') then t := s; end if;
    when 'annule' then lbl := 'RDV annulé ou déplacé';
      if s in ('rdv_a_confirmer', 'appel_confirmation', 'rdv_pose', 'rdv_confirme', 'reconfirmation') then t := 'a_replanifier'; end if;
    when 'injoignable' then lbl := 'Classé injoignable'; if s in ('a_contacter', 'relance') then t := 'injoignable'; end if;
    when 'relancer' then lbl := 'Lead repris'; if s in ('injoignable', 'non_qualifie') then t := 'a_contacter'; tries := 0; end if;
    when 'note' then lbl := 'Note'; t := s;
    else raise exception 'Action inconnue : %', p_action using errcode = '22023';
  end case;
  if t is null then raise exception 'Cette action ne s''applique pas au statut actuel' using errcode = '22023'; end if;
  perform crm_setting_move(p_person, t, p_action, lbl, p_note, me.id, tries);
  -- un lead sans setter prend celui qui agit, s'il est setter
  if p.setter_id is null and me.role::text = 'setter' then update crm_people set setter_id = me.id where id = p_person; end if;
  return (select jsonb_build_object('status', setting_status, 'due_at', setting_due_at, 'attempts', setting_attempts) from crm_people where id = p_person);
end $$;
revoke execute on function crm_setter_action(uuid, text, text) from public, anon;
grant execute on function crm_setter_action(uuid, text, text) to authenticated;

-- le setter d'un lead (administrateurs) ; null : sans setter
create or replace function crm_set_setter(p_person uuid, p_member uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(crm_role()::text, '') <> 'admin' then raise exception 'Seul un administrateur choisit le setter' using errcode = '42501'; end if;
  if p_member is not null and not exists (select 1 from crm_members where id = p_member and active and role::text in ('setter', 'admin', 'sales')) then
    raise exception 'Membre inconnu' using errcode = 'P0002';
  end if;
  update crm_people set setter_id = p_member, updated_at = now() where id = p_person;
end $$;
revoke execute on function crm_set_setter(uuid, uuid) from public, anon;
grant execute on function crm_set_setter(uuid, uuid) to authenticated;

-- le setter d'un nouveau lead : celui des réglages, sinon le setter actif qui a le moins de leads ouverts
create or replace function crm_pick_setter() returns uuid
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select m.id from crm_members m where m.active and m.role::text = 'setter'
        and m.id = nullif((select value->>'default_setter' from crm_settings where key = 'setting'), '')::uuid),
    (select m.id from crm_members m where m.active and m.role::text = 'setter'
      order by (select count(*) from crm_people p where p.setter_id = m.id and p.setting_status in
               ('a_contacter', 'relance', 'qualification', 'rdv_a_confirmer', 'appel_confirmation', 'rdv_pose', 'reconfirmation', 'a_replanifier', 'absent_rattrapage')), m.created_at
      limit 1))
$$;

-- ───────────── l'entrée des leads (fonction lead-in, ou saisie à la main) ─────────────
-- un item : {source_id, occurred_at, identity {email, phone, name}, data {source: quiz|vsl|quiz_abandon|webinaire|manuel, booked, answers}}
create or replace function crm_lead_item(it jsonb, p_actor uuid default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare persons uuid[]; pid uuid; at timestamptz := coalesce((it->>'occurred_at')::timestamptz, now()); src text := coalesce(nullif(it#>>'{data,source}', ''), 'quiz');
        p crm_people; cid uuid; srcname text;
        idn jsonb := jsonb_strip_nulls(jsonb_build_object('email', nullif(lower(trim(it#>>'{identity,email}')), ''),
                       'phone', nullif(trim(it#>>'{identity,phone}'), ''), 'name', nullif(trim(it#>>'{identity,name}'), '')));
begin
  persons := crm_people_for(idn);
  if array_length(persons, 1) > 1 then raise exception 'several people for this lead' using errcode = 'P0M02'; end if;
  pid := persons[1];
  if pid is null then
    insert into crm_people (full_name, primary_email, primary_phone, first_seen_at)
    values (idn->>'name', idn->>'email', idn->>'phone', at) returning id into pid;
    perform crm_add_identities(pid, idn, 'funnel');
  end if;
  update crm_people set lead_source = coalesce(lead_source, src), quiz = coalesce(it#>'{data,answers}', quiz),
         full_name = coalesce(full_name, idn->>'name'),
         setter_id = coalesce(setter_id, case when p_actor is not null and exists (select 1 from crm_members where id = p_actor and role::text = 'setter') then p_actor end, crm_pick_setter()),
         updated_at = now()
   where id = pid;
  select id into cid from crm_cycles where person_id = pid and status::text = 'active' order by opened_at desc limit 1;
  srcname := case src when 'quiz' then 'quiz complété' when 'vsl' then 'opt-in VSL' when 'quiz_abandon' then 'quiz abandonné'
                      when 'webinaire' then 'webinaire' when 'manuel' then 'saisi à la main' else src end;
  insert into crm_events (person_id, cycle_id, occurred_at, actor, member_id, channel, type, content, data, source, source_id)
  values (pid, cid, at, 'prospect', p_actor, 'crm', 'lead_in', 'Lead reçu : ' || srcname,
          jsonb_build_object('source', src, 'booked', coalesce((it#>>'{data,booked}')::boolean, false)), 'funnel',
          coalesce(nullif(it->>'source_id', ''), 'funnel:' || pid || ':' || extract(epoch from at)))
  on conflict (source, source_id) do nothing;
  if not found then return pid; end if;   -- déjà reçu
  select * into p from crm_people where id = pid;
  -- un lead déjà en cours (RDV, qualification…) garde son statut ; un lead en nurture ou nouveau est à contacter
  if p.setting_status is null or p.setting_status in ('injoignable', 'non_qualifie') then
    if not coalesce((it#>>'{data,booked}')::boolean, false) then
      perform crm_setting_move(pid, 'a_contacter', 'lead_in', 'Lead reçu : ' || srcname, null, p_actor, 0, at);
    end if;
  end if;
  return pid;
end $$;
revoke execute on function crm_lead_item(jsonb, uuid) from public, anon, authenticated;

-- process-inbox (source funnel) : une requête brute, ses leads, une transaction
create or replace function crm_apply_leads(p_inbox bigint, p_items jsonb) returns text
language plpgsql security definer set search_path = public as $$
declare it jsonb; result text := 'ignored';
begin
  for it in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    begin
      perform crm_lead_item(it);
      result := 'processed';
    exception when sqlstate 'P0M02' then
      insert into crm_unmatched_inbox (inbox_id, source, reason, summary, candidate_person_ids)
      values (p_inbox, 'funnel', 'Plusieurs personnes ont cet e-mail ou ce numéro', coalesce(it#>>'{identity,email}', it#>>'{identity,phone}'), crm_people_for(it->'identity'));
      if result <> 'processed' then result := 'unmatched'; end if;
    end;
  end loop;
  update crm_webhook_log set status = result::inbox_status, processed_at = now(), error = null where id = p_inbox;
  return result;
end $$;
revoke execute on function crm_apply_leads(bigint, jsonb) from public, anon, authenticated;
grant execute on function crm_apply_leads(bigint, jsonb) to service_role;

-- un lead saisi à la main par un setter ou un administrateur (bouton « Nouveau prospect » de l'écran Prospects)
create or replace function crm_create_lead(p_name text, p_email text, p_phone text, p_source text default 'manuel') returns uuid
language plpgsql security definer set search_path = public as $$
declare me crm_members; ph text := nullif(regexp_replace(coalesce(p_phone, ''), '[^0-9+]', '', 'g'), '');
begin
  select * into me from crm_members where id = auth.uid() and active;
  if me.id is null or me.role::text not in ('admin', 'setter', 'sales') then raise exception 'Action non autorisée' using errcode = '42501'; end if;
  if coalesce(nullif(trim(p_email), ''), ph) is null then raise exception 'Indiquez un e-mail ou un téléphone' using errcode = '22023'; end if;
  if ph like '00%' then ph := '+' || substr(ph, 3); elsif ph like '0%' then ph := '+33' || substr(ph, 2); end if;
  return crm_lead_item(jsonb_build_object('source_id', 'manuel:' || gen_random_uuid(), 'occurred_at', now(),
    'identity', jsonb_strip_nulls(jsonb_build_object('name', nullif(trim(p_name), ''), 'email', nullif(lower(trim(p_email)), ''), 'phone', ph)),
    'data', jsonb_build_object('source', coalesce(nullif(p_source, ''), 'manuel'))), me.id);
end $$;
revoke execute on function crm_create_lead(text, text, text, text) from public, anon;
grant execute on function crm_create_lead(text, text, text, text) to authenticated;

-- ───────────── iClosed fait avancer le statut seul (le R1 seulement : la suite est au commercial) ─────────────
create or replace function crm_setting_on_call() returns trigger
language plpgsql security definer set search_path = public as $$
declare pid uuid; s text; recent boolean;
begin
  if new.rank is distinct from 1 then return new; end if;
  select person_id into pid from crm_cycles where id = new.cycle_id;
  if pid is null then return new; end if;
  select setting_status into s from crm_people where id = pid;
  -- les imports de l'historique (appels passés) ne changent rien : seuls les RDV à venir ou du jour comptent
  if coalesce(new.scheduled_start, now()) < now() - interval '2 days' then return new; end if;
  if tg_op = 'INSERT' and new.status::text = 'scheduled' and coalesce(new.scheduled_start, now()) > now() - interval '1 hour' then
    -- un RDV posé par le setter pendant l'appel reste « RDV posé » ; réservé seul par le prospect : « RDV à confirmer »
    recent := exists (select 1 from crm_events e where e.person_id = pid and e.type = 'setter_action' and e.data->>'action' = 'rdv_pose'
                        and e.occurred_at > now() - interval '3 hours');
    if s in ('rdv_pose', 'rdv_confirme') or recent then
      if s is distinct from 'rdv_pose' and s is distinct from 'rdv_confirme' then
        perform crm_setting_move(pid, 'rdv_pose', 'call_booked', 'RDV réservé dans iClosed', null, null, 0);
      else
        update crm_people set setting_due_at = crm_setting_due(pid, setting_status, setting_since, setting_attempts) where id = pid;
      end if;
    else
      perform crm_setting_move(pid, 'rdv_a_confirmer', 'call_booked', 'RDV réservé dans iClosed', null, null, 0);
    end if;
  elsif tg_op = 'UPDATE' and new.status is distinct from old.status then
    if new.status::text = 'no_show' then
      perform crm_setting_move(pid, 'absent_rattrapage', 'no_show', 'Absent au RDV', null, null, 0);
    elsif new.status::text = 'held' and s is distinct from 'transmis' then
      perform crm_setting_move(pid, 'transmis', 'held', 'RDV tenu · au commercial', null, null);
    elsif new.status::text = 'canceled' and s in ('rdv_a_confirmer', 'appel_confirmation', 'rdv_pose', 'rdv_confirme', 'reconfirmation')
          and not exists (select 1 from crm_calls k where k.cycle_id = new.cycle_id and k.id <> new.id and k.status::text = 'scheduled') then
      perform crm_setting_move(pid, 'a_replanifier', 'call_canceled', 'RDV annulé dans iClosed', null, null, 0);
    elsif new.status::text = 'scheduled' and old.scheduled_start is distinct from new.scheduled_start
          and s in ('rdv_pose', 'rdv_confirme', 'reconfirmation', 'a_replanifier') then
      perform crm_setting_move(pid, 'rdv_a_confirmer', 'call_rescheduled', 'RDV déplacé dans iClosed', null, null, 0);
    end if;
  end if;
  return new;
end $$;
drop trigger if exists crm_setting_on_call on crm_calls;
create trigger crm_setting_on_call after insert or update of status, scheduled_start on crm_calls
  for each row execute function crm_setting_on_call();

-- ───────────── les alertes du setter (SE) : sla-tick lit les leads en cours ─────────────
-- le cycle tel que les règles SLA le lisent : sans les actions du setter ni l'entrée du lead (lues à part, ci-dessous)
create or replace function crm_sla_snapshot(p_days int default 60) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', c.id, 'opened_at', c.opened_at, 'person', p.full_name, 'owner', m.full_name, 'owner_key', m.member_key,
    'events', (select coalesce(jsonb_agg(jsonb_build_object('type', e.type, 'at', e.occurred_at, 'actor', e.actor, 'channel', e.channel,
                 'call_id', e.call_id, 'source', e.source) order by e.occurred_at), '[]'::jsonb)
                 from crm_events e where e.cycle_id = c.id and e.occurred_at > now() - make_interval(days => p_days)
                  and e.type not in ('setter_action', 'lead_in')),
    'calls', (select coalesce(jsonb_agg(jsonb_build_object('id', k.id, 'rank', k.rank, 'status', k.status,
                 'start', k.scheduled_start, 'end', k.scheduled_end)), '[]'::jsonb) from crm_calls k where k.cycle_id = c.id))), '[]'::jsonb)
  from crm_cycles c left join crm_people p on p.id = c.person_id left join crm_members m on m.id = c.owner_id
  where c.status = 'active' and coalesce(c.last_event_at, c.opened_at) > now() - make_interval(days => p_days)
$$;
revoke execute on function crm_sla_snapshot(int) from public, anon, authenticated;
grant execute on function crm_sla_snapshot(int) to service_role;

create or replace function crm_setting_snapshot() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'person', p.full_name, 'setter_id', p.setter_id, 'status', p.setting_status,
    'since', p.setting_since, 'due_at', p.setting_due_at, 'last_at', p.setting_last_at, 'attempts', p.setting_attempts, 'source', p.lead_source,
    'cycle_id', (select c.id from crm_cycles c where c.person_id = p.id and c.status::text = 'active' order by c.opened_at desc limit 1))), '[]'::jsonb)
  from crm_people p
  where p.merged_into is null and p.setting_status in
    ('a_contacter', 'relance', 'qualification', 'rdv_a_confirmer', 'appel_confirmation', 'rdv_pose', 'rdv_confirme', 'reconfirmation', 'a_replanifier', 'absent_rattrapage')
$$;
revoke execute on function crm_setting_snapshot() from public, anon, authenticated;
grant execute on function crm_setting_snapshot() to service_role;

-- une alerte peut viser un lead sans cycle (le setter, avant le RDV) et une autre personne que le commercial du cycle
alter table crm_sla_alerts alter column cycle_id drop not null;
create or replace function crm_sync_sla_alerts(p_items jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare it jsonb; k text; n_open int := 0; n_upd int := 0; n_done int := 0; n_closed int := 0; keys text[] := '{}';
        cyc uuid; per uuid; own uuid;
begin
  for it in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    k := it->>'key'; keys := keys || k;
    cyc := nullif(it->>'cycle_id', '')::uuid;
    per := coalesce(nullif(it->>'person_id', '')::uuid, (select person_id from crm_cycles where id = cyc));
    own := case when it ? 'owner_id' then nullif(it->>'owner_id', '')::uuid else (select owner_id from crm_cycles where id = cyc) end;
    if per is null then continue; end if;
    update crm_sla_alerts a set level = it->>'level', crossed_at = (it->>'crossed_at')::timestamptz, detail = it->>'detail',
           owner_id = own, person_id = per, cycle_id = coalesce(cyc, a.cycle_id), updated_at = now()
     where a.key = k and a.resolved_at is null
       and (a.level is distinct from it->>'level' or a.owner_id is distinct from own or a.cycle_id is distinct from coalesce(cyc, a.cycle_id));
    if found then n_upd := n_upd + 1; continue; end if;
    if exists (select 1 from crm_sla_alerts where key = k and resolved_at is null) then continue; end if;
    insert into crm_sla_alerts (key, cycle_id, person_id, owner_id, sla, kind, level, name, detail, target, started_at, crossed_at)
    values (k, cyc, per, own, it->>'sla', coalesce(nullif(it->>'kind', ''), 'sales'), it->>'level', it->>'name', it->>'detail', it->>'target',
            (it->>'started_at')::timestamptz, (it->>'crossed_at')::timestamptz);
    n_open := n_open + 1;
  end loop;
  update crm_sla_alerts set resolved_at = now(), resolution = 'done', updated_at = now()
   where resolved_at is null and not (key = any(keys));
  get diagnostics n_done = row_count;
  update crm_sla_alerts a set resolved_at = now(), resolution = 'closed', updated_at = now()
    from crm_cycles c where a.resolved_at is null and c.id = a.cycle_id and c.status::text <> 'active';
  get diagnostics n_closed = row_count;
  return jsonb_build_object('opened', n_open, 'updated', n_upd, 'done', n_done, 'closed', n_closed);
end $$;
revoke execute on function crm_sync_sla_alerts(jsonb) from public, anon, authenticated;
grant execute on function crm_sync_sla_alerts(jsonb) to service_role;

-- la fonction CRM d'une personne de l'équipe (Paramètres › Compte › Accès de l'équipe, par web/api/team.js) : commercial ou setter
create or replace function crm_set_member_role(p_member uuid, p_role text) returns text
language plpgsql security definer set search_path = public as $$
begin
  if p_role not in ('sales', 'setter') then raise exception 'Fonction inconnue' using errcode = '22023'; end if;
  update crm_members set role = p_role::member_role where id = p_member and role::text in ('sales', 'setter', 'viewer');
  if not found then raise exception 'Fonction inchangée : la personne est administratrice ou n''a pas de fiche dans le CRM' using errcode = 'P0002'; end if;
  return p_role;
end $$;
revoke execute on function crm_set_member_role(uuid, text) from public, anon, authenticated;
grant execute on function crm_set_member_role(uuid, text) to service_role;

-- process-inbox lit aussi les leads des funnels
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
                 where source::text in ('iclosed', 'whatsapp', 'fathom', 'funnel') and status in ('received', 'failed') and attempts < 8)
$job$);
  end if;
end $$;
