"""Tests of the SPIN discovery module (SPIN-1.1).

Part 1: pure decision tests on synthetic inputs (letters, atoms, follow-up, chains, items, applicability).
Part 2: full module runs with MockClient on synthetic calls.
Part 3: Annex B calibration cases on real transcripts (tests/fixtures/transcripts/NNN/transcript_compact.txt).
"""
from __future__ import annotations
import os

import re
from pathlib import Path

import pytest

from lnp_callqa.competences import spin as S
from lnp_callqa.core.llm import MockClient
from lnp_callqa.core.models import PROSPECT, SALES, Atom, CallContext, Evidence, Turn
from lnp_callqa.core.runner import Runner

RUNS = Path(os.environ.get("CALLQA_CORPUS", str(Path(__file__).parent / "fixtures" / "transcripts")))
LINE = re.compile(r"^\[(T\d+[a-z]?) ([\d:]+)\] (SALES|PROSPECT|OTHER): ?(.*)$")


# =============================================================================================== helpers
def gate(text: str, letter: str, reason: str | None = None, quote: str | None = None, **over) -> dict:
    """A gate answer that makes the code decide `letter` (quotes are the first words of the solicitation)."""
    q = quote or " ".join(text.split()[:3])
    g = {"is_solicitation": True, "attribution_doubtful": False, "routing": None,
         "g1": {"reason": None, "quote": None},
         "g2": {"neutral_fact": False, "exclusion": None, "quote": None},
         "g3": {"state_or_value": False, "antecedent": "none", "content_supplied": False, "load_named": False,
                "about_offer": False, "action_plan": False, "quote": None},
         "g4": {"consequence": False, "problem_domain": None, "named_domain": None, "same_domain": False,
                "antecedent_solution": False, "quote": None},
         "g5": {"difficulty": False, "sales_named": False, "anchored": False, "quote": None},
         "objection_clarification": False, "tags": [], "split": None, "sub": None}
    if letter == "OUT":
        g["g1"] = {"reason": reason or "nothing", "quote": q}
    elif letter == "S":
        g["g2"].update(neutral_fact=True, quote=q)
    elif letter == "N":
        g["g3"].update(state_or_value=True, antecedent="resolution", quote=q)
    elif letter == "I":
        g["g4"].update(consequence=True, problem_domain="clients", named_domain="money", quote=q)
    elif letter == "P":
        g["g5"].update(difficulty=True, quote=q)
    for k, v in over.items():
        if isinstance(v, dict):
            g[k].update(v)
        else:
            g[k] = v
    return g


def atom(type_, turn, quote, **kw) -> dict:
    d = {"type": type_, "turn": turn, "quote": quote, "quantified": False, "domain": None, "problem_domain": None,
         "prompted_by_sales": False, "object": kw.pop("object", "the problem"), "dimension": None}
    d.update(kw)
    return d


def _prompt_solicitation(prompt: str) -> str:
    m = re.search(r"^SOLICITATION: (.*)$", prompt, re.M)
    return m.group(1) if m else "x"


def fallback(task_id, unit_id, prompt, pass_no):
    """Default model readings: OUT `nothing`, no atom, no link, no reopening end."""
    if task_id == "spin.gates":
        return gate(_prompt_solicitation(prompt), "OUT", "nothing")
    if task_id == "spin.atoms":
        return {"atoms": []}
    if task_id == "spin.link":
        return {"same_object": False, "quote": None}
    if task_id == "spin.reopen_end":
        return {"end_turn": None, "quote": None}
    if task_id == "spin.register":
        # SB-35: an answered question is read in its answer (Other, quoting its first words), else nothing named
        m = re.search(r"PROSPECT'S ANSWER TO IT:\n\[(\S+) [^\]]*\] \w+: (\S+(?: \S+){0,3})", prompt)
        if m:
            return {"asked_domain": "other", "basis": "answer", "quote": m.group(2), "reference_turn": m.group(1)}
        return {"asked_domain": "none", "basis": "none", "quote": None, "reference_turn": None}
    raise KeyError(task_id)


def run_spin(ctx: CallContext, answers: dict):
    """Gate answers may be given as a letter spec ("P", ("OUT", "agreement"), (letter, reason, overrides)) keyed by
    solicitation id; they are converted with the unit text found by the inventory."""
    texts = {u.sol.id: u.sol.text for u in S.inventory(ctx)}
    mock = {}
    for (task, uid), a in answers.items():
        if task == "spin.gates" and isinstance(a, (str, tuple)):
            spec = (a,) if isinstance(a, str) else a
            sid = uid.split(":", 1)[1]
            over = spec[2] if len(spec) > 2 else {}
            a = gate(texts[sid], spec[0], spec[1] if len(spec) > 1 else None, **over)
        mock[(task, uid)] = a
    client = MockClient(mock, fallback=fallback)
    res = S.SpinCompetence().run(ctx, Runner(client))
    return res, client


def mk(lines: list[tuple[str, str]], **phases) -> CallContext:
    turns = [Turn(f"T{i:03d}", i, f"00:{i:02d}", r, {"S": SALES, "P": PROSPECT}[r], t)
             for i, (r, t) in enumerate(lines, 1)]
    ctx = CallContext("c", "v", "2026-10-01T10:00:00Z", "UTC", turns)
    for k, v in phases.items():
        setattr(ctx.phases, k, v)
    return ctx


def load_real(call: str, **phases) -> CallContext:
    turns = []
    for line in (RUNS / call / "transcript_compact.txt").read_text(encoding="utf-8").splitlines():
        m = LINE.match(line)
        if m:
            turns.append(Turn(m[1], int(re.sub(r"\D", "", m[1])), m[2], m[3], m[3], m[4]))
    ctx = CallContext(call, "valentino", "2026-10-01T10:00:00Z", "UTC", turns)
    for k, v in phases.items():
        setattr(ctx.phases, k, v)
    return ctx


def sol(res_or_ctx, sid):
    return next(s for s in res_or_ctx.solicitations if s.id == sid)


def lvl(res, iid):
    return next(i.level for i in res.items if i.id == iid)


def A(type_, turn, quote, sid="Q1", **kw) -> Atom:
    return Atom(kw.pop("id", f"A{turn}{type_}{len(quote)}"), type_, Evidence(quote, turn, PROSPECT), sid, None, **kw)


