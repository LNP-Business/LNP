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
repaired): format in `callqa_qa/reference.py`. Calls are `tuning` (used to find and fix errors) or `control` (never
looked at while tuning: they tell whether a fix generalises, C7).

The reference files and the case files (transcript, speaker map, the stored model answers) hold **personal data**: they
never go into git. They live in the private Storage bucket `callqa-fixtures`, folder `qa/` (`reference/`, `cases/`).

November 2026: the 6 analysed calls, read in the audit of 2026-11-19 (all `tuning`). Control calls are still to be
read.

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
