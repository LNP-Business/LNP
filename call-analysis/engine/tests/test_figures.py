"""The prospect's figures listed by the code (GAP-1.4, GB-28 and GB-29, 2026-11-20). The sentences are rewritten from
the audit of the six French calls of November 2026 (no real data); the English behaviour is tested alongside."""
from lnp_callqa.competences import gap as g
from lnp_callqa.core import figures as F
from lnp_callqa.core.models import CallContext, PROSPECT, SALES, Turn


def ctx_of(lines, discovery="T001", pitch=None, sols=(), atoms=()):
    role = {"S": SALES, "P": PROSPECT}
    turns = [Turn(f"T{i:03d}", i, f"00:{i:02d}", role[r], role[r], t) for i, (r, t) in enumerate(lines, 1)]
    ctx = CallContext("c", "sales", "2026-11-01T10:00:00Z", "Europe/Paris", turns)
    ctx.phases.discovery_start, ctx.phases.pitch_start = discovery, pitch
    ctx.solicitations, ctx.atoms = list(sols), list(atoms)
    return ctx


def figs(text, before="Et toi, où en es-tu ?"):
    return F.prospect_figures(ctx_of([("S", before), ("P", text)]), None, None)


def one(text, kind=None, before="Et toi, où en es-tu ?"):
    out = [f for f in figs(text, before) if kind is None or f.kind == kind]
    assert out, text
    return out[0]


# ---------------------------------------------------------------- units
def test_one_spelling_per_unit():
    assert F.canon_unit("euros de l'heure") == F.canon_unit("EUR/hour") == F.canon_unit("€/h") == "EUR/hour"
    assert F.canon_unit("heures par semaine") == F.canon_unit("hours per week") == "hours/week"
    assert F.canon_unit("élèves par mois") == "clients/month" and F.canon_unit("clients") == "clients"
    assert F.canon_unit("month") == "money/month" and F.canon_unit("USD/month") == "USD/month"
    assert F.dimension("euros") == "money" and F.dimension("hours") == "time" and F.dimension("status") is None
    assert F.units_match("USD/month", "month")            # a currency-less income period matches a currency
    assert F.units_match("euros", "EUR") and not F.units_match("EUR/hour", "EUR/month")
    assert not F.units_match("euros", "heures par semaine") and not F.units_match(None, "EUR")


# ---------------------------------------------------------------- present figures (A)
def test_the_present_income_with_its_rate():
    f = one("Moi, je suis payée maximum 15 euros de l'heure.", "present")
    assert (f.value, f.unit, f.dimension) == (15.0, "EUR/hour", "money")
    assert f.quote == "je suis payée maximum 15 euros de l'heure"


def test_a_recent_month_is_where_he_is_not_a_past():
    f = one("J'aimerais bien, là j'ai fait le mois d'octobre, j'étais à un peu plus de 1000€ en net de CA, voilà.")
    assert f.kind == "present" and f.value == 1000.0 and f.unit == "EUR" and "1000€" in f.quote
    assert one("En moyenne j'étais à 2008 net et là je suis à 2000, c'est un système de primes.", "past").value == 2008.0
    p = one("En moyenne j'étais à 2008 net et là je suis à 2000, c'est un système de primes.", "present")
    assert (p.value, p.unit, p.quote) == (2000.0, "money", "là je suis à 2000")       # a bare income figure


def test_present_markers_in_french_and_english():
    both = figs("Avec 10 heures par semaine, ça reste du coup 220 euros.")
    assert [(f.kind, f.value, f.unit) for f in both] == [("present", 10.0, "hours/week"), ("present", 220.0, "EUR")]
    assert one("Ça fait 5,50 euros l'heure, en fait.", "present").value == 5.5
    assert one("Pour l'instant, je ne travaille que 10 heures par semaine.", "present").unit == "hours/week"
    f = one("Right now I'm making about 2K a month from it.", "present")
    assert (f.value, f.unit) == (2000.0, "money/month")
    assert one("I charge $40 an hour.", "present").unit == "USD/hour"


