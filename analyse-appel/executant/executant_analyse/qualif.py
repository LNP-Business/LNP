"""La qualification du lead d'un R1, dans son analyse d'appel (Romain, 2026-11-05 : « chaque appel R1 doit aboutir à définir
l'état de la qualification ; cela fait partie de l'analyse d'appel »).

analyse-appel/qualification : le modèle extrait les faits de l'appel en deux lectures (consignes/extraction.md), le code
vérifie chaque citation dans la transcription et qualification_lnp.py (règles version 2.2) décide : SQL GAGNÉ, SQL OUVERT,
SQL PERDU, NON SQL, MQL EN ATTENTE ou À REVOIR. La transcription est celle que lit l'analyse (les mêmes tours, les mêmes
locuteurs : SALES, le commercial, et PROSPECT), donc l'analyse et la qualification ne lisent jamais deux appels différents.

qualifier_(prise, client, db) ne tourne que pour un R1 (sales_round 1) ; elle renvoie la qualification à garder avec le
travail d'analyse (crm_qualif_store, 046), ou None. Un échec n'arrête jamais l'analyse : il est renvoyé sous la forme
{"error": ...} et écrit dans le journal sans aucune citation.
"""
from __future__ import annotations

import sys
from pathlib import Path
from typing import Any, Callable, Optional

DOSSIER_QUAL = Path(__file__).resolve().parents[2] / "qualification"


def _agent():
    if str(DOSSIER_QUAL) not in sys.path:
        sys.path.insert(0, str(DOSSIER_QUAL))
    import agent  # analyse-appel/qualification/agent.py
    return agent


def est_r1(prise: dict) -> bool:
    try:
        return int((prise.get("call") or {}).get("sales_round") or 0) == 1
    except (TypeError, ValueError):
        return False


def texte_transcription(prise: dict) -> str:
    """Les tours de l'analyse, un par ligne : "[mm:ss] SALES: texte" / "[mm:ss] PROSPECT: texte" (les autres locuteurs sont
    laissés de côté)."""
    from lnp_analyse.noyau.fondation import lire_transcription
    tours = lire_transcription(prise.get("transcript") or "", prise.get("speaker_map") or {})
    return "\n".join(f"[{t.ts}] {t.role}: {t.texte}" for t in tours if t.role in ("SALES", "PROSPECT") and t.texte)


def _conso_depuis(client: Any, avant: dict) -> dict:
    maintenant = getattr(client, "conso", {}) or {}
    return {t: {k: v - (avant.get(t) or {}).get(k, 0) for k, v in u.items()} for t, u in maintenant.items()}


def qualifier_(prise: dict, client: Any, db: Any = None, journal: Optional[Callable[[str], None]] = None) -> Optional[dict]:
    """None pour un appel qui n'est pas un R1 ; sinon {status, result, verification, readings, prompt_version, rules_version,
    usage} ou {error, ...}."""
    if not est_r1(prise):
        return None
    dire = journal or (lambda m: None)
    appel_ = prise.get("call") or {}
    try:
        agent = _agent()
        ctx = (db.rpc("crm_qualif_context", {"p_call": appel_.get("call_id")}) if db is not None else None) or {}
        texte = texte_transcription(prise)
        avant = {t: dict(u) for t, u in (getattr(client, "conso", {}) or {}).items()}
        sortie = agent.qualifier_appel({"call_id": appel_.get("call_id"),
                                  "date_appel": ctx.get("date_appel") or str(appel_.get("start_utc") or "")[:10] or None,
                                  "transcript": texte or None, "recorded_by": ctx.get("recorded_by"),
                                  "saisie": ctx.get("saisie") or {}}, client)
        sortie["usage"] = _conso_depuis(client, avant)
        dire(f"qualification {sortie['status']} ({len(sortie.get('readings') or [])} lecture(s), {len(sortie.get('verification') or [])} remarque(s))")
        return sortie
    except Exception as e:  # noqa: BLE001 - le type et le message seulement, jamais une citation
        dire(f"qualification en échec ({type(e).__name__}: {str(e)[:200]})")
        return {"error": f"{type(e).__name__}: {str(e)[:300]}"}


def stocker(db: Any, prise: dict, travail: Any, q: Optional[dict]) -> None:
    """Garde une qualification avec son travail d'analyse (crm_qualif_store, 046) ; une erreur n'est pas enregistrée."""
    if not q or q.get("error") or not q.get("status"):
        return
    db.rpc("crm_qualif_store", {"p_call": (prise.get("call") or {}).get("call_id"), "p_status": q["status"],
                                "p_result": q.get("result") or {}, "p_readings": q.get("readings") or [],
                                "p_verification": q.get("verification") or [], "p_usage": q.get("usage") or {},
                                "p_prompt_version": q.get("prompt_version"), "p_rules_version": q.get("rules_version"),
                                "p_job": travail})
