# 02 — Data model

The SQL is in `web/supabase/003_crm_core.sql`. This file explains it.

## 1. Core ideas

- **Person ≠ cycle.** `crm_people` is a prospect. `crm_cycles` is one sales attempt with that person, opened
  by a booking and closed as `won`, `lost` or `disqualified`. A person has at most one `active`
  cycle (partial unique index).
- **Events are the truth.** `crm_events` is an append-only journal. Every table marked "derived" can be
  rebuilt from `crm_events` + `crm_call_outcomes` + `crm_payments` by the projector.
- **Configuration is data.** `crm_stage_definitions`, `crm_reason_codes`, `crm_rules`, `crm_settings` hold every
  business rule Romain has deferred; CRM alert rules c1–c18 live with a1–a18 in the `docs` row
  `config/alerts`. Seed rows are proposals (`is_proposal = true`).
- **A deliberate exception.** LNP stores every collection as JSON in `docs`. The CRM does not:
  it needs database-enforced uniqueness of source ids, real per-sales isolation (any member can read
  any `docs` row) and large volumes. All CRM objects are relational and prefixed `crm_`. Existing
  tables (`docs`, `members`) are not modified.

## 2. Tables

| Table | Kind | Purpose |
|---|---|---|
| `crm_members` | master | CRM profile of a signed-in account: `member_key` (LNP member id: `sales`, `romain`…), CRM role (sales, sales_lead, admin, viewer), `lead_id` (escalation: Valentino → Romain → Amin), iClosed / Fathom emails, Sendblue line. App roles stay in `members`. |
| `crm_people` | master | Prospect; `opted_out_at` blocks all automated messages forever |
| `crm_person_identities` | master | Every normalised identifier pointing to a person; unique `(kind, value)` |
| `crm_cycles` | master + derived columns | Status, origin, owner (master); stage, counters, `next_move` (derived) |
| `crm_calls` | master | One row per booked call; iClosed ids, schedule, Fathom recording fields |
| `crm_call_outcomes` | master (human) | The outcome form. Corrections insert a new row and set `superseded_at` on the old one |
| `crm_events` | journal | Canonical events, unique `(source, source_id)` |
| `crm_deals` | master | Amount sold, Whop checkout for this cycle |
| `crm_payments` | master | Whop payments, upserted by `whop_payment_id` |
| `crm_nurture_tracks` | master | A stay in nurture; one `active` per person |
| `crm_outbound_messages` | master | Every message the CRM asks Sendblue to send; used to tag outbound webhooks as `auto` |
| `crm_stage_history` | derived | Entry/exit per stage, hours |
| `crm_alerts` | derived | Instances of CRM alerts c1–c18, one open row per `dedupe_key`; shown and managed by the existing alert engine (life state in `inbox`, key `crm:<id>`) |
| `crm_stage_definitions`, `crm_reason_codes`, `crm_rules`, `crm_settings` | config | DEFERRED business rules |
| `crm_webhook_log` | operational | Raw requests, processing status, retries |
| `crm_unmatched_inbox` | operational | Items the matcher could not attach, resolved by a human |
| `crm_reconciliation_runs` | operational | Nightly comparison results |
| `crm_call_analyses` | derived (AI) | Claude output per call, with review fields |
| `crm_agent_runs` | operational | Runs of CRM agents (Post-call analyst, Lead follow-ups) for Agent System › Log |
| `crm_audit_log` | operational | Every human write (outcome, match, merge, override, config change) |

## 3. Canonical event types

`crm_events.type` uses this closed vocabulary (add new types only through a migration and this doc):

| Type | Actor | Source | Notes |
|---|---|---|---|
| `call_booked` | prospect or sales | iclosed | Opens a cycle or adds a call |
| `call_rescheduled` | prospect or sales | iclosed | |
| `call_canceled` | prospect or sales | iclosed | |
| `call_recorded` | sales | fathom | Evidence only |
| `outcome_held` / `outcome_no_show` | sales | crm | From `crm_call_outcomes.attendance` |
| `outcome_yes` / `outcome_no` / `outcome_follow_up` / `outcome_disqualified` | sales | crm | From `crm_call_outcomes.decision` |
| `message_in` | prospect | sendblue | iMessage or SMS |
| `message_out` | sales or auto | sendblue | `auto` when matched to `crm_outbound_messages` |
| `message_status` | system | sendblue | Delivered / failed updates (not a touch) |
| `phone_call_out` / `phone_call_in` | sales / prospect | sendblue | |
| `checkout_created` | system | crm | Whop link created for the deal |
| `payment_succeeded` / `payment_failed` / `payment_pending` / `payment_requires_action` | prospect | whop | |
| `refund` / `dispute` | prospect | whop | |
| `membership_activated` | prospect | whop | Hand-over to delivery |
| `cycle_won` / `cycle_lost` / `cycle_disqualified` / `cycle_reopened` | system | rules or crm | Written by the projector when status changes |
| `auto_close_notice` | system | rules | Warning before an automatic close |
| `nurture_entered` / `nurture_message` / `nurture_reactivated` / `nurture_archived` / `opt_out` | auto or system | rules / sendblue | |
| `analysis_ready` | auto | claude | |
| `note` | sales | crm | |

`channel` values: `booking`, `video`, `imessage`, `sms`, `phone`, `payment`, `crm`, `analysis`.

## 4. Derived columns on `crm_cycles`

Written **only** by the projector (`projector.ts` / `recompute_cycle`):

`current_stage`, `stage_entered_at`, `calls_held`, `no_shows`, `sales_attempts`,
`last_prospect_at`, `last_sales_at`, `last_event_at`, `next_move`, `projected_at`, and `status`
transitions caused by events (won by payment, lost/disqualified by outcome). Automatic closes
from rules are written by the rules engine as events (`cycle_lost` with `data.reason`) and then
applied by the projector, so the journal always explains the status.

## 5. Writes from the front end

The front end never writes tables directly. It calls security-definer RPC functions that check
the caller's role and ownership, write an `crm_audit_log` row, insert the matching event, and call the
projector:

| RPC | Who | Effect |
|---|---|---|
| `crm_declare_outcome(call_id, payload)` | owner, sales_lead, admin | Inserts `crm_call_outcomes` (superseding the current one), events, projector |
| `crm_add_note(cycle_id, text)` | owner, sales_lead, admin | `note` event |
| `crm_resolve_unmatched(item_id, person_id, cycle_id)` | sales_lead, admin | Attaches, reprocesses the inbox row |
| `crm_merge_people(keep_id, merge_id)` | sales_lead, admin | Moves identities, cycles, events |
| `crm_cancel_auto_close(cycle_id)` | owner, sales_lead, admin | Suppresses a pending automatic close (audit) |
| `crm_set_nurture(person_id, payload)` | owner, sales_lead, admin | Enter / leave / change return date |
| `crm_reassign_cycle(cycle_id, member_id)` | sales_lead, admin | Owner change |
| `crm_update_config(table, key, value)` | admin, sales_lead | Stages, reasons, rules, settings (audit) |
| `crm_create_checkout(cycle_id)` | owner, sales_lead, admin | Calls `whop-checkout`, returns the purchase URL |
