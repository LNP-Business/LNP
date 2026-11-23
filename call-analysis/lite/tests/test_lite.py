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


def test_price_must_be_the_lnp_offer_price_with_its_explanation():
    """Romain 2026-11-03: the first price is said by the sales for the LNP offer and goes with its explanation."""
    a = copy.deepcopy(sc.ANSWERS)
    a["lite.s0_phases"]["turns"] += [
        # an amount that is not the price of the offer (the prospect's own figure): dropped
        {"turn": "T023", "quote": "You go from 1,500 a month to 6,000 a month", "price_for_offer": True, "amount": 1500,
         "lnp_offer_price": False},
        # said as a price, but the explanation quoted is not an exact passage: dropped
        {"turn": "T025", "quote": "Do you have any questions about how the weekly calls work?", "price_for_offer": True,
         "amount": 900, "lnp_offer_price": True, "offer_explained": {"turn": "T019", "quote": "a twelve-month plan"}}]
    rec, _ = run(a)
    assert rec["phases"]["first_price"] == "T027"
    r = rec["meta"]["steps"]["S0"]["reasons"]
    assert r["price:not_lnp_offer"] == 1 and r["price:no_offer_explained"] == 1


def test_an_introduction_followed_by_discovery_is_not_the_pitch_start():
    a = copy.deepcopy(sc.ANSWERS)
    a["lite.s0_phases"]["turns"].append(
        {"turn": "T001", "quote": "Hi Alex, can you hear me okay?", "offer_description": True,
         "followed_by_discovery": False, "next_discovery_question": {"turn": "T003", "quote": "what made you book this call?"}})
    rec, _ = run(a)
    assert rec["phases"]["pitch_start"] == "T019"


def test_a_valid_lnp_price_before_the_pitch_start_moves_the_pitch_start():
    a = copy.deepcopy(sc.ANSWERS)
    t = next(x for x in a["lite.s0_phases"]["turns"] if x["turn"] == "T019")
    t["followed_by_discovery"] = True                         # T019 taken as a mention: no pitch start before T027
    t["next_discovery_question"] = None
    rec, _ = run(a)
    ph = rec["phases"]
    assert ph["first_price"] == "T027" and ph["pitch_start"] == "T019"     # the price's explanation starts the pitch


def test_the_discovery_ends_when_the_gap_is_made():
    rec, _ = run()
    assert rec["results"]["GAP"]["verdict"] == "present"
    assert rec["meta"]["discovery_end_rule"] == "gap" and rec["phases"]["discovery_end"] == "T018"
    assert all(int(x["turn"][1:]) < 18 for x in sols(rec))


def test_no_discovery_no_pitch_gap_not_applicable():
    a = {"lite.s0_phases": {"turns": []}, "lite.s1_discovery": {"questions": []},
         "lite.s2_gap": {"passages": []}, "lite.s3_pitch": {}, "lite.s4_objections": {"objections": []}}
    rec, _ = run(a)
    assert rec["results"]["GAP"]["status"] == "not_applicable"


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
    # SB-27 (2026-11-19): « Where do you want to be in twelve months? » names Identity & status (SB-30), read in the question
    assert by["T013"]["register"] == "identity_status" and by["T013"]["register_basis"] == "named"
    assert reg["counts"] == {"financial": 3, "time_load": 2, "identity_status": 1, "mental_emotional": 1, "other": 0}
    assert reg["flags"] == [] and reg["agreement"] is None and reg["single_reading"]


