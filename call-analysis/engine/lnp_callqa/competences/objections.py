"""Competence 4 · Objection Removal (methodology OBJ v1.1, Annex A OB-1..OB-26).

Golden rule: the model answers closed questions with exact quotes; the code bounds episodes, decides levels and scores.

Pipeline of `ObjectionsCompetence.run`:
  1. inventory, after the first price only (OB-27), (code, OB-1 markers, OB-12 speakers, OB-26 doubtful turns) + model nomination of unmarked passages;
  2. per candidate: `obj.resistance` (exclusions OB-2, doubt subjects -> nature by the code with the OB-3 order,
     OB-4 two natures, OB-24 denied nature, OB-25 external reason that also limits time, OB-26 label check);
  3. OB-5 merge (code); episode bounding (code, OB-6..OB-9) with `obj.topic` where the code cannot decide OB-8 (b)
     and for OB-22; latent by turn numbers (OB-10, OB-22); recurrence (OB-11);
  4. per episode: `obj.acknowledge` (OB-13/OB-20), `obj.isolate` (OB-14/X6), `obj.explore` (OB-15/OB-20/X7),
     `obj.gesture` (OB-16/OB-21), `obj.resolution` (OB-17/OB-23/X3) -> items H1..H5 (§5.1);
  5. prevention `obj.prevention` on the turns before the first price (OB-18/OB-19) -> R1..R3 (§5.2);
  6. applicability (§4), combination 70/30 (§5), diagnostics (§7), output contract (§9).
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any, Optional

from ..core.models import CallContext, CompetenceResult, Evidence, ItemScore, OTHER, PROSPECT, SALES, Turn
from ..core.runner import ModelTask, Runner
from ..core.scoring import call_score, item
from ..core.text import GENERIC, STOP, approval_only, clean_tokens, norm, norm_number, quote_ok, sentences

# ----------------------------------------------------------------------------------------------- constants
# Every value below is a methodology proposal "to validate" (§5, §10, OB-5, OB-10) and stays configurable.
HANDLING_SHARE, PREVENTION_SHARE = 0.70, 0.30                 # §5 call score split
H_WEIGHTS = {"H1": 25, "H2": 10, "H3": 20, "H4": 35, "H5": 10}  # §5.1
R_WEIGHTS = {"R1": 40, "R2": 40, "R3": 20}                     # §5.2
EPISODE_WEIGHT = {"objection": 1.0, "anxiety_capability": 1.5, "anxiety_choice": 1.5, "inertia": 1.5}  # §5.1
LATENT_MAX_TURNS = 2          # OB-10: topic change within 2 turns of the resistance
LATENT_MIN_REACTION_WORDS = 6  # OB-10: a reaction of 6 words or more prevents latent
BACKCHANNEL_MAX_WORDS = 5      # OB-5: sales backchannel of 5 words or fewer
# Engineering parameters (not business facts): context sizes fed to the model.
NOMINATE_CHUNK = 60
CONTEXT_BEFORE, CONTEXT_AFTER = 3, 3

NATURES = ("objection", "anxiety_capability", "anxiety_choice", "inertia")
# OB-3 boundary tests in their fixed order: test 1 objection, test 2 anxiety, test 3 inertia.
SUBJECTS: dict[str, tuple[int, str, str]] = {
    "price": (1, "objection", "price"),
    "money_available": (1, "objection", "money_available"),
    "offer_trust": (1, "objection", "trust_in_offer"),
    "offer_relevance": (1, "objection", "relevance"),
    "time": (1, "objection", "time"),
    "co_decider": (1, "objection", "co_decider"),
    "self_capability": (2, "anxiety_capability", "capability"),
    "own_decision": (2, "anxiety_choice", "choice"),
    "present_attachment": (3, "inertia", "timing"),
    "postponement": (3, "inertia", "timing"),
}
EXCLUSIONS = ("none", "information_request", "external_deadline", "circuit_fact", "conditional_acceptance")
REACTION_KINDS = ("states_no_longer_holds", "reformulates_as_answered", "moves_forward_own_initiative",
                  "commits_to_proposal", "agreement_only", "repeats_or_reinforces", "other")

# OB-1 marker lists (English calls). Markers only nominate candidates; the model decides (OB-3).
MARKERS: dict[str, list[str]] = {
    "objection_price_money": [r"too expensive", r"(a lot|lots) of money", r"\bexpensive\b", r"can'?t afford",
                              r"don'?t have (the )?money", r"out of my budget", r"my credit", r"financing",
                              r"\b(that'?s|it'?s|is) (quite |a bit )?a lot\b", r"big amount", r"\bthe amount\b",
                              r"\bthe money\b"],
    "objection_trust_relevance": [r"not sure (if |that )?it works", r"seen programs like this", r"accredited",
                                  r"already know how", r"i don'?t need", r"\btrust\b", r"\bscam\b",
                                  r"sales thing"],
    "objection_time": [r"don'?t have (much |enough |the )?time", r"with my job", r"with the kids", r"\bbusy\b",
                       r"\bbooked\b", r"don'?t breathe"],
    "objection_co_decider": [r"talk to my (husband|wife|partner|fianc[eé]e?|spouse)",
                             r"ask my (husband|wife|partner|fianc[eé]e?|spouse)", r"we decide together",
                             r"check with", r"run it by", r"with my (husband|wife|partner)"],
    "anxiety_capability": [r"i'?m scared", r"i'?m afraid", r"\bafraid\b", r"\bscared\b", r"don'?t know if i can",
                           r"not sure (if )?i can", r"not good enough", r"i'?ll quit", r"always give up",
                           r"\bfear\b"],
    "anxiety_choice": [r"what if it doesn'?t work", r"burned", r"make a mistake", r"how do i know",
                       r"how can you make sure"],
    "inertia": [r"not the right (time|moment)", r"maybe later", r"after the holidays", r"i'?m (okay|ok|good|fine) for now",
                r"think about it", r"sleep on it", r"sit on it", r"not right now", r"don'?t want to do it today",
                r"can'?t make (a )?decisions?", r"fine as it is"],
}
_MARKER_RE = [(k, re.compile(p, re.I)) for k, ps in MARKERS.items() for p in ps]

# OB-13 lexical contradiction markers, checked by code on the first sentence of the first response.
CONTRADICTION_RE = re.compile(r"(\bbut\b|\bactually\b|^\s*no\b[,.!]?|\bno,|that'?s not true|the thing is|i disagree)",
                              re.I)

_LOCAL_STOP = set("""i me my mine we us our it's that's there's what's let's i'm i've i'll i'd you're don't doesn't
didn't can't won't isn't aren't wasn't gonna wanna yes yeah no not so because just um uh oh hmm mm mm-hmm okay ok
cool sure right got get go going one also even still well say said see""".split())


# ----------------------------------------------------------------------------------------------- data
@dataclass
class Resistance:
    start: str                      # first turn (OB-6)
    last: str                       # last turn of the resistance (OB-5 merge)
    role: str
    quote: str
    nature: str
    subtype: str
    turns: list[str] = field(default_factory=list)
    status: str = "verified"

    @property
    def theme(self) -> tuple[str, str]:   # "same resistance" = same nature and theme (§2)
        return (self.nature, self.subtype)


@dataclass
class Episode:
    id: str
    res: Resistance
    response: list[str] = field(default_factory=list)
    reaction: list[str] = field(default_factory=list)
    repeats: list[str] = field(default_factory=list)     # same-theme passages inside the reaction (persisting)
    topic_change: Optional[str] = None
    end_turn: Optional[str] = None                       # first turn not in the episode (None = end of call)
    end_reason: str = "end_of_call"                      # topic_change / new_resistance / end_of_call
    latent: bool = False
    latent_rule: Optional[str] = None
    status: str = "scored"                               # scored / to_review
    facts: dict[str, Any] = field(default_factory=dict)
    recurrence_of: Optional[str] = None
    recurs_later: bool = False
    items: list[ItemScore] = field(default_factory=list)
    score: Optional[int] = None
    tags: list[str] = field(default_factory=list)

    @property
    def key(self) -> str:
        return f"{self.res.start}.{self.res.nature}"


# ----------------------------------------------------------------------------------------------- helpers
def seq(ctx: CallContext) -> list[Turn]:
    """Turns used for bounding: attribution-doubtful turns are excluded (OB-12, OB-26, C1)."""
    return [t for t in ctx.turns if not t.attribution_doubtful]


def _pos(ctx: CallContext) -> dict[str, int]:
    return {t.id: i for i, t in enumerate(seq(ctx))}


def _sing(w: str) -> str:
    if len(w) > 4 and w.endswith("ies"):
        return w[:-3] + "y"
    if len(w) > 3 and w.endswith("s") and not w.endswith("ss"):
        return w[:-1]
    return w


def content_words(text: str, drop_generic: bool = True) -> set[str]:
    """Content words for OB-8 (a) (no function word, no generic word) and, with drop_generic=False, for the
    'reuses a word of the resistance' test of OB-15 (any non-function word: 'a lot' reuses 'lot')."""
    out = set()
    for w in clean_tokens(text):
        w = w.strip("'-")
        if not w or w in STOP or w in _LOCAL_STOP or (drop_generic and w in GENERIC):
            continue
        if len(w) < 3 and not norm_number(w):
            continue
        out.add(_sing(w))
    return out


def is_backchannel(t: Turn) -> bool:
    """OB-5: a sales backchannel of 5 words or fewer with no content word ("mm-hmm", "I hear you")."""
    return len(t.text.split()) <= BACKCHANNEL_MAX_WORDS and (approval_only(t.text) or not content_words(t.text))


def _ts_seconds(ts: str) -> Optional[int]:
    try:
        parts = [int(p) for p in ts.split(":")]
    except ValueError:
        return None
    s = 0
    for p in parts:
        s = s * 60 + p
    return s


def _ev(ctx: CallContext, d: Optional[dict], role: Optional[str] = None) -> Optional[Evidence]:
    if not d or not d.get("quote") or not d.get("turn"):
        return None
    try:
        r = role or ctx.turn(d["turn"]).role
    except KeyError:
        return None
    return Evidence(d["quote"], d["turn"], r)


def _prospect_side_ok(ctx: CallContext, ev: Evidence, turns: Optional[list[str]] = None, **kw) -> Optional[str]:
    """C3 checks for a prospect-side quote (PROSPECT or co-decider OTHER, OB-12)."""
    e = quote_ok(ctx, Evidence(ev.quote, ev.turn), **kw)
    if e:
        return e
    if ctx.turn(ev.turn).role == SALES:
        return "wrong_speaker"
    if turns is not None and ev.turn not in turns:
        return "outside_unit"
    return None


def _sales_ok(ctx: CallContext, ev: Evidence, turns: Optional[list[str]] = None, **kw) -> Optional[str]:
    e = quote_ok(ctx, Evidence(ev.quote, ev.turn, SALES), **kw)
    if e:
        return e
    if turns is not None and ev.turn not in turns:
        return "outside_unit"
    return None


# ----------------------------------------------------------------------------------------------- OB-1 inventory
def marker_hits(text: str) -> list[str]:
    return sorted({k for k, rx in _MARKER_RE if rx.search(text)})


def find_candidates(ctx: CallContext) -> list[Turn]:
    """OB-1: prospect / co-decider turns (OB-12) containing a marker. Doubtful turns excluded (OB-26)."""
    return [t for t in seq(ctx) if t.role in (PROSPECT, OTHER) and marker_hits(t.text)]


# ----------------------------------------------------------------------------------------------- OB-2..OB-4, OB-24, OB-25
def nature_of_subjects(subjects: list[str]) -> Optional[tuple[str, str]]:
    """OB-3: boundary tests in their fixed order; the first test that matches decides (case 5: 'scared ... because
    of the money' is test 1, objection)."""
    known = [s for s in subjects if s in SUBJECTS]
    if not known:
        return None
    best = min(known, key=lambda s: SUBJECTS[s][0])     # min is stable: model order breaks ties inside a test
    _, nature, subtype = SUBJECTS[best]
    return nature, subtype


def resistances_from_answer(ans: dict, turn: Turn) -> tuple[list[Resistance], Optional[dict], list[str]]:
    """Code decision on one `obj.resistance` answer. Returns (resistances, deadline fact, flags)."""
    flags: list[str] = []
    if ans.get("label_contradicted"):            # OB-26: excluded from episodes
        return [], None, [f"attribution_doubtful:{turn.id}"]
    excl = ans.get("exclusion") or "none"
    deadline = None
    if ans.get("deadline") and ans["deadline"].get("quote"):
        deadline = {"turn": turn.id, "quote": ans["deadline"]["quote"], "binding": bool(ans["deadline"].get("binding"))}
    if excl in ("information_request", "circuit_fact", "conditional_acceptance"):    # OB-2, X1
        return [], deadline, flags
    denied = {SUBJECTS[s][1] for s in ans.get("denied_subjects", []) if s in SUBJECTS}
    out: list[Resistance] = []
    seen = set()
    for d in ans.get("doubts", []):
        subjects = list(d.get("subjects") or [])
        if excl == "external_deadline":                     # OB-2 / X2: no inertia; OB-25: only objection · time
            subjects = [s for s in subjects if s == "time"]
        nt = nature_of_subjects(subjects)
        if nt is None:
            continue
        if nt[0] in denied:                                 # OB-24: the denied nature opens no episode
            flags.append(f"denied_nature:{turn.id}:{nt[0]}")
            continue
        if nt[0] in seen:                                   # OB-4: at most one episode per nature
            continue
        seen.add(nt[0])
        out.append(Resistance(turn.id, turn.id, turn.role, d.get("quote", ""), nt[0], nt[1], [turn.id]))
    return out, deadline, flags


def merge_consecutive(ctx: CallContext, res: list[Resistance]) -> list[Resistance]:
    """OB-5: consecutive prospect turns expressing the same resistance, separated only by sales backchannel of
    5 words or fewer, form one resistance."""
    pos = _pos(ctx)
    turns = seq(ctx)
    res = sorted(res, key=lambda r: (pos[r.start], NATURES.index(r.nature)))
    out: list[Resistance] = []
    for r in res:
        prev = next((p for p in reversed(out) if p.theme == r.theme), None)
        if prev and pos[r.start] > pos[prev.last]:
            between = turns[pos[prev.last] + 1: pos[r.start]]
            if all(t.role == SALES and is_backchannel(t) for t in between):
                prev.last = r.start
                prev.turns.append(r.start)
                continue
        out.append(r)
    return out


# ----------------------------------------------------------------------------------------------- OB-8, OB-10, OB-22
def topic_change_condition_a(turn_text: str, ref_words: set[str]) -> bool:
    """OB-8 (a), computed by code: the sales turn contains no content word of the resistance or of the response so
    far ("Where do you want to go from here?" has none at all and passes (a); the model then reads (b)).
    Sales backchannels ("Okay.", "Mm-hmm.") are filtered before (see `is_backchannel`): they introduce nothing."""
    return not (content_words(turn_text) & ref_words)


def is_latent(ctx: CallContext, ep: Episode) -> tuple[bool, Optional[str]]:
    """OB-10 / OB-22 / §2, computed from turn numbers."""
    if ep.latent_rule == "OB-22":
        return True, "OB-22"
    if not ep.reaction:
        return True, "no_reaction"                       # §2: no prospect reaction
    if ep.topic_change:
        pos = _pos(ctx)
        if pos[ep.topic_change] - pos[ep.res.last] <= LATENT_MAX_TURNS and \
                all(len(ctx.turn(t).text.split()) < LATENT_MIN_REACTION_WORDS for t in ep.reaction):
            return True, "OB-10"
    return False, None


# ----------------------------------------------------------------------------------------------- OB-11
def link_recurrences(ctx: CallContext, episodes: list[Episode], previous: Optional[list[dict]] = None) -> list[dict]:
    """OB-11: a resistance of the same nature and theme after an earlier episode ended opens a new episode linked to
    the first one of the chain; every earlier episode of the chain recurs later (H5 = 0, X4).
    `previous`: episodes of the previous call of the same cycle ({"call_id","id","nature","subtype"}).
    Returns the previous-call episodes that recur here (to be re-scored H5 = 0 on that call)."""
    pos = _pos(ctx)
    end = lambda e: pos[e.end_turn] if e.end_turn else len(pos)
    eps = sorted([e for e in episodes if e.status == "scored"], key=lambda e: pos[e.res.start])
    recurring_prev: list[dict] = []
    for i, e in enumerate(eps):
        earlier = [f for f in eps[:i] if f.res.theme == e.res.theme and end(f) <= pos[e.res.start]]
        if earlier:
            e.recurrence_of = earlier[0].id          # linked to the first episode of the chain (case 26)
            for f in earlier:
                f.recurs_later = True
            continue
        for p in previous or []:
            if (p.get("nature"), p.get("subtype")) == e.res.theme:
                e.recurrence_of = f"{p.get('call_id')}:{p.get('id')}"
                recurring_prev.append(p)
                break
    return recurring_prev


# ----------------------------------------------------------------------------------------------- gestures (code)
def acknowledged(first_sentence: str, ans: Optional[dict]) -> bool:
    """OB-13 / OB-20 / X5, read on the first sentence of the first response turn."""
    if CONTRADICTION_RE.search(norm(first_sentence)):
        return False
    a = ans or {}
    if a.get("contradiction"):
        return False
    return bool(a.get("receiving_marker") or a.get("neutral_reformulation") or a.get("elliptical_open_question"))


def _quote_at(ctx: CallContext, turn: str, quote: str) -> tuple[int, int]:
    i = norm(ctx.turn(turn).text).find(norm(quote))
    return (_pos(ctx)[turn], max(i, 0))


def isolation_valid(ctx: CallContext, ep: Episode, iso: Optional[dict], answer: Optional[Evidence]) -> bool:
    """OB-14 / X6: in the episode's response, before the answer."""
    if not iso or not iso.get("isolate") or iso.get("turn") not in ep.response:
        return False
    if answer is None:
        return True
    return _quote_at(ctx, iso["turn"], iso.get("quote", "")) < _quote_at(ctx, answer.turn, answer.quote)


def next_reaction_turn(ctx: CallContext, after: str) -> Optional[Turn]:
    turns = seq(ctx)
    for t in turns[_pos(ctx)[after] + 1:]:
        if t.role != SALES:
            return t
    return None


def exploration(ctx: CallContext, ep: Episode, exp: Optional[dict], resistance_starts: set[str]) -> tuple[bool, bool]:
    """OB-15 / OB-20 / X7. Returns (explored, answered_with_content)."""
    if not exp or not exp.get("explore") or exp.get("turn") not in ep.response or not exp.get("open_question"):
        return False, False                                                   # X7: closed question
    reuse = bool(content_words(exp.get("quote", ""), drop_generic=False) &
                 content_words(" ".join(ctx.turn(t).text for t in ep.res.turns), drop_generic=False))
    elliptical_ok = bool(exp.get("elliptical")) and exp.get("turn") == (ep.response[0] if ep.response else None)
    if not (reuse or elliptical_ok):                                          # OB-15 reuse test, OB-20 ellipsis
        return False, False
    nxt = next_reaction_turn(ctx, exp["turn"])
    if nxt is None or nxt.id in resistance_starts or approval_only(nxt.text):  # case 13: a new resistance is no answer
        return True, False
    content = bool(exp.get("answered_with_content")) and exp.get("answer_turn") == nxt.id
    return True, content


def h1_level(nature: str, g: dict, steps: dict) -> tuple[int, list[str]]:
    """OB-16 / OB-21. `g` = gesture facts (code-validated), `steps` = {ack, isolate, explore} for objections.
    Returns (level, tags)."""
    tags: list[str] = []
    if nature == "objection":
        # Matching gesture: acknowledge, isolate, explore, then an answer tied to what the prospect said (OB-16).
        if not (g.get("answer_given") and g.get("answer_tied_to_prospect")):
            return 0, tags
        if steps.get("ack") and steps.get("isolate") and steps.get("explore"):
            return 2, tags
        tags.append("steps_missing")
        return 1, tags
    if nature == "inertia":
        match = bool(g.get("cost_of_inaction_question") and g.get("cost_stated_by_prospect"))
        wrong = bool(g.get("offer_argument"))
    else:
        match = bool(g.get("support_or_framework")) if nature == "anxiety_capability" \
            else bool(g.get("proof_reversibility_guarantee"))
        wrong = bool(g.get("offer_argument") or g.get("cost_of_inaction_question"))   # case 7b, case 18
    if match and not wrong:
        return 2, tags
    if match and wrong:
        tags.append("partial_wrong_kind")
        return 1, tags
    if nature.startswith("anxiety") and g.get("mindset_reframe"):                    # OB-21
        tags.append("mindset_reframe")
        return 1, tags
    if wrong:
        tags.append("mismatch")
    return 0, tags


def h3_level(nature: str, isolate: bool, explored: bool, content: bool) -> int:
    """§5.1 H3. For anxiety and inertia, explore only."""
    if nature == "objection":
        if isolate and explored and content:
            return 2
        return 1 if (isolate or explored) else 0
    if explored:
        return 2 if content else 1
    return 0


def resolution_level(ctx: CallContext, ep: Episode, r: Optional[dict]) -> tuple[str, Optional[Evidence], bool]:
    """OB-17 / OB-23 / X3 / C3 rule 5. Returns (level, evidence, prompted)."""
    if ep.latent:
        return "latent", None, False
    if not r:
        return "acknowledged", None, False
    kind = r.get("reaction_kind")
    ev = _ev(ctx, r)
    pos = _pos(ctx)
    if kind == "repeats_or_reinforces":
        return "persisting", ev, False
    if ev and any(pos[x] > pos[ev.turn] for x in ep.repeats):          # repeated after the "resolution"
        return "persisting", ev, False
    prompted = bool(r.get("content_first_stated_by_sales"))
    if kind == "commits_to_proposal":                                   # OB-23
        ok = bool(r.get("specific_element")) and ev is not None and not approval_only(ctx.turn(ev.turn).text)
        return ("resolved" if ok else "acknowledged"), ev, False
    if kind in ("states_no_longer_holds", "reformulates_as_answered", "moves_forward_own_initiative"):
        if prompted or ev is None or approval_only(ctx.turn(ev.turn).text):   # X3, C3 rule 5
            return "acknowledged", ev, prompted
        return "resolved", ev, False
    return "acknowledged", ev, prompted                                  # agreement_only / other


H4_LEVEL = {"resolved": 2, "acknowledged": 1, "latent": 0, "persisting": 0}


def episode_items(ctx: CallContext, ep: Episode, f: dict) -> list[ItemScore]:
    """§5.1 items from the code-decided facts of one episode."""
    rq = Evidence(ep.res.quote, ep.res.start, ep.res.role)
    out = [
        item("H1", H_WEIGHTS["H1"], f["h1"], [rq, f.get("gesture_ev")], ";".join(f.get("h1_tags", []))),
        item("H2", H_WEIGHTS["H2"], 2 if f["ack"] else 0, [rq, f.get("ack_ev")]),
        item("H3", H_WEIGHTS["H3"], f["h3"], [f.get("iso_ev"), f.get("exp_ev"), f.get("exp_answer_ev")]),
        item("H4", H_WEIGHTS["H4"], H4_LEVEL[f["reaction_level"]], [rq, f.get("reaction_ev")], f["reaction_level"]),
        # H5 is an absence (no recurrence): no second quote can exist, the two-quote rule does not apply.
        item("H5", H_WEIGHTS["H5"], 0 if ep.recurs_later else 2, [rq], "recurs later" if ep.recurs_later else
             "provisional: current call only", two_quotes=False),
    ]
    return out


def handling_score(episodes: list[Episode]) -> Optional[int]:
    """§5.1: mean of episode scores weighted by nature (anxiety and inertia 1.5, objection 1)."""
    sc = [(EPISODE_WEIGHT[e.res.nature], e.score) for e in episodes if e.status == "scored" and e.score is not None]
    if not sc:
        return None
    return round(sum(w * s for w, s in sc) / sum(w for w, _ in sc))


# ----------------------------------------------------------------------------------------------- prevention (code)
PROSPECT_FACTS = ("decision_maker", "influencers", "budget", "deadline", "past_attempt")
SALES_FACTS = ("past_attempt_explored", "difference_stated")


def prevention_fact_ok(ctx: CallContext, name: str, d: Optional[dict], first_price: Optional[str]) -> tuple[bool, str]:
    """OB-18 (before the first price), OB-19 / X8 (no sales supposition, no bare approval)."""
    if not d or not d.get("quote") or not d.get("turn"):
        return False, "absent"
    try:
        t = ctx.turn(d["turn"])
    except KeyError:
        return False, "unknown_turn"
    if first_price is None or not ctx.before(t.id, first_price):
        return False, "after_first_price"
    if name in PROSPECT_FACTS:
        if t.role == SALES:
            return False, "sales_supposition"
        if approval_only(t.text) or approval_only(d["quote"]):
            return False, "approval_only"
    elif t.role != SALES:
        return False, "wrong_speaker"
    return True, "ok"


def prevention_items(ctx: CallContext, facts: dict, first_price: str) -> tuple[list[ItemScore], dict, list[str]]:
    """§5.2 R1..R3 from the prevention facts. Returns (items, kept facts, flags)."""
    kept, why = {}, {}
    for k in PROSPECT_FACTS + SALES_FACTS:
        ok, reason = prevention_fact_ok(ctx, k, facts.get(k), first_price)
        kept[k] = facts.get(k) if ok else None
        why[k] = reason
    ev = lambda k: _ev(ctx, kept.get(k))
    flags = []
    # R1 decision circuit
    n1 = bool(kept["decision_maker"]) + bool(kept["influencers"])
    r1 = item("R1", R_WEIGHTS["R1"], n1, [ev("decision_maker"), ev("influencers")])
    # R2 budget and deadline (binding counts double in diagnostics only)
    n2 = bool(kept["budget"]) + bool(kept["deadline"])
    r2 = item("R2", R_WEIGHTS["R2"], n2, [ev("budget"), ev("deadline")])
    # R3 past attempt defused (sales gestures must follow the mention, before the price)
    pa = kept["past_attempt"]
    if not pa:
        r3 = item("R3", R_WEIGHTS["R3"], 2, [], "not_triggered", two_quotes=False)
        flags.append("R3_not_triggered")
    else:
        after = lambda k: kept.get(k) and ctx.before(pa["turn"], kept[k]["turn"])
        if after("past_attempt_explored") and after("difference_stated"):
            r3 = item("R3", R_WEIGHTS["R3"], 2, [ev("past_attempt_explored"), ev("difference_stated")])
        elif after("past_attempt_explored"):
            r3 = item("R3", R_WEIGHTS["R3"], 1, [ev("past_attempt"), ev("past_attempt_explored")],
                      "explored, difference not stated")
        else:
            r3 = item("R3", R_WEIGHTS["R3"], 0, [ev("past_attempt")], "past attempt not addressed before the price")
    kept["_rejected"] = {k: v for k, v in why.items() if v not in ("ok", "absent")}
    return [r1, r2, r3], kept, flags


# ----------------------------------------------------------------------------------------------- applicability (§4)
def combine(handling: Optional[int], prevention: Optional[int]) -> Optional[int]:
    """§5: 70 % handling + 30 % prevention when both apply, otherwise the one that applies."""
    if handling is not None and prevention is not None:
        return round(HANDLING_SHARE * handling + PREVENTION_SHARE * prevention)
    return handling if handling is not None else prevention


def applicability(n_episodes: int, price_given: bool) -> tuple[str, str]:
    """§4 -> (handling status, prevention status)."""
    return ("scored" if n_episodes else "not_applicable", "scored" if price_given else "not_applicable")


# ----------------------------------------------------------------------------------------------- model tasks
def _window(ctx: CallContext, start: str, end: Optional[str], before: int = CONTEXT_BEFORE,
            after: int = CONTEXT_AFTER) -> list[Turn]:
    s = seq(ctx)
    p = _pos(ctx)
    a = max(0, p[start] - before)
    b = (p[end] + 1 + after) if end else len(s)
    return s[a:min(b, len(s))]


def _price_note(ctx: CallContext, tid: str) -> str:
    fp = ctx.phases.first_price
    if not fp:
        return "No price was given in this call."
    return f"First price at {fp}: the target turn is {'BEFORE' if ctx.before(tid, fp) else 'AFTER'} the first price."


class _Tasks:
    """Builds the model tasks of one run. `validate` receives the unit id: units are kept in `self.units`."""

    def __init__(self):
        self.units: dict[str, Any] = {}

    def run(self, runner: Runner, ctx: CallContext, task: ModelTask, uid: str, unit: Any):
        self.units[uid] = unit
        return runner.run(ctx, task, uid, unit)

    # -- nominate (OB-1, model may nominate without a marker)
    def nominate(self) -> ModelTask:
        def build(ctx, u):
            chunk, flagged = u
            return ("ALREADY FLAGGED: " + (", ".join(flagged) or "none") + "\n\nEXTRACT\n" + ctx.render(chunk))

        def validate(a, ctx, uid):
            chunk, _ = self.units[uid]
            ids = [t.id for t in chunk]
            errs = []
            for n in a.get("nominations", []) or []:
                e = _prospect_side_ok(ctx, Evidence(n.get("quote", ""), n.get("turn", "")), ids) \
                    if n.get("turn") in ids else "outside_unit"
                if e:
                    errs.append(f"{e}:{n.get('turn')}")
            return errs
        return ModelTask("obj.nominate", "fast", "objections_nominate", build, validate,
                         key=lambda a: sorted(n["turn"] for n in a.get("nominations", []) or []))

    # -- resistance (OB-2, OB-3, OB-4, OB-24, OB-25, OB-26)
    def resistance(self) -> ModelTask:
        def build(ctx, t):
            return (f"TARGET TURN: {t.id} ({t.role})\n{_price_note(ctx, t.id)}\n\nCONTEXT\n" +
                    ctx.render(_window(ctx, t.id, t.id)))

        def validate(a, ctx, uid):
            t = self.units[uid]
            errs = []
            if a.get("exclusion", "none") not in EXCLUSIONS:
                errs.append("bad_exclusion")
            for d in a.get("doubts", []) or []:
                if not d.get("subjects") or any(s not in SUBJECTS for s in d["subjects"]):
                    errs.append("bad_subject")
                if _prospect_side_ok(ctx, Evidence(d.get("quote", ""), t.id)):
                    errs.append("bad_quote")
            if any(s not in SUBJECTS for s in a.get("denied_subjects", []) or []):
                errs.append("bad_denied_subject")
            dl = a.get("deadline")
            if dl and _prospect_side_ok(ctx, Evidence(dl.get("quote", ""), t.id)):
                errs.append("bad_deadline_quote")
            return errs

        def key(a):
            natures = sorted({nature_of_subjects(d.get("subjects", [])) or ("", "")
                              for d in a.get("doubts", []) or []})
            return [a.get("exclusion", "none"), natures, sorted(a.get("denied_subjects", []) or []),
                    bool(a.get("deadline")), bool(a.get("label_contradicted"))]
        return ModelTask("obj.resistance", "strong", "objections_resistance", build, validate, key)

    # -- topic change (OB-8 b, OB-22)
    def topic(self) -> ModelTask:
        def build(ctx, u):
            ep, t, first = u
            resp = [ctx.turn(x) for x in ep.response]
            return (f"RESISTANCE ({ep.res.nature} · {ep.res.subtype}) [{ep.res.start}]: \"{ep.res.quote}\"\n\n"
                    "SALES RESPONSE SO FAR\n" + (ctx.render(resp) or "(none)") +
                    f"\n\nTARGET TURN{' (FIRST RESPONSE)' if first else ''}\n" + ctx.render([t]))

        def validate(a, ctx, uid):
            ep, t, first = self.units[uid]
            if a.get("new_subject") or a.get("receive_and_leave"):
                e = _sales_ok(ctx, Evidence(a.get("quote", "") or "", t.id), [t.id], max_words=60)
                return [e] if e else []
            return []
        return ModelTask("obj.topic", "fast", "objections_topic", build, validate,
                         key=lambda a: [bool(a.get("new_subject")), bool(a.get("receive_and_leave"))])

    # -- per-episode gesture tasks
    @staticmethod
    def _episode_text(ctx: CallContext, ep: Episode) -> str:
        end = ep.topic_change or ep.end_turn
        turns = [t for t in _window(ctx, ep.res.start, end, before=1, after=0)]
        resp, reac = set(ep.response), set(ep.reaction)
        lines = []
        for t in turns:
            tag = "RESPONSE" if t.id in resp else "REACTION" if t.id in reac else \
                "RESISTANCE" if t.id in ep.res.turns else "TOPIC CHANGE" if t.id == ep.topic_change else "CONTEXT"
            lines.append(f"<{tag}> [{t.id} {t.ts}] {t.role}: {t.text}")
        return (f"RESISTANCE: nature {ep.res.nature}, theme {ep.res.subtype}, turn {ep.res.start}, "
                f"quote \"{ep.res.quote}\"\n\nEPISODE\n" + "\n".join(lines))

    def acknowledge(self) -> ModelTask:
        def build(ctx, ep):
            t = ctx.turn(ep.response[0])
            first = (sentences(t.text) or [t.text])[0]
            return (self._episode_text(ctx, ep) + f"\n\nFIRST RESPONSE TURN: {t.id}\nFIRST SENTENCE: \"{first}\"")

        def validate(a, ctx, uid):
            ep = self.units[uid]
            e = _sales_ok(ctx, Evidence(a.get("quote", ""), ep.response[0]), min_words=1)
            return [e] if e else []
        return ModelTask("obj.acknowledge", "fast", "objections_acknowledge", build, validate,
                         key=lambda a: [bool(a.get(k)) for k in ("receiving_marker", "neutral_reformulation",
                                                                 "elliptical_open_question", "contradiction")])

    def isolate(self) -> ModelTask:
        def validate(a, ctx, uid):
            ep = self.units[uid]
            if a.get("isolate"):
                e = _sales_ok(ctx, Evidence(a.get("quote", ""), a.get("turn", "")), ep.response)
                return [e] if e else []
            return []
        return ModelTask("obj.isolate", "fast", "objections_isolate", lambda ctx, ep: self._episode_text(ctx, ep),
                         validate, key=lambda a: [bool(a.get("isolate")), a.get("turn") if a.get("isolate") else None])

    def explore(self) -> ModelTask:
        def build(ctx, ep):
            nxt = [t for t in _window(ctx, ep.res.start, ep.topic_change or ep.end_turn, 1, 2)]
            return self._episode_text(ctx, ep) + "\n\nTURNS INCLUDING THE NEXT PROSPECT TURN\n" + ctx.render(nxt)

        def validate(a, ctx, uid):
            ep = self.units[uid]
            errs = []
            if a.get("explore"):
                e = _sales_ok(ctx, Evidence(a.get("quote", ""), a.get("turn", "")), ep.response, min_words=1)
                if e:
                    errs.append(e)
                if a.get("answered_with_content"):
                    e = _prospect_side_ok(ctx, Evidence(a.get("answer_quote", "") or "", a.get("answer_turn", "") or ""))
                    if e:
                        errs.append("answer_" + e)
            return errs
        return ModelTask("obj.explore", "fast", "objections_explore", build, validate,
                         key=lambda a: [bool(a.get("explore")), a.get("turn") if a.get("explore") else None,
                                        bool(a.get("open_question")), bool(a.get("elliptical")),
                                        bool(a.get("answered_with_content"))])

    def gesture(self) -> ModelTask:
        bools = ("answer_given", "answer_tied_to_prospect", "support_or_framework", "proof_reversibility_guarantee",
                 "cost_of_inaction_question", "cost_stated_by_prospect", "mindset_reframe", "offer_argument")

        def validate(a, ctx, uid):
            ep = self.units[uid]
            errs = []
            if a.get("answer_given"):
                e = _sales_ok(ctx, Evidence(a.get("answer_quote", "") or "", a.get("answer_turn", "") or ""), ep.response)
                if e:
                    errs.append("answer_" + e)
            if any(a.get(k) for k in bools if k not in ("cost_stated_by_prospect",)):
                e = _sales_ok(ctx, Evidence(a.get("gesture_quote", "") or "", a.get("gesture_turn", "") or ""), ep.response)
                if e:
                    errs.append("gesture_" + e)
            if a.get("cost_stated_by_prospect"):
                e = _prospect_side_ok(ctx, Evidence(a.get("prospect_cost_quote", "") or "",
                                                    a.get("prospect_cost_turn", "") or ""), ep.reaction)
                if e:
                    errs.append("cost_" + e)
            return errs
        return ModelTask("obj.gesture", "strong", "objections_gesture", lambda ctx, ep: self._episode_text(ctx, ep),
                         validate, key=lambda a: [bool(a.get(k)) for k in bools])

    def resolution(self) -> ModelTask:
        def validate(a, ctx, uid):
            ep = self.units[uid]
            if a.get("reaction_kind") not in REACTION_KINDS:
                return ["bad_reaction_kind"]
            e = _prospect_side_ok(ctx, Evidence(a.get("quote", ""), a.get("turn", "")), ep.reaction, min_words=1)
            return [e] if e else []
        return ModelTask("obj.resolution", "strong", "objections_resolution",
                         lambda ctx, ep: self._episode_text(ctx, ep), validate,
                         key=lambda a: [a.get("reaction_kind"), bool(a.get("specific_element")),
                                        bool(a.get("content_first_stated_by_sales"))])

    # -- prevention (OB-18, OB-19)
    def prevention(self) -> ModelTask:
        def build(ctx, fp):
            pre = seq(ctx)[:_pos(ctx)[fp]]
            return f"FIRST PRICE AT {fp}. TURNS BEFORE THE FIRST PRICE\n" + ctx.render(pre)

        def validate(a, ctx, uid):
            errs = []
            for k in PROSPECT_FACTS + SALES_FACTS:
                d = a.get(k)
                if not d:
                    continue
                ev = Evidence(d.get("quote", ""), d.get("turn", ""))
                e = _sales_ok(ctx, ev) if k in SALES_FACTS else _prospect_side_ok(ctx, ev, min_words=1)
                if e:
                    errs.append(f"{k}:{e}")
            return errs
        return ModelTask("obj.prevention", "strong", "objections_prevention", build, validate,
                         key=lambda a: [(k, (a.get(k) or {}).get("turn")) for k in PROSPECT_FACTS + SALES_FACTS] +
                         [bool((a.get("deadline") or {}).get("binding"))])


# ----------------------------------------------------------------------------------------------- competence
class ObjectionsCompetence:
    name = "OBJECTIONS"
    rules_version = "OBJ-1.1"

    # ------------------------------------------------------------------ stage 1-2: resistances
    def _resistances(self, ctx, runner, T: _Tasks, audit: dict) -> tuple[list[Resistance], list[dict], list[str]]:
        flags: list[str] = []
        # OB-27 (Romain 2026-11-03): an objection is only read after the first price; nothing before it is an objection
        pos = _pos(ctx)
        fp = ctx.phases.first_price
        after_price = (lambda t: fp is not None and pos[t.id] > pos[fp])
        cands = {t.id: t for t in find_candidates(ctx) if after_price(t)}
        nom = T.nominate()
        s = [t for t in seq(ctx) if after_price(t)]
        for k in range(0, len(s), NOMINATE_CHUNK):
            chunk = s[k:k + NOMINATE_CHUNK]
            if not any(t.role in (PROSPECT, OTHER) for t in chunk):
                continue
            r = T.run(runner, ctx, nom, f"nominate:{chunk[0].id}", (chunk, [t.id for t in chunk if t.id in cands]))
            audit[r.status] = audit.get(r.status, 0) + 1
            for n in (r.answer or {}).get("nominations", []) or []:
                if n["turn"] not in cands and after_price(ctx.turn(n["turn"])):
                    cands[n["turn"]] = ctx.turn(n["turn"])
            if r.status == "to_review":
                flags.append(f"to_review:nominate:{chunk[0].id}")
        res: list[Resistance] = []
        deadlines: list[dict] = []
        task = T.resistance()
        for tid in sorted(cands, key=lambda x: pos[x]):
            t = cands[tid]
            r = T.run(runner, ctx, task, f"res:{tid}", t)
            audit[r.status] = audit.get(r.status, 0) + 1
            if r.answer is None:
                flags.append(f"to_review:res:{tid}")
                continue
            rs, dl, fl = resistances_from_answer(r.answer, t)
            for x in rs:
                x.status = r.status
            res += rs
            flags += fl
            if dl:
                deadlines.append(dl)
        return merge_consecutive(ctx, res), deadlines, flags

    # ------------------------------------------------------------------ stage 3: bounding
    def _bound(self, ctx, runner, T: _Tasks, res: list[Resistance], audit: dict) -> list[Episode]:
        pos = _pos(ctx)
        s = seq(ctx)
        by_start: dict[str, list[Resistance]] = {}
        for r in res:
            by_start.setdefault(r.start, []).append(r)
        task = T.topic()
        eps: list[Episode] = []
        absorbed: set[int] = set()                 # same-theme repetitions inside an open episode (persisting)
        for r in sorted(res, key=lambda r: (pos[r.start], NATURES.index(r.nature))):
            if id(r) in absorbed:
                continue
            ep = Episode(f"E{len(eps) + 1}", r)
            ref = content_words(" ".join(ctx.turn(x).text for x in r.turns))
            i = pos[r.last] + 1
            while i < len(s):
                t = s[i]
                if t.role != SALES:
                    others = [o for o in by_start.get(t.id, []) if o is not r]
                    if others:
                        same = [o for o in others if o.theme == r.theme]
                        if same and len(same) == len(others):               # same resistance again: persisting
                            absorbed.update(id(o) for o in same)
                            ep.repeats.append(t.id)
                            if ep.response:
                                ep.reaction.append(t.id)
                            i += 1
                            continue
                        ep.end_turn, ep.end_reason = t.id, "new_resistance"   # OB-9
                        break
                    if ep.response:
                        ep.reaction.append(t.id)                            # OB-9 reaction
                    i += 1
                    continue
                first = not ep.response
                if is_backchannel(t):          # OB-5: a backchannel is not a response and introduces no subject
                    if not first:
                        ep.response.append(t.id)
                    i += 1
                    continue
                cond_a = topic_change_condition_a(t.text, ref)
                if first or cond_a:
                    a = T.run(runner, ctx, task, f"topic:{ep.key}:{t.id}", (ep, t, first))
                    audit[a.status] = audit.get(a.status, 0) + 1
                    if a.answer is None:
                        ep.status = "to_review"
                        ep.tags.append(f"to_review:topic:{t.id}")
                        break
                    if first and a.answer.get("receive_and_leave"):          # OB-22
                        ep.response = [t.id]
                        ep.topic_change, ep.end_turn, ep.end_reason = t.id, t.id, "topic_change"
                        ep.latent_rule = "OB-22"
                        break
                    if cond_a and a.answer.get("new_subject"):               # OB-8 (a) code + (b) model
                        ep.topic_change, ep.end_turn, ep.end_reason = t.id, t.id, "topic_change"
                        break
                ep.response.append(t.id)                                    # OB-7
                ref |= content_words(t.text)
                i += 1
            ep.latent, rule = is_latent(ctx, ep)
            if ep.latent:
                ep.latent_rule = rule
            eps.append(ep)
        return eps

    # ------------------------------------------------------------------ stage 4: gestures and items
    def _judge(self, ctx, runner, T: _Tasks, ep: Episode, res_starts: set[str], audit: dict) -> None:
        f: dict[str, Any] = {"h1_tags": []}
        nature = ep.res.nature

        def ask(task, prefix):
            r = T.run(runner, ctx, task, f"{prefix}:{ep.key}", ep)
            audit[r.status] = audit.get(r.status, 0) + 1
            if r.answer is None:
                ep.status = "to_review"
                ep.tags.append(f"to_review:{prefix}")
            return r.answer

        if not ep.response:                      # no sales response at all: nothing received, nothing answered
            f.update(ack=False, h1=0, h3=0, reaction_level="latent")
        else:
            first = ctx.turn(ep.response[0])
            first_sentence = (sentences(first.text) or [first.text])[0]
            ack_a = ask(T.acknowledge(), "ack")
            g = ask(T.gesture(), "gest") or {}
            exp_a = ask(T.explore(), "exp")
            iso_a = ask(T.isolate(), "iso") if nature == "objection" else None
            res_a = ask(T.resolution(), "resol") if not ep.latent and ep.reaction else None
            if ep.status == "to_review":
                ep.facts = f
                return
            f["ack"] = acknowledged(first_sentence, ack_a)
            f["ack_ev"] = Evidence(ack_a.get("quote", first_sentence), first.id, SALES) if f["ack"] else None
            answer_ev = _ev(ctx, {"turn": g.get("answer_turn"), "quote": g.get("answer_quote")}, SALES) \
                if g.get("answer_given") else None
            iso = isolation_valid(ctx, ep, iso_a, answer_ev) if nature == "objection" else False
            explored, content = exploration(ctx, ep, exp_a, res_starts)
            f["isolate"], f["explore"], f["explore_content"] = iso, explored, content
            f["iso_ev"] = _ev(ctx, iso_a, SALES) if iso else None
            f["exp_ev"] = _ev(ctx, exp_a, SALES) if explored else None
            f["exp_answer_ev"] = _ev(ctx, {"turn": exp_a.get("answer_turn"), "quote": exp_a.get("answer_quote")}) \
                if content else None
            if g.get("cost_stated_by_prospect"):
                g = dict(g, cost_stated_by_prospect=bool(_ev(ctx, {"turn": g.get("prospect_cost_turn"),
                                                                    "quote": g.get("prospect_cost_quote")})))
            f["h1"], f["h1_tags"] = h1_level(nature, g, {"ack": f["ack"], "isolate": iso, "explore": explored})
            f["gesture_ev"] = _ev(ctx, {"turn": g.get("gesture_turn"), "quote": g.get("gesture_quote")}, SALES) \
                if f["h1"] else None
            if nature == "inertia" and f["h1"] == 2:
                f["gesture_ev"] = f["gesture_ev"] or _ev(ctx, {"turn": g.get("prospect_cost_turn"),
                                                               "quote": g.get("prospect_cost_quote")})
            f["h3"] = h3_level(nature, iso, explored, content)
            f["mismatch"] = nature != "objection" and bool(g.get("offer_argument")) and f["h1"] == 0
            f["answer_ev"] = answer_ev
            lvl, rev, prompted = resolution_level(ctx, ep, res_a)
            f["reaction_level"], f["reaction_ev"], f["prompted"] = lvl, rev, prompted
            if res_a and res_a.get("reaction_kind") == "other":
                ep.tags.append("uncovered_reaction")
        if not ep.response:
            f.update(isolate=False, explore=False, explore_content=False, prompted=False, mismatch=False)
        ep.facts = f
        ep.tags += f.get("h1_tags", [])

    # ------------------------------------------------------------------ run
    def run(self, ctx: CallContext, runner: Runner) -> CompetenceResult:
        out = CompetenceResult(self.name, self.rules_version)
        if not ctx.offer_reference:
            out.flags.append("offer_reference_missing")
        T = _Tasks()
        audit: dict[str, int] = {}
        res, deadlines, flags = self._resistances(ctx, runner, T, audit)
        out.flags += flags
        eps = self._bound(ctx, runner, T, res, audit)
        res_starts = {e.res.start for e in eps}      # starts of episodes (absorbed repetitions excluded)
        for ep in eps:
            if ep.status == "scored":
                self._judge(ctx, runner, T, ep, res_starts, audit)
        previous = [dict(e, call_id=p.get("call_id")) for p in ctx.prior_inputs
                    if p.get("kind") == "objections_episodes" for e in p.get("episodes", [])]
        recurring_prev = link_recurrences(ctx, eps, previous)
        for ep in eps:
            if ep.status != "scored":
                continue
            ep.items = episode_items(ctx, ep, ep.facts)
            ep.score = call_score(ep.items)
        scored_eps = [e for e in eps if e.status == "scored"]
        if any(e.status == "to_review" for e in eps):
            out.flags.append("episodes_to_review")

        # prevention
        fp = ctx.phases.first_price
        h_status, p_status = applicability(len(eps), bool(fp))
        prevention, p_items, p_score = None, [], None
        if p_status == "scored":
            r = T.run(runner, ctx, T.prevention(), "prevention:pre_price", fp)
            audit[r.status] = audit.get(r.status, 0) + 1
            if r.answer is None:
                p_status = "to_review"
                out.flags.append("to_review:prevention")
            else:
                facts = dict(r.answer)
                if not facts.get("deadline"):        # OB-2 / OB-25 deadlines found at detection feed prevention
                    dl = next((d for d in deadlines if ctx.before(d["turn"], fp)), None)
                    if dl:
                        facts["deadline"] = dl
                p_items, prevention, pf = prevention_items(ctx, facts, fp)
                out.flags += pf
                p_score = call_score(p_items)

        h_score = handling_score(scored_eps) if h_status == "scored" else None
        # status (§4, C3 rule 7)
        undecided_candidates = any(f.startswith("to_review:res:") or f.startswith("to_review:nominate:")
                                   for f in out.flags)
        if h_status == "scored" and h_score is None:
            out.status, out.reasons = "to_review", ["all_episodes_to_review"]
        elif h_status == "not_applicable" and undecided_candidates:
            out.status, out.reasons = "to_review", ["candidates_to_review"]
        elif p_status == "to_review" and h_status == "not_applicable":
            out.status, out.reasons = "to_review", ["prevention_to_review"]
        elif h_status == "not_applicable" and p_status == "not_applicable":
            out.status, out.reasons = "not_applicable", ["no_resistance_no_price"]
        else:
            out.status = "scored"
            out.score = combine(h_score, p_score)
            if h_status == "not_applicable":
                out.reasons.append("no_resistance: call score = prevention score")
        if scored_eps:
            out.flags.append("h5_provisional")       # §5.1: current call only until the next call is analysed

        # call-level items: R1..R3 and, per H item, the weakest episode (stable ids for period item rates)
        call_items: list[ItemScore] = []
        for hid in H_WEIGHTS:
            levels = [(e, next(i for i in e.items if i.id == hid)) for e in scored_eps]
            if levels:
                e, it = min(levels, key=lambda x: x[1].level)
                call_items.append(ItemScore(hid, H_WEIGHTS[hid], it.level, it.evidence, f"min over episodes ({e.id})"))
        out.items = call_items + p_items
        out.concordance = f"{audit.get('verified', 0)}/{sum(audit.values())} units verified" if audit else None
        out.details = {
            "handling_status": h_status, "prevention_status": p_status,
            "handling_score": h_score, "prevention_score": p_score,
            "episodes": [self._episode_record(ctx, e) for e in eps],
            "prevention": self._prevention_record(prevention, p_items),
            "deadlines_detected": deadlines,
            "recurs_from_previous_call": recurring_prev,
            "diagnostics": diagnostics(ctx, eps, prevention),
            "unit_status": audit,
        }
        out.verdict = None
        return out

    # ------------------------------------------------------------------ output contract (§9)
    @staticmethod
    def _episode_record(ctx: CallContext, e: Episode) -> dict:
        f = e.facts
        fp = ctx.phases.first_price
        roadmap = ((ctx.results.get("PITCH").details or {}).get("roadmap_span")
                   if ctx.results.get("PITCH") else None)
        rev = f.get("reaction_ev")
        pos = _pos(ctx)
        turns_to_tc = (pos[e.topic_change] - pos[e.res.start]) if e.topic_change else None
        during_roadmap = bool(roadmap and roadmap[0] and roadmap[1] and
                              ctx.n(roadmap[0]) <= ctx.n(e.res.start) <= ctx.n(roadmap[1]))
        return {
            "id": e.id, "nature": e.res.nature, "subtype": e.res.subtype, "status": e.status,
            "resistance": {"turn": e.res.start, "quote": e.res.quote, "turns": e.res.turns, "role": e.res.role},
            "response_turns": e.response, "reaction_turns": e.reaction, "topic_change": e.topic_change,
            "end_reason": e.end_reason, "turns_to_topic_change": turns_to_tc,
            "acknowledge": f.get("ack"), "isolate": f.get("isolate") if e.res.nature == "objection" else None,
            "explore": {"asked": f.get("explore"), "answered_with_content": f.get("explore_content")},
            "gesture_match": {2: "yes", 1: "partial", 0: "no"}.get(f.get("h1")),
            "reaction": {"level": f.get("reaction_level"), "turn": rev.turn if rev else None,
                         "quote": rev.quote if rev else None},
            "prompted_resolution": f.get("prompted"), "latent_rule": e.latent_rule,
            "after_first_price": bool(fp and not ctx.before(e.res.start, fp)),
            "during_roadmap": during_roadmap,
            "recurrence_of": e.recurrence_of, "recurs_later": e.recurs_later, "tags": e.tags,
            "items": [{"id": i.id, "level": i.level, "note": i.note,
                       "evidence": [ev.to_dict() for ev in i.evidence]} for i in e.items],
            "score": e.score,
        }

    @staticmethod
    def _prevention_record(prev: Optional[dict], items: list[ItemScore]) -> Optional[dict]:
        if prev is None:
            return None
        d = {k: prev.get(k) for k in PROSPECT_FACTS + SALES_FACTS}
        d["rejected"] = prev.get("_rejected", {})
        d["items"] = [{"id": i.id, "level": i.level, "note": i.note} for i in items]
        return d


# ----------------------------------------------------------------------------------------------- diagnostics (§7)
def diagnostics(ctx: CallContext, eps: list[Episode], prevention: Optional[dict]) -> dict:
    sc = [e for e in eps if e.status == "scored"]
    n = len(sc)
    mix: dict[str, int] = {}
    for e in sc:
        k = f"{e.res.nature}·{e.res.subtype}"
        mix[k] = mix.get(k, 0) + 1
    ai = [e for e in sc if e.res.nature != "objection"]
    fp = ctx.phases.first_price
    times = []
    for e in sc:
        rev = e.facts.get("reaction_ev")
        if e.facts.get("reaction_level") == "resolved" and rev:
            a, b = _ts_seconds(ctx.turn(e.res.start).ts), _ts_seconds(ctx.turn(rev.turn).ts)
            times.append({"episode": e.id, "turns": _pos(ctx)[rev.turn] - _pos(ctx)[e.res.start],
                          "seconds": (b - a) if a is not None and b is not None else None})
    themes: dict[str, int] = {}
    for e in sc:
        if e.recurrence_of:
            k = f"{e.res.nature}·{e.res.subtype}"
            themes[k] = themes.get(k, 0) + 1
    dl = (prevention or {}).get("deadline")
    return {
        "resistance_mix": mix,
        "latent_rate": round(sum(e.latent for e in sc) / n, 3) if n else None,
        "mismatch_rate": round(sum(bool(e.facts.get("mismatch")) for e in ai) / len(ai), 3) if ai else None,
        "time_to_resolution": times,
        "resistances_after_price": round(sum(bool(fp and not ctx.before(e.res.start, fp)) for e in sc) / n, 3)
        if n else None,
        "recurrent_themes": themes,
        "binding_deadline": bool(dl and dl.get("binding")),   # "binding counts double in diagnostics" (§5.2 R2)
    }
