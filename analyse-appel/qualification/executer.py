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

ICI = Path(__file__).resolve().parent
sys.path.insert(0, str(ICI))
sys.path.insert(0, str(ICI.parent / "executant"))
sys.path.insert(0, str(ICI.parent / "moteur"))     # the gateway client reads lnp_callqa.core.llm

from agent import VERSION_CONSIGNES, qualifier_appel  # noqa: E402
from executant_analyse.passerelle import ClientPasserelle  # noqa: E402
from executant_analyse.supabase import Supabase  # noqa: E402


def principal() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", dest="limite", type=int, default=30)
    ap.add_argument("--again", action="store_true", help="also the calls already qualified with this prompt version")
    a = ap.parse_args()
    url, cle = os.environ.get("SUPABASE_URL", ""), os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    if not url or not cle:
        print("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are not set: nothing to do.")
        return 0
    db = Supabase(url, cle, delai=180)
    cfg = (db.rpc("crm_qualif_config", {}) or {})
    client = ClientPasserelle(url.rstrip("/") + "/functions/v1/callqa-llm", cle, cfg.get("tiers") or {}, passes=1)
    appels = db.rpc("crm_qualif_candidates", {"p_limit": a.limite, "p_again": a.again, "p_prompt_version": VERSION_CONSIGNES}) or []
    print(f"{len(appels)} lead(s) to qualify", flush=True)
    vus: Counter = Counter()
    for c in appels:
        t0 = time.time()
        avant = {k: dict(v) for k, v in client.conso.items()}
        try:
            sortie = qualifier_appel(c, client)
        except Exception as e:  # noqa: BLE001 - the type and message only
            print(f"call {c.get('call_id')}: failed ({type(e).__name__}: {str(e)[:200]})", flush=True)
            continue
        conso = {t: {k: v - avant.get(t, {}).get(k, 0) for k, v in u.items()} for t, u in client.conso.items()}
        db.rpc("crm_qualif_store", {"p_call": c["call_id"], "p_status": sortie["status"], "p_result": sortie["result"],
                                    "p_readings": sortie["readings"], "p_verification": sortie["verification"],
                                    "p_usage": conso, "p_prompt_version": sortie["prompt_version"],
                                    "p_rules_version": sortie["rules_version"]})
        vus[sortie["status"]] += 1
        print(f"call {c['call_id']}: {sortie['status']} in {round(time.time() - t0)} s", flush=True)
    print("statuses: " + ", ".join(f"{k} {v}" for k, v in vus.most_common()) + f" · usage {client.conso}", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(principal())