def test_sb27_a_register_against_the_question_words_takes_the_words_register():
    a = copy.deepcopy(sc.ANSWERS)
    q = next(x for x in a["lite.s1_discovery"]["questions"] if x["turn"] == "T005")
    q.update(register_domain="time")                    # "How many clients": only Financial words (SB-27, SB-32 rule 3)
    rec, _ = run(a)
    by = {x["turn"]: x for x in sols(rec)}
    # 2026-11-21: the words of the question name one register, so it is that one (no longer left undecided)
    assert by["T005"]["register"] == "financial" and by["T005"]["register_basis"] == "named"
    assert rec["meta"]["steps"]["S1"]["reasons"]["register:named_in_question"] >= 1


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
def test_objections_before_the_first_price_are_dropped_and_a_recurrence_is_its_own_episode():
    """OB-11 (Romain, 2026-11-20): the money comes back at T038, after the sales moved on to the co-decider: a new
    episode linked to the first, which takes H5 = 0."""
    rec, _ = run()
    d = rec["results"]["OBJECTIONS"]["details"]
    eps = d["episodes"]
    assert [(e["subtype"], e["resistance"]["turn"]) for e in eps] == [("price", "T028"), ("co_decider", "T036"),
                                                                       ("price", "T038")]
    assert eps[2]["recurrence_of"] == "E1" and eps[2]["status"] == "scored"
    # OB-27: before the pitch (T010) and during the pitch but before the first price (T024, price at T027): dropped
    assert rec["meta"]["steps"]["S4"]["reasons"]["quote:before_price"] == 2
    assert d["lite"]["scope"] == "after_first_price"
    money = eps[0]
    assert [q["turn"] for q in money["quotes"]] == ["T028"] and money["merged_items"] == 1
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
    assert [e["subtype"] for e in eps] == ["price", "co_decider", "price"]          # the shared quote: one objection
    assert eps[0]["merged_items"] == 2


def test_the_same_doubt_said_again_before_the_sales_moves_on_is_a_repetition():
    a = copy.deepcopy(sc.ANSWERS)
    a["lite.s4_objections"]["objections"][1]["quotes"].append({"turn": "T030", "quote": "it's really just the money"})
    rec, _ = run(a)
    eps = rec["results"]["OBJECTIONS"]["details"]["episodes"]
    assert [q["turn"] for q in eps[0]["quotes"]] == ["T028", "T030"] and len(eps) == 3   # T030 is before T035


def test_a_recurrence_left_under_the_first_objection_opens_an_episode_to_review():
    a = copy.deepcopy(sc.ANSWERS)
    objs = a["lite.s4_objections"]["objections"]
    objs[1]["quotes"].append({"turn": "T038", "quote": "the money is still a lot"})
    del objs[3]
    rec, _ = run(a)
    d = rec["results"]["OBJECTIONS"]["details"]
    eps = d["episodes"]
    assert [(e["subtype"], e["status"]) for e in eps] == [("price", "scored"), ("co_decider", "scored"),
                                                         ("price", "to_review")]
    assert eps[0]["recurs_later"] and eps[2]["recurrence_of"] == "E1" and "recurrence_unread" in eps[2]["tags"]
    assert d["handling_score"] == round((90 + 38) / 2)                              # the unread one is left out
    assert rec["meta"]["steps"]["S4"]["reasons"]["recurrence:unread"] == 1


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
    assert (d["handling_score"], d["prevention_score"], r["OBJECTIONS"]["score"]) == (52, 20, 42)   # 3 episodes (OB-11)
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
    c["sales_quote"] = "your family pays for it"                                    # and no statement's words either
    rec, _ = run(a)
    g = rec["results"]["GAP"]
    assert g["verdict"] == "absent" and g["details"]["absence_reason"] == "cost_missing"   # GB-22, X11


def test_gb22b_the_code_finds_the_key_expression_when_the_model_cites_the_wrong_words():
    """GAP-1.5 (2026-11-23): the sales repeats the prospect's words, the model cites others; the code reads the cost
    statements said before and finds the run the sales repeats."""
    a = copy.deepcopy(sc.ANSWERS)
    c = a["lite.s2_gap"]["passages"][0]["clauses"][3]
    c["key_expression"] = "barely see my kids in the evening"
    rec, _ = run(a)
    g = rec["results"]["GAP"]
    cost = g["details"]["restitution"]["components"]["COST"]
    assert g["verdict"] == "present" and cost["match"] == "verbatim" and cost["key_expression"] == "I miss dinner three nights a week"


