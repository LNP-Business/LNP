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

def mk(**changes):
    f = copy.deepcopy(BASE)
    for path, val in changes.items():
        cur = f
        keys = path.split("__")
        for k in keys[:-1]:
            cur = cur[k]
        cur[keys[-1]] = val
    return f

def run(name, lectures, attendu, alerte=None, **kw):
    r = qualifier(lectures, D, **kw)
    ok = r["statut"] == attendu and (alerte is None or any(alerte in a for a in r["alertes"]))
    print(("OK  " if ok else "FAIL"), name, "→", r["statut"], r["base"], r["alertes"] if not ok or alerte else "")
    return ok

res = [
    run("A. SQL gagné (acompte)", [BASE], "SQL GAGNÉ"),
    run("B. 'pas les fonds' + épargne citée, relance J+10",
        [mk(financement__objection_fonds={"valeur": "oui"},
            vente__issue={"valeur": "aucun"}, vente__relance={"date": "2026-11-14"})], "SQL OUVERT"),
    run("C. Conjoint absent, 2e RDV non proposé, pitché",
        [mk(decision__decideur={"valeur": "decideur_absent"},
            decision__second_rdv={"propose": "non", "date": None}, vente__issue={"valeur": "aucun"})],
        "NON SQL", "Pitch hors règle"),
    run("C bis. Conjoint absent, 2e RDV posé",
        [mk(decision__decideur={"valeur": "decideur_absent"},
            decision__second_rdv={"propose": "oui", "date": "2026-11-10", "accepte": "oui"})], "SQL GAGNÉ"),
    run("D. Veut changer de métier",
        [mk(projet__intention={"valeur": "changer_de_metier"}, vente__offre_presentee={"valeur": "non"})], "NON SQL"),
    run("E. Quatre portes ouvertes, pas de pitch",
        [mk(vente__offre_presentee={"valeur": "non"}, vente__issue={"valeur": "aucun"})], "À REVOIR", "SQL manqué"),
    run("F. Pas de revenu visé chiffré",
        [mk(projet__revenu_vise_mensuel={"valeur": None})], "À REVOIR", "Découverte incomplète"),
    run("G. Double lecture en désaccord sur le financement",
        [BASE, mk(financement__ressources_citees=[], financement__situation_bloquante={"valeur": "rsa"})],
        "À REVOIR", "Désaccord"),
    run("H. Relance à J+30",
        [mk(vente__issue={"valeur": "aucun"}, vente__relance={"date": "2026-12-04"})], "SQL OUVERT", "Relance non conforme"),
    run("I. Démarrage dans 5 mois",
        [mk(decision__demarrage={"type": "delai", "delai_mois": 5})], "NON SQL"),
    run("J. Étudiant sans cours payants",
        [mk(metier__etudiant={"valeur": "oui"}, metier__a_enseigne_scolaire={"valeur": "non"},
            metier__cours_payants_actuels={"valeur": "non"})], "NON SQL"),
    run("K. FLE adultes (pas d'expérience Éducation nationale)",
        [mk(metier__a_enseigne_scolaire={"valeur": "non"}, metier__cours_payants_actuels={"valeur": "oui"},
            metier__matiere={"valeur": "FLE", "categorie": "fle_adultes"})], "NON SQL"),
    # --- V2.1 ---
    run("S. Étudiant qui vend déjà des cours de maths",
        [mk(metier__etudiant={"valeur": "oui"}, metier__a_enseigne_scolaire={"valeur": "non"},
            metier__cours_payants_actuels={"valeur": "oui"})], "SQL GAGNÉ"),
    run("T. Étudiant, cours payants inconnus",
        [mk(metier__etudiant={"valeur": "oui"}, metier__a_enseigne_scolaire={"valeur": "non"},
            metier__cours_payants_actuels={"valeur": "inconnu"})], "À REVOIR", "vérifier s'il vend"),
    run("U. Prof Éducation nationale d'EPS (matière hors liste)",
        [mk(metier__matiere={"valeur": "EPS", "categorie": "autre"})], "SQL GAGNÉ"),
    run("U bis. Prof Éducation nationale, matière non précisée",
        [mk(metier__matiere={"valeur": None, "categorie": None})], "SQL GAGNÉ"),
    run("V. Solution aware (compare + RDV pris) malgré RSA sans ressource",
        [mk(concurrence={"compare_autres_offres": {"valeur": "oui", "preuve": "je regarde aussi X"},
                         "rdv_autres_offres": {"valeur": "deja_pris", "preuve": "j'ai eu un appel avec eux lundi"}},
            financement__ressources_citees=[], financement__situation_bloquante={"valeur": "rsa"})],
        "SQL GAGNÉ", "qualifiée d'office"),
    run("W. Compare d'autres offres sans RDV (mode strict) → règle normale",
        [mk(concurrence={"compare_autres_offres": {"valeur": "oui"}, "rdv_autres_offres": {"valeur": "non"}},
            financement__ressources_citees=[], financement__situation_bloquante={"valeur": "rsa"})], "NON SQL"),
    run("X. Solution aware mais offre non présentée",
        [mk(concurrence={"compare_autres_offres": {"valeur": "oui"}, "rdv_autres_offres": {"valeur": "prevu"}},
            vente__offre_presentee={"valeur": "non"}, vente__issue={"valeur": "aucun"})], "À REVOIR", "SQL manqué"),
    run("Y. Lectures en désaccord sur solution aware",
        [mk(concurrence={"compare_autres_offres": {"valeur": "oui"}, "rdv_autres_offres": {"valeur": "prevu"}},
            projet__intention={"valeur": "pour_voir"}),
         mk(projet__intention={"valeur": "pour_voir"})], "NON SQL", "règle non appliquée"),
    run("Z. Solution aware sans Fathom",
        [mk(concurrence={"compare_autres_offres": {"valeur": "oui"}, "rdv_autres_offres": {"valeur": "prevu"}})],
        "NON SQL", fathom="non"),
    run("L. RSA sans ressource",
        [mk(financement__ressources_citees=[], financement__situation_bloquante={"valeur": "rsa"})], "NON SQL"),
    run("M. RSA mais proche qui avance",
        [mk(financement__ressources_citees=[{"type": "proche"}], financement__situation_bloquante={"valeur": "rsa"})],
        "À REVOIR"),
    run("N. Pas de Fathom", [BASE], "NON SQL", fathom="non"),
    run("O. Appel non tenu", [mk(appel={"appel_tenu": {"valeur": "non"}, "motif_non_tenu": {"valeur": "replay_non_vu"}})],
        "MQL EN ATTENTE"),
    run("P. Écart avec la saisie", [BASE], "SQL GAGNÉ", "Écart avec la saisie",
        saisie_issue="Pas pitché", saisie_outcome="Pas qualifié"),
    run("Q. 'Pas les fonds' sans ressource ni situation bloquante",
        [mk(financement__ressources_citees=[], financement__objection_fonds={"valeur": "oui"})],
        "À REVOIR", "renvoyé la personne"),
    run("R. Refus explicite", [mk(vente__issue={"valeur": "aucun"}, vente__refus_explicite={"valeur": "oui"})], "SQL PERDU"),
]
print(f"\n{sum(res)}/{len(res)} tests OK")
sys.exit(0 if all(res) else 1)
