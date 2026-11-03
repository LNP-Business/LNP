# 15 — Build plan

One phase per branch from `main`, one pull request per phase, never merged without Romain's
approval (Vercel deploys `main`). Each phase ends with: `./build.sh` passes, every screen opens
with no console error, tests green, functional specification updated. Phases 0–6 are the **core**:
at the end of phase 6 every cycle is traced from booking to won / lost / disqualified.

| Phase | Branch | Content | Definition of done |
|---|---|---|---|
| 0 | `crm-0-capture` | Supabase `supabase/` workdir, `crm_webhook_log` only, the 4 ingestion functions storing raw rows, providers pointed at them (project `LNP`, test people only: D13), real payloads captured into `fixtures/`, automation inventory (Q5), answers to Q8–Q10 | One real payload per event type; inventory and answers written in `00-decisions.md` |
| 1 | `crm-1-schema` | `web/supabase/003_crm_core.sql` (link `crm_members` to `members`), RPC skeletons with role checks + audit, `skl-os/crm/data.js` on the existing client, export / import of browser CRM data, merge c1–c18 into `config/alerts` | Valentino sees only his cycles, Romain and Amin see all; import dry-run matches the browser data; build and demo still work |
| 2 | `crm-2-iclosed` | normalize, match, process-inbox, projector, iClosed mapper and Zaps, history import, CRM › Sales cycle on real data | 20 bookings / reschedules / cancels in < 2 min, right cycle, no duplicate; replay safe; late events reorder |
| 3 | `crm-3-outcome` | Outcome form + `crm_declare_outcome`, lead record tabs, Pipeline / Leads on cycles, Unmatched screen | A full cycle runs from booking to yes / no / disqualified in the CRM only |
| 4 | `crm-4-fathom` | Fathom webhook, verifier, mapper, call matching, consistency checks (c11, not-recorded flag) | ≥ 95 % of held calls matched automatically; each mismatch case alerts |
| 5 | `crm-5-whop` | Checkout per cycle, Whop verifier and mapper, sold vs collected, c7–c10 | Sandbox: failed then paid → c8 then won; refund corrects collected cash |
| 6 | `crm-6-rules` | `rules-tick`, c1–c6 and c12–c18 instances, store.js merge into the alert engine, Settings › Alerts "Sales (CRM)" group, auto-close with notice and cancel, reconciliation, source silence, Reliability and Settings › Sales rules screens | CRM alerts appear in Needs you with Take it / Snooze / Handled / escalation working; each rule tested; 7 clean reconciliation nights |
| 7 | `crm-7-sendblue` | Sendblue inbound, `sendblue-send`, auto vs sales tagging, attempts, STOP, warming steps, rebuild inventoried automations (Lead follow-ups agent, approval in Agent System › Decisions), then switch old ones off | Test messages land in < 2 min; reply times match a manual check; STOP blocks sending |
| 8 | `crm-8-nurture` | Nurture tracks, cadence, c15, reactivation, archive; sending flag off until legal sign-off | lost → nurture → reply → new linked cycle with no manual action |
| 9 | `crm-9-insights` | Post-call analyst (Claude) with `crm_agent_runs`, analysis tabs, `crm_kpi_*` views, Cockpit › Sales live | Analyses pass the evidence validator; KPIs match a manual count over one week; Agent System Log shows real runs |
| 10 | — | Pilot with Valentino, fixes, one-page user guide, Vercel plan checked (Q7) | No lost event, clean reconciliation, Valentino no longer opens iClosed / Fathom / Sendblue / Whop to know where a lead stands |

## Prompts for Claude Code

Every prompt assumes `docs/crm/` and `web/supabase/003_crm_core.sql` are in the repository.
Add to each: *"Follow CLAUDE.md and the LNP functional specification. Run ./build.sh, open every
screen with no console error, update the functional specification sections you touched. Open a
PR; do not merge."*

