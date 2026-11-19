"""Les compétences du moteur de référence (écart, présentation) tournent sans changement sur les réponses du moteur
allégé.

`ExecuteurEtape` a l'interface `Executeur.executer(ctx, tache, id_unite, unite)` de lnp_analyse.noyau.executeur : au
lieu de poser trois fois la question au modèle, il prend la réponse à la question fermée du moteur dans l'étape sur
l'appel entier déjà répondue (`fn_reponse`), puis la vérifie avec le propre validateur de la tâche du moteur (chaque
citation, locuteur et phase, C3). Les items invalides d'une liste sont écartés un par un et comptés ; un sous-objet
invalide est mis à null et compté ; une réponse encore invalide après cela laisse l'unité `to_review`, comme dans le
moteur. Il n'y a qu'une lecture, donc rien n'est arbitré.
"""
from __future__ import annotations

from typing import Any, Callable, Optional

from lnp_analyse.noyau.modeles import ContexteAppel
from lnp_analyse.noyau.executeur import TacheModele, Resolu


class Rejets:
    """Ce que le code a rejeté, par étape : {étape: {raison: nombre}} et une courte liste d'exemples pour l'audit."""

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
    except Exception as e:  # noqa: BLE001 - un validateur qui ne peut pas lire la réponse la rejette
        return [f"invalid_shape:{type(e).__name__}"]


def assainir(tache: TacheModele, rep: Any, ctx: ContexteAppel, uid: str, rejets: Rejets, etape: str) -> Optional[dict]:
    """Garde ce que le validateur du moteur accepte : écarte les items invalides des listes, met à null les sous-objets
    invalides."""
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
    """Exécuteur pour les compétences du moteur, qui répond à chaque question fermée à partir de la réponse d'une
    étape."""

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
        """force_arbitration (un P hors des neuf catégories, Présentation §2.1) : une seule lecture, pas d'arbitre ici ;
        le moteur garde la lecture et son signal uncovered_case."""
        return Resolu(None, "to_review", conc, lectures_)
