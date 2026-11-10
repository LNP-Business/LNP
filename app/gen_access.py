"""Settings › Access: which screens each person can open. Admins only, web edition only.
Settings › Account (below): who you are, sign-in and sign-out, and Team access for admins.
The screen is a frame; web/public/lnp-web.js fills [data-access] for admins. In a claude.ai Artifact the
entry is hidden (no admin session), and the frame explains where access is managed.
LNP is in French (Romain 2026-11-03): every text of both frames."""
import json, pathlib
from shell import write_screen, info_popup, CARD, H2

# same top bar as harmonize.py (not imported: importing it would re-run its page rewrites)
SEG = 'display: flex; gap: 6px; padding: 5px; background: #ECE8DF; border-radius: 12px; align-self: flex-start; flex-shrink: 0'
TAB = 'display: inline-flex; align-items: center; gap: 8px; min-height: 44px; padding: 0 20px; border: 0; border-radius: 9px; font: inherit; font-size: 15px; cursor: pointer; text-decoration: none; white-space: nowrap; '
TAB_ON = TAB + 'background: #1B1B18; color: #FFFFFF; font-weight: 600'
TAB_OFF = TAB + 'background: transparent; color: #3D3A33; font-weight: 500'
BAR = 'display: flex; align-items: center; gap: 14px; min-height: 54px; padding-right: 72px'
CTX = 'font-size: 13px; line-height: 1.4; color: #5E5B53; text-align: right; min-width: 0'
def bar(left, right):
    return f'<header data-topbar style="{BAR}">{left}<span style="flex: 1"></span>{right}</header>'
def seg(items):
    adm = lambda h: ' data-admin-only' if h == 'Access.dc.html' else ''
    out = [f'<span style="{TAB_ON}" aria-current="page">{l}</span>' if h is None else f'<a href="{h}"{adm(h)} style="{TAB_OFF}">{l}</a>' for l, h in items]
    return f'<div role="group" aria-label="Views" style="{SEG}">' + ''.join(out) + '</div>'
# the Settings views, as in harmonize.py: an edition (edition.json "settings") keeps only its own Settings screens
_ed = pathlib.Path(__file__).resolve().parent.parent / 'edition.json'
_keep = json.load(open(_ed, encoding='utf-8')).get('settings') if _ed.exists() else None
SETTINGS_TABS = [('Alertes et notifications', 'Settings.dc.html'), ('Registres', 'Registers.dc.html'), ('Compte', 'Account.dc.html'), ('Accès', 'Access.dc.html')]
def settings_seg(current):
    return seg([(l, None if f == current else f) for l, f in SETTINGS_TABS if not _keep or f in _keep or f == current])

MAIN = ('<main style="flex-grow: 1; min-width: 0; box-sizing: border-box; padding: 40px 48px 48px; display: flex; flex-direction: column; gap: 28px; position: relative">\n'
        + bar(settings_seg('Access.dc.html'),
              f'<span style="{CTX}; max-width: 520px">Choisissez les écrans que chaque personne peut ouvrir.</span>')
        + f'\n<div data-access><section style="{CARD}; padding: 28px; display: flex; flex-direction: column; gap: 8px">'
          f'<h2 style="{H2}">Les accès se gèrent dans la version web</h2>'
          '<p style="margin: 0; font-size: 15px; line-height: 1.6; color: #5E5B53">Connectez-vous à LNP sur le web avec un compte administrateur pour choisir les écrans que chaque personne peut ouvrir.</p>'
          '</section></div>\n</main>')
INFO = info_popup('Accès', [
    ('À quoi sert cette page', 'p', 'Décider quels écrans chaque personne peut ouvrir, par espace (Ventes, Paramètres) ou écran par écran. Seuls les administrateurs voient cette page.'),
    ('En quoi elle aide', 'ul', [
        'Chacun reste concentré : fermez un espace à quelqu’un qui n’en a pas besoin.',
        'Ouvrez un espace entier en un clic, ou seulement certains de ses écrans.']),
    ('Comment l’utiliser', 'ol', [
        'Chaque personne a une carte avec ses espaces, par exemple Ventes et Paramètres.',
        'Décochez un espace pour fermer tous ses écrans, ou décochez les écrans un par un. Les changements sont enregistrés aussitôt.',
        'La personne voit le changement la prochaine fois qu’elle ouvre ou recharge LNP. Un espace fermé disparaît de son menu.',
        'Tout le monde, nouveaux venus compris, commence avec tout ouvert. <strong>Tout ouvrir</strong> ramène une personne à cet état.',
        'Les administrateurs peuvent aussi être restreints mais gardent toujours cette page ; personne ne change ses propres accès. Fermer un écran le cache, pas ses données.'])
])
write_screen('Access.dc.html', 'Access', MAIN, INFO, 'roadmap2_logic.js')


# ---- Settings › Account: who uses LNP here, sign-in and sign-out, Team access (Romain, 2026-10-26: out of the sidebar)
# [data-account] is filled by web/public/lnp-web.js in the web edition (signed-in person, Sign out, Team access for admins).
AMAIN = ('<main style="flex-grow: 1; min-width: 0; box-sizing: border-box; padding: 40px 48px 48px; display: flex; flex-direction: column; gap: 28px; position: relative">\n'
         + bar(settings_seg('Account.dc.html'),
               f'<span style="{CTX}; max-width: 520px">Votre compte, comment se déconnecter, et qui fait partie de l’équipe.</span>')
         + f'\n<div data-account style="display: flex; flex-direction: column; gap: 28px; max-width: 980px"><section style="{CARD}; padding: 28px; display: flex; flex-direction: column; gap: 8px">'
           f'<h2 style="{H2}">Connexion et équipe</h2>'
           '<p style="margin: 0; font-size: 15px; line-height: 1.6; color: #5E5B53">Dans la version web de LNP, c’est ici que vous voyez le compte avec lequel vous êtes connecté, que vous vous déconnectez et, si vous êtes administrateur, que vous invitez l’équipe et choisissez les rôles.</p>'
           '</section></div>\n</main>')
AINFO = info_popup('Compte', [
    ('À quoi sert cette page', 'p', 'Le compte connecté et l’équipe.'),
    ('En quoi elle aide', 'ul', [
        'Le menu ne garde que les écrans ; votre compte et l’équipe sont réunis au même endroit.',
        'Les administrateurs invitent des personnes et choisissent leur rôle sans quitter les Paramètres.']),
    ('Comment l’utiliser', 'ol', [
        'Dans la version web, <strong>Se déconnecter</strong> met fin à votre session sur ce navigateur.',
        'Administrateurs : <strong>Accès de l’équipe</strong> invite quelqu’un (envoyez-lui le lien obtenu), change un rôle, donne un lien de réinitialisation ou retire une personne. Les écrans que chacun peut ouvrir se règlent dans l’onglet Accès.',
        'Administrateurs : la colonne <strong>WhatsApp Business</strong> garde le numéro de chaque commercial et de chaque setter, avec l’indicatif (+33…). C’est ce numéro qui rattache ses messages WhatsApp aux prospects et aux alertes.'])
])
write_screen('Account.dc.html', 'Account', AMAIN, AINFO, 'roadmap2_logic.js')
