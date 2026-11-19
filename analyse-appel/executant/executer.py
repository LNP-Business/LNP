"""Worker loop: python3 run.py [--once] [--budget-min 300]

Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (GitHub secret). An R1 is also qualified (callqa_worker/qualif.py, 046): the
lead qualification of call-analysis/qualification is part of its analysis. The model gateway is $SUPABASE_URL/functions/v1/callqa-llm.
crm_ca_config.engine = 'lite' runs call-analysis/lite instead of the reference engine (effort: CALLQA_LITE_EFFORT,
default low). Takes queued jobs one by one until none is left or the time budget is spent; a failed job is retried by the database
(crm_ca_fail: twice, 10 minutes apart). Logs job ids, status, scores and token counts only.
"""
from __future__ import annotations

import argparse
import os
import socket
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "moteur"))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from executant_analyse.passerelle import ClientPasserelle, ErreurPasserelle  # noqa: E402
from executant_analyse.travail import ErreursModele, moteur_de, version_moteur, executer_travail, resume  # noqa: E402
from executant_analyse.anticipation import TropLong  # noqa: E402
from executant_analyse.qualif import qualifier_, stocker as store_qualif  # noqa: E402
from executant_analyse.supabase import Supabase  # noqa: E402


def principal() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--once", action="store_true", help="one job at most")
    ap.add_argument("--budget-min", type=float, default=300)
    a = ap.parse_args()
    url, cle = os.environ.get("SUPABASE_URL", ""), os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    if not url or not cle:
        print("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are not set: nothing to do.")
        return 0
    db, t0, executant = Supabase(url, cle), time.time(), f"gha:{socket.gethostname()}"
    fait = 0
    while time.time() - t0 < a.budget_min * 60:
        prise = db.rpc("crm_ca_claim", {"p_worker": executant})
        if not prise:
            break
        travail = prise["job"]
        print(f"job {travail}: call {prise['call'].get('call_id')} R{prise['call'].get('sales_round')} attempt {prise.get('attempt')}", flush=True)
        try:
            cfg = prise.get("config") or {}
            client = ClientPasserelle(url.rstrip("/") + "/functions/v1/callqa-llm", cle, cfg.get("tiers") or {},
                                   effort=os.environ.get("CALLQA_EFFORT") or cfg.get("effort") or "none",
                                   passes=int(cfg.get("passes") or 3))
            commence = time.time()
            enregistrement = executer_travail(prise, client, tours_lot=True, executants=24, budget_s=90 * 60, journal=lambda m: print(f"job {travail}: {m}", flush=True))
            # an R1: the lead qualification is part of its analysis (046); a failure never stops the analysis
            qual = qualifier_(prise, client, db, journal=lambda m: print(f"job {travail}: {m}", flush=True))
            conso = {"tiers": client.conso, "seconds": round(time.time() - commence), "effort": getattr(client, "effort", None),
                     "engine": moteur_de(prise)}
            if moteur_de(prise) == "lite":
                conso["effort"] = (enregistrement.get("meta") or {}).get("effort")
            if qual:
                conso["qualification"] = qual.get("usage") or {"error": qual.get("error")}
            db.rpc("crm_ca_store", {"p_job": travail, "p_record": enregistrement, "p_usage": conso, "p_engine": version_moteur(prise)})
            try:
                store_qualif(db, prise, travail, qual)
            except Exception as e:  # noqa: BLE001 - the analysis is stored; the qualification can be run again
                print(f"job {travail}: qualification not stored ({type(e).__name__}: {str(e)[:200]})", flush=True)
            print(f"job {travail}: done in {conso['seconds']} s · {resume(enregistrement)} · usage {client.conso}", flush=True)
            fait += 1
        except ErreursModele as e:   # never retried as is: the model questions fail, the record would be empty
            print(f"job {travail}: stopped ({e})", flush=True)
            db.rpc("crm_ca_fail", {"p_job": travail, "p_error": str(e), "p_final": True})
        except TropLong as e:   # never retried: a call that takes this long would only burn credit again
            print(f"job {travail}: stopped ({e})", flush=True)
            db.rpc("crm_ca_fail", {"p_job": travail, "p_error": str(e), "p_final": True})
        except ErreurPasserelle as e:
            print(f"job {travail}: failed ({e})", flush=True)
            db.rpc("crm_ca_fail", {"p_job": travail, "p_error": str(e), "p_final": e.final})
        except Exception as e:  # noqa: BLE001 - the error type and message only, never the record
            print(f"job {travail}: failed ({type(e).__name__}: {str(e)[:300]})", flush=True)
            db.rpc("crm_ca_fail", {"p_job": travail, "p_error": f"{type(e).__name__}: {str(e)[:1000]}", "p_final": False})
        if a.once:
            break
    print(f"{fait} call(s) analysed.")
    return 0


if __name__ == "__main__":
    sys.exit(principal())
