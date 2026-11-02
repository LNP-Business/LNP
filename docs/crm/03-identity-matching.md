# 03 — Identity and matching

Wrong matching is the main way this system can lie. Follow these rules exactly.

## 1. Normalisation (`_shared/normalize.ts`)

| Kind | Rule | Example |
|---|---|---|
| email | trim, lowercase, remove surrounding `<>`; reject if no `@` | `" Jane.Doe@Mail.com "` → `jane.doe@mail.com` |
| phone | keep digits and leading `+`; `00` prefix → `+`; must start with `+` and have 8–15 digits (E.164). A number without country code is **not** guessed: it goes to the unmatched inbox | `"06 12 34 56 78"` → rejected; `"+33 6 12 34 56 78"` → `+33612345678` |
| provider ids | as given, trimmed | |

Use `libphonenumber-js` (pin an exact version) for phone parsing; do not write a custom parser.

## 2. Lookup order (`_shared/match.ts`)

For every incoming event, find the **person**:

1. Provider identifier already known (`iclosed_contact_id`, `whop_user_id`, `whop_member_id`).
2. Phone (normalised).
3. Email (normalised).
4. Fathom only: email of a calendar invitee with `is_external = true` and not in the team domains
   (`crm_settings.team_email_domains`) nor in `crm_members.email / fathom_email`.
5. Whop only: `metadata.cycle_id` of the checkout (see 08) takes precedence over 1–3.

Results:

- **Exactly one person** → use it; add any new identifiers to `crm_person_identities`.
- **Several people** (e.g. phone points to A, email to B) → do not guess: unmatched inbox with
  `candidate_person_ids`.
- **None** → only `call_booked` may create a person. Everything else goes to the unmatched inbox.

## 3. Finding the cycle

| Event | Cycle |
|---|---|
| `call_booked` | The person's `active` cycle if any (add a call, next `rank`); otherwise open a new cycle (see §4) |
| `call_rescheduled`, `call_canceled` | The cycle of the call with that `iclosed_call_id`; if unknown, treat a reschedule as a booking and log a warning |
| `call_recorded` | The call whose `scheduled_start` is within ±90 min of `recording_start` for that person (VERIFY window on real data); else the active cycle; else unmatched |
| Sendblue messages and calls | The person's active cycle; if none, attach to the person only (`cycle_id = null`) — this still counts as a nurture signal |
| Whop payment | `metadata.cycle_id`; else the person's cycle in `cash` stage; else the most recent cycle with a `yes`; else unmatched |

## 4. Opening a cycle

When `call_booked` arrives for a person with no active cycle:

- If the person's last cycle is `lost`, closed **less than 30 days ago**, and the person is not in
  nurture → **reopen** that cycle (`status = active`, event `cycle_reopened`). The 30-day value is
  `crm_rules.next_move.params.reopen_days` (DEFERRED, default 30).
- If the person has an `active` nurture track → close it as `reactivated` and open a new cycle
  with `origin = 'nurture'` and `previous_cycle_id` = the nurture's origin cycle.
- If the last cycle was `disqualified` → open a new cycle and show the previous disqualification
  reason on the new cycle and in the alert detail of c1 (no separate alert).
- Otherwise → new cycle, `origin = 'new'`.

`opened_at` is the booking's `occurred_at`. `owner_id` is the team member whose `iclosed_email`
matches the host of the call (VERIFY field name in the Zapier payload); otherwise the sales lead.

## 5. Unmatched inbox

Every unmatched item stores the raw `crm_webhook_log` id, a human summary (name, email, phone,
amount, time) and candidates. Resolving it (`crm_resolve_unmatched`) adds the identifier to
`crm_person_identities` and re-runs `process-inbox` for that row, so the event is written exactly as if
it had matched the first time.

## 6. Merging people

`crm_merge_people(keep, merge)` moves identities, cycles, events, nurture tracks and outbound
messages from `merge` to `keep`, sets `crm_people.merged_into`, recomputes every affected cycle, and
writes `crm_audit_log`. If both people have an active cycle, the merge is refused until one is closed.
