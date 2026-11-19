"""Formalisation de l'écart (GAP-1.3) : paires minimales de l'annexe A (décisions pures), cas de l'annexe B sur de
vraies transcriptions, et listes de mots françaises du module."""
from __future__ import annotations
import os

import re
from pathlib import Path

import pytest

from lnp_analyse.competences import ecart as g
from lnp_analyse.competences.ecart import CompetenceEcart, Restitution, Plage
from lnp_analyse.noyau.fondation import reparer_attribution
from lnp_analyse.noyau.client_modele import ClientSimule
from lnp_analyse.noyau.modeles import Atome, ContexteAppel, Preuve, PROSPECT, COMMERCIAL, Sollicitation, Tour
from lnp_analyse.noyau.executeur import Executeur
from lnp_analyse.noyau.texte import jetons_propres, normaliser

EXECUTIONS = Path(os.environ.get("CALLQA_CORPUS", str(Path(__file__).parent / "fixtures" / "transcripts")))
LIGNE = re.compile(r"^\[(T\d+\w?) ([\d:]+)\] (SALES|PROSPECT|OTHER): ?(.*)$")

DEFAUTS = {
    "gap.restitution": {"clauses": [], "ends_with_new_topic_question": False, "new_topic_question_quote": None},
    "gap.validation": {"outcome": "none"},
    "gap.a_current": {"present_state": True},
    "gap.stopping": {"is_stopping_question": False},
    "gap.horizon": {"horizon_quote": None, "horizon_turn": None, "horizon": None, "binding": None},
}


# ------------------------------------------------------------------------------------------- outils
def charger_tours(appel_: str) -> list[Tour]:
    sortie = []
    for ligne in (EXECUTIONS / appel_ / "transcript_compact.txt").read_text(encoding="utf-8").splitlines():
        m = LIGNE.match(ligne.strip())
        if m:
            sortie.append(Tour(m[1], len(sortie) + 1, m[2], m[3], m[3], m[4]))
    return sortie


def synth(lignes: list[tuple[str, str]]) -> list[Tour]:
    role = {"S": COMMERCIAL, "P": PROSPECT}
    return [Tour(f"T{i:03d}", i, f"00:{i:02d}", role[r], role[r], t) for i, (r, t) in enumerate(lignes, 1)]


def ctx_de(tours, decouverte="T001", presentation=None, prix=None, sols=(), atomes=()) -> ContexteAppel:
    ctx = ContexteAppel("c", "valentino", "2026-10-01T10:00:00Z", "UTC", tours)
    ctx.phases.debut_decouverte, ctx.phases.debut_presentation, ctx.phases.premier_prix = decouverte, presentation, prix
    ctx.sollicitations, ctx.atomes = list(sols), list(atomes)
    return ctx


def sol(id_, tour, lettre, texte, reponses=()):
    return Sollicitation(id_, tour, texte, lettre, tours_reponse=list(reponses))


def atome(id_, type_, tour, citation, lettre, id_sol=None, objet=None, domaine=None, quantifie=False, valeur=None,
         unite=None, suggere=False):
    return Atome(id_, type_, Preuve(citation, tour, PROSPECT), id_sol, lettre, objet, domaine, quantifie, valeur, unite,
                suggere_par_commercial=suggere)


def proposition(composante, tour_commercial, citation_commercial, tour_source=None, expression_cle=None, **kw):
    d = {"component": composante, "sales_turn": tour_commercial, "sales_quote": citation_commercial, "about_prospect": True,
         "declarative": True, "source_turn": tour_source, "key_expression": expression_cle}
    d.update(kw)
    return d


def executeur(reponses: dict) -> Executeur:
    """reponses : {(id de tâche, préfixe de l'id d'unité): réponse} ; tout le reste reçoit la réponse neutre par
    défaut."""
    def fb(id_tache, id_unite, consigne, no_passe):
        for (tid, prefixe), a in reponses.items():
            if tid == id_tache and id_unite.startswith(prefixe):
                return a
        return DEFAUTS[id_tache]
    return Executeur(ClientSimule({}, fb))


def restit(ctx, debut, fin, propositions, nouveau_sujet=None) -> Restitution:
    sp = Plage(debut, fin, [t.id for t in ctx.fenetre(debut, None)][: ctx.n(fin) - ctx.n(debut) + 1], ["S1"])
    rep = {"clauses": propositions, "ends_with_new_topic_question": bool(nouveau_sujet), "new_topic_question_quote": nouveau_sujet}
    return g.decider_restitution(ctx, sp, rep, "verified")


# ------------------------------------------------------------------------------------------- paire 1 (GB-4)
PAIRE1 = [("S", "Where are you at right now?"), ("P", "I make about 2K a month right now from design work."),
         ("S", "And where do you want to be?"), ("P", "My goal is 10K a month within a year honestly."),
         ("S", "So your goal is 10K a month, right?")]


def test_paire_1a_une_composante_n_est_pas_une_restitution():
    ctx = ctx_de(synth(PAIRE1))
    r = restit(ctx, "T005", "T005", [proposition("B", "T005", "your goal is 10K a month", "T004", "my goal is 10K a month")])
    assert r.composantes == {"B"} and not r.est_restitution                       # GB-4, X2


def test_paire_1b_restitution_a_deux_composantes_ne_passe_pas_la_porte():
    lignes = PAIRE1[:-1] + [("S", "So you're at 2K, your goal is 10K a month, right?")]
    ctx = ctx_de(synth(lignes))
    r = restit(ctx, "T005", "T005", [proposition("A", "T005", "you're at 2K", "T002", "2K"),
                                     proposition("B", "T005", "your goal is 10K a month", "T004", "my goal is 10K a month")])
    assert r.est_restitution and r.composantes == {"A", "B"}
    r.validation, r.issue_effective = {"outcome": "confirmed"}, "confirmed"
    verdict, raisons, _ = g.porte([r])
    assert verdict == "absent" and raisons == ["problem_missing", "cost_missing"]


# ------------------------------------------------------------------------------------------- paire 2 (porte, GB-5)
PAIRE2 = [("S", "What's held you back?"), ("P", "Honestly confidence, I just don't have the confidence."),
         ("S", "And what has it cost you?"), ("P", "It's cost me three years of my life, three years.")]