# ------------------------------------------------------------------ the record the screen reads
def test_record_has_the_contract_fields_the_screen_reads():
    rec, _ = run()
    assert {"call_id", "sales_id", "start_utc", "timezone", "status", "flags", "turns", "phases", "results", "audit",
            "meta"} <= set(rec)
    assert rec["meta"]["engine"] == "lite" and rec["meta"]["version"] == "callqa-lite-1.1"
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
    assert [c["task"] for c in client.calls] == ["lite.s0_phases", "lite.s1_discovery", "lite.s1_gates", "lite.s1_gates",
                                                 "lite.s2_gap", "lite.s2_gap", "lite.s3_pitch", "lite.s4_objections"]
    prefixes = {c["prefix"] for c in client.calls}
    assert len(prefixes) == 1 and next(iter(prefixes)).splitlines()[1] == "T001 [SALES] Hi Alex, can you hear me okay?"
    assert "pitch start T019" in client.calls[4]["prompt"] and "[T014] \"I want to make 6,000" in client.calls[4]["prompt"]
    assert client.calls[5]["unit"] == "call:p2" and client.calls[5]["prompt"] == client.calls[4]["prompt"]   # two readings
    assert "\"turn\": \"T008\"" in client.calls[6]["prompt"]                       # the validated P, from the Gap code
    assert all(c["effort"] == "low" and c["tier"] == "fast" for c in client.calls)


def test_json_is_read_robustly_and_replayed_once():
    assert parse_json("```json\n{\"a\": [1, 2,],}\n```") == {"a": [1, 2]}
    assert parse_json("Here it is: {\"a\": 1} done") == {"a": 1}
    with pytest.raises(ValueError):
        parse_json("no object")
    a = dict(sc.ANSWERS, **{"lite.s2_gap": ["{oops", sc.S2]})
    rec, client = run(a)
    assert [c["task"] for c in client.calls].count("lite.s2_gap") == 3 and rec["results"]["GAP"]["verdict"] == "present"
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


def test_each_tier_is_priced_at_its_own_model():
    """2026-11-23: the arbiter tier runs claude-sonnet-5-5 (OPEN_DECISIONS F); crm_ca_config.tiers names the models."""
    from callqa_lite.cost import breakdown, estimate
    usage = {"fast": {"calls": 1, "input_tokens": 1_000_000, "output_tokens": 0, "cache_read_input_tokens": 0,
                      "cache_creation_input_tokens": 0},
             "arbiter": {"calls": 1, "input_tokens": 0, "output_tokens": 100_000, "cache_read_input_tokens": 1_000_000,
                         "cache_creation_input_tokens": 0}}
    assert estimate(usage) == pytest.approx(0.10 + 1.0 + 0.10)                       # default models of the tiers
    assert estimate(usage, {"arbiter": "claude-haiku-5-5-20261001"}) == pytest.approx(0.10 + 0.05 + 0.01)  # by family
    b = breakdown(usage, {"arbiter": "claude-opus-5-5"})
    assert b["unknown_models"] == ["claude-opus-5-5"] and b["per_tier"]["arbiter"] == pytest.approx(1.10)  # flagged floor


def test_the_code_narrows_a_key_expression_copied_as_a_whole_sentence():
    """GB-22 by the code: the model copied the prospect's whole sentence; the shared words count (Anastasia's call)."""
    from callqa_lite.gap import shared_key_expression
    src = "on gagne vraiment, je pense, quelques 10% de ce qui coûte"
    sales = "tu te retrouves avec 10% de ce que coûte un cours"
    k = shared_key_expression("quelques 10% de ce qui coûte", src, sales)
    assert k and "10" in k and "quelques" not in k
    assert shared_key_expression("je suis dépendante actuellement de l'aide de ma mère",
                                 "je suis dépendante actuellement de l'aide de ma mère", "es dépendante de ta maman") == "suis dépendante"
    # (2026-11-19: the person shift is French too, so « je suis » is found in the sales' « es »: the longest shared run)
    assert shared_key_expression("je suis vraiment", "je suis vraiment", "tu es là") is None       # generic only: none


