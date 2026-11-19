"""Lead qualification agent: transcript, evidence check, double reading, rule (no network, no real data)."""
import copy
import json
import subprocess
import sys
from pathlib import Path

ICI = Path(__file__).resolve().parent
sys.path.insert(0, str(ICI.parent))

from agent import qualifier_appel, citation_trouvee, afficher_transcription, verifier, _norm  # noqa: E402

U = [
    {"text": "Bonjour Claire !", "speaker": {"display_name": "Sam - Les Nouveaux Profs", "matched_calendar_invitee_email": "sam@lesnouveauxprofs.fr"}, "timestamp": "00:00:05"},
    {"text": "Bonjour. Je suis prof de maths au collège depuis 12 ans.", "speaker": {"display_name": "Claire", "matched_calendar_invitee_email": "claire@x.test"}, "timestamp": "00:02:10"},
    {"text": "Je suis épuisée, je veux continuer à enseigner mais à mon compte.", "speaker": {"display_name": "Claire"}, "timestamp": "00:05:00"},
    {"text": "Je vise 2 500 € par mois d'ici juin.", "speaker": {"display_name": "Claire"}, "timestamp": "00:09:00"},
    {"text": "J'ai un peu d'épargne. C'est moi qui décide, et je peux commencer dès le mois prochain.", "speaker": {"display_name": "Claire"}, "timestamp": "01:02:10"},
]
FAITS = json.loads((ICI / "fixture_facts.json").read_text(encoding="utf-8"))


class Bouchon:
    def __init__(self, reponses):
        self.reponses, self.appels = list(reponses), []

    def completer(self, id_tache, id_unite, palier, systeme, prefixe, consigne, max_tokens=8000, effort="low"):
        self.appels.append((palier, prefixe, consigne))
        return {"text": self.reponses.pop(0)}


def appel_(**kw):
    c = {"call_id": "k1", "date_appel": "2026-11-04", "transcript": U, "recorded_by": "sam@lesnouveauxprofs.fr",
         "saisie": {"outcome": None, "no_sale_reason": None}}
    c.update(kw)
    return c


def test_le_script_des_regles_passe_ses_19_cas():
    r = subprocess.run([sys.executable, str(ICI / "verifier_regles.py")], capture_output=True, text=True)
    assert r.returncode == 0, r.stdout[-500:]


def test_lignes_roles_et_minutage_de_la_transcription():
    t = afficher_transcription(U, "sam@lesnouveauxprofs.fr")
    lignes = t.split("\n")
    assert lignes[0].startswith("[00:05] SALES (Sam - Les Nouveaux Profs): Bonjour Claire")
    assert lignes[1].startswith("[02:10] PROSPECT (Claire): Bonjour. Je suis prof")      # turns of one speaker merged
    assert "J'ai un peu d'épargne" in lignes[1] and len(lignes) == 2
    assert "[62:10]" not in t                                                            # merged into the earlier turn


def test_verif_citation_normalise_sans_jamais_inventer():
    tn = _norm(afficher_transcription(U))
    assert citation_trouvee("prof de maths au collège", tn)
    assert citation_trouvee("je suis épuisée ... à mon compte", tn)
    assert not citation_trouvee("j'ai un prêt de ma banque", tn)
    # small corrections of the transcription pass (a word added or dropped), another sentence does not
    assert citation_trouvee("Je suis prof de maths au collège depuis 12 ans", tn)
    assert citation_trouvee("je suis vraiment prof de maths au collège depuis 12 ans", tn)
    assert not citation_trouvee("je suis prof de français au lycée depuis 3 ans", tn)


def test_un_fait_sans_citation_redevient_inconnu():
    f = copy.deepcopy(FAITS)
    f["decision"]["decideur"]["preuve"] = "mon mari décide de tout"          # invented
    f["financement"]["ressources_citees"].append({"type": "pret", "preuve": "la banque me prête 5000"})
    sortie, remarques = verifier(f, afficher_transcription(U))
    assert sortie["decision"]["decideur"]["valeur"] == "inconnu"
    assert [r["type"] for r in sortie["financement"]["ressources_citees"]] == ["epargne"]
    assert len(remarques) == 2


def test_double_lecture_puis_regle_sql_gagnee():
    bouchon = Bouchon([json.dumps(FAITS), json.dumps(FAITS)])
    sortie = qualifier_appel(appel_(), bouchon)
    assert sortie["status"] == "SQL GAGNÉ" and sortie["result"]["base"]["outcome"] == "Deposit"
    assert [c[0] for c in bouchon.appels] == ["fast", "strong"] and bouchon.appels[0][1] == bouchon.appels[1][1]   # same cached prefix
    assert "<transcription>" in bouchon.appels[0][1] and "{{" not in bouchon.appels[0][2]


def test_des_lectures_en_desaccord_mettent_l_appel_a_revoir():
    autre = copy.deepcopy(FAITS)
    autre["financement"]["ressources_citees"] = []
    autre["financement"]["situation_bloquante"] = {"valeur": "rsa"}
    sortie = qualifier_appel(appel_(), Bouchon([json.dumps(FAITS), json.dumps(autre)]))
    assert sortie["status"] == "À REVOIR" and any("Désaccord" in a for a in sortie["result"]["alertes"])


def test_sans_enregistrement_fathom_non_sql_sans_appel_au_modele():
    bouchon = Bouchon([])
    sortie = qualifier_appel(appel_(transcript=None), bouchon)
    assert sortie["status"] == "NON SQL" and sortie["result"]["base"]["motif"] == "Pas d'enregistrement Fathom" and not bouchon.appels


def test_un_ecart_avec_la_saisie_iclosed_est_signale():
    sortie = qualifier_appel(appel_(saisie={"outcome": "NO_SALE", "no_sale_reason": "UNQUALIFIED"}),
                       Bouchon([json.dumps(FAITS), json.dumps(FAITS)]))
    assert any("Écart avec la saisie" in a for a in sortie["result"]["alertes"])


def test_une_reponse_illisible_est_redemandee():
    sortie = qualifier_appel(appel_(), Bouchon(["pas du json", json.dumps(FAITS), json.dumps(FAITS)]))
    assert sortie["status"] == "SQL GAGNÉ"


def test_le_script_de_l_executant_s_importe():
    r = subprocess.run([sys.executable, "-c", "import runpy, sys; sys.argv=['executer.py']; "
                        "import importlib.util as u; s=u.spec_from_file_location('r', %r); m=u.module_from_spec(s); s.loader.exec_module(m)"
                        % str(ICI.parent / "executer.py")], capture_output=True, text=True, env={"PATH": "/usr/bin:/bin"})
    assert r.returncode == 0, r.stderr[-500:]
