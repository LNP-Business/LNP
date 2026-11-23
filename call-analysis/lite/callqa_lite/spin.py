"""S1 → SPIN result (SPIN-1.3) and the shared fact base (solicitations, atoms) read by the Gap.

The model lists the discovery questions with their letter, register and the atoms of the answers. The code:
- checks every quote (C3): a question is an exact passage of a SALES turn before the first pitch start or price (SB-1,
  SB-34), an atom an exact passage of a PROSPECT turn of that question's answer, a register quote where SB-32 wants it;
  anything else is dropped and counted;
- applies the hard rules of §3 (a final validation tail, a closed need-payoff: OUT agreement);
- places the perimeter (SB-1, SB-2), computes the answer spans (SB-5 to SB-8), the follow-ups (SB-17, SB-19), the
  chains (SB-16 to SB-20), the atom decisions (SB-9 to SB-24) and the items D1 to D5, with the reference engine's
  functions (lnp_callqa.competences.spin).
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Optional

from lnp_callqa.competences import spin as E
from lnp_callqa.core.models import (Atom, CallContext, CompetenceResult, Evidence, PROSPECT, SALES, Solicitation,
                                        Turn)
from lnp_callqa.core.scoring import call_score
from lnp_callqa.core.text import norm, quote_ok

from .shim import Drops

STEP = "S1"
SINGLE = "single_reading"       # one model reading (lite): never "verified" 3/3
GATE_OF = {"S": 2, "N": 3, "I": 4, "P": 5}


@dataclass
class LUnit:
    """What the engine's SPIN helpers read of a unit (answer_spans, build_atoms, lexical_link, _validate_register,
    diagnostics, applicability)."""
    sol: Solicitation
    turn: Turn
    rank: int
    quote: str
    raw: dict
    preamble: str = ""
    prev_prospect: list = field(default_factory=list)
    decision: Optional[E.LetterDecision] = None
    window_end: Optional[str] = None
    in_perimeter: bool = False
    reopening: Optional[int] = None
    gates: Optional[dict] = None
    volunteered_turns: list = field(default_factory=list)
    answer_text: str = ""
    follows_prev: bool = False
    unanswered: bool = False
    attrs: dict = field(default_factory=dict)


def sentence_of(text: str, quote: str) -> tuple[str, str]:
    """The sentence of the sales turn that holds the quoted question (SEG-1, an isolated tail merged, SEG-4) and the
    preamble before it in the same turn (SEG-5)."""
    merged: list[str] = []
    for s in E.split_sentences(text):
        if E.TAIL_ONLY.match(s) and merged:
            merged[-1] = merged[-1].rstrip(".!") + ", " + s
        else:
            merged.append(s)
    q = norm(quote).strip(' .,?!"')
    for k, s in enumerate(merged):
        if q and q in norm(s):
            return s, " ".join(merged[:k])[-500:]
    end = norm(text).find(q) + len(q)
    acc = 0
    for k, s in enumerate(merged):
        acc += len(norm(s)) + 1
        if acc >= end:
            return s, " ".join(merged[:k])[-500:]
    return quote, ""


GATE_DEFAULTS = {"is_solicitation": True, "attribution_doubtful": False, "routing": None,
                 "g1": {"reason": None}, "g2": {"neutral_fact": False, "exclusion": None},
                 "g3": {"state_or_value": False, "antecedent": "none", "content_supplied": False, "load_named": False,
                        "about_offer": False, "action_plan": False},
                 "g4": {"consequence": False, "problem_domain": None, "named_domain": None, "same_domain": False,
                        "antecedent_solution": False},
                 "g5": {"difficulty": False, "sales_named": False, "anchored": False},
                 "objection_clarification": False}
POSITIVE = {"g1": "reason", "g2": "neutral_fact", "g3": "state_or_value", "g4": "consequence", "g5": "difficulty"}


def normalize_gates(g: dict) -> dict:
    """S1g by ids (2026-11-23): the model answers only what is true; every field it leaves out is read at its default
    (a gate at false, a null reason, `is_solicitation` true). The fields it gives are kept as given."""
    out = dict(g)
    for k, v in GATE_DEFAULTS.items():
        if isinstance(v, dict):
            given = out.get(k) if isinstance(out.get(k), dict) else {}
            out[k] = {**v, **given}
        elif k not in out or out[k] is None and k != "routing":
            out[k] = v
    return out


def with_proofs(g: dict, question: str) -> dict:
    """A positive gate without a quote takes the question itself as its proof: the question was listed by the code
    (SEG-1), its text is the code's, there is nothing for the model to prove by recopying it (Part C, C3 for the lite
    engine, 2026-11-23). A quote the model did give is kept and checked as before."""
    out = dict(g)
    for k, pos in POSITIVE.items():
        part = out.get(k)
        if isinstance(part, dict) and part.get(pos) and part.get("quote") is None:
            out[k] = dict(part, quote=question)
    return out


def letter_from_gates(q: dict, sentence: str) -> Optional[dict]:
    """S1g (2026-11-20): the engine's decide_letter on the model's gate answers (SPIN §3, the code applies the order of
    the gates); returns the letter fields S1 would give, or None (no gates, or a gate whose quote failed)."""
    g = q.get("gates")
    if not isinstance(g, dict):
        return None
    low = sentence.strip().lower()
    attrs = {"validation_tail": any(re.search(p, low) for p in E.TAILS), "system": bool(E.SYSTEM_LINE.search(sentence))}
    text = q.get("quote") or sentence
    d = E.decide_letter(with_proofs(normalize_gates(g), text), attrs, text)
    if d.invalid_proof:
        return None
    if d.letter in E.LETTERS:
        return {"letter": d.letter, "gate_tags": d.tags}
    if d.letter == E.OUT:
        return {"letter": E.OUT, "out_reason": d.reason, "closed_need_payoff": "closed_need_payoff" in d.tags,
                "gate_tags": d.tags}
    return {"letter": d.letter, "gate_tags": d.tags}                  # routing, not a solicitation, doubtful voice


def gate_letter(g: dict, quote: str) -> Optional[tuple]:
    """The code's decision on one reading of the gates: (letter, OUT reason), or None when a quote failed."""
    fg = letter_from_gates({"gates": g, "quote": quote}, quote)
    return (fg["letter"], fg.get("out_reason")) if fg else None


