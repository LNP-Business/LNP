# Call analysis · integration plan

Status: plan approved by Romain on 2026-10-25 (PR #54). Phase 1 merged; phase 2 (data and worker) in its PR.
Goal (Romain): as soon as a sales call is done, its analysis opens from the CRM **pipeline**, the **lead list**, and
**Sales cycle** when the call is selected in the cycle.

## 0. Decisions (Romain, 2026-10-25)

| # | Decision |
|---|---|
| Q1 | Tiers: `fast` = `claude-haiku-5-5`, `strong` = `claude-sonnet-5-5`, `arbiter` = `claude-opus-5-5` (row `crm_ca_config`, editable without code) |
| Q2 | "There is already an Anthropic key". It is **not** in the Supabase function secrets (checked 2026-10-25: only `FATHOM_API_KEY` and `FATHOM_WEBHOOK_SECRET`); it must be added there as `ANTHROPIC_API_KEY`. The worker never holds it: it calls the Edge Function `callqa-llm`, which does. |
| Q3 | The methodology documents were sent: they are the memos already in `docs/memos/`. The Pitch memo itself says the content of the nine mechanisms is "to be provided": the offer reference stays empty (`crm_ca_offer`), Pitch runs with `offer_reference_missing` / `mechanism_reference_missing`. |
| Q4 | Left to Claude: the case library starts empty (`crm_ca_cases`, filled by admins later); no case is invented, Pitch step 4 = `case_library_missing`. |
| Q5 | Fathom: the API key and the webhook secret are already in the Supabase secrets → phase 4 can read the recordings. |
| Q6 | The 15 real transcripts go to the private Storage bucket `callqa-fixtures` (`transcripts.tar.gz`); CI downloads them with the service role. |
| Q7 | The analysis is read by CRM admins and by the sales rep who owns the cycle, on his own calls (`crm_ca_can_read`). |
| Q8 | Objection gestures: **A · I · E · M**. |
| Q9 | Sales calls R1 and R2 only, never onboarding or case-study calls (iClosed event name; `crm_ca_call_info`). |

## 1. What is in this repository today

| Topic | State |
|---|---|
| Engine | `call-analysis/engine/` (this package, Python 3.11+, stdlib only). The 205 tests pass locally with the fixtures (Python 3.13). |
| Fixtures | The 15 real transcripts in `engine/tests/fixtures/transcripts/` and the mock-up `docs/screen/` (real call 001) are **not committed**: the package's CLAUDE.md forbids transcripts with personal data in the repository. Without them, 157 tests pass, 20 fail and 5 are skipped (the Annex B cases). See question Q6. |
| Calls | `crm_calls` (iClosed bookings) already has `transcript`, `fathom_recording_id`, `recording_url`, `summary_md`. All are empty: no transcript has ever arrived. |
| Fathom | The `fathom-in` webhook stores raw rows only. Fathom has never sent a real call (one test row). There is no mapper yet: this is phase 4 of `docs/crm/06`. |
| Analysis table | `crm_call_analyses` (003) exists and is empty. Its v0 grid (`docs/crm/09`) is superseded by this engine. |
| Screens | Sales cycle already has a "Call analysis" dialog (`anHTML` in `gen_crm.py`). In the web edition it says "No analysis for this call yet". The CRM document (`crm_doc.html`) holds the board (pipeline) and the lead list. |
| Hosting | Vercel (Node functions, at most 800 s), Supabase (Postgres, Deno Edge Functions, at most 400 s) and GitHub Actions. |

## 2. Where the engine runs

One call needs about **700 model calls** (3 passes) before arbitration, so a Vercel or Edge function would time out.
**Choice: the Python reference engine, unchanged, run by a GitHub Actions worker.**

- `.github/workflows/call-analysis.yml`:
  - on every push touching `call-analysis/`: the 205 tests;
  - every 10 minutes, and on demand: `call-analysis/worker/run.py`, which claims the queued jobs and processes them.
  - A job may run up to 6 h, and a scheduled run with no queued job costs a few seconds.
- The worker reads and writes Supabase with the service role, through the functions `crm_ca_claim`, `crm_ca_store` and `crm_ca_fail`.
  Its model calls go through the Edge Function `callqa-llm`, which holds the model key.
- Secrets, set by Romain, never in the chat or the repository: one GitHub secret, `SUPABASE_SERVICE_ROLE_KEY`, and one Supabase
  function secret, `ANTHROPIC_API_KEY`. The project URL is not secret: it is written in the workflow.
- The schedule is every hour, at minute 7, which bounds GitHub Actions minutes on the private repository (about 720 a month),
  and on demand from Actions. A run with no queued job takes a few seconds.
- Model ids per tier come from a configuration row (`crm_ca_config`), not from code (Q1).
- **Speed.** The engine's runner is sequential. One change to `core/runner.py`: the three passes of a unit run in
  parallel threads.
  - This change touches no rule, no prompt and no decision; the 205 tests guard it.
  - It also adds prompt caching: the common rules plus the task's rules are sent with `cache_control`.
  - Expected: about 15 to 25 minutes per call (the architecture's target is within the hour).
  - Running the units of a stage in parallel is a later lever, and would change the competence modules.
- **Cost.** Not estimated in the package. The first real call measures it (tokens are stored per pass), and the
  figure is reported before anything is processed in volume.

## 3. Data (migration `020_crm_call_analysis.sql`)

| Table | Content | Row-level security |
|---|---|---|
| `crm_calls` (existing) | Add `transcript_raw`, `speaker_map jsonb`, `transcript_source` (`upload`, `fathom`), `timezone` | As today |
| `crm_ca_jobs` | One per analysis run: call, status (`queued`, `running`, `done`, `failed`), engine and rules versions, attempts, error, tokens, cost, times | Read like the call; written by the worker only |
| `crm_ca_turns` | Repaired turns of the latest run: id (`T050b`…), ts, role, speaker, text, repaired, doubtful | Read like the call |
| `crm_ca_results` | One row per call × competence: rules version, status, verdict, reasons, score, items with evidence, details JSON, concordance | Read like the call |
| `crm_ca_records` | The full call record (`result_record`): phases and flags. The screen reads it in one query. | Read like the call |
| `crm_ca_audit` | Every model pass, replay, arbitration (case label, justification) and human correction | Admins only |
| `crm_ca_offer` | Versioned offer reference: price, options, guarantees, components, phases, the nine mechanisms | Read: members; write: admins |
| `crm_ca_cases` | Case library: consent flag, starting point (value, unit, profile), figures | Read: members; write: admins |
| `crm_ca_config` | Model id per tier, passes, the "provisional" switch | Admins |

- "Read like the call" means: every cycle for admins, sales leads and viewers; their own cycles for a sales rep (as in 017).
- `crm_call_analyses` is dropped, because it is empty and has never been used.
- A new run never edits a stored score: a human correction is an audit row, then a re-score (C8).

## 4. Ingestion and job

1. **"Add transcript"** (phase 3, available first). Button in the analysis dialog of a past call.
   - Paste or drop a file: a Fathom export, the `[T001 00:06] SALES: …` format, or `Name (00:06): text`.
   - Then the **speaker mapping**: each label maps to Sales, Prospect or Other. The label matching the call's sales rep
     is prefilled; the others are asked when it is ambiguous.
   - RPC `crm_ca_add_transcript(call_id, raw, speaker_map)`: admins and the call's owner. It stores, queues the job
     and writes a `transcript_added` event.
2. **Fathom, automatic** (phase 4 of the CRM). Mapper `_shared/mappers/fathom.ts` in `process-inbox`, as `docs/crm/06` §4–5 specifies.
   - The call is matched by the external invitee's email and ±90 min of the booking.
   - The speaker map comes from the Fathom data: a speaker whose email belongs to a team member is Sales, an
     external invitee is Prospect, anyone else is Other. When it is unsure, the job waits for a human mapping.
   - It then queues the same job.
   - Fathom history: `crm-import ?source=fathom[&dry=1]` reads `GET /meetings` with transcripts, dry run first.
   - Needs: `FATHOM_API_KEY` and the webhook secret as Supabase secrets (Q5).
3. **Worker job.**
   - Claim with `for update skip locked`, then build the `CallContext`.
   - Metadata: round = call rank, cycle id, sales = owner or host, start UTC, the sales rep's time zone.
   - Inputs: the current offer reference and case library, and the prior calls of the cycle as `prior_inputs`.
   - Run `analyse_call` in the fixed order, store the record, results, turns and audit, write an `analysis_ready` event.
   - Retries: a model or network error retries the job twice, 10 minutes apart, then marks it `failed` with the error.
   - A crash in one competence already gives `to_review` for that competence only.

## 5. Screen (phase 4 of the handoff)

- **One renderer, three doors.**
  - `skl-os/crm/call_analysis.js` defines `window.SKL_CALL_ANALYSIS.render(el, record)`. It follows
    `docs/SCREEN_SPEC.md` with the app's tokens (Cockpit design system: Fraunces, IBM Plex, gold `#D9B46A`).
    - Header with four score tiles, the bottleneck mark, rules versions and the **"provisional"** label.
    - Call line with the duration, and the horizontal call map.
    - Transcript drawer: every number and chip opens its evidence turns.
    - The four sections: discovery by domain with S/P/I/N chips; gap timing bar with the annotated verbatim, the four
      checks and the component table; pitch compliance chips, staircase and pitch verbatim; objections table with
      clickable **A · I · E · M** and the prevention tiles.
  - `SKL_CRM.callAnalysis(callId)` reads the record through row-level security.
  1. **Sales cycle**: selecting a call in the cycle opens the existing `anHTML` dialog, now drawn by the renderer.
     - With no record: "Add transcript".
     - While the job runs: "Analysing… (started hh:mm)".
     - On failure: the reason, with Retry.
  2. **Pipeline (CRM board)**: a small chip on the lead card when its latest held call has a record (the four scores
     as dots); clicking it opens the analysis.
  3. **Lead list**: an "Analysis" column with the same chip, which opens the analysis.
  - The CRM document and the Sales cycle are patched in `gen_crm.py` (assert-checked, as today), never by hand in `crm_doc.html`.
- **Demo / Artifact**: one illustrative record of a **fictional** call, labelled "Sample", so that the Artifact never
  shows a real prospect. The real call 001 of the mock-up stays out of the page.
- **Claude connector**: the existing `call_analysis` tool returns this record (scores, verdicts, evidence quotes),
  never the transcript.

## 6. Performance (phase 5) and calibration (phase 6)

- **Performance**: a nightly worker step runs `core/aggregate.py` for each sales rep × competence × window (`7d`,
  `month`, `all`, in the rep's time zone) and writes `crm_ca_periods`.
  - Shown in Sales System › Cockpit (team row → competences) and in a "Call quality" block: score, interval, level,
    delta, item rates, bottleneck, "insufficient volume (n calls)", provisional.
- **Calibration**: `call-analysis/worker/calibrate.py`, on demand in Actions.
  - It replays every Annex C case with the live model and prints the agreement per rule and per competence.
  - Reproducibility report: three passes, per item.
  - Arbitration backlog (`rule_ambiguity`, `uncovered_case`) as an admin list for the methodology owner.

## 7. Pull requests (one per phase, tests green at each)

| PR | Content | Visible result |
|---|---|---|
| 1 · Engine in place (this PR) | Package in `call-analysis/`, CLAUDE.md section, this plan, workflow running the tests | Nothing on screen |
| 2 · Data and worker | Migration 020, `worker/run.py` (parallel passes, caching, retries), SQL and worker tests with the mock client | A job can run from Actions |
| 3 · Add transcript and screen | Renderer, the three doors, "Add transcript" with speaker mapping, demo sample, connector tool | First real call analysed end to end (acceptance) |
| 4 · Fathom | Mapper, call matching, automatic queueing, history import (dry run first) | Analysis appears after each recorded call, without anyone doing anything |
| 5 · Performance | Periods, cockpit block | Scores per sales rep and period |
| 6 · Calibration | Harness, reproducibility, backlog | Agreement per competence printed |

## 8. Questions for Romain (blocking marked ●)

- ● **Q1 Model ids.** Proposal: `fast` = `claude-haiku-5-5`, `strong` = `claude-sonnet-5-5`, `arbiter` = `claude-opus-5-5`.
- ● **Q2 API key.** An Anthropic key in GitHub secrets (`ANTHROPIC_API_KEY`), plus `SUPABASE_URL` and
  `SUPABASE_SERVICE_ROLE_KEY`. You set them yourself; I never see them.
- ● **Q3 Offer reference** (OPEN_DECISIONS A2): price and payment options, guarantees, components, phases, and the nine
  mechanisms (principle in one sentence, the offer phase that carries it, lexical cues).
  - Without it, the Pitch runs with reduced checks and the flags `offer_reference_missing` /
    `mechanism_reference_missing`. That is acceptable for a start.
- **Q4 Case library** (A3): client cases with consent and starting point. Without it, Pitch step 4 is "not applicable"
  (`case_library_missing`).
- **Q5 Fathom.**
  - The webhook (`FATHOM_WEBHOOK_SECRET`) and an API key (`FATHOM_API_KEY`), as Supabase secrets.
  - Which accounts record (Valentino's)?
  - Until then, transcripts come in through "Add transcript".
- **Q6 Test fixtures.** The 15 real transcripts are needed for the 20 Annex B tests in CI.
  - Proposal: a private Storage bucket `callqa-fixtures`, which CI downloads with the service role.
  - Alternative: commit them (the repository is private), which the package's own rule forbids.
- **Q7 Who sees the scores.** The architecture's pilot phase shows them only to the methodology owner and the sales
  manager. Proposal: admins only until you lift "provisional"; Valentino sees his own afterwards.
- **Q8 A · I · C or A · I · E · M** (OPEN_DECISIONS B). The screen spec uses A · I · E · M. Proposal: A · I · E · M.
- **Q9 Which calls.** Proposal: every past call with a transcript, all rounds (R1, R2…). Onboarding and
  case-study calls are left out (title or iClosed event type).
- Section B of OPEN_DECISIONS (weights, thresholds, verbatim rule…) stays as written ("to validate"); nothing is changed
  without your decision.
