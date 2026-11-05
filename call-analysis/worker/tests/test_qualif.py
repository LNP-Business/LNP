"""An R1 analysis also qualifies the lead (callqa_worker/qualif.py, 046): the same turns as the analysis, two readings, the
four-gate rule; an R2 is not qualified; a failure never stops the analysis."""
import json
import sys
from pathlib import Path

from callqa_worker import qualif
from test_worker import claim

FACTS = json.loads((Path(__file__).resolve().parents[2] / "qualification" / "tests" / "fixture_facts.json").read_text(encoding="utf-8"))


class Stub:
    def __init__(self, answer):
        self.answer, self.calls, self.usage = answer, [], {"fast": {"input": 0}}

    def complete(self, task_id, unit_id, tier, system, prefix, prompt, max_tokens=8000, effort="low"):
        self.calls.append({"task": task_id, "tier": tier, "prefix": prefix})
        self.usage["fast"]["input"] += 100
        return {"text": self.answer}


class DB:
    def __init__(self):
        self.calls = []

    def rpc(self, fn, args):
        self.calls.append((fn, args))
        if fn == "crm_qualif_context":
            return {"date_appel": "2026-11-04", "recorded_by": "sam@lesnouveauxprofs.fr", "saisie": {"outcome": "WON"}}
        return 1


def test_an_r1_is_qualified_from_the_turns_of_the_analysis():
    c, client, db = claim(), Stub(json.dumps(FACTS)), DB()
    q = qualif.qualify(c, client, db)
    assert q["status"] and q["prompt_version"].startswith("lnp-sql-v2.2") and q["rules_version"] == "qualification_lnp-v2.2"
    assert [x["tier"] for x in client.calls] == ["fast", "strong"], "two readings"
    prefix = client.calls[0]["prefix"]
    assert "SALES:" in prefix and "PROSPECT:" in prefix, "the analysis' speakers"
    assert db.calls[0] == ("crm_qualif_context", {"p_call": "c1"})
    assert q["usage"]["fast"]["input"] == 200
    qualif.store(db, c, "j1", q)
    fn, args = db.calls[-1]
    assert fn == "crm_qualif_store" and args["p_job"] == "j1" and args["p_status"] == q["status"] and args["p_call"] == "c1"


def test_an_r2_is_not_qualified():
    c = claim(call={"call_id": "c2", "sales_round": 2, "start_utc": "2026-10-20T15:00:00+00:00"})
    assert qualif.qualify(c, Stub("{}"), DB()) is None


def test_a_failure_never_stops_the_analysis():
    class Broken(Stub):
        def complete(self, *a, **k):
            raise RuntimeError("gateway down")
    q = qualif.qualify(claim(), Broken(""), DB())
    assert q["error"].startswith("RuntimeError")
    db = DB(); qualif.store(db, claim(), "j1", q)
    assert db.calls == [], "an error is not stored"
