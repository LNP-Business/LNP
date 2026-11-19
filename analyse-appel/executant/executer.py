"""Boucle de l'exécutant : python3 executer.py [--once] [--budget-min 300]

Variables d'environnement : SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (secret GitHub). Un R1 est aussi qualifié
(executant_analyse/qualif.py, 046) : la qualification du lead (analyse-appel/qualification) fait partie de son analyse. La
passerelle du modèle est $SUPABASE_URL/functions/v1/callqa-llm. crm_ca_config.engine = 'lite' lance le moteur allégé
(analyse-appel/allege) à la place du moteur de référence (effort : CALLQA_LITE_EFFORT, low par défaut). Prend les travaux en
file un par un jusqu'à ce qu'il n'y en ait plus ou que le budget de temps soit épuisé ; un travail en échec est relancé par la
base (crm_ca_fail : deux fois, à 10 minutes d'intervalle). Le journal ne montre que les identifiants des travaux, les statuts,
les notes et les nombres de jetons.
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
    ap.add_argument("--once", action="store_true", help="un travail au plus")
    ap.add_argument("--budget-min", type=float, default=300, help="budget de temps, en minutes (300 par défaut)")
    a = ap.parse_args()
    url, cle = os.environ.get("SUPABASE_URL", ""), os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    if not url or not cle:
        print("SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY ne sont pas définies : rien à faire.")
        return 0
    db, t0, executant = Supabase(url, cle), time.time(), f"gha:{socket.gethostname()}"
    fait = 0
    while time.time() - t0 < a.budget_min * 60:
        prise = db.rpc("crm_ca_claim", {"p_worker": executant})
        if not prise:
            break
        travail = prise["job"]
        print(f"travail {travail} : appel {prise['call'].get('call_id')} R{prise['call'].get('sales_round')} essai {prise.get('attempt')}", flush=True)
        try:
            cfg = prise.get("config") or {}
            client = ClientPasserelle(url.rstrip("/") + "/functions/v1/callqa-llm", cle, cfg.get("tiers") or {},
                                   effort=os.environ.get("CALLQA_EFFORT") or cfg.get("effort") or "none",
                                   passes=int(cfg.get("passes") or 3))
            commence = time.time()
            enregistrement = executer_travail(prise, client, tours_lot=True, executants=24, budget_s=90 * 60, journal=lambda m: print(f"travail {travail} : {m}", flush=True))
            # un R1 : la qualification du lead fait partie de son analyse (046) ; un échec n'arrête jamais l'analyse
            qual = qualifier_(prise, client, db, journal=lambda m: print(f"travail {travail} : {m}", flush=True))
            conso = {"tiers": client.conso, "seconds": round(time.time() - commence), "effort": getattr(client, "effort", None),
                     "engine": moteur_de(prise)}
            if moteur_de(prise) == "lite":
                conso["effort"] = (enregistrement.get("meta") or {}).get("effort")
            if qual:
                conso["qualification"] = qual.get("usage") or {"error": qual.get("error")}
            db.rpc("crm_ca_store", {"p_job": travail, "p_record": enregistrement, "p_usage": conso, "p_engine": version_moteur(prise)})
            try:
                store_qualif(db, prise, travail, qual)
            except Exception as e:  # noqa: BLE001 - l'analyse est enregistrée ; la qualification peut être relancée
                print(f"travail {travail} : qualification non enregistrée ({type(e).__name__}: {str(e)[:200]})", flush=True)
            print(f"travail {travail} : fait en {conso['seconds']} s · {resume(enregistrement)} · consommation {client.conso}", flush=True)
            fait += 1
        except ErreursModele as e:   # jamais relancé tel quel : les questions au modèle échouent, l'enregistrement serait vide
            print(f"travail {travail} : arrêté ({e})", flush=True)
            db.rpc("crm_ca_fail", {"p_job": travail, "p_error": str(e), "p_final": True})
        except TropLong as e:   # jamais relancé : un appel aussi long ne ferait que dépenser du crédit une fois de plus
            print(f"travail {travail} : arrêté ({e})", flush=True)
            db.rpc("crm_ca_fail", {"p_job": travail, "p_error": str(e), "p_final": True})
        except ErreurPasserelle as e:
            print(f"travail {travail} : échec ({e})", flush=True)
            db.rpc("crm_ca_fail", {"p_job": travail, "p_error": str(e), "p_final": e.final})
        except Exception as e:  # noqa: BLE001 - le type et le message de l'erreur seulement, jamais l'enregistrement
            print(f"travail {travail} : échec ({type(e).__name__}: {str(e)[:300]})", flush=True)
            db.rpc("crm_ca_fail", {"p_job": travail, "p_error": f"{type(e).__name__}: {str(e)[:1000]}", "p_final": False})
        if a.once:
            break
    print(f"{fait} appel(s) analysé(s).")
    return 0


if __name__ == "__main__":
    sys.exit(principal())