# =============================================================================================== 1. letters (§3)
class TestLetters:
    T = "How much is that costing you every month?"

    def d(self, g, **attrs):
        return S.decide_letter(g, {"validation_tail": False, "system": False, **attrs}, self.T)

    def test_first_yes_wins_in_fixed_order(self):
        g = gate(self.T, "S")
        g["g4"].update(consequence=True, quote="costing you")
        assert self.d(g).letter == "S"                       # gate 2 before gate 4

    def test_validation_tail_is_agreement(self):              # hard rule, SEG-4
        g = gate(self.T, "S")
        assert (self.d(g, validation_tail=True).letter, self.d(g, validation_tail=True).reason) == ("OUT", "agreement")

    def test_closed_need_payoff(self):                        # hard rule: desired state inside the question
        g = gate(self.T, "N", g3={"content_supplied": True})
        d = self.d(g)
        assert (d.letter, d.reason, "closed_need_payoff" in d.tags) == ("OUT", "agreement", True)

    def test_value_about_offer_is_offer_info(self):
        d = self.d(gate(self.T, "N", g3={"about_offer": True}))
        assert (d.letter, d.reason) == ("OUT", "offer_info")

    def test_load_of_a_solution(self):
        d = self.d(gate(self.T, "N", g3={"load_named": True, "antecedent": "solution"}))
        assert (d.letter, d.reason) == ("OUT", "solution_load")

    def test_out_reason_priority(self):
        d = self.d(gate(self.T, "OUT", "nothing"), validation_tail=True)
        assert d.reason == "nothing"                           # nothing > ... > agreement

    def test_s_exclusion_falls_through(self):
        g = gate(self.T, "I")
        g["g2"].update(neutral_fact=True, exclusion="consequence", quote="How much")
        assert self.d(g).letter == "I"

    def test_n_with_problem_antecedent_is_not_n(self):
        g = gate(self.T, "N", g3={"antecedent": "problem"})
        g["g4"].update(consequence=True, problem_domain="clients", named_domain="open", quote="costing you")
        assert self.d(g).letter == "I"

    def test_i_same_domain_is_not_i(self):
        g = gate(self.T, "I", g4={"same_domain": True})
        g["g5"].update(difficulty=True, quote="How much")
        assert self.d(g).letter == "P"

    def test_p_named_by_sales_unless_anchored(self):
        g = gate(self.T, "P", g5={"sales_named": True})
        assert (self.d(g).letter, self.d(g).reason) == ("OUT", "absent")
        g["g5"]["anchored"] = True
        assert self.d(g).letter == "P"

    def test_invalid_quote_fails_the_gate(self):
        d = self.d(gate(self.T, "S", quote="not in the text"))
        assert d.letter == "OUT" and d.reason == "absent" and d.invalid_proof

    def test_routing_and_not_solicitation(self):
        assert self.d(gate(self.T, "S", routing="DECISION_REQUEST")).letter == "DECISION_REQUEST"
        assert self.d(gate(self.T, "S", is_solicitation=False)).letter == "NOT_SOLICITATION"

    def test_split_keeps_tail_on_last_part_only(self):        # SEG-2 + SEG-4
        t = "How much is it stuck at, and since when, right?"
        g = gate(t, "S", split=["How much is it stuck at", "and since when, right?"],
                 sub=[gate("How much is it stuck at", "S"), gate("and since when, right?", "S")])
        parts = S.decide_gates(g, {"validation_tail": True}, t)
        assert [p[1].letter for p in parts] == ["S", "OUT"]

    def test_letter_never_produces_points(self):              # X8: same atoms, different letters -> same score
        atoms = [A("IMPACT", "T2", "I can't pay my rent", domain="money")]
        a, _ = S.score_items(atoms, [])
        atoms[0].letter = "S"
        b, _ = S.score_items(atoms, [])
        assert [i.level for i in a] == [i.level for i in b]


# =============================================================================================== 2. atoms (A3)
class TestAtoms:
    def d(self, **kw):
        base = atom(kw.pop("type", "IMPACT"), "T2", kw.pop("quote", "so I can't pay my rent"))
        base.update(kw)
        return S.decide_atom(base, after_pitch=kw.pop("_after", False))

    def test_sb10_impact_same_domain_is_pain(self):           # pair 1c
        assert self.d(domain="clients", problem_domain="clients").type == "PAIN"
        assert self.d(domain="money", problem_domain="clients").type == "IMPACT"    # pair 1b

    def test_sb11_current_income_is_situation(self):          # pair 2a, B2 case 5
        r = self.d(quote="to be around 4,000", figure_kind="present", quantified=True, domain="money",
                   problem_domain="clients")
        assert (r.type, r.quantified) == ("SITUATION", True)

    def test_sb22_income_drop_is_quantified_impact(self):
        r = self.d(quote="I went from 175K to 58K", figure_kind="present", income_drop_attributed=True,
                   domain="money", problem_domain="self_belief")
        assert (r.type, r.quantified) == ("IMPACT", True)

    def test_sb12_desire_after_pitch(self):                   # pair 5b
        base = atom("DESIRE", "T9", "I'd love to have that community")
        assert not S.decide_atom(base, after_pitch=True).keep
        assert S.decide_atom(base, after_pitch=False).keep

    def test_sb14_prompted_and_approval(self):                # pairs 4a / X3
        assert not self.d(prompted_by_sales=True).keep
        assert self.d(quote="Yes, exactly.").type is None
        assert self.d(quote="Everything.").type is None        # SB-9 two-word minimum (B2 case 12)

    def test_sb23_reported_speech(self):
        assert self.d(reported_speech=True, owned=False).type is None
        assert self.d(reported_speech=True, owned=True, domain="money", problem_domain="clients").keep

    @pytest.mark.parametrize("q,exp", [("two years", True), ("about 3K a month", True), ("15 hours a week", True),
                                       ("three clients", True), ("every month", False), ("a lot of wasted time", False),
                                       ("Forever.", False), ("all the time", False)])
    def test_sb24_quantified(self, q, exp):
        assert S.has_quantity(q) is exp

    def test_quantified_needs_model_and_code(self):
        assert not self.d(quote="a lot of wasted time", quantified=True, domain="time",
                          problem_domain="self_belief").quantified


