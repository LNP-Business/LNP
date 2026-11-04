"""Lead qualification agent: transcript, evidence check, double reading, rule (no network, no real data)."""
import copy
import json
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))

from agent import qualify_call, quote_found, render_transcript, verify, _norm  # noqa: E402

U = [
    {"text": "Bonjour Claire !", "speaker": {"display_name": "Sam - Les Nouveaux Profs", "matched_calendar_invitee_email": "sam@lesnouveauxprofs.fr"}, "timestamp": "00:00:05"},
    {"text": "Bonjour. Je suis prof de maths au collège depuis 12 ans.", "speaker": {"display_name": "Claire", "matched_calendar_invitee_email": "claire@x.test"}, "timestamp": "00:02:10"},
    {"text": "Je suis épuisée, je veux continuer à enseigner mais à mon compte.", "speaker": {"display_name": "Claire"}, "timestamp": "00:05:00"},
    {"text": "Je vise 2 500 € par mois d'ici juin.", "speaker": {"display_name": "Claire"}, "timestamp": "00:09:00"},
    {"text": "J'ai un peu d'épargne. C'est moi qui décide, et je peux commencer dès le mois prochain.", "speaker": {"display_name": "Claire"}, "timestamp": "01:02:10"},
]
FACTS = json.loads((HERE / "fixture_facts.json").read_text(encoding="utf-8"))


class Stub:
    def __init__(self, answers):
        self.answers, self.calls = list(answers), []

    def complete(self, task_id, unit_id, tier, system, prefix, prompt, max_tokens=8000, effort="low"):
        self.calls.append((tier, prefix, prompt))
        return {"text": self.answers.pop(0)}


def call(**kw):
    c = {"call_id": "k1", "date_appel": "2026-11-04", "transcript": U, "recorded_by": "sam@lesnouveauxprofs.fr",
         "saisie": {"outcome": None, "no_sale_reason": None}}
    c.update(kw)
    return c


def test_the_rules_script_passes_its_19_cases():
    r = subprocess.run([sys.executable, str(HERE / "check_rules.py")], capture_output=True, text=True)
    assert r.returncode == 0, r.stdout[-500:]


def test_transcript_lines_roles_and_minutage():
    t = render_transcript(U, "sam@lesnouveauxprofs.fr")
    lines = t.split("\n")
    assert lines[0].startswith("[00:05] SALES (Sam - Les Nouveaux Profs): Bonjour Claire")
    assert lines[1].startswith("[02:10] PROSPECT (Claire): Bonjour. Je suis prof")      # turns of one speaker merged
    assert "J'ai un peu d'épargne" in lines[1] and len(lines) == 2
    assert "[62:10]" not in t                                                            # merged into the earlier turn


def test_quote_check_normalises_but_never_invents():
    tn = _norm(render_transcript(U))
    assert quote_found("prof de maths au collège", tn)
    assert quote_found("je suis épuisée ... à mon compte", tn)
    assert not quote_found("j'ai un prêt de ma banque", tn)


def test_a_fact_without_its_quote_goes_back_to_unknown():
    f = copy.deepcopy(FACTS)
    f["decision"]["decideur"]["preuve"] = "mon mari décide de tout"          # invented
    f["financement"]["ressources_citees"].append({"type": "pret", "preuve": "la banque me prête 5000"})
    out, notes = verify(f, render_transcript(U))
    assert out["decision"]["decideur"]["valeur"] == "inconnu"
    assert [r["type"] for r in out["financement"]["ressources_citees"]] == ["epargne"]
    assert len(notes) == 2


def test_double_reading_then_rule_sql_won():
    stub = Stub([json.dumps(FACTS), json.dumps(FACTS)])
    out = qualify_call(call(), stub)
    assert out["status"] == "SQL GAGNÉ" and out["result"]["base"]["outcome"] == "Deposit"
    assert [c[0] for c in stub.calls] == ["fast", "strong"] and stub.calls[0][1] == stub.calls[1][1]   # same cached prefix
    assert "<transcription>" in stub.calls[0][1] and "{{" not in stub.calls[0][2]


def test_readings_that_disagree_send_the_call_to_review():
    other = copy.deepcopy(FACTS)
    other["financement"]["ressources_citees"] = []
    other["financement"]["situation_bloquante"] = {"valeur": "rsa"}
    out = qualify_call(call(), Stub([json.dumps(FACTS), json.dumps(other)]))
    assert out["status"] == "À REVOIR" and any("Désaccord" in a for a in out["result"]["alertes"])


def test_no_fathom_recording_is_non_sql_without_any_model_call():
    stub = Stub([])
    out = qualify_call(call(transcript=None), stub)
    assert out["status"] == "NON SQL" and out["result"]["base"]["motif"] == "Pas d'enregistrement Fathom" and not stub.calls


def test_a_gap_with_what_was_entered_in_iclosed_is_flagged():
    out = qualify_call(call(saisie={"outcome": "NO_SALE", "no_sale_reason": "UNQUALIFIED"}),
                       Stub([json.dumps(FACTS), json.dumps(FACTS)]))
    assert any("Écart avec la saisie" in a for a in out["result"]["alertes"])


def test_an_unreadable_answer_is_asked_again():
    out = qualify_call(call(), Stub(["pas du json", json.dumps(FACTS), json.dumps(FACTS)]))
    assert out["status"] == "SQL GAGNÉ"