def _paire2(texte_reste, reponse, presentation):
    tours = synth(PAIRE2 + [("S", texte_reste), ("P", reponse), ("S", "Let me show you the program now.")])
    sols = [sol("Q1", "T001", "P", "What's held you back?", ["T002"]), sol("Q3", "T003", "I", "cost?", ["T004"])]
    atomes = [atome("a1", "BLOCKER", "T002", "I just don't have the confidence", "P", "Q1", "confidence"),
             atome("a2", "IMPACT", "T004", "It's cost me three years of my life", "I", "Q3", "confidence", "time",
                  True, 3, "years")]
    return ctx_de(tours, presentation=presentation, sols=sols, atomes=atomes)


def _reponses_paire2(juste=True):
    cl = [proposition("PROBLEM", "T005", "what's held you back is confidence", "T002", "confidence", as_holding_back=True),
          proposition("COST", "T005", "it's cost you three years", "T004", "three years")]
    a = {("gap.restitution", "restit:T005"): {"clauses": cl, "ends_with_new_topic_question": False}}
    if juste:
        a[("gap.validation", "valid:T005")] = {"outcome": "confirmed", "agreement_quote": "Yeah, exactly."}
    return a


def test_paire_2a_ecart_present():
    ctx = _paire2("So what's held you back is confidence, and it's cost you three years. Fair?", "Yeah, exactly.", "T007")
    res = CompetenceEcart().executer(ctx, executeur(_reponses_paire2()))
    assert res.verdict == "present" and res.raisons == []
    assert res.details["validation_turn"] == "T006" and res.details["restitution_span"] == ["T005", "T005"]
    g6 = next(i for i in res.items if i.id == "G6")
    assert g6.niveau == 1                                                             # confirmé, sans contenu
    assert res.note >= 25                                                           # §5.2 : au moins G5 = G6 = 1
    assert res.details["validated_P"]["key_expression"] == "confidence"


def test_paire_2b_offre_avant_validation_non_validee():
    # assez long pour le signal S2 (ni ouverture ni demande de validation : A1)
    ctx = _paire2("So what's held you back is confidence, you just don't have the confidence, and it's cost you three "
                 "years, you've lost three years of your life. Let me show you how we fix that.",
                 "Okay sounds good to me.", "T007")
    res = CompetenceEcart().executer(ctx, executeur(_reponses_paire2(juste=False)))
    assert res.verdict == "absent" and res.raisons == ["not_validated"]
    assert res.note == 0
    r = res.details["restitutions"][0]
    assert r["validation"]["rule"] == "offer_mentioned_before_validation"           # GB-5, X8


# ------------------------------------------------------------------------------------------- paires 3, 10, 11, 12 (GB-22..24)
def _ctx_proposition(prospect: str, commercial: str):
    ctx = ctx_de(synth([("S", "Tell me more about that."), ("P", prospect), ("S", commercial)]))
    return ctx, Plage("T003", "T003", ["T003"], ["S2"])


@pytest.mark.parametrize("prospect,commercial,ke,attendu_", [
    ("I've lost so much time.", "and you've lost so much time.", "I've lost so much time", "verbatim"),         # 3a
    ("I've lost so much time.", "and you've wasted years on this.", "lost so much time", "paraphrased"),        # 3c
    ("Oh, very stressed.", "and you've been very stressed.", "very stressed", "verbatim"),                       # 10a
    ("Oh, very stressed.", "there's been a lot of stress.", "very stressed", "paraphrased"),                     # 10b
    ("I'm making about 1,800 a month.", "you're at 1,800 a month", "1,800 a month", "verbatim"),                 # 11a
    ("I'm making about 1,800 a month.", "you're at roughly 2K", "1,800 a month", "paraphrased"),                 # 11b
    ("Failure.", "which, in your words, is failure.", "Failure", "verbatim"),                                    # 12a
    ("I wouldn't be happy.", "and in your words you'd be stuck in the hamster wheel.", "I wouldn't be happy",
     "paraphrased"),                                                                                              # 12b
])
def test_paires_mot_pour_mot(prospect, commercial, ke, attendu_):
    ctx, sp = _ctx_proposition(prospect, commercial)
    c = g.classer_proposition(ctx, proposition("COST", "T003", commercial, "T002", ke), sp, None)
    assert c.correspondance == attendu_, c.raison


def test_paire_12a_marqueur_citation_explicite_garde():
    ctx, sp = _ctx_proposition("Failure.", "which, in your words, is failure.")
    c = g.classer_proposition(ctx, proposition("COST", "T003", "which, in your words, is failure.", "T002", "Failure"), sp, None)
    assert c.correspondance == "verbatim" and c.citation_explicite                              # GB-23


def test_paire_3b_cout_invente_par_le_commercial_sans_trace():
    ctx, sp = _ctx_proposition("I just want to design.", "and that's probably costing you a lot of money.")
    c = g.classer_proposition(ctx, proposition("COST", "T003", "that's probably costing you a lot of money", None, None), sp, None)
    assert c.correspondance == "untraced"                                                    # GB-7, X5


def test_expression_cle_generique_rejetee():
    ctx, sp = _ctx_proposition("I want to do a lot of things.", "you want to do a lot of things")
    c = g.classer_proposition(ctx, proposition("B", "T003", "you want to do a lot of things", "T002", "a lot of things"), sp, None)
    assert c.correspondance == "paraphrased" and c.raison == "generic"                      # GB-22 d


def test_un_chiffre_calcule_par_le_commercial_est_exclu():
    """GB-24 / X12 : le commercial calcule 30K, le prospect le répète, le commercial le reprend."""
    tours = synth([("S", "Six times five works out to roughly $30,000 you lost, right?"),
                   ("P", "Yeah I guess it's like 30,000 lost."),
                   ("S", "And that's potentially already cost you 30,000, maybe more.")])
    ctx = ctx_de(tours)
    c = g.classer_proposition(ctx, proposition("COST", "T003", "already cost you 30,000", "T002", "30,000 lost"),
                          Plage("T003", "T003", ["T003"], []), None)
    assert c.correspondance in ("excluded", "paraphrased")
    c2 = g.classer_proposition(ctx, proposition("COST", "T003", "already cost you 30,000", "T002", "30,000"),
                           Plage("T003", "T003", ["T003"], []), None)
    assert c2.correspondance == "excluded" and c2.raison == "first_said_by_sales"


# ------------------------------------------------------------------------------------------- paires 4, 5 (validation)
def _ctx_val(reste: str, reponse: str):
    ctx = ctx_de(synth([("S", "What has it cost you?"), ("P", "Honestly it's cost me three years and my confidence."),
                        ("S", reste), ("P", reponse)]))
    r = restit(ctx, "T003", "T003", [proposition("PROBLEM", "T003", "my confidence", "T002", "my confidence"),
                                     proposition("COST", "T003", "three years", "T002", "three years")])
    return ctx, r


