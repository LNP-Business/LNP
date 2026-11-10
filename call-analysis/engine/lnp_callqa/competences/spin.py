"""Competence 1 · SPIN discovery (methodology SPIN v1.3, Annex A SB-1..SB-35, Part C engine).

Two layers that are never mixed (spin.md §1):
- letter layer: each sales solicitation gets S / P / I / N / OUT from five ordered gates. Diagnostics only:
  **the letter never produces points** (guard of the LNP SPIN reference, Annex A X8);
- effect layer: atoms stated by the prospect in the answers (SITUATION, PAIN, BLOCKER, IMPACT, DESIRE, VALUE).
  The score (items D1..D5) is computed from atoms and chains only.

Pipeline of this module (Part C, C2):
  S1 inventory (code)            inventory()             SEG-1..SEG-8, port of the SPIN reference segment.py
  S3 gates (model)               GATES task              five gates OUT/S/N/I/P, routing, with exact quotes
  S5 letter decision (code)      decide_letter()         port of decide() (decide_all.py), first "yes" wins
  perimeter (code)               place_perimeter()       SB-1, SB-2, SB-25, SB-34: SPIN stops at the pitch (SB-3 / SB-4 off)
  answer spans (code)            answer_spans()          SB-5..SB-8
  atoms (model, then code)       ATOMS task + decide_atom()   SB-9..SB-15, SB-22..SB-24
  follow-up (code)               follows_up()            SB-17, SB-19
  chains (model link + code)     LINK task + find_chains()    SB-16, SB-18, SB-20
  items (code)                   score_items()           §6 D1..D5, two-quote rule (C3 rule 4)
  diagnostics (code)             diagnostics()           §8, displayed, never scored
  registers (model, then code)   REGISTER task + decide_register()   SB-26..SB-33, displayed, never scored
"""
from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass, field
from typing import Any, Callable, Optional

from ..core.models import (PROSPECT, SALES, Atom, CallContext, CompetenceResult, Evidence, ItemScore,
                           Solicitation, Turn)
from ..core.runner import ModelTask, Runner
from ..core.scoring import call_score, item
from ..core.text import approval_only, norm, norm_number, quote_ok

# =============================================================================================== constants
# Every value below that the methodology marks "to validate" stays a configurable constant.
WEIGHTS = {"D1": 15, "D2": 20, "D3": 30, "D4": 20, "D5": 15}     # §6, weights to validate (§11)
MIN_CODED = 5                     # §5: minimum coded solicitations for `scored` (to validate, §11)
ABSENT_MAX_SHARE = 0.05           # §5 health: > 5 % OUT `absent` -> excluded (C7 health threshold)
COUNT_VOLUNTEERED = True          # §11 proposal: volunteered atoms count for D1..D4 (never for D5, SB-8)
BACKCHANNEL_MAX_WORDS = 5         # SB-5: sales backchannel of 5 words or fewer does not end an answer span
SHORT_ANSWER_WORDS = 6            # SB-7
CONTENT_WORD_MIN = 4              # SB-17: content words of 4 letters or more
PITCH_CHECKIN_MIN_DIAGNOSTICS = 2 # SB-4: a reopening inside the pitch needs >= 2 diagnostic questions
REOPEN_WINDOW_TURNS = 24          # context given to the model to place a reopening end (SB-3)
REOPENINGS = False                # SB-34 (Romain 2026-10-27): SPIN stops at the pitch; the SB-3 / SB-4 reopenings are off
DIAG_TARGETS = {"p_followed_by_i": 0.50, "prompted_share": 0.15, "closed_need_payoff": 0}   # §8, to validate
CALL_BUDGET = {"S": ("ceiling", 2), "P": ("ceiling", 2), "I": ("floor", 3), "N": ("floor", 3)}  # §8

LETTERS = ("S", "P", "I", "N")
OUT = "OUT"
# OUT reasons in priority order (§3). `absent` = no gate said yes (system defect, never against the sales).
OUT_PRIORITY = ["nothing", "offer_info", "solution_load", "sales_list", "agreement"]
ROUTING = ("VALIDATION_REQUEST", "DECISION_REQUEST")       # gate 0
ATOM_TYPES = ("SITUATION", "PAIN", "BLOCKER", "IMPACT", "DESIRE", "VALUE")
DOMAINS = ("money", "time", "clients", "family", "health", "self_belief", "future", "other")   # §2, §4
DIMENSIONS = ("revenue", "clients", "time", "career_status", "other")    # §6 "related to the goal"
EXPECTED_ATOMS = {"S": {"SITUATION"}, "P": {"PAIN", "BLOCKER"}, "I": {"IMPACT"}, "N": {"DESIRE", "VALUE"}}

# Registers (SB-26..SB-33, Romain 2026-10-27): the code maps the domain a question asks about to one register.
REGISTERS = ("financial", "time_load", "identity_status", "mental_emotional", "other")
REGISTER_LABELS = {"financial": "Financial", "time_load": "Time & load", "identity_status": "Identity & status",
                   "mental_emotional": "Mental & emotional", "other": "Other"}
REGISTER_OF_DOMAIN = {"money": "financial", "clients": "financial", "time": "time_load", "family": "time_load",
                      "future": "identity_status", "self_belief": "mental_emotional", "health": "mental_emotional",
                      "other": "other", "none": "other"}
REGISTER_BASES = ("named", "answer", "reference", "none")   # SB-28 / SB-35 / SB-29 / SB-31
REGISTER_ANSWER_TURNS = 3          # SB-35: an open question is read in (at most) the first three turns of its answer
REGISTER_REFERENCE_TURNS = 2       # SB-29: a reference is read in the last two prospect turns before the question
REGISTER_MIN_AGREEMENT = 0.92      # SB-33: per-call share of registers decided 3/3 (Romain's 92 % target)
# SB-30 domain words, the code's cross-check of a "named" answer (SB-32 rule 3); matched on word starts
REGISTER_LEXICON = {
    "financial": ("money", "income", "revenue", "earn", "salary", "cash", "price", "afford", "debt", "bills", "rent",
                  "financ", "profit", "dollar", "paid", "paying", "client", "customer", "project", "leads", "booking",
                  "pipeline", "sales"),
    "time_load": ("time", "hour", "week", "weekend", "schedule", "workload", "busy", "family", "kid", "child", "wife",
                  "husband", "partner", "son", "daughter", "parent"),
    "identity_status": ("future", "years from now", "long term", "long-term", "where do you see yourself",
                        "where do you want to be", "become", "dream", "vision", "career", "legacy", "status"),
    "mental_emotional": ("confiden", "believe in yourself", "self-belief", "motivat", "mindset", "fear", "doubt",
                         "feel", "emotion", "frustrat", "proud", "health", "stress", "anxi", "burnout", "burn out",
                         "burned out", "exhaust", "tired", "sleep", "energy"),
}


# =============================================================================================== S1 inventory
# Lexicons ported from the SPIN reference inventory script (segment.py).
def _fold(s: str) -> str:
    s = unicodedata.normalize("NFD", (s or "").lower().replace("’", "'"))
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.sub(r"[^\w\s']", " ", s)


ACK = set("yes yeah yep yup ok okay right sure fine exactly totally absolutely definitely correct true indeed "
          "mm-hmm mhm uh-huh cool great perfect awesome nice wow oh gotcha amazing beautiful lovely love".split())
INTERRO = re.compile(r"^(how|what|what's|whats|when|where|why|who|which|whose|do|does|did|are|is|was|were|have|has|"
                     r"had|can|could|would|will|should|shall|may|might|am|isn't|aren't|don't|doesn't|didn't|won't|"
                     r"wouldn't|couldn't)\b")
IMPERATIVE = re.compile(r"^(tell me|walk me through|talk me through|describe|explain|help me understand|share with me|"
                        r"give me a sense|paint me a picture)")
TAILS = [r"\bright\?$", r"\bisn't it\?$", r"\bdon't you\?$", r"\bcorrect\?$", r"\byeah\?$", r"\bno\?$",
         r"\bis that it\?$", r"\bis that right\?$", r"\bam i right\?$", r"\bdoes that make sense\?$", r"\bfair\?$",
         r"\byou know\?$", r"\bok\?$", r"\bokay\?$"]
TAIL_ONLY = re.compile(r"^(right|correct|yeah|no|okay|ok|fair|you know|does that make sense|is that right|am i right|"
                       r"isn't it)\s*\?$", re.I)