# =============================================================================================== 3. follow-up (SB-17, SB-19)
class TestFollowUp:
    def test_content_word_reuse(self):
        assert S.follows_up("I don't have any clients at all", "And without clients, what happens?")

    def test_short_words_and_stop_words_do_not_count(self):
        assert not S.follows_up("It's a big mess", "What is your goal?")

    def test_number_reuse(self):
        assert S.follows_up("I make about 3K", "And is 3K enough for the family?")

    @pytest.mark.parametrize("q", ["How so?", "Tell me more.", "What else?", "Meaning?", "A lot?"])
    def test_echo(self, q):
        assert S.follows_up("A lot.", q)

    def test_preamble_counts_for_anchoring(self):            # SEG-5
        assert S.follows_up("my marketing is a mess", "What does that do?", preamble="So the marketing.")


# =============================================================================================== 4. chains (SB-16..SB-20)
def step(sid, letter, atoms=(), follows=True, reason=None, unanswered=False):
    return S.ChainStep(sid, letter, reason, [A(t, f"T{sid}", q, sid, object="clients") for t, q in atoms],
                       follows, unanswered)


SAME = lambda op, chain, c: True          # noqa: E731


class TestChains:
    P = step("1", "P", [("PAIN", "I have no clients")])
    I1 = step("2", "I", [("IMPACT", "I can't pay rent")])
    I2 = step("3", "I", [("IMPACT", "my wife is worried")])
    N = step("4", "N", [("VALUE", "I could breathe again")])

    def deep(self, steps, same=SAME):
        return [c for c in S.find_chains(steps, same) if c.get("deep")]

    def test_p_i_i_is_deep(self):
        assert len(self.deep([self.P, self.I1, self.I2])) == 1

    def test_p_i_n_is_deep(self):
        assert len(self.deep([self.P, self.I1, self.N])) == 1

    def test_p_i_alone_is_not_deep(self):
        assert self.deep([self.P, self.I1]) == []

    def test_out_nothing_is_transparent_agreement_breaks(self):       # SB-20
        assert len(self.deep([self.P, self.I1, step("x", "OUT", reason="nothing"), self.N])) == 1
        assert self.deep([self.P, self.I1, step("x", "OUT", reason="agreement"), self.N]) == []
        assert self.deep([self.P, self.I1, step("x", "OUT", reason="sales_list"), self.N]) == []

    def test_unanswered_stacked_unit_is_transparent(self):           # SB-6 unit gets no answer
        assert len(self.deep([self.P, step("x", "OUT", reason="agreement", unanswered=True), self.I1, self.N])) == 1

    def test_s_on_same_object_is_not_a_link_and_does_not_break(self):
        assert len(self.deep([self.P, step("s", "S", [("SITUATION", "lost three clients")]), self.I1, self.N])) == 1

    def test_other_object_breaks(self):
        other = lambda op, ch, c: c.sol_id != "s"      # noqa: E731
        chains = S.find_chains([self.P, self.I1, step("s", "S"), self.N], other)
        assert not any(c.get("deep") for c in chains) and chains[0]["broken_at"] == "s:other_object"

    def test_not_followed_up_breaks(self):                            # SB-17, B4 case 4
        assert self.deep([self.P, self.I1, step("3", "I", [("IMPACT", "my wife is worried")], follows=False)]) == []

    def test_p_without_pain_does_not_open(self):
        assert self.deep([step("1", "P", []), self.I1, self.I2]) == []

    def test_two_chains_on_different_objects(self):
        p2 = S.ChainStep("5", "P", None, [A("BLOCKER", "T5", "I fear selling", "5", object="fear of selling")], True)
        i3 = S.ChainStep("6", "I", None, [A("IMPACT", "T6", "it costs me sleep", "6", object="fear of selling")], True)
        n2 = S.ChainStep("7", "N", None, [A("DESIRE", "T7", "I want to sell calmly", "7", object="x")], True)
        deep = S.distinct_objects(S.find_chains([self.P, self.I1, self.N, p2, i3, n2], SAME))
        assert len(deep) == 2


# =============================================================================================== 5. items (§6)
class TestItems:
    def levels(self, atoms, chains=(), meta=None):
        items, _ = S.score_items(atoms, list(chains), meta)
        return {i.id: i.level for i in items}

    def test_d1_related_to_goal(self):
        sit = [A("SITUATION", "T2", "about 3K a month", id="s1", quantified=True),
               A("SITUATION", "T4", "15 hours a week", id="s2", quantified=True)]
        des = [A("DESIRE", "T6", "I want 10K a month", id="d1", quantified=True)]
        meta = {"s1": {"dimension": "revenue"}, "s2": {"dimension": "time"}, "d1": {"dimension": "revenue"}}
        assert self.levels(sit + des, meta=meta)["D1"] == 1      # only the revenue figure is related
        meta["s2"]["dimension"] = "revenue"
        assert self.levels(sit + des, meta=meta)["D1"] == 2
        assert self.levels(sit)["D1"] == 2                        # no DESIRE: any quantified SITUATION

    def test_d1_no_desire_unquantified_situation_does_not_count(self):
        assert self.levels([A("SITUATION", "T2", "I work at a firm")])["D1"] == 0

    def test_d2_two_distinct_or_cause(self):
        p = A("PAIN", "T2", "I don't have clients", id="p1")
        assert self.levels([p])["D2"] == 1
        assert self.levels([p, A("BLOCKER", "T3", "I fear selling")])["D2"] == 2
        assert self.levels([p, A("PAIN", "T2", "don't have clients")])["D2"] == 1      # overlapping quotes
        cause = {"p1": {"cause": Evidence("because I never post anything", "T2", PROSPECT)}}
        assert self.levels([p], meta=cause)["D2"] == 2

    def test_d3_distinct_domains_and_one_quantified(self):
        a = A("IMPACT", "T2", "it cost me three years", domain="time", quantified=True)
        b = A("IMPACT", "T3", "my kids barely see me", domain="family")
        c = A("IMPACT", "T4", "I am exhausted every day", domain="family")
        assert self.levels([a])["D3"] == 1
        assert self.levels([a, b])["D3"] == 2
        assert self.levels([b, c])["D3"] == 1                     # same domain, none quantified

    def test_d4(self):
        d = A("DESIRE", "T2", "I want 5K a month")
        v = A("VALUE", "T3", "so I can be home for the kids")
        assert (self.levels([d])["D4"], self.levels([d, v])["D4"], self.levels([v])["D4"]) == (1, 2, 0)

    def test_prompted_never_counts_volunteered_counts_d1_d4(self):
        d = A("DESIRE", "T2", "I want 5K a month", prompted_by_sales=True)
        assert self.levels([d])["D4"] == 0
        v = A("DESIRE", "T2", "I want 5K a month", volunteered=True)
        assert self.levels([v])["D4"] == 1

    def test_d5_and_two_quote_rule(self):
        ev = [Evidence("I have no clients", "T2", PROSPECT), Evidence("I can't pay rent", "T3", PROSPECT)]
        one = {"deep": True, "opening": "Q2", "object": "clients", "evidence": ev}
        two = {"deep": True, "opening": "Q9", "object": "fear", "evidence": ev}
        assert self.levels([], [one])["D5"] == 1
        assert self.levels([], [one, two])["D5"] == 2
        assert self.levels([], [one, dict(one, opening="Q5")])["D5"] == 1     # same object

    def test_two_quote_cap(self):
        a = A("IMPACT", "T2", "it cost me three years", domain="time", quantified=True)
        b = A("IMPACT", "T2", "it cost me three years", domain="family")
        assert self.levels([a, b])["D3"] == 1                     # one distinct quote only


