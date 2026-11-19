"""Tests of the Objection Removal module (OBJ-1.1).

Part 1: Annex A minimal pairs and added rules as pure decision tests (no model).
Part 2: bounding on synthetic calls with mock answers (OB-10 minimal pair 8a/8b, OB-22, OB-11).
Part 3: Annex B cases on the real transcripts with mock model answers.
"""
from __future__ import annotations
import os

import re
from pathlib import Path

import pytest

from lnp_analyse.noyau.client_modele import ClientSimule
from lnp_analyse.noyau.modeles import ContexteAppel, Preuve, PROSPECT, COMMERCIAL, Tour
from lnp_analyse.noyau.executeur import Executeur
from lnp_analyse.competences import objections as O
from lnp_analyse.competences.objections import CompetenceObjections

EXECUTIONS = Path(os.environ.get("CALLQA_CORPUS", str(Path(__file__).parent / "fixtures" / "transcripts")))


# ----------------------------------------------------------------------------------------------- helpers
def synth(lignes: list[tuple[str, str]], **phases) -> ContexteAppel:
    tours = [Tour(f"T{i:03d}", i, f"00:{i:02d}", r, r, txt) for i, (r, txt) in enumerate(lignes, 1)]
    ctx = ContexteAppel("synthetic", "s1", "2026-10-01T10:00:00Z", "UTC", tours, reference_offre={"price": 5800})
    for k, v in phases.items():
        setattr(ctx.phases, k, v)
    return ctx


def charger(n: str, **phases) -> ContexteAppel:
    tours = []
    for ligne in (EXECUTIONS / n / "transcript_compact.txt").read_text(encoding="utf-8").splitlines():
        m = re.match(r"^\[(T\d+[a-z]?) ([\d:]+)\] (SALES|PROSPECT|OTHER): ?(.*)$", ligne.strip())
        if m:
            tours.append(Tour(m[1], len(tours) + 1, m[2], m[3], m[3], m[4]))
    ctx = ContexteAppel(n, "valentino", "2026-07-01T10:00:00Z", "UTC", tours, reference_offre={"price": 5800})
    for k, v in phases.items():
        setattr(ctx.phases, k, v)
    return ctx


def defauts(ctx: ContexteAppel):
    """Fallback answers: 'nothing found' for every unit not mocked explicitly (quotes built from the prompt)."""
    def fb(id_tache, id_unite, consigne, no_passe):
        if id_tache == "obj.nominate":
            return {"nominations": []}
        if id_tache == "obj.resistance":
            return {"exclusion": "none", "doubts": [], "denied_subjects": [], "deadline": None,
                    "label_contradicted": False}
        if id_tache == "obj.topic":
            t = ctx.tour(id_unite.split(":")[-1])
            return {"new_subject": True, "receive_and_leave": False, "quote": " ".join(t.texte.split()[:3])}
        if id_tache == "obj.acknowledge":
            m = re.search(r'FIRST SENTENCE: "(.*)"\s*$', consigne, re.S)
            return {"receiving_marker": False, "neutral_reformulation": False, "elliptical_open_question": False,
                    "contradiction": False, "quote": " ".join(m.group(1).split()[:10])}
        if id_tache == "obj.isolate":
            return {"isolate": False, "turn": None, "quote": None}
        if id_tache == "obj.explore":
            return {"explore": False, "open_question": False, "elliptical": False, "answered_with_content": False}
        if id_tache == "obj.gesture":
            return {k: False for k in ("answer_given", "answer_tied_to_prospect", "support_or_framework",
                                       "proof_reversibility_guarantee", "cost_of_inaction_question",
                                       "cost_stated_by_prospect", "mindset_reframe", "offer_argument")}
        if id_tache == "obj.resolution":
            m = re.search(r"<REACTION> \[(T\w+) [^\]]*\] \w+: (.*)", consigne)
            return {"reaction_kind": "agreement_only", "turn": m.group(1),
                    "quote": " ".join(m.group(2).split()[:3]), "specific_element": False,
                    "content_first_stated_by_sales": False}
        if id_tache == "obj.prevention":
            return {k: None for k in O.FAITS_PROSPECT + O.FAITS_COMMERCIAL}
        raise KeyError((id_tache, id_unite))
    return fb


def executer(ctx: ContexteAppel, reponses: dict):
    client = ClientSimule(reponses, repli=defauts(ctx))
    res = CompetenceObjections().executer(ctx, Executeur(client))
    return res, client


def doute(citation, *sujets, exclusion="none", nie=(), echeance=None):
    return {"exclusion": exclusion, "doubts": [{"quote": citation, "subjects": list(sujets)}] if citation else [],
            "denied_subjects": list(nie), "deadline": echeance, "label_contradicted": False}


def ep_par_tour(res, tour):
    return [e for e in res.details["episodes"] if e["resistance"]["turn"] == tour]


def niv(ep, iid):
    return next(i["level"] for i in ep["items"] if i["id"] == iid)


