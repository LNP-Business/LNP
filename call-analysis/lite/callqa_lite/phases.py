"""S0 → phase map. The model lists the sales turns with an offer, an amount or a decision cue (the closed answers of the
engine's `foundation.phases` task, for every turn at once); the engine's `decide_phases` places the anchors (PB-1,
PB-2/PB-17, PB-3/PB-18, PB-19, PB-4) and `spin.discovery_end` the end of the discovery (SB-1).

Romain, 2026-11-03, two rules checked by the code before the anchors are placed:
- the first price is said by the sales FOR THE LNP OFFER and goes with its explanation: a price_for_offer turn counts only
  if the model says it is the price of the LNP offer (`lnp_offer_price`) and quotes the SALES turn, at or before it, that
  explains that offer (`offer_explained`, an exact passage); a price the prospect could charge her own students, a market
  price or an ad budget is dropped (`price:not_lnp_offer`, `price:no_offer_explained`);
- an introduction is not the pitch start: an offer mention after which the sales goes back to discovery questions is a
  mention (PB-2), and the code takes it as such when the model quotes that discovery question (`next_discovery_question`,
  an exact passage of a later SALES turn);
- a valid LNP price said before the pitch start found that way belongs to the explanation of the offer: the pitch starts
  at the turn that explains it (or at the price turn).
Romain, 2026-11-20 (PB-3): a "market tour" (price ranges given as what the market offers) whose levels are the company's
own offers is a disguised price, an error of the sales: it is the first price when the model quotes the later SALES turn
that presents one of these levels as the offer (`tied_later`, an exact passage after it); the call is flagged
`disguised_price`. A market tour never tied to the offer stays a market price (`price:market_tour_not_tied`).
The end of the discovery is then moved to the gap's validation when a gap is made (engine.py, after S2)."""
from __future__ import annotations

from typing import Optional

from lnp_callqa.competences.spin import discovery_end
from lnp_callqa.core.foundation import _ph_validate, decide_phases
from lnp_callqa.core.models import CallContext, Evidence, SALES
from lnp_callqa.core.text import quote_ok

from .shim import Drops

STEP = "S0"
FLAGS = ("offer_description", "screen_share", "followed_by_discovery", "price_for_offer", "hypothetical",
         "decision_request")


def apply_phases(ctx: CallContext, answer: dict, drops: Drops) -> None:
    answers: dict[str, dict] = {}
    for c in answer.get("turns") or []:
        if not isinstance(c, dict):
            drops.add(STEP, "not_an_object")
            continue
        try:
            t = ctx.turn(c.get("turn") or "")
        except KeyError:
            drops.add(STEP, "unknown_turn", c)
            continue
        if t.role != SALES:
            drops.add(STEP, "wrong_speaker", c)
            continue
        errs = _ph_validate(c, ctx, t)
        if errs:
            drops.add(STEP, errs[0] or "bad_quote", c)
            continue
        prev = answers.get(t.id)
        if prev:                                  # the same turn listed twice: the closed answers are merged
            for k in FLAGS:
                prev[k] = bool(prev.get(k) or c.get(k))
            prev["amount"] = prev.get("amount") or c.get("amount")
            for k in ("next_discovery_question", "lnp_offer_price", "offer_explained", "market_tour", "tied_later"):
                prev[k] = prev.get(k) or c.get(k)
        else:
            answers[t.id] = dict(c)
    explained = _apply_rules(ctx, answers, drops)
    decide_phases(ctx, answers)
    ph = ctx.phases
    disguised = {t for t, a in answers.items() if a.get("price_for_offer") and a.get("market_tour")}
    if ph.early_price and (not ph.first_price or ctx.n(ph.early_price) < ctx.n(ph.first_price)):
        start = explained.get(ph.early_price) or ph.early_price           # the price goes with the offer's explanation
        ph.pitch_start = min(start, ph.early_price, key=ctx.n)
        ph.first_price, ph.early_price = ph.early_price, None
        ph.flags.append("pitch_start_from_price")
    elif ph.first_price and not ph.pitch_start:                           # a price with no pitch start: its explanation
        ph.pitch_start = min(explained.get(ph.first_price) or ph.first_price, ph.first_price, key=ctx.n)
        ph.flags.append("pitch_start_from_price")
    # PB-4: the pitch ends at the first price or the first decision request after its start; recomputed once the code has
    # moved the price or the start (LNP, 2026-11-19: Antoine's pitch end was left on a turn that was neither)
    ends = [x for x in (ph.first_price, ph.decision_request)
            if x and (not ph.pitch_start or ctx.n(x) >= ctx.n(ph.pitch_start))]
    ph.pitch_end = min(ends, key=ctx.n) if ends else None
    ph.discovery_end = discovery_end(ctx)
    if ph.first_price and ph.first_price in disguised:                    # PB-3 (Romain, 2026-11-20): an error of the sales
        ph.flags.append("disguised_price")
        if "disguised_price" not in ctx.flags:
            ctx.flags.append("disguised_price")


