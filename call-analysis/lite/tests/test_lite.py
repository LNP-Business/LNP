"""Lite engine on a fictional call, with recorded model answers (no network, no real data)."""
import copy
import json

import pytest

import synthetic_call as sc
from callqa_lite.engine import LiteModelError, analyse
from callqa_lite.steps import MockLiteClient, parse_json


def run(answers=None, **cfg):
    client = MockLiteClient(answers or sc.ANSWERS)
    return analyse(sc.context(), client, cfg or None), client


def sols(rec):
    return rec["results"]["SPIN"]["details"]["solicitations"]


# ------------------------------------------------------------------ quote checks (C3)
def test_invented_and_misattributed_quotes_are_rejected_and_counted():
    rec, _ = run()
    steps = rec["meta"]["steps"]
    assert steps["S0"]["reasons"] == {"wrong_speaker": 1}                       # a prospect turn as offer description
    assert steps["S1"]["reasons"]["question:wrong_speaker"] == 1                 # a prospect turn given as a question
    assert steps["S1"]["reasons"]["atom:not_a_substring"] == 1                   # "20,000 a month" was never said
    assert steps["S1"]["reasons"]["atom:outside_answers"] == 1                   # a sales turn given as an atom
    assert steps["S3"]["reasons"] == {"pitch.claims:claim": 1}                   # "Our students make 20K" never said
    assert steps["S4"]["reasons"]["quote:wrong_speaker"] == 1                    # a sales turn given as an objection
    atoms = rec["results"]["SPIN"]["details"]["atom_decisions"]
    assert all("20,000" not in a["quote"] for a in atoms)
    assert all(a["turn"] in {"T004", "T006", "T008", "T010", "T012", "T014", "T016"} for a in atoms)
    claims = rec["results"]["PITCH"]["details"]["claims"]
    assert [c["turn"] for c in claims] == ["T027"] and "20K" not in json.dumps(claims)


def test_a_gesture_whose_quote_is_not_in_the_transcript_is_not_done():
    a = copy.deepcopy(sc.ANSWERS)
    a["lite.s4_objections"]["objections"][1]["isolate"] = {"turn": "T029", "quote": "is this the only thing in the way?"}
    rec, _ = run(a)
    e1 = rec["results"]["OBJECTIONS"]["details"]["episodes"][0]
    assert e1["isolate"] is False and rec["meta"]["steps"]["S4"]["reasons"]["isolate:not_a_substring"] == 1
    assert next(i for i in e1["items"] if i["id"] == "H3")["level"] == 1        # explored only (§5.1 H3)


# ------------------------------------------------------------------ phases and discovery
def test_phase_map_is_decided_by_the_engine_code():
    rec, _ = run()
    ph = rec["phases"]
    assert (ph["discovery_start"], ph["pitch_start"], ph["first_price"], ph["decision_request"], ph["pitch_end"]) == \
        ("T003", "T019", "T027", "T039", "T027")


def test_discovery_keeps_only_the_questions_before_the_pitch():
    rec, _ = run()
    s = sols(rec)
    assert all(int(x["turn"][1:]) < 19 for x in s)
    assert rec["meta"]["steps"]["S1"]["reasons"]["question:after_pitch"] == 1
    assert [x["id"] for x in s if x["in_perimeter"]] == ["Q003.1", "Q005.1", "Q007.1", "Q009.1", "Q011.1", "Q013.1",
                                                          "Q015.1"]
    first = s[0]                                                                   # small talk: before the perimeter
    assert first["turn"] == "T001" and not first["in_perimeter"] and first["letter"] is None


def test_each_question_has_its_letter_register_and_the_prospect_answer():
    rec, _ = run()
    by = {x["turn"]: x for x in sols(rec)}
    assert [by[t]["letter"] for t in ("T003", "T005", "T007", "T009", "T011", "T013", "T015")] == \
        ["S", "S", "P", "I", "I", "N", "N"]
    assert by["T007"]["register"] == "financial" and by["T007"]["register_basis"] == "named"
    assert by["T009"]["register"] == "mental_emotional" and by["T009"]["register_basis"] == "answer"
    assert by["T011"]["register"] == "time_load" and by["T015"]["register"] == "time_load"
    assert by["T005"]["answer_turns"] == ["T006"]                                 # SB-5, computed by code
    assert by["T003"]["answer"] == {"turn": "T004", "quote": "I only make about 1,500 a month from it"}
    reg = rec["results"]["SPIN"]["details"]["registers"]
    assert reg["counts"] == {"financial": 4, "time_load": 2, "identity_status": 0, "mental_emotional": 1, "other": 0}
    assert reg["flags"] == [] and reg["agreement"] is None and reg["single_reading"]