# =============================================================================================== Part 1
# Annex A6 minimal pairs (pure decisions)
def test_paire1_demande_info_contre_reserve():
    t = Tour("T010", 10, "01:00", "P", PROSPECT, "How long is it? Because honestly I don't have much time.")
    assert O.touches_marqueurs("How long is the program?") == []                     # 1a: no candidate
    assert "objection_time" in O.touches_marqueurs(t.texte)                          # 1b: nominated
    r, _, _ = O.resistances_de_reponse(doute(None, exclusion="information_request"), t)
    assert r == []                                                             # 1a: OB-2
    r, _, _ = O.resistances_de_reponse(doute("I don't have much time", "time"), t)
    assert [(x.nature, x.sous_type) for x in r] == [("objection", "time")]       # 1b


def test_paire2_doute_offre_contre_doute_de_soi():
    assert O.nature_des_sujets(["offer_trust"]) == ("objection", "trust_in_offer")          # 2a
    assert O.nature_des_sujets(["self_capability"]) == ("anxiety_capability", "capability")  # 2b
    assert O.touches_marqueurs("I'm not sure it works.") and O.touches_marqueurs("I'm not sure I can do it.")


def test_ob3_ordre_ressource_d_abord():
    # Annex B case 5: "I'm scared of doing this step because of the money" -> test 1 comes first
    assert O.nature_des_sujets(["self_capability", "money_available"]) == ("objection", "money_available")
    assert O.nature_des_sujets(["postponement", "own_decision"]) == ("anxiety_choice", "choice")


def test_paire3_report_contre_echeance_externe():
    t = Tour("T020", 20, "02:00", "P", PROSPECT, "Not before January, I'm moving in December.")
    r, _, _ = O.resistances_de_reponse(doute("Not right now, maybe after the holidays", "postponement"), t)
    assert [(x.nature, x.sous_type) for x in r] == [("inertia", "timing")]       # 3a
    r, dl, _ = O.resistances_de_reponse(
        doute("Not before January", "postponement", exclusion="external_deadline",
              echeance={"quote": "I'm moving in December", "binding": True}), t)
    assert r == [] and dl == {"turn": "T020", "quote": "I'm moving in December", "binding": True}   # 3b, X2


def test_ob25_raison_externe_qui_limite_le_temps():
    t = Tour("T030", 30, "03:00", "P", PROSPECT, "It's wedding season, I'm booked until October.")
    r, dl, _ = O.resistances_de_reponse(
        doute("I'm booked until October", "time", exclusion="external_deadline",
              echeance={"quote": "booked until October", "binding": True}), t)
    assert [(x.nature, x.sous_type) for x in r] == [("objection", "time")] and dl["binding"]


def test_paire4_fait_circuit_contre_codecideur():
    t = Tour("T040", 40, "04:00", "P", PROSPECT, "I need to talk to my husband first.")
    assert O.resistances_de_reponse(doute(None, exclusion="circuit_fact"), t)[0] == []          # 4a
    r, _, _ = O.resistances_de_reponse(doute("I need to talk to my husband first", "co_decider"), t)
    assert [(x.nature, x.sous_type) for x in r] == [("objection", "co_decider")]                 # 4b


def test_paire5_accueillir():
    assert O.accueilli("I hear you.", {"receiving_marker": True})                            # 5a
    assert not O.accueilli("But think about what it's costing you not to do it.",
                              {"receiving_marker": True})                                       # 5b, X5
    assert not O.accueilli("No, we've only got 100 students and we don't beg our clients to leave reviews.",
                              {"receiving_marker": False})                                      # case 22
    assert O.accueilli("Compared to what?", {"elliptical_open_question": True})              # OB-20


def _ctx_episode():
    ctx = synth([(PROSPECT, "I don't have the money right now."),                       # T001
                 (COMMERCIAL, "I hear you. Apart from the money, is anything else holding you back?"),  # T002
                 (PROSPECT, "No, it's really just that."),                               # T003
                 (COMMERCIAL, "We can split it in instalments of 900 a month."),               # T004
                 (PROSPECT, "Okay, 900 a month I can actually do."),                      # T005
                 (COMMERCIAL, "So the payment plan works for you, right?"),                    # T006
                 (PROSPECT, "Yeah."),                                                     # T007
                 (COMMERCIAL, "Let's book your onboarding.")])                                 # T008
    r = O.Resistance("T001", "T001", PROSPECT, "I don't have the money right now", "objection", "money_available",
                     ["T001"])
    ep = O.Episode("E1", r, reponse_com=["T002", "T004", "T006"], reaction=["T003", "T005", "T007"],
                   changement_sujet="T008", tour_fin="T008", raison_fin="topic_change")
    return ctx, ep


