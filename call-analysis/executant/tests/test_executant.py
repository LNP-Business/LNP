"""Worker: model gateway client, claim → context → call record, and the loop (no network, no real transcript)."""
import io
import json
import urllib.error

import pytest

from lnp_analyse.noyau.client_modele import ClientSimule
from lnp_analyse.noyau.executeur import ConfigExecution
from executant_analyse.passerelle import ClientPasserelle, ErreurPasserelle
from executant_analyse.travail import construire_contexte, bibliotheque_cas, entrees_anterieures, executer_travail, resume

PALIERS = {"fast": "claude-haiku-5-5", "strong": "claude-sonnet-5-5", "arbiter": "claude-opus-5-5"}


def transcription_synthetique() -> str:
    """A fictional call (no real prospect): enough words on both sides to pass the diarization gate."""
    lignes = []
    for i in range(40):
        m, s = divmod(i * 20, 60)
        if i % 2 == 0:
            lignes.append(f"[{m:02d}:{s:02d}] Sam Rep: Question number {i}, can you tell me more about how your business works today?")
        else:
            lignes.append(f"[{m:02d}:{s:02d}] Alex Lead: Answer {i}, I sell some design work but I would like more clients and a steadier income every month.")
    return "\n".join(lignes)


def prise(**surcharge):
    c = {"job": "j1", "attempt": 1, "transcript": transcription_synthetique(),
         "speaker_map": {"Sam Rep": "SALES", "Alex Lead": "PROSPECT"},
         "call": {"call_id": "c1", "sales_id": "valentino", "start_utc": "2026-10-20T15:00:00+00:00", "timezone": "Asia/Dubai", "sales_round": 1},
         "config": {"tiers": PALIERS, "passes": 3}, "offer_reference": {}, "case_library": [], "prior": []}
    c.update(surcharge)
    return c


class FausseReponse(io.BytesIO):
    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


def ouverture_depuis(reponses):
    """answers: list of (status, body); 200 bodies are returned, others raised as HTTPError."""
    vus = []

    def op(dem, timeout=None):
        vus.append(json.loads(dem.data))
        statut, corps = reponses.pop(0)
        if statut == 200:
            return FausseReponse(json.dumps(corps).encode())
        raise urllib.error.HTTPError(dem.full_url, statut, "x", {}, io.BytesIO(json.dumps(corps).encode()))
    return op, vus


def test_la_passerelle_envoie_le_modele_du_palier_et_compte_la_conso():
    op, vus = ouverture_depuis([(200, {"text": "ok {\"found\": false}", "usage": {"input_tokens": 100, "output_tokens": 5, "cache_read_input_tokens": 80}})])
    g = ClientPasserelle("https://x/functions/v1/callqa-llm", "k", PALIERS, ouverture=op, dormir=lambda s: None)
    assert g.demander("spin.gates", "sol:T001", "strong", "RULES", "UNIT", 1) == {"found": False}
    assert vus[0]["model"] == "claude-sonnet-5-5" and "temperature" not in vus[0] and vus[0]["system"] == "RULES"
    assert g.conso["strong"] == {"calls": 1, "input_tokens": 100, "output_tokens": 5, "cache_read_input_tokens": 80, "cache_creation_input_tokens": 0}
    assert vus[0]["effort"] == "low" and vus[0]["cache_prompt"] is True, "a pass: low effort, question cached"


def test_la_passerelle_effort_none_coupe_la_reflexion_sauf_la_fondation():
    # LNP (2026-11-03, under 10 cents a call): effort "none" on every question, the register included; the foundation keeps
    # its default
    op, vus = ouverture_depuis([(200, {"text": "{}"})] * 3)
    g = ClientPasserelle("https://x/f", "k", PALIERS, ouverture=op, dormir=lambda s: None, effort="none", passes=1)
    g.demander("spin.gates", "sol:T001", "fast", "s", "p", 1)
    g.demander("spin.register", "register:Q1", "fast", "s", "p", 1)
    g.demander("foundation.phases", "chunk:1", "fast", "s", "p", 1)
    assert [s["effort"] for s in vus] == ["none", "none", "default"]


def test_la_passerelle_met_en_cache_une_question_seulement_si_une_autre_passe_la_pose():
    op, vus = ouverture_depuis([(200, {"text": "{}"})] * 2)
    ClientPasserelle("https://x/f", "k", PALIERS, ouverture=op, dormir=lambda s: None, passes=1).demander("t", "u", "fast", "s", "p", 1)
    ClientPasserelle("https://x/f", "k", PALIERS, ouverture=op, dormir=lambda s: None, passes=3).demander("t", "u", "fast", "s", "p", 1)
    assert [s["cache_prompt"] for s in vus] == [False, True]


def test_la_passerelle_garde_le_defaut_du_modele_pour_la_fondation():
    op, vus = ouverture_depuis([(200, {"text": "{}"})])
    ClientPasserelle("https://x/f", "k", PALIERS, ouverture=op, dormir=lambda s: None).demander("foundation.attribution", "chunk:1", "fast", "s", "p", 1)
    assert vus[0]["effort"] == "default"


def test_la_passerelle_demande_le_registre_en_effort_moyen():
    op, vus = ouverture_depuis([(200, {"text": "{}"})])
    ClientPasserelle("https://x/f", "k", PALIERS, ouverture=op, dormir=lambda s: None).demander("spin.register", "register:Q1", "fast", "s", "p", 1)
    assert vus[0]["effort"] == "medium"


