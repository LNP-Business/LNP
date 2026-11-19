ÉTAPE S2 · L'ÉCART RESTITUÉ (annexe Écart GB-1 à GB-29)
{ancres}
Les quatre composantes n'existent jamais que dans les propres mots du prospect : PROBLEM (ce qui ne marche pas et
empêche le prospect d'atteindre l'objectif : un manque, un blocage, une peur, un échec passé, une contrainte), COST (ce
que coûte le problème, ou ce que coûte de rester comme il est : argent, temps, clients, famille, santé, confiance en
soi, occasion perdue ; jamais un revenu actuel, un prix ou un budget), A (là où le prospect est aujourd'hui), B (là où il
veut aller). Une conséquence que le prospect vit à cause du problème (dépendre d'un parent, l'épuisement, moins de temps
avec les enfants, des économies qui fondent, se sentir exploité) est un COST, pas un PROBLEM ; le PROBLEM est ce qui
l'empêche d'atteindre l'objectif.

Liste chaque passage du commercial (SALES), depuis le début de la découverte jusqu'{limite}, qui restitue ce que le
prospect a dit : une ouverture (« si je résume », « si j'ai bien compris », « donc, ce que j'entends, c'est que »,
« je te refais un petit résumé » ; en anglais "so from what I'm hearing", "let me play that back"), un long passage de
propositions en « tu… » qui portent les mots du prospect, ou un passage qui se termine par une demande de le valider
(« c'est bien ça ? », « est-ce que j'ai bien compris ? », « je résume bien ? » ; "did I get that right?", "is that
fair?"). Un passage = des tours du commercial qui se suivent, séparés seulement par de courtes approbations (« ouais »,
« mm-hmm ») ; un tour du prospect de 6 mots ou plus le termine (GB-1, GB-2).
Pour chaque passage :
- "turns" : les identifiants de ses tours SALES.
- "clauses" : chaque proposition qui restitue une composante : "component" (PROBLEM, COST, A ou B) ; "sales_turn" et
  "sales_quote" (les mots exacts du commercial dans la proposition) ; "source_turn" (le tour PROSPECT précédent qu'elle
  restitue, celui dont le commercial reprend les mots ; null quand le prospect ne l'a jamais dit) ; "key_expression"
  (les mots du prospect qui portent la composante, copiés caractère pour caractère depuis le tour SOURCE, et que le
  commercial répète : seulement les mots que le commercial reprend (par ex. « 10% », « dépendante »), pas toute la
  phrase du prospect ; jamais une tournure générique comme « tu veux » ; si le commercial a paraphrasé, copie quand
  même les mots du prospect : le code vérifie) ; "as_holding_back" (le PROBLEM est présenté comme ce qui retient le
  prospect) ; "other_person" : true quand la proposition porte sur quelqu'un d'autre (un ancien élève, « la plupart des
  gens », GB-6) ; "is_question" : true quand la proposition est une question plutôt qu'une affirmation (une affirmation
  avec une queue « ..., non ? » est une affirmation). Laisse de côté les propositions qui viennent après la première
  mention de l'offre (programme, accompagnement, académie, « ce qu'on fait », « comment on aide »).
- "ends_with_new_topic_question" : la dernière phrase du passage est une question sur un nouveau sujet (pas une demande
  de valider ce qui a été dit), avec "new_topic_question_quote".
- "validation" : le tour PROSPECT juste après le passage, lu seulement comme la réponse à ce passage (GB-8 à GB-10,
  GB-15 à GB-17, GB-26) : "turn" ; "outcome" : confirmed_with_content (il approuve et ajoute quelque chose de lui : une
  précision, un nombre, une émotion, un nouvel élément), confirmed (il approuve sans contenu nouveau ; « non, c'est
  tout » à « est-ce que j'ai oublié quelque chose ? »), corrected (il corrige une composante, aussi « à 99 %, sauf que
  c'est 3 000 »), rejected, ou none (il répond à une autre question) ; "agreement_quote", "content_quote",
  "content_is_repetition" (le contenu ne fait que répéter les mots du commercial), "corrected_components",
  "correction_quote", "emotional_reaction", "disagreement", "answers_other_question", "addressed_co_decider". N'omets
  "validation" que lorsqu'un tour du commercial suit le passage.
Liste aussi "deadlines" : chaque date ou durée que le PROSPECT attache à un objectif (là où il veut être), avant la
présentation, chacune avec "turn", "quote", "horizon" (tel qu'il est dit) et "binding" (true pour une échéance externe
et vérifiable, false pour un souhait) (GB-29).

ÉNONCÉS DU PROSPECT TROUVÉS DANS LA DÉCOUVERTE (composante, tour, citation), pour les tours sources :
{enonces}
JSON: {"passages": [{"turns": ["T081"], "clauses": [{"component": "PROBLEM", "sales_turn": "T081", "sales_quote": "...",
  "source_turn": "T052", "key_expression": "...", "as_holding_back": true}], "ends_with_new_topic_question": false,
  "validation": {"turn": "T082", "outcome": "confirmed", "agreement_quote": "..."}}],
 "deadlines": [{"turn": "T060", "quote": "...", "horizon": "...", "binding": false}]}
