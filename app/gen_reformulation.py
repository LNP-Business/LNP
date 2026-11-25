"""Entraînement › Reformulation de l'écart (Romain 2026-11-25): its own entry of the sidebar's Entraînement group.

While app/lnp.html is the reference page (CLAUDE.md, 2026-11-10: the interface is not yet carried back into the generators),
this script puts the training into the page itself, and can be run again (it changes nothing the second time, except the
document of the screen, refreshed from app/training/reformulation.html and app/training/ecart_cas.json):
  1. the sidebar entry « Reformulation de l'écart » right after « Découverte », in every screen's sidebar;
  2. the screen's template (tpl-reformulation, Reformulation.dc.html), made from the Simulateur's: title, frame slot, « Mode d'emploi »;
  3. its logic (SCREENS["reformulation"]), its frame (LNP_REFORMULATION_DOC, placed like the other trainings), its key in KEEP;
  4. the document: app/training/reformulation.html with the cases (ecart_cas.json) and the results queue (results_log.js)
     put in, as window.LNP_REFORMULATION_DOC (moved by web/build_web.py into the versioned documents file).
Then: python3 web/build_web.py && node web/kb/build_kb.mjs.
"""
import json, pathlib, re

HERE = pathlib.Path(__file__).resolve().parent
PAGE = HERE / "lnp.html"
DOC = HERE / "training" / "reformulation.html"
CAS = HERE / "training" / "ecart_cas.json"
RES = HERE / "training" / "results_log.js"
LABEL = "Reformulation de l’écart"

page = PAGE.read_text(encoding="utf-8")
before = page

STYLE = ('display: flex; align-items: center; gap: 10px; padding: 11px 14px; border-radius: 10px; text-decoration: none; '
         'font-size: 15px; color: #B6BBCA')
STYLE_ON = ('display: flex; align-items: center; gap: 10px; padding: 11px 14px; border-radius: 10px; text-decoration: none; '
            'font-size: 15px; font-weight: 600; color: #5B8DF7; background: #1D2643; box-shadow: inset 3px 0 0 #5B8DF7')
LINK = '<a href="Reformulation.dc.html" style="' + STYLE + '"><span>' + LABEL + '</span></a>'
LINK_ON = '<a href="Reformulation.dc.html" aria-current="page" style="' + STYLE_ON + '"><span>' + LABEL + '</span></a>'

# 1. the sidebar entry, right after « Découverte », in every template that does not have it yet
DECOUV = re.compile(r'(<a href="Entrainement\.dc\.html"[^>]*><span>Découverte</span></a>\n)(?!<a href="Reformulation\.dc\.html")')
page = DECOUV.sub(lambda m: m.group(1) + LINK + "\n", page)

# 2. the screen's template, made from the Simulateur's (same frame, same sidebar), after it
INFO = [
    ("À quoi sert cette page", "p",
     "L'entraînement à la reformulation de l'écart, le moment où, à la fin de la découverte, vous redites au prospect où il en "
     "est, où il veut aller, ce qui le bloque et ce que ça lui coûte, avec ses mots, et où il le valide. Six appels inventés, "
     "corrigés avec la méthode de l'écart de l'analyse d'appel."),
    ("Ce que vous y gagnez", "ul", [
        "<strong>Écouter comme en appel.</strong> L'appel se lit une seule fois, une réplique après l'autre, sans retour en "
        "arrière : vous retenez ses mots exacts en prenant des notes, comme pendant un vrai appel.",
        "<strong>La bonne formule.</strong> Le bon point A (sur la dimension de B, jamais un chiffre sans rapport), la cible la "
        "plus récente, un seul blocage (celui nommé à la question du blocage) et le coût qui va avec.",
        "<strong>Une correction immédiate.</strong> Une note sur 10, chaque élément repris ou non avec ses mots, les pièges "
        "évités ou non (les mots du commercial, un chiffre calculé, l'offre citée), puis la reformulation parfaite.",
    ]),
    ("Comment l'utiliser", "ol", [
        "Choisissez un appel en haut, puis « Commencer la lecture ».",
        "Lisez chaque réplique et notez à droite ses mots exacts ; Espace ou Entrée passe à la réplique suivante.",
        "À la fin, l'appel disparaît : écrivez votre reformulation, comme vous la diriez au prospect, puis « Corriger ».",
        "Lisez la correction : votre note, chaque élément, la reformulation parfaite ; « Relire l'appel » montre où étaient ses "
        "mots. « Refaire cet appel » recommence la lecture depuis le début.",
        "Chaque correction est enregistrée dans « Mes résultats ».",
    ]),
]