def decide_letter(q: dict, sentence: str) -> E.LetterDecision:
    """The letter decided by code from the gates (S1g) when they are there, else the model's letter; then the hard
    rules of §3 that the code enforces over it."""
    fg = letter_from_gates(q, sentence)
    if fg:
        q = dict(q, **{k: v for k, v in fg.items() if k != "gate_tags"})
        if "out_reason" not in fg:
            q.pop("out_reason", None)
            q.pop("closed_need_payoff", None)
    letter, tags = q["letter"], (["gates_by_code"] if fg else [])
    reason = (q.get("out_reason") if q.get("out_reason") in E.OUT_PRIORITY else "absent") if letter == E.OUT else None
    forced = []
    if q.get("closed_need_payoff"):
        forced.append("agreement")                                   # content supplied by the sales
        tags.append("closed_need_payoff")
    if E.TAIL_ONLY.match(sentence.strip()):                           # SEG-4 / SEG-7: a tail alone ("Tu vois ?")
        forced.append("agreement")
        tags.append("tail_only")
    if any(re.search(p, sentence.strip().lower()) for p in E.TAILS):  # SEG-4 validation tail -> OUT agreement
        forced.append("agreement")
        tags.append("validation_tail")
    if E.solution_load_question(sentence):                            # §3: the load of a solution (time, budget)
        forced.append("solution_load")
        tags.append("solution_load_by_code")
    if E.offer_question(sentence):                                    # §3: a question about the offer
        forced.append("offer_info")
        tags.append("offer_info_by_code")
    if E.social_or_logistic(sentence):                                # SB-2: social, logistic, framing of the call
        forced.append("nothing")
        tags.append("framing_by_code")
    if E.cut_question(sentence):                                      # §3 (2026-11-21): a question cut before its end
        forced.append("nothing")
        tags.append("cut_by_code")
    if E.check_in_question(sentence):                                 # §3 (2026-11-20): "does that make sense?"
        forced.append("nothing")
        tags.append("check_in_by_code")
    if E.closed_restatement(sentence):                                # §3 (2026-11-20): "so your problem is time?"
        forced.append("agreement")
        tags.append("closed_restatement_by_code")
    if E.choice_list_question(sentence):                              # §3 (2026-11-20): "would you rather X or Y?"
        forced.append("sales_list")
        tags.append("choice_list_by_code")
    if forced:
        cands = forced + ([reason] if letter == E.OUT and reason in E.OUT_PRIORITY else [])
        return E.LetterDecision(E.OUT, 1, min(cands, key=E.OUT_PRIORITY.index), sorted(set(tags)))
    return E.LetterDecision(letter, GATE_OF.get(letter, 1), reason, tags)