# ---------------------------------------------------------------- 2026-11-19: phases and perimeter (audit of November 2026)
def test_an_offer_description_far_from_the_next_question_is_the_pitch_start():
    """PB-2 / PB-17: a mention only when the return to discovery comes within 2 sales turns (Maria's call: any later
    question used to count, and her pitch was read at the price)."""
    a = copy.deepcopy(sc.ANSWERS)
    t = next(x for x in a["lite.s0_phases"]["turns"] if x["turn"] == "T019")
    t["next_discovery_question"] = {"turn": "T025", "quote": "Do you have any questions about how the weekly calls work?"}
    rec, _ = run(a)
    assert rec["phases"]["pitch_start"] == "T019"
    assert rec["meta"]["steps"]["S0"]["reasons"].get("pitch:discovery_too_far") == 1


def test_the_pitch_end_is_the_first_price_after_the_pitch_start():
    """PB-4, recomputed after the code moves the price or the start (Antoine's pitch end was on no price nor request)."""
    for answers in (sc.ANSWERS, None):
        a = copy.deepcopy(sc.ANSWERS)
        if answers is None:
            t = next(x for x in a["lite.s0_phases"]["turns"] if x["turn"] == "T019")
            t["followed_by_discovery"] = True
            t["next_discovery_question"] = None
        rec, _ = run(a)
        assert rec["phases"]["pitch_end"] == rec["phases"]["first_price"] == "T027"


def test_a_social_question_never_starts_the_discovery():
    """SB-2 by the code: « can you hear me? » coded S by the model does not open the perimeter."""
    a = copy.deepcopy(sc.ANSWERS)
    a["lite.s1_discovery"]["questions"][0].update(letter="S", out_reason=None)
    rec, _ = run(a)
    assert rec["phases"]["discovery_start"] == "T003"
    first = next(s for s in sols(rec) if s["turn"] == "T001")
    assert not first["in_perimeter"] and "pre_perimeter" in first["tags"]


# ---------------------------------------------------------------- 2026-11-19: SPIN rules the code now enforces
def test_the_load_of_a_solution_and_an_offer_question_are_out_by_code():
    """§3 hard rules read by the code (README approximation 4): time or budget the prospect would put into it, a question
    about the offer. The letters of the audit of November 2026 (rewritten)."""
    from callqa_lite.spin import decide_letter
    for q in ("combien d'heures par semaine tu peux allouer ?", "tu as combien de temps à consacrer pour te former ?",
              "c'est quoi le budget, du coup ?", "How many hours a week can you dedicate to it?"):
        d = decide_letter({"letter": "S"}, q)
        assert (d.letter, d.reason) == ("OUT", "solution_load"), q
    for q in ("Qu'est-ce que tu as besoin de savoir sur notre accompagnement ?", "What do you want to know about the program?"):
        d = decide_letter({"letter": "N"}, q)
        assert (d.letter, d.reason) == ("OUT", "offer_info"), q
    for q in ("ça fait combien de temps que tu donnes des cours ?", "tu as déjà suivi un accompagnement avant ?"):
        assert decide_letter({"letter": "S"}, q).letter == "S", q


def test_a_register_named_by_the_question_is_not_read_in_the_answer():
    """SB-27 / SB-28 by the code: the asked clause names one domain (Ouala's Q032.1, rewritten in English here)."""
    a = copy.deepcopy(sc.ANSWERS)
    q = next(x for x in a["lite.s1_discovery"]["questions"] if x["turn"] == "T011")
    q.update(register_domain="money", register_basis="answer", register_turn="T012",
             register_quote="I miss dinner three nights a week")                  # « your family » is asked: Time & load
    rec, _ = run(a)
    by = {x["turn"]: x for x in sols(rec)}
    assert by["T011"]["register"] == "time_load" and by["T011"]["register_basis"] == "named"
    assert rec["meta"]["steps"]["S1"]["reasons"].get("register:named_in_question", 0) >= 1


