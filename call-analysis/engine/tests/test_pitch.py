"""Tests of the Pitch competence (PITCH-2.0).

Part 1: minimal pairs 8a..13b of annex A7 as pure decision tests (no model).
Part 2: other pure decisions (gate, claims lookup, K5, K6, K7, N/A spread).
Part 3: real transcripts (Annex B5 P categories, a pitch_before_gap case, a full run) with mock model answers.
Business values in fixtures (offer price, case library entries) are test fixtures, not reference data.
"""
from __future__ import annotations
import os

import re
from pathlib import Path

import pytest

from alkimiy_callqa.competences import pitch as P
from alkimiy_callqa.competences.pitch import PitchCompetence, decide
from alkimiy_callqa.core.llm import MockClient
from alkimiy_callqa.core.models import (Atom, CallContext, CompetenceResult, Evidence, PROSPECT, SALES,
                                        Solicitation, Turn)
from alkimiy_callqa.core.runner import Runner

RUNS = Path(os.environ.get("CALLQA_CORPUS", str(Path(__file__).parent / "fixtures" / "transcripts")))


# ------------------------------------------------------------------------------------------- helpers
def mk_ctx(lines, **kw) -> CallContext:
    turns = [Turn(f"T{i:03d}", i, f"00:{i:02d}", role, role, text) for i, (role, text) in enumerate(lines, 1)]
    return CallContext("c", "s", "2026-10-01T10:00:00Z", "UTC", turns, **kw)


LINE = re.compile(r"^\[(T\d+\w?) ([\d:]+)\] (SALES|PROSPECT|OTHER): (.*)$")


def load_real(run: str, **kw) -> CallContext:
    turns = []
    for line in (RUNS / run / "transcript_compact.txt").read_text(encoding="utf-8").splitlines():
        m = LINE.match(line.strip())
        if m:
            tid, ts, role, text = m.groups()
            turns.append(Turn(tid, len(turns) + 1, ts, role, role, text))
    return CallContext(run, "valentino", "2026-10-01T10:00:00Z", "UTC", turns, **kw)


def set_gap(ctx, **details):
    base = {"verdict": "present", "validation_turn": None, "restitution_span": [], "selected_A": None,
            "selected_B": None, "selected_P": None, "validated_P": None, "roadmap_blockers": [], "cost": []}
    base.update(details)
    ctx.results["GAP"] = CompetenceResult("GAP", "GAP-1.3", verdict=base["verdict"], details=base)
    return base


def span(turn, start_quote, end_quote=None, end_turn=None):
    return {"start_turn": turn, "start_quote": start_quote, "end_turn": end_turn or turn,
            "end_quote": end_quote or start_quote}


CFG = dict(P.DEFAULT_CONFIG)

# ============================================================================ Part 1: minimal pairs (annex A7)
P_CLIENTS = "I don't know where clients will come from."


def ctx_8():
    return mk_ctx([(PROSPECT, P_CLIENTS),                                         # T001 validated P
                   (SALES, "Exactly, so let me show you."),                         # T002
                   (SALES, "What's blocking you today is you don't know where clients will come from."),  # T003
                   (SALES, "So your lead generation is the issue.")])               # T004


VP8 = {"quote": P_CLIENTS, "turn": "T001", "key_expression": "where clients will come from"}


def test_8a_step1_verbatim():
    ctx = ctx_8()
    st = {"step": span("T003", "What's blocking you today is you don't know where clients will come from."),
          "other_blockers": []}
    lv, ev, info = P.decide_k1(ctx, VP8, st)
    assert info["verbatim"] is True and lv == 2 and len(ev) == 2


def test_8b_step1_paraphrased():
    ctx = ctx_8()
    st = {"step": span("T004", "So your lead generation is the issue."), "other_blockers": []}
    lv, _, info = P.decide_k1(ctx, VP8, st)
    assert info["verbatim"] is False and lv == 0 and info["failure"] == "paraphrase"   # X9


