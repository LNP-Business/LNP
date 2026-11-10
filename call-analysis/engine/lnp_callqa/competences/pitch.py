"""Competence 3 - Pitch (methodology version 2.0, rules PITCH-2.0).

One blocker (the validated P of the Gap), one mechanism (the one carrying the name of P's category), a four-step
staircase (1 restate the blocker, 2 the mechanism, 3 the transformation A -> B, 4 the proof), then the roadmap,
the amount and the decision. Compliance gate first (§5.1): pitch_before_gap (PB-37), out_of_gap_claim (PB-35,
PB-31), outcome_promise (PB-36) -> score 0. Then items K1..K7 (§5.2).

The model only extracts and quotes (closed answers, exact quotes); every decision below is code.
Business facts (mechanism principles and phases, case library, case matching factor, roadmap order) are
configuration: when absent the code flags them (§4) and never invents them.
"""
from __future__ import annotations

import itertools
import json
import re
from typing import Any, Optional

from ..core.models import CallContext, CompetenceResult, Evidence, PROSPECT, SALES
from ..core.runner import ModelTask, Runner
from ..core.scoring import call_score, item
from ..core.text import approval_only, canon, clean_tokens, key_expression_ok, norm, norm_number, quote_ok, sentences

NAME, RULES_VERSION = "PITCH", "PITCH-2.0"

# §2.1 - the nine blockers = the nine mechanisms
NINE = ["Skill", "Legitimacy", "Pricing", "Acquisition", "Selling", "Delivery", "Time", "Past failure",
        "Financial risk"]
UNKNOWN = "P_category_unknown"            # PB-27: fits none of the nine -> uncovered_case
NOT_BLOCKER = "not_a_pitch_blocker"       # PB-27: lack of money = decision-circuit fact / objection
CATEGORIES = NINE + [UNKNOWN, NOT_BLOCKER]

# §5.2 weights (proposals, to validate)
WEIGHTS = {"K1": 15, "K2": 20, "K3": 15, "K4": 15, "K5": 10, "K6": 15, "K7": 10}

PROMISE_ACTIONS = {"run_business", "find_clients", "sign_clients", "deliver_projects"}       # PB-36
ADHESION_KINDS = {"appropriation", "projection", "new_link"}                                 # PB-14
CLAIM_KINDS = {"figure", "case", "price", "guarantee"}                                       # PB-35

DEFAULT_CONFIG: dict[str, Any] = {
    "step_max_sentences": 3,          # PB-33 / K5 (tolerance to validate)
    "principle_max_words": 25,        # PB-29 principle in one sentence (to validate)
    "recitation_min_items": 3,        # PB-29 recitation threshold (to validate)
    "case_match_factor": None,        # PB-31 starting value within a factor: à confirmer -> None = not configured
    "mechanism_reference_missing_cap": 1,   # §4: step 2 checked on the category only (interpretation, to validate)
    "monologue_share": 0.85,          # §7 talk share threshold (to validate)
    "severity": "zero",               # §5.1: "zero" (score 0) or "cap40" (alternative to validate)
    "chunk_turns": 40,                # list tasks (claims, promises, adhesion) are chunked by this many turns
}


# ============================================================================================ small helpers
def _ev(d: Optional[dict], role: Optional[str] = None) -> Optional[Evidence]:
    if not d or not d.get("quote") or not d.get("turn"):
        return None
    return Evidence(d["quote"], d["turn"], role)


def _pos(ctx: CallContext, turn: str, quote: str = "") -> tuple[int, int]:
    """Position of a quote: (turn position, character index inside the normalised turn)."""
    i = norm(ctx.turn(turn).text).find(norm(quote).strip(' .,?!"')) if quote else 0
    return (ctx.n(turn), max(i, 0))


def _span_pos(ctx: CallContext, sp: Optional[dict]) -> Optional[tuple[int, int]]:
    """PB-32: a step is placed at the turn of its first sentence."""
    if not sp:
        return None
    return _pos(ctx, sp["start_turn"], sp.get("start_quote", ""))


def span_text(ctx: CallContext, sp: Optional[dict]) -> str:
    """Normalised sales text of a step span, from its start quote to the end of its end quote (SALES turns only)."""
    if not sp:
        return ""
    s, e = sp["start_turn"], sp["end_turn"]
    out = []
    for t in ctx.turns[ctx.n(s): ctx.n(e) + 1]:
        if t.role != SALES or t.attribution_doubtful:
            continue
        txt = norm(t.text)
        if t.id == e and sp.get("end_quote"):
            q = norm(sp["end_quote"]).strip(' .,?!"')
            j = txt.find(q)
            if j >= 0:
                txt = txt[: j + len(q)]
        if t.id == s and sp.get("start_quote"):
            q = norm(sp["start_quote"]).strip(' .,?!"')
            j = txt.find(q)
            if j >= 0:
                txt = txt[j:]
        out.append(txt)
    return " ".join(out).strip()


def n_sentences(ctx: CallContext, sp: Optional[dict]) -> int:
    """PB-33: end punctuation, then split at 'and' + subject in sentences over 40 words."""
    return len(sentences(span_text(ctx, sp))) if sp else 0


def numbers_in(text: str) -> list[str]:
    """Canonical numbers of a text (PB-21 normalisation: 10K = 10,000 = $10,000 = ten thousand)."""
    return [t for t in canon(clean_tokens(text), False) if re.fullmatch(r"\d+(\.\d+)?", t)]


def num_eq(a: Any, b: Any) -> bool:
    if a is None or b is None:
        return False
    na, nb = norm_number(str(a)), norm_number(str(b))
    if na is None or nb is None:
        return False
    return float(na) == float(nb)


_UNIT_MAP = {"monthly": "month", "months": "month", "mo": "month", "yearly": "year", "years": "year",
             "annual": "year", "annually": "year", "yr": "year", "weekly": "week", "weeks": "week", "wk": "week",
             "hours": "hour", "hrs": "hour", "hr": "hour", "h": "hour", "clients": "client", "projects": "project",
             "days": "day", "daily": "day"}
_UNIT_DROP = {"$", "€", "£", "usd", "eur", "euro", "euros", "dollar", "dollars", "per", "a", "an", "/", "each",
              "every", "of", "in", "income", "revenue"}


def norm_unit(u: Optional[str]) -> frozenset:
    """Unit comparison for 'his unit' (PB-30, PB-31): currency and filler words ignored, synonyms merged."""
    toks = re.findall(r"[a-z$€£/]+", (u or "").lower().replace("/", " / "))
    return frozenset(_UNIT_MAP.get(t, t) for t in toks if t not in _UNIT_DROP)


