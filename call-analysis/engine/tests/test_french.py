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


def test_a_cut_question_is_recognised():
    from lnp_callqa.competences import spin as S
    for q in ("Qu'est-ce qui va faire que...", "Et du coup tu… ?", "So what would…"):
        assert S.cut_question(q), q
    for q in ("Qu'est-ce qui t'a bloqué jusque maintenant ?", "Pour faire les cours en ligne ?", "Combien… euh, combien d'élèves ?"):
        assert not S.cut_question(q), q


def test_the_work_of_today_is_a_neutral_fact_with_no_register():
    from lnp_callqa.competences import spin as S                     # Romain (2026-11-21): « Sans registre »
    assert S.REGISTER_OF_DOMAIN["status"] == "other"
    assert S.lexicon_register_named("Et du coup, tu es professeur de quoi, toi ?")[0] == "other"
    assert S.lexicon_register_named("Tu es à la retraite depuis quand ?")[0] == "other"
    assert S.lexicon_register_named("Tu te vois où dans quelques années ?")[0] == "identity_status"
    assert S.lexicon_register_named("Tu m'appelles d'où ?") is None                 # a place: still Other
    assert S.lexicon_register_named("Tu as combien d'élèves aujourd'hui ?")[0] == "financial"   # students stay Financial


# ---------------------------------------------------------------- French forms of the closed PR 65 (Romain, 2026-11-21)
# Only the behaviour of PR 65 was taken (words and turns of phrase the code reads), never its names or its prompts.
from lnp_callqa.competences import pitch as P                     # noqa: E402
from lnp_callqa.core import blockers as B                         # noqa: E402
from lnp_callqa.core import foundation as F                       # noqa: E402


def test_pb30_units_keep_the_accents_and_read_the_year():
    """PB-30 / PB-31: « élèves », « année », « journée » are whole words; « par an », « €/an » are the year."""
    assert P.norm_unit("élèves par mois") == frozenset({"client", "month"})
    assert P.norm_unit("élèves") == P.norm_unit("eleves") == P.norm_unit("clientes") == frozenset({"client"})
    assert P.norm_unit("euros par an") == P.norm_unit("€/an") == P.norm_unit("par année") == frozenset({"year"})
    assert P.norm_unit("k€ par mois") == P.norm_unit("euros par mois") == frozenset({"month"})
    assert P.norm_unit("de l'heure") == P.norm_unit("par heure") == frozenset({"hour"})
    assert P.norm_unit("journée") == P.norm_unit("quotidien") == frozenset({"day"})
    assert P.norm_unit("annuels") == frozenset({"year"}) and P.norm_unit("par cours") == frozenset({"lesson"})
    assert P.norm_unit("50 an hour") == frozenset({"hour"})                  # English: « an » stays the article


def test_sb24_french_quantities():
    """SB-24: French numbers in words, « un an / une semaine / un mois »; not « un jour », not a frequency alone."""
    for q in ["j'ai deux enfants", "ça fait trois ans", "depuis un an", "un mois sans élève", "une semaine de vacances",
              "je gagne quinze euros de l'heure", "mille euros", "une dizaine d'élèves", "a year ago"]:
        assert S.has_quantity(q), q
    for q in ["un jour je voudrais en vivre", "tous les mois", "j'ai beaucoup d'élèves", "every month"]:
        assert not S.has_quantity(q), q
    assert S.parse_quantity("2 000 euros par mois") == (2000.0, "euros")
    assert S.parse_quantity("3 élèves") == (3.0, "élèves")
    assert S.parse_quantity("1500 € par mois") == (1500.0, "€")
    assert S.parse_quantity("2,5 k€") == (2500.0, "€")
    assert S.parse_quantity("$5,000 a month") == (5000.0, "month")


