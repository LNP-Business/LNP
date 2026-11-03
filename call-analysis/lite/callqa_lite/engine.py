"""The lite pipeline: foundation (code) → S0 phases → S1 discovery → S2 gap → S3 pitch → S4 objections → call record.

`analyse(ctx, client, config)` returns the same record as alkimiy_callqa.pipeline.result_record (OUTPUT_CONTRACT.md),
plus `meta` ({"engine": "lite", "version", "steps": what the code dropped per step}). The model is asked one question per
step about the whole call (S1 in chunks of turns on long discoveries), always with the transcript as the same cached
prefix; the code checks every quote and decides every level, verdict and score. A crash in one competence makes it
`to_review` (reason engine_error) without stopping the others, as in the reference pipeline.
"""
from __future__ import annotations

import json
from typing import Any, Optional

from . import LITE_VERSION
from alkimiy_callqa.competences import pitch as P
from alkimiy_callqa.core.foundation import diarization_gate
from alkimiy_callqa.core.models import CallContext, CompetenceResult
from alkimiy_callqa.pipeline import result_record

from .gap import run_gap, statements_text
from .objections import run_objections
from .phases import apply_phases
from .pitch import context_text, run_pitch
from .shim import Drops
from .spin import SpinFacts, run_spin
from .steps import Steps, fill, load

DEFAULTS: dict[str, Any] = {
    "tier": "fast",                 # crm_ca_config.tiers.fast (claude-haiku-5-5)
    "effort": "low",                # thinking on, kept short
    "s1_chunk_turns": 160,          # turns of discovery per S1 call (a split happens anyway if an answer is cut)
    "s1_min_chunk_turns": 30,
    "max_tokens": {"S0": 6000, "S1": 16000, "S2": 8000, "S3": 10000, "S4": 10000},
}
RULES = {"SPIN": "SPIN-1.3", "GAP": "GAP-1.3", "PITCH": "PITCH-2.0", "OBJECTIONS": "OBJ-1.1"}


class LiteModelError(RuntimeError):
    """The model steps failed (no valid JSON after a replay) on the phase map or on most steps: nothing is stored."""
    final = True


def _anchor(ctx: CallContext, tid: Optional[str]) -> str:
    return f"{tid} ({ctx.turn(tid).ts})" if tid else "none"


def anchors(ctx: CallContext) -> str:
    ph = ctx.phases
    return (f"PHASE MAP (decided by the code): discovery start {_anchor(ctx, ph.discovery_start)}; pitch start "
            f"{_anchor(ctx, ph.pitch_start)}; first price {_anchor(ctx, ph.first_price)}; decision request "
            f"{_anchor(ctx, ph.decision_request)}.")


def _windows(ctx: CallContext, size: int) -> list[tuple[int, int]]:
    end = ctx.n(ctx.phases.discovery_end) if ctx.phases.discovery_end else len(ctx.turns)
    return [(a, min(a + size, end) - 1) for a in range(0, end, size)] if end else []


def run_s1(ctx: CallContext, steps: Steps, cfg: dict, drops: Drops) -> Optional[list]:
    """S1 over the turns before the first pitch start or price, in chunks; an answer cut by max_tokens is asked again
    as two halves. Returns the questions, or None if every chunk failed."""
    queue, out, failed, done = _windows(ctx, cfg["s1_chunk_turns"]), [], 0, 0
    end = ctx.phases.discovery_end
    if not queue:                                   # the pitch starts at the first turn: no discovery (SPIN §5)
        return []
    while queue:
        a, b = queue.pop(0)
        ta, tb = ctx.turns[a].id, ctx.turns[b].id
        window = (f"Read the questions asked in turns {ta} to {tb} only (their answers may continue after {tb}). "
                  + (f"The first pitch start or price is at {end}: nothing from {end} on is discovery (SB-34)."
                     if end else "No pitch start or price was found: the whole call can be discovery."))
        ans = steps.ask("lite.s1_discovery", f"{ta}-{tb}", fill(load("s1_discovery"), window=window),
                        cfg["max_tokens"]["S1"], replay_truncated=False)
        if ans.answer is None and ans.stop_reason == "max_tokens" and b - a + 1 > cfg["s1_min_chunk_turns"]:
            mid = (a + b) // 2
            queue[:0] = [(a, mid), (mid + 1, b)]
            continue
        if ans.answer is None:
            failed += 1
            drops.add("S1", "chunk_failed")
            continue
        done += 1
        out += [q for q in ans.answer.get("questions") or []]
    return out if done else None


