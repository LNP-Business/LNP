"""S1g (2026-11-20, SPIN §3): the model answers the closed gates of each listed question with its context, in batches;
the code decides the letter with the engine's decide_letter. Fictional call of the lite tests."""
import copy

import synthetic_call as sc
from callqa_lite.engine import analyse
from callqa_lite.steps import MockLiteClient

NO = {"g1": {"reason": None}, "g2": {"neutral_fact": False}, "g3": {"state_or_value": False, "antecedent": "none"},
      "g4": {"consequence": False}, "g5": {"difficulty": False}}


def gate(qid, **over):
    g = copy.deepcopy(NO)
    g.update({"id": qid, "is_solicitation": True, "routing": None})
    for k, v in over.items():
        g[k] = v
    return g


def run(units, **cfg):
    a = copy.deepcopy(sc.ANSWERS)
    a["lite.s1_gates"] = {"units": units}
    client = MockLiteClient(a)
    return analyse(sc.context(), client, cfg or None), client


def sol(rec, turn):
    return next(s for s in rec["results"]["SPIN"]["details"]["solicitations"] if s["turn"] == turn)


def test_the_code_decides_the_letter_from_the_gates():
    # S1 said S for « How many clients do you have right now? »; the gates say the difficulty itself: P
    rec, client = run([gate("Q005", g5={"difficulty": True, "quote": "How many clients"})])
    s = sol(rec, "T005")
    assert s["letter"] == "P" and "gates_by_code" in s["tags"]
    assert sol(rec, "T007")["letter"] == "P" and "gates_by_code" not in sol(rec, "T007")["tags"]   # no gates: S1's letter


def test_a_gate_whose_quote_is_not_in_the_question_is_dropped_and_s1_stays():
    rec, _ = run([gate("Q005", g3={"state_or_value": True, "antecedent": "none", "quote": "never said"})])
    assert sol(rec, "T005")["letter"] == "S"
    assert rec["meta"]["steps"]["S1"]["reasons"]["gates:invalid"] == 2                # once per reading


def test_the_hard_rules_still_apply_over_the_gates_and_routing_sets_a_question_aside():
    rec, _ = run([gate("Q013", g3={"state_or_value": True, "antecedent": "none", "content_supplied": True,
                                   "quote": "Where do you want to be"}),
                  gate("Q015", routing="VALIDATION_REQUEST")])
    assert sol(rec, "T013")["letter"] == "OUT" and sol(rec, "T013")["out_reason"] == "agreement"   # closed need-payoff
    assert not any(s["turn"] == "T015" for s in rec["results"]["SPIN"]["details"]["solicitations"])
    assert rec["meta"]["steps"]["S1"]["reasons"]["question:routing"] >= 1


def test_the_questions_go_in_batches_with_their_context():
    rec, client = run([], gates_batch=3)
    calls = [c for c in client.calls if c["task"] == "lite.s1_gates"]
    assert len(calls) == 6                                     # 8 listed questions, 3 per call, two readings each
    assert [c["unit"] for c in calls][:2] == ["Q001-Q005", "Q001-Q005:p2"]
    second = calls[1]["prompt"].split("UNITS")[1]
    assert second.index("Q005 ·") < second.index("Q001 ·")                    # the second reading in reverse order
    p = calls[0]["prompt"]
    assert "Q003 · T003" in p and "BEFORE: [T001 SALES]" in p and "ANSWER: [T004 PROSPECT] I have been doing" in p
    assert "You do NOT choose a letter" in p


def test_the_new_hard_rules_override_the_gates():
    """§3 (2026-11-20): a check-in, a closed restatement and a choice among the sales' options are OUT whatever the
    gates say."""
    from callqa_lite.spin import decide_letter
    for sentence, reason, tag in [("Ça fait sens ?", "nothing", "check_in_by_code"),
                                  ("Donc ton problème, c'est le temps ?", "agreement", "closed_restatement_by_code"),
                                  ("C'est plutôt le temps ou l'argent ?", "sales_list", "choice_list_by_code")]:
        d = decide_letter({"letter": "P"}, sentence)
        assert (d.letter, d.reason) == ("OUT", reason) and tag in d.tags, sentence


def run2(first, second, arbiter=None):
    a = copy.deepcopy(sc.ANSWERS)
    a["lite.s1_gates"] = [{"units": first}, {"units": second}]
    if arbiter is not None:
        a["lite.s1_gates_arbiter"] = {"units": arbiter} if isinstance(arbiter, list) else arbiter
    client = MockLiteClient(a)
    return analyse(sc.context(), client), client


