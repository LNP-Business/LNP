"""The quality measure on the fictional call of the lite tests (no real person, no real data)."""
import copy
import json

import pytest

import synthetic_call as sc
from callqa_lite.engine import analyse
from callqa_lite.steps import MockLiteClient
from callqa_qa.reference import norm, same_words, validate
from callqa_qa.score import measure, reproducibility, total

REF = {
    "call_id": "c-lite", "slug": "fiction", "split": "tuning", "round": "R1",
    "complete": {"questions": True, "objections": True},
    "status": {"SPIN": "scored", "GAP": "scored", "PITCH": "scored", "OBJECTIONS": "scored"},
    "scores": {"SPIN": [70, 90], "GAP": [90, 100]},
    "phases": {"discovery_start": "what made you book this call?", "pitch_start": "Let me share my screen",
               "first_price": "The investment is 5,800", "decision_request": None},
    "questions": [
        {"quote": "what made you book this call?", "letter": "S", "register": ["financial", "other"],
         "atoms": [{"type": "SITUATION", "quote": "I only make about 1,500 a month from it"}]},
        {"quote": "How many clients do you have right now?", "letter": "S", "register": "financial",
         "atoms": [{"type": "SITUATION", "quote": "Right now I have three clients"}]},
        {"quote": "What's been stopping you from getting more clients?", "letter": "P", "register": "financial"},
        {"quote": "what does that do to you outside of work?", "letter": "I", "register": "mental_emotional",
         "atoms": [{"type": "IMPACT", "quote": "It makes me feel like a fraud"},
                   {"type": "IMPACT", "quote": "I barely see my kids in the evening"}]},       # the analysis misses it
        {"quote": "how does that affect your family?", "letter": "I", "register": "time_load"},
        {"quote": "Where do you want to be in twelve months?", "letter": "N", "register": "financial"},  # wrong register
        {"quote": "And why does that matter to you?", "letter": "P"},                                   # wrong letter
    ],
    "gap": {"verdict": "present", "components": {"A": "I only make about 1,500 a month",
                                                 "B": "I want to make 6,000 a month", "COST": "I miss dinner three nights"}},
    "pitch": {"verdict": "compliant"},
    "objections": [{"quote": "That's a lot of money for me right now", "nature": "objection", "acknowledge": True,
                    "isolate": True, "explore": True, "gesture_match": True},
                   {"quote": "I need to talk to my husband first", "acknowledge": True, "isolate": True},
                   {"quote": "the money is still a lot", "nature": "objection"}],              # a recurrence (OB-11)
}


def record():
    return analyse(sc.context(), MockLiteClient(copy.deepcopy(sc.ANSWERS)))


def test_words_are_compared_not_turn_ids():
    assert norm("C’est ÇA, non ?") == "c'est ça non"
    assert same_words("des bons revenus, c'est nécessaire", "Je veux des bons revenus, c’est nécessaire. Parce que")
    assert same_words("what does that do to you outside of work", "And not knowing where clients come from, what does "
                      "that do to you outside of work?")
    assert not same_words("how does that affect your family?", "what does that do to you outside of work?")


def test_the_reference_is_checked_against_the_transcript():
    assert validate(REF, sc.transcript()) == []
    bad = copy.deepcopy(REF)
    bad["questions"][0]["letter"] = "X"
    bad["questions"][1]["quote"] = "How many students do you have?"
    bad["split"] = "train"
    errs = validate(bad, sc.transcript())
    assert len(errs) == 3 and any("not in the transcript" in e for e in errs)


def test_each_measure_counts_what_the_reference_states():
    m = measure(REF, record())
    assert m["spin"]["questions_found"] == [7, 7] and m["spin"]["questions_extra"] == 0
    assert m["spin"]["letters"] == [6, 7] and m["spin"]["registers"] == [5, 6]
    assert m["spin"]["atoms_found"] == [3, 4] and m["spin"]["atom_types"] == [3, 3]
    assert m["phases"]["anchors"] == [3, 4]                        # the decision request is found, none was expected
    assert m["gap"]["verdict"] == [1, 1] and m["gap"]["components"] == [3, 3]
    assert m["pitch"]["verdict"] == [1, 1]
    assert m["objections"]["found"] == [3, 3] and m["objections"]["gestures"] == [5, 6] and m["objections"]["extra"] == 0
    assert m["status"]["status"] == [4, 4] and m["status"]["score"] == [2, 2]
    kinds = sorted(e["kind"] for e in m["errors"])
    assert kinds == ["atom_missed", "letter", "objection_isolate", "phase:decision_request", "register"]
    assert m["n_errors"] == 5


