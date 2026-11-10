# 00 — Decisions

## Already in place (from the functional specification, 24 Oct 2026)

| Item | State |
|---|---|
| Hosting | Web edition live at https://lnp-sales.vercel.app, deployed from `main` of LNP-Business/LNP |
| Database / auth | Supabase project `LNP`: table `docs (col, id, body)` for every collection, table `members` (roles Admin / Member / Viewer), sign-in by invite link + password, `/api/config`, `/api/me`, `/api/team`, `/api/files` on Vercel |
| Clock | Real OS clock (`window.LNP_TODAY` pins it for tests) |
| Alerts | Engine in `store.js`, rules a1–a18 in `config/alerts`, Settings › Alerts (threshold, severity Low/Medium/High/Critical, recipients, channels, quiet hours, daily digest, 24 h escalation), life in `inbox` (Take it, Reassign, Snooze, Make it a decision, Handled), shown in My Day › Needs you |
| Team | amin (CEO), romain (CPO), marketing (Michael), contenu (Ilya), sales (Valentino). Leads: Romain → Amin; everyone else → Romain |
| CRM | CRM LNP embedded (`crm_doc.html`), Pipeline / Leads, warming steps (D-3, D-1, day of), EN/FR switch, data in `localStorage` only |
| Agent System | Sample data; agents include Post-call analyst and Lead follow-ups (Sales) |
| Access | Settings › Access hides screens per person; it does not isolate data |

## Taken (Romain, 24 October 2026)

| # | Decision |
|---|---|
| D1 | Scope: from **call booked** to **won**, **lost** or **disqualified**. Before the booking is out of scope. |
| D2 | The LNP CRM is the single source of truth. **Everything happens in the CRM.** iClosed is only a calendar. |
| D3 | **Won = first successful Whop payment** of the cycle's deal. |
| D4 | **Lost** and **Disqualified** are distinct, each with a closed list of reasons. |
| D5 | Automatic loss after **30 days without a prospect reply and at least 4 contact attempts** (attempt definition DEFERRED). |
| D6 | **Nurture** track for people who say no today; archived after **6 months without signal**. |
| D7 | **Calendar hours**. |
| D8 | No WhatsApp: prospects use iMessage (Sendblue covers iMessage and SMS). |
| D9 | A person can have several cycles (person ≠ cycle). |
| D10 | **Sales lead = Romain**: CRM escalations for Valentino go to Romain; Romain's go to Amin (existing lead rule). |
| D11 | CRM data lives in dedicated relational tables prefixed `crm_` — a deliberate exception to the "everything in `docs`" convention (idempotency, real per-sales isolation, volume). |
| D12 | CRM alerts are **new rules c1–c18 of the existing alert engine**, not a second alert system. |
| D13 | **One place**: the CRM uses the existing Supabase project `LNP` and the existing repository LNP-Business/LNP. No separate dev project. Tests use test people only (Romain, a teammate) and the providers' own test modes (Whop sandbox); test rows are removed before go-live. Functions deploy from `main` only. (Romain, 24 October 2026) |

## Deferred (configuration, decided later)

| # | Item | Where |
|---|---|---|
| F1 | Stages, their meaning, target and critical hours | `crm_stage_definitions` |
| F2 | CRM alert rules: on/off, thresholds, severity, recipients, channels | `docs` row `config/alerts`, rules c1–c18 (defaults in `crm_settings.alert_rule_defaults`) |
| F3 | Attempt definition, unpaid-yes close, not-recorded flag | `crm_rules` |
| F4 | "Who must act" logic and wording | `crm_rules.next_move` |
| F5 | Quiet hours, digest, escalation delay | existing `config/alerts` delivery rules (unchanged) |
| F6 | Loss and disqualification reasons, nurture defaults | `crm_reason_codes` |
| F7 | Nurture cadence, content, owner on return; warming steps | `crm_rules` (`nurture_cadence`, `warming_steps`), `crm_settings.nurture_templates` |
| F8 | Extra outcome-form fields | `crm_call_outcomes.extra` |
| F9 | Call analysis grid | `09-call-analysis.md`, versioned prompt |
| F10 | Autonomy level of the CRM agents (approval before sending) | Agent System |

