"""Competence 4 · Objection Removal (methodology OBJ v1.1, Annex A OB-1..OB-26).

Golden rule: the model answers closed questions with exact quotes; the code bounds episodes, decides levels and scores.

Pipeline of `ObjectionsCompetence.run`:
  1. inventory, after the first price only (OB-27), (code, OB-1 markers, OB-12 speakers, OB-26 doubtful turns) + model nomination of unmarked passages;
  2. per candidate: `obj.resistance` (exclusions OB-2, doubt subjects -> nature by the code with the OB-3 order,
     OB-4 two natures, OB-24 denied nature, OB-25 external reason that also limits time, OB-26 label check);
  3. OB-5 merge (code); episode bounding (code, OB-6..OB-9) with `obj.topic` where the code cannot decide OB-8 (b)
     and for OB-22; latent by turn numbers (OB-10, OB-22); recurrence (OB-11);
  4. per episode: `obj.acknowledge` (OB-13/OB-20), `obj.isolate` (OB-14/X6), `obj.explore` (OB-15/OB-20/X7),
     `obj.gesture` (OB-16/OB-21), `obj.resolution` (OB-17/OB-23/X3) -> items H1..H5 (§5.1);
  5. prevention `obj.prevention` on the turns before the first price (OB-18/OB-19) -> R1..R3 (§5.2);
  6. applicability (§4), combination 70/30 (§5), diagnostics (§7), output contract (§9).
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any, Optional

from ..noyau.modeles import ContexteAppel, ResultatCompetence, Preuve, NoteItem, AUTRE, PROSPECT, COMMERCIAL, Tour
from ..noyau.executeur import TacheModele, Executeur
from ..noyau.notation import note_appel, item
from ..noyau.texte import GENERIQUES, MOTS_VIDES, approbation_seule, jetons_propres, normaliser, normaliser_nombre, citation_ok, phrases

# ----------------------------------------------------------------------------------------------- constants
# Every value below is a methodology proposal "to validate" (§5, §10, OB-5, OB-10) and stays configurable.
PART_TRAITEMENT, PART_PREVENTION = 0.70, 0.30                 # §5 call score split
POIDS_H = {"H1": 25, "H2": 10, "H3": 20, "H4": 35, "H5": 10}  # §5.1
POIDS_R = {"R1": 40, "R2": 40, "R3": 20}                     # §5.2
POIDS_EPISODE = {"objection": 1.0, "anxiety_capability": 1.5, "anxiety_choice": 1.5, "inertia": 1.5}  # §5.1
TOURS_MAX_LATENT = 2          # OB-10: topic change within 2 turns of the resistance
MOTS_MIN_REACTION_LATENT = 6  # OB-10: a reaction of 6 words or more prevents latent
MOTS_MAX_RELANCE_ORALE = 5      # OB-5: sales backchannel of 5 words or fewer
# Engineering parameters (not business facts): context sizes fed to the model.
BLOC_NOMINATION = 60
CONTEXTE_AVANT, CONTEXTE_APRES = 3, 3

NATURES = ("objection", "anxiety_capability", "anxiety_choice", "inertia")
# OB-3 boundary tests in their fixed order: test 1 objection, test 2 anxiety, test 3 inertia.
SUJETS: dict[str, tuple[int, str, str]] = {
    "price": (1, "objection", "price"),
    "money_available": (1, "objection", "money_available"),
    "offer_trust": (1, "objection", "trust_in_offer"),
    "offer_relevance": (1, "objection", "relevance"),
    "time": (1, "objection", "time"),
    "co_decider": (1, "objection", "co_decider"),
    "self_capability": (2, "anxiety_capability", "capability"),
    "own_decision": (2, "anxiety_choice", "choice"),
    "present_attachment": (3, "inertia", "timing"),
    "postponement": (3, "inertia", "timing"),
}
EXCLUSIONS = ("none", "information_request", "external_deadline", "circuit_fact", "conditional_acceptance")
TYPES_REACTION = ("states_no_longer_holds", "reformulates_as_answered", "moves_forward_own_initiative",
                  "commits_to_proposal", "agreement_only", "repeats_or_reinforces", "other")

# OB-1 marker lists (English calls). Markers only nominate candidates; the model decides (OB-3).
MARQUEURS: dict[str, list[str]] = {
    "objection_price_money": [r"too expensive", r"(a lot|lots) of money", r"\bexpensive\b", r"can'?t afford",
                              r"don'?t have (the )?money", r"out of my budget", r"my credit", r"financing",
                              r"\b(that'?s|it'?s|is) (quite |a bit )?a lot\b", r"big amount", r"\bthe amount\b",
                              r"\bthe money\b"],
    "objection_trust_relevance": [r"not sure (if |that )?it works", r"seen programs like this", r"accredited",
                                  r"already know how", r"i don'?t need", r"\btrust\b", r"\bscam\b",
                                  r"sales thing"],
    "objection_time": [r"don'?t have (much |enough |the )?time", r"with my job", r"with the kids", r"\bbusy\b",
                       r"\bbooked\b", r"don'?t breathe"],
    "objection_co_decider": [r"talk to my (husband|wife|partner|fianc[eé]e?|spouse)",
                             r"ask my (husband|wife|partner|fianc[eé]e?|spouse)", r"we decide together",
                             r"check with", r"run it by", r"with my (husband|wife|partner)"],
    "anxiety_capability": [r"i'?m scared", r"i'?m afraid", r"\bafraid\b", r"\bscared\b", r"don'?t know if i can",
                           r"not sure (if )?i can", r"not good enough", r"i'?ll quit", r"always give up",
                           r"\bfear\b"],
    "anxiety_choice": [r"what if it doesn'?t work", r"burned", r"make a mistake", r"how do i know",
                       r"how can you make sure"],
    "inertia": [r"not the right (time|moment)", r"maybe later", r"after the holidays", r"i'?m (okay|ok|good|fine) for now",
                r"think about it", r"sleep on it", r"sit on it", r"not right now", r"don'?t want to do it today",
                r"can'?t make (a )?decisions?", r"fine as it is"],
}
_RE_MARQUEUR = [(k, re.compile(p, re.I)) for k, ps in MARQUEURS.items() for p in ps]

# OB-13 lexical contradiction markers, checked by code on the first sentence of the first response.
RE_CONTRADICTION = re.compile(r"(\bbut\b|\bactually\b|^\s*no\b[,.!]?|\bno,|that'?s not true|the thing is|i disagree)",
                              re.I)

_MOTS_VIDES_LOCAUX = set("""i me my mine we us our it's that's there's what's let's i'm i've i'll i'd you're don't doesn't
didn't can't won't isn't aren't wasn't gonna wanna yes yeah no not so because just um uh oh hmm mm mm-hmm okay ok
cool sure right got get go going one also even still well say said see""".split())


# ----------------------------------------------------------------------------------------------- data
@dataclass
class Resistance:
    debut: str                      # first turn (OB-6)
    dernier: str                       # last turn of the resistance (OB-5 merge)
    role: str
    citation: str
    nature: str
    sous_type: str
    tours: list[str] = field(default_factory=list)
    statut: str = "verified"

    @property
    def theme(self) -> tuple[str, str]:   # "same resistance" = same nature and theme (§2)
        return (self.nature, self.sous_type)


@dataclass
class Episode:
    id: str
    res: Resistance
    reponse_com: list[str] = field(default_factory=list)
    reaction: list[str] = field(default_factory=list)
    repetitions: list[str] = field(default_factory=list)     # same-theme passages inside the reaction (persisting)
    changement_sujet: Optional[str] = None
    tour_fin: Optional[str] = None                       # first turn not in the episode (None = end of call)
    raison_fin: str = "end_of_call"                      # topic_change / new_resistance / end_of_call
    latent: bool = False
    regle_latente: Optional[str] = None
    statut: str = "scored"                               # scored / to_review
    faits: dict[str, Any] = field(default_factory=dict)
    recurrence_de: Optional[str] = None
    revient_plus_tard: bool = False
    items: list[NoteItem] = field(default_factory=list)
    note: Optional[int] = None
    etiquettes: list[str] = field(default_factory=list)

    @property
    def cle(self) -> str:
        return f"{self.res.debut}.{self.res.nature}"


# ----------------------------------------------------------------------------------------------- helpers
def seq(ctx: ContexteAppel) -> list[Tour]:
    """Turns used for bounding: attribution-doubtful turns are excluded (OB-12, OB-26, C1)."""
    return [t for t in ctx.tours if not t.attribution_douteuse]


def _pos(ctx: ContexteAppel) -> dict[str, int]:
    return {t.id: i for i, t in enumerate(seq(ctx))}


def _sing(w: str) -> str:
    if len(w) > 4 and w.endswith("ies"):
        return w[:-3] + "y"
    if len(w) > 3 and w.endswith("s") and not w.endswith("ss"):
        return w[:-1]
    return w


def mots_contenu(texte: str, retirer_generiques: bool = True) -> set[str]:
    """Content words for OB-8 (a) (no function word, no generic word) and, with drop_generic=False, for the
    'reuses a word of the resistance' test of OB-15 (any non-function word: 'a lot' reuses 'lot')."""
    sortie = set()
    for w in jetons_propres(texte):
        w = w.strip("'-")
        if not w or w in MOTS_VIDES or w in _MOTS_VIDES_LOCAUX or (retirer_generiques and w in GENERIQUES):
            continue
        if len(w) < 3 and not normaliser_nombre(w):
            continue
        sortie.add(_sing(w))
    return sortie


def est_relance_orale(t: Tour) -> bool:
    """OB-5: a sales backchannel of 5 words or fewer with no content word ("mm-hmm", "I hear you")."""
    return len(t.texte.split()) <= MOTS_MAX_RELANCE_ORALE and (approbation_seule(t.texte) or not mots_contenu(t.texte))


def _secondes_ts(ts: str) -> Optional[int]:
    try:
        parties = [int(p) for p in ts.split(":")]
    except ValueError:
        return None
    s = 0
    for p in parties:
        s = s * 60 + p
    return s


def _pr(ctx: ContexteAppel, d: Optional[dict], role: Optional[str] = None) -> Optional[Preuve]:
    if not d or not d.get("quote") or not d.get("turn"):
        return None
    try:
        r = role or ctx.tour(d["turn"]).role
    except KeyError:
        return None
    return Preuve(d["quote"], d["turn"], r)


def _cote_prospect_ok(ctx: ContexteAppel, ev: Preuve, tours: Optional[list[str]] = None, **kw) -> Optional[str]:
    """C3 checks for a prospect-side quote (PROSPECT or co-decider OTHER, OB-12)."""
    e = citation_ok(ctx, Preuve(ev.citation, ev.tour), **kw)
    if e:
        return e
    if ctx.tour(ev.tour).role == COMMERCIAL:
        return "wrong_speaker"
    if tours is not None and ev.tour not in tours:
        return "outside_unit"
    return None


def _commercial_ok(ctx: ContexteAppel, ev: Preuve, tours: Optional[list[str]] = None, **kw) -> Optional[str]:
    e = citation_ok(ctx, Preuve(ev.citation, ev.tour, COMMERCIAL), **kw)
    if e:
        return e
    if tours is not None and ev.tour not in tours:
        return "outside_unit"
    return None


# ----------------------------------------------------------------------------------------------- OB-1 inventory
def touches_marqueurs(texte: str) -> list[str]:
    return sorted({k for k, rx in _RE_MARQUEUR if rx.search(texte)})


def trouver_candidats(ctx: ContexteAppel) -> list[Tour]:
    """OB-1: prospect / co-decider turns (OB-12) containing a marker. Doubtful turns excluded (OB-26)."""
    return [t for t in seq(ctx) if t.role in (PROSPECT, AUTRE) and touches_marqueurs(t.texte)]


# ----------------------------------------------------------------------------------------------- OB-2..OB-4, OB-24, OB-25
def nature_des_sujets(sujets: list[str]) -> Optional[tuple[str, str]]:
    """OB-3: boundary tests in their fixed order; the first test that matches decides (case 5: 'scared ... because
    of the money' is test 1, objection)."""
    connu = [s for s in sujets if s in SUJETS]
    if not connu:
        return None
    meilleur = min(connu, key=lambda s: SUJETS[s][0])     # min is stable: model order breaks ties inside a test
    _, nature, sous_type = SUJETS[meilleur]
    return nature, sous_type


def resistances_de_reponse(rep: dict, tour: Tour) -> tuple[list[Resistance], Optional[dict], list[str]]:
    """Code decision on one `obj.resistance` answer. Returns (resistances, deadline fact, flags)."""
    signaux: list[str] = []
    if rep.get("label_contradicted"):            # OB-26: excluded from episodes
        return [], None, [f"attribution_doubtful:{tour.id}"]
    excl = rep.get("exclusion") or "none"
    echeance = None
    if rep.get("deadline") and rep["deadline"].get("quote"):
        echeance = {"turn": tour.id, "quote": rep["deadline"]["quote"], "binding": bool(rep["deadline"].get("binding"))}
    if excl in ("information_request", "circuit_fact", "conditional_acceptance"):    # OB-2, X1
        return [], echeance, signaux
    nie = {SUJETS[s][1] for s in rep.get("denied_subjects", []) if s in SUJETS}
    sortie: list[Resistance] = []
    vus = set()
    for d in rep.get("doubts", []):
        sujets = list(d.get("subjects") or [])
        if excl == "external_deadline":                     # OB-2 / X2: no inertia; OB-25: only objection · time
            sujets = [s for s in sujets if s == "time"]
        nt = nature_des_sujets(sujets)
        if nt is None:
            continue
        if nt[0] in nie:                                 # OB-24: the denied nature opens no episode
            signaux.append(f"denied_nature:{tour.id}:{nt[0]}")
            continue
        if nt[0] in vus:                                   # OB-4: at most one episode per nature
            continue
        vus.add(nt[0])
        sortie.append(Resistance(tour.id, tour.id, tour.role, d.get("quote", ""), nt[0], nt[1], [tour.id]))
    return sortie, echeance, signaux


def fusionner_consecutifs(ctx: ContexteAppel, res: list[Resistance]) -> list[Resistance]:
    """OB-5: consecutive prospect turns expressing the same resistance, separated only by sales backchannel of
    5 words or fewer, form one resistance."""
    pos = _pos(ctx)
    tours = seq(ctx)
    res = sorted(res, key=lambda r: (pos[r.debut], NATURES.index(r.nature)))
    sortie: list[Resistance] = []
    for r in res:
        prec = next((p for p in reversed(sortie) if p.theme == r.theme), None)
        if prec and pos[r.debut] > pos[prec.dernier]:
            entre = tours[pos[prec.dernier] + 1: pos[r.debut]]
            if all(t.role == COMMERCIAL and est_relance_orale(t) for t in entre):
                prec.dernier = r.debut
                prec.tours.append(r.debut)
                continue
        sortie.append(r)
    return sortie


# ----------------------------------------------------------------------------------------------- OB-8, OB-10, OB-22
def changement_sujet_condition_a(texte_tour: str, mots_ref: set[str]) -> bool:
    """OB-8 (a), computed by code: the sales turn contains no content word of the resistance or of the response so
    far ("Where do you want to go from here?" has none at all and passes (a); the model then reads (b)).
    Sales backchannels ("Okay.", "Mm-hmm.") are filtered before (see `is_backchannel`): they introduce nothing."""
    return not (mots_contenu(texte_tour) & mots_ref)


def est_latent(ctx: ContexteAppel, ep: Episode) -> tuple[bool, Optional[str]]:
    """OB-10 / OB-22 / §2, computed from turn numbers."""
    if ep.regle_latente == "OB-22":
        return True, "OB-22"
    if not ep.reaction:
        return True, "no_reaction"                       # §2: no prospect reaction
    if ep.changement_sujet:
        pos = _pos(ctx)
        if pos[ep.changement_sujet] - pos[ep.res.dernier] <= TOURS_MAX_LATENT and \
                all(len(ctx.tour(t).texte.split()) < MOTS_MIN_REACTION_LATENT for t in ep.reaction):
            return True, "OB-10"
    return False, None


# ----------------------------------------------------------------------------------------------- OB-11
def lier_recurrences(ctx: ContexteAppel, episodes: list[Episode], precedent: Optional[list[dict]] = None) -> list[dict]:
    """OB-11: a resistance of the same nature and theme after an earlier episode ended opens a new episode linked to
    the first one of the chain; every earlier episode of the chain recurs later (H5 = 0, X4).
    `previous`: episodes of the previous call of the same cycle ({"call_id","id","nature","subtype"}).
    Returns the previous-call episodes that recur here (to be re-scored H5 = 0 on that call)."""
    pos = _pos(ctx)
    fin = lambda e: pos[e.tour_fin] if e.tour_fin else len(pos)
    eps = sorted([e for e in episodes if e.statut == "scored"], key=lambda e: pos[e.res.debut])
    recurrent_prec: list[dict] = []
    for i, e in enumerate(eps):
        plus_tot = [f for f in eps[:i] if f.res.theme == e.res.theme and fin(f) <= pos[e.res.debut]]
        if plus_tot:
            e.recurrence_de = plus_tot[0].id          # linked to the first episode of the chain (case 26)
            for f in plus_tot:
                f.revient_plus_tard = True
            continue
        for p in precedent or []:
            if (p.get("nature"), p.get("subtype")) == e.res.theme:
                e.recurrence_de = f"{p.get('call_id')}:{p.get('id')}"
                recurrent_prec.append(p)
                break
    return recurrent_prec


# ----------------------------------------------------------------------------------------------- gestures (code)
def accueilli(premiere_phrase: str, rep: Optional[dict]) -> bool:
    """OB-13 / OB-20 / X5, read on the first sentence of the first response turn."""
    if RE_CONTRADICTION.search(normaliser(premiere_phrase)):
        return False
    a = rep or {}
    if a.get("contradiction"):
        return False
    return bool(a.get("receiving_marker") or a.get("neutral_reformulation") or a.get("elliptical_open_question"))


def _citation_a(ctx: ContexteAppel, tour: str, citation: str) -> tuple[int, int]:
    i = normaliser(ctx.tour(tour).texte).find(normaliser(citation))
    return (_pos(ctx)[tour], max(i, 0))


def isolement_valide(ctx: ContexteAppel, ep: Episode, iso: Optional[dict], reponse: Optional[Preuve]) -> bool:
    """OB-14 / X6: in the episode's response, before the answer."""
    if not iso or not iso.get("isolate") or iso.get("turn") not in ep.reponse_com:
        return False
    if reponse is None:
        return True
    return _citation_a(ctx, iso["turn"], iso.get("quote", "")) < _citation_a(ctx, reponse.tour, reponse.citation)


def tour_reaction_suivant(ctx: ContexteAppel, apres: str) -> Optional[Tour]:
    tours = seq(ctx)
    for t in tours[_pos(ctx)[apres] + 1:]:
        if t.role != COMMERCIAL:
            return t
    return None


def exploration(ctx: ContexteAppel, ep: Episode, att: Optional[dict], debuts_resistance: set[str]) -> tuple[bool, bool]:
    """OB-15 / OB-20 / X7. Returns (explored, answered_with_content)."""
    if not att or not att.get("explore") or att.get("turn") not in ep.reponse_com or not att.get("open_question"):
        return False, False                                                   # X7: closed question
    reprise = bool(mots_contenu(att.get("quote", ""), retirer_generiques=False) &
                 mots_contenu(" ".join(ctx.tour(t).texte for t in ep.res.tours), retirer_generiques=False))
    elliptique_ok = bool(att.get("elliptical")) and att.get("turn") == (ep.reponse_com[0] if ep.reponse_com else None)
    if not (reprise or elliptique_ok):                                          # OB-15 reuse test, OB-20 ellipsis
        return False, False
    suiv = tour_reaction_suivant(ctx, att["turn"])
    if suiv is None or suiv.id in debuts_resistance or approbation_seule(suiv.texte):  # case 13: a new resistance is no answer
        return True, False
    contenu = bool(att.get("answered_with_content")) and att.get("answer_turn") == suiv.id
    return True, contenu


def niveau_h1(nature: str, g: dict, etapes: dict) -> tuple[int, list[str]]:
    """OB-16 / OB-21. `g` = gesture facts (code-validated), `steps` = {ack, isolate, explore} for objections.
    Returns (level, tags)."""
    etiquettes: list[str] = []
    if nature == "objection":
        # Matching gesture: acknowledge, isolate, explore, then an answer tied to what the prospect said (OB-16).
        if not (g.get("answer_given") and g.get("answer_tied_to_prospect")):
            return 0, etiquettes
        if etapes.get("ack") and etapes.get("isolate") and etapes.get("explore"):
            return 2, etiquettes
        etiquettes.append("steps_missing")
        return 1, etiquettes
    if nature == "inertia":
        correspondance = bool(g.get("cost_of_inaction_question") and g.get("cost_stated_by_prospect"))
        faux = bool(g.get("offer_argument"))
    else:
        correspondance = bool(g.get("support_or_framework")) if nature == "anxiety_capability" \
            else bool(g.get("proof_reversibility_guarantee"))
        faux = bool(g.get("offer_argument") or g.get("cost_of_inaction_question"))   # case 7b, case 18
    if correspondance and not faux:
        return 2, etiquettes
    if correspondance and faux:
        etiquettes.append("partial_wrong_kind")
        return 1, etiquettes
    if nature.startswith("anxiety") and g.get("mindset_reframe"):                    # OB-21
        etiquettes.append("mindset_reframe")
        return 1, etiquettes
    if faux:
        etiquettes.append("mismatch")
    return 0, etiquettes


def niveau_h3(nature: str, isoler: bool, explore: bool, contenu: bool) -> int:
    """§5.1 H3. For anxiety and inertia, explore only."""
    if nature == "objection":
        if isoler and explore and contenu:
            return 2
        return 1 if (isoler or explore) else 0
    if explore:
        return 2 if contenu else 1
    return 0


def niveau_resolution(ctx: ContexteAppel, ep: Episode, r: Optional[dict]) -> tuple[str, Optional[Preuve], bool]:
    """OB-17 / OB-23 / X3 / C3 rule 5. Returns (level, evidence, prompted)."""
    if ep.latent:
        return "latent", None, False
    if not r:
        return "acknowledged", None, False
    genre = r.get("reaction_kind")
    ev = _pr(ctx, r)
    pos = _pos(ctx)
    if genre == "repeats_or_reinforces":
        return "persisting", ev, False
    if ev and any(pos[x] > pos[ev.tour] for x in ep.repetitions):          # repeated after the "resolution"
        return "persisting", ev, False
    suggere = bool(r.get("content_first_stated_by_sales"))
    if genre == "commits_to_proposal":                                   # OB-23
        ok = bool(r.get("specific_element")) and ev is not None and not approbation_seule(ctx.tour(ev.tour).texte)
        return ("resolved" if ok else "acknowledged"), ev, False
    if genre in ("states_no_longer_holds", "reformulates_as_answered", "moves_forward_own_initiative"):
        if suggere or ev is None or approbation_seule(ctx.tour(ev.tour).texte):   # X3, C3 rule 5
            return "acknowledged", ev, suggere
        return "resolved", ev, False
    return "acknowledged", ev, suggere                                  # agreement_only / other


NIVEAU_H4 = {"resolved": 2, "acknowledged": 1, "latent": 0, "persisting": 0}


def items_episode(ctx: ContexteAppel, ep: Episode, f: dict) -> list[NoteItem]:
    """§5.1 items from the code-decided facts of one episode."""
    rq = Preuve(ep.res.citation, ep.res.debut, ep.res.role)
    sortie = [
        item("H1", POIDS_H["H1"], f["h1"], [rq, f.get("gesture_ev")], ";".join(f.get("h1_tags", []))),
        item("H2", POIDS_H["H2"], 2 if f["ack"] else 0, [rq, f.get("ack_ev")]),
        item("H3", POIDS_H["H3"], f["h3"], [f.get("iso_ev"), f.get("exp_ev"), f.get("exp_answer_ev")]),
        item("H4", POIDS_H["H4"], NIVEAU_H4[f["reaction_level"]], [rq, f.get("reaction_ev")], f["reaction_level"]),
        # H5 is an absence (no recurrence): no second quote can exist, the two-quote rule does not apply.
        item("H5", POIDS_H["H5"], 0 if ep.revient_plus_tard else 2, [rq], "recurs later" if ep.revient_plus_tard else
             "provisional: current call only", deux_citations=False),
    ]
    return sortie


def note_traitement(episodes: list[Episode]) -> Optional[int]:
    """§5.1: mean of episode scores weighted by nature (anxiety and inertia 1.5, objection 1)."""
    sc = [(POIDS_EPISODE[e.res.nature], e.note) for e in episodes if e.statut == "scored" and e.note is not None]
    if not sc:
        return None
    return round(sum(w * s for w, s in sc) / sum(w for w, _ in sc))


# ----------------------------------------------------------------------------------------------- prevention (code)
FAITS_PROSPECT = ("decision_maker", "influencers", "budget", "deadline", "past_attempt")
FAITS_COMMERCIAL = ("past_attempt_explored", "difference_stated")


def fait_prevention_ok(ctx: ContexteAppel, nom_: str, d: Optional[dict], premier_prix: Optional[str]) -> tuple[bool, str]:
    """OB-18 (before the first price), OB-19 / X8 (no sales supposition, no bare approval)."""
    if not d or not d.get("quote") or not d.get("turn"):
        return False, "absent"
    try:
        t = ctx.tour(d["turn"])
    except KeyError:
        return False, "unknown_turn"
    if premier_prix is None or not ctx.avant(t.id, premier_prix):
        return False, "after_first_price"
    if nom_ in FAITS_PROSPECT:
        if t.role == COMMERCIAL:
            return False, "sales_supposition"
        if approbation_seule(t.texte) or approbation_seule(d["quote"]):
            return False, "approval_only"
    elif t.role != COMMERCIAL:
        return False, "wrong_speaker"
    return True, "ok"


def items_prevention(ctx: ContexteAppel, faits: dict, premier_prix: str) -> tuple[list[NoteItem], dict, list[str]]:
    """§5.2 R1..R3 from the prevention facts. Returns (items, kept facts, flags)."""
    garde, pourquoi = {}, {}
    for k in FAITS_PROSPECT + FAITS_COMMERCIAL:
        ok, raison = fait_prevention_ok(ctx, k, faits.get(k), premier_prix)
        garde[k] = faits.get(k) if ok else None
        pourquoi[k] = raison
    ev = lambda k: _pr(ctx, garde.get(k))
    signaux = []
    # R1 decision circuit
    n1 = bool(garde["decision_maker"]) + bool(garde["influencers"])
    r1 = item("R1", POIDS_R["R1"], n1, [ev("decision_maker"), ev("influencers")])
    # R2 budget and deadline (binding counts double in diagnostics only)
    n2 = bool(garde["budget"]) + bool(garde["deadline"])
    r2 = item("R2", POIDS_R["R2"], n2, [ev("budget"), ev("deadline")])
    # R3 past attempt defused (sales gestures must follow the mention, before the price)
    pa = garde["past_attempt"]
    if not pa:
        r3 = item("R3", POIDS_R["R3"], 2, [], "not_triggered", deux_citations=False)
        signaux.append("R3_not_triggered")
    else:
        apres = lambda k: garde.get(k) and ctx.avant(pa["turn"], garde[k]["turn"])
        if apres("past_attempt_explored") and apres("difference_stated"):
            r3 = item("R3", POIDS_R["R3"], 2, [ev("past_attempt_explored"), ev("difference_stated")])
        elif apres("past_attempt_explored"):
            r3 = item("R3", POIDS_R["R3"], 1, [ev("past_attempt"), ev("past_attempt_explored")],
                      "explored, difference not stated")
        else:
            r3 = item("R3", POIDS_R["R3"], 0, [ev("past_attempt")], "past attempt not addressed before the price")
    garde["_rejected"] = {k: v for k, v in pourquoi.items() if v not in ("ok", "absent")}
    return [r1, r2, r3], garde, signaux


# ----------------------------------------------------------------------------------------------- applicability (§4)
def combiner(traitement: Optional[int], prevention: Optional[int]) -> Optional[int]:
    """§5: 70 % handling + 30 % prevention when both apply, otherwise the one that applies."""
    if traitement is not None and prevention is not None:
        return round(PART_TRAITEMENT * traitement + PART_PREVENTION * prevention)
    return traitement if traitement is not None else prevention


def applicabilite(n_episodes: int, prix_donne: bool) -> tuple[str, str]:
    """§4 -> (handling status, prevention status)."""
    return ("scored" if n_episodes else "not_applicable", "scored" if prix_donne else "not_applicable")


# ----------------------------------------------------------------------------------------------- model tasks
def _fenetre(ctx: ContexteAppel, debut: str, fin: Optional[str], avant: int = CONTEXTE_AVANT,
            apres: int = CONTEXTE_APRES) -> list[Tour]:
    s = seq(ctx)
    p = _pos(ctx)
    a = max(0, p[debut] - avant)
    b = (p[fin] + 1 + apres) if fin else len(s)
    return s[a:min(b, len(s))]


def _note_prix(ctx: ContexteAppel, tid: str) -> str:
    fp = ctx.phases.premier_prix
    if not fp:
        return "No price was given in this call."
    return f"First price at {fp}: the target turn is {'BEFORE' if ctx.avant(tid, fp) else 'AFTER'} the first price."


class _Taches:
    """Builds the model tasks of one run. `validate` receives the unit id: units are kept in `self.units`."""

    def __init__(self):
        self.unites: dict[str, Any] = {}

    def executer(self, executeur: Executeur, ctx: ContexteAppel, tache: TacheModele, uid: str, unite: Any):
        self.unites[uid] = unite
        return executeur.executer(ctx, tache, uid, unite)

    # -- nominate (OB-1, model may nominate without a marker)
    def nommer(self) -> TacheModele:
        def construire(ctx, u):
            bloc_, signale = u
            return ("ALREADY FLAGGED: " + (", ".join(signale) or "none") + "\n\nEXTRACT\n" + ctx.afficher(bloc_))

        def valider(a, ctx, uid):
            bloc_, _ = self.unites[uid]
            ids = [t.id for t in bloc_]
            errs = []
            for n in a.get("nominations", []) or []:
                e = _cote_prospect_ok(ctx, Preuve(n.get("quote", ""), n.get("turn", "")), ids) \
                    if n.get("turn") in ids else "outside_unit"
                if e:
                    errs.append(f"{e}:{n.get('turn')}")
            return errs
        return TacheModele("obj.nominate", "fast", "objections_nommer", construire, valider,
                         cle=lambda a: sorted(n["turn"] for n in a.get("nominations", []) or []))

    # -- resistance (OB-2, OB-3, OB-4, OB-24, OB-25, OB-26)
    def resistance(self) -> TacheModele:
        def construire(ctx, t):
            return (f"TARGET TURN: {t.id} ({t.role})\n{_note_prix(ctx, t.id)}\n\nCONTEXT\n" +
                    ctx.afficher(_fenetre(ctx, t.id, t.id)))

        def valider(a, ctx, uid):
            t = self.unites[uid]
            errs = []
            if a.get("exclusion", "none") not in EXCLUSIONS:
                errs.append("bad_exclusion")
            for d in a.get("doubts", []) or []:
                if not d.get("subjects") or any(s not in SUJETS for s in d["subjects"]):
                    errs.append("bad_subject")
                if _cote_prospect_ok(ctx, Preuve(d.get("quote", ""), t.id)):
                    errs.append("bad_quote")
            if any(s not in SUJETS for s in a.get("denied_subjects", []) or []):
                errs.append("bad_denied_subject")
            dl = a.get("deadline")
            if dl and _cote_prospect_ok(ctx, Preuve(dl.get("quote", ""), t.id)):
                errs.append("bad_deadline_quote")
            return errs

        def cle(a):
            natures = sorted({nature_des_sujets(d.get("subjects", [])) or ("", "")
                              for d in a.get("doubts", []) or []})
            return [a.get("exclusion", "none"), natures, sorted(a.get("denied_subjects", []) or []),
                    bool(a.get("deadline")), bool(a.get("label_contradicted"))]
        return TacheModele("obj.resistance", "strong", "objections_resistance", construire, valider, cle)

    # -- topic change (OB-8 b, OB-22)
    def sujet(self) -> TacheModele:
        def construire(ctx, u):
            ep, t, premier = u
            repn = [ctx.tour(x) for x in ep.reponse_com]
            return (f"RESISTANCE ({ep.res.nature} · {ep.res.sous_type}) [{ep.res.debut}]: \"{ep.res.citation}\"\n\n"
                    "SALES RESPONSE SO FAR\n" + (ctx.afficher(repn) or "(none)") +
                    f"\n\nTARGET TURN{' (FIRST RESPONSE)' if premier else ''}\n" + ctx.afficher([t]))

        def valider(a, ctx, uid):
            ep, t, premier = self.unites[uid]
            if a.get("new_subject") or a.get("receive_and_leave"):
                e = _commercial_ok(ctx, Preuve(a.get("quote", "") or "", t.id), [t.id], mots_max=60)
                return [e] if e else []
            return []
        return TacheModele("obj.topic", "fast", "objections_sujet", construire, valider,
                         cle=lambda a: [bool(a.get("new_subject")), bool(a.get("receive_and_leave"))])

    # -- per-episode gesture tasks
    @staticmethod
    def _texte_episode(ctx: ContexteAppel, ep: Episode) -> str:
        fin = ep.changement_sujet or ep.tour_fin
        tours = [t for t in _fenetre(ctx, ep.res.debut, fin, avant=1, apres=0)]
        repn, reac = set(ep.reponse_com), set(ep.reaction)
        lignes = []
        for t in tours:
            etiquette = "RESPONSE" if t.id in repn else "REACTION" if t.id in reac else \
                "RESISTANCE" if t.id in ep.res.tours else "TOPIC CHANGE" if t.id == ep.changement_sujet else "CONTEXT"
            lignes.append(f"<{etiquette}> [{t.id} {t.ts}] {t.role}: {t.texte}")
        return (f"RESISTANCE: nature {ep.res.nature}, theme {ep.res.sous_type}, turn {ep.res.debut}, "
                f"quote \"{ep.res.citation}\"\n\nEPISODE\n" + "\n".join(lignes))

    def accueillir(self) -> TacheModele:
        def construire(ctx, ep):
            t = ctx.tour(ep.reponse_com[0])
            premier = (phrases(t.texte) or [t.texte])[0]
            return (self._texte_episode(ctx, ep) + f"\n\nFIRST RESPONSE TURN: {t.id}\nFIRST SENTENCE: \"{premier}\"")

        def valider(a, ctx, uid):
            ep = self.unites[uid]
            e = _commercial_ok(ctx, Preuve(a.get("quote", ""), ep.reponse_com[0]), mots_min=1)
            return [e] if e else []
        return TacheModele("obj.acknowledge", "fast", "objections_accueillir", construire, valider,
                         cle=lambda a: [bool(a.get(k)) for k in ("receiving_marker", "neutral_reformulation",
                                                                 "elliptical_open_question", "contradiction")])

    def isoler(self) -> TacheModele:
        def valider(a, ctx, uid):
            ep = self.unites[uid]
            if a.get("isolate"):
                e = _commercial_ok(ctx, Preuve(a.get("quote", ""), a.get("turn", "")), ep.reponse_com)
                return [e] if e else []
            return []
        return TacheModele("obj.isolate", "fast", "objections_isoler", lambda ctx, ep: self._texte_episode(ctx, ep),
                         valider, cle=lambda a: [bool(a.get("isolate")), a.get("turn") if a.get("isolate") else None])

    def explorer(self) -> TacheModele:
        def construire(ctx, ep):
            suiv = [t for t in _fenetre(ctx, ep.res.debut, ep.changement_sujet or ep.tour_fin, 1, 2)]
            return self._texte_episode(ctx, ep) + "\n\nTURNS INCLUDING THE NEXT PROSPECT TURN\n" + ctx.afficher(suiv)

        def valider(a, ctx, uid):
            ep = self.unites[uid]
            errs = []
            if a.get("explore"):
                e = _commercial_ok(ctx, Preuve(a.get("quote", ""), a.get("turn", "")), ep.reponse_com, mots_min=1)
                if e:
                    errs.append(e)
                if a.get("answered_with_content"):
                    e = _cote_prospect_ok(ctx, Preuve(a.get("answer_quote", "") or "", a.get("answer_turn", "") or ""))
                    if e:
                        errs.append("answer_" + e)
            return errs
        return TacheModele("obj.explore", "fast", "objections_explorer", construire, valider,
                         cle=lambda a: [bool(a.get("explore")), a.get("turn") if a.get("explore") else None,
                                        bool(a.get("open_question")), bool(a.get("elliptical")),
                                        bool(a.get("answered_with_content"))])

    def geste(self) -> TacheModele:
        booleens = ("answer_given", "answer_tied_to_prospect", "support_or_framework", "proof_reversibility_guarantee",
                 "cost_of_inaction_question", "cost_stated_by_prospect", "mindset_reframe", "offer_argument")

        def valider(a, ctx, uid):
            ep = self.unites[uid]
            errs = []
            if a.get("answer_given"):
                e = _commercial_ok(ctx, Preuve(a.get("answer_quote", "") or "", a.get("answer_turn", "") or ""), ep.reponse_com)
                if e:
                    errs.append("answer_" + e)
            if any(a.get(k) for k in booleens if k not in ("cost_stated_by_prospect",)):
                e = _commercial_ok(ctx, Preuve(a.get("gesture_quote", "") or "", a.get("gesture_turn", "") or ""), ep.reponse_com)
                if e:
                    errs.append("gesture_" + e)
            if a.get("cost_stated_by_prospect"):
                e = _cote_prospect_ok(ctx, Preuve(a.get("prospect_cost_quote", "") or "",
                                                    a.get("prospect_cost_turn", "") or ""), ep.reaction)
                if e:
                    errs.append("cost_" + e)
            return errs
        return TacheModele("obj.gesture", "strong", "objections_geste", lambda ctx, ep: self._texte_episode(ctx, ep),
                         valider, cle=lambda a: [bool(a.get(k)) for k in booleens])

    def resolution(self) -> TacheModele:
        def valider(a, ctx, uid):
            ep = self.unites[uid]
            if a.get("reaction_kind") not in TYPES_REACTION:
                return ["bad_reaction_kind"]
            e = _cote_prospect_ok(ctx, Preuve(a.get("quote", ""), a.get("turn", "")), ep.reaction, mots_min=1)
            return [e] if e else []
        return TacheModele("obj.resolution", "strong", "objections_resolution",
                         lambda ctx, ep: self._texte_episode(ctx, ep), valider,
                         cle=lambda a: [a.get("reaction_kind"), bool(a.get("specific_element")),
                                        bool(a.get("content_first_stated_by_sales"))])

    # -- prevention (OB-18, OB-19)
    def prevention(self) -> TacheModele:
        def construire(ctx, fp):
            pre = seq(ctx)[:_pos(ctx)[fp]]
            return f"FIRST PRICE AT {fp}. TURNS BEFORE THE FIRST PRICE\n" + ctx.afficher(pre)

        def valider(a, ctx, uid):
            errs = []
            for k in FAITS_PROSPECT + FAITS_COMMERCIAL:
                d = a.get(k)
                if not d:
                    continue
                ev = Preuve(d.get("quote", ""), d.get("turn", ""))
                e = _commercial_ok(ctx, ev) if k in FAITS_COMMERCIAL else _cote_prospect_ok(ctx, ev, mots_min=1)
                if e:
                    errs.append(f"{k}:{e}")
            return errs
        return TacheModele("obj.prevention", "strong", "objections_prevention", construire, valider,
                         cle=lambda a: [(k, (a.get(k) or {}).get("turn")) for k in FAITS_PROSPECT + FAITS_COMMERCIAL] +
                         [bool((a.get("deadline") or {}).get("binding"))])


# ----------------------------------------------------------------------------------------------- competence
class CompetenceObjections:
    nom_ = "OBJECTIONS"
    version_regles = "OBJ-1.1"

    # ------------------------------------------------------------------ stage 1-2: resistances
    def _resistances(self, ctx, executeur, T: _Taches, audit: dict) -> tuple[list[Resistance], list[dict], list[str]]:
        signaux: list[str] = []
        # OB-27 (Romain 2026-11-03): an objection is only read after the first price; nothing before it is an objection
        pos = _pos(ctx)
        fp = ctx.phases.premier_prix
        apres_prix = (lambda t: fp is not None and pos[t.id] > pos[fp])
        cands = {t.id: t for t in trouver_candidats(ctx) if apres_prix(t)}
        nom = T.nommer()
        s = [t for t in seq(ctx) if apres_prix(t)]
        for k in range(0, len(s), BLOC_NOMINATION):
            bloc_ = s[k:k + BLOC_NOMINATION]
            if not any(t.role in (PROSPECT, AUTRE) for t in bloc_):
                continue
            r = T.executer(executeur, ctx, nom, f"nominate:{bloc_[0].id}", (bloc_, [t.id for t in bloc_ if t.id in cands]))
            audit[r.statut] = audit.get(r.statut, 0) + 1
            for n in (r.reponse or {}).get("nominations", []) or []:
                if n["turn"] not in cands and apres_prix(ctx.tour(n["turn"])):
                    cands[n["turn"]] = ctx.tour(n["turn"])
            if r.statut == "to_review":
                signaux.append(f"to_review:nominate:{bloc_[0].id}")
        res: list[Resistance] = []
        echeances: list[dict] = []
        tache = T.resistance()
        for tid in sorted(cands, key=lambda x: pos[x]):
            t = cands[tid]
            r = T.executer(executeur, ctx, tache, f"res:{tid}", t)
            audit[r.statut] = audit.get(r.statut, 0) + 1
            if r.reponse is None:
                signaux.append(f"to_review:res:{tid}")
                continue
            rs, dl, fl = resistances_de_reponse(r.reponse, t)
            for x in rs:
                x.statut = r.statut
            res += rs
            signaux += fl
            if dl:
                echeances.append(dl)
        return fusionner_consecutifs(ctx, res), echeances, signaux

    # ------------------------------------------------------------------ stage 3: bounding
    def _borner(self, ctx, executeur, T: _Taches, res: list[Resistance], audit: dict) -> list[Episode]:
        pos = _pos(ctx)
        s = seq(ctx)
        par_debut: dict[str, list[Resistance]] = {}
        for r in res:
            par_debut.setdefault(r.debut, []).append(r)
        tache = T.sujet()
        eps: list[Episode] = []
        absorbe: set[int] = set()                 # same-theme repetitions inside an open episode (persisting)
        for r in sorted(res, key=lambda r: (pos[r.debut], NATURES.index(r.nature))):
            if id(r) in absorbe:
                continue
            ep = Episode(f"E{len(eps) + 1}", r)
            ref = mots_contenu(" ".join(ctx.tour(x).texte for x in r.tours))
            i = pos[r.dernier] + 1
            while i < len(s):
                t = s[i]
                if t.role != COMMERCIAL:
                    autres = [o for o in par_debut.get(t.id, []) if o is not r]
                    if autres:
                        meme = [o for o in autres if o.theme == r.theme]
                        if meme and len(meme) == len(autres):               # same resistance again: persisting
                            absorbe.update(id(o) for o in meme)
                            ep.repetitions.append(t.id)
                            if ep.reponse_com:
                                ep.reaction.append(t.id)
                            i += 1
                            continue
                        ep.tour_fin, ep.raison_fin = t.id, "new_resistance"   # OB-9
                        break
                    if ep.reponse_com:
                        ep.reaction.append(t.id)                            # OB-9 reaction
                    i += 1
                    continue
                premier = not ep.reponse_com
                if est_relance_orale(t):          # OB-5: a backchannel is not a response and introduces no subject
                    if not premier:
                        ep.reponse_com.append(t.id)
                    i += 1
                    continue
                cond_a = changement_sujet_condition_a(t.texte, ref)
                if premier or cond_a:
                    a = T.executer(executeur, ctx, tache, f"topic:{ep.cle}:{t.id}", (ep, t, premier))
                    audit[a.statut] = audit.get(a.statut, 0) + 1
                    if a.reponse is None:
                        ep.statut = "to_review"
                        ep.etiquettes.append(f"to_review:topic:{t.id}")
                        break
                    if premier and a.reponse.get("receive_and_leave"):          # OB-22
                        ep.reponse_com = [t.id]
                        ep.changement_sujet, ep.tour_fin, ep.raison_fin = t.id, t.id, "topic_change"
                        ep.regle_latente = "OB-22"
                        break
                    if cond_a and a.reponse.get("new_subject"):               # OB-8 (a) code + (b) model
                        ep.changement_sujet, ep.tour_fin, ep.raison_fin = t.id, t.id, "topic_change"
                        break
                ep.reponse_com.append(t.id)                                    # OB-7
                ref |= mots_contenu(t.texte)
                i += 1
            ep.latent, regle = est_latent(ctx, ep)
            if ep.latent:
                ep.regle_latente = regle
            eps.append(ep)
        return eps

    # ------------------------------------------------------------------ stage 4: gestures and items
    def _juger(self, ctx, executeur, T: _Taches, ep: Episode, debuts_res: set[str], audit: dict) -> None:
        f: dict[str, Any] = {"h1_tags": []}
        nature = ep.res.nature

        def demander(tache, prefixe):
            r = T.executer(executeur, ctx, tache, f"{prefixe}:{ep.cle}", ep)
            audit[r.statut] = audit.get(r.statut, 0) + 1
            if r.reponse is None:
                ep.statut = "to_review"
                ep.etiquettes.append(f"to_review:{prefixe}")
            return r.reponse

        if not ep.reponse_com:                      # no sales response at all: nothing received, nothing answered
            f.update(ack=False, h1=0, h3=0, reaction_level="latent")
        else:
            premier = ctx.tour(ep.reponse_com[0])
            premiere_phrase = (phrases(premier.texte) or [premier.texte])[0]
            accueil_a = demander(T.accueillir(), "ack")
            g = demander(T.geste(), "gest") or {}
            att_a = demander(T.explorer(), "exp")
            iso_a = demander(T.isoler(), "iso") if nature == "objection" else None
            res_a = demander(T.resolution(), "resol") if not ep.latent and ep.reaction else None
            if ep.statut == "to_review":
                ep.faits = f
                return
            f["ack"] = accueilli(premiere_phrase, accueil_a)
            f["ack_ev"] = Preuve(accueil_a.get("quote", premiere_phrase), premier.id, COMMERCIAL) if f["ack"] else None
            reponse_pr = _pr(ctx, {"turn": g.get("answer_turn"), "quote": g.get("answer_quote")}, COMMERCIAL) \
                if g.get("answer_given") else None
            iso = isolement_valide(ctx, ep, iso_a, reponse_pr) if nature == "objection" else False
            explore, contenu = exploration(ctx, ep, att_a, debuts_res)
            f["isolate"], f["explore"], f["explore_content"] = iso, explore, contenu
            f["iso_ev"] = _pr(ctx, iso_a, COMMERCIAL) if iso else None
            f["exp_ev"] = _pr(ctx, att_a, COMMERCIAL) if explore else None
            f["exp_answer_ev"] = _pr(ctx, {"turn": att_a.get("answer_turn"), "quote": att_a.get("answer_quote")}) \
                if contenu else None
            if g.get("cost_stated_by_prospect"):
                g = dict(g, cost_stated_by_prospect=bool(_pr(ctx, {"turn": g.get("prospect_cost_turn"),
                                                                    "quote": g.get("prospect_cost_quote")})))
            f["h1"], f["h1_tags"] = niveau_h1(nature, g, {"ack": f["ack"], "isolate": iso, "explore": explore})
            f["gesture_ev"] = _pr(ctx, {"turn": g.get("gesture_turn"), "quote": g.get("gesture_quote")}, COMMERCIAL) \
                if f["h1"] else None
            if nature == "inertia" and f["h1"] == 2:
                f["gesture_ev"] = f["gesture_ev"] or _pr(ctx, {"turn": g.get("prospect_cost_turn"),
                                                               "quote": g.get("prospect_cost_quote")})
            f["h3"] = niveau_h3(nature, iso, explore, contenu)
            f["mismatch"] = nature != "objection" and bool(g.get("offer_argument")) and f["h1"] == 0
            f["answer_ev"] = reponse_pr
            niv, rev, suggere = niveau_resolution(ctx, ep, res_a)
            f["reaction_level"], f["reaction_ev"], f["prompted"] = niv, rev, suggere
            if res_a and res_a.get("reaction_kind") == "other":
                ep.etiquettes.append("uncovered_reaction")
        if not ep.reponse_com:
            f.update(isolate=False, explore=False, explore_content=False, prompted=False, mismatch=False)
        ep.faits = f
        ep.etiquettes += f.get("h1_tags", [])

    # ------------------------------------------------------------------ run
    def executer(self, ctx: ContexteAppel, executeur: Executeur) -> ResultatCompetence:
        sortie = ResultatCompetence(self.nom_, self.version_regles)
        if not ctx.reference_offre:
            sortie.signaux.append("offer_reference_missing")
        T = _Taches()
        audit: dict[str, int] = {}
        res, echeances, signaux = self._resistances(ctx, executeur, T, audit)
        sortie.signaux += signaux
        eps = self._borner(ctx, executeur, T, res, audit)
        debuts_res = {e.res.debut for e in eps}      # starts of episodes (absorbed repetitions excluded)
        for ep in eps:
            if ep.statut == "scored":
                self._juger(ctx, executeur, T, ep, debuts_res, audit)
        precedent = [dict(e, call_id=p.get("call_id")) for p in ctx.entrees_anterieures
                    if p.get("kind") == "objections_episodes" for e in p.get("episodes", [])]
        recurrent_prec = lier_recurrences(ctx, eps, precedent)
        for ep in eps:
            if ep.statut != "scored":
                continue
            ep.items = items_episode(ctx, ep, ep.faits)
            ep.note = note_appel(ep.items)
        eps_notes = [e for e in eps if e.statut == "scored"]
        if any(e.statut == "to_review" for e in eps):
            sortie.signaux.append("episodes_to_review")

        # prevention
        fp = ctx.phases.premier_prix
        statut_h, statut_p = applicabilite(len(eps), bool(fp))
        prevention, items_p, note_p = None, [], None
        if statut_p == "scored":
            r = T.executer(executeur, ctx, T.prevention(), "prevention:pre_price", fp)
            audit[r.statut] = audit.get(r.statut, 0) + 1
            if r.reponse is None:
                statut_p = "to_review"
                sortie.signaux.append("to_review:prevention")
            else:
                faits = dict(r.reponse)
                if not faits.get("deadline"):        # OB-2 / OB-25 deadlines found at detection feed prevention
                    dl = next((d for d in echeances if ctx.avant(d["turn"], fp)), None)
                    if dl:
                        faits["deadline"] = dl
                items_p, prevention, pf = items_prevention(ctx, faits, fp)
                sortie.signaux += pf
                note_p = note_appel(items_p)

        note_h = note_traitement(eps_notes) if statut_h == "scored" else None
        # status (§4, C3 rule 7)
        candidats_indecis = any(f.startswith("to_review:res:") or f.startswith("to_review:nominate:")
                                   for f in sortie.signaux)
        if statut_h == "scored" and note_h is None:
            sortie.statut, sortie.raisons = "to_review", ["all_episodes_to_review"]
        elif statut_h == "not_applicable" and candidats_indecis:
            sortie.statut, sortie.raisons = "to_review", ["candidates_to_review"]
        elif statut_p == "to_review" and statut_h == "not_applicable":
            sortie.statut, sortie.raisons = "to_review", ["prevention_to_review"]
        elif statut_h == "not_applicable" and statut_p == "not_applicable":
            sortie.statut, sortie.raisons = "not_applicable", ["no_resistance_no_price"]
        else:
            sortie.statut = "scored"
            sortie.note = combiner(note_h, note_p)
            if statut_h == "not_applicable":
                sortie.raisons.append("no_resistance: call score = prevention score")
        if eps_notes:
            sortie.signaux.append("h5_provisional")       # §5.1: current call only until the next call is analysed

        # call-level items: R1..R3 and, per H item, the weakest episode (stable ids for period item rates)
        items_appel: list[NoteItem] = []
        for hid in POIDS_H:
            niveaux = [(e, next(i for i in e.items if i.id == hid)) for e in eps_notes]
            if niveaux:
                e, it = min(niveaux, key=lambda x: x[1].niveau)
                items_appel.append(NoteItem(hid, POIDS_H[hid], it.niveau, it.preuve, f"min over episodes ({e.id})"))
        sortie.items = items_appel + items_p
        sortie.concordance = f"{audit.get('verified', 0)}/{sum(audit.values())} units verified" if audit else None
        sortie.details = {
            "handling_status": statut_h, "prevention_status": statut_p,
            "handling_score": note_h, "prevention_score": note_p,
            "episodes": [self._enr_episode(ctx, e) for e in eps],
            "prevention": self._enr_prevention(prevention, items_p),
            "deadlines_detected": echeances,
            "recurs_from_previous_call": recurrent_prec,
            "diagnostics": diagnostics(ctx, eps, prevention),
            "unit_status": audit,
        }
        sortie.verdict = None
        return sortie

    # ------------------------------------------------------------------ output contract (§9)
    @staticmethod
    def _enr_episode(ctx: ContexteAppel, e: Episode) -> dict:
        f = e.faits
        fp = ctx.phases.premier_prix
        feuille_route = ((ctx.resultats.get("PITCH").details or {}).get("roadmap_span")
                   if ctx.resultats.get("PITCH") else None)
        rev = f.get("reaction_ev")
        pos = _pos(ctx)
        tours_jusqua_cs = (pos[e.changement_sujet] - pos[e.res.debut]) if e.changement_sujet else None
        pendant_feuille_route = bool(feuille_route and feuille_route[0] and feuille_route[1] and
                              ctx.n(feuille_route[0]) <= ctx.n(e.res.debut) <= ctx.n(feuille_route[1]))
        return {
            "id": e.id, "nature": e.res.nature, "subtype": e.res.sous_type, "status": e.statut,
            "resistance": {"turn": e.res.debut, "quote": e.res.citation, "turns": e.res.tours, "role": e.res.role},
            "response_turns": e.reponse_com, "reaction_turns": e.reaction, "topic_change": e.changement_sujet,
            "end_reason": e.raison_fin, "turns_to_topic_change": tours_jusqua_cs,
            "acknowledge": f.get("ack"), "isolate": f.get("isolate") if e.res.nature == "objection" else None,
            "explore": {"asked": f.get("explore"), "answered_with_content": f.get("explore_content")},
            "gesture_match": {2: "yes", 1: "partial", 0: "no"}.get(f.get("h1")),
            "reaction": {"level": f.get("reaction_level"), "turn": rev.tour if rev else None,
                         "quote": rev.citation if rev else None},
            "prompted_resolution": f.get("prompted"), "latent_rule": e.regle_latente,
            "after_first_price": bool(fp and not ctx.avant(e.res.debut, fp)),
            "during_roadmap": pendant_feuille_route,
            "recurrence_of": e.recurrence_de, "recurs_later": e.revient_plus_tard, "tags": e.etiquettes,
            "items": [{"id": i.id, "level": i.niveau, "note": i.remarque,
                       "evidence": [ev.vers_dict() for ev in i.preuve]} for i in e.items],
            "score": e.note,
        }

    @staticmethod
    def _enr_prevention(prec: Optional[dict], items: list[NoteItem]) -> Optional[dict]:
        if prec is None:
            return None
        d = {k: prec.get(k) for k in FAITS_PROSPECT + FAITS_COMMERCIAL}
        d["rejected"] = prec.get("_rejected", {})
        d["items"] = [{"id": i.id, "level": i.niveau, "note": i.remarque} for i in items]
        return d


# ----------------------------------------------------------------------------------------------- diagnostics (§7)
def diagnostics(ctx: ContexteAppel, eps: list[Episode], prevention: Optional[dict]) -> dict:
    sc = [e for e in eps if e.statut == "scored"]
    n = len(sc)
    melange: dict[str, int] = {}
    for e in sc:
        k = f"{e.res.nature}·{e.res.sous_type}"
        melange[k] = melange.get(k, 0) + 1
    ai = [e for e in sc if e.res.nature != "objection"]
    fp = ctx.phases.premier_prix
    heures = []
    for e in sc:
        rev = e.faits.get("reaction_ev")
        if e.faits.get("reaction_level") == "resolved" and rev:
            a, b = _secondes_ts(ctx.tour(e.res.debut).ts), _secondes_ts(ctx.tour(rev.tour).ts)
            heures.append({"episode": e.id, "turns": _pos(ctx)[rev.tour] - _pos(ctx)[e.res.debut],
                          "seconds": (b - a) if a is not None and b is not None else None})
    themes: dict[str, int] = {}
    for e in sc:
        if e.recurrence_de:
            k = f"{e.res.nature}·{e.res.sous_type}"
            themes[k] = themes.get(k, 0) + 1
    dl = (prevention or {}).get("deadline")
    return {
        "resistance_mix": melange,
        "latent_rate": round(sum(e.latent for e in sc) / n, 3) if n else None,
        "mismatch_rate": round(sum(bool(e.faits.get("mismatch")) for e in ai) / len(ai), 3) if ai else None,
        "time_to_resolution": heures,
        "resistances_after_price": round(sum(bool(fp and not ctx.avant(e.res.debut, fp)) for e in sc) / n, 3)
        if n else None,
        "recurrent_themes": themes,
        "binding_deadline": bool(dl and dl.get("binding")),   # "binding counts double in diagnostics" (§5.2 R2)
    }
