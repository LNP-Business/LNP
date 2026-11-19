"""Agrégation par période (partie C, C5 et C6) : fenêtres, note moyenne, intervalles, écart à la période précédente,
niveaux, règle du plancher."""
from __future__ import annotations

import math
from datetime import date, datetime, timedelta
from statistics import mean, stdev
from typing import Optional
from zoneinfo import ZoneInfo

# Quantiles t(0,975, ddl) de la loi de Student pour ddl = 1 à 30, puis approximation par la loi normale
_T975 = [12.706, 4.303, 3.182, 2.776, 2.571, 2.447, 2.365, 2.306, 2.262, 2.228, 2.201, 2.179, 2.160, 2.145,
         2.131, 2.120, 2.110, 2.101, 2.093, 2.086, 2.080, 2.074, 2.069, 2.064, 2.060, 2.056, 2.052, 2.048,
         2.045, 2.042]


def t975(df: int) -> float:
    return _T975[df - 1] if 1 <= df <= 30 else 1.96 + 2.4 / df


def jour_local(debut_utc: str, tz: str) -> date:
    dt = datetime.fromisoformat(debut_utc.replace("Z", "+00:00"))
    return dt.astimezone(ZoneInfo(tz)).date()


def bornes_fenetre(genre: str, aujourdhui: date) -> tuple[Optional[date], Optional[date], Optional[date], Optional[date]]:
    """Rend (début, fin_incluse, début_comparaison, fin_comparaison_incluse)."""
    if genre == "7d":
        s = aujourdhui - timedelta(days=6)
        return s, aujourdhui, s - timedelta(days=7), s - timedelta(days=1)
    if genre == "month":
        s = aujourdhui.replace(day=1)
        fin_mp = s - timedelta(days=1)
        debut_mp = fin_mp.replace(day=1)
        fin_cmp = debut_mp.replace(day=min(aujourdhui.day, fin_mp.day))
        return s, aujourdhui, debut_mp, fin_cmp
    return None, None, None, None


def wilson(k: int, n: int, z: float = 1.96) -> tuple[float, float]:
    if n == 0:
        return (0.0, 0.0)
    p = k / n
    d = 1 + z * z / n
    c = (p + z * z / (2 * n)) / d
    h = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d
    return (max(0.0, c - h), min(1.0, c + h))


def niveau(note: float) -> str:
    return "Mastered" if note >= 85 else "Developing" if note >= 60 else "Needs work"


def periode(resultats: list[dict], competence: str, genre: str, aujourdhui: date, tz: str) -> dict:
    """resultats : [{"start_utc", "status", "score", "items": [{"id","level"}], ...}] pour un commercial et une compétence."""
    s, e, cs, ce = bornes_fenetre(genre, aujourdhui)

    def dans_fen(r, a, b):
        if a is None:
            return True
        d = jour_local(r["start_utc"], tz)
        return a <= d <= b

    cour = [r for r in resultats if dans_fen(r, s, e)]
    note_ = [r for r in cour if r["status"] == "scored" and r.get("score") is not None]
    sortie = {"competence": competence, "window": genre, "n_calls": len(cour), "n_scored": len(note_),
           "status_counts": {k: sum(r["status"] == k for r in cour) for k in {r["status"] for r in cour}}}
    n = len(note_)
    if n < 5:
        sortie.update(score=round(mean([r["score"] for r in note_]), 1) if note_ else None,
                   label=f"insufficient volume ({n} calls)", level=None)
        return sortie
    xs = [r["score"] for r in note_]
    m = mean(xs)
    moitie = t975(n - 1) * stdev(xs) / math.sqrt(n)
    sortie.update(score=round(m, 1), ci=(max(0, round(m - moitie, 1)), min(100, round(m + moitie, 1))),
               ci_display="always" if n < 20 else "hover")
    # taux par item et règle du plancher
    ids = sorted({i["id"] for r in note_ for i in r["items"]})
    taux_ = {}
    for iid in ids:
        lv = [i["level"] for r in note_ for i in r["items"] if i["id"] == iid and i["level"] is not None]
        k2 = sum(v == 2 for v in lv)
        taux_[iid] = {"n": len(lv), "level2_rate": round(k2 / len(lv), 3) if lv else None,
                      "level1plus_rate": round(sum(v >= 1 for v in lv) / len(lv), 3) if lv else None,
                      "level2_ci": wilson(k2, len(lv))}
    sortie["items"] = taux_
    niv = niveau(m)
    if niv == "Mastered" and any(v["level2_rate"] is not None and v["level2_rate"] < 0.25 for v in taux_.values()):
        niv = "Developing"
        sortie["floor_rule"] = True
    sortie["level"] = niv
    # écart à la période de comparaison
    if cs is not None:
        prec = [r["score"] for r in resultats if dans_fen(r, cs, ce) and r["status"] == "scored" and r.get("score") is not None]
        if len(prec) >= 5:
            d = m - mean(prec)
            sortie["delta"] = round(d, 1)
            sortie["delta_label"] = "stable" if abs(d) < moitie else ("up" if d > 0 else "down")
    return sortie


def goulot(periodes: list[dict]) -> Optional[str]:
    """Note de période la plus basse parmi les compétences qui ont au moins 5 appels évaluables ; à égalité : le taux de
    niveau 2 le plus bas."""
    ok = [p for p in periodes if p.get("n_scored", 0) >= 5 and p.get("score") is not None]
    if not ok:
        return None
    def k(p):
        taux_min = min((v["level2_rate"] for v in p.get("items", {}).values() if v["level2_rate"] is not None), default=1)
        return (p["score"], taux_min)
    return min(ok, key=k)["competence"]
