# Bounding index: every element the engine finds in a transcript, and the rule that bounds it

"Bounding" (bornage) = the exact rules that say where an element starts and ends in a raw transcript, what counts,
and what never counts. A rule that is not written in these files does not exist: an uncovered case goes to the arbiter
with the label `uncovered_case` and becomes a new numbered rule in the next version.

Read in this order for each competence: `0N_<x>_A_scoring.md` (definitions, items, gates, output contract) →
`0N_<x>_B_bounding_rules.md` (the bounding rules, exclusions, minimal pairs) → `0N_<x>_C_calibration_cases.md`
(real annotated cases, the non-regression set). Common evidence rules, pipeline, aggregation: `00_engine_common_part_C.md`.

## Shared elements (computed once per call)

| Element | Rules | File |
|---|---|---|
| Turns, speaker roles, diarization gate, merged / swapped / echo turns | C1 | `methodology/00_engine_common_part_C.md` |
| Exact quote, right speaker, right place, two quotes for level 2, approval is not evidence | C3 | `methodology/00_engine_common_part_C.md` |
| Pitch start, offer mention, first price, early price, decision request, pitch end | PB-1 to PB-4, PB-17 to PB-19, PB-21 | `methodology/03_pitch_B_bounding_rules.md` |
| Discovery perimeter (start, end; no reopening since v1.2) | SB-1, SB-2, SB-25, SB-34 (SB-3, SB-4 superseded) | `methodology/01_spin_B_bounding_rules.md` |
| Verbatim rule (key expression, allowed transformations) | GB-22 to GB-27 | `methodology/02_gap_B_bounding_rules.md` |

## SPIN · solicitation units (segmentation)

| Rule | What it bounds | File |
|---|---|---|
| SEG-1 | One interrogative clause, one solicitation. Three questions in one turn are three units | `methodology/01_spin_A_scoring.md` |
| SEG-2 | Two coordinated interrogatives are two units if the prospect can answer one without the | `methodology/01_spin_A_scoring.md` |
| SEG-3 | An alternative ("is it the price or the timing?") is one unit. | `methodology/01_spin_A_scoring.md` |
| SEG-4 | A validation tail ("…, right?", "…, no?", "…, is that it?", "does that make sense?") be | `methodology/01_spin_A_scoring.md` |
| SEG-5 | A declarative preamble in the same turn is not a solicitation, but its words count for  | `methodology/01_spin_A_scoring.md` |
| SEG-6 | An interrupted question counts if it is intelligible and the prospect answers it; other | `methodology/01_spin_A_scoring.md` |
| SEG-7 | Backchannel ("hmm?", "oh yeah?", "really?") spoken over the prospect is never a solicit | `methodology/01_spin_A_scoring.md` |
| SEG-8 | Only the sales produces solicitations. A question of the prospect is never coded. | `methodology/01_spin_A_scoring.md` |
## SPIN · perimeter, answers, atoms, chains