def test_sb17_elisions_and_french_function_words_make_no_follow_up():
    """SB-17: « c'est », « j'ai », « depuis », « gens » are not content words; « d'élèves » is « élèves »."""
    assert not S.follows_up("Oui c'est dur, j'ai trois enfants.", "Et c'est quoi ton objectif de revenus ?")
    assert not S.follows_up("Je suis prof depuis dix ans.", "Et depuis quand tu cherches des clients ?")
    assert not S.follows_up("Les gens ne me répondent pas.", "Les gens de ton quartier, tu les connais ?")
    assert S.follows_up("Je n'ai pas assez d'élèves.", "Combien d'élèves tu voudrais ?")
    assert S.follows_up("Je n'ai pas le temps le soir.", "Combien de temps tu voudrais libérer ?")   # « temps » stays
    assert "eleves" in S.content_words("d'élèves") and "est" not in S.content_words("c'est")


def test_pb15_french_compliments_are_never_adhesion():
    for t in ["Waouh.", "Ah oui, c'est génial.", "Franchement c'est super.", "J'adore.", "J'adore ça.", "J'aime bien.",
              "Ça me plaît.", "C'est dingue.", "C'est ouf.", "C'est incroyable.", "Excellent.", "Wow, génial.",
              "I like it.", "Honestly, that sounds great."]:
        assert P.plain_approval(t), t
    for t in ["Ça me parle.", "Ça donne envie.", "C'est génial, je veux commencer lundi."]:   # Romain decides the first two
        assert not P.plain_approval(t), t


def test_gap_french_openers_and_clauses():
    """A1 S1 openers; A1 S2: a French restatement without commas is cut at « et », « mais », « donc »."""
    for t in ["Ce que je retiens, c'est que tu es prof", "Si je t'ai bien compris, tu donnes des cours",
              "D'après ce que tu m'as dit, tu", "Laisse-moi résumer", "On fait le point : tu", "Je reformule : tu veux"]:
        assert G.OPENERS.search(T.norm(t)), t
    assert len(G.CLAUSE_SPLIT.split("tu es prof et tu donnes des cours le soir mais tu es épuisée donc tu veux")) == 4
    assert "toi" in G.SUBJECT_YOU


def test_gap_french_validation_and_missing_requests():
    """A1 S3 explicit requests only; GB-15: « j'ai oublié / loupé / zappé quelque chose ? »."""
    for t in ["J'ai bien résumé ?", "Je t'ai bien comprise ?", "Ça te semble juste ?", "Ça vous correspond ?",
              "On est bien d'accord ?", "On est alignés ?", "Tu valides ?", "C'est correct ?", "Je n'ai rien oublié ?",
              "J'ai zappé un truc ?"]:
        assert G.validation_request(t), t
    for t in ["Tu travailles le soir, non ?", "Je vais te montrer, d'accord ?", "Tu vois, hein ?"]:
        assert not G.validation_request(t), t                               # a generic tail is no validation request
    for t in ["J'ai oublié un truc ?", "J'ai loupé quelque chose ?", "Je n'ai rien oublié ?", "Je me suis trompée ?",
              "J'ai mal compris ?"]:
        assert G.MISSING_REQUEST.search(T.norm(t)), t


def test_french_approvals_and_backchannels():
    """C3 rule 5 and GB-1."""
    for t in ["C'est clair.", "C'est sûr.", "C'est juste.", "C'est exactement ça.", "C'est bien ça.", "Totalement.",
              "Clairement.", "Grave.", "Bah oui.", "Ben oui", "Eh oui", "Sans aucun doute.", "Oui c'est clair",
              "Clearly.", "No doubt."]:
        assert T.approval_only(t), t
    for t in ["Je vois.", "Je comprends.", "Nickel.", "Top.", "Génial.", "Oui, je vois.", "I see."]:
        assert G.short_approval(t), t
    for t in ["Mouais.", "À peu près.", "Plus ou moins.", "C'est clair que je veux changer"]:   # Romain decides the first
        assert not T.approval_only(t), t


