# ALKIMIY Call Analysis Engine · Architecture
_Technical specification: how one sales call becomes four reliable, auditable competence scores (SPIN, Gap, Pitch, Objections)_

**Version:** Version 1.0 · 25 October 2026  
**Status:** Draft for validation by the CTO and the methodology owner. Values marked "to validate" or "à confirmer" are proposals or missing facts.  
**Scope:** Post-call analysis of recorded sales calls. Applies the four methodology documents: SPIN 1.1, Gap 1.3, Pitch 2.0, Objections 1.1, and their common engine (Part C). Reference implementation: Python package alkimiy_callqa.  
# 1. The decision in one page

**Question.** To analyse sales calls with very high reliability, should the system be four agents, one per competence?

**Answer: no.** The system is a **fixed pipeline** with three layers:
1. a **shared foundation**, computed once per call, that every competence reads;
2. many **small model tasks**, each answering one closed question about one unit, with exact quotes;
3. **deterministic code** that checks every quote and makes every decision and every score.

**Why not four agents.**
- **The competences depend on each other.** The Gap selects A, B and P from the SPIN letters; the Pitch treats the P that the Gap validated and is non-compliant if it starts before the Gap validation; the Objections need the first price and the roadmap. Four independent agents would each place the pitch start, the price or the blocker differently: the four scores would contradict each other and could not be audited.
- **Accuracy drops with load.** A model that reads 25 pages of rules and a 90-minute transcript at once makes more errors than short calls that each read one passage and one rule section.
- **Reproducibility.** A closed answer with a quote can be compared across three passes, replayed, arbitrated and tested. A free-form agent verdict cannot.

**Where a real agent is used.** Only where open reasoning is the job: the **arbiter** (cases where the three passes disagree or no rule decides), the **period coaching synthesis**, and the **live Copilot** (a separate system that reads the same prospect facts).

# 2. Principles

| # | Principle | Consequence in the architecture |
|---|---|---|
| 1 | The model extracts and quotes; the code decides and scores | No prompt asks for a score, a level or a verdict. Every model output is a closed answer + exact quote + turn id |
| 2 | One fact, one place | Phase anchors, SPIN letters, prospect atoms and the Gap selection are computed once and frozen; later stages read them, never recompute them |
| 3 | The prospect's exact words | Every prospect fact is an exact quote checked by code; restatements are checked with the verbatim rule (Gap GB-22) |
| 4 | Small units, short context | Each model task receives the unit, a short window of turns around it and only the rule section it needs |
| 5 | Measured before trusted | No score is displayed without the label "provisional" until the reliability thresholds of Part C (C7) are met on the current rules version |
| 6 | Everything is versioned and replayable | Each result stores the rules version, the model identifier, the prompt hash, the three raw passes and the arbitration |

# 3. Pipeline

## 3.1 Stages and dependencies

| Stage | Who | Reads | Writes | Methodology |
|---|---|---|---|---|
| F0 Parse | Code | Raw transcript, speaker mapping | Numbered turns T001… with role SALES / PROSPECT / OTHER | Part C, C1, S0 |
| F1 Diarization gate | Code | Turns | Call status (`no_transcript`, `no_diarization`, `diarization_suspect`) | C1 |
| F2 Attribution check | Model (fast) + code | Turns, by chunks of 60 | Repaired turns: merged turns split (`T050b`), swapped relabelled, echoes excluded | C1 |
| F3 Phase map | Code inventory + model (fast) + code decision | Sales turns with offer, amount or decision cues | Pitch start, offer mentions, first price, early price, decision request, pitch end | Pitch annex PB-1 to PB-4, PB-17 to PB-19 |
| C1 SPIN | Code + model + code | Turns, phase map | Discovery perimeter, solicitations with letters, prospect atoms with object labels; SPIN result | SPIN 1.1, Annex A |
| C2 Gap | Code + model + code | Atoms, letters, phase map | Selected A, B, P; restitutions; validation; roadmap blockers; Gap result | Gap 1.3, Annex A |
| C3 Pitch | Code + model + code | Gap details, phase map, offer reference, case library | Steps 1 to 4, mechanisms, claims, roadmap span; Pitch result | Pitch 2.0, Annex A |
| C4 Objections | Code + model + code | Phase map, Pitch details | Episodes, gestures, resolutions, prevention facts; Objections result | Objections 1.1, Annex A |
| A1 Aggregation | Code | Stored call results | Period scores, intervals, deltas, levels, bottleneck | C5, C6 |

