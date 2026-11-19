"""The lite pipeline: foundation (code) → S0 phases → S1 discovery → S2 gap → S3 pitch → S4 objections → call record.

`analyse(ctx, client, config)` returns the same record as lnp_callqa.pipeline.result_record (OUTPUT_CONTRACT.md),
plus `meta` ({"engine": "lite", "version", "steps": what the code dropped per step}). The model is asked one question per
step about the whole call (S1 in chunks of turns on long discoveries), always with the transcript as the same cached
prefix; the code checks every quote and decides every level, verdict and score. A crash in one competence makes it
`to_review` (reason engine_error) without stopping the others, as in the reference pipeline.
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
    "effort": "low",                # thinking on, kept short
    "s1_chunk_turns": 160,          # turns of discovery per S1 call (a split happens anyway if an answer is cut)
    "s1_min_chunk_turns": 30,
    "max_tokens": {"S0": 6000, "S1": 16000, "S2": 8000, "S3": 10000, "S4": 10000},
}
REGLES = {"SPIN": "SPIN-1.3", "GAP": "GAP-1.3", "PITCH": "PITCH-2.0", "OBJECTIONS": "OBJ-1.1"}


class ErreurModeleAllege(RuntimeError):
    """The model steps failed (no valid JSON after a replay) on the phase map or on most steps: nothing is stored."""
    final = True


def _ancre(ctx: ContexteAppel, tid: Optional[str]) -> str:
    return f"{tid} ({ctx.tour(tid).ts})" if tid else "none"


def ancres(ctx: ContexteAppel) -> str:
    ph = ctx.phases
    return (f"PHASE MAP (decided by the code): discovery start {_ancre(ctx, ph.debut_decouverte)}; pitch start "
            f"{_ancre(ctx, ph.debut_presentation)}; first price {_ancre(ctx, ph.premier_prix)}; decision request "
            f"{_ancre(ctx, ph.demande_decision)}.")


def _fenetres(ctx: ContexteAppel, taille: int) -> list[tuple[int, int]]:
    fin = ctx.n(ctx.phases.fin_decouverte) if ctx.phases.fin_decouverte else len(ctx.tours)
    return [(a, min(a + taille, fin) - 1) for a in range(0, fin, taille)] if fin else []


def executer_s1(ctx: ContexteAppel, etapes: Etapes, cfg: dict, rejets: Rejets) -> Optional[list]:
    """S1 over the turns before the first pitch start or price, in chunks; an answer cut by max_tokens is asked again
    as two halves. Returns the questions, or None if every chunk failed."""
    file, sortie, echoue, fait = _fenetres(ctx, cfg["s1_chunk_turns"]), [], 0, 0
    fin = ctx.phases.fin_decouverte
    if not file:                                   # the pitch starts at the first turn: no discovery (SPIN §5)
        return []
    while file:
        a, b = file.pop(0)
        ta, tb = ctx.tours[a].id, ctx.tours[b].id
        fenetre = (f"Read the questions asked in turns {ta} to {tb} only (their answers may continue after {tb}). "
                  + (f"The first pitch start or price is at {fin}: nothing from {fin} on is discovery (SB-34)."
                     if fin else "No pitch start or price was found: the whole call can be discovery."))
        rep = etapes.demander("lite.s1_discovery", f"{ta}-{tb}", remplir(charger("s1_discovery"), fenetre=fenetre),
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
    except Exception as e:  # noqa: BLE001 - a crash in one competence never blocks the others
        ctx.audit.append({"competence": nom_, "error": repr(e)[:500]})
        return _a_revoir(nom_)


def analyse(ctx: ContexteAppel, client: Any, config: Optional[dict] = None) -> dict:
    cfg = {**DEFAUTS, **(config or {})}
    cfg["max_tokens"] = {**DEFAUTS["max_tokens"], **((config or {}).get("max_tokens") or {})}
    rejets = Rejets()
    meta = {"engine": "lite", "version": VERSION_ALLEGEE, "tier": cfg["tier"], "effort": cfg["effort"]}
    porte_diarisation(ctx)                                    # C1 (code); no model attribution check in lite
    if ctx.statut != "ok":
        for nom_, rv in REGLES.items():
            ctx.resultats[nom_] = ResultatCompetence(nom_, rv, statut="excluded", raisons=[ctx.statut])
        return _enregistrement(ctx, meta, rejets)
    etapes = Etapes(client, ctx, palier=cfg["tier"], effort=cfg["effort"])
    echoue: list[str] = []
    tente = ["S0", "S1"]

    # S0 · phase map
    s0 = etapes.demander("lite.s0_phases", "call", charger("s0_phases"), cfg["max_tokens"]["S0"])
    if s0.reponse is None:
        raise ErreurModeleAllege(f"phase map (S0): {s0.erreur}")
    appliquer_phases(ctx, s0.reponse, rejets)

    # S1 · discovery → SPIN and the shared fact base
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

    # S2 · gap (needs the discovery facts)
    if "engine_error" in ctx.resultats["SPIN"].raisons:
        ctx.resultats["GAP"] = _a_revoir("GAP", "engine_error")
    else:
        flimite = ctx.phases.premier_prix or ctx.phases.demande_decision
        consigne = remplir(charger("s2_gap"), ancres=ancres(ctx), limite=f"turn {flimite}" if flimite else "the end of the call",
                      enonces=texte_enonces(ctx))
        tente.append("S2")
        s2 = etapes.demander("lite.s2_gap", "call", consigne, cfg["max_tokens"]["S2"])
        if s2.reponse is None:
            echoue.append("S2")
            ctx.resultats["GAP"] = _a_revoir("GAP")
        else:
            ctx.resultats["GAP"] = _sur(ctx, "GAP", lambda: executer_ecart(ctx, s2.reponse, faits, rejets))
    _regles_ecart(ctx, questions, rejets, meta)

    # S3 · pitch (needs the Gap result: validated P, selected A and B, roadmap blockers)
    if not ctx.phases.debut_presentation:
        ctx.resultats["PITCH"] = _sur(ctx, "PITCH", lambda: P.decider(ctx, {}))          # not applicable (§4)
    else:
        c = texte_contexte(ctx)
        consigne = remplir(charger("s3_pitch"), ancres=ancres(ctx), vp=c["vp"], a=c["a"], b=c["b"], blocages=c["blockers"],
                      references=c["references"])
        tente.append("S3")
        s3 = etapes.demander("lite.s3_pitch", "call", consigne, cfg["max_tokens"]["S3"])
        if s3.reponse is None:
            echoue.append("S3")
            ctx.resultats["PITCH"] = _a_revoir("PITCH")
        else:
            ctx.resultats["PITCH"] = _sur(ctx, "PITCH", lambda: executer_presentation(ctx, s3.reponse, rejets))

    # S4 · objections after the first price (OB-27), prevention before it; no price = nothing to read
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
        raise ErreurModeleAllege(f"{len(echoue)} of {len(tente)} model steps gave no valid JSON: " + ", ".join(echoue))
    meta["failed_steps"] = echoue
    return _enregistrement(ctx, meta, rejets)


def _regles_ecart(ctx: ContexteAppel, questions: Optional[list], rejets: Rejets, meta: dict) -> None:
    """Romain, 2026-11-03.
    - The discovery ends when the gap is made: with a gap present, the end of the discovery is its validation turn, and
      SPIN is scored again on the questions asked up to it (a question after the validated gap is not discovery).
      With no gap, the discovery ends before the pitch (SB-1, unchanged).
    - A call with no discovery question, no pitch and no price has no gap to make: not applicable (§4), not absent."""
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
    json.dumps(enr, default=str)                            # what crm_ca_store receives
    return enr


def resume(enregistrement: dict) -> str:
    """One log line: status and scores only (never a quote)."""
    res = enregistrement.get("results") or {}
    parties = [f"{k}={v.get('score') if v.get('score') is not None else v.get('status')}" for k, v in res.items()]
    return f"engine=lite status={enregistrement.get('status')} turns={len(enregistrement.get('turns') or [])} " + " ".join(parties)
