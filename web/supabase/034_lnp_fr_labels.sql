-- LNP CRM — French labels in an existing database (web/supabase/034_lnp_fr_labels.sql), after 033.
-- Romain 2026-11-03: everything a person reads in the LNP app is in French (docs/lnp/GLOSSAIRE.md). Files 003 to 033 now
-- seed and return French text; this file brings a database built from their English versions to the same state:
--   1. the labels already loaded (stages, reason codes, rule descriptions, alert rule names c1–c18, next moves of the
--      cycles, payment plan labels, unmatched-item reasons, a replaced analysis job's error): an English default becomes
--      its French text; a label someone changed by hand is left alone;
--   2. the latest definition of every function whose returned or raised text was translated (create or replace: same
--      signatures, grants kept).
-- Keys, codes, enum values and column names are unchanged; crm_settings.sla_alerts (channel #sales-cycle) is untouched.
-- Safe to run again.

-- ───────────────────────── 1. labels already loaded ─────────────────────────
update crm_stage_definitions d set label = m.fr
  from (values ('show', 'Show', 'Présence'), ('decision', 'Decision', 'Décision'), ('cash', 'Cash', 'Encaissement')) m(k, en, fr)
 where d.key = m.k and d.label = m.en;

update crm_reason_codes r set label = m.fr
  from (values
    ('timing', 'Timing', 'Pas le bon moment'),
    ('partner', 'Partner or associate', 'Conjoint ou associé'),
    ('price', 'Price', 'Prix'),
    ('trust', 'Lack of trust', 'Manque de confiance'),
    ('competitor', 'Competitor', 'Concurrent'),
    ('unreachable', 'Unreachable', 'Injoignable'),
    ('unpaid', 'Payment not made', 'Paiement non effectué'),
    ('refunded', 'Refunded', 'Remboursé'),
    ('dq_off_target', 'Off target', 'Hors cible'),
    ('dq_budget', 'Budget impossible', 'Budget impossible'),
    ('dq_not_decider', 'Not a decision maker', 'Pas décisionnaire'),
    ('dq_fake', 'Fake contact or spam', 'Faux contact ou spam'),
    ('dq_customer', 'Already a customer', 'Déjà client'),
    ('dq_out_of_offer', 'Request outside the offer', 'Demande hors offre')) m(code, en, fr)
 where r.code = m.code and r.label = m.en;

update crm_rules r set description = m.fr
  from (values
    ('auto_lost_unreachable', 'Decided: 30 days without reply and at least 4 attempts. Attempt definition DEFERRED.',
     'Décidé : 30 jours sans réponse et au moins 4 tentatives. Définition d''une tentative à préciser.'),
    ('unpaid_yes', 'Proposal (the 48 h alert is rule c7)', 'Proposition (l''alerte à 48 h est la règle c7)'),
    ('not_recorded', 'Held call with no Fathom recording', 'Appel honoré sans enregistrement Fathom'),
    ('next_move', 'Who must act: DEFERRED wording and logic', 'Qui doit agir : formulation et logique à préciser'),
    ('nurture_cadence', 'Archive after 6 months decided; cadence proposal', 'Archivage après 6 mois décidé ; cadence proposée'),
    ('warming_steps', 'Warming steps of the current CRM, per scheduled call', 'Étapes de préparation du CRM actuel, par appel prévu')) m(k, en, fr)
 where r.key = m.k and r.description = m.en;

-- the names of the CRM alert rules c1–c18 (thresholds, severities and recipients kept)
update crm_settings s set value = (
    select jsonb_agg(case when m.fr is not null then x.e || jsonb_build_object('name', m.fr) else x.e end order by x.o)
      from jsonb_array_elements(s.value) with ordinality x(e, o)
      left join (values
        ('Call outcome missing', 'Issue de l''appel manquante'),
        ('Prospect waiting for a reply', 'Prospect en attente de réponse'),
        ('Follow-up due', 'Relance à faire'),
        ('Call to rebook', 'Appel à replanifier'),
        ('Stage over target', 'Étape au-delà de l''objectif'),
        ('Stage critical', 'Étape critique'),
        ('Yes without payment', 'Oui sans paiement'),
        ('Payment blocked', 'Paiement bloqué'),
        ('Refund or dispute', 'Remboursement ou litige'),
        ('Payment without a declared yes', 'Paiement sans oui déclaré'),
        ('Recording and outcome disagree', 'Enregistrement et issue en désaccord'),
        ('Message not delivered', 'Message non distribué'),
        ('Lead abandoned', 'Prospect abandonné'),
        ('Automatic loss tomorrow', 'Perte automatique demain'),
        ('Nurture return due', 'Retour de maturation à faire'),
        ('Unmatched items waiting', 'Éléments non rattachés en attente'),
        ('A source went silent', 'Une source ne répond plus'),
        ('Reconciliation gap', 'Écart de rapprochement')) m(en, fr) on m.en = x.e->>'name')
 where s.key = 'alert_rule_defaults' and jsonb_typeof(s.value) = 'array'
   and exists (select 1 from jsonb_array_elements(s.value) y(e)
                where y.e->>'name' in ('Call outcome missing', 'Prospect waiting for a reply', 'Follow-up due', 'Call to rebook',
                  'Stage over target', 'Stage critical', 'Yes without payment', 'Payment blocked', 'Refund or dispute',
                  'Payment without a declared yes', 'Recording and outcome disagree', 'Message not delivered', 'Lead abandoned',
                  'Automatic loss tomorrow', 'Nurture return due', 'Unmatched items waiting', 'A source went silent', 'Reconciliation gap'));

-- the next move of each cycle (the projector writes French from now on; this rewrites the stored ones)
update crm_cycles c set next_move = jsonb_set(c.next_move, '{label}', to_jsonb(
    case c.next_move->>'label'
      when 'Declare the call outcome' then 'Déclarer l''issue de l''appel'
      when 'Rebook the call' then 'Reprendre un rendez-vous'
      when 'Plan a reschedule' then 'Replanifier l''appel'
      when 'Follow up' then 'Relancer'
      else regexp_replace(c.next_move->>'label', '^Call R', 'Appel R') end))
 where jsonb_typeof(c.next_move) = 'object'
   and (c.next_move->>'label' in ('Declare the call outcome', 'Rebook the call', 'Plan a reschedule', 'Follow up')
        or c.next_move->>'label' ~ '^Call R[0-9]+$');

-- payment plan labels written by crm_set_payment_plan (024) and the outcome form
update crm_deals set payment_plan = case when payment_plan = 'Paid in full' then 'Payé en une fois'
                                         else regexp_replace(payment_plan, '^([0-9]+) instalments$', '\1 échéances') end
 where payment_plan = 'Paid in full' or payment_plan ~ '^[0-9]+ instalments$';
update crm_call_outcomes set payment_plan = case when payment_plan = 'Paid in full' then 'Payé en une fois'
                                                 else regexp_replace(payment_plan, '^([0-9]+) instalments$', '\1 échéances') end
 where payment_plan = 'Paid in full' or payment_plan ~ '^[0-9]+ instalments$';

-- why an item waits in the unmatched inbox
update crm_unmatched_inbox u set reason = m.fr
  from (values
    ('Cancellation of a call the CRM never saw', 'Annulation d''un appel inconnu du CRM'),
    ('Identifiers point to several people', 'Les identifiants désignent plusieurs personnes'),
    ('Several people have this phone number', 'Plusieurs personnes ont ce numéro de téléphone'),
    ('Contact update for a person the CRM never saw', 'Mise à jour d''un contact inconnu du CRM'),
    ('New email or phone already belongs to another person', 'Nouvel e-mail ou téléphone déjà attribué à une autre personne'),
    ('Fathom recording: several leads match', 'Enregistrement Fathom : plusieurs prospects correspondent')) m(en, fr)
 where u.reason = m.en;

-- an analysis stopped because a new transcript replaced it (020)
update crm_ca_jobs set error = 'remplacée par une nouvelle transcription' where error = 'replaced by a new transcript';

-- ───────────────────────── 2. functions that return or raise text (latest definition of each) ─────────────────────────

-- latest definition: 004_crm_rpc.sql
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
  raise exception 'Action non autorisée pour le rôle %', me.role using errcode = '42501';
end $$;

-- latest definition: 004_crm_rpc.sql
create or replace function crm_admin_set_member(
  p_email text, p_member_key text, p_full_name text, p_role member_role,
  p_lead_key text default null, p_iclosed_email text default null, p_fathom_email text default null,
  p_sendblue_number text default null, p_active boolean default true
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
  insert into crm_members (id, member_key, full_name, email, role, lead_id, iclosed_email, fathom_email, sendblue_number, active)
  values (uid, p_member_key, p_full_name, lower(trim(p_email)), p_role, lead, p_iclosed_email, p_fathom_email, p_sendblue_number, p_active)
  on conflict (id) do update set member_key = excluded.member_key, full_name = excluded.full_name, email = excluded.email,
    role = excluded.role, lead_id = excluded.lead_id, iclosed_email = excluded.iclosed_email,
    fathom_email = excluded.fathom_email, sendblue_number = excluded.sendblue_number, active = excluded.active;
  select id into actor from crm_members where id = auth.uid();
  perform crm_audit(actor, 'set_member', 'crm_members', uid::text, before, (select to_jsonb(m) from crm_members m where id = uid));
  return uid;
end $$;

-- latest definition: 004_crm_rpc.sql
create or replace function crm_add_note(p_cycle uuid, p_text text) returns bigint
language plpgsql security definer set search_path = public as $$
declare me crm_members; cy crm_cycles; eid bigint; t timestamptz := now();
begin
  me := crm_require(array['admin', 'sales_lead']::member_role[], p_cycle);
  select * into cy from crm_cycles where id = p_cycle;
  if cy.id is null then raise exception 'Cycle inconnu'; end if;
  if coalesce(trim(p_text), '') = '' then raise exception 'Note vide'; end if;
  insert into crm_events (person_id, cycle_id, occurred_at, actor, member_id, channel, type, content, source, source_id)
  values (cy.person_id, cy.id, t, 'sales', me.id, 'crm', 'note', trim(p_text), 'crm', 'crm:note:' || gen_random_uuid())
  returning id into eid;
  perform crm_audit(me.id, 'add_note', 'crm_cycles', p_cycle::text, null, jsonb_build_object('event_id', eid));
  return eid;
end $$;

-- latest definition: 004_crm_rpc.sql
create or replace function crm_reassign_cycle(p_cycle uuid, p_member uuid) returns void
language plpgsql security definer set search_path = public as $$
declare me crm_members; before uuid;
begin
  me := crm_require(array['admin', 'sales_lead']::member_role[]);
  if not exists (select 1 from crm_members where id = p_member and active and role <> 'viewer') then
    raise exception 'Le nouveau commercial attitré doit être un membre actif du CRM qui vend';
  end if;
  select owner_id into before from crm_cycles where id = p_cycle;
  if not found then raise exception 'Cycle inconnu'; end if;
  update crm_cycles set owner_id = p_member where id = p_cycle;
  update crm_alerts set owner_id = p_member, owner_key = (select member_key from crm_members where id = p_member)
   where cycle_id = p_cycle and resolved_at is null;
  perform crm_audit(me.id, 'reassign_cycle', 'crm_cycles', p_cycle::text, jsonb_build_object('owner_id', before),
    jsonb_build_object('owner_id', p_member));
end $$;

-- latest definition: 004_crm_rpc.sql
create or replace function crm_cancel_auto_close(p_cycle uuid) returns timestamptz
language plpgsql security definer set search_path = public as $$
declare me crm_members; days int; until_at timestamptz;
begin
  me := crm_require(array['admin', 'sales_lead']::member_role[], p_cycle);
  if not exists (select 1 from crm_cycles where id = p_cycle) then raise exception 'Cycle inconnu'; end if;
  select coalesce(max((params->>'snooze_days')::int), 7) into days from crm_rules where kind = 'auto_close';
  until_at := now() + make_interval(days => days);
  perform crm_audit(me.id, 'cancel_auto_close', 'crm_cycles', p_cycle::text, null, jsonb_build_object('suppressed_until', until_at));
  return until_at;
end $$;

-- latest definition: 004_crm_rpc.sql
create or replace function crm_set_nurture(p_person uuid, p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare me crm_members; cyc uuid; tr crm_nurture_tracks; t timestamptz := now(); act text := p->>'action';
begin
  cyc := coalesce(nullif(p->>'cycle_id', '')::uuid,
    (select id from crm_cycles where person_id = p_person order by opened_at desc limit 1));
  me := crm_require(array['admin', 'sales_lead']::member_role[], cyc);
  select * into tr from crm_nurture_tracks where person_id = p_person and status = 'active';
  if act = 'enter' then
    if tr.id is not null then raise exception 'Déjà en maturation'; end if;
    if cyc is null then raise exception 'La maturation a besoin du cycle d''origine'; end if;
    if exists (select 1 from crm_people where id = p_person and opted_out_at is not null) then
      raise exception 'Cette personne a refusé les messages';
    end if;
    insert into crm_nurture_tracks (person_id, origin_cycle_id, reason_code, intensity, owner_id, entered_at, return_date)
    values (p_person, cyc, nullif(p->>'reason_code', ''), coalesce(nullif(p->>'intensity', ''), 'standard')::nurture_choice,
      coalesce((select owner_id from crm_cycles where id = cyc), me.id), t, nullif(p->>'return_date', '')::date)
    returning * into tr;
    insert into crm_events (person_id, cycle_id, occurred_at, actor, member_id, channel, type, data, source, source_id)
    values (p_person, cyc, t, 'sales', me.id, 'crm', 'nurture_entered', jsonb_build_object('nurture_id', tr.id),
      'crm', 'crm:crm_nurture_tracks:' || tr.id || ':entered');
  elsif act = 'leave' then
    if tr.id is null then raise exception 'Pas en maturation'; end if;
    update crm_nurture_tracks set status = 'removed', ended_at = t where id = tr.id;
  elsif act = 'set_return' then
    if tr.id is null then raise exception 'Pas en maturation'; end if;
    update crm_nurture_tracks set return_date = nullif(p->>'return_date', '')::date where id = tr.id;
  else
    raise exception 'action doit valoir enter, leave ou set_return';
  end if;
  perform crm_audit(me.id, 'nurture_' || act, 'crm_nurture_tracks', tr.id::text, null, p);
  return tr.id;
end $$;

-- latest definition: 004_crm_rpc.sql
create or replace function crm_resolve_unmatched(p_item uuid, p_person uuid, p_cycle uuid default null) returns void
language plpgsql security definer set search_path = public as $$
declare me crm_members; it crm_unmatched_inbox;
begin
  me := crm_require(array['admin', 'sales_lead']::member_role[]);
  select * into it from crm_unmatched_inbox where id = p_item;
  if it.id is null then raise exception 'Élément inconnu'; end if;
  if it.resolved_at is not null or it.dismissed then raise exception 'Déjà traité'; end if;
  if not exists (select 1 from crm_people where id = p_person and merged_into is null) then raise exception 'Personne inconnue'; end if;
  if p_cycle is not null and not exists (select 1 from crm_cycles where id = p_cycle and person_id = p_person) then
    raise exception 'Ce cycle n''appartient pas à cette personne';
  end if;
  update crm_unmatched_inbox set resolved_person_id = p_person, resolved_cycle_id = p_cycle, resolved_by = me.id, resolved_at = now()
   where id = p_item;
  update crm_webhook_log set status = 'received', attempts = 0, error = null where id = it.inbox_id;
  perform crm_audit(me.id, 'resolve_unmatched', 'crm_unmatched_inbox', p_item::text, to_jsonb(it),
    jsonb_build_object('person_id', p_person, 'cycle_id', p_cycle));
end $$;

-- latest definition: 004_crm_rpc.sql
create or replace function crm_dismiss_unmatched(p_item uuid) returns void
language plpgsql security definer set search_path = public as $$
declare me crm_members;
begin
  me := crm_require(array['admin', 'sales_lead']::member_role[]);
  update crm_unmatched_inbox set dismissed = true, resolved_by = me.id, resolved_at = now()
   where id = p_item and resolved_at is null and not dismissed;
  if not found then raise exception 'Élément inconnu ou déjà traité'; end if;
  perform crm_audit(me.id, 'dismiss_unmatched', 'crm_unmatched_inbox', p_item::text, null, null);
end $$;

-- latest definition: 004_crm_rpc.sql
create or replace function crm_merge_people(p_keep uuid, p_merge uuid) returns void
language plpgsql security definer set search_path = public as $$
declare me crm_members;
begin
  me := crm_require(array['admin', 'sales_lead']::member_role[]);
  if p_keep = p_merge then raise exception 'Même personne'; end if;
  if not exists (select 1 from crm_people where id = p_keep and merged_into is null)
     or not exists (select 1 from crm_people where id = p_merge and merged_into is null) then
    raise exception 'Personne inconnue ou déjà fusionnée';
  end if;
  if exists (select 1 from crm_cycles where person_id = p_keep and status = 'active')
     and exists (select 1 from crm_cycles where person_id = p_merge and status = 'active') then
    raise exception 'Les deux personnes ont un cycle en cours : clôturez-en un d''abord';
  end if;
  if exists (select 1 from crm_nurture_tracks where person_id = p_keep and status = 'active')
     and exists (select 1 from crm_nurture_tracks where person_id = p_merge and status = 'active') then
    raise exception 'Les deux personnes sont en maturation : arrêtez-en une d''abord';
  end if;
  delete from crm_person_identities i where i.person_id = p_merge
     and exists (select 1 from crm_person_identities k where k.person_id = p_keep and k.kind = i.kind and k.value = i.value);
  update crm_person_identities set person_id = p_keep where person_id = p_merge;
  update crm_cycles set person_id = p_keep where person_id = p_merge;
  update crm_events set person_id = p_keep where person_id = p_merge;
  update crm_nurture_tracks set person_id = p_keep where person_id = p_merge;
  update crm_outbound_messages set person_id = p_keep where person_id = p_merge;
  update crm_alerts set person_id = p_keep where person_id = p_merge;
  update crm_people set merged_into = p_keep, updated_at = now() where id = p_merge;
  update crm_people k set opted_out_at = coalesce(k.opted_out_at, m.opted_out_at), updated_at = now()
    from crm_people m where k.id = p_keep and m.id = p_merge;
  perform crm_audit(me.id, 'merge_people', 'crm_people', p_keep::text, jsonb_build_object('merged', p_merge), null);
end $$;

-- latest definition: 004_crm_rpc.sql
create or replace function crm_update_config(p_table text, p_key text, p_value jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare me crm_members; before jsonb; after jsonb;
begin
  me := crm_require(array['admin', 'sales_lead']::member_role[]);
  if p_table = 'crm_settings' then
    select to_jsonb(s) into before from crm_settings s where key = p_key;
    insert into crm_settings (key, value, is_proposal, updated_at) values (p_key, p_value, false, now())
    on conflict (key) do update set value = excluded.value, is_proposal = false, updated_at = now();
    select to_jsonb(s) into after from crm_settings s where key = p_key;
  elsif p_table = 'crm_rules' then
    select to_jsonb(r) into before from crm_rules r where key = p_key;
    if before is null then raise exception 'Règle inconnue % (une nouvelle règle a d''abord besoin de son évaluateur)', p_key; end if;
    update crm_rules set enabled = coalesce((p_value->>'enabled')::boolean, enabled),
      params = coalesce(p_value->'params', params), is_proposal = false, updated_at = now() where key = p_key;
    select to_jsonb(r) into after from crm_rules r where key = p_key;
  elsif p_table = 'crm_stage_definitions' then
    select to_jsonb(d) into before from crm_stage_definitions d where key = p_key;
    if before is null then
      insert into crm_stage_definitions (key, label, position, enter_on, is_proposal)
      values (p_key, coalesce(p_value->>'label', p_key), coalesce((p_value->>'position')::int, 99),
        coalesce(array(select jsonb_array_elements_text(p_value->'enter_on')), '{}'), false);
    end if;
    update crm_stage_definitions set
      label = coalesce(p_value->>'label', label), position = coalesce((p_value->>'position')::int, position),
      enter_on = case when p_value ? 'enter_on' then array(select jsonb_array_elements_text(p_value->'enter_on')) else enter_on end,
      target_hours = case when p_value ? 'target_hours' then (p_value->>'target_hours')::numeric else target_hours end,
      critical_hours = case when p_value ? 'critical_hours' then (p_value->>'critical_hours')::numeric else critical_hours end,
      color = coalesce(p_value->>'color', color), active = coalesce((p_value->>'active')::boolean, active),
      is_proposal = false, updated_at = now()
     where key = p_key;
    select to_jsonb(d) into after from crm_stage_definitions d where key = p_key;
  elsif p_table = 'crm_reason_codes' then
    select to_jsonb(r) into before from crm_reason_codes r where code = p_key;
    if before is null then
      insert into crm_reason_codes (code, kind, label, is_proposal)
      values (p_key, (p_value->>'kind')::reason_kind, coalesce(p_value->>'label', p_key), false);
    end if;
    update crm_reason_codes set label = coalesce(p_value->>'label', label),
      nurture_default = coalesce((p_value->>'nurture_default')::nurture_choice, nurture_default),
      position = coalesce((p_value->>'position')::int, position), active = coalesce((p_value->>'active')::boolean, active),
      is_proposal = false
     where code = p_key;
    select to_jsonb(r) into after from crm_reason_codes r where code = p_key;
  else
    raise exception 'Pas une table de configuration du CRM : %', p_table;
  end if;
  perform crm_audit(me.id, 'update_config', p_table, p_key, before, after);
end $$;

-- latest definition: 004_crm_rpc.sql
create or replace function crm_create_checkout(p_cycle uuid) returns text
language plpgsql security definer set search_path = public as $$
declare me crm_members;
begin
  me := crm_require(array['admin', 'sales_lead']::member_role[], p_cycle);
  raise exception 'Les liens de paiement arrivent en phase 5 (Whop)' using errcode = '0A000';
end $$;

-- latest definition: 004_crm_rpc.sql
create or replace function crm_merge_alert_defaults() returns int
language plpgsql security definer set search_path = public as $$
declare body jsonb; d jsonb; alerts jsonb; vals jsonb; added int := 0; k text; v jsonb;
begin
  if auth.uid() is not null and coalesce(public.my_role(), '') <> 'admin' then
    raise exception 'Seul un administrateur peut modifier les règles d''alerte' using errcode = '42501';
  end if;
  select coalesce(d0.body, '{}'::jsonb) into body from (select 1) x left join docs d0 on d0.col = 'config' and d0.id = 'alerts';
  alerts := coalesce(body->'alerts', '{}'::jsonb);
  vals := coalesce(body->'values', '{}'::jsonb);
  for d in select jsonb_array_elements(value) from crm_settings where key = 'alert_rule_defaults' loop
    if not alerts ? (d->>'id') then
      alerts := alerts || jsonb_build_object(d->>'id', jsonb_build_object(
        'on', true,
        'sev', initcap(d->>'severity'),
        'who', jsonb_build_array(case when (d->'to') ? 'owner' then 1 else 0 end, case when (d->'to') ? 'lead' then 1 else 0 end,
                                 case when (d->'to') ? 'romain' then 1 else 0 end),
        'ch', '[1,0,0]'::jsonb,
        'crm', true));
      added := added + 1;
    end if;
    for k, v in select * from jsonb_each(coalesce(d->'threshold', '{}'::jsonb)) loop
      if jsonb_typeof(v) = 'number' and not vals ? (d->>'id' || '.' || k) then
        vals := vals || jsonb_build_object(d->>'id' || '.' || k, v);
      end if;
    end loop;
  end loop;
  body := body || jsonb_build_object('alerts', alerts, 'values', vals);
  if not body ? 'id' then body := body || '{"id":"alerts"}'::jsonb; end if;
  insert into docs (col, id, body) values ('config', 'alerts', body)
  on conflict (col, id) do update set body = excluded.body;
  return added;
end $$;

-- latest definition: 005_crm_pipeline.sql
create or replace function crm_recompute_all() returns int
language plpgsql security definer set search_path = public as $$
declare c uuid; n int := 0;
begin
  if auth.uid() is not null and coalesce(crm_role()::text, '') <> 'admin' then
    raise exception 'Seul un administrateur peut recalculer tous les cycles' using errcode = '42501';
  end if;
  for c in select id from crm_cycles loop perform crm_recompute_cycle(c); n := n + 1; end loop;
  return n;
end $$;

-- latest definition: 005_crm_pipeline.sql
create or replace function crm_apply_items(p_inbox bigint, p_items jsonb) returns text
language plpgsql security definer set search_path = public as $$
declare it jsonb; typ text; at timestamptz; src event_source; persons uuid[]; pid uuid; cid uuid; call crm_calls;
        owner uuid; result text := 'ignored'; touched uuid[] := '{}'; c uuid; name text;
begin
  for it in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    typ := it->>'type'; at := (it->>'occurred_at')::timestamptz; src := (it->>'source')::event_source;
    if typ not in ('call_booked', 'call_rescheduled', 'call_canceled') then continue; end if;
    select * into call from crm_calls where iclosed_call_id = it#>>'{refs,iclosed_call_id}';
    if call.id is null and typ = 'call_rescheduled' then typ := 'call_booked'; end if;   -- unknown call: treat as a booking
    if call.id is not null then
      cid := call.cycle_id; select person_id into pid from crm_cycles where id = cid;
    else
      if typ = 'call_canceled' then
        insert into crm_unmatched_inbox (inbox_id, source, reason, summary)
        values (p_inbox, src, 'Annulation d''un appel inconnu du CRM', it#>>'{data,summary}');
        if result <> 'processed' then result := 'unmatched'; end if;
        continue;
      end if;
      persons := crm_people_for(it->'identity');
      if array_length(persons, 1) > 1 then
        insert into crm_unmatched_inbox (inbox_id, source, reason, summary, candidate_person_ids)
        values (p_inbox, src, 'Les identifiants désignent plusieurs personnes', it#>>'{data,summary}', persons);
        if result <> 'processed' then result := 'unmatched'; end if;
        continue;
      end if;
      pid := persons[1];
      name := nullif(trim(it#>>'{identity,name}'), '');
      if pid is null then
        insert into crm_people (full_name, primary_email, primary_phone)
        values (name, nullif(it#>>'{identity,email}', ''), nullif(it#>>'{identity,phone}', '')) returning id into pid;
      else
        update crm_people set full_name = coalesce(full_name, name),
          primary_email = coalesce(primary_email, nullif(it#>>'{identity,email}', '')::citext),
          primary_phone = coalesce(primary_phone, nullif(it#>>'{identity,phone}', '')), updated_at = now()
         where id = pid;
      end if;
    end if;
    perform crm_add_identities(pid, it->'identity', src);

    if typ = 'call_booked' and call.id is null then
      owner := crm_owner_for(it#>>'{data,host_email}');
      select id into cid from crm_cycles where person_id = pid and status = 'active';
      if cid is null then cid := crm_open_cycle(pid, at, owner); end if;
      insert into crm_calls (cycle_id, rank, iclosed_call_id, scheduled_start, scheduled_end, status, host_id)
      values (cid, (select coalesce(max(rank), 0) + 1 from crm_calls where cycle_id = cid), it#>>'{refs,iclosed_call_id}',
        nullif(it#>>'{data,start}', '')::timestamptz, nullif(it#>>'{data,end}', '')::timestamptz, 'scheduled', owner)
      returning * into call;
    elsif typ in ('call_booked', 'call_rescheduled') then
      -- a booking for a known call id is a reschedule (05 §4); an older event never overwrites a newer one
      if not exists (select 1 from crm_events where call_id = call.id and type in ('call_booked', 'call_rescheduled') and occurred_at > at) then
        -- a new start without an end keeps the call's length
        update crm_calls set scheduled_start = coalesce(nullif(it#>>'{data,start}', '')::timestamptz, scheduled_start),
          scheduled_end = coalesce(nullif(it#>>'{data,end}', '')::timestamptz,
            nullif(it#>>'{data,start}', '')::timestamptz + (scheduled_end - scheduled_start), scheduled_end),
          status = case when status = 'canceled' then 'scheduled' else status end
         where id = call.id;
      end if;
      typ := case when exists (select 1 from crm_events where call_id = call.id and type = 'call_booked') then 'call_rescheduled' else 'call_booked' end;
    elsif typ = 'call_canceled' then
      if not exists (select 1 from crm_events where call_id = call.id and type in ('call_booked', 'call_rescheduled') and occurred_at > at) then
        update crm_calls set status = 'canceled' where id = call.id and status in ('scheduled', 'outcome_pending');
      end if;
    end if;

    insert into crm_events (person_id, cycle_id, call_id, occurred_at, actor, channel, type, content, data, source, source_id, inbox_id)
    values (pid, cid, call.id, at, coalesce(nullif(it->>'actor', ''), 'prospect')::actor_kind, coalesce(nullif(it->>'channel', ''), 'booking'),
      typ, it->>'content', coalesce(it->'data', '{}'::jsonb) - 'summary', src, it->>'source_id', p_inbox)
    on conflict (source, source_id) do nothing;
    touched := touched || cid;
    result := 'processed';
  end loop;
  foreach c in array coalesce((select array_agg(distinct x) from unnest(touched) x), '{}') loop perform crm_recompute_cycle(c); end loop;
  update crm_webhook_log set status = result::inbox_status, processed_at = now(), error = null where id = p_inbox;
  return result;
end $$;

-- latest definition: 012_crm_messages.sql
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
      values (p_inbox, 'sendblue', 'Plusieurs personnes ont ce numéro de téléphone', it#>>'{identity,phone}', crm_people_for(it->'identity'));
      if result <> 'processed' then result := 'unmatched'; end if;
    end;
  end loop;
  foreach c in array coalesce((select array_agg(distinct x) from unnest(touched) x), '{}') loop perform crm_recompute_cycle(c); end loop;
  update crm_webhook_log set status = result::inbox_status, processed_at = now(), error = null where id = p_inbox;
  return result;
end $$;

-- latest definition: 014_mcp.sql
create or replace function crm_mcp_call(p_tool text, p_input jsonb) returns bigint
language plpgsql security definer set search_path = public as $$
declare n int; rid bigint;
begin
  if crm_role() is null then raise exception 'Aucun rôle dans le CRM' using errcode = '42501'; end if;
  select count(*) into n from crm_audit_log where actor_id = auth.uid() and action like 'mcp:%' and at > now() - interval '1 minute';
  if n >= 60 then raise exception 'Trop de requêtes : 60 appels d''outil par minute' using errcode = 'P0M60'; end if;
  insert into crm_audit_log (actor_id, action, entity, entity_id, after)
  values (auth.uid(), 'mcp:' || left(p_tool, 40), 'mcp', left(p_tool, 40), jsonb_build_object('input', coalesce(p_input, '{}'::jsonb)))
  returning id into rid;
  return rid;
end $$;

-- latest definition: 019_crm_sales_team.sql
create or replace function crm_sales_cockpit() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  now_ timestamptz := now(); v_days int; v_cur jsonb; v_base jsonb; v_periods jsonb := '{}'; v_team jsonb := '{}'; v_rows jsonb; m record;
  aov180 numeric; pond numeric; v_weekly jsonb; v_week jsonb; v_i int; v_alerts jsonb;
  v_sees boolean := crm_sees_all(); v_ids uuid[];
begin
  if crm_role() is null then raise exception 'Aucun rôle dans le CRM' using errcode = '42501'; end if;
  -- what the caller may see, decided once (as row-level security would: every cycle, or the cycles they own)
  select coalesce(array_agg(id), '{}') into v_ids from crm_cycles where v_sees or owner_id = auth.uid();
  -- average order value of the last 180 days, for live cycles with no deal yet
  select coalesce(avg(d2.amount_sold) filter (where d2.amount_sold > 0), 0) into aov180 from crm_deals d2 where d2.yes_at >= now_ - interval '180 days';
  -- weighted pipeline: value × observed win rate of the cycle's stage (closed in the last 180 days at that stage or later)
  with ord as (select key, position from crm_stage_definitions),
  closed as (select c.status, o.position from crm_cycles c join ord o on o.key = c.current_stage
               where c.status in ('won', 'lost', 'disqualified') and c.closed_at >= now_ - interval '180 days'),
  p as (select o.key, coalesce((select count(*) filter (where status = 'won')::numeric / nullif(count(*), 0) from closed where closed.position >= o.position), 0) win from ord o)
  select coalesce(sum(coalesce(nullif(dd.amount_sold, 0), aov180) * coalesce(p.win, 0)), 0) into pond
    from crm_cycles c left join p on p.key = c.current_stage left join crm_deals dd on dd.cycle_id = c.id where c.status = 'active' and c.id = any(v_ids);

  foreach v_days in array array[7, 30, 56] loop
    v_cur := crm_sales_cockpit_window(now_ - make_interval(days => v_days), now_, v_ids, v_sees);
    v_base := crm_sales_cockpit_window(now_ - make_interval(days => 2 * v_days), now_ - make_interval(days => v_days), v_ids, v_sees);
    v_periods := v_periods || jsonb_build_object(v_days::text, jsonb_build_object('now', v_cur, 'base', v_base));
    -- team: the same figures per cycle owner over the period
    v_rows := '[]';
    -- the sales rep of a cycle: its owner, else the host of its latest booked call (iClosed); only the reps of the
    -- current team (crm_sales_team) get a row, the cycles of reps who left keep them and count in the totals only
    for m in select r.rep, min(st.name) as name, array_agg(r.id) as ids from (
               select c.id, coalesce(cm.member_key, nullif(split_part(h.host, '@', 1), ''), 'none') as rep,
                      coalesce(cm.full_name, initcap(nullif(split_part(split_part(h.host, '@', 1), '.', 1), '')), 'Non attribué') as name
                 from crm_cycles c left join crm_members cm on cm.id = c.owner_id
                 left join lateral (select lower(e.data->>'host_email') host from crm_events e
                                     where e.cycle_id = c.id and e.type = 'call_booked' and coalesce(e.data->>'host_email', '') <> ''
                                     order by e.occurred_at desc limit 1) h on true
                where c.id = any(v_ids)) r join crm_sales_team st on st.rep = r.rep group by r.rep loop
      v_rows := v_rows || jsonb_build_array(jsonb_build_object('id', m.rep, 'name', m.name,
        'figures', crm_sales_cockpit_window(now_ - make_interval(days => v_days), now_, m.ids, false)));
    end loop;
    v_team := v_team || jsonb_build_object(v_days::text, v_rows);
  end loop;

  -- last 8 weeks, oldest first
  v_weekly := '[]';
  for v_i in reverse 7..0 loop
    v_week := crm_sales_cockpit_window(now_ - make_interval(days => 7 * (v_i + 1)), now_ - make_interval(days => 7 * v_i), v_ids, v_sees);
    v_weekly := v_weekly || jsonb_build_array(v_week);
  end loop;

  -- cash at risk: open SLA alerts, then overdue next moves, by weighted value
  with ord as (select key, position from crm_stage_definitions),
  closed as (select c.status, o.position from crm_cycles c join ord o on o.key = c.current_stage
               where c.status in ('won', 'lost', 'disqualified') and c.closed_at >= now_ - interval '180 days'),
  p as (select o.key, coalesce((select count(*) filter (where status = 'won')::numeric / nullif(count(*), 0) from closed where closed.position >= o.position), 0) win from ord o),
  val as (select c.id, coalesce(nullif(dd.amount_sold, 0), aov180) * greatest(coalesce(p.win, 0), 0.05) v
            from crm_cycles c left join p on p.key = c.current_stage left join crm_deals dd on dd.cycle_id = c.id where c.status = 'active' and c.id = any(v_ids)),
  a as (
    select al.rule_id c, coalesce(cm.member_key, 'none') o, coalesce(v.v, 0) imp, al.title t,
           coalesce(pe.full_name, pe.primary_email, '') || coalesce(' · ' || nullif(al.detail, ''), '') obj, al.opened_at at
      from crm_alerts al left join val v on v.id = al.cycle_id left join crm_members cm on cm.id = al.owner_id
      left join crm_people pe on pe.id = al.person_id where al.resolved_at is null and (v_sees or al.owner_id = auth.uid())
    union all
    select 'next', coalesce(cm.member_key, 'none'), coalesce(v.v, 0), (c.next_move->>'label') || ' · en retard',
           coalesce(pe.full_name, pe.primary_email, '') || ' · ' || coalesce((select sd.label from crm_stage_definitions sd where sd.key = c.current_stage), initcap(coalesce(c.current_stage, ''))), (c.next_move->>'due_at')::timestamptz
      from crm_cycles c join val v on v.id = c.id left join crm_members cm on cm.id = c.owner_id left join crm_people pe on pe.id = c.person_id
     where c.status = 'active' and c.next_move ? 'due_at' and (c.next_move->>'due_at')::timestamptz < now_
       and not exists (select 1 from crm_alerts al2 where al2.cycle_id = c.id and al2.resolved_at is null))
  select coalesce(jsonb_agg(jsonb_build_object('c', c, 'o', o, 'imp', round(imp), 't', t, 'obj', obj, 'at', at) order by imp desc, at), '[]'), count(*)
    into v_alerts, v_i from (select * from a order by imp desc, at limit 60) x;

  return jsonb_build_object('generated_at', now_, 'periods', v_periods, 'team', v_team, 'weekly', v_weekly,
    'pipeline', round(pond), 'aov_180', round(aov180), 'alerts', v_alerts,
    -- what the CRM cannot measure yet: no payment recorded (Whop not connected) or no deal with an amount
    'has_payments', exists (select 1 from crm_payments), 'has_deals', exists (select 1 from crm_deals where amount_sold > 0));
end $$;

-- latest definition: 020_crm_call_analysis.sql
create or replace function crm_ca_add_transcript(p_call uuid, p_raw text, p_speaker_map jsonb, p_source text default 'upload')
returns jsonb language plpgsql security definer set search_path = public as $$
declare info jsonb; k crm_calls; j uuid; roles text[];
begin
  select * into k from crm_calls where id = p_call;
  if k.id is null then raise exception 'Appel inconnu' using errcode = 'P0002'; end if;
  if not (coalesce(crm_role() = 'admin', false) or crm_owns_cycle(k.cycle_id)) then
    raise exception 'Seul un administrateur ou le commercial de ce prospect peut ajouter une transcription' using errcode = '42501';
  end if;
  info := crm_ca_call_info(p_call);
  if not (info->>'eligible')::boolean then raise exception 'Non analysé : %', info->>'reason' using errcode = '22023'; end if;
  if coalesce(length(trim(p_raw)), 0) < 200 then raise exception 'La transcription est vide ou trop courte' using errcode = '22023'; end if;
  select array_agg(distinct v) into roles from jsonb_each_text(coalesce(p_speaker_map, '{}')) x(kk, v);
  if roles is null or not (roles @> array['SALES', 'PROSPECT']) or not (roles <@ array['SALES', 'PROSPECT', 'OTHER']) then
    raise exception 'Associez chaque intervenant à Commercial, Prospect ou Autre, avec au moins un Commercial et un Prospect' using errcode = '22023';
  end if;
  update crm_calls set transcript_raw = p_raw, speaker_map = p_speaker_map, transcript_source = p_source, transcript_added_at = now()
   where id = p_call;
  update crm_ca_jobs set status = 'failed', error = 'remplacée par une nouvelle transcription', finished_at = now()
   where call_id = p_call and status = 'queued';
  insert into crm_ca_jobs (call_id, created_by) values (p_call, auth.uid()) returning id into j;
  insert into crm_events (person_id, cycle_id, call_id, occurred_at, actor, member_id, channel, type, data, source, source_id)
  select c.person_id, c.id, p_call, now(), 'sales', auth.uid(), 'analysis', 'transcript_added',
         jsonb_build_object('source', p_source, 'job', j), 'crm', 'transcript:' || j
    from crm_cycles c where c.id = k.cycle_id;
  return jsonb_build_object('job', j, 'status', 'queued');
end $$;

-- latest definition: 020_crm_call_analysis.sql
create or replace function crm_ca_retry(p_call uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare k crm_calls; j uuid;
begin
  select * into k from crm_calls where id = p_call;
  if k.id is null then raise exception 'Appel inconnu' using errcode = 'P0002'; end if;
  if not (coalesce(crm_role() = 'admin', false) or crm_owns_cycle(k.cycle_id)) then raise exception 'Action non autorisée' using errcode = '42501'; end if;
  if k.transcript_raw is null then raise exception 'Ajoutez d''abord une transcription' using errcode = '22023'; end if;
  if exists (select 1 from crm_ca_jobs where call_id = p_call and status in ('queued', 'running')) then
    return jsonb_build_object('status', 'already queued');
  end if;
  insert into crm_ca_jobs (call_id, created_by) values (p_call, auth.uid()) returning id into j;
  return jsonb_build_object('job', j, 'status', 'queued');
end $$;

-- latest definition: 022_crm_manual_cash.sql
create or replace function crm_set_deal(p_cycle uuid, p_amount numeric, p_currency text default 'EUR') returns uuid
language plpgsql security definer set search_path = public as $$
declare me crm_members; d crm_deals; before jsonb;
begin
  if not exists (select 1 from crm_cycles where id = p_cycle) then raise exception 'Cycle inconnu' using errcode = 'P0002'; end if;
  me := crm_require(array['admin', 'sales_lead']::member_role[], p_cycle);
  if p_amount is null or p_amount < 0 then raise exception 'Le montant signé doit être positif ou nul' using errcode = '22023'; end if;
  select * into d from crm_deals where cycle_id = p_cycle;
  before := to_jsonb(d);
  insert into crm_deals (cycle_id, amount_sold, currency, yes_at)
  values (p_cycle, p_amount, coalesce(nullif(upper(p_currency), ''), 'EUR'), now())
  on conflict (cycle_id) do update set amount_sold = excluded.amount_sold, currency = excluded.currency,
    yes_at = coalesce(crm_deals.yes_at, excluded.yes_at)
  returning * into d;
  perform crm_audit(me.id, 'set_deal', 'crm_deals', d.id::text, before, to_jsonb(d));
  return d.id;
end $$;

-- latest definition: 022_crm_manual_cash.sql
create or replace function crm_add_payment(p_cycle uuid, p_amount numeric, p_paid_at timestamptz, p_method text, p_note text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare me crm_members; cy crm_cycles; d crm_deals; pid uuid := gen_random_uuid(); at timestamptz := coalesce(p_paid_at, now());
begin
  select * into cy from crm_cycles where id = p_cycle;
  if cy.id is null then raise exception 'Cycle inconnu' using errcode = 'P0002'; end if;
  me := crm_require(array['admin', 'sales_lead']::member_role[], p_cycle);
  if p_amount is null or p_amount <= 0 then raise exception 'Le montant reçu doit être supérieur à zéro' using errcode = '22023'; end if;
  if at > now() + interval '1 day' then raise exception 'Un paiement ne peut pas être dans le futur' using errcode = '22023'; end if;
  if coalesce(p_method, '') not in ('bank_transfer', 'card', 'cash', 'other') then
    raise exception 'Moyen de paiement : bank_transfer, card, cash ou other' using errcode = '22023';
  end if;
  select * into d from crm_deals where cycle_id = p_cycle;
  if d.id is null then
    insert into crm_deals (cycle_id, currency, yes_at) values (p_cycle, 'EUR', at) returning * into d;
  end if;
  insert into crm_payments (id, deal_id, cycle_id, amount, currency, status, paid_at, source, method, note, created_by)
  values (pid, d.id, p_cycle, p_amount, coalesce(d.currency, 'EUR'), 'paid', at, 'manual', p_method, nullif(trim(coalesce(p_note, '')), ''), me.id);
  insert into crm_events (person_id, cycle_id, occurred_at, actor, member_id, channel, type, data, source, source_id)
  values (cy.person_id, p_cycle, at, 'sales', me.id, 'payment', 'payment_succeeded',
          jsonb_build_object('amount', p_amount, 'currency', coalesce(d.currency, 'EUR'), 'method', p_method, 'manual', true, 'payment_id', pid),
          'crm', 'payment:' || pid);
  perform crm_recompute_cycle(p_cycle);
  perform crm_audit(me.id, 'add_payment', 'crm_payments', pid::text, null,
                    jsonb_build_object('amount', p_amount, 'paid_at', at, 'method', p_method));
  return pid;
end $$;

-- latest definition: 022_crm_manual_cash.sql
create or replace function crm_delete_payment(p_payment uuid) returns void
language plpgsql security definer set search_path = public as $$
declare me crm_members; p crm_payments;
begin
  select * into p from crm_payments where id = p_payment;
  if p.id is null then raise exception 'Paiement inconnu' using errcode = 'P0002'; end if;
  me := crm_require(array['admin', 'sales_lead']::member_role[], p.cycle_id);
  if p.source <> 'manual' then raise exception 'Seul un paiement saisi à la main peut être supprimé ici' using errcode = '42501'; end if;
  delete from crm_events where source = 'crm' and source_id = 'payment:' || p.id;
  delete from crm_payments where id = p.id;
  perform crm_recompute_cycle(p.cycle_id);
  perform crm_audit(me.id, 'delete_payment', 'crm_payments', p.id::text, to_jsonb(p), null);
end $$;

-- latest definition: 023_crm_contact_update.sql
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

-- latest definition: 024_crm_payment_plan.sql
create or replace function crm_set_payment_plan(p_cycle uuid, p_amount numeric, p_currency text, p_schedule jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare me crm_members; d crm_deals; before jsonb; n int; total numeric; sched jsonb;
begin
  if not exists (select 1 from crm_cycles where id = p_cycle) then raise exception 'Cycle inconnu' using errcode = 'P0002'; end if;
  me := crm_require(array['admin', 'sales_lead']::member_role[], p_cycle);
  if p_amount is null or p_amount <= 0 then raise exception 'Le montant signé doit être supérieur à zéro' using errcode = '22023'; end if;
  if jsonb_typeof(p_schedule) is distinct from 'array' then raise exception 'L''échéancier est une liste d''échéances' using errcode = '22023'; end if;
  n := jsonb_array_length(p_schedule);
  if n < 1 or n > 12 then raise exception 'Un échéancier compte de 1 à 12 échéances' using errcode = '22023'; end if;
  begin
    select jsonb_agg(jsonb_build_object('due', to_char((x->>'due')::date, 'YYYY-MM-DD'), 'amount', round((x->>'amount')::numeric, 2))
                     order by (x->>'due')::date), sum(round((x->>'amount')::numeric, 2))
      into sched, total from jsonb_array_elements(p_schedule) x;
  exception when others then raise exception 'Chaque échéance demande une date et un montant' using errcode = '22023';
  end;
  if exists (select 1 from jsonb_array_elements(sched) x where (x->>'amount')::numeric <= 0) then
    raise exception 'Chaque échéance doit être supérieure à zéro' using errcode = '22023';
  end if;
  if abs(total - round(p_amount, 2)) > 0.01 then
    raise exception 'Les échéances font %, et non le montant signé (%)', total, round(p_amount, 2) using errcode = '22023';
  end if;
  select * into d from crm_deals where cycle_id = p_cycle;
  before := to_jsonb(d);
  insert into crm_deals (cycle_id, amount_sold, currency, payment_plan, schedule, yes_at)
  values (p_cycle, p_amount, coalesce(nullif(upper(p_currency), ''), 'EUR'),
          case when n = 1 then 'Payé en une fois' else n || ' échéances' end, sched, now())
  on conflict (cycle_id) do update set amount_sold = excluded.amount_sold,
    currency = coalesce(nullif(upper(p_currency), ''), crm_deals.currency, 'EUR'),
    payment_plan = excluded.payment_plan, schedule = excluded.schedule, yes_at = coalesce(crm_deals.yes_at, excluded.yes_at)
  returning * into d;
  perform crm_audit(me.id, 'set_payment_plan', 'crm_deals', d.id::text, before, to_jsonb(d));
  return d.id;
end $$;

-- latest definition: 025_crm_fathom_calls.sql
create or replace function crm_ca_call_info(p_call uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  with b as (
    select k.id, k.cycle_id, k.scheduled_start, k.status, k.recorded_by, k.rank,
           (select e.data from crm_events e where e.call_id = k.id and e.type = 'call_booked' order by e.occurred_at desc limit 1) bk,
           exists (select 1 from crm_calls x where x.cycle_id = k.cycle_id and x.recorded_by is not null) fathom
      from crm_calls k
     where k.cycle_id = (select cycle_id from crm_calls where id = p_call)),
  s as (
    select b.*, case when b.fathom then b.recorded_by is null
                     else coalesce(b.bk->>'event_name', '') ~* '(onboarding|case stud)' end as other_kind,
           lower(coalesce(b.recorded_by::text, nullif(b.bk->>'host_email', ''))) host
      from b),
  r as (
    select s.*, case when s.fathom then case when s.recorded_by is not null then s.rank end
                     when not s.other_kind and s.status <> 'canceled'
                     then count(*) filter (where not s.other_kind and s.status <> 'canceled')
                            over (order by s.scheduled_start, s.id) end as sales_round
      from s)
  select jsonb_build_object(
    'call_id', r.id, 'cycle_id', r.cycle_id, 'start_utc', r.scheduled_start, 'event_name', r.bk->>'event_name',
    'sales_round', r.sales_round,
    'eligible', coalesce(not r.other_kind and r.sales_round between 1 and 2 and r.scheduled_start < now(), false),
    'reason', case when r.other_kind and r.fathom then 'aucun enregistrement Fathom de cet appel par un commercial'
                   when r.other_kind then 'pas un appel de vente (accueil ou étude de cas)'
                   when r.status = 'canceled' then 'appel annulé'
                   when r.scheduled_start >= now() then 'l''appel n''a pas encore eu lieu'
                   when r.sales_round > 2 then 'seuls les appels de vente R1 et R2 sont analysés' end,
    'sales_id', coalesce(cm.member_key, nullif(split_part(r.host, '@', 1), ''), 'none'),
    'sales_name', coalesce(cm.full_name, st.name, initcap(nullif(split_part(split_part(r.host, '@', 1), '.', 1), ''))),
    'timezone', coalesce(cm.timezone, (select default_timezone from crm_ca_config)),
    'person', (select coalesce(p.full_name, p.primary_email) from crm_cycles c join crm_people p on p.id = c.person_id where c.id = r.cycle_id))
  from r
  left join crm_cycles cy on cy.id = r.cycle_id
  left join crm_members cm on cm.id = cy.owner_id
  left join crm_sales_team st on st.rep = nullif(split_part(r.host, '@', 1), '')
  where r.id = p_call
$$;

-- latest definition: 025_crm_fathom_calls.sql
create or replace function crm_apply_recordings(p_inbox bigint, p_items jsonb) returns text
language plpgsql security definer set search_path = public as $$
declare it jsonb; r jsonb; result text := 'ignored'; note text; touched uuid[] := '{}'; c uuid;
begin
  for it in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    r := crm_apply_recording_item(it, true);
    if r->>'status' = 'linked' then
      result := 'processed'; touched := touched || (r->>'cycle')::uuid;
    elsif r->>'status' = 'ambiguous' then
      insert into crm_unmatched_inbox (inbox_id, source, reason, summary, candidate_person_ids)
      select p_inbox, 'fathom', 'Enregistrement Fathom : plusieurs prospects correspondent', it#>>'{data,title}', candidates
        from crm_fathom_recordings where recording_id = (it#>>'{refs,fathom_recording_id}')::bigint;
      if result <> 'processed' then result := 'unmatched'; end if;
    else
      note := case when r->>'status' = 'not_sales_recorder' then 'Fathom: not recorded by a sales rep (FL-1)'
                   else 'Fathom: no lead found, not a sales call (FL-3)' end;
    end if;
  end loop;
  foreach c in array coalesce((select array_agg(distinct x) from unnest(touched) x), '{}') loop perform crm_recompute_cycle(c); end loop;
  update crm_webhook_log set status = result::inbox_status, processed_at = now(),
    error = case when result = 'ignored' then note end where id = p_inbox;
  return result;
end $$;

-- latest definition: 026_crm_refunds.sql
create or replace function crm_add_refund(p_payment uuid, p_amount numeric default null, p_refunded_at timestamptz default null, p_note text default null)
returns numeric language plpgsql security definer set search_path = public as $$
declare me crm_members; p crm_payments; cy crm_cycles; amt numeric; at timestamptz := coalesce(p_refunded_at, now());
begin
  select * into p from crm_payments where id = p_payment;
  if p.id is null then raise exception 'Paiement inconnu' using errcode = 'P0002'; end if;
  me := crm_require(array['admin', 'sales_lead']::member_role[], p.cycle_id);
  amt := coalesce(p_amount, p.amount - p.refunded_amount);   -- default: the rest of the payment
  if amt is null or amt <= 0 then raise exception 'Le remboursement doit être supérieur à zéro' using errcode = '22023'; end if;
  if p.refunded_amount + amt > p.amount then raise exception 'Un remboursement ne peut pas dépasser le paiement' using errcode = '22023'; end if;
  if at > now() + interval '1 day' then raise exception 'Un remboursement ne peut pas être dans le futur' using errcode = '22023'; end if;
  select * into cy from crm_cycles where id = p.cycle_id;
  update crm_payments set refunded_amount = refunded_amount + amt, updated_at = now(),
         note = coalesce(nullif(trim(coalesce(p_note, '')), ''), note) where id = p.id;
  insert into crm_events (person_id, cycle_id, occurred_at, actor, member_id, channel, type, data, source, source_id)
  values (cy.person_id, p.cycle_id, at, 'sales', me.id, 'payment', 'payment_refunded',
          jsonb_build_object('amount', amt, 'currency', p.currency, 'payment_id', p.id, 'full', p.refunded_amount + amt >= p.amount),
          'crm', 'refund:' || p.id || ':' || (p.refunded_amount + amt));
  perform crm_recompute_cycle(p.cycle_id);
  perform crm_audit(me.id, 'add_refund', 'crm_payments', p.id::text, to_jsonb(p), jsonb_build_object('refunded', amt, 'at', at));
  return p.refunded_amount + amt;
end $$;

-- latest definition: 027_crm_yes_keeps_deal.sql
create or replace function crm_declare_outcome(p_call uuid, p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare c crm_calls; cy crm_cycles; me crm_members; prev crm_call_outcomes; o crm_call_outcomes; rk reason_kind;
        att attendance; dec decision; t timestamptz := now();
begin
  select * into c from crm_calls where id = p_call;
  if c.id is null then raise exception 'Appel inconnu'; end if;
  select * into cy from crm_cycles where id = c.cycle_id;
  me := crm_require(array['admin', 'sales_lead']::member_role[], cy.id);
  att := (p->>'attendance')::attendance;
  dec := nullif(p->>'decision', '')::decision;
  if att is null then raise exception 'La présence est obligatoire'; end if;
  if att = 'no_show' and dec is not null then raise exception 'Une absence n''a pas de décision'; end if;
  if att = 'held' and dec is null then raise exception 'Un appel honoré demande une décision'; end if;
  if dec in ('no', 'disqualified') then
    select kind into rk from crm_reason_codes where code = p->>'reason_code' and active;
    if rk is null then raise exception 'Un motif est obligatoire pour la décision %', dec; end if;
    if (dec = 'no' and rk <> 'lost') or (dec = 'disqualified' and rk <> 'disqualified') then
      raise exception 'Le motif % ne correspond pas à la décision %', p->>'reason_code', dec;
    end if;
  end if;
  select * into prev from crm_call_outcomes where call_id = p_call and superseded_at is null;
  if prev.id is not null then update crm_call_outcomes set superseded_at = t where id = prev.id; end if;
  insert into crm_call_outcomes (call_id, attendance, decision, reason_code, nurture, return_date, next_step, amount_sold,
    currency, product, payment_plan, note, extra, declared_by, declared_at)
  values (p_call, att, dec, case when dec in ('no', 'disqualified') then p->>'reason_code' end,
    coalesce(nullif(p->>'nurture', ''), 'none')::nurture_choice, nullif(p->>'return_date', '')::date, p->>'next_step',
    nullif(p->>'amount_sold', '')::numeric, p->>'currency', p->>'product', p->>'payment_plan', p->>'note',
    coalesce(p->'extra', '{}'::jsonb), me.id, t)
  returning * into o;
  update crm_calls set status = att::text::call_status where id = p_call;
  insert into crm_events (person_id, cycle_id, call_id, occurred_at, actor, member_id, channel, type, data, source, source_id)
  values (cy.person_id, cy.id, p_call, t, 'sales', me.id, 'crm', 'outcome_' || att::text,
    jsonb_build_object('outcome_id', o.id, 'correction', prev.id is not null), 'crm', 'crm:crm_call_outcomes:' || o.id || ':attendance');
  if dec is not null then
    insert into crm_events (person_id, cycle_id, call_id, occurred_at, actor, member_id, channel, type, content, data, source, source_id)
    values (cy.person_id, cy.id, p_call, t, 'sales', me.id, 'crm', 'outcome_' || dec::text, o.note,
      jsonb_build_object('outcome_id', o.id, 'reason_code', o.reason_code, 'nurture', o.nurture, 'return_date', o.return_date,
        'next_step', o.next_step, 'amount_sold', o.amount_sold, 'currency', o.currency, 'payment_plan', o.payment_plan),
      'crm', 'crm:crm_call_outcomes:' || o.id || ':decision');
  end if;
  if dec = 'yes' then
    insert into crm_deals (cycle_id, product, amount_sold, currency, payment_plan, yes_at)
    values (cy.id, o.product, o.amount_sold, o.currency, o.payment_plan, t)
    on conflict (cycle_id) do update set product = coalesce(excluded.product, crm_deals.product),
      amount_sold = coalesce(excluded.amount_sold, crm_deals.amount_sold), currency = coalesce(excluded.currency, crm_deals.currency),
      payment_plan = coalesce(excluded.payment_plan, crm_deals.payment_plan), yes_at = coalesce(crm_deals.yes_at, excluded.yes_at);
  end if;
  perform crm_audit(me.id, case when prev.id is null then 'declare_outcome' else 'correct_outcome' end, 'crm_call_outcomes',
    o.id::text, to_jsonb(prev), to_jsonb(o));
  -- the projector (005_crm_pipeline.sql) turns the outcome into the cycle's stage and status
  if to_regprocedure('crm_recompute_cycle(uuid)') is not null then execute 'select crm_recompute_cycle($1)' using cy.id; end if;
  return o.id;
end $$;

-- latest definition: 030_crm_no_show_rule.sql
create or replace function crm_recompute_cycle(p_cycle uuid) returns void
language plpgsql security definer set search_path = public as $$
declare cy crm_cycles; st record; prev_stage text; prev_at timestamptz; new_status cycle_status := 'active';
        close_at timestamptz; reason text; o record; lost_at timestamptz; reopen_at timestamptz; won_at timestamptz; refund_at timestamptz;
        nm jsonb; nxt crm_calls; late crm_calls; last_call crm_calls; t timestamptz := now();
begin
  select * into cy from crm_cycles where id = p_cycle for update;
  if cy.id is null then return; end if;

  -- stages: entered at the first event whose type the stage lists; the current stage is the furthest reached
  delete from crm_stage_history where cycle_id = p_cycle;
  prev_stage := null; prev_at := null;
  for st in
    select d.key, (select min(e.occurred_at) from crm_events e where e.cycle_id = p_cycle and e.type = any(d.enter_on)) as at
      from crm_stage_definitions d where d.active order by d.position
  loop
    continue when st.at is null;
    if prev_stage is not null then
      update crm_stage_history set exited_at = greatest(st.at, entered_at) where cycle_id = p_cycle and stage = prev_stage;
    end if;
    insert into crm_stage_history (cycle_id, stage, entered_at) values (p_cycle, st.key, st.at);
    prev_stage := st.key; prev_at := st.at;
  end loop;

  -- status: won at the first succeeded payment; lost / disqualified at the latest current outcome no / disqualified
  -- (or a rules cycle_lost event); back to active after a later cycle_reopened
  select min(occurred_at) into won_at from crm_events where cycle_id = p_cycle and type = 'payment_succeeded';
  select oc.decision, oc.reason_code, oc.declared_at into o from crm_call_outcomes oc join crm_calls c on c.id = oc.call_id
   where c.cycle_id = p_cycle and oc.superseded_at is null order by oc.declared_at desc limit 1;
  select max(occurred_at) into reopen_at from crm_events where cycle_id = p_cycle and type = 'cycle_reopened';
  -- 026: every payment refunded = lost, reason refunded, at the last refund (Romain 2026-10-30)
  if won_at is not null and exists (select 1 from crm_payments where cycle_id = p_cycle and refunded_amount > 0)
     and not exists (select 1 from crm_payments where cycle_id = p_cycle and amount - refunded_amount > 0) then
    select max(occurred_at) into refund_at from crm_events where cycle_id = p_cycle and type = 'payment_refunded';
    if refund_at is null then select max(updated_at) into refund_at from crm_payments where cycle_id = p_cycle; end if;
    new_status := 'lost'; close_at := refund_at; reason := 'refunded';
  elsif won_at is not null then
    new_status := 'won'; close_at := won_at; reason := null;
  elsif o.decision in ('no', 'disqualified') and (reopen_at is null or o.declared_at > reopen_at) then
    new_status := case when o.decision = 'no' then 'lost' else 'disqualified' end; close_at := o.declared_at; reason := o.reason_code;
  elsif o.declared_at is null and exists (select 1 from crm_events where cycle_id = p_cycle and source = 'import' and type in ('cycle_won', 'cycle_lost', 'cycle_disqualified')
                  and (reopen_at is null or occurred_at > reopen_at)) then
    -- closed in the tool the lead came from (008 / 009 / 013 imports), until a declared outcome or a reopening says otherwise
    select substr(type, 7)::cycle_status, occurred_at, data->>'reason' into new_status, close_at, reason from crm_events
     where cycle_id = p_cycle and source = 'import' and type in ('cycle_won', 'cycle_lost', 'cycle_disqualified') order by occurred_at desc limit 1;
  else
    select occurred_at, data->>'reason' into lost_at, reason from crm_events
     where cycle_id = p_cycle and type = 'cycle_lost' and source = 'rules' order by occurred_at desc limit 1;
    if lost_at is not null and (reopen_at is null or lost_at > reopen_at) then
      new_status := 'lost'; close_at := lost_at;
    else
      reason := null;
    end if;
  end if;
  if new_status <> cy.status and new_status <> 'active' then
    insert into crm_events (person_id, cycle_id, occurred_at, actor, channel, type, data, source, source_id)
    values (cy.person_id, p_cycle, close_at, 'system', 'crm', 'cycle_' || new_status::text, jsonb_build_object('reason', reason),
      'crm', 'status:' || p_cycle || ':' || new_status::text || ':' || close_at)
    on conflict (source, source_id) do nothing;
  end if;

  -- who must act (DEFERRED wording and logic, 10 §3): outcome missing, then the next call, then rebook, then follow up
  -- (025, FL-6: a Fathom recording with no current outcome counts as a call whose outcome is missing)
  select * into late from crm_calls k where k.cycle_id = p_cycle and coalesce(k.recording_end, k.scheduled_end) < t
     and (k.status = 'scheduled'
          or (k.status = 'held' and k.recorded_by is not null
              and not exists (select 1 from crm_call_outcomes oc where oc.call_id = k.id and oc.superseded_at is null)))
   order by coalesce(k.recording_end, k.scheduled_end) limit 1;
  select * into nxt from crm_calls where cycle_id = p_cycle and status = 'scheduled' and scheduled_start >= t
   order by scheduled_start limit 1;
  select * into last_call from crm_calls where cycle_id = p_cycle order by rank desc, coalesce(recording_start, scheduled_start) desc limit 1;
  nm := case
    when new_status <> 'active' then null
    when late.id is not null then jsonb_build_object('who', 'sales', 'code', 'declare_outcome', 'label', 'Déclarer l''issue de l''appel', 'due_at', coalesce(late.recording_end, late.scheduled_end))
    when nxt.id is not null then jsonb_build_object('who', 'prospect', 'code', 'attend_call', 'label', 'Appel R' || nxt.rank, 'due_at', nxt.scheduled_start)
    when last_call.status::text = 'missed' then jsonb_build_object('who', 'sales', 'code', 'rebook', 'label', 'Replanifier l''appel', 'missed', last_call.rank)
    when last_call.status = 'canceled' then jsonb_build_object('who', 'sales', 'code', 'rebook', 'label', 'Reprendre un rendez-vous')
    else jsonb_build_object('who', 'sales', 'code', 'follow_up', 'label', 'Relancer') end;

  update crm_cycles set
    current_stage = prev_stage, stage_entered_at = prev_at,
    calls_held = (select count(*) from crm_calls where cycle_id = p_cycle and status = 'held'),
    no_shows = (select count(*) from crm_calls where cycle_id = p_cycle and status = 'no_show'),
    sales_attempts = (select count(*) from crm_events where cycle_id = p_cycle and actor = 'sales' and type in ('message_out', 'phone_call_out')),
    last_prospect_at = (select max(occurred_at) from crm_events where cycle_id = p_cycle and actor = 'prospect' and type in ('message_in', 'phone_call_in')),
    last_sales_at = (select max(occurred_at) from crm_events where cycle_id = p_cycle and actor = 'sales' and type in ('message_out', 'phone_call_out')),
    last_event_at = (select max(occurred_at) from crm_events where cycle_id = p_cycle),
    status = new_status, closed_at = case when new_status = 'active' then null else close_at end,
    close_reason = case when new_status in ('lost', 'disqualified') then reason end,
    next_move = nm, projected_at = t
  where id = p_cycle;
end $$;

-- latest definition: 031_crm_member_prefs.sql
create or replace function crm_set_pref(p_key text, p_value jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Connectez-vous d''abord' using errcode = '42501'; end if;
  if octet_length(p_value::text) > 20000 then raise exception 'Réglage trop volumineux' using errcode = '22023'; end if;
  if p_value is null or p_value = 'null'::jsonb then
    delete from crm_member_prefs where user_id = auth.uid() and key = p_key;
  else
    insert into crm_member_prefs (user_id, key, value) values (auth.uid(), p_key, p_value)
    on conflict (user_id, key) do update set value = excluded.value, updated_at = now();
  end if;
  -- the day lists of Sales Day older than 30 days go
  delete from crm_member_prefs where user_id = auth.uid() and key like 'salesday.%' and updated_at < now() - interval '30 days';
  return p_value;
end $$;

