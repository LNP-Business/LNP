# Open decisions and known contradictions

Nothing in this list may be invented by the implementer. Each item stays a configurable constant or a flagged
`uncovered_case` until the methodology owner (Romain) decides. When a decision is taken, update in the same change:
the methodology file, the memo, the engine constant or rule, and the tests.

## A. Inputs to provide (blocking for production)
1. ~~Model identifiers for the tiers~~ decided 2026-10-25 (Romain): `fast` = `claude-haiku-5-5`, `strong` = `claude-sonnet-5-5`,
   `arbiter` = `claude-opus-5-5`, stored in `crm_ca_config`. The API key is a Supabase function secret (`ANTHROPIC_API_KEY`), never in code.
2. Offer reference: price and payment options, guarantees, components, phases, and **the nine mechanisms**
   (Skill, Legitimacy, Pricing, Acquisition, Selling, Delivery, Time, Past failure, Financial risk): for each, the
   principle in one sentence, the offer phase that carries it, lexical cues.
3. Case library: client cases with consent flag, starting point (value, unit, profile), figures; the matching rule
   between a case's starting point and the prospect's A (`case_match_factor`, currently None).
4. Speaker mapping per recording source; call metadata (round, cycle id to link follow-up calls).

## B. Methodology decisions (proposals in place, "to validate")
- Weights and thresholds of every competence (SPIN 15/20/30/20/15; Gap 10/10/10/20/25/25; Pitch 15/20/15/15/10/15/10;
  Objections handling 25/10/20/35/10, prevention 40/40/20, combination 70/30, anxiety/inertia weight 1.5).
- Pitch compliance severity: score 0 (current) or cap at 40.
- Gap: verbatim threshold (one exact head word for the gate vs 3 consecutive words); allowed transformations;
  B only from N answers; P tie-break; whether B without a horizon can reach G2 = 2; a restitution between the
  first pitch and the first price (proposal: cannot pass); "in one go" tolerates backchannel ("yeah", "mm-hmm")
  inside the restatement (current reading).
- Roadmap: order in which blockers must fall; whether the blocker treated in the pitch is also a roadmap step
  (3 or 4 blockers for a 3-step roadmap); meaning of the page check "no link".
- Objection gestures: decided 2026-10-25 (Romain): **A · I · E · M** (acknowledge, isolate, explore, matching gesture),
  not the earlier A · I · C.
- Taxonomy of pitch blockers: 4 of 7 real blockers in the calibration set fit none of the nine categories
  (fear of change, overthinking, "not treating it as a need", lack of money).
- Minimum volume rules (5 evaluable calls; SPIN minimum 5 coded questions), coaching targets.
- SPIN registers (v1.2, Romain 2026-10-27): the four registers and their domains are decided; decided the same day:
  OUT solicitations get no register; SPIN stops at the pitch (SB-34 replaces the SB-3 / SB-4 reopenings); no
  human-labelled verification set for now. Decided 2026-10-29 (v1.3, SB-35): an open question takes the register of
  the prospect's answer to it. Still open: the word lists of SB-30.

## C. Contradictions between rules and calibration cases (the engine follows the most recent rule)
- SPIN: SB-24 (frequency alone not quantified) vs calibration B2 case 9; SB-19 (echo "A lot?" counts as followed up)
  vs B4 case 4; SB-18 vs SB-20 on what breaks a chain (SB-20 wins); domain lists of §2 vs §4 differ.
- Gap: call 129 — GB-17 calls "Why do you have to go saying that?" confirmed with content, B3.10 says not validated;
  call 098 — GB-14 may place the restitution before the pitch, B1.11 places it after; B3.7 vs GB-20 on
  `restitution_after_pitch` (engine constant `AFTER_PITCH_REASON_REQUIRES_PASSING = False`).
- Pitch: calibration case 5 (call 102) vs PB-17; cases 8, 9, 10, 14 say "no rule" but PB-18/19/20 now cover them;
  a cited case without consent — is it also `out_of_gap_claim`?
