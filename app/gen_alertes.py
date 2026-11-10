"""Ventes › Alertes (Romain 2026-11-09): the alerts of the CRM. The page holds a [data-alertes] slot; build.py mounts the
LNP_ALERTS module (alerts_module.js) in it. The alerts are opened and closed by the server (sla-tick, migration 053); a sales rep
sees the alerts of their own leads, an admin those of the whole team. Everything shown is in French."""
from shell import write_screen, info_popup


def fr(html):
    """The shared popup frame and the "i" button of shell.py, in French."""
    for en, f in (('>Page method<', ">Mode d'emploi<"), ('>Got it<', '>Compris<'), ('aria-label="Close"', 'aria-label="Fermer"'),
                  ('"How this page works"', '"Mode d\'emploi de la page"')):
        html = html.replace(en, f)
    return html


MAIN = ('<main style="flex-grow: 1; min-width: 0; box-sizing: border-box; padding: 40px 96px 48px 48px; display: flex; flex-direction: column; gap: 28px; position: relative">\n'
        + '<div data-alertes="1" style="width: 100%"></div>\n</main>')
INFO = info_popup('Alertes', [
    ('À quoi sert cette page', 'p', "Les alertes du cycle de vente, dans le CRM : chaque fois qu'un prospect attend une action au-delà de "
     "l'objectif (un premier message, une issue à déclarer, un récap, une réponse…), une alerte s'ouvre ici pour le commercial du prospect. "
     "Un commercial voit les alertes de ses propres prospects ; un administrateur voit celles de toute l'équipe."),
    ('Ce que vous y gagnez', 'ul', [
        "<strong>Le CRM prévient.</strong> Personne n'a à surveiller les tableaux : la pastille rouge de la barre latérale compte vos alertes ouvertes, et un bandeau annonce chaque nouvelle alerte.",
        "<strong>Le plus urgent d'abord.</strong> Critique, puis En retard, puis Bientôt dû : vous savez par quoi commencer.",
        "<strong>Rien à cocher.</strong> Une alerte se ferme toute seule dès que l'action est faite (message WhatsApp envoyé, issue déclarée, paiement reçu), en 5 minutes au plus."]),
    ('Comment l\'utiliser', 'ol', [
        "Ouvrez Alertes dès que la pastille s'allume, et commencez par les critiques.",
        "<em>Ouvrir la fiche</em> ouvre le prospect dans le CRM : menez l'action demandée (le SLA, depuis quand, l'objectif sont écrits sur la ligne).",
        "Administrateurs : choisissez un commercial pour suivre ses alertes, ou Toute l'équipe. Les alertes techniques (intégrations, données) ne vont qu'aux administrateurs.",
        "<em>Être prévenu des alertes critiques</em> autorise une notification du navigateur tant que LNP est ouvert.",
        "Les seuils et les SLA suivis se règlent dans Paramètres › Alertes."])
])
write_screen('Alertes.dc.html', 'Alertes', MAIN, fr(INFO), 'info_logic.js')