def test_k1_validated_P_with_other_blockers_is_level_1():
    ctx = ctx_8()
    st = {"step": span("T003", "What's blocking you today is you don't know where clients will come from."),
          "other_blockers": [{"quote": "your lead generation", "turn": "T004"}]}
    assert P.decide_k1(ctx, VP8, st)[0] == 1


def ctx_9():
    return mk_ctx([(SALES, "What makes that give way is having one repeatable way to bring in inquiries."),  # T001
                   (SALES, "That's the third phase of the Academy."),                                       # T002
                   (SALES, "And module 4 is pricing, module 5 is contracts, module 6 is the community."),   # T003
                   (SALES, "And on top of that, the Pricing system tells you what to charge.")])            # T004


MECHS_9 = [{"mechanism": "Acquisition", "kind": "principle", "turn": "T001",
            "quote": "What makes that give way is having one repeatable way to bring in inquiries."},
           {"mechanism": "Acquisition", "kind": "phase", "turn": "T002", "quote": "the third phase of the Academy"}]


def _mechs(ctx, ms):
    return [dict(m, pos=P._pos(ctx, m["turn"], m["quote"])) for m in ms]


def test_9a_one_mechanism():
    ctx = ctx_9()
    lv, ev, info = P.decide_k2(ctx, "Acquisition", _mechs(ctx, MECHS_9), None, 2, False, CFG)
    assert lv == 2 and info["principle"] and info["offer_phase"] and len(ev) == 2


def test_9b_recitation():
    ctx = ctx_9()
    rec = {"items": ["module 4 pricing", "module 5 contracts", "module 6 community"], "turn": "T003",
           "quote": "module 4 is pricing, module 5 is contracts, module 6 is the community"}
    lv, _, info = P.decide_k2(ctx, "Acquisition", _mechs(ctx, MECHS_9), rec, 2, False, CFG)
    assert lv == 1 and info["recitation"] and info["failure"] == "recitation"            # X10


def test_k2_second_mechanism_is_zero():
    ctx = ctx_9()
    ms = MECHS_9 + [{"mechanism": "Pricing", "kind": "principle", "turn": "T004",
                     "quote": "the Pricing system tells you what to charge"}]
    lv, _, info = P.decide_k2(ctx, "Acquisition", _mechs(ctx, ms), None, 2, False, CFG)
    assert lv == 0 and info["failure"] == "second_mechanism"


def test_k2_generic_cap_and_reference_missing_and_unknown():
    ctx = ctx_9()
    assert P.decide_k2(ctx, "Acquisition", _mechs(ctx, MECHS_9), None, 1, False, CFG)[2]["failure"] == "generic_step"
    lv, _, info = P.decide_k2(ctx, "Acquisition", _mechs(ctx, MECHS_9), None, 2, True, CFG)
    assert lv == 1 and info["failure"] == "mechanism_reference_missing"
    assert P.decide_k2(ctx, P.UNKNOWN, _mechs(ctx, MECHS_9), None, 2, False, CFG)[0] is None


def ctx_10():
    ctx = mk_ctx([(PROSPECT, "I'm at about 2K a month right now."),                           # T001 A
                  (PROSPECT, "I'd love 10K a month and to be home when my kids get back from school."),  # T002 B, N
                  (SALES, "You go from 2K a month to 10K a month, and you're home when your kids get back from school."),
                  (SALES, "You go from where you are to six figures by next summer.")])     # T004
    ctx.solicitations = [Solicitation("s1", "T001", "where do you want to be?", letter="N", answer_turns=["T002"])]
    return ctx


GAP10 = {"selected_A": {"quote": "about 2K a month", "turn": "T001", "value": 2000, "unit": "per month"},
         "selected_B": {"quote": "10K a month", "turn": "T002", "value": 10000, "unit": "per month", "horizon": None}}


