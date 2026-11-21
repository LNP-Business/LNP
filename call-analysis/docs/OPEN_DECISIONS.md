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
- Attribution (C1, since 2026-11-19, step SV, always on): the model lists the mislabelled lines of the recorder (whole
  line or from an exact quote), the code checks and repairs them before any other step; no echo check. The 10 % threshold
  of C1 applies **after the repair** (Romain, 2026-11-20): a control reading of the repaired lines counts the errors left
  (still flagged, or doubtful); more than 10 % of the lines → `diarization_suspect`. C1 as written also counts the
  repaired turns: on the calls of November 2026, 41 to 52 % of the lines are mislabelled, so it would exclude almost
  every call. Methodology (Part C, C1) to update.
- SPIN: the letter is the model's reading of the gates, with the code's hard rules (validation tail, closed
  need-payoff); segmentation is the model's listing; same object (SB-16) = matching object labels + the lexical check;
  SB-21 left to the model's OUT reason; register agreement (SB-33) not measured.
- Gap: X13 read from the atom's figure kind (no kind = present); the stopping question (GB-30) is a flag of S1.
- Objections (Romain 2026-11-03): only after the first price. Recurrence (Romain 2026-11-20, settled): the method's
  OB-11, a new episode linked to the first, only after the first episode ended (topic change or another resistance);
  said again before, a repetition. Two natures in one passage (OB-4) merged when they share a quote; topic change (OB-8) read once by
  the model and checked by code; detection deadlines (OB-2, OB-25) do not feed prevention.
- Language (2026-11-19, `core/lang_fr.py`): the word lists read French as well as English. Two French readings to
  confirm: (a) settled 2026-11-20 (Romain): « mais », « en fait », « sauf que » contradict only without a receiving
  marker before them or when a counter or a denial follows (OB-13, French bullet); Objections memo to update; (b) « tu vois ? » / « vous voyez ? » at the end of a question is a tic, not a validation tail (only alone is it a
  tail), unlike "you know?" in English.
- SB-2 by code (2026-11-19): a social, logistic or framing question never starts the perimeter whatever its letter;
  the list (`SOCIAL_LOGISTIC`) includes « as-tu vu le live / la conférence ? ». SB-2 keeps « what made you book the
  call? » as a valid start; « qu'est-ce que t'attends de notre appel ? » is left to the model (start, N or OUT).
- SB-27 by code (2026-11-19): the register of a question whose asked clause names one domain is read in the question,
  not in its answer; the asked clause is the last sentence, after the last comma (SB-28 premise).
- GB-1 (2026-11-19): an offer word said before the first restated clause, in the same turn, does not end the
  restitution (« dans notre accompagnement on préconise 4 heures… En fait, je comprends que… »). Gap memo to update.
- Screen: the objections table shows the first quote of each objection; `episodes[].quotes` holds the others.

## F. Settled 2026-11-20 (Romain)
- « tu vois ? » / « vous voyez ? » at the end of a question is a tic, not a validation tail (E (b), confirmed).
- §3 hard rules added (2026-11-20): check-in → OUT nothing, closed restatement (« donc … ? » without an open word) →
  OUT agreement, choice among the sales' options without an open branch → OUT sales_list. To watch in the measure:
  « Donc tu as déjà des élèves ? » is read as a closed restatement (agreement), not as an S.
- SPIN letters, C4 (2026-11-20): the gates are read twice; a disagreement goes to the arbiter tier, which walks the
  gates again (never a vote); an undecided unit is `to_review` and left out of the scores. Arbiter model (decided
  2026-11-20, Romain left it to the team): claude-sonnet-5-5 for `crm_ca_config.tiers.arbiter` (fast and strong stay
  claude-haiku-5-5), set in the online configuration when the S1g PRs are merged; to be confirmed by the measure.
- SPIN letters (2026-11-20): the lite engine asks the closed gates of each question (S1g, batches of 25 with context)
  and decides the letter by code with the engine's `decide_letter`, as in §3; S1 reads 40 turns per call (was 160).
- Human corrections (C8, migration 063): an administrator corrects a SPIN letter on the screen; the correction is kept
  (additions only) and shown beside the engine's letter; the score is not recomputed; `qa/corrections_to_reference.py`
  feeds the reference set. Other fields (registers, gap, objections) can follow the same table (`field`).
- Cut recordings (C1): a recording shorter than 20 minutes (its last timestamp) is not analysed
  (`recording_incomplete`, no model call), whatever the planned length of the call.