def _to_review(name: str, reason: str = "engine_error") -> CompetenceResult:
    return CompetenceResult(name, RULES[name], status="to_review", reasons=[reason], concordance="single_reading")


def _safe(ctx: CallContext, name: str, fn) -> CompetenceResult:
    try:
        return fn()
    except Exception as e:  # noqa: BLE001 - a crash in one competence never blocks the others
        ctx.audit.append({"competence": name, "error": repr(e)[:500]})
        return _to_review(name)


def analyse(ctx: CallContext, client: Any, config: Optional[dict] = None) -> dict:
    cfg = {**DEFAULTS, **(config or {})}
    cfg["max_tokens"] = {**DEFAULTS["max_tokens"], **((config or {}).get("max_tokens") or {})}
    drops = Drops()
    meta = {"engine": "lite", "version": LITE_VERSION, "tier": cfg["tier"], "effort": cfg["effort"]}
    diarization_gate(ctx)                                    # C1 (code); no model attribution check in lite
    if ctx.status != "ok":
        for name, rv in RULES.items():
            ctx.results[name] = CompetenceResult(name, rv, status="excluded", reasons=[ctx.status])
        return _record(ctx, meta, drops)
    steps = Steps(client, ctx, tier=cfg["tier"], effort=cfg["effort"])
    failed: list[str] = []
    attempted = ["S0", "S1"]

    # S0 · phase map
    s0 = steps.ask("lite.s0_phases", "call", load("s0_phases"), cfg["max_tokens"]["S0"])
    if s0.answer is None:
        raise LiteModelError(f"phase map (S0): {s0.error}")
    apply_phases(ctx, s0.answer, drops)

    # S1 · discovery → SPIN and the shared fact base
    questions = run_s1(ctx, steps, cfg, drops)
    facts = SpinFacts()
    if questions is None:
        failed.append("S1")
        ctx.results["SPIN"] = _to_review("SPIN")
    else:
        def spin():
            nonlocal facts
            res, facts = run_spin(ctx, questions, drops)
            return res
        ctx.results["SPIN"] = _safe(ctx, "SPIN", spin)

    # S2 · gap (needs the discovery facts)
    if "engine_error" in ctx.results["SPIN"].reasons:
        ctx.results["GAP"] = _to_review("GAP", "engine_error")
    else:
        wlimit = ctx.phases.first_price or ctx.phases.decision_request
        prompt = fill(load("s2_gap"), anchors=anchors(ctx), limit=f"turn {wlimit}" if wlimit else "the end of the call",
                      statements=statements_text(ctx))
        attempted.append("S2")
        s2 = steps.ask("lite.s2_gap", "call", prompt, cfg["max_tokens"]["S2"])
        if s2.answer is None:
            failed.append("S2")
            ctx.results["GAP"] = _to_review("GAP")
        else:
            ctx.results["GAP"] = _safe(ctx, "GAP", lambda: run_gap(ctx, s2.answer, facts, drops))
    _gap_rules(ctx, questions, drops, meta)

    # S3 · pitch (needs the Gap result: validated P, selected A and B, roadmap blockers)
    if not ctx.phases.pitch_start:
        ctx.results["PITCH"] = _safe(ctx, "PITCH", lambda: P.decide(ctx, {}))          # not applicable (§4)
    else:
        c = context_text(ctx)
        prompt = fill(load("s3_pitch"), anchors=anchors(ctx), vp=c["vp"], a=c["a"], b=c["b"], blockers=c["blockers"],
                      references=c["references"])
        attempted.append("S3")
        s3 = steps.ask("lite.s3_pitch", "call", prompt, cfg["max_tokens"]["S3"])
        if s3.answer is None:
            failed.append("S3")
            ctx.results["PITCH"] = _to_review("PITCH")
        else:
            ctx.results["PITCH"] = _safe(ctx, "PITCH", lambda: run_pitch(ctx, s3.answer, drops))

    # S4 · objections after the first price (OB-27), prevention before it; no price = nothing to read
    if not ctx.phases.first_price:
        ctx.results["OBJECTIONS"] = CompetenceResult("OBJECTIONS", RULES["OBJECTIONS"], status="not_applicable",
                                                     reasons=["no_resistance_no_price"], concordance="single_reading")
    else:
        attempted.append("S4")
        s4 = steps.ask("lite.s4_objections", "call", fill(load("s4_objections"), anchors=anchors(ctx)),
                       cfg["max_tokens"]["S4"])
        if s4.answer is None:
            failed.append("S4")
            ctx.results["OBJECTIONS"] = _to_review("OBJECTIONS")
        else:
            ctx.results["OBJECTIONS"] = _safe(ctx, "OBJECTIONS", lambda: run_objections(ctx, s4.answer, drops))

    if len(failed) * 2 > len(attempted):
        raise LiteModelError(f"{len(failed)} of {len(attempted)} model steps gave no valid JSON: " + ", ".join(failed))
    meta["failed_steps"] = failed
    return _record(ctx, meta, drops)


