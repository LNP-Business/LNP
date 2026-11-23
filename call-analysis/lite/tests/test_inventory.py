"""SEG-1 (Romain, 2026-11-20): the code lists the questions, one item per sales turn read on its priority question; the
model reads every listed item. Fictional French call (no real person)."""
from callqa_lite.engine import DEFAULTS, inventory, run_s1
from callqa_lite.shim import Drops
from callqa_lite.steps import MockLiteClient, Steps
from lnp_callqa.core.foundation import parse_transcript
from lnp_callqa.core.models import CallContext

S, P = "Léa - Commerciale", "Julie Martin"
LINES = [
    (S, "Bonjour Julie. Combien d'élèves tu as aujourd'hui ? Et pourquoi ?"),
    (P, "J'en ai trois, parce que je n'ose pas me vendre."),
    (S, "Ah oui ?"),
    (P, "Oui, vraiment."),
    (S, "Tu fais quoi le soir ? Et qu'est-ce que tu voudrais dans un an ?"),
    (P, "Je voudrais vivre de mes cours."),
]


def ctx():
    raw = "\n".join(f"[00:{i:02d}:00] {w}: {t}" for i, (w, t) in enumerate(LINES))
    return CallContext("c", "s", "2026-11-20T10:00:00Z", "Europe/Paris", parse_transcript(raw, {S: "SALES", P: "PROSPECT"}))


def test_one_item_per_turn_and_no_backchannel():
    inv = inventory(ctx(), 0, 5)
    assert [(i["id"], i["quote"]) for i in inv] == [("Q001", "Combien d'élèves tu as aujourd'hui ?"),
                                                    ("Q005", "Et qu'est-ce que tu voudrais dans un an ?")]
    assert inv[0]["others"] == ["Et pourquoi ?"] and inv[1]["others"] == ["Tu fais quoi le soir ?"]


def run(answers):
    c = ctx()
    client = MockLiteClient({"lite.s1_discovery": answers})
    d = Drops()
    qs = run_s1(c, Steps(client, c), dict(DEFAULTS), d)
    return qs, client, d


def test_the_model_keeps_the_code_turn_and_question_and_a_forgotten_one_is_asked_again():
    first = {"questions": [{"id": "Q001", "turn": "T002", "quote": "autre chose", "letter": "S"}]}
    second = {"questions": [{"id": "Q005", "letter": "N"}]}
    qs, client, d = run([first, second])
    assert [c["unit"] for c in client.calls] == ["T001-T006", "T001-T006:missing"]
    assert "Q001 ·" not in client.calls[1]["prompt"].split("QUESTIONS LISTED")[1].split("Answer for")[0]
    assert [(q["id"], q["turn"], q["quote"], q["letter"]) for q in qs] == [
        ("Q001", "T001", "Combien d'élèves tu as aujourd'hui ?", "S"),
        ("Q005", "T005", "Et qu'est-ce que tu voudrais dans un an ?", "N")]
    assert qs[0]["grouped"] == ["Combien d'élèves tu as aujourd'hui ?", "Et pourquoi ?"]


def test_an_unread_question_is_counted_kept_for_the_gates_and_one_reading_per_turn():
    answer = {"questions": [{"id": "Q001", "letter": "S"},
                            {"turn": "T001", "quote": "Et pourquoi ?", "letter": "P"}]}   # a second item on the same turn
    qs, client, d = run([answer, answer])
    assert [q["id"] for q in qs] == ["Q001", "Q005"] and qs[0]["letter"] == "S"
    assert qs[1]["s1_unread"] and "letter" not in qs[1]                            # C4: one reading never drops it
    assert qs[1]["quote"] == "Et qu'est-ce que tu voudrais dans un an ?"
    assert d.counts["S1"] == {"question:not_read": 1}                              # Q005, even after the second asking


def test_a_question_s1_routes_is_kept_for_the_gates():
    answer = {"questions": [{"id": "Q001", "letter": "S"}, {"id": "Q005", "routing": "validation_request"}]}
    qs, _, d = run([answer])
    assert [(q["id"], q.get("s1_routing")) for q in qs] == [("Q001", None), ("Q005", True)]
    assert d.counts["S1"] == {"question:routing_s1": 1}


def test_a_question_read_in_another_chunk_is_not_a_second_unit():
    c = ctx()
    first = {"questions": [{"id": "Q001", "letter": "S"},
                           {"turn": "T005", "quote": "Et qu'est-ce que tu voudrais dans un an ?", "letter": "N"}]}
    second = {"questions": [{"id": "Q005", "letter": "N"}]}
    client = MockLiteClient({"lite.s1_discovery": [first, second]})
    d = Drops()
    qs = run_s1(c, Steps(client, c), dict(DEFAULTS, s1_chunk_turns=3), d)
    assert [q["id"] for q in qs] == ["Q001", "Q005"] and not any(q.get("added_by_model") for q in qs)
    assert d.counts["S1"] == {"question:turn_of_another_chunk": 1}


def test_seg1_two_questions_the_model_adds_on_an_unpunctuated_turn_are_one():
    lines = [(S, "Bonjour Julie."), (P, "Bonjour."),
             (S, "je veux comprendre c'est quoi le projet en gros est ce que c'est vraiment ton projet de donner des cours"),
             (P, "Oui, l'enseignement me manque.")]
    raw = "\n".join(f"[00:{i:02d}:00] {w}: {t}" for i, (w, t) in enumerate(lines))
    c = CallContext("c", "s", "2026-11-20T10:00:00Z", "Europe/Paris", parse_transcript(raw, {S: "SALES", P: "PROSPECT"}))
    answer = {"questions": [{"turn": "T003", "quote": "c'est quoi le projet en gros", "letter": "S"},
                            {"turn": "T003", "quote": "est ce que c'est vraiment ton projet de donner des cours", "letter": "S"}]}
    d = Drops()
    qs = run_s1(c, Steps(MockLiteClient({"lite.s1_discovery": answer}), c), dict(DEFAULTS), d)
    assert [q["quote"] for q in qs] == ["est ce que c'est vraiment ton projet de donner des cours"]
    assert qs[0]["grouped"] == ["c'est quoi le projet en gros", "est ce que c'est vraiment ton projet de donner des cours"]
    assert d.counts["S1"] == {"question:same_turn_grouped": 1}


def test_a_listed_reading_without_turn_or_quote_lands_on_the_code_s_question():
    """Answers by ids (2026-11-23): the model no longer recopies the code's turn and quote for a listed question."""
    qs, client, _ = run([{"questions": [{"id": "Q001", "letter": "S"}, {"id": "Q005", "letter": "N"}]}])
    assert [(q["id"], q["turn"], q["quote"], q["letter"]) for q in qs] == [
        ("Q001", "T001", "Combien d'élèves tu as aujourd'hui ?", "S"),
        ("Q005", "T005", "Et qu'est-ce que tu voudrais dans un an ?", "N")]
    assert len(client.calls) == 1 and 'WITHOUT "turn" or "quote"' in client.calls[0]["prompt"]
