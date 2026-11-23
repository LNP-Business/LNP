"""C1b (Romain, 2026-11-23): a call with a person already enrolled is not a sales call.

The calls of a cycle hold, next to the sales calls, sessions with someone who has already joined the offer: a tour of the
platform and its modules, a follow-up of their progress, an interview. Read as sales calls they score 0 on the gap and the
pitch, and the sales looks as if they lost a sale. The model answers one closed question in the phase step (S0) with an
exact quote; the code decides: the person is enrolled, the quote is an exact passage of the cited turn, and it comes before
the first price of the offer (a prospect who joins during the call, after the price, is a sale, not a session). Then every
competence is excluded, with the evidence, and nothing is scored.
"""
from __future__ import annotations

from typing import Optional

from lnp_callqa.core.models import CallContext, Evidence
from lnp_callqa.core.text import quote_ok

from .shim import Drops

STATUS = "not_sales_call"


def call_kind(ctx: CallContext, s0: Optional[dict], drops: Drops) -> dict:
    """{"not_sales": bool, and when true "turn", "ts", "quote"} from the S0 answer's `enrolled_client`."""
    e = (s0 or {}).get("enrolled_client")
    if not isinstance(e, dict) or e.get("value") is not True:
        return {"not_sales": False}
    turn, quote = e.get("turn") or "", e.get("quote") or ""
    err = quote_ok(ctx, Evidence(quote, turn, None), min_words=3, max_words=40)
    if err:
        drops.add("S0", f"enrolled_client:{err}")
        return {"not_sales": False}
    price = ctx.phases.first_price
    if price and not ctx.before(turn, price):
        drops.add("S0", "enrolled_client:after_price")               # joined during the call: a sale
        return {"not_sales": False}
    return {"not_sales": True, "turn": turn, "ts": ctx.turn(turn).ts, "quote": quote}
