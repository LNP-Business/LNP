"""Tests of the Objection Removal module (OBJ-1.1).

Part 1: Annex A minimal pairs and added rules as pure decision tests (no model).
Part 2: bounding on synthetic calls with mock answers (OB-10 minimal pair 8a/8b, OB-22, OB-11).
Part 3: Annex B cases on the real transcripts with mock model answers.
"""
from __future__ import annotations
import os

import re
from pathlib import Path

import pytest

from alkimiy_callqa.core.llm import MockClient
from alkimiy_callqa.core.models import CallContext, Evidence, PROSPECT, SALES, Turn
from alkimiy_callqa.core.runner import Runner
from alkimiy_callqa.competences import objections as O
from alkimiy_callqa.competences.objections import ObjectionsCompetence

RUNS = Path(os.environ.get("CALLQA_CORPUS", str(Path(__file__).parent / "fixtures" / "transcripts")))


# ----------------------------------------------------------------------------------------------- helpers
def synth(lines: list[tuple[str, str]], **phases) -> CallContext:
    turns = [Turn(f"T{i:03d}", i, f"00:{i:02d}", r, r, txt) for i, (r, txt) in enumerate(lines, 1)]
    ctx = CallContext("synthetic", "s1", "2026-10-01T10:00:00Z", "UTC", turns, offer_reference={"price": 5800})
    for k, v in phases.items():
        setattr(ctx.phases, k, v)
    return ctx


def load(n: str, **phases) -> CallContext:
    turns = []
    for line in (RUNS / n / "transcript_compact.txt").read_text(encoding="utf-8").splitlines():
        m = re.match(r"^\[(T\d+[a-z]?) ([\d:]+)\] (SALES|PROSPECT|OTHER): ?(.*)$", line.strip())
        if m:
            turns.append(Turn(m[1], len(turns) + 1, m[2], m[3], m[3], m[4]))
    ctx = CallContext(n, "valentino", "2026-07-01T10:00:00Z", "UTC", turns, offer_reference={"price": 5800})
    for k, v in phases.items():
        setattr(ctx.phases, k, v)
    return ctx


def defaults(ctx: CallContext):
    """Fallback answers: 'nothing found' for every unit not mocked explicitly (quotes built from the prompt)."""
    def fb(task_id, unit_id, prompt, pass_no):
        if task_id == "obj.nominate":
            return {"nominations": []}
        if task_id == "obj.resistance":
            return {"exclusion": "none", "doubts": [], "denied_subjects": [], "deadline": None,
                    "label_contradicted": False}
        if task_id == "obj.topic":
            t = ctx.turn(unit_id.split(":")[-1])
            return {"new_subject": True, "receive_and_leave": False, "quote": " ".join(t.text.split()[:3])}
        if task_id == "obj.acknowledge":
            m = re.search(r'FIRST SENTENCE: "(.*)"\s*$', prompt, re.S)
            return {"receiving_marker": False, "neutral_reformulation": False, "elliptical_open_question": False,
                    "contradiction": False, "quote": " ".join(m.group(1).split()[:10])}
        if task_id == "obj.isolate":
            return {"isolate": False, "turn": None, "quote": None}
        if task_id == "obj.explore":
            return {"explore": False, "open_question": False, "elliptical": False, "answered_with_content": False}
        if task_id == "obj.gesture":
            return {k: False for k in ("answer_given", "answer_tied_to_prospect", "support_or_framework",
                                       "proof_reversibility_guarantee", "cost_of_inaction_question",
                                       "cost_stated_by_prospect", "mindset_reframe", "offer_argument")}
        if task_id == "obj.resolution":
            m = re.search(r"<REACTION> \[(T\w+) [^\]]*\] \w+: (.*)", prompt)
            return {"reaction_kind": "agreement_only", "turn": m.group(1),
                    "quote": " ".join(m.group(2).split()[:3]), "specific_element": False,
                    "content_first_stated_by_sales": False}
        if task_id == "obj.prevention":
            return {k: None for k in O.PROSPECT_FACTS + O.SALES_FACTS}
        raise KeyError((task_id, unit_id))
    return fb


def run(ctx: CallContext, answers: dict):
    client = MockClient(answers, fallback=defaults(ctx))
    res = ObjectionsCompetence().run(ctx, Runner(client))
    return res, client


def doubt(quote, *subjects, exclusion="none", denied=(), deadline=None):
    return {"exclusion": exclusion, "doubts": [{"quote": quote, "subjects": list(subjects)}] if quote else [],
            "denied_subjects": list(denied), "deadline": deadline, "label_contradicted": False}


def ep_by_turn(res, turn):
    return [e for e in res.details["episodes"] if e["resistance"]["turn"] == turn]


def lvl(ep, iid):
    return next(i["level"] for i in ep["items"] if i["id"] == iid)


