# 12 — Security and personal data

## 1. Secrets

- Stored only as Supabase function secrets (01 §6). Never in the repository, the front end, logs,
  `crm_webhook_log.headers` (redact) or error messages.
- Rotation: documented per source in 05–08. Rotate immediately if a secret leaks.

## 2. Inbound authentication

| Source | Check |
|---|---|
| iClosed (Zapier) | `x-skl-token` header, constant-time compare |
| Fathom | `webhook-id` / `webhook-timestamp` / `webhook-signature`, 5-minute window |
| Sendblue | token in query string until a signature is confirmed (Q4) |
| Whop | Standard Webhooks HMAC-SHA256, 5-minute window |

Unauthenticated requests are stored with `status = 'rejected'` and answered `401`; an alert is
raised if more than 20 are rejected in an hour.

## 3. Access

- Row-level security on every table (`web/supabase/003_crm_core.sql`). Sales see their cycles; sales lead, admin
  and viewer see all; operational tables are admin / sales lead only; `crm_webhook_log` is service-role
  only.
- All writes from the UI go through security-definer RPCs that check role and ownership and write
  `crm_audit_log`.
- Accounts are the existing web edition accounts (invite link, Team access). A CRM role needs a
  `crm_members` row; deactivate it with `active = false`. Settings › Access still decides which
  screens show, but CRM data isolation is enforced by RLS, unlike `docs`.

## 4. Personal data

**Open (Q9):** the project is in ap-southeast-2 (Sydney) and the origin of the leads (US, EU or both) is not
settled. Decide before go-live; until then the points below stay as written.


- Recording notice before every call (iClosed confirmation message and start of the call).
- Messaging consent stored on `crm_people`; STOP handled automatically and permanently (07 §2).
- Retention: transcripts and recordings deleted or anonymised after a period to be decided
  (DEFERRED, Q6) by a scheduled job; payments kept as required by accounting rules.
- Subject requests: admin action to export all data of a person (JSON) and to erase a person
  (identities, messages, transcripts; payments kept anonymised).
- Supabase project in an EU region (A2).
- Nurture sending stays disabled until legal sign-off (Q6).

These points do not replace legal advice.
