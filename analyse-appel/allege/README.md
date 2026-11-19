# Lite engine (`callqa_lite`, 2026-11-03)

A low-cost reading of a sales call: **five whole-transcript model steps instead of about 540 closed questions asked
three times**, the code still checking every quote and deciding every level, verdict and score. Target set by Romain:
at most 0.10 USD a call (estimate below: about 0.02 to 0.03 USD).

Switch (per job, read by the worker from the claim): `update crm_ca_config set engine = 'lite';` (back:
`engine = 'full'`), migration `web/supabase/035_crm_ca_engine_choice.sql`. The reference engine
(`call-analysis/engine`) is unchanged and still runs by default.

## What it measures (Romain, 2026-11-03)

Phase rules checked by the code (Romain, 2026-11-03, `phases.py`): the first price is the sales' price **for the
offer**, with the quoted sales turn that explains that offer (`lnp_offer_price`, `offer_explained`); an offer mention
followed by a quoted discovery question is a mention, not the pitch start (`next_discovery_question`); a valid price
before the pitch start moves the pitch start to the offer's explanation. A call with no discovery question, no pitch and
no price: Gap `not_applicable`. Key expressions (GB-22): when the model copies the prospect's whole sentence instead of the words the
sales takes up, the code keeps the longest run of the model's words that is both in the source and in the sales clause
and is not generic (`key_expression:narrowed_by_code`); the S2 prompt also says that a consequence lived because of the
problem (depending on a parent, exhaustion…) is a COST, not a PROBLEM.

1. Every question the sales asks **in the discovery**: until the gap is made (its validation), or before the pitch when no
   gap is made (SB-1, Romain 2026-11-03), with its **SPIN letter** and its
   **register** (Financial, Time & load, Identity & status, Mental & emotional, Other; SB-26 to SB-35), and the
   prospect's answer.
2. The **gap** played back, with the Gap 1.3 methodology (absence gate, verbatim rule GB-22, formula GB-28 to GB-34).
3. The **pitch**, with the Pitch 2.0 methodology (compliance gate, staircase, roadmap, claims, promises, adhesion).
4. The **objections raised after the first price only** (OB-27), each objection **once** (its repeats merged, with all their
   quotes), and **A · I · E · M** on each; plus the prevention facts before the first price.

## The steps

All steps go through the gateway `callqa-llm` on the `fast` tier of `crm_ca_config.tiers` (claude-haiku-5-5), effort
`low` (thinking on, short; `CALLQA_LITE_EFFORT` changes it). The system rules (`prompts/system.md`) and the transcript
(`T001 [SALES] text`, one line per turn) are the same two first blocks of every call: the gateway caches them (`prefix`
field), so the transcript is written to the cache once and read back by the next steps. Each step prompt is a short
digest of the B (bounding) rules of its competence and a strict JSON schema. An answer that is not valid JSON is asked
again once with the error; still invalid, the competence is `to_review` (reason `engine_error`); if the phase map or
most steps fail, the job stops (`ModelErrors`, not retried).

| Step | Asked | The code then |
|---|---|---|
| S0 `lite.s0_phases` | every sales turn with an offer description, a screen share, an amount for the offer or a decision request, with the engine's closed flags (`foundation.phases`) | checks each quote (SALES turn) and places the anchors with the engine's `decide_phases` (PB-1, PB-2/PB-17, PB-3/PB-18, PB-19, PB-4) and `discovery_end` (SB-1) |
| S1 `lite.s1_discovery` | every sales solicitation before the first pitch start or price: exact quote, letter (gates in order, OUT reason), object, stopping question, register domain and basis with quote, the prospect's answer, the atoms of the answer (SITUATION … VALUE, with the engine's atom fields). Chunks of 160 turns; an answer cut by `max_tokens` is asked again as two halves | drops a question that is not an exact passage of a SALES turn or comes after the pitch (SB-34); hard rules of §3 (a validation tail or a closed need-payoff → OUT agreement); perimeter (SB-1, SB-2); answer spans (SB-5 to SB-8, engine `answer_spans`); every atom must be an exact passage of a PROSPECT turn of that question's answer span (engine `_validate_atoms`), then the engine's atom decisions (`build_atoms`: SB-9 to SB-24); follow-ups (SB-17, SB-19); chains (`find_chains`, SB-16 to SB-20); register checks (engine `_validate_register`, SB-32: quote place, rule order, word-list conflict); items D1 to D5 (`score_items`) |
| S2 `lite.s2_gap` | every playback passage up to the first price: its sales turns, each restated clause (component, sales quote, source turn, key expression), a new-topic question at the end, the validation read on the prospect turn right after; the deadlines attached to a target | runs the engine's `GapCompetence` unchanged: its closed questions (`gap.restitution`, `gap.validation`, `gap.a_current`, `gap.stopping`, `gap.horizon`) are answered from S2 and S1 and checked by the engine validators; the verbatim rule GB-22, the formula, the gate, G1 to G6 are the engine's code. A passage the model found and the code inventory missed is added as a candidate (signal `S5_lite`) |
| S3 `lite.s3_pitch` | in one answer, the engine's pitch questions: category of the validated P, steps 1 to 4, roadmap, claims, outcome promises, adhesion | runs the engine's `PitchCompetence` unchanged (list answers cut into its chunks); compliance gate (PB-37 pitch after the yes, PB-35 claims, PB-36 promises), K1 to K7 are the engine's code. Whether the pitch comes after the gap is decided by code from the Gap validation turn, never asked |
| S4 `lite.s4_objections` | each different resistance once, its subjects and every quote; for the first passage: topic change, acknowledge, isolate, explore, matching gesture, reaction; the prevention facts | see below |

