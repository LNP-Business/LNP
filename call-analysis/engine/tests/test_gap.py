"""Gap formalisation (GAP-1.3): minimal pairs of Annex A (pure decisions) and Annex B cases on real transcripts."""
from __future__ import annotations
import os

import re
from pathlib import Path

import pytest

from lnp_callqa.competences import gap as g
from lnp_callqa.competences.gap import GapCompetence, Restitution, Span
from lnp_callqa.core.foundation import repair_attribution
from lnp_callqa.core.llm import MockClient
from lnp_callqa.core.models import Atom, CallContext, Evidence, PROSPECT, SALES, Solicitation, Turn
from lnp_callqa.core.runner import Runner

RUNS = Path(os.environ.get("CALLQA_CORPUS", str(Path(__file__).parent / "fixtures" / "transcripts")))
LINE = re.compile(r"^\[(T\d+\w?) ([\d:]+)\] (SALES|PROSPECT|OTHER): ?(.*)$")

DEFAULTS = {
    "gap.restitution": {"clauses": [], "ends_with_new_topic_question": False, "new_topic_question_quote": None},
    "gap.validation": {"outcome": "none"},
    "gap.a_current": {"present_state": True},
    "gap.stopping": {"is_stopping_question": False},
    "gap.horizon": {"horizon_quote": None, "horizon_turn": None, "horizon": None, "binding": None},
}


# ------------------------------------------------------------------------------------------- helpers
def load_turns(call: str) -> list[Turn]:
    out = []
    for line in (RUNS / call / "transcript_compact.txt").read_text(encoding="utf-8").splitlines():
        m = LINE.match(line.strip())
        if m:
            out.append(Turn(m[1], len(out) + 1, m[2], m[3], m[3], m[4]))
    return out


def synth(lines: list[tuple[str, str]]) -> list[Turn]:
    role = {"S": SALES, "P": PROSPECT}
    return [Turn(f"T{i:03d}", i, f"00:{i:02d}", role[r], role[r], t) for i, (r, t) in enumerate(lines, 1)]


def ctx_of(turns, discovery="T001", pitch=None, price=None, sols=(), atoms=()) -> CallContext:
    ctx = CallContext("c", "valentino", "2026-10-01T10:00:00Z", "UTC", turns)
    ctx.phases.discovery_start, ctx.phases.pitch_start, ctx.phases.first_price = discovery, pitch, price
    ctx.solicitations, ctx.atoms = list(sols), list(atoms)
    return ctx


def sol(id_, turn, letter, text, answers=()):
    return Solicitation(id_, turn, text, letter, answer_turns=list(answers))


def atom(id_, type_, turn, quote, letter, sol_id=None, object=None, domain=None, quantified=False, value=None,
         unit=None, prompted=False):
    return Atom(id_, type_, Evidence(quote, turn, PROSPECT), sol_id, letter, object, domain, quantified, value, unit,
                prompted_by_sales=prompted)


def clause(component, sales_turn, sales_quote, source_turn=None, key_expression=None, **kw):
    d = {"component": component, "sales_turn": sales_turn, "sales_quote": sales_quote, "about_prospect": True,
         "declarative": True, "source_turn": source_turn, "key_expression": key_expression}
    d.update(kw)
    return d


def runner(answers: dict) -> Runner:
    """answers: {(task_id, unit_id_prefix): answer}; anything else gets the neutral default."""
    def fb(task_id, unit_id, prompt, pass_no):
        for (tid, prefix), a in answers.items():
            if tid == task_id and unit_id.startswith(prefix):
                return a
        return DEFAULTS[task_id]
    return Runner(MockClient({}, fb))


def restit(ctx, start, end, clauses, new_topic=None) -> Restitution:
    sp = Span(start, end, [t.id for t in ctx.window(start, None)][: ctx.n(end) - ctx.n(start) + 1], ["S1"])
    ans = {"clauses": clauses, "ends_with_new_topic_question": bool(new_topic), "new_topic_question_quote": new_topic}
    return g.decide_restitution(ctx, sp, ans, "verified")


# ------------------------------------------------------------------------------------------- pair 1 (GB-4)
PAIR1 = [("S", "Where are you at right now?"), ("P", "I make about 2K a month right now from design work."),
         ("S", "And where do you want to be?"), ("P", "My goal is 10K a month within a year honestly."),
         ("S", "So your goal is 10K a month, right?")]


def test_pair_1a_single_component_is_not_a_restitution():
    ctx = ctx_of(synth(PAIR1))
    r = restit(ctx, "T005", "T005", [clause("B", "T005", "your goal is 10K a month", "T004", "my goal is 10K a month")])
    assert r.components == {"B"} and not r.is_restitution                       # GB-4, X2


def test_pair_1b_two_components_restitution_cannot_pass_gate():
    lines = PAIR1[:-1] + [("S", "So you're at 2K, your goal is 10K a month, right?")]
    ctx = ctx_of(synth(lines))
    r = restit(ctx, "T005", "T005", [clause("A", "T005", "you're at 2K", "T002", "2K"),
                                     clause("B", "T005", "your goal is 10K a month", "T004", "my goal is 10K a month")])
    assert r.is_restitution and r.components == {"A", "B"}
    r.validation, r.effective_outcome = {"outcome": "confirmed"}, "confirmed"
    verdict, reasons, _ = g.gate([r])
    assert verdict == "absent" and reasons == ["problem_missing", "cost_missing"]