# =============================================================================================== Part 1
# Annex A6 minimal pairs (pure decisions)
def test_pair1_information_request_vs_reserve():
    t = Turn("T010", 10, "01:00", "P", PROSPECT, "How long is it? Because honestly I don't have much time.")
    assert O.marker_hits("How long is the program?") == []                     # 1a: no candidate
    assert "objection_time" in O.marker_hits(t.text)                          # 1b: nominated
    r, _, _ = O.resistances_from_answer(doubt(None, exclusion="information_request"), t)
    assert r == []                                                             # 1a: OB-2
    r, _, _ = O.resistances_from_answer(doubt("I don't have much time", "time"), t)
    assert [(x.nature, x.subtype) for x in r] == [("objection", "time")]       # 1b


def test_pair2_offer_doubt_vs_self_doubt():
    assert O.nature_of_subjects(["offer_trust"]) == ("objection", "trust_in_offer")          # 2a
    assert O.nature_of_subjects(["self_capability"]) == ("anxiety_capability", "capability")  # 2b
    assert O.marker_hits("I'm not sure it works.") and O.marker_hits("I'm not sure I can do it.")


def test_ob3_order_resource_first():
    # Annex B case 5: "I'm scared of doing this step because of the money" -> test 1 comes first
    assert O.nature_of_subjects(["self_capability", "money_available"]) == ("objection", "money_available")
    assert O.nature_of_subjects(["postponement", "own_decision"]) == ("anxiety_choice", "choice")


def test_pair3_postponement_vs_external_deadline():
    t = Turn("T020", 20, "02:00", "P", PROSPECT, "Not before January, I'm moving in December.")
    r, _, _ = O.resistances_from_answer(doubt("Not right now, maybe after the holidays", "postponement"), t)
    assert [(x.nature, x.subtype) for x in r] == [("inertia", "timing")]       # 3a
    r, dl, _ = O.resistances_from_answer(
        doubt("Not before January", "postponement", exclusion="external_deadline",
              deadline={"quote": "I'm moving in December", "binding": True}), t)
    assert r == [] and dl == {"turn": "T020", "quote": "I'm moving in December", "binding": True}   # 3b, X2


def test_ob25_external_reason_that_limits_time():
    t = Turn("T030", 30, "03:00", "P", PROSPECT, "It's wedding season, I'm booked until October.")
    r, dl, _ = O.resistances_from_answer(
        doubt("I'm booked until October", "time", exclusion="external_deadline",
              deadline={"quote": "booked until October", "binding": True}), t)
    assert [(x.nature, x.subtype) for x in r] == [("objection", "time")] and dl["binding"]


def test_pair4_circuit_fact_vs_co_decider():
    t = Turn("T040", 40, "04:00", "P", PROSPECT, "I need to talk to my husband first.")
    assert O.resistances_from_answer(doubt(None, exclusion="circuit_fact"), t)[0] == []          # 4a
    r, _, _ = O.resistances_from_answer(doubt("I need to talk to my husband first", "co_decider"), t)
    assert [(x.nature, x.subtype) for x in r] == [("objection", "co_decider")]                 # 4b


def test_pair5_acknowledge():
    assert O.acknowledged("I hear you.", {"receiving_marker": True})                            # 5a
    assert not O.acknowledged("But think about what it's costing you not to do it.",
                              {"receiving_marker": True})                                       # 5b, X5
    assert not O.acknowledged("No, we've only got 100 students and we don't beg our clients to leave reviews.",
                              {"receiving_marker": False})                                      # case 22
    assert O.acknowledged("Compared to what?", {"elliptical_open_question": True})              # OB-20


def _episode_ctx():
    ctx = synth([(PROSPECT, "I don't have the money right now."),                       # T001
                 (SALES, "I hear you. Apart from the money, is anything else holding you back?"),  # T002
                 (PROSPECT, "No, it's really just that."),                               # T003
                 (SALES, "We can split it in instalments of 900 a month."),               # T004
                 (PROSPECT, "Okay, 900 a month I can actually do."),                      # T005
                 (SALES, "So the payment plan works for you, right?"),                    # T006
                 (PROSPECT, "Yeah."),                                                     # T007
                 (SALES, "Let's book your onboarding.")])                                 # T008
    r = O.Resistance("T001", "T001", PROSPECT, "I don't have the money right now", "objection", "money_available",
                     ["T001"])
    ep = O.Episode("E1", r, response=["T002", "T004", "T006"], reaction=["T003", "T005", "T007"],
                   topic_change="T008", end_turn="T008", end_reason="topic_change")
    return ctx, ep


