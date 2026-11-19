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
| Tours, rôles des locuteurs, porte de diarisation, tours fusionnés / inversés / en écho | C1 | `methodologie/00_regles_communes_partie_C.md` |
| Citation exacte, bon locuteur, bon endroit, deux citations pour le niveau 2, une approbation n'est pas une preuve | C3 | `methodologie/00_regles_communes_partie_C.md` |
| Début de la présentation, mention de l'offre, premier prix, prix précoce, demande de décision, fin de la présentation | PB-1 à PB-4, PB-17 à PB-19, PB-21 | `methodologie/03_presentation_B_regles_de_bornage.md` |
| Périmètre de la découverte (début, fin ; plus de réouverture depuis la v1.2) | SB-1, SB-2, SB-25, SB-34 (SB-3, SB-4 remplacées) | `methodologie/01_spin_B_regles_de_bornage.md` |
| Règle du mot pour mot (expression clé, transformations permises) | GB-22 à GB-27 | `methodologie/02_ecart_B_regles_de_bornage.md` |

## SPIN · unités de sollicitation (découpage)

| Règle | Ce qu'elle borne | Fichier |
|---|---|---|
| SEG-1 | Une proposition interrogative, une sollicitation. Trois questions dans un même tour font trois unités | `methodologie/01_spin_A_notation.md` |
| SEG-2 | Deux interrogatives coordonnées font deux unités si le prospect peut répondre à l'une sans l'autre | `methodologie/01_spin_A_notation.md` |
| SEG-3 | Une alternative (« c'est le prix ou le moment ? ») est une seule unité | `methodologie/01_spin_A_notation.md` |
| SEG-4 | Une queue de validation (« …, non ? », « …, c'est ça ? », « …, d'accord ? », « ça te parle ? ») appartient à la proposition qu'elle ferme et ne compte jamais à part | `methodologie/01_spin_A_notation.md` |
| SEG-5 | Un préambule affirmatif dans le même tour n'est pas une sollicitation, mais ses mots comptent pour l'ancrage | `methodologie/01_spin_A_notation.md` |
| SEG-6 | Une question interrompue compte si elle est compréhensible et que le prospect y répond ; sinon elle est gardée avec l'attribut `debris` et exclue | `methodologie/01_spin_A_notation.md` |
| SEG-7 | Une relance d'écoute (« hmm ? », « ah ouais ? », « c'est vrai ? ») dite par-dessus le prospect n'est jamais une sollicitation | `methodologie/01_spin_A_notation.md` |
| SEG-8 | Seul le commercial produit des sollicitations. Une question du prospect n'est jamais codée | `methodologie/01_spin_A_notation.md` |

## SPIN · périmètre, réponses, atomes, chaînes