- SEG-1: the questions of one sales turn are one solicitation, read on the last one unless it only follows up the one
  before (« pourquoi ? »): then the one before. The code lists them, one per turn; the model reads every listed one (a
  forgotten one is asked again once, then counted `question:not_read`). Lite engine only: **the reference engine still
  splits one unit per question** (its 12 calibration tests use `Q….2` units): to port with those cases. SPIN memo to update.
- SB-2: « qu'est-ce que tu attends de notre appel ? » is framing (OUT `nothing`), never the discovery start.
- SB-8: an effect stated in answer to an OUT question counts, as volunteered speech (D1 to D4, never D5). SPIN memo to update.
- Disguised price (PB-3): a market tour whose levels are the company's offers, tied to the offer later, is the first
  price, an error of the sales (`disguised_price`; Anastasia's T095). Pitch memo to update.
- Calls of one cycle (Part C, C9): discovery and gap evaluated in a later call only after a bad gap (absent, incomplete
  or not validated); the pitch evaluated once, in the first call where it happens; objections from the start of a call
  once the price was given earlier; an unknown earlier call → read as a first call; a bad gap not followed up before the
  pitch → flag `gap_not_remedied`, no weight of its own. Memos to update: SPIN, Gap, Pitch, Objections (one paragraph each).
- GB-28 / GB-29 (GAP-1.4, 2026-11-20, audit of the gap verbatims on the six calls: A right in 0 of 6, B in 3 of 6): the
  code lists the prospect's figures and targets (`core/figures.py`, GB-28b); A is selected on B's dimension and is never
  an unrelated fact (no unquantified fallback); B is the most recent target in figures, N answers first, else the most
  recent target wherever it was said. Replay on the 16 stored analyses: gap elements right 46 % → 82 %. Scores G1 to G3
  move with the rules version (C8): the stored analyses are to be re-run. Gap memo to update (§2.1 and Annex A).
- GB-7b (GAP-1.4, 2026-11-20): the code lists the prospect's cost statements with a lexicon per cost domain
  (`core/costs.py`), next to the model's IMPACT atoms; what the prospect said is listed over the whole window. Replay:
  costs right 5 → 11 of 12 on the six calls (tuning set: control calls still to be read, C7). The lexicon is a
  configuration to grow from the calls people check; a cost the lexicon misses is still the model's to list.

## G. Settled 2026-11-21 (Romain)

- SPIN §5 health: a call's discovery is excluded only when more than 5 % of its perimeter questions are OUT `absent`
  **and** at least 3 of them (`ABSENT_MIN_COUNT`). On calls of 10 to 40 questions, one or two such questions excluded the
  discovery of 4 calls out of 5 (Part C, C7 health row updated).
- SPIN §3 hard rules: a question cut before its end (ellipsis) is OUT `nothing`; a difficulty named by the sales in their
  own words is OUT `agreement` (`difficulty_named_by_sales`). The lite gates prompt gives French examples for S and P.
  On the 5 calls analysed on 2026-11-21: questions with no gate 10 → 3, discovery scored in 4 calls out of 5 instead of 1.
  SPIN memo to update (§3 hard rules, §5 applicability) and Part C memo (C7 health).
- (Replaced below, same day.) Registers (SB-26, SB-30): Identity & status also covers the prospect's work today (new domain `status`: trade, subject,
  job status, seniority, background, retirement, activity); Other keeps a place, a date, a tool, logistics. The code's
  lexicon gets the words of the work of today, reads a word after an elision (« d'élèves ») and skips a short tail
  (« …, toi ? », « …, du coup ? ») to find the asked clause; a question with no S1 reading takes the register its words
  name. On the 5 calls: Identity & status 9 → 15 questions, Other 9 → 3. SPIN memo to update (registers).
- Registers (SB-31): a neutral question with no register reading, or read « none » though answered, takes the one domain
  the words of its first answer turn name, else Other (never undecided). On the 5 calls: 5 undecided registers → 0.
- Registers, second decision of 2026-11-21 (replaces « Identity & status covers the work of today »): the four registers are
  the levers the discovery explores; « Other » becomes « No register » (« Sans registre », key `other`) and holds the
  neutral facts of the situation (domain `status`: trade, subject, seniority, retirement as a fact, daily life), a place,
  a date, a tool. Identity & status keeps the future (who they want to become, a change of path, « projet »). On the 5
  calls: Identity & status back to the real identity questions, the intake facts under « Sans registre ».