STOP = set(_fold("""the a an and or but so to of in on at for with that this it its is are was were be been i you he
she we they me my your our their them there here what how when where why who which do does did have has had not no
yes just like really very about from as if then than also can could would will should get got go going know think
mean thing things kind sort lot little bit yeah okay right well one two some any more most much many even still now
today make made want really actually maybe something anything everything people time""").split())
OFFER_WORDS = re.compile(r"\b(program|programme|academy|our (method|course|coaching|mentorship|offer)|the course|"
                         r"enroll|tuition|investment|price|cost|payment plan)\b")
SYSTEM_LINE = re.compile(r"SCREEN SHARING|https?://|WATCH:")


def split_sentences(text: str) -> list[str]:
    t = re.sub(r"\s+", " ", text or "").strip()
    return [p.strip() for p in re.split(r"(?<=[.?!])\s+(?=[A-Z0-9\"'])", t) if p.strip()]


def question_form(s: str) -> Optional[str]:
    """§2 Solicitation: final question mark, interrogative form without mark, or imperative of request."""
    ns = s.strip().lower()
    if ns.endswith("?"):
        return "interrogative"
    if IMPERATIVE.match(_fold(ns).strip()):
        return "imperative"
    if INTERRO.match(ns):
        return "interrogative_no_mark"
    return None


def content_words(s: str) -> set[str]:
    """SB-17: content words (4 letters or more, outside the stop list) and numbers."""
    out = {w for w in _fold(s).split() if len(w) >= CONTENT_WORD_MIN and w not in STOP}
    for tok in re.findall(r"\$?\d[\d,.]*k?", (s or "").lower()):
        n = norm_number(tok)
        if n is not None:
            out.add("#" + n)
    return out


@dataclass
class Unit:
    """Internal unit of analysis: one solicitation with its deterministic attributes."""
    sol: Solicitation
    turn: Turn
    rank: int
    total_in_turn: int
    preamble: str = ""
    prev_prospect: list[Turn] = field(default_factory=list)
    attrs: dict[str, Any] = field(default_factory=dict)
    gates: Optional[dict] = None             # resolved gate answer
    decision: Optional["LetterDecision"] = None
    window_end: Optional[str] = None         # end of the perimeter window the unit belongs to (exclusive)
    in_perimeter: bool = False
    reopening: Optional[int] = None
    volunteered_turns: list[str] = field(default_factory=list)
    answer_text: str = ""
    follows_prev: bool = False               # this question reuses the previous answer (SB-17 / SB-19)
    unanswered: bool = False                 # SB-6
    parts: list = field(default_factory=list)  # [(text, LetterDecision)] after a SEG-2 split


def inventory(ctx: CallContext) -> list[Unit]:
    """S1: every sales sentence that is a solicitation becomes a unit (SEG-1); nothing is deleted, filters are
    attributes. SEG-4: an isolated validation tail closes the previous sentence. SEG-8: sales turns only."""
    units: list[Unit] = []
    turns = [t for t in ctx.turns if not t.attribution_doubtful]
    for idx, t in enumerate(turns):
        if t.role != SALES:
            continue
        merged: list[str] = []
        for s in split_sentences(t.text):
            if TAIL_ONLY.match(s) and merged:                           # SEG-4
                merged[-1] = merged[-1].rstrip(".!") + ", " + s
            else:
                merged.append(s)
        qs = [(k, s) for k, s in enumerate(merged) if question_form(s)]
        prev_p = [x for x in turns[:idx] if x.role == PROSPECT][-2:]
        pros_words = set().union(*[content_words(x.text) for x in prev_p]) if prev_p else set()
        for r, (k, s) in enumerate(qs, 1):
            ws = [w for w in _fold(s).split() if w]
            low = s.strip().lower()
            attrs = {
                "form": question_form(s),
                "validation_tail": any(re.search(p, low) for p in TAILS),                     # SEG-4
                "backchannel": len(ws) <= 3 and all(w.strip("'") in ACK or w in ("oh", "really", "so", "and",
                                                                                  "hmm", "huh") for w in ws),  # SEG-7
                "alternative": bool(re.search(r"\bor\b", low)) and low.endswith("?"),         # SEG-3
                "open_branch": bool(re.search(r"\bor (something else|anything else|other|not)\b", low)),
                "why": bool(re.search(r"\bwhy\b", low)),
                "offer_mention": bool(OFFER_WORDS.search(low)),
                "anchor_words": sorted(content_words(s) & pros_words),                        # SEG-5 anchoring
                "n_words": len(ws),
                "stacked": len(qs) > 1,                                                       # SEG-1 / SB-6
                "system": bool(SYSTEM_LINE.search(s)),
                "no_final_mark": not s.strip().endswith("?"),
            }
            sid = f"Q{t.id[1:]}.{r}"
            tags = [k2 for k2 in ("validation_tail", "backchannel", "stacked", "system") if attrs[k2]]
            units.append(Unit(Solicitation(sid, t.id, s, tags=tags), t, r, len(qs),
                              preamble=" ".join(merged[:k])[-500:], prev_prospect=prev_p, attrs=attrs))
    return units


# =============================================================================================== S5 letter decision
@dataclass
class LetterDecision:
    letter: str                 # S / P / I / N / OUT, or NOT_SOLICITATION / ATTRIBUTION_DOUBTFUL / routing value
    gate: int                   # 0 routing, 1 OUT, 2 S, 3 N, 4 I, 5 P
    reason: Optional[str]       # OUT reason
    tags: list[str]
    invalid_proof: bool = False


def _proof_ok(quote: Optional[str], text: str) -> bool:
    return bool(quote) and norm(quote).strip(' .,?!"') in norm(text)


def decide_letter(g: dict, attrs: dict, text: str) -> LetterDecision:
    """Port of decide() (decide_all.py, SPIN reference P5-P7) with English field names.

    Order: SEG filters, gate 0 (routing), gate 1 OUT with the §3 hard rules evaluated before any positive test,
    then S (gate 2), N (gate 3), I (gate 4), P (gate 5); the first "yes" wins; none -> OUT `absent`.
    A positive gate whose quote is not in the solicitation fails (C3 rule 1) and marks the decision invalid.
    """
    tags = list(g.get("tags") or [])
    if attrs.get("system") or g.get("is_solicitation") is False:
        return LetterDecision("NOT_SOLICITATION", 0, None, tags)
    if g.get("attribution_doubtful"):
        return LetterDecision("ATTRIBUTION_DOUBTFUL", 0, None, tags)
    if g.get("routing") in ROUTING:                                             # gate 0
        return LetterDecision(g["routing"], 0, None, tags)
    g1, g2, g3, g4, g5 = (g.get(k) or {} for k in ("g1", "g2", "g3", "g4", "g5"))
    reasons: list[str] = []
    if g1.get("reason") in OUT_PRIORITY:                                        # gate 1 (model)
        reasons.append(g1["reason"])
    if attrs.get("validation_tail"):                                           # hard rule: tail -> agreement
        reasons.append("agreement")
    if g3.get("state_or_value"):
        if g3.get("about_offer"):                                              # hard rule: value about the offer
            reasons.append("offer_info")
        if g3.get("load_named") and g3.get("antecedent") == "solution":         # hard rule: load of a solution
            reasons.append("solution_load")
        if g3.get("content_supplied") and not g3.get("load_named") and not g3.get("about_offer"):
            reasons.append("agreement")                                        # hard rule: closed need-payoff
            tags.append("closed_need_payoff")
    if g4.get("consequence") and g4.get("antecedent_solution") and g3.get("load_named"):
        reasons.append("solution_load")
    if reasons:
        return LetterDecision(OUT, 1, min(reasons, key=OUT_PRIORITY.index), sorted(set(tags)))
    invalid = False

    def gate(cond: Any, part: dict) -> bool:
        nonlocal invalid
        if not cond:
            return False
        if not _proof_ok(part.get("quote"), text):
            invalid = True
            return False
        return True

    if gate(g2.get("neutral_fact") and not g2.get("exclusion"), g2):
        return LetterDecision("S", 2, None, tags, invalid)
    if gate(g3.get("state_or_value") and g3.get("antecedent") != "problem", g3):
        return LetterDecision("N", 3, None, tags, invalid)
    if gate(g4.get("consequence") and not g4.get("same_domain") and not g4.get("antecedent_solution"), g4):
        return LetterDecision("I", 4, None, tags, invalid)
    if gate(g5.get("difficulty") and (not g5.get("sales_named") or g5.get("anchored")), g5):
        return LetterDecision("P", 5, None, tags, invalid)
    return LetterDecision(OUT, 1, "absent", tags, invalid)


