-- LNP CRM — signed, collected and still to collect (web/supabase/041_crm_cockpit_collected.sql), after 040.
-- Romain, 2026-11-04: "le chiffre d'affaires collecté : si l'encaissé est de 1 000 € sur une vente à 3 500 €, je veux savoir le
-- collecté cumulé", in the cockpit's "Du prospect à l'encaissement" and per sales rep. No payment is recorded today (Whop is
-- not connected); the amount of a sale is the offer's price, matched with what the sales entered in iClosed, and "10
-- instalments" means the client pays the whole price in 10 times.
--   crm_settings.offer_catalogue  the LNP offers and their payment plans, as the sales announce them in the pitch of the calls
--       recorded from 21 Oct to 3 Nov 2026 (66 calls): Accompagnement 4 mois 3 000 € once, 2 × 1 600 € (3 200), 3 × 1 100 €
--       (3 300), 4 × 850 € (3 400); Starter Solo 1 490 € once, 4 × 397 € (1 588); Mentorat 5 490 €; older offers seen in
--       iClosed: LNP 2100 (4 × 525 €), Cours particuliers 2.0 (1 497 €). Edit this setting when a price changes.
--   crm_plan_for_amount(v)   the plan of an amount entered in iClosed: a plan's total, else one of its instalments (the first
--       one paid), else an advance on the default offer (offer_default, 3 000 €; Romain: "les 300 on les déduit"), flagged
--       to_check; an amount above the default price is its own total.
--   crm_apply_auto_plans()   every iClosed deal not set by hand: amount_sold = the plan's total, payment_plan, schedule (one
--       instalment a month from the sale; for an advance, the rest one month later), plan_source = 'auto', plan_match.
--       Run by crm_import_deals (hourly). A plan set by hand (crm_set_deal, crm_set_payment_plan) is marked 'manual' and kept.
--   crm_deal_collected(deal, at)   collected to date: instalments due by then for an 'auto' plan (payments are assumed on
--       time, there is no payment record), else the payments received net of refunds.
--   crm_sales_cockpit_window: + collected, remaining; cash of the period = instalments due in it ('auto' plans) + payments.
-- Safe to run again.

alter table crm_deals add column if not exists plan_source text;
alter table crm_deals add column if not exists plan_match text;

insert into crm_settings (key, value) values ('offer_catalogue', '{
  "observed": "pitch of the calls recorded from 2026-10-21 to 2026-11-03",
  "default": {"offer": "Accompagnement 4 mois", "total": 3000},
  "plans": [
    {"offer": "Accompagnement 4 mois", "n": 1, "instalment": 3000, "total": 3000},
    {"offer": "Accompagnement 4 mois", "n": 2, "instalment": 1600, "total": 3200},
    {"offer": "Accompagnement 4 mois", "n": 3, "instalment": 1100, "total": 3300},
    {"offer": "Accompagnement 4 mois", "n": 4, "instalment": 850, "total": 3400},
    {"offer": "Starter Solo", "n": 1, "instalment": 1490, "total": 1490},
    {"offer": "Starter Solo", "n": 4, "instalment": 397, "total": 1588},
    {"offer": "Mentorat", "n": 1, "instalment": 5490, "total": 5490},
    {"offer": "LNP 2100", "n": 4, "instalment": 525, "total": 2100, "older": true},
    {"offer": "Cours particuliers 2.0", "n": 1, "instalment": 1497, "total": 1497, "older": true}
  ]}'::jsonb) on conflict (key) do nothing;