def test_a_gap_element_may_list_several_accepted_answers_or_null():
    ref = copy.deepcopy(REF)
    ref["gap"]["components"] = {"A": ["about 1,500 a month", "I only make about 1,500 a month"],   # said here or there
                                "B": [None, "I want to make 6,000 a month"],              # or rightly not selected
                                "COST": None}                                             # must not be found
    m = measure(ref, record())
    assert m["gap"]["components"] == [2, 3]
    assert [e["kind"] for e in m["errors"] if e["kind"].startswith("gap")] == ["gap_component:COST"]
    assert validate(ref, sc.transcript()) == []
    ref["gap"]["components"]["A"].append("words nobody said")
    assert any("gap.components.A[2]" in e for e in validate(ref, sc.transcript()))


def test_totals_add_the_calls_up():
    m = measure(REF, record())
    t = total([m, m])
    assert t["spin.letters"] == {"right": 12, "out_of": 14, "share": 0.857} and t["errors"] == 10


def test_reproducibility_compares_the_records_of_one_call():
    a, b = record(), record()
    for s in b["results"]["SPIN"]["details"]["solicitations"]:
        if s["id"] == "Q005.1":
            s["letter"] = "P"
    b["results"]["SPIN"]["score"] = 60
    r = reproducibility(REF, [a, b])
    assert r["same_letter"] == [6, 7] and r["same_register"] == [7, 7]
    assert r["scores"]["SPIN"]["spread"] == 15 and r["scores"]["GAP"]["spread"] == 0


def test_the_runner_replays_the_stored_answers_and_writes_the_errors_to_the_file_only(tmp_path, capsys):
    import qa_run as run
    (tmp_path / "refs").mkdir()
    (tmp_path / "cases").mkdir()
    (tmp_path / "refs" / "fiction.json").write_text(json.dumps(REF))
    audit = [{"entry": {"task": t, "answer": a}} for t, a in sc.ANSWERS.items() if isinstance(a, dict)]
    case = {"call": {"call_id": "c-lite", "transcript_raw": sc.transcript(), "speaker_map": sc.SPEAKERS,
                     "scheduled_start": "2026-11-02T15:00:00+00:00"}, "audit": audit}
    (tmp_path / "cases" / "fiction.json").write_text(json.dumps(case))
    out = tmp_path / "report.json"
    assert run.main(["--cases", str(tmp_path / "cases"), "--refs", str(tmp_path / "refs"), "--out", str(out)]) == 0
    printed = capsys.readouterr().out
    assert "fiction" in printed and "TOTAL" in printed and "husband" not in printed      # numbers only in the log
    rep = json.loads(out.read_text())
    assert rep["total"]["spin.questions_found"]["share"] == 1.0 and rep["calls"][0]["n_errors"] >= 5


def test_the_screen_corrections_become_reference_answers(tmp_path):
    import corrections_to_reference as ctr
    ref = copy.deepcopy(REF)
    rows = [{"call_id": "c-lite", "unit_id": "Q015.1", "value": "N", "engine_value": "P", "note": "valeur",
             "created_at": "2026-11-20T10:00:00Z", "quote": "And why does that matter to you?"},
            {"call_id": "c-lite", "unit_id": "Q015.1", "value": "N", "engine_value": "P", "note": None,
             "created_at": "2026-11-20T09:00:00Z", "quote": "And why does that matter to you?"},
            {"call_id": "c-lite", "unit_id": "Q019.1", "value": "OUT", "engine_value": "S", "note": None,
             "created_at": "2026-11-20T11:00:00Z", "quote": "Let me share my screen"}]
    ref, changed, added = ctr.merge(ref, rows)
    assert (changed, added) == (1, 1)
    assert next(q for q in ref["questions"] if q["quote"].startswith("And why"))["letter"] == "N"
    assert ref["questions"][-1]["letter"] == "OUT"
    (tmp_path / "refs").mkdir()
    (tmp_path / "refs" / "fiction.json").write_text(json.dumps(REF))
    (tmp_path / "c.json").write_text(json.dumps(rows))
    assert ctr.main(["--corrections", str(tmp_path / "c.json"), "--refs", str(tmp_path / "refs")]) == 0
    assert json.loads((tmp_path / "refs" / "fiction.json").read_text())["questions"][-1]["letter"] == "OUT"


def test_an_excluded_call_prints_no_share_instead_of_failing():
    from qa_run import repro_line
    out = repro_line("cut", {"runs": 5, "same_letter_share": None, "same_register_share": None})
    assert "same letter -" in out and "same register -" in out and "5 runs" in out