def _bounds(ctx: CallContext) -> tuple[Optional[str], Optional[str]]:
    """The pitch window used by every task: pitch start .. decision request (PB-35), else end of call."""
    return ctx.phases.pitch_start, ctx.phases.decision_request


def _after(ctx: CallContext, turn: Optional[str]) -> Optional[str]:
    """Turn id right after `turn` (for inclusive windows)."""
    if turn is None:
        return None
    i = ctx.n(turn) + 1
    return ctx.turns[i].id if i < len(ctx.turns) else None


def _window_end(ctx: CallContext) -> Optional[str]:
    """Exclusive end of the pitch window: the turn after the decision request (it is included), or None."""
    return _after(ctx, ctx.phases.decision_request)


# ============================================================================================ model tasks
def _render_window(ctx: CallContext, start: Optional[str], end_excl: Optional[str]) -> str:
    return ctx.render(ctx.window(start, end_excl))


def _check(ctx, d, role, errs, tag, phase=None, min_words=2):
    e = quote_ok(ctx, Evidence(d.get("quote", ""), d.get("turn", ""), role), min_words=min_words,
                 allowed_phase=phase)
    if e:
        errs.append(f"{tag}:{e}")


def _check_span(ctx, sp, errs, tag, phase):
    if sp is None:
        return
    for k in ("start", "end"):
        _check(ctx, {"quote": sp.get(f"{k}_quote", ""), "turn": sp.get(f"{k}_turn", "")}, SALES, errs,
               f"{tag}.{k}", phase, min_words=1)
    if not errs:
        if ctx.n(sp["end_turn"]) < ctx.n(sp["start_turn"]):
            errs.append(f"{tag}:end_before_start")


def _pitch_phase(ctx):
    return (ctx.phases.pitch_start, _window_end(ctx))


def _before_pitch(ctx):
    return (None, ctx.phases.pitch_start)


# ---- PB-27 category of P
def _cat_build(ctx: CallContext, vp: dict) -> str:
    i = ctx.n(vp["turn"])
    win = ctx.turns[max(0, i - 2): i + 1]
    return (f"VALIDATED P (from the Gap result): turn {vp['turn']}: \"{vp['quote']}\"\n"
            "Classify this blocker (PB-27). Quote the deciding words from that PROSPECT turn.\n\nCONTEXT\n" +
            ctx.render(win))


def _cat_validate(ans: dict, ctx: CallContext, unit_id: str) -> list[str]:
    errs: list[str] = []
    if ans.get("category") not in CATEGORIES:
        return ["bad_category"]
    if ans["category"] in NINE:
        _check(ctx, ans, PROSPECT, errs, "category", min_words=1)
        if not errs and ans.get("turn") != unit_id.split(":", 1)[1]:
            errs.append("category:not_the_validated_P_turn")
    return errs


CATEGORY = ModelTask("pitch.p_category", "strong", "pitch_category", _cat_build, _cat_validate,
                     key=lambda a: a.get("category"))


# ---- PB-28..PB-31 steps, PB-34 roadmap: one unit each, the whole pitch window
def _steps_context(ctx: CallContext, header: str) -> str:
    s, _ = _bounds(ctx)
    return (header + f"\nPITCH START: {s}. Answer about the pitch extract only.\n\nPITCH EXTRACT\n" +
            _render_window(ctx, s, _window_end(ctx)))


def _gap(ctx: CallContext) -> dict:
    g = ctx.results.get("GAP")
    return (g.details or {}) if g else {}


def _step1_build(ctx, unit):
    vp = _gap(ctx).get("validated_P") or {}
    return _steps_context(ctx, f"VALIDATED P: turn {vp.get('turn')}: \"{vp.get('quote')}\"")


def _step1_validate(ans, ctx, unit_id):
    errs: list[str] = []
    _check_span(ctx, ans.get("step"), errs, "step", _pitch_phase(ctx))
    for o in ans.get("other_blockers") or []:
        _check(ctx, o, SALES, errs, "other_blocker", _pitch_phase(ctx))
    return errs


STEP1 = ModelTask("pitch.step1", "strong", "pitch_step1", _step1_build, _step1_validate,
                  key=lambda a: [(a.get("step") or {}).get("start_turn"), len(a.get("other_blockers") or [])])


def _mech_reference_text(ctx: CallContext) -> str:
    ref = (ctx.offer_reference or {}).get("mechanisms") or {}
    if not ref:
        return "MECHANISM REFERENCE: missing (map by the blocker each passage answers)."
    return "MECHANISM REFERENCE\n" + json.dumps(ref, ensure_ascii=False, indent=1)


def _step2_build(ctx, unit):
    cat = unit or "unknown"
    return _steps_context(ctx, f"CATEGORY OF THE VALIDATED P: {cat}\n" + _mech_reference_text(ctx))


def _step2_validate(ans, ctx, unit_id):
    errs: list[str] = []
    _check_span(ctx, ans.get("step"), errs, "step", _pitch_phase(ctx))
    for m in ans.get("mechanisms_stated") or []:
        if m.get("mechanism") not in NINE:
            errs.append("bad_mechanism")
        if m.get("kind") not in ("principle", "phase"):
            errs.append("bad_kind")
        _check(ctx, m, SALES, errs, "mechanism", _pitch_phase(ctx))
    if ans.get("recitation"):
        _check(ctx, ans["recitation"], SALES, errs, "recitation", _pitch_phase(ctx))
    return errs


STEP2 = ModelTask("pitch.step2", "strong", "pitch_step2", _step2_build, _step2_validate,
                  key=lambda a: [(a.get("step") or {}).get("start_turn"),
                                 sorted({(m["mechanism"], m["kind"]) for m in a.get("mechanisms_stated") or []}),
                                 len((a.get("recitation") or {}).get("items") or [])])


def _step3_build(ctx, unit):
    g = _gap(ctx)
    return _steps_context(ctx, "SELECTED A (Gap): " + json.dumps(g.get("selected_A"), ensure_ascii=False) +
                          "\nSELECTED B (Gap): " + json.dumps(g.get("selected_B"), ensure_ascii=False))


def _step3_validate(ans, ctx, unit_id):
    errs: list[str] = []
    ph = _pitch_phase(ctx)
    _check_span(ctx, ans.get("step"), errs, "step", ph)
    for k in ("A", "B", "deadline", "image"):
        if ans.get(k):
            _check(ctx, ans[k], SALES, errs, k, ph, min_words=1)
    for k in ("deadline_source", "image_source"):
        if ans.get(k):
            _check(ctx, ans[k], PROSPECT, errs, k, _before_pitch(ctx), min_words=1)
    return errs


