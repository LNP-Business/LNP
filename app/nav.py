"""La barre latérale de chaque écran de LNP : le logo, les groupes Ventes et Entraînement, les Paramètres tout en bas."""
import pathlib, re, json, base64

P = pathlib.Path(__file__).resolve().parent.parent / "gabarits"

SYSTEMS = {"ss": ("Ventes", "SS", "SalesCockpit.dc.html")}
GROUPS = {
    "ss": [("Sales System", [("SalesCockpit.dc.html", "Cockpit commercial", None), ("CRM.dc.html", "CRM", None), ("SalesDay.dc.html", "Ma journée", None),
                             ("Alertes.dc.html", "Alertes", (0, "Alertes ouvertes", "alertes"))]),
           # Entraînement, its own group (Romain 2026-11-06)
           ("Training", [("Entrainement.dc.html", "Découverte", None), ("Academie.dc.html", "Maîtrise de l'offre", None),
                         ("Resultats.dc.html", "Mes résultats", None), ("SuiviCommerciaux.dc.html", "Suivi des commerciaux", None)])],
    "settings": [("Settings", [("Settings.dc.html", "Alertes", None), ("Account.dc.html", "Compte", None), ("Access.dc.html", "Accès", None)])],
}
# the group titles shown, in French; the fold keys (data-navgrp, also read by web/public/lnp-web.js) keep the English names
GROUP_LABEL = {"Sales System": "Ventes", "Training": "Entraînement", "Settings": "Paramètres"}
# edition.json at the repository root: the name, the logo and the Settings screens listed
EDITION = {}
_ed = pathlib.Path(__file__).resolve().parent.parent / "edition.json"
if _ed.exists():
    EDITION = json.load(open(_ed, encoding="utf-8"))
    if EDITION.get("settings"):
        GROUPS["settings"] = [(g, [it for it in items if it[0] in EDITION["settings"]]) for g, items in GROUPS["settings"]]
SCREENS = {
    "SalesCockpit.dc.html": "ss", "SalesDay.dc.html": "ss", "Alertes.dc.html": "ss", "CRM.dc.html": "ss", "Entrainement.dc.html": "ss", "Academie.dc.html": "ss",
    "Resultats.dc.html": "ss", "SuiviCommerciaux.dc.html": "ss",
    "Settings.dc.html": "settings", "Account.dc.html": "settings", "Access.dc.html": "settings",
}

ADMIN_ONLY = {"Access.dc.html", "SuiviCommerciaux.dc.html"}  # shown only to admins of the web edition (html.lnp-admin)
ITEM = 'display: flex; align-items: center; gap: 10px; padding: 11px 14px; border-radius: 10px; text-decoration: none; font-size: 15px; '
SEG = 'display: block; padding: 7px 12px; border-radius: 9px; text-decoration: none; text-align: left; font-size: 13px; line-height: 1.3; '
GEAR = ('<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
        '<circle cx="12" cy="12" r="3"></circle>'
        '<path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"></path></svg>')


