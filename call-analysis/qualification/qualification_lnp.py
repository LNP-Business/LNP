#!/usr/bin/env python3
"""
Qualification SQL des appels LNP — version 2.

Étape 2 du pipeline : applique la règle des quatre portes (proposition du
27 octobre 2026) aux faits extraits par le modèle (étape 1, prompt d'extraction).
Le modèle ne décide rien : il extrait. Ce script décide, toujours de la même façon.

Usage :
    python qualification_lnp.py lecture_1.json [lecture_2.json]
        [--date-appel 2026-11-04] [--fathom oui|non]
        [--saisie-issue "Pas pitché"] [--saisie-outcome "Pas qualifié"]

Avec deux lectures (double lecture), toute porte sur laquelle elles divergent
passe en NON VÉRIFIÉE et l'appel part en À REVOIR.

Aucune dépendance externe. Python 3.8+.
"""

import argparse
import json
import sys
from datetime import date, timedelta

# ---------------------------------------------------------------------------
# PARAMÈTRES — à valider par le Head of Sales et Samy (voir document V2, §6)
# ---------------------------------------------------------------------------
PARAMS = {
    # Porte 4 : délai maximum de démarrage, en jours après l'appel (≈ 3 mois)
    "demarrage_max_jours": 92,
    # Relance : délai maximum, en jours après l'appel
    "relance_max_jours": 15,
    # Porte 1 : catégories de matière qui se vendent aux familles
    "matieres_vendables": {"matiere_scolaire", "langue_enfants", "musique_arts"},
    # Porte 1 : catégories exclues
    "matieres_exclues": {"aide_devoirs_generale", "fle_adultes", "coaching_formation_pro"},
    # Porte 2 : douleurs reconnues comme « précises »
    "douleurs_precises": {"usure", "salaire", "mutation", "temps", "autre_precise"},
    # Porte 2 : intentions qui ferment la porte
    "intentions_fermantes": {"changer_de_metier", "pour_voir", "cherche_un_prix", "croit_plateforme"},
    # Porte 3 : situations qui ferment la porte quand aucune ressource n'est citée
    "situations_bloquantes": {"rsa", "aucun_revenu", "dettes_bloquantes"},
    # Échéance du projet (porte 2) : types acceptés
    "echeance_types_valides": {"date", "delai"},
}

OUVERTE, FERMEE, NV = "OUVERTE", "FERMÉE", "NON VÉRIFIÉE"
PORTES = ("metier", "douleur_projet", "financement", "decision_timing")
LIBELLES = {
    "metier": "Porte 1 — Métier",
    "douleur_projet": "Porte 2 — Douleur et projet",
    "financement": "Porte 3 — Financement",
    "decision_timing": "Porte 4 — Décision et timing",
}


# ---------------------------------------------------------------------------
# Outils
# ---------------------------------------------------------------------------
def v(obj, *path, default=None):
    """Lit une valeur imbriquée ; renvoie 'valeur' si le nœud est un fait {valeur, preuve}."""
    cur = obj
    for p in path:
        if not isinstance(cur, dict) or p not in cur:
            return default
        cur = cur[p]
    if isinstance(cur, dict) and "valeur" in cur:
        cur = cur["valeur"]
    return default if cur in (None, "", "inconnu") else cur


def preuve(obj, *path):
    cur = obj
    for p in path:
        if not isinstance(cur, dict) or p not in cur:
            return ""
        cur = cur[p]
    if isinstance(cur, dict):
        txt = cur.get("preuve") or ""
        mn = cur.get("minutage") or ""
        return f"{txt} [{mn}]" if txt and mn else txt
    return ""


def parse_date(s):
    try:
        return date.fromisoformat(str(s)[:10])
    except (TypeError, ValueError):
        return None


def jours_depuis(appel, bloc):
    """Convertit {type: date|delai, date: AAAA-MM-JJ, delai_mois: n} en nombre de jours après l'appel."""
    if not isinstance(bloc, dict):
        return None
    t = bloc.get("type")
    if t == "date":
        d = parse_date(bloc.get("date"))
        return (d - appel).days if d else None
    if t == "delai" and bloc.get("delai_mois") is not None:
        try:
            return round(float(bloc["delai_mois"]) * 30.4)
        except (TypeError, ValueError):
            return None
    return None


