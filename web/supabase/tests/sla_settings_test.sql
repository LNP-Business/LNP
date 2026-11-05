-- 044_crm_sla_settings.sql: the SLA settings of Settings › Alerts, saved by an admin, read by sla-tick.
do $$
declare adm uuid := gen_random_uuid(); vw uuid := gen_random_uuid(); got jsonb; refused boolean;
begin
  insert into auth.users (id, email) values (adm, 'slaadm@x.com'), (vw, 'slaview@x.com');
  insert into members (user_id, email, role) values (adm, 'slaadm@x.com', 'admin'), (vw, 'slaview@x.com', 'viewer');
  insert into crm_members (id, member_key, full_name, email, role) values
    (adm, 'slaadm', 'Sla Admin', 'slaadm@x.com', 'admin'), (vw, 'slaview', 'Sla View', 'slaview@x.com', 'viewer')
  on conflict (id) do update set role = excluded.role, active = true;
  got := (select value from crm_settings where key = 'sla_rules');
  assert got->'sources'->>'messages' = 'false' and got->'sources'->>'whop' = 'false', 'messages and Whop not connected by default';
  assert (crm_sla_settings())->>'channel' = '#sales-cycle' and (crm_sla_settings())->'sla_rules' ? 'sources', 'sla-tick reads both';
  perform set_config('request.jwt.claim.sub', adm::text, true);
  got := crm_save_sla_rules('{"sources": {"messages": true}, "rules": {"SH-2": {"on": true, "late": 0.5, "slack": false}, "DE-8": {"warn": 3}}}');
  assert got->'rules'->'SH-2'->>'late' = '0.5' and got->'sources'->>'messages' = 'true', 'saved';
  assert (crm_sla_settings())->'sla_rules'->'rules'->'DE-8'->>'warn' = '3', 'sla-tick sees it';
  assert exists (select 1 from crm_audit_log where entity_id = 'sla_rules'), 'audited';
  refused := false; begin perform crm_save_sla_rules('{"rules": {"SH-2": {"late": -1}}}'); exception when others then refused := true; end;
  assert refused, 'a negative threshold is refused';
  refused := false; begin perform crm_save_sla_rules('{"rules": {"XX-1": {"on": true}}}'); exception when others then refused := true; end;
  assert refused, 'an unknown SLA is refused';
  refused := false; begin perform crm_save_sla_rules('{"sources": {"fax": true}}'); exception when others then refused := true; end;
  assert refused, 'an unknown source is refused';
  perform set_config('request.jwt.claim.sub', vw::text, true);
  refused := false; begin perform crm_save_sla_rules('{"rules": {}}'); exception when others then refused := true; end;
  assert refused, 'a viewer cannot save';
  perform set_config('request.jwt.claim.sub', '', true);
  assert not has_function_privilege('authenticated', 'crm_sla_settings()', 'execute'), 'sla-tick settings closed to the browser';
end $$;
select 'sla settings SQL checks: all passed';
