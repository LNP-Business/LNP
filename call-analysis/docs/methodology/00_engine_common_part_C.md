# Part C · The evaluation engine (common to the four competences)

This part is identical in the four methodology documents (SPIN, Gap, Pitch, Objections). It defines how the system reads a call, how it proves what it claims, and how individual call scores become a score for a period. A competence-specific rule always takes precedence over this part when the two differ; such differences are stated explicitly in Parts A and B.

## C1. Inputs and preconditions

| Input | Requirement | If missing |
|---|---|---|
| Transcript | Full call transcript, one entry per speaker turn, with timestamp (mm:ss or h:mm:ss) and speaker label | Call is not evaluated (status `no_transcript`) |
| Speaker mapping | Each label mapped to `SALES`, `PROSPECT` or `OTHER` (co-decider, assistant) | Call is not evaluated (status `no_diarization`) |
| Call metadata | `call_id`, `sales_id`, call start time in UTC, sales time zone, call type (first call, follow-up) | Call is excluded from time-window aggregation |
| Offer reference | Current offer: name, components, price and payment options, guarantee | Pitch and Objections run with reduced checks and are flagged `offer_reference_missing` |
| Rules version | The version of this document applied (for example `SPIN-1.0`) | Not allowed: every result must carry a version |

**Diarization quality gate.** Before any analysis, the code computes the share of words attributed to each role. A call where one role holds more than 92 % of the words, or where the prospect holds fewer than 150 words, is flagged `diarization_suspect` and excluded from scoring (it remains visible in the call list). **Attribution check.** Before bounding, the model reads each turn against its label and flags three cases, each with a quote: (1) **merged turn**: a turn that contains the other role's speech (for example a sales question or a "right?" tail at the start or end of a prospect turn); (2) **swapped turn**: content that can only belong to the other role (the sales' own name, the offer described in the first person, the prospect's personal facts stated as "I" under a SALES label); (3) **echo**: the same sentence repeated under both labels within 3 turns. The code then splits a merged turn at the quoted boundary and relabels the part, relabels a swapped turn, and drops the echoed copy. A turn that cannot be repaired this way is marked `attribution_doubtful` and is excluded from every computation in which the speaker matters. A call where more than 10 % of turns are repaired or doubtful is flagged `diarization_suspect` (threshold to validate).

## C2. Processing pipeline

The engine follows one rule: **the model extracts and quotes, the code decides and scores.** No language model ever outputs a score, a level or a final verdict. It only answers closed questions (yes / no / a value from a closed list) and supports each positive answer with an exact quote.

| Stage | Who | What it does | Output |
|---|---|---|---|
| S0 Normalisation | Code | Joins wrapped lines, normalises whitespace and quotation marks, numbers turns `T001…`, keeps timestamps | Normalised turn list |
| S1 Inventory | Code | Detects the units of analysis of the competence (questions, restitutions, pitch segments, objection episodes) using written segmentation rules. Nothing is deleted: doubtful units are kept with attributes | Unit list |
| S2 Boundaries | Model, checked by code | Places phase anchors (start of discovery, first restitution, first pitch, first price, close) with turn number and exact quote | Phase map |
| S3 Gates | Model | Answers the closed questions of the competence for each unit, with an exact quote for each positive answer | Gate answers |
| S4 Anchoring check | Code | Verifies that every quote is an exact substring of the cited turn, spoken by the expected role | Valid or invalid answers |
| S5 Decision | Code | Applies the decision rules of Part B in their fixed order; first matching rule wins | Item verdicts |
| S6 Reproducibility | Code | Compares three independent passes of S3; disagreements go to arbitration | Concordance status |
| S7 Scoring | Code | Computes item levels, the call score and its evidence list | Call result |
| S8 Aggregation | Code | Computes period scores, volumes, confidence intervals and deltas | Period result |

## C3. Evidence rules

1. **Exact quote.** Every positive gate answer carries a quote of 2 to 40 words copied character for character from one turn. Normalised comparison: case-insensitive, whitespace collapsed, straight and curly quotes treated as equal. Transcription errors are kept as they are; they are never corrected.
2. **Right speaker.** A quote that proves something the prospect said must come from a `PROSPECT` turn. A quote that proves a sales action must come from a `SALES` turn. A quote from the wrong role invalidates the answer.
3. **Right place.** A quote must sit in the turn the model cites, and inside the phase the rule requires (for example "before the first pitch"). The code checks the turn number against the phase map.
4. **Two quotes for top level.** Any item scored at level 2 must be supported by two distinct quotes (two different turns, or two non-overlapping passages). One quote caps the item at level 1.
5. **Approval is not evidence.** A prospect turn whose only content is agreement ("yes", "exactly", "right", "that's true", "for sure", "mm-hmm", "100 %") never proves anything except an agreement, and only where a rule explicitly asks for an agreement.
6. **Sales words are not prospect words.** Content that the sales stated and the prospect only approved is tagged `prompted_by_sales` and never counts as something the prospect said. The only exception is **anchoring**: when the sales reuses a word the prospect had already said, that word still belongs to the prospect.
7. **Invalid answer handling.** An answer whose quote fails S4 is replayed once with the error message. If it fails again, the unit is marked `to_review` and is excluded from every score until a human or the arbiter resolves it.