def test_pair5a_isolation_before_answer_and_x6():
    ctx, ep = _episode_ctx()
    iso = {"isolate": True, "turn": "T002", "quote": "Apart from the money, is anything else holding you back?"}
    ans = Evidence("We can split it in instalments of 900 a month", "T004", SALES)
    assert O.isolation_valid(ctx, ep, iso, ans)
    late = {"isolate": True, "turn": "T006", "quote": "So the payment plan works for you"}
    assert not O.isolation_valid(ctx, ep, late, ans)                                   # X6: after the answer


def test_pair6_resolution_own_words_vs_prompted():
    ctx, ep = _episode_ctx()
    a = {"reaction_kind": "states_no_longer_holds", "turn": "T005", "quote": "900 a month I can actually do",
         "content_first_stated_by_sales": False}
    assert O.resolution_level(ctx, ep, a)[0] == "resolved"                             # 6a
    b = {"reaction_kind": "states_no_longer_holds", "turn": "T007", "quote": "Yeah.",
         "content_first_stated_by_sales": True}
    assert O.resolution_level(ctx, ep, b)[0] == "acknowledged"                         # 6b, X3
    c = dict(b, content_first_stated_by_sales=False)
    assert O.resolution_level(ctx, ep, c)[0] == "acknowledged"                         # C3 rule 5: approval only
    d = {"reaction_kind": "repeats_or_reinforces", "turn": "T005", "quote": "900 a month"}
    assert O.resolution_level(ctx, ep, d)[0] == "persisting"


def test_ob23_commitment_to_proposal():
    ctx, ep = _episode_ctx()
    a = {"reaction_kind": "commits_to_proposal", "turn": "T005", "quote": "900 a month I can actually do",
         "specific_element": True}
    assert O.resolution_level(ctx, ep, a)[0] == "resolved"
    assert O.resolution_level(ctx, ep, dict(a, turn="T007", quote="Yeah.", specific_element=False))[0] == "acknowledged"


def test_pair7_matching_gesture_on_anxiety():
    lv, _ = O.h1_level("anxiety_capability", {"support_or_framework": True}, {})
    assert lv == 2                                                                     # 7a
    lv, tags = O.h1_level("anxiety_capability", {"offer_argument": True}, {})
    assert lv == 0 and "mismatch" in tags                                              # 7b
    lv, tags = O.h1_level("anxiety_capability", {"support_or_framework": True, "offer_argument": True}, {})
    assert lv == 1 and "partial_wrong_kind" in tags                                    # OB-16 partial
    lv, tags = O.h1_level("anxiety_capability", {"mindset_reframe": True}, {})
    assert lv == 1 and "mindset_reframe" in tags                                       # OB-21
    assert O.h1_level("anxiety_choice", {"cost_of_inaction_question": True}, {})[0] == 0   # case 18
    assert O.h1_level("anxiety_choice", {"proof_reversibility_guarantee": True}, {})[0] == 2
    assert O.h1_level("inertia", {"cost_of_inaction_question": True, "cost_stated_by_prospect": True}, {})[0] == 2
    assert O.h1_level("inertia", {"cost_of_inaction_question": True}, {})[0] == 0


def test_objection_gesture_and_h3():
    g = {"answer_given": True, "answer_tied_to_prospect": True}
    assert O.h1_level("objection", g, {"ack": True, "isolate": True, "explore": True})[0] == 2
    assert O.h1_level("objection", g, {"ack": True, "isolate": False, "explore": True})[0] == 1
    assert O.h1_level("objection", {"answer_given": True}, {"ack": True, "isolate": True, "explore": True})[0] == 0
    assert O.h3_level("objection", True, True, True) == 2
    assert O.h3_level("objection", False, True, False) == 1                            # case 15
    assert O.h3_level("objection", False, False, False) == 0
    assert O.h3_level("inertia", False, True, True) == 2 and O.h3_level("inertia", True, False, False) == 0


def test_explore_reuse_x7_and_ob20():
    ctx = synth([(PROSPECT, "That's quite a lot, right? Sure."),                          # T001
                 (SALES, "Compared to what, though?"),                                    # T002
                 (PROSPECT, "Hmm."),                                                      # T003
                 (SALES, "It's a lot. Compared to what?"),                                # T004
                 (PROSPECT, "Compared to my savings, it is half of them.")])              # T005
    r = O.Resistance("T001", "T001", PROSPECT, "That's quite a lot", "objection", "price", ["T001"])
    ep = O.Episode("E1", r, response=["T002", "T004"], reaction=["T003", "T005"])
    late_ellipsis = {"explore": True, "turn": "T004", "quote": "Compared to what?", "open_question": True,
                     "elliptical": True, "answered_with_content": True, "answer_turn": "T005"}
    assert O.exploration(ctx, ep, late_ellipsis, {"T001"}) == (False, False)           # X7: no reuse, not right after
    reuse = dict(late_ellipsis, quote="It's a lot. Compared to what?", elliptical=False)
    assert O.exploration(ctx, ep, reuse, {"T001"}) == (True, True)                      # OB-15 reuse ("lot")
    first = {"explore": True, "turn": "T002", "quote": "Compared to what, though?", "open_question": True,
             "elliptical": True, "answered_with_content": False, "answer_turn": "T003"}
    assert O.exploration(ctx, ep, first, {"T001"}) == (True, False)                     # OB-20, approval-only answer
    assert O.exploration(ctx, ep, dict(reuse, open_question=False), {"T001"}) == (False, False)   # X7 closed
    assert O.exploration(ctx, ep, reuse, {"T001", "T005"}) == (True, False)             # case 13: new resistance


