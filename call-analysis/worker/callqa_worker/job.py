"""One job: the claim returned by crm_ca_claim → CallContext → engine pipeline → call record (OUTPUT_CONTRACT.md).

crm_ca_config.engine (035, 2026-11-03) picks the engine per job: 'full' (lnp_callqa, unchanged) or 'lite'
(call-analysis/lite: five whole-transcript steps on the fast tier, the code still decides).
"""
from __future__ import annotations

import os
import sys
from pathlib import Path
from typing import Any, Optional

from lnp_callqa.core.foundation import parse_transcript
from lnp_callqa.core.models import CallContext
from lnp_callqa.core.runner import RunConfig, Runner
from lnp_callqa.pipeline import analyse_call, result_record

from .prefetch import PrefetchClient, analyse_in_rounds

ENGINE_VERSION = "lnp_callqa-1.0"
LITE_DIR = Path(__file__).resolve().parents[2] / "lite"


def engine_of(claim: dict) -> str:
    return "lite" if (claim.get("config") or {}).get("engine") == "lite" else "full"


def engine_version(claim: dict) -> str:
    if engine_of(claim) == "lite":
        return _lite().LITE_VERSION
    return ENGINE_VERSION


def _lite():
    if str(LITE_DIR) not in sys.path:
        sys.path.insert(0, str(LITE_DIR))
    import callqa_lite
    return callqa_lite


def run_lite(claim: dict, client: Any, effort: Optional[str] = None) -> dict:
    """The lite engine: one model call per step through client.complete (GatewayClient), tier fast, effort low unless
    CALLQA_LITE_EFFORT says otherwise. A failure of the model steps raises ModelErrors (never retried as is)."""
    _lite()
    from callqa_lite.engine import LiteModelError, analyse
    try:
        return analyse(build_context(claim), client,
                       {"effort": effort or os.environ.get("CALLQA_LITE_EFFORT") or "low"})
    except LiteModelError as e:
        raise ModelErrors(str(e)) from None


def case_library(rows: list[dict]) -> list[dict]:
    """crm_ca_cases rows → the engine's case format (Pitch: id, consent, start {value, unit, profile}, figures)."""
    return [{"id": str(c.get("id")), "title": c.get("title"), "consent": bool(c.get("consent")),
             "start": {"value": c.get("start_value"), "unit": c.get("start_unit"), "profile": c.get("start_profile")},
             "figures": c.get("figures") or {}} for c in rows or []]


def prior_inputs(prior: list[dict]) -> list[dict]:
    """Earlier analysed calls of the cycle → Objections H5 (episodes of earlier calls)."""
    out = []
    for p in prior or []:
        eps = ((p.get("results") or {}).get("OBJECTIONS") or {}).get("episodes") or []
        if eps:
            out.append({"kind": "objections_episodes", "call_id": p.get("call_id"), "episodes": eps})
    return out


def build_context(claim: dict) -> CallContext:
    call = claim.get("call") or {}
    turns = parse_transcript(claim.get("transcript") or "", claim.get("speaker_map") or {})
    return CallContext(str(call.get("call_id")), str(call.get("sales_id") or "none"), str(call.get("start_utc") or ""),
                       str(call.get("timezone") or "UTC"), turns, claim.get("offer_reference") or {},
                       case_library(claim.get("case_library")), prior_inputs(claim.get("prior")))


def run_job(claim: dict, client: Any, config: Optional[RunConfig] = None, rounds: bool = False, workers: int = 16,
            log=None, budget_s: Optional[float] = None) -> dict:
    """rounds=True: the questions go to the model in parallel batches (prefetch.py), same result as a sequential run.
    config.engine = 'lite': the lite engine instead (the other arguments do not apply)."""
    if engine_of(claim) == "lite":
        return run_lite(claim, client)
    passes = int((claim.get("config") or {}).get("passes") or 3)
    # crm_ca_config.passes = 1 turns on the cost option of Part C, C4 (one pass, 10 % of the units still run with three):
    # allowed only once the C7 protocol shows at least 95 % item-level concordance on the current rules version
    single = passes == 1
    if not rounds:
        cfg = config or RunConfig(passes=passes, single_pass_allowed=single, parallel_passes=True)
        ctx = build_context(claim)
        analyse_call(ctx, Runner(client, cfg))
        return result_record(ctx)
    pre = PrefetchClient(client)
    cfg = config or RunConfig(passes=passes, single_pass_allowed=single)
    ctx = analyse_in_rounds(lambda: build_context(claim), lambda c, cl: analyse_call(c, Runner(cl, cfg)), pre, workers, log=log, budget_s=budget_s)
    check_model_errors(ctx.audit)
    return result_record(ctx)


class ModelErrors(RuntimeError):
    """Most model questions failed: the record would only say "not applicable" everywhere, so it is not stored."""
    final = True


def check_model_errors(audit: list, max_share: float = 0.5) -> None:
    passes = [e for e in audit if "task" in e and ("answer" in e or "error" in e)]
    errors = [e for e in passes if "error" in e]
    if passes and len(errors) / len(passes) > max_share:
        kinds = sorted({str(e["error"])[:160] for e in errors})[:3]
        raise ModelErrors(f"{len(errors)} of {len(passes)} model questions failed: " + " | ".join(kinds))


def summary(record: dict) -> str:
    """One log line: status and scores only (never a quote)."""
    res = record.get("results") or {}
    parts = [f"{k}={v.get('score') if v.get('score') is not None else v.get('status')}" for k, v in res.items()]
    lite = "engine=lite " if (record.get("meta") or {}).get("engine") == "lite" else ""
    return f"{lite}status={record.get('status')} turns={len(record.get('turns') or [])} " + " ".join(parts)
