# 06 — Fathom (recordings)

Fathom gives the **evidence and content** of a call: that it was recorded, its duration,
transcript, summary and action items. Since 2026-10-29 it is also **the source of truth of the sales calls** (§0):
a booked call can be canceled or moved, a recording shows the call happened. It never closes a cycle: the outcome is
still declared by the sales.

## 0. Rules FL-1 to FL-6: every sales recording is linked to a lead (Romain, 2026-10-29)

Romain: "100 % of the Fathom calls that are sales calls, recorded by Valentino, are linked to a lead. A Fathom call
with no link to an existing lead is probably a professional call, not a sales call. The source of truth of the calls
is Fathom, not iClosed, because booked calls can be canceled or rescheduled. Several Fathom calls with one lead = R1 +
R2, or more."

Measured on Valentino's 51 recordings of 1 September to 28 October 2026 (Fathom connector): about 30 are titled
"Design Career Roadmap Call" with **no calendar invitee** (Zoom personal link), so an email alone cannot link them;
one of them (27 Oct) is a lead booked in iClosed at that time, whose Zoom name (a short first name) differs from the CRM's full name.
Hence the three ways of FL-2, tried in order.

| Rule | What it says | Where |
|---|---|---|
| FL-1 · Sales recorder | A recording is a candidate sales call when its recorder is a sales rep of `crm_sales_team` (by CRM member key, or by the local part of the email, as 019). Any other recorder (onboarding by the success team, team meetings) → `not_sales_recorder`. | `crm_fathom_sales_recorder` |
| FL-2 · Which lead | The first way that gives exactly one person decides: **(a) email**: an external invitee's email or a speaker's matched email, never a team member's; **(b) booking**: the person whose call hosted by the recorder (iClosed host email) was booked within ±`fathom_match_minutes` (90, §5) of the recording start, not canceled, not linked to another recording; **(c) name**: an invitee, speaker or title name of two words or more equal to the person's full name (case, accents kept, punctuation and spaces ignored). Several people → `ambiguous` (review, `crm_unmatched_inbox` for webhooks). | `crm_fathom_person` |
| FL-3 · No lead | No lead found → `not_sales`: a professional call, not a sales call. Kept in `crm_fathom_recordings` (title, date, link) for review; never creates a person. | `crm_fathom_recordings` |
| FL-4 · A held call | A linked recording is a held call of its lead: it fills the booked call it matches (FL-2 b window, a canceled booking last), else it becomes a new call of the cycle open at that time (one is opened for a lead with none). Recording, transcript, summary and the `call_recorded` event go on it. | `crm_apply_recording_item` |
| FL-5 · R1, R2… | In a cycle with sales recordings, R1, R2, R3… are its recordings in time order; any other call (booked, canceled, no-show, onboarding) carries the number of the next sales call to come (a canceled R2 and the held R2 share "R2"). A cycle with no recording keeps its booking numbers. The call analysis takes R1 and R2 from this order (`crm_ca_call_info`). | `crm_rank_calls`, trigger on `crm_calls` |
| FL-6 · Outcome and analysis | A recorded call asks for its outcome ("Declare the call outcome") until one is declared. Its transcript goes to the call analysis when it is R1 or R2, the speakers are known (recorder = Sales, the lead by email or name = Prospect, else the only other speaker) and it came by the hourly import (or a webhook); a history import never queues an analysis (cost). A transcript added by hand is never replaced. | `crm_apply_recordings`, `crm_recompute_cycle` |

