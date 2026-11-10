# 05 — iClosed (calendar only)

iClosed is used only as a calendar. It sends three facts to the CRM: a call was **booked**,
**rescheduled** or **cancelled**. Outcomes, notes and transactions are **not** taken from iClosed:
they are created in the CRM.

## 1. Transport

**Update (Q1 answered, 24 Oct 2026):** iClosed has native webhooks. They post to
`iclosed-in?k=<ICLOSED_INBOUND_TOKEN>` (or with the header `x-lnp-token`), no Zapier. The Zap set-up below stays as a
fallback; the mapper of phase 2 is written from the captured native payloads.

iClosed exposes instant triggers through Zapier (Call Booked, Call Rescheduled, Call Cancelled,
among others). Native webhooks are not confirmed (decision A3, question Q1). We therefore use one
Zap per trigger, each posting **our own JSON contract** to `iclosed-in`. If iClosed later
provides native webhooks, only the mapper changes.

## 2. Zap set-up (one per trigger)

1. Trigger: *iClosed › Call Booked* (resp. *Call Rescheduled*, *Call Cancelled*).
2. Action: *Webhooks by Zapier › POST*.
   - URL: `https://<project>.functions.supabase.co/iclosed-in`
   - Payload type: `json`
   - Headers: `x-lnp-token: <ICLOSED_INBOUND_TOKEN>`
   - Data: the contract below, each value mapped from the trigger's fields.
3. Turn on *Autoreplay* in Zapier for failed tasks.

## 3. Payload contract (what each Zap must send)

```json
{
  "contract": "lnp.iclosed.v1",
  "event": "call_booked",                 // call_booked | call_rescheduled | call_cancelled
  "occurred_at": "2026-10-24T09:12:00Z",  // when the booking/reschedule/cancel happened
  "call": {
    "id": "<iClosed call id>",
    "start": "2026-10-27T15:00:00Z",
    "end": "2026-10-27T15:45:00Z",
    "event_type": "<iClosed event / calendar name>",
    "host_email": "<email of the iClosed user hosting the call>",
    "cancel_reason": "",
    "previous_start": ""                  // reschedule only, if available
  },
  "contact": {
    "id": "<iClosed contact id>",
    "first_name": "", "last_name": "",
    "email": "", "phone": ""
  },
  "zap": { "id": "<zap id>", "task_id": "<zap task id if available>" }
}
```

**VERIFY in phase 0**: run each trigger once in Zapier's test mode and record which iClosed
fields exist (call id, start/end, host, contact id, phone, time of the action). If iClosed does not
provide the time of the action, map `occurred_at` to Zapier's trigger time and note it here.
Save one captured payload per trigger in `fixtures/` (personal data replaced).

## 4. Mapping (`mappers/iclosed.ts`)

| Contract `event` | Canonical type | Actor | Entity changes |
|---|---|---|---|
| `call_booked` | `call_booked` | prospect | person (create if new), cycle (see 03 §4), `crm_calls` row (rank = next) |
| `call_rescheduled` | `call_rescheduled` | prospect | `crm_calls.scheduled_start/end` updated |
| `call_cancelled` | `call_canceled` | prospect | `crm_calls.status = 'canceled'` |

- `delivery_id` = `zap.task_id` when present.
- `source_id` = `iclosed:<event>:<call.id>:<occurred_at>`.
- Identity: `contact.id`, `contact.email`, `contact.phone`, name.
- Owner: team member whose `iclosed_email = call.host_email`; else `crm_settings.default_owner`.
- A booking for an existing `iclosed_call_id` is treated as a reschedule.

## 5. Auth

`x-lnp-token` compared in constant time with `ICLOSED_INBOUND_TOKEN`. Rotate the token by
updating the secret and the three Zaps together.

## 6. Reconciliation

Nightly (see 14): the CRM compares yesterday's calls with iClosed. Preferred method, in order
(VERIFY which is available on the plan):

1. iClosed API, if confirmed (Q1).
2. A fourth Zap on a schedule: *Schedule by Zapier* (daily) → *iClosed › Search Call* for
   yesterday → POST the list to `iclosed-in` with `"event": "daily_snapshot"`. The mapper upserts
   missing calls (`source_id` unchanged, so no duplicates).
3. Manual: weekly CSV export from iClosed uploaded through the admin screen.

## 7. Automations to switch off

Once rebuilt in the CRM (phase 6), disable iClosed automations that depend on call outcomes.
Keep iClosed's own calendar reminders and confirmation emails, and make sure the confirmation
message includes the recording notice (12).