# =============================================================================================== 6. spans, perimeter
def test_answer_spans_backchannel_volunteered_stacked():
    ctx = mk([("S", "Hi. What is going on? And how long has it been?"),        # T1 stacked
              ("P", "My clients left two years ago."),                          # T2
              ("S", "Wow."),                                                    # T3 backchannel <= 5 words
              ("P", "Yeah, it hurts."),                                         # T4 still the answer (SB-5)
              ("S", "I really appreciate you sharing that with me, honestly."),  # T5 acknowledgement
              ("P", "And my wife is worried too."),                             # T6 volunteered (SB-8)
              ("S", "What else is going on?"),                                  # T7 next solicitation
              ("P", "Nothing else.")])
    units = S.inventory(ctx)
    for u in units:
        u.window_end = None
    S.answer_spans(ctx, units, {u.turn.id for u in units})
    q1, q2, q7 = units
    assert q1.unanswered and not q2.unanswered                                  # SB-6: last stacked one
    assert q2.sol.answer_turns == ["T002", "T004"] and q2.volunteered_turns == ["T006"]


def test_answer_spans_stacked_exception():
    ctx = mk([("S", "How many clients do you have? And what is your dream?"), ("P", "Three clients, no more.")])
    units = S.inventory(ctx)
    S.answer_spans(ctx, units, {"T001"})
    assert units[0].sol.answer_turns == ["T002"] and units[1].unanswered          # SB-6 explicit answer


SYN = [("S", "Can you hear me okay?"), ("P", "Yes I can."),                                         # T1-2 social
       ("S", "What made you book this call?"), ("P", "I have no clients and it is killing my income."),  # T3-4 P
       ("S", "And without clients, what does that do to your money?"),
       ("P", "I lost about 2K a month, I can't pay my rent."),                                           # T5-6 I
       ("S", "And with rent unpaid, how is your family taking it?"),
       ("P", "My wife is stressed and the kids feel it."),                                               # T7-8 I
       ("S", "How much do you make today?"), ("P", "About 3K a month right now."),                       # T9-10 S
       ("S", "Where do you want to be?"), ("P", "I want 10K a month, so I can be home for my kids."),    # T11-12 N
       ("S", "Let me show you the program now. It has three pillars."), ("P", "Okay."),                 # T13 pitch
       ("S", "How many hours a week could you put in?"), ("P", "Maybe 20 hours."),                      # T15 logistic
       ("S", "Do you have savings you could use for this?"), ("P", "A little.")]                        # T17 financing


def syn_answers():
    return {("spin.gates", "gates:Q003.1"): "P", ("spin.gates", "gates:Q005.1"): "I",
            ("spin.gates", "gates:Q007.1"): ("I", None, {"g4": {"problem_domain": "money", "named_domain": "family"}}),
            ("spin.gates", "gates:Q009.1"): "S", ("spin.gates", "gates:Q011.1"): "N",
            ("spin.gates", "gates:Q017.1"): ("OUT", "solution_load"),
            ("spin.atoms", "atoms:Q003.1"): {"atoms": [atom("PAIN", "T004", "I have no clients", object="no clients")]},
            ("spin.atoms", "atoms:Q005.1"): {"atoms": [
                atom("IMPACT", "T006", "I lost about 2K a month", domain="money", problem_domain="clients",
                     quantified=True, figure_kind="loss"),
                atom("IMPACT", "T006", "I can't pay my rent", domain="money", problem_domain="clients")]},
            ("spin.atoms", "atoms:Q007.1"): {"atoms": [atom("IMPACT", "T008", "My wife is stressed", domain="family",
                                                            problem_domain="money")]},
            ("spin.atoms", "atoms:Q009.1"): {"atoms": [atom("SITUATION", "T010", "About 3K a month right now",
                                                            quantified=True, figure_kind="present",
                                                            dimension="revenue")]},
            ("spin.atoms", "atoms:Q011.1"): {"atoms": [
                atom("DESIRE", "T012", "I want 10K a month", quantified=True, dimension="revenue"),
                atom("VALUE", "T012", "so I can be home for my kids")]},
            ("spin.link", "link:Q003.1>Q005.1"): {"same_object": True, "quote": "without clients"},
            ("spin.link", "link:Q003.1>Q007.1"): {"same_object": True, "quote": "rent unpaid"},
            }


def test_full_run_synthetic_call():
    ctx = mk(SYN, pitch_start="T013")
    res, client = run_spin(ctx, syn_answers())
    assert (ctx.phases.discovery_start, ctx.phases.discovery_end) == ("T003", "T013")     # SB-1, SB-2
    assert res.status == "scored"
    lv = {i.id: i.level for i in res.items}
    # D1: one related quantified SITUATION -> 1; D2: one PAIN -> 1; D3: money (quantified) + family -> 2;
    # D4: DESIRE + VALUE -> 2; D5: P -> I -> I on "clients", followed up -> 1 deep chain
    assert lv == {"D1": 1, "D2": 1, "D3": 2, "D4": 2, "D5": 1}
    assert res.score == round(100 * (15 * .5 + 20 * .5 + 30 + 20 + 15 * .5) / 100)
    # shared state
    assert sol(ctx, "Q001.1").letter is None and "pre_perimeter" in sol(ctx, "Q001.1").tags
    assert sol(ctx, "Q005.1").letter == "I" and sol(ctx, "Q005.1").answer_turns == ["T006"]
    assert sol(ctx, "Q003.1").followed_up
    assert {a.type for a in ctx.atoms} == {"PAIN", "IMPACT", "SITUATION", "DESIRE", "VALUE"}
    assert all(a.letter and a.solicitation_id and a.evidence.role == PROSPECT for a in ctx.atoms)
    # SB-25 financing and logistics after the end: never a reopening
    assert res.details["perimeter"]["reopenings"] == []
    assert not sol(ctx, "Q017.1").followed_up and "post_discovery" in sol(ctx, "Q017.1").tags
    d = res.details["diagnostics"]
    assert d["letters"] == {"S": 1, "P": 1, "I": 2, "N": 1} and d["p_followed_by_i"] == 1.0
    assert res.details["items_evidence"]["D3"]["evidence"][0]["question_id"] == "Q005.1"
    assert [c for c in res.details["chains"] if c["deep"]][0]["links"] == ["Q003.1", "Q005.1", "Q007.1"]


