"""S2 → résultat de l'écart (GAP-1.3), calculé par CompetenceEcart du moteur de référence sur les réponses du moteur
allégé.

Les questions fermées du moteur reçoivent leur réponse de l'étape S2 (passages, propositions, validations, échéances) et
des faits de S1 (questions sur ce qui arrête le prospect, nature des chiffres) : gap.restitution (les propositions du
passage dont les tours du commercial sont dans la plage candidate), gap.validation (la validation que le modèle a lue sur
ce même tour du prospect), gap.a_current (X13 : la nature du chiffre de l'atome), gap.stopping (GB-30), gap.horizon
(GB-29). Tout le reste, à commencer par la règle du mot pour mot GB-22, est le code du moteur. Les passages que le modèle
a trouvés et que l'inventaire du code a manqués sont ajoutés comme candidats (signal S5_lite).
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
    return "\n".join(lignes[:limite]) or "(aucun)"


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
    """GB-22 vérifiée par le code sur l'expression clé du modèle : quand l'expression entière n'est pas dans les mots du
    commercial (le modèle a copié toute la phrase du prospect, « quelques 10% de ce qui coûte » pour « 10% de ce que
    coûte »), on prend à sa place la plus longue suite de ses mots qui est dans la source et dans la proposition du
    commercial (avec les transformations de GB-22) et qui n'est pas générique (GB-22 d). Seuls les mots de l'expression du
    modèle sont essayés, donc elle porte toujours la composante (c). Romain 2026-11-03 (l'appel d'Anastasia)."""
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
    """Les champs de la proposition du moteur allégé → la proposition gap.restitution du moteur (about_prospect et
    declarative valent true par défaut)."""
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
                return None                                   # pas de lecture de ce tour : to_review (C3, règle 7)
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