# ------------------------------------------------------------------------------------------- pair 2 (gate, GB-5)
PAIR2 = [("S", "What's held you back?"), ("P", "Honestly confidence, I just don't have the confidence."),
         ("S", "And what has it cost you?"), ("P", "It's cost me three years of my life, three years.")]


def _pair2(rest_text, answer, pitch):
    turns = synth(PAIR2 + [("S", rest_text), ("P", answer), ("S", "Let me show you the program now.")])
    sols = [sol("Q1", "T001", "P", "What's held you back?", ["T002"]), sol("Q3", "T003", "I", "cost?", ["T004"])]
    atoms = [atom("a1", "BLOCKER", "T002", "I just don't have the confidence", "P", "Q1", "confidence"),
             atom("a2", "IMPACT", "T004", "It's cost me three years of my life", "I", "Q3", "confidence", "time",
                  True, 3, "years")]
    return ctx_of(turns, pitch=pitch, sols=sols, atoms=atoms)


def _pair2_answers(fair=True):
    cl = [clause("PROBLEM", "T005", "what's held you back is confidence", "T002", "confidence", as_holding_back=True),
          clause("COST", "T005", "it's cost you three years", "T004", "three years")]
    a = {("gap.restitution", "restit:T005"): {"clauses": cl, "ends_with_new_topic_question": False}}
    if fair:
        a[("gap.validation", "valid:T005")] = {"outcome": "confirmed", "agreement_quote": "Yeah, exactly."}
    return a


def test_pair_2a_gap_present():
    ctx = _pair2("So what's held you back is confidence, and it's cost you three years. Fair?", "Yeah, exactly.", "T007")
    res = GapCompetence().run(ctx, runner(_pair2_answers()))
    assert res.verdict == "present" and res.reasons == []
    assert res.details["validation_turn"] == "T006" and res.details["restitution_span"] == ["T005", "T005"]
    g6 = next(i for i in res.items if i.id == "G6")
    assert g6.level == 1                                                             # confirmed, no content
    assert res.score >= 25                                                           # §5.2: at least G5 = G6 = 1
    assert res.details["validated_P"]["key_expression"] == "confidence"


def test_pair_2b_offer_before_validation_not_validated():
    # long enough for signal S2 (no opener, no validation request: A1)
    ctx = _pair2("So what's held you back is confidence, you just don't have the confidence, and it's cost you three "
                 "years, you've lost three years of your life. Let me show you how we fix that.",
                 "Okay sounds good to me.", "T007")
    res = GapCompetence().run(ctx, runner(_pair2_answers(fair=False)))
    assert res.verdict == "absent" and res.reasons == ["not_validated"]
    assert res.score == 0
    r = res.details["restitutions"][0]
    assert r["validation"]["rule"] == "offer_mentioned_before_validation"           # GB-5, X8


# ------------------------------------------------------------------------------------------- pair 3, 10, 11, 12 (GB-22..24)
def _clause_ctx(prospect: str, sales: str):
    ctx = ctx_of(synth([("S", "Tell me more about that."), ("P", prospect), ("S", sales)]))
    return ctx, Span("T003", "T003", ["T003"], ["S2"])


@pytest.mark.parametrize("prospect,sales,ke,expected", [
    ("I've lost so much time.", "and you've lost so much time.", "I've lost so much time", "verbatim"),         # 3a
    ("I've lost so much time.", "and you've wasted years on this.", "lost so much time", "paraphrased"),        # 3c
    ("Oh, very stressed.", "and you've been very stressed.", "very stressed", "verbatim"),                       # 10a
    ("Oh, very stressed.", "there's been a lot of stress.", "very stressed", "paraphrased"),                     # 10b
    ("I'm making about 1,800 a month.", "you're at 1,800 a month", "1,800 a month", "verbatim"),                 # 11a
    ("I'm making about 1,800 a month.", "you're at roughly 2K", "1,800 a month", "paraphrased"),                 # 11b
    ("Failure.", "which, in your words, is failure.", "Failure", "verbatim"),                                    # 12a
    ("I wouldn't be happy.", "and in your words you'd be stuck in the hamster wheel.", "I wouldn't be happy",
     "paraphrased"),                                                                                              # 12b
])
def test_verbatim_pairs(prospect, sales, ke, expected):
    ctx, sp = _clause_ctx(prospect, sales)
    c = g.classify_clause(ctx, clause("COST", "T003", sales, "T002", ke), sp, None)
    assert c.match == expected, c.reason


def test_pair_12a_explicit_quote_marker_recorded():
    ctx, sp = _clause_ctx("Failure.", "which, in your words, is failure.")
    c = g.classify_clause(ctx, clause("COST", "T003", "which, in your words, is failure.", "T002", "Failure"), sp, None)
    assert c.match == "verbatim" and c.explicit_quote                              # GB-23


