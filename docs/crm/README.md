# LNP CRM — build specification pack (v1.2)

This folder is the complete specification for building the LNP CRM back end and wiring every
tool into it. It is written for Claude Code. Read it in the order below before writing any code.

v1.2 aligns the pack with the current app as described in the **LNP Functional
specification (24 Oct 2026)**: web edition on Vercel, Supabase project `LNP`, `docs` + `members`
tables, the existing alert engine (a1–a18, Settings › Alerts, My Day › Needs you), the Agent
System and the build pipeline. When this pack and the functional specification disagree about
what exists today, the functional specification wins; this pack describes what to add.

## What we are building

The LNP CRM becomes the **single source of truth** for every sales cycle, from the moment a
call is booked until the cycle is **won** (first successful Whop payment), **lost**, or
**disqualified**, plus a **nurture** track for people who may come back. It replaces the current
browser-only CRM storage (ALKIMIY Lite, `localStorage`) with shared, isolated, live data.

| Tool | Role | Direction |
|---|---|---|
| iClosed | Calendar only: call booked / rescheduled / cancelled | iClosed → Zapier → CRM |
| Fathom | Call recording: transcript, summary, action items | Fathom → CRM (webhook) + CRM → Fathom (API, reconciliation) |
| Sendblue | iMessage + SMS (+ calls) between sales and prospects; automated messages | Sendblue ↔ CRM |
| Whop | Payments; first successful payment = won | CRM → Whop (checkout per cycle) + Whop → CRM |
| Claude API | Call analysis (Agent System: Post-call analyst) | CRM → Claude |
| Supabase `skl-os` | Database, auth (existing), Edge Functions, scheduled jobs | — |
| Vercel `lnp-sales.vercel.app` | Existing web edition (front end + `/api` admin functions) | — |

Everything a person decides about a lead (call outcome, no-show, yes/no, loss or
disqualification reason, nurture, return date, notes) is entered **only in the CRM**.

## Reading order

| File | Content |
|---|---|
| `00-decisions.md` | Decisions taken, deferred, open; what already exists |
| `01-architecture.md` | Components, where code lives in the repo, data flow, principles |
| `02-data-model.md` | CRM tables (prefixed `crm_`). SQL: `web/supabase/003_crm_core.sql` |
| `03-identity-matching.md` | Normalisation and person/cycle matching |
| `04-event-pipeline.md` | Ingestion: raw log → verify → map → match → event → projector |
| `05`–`08` | iClosed, Fathom, Sendblue, Whop |
| `09-call-analysis.md` | Claude analysis = Agent System "Post-call analyst" |
| `10-rules-engine.md` | CRM rules and how CRM alerts plug into the existing alert engine |
| `11-crm-frontend.md` | Changes to LNP screens, store.js, sidebar, Access |
| `12-security-compliance.md` | Secrets, signatures, RLS, personal data |
| `13-testing.md` | Tests, fixtures, end-to-end scenario, screen checks |
| `14-operations.md` | Reconciliation, monitoring, replay, runbook |
| `15-build-plan.md` | Phases, definition of done, one prompt per phase |
| `16-sales-cycle-screen.md` | CRM › Sales cycle screen (reference mock-up: `reference/sales-cycle-v6.html`) |
| `17-claude-connector.md` | LNP connector for Claude (remote MCP server, OAuth, 8 read tools); setup: `setup-claude-connector.md` |
| `fixtures/` | Illustrative payloads — replace with captured real payloads in phase 0 |
| `architecture-one-page.html` / `.pdf` | One-page diagram (French) |
| `SKL-CRM-Implementation-stack-technique-v1.1.docx` | Business document for Romain (French); this pack takes precedence on technical points |

## Ground rules for Claude Code

1. Read `CLAUDE.md` and the functional specification first. Never edit generated `.dc.html` files;
   run `./build.sh` (including `web/build_web.py`) after every change.
2. One phase per branch from `main`, one pull request per phase, never merge without Romain's
   approval. Vercel deploys `main` automatically.
3. **VERIFY** = a third-party fact to check against live documentation or a captured payload.
4. **DEFERRED** = a business rule Romain decides later: build the mechanism, read the values from
   configuration, never hard-code them.
5. Secrets never go in the front end, the repository or logs. Vercel keeps its existing variables;
   CRM secrets are Supabase function secrets.
6. UI text in English (the CRM keeps its own English/French switch). Never write "closer": always
   "sales" / "sales rep". The company is ALKIMIY. Every delete asks for confirmation. Designed at 1440 px.
7. All timestamps in UTC (`timestamptz`); durations in **calendar hours**. Use the OS clock
   (`window.SKL_TODAY` can pin it in tests).
8. Every phase updates the matching sections of the functional specification (3, 9.3, 11, 12, 13, 14).