def test_paire_4a_confirme_avec_contenu():
    ctx, r = _ctx_val("So it's your confidence and three years, that's where you're at. Did I get that right?",
                      "Yes, and my husband doesn't believe in it either.")
    vt, pourquoi = g.tour_validation(ctx, r)
    sortie = g.decider_validation(ctx, r, vt, {"outcome": "confirmed_with_content", "agreement_quote": "Yes",
                                           "content_quote": "my husband doesn't believe in it either"})
    assert sortie["outcome"] == "confirmed_with_content"


def test_paire_4b_simple_oui_confirme_meme_si_le_modele_dit_contenu():
    ctx, r = _ctx_val("So it's your confidence and three years, that's where you're at. Did I get that right?", "Yes.")
    vt, _ = g.tour_validation(ctx, r)
    sortie = g.decider_validation(ctx, r, vt, {"outcome": "confirmed_with_content", "content_quote": "Yes."})
    assert sortie["outcome"] == "confirmed"                                            # C3, règle 5


def test_paire_5a_demande_s3_repondue():
    ctx, r = _ctx_val("Your confidence and three years, that's what's been holding you back. Is that fair?", "Yeah.")
    vt, pourquoi = g.tour_validation(ctx, r)
    assert vt is not None and vt.id == "T004" and r.demande_


def test_paire_5b_reponse_a_une_autre_question_aucune():
    ctx = ctx_de(synth([("S", "What has it cost you?"), ("P", "Honestly it's cost me three years and my confidence."),
                        ("S", "Your confidence and three years, that's what's been holding you back. "
                              "How many hours a week can you commit?"), ("P", "Maybe 10.")]))
    r = restit(ctx, "T003", "T003", [proposition("PROBLEM", "T003", "Your confidence", "T002", "my confidence"),
                                     proposition("COST", "T003", "three years", "T002", "three years")],
               nouveau_sujet="How many hours a week can you commit?")
    vt, pourquoi = g.tour_validation(ctx, r)
    assert vt is None and pourquoi == "captured_by_other_question"                       # GB-9, X7


def test_gb15_non_a_rien_oublie_est_confirme():
    ctx, r = _ctx_val("Confidence and three years. Did I miss anything?", "No.")
    vt, _ = g.tour_validation(ctx, r)
    assert g.decider_validation(ctx, r, vt, {"outcome": "rejected"})["outcome"] == "confirmed"


def test_gb16_accord_partiel_avec_correction_est_corrige():
    ctx, r = _ctx_val("Confidence and three years. Did I get that right?", "99%, except it's more like four years.")
    vt, _ = g.tour_validation(ctx, r)
    sortie = g.decider_validation(ctx, r, vt, {"outcome": "confirmed", "correction_quote": "it's more like four years",
                                           "corrected_components": ["COST"]})
    assert sortie["outcome"] == "corrected"


def test_gb17_reaction_emotionnelle_est_du_contenu():
    ctx, r = _ctx_val("Confidence and three years. Did I get that right?", "Why do you have to go saying that?")
    vt, _ = g.tour_validation(ctx, r)
    sortie = g.decider_validation(ctx, r, vt, {"outcome": "confirmed", "emotional_reaction": True, "disagreement": False})
    assert sortie["outcome"] == "confirmed_with_content"


def test_gb26_repeter_les_mots_du_commercial_est_confirme():
    ctx, r = _ctx_val("You're stuck in the hamster wheel with your confidence and three years. Right?",
                      "Yes, I'm stuck in the hamster wheel.")
    vt, _ = g.tour_validation(ctx, r)
    sortie = g.decider_validation(ctx, r, vt, {"outcome": "confirmed_with_content",
                                           "content_quote": "I'm stuck in the hamster wheel"})
    assert sortie["outcome"] == "confirmed"


# ------------------------------------------------------------------------------------------- paires 6, 9a (composantes)
def test_paire_6a_autre_personne_pas_composante_6b_oui():
    ctx, sp = _ctx_proposition("I'm stuck at 2K a month.", "Amelia was exactly where you are, stuck at 2K. You're stuck at 2K")
    c6a = g.classer_proposition(ctx, proposition("A", "T003", "Amelia was exactly where you are, stuck at 2K", "T002", "stuck at 2K",
                                        about_prospect=False), sp, None)
    c6b = g.classer_proposition(ctx, proposition("A", "T003", "You're stuck at 2K", "T002", "stuck at 2K"), sp, None)
    assert c6a.correspondance == "excluded" and c6b.correspondance == "verbatim"


def test_paire_9a_le_revenu_n_est_jamais_un_cout():
    ctx = ctx_de(synth([("S", "What do you make at your job?"), ("P", "I make 4K at my job right now."),
                        ("S", "You make 4K at your job.")]),
                 atomes=[atome("a1", "SITUATION", "T002", "I make 4K at my job", "S", None, None, "money", True, 4000,
                             "USD/month")])
    c = g.classer_proposition(ctx, proposition("COST", "T003", "You make 4K at your job", "T002", "I make 4K at my job"),
                          Plage("T003", "T003", ["T003"], []), None)
    assert c.correspondance == "excluded" and c.raison == "income_not_cost"                 # X6


def test_paire_9b_cout_temps_et_argent_chiffre():
    tours = synth([("S", "What does that cost you?"),
                   ("P", "I'm spending 20 hours a week on admin work that pays 23 dollars an hour."),
                   ("S", "You're spending 20 hours a week on admin work that pays 23 dollars an hour.")])
    ctx = ctx_de(tours, atomes=[atome("a1", "IMPACT", "T002", "I'm spending 20 hours a week on admin work", "I", None,
                                    "admin", "time", True, 20, "hours/week")])
    c = g.classer_proposition(ctx, proposition("COST", "T003", "You're spending 20 hours a week on admin work", "T002",
                                      "spending 20 hours a week on admin work"), Plage("T003", "T003", ["T003"], []), None)
    assert c.correspondance == "verbatim" and c.atome_source == "a1"


# ------------------------------------------------------------------------------------------- paire 7 (fenêtre)
def test_paire_7a_7b_avant_et_apres_presentation():
    for presentation, attendu_ in (("T007", "present"), ("T005", "absent")):
        ctx = _paire2("So what's held you back is confidence, and it's cost you three years. Fair?", "Yeah, exactly.",
                     presentation)
        res = CompetenceEcart().executer(ctx, executeur(_reponses_paire2()))
        assert res.verdict == attendu_
        if attendu_ == "absent":
            assert res.raisons == ["restitution_after_pitch"]                       # X3, GB-20