def test_pair_3b_cost_invented_by_sales_is_untraced():
    ctx, sp = _clause_ctx("I just want to design.", "and that's probably costing you a lot of money.")
    c = g.classify_clause(ctx, clause("COST", "T003", "that's probably costing you a lot of money", None, None), sp, None)
    assert c.match == "untraced"                                                    # GB-7, X5


def test_generic_key_expression_rejected():
    ctx, sp = _clause_ctx("I want to do a lot of things.", "you want to do a lot of things")
    c = g.classify_clause(ctx, clause("B", "T003", "you want to do a lot of things", "T002", "a lot of things"), sp, None)
    assert c.match == "paraphrased" and c.reason == "generic"                      # GB-22 d


def test_figure_computed_by_sales_is_excluded():
    """GB-24 / X12: the sales computes 30K, the prospect repeats it, the sales restates it."""
    turns = synth([("S", "Six times five works out to roughly $30,000 you lost, right?"),
                   ("P", "Yeah I guess it's like 30,000 lost."),
                   ("S", "And that's potentially already cost you 30,000, maybe more.")])
    ctx = ctx_of(turns)
    c = g.classify_clause(ctx, clause("COST", "T003", "already cost you 30,000", "T002", "30,000 lost"),
                          Span("T003", "T003", ["T003"], []), None)
    assert c.match in ("excluded", "paraphrased")
    c2 = g.classify_clause(ctx, clause("COST", "T003", "already cost you 30,000", "T002", "30,000"),
                           Span("T003", "T003", ["T003"], []), None)
    assert c2.match == "excluded" and c2.reason == "first_said_by_sales"


# ------------------------------------------------------------------------------------------- pair 4, 5 (validation)
def _val_ctx(rest: str, answer: str):
    ctx = ctx_of(synth([("S", "What has it cost you?"), ("P", "Honestly it's cost me three years and my confidence."),
                        ("S", rest), ("P", answer)]))
    r = restit(ctx, "T003", "T003", [clause("PROBLEM", "T003", "my confidence", "T002", "my confidence"),
                                     clause("COST", "T003", "three years", "T002", "three years")])
    return ctx, r


def test_pair_4a_confirmed_with_content():
    ctx, r = _val_ctx("So it's your confidence and three years, that's where you're at. Did I get that right?",
                      "Yes, and my husband doesn't believe in it either.")
    vt, why = g.validation_turn(ctx, r)
    out = g.decide_validation(ctx, r, vt, {"outcome": "confirmed_with_content", "agreement_quote": "Yes",
                                           "content_quote": "my husband doesn't believe in it either"})
    assert out["outcome"] == "confirmed_with_content"


def test_pair_4b_plain_yes_is_confirmed_even_if_model_says_content():
    ctx, r = _val_ctx("So it's your confidence and three years, that's where you're at. Did I get that right?", "Yes.")
    vt, _ = g.validation_turn(ctx, r)
    out = g.decide_validation(ctx, r, vt, {"outcome": "confirmed_with_content", "content_quote": "Yes."})
    assert out["outcome"] == "confirmed"                                            # C3 rule 5


def test_pair_5a_s3_request_answered():
    ctx, r = _val_ctx("Your confidence and three years, that's what's been holding you back. Is that fair?", "Yeah.")
    vt, why = g.validation_turn(ctx, r)
    assert vt is not None and vt.id == "T004" and r.request


def test_pair_5b_answer_to_another_question_is_none():
    ctx = ctx_of(synth([("S", "What has it cost you?"), ("P", "Honestly it's cost me three years and my confidence."),
                        ("S", "Your confidence and three years, that's what's been holding you back. "
                              "How many hours a week can you commit?"), ("P", "Maybe 10.")]))
    r = restit(ctx, "T003", "T003", [clause("PROBLEM", "T003", "Your confidence", "T002", "my confidence"),
                                     clause("COST", "T003", "three years", "T002", "three years")],
               new_topic="How many hours a week can you commit?")
    vt, why = g.validation_turn(ctx, r)
    assert vt is None and why == "captured_by_other_question"                       # GB-9, X7


def test_gb15_no_to_missed_anything_is_confirmed():
    ctx, r = _val_ctx("Confidence and three years. Did I miss anything?", "No.")
    vt, _ = g.validation_turn(ctx, r)
    assert g.decide_validation(ctx, r, vt, {"outcome": "rejected"})["outcome"] == "confirmed"


def test_gb16_partial_agreement_with_correction_is_corrected():
    ctx, r = _val_ctx("Confidence and three years. Did I get that right?", "99%, except it's more like four years.")
    vt, _ = g.validation_turn(ctx, r)
    out = g.decide_validation(ctx, r, vt, {"outcome": "confirmed", "correction_quote": "it's more like four years",
                                           "corrected_components": ["COST"]})
    assert out["outcome"] == "corrected"


def test_gb17_emotional_reaction_is_content():
    ctx, r = _val_ctx("Confidence and three years. Did I get that right?", "Why do you have to go saying that?")
    vt, _ = g.validation_turn(ctx, r)
    out = g.decide_validation(ctx, r, vt, {"outcome": "confirmed", "emotional_reaction": True, "disagreement": False})
    assert out["outcome"] == "confirmed_with_content"