def build_units(ctx: CallContext, questions: list, drops: Drops) -> list[LUnit]:
    end = ctx.phases.discovery_end
    seen, kept = set(), []
    for q in questions:
        if not isinstance(q, dict):
            drops.add(STEP, "question:not_an_object")
            continue
        tid, quote = q.get("turn") or "", q.get("quote") or ""
        listed = bool(q.get("grouped"))                          # the code's own priority question (SEG-1)
        e = quote_ok(ctx, Evidence(quote, tid, SALES), min_words=1, max_words=400 if listed else 40)
        if e:
            drops.add(STEP, f"question:{e}", q)
            continue
        if end and ctx.n(tid) >= ctx.n(end):                    # SB-34: nothing after the pitch start or price
            drops.add(STEP, "question:after_pitch", q)
            continue
        fg = letter_from_gates(q, quote)
        if q.get("gates") is not None and fg is None:
            drops.add(STEP, "gates:bad_quote", q)                        # the gates' quotes failed: S1's letter stays
        if fg is None and q.get("s1_routing"):                           # no valid gates: S1's gate 0 stands
            drops.add(STEP, "question:routing", q)
            continue
        if fg is None and q.get("s1_unread"):                            # read by nobody: kept, undecided (C4)
            drops.add(STEP, "question:unread_to_review", q)
            q = dict(q, letter=E.OUT, out_reason="absent", gates_status="to_review", unread=True)
        if fg and fg["letter"] in E.ROUTING:                             # gate 0: not a discovery solicitation
            drops.add(STEP, "question:routing", q)
            continue
        if fg and fg["letter"] in ("NOT_SOLICITATION", "ATTRIBUTION_DOUBTFUL"):
            drops.add(STEP, "question:" + fg["letter"].lower(), q)
            continue
        if (fg or q).get("letter") not in E.LETTERS + (E.OUT,):
            drops.add(STEP, "question:bad_letter", q)
            continue
        key = (tid, norm(quote).strip(' .,?!"'))
        if key in seen:                                          # listed twice (overlapping chunks)
            continue
        seen.add(key)
        kept.append(q)
    kept.sort(key=lambda q: (ctx.n(q["turn"]), norm(ctx.turn(q["turn"]).text).find(norm(q["quote"]).strip(' .,?!"'))))
    units: list[LUnit] = []
    rank: dict[str, int] = {}
    turns = [t for t in ctx.turns if not t.attribution_doubtful]
    for q in kept:
        t = ctx.turn(q["turn"])
        rank[t.id] = rank.get(t.id, 0) + 1
        sentence, preamble = sentence_of(t.text, q["quote"])
        d = decide_letter(q, sentence)
        sol = Solicitation(f"Q{t.id[1:]}.{rank[t.id]}", t.id, sentence, tags=list(d.tags))
        i = turns.index(t)
        prev = [x for x in turns[:i] if x.role == PROSPECT][-2:]
        u = LUnit(sol, t, rank[t.id], q["quote"], q, preamble=preamble, prev_prospect=prev, decision=d,
                  window_end=end)
        sol.letter, sol.out_reason, sol.status = d.letter, d.reason, q.get("gates_status") or SINGLE
        if q.get("unread"):
            sol.tags.append("unread")
        units.append(u)
    return units


def place_perimeter(ctx: CallContext, units: list[LUnit]) -> dict:
    """SB-1, SB-2: the first solicitation on the prospect's situation, goals or problems starts it (not social,
    logistic or framing: OUT `nothing`, offer questions, loads); the first pitch start or price ends it (SB-34)."""
    start = None
    for u in units:
        if start is None and E.is_valid_start(u.decision, u.sol.text):
            start = u
        if start is not None:
            u.in_perimeter = True
        else:
            u.sol.tags.append("pre_perimeter")
            u.sol.tags.append("not_coded")
            u.sol.letter = u.sol.out_reason = None
    ctx.phases.discovery_start = start.turn.id if start else None
    return {"start": ctx.phases.discovery_start, "end": ctx.phases.discovery_end, "reopenings": []}