# ------------------------------------------------------------------------------------------- paire 8 (corrections)
PAIRE8 = [("S", "What's held you back?"), ("P", "Honestly confidence, I just don't have the confidence."),
         ("S", "And what has it cost you, in money?"), ("P", "It's cost me about 4K a month, every month."),
         ("S", "So what's held you back is confidence, and it's cost you about 4K a month. Did I get that right?"),
         ("P", "Not quite, it's more like 3K, not 4K.")]


def _paire8(reformuler: str, reponses_sup: dict):
    tours = synth(PAIRE8 + [("S", reformuler), ("P", "Exactly."), ("S", "Let me show you the program.")])
    ctx = ctx_de(tours, presentation="T009")
    a = {("gap.restitution", "restit:T005"): {"clauses": [
        proposition("PROBLEM", "T005", "what's held you back is confidence", "T002", "confidence", as_holding_back=True),
        proposition("COST", "T005", "it's cost you about 4K a month", "T004", "4K a month")]},
        ("gap.validation", "valid:T005"): {"outcome": "corrected", "correction_quote": "it's more like 3K",
                                            "corrected_components": ["COST"]}}
    a.update(reponses_sup)
    return ctx, executeur(a)


def test_paire_8a_corrige_puis_reformule_et_confirme_passe():
    ctx, rn = _paire8("Got it, 3K a month, and that's because of confidence.", {
        ("gap.restitution", "restit:T007"): {"clauses": [
            proposition("COST", "T007", "Got it, 3K a month", "T006", "3K"),
            proposition("PROBLEM", "T007", "that's because of confidence", "T002", "confidence")]},
        ("gap.validation", "valid:T007"): {"outcome": "confirmed", "agreement_quote": "Exactly."}})
    res = CompetenceEcart().executer(ctx, rn)
    assert res.verdict == "present"
    corr = res.details["diagnostics"]["corrections"]
    assert corr and corr[0]["effective"] == "corrected_then_confirmed"
    assert next(i for i in res.items if i.id == "G6").niveau == 1


def test_paire_8b_correction_non_reformulee_echoue():
    ctx, rn = _paire8("Got it. So let me show you the program.", {})
    res = CompetenceEcart().executer(ctx, rn)
    assert res.verdict == "absent" and res.raisons == ["not_validated"]            # X9


# ------------------------------------------------------------------------------------------- paires 13..15 (formule)
def test_paire_15a_15b_meme_unite_et_unites_differentes():
    a = g.Enonce("A", "a1", "about 2K a month", "T002", "S", "Q1", None, "money", True, 2000, "USD/month", "SITUATION")
    b1 = g.Enonce("B", "b1", "10K a month", "T004", "N", "Q2", None, "money", True, 10000, "USD/month", "DESIRE")
    b2 = g.Enonce("B", "b2", "to quit my job", "T004", "N", "Q2", None, None, False, None, "status", "DESIRE")
    ctx = ctx_de(synth([("S", "x"), ("P", "about 2K a month"), ("S", "y"), ("P", "10K a month, to quit my job")]))
    sa, sb, regle = g.choisir_a_b(ctx, [a], [b1])
    assert (sa.id_atome, sb.id_atome, regle) == ("a1", "b1", "same_unit")
    items = g.noter_items(ctx, None, sa, sb, None, None, None, {})
    assert next(i for i in items if i.id == "G3").niveau == 2
    sa, sb, regle = g.choisir_a_b(ctx, [a], [b2])
    items = g.noter_items(ctx, None, sa, sb, None, None, None, {})
    assert next(i for i in items if i.id == "G3").niveau == 0                       # unit_mismatch


def test_paire_14a_14b_un_blocage_et_plusieurs_blocages():
    tours = synth([("S", "What's held you back?"), ("P", "One, self-doubt. Two, change is scary."),
                   ("S", "And what has that cost you?"), ("P", "Two years, I've lost two years."),
                   ("S", "What's holding you back today is self-doubt, and it's cost you two years. Fair?"),
                   ("S", "What's holding you back is self-doubt, fear of change, and it's cost you two years. Fair?")])
    sols = [sol("Q1", "T001", "P", "What's held you back?", ["T002"])]
    atomes = [atome("p1", "BLOCKER", "T002", "One, self-doubt", "P", "Q1", "self-doubt"),
             atome("p2", "BLOCKER", "T002", "Two, change is scary", "P", "Q1", "fear of change")]
    ctx = ctx_de(tours, sols=sols, atomes=atomes)
    st = g.enonces_depuis_atomes(ctx)
    choix_p, regle = g.choisir_p(ctx, st["PROBLEM"], [sols[0]], ctx.atomes)
    assert choix_p.id_atome == "p1" and regle == "tie_named_first"                     # GB-30 étape 3
    r14a = restit(ctx, "T005", "T005", [
        proposition("PROBLEM", "T005", "What's holding you back today is self-doubt", "T002", "self-doubt",
               as_holding_back=True),
        proposition("COST", "T005", "it's cost you two years", "T004", "two years")])
    conf = g.conformite_formule(ctx, r14a, None, None, choix_p)
    assert conf["single_P"] and conf["P_selected"] and "several_blockers" not in conf["deviations"]
    r14b = restit(ctx, "T006", "T006", [
        proposition("PROBLEM", "T006", "What's holding you back is self-doubt", "T002", "self-doubt", as_holding_back=True),
        proposition("PROBLEM", "T006", "fear of change", "T002", "change", as_holding_back=True),
        proposition("COST", "T006", "it's cost you two years", "T004", "two years")])
    conf = g.conformite_formule(ctx, r14b, None, None, choix_p)
    assert "several_blockers" in conf["deviations"] and not conf["conforms"]       # X14
    assert len(g.blocages_feuille_route(ctx, None)) == 2                                   # GB-32


# ------------------------------------------------------------------------------------------- priorité GB-20
def test_gb20_passage_apres_presentation_avant_cout_manquant():
    def R(comps, avant, issue="confirmed"):
        r = Restitution(Plage("T001", "T001", ["T001"], []), "verified")
        r.est_restitution, r.apres_presentation, r.issue_effective = True, not avant, issue
        r.propositions = [g.Proposition(c, "q", "T001", "T000", "k", correspondance="verbatim") for c in comps]
        return r
    verdict, raisons, _ = g.porte([R(["PROBLEM", "A"], True), R(["PROBLEM", "COST"], False)])
    assert verdict == "absent" and raisons == ["restitution_after_pitch", "cost_missing"]
    assert g.porte([])[1] == ["no_restitution"]
    assert g.porte([R(["PROBLEM", "COST"], True, "none")])[1] == ["not_validated"]


