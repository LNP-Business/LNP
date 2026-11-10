# 07 — WhatsApp Business (messages of the sales reps and setters)

Decision (Romain, 2026-11-09): WhatsApp Business is the only messaging channel of the CRM; Sendblue is not used.
Every written exchange between a sales rep or a setter and a prospect goes through the person's **WhatsApp Business**
number, connected to the official **WhatsApp Business Platform (Cloud API) in coexistence**: the person keeps the
WhatsApp Business app on their phone, and the CRM receives what they receive and what they send from the app.

Team rule: every exchange with a prospect goes through the declared WhatsApp Business number (Paramètres › Compte ›
Accès de l'équipe, column « WhatsApp Business »); a personal WhatsApp is invisible to the CRM.

## 1. Connection

- Meta Business portfolio of LNP, verified. One WhatsApp Business number per person.
- A provider approved by Meta (360dialog recommended; Telnyx or Meta directly also work), onboarding « number already
  used in the WhatsApp Business app » (coexistence), chat history shared at onboarding.
- Webhook address: `https://<ref>.supabase.co/functions/v1/whatsapp-in?k=<WHATSAPP_INBOUND_TOKEN>`, events `messages`,
  `smb_message_echoes` and `history`.
- Meta directly (no provider): the same address without `k=`; Meta first checks it with a GET
  (`hub.mode=subscribe`, `hub.verify_token` = `WHATSAPP_INBOUND_TOKEN`, answered with `hub.challenge`), then signs each
  POST (`X-Hub-Signature-256`, HMAC-SHA256 of the raw body with the app secret `WHATSAPP_APP_SECRET`).

Secrets (Supabase › Edge Functions › Secrets): `WHATSAPP_INBOUND_TOKEN` (we invent it: 48 letters and digits),
`WHATSAPP_APP_SECRET` (Meta directly only).

## 2. Mapping (`supabase/functions/_shared/mappers/whatsapp.ts`)

One webhook = Meta's payload `{object: "whatsapp_business_account", entry: [{changes: [{field, value}]}]}`, possibly with
several messages. The team number is `value.metadata.display_phone_number` (`data.line`).

| Field | Part | Canonical type | Actor |
|---|---|---|---|
| `messages` | `value.messages[]` (from the prospect) | `message_in` | prospect |
| `messages` | `value.statuses[]` (a message sent through the API: sent, delivered, read, failed) | `message_out` | auto |
| `smb_message_echoes` | `value.message_echoes[]` (typed in the app by the team) | `message_out` | sales |
| `history` | `value.history[].threads[].messages[]` (chats shared at onboarding; out when `from` is the team number) | `message_in` / `message_out` | prospect / sales |
| `smb_app_state_sync`, reactions, groups, system messages | — | ignored | — |

- `source_id = whatsapp:<wamid>`: one event per message. A later status or delivery updates `data.status`. A message first
  seen through its status alone (sent by the API, so automatic) becomes `sales` when the app's echo of the same id arrives
  (`crm_apply_message_item`, migration 052).
- Content: the text, a button or list reply, or a media caption; `data.kind` keeps the message type.
- `STOP` (or arrêt, unsubscribe) from the prospect → an `opt_out` item: `crm_people.opted_out_at`.
- Identity: the prospect by phone (WhatsApp numbers come without `+`); an unknown number becomes a new prospect, with
  the name of their WhatsApp profile. The team member: `crm_members.whatsapp_number` = `data.line` → `crm_events.member_id`.

## 3. What counts as a touch

A `message_out` with actor `sales` (typed by a person) counts as a touch of the sales rep in the SLAs (SH-2, SH-8, DE-1,
DE-7, CO-1…) and in the Cockpit commercial › Exécution. A `message_out` with actor `auto` (reminders, confirmations sent by
the API) never counts as a human touch. Phone calls and missed calls are not received (CO-3 stays not measured).

## 4. Sending

The CRM does not send WhatsApp messages. Automatic confirmation after a booking (SH-1) and reminders (SH-5) need WhatsApp
template messages, approved by Meta and paid: who sends them (the provider's tool, iClosed or the CRM) is still to decide.

## 5. Tests

`supabase/tests/pipeline.test.ts` (mapping, fixtures `docs/crm/fixtures/whatsapp-*.json`, built from Meta's documented
payloads: replace them with captured requests once connected), `supabase/tests/ingest.test.ts` (token, signature,
address check), `web/supabase/tests/whatsapp_test.sql` (team number, status then echo, unknown number, STOP).
