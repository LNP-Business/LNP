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
from typing import Optional

sys.path.insert(0, str(Path(__file__).resolve().parent))
import callqa_qa  # noqa: E402,F401  (paths of the engine, the lite engine and the worker)
from callqa_qa.reference import load, validate  # noqa: E402
from callqa_qa.score import costs, measure, reproducibility, share, total  # noqa: E402
from callqa_lite.cost import estimate  # noqa: E402


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


def stored_units(case: dict) -> tuple[dict, set]:
    """The stored answers by (task, unit), and the units whose answer was cut by max_tokens: a chunk cut in production was
    asked again as two halves, so answers replayed in order would go to the wrong chunk (2026-11-23)."""
    units: dict = {}
    cut: set = set()
    for a in case.get("audit") or []:
        e = a.get("entry", a)
        if not e.get("task") or e.get("unit") is None:
            continue
        key = (e["task"], e["unit"])
        if isinstance(e.get("answer"), dict):
            units.setdefault(key, []).append(e["answer"])
        elif e.get("stop_reason") == "max_tokens":
            cut.add(key)
    return units, cut - set(units)


class ReplayClient:
    """Replay: the stored answers, played again in order; the stored S1 readings (lite.s1_discovery) are given to each
    chunk by turn, since the chunks of today's code are not those of the stored analysis (a reading given to the wrong
    chunk would not reach its turn's item, SEG-1)."""

    def __init__(self, answers: dict, units: Optional[tuple] = None):
        from callqa_lite.steps import MockLiteClient
        self.units, self.cut = units or ({}, set())
        answers = dict(answers)
        s1 = answers.pop("lite.s1_discovery", None)
        self.mock = MockLiteClient(answers)
        self.calls, self.usage = self.mock.calls, self.mock.usage
        self.s1 = [q for a in (s1 or []) for q in (a.get("questions") or []) if isinstance(q, dict)]

    def complete(self, task_id, unit_id, tier, system, prefix, prompt, max_tokens=16000, effort="low"):
        import re
        if task_id != "lite.s1_discovery":
            key = (task_id, unit_id)
            if key in self.units or key in self.cut:              # the answer this unit got, or the same cut
                self.calls.append({"task": task_id, "unit": unit_id, "tier": tier, "prompt": prompt, "prefix": prefix,
                                   "max_tokens": max_tokens, "effort": effort})
                if key in self.cut:
                    return {"text": "", "stop_reason": "max_tokens"}
                got = self.units[key]
                ans = got.pop(0) if len(got) > 1 else got[0]
                return {"text": json.dumps(ans, ensure_ascii=False), "stop_reason": "end_turn"}
            return self.mock.complete(task_id, unit_id, tier, system, prefix, prompt, max_tokens, effort)
        self.calls.append({"task": task_id, "unit": unit_id, "tier": tier, "prompt": prompt, "prefix": prefix,
                           "max_tokens": max_tokens, "effort": effort})
        m = re.match(r"T(\d+)-T(\d+)$", unit_id or "")
        num = lambda t: int(t[1:]) if re.match(r"T\d+$", str(t or "")) else -1
        # answers by ids (2026-11-23): a listed reading carries its id only (Q057 is the question of turn T057)
        where = lambda q: num(q.get("turn") or ("T" + str(q.get("id"))[1:] if q.get("id") else None))
        qs = [q for q in self.s1 if m and int(m.group(1)) <= where(q) <= int(m.group(2))]
        return {"text": json.dumps({"questions": qs}, ensure_ascii=False), "stop_reason": "end_turn"}


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
    from callqa_worker.job import build_context
    claim = claim_of(case)
    if mode == "replay":
        client = ReplayClient(stored_answers(case), stored_units(case))
    else:
        from callqa_worker.gateway import GatewayClient
        url, key = os.environ.get("SUPABASE_URL", ""), os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
        if not url or not key:
            raise SystemExit("live mode: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are needed")
        tiers = (case.get("config") or {}).get("tiers") or live_tiers(url, key)
        client = GatewayClient(url.rstrip("/") + "/functions/v1/callqa-llm", key, tiers, effort=effort, passes=1)
    rec = lite(build_context(claim), client, {"effort": effort})
    rec["qa_usage"] = getattr(client, "usage", {})
    rec["qa_usd"] = estimate(rec["qa_usage"], tiers) if mode == "live" else None     # replay: no model call, no cost
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
            f"registers {s('spin', 'registers')} effects {s('spin', 'atoms_found')} gap {s('gap', 'components')} blocage {s('gap', 'blocker_state')} "
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
    ap.add_argument("--max-cost", type=float, default=0.08,
                    help="USD: the measure fails when the average cost of an analysis is above it (live mode)")
    ap.add_argument("--out")
    ap.add_argument("--keep", help="live mode: write each case with the new analysis' answers as its audit, to replay "
                                   "them later (a private directory: the case holds the transcript; never in git)")
    a = ap.parse_args(argv)
    measures, repro, problems, failed = [], {}, {}, []
    todo = []
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
        todo.append((ref, case))
    n = max(1, a.repeat if a.mode == "live" else 1)
    jobs = [(i, k) for i in range(len(todo)) for k in range(n)]
    if a.workers > 1 and len(jobs) > 1:                         # every analysis of every call, a.workers at a time
        from concurrent.futures import ThreadPoolExecutor
        with ThreadPoolExecutor(max_workers=a.workers) as pool:
            done = list(pool.map(lambda j: safe_analyse(todo[j[0]][1], a.mode, a.effort), jobs))
    else:
        done = [safe_analyse(todo[i][1], a.mode, a.effort) for i, _ in jobs]
    for i, (ref, case) in enumerate(todo):
        runs = [r for (j, _), r in zip(jobs, done) if j == i]
        if a.keep and a.mode == "live" and runs and "qa_failed" not in runs[0]:
            Path(a.keep).mkdir(parents=True, exist_ok=True)
            kept = dict(case, audit=[e for e in runs[0].get("audit") or [] if isinstance(e, dict)],
                        qa_usage=runs[0].get("qa_usage"), qa_usd=runs[0].get("qa_usd"))
            (Path(a.keep) / f"{ref.get('slug')}.json").write_text(json.dumps(kept, ensure_ascii=False, default=str),
                                                                  encoding="utf-8")
        recs = [r for r in runs if "qa_failed" not in r]
        for r in runs:
            if "qa_failed" in r:
                failed.append({"slug": ref.get("slug"), "error": r["qa_failed"]})
                print(f"{ref.get('slug'):<12} analysis failed: {r['qa_failed']}", flush=True)
        ms = [dict(measure(ref, r), usd=r.get("qa_usd")) for r in recs]
        for m in ms:
            print(line(m), flush=True)
        measures += ms
        if len(recs) > 1:
            repro[ref.get("slug")] = reproducibility(ref, recs)
            print(repro_line(ref.get("slug"), repro[ref.get("slug")]), flush=True)
    tot = total(measures)
    print("TOTAL " + " · ".join(f"{k} {v['share']:.0%} ({v['right']}/{v['out_of']})" for k, v in tot.items()
                                if isinstance(v, dict) and v["out_of"]) + f" · errors {tot['errors']} · failed analyses {len(failed)}", flush=True)
    cost = costs(measures, a.max_cost)
    if cost["analyses"]:
        print(f"COST {cost['analyses']} analyses · average {cost['avg_usd']:.4f} USD · max {cost['max_usd']:.4f} USD "
              f"(limit {a.max_cost:.2f} USD on the average: {'EXCEEDED' if cost['exceeded'] else 'ok'})", flush=True)
    if a.out:
        Path(a.out).write_text(json.dumps({"mode": a.mode, "repeat": a.repeat, "split": a.split, "total": tot, "cost": cost,
                                           "calls": measures, "reproducibility": repro, "failed": failed, "invalid_references": problems},
                                          ensure_ascii=False, indent=1, default=str), encoding="utf-8")
    return 1 if problems or cost["exceeded"] else 0


if __name__ == "__main__":
    sys.exit(main())
