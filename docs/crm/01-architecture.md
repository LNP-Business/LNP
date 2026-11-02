# 01 — Architecture

## 1. Components

```
                   ┌──────────────── Supabase project "skl-os" ─────────────────┐
 iClosed ─► Zapier ─►│ Edge Function iclosed-in  ┐                                  │
 Fathom  ───────────►│ Edge Function fathom-in   ├─► crm_webhook_log (raw)          │
 Sendblue ──────────►│ Edge Function sendblue-in │          │                       │
 Whop    ───────────►│ Edge Function whop-in     ┘          ▼                       │
                     │                            worker process-inbox             │
                     │                 verify ► map ► match ► crm_events          │
                     │                                       │                     │
                     │                    projector: recompute the cycle          │
                     │  existing: docs, members, auth        │                     │
                     │  CRM: crm_* tables ◄───────────────────┘                     │
                     │  pg_cron: rules-tick (15 min), nurture-tick (1 h),          │
                     │  reconcile (nightly) · outbound: sendblue-send,             │
                     │  whop-checkout, claude-analyze                              │
                     └───────────────┬──────────────────────────────────────────────┘
                                     │ supabase-js client already opened by web/public/skl-web.js
                                     ▼
        Vercel "skl-os.vercel.app": SKL OS web edition (sign-in, /api/config, /api/me, /api/team…)
        store.js merges crm_alerts into the alert list → My Day › Needs you, Settings › Alerts
```

| Component | Where | Responsibility |
|---|---|---|
| Ingestion functions | Supabase Edge Functions | Receive webhooks, cheap auth, store raw body, answer `200` fast |
| Worker `process-inbox` | Edge Function (database webhook + retry cron) | Verify, map, match, write events, project |
| Projector | `_shared/projector.ts` | Rebuild a cycle's derived state from its events |
| CRM rules | `rules-tick` | CRM rules (`crm_rules`) and CRM alert instances c1–c18 (`crm_alerts`) |
| Outbound | Edge Functions | Sendblue sends, Whop checkouts, Claude calls |
| Admin functions | existing Vercel `web/api/*` | Unchanged (team, access, files) |
| Front end | existing SKL OS web edition | CRM screens on `crm_*` tables; alerts through the existing engine |

**Why Supabase Edge Functions and not Vercel `/api` for webhooks:** the jobs run every 15 minutes
and at night, need retries and must sit next to the database; Vercel stays for the existing admin
endpoints (see also Q7 on the Vercel plan).

## 2. Where things live in the repository

```
web/supabase/001_init.sql            existing (docs, members, RLS)
web/supabase/002_q4_okrs.sql         existing
web/supabase/003_crm_core.sql        CRM schema (provided in this pack)
web/supabase/004_...sql              later CRM changes, same numbering convention
supabase/                            Supabase CLI workdir for Edge Functions only
  config.toml
  functions/
    _shared/ db.ts normalize.ts match.ts projector.ts rules.ts
             verify/standard-webhooks.ts verify/token.ts
             mappers/iclosed.ts fathom.ts sendblue.ts whop.ts
    iclosed-in/ fathom-in/ sendblue-in/ whop-in/     ingestion
    process-inbox/ rules-tick/ nurture-tick/ reconcile/
    sendblue-send/ whop-checkout/ claude-analyze/
  tests/
skl-os/crm/                          CRM data layer used by crm_doc.html and the CRM screens
docs/crm/                            this specification
```

SQL files are applied the same way as `001` and `002` today (follow the repository's existing
practice). If Claude Code introduces Supabase CLI migrations, keep `web/supabase/` as the
numbered source of truth.

## 3. Principles

1. **Raw first.** Every request is written to `crm_webhook_log` before processing; any request can
   be replayed.
2. **Answer fast.** Ingestion only authenticates and stores, then returns `200`.
3. **Idempotency.** `crm_events` is unique on `(source, source_id)`.
4. **Event sourcing.** Cycle state is derived and rebuildable with `recompute_cycle(cycle_id)`.
5. **Real time order.** The projector sorts by `occurred_at`, not by reception time.
6. **Configuration over code.** Stages, rules, reasons and settings are data; alert rules live in
   `config/alerts` next to the existing ones.
7. **Humans decide statuses.** Fathom and Claude never change a cycle status. Only the outcome form,
   Whop payments and explicit configured rules do. CRM agents propose; humans approve (Agent System).
8. **Reconcile** every night and alert when a source goes silent.
9. **One alert system.** CRM alerts are rules c1–c18 of the existing engine.
10. **Don't break the app.** `./build.sh` passes and every screen listed in the functional spec §13
    opens with no console error after every phase; the plain-file demo still works.

## 4. Environments

| Environment | Supabase | Front end | Webhooks |
|---|---|---|---|
| `dev` | **none** (D13): the same project `skl-os`, with test people only; unit tests run without a database | Vercel preview deployment of the branch | test accounts / replayed fixtures |
| `prod` | `skl-os` | https://skl-os.vercel.app | real providers |

## 5. Secrets

Existing Vercel variables are unchanged (`SUPABASE_URL`, `SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, `SITE_URL`). CRM secrets are **Supabase function secrets**:

| Name | Used by |
|---|---|
| `ICLOSED_INBOUND_TOKEN` | `iclosed-in` |
| `FATHOM_API_KEY`, `FATHOM_WEBHOOK_SECRET(S)` | `fathom-in`, `reconcile` |
| `SENDBLUE_API_KEY_ID`, `SENDBLUE_API_SECRET`, `SENDBLUE_INBOUND_TOKEN` | `sendblue-in`, `sendblue-send` |
| `WHOP_API_KEY`, `WHOP_WEBHOOK_SECRET`, `WHOP_COMPANY_ID` | `whop-in`, `whop-checkout`, `reconcile` |
| `ANTHROPIC_API_KEY` | `claude-analyze` |