def test_seuil_alerte_copilote():
    assert g.alerte_copilote([{"object": "x"}, {"object": "y"}]) is True
    assert g.alerte_copilote([{"object": "x"}, {"object": "y"}, {"object": "z"}]) is False


# =========================================================================================== annexe B, vrais appels
def test_B3_1_appel_001_ecart_present_G5_plafonne():
    """B1.1 / B2.1 / B3.1 : PROBLEM "support" (T028) et COST "motivation" (T052) mot pour mot ; "a lot of stress"
    pas mot pour mot (T050 "stressed") ; B paraphrasé ; "No. Cool." confirmé ; avant la présentation T085 et le prix
    T113."""
    tours = charger_tours("001")
    sols = [sol("Q025", "T025", "P", tours[24].texte, ["T026", "T028"]),
            sol("Q033", "T033", "N", tours[32].texte, ["T034"]),
            sol("Q035", "T035", "S", tours[34].texte, ["T036", "T038"]),
            sol("Q049", "T049", "I", tours[48].texte, ["T050"]),
            sol("Q051", "T051", "I", tours[50].texte, ["T052"]),
            sol("Q069", "T069", "N", tours[68].texte, ["T070"])]
    atomes = [atome("a28", "PAIN", "T028", "I need the kind of coaching that's going to help support me", "P", "Q025",
                  "marketing support"),
             atome("a34", "DESIRE", "T034", "I would say minimum $5,000", "N", "Q033", None, "money", True, 5000,
                  "USD/month"),
             atome("a36", "SITUATION", "T036", "it's like $23 an hour", "S", "Q035", None, "money", True, 23, "USD/hour"),
             atome("a50", "IMPACT", "T050", "Oh, very stressed, stressed", "I", "Q049", "marketing support", "health"),
             atome("a52", "IMPACT", "T052", "It's like my motivation gets, you know, I basically don't have any", "I",
                  "Q051", "marketing support", "self-belief"),
             atome("a70", "DESIRE", "T070", "I feel like I'm not getting paid what I'm worth often", "N", "Q069")]
    ctx = ctx_de(tours, decouverte="T017", presentation="T085", prix="T113", sols=sols, atomes=atomes)
    t81 = "T081"
    reponses = {
        ("gap.restitution", "restit:T079"): {"clauses": [
            proposition("A", t81, "you're in this position now where life has kind of thrown you off course pretty hard"),
            proposition("COST", t81, "There's been a lot of stress", "T050", "very stressed"),
            proposition("COST", t81, "it's obviously impacting your level of motivation", "T052", "motivation"),
            proposition("B", t81, "the amount of money you have in your bank account reflected the value", "T070",
                   "paid what I'm worth"),
            proposition("PROBLEM", t81, "it's just having the right support system in place to help you build a portfolio",
                   "T028", "support", as_holding_back=True)],
            "ends_with_new_topic_question": False},
        ("gap.validation", "valid:T079"): {"outcome": "confirmed", "agreement_quote": "No. Cool."}}
    res = CompetenceEcart().executer(ctx, executeur(reponses))
    d = res.details
    assert res.statut == "scored" and res.verdict == "present", res.raisons
    assert d["restitution_span"] == ["T079", "T081"] and d["validation_turn"] == "T082"
    comps = d["restitution"]["components"]
    assert comps["PROBLEM"]["match"] == "verbatim" and comps["PROBLEM"]["key_expression"] == "support"
    assert comps["COST"]["match"] == "verbatim" and comps["COST"]["key_expression"] == "motivation"
    assert comps["B"]["match"] == "paraphrased"                                    # T070 "paid what I'm worth"
    stress = next(c for c in d["restitution"]["clauses"] if c["key_expression"] == "very stressed")
    assert stress["match"] == "paraphrased" and stress["reason"] == "not_in_restitution"   # GB-22 b
    niveaux = {i.id: i.niveau for i in res.items}
    assert niveaux["G5"] == 1 and niveaux["G6"] == 1                                  # B3.1 : G5 = 1
    assert d["validated_P"]["turn"] == "T028" and d["selected_P"]["turn"] == "T028"
    assert d["selected_B"]["turn"] == "T034"
    assert res.note == g.note_appel(res.items) and res.note >= 25