def test_ob24_denied_anxiety():
    t = Turn("T212", 212, "47:13", "P", PROSPECT, "No, I'm not scared. Not scared, because I dove into this course "
             "already, like in the past. But it's just the amount. Okay, got it.")
    ans = {"exclusion": "none", "doubts": [{"quote": "But it's just the amount", "subjects": ["price"]},
                                           {"quote": "No, I'm not scared", "subjects": ["self_capability"]}],
           "denied_subjects": ["self_capability"]}
    r, _, flags = O.resistances_from_answer(ans, t)
    assert [(x.nature, x.subtype) for x in r] == [("objection", "price")] and flags


def test_ob4_two_natures_two_episodes():
    t = Turn("T050", 50, "05:00", "P", PROSPECT, "I can't afford it and honestly I'm scared I'll quit again.")
    ans = {"exclusion": "none", "doubts": [{"quote": "I can't afford it", "subjects": ["money_available"]},
                                           {"quote": "I'm scared I'll quit again", "subjects": ["self_capability"]}]}
    r, _, _ = O.resistances_from_answer(ans, t)
    assert sorted(x.nature for x in r) == ["anxiety_capability", "objection"] and {x.start for x in r} == {"T050"}


def test_ob26_label_contradicted():
    t = Turn("T060", 60, "06:00", "P", PROSPECT, "Our program costs 5,800 and I'm the mentor.")
    r, _, flags = O.resistances_from_answer(dict(doubt("costs 5,800", "price"), label_contradicted=True), t)
    assert r == [] and flags == ["attribution_doubtful:T060"]


def test_ob5_merge_over_backchannel():
    ctx = synth([(PROSPECT, "It's too expensive."), (SALES, "Mm-hmm."), (PROSPECT, "Way too expensive for me."),
                 (SALES, "Okay, let me explain the payment options in detail.")])
    a = O.Resistance("T001", "T001", PROSPECT, "too expensive", "objection", "price", ["T001"])
    b = O.Resistance("T003", "T003", PROSPECT, "Way too expensive", "objection", "price", ["T003"])
    m = O.merge_consecutive(ctx, [a, b])
    assert len(m) == 1 and m[0].turns == ["T001", "T003"] and m[0].last == "T003"


def test_ob8_condition_a():
    ref = O.content_words("It's just such a significant investment")
    assert not O.topic_change_condition_a("So about that investment, here is how it pays back.", ref)
    assert O.topic_change_condition_a("Let's share my screen and look at the workbook.", ref)
    assert O.topic_change_condition_a("Where do you want to go from here?", ref)      # (a) holds, model reads (b)
    assert O.is_backchannel(Turn("T9", 9, "", "S", SALES, "Okay."))                     # never asked, never a change


def test_prevention_ob18_ob19_x8():
    ctx = synth([(SALES, "I assume your husband makes the decisions, correct?"), (PROSPECT, "Yes."),        # T001-2
                 (PROSPECT, "I ask him, but it's my final decision."),                                    # T003
                 (SALES, "The investment is 5,800."),                                                     # T004
                 (PROSPECT, "I have 12,000 in savings.")], first_price="T004")                            # T005
    assert O.prevention_fact_ok(ctx, "decision_maker", {"turn": "T002", "quote": "Yes."}, "T004") == \
        (False, "approval_only")                                                         # OB-19
    assert O.prevention_fact_ok(ctx, "decision_maker", {"turn": "T001", "quote": "your husband makes the decisions"},
                                "T004") == (False, "sales_supposition")                 # X8
    assert O.prevention_fact_ok(ctx, "budget", {"turn": "T005", "quote": "12,000 in savings"}, "T004") == \
        (False, "after_first_price")                                                     # OB-18
    items, kept, _ = O.prevention_items(ctx, {"decision_maker": {"turn": "T003", "quote": "it's my final decision"},
                                              "influencers": {"turn": "T003", "quote": "I ask him"},
                                              "budget": {"turn": "T005", "quote": "12,000 in savings"}}, "T004")
    lv = {i.id: i.level for i in items}
    assert lv == {"R1": 2, "R2": 0, "R3": 2} and items[2].note == "not_triggered"


