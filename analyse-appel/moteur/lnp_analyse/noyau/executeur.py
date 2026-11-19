"""Tâches du modèle et leur exécution : trois passes indépendantes, validation, nouvelle demande, arbitrage (partie C, C4).

Une TacheModele est une question fermée. Elle sait construire sa consigne pour une unité, valider la réponse (chaque
citation vérifiée par le code) et quelle partie de la réponse doit concorder d'une passe à l'autre.
"""
from __future__ import annotations

import json
import random
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable, Optional

from .client_modele import ClientModele, empreinte_consigne
from .modeles import ContexteAppel

CONSIGNES = Path(__file__).resolve().parent.parent / "consignes"


def charger_consigne(nom_: str) -> str:
    return (CONSIGNES / f"{nom_}.md").read_text(encoding="utf-8")


@dataclass
class TacheModele:
    id: str                                   # par exemple "gap.restitution"
    palier: str                                 # fast / strong
    regles: str                                # nom du fichier de consigne dans consignes/ (sans .md)
    construire: Callable[[ContexteAppel, Any], str]  # unité -> consigne de l'utilisateur (extrait de transcription + question)
    valider: Callable[[dict, ContexteAppel, Any], list[str]]   # -> liste de codes d'erreur (vide = valable)
    cle: Callable[[dict], Any]                # signature utile à la décision, comparée d'une passe à l'autre
    passes: int = 3


@dataclass
class Resolu:
    reponse: Optional[dict]
    statut: str                               # verified / arbitrated / to_review
    concordance: str                          # "3/3", "2/3"…
    lectures_: list[dict] = field(default_factory=list)
    justification: Optional[str] = None
    libelle_cas: Optional[str] = None          # application_error / rule_ambiguity / uncovered_case


@dataclass
class ConfigExecution:
    passes: int = 3
    passe_unique_permise: bool = False         # option de coût de C4, seulement quand la reproductibilité atteint 95 %
    taux_echantillon: float = 0.10                 # part des unités encore lues en 3 passes en mode passe unique
    version_regles: str = "1.0"
    graine: int = 0
    passes_paralleles: bool = False             # lancer les passes d'une unité en même temps (exécutant) ; sans effet sur les décisions


