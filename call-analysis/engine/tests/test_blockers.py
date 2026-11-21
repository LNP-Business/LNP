"""The blocker and its state (GAP-1.4, GB-30 v1.4, GB-30b, 2026-11-21) and the perfect restitution (§2.1). Sentences
rewritten from the six French calls (no real data)."""
from lnp_callqa.competences import gap as g
from lnp_callqa.core import blockers as K
from lnp_callqa.core import restate as R
from lnp_callqa.core.models import Atom, CallContext, Evidence, PROSPECT, SALES, Solicitation, Turn


def ctx_of(lines, discovery="T001", pitch=None, sols=(), atoms=()):
    role = {"S": SALES, "P": PROSPECT}
    turns = [Turn(f"T{i:03d}", i, f"00:{i:02d}", role[r], role[r], t) for i, (r, t) in enumerate(lines, 1)]
    ctx = CallContext("c", "sales", "2026-11-01T10:00:00Z", "Europe/Paris", turns)
    ctx.phases.discovery_start, ctx.phases.pitch_start = discovery, pitch
    ctx.solicitations, ctx.atoms = list(sols), list(atoms)
    return ctx


# ---------------------------------------------------------------- stopping questions and blocker clauses
def test_stopping_questions_in_french_even_without_the_dropped_ne():
    ctx = ctx_of([("S", "Pourquoi tu n jamais essayé d'en faire ton activité principale du coup ? Qu'est-ce qui t'a bloqué jusque maintenant ?"),
                  ("P", "Parce que je n pas assez pensé à ça, donc je ne me suis pas donné les moyens pour ça."),
                  ("S", "Ok."), ("P", "Voilà."),
                  ("S", "Pourquoi tu fais ces démarches-là maintenant ?"),            # not a stopping question
                  ("P", "Parce que l'indemnité a baissé."),
                  ("S", "Qu'est-ce qui te manque à ton avis pour que ça puisse marcher ?"),
                  ("P", "Peut-être le côté âge.")])
    qs = K.stopping_questions(ctx, None, None)
    assert [(q.turn, q.answer_turns) for q in qs] == [("T001", ["T002", "T004"]), ("T007", ["T008"])]
    assert qs[0].quote.startswith("Pourquoi tu n jamais essayé")
    assert not K.stopping_questions(ctx_of([("S", "Why haven't you done it yet?"), ("P", "No time.")]), None, None) == []


def test_blocker_clauses_are_the_prospect_s_own_first_person_words():
    ctx = ctx_of([("S", "x"), ("P", "Je ne me suis pas donné les moyens pour ça, et comme il faut se déplacer, je n'arrive pas à m'organiser.")])
    out = K.prospect_blockers(ctx, None, None)
    assert [b.marker for b in out] == ["je ne me suis pas donné les moyens", "il faut se déplacer", "je n'arrive pas à"]
    assert all(b.quote in ctx.turns[1].text for b in out)
    assert not K.prospect_blockers(ctx_of([("S", "x"), ("P", "Toi, tu n'arrives pas à vendre, tu sais.")]), None, None)
    assert not K.prospect_blockers(ctx_of([("S", "x"), ("P", "Si j'arrive pas à le faire, tant pis.")]), None, None)  # hypothesis
    assert not K.prospect_blockers(ctx_of([("S", "x"), ("P", "Ma collègue m'a dit qu'elle n'arrive pas à s'organiser.")]), None, None)


# ---------------------------------------------------------------- the four states (GB-30 v1.4)
def statement(quote, turn, letter, atom_type="PAIN", obj=None, origin="atom", id_="p1"):
    return g.Statement("PROBLEM", id_, quote, turn, letter, None, obj, None, False, None, None, atom_type, origin)


def test_the_four_states_of_the_blocker():
    ctx = ctx_of([("S", "x"), ("P", "a"), ("S", "y"), ("P", "b")])
    q = K.StoppingQuestion("T003", "Qu'est-ce qui t'a bloqué ?", ["T004"])
    pain = statement("ça me fatigue, je cours partout", "T002", "P", obj="fatigue", id_="p1")
    named = statement("je ne me suis pas donné les moyens", "T004", "P", "BLOCKER", obj="moyens", id_="p2")
    # named when asked: the answer to the stopping question, not the pain said before
    sel, rule, state, question = g.select_p(ctx, [pain, named], [q], [])
    assert (sel is named, state, question["turn"]) == (True, "named_when_asked", "T003")
    # asked, not answered: a stopping question, no blocker in its answer
    sel, rule, state, question = g.select_p(ctx, [pain], [q], [])
    assert (sel, state, question["turn"]) == (None, "asked_not_answered", "T003")
    # said unasked: no stopping question; a clause in blocker words (the code's, or a model atom holding one) before a pain
    code = statement("je ne sais pas comment trouver des élèves", "T004", "N", "BLOCKER", origin="blocker", id_="k1")
    sel, rule, state, question = g.select_p(ctx, [pain, code], [], [])
    assert (sel is code, state, question) == (True, "said_unasked", None)
    worded = statement("il faut se déplacer, ça me pose problème", "T002", "P", obj="déplacements", id_="p3")
    sel, rule, state, _ = g.select_p(ctx, [worded, code], [], [])
    assert sel is worded and rule == "tie_first_said"                        # both in blocker words: the first said
    # not asked, nothing said
    assert g.select_p(ctx, [], [], []) == (None, None, "not_asked", None)