The 100 % is checked on `crm_fathom_recordings`: every row of a sales recorder is `linked`, or `not_sales` with a title
that is not a sales call (training, one-to-one, team meeting). A `not_sales` row that is a sales call shows what to add
(the lead's email, or its booking); an `ambiguous` row is decided by hand.

Paths (Romain 2026-10-29: no webhook, the API key already in Supabase is read every hour): job `crm-fathom-hourly`
(006, minute 23) → `crm-import ?source=fathom&queue=1` (the last two days, `importers/fathom.ts`) → `crm_import_recordings`
with the R1 / R2 analyses queued; a call is in the CRM at most an hour after it ends. History: `crm-import
?source=fathom&since=YYYY-MM-DD[&until=][&dry=1]`, no analysis queued. A webhook, if one is ever added, goes `fathom-in` →
`process-inbox` (`mappers/fathom.ts`) → `crm_apply_recordings`; same `source_id`, nothing counted twice.

## 0b. No Fathom recording = no-show on R1 (Romain, 2026-10-31)

> "Si il n'y a pas de fathom record d'un appel effectué qui dure plus de 7 minutes pour un lead, alors le lead est un no show.
> Un no show que pour les R1. Si un lead a déjà effectué un call complet et qu'il est no show sur R2, il reste en R2 avec comme
> action de planifier un reschedule."

- A call is **complete** with a Fathom recording of 7 minutes or more, or a transcript added by hand. Only complete calls take a
  new number (R1, R2…).
- A past call with no complete recording, no declared outcome, in a cycle not won: before any complete call it is a **no-show**
  (R1); after one it is **missed** (R2, R3…): the lead stays in its round, next move "Plan a reschedule".
- Read only from `no_show_rule.since` (the date the Fathom history import starts), 3 hours after the call's end; the hourly job
  runs once `no_show_rule.enabled` is true. A recording that comes later wins (the call is held again).
- `web/supabase/030_crm_no_show_rule.sql`, test `web/supabase/tests/no_show_rule_test.sql`.

## 0c. La règle d'absence à partir du 27/10/2026 (Romain, 2026-11-11, migration 056)

> « La règle d'absence, c'est de ne pas venir au R2 ou de ne pas répondre aux messages WhatsApp. Le R1 dans iClosed est
> représenté par R2 dans le CRM LNP. »

- L'appel de setting (15 min, par le setter) n'est pas un RDV iClosed : la règle ne le lit jamais. Le setter et le commercial
  déclarent son issue dans le CRM.
- RDV iClosed avec un enregistrement Fathom de 30 min ou plus : honoré automatiquement ; l'issue (R3, perdu, vendu…) reste à
  déclarer par le commercial (« Déclarer l'issue de l'appel »).
- RDV iClosed sans aucun enregistrement, sans présence donnée (ni dans le CRM, ni dans iClosed), 3 h après la fin : absent (le
  premier RDV du cycle) ou manqué (un RDV suivant : « Replanifier l'appel »).
- Enregistrement court, ou RDV déjà donné « honoré » par iClosed : la règle ne fait rien, le commercial tranche dans le CRM.
- `no_show_rule` : `since` = 27/10/2026 (heure de Paris), `min_minutes` = 30, `enabled` = true.
- Une fois : les leads encore ouverts, ouverts avant le 27/10, sans RDV depuis et sans paiement, passent en perdu (motif « Pas
  le bon moment ») et en suivi long terme (`crm_close_before`). Les leads vendus ne bougent pas.
- Pas encore : l'absence de réponse aux messages WhatsApp (WhatsApp n'est pas branché, migration 052).
- Test `web/supabase/tests/regle_absence_test.sql`.

## 0c. Back-to-back calls: the closest booking (2026-10-31)

Valentino's calls follow each other every 30 to 60 minutes, so FL-2 (b) often finds two or three bookings within ±90 min of a
recording. The recording goes to the person whose call starts closest, when it starts within 15 minutes of the recording and no
other candidate's does (`fathom_close_minutes`, rule `booking_closest`). A real tie (two leads booked on the same slot) stays
ambiguous, and the no-show rule (§0b) never marks the candidates' calls as no-shows while that recording is unresolved.
`web/supabase/032_crm_fathom_closest.sql`, test `web/supabase/tests/fathom_closest_test.sql`.

## 1. API basics

- Base URL: `https://api.fathom.ai/external/v1`
- Auth header: `X-Api-Key: <FATHOM_API_KEY>`
- `GET /meetings` with filters `created_after`, `created_before`, `cursor`,
  `calendar_invitees_domains_type=one_or_more_external`, `recorded_by[]`, and
  `include_transcript`, `include_summary`, `include_action_items` (booleans).
- `POST /webhooks` with `destination_url`, `triggered_for` (array of `my_recordings`,
  `shared_external_recordings`, `my_shared_with_team_recordings`, `shared_team_recordings`), and
  at least one `include_*` flag set to true.

Meeting fields used: `recording_id`, `title`, `url`, `share_url`, `created_at`,
`scheduled_start_time`, `recording_start_time`, `recording_end_time`,
`calendar_invitees[] {name, email, email_domain, is_external}`, `recorded_by {name, email}`,
`transcript[] {speaker {display_name, matched_calendar_invitee_email}, text, timestamp}`,
`default_summary {markdown_formatted}`, `action_items[]`.

**VERIFY** (Q2): API access on the plan of each sales; whether the webhook payload has the same
shape as a meeting from `GET /meetings`.

## 2. Webhook set-up

Create one webhook per recording team member's API key (or one with `shared_team_recordings` if
the team set-up allows it — VERIFY):

