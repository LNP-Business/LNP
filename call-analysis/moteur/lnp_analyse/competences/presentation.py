"""Competence 3 - Pitch (methodology version 2.0, rules PITCH-2.0).

One blocker (the validated P of the Gap), one mechanism (the one carrying the name of P's category), a four-step
staircase (1 restate the blocker, 2 the mechanism, 3 the transformation A -> B, 4 the proof), then the roadmap,
the amount and the decision. Compliance gate first (§5.1): pitch_before_gap (PB-37), out_of_gap_claim (PB-35,
PB-31), outcome_promise (PB-36) -> score 0. Then items K1..K7 (§5.2).

The model only extracts and quotes (closed answers, exact quotes); every decision below is code.
Business facts (mechanism principles and phases, case library, case matching factor, roadmap order) are
configuration: when absent the code flags them (§4) and never invents them.
"""
from __future__ import annotations

import itertools
import json
import re
from typing import Any, Optional

from ..noyau.modeles import ContexteAppel, ResultatCompetence, Preuve, PROSPECT, COMMERCIAL
from ..noyau.executeur import TacheModele, Executeur
from ..noyau.notation import note_appel, item
from ..noyau.texte import approbation_seule, canon, jetons_propres, expression_cle_ok, normaliser, normaliser_nombre, citation_ok, phrases

NOM, VERSION_REGLES = "PITCH", "PITCH-2.0"

# §2.1 - the nine blockers = the nine mechanisms
NEUF = ["Skill", "Legitimacy", "Pricing", "Acquisition", "Selling", "Delivery", "Time", "Past failure",
        "Financial risk"]
INCONNU = "P_category_unknown"            # PB-27: fits none of the nine -> uncovered_case
PAS_BLOCAGE = "not_a_pitch_blocker"       # PB-27: lack of money = decision-circuit fact / objection
CATEGORIES = NEUF + [INCONNU, PAS_BLOCAGE]

# §5.2 weights (proposals, to validate)
POIDS = {"K1": 15, "K2": 20, "K3": 15, "K4": 15, "K5": 10, "K6": 15, "K7": 10}

ACTIONS_PROMESSE = {"run_business", "find_clients", "sign_clients", "deliver_projects"}       # PB-36
TYPES_ADHESION = {"appropriation", "projection", "new_link"}                                 # PB-14
TYPES_AFFIRMATION = {"figure", "case", "price", "guarantee"}                                       # PB-35

CONFIG_DEFAUT: dict[str, Any] = {
    "step_max_sentences": 3,          # PB-33 / K5 (tolerance to validate)
    "principle_max_words": 25,        # PB-29 principle in one sentence (to validate)
    "recitation_min_items": 3,        # PB-29 recitation threshold (to validate)
    "case_match_factor": None,        # PB-31 starting value within a factor: à confirmer -> None = not configured
    "mechanism_reference_missing_cap": 1,   # §4: step 2 checked on the category only (interpretation, to validate)
    "monologue_share": 0.85,          # §7 talk share threshold (to validate)
    "severity": "zero",               # §5.1: "zero" (score 0) or "cap40" (alternative to validate)
    "chunk_turns": 40,                # list tasks (claims, promises, adhesion) are chunked by this many turns
}


# ============================================================================================ small helpers
def _pr(d: Optional[dict], role: Optional[str] = None) -> Optional[Preuve]:
    if not d or not d.get("quote") or not d.get("turn"):
        return None
    return Preuve(d["quote"], d["turn"], role)


def _pos(ctx: ContexteAppel, tour: str, citation: str = "") -> tuple[int, int]:
    """Position of a quote: (turn position, character index inside the normalised turn)."""
    i = normaliser(ctx.tour(tour).texte).find(normaliser(citation).strip(' .,?!"')) if citation else 0
    return (ctx.n(tour), max(i, 0))


def _pos_plage(ctx: ContexteAppel, sp: Optional[dict]) -> Optional[tuple[int, int]]:
    """PB-32: a step is placed at the turn of its first sentence."""
    if not sp:
        return None
    return _pos(ctx, sp["start_turn"], sp.get("start_quote", ""))


def texte_plage(ctx: ContexteAppel, sp: Optional[dict]) -> str:
    """Normalised sales text of a step span, from its start quote to the end of its end quote (SALES turns only)."""
    if not sp:
        return ""
    s, e = sp["start_turn"], sp["end_turn"]
    sortie = []
    for t in ctx.tours[ctx.n(s): ctx.n(e) + 1]:
        if t.role != COMMERCIAL or t.attribution_douteuse:
            continue
        txt = normaliser(t.texte)
        if t.id == e and sp.get("end_quote"):
            q = normaliser(sp["end_quote"]).strip(' .,?!"')
            j = txt.find(q)
            if j >= 0:
                txt = txt[: j + len(q)]
        if t.id == s and sp.get("start_quote"):
            q = normaliser(sp["start_quote"]).strip(' .,?!"')
            j = txt.find(q)
            if j >= 0:
                txt = txt[j:]
        sortie.append(txt)
    return " ".join(sortie).strip()


def n_phrases(ctx: ContexteAppel, sp: Optional[dict]) -> int:
    """PB-33: end punctuation, then split at 'and' + subject in sentences over 40 words."""
    return len(phrases(texte_plage(ctx, sp))) if sp else 0


def nombres_dans(texte: str) -> list[str]:
    """Canonical numbers of a text (PB-21 normalisation: 10K = 10,000 = $10,000 = ten thousand)."""
    return [t for t in canon(jetons_propres(texte), False) if re.fullmatch(r"\d+(\.\d+)?", t)]


def nombres_egaux(a: Any, b: Any) -> bool:
    if a is None or b is None:
        return False
    na, nb = normaliser_nombre(str(a)), normaliser_nombre(str(b))
    if na is None or nb is None:
        return False
    return float(na) == float(nb)


_CARTE_UNITES = {"monthly": "month", "months": "month", "mo": "month", "yearly": "year", "years": "year",
             "annual": "year", "annually": "year", "yr": "year", "weekly": "week", "weeks": "week", "wk": "week",
             "hours": "hour", "hrs": "hour", "hr": "hour", "h": "hour", "clients": "client", "projects": "project",
             "days": "day", "daily": "day"}
_REJET_UNITE = {"$", "€", "£", "usd", "eur", "euro", "euros", "dollar", "dollars", "per", "a", "an", "/", "each",
              "every", "of", "in", "income", "revenue"}


def normaliser_unite(u: Optional[str]) -> frozenset:
    """Unit comparison for 'his unit' (PB-30, PB-31): currency and filler words ignored, synonyms merged."""
    jets = re.findall(r"[a-z$€£/]+", (u or "").lower().replace("/", " / "))
    return frozenset(_CARTE_UNITES.get(t, t) for t in jets if t not in _REJET_UNITE)


def _bornes(ctx: ContexteAppel) -> tuple[Optional[str], Optional[str]]:
    """The pitch window used by every task: pitch start .. decision request (PB-35), else end of call."""
    return ctx.phases.debut_presentation, ctx.phases.demande_decision


