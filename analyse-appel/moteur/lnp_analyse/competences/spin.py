"""Competence 1 · SPIN discovery (methodology SPIN v1.3, Annex A SB-1..SB-35, Part C engine).

Two layers that are never mixed (spin.md §1):
- letter layer: each sales solicitation gets S / P / I / N / OUT from five ordered gates. Diagnostics only:
  **the letter never produces points** (guard of the LNP SPIN reference, Annex A X8);
- effect layer: atoms stated by the prospect in the answers (SITUATION, PAIN, BLOCKER, IMPACT, DESIRE, VALUE).
  The score (items D1..D5) is computed from atoms and chains only.

Pipeline of this module (Part C, C2):
  S1 inventory (code)            inventory()             SEG-1..SEG-8, port of the SPIN reference segment.py
  S3 gates (model)               GATES task              five gates OUT/S/N/I/P, routing, with exact quotes
  S5 letter decision (code)      decide_letter()         port of decide() (decide_all.py), first "yes" wins
  perimeter (code)               place_perimeter()       SB-1, SB-2, SB-25, SB-34: SPIN stops at the pitch (SB-3 / SB-4 off)
  answer spans (code)            answer_spans()          SB-5..SB-8
  atoms (model, then code)       ATOMS task + decide_atom()   SB-9..SB-15, SB-22..SB-24
  follow-up (code)               follows_up()            SB-17, SB-19
  chains (model link + code)     LINK task + find_chains()    SB-16, SB-18, SB-20
  items (code)                   score_items()           §6 D1..D5, two-quote rule (C3 rule 4)
  diagnostics (code)             diagnostics()           §8, displayed, never scored
  registers (model, then code)   REGISTER task + decide_register()   SB-26..SB-33, displayed, never scored
"""
from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass, field
from typing import Any, Callable, Optional

from ..noyau.modeles import (PROSPECT, COMMERCIAL, Atome, ContexteAppel, ResultatCompetence, Preuve, NoteItem,
                           Sollicitation, Tour)
from ..noyau.executeur import TacheModele, Executeur
from ..noyau.notation import note_appel, item
from ..noyau.texte import approbation_seule, normaliser, normaliser_nombre, citation_ok

# =============================================================================================== constants
# Every value below that the methodology marks "to validate" stays a configurable constant.
POIDS = {"D1": 15, "D2": 20, "D3": 30, "D4": 20, "D5": 15}     # §6, weights to validate (§11)
MIN_CODEES = 5                     # §5: minimum coded solicitations for `scored` (to validate, §11)
PART_MAX_ABSENTS = 0.05           # §5 health: > 5 % OUT `absent` -> excluded (C7 health threshold)
COMPTER_SPONTANES = True          # §11 proposal: volunteered atoms count for D1..D4 (never for D5, SB-8)
MOTS_MAX_RELANCE_ORALE = 5         # SB-5: sales backchannel of 5 words or fewer does not end an answer span
MOTS_REPONSE_COURTE = 6            # SB-7
MIN_MOTS_CONTENU = 4              # SB-17: content words of 4 letters or more
MIN_DIAGNOSTICS_POINT_PRESENTATION = 2 # SB-4: a reopening inside the pitch needs >= 2 diagnostic questions
TOURS_FENETRE_REOUVERTURE = 24          # context given to the model to place a reopening end (SB-3)
REOUVERTURES = False                # SB-34 (Romain 2026-10-27): SPIN stops at the pitch; the SB-3 / SB-4 reopenings are off
CIBLES_DIAG = {"p_followed_by_i": 0.50, "prompted_share": 0.15, "closed_need_payoff": 0}   # §8, to validate
BUDGET_APPEL = {"S": ("ceiling", 2), "P": ("ceiling", 2), "I": ("floor", 3), "N": ("floor", 3)}  # §8

LETTRES = ("S", "P", "I", "N")
OUT = "OUT"
# OUT reasons in priority order (§3). `absent` = no gate said yes (system defect, never against the sales).
PRIORITE_HORS = ["nothing", "offer_info", "solution_load", "sales_list", "agreement"]
AIGUILLAGE = ("VALIDATION_REQUEST", "DECISION_REQUEST")       # gate 0
TYPES_ATOMES = ("SITUATION", "PAIN", "BLOCKER", "IMPACT", "DESIRE", "VALUE")
DOMAINES = ("money", "time", "clients", "family", "health", "self_belief", "future", "other")   # §2, §4
DIMENSIONS = ("revenue", "clients", "time", "career_status", "other")    # §6 "related to the goal"
ATOMES_ATTENDUS = {"S": {"SITUATION"}, "P": {"PAIN", "BLOCKER"}, "I": {"IMPACT"}, "N": {"DESIRE", "VALUE"}}

# Registers (SB-26..SB-33, Romain 2026-10-27): the code maps the domain a question asks about to one register.
REGISTRES = ("financial", "time_load", "identity_status", "mental_emotional", "other")
LIBELLES_REGISTRE = {"financial": "Financial", "time_load": "Time & load", "identity_status": "Identity & status",
                   "mental_emotional": "Mental & emotional", "other": "Other"}
REGISTRE_DU_DOMAINE = {"money": "financial", "clients": "financial", "time": "time_load", "family": "time_load",
                      "future": "identity_status", "self_belief": "mental_emotional", "health": "mental_emotional",
                      "other": "other", "none": "other"}
BASES_REGISTRE = ("named", "answer", "reference", "none")   # SB-28 / SB-35 / SB-29 / SB-31
TOURS_REPONSE_REGISTRE = 3          # SB-35: an open question is read in (at most) the first three turns of its answer
TOURS_REFERENCE_REGISTRE = 2       # SB-29: a reference is read in the last two prospect turns before the question
ACCORD_MIN_REGISTRE = 0.92      # SB-33: per-call share of registers decided 3/3 (Romain's 92 % target)
# SB-30 domain words, the code's cross-check of a "named" answer (SB-32 rule 3); matched on word starts
LEXIQUE_REGISTRE = {
    "financial": ("money", "income", "revenue", "earn", "salary", "cash", "price", "afford", "debt", "bills", "rent",
                  "financ", "profit", "dollar", "paid", "paying", "client", "customer", "project", "leads", "booking",
                  "pipeline", "sales"),
    "time_load": ("time", "hour", "week", "weekend", "schedule", "workload", "busy", "family", "kid", "child", "wife",
                  "husband", "partner", "son", "daughter", "parent"),
    "identity_status": ("future", "years from now", "long term", "long-term", "where do you see yourself",
                        "where do you want to be", "become", "dream", "vision", "career", "legacy", "status"),
    "mental_emotional": ("confiden", "believe in yourself", "self-belief", "motivat", "mindset", "fear", "doubt",
                         "feel", "emotion", "frustrat", "proud", "health", "stress", "anxi", "burnout", "burn out",
                         "burned out", "exhaust", "tired", "sleep", "energy"),
}


# =============================================================================================== S1 inventory
# Lexicons ported from the SPIN reference inventory script (segment.py).
def _replier(s: str) -> str:
    s = unicodedata.normalize("NFD", (s or "").lower().replace("’", "'"))
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.sub(r"[^\w\s']", " ", s)


ACCUEIL = set("yes yeah yep yup ok okay right sure fine exactly totally absolutely definitely correct true indeed "
          "mm-hmm mhm uh-huh cool great perfect awesome nice wow oh gotcha amazing beautiful lovely love".split())
INTERRO = re.compile(r"^(how|what|what's|whats|when|where|why|who|which|whose|do|does|did|are|is|was|were|have|has|"
                     r"had|can|could|would|will|should|shall|may|might|am|isn't|aren't|don't|doesn't|didn't|won't|"
                     r"wouldn't|couldn't)\b")
IMPERATIF = re.compile(r"^(tell me|walk me through|talk me through|describe|explain|help me understand|share with me|"
                        r"give me a sense|paint me a picture)")
QUEUES = [r"\bright\?$", r"\bisn't it\?$", r"\bdon't you\?$", r"\bcorrect\?$", r"\byeah\?$", r"\bno\?$",
         r"\bis that it\?$", r"\bis that right\?$", r"\bam i right\?$", r"\bdoes that make sense\?$", r"\bfair\?$",
         r"\byou know\?$", r"\bok\?$", r"\bokay\?$"]
QUEUE_SEULE = re.compile(r"^(right|correct|yeah|no|okay|ok|fair|you know|does that make sense|is that right|am i right|"
                       r"isn't it)\s*\?$", re.I)