def test_B3_2_appel_049_ecart_present_chaque_composante_mot_pour_mot():
    """B1.2 / B3.2 : A "not in a steady paying gig" (T049), PROBLEM "as a need" (T071), COST "not sleeping well"
    (T131), confirmé "Pretty much. Yes." (GB-16) ; G5 = 2 possible (expressions clés de 3 mots ou plus)."""
    tours = charger_tours("049")
    ctx = ctx_de(tours, decouverte="T024", presentation="T150")
    # fondation C1 : la question du commercial fusionnée dans T079 est séparée avant toute compétence (GB-21)
    reparer_attribution(ctx, [{"turn": "T079", "type": "merged",
                              "foreign_quote": "And when that fear showed up, how did it actually shape your actions?"}])
    assert ctx.tour("T079b").role == COMMERCIAL and "fear" not in ctx.tour("T079").texte.lower()
    t = {x.id: x for x in ctx.tours}
    ctx.sollicitations = [sol("Q024", "T024", "N", t["T024"].texte, ["T025"]),
                         sol("Q038", "T038", "N", t["T038"].texte, ["T039"]),
                         sol("Q048", "T048", "S", t["T048"].texte, ["T049"]),
                         sol("Q070", "T070", "P", t["T070"].texte, ["T071"]),
                         sol("Q130", "T130", "I", t["T130"].texte, ["T131"])]
    ctx.atomes = [atome("b25", "DESIRE", "T025", "have a really good business with happy, fun, easy clients", "N", "Q024",
                      None, None, False, None, "status"),
                 atome("b39", "DESIRE", "T039", "10 to 15,000 a month", "N", "Q038", None, "money", True, 10000,
                      "USD/month"),
                 atome("a49", "SITUATION", "T049", "Right now, I'm not in a steady paying gig", "S", "Q048", None, None,
                      False, None, "status"),
                 atome("a49b", "SITUATION", "T049", "I have credit card debt", "S", "Q048", None, "money"),
                 atome("p71", "BLOCKER", "T071", "I haven't treated it as a need ever", "P", "Q070",
                      "treating it as a want"),
                 atome("c131", "IMPACT", "T131", "But come home miserable, bring that to the house", "I", "Q130",
                      "treating it as a want", "family"),
                 atome("c131b", "IMPACT", "T131", "stressed, not sleeping well", "I", "Q130", "treating it as a want",
                      "health")]
    s148 = "T148"
    reponses = {
        ("gap.restitution", "restit:T148"): {"clauses": [
            proposition("A", s148, "right now we're in a situation where we're not in a steady paying gig", "T049",
                   "not in a steady paying gig"),
            proposition("A", s148, "you've got some credit card debt", "T049", "credit card debt"),
            proposition("B", s148, "You want your own interior design business", "T025", "business"),
            proposition("PROBLEM", s148, "the main thing that's been getting in the way is not treating your goals as a need",
                   "T071", "as a need", as_holding_back=True),
            proposition("PROBLEM", s148, "allowing fear to dictate your action", "T079", "fear", as_holding_back=True),
            proposition("COST", s148, "coming home miserable, stressed, depressed, and not sleeping well", "T131",
                   "not sleeping well"),
            proposition("COST", s148, "you end up working for somebody else, coming home miserable", "T131", "miserable")],
            "ends_with_new_topic_question": False},
        ("gap.validation", "valid:T148"): {"outcome": "confirmed", "agreement_quote": "Pretty much. Yes."}}
    res = CompetenceEcart().executer(ctx, executeur(reponses))
    d = res.details
    assert res.verdict == "present" and d["validation_turn"] == "T149"
    comps = d["restitution"]["components"]
    assert all(comps[c]["match"] == "verbatim" for c in ("A", "B", "PROBLEM", "COST"))
    assert comps["PROBLEM"]["key_expression"] == "as a need"
    peur = next(c for c in d["restitution"]["clauses"] if c["key_expression"] == "fear")
    assert peur["match"] == "paraphrased" and peur["reason"] == "not_in_source"   # mots du commercial après la réparation C1
    conf = d["restitution"]["conformity"]
    assert conf["long_key_expression"] and conf["single_P"] and conf["P_selected"]
    assert d["selected_A"]["turn"] == "T049" and d["selected_B"]["turn"] == "T025"
    niveaux = {i.id: i.niveau for i in res.items}
    assert niveaux["G5"] == 2 and niveaux["G6"] == 1                                 # "pretty much" = confirmé
    assert niveaux["G4"] == 1                                                         # coût dans un domaine, pas chiffré


def test_B3_9_appel_027_restitution_apres_presentation():
    """B1.8 / B1.10 / B3.9 : T050 n'est pas une restitution (PROBLEM "finances" paraphrasé, une seule composante
    restante, se termine par une nouvelle question) ; T090 complète et confirmée, mais après le partage d'écran en
    T086."""
    tours = charger_tours("027")
    sols = [sol("Q032", "T032", "N", tours[31].texte, ["T033"]),
            sol("Q034", "T034", "S", tours[33].texte, ["T035"]),
            sol("Q038", "T038", "S", tours[37].texte, ["T039"]),
            sol("Q054", "T054", "P", tours[53].texte, ["T055", "T057"]),
            sol("Q082", "T082", "I", tours[81].texte, ["T083"])]
    atomes = [atome("b33", "DESIRE", "T033", "gradually, you know, 10 and beyond", "N", "Q032", None, "money", True,
                  10000, "USD/month"),
             atome("a35", "SITUATION", "T035", "I am working part-time for my great-grandmother as her caregiver", "S",
                  "Q034"),
             atome("a39", "SITUATION", "T039", "I'll say the last three", "S", "Q038", None, "time", True, 3, "years"),
             atome("p55", "BLOCKER", "T055", "My preconceived limitations", "P", "Q054", "other people's expectations"),
             atome("p57", "BLOCKER", "T057", "falling into other people's expectations of me", "P", "Q054",
                  "other people's expectations"),
             atome("c83", "IMPACT", "T083", "It feels like a nightmare", "I", "Q082", "other people's expectations",
                  "self-belief")]
    ctx = ctx_de(tours, decouverte="T017", presentation="T086", prix="T118", sols=sols, atomes=atomes)
    reponses = {
        ("gap.restitution", "restit:T050"): {"clauses": [
            proposition("A", "T050", "we've spent the last three years researching", "T039", "the last three"),
            proposition("PROBLEM", "T050", "one of the biggest bottlenecks has been finances", "T047", "close to $3,000",
                   as_holding_back=True)],
            "ends_with_new_topic_question": True,
            "new_topic_question_quote": "who do you genuinely believe is to find success faster?"},
        ("gap.restitution", "restit:T090"): {"clauses": [
            proposition("A", "T090", "you are working part-time for your grandmother", "T035", "working part-time for my"),
            proposition("PROBLEM", "T090", "the biggest thing thing to hold us back is the expectations of other people",
                   "T057", "the expectations", as_holding_back=True),
            proposition("B", "T090", "you want to make 10K a month", "T033", "10"),
            proposition("COST", "T090", "you stay exactly where you are, and that's a nightmare", "T083", "a nightmare")],
            "ends_with_new_topic_question": False},
        ("gap.validation", "valid:T090"): {"outcome": "confirmed", "agreement_quote": "Yes."}}
    res = CompetenceEcart().executer(ctx, executeur(reponses))
    d = res.details
    assert res.verdict == "absent" and res.raisons[0] == "restitution_after_pitch" and res.note == 0
    by = {tuple(r["span"]): r for r in d["restitutions"]}
    r50, r90 = by[("T050", "T050")], by[("T090", "T090")]
    assert not r50["is_restitution"]                                                 # GB-4
    assert r50["components"]["PROBLEM"]["match"] == "paraphrased"                   # X11
    assert r90["is_restitution"] and not r90["before_first_pitch"]                   # X3
    assert {k for k, v in r90["components"].items() if v and v["match"] == "verbatim"} >= {"A", "PROBLEM", "COST"}
    assert r90["validation"]["outcome"] == "confirmed"
    assert d["diagnostics"]["collected_not_formalised"]["COST"] is True
    assert all(i.niveau == 0 for i in res.items)


