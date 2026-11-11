"""Entraînement › Simulateur (Romain 2026-11-11): the sales-call simulator, its own entry of the sidebar's Entraînement group.

While app/lnp.html is the reference page (CLAUDE.md, 2026-11-10: the interface is not yet carried back into the generators),
this script puts the Simulateur into the page itself, and can be run again (it changes nothing the second time, except the
document of the screen, refreshed from app/training/simulateur.html):
  1. the sidebar entry « Simulateur » under « Maîtrise de l'offre », in every screen's sidebar;
  2. the screen's template (tpl-simulateur, Simulateur.dc.html): its title, the slot of its frame, its « Mode d'emploi »;
  3. its logic (SCREENS["simulateur"]), its frame (LNP_SIMULATEUR_DOC, placed like Maîtrise de l'offre), its key in KEEP;
  4. the document of the screen: app/training/simulateur.html as window.LNP_SIMULATEUR_DOC (moved by web/build_web.py into the
     versioned documents file loaded once signed in, like the other frames).
Then: python3 web/build_web.py && node web/kb/build_kb.mjs.
"""
import json, pathlib, re, sys

HERE = pathlib.Path(__file__).resolve().parent
PAGE = HERE / "lnp.html"
DOC = HERE / "training" / "simulateur.html"

page = PAGE.read_text(encoding="utf-8")
before = page

LINK = ('<a href="Simulateur.dc.html" style="display: flex; align-items: center; gap: 10px; padding: 11px 14px; border-radius: 10px; '
        'text-decoration: none; font-size: 15px; color: #B6BBCA"><span>Simulateur</span></a>')
LINK_ON = ('<a href="Simulateur.dc.html" aria-current="page" style="display: flex; align-items: center; gap: 10px; padding: 11px 14px; '
           'border-radius: 10px; text-decoration: none; font-size: 15px; font-weight: 600; color: #5B8DF7; background: #1D2643; '
           'box-shadow: inset 3px 0 0 #5B8DF7"><span>Simulateur</span></a>')

# 1. the sidebar entry, right after « Maîtrise de l'offre », in every template that does not have it yet
ACAD = re.compile(r'(<a href="Academie\.dc\.html"[^>]*><span>Maîtrise de l\'offre</span></a>\n)(?!<a href="Simulateur\.dc\.html")')
page = ACAD.sub(lambda m: m.group(1) + LINK + "\n", page)

