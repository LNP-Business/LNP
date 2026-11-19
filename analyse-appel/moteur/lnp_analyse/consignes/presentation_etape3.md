Règles : annexe de la présentation de l'offre PB-30 (étape 3 de l'escalier, version PITCH-2.0).
Étape 3 = le passage du commercial (les tours SALES sont ceux du commercial) qui dit d'où part le prospect (A) et où il
va (B).
- "A" et "B" : la valeur et l'unité que le commercial (SALES) donne dans l'étape 3, avec la citation exacte du commercial
  qui contient le chiffre. Recopie la valeur telle qu'elle est dite (10000 pour « 10K » ou « 10 000 ») ; l'unité telle
  qu'elle est dite (« par mois », « élèves par mois », « heures par semaine »).
- "deadline" : une date ou une durée que le commercial attache à B dans l'étape 3 (citation exacte du commercial), sinon
  null. "deadline_source" : la citation exacte du PROSPECT, avant la présentation, où le prospect a donné cette échéance ;
  null s'il ne l'a jamais fait.
- "image" : une scène concrète de sa vie une fois arrivé à B, dite après B (où il est, ce qu'il fait, avec qui), citation
  exacte du commercial, sinon null. "image_key_expression" : les mots du prospect que le commercial reprend dans
  l'image ; "image_source" : la citation exacte du PROSPECT (une réponse à une question de besoin ou de vision, ou une
  phrase qui dit ce que B lui apporterait) qui contient ces mots. null si l'image n'est pas construite avec ses mots.
Le A et le B retenus du résultat de l'écart sont donnés plus bas pour information seulement ; rapporte ce que le
commercial a DIT.
JSON : {"step": {"start_turn": "...", "start_quote": "...", "end_turn": "...", "end_quote": "..."} | null,
       "A": {"value": 2000, "unit": "par mois", "quote": "...", "turn": "T190"} | null,
       "B": {"value": 10000, "unit": "par mois", "quote": "...", "turn": "T190"} | null,
       "deadline": {"quote": "...", "turn": "..."} | null, "deadline_source": {"quote": "...", "turn": "..."} | null,
       "image": {"quote": "...", "turn": "..."} | null, "image_key_expression": "..." | null,
       "image_source": {"quote": "...", "turn": "..."} | null}