MOTS_VIDES = set(_replier("""the a an and or but so to of in on at for with that this it its is are was were be been i you he
she we they me my your our their them there here what how when where why who which do does did have has had not no
yes just like really very about from as if then than also can could would will should get got go going know think
mean thing things kind sort lot little bit yeah okay right well one two some any more most much many even still now
today make made want really actually maybe something anything everything people time""").split())
MOTS_OFFRE = re.compile(r"\b(program|programme|academy|our (method|course|coaching|mentorship|offer)|the course|"
                         r"enroll|tuition|investment|price|cost|payment plan)\b")
LIGNE_SYSTEME = re.compile(r"SCREEN SHARING|https?://|WATCH:")


def couper_phrases(texte: str) -> list[str]:
    t = re.sub(r"\s+", " ", texte or "").strip()
    return [p.strip() for p in re.split(r"(?<=[.?!])\s+(?=[A-Z0-9\"'])", t) if p.strip()]


def forme_question(s: str) -> Optional[str]:
    """§2 Solicitation: final question mark, interrogative form without mark, or imperative of request."""
    ns = s.strip().lower()
    if ns.endswith("?"):
        return "interrogative"
    if IMPERATIF.match(_replier(ns).strip()):
        return "imperative"
    if INTERRO.match(ns):
        return "interrogative_no_mark"
    return None


def mots_contenu(s: str) -> set[str]:
    """SB-17: content words (4 letters or more, outside the stop list) and numbers."""
    sortie = {w for w in _replier(s).split() if len(w) >= MIN_MOTS_CONTENU and w not in MOTS_VIDES}
    for jet in re.findall(r"\$?\d[\d,.]*k?", (s or "").lower()):
        n = normaliser_nombre(jet)
        if n is not None:
            sortie.add("#" + n)
    return sortie


@dataclass
class Unite:
    """Internal unit of analysis: one solicitation with its deterministic attributes."""
    sol: Sollicitation
    tour: Tour
    rang: int
    total_dans_tour: int
    preambule: str = ""
    prospect_prec: list[Tour] = field(default_factory=list)
    attrs: dict[str, Any] = field(default_factory=dict)
    portes_: Optional[dict] = None             # resolved gate answer
    decision: Optional["DecisionLettre"] = None
    fin_fenetre: Optional[str] = None         # end of the perimeter window the unit belongs to (exclusive)
    dans_perimetre: bool = False
    reouverture: Optional[int] = None
    tours_spontanes: list[str] = field(default_factory=list)
    texte_reponse: str = ""
    suit_prec: bool = False               # this question reuses the previous answer (SB-17 / SB-19)
    sans_reponse: bool = False                 # SB-6
    parties: list = field(default_factory=list)  # [(text, LetterDecision)] after a SEG-2 split


def inventaire(ctx: ContexteAppel) -> list[Unite]:
    """S1: every sales sentence that is a solicitation becomes a unit (SEG-1); nothing is deleted, filters are
    attributes. SEG-4: an isolated validation tail closes the previous sentence. SEG-8: sales turns only."""
    unites: list[Unite] = []
    tours = [t for t in ctx.tours if not t.attribution_douteuse]
    for idx, t in enumerate(tours):
        if t.role != COMMERCIAL:
            continue
        fusionne: list[str] = []
        for s in couper_phrases(t.texte):
            if QUEUE_SEULE.match(s) and fusionne:                           # SEG-4
                fusionne[-1] = fusionne[-1].rstrip(".!") + ", " + s
            else:
                fusionne.append(s)
        qs = [(k, s) for k, s in enumerate(fusionne) if forme_question(s)]
        p_prec = [x for x in tours[:idx] if x.role == PROSPECT][-2:]
        mots_pros = set().union(*[mots_contenu(x.texte) for x in p_prec]) if p_prec else set()
        for r, (k, s) in enumerate(qs, 1):
            ws = [w for w in _replier(s).split() if w]
            bas = s.strip().lower()
            attrs = {
                "form": forme_question(s),
                "validation_tail": any(re.search(p, bas) for p in QUEUES),                     # SEG-4
                "backchannel": len(ws) <= 3 and all(w.strip("'") in ACCUEIL or w in ("oh", "really", "so", "and",
                                                                                  "hmm", "huh") for w in ws),  # SEG-7
                "alternative": bool(re.search(r"\bor\b", bas)) and bas.endswith("?"),         # SEG-3
                "open_branch": bool(re.search(r"\bor (something else|anything else|other|not)\b", bas)),
                "why": bool(re.search(r"\bwhy\b", bas)),
                "offer_mention": bool(MOTS_OFFRE.search(bas)),
                "anchor_words": sorted(mots_contenu(s) & mots_pros),                        # SEG-5 anchoring
                "n_words": len(ws),
                "stacked": len(qs) > 1,                                                       # SEG-1 / SB-6
                "system": bool(LIGNE_SYSTEME.search(s)),
                "no_final_mark": not s.strip().endswith("?"),
            }
            sid = f"Q{t.id[1:]}.{r}"
            etiquettes = [k2 for k2 in ("validation_tail", "backchannel", "stacked", "system") if attrs[k2]]
            unites.append(Unite(Sollicitation(sid, t.id, s, etiquettes=etiquettes), t, r, len(qs),
                              preambule=" ".join(fusionne[:k])[-500:], prospect_prec=p_prec, attrs=attrs))
    return unites


# =============================================================================================== S5 letter decision
@dataclass
class DecisionLettre:
    lettre: str                 # S / P / I / N / OUT, or NOT_SOLICITATION / ATTRIBUTION_DOUBTFUL / routing value
    porte: int                   # 0 routing, 1 OUT, 2 S, 3 N, 4 I, 5 P
    raison: Optional[str]       # OUT reason
    etiquettes: list[str]
    preuve_invalide: bool = False


def _preuve_ok(citation: Optional[str], texte: str) -> bool:
    return bool(citation) and normaliser(citation).strip(' .,?!"') in normaliser(texte)


def decider_lettre(g: dict, attrs: dict, texte: str) -> DecisionLettre:
    """Port of decide() (decide_all.py, SPIN reference P5-P7) with English field names.

    Order: SEG filters, gate 0 (routing), gate 1 OUT with the §3 hard rules evaluated before any positive test,
    then S (gate 2), N (gate 3), I (gate 4), P (gate 5); the first "yes" wins; none -> OUT `absent`.
    A positive gate whose quote is not in the solicitation fails (C3 rule 1) and marks the decision invalid.
    """
    etiquettes = list(g.get("tags") or [])
    if attrs.get("system") or g.get("is_solicitation") is False:
        return DecisionLettre("NOT_SOLICITATION", 0, None, etiquettes)
    if g.get("attribution_doubtful"):
        return DecisionLettre("ATTRIBUTION_DOUBTFUL", 0, None, etiquettes)
    if g.get("routing") in AIGUILLAGE:                                             # gate 0
        return DecisionLettre(g["routing"], 0, None, etiquettes)
    g1, g2, g3, g4, g5 = (g.get(k) or {} for k in ("g1", "g2", "g3", "g4", "g5"))
    raisons: list[str] = []
    if g1.get("reason") in PRIORITE_HORS:                                        # gate 1 (model)
        raisons.append(g1["reason"])
    if attrs.get("validation_tail"):                                           # hard rule: tail -> agreement
        raisons.append("agreement")
    if g3.get("state_or_value"):
        if g3.get("about_offer"):                                              # hard rule: value about the offer
            raisons.append("offer_info")
        if g3.get("load_named") and g3.get("antecedent") == "solution":         # hard rule: load of a solution
            raisons.append("solution_load")
        if g3.get("content_supplied") and not g3.get("load_named") and not g3.get("about_offer"):
            raisons.append("agreement")                                        # hard rule: closed need-payoff
            etiquettes.append("closed_need_payoff")
    if g4.get("consequence") and g4.get("antecedent_solution") and g3.get("load_named"):
        raisons.append("solution_load")
    if raisons:
        return DecisionLettre(OUT, 1, min(raisons, key=PRIORITE_HORS.index), sorted(set(etiquettes)))
    invalide = False

    def porte(cond: Any, partie: dict) -> bool:
        nonlocal invalide
        if not cond:
            return False
        if not _preuve_ok(partie.get("quote"), texte):
            invalide = True
            return False
        return True

    if porte(g2.get("neutral_fact") and not g2.get("exclusion"), g2):
        return DecisionLettre("S", 2, None, etiquettes, invalide)
    if porte(g3.get("state_or_value") and g3.get("antecedent") != "problem", g3):
        return DecisionLettre("N", 3, None, etiquettes, invalide)
    if porte(g4.get("consequence") and not g4.get("same_domain") and not g4.get("antecedent_solution"), g4):
        return DecisionLettre("I", 4, None, etiquettes, invalide)
    if porte(g5.get("difficulty") and (not g5.get("sales_named") or g5.get("anchored")), g5):
        return DecisionLettre("P", 5, None, etiquettes, invalide)
    return DecisionLettre(OUT, 1, "absent", etiquettes, invalide)


