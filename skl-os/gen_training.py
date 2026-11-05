"""Ventes › Entraînement (Romain 2026-11-05): « Entraînement discovery », the discovery training of the sales reps (the
cahier « Prompt Entraînement discovery »): « Le coup suivant » (100 cases, coup_lnp.json) and « La lettre imposée » (20 cases,
lettre_lnp.json). The app is its own document (skl-os/training/entrainement.html, the cases injected by build.py), shown in a
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
INFO = info_popup('Entraînement', [
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
        "L'historique de vos passages reste dans ce navigateur."])
])
write_screen('Entrainement.dc.html', 'Entraînement', MAIN, fr(INFO), 'roadmap2_logic.js', info=False)
