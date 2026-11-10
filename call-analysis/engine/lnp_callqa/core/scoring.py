"""Generic scoring helpers (Part B of each methodology): items 0/1/2, weights, two-quote rule."""
from __future__ import annotations

from typing import Optional

from .models import Evidence, ItemScore


def two_quote_cap(level: Optional[int], evidence: list[Evidence]) -> Optional[int]:
    """C3 rule 4: level 2 needs two distinct quotes (different turns or non-overlapping passages)."""
    if level != 2:
        return level
    distinct = {(e.turn, e.quote.strip().lower()) for e in evidence if e and e.quote}
    if len(distinct) < 2:
        return 1
    return 2


def call_score(items: list[ItemScore]) -> Optional[int]:
    """Σ weight × level / 2 on 100. Not-applicable items (level None) have their weight spread
    proportionally over the applicable ones."""
    app = [i for i in items if i.level is not None]
    if not app:
        return None
    w = sum(i.weight for i in app)
    total = sum(i.weight * i.level / 2 for i in app)
    return round(100 * total / w) if w else None


def item(id_: str, weight: float, level: Optional[int], evidence: Optional[list[Evidence]] = None,
         note: str = "", two_quotes: bool = True) -> ItemScore:
    ev = [e for e in (evidence or []) if e]
    lv = two_quote_cap(level, ev) if two_quotes else level
    if lv != level and level == 2:
        note = (note + "; " if note else "") + "capped at 1: second quote missing (C3 rule 4)"
    return ItemScore(id_, weight, lv, ev, note)
