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

A lead's level on the screen is its worst open SLA (Critical, Late; Due soon = preventive). A closed lead stops every clock.
Not measured yet (no data until Whop, iClosed warming and the reconciliation exist): SH-1, SH-3 to SH-5, SH-7, SH-9,
SH-10, DE-2 to DE-6, DE-8, CA-1, CA-3 to CA-7, CO-3 to CO-5, CL-1 to CL-4, DO-1 to DO-5. Decisions applied (doc §9):
sales window 08:00-22:00 for CO-1 (time zone `crm_settings.sla_alerts.window_tz`, New York: most prospects are in the US).

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