def decider_portes(g: dict, attrs: dict, texte: str) -> list[tuple[str, DecisionLettre]]:
    """Applies the model's SEG-2 split if any: returns [(text, decision)] for one or several units."""
    coupe, sous = g.get("split"), g.get("sub")
    if isinstance(coupe, list) and isinstance(sous, list) and len(coupe) >= 2 and len(sous) == len(coupe):
        # the validation tail belongs to the clause it closes (SEG-4): only the last part keeps it
        sortie = []
        for j, (txt, sg) in enumerate(zip(coupe, sous)):
            a = dict(attrs, validation_tail=attrs.get("validation_tail") and j == len(coupe) - 1)
            sortie.append((txt, decider_lettre(sg, a, txt)))
        return sortie
    return [(texte, decider_lettre(g, attrs, texte))]


def est_lettre_codee(lettre: Optional[str]) -> bool:
    return lettre in LETTRES or lettre == OUT


# =============================================================================================== S3 gate task
def _ctx_lines(tours: list[Tour], limite: int = 600) -> str:
    return "\n".join(f"[{t.id} {t.ts}] {t.role}: {t.texte[-limite:]}" for t in tours)


def _construire_portes(ctx: ContexteAppel, u: Unite) -> str:
    pos = "after the end of the discovery (offer / pitch / close phase)" if u.attrs.get("post_end") else \
        "before the first pitch or price"
    return (f"UNIT: {u.sol.id}  (turn {u.tour.id}, solicitation {u.rang} of {u.total_dans_tour} in the turn; {pos})\n"
            f"PREVIOUS PROSPECT TURNS:\n{_ctx_lines(u.prospect_prec) or '(none)'}\n"
            f"SALES PREAMBLE IN THE SAME TURN: {u.preambule or '(none)'}\n"
            f"SOLICITATION: {u.sol.texte}\n"
            f"CODE ATTRIBUTES: validation_tail={u.attrs['validation_tail']} alternative={u.attrs['alternative']} "
            f"open_branch={u.attrs['open_branch']} offer_mention={u.attrs['offer_mention']} "
            f"anchor_words={u.attrs['anchor_words']}\n"
            "Answer every gate (even after an earlier yes). Quotes are exact substrings of SOLICITATION.")


RAISONS_PORTE = set(PRIORITE_HORS) | {None}


def _valider_obj_porte(g: dict, texte: str, profondeur: int = 0) -> list[str]:
    errs = []
    if not isinstance(g, dict):
        return ["not_an_object"]
    if g.get("routing") not in (None, *AIGUILLAGE):
        errs.append("bad_routing")
    g1 = g.get("g1") or {}
    if g1.get("reason") not in RAISONS_PORTE:
        errs.append("bad_out_reason")
    positifs = [("g1", g1.get("reason")), ("g2", (g.get("g2") or {}).get("neutral_fact")),
                 ("g3", (g.get("g3") or {}).get("state_or_value")), ("g4", (g.get("g4") or {}).get("consequence")),
                 ("g5", (g.get("g5") or {}).get("difficulty"))]
    for k, pos in positifs:
        if pos:
            q = (g.get(k) or {}).get("quote")
            if not _preuve_ok(q, texte):
                errs.append(f"bad_quote:{k}")
            elif len(normaliser(q).split()) > 40:
                errs.append(f"quote_too_long:{k}")
    if (g.get("g3") or {}).get("antecedent") not in (None, "resolution", "problem", "solution", "none"):
        errs.append("bad_antecedent")
    coupe = g.get("split")
    if coupe and profondeur == 0:
        sous = g.get("sub") or []
        if not isinstance(coupe, list) or not isinstance(sous, list):
            return errs + ["bad_split"]
        if len(coupe) < 2 or len(sous) != len(coupe):
            errs.append("bad_split")
        for j, partie in enumerate(coupe):
            if not _preuve_ok(partie, texte):
                errs.append(f"split_not_verbatim:{j}")
            elif j < len(sous):
                errs += [f"sub{j}:{e}" for e in _valider_obj_porte(sous[j], partie, 1)]
    return errs


def tache_porte(u: Unite) -> TacheModele:
    """One closed task per solicitation. The key compared across passes is the code decision itself."""
    def cle(a: dict) -> Any:
        return [(d.lettre, d.raison, "closed_need_payoff" in d.etiquettes) for _, d in decider_portes(a, u.attrs, u.sol.texte)] \
            + [bool(a.get("objection_clarification"))]
    return TacheModele("spin.gates", "fast", "spin_portes", _construire_portes,
                     lambda a, c, uid: _valider_obj_porte(a, u.sol.texte), cle)


# =============================================================================================== perimeter
def _construire_reouverture(ctx: ContexteAppel, u: Unite) -> str:
    i = ctx.n(u.tour.id)
    fenetre = ctx.tours[i: i + TOURS_FENETRE_REOUVERTURE]
    return (f"REOPENING START: {u.sol.id} (turn {u.tour.id}): {u.sol.texte}\n"
            "Give the first SALES turn after the start where the sales returns to the offer (next offer segment), "
            "states a price, asks for a decision or changes topic. JSON: {\"end_turn\": \"T177\"|null, "
            "\"quote\": \"exact words of that turn\"}\n\nTRANSCRIPT\n" + ctx.afficher(fenetre))


def tache_reouverture(u: Unite) -> TacheModele:
    def valider(a: dict, ctx: ContexteAppel, uid: str) -> list[str]:
        et = a.get("end_turn")
        if et is None:
            return []
        try:
            if ctx.n(et) <= ctx.n(u.tour.id):
                return ["end_before_start"]
        except KeyError:
            return ["unknown_turn"]
        e = citation_ok(ctx, Preuve(a.get("quote", ""), et, COMMERCIAL), mots_min=2, mots_max=40)
        return [e] if e else []
    return TacheModele("spin.reopen_end", "fast", "spin_reouverture", _construire_reouverture, valider,
                     cle=lambda a: a.get("end_turn"))


def fin_decouverte(ctx: ContexteAppel) -> Optional[str]:
    """SB-1: first pitch start or first price, whichever comes first (Pitch annex PB-1, PB-3)."""
    c = [x for x in (ctx.phases.debut_presentation, ctx.phases.premier_prix) if x]
    return min(c, key=ctx.n) if c else None


def est_debut_valide(d: DecisionLettre) -> bool:
    """SB-1 / SB-2: the start bears on the prospect's situation, goals or problems; social, logistic and framing
    questions (gate 1 `nothing`), offer questions and loads are never the start."""
    return d.lettre in LETTRES or (d.lettre == OUT and d.raison in ("agreement", "sales_list"))


def est_diagnostic(u: Unite) -> bool:
    """SB-3: a new diagnostic question on situation / problems / goals. Not: offer, logistics (gate 1 `nothing`),
    financing (SB-25 -> OUT solution_load), resistance clarification (Objections competence)."""
    return bool(u.decision and u.decision.lettre in LETTRES and not (u.portes_ or {}).get("objection_clarification"))


def fin_de_reouverture(u: Unite) -> bool:
    """SB-3 code-side ends of a reopening: decision request, validation request, offer info, load of a solution,
    resistance clarification."""
    d = u.decision
    if d is None:
        return False
    return d.lettre in AIGUILLAGE or (d.lettre == OUT and d.raison in ("offer_info", "solution_load")) or \
        bool((u.portes_ or {}).get("objection_clarification"))


# =============================================================================================== answer spans
def plages_reponse(ctx: ContexteAppel, unites: list[Unite], tours_sollicitation: set[str]) -> None:
    """SB-5..SB-8. `units` are the coded units in transcript order (each with `window_end`).

    SB-5: the answer is the prospect speech after the solicitation up to the next sales solicitation; a sales
          backchannel of <= 5 words does not end it.
    SB-6: stacked solicitations: the answer goes to the last one, unless the prospect reuses a key word of an
          earlier one and none of the last; the others are `unanswered`.
    SB-7: subsumed: consecutive prospect turns with no sales speech in between are all in the span.
    SB-8: prospect speech after a longer sales acknowledgement and before the next solicitation is attached to the
          last solicitation with the flag `volunteered`.
    """
    tours_sol = {u.tour.id for u in unites} | tours_sollicitation     # any sales turn carrying a solicitation
    par_tour: dict[str, list[Unite]] = {}
    for u in unites:
        par_tour.setdefault(u.tour.id, []).append(u)
    tours = [t for t in ctx.tours if not t.attribution_douteuse]
    pos = {t.id: i for i, t in enumerate(tours)}
    for tid, groupe in par_tour.items():
        groupe.sort(key=lambda x: x.rang)
        fin = groupe[-1].fin_fenetre
        reponse, spontane, accueil = [], [], False
        for t in tours[pos[tid] + 1:]:
            if fin and ctx.n(t.id) >= ctx.n(fin):
                break
            if t.role == COMMERCIAL:
                if t.id in tours_sol:
                    break
                if len(t.texte.split()) > MOTS_MAX_RELANCE_ORALE:
                    accueil = True                                                  # SB-8
                continue
            if t.role == PROSPECT:
                (spontane if accueil else reponse).append(t.id)
        cible = groupe[-1]
        if len(groupe) > 1 and reponse:                                           # SB-6 exception
            premier = mots_contenu(ctx.tour(reponse[0]).texte)
            if not (mots_contenu(cible.sol.texte) & premier):
                plus_tot = [g for g in groupe[:-1] if mots_contenu(g.sol.texte) & premier]
                if plus_tot:
                    cible = plus_tot[-1]
        for g in groupe:
            g.sans_reponse = g is not cible
            if g.sans_reponse and "unanswered" not in g.sol.etiquettes:
                g.sol.etiquettes.append("unanswered")
        cible.sol.tours_reponse = reponse
        cible.tours_spontanes = spontane
        cible.texte_reponse = " ".join(ctx.tour(x).texte for x in reponse + spontane)


