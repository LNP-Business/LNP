"""Shared foundation, computed once per call before any competence (stages S0, C1, S2).

S0  parse and normalise the transcript into numbered turns
C1  diarization quality gate + attribution check (merged / swapped / echo turns) and repair
S2  phase map: pitch start, offer mentions, first price, early price, decision request (Pitch annex PB-1..PB-4,
    PB-17..PB-19). The discovery start is set by the SPIN module (SB-1/SB-2).
"""
from __future__ import annotations

import re
from typing import Any, Optional

from .models import CallContext, Evidence, OTHER, PROSPECT, SALES, Turn
from .runner import ModelTask, Runner
from .text import norm, quote_ok

LINE = re.compile(r"^\[?(?:T\d+\s+)?(\d{1,2}:\d{2}(?::\d{2})?)\]?\s*([^:]{1,80}):\s*(.*)$")


# ------------------------------------------------------------------------------------------- S0
def parse_transcript(raw: str, speaker_map: dict[str, str]) -> list[Turn]:
    """Lines like "[00:06] Valentino Dooneson-Pereira: text". Unknown speakers map to OTHER.
    Consecutive lines of the same speaker are joined (wrapped lines)."""
    turns: list[Turn] = []
    for line in raw.splitlines():
        line = line.strip()
        if not line:
            continue
        m = LINE.match(line)
        if not m:
            if turns:
                turns[-1].text += " " + line
            continue
        ts, spk, text = m.groups()
        role = speaker_map.get(spk.strip(), OTHER)
        if role not in (SALES, PROSPECT, OTHER):
            role = {"sales": SALES, "prospect": PROSPECT}.get(role.lower(), OTHER)
        if turns and turns[-1].speaker == spk.strip():
            turns[-1].text += " " + text
            continue
        n = len(turns) + 1
        turns.append(Turn(f"T{n:03d}", n, ts, spk.strip(), role, re.sub(r"\s+", " ", text).strip()))
    return turns


def diarization_gate(ctx: CallContext, max_share: float = 0.92, min_prospect_words: int = 150) -> None:
    if not ctx.turns:
        ctx.status = "no_transcript"
        return
    if not any(t.role == SALES for t in ctx.turns) or not any(t.role == PROSPECT for t in ctx.turns):
        ctx.status = "no_diarization"
        return
    w = {SALES: 0, PROSPECT: 0, OTHER: 0}
    for t in ctx.turns:
        w[t.role] += len(t.text.split())
    tot = sum(w.values()) or 1
    if max(w.values()) / tot > max_share or w[PROSPECT] < min_prospect_words:
        ctx.status = "diarization_suspect"
        ctx.flags.append("diarization_share")


# ------------------------------------------------------------------------------------------- C1
def _attr_build(ctx: CallContext, chunk: list[Turn]) -> str:
    return ("Read each turn against its speaker label and list every case of: (1) merged turn (a turn that "
            "contains the other role's speech), (2) swapped turn (content that can only belong to the other role), "
            "(3) echo (the same sentence under both labels within 3 turns).\n"
            "For a merged turn, give `boundary_quote`: the exact words where the other role's speech starts, and "
            "`foreign_quote`: the exact foreign part. Answer JSON: {\"cases\": [{\"turn\": \"T012\", \"type\": "
            "\"merged|swapped|echo\", \"foreign_quote\": \"...\", \"boundary_quote\": \"...\"}]}\n\nTRANSCRIPT\n" +
            "\n".join(f"[{t.id} {t.ts}] {t.role}: {t.text}" for t in chunk))


def _attr_validate(ans: dict, ctx: CallContext, unit: Any) -> list[str]:
    errs = []
    for c in ans.get("cases", []):
        if c.get("type") not in ("merged", "swapped", "echo"):
            errs.append("bad_type")
        elif quote_ok(ctx, Evidence(c.get("foreign_quote", ""), c.get("turn", "")), min_words=1, max_words=200):
            errs.append(f"bad_quote:{c.get('turn')}")
    return errs


