"""Tests of the Pitch competence (PITCH-2.0).

Part 1: minimal pairs 8a..13b of annex A7 as pure decision tests (no model).
Part 2: other pure decisions (gate, claims lookup, K5, K6, K7, N/A spread).
Part 3: real transcripts (Annex B5 P categories, a pitch_before_gap case, a full run) with mock model answers.
Business values in fixtures (offer price, case library entries) are test fixtures, not reference data.
"""
from __future__ import annotations
import os

import re
from pathlib import Path

import pytest

from lnp_analyse.competences import presentation as P
from lnp_analyse.competences.presentation import CompetencePresentation, decider
from lnp_analyse.noyau.client_modele import ClientSimule
from lnp_analyse.noyau.modeles import (Atome, ContexteAppel, ResultatCompetence, Preuve, PROSPECT, COMMERCIAL,
                                        Sollicitation, Tour)
from lnp_analyse.noyau.executeur import Executeur

EXECUTIONS = Path(os.environ.get("CALLQA_CORPUS", str(Path(__file__).parent / "fixtures" / "transcripts")))


# ------------------------------------------------------------------------------------------- helpers
def fab_ctx(lignes, **kw) -> ContexteAppel:
    tours = [Tour(f"T{i:03d}", i, f"00:{i:02d}", role, role, texte) for i, (role, texte) in enumerate(lignes, 1)]
    return ContexteAppel("c", "s", "2026-10-01T10:00:00Z", "UTC", tours, **kw)


LIGNE = re.compile(r"^\[(T\d+\w?) ([\d:]+)\] (SALES|PROSPECT|OTHER): (.*)$")


def charger_reel(executer: str, **kw) -> ContexteAppel:
    tours = []
    for ligne in (EXECUTIONS / executer / "transcript_compact.txt").read_text(encoding="utf-8").splitlines():
        m = LIGNE.match(ligne.strip())
        if m:
            tid, ts, role, texte = m.groups()
            tours.append(Tour(tid, len(tours) + 1, ts, role, role, texte))
    return ContexteAppel(executer, "valentino", "2026-10-01T10:00:00Z", "UTC", tours, **kw)


def poser_ecart(ctx, **details):
    base = {"verdict": "present", "validation_turn": None, "restitution_span": [], "selected_A": None,
            "selected_B": None, "selected_P": None, "validated_P": None, "roadmap_blockers": [], "cost": []}
    base.update(details)
    ctx.resultats["GAP"] = ResultatCompetence("GAP", "GAP-1.3", verdict=base["verdict"], details=base)
    return base


def plage(tour, citation_debut, citation_fin=None, tour_fin=None):
    return {"start_turn": tour, "start_quote": citation_debut, "end_turn": tour_fin or tour,
            "end_quote": citation_fin or citation_debut}


CFG = dict(P.CONFIG_DEFAUT)

# ============================================================================ Part 1: minimal pairs (annex A7)
P_CLIENTS = "I don't know where clients will come from."


def ctx_8():
    return fab_ctx([(PROSPECT, P_CLIENTS),                                         # T001 validated P
                   (COMMERCIAL, "Exactly, so let me show you."),                         # T002
                   (COMMERCIAL, "What's blocking you today is you don't know where clients will come from."),  # T003
                   (COMMERCIAL, "So your lead generation is the issue.")])               # T004


VP8 = {"quote": P_CLIENTS, "turn": "T001", "key_expression": "where clients will come from"}


def test_8a_etape1_mot_pour_mot():
    ctx = ctx_8()
    st = {"step": plage("T003", "What's blocking you today is you don't know where clients will come from."),
          "other_blockers": []}
    lv, ev, info = P.decider_k1(ctx, VP8, st)
    assert info["verbatim"] is True and lv == 2 and len(ev) == 2


def test_8b_etape1_paraphrasee():
    ctx = ctx_8()
    st = {"step": plage("T004", "So your lead generation is the issue."), "other_blockers": []}
    lv, _, info = P.decider_k1(ctx, VP8, st)
    assert info["verbatim"] is False and lv == 0 and info["failure"] == "paraphrase"   # X9


