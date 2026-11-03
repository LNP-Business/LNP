"""S0 → phase map. The model lists the sales turns with an offer, an amount or a decision cue (the closed answers of the
engine's `foundation.phases` task, for every turn at once); the engine's `decide_phases` places the anchors (PB-1,
PB-2/PB-17, PB-3/PB-18, PB-19, PB-4) and `spin.discovery_end` the end of the discovery (SB-1)."""
from __future__ import annotations

from alkimiy_callqa.competences.spin import discovery_end
from alkimiy_callqa.core.foundation import _ph_validate, decide_phases
from alkimiy_callqa.core.models import CallContext, SALES

from .shim import Drops

STEP = "S0"
FLAGS = ("offer_description", "screen_share", "followed_by_discovery", "price_for_offer", "hypothetical",
         "decision_request")


def apply_phases(ctx: CallContext, answer: dict, drops: Drops) -> None:
    answers: dict[str, dict] = {}
    for c in answer.get("turns") or []:
        if not isinstance(c, dict):
            drops.add(STEP, "not_an_object")
            continue
        try:
            t = ctx.turn(c.get("turn") or "")
        except KeyError:
            drops.add(STEP, "unknown_turn", c)
            continue
        if t.role != SALES:
            drops.add(STEP, "wrong_speaker", c)
            continue
        errs = _ph_validate(c, ctx, t)
        if errs:
            drops.add(STEP, errs[0] or "bad_quote", c)
            continue
        prev = answers.get(t.id)
        if prev:                                  # the same turn listed twice: the closed answers are merged
            for k in FLAGS:
                prev[k] = bool(prev.get(k) or c.get(k))
            prev["amount"] = prev.get("amount") or c.get("amount")
        else:
            answers[t.id] = dict(c)
    decide_phases(ctx, answers)
    ctx.phases.discovery_end = discovery_end(ctx)
