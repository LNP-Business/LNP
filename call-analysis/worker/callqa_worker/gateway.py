"""Model client of the engine (core/llm.py ModelClient) going through the Edge Function callqa-llm.

The worker never holds the model key: the gateway does (Supabase function secret ANTHROPIC_API_KEY). Model ids per tier
come from crm_ca_config (never from code). Token usage is added up per tier for the job row.

Cost (docs/ARCHITECTURE.md §7, Romain 2026-10-28): the model answers one closed JSON question, so its thinking runs at
effort "low" (an `effort` key in the claim's config would override it); the question of a pass (pass_no >= 1) is marked for caching, since the
same prompt is asked three times (passes 2 and 3 read it from the cache, see prefetch.fetch). The answers are the same
kind of answer: quotes are still checked by code, three passes and the arbiter still decide.
"""
from __future__ import annotations

import json
import threading
import time
import urllib.error
import urllib.request
from typing import Any

from alkimiy_callqa.core.llm import parse_json


# tasks asked at another effort than the job's (docs/ARCHITECTURE.md §7). "default" = the model's own default (no effort
# sent). The foundation decides whether the call can be analysed at all (attribution, phases): at effort low, Amber
# Peterson's call was excluded as diarization_suspect on one run and analysed on another (2026-10-28), so it keeps the
# default; it is a cheap fast-tier step. The register of a SPIN question (SB-33) is asked at medium.
TASK_EFFORT = {"foundation.attribution": "default", "foundation.phases": "default", "spin.register": "medium"}


class GatewayError(RuntimeError):
    def __init__(self, msg: str, final: bool = False):
        super().__init__(msg)
        self.final = final


class GatewayClient:
    def __init__(self, url: str, key: str, tiers: dict[str, str], max_tokens: int = 4000, attempts: int = 5,
                 timeout: float = 180, sleep=time.sleep, opener=None, effort: str = "low"):
        missing = [t for t in ("fast", "strong", "arbiter") if not tiers.get(t)]
        if missing:
            raise GatewayError("model id missing for tier " + ", ".join(missing) + " (crm_ca_config)", final=True)
        self.url, self.key, self.tiers, self.effort = url, key, tiers, effort
        self.max_tokens, self.attempts, self.timeout, self.sleep = max_tokens, attempts, timeout, sleep
        self.opener = opener or urllib.request.urlopen
        self.lock = threading.Lock()
        self.usage: dict[str, dict[str, int]] = {}

    def _count(self, tier: str, usage: dict) -> None:
        with self.lock:
            u = self.usage.setdefault(tier, {"calls": 0, "input_tokens": 0, "output_tokens": 0,
                                             "cache_read_input_tokens": 0, "cache_creation_input_tokens": 0})
            u["calls"] += 1
            for k in ("input_tokens", "output_tokens", "cache_read_input_tokens", "cache_creation_input_tokens"):
                u[k] += int(usage.get(k) or 0)

    def ask(self, task_id: str, unit_id: str, tier: str, system: str, prompt: str, pass_no: int) -> dict[str, Any]:
        body = json.dumps({"model": self.tiers[tier], "system": system, "prompt": prompt,
                           "max_tokens": self.max_tokens, "effort": TASK_EFFORT.get(task_id, self.effort),
                           "cache_prompt": int(pass_no) >= 1}).encode()
        last = ""
        for i in range(self.attempts):
            req = urllib.request.Request(self.url, data=body, method="POST", headers={
                "authorization": "Bearer " + self.key, "content-type": "application/json"})
            try:
                with self.opener(req, timeout=self.timeout) as r:
                    out = json.loads(r.read())
                self._count(tier, out.get("usage") or {})
                return parse_json(out.get("text") or "")
            except urllib.error.HTTPError as e:
                try:
                    j = json.loads(e.read())
                except Exception:  # noqa: BLE001
                    j = {}
                last = f"HTTP {e.code} {j.get('error', '')}".strip()
                # wrong key, no model key in Supabase, or the provider refused the request itself (the gateway says retry
                # false: a bad model id or parameter): the same request fails every time, so the whole job stops
                if e.code in (401, 409) or (e.code == 502 and j.get("retry") is False):
                    raise GatewayError(last, final=True) from None
                if e.code not in (429, 503, 504, 500, 502):
                    raise GatewayError(last) from None
            except (urllib.error.URLError, TimeoutError) as e:
                last = str(e)
            self.sleep(min(2 ** (i + 1), 30))
        raise GatewayError("model gateway unavailable: " + last)
