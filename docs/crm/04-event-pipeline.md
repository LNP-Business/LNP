# 04 — Event pipeline

```
provider ──HTTP──► <source>-in ──► crm_webhook_log (raw) ──trigger──► process-inbox
                                                                     │
                       verify ─► map ─► match ─► upsert entities ─► insert crm_events ─► projector
                                                                     │
                                              crm_unmatched_inbox ◄──────┘ (when no match)
```

## 1. Ingestion functions (`iclosed-in`, `fathom-in`, `sendblue-in`, `whop-in`)

Each function:

1. Accepts `POST` only; rejects bodies above 2 MB.
2. Reads the **raw body as text** (never parse first: signatures are computed on raw bytes).
3. Performs the cheap auth check of its source (token header, or signature — see each
   integration file) and records the result in `auth_ok`. A failed check still stores the row with
   `status = 'rejected'` (for audit), then returns `401`.
4. Inserts into `crm_webhook_log(source, delivery_id, headers, body, auth_ok)`. If the unique
   `(source, delivery_id)` already exists, return `200` immediately (duplicate delivery).
5. Returns `200` within a few hundred milliseconds. No other work.

Headers stored: all, except `authorization`, `cookie`, and any secret token header (store
`"<redacted>"`).

## 2. Worker `process-inbox`

Triggered by a Supabase database webhook on `crm_webhook_log` insert, and by a cron every 5 minutes
that picks rows with `status in ('received','failed') and attempts < 8` (exponential back-off:
1, 2, 4 … minutes).

For one row:

1. **Verify** fully (signature + timestamp window). Fail → `rejected`.
2. **Map** with `mappers/<source>.ts` into zero or more canonical items:
   ```ts
   type Canonical = {
     source: 'iclosed'|'fathom'|'sendblue'|'whop';
     source_id: string;           // stable id of this fact at the source (see each integration)
     type: string;                // canonical type (02-data-model.md §3)
     occurred_at: string;         // ISO time of the fact at the source, not reception time
     actor: 'sales'|'prospect'|'auto'|'system';
     channel: string;
     content?: string;
     identity: { email?: string; phone?: string; iclosed_contact_id?: string;
                 whop_user_id?: string; whop_member_id?: string; name?: string };
     refs?: { iclosed_call_id?: string; fathom_recording_id?: number; whop_payment_id?: string;
              cycle_id?: string; sendblue_message_handle?: string; member_email?: string;
              member_number?: string };
     data: Record<string, unknown>;   // the fields the projector or the UI need
   };
   ```
   Unknown or irrelevant payload types → `ignored` (kept in the log).
3. **Match** person and cycle (03). No match → `crm_unmatched_inbox`, row `status = 'unmatched'`.
4. **Upsert entities** in one transaction: person/identities, cycle, call, payment, deal,
   outbound message status.
5. **Insert events** with `on conflict (source, source_id) do nothing`.
6. **Project**: `recompute_cycle(cycle_id)` for every touched cycle.
7. Mark the row `processed` with `processed_at`. On exception: `failed`, `attempts + 1`, `error`.

The whole of steps 4–6 runs in a single database transaction per row.

## 3. Projector (`_shared/projector.ts`)

`recomputeCycle(cycleId)`:

1. Load the cycle's events sorted by `occurred_at, id`, its calls, current outcomes, payments,
   and the active `crm_stage_definitions`.
2. Replay from scratch:
   - stage = the last stage whose `enter_on` contains an event type seen, in `position` order;
   - `crm_stage_history` rows rebuilt (delete + insert for this cycle);
   - counters: `calls_held`, `no_shows`, `sales_attempts` (attempt definition from
     `crm_rules.auto_lost_unreachable.params`, DEFERRED), `last_prospect_at`, `last_sales_at`;
   - status: `won` at the first `payment_succeeded` of the deal; `lost` / `disqualified` at the
     latest current outcome `no` / `disqualified` or a rules `cycle_lost` event; back to `active`
     on `cycle_reopened`;
   - write `cycle_won|cycle_lost|cycle_disqualified` events when the status changes
     (idempotent `source_id = 'status:' || cycle_id || ':' || status || ':' || occurred_at`).
3. Compute `next_move` through `rules.ts` (`next_move` rule, DEFERRED logic, see 10).
4. Save derived columns and `projected_at`.

The projector is pure with respect to its inputs: running it twice gives the same result. A
`recompute_all()` admin action rebuilds every cycle (used after a rule or stage change).

## 4. source_id conventions

| Source | `source_id` |
|---|---|
| iClosed | `iclosed:<event>:<call_id>:<occurred_at>` (Zapier gives no delivery id) |
| Fathom | `fathom:recorded:<recording_id>` |
| Sendblue | `sendblue:<message_handle>` for messages; `sendblue:status:<message_handle>:<status>`; `sendblue:call:<call_id>` |
| Whop | `whop:<event type>:<object id>` (+ `:<updated_at>` for `*.updated` events) |
| CRM | `crm:<table>:<row id>` |
| Rules | `crm_rules:<rule_key>:<cycle_id>:<window>` |