STEP3 = ModelTask("pitch.step3", "strong", "pitch_step3", _step3_build, _step3_validate,
                  key=lambda a: [(a.get("step") or {}).get("start_turn"),
                                 [((a.get(k) or {}).get("value"), (a.get(k) or {}).get("unit")) for k in ("A", "B")],
                                 bool(a.get("deadline")), bool(a.get("image")), a.get("image_key_expression")])


def _library_text(ctx: CallContext) -> str:
    lib = ctx.case_library or []
    if not lib:
        return "CASE LIBRARY: missing."
    return "CASE LIBRARY\n" + json.dumps(lib, ensure_ascii=False, indent=1)


def _step4_build(ctx, unit):
    return _steps_context(ctx, _library_text(ctx))


def _step4_validate(ans, ctx, unit_id):
    errs: list[str] = []
    ph = _pitch_phase(ctx)
    for c in ans.get("cases") or []:
        _check_span(ctx, c.get("step"), errs, "case.step", ph)
        _check(ctx, c, SALES, errs, "case", ph)
        if c.get("prospect_evidence"):
            _check(ctx, c["prospect_evidence"], PROSPECT, errs, "case.prospect", _before_pitch(ctx), min_words=1)
    return errs


STEP4 = ModelTask("pitch.step4", "strong", "pitch_step4", _step4_build, _step4_validate,
                  key=lambda a: sorted((c.get("turn"), c.get("library_id"), bool(c.get("profile_match")))
                                       for c in a.get("cases") or []))


def _roadmap_build(ctx, unit):
    rb = _gap(ctx).get("roadmap_blockers") or []
    return _steps_context(ctx, "HIS BLOCKERS (Gap roadmap_blockers): " + json.dumps(rb, ensure_ascii=False))


def _roadmap_validate(ans, ctx, unit_id):
    errs: list[str] = []
    ph = (ctx.phases.pitch_start, None)          # the roadmap may come after the price (K6 = 0), search to the end
    _check_span(ctx, ans.get("roadmap"), errs, "roadmap", ph)
    for s in ans.get("steps") or []:
        _check(ctx, s, SALES, errs, "roadmap.step", ph, min_words=1)
        if s.get("source"):
            _check(ctx, s["source"], PROSPECT, errs, "roadmap.source", _before_pitch(ctx), min_words=1)
    return errs


def _roadmap_window_build(ctx, unit):
    rb = _gap(ctx).get("roadmap_blockers") or []
    s = ctx.phases.pitch_start
    return ("HIS BLOCKERS (Gap roadmap_blockers): " + json.dumps(rb, ensure_ascii=False) +
            f"\nPITCH START: {s}. Answer about the extract only.\n\nEXTRACT (pitch start to end of call)\n" +
            _render_window(ctx, s, None))


ROADMAP = ModelTask("pitch.roadmap", "strong", "pitch_roadmap", _roadmap_window_build, _roadmap_validate,
                    key=lambda a: [(a.get("roadmap") or {}).get("start_turn"),
                                   sorted((s.get("turn"), bool(s.get("source"))) for s in a.get("steps") or [])])


# ---- PB-35, PB-36, PB-14: list tasks, chunked
def _chunk_bounds(ctx: CallContext, unit_id: str) -> tuple[str, Optional[str]]:
    a, b = unit_id.split(":", 1)[1].split("-")
    return a, _after(ctx, b)


def _chunk_build(header_fn):
    def build(ctx, unit):
        s, e = unit
        return header_fn(ctx) + "\n\nEXTRACT\n" + _render_window(ctx, s, _after(ctx, e))
    return build


def _claims_header(ctx):
    ref = {k: v for k, v in (ctx.offer_reference or {}).items() if k != "mechanisms"}
    return ("OFFER REFERENCE: " + (json.dumps(ref, ensure_ascii=False) if ref else "missing") + "\n" +
            _library_text(ctx))


def _claims_validate(ans, ctx, unit_id):
    errs: list[str] = []
    ph = _chunk_bounds(ctx, unit_id)
    for c in ans.get("claims") or []:
        if c.get("kind") not in CLAIM_KINDS:
            errs.append("bad_claim_kind")
        _check(ctx, c, SALES, errs, "claim", ph, min_words=1)
    return errs


CLAIMS = ModelTask("pitch.claims", "strong", "pitch_claims", _chunk_build(_claims_header), _claims_validate,
                   key=lambda a: sorted((c.get("turn"), c.get("kind"), c.get("library_id"), c.get("guarantee_ref"),
                                         bool(c.get("calculation"))) for c in a.get("claims") or []))


def _promises_validate(ans, ctx, unit_id):
    errs: list[str] = []
    ph = _chunk_bounds(ctx, unit_id)
    for p in ans.get("promises") or []:
        if p.get("action") not in PROMISE_ACTIONS:
            errs.append("bad_action")
        _check(ctx, p, SALES, errs, "promise", ph)
    return errs


PROMISES = ModelTask("pitch.promises", "strong", "pitch_promises", _chunk_build(lambda c: "Find outcome promises."),
                     _promises_validate,
                     key=lambda a: sorted((p.get("turn"), p.get("action")) for p in a.get("promises") or []))


def _adh_validate(ans, ctx, unit_id):
    errs: list[str] = []
    ph = _chunk_bounds(ctx, unit_id)
    for p in ans.get("passages") or []:
        if p.get("kind") not in ADHESION_KINDS:
            errs.append("bad_kind")
        _check(ctx, p, PROSPECT, errs, "adhesion", ph)
        if p.get("gesture"):
            _check(ctx, p["gesture"], SALES, errs, "gesture", None, min_words=1)
    return errs


ADHESION = ModelTask("pitch.adhesion", "fast", "pitch_adhesion", _chunk_build(lambda c: "Find adhesion passages."),
                     _adh_validate,
                     key=lambda a: sorted((p.get("turn"), p.get("kind"), bool(p.get("concrete")),
                                           bool(p.get("comprehension_echo")), bool(p.get("postpone")))
                                          for p in a.get("passages") or []))


def chunks(ctx: CallContext, size: int) -> list[tuple[str, str]]:
    """Deterministic chunks of the pitch window (pitch start .. decision request inclusive)."""
    s = ctx.phases.pitch_start
    turns = ctx.window(s, _window_end(ctx))
    return [(turns[k].id, turns[min(k + size, len(turns)) - 1].id) for k in range(0, len(turns), size)]


# ============================================================================================ pure decisions
def pitch_before_gap(ctx: CallContext, gap: dict, pitch_start: Optional[str]) -> bool:
    """PB-37 / §5.1 check 1: the Gap verdict is "present" and its validation turn comes before the pitch start.
    An offer_mention before the validation is not a pitch (it never sets pitch_start, PB-17)."""
    if pitch_start is None:
        return False
    if gap.get("verdict") != "present" or not gap.get("validation_turn"):
        return True
    return not ctx.before(gap["validation_turn"], pitch_start)