# =============================================================================================== atoms
def _construire_atomes(ctx: ContexteAppel, u: Unite) -> str:
    rep = [ctx.tour(x) for x in u.sol.tours_reponse]
    spont = [ctx.tour(x) for x in u.tours_spontanes]
    return (f"UNIT: {u.sol.id} (letter of the question: {u.sol.lettre}; the letter never changes with the answer)\n"
            f"PREVIOUS PROSPECT TURNS (context only, never quoted):\n{_ctx_lines(u.prospect_prec)}\n"
            f"SALES TURN {u.tour.id}: {u.tour.texte}\nQUESTION: {u.sol.texte}\n"
            f"ANSWER TURNS:\n{_ctx_lines(rep, 4000) or '(none)'}\n"
            f"VOLUNTEERED TURNS (after a sales acknowledgement):\n{_ctx_lines(spont, 4000) or '(none)'}\n"
            "List the atoms of the answer and volunteered turns. Quotes from those PROSPECT turns only.")


def _valider_atomes(a: dict, ctx: ContexteAppel, u: Unite) -> list[str]:
    errs = []
    permis = set(u.sol.tours_reponse) | set(u.tours_spontanes)
    for k, x in enumerate(a.get("atoms") or []):
        if x.get("type") not in TYPES_ATOMES:
            errs.append(f"bad_type:{k}")
            continue
        if x.get("turn") not in permis:
            errs.append(f"turn_outside_answer:{k}")
            continue
        e = citation_ok(ctx, Preuve(x.get("quote", ""), x["turn"], PROSPECT), mots_min=2, mots_max=40)
        if e:
            errs.append(f"{e}:{k}")
        if x["type"] == "IMPACT" and (x.get("domain") not in DOMAINES or x.get("problem_domain") not in DOMAINES):
            errs.append(f"bad_domain:{k}")
        if x.get("cause_quote"):
            e = citation_ok(ctx, Preuve(x["cause_quote"], x.get("cause_turn") or x["turn"], PROSPECT), mots_min=2,
                         mots_max=40)
            if e or (x.get("cause_turn") or x["turn"]) not in permis:
                errs.append(f"bad_cause_quote:{k}")
    return errs


def tache_atomes(u: Unite) -> TacheModele:
    return TacheModele("spin.atoms", "strong", "spin_atomes", _construire_atomes, lambda a, c, uid: _valider_atomes(a, c, u),
                     cle=lambda a: sorted((x.get("type"), x.get("turn"),
                                           x.get("domain") if x.get("type") == "IMPACT" else None)
                                          for x in a.get("atoms") or []))


MOTS_NOMBRES = r"(two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|forty|fifty|" \
            r"sixty|hundred|thousand|million|dozen)"


def a_quantite(citation: str) -> bool:
    """SB-24 (replaces SB-15): an amount, a count or a duration. A frequency alone ("every month") or a vague
    quantity ("a lot", "forever", X6) is not enough."""
    q = (citation or "").lower()
    return bool(re.search(r"\d", q) or re.search(rf"\b{MOTS_NOMBRES}\b", q) or
                re.search(r"\b(a|one) (year|month|week|day|hour|client|half)s?\b", q))


def lire_quantite(citation: str) -> tuple[Optional[float], Optional[str]]:
    m = re.search(r"(\$?\d[\d,.]*\s?(k|grand)?)\s*(a |per |an )?([a-z]+)?", (citation or "").lower())
    if not m:
        return None, None
    n = normaliser_nombre(m.group(1).replace(" ", ""))
    try:
        return (float(n) if n is not None else None), m.group(4)
    except ValueError:
        return None, m.group(4)


@dataclass
class DecisionAtome:
    garder: bool
    type: Optional[str]
    raison: str            # kept / prompted / approval_only / reported_speech / desire_after_pitch / ...
    quantifie: bool = False


def decider_atome(brut: dict, *, apres_presentation: bool) -> DecisionAtome:
    """Code decision rules on one model atom (§4 and Annex A3, in this order)."""
    t = brut.get("type")
    citation = brut.get("quote", "")
    if len(normaliser(citation).strip(' .,?!"').split()) < 2:                           # SB-9: 2 to 40 words (B2 case 12)
        return DecisionAtome(False, None, "below_two_words")
    if approbation_seule(citation):                                                    # C3 rule 5, X3
        return DecisionAtome(False, None, "approval_only")
    if brut.get("prompted_by_sales"):                                            # SB-14, X3 (kept, flagged)
        return DecisionAtome(False, t, "prompted")
    if brut.get("reported_speech") and not brut.get("owned"):                     # SB-23
        return DecisionAtome(False, None, "reported_speech")
    if t == "IMPACT":
        if brut.get("figure_kind") == "present" and not brut.get("income_drop_attributed"):
            t = "SITUATION"                                                     # SB-11: current figure, X4
        elif brut.get("domain") and brut.get("domain") == brut.get("problem_domain") and brut.get("domain") != "other":
            t = "PAIN"                                                          # SB-10: same domain, X4
    if t == "DESIRE" and apres_presentation:                                           # SB-12, X5
        return DecisionAtome(False, None, "desire_after_pitch")
    quantifie = bool(brut.get("quantified")) and a_quantite(citation)            # SB-24, X6
    if t == "IMPACT" and brut.get("income_drop_attributed"):                     # SB-22
        quantifie = a_quantite(citation)
    return DecisionAtome(True, t, "kept" if t == brut.get("type") else f"reclassified_{brut.get('type')}_to_{t}",
                        quantifie)


def _chevauche(a: Preuve, b: Preuve) -> bool:
    if a.tour != b.tour:
        return False
    x, y = normaliser(a.citation).strip(" .,"), normaliser(b.citation).strip(" .,")
    return x in y or y in x


def construire_atomes(ctx: ContexteAppel, u: Unite, atomes_bruts: list[dict], indice_debut: int,
                meta: dict[str, dict]) -> tuple[list[Atome], list[dict]]:
    """Turns validated model atoms of one answer into `Atom`s (code decision), SB-9 de-duplication."""
    apres_presentation = bool(ctx.phases.debut_presentation and ctx.n(u.tour.id) >= ctx.n(ctx.phases.debut_presentation))
    garde: list[Atome] = []
    journal: list[dict] = []
    for brut in atomes_bruts:
        d = decider_atome(brut, apres_presentation=apres_presentation)
        journal.append({"solicitation": u.sol.id, "turn": brut.get("turn"), "quote": brut.get("quote"),
                    "model_type": brut.get("type"), "decision": d.raison, "type": d.type})
        if d.type is None:
            continue
        ev = Preuve(brut["quote"], brut["turn"], PROSPECT)
        if d.garder and any(_chevauche(ev, k.preuve) and k.type == d.type for k in garde):   # SB-9 one passage
            continue
        val, unite = (None, None)
        if d.quantifie:
            mv = brut.get("value")
            if isinstance(mv, (int, float)) and any(normaliser_nombre(w) and float(normaliser_nombre(w)) == float(mv)
                                                    for w in re.findall(r"\$?[\w.,]+", brut["quote"].lower())):
                val, unite = float(mv), brut.get("unit")
            else:
                val, unite = lire_quantite(brut["quote"])
        a = Atome(f"A{indice_debut + len(garde) + 1:03d}", d.type, ev, u.sol.id, u.sol.lettre, brut.get("object"),
                 brut.get("domain"), d.quantifie, val, unite,
                 spontane=brut["turn"] in u.tours_spontanes, suggere_par_commercial=not d.garder)
        # side data not carried by core Atom: goal dimension (§6 D1) and the cause stated by the prospect (§6 D2)
        meta[a.id] = {"dimension": brut.get("dimension"),
                      "cause": Preuve(brut["cause_quote"], brut.get("cause_turn") or brut["turn"], PROSPECT)
                      if brut.get("cause_quote") else None}
        garde.append(a)
    return garde, journal


