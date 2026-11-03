"""Competence 2 · Gap formalisation (methodology v1.3, rules version GAP-1.3).

The model extracts and quotes; the code decides and scores (Part C, C2).

Pipeline of this module
  1. Prospect statements (A, B, PROBLEM, COST) are read from the SPIN atoms (exact prospect quotes) (§3).
  2. Gap formula: selected A / B / P (GB-28..GB-30), roadmap blockers (GB-32), Copilot warning (GB-33).
     Selection is done by code from the atoms, before reading the restitution; the model only answers small
     closed questions (present state of a figure, stopping question, horizon of B).
  3. Restitution inventory by code (signals S1/S2/S3, window A2, span GB-1/GB-2), then one model task per
     candidate (clauses, source turn, key expression). The code classifies every clause verbatim / paraphrased /
     untraced (GB-3, GB-22 with core.text.key_expression_ok, GB-23, GB-24, X4..X6, X10..X12) and decides
     whether the candidate is a restitution (GB-4).
  4. One model task per restitution for the validation (GB-8..GB-10, GB-15..GB-17, GB-26), decided by code;
     corrections (GB-25, X9).
  5. Absence gate (§5.1) with ordered reasons (GB-20), items G1..G6 (§5.2) with the formula conformity (GB-31)
     for G5, two-quote rule (C3 rule 4), diagnostics (§7), output contract (§9) and the shared state read by Pitch.

Every value marked "to validate" in the methodology is a module constant below.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any, Optional

from ..core.models import (CallContext, CompetenceResult, Evidence, ItemScore, OTHER, PROSPECT, SALES, Atom,
                           Solicitation, Turn)
from ..core.runner import ModelTask, Runner
from ..core.scoring import call_score, item
from ..core.text import (GENERIC, STOP, _contains, approval_only, canon, clean_tokens, key_expression_ok, norm,
                         norm_number, quote_ok, sentences)

NAME = "GAP"
RULES_VERSION = "GAP-1.3"

# ------------------------------------------------------------------------------------------- constants
WEIGHTS = {"G1": 10, "G2": 10, "G3": 10, "G4": 20, "G5": 25, "G6": 25}   # §5.2, proposals "to validate"
ROADMAP_STEPS = 3                      # GB-33: 3-step roadmap (in general: number of steps)
ROADMAP_COUNTS_SELECTED_P = True       # GB-32: selected P included in the count ("to confirm")
S1_FIRST_WORDS = 20                    # A1 S1: opener within the first 20 words
S2_MIN_WORDS = 25                      # A1 S2: dense second-person passage of 25 words or more
S2_MIN_CLAUSES = 2                     # A1 S2: at least two clauses with the prospect as subject
SHORT_TURN_MAX_WORDS = 5               # GB-1: short approval / backchannel does not end the span
VALIDATION_MIN_WORDS = 6               # GB-1, GB-2, GB-8
LONG_KEY_EXPRESSION_WORDS = 3          # G5 level 2: one key expression of 3 words or more, or a prospect figure
QUOTE_MAX_WORDS = 40                   # C3 rule 1
# GB-20 lists `restitution_after_pitch` "when a passing restitution exists only after the pitch", while Annex B
# case B3.7 (call 018) gives `restitution_after_pitch` for a post-pitch restitution that has no COST. With False
# (B3.7 reading), any post-pitch restitution yields `restitution_after_pitch` when no pre-pitch restitution exists;
# when pre-pitch restitutions exist, a *passing* post-pitch one is still required (GB-20 example). To validate.
AFTER_PITCH_REASON_REQUIRES_PASSING = False
# A2 diagnostics after the window end: how far the inventory goes, and which signals it keeps (cost control,
# to validate). "first_price": stop at the first price / decision request; "S1_S3": after the pitch start only
# passages with an opener or a validation request are candidates.
POST_WINDOW_LIMIT = "first_price"
POST_WINDOW_SIGNALS = "S1_S3"
# B without a horizon cannot reach level 2 on G2 (§10, current proposal).
G2_REQUIRES_HORIZON = True
# GB-19: earlier touchpoints whose text is the prospect's own words (ctx.prior_inputs[k]["kind"]).
PRIOR_SOURCE_KINDS = {"form", "earlier_call"}

COMPONENTS = ("PROBLEM", "COST", "A", "B")
OUTCOMES = ("confirmed_with_content", "confirmed", "corrected", "rejected", "none")
VALIDATED = {"confirmed_with_content", "confirmed"}
COST_DOMAINS = {"money", "time", "clients", "family", "health", "self-belief", "self_belief", "future",
                "opportunity", "lost opportunity"}
# Atom types that can be the statement of each component (§2, verbatim reference v2 mapping).
COMP_TYPES = {"PROBLEM": {"PAIN", "BLOCKER"}, "COST": {"IMPACT"}, "A": {"SITUATION", "IMPACT"}, "B": {"DESIRE"}}
REASON_PRIORITY = ["no_restitution", "restitution_after_pitch", "problem_missing", "cost_missing", "not_validated"]

# A1 S1 openers (examples of the annex, plus their obvious grammatical variants)
OPENERS = re.compile(
    r"\b(so from what i'?m hearing|from what i'?ve (been )?hear(d|ing)|let me play (that|this|it) back|"
    r"play back what i'?(m|ve) (been )?hear(d|ing)|if i understood (you )?correctly|correct me if i'?m wrong|"
    r"just to recap|so to recap|to recap|what i'?m hearing is|let me make sure i (got|get|understand)|"
    r"so basically where you'?re at is|so to summari[sz]e|to summari[sz]e|"
    r"relay what i'?ve been hearing|reflect back)\b")
# A1 S3 validation requests (end of the passage)
VALIDATION_REQUEST = re.compile(
    r"(did i get (that|this|it|everything) right|have i got (that|this|it) right|got that right|is that fair|"
    r"fair\??$|is that accurate|is that right|is that correct|correct\??$|right\?$|anything i(?:'ve)? missed|"
    r"(think|did|have) i(?:'ve)? miss(ed)? anything|anything i got wrong|did i miss anything|"
    r"am i missing (something|anything)|missing something|would you say that'?s where you'?re at|"
    r"does that sound (about )?right|does that resonate|are we on the same page|same page)")
# GB-15: "did I miss anything?" family: a bare "no" is agreement
MISSING_REQUEST = re.compile(r"(miss(ed|ing)? (anything|something)|anything i(?:'ve)? missed|got (anything )?wrong)")
# GB-1 / GB-5: first mention of the offer ends the span
OFFER_WORDS = re.compile(
    r"\b(our program|the program|the mentorship|the academy|what we do|how we help|how we can help|"
    r"how our program|let me show you|show you how we|share my screen)\b")
# GB-30 step 1: stopping questions (code detection; the model is asked only when this does not match)
STOPPING_Q = re.compile(
    r"(held you back|holding you back|hold you back|stopp(ed|ing) you|stops you|getting in the way|"
    r"standing in the way|in your way|why haven'?t you|prevented you|what'?s been in the way|kept you from|"
    r"keeping you from)")
# GB-23 quoting markers
QUOTING_MARKER = re.compile(r"\b(in your (own )?words|as you said|you used the word|from your words|"
                            r"like you said|you said it yourself)\b")
SUBJECT_YOU = {"you", "your", "you're", "you've", "you'd", "you'll", "yourself"}
LEAD_WORDS = {"so", "and", "but", "now", "then", "also", "obviously", "basically", "like", "well", "okay", "right",
              "currently", "today", "ultimately", "essentially", "just"}
# yes/no questions without a final "?" (wh-starts are kept: "what's holding you back is X" is declarative)
INTERROGATIVE = re.compile(r"^(?:\W*)(so |and |but |now |okay,? )?(do|does|did|are|is|can|could|would|will|have|has)"
                           r" (you|we|i|that|this|it)\b")
SECOND_PERSON = {"you", "your", "you're", "you've", "you'd", "you'll", "yourself", "yours"}
BACKCHANNEL = {"yeah", "yes", "yep", "mm", "mhm", "hmm", "mm-hmm", "uh-huh", "okay", "ok", "cool", "right", "sure",
               "got", "it", "exactly", "totally", "true", "no", "nope", "oh", "wow", "great", "perfect", "nice"}


# ------------------------------------------------------------------------------------------- small helpers
def _words(text: str) -> int:
    return len(clean_tokens(text))


def _ts_seconds(ts: str) -> Optional[int]:
    try:
        parts = [int(x) for x in ts.split(":")]
    except (ValueError, AttributeError):
        return None
    s = 0
    for p in parts:
        s = s * 60 + p
    return s


def short_approval(text: str) -> bool:
    """GB-1: a prospect turn of 5 words or fewer made only of approval or backchannel."""
    toks = clean_tokens(text)
    if len(toks) > SHORT_TURN_MAX_WORDS:
        return False
    return not toks or approval_only(text) or all(t in BACKCHANNEL for t in toks)


def _unit(u: Optional[str]) -> Optional[str]:
    return re.sub(r"\s+", "", norm(u)) if u else None


def _has_figure(tokens: list[str]) -> bool:
    return any(re.search(r"\d", t) and norm_number(t) is not None for t in tokens)


def _content_tokens(tokens: list[str]) -> list[str]:
    return [t for t in tokens if t not in STOP and t not in GENERIC]


def _pos(ctx: CallContext, tid: str, quote: str = "") -> tuple[int, int]:
    """Sortable position of a quote: (turn position, character offset in the turn)."""
    try:
        n = ctx.n(tid)
    except KeyError:
        return (-1, -1)
    i = norm(ctx.turn(tid).text).find(norm(quote)) if quote else 0
    return (n, max(i, 0))


def _ev(d: Optional[dict], role: Optional[str] = None) -> Optional[Evidence]:
    if not d or not d.get("quote") or not d.get("turn"):
        return None
    return Evidence(d["quote"], d["turn"], role)


# ------------------------------------------------------------------------------------------- data
@dataclass
class Statement:
    """A prospect statement of one component: always an exact prospect quote (verbatim principle 1)."""
    component: str
    atom_id: str
    quote: str
    turn: str
    letter: Optional[str]
    solicitation: Optional[str]
    object: Optional[str]
    domain: Optional[str]
    quantified: bool
    value: Optional[float]
    unit: Optional[str]
    atom_type: str

    def to_dict(self) -> dict:
        return {"quote": self.quote, "turn": self.turn, "value": self.value, "unit": self.unit,
                "solicitation": self.letter, "solicitation_id": self.solicitation, "object": self.object,
                "domain": self.domain, "quantified": self.quantified, "atom": self.atom_id}


@dataclass
class Span:
    start: str
    end: str
    turns: list[str]                       # every turn of the span (sales turns + absorbed short approvals)
    signals: list[str]

    @property
    def uid(self) -> str:
        return f"{self.start}:{self.end}"


@dataclass
class Clause:
    component: str
    sales_quote: str
    sales_turn: str
    source_turn: Optional[str]
    key_expression: Optional[str]
    match: str = "untraced"                # verbatim / paraphrased / untraced / excluded
    reason: str = ""
    source_atom: Optional[str] = None
    source_quote: Optional[str] = None
    object: Optional[str] = None
    as_holding_back: bool = False
    explicit_quote: bool = False

    def to_dict(self) -> dict:
        return dict(self.__dict__)


@dataclass
class Restitution:
    span: Span
    status: str                            # model status of the unit: verified / arbitrated / to_review
    concordance: str = ""
    clauses: list[Clause] = field(default_factory=list)
    is_restitution: bool = False
    after_pitch: bool = False
    after_price: bool = False
    offer_cut: Optional[tuple[str, int]] = None
    request: Optional[str] = None          # S3 request found at the end of the passage
    new_topic_question: Optional[str] = None
    validation: dict = field(default_factory=dict)
    restates_correction_of: Optional[str] = None
    effective_outcome: Optional[str] = None
    conformity: Optional[dict] = None

    @property
    def components(self) -> set[str]:
        return {c.component for c in self.clauses if c.match == "verbatim"}

    @property
    def before_pitch(self) -> bool:
        return not self.after_pitch and not self.after_price


# ------------------------------------------------------------------------------------------- 1. statements
def statements_from_atoms(ctx: CallContext, end: Optional[str] = None) -> dict[str, list[Statement]]:
    """§3: prospect statements per component, from the SPIN atoms (each one an exact prospect quote).
    Excluded: prompted_by_sales (X10, X12), quotes that are not prospect quotes, atoms at or after `end`."""
    out: dict[str, list[Statement]] = {c: [] for c in COMPONENTS}
    for a in ctx.atoms:
        ev = a.evidence
        if a.prompted_by_sales or ev is None:
            continue
        try:
            t = ctx.turn(ev.turn)
        except KeyError:
            continue
        if t.role != PROSPECT or t.attribution_doubtful or norm(ev.quote) not in norm(t.text):
            continue
        if end and not ctx.before(ev.turn, end):
            continue
        for comp, types in COMP_TYPES.items():
            if a.type not in types:
                continue
            if comp == "COST" and (a.domain or "").lower() not in COST_DOMAINS and a.domain is not None:
                continue
            out[comp].append(Statement(comp, a.id, ev.quote, ev.turn, a.letter, a.solicitation_id, a.object,
                                       a.domain, a.quantified, a.value, a.unit, a.type))
    for comp in out:
        out[comp].sort(key=lambda s: _pos(ctx, s.turn, s.quote))
    return out


# ------------------------------------------------------------------------------------------- 2. gap formula
def a_candidates(ctx: CallContext, st: dict[str, list[Statement]], cutoff: Optional[str],
                 not_present: set[str] = frozenset()) -> list[Statement]:
    """GB-28 candidates: current-state quotes in S or I answers (SITUATION, or quantified IMPACT stating where he
    is now), before the cutoff. `not_present` = atom ids the model said do not describe the present (X13)."""
    out = []
    for s in st["A"]:
        if s.letter not in ("S", "I") or not ctx.before(s.turn, cutoff):
            continue
        if s.atom_type == "IMPACT" and not s.quantified:
            continue
        if s.atom_id in not_present:
            continue
        out.append(s)
    return out


def b_candidates(ctx: CallContext, st: dict[str, list[Statement]], cutoff: Optional[str]) -> tuple[list, list]:
    """GB-29 candidates (N answers) and the targets stated outside N answers (`B_outside_N`, recorded only)."""
    inside = [s for s in st["B"] if s.letter == "N" and ctx.before(s.turn, cutoff)]
    outside = [s for s in st["B"] if s.letter != "N" and ctx.before(s.turn, cutoff)]
    return inside, outside


def select_a_b(ctx: CallContext, A: list[Statement], B: list[Statement]) -> tuple[Optional[Statement],
                                                                                    Optional[Statement], str]:
    """GB-28 / GB-29. Returns (selected_A, selected_B, rule). Lists are in transcript order."""
    def last(xs):
        return xs[-1] if xs else None
    Aq = [a for a in A if a.quantified and a.unit]
    Bq = [b for b in B if b.quantified and b.unit]
    shared = [b for b in Bq if any(_unit(a.unit) == _unit(b.unit) for a in Aq)]
    if shared:
        b = last(shared)
        a = last([x for x in Aq if _unit(x.unit) == _unit(b.unit)])
        return a, b, "same_unit"
    # B in A's unit when the unit is not a figure (status, career, date...): the pair restated by the formula
    shared_u = [b for b in B if b.unit and any(a.unit and _unit(a.unit) == _unit(b.unit) for a in A)]
    if shared_u:
        b = last(shared_u)
        return last([x for x in A if x.unit and _unit(x.unit) == _unit(b.unit)]), b, "same_unit_unquantified"
    if B:
        b = last(Bq) or last(B)
        same_obj = [x for x in A if b.object and x.object and norm(x.object) == norm(b.object)]
        if same_obj:
            return last(same_obj), b, "same_object"
        same_u = [x for x in A if b.unit and _unit(x.unit) == _unit(b.unit)]
        if same_u:
            return last(same_u), b, "same_unit_unquantified"
        return last(A), b, "no_A_on_B_dimension" if A else "no_A"
    return (last(Aq) or last(A)), None, "no_B"


def select_p(ctx: CallContext, P: list[Statement], stopping: list[Solicitation],
             all_atoms_before: list[Atom]) -> tuple[Optional[Statement], Optional[str]]:
    """GB-30. P = PAIN/BLOCKER statements in P answers (before the cutoff), in transcript order.
    stopping = P solicitations that are stopping questions, in transcript order."""
    if not P:
        return None, None

    def key_obj(s: Statement) -> str:
        return norm(s.object) if s.object else f"#{s.atom_id}"

    pool, named = P, None
    for q in stopping:                                   # step 1: first stopping question with a blocker
        ans = [s for s in P if s.solicitation == q.id]
        if ans:
            named = ans
            break
    if named is not None:
        if len({key_obj(s) for s in named}) == 1:
            return named[0], "named_when_asked"
        pool = named                                     # several blockers: step 2 among them only
    # step 2: object appearing in the largest number of distinct prospect turns before the first restitution
    turns_by_obj: dict[str, set[str]] = {}
    for a in all_atoms_before:
        if a.object and not a.prompted_by_sales:
            turns_by_obj.setdefault(norm(a.object), set()).add(a.evidence.turn)
    for s in P:
        turns_by_obj.setdefault(key_obj(s), set()).add(s.turn)
    best = max(len(turns_by_obj.get(key_obj(s), ())) for s in pool)
    top = [s for s in pool if len(turns_by_obj.get(key_obj(s), ())) == best]
    if len({key_obj(s) for s in top}) == 1:
        return top[0], "comes_back_most"
    # step 3: tie-break: named first in answer to the stopping question, then the most recent (to validate)
    if named is not None:
        return min(top, key=lambda s: _pos(ctx, s.turn, s.quote)), "tie_named_first"
    return max(top, key=lambda s: _pos(ctx, s.turn, s.quote)), "tie_most_recent"


def roadmap_blockers(ctx: CallContext, end: Optional[str], selected_p: Optional[Statement] = None) -> list[dict]:
    """GB-32: distinct blocker objects stated in answers to P or I solicitations before the first pitch,
    each with its first exact quote. Prompted blockers excluded (X12)."""
    seen: dict[str, dict] = {}
    atoms = sorted((a for a in ctx.atoms if a.type in ("PAIN", "BLOCKER") and a.letter in ("P", "I")
                    and not a.prompted_by_sales and a.evidence and ctx.before(a.evidence.turn, end)),
                   key=lambda a: _pos(ctx, a.evidence.turn, a.evidence.quote))
    for a in atoms:
        try:
            if ctx.turn(a.evidence.turn).role != PROSPECT:
                continue
        except KeyError:
            continue
        k = norm(a.object) if a.object else f"#{a.id}"
        if k not in seen:
            seen[k] = {"object": a.object, "quote": a.evidence.quote, "turn": a.evidence.turn,
                       "solicitation": a.letter}
    out = list(seen.values())
    if not ROADMAP_COUNTS_SELECTED_P and selected_p is not None:
        out = [b for b in out if norm(b["object"] or "") != norm(selected_p.object or "")]
    return out


def copilot_warning(blockers: list[dict], steps: int = ROADMAP_STEPS) -> bool:
    """GB-33: warn the sales before generating the roadmap page when fewer blockers than steps."""
    return len(blockers) < steps


# ------------------------------------------------------------------------------------------- 3. inventory
def post_window_limit(ctx: CallContext) -> Optional[str]:
    """A2: candidates after the window end are recorded for diagnostics (after_pitch / after_price). The
    inventory stops at the first price or the decision request (POST_WINDOW_LIMIT), whichever comes first."""
    if POST_WINDOW_LIMIT != "first_price":
        return None
    ends = [x for x in (ctx.phases.first_price, ctx.phases.decision_request) if x]
    return min(ends, key=ctx.n) if ends else None


def window_end(ctx: CallContext) -> Optional[str]:
    """A2: end of the phase window = first pitch start or first price, whichever comes first (GB-14)."""
    ends = [x for x in (ctx.phases.pitch_start, ctx.phases.first_price) if x]
    return min(ends, key=ctx.n) if ends else None


def candidate_signals(ctx: CallContext, t: Turn, prior_prospect_tokens: set[str]) -> list[str]:
    """A1: S1 opener (first 20 words), S2 dense second-person passage, S3 validation request at the end."""
    sig = []
    head = " ".join(norm(t.text).split()[:S1_FIRST_WORDS])
    if OPENERS.search(head):
        sig.append("S1")
    toks = clean_tokens(t.text)
    if len(toks) >= S2_MIN_WORDS:
        n = 0
        for sent in sentences(t.text):
            if sent.rstrip().endswith("?") or INTERROGATIVE.match(norm(sent)):
                continue                                   # S2 counts declarative clauses only
            for c in re.split(r"[;,]\s*|\s+(?:and|but|so)\s+", norm(sent)):
                ct = [w for w in clean_tokens(c) if w not in LEAD_WORDS]
                if not ct or ct[0] not in SUBJECT_YOU:     # the prospect as subject
                    continue
                if any(w in prior_prospect_tokens and (len(w) > 3 and w not in STOP and w not in GENERIC
                                                       or (re.search(r"\d", w) and norm_number(w)))
                       for w in ct[1:]):
                    n += 1
        if n >= S2_MIN_CLAUSES:
            sig.append("S2")
    if validation_request(t.text):
        sig.append("S3")
    return sig


def validation_request(text: str) -> Optional[str]:
    """S3: the last sentence of the passage asks for validation of what was just said."""
    ss = sentences(text) or [text]
    last = norm(ss[-1]).strip()
    tail = " ".join(norm(text).split()[-12:])
    for chunk in (last, tail):
        m = VALIDATION_REQUEST.search(chunk)
        if m:
            return ss[-1].strip()
    return None


def inventory(ctx: CallContext) -> list[Span]:
    """S1 Inventory (code): restitution candidates from the discovery start to the end of the call (candidates
    after the window end are kept for diagnostics, A2). GB-1 span: candidate sales turns separated only by short
    approvals are merged; an S3-only short turn is merged with the sales turn just before it."""
    start = ctx.phases.discovery_start
    turns = ctx.window(start, None) if start else list(ctx.turns)
    prior: set[str] = set()
    if start:
        for t in ctx.window(None, start):
            if t.role == PROSPECT and not t.attribution_doubtful:
                prior.update(clean_tokens(t.text))
    flagged: dict[str, list[str]] = {}
    wend = window_end(ctx)
    limit = post_window_limit(ctx)
    for t in turns:
        if limit is not None and not ctx.before(t.id, limit):
            break
        if t.role == PROSPECT and not t.attribution_doubtful:
            prior.update(clean_tokens(t.text))
            continue
        if t.role != SALES or t.attribution_doubtful:          # GB-12
            continue
        sig = candidate_signals(ctx, t, prior)
        if sig and wend is not None and not ctx.before(t.id, wend) and sig == ["S2"] and \
                POST_WINDOW_SIGNALS == "S1_S3":
            sig = []                                       # after the window: openers and requests only (A2)
        if sig:
            flagged[t.id] = sig
    return build_spans(ctx, flagged)


def build_spans(ctx: CallContext, flagged: dict[str, list[str]]) -> list[Span]:
    spans: list[Span] = []
    ids = [t.id for t in ctx.turns]
    used: set[str] = set()
    for tid in [t.id for t in ctx.turns if t.id in flagged]:
        if tid in used:
            continue
        i = ids.index(tid)
        members, sig = [tid], list(flagged[tid])
        # backward merge: S3-only short tail -> previous sales turn across short approvals (GB-1)
        if flagged[tid] == ["S3"] and _words(ctx.turns[i].text) < S2_MIN_WORDS:
            j, gap = i - 1, []
            while j >= 0 and ctx.turns[j].role != SALES and short_approval(ctx.turns[j].text):
                gap.append(ctx.turns[j].id)
                j -= 1
            if j >= 0 and ctx.turns[j].role == SALES and gap and ctx.turns[j].id not in used \
                    and not ctx.turns[j].attribution_doubtful:
                members = [ctx.turns[j].id] + list(reversed(gap)) + members
        # forward merge: next sales turn is a candidate and only short approvals in between (GB-1)
        k = i + 1
        while True:
            gap = []
            while k < len(ids) and ctx.turns[k].role != SALES and short_approval(ctx.turns[k].text):
                gap.append(ids[k])
                k += 1
            if gap and k < len(ids) and ids[k] in flagged and ctx.turns[k].role == SALES:
                members += gap + [ids[k]]
                sig += [s for s in flagged[ids[k]] if s not in sig]
                k += 1
                continue
            break
        used.update(members)
        sales = [m for m in members if ctx.turn(m).role == SALES]
        spans.append(Span(sales[0], sales[-1], members, sig))
    return spans


def offer_cut(ctx: CallContext, span: Span) -> Optional[tuple[str, int]]:
    """GB-1 / GB-5: position of the first offer word inside the span (sales turns)."""
    for tid in span.turns:
        t = ctx.turn(tid)
        if t.role != SALES:
            continue
        m = OFFER_WORDS.search(norm(t.text))
        if m:
            return tid, m.start()
    return None


def _before_cut(ctx: CallContext, tid: str, quote: str, cut: Optional[tuple[str, int]]) -> bool:
    if cut is None:
        return True
    if ctx.n(tid) != ctx.n(cut[0]):
        return ctx.n(tid) < ctx.n(cut[0])
    i = norm(ctx.turn(tid).text).find(norm(quote))
    return 0 <= i < cut[1]


# ------------------------------------------------------------------------------------------- clause decision
def _atoms_in(ctx: CallContext, tid: str) -> list[Atom]:
    return [a for a in ctx.atoms if a.evidence and a.evidence.turn == tid]


def _atom_with(ctx: CallContext, tid: str, ke: str, types: Optional[set] = None) -> Optional[Atom]:
    kc = canon(clean_tokens(ke), False)
    hits = [a for a in _atoms_in(ctx, tid) if (types is None or a.type in types)
            and _contains(canon(clean_tokens(a.evidence.quote), False), kc)]
    return hits[0] if hits else None


def first_said_by_sales(ctx: CallContext, ke: str, source_turn: str) -> bool:
    """X12 / GB-24: words or figures first stated by the sales and only taken up by the prospect.
    Applied to figures and to key expressions of 2 content words or more (a single head word reused by the
    sales from the prospect belongs to the prospect: anchoring, C3 rule 6)."""
    toks = clean_tokens(ke)
    if not (_has_figure(toks) or len(_content_tokens(toks)) >= 2):
        return False
    k_sales, k_pros = canon(toks, True), canon(toks, False)
    try:
        src_n = ctx.n(source_turn)
    except KeyError:
        return False
    for t in ctx.turns[:src_n]:
        if t.attribution_doubtful:
            continue
        hay = canon(clean_tokens(t.text), False)
        if t.role == PROSPECT and _contains(hay, k_pros):
            return False
        if t.role == SALES and _contains(hay, k_sales):
            return True
    return False


def _source_text(ctx: CallContext, src: str) -> tuple[Optional[str], str]:
    """Returns (text, error). Sources: an earlier PROSPECT turn, or PRIOR<k> (GB-13 / GB-19)."""
    if src.upper().startswith("PRIOR"):
        try:
            p = ctx.prior_inputs[int(src[5:])]
        except (ValueError, IndexError):
            return None, "unknown_source"
        if p.get("kind") not in PRIOR_SOURCE_KINDS or not p.get("text"):
            return None, "not_prospect_words"            # GB-19: setter notes, CRM summaries
        return p["text"], ""
    try:
        t = ctx.turn(src)
    except KeyError:
        return None, "unknown_source"
    if t.role != PROSPECT:
        return None, "source_not_prospect"
    if t.attribution_doubtful:
        return None, "source_attribution_doubtful"
    return t.text, ""


def classify_clause(ctx: CallContext, raw: dict, span: Span, cut: Optional[tuple[str, int]]) -> Clause:
    """GB-3 / GB-22 decision of one clause (code). Only a verbatim clause is a component."""
    c = Clause(raw.get("component", ""), raw.get("sales_quote", ""), raw.get("sales_turn", ""),
               raw.get("source_turn"), raw.get("key_expression"),
               as_holding_back=bool(raw.get("as_holding_back")))
    if not raw.get("about_prospect", True):
        c.match, c.reason = "excluded", "other_person"                     # GB-3 a, GB-6, X4
        return c
    if raw.get("declarative") is False:
        c.match, c.reason = "excluded", "not_declarative"                  # GB-3 b
        return c
    if not _before_cut(ctx, c.sales_turn, c.sales_quote, cut):
        c.match, c.reason = "excluded", "after_offer_words"                # GB-1, GB-5
        return c
    if not c.source_turn or not c.key_expression:
        c.match, c.reason = "untraced", "no_source"                        # X5
        return c
    src_text, err = _source_text(ctx, c.source_turn)
    if src_text is None:
        c.match, c.reason = "untraced", err
        return c
    if not c.source_turn.upper().startswith("PRIOR") and not ctx.before(c.source_turn, span.start):
        c.match, c.reason = "untraced", "source_not_earlier"
        return c
    ok, why = key_expression_ok(c.key_expression, src_text, c.sales_quote)  # GB-22 a, b, d
    if not ok:
        c.match, c.reason = "paraphrased", why                             # X11
        return c
    if first_said_by_sales(ctx, c.key_expression, c.source_turn):
        c.match, c.reason = "excluded", "first_said_by_sales"              # X12, GB-24
        return c
    atom = None if c.source_turn.upper().startswith("PRIOR") else \
        _atom_with(ctx, c.source_turn, c.key_expression)
    if atom is not None and atom.prompted_by_sales:
        c.match, c.reason = "excluded", "prompted_by_sales"                # X10
        return c
    if c.component == "COST" and atom is not None and atom.type == "SITUATION":
        other = _atom_with(ctx, c.source_turn, c.key_expression, {"IMPACT", "PAIN", "BLOCKER"})
        if other is None:
            c.match, c.reason = "excluded", "income_not_cost"              # X6, GB-7
            return c
        atom = other
    typed = _atom_with(ctx, c.source_turn, c.key_expression, COMP_TYPES.get(c.component)) \
        if not c.source_turn.upper().startswith("PRIOR") else None
    atom = typed or atom
    c.match, c.reason = "verbatim", "ok"
    c.source_atom = atom.id if atom else None
    c.source_quote = atom.evidence.quote if atom else _sentence_with(src_text, c.key_expression)
    c.object = (atom.object if atom and atom.object else None) or norm(c.key_expression)
    c.explicit_quote = bool(QUOTING_MARKER.search(norm(c.sales_quote)))  # GB-23 (recorded only when verbatim)
    return c


def _sentence_with(text: str, ke: str) -> str:
    for s in sentences(text):
        if norm(ke) in norm(s):
            return s
    return ke


def decide_restitution(ctx: CallContext, span: Span, ans: Optional[dict], status: str, conc: str = "") -> Restitution:
    """GB-1..GB-7 decision of one candidate from the model clauses (code)."""
    wend = window_end(ctx)
    r = Restitution(span, status, conc)
    r.after_pitch = bool(ctx.phases.pitch_start) and not ctx.before(span.end, ctx.phases.pitch_start)
    r.after_price = bool(ctx.phases.first_price) and not ctx.before(span.end, ctx.phases.first_price)
    if wend is None:
        r.after_pitch = r.after_price = False
    r.offer_cut = offer_cut(ctx, span)
    last_sales = ctx.turn(span.end)
    r.request = validation_request(last_sales.text)
    if ans is None:
        return r
    r.clauses = [classify_clause(ctx, c, span, r.offer_cut) for c in ans.get("clauses", [])
                 if c.get("component") in COMPONENTS]
    r.new_topic_question = ans.get("new_topic_question_quote") if ans.get("ends_with_new_topic_question") else None
    r.is_restitution = len(r.components) >= 2                              # GB-4, X2
    return r


# ------------------------------------------------------------------------------------------- 4. validation
def validation_turn(ctx: CallContext, r: Restitution) -> tuple[Optional[Turn], str]:
    """GB-8: the prospect's turn right after the span. Returns (turn, reason_if_none)."""
    if r.new_topic_question:
        last = norm(ctx.turn(r.span.end).text)
        qi = last.find(norm(r.new_topic_question))
        ri = last.rfind(norm(r.request)) if r.request else -1
        if not (r.request and ri > qi and norm(r.new_topic_question) not in norm(r.request)):
            return None, "captured_by_other_question"                      # GB-9, X7 (S3 request last wins, GB-8)
    if r.offer_cut is not None:
        req_before_offer = r.request and _before_cut(ctx, r.span.end, r.request, r.offer_cut)
        if not req_before_offer:
            return None, "offer_mentioned_before_validation"               # GB-5, X8
    i = ctx.n(r.span.end) + 1
    if i >= len(ctx.turns):
        return None, "no_response"
    t = ctx.turns[i]
    if t.role == SALES:
        return None, "sales_continued"                                     # topic change before the prospect answers
    if t.attribution_doubtful:
        return None, "attribution_doubtful"                                # GB-12, GB-21
    return t, ""


