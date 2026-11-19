"""Shared foundation, computed once per call before any competence (stages S0, C1, S2).

S0  parse and normalise the transcript into numbered turns
C1  diarization quality gate + attribution check (merged / swapped / echo turns) and repair
S2  phase map: pitch start, offer mentions, first price, early price, decision request (Pitch annex PB-1..PB-4,
    PB-17..PB-19). The discovery start is set by the SPIN module (SB-1/SB-2).
"""
from __future__ import annotations

import re
from typing import Any, Optional

from .modeles import ContexteAppel, Preuve, AUTRE, PROSPECT, COMMERCIAL, Tour
from .executeur import TacheModele, Executeur
from .texte import normaliser, citation_ok

LIGNE = re.compile(r"^\[?(?:T\d+\s+)?(\d{1,2}:\d{2}(?::\d{2})?)\]?\s*([^:]{1,80}):\s*(.*)$")


# ------------------------------------------------------------------------------------------- S0
def lire_transcription(brut: str, carte_locuteurs: dict[str, str]) -> list[Tour]:
    """Lines like "[00:06] Valentino Dooneson-Pereira: text". Unknown speakers map to OTHER.
    Consecutive lines of the same speaker are joined (wrapped lines)."""
    tours: list[Tour] = []
    for ligne in brut.splitlines():
        ligne = ligne.strip()
        if not ligne:
            continue
        m = LIGNE.match(ligne)
        if not m:
            if tours:
                tours[-1].texte += " " + ligne
            continue
        ts, loc, texte = m.groups()
        role = carte_locuteurs.get(loc.strip(), AUTRE)
        if role not in (COMMERCIAL, PROSPECT, AUTRE):
            role = {"sales": COMMERCIAL, "prospect": PROSPECT}.get(role.lower(), AUTRE)
        if tours and tours[-1].locuteur == loc.strip():
            tours[-1].texte += " " + texte
            continue
        n = len(tours) + 1
        tours.append(Tour(f"T{n:03d}", n, ts, loc.strip(), role, re.sub(r"\s+", " ", texte).strip()))
    return tours


def porte_diarisation(ctx: ContexteAppel, part_max: float = 0.92, mots_min_prospect: int = 150) -> None:
    if not ctx.tours:
        ctx.statut = "no_transcript"
        return
    if not any(t.role == COMMERCIAL for t in ctx.tours) or not any(t.role == PROSPECT for t in ctx.tours):
        ctx.statut = "no_diarization"
        return
    w = {COMMERCIAL: 0, PROSPECT: 0, AUTRE: 0}
    for t in ctx.tours:
        w[t.role] += len(t.texte.split())
    tot = sum(w.values()) or 1
    if max(w.values()) / tot > part_max or w[PROSPECT] < mots_min_prospect:
        ctx.statut = "diarization_suspect"
        ctx.signaux.append("diarization_share")


# ------------------------------------------------------------------------------------------- C1
def _construire_attr(ctx: ContexteAppel, bloc_: list[Tour]) -> str:
    return ("Read each turn against its speaker label and list every case of: (1) merged turn (a turn that "
            "contains the other role's speech), (2) swapped turn (content that can only belong to the other role), "
            "(3) echo (the same sentence under both labels within 3 turns).\n"
            "For a merged turn, give `boundary_quote`: the exact words where the other role's speech starts, and "
            "`foreign_quote`: the exact foreign part. Answer JSON: {\"cases\": [{\"turn\": \"T012\", \"type\": "
            "\"merged|swapped|echo\", \"foreign_quote\": \"...\", \"boundary_quote\": \"...\"}]}\n\nTRANSCRIPT\n" +
            "\n".join(f"[{t.id} {t.ts}] {t.role}: {t.texte}" for t in bloc_))


def _valider_attr(rep: dict, ctx: ContexteAppel, unite: Any) -> list[str]:
    errs = []
    for c in rep.get("cases", []):
        if c.get("type") not in ("merged", "swapped", "echo"):
            errs.append("bad_type")
        elif citation_ok(ctx, Preuve(c.get("foreign_quote", ""), c.get("turn", "")), mots_min=1, mots_max=200):
            errs.append(f"bad_quote:{c.get('turn')}")
    return errs


