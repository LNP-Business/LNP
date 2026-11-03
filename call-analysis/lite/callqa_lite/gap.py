"""S2 → Gap result (GAP-1.3), computed by the reference engine's GapCompetence on the lite answers.

The engine's closed questions are answered from the S2 step (passages, clauses, validations, deadlines) and from the S1
facts (stopping questions, kinds of figures): gap.restitution (the clauses of the passage whose sales turns are in the
candidate span), gap.validation (the validation the model read on that same prospect turn), gap.a_current (X13: the
figure kind of the atom), gap.stopping (GB-30), gap.horizon (GB-29). Everything else, the verbatim rule GB-22 first, is
the engine's code. The passages the model found and the code inventory missed are added as candidates (signal S5_lite).
"""
from __future__ import annotations

from typing import Any, Optional

from alkimiy_callqa.competences import gap as G
from alkimiy_callqa.core.models import CallContext, CompetenceResult, SALES

from .shim import Drops, StepRunner
from .spin import SpinFacts

STEP = "S2"


def statements_text(ctx: CallContext, limit: int = 160) -> str:
    st = G.statements_from_atoms(ctx, G.window_end(ctx))
    lines = [f"- {comp} [{s.turn}] \"{s.quote}\"" for comp in G.COMPONENTS for s in st[comp]]
    return "\n".join(lines[:limit]) or "(none)"


def _passages(ctx: CallContext, s2: dict, drops: Drops) -> list[dict]:
    out = []
    for p in s2.get("passages") or []:
        if not isinstance(p, dict):
            drops.add(STEP, "passage:not_an_object")
            continue
        turns = []
        for t in p.get("turns") or []:
            try:
                if ctx.turn(t).role == SALES:
                    turns.append(t)
                    continue
            except (KeyError, TypeError):
                pass
            drops.add(STEP, "passage:not_a_sales_turn", {"turn": t})
        for c in p.get("clauses") or []:
            if isinstance(c, dict) and c.get("sales_turn") and c["sales_turn"] not in turns:
                try:
                    if ctx.turn(c["sales_turn"]).role == SALES:
                        turns.append(c["sales_turn"])
                except KeyError:
                    pass
        if turns:
            out.append(dict(p, turns=sorted(set(turns), key=ctx.n)))
    return out


def _clause(c: dict) -> dict:
    """The lite clause fields → the engine's gap.restitution clause (about_prospect, declarative default to true)."""
    return {"component": c.get("component"), "sales_turn": c.get("sales_turn"), "sales_quote": c.get("sales_quote", ""),
            "about_prospect": not c.get("other_person"), "declarative": not c.get("is_question"),
            "source_turn": c.get("source_turn"), "key_expression": c.get("key_expression"),
            "as_holding_back": bool(c.get("as_holding_back"))}


class LiteGap(G.GapCompetence):
    def __init__(self, passages: list[dict]):
        self.passages = passages

    def candidate_spans(self, ctx: CallContext) -> list:
        spans = G.inventory(ctx)
        covered = {t for s in spans for t in s.turns}
        limit = G.post_window_limit(ctx)
        start = ctx.phases.discovery_start
        extra = {}
        for p in self.passages:
            for t in p["turns"]:
                if t in covered or (limit is not None and not ctx.before(t, limit)):
                    continue
                if start and ctx.before(t, start):
                    continue
                extra[t] = ["S5_lite"]
        if extra:
            spans = sorted(spans + G.build_spans(ctx, extra), key=lambda s: ctx.n(s.start))
        return spans


class GapAnswers:
    def __init__(self, ctx: CallContext, passages: list[dict], s2: dict, facts: SpinFacts):
        self.ctx, self.passages, self.facts = ctx, passages, facts
        self.deadlines = [d for d in s2.get("deadlines") or [] if isinstance(d, dict)]

    def _passage(self, span) -> Optional[dict]:
        sales = [t for t in span.turns if self.ctx.turn(t).role == SALES]
        hit = [p for p in self.passages if span.end in p["turns"]]
        return hit[0] if hit else next((p for p in self.passages if set(sales) & set(p["turns"])), None)

    def __call__(self, task_id: str, uid: str, unit: Any) -> Optional[dict]:
        if task_id == "gap.restitution":
            span, _ = unit
            sales = {t for t in span.turns if self.ctx.turn(t).role == SALES}
            clauses = [_clause(c) for p in self.passages for c in p.get("clauses") or []
                       if isinstance(c, dict) and c.get("sales_turn") in sales]
            p = next((p for p in self.passages if span.end in p["turns"]), None)
            ends = bool(p and p.get("ends_with_new_topic_question") and p.get("new_topic_question_quote"))
            return {"clauses": clauses, "ends_with_new_topic_question": ends,
                    "new_topic_question_quote": p.get("new_topic_question_quote") if ends else None}
        if task_id == "gap.validation":
            r, vt = unit
            p = self._passage(r.span)
            v = (p or {}).get("validation")
            if not isinstance(v, dict) or not v.get("outcome"):
                return None                                   # no reading of that turn: to_review (C3 rule 7)
            return {k: v.get(k) for k in ("outcome", "agreement_quote", "content_quote", "content_is_repetition",
                                          "corrected_components", "correction_quote", "emotional_reaction",
                                          "disagreement", "answers_other_question", "addressed_co_decider")
                    if v.get(k) is not None} | {"corrected_components": v.get("corrected_components") or []}
        if task_id == "gap.a_current":
            fk = self.facts.figure_kind.get(unit.atom_id)
            return {"present_state": fk in (None, "present")}
        if task_id == "gap.stopping":
            q = self.facts.stopping.get(unit.id)
            return {"is_stopping_question": bool(q), "quote": q}
        if task_id == "gap.horizon":
            b, tids = unit
            d = next((d for d in self.deadlines if d.get("turn") in tids and d.get("quote")), None)
            if d is None:
                return {"horizon_quote": None, "horizon_turn": None, "horizon": None, "binding": None}
            return {"horizon_quote": d["quote"], "horizon_turn": d["turn"], "horizon": d.get("horizon") or d["quote"],
                    "binding": d.get("binding")}
        return None


def run_gap(ctx: CallContext, s2: dict, facts: SpinFacts, drops: Drops) -> CompetenceResult:
    passages = _passages(ctx, s2, drops)
    runner = StepRunner(GapAnswers(ctx, passages, s2, facts), drops, STEP)
    res = LiteGap(passages).run(ctx, runner)
    res.concordance = "single_reading"
    res.details = dict(res.details or {}, lite={"passages_listed": len(passages),
                                               "units": runner.units, "dropped": drops.counts.get(STEP, {})})
    return res