def info_html(title, sections):
    num = ('<span style="width: 28px; height: 28px; border-radius: 50%; background: #1E2A5E; color: #FFFFFF; font-size: 13px; '
           'display: inline-flex; align-items: center; justify-content: center">{n}</span>')
    out = ['<sc-if value="{{info}}" hint-placeholder-val="{{false}}">',
           '<div data-overlay="info" style="position: fixed; inset: 0; background: rgba(30,42,94,0.55); display: flex; justify-content: center; align-items: flex-start; padding-top: 32px; overflow: auto; z-index: 50">',
           '<div role="dialog" aria-modal="true" aria-labelledby="info-title" style="width: 820px; max-width: calc(100% - 48px); box-sizing: border-box; background: #FFFFFF; border-radius: 16px; padding: 28px 36px; display: flex; flex-direction: column; gap: 20px; box-shadow: 0 24px 64px rgba(0,0,0,0.28)">',
           '<div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 20px">',
           '<div><div style="font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; color: #5A6478">Mode d\'emploi</div>'
           '<h2 id="info-title" style="margin: 6px 0 0; font-family: Poppins, Arial, sans-serif; font-size: 32px; font-weight: 500">' + title + '</h2></div>',
           '<button type="button" onClick="{{closeInfo}}" aria-label="Fermer" style="width: 44px; height: 44px; flex-shrink: 0; border-radius: 50%; border: 1px solid #AECBF2; background: #FFFFFF; color: #1E2A5E; font: inherit; font-size: 22px; line-height: 1; cursor: pointer">×</button>',
           '</div>']
    for i, (h, kind, body) in enumerate(sections, 1):
        out.append('<section>')
        out.append('<h3 style="margin: 0 0 10px; display: flex; align-items: center; gap: 10px; font-size: 17px; font-weight: 600">' + num.format(n=i) + h + '</h3>')
        if kind == "p":
            out.append('<p style="margin: 0; font-size: 15px; line-height: 1.6; color: #222C4E">' + body + '</p>')
        else:
            st = ('margin: 0; padding-left: ' + ('20px' if kind == 'ul' else '22px') +
                  '; display: flex; flex-direction: column; gap: 8px; font-size: 15px; line-height: 1.55; color: #222C4E')
            out.append('<' + kind + ' style="' + st + '">')
            out.extend('<li>' + x + '</li>' for x in body)
            out.append('</' + kind + '>')
        out.append('</section>')
    out += ['<button type="button" onClick="{{closeInfo}}" style="align-self: flex-end; min-height: 44px; padding: 0 22px; border: 0; border-radius: 10px; background: #1E2A5E; color: #FFFFFF; font: inherit; font-size: 15px; font-weight: 600; cursor: pointer">Compris</button>',
            '</div>', '</div>', '</sc-if>']
    return "\n".join(out)