def test_gb26_repeating_the_sales_words_is_confirmed():
    ctx, r = _val_ctx("You're stuck in the hamster wheel with your confidence and three years. Right?",
                      "Yes, I'm stuck in the hamster wheel.")
    vt, _ = g.validation_turn(ctx, r)
    out = g.decide_validation(ctx, r, vt, {"outcome": "confirmed_with_content",
                                           "content_quote": "I'm stuck in the hamster wheel"})
    assert out["outcome"] == "confirmed"


# ------------------------------------------------------------------------------------------- pair 6, 9a (components)
def test_pair_6a_other_person_is_not_a_component_6b_is():
    ctx, sp = _clause_ctx("I'm stuck at 2K a month.", "Amelia was exactly where you are, stuck at 2K. You're stuck at 2K")
    c6a = g.classify_clause(ctx, clause("A", "T003", "Amelia was exactly where you are, stuck at 2K", "T002", "stuck at 2K",
                                        about_prospect=False), sp, None)
    c6b = g.classify_clause(ctx, clause("A", "T003", "You're stuck at 2K", "T002", "stuck at 2K"), sp, None)
    assert c6a.match == "excluded" and c6b.match == "verbatim"


def test_pair_9a_income_is_never_a_cost():
    ctx = ctx_of(synth([("S", "What do you make at your job?"), ("P", "I make 4K at my job right now."),
                        ("S", "You make 4K at your job.")]),
                 atoms=[atom("a1", "SITUATION", "T002", "I make 4K at my job", "S", None, None, "money", True, 4000,
                             "USD/month")])
    c = g.classify_clause(ctx, clause("COST", "T003", "You make 4K at your job", "T002", "I make 4K at my job"),
                          Span("T003", "T003", ["T003"], []), None)
    assert c.match == "excluded" and c.reason == "income_not_cost"                 # X6


def test_pair_9b_time_and_money_cost_quantified():
    turns = synth([("S", "What does that cost you?"),
                   ("P", "I'm spending 20 hours a week on admin work that pays 23 dollars an hour."),
                   ("S", "You're spending 20 hours a week on admin work that pays 23 dollars an hour.")])
    ctx = ctx_of(turns, atoms=[atom("a1", "IMPACT", "T002", "I'm spending 20 hours a week on admin work", "I", None,
                                    "admin", "time", True, 20, "hours/week")])
    c = g.classify_clause(ctx, clause("COST", "T003", "You're spending 20 hours a week on admin work", "T002",
                                      "spending 20 hours a week on admin work"), Span("T003", "T003", ["T003"], []), None)
    assert c.match == "verbatim" and c.source_atom == "a1"


# ------------------------------------------------------------------------------------------- pair 7 (window)
def test_pair_7a_7b_before_and_after_pitch():
    for pitch, expected in (("T007", "present"), ("T005", "absent")):
        ctx = _pair2("So what's held you back is confidence, and it's cost you three years. Fair?", "Yeah, exactly.",
                     pitch)
        res = GapCompetence().run(ctx, runner(_pair2_answers()))
        assert res.verdict == expected
        if expected == "absent":
            assert res.reasons == ["restitution_after_pitch"]                       # X3, GB-20


# ------------------------------------------------------------------------------------------- pair 8 (corrections)
PAIR8 = [("S", "What's held you back?"), ("P", "Honestly confidence, I just don't have the confidence."),
         ("S", "And what has it cost you, in money?"), ("P", "It's cost me about 4K a month, every month."),
         ("S", "So what's held you back is confidence, and it's cost you about 4K a month. Did I get that right?"),
         ("P", "Not quite, it's more like 3K, not 4K.")]


def _pair8(restate: str, answers_extra: dict):
    turns = synth(PAIR8 + [("S", restate), ("P", "Exactly."), ("S", "Let me show you the program.")])
    ctx = ctx_of(turns, pitch="T009")
    a = {("gap.restitution", "restit:T005"): {"clauses": [
        clause("PROBLEM", "T005", "what's held you back is confidence", "T002", "confidence", as_holding_back=True),
        clause("COST", "T005", "it's cost you about 4K a month", "T004", "4K a month")]},
        ("gap.validation", "valid:T005"): {"outcome": "corrected", "correction_quote": "it's more like 3K",
                                            "corrected_components": ["COST"]}}
    a.update(answers_extra)
    return ctx, runner(a)


def test_pair_8a_corrected_then_restated_and_confirmed_passes():
    ctx, rn = _pair8("Got it, 3K a month, and that's because of confidence.", {
        ("gap.restitution", "restit:T007"): {"clauses": [
            clause("COST", "T007", "Got it, 3K a month", "T006", "3K"),
            clause("PROBLEM", "T007", "that's because of confidence", "T002", "confidence")]},
        ("gap.validation", "valid:T007"): {"outcome": "confirmed", "agreement_quote": "Exactly."}})
    res = GapCompetence().run(ctx, rn)
    assert res.verdict == "present"
    corr = res.details["diagnostics"]["corrections"]
    assert corr and corr[0]["effective"] == "corrected_then_confirmed"
    assert next(i for i in res.items if i.id == "G6").level == 1


def test_pair_8b_correction_not_restated_fails():
    ctx, rn = _pair8("Got it. So let me show you the program.", {})
    res = GapCompetence().run(ctx, rn)
    assert res.verdict == "absent" and res.reasons == ["not_validated"]            # X9


