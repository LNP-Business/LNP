"""S4 → Objections result (OBJ-1.1, lite reading): unique objections raised after the first price, A · I · E · M.

Romain (2026-11-03): only the resistances raised after the first price count (OB-27; before: after the pitch start), and each objection appears once, with all
its quotes. The code:
- checks every quote (a PROSPECT or co-decider turn, exact passage, after the first price) and drops the others;
- derives the nature from the subjects of the doubt with the boundary tests of OB-3 (`nature_of_subjects`, OB-24);
- merges objections of the same nature and theme, or that share a quote, into one (with all their quotes);
- bounds one episode per objection: response = sales turns from the first passage to the topic change (the model's,
  checked: a SALES turn before the next objection), reaction = prospect turns after the first response; a quote of
  the same objection inside the reaction is a repetition (persisting), one after the episode is a recurrence (H5 = 0);
- judges A · I · E · M, resolution, latency and prevention with the reference engine's functions (acknowledged,
  isolation_valid, exploration, h1_level, h3_level, resolution_level, is_latent, episode_items, prevention_items).
"""
from __future__ import annotations

from typing import Any, Optional

from lnp_analyse.competences import objections as O
from lnp_analyse.noyau.modeles import ContexteAppel, ResultatCompetence, Preuve, NoteItem, COMMERCIAL
from lnp_analyse.noyau.notation import note_appel
from lnp_analyse.noyau.texte import normaliser, phrases

from .adaptateur import Rejets

ETAPE = "S4"


def _citations_valides(ctx: ContexteAppel, o: dict, rejets: Rejets) -> list[dict]:
    fp = ctx.phases.premier_prix
    sortie = []
    for q in o.get("quotes") or []:
        if not isinstance(q, dict):
            rejets.ajouter(ETAPE, "quote:not_an_object")
            continue
        e = O._cote_prospect_ok(ctx, Preuve(q.get("quote") or "", q.get("turn") or ""))
        if e:
            rejets.ajouter(ETAPE, f"quote:{e}", q)
            continue
        if not fp or ctx.n(q["turn"]) <= ctx.n(fp):
            rejets.ajouter(ETAPE, "quote:before_price", q)            # OB-27, Romain 2026-11-03: after the first price only
            continue
        sortie.append({"turn": q["turn"], "quote": q["quote"]})
    return sorted(sortie, key=lambda q: (ctx.n(q["turn"]), normaliser(ctx.tour(q["turn"]).texte).find(normaliser(q["quote"]))))


def _chevauche(a: list[dict], b: list[dict]) -> bool:
    for x in a:
        for y in b:
            if x["turn"] == y["turn"] and (normaliser(x["quote"]) in normaliser(y["quote"]) or normaliser(y["quote"]) in normaliser(x["quote"])):
                return True
    return False


def objections_uniques(ctx: ContexteAppel, s4: dict, rejets: Rejets) -> list[dict]:
    items = []
    for o in s4.get("objections") or []:
        if not isinstance(o, dict):
            rejets.ajouter(ETAPE, "objection:not_an_object")
            continue
        if (o.get("exclusion") or "none") != "none":                   # OB-2, X1
            rejets.ajouter(ETAPE, f"objection:excluded_{o.get('exclusion')}")
            continue
        citations = _citations_valides(ctx, o, rejets)
        if not citations:
            rejets.ajouter(ETAPE, "objection:no_valid_quote_after_price")
            continue
        nie = {O.SUJETS[s][1] for s in o.get("denied_subjects") or [] if s in O.SUJETS}
        sujets = [s for s in o.get("subjects") or [] if s in O.SUJETS and O.SUJETS[s][1] not in nie]
        nt = O.nature_des_sujets(sujets)                            # OB-3 boundary tests, OB-24
        if nt is None:
            rejets.ajouter(ETAPE, "objection:no_nature")
            continue
        items.append({"nature": nt[0], "subtype": nt[1], "quotes": citations, "raw": o, "merged": 1})
    items.sort(key=lambda m: ctx.n(m["quotes"][0]["turn"]))
    fusionne: list[dict] = []
    for it in items:                                                   # one objection, all its quotes (code)
        cib = next((m for m in fusionne if (m["nature"], m["subtype"]) == (it["nature"], it["subtype"])
                    or _chevauche(m["quotes"], it["quotes"])), None)
        if cib is None:
            fusionne.append(it)
            continue
        cib["merged"] += 1
        for q in it["quotes"]:
            if not _chevauche(cib["quotes"], [q]):
                cib["quotes"].append(q)
        cib["quotes"].sort(key=lambda q: ctx.n(q["turn"]))
    return fusionne


