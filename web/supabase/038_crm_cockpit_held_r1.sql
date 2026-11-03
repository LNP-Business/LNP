-- LNP CRM — Sales cockpit: "Appels honorés" counts R1 calls only (web/supabase/038_crm_cockpit_held_r1.sql), after 037.
-- Romain, 2026-11-03: "dans les appels honorés, je ne veux pas que les R2 ou R3, R+ comptent. Les appels honorés ne sont que
-- les R1." crm_sales_cockpit_window (final definition of 036) counts, as held, each lead's first held call of rank 1, in the
-- period where it was held. Every figure built on it follows: the cockpit's calls, close rate (won / held), cash per call
-- (cash / held), the team rows and the weekly series. Live data, 2026-11-03: 7 d 42 -> 30, 30 d 241 -> 142, 56 d 415 -> 239.
-- Show rate (same day): the leads with an R1 due in the period who held it, not only those with a 30 min Fathom recording:
-- 7 d 55 % -> 70 %, 30 d -> 79 %, 56 d -> 83 %.
-- Safe to run again.

create or replace function crm_sales_cockpit_window(p_from timestamptz, p_to timestamptz, p_ids uuid[], p_people_all boolean, p_owner uuid default null, p_all boolean default true)
returns jsonb language sql stable security definer set search_path = public as $$
  with
  cy as (select * from crm_cycles where id = any(p_ids) and (p_all or owner_id is not distinct from p_owner)),
  ppl as (select count(*) n from crm_people p where p.merged_into is null and p.first_seen_at >= p_from and p.first_seen_at < p_to
            and ((p_all and p_people_all) or exists (select 1 from cy where cy.person_id = p.id))),
  -- LNP (Romain 2026-11-03): the leads of the period who booked a call (any time), so "RDV pris" never exceeds "Prospects"
  -- (before: every booking of the period, leads who came in earlier and second bookings included)
  bk as (select count(distinct p.id) n from crm_people p where p.merged_into is null and p.first_seen_at >= p_from and p.first_seen_at < p_to
           and exists (select 1 from cy join crm_events e on e.cycle_id = cy.id where cy.person_id = p.id and e.type = 'call_booked')),
  -- 038 (Romain 2026-11-03): "les appels honorés ne sont que les R1": a lead's first held R1, once, in the period it was held
  -- (a canceled or rescheduled R1 and its new booking are both R1, 029; R2, R3… never count)
  ca as (select count(*) filter (where k.status = 'held' and k.rank = 1 and not exists (select 1 from crm_calls k2 where k2.cycle_id = k.cycle_id
                  and k2.status = 'held' and k2.rank = 1 and (k2.scheduled_start, k2.id) < (k.scheduled_start, k.id))) held,
                count(*) filter (where k.status = 'no_show') ns,
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
  -- 038 (Romain 2026-11-03): "le taux de présence doit être entre appels bookés et appels réalisés". The leads with an R1 due in
  -- the period (rank 1, start passed; a lead whose R1 calls were all canceled is left out); showed = an R1 held in the period
  -- (iClosed outcome), a complete Fathom recording (032) or a won cycle; every other lead with an R1 due = no-show.
  -- Before (032): showed only with a Fathom recording of 30 min or more, so a held R1 without recording counted as a no-show.
  ld as (select cy.id,
           (cy.status = 'won' or bool_or(k.status = 'held' or crm_call_complete(k))) shown, false pending
           from cy join crm_calls k on k.cycle_id = cy.id
          where k.rank = 1 and k.scheduled_start >= p_from and k.scheduled_start < p_to and k.scheduled_start < now()
          group by cy.id, cy.status having not bool_and(k.status = 'canceled')),
  st as (select percentile_cont(0.5) within group (order by h.hours) / 24 med
           from crm_stage_history h join cy on cy.id = h.cycle_id where h.exited_at >= p_from and h.exited_at < p_to and h.hours is not null)
  select jsonb_build_object(
    'leads', (select n from ppl), 'booked', (select n from bk), 'held', (select held from ca), 'no_show', (select ns from ca), 'no_outcome', (select pend from ca),
    'shown_leads', (select count(*) from ld where shown), 'no_show_leads', (select count(*) from ld where not shown and not pending),
    'pending_leads', (select count(*) from ld where not shown and pending),
    'won', (select n from wn), 'signed', (select signed from dl), 'deals', (select n from dl),
    'cash', (select got - back from pay), 'received', (select got from pay), 'refunded', (select back from pay),
    'follow_total', (select total from fu), 'follow_done', (select done from fu), 'days_per_stage', (select round(med::numeric, 1) from st))
$$;
