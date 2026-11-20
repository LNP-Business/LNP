# Quality measure of the call analysis (`call-analysis/qa`, 2026-11-20)

Before changing the analysis, measure it: a **reference set** of calls read by a person, and the code that compares an
analysis record with it. Every change of a prompt, a rule or a model is measured on the same set, so a gain or a loss
is a number, not an impression.

## What is measured

| Measure | Compared | Target |
|---|---|---|
| Phases | the four anchors (discovery start, pitch start, first price, decision request), by the words of the anchor turn | |
| Questions found | the expected discovery questions the analysis lists (and, when the list is complete, the ones it adds) | |
| Letters | S · P · I · N · OUT of each question found | |
| Registers | Financial, Time & load, Identity & status, Mental & emotional, Other | 92 % (SB-33) |
| Effects found | the expected atoms of the answers, and their type | |
| Gap | verdict, absence reason, the selected A, B, problem and costs | |
| Pitch | verdict | |
| Objections | the expected objections (and the ones added when the list is complete), nature, the A · I · E · M gestures | |
| Status and scores | applicable or not, and each score inside the range the reader expects | |
| Reproducibility | several analyses of one call: same letter, same register, spread of each score | 95 % identical (C4) |

Each measure is "right out of"; a share is computed only on what the reference states. The errors (what a person would
correct, with the quotes) are listed per call in the report.

## The reference set

One JSON file per call, keyed by the **words of the transcript**, never by turn ids (they change when the voices are
repaired): format in `callqa_qa/reference.py`. A gap element (A, B, problem, cost) may list several accepted quotes
(the prospect said it in two places) and `null` among them (rightly not selected: no current figure on B's dimension). Calls are `tuning` (used to find and fix errors) or `control` (never
looked at while tuning: they tell whether a fix generalises, C7).

The reference files and the case files (transcript, speaker map, the stored model answers) hold **personal data**: they
never go into git. They live in the private Storage bucket `callqa-fixtures` (created 2026-11-20), as
`qa/reference.tar.gz` and `qa/cases.tar.gz`; the measure job of the workflow writes its reports to `qa/reports/`.

November 2026: the 6 analysed calls, read in the audit of 2026-11-19 (all `tuning`). Control calls are still to be
read.

## Corrections made on the screen (2026-11-20)

An administrator corrects the letter of a discovery question in the call analysis (migration 063,
`crm_ca_correct`); every correction is kept, with the engine's letter, the person's, the note, the author and the date
(`crm_ca_corrections`, additions only, Part C, C8); the score is not recomputed. `corrections_to_reference.py` turns them
into reference answers (the query is in its docstring): this is how the reference set grows with the calls people
actually check.

## Commands

```
cd call-analysis/qa && python3 -m pytest -q tests                                   # the measure itself (fictional call)
python3 call-analysis/qa/qa_run.py --cases DIR --refs DIR --out report.json         # replay: the stored model answers
python3 call-analysis/qa/qa_run.py --cases DIR --refs DIR --mode live --repeat 5 --out report.json   # the model, 5 times
```

`replay` plays the model answers kept with each analysis again (no model call, no cost): it measures a change of the
code. `live` asks the model through the gateway `callqa-llm` (needs `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`):
it measures a change of a prompt or a model, and with `--repeat` the reproducibility. About 0.05 USD per analysis.
The printed lines hold numbers only; the quotes go to `--out` only.

## Baseline (2026-11-20)

Replay of the stored model answers of the 6 analysed calls (lite engine, one reading on Haiku, answers of 2026-11-04;
the code of 2026-11-20, step 1 French checks and recurrences as new episodes; the voice check gets empty answers in a replay):

| Measure | Right |
|---|---|
| Status (applicable or not) | 96 % (23/24) |
| Phases | 84 % (16/19) |
| Questions found | 64 % (93/146) |
| Letters | 77 % (69/90) |
| Registers | 68 % (21/31), target 92 % |
| Effects found | **18 % (22/126)** |
| Gap verdict | 100 % (5/5) |
| Gap elements found | 31 % (4/13) |
| Pitch verdict | 80 % (4/5) |
| Objections found | 43 % (9/21) |
| Objection gestures | 53 % (9/17) |
| Scores inside the expected range | 56 % (9/16) |

230 errors in all: 104 effects missed, 53 questions missed, 21 wrong letters, 12 objections missed, 9 gap elements, 8
registers. The reproducibility (C4) needs live runs (`--mode live --repeat 5`).

## The gap elements (2026-11-20, GAP-1.4)

Reference read again for the gap elements of the 6 calls (A, B, problem, cost by the prospect's words; the files are in
the private bucket with the others). Replay of the 16 stored lite analyses of these calls (several analyses of one call
count each):

| Gap element | Before (GAP-1.3) | After (GAP-1.4) |
|---|---|---|
| Point A | 3 / 15 | 15 / 15 |
| Point B | 7 / 15 | 14 / 15 (the last one: a pitch start read too early, the target is outside the window) |
| Problem | 11 / 15 | 13 / 15 |
| Cost | 5 / 12 | 11 / 12 |
| All elements | 46 % (26/57) | 93 % (53/57) |

What changed: the code lists the prospect's figures (`engine/lnp_callqa/core/figures.py`, GB-28b) and the formula
selects A on B's dimension, never an unrelated fact (GB-28, GB-29 v1.4); the code lists the prospect's cost statements
with a lexicon per cost domain (`core/costs.py`, GB-7b). What is left (4 of 57): three elements of one analysis whose
pitch start is read at the 18th turn (the discovery falls outside the window) and one problem the model typed as a cost.
These six calls are the tuning set: the generalisation of the lexicon is to be read on control calls (C7).

## First live measure (2026-11-20, run 44754260316)

Lite engine of 2026-11-20 (voice check, SEG-1, gates read twice, Sonnet arbiter, C9), 6 calls × 5 analyses
(`--repeat 5 --workers 5`, effort low); Ahmad is excluded (recording under 20 minutes), as expected.

| Measure | Right |
|---|---|
| Status | 87 % (100/115) |
| Phases | 77 % (81/105) |
| Questions found | 57 % (313/545) |
| Letters | 80 % (236/295) |
| Registers | 71 % (59/83) |
| Effects found | 30 % (186/630) |
| Gap verdict · elements | 88 % (22/25) · 45 % (29/65) |
| Pitch verdict | 84 % (21/25) |
| Objections found · nature · gestures | 46 % (55/120) · 90 % (47/52) · 57 % (47/83) |
| Scores inside the expected range | 55 % (44/80) |
| Same letter from one analysis to the next (C4) | 37 to 67 % per call, target 95 % |

Of the missed questions, 85 % were on the code's list (SEG-1) and lost afterwards by one model reading (left unread or
read as gate 0); 185 of the 444 missed effects belonged to a missed question. Since then (C4, "no silent loss") a
listed question goes to the two readings of the gates whatever S1 said; a question no reading decides is counted in
`questions_to_review` and left out of the letters. The report keeps each analysis's drop counters (`drops`, numbers
only) and the failed analyses (`failed`, kind of error only).
