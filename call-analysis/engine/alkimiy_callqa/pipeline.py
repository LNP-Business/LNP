"""Orchestrator: the fixed dependency order of the engine.

foundation (S0, C1, S2) -> SPIN -> Gap -> Pitch -> Objections -> stored result.
Each competence reads the frozen outputs of the previous stages from the CallContext and writes its
CompetenceResult. No competence ever re-places a phase anchor of its own.
"""
from __future__ import annotations

import json
from typing import Optional, Protocol

from .core.foundation import parse_transcript, run_foundation
from .core.models import CallContext, CompetenceResult
from .core.runner import Runner


class Competence(Protocol):
    name: str
    rules_version: str

    def run(self, ctx: CallContext, runner: Runner) -> CompetenceResult: ...


def default_competences() -> list[Competence]:
    from .competences.spin import SpinCompetence
    from .competences.gap import GapCompetence
    from .competences.pitch import PitchCompetence
    from .competences.objections import ObjectionsCompetence
    return [SpinCompetence(), GapCompetence(), PitchCompetence(), ObjectionsCompetence()]


def analyse_call(ctx: CallContext, runner: Runner, competences: Optional[list[Competence]] = None) -> CallContext:
    run_foundation(ctx, runner)
    for comp in competences or default_competences():
        if ctx.status != "ok":
            ctx.results[comp.name] = CompetenceResult(comp.name, comp.rules_version, status="excluded",
                                                      reasons=[ctx.status])
            continue
        try:
            ctx.results[comp.name] = comp.run(ctx, runner)
        except Exception as e:  # noqa: BLE001 - a crash in one competence never blocks the others
            ctx.audit.append({"competence": comp.name, "error": repr(e)})
            ctx.results[comp.name] = CompetenceResult(comp.name, comp.rules_version, status="to_review",
                                                      reasons=["engine_error"])
    return ctx


def result_record(ctx: CallContext) -> dict:
    """What is stored per call (Part C, C8): results + phase map + audit of every pass."""
    return {"call_id": ctx.call_id, "sales_id": ctx.sales_id, "start_utc": ctx.start_utc, "timezone": ctx.timezone,
            "status": ctx.status, "flags": ctx.flags,
            "turns": [{"id": t.id, "ts": t.ts, "role": t.role, "speaker": t.speaker, "text": t.text,
                       "repaired": t.repaired, "attribution_doubtful": t.attribution_doubtful} for t in ctx.turns],
            "phases": {k: v for k, v in ctx.phases.__dict__.items() if k != "evidence"},
            "results": {k: v.to_dict() for k, v in ctx.results.items()},
            "audit": ctx.audit}


def load_call(path: str, speaker_map: dict[str, str], call_id: str, sales_id: str, start_utc: str,
              timezone: str, offer_reference: Optional[dict] = None, case_library: Optional[list] = None) -> CallContext:
    raw = open(path, encoding="utf-8").read()
    return CallContext(call_id, sales_id, start_utc, timezone, parse_transcript(raw, speaker_map),
                       offer_reference or {}, case_library or [])


if __name__ == "__main__":  # minimal CLI
    import argparse
    from .core.llm import AnthropicClient
    p = argparse.ArgumentParser()
    p.add_argument("transcript"); p.add_argument("--config", required=True, help="JSON: speaker_map, call meta, tiers")
    a = p.parse_args()
    cfg = json.load(open(a.config))
    ctx = load_call(a.transcript, cfg["speaker_map"], cfg["call_id"], cfg["sales_id"], cfg["start_utc"],
                    cfg["timezone"], cfg.get("offer_reference"), cfg.get("case_library"))
    analyse_call(ctx, Runner(AnthropicClient(cfg["tiers"])))
    print(json.dumps(result_record(ctx), ensure_ascii=False, indent=1, default=str))