# ---------------------------------------------------------------------------
# Les quatre portes — chaque fonction renvoie (statut, preuve, raisons)
# ---------------------------------------------------------------------------
def porte_metier(f):
    m = f.get("metier", {})
    raisons = []
    if v(m, "etudiant") == "oui":
        return FERMEE, preuve(m, "etudiant"), ["Étudiant(e)"]
    enseigne = v(m, "a_enseigne_scolaire")
    cours = v(m, "cours_payants_actuels")
    cat = v(m, "matiere", "categorie") or v(m, "matiere_categorie")
    p = " / ".join(x for x in (preuve(m, "a_enseigne_scolaire"), preuve(m, "cours_payants_actuels"),
                                preuve(m, "matiere")) if x)
    if enseigne == "non" and cours == "non":
        return FERMEE, p, ["N'a jamais enseigné dans le scolaire et ne donne pas de cours payants"]
    if cat in PARAMS["matieres_exclues"]:
        return FERMEE, p, [f"Matière non vendable aux familles ({cat})"]
    experience = enseigne == "oui" or cours == "oui"
    if experience and cat in PARAMS["matieres_vendables"]:
        return OUVERTE, p, []
    if not experience:
        raisons.append("Expérience d'enseignement ou cours payants non établis")
    if cat is None or cat == "autre":
        raisons.append("Matière non identifiée ou à classer")
    return NV, p, raisons


def porte_douleur_projet(f):
    pj = f.get("projet", {})
    intention = v(pj, "intention")
    p = " / ".join(x for x in (preuve(pj, "douleur"), preuve(pj, "intention"),
                                preuve(pj, "revenu_vise_mensuel"), preuve(pj, "echeance")) if x)
    if intention in PARAMS["intentions_fermantes"]:
        lib = {"changer_de_metier": "veut changer de métier", "pour_voir": "venu(e) « pour voir »",
               "cherche_un_prix": "vient chercher un prix",
               "croit_plateforme": "croit que LNP est une plateforme de mise en relation"}
        return FERMEE, p, [lib.get(intention, intention)]
    raisons = []
    if intention != "enseigner_autrement":
        raisons.append("Projet d'enseigner autrement non établi")
    if v(pj, "douleur") not in PARAMS["douleurs_precises"]:
        raisons.append("Pas de douleur précise nommée")
    if v(pj, "revenu_vise_mensuel") is None:
        raisons.append("Pas de revenu mensuel visé chiffré")
    ech = pj.get("echeance") or {}
    if ech.get("type") not in PARAMS["echeance_types_valides"]:
        raisons.append("Pas d'échéance (date ou délai)")
    return (OUVERTE, p, []) if not raisons else (NV, p, raisons)


def porte_financement(f):
    fi = f.get("financement", {})
    ressources = [r for r in (fi.get("ressources_citees") or []) if isinstance(r, dict) and r.get("type")]
    bloquante = v(fi, "situation_bloquante")
    p_res = " / ".join(f"{r['type']} : {r.get('preuve', '')}".strip(" :") for r in ressources)
    p = " / ".join(x for x in (p_res, preuve(fi, "situation_bloquante")) if x)
    if ressources and bloquante in PARAMS["situations_bloquantes"]:
        return NV, p, [f"Ressource citée malgré une situation bloquante ({bloquante}) : à arbitrer"]
    if ressources:
        return OUVERTE, p, []
    if bloquante in PARAMS["situations_bloquantes"]:
        lib = {"rsa": "au RSA", "aucun_revenu": "aucun revenu", "dettes_bloquantes": "dettes qui bloquent tout"}
        return FERMEE, p, [f"Aucune ressource : {lib.get(bloquante, bloquante)}"]
    if v(fi, "objection_fonds") == "oui":
        return NV, p, ["« Pas les fonds » sans ressource citée : le sales n'a pas renvoyé la personne à ses ressources"]
    return NV, p, ["Financement non abordé"]


