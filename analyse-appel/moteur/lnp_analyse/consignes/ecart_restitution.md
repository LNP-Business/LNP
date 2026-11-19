Règles : annexe Écart GB-1 à GB-7, GB-22, GB-23, GB-27, GB-31 (composantes d'une restitution). Tu ne décides ni si le
passage est une restitution, ni si une composante est reprise mot pour mot, ni si l'écart est présent : c'est le code
qui décide.

Les quatre composantes (chacune n'existe jamais que dans les propres mots du prospect) :
- PROBLEM : ce qui ne marche pas et empêche le prospect d'atteindre l'état souhaité (un manque, un blocage, une peur,
  un échec passé, une contrainte).
- COST : ce que le problème coûte au prospect, ou ce que lui coûte de rester dans sa situation actuelle (argent, temps,
  clients, famille, santé, confiance en soi, occasion perdue). Un revenu actuel, un prix ou un budget n'est jamais un coût.
- A : là où le prospect en est aujourd'hui (état actuel, chiffre actuel).
- B : là où le prospect veut aller (cible, état souhaité).

Pour chaque proposition des tours SALES (le commercial) de la plage qui reprend une composante :
- `component` : PROBLEM, COST, A ou B.
- `sales_turn`, `sales_quote` : les mots exacts du commercial pour cette proposition (2 à 40 mots, dans un seul tour
  SALES de la plage).
- `about_prospect` : false si la proposition parle d'une autre personne (un ancien participant, un témoignage, « la
  plupart des gens », « beaucoup de gens dans ta situation ») (GB-6). Une comparaison à l'intérieur d'une proposition
  sur le prospect est ignorée.
- `declarative` : true pour une affirmation, ou une affirmation suivie d'une queue de validation (« …, non ? »,
  « …, c'est ça ? ») ; false pour une question.
- `source_turn` : le tour PROSPECT antérieur dont la proposition reprend l'énoncé ; si le prospect l'a dit plusieurs
  fois, cite le tour dont le commercial réutilise les mots (GB-27). `PRIOR<k>` pour la k-ième entrée antérieure
  (formulaire de candidature, appel précédent). null si le prospect ne l'a jamais dit (un coût ou un problème apporté
  par le commercial).
- `key_expression` : les mots du tour source qui portent la composante (pour PROBLEM l'obstacle, pour COST la
  conséquence ou le montant, pour A et B l'état ou la valeur), copiés caractère pour caractère depuis le tour SOURCE,
  et que le commercial répète. Jamais une formule générique (« tu veux », « plein de choses »). Si le commercial a
  paraphrasé, copie quand même les mots du prospect depuis la source : le code verra qu'ils ne sont pas repris.
- `as_holding_back` (PROBLEM seulement) : true si la proposition présente ce blocage comme ce qui retient le prospect
  (« ce qui te retient, c'est… », « le plus gros frein », « ce qui te manque »).
- Ignore les propositions placées après la première mention de l'offre (programme, mentorat, académie, « ce qu'on
  fait », « comment on t'aide »).
- `ends_with_new_topic_question` : true si la dernière phrase de la plage est une question sur un nouveau sujet (et non
  une demande de valider ce qui vient d'être dit, comme « J'ai bien résumé ? », « C'est juste ? », « J'ai oublié quelque
  chose ? »). Donne alors ses mots exacts dans `new_topic_question_quote`.