def test_paire5a_isolement_avant_reponse_et_x6():
    ctx, ep = _ctx_episode()
    iso = {"isolate": True, "turn": "T002", "quote": "Apart from the money, is anything else holding you back?"}
    rep = Preuve("We can split it in instalments of 900 a month", "T004", COMMERCIAL)
    assert O.isolement_valide(ctx, ep, iso, rep)
    tardif = {"isolate": True, "turn": "T006", "quote": "So the payment plan works for you"}
    assert not O.isolement_valide(ctx, ep, tardif, rep)                                   # X6: after the answer


def test_paire6_resolution_mots_propres_contre_suggeree():
    ctx, ep = _ctx_episode()
    a = {"reaction_kind": "states_no_longer_holds", "turn": "T005", "quote": "900 a month I can actually do",
         "content_first_stated_by_sales": False}
    assert O.niveau_resolution(ctx, ep, a)[0] == "resolved"                             # 6a
    b = {"reaction_kind": "states_no_longer_holds", "turn": "T007", "quote": "Yeah.",
         "content_first_stated_by_sales": True}
    assert O.niveau_resolution(ctx, ep, b)[0] == "acknowledged"                         # 6b, X3
    c = dict(b, content_first_stated_by_sales=False)
    assert O.niveau_resolution(ctx, ep, c)[0] == "acknowledged"                         # C3 rule 5: approval only
    d = {"reaction_kind": "repeats_or_reinforces", "turn": "T005", "quote": "900 a month"}
    assert O.niveau_resolution(ctx, ep, d)[0] == "persisting"


def test_ob23_engagement_sur_proposition():
    ctx, ep = _ctx_episode()
    a = {"reaction_kind": "commits_to_proposal", "turn": "T005", "quote": "900 a month I can actually do",
         "specific_element": True}
    assert O.niveau_resolution(ctx, ep, a)[0] == "resolved"
    assert O.niveau_resolution(ctx, ep, dict(a, turn="T007", quote="Yeah.", specific_element=False))[0] == "acknowledged"


def test_paire7_geste_adapte_a_l_anxiete():
    lv, _ = O.niveau_h1("anxiety_capability", {"support_or_framework": True}, {})
    assert lv == 2                                                                     # 7a
    lv, etiquettes = O.niveau_h1("anxiety_capability", {"offer_argument": True}, {})
    assert lv == 0 and "mismatch" in etiquettes                                              # 7b
    lv, etiquettes = O.niveau_h1("anxiety_capability", {"support_or_framework": True, "offer_argument": True}, {})
    assert lv == 1 and "partial_wrong_kind" in etiquettes                                    # OB-16 partial
    lv, etiquettes = O.niveau_h1("anxiety_capability", {"mindset_reframe": True}, {})
    assert lv == 1 and "mindset_reframe" in etiquettes                                       # OB-21
    assert O.niveau_h1("anxiety_choice", {"cost_of_inaction_question": True}, {})[0] == 0   # case 18
    assert O.niveau_h1("anxiety_choice", {"proof_reversibility_guarantee": True}, {})[0] == 2
    assert O.niveau_h1("inertia", {"cost_of_inaction_question": True, "cost_stated_by_prospect": True}, {})[0] == 2
    assert O.niveau_h1("inertia", {"cost_of_inaction_question": True}, {})[0] == 0


def test_geste_objection_et_h3():
    g = {"answer_given": True, "answer_tied_to_prospect": True}
    assert O.niveau_h1("objection", g, {"ack": True, "isolate": True, "explore": True})[0] == 2
    assert O.niveau_h1("objection", g, {"ack": True, "isolate": False, "explore": True})[0] == 1
    assert O.niveau_h1("objection", {"answer_given": True}, {"ack": True, "isolate": True, "explore": True})[0] == 0
    assert O.niveau_h3("objection", True, True, True) == 2
    assert O.niveau_h3("objection", False, True, False) == 1                            # case 15
    assert O.niveau_h3("objection", False, False, False) == 0
    assert O.niveau_h3("inertia", False, True, True) == 2 and O.niveau_h3("inertia", True, False, False) == 0


def test_explorer_reprise_x7_et_ob20():
    ctx = synth([(PROSPECT, "That's quite a lot, right? Sure."),                          # T001
                 (COMMERCIAL, "Compared to what, though?"),                                    # T002
                 (PROSPECT, "Hmm."),                                                      # T003
                 (COMMERCIAL, "It's a lot. Compared to what?"),                                # T004
                 (PROSPECT, "Compared to my savings, it is half of them.")])              # T005
    r = O.Resistance("T001", "T001", PROSPECT, "That's quite a lot", "objection", "price", ["T001"])
    ep = O.Episode("E1", r, reponse_com=["T002", "T004"], reaction=["T003", "T005"])
    ellipse_tardive = {"explore": True, "turn": "T004", "quote": "Compared to what?", "open_question": True,
                     "elliptical": True, "answered_with_content": True, "answer_turn": "T005"}
    assert O.exploration(ctx, ep, ellipse_tardive, {"T001"}) == (False, False)           # X7: no reuse, not right after
    reprise = dict(ellipse_tardive, quote="It's a lot. Compared to what?", elliptical=False)
    assert O.exploration(ctx, ep, reprise, {"T001"}) == (True, True)                      # OB-15 reuse ("lot")
    premier = {"explore": True, "turn": "T002", "quote": "Compared to what, though?", "open_question": True,
             "elliptical": True, "answered_with_content": False, "answer_turn": "T003"}
    assert O.exploration(ctx, ep, premier, {"T001"}) == (True, False)                     # OB-20, approval-only answer
    assert O.exploration(ctx, ep, dict(reprise, open_question=False), {"T001"}) == (False, False)   # X7 closed
    assert O.exploration(ctx, ep, reprise, {"T001", "T005"}) == (True, False)             # case 13: new resistance


