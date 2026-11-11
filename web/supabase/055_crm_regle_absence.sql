-- 055: the absence rule, from 2026-10-27 (Romain, 2026-11-11).
-- « La règle d'absence, c'est de ne pas venir au R2 » : the setting call (15 minutes, by the setter) is never an iClosed booking,
-- so it is never a crm_calls row and the rule never reads it; the setter and the sales rep declare it in the CRM. The rule reads
-- the iClosed bookings (the R2 of the sales cycle and the next ones):
--   * a Fathom recording of 30 minutes or more: the call is held at once (025), and the sales rep's outcome is still awaited
--     (R3, lost, won…: « Déclarer l'issue de l'appel ») ;
--   * no recording at all, no attendance declared (in the CRM or in iClosed), 3 hours after the end of the call: absent (the
--     first booking of the cycle: no_show; a later one, after a complete call: missed, « Replanifier l'appel ») ;
--   * a short recording, or a call iClosed already gives as held: the rule does nothing, the sales rep decides in the CRM.
-- Not yet: no answer to the WhatsApp messages (WhatsApp is not connected; migration 052).
-- Then, once: every lead still open that was opened before 2026-10-27 and has no booking since, and no payment, is lost
-- (reason timing) and put in long-term follow-up (crm_nurture_tracks, intensity standard), as a « no » with « Mettre en suivi
-- long terme » would. Won leads are untouched.

update crm_settings set value = value || '{"since": "2026-10-27T00:00:00+01:00", "min_minutes": 30, "grace_hours": 3, "enabled": true}'::jsonb
 where key = 'no_show_rule';

create or replace function crm_apply_no_show_rule(p_dry boolean default true, p_cycle uuid default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare since timestamptz := nullif(crm_no_show_setting('since'), '')::timestamptz;
        grace interval := make_interval(hours => coalesce(crm_no_show_setting('grace_hours')::int, 3));
        cy record; k crm_calls; seen boolean; ns int := 0; ms int := 0; cycles uuid[] := '{}';
begin
  if since is null then return jsonb_build_object('error', 'no_show_rule.since is not set (the date the Fathom history starts)'); end if;
  for cy in select c.id, c.person_id from crm_cycles c where c.status <> 'won' and (p_cycle is null or c.id = p_cycle)
             and exists (select 1 from crm_calls x where x.cycle_id = c.id and x.scheduled_start >= since) loop
    seen := false;
    for k in select * from crm_calls where cycle_id = cy.id order by coalesce(recording_start, scheduled_start, created_at), created_at, id loop
      if crm_call_complete(k) then seen := true; continue; end if;
      -- 055: only a call nobody has given an attendance for: still scheduled (iClosed gave no outcome), with no recording
      continue when k.status::text not in ('scheduled', 'outcome_pending')
        or k.recorded_by is not null or k.recording_start is not null
        or k.scheduled_start is null or k.scheduled_start < since
        or coalesce(k.scheduled_end, k.scheduled_start) + grace > now()
        or exists (select 1 from crm_call_outcomes oc where oc.call_id = k.id and oc.superseded_at is null)
        or crm_call_has_ambiguous_recording(k.id);
      if not seen then ns := ns + 1; else ms := ms + 1; end if;
      cycles := array_append(cycles, cy.id);
      continue when p_dry;
      update crm_calls set status = case when seen then 'missed' else 'no_show' end::call_status where id = k.id;
      insert into crm_events (person_id, cycle_id, call_id, occurred_at, actor, channel, type, data, source, source_id)
      values (cy.person_id, cy.id, k.id, coalesce(k.scheduled_end, k.scheduled_start), 'system', 'crm',
              case when seen then 'call_missed' else 'outcome_no_show' end,
              jsonb_build_object('rule', 'no_fathom_recording', 'min_minutes', coalesce(crm_no_show_setting('min_minutes')::int, 30)),
              'rules', 'noshow:' || k.id)
      on conflict (source, source_id) do nothing;
    end loop;
  end loop;
  if not p_dry then
    perform crm_recompute_cycle(c) from (select distinct unnest(cycles) c) x;
  end if;
  return jsonb_build_object('dry', p_dry, 'since', since, 'no_show_r1', ns, 'missed_r2_plus', ms,
                            'cycles', (select count(distinct c) from unnest(cycles) c));
end $$;
revoke execute on function crm_apply_no_show_rule(boolean, uuid) from public, anon, authenticated;
grant execute on function crm_apply_no_show_rule(boolean, uuid) to service_role;

-- the leads still open from before 2026-10-27: lost, in long-term follow-up (run once; running the file again changes nothing)
create or replace function crm_close_before(p_before timestamptz, p_dry boolean default true) returns jsonb
language plpgsql security definer set search_path = public as $$
declare c record; n int := 0; nur int := 0; t timestamptz := now(); tr uuid;
begin
  for c in select cy.id, cy.person_id, cy.owner_id from crm_cycles cy
            where cy.status = 'active' and cy.opened_at < p_before
              and not exists (select 1 from crm_calls k where k.cycle_id = cy.id and k.status <> 'canceled' and k.scheduled_start >= p_before)
              and not exists (select 1 from crm_payments p where p.cycle_id = cy.id and p.status = 'paid')
            order by cy.opened_at loop
    n := n + 1;
    continue when p_dry;
    insert into crm_events (person_id, cycle_id, occurred_at, actor, channel, type, data, source, source_id)
    values (c.person_id, c.id, t, 'system', 'crm', 'cycle_lost',
            jsonb_build_object('reason', 'timing', 'rule', 'open_before', 'before', p_before), 'rules', 'lost_before:' || c.id)
    on conflict (source, source_id) do nothing;
    if not exists (select 1 from crm_nurture_tracks where person_id = c.person_id and status = 'active')
       and not exists (select 1 from crm_people where id = c.person_id and opted_out_at is not null) then
      insert into crm_nurture_tracks (person_id, origin_cycle_id, reason_code, intensity, owner_id, entered_at)
      values (c.person_id, c.id, 'timing', 'standard', c.owner_id, t) returning id into tr;
      insert into crm_events (person_id, cycle_id, occurred_at, actor, channel, type, data, source, source_id)
      values (c.person_id, c.id, t, 'system', 'crm', 'nurture_entered', jsonb_build_object('nurture_id', tr, 'rule', 'open_before'),
              'crm', 'crm:crm_nurture_tracks:' || tr || ':entered')
      on conflict (source, source_id) do nothing;
      nur := nur + 1;
    end if;
    perform crm_recompute_cycle(c.id);
  end loop;
  return jsonb_build_object('dry', p_dry, 'before', p_before, 'lost', n, 'long_term_follow_up', nur);
end $$;
revoke execute on function crm_close_before(timestamptz, boolean) from public, anon, authenticated;
grant execute on function crm_close_before(timestamptz, boolean) to service_role;

select crm_close_before('2026-10-27T00:00:00+01:00', false);
