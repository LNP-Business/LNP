# Output contract · the call record

One call record is produced per analysed call by `alkimiy_callqa.pipeline.result_record(ctx)`. It is what is stored
and what the screen reads. The per-competence output contracts are defined in each `0N_<x>_A_scoring.md`
(section "Output contract"); this file gives the envelope and what the screen needs.

```
{
  "call_id": "001", "sales_id": "valentino", "start_utc": "2026-06-18T11:00:00Z", "timezone": "Asia/Dubai",
  "status": "ok" | "no_transcript" | "no_diarization" | "diarization_suspect",
  "flags": [...],
  "turns": [{"id": "T081", "ts": "28:07", "role": "SALES", "speaker": "...", "text": "...",
             "repaired": false, "attribution_doubtful": false}, ...],      // repaired turns; ids like T050b after a split
  "phases": {"discovery_start": "T028", "discovery_end": "T085", "pitch_start": "T085", "first_price": "T113",
             "decision_request": "T113", "pitch_end": "T113", "offer_mentions": [], "early_price": null, "flags": []},
  "results": {
    "SPIN":       CompetenceResult,
    "GAP":        CompetenceResult,
    "PITCH":      CompetenceResult,
    "OBJECTIONS": CompetenceResult
  },
  "audit": [ {task, unit, pass, tier, prompt_hash, answer, errors}, ... ]   // every model pass, arbitration, error
}
```

`CompetenceResult`:

```
{
  "competence": "GAP", "rules_version": "GAP-1.3",
  "status": "scored" | "not_applicable" | "excluded" | "to_review",
  "verdict": "present" | "absent" | "compliant" | "non_compliant" | null,
  "reasons": [...],                 // absence / non-compliance / not-applicable reasons, main reason first
  "score": 0..100 | null,
  "items": [{"id": "G5", "weight": 25, "level": 0|1|2|null,
             "evidence": [{"quote": "...", "turn": "T081", "role": "SALES"}], "note": "..."}],
  "flags": [...],
  "details": { ... competence specific, see below ... },
  "concordance": "3/3" | null
}
```

## Details read by the screen

| Competence | Keys | Used for |
|---|---|---|
| SPIN | `perimeter`, `solicitations[]` (id, turn, ts, letter, gate_letter, out_reason, tags, in_perimeter, status, answer_turns, followed_up, register, register_status, register_basis, register_domain, register_quote, register_reference_turn: the turn of the answer for basis `answer` (SB-35, v1.3), else of the reference), `registers` (counts per register, questions, verified, to_review, agreement, threshold, flags; v1.2), `items_evidence` (per item: level, evidence rows with turn, ts, quote, atom, domain, question id and letter), `chains`, `diagnostics` (letter distribution — never scored), `health`, `unit_status` | Discovery table: rows by register (Financial, Time & load, Identity & status, Mental & emotional, Other, then Out of SPIN), chips per solicitation, pain/desire counts, states |
| GAP | `verdict`, `validation_turn`, restitutions (span, turns, signals, components with source turn, key expression and match `verbatim`/`paraphrased`/`untraced`, `explicit_quote`, clauses, validation outcome, conformity), `selected_A`, `selected_B`, `selected_P`, `validated_P` (quote, turn, key expression), `cost`, `roadmap_blockers`, formula, diagnostics | Timing bar (span → timestamps from `turns`), annotated verbatim, four checks, component table, roadmap line. Read by PITCH. |
| PITCH | `verdict`, `non_compliance`, `phases` (pitch_start, roadmap, first_price, decision_request, early_price), `validated_P` (+ category), `steps` {1..4}, `order_ok`, `roadmap`, `roadmap_span`, `claims` (each with lookup result), `outcome_promises`, `adhesion`, `raw_score`, `diagnostics` | Compliance chips, staircase, annotated pitch verbatim (window pitch_start → first_price from `turns`). `roadmap_span` read by OBJECTIONS. |
| OBJECTIONS | `handling_status`, `prevention_status`, `handling_score`, `prevention_score`, `episodes[]` (start, nature, theme, gestures acknowledge/isolate/explore/match with quotes and turns, reaction, resolution, latent, recurrence, topic change), `prevention` (R1–R3 with quotes), `deadlines_detected`, `diagnostics` | Episode table, clickable A·I·E·M panels (each gesture's turns), prevention tiles |

## Period results (performance screen)

`alkimiy_callqa.core.aggregate.period(results, competence, window, today, tz)` returns, per sales and competence:
score, 95 % interval (Student), item level-2 rates with Wilson intervals, level with the floor rule, delta vs the
comparison window ("stable" when within half the interval), status counts; `bottleneck(periods)` names the weakest
competence. Windows: `7d`, `month`, `all`, in the sales' time zone (Part C, C5–C6).

## Lead qualification of an R1 (046, 2026-11-05)

An analysed R1 also carries the qualification of its lead (call-analysis/qualification, rules « Qualification SQL des appels
LNP » 2.2, three gates): the worker runs it after the engine (`callqa_worker/qualif.py`, on the same turns), stores it in
`crm_lead_qualifications` with the job (`crm_qualif_store(…, p_job)`), and `crm_ca_record(job)` returns it as
`qualification`:

```
{"status": "SQL GAGNÉ | SQL OUVERT | SQL PERDU | NON SQL | MQL EN ATTENTE | À REVOIR",
 "result": {"statut", "portes": {"metier" | "financement" | "decision_timing": {"statut": "OUVERTE | FERMÉE | NON VÉRIFIÉE", "preuve", "raisons"}},
            "offre_presentee", "base": {"issue_r1", "outcome", "motif", "date_relance"}, "solution_aware", "alertes", "confiance"},
 "verification": ["quotes set aside: not found in the transcript"], "prompt_version", "rules_version", "created_at"}
```

The extracted facts (two readings) stay in the table, never on the screen. `crm_ca_board()` adds `qualification:
{status, solution_aware}` to each R1 row. A qualification that fails never stops the analysis (no row, the worker logs it).

