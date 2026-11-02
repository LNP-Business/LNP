# 08 — Whop (payments, won)

A cycle is **won** at the first successful Whop payment of its deal.

## 1. API basics

- Base URL: `https://api.whop.com/api/v1` (sandbox: `https://sandbox-api.whop.com/api/v1`)
- Auth: `Authorization: Bearer <WHOP_API_KEY>` (company API key with the needed permissions:
  `developer:manage_webhook`, payment and member read scopes including `member:email:read` and
  `member:phone:read`).
- Prefer the official SDK (`@whop/sdk`, pinned version) for calls and webhook verification.

## 2. One checkout per cycle (automatic matching)

When the outcome form records **yes**, the sales clicks "Create payment link" (or it is created
automatically — DEFERRED). `whop-checkout` calls:

```
POST https://api.whop.com/api/v1/checkout_configurations
{ "mode": "payment",
  "plan_id": "<Whop plan id of the product>",
  "metadata": { "skl_cycle_id": "<cycle uuid>", "skl_person_id": "<person uuid>" },
  "redirect_url": "<thank-you page>" }
```

Whop documents that payments and memberships created from a checkout **inherit its metadata**.
Store `crm_deals.whop_checkout_id` and `crm_deals.whop_purchase_url`, write a `checkout_created` event,
and show the link to the sales (copy button) to send through Sendblue.

The mapping `product → Whop plan id` lives in `crm_settings.whop_plans` (to fill in phase 0).

**VERIFY** (Q3): whether `metadata` is present in `payment.*` webhook payloads. If not, fetch the
payment through the API by its id to read the metadata before matching.

## 3. Webhook

```
POST https://api.whop.com/api/v1/webhooks
{ "url": "https://<project>.functions.supabase.co/whop-in",
  "events": ["payment.succeeded","payment.failed","payment.pending","payment.requires_action",
             "refund.created","refund.updated","dispute.created","dispute.updated",
             "membership.activated"],
  "api_version": "v1" }
```

The response contains `webhook_secret` (`ws_…`) → `WHOP_WEBHOOK_SECRET`.

### Verification (Standard Webhooks)

- Signed content: `<webhook-id>.<webhook-timestamp>.<raw body>`
- HMAC-SHA256 with the secret; header `webhook-signature: v1,<base64>` (may contain several
  space-separated signatures: accept if any matches).
- Constant-time comparison; reject if `webhook-timestamp` is more than 5 minutes from now.
- Or use the SDK's `unwrap` helper. `delivery_id` = `webhook-id`.

## 4. Mapping (`mappers/whop.ts`)

Envelope: event type + `data` = full object (payment, refund, dispute, membership).

| Whop event | Canonical type | Entity changes | Projector effect |
|---|---|---|---|
| `payment.succeeded` | `payment_succeeded` | upsert `crm_payments` (status, amount, currency, paid_at) | first one of the deal → `won` |
| `payment.failed` | `payment_failed` | upsert `crm_payments` | alert c8 |
| `payment.requires_action` | `payment_requires_action` | upsert | alert c8 |
| `payment.pending` | `payment_pending` | upsert | none |
| `refund.created` / `refund.updated` | `refund` | `crm_payments.refunded_amount` | collected cash recomputed; alert c9 |
| `dispute.created` / `dispute.updated` | `dispute` | flag on payment | alert c9 |
| `membership.activated` | `membership_activated` | none | hand-over signal |

- `source_id` = `whop:<event>:<object id>` (+ `:<updated_at>` for `*.updated`).
- Identity: `metadata.skl_cycle_id` first; else member/user id, email, phone (03).
- A payment on a cycle with no `yes` outcome: accept, write the event, alert the sales lead
  (alert c10), let the projector mark it won.
- Amounts are stored as reported; currency kept; no FX conversion in this phase.

## 5. Money views

- **Sold** = `crm_deals.amount_sold` (from the outcome form).
- **Collected** = Σ `crm_payments.amount` where status succeeded − Σ `refunded_amount`.
- Both are always shown side by side.

## 6. Reconciliation

Nightly: list yesterday's payments through the Payments API (VERIFY endpoint and filters in the
API reference) and compare ids and total amount with `crm_payments`; feed missing ones through the
mapper.