ATTRIBUTION = TacheModele("foundation.attribution", "fast", "fondation_attribution", _construire_attr, _valider_attr,
                        cle=lambda a: sorted((c["turn"], c["type"]) for c in a.get("cases", [])))


def reparer_attribution(ctx: ContexteAppel, cas_: list[dict]) -> None:
    """Split merged turns at the quoted boundary, relabel swapped turns, drop echoes. Turn ids are kept stable:
    the foreign part of a merged turn becomes a sub-turn "T050b" inserted right after (ids stay sortable)."""
    par_id = {t.id: t for t in ctx.tours}
    nouveaux_tours: list[Tour] = []
    touche_ = set()
    for t in ctx.tours:
        cs = [c for c in cas_ if c.get("turn") == t.id]
        if not cs:
            nouveaux_tours.append(t)
            continue
        touche_.add(t.id)
        c = cs[0]
        autre = COMMERCIAL if t.role == PROSPECT else PROSPECT
        if c["type"] == "swapped":
            t.role, t.repare = autre, True
            nouveaux_tours.append(t)
        elif c["type"] == "echo":
            t.attribution_douteuse = True       # the echoed copy is excluded from every computation
            nouveaux_tours.append(t)
        else:
            fq = c.get("foreign_quote", "")
            i = normaliser(t.texte).find(normaliser(fq))
            if i < 0:
                t.attribution_douteuse = True
                nouveaux_tours.append(t)
                continue
            brut = t.texte
            # map normalised index back approximately on the raw text (same length after whitespace collapse)
            n_brut = re.sub(r"\s+", " ", brut)
            propre_a, etranger, propre_b = n_brut[:i].strip(), n_brut[i:i + len(fq)].strip(), n_brut[i + len(fq):].strip()
            t.texte, t.repare = (propre_a + " " + propre_b).strip() or propre_a, True
            nouveaux_tours.append(t)
            nouveaux_tours.append(Tour(t.id + "b", t.n, t.ts, t.locuteur, autre, etranger, repare=True))
    ctx.tours = nouveaux_tours
    taux = len(touche_) / max(1, len({t.n for t in ctx.tours}))
    if taux > 0.10:
        ctx.statut = "diarization_suspect"
        ctx.signaux.append("attribution_rate")


def executer_attribution(ctx: ContexteAppel, executeur: Executeur, taille_bloc: int = 60) -> None:
    cas_: list[dict] = []
    for k in range(0, len(ctx.tours), taille_bloc):
        bloc_ = ctx.tours[k:k + taille_bloc]
        res = executeur.executer(ctx, ATTRIBUTION, f"attr:{bloc_[0].id}", bloc_)
        if res.reponse:
            cas_ += res.reponse.get("cases", [])
    reparer_attribution(ctx, cas_)


# ------------------------------------------------------------------------------------------- S2 phase map
INDICES_OFFRE = re.compile(r"\b(the program|the mentorship|the academy|what we do|the way we help|how it works|"
                        r"pillar|module|six-month|6-month|let me show you|share my screen|my screen)\b", re.I)
MONTANT = re.compile(r"(\$\s?\d[\d,.]*\s?(k|grand)?|\b\d[\d,.]*\s?(k|grand|dollars|usd|euros?)\b|\b\d{1,3},\d{3}\b)", re.I)
DECISION = re.compile(r"\b(ready to (get started|move forward|start)|what would you like to do|do you want to "
                      r"(join|move forward|get started)|shall we get you started|how would you like to proceed)\b", re.I)


def candidats_phase(ctx: ContexteAppel) -> list[Tour]:
    return [t for t in ctx.tours if t.role == COMMERCIAL and not t.attribution_douteuse and
            (INDICES_OFFRE.search(t.texte) or MONTANT.search(t.texte) or DECISION.search(t.texte))]


def _construire_ph(ctx: ContexteAppel, t: Tour) -> str:
    i = ctx.tours.index(t)
    fenetre = ctx.tours[max(0, i - 3): i + 6]
    return (f"TARGET TURN: {t.id}\nAnswer about the TARGET TURN only, using the rules of the phase map.\n"
            "JSON: {\"offer_description\": bool, \"screen_share\": bool, \"followed_by_discovery\": bool, "
            "\"price_for_offer\": bool, \"amount\": number|null, \"hypothetical\": bool, \"range\": [min,max]|null, "
            "\"decision_request\": bool, \"quote\": \"exact words of the target turn that justify the true answers\"}\n\n"
            "CONTEXT\n" + "\n".join(f"[{x.id} {x.ts}] {x.role}: {x.texte}" for x in fenetre))