def test_r3_past_attempt():
    ctx = synth([(PROSPECT, "I already paid for a course and did nothing with it."),     # T001
                 (SALES, "What stopped you from finishing that course?"),                 # T002
                 (PROSPECT, "Nobody followed up with me."),                               # T003
                 (SALES, "Here a mentor reviews every project you submit."),              # T004
                 (SALES, "The investment is 5,800.")], first_price="T005")
    f = {"past_attempt": {"turn": "T001", "quote": "I already paid for a course"},
         "past_attempt_explored": {"turn": "T002", "quote": "What stopped you from finishing"}}
    assert {i.id: i.level for i in O.prevention_items(ctx, f, "T005")[0]}["R3"] == 1
    f["difference_stated"] = {"turn": "T004", "quote": "a mentor reviews every project"}
    assert {i.id: i.level for i in O.prevention_items(ctx, f, "T005")[0]}["R3"] == 2
    assert {i.id: i.level for i in O.prevention_items(ctx, {"past_attempt": f["past_attempt"]}, "T005")[0]}["R3"] == 0


def test_applicability_and_combination():
    assert O.applicability(0, False) == ("not_applicable", "not_applicable")
    assert O.applicability(0, True) == ("not_applicable", "scored")
    assert O.applicability(2, False) == ("scored", "not_applicable")
    assert O.combine(50, 100) == 65 and O.combine(None, 80) == 80 and O.combine(40, None) == 40
    e1 = O.Episode("E1", O.Resistance("T1", "T1", PROSPECT, "", "objection", "price"), score=100)
    e2 = O.Episode("E2", O.Resistance("T2", "T2", PROSPECT, "", "inertia", "timing"), score=0)
    assert O.handling_score([e1, e2]) == 40                       # 1 x 100 + 1.5 x 0 over 2.5


# =============================================================================================== Part 2
def test_pair8a_latent_and_8b_not_latent():
    lines = [(SALES, "So tell me about your goals."),                                      # T001
             (PROSPECT, "Maybe later, it's not the right time for me."),                    # T002
             (SALES, "Let's move on to the curriculum and the modules."),                   # T003
             (PROSPECT, "Okay."),                                                           # T004
             (SALES, "Module one covers design fundamentals and color theory.")]            # T005
    ctx = synth(lines, first_price="T001")                 # OB-27: resistances are read after the first price
    ans = {("obj.resistance", "res:T002"): doubt("it's not the right time for me", "postponement"),
           ("obj.topic", "topic:T002.inertia:T003"): {"new_subject": True, "receive_and_leave": False,
                                                       "quote": "Let's move on to the curriculum"}}
    res, _ = run(ctx, ans)
    e = ep_by_turn(res, "T002")[0]
    assert e["reaction"]["level"] == "latent" and e["latent_rule"] == "no_reaction" and lvl(e, "H4") == 0   # 8a
    assert res.status == "scored" and res.details["prevention_status"] == "scored"

    lines8b = [(SALES, "So tell me about your goals."),                                     # T001
               (PROSPECT, "Maybe later, it's not the right time for me."),                  # T002
               (SALES, "What makes it not the right time?"),                                # T003
               (PROSPECT, "Work is crazy and I keep postponing everything I want to do."),  # T004
               (SALES, "And if nothing changes, where are you in a year with that?"),       # T005
               (PROSPECT, "Same place, still stuck, another year lost."),                   # T006
               (SALES, "How does that feel when you say it out loud?"),                     # T007
               (PROSPECT, "Honestly, it feels terrible, I don't want that."),               # T008
               (SALES, "Let's look at the curriculum and the modules.")]                    # T009
    ctx = synth(lines8b, first_price="T001")
    ans = {("obj.resistance", "res:T002"): doubt("it's not the right time for me", "postponement"),
           ("obj.topic", "topic:T002.inertia:T003"): {"new_subject": False, "receive_and_leave": False},
           ("obj.topic", "topic:T002.inertia:T005"): {"new_subject": False, "receive_and_leave": False},
           ("obj.topic", "topic:T002.inertia:T007"): {"new_subject": False, "receive_and_leave": False},
           ("obj.topic", "topic:T002.inertia:T009"): {"new_subject": True, "receive_and_leave": False,
                                                       "quote": "Let's look at the curriculum"},
           ("obj.gesture", "gest:T002.inertia"): {
               "answer_given": False, "answer_tied_to_prospect": False, "support_or_framework": False,
               "proof_reversibility_guarantee": False, "cost_of_inaction_question": True,
               "cost_stated_by_prospect": True, "prospect_cost_turn": "T006",
               "prospect_cost_quote": "Same place, still stuck, another year lost", "mindset_reframe": False,
               "offer_argument": False, "gesture_turn": "T005",
               "gesture_quote": "if nothing changes, where are you in a year"},
           ("obj.explore", "exp:T002.inertia"): {"explore": True, "turn": "T003",
                                                 "quote": "What makes it not the right time?", "open_question": True,
                                                 "elliptical": False, "answered_with_content": True,
                                                 "answer_turn": "T004", "answer_quote": "Work is crazy"},
           ("obj.resolution", "resol:T002.inertia"): {"reaction_kind": "states_no_longer_holds", "turn": "T008",
                                                      "quote": "it feels terrible, I don't want that",
                                                      "specific_element": False,
                                                      "content_first_stated_by_sales": False}}
    res, client = run(ctx, ans)
    e = ep_by_turn(res, "T002")[0]
    assert not e["latent_rule"] and e["reaction_turns"] == ["T004", "T006", "T008"]          # 8b
    assert e["topic_change"] == "T009" and e["response_turns"] == ["T003", "T005", "T007"]
    assert lvl(e, "H1") == 2 and lvl(e, "H3") == 2 and lvl(e, "H4") == 2
    assert ("obj.topic", "topic:T002.inertia:T009", 1) in client.calls


