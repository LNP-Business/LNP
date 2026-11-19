# Décisions ouvertes et contradictions connues

Rien dans cette liste ne peut être inventé par la personne qui implémente. Chaque point reste une constante configurable ou
un cas signalé `uncovered_case` (cas non couvert) jusqu'à ce que le responsable de la méthodologie (Romain) décide. Quand une
décision est prise, mettre à jour dans le même changement : le fichier de méthodologie, le mémo, la constante ou la règle du
moteur, et les tests.

## A. Données à fournir (bloquant pour la production)
1. ~~Identifiants des modèles pour les paliers~~ décidé le 2026-10-25 (Romain) : `fast` (rapide) = `claude-haiku-5-5`,
   `strong` (fort) = `claude-sonnet-5-5`, `arbiter` (arbitre) = `claude-opus-5-5`, enregistrés dans `crm_ca_config`. La clé
   de l'API est un secret des fonctions Supabase (`ANTHROPIC_API_KEY`), jamais dans le code.
2. Référence de l'offre : prix et modes de paiement, garanties, composantes, phases, et **les neuf mécanismes**
   (Compétence, Légitimité, Tarification, Acquisition, Vente, Réalisation, Temps, Échec passé, Risque financier) : pour
   chacun, le principe en une phrase, la phase de l'offre qui le porte, les indices lexicaux.
3. Bibliothèque de cas : cas clients avec l'indicateur de consentement, point de départ (valeur, unité, profil), chiffres ;
   la règle de correspondance entre le point de départ d'un cas et le A du prospect (`case_match_factor`, pour l'instant None).
4. Correspondance des locuteurs pour chaque source d'enregistrement ; métadonnées de l'appel (tour, identifiant du cycle
   pour relier les appels de suivi).

## B. Décisions de méthodologie (propositions en place, « à valider »)
- Poids et seuils de chaque compétence (SPIN 15/20/30/20/15 ; écart 10/10/10/20/25/25 ; présentation 15/20/15/15/10/15/10 ;
  traitement des objections 25/10/20/35/10, prévention 40/40/20, combinaison 70/30, poids anxiété/inertie 1,5).
- Sévérité de la non-conformité de la présentation : note 0 (actuel) ou plafond à 40.
- Écart : seuil du mot pour mot (un mot principal exact pour la porte ou 3 mots consécutifs) ; transformations permises ;
  B seulement à partir des réponses N ; départage de P ; un B sans horizon peut-il atteindre G2 = 2 ; une restitution entre
  le début de la présentation et le premier prix (proposition : ne peut pas réussir) ; « d'un seul tenant » tolère les
  relances d'écoute (« ouais », « mm-hmm ») à l'intérieur de la restitution (lecture actuelle).
- Feuille de route : ordre dans lequel les blocages doivent tomber ; le blocage traité dans la présentation est-il aussi une
  étape de la feuille de route (3 ou 4 blocages pour une feuille de route en 3 étapes) ; sens du contrôle de la page
  « pas de lien ».
- Gestes face aux objections : décidé le 2026-10-25 (Romain) : **A · I · E · M** (accueillir, isoler, explorer, geste de
  réponse adapté), et non plus l'ancien A · I · C.