def _attach_atoms(ctx: CallContext, coded: list[LUnit], drops: Drops,
                  listed: Optional[list[LUnit]] = None) -> dict[str, list[dict]]:
    """Each atom goes to the question whose answer span (SB-5 to SB-8, code) holds its turn.

    The atoms are read from every listed question (listed), not only the coded ones: an atom the model put under an OUT
    question ("Ça te va ?") goes to the coded question whose answer holds its turn (LNP, 2026-11-19). SB-8 (Romain,
    2026-11-20): an effect the prospect states in answer to an OUT question (a framing question, a closed question), in
    no coded answer, still counts: it is volunteered speech, attached to the last coded question before it (the first
    one when it comes before the perimeter), for D1 to D4 and never for D5."""
    owner: dict[str, LUnit] = {}
    for u in coded:
        for t in list(u.sol.answer_turns) + list(u.volunteered_turns):
            owner[t] = u
    order = sorted(coded, key=lambda u: ctx.n(u.turn.id))
    end = ctx.phases.discovery_end

    def volunteered_owner(tid: str) -> Optional[LUnit]:
        try:
            t = ctx.turn(tid)
        except KeyError:
            return None
        if not order or t.role != PROSPECT or (end and ctx.n(tid) >= ctx.n(end)):
            return None
        before = [u for u in order if ctx.n(u.turn.id) < ctx.n(tid)]
        u = before[-1] if before else order[0]
        if tid not in u.volunteered_turns:
            u.volunteered_turns.append(tid)
        owner[tid] = u
        return u
    out: dict[str, list[dict]] = {}
    seen = set()
    for u0 in (listed or coded):
        for x in u0.raw.get("atoms") or []:
            if not isinstance(x, dict):
                drops.add(STEP, "atom:not_an_object")
                continue
            k = (x.get("turn"), norm(x.get("quote") or ""), x.get("type"))
            if k in seen:
                continue
            seen.add(k)
            u = owner.get(x.get("turn") or "")
            if u is None and u0 not in coded:                            # SB-8: answered to an OUT question
                u = volunteered_owner(x.get("turn") or "")
            if u is None:
                drops.add(STEP, "atom:outside_answers", x)
                continue
            errs = E._validate_atoms({"atoms": [x]}, ctx, u)
            if errs:
                drops.add(STEP, "atom:" + errs[0].split(":")[0], x)
                continue
            out.setdefault(u.sol.id, []).append(x)
    return out


# the domain the code gives a register it read in the question's words (one per register, SB-26)
REGISTER_DOMAIN = {"financial": "money", "time_load": "time", "identity_status": "future",
                   "mental_emotional": "self_belief", "other": "other"}


def _domain_of(register: str) -> str:
    """The domain the code gives a register its words name; the words of « Sans registre » are the work of today (status)."""
    return "status" if register == "other" else REGISTER_DOMAIN[register]