def nav(file):
    area = SCREENS[file]
    brand = EDITION.get("brand", ["LNP", None])  # LNP: its own name in the sidebar
    short = "Ventes"
    head = f'<div style="font-family: Fraunces, Georgia, serif; font-size: 28px; font-weight: 600; color: #F6F4EF; padding: 0 12px 18px">{brand[0]} <span style="color: #D9B46A">{brand[1] or short}</span></div>'
    if EDITION.get("wordmark"):  # LNP (2026-11-03): the logo of Les Nouveaux Profs, its pastille and its name, as on its site
        w1, w2, w3 = EDITION["wordmark"]
        logo = _ed.parent / EDITION.get("logo", "")
        img = (f'<img src="data:image/png;base64,{base64.b64encode(logo.read_bytes()).decode()}" alt="" width="38" height="38" '
               'style="width: 38px; height: 38px; border-radius: 10px; flex: none; display: block">') if EDITION.get("logo") and logo.is_file() else ""
        head = ('<div style="display: flex; align-items: center; gap: 11px; padding: 0 8px 20px">' + img
                + '<div style="font-family: Poppins, Arial, sans-serif; font-weight: 700; font-size: 13px; letter-spacing: .09em; '
                f'text-transform: uppercase; line-height: 1.2; color: #F7F8FB">{w1}<span style="color: #5B8DF7">{w2}</span>{w3}'
                f'<div style="font-size: 10.5px; letter-spacing: .16em; font-weight: 600; color: #AECBF2; margin-top: 3px">{brand[1] or short}</div></div></div>')
    out = [
        '<nav aria-label="Main navigation" style="width: 232px; flex-shrink: 0; box-sizing: border-box; background: #1B1B18; padding: 28px 16px 20px; display: flex; flex-direction: column; gap: 4px">',
        head,
        '<div role="group" aria-label="Switch system" style="display: grid; grid-template-columns: minmax(0, 1fr); gap: 2px; padding: 4px; background: #2C2B26; border-radius: 12px; margin-bottom: 18px">',
    ]
    for sid, (sname, _, home) in (SYSTEMS.items() if len(SYSTEMS) > 1 else []):
        on = sid == area
        style = SEG + ('background: #F6F4EF; color: #1B1B18; font-weight: 600;' if on else 'background: transparent; color: #C9C4B7; font-weight: 500;')
        cur = ' aria-current="true"' if on else ''
        out.append(f'<a href="{home}"{cur} style="{style}">{sname}</a>')
    out.append('</div>')
    if len(SYSTEMS) < 2:
        del out[-2:]  # one system only (edition.json): no system switch
    # one system only (edition.json, LNP): no system switch, so the Settings screens also list that system's groups, to go
    # back to the Cockpit commercial, Ma journée or the CRM (Romain 2026-11-03)
    groups = [(area, g) for g in GROUPS[area]]
    if area == "settings" and len(SYSTEMS) < 2:
        groups = [(sid, g) for sid in SYSTEMS for g in GROUPS[sid]] + groups
    for gi, (garea, (gname, items)) in enumerate(groups):
        mt = 'margin-top: 10px; ' if gi else ''
        key = garea + '-' + re.sub(r'[^a-z0-9]+', '-', gname.lower()).strip('-')
        out.append(f'<button type="button" data-navgrp="{key}" aria-expanded="true" title="Replier ou déplier {GROUP_LABEL.get(gname, gname)}" style="{mt}display: flex; align-items: center; justify-content: space-between; gap: 8px; width: 100%; padding: 6px 14px; border: 0; border-radius: 8px; background: transparent; font: inherit; font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; color: #8E8A80; cursor: pointer; text-align: left">'
                   f'<span>{GROUP_LABEL.get(gname, gname)}</span><svg data-chev width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" style="flex-shrink: 0; transition: transform .15s"><path d="M3 4.5 6 7.5 9 4.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"></path></svg></button>')
        out.append(f'<div data-navitems="{key}" style="display: flex; flex-direction: column; gap: 4px">')
        for href, label, badge in items:
            on = href == file
            style = ITEM + ('font-weight: 600; color: #D9B46A; background: #34322C; box-shadow: inset 3px 0 0 #D9B46A' if on else 'color: #C9C4B7')
            cur = ' aria-current="page"' if on else ''
            b = ''
            if badge:
                n, tip, key = badge
                dk = f' data-badge="{key}"' if key else ''
                b = (f'<span{dk} title="{tip}" style="margin-left: auto; min-width: 22px; padding: 1px 7px; box-sizing: border-box; border-radius: 999px; '
                     f'background: #B42318; color: #FFFFFF; font-size: 12px; font-weight: 600; text-align: center">{n}</span>')
            adm = ' data-admin-only' if href in ADMIN_ONLY else ''
            out.append(f'<a href="{href}"{cur}{adm} style="{style}"><span>{label}</span>{b}</a>')
        out.append('</div>')
    out.append('<div style="flex-grow: 1"></div>')
    on = area == "settings"
    style = ('display: flex; align-items: center; gap: 10px; padding: 12px 14px; margin-top: 6px; border-radius: 10px; text-decoration: none; font-size: 15px; '
             + ('font-weight: 600; color: #D9B46A; background: #34322C; box-shadow: inset 3px 0 0 #D9B46A' if on else 'color: #C9C4B7; border: 1px solid #34322C'))
    cur = ' aria-current="true"' if on else ''
    out.append(f'<a href="Settings.dc.html"{cur} style="{style}">{GEAR}Paramètres</a>')
    out.append('</nav>')
    return '\n'.join(out)


for file in SCREENS:
    f = P / file
    if not f.exists():
        continue
    s = f.read_text(encoding='utf-8')
    m = re.search(r'<nav aria-label="Main navigation".*?</nav>', s, flags=re.S)
    assert m, file
    s = s[:m.start()] + nav(file) + s[m.end():]
    f.write_text(s, encoding='utf-8')
    print('nav updated:', file)