ATTRIBUTION = ModelTask("foundation.attribution", "fast", "foundation_attribution", _attr_build, _attr_validate,
                        key=lambda a: sorted((c["turn"], c["type"]) for c in a.get("cases", [])))


def repair_attribution(ctx: CallContext, cases: list[dict]) -> None:
    """Split merged turns at the quoted boundary, relabel swapped turns, drop echoes. Turn ids are kept stable:
    the foreign part of a merged turn becomes a sub-turn "T050b" inserted right after (ids stay sortable)."""
    by_id = {t.id: t for t in ctx.turns}
    new_turns: list[Turn] = []
    touched = set()
    for t in ctx.turns:
        cs = [c for c in cases if c.get("turn") == t.id]
        if not cs:
            new_turns.append(t)
            continue
        touched.add(t.id)
        c = cs[0]
        other = SALES if t.role == PROSPECT else PROSPECT
        if c["type"] == "swapped":
            t.role, t.repaired = other, True
            new_turns.append(t)
        elif c["type"] == "echo":
            t.attribution_doubtful = True       # the echoed copy is excluded from every computation
            new_turns.append(t)
        else:
            fq = c.get("foreign_quote", "")
            i = norm(t.text).find(norm(fq))
            if i < 0:
                t.attribution_doubtful = True
                new_turns.append(t)
                continue
            raw = t.text
            # map normalised index back approximately on the raw text (same length after whitespace collapse)
            raw_n = re.sub(r"\s+", " ", raw)
            own_a, foreign, own_b = raw_n[:i].strip(), raw_n[i:i + len(fq)].strip(), raw_n[i + len(fq):].strip()
            t.text, t.repaired = (own_a + " " + own_b).strip() or own_a, True
            new_turns.append(t)
            new_turns.append(Turn(t.id + "b", t.n, t.ts, t.speaker, other, foreign, repaired=True))
    ctx.turns = new_turns
    rate = len(touched) / max(1, len({t.n for t in ctx.turns}))
    if rate > 0.10:
        ctx.status = "diarization_suspect"
        ctx.flags.append("attribution_rate")


def run_attribution(ctx: CallContext, runner: Runner, chunk_size: int = 60) -> None:
    cases: list[dict] = []
    for k in range(0, len(ctx.turns), chunk_size):
        chunk = ctx.turns[k:k + chunk_size]
        res = runner.run(ctx, ATTRIBUTION, f"attr:{chunk[0].id}", chunk)
        if res.answer:
            cases += res.answer.get("cases", [])
    repair_attribution(ctx, cases)


# ------------------------------------------------------------------------------------------- S2 phase map
OFFER_CUES = re.compile(r"\b(the program|the mentorship|the academy|what we do|the way we help|how it works|"
                        r"pillar|module|six-month|6-month|let me show you|share my screen|my screen)\b", re.I)
AMOUNT = re.compile(r"(\$\s?\d[\d,.]*\s?(k|grand)?|\b\d[\d,.]*\s?(k|grand|dollars|usd|euros?)\b|\b\d{1,3},\d{3}\b)", re.I)
DECISION = re.compile(r"\b(ready to (get started|move forward|start)|what would you like to do|do you want to "
                      r"(join|move forward|get started)|shall we get you started|how would you like to proceed)\b", re.I)


def phase_candidates(ctx: CallContext) -> list[Turn]:
    return [t for t in ctx.turns if t.role == SALES and not t.attribution_doubtful and
            (OFFER_CUES.search(t.text) or AMOUNT.search(t.text) or DECISION.search(t.text))]


def _ph_build(ctx: CallContext, t: Turn) -> str:
    i = ctx.turns.index(t)
    window = ctx.turns[max(0, i - 3): i + 6]
    return (f"TARGET TURN: {t.id}\nAnswer about the TARGET TURN only, using the rules of the phase map.\n"
            "JSON: {\"offer_description\": bool, \"screen_share\": bool, \"followed_by_discovery\": bool, "
            "\"price_for_offer\": bool, \"amount\": number|null, \"hypothetical\": bool, \"range\": [min,max]|null, "
            "\"decision_request\": bool, \"quote\": \"exact words of the target turn that justify the true answers\"}\n\n"
            "CONTEXT\n" + "\n".join(f"[{x.id} {x.ts}] {x.role}: {x.text}" for x in window))


