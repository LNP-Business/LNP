# Index des bornes : chaque élément que le moteur repère dans une transcription, et la règle qui le borne

Le « bornage » est l'ensemble des règles exactes qui disent où un élément commence et finit dans une transcription brute, ce
qui compte et ce qui ne compte jamais. Une règle qui n'est pas écrite dans ces fichiers n'existe pas : un cas non couvert va à
l'arbitre avec l'étiquette `uncovered_case` et devient une nouvelle règle numérotée dans la version suivante.

Pour chaque compétence, lire dans cet ordre : `0N_<x>_A_notation.md` (définitions, items, portes, contrat de sortie) →
`0N_<x>_B_regles_de_bornage.md` (les règles de bornage, les exclusions, les paires minimales) → `0N_<x>_C_cas_de_calibration.md`
(vrais cas annotés, le jeu de non-régression). Règles communes de preuve, chaîne d'analyse, agrégation :
`00_regles_communes_partie_C.md`.

## Éléments communs (calculés une fois par appel)

| Élément | Règles | Fichier |
|---|---|---|
| Tours, rôles des locuteurs, porte de diarisation, tours fusionnés / inversés / en écho | C1 | `methodology/00_regles_communes_partie_C.md` |
| Citation exacte, bon locuteur, bon endroit, deux citations pour le niveau 2, une approbation n'est pas une preuve | C3 | `methodology/00_regles_communes_partie_C.md` |
| Début de la présentation, mention de l'offre, premier prix, prix précoce, demande de décision, fin de la présentation | PB-1 à PB-4, PB-17 à PB-19, PB-21 | `methodology/03_presentation_B_regles_de_bornage.md` |
| Périmètre de la découverte (début, fin ; plus de réouverture depuis la v1.2) | SB-1, SB-2, SB-25, SB-34 (SB-3, SB-4 remplacées) | `methodology/01_spin_B_regles_de_bornage.md` |
| Règle du mot pour mot (expression clé, transformations permises) | GB-22 à GB-27 | `methodology/02_ecart_B_regles_de_bornage.md` |

## SPIN · unités de sollicitation (découpage)

| Règle | Ce qu'elle borne | Fichier |
|---|---|---|
| SEG-1 | Une proposition interrogative, une sollicitation. Trois questions dans un même tour font trois unités | `methodology/01_spin_A_notation.md` |
| SEG-2 | Deux interrogatives coordonnées font deux unités si le prospect peut répondre à l'une sans l'autre | `methodology/01_spin_A_notation.md` |
| SEG-3 | Une alternative (« c'est le prix ou le moment ? ») est une seule unité | `methodology/01_spin_A_notation.md` |
| SEG-4 | Une queue de validation (« …, non ? », « …, c'est ça ? », « …, d'accord ? », « ça te parle ? ») appartient à la proposition qu'elle ferme et ne compte jamais à part | `methodology/01_spin_A_notation.md` |
| SEG-5 | Un préambule affirmatif dans le même tour n'est pas une sollicitation, mais ses mots comptent pour l'ancrage | `methodology/01_spin_A_notation.md` |
| SEG-6 | Une question interrompue compte si elle est compréhensible et que le prospect y répond ; sinon elle est gardée avec l'attribut `debris` et exclue | `methodology/01_spin_A_notation.md` |
| SEG-7 | Une relance d'écoute (« hmm ? », « ah ouais ? », « c'est vrai ? ») dite par-dessus le prospect n'est jamais une sollicitation | `methodology/01_spin_A_notation.md` |
| SEG-8 | Seul le commercial produit des sollicitations. Une question du prospect n'est jamais codée | `methodology/01_spin_A_notation.md` |

## SPIN · périmètre, réponses, atomes, chaînes

