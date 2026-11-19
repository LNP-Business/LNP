Règles : annexe de la présentation de l'offre PB-29 (étape 2 de l'escalier, version PITCH-2.0).
Étape 2 = le passage du commercial (les tours SALES sont ceux du commercial) qui suit l'étape 1 et énonce un principe
(« ce qui fait sauter ce blocage, c'est… ») et une phase de l'offre.
1. "step" : sa plage (citations exactes du commercial, tours SALES, au début et à la fin), ou null.
2. "mechanisms_stated" : rattache CHAQUE principe ou phase de l'offre que le commercial énonce entre le début de la
   présentation et la feuille de route (ou le prix) à UN des neuf mécanismes : Skill, Legitimacy, Pricing, Acquisition,
   Selling, Delivery, Time, Past failure, Financial risk. Utilise la RÉFÉRENCE DES MÉCANISMES donnée plus bas quand il y
   en a une (nom, principe, phase, indices) ; sans elle, rattache chaque passage au blocage auquel il répond.
   kind = "principle" (un principe que le prospect pourrait répéter) ou "phase" (la phase, ou la partie de l'offre, qui le
   porte). Une entrée par passage, chacune avec une citation exacte du commercial. Un mécanisme dit en passant compte
   quand même.
3. "recitation" : un passage qui énumère des éléments, des modules ou des livrables de l'offre sans les relier au
   principe ; donne la citation exacte et la liste des éléments nommés. null s'il n'y en a pas.
JSON : {"step": {"start_turn": "...", "start_quote": "...", "end_turn": "...", "end_quote": "..."} | null,
       "mechanisms_stated": [{"mechanism": "Pricing", "kind": "principle|phase", "quote": "...", "turn": "T187"}],
       "recitation": {"items": ["module 4 tarifs", "module 5 contrats", "communauté"], "quote": "...", "turn": "T189"} | null}
