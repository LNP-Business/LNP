-- LNP CRM — Sales cockpit: a call belongs to who held it (web/supabase/040_crm_cockpit_rep_by_fathom.sql), after 039.
-- Romain, 2026-11-04: the team rows gave a call to the owner of the iClosed calendar it was booked on; that calendar can
-- be shared (contact@antoine-lenglet.com: calls held by Lucas, Samantha, Nicolas, Valentina, Michael). The rep of a cycle
-- is now its CRM owner, else the person who recorded its latest recorded call in Fathom up to the cycle's close (a call
-- after the sale, such as an onboarding call, is not the sale's), else the iClosed host.
-- Antoine is a former sales rep (crm_sales_team.active = false). Totals do not change: only the team rows.
-- Safe to run again.

update crm_sales_team set active = false where rep = 'contact';

create or replace function crm_sales_cockpit() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  now_ timestamptz := now(); v_days int; v_cur jsonb; v_base jsonb; v_periods jsonb := '{}'; v_team jsonb := '{}'; v_rows jsonb; m record;
  aov180 numeric; pond numeric; v_weekly jsonb; v_week jsonb; v_i int; v_alerts jsonb;
  v_sees boolean := crm_sees_all(); v_ids uuid[]; v_fig jsonb;
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
    -- the sales rep of a cycle: its owner, else who recorded its latest recorded call (Fathom), else the host of its latest booked call (iClosed); only the reps of the
    -- current team (crm_sales_team, active) get a row, the cycles of reps who left keep them and count in the totals only
    for m in select min(r.rep) as rep, st.name as name, array_agg(r.id) as ids from (
               -- 040 (Romain 2026-11-04): the call belongs to who held it, the person who recorded it in Fathom; the
               -- iClosed calendar it was booked on only when no call of the cycle was recorded (shared calendars, such
               -- as contact@antoine-lenglet.com, are used by the whole team)
               select c.id, coalesce(cm.member_key, nullif(split_part(coalesce(f.rec, h.host), '@', 1), ''), 'none') as rep,
                      coalesce(cm.full_name, initcap(nullif(split_part(split_part(coalesce(f.rec, h.host), '@', 1), '.', 1), '')), 'Non attribué') as name
                 from crm_cycles c left join crm_members cm on cm.id = c.owner_id
                 left join lateral (select lower(k.recorded_by) rec from crm_calls k
                                     where k.cycle_id = c.id and coalesce(k.recorded_by, '') <> ''
                                       -- never a call after the sale or the loss (an onboarding call held by someone else)
                                       and (coalesce(k.recording_start, k.scheduled_start) at time zone 'Europe/Paris')::date <= (coalesce(c.closed_at, now_) at time zone 'Europe/Paris')::date
                                     order by coalesce(k.recording_start, k.scheduled_start) desc limit 1) f on true
                 left join lateral (select lower(e.data->>'host_email') host from crm_events e
                                     where e.cycle_id = c.id and e.type = 'call_booked' and coalesce(e.data->>'host_email', '') <> ''
                                     order by e.occurred_at desc limit 1) h on true
                where c.id = any(v_ids)) r join crm_sales_team st on st.rep = r.rep and st.active group by st.name loop
      v_fig := crm_sales_cockpit_window(now_ - make_interval(days => v_days), now_, m.ids, false);
      -- LNP (Romain 2026-11-03): only the sales reps active in the period (a booking, a call, a sale or cash)
      if coalesce((v_fig->>'booked')::numeric, 0) + coalesce((v_fig->>'held')::numeric, 0) + coalesce((v_fig->>'no_show')::numeric, 0)
         + coalesce((v_fig->>'no_outcome')::numeric, 0) + coalesce((v_fig->>'won')::numeric, 0) + coalesce((v_fig->>'deals')::numeric, 0)
         + abs(coalesce((v_fig->>'received')::numeric, 0)) > 0 then
        v_rows := v_rows || jsonb_build_array(jsonb_build_object('id', m.rep, 'name', m.name, 'figures', v_fig));
      end if;
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