# =============================================================================================== follow-up
ECHO = re.compile(r"^(and )?(tell me more|how so|what else|meaning|what do you mean|in what way|what way|like what|"
                  r"such as|a lot|why|how come|and then|then what|really|for example|go on|say more)\b.{0,25}\?*$")


def approfondit(reponse_prec: str, question: str, preambule: str = "") -> bool:
    """SB-17: the question (with its same-turn preamble, SEG-5) reuses a content word of 4+ letters or a number of
    the previous answer. SB-19: an echo / anaphoric solicitation directly after the answer counts as followed up."""
    if not reponse_prec:
        return False
    q = normaliser(question).strip()
    if ECHO.match(q):
        return True
    qw = [w for w in _replier(question).split() if w]
    if 0 < len(qw) <= 4 and all(w in _replier(reponse_prec).split() for w in qw):   # SB-19 echo of the answer's words
        return True
    return bool(mots_contenu(question + " " + preambule) & mots_contenu(reponse_prec))


# =============================================================================================== chains
@dataclass
class MaillonChaine:
    id_sol: str
    lettre: str
    raison: Optional[str]
    atomes: list[Atome]            # non-volunteered, scoring atoms of its answer
    suit_prec: bool
    sans_reponse: bool = False


def _construire_lien(ctx: ContexteAppel, unite: tuple) -> str:
    ouvrante, citations_chaine, cand, reponse_cand = unite
    return (f"CHAIN OPENED BY {ouvrante.sol.id}: {ouvrante.sol.texte}\nPROBLEM QUOTES OF THE CHAIN: {citations_chaine}\n"
            f"CANDIDATE QUESTION {cand.sol.id} ({cand.tour.id}): {cand.sol.texte}\nCANDIDATE ANSWER: {reponse_cand}\n"
            "Does the candidate question and its answer bear on the same problem object as the chain?")


def tache_lien(cand: Unite, ctx: ContexteAppel) -> TacheModele:
    def valider(a: dict, c: ContexteAppel, uid: str) -> list[str]:
        if not isinstance(a.get("same_object"), bool):
            return ["missing_same_object"]
        if a["same_object"]:
            src = [cand.sol.texte, cand.preambule] + [ctx.tour(t).texte for t in cand.sol.tours_reponse]
            if not any(_preuve_ok(a.get("quote"), s) for s in src if s):
                return ["bad_quote"]
        return []
    return TacheModele("spin.link", "fast", "spin_lien", _construire_lien, valider, cle=lambda a: bool(a.get("same_object")))


def trouver_chaines(etapes: list[MaillonChaine], meme_objet: Callable[[MaillonChaine, list[MaillonChaine], MaillonChaine], bool]
                ) -> list[dict]:
    """SB-18 / SB-20 deep chains. `steps` are the coded solicitations in order; `same_object(opening, chain,
    candidate)` applies SB-16 (model link + code lexical check).

    Opening: a P whose (non-volunteered) answer has PAIN or BLOCKER. Then, among the following steps:
    - OUT `nothing` (and the other OUT reasons, SB-20) and `unanswered` stacked units are transparent;
    - OUT `sales_list` or `agreement` breaks the chain (SB-20);
    - a coded S/P/I/N on another object breaks it (SB-20);
    - an S on the same object does not break and is not a link (SB-20); a P on the same object neither;
    - an I or N that is not followed up on the previous answer breaks it (SB-17, SB-18 "each followed up");
    - first link: I with an IMPACT; deep when a later I or N on the object gives IMPACT, DESIRE or VALUE.
    Returns every deep chain found, one per object (a later P on the same object as a found chain is skipped).
    """
    chaines: list[dict] = []
    utilise: set[str] = set()
    for i, op in enumerate(etapes):
        if op.lettre != "P" or op.id_sol in utilise or not any(a.type in ("PAIN", "BLOCKER") for a in op.atomes):
            continue
        chaine = [op]
        impact: Optional[MaillonChaine] = None
        profond: Optional[MaillonChaine] = None
        rupteur = None
        for st in etapes[i + 1:]:
            if st.sans_reponse:
                continue
            if st.lettre == OUT:
                if st.raison in ("sales_list", "agreement"):
                    rupteur = f"{st.id_sol}:OUT_{st.raison}"
                    break
                continue
            if st.lettre not in LETTRES:
                continue
            if not meme_objet(op, chaine, st):
                rupteur = f"{st.id_sol}:other_object"
                break
            chaine.append(st)
            if st.lettre in ("S", "P"):
                continue
            if not st.suit_prec:
                rupteur = f"{st.id_sol}:not_followed_up"
                break
            genres = {a.type for a in st.atomes}
            if impact is None:
                if st.lettre == "I" and "IMPACT" in genres:
                    impact = st
                continue
            if genres & {"IMPACT", "DESIRE", "VALUE"}:
                profond = st
                break
        utilise |= {s.id_sol for s in chaine}
        if profond:
            obj = next((a.objet for a in op.atomes if a.type in ("PAIN", "BLOCKER")), None)
            chaines.append({"opening": op.id_sol, "impact": impact.id_sol, "closing": profond.id_sol,
                           "links": [s.id_sol for s in chaine], "object": obj,
                           "evidence": [a.preuve for s in (op, impact, profond) for a in s.atomes
                                        if a.type in ({"PAIN", "BLOCKER"} if s is op else
                                                      {"IMPACT"} if s is impact else {"IMPACT", "DESIRE", "VALUE"})]})
        else:
            chaines.append({"opening": op.id_sol, "deep": False, "broken_at": rupteur,
                           "links": [s.id_sol for s in chaine]})
    chaines_profondes = [c for c in chaines if "closing" in c]
    for c in chaines_profondes:
        c["deep"] = True
    return chaines


def lien_lexical(unites_chaine: list[Unite], chaine: list[MaillonChaine], unite_cand: Unite, cand: MaillonChaine) -> bool:
    """SB-16 code side: at least one shared content word between the quotes (atoms or questions) of the chain and
    those of the candidate. A followed-up echo question (SB-19) carries its object by anaphora."""
    texte_chaine = " ".join([u.sol.texte + " " + u.preambule for u in unites_chaine] +
                          [a.preuve.citation for s in chaine for a in s.atomes])
    texte_cand = " ".join([unite_cand.sol.texte, unite_cand.preambule] + [a.preuve.citation for a in cand.atomes])
    return bool(mots_contenu(texte_chaine) & mots_contenu(texte_cand)) or cand.suit_prec


def objets_distincts(chaines: list[dict]) -> list[dict]:
    """D5 level 2: deep chains on different objects (object labels compared after normalisation)."""
    sortie, vus = [], set()
    for c in chaines:
        if not c.get("deep"):
            continue
        k = normaliser(c.get("object") or c["opening"])
        if k in vus:
            continue
        vus.add(k)
        sortie.append(c)
    return sortie


# =============================================================================================== items
def _distincts(evs: list[Atome]) -> list[Atome]:
    sortie: list[Atome] = []
    for a in evs:
        if not any(_chevauche(a.preuve, b.preuve) for b in sortie):
            sortie.append(a)
    return sortie


