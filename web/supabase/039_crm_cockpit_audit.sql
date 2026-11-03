-- LNP CRM — Sales cockpit audit (web/supabase/039_crm_cockpit_audit.sql), after 038.
-- Romain, 2026-11-03, after a check of every cockpit figure:
--   1. "Appels honorés" = the leads who showed at their R1 (the same count as the show rate's numerator, 038 counted the
--      first held R1 apart, so 31 showed for 30 held over 7 days); the 24 h follow-up counts those R1 calls only.
--   2. An R1 with no outcome declared (no iClosed outcome, no complete Fathom recording) is pending, neither shown nor
--      a no-show, for crm_settings.show_pending_hours (48) after its start, then a no-show ("absents après 48 h").
--   3. Former sales reps (crm_sales_team.active = false) have no row in the team; their cycles still count in the totals.
--   4. The team's own test records (an email of crm_settings.internal_domains, ["lesnouveauxprofs.fr"]) never count.
--   5. iClosed contacts and calls are imported every hour (webhooks alone missed outcomes declared later in iClosed).
-- Safe to run again.

alter table crm_sales_team add column if not exists active boolean not null default true;
update crm_sales_team set active = false
 where rep in ('alexandre', 'charline', 'laetitia', 'lucasphilippe21', 'nicolas.valere', 'sacha', 'theodore', 'theodorecloser', 'yann');

insert into crm_settings (key, value) values ('internal_domains', '["lesnouveauxprofs.fr"]'::jsonb) on conflict (key) do nothing;
insert into crm_settings (key, value) values ('show_pending_hours', '48'::jsonb) on conflict (key) do nothing;

create or replace function crm_person_internal(p_person uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from crm_person_identities i, jsonb_array_elements_text(coalesce((select value from crm_settings where key = 'internal_domains'), '[]')) d
                  where i.person_id = p_person and i.kind = 'email' and i.value like '%@' || d)