def mechanism_reference_missing(offer_reference: dict, category: Optional[str]) -> bool:
    """§2.1 / §4: the reference must hold, for the mechanism of P, its principle and its offer phase."""
    entry = ((offer_reference or {}).get("mechanisms") or {}).get(category or "") or {}
    return not (entry.get("principle") and entry.get("phase"))


# ---- K1 · Step 1 (PB-28, Gap GB-22)
def decide_k1(ctx: CallContext, validated_p: Optional[dict], step1: Optional[dict]) -> tuple[int, list, dict]:
    info: dict[str, Any] = {"span": None, "verbatim": False, "key_expression": None, "other_blockers": 0,
                            "sentences": 0}
    st = (step1 or {}).get("step")
    if not st:
        return 0, [], dict(info, failure="missing")
    info.update(span=[st["start_turn"], st["end_turn"]], sentences=n_sentences(ctx, st))
    others = [o for o in (step1 or {}).get("other_blockers") or []]
    info["other_blockers"] = len(others)
    ev = [Evidence(st["start_quote"], st["start_turn"], SALES)]
    verbatim = False
    if validated_p and validated_p.get("key_expression"):
        ke = validated_p["key_expression"]
        ok, why = key_expression_ok(ke, ctx.turn(validated_p["turn"]).text, span_text(ctx, st))
        verbatim = ok
        info.update(key_expression=ke, verbatim=ok, verbatim_reason=why)
        if ok:
            ev.append(Evidence(validated_p["quote"], validated_p["turn"], PROSPECT))
    if verbatim and not others:
        return 2, ev, info
    if verbatim or others:                      # with other blockers, or another blocker in its place
        return 1, ev, dict(info, failure="several_blockers" if verbatim else "other_blocker")
    return 0, ev, dict(info, failure="paraphrase")    # X9


def mechanisms_in_scope(ctx: CallContext, step2: Optional[dict], start_pos: Optional[tuple],
                        end_pos: Optional[tuple]) -> list[dict]:
    """PB-29: mechanisms stated between step 1 and the roadmap (or the price / decision when no roadmap)."""
    out = []
    for m in (step2 or {}).get("mechanisms_stated") or []:
        p = _pos(ctx, m["turn"], m["quote"])
        if start_pos and p < start_pos:
            continue
        if end_pos and p >= end_pos:
            continue
        out.append(dict(m, pos=p))
    return out


def principle_one_sentence(ctx: CallContext, m: dict, max_words: int) -> bool:
    """PB-29: the principle fits in one sentence of `max_words` words or fewer."""
    q = norm(m["quote"]).strip(' .,?!"')
    for s in sentences(ctx.turn(m["turn"]).text):
        if q in norm(s):
            return len(s.split()) <= max_words
    return False                                 # the quote crosses a sentence boundary


# ---- K2 · Step 2 (PB-29)
def decide_k2(ctx: CallContext, category: Optional[str], mechs: list[dict], recitation: Optional[dict],
              k1_level: int, ref_missing: bool, cfg: dict) -> tuple[Optional[int], list, dict]:
    info: dict[str, Any] = {"mechanisms": sorted({m["mechanism"] for m in mechs}), "principle": False,
                            "offer_phase": False, "recitation": False}
    if category not in NINE:
        return None, [], dict(info, failure="P_category_unknown")       # §5.2: K2 not applicable
    names = {m["mechanism"] for m in mechs}
    if not names:
        return 0, [], dict(info, failure="no_mechanism")
    if names != {category}:
        fail = "second_mechanism" if category in names else "wrong_mechanism"
        bad = [m for m in mechs if m["mechanism"] != category]
        return 0, [Evidence(bad[0]["quote"], bad[0]["turn"], SALES)], dict(info, failure=fail)
    principles = [m for m in mechs if m["kind"] == "principle"]
    phases = [m for m in mechs if m["kind"] == "phase"]
    pr = next((m for m in principles if principle_one_sentence(ctx, m, cfg["principle_max_words"])), None)
    ph = next((m for m in phases if pr is None or m["pos"] >= pr["pos"]), None)   # "then the phase"
    rec_items = (recitation or {}).get("items") or []
    rec = bool(recitation) and len(rec_items) >= cfg["recitation_min_items"]
    info.update(principle=pr is not None, offer_phase=ph is not None, recitation=rec,
                recitation_quote=(recitation or {}).get("quote") if rec else None)
    ev = [Evidence(m["quote"], m["turn"], SALES) for m in (pr, ph) if m] or \
        [Evidence(mechs[0]["quote"], mechs[0]["turn"], SALES)]
    level = 2 if (pr and ph and not rec) else 1
    if level == 1:
        info["failure"] = "recitation" if rec else ("no_principle" if not pr else "no_phase")
    if level == 2 and k1_level < 2:              # "only true for him": K2 = 2 only after a K1 at level 2
        level, info["failure"] = 1, "generic_step"
    if level == 2 and ref_missing:               # §4: checked on the category only
        level = min(level, cfg["mechanism_reference_missing_cap"])
        info["failure"] = "mechanism_reference_missing"
    return level, ev, info


# ---- K3 · Step 3 (PB-30)
def _value_in_quote(value: Any, quote: str) -> bool:
    nv = norm_number(str(value)) if value is not None else None
    return nv is not None and any(float(x) == float(nv) for x in numbers_in(quote))


def need_vision_turns(ctx: CallContext) -> set[str]:
    """PB-30: the image is in his words if it reuses a key expression of his N answers or VALUE atoms."""
    turns = {t for s in ctx.solicitations if s.letter == "N" for t in s.answer_turns}
    turns |= {a.evidence.turn for a in ctx.atoms if a.type == "VALUE"}
    return turns


