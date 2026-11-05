# 18 — Sales cycle SLAs (v3)

Reference: `reference/SKL-CRM-Sales-cycle-SLAs-v3.docx` (Romain, 25 October 2026; approved 2026-10-30 as the base of the
Sales cycle screen and its alerts). An SLA is a clock: an event starts it, a result stops it; four thresholds: the target,
the preventive alert (Due soon), the miss (Late) and the critical threshold.

## What is measured now

One source: `supabase/functions/_shared/sla_rules.js`, run by the Sales cycle screen (inlined by `skl-os/gen_crm.py`) and
by the Edge Function `sla-tick` (Slack). Values in hours in `DEFS`.

| ID | SLA | Starts | Stops | Due soon | Late | Critical |
|---|---|---|---|---|---|---|
| SH-2 | First sales contact | booking | first personal sales message or call | 3 min | 15 min | 60 min |
| SH-6 | R1 held at the planned time | R1 no-show | a call held | — | 45 min | 48 h |
| SH-8 | Follow-up after a no-show | no-show (planned time) | sales touch | — | 60 min | 24 h |
| SH-11 | Outcome declared | end of the call | outcome declared | 10 min | 60 min | 24 h |
| DE-1 | Written recap | end of a held call | sales message | 45 min | 3 h | 24 h |
| DE-7 | Follow-up with no reply | last sales message (Decision stage, no call ahead) | prospect reply | 20 h | 48 h | 96 h |
| DE-9 | Decision stage | first call held | yes or no | 60 h | 72 h | 144 h |
| CA-2 | First payment | yes | first payment | 12 h | 24 h | 48 h |
| CO-1 | Reply to a prospect message | prospect message (CO-2: outside 08:00-22:00 New York, at the next 08:00) | sales touch or call held | 10 min | 60 min | 4 h |

Added on 2026-11-05 (044, Settings › Alerts):

| ID | SLA | Starts | Stops | Due soon | Late | Critical |
|---|---|---|---|---|---|---|
| SH-1 | Automatic confirmation (tech) | booking | first automatic message | — | 5 min | 15 min |
| SH-3 | Time to the R1 (indicator) | booking | planned R1 | — | 72 h | 96 h |
| SH-4 | Exchange before the call | booking | a sales message then a prospect reply, before the R1 | 12 h before the R1 | 3 h before | — |
| SH-9 | New slot after a no-show | no-show | a new booking (or a later call already planned) | 12 h | 24 h | 2nd no-show |
| DE-2 | Call analysis available (tech) | Fathom recording | analysis ready | — | 60 min | 4 h |
| DE-4 | Next call booked | « Follow-up » outcome | next call booked (one already planned counts), or a yes / no | 12 h | 24 h | 48 h |
| DE-5 | Time between two calls | a call held | the next call (only when there is one: otherwise DE-4 and DE-9) | — | 5 d | 7 d |
| DE-8 | Calls with no decision | calls held, no yes or no | yes or no | 2nd call held | 3rd call planned | — |
| CA-1 | Payment link sent | yes | Whop link (`checkout_created`) or payment | — | 30 min | 2 h |
| CA-5 | Unpaid yes: closing | yes | payment | 7 d | — | 14 d |
| CO-4 | STOP (tech) | an automatic message after `opt_out` | — | — | — | at once |
| CO-5 | Quiet hours (tech) | an automatic message outside 09:00-20:00 (prospect time) | — | — | — | at once |
| CL-1 | Automatic loss | last prospect reply, with ≥ 4 attempts on different days since | reply or closing | 27 d | 30 d | — |
| CL-3 | Reply to a nurture lead | a prospect message after a no | sales reply | 10 min | 60 min | 4 h |
| DO-2 | Recording attached (tech) | end of a held call | Fathom recording of that call | — | 2 h | 24 h |

CO-2 (the night window) is a switch on CO-1. Not measured (no data yet, listed in Settings with the reason): SH-5, SH-7,
SH-10, SH-12 (indicator), DE-3 (form rule, not applied: the outcome form asks no date), DE-6, CA-3, CA-4, CA-6, CA-7,
CO-3, CL-2 (form rule, applied: a reason is required), CL-4, DO-1, DO-3, DO-4, DO-5.

A lead's level on the screen is its worst open **sales** SLA (Critical, Late; Due soon = preventive): tech and indicator
SLAs show a mark on the lane but never set the level. A closed lead stops every clock. Decisions applied (doc §9): sales
window 08:00-22:00 for CO-1 (time zone `crm_settings.sla_alerts.window_tz`, New York: most prospects are in the US).

### Settings (Settings › Alerts › « Gestion des prospects · SLA du cycle de vente »)

The 42 SLAs of the reference, grouped by stage, each with its status (measured, waiting for data, form rule, indicator, not
measured yet), a switch, and an editor: start and stop, target, escalation, the three thresholds (only those the
reference has; they stay in order), where it shows (CRM › Sales cycle, Slack #sales-cycle) and why. « Enregistrer » next to
« Terminé » in each editor, or « Enregistrer les modifications » at the top, saves through `crm_save_sla_rules` (044, admin
or sales lead; shape checked, audited) into `crm_settings.sla_rules = {sources, rules}`. `SKL_SLA.configure()` applies it on
the screen (`SKL_CRM.slaRules`, and at once after a save) and in `sla-tick` (`crm_sla_settings().sla_rules`).

Sources: `messages` (Sendblue iMessage, SMS, phone), `whop`, `analysis` (automatic analysis of every recording). On
2026-11-05 none reaches the CRM, so 044 stores them as not connected and their SLAs wait: before, all 171 active leads were
Critical (SH-2 and DE-1 waited for messages that never come). An admin switches a source on in Settings once it is wired.

## Screen (CRM › Sales cycle)

- KPI row across the whole width: Live leads, Critical, Late, Due soon, Sales must act, Calls within 24 h, Waiting on
  prospect, Closed (the closed leads, until now only at the bottom of the board). Each filters the board.
- On each lane: a mark at the moment an SLA was missed (orange Late, red Critical, gold Due soon; an outlined mark = missed
  then resolved) and a dashed bar under the lane while a miss is open. The mark's tooltip says which SLA, how long, the target.

## Alerts (Slack #sales-cycle, IDA workspace)

`web/supabase/028_crm_sla_alerts.sql` + `006_crm_cron.sql`: every 5 minutes pg_cron calls `sla-tick`, which reads the
active cycles (`crm_sla_snapshot`, service role, no message text), applies the rules and posts each new Late or Critical
miss once (`crm_sla_claim` / `crm_sla_notices`): one message per tick listing the misses, critical first, with the lead,
the sales rep, the time and the target, and a link to the Sales cycle. Misses before `crm_settings.sla_alerts.since` (the
migration) or older than `max_age_hours` (6) are never posted. Setup: `setup.md` step 7b (secret
`SLACK_SALES_CYCLE_WEBHOOK_URL`). Tests: `supabase/tests/sla.test.ts`, `web/supabase/tests/sla_alerts_test.sql`.
