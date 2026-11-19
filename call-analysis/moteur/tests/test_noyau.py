from datetime import date

from lnp_analyse.noyau import agregation
from lnp_analyse.noyau.fondation import decider_phases, reparer_attribution
from lnp_analyse.noyau.client_modele import ClientSimule
from lnp_analyse.noyau.modeles import ContexteAppel, Preuve, NoteItem, Tour
from lnp_analyse.noyau.executeur import TacheModele, Executeur
from lnp_analyse.noyau.notation import note_appel, item
from lnp_analyse.noyau.texte import expression_cle_ok, normaliser_nombre, citation_ok, phrases


def ctx_de(lignes):
    tours = [Tour(f"T{i+1:03d}", i + 1, "00:00", r, r, t) for i, (r, t) in enumerate(lignes)]
    return ContexteAppel("c", "s", "2026-10-20T10:00:00Z", "Asia/Dubai", tours)


# ---------------------------------------------------------------- GB-22
def test_mot_pour_mot_changement_de_personne_et_formes():
    assert expression_cle_ok("motivation", "It's like my motivation gets", "impacting your level of motivation")[0]
    assert not expression_cle_ok("stressed", "Oh, very stressed.", "there's been a lot of stress")[0]   # 10b
    assert expression_cle_ok("very stressed", "Oh, very stressed.", "and you've been very stressed")[0]  # 10a
    assert expression_cle_ok("lost so much time", "I've lost so much time.", "and you've lost so much time")[0]  # 3a
    assert not expression_cle_ok("lost so much time", "I've lost so much time.", "you've wasted years")[0]     # 3c
    assert expression_cle_ok("self-doubts", "having self-doubts", "the self-doubt")[0]                       # plural
    assert expression_cle_ok("1,800 a month", "I'm making about 1,800 a month", "you're at 1,800 a month")[0]  # 11a
    assert not expression_cle_ok("1,800 a month", "I'm making about 1,800 a month", "you're at roughly 2K")[0]  # 11b
    assert expression_cle_ok("10K", "I want 10K", "you want 10,000")[0]                                      # PB-21
    assert expression_cle_ok("Failure", "Failure.", "which, in your words, is failure")[0]                   # 12a
    assert expression_cle_ok("you want to", "I want to", "you want to") == (False, "generic")


def test_normaliser_nombre():
    assert normaliser_nombre("10K") == normaliser_nombre("10,000") == normaliser_nombre("$10,000") == "10000"
    assert normaliser_nombre("ten") == "10"


def test_verifs_citation():
    c = ctx_de([("SALES", "What has that cost you?"), ("PROSPECT", "Probably 2K a month I'm not earning.")])
    assert citation_ok(c, Preuve("2K a month I'm not earning", "T002", "PROSPECT")) is None
    assert citation_ok(c, Preuve("2K a month I'm not earning", "T002", "SALES")) == "wrong_speaker"
    assert citation_ok(c, Preuve("3K a month", "T002", "PROSPECT")) == "not_a_substring"


def test_coupe_des_phrases():
    assert len(phrases("One. Two? Three!")) == 3


# ---------------------------------------------------------------- scoring
def test_regle_deux_citations_et_poids_na():
    un = item("G4", 20, 2, [Preuve("q", "T001")])
    assert un.niveau == 1
    deux = item("G4", 20, 2, [Preuve("q", "T001"), Preuve("r", "T002")])
    assert deux.niveau == 2
    assert note_appel([NoteItem("A", 50, 2), NoteItem("B", 50, None)]) == 100
    assert note_appel([NoteItem("A", 50, 1), NoteItem("B", 50, 0)]) == 25


# ---------------------------------------------------------------- runner: passes, replay, arbitration
def _tache():
    def valider(a, ctx, uid):
        return [] if citation_ok(ctx, Preuve(a.get("quote", ""), "T002", "PROSPECT")) is None else ["bad_quote"]
    return TacheModele("t.x", "fast", "foundation_phases", lambda ctx, u: "q", valider, cle=lambda a: a["v"])


def test_executeur_verifie_et_arbitre():
    c = ctx_de([("SALES", "Question?"), ("PROSPECT", "I have no clients at all.")])
    bon = {"v": True, "quote": "no clients at all"}
    r = Executeur(ClientSimule({("t.x", "u1"): bon})).executer(c, _tache(), "u1", None)
    assert r.statut == "verified" and r.concordance == "3/3"
    arb = dict(bon, justification="rule applied", case_label="application_error")
    mc = ClientSimule({("t.x", "u2"): [bon, bon, {"v": False, "quote": "no clients at all"}, arb]})
    r2 = Executeur(mc).executer(c, _tache(), "u2", None)
    assert r2.statut == "arbitrated" and r2.concordance == "2/3"


