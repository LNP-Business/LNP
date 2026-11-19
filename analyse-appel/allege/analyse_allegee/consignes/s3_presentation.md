ÉTAPE S3 · LA PRÉSENTATION DE L'OFFRE (Présentation 2.0, annexe PB-14 à PB-16, PB-23, PB-24, PB-27 à PB-36)
{ancres}
P VALIDÉ (le blocage de l'écart que le prospect a validé) : {vp}
A RETENU : {a}
B RETENU : {b}
SES AUTRES BLOCAGES (matière de la feuille de route) : {blocages}
{references}
Une plage est {"start_turn", "start_quote", "end_turn", "end_quote"} avec des mots exacts du commercial (SALES). Lis
depuis le début de la présentation jusqu'à la fin de l'appel. Donne :
1 "category" (seulement quand un P validé est donné, PB-27) : de quoi le prospect doute-t-il ? Tests dans l'ordre : de
  sa capacité à faire le travail -> Skill ; d'être choisi sans expérience ni diplôme -> Legitimacy ; de ce qu'il faut
  faire payer -> Pricing ; d'où viennent les clients -> Acquisition ; de transformer une conversation en client ->
  Selling ; de mener un projet de bout en bout -> Delivery ; des heures disponibles -> Time ; d'une formation ou d'une
  tentative précédente qui n'a rien donné -> Past failure ; du risque que l'investissement ne soit pas rentable ->
  Financial risk. Un manque d'argent pour payer le programme : not_a_pitch_blocker. Aucune des neuf (une peur, le fait
  de trop réfléchir, « le changement, ça fait peur ») : P_category_unknown, avec "uncovered" (une phrase). Quand deux
  conviennent, la catégorie des propres mots du prospect l'emporte. {"category", "quote" (les mots du prospect qui
  décident, pris dans le tour du P validé), "turn"}.
2 "step1" (PB-28) : {"step" : le premier passage du commercial après le début de la présentation qui dit ce qui bloque
  le prospect ; il se termine à la première phrase qui énonce un principe, une composante ou une phase ; null s'il n'y
  en a pas, "other_blockers" : [{"quote", "turn"}] les autres blocages restitués dans l'étape 1 comme ce qui le
  bloque}.
3 "step2" (PB-29) : {"step" : le passage après l'étape 1 qui énonce un principe (« ce qui fait sauter ce blocage,
  c'est... ») et une phase de l'offre, ou null ; "mechanisms_stated" : CHAQUE principe ou phase énoncé entre le début de
  la présentation et la feuille de route (ou le prix), chacun rattaché à l'un de Skill, Legitimacy, Pricing,
  Acquisition, Selling, Delivery, Time, Past failure, Financial risk : [{"mechanism", "kind": "principle" ou "phase",
  "quote", "turn"}] ; "recitation" : {"items": [...], "quote", "turn"} pour un passage qui énumère des composantes, des
  modules ou des livrables sans les relier au principe, sinon null}.
4 "step3" (PB-30) : ce que le commercial (SALES) dit du point de départ et du point d'arrivée du prospect : {"step" :
  une plage ou null, "A" : {"value" (un nombre), "unit", "quote", "turn"}, "B" : {...}, "deadline" : {"quote", "turn"}
  (une date ou une durée que le commercial attache à B), "deadline_source" : {"quote", "turn"} (les mots du PROSPECT,
  avant la présentation, où il l'a donnée), "image" : {"quote", "turn"} (une scène concrète de sa vie une fois en B),
  "image_key_expression" (les mots du prospect repris dans l'image), "image_source" : {"quote", "turn"} (la citation du
  PROSPECT qui les contient)}.
5 "step4" (PB-31) : {"cases" : chaque cas client raconté : [{"step" : une plage, "quote", "turn", "library_id"
  (l'identifiant dans la bibliothèque de cas, sinon "not_in_library" ; ne jamais deviner), "profile_match",
  "prospect_evidence" : {"quote", "turn"}}]}.
6 "roadmap" (PB-34) : {"roadmap" : la plage des étapes ou des jalons du parcours DU PROSPECT (« ta feuille de route »,
  « pour toi, la première étape, c'est »), pas les modules du programme, ou null ; "steps" : [{"quote", "turn",
  "key_expression", "source" : {"quote", "turn"} (là où il a nommé ce blocage, avant la présentation) ou null}]}.
7 "claims" (PB-35) : CHAQUE chiffre, cas client, prix ou garantie que le commercial (SALES) énonce depuis le début de la
  présentation jusqu'à la demande de décision : [{"kind": "figure" | "case" | "price" | "guarantee", "quote", "turn",
  "library_id", "guarantee_ref", "calculation" (présenté comme un calcul à partir d'autres chiffres)}].
8 "promises" (PB-36) : les phrases du commercial dont le sujet est l'Académie, l'équipe ou « on » / « nous » et dont
  l'action est de faire tourner son activité, de lui trouver ou de lui apporter des clients, de signer ses clients ou de
  réaliser ses projets : [{"quote", "turn", "action": "run_business" | "find_clients" | "sign_clients" |
  "deliver_projects"}]. Fournir des systèmes, des retours, du coaching, des modèles ou des relectures n'est pas une
  promesse.
9 "adhesion" (PB-14 à PB-16, PB-23, PB-24) : les passages du PROSPECT qui montrent une "appropriation" (il restitue une
  composante appliquée à lui-même), une "projection" (première personne, futur ou conditionnel, avec une date, un
  nombre, une première action, un client ou un projet nommé) ou un "new_link" (il relie de lui-même une composante à sa
  situation). Ne comptent pas : les approbations, les compliments, les questions de prix ou de logistique, un contenu
  énoncé d'abord par le commercial. [{"quote", "turn", "kind", "concrete", "comprehension_echo" (ne fait que reprendre
  les mots du commercial en réponse à une question de compréhension), "postpone" (une projection qui sert à justifier
  un report), "gesture" : {"quote", "turn"} (les mots du commercial juste avant)}].
JSON: {"category": {"category": "Acquisition", "quote": "...", "turn": "T028"}, "step1": {"step": null,
  "other_blockers": []}, "step2": {"step": null, "mechanisms_stated": [], "recitation": null}, "step3": {"step": null},
  "step4": {"cases": []}, "roadmap": {"roadmap": null, "steps": []}, "claims": [], "promises": [], "adhesion": []}