def decide_gates(g: dict, attrs: dict, text: str) -> list[tuple[str, LetterDecision]]:
    """Applies the model's SEG-2 split if any: returns [(text, decision)] for one or several units."""
    split, sub = g.get("split"), g.get("sub")
    if isinstance(split, list) and isinstance(sub, list) and len(split) >= 2 and len(sub) == len(split):
        # the validation tail belongs to the clause it closes (SEG-4): only the last part keeps it
        out = []
        for j, (txt, sg) in enumerate(zip(split, sub)):
            a = dict(attrs, validation_tail=attrs.get("validation_tail") and j == len(split) - 1)
            out.append((txt, decide_letter(sg, a, txt)))
        return out
    return [(text, decide_letter(g, attrs, text))]


def is_coded_letter(letter: Optional[str]) -> bool:
    return letter in LETTERS or letter == OUT


# =============================================================================================== S3 gate task
def _ctx_lines(turns: list[Turn], limit: int = 600) -> str:
    return "\n".join(f"[{t.id} {t.ts}] {t.role}: {t.text[-limit:]}" for t in turns)


def _gates_build(ctx: CallContext, u: Unit) -> str:
    pos = "after the end of the discovery (offer / pitch / close phase)" if u.attrs.get("post_end") else \
        "before the first pitch or price"
    return (f"UNIT: {u.sol.id}  (turn {u.turn.id}, solicitation {u.rank} of {u.total_in_turn} in the turn; {pos})\n"
            f"PREVIOUS PROSPECT TURNS:\n{_ctx_lines(u.prev_prospect) or '(none)'}\n"
            f"SALES PREAMBLE IN THE SAME TURN: {u.preamble or '(none)'}\n"
            f"SOLICITATION: {u.sol.text}\n"
            f"CODE ATTRIBUTES: validation_tail={u.attrs['validation_tail']} alternative={u.attrs['alternative']} "
            f"open_branch={u.attrs['open_branch']} offer_mention={u.attrs['offer_mention']} "
            f"anchor_words={u.attrs['anchor_words']}\n"
            "Answer every gate (even after an earlier yes). Quotes are exact substrings of SOLICITATION.")


GATE_REASONS = set(OUT_PRIORITY) | {None}


def _validate_gate_obj(g: dict, text: str, depth: int = 0) -> list[str]:
    errs = []
    if not isinstance(g, dict):
        return ["not_an_object"]
    if g.get("routing") not in (None, *ROUTING):
        errs.append("bad_routing")
    g1 = g.get("g1") or {}
    if g1.get("reason") not in GATE_REASONS:
        errs.append("bad_out_reason")
    positives = [("g1", g1.get("reason")), ("g2", (g.get("g2") or {}).get("neutral_fact")),
                 ("g3", (g.get("g3") or {}).get("state_or_value")), ("g4", (g.get("g4") or {}).get("consequence")),
                 ("g5", (g.get("g5") or {}).get("difficulty"))]
    for k, pos in positives:
        if pos:
            q = (g.get(k) or {}).get("quote")
            if not _proof_ok(q, text):
                errs.append(f"bad_quote:{k}")
            elif len(norm(q).split()) > 40:
                errs.append(f"quote_too_long:{k}")
    if (g.get("g3") or {}).get("antecedent") not in (None, "resolution", "problem", "solution", "none"):
        errs.append("bad_antecedent")
    split = g.get("split")
    if split and depth == 0:
        sub = g.get("sub") or []
        if not isinstance(split, list) or not isinstance(sub, list):
            return errs + ["bad_split"]
        if len(split) < 2 or len(sub) != len(split):
            errs.append("bad_split")
        for j, part in enumerate(split):
            if not _proof_ok(part, text):
                errs.append(f"split_not_verbatim:{j}")
            elif j < len(sub):
                errs += [f"sub{j}:{e}" for e in _validate_gate_obj(sub[j], part, 1)]
    return errs


def gate_task(u: Unit) -> ModelTask:
    """One closed task per solicitation. The key compared across passes is the code decision itself."""
    def key(a: dict) -> Any:
        return [(d.letter, d.reason, "closed_need_payoff" in d.tags) for _, d in decide_gates(a, u.attrs, u.sol.text)] \
            + [bool(a.get("objection_clarification"))]
    return ModelTask("spin.gates", "fast", "spin_gates", _gates_build,
                     lambda a, c, uid: _validate_gate_obj(a, u.sol.text), key)


# =============================================================================================== perimeter
def _reopen_build(ctx: CallContext, u: Unit) -> str:
    i = ctx.n(u.turn.id)
    window = ctx.turns[i: i + REOPEN_WINDOW_TURNS]
    return (f"REOPENING START: {u.sol.id} (turn {u.turn.id}): {u.sol.text}\n"
            "Give the first SALES turn after the start where the sales returns to the offer (next offer segment), "
            "states a price, asks for a decision or changes topic. JSON: {\"end_turn\": \"T177\"|null, "
            "\"quote\": \"exact words of that turn\"}\n\nTRANSCRIPT\n" + ctx.render(window))


def reopen_task(u: Unit) -> ModelTask:
    def validate(a: dict, ctx: CallContext, uid: str) -> list[str]:
        et = a.get("end_turn")
        if et is None:
            return []
        try:
            if ctx.n(et) <= ctx.n(u.turn.id):
                return ["end_before_start"]
        except KeyError:
            return ["unknown_turn"]
        e = quote_ok(ctx, Evidence(a.get("quote", ""), et, SALES), min_words=2, max_words=40)
        return [e] if e else []
    return ModelTask("spin.reopen_end", "fast", "spin_reopen", _reopen_build, validate,
                     key=lambda a: a.get("end_turn"))


def discovery_end(ctx: CallContext) -> Optional[str]:
    """SB-1: first pitch start or first price, whichever comes first (Pitch annex PB-1, PB-3)."""
    c = [x for x in (ctx.phases.pitch_start, ctx.phases.first_price) if x]
    return min(c, key=ctx.n) if c else None


def is_valid_start(d: LetterDecision) -> bool:
    """SB-1 / SB-2: the start bears on the prospect's situation, goals or problems; social, logistic and framing
    questions (gate 1 `nothing`), offer questions and loads are never the start."""
    return d.letter in LETTERS or (d.letter == OUT and d.reason in ("agreement", "sales_list"))


def is_diagnostic(u: Unit) -> bool:
    """SB-3: a new diagnostic question on situation / problems / goals. Not: offer, logistics (gate 1 `nothing`),
    financing (SB-25 -> OUT solution_load), resistance clarification (Objections competence)."""
    return bool(u.decision and u.decision.letter in LETTERS and not (u.gates or {}).get("objection_clarification"))


def reopening_terminator(u: Unit) -> bool:
    """SB-3 code-side ends of a reopening: decision request, validation request, offer info, load of a solution,
    resistance clarification."""
    d = u.decision
    if d is None:
        return False
    return d.letter in ROUTING or (d.letter == OUT and d.reason in ("offer_info", "solution_load")) or \
        bool((u.gates or {}).get("objection_clarification"))


