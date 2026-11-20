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
    assert rec["meta"]["steps"]["S1"]["reasons"]["gates:invalid"] == 1


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
    assert len(calls) == 3                                                    # 8 listed questions, 3 per call
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
