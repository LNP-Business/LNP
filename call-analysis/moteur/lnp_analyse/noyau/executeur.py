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

from .client_modele import ClientModele, empreinte_consigne
from .modeles import ContexteAppel

CONSIGNES = Path(__file__).resolve().parent.parent / "consignes"


def charger_consigne(nom_: str) -> str:
    return (CONSIGNES / f"{nom_}.md").read_text(encoding="utf-8")


@dataclass
class TacheModele:
    id: str                                   # e.g. "gap.restitution"
    palier: str                                 # fast / strong
    regles: str                                # prompt file name in prompts/ (without .md)
    construire: Callable[[ContexteAppel, Any], str]  # unit -> user prompt (transcript extract + question)
    valider: Callable[[dict, ContexteAppel, Any], list[str]]   # -> list of error codes (empty = valid)
    cle: Callable[[dict], Any]                # decision-relevant signature compared across passes
    passes: int = 3


@dataclass
class Resolu:
    reponse: Optional[dict]
    statut: str                               # verified / arbitrated / to_review
    concordance: str                          # "3/3", "2/3", ...
    lectures_: list[dict] = field(default_factory=list)
    justification: Optional[str] = None
    libelle_cas: Optional[str] = None          # application_error / rule_ambiguity / uncovered_case


@dataclass
class ConfigExecution:
    passes: int = 3
    passe_unique_permise: bool = False         # C4 cost option, only once reproducibility >= 95 %
    taux_echantillon: float = 0.10                 # share of units still run with 3 passes in single-pass mode
    version_regles: str = "1.0"
    graine: int = 0
    passes_paralleles: bool = False             # run the passes of a unit at the same time (worker); no effect on decisions


class Executeur:
    def __init__(self, client: ClientModele, config: Optional[ConfigExecution] = None):
        self.client = client
        self.cfg = config or ConfigExecution()
        self.alea = random.Random(self.cfg.graine)
        self.systeme_commun = charger_consigne("system_common")

    # -------------------------------------------------------------------------------------------
    def _demander(self, ctx: ContexteAppel, tache: TacheModele, id_unite: str, consigne: str, no_passe: int,
             palier: Optional[str] = None) -> tuple[Optional[dict], list[str]]:
        systeme = self.systeme_commun + "\n\n" + charger_consigne(tache.regles)
        try:
            rep = self.client.demander(tache.id, id_unite, palier or tache.palier, systeme, consigne, no_passe)
        except Exception as e:  # noqa: BLE001 - every failure is audited, never silent
            ctx.audit.append({"task": tache.id, "unit": id_unite, "pass": no_passe, "error": repr(e)})
            return None, ["model_error"]
        errs = _verifier(tache, rep, ctx, id_unite)
        if errs:  # C3 rule 7: replay once with the error message
            reessayer = consigne + "\n\nYOUR PREVIOUS ANSWER WAS REJECTED BY THE CODE: " + ", ".join(errs) + \
                "\nCopy every quote character for character from the cited turn, spoken by the expected role."
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
        if self.cfg.passes_paralleles and n > 1:  # the passes stay independent: none sees another's answer
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
        consigne_arb = (consigne + "\n\nTHREE INDEPENDENT READINGS OF THIS UNIT (do not vote between them; "
                      "walk the rules in their fixed order and decide):\n" +
                      json.dumps([r["answer"] for r in lectures_], ensure_ascii=False, indent=1) +
                      "\n\nAnswer with the same JSON schema, plus \"justification\" (one sentence) and "
                      "\"case_label\" (application_error | rule_ambiguity | uncovered_case | undecidable).")
        rep, errs = self._demander(ctx, tache, id_unite, consigne_arb, 0, palier="arbiter")
        if rep is None or rep.get("case_label") == "undecidable":
            return Resolu(None, "to_review", conc, lectures_)
        return Resolu(rep, "arbitrated", conc, lectures_, rep.get("justification"), rep.get("case_label"))


def _verifier(tache: TacheModele, rep: Any, ctx: ContexteAppel, id_unite: str) -> list[str]:
    """C3 rule 7: an answer of an unexpected shape (a list where an object is expected...) is an invalid answer, replayed
    once then to_review for that unit only; it never crashes the competence (Sara Salem, 2026-10-28: KeyError(0))."""
    if rep is None:
        return ["empty"]
    if not isinstance(rep, dict):
        return ["not_an_object"]
    try:
        return tache.valider(rep, ctx, id_unite)
    except Exception as e:  # noqa: BLE001 - a validator that cannot read the answer rejects it
        return [f"invalid_shape:{type(e).__name__}"]


def _cle(tache: TacheModele, rep: dict) -> Optional[str]:
    try:
        return json.dumps(tache.cle(rep), sort_keys=True, default=str)
    except Exception:  # noqa: BLE001 - an unreadable reading counts as no valid reading
        return None


def forcer_arbitrage(executeur: "Executeur", ctx: ContexteAppel, tache: TacheModele, id_unite: str, unite: Any,
                      resolu: "Resolu") -> "Resolu":
    """Send a unit to the arbiter even when the passes agree (e.g. a P outside the nine categories, Pitch §2.1)."""
    consigne = tache.construire(ctx, unite)
    return executeur._arbitrer(ctx, tache, id_unite, unite, consigne, resolu.lectures_, resolu.concordance)