The order is fixed: F0 → F1 → F2 → F3 → C1 → C2 → C3 → C4. A competence never re-places an anchor of an earlier stage. A crash in one competence marks that competence `to_review` and does not stop the others.

## 3.2 The shared prospect fact base

The foundation and SPIN produce the facts every other stage uses:

| Object | Content | Used by |
|---|---|---|
| Phase map | Turn ids of discovery start and end, pitch start, offer mentions, first price, early price, decision request, pitch end, with quotes | All |
| Solicitations | Each sales solicitation: text, turn, letter S / P / I / N / OUT, OUT reason, answer turns, followed up | SPIN, Gap (A from S and I, B from N, P from P) |
| Atoms | Each prospect atom: type (SITUATION, PAIN, BLOCKER, IMPACT, DESIRE, VALUE), exact quote, solicitation and letter, object label, domain, quantified, value, unit, volunteered, prompted by sales | SPIN, Gap, Pitch |
| Gap details | Verdict, validation turn, selected A / B / P, validated P and its key expression, cost quotes, roadmap blockers | Pitch, Copilot |
| Pitch details | Validated P category, steps, roadmap span | Objections, Copilot |

# 4. Model tasks

## 4.1 Anatomy of a task

Every model task is defined by:
- **an id** (for example `gap.validation`) and a **unit id** that is deterministic (for example `restit:T081`), so that answers can be cached, compared and replayed;
- **a tier**: `fast` for inventory and simple classifications, `strong` for fine judgements, `arbiter` for arbitration (model identifiers are configuration, à confirmer);
- **a prompt**: the common system rules (evidence rules of Part C, C3), the rule section of the annex for this question only, and the unit with a short window of surrounding turns;
- **a JSON schema** of closed answers, each positive answer with `quote` and `turn`;
- **a validation function** (code): every quote must be an exact substring of the cited turn, spoken by the expected role, inside the expected phase; numbers and lists must be in their closed sets;
- **a concordance key**: the part of the answer that must agree across the three passes (the decision-relevant fields, not the wording of the quotes).

## 4.2 Execution of one task

1. **Three independent passes**, same prompt, temperature 0, no pass sees another.
2. **Validation of each pass by code.** An invalid answer is replayed **once** with the error message ("not a substring", "wrong speaker", "outside phase"). If it fails again, that pass is invalid.
3. **Concordance.** If the three passes are valid and their keys are equal: status `verified`.
4. **Arbitration** otherwise: a separate call (tier `arbiter`) receives the full rule section, the unit, its context and the three readings; it decides by walking the rules in order, never by voting, and labels the case `application_error`, `rule_ambiguity` or `uncovered_case`. Status `arbitrated`. The last two labels go to the methodology owner's backlog.
5. **Unresolved:** status `to_review`; the unit is excluded from every score until a human decides.
6. **Cost option (C4).** One pass is allowed in production only once reproducibility has reached 95 % on the current rules version; three passes continue on a random 10 % sample each week, and any week below 95 % restores three passes everywhere.

## 4.3 Catalogue of tasks (30 tasks, as implemented)