S4 in code (`objections.py`): a quote must be an exact passage of a PROSPECT or co-decider turn **after the first
price** (before it: dropped and counted); the nature comes from the subjects with the OB-3 boundary tests
(`nature_of_subjects`, OB-24); objections of the same nature and theme, or sharing a quote, are merged into one with all
their quotes; one episode per objection: response = the sales turns from its first passage to the topic change (the
model's, checked: a SALES turn before the next objection), reaction = the prospect turns after the first response; a
quote of the same objection inside the reaction is a repetition (persisting), one after the episode a recurrence
(H5 = 0). Acknowledge, isolate, explore, gesture, resolution, latency, items H1 to H5, prevention R1 to R3, the 70/30
combination: the engine's functions, each gesture reading checked by the engine task's validator.

Never asked of the model: a score, a level, a verdict, the phase order, whether a component is verbatim.

## The record

The same record as `lnp_callqa.pipeline.result_record` (`docs/OUTPUT_CONTRACT.md`), stored by `crm_ca_store` and
read by `app/crm/call_analysis_view.js` (checked in a browser with a lite record: header tiles, discovery rows by
register with the letter chips and the question + answer panel, the gap panel and its four checks, the pitch staircase
and verbatim, the objections table with A · I · E · M), plus:

- `meta`: `{"engine": "lite", "version": "callqa-lite-1.0", "tier", "effort", "failed_steps", "steps": {S0..S4:
  {"dropped": n, "reasons": {...}}}}`; 035 keeps `meta.engine`, `meta.engine_version` and `meta.engine_steps` in
  `crm_ca_records.meta`;
- `concordance: "single_reading"` on every competence; SPIN `solicitations[].status = "single_reading"`, each with its
  `quote` and `answer`; SPIN `registers.agreement = null` (one reading: the 3/3 agreement is not measured, no
  `register_agreement_low` flag);
- OBJECTIONS `episodes[].quotes` (every passage of the objection) and `merged_items`;
- `details.lite` on Gap, Pitch and Objections (units answered, what was dropped);
- the audit: one entry per model call (task, unit, attempt, tier, prompt hash, answer, errors, stop reason).

`crm_ca_jobs.usage` keeps the token usage per tier as before, plus `engine` and `effort`; `callqa_lite.cost.estimate`
turns it into USD.

## Cost estimate (60-minute call, about 15 000 transcript tokens)

Prices given for claude-haiku-5-5 (USD per million tokens): input 0.10, output 0.50, cache read 0.01, cache write 0.125
(`cost.PRICES`, to check against the provider's price list).

| Call | Cached prefix (system ≈ 500 + transcript 15 000) | Step prompt (not cached) | Output (answer + short thinking) |
|---|---|---|---|
| S0 | written: 15 500 | ≈ 600 | ≈ 1 500 + 1 000 |
| S1 (1 or 2 chunks for a 30 to 40-minute discovery of 60 to 100 questions) | read: 15 500 per chunk | ≈ 1 700 per chunk | ≈ 10 000 + 2 000 in all |
| S2 | read: 15 500 | ≈ 1 400 + ≈ 1 500 of statements | ≈ 2 500 + 1 000 |
| S3 | read: 15 500 | ≈ 1 900 + references | ≈ 3 000 + 1 000 |
| S4 | read: 15 500 | ≈ 1 600 | ≈ 3 000 + 1 000 |

With two S1 chunks: cache write 15 500 × 0.125 = 0.0019; cache reads 5 × 15 500 × 0.01 = 0.0008; step prompts ≈ 12 000 ×
0.10 = 0.0012; output ≈ 26 000 × 0.50 = 0.013. **About 0.017 USD a call; about 0.03 USD with one replay of S1 and a
longer thinking**, under the 0.05 target and well under 0.10. (Measured before: 3.12 USD with Sonnet / Opus, 0.22 USD with
every tier on Haiku and no thinking.) The first call writes the cache, so the steps run one after the other; the cache
lives 5 minutes, enough for the five steps of one call. To be measured by the lead on real calls (`crm_ca_jobs.usage`).

## Approximations versus the methodology (each also in `docs/OPEN_DECISIONS.md`, section E)

1. **One reading, no arbiter** (Part C, C4). Each fact is read once; there is no concordance and no arbitration. C4
   allows one pass only after 95 % reproducibility on the current rules version: the lite results are `single_reading`
   and must stay "provisional" until measured.
2. **Invalid evidence is dropped item by item**, not replayed (C3 rule 7 replays a unit once, then `to_review`): an
   unproved atom, clause, claim or gesture counts as not said / not done; the whole step is replayed once only when its
   JSON is invalid. Counts per reason in `meta.steps`.
3. **No attribution check** (C1 merged / swapped / echo turns): only the code's diarization gate runs. A call with
   mislabelled turns is not repaired and its quotes may be rejected as `wrong_speaker`.
4. **SPIN letters**: the model gives the letter after walking the gates in the prompt, instead of answering each gate
   with its proof (§3); the code enforces the hard rules it can read in the text (validation tail, closed need-payoff)
   but not "value about the offer" or "load of a solution" (they rely on the model's OUT reason). Segmentation (SEG-1
   to SEG-8) is the model's listing, not the code inventory. SB-21 (action-plan N without a future state) is left to
   the model's OUT `solution_load`.
5. **SPIN chains**: "same object" (SB-16) = the model's object labels agree and the engine's lexical check passes,
   instead of a `spin.link` question per pair.
6. **Registers**: single reading, so the SB-33 reliability measure (share decided 3/3, 92 %) is not computed
   (`agreement: null`). The SB-32 code checks still run (quote place, rule order, word-list conflict); a rejected
   register is `to_review` and left out of the counts.
7. **Gap**: the X13 check (a figure that is not the present state) uses the atom's `figure_kind` from S1 (a figure
   without a kind counts as present); the stopping question (GB-30) is S1's flag (the engine's regex still applies
   first). The validation must be read on the prospect turn right after the passage (GB-8, code): a reading of another
   turn makes the unit `to_review`.
