"""Le scénario de présentation de l'offre de l'appel 001 (test de présentation de l'appel réel 001 du moteur, exécution
complète), refait pour les tests de l'exécutant."""
from lnp_analyse.noyau.modeles import Preuve, COMMERCIAL, ResultatCompetence


def plage(tour, citation):
    return {"start_turn": tour, "start_quote": citation, "end_turn": tour, "end_quote": citation}


def presentation_001_preparation(charger):
    from lnp_analyse.competences import presentation as P
    ctx = charger("001")
    ph = ctx.phases
    ph.debut_presentation, ph.premier_prix, ph.fin_presentation = "T085", "T113", "T113"
    ph.preuve["first_price"] = Preuve("the investment for our core program is 5,800 USD", "T113", COMMERCIAL)
    vp = {"quote": "really helping me figure out the marketing and getting the clients", "turn": "T028", "key_expression": "getting the clients"}
    base = {"verdict": "present", "validation_turn": "T082", "restitution_span": [], "selected_A": None, "selected_B": None,
            "selected_P": None, "validated_P": vp, "cost": [],
            "roadmap_blockers": [{"object": "marketing", "quote": vp["quote"], "turn": "T028", "solicitation": "s1"}]}
    ctx.resultats["GAP"] = ResultatCompetence("GAP", "GAP-1.3", verdict="present", details=base)
    q91 = "You don't have a client acquisition system at all."
    blocs = P.blocs(ctx, P.CONFIG_DEFAUT["chunk_turns"])
    uid_affirmations = next(f"claims:{a}-{b}" for a, b in blocs if ctx.n(a) <= ctx.n("T113") <= ctx.n(b))
    reponses = {
        ("pitch.p_category", "pcat:T028"): {"category": "Acquisition", "turn": "T028", "quote": "figure out the marketing and getting the clients"},
        ("pitch.step1", "step1:T085"): {"step": plage("T091", q91), "other_blockers": []},
        ("pitch.claims", uid_affirmations): {"claims": [{"kind": "price", "turn": "T113", "quote": "the investment for our core program is 5,800 USD"}]},
    }
    return ctx, reponses