def test_a_register_against_the_domain_words_is_rejected():
    a = copy.deepcopy(sc.ANSWERS)
    q = next(x for x in a["lite.s1_discovery"]["questions"] if x["turn"] == "T005")
    q.update(register_domain="time")                    # "How many clients": only Financial words (SB-32 rule 3)
    rec, _ = run(a)
    by = {x["turn"]: x for x in sols(rec)}
    assert by["T005"]["register"] is None and by["T005"]["register_status"] == "to_review"
    assert rec["meta"]["steps"]["S1"]["reasons"]["register:lexicon_conflict"] == 1


def test_a_closing_tail_makes_the_question_out_agreement():
    a = copy.deepcopy(sc.ANSWERS)
    rec0, _ = run(a)
    t = sc.context()
    t.turns[4].text = "How many clients do you have right now, right?"
    a["lite.s1_discovery"]["questions"][2]["quote"] = "How many clients do you have right now, right?"
    rec = analyse(t, MockLiteClient(a))
    q = next(x for x in sols(rec) if x["turn"] == "T005")
    assert q["letter"] == "OUT" and q["out_reason"] == "agreement" and "validation_tail" in q["tags"]
    assert next(x for x in sols(rec0) if x["turn"] == "T005")["letter"] == "S"


# ------------------------------------------------------------------ objections
def test_objections_before_the_pitch_are_dropped_and_repeats_merged():
    rec, _ = run()
    d = rec["results"]["OBJECTIONS"]["details"]
    eps = d["episodes"]
    assert [(e["subtype"], e["resistance"]["turn"]) for e in eps] == [("price", "T028"), ("co_decider", "T036")]
    assert rec["meta"]["steps"]["S4"]["reasons"]["quote:before_pitch"] == 1
    money = eps[0]
    assert [q["turn"] for q in money["quotes"]] == ["T028", "T038"] and money["merged_items"] == 2
    assert money["recurs_later"] and next(i for i in money["items"] if i["id"] == "H5")["level"] == 0   # OB-11, X4
    assert (money["acknowledge"], money["isolate"], money["explore"], money["gesture_match"]) == \
        (True, True, {"asked": True, "answered_with_content": True}, "yes")
    assert money["reaction"]["level"] == "resolved" and money["topic_change"] == "T035"
    assert money["response_turns"] == ["T029", "T031", "T033"] and money["reaction_turns"] == ["T030", "T032", "T034"]
    co = eps[1]
    assert co["explore"]["asked"] is False                                        # OB-15: reuses no word of it
    assert co["reaction"]["level"] == "acknowledged"


def test_no_objection_twice_even_when_listed_with_a_shared_quote():
    a = copy.deepcopy(sc.ANSWERS)
    a["lite.s4_objections"]["objections"].append({"subjects": ["offer_trust"],
                                                  "quotes": [{"turn": "T028", "quote": "a lot of money for me"}]})
    rec, _ = run(a)
    eps = rec["results"]["OBJECTIONS"]["details"]["episodes"]
    assert len(eps) == 2 and len({(e["nature"], e["subtype"]) for e in eps}) == 2


def test_prevention_is_read_before_the_first_price_only():
    rec, _ = run()
    pv = rec["results"]["OBJECTIONS"]["details"]["prevention"]
    assert pv["influencers"] is None and pv["rejected"] == {"influencers": "after_first_price"}


