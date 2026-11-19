"""Generic scoring helpers (Part B of each methodology): items 0/1/2, weights, two-quote rule."""
from __future__ import annotations

from typing import Optional

from .modeles import Preuve, NoteItem


def plafond_deux_citations(niveau: Optional[int], preuve: list[Preuve]) -> Optional[int]:
    """C3 rule 4: level 2 needs two distinct quotes (different turns or non-overlapping passages)."""
    if niveau != 2:
        return niveau
    distinct = {(e.tour, e.citation.strip().lower()) for e in preuve if e and e.citation}
    if len(distinct) < 2:
        return 1
    return 2


def note_appel(items: list[NoteItem]) -> Optional[int]:
    """Σ weight × level / 2 on 100. Not-applicable items (level None) have their weight spread
    proportionally over the applicable ones."""
    app = [i for i in items if i.niveau is not None]
    if not app:
        return None
    w = sum(i.poids for i in app)
    total = sum(i.poids * i.niveau / 2 for i in app)
    return round(100 * total / w) if w else None


def item(id_: str, poids: float, niveau: Optional[int], preuve: Optional[list[Preuve]] = None,
         remarque: str = "", deux_citations: bool = True) -> NoteItem:
    ev = [e for e in (preuve or []) if e]
    lv = plafond_deux_citations(niveau, ev) if deux_citations else niveau
    if lv != niveau and niveau == 2:
        remarque = (remarque + "; " if remarque else "") + "capped at 1: second quote missing (C3 rule 4)"
    return NoteItem(id_, poids, lv, ev, remarque)
