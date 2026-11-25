"""Mes résultats and Entraînement de l'équipe know Reformulation de l'écart (module « ecart », 2026-11-25).

The two documents of these screens live in app/lnp.html (LNP_RESULTATS_DOC, LNP_SUIVI_DOC), edited there since the
interface passes (CLAUDE.md, 2026-11-10); app/training/resultats.html is their older source. This script makes the same
small changes in the three, and can be run again (it changes nothing the second time).
"""
import json, pathlib, re

HERE = pathlib.Path(__file__).resolve().parent
PAGE, SRC = HERE / "lnp.html", HERE / "training" / "resultats.html"
NAME = "Reformulation de l’écart"

PATCHES = [
    ('academie: "Maîtrise de l’offre" };', 'academie: "Maîtrise de l’offre", ecart: "' + NAME + '" };'),
    ('  function caseTxt(r) {\n', '  function caseTxt(r) {\n    if (r.module === "ecart") return (r.details && r.details.titre) || "Appel " + r.case_id;\n'),
    ('["coup", "lettre", "academie"].map(function (k) { var x = m[k]', '["coup", "lettre", "academie", "ecart"].map(function (k) { var x = m[k]'),
    ('    } else {\n      out.push("<div>Format "',
     '    } else if (r.module === "ecart") {\n'
     '      var EL = { A: "Point A", B: "Point B", P: "Blocage", C: "Coût", V: "Validation" }, ST = { ok: "ses mots", mid: "en partie", ko: "manqué" };\n'
     '      out.push("<div>" + (d.present ? "Écart présent" : "Écart absent") + " · " + Object.keys(EL).map(function (k) { return EL[k] + " : " + (ST[(d.composantes || {})[k]] || "–"); }).join(" · ") + (d.penalite ? " · pénalité −" + num1(d.penalite) : "") + "</div>");\n'
     '      if (d.texte) out.push("<div>Reformulation : « " + esc(d.texte) + " »</div>");\n'
     '    } else {\n      out.push("<div>Format "'),
    ('    ["academie", "Maîtrise de l’offre", function (p) { return (p.academie || {}).validated || 0; }],\n',
     '    ["academie", "Maîtrise de l’offre", function (p) { return (p.academie || {}).validated || 0; }],\n'
     '    ["ecart", "' + NAME + '", function (p) { return m(p, "ecart").n || 0; }],\n'),
]


def patch(doc, where):
    for a, z in PATCHES:
        if z in doc:
            continue
        assert a in doc, (where, a[:70])
        doc = doc.replace(a, z, 1)
    return doc


src = SRC.read_text(encoding="utf-8")
new = patch(src, "resultats.html")
if new != src:
    SRC.write_text(new, encoding="utf-8")
page = PAGE.read_text(encoding="utf-8")
before = page
for key in ("RESULTATS", "SUIVI"):
    m = re.search(r'<script>window\.LNP_' + key + r'_DOC = (".*?");</script>\n', page, re.S)
    assert m, key
    doc = patch(json.loads(m.group(1)), key)
    page = page[:m.start(1)] + json.dumps(doc).replace("</", "<\\/") + page[m.end(1):]
if page != before:
    PAGE.write_text(page, encoding="utf-8")
print("resultats:", "updated" if new != src else "unchanged", "· page:", "updated" if page != before else "unchanged")