def decide_k3(ctx: CallContext, gap: dict, step3: Optional[dict]) -> tuple[int, list, dict]:
    s3 = step3 or {}
    st, A, B = s3.get("step"), s3.get("A"), s3.get("B")
    gA, gB = gap.get("selected_A") or {}, gap.get("selected_B") or {}
    info: dict[str, Any] = {"span": [st["start_turn"], st["end_turn"]] if st else None,
                            "A": A and A.get("value"), "B": B and B.get("value"), "same_unit": False,
                            "his_figures": False, "deadline": None, "image_key_expression": None,
                            "sentences": n_sentences(ctx, st)}
    if not st or not A or not B:
        return 0, [], dict(info, failure="no_A_to_B")
    ev = [Evidence(A["quote"], A["turn"], SALES)]
    if not gA or not gB:
        return 0, ev, dict(info, failure="no_selected_A_B_in_gap")
    same_unit = norm_unit(A.get("unit")) == norm_unit(gA.get("unit")) and \
        norm_unit(B.get("unit")) == norm_unit(gB.get("unit") or gA.get("unit"))
    figures = num_eq(A.get("value"), gA.get("value")) and num_eq(B.get("value"), gB.get("value")) and \
        _value_in_quote(A.get("value"), A["quote"]) and _value_in_quote(B.get("value"), B["quote"])
    info.update(same_unit=same_unit, his_figures=figures)
    if not same_unit:
        return 0, ev, dict(info, failure="other_unit")                         # X11
    dl = s3.get("deadline")
    if dl:
        info["deadline"] = dl.get("quote")
        if not (s3.get("deadline_source") or gB.get("horizon")):
            return 0, ev, dict(info, failure="invented_date")                  # X11
    if not figures:
        return 0, ev, dict(info, failure="not_his_figures")                    # GB-24: the sales' figure
    img, src, ke = s3.get("image"), s3.get("image_source"), s3.get("image_key_expression")
    if not img:
        return 1, ev, dict(info, failure="no_image")
    ev.append(Evidence(img["quote"], img["turn"], SALES))
    in_words = False
    if src and ke and src["turn"] in need_vision_turns(ctx):
        ok, _ = key_expression_ok(ke, ctx.turn(src["turn"]).text, img["quote"])
        in_words = ok and _pos(ctx, img["turn"], img["quote"]) >= _pos(ctx, B["turn"], B["quote"])
    if not in_words:
        return 1, ev, dict(info, failure="image_not_his_words")
    info["image_key_expression"] = ke
    return 2, ev, info


# ---- K4 · Step 4 (PB-31)
def start_value_match(case: dict, A: dict, factor: Optional[float]) -> Optional[bool]:
    """PB-31: same dimension (unit of A) and starting value within the factor. None = factor not configured."""
    st = case.get("start") or {}
    if st.get("value") is None or A.get("value") is None:
        return False
    if norm_unit(st.get("unit")) != norm_unit(A.get("unit")):
        return False
    if factor is None:
        return None
    a, b = float(st["value"]), float(A["value"])
    if a == 0 or b == 0:
        return a == b
    return max(a, b) / min(a, b) <= factor


def decide_k4(ctx: CallContext, gap: dict, step4: Optional[dict], cfg: dict) -> tuple[Optional[int], list, dict]:
    lib = {c.get("id"): c for c in ctx.case_library or []}
    info: dict[str, Any] = {"cases": [], "case_id": None, "consent": None, "start_matches_A": None,
                            "proof_gap": False}
    if not lib:
        return None, [], dict(info, failure="case_library_missing")             # §4
    A = gap.get("selected_A") or {}
    factor = cfg.get("case_match_factor")
    cited = []
    for c in (step4 or {}).get("cases") or []:
        case = lib.get(c.get("library_id"))
        vm = start_value_match(case, A, factor) if case else False
        pm = bool(case and c.get("profile_match") and c.get("prospect_evidence") and (case.get("start") or {}).get("profile"))
        cited.append({"turn": c["turn"], "quote": c["quote"], "library_id": c.get("library_id"),
                      "in_library": case is not None, "consent": bool(case and case.get("consent")),
                      "start_matches_A": bool(vm) or pm, "step": c.get("step")})
    info["cases"] = cited
    # does the library hold a case matching his A? (§5.2 "Step 4 without a matching case")
    lib_vm = [start_value_match(c, A, factor) for c in lib.values() if c.get("consent")]
    if any(v is True for v in lib_vm) or any(c["start_matches_A"] and c["consent"] for c in cited):
        has_match: Optional[bool] = True
    elif factor is None:
        has_match = None                          # undecidable: matching factor à confirmer
    else:
        has_match = False
    info["library_has_match"] = has_match
    if has_match is False:
        return None, [], dict(info, proof_gap=True, failure="proof_gap")
    valid = [c for c in cited if c["in_library"] and c["consent"]]             # X12: not in library / no consent
    if not valid:
        f = "no_case" if not cited else "case_not_valid"
        if has_match is None:
            f += "; case_match_rule_missing"
        return 0, [], dict(info, failure=f)
    best = max(valid, key=lambda c: c["start_matches_A"])                       # several cases: best-matching
    info.update(case_id=best["library_id"], consent=True, start_matches_A=best["start_matches_A"])
    ev = [Evidence(best["quote"], best["turn"], SALES)]
    if best["start_matches_A"]:
        if A.get("quote") and A.get("turn"):
            ev.append(Evidence(A["quote"], A["turn"], PROSPECT))
        return 2, ev, info
    return 1, ev, dict(info, failure="best_case")


# ---- K5 · Order and brevity (PB-32, PB-33)
def decide_k5(ctx: CallContext, step_pos: dict[int, Optional[tuple]], step_sent: dict[int, int],
              not_applicable: set[int], step_ev: dict[int, Evidence], cfg: dict) -> tuple[int, list, dict]:
    required = [k for k in (1, 2, 3, 4) if k not in not_applicable]
    present = [k for k in required if step_pos.get(k)]
    order_ok = all(step_pos[a] < step_pos[b] for a, b in zip(present, present[1:]))
    brevity = {k: 1 <= step_sent.get(k, 0) <= cfg["step_max_sentences"] for k in present}
    info = {"present": present, "required": required, "order_ok": order_ok, "sentences": step_sent,
            "brevity_ok": all(brevity.values())}
    ev = [step_ev[k] for k in present if step_ev.get(k)]
    if len(present) < len(required) - 1:                       # fewer than three of the four steps
        return 0, ev, dict(info, failure="steps_missing")
    if len(present) == len(required) and order_ok and all(brevity.values()):
        return 2, ev, info
    return 1, ev, dict(info, failure="order" if not order_ok else ("step_missing" if len(present) < len(required)
                                                                   else "too_long"))


# ---- K6 · Roadmap, amount, decision (PB-34, PB-19, PB-32)
def roadmap_steps_matched(ctx: CallContext, gap: dict, steps: list[dict]) -> list[bool]:
    """PB-34: each roadmap step matched to one of his blockers (Gap GB-32) by key expression (GB-22)."""
    rb_turns = {b.get("turn") for b in gap.get("roadmap_blockers") or []}
    out = []
    for s in steps:
        src, ke = s.get("source"), s.get("key_expression")
        ok = bool(src and ke and src["turn"] in rb_turns and
                  key_expression_ok(ke, ctx.turn(src["turn"]).text, s["quote"])[0])
        out.append(ok)
    return out


