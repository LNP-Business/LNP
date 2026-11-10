"""The lead qualification of an R1, as part of its call analysis (Romain, 2026-11-05: « chaque appel R1 doit aboutir à définir
l'état de la qualification ; cela fait partie de l'analyse d'appel »).

call-analysis/qualification: the model extracts the facts of the call in two readings (prompts/extraction.md), the code
checks every quote against the transcript and qualification_lnp.py (rules version 2.1) decides: SQL GAGNÉ, SQL OUVERT,
SQL PERDU, NON SQL, MQL EN ATTENTE or À REVOIR. The transcript is the one the analysis reads (the same turns, the same
speakers: SALES / PROSPECT), so the analysis and the qualification never read two different calls.

qualify(claim, client, db) runs only for an R1 (sales_round 1); it returns the qualification to keep with the analysis job
(crm_qualif_store, 046) or None. A failure never stops the analysis: it is returned as {"error": ...} and logged without
any quote.
"""
from __future__ import annotations

import sys
from pathlib import Path
from typing import Any, Callable, Optional

QUAL_DIR = Path(__file__).resolve().parents[2] / "qualification"


def _agent():
    if str(QUAL_DIR) not in sys.path:
        sys.path.insert(0, str(QUAL_DIR))
    import agent  # call-analysis/qualification/agent.py
    return agent


def is_r1(claim: dict) -> bool:
    try:
        return int((claim.get("call") or {}).get("sales_round") or 0) == 1
    except (TypeError, ValueError):
        return False


def transcript_text(claim: dict) -> str:
    """The analysis' turns, one line each: "[mm:ss] SALES: text" / "[mm:ss] PROSPECT: text" (other speakers left out)."""
    from lnp_callqa.core.foundation import parse_transcript
    turns = parse_transcript(claim.get("transcript") or "", claim.get("speaker_map") or {})
    return "\n".join(f"[{t.ts}] {t.role}: {t.text}" for t in turns if t.role in ("SALES", "PROSPECT") and t.text)


def _usage_since(client: Any, before: dict) -> dict:
    now = getattr(client, "usage", {}) or {}
    return {t: {k: v - (before.get(t) or {}).get(k, 0) for k, v in u.items()} for t, u in now.items()}


def qualify(claim: dict, client: Any, db: Any = None, log: Optional[Callable[[str], None]] = None) -> Optional[dict]:
    """None for a call that is not an R1; else {status, result, verification, readings, prompt_version, rules_version,
    usage} or {error, ...}."""
    if not is_r1(claim):
        return None
    say = log or (lambda m: None)
    call = claim.get("call") or {}
    try:
        agent = _agent()
        ctx = (db.rpc("crm_qualif_context", {"p_call": call.get("call_id")}) if db is not None else None) or {}
        text = transcript_text(claim)
        before = {t: dict(u) for t, u in (getattr(client, "usage", {}) or {}).items()}
        out = agent.qualify_call({"call_id": call.get("call_id"),
                                  "date_appel": ctx.get("date_appel") or str(call.get("start_utc") or "")[:10] or None,
                                  "transcript": text or None, "recorded_by": ctx.get("recorded_by"),
                                  "saisie": ctx.get("saisie") or {}}, client)
        out["usage"] = _usage_since(client, before)
        say(f"qualification {out['status']} ({len(out.get('readings') or [])} reading(s), {len(out.get('verification') or [])} note(s))")
        return out
    except Exception as e:  # noqa: BLE001 - the type and message only, never a quote
        say(f"qualification failed ({type(e).__name__}: {str(e)[:200]})")
        return {"error": f"{type(e).__name__}: {str(e)[:300]}"}


def store(db: Any, claim: dict, job: Any, q: Optional[dict]) -> None:
    """Keeps a qualification with its analysis job (crm_qualif_store, 046); an error is not stored."""
    if not q or q.get("error") or not q.get("status"):
        return
    db.rpc("crm_qualif_store", {"p_call": (claim.get("call") or {}).get("call_id"), "p_status": q["status"],
                                "p_result": q.get("result") or {}, "p_readings": q.get("readings") or [],
                                "p_verification": q.get("verification") or [], "p_usage": q.get("usage") or {},
                                "p_prompt_version": q.get("prompt_version"), "p_rules_version": q.get("rules_version"),
                                "p_job": job})
