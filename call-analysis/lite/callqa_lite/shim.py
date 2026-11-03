"""The reference engine's competences (Gap, Pitch) run unchanged on the lite answers.

`StepRunner` has the `Runner.run(ctx, task, unit_id, unit)` interface of alkimiy_callqa.core.runner: instead of asking
the model three times, it takes the answer to the engine's closed question from the whole-call step already answered
(`answer_fn`), then checks it with the engine task's own validator (every quote, speaker and phase, C3). Invalid items
of a list are dropped one by one and counted; an invalid sub-object is set to null and counted; an answer that is still
invalid after that leaves the unit `to_review`, as in the engine. There is one reading, so nothing is arbitrated.
"""
from __future__ import annotations

from typing import Any, Callable, Optional

from alkimiy_callqa.core.models import CallContext
from alkimiy_callqa.core.runner import ModelTask, Resolved


class Drops:
    """What the code rejected, per step: {step: {reason: count}} and a short list of examples for the audit."""

    def __init__(self):
        self.counts: dict[str, dict[str, int]] = {}
        self.examples: list[dict] = []

    def add(self, step: str, reason: str, item: Any = None) -> None:
        r = self.counts.setdefault(step, {})
        r[reason] = r.get(reason, 0) + 1
        if len(self.examples) < 200:
            self.examples.append({"step": step, "reason": reason,
                                  "turn": item.get("turn") if isinstance(item, dict) else None})

    def total(self, step: str) -> int:
        return sum(self.counts.get(step, {}).values())


def _errors(task: ModelTask, ans: Any, ctx: CallContext, uid: str) -> list[str]:
    if not isinstance(ans, dict):
        return ["not_an_object"]
    try:
        return list(task.validate(ans, ctx, uid))
    except Exception as e:  # noqa: BLE001 - a validator that cannot read the answer rejects it
        return [f"invalid_shape:{type(e).__name__}"]


def sanitize(task: ModelTask, ans: Any, ctx: CallContext, uid: str, drops: Drops, step: str) -> Optional[dict]:
    """Keep what the engine validator accepts: drop invalid list items, null invalid sub-objects."""
    if not _errors(task, ans, ctx, uid):
        return ans
    if not isinstance(ans, dict):
        drops.add(step, "not_an_object")
        return None
    scalars = {k: v for k, v in ans.items() if not isinstance(v, (list, dict))}
    out = dict(ans)
    for k, v in ans.items():
        if isinstance(v, list):
            keep = []
            for x in v:
                e = _errors(task, {**scalars, k: [x]}, ctx, uid)
                if e:
                    drops.add(step, f"{task.id}:{e[0].split(':')[0]}", x)
                else:
                    keep.append(x)
            out[k] = keep
        elif isinstance(v, dict):
            e = _errors(task, {**scalars, k: v}, ctx, uid)
            if e:
                drops.add(step, f"{task.id}:{e[0].split(':')[0]}", v)
                out[k] = None
    if _errors(task, out, ctx, uid):
        drops.add(step, f"{task.id}:unit_to_review")
        return None
    return out


class StepRunner:
    """Runner for the engine competences, answering each closed question from a step answer."""

    def __init__(self, answer_fn: Callable[[str, str, Any], Optional[dict]], drops: Drops, step: str):
        self.answer_fn, self.drops, self.step = answer_fn, drops, step
        self.units: list[dict] = []

    def run(self, ctx: CallContext, task: ModelTask, unit_id: str, unit: Any) -> Resolved:
        raw = self.answer_fn(task.id, unit_id, unit)
        ans = None if raw is None else sanitize(task, raw, ctx, unit_id, self.drops, self.step)
        status = "verified" if ans is not None else "to_review"
        self.units.append({"task": task.id, "unit": unit_id, "status": status})
        if ans is None:
            return Resolved(None, "to_review", "0/1")
        return Resolved(ans, "verified", "1/1", [{"pass": 1, "answer": ans, "errors": []}])

    def _arbitrate(self, ctx, task, unit_id, unit, prompt, readings, conc) -> Resolved:
        """force_arbitration (a P outside the nine categories, Pitch §2.1): one reading, no arbiter here; the engine
        keeps the reading and its uncovered_case flag."""
        return Resolved(None, "to_review", conc, readings)