def _is_repetition(content: str, restitution_text: str) -> bool:
    """GB-26: added content that only repeats the sales' words is not content of the prospect's own."""
    ct = _content_tokens(canon(clean_tokens(content), True))
    if not ct:
        return True
    hay = set(canon(clean_tokens(restitution_text), False))
    return all(w in hay for w in ct)


def decide_validation(ctx: CallContext, r: Restitution, vt: Optional[Turn], ans: Optional[dict]) -> dict:
    """GB-10 outcome decided by code from the model's closed answers (GB-15, GB-16, GB-17, GB-26)."""
    out = {"outcome": "none", "turn": vt.id if vt else None, "quote": None, "content_quote": None,
           "corrected_components": [], "correction_quote": None, "rule": ""}
    if vt is None or ans is None:
        return out
    outcome = ans.get("outcome") if ans.get("outcome") in OUTCOMES else "none"
    if vt.role == OTHER and not ans.get("addressed_co_decider"):
        out["rule"] = "GB-12"
        return out
    if ans.get("answers_other_question"):
        out["rule"] = "GB-9"
        return out
    out["quote"] = ans.get("agreement_quote") or vt.text
    text = vt.text
    rest_text = " ".join(ctx.turn(x).text for x in r.span.turns if ctx.turn(x).role == SALES)
    if ans.get("emotional_reaction"):                                      # GB-17
        if ans.get("disagreement"):
            outcome = "rejected"
        elif outcome in ("confirmed", "confirmed_with_content", "none"):
            outcome = "confirmed_with_content"
            out["content_quote"] = ans.get("content_quote") or ans.get("agreement_quote") or text
            out["rule"] = "GB-17"
    if outcome == "rejected" and approval_only(text) and r.request and MISSING_REQUEST.search(norm(r.request)):
        outcome, out["rule"] = "confirmed", "GB-15"                       # "No" to "did I miss anything?"
    if outcome in ("confirmed", "confirmed_with_content") and ans.get("correction_quote"):
        outcome, out["rule"] = "corrected", "GB-16"                       # agreement with a qualifier + correction
    if outcome == "confirmed_with_content" and out["rule"] != "GB-17":
        cq = ans.get("content_quote")
        if approval_only(text) or not cq or quote_ok(ctx, Evidence(cq, vt.id, vt.role), min_words=2,
                                                     max_words=QUOTE_MAX_WORDS):
            outcome, out["rule"] = "confirmed", "C3-5"                    # approval is not content
        elif ans.get("content_is_repetition") or _is_repetition(cq, rest_text):
            outcome, out["rule"] = "confirmed", "GB-26"
        else:
            out["content_quote"] = cq
    if outcome == "corrected":
        out["corrected_components"] = [c for c in ans.get("corrected_components", []) if c in COMPONENTS]
        out["correction_quote"] = ans.get("correction_quote")
    out["outcome"] = outcome
    return out