def test_applicability_and_health():
    ctx = mk(SYN[:8] + [("S", "Let me show you the program now."), ("P", "Okay.")], pitch_start="T009")
    ans = {k: v for k, v in syn_answers().items() if k[1].split(":")[1].split(">")[0] < "Q009"}
    res, _ = run_spin(ctx, ans)                                          # 3 coded solicitations < 5 (§5)
    assert res.status == "not_applicable" and res.items == [] and res.score is None
    assert res.reasons == ["fewer_than_5_coded_solicitations"]
    ctx = mk(SYN, pitch_start="T013")
    ans = syn_answers()
    ans[("spin.gates", "gates:Q009.1")] = gate("How much do you make today?", "P", g5={"sales_named": True})
    res, _ = run_spin(ctx, ans)                                          # 1 absent out of 5 coded = 20 % > 5 %
    assert res.status == "excluded" and res.reasons == ["health_absent_share"]
    res, _ = run_spin(mk(SYN[:2], pitch_start=None), {})
    assert res.status == "not_applicable" and res.reasons == ["no_discovery"]


def test_to_review_unit_is_excluded():
    ctx = mk(SYN, pitch_start="T013")
    ans = syn_answers()
    ans[("spin.gates", "gates:Q009.1")] = gate("How much do you make today?", "S", quote="not a quote")
    res, _ = run_spin(ctx, ans)
    assert sol(ctx, "Q009.1").status == "to_review" and "units_to_review" in res.flags


def test_three_passes_disagree_goes_to_arbiter():
    ctx = mk(SYN, pitch_start="T013")
    ans = syn_answers()
    t = "How much do you make today?"
    ans[("spin.gates", "gates:Q009.1")] = [gate(t, "S"), gate(t, "S"), gate(t, "P"),
                                            dict(gate(t, "S"), justification="counts revenue",
                                                 case_label="application_error")]
    run_spin(ctx, ans)
    assert sol(ctx, "Q009.1").status == "arbitrated" and sol(ctx, "Q009.1").letter == "S"


def test_sb21_action_plan_without_future_state():
    ctx = mk(SYN, pitch_start="T013")
    ans = syn_answers()
    ans[("spin.gates", "gates:Q011.1")] = ("N", None, {"g3": {"action_plan": True}})
    ans[("spin.atoms", "atoms:Q011.1")] = {"atoms": []}
    run_spin(ctx, ans)
    assert (sol(ctx, "Q011.1").letter, sol(ctx, "Q011.1").out_reason) == ("OUT", "solution_load")


def test_sb34_spin_stops_at_the_pitch():
    """SB-34 replaces SB-3 / SB-4: a diagnostic question inside the pitch is not read, not coded, has no register."""
    lines = SYN[:12] + [("S", "Let me show you the program now. It has three pillars."), ("P", "Okay."),   # T13
                        ("S", "Is your eye ahead of your process?"), ("P", "Ahead."),                     # T15 check-in
                        ("S", "The second pillar is the portfolio, it is a big part."), ("P", "Nice."),     # T17
                        ("S", "What part of a project scares you?"), ("P", "Quoting the client."),        # T19
                        ("S", "And what happens when you quote?"), ("P", "I undercharge every time."),    # T21
                        ("S", "Now the next point of the program is the business."), ("P", "Okay.")]      # T23
    ctx = mk(lines, pitch_start="T013")
    ans = syn_answers()
    del ans[("spin.gates", "gates:Q017.1")]
    ans.update({("spin.gates", "gates:Q015.1"): "S", ("spin.gates", "gates:Q019.1"): "P",
                ("spin.gates", "gates:Q021.1"): "P"})
    res, client = run_spin(ctx, ans)
    assert res.details["perimeter"]["reopenings"] == []
    for sid in ("Q015.1", "Q019.1", "Q021.1"):
        s_ = sol(ctx, sid)
        assert s_.letter is None and "post_discovery" in s_.tags
        row = next(r for r in res.details["solicitations"] if r["id"] == sid)
        assert not row["in_perimeter"] and row["register"] is None
    asked = {u for t, u, _ in client.calls}
    assert not {"gates:Q015.1", "gates:Q019.1", "gates:Q021.1", "reopen:Q015.1", "reopen:Q019.1"} & asked   # not even read


# =============================================================================================== 7. Annex B, real transcripts
real = pytest.mark.skipif(not RUNS.exists(), reason="real transcripts not available")


