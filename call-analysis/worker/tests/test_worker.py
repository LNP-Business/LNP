"""Worker: model gateway client, claim → context → call record, and the loop (no network, no real transcript)."""
import io
import json
import urllib.error

import pytest

from lnp_callqa.core.llm import MockClient
from lnp_callqa.core.runner import RunConfig
from callqa_worker.gateway import GatewayClient, GatewayError
from callqa_worker.job import build_context, case_library, prior_inputs, run_job, summary

TIERS = {"fast": "claude-haiku-5-5", "strong": "claude-sonnet-5-5", "arbiter": "claude-opus-5-5"}


def synthetic_transcript() -> str:
    """A fictional call (no real prospect): enough words on both sides to pass the diarization gate."""
    lines = []
    for i in range(40):
        m, s = divmod(i * 20, 60)
        if i % 2 == 0:
            lines.append(f"[{m:02d}:{s:02d}] Sam Rep: Question number {i}, can you tell me more about how your business works today?")
        else:
            lines.append(f"[{m:02d}:{s:02d}] Alex Lead: Answer {i}, I sell some design work but I would like more clients and a steadier income every month.")
    return "\n".join(lines)


def claim(**over):
    c = {"job": "j1", "attempt": 1, "transcript": synthetic_transcript(),
         "speaker_map": {"Sam Rep": "SALES", "Alex Lead": "PROSPECT"},
         "call": {"call_id": "c1", "sales_id": "valentino", "start_utc": "2026-10-20T15:00:00+00:00", "timezone": "Asia/Dubai", "sales_round": 1},
         "config": {"tiers": TIERS, "passes": 3}, "offer_reference": {}, "case_library": [], "prior": []}
    c.update(over)
    return c


class FakeResp(io.BytesIO):
    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


def opener_from(answers):
    """answers: list of (status, body); 200 bodies are returned, others raised as HTTPError."""
    seen = []

    def op(req, timeout=None):
        seen.append(json.loads(req.data))
        status, body = answers.pop(0)
        if status == 200:
            return FakeResp(json.dumps(body).encode())
        raise urllib.error.HTTPError(req.full_url, status, "x", {}, io.BytesIO(json.dumps(body).encode()))
    return op, seen


def test_gateway_sends_the_tier_model_and_counts_usage():
    op, seen = opener_from([(200, {"text": "ok {\"found\": false}", "usage": {"input_tokens": 100, "output_tokens": 5, "cache_read_input_tokens": 80}})])
    g = GatewayClient("https://x/functions/v1/callqa-llm", "k", TIERS, opener=op, sleep=lambda s: None)
    assert g.ask("spin.gates", "sol:T001", "strong", "RULES", "UNIT", 1) == {"found": False}
    assert seen[0]["model"] == "claude-sonnet-5-5" and "temperature" not in seen[0] and seen[0]["system"] == "RULES"
    assert g.usage["strong"] == {"calls": 1, "input_tokens": 100, "output_tokens": 5, "cache_read_input_tokens": 80, "cache_creation_input_tokens": 0}
    assert seen[0]["effort"] == "low" and seen[0]["cache_prompt"] is True, "a pass: low effort, question cached"


def test_gateway_effort_none_turns_thinking_off_but_keeps_the_foundation_default():
    # LNP (2026-11-03, under 10 cents a call): effort "none" on every question, the register included; the foundation keeps
    # its default
    op, seen = opener_from([(200, {"text": "{}"})] * 3)
    g = GatewayClient("https://x/f", "k", TIERS, opener=op, sleep=lambda s: None, effort="none", passes=1)
    g.ask("spin.gates", "sol:T001", "fast", "s", "p", 1)
    g.ask("spin.register", "register:Q1", "fast", "s", "p", 1)
    g.ask("foundation.phases", "chunk:1", "fast", "s", "p", 1)
    assert [s["effort"] for s in seen] == ["none", "none", "default"]


def test_gateway_caches_a_question_only_when_another_pass_asks_it():
    op, seen = opener_from([(200, {"text": "{}"})] * 2)
    GatewayClient("https://x/f", "k", TIERS, opener=op, sleep=lambda s: None, passes=1).ask("t", "u", "fast", "s", "p", 1)
    GatewayClient("https://x/f", "k", TIERS, opener=op, sleep=lambda s: None, passes=3).ask("t", "u", "fast", "s", "p", 1)
    assert [s["cache_prompt"] for s in seen] == [False, True]


def test_gateway_keeps_the_model_default_for_the_foundation():
    op, seen = opener_from([(200, {"text": "{}"})])
    GatewayClient("https://x/f", "k", TIERS, opener=op, sleep=lambda s: None).ask("foundation.attribution", "chunk:1", "fast", "s", "p", 1)
    assert seen[0]["effort"] == "default"


def test_gateway_asks_the_register_at_medium_effort():
    op, seen = opener_from([(200, {"text": "{}"})])
    GatewayClient("https://x/f", "k", TIERS, opener=op, sleep=lambda s: None).ask("spin.register", "register:Q1", "fast", "s", "p", 1)
    assert seen[0]["effort"] == "medium"