def resolve_corrections(rs: list[Restitution]) -> None:
    """GB-10 / GB-25 / X9: a corrected restitution is validated only if the next restitution restates the
    correction verbatim (a component whose source is the correcting turn) and is confirmed. The restating
    restitution itself must restate the correction to pass."""
    for i, r in enumerate(rs):
        r.effective_outcome = r.validation.get("outcome") if r.is_restitution else None
    for i, r in enumerate(rs):
        if not r.is_restitution or r.validation.get("outcome") != "corrected":
            continue
        vt = r.validation.get("turn")
        nxt = next((x for x in rs[i + 1:] if x.is_restitution), None)
        if nxt is None:
            r.effective_outcome = "corrected_not_restated"
            continue
        restates = any(c.match == "verbatim" and c.source_turn == vt for c in nxt.clauses)
        if restates:
            nxt.restates_correction_of = r.span.uid
            if nxt.validation.get("outcome") in VALIDATED:
                r.effective_outcome = "corrected_then_confirmed"
        else:
            r.effective_outcome = "corrected_not_restated"
            if nxt.effective_outcome in VALIDATED:
                nxt.effective_outcome = "correction_not_restated"         # GB-25: the gate fails (X9)


# ------------------------------------------------------------------------------------------- 5. gate
def passes(r: Restitution) -> bool:
    return r.is_restitution and {"PROBLEM", "COST"} <= r.components and \
        r.effective_outcome in (VALIDATED | {"corrected_then_confirmed"})