# 2. the screen's template, made from Maîtrise de l'offre's (same frame, same sidebar), after it
INFO = [
    ("À quoi sert cette page", "p",
     "L'entraînement à l'appel de vente avec un prospect joué par Claude, en texte ou à la voix. Le prospect a son histoire, ses "
     "douleurs, ses objections et sa personnalité ; il ne se livre que si vous gagnez sa confiance. Trois entraînements : l'appel "
     "complet, le diagnostic (la découverte et l'écart) et les objections (le prix est annoncé)."),
    ("Ce que vous y gagnez", "ul", [
        "<strong>Un prospect qui réagit comme un vrai.</strong> Une bonne question, une reformulation juste ou de l'empathie le font "
        "s'ouvrir ; un prix annoncé trop tôt, de la pression ou une suite de questions fermées le font se fermer.",
        "<strong>Trois difficultés.</strong> Moyen, Difficile, Expert : le prospect fait moins vite confiance et résiste plus longtemps "
        "à chaque objection.",
        "<strong>Une analyse de l'appel.</strong> En fin d'appel, une note sur 100 sur cinq dimensions (Connexion, Écoute, Exposition, "
        "Alignement, Résolution), chaque point avec la citation qui le prouve, votre point fort, votre point faible et un exercice.",
    ]),
    ("Comment l'utiliser", "ol", [
        "Choisissez l'entraînement, l'offre et le prospect, le texte ou la voix, puis « Lancer la simulation ».",
        "En texte : Entrée envoie, Maj + Entrée passe à la ligne, le micro dicte. À la voix : parlez, le prospect répond quand vous "
        "vous taisez ; vous pouvez lui couper la parole.",
        "La fiche du prospect est à gauche ; cochez les étapes de l'appel au fil de l'eau en haut. « Annuler le dernier échange » "
        "retire votre dernière réplique et sa réponse.",
        "« Terminer » : notez la simulation, répondez aux quatre questions de l'auto-analyse, puis lisez l'analyse. L'appel complet et "
        "le diagnostic sont analysés ; le mode objections ne l'est pas.",
        "« Historique » garde chaque simulation, sa transcription et son analyse. Les administrateurs gèrent les offres, les prospects "
        "et les réglages.",
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


if 'id="tpl-simulateur"' not in page:
    m = re.search(r'<template id="tpl-academie" data-file="Academie\.dc\.html">\n.*?\n</template>\n', page, re.S)
    assert m, "the template of Maîtrise de l'offre"
    t = m.group(0)
    t = t.replace('<template id="tpl-academie" data-file="Academie.dc.html">', '<template id="tpl-simulateur" data-file="Simulateur.dc.html">')
    # the current entry of the sidebar: Simulateur, not Maîtrise de l'offre
    t = re.sub(r'<a href="Academie\.dc\.html" aria-current="page" style="[^"]*"><span>Maîtrise de l\'offre</span></a>',
               '<a href="Academie.dc.html" style="display: flex; align-items: center; gap: 10px; padding: 11px 14px; border-radius: 10px; text-decoration: none; font-size: 15px; color: #B6BBCA"><span>Maîtrise de l\'offre</span></a>', t)
    t = t.replace(LINK, LINK_ON)
    t = t.replace('<h1 class="ph">Maîtrise de l’offre</h1>', '<h1 class="ph">Simulateur</h1>')
    t = t.replace('<div data-academie="1"', '<div data-simulateur="1"')
    t = re.sub(r'<sc-if value="\{\{info\}\}" hint-placeholder-val="\{\{false\}\}">.*?</sc-if>\n', info_html("Simulateur", INFO) + "\n", t, flags=re.S)
    assert 'data-simulateur="1"' in t and '<h1 class="ph">Simulateur</h1>' in t and 'aria-current="page"' in t
    page = page.replace(m.group(0), m.group(0) + t, 1)

# 3. the screen's logic, its frame, its key
if 'SCREENS["simulateur"]' not in page:
    i = page.index('SCREENS["resultats"] = (function () {')
    logic = ('SCREENS["simulateur"] = (function () {\nclass Component extends DCLogic {\n  constructor(props) {\n    super(props);\n'
             '    this.state = { info: false };\n  }\n  renderVals() {\n    return { info: !!this.state.info, openInfo: () => this.setState({ info: true }), '
             'closeInfo: () => this.setState({ info: false }) };\n  }\n}\nreturn Component;\n})();\n')
    page = page[:i] + logic + page[i:]
reps = [
    ('academie: "LNP_ACADEMIE_DOC", resultats:', 'academie: "LNP_ACADEMIE_DOC", simulateur: "LNP_SIMULATEUR_DOC", resultats:'),
    ('academie: "Maîtrise de l’offre", resultats:', 'academie: "Maîtrise de l’offre", simulateur: "Simulateur", resultats:'),
    ('"entrainement", "academie", "resultats"', '"entrainement", "academie", "simulateur", "resultats"'),
]
for a, z in reps:
    if z not in page:
        assert a in page, a
        page = page.replace(a, z)
PLACE = '    placeOne("academie", "[data-academie]", "#F7F8FB", true);\n'
PLACE_SIM = '    placeOne("simulateur", "[data-simulateur]", "#F7F8FB", true);\n'
if PLACE_SIM not in page:
    assert page.count(PLACE) == 2, "placeCrm and placeFrames"
    page = page.replace(PLACE, PLACE + PLACE_SIM)

# 4. the document of the screen (refreshed at every run)
if DOC.exists():
    doc = DOC.read_text(encoding="utf-8")
    line = "<script>window.LNP_SIMULATEUR_DOC = " + json.dumps(doc).replace("</", "<\\/") + ";</script>\n"
    old = re.search(r'<script>window\.LNP_SIMULATEUR_DOC = .*?;</script>\n', page, re.S)
    if old:
        page = page[:old.start()] + line + page[old.end():]
    else:
        m = re.search(r'<script>window\.LNP_ACADEMIE_DOC = .*?;</script>\n', page, re.S)
        assert m, "the document of Maîtrise de l'offre"
        page = page[:m.end()] + line + page[m.end():]
else:
    print("app/training/simulateur.html is missing: the screen has no document yet", file=sys.stderr)

if page != before:
    PAGE.write_text(page, encoding="utf-8")
print(PAGE, "updated" if page != before else "unchanged", page.count('href="Simulateur.dc.html"'), "sidebar entries")
