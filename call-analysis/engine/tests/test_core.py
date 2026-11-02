from datetime import date

from alkimiy_callqa.core import aggregate
from alkimiy_callqa.core.foundation import decide_phases, repair_attribution
from alkimiy_callqa.core.llm import MockClient
from alkimiy_callqa.core.models import CallContext, Evidence, ItemScore, Turn
from alkimiy_callqa.core.runner import ModelTask, Runner
from alkimiy_callqa.core.scoring import call_score, item
from alkimiy_callqa.core.text import key_expression_ok, norm_number, quote_ok, sentences


def ctx_of(lines):
    turns = [Turn(f"T{i+1:03d}", i + 1, "00:00", r, r, t) for i, (r, t) in enumerate(lines)]
    return CallContext("c", "s", "2026-10-20T10:00:00Z", "Asia/Dubai", turns)


# ---------------------------------------------------------------- GB-22
def test_verbatim_person_shift_and_forms():
    assert key_expression_ok("motivation", "It's like my motivation gets", "impacting your level of motivation")[0]
    assert not key_expression_ok("stressed", "Oh, very stressed.", "there's been a lot of stress")[0]   # 10b
    assert key_expression_ok("very stressed", "Oh, very stressed.", "and you've been very stressed")[0]  # 10a
    assert key_expression_ok("lost so much time", "I've lost so much time.", "and you've lost so much time")[0]  # 3a
    assert not key_expression_ok("lost so much time", "I've lost so much time.", "you've wasted years")[0]     # 3c
    assert key_expression_ok("self-doubts", "having self-doubts", "the self-doubt")[0]                       # plural
    assert key_expression_ok("1,800 a month", "I'm making about 1,800 a month", "you're at 1,800 a month")[0]  # 11a
    assert not key_expression_ok("1,800 a month", "I'm making about 1,800 a month", "you're at roughly 2K")[0]  # 11b
    assert key_expression_ok("10K", "I want 10K", "you want 10,000")[0]                                      # PB-21
    assert key_expression_ok("Failure", "Failure.", "which, in your words, is failure")[0]                   # 12a
    assert key_expression_ok("you want to", "I want to", "you want to") == (False, "generic")


def test_norm_number():
    assert norm_number("10K") == norm_number("10,000") == norm_number("$10,000") == "10000"
    assert norm_number("ten") == "10"


def test_quote_checks():
    c = ctx_of([("SALES", "What has that cost you?"), ("PROSPECT", "Probably 2K a month I'm not earning.")])
    assert quote_ok(c, Evidence("2K a month I'm not earning", "T002", "PROSPECT")) is None
    assert quote_ok(c, Evidence("2K a month I'm not earning", "T002", "SALES")) == "wrong_speaker"
    assert quote_ok(c, Evidence("3K a month", "T002", "PROSPECT")) == "not_a_substring"


def test_sentences_split():
    assert len(sentences("One. Two? Three!")) == 3


# ---------------------------------------------------------------- scoring
def test_two_quote_rule_and_na_weights():
    one = item("G4", 20, 2, [Evidence("q", "T001")])
    assert one.level == 1
    two = item("G4", 20, 2, [Evidence("q", "T001"), Evidence("r", "T002")])
    assert two.level == 2
    assert call_score([ItemScore("A", 50, 2), ItemScore("B", 50, None)]) == 100
    assert call_score([ItemScore("A", 50, 1), ItemScore("B", 50, 0)]) == 25


# ---------------------------------------------------------------- runner: passes, replay, arbitration
def _task():
    def validate(a, ctx, uid):
        return [] if quote_ok(ctx, Evidence(a.get("quote", ""), "T002", "PROSPECT")) is None else ["bad_quote"]
    return ModelTask("t.x", "fast", "foundation_phases", lambda ctx, u: "q", validate, key=lambda a: a["v"])


def test_runner_verified_and_arbitrated():
    c = ctx_of([("SALES", "Question?"), ("PROSPECT", "I have no clients at all.")])
    good = {"v": True, "quote": "no clients at all"}
    r = Runner(MockClient({("t.x", "u1"): good})).run(c, _task(), "u1", None)
    assert r.status == "verified" and r.concordance == "3/3"
    arb = dict(good, justification="rule applied", case_label="application_error")
    mc = MockClient({("t.x", "u2"): [good, good, {"v": False, "quote": "no clients at all"}, arb]})
    r2 = Runner(mc).run(c, _task(), "u2", None)
    assert r2.status == "arbitrated" and r2.concordance == "2/3"