def gate(rs: list[Restitution]) -> tuple[str, list[str], list[Restitution]]:
    """§5.1 absence gate + GB-20. Returns (verdict, reasons [main first], passing pre-pitch restitutions)."""
    real = [r for r in rs if r.is_restitution]
    pre = [r for r in real if r.before_pitch]
    post = [r for r in real if not r.before_pitch]
    ok = [r for r in pre if passes(r)]
    if ok:
        return "present", [], ok
    failed: list[str] = []
    post_pass = any(passes(r) for r in post)
    if not pre:
        failed.append("restitution_after_pitch" if post and (post_pass or not AFTER_PITCH_REASON_REQUIRES_PASSING)
                      else "no_restitution")
    else:
        if post_pass:
            failed.append("restitution_after_pitch")                       # GB-20 example
        has_p = any("PROBLEM" in r.components for r in pre)
        has_c = any("COST" in r.components for r in pre)
        if not has_p:
            failed.append("problem_missing")
        if not has_c:
            failed.append("cost_missing")
        if any({"PROBLEM", "COST"} <= r.components for r in pre):
            failed.append("not_validated")                                 # check 3 failed on every P+C one
        elif has_p and has_c:
            failed += ["problem_missing", "cost_missing"]                  # never pooled across restitutions (GB-2)
    failed = sorted(set(failed), key=REASON_PRIORITY.index)
    return "absent", failed, []