def test_recurrence_in_call_ob11():
    lines = [(SALES, "The investment is 5,800."),                         # T001, OB-27: the first price
             (PROSPECT, "It's too expensive for me."),                    # T002
             (SALES, "I understand. Compared to what?"),                   # T003
             (PROSPECT, "Compared to a normal course online."),            # T004
             (SALES, "Let's look at the next module together now."),      # T005
             (PROSPECT, "Sure."),                                          # T006
             (SALES, "Module two covers lighting plans."),                 # T007
             (PROSPECT, "Honestly it's still too expensive."),             # T008
             (SALES, "Let's book a call with your partner.")]              # T009
    ctx = synth(lines, first_price="T001")
    ans = {("obj.resistance", "res:T002"): doubt("too expensive for me", "price"),
           ("obj.resistance", "res:T008"): doubt("it's still too expensive", "price"),
           ("obj.topic", "topic:T002.objection:T003"): {"new_subject": False, "receive_and_leave": False}}
    res, _ = run(ctx, ans)
    e1, e2 = ep_by_turn(res, "T002")[0], ep_by_turn(res, "T008")[0]
    assert e1["end_reason"] == "topic_change" and e1["topic_change"] == "T005"
    assert e2["recurrence_of"] == e1["id"] and e1["recurs_later"] and lvl(e1, "H5") == 0 and lvl(e2, "H5") == 2


def test_recurrence_from_previous_call_of_cycle():
    ctx = synth([(SALES, "The investment is 5,800."), (PROSPECT, "It's too expensive for me."),
                 (SALES, "Let's book the next step.")], first_price="T001")
    ctx.prior_inputs = [{"kind": "objections_episodes", "call_id": "C1",
                         "episodes": [{"id": "E1", "nature": "objection", "subtype": "price"}]}]
    ans = {("obj.resistance", "res:T002"): doubt("too expensive for me", "price")}
    res, _ = run(ctx, ans)
    assert ep_by_turn(res, "T002")[0]["recurrence_of"] == "C1:E1"
    assert res.details["recurs_from_previous_call"][0]["id"] == "E1"


def test_no_resistance_price_given_scores_prevention_only():
    ctx = synth([(SALES, "Who decides on this investment?"), (PROSPECT, "It's my decision, nobody else's."),
                 (SALES, "The investment is 5,800."), (PROSPECT, "Sounds good, let's start.")], first_price="T003")
    ans = {("obj.prevention", "prevention:pre_price"): {
        "decision_maker": {"turn": "T002", "quote": "It's my decision"},
        "influencers": {"turn": "T002", "quote": "nobody else's"}, "budget": None, "deadline": None,
        "past_attempt": None, "past_attempt_explored": None, "difference_stated": None}}
    res, _ = run(ctx, ans)
    assert res.status == "scored" and res.details["handling_status"] == "not_applicable"
    assert res.score == res.details["prevention_score"] == round(100 * (40 * 1 + 40 * 0 + 20 * 1) / 100)


def test_no_resistance_no_price_not_applicable():
    ctx = synth([(SALES, "How was your week?"), (PROSPECT, "Great, thanks for asking.")])
    res, _ = run(ctx, {})
    assert res.status == "not_applicable" and res.score is None


def test_to_review_candidate_blocks_not_applicable():
    ctx = synth([(SALES, "How was your week?"), (PROSPECT, "Honestly it's too expensive.")], first_price="T001")
    bad = {"exclusion": "none", "doubts": [{"quote": "not in the turn at all", "subjects": ["price"]}]}
    res, _ = run(ctx, {("obj.resistance", "res:T002"): bad})
    assert res.status == "to_review" and "to_review:res:T002" in res.flags