def test_10a_same_unit():
    ctx = ctx_10()
    s3 = {"step": span("T003", "You go from 2K a month"),
          "A": {"value": 2000, "unit": "a month", "quote": "from 2K a month", "turn": "T003"},
          "B": {"value": 10000, "unit": "a month", "quote": "to 10K a month", "turn": "T003"},
          "deadline": None, "deadline_source": None, "image": None}
    lv, _, info = P.decide_k3(ctx, GAP10, s3)
    assert info["same_unit"] and info["his_figures"] and lv == 1 and info["failure"] == "no_image"
    # §8 worked example: with the image in his words -> 2
    s3.update(image={"quote": "you're home when your kids get back from school", "turn": "T003"},
              image_key_expression="home when my kids get back from school",
              image_source={"quote": "be home when my kids get back from school", "turn": "T002"})
    assert P.decide_k3(ctx, GAP10, s3)[0] == 2


def test_10b_other_unit_and_invented_date():
    ctx = ctx_10()
    s3 = {"step": span("T004", "You go from where you are"),
          "A": {"value": None, "unit": "where you are", "quote": "from where you are", "turn": "T004"},
          "B": {"value": 100000, "unit": "per year", "quote": "to six figures", "turn": "T004"},
          "deadline": {"quote": "by next summer", "turn": "T004"}, "deadline_source": None}
    lv, _, info = P.decide_k3(ctx, GAP10, s3)
    assert lv == 0 and info["failure"] == "other_unit"                                   # X11
    s3["A"] = {"value": 2000, "unit": "a month", "quote": "from where you are", "turn": "T004"}
    s3["B"] = {"value": 10000, "unit": "a month", "quote": "to six figures", "turn": "T004"}
    assert P.decide_k3(ctx, GAP10, s3)[2]["failure"] == "invented_date"


LIB = [{"id": "case-ftj", "name": "Student A", "consent": True,
        "start": {"value": 0, "unit": "clients", "profile": "full-time job, zero clients"}, "figures": [3]},
       {"id": "case-arch", "name": "Student B", "consent": True,
        "start": {"value": 8000, "unit": "per month", "profile": "established architect"}, "figures": [30000]}]


def ctx_11():
    ctx = mk_ctx([(PROSPECT, "I work full-time and I have no clients yet."),                       # T001
                  (SALES, "Someone who started exactly where you are, with a full-time job and no clients."),  # T002
                  (SALES, "One of our students hit 40K in her third month."),                       # T003
                  (SALES, "One of our students reached 30K a month, she was an architect.")],       # T004
                 case_library=LIB)
    return ctx


GAP11 = {"selected_A": {"quote": "I have no clients yet", "turn": "T001", "value": 0, "unit": "clients"}}


def test_11a_matched_proof():
    ctx = ctx_11()
    s4 = {"cases": [{"step": span("T002", "Someone who started exactly where you are"), "turn": "T002",
                     "quote": "Someone who started exactly where you are, with a full-time job and no clients",
                     "library_id": "case-ftj", "profile_match": True,
                     "prospect_evidence": {"quote": "I work full-time and I have no clients yet", "turn": "T001"}}]}
    lv, ev, info = P.decide_k4(ctx, GAP11, s4, CFG)
    assert lv == 2 and info["case_id"] == "case-ftj" and info["start_matches_A"] and len(ev) == 2


def test_11b_case_not_in_library_is_out_of_gap():
    ctx = ctx_11()
    ctx.phases.pitch_start = "T002"
    gap = set_gap(ctx, validation_turn="T001")
    claims = [{"kind": "case", "quote": "One of our students hit 40K in her third month", "turn": "T003",
               "library_id": "not_in_library"}]
    reasons, checked, _ = P.gate(ctx, gap, claims, [], None)
    assert reasons == ["out_of_gap_claim"] and checked[0]["source"] == "out_of_gap"     # PB-35, X12