| Stage | Task id | Unit | Closed question (summary) | Tier |
|---|---|---|---|---|
| F2 | `foundation.attribution` | Chunk of 60 turns | Merged, swapped or echo turns, with the foreign part quoted (C1) | fast |
| F3 | `foundation.phases` | One sales turn with an offer, amount or decision cue | Offer description? screen share? back to discovery? price for the offer, amount, hypothetical, range? decision request? (PB-1 to PB-4, PB-17 to PB-19) | fast |
| C1 | `spin.gates` | One solicitation | The ordered gates of the SPIN reference (OUT reasons, S, N, I, P), each with its proof; the code decides the letter | fast (volume; to validate on the regression tests) |
| C1 | `spin.atoms` | One answer span | Atoms in the prospect's answer: type, quote, object, domain, quantified, value, unit (SB-5 to SB-24) | strong |
| C1 | `spin.link` | Two consecutive coded solicitations | Same object? (SB-16) | fast |
| C1 | `spin.reopen_end` | One reopening | Where the reopening returns to the offer (SB-3). Not asked since v1.2 (SB-34) | fast |
| C1 | `spin.register` | One coded question of the discovery, before the pitch | Which domain does it ask about, or, for an open question, does its answer talk about? The code maps it to a register (SB-26 to SB-35) | fast |
| C2 | `gap.restitution` | One restitution candidate | Restitution or not; each clause with its component, source turn and key expression (GB-1 to GB-7, GB-22) | strong |
| C2 | `gap.validation` | One restitution | Outcome of the prospect's response, with quote (GB-8 to GB-10, GB-15 to GB-17, GB-26) | strong |
| C2 | `gap.a_current` | One quantified A candidate | Does it describe the present? (GB-28, X13) | fast |
| C2 | `gap.stopping` | Solicitations coded P | Does the sales ask what stops the prospect? (GB-30) | fast |
| C2 | `gap.horizon` | The selected B | Deadline given by the prospect, binding or wished | fast |
| C3 | `pitch.p_category` | The validated P | One of the nine blockers, or unknown (PB-27); an unknown category is always arbitrated | strong |
| C3 | `pitch.step1` to `pitch.step4` | Pitch window | Span of each step and its fields: blocker, mechanisms and recitation, transformation, proof case (PB-28 to PB-31) | strong |
| C3 | `pitch.roadmap` | After step 4 | Roadmap span and its steps (PB-34) | strong |
| C3 | `pitch.claims` | Chunks of 40 turns of the pitch | Every figure, case, price and guarantee stated by the sales (PB-35) | strong |
| C3 | `pitch.promises` | Chunks of 40 turns of the pitch | Outcome promises (PB-36) | strong |
| C3 | `pitch.adhesion` | Chunks of 40 turns of the pitch | Appropriation, concrete projection, new link, with the gesture before (PB-14 to PB-16, PB-23, PB-24) | fast |
| C4 | `obj.nominate` | Chunks of turns | Resistances without any marker (OB-1) | fast |
| C4 | `obj.resistance` | One candidate | Exclusion from a closed list; subject of each doubt, from which the code derives the nature (OB-2 to OB-4, OB-24 to OB-26) | strong |
| C4 | `obj.topic` | One sales turn the code cannot decide | New subject or continuation? (OB-8 b, OB-22) | fast |
| C4 | `obj.acknowledge`, `obj.isolate`, `obj.explore` | One episode | The three gestures, each with its quote (OB-13 to OB-15, OB-20) | fast |
| C4 | `obj.gesture` | One episode | Facts of the response used for the matching gesture (OB-16, OB-21) | strong |
| C4 | `obj.resolution` | One episode | Kind of prospect reaction from a closed list (OB-17, OB-23) | strong |
| C4 | `obj.prevention` | Turns before the first price | Decision maker, influencers, budget, deadline, past attempt (OB-18, OB-19) | strong |
| All | arbiter | Any divergent unit | Same schema + justification + case label | arbiter |

Measured on a real call (call 001, 204 turns) with an empty mock model, the pipeline sends 4 attribution chunks, 13 phase candidates, 131 solicitations, 62 answer spans, 12 restitution candidates, 4 resistance nomination chunks and 3 resistance candidates to the model: about 690 model calls with three passes, before arbitration, replays and the pitch tasks (the mock found no pitch). This figure is the main cost driver and the first target of the batching lever (§7).

## 4.4 What the code decides (never the model)

