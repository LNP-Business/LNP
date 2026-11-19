"""S1 → résultat SPIN (SPIN-1.3) et la base de faits commune (sollicitations, atomes) lue par l'écart.

Le modèle liste les questions de découverte avec leur lettre, leur registre et les atomes des réponses. Le code :
- vérifie chaque citation (C3) : une question est un extrait exact d'un tour SALES avant le premier début de
  présentation ou le premier prix (SB-1, SB-34), un atome un extrait exact d'un tour PROSPECT de la réponse à cette
  question, une citation de registre là où SB-32 la veut ; tout le reste est écarté et compté ;
- applique les règles dures du §3 (une queue de validation finale, une question de valeur fermée : OUT agreement) ;
- place le périmètre (SB-1, SB-2), calcule les plages de réponse (SB-5 à SB-8), les approfondissements (SB-17, SB-19),
  les chaînes (SB-16 à SB-20), les décisions sur les atomes (SB-9 à SB-24) et les items D1 à D5, avec les fonctions du
  moteur de référence (lnp_analyse.competences.spin).
Les tournures reconnues par ces règles dures (queues de validation `QUEUES`, `QUEUE_SEULE`) sont celles du moteur de
référence : ce fichier n'a pas de liste de mots à lui.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Optional

from lnp_analyse.competences import spin as E
from lnp_analyse.noyau.modeles import (Atome, ContexteAppel, ResultatCompetence, Preuve, PROSPECT, COMMERCIAL, Sollicitation,
                                        Tour)
from lnp_analyse.noyau.notation import note_appel
from lnp_analyse.noyau.texte import normaliser, citation_ok

from .adaptateur import Rejets

ETAPE = "S1"
UNIQUE = "single_reading"       # une seule lecture du modèle (allégé) : jamais "verified" 3/3
PORTE_DE = {"S": 2, "N": 3, "I": 4, "P": 5}


@dataclass
class UniteAllegee:
    """Ce que les fonctions SPIN du moteur lisent d'une unité (plages_reponse, construire_atomes, lien_lexical,
    _valider_registre, diagnostics, applicabilite)."""
    sol: Sollicitation
    tour: Tour
    rang: int
    citation: str
    brut: dict
    preambule: str = ""
    prospect_prec: list = field(default_factory=list)
    decision: Optional[E.DecisionLettre] = None
    fin_fenetre: Optional[str] = None
    dans_perimetre: bool = False
    reouverture: Optional[int] = None
    portes_: Optional[dict] = None
    tours_spontanes: list = field(default_factory=list)
    texte_reponse: str = ""
    suit_prec: bool = False
    sans_reponse: bool = False
    attrs: dict = field(default_factory=dict)


def phrase_de(texte: str, citation: str) -> tuple[str, str]:
    """La phrase du tour du commercial qui contient la question citée (SEG-1, une queue isolée rattachée, SEG-4) et le
    préambule qui la précède dans le même tour (SEG-5)."""
    fusionne: list[str] = []
    for s in E.couper_phrases(texte):
        if E.QUEUE_SEULE.match(s) and fusionne:
            fusionne[-1] = fusionne[-1].rstrip(".!") + ", " + s
        else:
            fusionne.append(s)
    q = normaliser(citation).strip(' .,?!"')
    for k, s in enumerate(fusionne):
        if q and q in normaliser(s):
            return s, " ".join(fusionne[:k])[-500:]
    fin = normaliser(texte).find(q) + len(q)
    acc = 0
    for k, s in enumerate(fusionne):
        acc += len(normaliser(s)) + 1
        if acc >= fin:
            return s, " ".join(fusionne[:k])[-500:]
    return citation, ""


def decider_lettre(q: dict, phrase: str) -> E.DecisionLettre:
    """La lettre du modèle, puis les règles dures du §3 que le code impose par-dessus."""
    lettre, etiquettes = q["letter"], []
    raison = (q.get("out_reason") if q.get("out_reason") in E.PRIORITE_HORS else "absent") if lettre == E.OUT else None
    force = []
    if q.get("closed_need_payoff"):
        force.append("agreement")                                   # contenu fourni par le commercial
        etiquettes.append("closed_need_payoff")
    if any(re.search(p, phrase.strip().lower()) for p in E.QUEUES):  # SEG-4 queue de validation -> OUT agreement
        force.append("agreement")
        etiquettes.append("validation_tail")
    if force:
        cands = force + ([raison] if lettre == E.OUT and raison in E.PRIORITE_HORS else [])
        return E.DecisionLettre(E.OUT, 1, min(cands, key=E.PRIORITE_HORS.index), sorted(set(etiquettes)))
    return E.DecisionLettre(lettre, PORTE_DE.get(lettre, 1), raison, etiquettes)


def construire_unites(ctx: ContexteAppel, questions: list, rejets: Rejets) -> list[UniteAllegee]:
    fin = ctx.phases.fin_decouverte
    vus, garde = set(), []
    for q in questions:
        if not isinstance(q, dict):
            rejets.ajouter(ETAPE, "question:not_an_object")
            continue
        tid, citation = q.get("turn") or "", q.get("quote") or ""
        e = citation_ok(ctx, Preuve(citation, tid, COMMERCIAL), mots_min=1, mots_max=40)
        if e:
            rejets.ajouter(ETAPE, f"question:{e}", q)
            continue
        if fin and ctx.n(tid) >= ctx.n(fin):                    # SB-34 : rien après le début de la présentation ou le prix
            rejets.ajouter(ETAPE, "question:after_pitch", q)
            continue
        if q.get("letter") not in E.LETTRES + (E.OUT,):
            rejets.ajouter(ETAPE, "question:bad_letter", q)
            continue
        cle = (tid, normaliser(citation).strip(' .,?!"'))
        if cle in vus:                                          # listée deux fois (blocs qui se chevauchent)
            continue
        vus.add(cle)
        garde.append(q)
    garde.sort(key=lambda q: (ctx.n(q["turn"]), normaliser(ctx.tour(q["turn"]).texte).find(normaliser(q["quote"]).strip(' .,?!"'))))
    unites: list[UniteAllegee] = []
    rang: dict[str, int] = {}
    tours = [t for t in ctx.tours if not t.attribution_douteuse]
    for q in garde:
        t = ctx.tour(q["turn"])
        rang[t.id] = rang.get(t.id, 0) + 1
        phrase, preambule = phrase_de(t.texte, q["quote"])
        d = decider_lettre(q, phrase)
        sol = Sollicitation(f"Q{t.id[1:]}.{rang[t.id]}", t.id, phrase, etiquettes=list(d.etiquettes))
        i = tours.index(t)
        prec = [x for x in tours[:i] if x.role == PROSPECT][-2:]
        u = UniteAllegee(sol, t, rang[t.id], q["quote"], q, preambule=preambule, prospect_prec=prec, decision=d,
                  fin_fenetre=fin)
        sol.lettre, sol.raison_hors, sol.statut = d.lettre, d.raison, UNIQUE
        unites.append(u)
    return unites


def placer_perimetre(ctx: ContexteAppel, unites: list[UniteAllegee]) -> dict:
    """SB-1, SB-2 : la première sollicitation sur la situation, les objectifs ou les problèmes du prospect l'ouvre (pas
    un échange social, de logistique ou de cadrage : OUT `nothing`, questions sur l'offre, charges) ; le premier début
    de présentation ou le premier prix le ferme (SB-34)."""
    debut = None
    for u in unites:
        if debut is None and E.est_debut_valide(u.decision):
            debut = u
        if debut is not None:
            u.dans_perimetre = True
        else:
            u.sol.etiquettes.append("pre_perimeter")
            u.sol.etiquettes.append("not_coded")
            u.sol.lettre = u.sol.raison_hors = None
    ctx.phases.debut_decouverte = debut.tour.id if debut else None
    return {"start": ctx.phases.debut_decouverte, "end": ctx.phases.fin_decouverte, "reopenings": []}


def _rattacher_atomes(ctx: ContexteAppel, codees: list[UniteAllegee], rejets: Rejets) -> dict[str, list[dict]]:
    """Chaque atome va à la question dont la plage de réponse (SB-5 à SB-8, code) contient son tour."""
    proprietaire: dict[str, UniteAllegee] = {}
    for u in codees:
        for t in list(u.sol.tours_reponse) + list(u.tours_spontanes):
            proprietaire[t] = u
    sortie: dict[str, list[dict]] = {}
    vus = set()
    for u0 in codees:
        for x in u0.brut.get("atoms") or []:
            if not isinstance(x, dict):
                rejets.ajouter(ETAPE, "atom:not_an_object")
                continue
            k = (x.get("turn"), normaliser(x.get("quote") or ""), x.get("type"))
            if k in vus:
                continue
            vus.add(k)
            u = proprietaire.get(x.get("turn") or "")
            if u is None:
                rejets.ajouter(ETAPE, "atom:outside_answers", x)
                continue
            errs = E._valider_atomes({"atoms": [x]}, ctx, u)
            if errs:
                rejets.ajouter(ETAPE, "atom:" + errs[0].split(":")[0], x)
                continue
            sortie.setdefault(u.sol.id, []).append(x)
    return sortie


def _registre(ctx: ContexteAppel, u: UniteAllegee, rejets: Rejets) -> dict:
    q = u.brut
    a = {"asked_domain": q.get("register_domain"), "basis": q.get("register_basis"),
         "quote": q.get("register_quote"), "reference_turn": q.get("register_turn")}
    if a["asked_domain"] is None and a["basis"] is None:
        rejets.ajouter(ETAPE, "register:missing", q)
        errs = ["missing"]
    else:
        errs = E._valider_registre(a, ctx, u)                   # SB-32 règles 1 à 3
        if errs:
            rejets.ajouter(ETAPE, "register:" + errs[0].split(":")[0], q)
    ok = not errs
    return {"register": E.decider_registre(a) if ok else None, "status": UNIQUE if ok else "to_review",
            "concordance": "1/1" if ok else "0/1", "domain": a["asked_domain"] if ok else None,
            "basis": a["basis"] if ok else None, "quote": a["quote"] if ok else None,
            "reference_turn": a["reference_turn"] if ok else None}


def resume_registres(decide: dict[str, dict]) -> dict:
    """Comptes SB-33. Une seule lecture : l'accord 3/3 du moteur n'est pas mesuré (agreement null, pas de signal)."""
    n = len(decide)
    return {"counts": {r: sum(1 for d in decide.values() if d["register"] == r) for r in E.REGISTRES},
            "questions": n, "verified": None, "to_review": sum(1 for d in decide.values() if d["status"] == "to_review"),
            "agreement": None, "threshold": E.ACCORD_MIN_REGISTRE, "flags": [], "single_reading": True,
            "labels": E.LIBELLES_REGISTRE}


@dataclass
class FaitsSpin:
    """Lu par l'étape de l'écart : les questions sur ce qui arrête le prospect (GB-30) et la nature de chaque chiffre
    (GB-28, X13)."""
    blocage: dict[str, str] = field(default_factory=dict)       # id de la sollicitation -> citation exacte de la question
    type_chiffre: dict[str, Optional[str]] = field(default_factory=dict)   # id de l'atome -> present / loss / past / other


def executer_spin(ctx: ContexteAppel, questions: list, rejets: Rejets) -> tuple[ResultatCompetence, FaitsSpin]:
    res = ResultatCompetence("SPIN", "SPIN-1.3")
    faits = FaitsSpin()
    unites = construire_unites(ctx, questions, rejets)
    perimetre = placer_perimetre(ctx, unites)
    codees = [u for u in unites if u.dans_perimetre and E.est_lettre_codee(u.decision.lettre)]
    E.plages_reponse(ctx, codees, {u.tour.id for u in unites})

    # la réponse du prospect telle que le modèle la cite : gardée seulement dans la plage de réponse du code
    reponse_q: dict[str, dict] = {}
    for u in codees:
        a = u.brut.get("answer")
        if isinstance(a, dict) and a.get("turn"):
            plage = set(u.sol.tours_reponse) | set(u.tours_spontanes)
            if a["turn"] in plage and not citation_ok(ctx, Preuve(a.get("quote") or "", a["turn"], PROSPECT),
                                                  mots_min=1, mots_max=40):
                reponse_q[u.sol.id] = {"turn": a["turn"], "quote": a["quote"]}
            else:
                rejets.ajouter(ETAPE, "answer:outside_span_or_bad_quote", a)

    # atomes (règles de décision du code sur les atomes du modèle, SB-9..SB-15, SB-22..SB-24)
    brut_par_sol = _rattacher_atomes(ctx, codees, rejets)
    atomes: list[Atome] = []
    meta: dict[str, dict] = {}
    journal_atomes: list[dict] = []
    for u in codees:
        bruts = brut_par_sol.get(u.sol.id) or []
        if not bruts:
            continue
        nouveau, journal = E.construire_atomes(ctx, u, bruts, len(atomes), meta)
        for a in nouveau:
            brut = next((x for x in bruts if x.get("turn") == a.preuve.tour and x.get("quote") == a.preuve.citation), {})
            faits.type_chiffre[a.id] = brut.get("figure_kind")
        atomes += nouveau
        journal_atomes += journal
    ctx.atomes = atomes

    # approfondissements (SB-17, SB-19) entre sollicitations codées, répondues et consécutives
    repondu = [u for u in codees if not u.sans_reponse]
    for prec, suiv in zip(repondu, repondu[1:]):
        suiv.suit_prec = E.approfondit(prec.texte_reponse, suiv.sol.texte, suiv.preambule)
        prec.sol.approfondi = suiv.suit_prec

    # chaînes (SB-16 à SB-20) : même objet = les objets donnés par le modèle concordent, et la vérification lexicale du code
    par_id = {u.sol.id: u for u in codees}
    etapes = [E.MaillonChaine(u.sol.id, u.decision.lettre, u.decision.raison,
                         [a for a in atomes if a.id_sollicitation == u.sol.id and not a.suggere_par_commercial
                          and not a.spontane], u.suit_prec, u.sans_reponse) for u in codees]

    def objets(st: E.MaillonChaine) -> set[str]:
        return {normaliser(x) for x in [par_id[st.id_sol].brut.get("object")] + [a.objet for a in st.atomes] if x}

    def meme_objet(op: E.MaillonChaine, chaine: list, cand: E.MaillonChaine) -> bool:
        modele = bool(set().union(*[objets(s) for s in chaine]) & objets(cand))
        return modele and E.lien_lexical([par_id[s.id_sol] for s in chaine], chaine, par_id[cand.id_sol], cand)

    chaines = E.trouver_chaines(etapes, meme_objet)

    # registres (SB-26 à SB-35) : les questions S, P, I, N codées de la découverte
    decide = {u.sol.id: _registre(ctx, u, rejets) for u in codees if u.decision.lettre in E.LETTRES}
    for u in codees:
        if u.brut.get("stopping_question") and u.decision.lettre == "P":
            faits.blocage[u.sol.id] = u.citation

    ctx.sollicitations = [u.sol for u in unites]
    statut, raisons, sante = E.applicabilite(unites, ctx.phases.debut_decouverte)
    res.statut, res.raisons = statut, raisons
    diag = E.diagnostics(unites, atomes)
    res.signaux += [f"budget_{L}" for L, b in diag["call_budget"].items() if not b["ok"]]
    if any(d["status"] == "to_review" for d in decide.values()):
        res.signaux.append("registers_to_review")
    items, _ = E.noter_items(atomes, chaines, meta)
    if statut == "scored":
        res.items = items
        res.note = note_appel(items)
    res.concordance = UNIQUE
    res.details = {
        "perimeter": perimetre,
        "items_evidence": E.CompetenceSpin._details_preuves(ctx, items, atomes) if statut == "scored" else {},
        "chains": [{k: v for k, v in c.items() if k != "evidence"} for c in chaines],
        "diagnostics": diag,
        "health": sante,
        "unit_status": {UNIQUE: len(codees)},
        "atom_decisions": journal_atomes,
        "solicitations": [{"id": u.sol.id, "turn": u.tour.id, "ts": u.tour.ts, "letter": u.sol.lettre,
                           "gate_letter": u.decision.lettre, "out_reason": u.sol.raison_hors, "gate": u.decision.porte,
                           "tags": u.sol.etiquettes, "in_perimeter": u.dans_perimetre, "status": u.sol.statut,
                           "answer_turns": u.sol.tours_reponse, "followed_up": u.sol.approfondi,
                           "quote": u.citation, "answer": reponse_q.get(u.sol.id),
                           "register": (decide.get(u.sol.id) or {}).get("register"),
                           "register_status": (decide.get(u.sol.id) or {}).get("status"),
                           "register_basis": (decide.get(u.sol.id) or {}).get("basis"),
                           "register_domain": (decide.get(u.sol.id) or {}).get("domain"),
                           "register_quote": (decide.get(u.sol.id) or {}).get("quote"),
                           "register_reference_turn": (decide.get(u.sol.id) or {}).get("reference_turn")}
                          for u in unites],
        "registers": resume_registres(decide),
    }
    return res, faits