def test_ob27_nothing_before_the_first_price_is_an_objection():
    lines = [(SALES, "So what holds you back today?"),                    # T001
             (PROSPECT, "Honestly I'm scared it's too expensive."),       # T002, before the price: never read
             (SALES, "The investment is 5,800."),                         # T003, first price
             (PROSPECT, "It's too expensive for me."),                    # T004
             (SALES, "Let's book the next step.")]                        # T005
    ctx = synth(lines, first_price="T003")
    ans = {("obj.resistance", "res:T002"): doubt("it's too expensive", "price"),
           ("obj.resistance", "res:T004"): doubt("too expensive for me", "price")}
    res, client = run(ctx, ans)
    assert [e["resistance"]["turn"] for e in res.details["episodes"]] == ["T004"]
    assert not any(c[1] == "res:T002" for c in client.calls)                  # not even asked
    ctx = synth(lines)                                                         # no price: no episode at all
    res, _ = run(ctx, ans)
    assert res.details["episodes"] == [] and res.status == "not_applicable"


# =============================================================================================== Part 3
# Annex B cases on real transcripts.
def test_annexB_case22_case27_call005():
    """Case 22: objection · trust, H2 0 (first word 'No'), acknowledged (H4 1).
    Case 27: T053-T054 supposition does not count; T074 gives decision maker and influencer, R1 2."""
    ctx = load("005", first_price="T165")
    ans = {
        ("obj.resistance", "res:T242"): doubt("that don't make me like trust like 100%", "offer_trust"),
        ("obj.topic", "topic:T242.objection:T243"): {"new_subject": False, "receive_and_leave": False},
        ("obj.acknowledge", "ack:T242.objection"): {
            "receiving_marker": False, "neutral_reformulation": False, "elliptical_open_question": False,
            "contradiction": True, "quote": "No, we've only got 100 students"},
        ("obj.gesture", "gest:T242.objection"): {
            "answer_given": True, "answer_turn": "T243", "answer_quote": "we don't beg our clients to leave reviews",
            "answer_tied_to_prospect": True, "support_or_framework": False, "proof_reversibility_guarantee": False,
            "cost_of_inaction_question": False, "cost_stated_by_prospect": False, "mindset_reframe": False,
            "offer_argument": False, "gesture_turn": "T243", "gesture_quote": "we don't beg our clients to leave reviews"},
        ("obj.resolution", "resol:T242.objection"): {
            "reaction_kind": "agreement_only", "turn": "T244", "quote": "Okay, I understand. Okay.",
            "specific_element": False, "content_first_stated_by_sales": False},
        ("obj.prevention", "prevention:pre_price"): {
            "decision_maker": {"turn": "T074", "quote": "it's my final decision"},
            "influencers": {"turn": "T074", "quote": "I ask him because he knows more than me about that kind of stuff"},
            "budget": None, "deadline": None, "past_attempt": None, "past_attempt_explored": None,
            "difference_stated": None},
    }
    res, _ = run(ctx, ans)
    e = ep_by_turn(res, "T242")[0]
    assert (e["nature"], e["subtype"]) == ("objection", "trust_in_offer")
    assert e["response_turns"] == ["T243"] and e["reaction_turns"] == ["T244"] and e["topic_change"] == "T245"
    assert e["acknowledge"] is False and lvl(e, "H2") == 0
    assert e["reaction"]["level"] == "acknowledged" and lvl(e, "H4") == 1
    assert {i["id"]: i["level"] for i in res.details["prevention"]["items"]}["R1"] == 2
    assert res.status == "scored" and res.details["prevention_status"] == "scored"

    # Case 27, first half: the T054 approval of a sales supposition does not establish the decision maker.
    ans[("obj.prevention", "prevention:pre_price")] = dict(
        ans[("obj.prevention", "prevention:pre_price")], decision_maker={"turn": "T054", "quote": "Yes."},
        influencers=None)
    res2, _ = run(ctx, ans)
    assert {i["id"]: i["level"] for i in res2.details["prevention"]["items"]}["R1"] == 0
    assert res2.details["prevention"]["rejected"]["decision_maker"] == "approval_only"