# ------------------------------------------------------------------------------------------- formula conformity
def _matches(c: Clause, s: Optional[Statement]) -> bool:
    if s is None or c.match != "verbatim":
        return False
    if c.source_atom and c.source_atom == s.atom_id:
        return True
    return c.source_turn == s.turn and _contains(canon(clean_tokens(s.quote), False),
                                                 canon(clean_tokens(c.key_expression or ""), False))


def formula_conformity(ctx: CallContext, r: Restitution, sel_a: Optional[Statement], sel_b: Optional[Statement],
                       sel_p: Optional[Statement]) -> dict:
    """GB-31: selected A, selected B, one single blocker which is the selected P, all verbatim."""
    v = [c for c in r.clauses if c.match == "verbatim"]
    a_cl = [c for c in v if c.component == "A"]
    b_cl = [c for c in v if c.component == "B"]
    p_cl = [c for c in v if c.component == "PROBLEM"]
    held = [c for c in r.clauses if c.component == "PROBLEM" and c.as_holding_back and c.match == "verbatim"] or p_cl
    objs = {norm(c.object or c.key_expression or "") for c in held}
    dev = []
    a_ok = any(_matches(c, sel_a) for c in a_cl)
    b_ok = any(_matches(c, sel_b) for c in b_cl)
    if not a_cl:
        dev.append("A_missing")
    elif not a_ok:
        dev.append("A_not_selected")
    if not b_cl:
        dev.append("B_missing")
    elif not b_ok:
        dev.append("B_not_selected")
    units = {}
    for comp, cls in (("A", a_cl), ("B", b_cl)):
        for c in cls:
            at = next((x for x in ctx.atoms if x.id == c.source_atom), None)
            if at is not None and at.quantified and at.unit:
                units[comp] = _unit(at.unit)
    if len(units) == 2 and units["A"] != units["B"]:
        dev.append("unit_mismatch")
    single = len(objs) == 1
    if len(objs) >= 2:
        dev.append("several_blockers")                                     # X14
    p_ok = single and sel_p is not None and (any(_matches(c, sel_p) for c in held) or
                                             (sel_p.object and norm(sel_p.object) in objs))
    if p_cl and single and not p_ok:
        dev.append("P_not_selected")
    long_ke = any(len(clean_tokens(c.key_expression or "")) >= LONG_KEY_EXPRESSION_WORDS or
                  _has_figure(clean_tokens(c.key_expression or "")) for c in v)
    conforms = a_ok and b_ok and p_ok and "unit_mismatch" not in dev and "COST" in r.components
    return {"A": a_ok, "B": b_ok, "single_P": single, "P_selected": p_ok, "long_key_expression": long_ke,
            "conforms": conforms, "deviations": dev}


# ------------------------------------------------------------------------------------------- scoring
def score_items(ctx: CallContext, r: Optional[Restitution], sel_a: Optional[Statement],
                sel_b: Optional[Statement], horizon: Optional[dict], sel_p: Optional[Statement],
                conf: Optional[dict], sol_by_id: dict[str, Solicitation]) -> list[ItemScore]:
    """§5.2 items G1..G6 with the two-quote rule (C3 rule 4)."""
    def sol_ev(s: Optional[Statement]) -> Optional[Evidence]:
        q = sol_by_id.get(s.solicitation) if s and s.solicitation else None
        return Evidence(q.text, q.turn, SALES) if q else None

    same_unit = bool(sel_a and sel_b and sel_a.quantified and sel_b.quantified and sel_a.unit and
                     _unit(sel_a.unit) == _unit(sel_b.unit))
    items = []
    # G1 point A
    if sel_a is None:
        g1, ev1 = 0, []
    else:
        on_dim = sel_b is None or not sel_b.quantified or same_unit
        g1 = 2 if (sel_a.quantified and on_dim) else 1
        ev1 = [Evidence(sel_a.quote, sel_a.turn, PROSPECT), sol_ev(sel_a)]
    items.append(item("G1", WEIGHTS["G1"], g1, ev1, "selected A (GB-28)"))
    # G2 point B
    if sel_b is None:
        g2, ev2, note2 = 0, [], "no B in N answers (GB-29)"
    else:
        hz = horizon or {}
        g2 = 1
        if sel_b.quantified and same_unit and (hz.get("quote") or not G2_REQUIRES_HORIZON):
            g2 = 2
        ev2 = [Evidence(sel_b.quote, sel_b.turn, PROSPECT),
               _ev(hz, PROSPECT) if hz.get("quote") else sol_ev(sel_b)]
        note2 = "horizon: " + (hz.get("horizon") or hz.get("quote") or "none")
    items.append(item("G2", WEIGHTS["G2"], g2, ev2, note2))
    # G3 measurable gap
    g3 = 2 if same_unit and sel_a.value is not None and sel_b.value is not None else 0
    items.append(item("G3", WEIGHTS["G3"], g3,
                      [Evidence(sel_a.quote, sel_a.turn, PROSPECT), Evidence(sel_b.quote, sel_b.turn, PROSPECT)]
                      if g3 else [], "same unit, gap_value computable" if g3 else "no quantified A and B in one unit"))
    # G4 cost of the problem (on the prospect's own cost statement restated verbatim)
    g4, ev4, note4 = 0, [], "no verbatim cost"
    if r is not None:
        best = None
        for c in (x for x in r.clauses if x.component == "COST" and x.match == "verbatim"):
            at = next((a for a in ctx.atoms if a.id == c.source_atom), None)
            lvl = 0
            if at is not None and at.quantified and not _sales_figure(ctx, at):
                lvl = 2
            elif at is not None and (at.domain or "").lower() in COST_DOMAINS:
                lvl = 1
            if best is None or lvl > best[0]:
                best = (lvl, c, at)
        if best:
            g4, c, at = best
            ev4 = [Evidence(c.sales_quote, c.sales_turn, SALES),
                   Evidence(at.evidence.quote, at.evidence.turn, PROSPECT) if at else
                   Evidence(c.source_quote or "", c.source_turn or "", PROSPECT)]
            note4 = f"cost statement {'quantified' if g4 == 2 else 'domain ' + str(at.domain) if at else 'generic'}"
    items.append(item("G4", WEIGHTS["G4"], g4, ev4, note4))
    # G5 restitution quality
    if r is None:
        items.append(item("G5", WEIGHTS["G5"], 0, [], "no restitution"))
    else:
        lvl = 2 if conf and conf["conforms"] and conf["long_key_expression"] else 1
        ev5 = []
        for c in r.clauses:
            if c.match == "verbatim":
                ev5.append(Evidence(c.sales_quote, c.sales_turn, SALES))
                ev5.append(Evidence(c.key_expression or "", c.source_turn or "", PROSPECT))
        note5 = "formula complete (GB-31)" if lvl == 2 else "deviations: " + ", ".join((conf or {}).get(
            "deviations", []) or (["no key expression of 3 words or a prospect figure"]))
        items.append(item("G5", WEIGHTS["G5"], lvl, ev5, note5))
    # G6 validation
    if r is None:
        items.append(item("G6", WEIGHTS["G6"], 0, [], "no validation"))
    else:
        v = r.validation
        lvl = 2 if r.effective_outcome == "confirmed_with_content" else 1
        ev6 = [Evidence(ctx.turn(r.span.end).text if not r.request else r.request, r.span.end, SALES)]
        if v.get("content_quote") and v.get("turn"):
            ev6.append(Evidence(v["content_quote"], v["turn"], PROSPECT))
        elif v.get("quote") and v.get("turn"):
            ev6.append(Evidence(v["quote"], v["turn"], PROSPECT))
        items.append(item("G6", WEIGHTS["G6"], lvl, ev6, f"outcome {r.effective_outcome}"))
    return items