def test_k4_best_case_and_proof_gap():
    ctx = ctx_11()
    best = {"cases": [{"step": span("T004", "One of our students"), "turn": "T004", "library_id": "case-arch",
                       "quote": "One of our students reached 30K a month", "profile_match": False}]}
    assert P.decide_k4(ctx, GAP11, best, CFG)[0] == 1                                    # §8: best case
    # A in per month, factor configured, no library case within the factor -> K4 not applicable, proof gap
    gapA = {"selected_A": {"value": 500, "unit": "per month"}}
    lv, _, info = P.decide_k4(ctx, gapA, {"cases": []}, dict(CFG, case_match_factor=2))
    assert lv is None and info["proof_gap"]
    ctx.case_library = []
    assert P.decide_k4(ctx, GAP11, best, CFG)[2]["failure"] == "case_library_missing"


def test_12a_12b_outcome_promise():
    ctx = mk_ctx([(PROSPECT, "Yes exactly."), (SALES, "We give you the system and we review every call you take."),
                  (SALES, "We'll find the clients, you just do the design.")])
    ctx.phases.pitch_start = "T002"
    gap = set_gap(ctx, validation_turn="T001")
    assert P.gate(ctx, gap, [], [], None)[0] == []                                      # 12a: allowed
    pr = [{"quote": "We'll find the clients", "turn": "T003", "action": "find_clients"}]
    assert P.gate(ctx, gap, [], pr, None)[0] == ["outcome_promise"]                     # 12b
    # the validator rejects anything outside the closed list of PB-36 actions
    assert "bad_action" in P._promises_validate({"promises": [{"quote": "We give you the system", "turn": "T002",
                                                                "action": "provide_system"}]}, ctx, "promises:T002-T003")


def _ctx_13():
    return mk_ctx([(SALES, "x")] * 160)


def test_13a_pitch_after_the_yes():
    ctx = _ctx_13()
    assert P.pitch_before_gap(ctx, {"verdict": "present", "validation_turn": "T150"}, "T152") is False


def test_13b_pitch_before_gap():
    ctx = _ctx_13()
    assert P.pitch_before_gap(ctx, {"verdict": "present", "validation_turn": "T150"}, "T140") is True
    assert P.pitch_before_gap(ctx, {"verdict": "absent", "validation_turn": None}, "T152") is True


# ============================================================================ Part 2: other decisions
def test_claims_lookup():
    ctx = mk_ctx([(PROSPECT, "I charge about 1,000 per project."), (SALES, "s")],
                 offer_reference={"price": 5800, "payment_options": ["6 x 1,097"], "guarantees": ["first client"]})
    src = P.claim_sources(ctx)
    ck = lambda **c: P.check_claim(ctx, dict({"turn": "T002"}, **c), src)
    assert ck(kind="price", quote="The investment is 5,800, or six payments of 1,097") == "offer_reference"
    assert ck(kind="figure", quote="Our students make 15K a month on average") == "out_of_gap"   # §8
    assert ck(kind="figure", quote="at 1,000 per project") == "prospect"
    assert ck(kind="figure", quote="at 1,000 per project and 3 projects that's 3,000",
              calculation=True) == "calculation"
    assert ck(kind="guarantee", quote="we guarantee your first client", guarantee_ref="first client") == "offer_reference"
    assert ck(kind="guarantee", quote="money back in 30 days", guarantee_ref=None) == "out_of_gap"


def test_k5_order_and_brevity():
    ctx = mk_ctx([(SALES, "One. Two."), (SALES, "Three."), (SALES, "A. B. C. D."), (SALES, "Four.")])
    pos = {1: (0, 0), 2: (1, 0), 3: (2, 0), 4: (3, 0)}
    ev = {k: Evidence("x", f"T00{k}", SALES) for k in pos}
    assert P.decide_k5(ctx, pos, {1: 2, 2: 1, 3: 3, 4: 1}, set(), ev, CFG)[0] == 2
    assert P.decide_k5(ctx, pos, {1: 2, 2: 1, 3: 4, 4: 1}, set(), ev, CFG)[2]["failure"] == "too_long"
    swapped = {**pos, 2: (3, 1)}
    assert P.decide_k5(ctx, swapped, {1: 1, 2: 1, 3: 1, 4: 1}, set(), ev, CFG)[2]["failure"] == "order"
    assert P.decide_k5(ctx, {1: (0, 0), 2: (1, 0)}, {1: 1, 2: 1}, set(), ev, CFG)[0] == 0
    # step 4 not applicable (proof gap): the three other steps are enough for level 2
    assert P.decide_k5(ctx, {1: (0, 0), 2: (1, 0), 3: (2, 0)}, {1: 1, 2: 1, 3: 1}, {4}, ev, CFG)[0] == 2