def test_la_passerelle_ne_met_pas_en_cache_un_arbitrage():
    op, vus = ouverture_depuis([(200, {"text": "{}"})])
    ClientPasserelle("https://x/f", "k", PALIERS, ouverture=op, dormir=lambda s: None, effort="medium").demander("t", "u", "arbiter", "s", "p", 0)
    assert vus[0]["cache_prompt"] is False and vus[0]["effort"] == "medium"


def test_la_passerelle_reessaie_si_occupee_et_s_arrete_sans_cle():
    op, _ = ouverture_depuis([(503, {"error": "busy", "retry": True}), (200, {"text": "{\"a\": 1}", "usage": {}})])
    g = ClientPasserelle("https://x/f", "k", PALIERS, ouverture=op, dormir=lambda s: None)
    assert g.demander("t", "u", "fast", "s", "p", 1) == {"a": 1}
    op, _ = ouverture_depuis([(409, {"error": "ANTHROPIC_API_KEY is not set"})])
    with pytest.raises(ErreurPasserelle) as e:
        ClientPasserelle("https://x/f", "k", PALIERS, ouverture=op, dormir=lambda s: None).demander("t", "u", "fast", "s", "p", 1)
    assert e.value.final and "ANTHROPIC_API_KEY" in str(e.value)
    with pytest.raises(ErreurPasserelle) as e:
        ClientPasserelle("https://x/f", "k", {"fast": "x"})
    assert e.value.final


def test_contexte_depuis_l_affirmation():
    ctx = construire_contexte(prise(case_library=[{"id": "a", "title": "Case", "consent": True, "start_value": 2000, "start_unit": "USD/month",
                                             "start_profile": "designer", "figures": {"after": 8000}}],
                              prior=[{"call_id": "c0", "results": {"OBJECTIONS": {"episodes": [{"start": "T010"}]}}}]))
    assert len(ctx.tours) == 40 and ctx.tours[0].role == "SALES" and ctx.tours[1].role == "PROSPECT"
    assert ctx.bibliotheque_cas[0]["start"] == {"value": 2000, "unit": "USD/month", "profile": "designer"} and ctx.bibliotheque_cas[0]["consent"]
    assert ctx.entrees_anterieures == [{"kind": "objections_episodes", "call_id": "c0", "episodes": [{"start": "T010"}]}]
    assert bibliotheque_cas(None) == [] and entrees_anterieures([{"results": {}}]) == []


def test_le_travail_donne_un_enregistrement_complet_et_les_passes_paralleles_ne_changent_rien():
    enr_par = executer_travail(prise(), ClientSimule(repli=lambda *a: {}))
    enr_seq = executer_travail(prise(), ClientSimule(repli=lambda *a: {}), ConfigExecution(passes=3, passes_paralleles=False))
    assert set(enr_par["results"]) == {"SPIN", "GAP", "PITCH", "OBJECTIONS"}
    assert all(r["rules_version"] for r in enr_par["results"].values())
    depouiller = lambda r: {k: {kk: vv for kk, vv in v.items()} for k, v in r["results"].items()}
    assert depouiller(enr_par) == depouiller(enr_seq)
    json.dumps(enr_par, default=str)                     # what crm_ca_store receives
    assert "status=ok" in resume(enr_par) and "Alex" not in resume(enr_par)


def test_appel_suspect_ou_non_attribue_exclu_sans_plantage():
    enr = executer_travail(prise(speaker_map={"Sam Rep": "SALES", "Alex Lead": "SALES"}), ClientSimule(repli=lambda *a: {}))
    assert enr["status"] == "no_diarization" and all(r["status"] == "excluded" for r in enr["results"].values())


def test_la_boucle_stocke_ou_echoue(monkeypatch):
    import executer as loop
    appels = []

    class FausseBase:
        def __init__(self, *a):
            self.prises = [prise()]

        def rpc(self, nom_, args):
            appels.append(nom_)
            if nom_ == "crm_ca_claim":
                return self.prises.pop(0) if self.prises else None
            return {}

    class FauxClient(ClientSimule):
        def __init__(self, *a, **k):
            super().__init__(repli=lambda *x: {})
            self.conso = {}

    monkeypatch.setenv("SUPABASE_URL", "https://x.supabase.co")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "k")
    monkeypatch.setattr(loop, "Supabase", FausseBase)
    monkeypatch.setattr(loop, "ClientPasserelle", FauxClient)
    monkeypatch.setattr("sys.argv", ["run.py"])
    assert loop.principal() == 0
    assert appels == ["crm_ca_claim", "crm_qualif_context", "crm_ca_store", "crm_ca_claim"]  # an R1: qualified too (046)
    appels.clear()

    def boum(*a, **k):
        raise ErreurPasserelle("ANTHROPIC_API_KEY is not set", final=True)
    monkeypatch.setattr(loop, "ClientPasserelle", boum)
    assert loop.principal() == 0
    assert appels == ["crm_ca_claim", "crm_ca_fail", "crm_ca_claim"]


def test_la_passerelle_s_arrete_sur_une_demande_refusee():
    op, _ = ouverture_depuis([(502, {"error": "400 invalid_request_error temperature is deprecated", "retry": False})])
    with pytest.raises(ErreurPasserelle) as e:
        ClientPasserelle("https://x/f", "k", PALIERS, ouverture=op, dormir=lambda s: None).demander("t", "u", "fast", "s", "p", 1)
    assert e.value.final and "deprecated" in str(e.value)