# ------------------------------------------------------------------------------------------- pairs 13..15 (formula)
def test_pair_15a_15b_same_unit_and_unit_mismatch():
    a = g.Statement("A", "a1", "about 2K a month", "T002", "S", "Q1", None, "money", True, 2000, "USD/month", "SITUATION")
    b1 = g.Statement("B", "b1", "10K a month", "T004", "N", "Q2", None, "money", True, 10000, "USD/month", "DESIRE")
    b2 = g.Statement("B", "b2", "to quit my job", "T004", "N", "Q2", None, None, False, None, "status", "DESIRE")
    ctx = ctx_of(synth([("S", "x"), ("P", "about 2K a month"), ("S", "y"), ("P", "10K a month, to quit my job")]))
    sa, sb, rule = g.select_a_b(ctx, [a], [b1])
    assert (sa.atom_id, sb.atom_id, rule) == ("a1", "b1", "same_unit")
    items = g.score_items(ctx, None, sa, sb, None, None, None, {})
    assert next(i for i in items if i.id == "G3").level == 2
    sa, sb, rule = g.select_a_b(ctx, [a], [b2])
    items = g.score_items(ctx, None, sa, sb, None, None, None, {})
    assert next(i for i in items if i.id == "G3").level == 0                       # unit_mismatch


def test_pair_14a_14b_single_blocker_and_several_blockers():
    turns = synth([("S", "What's held you back?"), ("P", "One, self-doubt. Two, change is scary."),
                   ("S", "And what has that cost you?"), ("P", "Two years, I've lost two years."),
                   ("S", "What's holding you back today is self-doubt, and it's cost you two years. Fair?"),
                   ("S", "What's holding you back is self-doubt, fear of change, and it's cost you two years. Fair?")])
    sols = [sol("Q1", "T001", "P", "What's held you back?", ["T002"])]
    atoms = [atom("p1", "BLOCKER", "T002", "One, self-doubt", "P", "Q1", "self-doubt"),
             atom("p2", "BLOCKER", "T002", "Two, change is scary", "P", "Q1", "fear of change")]
    ctx = ctx_of(turns, sols=sols, atoms=atoms)
    st = g.statements_from_atoms(ctx)
    sel_p, rule = g.select_p(ctx, st["PROBLEM"], [sols[0]], ctx.atoms)
    assert sel_p.atom_id == "p1" and rule == "tie_named_first"                     # GB-30 step 3
    r14a = restit(ctx, "T005", "T005", [
        clause("PROBLEM", "T005", "What's holding you back today is self-doubt", "T002", "self-doubt",
               as_holding_back=True),
        clause("COST", "T005", "it's cost you two years", "T004", "two years")])
    conf = g.formula_conformity(ctx, r14a, None, None, sel_p)
    assert conf["single_P"] and conf["P_selected"] and "several_blockers" not in conf["deviations"]
    r14b = restit(ctx, "T006", "T006", [
        clause("PROBLEM", "T006", "What's holding you back is self-doubt", "T002", "self-doubt", as_holding_back=True),
        clause("PROBLEM", "T006", "fear of change", "T002", "change", as_holding_back=True),
        clause("COST", "T006", "it's cost you two years", "T004", "two years")])
    conf = g.formula_conformity(ctx, r14b, None, None, sel_p)
    assert "several_blockers" in conf["deviations"] and not conf["conforms"]       # X14
    assert len(g.roadmap_blockers(ctx, None)) == 2                                   # GB-32


# ------------------------------------------------------------------------------------------- GB-20 priority
def test_gb20_after_pitch_passing_beats_cost_missing():
    def R(comps, before, outcome="confirmed"):
        r = Restitution(Span("T001", "T001", ["T001"], []), "verified")
        r.is_restitution, r.after_pitch, r.effective_outcome = True, not before, outcome
        r.clauses = [g.Clause(c, "q", "T001", "T000", "k", match="verbatim") for c in comps]
        return r
    verdict, reasons, _ = g.gate([R(["PROBLEM", "A"], True), R(["PROBLEM", "COST"], False)])
    assert verdict == "absent" and reasons == ["restitution_after_pitch", "cost_missing"]
    assert g.gate([])[1] == ["no_restitution"]
    assert g.gate([R(["PROBLEM", "COST"], True, "none")])[1] == ["not_validated"]


def test_copilot_warning_threshold():
    assert g.copilot_warning([{"object": "x"}, {"object": "y"}]) is True
    assert g.copilot_warning([{"object": "x"}, {"object": "y"}, {"object": "z"}]) is False


