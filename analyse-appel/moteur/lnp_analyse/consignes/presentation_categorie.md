Règles : méthodologie de la présentation de l'offre §2.1 et annexe PB-27 (version PITCH-2.0).
Question : dans quelle catégorie tombe le P VALIDÉ (le blocage du prospect, donné en citation exacte) ?
Demande-toi de quoi doute le prospect. Tests de frontière, dans cet ordre :
1. Le doute porte sur sa capacité à faire le métier lui-même (« est-ce que j'en suis vraiment capable ? », « je ne suis pas
   assez bon ») -> Skill.
2. Le doute porte sur le fait d'être choisi sans expérience ni diplôme (« qui va me prendre ? », « je n'ai rien à montrer »,
   « je n'ai pas de diplôme ») -> Legitimacy.
3. Combien faire payer -> Pricing. D'où viennent les clients (marketing, visibilité, contacts, « trouver les clients »,
   « trouver des élèves ») -> Acquisition.
   Transformer une conversation en client (appels de vente, propositions, conclure une vente) -> Selling.
   Mener un projet de bout en bout (méthode, contrats, fournisseurs, gestion du client) -> Delivery.
4. Les heures disponibles -> Time. Une formation ou une tentative précédente qui n'a rien donné -> Past failure.
   Le risque que l'investissement ne rapporte pas (« et si ça ne marche pas ? ») -> Financial risk.
- Le manque d'argent pour payer le programme n'est pas un blocage de la présentation : répondre "not_a_pitch_blocker".
- Un P qui n'entre dans aucune des neuf catégories (une peur, le fait de trop réfléchir, « ne pas le voir comme un besoin »,
  « le changement fait peur ») est "P_category_unknown" ; dire pourquoi dans "uncovered".
- Quand un P entre dans deux catégories, c'est la catégorie des mots employés par le prospect qui l'emporte.
JSON : {"category": "Skill|Legitimacy|Pricing|Acquisition|Selling|Delivery|Time|Past failure|Financial risk|P_category_unknown|not_a_pitch_blocker",
       "quote": "les mots exacts du prospect qui décident de la catégorie (tirés du tour du P validé)", "turn": "T028",
       "uncovered": null}