def test_k1_P_valide_avec_d_autres_blocages_niveau_1():
    ctx = ctx_8()
    st = {"step": plage("T003", "What's blocking you today is you don't know where clients will come from."),
          "other_blockers": [{"quote": "your lead generation", "turn": "T004"}]}
    assert P.decider_k1(ctx, VP8, st)[0] == 1


def ctx_9():
    return fab_ctx([(COMMERCIAL, "What makes that give way is having one repeatable way to bring in inquiries."),  # T001
                   (COMMERCIAL, "That's the third phase of the Academy."),                                       # T002
                   (COMMERCIAL, "And module 4 is pricing, module 5 is contracts, module 6 is the community."),   # T003
                   (COMMERCIAL, "And on top of that, the Pricing system tells you what to charge.")])            # T004


MECAS_9 = [{"mechanism": "Acquisition", "kind": "principle", "turn": "T001",
            "quote": "What makes that give way is having one repeatable way to bring in inquiries."},
           {"mechanism": "Acquisition", "kind": "phase", "turn": "T002", "quote": "the third phase of the Academy"}]


def _mecas(ctx, ms):
    return [dict(m, pos=P._pos(ctx, m["turn"], m["quote"])) for m in ms]


def test_9a_un_mecanisme():
    ctx = ctx_9()
    lv, ev, info = P.decider_k2(ctx, "Acquisition", _mecas(ctx, MECAS_9), None, 2, False, CFG)
    assert lv == 2 and info["principle"] and info["offer_phase"] and len(ev) == 2


def test_9b_recitation():
    ctx = ctx_9()
    enr = {"items": ["module 4 pricing", "module 5 contracts", "module 6 community"], "turn": "T003",
           "quote": "module 4 is pricing, module 5 is contracts, module 6 is the community"}
    lv, _, info = P.decider_k2(ctx, "Acquisition", _mecas(ctx, MECAS_9), enr, 2, False, CFG)
    assert lv == 1 and info["recitation"] and info["failure"] == "recitation"            # X10


def test_k2_deuxieme_mecanisme_vaut_zero():
    ctx = ctx_9()
    ms = MECAS_9 + [{"mechanism": "Pricing", "kind": "principle", "turn": "T004",
                     "quote": "the Pricing system tells you what to charge"}]
    lv, _, info = P.decider_k2(ctx, "Acquisition", _mecas(ctx, ms), None, 2, False, CFG)
    assert lv == 0 and info["failure"] == "second_mechanism"


def test_k2_plafond_generique_reference_absente_et_inconnu():
    ctx = ctx_9()
    assert P.decider_k2(ctx, "Acquisition", _mecas(ctx, MECAS_9), None, 1, False, CFG)[2]["failure"] == "generic_step"
    lv, _, info = P.decider_k2(ctx, "Acquisition", _mecas(ctx, MECAS_9), None, 2, True, CFG)
    assert lv == 1 and info["failure"] == "mechanism_reference_missing"
    assert P.decider_k2(ctx, P.INCONNU, _mecas(ctx, MECAS_9), None, 2, False, CFG)[0] is None


def ctx_10():
    ctx = fab_ctx([(PROSPECT, "I'm at about 2K a month right now."),                           # T001 A
                  (PROSPECT, "I'd love 10K a month and to be home when my kids get back from school."),  # T002 B, N
                  (COMMERCIAL, "You go from 2K a month to 10K a month, and you're home when your kids get back from school."),
                  (COMMERCIAL, "You go from where you are to six figures by next summer.")])     # T004
    ctx.sollicitations = [Sollicitation("s1", "T001", "where do you want to be?", lettre="N", tours_reponse=["T002"])]
    return ctx


GAP10 = {"selected_A": {"quote": "about 2K a month", "turn": "T001", "value": 2000, "unit": "per month"},
         "selected_B": {"quote": "10K a month", "turn": "T002", "value": 10000, "unit": "per month", "horizon": None}}