def _apres(ctx: ContexteAppel, tour: Optional[str]) -> Optional[str]:
    """Turn id right after `turn` (for inclusive windows)."""
    if tour is None:
        return None
    i = ctx.n(tour) + 1
    return ctx.tours[i].id if i < len(ctx.tours) else None


def _fin_fenetre(ctx: ContexteAppel) -> Optional[str]:
    """Exclusive end of the pitch window: the turn after the decision request (it is included), or None."""
    return _apres(ctx, ctx.phases.demande_decision)


# ============================================================================================ model tasks
def _afficher_fenetre(ctx: ContexteAppel, debut: Optional[str], fin_excl: Optional[str]) -> str:
    return ctx.afficher(ctx.fenetre(debut, fin_excl))


def _verifier(ctx, d, role, errs, etiquette, phase=None, mots_min=2):
    e = citation_ok(ctx, Preuve(d.get("quote", ""), d.get("turn", ""), role), mots_min=mots_min,
                 phase_permise=phase)
    if e:
        errs.append(f"{etiquette}:{e}")


def _verifier_plage(ctx, sp, errs, etiquette, phase):
    if sp is None:
        return
    for k in ("start", "end"):
        _verifier(ctx, {"quote": sp.get(f"{k}_quote", ""), "turn": sp.get(f"{k}_turn", "")}, COMMERCIAL, errs,
               f"{etiquette}.{k}", phase, mots_min=1)
    if not errs:
        if ctx.n(sp["end_turn"]) < ctx.n(sp["start_turn"]):
            errs.append(f"{etiquette}:end_before_start")


def _phase_presentation(ctx):
    return (ctx.phases.debut_presentation, _fin_fenetre(ctx))


def _avant_presentation(ctx):
    return (None, ctx.phases.debut_presentation)


# ---- PB-27 category of P
def _construire_cat(ctx: ContexteAppel, vp: dict) -> str:
    i = ctx.n(vp["turn"])
    fen = ctx.tours[max(0, i - 2): i + 1]
    return (f"VALIDATED P (from the Gap result): turn {vp['turn']}: \"{vp['quote']}\"\n"
            "Classify this blocker (PB-27). Quote the deciding words from that PROSPECT turn.\n\nCONTEXT\n" +
            ctx.afficher(fen))


def _valider_cat(rep: dict, ctx: ContexteAppel, id_unite: str) -> list[str]:
    errs: list[str] = []
    if rep.get("category") not in CATEGORIES:
        return ["bad_category"]
    if rep["category"] in NEUF:
        _verifier(ctx, rep, PROSPECT, errs, "category", mots_min=1)
        if not errs and rep.get("turn") != id_unite.split(":", 1)[1]:
            errs.append("category:not_the_validated_P_turn")
    return errs


CATEGORIE = TacheModele("pitch.p_category", "strong", "pitch_category", _construire_cat, _valider_cat,
                     cle=lambda a: a.get("category"))


# ---- PB-28..PB-31 steps, PB-34 roadmap: one unit each, the whole pitch window
def _contexte_etapes(ctx: ContexteAppel, entete: str) -> str:
    s, _ = _bornes(ctx)
    return (entete + f"\nPITCH START: {s}. Answer about the pitch extract only.\n\nPITCH EXTRACT\n" +
            _afficher_fenetre(ctx, s, _fin_fenetre(ctx)))


def _ecart(ctx: ContexteAppel) -> dict:
    g = ctx.resultats.get("GAP")
    return (g.details or {}) if g else {}


def _construire_etape1(ctx, unite):
    vp = _ecart(ctx).get("validated_P") or {}
    return _contexte_etapes(ctx, f"VALIDATED P: turn {vp.get('turn')}: \"{vp.get('quote')}\"")


def _valider_etape1(rep, ctx, id_unite):
    errs: list[str] = []
    _verifier_plage(ctx, rep.get("step"), errs, "step", _phase_presentation(ctx))
    for o in rep.get("other_blockers") or []:
        _verifier(ctx, o, COMMERCIAL, errs, "other_blocker", _phase_presentation(ctx))
    return errs


ETAPE1 = TacheModele("pitch.step1", "strong", "pitch_step1", _construire_etape1, _valider_etape1,
                  cle=lambda a: [(a.get("step") or {}).get("start_turn"), len(a.get("other_blockers") or [])])


def _texte_reference_meca(ctx: ContexteAppel) -> str:
    ref = (ctx.reference_offre or {}).get("mechanisms") or {}
    if not ref:
        return "MECHANISM REFERENCE: missing (map by the blocker each passage answers)."
    return "MECHANISM REFERENCE\n" + json.dumps(ref, ensure_ascii=False, indent=1)


def _construire_etape2(ctx, unite):
    cat = unite or "unknown"
    return _contexte_etapes(ctx, f"CATEGORY OF THE VALIDATED P: {cat}\n" + _texte_reference_meca(ctx))


def _valider_etape2(rep, ctx, id_unite):
    errs: list[str] = []
    _verifier_plage(ctx, rep.get("step"), errs, "step", _phase_presentation(ctx))
    for m in rep.get("mechanisms_stated") or []:
        if m.get("mechanism") not in NEUF:
            errs.append("bad_mechanism")
        if m.get("kind") not in ("principle", "phase"):
            errs.append("bad_kind")
        _verifier(ctx, m, COMMERCIAL, errs, "mechanism", _phase_presentation(ctx))
    if rep.get("recitation"):
        _verifier(ctx, rep["recitation"], COMMERCIAL, errs, "recitation", _phase_presentation(ctx))
    return errs


ETAPE2 = TacheModele("pitch.step2", "strong", "pitch_step2", _construire_etape2, _valider_etape2,
                  cle=lambda a: [(a.get("step") or {}).get("start_turn"),
                                 sorted({(m["mechanism"], m["kind"]) for m in a.get("mechanisms_stated") or []}),
                                 len((a.get("recitation") or {}).get("items") or [])])


def _construire_etape3(ctx, unite):
    g = _ecart(ctx)
    return _contexte_etapes(ctx, "SELECTED A (Gap): " + json.dumps(g.get("selected_A"), ensure_ascii=False) +
                          "\nSELECTED B (Gap): " + json.dumps(g.get("selected_B"), ensure_ascii=False))


def _valider_etape3(rep, ctx, id_unite):
    errs: list[str] = []
    ph = _phase_presentation(ctx)
    _verifier_plage(ctx, rep.get("step"), errs, "step", ph)
    for k in ("A", "B", "deadline", "image"):
        if rep.get(k):
            _verifier(ctx, rep[k], COMMERCIAL, errs, k, ph, mots_min=1)
    for k in ("deadline_source", "image_source"):
        if rep.get(k):
            _verifier(ctx, rep[k], PROSPECT, errs, k, _avant_presentation(ctx), mots_min=1)
    return errs


