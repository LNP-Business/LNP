Règles : méthodologie SPIN §2, §3 (cinq portes ordonnées), SB-3, SB-21, SB-25. Tu ne choisis PAS de lettre : tu réponds à
des questions fermées sur UNE sollicitation du commercial ; le code applique l'ordre des portes.

La règle qui gouverne tout : lis la réponse que la question DEMANDE, jamais l'intention du commercial et jamais la réponse
obtenue. Un contexte douloureux ne colore pas la question.

- is_solicitation : false pour une affirmation qui commence par un mot interrogatif, une formule de politesse, une ligne du
  système.
- attribution_doubtful : true si la phrase est de toute évidence celle du prospect (mauvaise étiquette de locuteur).
- routing : "VALIDATION_REQUEST" si elle demande de confirmer une restitution complète de l'écart qui vient d'être dit (au
  moins deux parmi : où il ou elle en est, où il ou elle veut aller, ce qui le ou la bloque) ; "DECISION_REQUEST" si elle
  demande une décision d'achat ou d'engagement ; sinon null.
- g1 (porte 1, OUT) reason : la réponse attendue est-elle SEULEMENT
  `nothing` (social, pratique, technique, cadrage de l'appel, rhétorique, permission, « c'est clair pour toi ? », « tu as des
  questions ? »),
  `offer_info` (une information ou un avis sur l'offre du commercial),
  `solution_load` (la charge d'une solution : coût, temps, effort, pression, risque de l'offre ou d'un moyen ; comment le
  prospect paierait : économies, crédit, budget mensuel, SB-25),
  `sales_list` (un choix entre des options formulées par le commercial, sans branche ouverte ; deux faits vérifiables ne
  sont pas une liste),
  `agreement` (l'accord avec une affirmation du commercial : queue « …, non ? » / « …, c'est ça ? », reformulation fermée,
  contenu fourni par le commercial) ?
  Priorité : nothing > offer_info > solution_load > sales_list > agreement. Sinon null.
- g2 (S) neutral_fact : un fait neutre vérifiable aujourd'hui (nombre, durée, nom, statut, ce qui se fait aujourd'hui).
  exclusion : "difficulty" si elle demande de NOMMER une difficulté, "consequence", "future_state" ; sinon null. Compter une
  difficulté déjà nommée n'est pas une exclusion.
- g3 (N) state_or_value : un état désiré qui n'existe pas encore, ou la valeur / l'importance de la résolution.
  antecedent : resolution | problem (le problème qui continue : « si rien ne change… ») | solution | none.
  content_supplied : la question contient déjà l'état, le chiffre ou le bénéfice demandé (un cadre comme « si tu réglais
  ça » n'est pas du contenu ; reprendre le mot du prospect n'est pas du contenu). load_named : elle nomme une charge.
  about_offer : la valeur porte sur l'offre. action_plan : elle demande ce que le prospect devrait faire autrement / son
  propre plan (SB-21).
- g4 (I) consequence : une conséquence du problème (coût, temps perdu, effet sur les clients, la famille, le moral, les
  croyances, ce qui arrive si rien ne change). problem_domain et named_domain (ou "open") : un périmètre de temps ou de lieu
  n'est pas un domaine. same_domain : le domaine nommé est le domaine même du problème. antecedent_solution : elle part d'une
  solution.
- g5 (P) difficulty : la difficulté elle-même (un manque, un blocage, une peur, un échec, une insatisfaction, une cause, ce
  qui a été essayé). sales_named : la question nomme déjà la difficulté avec les mots du commercial. anchored : cette
  formulation reprend le mot du prospect.
- objection_clarification : true seulement si la question clarifie une résistance que le prospect a soulevée contre l'achat.
- quote : pour chaque porte à laquelle tu réponds true (et pour une raison de g1), une sous-chaîne exacte de SOLLICITATION
  (1 à 12 mots).
- split / sub : si SOLLICITATION contient deux interrogatives coordonnées auxquelles on peut répondre séparément (SEG-2),
  `split` les liste recopiées mot pour mot et `sub` répond aux portes pour chacune (même schéma). Les compléments d'une même
  question ne la coupent pas.
Réponds à chaque porte, même après un « oui » plus tôt.

JSON : {"is_solicitation": true, "attribution_doubtful": false, "routing": null,
 "g1": {"reason": null, "quote": null},
 "g2": {"neutral_fact": false, "exclusion": null, "quote": null},
 "g3": {"state_or_value": false, "antecedent": "none", "content_supplied": false, "load_named": false,
        "about_offer": false, "action_plan": false, "quote": null},
 "g4": {"consequence": false, "problem_domain": null, "named_domain": null, "same_domain": false,
        "antecedent_solution": false, "quote": null},
 "g5": {"difficulty": false, "sales_named": false, "anchored": false, "quote": null},
 "objection_clarification": false, "tags": [], "split": null, "sub": null}