def test_executeur_citation_invalide_a_revoir():
    c = ctx_de([("SALES", "Question?"), ("PROSPECT", "I have no clients at all.")])
    mauvais = {"v": True, "quote": "invented words"}
    r = Executeur(ClientSimule({("t.x", "u3"): mauvais})).executer(c, _tache(), "u3", None)
    assert r.statut == "to_review" and r.reponse is None


def test_executeur_reponse_de_forme_inattendue_rejetee_sans_plantage():
    """C3 rule 7: a validator that cannot read an answer (KeyError(0) on a real call, 2026-10-28) rejects it."""
    c = ctx_de([("SALES", "Question?"), ("PROSPECT", "I have no clients at all.")])

    def valider(a, ctx, uid):
        return [] if a["parts"][0] else ["empty_part"]           # a list expected; the model sent an object
    t = TacheModele("t.y", "fast", "foundation_phases", lambda ctx, u: "q", valider, cle=lambda a: a["v"])
    mc = ClientSimule({("t.y", "u4"): {"v": True, "parts": {"a": 1}}})
    r = Executeur(mc).executer(c, t, "u4", None)
    assert r.statut == "to_review" and r.reponse is None
    assert any(str(e).startswith("invalid_shape:KeyError") for a in c.audit for e in a.get("errors", []))


# ---------------------------------------------------------------- foundation
def test_decisions_phase_mention_offre_et_prix():
    c = ctx_de([("SALES", "It's a six-month mentorship, I'll show you later. How long have you wanted this?"),
                ("PROSPECT", "Three years."),
                ("SALES", "Let me share my screen."),
                ("SALES", "So the way it works, it's a six-month mentorship with three pillars."),
                ("SALES", "Our students charge 800 to 1,000 per room."),
                ("SALES", "The investment is 5,800."),
                ("SALES", "Are you ready to get started?")])
    c.reference_offre = {"price": 5800}
    rep = {"T001": {"offer_description": True, "followed_by_discovery": True, "quote": "six-month mentorship"},
           "T003": {"screen_share": True, "quote": "share my screen"},
           "T004": {"offer_description": True, "quote": "six-month mentorship with three pillars"},
           "T005": {"price_for_offer": False},
           "T006": {"price_for_offer": True, "amount": 5800, "quote": "The investment is 5,800"},
           "T007": {"decision_request": True, "quote": "ready to get started"}}
    decider_phases(c, rep)
    assert c.phases.mentions_offre == ["T001"]
    assert c.phases.debut_presentation == "T003"          # screen share followed by an offer description (PB-1)
    assert c.phases.premier_prix == "T006" and c.phases.demande_decision == "T007"
    assert c.phases.fin_presentation == "T006"


def test_reparation_attribution_coupure():
    c = ctx_de([("SALES", "And the cost?"), ("PROSPECT", "what does that actually cost you? Time. The most expensive thing is time.")])
    reparer_attribution(c, [{"turn": "T002", "type": "merged", "foreign_quote": "what does that actually cost you?"}])
    ids = [t.id for t in c.tours]
    assert ids == ["T001", "T002", "T002b"]
    assert c.tour("T002b").role == "SALES" and "Time." in c.tour("T002").texte
    assert c.n("T002b") == 2


# ---------------------------------------------------------------- aggregation
def test_niveaux_periode_et_regle_plancher():
    res = [{"start_utc": f"2026-10-{d:02d}T10:00:00Z", "status": "scored", "score": 90,
            "items": [{"id": "G1", "level": 2}, {"id": "G6", "level": 1}]} for d in range(14, 21)]
    p = agregation.periode(res, "GAP", "7d", date(2026, 10, 20), "Asia/Dubai")
    assert p["n_scored"] == 7 and p["score"] == 90
    assert p["level"] == "Developing" and p.get("floor_rule")     # G6 level-2 rate 0 % < 25 %
    peu = agregation.periode(res[:3], "GAP", "7d", date(2026, 10, 20), "Asia/Dubai")
    assert peu["label"].startswith("insufficient volume")
