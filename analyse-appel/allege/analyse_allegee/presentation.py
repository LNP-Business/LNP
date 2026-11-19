"""S3 → Pitch result (PITCH-2.0), computed by the reference engine's PitchCompetence on the lite answers.

The S3 step answers, in one call, the closed questions the engine asks one by one: the category of the validated P
(PB-27), steps 1 to 4 (PB-28 to PB-31), the roadmap (PB-34), the claims (PB-35), the outcome promises (PB-36) and the
adhesion passages (PB-14 to PB-16). The list answers are cut into the engine's chunks by turn. The compliance gate (pitch
after the yes, PB-37; claims outside his gap or the offer; outcome promises), every step check and every level are the
engine's code: the model never says whether the pitch came after the gap or is compliant.
"""
from __future__ import annotations

import json
from typing import Any, Optional

from lnp_analyse.competences import presentation as P
from lnp_analyse.noyau.modeles import ContexteAppel, ResultatCompetence

from .adaptateur import Rejets, ExecuteurEtape

ETAPE = "S3"
LISTES = {"pitch.claims": ("claims", "claims"), "pitch.promises": ("promises", "promises"),
         "pitch.adhesion": ("adhesion", "passages")}
UNIQUE = {"pitch.step1": "step1", "pitch.step2": "step2", "pitch.step3": "step3", "pitch.step4": "step4",
          "pitch.roadmap": "roadmap"}


def texte_contexte(ctx: ContexteAppel) -> dict[str, str]:
    """What the S3 prompt is told of the earlier stages (the Gap result) and of the references."""
    g = P._ecart(ctx)
    vider = lambda x: json.dumps(x, ensure_ascii=False) if x else "none"          # noqa: E731
    vp = g.get("validated_P")
    ref = {k: v for k, v in (ctx.reference_offre or {}).items() if k != "mechanisms"}
    refs = "\n".join(["OFFER REFERENCE: " + (json.dumps(ref, ensure_ascii=False) if ref else "missing"),
                      P._texte_reference_meca(ctx), P._texte_bibliotheque(ctx)])
    blocages = [{"quote": b.get("quote"), "turn": b.get("turn")} for b in g.get("roadmap_blockers") or []]
    return {"vp": vider({"quote": vp.get("quote"), "turn": vp.get("turn"), "key_expression": vp.get("key_expression")})
            if vp else "none (no category to give)",
            "a": vider(g.get("selected_A")), "b": vider(g.get("selected_B")), "blockers": vider(blocages), "references": refs}


class ReponsesPresentation:
    def __init__(self, ctx: ContexteAppel, s3: dict):
        self.ctx, self.s3 = ctx, s3

    def __call__(self, id_tache: str, uid: str, unite: Any) -> Optional[dict]:
        if id_tache == "pitch.p_category":
            c = self.s3.get("category")
            return c if isinstance(c, dict) and c.get("category") else None
        if id_tache in UNIQUE:
            v = self.s3.get(UNIQUE[id_tache])
            return v if isinstance(v, dict) else {}
        if id_tache in LISTES:
            cle, champ = LISTES[id_tache]
            a, b = unite
            lo, hi = self.ctx.n(a), self.ctx.n(b)
            items = []
            for x in self.s3.get(cle) or []:
                try:
                    if isinstance(x, dict) and lo <= self.ctx.n(x.get("turn")) <= hi:
                        items.append(x)
                except (KeyError, TypeError):
                    continue
            return {champ: items}
        return None


def executer_presentation(ctx: ContexteAppel, s3: dict, rejets: Rejets) -> ResultatCompetence:
    """S3 answered: the engine decides. Items listed outside every chunk of the pitch window (before the pitch start or
    after the decision request) are dropped and counted."""
    comp = P.CompetencePresentation()
    fenetre = {t for a, b in P.blocs(ctx, comp.cfg["chunk_turns"]) for t in
              (x.id for x in ctx.tours[ctx.n(a): ctx.n(b) + 1])} if ctx.phases.debut_presentation else set()
    for cle, _ in LISTES.values():
        for x in s3.get(cle) or []:
            if not (isinstance(x, dict) and x.get("turn") in fenetre):
                rejets.ajouter(ETAPE, f"{cle}:outside_pitch_window", x if isinstance(x, dict) else None)
    executeur = ExecuteurEtape(ReponsesPresentation(ctx, s3), rejets, ETAPE)
    res = comp.executer(ctx, executeur)
    res.concordance = "single_reading" if res.concordance else None
    res.details = dict(res.details or {}, lite={"units": executeur.unites, "dropped": rejets.comptes.get(ETAPE, {})})
    return res