def test_french_stopping_questions():
    """GB-30 step 1: after « qu'est-ce qui » / « ce qui », and « tes freins »; never « je te bloque un créneau »."""
    for t in ["Qu'est-ce qui t'en empêche ?", "Qu'est-ce qui vous en a empêché ?", "Qu'est-ce qui t'arrête ?",
              "Qu'est-ce qui coince ?", "C'est quoi tes freins ?"]:
        assert G.STOPPING_Q.search(T.norm(t)) and B.STOPPING.search(T.norm(t)), t
    for t in ["Je te bloque un créneau jeudi.", "Je vous arrête là.", "Il y a des freins sur ta voiture ?"]:
        assert not G.STOPPING_Q.search(T.norm(t)) and not B.STOPPING.search(T.norm(t)), t


def test_the_typographic_apostrophe_is_read():
    assert S.question_form("Qu’est-ce que tu fais le soir.") == "interrogative_no_mark"
    assert any(re.search(p, "tu es prof, c’est ça ?") for p in S.TAILS)
    assert S.TAIL_ONLY.match("C’est ça ?") and S.TAIL_ONLY.match("N’est-ce pas ?")
    assert "objection_price_money" in O.marker_hits("J’ai pas l’argent.")


def test_french_objection_markers_of_pr65():
    """OB-1: candidates only (the model decides); ’ and the unaccented forms are read."""
    cases = {"objection_price_money": ["Je n'ai pas le budget.", "Ça coûte un bras.", "C'est une grosse somme.",
                                       "Je ne peux pas me le permettre.", "C'est chere pour moi."],
             "objection_trust_relevance": ["C'est du baratin.", "C'est certifiant ?", "Je ne sais pas si ça marche."],
             "objection_time": ["Je suis sous l'eau.", "Mon planning est blindé.", "Je suis debordee."],
             "objection_co_decider": ["J'en parle à mon mari.", "On prend les décisions ensemble.", "Je dois voir avec ma moitié."],
             "anxiety_capability": ["Je flippe un peu.", "Je ne suis pas sûre d'y arriver.", "Je ne suis pas faite pour ça."],
             "anxiety_choice": ["Je suis échaudée.", "Qu'est-ce qui me prouve que ça marche ?"],
             "inertia": ["On verra.", "La nuit porte conseil.", "Je vais y penser.", "Pas aujourd'hui."]}
    for kind, ts in cases.items():
        for t in ts:
            assert kind in O.marker_hits(t), t
    for t in ["Je suis chargée de cours à la fac.", "Je peux payer en plusieurs fois ?", "Avec mes élèves, ça va."]:
        assert not O.marker_hits(t), t


def test_french_transitions_of_ob13():
    """OB-13: « par contre », « pourtant », « en réalité », « le problème, c'est que » are transitions; « non-stop » is
    no « non »."""
    rm = {"receiving_marker": True}
    assert O.acknowledged("Je comprends, par contre on peut étaler le paiement.", rm)
    assert not O.acknowledged("Par contre, il faut voir ce que tu gagnes.", rm)              # nothing received first
    assert not O.acknowledged("Pourtant tu m'as dit que tu voulais.", rm)
    assert not O.acknowledged("Le problème, c'est que tu restes là.", rm)
    assert not O.CONTRADICTION_RE.search(T.norm("Non-stop, on travaille avec toi."))
    assert not O.CONTRADICTION_RE.search(T.norm("Par contre, il faut voir."))                 # read as a transition


def test_french_echoes_imperatives_and_tails():
    for q in ["Dites-m'en plus ?", "Racontez-moi ?", "Qu'est-ce que tu veux dire ?", "De quelle façon ?", "Ah bon ?",
              "Comme quoi ?", "Vas-y.", "Développe ?"]:
        assert S.follows_up("Je n'en peux plus le soir.", q), q
    for q in ["Raconte.", "Explique.", "Dis-m'en plus.", "Donne-moi une idée de tes revenus.", "Fais-moi comprendre."]:
        assert S.question_form(q) == "imperative", q
    for q in ["Développe ton réseau.", "Précise ton offre."]:                                     # advice, not a request
        assert S.question_form(q) is None, q
    for t in ["Tu travailles le soir, pas vrai ?", "Tu as des enfants, oui ?", "C'est ça, exact ?", "J'ai raison ?",
              "Je me trompe ?", "C'est logique ?", "C'est bien juste ?"]:
        assert any(re.search(p, t.lower()) for p in S.TAILS), t
    for t in ["Ça fait sens ?", "Tu me suis ?", "Tu comprends ?"]:                                 # CHECK_IN, not tails
        assert not any(re.search(p, t.lower()) for p in S.TAILS), t
    assert not S.TAIL_ONLY.match("Oui ?")


