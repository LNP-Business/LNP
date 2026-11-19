"""Exécutant de la qualification des leads : python3 executer.py --limit 30

Variables d'environnement : SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (secret GitHub). Prend le dernier R1 des leads les plus
récents (crm_qualif_candidates, 042), qualifie chacun (agent.qualifier_appel : deux lectures par la passerelle callqa-llm,
puis la règle des portes) et enregistre le résultat (crm_qualif_store). Le dépôt est public : le journal ne montre que des
identifiants d'appel, des statuts et des nombres de jetons, jamais un nom ni une citation.
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
sys.path.insert(0, str(ICI.parent / "moteur"))     # le client de la passerelle lit lnp_analyse.noyau.client_modele

from agent import VERSION_CONSIGNES, qualifier_appel  # noqa: E402
from executant_analyse.passerelle import ClientPasserelle  # noqa: E402
from executant_analyse.supabase import Supabase  # noqa: E402


def principal() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", dest="limite", type=int, default=30, help="nombre de leads (30 par défaut)")
    ap.add_argument("--again", action="store_true", help="aussi les appels déjà qualifiés avec cette version de la consigne")
    a = ap.parse_args()
    url, cle = os.environ.get("SUPABASE_URL", ""), os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    if not url or not cle:
        print("SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY ne sont pas définies : rien à faire.")
        return 0
    db = Supabase(url, cle, delai=180)
    cfg = (db.rpc("crm_qualif_config", {}) or {})
    client = ClientPasserelle(url.rstrip("/") + "/functions/v1/callqa-llm", cle, cfg.get("tiers") or {}, passes=1)
    appels = db.rpc("crm_qualif_candidates", {"p_limit": a.limite, "p_again": a.again, "p_prompt_version": VERSION_CONSIGNES}) or []
    print(f"{len(appels)} lead(s) à qualifier", flush=True)
    vus: Counter = Counter()
    for c in appels:
        t0 = time.time()
        avant = {k: dict(v) for k, v in client.conso.items()}
        try:
            sortie = qualifier_appel(c, client)
        except Exception as e:  # noqa: BLE001 - le type et le message seulement
            print(f"appel {c.get('call_id')} : échec ({type(e).__name__}: {str(e)[:200]})", flush=True)
            continue
        conso = {t: {k: v - avant.get(t, {}).get(k, 0) for k, v in u.items()} for t, u in client.conso.items()}
        db.rpc("crm_qualif_store", {"p_call": c["call_id"], "p_status": sortie["status"], "p_result": sortie["result"],
                                    "p_readings": sortie["readings"], "p_verification": sortie["verification"],
                                    "p_usage": conso, "p_prompt_version": sortie["prompt_version"],
                                    "p_rules_version": sortie["rules_version"]})
        vus[sortie["status"]] += 1
        print(f"appel {c['call_id']} : {sortie['status']} en {round(time.time() - t0)} s", flush=True)
    print("statuts : " + ", ".join(f"{k} {v}" for k, v in vus.most_common()) + f" · consommation {client.conso}", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(principal())
