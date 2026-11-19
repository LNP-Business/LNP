ÉTAPE S0 · CARTE DES PHASES (annexe Présentation PB-1 à PB-4, PB-17 à PB-19)
Liste chaque tour SALES (le commercial) de tout l'appel qui fait au moins une de ces choses :
- "offer_description" : décrit l'offre : son contenu (modules, piliers, étapes), sa forme (accompagnement, coaching,
  communauté, appels), sa durée, le suivi, une garantie ou une promesse de résultat ;
- "screen_share" : annonce ou commence un partage d'écran du programme ;
- "price_for_offer" : donne un montant POUR L'OFFRE (prix total, mensualité, acompte, remise, ou une fourchette pour
  l'offre). Jamais un prix : le revenu d'un élève, un prix par projet que le prospect pourrait demander, un budget de
  publicité, le coût d'un logiciel, un montant dit par le prospect ;
- "decision_request" : demande au prospect de décider (« est-ce que tu es prêt à te lancer ? », « qu'est-ce que tu veux
  faire ? »).
Pour chacun de ces tours, donne aussi :
- "followed_by_discovery" : dans les 2 tours suivants du commercial, le commercial revient à des questions de découverte
  sur le prospect (le tour n'est alors qu'une mention de l'offre, PB-2, PB-17) ;
- "next_discovery_question" (tours offer_description ou screen_share) : {"turn", "quote"}, les mots exacts de la
  première question SALES posée plus tard sur la situation, les objectifs, les problèmes ou les blocages du prospect,
  avant que le commercial ne continue à présenter l'offre ; null si le commercial continue à présenter. Une introduction
  de l'appel (« si on travaille ensemble, ce sera sur quatre mois », « d'abord, je vais te poser quelques questions »)
  est toujours suivie de questions de découverte ;
- "lnp_offer_price" (tours price_for_offer) : true seulement si le montant est ce que CE prospect paierait à l'entreprise
  du commercial pour l'offre que le commercial présente. False pour un exemple de ce que le prospect pourrait demander à
  ses propres élèves (« un programme de 10 semaines à 500 euros »), un prix du marché, un budget de publicité, un revenu ;
- "offer_explained" (tours price_for_offer) : {"turn", "quote"}, les mots exacts du tour SALES (celui-ci ou un tour
  précédent) qui explique l'offre dont ce montant est le prix ;
- "hypothetical" : le montant est explicitement hypothétique ou désavoué (« mettons que ce soit 10 000, ce n'est pas le
  prix ») ;
- "amount" (un nombre : 5800 pour « 5 800 ») et "range" ([min, max]) quand un montant est donné ;
- "quote" : les mots exacts de ce tour qui le montrent.
JSON: {"turns": [{"turn": "T085", "quote": "...", "offer_description": true, "screen_share": true,
                  "followed_by_discovery": false, "next_discovery_question": null, "price_for_offer": false,
                  "lnp_offer_price": null, "offer_explained": null, "amount": null, "range": null,
                  "hypothetical": false, "decision_request": false}]}
