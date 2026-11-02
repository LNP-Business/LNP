"""Worker loop: python3 run.py [--once] [--budget-min 300]

Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (GitHub secret). The model gateway is $SUPABASE_URL/functions/v1/callqa-llm.
Takes queued jobs one by one until none is left or the time budget is spent; a failed job is retried by the database
(crm_ca_fail: twice, 10 minutes apart). Logs job ids, status, scores and token counts only.
"""
from __future__ import annotations

import argparse
import os
import socket
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "engine"))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from callqa_worker.gateway import GatewayClient, GatewayError  # noqa: E402
from callqa_worker.job import ENGINE_VERSION, ModelErrors, run_job, summary  # noqa: E402
from callqa_worker.prefetch import TooLong  # noqa: E402
from callqa_worker.supabase import Supabase  # noqa: E402


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--once", action="store_true", help="one job at most")
    ap.add_argument("--budget-min", type=float, default=300)
    a = ap.parse_args()
    url, key = os.environ.get("SUPABASE_URL", ""), os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    if not url or not key:
        print("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are not set: nothing to do.")
        return 0
    db, t0, worker = Supabase(url, key), time.time(), f"gha:{socket.gethostname()}"
    done = 0
    while time.time() - t0 < a.budget_min * 60:
        claim = db.rpc("crm_ca_claim", {"p_worker": worker})
        if not claim:
            break
        job = claim["job"]
        print(f"job {job}: call {claim['call'].get('call_id')} R{claim['call'].get('sales_round')} attempt {claim.get('attempt')}", flush=True)
        try:
            cfg = claim.get("config") or {}
            client = GatewayClient(url.rstrip("/") + "/functions/v1/callqa-llm", key, cfg.get("tiers") or {},
                                   effort=os.environ.get("CALLQA_EFFORT") or cfg.get("effort") or "low")
            started = time.time()
            record = run_job(claim, client, rounds=True, workers=24, budget_s=90 * 60, log=lambda m: print(f"job {job}: {m}", flush=True))
            usage = {"tiers": client.usage, "seconds": round(time.time() - started), "effort": getattr(client, "effort", None)}
            db.rpc("crm_ca_store", {"p_job": job, "p_record": record, "p_usage": usage, "p_engine": ENGINE_VERSION})
            print(f"job {job}: done in {usage['seconds']} s · {summary(record)} · usage {client.usage}", flush=True)
            done += 1
        except ModelErrors as e:   # never retried as is: the model questions fail, the record would be empty
            print(f"job {job}: stopped ({e})", flush=True)
            db.rpc("crm_ca_fail", {"p_job": job, "p_error": str(e), "p_final": True})
        except TooLong as e:   # never retried: a call that takes this long would only burn credit again
            print(f"job {job}: stopped ({e})", flush=True)
            db.rpc("crm_ca_fail", {"p_job": job, "p_error": str(e), "p_final": True})
        except GatewayError as e:
            print(f"job {job}: failed ({e})", flush=True)
            db.rpc("crm_ca_fail", {"p_job": job, "p_error": str(e), "p_final": e.final})
        except Exception as e:  # noqa: BLE001 - the error type and message only, never the record
            print(f"job {job}: failed ({type(e).__name__}: {str(e)[:300]})", flush=True)
            db.rpc("crm_ca_fail", {"p_job": job, "p_error": f"{type(e).__name__}: {str(e)[:1000]}", "p_final": False})
        if a.once:
            break
    print(f"{done} call(s) analysed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