# =========================================================================================== Annex B, real calls
def test_B3_1_call_001_gap_present_G5_capped():
    """B1.1 / B2.1 / B3.1: PROBLEM "support" (T028), COST "motivation" (T052) verbatim; "a lot of stress" not
    verbatim (T050 "stressed"); B paraphrased; "No. Cool." confirmed; before pitch T085 and price T113."""
    turns = load_turns("001")
    sols = [sol("Q025", "T025", "P", turns[24].text, ["T026", "T028"]),
            sol("Q033", "T033", "N", turns[32].text, ["T034"]),
            sol("Q035", "T035", "S", turns[34].text, ["T036", "T038"]),
            sol("Q049", "T049", "I", turns[48].text, ["T050"]),
            sol("Q051", "T051", "I", turns[50].text, ["T052"]),
            sol("Q069", "T069", "N", turns[68].text, ["T070"])]
    atoms = [atom("a28", "PAIN", "T028", "I need the kind of coaching that's going to help support me", "P", "Q025",
                  "marketing support"),
             atom("a34", "DESIRE", "T034", "I would say minimum $5,000", "N", "Q033", None, "money", True, 5000,
                  "USD/month"),
             atom("a36", "SITUATION", "T036", "it's like $23 an hour", "S", "Q035", None, "money", True, 23, "USD/hour"),
             atom("a50", "IMPACT", "T050", "Oh, very stressed, stressed", "I", "Q049", "marketing support", "health"),
             atom("a52", "IMPACT", "T052", "It's like my motivation gets, you know, I basically don't have any", "I",
                  "Q051", "marketing support", "self-belief"),
             atom("a70", "DESIRE", "T070", "I feel like I'm not getting paid what I'm worth often", "N", "Q069")]
    ctx = ctx_of(turns, discovery="T017", pitch="T085", price="T113", sols=sols, atoms=atoms)
    t81 = "T081"
    answers = {
        ("gap.restitution", "restit:T079"): {"clauses": [
            clause("A", t81, "you're in this position now where life has kind of thrown you off course pretty hard"),
            clause("COST", t81, "There's been a lot of stress", "T050", "very stressed"),
            clause("COST", t81, "it's obviously impacting your level of motivation", "T052", "motivation"),
            clause("B", t81, "the amount of money you have in your bank account reflected the value", "T070",
                   "paid what I'm worth"),
            clause("PROBLEM", t81, "it's just having the right support system in place to help you build a portfolio",
                   "T028", "support", as_holding_back=True)],
            "ends_with_new_topic_question": False},
        ("gap.validation", "valid:T079"): {"outcome": "confirmed", "agreement_quote": "No. Cool."}}
    res = GapCompetence().run(ctx, runner(answers))
    d = res.details
    assert res.status == "scored" and res.verdict == "present", res.reasons
    assert d["restitution_span"] == ["T079", "T081"] and d["validation_turn"] == "T082"
    comps = d["restitution"]["components"]
    assert comps["PROBLEM"]["match"] == "verbatim" and comps["PROBLEM"]["key_expression"] == "support"
    assert comps["COST"]["match"] == "verbatim" and comps["COST"]["key_expression"] == "motivation"
    assert comps["B"]["match"] == "paraphrased"                                    # T070 "paid what I'm worth"
    stress = next(c for c in d["restitution"]["clauses"] if c["key_expression"] == "very stressed")
    assert stress["match"] == "paraphrased" and stress["reason"] == "not_in_restitution"   # GB-22 b
    levels = {i.id: i.level for i in res.items}
    assert levels["G5"] == 1 and levels["G6"] == 1                                  # B3.1: G5 = 1
    assert d["validated_P"]["turn"] == "T028" and d["selected_P"]["turn"] == "T028"
    assert d["selected_B"]["turn"] == "T034"
    assert res.score == g.call_score(res.items) and res.score >= 25


