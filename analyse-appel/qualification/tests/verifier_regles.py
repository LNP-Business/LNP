import copy, sys
sys.path.insert(0, __import__("os").path.join(__import__("os").path.dirname(__file__), ".."))
from datetime import date
from qualification_lnp import qualifier

D = date(2026, 11, 4)

BASE = {
    "meta": {"date_appel": "2026-11-04", "enregistrement_fathom": "oui"},
    "appel": {"appel_tenu": {"valeur": "oui"}},
    "metier": {
        "etudiant": {"valeur": "non"},
        "a_enseigne_scolaire": {"valeur": "oui", "preuve": "prof de maths au collège depuis 12 ans", "minutage": "02:10"},
        "cours_payants_actuels": {"valeur": "non"},
        "matiere": {"valeur": "mathématiques", "categorie": "matiere_scolaire", "preuve": "maths"},
    },
    "projet": {
        "douleur": {"valeur": "usure", "preuve": "je suis épuisée"},
        "intention": {"valeur": "enseigner_autrement", "preuve": "continuer à enseigner mais à mon compte"},
        "revenu_vise_mensuel": {"valeur": 2500, "preuve": "2 500 € par mois"},
        "echeance": {"type": "date", "date": "2027-06-30", "preuve": "d'ici juin"},
    },
    "financement": {
        "ressources_citees": [{"type": "epargne", "preuve": "j'ai un peu d'épargne", "minutage": "24:30"}],
        "objection_fonds": {"valeur": "non"},
        "situation_bloquante": {"valeur": "aucune"},
    },
    "decision": {
        "decideur": {"valeur": "seul", "preuve": "c'est moi qui décide"},
        "second_rdv": {"propose": "sans_objet", "date": None},
        "demarrage": {"type": "delai", "delai_mois": 1, "preuve": "dès le mois prochain"},
    },
    "vente": {"offre_presentee": {"valeur": "oui"}, "issue": {"valeur": "acompte"},
              "refus_explicite": {"valeur": "non"}, "relance": {"date": None},
              "synthese_sales_presente": {"valeur": "oui"}},
}

def mk(**changements):
    f = copy.deepcopy(BASE)
    for chemin, val in changements.items():
        cour = f
        cles = chemin.split("__")
        for k in cles[:-1]:
            cour = cour[k]
        cour[cles[-1]] = val
    return f

def executer(nom_, lectures, attendu, alerte=None, **kw):
    r = qualifier(lectures, D, **kw)
    ok = r["statut"] == attendu and (alerte is None or any(alerte in a for a in r["alertes"]))
    print(("OK    " if ok else "ÉCHEC "), nom_, "→", r["statut"], r["base"], r["alertes"] if not ok or alerte else "")
    return ok

