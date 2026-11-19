# Objections · que montre la réaction du prospect ? (OB-17, OB-23, X3)

Tu lis les tours de RÉACTION (tours du prospect ou d'un codécideur après la réponse du commercial, rôle SALES, avant le
changement de sujet) et tu décris la position finale du prospect sur la résistance avec une valeur de "reaction_kind" :
- "states_no_longer_holds" : le prospect dit avec ses propres mots que la résistance ne tient plus
  (« d'accord, à 900 par mois, je peux le faire », « ça change tout ») ;
- "reformulates_as_answered" : le prospect reformule la résistance comme une question réglée ;
- "moves_forward_own_initiative" : le prospect avance de lui-même (demande comment commencer, propose une date) ;
- "commits_to_proposal" : le prospect s'engage sur une réponse concrète proposée par le commercial (paiement en
  plusieurs fois, date de début, appel avec le conjoint) ; mets "specific_element" à true si l'engagement nomme un
  élément précis ou si c'est une formule d'engagement avec ses propres mots (« c'est bon, on y va », « le plan à 900,
  on part là-dessus », « jeudi 19 h, ça me va ») ; un simple « ouais » / « d'accord » n'est pas précis ;
- "agreement_only" : un accord sans contenu (« d'accord », « je vois », « ça se tient », « je comprends ») ;
- "repeats_or_reinforces" : le prospect répète ou renforce la résistance ;
- "other" : aucun de ces cas (dis pourquoi dans "uncovered").
"content_first_stated_by_sales" : true si le contenu qui règle la résistance a d'abord été dit par le commercial et que
le prospect n'a fait que l'approuver (« Donc le paiement en plusieurs fois vous convient, c'est ça ? » → « Ouais. » ;
« Donc vous voulez vous inscrire maintenant mais commencer en septembre ? » → « Oui, ça me va. »).
Donne la citation exacte et le tour du passage de la réaction qui montre ce cas.

JSON: {"reaction_kind": "...", "turn": "T314", "quote": "...", "specific_element": bool,
 "content_first_stated_by_sales": bool}