# ------------------------------------------------------------------ scores (code only)
def test_scores_are_computed_by_code():
    rec, _ = run()
    r = rec["results"]
    lv = lambda c: {i["id"]: i["level"] for i in r[c]["items"]}                    # noqa: E731
    assert r["SPIN"]["status"] == "scored" and lv("SPIN") == {"D1": 1, "D2": 1, "D3": 2, "D4": 2, "D5": 1}
    assert r["SPIN"]["score"] == 75
    assert r["GAP"]["verdict"] == "present" and r["GAP"]["score"] == 100
    assert r["PITCH"]["verdict"] == "compliant" and lv("PITCH")["K1"] == 2 and lv("PITCH")["K6"] == 0
    assert r["PITCH"]["score"] == 65
    d = r["OBJECTIONS"]["details"]
    assert (d["handling_score"], d["prevention_score"], r["OBJECTIONS"]["score"]) == (64, 20, 51)
    assert all(x["concordance"] == "single_reading" for x in r.values())


def test_a_score_written_by_the_model_is_ignored():
    a = copy.deepcopy(sc.ANSWERS)
    for k in a:
        a[k] = dict(a[k], score=99, verdict="present", level=2)
    a["lite.s2_gap"]["passages"][0]["validation"] = {"turn": "T018", "outcome": "rejected",
                                                     "agreement_quote": "Yes, exactly", "score": 100}
    rec, _ = run(a)
    assert rec["results"]["GAP"]["verdict"] == "absent" and rec["results"]["GAP"]["score"] == 0
    assert rec["results"]["PITCH"]["verdict"] == "non_compliant"                   # pitched before the yes (PB-37)
    assert "pitch_before_gap" in rec["results"]["PITCH"]["reasons"] and rec["results"]["PITCH"]["score"] == 0


def test_a_paraphrased_cost_is_not_a_component():
    a = copy.deepcopy(sc.ANSWERS)
    c = a["lite.s2_gap"]["passages"][0]["clauses"][3]
    c["key_expression"] = "barely see my kids in the evening"                       # in the source, not in the sales words
    rec, _ = run(a)
    g = rec["results"]["GAP"]
    assert g["verdict"] == "absent" and g["details"]["absence_reason"] == "cost_missing"   # GB-22, X11


# ------------------------------------------------------------------ the record the screen reads
def test_record_has_the_contract_fields_the_screen_reads():
    rec, _ = run()
    assert {"call_id", "sales_id", "start_utc", "timezone", "status", "flags", "turns", "phases", "results", "audit",
            "meta"} <= set(rec)
    assert rec["meta"]["engine"] == "lite" and rec["meta"]["version"] == "callqa-lite-1.0"
    assert {"id", "ts", "role", "speaker", "text", "repaired", "attribution_doubtful"} == set(rec["turns"][0])
    for c in ("SPIN", "GAP", "PITCH", "OBJECTIONS"):
        assert {"competence", "rules_version", "status", "verdict", "reasons", "score", "items", "flags", "details",
                "concordance"} == set(rec["results"][c])
    spin = rec["results"]["SPIN"]["details"]
    assert {"perimeter", "solicitations", "registers", "items_evidence", "chains", "diagnostics", "health"} <= set(spin)
    assert {"id", "turn", "ts", "letter", "in_perimeter", "answer_turns", "register", "register_status"} <= set(spin["solicitations"][1])
    assert any(e.get("question_id") for it in spin["items_evidence"].values() for e in it["evidence"])
    assert spin["chains"][0]["deep"] is True
    gap = rec["results"]["GAP"]["details"]
    r = gap["restitution"]
    assert r["span"] == ["T017", "T017"] and r["validation"]["turn"] == "T018" and r["effective_outcome"] == "confirmed_with_content"
    assert {c["component"]: c["match"] for c in r["clauses"]} == {"A": "verbatim", "B": "verbatim", "PROBLEM": "verbatim",
                                                                  "COST": "verbatim"}
    assert gap["validation_turn"] == "T018" and gap["validated_P"]["turn"] == "T008"
    pitch = rec["results"]["PITCH"]["details"]
    assert {"1", "2", "3", "4"} == set(pitch["steps"]) and pitch["steps"]["1"]["span"] == ["T021", "T021"]
    assert pitch["validated_P"]["category"] == "Acquisition" and pitch["adhesion"][0]["turn"] == "T024"
    obj = rec["results"]["OBJECTIONS"]["details"]
    assert {"episodes", "prevention", "handling_score", "prevention_score"} <= set(obj)
    assert {"nature", "subtype", "resistance", "acknowledge", "isolate", "explore", "gesture_match", "reaction",
            "items", "response_turns"} <= set(obj["episodes"][0])
    json.dumps(rec)


