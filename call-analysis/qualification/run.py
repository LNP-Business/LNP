"""Lead qualification worker: python3 run.py --limit 30

Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (GitHub secret). Takes the latest R1 of the most recent leads
(crm_qualif_candidates, 042), qualifies each one (agent.qualify_call: two readings through the callqa-llm gateway, then the
four-gate rule) and stores the result (crm_qualif_store). The repository is public: the log shows call ids, statuses and
token counts only, never a name or a quote.
"""
from __future__ import annotations

import argparse
import os
import sys
import time
from collections import Counter
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(HERE.parent / "worker"))
sys.path.insert(0, str(HERE.parent / "engine"))     # the gateway client reads alkimiy_callqa.core.llm

from agent import PROMPT_VERSION, qualify_call  # noqa: E402
from callqa_worker.gateway import GatewayClient  # noqa: E402
from callqa_worker.supabase import Supabase  # noqa: E402


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=30)
    ap.add_argument("--again", action="store_true", help="also the calls already qualified with this prompt version")
    a = ap.parse_args()
    url, key = os.environ.get("SUPABASE_URL", ""), os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    if not url or not key:
        print("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are not set: nothing to do.")
        return 0
    db = Supabase(url, key, timeout=180)
    cfg = (db.rpc("crm_qualif_config", {}) or {})
    client = GatewayClient(url.rstrip("/") + "/functions/v1/callqa-llm", key, cfg.get("tiers") or {}, passes=1)
    calls = db.rpc("crm_qualif_candidates", {"p_limit": a.limit, "p_again": a.again, "p_prompt_version": PROMPT_VERSION}) or []
    print(f"{len(calls)} lead(s) to qualify", flush=True)
    seen: Counter = Counter()
    for c in calls:
        t0 = time.time()
        before = {k: dict(v) for k, v in client.usage.items()}
        try:
            out = qualify_call(c, client)
        except Exception as e:  # noqa: BLE001 - the type and message only
            print(f"call {c.get('call_id')}: failed ({type(e).__name__}: {str(e)[:200]})", flush=True)
            continue
        usage = {t: {k: v - before.get(t, {}).get(k, 0) for k, v in u.items()} for t, u in client.usage.items()}
        db.rpc("crm_qualif_store", {"p_call": c["call_id"], "p_status": out["status"], "p_result": out["result"],
                                    "p_readings": out["readings"], "p_verification": out["verification"],
                                    "p_usage": usage, "p_prompt_version": out["prompt_version"],
                                    "p_rules_version": out["rules_version"]})
        seen[out["status"]] += 1
        print(f"call {c['call_id']}: {out['status']} in {round(time.time() - t0)} s", flush=True)
    print("statuses: " + ", ".join(f"{k} {v}" for k, v in seen.most_common()) + f" · usage {client.usage}", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