def _valider_ph(rep: dict, ctx: ContexteAppel, unite: Any) -> list[str]:
    if any(rep.get(k) for k in ("offer_description", "screen_share", "price_for_offer", "decision_request")):
        e = citation_ok(ctx, Preuve(rep.get("quote", ""), unite.id if hasattr(unite, "id") else unite, COMMERCIAL))
        return [e] if e else []
    return []


PHASES = TacheModele("foundation.phases", "fast", "fondation_phases", _construire_ph,
                   lambda a, c, u: _valider_ph(a, c, c.tour(u.split(":", 1)[-1]) if isinstance(u, str) else u),
                   cle=lambda a: [bool(a.get(k)) for k in ("offer_description", "screen_share", "followed_by_discovery",
                                                            "price_for_offer", "hypothetical", "decision_request")])


def decider_phases(ctx: ContexteAppel, reponses: dict[str, dict]) -> None:
    """Code decision of PB-1, PB-2/PB-17, PB-3/PB-18, PB-19, PB-4."""
    ph = ctx.phases
    prix_ref = (ctx.reference_offre or {}).get("price")
    tours_commercial = [t for t in ctx.tours if t.role == COMMERCIAL and not t.attribution_douteuse]
    # pitch start
    for t in tours_commercial:
        a = reponses.get(t.id) or {}
        if a.get("offer_description") or a.get("screen_share"):
            if a.get("followed_by_discovery"):
                ph.mentions_offre.append(t.id)          # PB-2 / PB-17
                continue
            if a.get("screen_share") and not a.get("offer_description"):
                suiv = [x for x in tours_commercial if ctx.n(x.id) > ctx.n(t.id)][:2]   # PB-1: offer description within 2 sales turns
                if not any((reponses.get(x.id) or {}).get("offer_description") for x in suiv):
                    continue
            ph.debut_presentation = t.id
            ph.preuve["pitch_start"] = Preuve(a.get("quote", ""), t.id, COMMERCIAL)
            break
    # first price
    for t in tours_commercial:
        a = reponses.get(t.id) or {}
        if not a.get("price_for_offer") or a.get("hypothetical"):
            continue
        mont = a.get("amount") or (a.get("range") or [None])[0]
        if prix_ref and mont and not (0.3 * prix_ref <= mont <= 3 * prix_ref):   # PB-18 plausibility
            ph.signaux.append(f"amount_doubtful:{t.id}")
            continue
        if ph.debut_presentation and ctx.n(t.id) < ctx.n(ph.debut_presentation):
            ph.prix_precoce = ph.prix_precoce or t.id             # PB-19
            continue
        ph.premier_prix = t.id
        ph.preuve["first_price"] = Preuve(a.get("quote", ""), t.id, COMMERCIAL)
        break
    for t in tours_commercial:
        a = reponses.get(t.id) or {}
        if a.get("decision_request") and (ph.debut_presentation is None or ctx.n(t.id) > ctx.n(ph.debut_presentation)):
            ph.demande_decision = t.id
            break
    fins = [x for x in (ph.premier_prix, ph.demande_decision) if x]
    ph.fin_presentation = min(fins, key=ctx.n) if fins else None


def executer_phases(ctx: ContexteAppel, executeur: Executeur) -> None:
    reponses = {}
    for t in candidats_phase(ctx):
        r = executeur.executer(ctx, PHASES, f"phase:{t.id}", t)
        if r.reponse:
            reponses[t.id] = r.reponse
        elif r.statut == "to_review":
            ctx.phases.signaux.append(f"to_review:{t.id}")
    decider_phases(ctx, reponses)


def executer_fondation(ctx: ContexteAppel, executeur: Executeur) -> None:
    porte_diarisation(ctx)
    if ctx.statut != "ok":
        return
    executer_attribution(ctx, executeur)
    if ctx.statut != "ok":
        return
    executer_phases(ctx, executeur)
