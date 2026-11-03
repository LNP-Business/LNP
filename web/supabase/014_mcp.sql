-- LNP — Claude connector (web/supabase/014_mcp.sql), after 013. docs/crm/17-claude-connector.md.
-- 1. The OAuth tables of the small authorization server on Vercel (web/api/oauth.js): clients registered by Claude
--    (RFC 7591) and one-time authorization codes (60 s, single use, stored as a hash). Row-level security on and no
--    policy: only the service role (server code) reads or writes them.
-- 2. One audit row per tool call in crm_audit_log (action "mcp:<tool>", input summary, row count, duration; never a
--    message body) and the rate limit (60 tool calls per person per minute), both run with the caller's own token.
-- Safe to run again.

create table if not exists mcp_oauth_clients (
  client_id     text primary key,
  client_name   text,
  redirect_uris text[] not null,
  created_at    timestamptz not null default now()
);

create table if not exists mcp_oauth_codes (
  code_hash      text primary key,
  client_id      text not null references mcp_oauth_clients(client_id) on delete cascade,
  redirect_uri   text not null,
  code_challenge text not null,
  user_id        uuid not null,
  access_token   text not null,
  refresh_token  text not null,
  expires_in     int not null default 3600,
  expires_at     timestamptz not null,
  created_at     timestamptz not null default now()
);
create index if not exists mcp_oauth_codes_expires on mcp_oauth_codes (expires_at);

alter table mcp_oauth_clients enable row level security;
alter table mcp_oauth_codes enable row level security;
revoke all on mcp_oauth_clients, mcp_oauth_codes from anon, authenticated;

create index if not exists crm_audit_log_actor_at on crm_audit_log (actor_id, at desc);

-- start of a tool call: refuses a person with no CRM role and the 61st call of a minute, writes the audit row
create or replace function crm_mcp_call(p_tool text, p_input jsonb) returns bigint
language plpgsql security definer set search_path = public as $$
declare n int; rid bigint;
begin
  if crm_role() is null then raise exception 'Aucun rôle dans le CRM' using errcode = '42501'; end if;
  select count(*) into n from crm_audit_log where actor_id = auth.uid() and action like 'mcp:%' and at > now() - interval '1 minute';
  if n >= 60 then raise exception 'Trop de requêtes : 60 appels d''outil par minute' using errcode = 'P0M60'; end if;
  insert into crm_audit_log (actor_id, action, entity, entity_id, after)
  values (auth.uid(), 'mcp:' || left(p_tool, 40), 'mcp', left(p_tool, 40), jsonb_build_object('input', coalesce(p_input, '{}'::jsonb)))
  returning id into rid;
  return rid;
end $$;

-- end of a tool call: row count and duration on the same row
create or replace function crm_mcp_done(p_id bigint, p_rows int, p_ms int, p_error text) returns void
language sql security definer set search_path = public as $$
  update crm_audit_log set after = after || jsonb_strip_nulls(jsonb_build_object('rows', p_rows, 'ms', p_ms, 'error', left(p_error, 200)))
   where id = p_id and actor_id = auth.uid() and action like 'mcp:%'
$$;

revoke execute on function crm_mcp_call(text, jsonb) from public, anon;
revoke execute on function crm_mcp_done(bigint, int, int, text) from public, anon;
grant execute on function crm_mcp_call(text, jsonb) to authenticated;
grant execute on function crm_mcp_done(bigint, int, int, text) to authenticated;
