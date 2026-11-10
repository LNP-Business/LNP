# 14 — Operations

## 1. Scheduled jobs (pg_cron → Edge Functions via pg_net)

| Job | Schedule | Function |
|---|---|---|
| Retry failed inbox rows | every 5 min | `process-inbox` (batch mode) |
| Rules | every 15 min | `rules-tick` |
| Nurture | hourly | `nurture-tick` |
| Reconciliation | daily 02:00 UTC | `reconcile` |
| Retention | daily 03:00 UTC | `retention` (once Q6 is decided) |

## 2. Nightly reconciliation (`reconcile`)

For the previous UTC day, per source, write one `crm_reconciliation_runs` row:

| Source | Expected (from the provider) | Found (CRM) | Fix |
|---|---|---|---|
| iClosed | calls from snapshot Zap / API (05 §6) | `crm_calls.iclosed_call_id` | feed missing through mapper |
| Fathom | `GET /meetings` with external invitees | `crm_calls.fathom_recording_id` | feed missing |
| Whop | payments list (08 §6) | `crm_payments.whop_payment_id` + total amount | feed missing |
| CRM | calls passed / outcomes declared | `crm_call_outcomes` | list to sales lead |

Any gap → alert c18 to Romain, with the detail in `discrepancies`.

## 3. Source silence

`rules-tick` checks the last `crm_webhook_log.received_at` per source. Thresholds in
alert c17 in `config/alerts` (e.g. no iClosed event for 6 h during working days while bookings are
usual; Fathom silent while 2 held calls have no recording). Alert Romain.

## 4. Replay

Admin "Reliability" screen: list `crm_webhook_log` rows with `failed`, `rejected`, `unmatched`;
"Replay" resets `status = 'received'`, `attempts = 0`. Replays are safe (idempotent events).

## 5. Runbook

| Symptom | Likely cause | Action |
|---|---|---|
| No bookings arriving | Zap off, Zapier quota | Re-enable, replay Zapier failed tasks, run reconciliation |
| Many rejected rows | Secret rotated on one side only | Align secret, replay |
| Recordings unmatched | Prospect joined with another email | Resolve in unmatched inbox (adds identity) |
| Collected cash ≠ Whop | Missing payment or refund | Run reconciliation, check unmatched |
| Wrong stages everywhere | Config change | Fix `crm_stage_definitions`, `recompute_all()` |
| Nurture messages not sent | `nurture_sending_enabled = false`, opt-out, WhatsApp sending error | Check settings, `crm_outbound_messages.error` |

## 6. Daily / weekly / monthly routine

- Daily (sales lead): empty the unmatched inbox, read the reconciliation summary.
- Weekly: review a sample of call analyses; review abandoned leads.
- Monthly (Romain): collected cash vs Whop; review deferred-rule values and loss reasons.
