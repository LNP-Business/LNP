# 10 — CRM rules and alerts

Romain will decide later the details of stages, alerts and how each element of a lead is
structured. **Build the mechanisms, not the values.** Values come from configuration; seeds are
proposals.

Two families:

| Family | Stored | Evaluated | Effect |
|---|---|---|---|
| **CRM rules** (stages, auto-close, flags, next move, nurture, warming) | `crm_stage_definitions`, `crm_rules`, `crm_reason_codes`, `crm_settings` | server (`rules-tick`, projector, `nurture-tick`) | change derived state, write events |
| **CRM alerts** c1–c18 | definitions in the existing `docs` row `config/alerts`; instances in `crm_alerts` | server computes instances; the **existing alert engine** in `store.js` shows and manages them | My Day › Needs you, Cockpit, Team board triage |

## 1. Stages (`crm_stage_definitions`)

- A stage is entered when an event whose type is in `enter_on` occurs (projector, 04 §3).
- `target_hours` / `critical_hours` feed alerts c5 / c6 and the Sales cycle screen (ghost bands,
  overrun hatching, colours).
- Changing stages is a config change followed by `recompute_all()`; events are never deleted.

## 2. CRM alerts: one engine, rules c1–c18

LNP already has one alert engine (functional spec §4): rules a1–a18 in `config/alerts`, edited
in Settings › Alerts (toggle, threshold, severity Low / Medium / High / Critical, who is notified:
owner, department lead, Romain; channels; quiet hours; daily digest; escalation delay 24 h), the
life of each alert in the `inbox` collection (open → taken, reassigned, snoozed, turned into a
decision, handled; it leaves for good when the data behind it is fixed), Critical and High
escalating to the owner's lead after 24 h, and display in My Day › Needs you.

CRM alerts **join this engine**:

1. **Definitions.** On first deploy, merge `crm_settings.alert_rule_defaults` (c1–c18) into the
   `config/alerts` document without touching a1–a18. Settings › Alerts lists them in a "Sales (CRM)"
   group with the same controls. The server reads `config/alerts` (service role) at each tick and
   falls back to the defaults for missing keys.
2. **Instances.** `rules-tick` evaluates each enabled c-rule for each active cycle (and operational
   rules globally) and upserts `crm_alerts` (one open row per `dedupe_key`), or sets `resolved_at`
   when the condition is gone — "it leaves for good when the data behind it is fixed".
3. **Display and life.** `store.js` reads the signed-in person's open `crm_alerts` (RLS) and
   Realtime changes, maps each to the engine's alert shape
   (`id = 'crm:' + id`, rule, severity, owner = `owner_key`, title, detail, link to the lead record)
   and adds them to the same list as a1–a18. Life state (taken, reassigned, snoozed, decision,
   handled, escalation) is stored, as today, in `inbox` documents keyed by that id. Nothing new in
   My Day: CRM alerts appear in "Needs you" like any other.
4. **Recipients.** `owner` = the cycle owner's `member_key`; `lead` = their `crm_members.lead_id`
   (Valentino → Romain, Romain → Amin); `romain` = the member `romain`. Escalation uses the existing
   lead rule.
5. **Quiet hours, digest, channels**: the existing delivery rules apply unchanged. Only in-app
   delivery exists today; Slack/email stay settings until a sender is built (outside this scope).

| Id | Alert | Default severity | Condition (thresholds DEFERRED) |
|---|---|---|---|
| c1 | Call outcome missing | High | call ended, not cancelled, no current outcome |
| c2 | Prospect waiting for a reply | High | last touch is a prospect message, no sales touch since `hours` |
| c3 | Follow-up due | Medium | last touch from sales, prospect silent `silence_hours` |
| c4 | Call to rebook | Medium | last call cancelled, no future call, `hours` |
| c5 | Stage over target | Medium | hours in stage > `target_hours` |
| c6 | Stage critical | Critical | hours in stage > `critical_hours` |
| c7 | Yes without payment | Critical | yes declared, no succeeded payment after `hours` |
| c8 | Payment blocked | Critical | Whop failed / requires action |
| c9 | Refund or dispute | Critical | Whop refund / dispute |
| c10 | Payment without a declared yes | Medium | payment on a cycle with no yes |
| c11 | Recording and outcome disagree | Medium | 06 §6 |
| c12 | Message not delivered | High | WhatsApp delivery error (status `failed`) |
| c13 | Lead abandoned | High | 30 days silent with fewer than 4 sales attempts (no automatic loss) |
| c14 | Automatic loss tomorrow | Medium | notice before an auto-close |
| c15 | Nurture return due | Medium | return date reached |
| c16 | Unmatched items waiting | Low | unmatched inbox not empty after `after_hours` |
| c17 | A source went silent | Critical | 14 §3 |
| c18 | Reconciliation gap | Critical | 14 §2 |

