"""An R1 analysis also qualifies the lead (callqa_worker/qualif.py, 046): the same turns as the analysis, two readings, the
four-gate rule; an R2 is not qualified; a failure never stops the analysis."""
import json
import sys
from pathlib import Path

from executant_analyse import qualif
from test_executant import prise

FAITS = json.loads((Path(__file__).resolve().parents[2] / "qualification" / "tests" / "fixture_facts.json").read_text(encoding="utf-8"))


class Bouchon:
    def __init__(self, reponse):
        self.reponse, self.appels, self.conso = reponse, [], {"fast": {"input": 0}}

    def completer(self, id_tache, id_unite, palier, systeme, prefixe, consigne, max_tokens=8000, effort="low"):
        self.appels.append({"task": id_tache, "tier": palier, "prefix": prefixe})
        self.conso["fast"]["input"] += 100
        return {"text": self.reponse}


class DB:
    def __init__(self):
        self.appels = []

    def rpc(self, fn, args):
        self.appels.append((fn, args))
        if fn == "crm_qualif_context":
            return {"date_appel": "2026-11-04", "recorded_by": "sam@lesnouveauxprofs.fr", "saisie": {"outcome": "WON"}}
        return 1


def test_un_r1_est_qualifie_depuis_les_tours_de_l_analyse():
    c, client, db = prise(), Bouchon(json.dumps(FAITS)), DB()
    q = qualif.qualifier_(c, client, db)
    assert q["status"] and q["prompt_version"].startswith("lnp-sql-v2.2") and q["rules_version"] == "qualification_lnp-v2.2"
    assert [x["tier"] for x in client.appels] == ["fast", "strong"], "two readings"
    prefixe = client.appels[0]["prefix"]
    assert "SALES:" in prefixe and "PROSPECT:" in prefixe, "the analysis' speakers"
    assert db.appels[0] == ("crm_qualif_context", {"p_call": "c1"})
    assert q["usage"]["fast"]["input"] == 200
    qualif.stocker(db, c, "j1", q)
    fn, args = db.appels[-1]
    assert fn == "crm_qualif_store" and args["p_job"] == "j1" and args["p_status"] == q["status"] and args["p_call"] == "c1"


def test_un_r2_n_est_pas_qualifie():
    c = prise(call={"call_id": "c2", "sales_round": 2, "start_utc": "2026-10-20T15:00:00+00:00"})
    assert qualif.qualifier_(c, Bouchon("{}"), DB()) is None


def test_un_echec_n_arrete_jamais_l_analyse():
    class Casse(Bouchon):
        def completer(self, *a, **k):
            raise RuntimeError("gateway down")
    q = qualif.qualifier_(prise(), Casse(""), DB())
    assert q["error"].startswith("RuntimeError")
    db = DB(); qualif.stocker(db, prise(), "j1", q)
    assert db.appels == [], "an error is not stored"