P5 = dict(g5={"difficulty": True, "quote": "How many clients"})
S5 = dict(g2={"neutral_fact": True, "quote": "How many clients"})


def test_two_readings_that_agree_are_agreed_and_the_arbiter_is_not_asked():
    rec, client = run2([gate("Q005", **S5)], [gate("Q005", **S5)])
    s = sol(rec, "T005")
    assert (s["letter"], s["status"]) == ("S", "agreed")
    assert not any(c["task"] == "lite.s1_gates_arbiter" for c in client.calls)


def test_a_disagreement_goes_to_the_arbiter_who_walks_the_gates_again():
    rec, client = run2([gate("Q005", **S5)], [gate("Q005", **P5)], arbiter=[gate("Q005", **P5)])
    s = sol(rec, "T005")
    assert (s["letter"], s["status"]) == ("P", "arbitrated")
    arb = next(c for c in client.calls if c["task"] == "lite.s1_gates_arbiter")
    assert arb["tier"] == "arbiter" and arb["prefix"].startswith("Each unit below carries its own context")
    assert "READER 1: letter S" in arb["prompt"] and "READER 2: letter P" in arb["prompt"]
    assert "do not vote" in arb["prompt"] and "Q005 · T005" in arb["prompt"] and "Q007 ·" not in arb["prompt"]


def test_a_failed_arbitration_keeps_a_valid_reading_to_review():
    rec, _ = run2([gate("Q005", **S5)], [gate("Q005", **P5)], arbiter="not json")
    s = sol(rec, "T005")
    assert (s["letter"], s["status"]) == ("S", "to_review")
    assert rec["meta"]["steps"]["S1"]["reasons"]["gates:arbiter_failed"] == 1
    assert rec["results"]["SPIN"]["details"]["unit_status"]["to_review"] == 1         # C4: left out of the scores
    assert all(a["solicitation"] != s["id"] for a in rec["results"]["SPIN"]["details"]["atom_decisions"])


def test_one_valid_reading_out_of_two_is_disputed_too():
    rec, client = run2([gate("Q005", **S5)], [gate("Q005", g2={"neutral_fact": True, "quote": "never said"})],
                       arbiter=[gate("Q005", **S5)])
    assert sol(rec, "T005")["status"] == "arbitrated"


def without_s1(qid):
    a = copy.deepcopy(sc.ANSWERS)
    a["lite.s1_discovery"] = {"questions": [q for q in a["lite.s1_discovery"]["questions"]
                                            if q.get("id") != qid and q.get("turn") != "T" + qid[1:]]}
    return a


def test_c4_a_question_s1_did_not_read_is_decided_by_the_gates():
    a = without_s1("Q011")
    a["lite.s1_gates"] = {"units": [gate("Q011", g4={"consequence": True, "quote": "affect your family"})]}
    rec = analyse(sc.context(), MockLiteClient(a), None)
    s = sol(rec, "T011")
    assert s["letter"] == "I" and s["status"] == "agreed" and "gates_by_code" in s["tags"]
    assert rec["meta"]["steps"]["S1"]["reasons"]["question:not_read"] == 1


def test_c4_a_question_nobody_read_stays_listed_to_review_and_out_of_the_scores():
    a = without_s1("Q011")
    a["lite.s1_gates"] = {"units": []}
    rec = analyse(sc.context(), MockLiteClient(a), None)
    s = sol(rec, "T011")
    assert s["status"] == "to_review" and "unread" in s["tags"]
    assert rec["results"]["SPIN"]["details"]["unit_status"]["to_review"] == 1
    assert rec["meta"]["steps"]["S1"]["reasons"]["question:unread_to_review"] == 1


def test_c4_a_question_s1_routes_comes_back_when_both_gate_readings_see_a_question():
    a = copy.deepcopy(sc.ANSWERS)
    a["lite.s1_gates"] = {"units": [gate("Q017", g2={"neutral_fact": True, "quote": "Did I get that right"})]}
    rec = analyse(sc.context(), MockLiteClient(a), None)
    reasons = rec["meta"]["steps"]["S1"]["reasons"]
    assert reasons["question:routing_s1"] == 1 and "question:routing" not in reasons
    assert any(x["turn"] == "T017" for x in rec["results"]["SPIN"]["details"]["solicitations"])