$$;
create or replace function crm_show_pending_hours() returns int
language sql stable security definer set search_path = public as $$
  select coalesce((select (value #>> '{}')::int from crm_settings where key = 'show_pending_hours'), 48)
$$;
revoke execute on function crm_person_internal(uuid), crm_show_pending_hours() from public, anon;

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
    -- the sales rep of a cycle: its owner, else the host of its latest booked call (iClosed); only the reps of the
    -- current team (crm_sales_team, active) get a row, the cycles of reps who left keep them and count in the totals only
    for m in select min(r.rep) as rep, st.name as name, array_agg(r.id) as ids from (
               select c.id, coalesce(cm.member_key, nullif(split_part(h.host, '@', 1), ''), 'none') as rep,
                      coalesce(cm.full_name, initcap(nullif(split_part(split_part(h.host, '@', 1), '.', 1), '')), 'Non attribué') as name
                 from crm_cycles c left join crm_members cm on cm.id = c.owner_id
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

create or replace function crm_sales_cockpit_window(p_from timestamptz, p_to timestamptz, p_ids uuid[], p_people_all boolean, p_owner uuid default null, p_all boolean default true)
returns jsonb language sql stable security definer set search_path = public as $$
  with
  -- 039: the team's own test records (an email of crm_settings.internal_domains) never count
  cy as (select * from crm_cycles where id = any(p_ids) and (p_all or owner_id is not distinct from p_owner) and not crm_person_internal(person_id)),
  ppl as (select count(*) n from crm_people p where p.merged_into is null and p.first_seen_at >= p_from and p.first_seen_at < p_to and not crm_person_internal(p.id)
            and ((p_all and p_people_all) or exists (select 1 from cy where cy.person_id = p.id))),
  -- LNP (Romain 2026-11-03): the leads of the period who booked a call (any time), so "RDV pris" never exceeds "Prospects"
  -- (before: every booking of the period, leads who came in earlier and second bookings included)
  bk as (select count(distinct p.id) n from crm_people p where p.merged_into is null and p.first_seen_at >= p_from and p.first_seen_at < p_to
           and exists (select 1 from cy join crm_events e on e.cycle_id = cy.id where cy.person_id = p.id and e.type = 'call_booked')),
  ca as (select count(*) filter (where k.status = 'no_show') ns,
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
           from crm_calls k join cy on cy.id = k.cycle_id where k.status = 'held' and k.rank = 1 and k.scheduled_start >= p_from and k.scheduled_start < p_to
            and not exists (select 1 from crm_calls k2 where k2.cycle_id = k.cycle_id and k2.status = 'held' and k2.rank = 1
                              and (k2.scheduled_start, k2.id) < (k.scheduled_start, k.id))),
  -- 038 (Romain 2026-11-03): "le taux de présence doit être entre appels bookés et appels réalisés". The leads with an R1 due in
  -- the period (rank 1, start passed; a lead whose R1 calls were all canceled is left out); showed = an R1 held in the period
  -- (iClosed outcome), a complete Fathom recording (032) or a won cycle; every other lead with an R1 due = no-show.
  -- Before (032): showed only with a Fathom recording of 30 min or more, so a held R1 without recording counted as a no-show.
  -- 039 (Romain 2026-11-03): an R1 with no outcome declared yet (no iClosed outcome, no Fathom recording) is pending for
  -- crm_settings.show_pending_hours (48) after its start, then a no-show; a lead pending is neither shown nor a no-show
  ld as (select cy.id,
           (cy.status = 'won' or bool_or(k.status = 'held' or crm_call_complete(k))) shown,
           (bool_or(k.status = 'no_show') is not true
              and bool_and(k.status = 'canceled' or (k.status = 'scheduled' and k.scheduled_start > now() - make_interval(hours => crm_show_pending_hours())))) pending
           from cy join crm_calls k on k.cycle_id = cy.id
          where k.rank = 1 and k.scheduled_start >= p_from and k.scheduled_start < p_to and k.scheduled_start < now()
          group by cy.id, cy.status having not bool_and(k.status = 'canceled')),
  st as (select percentile_cont(0.5) within group (order by h.hours) / 24 med
           from crm_stage_history h join cy on cy.id = h.cycle_id where h.exited_at >= p_from and h.exited_at < p_to and h.hours is not null)
  select jsonb_build_object(
    'leads', (select n from ppl), 'booked', (select n from bk), 'held', (select count(*) from ld where shown), 'no_show', (select ns from ca), 'no_outcome', (select pend from ca),
    'shown_leads', (select count(*) from ld where shown), 'no_show_leads', (select count(*) from ld where not shown and not pending),
    'pending_leads', (select count(*) from ld where not shown and pending),
    'won', (select n from wn), 'signed', (select signed from dl), 'deals', (select n from dl),
    'cash', (select got - back from pay), 'received', (select got from pay), 'refunded', (select back from pay),
    'follow_total', (select total from fu), 'follow_done', (select done from fu), 'days_per_stage', (select round(med::numeric, 1) from st))
$$;


do $$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname in ('crm-iclosed-contacts-hourly', 'crm-iclosed-calls-hourly');
    perform cron.schedule('crm-iclosed-contacts-hourly', '3 * * * *', $job$
  select net.http_post(url := (select value #>> '{}' from public.crm_settings where key = 'functions_url') || '/crm-import?source=iclosed',
    body := '{}'::jsonb, headers := '{"content-type": "application/json"}'::jsonb, timeout_milliseconds := 150000)
  where exists (select 1 from public.crm_settings where key = 'functions_url')
$job$);
    perform cron.schedule('crm-iclosed-calls-hourly', '15 * * * *', $job$
  select net.http_post(url := (select value #>> '{}' from public.crm_settings where key = 'functions_url') || '/crm-import?source=iclosed_calls',
    body := '{}'::jsonb, headers := '{"content-type": "application/json"}'::jsonb, timeout_milliseconds := 150000)
  where exists (select 1 from public.crm_settings where key = 'functions_url')
$job$);
  end if;
end $$;
