"""Les mémos LNP de l'analyse d'appel : chaque `memo_*.body.html` (corps du mémo, en français) est mis dans la page commune
(`memo.css`, en-tête, pied de page) et imprimé en PDF A4 avec Chromium (`print_pdf.js`).

    python3 call-analysis/docs/memos/src/build_memos.py            # tous les mémos → call-analysis/docs/memos/*.pdf
    python3 call-analysis/docs/memos/src/build_memos.py memo_1      # un seul

Le corps commence par un commentaire `<!-- META {...} -->` (JSON) : num, fichier, titre, phrase, version, base, date.
La méthode (`call-analysis/docs/methodology/`) fait foi ; un mémo l'explique en clair et ne la contredit jamais.
"""
import html
import json
import re
import subprocess
import sys
from pathlib import Path

SRC = Path(__file__).resolve().parent
OUT = SRC.parent


def page(body: str) -> tuple[dict, str]:
    m = re.search(r"<!--\s*META\s*(\{.*?\})\s*-->", body, re.S)
    if not m:
        raise SystemExit("META manquant")
    meta = json.loads(m.group(1))
    css = (SRC / "memo.css").read_text(encoding="utf-8")
    e = html.escape
    head = (f'<header class="cover"><div class="kicker">LNP · Les Nouveaux Profs · {e(meta["kicker"])}</div>'
            f'<h1>{e(meta["titre"])}</h1><p class="phrase">{e(meta["phrase"])}</p>'
            f'<dl class="meta"><dt>Version</dt><dd>{e(meta["version"])}</dd><dt>Fondé sur</dt><dd>{e(meta["base"])}</dd>'
            f'<dt>Statut</dt><dd>Source de vérité lisible : en cas de doute, la méthode du dépôt fait foi.</dd></dl></header>')
    doc = (f'<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>{e(meta["titre"])}</title>'
           f"<style>{css}</style></head><body>{head}<main>{body[m.end():]}</main></body></html>")
    return meta, doc


def main(only: list[str]) -> None:
    for f in sorted(SRC.glob("memo_*.body.html")):
        if only and not any(f.name.startswith(o) for o in only):
            continue
        meta, doc = page(f.read_text(encoding="utf-8"))
        tmp = SRC / (f.name.replace(".body.html", ".html"))
        tmp.write_text(doc, encoding="utf-8")
        pdf = OUT / meta["fichier"]
        subprocess.run(["node", str(SRC / "print_pdf.js"), str(tmp), str(pdf), meta["titre"]], check=True)
        tmp.unlink()
        print(pdf.relative_to(OUT.parent.parent.parent))


if __name__ == "__main__":
    main(sys.argv[1:])
