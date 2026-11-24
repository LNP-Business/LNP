"""The costs the prospect states, listed by the code (GAP-1.4, GB-7b, 2026-11-20). Sentences rewritten from the audit of
the six French calls (no real data); the English twins are tested alongside."""
from lnp_callqa.competences import gap as g
from lnp_callqa.core import costs as K
from lnp_callqa.core.models import CallContext, PROSPECT, SALES, Solicitation, Turn


def ctx_of(lines, discovery="T001", sols=()):
    role = {"S": SALES, "P": PROSPECT}
    turns = [Turn(f"T{i:03d}", i, f"00:{i:02d}", role[r], role[r], t) for i, (r, t) in enumerate(lines, 1)]
    ctx = CallContext("c", "sales", "2026-11-01T10:00:00Z", "Europe/Paris", turns)
    ctx.phases.discovery_start = discovery
    ctx.solicitations = list(sols)
    return ctx


def costs(text, before="Et qu'est-ce que ça change pour toi ?"):
    return K.prospect_costs(ctx_of([("S", before), ("P", text)]), None, None)


def test_costs_of_each_domain_are_listed_with_their_words():
    out = costs("Je vais me retrouver dans des difficultés financières très très graves, parce que depuis six mois il n'y a rien.")
    assert [(c.domain, c.quote) for c in out] == [("money", "Je vais me retrouver dans des difficultés financières très très graves")]
    assert [(c.domain, c.quote) for c in costs("Oui, ça fatigue physiquement.")] == [("health", "ça fatigue physiquement")]
    out = costs("Donc je suis dépendante actuellement de l'aide de ma mère parce que j'en vis ensemble.")
    assert out[0].domain == "money" and "je suis dépendante actuellement de l'aide de ma mère" in out[0].quote
    assert costs("Ça me pèse émotionnellement, ça me pèse financièrement.")[0].quote == "Ça me pèse émotionnellement"
    assert [c.domain for c in costs("Si on est tout le temps dehors, on profite moins des enfants, et plus la fatigue.")] \
        == ["family", "health"]
    assert costs("I barely see my kids in the evening, and honestly I feel like a fraud.")[0].domain == "family"


def test_a_long_unpunctuated_turn_is_read_around_the_words():
    text = ("du travail je suis prête à accepter n'importe quoi il n'y a rien qui tombe c'est le monde à l'envers mais là "
            "je t'en parle j'ai envie d'en pleurer j'ai envie d'en pleurer parce que quand on arrive à un certain âge on ne "
            "vaut plus rien dans la rue on n'arrête pas de dire que tu es à la retraite enfin bref")
    out = costs(text)
    assert out and out[0].domain == "health" and "j'ai envie d'en pleurer" in out[0].quote


def test_what_is_not_the_prospect_s_cost():
    assert not costs("Mais toi, tu es épuisée, tu sais, à force de courir partout.")                 # about the sales
    assert not costs("Je ne suis pas fatiguée, franchement, ça va.")                                 # negation
    assert not costs("Est-ce que ça fatigue, les cours en ligne ?")                                  # a question
    assert not costs("Ma collègue m'a dit que c'était épuisant, elle.")                              # reported speech
    assert not costs("Je gagne 1 500 euros par mois et le programme coûte 3 000 euros.")             # a figure (X6)
    prompted = costs("Oui, la fatigue.", before="Et cette fatigue, est-ce que ça t'impacte au quotidien ?")
    assert prompted and prompted[0].prompted                                                          # X10
    own = costs("Oui, ça fatigue physiquement.", before="Et cette fatigue, est-ce que ça t'impacte ?")
    assert own and not own[0].prompted                                                                # adds a word


def test_the_code_costs_join_the_gap_statements_after_the_model_s():
    from lnp_callqa.core.models import Atom, Evidence
    lines = [("S", "Et qu'est-ce que ça change pour toi, au quotidien ?"),
             ("P", "Ça fatigue physiquement. Et on profite moins des enfants, le mercredi ils sont au centre de loisirs.")]
    sols = [Solicitation("Q001", "T001", lines[0][1], "I", answer_turns=["T002"])]
    ctx = ctx_of(lines, sols=sols)
    ctx.atoms = [Atom("A001", "IMPACT", Evidence("Ça fatigue physiquement", "T002", PROSPECT), "Q001", "I", None,
                      "health", False)]
    st = g.statements_with_figures(ctx, None)
    quotes = [(s.origin, s.quote) for s in st["COST"]]
    assert quotes[0] == ("atom", "Ça fatigue physiquement")                                         # the model's, kept once
    assert any(o == "cost" and "on profite moins des enfants" in q for o, q in quotes)
    assert all(s.atom_type == "IMPACT" and s.letter == "I" for s in st["COST"])
    assert [c.domain for c in st["_costs"]] == ["health", "family", "family"]


# ------------------------------------------------------------------ 2026-11-24: 12 new tuning calls (GB-7c)
def test_a_cost_is_the_prospect_s_own_not_a_relative_s_illness_nor_a_field_of_work():
    assert not costs("Je ne peux pas, mon frère est malade et il a tout plaqué.")
    assert not costs("Elle doit s'occuper d'un proche parent gravement malade.")
    assert not costs("Mon métier, c'est justement de travailler sur le stress des autres.")
    assert not costs("Je ne suis pas quelqu'un de stressé, franchement.")
    assert costs("Je suis épuisée, je dors mal depuis des mois.")


def test_common_ways_of_saying_what_the_problem_costs():
    for text, domain in (("Je perdais mon temps à faire des choses ou revoir des choses.", "time"),
                         ("J'ai la tête sous l'eau en ce moment.", "time"),
                         ("Je me suis retrouvé dans une situation financière compliquée.", "money"),
                         ("Et du coup, ça précarise beaucoup mon activité.", "money"),
                         ("C'est anxiogène, cette situation, pour moi.", "health"),
                         ("J'ai l'impression d'avancer à pas de fourmis.", "self_belief")):
        got = costs(text)
        assert got and got[0].domain == domain, text
    assert not costs("J'ai découvert les nouveaux profs la semaine dernière.")              # not an overdraft