def test_10a_meme_unite():
    ctx = ctx_10()
    s3 = {"step": plage("T003", "You go from 2K a month"),
          "A": {"value": 2000, "unit": "a month", "quote": "from 2K a month", "turn": "T003"},
          "B": {"value": 10000, "unit": "a month", "quote": "to 10K a month", "turn": "T003"},
          "deadline": None, "deadline_source": None, "image": None}
    lv, _, info = P.decider_k3(ctx, GAP10, s3)
    assert info["same_unit"] and info["his_figures"] and lv == 1 and info["failure"] == "no_image"
    # §8 worked example: with the image in his words -> 2
    s3.update(image={"quote": "you're home when your kids get back from school", "turn": "T003"},
              image_key_expression="home when my kids get back from school",
              image_source={"quote": "be home when my kids get back from school", "turn": "T002"})
    assert P.decider_k3(ctx, GAP10, s3)[0] == 2


def test_10b_autre_unite_et_date_inventee():
    ctx = ctx_10()
    s3 = {"step": plage("T004", "You go from where you are"),
          "A": {"value": None, "unit": "where you are", "quote": "from where you are", "turn": "T004"},
          "B": {"value": 100000, "unit": "per year", "quote": "to six figures", "turn": "T004"},
          "deadline": {"quote": "by next summer", "turn": "T004"}, "deadline_source": None}
    lv, _, info = P.decider_k3(ctx, GAP10, s3)
    assert lv == 0 and info["failure"] == "other_unit"                                   # X11
    s3["A"] = {"value": 2000, "unit": "a month", "quote": "from where you are", "turn": "T004"}
    s3["B"] = {"value": 10000, "unit": "a month", "quote": "to six figures", "turn": "T004"}
    assert P.decider_k3(ctx, GAP10, s3)[2]["failure"] == "invented_date"


LIB = [{"id": "case-ftj", "name": "Student A", "consent": True,
        "start": {"value": 0, "unit": "clients", "profile": "full-time job, zero clients"}, "figures": [3]},
       {"id": "case-arch", "name": "Student B", "consent": True,
        "start": {"value": 8000, "unit": "per month", "profile": "established architect"}, "figures": [30000]}]


def ctx_11():
    ctx = fab_ctx([(PROSPECT, "I work full-time and I have no clients yet."),                       # T001
                  (COMMERCIAL, "Someone who started exactly where you are, with a full-time job and no clients."),  # T002
                  (COMMERCIAL, "One of our students hit 40K in her third month."),                       # T003
                  (COMMERCIAL, "One of our students reached 30K a month, she was an architect.")],       # T004
                 bibliotheque_cas=LIB)
    return ctx


GAP11 = {"selected_A": {"quote": "I have no clients yet", "turn": "T001", "value": 0, "unit": "clients"}}


def test_11a_preuve_appariee():
    ctx = ctx_11()
    s4 = {"cases": [{"step": plage("T002", "Someone who started exactly where you are"), "turn": "T002",
                     "quote": "Someone who started exactly where you are, with a full-time job and no clients",
                     "library_id": "case-ftj", "profile_match": True,
                     "prospect_evidence": {"quote": "I work full-time and I have no clients yet", "turn": "T001"}}]}
    lv, ev, info = P.decider_k4(ctx, GAP11, s4, CFG)
    assert lv == 2 and info["case_id"] == "case-ftj" and info["start_matches_A"] and len(ev) == 2


def test_11b_cas_hors_bibliotheque_hors_ecart():
    ctx = ctx_11()
    ctx.phases.debut_presentation = "T002"
    ecart = poser_ecart(ctx, validation_turn="T001")
    affirmations = [{"kind": "case", "quote": "One of our students hit 40K in her third month", "turn": "T003",
               "library_id": "not_in_library"}]
    raisons, verifie, _ = P.porte(ctx, ecart, affirmations, [], None)
    assert raisons == ["out_of_gap_claim"] and verifie[0]["source"] == "out_of_gap"     # PB-35, X12