## Open questions

| # | Question | Blocks |
|---|---|---|
| Q1 | ~~Does iClosed offer native webhooks?~~ — answered (Romain, 24 Oct 2026): **yes**. No Zapier: iClosed posts to `iclosed-in?k=<token>` (header `x-lnp-token` also accepted). The mapper reads iClosed's own payload, captured in phase 0 | — |
| Q2 | Does each sales' Fathom plan include API and webhooks? | Phase 4 |
| Q3 | Are Whop checkout metadata included in `payment.*` webhook payloads? | Phase 5 |
| Q4 | How does Sendblue authenticate its webhooks? | Phase 7 |
| Q5 | Inventory of automations in iClosed, Sendblue and CRM LNP (warming steps) to rebuild | Phase 7 |
| Q6 | Legal sign-off: recording notice, nurture messages, retention period | Phases 4 and 8 |
| Q7 | **Vercel plan**: the Hobby plan is, as far as known, for personal non-commercial use. Check Vercel's terms for an internal company tool; upgrade if needed. | Before go-live |
| Q8 | ~~Columns of `members`~~ — answered: `user_id`, `email`, `role` (admin/member/viewer); `crm_members.id` references `members(user_id)` | — |
| Q9 | Region of the Supabase project `LNP`: **ap-southeast-2 (Sydney)**, not EU (read through the Supabase connector, 24 Oct 2026). Open (Romain, 24 Oct 2026): the origin of the leads (US, EU or both) is not settled; nothing changes for now. Decide before real automated messaging (phase 7) and before go-live, with the matching rules (GDPR for the EU; recording consent and TCPA in the US) | Before go-live |
| Q10 | Pending web settings from the functional spec §14 (Site URL, OTP expiry) — still to do by Romain in the Supabase dashboard of `LNP` (`setup.md` checklist) | Phase 1 |

## Phase 0 — findings (branch `crm-0-capture`)

### Q8 — the existing `members` table (`web/supabase/001_init.sql`)

| Column | Type | Notes |
|---|---|---|
| `user_id` | `uuid`, primary key | references `auth.users(id)` on delete cascade |
| `email` | `text not null` | not unique in the table (unique in `auth.users`) |
| `role` | `text not null`, default `member` | check in (`admin`, `member`, `viewer`) |
| `created_at` | `timestamptz not null` | default `now()` |

RLS on; members read the team (`members_read`), nobody writes from the browser (only `/api/team` with the service
role). `my_role()` (security definer) returns the caller's role. The LNP member id (`amin`, `romain`, `sales`…) is
**not** in this table: it lives in the app (team list in `app/store.js`, "You are" selector), so `crm_members.member_key` must be filled
by hand or by the phase 1 import. `crm_members.id` references `members(user_id)` (pack v1.2), and deleting an account
cascades from `auth.users` to `members`, then is blocked by `crm_members` (`on delete restrict`): deactivate CRM
members with `active = false` before removing an account.

### Q9, Q10

Q9: the project is in ap-southeast-2 (Sydney), see the table above. Q10 is unchanged since the functional
specification §14 (Site URL still the old domain, OTP expiry probably 1 h).

### Q5 — automation inventory

| Tool | Automation | What it does | State |
|---|---|---|---|
| CRM LNP (`crm_doc.html`) | Warming steps D-3, D-1, day of | **Manual**: the sales ticks each step on the lead card; nothing is sent automatically. Filter "No warming", card warning "No warming logged" when a call is today or tomorrow with no step ticked, "Day-of pending" when D-3 and D-1 are ticked on the day | Rebuild as Lead follow-ups proposals (phase 7) |
| CRM LNP | Next-action suggestions | Suggested next actions by status (new: call / book / follow up; scheduled: call, D-1 and day-of warming, prep, reschedule; no-show: re-engage, reschedule, call; held: follow up, proposal, next call, objection, alternative, nurture; won: track payment) | Feeds `crm_rules.next_move` (F4) |
| CRM LNP | Alert 2.2 "Missing warming" | Tomorrow's call with no warming logged | Candidate CRM rule (phase 6) |
| iClosed | to fill by Romain (`setup.md` checklist) | | |
| Sendblue | to fill by Romain (`setup.md` checklist) | | |

