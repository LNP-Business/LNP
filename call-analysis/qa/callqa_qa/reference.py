"""The reference file of one call: what a person reading the transcript expects the analysis to find.

Every item is keyed by the exact words of the transcript, never by a turn id: the turn ids change when the voices are
repaired or the parsing changes, the words do not. `validate()` checks the file against the recorded transcript.

{
  "call_id": "…", "slug": "…", "split": "tuning" | "control",        # control calls never serve to tune (C7)
  "round": "R1" | "R2", "source": "audit of 2026-11-19", "complete": {"questions": true, "objections": true},
  "status": {"SPIN": "scored", "GAP": "scored", "PITCH": "scored", "OBJECTIONS": "scored"},   # or not_applicable, excluded
  "scores": {"SPIN": [60, 85], "OBJECTIONS": [55, 64]},                # the range a correct analysis may give
  "phases": {"discovery_start": "quote", "pitch_start": "quote", "first_price": "quote", "decision_request": "quote"},
  "questions": [{"quote": "…", "letter": "S|P|I|N|OUT", "register": "financial|time_load|identity_status|
                 mental_emotional|other", "atoms": [{"type": "SITUATION|PAIN|BLOCKER|IMPACT|DESIRE|VALUE", "quote": "…"}], "note": "…"}],
  "gap": {"verdict": "present|absent", "absence_reason": "…", "components": {"PROBLEM": "quote"|null, "COST": …,
          "A": …, "B": …}},
  "pitch": {"verdict": "compliant|non_compliant"},
  "objections": [{"quote": "…", "nature": "…", "acknowledge": bool, "isolate": bool, "explore": bool,
                  "gesture_match": bool}]
}
A field left out is not measured. `letter`, `register`, an atom's `type` may be a list of the accepted answers.
"""
from __future__ import annotations

import json
import re
import unicodedata
from pathlib import Path
from typing import Any, Iterable

LETTERS = ("S", "P", "I", "N", "OUT")
REGISTERS = ("financial", "time_load", "identity_status", "mental_emotional", "other")
ATOMS = ("SITUATION", "PAIN", "BLOCKER", "IMPACT", "DESIRE", "VALUE")          # engine spin.ATOM_TYPES
COMPETENCES = ("SPIN", "GAP", "PITCH", "OBJECTIONS")
ANCHORS = ("discovery_start", "pitch_start", "first_price", "decision_request")


def norm(s: str) -> str:
    """Lower case, one kind of apostrophe, punctuation as spaces, one space: the words only."""
    s = unicodedata.normalize("NFC", s or "").lower().replace("’", "'").replace("`", "'")
    s = re.sub(r"[^\w']+", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def same_words(expected: str, found: str, share: float = 0.6) -> bool:
    """The found passage is the expected one: one holds the other, or most expected words are in it (a model quote may
    be shorter, longer or cut differently)."""
    e, f = norm(expected), norm(found)
    if not e or not f:
        return False
    if e in f or (len(f.split()) >= 3 and f in e):
        return True
    ew, fw = e.split(), set(f.split())
    return len(ew) >= 3 and sum(w in fw for w in ew) / len(ew) >= share


def accepted(value: Any) -> set:
    return set(value) if isinstance(value, list) else {value}


def load(path: str | Path) -> dict:
    return json.loads(Path(path).read_text(encoding="utf-8"))


def load_dir(folder: str | Path) -> list[dict]:
    return [load(p) for p in sorted(Path(folder).glob("*.json"))]


def _quotes(ref: dict) -> Iterable[tuple[str, str]]:
    for k, q in (ref.get("phases") or {}).items():
        if q:
            yield f"phases.{k}", q
    for i, q in enumerate(ref.get("questions") or []):
        yield f"questions[{i}]", q.get("quote", "")
        for j, a in enumerate(q.get("atoms") or []):
            yield f"questions[{i}].atoms[{j}]", a.get("quote", "")
    for k, q in ((ref.get("gap") or {}).get("components") or {}).items():
        if q:
            yield f"gap.components.{k}", q
    for i, o in enumerate(ref.get("objections") or []):
        yield f"objections[{i}]", o.get("quote", "")


def validate(ref: dict, transcript: str) -> list[str]:
    """The errors of a reference file: unknown values, and quotes that are not words of the transcript."""
    errs = []
    if ref.get("split") not in ("tuning", "control"):
        errs.append("split: tuning or control")
    for k in ref.get("status") or {}:
        if k not in COMPETENCES:
            errs.append(f"status.{k}: unknown competence")
    for k in ref.get("phases") or {}:
        if k not in ANCHORS:
            errs.append(f"phases.{k}: unknown anchor")
    for i, q in enumerate(ref.get("questions") or []):
        if "letter" in q and not accepted(q["letter"]) <= set(LETTERS):
            errs.append(f"questions[{i}].letter: {q['letter']}")
        if "register" in q and not accepted(q["register"]) <= set(REGISTERS):
            errs.append(f"questions[{i}].register: {q['register']}")
        for j, a in enumerate(q.get("atoms") or []):
            if "type" in a and not accepted(a["type"]) <= set(ATOMS):
                errs.append(f"questions[{i}].atoms[{j}].type: {a['type']}")
    text = norm(re.sub(r"^\[[^\]]*\]\s*[^:]{1,80}:\s*", "", transcript or "", flags=re.M))
    for where, q in _quotes(ref):
        if not norm(q) or norm(q) not in text:
            errs.append(f"{where}: not in the transcript: {q[:60]!r}")
    return errs
