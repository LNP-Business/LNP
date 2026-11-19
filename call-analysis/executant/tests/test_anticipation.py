"""Parallel rounds (prefetch.py) give exactly the sequential result, with no extra model question."""
import json
import os
import re
from pathlib import Path

import pytest

from lnp_analyse.noyau.client_modele import ClientSimule
from lnp_analyse.noyau.modeles import ContexteAppel, Preuve, Tour, COMMERCIAL
from lnp_analyse.noyau.executeur import Executeur
from lnp_analyse.chaine_analyse import analyser_appel, enregistrement_resultat
from executant_analyse.anticipation import ClientAnticipe, analyser_par_tours
from tests.test_executant import prise
from executant_analyse.travail import executer_travail

EXECUTIONS = Path(os.environ.get("CALLQA_CORPUS", str(Path(__file__).resolve().parents[2] / "moteur" / "tests" / "fixtures" / "transcripts")))
reel = pytest.mark.skipif(not (EXECUTIONS / "001").exists(), reason="real transcripts not available")


class Comptage(ClientSimule):
    def __init__(self, **k):
        super().__init__(**k)
        self.cles = set()

    def demander(self, id_tache, id_unite, palier, systeme, consigne, no_passe):
        self.cles.add((id_tache, id_unite, no_passe, hash(consigne)))
        return super().demander(id_tache, id_unite, palier, systeme, consigne, no_passe)


def depouiller(enr):
    enr = json.loads(json.dumps(enr, default=str))
    enr.pop("audit", None)
    return enr


def charger(appel_):
    tours = []
    for ligne in (EXECUTIONS / appel_ / "transcript_compact.txt").read_text().splitlines():
        m = re.match(r"\[T(\d+) ([^\]]*)\] (\w+): (.*)", ligne)
        if m:
            tours.append(Tour(f"T{int(m.group(1)):03d}", int(m.group(1)), m.group(2), m.group(3), m.group(3), m.group(4)))
    return ContexteAppel(appel_, "valentino", "2026-06-18T15:00:00Z", "Asia/Dubai", tours, {"price": 5800})


def test_appel_synthetique_meme_enregistrement_par_tours():
    seq = executer_travail(prise(), ClientSimule(repli=lambda *a: {}))
    par = executer_travail(prise(), ClientSimule(repli=lambda *a: {}), tours_lot=True, executants=4)
    assert depouiller(seq) == depouiller(par)


@reel
def test_appel_reel_meme_enregistrement_sans_question_de_plus():
    a, b = Comptage(repli=lambda *x: {}), Comptage(repli=lambda *x: {})
    ctx = charger("001")
    analyser_appel(ctx, Executeur(a))
    seq = enregistrement_resultat(ctx)
    journal = []
    ctx2 = analyser_par_tours(lambda: charger("001"), lambda c, cl: analyser_appel(c, Executeur(cl)), ClientAnticipe(b), 8, journal=journal.append)
    assert depouiller(seq) == depouiller(enregistrement_resultat(ctx2))
    assert b.cles == a.cles, "the rounds ask exactly the questions of the sequential run"
    assert len(journal) < len(a.cles) / 3, "questions go in batches"
    assert [e for e in ctx2.audit if "EnAttente" in str(e.get("error", ""))] == []


@reel
def test_presentation_reelle_meme_resultat_par_tours():
    """Same scenario as the engine's test_real_001_full_run (answers that pass the quote checks)."""
    from lnp_analyse.competences import presentation as P
    from aides_tests_moteur import presentation_001_preparation
    ctx0, reponses = presentation_001_preparation(charger)
    seq = P.CompetencePresentation().executer(ctx0, Executeur(ClientSimule(reponses=reponses, repli=lambda *x: {})))
    sortie = {}

    def executer(c, cl):
        sortie["r"] = P.CompetencePresentation().executer(c, Executeur(cl))
    analyser_par_tours(lambda: presentation_001_preparation(charger)[0], executer, ClientAnticipe(ClientSimule(reponses=reponses, repli=lambda *x: {})), 8)
    assert json.dumps(sortie["r"].vers_dict(), default=str, sort_keys=True) == json.dumps(seq.vers_dict(), default=str, sort_keys=True)
    assert seq.verdict == "compliant" and seq.details["validated_P"]["category"] == "Acquisition"


def test_le_budget_de_temps_arrete_pour_de_bon():
    from executant_analyse.anticipation import TropLong
    with pytest.raises(TropLong):
        executer_travail(prise(), ClientSimule(repli=lambda *a: {}), tours_lot=True, executants=2, budget_s=-1)


def test_une_demande_refusee_arrete_le_travail_sans_enregistrement_vide():
    from executant_analyse.passerelle import ErreurPasserelle
    from executant_analyse.travail import ErreursModele

    def refuse(*a):
        raise ErreurPasserelle("HTTP 502 400 invalid_request_error `temperature` is deprecated for this model.", final=True)
    with pytest.raises(ErreurPasserelle):
        executer_travail(prise(), ClientSimule(repli=refuse), tours_lot=True, executants=2)

    def instable(*a):
        raise ErreurPasserelle("model gateway unavailable: HTTP 503")
    with pytest.raises(ErreursModele):
        executer_travail(prise(), ClientSimule(repli=instable), tours_lot=True, executants=2)


def test_la_passe_1_part_avant_les_passes_2_et_3():
    """The provider caches pass 1's prompt; passes 2 and 3 go after it so they read it from the cache."""
    import threading
    ordre, verrou = [], threading.Lock()

    class Enr:
        def demander(self, id_tache, id_unite, palier, systeme, consigne, no_passe):
            with verrou:
                ordre.append(no_passe)
            return {}
    c = ClientAnticipe(Enr())
    for u in ("a", "b"):
        for p in (3, 2, 1):
            try:
                c.demander("spin.gates", u, "strong", "S", "P" + u, p)
            except Exception:  # noqa: BLE001 - Pending
                pass
    c.recuperer(c.lot_suivant(), 8)
    assert sorted(ordre[:2]) == [1, 1] and sorted(ordre[2:]) == [2, 2, 3, 3]
    assert len(c.cache) == 6