def decide_k6(ctx: CallContext, gap: dict, roadmap: Optional[dict], last_step_pos: Optional[tuple]
              ) -> tuple[int, list, dict]:
    ph = ctx.phases
    rm = (roadmap or {}).get("roadmap")
    info: dict[str, Any] = {"span": [rm["start_turn"], rm["end_turn"]] if rm else None, "steps": [],
                            "before_price": None}
    if not rm:
        return 0, [], dict(info, failure="no_roadmap")
    rpos = _span_pos(ctx, rm)
    ev = [Evidence(rm["start_quote"], rm["start_turn"], SALES)]
    steps = (roadmap or {}).get("steps") or []
    matched = roadmap_steps_matched(ctx, gap, steps)
    info["steps"] = [{"quote": s["quote"], "turn": s["turn"], "blocker_quote": (s.get("source") or {}).get("quote"),
                      "matched": m} for s, m in zip(steps, matched)]
    if ph.early_price:                                         # PB-19: price before the pitch -> before the roadmap
        return 0, ev, dict(info, before_price=False, failure="price_before_roadmap")
    if ph.first_price and ctx.n(ph.first_price) <= rpos[0]:
        return 0, ev, dict(info, before_price=False, failure="price_before_roadmap")
    info["before_price"] = True if ph.first_price else None
    if last_step_pos and rpos <= last_step_pos:               # PB-34: the roadmap starts after step 4
        return 0, ev, dict(info, failure="roadmap_before_step4")
    if ph.first_price:
        ev.append(Evidence(ph.evidence["first_price"].quote, ph.first_price, SALES)
                  if "first_price" in ph.evidence and ph.evidence["first_price"].quote else None)
    if not steps or not all(matched):
        return 1, ev, dict(info, failure="steps_not_his_blockers")
    if not ph.first_price:
        return 1, ev, dict(info, failure="no_amount")
    if ph.decision_request and ctx.n(ph.decision_request) < ctx.n(ph.first_price):
        return 1, ev, dict(info, failure="decision_before_price")
    return 2, ev, info


# ---- K7 · Adhesion (PB-14..PB-16, PB-23, PB-24)
# PB-15: plain approvals and compliments are never adhesion
_COMPLIMENT = re.compile(r"^((that|it|this) )?((all )?(sounds?|looks?|is|seems?) )?(really |so |very )?"
                         r"(okay|ok|good|great|amazing|awesome|wow|cool|nice|perfect|interesting|i love (that|it))"
                         r"[\s.,!]*((wow|amazing|great|cool)[\s.,!]*)*$")


def plain_approval(text: str) -> bool:
    t = norm(text).strip()
    return approval_only(t) or bool(_COMPLIMENT.match(t))


def adhesion_passages(ctx: CallContext, passages: list[dict]) -> tuple[list[dict], list[dict]]:
    """Returns (adhesion passages, reserves). Approvals (PB-15, C3 rule 5), comprehension echoes (PB-23) and
    projections used to postpone (PB-24, routed to Objections) are not adhesion."""
    keep, reserves, seen = [], [], set()
    for p in passages:
        if p.get("kind") not in ADHESION_KINDS or plain_approval(p["quote"]):
            continue
        if p.get("postpone"):
            reserves.append(p)
            continue
        if p.get("comprehension_echo"):
            continue
        if p.get("kind") == "projection" and not p.get("concrete"):
            continue                                            # PB-14: projection needs a concrete element
        k = (p["turn"], norm(p["quote"]))
        if k in seen:
            continue
        seen.add(k)
        keep.append(p)
    return keep, reserves


def decide_k7(passages: list[dict]) -> tuple[int, list, dict]:
    info = {"n": len(passages), "projection": any(p.get("kind") == "projection" and p.get("concrete")
                                                  for p in passages)}
    if not passages:
        return 0, [], dict(info, failure="no_adhesion")
    ev = [Evidence(p["quote"], p["turn"], PROSPECT) for p in passages]
    if len({p["turn"] for p in passages}) >= 2:
        return 2, ev, info
    if info["projection"]:
        g = passages[0].get("gesture")                          # second quote for C3 rule 4: the gesture (PB-16)
        if g:
            ev.append(Evidence(g["quote"], g["turn"], SALES))
        return 2, ev, info
    return 1, ev, info


# ---- §5.1 claims lookup (PB-35)
def _numbers_of(obj: Any) -> set[str]:
    out: set[str] = set()
    if isinstance(obj, dict):
        for v in obj.values():
            out |= _numbers_of(v)
    elif isinstance(obj, (list, tuple)):
        for v in obj:
            out |= _numbers_of(v)
    elif isinstance(obj, (int, float)) and not isinstance(obj, bool):
        n = norm_number(str(obj))
        if n:
            out.add(n)
    elif isinstance(obj, str):
        out |= set(numbers_in(obj))
    return out


def claim_sources(ctx: CallContext) -> dict[str, set[str]]:
    ref = ctx.offer_reference or {}
    prospect = set()
    for t in ctx.turns:
        if t.role == PROSPECT and not t.attribution_doubtful:
            prospect |= set(numbers_in(t.text))
    for p in ctx.prior_inputs or []:                            # PB-20: inputs stored before the call
        prospect |= set(numbers_in(p.get("text", "")))
    offer = _numbers_of({k: ref.get(k) for k in ("price", "payment_options", "guarantees", "components")})
    price = _numbers_of({k: ref.get(k) for k in ("price", "payment_options")})
    library = _numbers_of([{"start": c.get("start"), "figures": c.get("figures")} for c in ctx.case_library or []])
    return {"prospect": prospect, "offer_reference": offer, "price": price, "case_library": library}


def _is_calc(x: float, known: list[float]) -> bool:
    for r in (2, 3):
        for combo in itertools.combinations(known, r):
            prod = 1.0
            for v in combo:
                prod *= v
            if abs(prod - x) < 1e-6 or abs(sum(combo) - x) < 1e-6:
                return True
    return False