def test_ob24_anxiete_niee():
    t = Tour("T212", 212, "47:13", "P", PROSPECT, "No, I'm not scared. Not scared, because I dove into this course "
             "already, like in the past. But it's just the amount. Okay, got it.")
    rep = {"exclusion": "none", "doubts": [{"quote": "But it's just the amount", "subjects": ["price"]},
                                           {"quote": "No, I'm not scared", "subjects": ["self_capability"]}],
           "denied_subjects": ["self_capability"]}
    r, _, signaux = O.resistances_de_reponse(rep, t)
    assert [(x.nature, x.sous_type) for x in r] == [("objection", "price")] and signaux


def test_ob4_deux_natures_deux_episodes():
    t = Tour("T050", 50, "05:00", "P", PROSPECT, "I can't afford it and honestly I'm scared I'll quit again.")
    rep = {"exclusion": "none", "doubts": [{"quote": "I can't afford it", "subjects": ["money_available"]},
                                           {"quote": "I'm scared I'll quit again", "subjects": ["self_capability"]}]}
    r, _, _ = O.resistances_de_reponse(rep, t)
    assert sorted(x.nature for x in r) == ["anxiety_capability", "objection"] and {x.debut for x in r} == {"T050"}


def test_ob26_etiquette_contredite():
    t = Tour("T060", 60, "06:00", "P", PROSPECT, "Our program costs 5,800 and I'm the mentor.")
    r, _, signaux = O.resistances_de_reponse(dict(doute("costs 5,800", "price"), label_contradicted=True), t)
    assert r == [] and signaux == ["attribution_doubtful:T060"]


def test_ob5_fusion_par_dessus_relance_orale():
    ctx = synth([(PROSPECT, "It's too expensive."), (COMMERCIAL, "Mm-hmm."), (PROSPECT, "Way too expensive for me."),
                 (COMMERCIAL, "Okay, let me explain the payment options in detail.")])
    a = O.Resistance("T001", "T001", PROSPECT, "too expensive", "objection", "price", ["T001"])
    b = O.Resistance("T003", "T003", PROSPECT, "Way too expensive", "objection", "price", ["T003"])
    m = O.fusionner_consecutifs(ctx, [a, b])
    assert len(m) == 1 and m[0].tours == ["T001", "T003"] and m[0].dernier == "T003"


def test_ob8_condition_a():
    ref = O.mots_contenu("It's just such a significant investment")
    assert not O.changement_sujet_condition_a("So about that investment, here is how it pays back.", ref)
    assert O.changement_sujet_condition_a("Let's share my screen and look at the workbook.", ref)
    assert O.changement_sujet_condition_a("Where do you want to go from here?", ref)      # (a) holds, model reads (b)
    assert O.est_relance_orale(Tour("T9", 9, "", "S", COMMERCIAL, "Okay."))                     # never asked, never a change


def test_prevention_ob18_ob19_x8():
    ctx = synth([(COMMERCIAL, "I assume your husband makes the decisions, correct?"), (PROSPECT, "Yes."),        # T001-2
                 (PROSPECT, "I ask him, but it's my final decision."),                                    # T003
                 (COMMERCIAL, "The investment is 5,800."),                                                     # T004
                 (PROSPECT, "I have 12,000 in savings.")], premier_prix="T004")                            # T005
    assert O.fait_prevention_ok(ctx, "decision_maker", {"turn": "T002", "quote": "Yes."}, "T004") == \
        (False, "approval_only")                                                         # OB-19
    assert O.fait_prevention_ok(ctx, "decision_maker", {"turn": "T001", "quote": "your husband makes the decisions"},
                                "T004") == (False, "sales_supposition")                 # X8
    assert O.fait_prevention_ok(ctx, "budget", {"turn": "T005", "quote": "12,000 in savings"}, "T004") == \
        (False, "after_first_price")                                                     # OB-18
    items, garde, _ = O.items_prevention(ctx, {"decision_maker": {"turn": "T003", "quote": "it's my final decision"},
                                              "influencers": {"turn": "T003", "quote": "I ask him"},
                                              "budget": {"turn": "T005", "quote": "12,000 in savings"}}, "T004")
    lv = {i.id: i.niveau for i in items}
    assert lv == {"R1": 2, "R2": 0, "R3": 2} and items[2].remarque == "not_triggered"


