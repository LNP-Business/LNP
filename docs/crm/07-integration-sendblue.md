# 07 — Sendblue (iMessage, SMS, calls)

Sendblue carries every written and phone exchange between a sales and a prospect, on the sales'
Sendblue line. Prospects use iMessage; Android prospects automatically receive SMS. The CRM also
**sends** every automated message itself through the Sendblue API, so it always knows which
outbound messages are automated.

Team rule: a sales only uses their Sendblue line with prospects, never their personal phone.

## 1. Inbound webhooks

Configure in the Sendblue dashboard (or API) the following webhook types to
`https://<project>.functions.supabase.co/sendblue-in?k=<SENDBLUE_INBOUND_TOKEN>`:

| Sendblue type | Canonical type | Actor |
|---|---|---|
| `receive` | `message_in` | prospect |
| `outbound` | `message_out` (first sighting of a handle) / `message_status` (later status) | sales, or `auto` if the handle is in `crm_outbound_messages` |
| `call_log` | `phone_call_out` | sales |
| `inbound_call` | `phone_call_in` | prospect |
| `contact_created`, `line_*`, `typing_indicator`, `contact_profile` | ignored | — |

Payload fields used (message webhooks): `content`, `is_outbound`, `message_handle`,
`message_type`, `media_url`, `status`, `error_code`, `error_message`, `date_sent`, `date_updated`,
`from_number`, `to_number`, `number`, `sendblue_number`, `service` (iMessage / SMS), `opted_out`,
`sender_email`, `group_id`.
Call log: `call_id`, `from_number`, `to_number`, `direction`, `status`, `duration`,
`recording_url`, `transcript`, `created_at`, `sent_by`.
Inbound call: `call_id`, `from_number`, `to_number`, `status`, `answered`, `duration`,
`created_at`, `ended_at`.

**VERIFY** (Q4): Sendblue's webhook authentication. Until confirmed, the long random token in the
query string (`k=`) is checked in constant time; move to a signature check if Sendblue offers one.
Do not log the query string.

## 2. Mapping (`mappers/sendblue.ts`)

- The **prospect number** is `number` (or the non-Sendblue side of `from_number`/`to_number`).
- The **team member** is found by `sendblue_number` = `crm_members.sendblue_number`.
- `occurred_at` = `date_sent` (messages) / `created_at` (calls).
- `source_id`: `sendblue:<message_handle>`; status updates
  `sendblue:status:<message_handle>:<status>`; calls `sendblue:call:<call_id>`.
- Group messages (`group_id` set) → `ignored` unless a group policy is defined later.
- `opted_out = true`, or an inbound message whose content matches the stop keywords (`STOP`,
  `ARRET`, `ARRÊT`, `UNSUBSCRIBE`, case-insensitive, whole message) → `opt_out` event, set
  `crm_people.opted_out_at`, close any active nurture as `opted_out`.

## 3. What counts as a touch

| Event | Prospect touch (resets silence) | Sales attempt |
|---|---|---|
| `message_in`, `phone_call_in` answered | yes | — |
| `message_out` by sales, `phone_call_out` by sales | — | yes (DEFERRED: distinct-day rule in `crm_rules`) |
| `message_out` by `auto` | — | no |
| `message_status` | no | no |

## 4. Sending (`sendblue-send`)

Automated messages are proposed by the Agent System agent **Lead follow-ups** (nurture, no-show
follow-up, warming steps). A proposal is a `crm_outbound_messages` row with
`status = 'pending_approval'`, listed in Agent System › Decisions (Approve / Reject). Approved
rows move to `queued`. Once the agent's autonomy level allows it (F10), rows are created directly
as `queued`. Each proposal and send writes a `crm_agent_runs` row.


Only the CRM sends automated messages. Flow:

1. The Lead follow-ups agent inserts `crm_outbound_messages(status = 'pending_approval' or 'queued', purpose, content,
   person_id, cycle_id, from_member_id)`.
2. `sendblue-send` (triggered on insert) refuses if `crm_people.opted_out_at` is set or
   `messaging_consent = false`; then calls:
   ```
   POST https://api.sendblue.com/api/send-message
   sb-api-key-id: <SENDBLUE_API_KEY_ID>
   sb-api-secret-key: <SENDBLUE_API_SECRET>
   Content-Type: application/json
   { "number": "+33612345678",
     "from_number": "<member Sendblue line>",
     "content": "…",
     "status_callback": "https://<project>.functions.supabase.co/sendblue-in?k=<token>" }
   ```
3. Stores `message_handle` from the response (VERIFY the response field on a test send) and
   `status = 'sent'`. When the `outbound` webhook for that handle arrives, the mapper sees the
   handle in `crm_outbound_messages` and tags the event `auto`.
4. On `status: "ERROR"` (e.g. `error_code: 429` capacity decline) → `failed`, retry with
   back-off up to 3 times, then alert c12 (Message not delivered).

Sending respects quiet hours (`crm_settings.quiet_hours`, prospect side: DEFERRED) and never sends
the same `purpose` twice to a person within the cadence window.

## 5. Reconciliation

If Sendblue offers a message history endpoint (VERIFY), compare yesterday's handles with
`crm_events`; otherwise rely on the source-silence alert (14).