def check_claim(ctx: CallContext, claim: dict, src: dict[str, set[str]]) -> str:
    """Returns the source label (prospect / offer_reference / case_library / calculation), "out_of_gap" or
    "unchecked" when the reference that could contain it is missing (§4, Part C C1 reduced checks)."""
    ref = ctx.offer_reference or {}
    kind = claim.get("kind")
    if kind == "case":
        if not ctx.case_library:
            return "unchecked"
        ids = {c.get("id") for c in ctx.case_library}
        return "case_library" if claim.get("library_id") in ids else "out_of_gap"
    if kind == "guarantee":
        gs = ref.get("guarantees")
        if not gs:
            return "unchecked"
        names = {norm(g if isinstance(g, str) else (g.get("name") or g.get("id") or "")) for g in gs}
        return "offer_reference" if norm(claim.get("guarantee_ref") or "") in names - {""} else "out_of_gap"
    nums = numbers_in(claim["quote"])
    if kind == "price":
        if not src["price"]:
            return "unchecked"
        return "offer_reference" if nums and all(n in src["price"] for n in nums) else "out_of_gap"
    # figure
    if not nums:
        return "unchecked"
    for label in ("prospect", "offer_reference", "case_library"):
        if all(n in src[label] for n in nums):
            return label
    allowed = src["prospect"] | src["offer_reference"] | src["case_library"]
    if all(n in allowed for n in nums):
        return "prospect+reference"
    if claim.get("calculation"):
        # "a calculation on those figures shown as such": at least one operand is his / the offer's figure and
        # every other unknown number is either an operand or the result of the operands in the same quote
        vals = [float(n) for n in nums]
        known = [float(n) for n in nums if n in allowed]
        results = [v for i, v in enumerate(vals) if nums[i] not in allowed and
                   _is_calc(v, vals[:i] + vals[i + 1:])]
        if known and results:
            return "calculation"
    if not ref and not ctx.case_library:
        return "unchecked"
    return "out_of_gap"


def gate(ctx: CallContext, gap: dict, claims: list[dict], promises: list[dict], step4: Optional[dict]
         ) -> tuple[list[str], list[dict], list[str]]:
    """§5.1 compliance gate, in its fixed order. Returns (reasons, checked claims, flags)."""
    reasons, flags = [], []
    if pitch_before_gap(ctx, gap, ctx.phases.pitch_start):                     # PB-37
        reasons.append("pitch_before_gap")
    src = claim_sources(ctx)
    checked = []
    for c in claims:
        s = check_claim(ctx, c, src)
        checked.append({"kind": c.get("kind"), "quote": c["quote"], "turn": c["turn"], "source": s})
        if s == "unchecked":
            flags.append(f"claim_unchecked:{c['turn']}")
    if ctx.case_library:                                                       # PB-31: case not in library
        ids = {x.get("id") for x in ctx.case_library}
        for c in (step4 or {}).get("cases") or []:
            if c.get("library_id") not in ids and not any(x["turn"] == c["turn"] and x["kind"] == "case"
                                                          for x in checked):
                checked.append({"kind": "case", "quote": c["quote"], "turn": c["turn"], "source": "out_of_gap"})
    if any(c["source"] == "out_of_gap" for c in checked):                      # PB-35
        reasons.append("out_of_gap_claim")
    if any(p.get("action") in PROMISE_ACTIONS for p in promises):              # PB-36
        reasons.append("outcome_promise")
    return reasons, checked, flags


