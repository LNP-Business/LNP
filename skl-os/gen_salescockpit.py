"""Sales System › Cockpit: the Cockpit's Sales view on a screen of its own (Romain, 2026-10-25: "the same window, unit
economics included"). The page holds the same [data-dash] slot as Cockpit › Sales; build.py mounts the same SKL_SALES
module (sales_v2.json) in whichever of the two slots is on screen, so both always show exactly the same thing."""
from shell import write_screen, info_popup, P
from gen_access import bar

MAIN = ('<main style="flex-grow: 1; min-width: 0; box-sizing: border-box; padding: 40px 48px 48px; display: flex; flex-direction: column; gap: 28px; position: relative">\n'
        # no context on the right: the module draws its own period switch and parity gate there, as under Cockpit › Sales
        # no view switch: the sidebar already lists Cockpit and CRM (Romain, 2026-10-25)
        + bar('', '')
        + '\n<div data-dash="1" style="width: 100%"></div>\n</main>')
INFO = info_popup('Cockpit commercial', [
    ('À quoi sert cette page', 'p', 'La vue commerciale de LNP sur un seul écran : comment les prospects deviennent des encaissements, ce que chaque appel '
     'et chaque vente coûte et rapporte, où en est chaque commercial, ce qui arrive dans les 30 prochains jours et quels encaissements sont à risque.'),
    ('Ce qu’elle apporte', 'ul', [
        '<strong>Du prospect à l’encaissement</strong> montre, étape par étape, où l’entonnoir perd des prospects, pour que l’équipe travaille d’abord l’étape la plus faible. Les <strong>appels honorés</strong> ne comptent que les R1 : le premier appel tenu de chaque prospect, jamais les R2 ni les R3.',
        '<strong>Rentabilité unitaire</strong> suit les 8 dernières semaines face à la référence (pointillés) : ce que rapporte un appel, le panier moyen et le taux de remboursement.',
        '<strong>Équipe commerciale</strong> classe les commerciaux par montant encaissé ; un clic ouvre leur pipeline dans le CRM.',
        '<strong>À venir</strong> et <strong>Encaissements à risque</strong> disent ce qu’il faut préparer et ce qu’il faut sécuriser ce mois-ci.',
        'Le <strong>contrôle de parité</strong> (en haut à droite) compare 6 critères à leur référence : VALIDÉ, ÉCHEC, ou EN ATTENTE tant qu’un critère n’est pas mesuré.']),
    ('Comment l’utiliser', 'ol', [
        'Choisissez la période en haut à droite (7 j, 30 j ou 8 sem.) : chaque chiffre est comparé à la période précédente de même durée.',
        'Lisez-la de haut en bas chaque lundi matin.',
        'Survolez un chiffre pour voir comment il est calculé ; cliquez sur un commercial pour ouvrir ses prospects dans le CRM.',
        'Ouvrez le CRM (dans le menu) pour agir sur un prospect : déclarer l’issue, relancer, ajouter une note.'])
])
# the popup frame of shell.py is shared with the LNP screens (still in English): this screen says it in French.
# Plain replaces, no assert: once shell.py speaks French they simply find nothing.
FR_FRAME = [('>Page method<', '>Mode d’emploi<'), ('>Got it<', '>Compris<'), ('aria-label="Close"', 'aria-label="Fermer"'),
            ('aria-label="How this page works" title="How this page works"', 'aria-label="Mode d’emploi de la page" title="Mode d’emploi de la page"')]
for a, z in FR_FRAME:
    INFO = INFO.replace(a, z)
write_screen('SalesCockpit.dc.html', 'Cockpit commercial', MAIN, INFO, 'roadmap2_logic.js')
f = P / 'SalesCockpit.dc.html'
t = f.read_text(encoding='utf-8')
for a, z in FR_FRAME:
    t = t.replace(a, z)
f.write_text(t, encoding='utf-8')