def test_k4_meilleur_cas_et_ecart_de_preuve():
    ctx = ctx_11()
    meilleur = {"cases": [{"step": plage("T004", "One of our students"), "turn": "T004", "library_id": "case-arch",
                       "quote": "One of our students reached 30K a month", "profile_match": False}]}
    assert P.decider_k4(ctx, GAP11, meilleur, CFG)[0] == 1                                    # §8: best case
    # A in per month, factor configured, no library case within the factor -> K4 not applicable, proof gap
    ecartA = {"selected_A": {"value": 500, "unit": "per month"}}
    lv, _, info = P.decider_k4(ctx, ecartA, {"cases": []}, dict(CFG, case_match_factor=2))
    assert lv is None and info["proof_gap"]
    ctx.bibliotheque_cas = []
    assert P.decider_k4(ctx, GAP11, meilleur, CFG)[2]["failure"] == "case_library_missing"


def test_12a_12b_promesse_de_resultat():
    ctx = fab_ctx([(PROSPECT, "Yes exactly."), (COMMERCIAL, "We give you the system and we review every call you take."),
                  (COMMERCIAL, "We'll find the clients, you just do the design.")])
    ctx.phases.debut_presentation = "T002"
    ecart = poser_ecart(ctx, validation_turn="T001")
    assert P.porte(ctx, ecart, [], [], None)[0] == []                                      # 12a: allowed
    pr = [{"quote": "We'll find the clients", "turn": "T003", "action": "find_clients"}]
    assert P.porte(ctx, ecart, [], pr, None)[0] == ["outcome_promise"]                     # 12b
    # the validator rejects anything outside the closed list of PB-36 actions
    assert "bad_action" in P._valider_promesses({"promises": [{"quote": "We give you the system", "turn": "T002",
                                                                "action": "provide_system"}]}, ctx, "promises:T002-T003")


def _ctx_13():
    return fab_ctx([(COMMERCIAL, "x")] * 160)


def test_13a_presentation_apres_le_oui():
    ctx = _ctx_13()
    assert P.presentation_avant_ecart(ctx, {"verdict": "present", "validation_turn": "T150"}, "T152") is False


def test_13b_presentation_avant_ecart():
    ctx = _ctx_13()
    assert P.presentation_avant_ecart(ctx, {"verdict": "present", "validation_turn": "T150"}, "T140") is True
    assert P.presentation_avant_ecart(ctx, {"verdict": "absent", "validation_turn": None}, "T152") is True


# ============================================================================ Part 2: other decisions
def test_recherche_affirmations():
    ctx = fab_ctx([(PROSPECT, "I charge about 1,000 per project."), (COMMERCIAL, "s")],
                 reference_offre={"price": 5800, "payment_options": ["6 x 1,097"], "guarantees": ["first client"]})
    src = P.sources_affirmation(ctx)
    ck = lambda **c: P.verifier_affirmation(ctx, dict({"turn": "T002"}, **c), src)
    assert ck(kind="price", quote="The investment is 5,800, or six payments of 1,097") == "offer_reference"
    assert ck(kind="figure", quote="Our students make 15K a month on average") == "out_of_gap"   # §8
    assert ck(kind="figure", quote="at 1,000 per project") == "prospect"
    assert ck(kind="figure", quote="at 1,000 per project and 3 projects that's 3,000",
              calculation=True) == "calculation"
    assert ck(kind="guarantee", quote="we guarantee your first client", guarantee_ref="first client") == "offer_reference"
    assert ck(kind="guarantee", quote="money back in 30 days", guarantee_ref=None) == "out_of_gap"


def test_k5_ordre_et_brievete():
    ctx = fab_ctx([(COMMERCIAL, "One. Two."), (COMMERCIAL, "Three."), (COMMERCIAL, "A. B. C. D."), (COMMERCIAL, "Four.")])
    pos = {1: (0, 0), 2: (1, 0), 3: (2, 0), 4: (3, 0)}
    ev = {k: Preuve("x", f"T00{k}", COMMERCIAL) for k in pos}
    assert P.decider_k5(ctx, pos, {1: 2, 2: 1, 3: 3, 4: 1}, set(), ev, CFG)[0] == 2
    assert P.decider_k5(ctx, pos, {1: 2, 2: 1, 3: 4, 4: 1}, set(), ev, CFG)[2]["failure"] == "too_long"
    inverse = {**pos, 2: (3, 1)}
    assert P.decider_k5(ctx, inverse, {1: 1, 2: 1, 3: 1, 4: 1}, set(), ev, CFG)[2]["failure"] == "order"
    assert P.decider_k5(ctx, {1: (0, 0), 2: (1, 0)}, {1: 1, 2: 1}, set(), ev, CFG)[0] == 0
    # step 4 not applicable (proof gap): the three other steps are enough for level 2
    assert P.decider_k5(ctx, {1: (0, 0), 2: (1, 0), 3: (2, 0)}, {1: 1, 2: 1, 3: 1}, {4}, ev, CFG)[0] == 2