def _premier_commercial(ctx: ContexteAppel, apres: str, avant: Optional[str]) -> list:
    seq, pos = O.seq(ctx), O._pos(ctx)
    hi = pos[avant] if avant else len(seq)
    return [t for t in seq[pos[apres] + 1: hi] if t.role == COMMERCIAL]


def borne(ctx: ContexteAppel, m: dict, k: int, debut_suivant: Optional[str], rejets: Rejets) -> O.Episode:
    seq, pos = O.seq(ctx), O._pos(ctx)
    premier = m["quotes"][0]
    t0 = ctx.tour(premier["turn"])
    res = O.Resistance(t0.id, t0.id, t0.role, premier["quote"], m["nature"], m["subtype"], [t0.id])
    for q in m["quotes"][1:]:                                          # OB-5: same resistance over several turns
        entre = seq[pos[res.dernier] + 1: pos[q["turn"]]]
        if q["turn"] != res.dernier and all(t.role == COMMERCIAL and O.est_relance_orale(t) for t in entre):
            res.dernier = q["turn"]
            res.tours.append(q["turn"])
    ep = O.Episode(f"E{k}", res)
    brut = m["raw"]
    tc = brut.get("topic_change") if isinstance(brut.get("topic_change"), dict) else None
    tour_cs = None
    if tc:
        ok = not O._commercial_ok(ctx, Preuve(tc.get("quote") or "", tc.get("turn") or ""), mots_max=60)
        if ok and pos[tc["turn"]] > pos[res.dernier] and (debut_suivant is None or pos[tc["turn"]] < pos[debut_suivant]):
            tour_cs = tc["turn"]
        else:
            rejets.ajouter(ETAPE, "topic_change:rejected", tc)
    fin = tour_cs or debut_suivant
    reponse_com = [t for t in _premier_commercial(ctx, res.dernier, fin)]
    while reponse_com and O.est_relance_orale(reponse_com[0]):                  # a backchannel is not the first response
        reponse_com.pop(0)
    if brut.get("receive_and_leave") and reponse_com:                      # OB-22
        ep.reponse_com = [reponse_com[0].id]
        ep.changement_sujet = ep.tour_fin = reponse_com[0].id
        ep.raison_fin, ep.regle_latente = "topic_change", "OB-22"
    else:
        ep.reponse_com = [t.id for t in reponse_com]
        ep.changement_sujet, ep.tour_fin = tour_cs, fin
        ep.raison_fin = "topic_change" if tour_cs else "new_resistance" if debut_suivant else "end_of_call"
    if ep.reponse_com:
        hi = pos[ep.tour_fin] if ep.tour_fin else len(seq)
        ep.reaction = [t.id for t in seq[pos[ep.reponse_com[0]] + 1: hi] if t.role != COMMERCIAL]
    plus_tard = [q["turn"] for q in m["quotes"] if q["turn"] not in res.tours]
    ep.repetitions = [t for t in plus_tard if t in ep.reaction]                 # inside the episode: persisting
    hi = pos[ep.tour_fin] if ep.tour_fin else len(seq)
    if any(pos[t] >= hi for t in plus_tard):                               # after the episode: a recurrence (OB-11, X4)
        ep.revient_plus_tard = True
        ep.etiquettes.append("recurs_later")
    ep.latent, regle = O.est_latent(ctx, ep)
    if ep.latent:
        ep.regle_latente = regle
    return ep


def _verifie(T: O._Taches, tache, rep: Optional[dict], uid: str, ctx: ContexteAppel, rejets: Rejets, nom_: str) -> Optional[dict]:
    if not isinstance(rep, dict):
        return None
    try:
        e = tache.valider(rep, ctx, uid)
    except Exception as x:  # noqa: BLE001
        e = [f"invalid_shape:{type(x).__name__}"]
    if e:
        rejets.ajouter(ETAPE, f"{nom_}:{str(e[0]).split(':')[0]}", rep)
        return None
    return rep


