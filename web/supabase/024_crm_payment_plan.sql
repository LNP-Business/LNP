-- SKL OS CRM — payment plan of a signed client (web/supabase/024_crm_payment_plan.sql), after 023.
-- Romain, 2026-10-28: when a lead closes, its payment terms are set (paid in full, or in several instalments), not the
-- payment method. The plan lives on the deal: crm_deals.schedule = [{"due": "YYYY-MM-DD", "amount": n}, …] in due order,
-- crm_deals.payment_plan = "Paid in full" or "N instalments" (the label the Sales cycle outcome form already writes, 004).
-- The payments received (022, later Whop) are matched to the instalments in due order by the screen; nothing is linked
-- by hand, so a payment entered late or for two instalments at once still settles them.
--   crm_set_payment_plan(p_cycle, p_amount, p_currency, p_schedule)   amount signed + plan in one write; the instalments
--       must add up to the amount signed, 1 to 12 of them, each > 0 with a date. Same people as crm_set_deal (022).
-- Safe to run again.

alter table crm_deals add column if not exists schedule jsonb;

create or replace function crm_set_payment_plan(p_cycle uuid, p_amount numeric, p_currency text, p_schedule jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare me crm_members; d crm_deals; before jsonb; n int; total numeric; sched jsonb;
begin
  if not exists (select 1 from crm_cycles where id = p_cycle) then raise exception 'Unknown cycle' using errcode = 'P0002'; end if;
  me := crm_require(array['admin', 'sales_lead']::member_role[], p_cycle);
  if p_amount is null or p_amount <= 0 then raise exception 'The amount signed must be more than zero' using errcode = '22023'; end if;
  if jsonb_typeof(p_schedule) is distinct from 'array' then raise exception 'The plan is a list of instalments' using errcode = '22023'; end if;
  n := jsonb_array_length(p_schedule);
  if n < 1 or n > 12 then raise exception 'A plan has 1 to 12 instalments' using errcode = '22023'; end if;
  begin
    select jsonb_agg(jsonb_build_object('due', to_char((x->>'due')::date, 'YYYY-MM-DD'), 'amount', round((x->>'amount')::numeric, 2))
                     order by (x->>'due')::date), sum(round((x->>'amount')::numeric, 2))
      into sched, total from jsonb_array_elements(p_schedule) x;
  exception when others then raise exception 'Each instalment needs a date and an amount' using errcode = '22023';
  end;
  if exists (select 1 from jsonb_array_elements(sched) x where (x->>'amount')::numeric <= 0) then
    raise exception 'Each instalment must be more than zero' using errcode = '22023';
  end if;
  if abs(total - round(p_amount, 2)) > 0.01 then
    raise exception 'The instalments add up to %, not to the amount signed (%)', total, round(p_amount, 2) using errcode = '22023';
  end if;
  select * into d from crm_deals where cycle_id = p_cycle;
  before := to_jsonb(d);
  insert into crm_deals (cycle_id, amount_sold, currency, payment_plan, schedule, yes_at)
  values (p_cycle, p_amount, coalesce(nullif(upper(p_currency), ''), 'EUR'),
          case when n = 1 then 'Paid in full' else n || ' instalments' end, sched, now())
  on conflict (cycle_id) do update set amount_sold = excluded.amount_sold,
    currency = coalesce(nullif(upper(p_currency), ''), crm_deals.currency, 'EUR'),
    payment_plan = excluded.payment_plan, schedule = excluded.schedule, yes_at = coalesce(crm_deals.yes_at, excluded.yes_at)
  returning * into d;
  perform crm_audit(me.id, 'set_payment_plan', 'crm_deals', d.id::text, before, to_jsonb(d));
  return d.id;
end $$;

revoke execute on function crm_set_payment_plan(uuid, numeric, text, jsonb) from public, anon;
grant execute on function crm_set_payment_plan(uuid, numeric, text, jsonb) to authenticated;