def test_B4_1_appel_078_A_choisi_revenu_actuel_pas_passe():
    """B4.1 : A = "$87,000" (réponse S), B = "a hundred" (même unité) ; "over $100,000" est un revenu passé (X13)."""
    tours = charger_tours("078")
    sols = [sol("Q045", "T045", "S", tours[44].texte, ["T046"]), sol("Q105", "T105", "N", tours[104].texte, ["T106"])]
    atomes = [atome("a87", "SITUATION", "T046", "$87,000", "S", "Q045", None, "money", True, 87000, "USD/year"),
             atome("a100", "SITUATION", "T046", "I made over $100,000", "S", "Q045", None, "money", True, 100000,
                  "USD/year"),
             atome("b100", "DESIRE", "T106", "ideally if I can meet to where we're at a hundred", "N", "Q105", None,
                  "money", True, 100000, "USD/year")]
    ctx = ctx_de(tours, decouverte="T020", presentation="T185", sols=sols, atomes=atomes)
    passe_ = {("gap.a_current", "acur:a100"): {"present_state": False, "quote": "I made over $100,000"}}
    d = CompetenceEcart().executer(ctx, executeur(passe_)).details
    assert d["selected_A"]["quote"] == "$87,000" and d["selected_B"]["atom"] == "b100"
    assert d["selected_B"]["same_unit"] and d["diagnostics"]["gap_value"] == 13000
    assert d["selected_B"]["horizon"] is None                                        # aucune échéance donnée
    # sans le contrôle de l'état actuel, le chiffre le plus grand et le plus récent (revenu passé) serait pris : X13
    d2 = CompetenceEcart().executer(ctx_de(tours, decouverte="T020", presentation="T185", sols=sols, atomes=atomes), executeur({})).details
    assert d2["selected_A"]["quote"] == "I made over $100,000"


def test_B4_2_appel_024_plusieurs_blocages_et_feuille_route():
    """B4.2 / B1.7 : trois blocages dans une même réponse à une question de blocage ; la restitution T103 en reprend
    deux (`several_blockers`, G5 plafonné) ; COST sans trace, donc la porte échoue ; 3 blocages pour la feuille de
    route, pas d'alerte du Copilote."""
    tours = charger_tours("024")
    sols = [sol("Q041", "T041", "P", tours[40].texte, ["T042"])]
    atomes = [atome("p1", "BLOCKER", "T042", "maybe limiting self-beliefs or having self-doubts", "P", "Q041", "self-doubt"),
             atome("p2", "BLOCKER", "T042", "Two, change is scary", "P", "Q041", "fear of change"),
             atome("p3", "BLOCKER", "T042", "not knowing what the next step is", "P", "Q041", "next step")]
    ctx = ctx_de(tours, decouverte="T020", presentation="T105", sols=sols, atomes=atomes)
    reponses = {
        ("gap.restitution", "restit:T103"): {"clauses": [
            proposition("PROBLEM", "T103", "the biggest thing that's been getting in the way is fear of change", "T042",
                   "change", as_holding_back=True),
            proposition("PROBLEM", "T103", "and the self-doubt, which is normal", "T042", "self-doubts", as_holding_back=True),
            proposition("A", "T103", "right now, you're in communications", "T024", "communications"),
            proposition("B", "T103", "working remotely", "T056", "work remotely"),
            proposition("COST", "T103", "you will be selling for a life that you know deep down you don't actually want")],
            "ends_with_new_topic_question": False},
        ("gap.validation", "valid:T103"): {"outcome": "confirmed", "agreement_quote": "Yes."}}
    res = CompetenceEcart().executer(ctx, executeur(reponses))
    d = res.details
    assert d["selected_P"]["rule"] in ("tie_named_first", "comes_back_most")       # GB-30 étape 2/3 entre les trois
    r = next(x for x in d["restitutions"] if x["span"][0] == "T103")
    assert "several_blockers" in r["conformity"]["deviations"]
    assert res.verdict == "absent" and res.raisons == ["cost_missing"]
    assert d["roadmap"]["count"] == 3 and d["roadmap"]["warning"] is False
    assert "roadmap_insufficient_blockers" not in res.signaux


def test_cles_du_contrat_d_etat_partage():
    ctx = _paire2("So what's held you back is confidence, and it's cost you three years. Fair?", "Yeah, exactly.", "T007")
    d = CompetenceEcart().executer(ctx, executeur(_reponses_paire2())).details
    for k in ("verdict", "validation_turn", "restitution_span", "selected_A", "selected_B", "selected_P",
              "validated_P", "roadmap_blockers", "cost"):
        assert k in d
    assert d["roadmap"]["warning"] is True                                          # 1 blocage < 3 étapes (GB-33)


# =========================================================================================== listes de mots françaises
def _n(texte: str) -> str:
    return normaliser(texte)


@pytest.mark.parametrize("phrase", [
    "Donc si je résume, tu donnes des cours de piano depuis trois ans.",
    "Si j'ai bien compris, vous plafonnez à 800 euros par mois.",
    "Corrige-moi si je me trompe, mais ton objectif c'est 2000 par mois.",
    "OK, ce que j’entends, c'est que tu manques de temps.",          # apostrophe typographique
    "Alors pour resumer, tu veux vivre de tes cours.",                # sans accent
    "Laissez-moi reformuler ce que vous m'avez dit.",
])
def test_ouvertures_francaises(phrase):
    assert g.OUVERTURES.search(" ".join(_n(phrase).split()[:g.S1_PREMIERS_MOTS]))


def test_ouverture_absente_dans_une_question_de_decouverte():
    assert not g.OUVERTURES.search(_n("Tu donnes des cours depuis combien de temps ?"))


@pytest.mark.parametrize("texte", [
    "Tu plafonnes à 800 euros et ça te coûte tes soirées. C'est bien ça ?",
    "Tu plafonnes à 800 euros et ça te coûte tes soirées, non ?",
    "Tu plafonnes à 800 euros et ça te coûte tes soirées. J'ai bien résumé ?",
    "Vous plafonnez à 800 euros. Est-ce que je me trompe ?",
    "Tu plafonnes à 800 euros. Ça te parle ?",
    "Tu plafonnes à 800 euros. C'est ça?",
    "Tu plafonnes à 800 euros. J'ai oublié quelque chose ?",
    "Tu plafonnes à 800 euros. On est bien d'accord ?",
])
def test_demandes_de_validation_francaises(texte):
    assert g.demande_validation(texte)                                               # S3


def test_question_sur_un_nouveau_sujet_n_est_pas_une_demande_de_validation():
    assert g.demande_validation("Tu plafonnes à 800 euros. Tu as combien d'élèves aujourd'hui ?") is None