ETAPE3 = TacheModele("pitch.step3", "strong", "pitch_step3", _construire_etape3, _valider_etape3,
                  cle=lambda a: [(a.get("step") or {}).get("start_turn"),
                                 [((a.get(k) or {}).get("value"), (a.get(k) or {}).get("unit")) for k in ("A", "B")],
                                 bool(a.get("deadline")), bool(a.get("image")), a.get("image_key_expression")])


def _texte_bibliotheque(ctx: ContexteAppel) -> str:
    bib = ctx.bibliotheque_cas or []
    if not bib:
        return "CASE LIBRARY: missing."
    return "CASE LIBRARY\n" + json.dumps(bib, ensure_ascii=False, indent=1)


def _construire_etape4(ctx, unite):
    return _contexte_etapes(ctx, _texte_bibliotheque(ctx))


def _valider_etape4(rep, ctx, id_unite):
    errs: list[str] = []
    ph = _phase_presentation(ctx)
    for c in rep.get("cases") or []:
        _verifier_plage(ctx, c.get("step"), errs, "case.step", ph)
        _verifier(ctx, c, COMMERCIAL, errs, "case", ph)
        if c.get("prospect_evidence"):
            _verifier(ctx, c["prospect_evidence"], PROSPECT, errs, "case.prospect", _avant_presentation(ctx), mots_min=1)
    return errs


ETAPE4 = TacheModele("pitch.step4", "strong", "pitch_step4", _construire_etape4, _valider_etape4,
                  cle=lambda a: sorted((c.get("turn"), c.get("library_id"), bool(c.get("profile_match")))
                                       for c in a.get("cases") or []))


def _construire_feuille_route(ctx, unite):
    rb = _ecart(ctx).get("roadmap_blockers") or []
    return _contexte_etapes(ctx, "HIS BLOCKERS (Gap roadmap_blockers): " + json.dumps(rb, ensure_ascii=False))


def _valider_feuille_route(rep, ctx, id_unite):
    errs: list[str] = []
    ph = (ctx.phases.debut_presentation, None)          # the roadmap may come after the price (K6 = 0), search to the end
    _verifier_plage(ctx, rep.get("roadmap"), errs, "roadmap", ph)
    for s in rep.get("steps") or []:
        _verifier(ctx, s, COMMERCIAL, errs, "roadmap.step", ph, mots_min=1)
        if s.get("source"):
            _verifier(ctx, s["source"], PROSPECT, errs, "roadmap.source", _avant_presentation(ctx), mots_min=1)
    return errs


def _construire_fenetre_feuille_route(ctx, unite):
    rb = _ecart(ctx).get("roadmap_blockers") or []
    s = ctx.phases.debut_presentation
    return ("HIS BLOCKERS (Gap roadmap_blockers): " + json.dumps(rb, ensure_ascii=False) +
            f"\nPITCH START: {s}. Answer about the extract only.\n\nEXTRACT (pitch start to end of call)\n" +
            _afficher_fenetre(ctx, s, None))


FEUILLE_ROUTE = TacheModele("pitch.roadmap", "strong", "pitch_roadmap", _construire_fenetre_feuille_route, _valider_feuille_route,
                    cle=lambda a: [(a.get("roadmap") or {}).get("start_turn"),
                                   sorted((s.get("turn"), bool(s.get("source"))) for s in a.get("steps") or [])])


# ---- PB-35, PB-36, PB-14: list tasks, chunked
def _bornes_bloc(ctx: ContexteAppel, id_unite: str) -> tuple[str, Optional[str]]:
    a, b = id_unite.split(":", 1)[1].split("-")
    return a, _apres(ctx, b)


def _construire_bloc(fn_entete):
    def construire(ctx, unite):
        s, e = unite
        return fn_entete(ctx) + "\n\nEXTRACT\n" + _afficher_fenetre(ctx, s, _apres(ctx, e))
    return construire


def _entete_affirmations(ctx):
    ref = {k: v for k, v in (ctx.reference_offre or {}).items() if k != "mechanisms"}
    return ("OFFER REFERENCE: " + (json.dumps(ref, ensure_ascii=False) if ref else "missing") + "\n" +
            _texte_bibliotheque(ctx))


def _valider_affirmations(rep, ctx, id_unite):
    errs: list[str] = []
    ph = _bornes_bloc(ctx, id_unite)
    for c in rep.get("claims") or []:
        if c.get("kind") not in TYPES_AFFIRMATION:
            errs.append("bad_claim_kind")
        _verifier(ctx, c, COMMERCIAL, errs, "claim", ph, mots_min=1)
    return errs


AFFIRMATIONS = TacheModele("pitch.claims", "strong", "pitch_claims", _construire_bloc(_entete_affirmations), _valider_affirmations,
                   cle=lambda a: sorted((c.get("turn"), c.get("kind"), c.get("library_id"), c.get("guarantee_ref"),
                                         bool(c.get("calculation"))) for c in a.get("claims") or []))


def _valider_promesses(rep, ctx, id_unite):
    errs: list[str] = []
    ph = _bornes_bloc(ctx, id_unite)
    for p in rep.get("promises") or []:
        if p.get("action") not in ACTIONS_PROMESSE:
            errs.append("bad_action")
        _verifier(ctx, p, COMMERCIAL, errs, "promise", ph)
    return errs


PROMESSES = TacheModele("pitch.promises", "strong", "pitch_promises", _construire_bloc(lambda c: "Find outcome promises."),
                     _valider_promesses,
                     cle=lambda a: sorted((p.get("turn"), p.get("action")) for p in a.get("promises") or []))


def _valider_adh(rep, ctx, id_unite):
    errs: list[str] = []
    ph = _bornes_bloc(ctx, id_unite)
    for p in rep.get("passages") or []:
        if p.get("kind") not in TYPES_ADHESION:
            errs.append("bad_kind")
        _verifier(ctx, p, PROSPECT, errs, "adhesion", ph)
        if p.get("gesture"):
            _verifier(ctx, p["gesture"], COMMERCIAL, errs, "gesture", None, mots_min=1)
    return errs


ADHESION = TacheModele("pitch.adhesion", "fast", "pitch_adhesion", _construire_bloc(lambda c: "Find adhesion passages."),
                     _valider_adh,
                     cle=lambda a: sorted((p.get("turn"), p.get("kind"), bool(p.get("concrete")),
                                           bool(p.get("comprehension_echo")), bool(p.get("postpone")))
                                          for p in a.get("passages") or []))


def blocs(ctx: ContexteAppel, taille: int) -> list[tuple[str, str]]:
    """Deterministic chunks of the pitch window (pitch start .. decision request inclusive)."""
    s = ctx.phases.debut_presentation
    tours = ctx.fenetre(s, _fin_fenetre(ctx))
    return [(tours[k].id, tours[min(k + taille, len(tours)) - 1].id) for k in range(0, len(tours), taille)]


# ============================================================================================ pure decisions
def presentation_avant_ecart(ctx: ContexteAppel, ecart: dict, debut_presentation: Optional[str]) -> bool:
    """PB-37 / §5.1 check 1: the Gap verdict is "present" and its validation turn comes before the pitch start.
    An offer_mention before the validation is not a pitch (it never sets pitch_start, PB-17)."""
    if debut_presentation is None:
        return False
    if ecart.get("verdict") != "present" or not ecart.get("validation_turn"):
        return True
    return not ctx.avant(ecart["validation_turn"], debut_presentation)


