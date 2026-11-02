-- 014_mcp.sql: audit row per tool call, rate limit of 60 calls per minute, no CRM role refused, OAuth tables closed.
do $$
declare uid uuid := gen_random_uuid(); rid bigint; i int; refused boolean := false;
begin
  insert into auth.users (id, email) values (uid, 'mcptest@x.com');
  insert into members (user_id, email, role) values (uid, 'mcptest@x.com', 'viewer');   -- 011 makes them a CRM viewer
  insert into crm_members (id, member_key, full_name, email, role) values (uid, 'mcptest', 'Mcp Test', 'mcptest@x.com', 'viewer') on conflict (id) do nothing;
  perform set_config('request.jwt.claim.sub', uid::text, true);
  rid := crm_mcp_call('whoami', '{"q":"x"}');
  perform crm_mcp_done(rid, 3, 42, null);
  assert (select action || '/' || (after->>'rows') || '/' || (after->>'ms') from crm_audit_log where id = rid) = 'mcp:whoami/3/42', 'audit row';
  for i in 2..60 loop perform crm_mcp_call('whoami', '{}'); end loop;
  begin perform crm_mcp_call('whoami', '{}'); exception when sqlstate 'P0M60' then refused := true; end;
  assert refused, '61st call refused';
  perform set_config('request.jwt.claim.sub', gen_random_uuid()::text, true);
  refused := false;
  begin perform crm_mcp_call('whoami', '{}'); exception when sqlstate '42501' then refused := true; end;
  assert refused, 'no CRM role refused';
  assert not has_table_privilege('authenticated', 'mcp_oauth_codes', 'select'), 'codes closed to signed-in people';
  assert not has_table_privilege('anon', 'mcp_oauth_clients', 'insert'), 'clients closed to anonymous';
  perform set_config('request.jwt.claim.sub', '', true);
end $$;
select 'mcp SQL checks: all passed';
