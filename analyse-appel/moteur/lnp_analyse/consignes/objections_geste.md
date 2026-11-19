# Objections · quels gestes la réponse contient-elle ? (OB-16, OB-21)

La nature de la résistance est donnée (décidée par le code). Décris les tours de RÉPONSE du commercial (rôle SALES) dans
l'épisode, par des faits fermés seulement ; le code les compare à la nature.

- "answer_given" : le commercial répond par une information, une preuve ou un recadrage sur la résistance. Donne le
  premier passage de ce genre dans "answer_turn" / "answer_quote".
- "answer_tied_to_prospect" : cette réponse est liée à ce que le prospect a dit de la résistance (ses mots, sa raison,
  sa comparaison), pas à un discours tout fait.
- "support_or_framework" : la réponse décrit un soutien, un cadre, des étapes ou un accompagnement qui retirent le risque
  de ne pas y arriver (relecture par un mentor, un point chaque semaine, un accompagnement jusqu'au premier élève).
- "proof_reversibility_guarantee" : la réponse donne une preuve (les résultats de profs dans la même situation), une
  réversibilité (remboursement, acompte, essai) ou une garantie.
- "cost_of_inaction_question" : le commercial pose une question qui amène le prospect à dire ce que lui coûte de rester
  où il en est (« Si rien ne change, vous en êtes où dans un an ? », « qu'est-ce que vous regretteriez le plus ? »).
- "cost_stated_by_prospect" : le prospect répond à cette question en disant ce coût avec ses propres mots ; donne-le dans
  "prospect_cost_turn" / "prospect_cost_quote" (tour PROSPECT ou OTHER).
- "mindset_reframe" : la réponse recadre la croyance (« tout le monde ressent ça avant de se lancer », « quelle voix
  faut-il écouter ? ») sans décrire de soutien, de cadre ni de preuve.
- "offer_argument" : la réponse argumente sur le prix, la valeur, le contenu ou les fonctionnalités de l'offre.
"gesture_turn" / "gesture_quote" : le passage qui montre le mieux le geste principal de la réponse.

JSON: {"answer_given": bool, "answer_turn": null, "answer_quote": null, "answer_tied_to_prospect": bool,
 "support_or_framework": bool, "proof_reversibility_guarantee": bool, "cost_of_inaction_question": bool,
 "cost_stated_by_prospect": bool, "prospect_cost_turn": null, "prospect_cost_quote": null,
 "mindset_reframe": bool, "offer_argument": bool, "gesture_turn": null, "gesture_quote": null}
