# Lite engine (`callqa_lite`, 2026-11-03)

A low-cost reading of a sales call: **a voice check, then five whole-transcript model steps instead of about 540 closed questions asked
three times**, the code still checking every quote and deciding every level, verdict and score. Target set by Romain:
at most 0.10 USD a call (measured: 0.019 to 0.028 USD for the five steps on the calls of November 2026; about 0.012
USD more for the voice check and its control, so about 0.04 to 0.05 USD, below).

Switch (per job, read by the worker from the claim): `update crm_ca_config set engine = 'lite';` (back:
`engine = 'full'`), migration `web/supabase/035_crm_ca_engine_choice.sql`. The reference engine
(`call-analysis/engine`) is unchanged and still runs by default.

## What it measures (Romain, 2026-11-03)

Phase rules checked by the code (2026-11-19): an offer description is a mention only when the return to discovery
comes within 2 sales turns (PB-2, PB-17, `MENTION_RETURN_SALES_TURNS`); the pitch end is recomputed after the code moves
the price or the start (PB-4). SPIN (2026-11-19): when the asked clause of a question names one register (SB-30 words,
the last clause after a comma, SB-28), the register is read in the question, never in its answer (SB-27); an atom listed
under an OUT question goes to the question whose answer holds its turn instead of being lost. Gap (2026-11-19): the
restitution starts at its first restated clause, so an offer word said before it in the same turn does not cut it (GB-1).

Disguised price (Romain, 2026-11-20, PB-3): a market tour of price ranges whose levels are the company's offers is the
first price when S0 quotes the later sales turn that ties one level to the offer (`market_tour`, `tied_later`); the call
is flagged `disguised_price` (« Prix donné trop tôt » on the screen); a tour never tied stays a market price.

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
2. The **gap** played back, with the Gap 1.3 methodology (absence gate, verbatim rule GB-22, formula GB-28 to GB-34; since
   2026-11-20, rules version GAP-1.4, GAP-1.5 on 2026-11-23 with GB-22b: A and B are selected on the model's atoms **and** on the figures the code lists in the
   prospect's turns, `core/figures.py`, so a figure the model missed still gives A or B, and A is never a fact unrelated to B;
   the costs the prospect states are listed the same way, `core/costs.py`, GB-7b; the blocker has a state, GB-30 v1.4, read
   from the sales' stopping questions and the prospect's blocker clauses, `core/blockers.py`; the perfect restitution is
   written by the engine, `core/restate.py`).
3. The **pitch**, with the Pitch 2.0 methodology (compliance gate, staircase, roadmap, claims, promises, adhesion).
4. The **objections raised after the first price only** (OB-27), each episode once (an objection said again before the
   sales moves on stays one episode; one that comes back after is a new episode linked to the first, OB-11, Romain
   2026-11-20), and **A · I · E · M** on each; plus the prevention facts before the first price.

## Calls of one cycle (Part C, C9, Romain 2026-11-20)