@real
def test_annexB_call001_stacked_closed_need_payoff_values_financing():
    """B1 case 3, B2 cases 6 and 7, B3 case 4 (call 001)."""
    ctx = load_real("001", pitch_start="T089", first_price="T113", pitch_end="T113")
    g = {"gates:Q017.1": "P", "gates:Q029.1": "N", "gates:Q029.2": "N", "gates:Q033.1": "N", "gates:Q035.1": "S",
         "gates:Q045.1": ("N", None, {"g3": {"content_supplied": True}}),       # 5K supplied by the sales
         "gates:Q045.2": "N", "gates:Q047.1": "S", "gates:Q049.1": "S",
         "gates:Q133.1": ("OUT", "solution_load")}                               # SB-25 financing after the price
    ans = {("spin.gates", k): v for k, v in g.items()}
    ans[("spin.atoms", "atoms:Q033.1")] = {"atoms": [atom("DESIRE", "T034", "I would say minimum $5,000",
                                                          quantified=True, value=5000, unit="usd",
                                                          dimension="revenue")]}
    ans[("spin.atoms", "atoms:Q035.1")] = {"atoms": [atom("SITUATION", "T036", "it's like $23 an hour",
                                                          quantified=True, dimension="revenue"),
                                                     atom("SITUATION", "T036", "I only put in about 15 hours a week",
                                                          quantified=True, dimension="time")]}
    ans[("spin.atoms", "atoms:Q045.2")] = {"atoms": [
        atom("VALUE", "T046", "I could actually spend time with my kids after school"),
        atom("VALUE", "T046", "trying to climb out of the debt")]}
    res, _ = run_spin(ctx, ans)
    assert (ctx.phases.discovery_start, ctx.phases.discovery_end) == ("T017", "T089")
    q1, q2 = sol(ctx, "Q045.1"), sol(ctx, "Q045.2")
    assert (q1.letter, q1.out_reason) == ("OUT", "agreement") and "closed_need_payoff" in q1.tags
    assert "unanswered" in q1.tags and q2.letter == "N" and q2.answer_turns == ["T046"]       # SB-6
    values = [a for a in ctx.atoms if a.type == "VALUE"]
    assert len(values) == 2 and {a.solicitation_id for a in values} == {"Q045.2"}           # B2 case 7
    desire = next(a for a in ctx.atoms if a.type == "DESIRE")
    assert desire.quantified and desire.value == 5000                                       # B2 case 6
    assert lvl(res, "D4") == 2 and lvl(res, "D1") == 1         # one SITUATION shares the goal's dimension
    q133 = sol(ctx, "Q133.1")
    row = next(r for r in res.details["solicitations"] if r["id"] == "Q133.1")
    assert q133.letter is None and "post_discovery" in q133.tags and not row["in_perimeter"]   # B3 case 4: not coded
    assert row["gate_letter"] is None                                     # SB-34: after the price, not even read
    assert res.details["perimeter"]["reopenings"] == []
    assert res.details["diagnostics"]["closed_need_payoff"] == 1


@real
def test_annexB_call028_start_situation_and_no_deep_chain():
    """B3 case 2, B1 case 1, B4 case 2 (call 028)."""
    ctx = load_real("028", pitch_start="T103")
    g = {"gates:Q027.1": "P", "gates:Q029.1": "P", "gates:Q031.1": "P", "gates:Q037.1": "P", "gates:Q039.1": "S",
         "gates:Q041.1": "S", "gates:Q041.2": "S", "gates:Q043.1": ("OUT", "agreement"),
         "gates:Q045.1": ("I", None, {"g4": {"problem_domain": "work stress", "named_domain": "open"}}),
         "gates:Q049.1": "I", "gates:Q051.1": "I", "gates:Q057.1": "P"}
    ans = {("spin.gates", k): v for k, v in g.items()}
    ans[("spin.atoms", "atoms:Q037.1")] = {"atoms": [atom("PAIN", "T038", "it's going to be exactly the same issues",
                                                          object="consulting own business")]}
    ans[("spin.atoms", "atoms:Q041.2")] = {"atoms": [atom("SITUATION", "T042", "More than ten years.",
                                                          quantified=True, dimension="time")]}
    ans[("spin.atoms", "atoms:Q045.1")] = {"atoms": [atom("IMPACT", "T046", "It has taken a toll on my health",
                                                          domain="health", problem_domain="other",
                                                          object="stressful work")]}
    ans[("spin.atoms", "atoms:Q051.1")] = {"atoms": [atom("IMPACT", "T052", "I have gone through periods of anxiety",
                                                          domain="health", problem_domain="other",
                                                          object="stressful work")]}
    for c in ("Q039.1", "Q041.1", "Q041.2", "Q045.1"):            # even if every link said "same object"
        ans[("spin.link", f"link:Q037.1>{c}")] = {"same_object": True, "quote": " ".join(
            next(u.sol.text for u in S.inventory(ctx) if u.sol.id == c).split()[:2])}
    res, _ = run_spin(ctx, ans)
    assert ctx.phases.discovery_start == "T027"                                             # B3 case 2
    assert sol(ctx, "Q039.1").letter == "S"                                                 # B1 case 1
    sit = next(a for a in ctx.atoms if a.evidence.turn == "T042")
    assert sit.type == "SITUATION" and sit.quantified and sit.solicitation_id == "Q041.2"
    assert not any(c["deep"] for c in res.details["chains"])                                # B4 case 2
    assert lvl(res, "D5") == 0 and lvl(res, "D3") == 1          # two health quotes = one domain
    assert res.status == "scored"


@real
def test_annexB_call027_chain_broken_by_sales_list():
    """B4 case 3 (call 027): P T056 -> I T058 (IMPACT time, last stacked unit) -> OUT sales_list T060 breaks."""
    ctx = load_real("027", pitch_start="T096")
    g = {"gates:Q016.1": "N", "gates:Q052.1": "P", "gates:Q054.1": "P", "gates:Q056.1": "P",
         "gates:Q058.1": ("OUT", "agreement"), "gates:Q058.3": "I", "gates:Q060.1": ("OUT", "sales_list"),
         "gates:Q062.1": ("N", None, {"g3": {"action_plan": True}})}
    ans = {("spin.gates", k): v for k, v in g.items()}
    ans[("spin.atoms", "atoms:Q056.1")] = {"atoms": [atom("PAIN", "T057", "falling into other people's expectations of me",
                                                          object="other people's expectations")]}
    ans[("spin.atoms", "atoms:Q058.3")] = {"atoms": [atom("IMPACT", "T059", "It's cost me literally three years",
                                                          domain="time", problem_domain="self_belief",
                                                          quantified=True)]}
    ans[("spin.atoms", "atoms:Q062.1")] = {"atoms": [atom("DESIRE", "T063", "Believing in myself and not taking other people's")]}
    ans[("spin.link", "link:Q056.1>Q058.3")] = {"same_object": True, "quote": "what has that actually cost you"}
    ans[("spin.link", "link:Q056.1>Q062.1")] = {"same_object": True, "quote": "Believing in myself"}
    res, _ = run_spin(ctx, ans)
    assert sol(ctx, "Q058.3").answer_turns == ["T059"] and "unanswered" in sol(ctx, "Q058.1").tags   # SB-6
    chain = next(c for c in res.details["chains"] if c["opening"] == "Q056.1")
    assert not chain["deep"] and chain["broken_at"] == "Q060.1:OUT_sales_list"
    assert lvl(res, "D3") == 1 and lvl(res, "D5") == 0          # the IMPACT counts for D3, not for D5
    assert sol(ctx, "Q062.1").letter == "N"                    # SB-21: the answer states a future state
    # counterfactual: an OUT `nothing` at T060 would not break the chain (SB-20)
    ctx2 = load_real("027", pitch_start="T096")
    ans[("spin.gates", "gates:Q060.1")] = ("OUT", "nothing")
    res2, _ = run_spin(ctx2, ans)
    assert lvl(res2, "D5") == 1


