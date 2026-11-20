"""Calls of one sales cycle (Part C, C9; Romain, 2026-11-20), on the fictional call of the lite tests."""
import copy

import synthetic_call as sc
from callqa_lite.engine import analyse
from callqa_lite.steps import MockLiteClient
from lnp_callqa.core import rounds


def first_call():
    return analyse(sc.context(), MockLiteClient(copy.deepcopy(sc.ANSWERS)))


def prior_of(rec):
    return [{"call_id": "r1", "start_utc": "2026-11-01T10:00:00Z",
             "results": {k: v["details"] for k, v in rec["results"].items()}}]


def second_call(prior, answers=None):
    ctx = sc.context()
    ctx.sales_round = 2
    ctx.cycle = rounds.plan(2, prior)
    client = MockLiteClient(answers or copy.deepcopy(sc.ANSWERS))
    return analyse(ctx, client), client


def test_after_a_good_gap_and_a_pitch_the_next_call_is_read_on_objections_only():
    r1 = first_call()
    assert r1["results"]["GAP"]["verdict"] == "present" and rounds.gap_good(r1["results"]["GAP"]["details"])
    rec, client = second_call(prior_of(r1))
    res = rec["results"]
    assert (res["SPIN"]["status"], res["SPIN"]["reasons"]) == ("not_applicable", ["gap_made_in_previous_call"])
    assert (res["GAP"]["status"], res["GAP"]["reasons"]) == ("not_applicable", ["gap_made_in_previous_call"])
    assert (res["PITCH"]["status"], res["PITCH"]["reasons"]) == ("not_applicable", ["pitch_made_in_previous_call"])
    assert res["GAP"]["details"]["carried_from"] == "r1"
    tasks = [c["task"] for c in client.calls]
    assert tasks == ["lite.s0_phases", "lite.s4_objections"]                 # no discovery, gap or pitch reading
    s4 = next(c for c in client.calls if c["task"] == "lite.s4_objections")
    assert "price was already given in an earlier call" in s4["prompt"]
    # the price was given in R1: the resistances before this call's price count (OB-27 reads the cycle)
    eps = res["OBJECTIONS"]["details"]["episodes"]
    assert [e["resistance"]["turn"] for e in eps] == ["T010", "T024", "T028", "T036", "T038"]
    assert "quote:before_price" not in rec["meta"]["steps"].get("S4", {}).get("reasons", {})
    assert res["OBJECTIONS"]["details"]["prevention_status"] == "not_applicable"     # prevention belongs to R1
    assert rec["meta"]["cycle"]["gap_good"] is True and "gap_details" not in rec["meta"]["cycle"]


def test_after_a_bad_gap_the_next_call_is_read_on_discovery_and_gap_again():
    r1 = first_call()
    r1["results"]["GAP"]["details"]["restitution"]["components"]["COST"] = None      # incomplete: a bad gap
    rec, client = second_call(prior_of(r1))
    res = rec["results"]
    assert res["SPIN"]["status"] == "scored" and res["GAP"]["status"] == "scored"
    assert res["PITCH"]["reasons"] == ["pitch_made_in_previous_call"]
    assert "lite.s1_discovery" in [c["task"] for c in client.calls]


def test_an_unknown_earlier_call_leaves_a_first_call_reading():
    ctx = sc.context()
    ctx.sales_round = 2
    ctx.cycle = rounds.plan(2, [])
    rec = analyse(ctx, MockLiteClient(copy.deepcopy(sc.ANSWERS)))
    assert all(r["status"] == "scored" for r in rec["results"].values())


def test_a_pitch_in_r2_after_a_good_gap_in_r1_is_read_against_the_r1_gap():
    r1 = first_call()
    prior = prior_of(r1)
    prior[0]["results"]["PITCH"] = {}                                         # R1: a good gap, no pitch, no price
    prior[0]["results"]["OBJECTIONS"] = {}
    rec, client = second_call(prior)
    res = rec["results"]
    assert res["SPIN"]["status"] == "not_applicable" and res["PITCH"]["status"] == "scored"
    assert "pitch_before_gap" not in (res["PITCH"]["details"].get("non_compliance") or [])
    s3 = next(c for c in client.calls if c["task"] == "lite.s3_pitch")
    assert "I want to make 6,000 a month" in s3["prompt"]                      # the R1 gap's B goes to the pitch reading


def test_a_bad_gap_not_followed_up_before_the_pitch_is_flagged():
    a = copy.deepcopy(sc.ANSWERS)
    a["lite.s2_gap"]["passages"][0]["validation"] = {"turn": "T018", "outcome": "rejected", "agreement_quote": "Yes, exactly"}
    rec = analyse(sc.context(), MockLiteClient(a))
    assert rec["results"]["GAP"]["verdict"] == "absent"
    assert rec["meta"]["gap_remediation"] == {"needed": True, "done": None, "after": "T017"}
    assert "gap_not_remedied" in rec["flags"] and "gap_not_remedied" in rec["results"]["GAP"]["flags"]
    assert first_call()["meta"]["gap_remediation"] == {"needed": False}


def test_a_recording_under_20_minutes_is_cut_and_not_analysed():
    """C1 (Romain, 2026-11-20): the call went on unrecorded; no model call, every competence excluded."""
    from lnp_callqa.core.foundation import parse_lines, parse_transcript
    from lnp_callqa.core.models import CallContext
    raw = "\n".join(f"[{m:02d}:00] {who}: phrase {m}." for m, who in
                    [(0, sc.S), (4, sc.P), (8, sc.S), (12, sc.P)])                     # 12 minutes
    ctx = CallContext("c", "s", "2026-11-20T10:00:00Z", "Europe/Paris", parse_transcript(raw, sc.SPEAKERS))
    ctx.lines = parse_lines(raw, sc.SPEAKERS)
    client = MockLiteClient(copy.deepcopy(sc.ANSWERS))
    rec = analyse(ctx, client)
    assert rec["status"] == "recording_incomplete" and "recording_minutes:12.0" in rec["flags"]
    assert all(r["status"] == "excluded" and r["reasons"] == ["recording_incomplete"] for r in rec["results"].values())
    assert client.calls == []
    assert first_call()["status"] == "ok"                                                # the fictional call lasts 30 min
