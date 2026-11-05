"""Sales System › Sales Day (Romain 2026-10-31): the sales rep's day, one lead at a time, like Execute in the Operating System.
The page holds a [data-salesday] slot; build.py mounts the SKL_SALESDAY module (salesday_module.js) in it.
LNP (Romain 2026-11-03): every text of the screen is in French ("Ma journée"; the Page method is the "Mode d'emploi")."""
from shell import write_screen, info_popup, INFO_BTN
from gen_access import bar, CTX


def fr(html):
    """The shared popup frame and the "i" button of shell.py, in French (no-op once shell.py is translated)."""
    for en, f in (('>Page method<', ">Mode d'emploi<"), ('>Got it<', '>Compris<'), ('aria-label="Close"', 'aria-label="Fermer"'),
                  ('"How this page works"', '"Mode d\'emploi de la page"')):
        html = html.replace(en, f)
    return html


MAIN = ('<main style="flex-grow: 1; min-width: 0; box-sizing: border-box; padding: 40px 48px 48px; display: flex; flex-direction: column; gap: 28px; position: relative">\n'
        + bar('', f'<span style="{CTX}; max-width: 560px">Un prospect à la fois : d\'abord les issues à déclarer, puis les appels, les replanifications et les relances.</span>')
        + '\n<div data-salesday="1" style="width: 100%"></div>\n</main>')
INFO = info_popup('Ma journée', [
    ('À quoi sert cette page', 'p', "La journée du commercial dans le CRM, un prospect à la fois : chaque prospect qui a besoin de vous aujourd'hui "
     "arrive sous forme de carte, dans l'ordre qui protège l'encaissé. D'abord les issues à déclarer (un appel est terminé et rien n'est déclaré), "
     "puis les appels du jour à préparer, les appels à replanifier (un R2 manqué, un appel annulé), les absents à relancer et les relances prévues."),
    ('Ce que vous y gagnez', 'ul', [
        "<strong>Rien ne passe entre les mailles.</strong> La file est construite à partir du CRM lui-même : un appel ne reste jamais sans issue et un prospect n'attend jamais sans relance.",
        "<strong>Une chose à la fois.</strong> Vous voyez un seul prospect, l'action à mener et ce qu'il vous faut pour la mener, rien d'autre.",
        "<strong>Le CRM reste juste.</strong> Une issue déclarée ici est la même que dans CRM › Cycle de vente ; « Fait » enregistre ce que vous avez fait en note sur le prospect."]),
    ('Comment l\'utiliser', 'ol', [
        "Commencez la journée ici. Choisissez Mes prospects (ou un commercial, pour les responsables).",
        "Chaque carte montre le cycle de vente du prospect jour par jour (filtres Tous, Appels, Messages, Paiements), le plus récent en vue : relisez-le avant d'agir.",
        "Pour une issue : indiquez si l'appel a été honoré, puis la décision (et le motif d'un non), puis <em>Déclarer et suivant</em>.",
        "Pour les autres cartes : menez l'action, écrivez en une ligne ce que vous avez fait, puis <em>Fait</em> ou faites glisser la carte vers la droite.",
        "<em>Demain</em> met un prospect de côté pour aujourd'hui, <em>Passer</em> l'envoie en fin de file ; <em>À suivre</em> vous permet de choisir un autre prospect d'abord.",
        "Votre liste du jour (fait, mis de côté) n'est conservée que pour vous."])
])
write_screen('SalesDay.dc.html', 'Ma journée', MAIN, fr(INFO) + '\n' + fr(INFO_BTN), 'roadmap2_logic.js', info=False)