def test_an_atom_under_an_out_question_goes_to_the_question_of_its_answer():
    """An atom the model listed under an OUT question is not lost: it goes to the coded question whose answer holds its
    turn (it used to disappear without being counted)."""
    a = copy.deepcopy(sc.ANSWERS)
    t3 = next(x for x in a["lite.s1_discovery"]["questions"] if x["turn"] == "T003")
    moved = t3["atoms"].pop(0)                                                    # the 1,500 a month SITUATION
    a["lite.s1_discovery"]["questions"][0]["atoms"] = [moved]                     # put under « can you hear me okay? »
    rec, _ = run(a)
    kept = [x for x in rec["results"]["SPIN"]["details"]["atom_decisions"] if x["decision"] == "kept"]
    assert any(x["quote"] == moved["quote"] and x["solicitation"] == "Q003.1" for x in kept)


def test_a_framing_question_is_out_and_an_effect_said_after_an_out_question_counts():
    """SB-2 and SB-8 (Romain, 2026-11-20): the framing question is OUT `nothing`; an effect the prospect states in answer
    to it, in no coded answer, is volunteered speech attached to the first coded question (D1 to D4, never D5)."""
    a = copy.deepcopy(sc.ANSWERS)
    a["lite.s1_discovery"]["questions"].insert(0, {
        "turn": "T001", "quote": "can you hear me okay?", "letter": "S",
        "atoms": [{"type": "DESIRE", "turn": "T002", "quote": "thanks for having me today"}]})
    rec, _ = run(a)
    s = next(x for x in sols(rec) if x["turn"] == "T001")
    assert s["letter"] in (None, "OUT")
    atoms = rec["results"]["SPIN"]["details"]["atom_decisions"]
    got = [x for x in atoms if x["turn"] == "T002"]
    assert got and got[0]["solicitation"] == "Q003.1"                      # the first coded question
    assert rec["meta"]["steps"]["S1"]["reasons"]["atom:outside_answers"] == 1     # only the sales turn of the fixture


def test_sb35_a_register_whose_answer_turn_is_missing_is_found_by_its_words():
    a = copy.deepcopy(sc.ANSWERS)
    q = next(x for x in a["lite.s1_discovery"]["questions"] if x["turn"] == "T009")
    q.pop("register_turn")                                   # the words are given, the turn is not
    rec, _ = run(a)
    s = next(x for x in sols(rec) if x["turn"] == "T009")
    assert s["register"] == "mental_emotional" and s["register_reference_turn"] == "T010"
    assert rec["meta"]["steps"]["S1"]["reasons"]["register:turn_found_by_code"] == 1
    q.pop("register_quote")                                  # no words: no proof, the register stays undecided
    rec, _ = run(a)
    s = next(x for x in sols(rec) if x["turn"] == "T009")
    assert s["register"] is None and s["register_status"] == "to_review"


def test_s3_2026_11_21_a_question_cut_before_its_end_is_out_nothing():
    a = copy.deepcopy(sc.ANSWERS)
    t = sc.context()
    t.turns[6].text = "What's been stopping you from getting more..."
    q = next(x for x in a["lite.s1_discovery"]["questions"] if x["turn"] == "T007")
    q["quote"] = "What's been stopping you from getting more..."
    rec = analyse(t, MockLiteClient(a))
    s = next(x for x in sols(rec) if x["turn"] == "T007")
    assert s["letter"] == "OUT" and s["out_reason"] == "nothing" and "cut_by_code" in s["tags"]


def test_sb27_a_question_without_s1_reading_takes_the_register_its_words_name():
    a = copy.deepcopy(sc.ANSWERS)
    q = next(x for x in a["lite.s1_discovery"]["questions"] if x["turn"] == "T007")      # "...more clients?": Financial
    for k in ("register_domain", "register_basis", "register_turn", "register_quote"):
        q.pop(k, None)
    rec, _ = run(a)
    s = next(x for x in sols(rec) if x["turn"] == "T007")
    assert s["register"] == "financial" and s["register_basis"] == "named"