def juger(ctx: ContexteAppel, ep: O.Episode, brut: dict, debuts_res: set[str], rejets: Rejets) -> None:
    """The engine's _judge, on the S4 readings (each checked by the engine task's validator). A gesture whose quote
    fails the check is not proved: it counts as not done (and is counted in the drops)."""
    T = O._Taches()
    uid = ep.cle
    T.unites[uid] = ep
    f: dict[str, Any] = {"h1_tags": []}
    nature = ep.res.nature
    if not ep.reponse_com:
        f.update(ack=False, h1=0, h3=0, reaction_level="latent", isolate=False, explore=False, explore_content=False,
                 prompted=False, mismatch=False)
        ep.faits = f
        return
    premier = ctx.tour(ep.reponse_com[0])
    premiere_phrase = (phrases(premier.texte) or [premier.texte])[0]
    accueil_a = _verifie(T, T.accueillir(), brut.get("acknowledge"), uid, ctx, rejets, "acknowledge")
    g = _verifie(T, T.geste(), brut.get("gesture"), uid, ctx, rejets, "gesture") or {}
    e = brut.get("explore")
    att_a = _verifie(T, T.explorer(), dict(e, explore=True) if isinstance(e, dict) else {"explore": False}, uid, ctx,
                     rejets, "explore")
    i = brut.get("isolate")
    iso_a = _verifie(T, T.isoler(), dict(i, isolate=True) if isinstance(i, dict) else {"isolate": False}, uid, ctx,
                     rejets, "isolate") if nature == "objection" else None
    r = brut.get("reaction")
    res_a = _verifie(T, T.resolution(), r, uid, ctx, rejets, "reaction") if not ep.latent and ep.reaction else None
    f["ack"] = O.accueilli(premiere_phrase, accueil_a)
    f["ack_ev"] = Preuve((accueil_a or {}).get("quote", premiere_phrase), premier.id, COMMERCIAL) if f["ack"] else None
    reponse_pr = O._pr(ctx, {"turn": g.get("answer_turn"), "quote": g.get("answer_quote")}, COMMERCIAL) \
        if g.get("answer_given") else None
    iso = O.isolement_valide(ctx, ep, iso_a, reponse_pr) if nature == "objection" else False
    explore, contenu = O.exploration(ctx, ep, att_a, debuts_res)
    f["isolate"], f["explore"], f["explore_content"] = iso, explore, contenu
    f["iso_ev"] = O._pr(ctx, iso_a, COMMERCIAL) if iso else None
    f["exp_ev"] = O._pr(ctx, att_a, COMMERCIAL) if explore else None
    f["exp_answer_ev"] = O._pr(ctx, {"turn": att_a.get("answer_turn"), "quote": att_a.get("answer_quote")}) \
        if contenu else None
    if g.get("cost_stated_by_prospect"):
        g = dict(g, cost_stated_by_prospect=bool(O._pr(ctx, {"turn": g.get("prospect_cost_turn"),
                                                              "quote": g.get("prospect_cost_quote")})))
    f["h1"], f["h1_tags"] = O.niveau_h1(nature, g, {"ack": f["ack"], "isolate": iso, "explore": explore})
    f["gesture_ev"] = O._pr(ctx, {"turn": g.get("gesture_turn"), "quote": g.get("gesture_quote")}, COMMERCIAL) \
        if f["h1"] else None
    if nature == "inertia" and f["h1"] == 2:
        f["gesture_ev"] = f["gesture_ev"] or O._pr(ctx, {"turn": g.get("prospect_cost_turn"),
                                                          "quote": g.get("prospect_cost_quote")})
    f["h3"] = O.niveau_h3(nature, iso, explore, contenu)
    f["mismatch"] = nature != "objection" and bool(g.get("offer_argument")) and f["h1"] == 0
    f["answer_ev"] = reponse_pr
    niv, rev, suggere = O.niveau_resolution(ctx, ep, res_a)
    f["reaction_level"], f["reaction_ev"], f["prompted"] = niv, rev, suggere
    if res_a and res_a.get("reaction_kind") == "other":
        ep.etiquettes.append("uncovered_reaction")
    ep.faits = f
    ep.etiquettes += f.get("h1_tags", [])