def test_runner_invalid_quote_goes_to_review():
    c = ctx_of([("SALES", "Question?"), ("PROSPECT", "I have no clients at all.")])
    bad = {"v": True, "quote": "invented words"}
    r = Runner(MockClient({("t.x", "u3"): bad})).run(c, _task(), "u3", None)
    assert r.status == "to_review" and r.answer is None


def test_runner_answer_of_an_unexpected_shape_is_rejected_not_a_crash():
    """C3 rule 7: a validator that cannot read an answer (KeyError(0) on a real call, 2026-10-28) rejects it."""
    c = ctx_of([("SALES", "Question?"), ("PROSPECT", "I have no clients at all.")])

    def validate(a, ctx, uid):
        return [] if a["parts"][0] else ["empty_part"]           # a list expected; the model sent an object
    t = ModelTask("t.y", "fast", "foundation_phases", lambda ctx, u: "q", validate, key=lambda a: a["v"])
    mc = MockClient({("t.y", "u4"): {"v": True, "parts": {"a": 1}}})
    r = Runner(mc).run(c, t, "u4", None)
    assert r.status == "to_review" and r.answer is None
    assert any(str(e).startswith("invalid_shape:KeyError") for a in c.audit for e in a.get("errors", []))


# ---------------------------------------------------------------- foundation
def test_phase_decisions_offer_mention_and_price():
    c = ctx_of([("SALES", "It's a six-month mentorship, I'll show you later. How long have you wanted this?"),
                ("PROSPECT", "Three years."),
                ("SALES", "Let me share my screen."),
                ("SALES", "So the way it works, it's a six-month mentorship with three pillars."),
                ("SALES", "Our students charge 800 to 1,000 per room."),
                ("SALES", "The investment is 5,800."),
                ("SALES", "Are you ready to get started?")])
    c.offer_reference = {"price": 5800}
    ans = {"T001": {"offer_description": True, "followed_by_discovery": True, "quote": "six-month mentorship"},
           "T003": {"screen_share": True, "quote": "share my screen"},
           "T004": {"offer_description": True, "quote": "six-month mentorship with three pillars"},
           "T005": {"price_for_offer": False},
           "T006": {"price_for_offer": True, "amount": 5800, "quote": "The investment is 5,800"},
           "T007": {"decision_request": True, "quote": "ready to get started"}}
    decide_phases(c, ans)
    assert c.phases.offer_mentions == ["T001"]
    assert c.phases.pitch_start == "T003"          # screen share followed by an offer description (PB-1)
    assert c.phases.first_price == "T006" and c.phases.decision_request == "T007"
    assert c.phases.pitch_end == "T006"


def test_attribution_repair_split():
    c = ctx_of([("SALES", "And the cost?"), ("PROSPECT", "what does that actually cost you? Time. The most expensive thing is time.")])
    repair_attribution(c, [{"turn": "T002", "type": "merged", "foreign_quote": "what does that actually cost you?"}])
    ids = [t.id for t in c.turns]
    assert ids == ["T001", "T002", "T002b"]
    assert c.turn("T002b").role == "SALES" and "Time." in c.turn("T002").text
    assert c.n("T002b") == 2


# ---------------------------------------------------------------- aggregation
def test_period_levels_and_floor_rule():
    res = [{"start_utc": f"2026-10-{d:02d}T10:00:00Z", "status": "scored", "score": 90,
            "items": [{"id": "G1", "level": 2}, {"id": "G6", "level": 1}]} for d in range(14, 21)]
    p = aggregate.period(res, "GAP", "7d", date(2026, 10, 20), "Asia/Dubai")
    assert p["n_scored"] == 7 and p["score"] == 90
    assert p["level"] == "Developing" and p.get("floor_rule")     # G6 level-2 rate 0 % < 25 %
    few = aggregate.period(res[:3], "GAP", "7d", date(2026, 10, 20), "Asia/Dubai")
    assert few["label"].startswith("insufficient volume")
