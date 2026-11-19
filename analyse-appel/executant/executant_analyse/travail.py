"""One job: the claim returned by crm_ca_claim → CallContext → engine pipeline → call record (OUTPUT_CONTRACT.md).

crm_ca_config.engine (035, 2026-11-03) picks the engine per job: 'full' (lnp_callqa, unchanged) or 'lite'
(call-analysis/lite: five whole-transcript steps on the fast tier, the code still decides).
"""
from __future__ import annotations

import os
import sys
from pathlib import Path
from typing import Any, Optional

from lnp_analyse.noyau.fondation import lire_transcription
from lnp_analyse.noyau.modeles import ContexteAppel
from lnp_analyse.noyau.executeur import ConfigExecution, Executeur
from lnp_analyse.chaine_analyse import analyser_appel, enregistrement_resultat

from .anticipation import ClientAnticipe, analyser_par_tours

VERSION_MOTEUR = "lnp_callqa-1.0"
DOSSIER_ALLEGE = Path(__file__).resolve().parents[2] / "allege"


def moteur_de(prise: dict) -> str:
    return "lite" if (prise.get("config") or {}).get("engine") == "lite" else "full"


def version_moteur(prise: dict) -> str:
    if moteur_de(prise) == "lite":
        return _allege().VERSION_ALLEGEE
    return VERSION_MOTEUR


def _allege():
    if str(DOSSIER_ALLEGE) not in sys.path:
        sys.path.insert(0, str(DOSSIER_ALLEGE))
    import analyse_allegee
    return analyse_allegee


def executer_allege(prise: dict, client: Any, effort: Optional[str] = None) -> dict:
    """The lite engine: one model call per step through client.complete (GatewayClient), tier fast, effort low unless
    CALLQA_LITE_EFFORT says otherwise. A failure of the model steps raises ModelErrors (never retried as is)."""
    _allege()
    from analyse_allegee.moteur import ErreurModeleAllege, analyse
    try:
        return analyse(construire_contexte(prise), client,
                       {"effort": effort or os.environ.get("CALLQA_LITE_EFFORT") or "low"})
    except ErreurModeleAllege as e:
        raise ErreursModele(str(e)) from None


def bibliotheque_cas(lignes_: list[dict]) -> list[dict]:
    """crm_ca_cases rows → the engine's case format (Pitch: id, consent, start {value, unit, profile}, figures)."""
    return [{"id": str(c.get("id")), "title": c.get("title"), "consent": bool(c.get("consent")),
             "start": {"value": c.get("start_value"), "unit": c.get("start_unit"), "profile": c.get("start_profile")},
             "figures": c.get("figures") or {}} for c in lignes_ or []]


def entrees_anterieures(anterieur: list[dict]) -> list[dict]:
    """Earlier analysed calls of the cycle → Objections H5 (episodes of earlier calls)."""
    sortie = []
    for p in anterieur or []:
        eps = ((p.get("results") or {}).get("OBJECTIONS") or {}).get("episodes") or []
        if eps:
            sortie.append({"kind": "objections_episodes", "call_id": p.get("call_id"), "episodes": eps})
    return sortie


def construire_contexte(prise: dict) -> ContexteAppel:
    appel_ = prise.get("call") or {}
    tours = lire_transcription(prise.get("transcript") or "", prise.get("speaker_map") or {})
    return ContexteAppel(str(appel_.get("call_id")), str(appel_.get("sales_id") or "none"), str(appel_.get("start_utc") or ""),
                       str(appel_.get("timezone") or "UTC"), tours, prise.get("offer_reference") or {},
                       bibliotheque_cas(prise.get("case_library")), entrees_anterieures(prise.get("prior")))


def executer_travail(prise: dict, client: Any, config: Optional[ConfigExecution] = None, tours_lot: bool = False, executants: int = 16,
            journal=None, budget_s: Optional[float] = None) -> dict:
    """rounds=True: the questions go to the model in parallel batches (prefetch.py), same result as a sequential run.
    config.engine = 'lite': the lite engine instead (the other arguments do not apply)."""
    if moteur_de(prise) == "lite":
        return executer_allege(prise, client)
    passes = int((prise.get("config") or {}).get("passes") or 3)
    # crm_ca_config.passes = 1 turns on the cost option of Part C, C4 (one pass, 10 % of the units still run with three):
    # allowed only once the C7 protocol shows at least 95 % item-level concordance on the current rules version
    unique = passes == 1
    if not tours_lot:
        cfg = config or ConfigExecution(passes=passes, passe_unique_permise=unique, passes_paralleles=True)
        ctx = construire_contexte(prise)
        analyser_appel(ctx, Executeur(client, cfg))
        return enregistrement_resultat(ctx)
    pre = ClientAnticipe(client)
    cfg = config or ConfigExecution(passes=passes, passe_unique_permise=unique)
    ctx = analyser_par_tours(lambda: construire_contexte(prise), lambda c, cl: analyser_appel(c, Executeur(cl, cfg)), pre, executants, journal=journal, budget_s=budget_s)
    verifier_erreurs_modele(ctx.audit)
    return enregistrement_resultat(ctx)


class ErreursModele(RuntimeError):
    """Most model questions failed: the record would only say "not applicable" everywhere, so it is not stored."""
    final = True


def verifier_erreurs_modele(audit: list, part_max: float = 0.5) -> None:
    passes = [e for e in audit if "task" in e and ("answer" in e or "error" in e)]
    erreurs = [e for e in passes if "error" in e]
    if passes and len(erreurs) / len(passes) > part_max:
        genres = sorted({str(e["error"])[:160] for e in erreurs})[:3]
        raise ErreursModele(f"{len(erreurs)} of {len(passes)} model questions failed: " + " | ".join(genres))


def resume(enregistrement: dict) -> str:
    """One log line: status and scores only (never a quote)."""
    res = enregistrement.get("results") or {}
    parties = [f"{k}={v.get('score') if v.get('score') is not None else v.get('status')}" for k, v in res.items()]
    allege = "engine=lite " if (enregistrement.get("meta") or {}).get("engine") == "lite" else ""
    return f"{allege}status={enregistrement.get('status')} turns={len(enregistrement.get('turns') or [])} " + " ".join(parties)