def _faits_prevention(ctx: ContexteAppel, brut: dict, rejets: Rejets) -> dict:
    T = O._Taches()
    tache = T.prevention()
    sortie = {}
    for k in O.FAITS_PROSPECT + O.FAITS_COMMERCIAL:
        d = brut.get(k)
        if not isinstance(d, dict) or not d.get("quote"):
            continue
        if _verifie(T, tache, {k: d}, "prevention", ctx, rejets, f"prevention.{k}") is not None:
            sortie[k] = d
    return sortie


def executer_objections(ctx: ContexteAppel, s4: dict, rejets: Rejets) -> ResultatCompetence:
    sortie = ResultatCompetence("OBJECTIONS", "OBJ-1.1")
    if not ctx.reference_offre:
        sortie.signaux.append("offer_reference_missing")
    objs = objections_uniques(ctx, s4, rejets)
    eps: list[O.Episode] = []
    for k, m in enumerate(objs, 1):
        suiv = objs[k]["quotes"][0]["turn"] if k < len(objs) else None
        eps.append(borne(ctx, m, k, suiv, rejets))
    debuts_res = {e.res.debut for e in eps}
    for ep, m in zip(eps, objs):
        juger(ctx, ep, m["raw"], debuts_res, rejets)
    precedent = [dict(e, call_id=p.get("call_id")) for p in ctx.entrees_anterieures
                if p.get("kind") == "objections_episodes" for e in p.get("episodes", [])]
    recurrent_prec = O.lier_recurrences(ctx, eps, precedent)
    for ep in eps:
        ep.items = O.items_episode(ctx, ep, ep.faits)
        ep.note = note_appel(ep.items)

    fp = ctx.phases.premier_prix
    statut_h, statut_p = O.applicabilite(len(eps), bool(fp))
    prevention, items_p, note_p = None, [], None
    if statut_p == "scored":
        items_p, prevention, pf = O.items_prevention(ctx, _faits_prevention(ctx, s4.get("prevention") or {}, rejets), fp)
        sortie.signaux += pf
        note_p = note_appel(items_p)
    note_h = O.note_traitement(eps) if statut_h == "scored" else None
    if statut_h == "not_applicable" and statut_p == "not_applicable":
        sortie.statut, sortie.raisons = "not_applicable", ["no_resistance_no_price"]
    else:
        sortie.statut = "scored"
        sortie.note = O.combiner(note_h, note_p)
        if statut_h == "not_applicable":
            sortie.raisons.append("no_resistance: call score = prevention score")
    if eps:
        sortie.signaux.append("h5_provisional")
    items_appel: list[NoteItem] = []
    for hid in O.POIDS_H:
        niveaux = [(e, next(i for i in e.items if i.id == hid)) for e in eps]
        if niveaux:
            e, it = min(niveaux, key=lambda x: x[1].niveau)
            items_appel.append(NoteItem(hid, O.POIDS_H[hid], it.niveau, it.preuve, f"min over episodes ({e.id})"))
    sortie.items = items_appel + items_p
    sortie.concordance = "single_reading"
    enregistrements = []
    for e, m in zip(eps, objs):
        enr = O.CompetenceObjections._enr_episode(ctx, e)
        enr["quotes"] = m["quotes"]                      # every passage of this one objection (Romain 2026-11-03)
        enr["merged_items"] = m["merged"]
        enregistrements.append(enr)
    sortie.details = {
        "handling_status": statut_h, "prevention_status": statut_p,
        "handling_score": note_h, "prevention_score": note_p,
        "episodes": enregistrements,
        "prevention": O.CompetenceObjections._enr_prevention(prevention, items_p),
        "deadlines_detected": [],
        "recurs_from_previous_call": recurrent_prec,
        "diagnostics": O.diagnostics(ctx, eps, prevention),
        "unit_status": {"single_reading": len(eps)},
        "lite": {"scope": "after_first_price", "unique": True, "dropped": rejets.comptes.get(ETAPE, {})},
    }
    return sortie
