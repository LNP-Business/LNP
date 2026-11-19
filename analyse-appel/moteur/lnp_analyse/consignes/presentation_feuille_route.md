Règles : méthodologie de la présentation de l'offre §2.3 et annexe PB-34 (version PITCH-2.0).
La feuille de route commence au premier passage du commercial (les tours SALES sont ceux du commercial) qui présente les
étapes ou les jalons du parcours DU PROSPECT (« ta feuille de route », « pour toi, la première étape c'est… », le plan
d'une page partagé). Une présentation des piliers ou des modules du programme n'est pas une feuille de route.
Donne sa plage (citations exactes du commercial), ou null.
Pour chaque étape de la feuille de route, donne la citation exacte du commercial, l'expression clé (les mots du prospect
que le commercial reprend pour ce blocage) et "source" : la citation exacte du PROSPECT, avant la présentation, où il a
nommé ce blocage (la liste de ses blocages, tirée du résultat de l'écart, est donnée plus bas). source vaut null si
l'étape n'est pas l'un des blocages qu'il a nommés.
JSON : {"roadmap": {"start_turn": "...", "start_quote": "...", "end_turn": "...", "end_quote": "..."} | null,
       "steps": [{"quote": "...", "turn": "T233", "key_expression": "...", "source": {"quote": "...", "turn": "T061"} | null}]}
