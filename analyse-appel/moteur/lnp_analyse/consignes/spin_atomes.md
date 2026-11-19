Règles : méthodologie SPIN §4, annexe A, SB-9 à SB-15, SB-22 à SB-24. Liste les atomes que le PROSPECT a énoncés dans les
tours de réponse (et les tours spontanés) d'une sollicitation. Ne cite jamais le commercial ni le contexte précédent.

Types d'atomes : SITUATION (un fait neutre sur aujourd'hui), PAIN (quelque chose qui ne va pas, dans ses mots), BLOCKER (ce
qui empêche d'atteindre l'objectif), IMPACT (une conséquence du problème dans un autre domaine), DESIRE (un état futur
désiré), VALUE (pourquoi le résoudre compte, ce que ça changerait, ce qu'il ou elle en ferait).

- SB-9 : un atome = un passage continu de 2 à 40 mots dans un seul tour du prospect. La même chose dite deux fois avec des
  mots différents est un seul atome (garde le plus explicite). Deux conséquences différentes dans une phrase sont deux atomes.
- SB-10 : pour un IMPACT, donne `domain` (la conséquence) et `problem_domain` (le problème d'où elle vient), chacun parmi :
  money, time, clients, family, health, self_belief, future, other.
- SB-11 / SB-22 : `figure_kind` : "present" pour un chiffre qui décrit aujourd'hui (revenu, heures, clients), "loss" pour ce
  que le problème lui fait perdre, sinon null. `income_drop_attributed` : true seulement pour une baisse entre un revenu passé
  et un revenu actuel que le prospect attribue explicitement au problème.
- SB-13 : une phrase qui porte à la fois un état et la raison pour laquelle il compte donne un DESIRE et une VALUE.
- SB-14 : `prompted_by_sales` : true si le contenu a été énoncé d'abord par le commercial et que le prospect ne fait
  qu'approuver. Si le prospect approuve ET ajoute du contenu, ne cite que le contenu ajouté, avec prompted_by_sales false.
- SB-23 : `reported_speech` : des paroles attribuées à quelqu'un d'autre ; `owned` : le prospect les reprend à son compte, à
  la première personne, dans la même réponse.
- SB-24 : `quantified` : le passage contient un montant, un compte ou une durée. Une fréquence seule ou « beaucoup » n'en est
  pas un. `value` et `unit` quand c'est chiffré (le nombre tel qu'il est écrit dans la citation, le mot de l'unité).
- `object` : 3 à 6 mots qui nomment le problème auquel l'atome se rapporte. `dimension` (SITUATION et DESIRE seulement) :
  revenue, clients, time, career_status, other.
- `cause_quote` / `cause_turn` (PAIN ou BLOCKER seulement) : un passage exact et distinct où le prospect énonce sa cause.
- Une réponse qui ne fait qu'approuver ne produit aucun atome.

JSON : {"atoms": [{"type": "IMPACT", "turn": "T046", "quote": "...", "quantified": false, "value": null, "unit": null,
 "domain": "family", "problem_domain": "money", "figure_kind": null, "income_drop_attributed": false,
 "prompted_by_sales": false, "reported_speech": false, "owned": false, "object": "...", "dimension": null,
 "cause_quote": null, "cause_turn": null}]}