| Rule | What it bounds | File |
|---|---|---|
| SB-1 | Borders | `methodology/01_spin_B_bounding_rules.md` |
| SB-2 | Social and framing questions | `methodology/01_spin_B_bounding_rules.md` |
| SB-3 | Reopenings (superseded by SB-34) | `methodology/01_spin_B_bounding_rules.md` |
| SB-4 | Questions inside the pitch (superseded by SB-34) | `methodology/01_spin_B_bounding_rules.md` |
| SB-5 | Answer span | `methodology/01_spin_B_bounding_rules.md` |
| SB-6 | Stacked questions | `methodology/01_spin_B_bounding_rules.md` |
| SB-7 | Short first answer | `methodology/01_spin_B_bounding_rules.md` |
| SB-8 | Volunteered speech | `methodology/01_spin_B_bounding_rules.md` |
| SB-9 | One atom, one passage | `methodology/01_spin_B_bounding_rules.md` |
| SB-10 | PAIN or IMPACT | `methodology/01_spin_B_bounding_rules.md` |
| SB-11 | SITUATION or IMPACT for figures | `methodology/01_spin_B_bounding_rules.md` |
| SB-12 | DESIRE or reaction to the offer | `methodology/01_spin_B_bounding_rules.md` |
| SB-13 | DESIRE or VALUE | `methodology/01_spin_B_bounding_rules.md` |
| SB-14 | Prompted content | `methodology/01_spin_B_bounding_rules.md` |
| SB-15 | Quantified | `methodology/01_spin_B_bounding_rules.md` |
| SB-16 | Object | `methodology/01_spin_B_bounding_rules.md` |
| SB-17 | Followed up | `methodology/01_spin_B_bounding_rules.md` |
| SB-18 | Deep chain | `methodology/01_spin_B_bounding_rules.md` |
| SB-19 | Echo follow-ups | `methodology/01_spin_B_bounding_rules.md` |
| SB-20 | What breaks a chain | `methodology/01_spin_B_bounding_rules.md` |
| SB-21 | Action-plan questions | `methodology/01_spin_B_bounding_rules.md` |
| SB-22 | Income drop | `methodology/01_spin_B_bounding_rules.md` |
| SB-23 | Reported speech | `methodology/01_spin_B_bounding_rules.md` |
| SB-24 | Quantified, precisely | `methodology/01_spin_B_bounding_rules.md` |
| SB-25 | Financing questions | `methodology/01_spin_B_bounding_rules.md` |
| SB-26 | Register of a question (Financial, Time & load, Identity & status, Mental & emotional, Other); which questions get one | `methodology/01_spin_B_bounding_rules.md` |
| SB-27 | The register is read from the question when it names a domain, else from its effect (SB-35) | `methodology/01_spin_B_bounding_rules.md` |
| SB-28 | Asked domain over premise; first asked domain in reading order | `methodology/01_spin_B_bounding_rules.md` |
| SB-29 | Subject of the seven domains named in the question; reference (only when there is no answer) | `methodology/01_spin_B_bounding_rules.md` |
| SB-30 | Domain words per register (code word lists) | `methodology/01_spin_B_bounding_rules.md` |
| SB-31 | Other (the answer talks about none of the seven domains, or no answer and nothing named) | `methodology/01_spin_B_bounding_rules.md` |
| SB-32 | Code checks: quote, lexicon conflict, three passes, arbiter, `to_review` | `methodology/01_spin_B_bounding_rules.md` |
| SB-33 | Reliability: 92 % target, per-call 3/3 agreement gate | `methodology/01_spin_B_bounding_rules.md` |
| SB-34 | SPIN stops at the pitch: nothing after the first pitch start or price is SPIN | `methodology/01_spin_B_bounding_rules.md` |
| SB-35 | Open question (no domain named): the register of the prospect's answer, the effect of the question (v1.3) | `methodology/01_spin_B_bounding_rules.md` |
## Gap · restitution, components, validation, formula, verbatim