def test_k6_roadmap_before_price():
    ctx = mk_ctx([(PROSPECT, "I never know what to charge."),                    # T001 blocker
                  (SALES, "Story of a client."),                                   # T002 step 4
                  (SALES, "Your roadmap: step one for you is you never know what to charge."),   # T003
                  (SALES, "The investment is 5,800."),                             # T004 price
                  (SALES, "Are you ready to get started?")])                       # T005 decision
    ctx.phases.first_price, ctx.phases.decision_request = "T004", "T005"
    ctx.phases.evidence["first_price"] = Evidence("The investment is 5,800", "T004", SALES)
    gap = {"roadmap_blockers": [{"object": "pricing", "quote": "I never know what to charge", "turn": "T001"}]}
    rm = {"roadmap": span("T003", "Your roadmap"),
          "steps": [{"quote": "step one for you is you never know what to charge", "turn": "T003",
                     "key_expression": "never know what to charge",
                     "source": {"quote": "I never know what to charge", "turn": "T001"}}]}
    assert P.decide_k6(ctx, gap, rm, (1, 0))[0] == 2
    ctx.phases.first_price = "T002"                                              # §8: price before the roadmap
    assert P.decide_k6(ctx, gap, rm, (1, 0))[0] == 0
    ctx.phases.first_price = "T004"
    assert P.decide_k6(ctx, gap, None, (1, 0))[0] == 0


def test_k7_adhesion_rules():
    ctx = mk_ctx([(SALES, "What date exactly?"), (PROSPECT, "That sounds amazing."),
                  (PROSPECT, "by the end of August, I will have my first professional concept.")])
    approval = {"quote": "That sounds amazing.", "turn": "T002", "kind": "appropriation"}
    proj = {"quote": "by the end of August, I will have my first professional concept", "turn": "T003",
            "kind": "projection", "concrete": True, "gesture": {"quote": "What date exactly?", "turn": "T001"}}
    postpone = dict(proj, postpone=True)
    keep, res = P.adhesion_passages(ctx, [approval, proj])
    assert len(keep) == 1 and P.decide_k7(keep)[0] == 2                         # B4 #23: projection -> 2
    keep, res = P.adhesion_passages(ctx, [postpone])
    assert keep == [] and len(res) == 1                                         # PB-24: reserve
    assert P.decide_k7([])[0] == 0


def test_non_compliant_score_zero_and_not_applicable():
    ctx = mk_ctx([(PROSPECT, "Yes."), (SALES, "So the program is six months.")])
    assert decide(ctx, {}).status == "not_applicable"
    ctx.phases.pitch_start = "T002"
    set_gap(ctx, verdict="absent")
    r = decide(ctx, {"claims": [], "promises": [], "adhesion": []})
    assert r.verdict == "non_compliant" and r.score == 0 and r.reasons == ["pitch_before_gap"]
    assert r.details["roadmap_span"] is None and "raw_score" in r.details


# ============================================================================ Part 3: real transcripts
DEFAULTS = {"pitch.step1": {"step": None, "other_blockers": []},
            "pitch.step2": {"step": None, "mechanisms_stated": [], "recitation": None},
            "pitch.step3": {"step": None, "A": None, "B": None, "deadline": None, "deadline_source": None,
                            "image": None, "image_key_expression": None, "image_source": None},
            "pitch.step4": {"cases": []}, "pitch.roadmap": {"roadmap": None, "steps": []},
            "pitch.claims": {"claims": []}, "pitch.promises": {"promises": []}, "pitch.adhesion": {"passages": []}}