def reference_mecanisme_absente(reference_offre: dict, categorie: Optional[str]) -> bool:
    """§2.1 / §4: the reference must hold, for the mechanism of P, its principle and its offer phase."""
    entree = ((reference_offre or {}).get("mechanisms") or {}).get(categorie or "") or {}
    return not (entree.get("principle") and entree.get("phase"))


# ---- K1 · Step 1 (PB-28, Gap GB-22)
def decider_k1(ctx: ContexteAppel, p_valide_: Optional[dict], etape1: Optional[dict]) -> tuple[int, list, dict]:
    info: dict[str, Any] = {"span": None, "verbatim": False, "key_expression": None, "other_blockers": 0,
                            "sentences": 0}
    st = (etape1 or {}).get("step")
    if not st:
        return 0, [], dict(info, failure="missing")
    info.update(span=[st["start_turn"], st["end_turn"]], sentences=n_phrases(ctx, st))
    autres = [o for o in (etape1 or {}).get("other_blockers") or []]
    info["other_blockers"] = len(autres)
    ev = [Preuve(st["start_quote"], st["start_turn"], COMMERCIAL)]
    verbatim = False
    if p_valide_ and p_valide_.get("key_expression"):
        ke = p_valide_["key_expression"]
        ok, pourquoi = expression_cle_ok(ke, ctx.tour(p_valide_["turn"]).texte, texte_plage(ctx, st))
        verbatim = ok
        info.update(key_expression=ke, verbatim=ok, verbatim_reason=pourquoi)
        if ok:
            ev.append(Preuve(p_valide_["quote"], p_valide_["turn"], PROSPECT))
    if verbatim and not autres:
        return 2, ev, info
    if verbatim or autres:                      # with other blockers, or another blocker in its place
        return 1, ev, dict(info, failure="several_blockers" if verbatim else "other_blocker")
    return 0, ev, dict(info, failure="paraphrase")    # X9


def mecanismes_concernes(ctx: ContexteAppel, etape2: Optional[dict], pos_debut: Optional[tuple],
                        pos_fin: Optional[tuple]) -> list[dict]:
    """PB-29: mechanisms stated between step 1 and the roadmap (or the price / decision when no roadmap)."""
    sortie = []
    for m in (etape2 or {}).get("mechanisms_stated") or []:
        p = _pos(ctx, m["turn"], m["quote"])
        if pos_debut and p < pos_debut:
            continue
        if pos_fin and p >= pos_fin:
            continue
        sortie.append(dict(m, pos=p))
    return sortie


def principe_une_phrase(ctx: ContexteAppel, m: dict, mots_max: int) -> bool:
    """PB-29: the principle fits in one sentence of `max_words` words or fewer."""
    q = normaliser(m["quote"]).strip(' .,?!"')
    for s in phrases(ctx.tour(m["turn"]).texte):
        if q in normaliser(s):
            return len(s.split()) <= mots_max
    return False                                 # the quote crosses a sentence boundary


# ---- K2 · Step 2 (PB-29)
def decider_k2(ctx: ContexteAppel, categorie: Optional[str], mecas: list[dict], recitation: Optional[dict],
              niveau_k1: int, ref_absente: bool, cfg: dict) -> tuple[Optional[int], list, dict]:
    info: dict[str, Any] = {"mechanisms": sorted({m["mechanism"] for m in mecas}), "principle": False,
                            "offer_phase": False, "recitation": False}
    if categorie not in NEUF:
        return None, [], dict(info, failure="P_category_unknown")       # §5.2: K2 not applicable
    noms = {m["mechanism"] for m in mecas}
    if not noms:
        return 0, [], dict(info, failure="no_mechanism")
    if noms != {categorie}:
        echouer = "second_mechanism" if categorie in noms else "wrong_mechanism"
        mauvais = [m for m in mecas if m["mechanism"] != categorie]
        return 0, [Preuve(mauvais[0]["quote"], mauvais[0]["turn"], COMMERCIAL)], dict(info, failure=echouer)
    principes = [m for m in mecas if m["kind"] == "principle"]
    phases = [m for m in mecas if m["kind"] == "phase"]
    pr = next((m for m in principes if principe_une_phrase(ctx, m, cfg["principle_max_words"])), None)
    ph = next((m for m in phases if pr is None or m["pos"] >= pr["pos"]), None)   # "then the phase"
    items_enr = (recitation or {}).get("items") or []
    enr = bool(recitation) and len(items_enr) >= cfg["recitation_min_items"]
    info.update(principle=pr is not None, offer_phase=ph is not None, recitation=enr,
                recitation_quote=(recitation or {}).get("quote") if enr else None)
    ev = [Preuve(m["quote"], m["turn"], COMMERCIAL) for m in (pr, ph) if m] or \
        [Preuve(mecas[0]["quote"], mecas[0]["turn"], COMMERCIAL)]
    niveau = 2 if (pr and ph and not enr) else 1
    if niveau == 1:
        info["failure"] = "recitation" if enr else ("no_principle" if not pr else "no_phase")
    if niveau == 2 and niveau_k1 < 2:              # "only true for him": K2 = 2 only after a K1 at level 2
        niveau, info["failure"] = 1, "generic_step"
    if niveau == 2 and ref_absente:               # §4: checked on the category only
        niveau = min(niveau, cfg["mechanism_reference_missing_cap"])
        info["failure"] = "mechanism_reference_missing"
    return niveau, ev, info


# ---- K3 · Step 3 (PB-30)
def _valeur_dans_citation(valeur: Any, citation: str) -> bool:
    nv = normaliser_nombre(str(valeur)) if valeur is not None else None
    return nv is not None and any(float(x) == float(nv) for x in nombres_dans(citation))


def tours_vision_besoin(ctx: ContexteAppel) -> set[str]:
    """PB-30: the image is in his words if it reuses a key expression of his N answers or VALUE atoms."""
    tours = {t for s in ctx.sollicitations if s.lettre == "N" for t in s.tours_reponse}
    tours |= {a.preuve.tour for a in ctx.atomes if a.type == "VALUE"}
    return tours