# ---------------------------------------------------------------- targets (B)
def test_targets_in_figures():
    f = one("Le revenu que je veux chercher, c'est déjà minimum 2 000 euros.", "target")
    assert (f.value, f.unit, f.quote) == (2000.0, "EUR", "minimum 2 000 euros")
    f = one("D'être au moins, voilà. 3000 euros moi c'est ça effectivement qui me conviendrait pour vivre.", "target")
    assert f.value == 3000.0 and f.quote.startswith("3000 euros") and "me conviendrait" in f.quote
    assert one("Déjà, c'est plus que 15 euros de l'heure.", "target").unit == "EUR/hour"
    assert one("My goal is 10K a month within a year.", "target").value == 10000.0


def test_targets_without_a_figure():
    out = figs("J'aimerais bien, là j'ai fait le mois d'octobre, j'étais à un peu plus de 1000€ en net de CA, voilà, "
               "j'aimerais bien tenir ça dans la distance, ça serait un objectif.")
    t = [f for f in out if f.value is None]
    assert len(t) == 1 and t[0].quote == "j'aimerais bien tenir ça dans la distance, ça serait un objectif"
    assert [f.quote for f in figs("Je suis attachée à mon indépendance et j'ai envie de la retrouver.") if f.value is None] \
        == ["j'ai envie de la retrouver"]
    # feelings, tics and requests for information are not targets
    assert not [f for f in figs("Là je t'en parle, j'ai envie d'en pleurer.") if f.value is None]
    assert not [f for f in figs("Vous voyez ce que je veux dire ? J'ai besoin de savoir si ça marche.") if f.value is None]


# ---------------------------------------------------------------- what is not a figure of the gap
def test_ages_dates_clock_times_and_percentages_are_not_figures():
    assert not figs("Je suis à la retraite, j'ai fait mes 45 ans depuis un peu plus d'un an.")
    assert not figs("Les élèves finissent vers 18 heures, ou à 17h30, et le 27 novembre il y a une réunion.")
    assert not figs("On gagne quelques 10% de ce que coûte le cours, pendant 4 mois.")
    assert not [f for f in figs("Il faudra 45 minutes et 15 kilomètres.") if f.value]


def test_expenses_prices_hypotheses_and_negations_are_set_aside():
    assert one("J'ai dû prendre une femme de ménage, je la payais 25 euros de l'heure.").kind == "expense"
    assert one("Par rapport à 4 mois, 3 000 euros, je trouve que c'est un peu cher.").kind == "offer"
    assert one("Si tu fais 20 heures par semaine, tu vas arriver à 3000 euros, par exemple.").kind == "other"
    assert one("Je ne parle pas de 50 euros par heure.").kind == "other"
    assert one("Mais toi, aujourd'hui, tu sais te valoriser à 50 euros de l'heure.").kind == "other"   # about « tu »


def test_a_figure_the_sales_said_first_is_prompted():
    f = one("Oui, 4 heures par semaine, c'est bon pour moi, je fais 4 heures par semaine.",
            before="Ce qu'on préconise, c'est 4 heures par semaine pour avancer.")
    assert f.prompted
    assert not one("Je fais 6 heures par semaine.", before="Ce qu'on préconise, c'est 4 heures par semaine.").prompted


# ---------------------------------------------------------------- the gap formula on the figures
def statement(comp, id_, quote, turn, letter, quantified=False, value=None, unit=None, object=None, origin="atom",
              atom_type=None):
    return g.Statement(comp, id_, quote, turn, letter, None, object, None, quantified, value, unit,
                       atom_type or ("DESIRE" if comp == "B" else "SITUATION"), origin)


def test_a_is_never_a_fact_unrelated_to_b():
    ctx = ctx_of([("S", "x"), ("P", "y")])
    conf = statement("A", "a1", "la conférence m'a convaincu", "T002", "S")
    home = statement("A", "a2", "j'habite à Gradignan", "T002", "S")
    b = statement("B", "b1", "minimum 2 000 euros", "T002", "S", True, 2000, "EUR", origin="figure")
    sa, sb, rule = g.select_a_b(ctx, [conf, home], [], [b])
    assert sa is None and sb is b and rule == "no_A_on_B_dimension:quantified_outside_N"     # pair 16a
    sa, sb, rule = g.select_a_b(ctx, [conf, home], [], [])
    assert (sa, sb, rule) == (None, None, "no_B")                                           # no unquantified fallback