def _register(ctx: CallContext, u: LUnit, drops: Drops) -> dict:
    q = u.raw
    a = {"asked_domain": q.get("register_domain"), "basis": q.get("register_basis"),
         "quote": q.get("register_quote"), "reference_turn": q.get("register_turn")}
    named = E.lexicon_register_named(u.sol.text)
    # SB-27 by the code (2026-11-21): also when the model reads the register in the question but gives another domain than
    # the one its words name (« tu es à la retraite et tu donnes des cours ? » read as money: the words name identity)
    other = a["basis"] == "named" and named and E.REGISTER_OF_DOMAIN.get(a["asked_domain"]) != named[0]
    unread = a["asked_domain"] is None and a["basis"] is None       # no S1 reading (C4): the question's words, if they name one
    if (a["basis"] in ("answer", "reference", "none") or other or unread) and named:
        # SB-27 by the code (LNP, 2026-11-19): the question names one domain, so the register is read in the question,
        # not in its answer (« pourquoi reprendre une activité à temps plein ? » was given Financial from the answer)
        drops.add(STEP, "register:named_in_question", q)
        a = {"asked_domain": _domain_of(named[0]), "basis": "named", "quote": named[1], "reference_turn": None}
    if a["basis"] == "answer" and a["quote"]:
        # SB-35: the words that show the register are the proof; when the model names no answer turn or another one,
        # the code looks for those words in the answer itself (they must still be the prospect's, in the answer span)
        turns = E._answer_turns(ctx, u)
        if a["reference_turn"] not in {t.id for t in turns}:
            hit = [t.id for t in turns if norm(a["quote"]).strip(' .,?!"') in norm(t.text)]
            if len(hit) == 1:
                drops.add(STEP, "register:turn_found_by_code", q)
                a = dict(a, reference_turn=hit[0])
    answered = E._answer_turns(ctx, u)
    if (unread or (a["basis"] == "none" and answered)) and not named:
        # SB-31 by the code (Romain, 2026-11-21): a neutral question with no register reading, or read « none » though the
        # prospect answered, takes the register the words of the first answer turn name, else Other (it is neutral)
        hit = E.lexicon_register_in(answered[0].text) if answered else None
        if hit:
            drops.add(STEP, "register:answer_words_by_code", q)
            a = {"asked_domain": _domain_of(hit[0]), "basis": "answer", "quote": hit[1], "reference_turn": answered[0].id}
        else:
            drops.add(STEP, "register:other_by_code", q)
            return {"register": "other", "status": SINGLE, "concordance": "1/1", "domain": "other", "basis": "none",
                    "quote": None, "reference_turn": None}
    if a["asked_domain"] is None and a["basis"] is None:
        drops.add(STEP, "register:missing", q)
        errs = ["missing"]
    else:
        errs = E._validate_register(a, ctx, u)                   # SB-32 rules 1 to 3
        if errs:
            drops.add(STEP, "register:" + errs[0].split(":")[0], q)
    ok = not errs
    return {"register": E.decide_register(a) if ok else None, "status": SINGLE if ok else "to_review",
            "concordance": "1/1" if ok else "0/1", "domain": a["asked_domain"] if ok else None,
            "basis": a["basis"] if ok else None, "quote": a["quote"] if ok else None,
            "reference_turn": a["reference_turn"] if ok else None}


def register_summary(decided: dict[str, dict]) -> dict:
    """SB-33 counts. One reading: the 3/3 agreement of the engine is not measured (agreement null, no flag)."""
    n = len(decided)
    return {"counts": {r: sum(1 for d in decided.values() if d["register"] == r) for r in E.REGISTERS},
            "questions": n, "verified": None, "to_review": sum(1 for d in decided.values() if d["status"] == "to_review"),
            "agreement": None, "threshold": E.REGISTER_MIN_AGREEMENT, "flags": [], "single_reading": True,
            "labels": E.REGISTER_LABELS}


@dataclass
class SpinFacts:
    """Read by the Gap step: the stopping questions (GB-30) and the kind of each figure (GB-28, X13)."""
    stopping: dict[str, str] = field(default_factory=dict)       # solicitation id -> exact question quote
    figure_kind: dict[str, Optional[str]] = field(default_factory=dict)   # atom id -> present / loss / past / other