# =============================================================================================== answer spans
def answer_spans(ctx: CallContext, units: list[Unit], solicitation_turns: set[str]) -> None:
    """SB-5..SB-8. `units` are the coded units in transcript order (each with `window_end`).

    SB-5: the answer is the prospect speech after the solicitation up to the next sales solicitation; a sales
          backchannel of <= 5 words does not end it.
    SB-6: stacked solicitations: the answer goes to the last one, unless the prospect reuses a key word of an
          earlier one and none of the last; the others are `unanswered`.
    SB-7: subsumed: consecutive prospect turns with no sales speech in between are all in the span.
    SB-8: prospect speech after a longer sales acknowledgement and before the next solicitation is attached to the
          last solicitation with the flag `volunteered`.
    """
    sol_turns = {u.turn.id for u in units} | solicitation_turns     # any sales turn carrying a solicitation
    by_turn: dict[str, list[Unit]] = {}
    for u in units:
        by_turn.setdefault(u.turn.id, []).append(u)
    turns = [t for t in ctx.turns if not t.attribution_doubtful]
    pos = {t.id: i for i, t in enumerate(turns)}
    for tid, group in by_turn.items():
        group.sort(key=lambda x: x.rank)
        end = group[-1].window_end
        answer, volunteered, ack = [], [], False
        for t in turns[pos[tid] + 1:]:
            if end and ctx.n(t.id) >= ctx.n(end):
                break
            if t.role == SALES:
                if t.id in sol_turns:
                    break
                if len(t.text.split()) > BACKCHANNEL_MAX_WORDS:
                    ack = True                                                  # SB-8
                continue
            if t.role == PROSPECT:
                (volunteered if ack else answer).append(t.id)
        target = group[-1]
        if len(group) > 1 and answer:                                           # SB-6 exception
            first = content_words(ctx.turn(answer[0]).text)
            if not (content_words(target.sol.text) & first):
                earlier = [g for g in group[:-1] if content_words(g.sol.text) & first]
                if earlier:
                    target = earlier[-1]
        for g in group:
            g.unanswered = g is not target
            if g.unanswered and "unanswered" not in g.sol.tags:
                g.sol.tags.append("unanswered")
        target.sol.answer_turns = answer
        target.volunteered_turns = volunteered
        target.answer_text = " ".join(ctx.turn(x).text for x in answer + volunteered)


# =============================================================================================== atoms
def _atoms_build(ctx: CallContext, u: Unit) -> str:
    ans = [ctx.turn(x) for x in u.sol.answer_turns]
    vol = [ctx.turn(x) for x in u.volunteered_turns]
    return (f"UNIT: {u.sol.id} (letter of the question: {u.sol.letter}; the letter never changes with the answer)\n"
            f"PREVIOUS PROSPECT TURNS (context only, never quoted):\n{_ctx_lines(u.prev_prospect)}\n"
            f"SALES TURN {u.turn.id}: {u.turn.text}\nQUESTION: {u.sol.text}\n"
            f"ANSWER TURNS:\n{_ctx_lines(ans, 4000) or '(none)'}\n"
            f"VOLUNTEERED TURNS (after a sales acknowledgement):\n{_ctx_lines(vol, 4000) or '(none)'}\n"
            "List the atoms of the answer and volunteered turns. Quotes from those PROSPECT turns only.")


def _validate_atoms(a: dict, ctx: CallContext, u: Unit) -> list[str]:
    errs = []
    allowed = set(u.sol.answer_turns) | set(u.volunteered_turns)
    for k, x in enumerate(a.get("atoms") or []):
        if x.get("type") not in ATOM_TYPES:
            errs.append(f"bad_type:{k}")
            continue
        if x.get("turn") not in allowed:
            errs.append(f"turn_outside_answer:{k}")
            continue
        e = quote_ok(ctx, Evidence(x.get("quote", ""), x["turn"], PROSPECT), min_words=2, max_words=40)
        if e:
            errs.append(f"{e}:{k}")
        if x["type"] == "IMPACT" and (x.get("domain") not in DOMAINS or x.get("problem_domain") not in DOMAINS):
            errs.append(f"bad_domain:{k}")
        if x.get("cause_quote"):
            e = quote_ok(ctx, Evidence(x["cause_quote"], x.get("cause_turn") or x["turn"], PROSPECT), min_words=2,
                         max_words=40)
            if e or (x.get("cause_turn") or x["turn"]) not in allowed:
                errs.append(f"bad_cause_quote:{k}")
    return errs


def atoms_task(u: Unit) -> ModelTask:
    return ModelTask("spin.atoms", "strong", "spin_atoms", _atoms_build, lambda a, c, uid: _validate_atoms(a, c, u),
                     key=lambda a: sorted((x.get("type"), x.get("turn"),
                                           x.get("domain") if x.get("type") == "IMPACT" else None)
                                          for x in a.get("atoms") or []))


NUM_WORDS = r"(two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|forty|fifty|" \
            r"sixty|hundred|thousand|million|dozen)"


def has_quantity(quote: str) -> bool:
    """SB-24 (replaces SB-15): an amount, a count or a duration. A frequency alone ("every month") or a vague
    quantity ("a lot", "forever", X6) is not enough."""
    q = (quote or "").lower()
    return bool(re.search(r"\d", q) or re.search(rf"\b{NUM_WORDS}\b", q) or
                re.search(r"\b(a|one) (year|month|week|day|hour|client|half)s?\b", q))


def parse_quantity(quote: str) -> tuple[Optional[float], Optional[str]]:
    m = re.search(r"(\$?\d[\d,.]*\s?(k|grand)?)\s*(a |per |an )?([a-z]+)?", (quote or "").lower())
    if not m:
        return None, None
    n = norm_number(m.group(1).replace(" ", ""))
    try:
        return (float(n) if n is not None else None), m.group(4)
    except ValueError:
        return None, m.group(4)


@dataclass
class AtomDecision:
    keep: bool
    type: Optional[str]
    reason: str            # kept / prompted / approval_only / reported_speech / desire_after_pitch / ...
    quantified: bool = False


def decide_atom(raw: dict, *, after_pitch: bool) -> AtomDecision:
    """Code decision rules on one model atom (§4 and Annex A3, in this order)."""
    t = raw.get("type")
    quote = raw.get("quote", "")
    if len(norm(quote).strip(' .,?!"').split()) < 2:                           # SB-9: 2 to 40 words (B2 case 12)
        return AtomDecision(False, None, "below_two_words")
    if approval_only(quote):                                                    # C3 rule 5, X3
        return AtomDecision(False, None, "approval_only")
    if raw.get("prompted_by_sales"):                                            # SB-14, X3 (kept, flagged)
        return AtomDecision(False, t, "prompted")
    if raw.get("reported_speech") and not raw.get("owned"):                     # SB-23
        return AtomDecision(False, None, "reported_speech")
    if t == "IMPACT":
        if raw.get("figure_kind") == "present" and not raw.get("income_drop_attributed"):
            t = "SITUATION"                                                     # SB-11: current figure, X4
        elif raw.get("domain") and raw.get("domain") == raw.get("problem_domain") and raw.get("domain") != "other":
            t = "PAIN"                                                          # SB-10: same domain, X4
    if t == "DESIRE" and after_pitch:                                           # SB-12, X5
        return AtomDecision(False, None, "desire_after_pitch")
    quantified = bool(raw.get("quantified")) and has_quantity(quote)            # SB-24, X6
    if t == "IMPACT" and raw.get("income_drop_attributed"):                     # SB-22
        quantified = has_quantity(quote)
    return AtomDecision(True, t, "kept" if t == raw.get("type") else f"reclassified_{raw.get('type')}_to_{t}",
                        quantified)


def _overlap(a: Evidence, b: Evidence) -> bool:
    if a.turn != b.turn:
        return False
    x, y = norm(a.quote).strip(" .,"), norm(b.quote).strip(" .,")
    return x in y or y in x


def build_atoms(ctx: CallContext, u: Unit, raw_atoms: list[dict], start_index: int,
                meta: dict[str, dict]) -> tuple[list[Atom], list[dict]]:
    """Turns validated model atoms of one answer into `Atom`s (code decision), SB-9 de-duplication."""
    after_pitch = bool(ctx.phases.pitch_start and ctx.n(u.turn.id) >= ctx.n(ctx.phases.pitch_start))
    kept: list[Atom] = []
    log: list[dict] = []
    for raw in raw_atoms:
        d = decide_atom(raw, after_pitch=after_pitch)
        log.append({"solicitation": u.sol.id, "turn": raw.get("turn"), "quote": raw.get("quote"),
                    "model_type": raw.get("type"), "decision": d.reason, "type": d.type})
        if d.type is None:
            continue
        ev = Evidence(raw["quote"], raw["turn"], PROSPECT)
        if d.keep and any(_overlap(ev, k.evidence) and k.type == d.type for k in kept):   # SB-9 one passage
            continue
        val, unit = (None, None)
        if d.quantified:
            mv = raw.get("value")
            if isinstance(mv, (int, float)) and any(norm_number(w) and float(norm_number(w)) == float(mv)
                                                    for w in re.findall(r"\$?[\w.,]+", raw["quote"].lower())):
                val, unit = float(mv), raw.get("unit")
            else:
                val, unit = parse_quantity(raw["quote"])
        a = Atom(f"A{start_index + len(kept) + 1:03d}", d.type, ev, u.sol.id, u.sol.letter, raw.get("object"),
                 raw.get("domain"), d.quantified, val, unit,
                 volunteered=raw["turn"] in u.volunteered_turns, prompted_by_sales=not d.keep)
        # side data not carried by core Atom: goal dimension (§6 D1) and the cause stated by the prospect (§6 D2)
        meta[a.id] = {"dimension": raw.get("dimension"),
                      "cause": Evidence(raw["cause_quote"], raw.get("cause_turn") or raw["turn"], PROSPECT)
                      if raw.get("cause_quote") else None}
        kept.append(a)
    return kept, log


