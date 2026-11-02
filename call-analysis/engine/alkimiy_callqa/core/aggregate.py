"""Period aggregation (Part C, C5 and C6): windows, mean score, intervals, delta, levels, floor rule."""
from __future__ import annotations

import math
from datetime import date, datetime, timedelta
from statistics import mean, stdev
from typing import Optional
from zoneinfo import ZoneInfo

# Student t quantiles t(0.975, df) for df = 1..30, then normal approximation
_T975 = [12.706, 4.303, 3.182, 2.776, 2.571, 2.447, 2.365, 2.306, 2.262, 2.228, 2.201, 2.179, 2.160, 2.145,
         2.131, 2.120, 2.110, 2.101, 2.093, 2.086, 2.080, 2.074, 2.069, 2.064, 2.060, 2.056, 2.052, 2.048,
         2.045, 2.042]


def t975(df: int) -> float:
    return _T975[df - 1] if 1 <= df <= 30 else 1.96 + 2.4 / df


def local_day(start_utc: str, tz: str) -> date:
    dt = datetime.fromisoformat(start_utc.replace("Z", "+00:00"))
    return dt.astimezone(ZoneInfo(tz)).date()


def window_bounds(kind: str, today: date) -> tuple[Optional[date], Optional[date], Optional[date], Optional[date]]:
    """Returns (start, end_inclusive, cmp_start, cmp_end_inclusive)."""
    if kind == "7d":
        s = today - timedelta(days=6)
        return s, today, s - timedelta(days=7), s - timedelta(days=1)
    if kind == "month":
        s = today.replace(day=1)
        pm_end = s - timedelta(days=1)
        pm_start = pm_end.replace(day=1)
        cmp_end = pm_start.replace(day=min(today.day, pm_end.day))
        return s, today, pm_start, cmp_end
    return None, None, None, None


def wilson(k: int, n: int, z: float = 1.96) -> tuple[float, float]:
    if n == 0:
        return (0.0, 0.0)
    p = k / n
    d = 1 + z * z / n
    c = (p + z * z / (2 * n)) / d
    h = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d
    return (max(0.0, c - h), min(1.0, c + h))


def level(score: float) -> str:
    return "Mastered" if score >= 85 else "Developing" if score >= 60 else "Needs work"


def period(results: list[dict], competence: str, kind: str, today: date, tz: str) -> dict:
    """results: [{"start_utc", "status", "score", "items": [{"id","level"}], ...}] for one sales, one competence."""
    s, e, cs, ce = window_bounds(kind, today)

    def inwin(r, a, b):
        if a is None:
            return True
        d = local_day(r["start_utc"], tz)
        return a <= d <= b

    cur = [r for r in results if inwin(r, s, e)]
    scored = [r for r in cur if r["status"] == "scored" and r.get("score") is not None]
    out = {"competence": competence, "window": kind, "n_calls": len(cur), "n_scored": len(scored),
           "status_counts": {k: sum(r["status"] == k for r in cur) for k in {r["status"] for r in cur}}}
    n = len(scored)
    if n < 5:
        out.update(score=round(mean([r["score"] for r in scored]), 1) if scored else None,
                   label=f"insufficient volume ({n} calls)", level=None)
        return out
    xs = [r["score"] for r in scored]
    m = mean(xs)
    half = t975(n - 1) * stdev(xs) / math.sqrt(n)
    out.update(score=round(m, 1), ci=(max(0, round(m - half, 1)), min(100, round(m + half, 1))),
               ci_display="always" if n < 20 else "hover")
    # item rates and floor rule
    ids = sorted({i["id"] for r in scored for i in r["items"]})
    rates = {}
    for iid in ids:
        lv = [i["level"] for r in scored for i in r["items"] if i["id"] == iid and i["level"] is not None]
        k2 = sum(v == 2 for v in lv)
        rates[iid] = {"n": len(lv), "level2_rate": round(k2 / len(lv), 3) if lv else None,
                      "level1plus_rate": round(sum(v >= 1 for v in lv) / len(lv), 3) if lv else None,
                      "level2_ci": wilson(k2, len(lv))}
    out["items"] = rates
    lvl = level(m)
    if lvl == "Mastered" and any(v["level2_rate"] is not None and v["level2_rate"] < 0.25 for v in rates.values()):
        lvl = "Developing"
        out["floor_rule"] = True
    out["level"] = lvl
    # delta
    if cs is not None:
        prev = [r["score"] for r in results if inwin(r, cs, ce) and r["status"] == "scored" and r.get("score") is not None]
        if len(prev) >= 5:
            d = m - mean(prev)
            out["delta"] = round(d, 1)
            out["delta_label"] = "stable" if abs(d) < half else ("up" if d > 0 else "down")
    return out


def bottleneck(periods: list[dict]) -> Optional[str]:
    """Lowest period score among competences with >= 5 evaluable calls; ties: lowest level-2 rate."""
    ok = [p for p in periods if p.get("n_scored", 0) >= 5 and p.get("score") is not None]
    if not ok:
        return None
    def k(p):
        min_rate = min((v["level2_rate"] for v in p.get("items", {}).values() if v["level2_rate"] is not None), default=1)
        return (p["score"], min_rate)
    return min(ok, key=k)["competence"]