def decider_k3(ctx: ContexteAppel, ecart: dict, etape3: Optional[dict]) -> tuple[int, list, dict]:
    s3 = etape3 or {}
    st, A, B = s3.get("step"), s3.get("A"), s3.get("B")
    gA, gB = ecart.get("selected_A") or {}, ecart.get("selected_B") or {}
    info: dict[str, Any] = {"span": [st["start_turn"], st["end_turn"]] if st else None,
                            "A": A and A.get("value"), "B": B and B.get("value"), "same_unit": False,
                            "his_figures": False, "deadline": None, "image_key_expression": None,
                            "sentences": n_phrases(ctx, st)}
    if not st or not A or not B:
        return 0, [], dict(info, failure="no_A_to_B")
    ev = [Preuve(A["quote"], A["turn"], COMMERCIAL)]
    if not gA or not gB:
        return 0, ev, dict(info, failure="no_selected_A_B_in_gap")
    meme_unite = normaliser_unite(A.get("unit")) == normaliser_unite(gA.get("unit")) and \
        normaliser_unite(B.get("unit")) == normaliser_unite(gB.get("unit") or gA.get("unit"))
    chiffres = nombres_egaux(A.get("value"), gA.get("value")) and nombres_egaux(B.get("value"), gB.get("value")) and \
        _valeur_dans_citation(A.get("value"), A["quote"]) and _valeur_dans_citation(B.get("value"), B["quote"])
    info.update(same_unit=meme_unite, his_figures=chiffres)
    if not meme_unite:
        return 0, ev, dict(info, failure="other_unit")                         # X11
    dl = s3.get("deadline")
    if dl:
        info["deadline"] = dl.get("quote")
        if not (s3.get("deadline_source") or gB.get("horizon")):
            return 0, ev, dict(info, failure="invented_date")                  # X11
    if not chiffres:
        return 0, ev, dict(info, failure="not_his_figures")                    # GB-24: the sales' figure
    img, src, ke = s3.get("image"), s3.get("image_source"), s3.get("image_key_expression")
    if not img:
        return 1, ev, dict(info, failure="no_image")
    ev.append(Preuve(img["quote"], img["turn"], COMMERCIAL))
    en_mots = False
    if src and ke and src["turn"] in tours_vision_besoin(ctx):
        ok, _ = expression_cle_ok(ke, ctx.tour(src["turn"]).texte, img["quote"])
        en_mots = ok and _pos(ctx, img["turn"], img["quote"]) >= _pos(ctx, B["turn"], B["quote"])
    if not en_mots:
        return 1, ev, dict(info, failure="image_not_his_words")
    info["image_key_expression"] = ke
    return 2, ev, info


# ---- K4 · Step 4 (PB-31)
def valeur_debut_correspond(cas: dict, A: dict, facteur: Optional[float]) -> Optional[bool]:
    """PB-31: same dimension (unit of A) and starting value within the factor. None = factor not configured."""
    st = cas.get("start") or {}
    if st.get("value") is None or A.get("value") is None:
        return False
    if normaliser_unite(st.get("unit")) != normaliser_unite(A.get("unit")):
        return False
    if facteur is None:
        return None
    a, b = float(st["value"]), float(A["value"])
    if a == 0 or b == 0:
        return a == b
    return max(a, b) / min(a, b) <= facteur


def decider_k4(ctx: ContexteAppel, ecart: dict, etape4: Optional[dict], cfg: dict) -> tuple[Optional[int], list, dict]:
    bib = {c.get("id"): c for c in ctx.bibliotheque_cas or []}
    info: dict[str, Any] = {"cases": [], "case_id": None, "consent": None, "start_matches_A": None,
                            "proof_gap": False}
    if not bib:
        return None, [], dict(info, failure="case_library_missing")             # §4
    A = ecart.get("selected_A") or {}
    facteur = cfg.get("case_match_factor")
    cite = []
    for c in (etape4 or {}).get("cases") or []:
        cas = bib.get(c.get("library_id"))
        vm = valeur_debut_correspond(cas, A, facteur) if cas else False
        pm = bool(cas and c.get("profile_match") and c.get("prospect_evidence") and (cas.get("start") or {}).get("profile"))
        cite.append({"turn": c["turn"], "quote": c["quote"], "library_id": c.get("library_id"),
                      "in_library": cas is not None, "consent": bool(cas and cas.get("consent")),
                      "start_matches_A": bool(vm) or pm, "step": c.get("step")})
    info["cases"] = cite
    # does the library hold a case matching his A? (§5.2 "Step 4 without a matching case")
    bib_vm = [valeur_debut_correspond(c, A, facteur) for c in bib.values() if c.get("consent")]
    if any(v is True for v in bib_vm) or any(c["start_matches_A"] and c["consent"] for c in cite):
        a_correspondance: Optional[bool] = True
    elif facteur is None:
        a_correspondance = None                          # undecidable: matching factor à confirmer
    else:
        a_correspondance = False
    info["library_has_match"] = a_correspondance
    if a_correspondance is False:
        return None, [], dict(info, proof_gap=True, failure="proof_gap")
    valide_ = [c for c in cite if c["in_library"] and c["consent"]]             # X12: not in library / no consent
    if not valide_:
        f = "no_case" if not cite else "case_not_valid"
        if a_correspondance is None:
            f += "; case_match_rule_missing"
        return 0, [], dict(info, failure=f)
    meilleur = max(valide_, key=lambda c: c["start_matches_A"])                       # several cases: best-matching
    info.update(case_id=meilleur["library_id"], consent=True, start_matches_A=meilleur["start_matches_A"])
    ev = [Preuve(meilleur["quote"], meilleur["turn"], COMMERCIAL)]
    if meilleur["start_matches_A"]:
        if A.get("quote") and A.get("turn"):
            ev.append(Preuve(A["quote"], A["turn"], PROSPECT))
        return 2, ev, info
    return 1, ev, dict(info, failure="best_case")


# ---- K5 · Order and brevity (PB-32, PB-33)
def decider_k5(ctx: ContexteAppel, pos_etape: dict[int, Optional[tuple]], phrase_etape: dict[int, int],
              non_applicable: set[int], etape_pr: dict[int, Preuve], cfg: dict) -> tuple[int, list, dict]:
    requis = [k for k in (1, 2, 3, 4) if k not in non_applicable]
    present = [k for k in requis if pos_etape.get(k)]
    ordre_ok = all(pos_etape[a] < pos_etape[b] for a, b in zip(present, present[1:]))
    brievete = {k: 1 <= phrase_etape.get(k, 0) <= cfg["step_max_sentences"] for k in present}
    info = {"present": present, "required": requis, "order_ok": ordre_ok, "sentences": phrase_etape,
            "brevity_ok": all(brievete.values())}
    ev = [etape_pr[k] for k in present if etape_pr.get(k)]
    if len(present) < len(requis) - 1:                       # fewer than three of the four steps
        return 0, ev, dict(info, failure="steps_missing")
    if len(present) == len(requis) and ordre_ok and all(brievete.values()):
        return 2, ev, info
    return 1, ev, dict(info, failure="order" if not ordre_ok else ("step_missing" if len(present) < len(requis)
                                                                   else "too_long"))


# ---- K6 · Roadmap, amount, decision (PB-34, PB-19, PB-32)
def etapes_feuille_route_trouvees(ctx: ContexteAppel, ecart: dict, etapes: list[dict]) -> list[bool]:
    """PB-34: each roadmap step matched to one of his blockers (Gap GB-32) by key expression (GB-22)."""
    tours_rb = {b.get("turn") for b in ecart.get("roadmap_blockers") or []}
    sortie = []
    for s in etapes:
        src, ke = s.get("source"), s.get("key_expression")
        ok = bool(src and ke and src["turn"] in tours_rb and
                  expression_cle_ok(ke, ctx.tour(src["turn"]).texte, s["quote"])[0])
        sortie.append(ok)
    return sortie