8. **Objections**: (a) only resistances after the first price (OB-27, Romain, 2026-11-03; the engine applies the same
   rule). (b) One objection per nature and theme: repeats inside the episode are a repetition (persisting), after it a
   recurrence (H5 = 0), and two natures in one passage (OB-4) are merged into one when they share a quote. (c) The
   topic change (OB-8) is the model's single answer, checked to be a SALES turn before the next objection, not the
   engine's code-and-question walk turn by turn. (d) The deadlines found at detection (OB-2, OB-25) do not feed
   prevention; only S4's prevention facts do.
9. **Language**: the code helpers of the engine (approval words, validation tails, person shift of GB-22, stop lists)
   are English. The prompts accept French or English transcripts, but a French call is checked with English word
   lists, as in the reference engine.
10. **Screen**: the objections table shows the first quote of each objection (`resistance.quote`); the other quotes
    are in `episodes[].quotes` until the screen reads them.

## Files

`callqa_lite/engine.py` pipeline · `steps.py` model calls, JSON, replay, mock client · `shim.py` the engine's runner
interface answered from a step · `phases.py` S0 · `spin.py` S1 → SPIN · `gap.py` S2 → Gap · `pitch.py` S3 → Pitch ·
`objections.py` S4 → Objections · `cost.py` · `prompts/*.md` (English: translating them would change the reading) ·
`tests/` (fictional call `synthetic_call.py`, no real data).

```
cd call-analysis/lite && python3 -m pytest -q tests
```