def test_r3_tentative_passee():
    ctx = synth([(PROSPECT, "I already paid for a course and did nothing with it."),     # T001
                 (COMMERCIAL, "What stopped you from finishing that course?"),                 # T002
                 (PROSPECT, "Nobody followed up with me."),                               # T003
                 (COMMERCIAL, "Here a mentor reviews every project you submit."),              # T004
                 (COMMERCIAL, "The investment is 5,800.")], premier_prix="T005")
    f = {"past_attempt": {"turn": "T001", "quote": "I already paid for a course"},
         "past_attempt_explored": {"turn": "T002", "quote": "What stopped you from finishing"}}
    assert {i.id: i.niveau for i in O.items_prevention(ctx, f, "T005")[0]}["R3"] == 1
    f["difference_stated"] = {"turn": "T004", "quote": "a mentor reviews every project"}
    assert {i.id: i.niveau for i in O.items_prevention(ctx, f, "T005")[0]}["R3"] == 2
    assert {i.id: i.niveau for i in O.items_prevention(ctx, {"past_attempt": f["past_attempt"]}, "T005")[0]}["R3"] == 0


def test_applicabilite_et_combinaison():
    assert O.applicabilite(0, False) == ("not_applicable", "not_applicable")
    assert O.applicabilite(0, True) == ("not_applicable", "scored")
    assert O.applicabilite(2, False) == ("scored", "not_applicable")
    assert O.combiner(50, 100) == 65 and O.combiner(None, 80) == 80 and O.combiner(40, None) == 40
    e1 = O.Episode("E1", O.Resistance("T1", "T1", PROSPECT, "", "objection", "price"), note=100)
    e2 = O.Episode("E2", O.Resistance("T2", "T2", PROSPECT, "", "inertia", "timing"), note=0)
    assert O.note_traitement([e1, e2]) == 40                       # 1 x 100 + 1.5 x 0 over 2.5


# =============================================================================================== Part 2
def test_paire8a_latente_et_8b_non_latente():
    lignes = [(COMMERCIAL, "So tell me about your goals."),                                      # T001
             (PROSPECT, "Maybe later, it's not the right time for me."),                    # T002
             (COMMERCIAL, "Let's move on to the curriculum and the modules."),                   # T003
             (PROSPECT, "Okay."),                                                           # T004
             (COMMERCIAL, "Module one covers design fundamentals and color theory.")]            # T005
    ctx = synth(lignes, premier_prix="T001")                 # OB-27: resistances are read after the first price
    rep = {("obj.resistance", "res:T002"): doute("it's not the right time for me", "postponement"),
           ("obj.topic", "topic:T002.inertia:T003"): {"new_subject": True, "receive_and_leave": False,
                                                       "quote": "Let's move on to the curriculum"}}
    res, _ = executer(ctx, rep)
    e = ep_par_tour(res, "T002")[0]
    assert e["reaction"]["level"] == "latent" and e["latent_rule"] == "no_reaction" and niv(e, "H4") == 0   # 8a
    assert res.statut == "scored" and res.details["prevention_status"] == "scored"

    lignes8b = [(COMMERCIAL, "So tell me about your goals."),                                     # T001
               (PROSPECT, "Maybe later, it's not the right time for me."),                  # T002
               (COMMERCIAL, "What makes it not the right time?"),                                # T003
               (PROSPECT, "Work is crazy and I keep postponing everything I want to do."),  # T004
               (COMMERCIAL, "And if nothing changes, where are you in a year with that?"),       # T005
               (PROSPECT, "Same place, still stuck, another year lost."),                   # T006
               (COMMERCIAL, "How does that feel when you say it out loud?"),                     # T007
               (PROSPECT, "Honestly, it feels terrible, I don't want that."),               # T008
               (COMMERCIAL, "Let's look at the curriculum and the modules.")]                    # T009
    ctx = synth(lignes8b, premier_prix="T001")
    rep = {("obj.resistance", "res:T002"): doute("it's not the right time for me", "postponement"),
           ("obj.topic", "topic:T002.inertia:T003"): {"new_subject": False, "receive_and_leave": False},
           ("obj.topic", "topic:T002.inertia:T005"): {"new_subject": False, "receive_and_leave": False},
           ("obj.topic", "topic:T002.inertia:T007"): {"new_subject": False, "receive_and_leave": False},
           ("obj.topic", "topic:T002.inertia:T009"): {"new_subject": True, "receive_and_leave": False,
                                                       "quote": "Let's look at the curriculum"},
           ("obj.gesture", "gest:T002.inertia"): {
               "answer_given": False, "answer_tied_to_prospect": False, "support_or_framework": False,
               "proof_reversibility_guarantee": False, "cost_of_inaction_question": True,
               "cost_stated_by_prospect": True, "prospect_cost_turn": "T006",
               "prospect_cost_quote": "Same place, still stuck, another year lost", "mindset_reframe": False,
               "offer_argument": False, "gesture_turn": "T005",
               "gesture_quote": "if nothing changes, where are you in a year"},
           ("obj.explore", "exp:T002.inertia"): {"explore": True, "turn": "T003",
                                                 "quote": "What makes it not the right time?", "open_question": True,
                                                 "elliptical": False, "answered_with_content": True,
                                                 "answer_turn": "T004", "answer_quote": "Work is crazy"},
           ("obj.resolution", "resol:T002.inertia"): {"reaction_kind": "states_no_longer_holds", "turn": "T008",
                                                      "quote": "it feels terrible, I don't want that",
                                                      "specific_element": False,
                                                      "content_first_stated_by_sales": False}}
    res, client = executer(ctx, rep)
    e = ep_par_tour(res, "T002")[0]
    assert not e["latent_rule"] and e["reaction_turns"] == ["T004", "T006", "T008"]          # 8b
    assert e["topic_change"] == "T009" and e["response_turns"] == ["T003", "T005", "T007"]
    assert niv(e, "H1") == 2 and niv(e, "H3") == 2 and niv(e, "H4") == 2
    assert ("obj.topic", "topic:T002.inertia:T009", 1) in client.appels