def test_sb31_a_neutral_question_without_register_reading_takes_its_answer_words_else_other():
    a = copy.deepcopy(sc.ANSWERS)
    q = next(x for x in a["lite.s1_discovery"]["questions"] if x["turn"] == "T005")       # after the opening (SB-1)
    for k in ("register_domain", "register_basis", "register_turn", "register_quote"):
        q.pop(k, None)
    q.update(quote="And what happened after that?", answer=None)
    t = sc.context()
    t.turns[4].text = "And what happened after that?"
    t.turns[5].text = "My income from design is about 1,500 a month."                # the answer names money
    rec = analyse(t, MockLiteClient(a))
    s = next(x for x in sols(rec) if x["turn"] == "T005")
    assert s["register"] == "financial" and s["register_basis"] == "answer" and s["register_reference_turn"] == "T006"
    t = sc.context()
    t.turns[4].text = "And what happened after that?"
    t.turns[5].text = "I saw your video and I wanted to talk to you."               # an answer that names no domain
    rec = analyse(t, MockLiteClient(a))
    s = next(x for x in sols(rec) if x["turn"] == "T005")
    assert s["register"] == "other" and s["register_status"] == "single_reading"
    assert rec["meta"]["steps"]["S1"]["reasons"]["register:other_by_code"] == 1


def test_2026_11_21_the_work_of_today_has_no_register():
    a = copy.deepcopy(sc.ANSWERS)
    t = sc.context()
    t.turns[4].text = "Great. So what's your job today, do you teach?"                  # names only the work of today
    q = next(x for x in a["lite.s1_discovery"]["questions"] if x["turn"] == "T005")
    q.update(quote="do you teach?", register_domain="money", register_basis="named", register_quote="do you teach")
    rec = analyse(t, MockLiteClient(a))
    s = next(x for x in sols(rec) if x["turn"] == "T005")
    assert s["register"] == "other" and s["register_basis"] == "named" and s["register_domain"] == "status"


def _opening(t, a):
    rec = analyse(t, MockLiteClient(a))
    return rec["results"]["SPIN"]["details"]["perimeter"], {x["turn"]: x for x in sols(rec)}


def test_sb1_2026_11_21_the_discovery_opens_on_a_register():
    """Romain, 2026-11-21: the discovery opens at the first question that opens on one of the four registers, or at the
    first information of the prospect in one of them; every question before is framing and warm-up."""
    a = copy.deepcopy(sc.ANSWERS)
    per, s = _opening(sc.context(), a)
    assert per["start"] == "T003" and per["opened_by"] == "question"            # its register is read in its answer
    # a neutral question first (« Sans registre »): warm-up, the discovery opens on the next one
    a = copy.deepcopy(sc.ANSWERS)
    q = next(x for x in a["lite.s1_discovery"]["questions"] if x["turn"] == "T003")
    for k in ("register_domain", "register_basis", "register_turn", "register_quote"):
        q.pop(k, None)
    q.update(quote="what do you teach?", atoms=[], answer=None)
    t = sc.context()
    t.turns[2].text = "Great to meet you. So what do you teach?"
    t.turns[3].text = "I teach Spanish in a high school."
    per, s = _opening(t, a)
    assert per["start"] == "T005" and s["T003"]["in_perimeter"] is False and "pre_perimeter" in s["T003"]["tags"]
    # the prospect gives a figure of their situation in answer to a framing question: the discovery opens there
    t.turns[3].text = "I teach Spanish, and I only make about 900 a month from it."
    per, s = _opening(t, a)
    assert per["start"] == "T004" and per["opened_by"] == "prospect_info" and s["T005"]["in_perimeter"] is True
    assert s["T003"]["in_perimeter"] is False


def test_sb1_2026_11_21_a_framing_question_never_opens_with_an_idiom():
    from lnp_callqa.competences import spin as E
    assert E.lexicon_hits("vous avez eu le temps de la regarder un petit peu ?") == {}
    assert E.lexicon_hits("on s'est vu la semaine dernière") == {}
    assert "time_load" not in E.lexicon_hits("je fais un peu de bruit, son coupe")    # « son » is French here
    assert E.lexicon_hits("my son is sick") == {"time_load": "son"}
    assert E.info_opens("PAIN", "je ne sais plus quoi faire") and not E.info_opens("SITUATION", "je suis prof d'anglais")
    assert E.info_opens("SITUATION", "je m'occupe seule de mes enfants")


