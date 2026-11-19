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

from lnp_analyse.noyau.modeles import ContexteAppel


class EnAttente(Exception):
    """A question whose answer has not been fetched yet (this round only)."""


class TropLong(Exception):
    """The analysis passed its time budget: stopped for good (not retried), so a stuck call never burns credit twice."""


def _cle(id_tache: str, id_unite: str, palier: str, systeme: str, consigne: str, no_passe: int) -> tuple:
    return (id_tache, id_unite, int(no_passe), palier, hashlib.sha256((systeme + "\n" + consigne).encode()).hexdigest())


class ClientAnticipe:
    """ModelClient for the engine: answers from the cache, records what is missing."""

    def __init__(self, interne: Any):
        self.interne = interne
        self.cache: dict[tuple, tuple[bool, Any]] = {}   # key -> (ok, answer or exception)
        self.manquant: list[tuple[tuple, tuple]] = []     # (key, ask args) in the order the engine asked
        self.demande: set[tuple] = set()

    def demander(self, id_tache, id_unite, palier, systeme, consigne, no_passe):
        k = _cle(id_tache, id_unite, palier, systeme, consigne, no_passe)
        if k in self.cache:
            ok, v = self.cache[k]
            if ok:
                return v
            raise v
        if k not in self.demande:
            self.demande.add(k)
            self.manquant.append((k, (id_tache, id_unite, palier, systeme, consigne, no_passe)))
        raise EnAttente(f"{id_tache}:{id_unite}:{no_passe}")

    def lot_suivant(self) -> list[tuple[tuple, tuple]]:
        """The questions of the first waiting task; arbitrations (pass 0) only once their passes are known."""
        if not self.manquant:
            return []
        premier = self.manquant[0][1][0]
        unites_en_attente = {(k[0], k[1]) for k, a in self.manquant if k[2] >= 1}
        return [(k, a) for k, a in self.manquant
                if a[0] == premier and (k[2] >= 1 or (k[0], k[1]) not in unites_en_attente)] or [self.manquant[0]]

    def recuperer(self, lot: list[tuple[tuple, tuple]], executants: int = 16) -> None:
        """Pass 1 (and arbitrations) first, then passes 2 and 3: they send the same prompt as pass 1, which the provider
        has cached by then (cost, docs/ARCHITECTURE.md §7). Same questions, same answers kept: only the order of sending."""
        premier = [it for it in lot if it[0][2] <= 1]
        self._recuperer(premier, executants)
        self._recuperer([it for it in lot if it[0][2] > 1], executants)

    def _recuperer(self, lot: list[tuple[tuple, tuple]], executants: int) -> None:
        if not lot:
            return

        def un(item):
            k, a = item
            try:
                return k, (True, self.interne.demander(*a))
            except Exception as e:  # noqa: BLE001 - kept as the sequential run would see it
                return k, (False, e)
        with ThreadPoolExecutor(max_workers=executants) as reserve:
            fait = list(reserve.map(un, lot))
        for k, v in fait:
            # an error that would hit every question (wrong key, refused parameter) stops the job: no empty record stored
            if not v[0] and getattr(v[1], "final", False):
                raise v[1]
            self.cache[k] = v

    def tour_lot_debut(self) -> None:
        self.manquant, self.demande = [], set()


def analyser_par_tours(construire: Callable[[], ContexteAppel], executer: Callable[[ContexteAppel, ClientAnticipe], None],
                      client: ClientAnticipe, executants: int = 16, tours_max: int = 400,
                      journal: Optional[Callable[[str], None]] = None, budget_s: Optional[float] = None) -> ContexteAppel:
    """build() makes a fresh CallContext, run(ctx, client) runs the pipeline on it; repeated until nothing is missing."""
    t0 = time.time()
    for n in range(1, tours_max + 1):
        if budget_s is not None and time.time() - t0 > budget_s:
            raise TropLong(f"stopped after {round((time.time() - t0) / 60)} min and {n - 1} rounds "
                          f"({len(client.cache)} answers): longer than the time budget")
        client.tour_lot_debut()
        ctx = construire()
        executer(ctx, client)
        if not client.manquant:
            # the final round ran on cached answers only: drop the Pending traces of earlier rounds (none in this ctx)
            if journal:
                journal(f"round {n}: complete ({len(client.cache)} answers)")
            return ctx
        lot = client.lot_suivant()
        if journal:
            journal(f"round {n}: {lot[0][1][0]} × {len(lot)} (missing {len(client.manquant)}, cached {len(client.cache)})")
        client.recuperer(lot, executants)
    raise RuntimeError(f"the analysis did not settle after {tours_max} rounds")