The worker passes the call's round and the earlier analysed calls of the cycle (`crm_ca_claim.prior`):
`core/rounds.plan` reads them. After a good gap in an earlier call, S1 and S2 are not asked (SPIN and Gap
`not_applicable`, `gap_made_in_previous_call`; the earlier gap is carried for the pitch); after a pitch in an earlier
call, S3 is not asked (`pitch_made_in_previous_call`); once the price was given earlier, S4 reads every resistance from
the first turn and prevention is not evaluated. A bad gap with no new restatement nor discovery question before the
pitch flags the call `gap_not_remedied` (`meta.gap_remediation`). `meta.cycle` shows the plan.

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
| SV `lite.sv_voices` + `lite.sv_control` (first, always on, 2026-11-19, `voices.py`) | on the recorder's lines (`L001 [SALES] text`, one per sentence, its own cached prefix and system prompt `prompts/sv_system.md`), in chunks of 150 lines: every line whose speaker label is wrong, the whole line or from an exact quote on (`prompts/sv_voices.md`) | checks each correction (line in the chunk, role SALES / PROSPECT / OTHER and different from the label, the `from` quote in the line), relabels and splits the lines (second part `L073b`); a line whose quote is not found is doubtful (a turn of its own, left out). Then the **control** (`lite.sv_control`, Romain 2026-11-20): the repaired lines are read again with the same question; what is still flagged plus the doubtful lines are the errors left after the repair: more than 10 % of the lines → `diarization_suspect` (flag `attribution_rate`), the call is not analysed; otherwise the control's corrections are applied too. The turns (consecutive lines of one role) are rebuilt from the repaired lines. `meta.voices`: relabelled, split, doubtful, `control`, `residual`, `share_residual`. No valid answer: the transcript stays as recorded (`voices_unchecked`); a control with no valid answer keeps the repair without the measure (`voices_control_unchecked`) |
| S0 `lite.s0_phases` | every sales turn with an offer description, a screen share, an amount for the offer or a decision request, with the engine's closed flags (`foundation.phases`) | checks each quote (SALES turn) and places the anchors with the engine's `decide_phases` (PB-1, PB-2/PB-17, PB-3/PB-18, PB-19, PB-4) and `discovery_end` (SB-1) |
| S1 `lite.s1_discovery` | every sales solicitation before the first pitch start or price: its id in the code's list (SEG-1; since 2026-11-23 the model no longer recopies the code's turn and question: the code holds them; only a question it adds carries them), letter (gates in order, OUT reason), object, stopping question, register domain and basis with quote, the prospect's answer, the atoms of the answer (SITUATION … VALUE, with the engine's atom fields). Chunks of 160 turns; an answer cut by `max_tokens` is asked again as two halves | drops a question that is not an exact passage of a SALES turn or comes after the pitch (SB-34); hard rules of §3 (a validation tail or a closed need-payoff → OUT agreement); perimeter (SB-1, SB-2); answer spans (SB-5 to SB-8, engine `answer_spans`); every atom must be an exact passage of a PROSPECT turn of that question's answer span (engine `_validate_atoms`), then the engine's atom decisions (`build_atoms`: SB-9 to SB-24); follow-ups (SB-17, SB-19); chains (`find_chains`, SB-16 to SB-20); register checks (engine `_validate_register`, SB-32: quote place, rule order, word-list conflict); items D1 to D5 (`score_items`) |
| S1g `lite.s1_gates` (2026-11-20) | for each question listed by the code (one per sales turn, SEG-1), in batches of 25 with its context (the 2 turns before, the other questions of the turn, the answer): the closed gates of SPIN §3 (routing, OUT reason, neutral fact, desired state or value, consequence, difficulty); never a letter (`prompts/s1_gates.md`, taken from the engine's `spin_gates.md`). **Answers by ids** (2026-11-23): the model writes only what is true, by the question's id, without a quote: the question was listed by the code, which holds its text (Part C, C3 for the lite engine); what is left out is read as false (`spin.normalize_gates`). On the stored analyses, the gate answers were 91 % of the output of the step, the quotes and the fields at false most of it | fills the defaults, checks a quote the model still gives (engine `_validate_gate_obj`, `require_quotes=False`; a failing one is dropped, `gates:invalid`), takes the question as the proof of a positive gate (`spin.with_proofs`), decides the letter with the engine's `decide_letter` (gate order, §3 hard rules), then the lite's own hard rules (tail, load, offer, framing); routing and non-solicitations are set aside. Without a valid gate answer, S1's letter stays. **Two readings** (C4, 2026-11-20; the second with the units in reverse order): the same letter → `agreed`; otherwise the **arbiter** tier (`crm_ca_config.tiers.arbiter`, `lite.s1_gates_arbiter`) walks the gates again on the disputed units only, its prompt carrying their context and both readings, with no transcript prefix → `arbitrated`; a failed arbitration keeps a valid reading as `to_review`, left out of every score |
| S2 `lite.s2_gap` | every playback passage up to the first price: its sales turns, each restated clause (component, sales quote, source turn, key expression), a new-topic question at the end, the validation read on the prospect turn right after; the deadlines attached to a target | runs the engine's `GapCompetence` unchanged: its closed questions (`gap.restitution`, `gap.validation`, `gap.a_current`, `gap.stopping`, `gap.horizon`) are answered from S2 and S1 and checked by the engine validators; the verbatim rule GB-22, the formula, the gate, G1 to G6 are the engine's code. A passage the model found and the code inventory missed is added as a candidate (signal `S5_lite`) |
| S3 `lite.s3_pitch` | in one answer, the engine's pitch questions: category of the validated P, steps 1 to 4, roadmap, claims, outcome promises, adhesion | runs the engine's `PitchCompetence` unchanged (list answers cut into its chunks); compliance gate (PB-37 pitch after the yes, PB-35 claims, PB-36 promises), K1 to K7 are the engine's code. Whether the pitch comes after the gap is decided by code from the Gap validation turn, never asked |
| S4 `lite.s4_objections` | each different resistance once, its subjects and every quote; for the first passage: topic change, acknowledge, isolate, explore, matching gesture, reaction; the prevention facts | see below |
| S4d `lite.s4_detect` (2026-11-24, OB-29) | for each prospect turn after the first price (the code's list, by ids, 60 a call): does it hold a doubt or a reserve, its subjects, the prospect's words, whether the doubt was already said; twice, the arbiter tier (`lite.s4_detect_arbiter`) on a turn only one reading lists. S4 then gets the code's list of resistances (`s4_objections_ids`) and reads the sales' response to each by id | the resistances (`detect.group`), each quote checked (a failed one: the turn's own words) |
| S4r `lite.s4_reactions` (2026-11-24, OB-28) | for each prospect turn after a resistance and before the next one (at most 12): what it does with THIS resistance (holds, no longer holds, commits with a specific element, moves forward, agrees, asks, other) and the prospect's words; twice, the arbiter tier (`lite.s4_reactions_arbiter`) on the episodes whose two readings lead to different levels | the level, the last state winning (`reaction_from_turns`); a latent episode the prospect comes back to |

S4 in code (`objections.py`): a quote must be an exact passage of a PROSPECT or co-decider turn **after the first
price** (before it: dropped and counted); the nature comes from the subjects with the OB-3 boundary tests
(`nature_of_subjects`, OB-24); objections sharing a quote are merged; one of the same nature and theme said again before
the end of the first episode is a repetition (same episode), after it a recurrence (OB-11, Romain 2026-11-20): its own
episode, linked to the first (`recurrence_of`), which takes H5 = 0. A recurrence the model left under the first objection
(no reading of its own) is an episode `to_review`, out of the scores but still counted in H5 (`recurrence:unread`). One
episode: response = the sales turns from its first passage to the topic change (the model's, checked: a SALES turn
before the next objection), reaction = the prospect turns after the first response (including the next resistance's
turn when it opens with the reaction). Acknowledge, isolate, explore, gesture, resolution, latency, items H1 to H5, prevention R1 to R3, the 70/30
combination: the engine's functions, each gesture reading checked by the engine task's validator. The reaction level comes from S4r when it gave a valid
reading of the episode (each turn's quote checked on that turn; a turn outside the list or with a failed quote is
dropped and counted, `reaction:*`), else from S4's own reaction field (`details.lite.reactions` gives the status of
each read episode: `agreed`, `arbitrated`, `single_reading`, `to_review`).

Never asked of the model: a score, a level, a verdict, the phase order, whether a component is verbatim.

## Not a sales call; the gap step read twice (2026-11-23)

S0 also answers `enrolled_client` (the person has already joined the offer, with the exact words that show it); the code
(`kind.py`) excludes the call as `not_sales_call` when the quote is valid and comes before the first price (Part C, C1b).
S2 is asked twice (`s2_readings`, default 2) and `gap.merge_readings` merges the two answers by code (Part C, C4).

## The record

The same record as `lnp_callqa.pipeline.result_record` (`docs/OUTPUT_CONTRACT.md`), stored by `crm_ca_store` and
read by `app/crm/call_analysis_view.js` (checked in a browser with a lite record: header tiles, discovery rows by
register with the letter chips and the question + answer panel, the gap panel and its four checks, the pitch staircase
and verbatim, the objections table with A · I · E · M), plus:

- `meta`: `{"engine": "lite", "version": "callqa-lite-1.2", "tier", "effort", "failed_steps", "voices" (SV: lines, relabelled, split, doubtful, control, residual, share_residual, turns before and after), "steps": {SV, SV2, S0..S4:
  {"dropped": n, "reasons": {...}}}}`; 035 keeps `meta.engine`, `meta.engine_version` and `meta.engine_steps` in
  `crm_ca_records.meta`;
- `concordance: "single_reading"` on every competence; SPIN `solicitations[].status = "single_reading"`, each with its
  `quote` and `answer`; SPIN `registers.agreement = null` (one reading: the 3/3 agreement is not measured, no
  `register_agreement_low` flag);
- OBJECTIONS `episodes[].quotes` (every passage of the objection) and `merged_items`;
- `details.lite` on Gap, Pitch and Objections (units answered, what was dropped);
- the audit: one entry per model call (task, unit, attempt, tier, prompt hash, answer, errors, stop reason).

`crm_ca_jobs.usage` keeps the token usage per tier as before, plus `engine`, `effort` and, since 2026-11-23, `usd`:
`callqa_lite.cost.estimate(usage.tiers, crm_ca_config.tiers)` prices each tier at its own model (`cost.PRICES`: claude-haiku-5-5
0.10 / 0.50 / 0.01 / 0.125, claude-sonnet-5-5 2 / 10 / 0.10 / 2.50 USD per million tokens, input / output / cache read /
cache write, provider's list of 2026-11-03, to check before relying on a figure; a model without a price row is priced at
its tier's default model and flagged `unknown_models`). The quality measure (`qa/qa_run.py --mode live`) prints the average
and maximum cost of an analysis and fails above `--max-cost` (0.20 USD on the average since 2026-11-24, Romain; 0.08 before).

## Cost of the voice check (SV, 2026-11-19)

The recorder's lines (525 to 740 for a 50 to 70-minute call) are a second prefix of about 21 000 to 29 000 tokens
(measured ratio of the turn prefix: 0.44 token per character). For about 650 lines, five chunks. Repair: cache write 27 000 ×
0.125 = 0.0034; cache reads 4 × 27 000 × 0.01 = 0.0011; chunk prompts ≈ 1 500 × 0.10 = 0.0002; output ≈ 15 000 (about
300 corrections of 15 to 25 tokens, plus a short thinking) × 0.50 = 0.0075; about 0.012 USD. Control (a second prefix
of the repaired lines, few corrections): 0.0034 + 0.0011 + 0.0002 + ≈ 6 000 × 0.50 = 0.003; about 0.008 USD. **About
0.02 USD a call**, so about 0.04 to 0.05 USD with the five steps (measured `crm_ca_jobs.usage`, November 2026: 0.019 to
0.028 USD). The same two passes on claude-sonnet-5-5 (2 / 10 / 0.10 / 2.50) would cost about 0.35 USD. To be measured
on real calls.

## Cost estimate (60-minute call, about 15 000 transcript tokens)

Prices given for claude-haiku-5-5 (USD per million tokens): input 0.10, output 0.50, cache read 0.01, cache write 0.125
(`cost.PRICES`, to check against the provider's price list). Measured on the five calls analysed on 2026-11-21 (two readings
of the gates, arbiter on claude-sonnet-5-5): 0.04 to 0.175 USD, 0.104 USD on average, the arbiter 0.055 to 0.075 USD of the
longest; the gate answers (`lite.s1_gates`) were the largest output, 58 KB over five batches on a 60-minute call, one batch cut
at `max_tokens`. Answers by ids (2026-11-23) remove the quotes and the fields at false from that output (91 % of it on the
stored analyses) and 21 % of the discovery output (`lite.s1_discovery`): to measure live.

| Call | Cached prefix (system ≈ 500 + transcript 15 000) | Step prompt (not cached) | Output (answer + short thinking) |
|---|---|---|---|
| S0 | written: 15 500 | ≈ 600 | ≈ 1 500 + 1 000 |
| S1 (1 or 2 chunks for a 30 to 40-minute discovery of 60 to 100 questions) | read: 15 500 per chunk | ≈ 1 700 per chunk | ≈ 10 000 + 2 000 in all |
| S2 | read: 15 500 | ≈ 1 400 + ≈ 1 500 of statements | ≈ 2 500 + 1 000 |
| S3 | read: 15 500 | ≈ 1 900 + references | ≈ 3 000 + 1 000 |
| S4 | read: 15 500 | ≈ 1 600 | ≈ 3 000 + 1 000 |

Since 2026-11-20 S1 reads 40 turns per call (about 4 calls for a 30 to 40-minute discovery instead of 1 or 2, each
reading the cached transcript: + about 0.002 USD) and S1g asks the gates in batches of 25 questions (2 to 3 calls,
about 8 000 output tokens: + about 0.005 USD): about + 0.007 USD a call. The second reading of the gates adds about
0.005 USD; the arbiter reads only the disputed units (expected 10 to 20 %), without the transcript: on
claude-haiku-5-5 about 0.001 USD, on claude-sonnet-5-5 about 0.02 to 0.03 USD a call. With two S1 chunks: cache write 15 500 × 0.125 = 0.0019; cache reads 5 × 15 500 × 0.01 = 0.0008; step prompts ≈ 12 000 ×
0.10 = 0.0012; output ≈ 26 000 × 0.50 = 0.013. **About 0.017 USD a call; about 0.03 USD with one replay of S1 and a
longer thinking**, under the 0.05 target and well under 0.10. (Measured before: 3.12 USD with Sonnet / Opus, 0.22 USD with
every tier on Haiku and no thinking.) The first call writes the cache, so the steps run one after the other; the cache
lives 5 minutes, enough for the five steps of one call. To be measured by the lead on real calls (`crm_ca_jobs.usage`).

## Approximations versus the methodology (each also in `docs/OPEN_DECISIONS.md`, section E)

1. **One reading, no arbiter** (Part C, C4), except the SPIN letters since 2026-11-20 (two readings of the gates and
   an arbiter on a disagreement, S1g). Each fact is read once; there is no concordance and no arbitration. C4
   allows one pass only after 95 % reproducibility on the current rules version: the lite results are `single_reading`
   and must stay "provisional" until measured.
2. **Invalid evidence is dropped item by item**, not replayed (C3 rule 7 replays a unit once, then `to_review`): an
   unproved atom, clause, claim or gesture counts as not said / not done; the whole step is replayed once only when its
   JSON is invalid. Counts per reason in `meta.steps`.
3. **Attribution check on the lines** (C1, since 2026-11-19, step SV): the model reads the recorder's lines, not the
   turns, and lists merged (two speakers in one line) and swapped lines; echoes are not looked for. C1 counts the
   repaired and the doubtful turns against its 10 % threshold; on these calls 41 to 52 % of the lines are mislabelled,
   so the lite applies the threshold **after the repair** (Romain, 2026-11-20, `voices.RESIDUAL_MAX_SHARE`): a control
   reading of the repaired lines counts the errors left (still flagged, or doubtful); more than 10 % of the lines → the
   call is `diarization_suspect`. Errors the control does not see either are not counted.
4. **SPIN letters** (since 2026-11-20): the model answers each gate with its proof and the code decides the letter
   (S1g, the engine's `decide_letter`), as in §3; S1's own letter is only the fallback when no valid gate answer
   came back; the code enforces the hard rules it can read in the text: validation tail, closed need-payoff,
   and since 2026-11-19 a tail alone ("Tu vois ?"), the load of a solution (time to dedicate, budget: `SOLUTION_LOAD`)
   and a question about the offer (`OFFER_QUESTION`), in English and French. Since 2026-11-20 also: a check-in (`CHECK_IN`), a closed restatement
   (`closed_restatement`) and a choice among the sales' options (`CHOICE_LIST`), §3. Segmentation (SEG-1, Romain 2026-11-20):
   the code lists the solicitations, one per sales turn read on its priority question (`spin.group_turn`,
   `engine.inventory`); the model reads every listed item by its id (a forgotten one is asked again once, then counted
   `question:not_read`; a gap validation request is answered `routing`) and may add a request without a
   question mark on a turn the code did not list (never on a turn listed in another chunk:
   `question:turn_of_another_chunk`, the turn is read with its own chunk). Several questions the model adds on one
   unpunctuated turn are one too, read on the last unless it only follows up the previous (`question:same_turn_grouped`). C4 (2026-11-20): one reading never removes a listed question: an
   unread one and one S1 sends to gate 0 (`question:routing_s1`) go to the gates all the same, and the two readings of
   the gates (the arbiter on a disagreement) decide; with no valid gate answer, S1's gate 0 stands (`question:routing`)
   and a question nobody read stays listed `to_review` (tag `unread`, left out of the scores). The code's own
   priority question is not held to the 40-word limit of a quoted question. SB-21 (action-plan N without a future state) is left to the model's OUT
   `solution_load`. The perimeter never starts on a social, logistic or framing question, whatever its letter
   (SB-2, `SOCIAL_LOGISTIC`, 2026-11-19). Since 2026-11-21 (Romain, SB-1) the discovery opens on a register: the first S, P, I or N question
   whose register (read on a copy of the units before the perimeter, as for the discovery) is one of the four, or the
   first prospect turn with an effect the model read, a fact naming a register, or one of the code's figures, costs or
   blockers (`spin.code_opening_info`), whichever comes first (`perimeter.opened_by`: `question` or `prospect_info`).
   A question no gate passes while its answer holds an S1 effect is read once more by the arbiter (`gates:absent_reread`).
5. **SPIN chains**: "same object" (SB-16) = the model's object labels agree and the engine's lexical check passes,
   instead of a `spin.link` question per pair.
   S1g prompt (2026-11-21): French examples for gate 2 (an open question on the present situation) and gate 5 (what
   blocks, what is hard, « tu es en difficulté ? »), and a re-reading before answering every gate false.
   S1g readings (2026-11-21): "not a solicitation" and OUT `nothing` are one outcome when the two readings are compared
   (§2, SB-2: neither leaves anything to read), so they agree without the arbiter. The prompt says that a social,
   logistic or framing question is a solicitation (with g1 `nothing`); on 5 calls, 74 of 88 disagreements came from one
   reading calling a plain question « not a solicitation ».
6. **Registers**: when the words of the question name one register (SB-27), the code takes it, whether the model
   read the register in the answer, in the question with another domain, or gave no reading at all (an unread question); a neutral question with no reading, or read « none » though
   answered, takes the one domain its first answer turn names, else No register (« Sans registre », SB-31, `register:other_by_code`); the
   work of today (domain `status`) has no register (Romain, 2026-11-21: « tu es à la retraite et tu donnes des cours ? »
   read as money is « Sans registre », a neutral fact, instead of an undecided conflict). A register read in the answer (SB-35) whose answer turn is missing or wrong is placed by the code
   when the prospect's words it quotes are in exactly one turn of the answer (`register:turn_found_by_code`); without
   those words there is no proof and the register stays `to_review`. Single reading, so the SB-33 reliability measure (share decided 3/3, 92 %) is not computed
   (`agreement: null`). The SB-32 code checks still run (quote place, rule order, word-list conflict); a rejected
   register is `to_review` and left out of the counts.
7. **Gap**: the X13 check (a figure that is not the present state) uses the atom's `figure_kind` from S1 (a figure
   without a kind counts as present); the stopping question (GB-30) is S1's flag (the engine's regex still applies
   first). The validation must be read on the prospect turn right after the passage (GB-8, code): a reading of another
   turn makes the unit `to_review`.
8. **Objections**: (a) only resistances after the first price (OB-27, Romain, 2026-11-03; the engine applies the same
   rule). (b) Since 2026-11-20 a recurrence opens its own episode as in the method (OB-11); two natures in one passage
   (OB-4) are merged into one when they share a quote. (c) The
   topic change (OB-8) is the model's single answer, checked to be a SALES turn before the next objection, not the
   engine's code-and-question walk turn by turn. (d) The deadlines found at detection (OB-2, OB-25) do not feed
   prevention; only S4's prevention facts do.
9. **Language** (fixed 2026-11-19): the code helpers of the engine read French as well as English
   (`engine/lnp_callqa/core/lang_fr.py`): words keep their accented letters and French elisions are split; stop words,
   generic words, approvals, the GB-22 person shift (« je » → « tu », the language of the two passages decides), numbers
   in words and « 1 500 », question forms, validation tails, echoes, register words, gap openers and validation
   requests, offer words, objection markers and contradictions, units and compliments. Tests: `engine/tests/test_french.py`.
   Before, a French call was checked with English lists: « épuisée » was cut into « puis » + « e », « de » passed as a
   verbatim key expression, « pour » or « avec » made a follow-up.
10. **Screen**: the objections table shows the first quote of each objection (`resistance.quote`); the other quotes
    are in `episodes[].quotes` until the screen reads them.

## Files

`callqa_lite/engine.py` pipeline · `voices.py` SV, who says each line · `steps.py` model calls, JSON, replay, mock client · `shim.py` the engine's runner
interface answered from a step · `phases.py` S0 · `spin.py` S1 → SPIN · `gap.py` S2 → Gap · `pitch.py` S3 → Pitch ·
`objections.py` S4 → Objections · `cost.py` · `prompts/*.md` (English: translating them would change the reading) ·
`tests/` (fictional call `synthetic_call.py`, no real data).

```
cd call-analysis/lite && python3 -m pytest -q tests
```