create or replace function crm_plan_for_amount(p_amount numeric) returns jsonb
language sql stable security definer set search_path = public as $$
  with c as (select value v from crm_settings where key = 'offer_catalogue'),
  p as (select x from c, jsonb_array_elements(c.v->'plans') x)
  select coalesce(
    (select x || '{"match": "total"}' from p where (x->>'total')::numeric = p_amount order by (x->>'n')::int limit 1),
    (select x || '{"match": "instalment"}' from p where (x->>'n')::int > 1 and (x->>'instalment')::numeric = p_amount
      order by (x->>'n')::int limit 1),
    (select jsonb_build_object('offer', c.v #>> '{default,offer}', 'n', 1,
              'total', greatest(p_amount, (c.v #>> '{default,total}')::numeric), 'first', p_amount, 'match', 'to_check') from c))
$$;

create or replace function crm_auto_schedule(p_plan jsonb, p_start date) returns jsonb
language sql immutable as $$
  select case
    when p_plan->>'match' = 'to_check' and (p_plan->>'first')::numeric < (p_plan->>'total')::numeric then
      jsonb_build_array(jsonb_build_object('due', to_char(p_start, 'YYYY-MM-DD'), 'amount', (p_plan->>'first')::numeric),
                        jsonb_build_object('due', to_char(p_start + interval '1 month', 'YYYY-MM-DD'),
                                           'amount', (p_plan->>'total')::numeric - (p_plan->>'first')::numeric))
    else (select jsonb_agg(jsonb_build_object('due', to_char(p_start + make_interval(months => i - 1), 'YYYY-MM-DD'),
                   'amount', case when i < (p_plan->>'n')::int then (p_plan->>'instalment')::numeric
                                  else (p_plan->>'total')::numeric
                                       - coalesce((p_plan->>'instalment')::numeric, 0) * ((p_plan->>'n')::int - 1) end)
                   order by i)
            from generate_series(1, greatest(1, (p_plan->>'n')::int)) i) end
$$;

-- a plan written by anything else than crm_apply_auto_plans is the sales' own: kept from then on
create or replace function crm_deals_plan_source() returns trigger language plpgsql as $$
begin
  if coalesce(current_setting('lnp.auto_plan', true), '') <> 'on'
     and (new.schedule is distinct from old.schedule or new.amount_sold is distinct from old.amount_sold
          or new.payment_plan is distinct from old.payment_plan) then
    new.plan_source := 'manual';
  end if;
  return new;
end $$;
drop trigger if exists crm_deals_plan_source on crm_deals;
create trigger crm_deals_plan_source before update on crm_deals for each row execute function crm_deals_plan_source();

create or replace function crm_apply_auto_plans() returns int
language plpgsql security definer set search_path = public as $$
declare d record; pl jsonb; n int := 0;
begin
  perform set_config('lnp.auto_plan', 'on', true);
  for d in select dd.id, dd.yes_at, (select max(p.amount) from crm_payments p where p.deal_id = dd.id and p.source = 'iclosed') v
             from crm_deals dd where dd.iclosed_deal_ids is not null and dd.plan_source is distinct from 'manual' loop
    continue when d.v is null or d.v <= 0;
    pl := crm_plan_for_amount(d.v);
    update crm_deals set amount_sold = (pl->>'total')::numeric, plan_source = 'auto', plan_match = pl->>'match',
           payment_plan = case when (pl->>'n')::int > 1 then (pl->>'n') || ' échéances' when pl->>'match' = 'to_check' then 'Acompte'
                               else 'Payé en une fois' end,
           schedule = crm_auto_schedule(pl, (coalesce(d.yes_at, now()) at time zone 'Europe/Paris')::date)
     where id = d.id;
    n := n + 1;
  end loop;
  perform set_config('lnp.auto_plan', 'off', true);
  return n;
end $$;

create or replace function crm_deal_collected(p_deal uuid, p_at timestamptz) returns numeric
language sql stable security definer set search_path = public as $$
  select case when d.plan_source = 'auto' and jsonb_typeof(d.schedule) = 'array' then
      (select coalesce(sum((e->>'amount')::numeric), 0) from jsonb_array_elements(d.schedule) e
        where (e->>'due')::date <= (p_at at time zone 'Europe/Paris')::date)
    else (select coalesce(sum(p.amount - coalesce(p.refunded_amount, 0)), 0) from crm_payments p
           where p.deal_id = d.id and p.paid_at <= p_at) end
  from crm_deals d where d.id = p_deal
$$;

revoke execute on function crm_plan_for_amount(numeric), crm_apply_auto_plans(), crm_deal_collected(uuid, timestamptz) from public, anon, authenticated;

create or replace function crm_import_deals(p_items jsonb, p_dry boolean default false) returns jsonb
language plpgsql security definer set search_path = public as $$
declare it jsonb; cyc uuid; per uuid; d crm_deals; at timestamptz; amt numeric; kind text;
        n_items int := 0; n_matched int := 0; n_unmatched int := 0; n_new int := 0; n_updated int := 0; n_manual int := 0;
        touched uuid[] := '{}';
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
    at := coalesce(nullif(it->>'at', '')::timestamptz, now());
    kind := case when upper(it->>'type') = 'DEPOSIT' then 'deposit' else 'won' end;
    if amt is null or amt <= 0 then continue; end if;
    if exists (select 1 from crm_payments where iclosed_deal_id = it->>'iclosed_deal_id') then n_updated := n_updated + 1;
    else n_new := n_new + 1; end if;
    if p_dry then continue; end if;

    select * into d from crm_deals where cycle_id = cyc;
    if d.id is null then
      insert into crm_deals (cycle_id, product, amount_sold, currency, yes_at, iclosed_deal_ids)
      values (cyc, nullif(it->>'product', ''), 0, 'EUR', at, array[it->>'iclosed_deal_id']) returning * into d;
    elsif d.iclosed_deal_ids is null and coalesce(d.amount_sold, 0) > 0 then
      n_manual := n_manual + 1;                      -- an amount entered by hand stays; the payment is still recorded
    else
      update crm_deals set iclosed_deal_ids = (select array_agg(distinct x) from unnest(coalesce(iclosed_deal_ids, '{}') || (it->>'iclosed_deal_id')) x),
             product = coalesce(product, nullif(it->>'product', '')), yes_at = least(coalesce(yes_at, at), at)
       where id = d.id;
    end if;
    insert into crm_payments (deal_id, cycle_id, amount, currency, status, paid_at, refunded_amount, source, method, iclosed_deal_id, data)
    values (d.id, cyc, amt, 'EUR', 'paid', at, 0, 'iclosed', kind, it->>'iclosed_deal_id',
            jsonb_build_object('product', it->>'product', 'transaction_type', it->>'type'))
    on conflict (iclosed_deal_id) do update set amount = excluded.amount, paid_at = excluded.paid_at, method = excluded.method,
      cycle_id = excluded.cycle_id, deal_id = excluded.deal_id, data = excluded.data, updated_at = now();
    insert into crm_events (person_id, cycle_id, occurred_at, actor, channel, type, data, source, source_id)
    select c.person_id, cyc, at, 'sales', 'payment', 'payment_succeeded',
           jsonb_build_object('amount', amt, 'currency', 'EUR', 'method', kind, 'iclosed', true), 'iclosed', 'deal:' || (it->>'iclosed_deal_id')
      from crm_cycles c where c.id = cyc
    on conflict (source, source_id) do update set occurred_at = excluded.occurred_at, cycle_id = excluded.cycle_id, data = excluded.data;
    touched := touched || cyc;
  end loop;
  if not p_dry then
    -- 041: amount sold = the offer's price, and its instalments, from the amount entered in iClosed (crm_apply_auto_plans)
    perform crm_apply_auto_plans();
    perform crm_recompute_cycle(x) from (select distinct unnest(touched) x) t;
  end if;
  return jsonb_build_object('deals', n_items, 'matched', n_matched, 'unmatched', n_unmatched, 'new', n_new, 'updated', n_updated,
                            'manual_deal_kept', n_manual, 'dry', p_dry);
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
  -- 041 (Romain 2026-11-04): signed = the offer's price of the sales of the period; collected = what those sales have
  -- brought in to date (instalments due, or payments received); cash of the period = instalments due in the period for
  -- the plans worked out from iClosed, payments received in the period for the others
  dl as (select coalesce(sum(d.amount_sold), 0) signed, count(*) filter (where d.amount_sold > 0) n,
                coalesce(sum(crm_deal_collected(d.id, now())), 0) collected
           from crm_deals d join cy on cy.id = d.cycle_id where d.yes_at >= p_from and d.yes_at < p_to),
  sch as (select coalesce(sum((e->>'amount')::numeric), 0) v
            from crm_deals d join cy on cy.id = d.cycle_id, jsonb_array_elements(d.schedule) e
           where d.plan_source = 'auto' and jsonb_typeof(d.schedule) = 'array'
             and (e->>'due')::date >= (p_from at time zone 'Europe/Paris')::date and (e->>'due')::date < (p_to at time zone 'Europe/Paris')::date
             and (e->>'due')::date <= (now() at time zone 'Europe/Paris')::date),
  pay as (select coalesce(sum(p.amount), 0) + (select v from sch) got, coalesce(sum(p.refunded_amount), 0) back
            from crm_payments p join cy on cy.id = p.cycle_id left join crm_deals d on d.id = p.deal_id
           where p.paid_at >= p_from and p.paid_at < p_to and d.plan_source is distinct from 'auto'),
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
    'collected', (select collected from dl), 'remaining', (select signed - collected from dl),
    'cash', (select got - back from pay), 'received', (select got from pay), 'refunded', (select back from pay),
    'follow_total', (select total from fu), 'follow_done', (select done from fu), 'days_per_stage', (select round(med::numeric, 1) from st))
$$;

select crm_apply_auto_plans();