def mock(answers):
    return MockClient(answers, fallback=lambda task, unit, prompt, p: DEFAULTS[task])


@pytest.mark.parametrize("run,turn,quote,expected", [
    ("001", "T028", "really helping me figure out the marketing and getting the clients", "Acquisition"),   # B5 #31
    ("006", "T066", "how can I make marketing?", "Acquisition"),                                            # B5 #32
    ("024", "T042", "having self-doubts", "Skill"),                                                         # B5 #33
    ("078", "T086", "to be able to deliver what I know I can", "Delivery"),                                 # B5 #34
    ("087", "T240", "I don't want to do the overthinking and stuff anymore.", P.UNKNOWN),                   # B5 #35
    ("027", "T047", "I don't actively have that on hand right now", P.NOT_BLOCKER),                         # B5 #37
])
def test_b5_category_of_p_on_real_transcripts(run, turn, quote, expected):
    ctx = load_real(run)
    assert P.norm(quote) in P.norm(ctx.turn(turn).text)
    vp = {"quote": quote, "turn": turn, "key_expression": None}
    ans = {"category": expected, "quote": quote, "turn": turn, "uncovered": None}
    r = Runner(mock({("pitch.p_category", f"pcat:{turn}"): ans})).run(ctx, P.CATEGORY, f"pcat:{turn}", vp)
    assert r.status == "verified" and r.answer["category"] == expected
    # a quote that is not in the validated P turn is rejected by the code (C3), and the unit goes to review
    bad = dict(ans, quote="I am not great at marketing", turn=turn)
    if expected in P.NINE:
        r2 = Runner(mock({("pitch.p_category", f"pcat:{turn}"): bad})).run(ctx, P.CATEGORY, f"pcat:{turn}", vp)
        assert r2.status == "to_review"


def test_real_091_pitch_before_gap():
    """Call 091: no restitution validated before the screen share at T123 (B1 #2): non-compliant, score 0."""
    ctx = load_real("091")
    ctx.phases.pitch_start = "T123"
    set_gap(ctx, verdict="absent")
    res = PitchCompetence().run(ctx, Runner(mock({})))
    assert res.status == "scored" and res.verdict == "non_compliant"
    assert res.reasons == ["pitch_before_gap"] and res.score == 0
    assert "validated_P" in res.details and res.details["validated_P"] is None


def test_real_001_full_run():
    """Call 001: P = T028 (Acquisition), restitution validated at T082, screen share T085, price T113."""
    ctx = load_real("001", offer_reference={"price": 5800})
    ph = ctx.phases
    ph.pitch_start, ph.first_price, ph.pitch_end = "T085", "T113", "T113"
    ph.evidence["first_price"] = Evidence("the investment for our core program is 5,800 USD", "T113", SALES)
    vp = {"quote": "really helping me figure out the marketing and getting the clients", "turn": "T028",
          "key_expression": "getting the clients"}
    set_gap(ctx, verdict="present", validation_turn="T082", validated_P=vp,
            roadmap_blockers=[{"object": "marketing", "quote": vp["quote"], "turn": "T028", "solicitation": "s1"}])
    q91 = "You don't have a client acquisition system at all."
    chunks = P.chunks(ctx, P.DEFAULT_CONFIG["chunk_turns"])
    claims_uid = next(f"claims:{a}-{b}" for a, b in chunks if ctx.n(a) <= ctx.n("T113") <= ctx.n(b))
    answers = {
        ("pitch.p_category", "pcat:T028"): {"category": "Acquisition", "turn": "T028",
                                            "quote": "figure out the marketing and getting the clients"},
        ("pitch.step1", "step1:T085"): {"step": span("T091", q91), "other_blockers": []},
        ("pitch.claims", claims_uid): {"claims": [{"kind": "price", "turn": "T113",
                                                   "quote": "the investment for our core program is 5,800 USD"}]},
    }
    res = PitchCompetence().run(ctx, Runner(mock(answers)))
    assert res.status == "scored" and res.verdict == "compliant"
    assert res.details["validated_P"]["category"] == "Acquisition"
    items = {i.id: i for i in res.items}
    assert items["K1"].level == 0 and "paraphrase" in items["K1"].note            # paraphrase of "getting the clients"
    assert items["K4"].level is None                                               # case library missing
    assert {"mechanism_reference_missing", "case_library_missing"} <= set(res.flags)
    assert res.details["claims"][0]["source"] == "offer_reference"
    assert res.score == 0 and res.details["roadmap_span"] is None                  # no v2 staircase in old calls
    assert res.details["diagnostics"]["talk_share"] > 0.5