def test_the_blocker_that_was_never_asked_is_a_deviation_of_the_formula():
    ctx = ctx_of([("S", "x"), ("P", "je n'ai pas le temps"), ("S", "tu n'as pas le temps, et ça te coûte"), ("P", "oui")])
    span = g.Span("T003", "T003", ["T003"], ["S2"])
    r = g.decide_restitution(ctx, span, {"clauses": [
        {"component": "PROBLEM", "sales_turn": "T003", "sales_quote": "tu n'as pas le temps", "about_prospect": True,
         "declarative": True, "source_turn": "T002", "key_expression": "pas le temps", "as_holding_back": True}],
        "ends_with_new_topic_question": False, "new_topic_question_quote": None}, "verified")
    conf = g.formula_conformity(ctx, r, None, None, None, "not_asked")
    assert "blocker_not_asked" in conf["deviations"] and not conf["conforms"]


# ---------------------------------------------------------------- the perfect restitution (§2.1)
def test_person_shift_keeps_the_words_and_moves_the_person():
    assert R.shift_person("je suis payée maximum 15 euros de l'heure") == "tu es payée maximum 15 euros de l'heure"
    assert R.shift_person("je ne me suis pas donné les moyens") == "tu ne t'es pas donné les moyens"
    assert R.shift_person("j'aimerais bien tenir ça dans la distance") == "tu aimerais bien tenir ça dans la distance"
    assert R.shift_person("j'habite à Gradignan et je passe mes journées avec mon fils") == \
        "tu habites à Gradignan et tu passes tes journées avec ton fils"
    assert R.shift_person("ça me pèse émotionnellement") == "ça te pèse émotionnellement"
    assert R.shift_person("I make 2K a month") == "I make 2K a month"           # English untouched (not shifted here)


def test_the_clause_around_a_quote():
    t = "J'aimerais bien, là j'ai fait le mois d'octobre, j'étais à un peu plus de 1000€ en net de CA, voilà, j'aimerais bien tenir ça dans la distance, ça serait un objectif."
    assert R.clause_of(t, "j'étais à un peu plus de 1000€ en net de CA") == "j'ai fait le mois d'octobre, j'étais à un peu plus de 1000€ en net de CA"
    assert R.clause_of(t, "j'aimerais bien tenir ça dans la distance, ça serait un objectif") == "j'aimerais bien tenir ça dans la distance, ça serait un objectif"
    t2 = "Je veux un salaire, le revenu que je veux chercher, c'est déjà minimum 2 000 euros. Minimum 2 000 euros."
    assert R.clause_of(t2, "minimum 2 000 euros") == "c'est déjà minimum 2 000 euros"
    t3 = "au début en moyenne j'étais à 2008 net et là je suis à 2000 c'est un système de primes"
    assert R.clause_of(t3, "là je suis à 2000") == "je suis à 2000"
    t4 = "Je n'ai pas le temps, mais parce qu'il faut aussi que je prépare mes cours où j'enseigne actuellement."
    assert R.clause_of(t4, "il faut aussi que je prépare mes cours où j'enseigne actuellement") == "il faut aussi que je prépare mes cours où j'enseigne actuellement"


def test_the_perfect_sentence_names_what_is_missing():
    lines = [("S", "x"), ("P", "Moi, je suis payée maximum 15 euros de l'heure, et j'aimerais plus que 15 euros de l'heure. "
                              "Je vais me retrouver dans des difficultés financières très très graves.")]
    ctx = ctx_of(lines)
    a = g.Statement("A", "a", "je suis payée maximum 15 euros de l'heure", "T002", "S", None, None, "money", True, 15, "EUR/hour", "SITUATION")
    b = g.Statement("B", "b", "plus que 15 euros de l'heure", "T002", "N", None, None, "money", True, 15, "EUR/hour", "DESIRE", "figure")
    c = g.Statement("COST", "c", "je vais me retrouver dans des difficultés financières très très graves", "T002", "I", None, None, "money", False, None, None, "IMPACT", "cost")
    pf = R.perfect_formula(ctx, a, b, None, None, "not_asked", c, g.units_match)
    assert pf["sentence"] == ("Aujourd'hui, tu es payée maximum 15 euros de l'heure · tu aimerais plus que 15 euros de l'heure · "
                              "[blocage jamais demandé : poser la question « qu'est-ce qui t'a empêché d'y arriver jusqu'ici ? »] · "
                              "et ça te coûte : tu vas te retrouver dans des difficultés financières très très graves. C'est bien ça ?")
    assert pf["slots"]["P"]["status"] == "not_asked" and pf["slots"]["A"]["turn"] == "T002"
    pf2 = R.perfect_formula(ctx, None, None, None, None, "asked_not_answered", None, g.units_match)
    assert pf2["sentence"].startswith("[à faire dire : où il en est aujourd'hui, en chiffre] · [à faire dire : où il veut arriver")
    assert "demandé, non dit" in pf2["sentence"] and "ce que ça lui coûte" in pf2["sentence"]