- Every quote check (substring, speaker, phase) and every number normalisation (PB-21).
- Every order: perimeter borders, restitution before pitch and price, pitch after validation, steps 1 → 4 → roadmap → price → decision.
- The SPIN letter from the gate answers; the Gap selections of A, B and P (GB-28 to GB-30); the verbatim check of each key expression (GB-22).
- Every gate and exclusion: Gap absence gate and its reasons; Pitch compliance gate; latent episodes; recurrences.
- Every item level, every call score, every period score, interval, delta, level and bottleneck.

# 5. Data and storage

## 5.1 Inputs per call

| Input | Content | If missing |
|---|---|---|
| Transcript | One entry per speaker turn, timestamp, speaker label | `no_transcript` |
| Speaker mapping | Label → SALES / PROSPECT / OTHER | `no_diarization` |
| Call metadata | call id, sales id, start time UTC, sales time zone, call type, cycle id (to link follow-up calls) | excluded from period windows |
| Offer reference | Name, components, phases, price and payment options, guarantees, the nine mechanisms (principle, phase, cues) | Pitch flags `offer_reference_missing` or `mechanism_reference_missing` |
| Case library | Client cases with consent flag, starting point (value, unit, profile) and figures | Pitch step 4 `not_applicable`, flag `case_library_missing` |
| Prior inputs | Application form text typed by the prospect, earlier calls of the same cycle | Gap GB-19: setter's notes are never a verbatim source |

## 5.2 Stored per call (C8)

The call record keeps: the repaired turns, the phase map, the shared fact base, each competence result (status, verdict, reasons, items with evidence, score, flags, details), and the **audit**: for every model pass its task id, unit id, tier, prompt hash, raw answer and validation errors; every arbitration with its justification and case label; every human correction with author and date. A stored score is never edited by hand: a human corrects a verdict, the code re-scores.

## 5.3 Versioning

A score computed under one rules version is never compared with one computed under another. When a rules version changes (for example Pitch 1.1 → 2.0), the calls of the displayed windows are re-scored before any delta is shown. Prompt files are versioned with the rules; the prompt hash is stored with each pass.

# 6. Reliability programme

| Layer | What | Threshold | When |
|---|---|---|---|
| Unit tests | Every minimal pair of the four Annex A sections, as decision tests on synthetic calls | 100 % green | Every commit |
| Calibration regression | Every Annex B real case, replayed with recorded model answers | 100 % expected verdicts | Every change of rules, prompt or model |
| Live regression | Annex B cases re-run with the live model | ≥ 95 % expected verdicts | Every prompt or model change |
| Gold set | 30 real calls annotated by two certified annotators, 20 calibration / 10 test, split frozen | Item agreement ≥ human agreement − 5 points | Before removing "provisional" |
| Reproducibility | Same verdict on three passes | ≥ 95 % per item | Weekly on a 10 % sample |
| Anchoring | Quotes found verbatim | 100 % | Every call (a failure is a defect) |
| Health | Units no rule could decide | ≤ 5 % per call | Every call |

The test set of the gold set is never used to adjust a rule, a prompt or a threshold. Below a threshold, the rule is rewritten; the threshold never is.

# 7. Model tiers, cost and latency

