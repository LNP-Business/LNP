"""End-to-end smoke test: the full pipeline on a real transcript, with a model that finds nothing.
Checks the fixed stage order, the shared state and that no competence crashes."""
import os
import re
from pathlib import Path

from alkimiy_callqa.core.llm import MockClient
from alkimiy_callqa.core.models import CallContext, Turn
from alkimiy_callqa.core.runner import Runner
from alkimiy_callqa.pipeline import analyse_call, result_record

RUNS = Path(os.environ.get("CALLQA_CORPUS", str(Path(__file__).parent / "fixtures" / "transcripts")))


def load(call):
    turns = []
    for line in (RUNS / call / "transcript_compact.txt").read_text().splitlines():
        m = re.match(r"\[T(\d+) ([^\]]*)\] (\w+): (.*)", line)
        if m:
            turns.append(Turn(f"T{int(m.group(1)):03d}", int(m.group(1)), m.group(2), m.group(3), m.group(3), m.group(4)))
    return CallContext(call, "valentino", "2026-06-18T15:00:00Z", "Asia/Dubai", turns, {"price": 5800})


def test_pipeline_runs_end_to_end_without_engine_error():
    ctx = load("001")
    order = []
    def fb(task, unit, prompt, p):
        if not order or order[-1] != task.split(".")[0]:
            order.append(task.split(".")[0])
        return {}
    analyse_call(ctx, Runner(MockClient(fallback=fb)))
    assert set(ctx.results) == {"SPIN", "GAP", "PITCH", "OBJECTIONS"}
    assert all(r.reasons != ["engine_error"] for r in ctx.results.values())
    assert order[0] == "foundation" and order.index("spin") < order.index("gap")
    rec = result_record(ctx)
    assert rec["results"]["GAP"]["verdict"] == "absent"          # nothing found -> no restitution
    assert rec["audit"], "every model pass is audited"


def test_suspect_diarization_excludes_every_competence():
    ctx = load("001")
    for t in ctx.turns:
        t.role = "SALES"
    analyse_call(ctx, Runner(MockClient(fallback=lambda *a: {})))
    assert ctx.status == "no_diarization"
    assert all(r.status == "excluded" for r in ctx.results.values())