def _sales_figure(ctx: CallContext, at: Atom) -> bool:
    """GB-24 / X10: a figure first stated or computed by the sales never counts for G1..G4."""
    figs = [w for w in clean_tokens(at.evidence.quote) if re.search(r"\d", w)]
    return bool(figs) and all(first_said_by_sales(ctx, f, at.evidence.turn) for f in figs)


# ------------------------------------------------------------------------------------------- model tasks
def _render_statements(st: dict[str, list[Statement]]) -> str:
    lines = []
    for comp in COMPONENTS:
        for s in st[comp]:
            lines.append(f"- {comp} atom={s.atom_id} [{s.turn}] \"{s.quote}\"")
    return "\n".join(lines) or "(none)"


def _span_from_uid(ctx: CallContext, uid: str) -> tuple[str, str]:
    _, a, b = uid.split(":", 2)
    return a, b


def build_restitution(ctx: CallContext, unit: tuple[Span, dict]) -> str:
    span, st = unit
    lo = ctx.n(span.start)
    hi = min(len(ctx.turns), ctx.n(span.end) + 2)
    earlier = [t for t in ctx.window(ctx.phases.discovery_start, span.start) if t.role == PROSPECT]
    return (f"CANDIDATE SPAN: {span.start} to {span.end} (inventory signals: {', '.join(span.signals)})\n"
            "List every clause of the SALES turns of the span that restates one component (PROBLEM, COST, A, B) of "
            "the gap. For each clause give the exact sales words, the earlier PROSPECT turn it restates (or "
            "PRIOR<k> for a prior input), and the KEY EXPRESSION: the prospect's words, copied from that source "
            "turn, that the sales repeats. If the sales uses other words, still give the closest source and copy the "
            "prospect's words exactly; the code decides whether they match. Then say whether the span ends on a "
            "question on a new topic.\n"
            "JSON: {\"clauses\": [{\"component\": \"PROBLEM|COST|A|B\", \"sales_turn\": \"T081\", \"sales_quote\": "
            "\"...\", \"about_prospect\": bool, \"declarative\": bool, \"source_turn\": \"T052\"|null, "
            "\"key_expression\": \"...\"|null, \"as_holding_back\": bool}], \"ends_with_new_topic_question\": bool, "
            "\"new_topic_question_quote\": \"...\"|null}\n\n"
            "PROSPECT STATEMENTS ALREADY EXTRACTED\n" + _render_statements(st) +
            "\n\nEARLIER PROSPECT TURNS\n" + ctx.render(earlier) +
            "\n\nSPAN AND NEXT TURN\n" + ctx.render(ctx.turns[lo:hi]))


def validate_restitution(ans: dict, ctx: CallContext, unit_id: str) -> list[str]:
    a, b = _span_from_uid(ctx, unit_id)
    allowed = {t.id for t in ctx.turns[ctx.n(a): ctx.n(b) + 1] if t.role == SALES}
    errs = []
    if not isinstance(ans.get("clauses", []), list):
        return ["bad_schema"]
    for c in ans.get("clauses", []):
        if c.get("component") not in COMPONENTS:
            errs.append("bad_component")
            continue
        if c.get("sales_turn") not in allowed:
            errs.append(f"sales_turn_outside_span:{c.get('sales_turn')}")
            continue
        e = quote_ok(ctx, Evidence(c.get("sales_quote", ""), c["sales_turn"], SALES), min_words=2,
                     max_words=QUOTE_MAX_WORDS)
        if e:
            errs.append(f"{e}:{c['sales_turn']}")
        src = c.get("source_turn")
        if src and not str(src).upper().startswith("PRIOR"):
            try:
                ctx.turn(src)
            except KeyError:
                errs.append(f"unknown_turn:{src}")
    if ans.get("ends_with_new_topic_question"):
        q = ans.get("new_topic_question_quote") or ""
        if quote_ok(ctx, Evidence(q, b, SALES), min_words=2, max_words=QUOTE_MAX_WORDS):
            errs.append("bad_new_topic_question_quote")
    return errs


def key_restitution(ans: dict) -> Any:
    return [sorted((c.get("component"), c.get("sales_turn"), c.get("source_turn") or "",
                    bool(c.get("about_prospect", True)), c.get("declarative", True) is not False,
                    bool(c.get("as_holding_back"))) for c in ans.get("clauses", [])),
            bool(ans.get("ends_with_new_topic_question"))]


def build_validation(ctx: CallContext, unit: tuple[Restitution, Turn]) -> str:
    r, vt = unit
    lo = ctx.n(r.span.start)
    return (f"RESTITUTION: {r.span.start} to {r.span.end}. VALIDATION TURN: {vt.id}\n"
            "Read the VALIDATION TURN as the response to the restitution, with the validation rules.\n"
            "JSON: {\"outcome\": \"confirmed_with_content|confirmed|corrected|rejected|none\", "
            "\"agreement_quote\": \"...\"|null, \"content_quote\": \"...\"|null, \"content_is_repetition\": bool, "
            "\"corrected_components\": [\"A\"], \"correction_quote\": \"...\"|null, \"emotional_reaction\": bool, "
            "\"disagreement\": bool, \"answers_other_question\": bool, \"addressed_co_decider\": bool}\n\n"
            "TURNS\n" + ctx.render(ctx.turns[lo: ctx.n(vt.id) + 1]))


def validate_validation(ans: dict, ctx: CallContext, unit_id: str) -> list[str]:
    vt = unit_id.split(":")[-1]
    if ans.get("outcome") not in OUTCOMES:
        return ["bad_outcome"]
    errs = []
    role = ctx.turn(vt).role
    for k in ("agreement_quote", "content_quote", "correction_quote"):
        q = ans.get(k)
        if q:
            e = quote_ok(ctx, Evidence(q, vt, role), min_words=1, max_words=QUOTE_MAX_WORDS)
            if e:
                errs.append(f"{k}:{e}")
    if ans.get("outcome") == "corrected" and not ans.get("correction_quote"):
        errs.append("correction_quote_missing")
    return errs


def key_validation(ans: dict) -> Any:
    return [ans.get("outcome"), bool(ans.get("content_quote")), sorted(ans.get("corrected_components", []) or []),
            bool(ans.get("emotional_reaction")), bool(ans.get("disagreement")), bool(ans.get("answers_other_question"))]