### Phase 0
```
Read docs/crm README, 00, 01, 04, 05-08, 13. Branch "crm-0-capture".
Create the supabase/ CLI workdir for Edge Functions only, and a minimal SQL file
web/supabase/003a_crm_webhook_log.sql with crm_webhook_log as defined in 003_crm_core.sql.
Implement the four ingestion functions (iclosed-in, fathom-in, sendblue-in, whop-in) per 04 §1:
raw body stored, cheap auth check, 200 fast, nothing else. Write docs/crm/setup.md telling Romain
exactly what to paste in Zapier, Fathom, Sendblue and Whop. Add a script that exports captured
rows as anonymised fixtures. Read web/supabase/001_init.sql and record the members table columns,
the Supabase region and the pending web settings in 00-decisions.md (Q8-Q10).
```

### Phase 1
```
Read docs/crm 00-03, 10 §2, 11, 12. Branch "crm-1-schema". Apply web/supabase/003_crm_core.sql
(fold 003a into it). Link crm_members to the existing members table using the columns found in
phase 0, with member_key = the LNP member id and lead_id per the existing lead rule (Valentino ->
Romain, Romain -> Amin). Implement the RPCs of 02 §5 as security-definer functions with role and
ownership checks and crm_audit_log. Add skl-os/crm/data.js on the Supabase client already opened
by web/public/skl-web.js, with a demo-mode fallback. Add "Export my CRM data" to the current CRM
and an admin import with dry run (11 §3). Merge crm_settings.alert_rule_defaults into the docs row
config/alerts without touching a1-a18.
```

### Phase 2
```
Read docs/crm 03, 04, 05, 10 §1. Branch "crm-2-iclosed". Implement _shared normalize, match,
projector, mappers/iclosed and process-inbox (trigger + retry cron) against the captured fixtures.
The projector is deterministic and sorts by occurred_at. Add the iClosed history import. Wire
CRM › Sales cycle (mock-up v4) to real cycles, crm_stage_definitions and crm_events. Tests per 13.
```

### Phase 3
```
Read docs/crm 02 §5, 11 §4. Branch "crm-3-outcome". Build the outcome form and
crm_declare_outcome (supersede, events, projector), the lead record tabs, Pipeline / Leads on
cycles (R1, R2 = call ranks; no status change by drag), and the Unmatched screen. Reasons from
crm_reason_codes. Confirmation popup before every delete or dismiss.
```

### Phase 4
```
Read docs/crm 06. Branch "crm-4-fathom". Verify Fathom's signature scheme against its docs and a
captured request; implement verifier, mapper, call matching, consistency checks (c11 and the
not_recorded flag) and the Fathom part of reconcile.
```

### Phase 5
```
Read docs/crm 08. Branch "crm-5-whop". Implement whop-checkout (metadata skl_cycle_id), the
Standard Webhooks verifier, mapper, payments upsert, won at the first succeeded payment, sold vs
collected, alerts c7-c10, and the Whop part of reconcile. Test in the Whop sandbox.
```

### Phase 6
```
Read docs/crm 10, 14. Branch "crm-6-rules". Implement rules-tick with the evaluator registry,
crm_alerts instances for c1-c6 and c12-c18 (dedupe, auto-resolve), the store.js merge so CRM alerts
live in the existing engine (inbox life, escalation, quiet hours, digest), the "Sales (CRM)" group
in Settings › Alerts, auto-close with notice (c14) and crm_cancel_auto_close, reconcile and source
silence, and the Reliability and Settings › Sales rules screens. All values from configuration.
```

### Phase 7
```
Read docs/crm 07, 10 §3. Branch "crm-7-sendblue". Implement sendblue-in, auto vs sales tagging
through crm_outbound_messages, touches and attempts, STOP, warming steps, sendblue-send with
retries and the approval flow (pending_approval -> Agent System › Decisions). Rebuild the
inventoried automations behind a flag, then switch the old ones off with Romain.
```

### Phase 8
```
Read docs/crm 10 §5. Branch "crm-8-nurture". Implement nurture-tick, entry from the outcome form,
c15 return alerts, reactivation into a new linked cycle, archive after the configured days.
Keep crm_settings.nurture_sending_enabled = false.
```

### Phase 9
```
Read docs/crm 09, 11 §5. Branch "crm-9-insights". Implement claude-analyze as the Agent System
"Post-call analyst" (crm_agent_runs, versioned prompt, JSON schema, no claim without evidence),
the analysis tabs, the crm_kpi_* views (security_invoker) and Cockpit › Sales on live data.
Point Agent System Log and Decisions at the real CRM agent runs.
```
