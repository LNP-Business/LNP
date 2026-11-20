"""Calls of one sales cycle (Part C, C9; Romain, 2026-11-20)."""
from lnp_callqa.competences import pitch as P
from lnp_callqa.core import rounds
from lnp_callqa.core.models import CallContext, CompetenceResult, Turn

GOOD = {"verdict": "present", "restitution": {"components": {"PROBLEM": {"source": "T1"}, "COST": {"source": "T2"},
                                                             "A": {"source": "T3"}, "B": {"source": "T4"}}}}


def test_a_good_gap_is_present_with_its_four_components():
    assert rounds.gap_good(GOOD) is True
    incomplete = {"verdict": "present", "restitution": {"components": dict(GOOD["restitution"]["components"], B=None)}}
    assert rounds.gap_good(incomplete) is False
    assert rounds.gap_good({"verdict": "absent", "absence_reason": "not_validated"}) is False
    assert rounds.gap_good({}) is None and rounds.gap_good({"carried_from": "r1"}) is None


def test_the_plan_reads_the_earlier_calls():
    r1 = {"call_id": "r1", "results": {"GAP": GOOD, "PITCH": {"phases": {"pitch_start": "T80", "first_price": "T90"}}}}
    p = rounds.plan(2, [r1])
    assert (p["gap_good"], p["gap_from"], p["pitch_done"], p["price_given"]) == (True, "r1", True, True)
    assert rounds.plan(1, [r1])["gap_good"] is None                           # a first call reads everything
    assert rounds.plan(2, [])["gap_good"] is None                             # an unknown earlier call: the same
    # R3 after an R2 that carried R1's gap: the last call with a gap reading decides
    r2 = {"call_id": "r2", "results": {"GAP": {"carried_from": "r1"}, "PITCH": {}}}
    p3 = rounds.plan(3, [r1, r2])
    assert (p3["gap_good"], p3["gap_from"], p3["pitch_done"]) == (True, "r1", True)
    bad = {"call_id": "r1", "results": {"GAP": {"verdict": "absent"}, "PITCH": {}}}
    assert rounds.plan(2, [bad])["gap_good"] is False and not rounds.plan(2, [bad])["pitch_done"]


def ctx_with(cycle=None, turns=6):
    ts = [Turn(f"T{i:03d}", i, "00:00", "x", "SALES" if i % 2 else "PROSPECT", f"phrase {i}") for i in range(1, turns + 1)]
    c = CallContext("c", "s", "2026-11-20T10:00:00Z", "Europe/Paris", ts)
    c.cycle = cycle or {}
    return c


def test_what_is_skipped_and_why():
    c = ctx_with({"gap_good": True, "pitch_done": True, "price_given": True})
    assert rounds.skip_reason(c, "SPIN") == rounds.skip_reason(c, "GAP") == "gap_made_in_previous_call"
    assert rounds.skip_reason(c, "PITCH") == "pitch_made_in_previous_call" and rounds.skip_reason(c, "OBJECTIONS") is None
    assert rounds.objections_from_start(c)
    assert rounds.skip_reason(ctx_with({"gap_good": False}), "SPIN") is None


def test_a_pitch_after_a_gap_carried_from_an_earlier_call_is_after_the_gap():
    c = ctx_with()
    assert P.pitch_before_gap(c, dict(GOOD, carried_from="r1"), "T005") is False
    assert P.pitch_before_gap(c, {"verdict": "absent"}, "T005") is True


def bad_gap_ctx(sols, rests=(["T002", "T002"],), pitch="T006"):
    c = ctx_with(turns=7)
    c.phases.pitch_start = pitch
    c.results["GAP"] = CompetenceResult("GAP", "GAP-1.3", status="scored", verdict="absent",
                                        details={"verdict": "absent", "restitutions": [{"span": list(r)} for r in rests]})
    c.results["SPIN"] = CompetenceResult("SPIN", "SPIN-1.3", status="scored", details={"solicitations": sols})
    return c


def test_a_bad_gap_must_be_followed_by_a_restatement_or_a_return_to_discovery():
    c = bad_gap_ctx([{"turn": "T003", "letter": "P"}])
    assert rounds.gap_remediation(c) == {"needed": True, "done": "discovery", "after": "T002"}
    c = bad_gap_ctx([], rests=(["T002", "T002"], ["T004", "T004"]))
    assert rounds.gap_remediation(c)["done"] == "restatement"
    c = bad_gap_ctx([{"turn": "T003", "letter": "OUT"}, {"turn": "T007", "letter": "S"}])    # OUT, or after the pitch
    assert rounds.gap_remediation(c)["done"] is None and "gap_not_remedied" in c.flags
    c = bad_gap_ctx([], rests=())
    assert rounds.gap_remediation(c) is None                                  # no restatement at all: nothing to follow