def noter_items(atomes: list[Atome], chaines: list[dict], meta: Optional[dict[str, dict]] = None
                ) -> tuple[list[NoteItem], dict[str, list[Atome]]]:
    """§6. Prompted atoms never count. Volunteered atoms count for D1..D4 if COUNT_VOLUNTEERED (§11).
    `meta[atom.id]` may carry "dimension" (D1 goal relation) and "cause" (D2 cause Evidence)."""
    meta = meta or {}
    dim = lambda a: (meta.get(a.id) or {}).get("dimension")          # noqa: E731
    cause = lambda a: (meta.get(a.id) or {}).get("cause")            # noqa: E731
    reserve = [a for a in atomes if not a.suggere_par_commercial and (COMPTER_SPONTANES or not a.spontane)]
    by = {t: _distincts([a for a in reserve if a.type == t]) for t in TYPES_ATOMES}
    utilise: dict[str, list[Atome]] = {}
    items: list[NoteItem] = []

    # D1 Baseline: SITUATION related to the goal (same dimension as a DESIRE); no DESIRE -> any quantified one
    dims_desir = {dim(a) for a in by["DESIRE"]} - {None, "other"}
    if by["DESIRE"]:
        lie = [a for a in by["SITUATION"] if dim(a) in dims_desir]
    else:
        lie = [a for a in by["SITUATION"] if a.quantifie]
    q = [a for a in lie if a.quantifie]
    lv, ev = (2, q[:2]) if len(q) >= 2 else ((1, (q or lie)[:1]) if lie else (0, []))
    utilise["D1"] = ev
    items.append(item("D1", POIDS["D1"], lv, [a.preuve for a in ev],
                      "related to the goal by dimension" if by["DESIRE"] else "no DESIRE: quantified SITUATION"))

    # D2 Problem: distinct PAIN / BLOCKER; level 2 = two distinct, or one with its cause stated by the prospect
    pb = _distincts(by["PAIN"] + by["BLOCKER"])
    cause_par = [a for a in pb if cause(a) and not _chevauche(cause(a), a.preuve)]
    if len(pb) >= 2:
        lv, ev, evd, remarque = 2, pb[:2], [a.preuve for a in pb[:2]], "two distinct PAIN/BLOCKER"
    elif cause_par:
        lv, ev, evd, remarque = 2, cause_par[:1], [cause_par[0].preuve, cause(cause_par[0])], "one PAIN/BLOCKER with its cause"
    elif pb:
        lv, ev, evd, remarque = 1, pb[:1], [pb[0].preuve], ""
    else:
        lv, ev, evd, remarque = 0, [], [], ""
    utilise["D2"] = ev
    items.append(item("D2", POIDS["D2"], lv, evd, remarque))

    # D3 Implication: IMPACT; level 2 = two in distinct domains, at least one quantified
    imp = by["IMPACT"]
    lv, ev = (0, [])
    if imp:
        lv, ev = 1, [next((a for a in imp if a.quantifie), imp[0])]
        for a in imp:
            for b in imp:
                if a is not b and a.domaine != b.domaine and (a.quantifie or b.quantifie):
                    lv, ev = 2, [a, b]
                    break
            if lv == 2:
                break
    utilise["D3"] = ev
    items.append(item("D3", POIDS["D3"], lv, [a.preuve for a in ev]))

    # D4 Need-payoff: DESIRE -> 1; DESIRE and VALUE -> 2
    if by["DESIRE"] and by["VALUE"]:
        lv, ev = 2, [by["DESIRE"][0], by["VALUE"][0]]
    elif by["DESIRE"]:
        lv, ev = 1, [by["DESIRE"][0]]
    else:
        lv, ev = 0, []
    remarque = "VALUE without DESIRE gives level 0 (table §6)" if by["VALUE"] and not by["DESIRE"] else ""
    utilise["D4"] = ev
    items.append(item("D4", POIDS["D4"], lv, [a.preuve for a in ev], remarque))

    # D5 Depth: deep chains (never volunteered atoms, SB-8, X7); level 2 needs the quotes of both chains
    profond = objets_distincts(chaines)
    lv = 2 if len(profond) >= 2 else 1 if profond else 0
    evd = [e for c in profond[:2] for e in c["evidence"]]
    if lv == 2 and not (profond[0]["evidence"] and profond[1]["evidence"]):
        lv = 1
    items.append(item("D5", POIDS["D5"], lv, evd, f"{len(profond)} deep chain(s) on distinct objects"))
    return items, utilise


# =============================================================================================== diagnostics
def diagnostics(unites: list[Unite], atomes: list[Atome]) -> dict:
    """§8 coaching diagnostics. Displayed, never scored: the letter never produces points."""
    codees = [u for u in unites if u.dans_perimetre and u.decision and est_lettre_codee(u.decision.lettre)
             and u.sol.statut != "to_review"]
    spin = [u for u in codees if u.decision.lettre in LETTRES]
    comptes = {L: sum(u.decision.lettre == L for u in spin) for L in LETTRES}
    n_spin = sum(comptes.values())
    raisons_hors: dict[str, int] = {}
    for u in codees:
        if u.decision.lettre == OUT:
            raisons_hors[u.decision.raison] = raisons_hors.get(u.decision.raison, 0) + 1
    ps = [i for i, u in enumerate(spin) if u.decision.lettre == "P"]
    p_puis_i = sum(1 for i in ps if i + 1 < len(spin) and spin[i + 1].decision.lettre == "I")
    par_sol: dict[str, set[str]] = {}
    for a in atomes:
        if not a.suggere_par_commercial and not a.spontane:
            par_sol.setdefault(a.id_sollicitation, set()).add(a.type)
    rendement = {L: (round(sum(bool(par_sol.get(u.sol.id, set()) & ATOMES_ATTENDUS[L]) for u in spin
                            if u.decision.lettre == L) / comptes[L], 3) if comptes[L] else None) for L in LETTRES}
    repondu = [u for u in codees if not u.sans_reponse and u.sol.tours_reponse]
    budget = {L: {"count": comptes[L], genre: lim, "ok": comptes[L] <= lim if genre == "ceiling" else comptes[L] >= lim}
              for L, (genre, lim) in BUDGET_APPEL.items()}
    return {
        "note": "Letter layer: coaching only. The letter never produces points.",
        "letters": comptes,
        "letter_shares": {L: round(comptes[L] / n_spin, 3) if n_spin else None for L in LETTRES},
        "i_share": round(comptes["I"] / n_spin, 3) if n_spin else None,
        "out_reasons": raisons_hors,
        "call_budget": budget,
        "p_followed_by_i": round(p_puis_i / len(ps), 3) if ps else None,
        "prompted_share": round(raisons_hors.get("agreement", 0) / len(codees), 3) if codees else None,
        "closed_need_payoff": sum("closed_need_payoff" in u.sol.etiquettes for u in codees),
        "yield_per_letter": rendement,
        "follow_up_rate": round(sum(u.sol.approfondi for u in repondu) / len(repondu), 3) if repondu else None,
        "targets": CIBLES_DIAG,
    }


def applicabilite(unites: list[Unite], debut_decouverte: Optional[str]) -> tuple[str, list[str], dict]:
    """§5. Returns (status, reasons, health)."""
    perim = [u for u in unites if u.dans_perimetre and u.decision]
    codees = [u for u in perim if est_lettre_codee(u.decision.lettre) and u.sol.statut != "to_review"]
    absent = sum(u.decision.lettre == OUT and u.decision.raison == "absent" for u in codees)
    sante = {"absent_share": round(absent / len(codees), 3) if codees else 0.0,
              "to_review": sum(u.sol.statut == "to_review" for u in perim), "coded": len(codees)}
    if debut_decouverte is None:
        return "not_applicable", ["no_discovery"], sante
    if len(codees) < MIN_CODEES:
        return "not_applicable", [f"fewer_than_{MIN_CODEES}_coded_solicitations"], sante
    if sante["absent_share"] > PART_MAX_ABSENTS:
        return "excluded", ["health_absent_share"], sante
    return "scored", [], sante


# =============================================================================================== orchestration
def placer_perimetre(ctx: ContexteAppel, unites: list[Unite], resoudre: Callable[[Unite], None],
                    fin_reouverture: Callable[[Unite], Optional[str]]) -> dict:
    """SB-1, SB-2, SB-25, SB-34 (SB-3 / SB-4 off). `resolve(u)` runs the gates of a unit (sets u.gates / u.decision / status)."""
    fin = fin_decouverte(ctx)
    ctx.phases.fin_decouverte = fin
    pre = [u for u in unites if fin is None or ctx.n(u.tour.id) < ctx.n(fin)]
    poster = [u for u in unites if u not in pre]
    debut: Optional[Unite] = None
    for u in pre:
        if u.attrs["backchannel"] or u.attrs["system"]:           # SEG-7: never a solicitation (code)
            u.sol.etiquettes.append("not_coded")
            continue
        u.fin_fenetre = fin
        resoudre(u)
        if debut is None and u.decision and est_debut_valide(u.decision):   # SB-1, SB-2
            debut = u
        if debut is not None:
            u.dans_perimetre = True
        else:
            u.sol.etiquettes.append("pre_perimeter")
    ctx.phases.debut_decouverte = debut.tour.id if debut else None
    # SB-34: after the first pitch start or price nothing is SPIN: not read, not coded, no register
    reouvertures: list[dict] = []
    if not REOUVERTURES:
        for u in poster:
            u.attrs["post_end"] = True
            u.sol.etiquettes.append("post_discovery")
        return {"start": ctx.phases.debut_decouverte, "end": fin, "reopenings": reouvertures}
    # SB-3 reopenings after the end (superseded by SB-34, kept off)
    if fin is not None and debut is not None:
        for u in poster:
            u.attrs["post_end"] = True
        i = 0
        cand = [u for u in poster if not (u.attrs["backchannel"] or u.attrs["system"])]
        while i < len(cand):
            u = cand[i]
            resoudre(u)
            if not est_diagnostic(u):
                u.sol.etiquettes.append("post_discovery")
                i += 1
                continue
            fin_modele = fin_reouverture(u)
            executer = [u]
            j = i + 1
            while j < len(cand):
                v = cand[j]
                if fin_modele and ctx.n(v.tour.id) >= ctx.n(fin_modele):
                    break
                resoudre(v)
                if fin_de_reouverture(v):
                    break
                executer.append(v)
                j += 1
            arret = cand[j].tour.id if j < len(cand) else fin_modele
            if fin_modele and arret and ctx.n(fin_modele) < ctx.n(arret):
                arret = fin_modele
            n_diag = sum(est_diagnostic(v) for v in executer)
            dans_presentation = bool(ctx.phases.debut_presentation and ctx.n(u.tour.id) >= ctx.n(ctx.phases.debut_presentation) and
                            (ctx.phases.fin_presentation is None or ctx.n(u.tour.id) < ctx.n(ctx.phases.fin_presentation)))
            if dans_presentation and n_diag < MIN_DIAGNOSTICS_POINT_PRESENTATION:              # SB-4
                for v in executer:
                    v.sol.etiquettes.append("pitch_check_in" if v is u else "post_discovery")
            else:
                k = len(reouvertures)
                for v in executer:
                    v.dans_perimetre, v.reouverture, v.fin_fenetre = True, k, arret
                    v.sol.etiquettes.append(f"reopening_{k}")
                reouvertures.append({"start": u.tour.id, "end": arret, "solicitations": [v.sol.id for v in executer]})
            i = j
    return {"start": ctx.phases.debut_decouverte, "end": fin, "reopenings": reouvertures}


