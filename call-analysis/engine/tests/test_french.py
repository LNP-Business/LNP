"""The code's checks on French calls (LNP, 2026-11-19). The cases come from the audit of the six analysed calls of
November 2026 (no real data: the sentences are rewritten); each English behaviour is kept."""
import re

from lnp_callqa.competences import gap as G
from lnp_callqa.competences import objections as O
from lnp_callqa.competences import spin as S
from lnp_callqa.core import text as T


# ---------------------------------------------------------------- words and the verbatim rule (GB-22)
def test_accented_letters_stay_in_the_word():
    assert T.clean_tokens("je suis épuisée") == ["je", "suis", "épuisée"]          # was "puis" + "e"
    assert T.clean_tokens("j'ai envie d'être là") == ["j'", "ai", "envie", "d'", "être", "là"]


def test_a_french_function_word_is_not_a_key_expression():
    assert T.key_expression_ok("de", "je suis dépendante de ma mère", "tu veux sortir de là") == (False, "generic")
    assert T.key_expression_ok("d'être à", "contente d'être à la maison", "envie d'être très libre")[0] is False


def test_the_person_shift_works_in_french():
    assert T.key_expression_ok("je suis dépendante", "je suis dépendante de ma mère", "tu es dépendante de ta maman")[0]
    assert T.key_expression_ok("ça me bloque", "ça me bloque complètement", "et ça te bloque")[0]
    assert T.key_expression_ok("j'ai peur", "j'ai peur de me lancer", "t'as peur de te lancer")[0]


def test_english_is_read_as_before():
    assert T.key_expression_ok("I feel stuck", "I feel stuck all the time", "you feel stuck")[0]
    assert T.key_expression_ok("my clients", "my clients never pay", "your clients never pay")[0]


def test_french_numbers():
    assert T.key_expression_ok("deux mille euros", "je veux deux mille euros par mois", "tu veux 2000 euros")[0]
    assert T.key_expression_ok("1 500 euros", "arriver à 1 500 euros", "arriver à 1500 euros")[0]


def test_a_french_agreement_is_an_approval_only():
    assert T.approval_only("Oui, d'accord.") and T.approval_only("Oui, c'est ça, exactement")
    assert not T.approval_only("oui mais je dois réfléchir")


# ---------------------------------------------------------------- SPIN
def test_french_function_words_do_not_make_a_follow_up():
    assert not S.follows_up("Je donne des cours pour des organismes avec mes élèves",
                            "Et pour toi, avec ton mari, comment ça se passe ?")
    assert S.follows_up("Je donne des cours pour des organismes", "Et ces organismes, ils te paient bien ?")


def test_french_question_forms_and_tails():
    assert S.question_form("dis-moi un peu ta situation") == "imperative"
    assert S.question_form("Est-ce que tu as déjà des élèves") == "interrogative_no_mark"
    assert any(re.search(p, "tu veux 2000 euros, c'est ça ?") for p in S.TAILS)
    assert S.TAIL_ONLY.match("Non ?")


def test_french_register_words():
    assert S.lexicon_registers("Et pourquoi vous voulez reprendre une activité à temps plein ?") == {"time_load"}
    assert S.lexicon_registers("des bons revenus, c'est nécessaire") == {"financial"}     # not « rêve »
    assert S.lexicon_registers("je suis heureux") == set()                                # not « heure »
    assert S.lexicon_registers("je suis épuisée le soir") == {"mental_emotional"}


# ---------------------------------------------------------------- Gap
def test_french_openers_and_validation_requests():
    assert G.OPENERS.search("si je résume, aujourd'hui tu es à 300 euros")
    assert G.VALIDATION_REQUEST.search("c'est bien ça ?")
    assert G.STOPPING_Q.search("qu'est-ce qui te bloque aujourd'hui ?")


def test_an_offer_word_before_the_restatement_does_not_cut_it():
    """GB-1: the restitution starts at its first component statement; « notre accompagnement » said before it in the
    same turn does not end it (Anastasia's call, T065)."""
    from lnp_callqa.core.models import CallContext, Turn
    t1 = Turn("T001", 1, "00:01", "Commercial", "SALES",
              "Dans notre accompagnement, on préconise 4 heures. En fait, je comprends que tu es dépendante de ta maman.")
    ctx = CallContext("c", "s", "2026-11-01T10:00:00Z", "Europe/Paris", [t1])
    span = G.Span("T001", "T001", ["T001"], ["S1"])
    start = G.first_statement(ctx, [{"sales_turn": "T001", "sales_quote": "tu es dépendante de ta maman"}])
    assert start and start[0] == "T001"
    assert G.offer_cut(ctx, span, start) is None
    assert G.offer_cut(ctx, span) is not None                     # without the start: the old reading


# ---------------------------------------------------------------- Objections
def test_french_objection_markers_and_contradiction():
    kinds = {k for k, rx in O._MARKER_RE if rx.search("c'est un peu cher pour moi")}
    assert "objection_price_money" in kinds
    assert O.CONTRADICTION_RE.search("Non, en fait ce n'est pas le cas")
