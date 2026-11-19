"""The reference engine's competences (Gap, Pitch) run unchanged on the lite answers.

`StepRunner` has the `Runner.run(ctx, task, unit_id, unit)` interface of lnp_callqa.core.runner: instead of asking
the model three times, it takes the answer to the engine's closed question from the whole-call step already answered
(`answer_fn`), then checks it with the engine task's own validator (every quote, speaker and phase, C3). Invalid items
of a list are dropped one by one and counted; an invalid sub-object is set to null and counted; an answer that is still
invalid after that leaves the unit `to_review`, as in the engine. There is one reading, so nothing is arbitrated.
"""
from __future__ import annotations

from typing import Any, Callable, Optional

from lnp_analyse.noyau.modeles import ContexteAppel
from lnp_analyse.noyau.executeur import TacheModele, Resolu


class Rejets:
    """What the code rejected, per step: {step: {reason: count}} and a short list of examples for the audit."""

    def __init__(self):
        self.comptes: dict[str, dict[str, int]] = {}
        self.exemples: list[dict] = []

    def ajouter(self, etape: str, raison: str, item: Any = None) -> None:
        r = self.comptes.setdefault(etape, {})
        r[raison] = r.get(raison, 0) + 1
        if len(self.exemples) < 200:
            self.exemples.append({"step": etape, "reason": raison,
                                  "turn": item.get("turn") if isinstance(item, dict) else None})

    def total(self, etape: str) -> int:
        return sum(self.comptes.get(etape, {}).values())


def _erreurs(tache: TacheModele, rep: Any, ctx: ContexteAppel, uid: str) -> list[str]:
    if not isinstance(rep, dict):
        return ["not_an_object"]
    try:
        return list(tache.valider(rep, ctx, uid))
    except Exception as e:  # noqa: BLE001 - a validator that cannot read the answer rejects it
        return [f"invalid_shape:{type(e).__name__}"]


def assainir(tache: TacheModele, rep: Any, ctx: ContexteAppel, uid: str, rejets: Rejets, etape: str) -> Optional[dict]:
    """Keep what the engine validator accepts: drop invalid list items, null invalid sub-objects."""
    if not _erreurs(tache, rep, ctx, uid):
        return rep
    if not isinstance(rep, dict):
        rejets.ajouter(etape, "not_an_object")
        return None
    scalaires = {k: v for k, v in rep.items() if not isinstance(v, (list, dict))}
    sortie = dict(rep)
    for k, v in rep.items():
        if isinstance(v, list):
            garder = []
            for x in v:
                e = _erreurs(tache, {**scalaires, k: [x]}, ctx, uid)
                if e:
                    rejets.ajouter(etape, f"{tache.id}:{e[0].split(':')[0]}", x)
                else:
                    garder.append(x)
            sortie[k] = garder
        elif isinstance(v, dict):
            e = _erreurs(tache, {**scalaires, k: v}, ctx, uid)
            if e:
                rejets.ajouter(etape, f"{tache.id}:{e[0].split(':')[0]}", v)
                sortie[k] = None
    if _erreurs(tache, sortie, ctx, uid):
        rejets.ajouter(etape, f"{tache.id}:unit_to_review")
        return None
    return sortie


class ExecuteurEtape:
    """Runner for the engine competences, answering each closed question from a step answer."""

    def __init__(self, fn_reponse: Callable[[str, str, Any], Optional[dict]], rejets: Rejets, etape: str):
        self.fn_reponse, self.rejets, self.etape = fn_reponse, rejets, etape
        self.unites: list[dict] = []

    def executer(self, ctx: ContexteAppel, tache: TacheModele, id_unite: str, unite: Any) -> Resolu:
        brut = self.fn_reponse(tache.id, id_unite, unite)
        rep = None if brut is None else assainir(tache, brut, ctx, id_unite, self.rejets, self.etape)
        statut = "verified" if rep is not None else "to_review"
        self.unites.append({"task": tache.id, "unit": id_unite, "status": statut})
        if rep is None:
            return Resolu(None, "to_review", "0/1")
        return Resolu(rep, "verified", "1/1", [{"pass": 1, "answer": rep, "errors": []}])

    def _arbitrer(self, ctx, tache, id_unite, unite, consigne, lectures_, conc) -> Resolu:
        """force_arbitration (a P outside the nine categories, Pitch §2.1): one reading, no arbiter here; the engine
        keeps the reading and its uncovered_case flag."""
        return Resolu(None, "to_review", conc, lectures_)
