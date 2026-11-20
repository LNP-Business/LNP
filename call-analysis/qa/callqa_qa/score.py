"""Measure one analysis record against its reference, and several records of one call against each other.

Each measure is a pair (right, out of): a share is computed only on what the reference states. Nothing here changes a
rule or a score of the engine: the measure only reads the record (docs/OUTPUT_CONTRACT.md).
"""
from __future__ import annotations

from collections import Counter
from typing import Any, Optional

from .reference import ANCHORS, COMPETENCES, accepted, same_words

Pair = list  # [right, out_of]


def _pair(right: int, out_of: int) -> Pair:
    return [right, out_of]


def _num(v: Any) -> Optional[float]:
    """A score as a number (a stored record may hold it as text)."""
    try:
        return None if v is None else float(v)
    except (TypeError, ValueError):
        return None


def _turn_text(rec: dict) -> dict[str, str]:
    return {t["id"]: t["text"] for t in rec.get("turns") or []}


def _letter(sol: dict) -> str:
    return sol.get("letter") or "OUT"


def match_questions(ref: dict, rec: dict) -> list[tuple[dict, Optional[dict]]]:
    """Each expected question with the record's solicitation that asks it (None if the record missed it). A
    solicitation answers one expected question at most, the first one that matches."""
    sols = ((rec.get("results") or {}).get("SPIN") or {}).get("details", {}).get("solicitations") or []
    used, out = set(), []
    for q in ref.get("questions") or []:
        hit = next((s for s in sols if s.get("id") not in used and same_words(q["quote"], s.get("quote") or "")), None)
        if hit:
            used.add(hit.get("id"))
        out.append((q, hit))
    return out


def spin(ref: dict, rec: dict) -> dict:
    pairs = match_questions(ref, rec)
    det = ((rec.get("results") or {}).get("SPIN") or {}).get("details") or {}
    kept = [a for a in det.get("atom_decisions") or [] if a.get("decision") == "kept"]
    found = sum(1 for _, s in pairs if s)
    letters = [(q, s) for q, s in pairs if s and "letter" in q]
    regs = [(q, s) for q, s in pairs if s and "register" in q and _letter(s) != "OUT"]
    atoms = [a for q, _ in pairs for a in q.get("atoms") or []]
    atom_hits = [(a, next((k for k in kept if same_words(a["quote"], k.get("quote") or "", 0.5)), None)) for a in atoms]
    typed = [(a, k) for a, k in atom_hits if k and "type" in a]
    out = {
        "questions_found": _pair(found, len(pairs)),
        "letters": _pair(sum(_letter(s) in accepted(q["letter"]) for q, s in letters), len(letters)),
        "registers": _pair(sum((s.get("register") or "") in accepted(q["register"]) for q, s in regs), len(regs)),
        "atoms_found": _pair(sum(1 for _, k in atom_hits if k), len(atom_hits)),
        "atom_types": _pair(sum((k.get("type") or "") in accepted(a["type"]) for a, k in typed), len(typed)),
        "errors": [],
    }
    for q, s in pairs:
        if not s:
            out["errors"].append({"kind": "question_missed", "quote": q["quote"]})
        elif "letter" in q and _letter(s) not in accepted(q["letter"]):
            out["errors"].append({"kind": "letter", "quote": q["quote"], "expected": q["letter"], "found": _letter(s)})
        elif q in [x for x, _ in regs] and (s.get("register") or "") not in accepted(q["register"]):
            out["errors"].append({"kind": "register", "quote": q["quote"], "expected": q["register"],
                                  "found": s.get("register")})
    for a, k in atom_hits:
        if not k:
            out["errors"].append({"kind": "atom_missed", "quote": a["quote"], "expected": a.get("type")})
    if (ref.get("complete") or {}).get("questions"):
        sols = [s for s in det.get("solicitations") or [] if s.get("in_perimeter") and _letter(s) != "OUT"]
        matched = {s.get("id") for _, s in pairs if s}
        extra = [s for s in sols if s.get("id") not in matched]
        out["questions_extra"] = len(extra)
        out["errors"] += [{"kind": "question_extra", "quote": s.get("quote")} for s in extra]
    return out


def phases(ref: dict, rec: dict) -> dict:
    exp = ref.get("phases") or {}
    text, got = _turn_text(rec), rec.get("phases") or {}
    right, errs = 0, []
    for k in ANCHORS:
        if k not in exp:
            continue
        tid = got.get(k)
        ok = (tid is None) if exp[k] is None else bool(tid) and same_words(exp[k], text.get(tid, ""), 0.8)
        right += ok
        if not ok:
            errs.append({"kind": f"phase:{k}", "expected": exp[k], "found": text.get(tid) if tid else None})
    return {"anchors": _pair(right, sum(1 for k in ANCHORS if k in exp)), "errors": errs}