def decider_k6(ctx: ContexteAppel, ecart: dict, feuille_route: Optional[dict], pos_derniere_etape: Optional[tuple]
              ) -> tuple[int, list, dict]:
    ph = ctx.phases
    rm = (feuille_route or {}).get("roadmap")
    info: dict[str, Any] = {"span": [rm["start_turn"], rm["end_turn"]] if rm else None, "steps": [],
                            "before_price": None}
    if not rm:
        return 0, [], dict(info, failure="no_roadmap")
    rpos = _pos_plage(ctx, rm)
    ev = [Preuve(rm["start_quote"], rm["start_turn"], COMMERCIAL)]
    etapes = (feuille_route or {}).get("steps") or []
    apparie = etapes_feuille_route_trouvees(ctx, ecart, etapes)
    info["steps"] = [{"quote": s["quote"], "turn": s["turn"], "blocker_quote": (s.get("source") or {}).get("quote"),
                      "matched": m} for s, m in zip(etapes, apparie)]
    if ph.prix_precoce:                                         # PB-19: price before the pitch -> before the roadmap
        return 0, ev, dict(info, before_price=False, failure="price_before_roadmap")
    if ph.premier_prix and ctx.n(ph.premier_prix) <= rpos[0]:
        return 0, ev, dict(info, before_price=False, failure="price_before_roadmap")
    info["before_price"] = True if ph.premier_prix else None
    if pos_derniere_etape and rpos <= pos_derniere_etape:               # PB-34: the roadmap starts after step 4
        return 0, ev, dict(info, failure="roadmap_before_step4")
    if ph.premier_prix:
        ev.append(Preuve(ph.preuve["first_price"].citation, ph.premier_prix, COMMERCIAL)
                  if "first_price" in ph.preuve and ph.preuve["first_price"].citation else None)
    if not etapes or not all(apparie):
        return 1, ev, dict(info, failure="steps_not_his_blockers")
    if not ph.premier_prix:
        return 1, ev, dict(info, failure="no_amount")
    if ph.demande_decision and ctx.n(ph.demande_decision) < ctx.n(ph.premier_prix):
        return 1, ev, dict(info, failure="decision_before_price")
    return 2, ev, info


# ---- K7 · Adhesion (PB-14..PB-16, PB-23, PB-24)
# PB-15: plain approvals and compliments are never adhesion
_COMPLIMENT = re.compile(r"^((that|it|this) )?((all )?(sounds?|looks?|is|seems?) )?(really |so |very )?"
                         r"(okay|ok|good|great|amazing|awesome|wow|cool|nice|perfect|interesting|i love (that|it))"
                         r"[\s.,!]*((wow|amazing|great|cool)[\s.,!]*)*$")


def approbation_simple(texte: str) -> bool:
    t = normaliser(texte).strip()
    return approbation_seule(t) or bool(_COMPLIMENT.match(t))


def passages_adhesion(ctx: ContexteAppel, passages: list[dict]) -> tuple[list[dict], list[dict]]:
    """Returns (adhesion passages, reserves). Approvals (PB-15, C3 rule 5), comprehension echoes (PB-23) and
    projections used to postpone (PB-24, routed to Objections) are not adhesion."""
    garder, reserves, vus = [], [], set()
    for p in passages:
        if p.get("kind") not in TYPES_ADHESION or approbation_simple(p["quote"]):
            continue
        if p.get("postpone"):
            reserves.append(p)
            continue
        if p.get("comprehension_echo"):
            continue
        if p.get("kind") == "projection" and not p.get("concrete"):
            continue                                            # PB-14: projection needs a concrete element
        k = (p["turn"], normaliser(p["quote"]))
        if k in vus:
            continue
        vus.add(k)
        garder.append(p)
    return garder, reserves


def decider_k7(passages: list[dict]) -> tuple[int, list, dict]:
    info = {"n": len(passages), "projection": any(p.get("kind") == "projection" and p.get("concrete")
                                                  for p in passages)}
    if not passages:
        return 0, [], dict(info, failure="no_adhesion")
    ev = [Preuve(p["quote"], p["turn"], PROSPECT) for p in passages]
    if len({p["turn"] for p in passages}) >= 2:
        return 2, ev, info
    if info["projection"]:
        g = passages[0].get("gesture")                          # second quote for C3 rule 4: the gesture (PB-16)
        if g:
            ev.append(Preuve(g["quote"], g["turn"], COMMERCIAL))
        return 2, ev, info
    return 1, ev, info


# ---- §5.1 claims lookup (PB-35)
def _nombres_de(obj: Any) -> set[str]:
    sortie: set[str] = set()
    if isinstance(obj, dict):
        for v in obj.values():
            sortie |= _nombres_de(v)
    elif isinstance(obj, (list, tuple)):
        for v in obj:
            sortie |= _nombres_de(v)
    elif isinstance(obj, (int, float)) and not isinstance(obj, bool):
        n = normaliser_nombre(str(obj))
        if n:
            sortie.add(n)
    elif isinstance(obj, str):
        sortie |= set(nombres_dans(obj))
    return sortie


def sources_affirmation(ctx: ContexteAppel) -> dict[str, set[str]]:
    ref = ctx.reference_offre or {}
    prospect = set()
    for t in ctx.tours:
        if t.role == PROSPECT and not t.attribution_douteuse:
            prospect |= set(nombres_dans(t.texte))
    for p in ctx.entrees_anterieures or []:                            # PB-20: inputs stored before the call
        prospect |= set(nombres_dans(p.get("text", "")))
    offre_ = _nombres_de({k: ref.get(k) for k in ("price", "payment_options", "guarantees", "components")})
    prix = _nombres_de({k: ref.get(k) for k in ("price", "payment_options")})
    bibliotheque = _nombres_de([{"start": c.get("start"), "figures": c.get("figures")} for c in ctx.bibliotheque_cas or []])
    return {"prospect": prospect, "offer_reference": offre_, "price": prix, "case_library": bibliotheque}


def _est_calcul(x: float, connu: list[float]) -> bool:
    for r in (2, 3):
        for combo in itertools.combinations(connu, r):
            prod = 1.0
            for v in combo:
                prod *= v
            if abs(prod - x) < 1e-6 or abs(sum(combo) - x) < 1e-6:
                return True
    return False