def test_a_on_b_s_dimension_and_the_money_figure_first():
    ctx = ctx_of([("S", "x"), ("P", "y")])
    hours = statement("A", "f1", "je ne travaille que 10 heures par semaine", "T002", None, True, 10, "hours/week",
                      origin="figure")
    euros = statement("A", "f2", "ça reste du coup 220 euros", "T002", None, True, 220, "EUR", origin="figure")
    rate = statement("A", "f3", "Ça fait 5,50 euros l'heure", "T002", None, True, 5.5, "EUR/hour", origin="figure")
    b_h = statement("B", "b1", "j'aimerais faire 20 heures par semaine", "T002", "N", True, 20, "heures par semaine")
    assert g.select_a_b(ctx, [hours, euros, rate], [b_h])[0] is hours                        # same unit, canonical
    b_m = statement("B", "b2", "arriver à 1 500 euros par mois", "T002", "N", True, 1500, "EUR/month")
    sa, _, rule = g.select_a_b(ctx, [hours, euros, rate], [b_m])
    assert sa is rate and rule == "same_dimension:quantified_N"                             # money, other unit
    b_free = statement("B", "t1", "j'ai envie de la retrouver", "T002", "N", origin="target")
    sa, sb, rule = g.select_a_b(ctx, [hours, euros, rate], [b_free])
    assert sa is rate and rule == "figure:N_clause"                                          # money before time
    assert g.select_a_b(ctx, [hours, euros, rate], [])[0] is rate                           # no B: the figure


def test_b_in_figures_wins_over_a_wish_and_the_most_recent_target_is_taken():
    ctx = ctx_of([("S", "x"), ("P", "y"), ("S", "z"), ("P", "w")])
    wish = statement("B", "b1", "J'ai besoin du maximum", "T002", "N")
    fig = statement("B", "f1", "plus que 15 euros de l'heure", "T004", None, True, 15, "EUR/hour", origin="figure")
    a = statement("A", "a1", "je suis payée maximum 15 euros de l'heure", "T002", "S", True, 15, "EUR/hour")
    sa, sb, rule = g.select_a_b(ctx, [a], [wish], [fig])
    assert sb is fig and sa is a and rule == "same_unit:quantified_outside_N"
    early = statement("B", "b2", "j'ai vraiment envie de voir ce que ça peut donner", "T002", "N")
    late = statement("B", "t1", "j'aimerais bien tenir ça dans la distance", "T004", "S", origin="target")
    sa, sb, rule = g.select_a_b(ctx, [a], [early], [late])
    assert sb is late and rule == "figure:outside_N_clause"


def test_the_formula_runs_on_the_code_figures_when_the_model_listed_no_atom():
    """A real-shaped case: no atom from the model, the figures said in an N answer; A and B selected, G3 computable."""
    from lnp_callqa.core.models import Solicitation
    lines = [("S", "Qu'est-ce qui t'amène aujourd'hui ?"),
             ("P", "Je donne des cours à côté de mon poste, et je voudrais en vivre."),
             ("S", "Et tu vises quoi, comme revenu, pour en vivre ?"),
             ("P", "Là je suis à 2000 net. 3000 euros, c'est ça qui me conviendrait pour vivre, au moins."),
             ("S", "Ok. Et qu'est-ce qui t'a empêchée d'y aller jusqu'ici ?"),
             ("P", "Je n'ai pas assez de volume horaire, à peine 20 euros de l'heure.")]
    sols = [Solicitation("Q001", "T001", lines[0][1], "S", answer_turns=["T002"]),
            Solicitation("Q003", "T003", lines[2][1], "N", answer_turns=["T004"]),
            Solicitation("Q005", "T005", lines[4][1], "P", answer_turns=["T006"])]
    ctx = ctx_of(lines, sols=sols)
    st = g.statements_with_figures(ctx, None)
    assert [s.quote for s in st["A"]] == ["Là je suis à 2000"]
    assert [s.quote for s in st["B"]] == ["je voudrais en vivre", "3000 euros, c'est ça qui me conviendrait"]
    A = g.a_candidates(ctx, st, None)
    B, B_out = g.b_candidates(ctx, st, None)
    sa, sb, rule = g.select_a_b(ctx, A, B, B_out)
    assert (sa.value, sb.value, rule) == (2000.0, 3000.0, "same_unit")
    items = g.score_items(ctx, None, sa, sb, None, None, None, {q.id: q for q in ctx.solicitations})
    assert {i.id: i.level for i in items if i.id in ("G1", "G3")} == {"G1": 2, "G3": 2}
    assert [f["kind"] for f in [x.to_dict() for x in st["_figures"]]].count("other") == 1   # « 20 euros de l'heure »


