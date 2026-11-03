"""One model call per step, through the gateway (callqa-llm): the transcript is a cached prefix shared by the steps.

The client is anything with `complete(task_id, unit_id, tier, system, prefix, prompt, max_tokens, effort)` returning
{"text", "stop_reason"} (callqa_worker.gateway.GatewayClient.complete, or the MockLiteClient of the tests). The answer
is parsed as JSON; an invalid answer is asked again once with the parsing error (C3 rule 7), never more. Every call is
written to the audit (task, unit, tier, prompt hash, answer, errors); nothing is logged.
"""
from __future__ import annotations

import hashlib
import json
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Optional

from alkimiy_callqa.core.models import CallContext

PROMPTS = Path(__file__).resolve().parent / "prompts"


def load(name: str) -> str:
    return (PROMPTS / f"{name}.md").read_text(encoding="utf-8")


def fill(template: str, **values: str) -> str:
    """Placeholders are {name}; the JSON examples of the prompts keep their braces."""
    for k, v in values.items():
        template = template.replace("{" + k + "}", v)
    return template


def parse_json(text: str) -> dict[str, Any]:
    """Robust reading of the model's text: code fences, prose around the object, trailing commas."""
    t = (text or "").strip()
    t = re.sub(r"^```[a-zA-Z]*\s*", "", t)
    t = re.sub(r"\s*```\s*$", "", t)
    i, j = t.find("{"), t.rfind("}")
    if i < 0 or j <= i:
        raise ValueError("no JSON object in the answer")
    body = t[i:j + 1]
    try:
        v = json.loads(body)
    except json.JSONDecodeError:
        try:
            v = json.loads(re.sub(r",\s*([}\]])", r"\1", body))
        except json.JSONDecodeError as e:
            raise ValueError(f"invalid JSON: {e.msg} at {e.pos}") from None
    if not isinstance(v, dict):
        raise ValueError("the answer is not a JSON object")
    return v


def render_turns(ctx: CallContext) -> str:
    """The cached prefix: numbered turns, `T001 [SALES] text`. Turns marked attribution_doubtful are left out."""
    lines = [f"{t.id} [{t.role}] {t.text}" for t in ctx.turns if not t.attribution_doubtful]
    return f"TRANSCRIPT · {len(lines)} turns\n" + "\n".join(lines)


@dataclass
class StepAnswer:
    answer: Optional[dict]
    stop_reason: Optional[str] = None
    error: Optional[str] = None


@dataclass
class Steps:
    client: Any
    ctx: CallContext
    tier: str = "fast"
    effort: str = "low"
    system: str = field(default_factory=lambda: load("system"))
    prefix: str = ""

    def __post_init__(self):
        self.prefix = self.prefix or render_turns(self.ctx)

    def ask(self, task_id: str, unit_id: str, prompt: str, max_tokens: int, replay_truncated: bool = True) -> StepAnswer:
        last_err, stop = None, None
        for attempt in (1, 2):
            p = prompt if attempt == 1 else (
                prompt + "\n\nYOUR PREVIOUS ANSWER WAS REJECTED BY THE CODE: " + str(last_err) +
                ". Return only the JSON object, with the same schema, every quote copied exactly from its turn.")
            out = self.client.complete(task_id, unit_id, self.tier, self.system, self.prefix, p, max_tokens, self.effort)
            stop = (out or {}).get("stop_reason")
            entry = {"task": task_id, "unit": unit_id, "pass": 1, "attempt": attempt, "tier": self.tier,
                     "prompt_hash": hashlib.sha256((self.system + "\n" + p).encode()).hexdigest()[:16],
                     "stop_reason": stop}
            try:
                ans = parse_json((out or {}).get("text") or "")
            except ValueError as e:
                last_err = "truncated answer (max_tokens)" if stop == "max_tokens" else str(e)
                entry["errors"] = [last_err]
                self.ctx.audit.append(entry)
                if stop == "max_tokens" and not replay_truncated:
                    return StepAnswer(None, stop, last_err)
                continue
            entry.update(answer=ans, errors=[])
            self.ctx.audit.append(entry)
            return StepAnswer(ans, stop, None)
        self.ctx.audit.append({"task": task_id, "unit": unit_id, "error": f"no valid JSON after a replay: {last_err}"})
        return StepAnswer(None, stop, last_err)


class MockLiteClient:
    """Replays recorded answers per step id (tests, offline runs). An answer may be a dict, a raw string, or a list of
    them (one per call of that step, the last one repeated)."""

    def __init__(self, answers: dict[str, Any]):
        self.answers = answers
        self.calls: list[dict] = []
        self.usage: dict = {}

    def complete(self, task_id, unit_id, tier, system, prefix, prompt, max_tokens=16000, effort="low"):
        self.calls.append({"task": task_id, "unit": unit_id, "tier": tier, "prompt": prompt, "prefix": prefix,
                           "max_tokens": max_tokens, "effort": effort})
        a = self.answers.get(task_id, {})
        if isinstance(a, list):
            n = sum(1 for c in self.calls if c["task"] == task_id) - 1
            a = a[min(n, len(a) - 1)]
        if isinstance(a, tuple):              # (text, stop_reason)
            return {"text": a[0], "stop_reason": a[1]}
        return {"text": a if isinstance(a, str) else json.dumps(a), "stop_reason": "end_turn"}
