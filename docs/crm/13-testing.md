# 13 — Testing

## 1. Unit tests (Deno, `supabase/tests`)

| Module | Cases |
|---|---|
| `normalize.ts` | emails (case, spaces, brackets), phones (+33, 0033, spaces, missing country code → rejected) |
| `verify/standard-webhooks.ts` | valid signature, wrong secret, altered body, multiple signatures, timestamp too old / in future |
| `verify/token.ts` | constant-time compare, missing header |
| `mappers/*` | each fixture in `docs/crm/fixtures` → expected canonical items (snapshot) |
| `match.ts` | one match, none, several candidates, Fathom internal-only meeting, Whop metadata first |
| `projector.ts` | stage progression; no-show loop; R2 in the same cycle; late event re-ordered; won at first payment; lost / disqualified; reopen within 30 days; nurture reactivation |
| `rules.ts` | each evaluator with params from the seed: open, resolve, notice then close, cancel |

## 2. Integration tests (local Supabase)

`supabase start`, apply migrations, then POST every fixture to the local functions and assert the
resulting rows. Run twice to prove idempotency.

## 3. Captured payloads (phase 0)

Before writing mappers, capture **real** payloads: deploy the four ingestion functions first
(they only store raw rows), trigger one of each event with test data, export the rows, replace
personal data, and save them as `fixtures/<source>-<event>.json`. The illustrative fixtures in
this pack are only a starting point and are marked `"_illustrative": true`.

## 4. End-to-end scenario (staging, with a team member as test prospect)

| # | Action | Expected |
|---|---|---|
| 1 | Book R1 in iClosed | person + cycle, stage Show, call scheduled |
| 2 | Prospect texts, sales replies via Sendblue | `message_in`, `message_out` (sales), reply time computed |
| 3 | Reschedule in iClosed | call time updated |
| 4 | Let the call time pass without outcome | alert c1 in My Day › Needs you |
| 5 | Declare no-show | `no_show` count 1, still Show, next move "re-engage" |
| 6 | Book again, hold the call with Fathom recording | `call_recorded`, outcome held → Decision, analysis queued |
| 7 | Declare follow-up, book R2 | R2 in the same cycle |
| 8 | Declare yes, create the checkout | deal, purchase URL with metadata |
| 9 | Pay in Whop sandbox with a failed card, then a valid one | alert c8, then won |
| 10 | Refund in sandbox | collected cash corrected, alert |
| 11 | Second test person: declare no · timing · nurture | lost, nurture active |
| 12 | Prospect replies | nurture reactivated, new cycle (origin nurture) |
| 13 | Third test person: simulate 30 days silence with 4 attempts on 3 days | notice, then lost · unreachable |
| 14 | Fourth: 30 days silence with 2 attempts | alert c13, not lost |
| 15 | Send the same webhook twice; send a forged signature | one event; rejected row |
| 16 | Disable the booking Zap, book a call, run reconciliation | gap reported and fixed |

Time travel for 13–14: rules accept an injectable `now` in tests; in staging, use an admin-only
`crm_test_shift_time(cycle_id, hours)` that shifts that cycle's event times (disabled in prod).

## 5. App checks (every phase)

- `./build.sh` (including `web/build_web.py`) passes.
- Every screen of the functional specification §13 opens with no console error.
- Scenario tests with the date pinned (`window.LNP_TODAY`).
- The plain-file demo still runs on sample data and saves nothing.
- CRM alerts: a c-rule instance appears in My Day › Needs you of the right person; Take it,
  Reassign, Snooze 1 day, Make it a decision and Handled work; a High alert left open 24 h escalates
  to the lead (Valentino → Romain); it disappears when the data behind it is fixed.
- A sales signed in as Valentino cannot read another owner's cycle even through the API (RLS).
