Règles : annexe de la présentation de l'offre PB-28 (étape 1 de l'escalier, version PITCH-2.0).
Étape 1 = le PREMIER passage du commercial (les tours SALES sont ceux du commercial) après le début de la présentation qui
dit ce qui bloque le prospect, introduit ou non par « ce qui te bloque aujourd'hui, c'est… ». Elle se termine à la
première phrase qui énonce un principe, un élément de l'offre ou une phase. Une reformulation faite dans la restitution de
l'écart, avant le début de la présentation, n'est pas l'étape 1.
Donne la plage de l'étape 1 avec une citation exacte à son début et à sa fin (tours SALES seulement), ou null s'il n'y en
a pas.
Liste aussi chaque AUTRE blocage (pas le P validé donné plus bas) que le commercial reformule comme ce qui bloque le
prospect à l'intérieur de l'étape 1 ("other_blockers"), chacun avec une citation exacte du commercial. Ne juge pas si les
mots sont ceux du prospect : le code vérifie la règle du mot pour mot.
JSON : {"step": {"start_turn": "T186", "start_quote": "...", "end_turn": "T186", "end_quote": "..."} | null,
       "other_blockers": [{"quote": "...", "turn": "T186"}]}