### Built in phase 0

- `supabase/` CLI workdir (functions only; `verify_jwt = false`: providers send no Supabase JWT).
- `web/supabase/003a_crm_webhook_log.sql`: the two enums and `crm_webhook_log`, same definition as `003`, re-runnable
  (folded into `003_crm_core.sql` in phase 1, whose three matching statements are idempotent).
- `iclosed-in`, `fathom-in`, `sendblue-in`, `whop-in` per 04 §1: POST only, 2 MB limit, raw text body stored,
  cheap check (iClosed `x-lnp-token`, Sendblue `?k=`, Fathom and Whop Standard Webhooks with a 5-minute window),
  rejected requests stored with `status = 'rejected'` and **no delivery id** (a forged request cannot block the
  genuine delivery as a duplicate) and answered 401, duplicate deliveries answered 200, storage failure 500 (the
  provider retries). Secret headers stored as `<redacted>`; the URL (Sendblue token) is never stored or logged.
- Tests: `deno test --allow-env supabase/tests` (Standard Webhooks specification example, token, handler).
- `.github/workflows/crm-functions.yml`: tests on every change; deploys to `LNP` from `main` only, when the GitHub
  secrets `SUPABASE_ACCESS_TOKEN` and `SUPABASE_PROJECT_REF` exist.
- `supabase/scripts/export_fixtures.py`: captured rows → anonymised `fixtures/<source>-<event>.json`.
- `setup.md`: what Romain configures (Supabase, GitHub, Zapier, Fathom, Sendblue, Whop sandbox).

### Still VERIFY (needs a captured request)