if 'id="tpl-reformulation"' not in page:
    m = re.search(r'<template id="tpl-simulateur" data-file="Simulateur\.dc\.html">\n.*?\n</template>\n', page, re.S)
    assert m, "the template of the Simulateur"
    t = m.group(0)
    t = t.replace('<template id="tpl-simulateur" data-file="Simulateur.dc.html">',
                  '<template id="tpl-reformulation" data-file="Reformulation.dc.html">')
    # the current entry of the sidebar: this one, not the Simulateur
    t = re.sub(r'<a href="Simulateur\.dc\.html" aria-current="page" style="[^"]*"><span>Simulateur</span></a>',
               '<a href="Simulateur.dc.html" style="' + STYLE + '"><span>Simulateur</span></a>', t)
    t = t.replace(LINK, LINK_ON)
    t = t.replace('<h1 class="ph">Simulateur</h1>', '<h1 class="ph">' + LABEL + '</h1>')
    t = t.replace('<div data-simulateur="1"', '<div data-reformulation="1"')
    t = re.sub(r'<sc-if value="\{\{info\}\}" hint-placeholder-val="\{\{false\}\}">.*?</sc-if>\n', lambda _: info_html(LABEL, INFO) + "\n", t, flags=re.S)
    assert 'data-reformulation="1"' in t and '<h1 class="ph">' + LABEL + '</h1>' in t and LINK_ON in t
    page = page.replace(m.group(0), m.group(0) + t, 1)

# 3. the screen's logic, its frame, its key
if 'SCREENS["reformulation"]' not in page:
    i = page.index('SCREENS["resultats"] = (function () {')
    logic = ('SCREENS["reformulation"] = (function () {\nclass Component extends DCLogic {\n  constructor(props) {\n    super(props);\n'
             '    this.state = { info: false };\n  }\n  renderVals() {\n    return { info: !!this.state.info, openInfo: () => this.setState({ info: true }), '
             'closeInfo: () => this.setState({ info: false }) };\n  }\n}\nreturn Component;\n})();\n')
    page = page[:i] + logic + page[i:]
reps = [
    ('simulateur: "LNP_SIMULATEUR_DOC", resultats:', 'simulateur: "LNP_SIMULATEUR_DOC", reformulation: "LNP_REFORMULATION_DOC", resultats:'),
    ('simulateur: "Simulateur", resultats:', 'simulateur: "Simulateur", reformulation: "' + LABEL + '", resultats:'),
    ('"academie", "simulateur", "resultats"', '"academie", "simulateur", "reformulation", "resultats"'),
]
for a, z in reps:
    if z not in page:
        assert a in page, a
        page = page.replace(a, z)
PLACE = '    placeOne("simulateur", "[data-simulateur]", "#F7F8FB", true);\n'
PLACE_REF = '    placeOne("reformulation", "[data-reformulation]", "#F7F8FB", true);\n'
if PLACE_REF not in page:
    assert page.count(PLACE) == 2, "placeCrm and placeFrames"
    page = page.replace(PLACE, PLACE + PLACE_REF)

# 4. the document of the screen (refreshed at every run): the cases and the results queue put in
doc = DOC.read_text(encoding="utf-8")
cas = json.dumps(json.loads(CAS.read_text(encoding="utf-8")), ensure_ascii=False)
doc = doc.replace("/*@CAS@*/null", cas.replace("</", "<\\/")).replace("/*@RESULTS@*/", RES.read_text(encoding="utf-8"))
assert "/*@CAS@*/" not in doc and "/*@RESULTS@*/" not in doc
line = "<script>window.LNP_REFORMULATION_DOC = " + json.dumps(doc).replace("</", "<\\/") + ";</script>\n"
old = re.search(r'<script>window\.LNP_REFORMULATION_DOC = .*?;</script>\n', page, re.S)
if old:
    page = page[:old.start()] + line + page[old.end():]
else:
    m = re.search(r'<script>window\.LNP_SIMULATEUR_DOC = .*?;</script>\n', page, re.S)
    assert m, "the document of the Simulateur"
    page = page[:m.end()] + line + page[m.end():]

if page != before:
    PAGE.write_text(page, encoding="utf-8")
print(PAGE, "updated" if page != before else "unchanged", page.count('href="Reformulation.dc.html"'), "sidebar entries")
