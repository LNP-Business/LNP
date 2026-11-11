-- 059 · Le CRM LNP est la seule source de vérité des statuts (Romain, 2026-11-11 : « iClosed est juste là pour pouvoir extraire
-- les leads. Il faut ignorer le status des leads dans iClosed. C'est le status du CRM LNP qui est source de vérité. »)
-- Ce qu'on garde d'iClosed : le lead (nom, e-mail, téléphone), la date et l'heure de chaque RDV, ses déplacements et ses
-- annulations (pour les rappels et les alertes), et le montant d'une vente, affiché pour information dans la fiche.
-- Ce qu'on ignore : honoré, absent, gagné, perdu, disqualifié, et les paiements iClosed (les paiements viennent de Whop ou
-- de la fenêtre d'encaissement). L'historique déjà importé reste tel quel.
-- Webinaire (même date) : le setter ne reprend un lead webinaire que s'il a assisté au webinaire sans prendre de RDV, s'il était
-- absent au webinaire et n'a pas répondu en 48 h, ou s'il était absent à son RDV de vente et n'a pas répondu en 24 h.
-- Sans danger si rejoué.

-- ───────────── 1. les appels iClosed : la date seulement, jamais l'issue ni la clôture ─────────────
create or replace function crm_import_calls(p_items jsonb, p_dry boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare it jsonb; c jsonb; ids jsonb; persons uuid[]; pid uuid; cid uuid; call_id uuid; owner uuid; v text; em text; ph text;
        st jsonb := '{"people":0,"created_people":0,"cycles_opened":0,"calls":0,"calls_known":0,"closed":{},"conflicts":0,"skipped":0}';
        first_at timestamptz;
begin
  begin
    for it in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
      ids := '[]'::jsonb;
      for em in select lower(trim(x)) from jsonb_array_elements_text(coalesce(it#>'{identity,email}', '[]')) x where x like '%@%' loop
        ids := ids || jsonb_build_object('k', 'email', 'v', em);
      end loop;
      for ph in select x from jsonb_array_elements_text(coalesce(it#>'{identity,phone}', '[]')) x where x ~ '^\+[0-9]{8,15}$' loop
        ids := ids || jsonb_build_object('k', 'phone', 'v', ph);
      end loop;
      v := nullif(trim(it#>>'{identity,iclosed_contact_id}'), '');
      if v is not null then ids := ids || jsonb_build_object('k', 'iclosed_contact_id', 'v', v); end if;
      if jsonb_array_length(ids) = 0 or jsonb_array_length(coalesce(it->'calls', '[]')) = 0 then
        st := jsonb_set(st, '{skipped}', to_jsonb((st->>'skipped')::int + 1)); continue;
      end if;
      select coalesce(array_agg(distinct coalesce(p.merged_into, p.id)), '{}') into persons
        from jsonb_array_elements(ids) x
        join crm_person_identities i on i.kind::text = x->>'k' and i.value = x->>'v'
        join crm_people p on p.id = i.person_id;
      if array_length(persons, 1) > 1 then
        st := jsonb_set(st, '{conflicts}', to_jsonb((st->>'conflicts')::int + 1)); continue;   -- never guess
      end if;
      pid := persons[1];
      if pid is null then
        insert into crm_people (full_name, primary_email, primary_phone)
        values (nullif(trim(it->>'name'), ''),
                (select x->>'v' from jsonb_array_elements(ids) x where x->>'k' = 'email' limit 1),
                (select x->>'v' from jsonb_array_elements(ids) x where x->>'k' = 'phone' limit 1))
        returning id into pid;
        st := jsonb_set(st, '{created_people}', to_jsonb((st->>'created_people')::int + 1));
      end if;
      insert into crm_person_identities (person_id, kind, value, source)
      select pid, (x->>'k')::identity_kind, x->>'v', 'import' from jsonb_array_elements(ids) x
      on conflict (kind, value) do nothing;
      st := jsonb_set(st, '{people}', to_jsonb((st->>'people')::int + 1));

      -- the cycle: the one already holding one of these calls, else the person's latest, else a new one
      select k.cycle_id into cid from crm_calls k
       where k.iclosed_call_id in (select x->>'iclosed_call_id' from jsonb_array_elements(it->'calls') x) limit 1;
      if cid is null then select id into cid from crm_cycles where person_id = pid order by opened_at desc limit 1; end if;
      first_at := (select min(coalesce(nullif(x->>'booked_at', ''), x->>'start')::timestamptz) from jsonb_array_elements(it->'calls') x);
      if cid is null then
        insert into crm_cycles (person_id, owner_id, opened_at)
        values (pid, crm_owner_for(it#>>'{calls,0,host_email}'), first_at) returning id into cid;
        st := jsonb_set(st, '{cycles_opened}', to_jsonb((st->>'cycles_opened')::int + 1));
      else
        update crm_cycles set opened_at = least(opened_at, first_at) where id = cid;
      end if;

      for c in select * from jsonb_array_elements(it->'calls') loop
        if exists (select 1 from crm_calls where iclosed_call_id = c->>'iclosed_call_id') then
          st := jsonb_set(st, '{calls_known}', to_jsonb((st->>'calls_known')::int + 1)); continue;   -- seen live or earlier
        end if;
        owner := crm_owner_for(c->>'host_email');
        insert into crm_calls (cycle_id, rank, iclosed_call_id, scheduled_start, scheduled_end, status, host_id)
        values (cid, (select coalesce(max(rank), 0) + 1 from crm_calls where cycle_id = cid), c->>'iclosed_call_id',
                nullif(c->>'start', '')::timestamptz, nullif(c->>'end', '')::timestamptz, (case when c->>'status' = 'canceled' then 'canceled' else 'scheduled' end)::call_status, owner)
        returning id into call_id;
        insert into crm_events (person_id, cycle_id, call_id, occurred_at, actor, channel, type, data, source, source_id)
        values (pid, cid, call_id, coalesce(nullif(c->>'booked_at', ''), c->>'start')::timestamptz, 'prospect', 'booking', 'call_booked',
                coalesce(c->'data', '{}') || jsonb_build_object('start', c->>'start', 'end', c->>'end', 'host_email', c->>'host_email'),
                'import', 'import:call:' || (c->>'iclosed_call_id') || ':booked')
        on conflict (source, source_id) do nothing;
        if c->>'status' = 'canceled' then
          insert into crm_events (person_id, cycle_id, call_id, occurred_at, actor, channel, type, data, source, source_id)
          values (pid, cid, call_id, coalesce(nullif(c->>'canceled_at', ''), c->>'start')::timestamptz, 'system', 'booking', 'call_canceled',
                  jsonb_build_object('cancel_reason', c#>>'{data,cancel_reason}'), 'import', 'import:call:' || (c->>'iclosed_call_id') || ':canceled')
          on conflict (source, source_id) do nothing;
        end if;
        st := jsonb_set(st, '{calls}', to_jsonb((st->>'calls')::int + 1));
      end loop;

      -- 059: iClosed never closes a cycle (won, lost, disqualified are the CRM's)
      perform crm_recompute_cycle(cid);
    end loop;
    if p_dry then raise exception 'dry run' using errcode = 'P0D01'; end if;
  exception when sqlstate 'P0D01' then
    null;   -- dry run: everything above is rolled back, the counts stay
  end;
  return st;
end $$;


revoke execute on function crm_import_calls(jsonb, boolean) from public, anon, authenticated;
grant execute on function crm_import_calls(jsonb, boolean) to service_role;

-- ───────────── 2. les ventes iClosed : un montant pour information, sans statut ni paiement ─────────────
create or replace function crm_import_deals(p_items jsonb, p_dry boolean default false) returns jsonb
language plpgsql security definer set search_path = public as $$
declare it jsonb; cyc uuid; per uuid; at timestamptz; amt numeric; kind text; txt text;
        n_items int := 0; n_matched int := 0; n_unmatched int := 0; n_new int := 0; n_updated int := 0;
begin
  for it in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    n_items := n_items + 1;
    cyc := null;
    select k.cycle_id into cyc from crm_calls k where k.iclosed_call_id = it->>'iclosed_call_id';
    if cyc is null then
      select c.id into cyc from crm_person_identities i join crm_people p on p.id = i.person_id
        join crm_cycles c on c.person_id = coalesce(p.merged_into, p.id)
       where i.kind = 'iclosed_contact_id' and i.value = it->>'iclosed_contact_id'
       order by c.opened_at desc nulls last limit 1;
    end if;
    if cyc is null then n_unmatched := n_unmatched + 1; continue; end if;
    n_matched := n_matched + 1;
    amt := nullif(it->>'value', '')::numeric;
    if amt is null or amt <= 0 then continue; end if;
    at := coalesce(nullif(it->>'at', '')::timestamptz, now());
    kind := case when upper(it->>'type') = 'DEPOSIT' then 'acompte' else 'vente' end;
    txt := 'iClosed (pour information) : ' || kind || ' de ' || to_char(amt, 'FM999G999G990') || ' €'
           || coalesce(' · ' || nullif(it->>'product', ''), '') || ' · le statut et les paiements se gèrent dans le CRM';
    if exists (select 1 from crm_events where source = 'iclosed' and source_id = 'deal-info:' || (it->>'iclosed_deal_id')) then
      n_updated := n_updated + 1; else n_new := n_new + 1; end if;
    if p_dry then continue; end if;
    insert into crm_events (person_id, cycle_id, occurred_at, actor, channel, type, content, data, source, source_id)
    select c.person_id, cyc, at, 'system', 'crm', 'iclosed_deal', txt,
           jsonb_build_object('amount', amt, 'kind', it->>'type', 'product', it->>'product', 'iclosed_deal_id', it->>'iclosed_deal_id'),
           'iclosed', 'deal-info:' || (it->>'iclosed_deal_id')
      from crm_cycles c where c.id = cyc
    on conflict (source, source_id) do update set content = excluded.content, data = excluded.data, occurred_at = excluded.occurred_at;
  end loop;
  return jsonb_build_object('deals', n_items, 'matched', n_matched, 'unmatched', n_unmatched, 'new', n_new, 'updated', n_updated,
                            'info_only', true, 'dry', p_dry);
end $$;
revoke execute on function crm_import_deals(jsonb, boolean) from public, anon, authenticated;
grant execute on function crm_import_deals(jsonb, boolean) to service_role;

-- le montant iClosed n'est qu'une information : il n'arrête ni ne démarre aucune alerte
create or replace function crm_sla_snapshot(p_days int default 60) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', c.id, 'opened_at', c.opened_at, 'person', p.full_name, 'owner', m.full_name, 'owner_key', m.member_key,
    'events', (select coalesce(jsonb_agg(jsonb_build_object('type', e.type, 'at', e.occurred_at, 'actor', e.actor, 'channel', e.channel,
                 'call_id', e.call_id, 'source', e.source) order by e.occurred_at), '[]'::jsonb)
                 from crm_events e where e.cycle_id = c.id and e.occurred_at > now() - make_interval(days => p_days)
                  and e.type not in ('setter_action', 'lead_in', 'iclosed_deal')),
    'calls', (select coalesce(jsonb_agg(jsonb_build_object('id', k.id, 'rank', k.rank, 'status', k.status,
                 'start', k.scheduled_start, 'end', k.scheduled_end)), '[]'::jsonb) from crm_calls k where k.cycle_id = c.id))), '[]'::jsonb)
  from crm_cycles c left join crm_people p on p.id = c.person_id left join crm_members m on m.id = c.owner_id
  where c.status = 'active' and coalesce(c.last_event_at, c.opened_at) > now() - make_interval(days => p_days)
$$;
revoke execute on function crm_sla_snapshot(int) from public, anon, authenticated;
grant execute on function crm_sla_snapshot(int) to service_role;

-- ───────────── 3. webinaire : le setter seulement dans trois cas ─────────────
-- en attente d'une réponse : webinaire_absent (48 h après le webinaire manqué), absent_attente (24 h après un RDV de vente
-- manqué) ; sans réponse du prospect dans ce délai, le lead passe au setter (crm_setting_tick, toutes les 10 min)
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
    when 'webinaire_absent' then return p_since + interval '48 hours';
    when 'absent_attente' then return p_since + interval '24 hours';
    else return null;   -- rdv_confirme (les rappels partent seuls), transmis, injoignable, non_qualifie
  end case;
end $$;

-- l'entrée d'un lead : un lead webinaire n'est au setter que s'il a assisté sans prendre de RDV ; absent au webinaire, il attend
-- une réponse 48 h ; avec un RDV, il va directement au commercial
create or replace function crm_lead_item(it jsonb, p_actor uuid default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare persons uuid[]; pid uuid; at timestamptz := coalesce((it->>'occurred_at')::timestamptz, now()); src text := coalesce(nullif(it#>>'{data,source}', ''), 'quiz');
        p crm_people; cid uuid; srcname text; booked boolean := coalesce((it#>>'{data,booked}')::boolean, false);
        attended boolean := (it#>>'{data,attended}')::boolean; web boolean;
        idn jsonb := jsonb_strip_nulls(jsonb_build_object('email', nullif(lower(trim(it#>>'{identity,email}')), ''),
                       'phone', nullif(trim(it#>>'{identity,phone}'), ''), 'name', nullif(trim(it#>>'{identity,name}'), '')));
begin
  web := src = 'webinaire';
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
         -- un lead webinaire n'a de setter que lorsqu'il passe au setter (crm_setting_tick ou ci-dessous)
         setter_id = case when web and not (attended is true and not booked) then setter_id
                          else coalesce(setter_id, case when p_actor is not null and exists (select 1 from crm_members where id = p_actor and role::text = 'setter') then p_actor end, crm_pick_setter()) end,
         updated_at = now()
   where id = pid;
  select id into cid from crm_cycles where person_id = pid and status::text = 'active' order by opened_at desc limit 1;
  srcname := case src when 'quiz' then 'quiz complété' when 'vsl' then 'opt-in VSL' when 'quiz_abandon' then 'quiz abandonné'
                      when 'webinaire' then case when booked then 'webinaire, RDV pris' when attended is true then 'webinaire, présent sans RDV'
                                                  when attended is false then 'webinaire, absent' else 'webinaire' end
                      when 'manuel' then 'saisi à la main' else src end;
  insert into crm_events (person_id, cycle_id, occurred_at, actor, member_id, channel, type, content, data, source, source_id)
  values (pid, cid, at, 'prospect', p_actor, 'crm', 'lead_in', 'Lead reçu : ' || srcname,
          jsonb_build_object('source', src, 'booked', booked, 'attended', attended), 'funnel',
          coalesce(nullif(it->>'source_id', ''), 'funnel:' || pid || ':' || extract(epoch from at)))
  on conflict (source, source_id) do nothing;
  if not found then return pid; end if;   -- déjà reçu
  select * into p from crm_people where id = pid;
  -- un lead déjà en cours (RDV, qualification…) garde son statut ; un lead en nurture ou nouveau est à contacter
  if p.setting_status is null or p.setting_status in ('injoignable', 'non_qualifie', 'webinaire_absent') then
    if booked then
      if web and p.setting_status = 'webinaire_absent' then
        update crm_people set setting_status = null, setting_due_at = null, setting_last_action = 'RDV pris après le webinaire',
               setting_last_at = at, updated_at = now() where id = pid;
      end if;
    elsif not web or attended is true then
      perform crm_setting_move(pid, 'a_contacter', 'lead_in', 'Lead reçu : ' || srcname, null, p_actor, 0, at);
    elsif p.setting_status is null then
      perform crm_setting_move(pid, 'webinaire_absent', 'lead_in', 'Absent au webinaire · attente d’une réponse', null, p_actor, 0, at);
    end if;
  end if;
  return pid;
end $$;
revoke execute on function crm_lead_item(jsonb, uuid) from public, anon, authenticated;

-- les RDV iClosed (dates seulement) et les issues déclarées dans le CRM font bouger le statut setter
create or replace function crm_setting_on_call() returns trigger
language plpgsql security definer set search_path = public as $$
declare pid uuid; s text; recent boolean; web boolean;
begin
  if new.rank is distinct from 1 then return new; end if;
  select person_id into pid from crm_cycles where id = new.cycle_id;
  if pid is null then return new; end if;
  select setting_status, coalesce(lead_source, '') = 'webinaire' into s, web from crm_people where id = pid;
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
    elsif web and (s is null or s in ('webinaire_absent', 'absent_attente')) then
      -- un lead webinaire qui réserve seul va directement au commercial : le setter n'a rien à confirmer
      if s is not null then
        update crm_people set setting_status = null, setting_due_at = null, setting_last_action = 'RDV de vente réservé',
               setting_last_at = now(), updated_at = now() where id = pid;
      end if;
    else
      perform crm_setting_move(pid, 'rdv_a_confirmer', 'call_booked', 'RDV réservé dans iClosed', null, null, 0);
    end if;
  elsif tg_op = 'UPDATE' and new.status is distinct from old.status then
    if new.status::text = 'no_show' then
      if web and (s is null or s in ('transmis', 'webinaire_absent')) then
        perform crm_setting_move(pid, 'absent_attente', 'no_show', 'Absent au RDV de vente · attente d’une réponse', null, null, 0);
      else
        perform crm_setting_move(pid, 'absent_rattrapage', 'no_show', 'Absent au RDV', null, null, 0);
      end if;
    elsif new.status::text = 'held' and s is not null and s is distinct from 'transmis' then
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

-- toutes les 10 min : sans réponse du prospect dans le délai, le lead webinaire passe au setter ; avec une réponse, il reste
-- au commercial (ou à l'équipe) sans statut setter
create or replace function crm_setting_tick(p_now timestamptz default now()) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r record; n_set int := 0; n_replied int := 0; replied boolean;
begin
  for r in select p.id, p.setting_status, p.setting_since from crm_people p
            where p.merged_into is null and p.setting_status in ('webinaire_absent', 'absent_attente') loop
    replied := exists (select 1 from crm_events e where e.person_id = r.id and e.type = 'message_in' and e.occurred_at > r.setting_since);
    if replied then
      update crm_people set setting_status = null, setting_due_at = null, setting_last_action = 'Le prospect a répondu',
             setting_last_at = p_now, updated_at = now() where id = r.id;
      n_replied := n_replied + 1;
    elsif p_now >= r.setting_since + (case r.setting_status when 'webinaire_absent' then interval '48 hours' else interval '24 hours' end) then
      update crm_people set setter_id = coalesce(setter_id, crm_pick_setter()) where id = r.id;
      if r.setting_status = 'webinaire_absent' then
        perform crm_setting_move(r.id, 'a_contacter', 'sans_reponse', 'Absent au webinaire, sans réponse en 48 h', null, null, 0, p_now);
      else
        perform crm_setting_move(r.id, 'absent_rattrapage', 'sans_reponse', 'Absent au RDV de vente, sans réponse en 24 h', null, null, 0, p_now);
      end if;
      n_set := n_set + 1;
    end if;
  end loop;
  return jsonb_build_object('to_setter', n_set, 'replied', n_replied);
end $$;
revoke execute on function crm_setting_tick(timestamptz) from public, anon, authenticated;
grant execute on function crm_setting_tick(timestamptz) to service_role;

do $$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'crm-setting-tick';
    perform cron.schedule('crm-setting-tick', '*/10 * * * *', $job$ select public.crm_setting_tick() $job$);
  end if;
end $$;
