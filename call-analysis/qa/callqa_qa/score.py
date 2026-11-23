"""Measure one analysis record against its reference, and several records of one call against each other.

Each measure is a pair (right, out of): a share is computed only on what the reference states. Nothing here changes a
rule or a score of the engine: the measure only reads the record (docs/OUTPUT_CONTRACT.md).
"""
from __future__ import annotations

from collections import Counter
from typing import Any, Optional

from .reference import ANCHORS, COMPETENCES, accepted, norm, same_words

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
    where = _turn_of(rec)
    # first by the turn (2026-11-23): the expected words are in one turn of the record; the analysis' solicitation of
    # that turn is the one compared (the same words first, else what it chose to read there, SEG-1). A short question
    # matched by its words alone met unrelated turns (« c'est quoi le problème aujourd'hui ? »).
    for q in ref.get("questions") or []:
        tid = where(q["quote"])
        here = [s for s in sols if s.get("id") not in used and tid and s.get("turn") == tid]
        hit = next((s for s in here if same_words(q["quote"], s.get("quote") or "")), None) or (here[0] if here else None)
        if hit:
            used.add(hit.get("id"))
        out.append((q, hit, tid))
    # then by the words, for an expected question whose turn the record does not hold (another voice repair)
    for i, (q, hit, tid) in enumerate(out):
        if hit is None and tid is None:
            alt = next((s for s in sols if s.get("id") not in used and same_words(q["quote"], s.get("quote") or "")), None)
            if alt:
                used.add(alt.get("id"))
                out[i] = (q, alt, tid)
    return [(q, hit) for q, hit, _ in out]


def _turn_of(rec: dict):
    """quote → the id of the record's turn that holds its words (None if no turn does)."""
    turns = [(t["id"], norm(t.get("text") or "")) for t in rec.get("turns") or []]

    def find(quote: str):
        q = norm(quote or "")
        return next((tid for tid, text in turns if q and q in text), None)
    return find


def spin(ref: dict, rec: dict) -> dict:
    pairs = match_questions(ref, rec)
    det = ((rec.get("results") or {}).get("SPIN") or {}).get("details") or {}
    kept = [a for a in det.get("atom_decisions") or [] if a.get("decision") == "kept"]
    found = sum(1 for _, s in pairs if s)
    letters = [(q, s) for q, s in pairs if s and "letter" in q and s.get("status") != "to_review"]   # C4: undecided
    regs = [(q, s) for q, s in pairs if s and "register" in q and _letter(s) != "OUT" and s.get("status") != "to_review"]
    atoms = [a for q, _ in pairs for a in q.get("atoms") or []]
    atom_hits = [(a, next((k for k in kept if same_words(a["quote"], k.get("quote") or "", 0.5)), None)) for a in atoms]
    typed = [(a, k) for a, k in atom_hits if k and "type" in a]
    out = {
        "questions_found": _pair(found, len(pairs)),
        "questions_to_review": _pair(sum(1 for _, s in pairs if s and s.get("status") == "to_review"), found),
        "letters": _pair(sum(_letter(s) in accepted(q["letter"]) for q, s in letters), len(letters)),
        "registers": _pair(sum((s.get("register") or "") in accepted(q["register"]) for q, s in regs), len(regs)),
        "atoms_found": _pair(sum(1 for _, k in atom_hits if k), len(atom_hits)),
        "atom_types": _pair(sum((k.get("type") or "") in accepted(a["type"]) for a, k in typed), len(typed)),
        "errors": [],
    }
    for q, s in pairs:
        if not s:
            out["errors"].append({"kind": "question_missed", "quote": q["quote"]})
        elif s.get("status") == "to_review":
            continue
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
        out["questions_extra_n"] = _pair(len(extra), len(sols))
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
        # an anchor may list several accepted turns (two defensible readings of the rule), null among them
        ok = any((tid is None) if x is None else bool(tid) and same_words(x, text.get(tid, ""), 0.8)
                 for x in (exp[k] if isinstance(exp[k], list) else [exp[k]]))
        if not ok and k == "discovery_start" and tid and exp[k]:
            ok = _same_perimeter_start(ref, rec, tid)
        right += ok
        if not ok:
            errs.append({"kind": f"phase:{k}", "expected": exp[k], "found": text.get(tid) if tid else None})
    return {"anchors": _pair(right, sum(1 for k in ANCHORS if k in exp)), "errors": errs}