def test_real_087_unknown_category_spreads_k2():
    """Call 087: P = T240 "overthinking" -> P_category_unknown; K2 not applicable, case reported."""
    ctx = load_real("087", case_library=LIB)
    ctx.phases.pitch_start = "T273"
    vp = {"quote": "I don't want to do the overthinking and stuff anymore.", "turn": "T240",
          "key_expression": "overthinking"}
    set_gap(ctx, verdict="present", validation_turn="T241", validated_P=vp)
    answers = {("pitch.p_category", "pcat:T240"): {"category": P.UNKNOWN, "quote": vp["quote"], "turn": "T240",
                                                   "uncovered": "overthinking fits none of the nine"}}
    res = PitchCompetence().run(ctx, Runner(mock(answers)))
    items = {i.id: i for i in res.items}
    assert items["K2"].level is None and {"P_category_unknown", "uncovered_case"} <= set(res.flags)
    assert res.verdict == "compliant" and res.status == "scored"


def test_full_staircase_synthetic_decide():
    """A compliant v2 pitch: 4 steps in order, roadmap, price, decision, adhesion -> high score."""
    lines = [
        (PROSPECT, "I'm at about 2K a month right now."),                                            # T001 A
        (PROSPECT, "I'd love 10K a month and to be home when my kids get back from school."),         # T002 B (N)
        (PROSPECT, "I don't know what to charge."),                                                  # T003 P
        (PROSPECT, "And I never know where clients will come from."),                                 # T004 blocker 2
        (SALES, "So you're at 2K, you want 10K, and you don't know what to charge. Right?"),          # T005 restitution
        (PROSPECT, "Exactly."),                                                                      # T006 validation
        (SALES, "Let me show you the program."),                                                     # T007 pitch start
        (SALES, "What's blocking you today is you don't know what to charge."),                      # T008 step 1
        (SALES, "What makes that give way is pricing from the value of the room. That's the second phase of the Academy."),  # T009 step 2
        (SALES, "You go from 2K a month to 10K a month, and you're home when your kids get back from school."),  # T010
        (SALES, "Someone who started exactly where you are, at 2K a month."),                       # T011 step 4
        (PROSPECT, "So I'd have someone checking my prices on every project, that's what I need."),  # T012 adhesion
        (SALES, "Your roadmap: step one for you is you never know where clients will come from."),  # T013 roadmap
        (PROSPECT, "If I start in November I could have my first paid project by March."),           # T014 adhesion
        (SALES, "The investment is 5,800."),                                                         # T015 price
        (SALES, "Are you ready to get started?"),                                                    # T016 decision
    ]
    lib = [{"id": "c2k", "name": "Student C", "consent": True, "start": {"value": 2000, "unit": "per month"},
            "figures": [2000, 9000]}]
    ref = {"price": 5800, "mechanisms": {"Pricing": {"principle": "configured by the offer owner",
                                                     "phase": "configured", "cues": []}}}
    ctx = mk_ctx(lines, offer_reference=ref, case_library=lib)
    ctx.solicitations = [Solicitation("n1", "T001", "where?", letter="N", answer_turns=["T002"])]
    ph = ctx.phases
    ph.pitch_start, ph.first_price, ph.decision_request, ph.pitch_end = "T007", "T015", "T016", "T015"
    ph.evidence["first_price"] = Evidence("The investment is 5,800", "T015", SALES)
    set_gap(ctx, validation_turn="T006",
            validated_P={"quote": "I don't know what to charge.", "turn": "T003", "key_expression": "what to charge"},
            selected_A={"quote": "about 2K a month", "turn": "T001", "value": 2000, "unit": "per month"},
            selected_B={"quote": "10K a month", "turn": "T002", "value": 10000, "unit": "per month", "horizon": None},
            roadmap_blockers=[{"object": "acquisition", "quote": "never know where clients will come from",
                               "turn": "T004", "solicitation": "p1"}])
    answers = {
        "category": {"category": "Pricing", "quote": "what to charge", "turn": "T003"},
        "step1": {"step": span("T008", "What's blocking you today", "you don't know what to charge."), "other_blockers": []},
        "step2": {"step": span("T009", "What makes that give way", "second phase of the Academy"),
                  "mechanisms_stated": [
                      {"mechanism": "Pricing", "kind": "principle", "turn": "T009",
                       "quote": "What makes that give way is pricing from the value of the room."},
                      {"mechanism": "Pricing", "kind": "phase", "turn": "T009",
                       "quote": "That's the second phase of the Academy."}], "recitation": None},
        "step3": {"step": span("T010", "You go from 2K a month"),
                  "A": {"value": 2000, "unit": "a month", "quote": "from 2K a month", "turn": "T010"},
                  "B": {"value": 10000, "unit": "a month", "quote": "to 10K a month", "turn": "T010"},
                  "deadline": None, "deadline_source": None,
                  "image": {"quote": "you're home when your kids get back from school", "turn": "T010"},
                  "image_key_expression": "home when my kids get back from school",
                  "image_source": {"quote": "be home when my kids get back from school", "turn": "T002"}},
        "step4": {"cases": [{"step": span("T011", "Someone who started"), "turn": "T011", "library_id": "c2k",
                             "quote": "Someone who started exactly where you are, at 2K a month",
                             "profile_match": False}]},
        "roadmap": {"roadmap": span("T013", "Your roadmap"),
                    "steps": [{"quote": "step one for you is you never know where clients will come from",
                               "turn": "T013", "key_expression": "never know where clients will come from",
                               "source": {"quote": "never know where clients will come from", "turn": "T004"}}]},
        "claims": [{"kind": "price", "quote": "The investment is 5,800", "turn": "T015"},
                   {"kind": "case", "quote": "Someone who started exactly where you are", "turn": "T011",
                    "library_id": "c2k"},
                   {"kind": "figure", "quote": "at 2K a month", "turn": "T011"}],
        "promises": [],
        "adhesion": [{"quote": "So I'd have someone checking my prices on every project", "turn": "T012",
                      "kind": "appropriation"},
                     {"quote": "If I start in November I could have my first paid project by March", "turn": "T014",
                      "kind": "projection", "concrete": True}],
    }
    r = decide(ctx, answers, {"case_match_factor": 1.5})
    lv = {i.id: i.level for i in r.items}
    assert r.verdict == "compliant", r.reasons
    assert lv == {"K1": 2, "K2": 2, "K3": 2, "K4": 2, "K5": 2, "K6": 2, "K7": 2}, [(i.id, i.level, i.note) for i in r.items]
    assert r.score == 100 and r.details["roadmap_span"] == ["T013", "T013"] and r.details["order_ok"]
    # same pitch with an invented student average -> gate fails, score 0, items kept as diagnostics
    answers["claims"].append({"kind": "figure", "quote": "Our students make 15K a month on average", "turn": "T011"})
    ctx.turns[10].text += " Our students make 15K a month on average."
    r2 = decide(ctx, answers, {"case_match_factor": 1.5})
    assert r2.verdict == "non_compliant" and r2.score == 0 and r2.reasons == ["out_of_gap_claim"]
    assert r2.details["raw_score"] == 100
