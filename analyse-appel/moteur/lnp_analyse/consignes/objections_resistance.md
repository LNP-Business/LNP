# Objections · ce passage est-il une résistance, et quel est le sujet du doute ? (OB-2, OB-3, OB-4, OB-24, OB-25, OB-26)

Tu lis UN tour cible (TOUR CIBLE, avec quelques tours de contexte) et tu décris les doutes qu'il exprime. Tu ne décides
pas la nature : tu nommes le sujet de chaque doute dans la liste fermée ; le code applique les tests de frontière dans
l'ordre.

Étape 1 · exclusions (OB-2). Mets dans "exclusion" :
- "information_request" : une question pour s'informer (« ça dure combien de temps ? », « on peut payer en plusieurs
  fois ? ») sans réserve exprimée dans le même tour ;
- "external_deadline" : un délai avec une raison externe et vérifiable (« je déménage en janvier », « mes allocations
  chômage s'arrêtent en mars ») ;
- "circuit_fact" : un fait du circuit de décision dit de façon neutre (« c'est mon mari qui gère nos finances »). Ce
  n'est PAS un fait du circuit quand il est avancé comme une raison de ne pas décider maintenant (« il faut d'abord que
  j'en parle à mon mari ») ;
- "conditional_acceptance" : « si je peux payer tous les mois, alors oui » (un critère de décision) ;
- "none" : aucun de ces cas.
« Je vais réfléchir » avec une raison se décrit par sa raison (« il faut que je regarde mes comptes » = l'argent) ; sans
raison, c'est un report.

Étape 2 · doutes. Pour chaque doute distinct du tour, donne sa citation exacte et son ou ses sujets dans cette liste
fermée :
- "price" (le montant est trop élevé, le prix des échéances), "money_available" (le prospect n'a pas l'argent
  maintenant), "offer_trust" (est-ce que ça marche, est-ce sérieux, confiance dans l'entreprise ou dans le commercial),
  "offer_relevance" (je n'en ai pas besoin, je sais déjà), "time" (pas le temps ou pas la disponibilité pour suivre le
  programme), "co_decider" (a besoin de l'accord de quelqu'un d'autre avant de décider) ;
- "self_capability" (ne pas y arriver, ne pas tenir, ne pas être assez bon), "own_decision" (se tromper, se faire avoir
  encore) ;
- "present_attachment" (« c'est bien comme ça », « ça me va pour l'instant »), "postponement" (plus tard, après les
  vacances, sans raison).
Un passage qui exprime deux doutes différents (« je n'ai pas les moyens et j'ai peur d'abandonner encore ») donne deux
doutes (OB-4).
Un mot comme « peur » ne fait pas une anxiété à lui seul : nomme ce DONT le prospect a peur.
Si le prospect nie explicitement un doute (« je n'ai pas peur, c'est juste le montant »), mets le sujet nié dans
"denied_subjects" et ne le liste pas comme un doute (OB-24).
Avec l'exclusion "external_deadline", liste un doute "time" seulement si l'événement retire aussi au prospect sa
disponibilité (« c'est la période du bac, je suis pris jusqu'à fin juin ») (OB-25), et donne l'échéance.

Étape 3 · attribution (OB-26). "label_contradicted" : true si le contenu du tour cible ne peut pas appartenir à son
étiquette (le nom du commercial lui-même, ou l'offre décrite à la première personne, sous une étiquette PROSPECT ; SALES
est le commercial).

JSON: {"exclusion": "none|information_request|external_deadline|circuit_fact|conditional_acceptance",
 "doubts": [{"quote": "...", "subjects": ["price"]}], "denied_subjects": [],
 "deadline": {"quote": "...", "binding": true} | null, "label_contradicted": false}
