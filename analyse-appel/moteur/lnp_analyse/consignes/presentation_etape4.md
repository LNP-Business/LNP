Règles : annexe de la présentation de l'offre PB-31 (étape 4 de l'escalier, la preuve, version PITCH-2.0).
Étape 4 = un passage qui raconte l'histoire d'un client, nommé ou décrit, qui est passé par l'offre.
Liste chaque cas client de ce type raconté pendant la présentation. Pour chacun : sa plage (citations exactes du
commercial, tours SALES ; SALES est le commercial), la citation exacte qui décrit le cas, et "library_id" : l'identifiant
du cas de la BIBLIOTHÈQUE DE CAS ci-dessous auquel il correspond (par son nom, ou par ses chiffres et son point de départ),
ou "not_in_library" s'il ne correspond à aucun. Ne devine jamais un identifiant : en cas de doute, "not_in_library".
"profile_match" : true seulement si le libellé du profil de départ du cas dans la bibliothèque est aussi le point de
départ du prospect, avec "prospect_evidence" : la citation exacte du PROSPECT, avant la présentation, qui le montre ;
sinon false et null.
JSON : {"cases": [{"step": {"start_turn": "...", "start_quote": "...", "end_turn": "...", "end_quote": "..."},
                  "quote": "...", "turn": "T192", "library_id": "case-07|not_in_library",
                  "profile_match": false, "prospect_evidence": null}]}