def build_a_current(ctx: CallContext, s: Statement) -> str:
    t = ctx.turn(s.turn)
    q = next((x for x in ctx.solicitations if x.id == s.solicitation), None)
    return (f"PROSPECT FIGURE: \"{s.quote}\" in {s.turn}\n"
            "Does this figure describe where the prospect is NOW (present state), as opposed to a past state "
            "(\"I used to make\"), savings, a budget, a mortgage or a debt balance?\n"
            "JSON: {\"present_state\": bool, \"quote\": \"exact words of the turn that show it\"}\n\n"
            + (f"[{q.turn}] SALES: {q.text}\n" if q else "") + f"[{t.id} {t.ts}] {t.role}: {t.text}")


def validate_a_current(ans: dict, ctx: CallContext, unit_id: str) -> list[str]:
    if not isinstance(ans.get("present_state"), bool):
        return ["bad_schema"]
    tid = unit_id.split(":")[-1]
    if ans.get("quote"):
        e = quote_ok(ctx, Evidence(ans["quote"], tid, PROSPECT), min_words=1, max_words=QUOTE_MAX_WORDS)
        return [e] if e else []
    return []


def build_stopping(ctx: CallContext, q: Solicitation) -> str:
    return (f"SALES SOLICITATION {q.id} in {q.turn}: \"{q.text}\"\n"
            "Is this a stopping question: does the sales ask what stops the prospect, what has held them back, "
            "what gets in the way, or why they have not done it yet?\n"
            "JSON: {\"is_stopping_question\": bool, \"quote\": \"exact words of the question\"|null}")


def validate_stopping(ans: dict, ctx: CallContext, unit_id: str) -> list[str]:
    if not isinstance(ans.get("is_stopping_question"), bool):
        return ["bad_schema"]
    if ans["is_stopping_question"]:
        tid = unit_id.split(":")[-1]
        e = quote_ok(ctx, Evidence(ans.get("quote") or "", tid, SALES), min_words=2, max_words=QUOTE_MAX_WORDS)
        return [e] if e else []
    return []


def build_horizon(ctx: CallContext, unit: tuple[Statement, list[str]]) -> str:
    s, tids = unit
    return (f"TARGET (point B): \"{s.quote}\" in {s.turn}\n"
            "Did the prospect attach a deadline or a duration to this target, in the same answer or a following "
            "answer below? Is it binding (external, verifiable) or wished?\n"
            "JSON: {\"horizon_quote\": \"...\"|null, \"horizon_turn\": \"T102\"|null, \"horizon\": "
            "\"words of the deadline as said\"|null, \"binding\": bool|null}\n\n"
            + ctx.render([ctx.turn(t) for t in tids]))


def validate_horizon(ans: dict, ctx: CallContext, unit_id: str) -> list[str]:
    if ans.get("horizon_quote"):
        e = quote_ok(ctx, Evidence(ans["horizon_quote"], ans.get("horizon_turn") or "", PROSPECT), min_words=1,
                     max_words=QUOTE_MAX_WORDS)
        return [e] if e else []
    return []


RESTITUTION = ModelTask("gap.restitution", "strong", "gap_restitution", build_restitution, validate_restitution,
                        key_restitution)
VALIDATION = ModelTask("gap.validation", "strong", "gap_validation", build_validation, validate_validation,
                       key_validation)
A_CURRENT = ModelTask("gap.a_current", "fast", "gap_a_current", build_a_current, validate_a_current,
                      key=lambda a: bool(a.get("present_state")))
STOPPING = ModelTask("gap.stopping", "fast", "gap_stopping", build_stopping, validate_stopping,
                     key=lambda a: bool(a.get("is_stopping_question")))
HORIZON = ModelTask("gap.horizon", "fast", "gap_horizon", build_horizon, validate_horizon,
                    key=lambda a: [bool(a.get("horizon_quote")), a.get("binding")])


