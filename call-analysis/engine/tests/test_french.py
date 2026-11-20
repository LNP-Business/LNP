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
    assert T.key_expression_ok("ça m'énerve", "franchement ça m'énerve", "et ça t'énerve")[0]
    assert T.key_expression_ok("my son", "my son is sick", "your son is sick")[0]          # « son » stays a content word


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


def test_dating_words_and_tics():
    """SB-30: « ça fait combien de temps » only dates the question; « tu vois ? » inside a question is a tic, not a tail."""
    assert S.lexicon_registers("ça fait combien de temps que tu donnes des cours ?") == set()        # not Time & load
    assert S.lexicon_registers("combien de temps tu passes avec tes enfants ?") == {"time_load"}
    assert not any(re.search(p, "qu'est-ce qui te manque pour que ça marche, tu vois ?") for p in S.TAILS)
    assert S.TAIL_ONLY.match("Tu vois ?")


def test_the_register_named_by_the_asked_part():
    """SB-27 / SB-28: the asked sentence and its last clause name the register, not the preamble."""
    assert S.lexicon_register_named("Et pourquoi vous voulez reprendre une activité à temps plein ?")[0] == "time_load"
    assert S.lexicon_register_named("Pour une professeure avec une carrière, c'est clair. toi, tu te sens comment ?") is None
    assert S.lexicon_register_named("Avec 2 000 euros, qu'est-ce que ça change pour toi ?") is None


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


def test_a_french_transition_after_a_receiving_marker_keeps_the_acknowledgement():
    """OB-13 (Romain, 2026-11-20): « mais » cancels the acknowledgement only when it contradicts."""
    rm = {"receiving_marker": True}
    assert O.acknowledged("Pas de souci, je t'entends, mais là, disons-nous les choses.", rm)       # a transition
    assert O.acknowledged("Je comprends, mais du coup, qu'est-ce qui te fait dire ça ?", rm)
    assert O.acknowledged("Ok, en fait, ce que tu me dis, c'est que le montant te fait peur.", rm)
    assert not O.acknowledged("Mais tu sais, c'est un investissement.", rm)                         # nothing received first
    assert not O.acknowledged("En fait, tu vas le rentabiliser en deux mois.", rm)
    assert not O.acknowledged("Je comprends, mais non, c'est pas cher quand tu compares.", rm)      # « mais non »
    assert not O.acknowledged("Je comprends, mais ce n'est pas une dépense, c'est un investissement.", rm)   # denial
    assert not O.acknowledged("Je t'entends, mais justement, c'est pour ça qu'il faut y aller.", rm)
    assert not O.acknowledged("Je comprends, mais ne t'inquiète pas, tout le monde y arrive.", rm)
    assert not O.acknowledged("Non, c'est faux, ça marche très bien.", rm)
    assert O.acknowledged("I hear you.", rm) and not O.acknowledged("I hear you, but think about it.", rm)   # English as written


def test_first_sentences_that_do_not_receive_the_resistance():
    """OB-13 (Romain, 2026-11-20): families 3, 4, 6 and 7, in French and in English, on the first sentence only."""
    rm = {"receiving_marker": True}
    cases = {
        "minimises": ["T'inquiète, ça va bien se passer.", "Je comprends, c'est pas si cher en vrai.", "Don't worry about it."],
        "counter_argument": ["C'est un investissement, pas une dépense.", "Tu vas le rentabiliser en deux mois.",
                             "Ça revient à 3 euros par jour.", "It pays for itself."],
        "disqualifies": ["Tout le monde dit ça au début.", "C'est une excuse, ça.", "That's an excuse."],
        "pressure_question": ["Tu préfères rester comme ça ?", "Tu ne veux pas réussir ?", "Do you want to stay stuck?"],
    }
    for family, sentences in cases.items():
        for s in sentences:
            assert O.not_acknowledged_by(s) == family, s
            assert not O.acknowledged(s, rm), s
    # what receives the doubt stays acknowledged
    for s in ["C'est normal d'avoir ce doute.", "Je comprends tout à fait, c'est une vraie somme.",
              "Ok, qu'est-ce qui t'inquiète le plus ?", "Je t'entends, c'est important de bien y réfléchir."]:
        assert O.not_acknowledged_by(s) is None and O.acknowledged(s, rm), s