def test_k6_feuille_route_avant_prix():
    ctx = fab_ctx([(PROSPECT, "I never know what to charge."),                    # T001 blocker
                  (COMMERCIAL, "Story of a client."),                                   # T002 step 4
                  (COMMERCIAL, "Your roadmap: step one for you is you never know what to charge."),   # T003
                  (COMMERCIAL, "The investment is 5,800."),                             # T004 price
                  (COMMERCIAL, "Are you ready to get started?")])                       # T005 decision
    ctx.phases.premier_prix, ctx.phases.demande_decision = "T004", "T005"
    ctx.phases.preuve["first_price"] = Preuve("The investment is 5,800", "T004", COMMERCIAL)
    ecart = {"roadmap_blockers": [{"object": "pricing", "quote": "I never know what to charge", "turn": "T001"}]}
    rm = {"roadmap": plage("T003", "Your roadmap"),
          "steps": [{"quote": "step one for you is you never know what to charge", "turn": "T003",
                     "key_expression": "never know what to charge",
                     "source": {"quote": "I never know what to charge", "turn": "T001"}}]}
    assert P.decider_k6(ctx, ecart, rm, (1, 0))[0] == 2
    ctx.phases.premier_prix = "T002"                                              # §8: price before the roadmap
    assert P.decider_k6(ctx, ecart, rm, (1, 0))[0] == 0
    ctx.phases.premier_prix = "T004"
    assert P.decider_k6(ctx, ecart, None, (1, 0))[0] == 0


def test_k7_regles_adhesion():
    ctx = fab_ctx([(COMMERCIAL, "What date exactly?"), (PROSPECT, "That sounds amazing."),
                  (PROSPECT, "by the end of August, I will have my first professional concept.")])
    approbation = {"quote": "That sounds amazing.", "turn": "T002", "kind": "appropriation"}
    proj = {"quote": "by the end of August, I will have my first professional concept", "turn": "T003",
            "kind": "projection", "concrete": True, "gesture": {"quote": "What date exactly?", "turn": "T001"}}
    reporter = dict(proj, postpone=True)
    garder, res = P.passages_adhesion(ctx, [approbation, proj])
    assert len(garder) == 1 and P.decider_k7(garder)[0] == 2                         # B4 #23: projection -> 2
    garder, res = P.passages_adhesion(ctx, [reporter])
    assert garder == [] and len(res) == 1                                         # PB-24: reserve
    assert P.decider_k7([])[0] == 0


def test_non_conforme_note_zero_et_non_applicable():
    ctx = fab_ctx([(PROSPECT, "Yes."), (COMMERCIAL, "So the program is six months.")])
    assert decider(ctx, {}).statut == "not_applicable"
    ctx.phases.debut_presentation = "T002"
    poser_ecart(ctx, verdict="absent")
    r = decider(ctx, {"claims": [], "promises": [], "adhesion": []})
    assert r.verdict == "non_compliant" and r.note == 0 and r.raisons == ["pitch_before_gap"]
    assert r.details["roadmap_span"] is None and "raw_score" in r.details


# ============================================================================ Part 3: real transcripts
DEFAUTS = {"pitch.step1": {"step": None, "other_blockers": []},
            "pitch.step2": {"step": None, "mechanisms_stated": [], "recitation": None},
            "pitch.step3": {"step": None, "A": None, "B": None, "deadline": None, "deadline_source": None,
                            "image": None, "image_key_expression": None, "image_source": None},
            "pitch.step4": {"cases": []}, "pitch.roadmap": {"roadmap": None, "steps": []},
            "pitch.claims": {"claims": []}, "pitch.promises": {"promises": []}, "pitch.adhesion": {"passages": []}}