def _sales_quote(ctx: CallContext, d: object) -> Optional[str]:
    """The turn of an exact passage of a SALES turn ({turn, quote}), else None."""
    if not isinstance(d, dict) or not d.get("turn") or not d.get("quote"):
        return None
    try:
        t = ctx.turn(d["turn"])
    except KeyError:
        return None
    if t.role != SALES or quote_ok(ctx, Evidence(d["quote"], t.id, SALES), min_words=2, max_words=60):
        return None
    return t.id


# PB-2 / PB-17: an offer description is a mention (not the pitch start) only when the return to discovery questions comes
# within 2 sales turns (LNP, 2026-11-19: any later question used to count, and Maria's pitch was read at the price)
MENTION_RETURN_SALES_TURNS = 2


def _sales_turns_between(ctx: CallContext, a: str, b: str) -> int:
    """The sales turns after a, up to b included."""
    return sum(1 for t in ctx.turns if t.role == SALES and ctx.n(a) < ctx.n(t.id) <= ctx.n(b))


def _apply_rules(ctx: CallContext, answers: dict[str, dict], drops: Drops) -> dict[str, str]:
    explained: dict[str, str] = {}
    for tid, a in answers.items():
        if a.get("offer_description") or a.get("screen_share"):
            nq = _sales_quote(ctx, a.get("next_discovery_question"))
            if nq and ctx.n(nq) > ctx.n(tid) and _sales_turns_between(ctx, tid, nq) <= MENTION_RETURN_SALES_TURNS:
                a["followed_by_discovery"] = True                          # PB-2: a mention, not the pitch start
            elif nq and ctx.n(nq) > ctx.n(tid):
                drops.add(STEP, "pitch:discovery_too_far", a.get("next_discovery_question"))   # PB-2 / PB-17: 2 turns
            elif a.get("next_discovery_question"):
                drops.add(STEP, "pitch:bad_discovery_quote", a.get("next_discovery_question"))
        if a.get("price_for_offer") and a.get("market_tour"):              # PB-3: a disguised price, if tied to the offer
            tied = _sales_quote(ctx, a.get("tied_later"))
            if not tied or ctx.n(tied) <= ctx.n(tid):
                a["price_for_offer"] = a["market_tour"] = False
                drops.add(STEP, "price:market_tour_not_tied", {"turn": tid, "quote": a.get("quote")})
                continue
            a["lnp_offer_price"] = True
            explained[tid] = _sales_quote(ctx, a.get("offer_explained")) or tid
            if ctx.n(explained[tid]) > ctx.n(tid):
                explained[tid] = tid
            continue
        if a.get("price_for_offer"):
            if a.get("lnp_offer_price") is not True:
                a["price_for_offer"] = False
                drops.add(STEP, "price:not_lnp_offer", {"turn": tid, "quote": a.get("quote")})
                continue
            ex = _sales_quote(ctx, a.get("offer_explained"))
            if not ex or ctx.n(ex) > ctx.n(tid):
                a["price_for_offer"] = False
                drops.add(STEP, "price:no_offer_explained", {"turn": tid, "quote": a.get("quote")})
                continue
            explained[tid] = ex
    return explained
