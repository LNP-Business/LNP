"""S0 → carte des phases. Le modèle liste les tours du commercial avec une offre, un montant ou un signe de décision (les
réponses fermées de la tâche `foundation.phases` du moteur, pour tous les tours à la fois) ; `decider_phases` du moteur
place les repères (PB-1, PB-2/PB-17, PB-3/PB-18, PB-19, PB-4) et `spin.fin_decouverte` la fin de la découverte (SB-1).

Romain, 2026-11-03, trois règles vérifiées par le code avant que les repères soient placés :
- le premier prix est dit par le commercial POUR L'OFFRE LNP et va avec son explication : un tour price_for_offer ne
  compte que si le modèle dit que c'est le prix de l'offre LNP (`lnp_offer_price`) et cite le tour SALES, à ce tour ou
  avant, qui explique cette offre (`offer_explained`, un extrait exact) ; un prix que la prospecte pourrait demander à ses
  propres élèves, un prix du marché ou un budget de publicité est écarté (`price:not_lnp_offer`,
  `price:no_offer_explained`) ;
- une introduction n'est pas le début de la présentation : une mention de l'offre après laquelle le commercial revient à
  des questions de découverte est une mention (PB-2), et le code la prend comme telle quand le modèle cite cette question
  de découverte (`next_discovery_question`, un extrait exact d'un tour SALES suivant) ;
- un prix LNP valide dit avant le début de la présentation trouvé ainsi appartient à l'explication de l'offre : la
  présentation commence au tour qui l'explique (ou au tour du prix).
La fin de la découverte est ensuite déplacée à la validation de l'écart quand un écart est fait (moteur.py, après S2)."""
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
        if prec:                                  # le même tour listé deux fois : les réponses fermées sont réunies
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
        debut = explique.get(ph.prix_precoce) or ph.prix_precoce           # le prix va avec l'explication de l'offre
        ph.debut_presentation = min(debut, ph.prix_precoce, key=ctx.n)
        ph.premier_prix, ph.prix_precoce = ph.prix_precoce, None
        ph.signaux.append("pitch_start_from_price")
    elif ph.premier_prix and not ph.debut_presentation:                           # un prix sans début de présentation : son explication
        ph.debut_presentation = min(explique.get(ph.premier_prix) or ph.premier_prix, ph.premier_prix, key=ctx.n)
        ph.signaux.append("pitch_start_from_price")
    ph.fin_decouverte = fin_decouverte(ctx)


def _citation_commercial(ctx: ContexteAppel, d: object) -> Optional[str]:
    """Le tour d'un extrait exact d'un tour SALES ({turn, quote}), sinon None."""
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
                a["followed_by_discovery"] = True                          # PB-2 : une mention, pas le début de la présentation
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
