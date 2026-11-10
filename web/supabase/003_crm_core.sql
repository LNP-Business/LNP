-- LNP CRM — core schema (web/supabase/003_crm_core.sql)
-- Applies to the Supabase project of LNP, after 001_init.sql and 002_q4_okrs.sql.
-- Single source of truth for sales cycles: call booked -> won / lost / disqualified, plus nurture.
--
-- DELIBERATE EXCEPTION to the LNP convention "every collection is a JSON document in docs":
-- the CRM needs database-enforced idempotency (unique source ids), real per-sales data isolation
-- (row-level security; docs rows are readable by every member) and high volumes (messages,
-- transcripts). All CRM objects are therefore relational and prefixed crm_. Do not move them into docs.
--
-- Phase 0 created event_source, inbox_status and crm_webhook_log alone (003a, folded into this file in phase 1):
-- those three statements are idempotent so this file also runs on a database where 003a was applied.
-- Run once (Supabase SQL editor or migration), then 004_crm_rpc.sql.
--
-- All timestamps are timestamptz (UTC). Durations are calendar hours.
-- Business rules Romain will decide later live in configuration tables
-- (crm_stage_definitions, crm_rules, crm_reason_codes, crm_settings) and, for alert rules,
-- in the existing docs row config/alerts (rules c1..c18). Seed values are proposals (is_proposal = true).

create extension if not exists pgcrypto;
create extension if not exists citext;

-- ───────────────────────── enums ─────────────────────────
create type member_role      as enum ('admin', 'sales_lead', 'sales', 'viewer');
create type identity_kind    as enum ('email', 'phone', 'iclosed_contact_id', 'whop_user_id', 'whop_member_id');
create type cycle_status     as enum ('active', 'won', 'lost', 'disqualified');
create type cycle_origin     as enum ('new', 'nurture', 'reopened');
create type call_status      as enum ('scheduled', 'canceled', 'held', 'no_show', 'outcome_pending');
create type attendance       as enum ('held', 'no_show');
create type decision         as enum ('yes', 'no', 'follow_up', 'disqualified');
create type nurture_choice   as enum ('none', 'standard', 'light');
create type nurture_status   as enum ('active', 'reactivated', 'archived', 'opted_out', 'removed');
create type actor_kind       as enum ('sales', 'prospect', 'auto', 'system');
do $$ begin create type event_source as enum ('iclosed', 'fathom', 'sendblue', 'whop', 'crm', 'claude', 'rules', 'import'); exception when duplicate_object then null; end $$;  -- also in 003a (phase 0)
create type reason_kind      as enum ('lost', 'disqualified');
create type alert_severity   as enum ('low', 'medium', 'high', 'critical');   -- same scale as Settings › Alerts
do $$ begin create type inbox_status as enum ('received', 'processed', 'ignored', 'failed', 'unmatched', 'rejected'); exception when duplicate_object then null; end $$;  -- also in 003a (phase 0)
create type analysis_status  as enum ('queued', 'done', 'insufficient', 'failed');
create type outbound_status  as enum ('pending_approval', 'queued', 'sent', 'delivered', 'failed', 'blocked', 'rejected');

-- ───────────────────────── team ─────────────────────────
-- One row per signed-in account that takes part in sales. The app-level role (admin / member /
-- viewer) stays in the existing members table; this table only adds what the CRM needs.
-- member_key is the LNP member id used everywhere in LNP ('sales' = Valentino, 'romain', 'amin'...).
create table crm_members (
  id               uuid primary key references public.members(user_id) on delete restrict,  -- existing table (001_init.sql)
  member_key       text not null unique,
  full_name        text not null,
  email            citext not null unique,
  role             member_role not null default 'sales',
  lead_id          uuid references crm_members(id),   -- escalation lead (Valentino -> Romain, Romain -> Amin)
  iclosed_email    citext,            -- email of the member's iClosed account
  fathom_email     citext,            -- email used to record in Fathom
  sendblue_number  text,              -- E.164 Sendblue line of this member
  timezone         text not null default 'Asia/Dubai',
  active           boolean not null default true,
  created_at       timestamptz not null default now()
);
create unique index team_members_sendblue_uq on crm_members(sendblue_number) where sendblue_number is not null;