def _ph_validate(ans: dict, ctx: CallContext, unit: Any) -> list[str]:
    if any(ans.get(k) for k in ("offer_description", "screen_share", "price_for_offer", "decision_request")):
        e = quote_ok(ctx, Evidence(ans.get("quote", ""), unit.id if hasattr(unit, "id") else unit, SALES))
        return [e] if e else []
    return []


PHASES = ModelTask("foundation.phases", "fast", "foundation_phases", _ph_build,
                   lambda a, c, u: _ph_validate(a, c, c.turn(u.split(":", 1)[-1]) if isinstance(u, str) else u),
                   key=lambda a: [bool(a.get(k)) for k in ("offer_description", "screen_share", "followed_by_discovery",
                                                            "price_for_offer", "hypothetical", "decision_request")])


def decide_phases(ctx: CallContext, answers: dict[str, dict]) -> None:
    """Code decision of PB-1, PB-2/PB-17, PB-3/PB-18, PB-19, PB-4."""
    ph = ctx.phases
    ref_price = (ctx.offer_reference or {}).get("price")
    sales_turns = [t for t in ctx.turns if t.role == SALES and not t.attribution_doubtful]
    # pitch start
    for t in sales_turns:
        a = answers.get(t.id) or {}
        if a.get("offer_description") or a.get("screen_share"):
            if a.get("followed_by_discovery"):
                ph.offer_mentions.append(t.id)          # PB-2 / PB-17
                continue
            if a.get("screen_share") and not a.get("offer_description"):
                nxt = [x for x in sales_turns if ctx.n(x.id) > ctx.n(t.id)][:2]   # PB-1: offer description within 2 sales turns
                if not any((answers.get(x.id) or {}).get("offer_description") for x in nxt):
                    continue
            ph.pitch_start = t.id
            ph.evidence["pitch_start"] = Evidence(a.get("quote", ""), t.id, SALES)
            break
    # first price
    for t in sales_turns:
        a = answers.get(t.id) or {}
        if not a.get("price_for_offer") or a.get("hypothetical"):
            continue
        amt = a.get("amount") or (a.get("range") or [None])[0]
        if ref_price and amt and not (0.3 * ref_price <= amt <= 3 * ref_price):   # PB-18 plausibility
            ph.flags.append(f"amount_doubtful:{t.id}")
            continue
        if ph.pitch_start and ctx.n(t.id) < ctx.n(ph.pitch_start):
            ph.early_price = ph.early_price or t.id             # PB-19
            continue
        ph.first_price = t.id
        ph.evidence["first_price"] = Evidence(a.get("quote", ""), t.id, SALES)
        break
    for t in sales_turns:
        a = answers.get(t.id) or {}
        if a.get("decision_request") and (ph.pitch_start is None or ctx.n(t.id) > ctx.n(ph.pitch_start)):
            ph.decision_request = t.id
            break
    ends = [x for x in (ph.first_price, ph.decision_request) if x]
    ph.pitch_end = min(ends, key=ctx.n) if ends else None


def run_phases(ctx: CallContext, runner: Runner) -> None:
    answers = {}
    for t in phase_candidates(ctx):
        r = runner.run(ctx, PHASES, f"phase:{t.id}", t)
        if r.answer:
            answers[t.id] = r.answer
        elif r.status == "to_review":
            ctx.phases.flags.append(f"to_review:{t.id}")
    decide_phases(ctx, answers)


def run_foundation(ctx: CallContext, runner: Runner) -> None:
    diarization_gate(ctx)
    if ctx.status != "ok":
        return
    run_attribution(ctx, runner)
    if ctx.status != "ok":
        return
    run_phases(ctx, runner)
