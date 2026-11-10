"""Model access. The engine never lets a model score: a model answers closed questions with quotes.

`ModelClient.ask` returns parsed JSON. Two implementations:
- AnthropicClient: real calls (needs the `anthropic` package and an API key; model ids are configuration).
- MockClient: replays recorded answers keyed by task id and unit id (tests, offline runs).
"""
from __future__ import annotations

import hashlib
import json
import os
import re
from typing import Any, Callable, Optional, Protocol


class ModelClient(Protocol):
    def ask(self, task_id: str, unit_id: str, tier: str, system: str, prompt: str,
            pass_no: int) -> dict[str, Any]: ...


def prompt_hash(system: str, prompt: str) -> str:
    return hashlib.sha256((system + "\n" + prompt).encode()).hexdigest()[:16]


def parse_json(text: str) -> dict[str, Any]:
    m = re.search(r"\{.*\}", text, re.S)
    if not m:
        raise ValueError("no JSON object in model output")
    return json.loads(m.group(0))


class AnthropicClient:
    """Thin wrapper. Model identifiers per tier are configuration, never hard-coded business facts.

    tiers: {"fast": "<model id>", "strong": "<model id>", "arbiter": "<model id>"}
    """

    def __init__(self, tiers: dict[str, str], max_tokens: int = 4000, temperature: float = 0.0):
        import anthropic  # optional dependency
        self.client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))
        self.tiers, self.max_tokens, self.temperature = tiers, max_tokens, temperature

    def ask(self, task_id, unit_id, tier, system, prompt, pass_no):
        msg = self.client.messages.create(
            model=self.tiers[tier], max_tokens=self.max_tokens, temperature=self.temperature,
            system=system, messages=[{"role": "user", "content": prompt}])
        text = "".join(b.text for b in msg.content if getattr(b, "type", "") == "text")
        return parse_json(text)


class MockClient:
    """Replays answers. `answers[(task_id, unit_id)]` is either one dict (same answer on every pass)
    or a list of dicts (one per pass; the arbiter is pass 0). A callable can also be given."""

    def __init__(self, answers: Optional[dict] = None, fallback: Optional[Callable] = None):
        self.answers = answers or {}
        self.fallback = fallback
        self.calls: list[tuple[str, str, int]] = []

    def ask(self, task_id, unit_id, tier, system, prompt, pass_no):
        self.calls.append((task_id, unit_id, pass_no))
        a = self.answers.get((task_id, unit_id))
        if a is None and self.fallback:
            return self.fallback(task_id, unit_id, prompt, pass_no)
        if a is None:
            raise KeyError(f"no mock answer for {(task_id, unit_id)}")
        if isinstance(a, list):
            return a[min(max(pass_no - 1, 0), len(a) - 1)] if pass_no else a[-1]
        return a
