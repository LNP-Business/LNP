-- SKL OS CRM — writes from the front end (web/supabase/004_crm_rpc.sql), after 003_crm_core.sql.
-- The browser never writes crm_* tables: it calls these security-definer functions, which check the caller's CRM
-- role and ownership, write crm_audit_log and the matching crm_events (docs/crm/02-data-model.md §5).
-- Phase 1 = the mechanisms. Not yet here: the projector (phase 2: derived cycle columns and statuses), the Whop
-- checkout (phase 5). Safe to run again (create or replace).

-- ───────────────────────── helpers ─────────────────────────
-- The caller's active CRM profile, or an error. Admins and sales leads pass everywhere listed; a sales passes only
-- on a cycle they own; a viewer never writes.
create or replace function crm_require(p_roles member_role[], p_cycle uuid default null) returns crm_members
language plpgsql stable security definer set search_path = public as $$
declare me crm_members;
begin
  select * into me from crm_members where id = auth.uid() and active;
  if me.id is null then raise exception 'Not a CRM member' using errcode = '42501'; end if;
  if me.role = any(p_roles) then return me; end if;
  if me.role = 'sales' and p_cycle is not null and exists (select 1 from crm_cycles where id = p_cycle and owner_id = me.id) then
    return me;
  end if;
  raise exception 'Not allowed for role %', me.role using errcode = '42501';
end $$;

create or replace function crm_audit(p_actor uuid, p_action text, p_entity text, p_entity_id text, p_before jsonb, p_after jsonb)
returns void language sql security definer set search_path = public as $$
  insert into crm_audit_log (actor_id, action, entity, entity_id, before, after)
  values (p_actor, p_action, p_entity, p_entity_id, p_before, p_after)
$$;

-- ───────────────────────── team ─────────────────────────
-- Link a signed-in account (existing members row, found by email) to its SKL member id, CRM role and lead
-- (Valentino -> Romain, Romain -> Amin). Allowed to an app admin (members.role = 'admin') or a CRM admin.
create or replace function crm_admin_set_member(
  p_email text, p_member_key text, p_full_name text, p_role member_role,
  p_lead_key text default null, p_iclosed_email text default null, p_fathom_email text default null,
  p_sendblue_number text default null, p_active boolean default true
) returns uuid language plpgsql security definer set search_path = public as $$
declare uid uuid; lead uuid; before jsonb; actor uuid;
begin
  if coalesce(public.my_role(), '') <> 'admin' and coalesce(crm_role()::text, '') <> 'admin' then
    raise exception 'Only an admin can set CRM members' using errcode = '42501';
  end if;
  select user_id into uid from members where lower(email) = lower(trim(p_email));
  if uid is null then raise exception 'No SKL OS account with the email % (invite the person first)', p_email; end if;
  if p_lead_key is not null then
    select id into lead from crm_members where member_key = p_lead_key;
    if lead is null then raise exception 'Unknown lead %: set the lead first', p_lead_key; end if;
    if lead = uid then raise exception 'A member cannot be their own lead'; end if;
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

