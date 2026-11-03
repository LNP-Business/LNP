-- LNP CRM — the Sales cockpit, fast (web/supabase/017_crm_sales_cockpit_fast.sql), after 016.
-- 016 ran with the caller's row-level security on every row read: 45 s for an admin, over Supabase's 8 s statement limit
-- for signed-in people, so the browser got an error and the cockpit kept its sample figures. Same figures, same rules,
-- decided once per call: crm_sales_cockpit() runs as security definer, refuses a person with no CRM role, and keeps to
-- the cycles the caller may see (every cycle for admins, sales leads and viewers, else the cycles they own; people and
-- alerts likewise), the list it hands to crm_sales_cockpit_window(), which nobody else can call. Safe to run again.

drop function if exists crm_sales_cockpit_window(timestamptz, timestamptz, uuid, boolean);

create or replace function crm_sales_cockpit_window(p_from timestamptz, p_to timestamptz, p_ids uuid[], p_people_all boolean, p_owner uuid default null, p_all boolean default true)
returns jsonb language sql stable security definer set search_path = public as $$
  with
  cy as (select * from crm_cycles where id = any(p_ids) and (p_all or owner_id is not distinct from p_owner)),
  ppl as (select count(*) n from crm_people p where p.merged_into is null and p.first_seen_at >= p_from and p.first_seen_at < p_to
            and ((p_all and p_people_all) or exists (select 1 from cy where cy.person_id = p.id))),
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
    for m in select c.owner_id, cm.member_key, coalesce(cm.full_name, 'Non attribué') as name
               from crm_cycles c left join crm_members cm on cm.id = c.owner_id where c.id = any(v_ids) group by c.owner_id, cm.member_key, cm.full_name loop
      v_rows := v_rows || jsonb_build_array(jsonb_build_object('id', coalesce(m.member_key, 'none'), 'name', m.name,
        'figures', crm_sales_cockpit_window(now_ - make_interval(days => v_days), now_, v_ids, v_sees, m.owner_id, false)));
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

revoke execute on function crm_sales_cockpit_window(timestamptz, timestamptz, uuid[], boolean, uuid, boolean) from public, anon, authenticated;
revoke execute on function crm_sales_cockpit() from public, anon;
grant execute on function crm_sales_cockpit() to authenticated;