def test_recurrence_dans_l_appel_ob11():
    lignes = [(COMMERCIAL, "The investment is 5,800."),                         # T001, OB-27: the first price
             (PROSPECT, "It's too expensive for me."),                    # T002
             (COMMERCIAL, "I understand. Compared to what?"),                   # T003
             (PROSPECT, "Compared to a normal course online."),            # T004
             (COMMERCIAL, "Let's look at the next module together now."),      # T005
             (PROSPECT, "Sure."),                                          # T006
             (COMMERCIAL, "Module two covers lighting plans."),                 # T007
             (PROSPECT, "Honestly it's still too expensive."),             # T008
             (COMMERCIAL, "Let's book a call with your partner.")]              # T009
    ctx = synth(lignes, premier_prix="T001")
    rep = {("obj.resistance", "res:T002"): doute("too expensive for me", "price"),
           ("obj.resistance", "res:T008"): doute("it's still too expensive", "price"),
           ("obj.topic", "topic:T002.objection:T003"): {"new_subject": False, "receive_and_leave": False}}
    res, _ = executer(ctx, rep)
    e1, e2 = ep_par_tour(res, "T002")[0], ep_par_tour(res, "T008")[0]
    assert e1["end_reason"] == "topic_change" and e1["topic_change"] == "T005"
    assert e2["recurrence_of"] == e1["id"] and e1["recurs_later"] and niv(e1, "H5") == 0 and niv(e2, "H5") == 2


def test_recurrence_depuis_l_appel_precedent_du_cycle():
    ctx = synth([(COMMERCIAL, "The investment is 5,800."), (PROSPECT, "It's too expensive for me."),
                 (COMMERCIAL, "Let's book the next step.")], premier_prix="T001")
    ctx.entrees_anterieures = [{"kind": "objections_episodes", "call_id": "C1",
                         "episodes": [{"id": "E1", "nature": "objection", "subtype": "price"}]}]
    rep = {("obj.resistance", "res:T002"): doute("too expensive for me", "price")}
    res, _ = executer(ctx, rep)
    assert ep_par_tour(res, "T002")[0]["recurrence_of"] == "C1:E1"
    assert res.details["recurs_from_previous_call"][0]["id"] == "E1"


def test_sans_resistance_prix_donne_note_la_prevention_seule():
    ctx = synth([(COMMERCIAL, "Who decides on this investment?"), (PROSPECT, "It's my decision, nobody else's."),
                 (COMMERCIAL, "The investment is 5,800."), (PROSPECT, "Sounds good, let's start.")], premier_prix="T003")
    rep = {("obj.prevention", "prevention:pre_price"): {
        "decision_maker": {"turn": "T002", "quote": "It's my decision"},
        "influencers": {"turn": "T002", "quote": "nobody else's"}, "budget": None, "deadline": None,
        "past_attempt": None, "past_attempt_explored": None, "difference_stated": None}}
    res, _ = executer(ctx, rep)
    assert res.statut == "scored" and res.details["handling_status"] == "not_applicable"
    assert res.note == res.details["prevention_score"] == round(100 * (40 * 1 + 40 * 0 + 20 * 1) / 100)


def test_sans_resistance_ni_prix_non_applicable():
    ctx = synth([(COMMERCIAL, "How was your week?"), (PROSPECT, "Great, thanks for asking.")])
    res, _ = executer(ctx, {})
    assert res.statut == "not_applicable" and res.note is None