@real
def test_annexB_call011_closed_need_payoff_and_no_spin_after_the_pitch():
    """B1 case 2; B1 case 6 and B3 case 3 superseded by SB-34 (no check-in, no reopening inside the pitch), call 011."""
    ctx = load_real("011", pitch_start="T127", first_price="T201", pitch_end="T201")
    g = {"gates:Q047.1": "S", "gates:Q049.1": ("N", None, {"g3": {"content_supplied": True}}),
         "gates:Q141.1": "S", "gates:Q163.2": "P", "gates:Q163.3": "P", "gates:Q173.1": "P", "gates:Q173.2": "P"}
    ans = {("spin.gates", k): v for k, v in g.items()}
    res, _ = run_spin(ctx, ans)
    q49 = sol(ctx, "Q049.1")
    assert (q49.letter, q49.out_reason) == ("OUT", "agreement") and "closed_need_payoff" in q49.tags   # B1 case 2
    assert res.details["perimeter"]["reopenings"] == []                                                # SB-34
    for sid in ("Q141.1", "Q163.2", "Q163.3", "Q173.1", "Q173.2", "Q177.1"):
        assert sol(ctx, sid).letter is None and "post_discovery" in sol(ctx, sid).tags


@real
def test_annexB_call046_social_start_and_one_word_answer():
    """B3 case 1 and B2 case 12 (call 046)."""
    ctx = load_real("046", pitch_start="T200")
    g = {"gates:Q023.1": "N", "gates:Q023.2": "N",
         "gates:Q103.1": ("I", None, {"g4": {"problem_domain": "self_belief", "named_domain": "open"}}),
         "gates:Q105.1": "I"}
    ans = {("spin.gates", k): v for k, v in g.items()}
    ans[("spin.atoms", "atoms:Q103.1")] = {"atoms": [atom("IMPACT", "T104", "Everything.", domain="other",
                                                          problem_domain="self_belief")]}
    ans[("spin.atoms", "atoms:Q105.1")] = {"atoms": [
        atom("IMPACT", "T106", "the life I want to give my children before they've moved out", domain="family",
             problem_domain="self_belief"),
        atom("IMPACT", "T106", "it just makes me really unhappy with myself that I haven't done it",
             domain="self_belief", problem_domain="other")]}
    res, _ = run_spin(ctx, ans)
    assert ctx.phases.discovery_start == "T023"                                         # B3 case 1 (T007 social)
    assert sol(ctx, "Q103.1").answer_turns == ["T104"]                                  # SB-7 does not extend
    assert not [a for a in ctx.atoms if a.evidence.turn == "T104"]                       # below 2 words
    imp = [a for a in ctx.atoms if a.type == "IMPACT"]
    assert {a.domain for a in imp} == {"family", "self_belief"} and len(imp) == 2


# =============================================================================================== 8. registers (SB-26..SB-33)
def reg(domain, basis="named", quote=None, ref=None, **kw) -> dict:
    d = {"asked_domain": domain, "basis": basis, "quote": quote, "reference_turn": ref}
    d.update(kw)
    return d


def reg_answers():
    a = syn_answers()
    a.update({("spin.register", "register:Q003.1"): reg("clients", "answer", quote="I have no clients", ref="T004"),  # SB-35
              ("spin.register", "register:Q005.1"): reg("money", quote="your money"),
              ("spin.register", "register:Q007.1"): reg("family", quote="your family"),
              ("spin.register", "register:Q009.1"): reg("money", quote="How much do you make"),
              ("spin.register", "register:Q011.1"): reg("future", quote="Where do you want to be")})
    return a