def simule(reponses):
    return ClientSimule(reponses, repli=lambda tache, unite, consigne, p: DEFAUTS[tache])


@pytest.mark.parametrize("executer,tour,citation,attendu_", [
    ("001", "T028", "really helping me figure out the marketing and getting the clients", "Acquisition"),   # B5 #31
    ("006", "T066", "how can I make marketing?", "Acquisition"),                                            # B5 #32
    ("024", "T042", "having self-doubts", "Skill"),                                                         # B5 #33
    ("078", "T086", "to be able to deliver what I know I can", "Delivery"),                                 # B5 #34
    ("087", "T240", "I don't want to do the overthinking and stuff anymore.", P.INCONNU),                   # B5 #35
    ("027", "T047", "I don't actively have that on hand right now", P.PAS_BLOCAGE),                         # B5 #37
])
def test_b5_categorie_de_p_sur_transcriptions_reelles(executer, tour, citation, attendu_):
    ctx = charger_reel(executer)
    assert P.normaliser(citation) in P.normaliser(ctx.tour(tour).texte)
    vp = {"quote": citation, "turn": tour, "key_expression": None}
    rep = {"category": attendu_, "quote": citation, "turn": tour, "uncovered": None}
    r = Executeur(simule({("pitch.p_category", f"pcat:{tour}"): rep})).executer(ctx, P.CATEGORIE, f"pcat:{tour}", vp)
    assert r.statut == "verified" and r.reponse["category"] == attendu_
    # a quote that is not in the validated P turn is rejected by the code (C3), and the unit goes to review
    mauvais = dict(rep, quote="I am not great at marketing", turn=tour)
    if attendu_ in P.NEUF:
        r2 = Executeur(simule({("pitch.p_category", f"pcat:{tour}"): mauvais})).executer(ctx, P.CATEGORIE, f"pcat:{tour}", vp)
        assert r2.statut == "to_review"


def test_reel_091_presentation_avant_ecart():
    """Call 091: no restitution validated before the screen share at T123 (B1 #2): non-compliant, score 0."""
    ctx = charger_reel("091")
    ctx.phases.debut_presentation = "T123"
    poser_ecart(ctx, verdict="absent")
    res = CompetencePresentation().executer(ctx, Executeur(simule({})))
    assert res.statut == "scored" and res.verdict == "non_compliant"
    assert res.raisons == ["pitch_before_gap"] and res.note == 0
    assert "validated_P" in res.details and res.details["validated_P"] is None


def test_reel_001_execution_complete():
    """Call 001: P = T028 (Acquisition), restitution validated at T082, screen share T085, price T113."""
    ctx = charger_reel("001", reference_offre={"price": 5800})
    ph = ctx.phases
    ph.debut_presentation, ph.premier_prix, ph.fin_presentation = "T085", "T113", "T113"
    ph.preuve["first_price"] = Preuve("the investment for our core program is 5,800 USD", "T113", COMMERCIAL)
    vp = {"quote": "really helping me figure out the marketing and getting the clients", "turn": "T028",
          "key_expression": "getting the clients"}
    poser_ecart(ctx, verdict="present", validation_turn="T082", validated_P=vp,
            roadmap_blockers=[{"object": "marketing", "quote": vp["quote"], "turn": "T028", "solicitation": "s1"}])
    q91 = "You don't have a client acquisition system at all."
    blocs = P.blocs(ctx, P.CONFIG_DEFAUT["chunk_turns"])
    uid_affirmations = next(f"claims:{a}-{b}" for a, b in blocs if ctx.n(a) <= ctx.n("T113") <= ctx.n(b))
    reponses = {
        ("pitch.p_category", "pcat:T028"): {"category": "Acquisition", "turn": "T028",
                                            "quote": "figure out the marketing and getting the clients"},
        ("pitch.step1", "step1:T085"): {"step": plage("T091", q91), "other_blockers": []},
        ("pitch.claims", uid_affirmations): {"claims": [{"kind": "price", "turn": "T113",
                                                   "quote": "the investment for our core program is 5,800 USD"}]},
    }
    res = CompetencePresentation().executer(ctx, Executeur(simule(reponses)))
    assert res.statut == "scored" and res.verdict == "compliant"
    assert res.details["validated_P"]["category"] == "Acquisition"
    items = {i.id: i for i in res.items}
    assert items["K1"].niveau == 0 and "paraphrase" in items["K1"].remarque            # paraphrase of "getting the clients"
    assert items["K4"].niveau is None                                               # case library missing
    assert {"mechanism_reference_missing", "case_library_missing"} <= set(res.signaux)
    assert res.details["claims"][0]["source"] == "offer_reference"
    assert res.note == 0 and res.details["roadmap_span"] is None                  # no v2 staircase in old calls
    assert res.details["diagnostics"]["talk_share"] > 0.5


