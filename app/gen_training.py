"""Entraînement, its own group of the sidebar (Romain 2026-11-06): Découverte, Maîtrise de l'offre, Mes résultats and, for
admins, Suivi des commerciaux. Each is its own document in a frame that fills the screen (app/training/*.html, injected by
build.py).

Découverte (Romain 2026-11-05): « Entraînement discovery », the discovery training of the sales reps (the
cahier « Prompt Entraînement discovery »): « Le coup suivant » (100 cases, coup_lnp.json) and « La lettre imposée » (20 cases,
lettre_lnp.json). The app is its own document (app/training/entrainement.html, the cases injected by build.py), shown in a
frame that fills the screen ([data-training], like the CRM); no top bar and no « i » button, as Ma journée. The Page method
stays in the page for the Claude connector (web/kb/build_kb.mjs), with no button to open it."""
from shell import write_screen, info_popup


def fr(html):
    for en, f in (('>Page method<', ">Mode d'emploi<"), ('>Got it<', '>Compris<'), ('aria-label="Close"', 'aria-label="Fermer"'),
                  ('"How this page works"', '"Mode d\'emploi de la page"')):
        html = html.replace(en, f)
    return html


MAIN = ('<main style="flex-grow: 1; min-width: 0; box-sizing: border-box; padding: 24px 32px 0; display: flex; flex-direction: column; position: relative">\n'
        '<div data-training="1" style="width: 100%; height: 720px; border-radius: 14px"></div>\n</main>')
INFO = info_popup('Découverte', [
    ('À quoi sert cette page', 'p', "L'entraînement à la découverte des commerciaux de LNP (questions SPIN), sur des extraits d'appels R1. "
     "« Le coup suivant » : 100 cas, choisir le geste que la conversation appelle (L1 Situation, L2 Problème, L3 Impact, L4 Vision), "
     "écrire la question exacte, la comparer à l'étalon et la juger. « La lettre imposée » : 20 cas, trois questions d'implication "
     "d'affilée (le coût direct, l'effet en chaîne, ce que ça lui fait), le prospect répond après chacune."),
    ('Ce que vous y gagnez', 'ul', [
        "<strong>Le bon geste au bon moment.</strong> Chaque coup se joue sur un vrai moment d'appel : ni le cran d'avant, ni celui d'après.",
        "<strong>Des questions qui passent les règles.</strong> Ouverte, sans « ou », sans « pourquoi », une seule question, 18 mots au plus : vérifié pendant que vous écrivez.",
        "<strong>Un bilan qui dit où vous vous trompez.</strong> La matrice des confusions de geste, le maillon le plus faible de la chaîne, la règle la plus souvent enfreinte."]),
    ('Comment l\'utiliser', 'ol', [
        "Choisissez l'entraînement en haut : « Le coup suivant » ou « La lettre imposée ». Chacun garde sa séance en cours.",
        "« Nouvelle séance » règle le nombre de coups ou de cas, le geste, le registre et les cas (tous, jamais joués, mes erreurs).",
        "Clavier : 1 à 4 pour choisir un geste, Entrée pour valider, Ctrl ou ⌘ + Entrée pour comparer, O et N pour vos deux jugements.",
        "Chaque coup et chaque cas terminés sont enregistrés sur votre compte (Entraînement › Mes résultats) et ne peuvent pas être effacés."])
])
write_screen('Entrainement.dc.html', 'Découverte', MAIN, fr(INFO), 'roadmap2_logic.js', info=False)


def frame_main(attr):
    return MAIN.replace('data-training="1"', f'{attr}="1"')


