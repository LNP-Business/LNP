Règles : annexe de la présentation de l'offre PB-14, PB-15, PB-16, PB-23, PB-24 (adhésion, version PITCH-2.0).
Adhésion = un passage du PROSPECT qui montre l'un de ces cas :
- appropriation : il reformule un élément de l'offre appliqué à lui-même (« donc j'aurais quelqu'un qui relit mes cours
  chaque semaine ») ;
- projection : à la première personne, au futur ou au conditionnel, avec un élément concret (une date, un nombre, une
  première action, un client ou un projet nommé) (« si je commence maintenant, je pourrais avoir mes cinq premiers élèves
  avant mars ») ;
- new_link : il relie de lui-même un élément de l'offre à sa situation (« c'est exactement ce qui m'a manqué avec la
  dernière formation »).
Pas une adhésion (ne pas lister) : les simples approbations et compliments (« ok », « ça a l'air bien », « c'est génial »,
« waouh », « j'adore ») ; les questions sur le prix, le paiement ou l'organisation sans projection ; un contenu d'abord dit
par le commercial (tours SALES) et seulement approuvé.
Signaux dont le code a besoin, pour chaque passage listé :
- "concrete" : true s'il contient une date, un nombre, une première action, un client ou un projet nommé ;
- "comprehension_echo" : true s'il répond à une question de compréhension et ne fait que reprendre les mots du commercial
  sans élément de sa propre situation (PB-23) ;
- "postpone" : true si la projection sert à justifier un report (« je préférerais commencer en janvier », PB-24) ;
- "gesture" : la citation exacte du commercial (tour SALES) juste avant le passage (PB-16).
JSON : {"passages": [{"quote": "...", "turn": "T214", "kind": "appropriation|projection|new_link", "concrete": false,
                     "comprehension_echo": false, "postpone": false, "gesture": {"quote": "...", "turn": "T213"} | null}]}