def verifier_affirmation(ctx: ContexteAppel, affirmation: dict, src: dict[str, set[str]]) -> str:
    """Returns the source label (prospect / offer_reference / case_library / calculation), "out_of_gap" or
    "unchecked" when the reference that could contain it is missing (§4, Part C C1 reduced checks)."""
    ref = ctx.reference_offre or {}
    genre = affirmation.get("kind")
    if genre == "case":
        if not ctx.bibliotheque_cas:
            return "unchecked"
        ids = {c.get("id") for c in ctx.bibliotheque_cas}
        return "case_library" if affirmation.get("library_id") in ids else "out_of_gap"
    if genre == "guarantee":
        gs = ref.get("guarantees")
        if not gs:
            return "unchecked"
        noms = {normaliser(g if isinstance(g, str) else (g.get("name") or g.get("id") or "")) for g in gs}
        return "offer_reference" if normaliser(affirmation.get("guarantee_ref") or "") in noms - {""} else "out_of_gap"
    nbs = nombres_dans(affirmation["quote"])
    if genre == "price":
        if not src["price"]:
            return "unchecked"
        return "offer_reference" if nbs and all(n in src["price"] for n in nbs) else "out_of_gap"
    # figure
    if not nbs:
        return "unchecked"
    for libelle in ("prospect", "offer_reference", "case_library"):
        if all(n in src[libelle] for n in nbs):
            return libelle
    permis = src["prospect"] | src["offer_reference"] | src["case_library"]
    if all(n in permis for n in nbs):
        return "prospect+reference"
    if affirmation.get("calculation"):
        # "a calculation on those figures shown as such": at least one operand is his / the offer's figure and
        # every other unknown number is either an operand or the result of the operands in the same quote
        vals = [float(n) for n in nbs]
        connu = [float(n) for n in nbs if n in permis]
        resultats = [v for i, v in enumerate(vals) if nbs[i] not in permis and
                   _est_calcul(v, vals[:i] + vals[i + 1:])]
        if connu and resultats:
            return "calculation"
    if not ref and not ctx.bibliotheque_cas:
        return "unchecked"
    return "out_of_gap"


def porte(ctx: ContexteAppel, ecart: dict, affirmations: list[dict], promesses: list[dict], etape4: Optional[dict]
         ) -> tuple[list[str], list[dict], list[str]]:
    """§5.1 compliance gate, in its fixed order. Returns (reasons, checked claims, flags)."""
    raisons, signaux = [], []
    if presentation_avant_ecart(ctx, ecart, ctx.phases.debut_presentation):                     # PB-37
        raisons.append("pitch_before_gap")
    src = sources_affirmation(ctx)
    verifie = []
    for c in affirmations:
        s = verifier_affirmation(ctx, c, src)
        verifie.append({"kind": c.get("kind"), "quote": c["quote"], "turn": c["turn"], "source": s})
        if s == "unchecked":
            signaux.append(f"claim_unchecked:{c['turn']}")
    if ctx.bibliotheque_cas:                                                       # PB-31: case not in library
        ids = {x.get("id") for x in ctx.bibliotheque_cas}
        for c in (etape4 or {}).get("cases") or []:
            if c.get("library_id") not in ids and not any(x["turn"] == c["turn"] and x["kind"] == "case"
                                                          for x in verifie):
                verifie.append({"kind": "case", "quote": c["quote"], "turn": c["turn"], "source": "out_of_gap"})
    if any(c["source"] == "out_of_gap" for c in verifie):                      # PB-35
        raisons.append("out_of_gap_claim")
    if any(p.get("action") in ACTIONS_PROMESSE for p in promesses):              # PB-36
        raisons.append("outcome_promise")
    return raisons, verifie, signaux