@pytest.mark.parametrize("demande,attendu_", [
    ("J'ai oublié quelque chose ?", True), ("Est-ce que je me trompe ?", True), ("J'ai rien oublié ?", True),
    ("Il te manque quelque chose ?", True), ("Je me suis trompé quelque part ?", True),
    ("J'ai bien résumé ?", False), ("Qu'est-ce qui te manque pour te lancer ?", False),
])
def test_gb15_demandes_francaises_ou_un_non_vaut_accord(demande, attendu_):
    assert bool(g.DEMANDE_MANQUANTE.search(_n(demande))) is attendu_


def test_gb15_non_a_j_ai_oublie_quelque_chose_est_confirme():
    ctx = ctx_de(synth([("S", "Qu'est-ce que ça t'a coûté ?"), ("P", "Honnêtement, ça m'a coûté trois ans et ma confiance."),
                        ("S", "Ta confiance et trois ans. J'ai oublié quelque chose ?"), ("P", "Non.")]))
    r = restit(ctx, "T003", "T003", [proposition("PROBLEM", "T003", "Ta confiance", "T002", "ma confiance"),
                                     proposition("COST", "T003", "trois ans", "T002", "trois ans")])
    vt, _ = g.tour_validation(ctx, r)
    assert g.decider_validation(ctx, r, vt, {"outcome": "rejected"})["outcome"] == "confirmed"      # GB-15


@pytest.mark.parametrize("texte,attendu_", [
    ("Laisse-moi te montrer comment on t'aide à trouver tes élèves.", True),
    ("Je vais vous montrer notre accompagnement.", True),
    ("Dans notre programme, il y a trois étapes.", True),
    ("Nos modules et nos séances sont en ligne.", True),
    ("Avec notre coaching et notre suivi, tu avances vite.", True),
    ("Je partage mon écran.", True),
    ("Tu as suivi une formation l'an dernier et tu fais deux séances par semaine.", False),
])
def test_mots_de_l_offre_francais(texte, attendu_):
    assert bool(g.MOTS_OFFRE.search(_n(texte))) is attendu_                         # GB-1, GB-5


@pytest.mark.parametrize("question,attendu_", [
    ("Qu'est-ce qui t'a retenu jusqu'ici ?", True), ("Qu'est-ce qui vous en empêche ?", True),
    ("Qu'est-ce qui te bloque ?", True), ("Pourquoi tu ne l'as pas encore fait ?", True),
    ("C'est quoi tes freins ?", True), ("Qu'est-ce qui se met en travers de ton chemin ?", True),
    ("Qu'est-ce que tu as retenu de ta dernière formation ?", False), ("Tu as combien d'élèves ?", False),
])
def test_questions_de_blocage_francaises(question, attendu_):
    assert bool(g.QUESTION_BLOCAGE.search(_n(question))) is attendu_                # GB-30 étape 1


@pytest.mark.parametrize("commercial", ["et, pour reprendre tes mots, tu te sens nul.",
                                        "et comme tu l'as dit, tu te sens nul.",
                                        "et, avec vos propres mots, vous vous sentez nul."])
def test_marqueurs_de_citation_francais(commercial):
    ctx, sp = _ctx_proposition("Je me sens nul.", commercial)
    c = g.classer_proposition(ctx, proposition("COST", "T003", commercial, "T002", "nul"), sp, None)
    assert c.correspondance == "verbatim" and c.citation_explicite                  # GB-23


def test_sans_marqueur_de_citation():
    ctx, sp = _ctx_proposition("Je me sens nul.", "et tu te sens nul.")
    c = g.classer_proposition(ctx, proposition("COST", "T003", "et tu te sens nul.", "T002", "nul"), sp, None)
    assert c.correspondance == "verbatim" and not c.citation_explicite


def test_s2_passage_dense_a_la_deuxieme_personne_en_francais():
    """SUJET_TU, MOTS_AMORCE (« du coup ») et la coupure en propositions sur « et » / « mais » (A1 S2)."""
    prospect = "Je donne des cours de piano depuis trois ans mais je plafonne à 800 euros par mois."
    commercial = ("Du coup tu donnes des cours de piano depuis trois ans et tu plafonnes à 800 euros par mois, mais "
                  "ton objectif c'est de vivre de tes cours de piano sereinement.")
    ctx = ctx_de(synth([("P", prospect), ("S", commercial)]))
    assert "S2" in g.signaux_candidats(ctx, ctx.tour("T002"), set(jetons_propres(prospect)))


def test_sujet_tu_et_deuxieme_personne_francais():
    assert {"tu", "vous", "t'as", "ton", "ta", "tes", "votre", "vos"} <= g.SUJET_TU
    assert g.SUJET_TU <= g.DEUXIEME_PERSONNE
    assert {"tu", "vous", "te", "toi", "tien", "vôtre"} <= g.DEUXIEME_PERSONNE


@pytest.mark.parametrize("phrase,attendu_", [
    ("Est-ce que tu as déjà des élèves", True), ("Donc as-tu déjà essayé", True), ("Pouvez-vous me dire", True),
    ("Et a-t-il déjà payé", True), ("Donc tu as déjà des élèves", False), ("Rendez-vous pris pour jeudi", False),
])
def test_questions_sans_point_d_interrogation_en_francais(phrase, attendu_):
    assert bool(g.INTERROGATIF.match(_n(phrase))) is attendu_


@pytest.mark.parametrize("tour,attendu_", [
    ("Ouais, d'accord.", True), ("Oui oui, c'est clair.", True), ("Ok, je vois.", True), ("Exactement.", True),
    ("Ah ouais, carrément.", True), ("Tout à fait.", True), ("Bien sûr, voilà.", True),
    ("Oui, mais pas trop.", False), ("Je donne des cours le soir.", False),
])
def test_relances_d_ecoute_francaises(tour, attendu_):
    assert g.approbation_courte(tour) is attendu_                                    # GB-1


def test_consignes_traduites_gardent_le_schema():
    ctx, r = _ctx_val("Ta confiance et trois ans. C'est bien ça ?", "Oui.")
    vt, _ = g.tour_validation(ctx, r)
    consigne = g.construire_validation(ctx, (r, vt))
    assert "TOUR DE VALIDATION : T004" in consigne
    assert '"outcome": "confirmed_with_content|confirmed|corrected|rejected|none"' in consigne
    md = (Path(g.__file__).parent.parent / "consignes" / "ecart_validation.md").read_text(encoding="utf-8")
    assert "TOUR DE VALIDATION" in md and "confirmed_with_content" in md
