"""Worker: crm_ca_config.engine = 'lite' (035) runs call-analysis/lite; anything else runs the reference engine."""
import sys
from pathlib import Path

import pytest

from lnp_analyse.noyau.client_modele import ClientSimule
from executant_analyse.passerelle import ClientPasserelle
from executant_analyse.travail import ErreursModele, moteur_de, version_moteur, executer_travail, resume
from test_executant import PALIERS, prise, ouverture_depuis

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "allege" / "tests"))
import appel_synthetique as sc  # noqa: E402  (fictional call of the lite tests)


def affirmation_allegee():
    return prise(transcript=sc.transcription(), speaker_map=sc.LOCUTEURS,
                 config={"tiers": PALIERS, "passes": 3, "engine": "lite"})


def test_le_travail_envoie_engine_lite_au_moteur_allege():
    from analyse_allegee.etapes import ClientAllegeSimule
    c = affirmation_allegee()
    client = ClientAllegeSimule(sc.REPONSES)
    enr = executer_travail(c, client, tours_lot=True, executants=24)
    assert enr["meta"]["engine"] == "lite" and moteur_de(c) == "lite" and version_moteur(c) == "callqa-lite-1.0"
    assert {x["task"] for x in client.appels} == {"lite.s0_phases", "lite.s1_discovery", "lite.s2_gap", "lite.s3_pitch",
                                                  "lite.s4_objections"}
    assert all(x["tier"] == "fast" and x["effort"] == "low" for x in client.appels)
    assert set(enr["results"]) == {"SPIN", "GAP", "PITCH", "OBJECTIONS"} and enr["results"]["GAP"]["verdict"] == "present"
    assert resume(enr).startswith("engine=lite ") and "Alex" not in resume(enr)


def test_moteur_complet_inchange_sans_le_choix():
    assert moteur_de(prise()) == "full" and version_moteur(prise()) == "lnp_callqa-1.0"
    assert moteur_de(prise(config={"tiers": PALIERS, "passes": 3, "engine": "full"})) == "full"
    enr = executer_travail(prise(), ClientSimule(repli=lambda *a: {}))
    assert "meta" not in enr and set(enr["results"]) == {"SPIN", "GAP", "PITCH", "OBJECTIONS"}


def test_un_echec_du_modele_allege_arrete_le_travail_pour_de_bon():
    from analyse_allegee.etapes import ClientAllegeSimule
    with pytest.raises(ErreursModele) as e:
        executer_travail(affirmation_allegee(), ClientAllegeSimule({"lite.s0_phases": "not json"}))
    assert e.value.final and "S0" in str(e.value)


def test_la_passerelle_envoie_la_transcription_en_prefixe_en_cache():
    op, vus = ouverture_depuis([(200, {"text": "{\"turns\": []}", "stop_reason": "end_turn",
                                   "usage": {"input_tokens": 900, "output_tokens": 40,
                                             "cache_creation_input_tokens": 15000}})])
    g = ClientPasserelle("https://x/f", "k", PALIERS, ouverture=op, dormir=lambda s: None, effort="none")
    sortie = g.completer("lite.s0_phases", "call", "fast", "SYSTEM", "T001 [SALES] Hello", "STEP", 6000, "low")
    assert sortie == {"text": "{\"turns\": []}", "stop_reason": "end_turn"}
    assert vus[0] == {"model": "claude-haiku-5-5", "system": "SYSTEM", "prefix": "T001 [SALES] Hello", "prompt": "STEP",
                       "max_tokens": 6000, "effort": "low", "cache_prompt": False}
    assert g.conso["fast"]["cache_creation_input_tokens"] == 15000 and g.conso["fast"]["calls"] == 1


def test_la_boucle_stocke_un_enregistrement_allege_avec_sa_version(monkeypatch):
    import executer as loop
    from analyse_allegee.etapes import ClientAllegeSimule
    stocke = []

    class FausseBase:
        def __init__(self, *a):
            self.prises = [affirmation_allegee()]

        def rpc(self, nom_, args):
            if nom_ == "crm_ca_claim":
                return self.prises.pop(0) if self.prises else None
            stocke.append((nom_, args))
            return {}

    class FauxClient(ClientAllegeSimule):
        def __init__(self, *a, **k):
            super().__init__(sc.REPONSES)
            self.effort = k.get("effort")

    monkeypatch.setenv("SUPABASE_URL", "https://x.supabase.co")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "k")
    monkeypatch.setattr(loop, "Supabase", FausseBase)
    monkeypatch.setattr(loop, "ClientPasserelle", FauxClient)
    monkeypatch.setattr("sys.argv", ["run.py"])
    assert loop.principal() == 0
    nom_, args = [x for x in stocke if x[0] == "crm_ca_store"][0]   # an R1: crm_qualif_context comes first (046)
    assert nom_ == "crm_ca_store" and args["p_engine"] == "callqa-lite-1.0"
    assert args["p_record"]["meta"]["engine"] == "lite"
    assert args["p_usage"]["engine"] == "lite" and args["p_usage"]["effort"] == "low"