def test_gateway_does_not_cache_an_arbitration_question():
    op, seen = opener_from([(200, {"text": "{}"})])
    GatewayClient("https://x/f", "k", TIERS, opener=op, sleep=lambda s: None, effort="medium").ask("t", "u", "arbiter", "s", "p", 0)
    assert seen[0]["cache_prompt"] is False and seen[0]["effort"] == "medium"


def test_gateway_retries_when_busy_and_stops_on_a_missing_key():
    op, _ = opener_from([(503, {"error": "busy", "retry": True}), (200, {"text": "{\"a\": 1}", "usage": {}})])
    g = GatewayClient("https://x/f", "k", TIERS, opener=op, sleep=lambda s: None)
    assert g.ask("t", "u", "fast", "s", "p", 1) == {"a": 1}
    op, _ = opener_from([(409, {"error": "ANTHROPIC_API_KEY is not set"})])
    with pytest.raises(GatewayError) as e:
        GatewayClient("https://x/f", "k", TIERS, opener=op, sleep=lambda s: None).ask("t", "u", "fast", "s", "p", 1)
    assert e.value.final and "ANTHROPIC_API_KEY" in str(e.value)
    with pytest.raises(GatewayError) as e:
        GatewayClient("https://x/f", "k", {"fast": "x"})
    assert e.value.final


def test_context_from_the_claim():
    ctx = build_context(claim(case_library=[{"id": "a", "title": "Case", "consent": True, "start_value": 2000, "start_unit": "USD/month",
                                             "start_profile": "designer", "figures": {"after": 8000}}],
                              prior=[{"call_id": "c0", "results": {"OBJECTIONS": {"episodes": [{"start": "T010"}]}}}]))
    assert len(ctx.turns) == 40 and ctx.turns[0].role == "SALES" and ctx.turns[1].role == "PROSPECT"
    assert ctx.case_library[0]["start"] == {"value": 2000, "unit": "USD/month", "profile": "designer"} and ctx.case_library[0]["consent"]
    assert ctx.prior_inputs == [{"kind": "objections_episodes", "call_id": "c0", "episodes": [{"start": "T010"}]}]
    assert case_library(None) == [] and prior_inputs([{"results": {}}]) == []


def test_job_gives_a_full_call_record_and_parallel_passes_change_nothing():
    rec_par = run_job(claim(), MockClient(fallback=lambda *a: {}))
    rec_seq = run_job(claim(), MockClient(fallback=lambda *a: {}), RunConfig(passes=3, parallel_passes=False))
    assert set(rec_par["results"]) == {"SPIN", "GAP", "PITCH", "OBJECTIONS"}
    assert all(r["rules_version"] for r in rec_par["results"].values())
    strip = lambda r: {k: {kk: vv for kk, vv in v.items()} for k, v in r["results"].items()}
    assert strip(rec_par) == strip(rec_seq)
    json.dumps(rec_par, default=str)                     # what crm_ca_store receives
    assert "status=ok" in summary(rec_par) and "Alex" not in summary(rec_par)


def test_suspect_or_unmapped_call_is_excluded_not_crashed():
    rec = run_job(claim(speaker_map={"Sam Rep": "SALES", "Alex Lead": "SALES"}), MockClient(fallback=lambda *a: {}))
    assert rec["status"] == "no_diarization" and all(r["status"] == "excluded" for r in rec["results"].values())


def test_loop_stores_or_fails(monkeypatch):
    import run as loop
    calls = []

    class FakeDb:
        def __init__(self, *a):
            self.claims = [claim()]

        def rpc(self, name, args):
            calls.append(name)
            if name == "crm_ca_claim":
                return self.claims.pop(0) if self.claims else None
            return {}

    class FakeClient(MockClient):
        def __init__(self, *a, **k):
            super().__init__(fallback=lambda *x: {})
            self.usage = {}

    monkeypatch.setenv("SUPABASE_URL", "https://x.supabase.co")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "k")
    monkeypatch.setattr(loop, "Supabase", FakeDb)
    monkeypatch.setattr(loop, "GatewayClient", FakeClient)
    monkeypatch.setattr("sys.argv", ["run.py"])
    assert loop.main() == 0
    assert calls == ["crm_ca_claim", "crm_qualif_context", "crm_ca_store", "crm_ca_claim"]  # an R1: qualified too (046)
    calls.clear()

    def boom(*a, **k):
        raise GatewayError("ANTHROPIC_API_KEY is not set", final=True)
    monkeypatch.setattr(loop, "GatewayClient", boom)
    assert loop.main() == 0
    assert calls == ["crm_ca_claim", "crm_ca_fail", "crm_ca_claim"]


def test_gateway_stops_on_a_refused_request():
    op, _ = opener_from([(502, {"error": "400 invalid_request_error temperature is deprecated", "retry": False})])
    with pytest.raises(GatewayError) as e:
        GatewayClient("https://x/f", "k", TIERS, opener=op, sleep=lambda s: None).ask("t", "u", "fast", "s", "p", 1)
    assert e.value.final and "deprecated" in str(e.value)
