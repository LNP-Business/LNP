"""S0 → phase map. The model lists the sales turns with an offer, an amount or a decision cue (the closed answers of the
engine's `foundation.phases` task, for every turn at once); the engine's `decide_phases` places the anchors (PB-1,
PB-2/PB-17, PB-3/PB-18, PB-19, PB-4) and `spin.discovery_end` the end of the discovery (SB-1).

Romain, 2026-11-03, two rules checked by the code before the anchors are placed:
- the first price is said by the sales FOR THE LNP OFFER and goes with its explanation: a price_for_offer turn counts only
  if the model says it is the price of the LNP offer (`lnp_offer_price`) and quotes the SALES turn, at or before it, that
  explains that offer (`offer_explained`, an exact passage); a price the prospect could charge her own students, a market
  price or an ad budget is dropped (`price:not_lnp_offer`, `price:no_offer_explained`);
- an introduction is not the pitch start: an offer mention after which the sales goes back to discovery questions is a
  mention (PB-2), and the code takes it as such when the model quotes that discovery question (`next_discovery_question`,
  an exact passage of a later SALES turn);
- a valid LNP price said before the pitch start found that way belongs to the explanation of the offer: the pitch starts
  at the turn that explains it (or at the price turn).
The end of the discovery is then moved to the gap's validation when a gap is made (engine.py, after S2)."""
from __future__ import annotations

from typing import Optional

from lnp_analyse.competences.spin import fin_decouverte
from lnp_analyse.noyau.fondation import _valider_ph, decider_phases
from lnp_analyse.noyau.modeles import ContexteAppel, Preuve, COMMERCIAL
from lnp_analyse.noyau.texte import citation_ok

from .adaptateur import Rejets

ETAPE = "S0"
SIGNAUX = ("offer_description", "screen_share", "followed_by_discovery", "price_for_offer", "hypothetical",
         "decision_request")


def appliquer_phases(ctx: ContexteAppel, reponse: dict, rejets: Rejets) -> None:
    reponses: dict[str, dict] = {}
    for c in reponse.get("turns") or []:
        if not isinstance(c, dict):
            rejets.ajouter(ETAPE, "not_an_object")
            continue
        try:
            t = ctx.tour(c.get("turn") or "")
        except KeyError:
            rejets.ajouter(ETAPE, "unknown_turn", c)
            continue
        if t.role != COMMERCIAL:
            rejets.ajouter(ETAPE, "wrong_speaker", c)
            continue
        errs = _valider_ph(c, ctx, t)
        if errs:
            rejets.ajouter(ETAPE, errs[0] or "bad_quote", c)
            continue
        prec = reponses.get(t.id)
        if prec:                                  # the same turn listed twice: the closed answers are merged
            for k in SIGNAUX:
                prec[k] = bool(prec.get(k) or c.get(k))
            prec["amount"] = prec.get("amount") or c.get("amount")
            for k in ("next_discovery_question", "lnp_offer_price", "offer_explained"):
                prec[k] = prec.get(k) or c.get(k)
        else:
            reponses[t.id] = dict(c)
    explique = _appliquer_regles(ctx, reponses, rejets)
    decider_phases(ctx, reponses)
    ph = ctx.phases
    if ph.prix_precoce and (not ph.premier_prix or ctx.n(ph.prix_precoce) < ctx.n(ph.premier_prix)):
        debut = explique.get(ph.prix_precoce) or ph.prix_precoce           # the price goes with the offer's explanation
        ph.debut_presentation = min(debut, ph.prix_precoce, key=ctx.n)
        ph.premier_prix, ph.prix_precoce = ph.prix_precoce, None
        ph.signaux.append("pitch_start_from_price")
    elif ph.premier_prix and not ph.debut_presentation:                           # a price with no pitch start: its explanation
        ph.debut_presentation = min(explique.get(ph.premier_prix) or ph.premier_prix, ph.premier_prix, key=ctx.n)
        ph.signaux.append("pitch_start_from_price")
    ph.fin_decouverte = fin_decouverte(ctx)


def _citation_commercial(ctx: ContexteAppel, d: object) -> Optional[str]:
    """The turn of an exact passage of a SALES turn ({turn, quote}), else None."""
    if not isinstance(d, dict) or not d.get("turn") or not d.get("quote"):
        return None
    try:
        t = ctx.tour(d["turn"])
    except KeyError:
        return None
    if t.role != COMMERCIAL or citation_ok(ctx, Preuve(d["quote"], t.id, COMMERCIAL), mots_min=2, mots_max=60):
        return None
    return t.id


def _appliquer_regles(ctx: ContexteAppel, reponses: dict[str, dict], rejets: Rejets) -> dict[str, str]:
    explique: dict[str, str] = {}
    for tid, a in reponses.items():
        if a.get("offer_description") or a.get("screen_share"):
            nq = _citation_commercial(ctx, a.get("next_discovery_question"))
            if nq and ctx.n(nq) > ctx.n(tid):
                a["followed_by_discovery"] = True                          # PB-2: a mention, not the pitch start
            elif a.get("next_discovery_question"):
                rejets.ajouter(ETAPE, "pitch:bad_discovery_quote", a.get("next_discovery_question"))
        if a.get("price_for_offer"):
            if a.get("lnp_offer_price") is not True:
                a["price_for_offer"] = False
                rejets.ajouter(ETAPE, "price:not_lnp_offer", {"turn": tid, "quote": a.get("quote")})
                continue
            ex = _citation_commercial(ctx, a.get("offer_explained"))
            if not ex or ctx.n(ex) > ctx.n(tid):
                a["price_for_offer"] = False
                rejets.ajouter(ETAPE, "price:no_offer_explained", {"turn": tid, "quote": a.get("quote")})
                continue
            explique[tid] = ex
    return explique