- Whop secret encoding: a `ws_…` secret is used as raw bytes (as Whop's SDK does); `whsec_…` is base64-decoded.
- Fathom signed content and secret format (06 §3): a mismatch shows as `auth_ok = false` with the body kept.
- iClosed fields offered by Zapier, notably the time of the action (`occurred_at`) and the contact id (05 §3).
- Sendblue webhook authentication (Q4) and the exact type names in its dashboard.

### Definition of done of phase 0 — state

Code done. Applied to `LNP` through the Supabase connector (24 Oct 2026): `003a` migration, the four functions
deployed (`verify_jwt = false`) and checked (a request without token is stored as `rejected` and answered 401).
**Pending Romain's setup** (`setup.md`): one real payload per event type in `fixtures/` and the
checklist answers (Q2, Q5 for iClosed and Sendblue, Q9, Q10).

## Phase 1 — findings (branch `crm-1-schema`)

### No browser data to move

The current CRM (`crm_doc.html`, CRM LNP) does **not** keep its leads in `localStorage`: they are built-in sample
leads (fictional sales reps) rebuilt at every load; only the language choice is stored. Nothing real was ever saved,
so the planned "Export my CRM data" and the admin import (11 §3) have nothing to move and are **dropped**. Since 24 Oct 2026 the screen
starts empty: `gen_crm.py` removes the fictional leads, their sample alerts and the fictional sales reps (Romain's request). Real history
comes from the iClosed history import (phase 2). The functional specification §9.3 and §14 are corrected.

### Built

- `003_crm_core.sql` folds `003a` (its three statements are idempotent) and ends with privileges: anonymous visitors
  get nothing, signed-in people only `select` (RLS decides the rows), `crm_webhook_log` stays service-role only.
- `004_crm_rpc.sql`: `crm_declare_outcome`, `crm_add_note`, `crm_reassign_cycle`, `crm_cancel_auto_close`,
  `crm_set_nurture`, `crm_resolve_unmatched`, `crm_dismiss_unmatched`, `crm_merge_people`, `crm_update_config`,
  `crm_create_checkout` (refuses until phase 5), `crm_admin_set_member`, `crm_merge_alert_defaults`. Each checks the
  CRM role (a sales only on cycles they own, a viewer never writes) and writes `crm_audit_log`. Not yet: the projector
  (phase 2), so an outcome does not change the cycle status yet.
- CRM alert rules in `config/alerts`: `alerts.cN = {on, sev, who: [owner, lead, romain], ch, crm: true}`,
  thresholds as `values["cN.<param>"]` (Settings › Alerts saves only `alerts`, `values` and three settings, and keeps
  every key it does not show). a1–a18 untouched; the "Sales (CRM)" group in the screen comes in phase 6.
- `app/crm/data.js` (`window.LNP_CRM`) and `claude.use("crm")` in `web/public/lnp-web.js`.
- Tests: `web/supabase/tests/run.sh` (RLS: Valentino sees only his cycle, Romain and Amin all, an account without CRM
  profile none, anonymous nothing; RPC role checks; audit; events; outcome history; alert merge), `app/crm/data.test.js`.

### Team mapping (who is who in the CRM)

`crm_members` links an existing LNP account to its LNP member id. Each person must have an account first (Settings › Team access, invitation) before being linked. Then, for each person, an admin runs (SQL editor or through Claude):

| Order | Call |
|---|---|
| 1 | `select crm_admin_set_member('<amin email>', 'amin', 'Amin', 'admin');` |
| 2 | `select crm_admin_set_member('<romain email>', 'romain', 'Romain', 'sales_lead', 'amin');` |
| 3 | `select crm_admin_set_member('<valentino email>', 'sales', 'Valentino', 'sales', 'romain');` |

Emails are not written in the repository. `crm_settings.team_email_domains` (internal vs external Fathom invitees) is
`["lesnouveauxprofs.fr"]`.

### Applying phase 1 to `LNP` (after Romain approves the PR)

**Done on 24 Oct 2026.** `003` applied through the connector, `004` run by Romain in the SQL editor, then
`crm_merge_alert_defaults()` (18 rules added). The production schema was compared with the tested one (columns,
constraints, indexes, policies, functions, enums, seeds, grants): identical. Team mapping waits for Valentino's and
Amin's accounts.

Through the Supabase connector: `003_crm_core.sql` (as a migration), `004_crm_rpc.sql`, then
`select crm_merge_alert_defaults();` (creates `config/alerts` with c1–c18: production has no such row yet, so the
a-rules keep their defaults). Then the team mapping above. Existing `docs` and `members` rows are not modified.

## Phase 2 — findings (branch `crm-2-iclosed`)

### Built (back end)

- `005_crm_pipeline.sql`
  - `crm_apply_items(inbox_id, items)`: one transaction per raw row: match the person (iClosed contact id, phone,
    email; several people → unmatched inbox with the candidates), open or reopen the cycle (03 §4: lost less than
    `reopen_days` ago → reopened, active nurture → new cycle with origin nurture), owner = member whose `iclosed_email`
    or `email` is the call host, else `crm_settings.default_owner`; calls ranked R1, R2…; a booking for a known call id
    is a reschedule; an older event never overwrites a newer one; a reschedule without an end keeps the call's length;
    a cancellation of an unknown call → unmatched; events inserted once per `(source, source_id)`.
  - `crm_recompute_cycle` (the projector): stage history from `crm_stage_definitions.enter_on`, counters, status (won at
    the first succeeded payment, lost / disqualified from the current outcome or a rules `cycle_lost`, active again after
    `cycle_reopened`), status events written once, `next_move` (declare outcome → next call → rebook → follow up).
    `crm_declare_outcome` now calls it. `crm_recompute_all()` for admins.
  - `crm_inbox_pending` / `crm_inbox_mark`: the queue with back-off 1, 2, 4… minutes and 8 attempts.
- `006_crm_cron.sql`: pg_cron + pg_net call `process-inbox` every minute while iClosed rows wait
  (`crm_settings.functions_url`).
- Edge Function `process-inbox` (`_shared/worker.ts`), `_shared/normalize.ts` (libphonenumber-js 1.13.14, no country
  code → not guessed), `_shared/mappers/iclosed.ts`.

### iClosed payload: VERIFY on the first real request

No iClosed request had arrived when phase 2 was written, and iClosed's webhook format is not public. The mapper reads
our Zap contract and iClosed's native webhooks under the usual names (`event`/`type` like `call.booked` or
"Call booked"; `data.call` / `call`; `contact` / `invitee`; camelCase or snake_case). A payload it cannot read fails with
the reason in `crm_webhook_log.error` and is retried, then kept: once the mapper is adjusted, reset the row to
`received` and it is processed as if it were new. Contact and outcome events from iClosed are stored as `ignored`
(outcomes are declared in the CRM only).

### Not in this PR

- CRM › Sales cycle screen and the switch of Pipeline / Leads to real cycles: next PR (phase 2b).
- iClosed history import: needs iClosed API access (an `ICLOSED_API_KEY` Supabase secret); later.
- `crm_members` is empty in production until the team mapping (phase 1): cycles are created with no owner (or the
  default owner once `sales` is linked) and nobody reads them through the app until then.

## Phase 2b — the CRM board on real cycles (branch `crm-2b-screen`)

- `app/crm/data.js`: `listBoard()` (visible cycles with their calls, events and deal), `listMembers()`, `listReasons()`.
- `gen_crm.py` adds a live script to the CRM (CRM LNP) frame, active only when the parent page's `LNP_CRM` is live
  (web edition): Pipeline and Leads show the real cycles. Status: won → Won, lost → Lost, disqualified →
  Disqualified, else from the latest non-cancelled call (scheduled → Call booked, held → Call held, no-show → No-show,
  none → New); column R1 / R2 / R3+ from the call rank; owner from `crm_members` (or "Unassigned"); the step history from
  the real events (booked, held, no-show, won, lost, disqualified); the latest note.
- Read-only until the outcome form (phase 3): drag, status, next action, warming, steps, held / no-show, new lead,
  payment and "Add transcript" show "Saving from the CRM arrives with the outcome form (phase 3)" instead of changing
  data that would vanish on reload. Notes are saved for real (`crm_add_note`). No sample analysis or transcript is shown
  on a real lead; a lead without a product shows "—".
- As a plain file or an Artifact the board stays empty (demo).
- Not yet: the "Sales cycle" view of mock-up v4 (the mock-up is not in the repository: to get from Romain).

## Import of the leads that already exist (Romain, 24 Oct 2026)

Romain wants every existing lead from iClosed and Close in the CRM, with no duplicate.

- `007_crm_import.sql`: `crm_import_people` (one person per contact; found again by email, phone, Close contact id or iClosed
  contact id, so a lead present in both tools, or imported twice, stays one person; identifiers pointing to two people are
  counted as conflicts and left alone; a contact with no usable identifier is skipped and counted). Each contact's lead
  status and opportunities are kept as an `imported` event on the person (`source = import`). Runs in `crm_import_runs`
  (counts only). New identity kind `close_contact_id`.
- Edge Function `crm-import`: Close first (`CLOSE_API_KEY`). Dry run → counts (leads, contacts, created / matched /
  conflicts / skipped, Close statuses) with nothing written; then the real import, page by page, resumable.
- Leads are imported as **people**. Cycles from the Close history (won / lost) need a mapping of Close's lead and
  opportunity statuses to CRM statuses, decided by Romain from the dry-run counts (`crm_settings.close_status_map`, next).
- iClosed import: needs `ICLOSED_API_KEY` and iClosed's API reference (not reachable from the build environment).
- VERIFY on the first dry run: Close field names (`contacts[].emails[].email`, `phones[].phone`, `opportunities[]`).
