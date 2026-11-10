"""Sales System › Cockpit: the Cockpit's Sales view on a screen of its own (Romain, 2026-10-25: "the same window, unit
economics included"). The page holds the same [data-dash] slot as Cockpit › Sales; build.py mounts the same SKL_SALES
module (sales_v2.json) in whichever of the two slots is on screen, so both always show exactly the same thing.
Tabs (Romain 2026-11-09, as in SKL OS): Résultats (the SKL_SALES module) and Exécution, Qualité, Impact (the SKL_SALESEXEC module,
sales_exec_module.js, one slot whose data-view is the tab; figures from crm_sales_execution, web/supabase/050_crm_sales_execution.sql).
The tab is kept in salescockpit_logic.js."""
from shell import write_screen, info_popup, P
from gen_access import bar

TABS = ''.join(f'<button type="button" onClick="{{{{go{k}}}}}" aria-pressed="{{{{on{k}}}}}" style="{{{{tab{k}}}}}">{l}</button>'
               for k, l in (('Results', 'Résultats'), ('Exec', 'Exécution'), ('Qual', 'Qualité'), ('Impact', 'Impact')))
SEG = 'display: flex; gap: 6px; padding: 5px; background: #ECE8DF; border-radius: 12px; align-self: flex-start; flex-shrink: 0'
MAIN = ('<main style="flex-grow: 1; min-width: 0; box-sizing: border-box; padding: 40px 48px 48px; display: flex; flex-direction: column; gap: 28px; position: relative">\n'
        # the module draws its own period switch and parity gate on the right, as under Cockpit › Sales
        + bar(f'<div role="group" aria-label="Vues" style="{SEG}">{TABS}</div>', '')
        + '\n<sc-if value="{{isResults}}" hint-placeholder-val="{{true}}"><div data-dash="1" style="width: 100%"></div></sc-if>'
        + '\n<sc-if value="{{isExec}}" hint-placeholder-val="{{false}}"><div data-salesexec="1" data-view="{{view}}" style="width: 100%"></div></sc-if>\n</main>')
INFO = info_popup('Cockpit commercial', [
    ('À quoi sert cette page', 'p', 'La vue commerciale de LNP sur un seul écran : comment les prospects deviennent des encaissements, ce que chaque appel '
     'et chaque vente coûte et rapporte, où en est chaque commercial, ce qui arrive dans les 30 prochains jours et quels encaissements sont à risque.'),
    ('Ce qu’elle apporte', 'ul', [
        '<strong>Du prospect à l’encaissement</strong> montre, étape par étape, où l’entonnoir perd des prospects, pour que l’équipe travaille d’abord l’étape la plus faible. Les <strong>appels honorés</strong> ne comptent que les R1 : les prospects venus à leur R1, jamais les R2 ni les R3. Le <strong>taux de présence</strong> compare ces prospects à ceux dont le R1 était prévu ; un R1 sans issue déclarée reste en attente pendant 48 h, puis compte comme absence. Les fiches de test de l’équipe ne comptent pas. Sous le flux, le <strong>CA signé</strong> (prix de l’offre), le <strong>CA collecté</strong> à ce jour et le <strong>reste à collecter</strong> des ventes de la période ; l’échéancier se déduit du montant saisi dans iClosed (par exemple 850 € = 1re de 4 échéances) tant qu’il n’est pas fixé dans la fiche prospect.',
        '<strong>Rentabilité unitaire</strong> suit les 8 dernières semaines face à la référence (pointillés) : ce que rapporte un appel, le panier moyen et le taux de remboursement.',
        '<strong>Équipe commerciale</strong> classe les commerciaux par montant encaissé ; un clic ouvre leur pipeline dans le CRM.',
        '<strong>À venir</strong> et <strong>Encaissements à risque</strong> disent ce qu’il faut préparer et ce qu’il faut sécuriser ce mois-ci.',
        'Le <strong>contrôle de parité</strong> (en haut à droite) compare 6 critères à leur référence : VALIDÉ, ÉCHEC, ou EN ATTENTE tant qu’un critère n’est pas mesuré.',
        '<strong>Exécution</strong> mesure chaque étape du cycle de vente face à sa cible (les SLA de Paramètres › Alertes) : la part faite dans les temps, le délai médian, la relance des absents et des ventes manquées, et le lien entre les interactions et la vente. Un clic sur une étape explique son fonctionnement et la bonne pratique.',
        '<strong>Qualité</strong> réunit l’analyse d’appel, la qualification porte par porte (Métier, Financement, Décision et timing), les motifs de perte et la fiabilité des données.',
        '<strong>Impact</strong> compare le taux de vente quand une étape est faite dans les temps et quand elle est manquée : où mettre l’effort de l’équipe. C’est une corrélation, pas une preuve.']),
    ('Comment l’utiliser', 'ol', [
        'Choisissez la période en haut à droite (7 j, 30 j ou 8 sem.) : chaque chiffre est comparé à la période précédente de même durée.',
        'Lisez-la de haut en bas chaque lundi matin.',
        'Survolez un chiffre pour voir comment il est calculé ; cliquez sur un commercial pour ouvrir ses prospects dans le CRM.',
        'Dans Exécution, Qualité et Impact, choisissez la période (7, 30, 90 ou 180 jours) et, en administrateur, un commercial. Un prospect est gagné quand son premier paiement arrive dans les 14 jours après son premier appel tenu ; un taux sur moins de 20 prospects est marqué indicatif.',
        'Ouvrez le CRM (dans le menu) pour agir sur un prospect : déclarer l’issue, relancer, ajouter une note.'])
])
# the popup frame of shell.py is shared with the LNP screens (still in English): this screen says it in French.
# Plain replaces, no assert: once shell.py speaks French they simply find nothing.
FR_FRAME = [('>Page method<', '>Mode d’emploi<'), ('>Got it<', '>Compris<'), ('aria-label="Close"', 'aria-label="Fermer"'),
            ('aria-label="How this page works" title="How this page works"', 'aria-label="Mode d’emploi de la page" title="Mode d’emploi de la page"')]
for a, z in FR_FRAME:
    INFO = INFO.replace(a, z)
write_screen('SalesCockpit.dc.html', 'Cockpit commercial', MAIN, INFO, 'salescockpit_logic.js')
f = P / 'SalesCockpit.dc.html'
t = f.read_text(encoding='utf-8')
for a, z in FR_FRAME:
    t = t.replace(a, z)
f.write_text(t, encoding='utf-8')