| Règle | Ce qu'elle borne | Fichier |
|---|---|---|
| SB-1 | Limites | `methodologie/01_spin_B_regles_de_bornage.md` |
| SB-2 | Questions sociales et de cadrage | `methodologie/01_spin_B_regles_de_bornage.md` |
| SB-3 | Réouvertures (remplacée par SB-34) | `methodologie/01_spin_B_regles_de_bornage.md` |
| SB-4 | Questions à l'intérieur de la présentation (remplacée par SB-34) | `methodologie/01_spin_B_regles_de_bornage.md` |
| SB-5 | Étendue de la réponse | `methodologie/01_spin_B_regles_de_bornage.md` |
| SB-6 | Questions empilées | `methodologie/01_spin_B_regles_de_bornage.md` |
| SB-7 | Première réponse courte | `methodologie/01_spin_B_regles_de_bornage.md` |
| SB-8 | Parole spontanée | `methodologie/01_spin_B_regles_de_bornage.md` |
| SB-9 | Un atome, un passage | `methodologie/01_spin_B_regles_de_bornage.md` |
| SB-10 | PAIN ou IMPACT | `methodologie/01_spin_B_regles_de_bornage.md` |
| SB-11 | SITUATION ou IMPACT pour les chiffres | `methodologie/01_spin_B_regles_de_bornage.md` |
| SB-12 | DESIRE ou réaction à l'offre | `methodologie/01_spin_B_regles_de_bornage.md` |
| SB-13 | DESIRE ou VALUE | `methodologie/01_spin_B_regles_de_bornage.md` |
| SB-14 | Contenu soufflé | `methodologie/01_spin_B_regles_de_bornage.md` |
| SB-15 | Quantifié | `methodologie/01_spin_B_regles_de_bornage.md` |
| SB-16 | Objet | `methodologie/01_spin_B_regles_de_bornage.md` |
| SB-17 | Relancé | `methodologie/01_spin_B_regles_de_bornage.md` |
| SB-18 | Chaîne profonde | `methodologie/01_spin_B_regles_de_bornage.md` |
| SB-19 | Relances en écho | `methodologie/01_spin_B_regles_de_bornage.md` |
| SB-20 | Ce qui casse une chaîne | `methodologie/01_spin_B_regles_de_bornage.md` |
| SB-21 | Questions de plan d'action | `methodologie/01_spin_B_regles_de_bornage.md` |
| SB-22 | Baisse de revenus | `methodologie/01_spin_B_regles_de_bornage.md` |
| SB-23 | Discours rapporté | `methodologie/01_spin_B_regles_de_bornage.md` |
| SB-24 | Quantifié, précisément | `methodologie/01_spin_B_regles_de_bornage.md` |
| SB-25 | Questions de financement | `methodologie/01_spin_B_regles_de_bornage.md` |
| SB-26 | Registre d'une question (Financier, Temps et charge, Identité et statut, Mental et émotionnel, Autre) ; quelles questions en reçoivent un | `methodologie/01_spin_B_regles_de_bornage.md` |
| SB-27 | Le registre se lit dans la question quand elle nomme un domaine, sinon dans son effet (SB-35) | `methodologie/01_spin_B_regles_de_bornage.md` |
| SB-28 | Le domaine demandé l'emporte sur la prémisse ; le premier domaine demandé dans l'ordre de lecture | `methodologie/01_spin_B_regles_de_bornage.md` |
| SB-29 | Sujet des sept domaines nommé dans la question ; référence (seulement quand il n'y a pas de réponse) | `methodologie/01_spin_B_regles_de_bornage.md` |
| SB-30 | Mots de domaine par registre (listes de mots du code) | `methodologie/01_spin_B_regles_de_bornage.md` |
| SB-31 | Autre (la réponse ne parle d'aucun des sept domaines, ou pas de réponse et rien de nommé) | `methodologie/01_spin_B_regles_de_bornage.md` |
| SB-32 | Contrôles du code : citation, conflit de lexique, trois lectures, arbitre, `to_review` | `methodologie/01_spin_B_regles_de_bornage.md` |
| SB-33 | Fiabilité : objectif de 92 %, porte d'accord 3/3 par appel | `methodologie/01_spin_B_regles_de_bornage.md` |
| SB-34 | SPIN s'arrête à la présentation : rien après le premier début de présentation ou le premier prix n'est du SPIN | `methodologie/01_spin_B_regles_de_bornage.md` |
| SB-35 | Question ouverte (aucun domaine nommé) : le registre de la réponse du prospect, l'effet de la question (v1.3) | `methodologie/01_spin_B_regles_de_bornage.md` |

## Écart · restitution, composantes, validation, formule, mot pour mot

| Règle | Ce qu'elle borne | Fichier |
|---|---|---|
| GB-1 | Plage | `methodologie/02_ecart_B_regles_de_bornage.md` |
| GB-2 | Une restitution ou deux | `methodologie/02_ecart_B_regles_de_bornage.md` |
| GB-3 | Reconnaissance des composantes | `methodologie/02_ecart_B_regles_de_bornage.md` |
| GB-4 | Restitution ou non | `methodologie/02_ecart_B_regles_de_bornage.md` |
| GB-5 | Restitution ou présentation | `methodologie/02_ecart_B_regles_de_bornage.md` |
| GB-6 | Restitution ou histoire | `methodologie/02_ecart_B_regles_de_bornage.md` |
| GB-7 | La composante du coût | `methodologie/02_ecart_B_regles_de_bornage.md` |
| GB-8 | Le tour de validation | `methodologie/02_ecart_B_regles_de_bornage.md` |
| GB-9 | Validation captée par une autre question | `methodologie/02_ecart_B_regles_de_bornage.md` |
| GB-10 | Issues de la validation | `methodologie/02_ecart_B_regles_de_bornage.md` |
| GB-11 | Plusieurs restitutions | `methodologie/02_ecart_B_regles_de_bornage.md` |
| GB-12 | Locuteurs | `methodologie/02_ecart_B_regles_de_bornage.md` |
| GB-13 | Appels de suivi | `methodologie/02_ecart_B_regles_de_bornage.md` |
| GB-14 | Quel début de présentation | `methodologie/02_ecart_B_regles_de_bornage.md` |
| GB-15 | « Non » à « j'ai oublié quelque chose ? » | `methodologie/02_ecart_B_regles_de_bornage.md` |
| GB-16 | Accord partiel | `methodologie/02_ecart_B_regles_de_bornage.md` |
| GB-17 | Réaction émotionnelle | `methodologie/02_ecart_B_regles_de_bornage.md` |
| GB-18 | Coût minimisé | `methodologie/02_ecart_B_regles_de_bornage.md` |
| GB-19 | Notes des contacts précédents | `methodologie/02_ecart_B_regles_de_bornage.md` |
| GB-20 | Raisons d'absence : priorité et pluralité | `methodologie/02_ecart_B_regles_de_bornage.md` |
| GB-21 | Tours fusionnés | `methodologie/02_ecart_B_regles_de_bornage.md` |
| GB-22 | Expression clé | `methodologie/02_ecart_B_regles_de_bornage.md` |
| GB-23 | Marqueur de citation | `methodologie/02_ecart_B_regles_de_bornage.md` |
| GB-24 | Chiffres | `methodologie/02_ecart_B_regles_de_bornage.md` |
| GB-25 | Correction | `methodologie/02_ecart_B_regles_de_bornage.md` |
| GB-26 | Validation avec les mots du prospect | `methodologie/02_ecart_B_regles_de_bornage.md` |
| GB-27 | Plusieurs sources possibles | `methodologie/02_ecart_B_regles_de_bornage.md` |
| GB-28 | Choisir A | `methodologie/02_ecart_B_regles_de_bornage.md` |
| GB-29 | Choisir B | `methodologie/02_ecart_B_regles_de_bornage.md` |
| GB-30 | Choisir P (un seul blocage) | `methodologie/02_ecart_B_regles_de_bornage.md` |
| GB-31 | Conformité d'une restitution à la formule | `methodologie/02_ecart_B_regles_de_bornage.md` |
| GB-32 | Blocages de la feuille de route | `methodologie/02_ecart_B_regles_de_bornage.md` |
| GB-33 | Avertissement du Copilote | `methodologie/02_ecart_B_regles_de_bornage.md` |
| GB-34 | D'un seul tenant | `methodologie/02_ecart_B_regles_de_bornage.md` |

## Présentation · ancres, segments, étapes, feuille de route, affirmations, promesses, adhésion

| Règle | Ce qu'elle borne | Fichier |
|---|---|---|
| PB-1 | Début de la présentation | `methodologie/03_presentation_B_regles_de_bornage.md` |
| PB-2 | Mention de l'offre (pas un début de présentation) | `methodologie/03_presentation_B_regles_de_bornage.md` |
| PB-3 | Premier prix | `methodologie/03_presentation_B_regles_de_bornage.md` |
| PB-4 | Fin de la présentation | `methodologie/03_presentation_B_regles_de_bornage.md` |
| PB-5 | Présentation sur deux appels | `methodologie/03_presentation_B_regles_de_bornage.md` |
| PB-6 | Limites des segments | `methodologie/03_presentation_B_regles_de_bornage.md` |
| PB-7 | Étiquette d'un segment | `methodologie/03_presentation_B_regles_de_bornage.md` |
| PB-8 | Ce qu'est un lien | `methodologie/03_presentation_B_regles_de_bornage.md` |
| PB-9 | Ce qui n'est pas un lien | `methodologie/03_presentation_B_regles_de_bornage.md` |
| PB-10 | Données d'entrée | `methodologie/03_presentation_B_regles_de_bornage.md` |
| PB-11 | Point de contrôle | `methodologie/03_presentation_B_regles_de_bornage.md` |
| PB-12 | Pas un point de contrôle | `methodologie/03_presentation_B_regles_de_bornage.md` |
| PB-13 | Réponse avec contenu | `methodologie/03_presentation_B_regles_de_bornage.md` |
| PB-14 | Adhésion | `methodologie/03_presentation_B_regles_de_bornage.md` |
| PB-15 | Pas d'adhésion | `methodologie/03_presentation_B_regles_de_bornage.md` |
| PB-16 | Le geste avant l'adhésion | `methodologie/03_presentation_B_regles_de_bornage.md` |
| PB-17 | Mention non sollicitée | `methodologie/03_presentation_B_regles_de_bornage.md` |
| PB-18 | Montants hypothétiques et fourchettes | `methodologie/03_presentation_B_regles_de_bornage.md` |
| PB-19 | Prix avant la présentation | `methodologie/03_presentation_B_regles_de_bornage.md` |
| PB-20 | Données hors de la transcription | `methodologie/03_presentation_B_regles_de_bornage.md` |
| PB-21 | Normalisation des nombres | `methodologie/03_presentation_B_regles_de_bornage.md` |
| PB-22 | Doute sur le marché | `methodologie/03_presentation_B_regles_de_bornage.md` |
| PB-23 | Reformuler pour vérifier la compréhension | `methodologie/03_presentation_B_regles_de_bornage.md` |
| PB-24 | Projection utilisée pour repousser | `methodologie/03_presentation_B_regles_de_bornage.md` |
| PB-25 | Questions fermées d'adéquation et échelles | `methodologie/03_presentation_B_regles_de_bornage.md` |
| PB-26 | Tours fusionnés | `methodologie/03_presentation_B_regles_de_bornage.md` |
| PB-27 | Catégorie de P | `methodologie/03_presentation_B_regles_de_bornage.md` |
| PB-28 | Étape 1 | `methodologie/03_presentation_B_regles_de_bornage.md` |
| PB-29 | Étape 2 | `methodologie/03_presentation_B_regles_de_bornage.md` |
| PB-30 | Étape 3 | `methodologie/03_presentation_B_regles_de_bornage.md` |
| PB-31 | Étape 4 | `methodologie/03_presentation_B_regles_de_bornage.md` |
| PB-32 | Ordre | `methodologie/03_presentation_B_regles_de_bornage.md` |
| PB-33 | Phrases | `methodologie/03_presentation_B_regles_de_bornage.md` |
| PB-34 | Feuille de route | `methodologie/03_presentation_B_regles_de_bornage.md` |
| PB-35 | Affirmations hors de son écart ou de l'offre | `methodologie/03_presentation_B_regles_de_bornage.md` |
| PB-36 | Promesse de résultat | `methodologie/03_presentation_B_regles_de_bornage.md` |
| PB-37 | Présentation avant le oui | `methodologie/03_presentation_B_regles_de_bornage.md` |

## Objections · résistance, nature, épisode, gestes, résolution, prévention

| Règle | Ce qu'elle borne | Fichier |
|---|---|---|
| OB-1 | Candidate | `methodologie/04_objections_B_regles_de_bornage.md` |
| OB-2 | Exclusions à la détection | `methodologie/04_objections_B_regles_de_bornage.md` |
| OB-3 | Nature : tests de frontière | `methodologie/04_objections_B_regles_de_bornage.md` |
| OB-4 | Passages mixtes | `methodologie/04_objections_B_regles_de_bornage.md` |
| OB-5 | Une résistance sur plusieurs tours | `methodologie/04_objections_B_regles_de_bornage.md` |
| OB-6 | Début | `methodologie/04_objections_B_regles_de_bornage.md` |
| OB-7 | Réponse | `methodologie/04_objections_B_regles_de_bornage.md` |
| OB-8 | Changement de sujet | `methodologie/04_objections_B_regles_de_bornage.md` |
| OB-9 | Réaction | `methodologie/04_objections_B_regles_de_bornage.md` |
| OB-10 | Latente | `methodologie/04_objections_B_regles_de_bornage.md` |
| OB-11 | Récurrence | `methodologie/04_objections_B_regles_de_bornage.md` |
| OB-12 | Locuteurs | `methodologie/04_objections_B_regles_de_bornage.md` |
| OB-13 | Accueillir | `methodologie/04_objections_B_regles_de_bornage.md` |
| OB-14 | Isoler | `methodologie/04_objections_B_regles_de_bornage.md` |
| OB-15 | Explorer | `methodologie/04_objections_B_regles_de_bornage.md` |
| OB-16 | Geste de réponse adapté | `methodologie/04_objections_B_regles_de_bornage.md` |
| OB-17 | Résolution | `methodologie/04_objections_B_regles_de_bornage.md` |
| OB-18 | Avant le prix | `methodologie/04_objections_B_regles_de_bornage.md` |
| OB-19 | Supposition | `methodologie/04_objections_B_regles_de_bornage.md` |
| OB-20 | Exploration elliptique | `methodologie/04_objections_B_regles_de_bornage.md` |
| OB-21 | Recadrage de l'état d'esprit sur une anxiété | `methodologie/04_objections_B_regles_de_bornage.md` |
| OB-22 | Recevoir et repartir dans le même tour | `methodologie/04_objections_B_regles_de_bornage.md` |
| OB-23 | Engagement sur une réponse proposée | `methodologie/04_objections_B_regles_de_bornage.md` |
| OB-24 | Anxiété niée | `methodologie/04_objections_B_regles_de_bornage.md` |
| OB-25 | Raison extérieure qui limite aussi le temps | `methodologie/04_objections_B_regles_de_bornage.md` |
| OB-26 | Attribution | `methodologie/04_objections_B_regles_de_bornage.md` |
| OB-27 | Portée : seulement après le premier prix | `methodologie/04_objections_B_regles_de_bornage.md` |

## Règles d'exclusion
Chaque fichier de bornage se termine par un tableau d'exclusions (« Ne compte jamais comme… », X1, X2, …) et un tableau de
paires minimales (deux passages qui ne diffèrent que par un élément et changent le verdict). Les paires minimales sont
implémentées comme tests unitaires dans `moteur/tests/`.
