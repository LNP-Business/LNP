"""The call 001 pitch scenario of the engine's test_pitch.test_real_001_full_run, rebuilt for the worker tests."""
from lnp_callqa.core.models import Evidence, SALES, CompetenceResult


def span(turn, quote):
    return {"start_turn": turn, "start_quote": quote, "end_turn": turn, "end_quote": quote}


def pitch_001_setup(load):
    from lnp_callqa.competences import pitch as P
    ctx = load("001")
    ph = ctx.phases
    ph.pitch_start, ph.first_price, ph.pitch_end = "T085", "T113", "T113"
    ph.evidence["first_price"] = Evidence("the investment for our core program is 5,800 USD", "T113", SALES)
    vp = {"quote": "really helping me figure out the marketing and getting the clients", "turn": "T028", "key_expression": "getting the clients"}
    base = {"verdict": "present", "validation_turn": "T082", "restitution_span": [], "selected_A": None, "selected_B": None,
            "selected_P": None, "validated_P": vp, "cost": [],
            "roadmap_blockers": [{"object": "marketing", "quote": vp["quote"], "turn": "T028", "solicitation": "s1"}]}
    ctx.results["GAP"] = CompetenceResult("GAP", "GAP-1.3", verdict="present", details=base)
    q91 = "You don't have a client acquisition system at all."
    chunks = P.chunks(ctx, P.DEFAULT_CONFIG["chunk_turns"])
    claims_uid = next(f"claims:{a}-{b}" for a, b in chunks if ctx.n(a) <= ctx.n("T113") <= ctx.n(b))
    answers = {
        ("pitch.p_category", "pcat:T028"): {"category": "Acquisition", "turn": "T028", "quote": "figure out the marketing and getting the clients"},
        ("pitch.step1", "step1:T085"): {"step": span("T091", q91), "other_blockers": []},
        ("pitch.claims", claims_uid): {"claims": [{"kind": "price", "turn": "T113", "quote": "the investment for our core program is 5,800 USD"}]},
    }
    return ctx, answers