def _gap_rules(ctx: CallContext, questions: Optional[list], drops: Drops, meta: dict) -> None:
    """Romain, 2026-11-03.
    - The discovery ends when the gap is made: with a gap present, the end of the discovery is its validation turn, and
      SPIN is scored again on the questions asked up to it (a question after the validated gap is not discovery).
      With no gap, the discovery ends before the pitch (SB-1, unchanged).
    - A call with no discovery question, no pitch and no price has no gap to make: not applicable (§4), not absent."""
    g, sp, ph = ctx.results.get("GAP"), ctx.results.get("SPIN"), ctx.phases
    meta["discovery_end_rule"] = "pitch"
    if g and g.verdict == "present":
        vt = (g.details or {}).get("validation_turn")
        if vt and (not ph.discovery_end or ctx.n(vt) < ctx.n(ph.discovery_end)):
            ph.discovery_end = vt
            meta["discovery_end_rule"] = "gap"
            if questions is not None:
                kept = [q for q in questions if isinstance(q, dict) and q.get("turn") in {t.id for t in ctx.turns}
                        and ctx.n(q["turn"]) < ctx.n(vt)]
                for _ in range(len(questions) - len(kept)):
                    drops.add("S1", "question:after_gap")
                ctx.results["SPIN"] = _safe(ctx, "SPIN", lambda: run_spin(ctx, kept, Drops())[0])
    elif g and g.status == "scored" and sp and sp.status == "not_applicable" and not ph.pitch_start and not ph.first_price:
        ctx.results["GAP"] = CompetenceResult("GAP", RULES["GAP"], status="not_applicable",
                                              reasons=["no_discovery_no_pitch"], concordance="single_reading")


def _record(ctx: CallContext, meta: dict, drops: Drops) -> dict:
    rec = result_record(ctx)
    meta["steps"] = {k: {"dropped": sum(v.values()), "reasons": v} for k, v in drops.counts.items()}
    rec["meta"] = meta
    rec["audit"].append({"lite_drops": drops.examples})
    json.dumps(rec, default=str)                            # what crm_ca_store receives
    return rec


def summary(record: dict) -> str:
    """One log line: status and scores only (never a quote)."""
    res = record.get("results") or {}
    parts = [f"{k}={v.get('score') if v.get('score') is not None else v.get('status')}" for k, v in res.items()]
    return f"engine=lite status={record.get('status')} turns={len(record.get('turns') or [])} " + " ".join(parts)
