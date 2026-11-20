"""Turn the letters corrected by a person on the screen (crm_ca_corrections, 063) into reference answers for the
measure (call-analysis/qa/README.md). The corrections and the reference files hold personal data: they stay out of git.

    python3 call-analysis/qa/corrections_to_reference.py --corrections corrections.json --refs DIR [--split tuning]

corrections.json: the rows of this query (read with the service role, never in a log):
    select c.call_id, c.unit_id, c.value, c.engine_value, c.note, c.created_at, s->>'quote' as quote
      from crm_ca_corrections c
      join crm_ca_results x on x.job_id = c.job_id and x.competence = 'SPIN'
      cross join lateral jsonb_array_elements(x.details->'solicitations') s
     where s->>'id' = c.unit_id and c.field = 'letter'
     order by c.created_at;
For each call, the newest correction of a question wins. A question already in the reference file (same words) takes
the corrected letter; a new one is added. A call with no reference file gets one (`split` given, `source`
"corrections"); its transcript must be in the cases folder for the measure to run on it.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from callqa_qa.reference import same_words  # noqa: E402


def merge(ref: dict, rows: list[dict]) -> tuple[dict, int, int]:
    """Apply one call's corrections to its reference; returns (ref, changed, added)."""
    latest: dict[str, dict] = {}
    for r in sorted(rows, key=lambda r: r.get("created_at") or ""):
        latest[r["unit_id"]] = r
    qs = ref.setdefault("questions", [])
    changed = added = 0
    for r in latest.values():
        if not r.get("quote"):
            continue
        q = next((q for q in qs if same_words(q.get("quote") or "", r["quote"])), None)
        if q is None:
            qs.append({"quote": r["quote"], "letter": r["value"], "note": f"corrigé à l'écran ({r.get('note') or 'sans note'})"})
            added += 1
        elif q.get("letter") != r["value"]:
            q["letter"] = r["value"]
            q["note"] = (q.get("note", "") + f" Corrigé à l'écran : {r.get('engine_value')} → {r['value']}.").strip()
            changed += 1
    return ref, changed, added


def main(argv=None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--corrections", required=True)
    ap.add_argument("--refs", required=True)
    ap.add_argument("--split", choices=["tuning", "control"], default="tuning")
    a = ap.parse_args(argv)
    rows = json.loads(Path(a.corrections).read_text(encoding="utf-8"))
    by_call: dict[str, list] = {}
    for r in rows:
        by_call.setdefault(str(r["call_id"]), []).append(r)
    refs = {json.loads(p.read_text(encoding="utf-8")).get("call_id"): p for p in Path(a.refs).glob("*.json")}
    for call_id, rs in by_call.items():
        p = refs.get(call_id) or Path(a.refs) / f"{call_id}.json"
        ref = json.loads(p.read_text(encoding="utf-8")) if p.exists() else \
            {"call_id": call_id, "slug": call_id[:8], "split": a.split, "source": "corrections", "questions": []}
        ref, changed, added = merge(ref, rs)
        p.write_text(json.dumps(ref, ensure_ascii=False, indent=1), encoding="utf-8")
        print(f"{ref.get('slug')}: {changed} letters corrected, {added} questions added")     # numbers only
    return 0


if __name__ == "__main__":
    sys.exit(main())