-- ───────────────────────── outcome form ─────────────────────────
-- p = {attendance: held|no_show, decision: yes|no|follow_up|disqualified, reason_code, nurture: none|standard|light,
--      return_date, next_step, amount_sold, currency, product, payment_plan, note, extra}
-- A correction supersedes the current outcome (history kept). Events: outcome_held / outcome_no_show, then
-- outcome_<decision>. A yes creates or updates the cycle's deal. Statuses are applied by the projector (phase 2).
create or replace function crm_declare_outcome(p_call uuid, p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare c crm_calls; cy crm_cycles; me crm_members; prev crm_call_outcomes; o crm_call_outcomes; rk reason_kind;
        att attendance; dec decision; t timestamptz := now();
begin
  select * into c from crm_calls where id = p_call;
  if c.id is null then raise exception 'Unknown call'; end if;
  select * into cy from crm_cycles where id = c.cycle_id;
  me := crm_require(array['admin', 'sales_lead']::member_role[], cy.id);
  att := (p->>'attendance')::attendance;
  dec := nullif(p->>'decision', '')::decision;
  if att is null then raise exception 'attendance is required'; end if;
  if att = 'no_show' and dec is not null then raise exception 'A no-show has no decision'; end if;
  if att = 'held' and dec is null then raise exception 'A held call needs a decision'; end if;
  if dec in ('no', 'disqualified') then
    select kind into rk from crm_reason_codes where code = p->>'reason_code' and active;
    if rk is null then raise exception 'A reason is required for % (crm_reason_codes)', dec; end if;
    if (dec = 'no' and rk <> 'lost') or (dec = 'disqualified' and rk <> 'disqualified') then
      raise exception 'Reason % does not fit decision %', p->>'reason_code', dec;
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
    on conflict (cycle_id) do update set product = excluded.product, amount_sold = excluded.amount_sold,
      currency = excluded.currency, payment_plan = excluded.payment_plan, yes_at = coalesce(crm_deals.yes_at, excluded.yes_at);
  end if;
  perform crm_audit(me.id, case when prev.id is null then 'declare_outcome' else 'correct_outcome' end, 'crm_call_outcomes',
    o.id::text, to_jsonb(prev), to_jsonb(o));
  -- the projector (005_crm_pipeline.sql) turns the outcome into the cycle's stage and status
  if to_regprocedure('crm_recompute_cycle(uuid)') is not null then execute 'select crm_recompute_cycle($1)' using cy.id; end if;
  return o.id;
end $$;

-- ───────────────────────── notes, owner, automatic close ─────────────────────────
create or replace function crm_add_note(p_cycle uuid, p_text text) returns bigint
language plpgsql security definer set search_path = public as $$
declare me crm_members; cy crm_cycles; eid bigint; t timestamptz := now();
begin
  me := crm_require(array['admin', 'sales_lead']::member_role[], p_cycle);
  select * into cy from crm_cycles where id = p_cycle;
  if cy.id is null then raise exception 'Unknown cycle'; end if;
  if coalesce(trim(p_text), '') = '' then raise exception 'Empty note'; end if;
  insert into crm_events (person_id, cycle_id, occurred_at, actor, member_id, channel, type, content, source, source_id)
  values (cy.person_id, cy.id, t, 'sales', me.id, 'crm', 'note', trim(p_text), 'crm', 'crm:note:' || gen_random_uuid())
  returning id into eid;
  perform crm_audit(me.id, 'add_note', 'crm_cycles', p_cycle::text, null, jsonb_build_object('event_id', eid));
  return eid;
end $$;

create or replace function crm_reassign_cycle(p_cycle uuid, p_member uuid) returns void
language plpgsql security definer set search_path = public as $$
declare me crm_members; before uuid;
begin
  me := crm_require(array['admin', 'sales_lead']::member_role[]);
  if not exists (select 1 from crm_members where id = p_member and active and role <> 'viewer') then
    raise exception 'The new owner must be an active CRM member who sells';
  end if;
  select owner_id into before from crm_cycles where id = p_cycle;
  if not found then raise exception 'Unknown cycle'; end if;
  update crm_cycles set owner_id = p_member where id = p_cycle;
  update crm_alerts set owner_id = p_member, owner_key = (select member_key from crm_members where id = p_member)
   where cycle_id = p_cycle and resolved_at is null;
  perform crm_audit(me.id, 'reassign_cycle', 'crm_cycles', p_cycle::text, jsonb_build_object('owner_id', before),
    jsonb_build_object('owner_id', p_member));
end $$;

-- Suppresses the automatic close of a cycle for crm_rules.<rule>.params.snooze_days; rules-tick (phase 6) reads it.
create or replace function crm_cancel_auto_close(p_cycle uuid) returns timestamptz
language plpgsql security definer set search_path = public as $$
declare me crm_members; days int; until_at timestamptz;
begin
  me := crm_require(array['admin', 'sales_lead']::member_role[], p_cycle);
  if not exists (select 1 from crm_cycles where id = p_cycle) then raise exception 'Unknown cycle'; end if;
  select coalesce(max((params->>'snooze_days')::int), 7) into days from crm_rules where kind = 'auto_close';
  until_at := now() + make_interval(days => days);
  perform crm_audit(me.id, 'cancel_auto_close', 'crm_cycles', p_cycle::text, null, jsonb_build_object('suppressed_until', until_at));
  return until_at;
end $$;

-- ───────────────────────── nurture ─────────────────────────
-- p = {action: enter|leave|set_return, intensity: standard|light, return_date, reason_code, cycle_id}
create or replace function crm_set_nurture(p_person uuid, p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare me crm_members; cyc uuid; tr crm_nurture_tracks; t timestamptz := now(); act text := p->>'action';
begin
  cyc := coalesce(nullif(p->>'cycle_id', '')::uuid,
    (select id from crm_cycles where person_id = p_person order by opened_at desc limit 1));
  me := crm_require(array['admin', 'sales_lead']::member_role[], cyc);
  select * into tr from crm_nurture_tracks where person_id = p_person and status = 'active';
  if act = 'enter' then
    if tr.id is not null then raise exception 'Already in nurture'; end if;
    if cyc is null then raise exception 'Nurture needs the cycle it comes from'; end if;
    if exists (select 1 from crm_people where id = p_person and opted_out_at is not null) then
      raise exception 'This person opted out of messages';
    end if;
    insert into crm_nurture_tracks (person_id, origin_cycle_id, reason_code, intensity, owner_id, entered_at, return_date)
    values (p_person, cyc, nullif(p->>'reason_code', ''), coalesce(nullif(p->>'intensity', ''), 'standard')::nurture_choice,
      coalesce((select owner_id from crm_cycles where id = cyc), me.id), t, nullif(p->>'return_date', '')::date)
    returning * into tr;
    insert into crm_events (person_id, cycle_id, occurred_at, actor, member_id, channel, type, data, source, source_id)
    values (p_person, cyc, t, 'sales', me.id, 'crm', 'nurture_entered', jsonb_build_object('nurture_id', tr.id),
      'crm', 'crm:crm_nurture_tracks:' || tr.id || ':entered');
  elsif act = 'leave' then
    if tr.id is null then raise exception 'Not in nurture'; end if;
    update crm_nurture_tracks set status = 'removed', ended_at = t where id = tr.id;
  elsif act = 'set_return' then
    if tr.id is null then raise exception 'Not in nurture'; end if;
    update crm_nurture_tracks set return_date = nullif(p->>'return_date', '')::date where id = tr.id;
  else
    raise exception 'action must be enter, leave or set_return';
  end if;
  perform crm_audit(me.id, 'nurture_' || act, 'crm_nurture_tracks', tr.id::text, null, p);
  return tr.id;
end $$;

-- ───────────────────────── matching by hand ─────────────────────────
-- Attaches an unmatched item and puts its raw row back in the queue: process-inbox (phase 2) writes it again as if
-- it had matched the first time.
create or replace function crm_resolve_unmatched(p_item uuid, p_person uuid, p_cycle uuid default null) returns void
language plpgsql security definer set search_path = public as $$
declare me crm_members; it crm_unmatched_inbox;
begin
  me := crm_require(array['admin', 'sales_lead']::member_role[]);
  select * into it from crm_unmatched_inbox where id = p_item;
  if it.id is null then raise exception 'Unknown item'; end if;
  if it.resolved_at is not null or it.dismissed then raise exception 'Already handled'; end if;
  if not exists (select 1 from crm_people where id = p_person and merged_into is null) then raise exception 'Unknown person'; end if;
  if p_cycle is not null and not exists (select 1 from crm_cycles where id = p_cycle and person_id = p_person) then
    raise exception 'That cycle is not this person''s';
  end if;
  update crm_unmatched_inbox set resolved_person_id = p_person, resolved_cycle_id = p_cycle, resolved_by = me.id, resolved_at = now()
   where id = p_item;
  update crm_webhook_log set status = 'received', attempts = 0, error = null where id = it.inbox_id;
  perform crm_audit(me.id, 'resolve_unmatched', 'crm_unmatched_inbox', p_item::text, to_jsonb(it),
    jsonb_build_object('person_id', p_person, 'cycle_id', p_cycle));
end $$;

create or replace function crm_dismiss_unmatched(p_item uuid) returns void
language plpgsql security definer set search_path = public as $$
declare me crm_members;
begin
  me := crm_require(array['admin', 'sales_lead']::member_role[]);
  update crm_unmatched_inbox set dismissed = true, resolved_by = me.id, resolved_at = now()
   where id = p_item and resolved_at is null and not dismissed;
  if not found then raise exception 'Unknown or already handled item'; end if;
  perform crm_audit(me.id, 'dismiss_unmatched', 'crm_unmatched_inbox', p_item::text, null, null);
end $$;

-- Moves everything of p_merge onto p_keep. Refused while both have an active cycle (close one first).
create or replace function crm_merge_people(p_keep uuid, p_merge uuid) returns void
language plpgsql security definer set search_path = public as $$
declare me crm_members;
begin
  me := crm_require(array['admin', 'sales_lead']::member_role[]);
  if p_keep = p_merge then raise exception 'Same person'; end if;
  if not exists (select 1 from crm_people where id = p_keep and merged_into is null)
     or not exists (select 1 from crm_people where id = p_merge and merged_into is null) then
    raise exception 'Unknown or already merged person';
  end if;
  if exists (select 1 from crm_cycles where person_id = p_keep and status = 'active')
     and exists (select 1 from crm_cycles where person_id = p_merge and status = 'active') then
    raise exception 'Both people have an active cycle: close one first';
  end if;
  if exists (select 1 from crm_nurture_tracks where person_id = p_keep and status = 'active')
     and exists (select 1 from crm_nurture_tracks where person_id = p_merge and status = 'active') then
    raise exception 'Both people are in nurture: end one first';
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

-- ───────────────────────── configuration ─────────────────────────
-- p_table: crm_settings (p_value = the value), crm_rules ({enabled, params}), crm_stage_definitions or
-- crm_reason_codes (the columns to change). A saved value is no longer a proposal. Then recompute_all (phase 2).
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
    if before is null then raise exception 'Unknown rule % (a new rule needs its evaluator first)', p_key; end if;
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
    raise exception 'Not a CRM configuration table: %', p_table;
  end if;
  perform crm_audit(me.id, 'update_config', p_table, p_key, before, after);
end $$;

-- ───────────────────────── payments ─────────────────────────
create or replace function crm_create_checkout(p_cycle uuid) returns text
language plpgsql security definer set search_path = public as $$
declare me crm_members;
begin
  me := crm_require(array['admin', 'sales_lead']::member_role[], p_cycle);
  raise exception 'Payment links arrive in phase 5 (Whop)' using errcode = '0A000';
end $$;

-- ───────────────────────── CRM alert rules in Settings › Alerts ─────────────────────────
-- Adds c1..c18 (crm_settings.alert_rule_defaults) to the docs row config/alerts in the shape Settings › Alerts saves:
-- alerts.cN = {on, sev, who: [owner, lead, romain], ch: [app, slack, email]}, values["cN.<param>"] = number.
-- Only missing keys are added: a1..a18 and any c-rule already edited stay as they are. Run again any time.
create or replace function crm_merge_alert_defaults() returns int
language plpgsql security definer set search_path = public as $$
declare body jsonb; d jsonb; alerts jsonb; vals jsonb; added int := 0; k text; v jsonb;
begin
  if auth.uid() is not null and coalesce(public.my_role(), '') <> 'admin' then
    raise exception 'Only an admin can change the alert rules' using errcode = '42501';
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

-- ───────────────────────── privileges ─────────────────────────
do $$ declare f text; begin
  foreach f in array array[
    'crm_require(member_role[], uuid)', 'crm_audit(uuid, text, text, text, jsonb, jsonb)',
    'crm_admin_set_member(text, text, text, member_role, text, text, text, text, boolean)',
    'crm_declare_outcome(uuid, jsonb)', 'crm_add_note(uuid, text)', 'crm_reassign_cycle(uuid, uuid)',
    'crm_cancel_auto_close(uuid)', 'crm_set_nurture(uuid, jsonb)', 'crm_resolve_unmatched(uuid, uuid, uuid)',
    'crm_dismiss_unmatched(uuid)', 'crm_merge_people(uuid, uuid)', 'crm_update_config(text, text, jsonb)',
    'crm_create_checkout(uuid)', 'crm_merge_alert_defaults()'] loop
    execute 'revoke execute on function ' || f || ' from public, anon';
    execute 'grant execute on function ' || f || ' to authenticated, service_role';
  end loop;
end $$;
-- internal helpers: not callable from the browser
revoke execute on function crm_require(member_role[], uuid), crm_audit(uuid, text, text, text, jsonb, jsonb) from authenticated;