res = [
    executer("A. SQL gagné (acompte)", [BASE], "SQL GAGNÉ"),
    executer("B. 'pas les fonds' + épargne citée, relance J+10",
        [mk(financement__objection_fonds={"valeur": "oui"},
            vente__issue={"valeur": "aucun"}, vente__relance={"date": "2026-11-14"})], "SQL OUVERT"),
    executer("C. Conjoint absent, 2e RDV non proposé, offre présentée",
        [mk(decision__decideur={"valeur": "decideur_absent"},
            decision__second_rdv={"propose": "non", "date": None}, vente__issue={"valeur": "aucun"})],
        "NON SQL", "Présentation hors règle"),
    executer("C bis. Conjoint absent, 2e RDV posé",
        [mk(decision__decideur={"valeur": "decideur_absent"},
            decision__second_rdv={"propose": "oui", "date": "2026-11-10", "accepte": "oui"})], "SQL GAGNÉ"),
    # V2.2 : la porte « Douleur et projet » est supprimée ; le projet ne ferme plus et ne laisse plus rien à vérifier
    executer("D. Veut changer de métier (V2.2 : ne ferme plus de porte)",
        [mk(projet__intention={"valeur": "changer_de_metier"})], "SQL GAGNÉ"),
    executer("E. Quatre portes ouvertes, offre non présentée",
        [mk(vente__offre_presentee={"valeur": "non"}, vente__issue={"valeur": "aucun"})], "À REVOIR", "SQL manqué"),
    executer("F. Pas de revenu visé chiffré ni d'échéance (V2.2 : plus vérifiés)",
        [mk(projet__revenu_vise_mensuel={"valeur": None}, projet__echeance={"type": "absente"})], "SQL GAGNÉ"),
    executer("F bis. Démarrage non établi : la découverte reste incomplète",
        [mk(decision__demarrage={"type": "absent"})], "À REVOIR", "Découverte incomplète"),
    executer("G. Double lecture en désaccord sur le financement",
        [BASE, mk(financement__ressources_citees=[], financement__situation_bloquante={"valeur": "rsa"})],
        "À REVOIR", "Désaccord"),
    executer("H. Relance à J+30",
        [mk(vente__issue={"valeur": "aucun"}, vente__relance={"date": "2026-12-04"})], "SQL OUVERT", "Relance non conforme"),
    executer("I. Démarrage dans 5 mois",
        [mk(decision__demarrage={"type": "delai", "delai_mois": 5})], "NON SQL"),
    executer("J. Étudiant sans cours payants",
        [mk(metier__etudiant={"valeur": "oui"}, metier__a_enseigne_scolaire={"valeur": "non"},
            metier__cours_payants_actuels={"valeur": "non"})], "NON SQL"),
    executer("K. FLE adultes (pas d'expérience Éducation nationale)",
        [mk(metier__a_enseigne_scolaire={"valeur": "non"}, metier__cours_payants_actuels={"valeur": "oui"},
            metier__matiere={"valeur": "FLE", "categorie": "fle_adultes"})], "NON SQL"),
    # --- V2.1 ---
    executer("S. Étudiant qui vend déjà des cours de maths",
        [mk(metier__etudiant={"valeur": "oui"}, metier__a_enseigne_scolaire={"valeur": "non"},
            metier__cours_payants_actuels={"valeur": "oui"})], "SQL GAGNÉ"),
    executer("T. Étudiant, cours payants inconnus",
        [mk(metier__etudiant={"valeur": "oui"}, metier__a_enseigne_scolaire={"valeur": "non"},
            metier__cours_payants_actuels={"valeur": "inconnu"})], "À REVOIR", "vérifier s'il vend"),
    executer("U. Prof Éducation nationale d'EPS (matière hors liste)",
        [mk(metier__matiere={"valeur": "EPS", "categorie": "autre"})], "SQL GAGNÉ"),
    executer("U bis. Prof Éducation nationale, matière non précisée",
        [mk(metier__matiere={"valeur": None, "categorie": None})], "SQL GAGNÉ"),
    executer("V. Solution aware (compare + RDV pris) malgré RSA sans ressource",
        [mk(concurrence={"compare_autres_offres": {"valeur": "oui", "preuve": "je regarde aussi X"},
                         "rdv_autres_offres": {"valeur": "deja_pris", "preuve": "j'ai eu un appel avec eux lundi"}},
            financement__ressources_citees=[], financement__situation_bloquante={"valeur": "rsa"})],
        "SQL GAGNÉ", "qualifiée d'office"),
    executer("W. Compare d'autres offres sans RDV (mode strict) → règle normale",
        [mk(concurrence={"compare_autres_offres": {"valeur": "oui"}, "rdv_autres_offres": {"valeur": "non"}},
            financement__ressources_citees=[], financement__situation_bloquante={"valeur": "rsa"})], "NON SQL"),
    executer("X. Solution aware mais offre non présentée",
        [mk(concurrence={"compare_autres_offres": {"valeur": "oui"}, "rdv_autres_offres": {"valeur": "prevu"}},
            vente__offre_presentee={"valeur": "non"}, vente__issue={"valeur": "aucun"})], "À REVOIR", "SQL manqué"),
    executer("Y. Lectures en désaccord sur solution aware",
        [mk(concurrence={"compare_autres_offres": {"valeur": "oui"}, "rdv_autres_offres": {"valeur": "prevu"}},
            financement__ressources_citees=[], financement__situation_bloquante={"valeur": "rsa"}),
         mk(financement__ressources_citees=[], financement__situation_bloquante={"valeur": "rsa"})], "NON SQL", "règle non appliquée"),
    executer("Z. Solution aware sans Fathom",
        [mk(concurrence={"compare_autres_offres": {"valeur": "oui"}, "rdv_autres_offres": {"valeur": "prevu"}})],
        "NON SQL", fathom="non"),
    executer("L. RSA sans ressource",
        [mk(financement__ressources_citees=[], financement__situation_bloquante={"valeur": "rsa"})], "NON SQL"),
    executer("M. RSA mais proche qui avance",
        [mk(financement__ressources_citees=[{"type": "proche"}], financement__situation_bloquante={"valeur": "rsa"})],
        "À REVOIR"),
    executer("N. Pas de Fathom", [BASE], "NON SQL", fathom="non"),
    executer("O. Appel non tenu", [mk(appel={"appel_tenu": {"valeur": "non"}, "motif_non_tenu": {"valeur": "replay_non_vu"}})],
        "MQL EN ATTENTE"),
    executer("P. Écart avec la saisie", [BASE], "SQL GAGNÉ", "Écart avec la saisie",
        saisie_issue="Pas pitché", saisie_issue_="Pas qualifié"),
    executer("Q. 'Pas les fonds' sans ressource ni situation bloquante",
        [mk(financement__ressources_citees=[], financement__objection_fonds={"valeur": "oui"})],
        "À REVOIR", "renvoyé la personne"),
    executer("R. Refus explicite", [mk(vente__issue={"valeur": "aucun"}, vente__refus_explicite={"valeur": "oui"})], "SQL PERDU"),
]
print(f"\n{sum(res)}/{len(res)} cas réussis")
sys.exit(0 if all(res) else 1)