def test_offer_words_of_the_gap_cut():
    for t in ["Notre formation dure quatre mois.", "Nos séances ont lieu le mardi.", "Laisse-moi te montrer.",
              "Je te montre comment."]:
        assert G.OFFER_WORDS.search(T.norm(t)), t
    for t in ["Tu as suivi une formation ?", "Combien de séances tu donnes ?"]:
        assert not G.OFFER_WORDS.search(T.norm(t)), t


def test_long_french_sentences_are_cut_at_et_and_a_subject():
    long = ("Alors on a des modules vidéo que tu regardes quand tu veux, on a des séances de groupe chaque semaine avec un "
            "coach qui corrige tes annonces et tes messages, et tu as aussi un accès à la communauté où les autres profs "
            "partagent leurs résultats, et on fait un point individuel chaque mois pour voir où tu en es et ce qu'il faut.")
    assert len(T.sentences(long)) == 3
    assert len(T.sentences("Tu es prof, et tu veux en vivre.")) == 1                          # 40 words or fewer: whole


def test_gb22_vous_and_k_euros():
    """GB-22 (b): the French « vous » is the second person, like « tu »; « 2 k€ » is 2000."""
    assert T.key_expression_ok("je suis épuisée", "Franchement je suis épuisée le soir", "Vous êtes épuisée le soir")[0]
    assert T.key_expression_ok("mes élèves", "je perds mes élèves", "vous perdez vos élèves")[0]
    assert T.key_expression_ok("moi-même", "je fais tout moi-même", "vous faites tout vous-même")[0]
    assert T.key_expression_ok("ça me bloque", "ça me bloque", "ça vous bloque")[0]
    assert T.key_expression_ok("ma maison", "on a vendu ma maison", "vous avez vendu votre maison")[0]
    assert T.key_expression_ok("2 k€", "je gagne 2 k€", "tu gagnes 2000 €")[0]
    assert T.key_expression_ok("2,5 k€", "je vise 2,5 k€", "tu vises 2500 €")[0]
    assert not T.key_expression_ok("je suis épuisée", "je suis épuisée", "vous êtes motivée")[0]


def test_french_register_words_of_pr65():
    for q, reg in [("Ton planning ressemble à quoi ?", "time_load"), ("Tu te sens débordée ?", "time_load"),
                   ("Ta compagne en pense quoi ?", "time_load"), ("Tu ressens de la culpabilité ?", "mental_emotional"),
                   ("Ça te fait honte ?", "mental_emotional"), ("Quel est ton état d'esprit ?", "mental_emotional"),
                   ("Tu fais des fins de mois difficiles ?", "financial"), ("Quel est ton tarif ?", "financial"),
                   ("Tu t'es reconvertie quand ?", "identity_status")]:
        assert S.lexicon_register_named(q)[0] == reg, q


def test_french_phase_cues():
    for t in ["Notre formation dure quatre mois.", "Comment ça fonctionne, c'est simple.", "Je vais te présenter la suite.",
              "Il y a trois piliers."]:
        assert F.OFFER_CUES.search(t), t
    for t in ["Tu es prête à démarrer ?", "Qu'est-ce que tu veux faire ?", "Tu souhaites nous rejoindre ?", "On se lance ?",
              "Comment vous souhaitez procéder ?"]:
        assert F.DECISION.search(t), t
    assert not F.OFFER_CUES.search("Tu fais ça depuis six mois ?")                 # the offer's duration waits for Romain