# =============================================================================================== follow-up
ECHO = re.compile(r"^(and )?(tell me more|how so|what else|meaning|what do you mean|in what way|what way|like what|"
                  r"such as|a lot|why|how come|and then|then what|really|for example|go on|say more)\b.{0,25}\?*$")


def follows_up(prev_answer: str, question: str, preamble: str = "") -> bool:
    """SB-17: the question (with its same-turn preamble, SEG-5) reuses a content word of 4+ letters or a number of
    the previous answer. SB-19: an echo / anaphoric solicitation directly after the answer counts as followed up."""
    if not prev_answer:
        return False
    q = norm(question).strip()
    if ECHO.match(q):
        return True
    qw = [w for w in _fold(question).split() if w]
    if 0 < len(qw) <= 4 and all(w in _fold(prev_answer).split() for w in qw):   # SB-19 echo of the answer's words
        return True
    return bool(content_words(question + " " + preamble) & content_words(prev_answer))


# =============================================================================================== chains
@dataclass
class ChainStep:
    sol_id: str
    letter: str
    reason: Optional[str]
    atoms: list[Atom]            # non-volunteered, scoring atoms of its answer
    follows_prev: bool
    unanswered: bool = False


def _link_build(ctx: CallContext, unit: tuple) -> str:
    opening, chain_quotes, cand, cand_answer = unit
    return (f"CHAIN OPENED BY {opening.sol.id}: {opening.sol.text}\nPROBLEM QUOTES OF THE CHAIN: {chain_quotes}\n"
            f"CANDIDATE QUESTION {cand.sol.id} ({cand.turn.id}): {cand.sol.text}\nCANDIDATE ANSWER: {cand_answer}\n"
            "Does the candidate question and its answer bear on the same problem object as the chain?")


def link_task(cand: Unit, ctx: CallContext) -> ModelTask:
    def validate(a: dict, c: CallContext, uid: str) -> list[str]:
        if not isinstance(a.get("same_object"), bool):
            return ["missing_same_object"]
        if a["same_object"]:
            src = [cand.sol.text, cand.preamble] + [ctx.turn(t).text for t in cand.sol.answer_turns]
            if not any(_proof_ok(a.get("quote"), s) for s in src if s):
                return ["bad_quote"]
        return []
    return ModelTask("spin.link", "fast", "spin_link", _link_build, validate, key=lambda a: bool(a.get("same_object")))


def find_chains(steps: list[ChainStep], same_object: Callable[[ChainStep, list[ChainStep], ChainStep], bool]
                ) -> list[dict]:
    """SB-18 / SB-20 deep chains. `steps` are the coded solicitations in order; `same_object(opening, chain,
    candidate)` applies SB-16 (model link + code lexical check).

    Opening: a P whose (non-volunteered) answer has PAIN or BLOCKER. Then, among the following steps:
    - OUT `nothing` (and the other OUT reasons, SB-20) and `unanswered` stacked units are transparent;
    - OUT `sales_list` or `agreement` breaks the chain (SB-20);
    - a coded S/P/I/N on another object breaks it (SB-20);
    - an S on the same object does not break and is not a link (SB-20); a P on the same object neither;
    - an I or N that is not followed up on the previous answer breaks it (SB-17, SB-18 "each followed up");
    - first link: I with an IMPACT; deep when a later I or N on the object gives IMPACT, DESIRE or VALUE.
    Returns every deep chain found, one per object (a later P on the same object as a found chain is skipped).
    """
    chains: list[dict] = []
    used: set[str] = set()
    for i, op in enumerate(steps):
        if op.letter != "P" or op.sol_id in used or not any(a.type in ("PAIN", "BLOCKER") for a in op.atoms):
            continue
        chain = [op]
        impact: Optional[ChainStep] = None
        deep: Optional[ChainStep] = None
        breaker = None
        for st in steps[i + 1:]:
            if st.unanswered:
                continue
            if st.letter == OUT:
                if st.reason in ("sales_list", "agreement"):
                    breaker = f"{st.sol_id}:OUT_{st.reason}"
                    break
                continue
            if st.letter not in LETTERS:
                continue
            if not same_object(op, chain, st):
                breaker = f"{st.sol_id}:other_object"
                break
            chain.append(st)
            if st.letter in ("S", "P"):
                continue
            if not st.follows_prev:
                breaker = f"{st.sol_id}:not_followed_up"
                break
            kinds = {a.type for a in st.atoms}
            if impact is None:
                if st.letter == "I" and "IMPACT" in kinds:
                    impact = st
                continue
            if kinds & {"IMPACT", "DESIRE", "VALUE"}:
                deep = st
                break
        used |= {s.sol_id for s in chain}
        if deep:
            obj = next((a.object for a in op.atoms if a.type in ("PAIN", "BLOCKER")), None)
            chains.append({"opening": op.sol_id, "impact": impact.sol_id, "closing": deep.sol_id,
                           "links": [s.sol_id for s in chain], "object": obj,
                           "evidence": [a.evidence for s in (op, impact, deep) for a in s.atoms
                                        if a.type in ({"PAIN", "BLOCKER"} if s is op else
                                                      {"IMPACT"} if s is impact else {"IMPACT", "DESIRE", "VALUE"})]})
        else:
            chains.append({"opening": op.sol_id, "deep": False, "broken_at": breaker,
                           "links": [s.sol_id for s in chain]})
    deep_chains = [c for c in chains if "closing" in c]
    for c in deep_chains:
        c["deep"] = True
    return chains


def lexical_link(chain_units: list[Unit], chain: list[ChainStep], cand_unit: Unit, cand: ChainStep) -> bool:
    """SB-16 code side: at least one shared content word between the quotes (atoms or questions) of the chain and
    those of the candidate. A followed-up echo question (SB-19) carries its object by anaphora."""
    chain_text = " ".join([u.sol.text + " " + u.preamble for u in chain_units] +
                          [a.evidence.quote for s in chain for a in s.atoms])
    cand_text = " ".join([cand_unit.sol.text, cand_unit.preamble] + [a.evidence.quote for a in cand.atoms])
    return bool(content_words(chain_text) & content_words(cand_text)) or cand.follows_prev


def distinct_objects(chains: list[dict]) -> list[dict]:
    """D5 level 2: deep chains on different objects (object labels compared after normalisation)."""
    out, seen = [], set()
    for c in chains:
        if not c.get("deep"):
            continue
        k = norm(c.get("object") or c["opening"])
        if k in seen:
            continue
        seen.add(k)
        out.append(c)
    return out


# =============================================================================================== items
def _distinct(evs: list[Atom]) -> list[Atom]:
    out: list[Atom] = []
    for a in evs:
        if not any(_overlap(a.evidence, b.evidence) for b in out):
            out.append(a)
    return out


