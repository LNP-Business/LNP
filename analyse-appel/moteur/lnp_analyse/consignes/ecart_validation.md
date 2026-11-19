Règles : annexe Écart GB-8 à GB-10, GB-15, GB-16, GB-17, GB-26 (validation d'une restitution).
Lis le TOUR DE VALIDATION uniquement comme la réponse du prospect à la restitution.
- `outcome` :
  - confirmed_with_content : il est d'accord et ajoute quelque chose de lui (une précision, un chiffre, une émotion, un
    élément nouveau, une reformulation avec ses propres mots).
  - confirmed : il est d'accord sans contenu nouveau (« Ouais, exactement. », « C'est ça. », « À 100 % », « en gros »,
    « plus ou moins »). « Non », « Non, c'est tout » en réponse à « J'ai oublié quelque chose ? » / « Je me suis trompé
    quelque part ? » vaut confirmed.
  - corrected : il corrige une ou plusieurs composantes (« Pas tout à fait, c'est plutôt 3 000 »), y compris un accord
    avec une réserve suivi d'une correction (« À 99 %, sauf que c'est plutôt 3 000 »).
  - rejected : il n'est pas d'accord avec la restitution dans son ensemble.
  - none : le tour répond à une autre question, ou ne répond pas à la restitution.
- `agreement_quote` : les mots exacts du tour de validation qui marquent l'accord (un seul mot est permis : « Oui. »).
- `content_quote` : pour confirmed_with_content, les mots exacts du contenu ajouté.
- `content_is_repetition` : true si ce contenu ne fait que répéter les mots que le commercial a employés dans la
  restitution.
- `corrected_components` (PROBLEM, COST, A, B) et `correction_quote` : pour corrected, les mots exacts de la correction.
- `emotional_reaction` : le prospect réagit avec émotion à la restitution (« Pourquoi tu me dis ça ? », « ça fait mal à
  entendre ») ; `disagreement` : il est explicitement en désaccord avec son contenu.
- `answers_other_question` : true si le tour répond à une question posée à la fin de la restitution sur un autre sujet,
  ou si la question suivante du commercial a été fusionnée dans le tour.
- `addressed_co_decider` : true si le tour est dit par un codécideur (OTHER) à qui la restitution s'adressait.
