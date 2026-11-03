-- LNP CRM — cash entered by hand (web/supabase/022_crm_manual_cash.sql), after 021.
-- Romain, 2026-10-26: the cash of signed clients can be entered by hand from the lead record, until Whop sends its payments
-- (phase 5, automatic). Two sources in crm_payments: 'whop' (later, webhook) and 'manual' (this file).
--   crm_set_deal(p_cycle, p_amount, p_currency)   the amount signed (crm_deals.amount_sold), created if missing
--   crm_add_payment(p_cycle, p_amount, p_paid_at, p_method, p_note)   one payment received: a crm_payments row
--       (source manual) and a payment_succeeded event, so the projector (005) marks the cycle won at its first payment
--       and the Sales cockpit (017) counts it as cash
--   crm_delete_payment(p_payment)   removes a manual payment and its event (asked first in the browser), recomputes
-- Who: CRM admins and sales leads, or the sales rep who owns the cycle (crm_require, as for outcomes). Every write audited.
-- Safe to run again.

alter table crm_payments alter column whop_payment_id drop not null;
alter table crm_payments add column if not exists source text not null default 'whop';
alter table crm_payments add column if not exists method text;
alter table crm_payments add column if not exists note text;
alter table crm_payments add column if not exists created_by uuid references crm_members(id);
alter table crm_payments add column if not exists created_at timestamptz not null default now();
do $$ begin
  alter table crm_payments add constraint crm_payments_source check (source in ('whop', 'manual'));
exception when duplicate_object then null; end $$;

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

revoke execute on function crm_set_deal(uuid, numeric, text), crm_add_payment(uuid, numeric, timestamptz, text, text),
  crm_delete_payment(uuid) from public, anon;
grant execute on function crm_set_deal(uuid, numeric, text), crm_add_payment(uuid, numeric, timestamptz, text, text),
  crm_delete_payment(uuid) to authenticated;