def test_B3_2_call_049_gap_present_every_component_verbatim():
    """B1.2 / B3.2: A "not in a steady paying gig" (T049), PROBLEM "as a need" (T071), COST "not sleeping well"
    (T131), confirmed "Pretty much. Yes." (GB-16); G5 = 2 eligible (key expressions of 3 words or more)."""
    turns = load_turns("049")
    ctx = ctx_of(turns, discovery="T024", pitch="T150")
    # foundation C1: the sales question merged into T079 is split out before any competence runs (GB-21)
    repair_attribution(ctx, [{"turn": "T079", "type": "merged",
                              "foreign_quote": "And when that fear showed up, how did it actually shape your actions?"}])
    assert ctx.turn("T079b").role == SALES and "fear" not in ctx.turn("T079").text.lower()
    t = {x.id: x for x in ctx.turns}
    ctx.solicitations = [sol("Q024", "T024", "N", t["T024"].text, ["T025"]),
                         sol("Q038", "T038", "N", t["T038"].text, ["T039"]),
                         sol("Q048", "T048", "S", t["T048"].text, ["T049"]),
                         sol("Q070", "T070", "P", t["T070"].text, ["T071"]),
                         sol("Q130", "T130", "I", t["T130"].text, ["T131"])]
    ctx.atoms = [atom("b25", "DESIRE", "T025", "have a really good business with happy, fun, easy clients", "N", "Q024",
                      None, None, False, None, "status"),
                 atom("b39", "DESIRE", "T039", "10 to 15,000 a month", "N", "Q038", None, "money", True, 10000,
                      "USD/month"),
                 atom("a49", "SITUATION", "T049", "Right now, I'm not in a steady paying gig", "S", "Q048", None, None,
                      False, None, "status"),
                 atom("a49b", "SITUATION", "T049", "I have credit card debt", "S", "Q048", None, "money"),
                 atom("p71", "BLOCKER", "T071", "I haven't treated it as a need ever", "P", "Q070",
                      "treating it as a want"),
                 atom("c131", "IMPACT", "T131", "But come home miserable, bring that to the house", "I", "Q130",
                      "treating it as a want", "family"),
                 atom("c131b", "IMPACT", "T131", "stressed, not sleeping well", "I", "Q130", "treating it as a want",
                      "health")]
    s148 = "T148"
    answers = {
        ("gap.restitution", "restit:T148"): {"clauses": [
            clause("A", s148, "right now we're in a situation where we're not in a steady paying gig", "T049",
                   "not in a steady paying gig"),
            clause("A", s148, "you've got some credit card debt", "T049", "credit card debt"),
            clause("B", s148, "You want your own interior design business", "T025", "business"),
            clause("PROBLEM", s148, "the main thing that's been getting in the way is not treating your goals as a need",
                   "T071", "as a need", as_holding_back=True),
            clause("PROBLEM", s148, "allowing fear to dictate your action", "T079", "fear", as_holding_back=True),
            clause("COST", s148, "coming home miserable, stressed, depressed, and not sleeping well", "T131",
                   "not sleeping well"),
            clause("COST", s148, "you end up working for somebody else, coming home miserable", "T131", "miserable")],
            "ends_with_new_topic_question": False},
        ("gap.validation", "valid:T148"): {"outcome": "confirmed", "agreement_quote": "Pretty much. Yes."}}
    res = GapCompetence().run(ctx, runner(answers))
    d = res.details
    assert res.verdict == "present" and d["validation_turn"] == "T149"
    comps = d["restitution"]["components"]
    assert all(comps[c]["match"] == "verbatim" for c in ("A", "B", "PROBLEM", "COST"))
    assert comps["PROBLEM"]["key_expression"] == "as a need"
    fear = next(c for c in d["restitution"]["clauses"] if c["key_expression"] == "fear")
    assert fear["match"] == "paraphrased" and fear["reason"] == "not_in_source"   # sales words after C1 repair
    conf = d["restitution"]["conformity"]
    assert conf["long_key_expression"] and conf["single_P"] and conf["P_selected"]
    assert d["selected_A"]["turn"] == "T049" and d["selected_B"]["turn"] == "T025"
    levels = {i.id: i.level for i in res.items}
    assert levels["G5"] == 2 and levels["G6"] == 1                                 # "pretty much" = confirmed
    assert levels["G4"] == 1                                                         # cost in a domain, not quantified


def test_B3_9_call_027_restitution_after_pitch():
    """B1.8 / B1.10 / B3.9: T050 is not a restitution (PROBLEM "finances" paraphrased, one component left, ends on a
    new question); T090 complete and confirmed but after the screen share at T086."""
    turns = load_turns("027")
    sols = [sol("Q032", "T032", "N", turns[31].text, ["T033"]),
            sol("Q034", "T034", "S", turns[33].text, ["T035"]),
            sol("Q038", "T038", "S", turns[37].text, ["T039"]),
            sol("Q054", "T054", "P", turns[53].text, ["T055", "T057"]),
            sol("Q082", "T082", "I", turns[81].text, ["T083"])]
    atoms = [atom("b33", "DESIRE", "T033", "gradually, you know, 10 and beyond", "N", "Q032", None, "money", True,
                  10000, "USD/month"),
             atom("a35", "SITUATION", "T035", "I am working part-time for my great-grandmother as her caregiver", "S",
                  "Q034"),
             atom("a39", "SITUATION", "T039", "I'll say the last three", "S", "Q038", None, "time", True, 3, "years"),
             atom("p55", "BLOCKER", "T055", "My preconceived limitations", "P", "Q054", "other people's expectations"),
             atom("p57", "BLOCKER", "T057", "falling into other people's expectations of me", "P", "Q054",
                  "other people's expectations"),
             atom("c83", "IMPACT", "T083", "It feels like a nightmare", "I", "Q082", "other people's expectations",
                  "self-belief")]
    ctx = ctx_of(turns, discovery="T017", pitch="T086", price="T118", sols=sols, atoms=atoms)
    answers = {
        ("gap.restitution", "restit:T050"): {"clauses": [
            clause("A", "T050", "we've spent the last three years researching", "T039", "the last three"),
            clause("PROBLEM", "T050", "one of the biggest bottlenecks has been finances", "T047", "close to $3,000",
                   as_holding_back=True)],
            "ends_with_new_topic_question": True,
            "new_topic_question_quote": "who do you genuinely believe is to find success faster?"},
        ("gap.restitution", "restit:T090"): {"clauses": [
            clause("A", "T090", "you are working part-time for your grandmother", "T035", "working part-time for my"),
            clause("PROBLEM", "T090", "the biggest thing thing to hold us back is the expectations of other people",
                   "T057", "the expectations", as_holding_back=True),
            clause("B", "T090", "you want to make 10K a month", "T033", "10"),
            clause("COST", "T090", "you stay exactly where you are, and that's a nightmare", "T083", "a nightmare")],
            "ends_with_new_topic_question": False},
        ("gap.validation", "valid:T090"): {"outcome": "confirmed", "agreement_quote": "Yes."}}
    res = GapCompetence().run(ctx, runner(answers))
    d = res.details
    assert res.verdict == "absent" and res.reasons[0] == "restitution_after_pitch" and res.score == 0
    by = {tuple(r["span"]): r for r in d["restitutions"]}
    r50, r90 = by[("T050", "T050")], by[("T090", "T090")]
    assert not r50["is_restitution"]                                                 # GB-4
    assert r50["components"]["PROBLEM"]["match"] == "paraphrased"                   # X11
    assert r90["is_restitution"] and not r90["before_first_pitch"]                   # X3
    assert {k for k, v in r90["components"].items() if v and v["match"] == "verbatim"} >= {"A", "PROBLEM", "COST"}
    assert r90["validation"]["outcome"] == "confirmed"
    assert d["diagnostics"]["collected_not_formalised"]["COST"] is True
    assert all(i.level == 0 for i in res.items)