- Objections: calibration cases 13, 17, 24 vs OB-20 (elliptical exploration) and OB-21 (mindset reframe = partial);
  exclusion X7 needs rewording; "what if it doesn't work?" listed as anxiety · choice but boundary test 1 gives
  objection · trust; an anxiety stated in discovery may be scored in Gap/Pitch and Objections; how "two quotes for
  level 2" applies to yes/no items.
- Phases (Romain 2026-11-03): SB-1 (the discovery ends at the validation of the gap that makes it present) and the PB-3
  addition (the first price goes with the explanation of the offer; an introduction is never the pitch start) are applied
  in the lite engine only; the reference engine still ends the discovery at the pitch start or price and decides the
  price with its PB-18 plausibility band (offer reference not configured: crm_ca_offer is empty).
- Objections, OB-27 (Romain 2026-11-03: only after the first price): the calibration cases (04_objections_C) and the
  Annex B tests whose resistance comes before the call's first price now open no episode and must be re-read; case 25
  (call 044) needs the call's first-price turn in its test. The objections memo needs the same update.
- All calibration verdicts are proposals until two certified annotators confirm them blind.

## D. Engine interpretations to confirm (implemented as constants or documented choices)
- Pitch: K2 capped at 1 without the mechanism reference; calculation claims accepted when one operand is the
  prospect's figure; claims with missing reference data flagged `unchecked` (not failing the gate); K6 level 2 needs
  a price and the decision request after it; K7 single projection uses the sales gesture as second quote.
- Gap: G1 = 2 for a quantified A when B is absent or not quantified; "first said by the sales" (X12) applied to
  figures and multi-word expressions only; GB-19 rescue (setter notes restated by the prospect) not implemented;
  problem `type` not produced.
- Objections: call-level H items take the weakest episode; H5 across calls reads earlier episodes from
  `prior_inputs` and is flagged provisional; "other" reactions scored as acknowledged and tagged; the OB-8 (a)
  topic-change rule is strict (episodes often end at the next resistance) — check against the reliability target.
- SPIN: only a P opens a deep chain; unanswered stacked units do not break a chain; the stacked-question exception
  decided by shared words.

## E. Lite engine (`call-analysis/lite`, 2026-11-03): approximations to confirm
The lite engine (`crm_ca_config.engine = 'lite'`, five whole-transcript steps on the fast tier, target 0.10 USD a call)
keeps the rule "the model quotes, the code decides" and the engine's decision code, with these approximations
(details in `call-analysis/lite/README.md`):
- One reading per fact, no arbiter (C4 requires 95 % reproducibility before one pass): results `single_reading`, to
  stay provisional until the lite and full engines are compared on the same calls.
- Invalid evidence dropped item by item (an unproved atom, clause, claim or gesture counts as not said / not done)
  instead of a replay of the unit (C3 rule 7); only an invalid JSON answer is asked again once.
- No model attribution check (C1): the code's diarization gate only.
- SPIN: the letter is the model's reading of the gates, with the code's hard rules (validation tail, closed
  need-payoff); segmentation is the model's listing; same object (SB-16) = matching object labels + the lexical check;
  SB-21 left to the model's OUT reason; register agreement (SB-33) not measured.
- Gap: X13 read from the atom's figure kind (no kind = present); the stopping question (GB-30) is a flag of S1.
- Objections (Romain 2026-11-03): only after the pitch start, each objection once; repeats after its episode are a
  recurrence (H5 = 0); two natures in one passage (OB-4) merged when they share a quote; topic change (OB-8) read once by
  the model and checked by code; detection deadlines (OB-2, OB-25) do not feed prevention.
- Language: the engine's word lists (approvals, tails, GB-22 person shift, stop words) are English; on a French call
  they apply as in the reference engine.
- Screen: the objections table shows the first quote of each objection; `episodes[].quotes` holds the others.