class Executeur:
    def __init__(self, client: ClientModele, config: Optional[ConfigExecution] = None):
        self.client = client
        self.cfg = config or ConfigExecution()
        self.alea = random.Random(self.cfg.graine)
        self.systeme_commun = charger_consigne("systeme_commun")

    # -------------------------------------------------------------------------------------------
    def _demander(self, ctx: ContexteAppel, tache: TacheModele, id_unite: str, consigne: str, no_passe: int,
             palier: Optional[str] = None) -> tuple[Optional[dict], list[str]]:
        systeme = self.systeme_commun + "\n\n" + charger_consigne(tache.regles)
        try:
            rep = self.client.demander(tache.id, id_unite, palier or tache.palier, systeme, consigne, no_passe)
        except Exception as e:  # noqa: BLE001 - chaque échec est inscrit au journal d'audit, jamais passé sous silence
            ctx.audit.append({"task": tache.id, "unit": id_unite, "pass": no_passe, "error": repr(e)})
            return None, ["model_error"]
        errs = _verifier(tache, rep, ctx, id_unite)
        if errs:  # C3 règle 7 : redemander une fois avec le message d'erreur
            reessayer = consigne + "\n\nTA RÉPONSE PRÉCÉDENTE A ÉTÉ REJETÉE PAR LE CODE : " + ", ".join(errs) + \
                "\nRecopie chaque citation caractère pour caractère depuis le tour cité, prononcé par le rôle attendu."
            try:
                rep = self.client.demander(tache.id, id_unite, palier or tache.palier, systeme, reessayer, no_passe)
                errs = _verifier(tache, rep, ctx, id_unite)
            except Exception as e:  # noqa: BLE001
                errs = ["model_error"]
                ctx.audit.append({"task": tache.id, "unit": id_unite, "pass": no_passe, "error": repr(e)})
        ctx.audit.append({"task": tache.id, "unit": id_unite, "pass": no_passe, "tier": palier or tache.palier,
                          "prompt_hash": empreinte_consigne(systeme, consigne), "answer": rep, "errors": errs})
        return (rep if not errs else None), errs

    def executer(self, ctx: ContexteAppel, tache: TacheModele, id_unite: str, unite: Any) -> Resolu:
        consigne = tache.construire(ctx, unite)
        n = tache.passes
        if self.cfg.passe_unique_permise and self.alea.random() > self.cfg.taux_echantillon:
            n = 1
        lectures_, cles = [], []
        if self.cfg.passes_paralleles and n > 1:  # les passes restent indépendantes : aucune ne voit la réponse d'une autre
            with ThreadPoolExecutor(max_workers=n) as reserve:
                fait = list(reserve.map(lambda p: self._demander(ctx, tache, id_unite, consigne, p), range(1, n + 1)))
        else:
            fait = [self._demander(ctx, tache, id_unite, consigne, p) for p in range(1, n + 1)]
        for p, (rep, errs) in enumerate(fait, 1):
            lectures_.append({"pass": p, "answer": rep, "errors": errs})
            cles.append(None if rep is None else _cle(tache, rep))
        valide_ = [k for k in cles if k is not None]
        haut = max(set(valide_), key=valide_.count) if valide_ else None
        accord_ = valide_.count(haut) if haut else 0
        conc = f"{accord_}/{n}"
        if valide_ and accord_ == n:
            rep = next(r["answer"] for r, k in zip(lectures_, cles) if k == haut)
            return Resolu(rep, "verified", conc, lectures_)
        return self._arbitrer(ctx, tache, id_unite, unite, consigne, lectures_, conc)

    def _arbitrer(self, ctx, tache, id_unite, unite, consigne, lectures_, conc) -> Resolu:
        consigne_arb = (consigne + "\n\nTROIS LECTURES INDÉPENDANTES DE CETTE UNITÉ (ne vote pas entre elles ; "
                      "parcours les règles dans leur ordre fixe et décide) :\n" +
                      json.dumps([r["answer"] for r in lectures_], ensure_ascii=False, indent=1) +
                      "\n\nRéponds avec le même schéma JSON, plus \"justification\" (une phrase) et "
                      "\"case_label\" (application_error | rule_ambiguity | uncovered_case | undecidable : erreur "
                      "d'application, règle ambiguë, cas non couvert, impossible à trancher).")
        rep, errs = self._demander(ctx, tache, id_unite, consigne_arb, 0, palier="arbiter")
        if rep is None or rep.get("case_label") == "undecidable":
            return Resolu(None, "to_review", conc, lectures_)
        return Resolu(rep, "arbitrated", conc, lectures_, rep.get("justification"), rep.get("case_label"))


def _verifier(tache: TacheModele, rep: Any, ctx: ContexteAppel, id_unite: str) -> list[str]:
    """C3 règle 7 : une réponse d'une forme inattendue (une liste là où un objet est attendu…) est une réponse invalide,
    redemandée une fois puis to_review pour cette unité seulement ; elle ne fait jamais planter la compétence
    (Sara Salem, 2026-10-28 : KeyError(0))."""
    if rep is None:
        return ["empty"]
    if not isinstance(rep, dict):
        return ["not_an_object"]
    try:
        return tache.valider(rep, ctx, id_unite)
    except Exception as e:  # noqa: BLE001 - un validateur qui ne sait pas lire la réponse la rejette
        return [f"invalid_shape:{type(e).__name__}"]


def _cle(tache: TacheModele, rep: dict) -> Optional[str]:
    try:
        return json.dumps(tache.cle(rep), sort_keys=True, default=str)
    except Exception:  # noqa: BLE001 - une lecture illisible compte comme aucune lecture valable
        return None


def forcer_arbitrage(executeur: "Executeur", ctx: ContexteAppel, tache: TacheModele, id_unite: str, unite: Any,
                      resolu: "Resolu") -> "Resolu":
    """Envoie une unité à l'arbitre même quand les passes concordent (par exemple un P hors des neuf catégories,
    Présentation §2.1)."""
    consigne = tache.construire(ctx, unite)
    return executeur._arbitrer(ctx, tache, id_unite, unite, consigne, resolu.lectures_, resolu.concordance)