## 3. CRM rules (`crm_rules`)

| Key | Kind | Logic |
|---|---|---|
| `auto_lost_unreachable` | auto_close | no prospect touch for `silence_days` and sales attempts ≥ `min_attempts` on ≥ `min_distinct_days` days → alert c14 `notice_hours` before, then `cycle_lost` event, reason `unreachable` (decided: 30 days, 4 attempts) |
| `unpaid_yes` | auto_close | yes without payment for `close_days` → lost, reason `unpaid` |
| `not_recorded` | auto_flag | held call without recording after `after_hours` → flag on the call |
| `next_move` | next_move | ordered checks → `crm_cycles.next_move {who, code, label, due_at}`: outcome missing → future call → reply due → rebook → unpaid yes → follow up → waiting on prospect |
| `nurture_cadence` | nurture | see §5 |
| `warming_steps` | warming | the current CRM's warming steps (D-3, D-1, day of) per scheduled call: shown as checklist items on the call; done when a sales message falls in the window; optional automated message through the Lead follow-ups agent (DEFERRED) |

Every automatic close can be cancelled by the owner or the lead (`crm_cancel_auto_close`), which
suppresses the rule for that cycle for `snooze_days` and is audited.

### Evaluator contract (`_shared/rules.ts`)

```ts
type RuleContext = {
  now: Date; cycle: Cycle; person: Person; owner?: CrmMember;
  events: Event[]; calls: Call[]; outcome?: CallOutcome; deal?: Deal; payments: Payment[];
  stages: StageDefinition[]; config: { alerts: AlertConfig; rules: Record<string, any>; settings: Record<string, any> };
};
type RuleResult =
  | { action: 'none' }
  | { action: 'open_alert'; rule: string; dedupe: string; severity: 'low'|'medium'|'high'|'critical';
      owner_key: string; title: string; detail?: string; link?: string }
  | { action: 'resolve_alert'; dedupe: string; resolution: string }
  | { action: 'notice'; closeAt: Date; reason: string }
  | { action: 'close'; status: 'lost'; reason: string }
  | { action: 'flag'; key: string }
  | { action: 'next_move'; who: 'sales'|'prospect'|'none'; code: string; label: string; due_at?: Date };
const evaluators: Record<string, (ctx: RuleContext, params: any) => RuleResult[]>;
```

A rule key or alert id without an evaluator is reported once to the admin and skipped. New rule =
evaluator + configuration row.

## 4. Who decides

Only the outcome form, Whop payments and the configured auto-close rules change a status. Alerts
never change data. Agents (Claude, Lead follow-ups) only propose (09, 07 §4).

## 5. Nurture (`nurture-tick`)

- Entry: outcome `no` with `nurture != 'none'` → `crm_nurture_tracks(active)`, `nurture_entered` event.
- Messages: at `next_message_at`, the **Lead follow-ups** agent proposes a `crm_outbound_messages`
  row (`purpose = 'nurture'`, `status = 'pending_approval'`) from `crm_settings.nurture_templates`
  (DEFERRED). It is sent only once approved in Agent System › Decisions, or automatically once the
  agent's autonomy level allows it (F10). Never for opted-out people. Sending stays disabled
  (`crm_settings.nurture_sending_enabled = false`) until legal sign-off (Q6).
- Return date reached → alert c15 for the owner, with the previous cycle summary in the detail.
- Any prospect touch or booking → `reactivated` + new cycle (03 §4).
- No signal for `archive_after_days` (decided: 6 months) → `archived`.