def gap(ref: dict, rec: dict) -> dict:
    exp = ref.get("gap") or {}
    g = (rec.get("results") or {}).get("GAP") or {}
    det = g.get("details") or {}
    out: dict[str, Any] = {"errors": []}
    if "verdict" in exp:
        ok = g.get("verdict") == exp["verdict"]
        out["verdict"] = _pair(int(ok), 1)
        if not ok:
            out["errors"].append({"kind": "gap_verdict", "expected": exp["verdict"], "found": g.get("verdict")})
    if "absence_reason" in exp:
        ok = det.get("absence_reason") in accepted(exp["absence_reason"])
        out["absence_reason"] = _pair(int(ok), 1)
        if not ok:
            out["errors"].append({"kind": "gap_absence_reason", "expected": exp["absence_reason"],
                                  "found": det.get("absence_reason")})
    comps = exp.get("components") or {}
    if comps:
        right = 0
        for k, q in comps.items():
            got = component_quotes(det, k)
            ok = (not got) if q is None else any(same_words(q, x, 0.5) for x in got)
            right += ok
            if not ok:
                out["errors"].append({"kind": f"gap_component:{k}", "expected": q, "found": got[:3] or None})
        out["components"] = _pair(right, len(comps))
    return out


def component_quotes(det: dict, comp: str) -> list[str]:
    """Every prospect passage the analysis holds for one gap component: the element it selected, the validated problem,
    the source of a restated clause, the problems and costs it collected."""
    out: list[str] = []
    sel = det.get({"A": "selected_A", "B": "selected_B", "PROBLEM": "selected_P"}.get(comp, "")) or {}
    if isinstance(sel, dict) and sel.get("quote"):
        out.append(sel["quote"])
    if comp == "PROBLEM" and isinstance(det.get("validated_P"), str):
        out.append(det["validated_P"])
    for c in (det.get("restitution") or {}).get("clauses") or []:
        if c.get("component") == comp:
            out += [x for x in (c.get("source_quote"), c.get("key_expression")) if x]
    g = det.get("gap") or {}
    lst = {"PROBLEM": g.get("problem"), "COST": (g.get("cost") or []) + (det.get("cost") or []),
           "A": [g.get("A")], "B": [g.get("B")]}.get(comp) or []
    out += [x.get("quote") for x in lst if isinstance(x, dict) and x.get("quote")]
    return out


def pitch(ref: dict, rec: dict) -> dict:
    exp = ref.get("pitch") or {}
    p = (rec.get("results") or {}).get("PITCH") or {}
    if "verdict" not in exp:
        return {"errors": []}
    ok = p.get("verdict") == exp["verdict"]
    return {"verdict": _pair(int(ok), 1),
            "errors": [] if ok else [{"kind": "pitch_verdict", "expected": exp["verdict"], "found": p.get("verdict")}]}


def _explored(e: dict) -> bool:
    x = e.get("explore")
    return bool(x.get("asked")) if isinstance(x, dict) else bool(x)


def objections(ref: dict, rec: dict) -> dict:
    eps = (((rec.get("results") or {}).get("OBJECTIONS") or {}).get("details") or {}).get("episodes") or []
    exp = ref.get("objections") or []
    used, out = set(), {"errors": []}
    gestures = Counter()
    found = 0
    for o in exp:
        hit = next((e for e in eps if e.get("id") not in used and any(
            same_words(o["quote"], x.get("quote") or "", 0.5) for x in (e.get("quotes") or [e.get("resistance") or {}]))),
            None)
        if not hit:
            out["errors"].append({"kind": "objection_missed", "quote": o["quote"]})
            continue
        used.add(hit.get("id"))
        found += 1
        if "nature" in o:
            gestures["nature_out_of"] += 1
            ok = hit.get("nature") in accepted(o["nature"])
            gestures["nature"] += ok
            if not ok:
                out["errors"].append({"kind": "objection_nature", "quote": o["quote"], "expected": o["nature"],
                                      "found": hit.get("nature")})
        for g, val in (("acknowledge", bool(hit.get("acknowledge"))), ("isolate", bool(hit.get("isolate"))),
                       ("explore", _explored(hit)), ("gesture_match", hit.get("gesture_match") in ("yes", True))):
            if g in o:
                gestures["gestures_out_of"] += 1
                ok = bool(o[g]) == val
                gestures["gestures"] += ok
                if not ok:
                    out["errors"].append({"kind": f"objection_{g}", "quote": o["quote"], "expected": o[g], "found": val})
    out["found"] = _pair(found, len(exp))
    out["nature"] = _pair(gestures["nature"], gestures["nature_out_of"])
    out["gestures"] = _pair(gestures["gestures"], gestures["gestures_out_of"])
    if (ref.get("complete") or {}).get("objections"):
        extra = [e for e in eps if e.get("id") not in used]
        out["extra"] = len(extra)
        out["errors"] += [{"kind": "objection_extra", "quote": (e.get("resistance") or {}).get("quote")} for e in extra]
    return out


