"""Runs the engine's model questions in parallel batches without touching the engine (call-analysis/PLAN.md §2).

The engine asks its closed questions one after the other (a one-hour call: about 2 000 questions with the three passes),
which took more than 5 hours on the first real call. Its loops are independent inside a stage, but the next stage
depends on the answers of the previous one. So the worker replays the whole pipeline (pure code, a second or so) in
rounds:

1. every answer already received comes from a cache, keyed by (task, unit, pass, tier, prompt hash): a replayed prompt
   (after a rejected quote) or an arbitration prompt is a different key, so nothing is ever answered twice by mistake;
2. a question with no answer yet raises Pending inside the model client. The engine treats it as a model error (the
   unit becomes to_review for this round only) and goes on, so the round lists the questions it still needs;
3. the worker sends, in parallel, the questions of the first task that is still waiting (the earliest one cannot depend
   on any missing answer), and only the arbitrations whose three passes are all known, then starts the next round.

When a round finds no missing answer, its result is exactly the result of a sequential run with the same answers: the
code decides on the same inputs, in the same order. Errors of the provider are cached as errors, like a sequential run.
"""
from __future__ import annotations

import hashlib
import time
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Callable, Optional

from lnp_callqa.core.models import CallContext


class Pending(Exception):
    """A question whose answer has not been fetched yet (this round only)."""


class TooLong(Exception):
    """The analysis passed its time budget: stopped for good (not retried), so a stuck call never burns credit twice."""


def _key(task_id: str, unit_id: str, tier: str, system: str, prompt: str, pass_no: int) -> tuple:
    return (task_id, unit_id, int(pass_no), tier, hashlib.sha256((system + "\n" + prompt).encode()).hexdigest())


class PrefetchClient:
    """ModelClient for the engine: answers from the cache, records what is missing."""

    def __init__(self, inner: Any):
        self.inner = inner
        self.cache: dict[tuple, tuple[bool, Any]] = {}   # key -> (ok, answer or exception)
        self.missing: list[tuple[tuple, tuple]] = []     # (key, ask args) in the order the engine asked
        self.asked: set[tuple] = set()

    def ask(self, task_id, unit_id, tier, system, prompt, pass_no):
        k = _key(task_id, unit_id, tier, system, prompt, pass_no)
        if k in self.cache:
            ok, v = self.cache[k]
            if ok:
                return v
            raise v
        if k not in self.asked:
            self.asked.add(k)
            self.missing.append((k, (task_id, unit_id, tier, system, prompt, pass_no)))
        raise Pending(f"{task_id}:{unit_id}:{pass_no}")

    def next_batch(self) -> list[tuple[tuple, tuple]]:
        """The questions of the first waiting task; arbitrations (pass 0) only once their passes are known."""
        if not self.missing:
            return []
        first = self.missing[0][1][0]
        waiting_units = {(k[0], k[1]) for k, a in self.missing if k[2] >= 1}
        return [(k, a) for k, a in self.missing
                if a[0] == first and (k[2] >= 1 or (k[0], k[1]) not in waiting_units)] or [self.missing[0]]

    def fetch(self, batch: list[tuple[tuple, tuple]], workers: int = 16) -> None:
        """Pass 1 (and arbitrations) first, then passes 2 and 3: they send the same prompt as pass 1, which the provider
        has cached by then (cost, docs/ARCHITECTURE.md §7). Same questions, same answers kept: only the order of sending."""
        first = [it for it in batch if it[0][2] <= 1]
        self._fetch(first, workers)
        self._fetch([it for it in batch if it[0][2] > 1], workers)

    def _fetch(self, batch: list[tuple[tuple, tuple]], workers: int) -> None:
        if not batch:
            return

        def one(item):
            k, a = item
            try:
                return k, (True, self.inner.ask(*a))
            except Exception as e:  # noqa: BLE001 - kept as the sequential run would see it
                return k, (False, e)
        with ThreadPoolExecutor(max_workers=workers) as pool:
            done = list(pool.map(one, batch))
        for k, v in done:
            # an error that would hit every question (wrong key, refused parameter) stops the job: no empty record stored
            if not v[0] and getattr(v[1], "final", False):
                raise v[1]
            self.cache[k] = v

    def start_round(self) -> None:
        self.missing, self.asked = [], set()


def analyse_in_rounds(build: Callable[[], CallContext], run: Callable[[CallContext, PrefetchClient], None],
                      client: PrefetchClient, workers: int = 16, max_rounds: int = 400,
                      log: Optional[Callable[[str], None]] = None, budget_s: Optional[float] = None) -> CallContext:
    """build() makes a fresh CallContext, run(ctx, client) runs the pipeline on it; repeated until nothing is missing."""
    t0 = time.time()
    for n in range(1, max_rounds + 1):
        if budget_s is not None and time.time() - t0 > budget_s:
            raise TooLong(f"stopped after {round((time.time() - t0) / 60)} min and {n - 1} rounds "
                          f"({len(client.cache)} answers): longer than the time budget")
        client.start_round()
        ctx = build()
        run(ctx, client)
        if not client.missing:
            # the final round ran on cached answers only: drop the Pending traces of earlier rounds (none in this ctx)
            if log:
                log(f"round {n}: complete ({len(client.cache)} answers)")
            return ctx
        batch = client.next_batch()
        if log:
            log(f"round {n}: {batch[0][1][0]} × {len(batch)} (missing {len(client.missing)}, cached {len(client.cache)})")
        client.fetch(batch, workers)
    raise RuntimeError(f"the analysis did not settle after {max_rounds} rounds")