def score_items(atoms: list[Atom], chains: list[dict], meta: Optional[dict[str, dict]] = None
                ) -> tuple[list[ItemScore], dict[str, list[Atom]]]:
    """§6. Prompted atoms never count. Volunteered atoms count for D1..D4 if COUNT_VOLUNTEERED (§11).
    `meta[atom.id]` may carry "dimension" (D1 goal relation) and "cause" (D2 cause Evidence)."""
    meta = meta or {}
    dim = lambda a: (meta.get(a.id) or {}).get("dimension")          # noqa: E731
    cause = lambda a: (meta.get(a.id) or {}).get("cause")            # noqa: E731
    pool = [a for a in atoms if not a.prompted_by_sales and (COUNT_VOLUNTEERED or not a.volunteered)]
    by = {t: _distinct([a for a in pool if a.type == t]) for t in ATOM_TYPES}
    used: dict[str, list[Atom]] = {}
    items: list[ItemScore] = []

    # D1 Baseline: SITUATION related to the goal (same dimension as a DESIRE); no DESIRE -> any quantified one
    desire_dims = {dim(a) for a in by["DESIRE"]} - {None, "other"}
    if by["DESIRE"]:
        related = [a for a in by["SITUATION"] if dim(a) in desire_dims]
    else:
        related = [a for a in by["SITUATION"] if a.quantified]
    q = [a for a in related if a.quantified]
    lv, ev = (2, q[:2]) if len(q) >= 2 else ((1, (q or related)[:1]) if related else (0, []))
    used["D1"] = ev
    items.append(item("D1", WEIGHTS["D1"], lv, [a.evidence for a in ev],
                      "related to the goal by dimension" if by["DESIRE"] else "no DESIRE: quantified SITUATION"))

    # D2 Problem: distinct PAIN / BLOCKER; level 2 = two distinct, or one with its cause stated by the prospect
    pb = _distinct(by["PAIN"] + by["BLOCKER"])
    caused = [a for a in pb if cause(a) and not _overlap(cause(a), a.evidence)]
    if len(pb) >= 2:
        lv, ev, evd, note = 2, pb[:2], [a.evidence for a in pb[:2]], "two distinct PAIN/BLOCKER"
    elif caused:
        lv, ev, evd, note = 2, caused[:1], [caused[0].evidence, cause(caused[0])], "one PAIN/BLOCKER with its cause"
    elif pb:
        lv, ev, evd, note = 1, pb[:1], [pb[0].evidence], ""
    else:
        lv, ev, evd, note = 0, [], [], ""
    used["D2"] = ev
    items.append(item("D2", WEIGHTS["D2"], lv, evd, note))

    # D3 Implication: IMPACT; level 2 = two in distinct domains, at least one quantified
    imp = by["IMPACT"]
    lv, ev = (0, [])
    if imp:
        lv, ev = 1, [next((a for a in imp if a.quantified), imp[0])]
        for a in imp:
            for b in imp:
                if a is not b and a.domain != b.domain and (a.quantified or b.quantified):
                    lv, ev = 2, [a, b]
                    break
            if lv == 2:
                break
    used["D3"] = ev
    items.append(item("D3", WEIGHTS["D3"], lv, [a.evidence for a in ev]))

    # D4 Need-payoff: DESIRE -> 1; DESIRE and VALUE -> 2
    if by["DESIRE"] and by["VALUE"]:
        lv, ev = 2, [by["DESIRE"][0], by["VALUE"][0]]
    elif by["DESIRE"]:
        lv, ev = 1, [by["DESIRE"][0]]
    else:
        lv, ev = 0, []
    note = "VALUE without DESIRE gives level 0 (table §6)" if by["VALUE"] and not by["DESIRE"] else ""
    used["D4"] = ev
    items.append(item("D4", WEIGHTS["D4"], lv, [a.evidence for a in ev], note))

    # D5 Depth: deep chains (never volunteered atoms, SB-8, X7); level 2 needs the quotes of both chains
    deep = distinct_objects(chains)
    lv = 2 if len(deep) >= 2 else 1 if deep else 0
    evd = [e for c in deep[:2] for e in c["evidence"]]
    if lv == 2 and not (deep[0]["evidence"] and deep[1]["evidence"]):
        lv = 1
    items.append(item("D5", WEIGHTS["D5"], lv, evd, f"{len(deep)} deep chain(s) on distinct objects"))
    return items, used


# =============================================================================================== diagnostics
def diagnostics(units: list[Unit], atoms: list[Atom]) -> dict:
    """§8 coaching diagnostics. Displayed, never scored: the letter never produces points."""
    coded = [u for u in units if u.in_perimeter and u.decision and is_coded_letter(u.decision.letter)
             and u.sol.status != "to_review"]
    spin = [u for u in coded if u.decision.letter in LETTERS]
    counts = {L: sum(u.decision.letter == L for u in spin) for L in LETTERS}
    n_spin = sum(counts.values())
    out_reasons: dict[str, int] = {}
    for u in coded:
        if u.decision.letter == OUT:
            out_reasons[u.decision.reason] = out_reasons.get(u.decision.reason, 0) + 1
    ps = [i for i, u in enumerate(spin) if u.decision.letter == "P"]
    p_then_i = sum(1 for i in ps if i + 1 < len(spin) and spin[i + 1].decision.letter == "I")
    by_sol: dict[str, set[str]] = {}
    for a in atoms:
        if not a.prompted_by_sales and not a.volunteered:
            by_sol.setdefault(a.solicitation_id, set()).add(a.type)
    yield_ = {L: (round(sum(bool(by_sol.get(u.sol.id, set()) & EXPECTED_ATOMS[L]) for u in spin
                            if u.decision.letter == L) / counts[L], 3) if counts[L] else None) for L in LETTERS}
    answered = [u for u in coded if not u.unanswered and u.sol.answer_turns]
    budget = {L: {"count": counts[L], kind: lim, "ok": counts[L] <= lim if kind == "ceiling" else counts[L] >= lim}
              for L, (kind, lim) in CALL_BUDGET.items()}
    return {
        "note": "Letter layer: coaching only. The letter never produces points.",
        "letters": counts,
        "letter_shares": {L: round(counts[L] / n_spin, 3) if n_spin else None for L in LETTERS},
        "i_share": round(counts["I"] / n_spin, 3) if n_spin else None,
        "out_reasons": out_reasons,
        "call_budget": budget,
        "p_followed_by_i": round(p_then_i / len(ps), 3) if ps else None,
        "prompted_share": round(out_reasons.get("agreement", 0) / len(coded), 3) if coded else None,
        "closed_need_payoff": sum("closed_need_payoff" in u.sol.tags for u in coded),
        "yield_per_letter": yield_,
        "follow_up_rate": round(sum(u.sol.followed_up for u in answered) / len(answered), 3) if answered else None,
        "targets": DIAG_TARGETS,
    }


def applicability(units: list[Unit], discovery_start: Optional[str]) -> tuple[str, list[str], dict]:
    """§5. Returns (status, reasons, health)."""
    perim = [u for u in units if u.in_perimeter and u.decision]
    coded = [u for u in perim if is_coded_letter(u.decision.letter) and u.sol.status != "to_review"]
    absent = sum(u.decision.letter == OUT and u.decision.reason == "absent" for u in coded)
    health = {"absent_share": round(absent / len(coded), 3) if coded else 0.0,
              "to_review": sum(u.sol.status == "to_review" for u in perim), "coded": len(coded)}
    if discovery_start is None:
        return "not_applicable", ["no_discovery"], health
    if len(coded) < MIN_CODED:
        return "not_applicable", [f"fewer_than_{MIN_CODED}_coded_solicitations"], health
    if health["absent_share"] > ABSENT_MAX_SHARE:
        return "excluded", ["health_absent_share"], health
    return "scored", [], health


# =============================================================================================== orchestration
def place_perimeter(ctx: CallContext, units: list[Unit], resolve: Callable[[Unit], None],
                    reopen_end: Callable[[Unit], Optional[str]]) -> dict:
    """SB-1, SB-2, SB-25, SB-34 (SB-3 / SB-4 off). `resolve(u)` runs the gates of a unit (sets u.gates / u.decision / status)."""
    end = discovery_end(ctx)
    ctx.phases.discovery_end = end
    pre = [u for u in units if end is None or ctx.n(u.turn.id) < ctx.n(end)]
    post = [u for u in units if u not in pre]
    start: Optional[Unit] = None
    for u in pre:
        if u.attrs["backchannel"] or u.attrs["system"]:           # SEG-7: never a solicitation (code)
            u.sol.tags.append("not_coded")
            continue
        u.window_end = end
        resolve(u)
        if start is None and u.decision and is_valid_start(u.decision):   # SB-1, SB-2
            start = u
        if start is not None:
            u.in_perimeter = True
        else:
            u.sol.tags.append("pre_perimeter")
    ctx.phases.discovery_start = start.turn.id if start else None
    # SB-34: after the first pitch start or price nothing is SPIN: not read, not coded, no register
    reopenings: list[dict] = []
    if not REOPENINGS:
        for u in post:
            u.attrs["post_end"] = True
            u.sol.tags.append("post_discovery")
        return {"start": ctx.phases.discovery_start, "end": end, "reopenings": reopenings}
    # SB-3 reopenings after the end (superseded by SB-34, kept off)
    if end is not None and start is not None:
        for u in post:
            u.attrs["post_end"] = True
        i = 0
        cand = [u for u in post if not (u.attrs["backchannel"] or u.attrs["system"])]
        while i < len(cand):
            u = cand[i]
            resolve(u)
            if not is_diagnostic(u):
                u.sol.tags.append("post_discovery")
                i += 1
                continue
            model_end = reopen_end(u)
            run = [u]
            j = i + 1
            while j < len(cand):
                v = cand[j]
                if model_end and ctx.n(v.turn.id) >= ctx.n(model_end):
                    break
                resolve(v)
                if reopening_terminator(v):
                    break
                run.append(v)
                j += 1
            stop = cand[j].turn.id if j < len(cand) else model_end
            if model_end and stop and ctx.n(model_end) < ctx.n(stop):
                stop = model_end
            n_diag = sum(is_diagnostic(v) for v in run)
            in_pitch = bool(ctx.phases.pitch_start and ctx.n(u.turn.id) >= ctx.n(ctx.phases.pitch_start) and
                            (ctx.phases.pitch_end is None or ctx.n(u.turn.id) < ctx.n(ctx.phases.pitch_end)))
            if in_pitch and n_diag < PITCH_CHECKIN_MIN_DIAGNOSTICS:              # SB-4
                for v in run:
                    v.sol.tags.append("pitch_check_in" if v is u else "post_discovery")
            else:
                k = len(reopenings)
                for v in run:
                    v.in_perimeter, v.reopening, v.window_end = True, k, stop
                    v.sol.tags.append(f"reopening_{k}")
                reopenings.append({"start": u.turn.id, "end": stop, "solicitations": [v.sol.id for v in run]})
            i = j
    return {"start": ctx.phases.discovery_start, "end": end, "reopenings": reopenings}


