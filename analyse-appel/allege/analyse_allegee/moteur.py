"""La chaîne allégée : fondation (code) → S0 phases → S1 découverte → S2 écart → S3 présentation → S4 objections →
analyse enregistrée de l'appel.

`analyse(ctx, client, config)` rend la même analyse enregistrée que lnp_analyse.chaine_analyse.enregistrement_resultat
(docs/CONTRAT_DE_SORTIE.md), plus `meta` ({"engine": "lite", "version", "steps" : ce que le code a écarté à chaque
étape}). Le modèle reçoit une question par étape sur l'appel entier (S1 par blocs de tours quand la découverte est
longue), toujours avec la transcription comme même préfixe en cache ; le code vérifie chaque citation et décide de chaque
niveau, verdict et note. Un plantage dans une compétence la met `to_review` (raison engine_error) sans arrêter les
autres, comme dans la chaîne de référence.
"""
from __future__ import annotations

import json
from typing import Any, Optional

from . import VERSION_ALLEGEE
from lnp_analyse.competences import presentation as P
from lnp_analyse.noyau.fondation import porte_diarisation
from lnp_analyse.noyau.modeles import ContexteAppel, ResultatCompetence
from lnp_analyse.chaine_analyse import enregistrement_resultat

from .ecart import executer_ecart, texte_enonces
from .objections import executer_objections
from .phases import appliquer_phases
from .presentation import texte_contexte, executer_presentation
from .adaptateur import Rejets
from .spin import FaitsSpin, executer_spin
from .etapes import Etapes, remplir, charger

DEFAUTS: dict[str, Any] = {
    "tier": "fast",                 # crm_ca_config.tiers.fast (claude-haiku-5-5)
    "effort": "low",                # réflexion activée, gardée courte
    "s1_chunk_turns": 160,          # tours de découverte par appel S1 (on coupe de toute façon si une réponse est tronquée)
    "s1_min_chunk_turns": 30,
    "max_tokens": {"S0": 6000, "S1": 16000, "S2": 8000, "S3": 10000, "S4": 10000},
}
REGLES = {"SPIN": "SPIN-1.3", "GAP": "GAP-1.3", "PITCH": "PITCH-2.0", "OBJECTIONS": "OBJ-1.1"}


class ErreurModeleAllege(RuntimeError):
    """Les étapes du modèle ont échoué (aucun JSON valide après une nouvelle demande) sur la carte des phases ou sur la
    plupart des étapes : rien n'est enregistré."""
    final = True


def _ancre(ctx: ContexteAppel, tid: Optional[str]) -> str:
    return f"{tid} ({ctx.tour(tid).ts})" if tid else "aucun"


def ancres(ctx: ContexteAppel) -> str:
    ph = ctx.phases
    return (f"CARTE DES PHASES (décidée par le code) : début de la découverte {_ancre(ctx, ph.debut_decouverte)} ; "
            f"début de la présentation {_ancre(ctx, ph.debut_presentation)} ; premier prix {_ancre(ctx, ph.premier_prix)} ; "
            f"demande de décision {_ancre(ctx, ph.demande_decision)}.")


def _fenetres(ctx: ContexteAppel, taille: int) -> list[tuple[int, int]]:
    fin = ctx.n(ctx.phases.fin_decouverte) if ctx.phases.fin_decouverte else len(ctx.tours)
    return [(a, min(a + taille, fin) - 1) for a in range(0, fin, taille)] if fin else []


def executer_s1(ctx: ContexteAppel, etapes: Etapes, cfg: dict, rejets: Rejets) -> Optional[list]:
    """S1 sur les tours avant le premier début de présentation ou le premier prix, par blocs ; une réponse coupée par
    max_tokens est redemandée en deux moitiés. Rend les questions, ou None si tous les blocs ont échoué."""
    file, sortie, echoue, fait = _fenetres(ctx, cfg["s1_chunk_turns"]), [], 0, 0
    fin = ctx.phases.fin_decouverte
    if not file:                                   # la présentation commence au premier tour : pas de découverte (SPIN §5)
        return []
    while file:
        a, b = file.pop(0)
        ta, tb = ctx.tours[a].id, ctx.tours[b].id
        fenetre = (f"Lis seulement les questions posées dans les tours {ta} à {tb} (leurs réponses peuvent continuer "
                   f"après {tb}). "
                  + (f"Le premier début de présentation ou le premier prix est au tour {fin} : rien à partir de {fin} "
                     f"n'est de la découverte (SB-34)."
                     if fin else "Aucun début de présentation ni aucun prix n'a été trouvé : tout l'appel peut être "
                                 "de la découverte."))
        rep = etapes.demander("lite.s1_discovery", f"{ta}-{tb}", remplir(charger("s1_decouverte"), fenetre=fenetre),
                        cfg["max_tokens"]["S1"], rejouer_tronque=False)
        if rep.reponse is None and rep.raison_arret == "max_tokens" and b - a + 1 > cfg["s1_min_chunk_turns"]:
            milieu = (a + b) // 2
            file[:0] = [(a, milieu), (milieu + 1, b)]
            continue
        if rep.reponse is None:
            echoue += 1
            rejets.ajouter("S1", "chunk_failed")
            continue
        fait += 1
        sortie += [q for q in rep.reponse.get("questions") or []]
    return sortie if fait else None


