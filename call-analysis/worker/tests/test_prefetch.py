"""Parallel rounds (prefetch.py) give exactly the sequential result, with no extra model question."""
import json
import os
import re
from pathlib import Path

import pytest

from lnp_callqa.core.llm import MockClient
from lnp_callqa.core.models import CallContext, Evidence, Turn, SALES
from lnp_callqa.core.runner import Runner
from lnp_callqa.pipeline import analyse_call, result_record
from callqa_worker.prefetch import PrefetchClient, analyse_in_rounds
from tests.test_worker import claim
from callqa_worker.job import run_job

RUNS = Path(os.environ.get("CALLQA_CORPUS", str(Path(__file__).resolve().parents[2] / "engine" / "tests" / "fixtures" / "transcripts")))
real = pytest.mark.skipif(not (RUNS / "001").exists(), reason="real transcripts not available")


class Counting(MockClient):
    def __init__(self, **k):
        super().__init__(**k)
        self.keys = set()

    def ask(self, task_id, unit_id, tier, system, prompt, pass_no):
        self.keys.add((task_id, unit_id, pass_no, hash(prompt)))
        return super().ask(task_id, unit_id, tier, system, prompt, pass_no)


def strip(rec):
    rec = json.loads(json.dumps(rec, default=str))
    rec.pop("audit", None)
    return rec


def load(call):
    turns = []
    for line in (RUNS / call / "transcript_compact.txt").read_text().splitlines():
        m = re.match(r"\[T(\d+) ([^\]]*)\] (\w+): (.*)", line)
        if m:
            turns.append(Turn(f"T{int(m.group(1)):03d}", int(m.group(1)), m.group(2), m.group(3), m.group(3), m.group(4)))
    return CallContext(call, "valentino", "2026-06-18T15:00:00Z", "Asia/Dubai", turns, {"price": 5800})


def test_synthetic_call_same_record_in_rounds():
    seq = run_job(claim(), MockClient(fallback=lambda *a: {}))
    par = run_job(claim(), MockClient(fallback=lambda *a: {}), rounds=True, workers=4)
    assert strip(seq) == strip(par)


@real
def test_real_call_same_record_and_no_extra_question():
    a, b = Counting(fallback=lambda *x: {}), Counting(fallback=lambda *x: {})
    ctx = load("001")
    analyse_call(ctx, Runner(a))
    seq = result_record(ctx)
    log = []
    ctx2 = analyse_in_rounds(lambda: load("001"), lambda c, cl: analyse_call(c, Runner(cl)), PrefetchClient(b), 8, log=log.append)
    assert strip(seq) == strip(result_record(ctx2))
    assert b.keys == a.keys, "the rounds ask exactly the questions of the sequential run"
    assert len(log) < len(a.keys) / 3, "questions go in batches"
    assert [e for e in ctx2.audit if "Pending" in str(e.get("error", ""))] == []


@real
def test_real_pitch_with_answers_same_result_in_rounds():
    """Same scenario as the engine's test_real_001_full_run (answers that pass the quote checks)."""
    from lnp_callqa.competences import pitch as P
    from tests_engine_helpers import pitch_001_setup
    ctx0, answers = pitch_001_setup(load)
    seq = P.PitchCompetence().run(ctx0, Runner(MockClient(answers=answers, fallback=lambda *x: {})))
    out = {}

    def run(c, cl):
        out["r"] = P.PitchCompetence().run(c, Runner(cl))
    analyse_in_rounds(lambda: pitch_001_setup(load)[0], run, PrefetchClient(MockClient(answers=answers, fallback=lambda *x: {})), 8)
    assert json.dumps(out["r"].to_dict(), default=str, sort_keys=True) == json.dumps(seq.to_dict(), default=str, sort_keys=True)
    assert seq.verdict == "compliant" and seq.details["validated_P"]["category"] == "Acquisition"


def test_time_budget_stops_for_good():
    from callqa_worker.prefetch import TooLong
    with pytest.raises(TooLong):
        run_job(claim(), MockClient(fallback=lambda *a: {}), rounds=True, workers=2, budget_s=-1)


def test_a_refused_request_stops_the_job_and_no_empty_record():
    from callqa_worker.gateway import GatewayError
    from callqa_worker.job import ModelErrors

    def refused(*a):
        raise GatewayError("HTTP 502 400 invalid_request_error `temperature` is deprecated for this model.", final=True)
    with pytest.raises(GatewayError):
        run_job(claim(), MockClient(fallback=refused), rounds=True, workers=2)

    def flaky(*a):
        raise GatewayError("model gateway unavailable: HTTP 503")
    with pytest.raises(ModelErrors):
        run_job(claim(), MockClient(fallback=flaky), rounds=True, workers=2)


def test_pass_1_is_sent_before_passes_2_and_3():
    """The provider caches pass 1's prompt; passes 2 and 3 go after it so they read it from the cache."""
    import threading
    order, lock = [], threading.Lock()

    class Rec:
        def ask(self, task_id, unit_id, tier, system, prompt, pass_no):
            with lock:
                order.append(pass_no)
            return {}
    c = PrefetchClient(Rec())
    for u in ("a", "b"):
        for p in (3, 2, 1):
            try:
                c.ask("spin.gates", u, "strong", "S", "P" + u, p)
            except Exception:  # noqa: BLE001 - Pending
                pass
    c.fetch(c.next_batch(), 8)
    assert sorted(order[:2]) == [1, 1] and sorted(order[2:]) == [2, 2, 3, 3]
    assert len(c.cache) == 6