def test_candidat_a_revoir_bloque_non_applicable():
    ctx = synth([(COMMERCIAL, "How was your week?"), (PROSPECT, "Honestly it's too expensive.")], premier_prix="T001")
    mauvais = {"exclusion": "none", "doubts": [{"quote": "not in the turn at all", "subjects": ["price"]}]}
    res, _ = executer(ctx, {("obj.resistance", "res:T002"): mauvais})
    assert res.statut == "to_review" and "to_review:res:T002" in res.signaux


def test_ob27_rien_avant_le_premier_prix_n_est_une_objection():
    lignes = [(COMMERCIAL, "So what holds you back today?"),                    # T001
             (PROSPECT, "Honestly I'm scared it's too expensive."),       # T002, before the price: never read
             (COMMERCIAL, "The investment is 5,800."),                         # T003, first price
             (PROSPECT, "It's too expensive for me."),                    # T004
             (COMMERCIAL, "Let's book the next step.")]                        # T005
    ctx = synth(lignes, premier_prix="T003")
    rep = {("obj.resistance", "res:T002"): doute("it's too expensive", "price"),
           ("obj.resistance", "res:T004"): doute("too expensive for me", "price")}
    res, client = executer(ctx, rep)
    assert [e["resistance"]["turn"] for e in res.details["episodes"]] == ["T004"]
    assert not any(c[1] == "res:T002" for c in client.appels)                  # not even asked
    ctx = synth(lignes)                                                         # no price: no episode at all
    res, _ = executer(ctx, rep)
    assert res.details["episodes"] == [] and res.statut == "not_applicable"


# =============================================================================================== Part 3
# Annex B cases on real transcripts.
def test_annexeB_cas22_cas27_appel005():
    """Case 22: objection · trust, H2 0 (first word 'No'), acknowledged (H4 1).
    Case 27: T053-T054 supposition does not count; T074 gives decision maker and influencer, R1 2."""
    ctx = charger("005", premier_prix="T165")
    rep = {
        ("obj.resistance", "res:T242"): doute("that don't make me like trust like 100%", "offer_trust"),
        ("obj.topic", "topic:T242.objection:T243"): {"new_subject": False, "receive_and_leave": False},
        ("obj.acknowledge", "ack:T242.objection"): {
            "receiving_marker": False, "neutral_reformulation": False, "elliptical_open_question": False,
            "contradiction": True, "quote": "No, we've only got 100 students"},
        ("obj.gesture", "gest:T242.objection"): {
            "answer_given": True, "answer_turn": "T243", "answer_quote": "we don't beg our clients to leave reviews",
            "answer_tied_to_prospect": True, "support_or_framework": False, "proof_reversibility_guarantee": False,
            "cost_of_inaction_question": False, "cost_stated_by_prospect": False, "mindset_reframe": False,
            "offer_argument": False, "gesture_turn": "T243", "gesture_quote": "we don't beg our clients to leave reviews"},
        ("obj.resolution", "resol:T242.objection"): {
            "reaction_kind": "agreement_only", "turn": "T244", "quote": "Okay, I understand. Okay.",
            "specific_element": False, "content_first_stated_by_sales": False},
        ("obj.prevention", "prevention:pre_price"): {
            "decision_maker": {"turn": "T074", "quote": "it's my final decision"},
            "influencers": {"turn": "T074", "quote": "I ask him because he knows more than me about that kind of stuff"},
            "budget": None, "deadline": None, "past_attempt": None, "past_attempt_explored": None,
            "difference_stated": None},
    }
    res, _ = executer(ctx, rep)
    e = ep_par_tour(res, "T242")[0]
    assert (e["nature"], e["subtype"]) == ("objection", "trust_in_offer")
    assert e["response_turns"] == ["T243"] and e["reaction_turns"] == ["T244"] and e["topic_change"] == "T245"
    assert e["acknowledge"] is False and niv(e, "H2") == 0
    assert e["reaction"]["level"] == "acknowledged" and niv(e, "H4") == 1
    assert {i["id"]: i["level"] for i in res.details["prevention"]["items"]}["R1"] == 2
    assert res.statut == "scored" and res.details["prevention_status"] == "scored"

    # Case 27, first half: the T054 approval of a sales supposition does not establish the decision maker.
    rep[("obj.prevention", "prevention:pre_price")] = dict(
        rep[("obj.prevention", "prevention:pre_price")], decision_maker={"turn": "T054", "quote": "Yes."},
        influencers=None)
    res2, _ = executer(ctx, rep)
    assert {i["id"]: i["level"] for i in res2.details["prevention"]["items"]}["R1"] == 0
    assert res2.details["prevention"]["rejected"]["decision_maker"] == "approval_only"