# ---------------------------------------------------------------- C1b (2026-11-23): a person already enrolled
def _with_enrolled(value, turn=None, quote=None):
    a = copy.deepcopy(sc.ANSWERS)
    s0 = dict(a["lite.s0_phases"])
    s0["enrolled_client"] = {"value": value, "turn": turn, "quote": quote}
    a["lite.s0_phases"] = s0
    return a


def test_c1b_a_session_with_an_enrolled_person_is_not_scored():
    rec, client = run(_with_enrolled(True, "T019", "show you the program"))
    assert rec["status"] == "not_sales_call"
    assert all(r["status"] == "excluded" and r["reasons"] == ["not_sales_call"] for r in rec["results"].values())
    kind = rec["results"]["GAP"]["details"]["call_kind"]
    assert kind["turn"] == "T019" and kind["quote"] == "show you the program" and rec["meta"]["call_kind"]["not_sales"]
    assert [c["task"] for c in client.calls if not c["task"].startswith("lite.sv")] == ["lite.s0_phases"]   # nothing more is asked


def test_c1b_the_code_keeps_the_call_without_a_valid_quote_or_when_the_person_joins_after_the_price():
    for answers in (_with_enrolled(True, "T019", "an access you already paid for"),     # not in the turn
                    _with_enrolled(True, "T027", "The investment is 5,800"),            # at the first price: a sale
                    _with_enrolled(False)):
        rec, _ = run(answers)
        assert rec["status"] == "ok" and rec["results"]["GAP"]["status"] != "excluded"
    rec, _ = run(_with_enrolled(True, "T027", "The investment is 5,800"))
    assert rec["meta"]["steps"]["S0"]["reasons"]["enrolled_client:after_price"] == 1



# ---------------------------------------------------------------- two readings of S2 (2026-11-23)
def test_s2_two_readings_a_component_the_first_left_out_is_taken_from_the_second():
    """The model left the cost out of the restitution in one reading: the second reading's cost is kept."""
    a = copy.deepcopy(sc.ANSWERS)
    first = copy.deepcopy(sc.S2)
    first["passages"][0]["clauses"] = [c for c in first["passages"][0]["clauses"] if c["component"] != "COST"]
    a["lite.s2_gap"] = [first, sc.S2]
    rec, _ = run(a)
    g = rec["results"]["GAP"]
    assert g["verdict"] == "present" and g["details"]["restitution"]["components"]["COST"]["match"] == "verbatim"
    assert rec["meta"]["steps"]["S2"]["reasons"]["readings:component_from_second"] == 1
    rec1, _ = run(dict(a, **{"lite.s2_gap": first}), s2_readings=1)             # one reading: the cost is missing
    assert rec1["results"]["GAP"]["verdict"] == "absent" and rec1["results"]["GAP"]["details"]["absence_reason"] == "cost_missing"


def test_s2_two_readings_a_passing_clause_wins_and_a_failed_second_reading_changes_nothing():
    from callqa_lite.gap import merge_readings
    ctx = sc.context()
    good = copy.deepcopy(sc.S2)
    bad = copy.deepcopy(sc.S2)
    for c in bad["passages"][0]["clauses"]:
        if c["component"] == "COST":
            c["key_expression"], c["sales_quote"] = "barely see my kids", "your family pays for it"
    m = merge_readings(ctx, bad, good)
    cost = [c for c in m["passages"][0]["clauses"] if c["component"] == "COST"]
    assert cost and all(c["sales_quote"] != "your family pays for it" for c in cost)       # the passing clause wins
    assert merge_readings(ctx, good, None) is good
    a = copy.deepcopy(sc.ANSWERS)
    a["lite.s2_gap"] = [sc.S2, "not json", "still not json"]
    rec, _ = run(a)
    assert rec["results"]["GAP"]["verdict"] == "present"                            # the first reading stands
