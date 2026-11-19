"""S2 → Gap result (GAP-1.3), computed by the reference engine's GapCompetence on the lite answers.

The engine's closed questions are answered from the S2 step (passages, clauses, validations, deadlines) and from the S1
facts (stopping questions, kinds of figures): gap.restitution (the clauses of the passage whose sales turns are in the
candidate span), gap.validation (the validation the model read on that same prospect turn), gap.a_current (X13: the
figure kind of the atom), gap.stopping (GB-30), gap.horizon (GB-29). Everything else, the verbatim rule GB-22 first, is
the engine's code. The passages the model found and the code inventory missed are added as candidates (signal S5_lite).
"""
from __future__ import annotations

from typing import Any, Optional

from lnp_analyse.competences import ecart as G
from lnp_analyse.noyau.modeles import ContexteAppel, ResultatCompetence, COMMERCIAL
from lnp_analyse.noyau.texte import expression_cle_ok

from .adaptateur import Rejets, ExecuteurEtape
from .spin import FaitsSpin

ETAPE = "S2"


def texte_enonces(ctx: ContexteAppel, limite: int = 160) -> str:
    st = G.enonces_depuis_atomes(ctx, G.fin_fenetre(ctx))
    lignes = [f"- {comp} [{s.tour}] \"{s.citation}\"" for comp in G.COMPOSANTES for s in st[comp]]
    return "\n".join(lignes[:limite]) or "(none)"


def _passages(ctx: ContexteAppel, s2: dict, rejets: Rejets) -> list[dict]:
    sortie = []
    for p in s2.get("passages") or []:
        if not isinstance(p, dict):
            rejets.ajouter(ETAPE, "passage:not_an_object")
            continue
        tours = []
        for t in p.get("turns") or []:
            try:
                if ctx.tour(t).role == COMMERCIAL:
                    tours.append(t)
                    continue
            except (KeyError, TypeError):
                pass
            rejets.ajouter(ETAPE, "passage:not_a_sales_turn", {"turn": t})
        for c in p.get("clauses") or []:
            if isinstance(c, dict) and c.get("sales_turn") and c["sales_turn"] not in tours:
                try:
                    if ctx.tour(c["sales_turn"]).role == COMMERCIAL:
                        tours.append(c["sales_turn"])
                except KeyError:
                    pass
        if tours:
            sortie.append(dict(p, turns=sorted(set(tours), key=ctx.n)))
    return sortie


def expression_cle_partagee(expression_cle: str, texte_source: str, citation_commercial: str) -> Optional[str]:
    """GB-22 checked by the code on the model's key expression: when the whole expression is not in the sales words (the
    model copied the prospect's whole sentence, "quelques 10% de ce qui coûte" for "10% de ce que coûte"), the longest
    run of its words that is in the source and in the sales clause (with GB-22's transformations) and is not generic
    (GB-22 d) is taken instead. Only words of the model's expression are tried, so it still carries the component (c).
    Romain 2026-11-03 (Anastasia's call)."""
    ke = (expression_cle or "").split()
    if not ke or not texte_source or expression_cle_ok(expression_cle, texte_source, citation_commercial)[0]:
        return None
    for n in range(len(ke) - 1, 0, -1):
        for i in range(0, len(ke) - n + 1):
            cand = " ".join(ke[i:i + n])
            if expression_cle_ok(cand, texte_source, citation_commercial)[0]:
                return cand
    return None


def _proposition(c: dict, ctx: Optional[ContexteAppel] = None, rejets: Optional[Rejets] = None) -> dict:
    """The lite clause fields → the engine's gap.restitution clause (about_prospect, declarative default to true)."""
    ke = c.get("key_expression")
    if ctx is not None and ke and c.get("source_turn"):
        try:
            src = ctx.tour(c["source_turn"]).texte
        except KeyError:
            src = ""
        mieux = expression_cle_partagee(ke, src, c.get("sales_quote", ""))
        if mieux:
            ke = mieux
            if rejets is not None:
                rejets.ajouter(ETAPE, "key_expression:narrowed_by_code")
    return {"component": c.get("component"), "sales_turn": c.get("sales_turn"), "sales_quote": c.get("sales_quote", ""),
            "about_prospect": not c.get("other_person"), "declarative": not c.get("is_question"),
            "source_turn": c.get("source_turn"), "key_expression": ke,
            "as_holding_back": bool(c.get("as_holding_back"))}


