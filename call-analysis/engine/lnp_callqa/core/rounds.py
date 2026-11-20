"""Calls of one sales cycle: R1, R2, R3 (Part C, C9; Romain, 2026-11-20).

What a call is evaluated on depends on what the earlier calls of the cycle already did:
- the gap: a gap is good when it is present, with the four components (problem, cost, A, B) and validated. After a good
  gap, a later call is not evaluated on discovery nor on gap (`gap_made_in_previous_call`). After a bad gap (absent,
  incomplete or not validated), the next call must deepen the discovery and restate the gap: both are evaluated;
- the pitch: evaluated once, in the first call where it happens; a later call is not evaluated on it
  (`pitch_made_in_previous_call`);
- the objections: once the price was given in an earlier call, every resistance of the call counts, from its start
  (OB-27 reads "after the first price" of the cycle), and prevention, which belongs before the first price, is not
  evaluated again;
- an earlier call that was not analysed is unknown: the call is evaluated as a first call.
Inside a call, a bad gap must be followed by a new restatement or a return to discovery before the pitch
(`gap_remediation`): when neither comes, the call is flagged `gap_not_remedied` (no score of its own).
"""
from __future__ import annotations

from typing import Any, Optional

from .models import CallContext

GAP_COMPONENTS = ("PROBLEM", "COST", "A", "B")
CODED = ("S", "P", "I", "N")


def gap_good(details: Optional[dict]) -> Optional[bool]:
    """True: present, the four components restated (validation is part of "present"); False: absent or incomplete;
    None: no gap was evaluated (not applicable, excluded, carried from an earlier call)."""
    d = details or {}
    if d.get("verdict") not in ("present", "absent"):
        return None
    if d["verdict"] != "present":
        return False
    comps = (d.get("restitution") or {}).get("components") or {}
    return all(comps.get(k) for k in GAP_COMPONENTS)


def _price_given(results: dict) -> bool:
    ph = (results.get("PITCH") or {}).get("phases") or {}
    if ph.get("first_price"):
        return True
    ob = results.get("OBJECTIONS") or {}
    return ob.get("prevention_status") == "scored" or any(e.get("after_first_price") for e in ob.get("episodes") or [])


def plan(sales_round: Optional[int], prior: Optional[list]) -> dict[str, Any]:
    """What the earlier analysed calls of the cycle did. `prior`: crm_ca_claim's `prior`, oldest first, each
    {"call_id", "start_utc", "results": {competence: details}}."""
    calls = [p for p in prior or [] if isinstance(p, dict)]
    out: dict[str, Any] = {"round": sales_round, "earlier_calls": len(calls), "gap_good": None, "gap_from": None,
                           "pitch_done": False, "price_given": False}
    if not sales_round or sales_round < 2 or not calls:
        return out                                  # a first call, or nothing known before it: evaluated as a first call
    for p in calls:
        res = p.get("results") or {}
        g = gap_good(res.get("GAP"))
        if g is not None:
            out["gap_good"], out["gap_from"] = g, p.get("call_id")
            out["gap_details"] = res.get("GAP")
        if ((res.get("PITCH") or {}).get("phases") or {}).get("pitch_start"):
            out["pitch_done"] = True
        if _price_given(res):
            out["price_given"] = True
    return out


def skip_reason(ctx: CallContext, competence: str) -> Optional[str]:
    """Why a competence is not evaluated in this call (C9), or None."""
    c = ctx.cycle or {}
    if competence in ("SPIN", "GAP") and c.get("gap_good") is True:
        return "gap_made_in_previous_call"
    if competence == "PITCH" and c.get("pitch_done"):
        return "pitch_made_in_previous_call"
    return None


def carried_gap(ctx: CallContext) -> dict:
    """The gap made in an earlier call, as this call's Gap details (not applicable here): the pitch of this call is
    read against it (validated problem, A, B, roadmap blockers); its turns belong to the earlier call."""
    c = ctx.cycle or {}
    return dict(c.get("gap_details") or {}, carried_from=c.get("gap_from"), cycle=public(c))


def public(cycle: dict) -> dict:
    """The plan without the earlier call's details (what the record shows)."""
    return {k: v for k, v in (cycle or {}).items() if k != "gap_details"}


def objections_from_start(ctx: CallContext) -> bool:
    """The price was given in an earlier call: every resistance of this call counts, from its start (OB-27)."""
    return bool((ctx.cycle or {}).get("price_given"))


def gap_remediation(ctx: CallContext) -> Optional[dict]:
    """A bad gap must be followed, before the pitch, by a new restatement or a return to discovery (C9). Returns
    {"needed", "done": "restatement" | "discovery" | None, "after"} and flags the call when nothing came."""
    g = ctx.results.get("GAP")
    if not g or g.status != "scored":
        return None
    det = g.details or {}
    if gap_good(det) is not False:
        return {"needed": False}
    rests = [r for r in det.get("restitutions") or [] if r.get("span")]
    if not rests:
        return None                                 # no restatement at all: the gap is absent, nothing to follow up
    rests.sort(key=lambda r: ctx.n(r["span"][0]))
    end = rests[0]["span"][-1]
    limit = ctx.phases.pitch_start
    within = lambda t: ctx.n(t) > ctx.n(end) and (limit is None or ctx.n(t) < ctx.n(limit))   # noqa: E731
    sols = ((ctx.results.get("SPIN") or None) and ctx.results["SPIN"].details or {}).get("solicitations") or []
    done = None
    if any(within(r["span"][0]) for r in rests[1:]):
        done = "restatement"
    elif any(s.get("letter") in CODED and s.get("turn") in {t.id for t in ctx.turns} and within(s["turn"]) for s in sols):
        done = "discovery"
    if done is None:
        g.flags.append("gap_not_remedied")
        if "gap_not_remedied" not in ctx.flags:
            ctx.flags.append("gap_not_remedied")
    out = {"needed": True, "done": done, "after": end}
    det["remediation"] = out
    return out
