-- LNP CRM — sales and cash from iClosed's deals (web/supabase/037_crm_iclosed_deals.sql), after 036.
-- Romain, 2026-11-03: the cockpit's money figures (cash, cash per call, average basket, refund rate) were empty because
-- crm_deals and crm_payments had no row: Whop is not connected and nothing was entered by hand. The sales record their
-- deals in iClosed (GET /v1/deals: value, transactionType WON or DEPOSIT, product, time, eventCallId, contactId).
--   crm_import_deals(p_items, p_dry)   one item per iClosed deal, from crm-import ?source=iclosed_deals:
--     the cycle  = the cycle of the iClosed call (crm_calls.iclosed_call_id = eventCallId), else the latest cycle of the
--                  person whose iclosed_contact_id identity is contactId; no cycle = counted as unmatched, nothing written
--     crm_deals  = one per cycle (unique): amount_sold = the sum of the cycle's iClosed deals, product, yes_at = the first
--                  deal's time; a deal entered by hand (no iclosed_deal_ids) is never overwritten
--     crm_payments = one per iClosed deal (source 'iclosed', method 'won' or 'deposit'), amount = value, paid_at = time:
--                  the amount the sales declared received in iClosed (iClosed has no refunds, so refunded_amount stays 0)
--     crm_events = one payment_succeeded per deal (source iclosed, source_id 'deal:<id>'), so crm_recompute_cycle marks
--                  the cycle won at its first payment, like a manual payment (022)
--   Run again = same result (keys: iclosed deal id). Hourly job crm-iclosed-deals-hourly (minute 41).
-- Safe to run again.

alter table crm_deals add column if not exists iclosed_deal_ids text[];
alter table crm_payments add column if not exists iclosed_deal_id text;
create unique index if not exists crm_payments_iclosed_deal_id_key on crm_payments (iclosed_deal_id);
alter table crm_payments drop constraint if exists crm_payments_source;
alter table crm_payments add constraint crm_payments_source check (source in ('whop', 'manual', 'iclosed'));

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
    -- amount sold = the sum of the cycle's iClosed deals (never for a deal entered by hand)
    update crm_deals dd set amount_sold = s.total
      from (select p.deal_id, sum(p.amount) total from crm_payments p where p.source = 'iclosed' group by 1) s
     where s.deal_id = dd.id and dd.iclosed_deal_ids is not null;
    perform crm_recompute_cycle(x) from (select distinct unnest(touched) x) t;
  end if;
  return jsonb_build_object('deals', n_items, 'matched', n_matched, 'unmatched', n_unmatched, 'new', n_new, 'updated', n_updated,
                            'manual_deal_kept', n_manual, 'dry', p_dry);
end $$;

revoke execute on function crm_import_deals(jsonb, boolean) from public, anon, authenticated;
grant execute on function crm_import_deals(jsonb, boolean) to service_role;

do $$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'crm-iclosed-deals-hourly';
    perform cron.schedule('crm-iclosed-deals-hourly', '41 * * * *', $job$
  select net.http_post(
    url := (select value #>> '{}' from public.crm_settings where key = 'functions_url') || '/crm-import?source=iclosed_deals',
    body := '{}'::jsonb,
    headers := '{"content-type": "application/json"}'::jsonb,
    timeout_milliseconds := 120000)
  where exists (select 1 from public.crm_settings where key = 'functions_url')
$job$);
  end if;
end $$;
