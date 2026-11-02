-- 028: Sales cycle SLAs v3 posted to Slack (Romain 2026-10-30, docs/crm/18-sales-cycle-slas.md).
-- Every 5 minutes pg_cron calls the Edge Function sla-tick: it reads the active cycles (crm_sla_snapshot), applies the rules of
-- supabase/functions/_shared/sla_rules.js (the same file the Sales cycle screen runs) and posts each new Late or Critical miss
-- to Slack #sales-cycle (IDA workspace) through the incoming webhook in the function secret SLACK_SALES_CYCLE_WEBHOOK_URL.
-- crm_sla_notices keeps what was posted (one row per cycle, SLA, start and level: never posted twice). Misses older than
-- crm_settings.sla_alerts.since (this file's run) or than max_age_hours are never posted: no flood of the past.

create table if not exists crm_sla_notices (
  key        text primary key,                 -- cycle:sla:start minute:level
  cycle_id   uuid references crm_cycles(id) on delete cascade,
  sla        text not null,
  level      text not null check (level in ('late', 'crit')),
  crossed_at timestamptz not null,             -- when the threshold was passed
  sent_at    timestamptz not null default now()
);
alter table crm_sla_notices enable row level security;   -- service role only (no policy)
create index if not exists crm_sla_notices_cycle on crm_sla_notices(cycle_id);

insert into crm_settings (key, value, is_proposal)
values ('sla_alerts', jsonb_build_object('since', now(), 'channel', '#sales-cycle', 'max_age_hours', 6, 'window_tz', 'America/New_York'), true)
on conflict (key) do nothing;

-- the active cycles with what the rules read (events of the last p_days, calls); no message text, no transcript
create or replace function crm_sla_snapshot(p_days int default 60) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', c.id, 'opened_at', c.opened_at, 'person', p.full_name, 'owner', m.full_name, 'owner_key', m.member_key,
    'events', (select coalesce(jsonb_agg(jsonb_build_object('type', e.type, 'at', e.occurred_at, 'actor', e.actor, 'channel', e.channel,
                 'call_id', e.call_id, 'source', e.source) order by e.occurred_at), '[]'::jsonb)
                 from crm_events e where e.cycle_id = c.id and e.occurred_at > now() - make_interval(days => p_days)),
    'calls', (select coalesce(jsonb_agg(jsonb_build_object('id', k.id, 'rank', k.rank, 'status', k.status,
                 'start', k.scheduled_start, 'end', k.scheduled_end)), '[]'::jsonb) from crm_calls k where k.cycle_id = c.id))), '[]'::jsonb)
  from crm_cycles c left join crm_people p on p.id = c.person_id left join crm_members m on m.id = c.owner_id
  where c.status = 'active' and coalesce(c.last_event_at, c.opened_at) > now() - make_interval(days => p_days)
$$;
revoke execute on function crm_sla_snapshot(int) from public, anon, authenticated;
grant execute on function crm_sla_snapshot(int) to service_role;

-- keeps the keys not posted yet and records them (the caller posts exactly what this returns)
create or replace function crm_sla_claim(p_items jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare out jsonb;
begin
  with ins as (
    insert into crm_sla_notices (key, cycle_id, sla, level, crossed_at)
    select x->>'key', (x->>'cycle_id')::uuid, x->>'sla', x->>'level', (x->>'crossed_at')::timestamptz from jsonb_array_elements(p_items) x
    on conflict (key) do nothing returning key)
  select coalesce(jsonb_agg(key), '[]'::jsonb) into out from ins;
  return out;
end $$;
revoke execute on function crm_sla_claim(jsonb) from public, anon, authenticated;
grant execute on function crm_sla_claim(jsonb) to service_role;
create or replace function crm_sla_settings() returns jsonb language sql stable security definer set search_path = public as $$
  select value from crm_settings where key = 'sla_alerts'
$$;
revoke execute on function crm_sla_settings() from public, anon, authenticated;
grant execute on function crm_sla_settings() to service_role;

-- the schedule (every 5 minutes) is in 006_crm_cron.sql with the other jobs