| Rule | What it bounds | File |
|---|---|---|
| GB-1 | Span | `methodology/02_gap_B_bounding_rules.md` |
| GB-2 | One restitution or two | `methodology/02_gap_B_bounding_rules.md` |
| GB-3 | Component recognition | `methodology/02_gap_B_bounding_rules.md` |
| GB-4 | Restitution or not | `methodology/02_gap_B_bounding_rules.md` |
| GB-5 | Restitution or pitch | `methodology/02_gap_B_bounding_rules.md` |
| GB-6 | Restitution or story | `methodology/02_gap_B_bounding_rules.md` |
| GB-7 | The cost component | `methodology/02_gap_B_bounding_rules.md` |
| GB-8 | The validation turn | `methodology/02_gap_B_bounding_rules.md` |
| GB-9 | Validation captured by another question | `methodology/02_gap_B_bounding_rules.md` |
| GB-10 | Validation outcomes | `methodology/02_gap_B_bounding_rules.md` |
| GB-11 | Several restitutions | `methodology/02_gap_B_bounding_rules.md` |
| GB-12 | Speakers | `methodology/02_gap_B_bounding_rules.md` |
| GB-13 | Follow-up calls | `methodology/02_gap_B_bounding_rules.md` |
| GB-14 | Which pitch start | `methodology/02_gap_B_bounding_rules.md` |
| GB-15 | "No" to "did I miss anything?" | `methodology/02_gap_B_bounding_rules.md` |
| GB-16 | Partial agreement | `methodology/02_gap_B_bounding_rules.md` |
| GB-17 | Emotional reaction | `methodology/02_gap_B_bounding_rules.md` |
| GB-18 | Cost played down | `methodology/02_gap_B_bounding_rules.md` |
| GB-19 | Notes from earlier touchpoints | `methodology/02_gap_B_bounding_rules.md` |
| GB-20 | Absence reasons: priority and plurality | `methodology/02_gap_B_bounding_rules.md` |
| GB-21 | Merged turns | `methodology/02_gap_B_bounding_rules.md` |
| GB-22 | Key expression | `methodology/02_gap_B_bounding_rules.md` |
| GB-23 | Quoting marker | `methodology/02_gap_B_bounding_rules.md` |
| GB-24 | Figures | `methodology/02_gap_B_bounding_rules.md` |
| GB-25 | Correction | `methodology/02_gap_B_bounding_rules.md` |
| GB-26 | Validation in the prospect's words | `methodology/02_gap_B_bounding_rules.md` |
| GB-27 | Several possible sources | `methodology/02_gap_B_bounding_rules.md` |
| GB-28 | Selecting A | `methodology/02_gap_B_bounding_rules.md` |
| GB-29 | Selecting B | `methodology/02_gap_B_bounding_rules.md` |
| GB-30 | Selecting P (one single blocker) | `methodology/02_gap_B_bounding_rules.md` |
| GB-31 | Formula conformity of a restitution | `methodology/02_gap_B_bounding_rules.md` |
| GB-32 | Roadmap blockers | `methodology/02_gap_B_bounding_rules.md` |
| GB-33 | Copilot warning | `methodology/02_gap_B_bounding_rules.md` |
| GB-34 | In one go | `methodology/02_gap_B_bounding_rules.md` |
## Pitch · anchors, segments, steps, roadmap, claims, promises, adhesion

| Rule | What it bounds | File |
|---|---|---|
| PB-1 | Pitch start | `methodology/03_pitch_B_bounding_rules.md` |
| PB-2 | Offer mention (not a pitch start) | `methodology/03_pitch_B_bounding_rules.md` |
| PB-3 | First price | `methodology/03_pitch_B_bounding_rules.md` |
| PB-4 | Pitch end | `methodology/03_pitch_B_bounding_rules.md` |
| PB-5 | Pitch over two calls | `methodology/03_pitch_B_bounding_rules.md` |
| PB-6 | Segment boundaries | `methodology/03_pitch_B_bounding_rules.md` |
| PB-7 | Segment label | `methodology/03_pitch_B_bounding_rules.md` |
| PB-8 | What a link is | `methodology/03_pitch_B_bounding_rules.md` |
| PB-9 | What is not a link | `methodology/03_pitch_B_bounding_rules.md` |
| PB-10 | Inputs | `methodology/03_pitch_B_bounding_rules.md` |
| PB-11 | Check-in | `methodology/03_pitch_B_bounding_rules.md` |
| PB-12 | Not a check-in | `methodology/03_pitch_B_bounding_rules.md` |
| PB-13 | Answered with content | `methodology/03_pitch_B_bounding_rules.md` |
| PB-14 | Adhesion | `methodology/03_pitch_B_bounding_rules.md` |
| PB-15 | Not adhesion | `methodology/03_pitch_B_bounding_rules.md` |
| PB-16 | The gesture before adhesion | `methodology/03_pitch_B_bounding_rules.md` |
| PB-17 | Unsolicited mention | `methodology/03_pitch_B_bounding_rules.md` |
| PB-18 | Hypothetical and range amounts | `methodology/03_pitch_B_bounding_rules.md` |
| PB-19 | Price before the pitch | `methodology/03_pitch_B_bounding_rules.md` |
| PB-20 | Inputs outside the transcript | `methodology/03_pitch_B_bounding_rules.md` |
| PB-21 | Number normalisation | `methodology/03_pitch_B_bounding_rules.md` |
| PB-22 | Market doubt | `methodology/03_pitch_B_bounding_rules.md` |
| PB-23 | Restating to check understanding | `methodology/03_pitch_B_bounding_rules.md` |
| PB-24 | Projection used to postpone | `methodology/03_pitch_B_bounding_rules.md` |
| PB-25 | Closed fit questions and scales | `methodology/03_pitch_B_bounding_rules.md` |
| PB-26 | Merged turns | `methodology/03_pitch_B_bounding_rules.md` |
| PB-27 | Category of P | `methodology/03_pitch_B_bounding_rules.md` |
| PB-28 | Step 1 | `methodology/03_pitch_B_bounding_rules.md` |
| PB-29 | Step 2 | `methodology/03_pitch_B_bounding_rules.md` |
| PB-30 | Step 3 | `methodology/03_pitch_B_bounding_rules.md` |
| PB-31 | Step 4 | `methodology/03_pitch_B_bounding_rules.md` |
| PB-32 | Order | `methodology/03_pitch_B_bounding_rules.md` |
| PB-33 | Sentences | `methodology/03_pitch_B_bounding_rules.md` |
| PB-34 | Roadmap | `methodology/03_pitch_B_bounding_rules.md` |
| PB-35 | Claims outside his gap or the offer | `methodology/03_pitch_B_bounding_rules.md` |
| PB-36 | Outcome promise | `methodology/03_pitch_B_bounding_rules.md` |
| PB-37 | Pitch before the yes | `methodology/03_pitch_B_bounding_rules.md` |
## Objections · resistance, nature, episode, gestures, resolution, prevention

