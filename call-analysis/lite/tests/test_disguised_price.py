"""PB-3 (Romain, 2026-11-20): a « tour du marché » whose levels are the company's offers is a disguised price, an error
of the sales: it is the first price. Fictional call (no real person)."""
from callqa_lite.phases import apply_phases
from callqa_lite.shim import Drops
from lnp_callqa.core.foundation import parse_transcript
from lnp_callqa.core.models import CallContext

S, P = "Léa - Commerciale", "Julie Martin"
LINES = [
    (S, "Qu'est-ce qui t'a amenée à réserver cet appel ?"),
    (P, "Je donne des cours mais je n'ai pas assez d'élèves."),
    (S, "Je vais t'expliquer ce qu'on trouve sur le marché. La formation en vidéo, c'est entre 1 500 et 2 000 euros. "
        "Les accompagnements hybrides, plutôt 2 500 à 4 000 euros. Lequel te conviendrait ?"),
    (P, "Je pense le premier."),
    (S, "Et qu'est-ce qui te bloque aujourd'hui pour trouver des élèves ?"),
    (P, "Je ne sais pas me vendre."),
    (S, "Je vais te présenter l'offre Starter, le premier, comme tu m'as dit tout à l'heure. Elle est à 1 580 euros."),
    (P, "D'accord."),
]


def ctx():
    raw = "\n".join(f"[00:{i:02d}:00] {w}: {t}" for i, (w, t) in enumerate(LINES))
    return CallContext("c", "s", "2026-11-20T10:00:00Z", "Europe/Paris", parse_transcript(raw, {S: "SALES", P: "PROSPECT"}))


TOUR = {"turn": "T003", "quote": "La formation en vidéo, c'est entre 1 500 et 2 000 euros", "price_for_offer": True,
        "lnp_offer_price": True, "market_tour": True, "range": [1500, 2000], "offer_description": True,
        "tied_later": {"turn": "T007", "quote": "le premier, comme tu m'as dit tout à l'heure"}}
OFFER = {"turn": "T007", "quote": "Je vais te présenter l'offre Starter", "offer_description": True,
         "price_for_offer": True, "lnp_offer_price": True, "amount": 1580,
         "offer_explained": {"turn": "T007", "quote": "Je vais te présenter l'offre Starter"}}


def test_a_market_tour_tied_to_the_offer_is_the_first_price():
    c, d = ctx(), Drops()
    apply_phases(c, {"turns": [TOUR, OFFER]}, d)
    assert c.phases.first_price == "T003" and c.phases.pitch_start == "T003"
    assert "disguised_price" in c.phases.flags and "disguised_price" in c.flags
    assert c.phases.discovery_end == "T003"                       # the questions after it are no longer discovery


def test_a_market_tour_never_tied_to_the_offer_stays_a_market_price():
    c, d = ctx(), Drops()
    apply_phases(c, {"turns": [dict(TOUR, tied_later=None), OFFER]}, d)
    assert c.phases.first_price == "T007" and "disguised_price" not in c.flags
    assert d.counts["S0"]["price:market_tour_not_tied"] == 1
    c, d = ctx(), Drops()                                         # a "later" turn that is not later
    apply_phases(c, {"turns": [dict(TOUR, tied_later={"turn": "T001", "quote": "Qu'est-ce qui t'a amenée"}), OFFER]}, d)
    assert c.phases.first_price == "T007"