## C4. Reproducibility and arbitration

- **Three independent passes.** Stage S3 runs three times on every unit, with the same prompt and parameters, without any pass seeing the others. The code compares the resulting item verdicts.
- **Concordant (3/3).** The verdict is final, status `verified`.
- **Divergent (2/3 or less), or an invalid quote.** The unit goes to an **arbiter**: a separate model call that did not take part in the three passes, receives the full rulebook (this document), the unit, its context and the three readings, and decides by walking the decision rules in order. It never votes between the readings. Status `arbitrated`, with a one-sentence justification and a case label: `application_error` (a reading did not follow a clear rule), `rule_ambiguity` (two readings are defensible with the text) or `uncovered_case` (no rule decides). The last two are reported to the methodology owner and feed the next rules version.
- **Unresolved.** A unit the arbiter cannot decide stays `to_review` and is excluded from scores.
- **Cost option.** When volume makes three passes too expensive, one pass is allowed in production **only** if the reproducibility protocol (C7) has shown at least 95 % item-level concordance on the current rules version, and three passes continue to run on a random 10 % sample of calls every week. Any week where that sample falls below 95 % restores three passes on every call.

## C5. Time windows and aggregation

**Windows.** The screen offers three windows. All are computed in the sales' time zone, on the call start time.

| Window | Definition | Comparison window for the delta |
|---|---|---|
| Last 7 days | From 00:00 six days before today to now (today included, 7 calendar days) | The 7 calendar days immediately before |
| This month | From the 1st of the current calendar month at 00:00 to now | The previous calendar month, from its 1st to the same day number (or its last day if shorter) |
| All | Every evaluated call of the sales, all time | No delta |

**Evaluable calls.** A call enters the window score of a competence only if its competence status is `scored`. Calls with status `not_applicable` (for example no objection was raised), `excluded` or `to_review` are counted and shown, never averaged.

**Period score.** The period score is the arithmetic mean of the call scores of the evaluable calls in the window. Each call weighs the same, whatever its length.

**Item rates.** Each item is also shown as a rate for the period: the share of evaluable calls where the item reached level 2, and the share where it reached at least level 1.

**Minimum volume.** With fewer than 5 evaluable calls the period score is displayed in grey with the label "insufficient volume (n calls)" and no level is assigned. With 5 to 19 calls the score is displayed with its 95 % confidence interval. From 20 calls the interval is still computed but only shown on hover.

**Confidence interval.** 95 % interval of the mean using the Student t distribution: mean ± t(0.975, n−1) × standard deviation / √n, bounded to [0, 100]. For item rates, the Wilson interval is used.

**Delta.** Delta = period score − comparison period score, in points, shown only if both periods have at least 5 evaluable calls. A delta whose absolute value is smaller than half the width of the current confidence interval is displayed as "stable".

## C6. Levels and display

| Score | Level | Meaning |
|---|---|---|
| 85 to 100 | Mastered | Executed correctly on almost every call |
| 60 to 84 | Developing | Executed, with recurrent gaps |
| 0 to 59 | Needs work | Not executed reliably |

**Floor rule.** If any item of the competence has a level-2 rate below 25 % over the window, the competence level cannot be above "Developing", whatever the score. This prevents an average from hiding a gesture that is almost never performed.

**Bottleneck.** On the screen, the competence with the lowest period score (among those with at least 5 evaluable calls) is labelled "Bottleneck #1". Ties are broken by the lowest level-2 rate on any single item.

**Every number is clickable.** Each item level of each call opens its evidence: the quotes, their turns and timestamps, and the transcript extract around them (± 3 minutes).

## C7. Reliability protocol

No accuracy figure is published before it has been measured.

| What is measured | Method | Threshold |
|---|---|---|
| Human agreement on units | Two certified annotators segment the same 3 calls independently | ≥ 95 % identical units |
| Human agreement on items | Two annotators score the same calls, blind to each other | Raw agreement ≥ 85 % and Cohen's κ ≥ 0.80 per item |
| Machine vs gold standard | 30 real calls with known outcome, 20 for calibration, 10 for test, split frozen before annotation | Item agreement ≥ human agreement − 5 points |
| Reproducibility | Same verdict on 3 independent passes | ≥ 95 % per item |
| Anchoring | Quotes found verbatim in the transcript | 100 % (anything else is a defect) |
| Health | Units where no rule could decide | ≤ 5 % per call; above that the call is not displayed to the sales |

Until every threshold is met on the current rules version, every score carries the label **"provisional"** on the screen. The test set is never used to adjust a rule, a prompt or a threshold. Below a threshold, the rule is rewritten; the threshold never is.

## C8. Versioning and audit

- Every call result stores the rules version, the model identifier, the prompt hash, the three raw passes, the arbiter decision if any, and the timestamp of computation.
- A score computed under one rules version is never compared with a score computed under another. When a version changes, the historical calls of the window are re-scored before any delta is shown.
- Every arbitration and every human correction is logged with: unit id, readings, decision, case label, author, date. A human may correct a verdict; nobody may edit a stored score by hand.
