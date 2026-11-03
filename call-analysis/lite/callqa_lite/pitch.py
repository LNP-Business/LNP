"""S3 → Pitch result (PITCH-2.0), computed by the reference engine's PitchCompetence on the lite answers.

The S3 step answers, in one call, the closed questions the engine asks one by one: the category of the validated P
(PB-27), steps 1 to 4 (PB-28 to PB-31), the roadmap (PB-34), the claims (PB-35), the outcome promises (PB-36) and the
adhesion passages (PB-14 to PB-16). The list answers are cut into the engine's chunks by turn. The compliance gate (pitch
after the yes, PB-37; claims outside his gap or the offer; outcome promises), every step check and every level are the
engine's code: the model never says whether the pitch came after the gap or is compliant.
"""
from __future__ import annotations

import json
from typing import Any, Optional

from alkimiy_callqa.competences import pitch as P
from alkimiy_callqa.core.models import CallContext, CompetenceResult

from .shim import Drops, StepRunner

STEP = "S3"
LISTS = {"pitch.claims": ("claims", "claims"), "pitch.promises": ("promises", "promises"),
         "pitch.adhesion": ("adhesion", "passages")}
SINGLE = {"pitch.step1": "step1", "pitch.step2": "step2", "pitch.step3": "step3", "pitch.step4": "step4",
          "pitch.roadmap": "roadmap"}


def context_text(ctx: CallContext) -> dict[str, str]:
    """What the S3 prompt is told of the earlier stages (the Gap result) and of the references."""
    g = P._gap(ctx)
    dump = lambda x: json.dumps(x, ensure_ascii=False) if x else "none"          # noqa: E731
    vp = g.get("validated_P")
    ref = {k: v for k, v in (ctx.offer_reference or {}).items() if k != "mechanisms"}
    refs = "\n".join(["OFFER REFERENCE: " + (json.dumps(ref, ensure_ascii=False) if ref else "missing"),
                      P._mech_reference_text(ctx), P._library_text(ctx)])
    blockers = [{"quote": b.get("quote"), "turn": b.get("turn")} for b in g.get("roadmap_blockers") or []]
    return {"vp": dump({"quote": vp.get("quote"), "turn": vp.get("turn"), "key_expression": vp.get("key_expression")})
            if vp else "none (no category to give)",
            "a": dump(g.get("selected_A")), "b": dump(g.get("selected_B")), "blockers": dump(blockers), "references": refs}


class PitchAnswers:
    def __init__(self, ctx: CallContext, s3: dict):
        self.ctx, self.s3 = ctx, s3

    def __call__(self, task_id: str, uid: str, unit: Any) -> Optional[dict]:
        if task_id == "pitch.p_category":
            c = self.s3.get("category")
            return c if isinstance(c, dict) and c.get("category") else None
        if task_id in SINGLE:
            v = self.s3.get(SINGLE[task_id])
            return v if isinstance(v, dict) else {}
        if task_id in LISTS:
            key, field = LISTS[task_id]
            a, b = unit
            lo, hi = self.ctx.n(a), self.ctx.n(b)
            items = []
            for x in self.s3.get(key) or []:
                try:
                    if isinstance(x, dict) and lo <= self.ctx.n(x.get("turn")) <= hi:
                        items.append(x)
                except (KeyError, TypeError):
                    continue
            return {field: items}
        return None


def run_pitch(ctx: CallContext, s3: dict, drops: Drops) -> CompetenceResult:
    """S3 answered: the engine decides. Items listed outside every chunk of the pitch window (before the pitch start or
    after the decision request) are dropped and counted."""
    comp = P.PitchCompetence()
    window = {t for a, b in P.chunks(ctx, comp.cfg["chunk_turns"]) for t in
              (x.id for x in ctx.turns[ctx.n(a): ctx.n(b) + 1])} if ctx.phases.pitch_start else set()
    for key, _ in LISTS.values():
        for x in s3.get(key) or []:
            if not (isinstance(x, dict) and x.get("turn") in window):
                drops.add(STEP, f"{key}:outside_pitch_window", x if isinstance(x, dict) else None)
    runner = StepRunner(PitchAnswers(ctx, s3), drops, STEP)
    res = comp.run(ctx, runner)
    res.concordance = "single_reading" if res.concordance else None
    res.details = dict(res.details or {}, lite={"units": runner.units, "dropped": drops.counts.get(STEP, {})})
    return res