def _a_revoir(nom_: str, raison: str = "engine_error") -> ResultatCompetence:
    return ResultatCompetence(nom_, REGLES[nom_], statut="to_review", raisons=[raison], concordance="single_reading")


def _sur(ctx: ContexteAppel, nom_: str, fn) -> ResultatCompetence:
    try:
        return fn()
    except Exception as e:  # noqa: BLE001 - un plantage dans une compétence ne bloque jamais les autres
        ctx.audit.append({"competence": nom_, "error": repr(e)[:500]})
        return _a_revoir(nom_)


def analyse(ctx: ContexteAppel, client: Any, config: Optional[dict] = None) -> dict:
    cfg = {**DEFAUTS, **(config or {})}
    cfg["max_tokens"] = {**DEFAUTS["max_tokens"], **((config or {}).get("max_tokens") or {})}
    rejets = Rejets()
    meta = {"engine": "lite", "version": VERSION_ALLEGEE, "tier": cfg["tier"], "effort": cfg["effort"]}
    porte_diarisation(ctx)                                    # C1 (code) ; pas de vérification d'attribution par le modèle en allégé
    if ctx.statut != "ok":
        for nom_, rv in REGLES.items():
            ctx.resultats[nom_] = ResultatCompetence(nom_, rv, statut="excluded", raisons=[ctx.statut])
        return _enregistrement(ctx, meta, rejets)
    etapes = Etapes(client, ctx, palier=cfg["tier"], effort=cfg["effort"])
    echoue: list[str] = []
    tente = ["S0", "S1"]

    # S0 · carte des phases
    s0 = etapes.demander("lite.s0_phases", "call", charger("s0_phases"), cfg["max_tokens"]["S0"])
    if s0.reponse is None:
        raise ErreurModeleAllege(f"carte des phases (S0) : {s0.erreur}")
    appliquer_phases(ctx, s0.reponse, rejets)

    # S1 · découverte → SPIN et la base de faits commune
    questions = executer_s1(ctx, etapes, cfg, rejets)
    faits = FaitsSpin()
    if questions is None:
        echoue.append("S1")
        ctx.resultats["SPIN"] = _a_revoir("SPIN")
    else:
        def spin():
            nonlocal faits
            res, faits = executer_spin(ctx, questions, rejets)
            return res
        ctx.resultats["SPIN"] = _sur(ctx, "SPIN", spin)

    # S2 · écart (a besoin des faits de la découverte)
    if "engine_error" in ctx.resultats["SPIN"].raisons:
        ctx.resultats["GAP"] = _a_revoir("GAP", "engine_error")
    else:
        flimite = ctx.phases.premier_prix or ctx.phases.demande_decision
        consigne = remplir(charger("s2_ecart"), ancres=ancres(ctx), limite=f"le tour {flimite}" if flimite else "la fin de l'appel",
                      enonces=texte_enonces(ctx))
        tente.append("S2")
        s2 = etapes.demander("lite.s2_gap", "call", consigne, cfg["max_tokens"]["S2"])
        if s2.reponse is None:
            echoue.append("S2")
            ctx.resultats["GAP"] = _a_revoir("GAP")
        else:
            ctx.resultats["GAP"] = _sur(ctx, "GAP", lambda: executer_ecart(ctx, s2.reponse, faits, rejets))
    _regles_ecart(ctx, questions, rejets, meta)

    # S3 · présentation (a besoin du résultat de l'écart : P validé, A et B retenus, blocages de la feuille de route)
    if not ctx.phases.debut_presentation:
        ctx.resultats["PITCH"] = _sur(ctx, "PITCH", lambda: P.decider(ctx, {}))          # non applicable (§4)
    else:
        c = texte_contexte(ctx)
        consigne = remplir(charger("s3_presentation"), ancres=ancres(ctx), vp=c["vp"], a=c["a"], b=c["b"], blocages=c["blockers"],
                      references=c["references"])
        tente.append("S3")
        s3 = etapes.demander("lite.s3_pitch", "call", consigne, cfg["max_tokens"]["S3"])
        if s3.reponse is None:
            echoue.append("S3")
            ctx.resultats["PITCH"] = _a_revoir("PITCH")
        else:
            ctx.resultats["PITCH"] = _sur(ctx, "PITCH", lambda: executer_presentation(ctx, s3.reponse, rejets))

    # S4 · objections après le premier prix (OB-27), prévention avant lui ; pas de prix = rien à lire
    if not ctx.phases.premier_prix:
        ctx.resultats["OBJECTIONS"] = ResultatCompetence("OBJECTIONS", REGLES["OBJECTIONS"], statut="not_applicable",
                                                     raisons=["no_resistance_no_price"], concordance="single_reading")
    else:
        tente.append("S4")
        s4 = etapes.demander("lite.s4_objections", "call", remplir(charger("s4_objections"), ancres=ancres(ctx)),
                       cfg["max_tokens"]["S4"])
        if s4.reponse is None:
            echoue.append("S4")
            ctx.resultats["OBJECTIONS"] = _a_revoir("OBJECTIONS")
        else:
            ctx.resultats["OBJECTIONS"] = _sur(ctx, "OBJECTIONS", lambda: executer_objections(ctx, s4.reponse, rejets))

    if len(echoue) * 2 > len(tente):
        raise ErreurModeleAllege(f"{len(echoue)} étapes du modèle sur {len(tente)} sans JSON valide : " + ", ".join(echoue))
    meta["failed_steps"] = echoue
    return _enregistrement(ctx, meta, rejets)