def _same_perimeter_start(ref: dict, rec: dict, tid: str) -> bool:
    """The discovery start is a border, right when it bounds the same questions (2026-11-23): no expected S, P, I or N
    question lies before the analysis' start, and the analysis reads no S, P, I or N question before the first expected
    question. The turns between two such starts hold only warm-up and OUT questions."""
    order = {t["id"]: i for i, t in enumerate(rec.get("turns") or [])}
    where = _turn_of(rec)
    qs = ref.get("questions") or []
    if not qs or tid not in order:
        return False
    coded = [order.get(where(q["quote"])) for q in qs if not (accepted(q.get("letter")) <= {"OUT"})]
    coded = [i for i in coded if i is not None]
    first = min((order.get(where(q["quote"])) for q in qs if where(q["quote"]) in order), default=None)
    if not coded or first is None or min(coded) < order[tid]:
        return False
    sols = ((rec.get("results") or {}).get("SPIN") or {}).get("details", {}).get("solicitations") or []
    return not any(s.get("in_perimeter") and _letter(s) != "OUT" and order.get(s.get("turn"), 10 ** 9) < first for s in sols)


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
    if "blocker_state" in exp:
        found = (det.get("blocker") or {}).get("state")
        ok = found in accepted(exp["blocker_state"])
        out["blocker_state"] = _pair(int(ok), 1)
        if not ok:
            out["errors"].append({"kind": "gap_blocker_state", "expected": exp["blocker_state"], "found": found})
    if exp.get("stopping_question"):
        found = ((det.get("blocker") or {}).get("question") or {}).get("quote") or ""
        ok = same_words(exp["stopping_question"], found, 0.5)
        out["stopping_question"] = _pair(int(ok), 1)
        if not ok:
            out["errors"].append({"kind": "gap_stopping_question", "expected": exp["stopping_question"], "found": found or None})
    comps = exp.get("components") or {}
    if comps:
        right = 0
        for k, q in comps.items():
            got = component_quotes(det, k)
            # several accepted answers: the words were said in more than one place, or null (rightly not selected)
            ok = any((not got) if x is None else any(same_words(x, y, 0.5) for y in got)
                     for x in (q if isinstance(q, list) else [q]))
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
    order = {t["id"]: i for i, t in enumerate(rec.get("turns") or [])}
    where = _turn_of(rec)
    for o in exp:
        hit = next((e for e in eps if e.get("id") not in used and any(
            same_words(o["quote"], x.get("quote") or "", 0.5) for x in (e.get("quotes") or [e.get("resistance") or {}]))),
            None)
        if not hit:                               # the same resistance read on another sentence, two turns around at most
            at = order.get(where(o["quote"]))
            hit = next((e for e in eps if e.get("id") not in used and at is not None and any(
                abs(order.get(x.get("turn"), 10 ** 9) - at) <= 2 for x in (e.get("quotes") or [e.get("resistance") or {}]))), None)
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
        if o.get("reaction"):                                  # the prospect's reaction level (resolved … persisting)
            gestures["reaction_out_of"] += 1
            lvl = (hit.get("reaction") or {}).get("level") if isinstance(hit.get("reaction"), dict) else hit.get("reaction")
            ok = lvl in accepted(o["reaction"])
            gestures["reaction"] += ok
            if not ok:
                out["errors"].append({"kind": "objection_reaction", "quote": o["quote"], "expected": o["reaction"], "found": lvl})
        for g, val in (("acknowledge", bool(hit.get("acknowledge"))), ("isolate", bool(hit.get("isolate"))),
                       ("explore", _explored(hit)), ("gesture_match", hit.get("gesture_match") in ("yes", True))):
            if g in o and o[g] is not None:                    # null: the gesture does not apply to this nature
                gestures["gestures_out_of"] += 1
                ok = bool(o[g]) == val
                gestures["gestures"] += ok
                if not ok:
                    out["errors"].append({"kind": f"objection_{g}", "quote": o["quote"], "expected": o[g], "found": val})
    out["found"] = _pair(found, len(exp))
    out["nature"] = _pair(gestures["nature"], gestures["nature_out_of"])
    out["gestures"] = _pair(gestures["gestures"], gestures["gestures_out_of"])
    out["reaction"] = _pair(gestures["reaction"], gestures["reaction_out_of"])
    if (ref.get("complete") or {}).get("objections"):
        extra = [e for e in eps if e.get("id") not in used]
        out["extra"] = len(extra)
        out["extra_n"] = _pair(len(extra), len(eps))
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
            "drops": {k: (v or {}).get("reasons") for k, v in ((rec.get("meta") or {}).get("steps") or {}).items()},
            **parts, "errors": errors, "n_errors": len(errors)}


def share(p: Pair) -> Optional[float]:
    return round(p[0] / p[1], 3) if p and p[1] else None


def total(measures: list[dict]) -> dict:
    """The measures of several calls added up, as shares."""
    keys = [("status", "status"), ("status", "score"), ("phases", "anchors"), ("spin", "questions_found"),
            ("spin", "questions_to_review"), ("spin", "letters"), ("spin", "registers"), ("spin", "atoms_found"), ("spin", "atom_types"),
            ("gap", "verdict"), ("gap", "absence_reason"), ("gap", "components"), ("gap", "blocker_state"),
            ("gap", "stopping_question"), ("pitch", "verdict"),
            ("objections", "found"), ("objections", "nature"), ("objections", "gestures"), ("objections", "reaction"),
            ("spin", "questions_extra_n"), ("objections", "extra_n")]
    out = {}
    for a, b in keys:
        r = sum((m.get(a) or {}).get(b, [0, 0])[0] for m in measures)
        n = sum((m.get(a) or {}).get(b, [0, 0])[1] for m in measures)
        out[f"{a}.{b}"] = {"right": r, "out_of": n, "share": share([r, n])}
    out["errors"] = sum(m["n_errors"] for m in measures)
    return out


def costs(measures: list[dict], max_cost: Optional[float] = None) -> dict:
    """The cost of the analyses that carry one (`usd`, live mode): their number, the average and the maximum in USD,
    and whether the average is above `max_cost` (the measure then fails). Replay analyses carry no cost, and an analysis
    that asked the model nothing (a call excluded before any step, e.g. a cut recording) is left out: counted at 0 USD it
    would lower the average of the analyses that ran."""
    usd = [m["usd"] for m in measures if isinstance(m.get("usd"), (int, float)) and m["usd"] > 0]
    avg = round(sum(usd) / len(usd), 6) if usd else None
    return {"analyses": len(usd), "avg_usd": avg, "max_usd": round(max(usd), 6) if usd else None,
            "max_cost": max_cost, "exceeded": bool(usd and max_cost is not None and avg > max_cost)}


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