# ============================================================================================ decision
def decider(ctx: ContexteAppel, reponses: dict[str, Any], cfg: Optional[dict] = None,
           statuts_: Optional[dict[str, str]] = None) -> ResultatCompetence:
    """Pure decision of the Pitch competence from validated answers. `answers` keys: category, step1, step2,
    step3, step4, roadmap (dicts or None), claims, promises, adhesion (lists)."""
    cfg = {**CONFIG_DEFAUT, **(cfg or {})}
    statuts_ = statuts_ or {}
    res = ResultatCompetence(NOM, VERSION_REGLES)
    ph = ctx.phases
    if not ph.debut_presentation:                                                     # §4
        res.statut = "not_applicable"
        res.raisons = ["offer_mention_only" if ph.mentions_offre else "no_pitch"]
        res.details = {"roadmap_span": None, "offer_mentions": list(ph.mentions_offre)}
        return res
    ecart = _ecart(ctx)
    vp = ecart.get("validated_P")
    if not ctx.reference_offre:
        res.signaux.append("offer_reference_missing")

    # P category (PB-27)
    rep_cat = reponses.get("category") or {}
    categorie = rep_cat.get("category") if vp else None
    if categorie == INCONNU:
        res.signaux += ["P_category_unknown", "uncovered_case"]
    elif categorie == PAS_BLOCAGE:
        res.signaux.append("P_not_a_pitch_blocker")
    ref_absente = categorie in NEUF and reference_mecanisme_absente(ctx.reference_offre, categorie)
    if ref_absente:
        res.signaux.append("mechanism_reference_missing")
    if not ctx.bibliotheque_cas:
        res.signaux.append("case_library_missing")

    # roadmap position first (bounds step 2 mechanisms)
    rm = (reponses.get("roadmap") or {}).get("roadmap")
    rpos = _pos_plage(ctx, rm)

    # K1
    k1, ev1, i1 = decider_k1(ctx, vp, reponses.get("step1"))
    s1 = (reponses.get("step1") or {}).get("step")
    s1pos = _pos_plage(ctx, s1)
    # K2
    s2 = (reponses.get("step2") or {}).get("step")
    pos_fin = rpos or (_pos(ctx, ph.premier_prix) if ph.premier_prix else None) or \
        (_pos(ctx, ph.demande_decision) if ph.demande_decision else None)
    mecas = mecanismes_concernes(ctx, reponses.get("step2"), s1pos or _pos(ctx, ph.debut_presentation), pos_fin)
    k2, ev2, i2 = decider_k2(ctx, categorie, mecas, (reponses.get("step2") or {}).get("recitation"), k1,
                            ref_absente, cfg)
    i2.update(span=[s2["start_turn"], s2["end_turn"]] if s2 else None, sentences=n_phrases(ctx, s2))
    # K3
    k3, ev3, i3 = decider_k3(ctx, ecart, reponses.get("step3"))
    s3 = (reponses.get("step3") or {}).get("step")
    # K4
    k4, ev4, i4 = decider_k4(ctx, ecart, reponses.get("step4"), cfg)
    meilleur = next((c for c in i4.get("cases", []) if c["library_id"] == i4.get("case_id")), None)
    s4 = (meilleur or {}).get("step") or next((c.get("step") for c in (reponses.get("step4") or {}).get("cases") or []
                                           if c.get("step")), None)
    i4.update(span=[s4["start_turn"], s4["end_turn"]] if s4 else None, sentences=n_phrases(ctx, s4))
    if i4.get("proof_gap"):
        res.signaux.append("proof_gap")
    # K5
    plages = {1: s1, 2: s2, 3: s3, 4: s4}
    pos_etape = {k: _pos_plage(ctx, v) for k, v in plages.items()}
    phrase_etape = {k: n_phrases(ctx, v) for k, v in plages.items() if v}
    etape_pr = {k: Preuve(v["start_quote"], v["start_turn"], COMMERCIAL) for k, v in plages.items() if v}
    na = {k for k, lv in ((2, k2), (4, k4)) if lv is None}
    k5, ev5, i5 = decider_k5(ctx, pos_etape, phrase_etape, na, etape_pr, cfg)
    # K6
    dernier = max([p for p in pos_etape.values() if p], default=None)
    k6, ev6, i6 = decider_k6(ctx, ecart, reponses.get("roadmap"), dernier)
    # K7
    adh, reserves = passages_adhesion(ctx, reponses.get("adhesion") or [])
    k7, ev7, i7 = decider_k7(adh)

    remarques = {k: (i.get("failure") or "") for k, i in
             (("K1", i1), ("K2", i2), ("K3", i3), ("K4", i4), ("K5", i5), ("K6", i6), ("K7", i7))}
    niveaux = {"K1": (k1, ev1), "K2": (k2, ev2), "K3": (k3, ev3), "K4": (k4, ev4), "K5": (k5, ev5),
              "K6": (k6, ev6), "K7": (k7, ev7)}
    res.items = [item(k, POIDS[k], lv, ev, remarques[k]) for k, (lv, ev) in niveaux.items()]

    # §5.1 gate
    raisons, verifie, gsignaux = porte(ctx, ecart, reponses.get("claims") or [], reponses.get("promises") or [],
                                    reponses.get("step4"))
    res.signaux += gsignaux
    brut = note_appel(res.items)
    if raisons:
        res.verdict = "non_compliant"
        res.raisons = raisons
        res.note = 0 if cfg["severity"] == "zero" else (min(brut, 40) if brut is not None else None)
    else:
        res.verdict = "compliant"
        res.note = brut

    a_revoir = sorted(k for k, s in statuts_.items() if s == "to_review")
    if a_revoir:
        res.statut = "to_review"
        res.raisons = res.raisons + [f"to_review:{k}" for k in a_revoir]
        res.note = None
    concs = [s for s in statuts_.values()]
    res.concordance = "arbitrated" if "arbitrated" in concs else ("3/3" if concs else None)

    # diagnostics (§7, never scored)
    s_, e_ = ph.debut_presentation, ph.fin_presentation
    fen = ctx.fenetre(s_, e_)
    p_s = sum(len(t.texte.split()) for t in fen if t.role == COMMERCIAL)
    p_t = sum(len(t.texte.split()) for t in fen) or 1
    part = round(p_s / p_t, 3)
    diagnostics = {
        "non_compliance": raisons,
        "P_category": categorie,
        "mechanism_error": i2.get("failure") if i2.get("failure") in ("second_mechanism", "wrong_mechanism",
                                                                      "recitation") else None,
        "step_failures": {f"step{k}": i.get("failure") for k, i in ((1, i1), (2, i2), (3, i3), (4, i4))
                          if i.get("failure")},
        "proof_gap": bool(i4.get("proof_gap")),
        "roadmap": {"n_steps": len(i6.get("steps") or []), "before_price": i6.get("before_price")},
        "talk_share": part, "monologue": part > cfg["monologue_share"],
        "gestures_before_adhesion": [p.get("gesture") for p in adh if p.get("gesture")],
        "reserves": [{"quote": p["quote"], "turn": p["turn"]} for p in reserves],
    }
    res.details = {
        "verdict": res.verdict,
        "non_compliance": raisons,
        "phases": {"pitch_start": ph.debut_presentation, "roadmap": i6.get("span"), "first_price": ph.premier_prix,
                   "decision_request": ph.demande_decision, "early_price": ph.prix_precoce},
        "roadmap_span": i6.get("span"),                       # read by Objections
        "validated_P": dict(vp, category=categorie) if vp else None,
        "steps": {"1": i1, "2": i2, "3": i3, "4": i4},
        "order_ok": i5.get("order_ok"),
        "roadmap": {"steps": i6.get("steps"), "before_price": i6.get("before_price")},
        "claims": verifie,
        "outcome_promises": [{"quote": p["quote"], "turn": p["turn"], "action": p["action"]}
                             for p in reponses.get("promises") or []],
        "adhesion": [{"turn": p["turn"], "quote": p["quote"], "kind": p["kind"],
                      "sales_gesture": (p.get("gesture") or {}).get("quote"),
                      "projection": bool(p.get("kind") == "projection" and p.get("concrete"))} for p in adh],
        "raw_score": brut,
        "diagnostics": diagnostics,
    }
    return res


# ============================================================================================ competence
class CompetencePresentation:
    nom_ = NOM
    version_regles = VERSION_REGLES

    def __init__(self, config: Optional[dict] = None):
        self.cfg = {**CONFIG_DEFAUT, **(config or {})}

    def executer(self, ctx: ContexteAppel, executeur: Executeur) -> ResultatCompetence:
        ph = ctx.phases
        if not ph.debut_presentation:
            return decider(ctx, {}, self.cfg)
        g = ctx.resultats.get("GAP")
        if g is None or not g.details:
            return ResultatCompetence(NOM, VERSION_REGLES, statut="to_review", raisons=["gap_result_missing"],
                                    details={"roadmap_span": None})
        if g.statut == "to_review":
            return ResultatCompetence(NOM, VERSION_REGLES, statut="to_review", raisons=["gap_to_review"],
                                    details={"roadmap_span": None})
        reponses: dict[str, Any] = {}
        statuts_: dict[str, str] = {}

        def un(cle, tache, id_unite, unite):
            r = executeur.executer(ctx, tache, id_unite, unite)
            statuts_[cle] = r.statut
            reponses[cle] = r.reponse
            return r

        vp = g.details.get("validated_P")
        if vp and vp.get("turn"):
            r = un("category", CATEGORIE, f"pcat:{vp['turn']}", vp)
            # Pitch §2.1: a P outside the nine goes to the arbiter as uncovered_case, even when 3/3 agree
            if r.statut == "verified" and (r.reponse or {}).get("category") == INCONNU:
                from ..noyau.executeur import forcer_arbitrage
                r2 = forcer_arbitrage(executeur, ctx, CATEGORIE, f"pcat:{vp['turn']}", vp, r)
                if r2.reponse:
                    reponses["category"], statuts_["category"] = r2.reponse, r2.statut
        cat = (reponses.get("category") or {}).get("category")
        s = ph.debut_presentation
        un("step1", ETAPE1, f"step1:{s}", None)
        un("step2", ETAPE2, f"step2:{s}", cat)
        un("step3", ETAPE3, f"step3:{s}", None)
        un("step4", ETAPE4, f"step4:{s}", None)
        un("roadmap", FEUILLE_ROUTE, f"roadmap:{s}", None)
        for cle, tache, champ in (("claims", AFFIRMATIONS, "claims"), ("promises", PROMESSES, "promises"),
                                 ("adhesion", ADHESION, "passages")):
            items: list = []
            for a, b in blocs(ctx, self.cfg["chunk_turns"]):
                uid = f"{cle}:{a}-{b}"
                r = executeur.executer(ctx, tache, uid, (a, b))
                statuts_[uid] = r.statut
                items += (r.reponse or {}).get(champ) or []
            reponses[cle] = items
        return decider(ctx, reponses, self.cfg, statuts_)