def _regles_ecart(ctx: ContexteAppel, questions: Optional[list], rejets: Rejets, meta: dict) -> None:
    """Romain, 2026-11-03.
    - La découverte finit quand l'écart est fait : avec un écart présent, la fin de la découverte est son tour de
      validation, et SPIN est noté de nouveau sur les questions posées jusqu'à lui (une question après l'écart validé
      n'est pas de la découverte). Sans écart, la découverte finit avant la présentation (SB-1, inchangé).
    - Un appel sans question de découverte, sans présentation et sans prix n'a pas d'écart à faire : non applicable (§4),
      pas absent."""
    g, sp, ph = ctx.resultats.get("GAP"), ctx.resultats.get("SPIN"), ctx.phases
    meta["discovery_end_rule"] = "pitch"
    if g and g.verdict == "present":
        vt = (g.details or {}).get("validation_turn")
        if vt and (not ph.fin_decouverte or ctx.n(vt) < ctx.n(ph.fin_decouverte)):
            ph.fin_decouverte = vt
            meta["discovery_end_rule"] = "gap"
            if questions is not None:
                garde = [q for q in questions if isinstance(q, dict) and q.get("turn") in {t.id for t in ctx.tours}
                        and ctx.n(q["turn"]) < ctx.n(vt)]
                for _ in range(len(questions) - len(garde)):
                    rejets.ajouter("S1", "question:after_gap")
                ctx.resultats["SPIN"] = _sur(ctx, "SPIN", lambda: executer_spin(ctx, garde, Rejets())[0])
    elif g and g.statut == "scored" and sp and sp.statut == "not_applicable" and not ph.debut_presentation and not ph.premier_prix:
        ctx.resultats["GAP"] = ResultatCompetence("GAP", REGLES["GAP"], statut="not_applicable",
                                              raisons=["no_discovery_no_pitch"], concordance="single_reading")


def _enregistrement(ctx: ContexteAppel, meta: dict, rejets: Rejets) -> dict:
    enr = enregistrement_resultat(ctx)
    meta["steps"] = {k: {"dropped": sum(v.values()), "reasons": v} for k, v in rejets.comptes.items()}
    enr["meta"] = meta
    enr["audit"].append({"lite_drops": rejets.exemples})
    json.dumps(enr, default=str)                            # ce que reçoit crm_ca_store
    return enr


def resume(enregistrement: dict) -> str:
    """Une ligne de journal : statut et notes seulement (jamais une citation)."""
    res = enregistrement.get("results") or {}
    parties = [f"{k}={v.get('score') if v.get('score') is not None else v.get('status')}" for k, v in res.items()]
    return f"engine=lite status={enregistrement.get('status')} turns={len(enregistrement.get('turns') or [])} " + " ".join(parties)