def apply_decision(u: Unit, d: LetterDecision) -> None:
    u.decision = d
    u.sol.letter, u.sol.out_reason = d.letter, d.reason
    u.sol.tags = sorted(set(u.sol.tags) | set(d.tags) | ({"invalid_proof"} if d.invalid_proof else set()))


def expand_splits(units: list[Unit]) -> list[Unit]:
    """SEG-2: a solicitation the model split into coordinated interrogatives becomes several units
    (ids Q007.1a, Q007.1b ...), each with its own letter; they are stacked units for SB-6."""
    out: list[Unit] = []
    for u in units:
        if len(u.parts) < 2:
            out.append(u)
            continue
        for j, (txt, d) in enumerate(u.parts):
            v = Unit(Solicitation(f"{u.sol.id}{'abcdef'[j]}", u.turn.id, txt, tags=sorted(set(u.sol.tags) | {"stacked"}),
                                  status=u.sol.status), u.turn, u.rank, u.total_in_turn, u.preamble, u.prev_prospect,
                     dict(u.attrs, stacked=True), u.gates, None, u.window_end, u.in_perimeter, u.reopening)
            apply_decision(v, d)
            out.append(v)
    return out


# =============================================================================================== registers
def lexicon_registers(text: str) -> set[str]:
    """SB-30: the registers whose domain words appear in a text (word starts, case-insensitive)."""
    t = " " + re.sub(r"[^a-z0-9$' -]+", " ", _fold(text)) + " "
    hits = set()
    for reg, words in REGISTER_LEXICON.items():
        if any(re.search(r"[ $]" + re.escape(w), t) for w in words):
            hits.add(reg)
    if re.search(r"\$ ?\d|\d+ ?k\b", t):
        hits.add("financial")
    return hits


def decide_register(a: Optional[dict]) -> Optional[str]:
    """SB-26: the code maps the model's asked domain to its register (other / none -> Other)."""
    if not a:
        return None
    return REGISTER_OF_DOMAIN.get(a.get("asked_domain"))


def _answer_turns(ctx: CallContext, u: Unit) -> list:
    """SB-35: the prospect's answer to the question (SB-6 answer span), its first turns."""
    return [t for t in (ctx.turn(i) for i in (u.sol.answer_turns or [])[:REGISTER_ANSWER_TURNS]) if t is not None]


def _register_build(ctx: CallContext, u: Unit) -> str:
    prev = u.prev_prospect[-REGISTER_REFERENCE_TURNS:]
    ans = _answer_turns(ctx, u)
    return (f"UNIT: {u.sol.id}  (turn {u.turn.id}, a {u.decision.letter if u.decision else '?'} question of the discovery)\n"
            f"LAST PROSPECT TURNS BEFORE IT:\n{_ctx_lines(prev) or '(none)'}\n"
            f"SALES PREAMBLE IN THE SAME TURN: {u.preamble or '(none)'}\n"
            f"SOLICITATION: {u.sol.text}\n"
            f"PROSPECT'S ANSWER TO IT:\n{chr(10).join(f'[{t.id} {t.ts}] {t.role}: {t.text[:800]}' for t in ans) or '(no answer)'}\n"
            "Which domain does this question make the prospect talk about? Quotes are exact substrings.")


def _validate_register(a: dict, ctx: CallContext, u: Unit) -> list[str]:
    """SB-32 rules 1-3: closed values, an exact quote in the right place, the rule order of SB-35, no conflict with the
    domain words."""
    if not isinstance(a, dict):
        return ["not_an_object"]
    dom, basis = a.get("asked_domain"), a.get("basis")
    if dom not in REGISTER_OF_DOMAIN:
        return ["bad_domain"]
    if basis not in REGISTER_BASES:
        return ["bad_basis"]
    answered = bool(_answer_turns(ctx, u))
    if basis == "none":
        if answered:
            return ["none_with_answer"]                       # SB-35: an open question with an answer is read in it
        return [] if dom in ("none", "other") else ["none_basis_with_domain"]
    if dom == "none":
        return ["domain_without_basis"]
    q = a.get("quote")
    if basis == "named":
        if dom == "other":
            return ["named_other"]                            # SB-35: a subject outside the seven domains is an open question
        where = (u.preamble + " " + u.sol.text) if u.preamble else u.sol.text
        if not _proof_ok(q, where):
            return ["bad_quote:named"]
        lex = lexicon_registers(u.sol.text)
        if len(lex) == 1 and REGISTER_OF_DOMAIN[dom] not in lex:
            return ["lexicon_conflict"]
        return []
    rt = a.get("reference_turn")
    if basis == "answer":
        # SB-35: the effect of the question, in the prospect's own words in its answer
        if not answered:
            return ["no_answer"]
        if rt not in {t.id for t in _answer_turns(ctx, u)}:
            return ["bad_answer_turn"]
        e = quote_ok(ctx, Evidence(q or "", rt, PROSPECT), min_words=1, max_words=40)
        return [f"bad_quote:{e}"] if e else []
    # reference: only for an open question with no answer; the words it points to, in the last prospect turns (SB-29)
    if answered:
        return ["reference_with_answer"]
    if rt not in {t.id for t in u.prev_prospect[-REGISTER_REFERENCE_TURNS:]}:
        return ["bad_reference_turn"]
    e = quote_ok(ctx, Evidence(q or "", rt, PROSPECT), min_words=1, max_words=40)
    return [f"bad_quote:{e}"] if e else []


def register_task(u: Unit) -> ModelTask:
    """One closed task per coded question of the discovery; the key compared across passes is the register."""
    return ModelTask("spin.register", "fast", "spin_register", _register_build,
                     lambda a, c, uid: _validate_register(a, c, u), key=lambda a: decide_register(a))


def register_summary(units: list["Unit"], decided: dict[str, dict]) -> dict:
    """SB-33: counts per register, and the per-call agreement gate (share of registers decided 3/3)."""
    n = len(decided)
    verified = sum(1 for d in decided.values() if d["status"] == "verified")
    review = sum(1 for d in decided.values() if d["status"] == "to_review")
    counts = {r: sum(1 for d in decided.values() if d["register"] == r) for r in REGISTERS}
    agreement = round(verified / n, 3) if n else None
    flags = ["register_agreement_low"] if n and agreement < REGISTER_MIN_AGREEMENT else []
    return {"counts": counts, "questions": n, "verified": verified, "to_review": review,
            "agreement": agreement, "threshold": REGISTER_MIN_AGREEMENT, "flags": flags,
            "labels": REGISTER_LABELS}


