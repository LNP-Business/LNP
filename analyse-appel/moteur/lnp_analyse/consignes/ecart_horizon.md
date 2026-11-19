Règles : méthodologie Écart §2 (horizon) et annexe GB-29.
Un horizon est une date ou une durée que le prospect associe à la cible (point B), dans la même réponse ou dans une
réponse suivante. Une échéance contraignante est externe et vérifiable (« mon contrat se termine en juin ») ; un délai
souhaité ne l'est pas (« j'aimerais commencer bientôt », « idéalement d'ici un an »).
- `horizon_quote` et `horizon_turn` : les mots exacts du prospect qui donnent l'échéance, et leur tour ; null s'il n'y en
  a pas.
- `horizon` : l'échéance telle que le prospect l'a dite (copiée, pas convertie).
- `binding` : true pour une échéance contraignante, false pour un délai souhaité, null s'il n'y a pas d'horizon.
N'utilise jamais une échéance dite par le commercial et seulement approuvée par le prospect.