def test_B4_1_call_078_selected_A_is_current_income_not_past():
    """B4.1: A = "$87,000" (S answer), B = "a hundred" (same unit); "over $100,000" is a past income (X13)."""
    turns = load_turns("078")
    sols = [sol("Q045", "T045", "S", turns[44].text, ["T046"]), sol("Q105", "T105", "N", turns[104].text, ["T106"])]
    atoms = [atom("a87", "SITUATION", "T046", "$87,000", "S", "Q045", None, "money", True, 87000, "USD/year"),
             atom("a100", "SITUATION", "T046", "I made over $100,000", "S", "Q045", None, "money", True, 100000,
                  "USD/year"),
             atom("b100", "DESIRE", "T106", "ideally if I can meet to where we're at a hundred", "N", "Q105", None,
                  "money", True, 100000, "USD/year")]
    ctx = ctx_of(turns, discovery="T020", pitch="T185", sols=sols, atoms=atoms)
    past = {("gap.a_current", "acur:a100"): {"present_state": False, "quote": "I made over $100,000"}}
    d = GapCompetence().run(ctx, runner(past)).details
    assert d["selected_A"]["quote"] == "$87,000" and d["selected_B"]["atom"] == "b100"
    assert d["selected_B"]["same_unit"] and d["diagnostics"]["gap_value"] == 13000
    assert d["selected_B"]["horizon"] is None                                        # no deadline given
    # without the present-state check the biggest, most recent figure (past income) would be taken: X13
    d2 = GapCompetence().run(ctx_of(turns, discovery="T020", pitch="T185", sols=sols, atoms=atoms), runner({})).details
    assert d2["selected_A"]["quote"] == "I made over $100,000"


def test_B4_2_call_024_several_blockers_and_roadmap():
    """B4.2 / B1.7: three blockers in one answer to a stopping question; restitution T103 restates two
    (`several_blockers`, G5 capped); COST untraced so the gate fails; 3 roadmap blockers, no Copilot warning."""
    turns = load_turns("024")
    sols = [sol("Q041", "T041", "P", turns[40].text, ["T042"])]
    atoms = [atom("p1", "BLOCKER", "T042", "maybe limiting self-beliefs or having self-doubts", "P", "Q041", "self-doubt"),
             atom("p2", "BLOCKER", "T042", "Two, change is scary", "P", "Q041", "fear of change"),
             atom("p3", "BLOCKER", "T042", "not knowing what the next step is", "P", "Q041", "next step")]
    ctx = ctx_of(turns, discovery="T020", pitch="T105", sols=sols, atoms=atoms)
    answers = {
        ("gap.restitution", "restit:T103"): {"clauses": [
            clause("PROBLEM", "T103", "the biggest thing that's been getting in the way is fear of change", "T042",
                   "change", as_holding_back=True),
            clause("PROBLEM", "T103", "and the self-doubt, which is normal", "T042", "self-doubts", as_holding_back=True),
            clause("A", "T103", "right now, you're in communications", "T024", "communications"),
            clause("B", "T103", "working remotely", "T056", "work remotely"),
            clause("COST", "T103", "you will be selling for a life that you know deep down you don't actually want")],
            "ends_with_new_topic_question": False},
        ("gap.validation", "valid:T103"): {"outcome": "confirmed", "agreement_quote": "Yes."}}
    res = GapCompetence().run(ctx, runner(answers))
    d = res.details
    assert d["selected_P"]["rule"] in ("tie_named_first", "comes_back_most")       # GB-30 step 2/3 among the three
    r = next(x for x in d["restitutions"] if x["span"][0] == "T103")
    assert "several_blockers" in r["conformity"]["deviations"]
    assert res.verdict == "absent" and res.reasons == ["cost_missing"]
    assert d["roadmap"]["count"] == 3 and d["roadmap"]["warning"] is False
    assert "roadmap_insufficient_blockers" not in res.flags


def test_shared_state_contract_keys():
    ctx = _pair2("So what's held you back is confidence, and it's cost you three years. Fair?", "Yeah, exactly.", "T007")
    d = GapCompetence().run(ctx, runner(_pair2_answers())).details
    for k in ("verdict", "validation_turn", "restitution_span", "selected_A", "selected_B", "selected_P",
              "validated_P", "roadmap_blockers", "cost"):
        assert k in d
    assert d["roadmap"]["warning"] is True                                          # 1 blocker < 3 steps (GB-33)
