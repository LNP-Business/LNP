"""Worker: crm_ca_config.engine = 'lite' (035) runs call-analysis/lite; anything else runs the reference engine."""
import sys
from pathlib import Path

import pytest

from alkimiy_callqa.core.llm import MockClient
from callqa_worker.gateway import GatewayClient
from callqa_worker.job import ModelErrors, engine_of, engine_version, run_job, summary
from test_worker import TIERS, claim, opener_from

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "lite" / "tests"))
import synthetic_call as sc  # noqa: E402  (fictional call of the lite tests)


def lite_claim():
    return claim(transcript=sc.transcript(), speaker_map=sc.SPEAKERS,
                 config={"tiers": TIERS, "passes": 3, "engine": "lite"})


def test_job_routes_engine_lite_to_the_lite_engine():
    from callqa_lite.steps import MockLiteClient
    c = lite_claim()
    client = MockLiteClient(sc.ANSWERS)
    rec = run_job(c, client, rounds=True, workers=24)
    assert rec["meta"]["engine"] == "lite" and engine_of(c) == "lite" and engine_version(c) == "callqa-lite-1.0"
    assert {x["task"] for x in client.calls} == {"lite.s0_phases", "lite.s1_discovery", "lite.s2_gap", "lite.s3_pitch",
                                                  "lite.s4_objections"}
    assert all(x["tier"] == "fast" and x["effort"] == "low" for x in client.calls)
    assert set(rec["results"]) == {"SPIN", "GAP", "PITCH", "OBJECTIONS"} and rec["results"]["GAP"]["verdict"] == "present"
    assert summary(rec).startswith("engine=lite ") and "Alex" not in summary(rec)


def test_full_engine_unchanged_without_the_choice():
    assert engine_of(claim()) == "full" and engine_version(claim()) == "alkimiy_callqa-1.0"
    assert engine_of(claim(config={"tiers": TIERS, "passes": 3, "engine": "full"})) == "full"
    rec = run_job(claim(), MockClient(fallback=lambda *a: {}))
    assert "meta" not in rec and set(rec["results"]) == {"SPIN", "GAP", "PITCH", "OBJECTIONS"}


def test_lite_model_failure_stops_the_job_for_good():
    from callqa_lite.steps import MockLiteClient
    with pytest.raises(ModelErrors) as e:
        run_job(lite_claim(), MockLiteClient({"lite.s0_phases": "not json"}))
    assert e.value.final and "S0" in str(e.value)


def test_gateway_complete_sends_the_transcript_as_a_cached_prefix():
    op, seen = opener_from([(200, {"text": "{\"turns\": []}", "stop_reason": "end_turn",
                                   "usage": {"input_tokens": 900, "output_tokens": 40,
                                             "cache_creation_input_tokens": 15000}})])
    g = GatewayClient("https://x/f", "k", TIERS, opener=op, sleep=lambda s: None, effort="none")
    out = g.complete("lite.s0_phases", "call", "fast", "SYSTEM", "T001 [SALES] Hello", "STEP", 6000, "low")
    assert out == {"text": "{\"turns\": []}", "stop_reason": "end_turn"}
    assert seen[0] == {"model": "claude-haiku-5-5", "system": "SYSTEM", "prefix": "T001 [SALES] Hello", "prompt": "STEP",
                       "max_tokens": 6000, "effort": "low", "cache_prompt": False}
    assert g.usage["fast"]["cache_creation_input_tokens"] == 15000 and g.usage["fast"]["calls"] == 1


def test_loop_stores_a_lite_record_with_the_lite_version(monkeypatch):
    import run as loop
    from callqa_lite.steps import MockLiteClient
    stored = []

    class FakeDb:
        def __init__(self, *a):
            self.claims = [lite_claim()]

        def rpc(self, name, args):
            if name == "crm_ca_claim":
                return self.claims.pop(0) if self.claims else None
            stored.append((name, args))
            return {}

    class FakeClient(MockLiteClient):
        def __init__(self, *a, **k):
            super().__init__(sc.ANSWERS)
            self.effort = k.get("effort")

    monkeypatch.setenv("SUPABASE_URL", "https://x.supabase.co")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "k")
    monkeypatch.setattr(loop, "Supabase", FakeDb)
    monkeypatch.setattr(loop, "GatewayClient", FakeClient)
    monkeypatch.setattr("sys.argv", ["run.py"])
    assert loop.main() == 0
    name, args = stored[0]
    assert name == "crm_ca_store" and args["p_engine"] == "callqa-lite-1.0"
    assert args["p_record"]["meta"]["engine"] == "lite"
    assert args["p_usage"]["engine"] == "lite" and args["p_usage"]["effort"] == "low"