def appliquer_decision(u: Unite, d: DecisionLettre) -> None:
    u.decision = d
    u.sol.lettre, u.sol.raison_hors = d.lettre, d.raison
    u.sol.etiquettes = sorted(set(u.sol.etiquettes) | set(d.etiquettes) | ({"invalid_proof"} if d.preuve_invalide else set()))


def deplier_coupes(unites: list[Unite]) -> list[Unite]:
    """SEG-2: a solicitation the model split into coordinated interrogatives becomes several units
    (ids Q007.1a, Q007.1b ...), each with its own letter; they are stacked units for SB-6."""
    sortie: list[Unite] = []
    for u in unites:
        if len(u.parties) < 2:
            sortie.append(u)
            continue
        for j, (txt, d) in enumerate(u.parties):
            v = Unite(Sollicitation(f"{u.sol.id}{'abcdef'[j]}", u.tour.id, txt, etiquettes=sorted(set(u.sol.etiquettes) | {"stacked"}),
                                  statut=u.sol.statut), u.tour, u.rang, u.total_dans_tour, u.preambule, u.prospect_prec,
                     dict(u.attrs, stacked=True), u.portes_, None, u.fin_fenetre, u.dans_perimetre, u.reouverture)
            appliquer_decision(v, d)
            sortie.append(v)
    return sortie


# =============================================================================================== registers
def registres_lexique(texte: str) -> set[str]:
    """SB-30: the registers whose domain words appear in a text (word starts, case-insensitive)."""
    t = " " + re.sub(r"[^a-z0-9$' -]+", " ", _replier(texte)) + " "
    touches = set()
    for reg, mots in LEXIQUE_REGISTRE.items():
        if any(re.search(r"[ $]" + re.escape(w), t) for w in mots):
            touches.add(reg)
    if re.search(r"\$ ?\d|\d+ ?k\b", t):
        touches.add("financial")
    return touches


def decider_registre(a: Optional[dict]) -> Optional[str]:
    """SB-26: the code maps the model's asked domain to its register (other / none -> Other)."""
    if not a:
        return None
    return REGISTRE_DU_DOMAINE.get(a.get("asked_domain"))


def _tours_reponse(ctx: ContexteAppel, u: Unite) -> list:
    """SB-35: the prospect's answer to the question (SB-6 answer span), its first turns."""
    return [t for t in (ctx.tour(i) for i in (u.sol.tours_reponse or [])[:TOURS_REPONSE_REGISTRE]) if t is not None]


def _construire_registre(ctx: ContexteAppel, u: Unite) -> str:
    prec = u.prospect_prec[-TOURS_REFERENCE_REGISTRE:]
    rep = _tours_reponse(ctx, u)
    return (f"UNIT: {u.sol.id}  (turn {u.tour.id}, a {u.decision.lettre if u.decision else '?'} question of the discovery)\n"
            f"LAST PROSPECT TURNS BEFORE IT:\n{_ctx_lines(prec) or '(none)'}\n"
            f"SALES PREAMBLE IN THE SAME TURN: {u.preambule or '(none)'}\n"
            f"SOLICITATION: {u.sol.texte}\n"
            f"PROSPECT'S ANSWER TO IT:\n{chr(10).join(f'[{t.id} {t.ts}] {t.role}: {t.texte[:800]}' for t in rep) or '(no answer)'}\n"
            "Which domain does this question make the prospect talk about? Quotes are exact substrings.")


def _valider_registre(a: dict, ctx: ContexteAppel, u: Unite) -> list[str]:
    """SB-32 rules 1-3: closed values, an exact quote in the right place, the rule order of SB-35, no conflict with the
    domain words."""
    if not isinstance(a, dict):
        return ["not_an_object"]
    dom, base_ = a.get("asked_domain"), a.get("basis")
    if dom not in REGISTRE_DU_DOMAINE:
        return ["bad_domain"]
    if base_ not in BASES_REGISTRE:
        return ["bad_basis"]
    repondu = bool(_tours_reponse(ctx, u))
    if base_ == "none":
        if repondu:
            return ["none_with_answer"]                       # SB-35: an open question with an answer is read in it
        return [] if dom in ("none", "other") else ["none_basis_with_domain"]
    if dom == "none":
        return ["domain_without_basis"]
    q = a.get("quote")
    if base_ == "named":
        if dom == "other":
            return ["named_other"]                            # SB-35: a subject outside the seven domains is an open question
        ou = (u.preambule + " " + u.sol.texte) if u.preambule else u.sol.texte
        if not _preuve_ok(q, ou):
            return ["bad_quote:named"]
        lex = registres_lexique(u.sol.texte)
        if len(lex) == 1 and REGISTRE_DU_DOMAINE[dom] not in lex:
            return ["lexicon_conflict"]
        return []
    rt = a.get("reference_turn")
    if base_ == "answer":
        # SB-35: the effect of the question, in the prospect's own words in its answer
        if not repondu:
            return ["no_answer"]
        if rt not in {t.id for t in _tours_reponse(ctx, u)}:
            return ["bad_answer_turn"]
        e = citation_ok(ctx, Preuve(q or "", rt, PROSPECT), mots_min=1, mots_max=40)
        return [f"bad_quote:{e}"] if e else []
    # reference: only for an open question with no answer; the words it points to, in the last prospect turns (SB-29)
    if repondu:
        return ["reference_with_answer"]
    if rt not in {t.id for t in u.prospect_prec[-TOURS_REFERENCE_REGISTRE:]}:
        return ["bad_reference_turn"]
    e = citation_ok(ctx, Preuve(q or "", rt, PROSPECT), mots_min=1, mots_max=40)
    return [f"bad_quote:{e}"] if e else []


def tache_registre(u: Unite) -> TacheModele:
    """One closed task per coded question of the discovery; the key compared across passes is the register."""
    return TacheModele("spin.register", "fast", "spin_registre", _construire_registre,
                     lambda a, c, uid: _valider_registre(a, c, u), cle=lambda a: decider_registre(a))


def resume_registres(unites: list["Unite"], decide: dict[str, dict]) -> dict:
    """SB-33: counts per register, and the per-call agreement gate (share of registers decided 3/3)."""
    n = len(decide)
    verifie_ = sum(1 for d in decide.values() if d["status"] == "verified")
    revue = sum(1 for d in decide.values() if d["status"] == "to_review")
    comptes = {r: sum(1 for d in decide.values() if d["register"] == r) for r in REGISTRES}
    accord = round(verifie_ / n, 3) if n else None
    signaux = ["register_agreement_low"] if n and accord < ACCORD_MIN_REGISTRE else []
    return {"counts": comptes, "questions": n, "verified": verifie_, "to_review": revue,
            "agreement": accord, "threshold": ACCORD_MIN_REGISTRE, "flags": signaux,
            "labels": LIBELLES_REGISTRE}


