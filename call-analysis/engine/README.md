# alkimiy_callqa · ALKIMIY call analysis engine (reference implementation)

Applies the four methodologies (SPIN 1.1, Gap 1.3, Pitch 2.0, Objections 1.1) to a sales call transcript.
Architecture: see `ALKIMIY_Call_Analysis_Engine_Architecture.docx`. Engine contract: `CONTRACT.md`.

Rule: the model extracts and quotes, the code decides and scores.

## Layout
- `alkimiy_callqa/core/` data model, quote checks and verbatim rule, model client, runner (3 passes, replay,
  arbitration), foundation (parsing, diarization, attribution repair, phase map), scoring, period aggregation
- `alkimiy_callqa/competences/` spin.py, gap.py, pitch.py, objections.py
- `alkimiy_callqa/prompts/` common system rules + one rule file per model task (30 tasks)
- `alkimiy_callqa/pipeline.py` fixed stage order, stored call record, CLI
- `tests/` 205 tests: core, minimal pairs and Annex B real cases per competence, end-to-end smoke test

## Run the tests
    pip install pytest
    python3 -m pytest -q tests
(Annex B tests read `tests/fixtures/transcripts/`; set CALLQA_CORPUS to use another corpus.)

## Run on a call (live model)
    pip install anthropic ; export ANTHROPIC_API_KEY=...
    python3 -m alkimiy_callqa.pipeline transcript.txt --config call.json
`call.json`: {"speaker_map": {"Name": "SALES", ...}, "call_id", "sales_id", "start_utc", "timezone",
"tiers": {"fast": "<model id>", "strong": "<model id>", "arbiter": "<model id>"},
"offer_reference": {"price": ..., "mechanisms": {...}, ...}, "case_library": [...]}
Model ids, the offer reference (nine mechanisms) and the case library are not provided: à confirmer.
