# CLAUDE.md · LNP call analysis system

You are integrating the LNP sales-call analysis system into the app. Read this file first, every session.

## What this system does
It reads the transcript of a sales call and evaluates four competences of the sales: **SPIN discovery**,
**Gap formalisation**, **Pitch**, **Objection removal**. Each result is a score on 100, item levels with exact quotes
as evidence, and verdicts (gap present/absent, pitch compliant/non-compliant). Results are shown per call
(call analysis screen) and aggregated per period (performance screen).

## The rule that overrides everything
**The model extracts and quotes; the code decides and scores.**
- No prompt ever asks a model for a score, a level or a verdict. A model answers one closed question about one unit,
  in JSON, and supports every positive answer with an exact quote and a turn id.
- Every quote is checked by code: exact substring of the cited turn, spoken by the expected role, inside the expected
  phase (Part C, C3). An invalid answer is replayed once, then the unit goes `to_review` and is excluded from scores.
- Three independent passes per unit; disagreement → arbiter (decides by walking the rules, never by voting);
  undecidable → `to_review` (Part C, C4).
- The prospect's exact words are the backbone: restatements are checked with the verbatim rule (GB-22).

## Sources of truth (in this order)
1. `docs/methodology/` — scoring (A), **bounding rules (B)** and calibration cases (C) per competence, plus
   `00_engine_common_part_C.md`. `docs/BOUNDING_INDEX.md` lists every bounding rule and where it is.
2. `docs/memos/` — the human-readable LNP memos (PDF), one per competence.
3. `engine/` — the reference implementation (Python, stdlib only), 209 tests.
4. `docs/ARCHITECTURE.md`, `docs/OUTPUT_CONTRACT.md`, `docs/SCREEN_SPEC.md`, `docs/OPEN_DECISIONS.md`.
If code and methodology disagree, the methodology wins: fix the code and add a test.

## Never
- Never invent a business fact: a threshold, weight, price, mechanism text, client case, model id. Missing →
  configuration constant + flag + entry in `docs/OPEN_DECISIONS.md`.
- Never let a model output a score, a level or a verdict; never skip the quote checks to "save calls".
- Never change a rule without updating, in the same change: the methodology file, the engine, the tests (and say
  which memo needs an update).
- Never use the calibration test set to tune a prompt or a threshold (Part C, C7).
- Never compare scores computed under different rules versions; re-score on a version change (C8).
- Never write the word "closer": always "sales".
- Never put the API key or transcripts with personal data in the repository or in logs.

## Engine map (`engine/lnp_callqa`)
`core/models.py` data model · `core/text.py` quote checks, verbatim rule, numbers, sentences · `core/llm.py` model
client (live + mock) · `core/runner.py` passes, replay, arbitration, audit · `core/foundation.py` parsing,
diarization, attribution repair, phase map · `core/scoring.py` · `core/aggregate.py` periods ·
`competences/{spin,gap,pitch,objections}.py` · `prompts/*.md` (one per model task, 30 tasks) · `pipeline.py`
fixed order: foundation → SPIN → Gap → Pitch → Objections.

## Lite engine (`lite/callqa_lite`, 2026-11-03)
Five whole-transcript steps (phases, discovery, gap, pitch, objections after the pitch) on the fast tier, one reading;
the code checks every quote and reuses the engine's decision code (Gap and Pitch competences unchanged, through
`shim.StepRunner`). Selected per job by `crm_ca_config.engine = 'lite'`. Read `lite/README.md` (approximations) first.

## Commands
```
cd engine && pip install pytest && python3 -m pytest -q tests        # must stay green (209 tests)
CALLQA_CORPUS=<dir of NNN/transcript_compact.txt> python3 -m pytest -q tests   # run Annex B cases on another corpus
python3 -m lnp_callqa.pipeline transcript.txt --config call.json  # one call, live model (needs anthropic + key)
cd lite && python3 -m pytest -q tests                                 # lite engine
```
