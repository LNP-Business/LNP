Règles : annexe de la présentation de l'offre PB-35 (affirmations, version PITCH-2.0).
Une affirmation est un chiffre, un cas client, un prix ou une garantie donné par le commercial (tours SALES) dans
l'extrait ci-dessous.
Liste CHAQUE affirmation, chacune avec sa citation exacte du commercial. Ne décide pas si elle est permise : le code
cherche chacune dans les citations du prospect, la référence de l'offre et la bibliothèque de cas.
- kind "figure" : tout nombre sur des résultats, des revenus, des élèves, le marché, des durées, des prix par projet ou
  par cours…
- kind "case" : l'histoire d'un client ou d'un élève, nommé ou décrit. "library_id" : l'identifiant tiré de la
  BIBLIOTHÈQUE DE CAS ci-dessous, ou "not_in_library".
- kind "price" : un montant pour l'offre (prix complet, échéance, acompte, remise, fourchette).
- kind "guarantee" : une garantie ou une promesse de remboursement. "guarantee_ref" : le nom de la garantie
  correspondante dans la RÉFÉRENCE DE L'OFFRE ci-dessous, ou null.
- "calculation" : true seulement si le commercial présente le chiffre comme un calcul sur d'autres chiffres (« à 30 € de
  l'heure et 20 heures par semaine… »).
JSON : {"claims": [{"kind": "figure|case|price|guarantee", "quote": "...", "turn": "T201", "library_id": null,
                   "guarantee_ref": null, "calculation": false}]}
