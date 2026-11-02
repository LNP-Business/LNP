"""Model tasks and their execution: three independent passes, validation, replay, arbitration (Part C, C4).

A ModelTask is a closed question. It knows how to build its prompt for one unit, how to validate the
answer (every quote checked by code), and which part of the answer must agree across passes.
"""
from __future__ import annotations

import json
import random
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable, Optional

from .llm import ModelClient, prompt_hash
from .models import CallContext

PROMPTS = Path(__file__).resolve().parent.parent / "prompts"


def load_prompt(name: str) -> str:
    return (PROMPTS / f"{name}.md").read_text(encoding="utf-8")


@dataclass
class ModelTask:
    id: str                                   # e.g. "gap.restitution"
    tier: str                                 # fast / strong
    rules: str                                # prompt file name in prompts/ (without .md)
    build: Callable[[CallContext, Any], str]  # unit -> user prompt (transcript extract + question)
    validate: Callable[[dict, CallContext, Any], list[str]]   # -> list of error codes (empty = valid)
    key: Callable[[dict], Any]                # decision-relevant signature compared across passes
    passes: int = 3


@dataclass
class Resolved:
    answer: Optional[dict]
    status: str                               # verified / arbitrated / to_review
    concordance: str                          # "3/3", "2/3", ...
    readings: list[dict] = field(default_factory=list)
    justification: Optional[str] = None
    case_label: Optional[str] = None          # application_error / rule_ambiguity / uncovered_case


@dataclass
class RunConfig:
    passes: int = 3
    single_pass_allowed: bool = False         # C4 cost option, only once reproducibility >= 95 %
    sample_rate: float = 0.10                 # share of units still run with 3 passes in single-pass mode
    rules_version: str = "1.0"
    seed: int = 0
    parallel_passes: bool = False             # run the passes of a unit at the same time (worker); no effect on decisions


class Runner:
    def __init__(self, client: ModelClient, config: Optional[RunConfig] = None):
        self.client = client
        self.cfg = config or RunConfig()
        self.rng = random.Random(self.cfg.seed)
        self.system_common = load_prompt("system_common")

    # -------------------------------------------------------------------------------------------
    def _ask(self, ctx: CallContext, task: ModelTask, unit_id: str, prompt: str, pass_no: int,
             tier: Optional[str] = None) -> tuple[Optional[dict], list[str]]:
        system = self.system_common + "\n\n" + load_prompt(task.rules)
        try:
            ans = self.client.ask(task.id, unit_id, tier or task.tier, system, prompt, pass_no)
        except Exception as e:  # noqa: BLE001 - every failure is audited, never silent
            ctx.audit.append({"task": task.id, "unit": unit_id, "pass": pass_no, "error": repr(e)})
            return None, ["model_error"]
        errs = _check(task, ans, ctx, unit_id)
        if errs:  # C3 rule 7: replay once with the error message
            retry = prompt + "\n\nYOUR PREVIOUS ANSWER WAS REJECTED BY THE CODE: " + ", ".join(errs) + \
                "\nCopy every quote character for character from the cited turn, spoken by the expected role."
            try:
                ans = self.client.ask(task.id, unit_id, tier or task.tier, system, retry, pass_no)
                errs = _check(task, ans, ctx, unit_id)
            except Exception as e:  # noqa: BLE001
                errs = ["model_error"]
                ctx.audit.append({"task": task.id, "unit": unit_id, "pass": pass_no, "error": repr(e)})
        ctx.audit.append({"task": task.id, "unit": unit_id, "pass": pass_no, "tier": tier or task.tier,
                          "prompt_hash": prompt_hash(system, prompt), "answer": ans, "errors": errs})
        return (ans if not errs else None), errs

    def run(self, ctx: CallContext, task: ModelTask, unit_id: str, unit: Any) -> Resolved:
        prompt = task.build(ctx, unit)
        n = task.passes
        if self.cfg.single_pass_allowed and self.rng.random() > self.cfg.sample_rate:
            n = 1
        readings, keys = [], []
        if self.cfg.parallel_passes and n > 1:  # the passes stay independent: none sees another's answer
            with ThreadPoolExecutor(max_workers=n) as pool:
                done = list(pool.map(lambda p: self._ask(ctx, task, unit_id, prompt, p), range(1, n + 1)))
        else:
            done = [self._ask(ctx, task, unit_id, prompt, p) for p in range(1, n + 1)]
        for p, (ans, errs) in enumerate(done, 1):
            readings.append({"pass": p, "answer": ans, "errors": errs})
            keys.append(None if ans is None else _key(task, ans))
        valid = [k for k in keys if k is not None]
        top = max(set(valid), key=valid.count) if valid else None
        agree = valid.count(top) if top else 0
        conc = f"{agree}/{n}"
        if valid and agree == n:
            ans = next(r["answer"] for r, k in zip(readings, keys) if k == top)
            return Resolved(ans, "verified", conc, readings)
        return self._arbitrate(ctx, task, unit_id, unit, prompt, readings, conc)

    def _arbitrate(self, ctx, task, unit_id, unit, prompt, readings, conc) -> Resolved:
        arb_prompt = (prompt + "\n\nTHREE INDEPENDENT READINGS OF THIS UNIT (do not vote between them; "
                      "walk the rules in their fixed order and decide):\n" +
                      json.dumps([r["answer"] for r in readings], ensure_ascii=False, indent=1) +
                      "\n\nAnswer with the same JSON schema, plus \"justification\" (one sentence) and "
                      "\"case_label\" (application_error | rule_ambiguity | uncovered_case | undecidable).")
        ans, errs = self._ask(ctx, task, unit_id, arb_prompt, 0, tier="arbiter")
        if ans is None or ans.get("case_label") == "undecidable":
            return Resolved(None, "to_review", conc, readings)
        return Resolved(ans, "arbitrated", conc, readings, ans.get("justification"), ans.get("case_label"))


def _check(task: ModelTask, ans: Any, ctx: CallContext, unit_id: str) -> list[str]:
    """C3 rule 7: an answer of an unexpected shape (a list where an object is expected...) is an invalid answer, replayed
    once then to_review for that unit only; it never crashes the competence (Sara Salem, 2026-10-28: KeyError(0))."""
    if ans is None:
        return ["empty"]
    if not isinstance(ans, dict):
        return ["not_an_object"]
    try:
        return task.validate(ans, ctx, unit_id)
    except Exception as e:  # noqa: BLE001 - a validator that cannot read the answer rejects it
        return [f"invalid_shape:{type(e).__name__}"]


def _key(task: ModelTask, ans: dict) -> Optional[str]:
    try:
        return json.dumps(task.key(ans), sort_keys=True, default=str)
    except Exception:  # noqa: BLE001 - an unreadable reading counts as no valid reading
        return None


def force_arbitration(runner: "Runner", ctx: CallContext, task: ModelTask, unit_id: str, unit: Any,
                      resolved: "Resolved") -> "Resolved":
    """Send a unit to the arbiter even when the passes agree (e.g. a P outside the nine categories, Pitch §2.1)."""
    prompt = task.build(ctx, unit)
    return runner._arbitrate(ctx, task, unit_id, unit, prompt, resolved.readings, resolved.concordance)