class SpinCompetence:
    name = "SPIN"
    rules_version = "SPIN-1.3"

    def run(self, ctx: CallContext, runner: Runner) -> CompetenceResult:
        res = CompetenceResult(self.name, self.rules_version)
        units = inventory(ctx)
        statuses: list[str] = []
        concord: list[str] = []

        def resolve(u: Unit) -> None:
            """S3 + S4 + S5 for one unit: three passes, validation, arbitration, then the code letter."""
            if u.gates is not None or u.sol.status in ("to_review", "verified", "arbitrated"):
                return
            r = runner.run(ctx, gate_task(u), f"gates:{u.sol.id}", u)
            u.sol.status = r.status
            statuses.append(r.status)
            concord.append(r.concordance)
            if r.answer is None:                                    # C3 rule 7 / C4: excluded from scores
                u.sol.tags.append("to_review")
                return
            u.gates = r.answer
            u.parts = decide_gates(r.answer, u.attrs, u.sol.text)
            # for the perimeter, a split unit is represented by its first S/P/I/N part (else its first part)
            apply_decision(u, next((d for _, d in u.parts if d.letter in LETTERS), u.parts[0][1]))

        def reopen_end(u: Unit) -> Optional[str]:
            r = runner.run(ctx, reopen_task(u), f"reopen:{u.sol.id}", u)
            return (r.answer or {}).get("end_turn")

        perimeter = place_perimeter(ctx, units, resolve, reopen_end)
        units = expand_splits(units)
        for v in units:
            if not v.in_perimeter:          # inventoried, not coded: the letter is only written inside the perimeter
                v.sol.letter = v.sol.out_reason = None
                if "not_coded" not in v.sol.tags:
                    v.sol.tags.append("not_coded")
        for k, v in enumerate(units):
            v.rank = k                                              # transcript order, used by SB-6
        coded = [u for u in units if u.in_perimeter and u.decision and is_coded_letter(u.decision.letter)]
        answer_spans(ctx, coded, {u.turn.id for u in units if not u.attrs["backchannel"]})

        # atoms: model extraction, then code decisions (SB-9..SB-15, SB-22..SB-24)
        atoms: list[Atom] = []
        meta: dict[str, dict] = {}
        atom_log: list[dict] = []
        for u in coded:
            if u.unanswered or not (u.sol.answer_turns or u.volunteered_turns):
                continue
            r = runner.run(ctx, atoms_task(u), f"atoms:{u.sol.id}", u)
            statuses.append(r.status)
            concord.append(r.concordance)
            if r.answer is None:
                u.sol.tags.append("atoms_to_review")
                continue
            new, log = build_atoms(ctx, u, r.answer.get("atoms") or [], len(atoms), meta)
            atoms += new
            atom_log += log
        # SB-21: an action-plan question is N only if its answer states a future state or its value
        for u in coded:
            if u.decision.letter == "N" and ((u.gates or {}).get("g3") or {}).get("action_plan"):
                kinds = {a.type for a in atoms if a.solicitation_id == u.sol.id and not a.prompted_by_sales}
                if not kinds & {"DESIRE", "VALUE"}:
                    apply_decision(u, LetterDecision(OUT, 1, "solution_load", u.decision.tags + ["sb21_action_plan"]))
                    for a in atoms:
                        if a.solicitation_id == u.sol.id:
                            a.letter = OUT
        ctx.atoms = atoms

        # follow-up (SB-17 / SB-19) between consecutive answered coded solicitations
        answered = [u for u in coded if not u.unanswered]
        for prev, nxt in zip(answered, answered[1:]):
            nxt.follows_prev = follows_up(prev.answer_text, nxt.sol.text, nxt.preamble)
            prev.sol.followed_up = nxt.follows_prev

        # chains: model link + code lexical check (SB-16), then SB-18 / SB-20 in code
        by_id = {u.sol.id: u for u in coded}
        steps = [ChainStep(u.sol.id, u.decision.letter, u.decision.reason,
                           [a for a in atoms if a.solicitation_id == u.sol.id and not a.prompted_by_sales
                            and not a.volunteered], u.follows_prev, u.unanswered)
                 for u in coded if u.sol.status != "to_review"]

        def same_object(op: ChainStep, chain: list[ChainStep], cand: ChainStep) -> bool:
            cu = by_id[cand.sol_id]
            r = runner.run(ctx, link_task(cu, ctx), f"link:{op.sol_id}>{cand.sol_id}",
                           (by_id[op.sol_id], [a.evidence.quote for s in chain for a in s.atoms], cu,
                            cu.answer_text[:1500]))
            statuses.append(r.status)
            model = bool(r.answer and r.answer.get("same_object"))
            return model and lexical_link([by_id[s.sol_id] for s in chain], chain, cu, cand)

        chains = find_chains(steps, same_object)

        # registers (SB-26..SB-33): coded questions before the pitch only (not reopenings, not OUT, not post-pitch)
        reg_decided: dict[str, dict] = {}
        for u in coded:
            if u.reopening is not None or u.sol.status == "to_review" or not u.decision or u.decision.letter not in LETTERS:
                continue
            r = runner.run(ctx, register_task(u), f"register:{u.sol.id}", u)
            statuses.append(r.status)
            reg = decide_register(r.answer) if r.answer is not None else None
            reg_decided[u.sol.id] = {"register": reg, "status": r.status, "concordance": r.concordance,
                                     "domain": (r.answer or {}).get("asked_domain"), "basis": (r.answer or {}).get("basis"),
                                     "quote": (r.answer or {}).get("quote"), "reference_turn": (r.answer or {}).get("reference_turn")}

        # shared state (CONTRACT) and result
        ctx.solicitations = [u.sol for u in units]
        status, reasons, health = applicability(units, ctx.phases.discovery_start)
        res.status, res.reasons = status, reasons
        if "to_review" in statuses:
            res.flags.append("units_to_review")
        res.concordance = (min(concord, key=lambda c: int(c.split("/")[0]) / max(1, int(c.split("/")[1])))
                           if concord else None)
        diag = diagnostics(units, atoms)
        reg_summary = register_summary(units, reg_decided)
        res.flags += reg_summary["flags"]
        res.flags += [f"budget_{L}" for L, b in diag["call_budget"].items() if not b["ok"]]
        items, _ = score_items(atoms, chains, meta)
        if status == "scored":
            res.items = items
            res.score = call_score(items)
        res.details = {
            "perimeter": perimeter,
            "items_evidence": self._evidence_details(ctx, items, atoms) if status == "scored" else {},
            "chains": [{k: v for k, v in c.items() if k != "evidence"} for c in chains],
            "diagnostics": diag,
            "health": health,
            "unit_status": {s: statuses.count(s) for s in sorted(set(statuses))},
            "atom_decisions": atom_log,
            "solicitations": [{"id": u.sol.id, "turn": u.turn.id, "ts": u.turn.ts, "letter": u.sol.letter,
                               "gate_letter": u.decision.letter if u.decision else None,
                               "out_reason": u.sol.out_reason, "gate": u.decision.gate if u.decision else None,
                               "tags": u.sol.tags, "in_perimeter": u.in_perimeter, "status": u.sol.status,
                               "answer_turns": u.sol.answer_turns, "followed_up": u.sol.followed_up,
                               "register": (reg_decided.get(u.sol.id) or {}).get("register"),
                               "register_status": (reg_decided.get(u.sol.id) or {}).get("status"),
                               "register_basis": (reg_decided.get(u.sol.id) or {}).get("basis"),
                               "register_domain": (reg_decided.get(u.sol.id) or {}).get("domain"),
                               "register_quote": (reg_decided.get(u.sol.id) or {}).get("quote"),
                               "register_reference_turn": (reg_decided.get(u.sol.id) or {}).get("reference_turn")}
                              for u in units],
            "registers": reg_summary,
        }
        return res

    @staticmethod
    def _evidence_details(ctx: CallContext, items: list[ItemScore], atoms: list[Atom]) -> dict:
        """§10 output contract: each evidence with turn, ts, speaker, quote, atom, domain, question id and letter."""
        out = {}
        for it in items:
            rows = []
            for e in it.evidence:
                a = next((x for x in atoms if x.evidence.turn == e.turn and x.evidence.quote == e.quote), None)
                rows.append({"turn": e.turn, "ts": ctx.turn(e.turn).ts, "speaker": PROSPECT, "quote": e.quote,
                             "atom": a.type if a else "CAUSE", "domain": a.domain if a else None,
                             "question_id": a.solicitation_id if a else None,
                             "question_letter": a.letter if a else None})
            out[it.id] = {"level": it.level, "evidence": rows, "note": it.note}
        return out