| Règle | Ce qu'elle borne | Fichier |
|---|---|---|
| SB-1 | Limites | `methodology/01_spin_B_regles_de_bornage.md` |
| SB-2 | Questions sociales et de cadrage | `methodology/01_spin_B_regles_de_bornage.md` |
| SB-3 | Réouvertures (remplacée par SB-34) | `methodology/01_spin_B_regles_de_bornage.md` |
| SB-4 | Questions à l'intérieur de la présentation (remplacée par SB-34) | `methodology/01_spin_B_regles_de_bornage.md` |
| SB-5 | Étendue de la réponse | `methodology/01_spin_B_regles_de_bornage.md` |
| SB-6 | Questions empilées | `methodology/01_spin_B_regles_de_bornage.md` |
| SB-7 | Première réponse courte | `methodology/01_spin_B_regles_de_bornage.md` |
| SB-8 | Parole spontanée | `methodology/01_spin_B_regles_de_bornage.md` |
| SB-9 | Un atome, un passage | `methodology/01_spin_B_regles_de_bornage.md` |
| SB-10 | PAIN ou IMPACT | `methodology/01_spin_B_regles_de_bornage.md` |
| SB-11 | SITUATION ou IMPACT pour les chiffres | `methodology/01_spin_B_regles_de_bornage.md` |
| SB-12 | DESIRE ou réaction à l'offre | `methodology/01_spin_B_regles_de_bornage.md` |
| SB-13 | DESIRE ou VALUE | `methodology/01_spin_B_regles_de_bornage.md` |
| SB-14 | Contenu soufflé | `methodology/01_spin_B_regles_de_bornage.md` |
| SB-15 | Quantifié | `methodology/01_spin_B_regles_de_bornage.md` |
| SB-16 | Objet | `methodology/01_spin_B_regles_de_bornage.md` |
| SB-17 | Relancé | `methodology/01_spin_B_regles_de_bornage.md` |
| SB-18 | Chaîne profonde | `methodology/01_spin_B_regles_de_bornage.md` |
| SB-19 | Relances en écho | `methodology/01_spin_B_regles_de_bornage.md` |
| SB-20 | Ce qui casse une chaîne | `methodology/01_spin_B_regles_de_bornage.md` |
| SB-21 | Questions de plan d'action | `methodology/01_spin_B_regles_de_bornage.md` |
| SB-22 | Baisse de revenus | `methodology/01_spin_B_regles_de_bornage.md` |
| SB-23 | Discours rapporté | `methodology/01_spin_B_regles_de_bornage.md` |
| SB-24 | Quantifié, précisément | `methodology/01_spin_B_regles_de_bornage.md` |
| SB-25 | Questions de financement | `methodology/01_spin_B_regles_de_bornage.md` |
| SB-26 | Registre d'une question (Financier, Temps et charge, Identité et statut, Mental et émotionnel, Autre) ; quelles questions en reçoivent un | `methodology/01_spin_B_regles_de_bornage.md` |
| SB-27 | Le registre se lit dans la question quand elle nomme un domaine, sinon dans son effet (SB-35) | `methodology/01_spin_B_regles_de_bornage.md` |
| SB-28 | Le domaine demandé l'emporte sur la prémisse ; le premier domaine demandé dans l'ordre de lecture | `methodology/01_spin_B_regles_de_bornage.md` |
| SB-29 | Sujet des sept domaines nommé dans la question ; référence (seulement quand il n'y a pas de réponse) | `methodology/01_spin_B_regles_de_bornage.md` |
| SB-30 | Mots de domaine par registre (listes de mots du code) | `methodology/01_spin_B_regles_de_bornage.md` |
| SB-31 | Autre (la réponse ne parle d'aucun des sept domaines, ou pas de réponse et rien de nommé) | `methodology/01_spin_B_regles_de_bornage.md` |
| SB-32 | Contrôles du code : citation, conflit de lexique, trois lectures, arbitre, `to_review` | `methodology/01_spin_B_regles_de_bornage.md` |
| SB-33 | Fiabilité : objectif de 92 %, porte d'accord 3/3 par appel | `methodology/01_spin_B_regles_de_bornage.md` |
| SB-34 | SPIN s'arrête à la présentation : rien après le premier début de présentation ou le premier prix n'est du SPIN | `methodology/01_spin_B_regles_de_bornage.md` |
| SB-35 | Question ouverte (aucun domaine nommé) : le registre de la réponse du prospect, l'effet de la question (v1.3) | `methodology/01_spin_B_regles_de_bornage.md` |

## Écart · restitution, composantes, validation, formule, mot pour mot

| Règle | Ce qu'elle borne | Fichier |
|---|---|---|
| GB-1 | Plage | `methodology/02_ecart_B_regles_de_bornage.md` |
| GB-2 | Une restitution ou deux | `methodology/02_ecart_B_regles_de_bornage.md` |
| GB-3 | Reconnaissance des composantes | `methodology/02_ecart_B_regles_de_bornage.md` |
| GB-4 | Restitution ou non | `methodology/02_ecart_B_regles_de_bornage.md` |
| GB-5 | Restitution ou présentation | `methodology/02_ecart_B_regles_de_bornage.md` |
| GB-6 | Restitution ou histoire | `methodology/02_ecart_B_regles_de_bornage.md` |
| GB-7 | La composante du coût | `methodology/02_ecart_B_regles_de_bornage.md` |
| GB-8 | Le tour de validation | `methodology/02_ecart_B_regles_de_bornage.md` |
| GB-9 | Validation captée par une autre question | `methodology/02_ecart_B_regles_de_bornage.md` |
| GB-10 | Issues de la validation | `methodology/02_ecart_B_regles_de_bornage.md` |
| GB-11 | Plusieurs restitutions | `methodology/02_ecart_B_regles_de_bornage.md` |
| GB-12 | Locuteurs | `methodology/02_ecart_B_regles_de_bornage.md` |
| GB-13 | Appels de suivi | `methodology/02_ecart_B_regles_de_bornage.md` |
| GB-14 | Quel début de présentation | `methodology/02_ecart_B_regles_de_bornage.md` |
| GB-15 | « Non » à « j'ai oublié quelque chose ? » | `methodology/02_ecart_B_regles_de_bornage.md` |
| GB-16 | Accord partiel | `methodology/02_ecart_B_regles_de_bornage.md` |
| GB-17 | Réaction émotionnelle | `methodology/02_ecart_B_regles_de_bornage.md` |
| GB-18 | Coût minimisé | `methodology/02_ecart_B_regles_de_bornage.md` |
| GB-19 | Notes des contacts précédents | `methodology/02_ecart_B_regles_de_bornage.md` |
| GB-20 | Raisons d'absence : priorité et pluralité | `methodology/02_ecart_B_regles_de_bornage.md` |
| GB-21 | Tours fusionnés | `methodology/02_ecart_B_regles_de_bornage.md` |
| GB-22 | Expression clé | `methodology/02_ecart_B_regles_de_bornage.md` |
| GB-23 | Marqueur de citation | `methodology/02_ecart_B_regles_de_bornage.md` |
| GB-24 | Chiffres | `methodology/02_ecart_B_regles_de_bornage.md` |
| GB-25 | Correction | `methodology/02_ecart_B_regles_de_bornage.md` |
| GB-26 | Validation avec les mots du prospect | `methodology/02_ecart_B_regles_de_bornage.md` |
| GB-27 | Plusieurs sources possibles | `methodology/02_ecart_B_regles_de_bornage.md` |
| GB-28 | Choisir A | `methodology/02_ecart_B_regles_de_bornage.md` |
| GB-29 | Choisir B | `methodology/02_ecart_B_regles_de_bornage.md` |
| GB-30 | Choisir P (un seul blocage) | `methodology/02_ecart_B_regles_de_bornage.md` |
| GB-31 | Conformité d'une restitution à la formule | `methodology/02_ecart_B_regles_de_bornage.md` |
| GB-32 | Blocages de la feuille de route | `methodology/02_ecart_B_regles_de_bornage.md` |
| GB-33 | Avertissement du Copilote | `methodology/02_ecart_B_regles_de_bornage.md` |
| GB-34 | D'un seul tenant | `methodology/02_ecart_B_regles_de_bornage.md` |

## Présentation · ancres, segments, étapes, feuille de route, affirmations, promesses, adhésion

| Règle | Ce qu'elle borne | Fichier |
|---|---|---|
| PB-1 | Début de la présentation | `methodology/03_presentation_B_regles_de_bornage.md` |
| PB-2 | Mention de l'offre (pas un début de présentation) | `methodology/03_presentation_B_regles_de_bornage.md` |
| PB-3 | Premier prix | `methodology/03_presentation_B_regles_de_bornage.md` |
| PB-4 | Fin de la présentation | `methodology/03_presentation_B_regles_de_bornage.md` |
| PB-5 | Présentation sur deux appels | `methodology/03_presentation_B_regles_de_bornage.md` |
| PB-6 | Limites des segments | `methodology/03_presentation_B_regles_de_bornage.md` |
| PB-7 | Étiquette d'un segment | `methodology/03_presentation_B_regles_de_bornage.md` |
| PB-8 | Ce qu'est un lien | `methodology/03_presentation_B_regles_de_bornage.md` |
| PB-9 | Ce qui n'est pas un lien | `methodology/03_presentation_B_regles_de_bornage.md` |
| PB-10 | Données d'entrée | `methodology/03_presentation_B_regles_de_bornage.md` |
| PB-11 | Point de contrôle | `methodology/03_presentation_B_regles_de_bornage.md` |
| PB-12 | Pas un point de contrôle | `methodology/03_presentation_B_regles_de_bornage.md` |
| PB-13 | Réponse avec contenu | `methodology/03_presentation_B_regles_de_bornage.md` |
| PB-14 | Adhésion | `methodology/03_presentation_B_regles_de_bornage.md` |
| PB-15 | Pas d'adhésion | `methodology/03_presentation_B_regles_de_bornage.md` |
| PB-16 | Le geste avant l'adhésion | `methodology/03_presentation_B_regles_de_bornage.md` |
| PB-17 | Mention non sollicitée | `methodology/03_presentation_B_regles_de_bornage.md` |
| PB-18 | Montants hypothétiques et fourchettes | `methodology/03_presentation_B_regles_de_bornage.md` |
| PB-19 | Prix avant la présentation | `methodology/03_presentation_B_regles_de_bornage.md` |
| PB-20 | Données hors de la transcription | `methodology/03_presentation_B_regles_de_bornage.md` |
| PB-21 | Normalisation des nombres | `methodology/03_presentation_B_regles_de_bornage.md` |
| PB-22 | Doute sur le marché | `methodology/03_presentation_B_regles_de_bornage.md` |
| PB-23 | Reformuler pour vérifier la compréhension | `methodology/03_presentation_B_regles_de_bornage.md` |
| PB-24 | Projection utilisée pour repousser | `methodology/03_presentation_B_regles_de_bornage.md` |
| PB-25 | Questions fermées d'adéquation et échelles | `methodology/03_presentation_B_regles_de_bornage.md` |
| PB-26 | Tours fusionnés | `methodology/03_presentation_B_regles_de_bornage.md` |
| PB-27 | Catégorie de P | `methodology/03_presentation_B_regles_de_bornage.md` |
| PB-28 | Étape 1 | `methodology/03_presentation_B_regles_de_bornage.md` |
| PB-29 | Étape 2 | `methodology/03_presentation_B_regles_de_bornage.md` |
| PB-30 | Étape 3 | `methodology/03_presentation_B_regles_de_bornage.md` |
| PB-31 | Étape 4 | `methodology/03_presentation_B_regles_de_bornage.md` |
| PB-32 | Ordre | `methodology/03_presentation_B_regles_de_bornage.md` |
| PB-33 | Phrases | `methodology/03_presentation_B_regles_de_bornage.md` |
| PB-34 | Feuille de route | `methodology/03_presentation_B_regles_de_bornage.md` |
| PB-35 | Affirmations hors de son écart ou de l'offre | `methodology/03_presentation_B_regles_de_bornage.md` |
| PB-36 | Promesse de résultat | `methodology/03_presentation_B_regles_de_bornage.md` |
| PB-37 | Présentation avant le oui | `methodology/03_presentation_B_regles_de_bornage.md` |

## Objections · résistance, nature, épisode, gestes, résolution, prévention

| Règle | Ce qu'elle borne | Fichier |
|---|---|---|
| OB-1 | Candidate | `methodology/04_objections_B_regles_de_bornage.md` |
| OB-2 | Exclusions à la détection | `methodology/04_objections_B_regles_de_bornage.md` |
| OB-3 | Nature : tests de frontière | `methodology/04_objections_B_regles_de_bornage.md` |
| OB-4 | Passages mixtes | `methodology/04_objections_B_regles_de_bornage.md` |
| OB-5 | Une résistance sur plusieurs tours | `methodology/04_objections_B_regles_de_bornage.md` |
| OB-6 | Début | `methodology/04_objections_B_regles_de_bornage.md` |
| OB-7 | Réponse | `methodology/04_objections_B_regles_de_bornage.md` |
| OB-8 | Changement de sujet | `methodology/04_objections_B_regles_de_bornage.md` |
| OB-9 | Réaction | `methodology/04_objections_B_regles_de_bornage.md` |
| OB-10 | Latente | `methodology/04_objections_B_regles_de_bornage.md` |
| OB-11 | Récurrence | `methodology/04_objections_B_regles_de_bornage.md` |
| OB-12 | Locuteurs | `methodology/04_objections_B_regles_de_bornage.md` |
| OB-13 | Accueillir | `methodology/04_objections_B_regles_de_bornage.md` |
| OB-14 | Isoler | `methodology/04_objections_B_regles_de_bornage.md` |
| OB-15 | Explorer | `methodology/04_objections_B_regles_de_bornage.md` |
| OB-16 | Geste de réponse adapté | `methodology/04_objections_B_regles_de_bornage.md` |
| OB-17 | Résolution | `methodology/04_objections_B_regles_de_bornage.md` |
| OB-18 | Avant le prix | `methodology/04_objections_B_regles_de_bornage.md` |
| OB-19 | Supposition | `methodology/04_objections_B_regles_de_bornage.md` |
| OB-20 | Exploration elliptique | `methodology/04_objections_B_regles_de_bornage.md` |
| OB-21 | Recadrage de l'état d'esprit sur une anxiété | `methodology/04_objections_B_regles_de_bornage.md` |
| OB-22 | Recevoir et repartir dans le même tour | `methodology/04_objections_B_regles_de_bornage.md` |
| OB-23 | Engagement sur une réponse proposée | `methodology/04_objections_B_regles_de_bornage.md` |
| OB-24 | Anxiété niée | `methodology/04_objections_B_regles_de_bornage.md` |
| OB-25 | Raison extérieure qui limite aussi le temps | `methodology/04_objections_B_regles_de_bornage.md` |
| OB-26 | Attribution | `methodology/04_objections_B_regles_de_bornage.md` |
| OB-27 | Portée : seulement après le premier prix | `methodology/04_objections_B_regles_de_bornage.md` |

## Règles d'exclusion
Chaque fichier de bornage se termine par un tableau d'exclusions (« Ne compte jamais comme… », X1, X2, …) et un tableau de
paires minimales (deux passages qui ne diffèrent que par un élément et changent le verdict). Les paires minimales sont
implémentées comme tests unitaires dans `moteur/tests/`.
