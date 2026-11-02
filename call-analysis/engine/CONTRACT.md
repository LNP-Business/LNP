# Engine contract (read before writing a competence module)

Package: `alkimiy_callqa` (Python 3.11+, stdlib only; `anthropic` optional).

## Golden rule
The model extracts and quotes; the code decides and scores. A model answer never contains a score, a level or a
final verdict: only closed answers (bool / value from a closed list) and exact quotes with turn ids.

## Core API (do not modify `core/`; if you need a change, describe it in your final report)
- `core/models.py`: `Turn`, `Evidence(quote, turn, role)`, `PhaseMap`, `Solicitation`, `Atom`, `ItemScore`,
  `CompetenceResult`, `CallContext` (helpers: `turn(id)`, `n(id)` = position, `before(a,b)`, `window(a,b)`, `render(turns)`).
- `core/text.py`: `norm`, `quote_ok(ctx, Evidence, min_words, max_words, allowed_phase=(start,end))` -> error code or None,
  `approval_only(text)`, `key_expression_ok(key_expression, prospect_text, sales_text)` (GB-22 a/b/d),
  `norm_number` (PB-21), `sentences(text)` (PB-33), `clean_tokens`.
- `core/runner.py`: `ModelTask(id, tier, rules, build(ctx, unit)->str, validate(answer, ctx, unit)->[errors], key(answer), passes=3)`;
  `Runner.run(ctx, task, unit_id, unit) -> Resolved(answer, status, concordance, readings, justification, case_label)`.
  `rules` = prompt file name in `prompts/` (without `.md`); `system_common.md` is prepended automatically.
  Status: `verified` (3/3), `arbitrated`, `to_review` (answer None -> the unit is excluded from scores).
  NOTE: `validate` receives the `unit_id` string as third argument (not the unit object).
- `core/scoring.py`: `item(id, weight, level, evidence, note, two_quotes=True)` applies the two-quote cap;
  `call_score(items)` = Σ weight×level/2 on 100, N/A items (level None) have their weight spread.
- `core/llm.py`: `MockClient(answers={(task_id, unit_id): dict | [pass1, pass2, pass3, arbiter]}, fallback=callable)`.
- `core/foundation.py`: already run before any competence. It fills `ctx.phases.pitch_start`, `first_price`,
  `decision_request`, `pitch_end`, `offer_mentions`, `early_price`. Repaired turns may have ids like `T050b`.

## Module interface
Each module `competences/<name>.py` exposes a class with `name`, `rules_version` and
`run(self, ctx, runner) -> CompetenceResult`, plus pure decision functions testable without any model.
Split every model question into a small `ModelTask` (one closed question, one unit, short context window, the
relevant rules only in `prompts/<name>_<task>.md`). Unit ids must be deterministic strings (e.g. `restit:T081`).

## Shared state written by SPIN (read by Gap, Pitch, Objections)
- `ctx.phases.discovery_start`, `ctx.phases.discovery_end` (SB-1: end = first pitch start or first price).
- `ctx.solicitations`: list of `Solicitation` with `letter` in S/P/I/N/OUT, `out_reason`, `answer_turns`, `followed_up`.
- `ctx.atoms`: list of `Atom` (type SITUATION/PAIN/BLOCKER/IMPACT/DESIRE/VALUE, evidence = PROSPECT quote,
  `solicitation_id`, `letter` of that solicitation, `object` label, `domain`, `quantified`, `value`, `unit`,
  `volunteered`, `prompted_by_sales`).
## Shared state written by Gap (read by Pitch)
`ctx.results["GAP"].details` must contain:
`{"verdict": "present"|"absent", "validation_turn": "T082"|None, "restitution_span": [..], 
  "selected_A": {"quote","turn","value","unit","solicitation"}|None, "selected_B": {...,"horizon"}|None,
  "selected_P": {"quote","turn","object","rule"}|None, "validated_P": {"quote","turn","key_expression"}|None,
  "roadmap_blockers": [{"object","quote","turn","solicitation"}], "cost": [...]}`.
## Shared state written by Pitch (read by Objections)
`ctx.results["PITCH"].details` contains `"roadmap_span": [start, end]|None`.

## Tests
`tests/test_<name>.py` with pytest. Pure decision tests on synthetic `CallContext`s (no dependency on other
competence modules: fill `ctx.atoms`, `ctx.solicitations`, `ctx.phases`, `ctx.results` by hand), plus at least
3 cases from the methodology's Annex B built on the real transcripts in
`tests/fixtures/transcripts/NNN/transcript_compact.txt` (or the folder in `CALLQA_CORPUS`)
(format `[T001 00:06] SALES: text`, already numbered and labelled; build Turns from it directly) with mock model answers.
Run `python3 -m pytest -q tests/test_<name>.py` from the package root until green.
