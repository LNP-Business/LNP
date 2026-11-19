"""S3 → résultat de la présentation (PITCH-2.0), calculé par CompetencePresentation du moteur de référence sur les
réponses du moteur allégé.

L'étape S3 répond, en un appel, aux questions fermées que le moteur pose une par une : la catégorie du P validé (PB-27),
les étapes 1 à 4 (PB-28 à PB-31), la feuille de route (PB-34), les affirmations (PB-35), les promesses de résultat
(PB-36) et les passages d'adhésion (PB-14 à PB-16). Les réponses en liste sont coupées selon les blocs de tours du
moteur. La porte de conformité (présentation après le oui, PB-37 ; affirmations hors de son écart ou de l'offre ;
promesses de résultat), chaque vérification d'étape et chaque niveau sont le code du moteur : le modèle ne dit jamais si
la présentation est venue après l'écart ni si elle est conforme.
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
    """Ce que la consigne S3 reçoit des étapes précédentes (le résultat de l'écart) et des références."""
    g = P._ecart(ctx)
    vider = lambda x: json.dumps(x, ensure_ascii=False) if x else "aucun"          # noqa: E731
    vp = g.get("validated_P")
    ref = {k: v for k, v in (ctx.reference_offre or {}).items() if k != "mechanisms"}
    refs = "\n".join(["RÉFÉRENCE DE L'OFFRE : " + (json.dumps(ref, ensure_ascii=False) if ref else "absente"),
                      P._texte_reference_meca(ctx), P._texte_bibliotheque(ctx)])
    blocages = [{"quote": b.get("quote"), "turn": b.get("turn")} for b in g.get("roadmap_blockers") or []]
    return {"vp": vider({"quote": vp.get("quote"), "turn": vp.get("turn"), "key_expression": vp.get("key_expression")})
            if vp else "aucun (pas de catégorie à donner)",
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
    """S3 répondue : le moteur décide. Les items listés hors de tous les blocs de la fenêtre de la présentation (avant le
    début de la présentation ou après la demande de décision) sont écartés et comptés."""
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