# Maîtrise de l'offre (Romain 2026-11-06): « Académie sales LNP », the cahier « Prompt de reconstruction » and its 100 cases
# (app/training/academie.html, the content of academie_contenu.json as it is)
INFO_A = info_popup("Maîtrise de l'offre", [
    ('À quoi sert cette page', 'p', "L'entraînement des commerciaux de LNP à l'offre : 100 cas tirés de vrais appels (la garantie, "
     "les tarifs, le financement, le contenu de l'accompagnement…). Format A : répondre au prospect comme en visio, en 90 secondes. "
     "Format B : relire un extrait d'appel et dire ce qui ne va pas, puis ce qu'il fallait dire."),
    ('Ce que vous y gagnez', 'ul', [
        "<strong>Des réponses justes sur l'offre.</strong> Chaque cas a sa grille de correction, ses formulations éliminatoires et un corrigé.",
        "<strong>Une auto-correction honnête.</strong> Vous validez d'abord votre réponse, elle est figée ; puis vous la comparez à la grille du formateur et au corrigé, et vous cochez ce qu'elle contient vraiment.",
        "<strong>Une progression qui vous suit.</strong> Validé à 8/10 ; la meilleure note de chaque cas est gardée sur votre compte."]),
    ("Comment l'utiliser", 'ol', [
        "Choisissez un cas avec ← et →, la grille des 100 cas ou « Prochain à faire ».",
        "Écrivez votre réponse, puis « Valider ma réponse ». Le chrono de 90 secondes est facultatif.",
        "Auto-correction : votre réponse validée est affichée à côté de la grille ; l'onglet Corrigé montre aussi la réponse modèle. Cochez ce que votre réponse contient, puis « Enregistrer ma note ».",
        "Lisez le résultat critère par critère, puis le corrigé. La fiche mémo résume l'offre en une page.",
        "Chaque note est enregistrée sur votre compte (Entraînement › Mes résultats) et ne peut pas être effacée."])
])
write_screen('Academie.dc.html', "Maîtrise de l'offre", frame_main('data-academie'), fr(INFO_A), 'roadmap2_logic.js', info=False)

INFO_R = info_popup('Mes résultats', [
    ('À quoi sert cette page', 'p', "Vos résultats d'entraînement, enregistrés sur votre compte : chaque coup du « Coup suivant », "
     "chaque cas de « La lettre imposée » et chaque note de « Maîtrise de l'offre », avec la note, le temps passé et le détail. "
     "Ils ne peuvent pas être effacés : ils montrent ce que vous avez travaillé."),
    ('Le score, sur 100', 'ul', [
        "<strong>Le coup suivant :</strong> les coups justes parmi vos 50 derniers coups, sur 50.",
        "<strong>La lettre imposée :</strong> les questions valides parmi vos 20 derniers cas, sur 60.",
        "<strong>Maîtrise de l'offre :</strong> la somme de vos meilleures notes sur les 100 cas, sur 1 000.",
        "Le score est la moyenne des trois : un entraînement jamais fait compte 0."]),
    ("Comment l'utiliser", 'ol', [
        "Choisissez la période en haut : 7 jours, 30 jours, 90 jours ou depuis le début. Le score, lui, compte depuis le début.",
        "Le temps compté est le temps actif : une page laissée ouverte sans rien faire ne compte plus après deux minutes.",
        "Cliquez sur une ligne de l'historique pour revoir vos questions et vos réponses."])
])
write_screen('Resultats.dc.html', 'Mes résultats', frame_main('data-resultats'), fr(INFO_R), 'roadmap2_logic.js', info=False)

INFO_S = info_popup('Suivi des commerciaux', [
    ('À quoi sert cette page', 'p', "Pour les administrateurs : le suivi de l'entraînement de chaque commercial, mis en face de ses "
     "ventes. Une ligne par personne : son score d'entraînement, les exercices faits, le temps passé, la date du dernier entraînement, "
     "puis ses appels réalisés, ses ventes, le chiffre d'affaires signé, l'encaissé et le chiffre d'affaires par appel."),
    ('Ce que disent les chiffres', 'ul', [
        "<strong>Score :</strong> sur 100, depuis le début (le même que dans Mes résultats).",
        "<strong>Exercices, temps, réussite :</strong> sur la période choisie ; le temps est le temps actif.",
        "<strong>Appels réalisés :</strong> les appels tenus (R1, R2…) des prospects de la personne.",
        "<strong>CA signé :</strong> le prix des ventes conclues sur la période ; <strong>encaissé :</strong> ce que ces ventes ont rapporté à ce jour."]),
    ("Comment l'utiliser", 'ol', [
        "Choisissez la période en haut. Cliquez sur un titre de colonne pour trier.",
        "Cliquez sur une personne pour voir son score détaillé, son temps par jour et l'historique de ses exercices.",
        "Les résultats ne peuvent être ni modifiés ni effacés, par personne."])
])
write_screen('SuiviCommerciaux.dc.html', 'Suivi des commerciaux', frame_main('data-suivi'), fr(INFO_S), 'roadmap2_logic.js', info=False)