# ------------------------------------------------------------------ model calls: cache, JSON, replay, chunks
def test_one_call_per_step_with_the_transcript_as_the_same_cached_prefix():
    rec, client = run()
    assert [c["task"] for c in client.calls] == ["lite.s0_phases", "lite.s1_discovery", "lite.s2_gap", "lite.s3_pitch",
                                                 "lite.s4_objections"]
    prefixes = {c["prefix"] for c in client.calls}
    assert len(prefixes) == 1 and next(iter(prefixes)).splitlines()[1] == "T001 [SALES] Hi Alex, can you hear me okay?"
    assert "pitch start T019" in client.calls[2]["prompt"] and "[T014] \"I want to make 6,000" in client.calls[2]["prompt"]
    assert "\"turn\": \"T008\"" in client.calls[3]["prompt"]                       # the validated P, from the Gap code
    assert all(c["effort"] == "low" and c["tier"] == "fast" for c in client.calls)


def test_json_is_read_robustly_and_replayed_once():
    assert parse_json("```json\n{\"a\": [1, 2,],}\n```") == {"a": [1, 2]}
    assert parse_json("Here it is: {\"a\": 1} done") == {"a": 1}
    with pytest.raises(ValueError):
        parse_json("no object")
    a = dict(sc.ANSWERS, **{"lite.s2_gap": ["{oops", sc.S2]})
    rec, client = run(a)
    assert [c["task"] for c in client.calls].count("lite.s2_gap") == 2 and rec["results"]["GAP"]["verdict"] == "present"
    assert "WAS REJECTED BY THE CODE" in [c for c in client.calls if c["task"] == "lite.s2_gap"][1]["prompt"]


def test_a_step_that_stays_invalid_leaves_its_competence_to_review():
    a = dict(sc.ANSWERS, **{"lite.s4_objections": "not json"})
    rec, client = run(a)
    assert [c["task"] for c in client.calls].count("lite.s4_objections") == 2
    assert rec["results"]["OBJECTIONS"]["status"] == "to_review" and rec["results"]["GAP"]["status"] == "scored"
    assert rec["meta"]["failed_steps"] == ["S4"]
    with pytest.raises(LiteModelError):
        run(dict(sc.ANSWERS, **{"lite.s0_phases": "not json"}))
    with pytest.raises(LiteModelError):                                            # most steps failed: nothing stored
        run({**sc.ANSWERS, **{k: "x" for k in ("lite.s1_discovery", "lite.s2_gap", "lite.s3_pitch", "lite.s4_objections")}})


def test_a_discovery_answer_cut_by_max_tokens_is_asked_again_in_two_halves():
    a = dict(sc.ANSWERS, **{"lite.s1_discovery": [("{\"questions\": [", "max_tokens"), sc.S1, sc.S1]})
    rec, client = run(a, s1_min_chunk_turns=4)
    units = [c["unit"] for c in client.calls if c["task"] == "lite.s1_discovery"]
    assert units == ["T001-T018", "T001-T009", "T010-T018"]
    assert rec["results"]["SPIN"]["score"] == 75                                    # same questions, listed once


def test_an_excluded_call_asks_nothing():
    t = sc.context()
    for x in t.turns:
        x.role = "SALES"
    client = MockLiteClient(sc.ANSWERS)
    rec = analyse(t, client)
    assert client.calls == [] and rec["status"] == "no_diarization"
    assert all(r["status"] == "excluded" for r in rec["results"].values())


def test_cost_estimate_with_the_haiku_prices():
    from callqa_lite.cost import estimate
    usage = {"fast": {"calls": 6, "input_tokens": 9000, "output_tokens": 30000, "cache_read_input_tokens": 78000,
                      "cache_creation_input_tokens": 15600}}
    usd = estimate(usage)
    assert usd == pytest.approx(0.0009 + 0.015 + 0.00078 + 0.00195, abs=1e-6) and usd < 0.05