def test_annexeB_cas25_appel044_recevoir_et_partir_latent():
    """Case 25: 'It's just such a significant investment' (no listed marker: nominated by the model),
    T052 receives it and changes topic in the same turn -> latent (OB-10, OB-22), H4 0.
    OB-27 (2026-11-03): this case needs call 044's first price (a turn before T051) set below, and the nomination key
    of the chunk that starts right after it; to fill in when the corpus is available (docs/OPEN_DECISIONS.md)."""
    ctx = charger("044")
    rep = {
        ("obj.nominate", "nominate:T001"): {"nominations": [
            {"turn": "T051", "quote": "It's just such a significant investment"}]},
        ("obj.resistance", "res:T051"): doute("It's just such a significant investment", "price"),
        ("obj.topic", "topic:T051.objection:T052"): {"new_subject": True, "receive_and_leave": True,
                                                      "quote": "Let's just do this. Share screen."},
        ("obj.acknowledge", "ack:T051.objection"): {
            "receiving_marker": True, "neutral_reformulation": False, "elliptical_open_question": False,
            "contradiction": False, "quote": "Of course."},
    }
    res, client = executer(ctx, rep)
    assert "T051" not in [t.id for t in O.trouver_candidats(ctx)]
    e = ep_par_tour(res, "T051")[0]
    assert e["nature"] == "objection" and e["response_turns"] == ["T052"] and e["reaction_turns"] == []
    assert e["latent_rule"] == "OB-22" and e["reaction"]["level"] == "latent" and niv(e, "H4") == 0
    assert e["turns_to_topic_change"] == 1
    assert not any(c[0] == "obj.resolution" and c[1] == "resol:T051.objection" for c in client.appels)
    assert res.details["handling_status"] == "scored" and res.details["prevention_status"] == "not_applicable"


def test_annexeB_cas4_cas26_appel038_anxiete_niee_et_recurrence():
    """Case 4: T212 is objection · price only (anxiety denied, OB-24).
    Case 26: T338 is a recurrence of T212 (recurrence_of = the T212 episode, H5 = 0 on the earlier one);
    T340 is a new resistance, not a reaction (OB-9)."""
    ctx = charger("038", premier_prix="T197")
    rep = {
        ("obj.resistance", "res:T212"): {
            "exclusion": "none", "denied_subjects": ["self_capability"],
            "doubts": [{"quote": "But it's just the amount", "subjects": ["price"]},
                       {"quote": "No, I'm not scared", "subjects": ["self_capability"]}]},
        ("obj.topic", "topic:T212.objection:T213"): {"new_subject": False, "receive_and_leave": False},
        ("obj.isolate", "iso:T212.objection"): {
            "isolate": True, "turn": "T213",
            "quote": "So other than the finances, is there anything else keeping you less than 100%"},
        ("obj.resistance", "res:T338"): doute("This is very expensive, of course.", "price"),
        ("obj.topic", "topic:T338.objection:T339"): {"new_subject": False, "receive_and_leave": False},
        ("obj.resistance", "res:T340"): doute("No, I can't make decisions instantly.", "postponement"),
    }
    res, _ = executer(ctx, rep)
    e212 = ep_par_tour(res, "T212")
    assert [(e["nature"], e["subtype"]) for e in e212] == [("objection", "price")]
    assert "denied_nature:T212:anxiety_capability" in res.signaux
    assert e212[0]["isolate"] is True
    e338, e340 = ep_par_tour(res, "T338")[0], ep_par_tour(res, "T340")[0]
    assert e338["recurrence_of"] == e212[0]["id"] and e212[0]["recurs_later"] and niv(e212[0], "H5") == 0
    assert e338["end_reason"] == "new_resistance" and "T340" not in e338["reaction_turns"]
    assert e338["reaction"]["level"] == "latent"
    assert e340["nature"] == "inertia" and e338["after_first_price"]


def test_annexeB_cas24_appel050_persistante():
    """Case 24: 'that's a lot' -> 'Compared to?' -> 'that is a lot, to be honest': persisting, H4 0.
    The repetition at T221 is the same resistance inside the episode (no new episode). 'Compared to?' right after
    the resistance counts as exploration under OB-20 (v1.1); the strict X7 reading of the case predates OB-20."""
    ctx = charger("050", premier_prix="T216")
    rep = {
        ("obj.resistance", "res:T219"): doute("That's, that's a lot.", "price"),
        ("obj.resistance", "res:T221"): doute("that is a lot, to be honest", "price"),
        ("obj.topic", "topic:T219.objection:T220"): {"new_subject": False, "receive_and_leave": False},
        ("obj.explore", "exp:T219.objection"): {"explore": True, "turn": "T220", "quote": "Compared to?",
                                                "open_question": True, "elliptical": True,
                                                "answered_with_content": False},
        ("obj.resolution", "resol:T219.objection"): {
            "reaction_kind": "repeats_or_reinforces", "turn": "T221", "quote": "that is a lot, to be honest",
            "specific_element": False, "content_first_stated_by_sales": False},
    }
    res, _ = executer(ctx, rep)
    assert ep_par_tour(res, "T221") == []
    e = ep_par_tour(res, "T219")[0]
    assert "T221" in e["reaction_turns"] and e["reaction"]["level"] == "persisting" and niv(e, "H4") == 0
    assert e["explore"] == {"asked": True, "answered_with_content": False} and niv(e, "H3") == 1