def test_annexB_case25_call044_receive_and_leave_latent():
    """Case 25: 'It's just such a significant investment' (no listed marker: nominated by the model),
    T052 receives it and changes topic in the same turn -> latent (OB-10, OB-22), H4 0.
    OB-27 (2026-11-03): this case needs call 044's first price (a turn before T051) set below, and the nomination key
    of the chunk that starts right after it; to fill in when the corpus is available (docs/OPEN_DECISIONS.md)."""
    ctx = load("044")
    ans = {
        ("obj.nominate", "nominate:T001"): {"nominations": [
            {"turn": "T051", "quote": "It's just such a significant investment"}]},
        ("obj.resistance", "res:T051"): doubt("It's just such a significant investment", "price"),
        ("obj.topic", "topic:T051.objection:T052"): {"new_subject": True, "receive_and_leave": True,
                                                      "quote": "Let's just do this. Share screen."},
        ("obj.acknowledge", "ack:T051.objection"): {
            "receiving_marker": True, "neutral_reformulation": False, "elliptical_open_question": False,
            "contradiction": False, "quote": "Of course."},
    }
    res, client = run(ctx, ans)
    assert "T051" not in [t.id for t in O.find_candidates(ctx)]
    e = ep_by_turn(res, "T051")[0]
    assert e["nature"] == "objection" and e["response_turns"] == ["T052"] and e["reaction_turns"] == []
    assert e["latent_rule"] == "OB-22" and e["reaction"]["level"] == "latent" and lvl(e, "H4") == 0
    assert e["turns_to_topic_change"] == 1
    assert not any(c[0] == "obj.resolution" and c[1] == "resol:T051.objection" for c in client.calls)
    assert res.details["handling_status"] == "scored" and res.details["prevention_status"] == "not_applicable"


def test_annexB_case4_case26_call038_denied_anxiety_and_recurrence():
    """Case 4: T212 is objection · price only (anxiety denied, OB-24).
    Case 26: T338 is a recurrence of T212 (recurrence_of = the T212 episode, H5 = 0 on the earlier one);
    T340 is a new resistance, not a reaction (OB-9)."""
    ctx = load("038", first_price="T197")
    ans = {
        ("obj.resistance", "res:T212"): {
            "exclusion": "none", "denied_subjects": ["self_capability"],
            "doubts": [{"quote": "But it's just the amount", "subjects": ["price"]},
                       {"quote": "No, I'm not scared", "subjects": ["self_capability"]}]},
        ("obj.topic", "topic:T212.objection:T213"): {"new_subject": False, "receive_and_leave": False},
        ("obj.isolate", "iso:T212.objection"): {
            "isolate": True, "turn": "T213",
            "quote": "So other than the finances, is there anything else keeping you less than 100%"},
        ("obj.resistance", "res:T338"): doubt("This is very expensive, of course.", "price"),
        ("obj.topic", "topic:T338.objection:T339"): {"new_subject": False, "receive_and_leave": False},
        ("obj.resistance", "res:T340"): doubt("No, I can't make decisions instantly.", "postponement"),
    }
    res, _ = run(ctx, ans)
    e212 = ep_by_turn(res, "T212")
    assert [(e["nature"], e["subtype"]) for e in e212] == [("objection", "price")]
    assert "denied_nature:T212:anxiety_capability" in res.flags
    assert e212[0]["isolate"] is True
    e338, e340 = ep_by_turn(res, "T338")[0], ep_by_turn(res, "T340")[0]
    assert e338["recurrence_of"] == e212[0]["id"] and e212[0]["recurs_later"] and lvl(e212[0], "H5") == 0
    assert e338["end_reason"] == "new_resistance" and "T340" not in e338["reaction_turns"]
    assert e338["reaction"]["level"] == "latent"
    assert e340["nature"] == "inertia" and e338["after_first_price"]


def test_annexB_case24_call050_persisting():
    """Case 24: 'that's a lot' -> 'Compared to?' -> 'that is a lot, to be honest': persisting, H4 0.
    The repetition at T221 is the same resistance inside the episode (no new episode). 'Compared to?' right after
    the resistance counts as exploration under OB-20 (v1.1); the strict X7 reading of the case predates OB-20."""
    ctx = load("050", first_price="T216")
    ans = {
        ("obj.resistance", "res:T219"): doubt("That's, that's a lot.", "price"),
        ("obj.resistance", "res:T221"): doubt("that is a lot, to be honest", "price"),
        ("obj.topic", "topic:T219.objection:T220"): {"new_subject": False, "receive_and_leave": False},
        ("obj.explore", "exp:T219.objection"): {"explore": True, "turn": "T220", "quote": "Compared to?",
                                                "open_question": True, "elliptical": True,
                                                "answered_with_content": False},
        ("obj.resolution", "resol:T219.objection"): {
            "reaction_kind": "repeats_or_reinforces", "turn": "T221", "quote": "that is a lot, to be honest",
            "specific_element": False, "content_first_stated_by_sales": False},
    }
    res, _ = run(ctx, ans)
    assert ep_by_turn(res, "T221") == []
    e = ep_by_turn(res, "T219")[0]
    assert "T221" in e["reaction_turns"] and e["reaction"]["level"] == "persisting" and lvl(e, "H4") == 0
    assert e["explore"] == {"asked": True, "answered_with_content": False} and lvl(e, "H3") == 1
