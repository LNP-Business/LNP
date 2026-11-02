"""Shared data model of the ALKIMIY call analysis engine.

Every object that carries a claim about the transcript carries its Evidence
(exact quote + turn). Competence modules read and write the CallContext only.
"""
from __future__ import annotations

from dataclasses import dataclass, field, asdict
from typing import Any, Optional

SALES, PROSPECT, OTHER = "SALES", "PROSPECT", "OTHER"


@dataclass
class Turn:
    id: str                 # "T001"
    n: int                  # 1
    ts: str                 # "mm:ss" or "h:mm:ss"
    speaker: str            # raw label
    role: str               # SALES / PROSPECT / OTHER
    text: str
    attribution_doubtful: bool = False
    repaired: bool = False


@dataclass
class Evidence:
    quote: str
    turn: str
    role: Optional[str] = None      # expected role of the speaker, checked by code

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class PhaseMap:
    discovery_start: Optional[str] = None
    discovery_end: Optional[str] = None
    pitch_start: Optional[str] = None
    first_price: Optional[str] = None
    decision_request: Optional[str] = None
    pitch_end: Optional[str] = None
    offer_mentions: list[str] = field(default_factory=list)
    early_price: Optional[str] = None
    evidence: dict[str, Evidence] = field(default_factory=dict)
    flags: list[str] = field(default_factory=list)


@dataclass
class Solicitation:
    """A sales solicitation (SPIN bounding reference, SEG-1..8)."""
    id: str
    turn: str
    text: str
    letter: Optional[str] = None      # S / P / I / N / OUT
    out_reason: Optional[str] = None  # nothing, info_solution, solution_load, sales_list, agreement, absent
    tags: list[str] = field(default_factory=list)
    answer_turns: list[str] = field(default_factory=list)
    followed_up: bool = False
    status: str = "pending"           # verified / arbitrated / to_review


@dataclass
class Atom:
    """A prospect atom (SPIN annex A3): SITUATION, PAIN, BLOCKER, IMPACT, DESIRE, VALUE."""
    id: str
    type: str
    evidence: Evidence
    solicitation_id: Optional[str] = None   # the solicitation whose answer contains it
    letter: Optional[str] = None            # letter of that solicitation
    object: Optional[str] = None            # object label (SB-16)
    domain: Optional[str] = None            # money, time, clients, family, health, self-belief, future
    quantified: bool = False
    value: Optional[float] = None
    unit: Optional[str] = None
    volunteered: bool = False
    prompted_by_sales: bool = False


@dataclass
class ItemScore:
    id: str
    weight: float
    level: Optional[int]                     # 0, 1, 2 or None (not applicable)
    evidence: list[Evidence] = field(default_factory=list)
    note: str = ""


@dataclass
class CompetenceResult:
    competence: str
    rules_version: str
    status: str = "scored"                   # scored / not_applicable / excluded / to_review
    verdict: Optional[str] = None            # e.g. present / absent / compliant / non_compliant
    reasons: list[str] = field(default_factory=list)
    score: Optional[int] = None
    items: list[ItemScore] = field(default_factory=list)
    flags: list[str] = field(default_factory=list)
    details: dict[str, Any] = field(default_factory=dict)
    concordance: Optional[str] = None

    def to_dict(self) -> dict:
        d = asdict(self)
        return d


@dataclass
class CallContext:
    call_id: str
    sales_id: str
    start_utc: str
    timezone: str
    turns: list[Turn]
    offer_reference: dict[str, Any] = field(default_factory=dict)
    case_library: list[dict[str, Any]] = field(default_factory=list)
    prior_inputs: list[dict[str, Any]] = field(default_factory=list)   # form text, earlier calls of the cycle
    status: str = "ok"                       # ok / no_transcript / no_diarization / diarization_suspect
    flags: list[str] = field(default_factory=list)
    phases: PhaseMap = field(default_factory=PhaseMap)
    solicitations: list[Solicitation] = field(default_factory=list)
    atoms: list[Atom] = field(default_factory=list)
    results: dict[str, CompetenceResult] = field(default_factory=dict)
    audit: list[dict[str, Any]] = field(default_factory=list)          # every model pass, arbitration, error

    # ---- helpers -------------------------------------------------------------
    def turn(self, tid: str) -> Turn:
        return self._index()[tid]

    def _index(self) -> dict[str, Turn]:
        key = tuple(t.id for t in self.turns)
        if getattr(self, "_idx_key", None) != key:
            self._idx = {t.id: t for t in self.turns}
            self._pos = {t.id: i for i, t in enumerate(self.turns)}
            self._idx_key = key
        return self._idx

    def n(self, tid: Optional[str]) -> Optional[int]:
        """Position of a turn in the (repaired) transcript; repaired sub-turns ("T050b") sort right after."""
        if tid is None:
            return None
        self._index()
        return self._pos[tid]

    def before(self, a: Optional[str], b: Optional[str]) -> bool:
        """True if turn a is strictly before turn b (b None = end of call)."""
        if a is None:
            return False
        return b is None or self.n(a) < self.n(b)

    def window(self, start: Optional[str], end: Optional[str]) -> list[Turn]:
        s = self.n(start) if start else 0
        e = self.n(end) if end else len(self.turns)
        return self.turns[s:e]

    def render(self, turns: Optional[list[Turn]] = None) -> str:
        """Compact transcript fed to the model: one line per turn."""
        turns = self.turns if turns is None else turns
        return "\n".join(f"[{t.id} {t.ts}] {t.role}: {t.text}" for t in turns if not t.attribution_doubtful)
