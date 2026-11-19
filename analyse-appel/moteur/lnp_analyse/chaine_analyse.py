"""Orchestrator: the fixed dependency order of the engine.

foundation (S0, C1, S2) -> SPIN -> Gap -> Pitch -> Objections -> stored result.
Each competence reads the frozen outputs of the previous stages from the CallContext and writes its
CompetenceResult. No competence ever re-places a phase anchor of its own.
"""
from __future__ import annotations

import json
from typing import Optional, Protocol

from .noyau.fondation import lire_transcription, executer_fondation
from .noyau.modeles import ContexteAppel, ResultatCompetence, vers_dict
from .noyau.executeur import Executeur


class Competence(Protocol):
    nom_: str
    version_regles: str

    def executer(self, ctx: ContexteAppel, executeur: Executeur) -> ResultatCompetence: ...


def competences_defaut() -> list[Competence]:
    from .competences.spin import CompetenceSpin
    from .competences.ecart import CompetenceEcart
    from .competences.presentation import CompetencePresentation
    from .competences.objections import CompetenceObjections
    return [CompetenceSpin(), CompetenceEcart(), CompetencePresentation(), CompetenceObjections()]


def analyser_appel(ctx: ContexteAppel, executeur: Executeur, competences: Optional[list[Competence]] = None) -> ContexteAppel:
    executer_fondation(ctx, executeur)
    for comp in competences or competences_defaut():
        if ctx.statut != "ok":
            ctx.resultats[comp.nom_] = ResultatCompetence(comp.nom_, comp.version_regles, statut="excluded",
                                                      raisons=[ctx.statut])
            continue
        try:
            ctx.resultats[comp.nom_] = comp.executer(ctx, executeur)
        except Exception as e:  # noqa: BLE001 - a crash in one competence never blocks the others
            ctx.audit.append({"competence": comp.nom_, "error": repr(e)})
            ctx.resultats[comp.nom_] = ResultatCompetence(comp.nom_, comp.version_regles, statut="to_review",
                                                      raisons=["engine_error"])
    return ctx


def enregistrement_resultat(ctx: ContexteAppel) -> dict:
    """What is stored per call (Part C, C8): results + phase map + audit of every pass."""
    return {"call_id": ctx.id_appel, "sales_id": ctx.id_commercial, "start_utc": ctx.debut_utc, "timezone": ctx.fuseau,
            "status": ctx.statut, "flags": ctx.signaux,
            "turns": [{"id": t.id, "ts": t.ts, "role": t.role, "speaker": t.locuteur, "text": t.texte,
                       "repaired": t.repare, "attribution_doubtful": t.attribution_douteuse} for t in ctx.tours],
            "phases": {k: v for k, v in vers_dict(ctx.phases).items() if k != "evidence"},
            "results": {k: v.vers_dict() for k, v in ctx.resultats.items()},
            "audit": ctx.audit}


def charger_appel(chemin: str, carte_locuteurs: dict[str, str], id_appel: str, id_commercial: str, debut_utc: str,
              fuseau: str, reference_offre: Optional[dict] = None, bibliotheque_cas: Optional[list] = None) -> ContexteAppel:
    brut = open(chemin, encoding="utf-8").read()
    return ContexteAppel(id_appel, id_commercial, debut_utc, fuseau, lire_transcription(brut, carte_locuteurs),
                       reference_offre or {}, bibliotheque_cas or [])


if __name__ == "__main__":  # minimal CLI
    import argparse
    from .noyau.client_modele import ClientAnthropic
    p = argparse.ArgumentParser()
    p.add_argument("transcription"); p.add_argument("--config", required=True, help="JSON: speaker_map, call meta, tiers")
    a = p.parse_args()
    cfg = json.load(open(a.config))
    ctx = charger_appel(a.transcription, cfg["speaker_map"], cfg["call_id"], cfg["sales_id"], cfg["start_utc"],
                    cfg["timezone"], cfg.get("offer_reference"), cfg.get("case_library"))
    analyser_appel(ctx, Executeur(ClientAnthropic(cfg["tiers"])))
    print(json.dumps(enregistrement_resultat(ctx), ensure_ascii=False, indent=1, default=str))