```json
POST /webhooks
{ "destination_url": "https://<project>.functions.supabase.co/fathom-in",
  "triggered_for": ["my_recordings"],
  "include_transcript": true, "include_summary": true, "include_action_items": true }
```

Store the returned webhook secret as `FATHOM_WEBHOOK_SECRET` (one per webhook if several:
`FATHOM_WEBHOOK_SECRETS` as a JSON map id → secret).

## 3. Verification

Requests carry `webhook-id`, `webhook-timestamp` and `webhook-signature`. Verify with the secret
and reject when the timestamp is more than 5 minutes away from now. These are the Standard
Webhooks header names: try the shared `verify/standard-webhooks.ts` first; **VERIFY** against
Fathom's webhook documentation that the signed content and encoding are identical, and add a
Fathom-specific verifier if not. `delivery_id` = `webhook-id`.

## 4. Mapping (`mappers/fathom.ts`)

One canonical item per meeting:

| Field | Value |
|---|---|
| type | `call_recorded` |
| source_id | `fathom:recorded:<recording_id>` |
| occurred_at | `recording_start_time` (fallback `created_at`) |
| actor / channel | `sales` / `video` |
| identity | external invitees (`is_external = true`, not a team domain or team email) |
| refs | `fathom_recording_id`, `member_email = recorded_by.email` |
| data | duration (end − start), `url`, `share_url`, `title`, summary markdown, transcript, action items |

Entity changes: set on the matched `crm_calls` row `fathom_recording_id`, `recording_start/end`,
`recording_url`, `share_url`, `summary_md`, `transcript`. Then queue `claude-analyze` (09).

## 5. Matching to a call

Superseded by §0 (FL-2, FL-4) since 2026-10-29; kept for the record.

1. Person by external invitee email (03).
2. Call of that person whose `scheduled_start` is within ±90 minutes of `recording_start_time`
   (VERIFY window on real data), not already linked to another recording.
3. No call found but an active cycle exists → attach to the cycle, flag `fathom_unplanned` (the
   sales recorded a call that was not booked in iClosed: breach of team rule 2).
4. Nothing → unmatched inbox.

Internal meetings (no external invitee) are `ignored`.

## 6. Consistency checks (alert c11 and the `not_recorded` flag)

| Situation | Check time | Alert |
|---|---|---|
| Call scheduled, now > `scheduled_end + 2 h`, no recording, no outcome | rules tick | outcome form suggests "No-show?" |
| Recording exists, outcome = `no_show` | on outcome or on recording | mismatch alert |
| Outcome = `held`, no recording 6 h after `scheduled_end` | rules tick | call marked "not recorded", counted in discipline KPI |

## 7. Reconciliation

Nightly: `GET /meetings?created_after=<yesterday 00:00>&created_before=<today 00:00>&calendar_invitees_domains_type=one_or_more_external`
(paginate with `cursor`), compare `recording_id`s with `crm_calls.fathom_recording_id`, and feed
missing ones through the normal mapper (same `source_id`, so no duplicates).