# ============================================================================================ decision
def decide(ctx: CallContext, answers: dict[str, Any], cfg: Optional[dict] = None,
           statuses: Optional[dict[str, str]] = None) -> CompetenceResult:
    """Pure decision of the Pitch competence from validated answers. `answers` keys: category, step1, step2,
    step3, step4, roadmap (dicts or None), claims, promises, adhesion (lists)."""
    cfg = {**DEFAULT_CONFIG, **(cfg or {})}
    statuses = statuses or {}
    res = CompetenceResult(NAME, RULES_VERSION)
    ph = ctx.phases
    if not ph.pitch_start:                                                     # §4
        res.status = "not_applicable"
        res.reasons = ["offer_mention_only" if ph.offer_mentions else "no_pitch"]
        res.details = {"roadmap_span": None, "offer_mentions": list(ph.offer_mentions)}
        return res
    gap = _gap(ctx)
    vp = gap.get("validated_P")
    if not ctx.offer_reference:
        res.flags.append("offer_reference_missing")

    # P category (PB-27)
    cat_ans = answers.get("category") or {}
    category = cat_ans.get("category") if vp else None
    if category == UNKNOWN:
        res.flags += ["P_category_unknown", "uncovered_case"]
    elif category == NOT_BLOCKER:
        res.flags.append("P_not_a_pitch_blocker")
    ref_missing = category in NINE and mechanism_reference_missing(ctx.offer_reference, category)
    if ref_missing:
        res.flags.append("mechanism_reference_missing")
    if not ctx.case_library:
        res.flags.append("case_library_missing")

    # roadmap position first (bounds step 2 mechanisms)
    rm = (answers.get("roadmap") or {}).get("roadmap")
    rpos = _span_pos(ctx, rm)

    # K1
    k1, ev1, i1 = decide_k1(ctx, vp, answers.get("step1"))
    s1 = (answers.get("step1") or {}).get("step")
    s1pos = _span_pos(ctx, s1)
    # K2
    s2 = (answers.get("step2") or {}).get("step")
    end_pos = rpos or (_pos(ctx, ph.first_price) if ph.first_price else None) or \
        (_pos(ctx, ph.decision_request) if ph.decision_request else None)
    mechs = mechanisms_in_scope(ctx, answers.get("step2"), s1pos or _pos(ctx, ph.pitch_start), end_pos)
    k2, ev2, i2 = decide_k2(ctx, category, mechs, (answers.get("step2") or {}).get("recitation"), k1,
                            ref_missing, cfg)
    i2.update(span=[s2["start_turn"], s2["end_turn"]] if s2 else None, sentences=n_sentences(ctx, s2))
    # K3
    k3, ev3, i3 = decide_k3(ctx, gap, answers.get("step3"))
    s3 = (answers.get("step3") or {}).get("step")
    # K4
    k4, ev4, i4 = decide_k4(ctx, gap, answers.get("step4"), cfg)
    best = next((c for c in i4.get("cases", []) if c["library_id"] == i4.get("case_id")), None)
    s4 = (best or {}).get("step") or next((c.get("step") for c in (answers.get("step4") or {}).get("cases") or []
                                           if c.get("step")), None)
    i4.update(span=[s4["start_turn"], s4["end_turn"]] if s4 else None, sentences=n_sentences(ctx, s4))
    if i4.get("proof_gap"):
        res.flags.append("proof_gap")
    # K5
    spans = {1: s1, 2: s2, 3: s3, 4: s4}
    step_pos = {k: _span_pos(ctx, v) for k, v in spans.items()}
    step_sent = {k: n_sentences(ctx, v) for k, v in spans.items() if v}
    step_ev = {k: Evidence(v["start_quote"], v["start_turn"], SALES) for k, v in spans.items() if v}
    na = {k for k, lv in ((2, k2), (4, k4)) if lv is None}
    k5, ev5, i5 = decide_k5(ctx, step_pos, step_sent, na, step_ev, cfg)
    # K6
    last = max([p for p in step_pos.values() if p], default=None)
    k6, ev6, i6 = decide_k6(ctx, gap, answers.get("roadmap"), last)
    # K7
    adh, reserves = adhesion_passages(ctx, answers.get("adhesion") or [])
    k7, ev7, i7 = decide_k7(adh)

    notes = {k: (i.get("failure") or "") for k, i in
             (("K1", i1), ("K2", i2), ("K3", i3), ("K4", i4), ("K5", i5), ("K6", i6), ("K7", i7))}
    levels = {"K1": (k1, ev1), "K2": (k2, ev2), "K3": (k3, ev3), "K4": (k4, ev4), "K5": (k5, ev5),
              "K6": (k6, ev6), "K7": (k7, ev7)}
    res.items = [item(k, WEIGHTS[k], lv, ev, notes[k]) for k, (lv, ev) in levels.items()]

    # §5.1 gate
    reasons, checked, gflags = gate(ctx, gap, answers.get("claims") or [], answers.get("promises") or [],
                                    answers.get("step4"))
    res.flags += gflags
    raw = call_score(res.items)
    if reasons:
        res.verdict = "non_compliant"
        res.reasons = reasons
        res.score = 0 if cfg["severity"] == "zero" else (min(raw, 40) if raw is not None else None)
    else:
        res.verdict = "compliant"
        res.score = raw

    to_review = sorted(k for k, s in statuses.items() if s == "to_review")
    if to_review:
        res.status = "to_review"
        res.reasons = res.reasons + [f"to_review:{k}" for k in to_review]
        res.score = None
    concs = [s for s in statuses.values()]
    res.concordance = "arbitrated" if "arbitrated" in concs else ("3/3" if concs else None)

    # diagnostics (§7, never scored)
    s_, e_ = ph.pitch_start, ph.pitch_end
    win = ctx.window(s_, e_)
    w_s = sum(len(t.text.split()) for t in win if t.role == SALES)
    w_t = sum(len(t.text.split()) for t in win) or 1
    share = round(w_s / w_t, 3)
    diagnostics = {
        "non_compliance": reasons,
        "P_category": category,
        "mechanism_error": i2.get("failure") if i2.get("failure") in ("second_mechanism", "wrong_mechanism",
                                                                      "recitation") else None,
        "step_failures": {f"step{k}": i.get("failure") for k, i in ((1, i1), (2, i2), (3, i3), (4, i4))
                          if i.get("failure")},
        "proof_gap": bool(i4.get("proof_gap")),
        "roadmap": {"n_steps": len(i6.get("steps") or []), "before_price": i6.get("before_price")},
        "talk_share": share, "monologue": share > cfg["monologue_share"],
        "gestures_before_adhesion": [p.get("gesture") for p in adh if p.get("gesture")],
        "reserves": [{"quote": p["quote"], "turn": p["turn"]} for p in reserves],
    }
    res.details = {
        "verdict": res.verdict,
        "non_compliance": reasons,
        "phases": {"pitch_start": ph.pitch_start, "roadmap": i6.get("span"), "first_price": ph.first_price,
                   "decision_request": ph.decision_request, "early_price": ph.early_price},
        "roadmap_span": i6.get("span"),                       # read by Objections
        "validated_P": dict(vp, category=category) if vp else None,
        "steps": {"1": i1, "2": i2, "3": i3, "4": i4},
        "order_ok": i5.get("order_ok"),
        "roadmap": {"steps": i6.get("steps"), "before_price": i6.get("before_price")},
        "claims": checked,
        "outcome_promises": [{"quote": p["quote"], "turn": p["turn"], "action": p["action"]}
                             for p in answers.get("promises") or []],
        "adhesion": [{"turn": p["turn"], "quote": p["quote"], "kind": p["kind"],
                      "sales_gesture": (p.get("gesture") or {}).get("quote"),
                      "projection": bool(p.get("kind") == "projection" and p.get("concrete"))} for p in adh],
        "raw_score": raw,
        "diagnostics": diagnostics,
    }
    return res


# ============================================================================================ competence
class PitchCompetence:
    name = NAME
    rules_version = RULES_VERSION

    def __init__(self, config: Optional[dict] = None):
        self.cfg = {**DEFAULT_CONFIG, **(config or {})}

    def run(self, ctx: CallContext, runner: Runner) -> CompetenceResult:
        ph = ctx.phases
        if not ph.pitch_start:
            return decide(ctx, {}, self.cfg)
        g = ctx.results.get("GAP")
        if g is None or not g.details:
            return CompetenceResult(NAME, RULES_VERSION, status="to_review", reasons=["gap_result_missing"],
                                    details={"roadmap_span": None})
        if g.status == "to_review":
            return CompetenceResult(NAME, RULES_VERSION, status="to_review", reasons=["gap_to_review"],
                                    details={"roadmap_span": None})
        answers: dict[str, Any] = {}
        statuses: dict[str, str] = {}

        def one(key, task, unit_id, unit):
            r = runner.run(ctx, task, unit_id, unit)
            statuses[key] = r.status
            answers[key] = r.answer
            return r

        vp = g.details.get("validated_P")
        if vp and vp.get("turn"):
            r = one("category", CATEGORY, f"pcat:{vp['turn']}", vp)
            # Pitch §2.1: a P outside the nine goes to the arbiter as uncovered_case, even when 3/3 agree
            if r.status == "verified" and (r.answer or {}).get("category") == UNKNOWN:
                from ..core.runner import force_arbitration
                r2 = force_arbitration(runner, ctx, CATEGORY, f"pcat:{vp['turn']}", vp, r)
                if r2.answer:
                    answers["category"], statuses["category"] = r2.answer, r2.status
        cat = (answers.get("category") or {}).get("category")
        s = ph.pitch_start
        one("step1", STEP1, f"step1:{s}", None)
        one("step2", STEP2, f"step2:{s}", cat)
        one("step3", STEP3, f"step3:{s}", None)
        one("step4", STEP4, f"step4:{s}", None)
        one("roadmap", ROADMAP, f"roadmap:{s}", None)
        for key, task, field in (("claims", CLAIMS, "claims"), ("promises", PROMISES, "promises"),
                                 ("adhesion", ADHESION, "passages")):
            items: list = []
            for a, b in chunks(ctx, self.cfg["chunk_turns"]):
                uid = f"{key}:{a}-{b}"
                r = runner.run(ctx, task, uid, (a, b))
                statuses[uid] = r.status
                items += (r.answer or {}).get(field) or []
            answers[key] = items
        return decide(ctx, answers, self.cfg, statuses)