# ------------------------------------------------------------------------------------------- competence
class GapCompetence:
    name = NAME
    rules_version = RULES_VERSION

    def run(self, ctx: CallContext, runner: Runner) -> CompetenceResult:
        res = CompetenceResult(NAME, RULES_VERSION)
        wend = window_end(ctx)
        concs: list[str] = []
        to_review: list[str] = []

        # ---- restitution inventory (code) and model clauses
        st_all = statements_from_atoms(ctx, wend)
        spans = self.candidate_spans(ctx)
        rs: list[Restitution] = []
        for sp in spans:
            r = self._run_span(ctx, runner, sp, st_all, concs, to_review)
            rs.append(r)

        # ---- applicability (§4)
        if not ctx.phases.discovery_start and not any(r.is_restitution for r in rs) and wend is None:
            res.status, res.reasons = "not_applicable", ["no_discovery_no_restitution_no_pitch"]
            return res

        # ---- validations (+ post-correction candidate, GB-10 / GB-25)
        i = 0
        while i < len(rs):
            r = rs[i]
            if r.is_restitution:
                self._validate(ctx, runner, r, concs, to_review)
                if r.validation.get("outcome") == "corrected" and r.validation.get("turn"):
                    nxt = self._next_sales_turn(ctx, r.validation["turn"])
                    if nxt and not any(nxt in x.span.turns for x in rs):
                        sp = build_spans(ctx, {nxt: ["S4_post_correction"]})[0]
                        rs.insert(i + 1, self._run_span(ctx, runner, sp, st_all, concs, to_review))
            i += 1
        resolve_corrections(rs)

        # ---- gap formula (GB-28..GB-33), cutoff = first restitution (or window end)
        first = next((r.span.start for r in rs if r.is_restitution and r.before_pitch), None)
        cutoff = first or wend
        st = statements_from_atoms(ctx, cutoff)
        not_present = self._a_present_check(ctx, runner, st, cutoff, concs)
        A = a_candidates(ctx, st, cutoff, not_present)
        B, B_out = b_candidates(ctx, st, cutoff)
        sel_a, sel_b, ab_rule = select_a_b(ctx, A, B)
        P = [s for s in st["PROBLEM"] if s.letter == "P"]
        stopping = self._stopping_questions(ctx, runner, P, concs)
        before_atoms = [a for a in ctx.atoms if a.evidence and ctx.before(a.evidence.turn, cutoff)
                        and a.type in ("PAIN", "BLOCKER", "IMPACT")]
        sel_p, p_rule = select_p(ctx, P, stopping, before_atoms)
        horizon = self._horizon(ctx, runner, sel_b, cutoff, concs) if sel_b else None
        blockers = roadmap_blockers(ctx, ctx.phases.pitch_start or wend, sel_p)
        warn = copilot_warning(blockers)
        if warn:
            res.flags.append("roadmap_insufficient_blockers")              # GB-33

        # ---- gate and items
        verdict, reasons, ok = gate(rs)
        for r in rs:
            r.conformity = formula_conformity(ctx, r, sel_a, sel_b, sel_p) if r.is_restitution else None
        scored = ok[-1] if ok else None                                    # GB-11: last passing restitution
        sol_by_id = {q.id: q for q in ctx.solicitations}
        pre = [r for r in rs if r.is_restitution and r.before_pitch]
        diag_r = scored or (pre[-1] if pre else None)
        items = score_items(ctx, diag_r, sel_a, sel_b, horizon, sel_p, (diag_r.conformity if diag_r else None),
                            sol_by_id)
        if verdict == "present":
            res.items, res.score = items, call_score(items)
        else:
            res.score = 0
            res.items = [ItemScore(x.id, x.weight, 0, [], "gap absent (absence gate, §5.1)") for x in items]
        res.verdict, res.reasons = verdict, reasons
        pending_pre = [u for u in to_review if not self._unit_after_pitch(ctx, u)]
        if verdict == "absent" and pending_pre:
            res.status = "to_review"
            res.flags.append("units_to_review:" + ",".join(pending_pre))
        elif to_review:
            res.flags.append("units_to_review:" + ",".join(to_review))
        res.concordance = min(concs, key=lambda c: _conc_rank(c)) if concs else None
        res.details = self._details(ctx, rs, verdict, reasons, scored, diag_r, items, sel_a, sel_b, sel_p, ab_rule,
                                    p_rule, horizon, blockers, warn, st, B_out)
        return res

    def candidate_spans(self, ctx: CallContext) -> list[Span]:
        """A1 inventory (code). The lite engine (call-analysis/lite) adds the passages its model step found."""
        return inventory(ctx)

    # ---------------------------------------------------------------- steps
    def _run_span(self, ctx, runner, sp, st, concs, to_review) -> Restitution:
        uid = f"restit:{sp.uid}"
        rr = runner.run(ctx, RESTITUTION, uid, (sp, st))
        concs.append(rr.concordance)
        if rr.answer is None:
            to_review.append(uid)
        return decide_restitution(ctx, sp, rr.answer, rr.status, rr.concordance)

    def _validate(self, ctx, runner, r: Restitution, concs, to_review) -> None:
        vt, why = validation_turn(ctx, r)
        if vt is None:
            r.validation = {"outcome": "none", "turn": None, "quote": None, "rule": why}
            return
        uid = f"valid:{r.span.uid}:{vt.id}"
        rr = runner.run(ctx, VALIDATION, uid, (r, vt))
        concs.append(rr.concordance)
        if rr.answer is None:
            to_review.append(uid)
        r.validation = decide_validation(ctx, r, vt, rr.answer)

    @staticmethod
    def _next_sales_turn(ctx, tid) -> Optional[str]:
        for t in ctx.turns[ctx.n(tid) + 1:]:
            if t.role == SALES and not t.attribution_doubtful:
                return t.id
            if t.role == PROSPECT and not short_approval(t.text):
                return None
        return None

    def _a_present_check(self, ctx, runner, st, cutoff, concs) -> set[str]:
        """X13: a quantified A candidate must describe the present (not a past income, savings, a budget)."""
        out = set()
        for s in a_candidates(ctx, st, cutoff):
            if not s.quantified:
                continue
            rr = runner.run(ctx, A_CURRENT, f"acur:{s.atom_id}:{s.turn}", s)
            concs.append(rr.concordance)
            if rr.answer is not None and rr.answer.get("present_state") is False:
                out.add(s.atom_id)
        return out

    def _stopping_questions(self, ctx, runner, P, concs) -> list[Solicitation]:
        """GB-30 step 1: P solicitations that ask what stops the prospect (regex, else one closed question)."""
        ids = {s.solicitation for s in P}
        out = []
        for q in sorted((x for x in ctx.solicitations if x.letter == "P" and x.id in ids),
                        key=lambda x: ctx.n(x.turn)):
            if STOPPING_Q.search(norm(q.text)):
                out.append(q)
                continue
            rr = runner.run(ctx, STOPPING, f"stop:{q.id}:{q.turn}", q)
            concs.append(rr.concordance)
            if rr.answer and rr.answer.get("is_stopping_question"):
                out.append(q)
        return out

    def _horizon(self, ctx, runner, b: Statement, cutoff, concs) -> Optional[dict]:
        """GB-29: horizon in the same or a following N answer."""
        tids = [b.turn]
        nq = sorted((q for q in ctx.solicitations if q.letter == "N" and ctx.n(q.turn) >= ctx.n(b.turn) - 1),
                    key=lambda q: ctx.n(q.turn))
        for q in nq:
            for t in q.answer_turns:
                if t not in tids and ctx.n(t) >= ctx.n(b.turn) and ctx.before(t, cutoff):
                    tids.append(t)
        tids = sorted(tids, key=ctx.n)
        rr = runner.run(ctx, HORIZON, f"horizon:{b.atom_id}:{b.turn}", (b, tids))
        concs.append(rr.concordance)
        a = rr.answer or {}
        if not a.get("horizon_quote") or a.get("horizon_turn") not in tids:
            return {"quote": None, "turn": None, "horizon": None, "binding": None}
        return {"quote": a["horizon_quote"], "turn": a["horizon_turn"], "horizon": a.get("horizon"),
                "binding": a.get("binding")}

    @staticmethod
    def _unit_after_pitch(ctx, uid: str) -> bool:
        parts = uid.split(":")
        if parts[0] not in ("restit", "valid"):
            return False
        wend = window_end(ctx)
        try:
            return wend is not None and not ctx.before(parts[2], wend)
        except KeyError:
            return False

    # ---------------------------------------------------------------- output
    def _details(self, ctx, rs, verdict, reasons, scored, diag_r, items, sel_a, sel_b, sel_p, ab_rule, p_rule,
                 horizon, blockers, warn, st, B_out) -> dict:
        same_unit = bool(sel_a and sel_b and sel_a.quantified and sel_b.quantified and
                         _unit(sel_a.unit) == _unit(sel_b.unit))
        gap_value = (sel_b.value - sel_a.value) if same_unit and sel_a.value is not None and \
            sel_b.value is not None else None
        sa = sel_a.to_dict() if sel_a else None
        sb = dict(sel_b.to_dict(), horizon=(horizon or {}).get("horizon") or (horizon or {}).get("quote"),
                  binding=(horizon or {}).get("binding"), same_unit=same_unit) if sel_b else None
        sp = {"quote": sel_p.quote, "turn": sel_p.turn, "object": sel_p.object, "rule": p_rule,
              "solicitation": sel_p.letter} if sel_p else None
        validated_p = None
        if scored is not None:
            pcl = [c for c in scored.clauses if c.component == "PROBLEM" and c.match == "verbatim"]
            pick = next((c for c in pcl if _matches(c, sel_p)), pcl[0] if pcl else None)
            if pick:
                validated_p = {"quote": pick.source_quote, "turn": pick.source_turn,
                               "key_expression": pick.key_expression}
        cost = [{"domain": s.domain, "quantified": s.quantified, "quote": s.quote, "turn": s.turn}
                for s in st["COST"]]
        rest_out = []
        for r in rs:
            rest_out.append({
                "span": [r.span.start, r.span.end], "turns": r.span.turns, "signals": r.span.signals,
                "model_status": r.status, "concordance": r.concordance, "is_restitution": r.is_restitution,
                "before_first_pitch": not r.after_pitch, "before_first_price": not r.after_price,
                "components": {comp: next(({"source": c.source_turn, "key_expression": c.key_expression,
                                            "match": c.match, "explicit_quote": c.explicit_quote}
                                           for c in r.clauses if c.component == comp and c.match == "verbatim"),
                                          next(({"source": c.source_turn, "key_expression": c.key_expression,
                                                 "match": c.match} for c in r.clauses if c.component == comp),
                                               None)) for comp in COMPONENTS},
                "clauses": [c.to_dict() for c in r.clauses],
                "paraphrased_component": [c.to_dict() for c in r.clauses if c.match in ("paraphrased", "untraced")],
                "validation": r.validation, "effective_outcome": r.effective_outcome,
                "restates_correction_of": r.restates_correction_of,
                "conformity": r.conformity})
        main = scored or diag_r
        timing = self._timing(ctx, main) if main else {}
        pre = [r for r in rs if r.is_restitution and r.before_pitch]
        devs = [d for r in pre for d in ((r.conformity or {}).get("deviations", []))]
        return {
            "verdict": verdict,
            "absence_reason": reasons[0] if reasons else None,
            "absence_reasons": reasons,
            "validation_turn": scored.validation.get("turn") if scored else None,
            "restitution_span": [scored.span.start, scored.span.end] if scored else None,
            "selected_A": sa, "selected_B": sb, "selected_P": sp, "validated_P": validated_p,
            "roadmap_blockers": blockers, "cost": cost,
            "gap": {"A": sa, "B": sb, "gap_value": gap_value,
                    "problem": [{"type": None, "quote": s.quote, "turn": s.turn, "object": s.object}
                                for s in st["PROBLEM"]],
                    "cost": cost},
            "restitutions": rest_out,
            "restitution": next((x for x, r in zip(rest_out, rs) if r is main), None),
            "formula": {"selected_A": sa, "selected_B": sb, "selected_P": sp, "rule_AB": ab_rule,
                        "conformity": main.conformity if main else None,
                        "B_outside_N": [s.to_dict() for s in B_out]},
            "roadmap": {"blockers": blockers, "count": len(blockers), "warning": warn,
                        "steps": ROADMAP_STEPS},
            "diagnostic_items": [{"id": x.id, "level": x.level, "note": x.note} for x in items],
            "diagnostics": {
                "collected_not_formalised": {c: bool(st[c]) for c in COMPONENTS} if verdict == "absent" else None,
                "gap_value": gap_value, "gap_unit": sel_a.unit if same_unit else None,
                "binding_horizon": (horizon or {}).get("binding"),
                "timing": timing,
                "corrections": [{"span": [r.span.start, r.span.end], "effective": r.effective_outcome}
                                for r in rs if r.validation.get("outcome") == "corrected"],
                "formula_deviations": devs,
                "roadmap_material": len(blockers),
            },
        }

    @staticmethod
    def _timing(ctx, r: Restitution) -> dict:
        start = _ts_seconds(ctx.turn(r.span.start).ts)
        qs = [q for q in ctx.solicitations if q.letter in ("S", "P", "I", "N") and ctx.before(q.turn, r.span.start)]
        last_q = max(qs, key=lambda q: ctx.n(q.turn)) if qs else None
        out = {"last_discovery_question": last_q.turn if last_q else None, "min_since_last_question": None,
               "min_validation_to_pitch": None}
        if last_q and start is not None and _ts_seconds(ctx.turn(last_q.turn).ts) is not None:
            out["min_since_last_question"] = round((start - _ts_seconds(ctx.turn(last_q.turn).ts)) / 60, 1)
        vt, wend = r.validation.get("turn"), window_end(ctx)
        if vt and wend:
            a, b = _ts_seconds(ctx.turn(vt).ts), _ts_seconds(ctx.turn(wend).ts)
            if a is not None and b is not None:
                out["min_validation_to_pitch"] = round((b - a) / 60, 1)
        return out


def _conc_rank(c: str) -> float:
    try:
        a, b = c.split("/")
        return int(a) / int(b)
    except (ValueError, ZeroDivisionError):
        return 0.0