class TestRegisters:
    @pytest.mark.parametrize("dom,reg_", [("money", "financial"), ("clients", "financial"), ("time", "time_load"),
                                          ("family", "time_load"), ("future", "identity_status"),
                                          ("self_belief", "mental_emotional"), ("health", "mental_emotional"),
                                          ("other", "other"), ("none", "other")])
    def test_sb26_domain_to_register(self, dom, reg_):
        assert S.decide_register(reg(dom)) == reg_

    @pytest.mark.parametrize("q,exp", [
        ("With your clients being so up and down, what impact is that having on your income?", {"financial"}),
        ("How has that impacted you on a personal level?", set()),
        ("How does that make you feel?", {"mental_emotional"}),
        ("Where do you want to be in 12 months?", {"identity_status"}),
        ("What is $5k a month going to do for you?", {"financial"}),
        ("And how is your family taking it?", {"time_load"}),
        ("What is leading you to look now?", set())])
    def test_sb30_domain_words(self, q, exp):
        assert S.lexicon_registers(q) == exp

    def unit(self, sid):
        ctx = mk(SYN, pitch_start="T013")
        return ctx, next(u for u in S.inventory(ctx) if u.sol.id == sid)

    def test_sb32_checks(self):
        ctx, u = self.unit("Q005.1")
        v = lambda a: S._validate_register(a, ctx, u)          # noqa: E731
        assert v(reg("money", quote="your money")) == []
        assert v(reg("money", quote="your wallet")) == ["bad_quote:named"]
        assert v(reg("family", quote="your money")) == ["lexicon_conflict"]           # rule 3: one register in the words
        assert v(reg("clients", "reference", quote="I have no clients", ref="T004")) == []
        assert v(reg("clients", "reference", quote="I have no clients", ref="T010")) == ["bad_reference_turn"]
        assert v(reg("money", "none")) == ["none_basis_with_domain"]
        assert v(reg("none", "named", quote="your money")) == ["domain_without_basis"]
        assert v(reg("career", quote="your money")) == ["bad_domain"]
        assert v(reg("other", "named", quote="your money")) == ["named_other"]                # SB-35: open question
        assert v(reg("money", "answer", quote="I lost about 2K a month", ref="T006")) == ["no_answer"]
        u.sol.answer_turns = ["T006"]                                                       # now it has an answer
        assert v(reg("money", "answer", quote="I lost about 2K a month", ref="T006")) == []
        assert v(reg("money", "answer", quote="I lost about 2K a month", ref="T004")) == ["bad_answer_turn"]
        assert v(reg("money", "answer", quote="I lost 5K", ref="T006")) != []
        assert v(reg("other", "answer", quote="I can't pay my rent", ref="T006")) == []     # the answer may be Other
        assert v(reg("clients", "reference", quote="I have no clients", ref="T004")) == ["reference_with_answer"]
        assert v(reg("none", "none")) == ["none_with_answer"]

    def test_registers_in_a_run(self):
        ctx = mk(SYN, pitch_start="T013")
        res, client = run_spin(ctx, reg_answers())
        rows = {r["id"]: r for r in res.details["solicitations"]}
        assert {k: rows[k]["register"] for k in ("Q003.1", "Q005.1", "Q007.1", "Q009.1", "Q011.1")} == {
            "Q003.1": "financial", "Q005.1": "financial", "Q007.1": "time_load", "Q009.1": "financial",
            "Q011.1": "identity_status"}
        assert rows["Q001.1"]["register"] is None                          # before the perimeter
        assert rows["Q015.1"]["register"] is None and rows["Q017.1"]["register"] is None   # SB-26: after the pitch
        assert not any(t == "spin.register" and u in ("register:Q015.1", "register:Q017.1") for t, u, _ in client.calls)
        summ = res.details["registers"]
        assert summ["counts"] == {"financial": 3, "time_load": 1, "identity_status": 1, "mental_emotional": 0, "other": 0}
        assert summ["agreement"] == 1.0 and "register_agreement_low" not in res.flags
        assert res.score is not None and res.rules_version == "SPIN-1.3"     # the register never changes the score

    def test_sb35_an_open_question_takes_the_register_of_its_answer(self):
        """Romain 2026-10-29: "what made you book this call?" names no domain; the answer speaks of clients: Financial.
        A reference although the question was answered is rejected (SB-32), replayed, then to_review."""
        res, _ = run_spin(mk(SYN, pitch_start="T013"), reg_answers())
        row = next(r for r in res.details["solicitations"] if r["id"] == "Q003.1")
        assert (row["register"], row["register_basis"], row["register_reference_turn"]) == ("financial", "answer", "T004")
        a = reg_answers()
        a[("spin.register", "register:Q003.1")] = reg("clients", "reference", quote="I have no clients", ref="T004")
        res2, _ = run_spin(mk(SYN, pitch_start="T013"), a)
        row2 = next(r for r in res2.details["solicitations"] if r["id"] == "Q003.1")
        assert row2["register"] is None and row2["register_status"] == "to_review"

    def test_sb35_prompt_shows_the_answer(self):
        ctx = mk(SYN, pitch_start="T013")
        u = next(x for x in S.inventory(ctx) if x.sol.id == "Q003.1")
        u.sol.answer_turns = ["T004"]
        assert "PROSPECT'S ANSWER TO IT:" in S._register_build(ctx, u) and "I have no clients" in S._register_build(ctx, u)
        u.sol.answer_turns = []
        assert "(no answer)" in S._register_build(ctx, u)

    def test_register_never_changes_the_score(self):
        a = reg_answers()
        b = dict(a)
        b[("spin.register", "register:Q005.1")] = reg("none", "none")
        ra, _ = run_spin(mk(SYN, pitch_start="T013"), a)
        rb, _ = run_spin(mk(SYN, pitch_start="T013"), b)
        assert (ra.score, [i.level for i in ra.items]) == (rb.score, [i.level for i in rb.items])

    def test_out_questions_get_no_register(self):
        a = reg_answers()
        a[("spin.gates", "gates:Q009.1")] = ("OUT", "agreement")
        res, client = run_spin(mk(SYN, pitch_start="T013"), a)
        rows = {r["id"]: r for r in res.details["solicitations"]}
        assert rows["Q009.1"]["register"] is None
        assert ("spin.register", "register:Q009.1") not in {(t, u) for t, u, _ in client.calls}

    def test_disagreement_goes_to_the_arbiter_then_review_and_lowers_agreement(self):
        a = reg_answers()
        fut, mon = reg("future", quote="Where do you want to be"), reg("money", quote="Where do you want to be")
        a[("spin.register", "register:Q011.1")] = [fut, fut, mon, dict(fut, case_label="undecidable")]
        res, _ = run_spin(mk(SYN, pitch_start="T013"), a)
        rows = {r["id"]: r for r in res.details["solicitations"]}
        assert rows["Q011.1"]["register"] is None and rows["Q011.1"]["register_status"] == "to_review"
        summ = res.details["registers"]
        assert summ["to_review"] == 1 and summ["agreement"] == 0.8 and "register_agreement_low" in res.flags

    def test_arbiter_decides_by_the_rules(self):
        a = reg_answers()
        fut, mon = reg("future", quote="Where do you want to be"), reg("money", quote="Where do you want to be")
        a[("spin.register", "register:Q011.1")] = [fut, mon, fut, dict(fut, case_label="application_error",
                                                                       justification="SB-28: no amount is asked")]
        res, _ = run_spin(mk(SYN, pitch_start="T013"), a)
        row = next(r for r in res.details["solicitations"] if r["id"] == "Q011.1")
        assert (row["register"], row["register_status"]) == ("identity_status", "arbitrated")

    def test_lexicon_conflict_is_replayed_then_reviewed(self):
        a = reg_answers()
        a[("spin.register", "register:Q005.1")] = reg("family", quote="your money")
        res, client = run_spin(mk(SYN, pitch_start="T013"), a)
        row = next(r for r in res.details["solicitations"] if r["id"] == "Q005.1")
        assert row["register"] is None and row["register_status"] == "to_review"
        assert sum(1 for t, u, _ in client.calls if u == "register:Q005.1") == 8      # (3 passes + arbiter) x (1 + replay)


def test_gate_split_of_the_wrong_shape_is_a_bad_split():
    """A split / sub sent as an object instead of a list is rejected by the validator and never applied."""
    from lnp_callqa.competences.spin import _validate_gate_obj, decide_gates
    g = {"g1": {"reason": None}, "split": ["How long?", "And why?"], "sub": {"0": {}, "1": {}}}
    assert "bad_split" in _validate_gate_obj(g, "How long? And why?")
    attrs = {"validation_tail": False, "alternative": False, "open_branch": False, "offer_mention": False,
             "anchor_words": [], "backchannel": False, "system": False}
    assert [t for t, _ in decide_gates(g, attrs, "How long? And why?")] == ["How long? And why?"]