- **Tiers.** `fast` for the attribution check, the phase anchors, inventories and simple classifications; `strong` for gates, atoms, restitutions, validations, P categories, steps, claims, gestures and resolutions; `arbiter` for arbitration. The model identifiers are configuration (à confirmer).
- **Volume per call.** The number of model calls is: (number of units) × 3 passes + arbitrations + replays. Measured on the 95 Interior Academy calls already processed (10th to 90th percentile, median in brackets): 101 to 452 turns per call (265), so 2 to 8 attribution chunks of 60 turns; 39 to 219 sales solicitations over the whole call (135), of which only those in the discovery perimeter are coded; 5 to 29 phase candidates with the current cue lists (18). The pitch adds about six tasks on one window. Restitution and resistance candidates have not been counted yet: they are measured during the pilot, as is the cost per call (not estimated here).
- **Levers when cost matters.** Batch the units of one stage in one prompt where the reliability tests show no loss (to validate per task); cache the system prompt and the rule sections; apply the one-pass cost option only after the reproducibility threshold is met.
- **Measured cost (2026-10-26, first real calls, before the levers below).** About 5 to 10 USD per call of 75 000 to 120 000 characters (≈ 800 to 1 200 questions): Sonnet `strong` ≈ 50 %, Opus `arbiter` ≈ 46 %, Haiku `fast` ≈ 4 %. Most of it was the model's thinking (billed as output, 800 to 1 200 tokens for a JSON answer of about 150) and the unit prompt sent in full to each of the three passes. Usage per tier is stored on each job (`crm_ca_jobs.usage`).
- **Cost step 1 (Romain 2026-10-28, target ≤ 3 USD per call).** No rule changes: three passes, the arbiter and every quote check stay. (1) Effort `low` on every question (`output_config.effort`, gateway `callqa-llm`; the answer is one closed JSON question). (2) The prompt of a pass is marked for caching, and the worker sends pass 1 (and the arbitrations) before passes 2 and 3 of the same round, so passes 2 and 3 read the prompt from the cache. Expected ≈ 3.5 USD for a typical call, to be measured on the next real jobs. Step 2, if needed and decided by Romain: the arbiter on the `strong` model, or the Batch API (half price, results within hours).
- **Measured after step 1 (2026-10-28, the same calls).** 7.10 → 3.65 USD and 10.15 → 4.40 USD (−54 % over the five calls); scores unchanged or close, two Pitch results no longer `to_review`. The arbiter is now the largest part (≈ 58 %). The register of a SPIN question (SB-33) missed the 92 % agreement gate on both calls (84.6 %, 90 %): `spin.register` is asked at effort `medium` (`TASK_EFFORT` in the worker gateway; fast tier, a few cents per call).
- **Stability (2026-10-28).** The same call gave different results from one run to the next at effort low (Amber Peterson: analysed, then excluded as `diarization_suspect`; Jaci Sung's register agreement 90 % then 80 %; Jaci's cost 4.40 then 6.05 USD). The foundation (attribution, phases) keeps the model's default effort (`TASK_EFFORT`), since a wrong answer there excludes the whole call. The worker run takes an `effort` input (`low` or `default`, `CALLQA_EFFORT`), stored in `crm_ca_jobs.usage.effort`, to compare the two on the same calls before deciding.
- **Cost step 2 (LNP, Romain 2026-11-03, target ≤ 0.10 per call).** No rule changes. Measured before it, on six LNP calls at effort low: about 3.1 USD a call (Opus `arbiter` ≈ 58 %, Sonnet `strong` ≈ 36 %, Haiku `fast` ≈ 5 %), about 540 questions a call, 340 000 output tokens a call (mostly thinking), and 258 arbitrations for 940 units asked three times: item-level concordance ≈ 73 %, below the 95 % that the C4 one-pass option needs. (1) Every tier on `claude-haiku-5-5` (`crm_ca_config.tiers`). (2) Effort `none`: thinking off on every question (gateway `callqa-llm` sends `thinking: {type: "disabled"}`), except the foundation (attribution, phases), which keeps the model's default (`gateway.py`, workflow input `effort`, default `none`). (3) A question is marked for caching only when another pass asks it again. Then measure on real calls the cost and the concordance: if the concordance reaches 95 % (C7), `crm_ca_config.passes = 1` turns on the C4 one-pass option (`job.py`: one pass, 10 % of the units still with three); otherwise the next lever is the Message Batches API (−50 %).
- **Robustness.** An answer whose shape a validator cannot read (an object where a list is expected) is an invalid answer (C3 rule 7: replayed once, then `to_review` for that unit), never a crash of the competence (`runner._check`).
- **Latency.** Post-call analysis, not live: stages run in sequence, units of a stage run in parallel. Target: results available within the hour after the recording (to validate).

# 8. Interfaces

