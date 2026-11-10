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
            for k in ("next_discovery_question", "lnp_offer_price", "offer_explained"):
                prev[k] = prev.get(k) or c.get(k)
        else:
            answers[t.id] = dict(c)
    explained = _apply_rules(ctx, answers, drops)
    decide_phases(ctx, answers)
    ph = ctx.phases
    if ph.early_price and (not ph.first_price or ctx.n(ph.early_price) < ctx.n(ph.first_price)):
        start = explained.get(ph.early_price) or ph.early_price           # the price goes with the offer's explanation
        ph.pitch_start = min(start, ph.early_price, key=ctx.n)
        ph.first_price, ph.early_price = ph.early_price, None
        ph.flags.append("pitch_start_from_price")
    elif ph.first_price and not ph.pitch_start:                           # a price with no pitch start: its explanation
        ph.pitch_start = min(explained.get(ph.first_price) or ph.first_price, ph.first_price, key=ctx.n)
        ph.flags.append("pitch_start_from_price")
    ph.discovery_end = discovery_end(ctx)


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


def _apply_rules(ctx: CallContext, answers: dict[str, dict], drops: Drops) -> dict[str, str]:
    explained: dict[str, str] = {}
    for tid, a in answers.items():
        if a.get("offer_description") or a.get("screen_share"):
            nq = _sales_quote(ctx, a.get("next_discovery_question"))
            if nq and ctx.n(nq) > ctx.n(tid):
                a["followed_by_discovery"] = True                          # PB-2: a mention, not the pitch start
            elif a.get("next_discovery_question"):
                drops.add(STEP, "pitch:bad_discovery_quote", a.get("next_discovery_question"))
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