class CompetenceSpin:
    nom_ = "SPIN"
    version_regles = "SPIN-1.3"

    def executer(self, ctx: ContexteAppel, executeur: Executeur) -> ResultatCompetence:
        res = ResultatCompetence(self.nom_, self.version_regles)
        unites = inventaire(ctx)
        statuts_: list[str] = []
        concord: list[str] = []

        def resoudre(u: Unite) -> None:
            """S3 + S4 + S5 for one unit: three passes, validation, arbitration, then the code letter."""
            if u.portes_ is not None or u.sol.statut in ("to_review", "verified", "arbitrated"):
                return
            r = executeur.executer(ctx, tache_porte(u), f"gates:{u.sol.id}", u)
            u.sol.statut = r.statut
            statuts_.append(r.statut)
            concord.append(r.concordance)
            if r.reponse is None:                                    # C3 rule 7 / C4: excluded from scores
                u.sol.etiquettes.append("to_review")
                return
            u.portes_ = r.reponse
            u.parties = decider_portes(r.reponse, u.attrs, u.sol.texte)
            # for the perimeter, a split unit is represented by its first S/P/I/N part (else its first part)
            appliquer_decision(u, next((d for _, d in u.parties if d.lettre in LETTRES), u.parties[0][1]))

        def fin_reouverture(u: Unite) -> Optional[str]:
            r = executeur.executer(ctx, tache_reouverture(u), f"reopen:{u.sol.id}", u)
            return (r.reponse or {}).get("end_turn")

        perimetre = placer_perimetre(ctx, unites, resoudre, fin_reouverture)
        unites = deplier_coupes(unites)
        for v in unites:
            if not v.dans_perimetre:          # inventoried, not coded: the letter is only written inside the perimeter
                v.sol.lettre = v.sol.raison_hors = None
                if "not_coded" not in v.sol.etiquettes:
                    v.sol.etiquettes.append("not_coded")
        for k, v in enumerate(unites):
            v.rang = k                                              # transcript order, used by SB-6
        codees = [u for u in unites if u.dans_perimetre and u.decision and est_lettre_codee(u.decision.lettre)]
        plages_reponse(ctx, codees, {u.tour.id for u in unites if not u.attrs["backchannel"]})

        # atoms: model extraction, then code decisions (SB-9..SB-15, SB-22..SB-24)
        atomes: list[Atome] = []
        meta: dict[str, dict] = {}
        journal_atomes: list[dict] = []
        for u in codees:
            if u.sans_reponse or not (u.sol.tours_reponse or u.tours_spontanes):
                continue
            r = executeur.executer(ctx, tache_atomes(u), f"atoms:{u.sol.id}", u)
            statuts_.append(r.statut)
            concord.append(r.concordance)
            if r.reponse is None:
                u.sol.etiquettes.append("atoms_to_review")
                continue
            nouveau, journal = construire_atomes(ctx, u, r.reponse.get("atoms") or [], len(atomes), meta)
            atomes += nouveau
            journal_atomes += journal
        # SB-21: an action-plan question is N only if its answer states a future state or its value
        for u in codees:
            if u.decision.lettre == "N" and ((u.portes_ or {}).get("g3") or {}).get("action_plan"):
                genres = {a.type for a in atomes if a.id_sollicitation == u.sol.id and not a.suggere_par_commercial}
                if not genres & {"DESIRE", "VALUE"}:
                    appliquer_decision(u, DecisionLettre(OUT, 1, "solution_load", u.decision.etiquettes + ["sb21_action_plan"]))
                    for a in atomes:
                        if a.id_sollicitation == u.sol.id:
                            a.lettre = OUT
        ctx.atomes = atomes

        # follow-up (SB-17 / SB-19) between consecutive answered coded solicitations
        repondu = [u for u in codees if not u.sans_reponse]
        for prec, suiv in zip(repondu, repondu[1:]):
            suiv.suit_prec = approfondit(prec.texte_reponse, suiv.sol.texte, suiv.preambule)
            prec.sol.approfondi = suiv.suit_prec

        # chains: model link + code lexical check (SB-16), then SB-18 / SB-20 in code
        par_id = {u.sol.id: u for u in codees}
        etapes = [MaillonChaine(u.sol.id, u.decision.lettre, u.decision.raison,
                           [a for a in atomes if a.id_sollicitation == u.sol.id and not a.suggere_par_commercial
                            and not a.spontane], u.suit_prec, u.sans_reponse)
                 for u in codees if u.sol.statut != "to_review"]

        def meme_objet(op: MaillonChaine, chaine: list[MaillonChaine], cand: MaillonChaine) -> bool:
            cu = par_id[cand.id_sol]
            r = executeur.executer(ctx, tache_lien(cu, ctx), f"link:{op.id_sol}>{cand.id_sol}",
                           (par_id[op.id_sol], [a.preuve.citation for s in chaine for a in s.atomes], cu,
                            cu.texte_reponse[:1500]))
            statuts_.append(r.statut)
            modele = bool(r.reponse and r.reponse.get("same_object"))
            return modele and lien_lexical([par_id[s.id_sol] for s in chaine], chaine, cu, cand)

        chaines = trouver_chaines(etapes, meme_objet)

        # registers (SB-26..SB-33): coded questions before the pitch only (not reopenings, not OUT, not post-pitch)
        reg_decides: dict[str, dict] = {}
        for u in codees:
            if u.reouverture is not None or u.sol.statut == "to_review" or not u.decision or u.decision.lettre not in LETTRES:
                continue
            r = executeur.executer(ctx, tache_registre(u), f"register:{u.sol.id}", u)
            statuts_.append(r.statut)
            reg = decider_registre(r.reponse) if r.reponse is not None else None
            reg_decides[u.sol.id] = {"register": reg, "status": r.statut, "concordance": r.concordance,
                                     "domain": (r.reponse or {}).get("asked_domain"), "basis": (r.reponse or {}).get("basis"),
                                     "quote": (r.reponse or {}).get("quote"), "reference_turn": (r.reponse or {}).get("reference_turn")}

        # shared state (CONTRACT) and result
        ctx.sollicitations = [u.sol for u in unites]
        statut, raisons, sante = applicabilite(unites, ctx.phases.debut_decouverte)
        res.statut, res.raisons = statut, raisons
        if "to_review" in statuts_:
            res.signaux.append("units_to_review")
        res.concordance = (min(concord, key=lambda c: int(c.split("/")[0]) / max(1, int(c.split("/")[1])))
                           if concord else None)
        diag = diagnostics(unites, atomes)
        resume_reg = resume_registres(unites, reg_decides)
        res.signaux += resume_reg["flags"]
        res.signaux += [f"budget_{L}" for L, b in diag["call_budget"].items() if not b["ok"]]
        items, _ = noter_items(atomes, chaines, meta)
        if statut == "scored":
            res.items = items
            res.note = note_appel(items)
        res.details = {
            "perimeter": perimetre,
            "items_evidence": self._details_preuves(ctx, items, atomes) if statut == "scored" else {},
            "chains": [{k: v for k, v in c.items() if k != "evidence"} for c in chaines],
            "diagnostics": diag,
            "health": sante,
            "unit_status": {s: statuts_.count(s) for s in sorted(set(statuts_))},
            "atom_decisions": journal_atomes,
            "solicitations": [{"id": u.sol.id, "turn": u.tour.id, "ts": u.tour.ts, "letter": u.sol.lettre,
                               "gate_letter": u.decision.lettre if u.decision else None,
                               "out_reason": u.sol.raison_hors, "gate": u.decision.porte if u.decision else None,
                               "tags": u.sol.etiquettes, "in_perimeter": u.dans_perimetre, "status": u.sol.statut,
                               "answer_turns": u.sol.tours_reponse, "followed_up": u.sol.approfondi,
                               "register": (reg_decides.get(u.sol.id) or {}).get("register"),
                               "register_status": (reg_decides.get(u.sol.id) or {}).get("status"),
                               "register_basis": (reg_decides.get(u.sol.id) or {}).get("basis"),
                               "register_domain": (reg_decides.get(u.sol.id) or {}).get("domain"),
                               "register_quote": (reg_decides.get(u.sol.id) or {}).get("quote"),
                               "register_reference_turn": (reg_decides.get(u.sol.id) or {}).get("reference_turn")}
                              for u in unites],
            "registers": resume_reg,
        }
        return res

    @staticmethod
    def _details_preuves(ctx: ContexteAppel, items: list[NoteItem], atomes: list[Atome]) -> dict:
        """§10 output contract: each evidence with turn, ts, speaker, quote, atom, domain, question id and letter."""
        sortie = {}
        for it in items:
            lignes_ = []
            for e in it.preuve:
                a = next((x for x in atomes if x.preuve.tour == e.tour and x.preuve.citation == e.citation), None)
                lignes_.append({"turn": e.tour, "ts": ctx.tour(e.tour).ts, "speaker": PROSPECT, "quote": e.citation,
                             "atom": a.type if a else "CAUSE", "domain": a.domaine if a else None,
                             "question_id": a.id_sollicitation if a else None,
                             "question_letter": a.lettre if a else None})
            sortie[it.id] = {"level": it.niveau, "evidence": lignes_, "note": it.remarque}
        return sortie