def test_a_model_atom_that_is_the_present_figure_counts_in_an_n_answer():
    """Live analysis of 2026-11-21: the model listed « là je suis à 2000 c'est… » as a quantified atom with unit "c" in
    the N answer; the twin of the code's present figure, it is A whatever the letter, with the code's unit."""
    from lnp_callqa.core.models import Atom, Evidence, Solicitation
    lines = [("S", "Et tu vises quoi, comme revenu ?"),
             ("P", "3000 euros, c'est ça qui me conviendrait pour vivre. En moyenne j'étais à 2008 net et là je suis à 2000 c'est un système de primes.")]
    sols = [Solicitation("Q001", "T001", lines[0][1], "N", answer_turns=["T002"])]
    ctx = ctx_of(lines, sols=sols)
    ctx.atoms = [Atom("A001", "SITUATION", Evidence("là je suis à 2000 c'est un système de primes", "T002", PROSPECT),
                      "Q001", "N", None, None, True, 2000.0, "c"),
                 Atom("A002", "DESIRE", Evidence("3000 euros, c'est ça qui me conviendrait pour vivre", "T002", PROSPECT),
                      "Q001", "N", None, None, True, 3000.0, "euros")]
    st = g.statements_with_figures(ctx, None)
    a = next(s for s in st["A"] if s.value == 2000)
    assert (a.origin, a.kind, a.unit) == ("atom", "present", "money")
    A = g.a_candidates(ctx, st, None)
    B, B_out = g.b_candidates(ctx, st, None)
    sa, sb, rule = g.select_a_b(ctx, A, B, B_out)
    assert sa is a and sb.value == 3000 and rule == "same_unit"


def test_the_code_s_present_figure_is_not_sent_to_the_past_check():
    """Second live run of 2026-11-21: the model called « j'étais à un peu plus de 1000€ » (the month before) a past figure
    (X13) and A was lost. The code read a recent month: where he is. Its reading stands for the twin atom."""
    from lnp_callqa.competences.gap import GapCompetence
    from lnp_callqa.core.llm import MockClient
    from lnp_callqa.core.models import Atom, Evidence, Solicitation
    from lnp_callqa.core.runner import Runner
    lines = [("S", "Tu as des objectifs précis, tu peux m'en dire plus ?"),
             ("P", "J'aimerais bien, là j'ai fait le mois d'octobre, j'étais à un peu plus de 1000€ en net de CA, voilà, "
                   "j'aimerais bien tenir ça dans la distance, ça serait un objectif."),
             ("S", "Je vois. Alors je te présente l'offre."),
             ("P", "D'accord.")]
    sols = [Solicitation("Q001", "T001", lines[0][1], "N", answer_turns=["T002"])]
    ctx = ctx_of(lines, pitch="T003", sols=sols)
    ctx.atoms = [Atom("A001", "SITUATION", Evidence("j'étais à un peu plus de 1000€ en net de CA", "T002", PROSPECT),
                      "Q001", "N", "monthly revenue", "money", True, 1000.0, None)]
    asked = []
    def fb(task_id, unit_id, prompt, pass_no):
        asked.append(task_id)
        return {"present_state": False} if task_id == "gap.a_current" else \
            {"clauses": [], "ends_with_new_topic_question": False, "new_topic_question_quote": None} if task_id == "gap.restitution" else {}
    d = GapCompetence().run(ctx, Runner(MockClient({}, fb))).details
    assert "gap.a_current" not in asked
    assert d["selected_A"]["quote"].endswith("1000€ en net de CA") and d["selected_A"]["unit"] == "EUR"
    assert d["selected_B"]["quote"].startswith("j'aimerais bien tenir ça dans la distance")