| Consumer | What it reads | When |
|---|---|---|
| Performance screen (single screen, four competences) | Period results per sales: score, interval, level, delta, item rates, bottleneck, evidence of each item | On demand, per window (7 days, this month, all) |
| Call card | Call results with evidence: quotes, turns, timestamps, transcript extract ± 3 minutes | On click |
| Copilot (live pitch) | The same prospect fact base during the call: selected A, B, P, validated P category, roadmap blockers, missing figures ("To ask") | Live; a separate system with its own latency constraints |
| Methodology owner | Arbitration backlog: `rule_ambiguity` and `uncovered_case` with quotes | Weekly |
| Admin › Proof gaps | Calls where no matching client case existed, by category of P and starting point | Weekly |

# 9. Reference implementation

The Python package `alkimiy_callqa` implements this architecture without any external dependency (the Anthropic SDK is optional, for live runs).

| Path | Content |
|---|---|
| `core/models.py` | Data model: Turn, Evidence, PhaseMap, Solicitation, Atom, ItemScore, CompetenceResult, CallContext |
| `core/text.py` | Normalised comparison, exact-quote checks (C3), approval-only turns, number normalisation (PB-21), the verbatim rule (GB-22), sentence split (PB-33) |
| `core/llm.py` | Model client interface; live client (tiers as configuration); mock client replaying recorded answers |
| `core/runner.py` | Model tasks; three passes, validation, replay, concordance, arbitration, audit |
| `core/foundation.py` | Parsing, diarization gate, attribution check and repair, phase map |
| `core/scoring.py` | Item levels, two-quote rule, call score with not-applicable weights spread |
| `core/aggregate.py` | Windows, period score, Student and Wilson intervals, delta, levels, floor rule, bottleneck |
| `competences/spin.py`, `gap.py`, `pitch.py`, `objections.py` | Inventory, model tasks and decision code of each competence |
| `prompts/` | Common system rules and one rule file per model task |
| `pipeline.py` | The fixed order of the stages, the stored call record, a command-line entry point |
| `tests/` | Core tests, minimal pairs and Annex B cases per competence |

**What it does not include yet:** the live model configuration (model identifiers, API key), the offer reference and its nine mechanisms, the case library, the storage layer and the screens. Those are the prerequisites of the deployment below.

# 10. Deployment roadmap

| Phase | Content | Exit criterion |
|---|---|---|
| 1 · Prerequisites | Model identifiers per tier and API access; speaker mapping from the recording tool; offer reference with the nine mechanisms (principle, phase, cues); case library with consent and starting points; call metadata with cycle id | All inputs of §5.1 available for 10 real calls |
| 2 · Construction | Reference implementation wired to the live model; storage of call records; prompt files reviewed against the annexes | The pipeline runs end to end on 10 calls without engine error |
| 3 · Tests | Calibration regression and live regression on Annex B; first reproducibility measure; arbitration backlog reviewed | Annex B ≥ 95 % with the live model; reproducibility measured per item |
| 4 · Gold set | Two certified annotators on 30 calls; calibration on 20; test on 10 | Thresholds of C7 met on the test set |
| 5 · Pilot | Scores shown to the methodology owner and the sales manager only, labelled "provisional"; weekly review of disagreements | Two consecutive weeks without a new `uncovered_case` of high frequency |
| 6 · Rising autonomy | Scores shown to the sales; one-pass cost option if reproducibility ≥ 95 %; 10 % weekly sample | Weekly sample ≥ 95 % |
| 7 · Continuous steering | Rules versions, re-scoring on version change, Proof gaps, arbitration backlog, model change protocol (live regression before any switch) | Ongoing |

# 11. Open decisions

- Model identifiers for the `fast`, `strong` and `arbiter` tiers (à confirmer).
- Whether to batch several units of a stage in one prompt (to validate task by task with the regression tests).
- Target latency after the recording (proposal: within the hour, to validate).
- Storage and hosting of call records and audits (à confirmer with the CTO).
- All decisions listed in section 10 or 11 of each methodology document (weights, thresholds, the nine mechanisms, the case matching rule).