- Classement des blocages de la présentation : 4 des 7 vrais blocages du jeu de calibration n'entrent dans aucune des neuf
  catégories (peur du changement, trop réfléchir, « ne pas le traiter comme un besoin », manque d'argent).
- Règles de volume minimal (5 appels évaluables ; SPIN au moins 5 questions codées), objectifs d'accompagnement.
- Registres SPIN (v1.2, Romain 2026-10-27) : les quatre registres et leurs domaines sont décidés ; décidé le même jour :
  les sollicitations OUT n'ont pas de registre ; SPIN s'arrête à la présentation (SB-34 remplace les réouvertures SB-3 /
  SB-4) ; pas de jeu de vérification annoté par des personnes pour l'instant. Décidé le 2026-10-29 (v1.3, SB-35) : une
  question ouverte prend le registre de la réponse du prospect. Encore ouvert : les listes de mots de SB-30.

## C. Contradictions entre les règles et les cas de calibration (le moteur suit la règle la plus récente)
- SPIN : SB-24 (la fréquence seule n'est pas quantifiée) contre le cas 9 de la calibration B2 ; SB-19 (l'écho « A lot? »
  (« Beaucoup ? ») compte comme une relance) contre le cas 4 de B4 ; SB-18 contre SB-20 sur ce qui casse une chaîne (SB-20
  l'emporte) ; les listes de domaines du § 2 et du § 4 diffèrent.
- Écart : appel 129 — GB-17 dit que « Why do you have to go saying that? » (« Pourquoi tu dois dire ça ? ») est confirmé
  avec contenu, B3.10 dit non validé ; appel 098 — GB-14 peut placer la restitution avant la présentation, B1.11 la place
  après ; B3.7 contre GB-20 sur `restitution_after_pitch` (constante du moteur
  `RAISON_APRES_PRESENTATION_EXIGE_PASSAGE = False`).
- Présentation : cas 5 de la calibration (appel 102) contre PB-17 ; les cas 8, 9, 10 et 14 disent « aucune règle » mais
  PB-18/19/20 les couvrent désormais ; un cas cité sans consentement est-il aussi `out_of_gap_claim` ?
- Objections : cas 13, 17 et 24 de la calibration contre OB-20 (exploration elliptique) et OB-21 (recadrage de l'état
  d'esprit = partiel) ; l'exclusion X7 doit être reformulée ; « what if it doesn't work? » (« et si ça ne marche pas ? »)
  est classé anxiété · choix mais le test de frontière 1 donne objection · confiance ; une anxiété dite pendant la découverte
  peut être notée dans l'écart ou la présentation et dans les objections ; comment « deux citations pour le niveau 2 »
  s'applique aux items oui/non.
- Phases (Romain 2026-11-03) : SB-1 (la découverte se termine à la validation de l'écart qui le rend présent) et l'ajout à
  PB-3 (le premier prix va avec l'explication de l'offre ; une introduction n'est jamais le début de la présentation) ne
  s'appliquent que dans le moteur allégé ; le moteur de référence termine encore la découverte au début de la présentation
  ou au prix, et décide du prix avec sa bande de vraisemblance PB-18 (référence de l'offre non configurée : crm_ca_offer
  est vide).
- Objections, OB-27 (Romain 2026-11-03 : seulement après le premier prix) : les cas de calibration (04_objections_C) et les
  tests de l'annexe B dont la résistance vient avant le premier prix de l'appel n'ouvrent plus d'épisode et doivent être
  relus ; le cas 25 (appel 044) a besoin du tour du premier prix de l'appel dans son test. Le mémo des objections demande la
  même mise à jour.
- Tous les verdicts de la calibration sont des propositions jusqu'à ce que deux annotateurs certifiés les confirment à
  l'aveugle.

## D. Interprétations du moteur à confirmer (mises en place comme constantes ou choix documentés)
- Présentation : K2 plafonné à 1 sans la référence du mécanisme ; affirmations de calcul acceptées quand un des opérandes est
  le chiffre du prospect ; affirmations dont les données de référence manquent signalées `unchecked` (non vérifiée, sans
  faire échouer la porte) ; K6 niveau 2 demande un prix puis la demande de décision après lui ; K7 projection unique : le
  geste du commercial sert de seconde citation.
- Écart : G1 = 2 pour un A quantifié quand B est absent ou non quantifié ; « dit d'abord par le commercial » (X12)
  appliqué aux chiffres et aux expressions de plusieurs mots seulement ; repêchage GB-19 (notes du setter reprises par le
  prospect) non implémenté ; le `type` du problème n'est pas produit.
- Objections : les items H au niveau de l'appel prennent l'épisode le plus faible ; H5 sur plusieurs appels lit les épisodes
  précédents dans `entrees_anterieures` (clé enregistrée `prior_inputs`) et est signalé provisoire ; les réactions « autre »
  sont notées comme accueillies et étiquetées ; la règle de changement de sujet OB-8 (a) est stricte (les épisodes se
  terminent souvent à la résistance suivante) — à vérifier par rapport à l'objectif de fiabilité.
- SPIN : seul un P ouvre une chaîne profonde ; des unités empilées sans réponse ne cassent pas une chaîne ; l'exception des
  questions empilées est tranchée par les mots partagés.

## E. Moteur allégé (`analyse-appel/allege`, 2026-11-03) : approximations à confirmer
Le moteur allégé (`crm_ca_config.engine = 'lite'`, cinq étapes sur l'appel entier au palier rapide, objectif 0,10 USD par
appel) garde la règle « le modèle cite, le code décide » et le code de décision du moteur, avec ces approximations (détails
dans `analyse-appel/allege/README.md`) :
- Une seule lecture par fait, pas d'arbitre (C4 exige 95 % de reproductibilité avant de passer à une seule lecture) :
  résultats `single_reading` (lecture unique), qui restent provisoires jusqu'à ce que le moteur allégé et le moteur complet
  soient comparés sur les mêmes appels.
- Preuve invalide écartée item par item (un atome, une proposition, une affirmation ou un geste non prouvé compte comme non
  dit / non fait) au lieu d'une nouvelle demande de l'unité (C3 règle 7) ; seule une réponse JSON invalide est redemandée
  une fois.
- Pas de contrôle de l'attribution par le modèle (C1) : seulement la porte de diarisation du code.
- SPIN : la lettre est la lecture des portes par le modèle, avec les règles strictes du code (queue de validation, question
  de bénéfice fermée) ; le découpage est la liste du modèle ; même objet (SB-16) = mêmes libellés d'objet + le contrôle
  lexical ; SB-21 laissé à la raison OUT du modèle ; accord sur le registre (SB-33) non mesuré.
- Écart : X13 lu dans le genre du chiffre de l'atome (sans genre = présent) ; la question qui arrête (GB-30) est un signal
  de S1.
- Objections (Romain 2026-11-03) : seulement après le début de la présentation, chaque objection une fois ; les reprises
  après son épisode sont une récurrence (H5 = 0) ; deux natures dans un même passage (OB-4) fusionnées quand elles partagent
  une citation ; le changement de sujet (OB-8) est lu une fois par le modèle et vérifié par le code ; les échéances détectées
  (OB-2, OB-25) n'alimentent pas la prévention.
- Langue (Romain, 2026-11-19) : les consignes envoyées au modèle sont en français, et les listes de mots du code
  (approbations, queues de validation, changement de personne de GB-22, mots vides) reçoivent les tournures françaises, à
  côté des tournures anglaises des transcriptions de référence des tests.
- Écran : le tableau des objections montre la première citation de chaque objection ; `episodes[].quotes` garde les autres.