def test_reel_087_categorie_inconnue_repartit_k2():
    """Call 087: P = T240 "overthinking" -> P_category_unknown; K2 not applicable, case reported."""
    ctx = charger_reel("087", bibliotheque_cas=LIB)
    ctx.phases.debut_presentation = "T273"
    vp = {"quote": "I don't want to do the overthinking and stuff anymore.", "turn": "T240",
          "key_expression": "overthinking"}
    poser_ecart(ctx, verdict="present", validation_turn="T241", validated_P=vp)
    reponses = {("pitch.p_category", "pcat:T240"): {"category": P.INCONNU, "quote": vp["quote"], "turn": "T240",
                                                   "uncovered": "overthinking fits none of the nine"}}
    res = CompetencePresentation().executer(ctx, Executeur(simule(reponses)))
    items = {i.id: i for i in res.items}
    assert items["K2"].niveau is None and {"P_category_unknown", "uncovered_case"} <= set(res.signaux)
    assert res.verdict == "compliant" and res.statut == "scored"


def test_escalier_complet_synthetique_decider():
    """A compliant v2 pitch: 4 steps in order, roadmap, price, decision, adhesion -> high score."""
    lignes = [
        (PROSPECT, "I'm at about 2K a month right now."),                                            # T001 A
        (PROSPECT, "I'd love 10K a month and to be home when my kids get back from school."),         # T002 B (N)
        (PROSPECT, "I don't know what to charge."),                                                  # T003 P
        (PROSPECT, "And I never know where clients will come from."),                                 # T004 blocker 2
        (COMMERCIAL, "So you're at 2K, you want 10K, and you don't know what to charge. Right?"),          # T005 restitution
        (PROSPECT, "Exactly."),                                                                      # T006 validation
        (COMMERCIAL, "Let me show you the program."),                                                     # T007 pitch start
        (COMMERCIAL, "What's blocking you today is you don't know what to charge."),                      # T008 step 1
        (COMMERCIAL, "What makes that give way is pricing from the value of the room. That's the second phase of the Academy."),  # T009 step 2
        (COMMERCIAL, "You go from 2K a month to 10K a month, and you're home when your kids get back from school."),  # T010
        (COMMERCIAL, "Someone who started exactly where you are, at 2K a month."),                       # T011 step 4
        (PROSPECT, "So I'd have someone checking my prices on every project, that's what I need."),  # T012 adhesion
        (COMMERCIAL, "Your roadmap: step one for you is you never know where clients will come from."),  # T013 roadmap
        (PROSPECT, "If I start in November I could have my first paid project by March."),           # T014 adhesion
        (COMMERCIAL, "The investment is 5,800."),                                                         # T015 price
        (COMMERCIAL, "Are you ready to get started?"),                                                    # T016 decision
    ]
    bib = [{"id": "c2k", "name": "Student C", "consent": True, "start": {"value": 2000, "unit": "per month"},
            "figures": [2000, 9000]}]
    ref = {"price": 5800, "mechanisms": {"Pricing": {"principle": "configured by the offer owner",
                                                     "phase": "configured", "cues": []}}}
    ctx = fab_ctx(lignes, reference_offre=ref, bibliotheque_cas=bib)
    ctx.sollicitations = [Sollicitation("n1", "T001", "where?", lettre="N", tours_reponse=["T002"])]
    ph = ctx.phases
    ph.debut_presentation, ph.premier_prix, ph.demande_decision, ph.fin_presentation = "T007", "T015", "T016", "T015"
    ph.preuve["first_price"] = Preuve("The investment is 5,800", "T015", COMMERCIAL)
    poser_ecart(ctx, validation_turn="T006",
            validated_P={"quote": "I don't know what to charge.", "turn": "T003", "key_expression": "what to charge"},
            selected_A={"quote": "about 2K a month", "turn": "T001", "value": 2000, "unit": "per month"},
            selected_B={"quote": "10K a month", "turn": "T002", "value": 10000, "unit": "per month", "horizon": None},
            roadmap_blockers=[{"object": "acquisition", "quote": "never know where clients will come from",
                               "turn": "T004", "solicitation": "p1"}])
    reponses = {
        "category": {"category": "Pricing", "quote": "what to charge", "turn": "T003"},
        "step1": {"step": plage("T008", "What's blocking you today", "you don't know what to charge."), "other_blockers": []},
        "step2": {"step": plage("T009", "What makes that give way", "second phase of the Academy"),
                  "mechanisms_stated": [
                      {"mechanism": "Pricing", "kind": "principle", "turn": "T009",
                       "quote": "What makes that give way is pricing from the value of the room."},
                      {"mechanism": "Pricing", "kind": "phase", "turn": "T009",
                       "quote": "That's the second phase of the Academy."}], "recitation": None},
        "step3": {"step": plage("T010", "You go from 2K a month"),
                  "A": {"value": 2000, "unit": "a month", "quote": "from 2K a month", "turn": "T010"},
                  "B": {"value": 10000, "unit": "a month", "quote": "to 10K a month", "turn": "T010"},
                  "deadline": None, "deadline_source": None,
                  "image": {"quote": "you're home when your kids get back from school", "turn": "T010"},
                  "image_key_expression": "home when my kids get back from school",
                  "image_source": {"quote": "be home when my kids get back from school", "turn": "T002"}},
        "step4": {"cases": [{"step": plage("T011", "Someone who started"), "turn": "T011", "library_id": "c2k",
                             "quote": "Someone who started exactly where you are, at 2K a month",
                             "profile_match": False}]},
        "roadmap": {"roadmap": plage("T013", "Your roadmap"),
                    "steps": [{"quote": "step one for you is you never know where clients will come from",
                               "turn": "T013", "key_expression": "never know where clients will come from",
                               "source": {"quote": "never know where clients will come from", "turn": "T004"}}]},
        "claims": [{"kind": "price", "quote": "The investment is 5,800", "turn": "T015"},
                   {"kind": "case", "quote": "Someone who started exactly where you are", "turn": "T011",
                    "library_id": "c2k"},
                   {"kind": "figure", "quote": "at 2K a month", "turn": "T011"}],
        "promises": [],
        "adhesion": [{"quote": "So I'd have someone checking my prices on every project", "turn": "T012",
                      "kind": "appropriation"},
                     {"quote": "If I start in November I could have my first paid project by March", "turn": "T014",
                      "kind": "projection", "concrete": True}],
    }
    r = decider(ctx, reponses, {"case_match_factor": 1.5})
    lv = {i.id: i.niveau for i in r.items}
    assert r.verdict == "compliant", r.raisons
    assert lv == {"K1": 2, "K2": 2, "K3": 2, "K4": 2, "K5": 2, "K6": 2, "K7": 2}, [(i.id, i.niveau, i.remarque) for i in r.items]
    assert r.note == 100 and r.details["roadmap_span"] == ["T013", "T013"] and r.details["order_ok"]
    # same pitch with an invented student average -> gate fails, score 0, items kept as diagnostics
    reponses["claims"].append({"kind": "figure", "quote": "Our students make 15K a month on average", "turn": "T011"})
    ctx.tours[10].texte += " Our students make 15K a month on average."
    r2 = decider(ctx, reponses, {"case_match_factor": 1.5})
    assert r2.verdict == "non_compliant" and r2.note == 0 and r2.raisons == ["out_of_gap_claim"]
    assert r2.details["raw_score"] == 100
