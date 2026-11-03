-- 027: a "yes" outcome fills only what it carries (2026-10-30). Before, a yes declared without an amount set the deal's
-- amount signed, currency, product and payment plan to null, erasing what crm_set_deal / crm_set_payment_plan (022, 024)
-- had set. Same function as 004 except the deal update keeps the existing values when the outcome gives none.
create or replace function crm_declare_outcome(p_call uuid, p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare c crm_calls; cy crm_cycles; me crm_members; prev crm_call_outcomes; o crm_call_outcomes; rk reason_kind;
        att attendance; dec decision; t timestamptz := now();
begin
  select * into c from crm_calls where id = p_call;
  if c.id is null then raise exception 'Appel inconnu'; end if;
  select * into cy from crm_cycles where id = c.cycle_id;
  me := crm_require(array['admin', 'sales_lead']::member_role[], cy.id);
  att := (p->>'attendance')::attendance;
  dec := nullif(p->>'decision', '')::decision;
  if att is null then raise exception 'La présence est obligatoire'; end if;
  if att = 'no_show' and dec is not null then raise exception 'Une absence n''a pas de décision'; end if;
  if att = 'held' and dec is null then raise exception 'Un appel honoré demande une décision'; end if;
  if dec in ('no', 'disqualified') then
    select kind into rk from crm_reason_codes where code = p->>'reason_code' and active;
    if rk is null then raise exception 'Un motif est obligatoire pour la décision %', dec; end if;
    if (dec = 'no' and rk <> 'lost') or (dec = 'disqualified' and rk <> 'disqualified') then
      raise exception 'Le motif % ne correspond pas à la décision %', p->>'reason_code', dec;
    end if;
  end if;
  select * into prev from crm_call_outcomes where call_id = p_call and superseded_at is null;
  if prev.id is not null then update crm_call_outcomes set superseded_at = t where id = prev.id; end if;
  insert into crm_call_outcomes (call_id, attendance, decision, reason_code, nurture, return_date, next_step, amount_sold,
    currency, product, payment_plan, note, extra, declared_by, declared_at)
  values (p_call, att, dec, case when dec in ('no', 'disqualified') then p->>'reason_code' end,
    coalesce(nullif(p->>'nurture', ''), 'none')::nurture_choice, nullif(p->>'return_date', '')::date, p->>'next_step',
    nullif(p->>'amount_sold', '')::numeric, p->>'currency', p->>'product', p->>'payment_plan', p->>'note',
    coalesce(p->'extra', '{}'::jsonb), me.id, t)
  returning * into o;
  update crm_calls set status = att::text::call_status where id = p_call;
  insert into crm_events (person_id, cycle_id, call_id, occurred_at, actor, member_id, channel, type, data, source, source_id)
  values (cy.person_id, cy.id, p_call, t, 'sales', me.id, 'crm', 'outcome_' || att::text,
    jsonb_build_object('outcome_id', o.id, 'correction', prev.id is not null), 'crm', 'crm:crm_call_outcomes:' || o.id || ':attendance');
  if dec is not null then
    insert into crm_events (person_id, cycle_id, call_id, occurred_at, actor, member_id, channel, type, content, data, source, source_id)
    values (cy.person_id, cy.id, p_call, t, 'sales', me.id, 'crm', 'outcome_' || dec::text, o.note,
      jsonb_build_object('outcome_id', o.id, 'reason_code', o.reason_code, 'nurture', o.nurture, 'return_date', o.return_date,
        'next_step', o.next_step, 'amount_sold', o.amount_sold, 'currency', o.currency, 'payment_plan', o.payment_plan),
      'crm', 'crm:crm_call_outcomes:' || o.id || ':decision');
  end if;
  if dec = 'yes' then
    insert into crm_deals (cycle_id, product, amount_sold, currency, payment_plan, yes_at)
    values (cy.id, o.product, o.amount_sold, o.currency, o.payment_plan, t)
    on conflict (cycle_id) do update set product = coalesce(excluded.product, crm_deals.product),
      amount_sold = coalesce(excluded.amount_sold, crm_deals.amount_sold), currency = coalesce(excluded.currency, crm_deals.currency),
      payment_plan = coalesce(excluded.payment_plan, crm_deals.payment_plan), yes_at = coalesce(crm_deals.yes_at, excluded.yes_at);
  end if;
  perform crm_audit(me.id, case when prev.id is null then 'declare_outcome' else 'correct_outcome' end, 'crm_call_outcomes',
    o.id::text, to_jsonb(prev), to_jsonb(o));
  -- the projector (005_crm_pipeline.sql) turns the outcome into the cycle's stage and status
  if to_regprocedure('crm_recompute_cycle(uuid)') is not null then execute 'select crm_recompute_cycle($1)' using cy.id; end if;
  return o.id;
end $$;
