"""End-to-end smoke test: the full pipeline on a real transcript, with a model that finds nothing.
Checks the fixed stage order, the shared state and that no competence crashes."""
import os
import re
from pathlib import Path

from lnp_analyse.noyau.client_modele import ClientSimule
from lnp_analyse.noyau.modeles import ContexteAppel, Tour
from lnp_analyse.noyau.executeur import Executeur
from lnp_analyse.chaine_analyse import analyser_appel, enregistrement_resultat

EXECUTIONS = Path(os.environ.get("CALLQA_CORPUS", str(Path(__file__).parent / "fixtures" / "transcripts")))


def charger(appel_):
    tours = []
    for ligne in (EXECUTIONS / appel_ / "transcript_compact.txt").read_text().splitlines():
        m = re.match(r"\[T(\d+) ([^\]]*)\] (\w+): (.*)", ligne)
        if m:
            tours.append(Tour(f"T{int(m.group(1)):03d}", int(m.group(1)), m.group(2), m.group(3), m.group(3), m.group(4)))
    return ContexteAppel(appel_, "valentino", "2026-06-18T15:00:00Z", "Asia/Dubai", tours, {"price": 5800})


def test_l_analyse_tourne_de_bout_en_bout_sans_erreur_moteur():
    ctx = charger("001")
    ordre = []
    def fb(tache, unite, consigne, p):
        if not ordre or ordre[-1] != tache.split(".")[0]:
            ordre.append(tache.split(".")[0])
        return {}
    analyser_appel(ctx, Executeur(ClientSimule(repli=fb)))
    assert set(ctx.resultats) == {"SPIN", "GAP", "PITCH", "OBJECTIONS"}
    assert all(r.raisons != ["engine_error"] for r in ctx.resultats.values())
    assert ordre[0] == "foundation" and ordre.index("spin") < ordre.index("gap")
    enr = enregistrement_resultat(ctx)
    assert enr["results"]["GAP"]["verdict"] == "absent"          # nothing found -> no restitution
    assert enr["audit"], "every model pass is audited"


def test_diarisation_suspecte_exclut_toutes_les_competences():
    ctx = charger("001")
    for t in ctx.tours:
        t.role = "SALES"
    analyser_appel(ctx, Executeur(ClientSimule(repli=lambda *a: {})))
    assert ctx.statut == "no_diarization"
    assert all(r.statut == "excluded" for r in ctx.resultats.values())