-- ───────────────────────── people ─────────────────────────
create table crm_people (
  id               uuid primary key default gen_random_uuid(),
  full_name        text,
  primary_email    citext,
  primary_phone    text,              -- E.164
  messaging_consent boolean,          -- null = unknown
  opted_out_at     timestamptz,       -- STOP received: no automated message ever again
  merged_into      uuid references crm_people(id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table crm_person_identities (
  id          uuid primary key default gen_random_uuid(),
  person_id   uuid not null references crm_people(id) on delete cascade,
  kind        identity_kind not null,
  value       text not null,          -- normalised (see 03-identity-matching.md)
  source      event_source not null,
  created_at  timestamptz not null default now(),
  unique (kind, value)
);
create index person_identities_person on crm_person_identities(person_id);

-- ───────────────────────── configuration (DEFERRED values) ─────────────────────────
create table crm_stage_definitions (
  key            text primary key,               -- e.g. 'show', 'decision', 'cash'
  label          text not null,
  position       int not null,
  enter_on       text[] not null,                -- canonical event types that move a cycle into this stage
  target_hours   numeric,                        -- DEFERRED
  critical_hours numeric,                        -- DEFERRED
  color          text,
  active         boolean not null default true,
  is_proposal    boolean not null default true,
  updated_at     timestamptz not null default now()
);

create table crm_reason_codes (
  code            text primary key,
  kind            reason_kind not null,
  label           text not null,
  nurture_default nurture_choice not null default 'none',
  automatic       boolean not null default false,  -- set by a rule, not chosen by a sales
  position        int not null default 0,
  active          boolean not null default true,
  is_proposal     boolean not null default true
);

create table crm_rules (
  key          text primary key,
  kind         text not null check (kind in ('auto_close', 'auto_flag', 'next_move', 'nurture', 'warming')),
  enabled      boolean not null default true,
  params       jsonb not null default '{}'::jsonb,   -- thresholds, recipients, severity: DEFERRED
  description  text,
  is_proposal  boolean not null default true,
  updated_at   timestamptz not null default now()
);

create table crm_settings (
  key         text primary key,
  value       jsonb not null,
  is_proposal boolean not null default true,
  updated_at  timestamptz not null default now()
);

-- ───────────────────────── cycles and calls ─────────────────────────
create table crm_cycles (
  id                 uuid primary key default gen_random_uuid(),
  person_id          uuid not null references crm_people(id),
  owner_id           uuid references crm_members(id),
  status             cycle_status not null default 'active',
  origin             cycle_origin not null default 'new',
  previous_cycle_id  uuid references crm_cycles(id),
  opened_at          timestamptz not null,           -- occurred_at of the booking that opened it
  closed_at          timestamptz,
  close_reason       text references crm_reason_codes(code),
  -- derived by the projector (never written by the front end)
  current_stage      text references crm_stage_definitions(key),
  stage_entered_at   timestamptz,
  calls_held         int not null default 0,
  no_shows           int not null default 0,
  sales_attempts     int not null default 0,
  last_prospect_at   timestamptz,
  last_sales_at      timestamptz,
  last_event_at      timestamptz,
  next_move          jsonb,                          -- {who, code, label, due_at} from the rules engine
  projected_at       timestamptz,
  created_at         timestamptz not null default now()
);
create index cycles_person on crm_cycles(person_id);
create index cycles_owner_status on crm_cycles(owner_id, status);
create unique index cycles_one_active_per_person on crm_cycles(person_id) where status = 'active';

create table crm_calls (
  id                 uuid primary key default gen_random_uuid(),
  cycle_id           uuid not null references crm_cycles(id) on delete cascade,
  rank               int not null,                   -- 1 = R1, 2 = R2 ...
  iclosed_call_id    text unique,
  scheduled_start    timestamptz,
  scheduled_end      timestamptz,
  status             call_status not null default 'scheduled',
  host_id            uuid references crm_members(id),
  fathom_recording_id bigint unique,
  recording_start    timestamptz,
  recording_end      timestamptz,
  recording_url      text,
  share_url          text,
  summary_md         text,
  transcript         jsonb,                          -- [{speaker, email, text, timestamp}]
  created_at         timestamptz not null default now(),
  unique (cycle_id, rank)
);
create index calls_schedule on crm_calls(scheduled_start);

create table crm_call_outcomes (
  id               uuid primary key default gen_random_uuid(),
  call_id          uuid not null references crm_calls(id) on delete cascade,
  attendance       attendance not null,
  decision         decision,                         -- null when no_show
  reason_code      text references crm_reason_codes(code),
  nurture          nurture_choice not null default 'none',
  return_date      date,
  next_step        text,
  amount_sold      numeric(12,2),
  currency         text,
  product          text,
  payment_plan     text,
  note             text,
  extra            jsonb not null default '{}'::jsonb,   -- DEFERRED extra fields
  declared_by      uuid not null references crm_members(id),
  declared_at      timestamptz not null default now(),
  superseded_at    timestamptz,                      -- corrections keep history; current = superseded_at is null
  check (attendance = 'held' or decision is null),
  check (decision not in ('no', 'disqualified') or reason_code is not null)
);
create unique index call_outcomes_current on crm_call_outcomes(call_id) where superseded_at is null;

-- ───────────────────────── events (the journal) ─────────────────────────
create table crm_events (
  id            bigint generated always as identity primary key,
  person_id     uuid references crm_people(id),
  cycle_id      uuid references crm_cycles(id),
  call_id       uuid references crm_calls(id),
  occurred_at   timestamptz not null,
  received_at   timestamptz not null default now(),
  actor         actor_kind not null,
  member_id     uuid references crm_members(id),
  channel       text not null,     -- booking, video, imessage, sms, phone, payment, crm, analysis
  type          text not null,     -- canonical type, see 04-event-pipeline.md
  content       text,
  data          jsonb not null default '{}'::jsonb,
  source        event_source not null,
  source_id     text not null,
  inbox_id      bigint,
  unique (source, source_id)
);
create index events_cycle_time on crm_events(cycle_id, occurred_at);
create index events_person_time on crm_events(person_id, occurred_at);
create index events_type on crm_events(type);

-- ───────────────────────── money ─────────────────────────
create table crm_deals (
  id            uuid primary key default gen_random_uuid(),
  cycle_id      uuid not null unique references crm_cycles(id) on delete cascade,
  product       text,
  amount_sold   numeric(12,2),
  currency      text,
  payment_plan  text,
  yes_at        timestamptz,
  whop_checkout_id   text unique,
  whop_purchase_url  text,
  created_at    timestamptz not null default now()
);

create table crm_payments (
  id               uuid primary key default gen_random_uuid(),
  deal_id          uuid references crm_deals(id),
  cycle_id         uuid references crm_cycles(id),
  whop_payment_id  text not null unique,
  amount           numeric(12,2),
  currency         text,
  status           text not null,          -- as reported by Whop
  paid_at          timestamptz,
  refunded_amount  numeric(12,2) not null default 0,
  data             jsonb not null default '{}'::jsonb,
  updated_at       timestamptz not null default now()
);
create index payments_cycle on crm_payments(cycle_id);

-- ───────────────────────── nurture ─────────────────────────
create table crm_nurture_tracks (
  id                    uuid primary key default gen_random_uuid(),
  person_id             uuid not null references crm_people(id),
  origin_cycle_id       uuid not null references crm_cycles(id),
  reason_code           text references crm_reason_codes(code),
  intensity             nurture_choice not null check (intensity in ('standard', 'light')),
  owner_id              uuid references crm_members(id),
  entered_at            timestamptz not null,
  return_date           date,
  status                nurture_status not null default 'active',
  last_signal_at        timestamptz,
  next_message_at       timestamptz,
  ended_at              timestamptz,
  reactivated_cycle_id  uuid references crm_cycles(id)
);
create unique index nurture_one_active on crm_nurture_tracks(person_id) where status = 'active';

-- ───────────────────────── outbound messages (sent by the CRM) ─────────────────────────
create table crm_outbound_messages (
  id                 uuid primary key default gen_random_uuid(),
  person_id          uuid not null references crm_people(id),
  cycle_id           uuid references crm_cycles(id),
  nurture_id         uuid references crm_nurture_tracks(id),
  from_member_id     uuid references crm_members(id),
  purpose            text not null,         -- e.g. 'nurture', 'no_show_followup', 'warming' (DEFERRED catalogue)
  agent_key          text,                  -- Agent System agent that proposed it (e.g. 'lead_follow_ups')
  approved_by        uuid references crm_members(id),
  approved_at        timestamptz,
  content            text not null,
  to_number          text not null,
  from_number        text,
  status             outbound_status not null default 'queued',
  sendblue_message_handle text unique,
  error              text,
  requested_at       timestamptz not null default now(),
  sent_at            timestamptz
);

-- ───────────────────────── derived / operational ─────────────────────────
create table crm_stage_history (
  id          bigint generated always as identity primary key,
  cycle_id    uuid not null references crm_cycles(id) on delete cascade,
  stage       text not null references crm_stage_definitions(key),
  entered_at  timestamptz not null,
  exited_at   timestamptz,
  hours       numeric generated always as (extract(epoch from (coalesce(exited_at, entered_at) - entered_at)) / 3600) stored
);
create index stage_history_cycle on crm_stage_history(cycle_id);

-- Alert INSTANCES computed by the server for CRM rules c1..c18. Their definition (on/off,
-- threshold, severity, recipients, channels) is read from the docs row config/alerts, the same
-- place Settings › Alerts writes. store.js merges open rows into the app's alert list, so they appear
-- in My Day › Needs you with the existing life (Take it, Reassign, Snooze, Make it a decision,
-- Handled), escalation to the owner's lead after the escalation delay, quiet hours and daily digest.
-- The life state stays in the existing inbox collection, keyed by 'crm:' || id.
create table crm_alerts (
  id            uuid primary key default gen_random_uuid(),
  rule_id       text not null,              -- 'c1' .. 'c18'
  cycle_id      uuid references crm_cycles(id) on delete cascade,
  person_id     uuid references crm_people(id),
  severity      alert_severity not null,
  owner_key     text not null,              -- LNP member id the alert is about / assigned to
  owner_id      uuid references crm_members(id),
  title         text not null,
  detail        text,
  link          text,                       -- deep link into the CRM (lead record, inbox...)
  dedupe_key    text not null,              -- one open alert per key
  opened_at     timestamptz not null default now(),
  resolved_at   timestamptz,                -- the data behind it was fixed: it leaves for good
  resolution    text
);
create unique index alerts_open_dedupe on crm_alerts(dedupe_key) where resolved_at is null;
create index alerts_owner_open on crm_alerts(owner_key) where resolved_at is null;

create table if not exists crm_webhook_log (   -- created in phase 0 by 003a: kept as is
  id             bigint generated always as identity primary key,
  source         event_source not null,
  delivery_id    text,                       -- provider delivery id when available
  received_at    timestamptz not null default now(),
  headers        jsonb not null,
  body           text not null,              -- raw body, exactly as received (needed for signatures)
  auth_ok        boolean,                    -- cheap check at ingestion (token or signature)
  status         inbox_status not null default 'received',
  attempts       int not null default 0,
  error          text,
  processed_at   timestamptz
);
create unique index if not exists webhook_log_delivery on crm_webhook_log(source, delivery_id) where delivery_id is not null;
create index if not exists webhook_log_status on crm_webhook_log(status, received_at);

create table crm_unmatched_inbox (
  id                 uuid primary key default gen_random_uuid(),
  inbox_id           bigint not null references crm_webhook_log(id),
  source             event_source not null,
  reason             text not null,
  summary            text,                    -- human readable (name, email, phone, amount...)
  candidate_person_ids uuid[],
  created_at         timestamptz not null default now(),
  resolved_person_id uuid references crm_people(id),
  resolved_cycle_id  uuid references crm_cycles(id),
  resolved_by        uuid references crm_members(id),
  resolved_at        timestamptz,
  dismissed          boolean not null default false
);

create table crm_reconciliation_runs (
  id           bigint generated always as identity primary key,
  run_for_date date not null,
  source       event_source not null,
  expected     int,
  found        int,
  discrepancies jsonb not null default '[]'::jsonb,
  ok           boolean not null,
  created_at   timestamptz not null default now()
);

-- Runs of the CRM agents (Post-call analyst, Lead follow-ups), to feed Agent System › Log and
-- Decisions (agents propose, humans decide).
create table crm_agent_runs (
  id           uuid primary key default gen_random_uuid(),
  agent_key    text not null,               -- 'post_call_analyst' | 'lead_follow_ups' | ...
  trigger      text not null,               -- e.g. 'call_recorded', 'nurture_tick'
  cycle_id     uuid references crm_cycles(id) on delete set null,
  call_id      uuid references crm_calls(id) on delete set null,
  status       text not null check (status in ('running', 'ok', 'escalated', 'error')),
  output_ref   text,                        -- e.g. 'call_analyses:<id>', 'outbound_messages:<id>'
  started_at   timestamptz not null default now(),
  finished_at  timestamptz,
  duration_ms  int,
  input_tokens int,
  output_tokens int,
  cost_usd     numeric(10,4),
  error        text
);
create index agent_runs_agent_time on crm_agent_runs(agent_key, started_at desc);

create table crm_call_analyses (
  id             uuid primary key default gen_random_uuid(),
  call_id        uuid not null references crm_calls(id) on delete cascade,
  method_version text not null,
  model          text not null,
  status         analysis_status not null default 'queued',
  result         jsonb,
  input_tokens   int,
  output_tokens  int,
  created_at     timestamptz not null default now(),
  completed_at   timestamptz,
  reviewed_by    uuid references crm_members(id),
  review_score   int,
  review_note    text
);

create table crm_audit_log (
  id         bigint generated always as identity primary key,
  actor_id   uuid references crm_members(id),
  action     text not null,
  entity     text not null,
  entity_id  text not null,
  before     jsonb,
  after      jsonb,
  at         timestamptz not null default now()
);

-- ───────────────────────── row-level security ─────────────────────────
create or replace function crm_role() returns member_role
language sql stable security definer set search_path = public as $$
  select role from crm_members where id = auth.uid() and active
$$;

create or replace function crm_sees_all() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(crm_role() in ('admin', 'sales_lead', 'viewer'), false)
$$;

create or replace function crm_owns_cycle(c uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from crm_cycles where id = c and owner_id = auth.uid())
$$;

create or replace function crm_sees_person(p uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select crm_sees_all() or exists (select 1 from crm_cycles where person_id = p and owner_id = auth.uid())
$$;

alter table crm_members       enable row level security;
alter table crm_people             enable row level security;
alter table crm_person_identities  enable row level security;
alter table crm_stage_definitions  enable row level security;
alter table crm_reason_codes       enable row level security;
alter table crm_rules              enable row level security;
alter table crm_settings           enable row level security;
alter table crm_cycles             enable row level security;
alter table crm_calls              enable row level security;
alter table crm_call_outcomes      enable row level security;
alter table crm_events             enable row level security;
alter table crm_deals              enable row level security;
alter table crm_payments           enable row level security;
alter table crm_nurture_tracks     enable row level security;
alter table crm_outbound_messages  enable row level security;
alter table crm_stage_history      enable row level security;
alter table crm_alerts             enable row level security;
alter table crm_webhook_log        enable row level security;   -- no policy: service role only
alter table crm_unmatched_inbox    enable row level security;
alter table crm_reconciliation_runs enable row level security;
alter table crm_call_analyses      enable row level security;
alter table crm_audit_log          enable row level security;
alter table crm_agent_runs         enable row level security;

-- read policies (writes go through security-definer RPCs, see 11-crm-frontend.md)
create policy read_team    on crm_members      for select using (auth.uid() is not null);
create policy read_config1 on crm_stage_definitions for select using (auth.uid() is not null);
create policy read_config2 on crm_reason_codes      for select using (auth.uid() is not null);
create policy read_config3 on crm_rules             for select using (crm_sees_all());
create policy read_config4 on crm_settings          for select using (auth.uid() is not null);
create policy read_people  on crm_people            for select using (crm_sees_person(id));
create policy read_ident   on crm_person_identities for select using (crm_sees_person(person_id));
create policy read_cycles  on crm_cycles            for select using (crm_sees_all() or owner_id = auth.uid());
create policy read_calls   on crm_calls             for select using (crm_sees_all() or crm_owns_cycle(cycle_id));
create policy read_outc    on crm_call_outcomes     for select using (crm_sees_all() or crm_owns_cycle((select cycle_id from crm_calls where crm_calls.id = call_id)));
create policy read_events  on crm_events            for select using (crm_sees_all() or crm_owns_cycle(cycle_id) or (cycle_id is null and crm_sees_person(person_id)));
create policy read_deals   on crm_deals             for select using (crm_sees_all() or crm_owns_cycle(cycle_id));
create policy read_pay     on crm_payments          for select using (crm_sees_all() or crm_owns_cycle(cycle_id));
create policy read_nurt    on crm_nurture_tracks    for select using (crm_sees_all() or owner_id = auth.uid());
create policy read_out     on crm_outbound_messages for select using (crm_sees_all() or crm_sees_person(person_id));
create policy read_stage   on crm_stage_history     for select using (crm_sees_all() or crm_owns_cycle(cycle_id));
create policy read_alerts  on crm_alerts            for select using (crm_sees_all() or owner_id = auth.uid());
create policy read_unm     on crm_unmatched_inbox   for select using (crm_sees_all());
create policy read_recon   on crm_reconciliation_runs for select using (crm_sees_all());
create policy read_anal    on crm_call_analyses     for select using (crm_sees_all() or crm_owns_cycle((select cycle_id from crm_calls where crm_calls.id = call_id)));
create policy read_audit   on crm_audit_log         for select using (crm_role() = 'admin');
create policy read_runs    on crm_agent_runs        for select using (crm_sees_all());

-- ───────────────────────── seed: proposals for DEFERRED configuration ─────────────────────────
insert into crm_stage_definitions (key, label, position, enter_on, target_hours, critical_hours, color) values
  ('show',     'Présence', 1, array['call_booked'],                 96, 168, '#2A9D8F'),
  ('decision', 'Décision', 2, array['outcome_held'],                72, 144, '#8B67C9'),
  ('cash',     'Encaissement', 3, array['outcome_yes'],                 24,  48, '#4F9A5B');

insert into crm_reason_codes (code, kind, label, nurture_default, automatic, position) values
  ('timing',          'lost', 'Pas le bon moment',       'standard', false, 1),
  ('partner',         'lost', 'Conjoint ou associé',    'standard', false, 2),
  ('price',           'lost', 'Prix',                   'standard', false, 3),
  ('trust',           'lost', 'Manque de confiance',    'standard', false, 4),
  ('competitor',      'lost', 'Concurrent',             'none',     false, 5),
  ('unreachable',     'lost', 'Injoignable',            'light',    true,  6),
  ('unpaid',          'lost', 'Paiement non effectué',  'none',     true,  7),
  ('dq_off_target',   'disqualified', 'Hors cible',        'none', false, 1),
  ('dq_budget',       'disqualified', 'Budget impossible', 'none', false, 2),
  ('dq_not_decider',  'disqualified', 'Pas décisionnaire', 'none', false, 3),
  ('dq_fake',         'disqualified', 'Faux contact ou spam', 'none', false, 4),
  ('dq_customer',     'disqualified', 'Déjà client', 'none', false, 5),
  ('dq_out_of_offer', 'disqualified', 'Demande hors offre', 'none', false, 6);

insert into crm_rules (key, kind, params, description, is_proposal) values
  ('auto_lost_unreachable', 'auto_close', '{"silence_days":30,"min_attempts":4,"min_distinct_days":3,"notice_hours":24,"reason":"unreachable","snooze_days":7}', 'Décidé : 30 jours sans réponse et au moins 4 tentatives. Définition d''une tentative à préciser.', false),
  ('unpaid_yes',            'auto_close', '{"close_days":14,"reason":"unpaid","snooze_days":7}', 'Proposition (l''alerte à 48 h est la règle c7)', true),
  ('not_recorded',          'auto_flag',  '{"after_hours":6}', 'Appel honoré sans enregistrement Fathom', true),
  ('next_move',             'next_move',  '{"reply_hours":2,"follow_up_hours":48,"reopen_days":30}', 'Qui doit agir : formulation et logique à préciser', true),
  ('nurture_cadence',       'nurture',    '{"standard_days":[14,21],"light_days":30,"archive_after_days":182}', 'Archivage après 6 mois décidé ; cadence proposée', true),
  ('warming_steps',         'warming',    '{"steps":["D-3","D-1","D0"]}', 'Étapes de préparation du CRM actuel, par appel prévu', true);

-- Default definitions of the CRM alert rules. On first deploy, merge them into the docs row
-- config/alerts (without overwriting existing a1..a18) so Settings › Alerts lists and edits them.
-- Severity scale and recipients follow Settings › Alerts: owner, department lead, Romain.
insert into crm_settings (key, value) values ('alert_rule_defaults', '[
  {"id":"c1","name":"Issue de l''appel manquante","severity":"high","threshold":{"after_minutes":0},"to":["owner"]},
  {"id":"c2","name":"Prospect en attente de réponse","severity":"high","threshold":{"hours":2},"to":["owner"]},
  {"id":"c3","name":"Relance à faire","severity":"medium","threshold":{"silence_hours":48},"to":["owner"]},
  {"id":"c4","name":"Appel à replanifier","severity":"medium","threshold":{"hours":2},"to":["owner"]},
  {"id":"c5","name":"Étape au-delà de l''objectif","severity":"medium","threshold":{"use":"stage target_hours"},"to":["owner"]},
  {"id":"c6","name":"Étape critique","severity":"critical","threshold":{"use":"stage critical_hours"},"to":["owner","lead"]},
  {"id":"c7","name":"Oui sans paiement","severity":"critical","threshold":{"hours":48},"to":["owner","romain"]},
  {"id":"c8","name":"Paiement bloqué","severity":"critical","threshold":{},"to":["owner","romain"]},
  {"id":"c9","name":"Remboursement ou litige","severity":"critical","threshold":{},"to":["romain","lead"]},
  {"id":"c10","name":"Paiement sans oui déclaré","severity":"medium","threshold":{},"to":["lead"]},
  {"id":"c11","name":"Enregistrement et issue en désaccord","severity":"medium","threshold":{},"to":["owner","lead"]},
  {"id":"c12","name":"Message non distribué","severity":"high","threshold":{},"to":["owner"]},
  {"id":"c13","name":"Prospect abandonné","severity":"high","threshold":{"silence_days":30,"attempts_below":4},"to":["owner","lead"]},
  {"id":"c14","name":"Perte automatique demain","severity":"medium","threshold":{"notice_hours":24},"to":["owner"]},
  {"id":"c15","name":"Retour de maturation à faire","severity":"medium","threshold":{},"to":["owner"]},
  {"id":"c16","name":"Éléments non rattachés en attente","severity":"low","threshold":{"after_hours":2},"to":["lead"]},
  {"id":"c17","name":"Une source ne répond plus","severity":"critical","threshold":{"iclosed_hours":6,"sendblue_hours":6,"fathom_missed_calls":2},"to":["romain"]},
  {"id":"c18","name":"Écart de rapprochement","severity":"critical","threshold":{},"to":["romain"]}
]');

insert into crm_settings (key, value) values
  ('team_email_domains', '["lesnouveauxprofs.fr"]'),             -- VERIFY: domains used to tell internal from external invitees
  ('default_owner', '"sales"'),                        -- LNP member id used when the iClosed host is unknown (Valentino)
  ('whop_plans', '{}'),                                -- product name -> Whop plan id (fill in phase 0)
  ('analysis_model', '"claude-sonnet-5-5"'),
  ('nurture_sending_enabled', 'false'),                -- stays false until legal sign-off (Q6)
  ('nurture_templates', '[]');                         -- DEFERRED

-- ───────────────────────── privileges ─────────────────────────
-- Supabase grants every new public table to anon and authenticated by default. Here the browser only reads (RLS
-- decides which rows) and writes through the RPCs of 004_crm_rpc.sql; anonymous visitors get nothing, and the raw
-- webhook log stays service-role only.
do $$ declare t text; begin
  for t in select tablename from pg_tables where schemaname = 'public' and tablename like 'crm\_%' loop
    execute format('revoke all on public.%I from anon, authenticated', t);
    if t <> 'crm_webhook_log' then execute format('grant select on public.%I to authenticated', t); end if;
  end loop;
end $$;
revoke execute on function crm_role(), crm_sees_all(), crm_owns_cycle(uuid), crm_sees_person(uuid) from public, anon;
grant execute on function crm_role(), crm_sees_all(), crm_owns_cycle(uuid), crm_sees_person(uuid) to authenticated;