def porte_decision_timing(f, date_appel, alertes):
    d = f.get("decision", {})
    decideur = v(d, "decideur")
    rdv = d.get("second_rdv") or {}
    rdv_date = parse_date(rdv.get("date"))
    p = " / ".join(x for x in (preuve(d, "decideur"), preuve(d, "second_rdv"), preuve(d, "demarrage")) if x)

    # Décision
    if decideur in ("seul", "decideur_present"):
        dec = OUVERTE
    elif decideur == "decideur_absent":
        if rdv_date:
            dec = OUVERTE
        else:
            dec = FERMEE
            if rdv.get("propose") == "non":
                alertes.append("2e RDV non proposé : décideur absent et aucun rendez-vous à deux proposé")
    else:
        dec = NV

    # Timing
    jours = jours_depuis(date_appel, d.get("demarrage"))
    if jours is None:
        tim = NV
    elif jours <= PARAMS["demarrage_max_jours"]:
        tim = OUVERTE
    else:
        tim = FERMEE

    raisons = []
    if dec == FERMEE:
        raisons.append("Ne décide pas seul(e) et aucun 2e rendez-vous posé")
    if tim == FERMEE:
        raisons.append(f"Démarrage à {jours} jours (> {PARAMS['demarrage_max_jours']})")
    if FERMEE in (dec, tim):
        return FERMEE, p, raisons
    if dec == NV:
        raisons.append("Décideur non établi")
    if tim == NV:
        raisons.append("Date ou délai de démarrage non établi")
    return (OUVERTE, p, []) if not raisons else (NV, p, raisons)


def evaluer_portes(f, date_appel):
    alertes = []
    res = {
        "metier": porte_metier(f),
        "douleur_projet": porte_douleur_projet(f),
        "financement": porte_financement(f),
        "decision_timing": porte_decision_timing(f, date_appel, alertes),
    }
    return res, alertes


# ---------------------------------------------------------------------------
# Décision
# ---------------------------------------------------------------------------
def qualifier(lectures, date_appel=None, fathom=None, saisie_issue=None, saisie_outcome=None):
    f = lectures[0]
    meta = f.get("meta", {})
    date_appel = date_appel or parse_date(meta.get("date_appel")) or date.today()
    if fathom is None:
        fathom = meta.get("enregistrement_fathom", "oui")

    portes, alertes = evaluer_portes(f, date_appel)

    # Double lecture : une porte en désaccord devient NON VÉRIFIÉE
    if len(lectures) > 1:
        portes2, _ = evaluer_portes(lectures[1], date_appel)
        for k in PORTES:
            if portes[k][0] != portes2[k][0]:
                alertes.append(f"Désaccord entre lectures sur {LIBELLES[k]} ({portes[k][0]} / {portes2[k][0]})")
                portes[k] = (NV, portes[k][1], portes[k][2] + ["Désaccord entre les deux lectures"])
        if v(f, "vente", "offre_presentee") != v(lectures[1], "vente", "offre_presentee"):
            alertes.append("Désaccord entre lectures sur la présentation de l'offre")

    statuts = {k: portes[k][0] for k in PORTES}
    vente = f.get("vente", {})
    offre = v(vente, "offre_presentee")
    issue = v(vente, "issue")
    out = {
        "statut": None,
        "portes": {k: {"statut": portes[k][0], "preuve": portes[k][1], "raisons": portes[k][2]} for k in PORTES},
        "offre_presentee": {"oui": True, "non": False}.get(offre),
        "base": {"issue_r1": None, "outcome": None, "motif": "", "date_relance": None},
        "alertes": alertes,
        "confiance": None,
    }
    base = out["base"]

    # 1. Fathom
    if str(fathom).lower() in ("non", "false", "0", "no"):
        out["statut"] = "NON SQL"
        base["motif"] = "Pas d'enregistrement Fathom"
        out["confiance"] = "haute"
        return _finir(out, saisie_issue, saisie_outcome)

    # 2. Appel non tenu
    appel = f.get("appel", {})
    if v(appel, "appel_tenu") == "non":
        out["statut"] = "MQL EN ATTENTE"
        base["issue_r1"] = "Rescheduled"
        base["motif"] = v(appel, "motif_non_tenu") or "Appel non tenu"
        out["confiance"] = "haute"
        return _finir(out, saisie_issue, saisie_outcome)

    fermees = [k for k in PORTES if statuts[k] == FERMEE]
    nv = [k for k in PORTES if statuts[k] == NV]

    # Alertes de découverte
    for k in nv:
        alertes.append(f"Découverte incomplète : {LIBELLES[k]} — " + "; ".join(portes[k][2]))
    for c in f.get("contradictions") or []:
        alertes.append(f"Contradiction du prospect : {c}")
    if v(f, "vente", "synthese_sales_presente") == "non":
        alertes.append("Synthèse des quatre portes absente en fin de découverte")

    # 3. Une porte fermée
    if fermees:
        out["statut"] = "NON SQL"
        base["issue_r1"] = "Pas pitché"
        base["outcome"] = "Pas qualifié"
        base["motif"] = " | ".join(f"{LIBELLES[k]} : " + "; ".join(portes[k][2]) for k in fermees)
        if offre == "oui":
            alertes.append("Pitch hors règle : offre présentée alors qu'une porte était fermée")
        out["confiance"] = "haute" if not nv else "moyenne"
        return _finir(out, saisie_issue, saisie_outcome)

    # 6. Portes non vérifiées
    if nv:
        out["statut"] = "À REVOIR"
        base["motif"] = "Portes à vérifier : " + ", ".join(LIBELLES[k] for k in nv)
        out["confiance"] = "basse"
        return _finir(out, saisie_issue, saisie_outcome)

    # 5. Quatre portes ouvertes, pas de pitch
    if offre != "oui":
        out["statut"] = "À REVOIR"
        alertes.append("SQL manqué : quatre portes ouvertes sans présentation de l'offre")
        base["motif"] = "Quatre portes ouvertes, offre non présentée"
        out["confiance"] = "moyenne"
        return _finir(out, saisie_issue, saisie_outcome)

    # 4. SQL
    paiement = {"paiement_complet": "Full-Pay", "paiement_fractionne": "Split-Pay", "acompte": "Deposit"}
    if issue in paiement:
        out["statut"] = "SQL GAGNÉ"
        base["issue_r1"] = "Closé"
        base["outcome"] = paiement[issue]
    else:
        base["issue_r1"] = "Non closé"
        relance = vente.get("relance") or {}
        d_rel = parse_date(relance.get("date"))
        if v(vente, "refus_explicite") == "oui":
            out["statut"] = "SQL PERDU"
            base["outcome"] = "Perdu"
        elif d_rel and (d_rel - date_appel).days <= PARAMS["relance_max_jours"]:
            out["statut"] = "SQL OUVERT"
            base["outcome"] = "FUP court"
            base["date_relance"] = d_rel.isoformat()
        else:
            out["statut"] = "SQL OUVERT"
            base["outcome"] = None
            if d_rel:
                base["date_relance"] = d_rel.isoformat()
                alertes.append(f"Relance non conforme : datée à {(d_rel - date_appel).days} jours "
                               f"(max {PARAMS['relance_max_jours']}) — passe en Perdu si aucun rendez-vous")
            else:
                alertes.append("Relance non conforme : aucune date de relance posée")
    out["confiance"] = "haute" if v(f, "vente", "synthese_sales_presente") == "oui" else "moyenne"
    return _finir(out, saisie_issue, saisie_outcome)


