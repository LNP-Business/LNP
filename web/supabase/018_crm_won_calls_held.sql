-- LNP CRM — won cycles' calls held, and the team by sales rep (web/supabase/018_crm_won_calls_held.sql), after 017.
-- Romain, 2026-10-25: "every lead that had a sales call and was closed (won) had its call held: validate the outcome".
-- 1. crm_mark_won_calls_held(p_dry): in every won cycle, each past call still "scheduled" (no outcome recorded) becomes held,
--    with an outcome_held event (source crm, actor system), as the iClosed import records held calls (009). No declared
--    outcome is written: a declared "yes" without a payment would reopen the cycle (005 projector: won = first payment), so
--    the cycle stays won from its import. Each cycle is recomputed; the function checks that no won cycle changed status.
--    A dry run is rolled back and returns the counts. Run once below.
-- 2. crm_sales_cockpit(): the Sales team groups cycles by sales rep = the cycle's owner, else the host of its latest booked
--    call (valentino@… → Valentino), so the people who sell show even without an LNP account.
-- Safe to run again.

create or replace function crm_mark_won_calls_held(p_dry boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
declare k record; n int := 0; cycles uuid[] := '{}'; c uuid; won0 int; won1 int;
begin
  select count(*) into won0 from crm_cycles where status = 'won';
  begin
    for k in select kk.id, kk.cycle_id, cy.person_id, coalesce(kk.scheduled_end, kk.scheduled_start) as at
               from crm_calls kk join crm_cycles cy on cy.id = kk.cycle_id
              where cy.status = 'won' and kk.status = 'scheduled' and kk.scheduled_start < now() loop
      update crm_calls set status = 'held' where id = k.id;
      insert into crm_events (person_id, cycle_id, call_id, occurred_at, actor, channel, type, data, source, source_id)
      values (k.person_id, k.cycle_id, k.id, k.at, 'system', 'crm', 'outcome_held', jsonb_build_object('from', 'won cycle: call held (Romain, 2026-10-25)'),
              'crm', 'backfill:held:' || k.id)
      on conflict (source, source_id) do nothing;
      n := n + 1; cycles := cycles || k.cycle_id;
    end loop;
    foreach c in array coalesce((select array_agg(distinct x) from unnest(cycles) x), '{}') loop perform crm_recompute_cycle(c); end loop;
    select count(*) into won1 from crm_cycles where status = 'won';
    if won1 <> won0 then raise exception 'won cycles changed from % to %: nothing saved', won0, won1; end if;
    if p_dry then raise exception 'dry run' using errcode = 'P0D01'; end if;
  exception when sqlstate 'P0D01' then null;
  end;
  return jsonb_build_object('calls_held', n, 'cycles', coalesce(array_length(array(select distinct x from unnest(cycles) x), 1), 0), 'won_cycles', won0);
end $$;
revoke execute on function crm_mark_won_calls_held(boolean) from public, anon, authenticated;

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
    -- the sales rep of a cycle: its owner, else the host of its latest booked call (iClosed), so the team shows the
    -- people who sell even when they have no LNP account (Valentino…)
    for m in select r.rep, min(r.name) as name, array_agg(r.id) as ids from (
               select c.id, coalesce(cm.member_key, nullif(split_part(h.host, '@', 1), ''), 'none') as rep,
                      coalesce(cm.full_name, initcap(nullif(split_part(split_part(h.host, '@', 1), '.', 1), '')), 'Non attribué') as name
                 from crm_cycles c left join crm_members cm on cm.id = c.owner_id
                 left join lateral (select lower(e.data->>'host_email') host from crm_events e
                                     where e.cycle_id = c.id and e.type = 'call_booked' and coalesce(e.data->>'host_email', '') <> ''
                                     order by e.occurred_at desc limit 1) h on true
                where c.id = any(v_ids)) r group by r.rep loop
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

revoke execute on function crm_sales_cockpit() from public, anon;
grant execute on function crm_sales_cockpit() to authenticated;

select crm_mark_won_calls_held(false);