def test_what_the_prospect_expects_from_the_call_is_framing():
    """SB-2 (Romain, 2026-11-20): « qu'est-ce que tu attends de notre appel ? » frames the call; it is not discovery.
    What made them book, or what they hope we can help with, stays a valid start."""
    for q in ["Qu'est-ce que tu attends de notre appel ?", "Et qu'attendez-vous de cet échange ?",
              "Qu'est-ce que t'attends de ce rendez-vous ?", "What do you expect from this call?"]:
        assert S.social_or_logistic(q), q
    for q in ["Qu'est-ce qui t'a amenée à réserver cet appel ?", "Qu'est-ce que tu attends de ta vie pro ?",
              "What were you hoping we could help you with?"]:
        assert not S.social_or_logistic(q), q


def test_the_questions_of_one_turn_are_one_unit_read_on_the_priority_question():
    """SEG-1 (Romain, 2026-11-20): the last question, unless it only follows up the one before (then the one before)."""
    cases = {
        "Combien d'élèves tu as aujourd'hui ? Et pourquoi ?": "Combien d'élèves tu as aujourd'hui ?",
        "Qu'est-ce qui te bloque ? Pourquoi ça te bloque ?": "Qu'est-ce qui te bloque ?",
        "Ok. Ça te rapporte combien ? Depuis combien de temps ?": "Ça te rapporte combien ?",
        "Qu'est-ce qui te manque ? Comparé à quoi ?": "Qu'est-ce qui te manque ?",
        "Tu fais quoi aujourd'hui ? Et qu'est-ce que tu voudrais dans un an ?": "Et qu'est-ce que tu voudrais dans un an ?",
        "Tu as combien d'élèves ? À quel point ça te pèse ?": "À quel point ça te pèse ?",
        "How many clients do you have? Why?": "How many clients do you have?",
    }
    for turn, priority in cases.items():
        g = S.group_turn(turn)
        assert g["priority"] == priority, turn
        assert len(g["questions"]) == len([x for x in S.split_sentences(turn) if x.endswith("?")])
    assert S.group_turn("D'accord, je comprends.") is None


def test_three_more_hard_rules_read_in_the_question():
    """§3 (Romain, 2026-11-20), from gate 1's definitions, in French and in English."""
    for q in ["Ça fait sens ?", "Tu me suis ?", "Est-ce que c'est clair pour toi ?", "Tu as des questions ?",
              "Does that make sense?"]:
        assert S.check_in_question(q), q                                          # OUT nothing
    for q in ["Donc ton problème, c'est le temps ?", "Si je comprends bien, tu donnes des cours le soir ?",
              "So your goal is 10K a month?"]:
        assert S.closed_restatement(q), q                                         # OUT agreement
    for q in ["Tu préfères vivre de tes cours ou garder ton job ?", "C'est plutôt le temps ou l'argent ?",
              "Would you rather work less or earn more?"]:
        assert S.choice_list_question(q), q                                       # OUT sales_list
    # what stays open
    assert not S.closed_restatement("Donc tu as combien d'élèves ?")
    assert not S.closed_restatement("Alors, qu'est-ce qui te bloque ?")
    assert not S.choice_list_question("C'est plutôt le temps, l'argent ou autre chose ?")      # an open branch
    assert not S.choice_list_question("Tu es salariée ou à ton compte ?")                       # two verifiable facts
    assert not S.check_in_question("Qu'est-ce qui fait sens pour toi dans ton métier ?")