class EcartAllege(G.CompetenceEcart):
    def __init__(self, passages: list[dict]):
        self.passages = passages

    def plages_candidates(self, ctx: ContexteAppel) -> list:
        plages = G.inventaire(ctx)
        couvert = {t for s in plages for t in s.tours}
        limite = G.limite_fenetre_apres(ctx)
        debut = ctx.phases.debut_decouverte
        sup = {}
        for p in self.passages:
            for t in p["turns"]:
                if t in couvert or (limite is not None and not ctx.avant(t, limite)):
                    continue
                if debut and ctx.avant(t, debut):
                    continue
                sup[t] = ["S5_lite"]
        if sup:
            plages = sorted(plages + G.construire_plages(ctx, sup), key=lambda s: ctx.n(s.debut))
        return plages


class ReponsesEcart:
    def __init__(self, ctx: ContexteAppel, passages: list[dict], s2: dict, faits: FaitsSpin, rejets: Optional[Rejets] = None):
        self.ctx, self.passages, self.faits, self.rejets = ctx, passages, faits, rejets
        self.echeances = [d for d in s2.get("deadlines") or [] if isinstance(d, dict)]

    def _passage(self, plage) -> Optional[dict]:
        commercial = [t for t in plage.tours if self.ctx.tour(t).role == COMMERCIAL]
        touche = [p for p in self.passages if plage.fin in p["turns"]]
        return touche[0] if touche else next((p for p in self.passages if set(commercial) & set(p["turns"])), None)

    def __call__(self, id_tache: str, uid: str, unite: Any) -> Optional[dict]:
        if id_tache == "gap.restitution":
            plage, _ = unite
            commercial = {t for t in plage.tours if self.ctx.tour(t).role == COMMERCIAL}
            propositions = [_proposition(c, self.ctx, self.rejets) for p in self.passages for c in p.get("clauses") or []
                       if isinstance(c, dict) and c.get("sales_turn") in commercial]
            p = next((p for p in self.passages if plage.fin in p["turns"]), None)
            fins = bool(p and p.get("ends_with_new_topic_question") and p.get("new_topic_question_quote"))
            return {"clauses": propositions, "ends_with_new_topic_question": fins,
                    "new_topic_question_quote": p.get("new_topic_question_quote") if fins else None}
        if id_tache == "gap.validation":
            r, vt = unite
            p = self._passage(r.plage)
            v = (p or {}).get("validation")
            if not isinstance(v, dict) or not v.get("outcome"):
                return None                                   # no reading of that turn: to_review (C3 rule 7)
            return {k: v.get(k) for k in ("outcome", "agreement_quote", "content_quote", "content_is_repetition",
                                          "corrected_components", "correction_quote", "emotional_reaction",
                                          "disagreement", "answers_other_question", "addressed_co_decider")
                    if v.get(k) is not None} | {"corrected_components": v.get("corrected_components") or []}
        if id_tache == "gap.a_current":
            fk = self.faits.type_chiffre.get(unite.id_atome)
            return {"present_state": fk in (None, "present")}
        if id_tache == "gap.stopping":
            q = self.faits.blocage.get(unite.id)
            return {"is_stopping_question": bool(q), "quote": q}
        if id_tache == "gap.horizon":
            b, tids = unite
            d = next((d for d in self.echeances if d.get("turn") in tids and d.get("quote")), None)
            if d is None:
                return {"horizon_quote": None, "horizon_turn": None, "horizon": None, "binding": None}
            return {"horizon_quote": d["quote"], "horizon_turn": d["turn"], "horizon": d.get("horizon") or d["quote"],
                    "binding": d.get("binding")}
        return None


def executer_ecart(ctx: ContexteAppel, s2: dict, faits: FaitsSpin, rejets: Rejets) -> ResultatCompetence:
    passages = _passages(ctx, s2, rejets)
    executeur = ExecuteurEtape(ReponsesEcart(ctx, passages, s2, faits, rejets), rejets, ETAPE)
    res = EcartAllege(passages).executer(ctx, executeur)
    res.concordance = "single_reading"
    res.details = dict(res.details or {}, lite={"passages_listed": len(passages),
                                               "units": executeur.unites, "dropped": rejets.comptes.get(ETAPE, {})})
    return res
