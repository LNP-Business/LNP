-- 034_lnp_fr_labels.sql: a database loaded with the English labels gets the French ones; a label changed by hand stays;
-- a second run changes nothing.
update crm_stage_definitions set label = 'Show' where key = 'show';
update crm_reason_codes set label = 'Lack of trust' where code = 'trust';
update crm_reason_codes set label = 'Our own label' where code = 'price';
update crm_reason_codes set label = 'Refunded' where code = 'refunded';
update crm_rules set description = 'Held call with no Fathom recording' where key = 'not_recorded';
update crm_settings set value = jsonb_set(value, '{0,name}', '"Call outcome missing"') where key = 'alert_rule_defaults';
do $$
declare pid uuid; c1 uuid; c2 uuid; c3 uuid; wl bigint;
begin
  insert into crm_people (full_name) values ('FR Label Lead') returning id into pid;
  insert into crm_cycles (person_id, opened_at, next_move) values (pid, now() - interval '3 days',
    '{"who":"prospect","code":"attend_call","label":"Call R2","due_at":"2026-11-04T10:00:00Z"}') returning id into c1;
  insert into crm_cycles (person_id, opened_at, next_move, status, closed_at) values (pid, now() - interval '9 days',
    '{"who":"sales","code":"rebook","label":"Plan a reschedule","missed":2}', 'lost', now() - interval '8 days') returning id into c2;
  insert into crm_cycles (person_id, opened_at, next_move, status, closed_at) values (pid, now() - interval '20 days',
    '{"who":"sales","code":"follow_up","label":"Follow up"}', 'lost', now() - interval '19 days') returning id into c3;
  insert into crm_deals (cycle_id, amount_sold, payment_plan) values (c1, 3000, '3 instalments'), (c2, 1000, 'Paid in full');
  insert into crm_webhook_log (source, headers, body) values ('iclosed', '{}', '{}') returning id into wl;
  insert into crm_unmatched_inbox (inbox_id, source, reason) values (wl, 'iclosed', 'Identifiers point to several people');
end $$;

\ir ../034_lnp_fr_labels.sql

do $$
begin
  assert (select label from crm_stage_definitions where key = 'show') = 'Présence', 'stage label';
  assert (select label from crm_reason_codes where code = 'trust') = 'Manque de confiance', 'reason label';
  assert (select label from crm_reason_codes where code = 'refunded') = 'Remboursé', 'refunded label';
  assert (select label from crm_reason_codes where code = 'price') = 'Our own label', 'a label changed by hand stays';
  assert (select description from crm_rules where key = 'not_recorded') = 'Appel honoré sans enregistrement Fathom', 'rule description';
  assert (select value->0->>'name' from crm_settings where key = 'alert_rule_defaults') = 'Issue de l''appel manquante', 'alert rule name';
  assert (select value->0->>'id' from crm_settings where key = 'alert_rule_defaults') = 'c1'
     and (select jsonb_array_length(value) from crm_settings where key = 'alert_rule_defaults') = 18, 'alert rules kept';
  assert (select value->>'channel' from crm_settings where key = 'sla_alerts') = '#sales-cycle', 'the Slack channel stays';
  assert (select string_agg(next_move->>'label', ' | ' order by opened_at desc) from crm_cycles c join crm_people p on p.id = c.person_id
           where p.full_name = 'FR Label Lead') = 'Appel R2 | Replanifier l''appel | Relancer', 'next moves';
  assert (select next_move->>'code' from crm_cycles c join crm_people p on p.id = c.person_id where p.full_name = 'FR Label Lead'
           order by opened_at desc limit 1) = 'attend_call', 'codes unchanged';
  assert (select string_agg(d.payment_plan, ' | ' order by d.amount_sold) from crm_deals d join crm_cycles c on c.id = d.cycle_id
           join crm_people p on p.id = c.person_id where p.full_name = 'FR Label Lead') = 'Payé en une fois | 3 échéances', 'payment plans';
  assert not exists (select 1 from crm_unmatched_inbox where reason = 'Identifiers point to several people'), 'unmatched reason';
  assert crm_ca_call_info(gen_random_uuid()) is null, 'functions redefined and callable';
end $$;

-- a second run changes nothing
\ir ../034_lnp_fr_labels.sql
do $$
begin
  assert (select label from crm_stage_definitions where key = 'show') = 'Présence', 'stage label after a second run';
  assert (select label from crm_reason_codes where code = 'price') = 'Our own label', 'hand label after a second run';
  assert (select string_agg(next_move->>'label', ' | ' order by opened_at desc) from crm_cycles c join crm_people p on p.id = c.person_id
           where p.full_name = 'FR Label Lead') = 'Appel R2 | Replanifier l''appel | Relancer', 'next moves after a second run';
end $$;
select 'LNP French labels SQL checks: all passed';
