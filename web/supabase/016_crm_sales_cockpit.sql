-- LNP CRM — the Sales cockpit on live data (web/supabase/016_crm_sales_cockpit.sql), after 015.
-- Cockpit › Sales and Sales System › Cockpit drew the approved mock-up's sample figures. crm_sales_cockpit() computes every
-- figure of that dashboard from the CRM, for the three periods of its switch (last 7, 30 and 56 days), each with its
-- baseline = the same figure over the period just before (the 30 days before the last 30 days…). One call, read with the
-- caller's rights (security invoker: row-level security applies; a sales rep gets their own cycles).
--
-- Definitions (window = [now - days, now), people and events the caller can see):
--   leads          people who came in (crm_people.first_seen_at) in the window
--   calls booked   call_booked events in the window
--   calls held     calls held whose start is in the window; no-shows likewise; show rate = held ÷ (held + no-shows);
--                  no outcome = past calls still 'scheduled' (no outcome declared yet), shown so a low count reads right
--   deals won      cycles won whose closed_at is in the window; close rate = won ÷ held
--   signed         amount sold of the deals said yes in the window (crm_deals.yes_at)
--   cash           payments received in the window, net of refunds (crm_payments); refund rate = refunded ÷ received
--   revenue/call   cash ÷ calls held · average order value = signed ÷ deals with an amount · paid upfront = cash ÷ signed
--   weighted pipe  each live cycle × its value (its deal's amount, else the average order value of the last 180 days)
--                  × the observed win rate of its stage over the last 180 days (cycles closed at that stage or later)
--   follow-up 24 h held calls in the window followed within 24 h of their end by a sales message, a note or an outcome
--   days per stage median days of the stage passages that ended in the window (crm_stage_history)
--   team           the same figures per cycle owner (unassigned cycles together)
--   weekly         revenue per call, average order value and refund rate over the last 8 weeks, one point a week
--   cash at risk   open SLA alerts, then live cycles whose next move is overdue, × the cycle's weighted value
-- Safe to run again.

create or replace function crm_sales_cockpit_window(p_from timestamptz, p_to timestamptz, p_owner uuid default null, p_all boolean default true)
returns jsonb language sql stable set search_path = public as $$
  with
  cy as (select * from crm_cycles where p_all or owner_id is not distinct from p_owner),
  ppl as (select count(*) n from crm_people p where p.merged_into is null and p.first_seen_at >= p_from and p.first_seen_at < p_to
            and (p_all or exists (select 1 from cy where cy.person_id = p.id))),
  bk as (select count(*) n from crm_events e join cy on cy.id = e.cycle_id where e.type = 'call_booked' and e.occurred_at >= p_from and e.occurred_at < p_to),
  ca as (select count(*) filter (where k.status = 'held') held, count(*) filter (where k.status = 'no_show') ns,
                count(*) filter (where k.status = 'scheduled' and k.scheduled_start < now()) pend
           from crm_calls k join cy on cy.id = k.cycle_id where k.scheduled_start >= p_from and k.scheduled_start < p_to),
  wn as (select count(*) n from cy where cy.status = 'won' and cy.closed_at >= p_from and cy.closed_at < p_to),
  dl as (select coalesce(sum(d.amount_sold), 0) signed, count(*) filter (where d.amount_sold > 0) n
           from crm_deals d join cy on cy.id = d.cycle_id where d.yes_at >= p_from and d.yes_at < p_to),
  pay as (select coalesce(sum(p.amount), 0) got, coalesce(sum(p.refunded_amount), 0) back
            from crm_payments p join cy on cy.id = p.cycle_id where p.paid_at >= p_from and p.paid_at < p_to),
  fu as (select count(*) total,
                count(*) filter (where exists (select 1 from crm_events e where e.cycle_id = k.cycle_id
                  and ((e.type = 'message_out' and e.actor = 'sales') or e.type = 'note' or e.type like 'outcome\_%')
                  and e.occurred_at >= coalesce(k.scheduled_end, k.scheduled_start)
                  and e.occurred_at < coalesce(k.scheduled_end, k.scheduled_start) + interval '24 hours')) done
           from crm_calls k join cy on cy.id = k.cycle_id where k.status = 'held' and k.scheduled_start >= p_from and k.scheduled_start < p_to),
  st as (select percentile_cont(0.5) within group (order by h.hours) / 24 med
           from crm_stage_history h join cy on cy.id = h.cycle_id where h.exited_at >= p_from and h.exited_at < p_to and h.hours is not null)
  select jsonb_build_object(
    'leads', (select n from ppl), 'booked', (select n from bk), 'held', (select held from ca), 'no_show', (select ns from ca), 'no_outcome', (select pend from ca),
    'won', (select n from wn), 'signed', (select signed from dl), 'deals', (select n from dl),
    'cash', (select got - back from pay), 'received', (select got from pay), 'refunded', (select back from pay),
    'follow_total', (select total from fu), 'follow_done', (select done from fu), 'days_per_stage', (select round(med::numeric, 1) from st))
$$;

create or replace function crm_sales_cockpit() returns jsonb
language plpgsql stable set search_path = public as $$
declare
  now_ timestamptz := now(); v_days int; v_cur jsonb; v_base jsonb; v_periods jsonb := '{}'; v_team jsonb := '{}'; v_rows jsonb; m record;
  aov180 numeric; pond numeric; v_weekly jsonb; v_week jsonb; v_i int; v_alerts jsonb;
begin
  -- average order value of the last 180 days, for live cycles with no deal yet
  select coalesce(avg(d2.amount_sold) filter (where d2.amount_sold > 0), 0) into aov180 from crm_deals d2 where d2.yes_at >= now_ - interval '180 days';
  -- weighted pipeline: value × observed win rate of the cycle's stage (closed in the last 180 days at that stage or later)
  with ord as (select key, position from crm_stage_definitions),
  closed as (select c.status, o.position from crm_cycles c join ord o on o.key = c.current_stage
               where c.status in ('won', 'lost', 'disqualified') and c.closed_at >= now_ - interval '180 days'),
  p as (select o.key, coalesce((select count(*) filter (where status = 'won')::numeric / nullif(count(*), 0) from closed where closed.position >= o.position), 0) win from ord o)
  select coalesce(sum(coalesce(nullif(dd.amount_sold, 0), aov180) * coalesce(p.win, 0)), 0) into pond
    from crm_cycles c left join p on p.key = c.current_stage left join crm_deals dd on dd.cycle_id = c.id where c.status = 'active';

  foreach v_days in array array[7, 30, 56] loop
    v_cur := crm_sales_cockpit_window(now_ - make_interval(days => v_days), now_);
    v_base := crm_sales_cockpit_window(now_ - make_interval(days => 2 * v_days), now_ - make_interval(days => v_days));
    v_periods := v_periods || jsonb_build_object(v_days::text, jsonb_build_object('now', v_cur, 'base', v_base));
    -- team: the same figures per cycle owner over the period
    v_rows := '[]';
    for m in select c.owner_id, cm.member_key, coalesce(cm.full_name, 'Non attribué') as name
               from crm_cycles c left join crm_members cm on cm.id = c.owner_id group by c.owner_id, cm.member_key, cm.full_name loop
      v_rows := v_rows || jsonb_build_array(jsonb_build_object('id', coalesce(m.member_key, 'none'), 'name', m.name,
        'figures', crm_sales_cockpit_window(now_ - make_interval(days => v_days), now_, m.owner_id, false)));
    end loop;
    v_team := v_team || jsonb_build_object(v_days::text, v_rows);
  end loop;

  -- last 8 weeks, oldest first
  v_weekly := '[]';
  for v_i in reverse 7..0 loop
    v_week := crm_sales_cockpit_window(now_ - make_interval(days => 7 * (v_i + 1)), now_ - make_interval(days => 7 * v_i));
    v_weekly := v_weekly || jsonb_build_array(v_week);
  end loop;

  -- cash at risk: open SLA alerts, then overdue next moves, by weighted value
  with ord as (select key, position from crm_stage_definitions),
  closed as (select c.status, o.position from crm_cycles c join ord o on o.key = c.current_stage
               where c.status in ('won', 'lost', 'disqualified') and c.closed_at >= now_ - interval '180 days'),
  p as (select o.key, coalesce((select count(*) filter (where status = 'won')::numeric / nullif(count(*), 0) from closed where closed.position >= o.position), 0) win from ord o),
  val as (select c.id, coalesce(nullif(dd.amount_sold, 0), aov180) * greatest(coalesce(p.win, 0), 0.05) v
            from crm_cycles c left join p on p.key = c.current_stage left join crm_deals dd on dd.cycle_id = c.id where c.status = 'active'),
  a as (
    select al.rule_id c, coalesce(cm.member_key, 'none') o, coalesce(v.v, 0) imp, al.title t,
           coalesce(pe.full_name, pe.primary_email, '') || coalesce(' · ' || nullif(al.detail, ''), '') obj, al.opened_at at
      from crm_alerts al left join val v on v.id = al.cycle_id left join crm_members cm on cm.id = al.owner_id
      left join crm_people pe on pe.id = al.person_id where al.resolved_at is null
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

revoke execute on function crm_sales_cockpit_window(timestamptz, timestamptz, uuid, boolean) from public, anon;
revoke execute on function crm_sales_cockpit() from public, anon;
grant execute on function crm_sales_cockpit_window(timestamptz, timestamptz, uuid, boolean) to authenticated;
grant execute on function crm_sales_cockpit() to authenticated;