def _finir(out, saisie_issue, saisie_outcome):
    b = out["base"]
    ecarts = []
    if saisie_issue and b["issue_r1"] and saisie_issue.strip().lower() != b["issue_r1"].lower():
        ecarts.append(f"issue R1 saisie « {saisie_issue} » vs agent « {b['issue_r1']} »")
    if saisie_outcome and b["outcome"] and saisie_outcome.strip().lower() != b["outcome"].lower():
        ecarts.append(f"outcome saisi « {saisie_outcome} » vs agent « {b['outcome']} »")
    if ecarts:
        out["alertes"].append("Écart avec la saisie : " + "; ".join(ecarts))
    return out


# ---------------------------------------------------------------------------
def main():
    ap = argparse.ArgumentParser(description="Qualification SQL LNP — règle des quatre portes")
    ap.add_argument("lectures", nargs="+", help="1 ou 2 fichiers JSON produits par le prompt d'extraction")
    ap.add_argument("--date-appel")
    ap.add_argument("--fathom", choices=["oui", "non"])
    ap.add_argument("--saisie-issue")
    ap.add_argument("--saisie-outcome")
    a = ap.parse_args()
    lectures = []
    for path in a.lectures[:2]:
        with open(path, encoding="utf-8") as fh:
            lectures.append(json.load(fh))
    res = qualifier(lectures, parse_date(a.date_appel), a.fathom, a.saisie_issue, a.saisie_outcome)
    json.dump(res, sys.stdout, ensure_ascii=False, indent=2)
    print()


if __name__ == "__main__":
    main()