def statuses(ref: dict, rec: dict) -> dict:
    res = rec.get("results") or {}
    out = {"status": _pair(0, 0), "score": _pair(0, 0), "errors": []}
    for k in COMPETENCES:
        r = res.get(k) or {}
        if k in (ref.get("status") or {}):
            ok = r.get("status") in accepted(ref["status"][k])
            out["status"][0] += ok
            out["status"][1] += 1
            if not ok:
                out["errors"].append({"kind": f"status:{k}", "expected": ref["status"][k], "found": r.get("status")})
        rng = (ref.get("scores") or {}).get(k)
        if rng:
            sc = _num(r.get("score"))
            ok = sc is not None and rng[0] <= sc <= rng[1]
            out["score"][0] += ok
            out["score"][1] += 1
            if not ok:
                out["errors"].append({"kind": f"score:{k}", "expected": rng, "found": sc})
    return out


def measure(ref: dict, rec: dict) -> dict:
    """Every measure of one record, and its errors (what a person would correct), grouped by competence."""
    parts = {"status": statuses(ref, rec), "phases": phases(ref, rec), "spin": spin(ref, rec), "gap": gap(ref, rec),
             "pitch": pitch(ref, rec), "objections": objections(ref, rec)}
    errors = [e for p in parts.values() for e in p.pop("errors")]
    voices = (rec.get("meta") or {}).get("voices") or {}
    return {"call_id": ref.get("call_id"), "slug": ref.get("slug"), "split": ref.get("split"),
            "record_status": rec.get("status"), "voices": {k: voices.get(k) for k in
                                                           ("share_corrected", "share_residual", "status")},
            **parts, "errors": errors, "n_errors": len(errors)}


def share(p: Pair) -> Optional[float]:
    return round(p[0] / p[1], 3) if p and p[1] else None


def total(measures: list[dict]) -> dict:
    """The measures of several calls added up, as shares."""
    keys = [("status", "status"), ("status", "score"), ("phases", "anchors"), ("spin", "questions_found"),
            ("spin", "letters"), ("spin", "registers"), ("spin", "atoms_found"), ("spin", "atom_types"),
            ("gap", "verdict"), ("gap", "absence_reason"), ("gap", "components"), ("pitch", "verdict"),
            ("objections", "found"), ("objections", "nature"), ("objections", "gestures")]
    out = {}
    for a, b in keys:
        r = sum((m.get(a) or {}).get(b, [0, 0])[0] for m in measures)
        n = sum((m.get(a) or {}).get(b, [0, 0])[1] for m in measures)
        out[f"{a}.{b}"] = {"right": r, "out_of": n, "share": share([r, n])}
    out["errors"] = sum(m["n_errors"] for m in measures)
    return out


# ------------------------------------------------------------------ reproducibility (Part C, C4)
def reproducibility(ref: dict, records: list[dict]) -> dict:
    """Several records of the same call: the share of expected questions given the same letter (and register) in
    every record, and the spread of each score. C4 asks 95 % identical before one reading is allowed."""
    per_q = [match_questions(ref, r) for r in records]
    same_letter = same_reg = n = 0
    for i, q in enumerate(ref.get("questions") or []):
        hits = [pq[i][1] for pq in per_q]
        n += 1
        letters = {(_letter(h) if h else "missed") for h in hits}
        regs = {((h.get("register") or "-") if h else "missed") for h in hits}
        same_letter += len(letters) == 1
        same_reg += len(regs) == 1
    spread = {}
    for k in COMPETENCES:
        vals = [((r.get("results") or {}).get(k) or {}) for r in records]
        scores = [_num(v.get("score")) for v in vals if _num(v.get("score")) is not None]
        spread[k] = {"scores": [v.get("score") if v.get("score") is not None else v.get("status") for v in vals],
                     "spread": (max(scores) - min(scores)) if scores else None}
    return {"runs": len(records), "same_letter": _pair(same_letter, n), "same_register": _pair(same_reg, n),
            "same_letter_share": share([same_letter, n]), "same_register_share": share([same_reg, n]),
            "scores": spread, "c4_target": 0.95}