| Rule | What it bounds | File |
|---|---|---|
| OB-1 | Candidate | `methodology/04_objections_B_bounding_rules.md` |
| OB-2 | Exclusions at detection | `methodology/04_objections_B_bounding_rules.md` |
| OB-3 | Nature: boundary tests | `methodology/04_objections_B_bounding_rules.md` |
| OB-4 | Mixed passages | `methodology/04_objections_B_bounding_rules.md` |
| OB-5 | One resistance over several turns | `methodology/04_objections_B_bounding_rules.md` |
| OB-6 | Start | `methodology/04_objections_B_bounding_rules.md` |
| OB-7 | Response | `methodology/04_objections_B_bounding_rules.md` |
| OB-8 | Topic change | `methodology/04_objections_B_bounding_rules.md` |
| OB-9 | Reaction | `methodology/04_objections_B_bounding_rules.md` |
| OB-10 | Latent | `methodology/04_objections_B_bounding_rules.md` |
| OB-11 | Recurrence | `methodology/04_objections_B_bounding_rules.md` |
| OB-12 | Speakers | `methodology/04_objections_B_bounding_rules.md` |
| OB-13 | Acknowledge | `methodology/04_objections_B_bounding_rules.md` |
| OB-14 | Isolate | `methodology/04_objections_B_bounding_rules.md` |
| OB-15 | Explore | `methodology/04_objections_B_bounding_rules.md` |
| OB-16 | Matching gesture | `methodology/04_objections_B_bounding_rules.md` |
| OB-17 | Resolution | `methodology/04_objections_B_bounding_rules.md` |
| OB-18 | Before the price | `methodology/04_objections_B_bounding_rules.md` |
| OB-19 | Supposition | `methodology/04_objections_B_bounding_rules.md` |
| OB-20 | Elliptical exploration | `methodology/04_objections_B_bounding_rules.md` |
| OB-21 | Mindset reframe on an anxiety | `methodology/04_objections_B_bounding_rules.md` |
| OB-22 | Receive and leave in one turn | `methodology/04_objections_B_bounding_rules.md` |
| OB-23 | Commitment to a proposed answer | `methodology/04_objections_B_bounding_rules.md` |
| OB-24 | Denied anxiety | `methodology/04_objections_B_bounding_rules.md` |
| OB-25 | External reason that also limits time | `methodology/04_objections_B_bounding_rules.md` |
| OB-26 | Attribution | `methodology/04_objections_B_bounding_rules.md` |

## Exclusion rules
Each bounding file ends with an exclusion table ("Never counts as…", X1, X2, …) and a table of minimal pairs (two passages that differ by one element and change the verdict). Minimal pairs are implemented as unit tests in `engine/tests/`.