def run_spin(ctx: CallContext, questions: list, drops: Drops) -> tuple[CompetenceResult, SpinFacts]:
    res = CompetenceResult("SPIN", "SPIN-1.3")
    facts = SpinFacts()
    units = build_units(ctx, questions, drops)
    perimeter = place_perimeter(ctx, units)
    coded = [u for u in units if u.in_perimeter and E.is_coded_letter(u.decision.letter)
             and u.sol.status != "to_review"]                          # C4: undecided, left out of every score
    E.answer_spans(ctx, coded, {u.turn.id for u in units})

    # the prospect's answer as quoted by the model: kept only inside the code's answer span
    answer_q: dict[str, dict] = {}
    for u in coded:
        a = u.raw.get("answer")
        if isinstance(a, dict) and a.get("turn"):
            span = set(u.sol.answer_turns) | set(u.volunteered_turns)
            if a["turn"] in span and not quote_ok(ctx, Evidence(a.get("quote") or "", a["turn"], PROSPECT),
                                                  min_words=1, max_words=40):
                answer_q[u.sol.id] = {"turn": a["turn"], "quote": a["quote"]}
            else:
                drops.add(STEP, "answer:outside_span_or_bad_quote", a)

    # atoms (code decision rules on the model's atoms, SB-9..SB-15, SB-22..SB-24)
    raw_by_sol = _attach_atoms(ctx, coded, drops, units)
    atoms: list[Atom] = []
    meta: dict[str, dict] = {}
    atom_log: list[dict] = []
    for u in coded:
        raws = raw_by_sol.get(u.sol.id) or []
        if not raws:
            continue
        new, log = E.build_atoms(ctx, u, raws, len(atoms), meta)
        for a in new:
            raw = next((x for x in raws if x.get("turn") == a.evidence.turn and x.get("quote") == a.evidence.quote), {})
            facts.figure_kind[a.id] = raw.get("figure_kind")
        atoms += new
        atom_log += log
    ctx.atoms = atoms

    # follow-ups (SB-17, SB-19) between consecutive answered coded solicitations
    answered = [u for u in coded if not u.unanswered]
    for prev, nxt in zip(answered, answered[1:]):
        nxt.follows_prev = E.follows_up(prev.answer_text, nxt.sol.text, nxt.preamble)
        prev.sol.followed_up = nxt.follows_prev

    # chains (SB-16 to SB-20): same object = the model's object labels agree, and the code's lexical check
    by_id = {u.sol.id: u for u in coded}
    steps = [E.ChainStep(u.sol.id, u.decision.letter, u.decision.reason,
                         [a for a in atoms if a.solicitation_id == u.sol.id and not a.prompted_by_sales
                          and not a.volunteered], u.follows_prev, u.unanswered) for u in coded]

    def objects(st: E.ChainStep) -> set[str]:
        return {norm(x) for x in [by_id[st.sol_id].raw.get("object")] + [a.object for a in st.atoms] if x}

    def same_object(op: E.ChainStep, chain: list, cand: E.ChainStep) -> bool:
        model = bool(set().union(*[objects(s) for s in chain]) & objects(cand))
        return model and E.lexical_link([by_id[s.sol_id] for s in chain], chain, by_id[cand.sol_id], cand)

    chains = E.find_chains(steps, same_object)

    # registers (SB-26 to SB-35): coded S, P, I, N questions of the discovery
    decided = {u.sol.id: _register(ctx, u, drops) for u in coded if u.decision.letter in E.LETTERS}
    for u in coded:
        if u.raw.get("stopping_question") and u.decision.letter == "P":
            facts.stopping[u.sol.id] = u.quote

    ctx.solicitations = [u.sol for u in units]
    status, reasons, health = E.applicability(units, ctx.phases.discovery_start)
    res.status, res.reasons = status, reasons
    diag = E.diagnostics(units, atoms)
    res.flags += [f"budget_{L}" for L, b in diag["call_budget"].items() if not b["ok"]]
    if any(d["status"] == "to_review" for d in decided.values()):
        res.flags.append("registers_to_review")
    items, _ = E.score_items(atoms, chains, meta)
    if status == "scored":
        res.items = items
        res.score = call_score(items)
    res.concordance = SINGLE
    res.details = {
        "perimeter": perimeter,
        "items_evidence": E.SpinCompetence._evidence_details(ctx, items, atoms) if status == "scored" else {},
        "chains": [{k: v for k, v in c.items() if k != "evidence"} for c in chains],
        "diagnostics": diag,
        "health": health,
        "unit_status": {st: sum(1 for u in units if u.in_perimeter and u.sol.status == st) for st in sorted({u.sol.status for u in units if u.in_perimeter})},
        "atom_decisions": atom_log,
        "solicitations": [{"id": u.sol.id, "turn": u.turn.id, "ts": u.turn.ts, "letter": u.sol.letter,
                           "gate_letter": u.decision.letter, "out_reason": u.sol.out_reason, "gate": u.decision.gate,
                           "tags": u.sol.tags, "in_perimeter": u.in_perimeter, "status": u.sol.status,
                           "answer_turns": u.sol.answer_turns, "followed_up": u.sol.followed_up,
                           "quote": u.quote, "answer": answer_q.get(u.sol.id),
                           "register": (decided.get(u.sol.id) or {}).get("register"),
                           "register_status": (decided.get(u.sol.id) or {}).get("status"),
                           "register_basis": (decided.get(u.sol.id) or {}).get("basis"),
                           "register_domain": (decided.get(u.sol.id) or {}).get("domain"),
                           "register_quote": (decided.get(u.sol.id) or {}).get("quote"),
                           "register_reference_turn": (decided.get(u.sol.id) or {}).get("reference_turn")}
                          for u in units],
        "registers": register_summary(decided),
    }
    return res, facts
