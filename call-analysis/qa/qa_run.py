"""Measure the analysis on the reference set (call-analysis/qa/README.md).

    python3 call-analysis/qa/qa_run.py --cases DIR --refs DIR [--mode replay|live] [--repeat N] [--split tuning|control|all]
                                    [--out report.json]

A case file (one per call, `<slug>.json`): {"call": {"call_id", "transcript_raw", "speaker_map", "scheduled_start",
"sales_round"}, "prior": [earlier analysed calls of the cycle, as crm_ca_claim gives them], "config": {"tiers": {...}},
"audit": [{"entry": {"task", "answer"}}, ...]}; the reference file has the same slug.
- replay: the model answers kept with the analysis (crm_ca_audit) are played again, no model call. A step the stored
  analysis did not have (the voice check before 2026-11-19) gets an empty answer.
- live: the lite engine asks the model through the gateway ($SUPABASE_URL/functions/v1/callqa-llm,
  $SUPABASE_SERVICE_ROLE_KEY), tiers from the case's config; --repeat N analyses each call N times (C4 reproducibility).

What is printed holds numbers only (it may end up in a log); the errors with their quotes go to --out only.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import callqa_qa  # noqa: E402,F401  (paths of the engine, the lite engine and the worker)
from callqa_qa.reference import load, validate  # noqa: E402
from callqa_qa.score import measure, reproducibility, share, total  # noqa: E402


def claim_of(case: dict) -> dict:
    c = case["call"]
    return {"call": {"call_id": c["call_id"], "sales_id": c.get("sales_id") or "qa", "sales_round": c.get("sales_round"),
                     "start_utc": c.get("scheduled_start") or "", "timezone": "Europe/Paris"},
            "transcript": c["transcript_raw"], "speaker_map": c["speaker_map"], "offer_reference": case.get("offer") or {},
            "case_library": case.get("cases") or [], "prior": case.get("prior") or [], "config": case.get("config") or {}}


def stored_answers(case: dict) -> dict:
    answers: dict = {}
    for a in case.get("audit") or []:
        e = a.get("entry", a)
        if e.get("task") and isinstance(e.get("answer"), dict):
            answers.setdefault(e["task"], []).append(e["answer"])
    return answers


def live_tiers(url: str, key: str) -> dict:
    """The model ids per tier the worker uses (crm_ca_config.tiers): the measure runs what production runs."""
    import urllib.request
    req = urllib.request.Request(url.rstrip("/") + "/rest/v1/crm_ca_config?select=tiers&limit=1",
                                 headers={"apikey": key, "authorization": "Bearer " + key})
    with urllib.request.urlopen(req, timeout=60) as r:
        rows = json.loads(r.read() or b"[]")
    return (rows[0] if rows else {}).get("tiers") or {}


def analyse(case: dict, mode: str, effort: str) -> dict:
    from callqa_lite.engine import analyse as lite
    from callqa_lite.steps import MockLiteClient
    from callqa_worker.job import build_context
    claim = claim_of(case)
    if mode == "replay":
        client = MockLiteClient(stored_answers(case))
    else:
        from callqa_worker.gateway import GatewayClient
        url, key = os.environ.get("SUPABASE_URL", ""), os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
        if not url or not key:
            raise SystemExit("live mode: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are needed")
        tiers = (case.get("config") or {}).get("tiers") or live_tiers(url, key)
        client = GatewayClient(url.rstrip("/") + "/functions/v1/callqa-llm", key, tiers, effort=effort, passes=1)
    rec = lite(build_context(claim), client, {"effort": effort})
    rec["qa_usage"] = getattr(client, "usage", {})
    return rec


def safe_analyse(case: dict, mode: str, effort: str) -> dict:
    """One analysis; a failure (model error, cut answer) is a result of the measure, not the end of it: the record
    only carries the kind of error (no message: it may quote the call)."""
    try:
        return analyse(case, mode, effort)
    except Exception as e:  # noqa: BLE001
        return {"qa_failed": type(e).__name__}


def line(m: dict) -> str:
    def s(a, b):
        v = share((m.get(a) or {}).get(b))
        return "  -  " if v is None else f"{v:5.0%}"
    return (f"{m['slug']:<12} {m['split']:<8} questions {s('spin', 'questions_found')} letters {s('spin', 'letters')} "
            f"registers {s('spin', 'registers')} effects {s('spin', 'atoms_found')} gap {s('gap', 'components')} "
            f"objections {s('objections', 'found')} gestures {s('objections', 'gestures')} scores {s('status', 'score')} "
            f"errors {m['n_errors']}")


def repro_line(slug: str, r: dict) -> str:
    """A call with nothing to compare (excluded, e.g. a cut recording) has no share: printed as "-"."""
    def pct(v):
        return "-" if v is None else f"{v:.0%}"
    return (f"{slug:<12} same letter {pct(r.get('same_letter_share'))}, same register "
            f"{pct(r.get('same_register_share'))} over {r.get('runs')} runs (C4 target 95 %)")


def main(argv=None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--cases", required=True)
    ap.add_argument("--refs", required=True)
    ap.add_argument("--mode", choices=["replay", "live"], default="replay")
    ap.add_argument("--repeat", type=int, default=1)
    ap.add_argument("--split", choices=["tuning", "control", "all"], default="all")
    ap.add_argument("--effort", default="low")
    ap.add_argument("--workers", type=int, default=1, help="analyses run at the same time (live mode)")
    ap.add_argument("--out")
    a = ap.parse_args(argv)
    measures, repro, problems, failed = [], {}, {}, []
    for rp in sorted(Path(a.refs).glob("*.json")):
        ref = load(rp)
        if a.split != "all" and ref.get("split") != a.split:
            continue
        cp = Path(a.cases) / rp.name
        if not cp.exists():
            print(f"{ref.get('slug')}: no case file", flush=True)
            continue
        case = load(cp)
        errs = validate(ref, case["call"]["transcript_raw"])
        if errs:
            problems[ref.get("slug")] = errs
            print(f"{ref.get('slug')}: reference file invalid ({len(errs)} errors), not measured", flush=True)
            continue
        n = max(1, a.repeat if a.mode == "live" else 1)
        if a.workers > 1 and n > 1:
            from concurrent.futures import ThreadPoolExecutor
            with ThreadPoolExecutor(max_workers=min(a.workers, n)) as pool:
                runs = list(pool.map(lambda _: safe_analyse(case, a.mode, a.effort), range(n)))
        else:
            runs = [safe_analyse(case, a.mode, a.effort) for _ in range(n)]
        recs = [r for r in runs if "qa_failed" not in r]
        for r in runs:
            if "qa_failed" in r:
                failed.append({"slug": ref.get("slug"), "error": r["qa_failed"]})
                print(f"{ref.get('slug'):<12} analysis failed: {r['qa_failed']}", flush=True)
        ms = [measure(ref, r) for r in recs]
        for m in ms:
            print(line(m), flush=True)
        measures += ms
        if len(recs) > 1:
            repro[ref.get("slug")] = reproducibility(ref, recs)
            print(repro_line(ref.get("slug"), repro[ref.get("slug")]), flush=True)
    tot = total(measures)
    print("TOTAL " + " · ".join(f"{k} {v['share']:.0%} ({v['right']}/{v['out_of']})" for k, v in tot.items()
                                if isinstance(v, dict) and v["out_of"]) + f" · errors {tot['errors']} · failed analyses {len(failed)}", flush=True)
    if a.out:
        Path(a.out).write_text(json.dumps({"mode": a.mode, "repeat": a.repeat, "split": a.split, "total": tot,
                                           "calls": measures, "reproducibility": repro, "failed": failed, "invalid_references": problems},
                                          ensure_ascii=False, indent=1, default=str), encoding="utf-8")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
