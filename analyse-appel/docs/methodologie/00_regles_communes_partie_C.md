# Partie C · Le moteur d'évaluation (commun aux quatre compétences)

Cette partie est identique dans les quatre documents de méthodologie (SPIN, Écart, Présentation de l'offre, Objections). Elle définit comment le système lit un appel, comment il prouve ce qu'il affirme et comment les notes de chaque appel deviennent une note sur une période. Une règle propre à une compétence l'emporte toujours sur cette partie quand les deux diffèrent ; ces différences sont dites explicitement dans les parties A et B.

Dans tout le document, les rôles des tours de parole s'écrivent comme dans la transcription : `SALES` (le commercial), `PROSPECT` (le prospect) et `OTHER` (une autre personne).

## C1. Entrées et conditions préalables

| Entrée | Exigence | Si elle manque |
|---|---|---|
| Transcription | Transcription complète de l'appel, une entrée par tour de parole, avec l'horodatage (mm:ss ou h:mm:ss) et l'étiquette du locuteur | L'appel n'est pas évalué (statut `no_transcript`) |
| Attribution des locuteurs | Chaque étiquette rattachée à `SALES`, `PROSPECT` ou `OTHER` (codécideur, assistant) | L'appel n'est pas évalué (statut `no_diarization`) |
| Métadonnées de l'appel | `call_id`, `sales_id`, heure de début de l'appel en UTC, fuseau horaire du commercial, type d'appel (premier appel, relance) | L'appel est exclu des calculs par période |
| Référence de l'offre | Offre en cours : nom, composants, prix et modalités de paiement, garantie | Présentation de l'offre et Objections tournent avec des contrôles réduits et reçoivent le signal `offer_reference_missing` |
| Version des règles | La version de ce document appliquée (par exemple `SPIN-1.0`) | Interdit : chaque résultat doit porter une version |

**Porte de qualité de l'attribution des locuteurs.** Avant toute analyse, le code calcule la part des mots attribués à chaque rôle. Un appel où un rôle a plus de 92 % des mots, ou où le prospect a moins de 150 mots, reçoit le signal `diarization_suspect` et est exclu de la notation (il reste visible dans la liste des appels). **Contrôle de l'attribution.** Avant le bornage, le modèle lit chaque tour en regard de son étiquette et signale trois cas, chacun avec une citation : (1) **tour fusionné** : un tour qui contient la parole de l'autre rôle (par exemple une question du commercial ou une queue « ..., non ? » au début ou à la fin d'un tour du prospect) ; (2) **tour inversé** : un contenu qui ne peut appartenir qu'à l'autre rôle (le nom du commercial lui-même, l'offre décrite à la première personne, les faits personnels du prospect dits à la première personne sous une étiquette `SALES`) ; (3) **écho** : la même phrase répétée sous les deux étiquettes à moins de 3 tours d'écart. Le code coupe alors un tour fusionné à la limite citée et réétiquette la partie concernée, réétiquette un tour inversé et supprime la copie en écho. Un tour qui ne peut pas être réparé ainsi est marqué `attribution_doubtful` et est exclu de tout calcul où le locuteur compte. Un appel où plus de 10 % des tours sont réparés ou douteux reçoit le signal `diarization_suspect` (seuil à valider).

## C2. Chaîne de traitement

Le moteur suit une règle : **le modèle extrait et cite, le code décide et note.** Aucun modèle de langage ne produit jamais une note, un niveau ou un verdict final. Il répond seulement à des questions fermées (oui / non / une valeur d'une liste fermée) et appuie chaque réponse positive sur une citation exacte.

| Étape | Qui | Ce qu'elle fait | Résultat |
|---|---|---|---|
| S0 Normalisation | Code | Recolle les lignes coupées, normalise les espaces et les guillemets, numérote les tours `T001…`, garde les horodatages | Liste normalisée des tours |
| S1 Inventaire | Code | Repère les unités d'analyse de la compétence (questions, restitutions, segments de la présentation de l'offre, épisodes d'objection) selon des règles de segmentation écrites. Rien n'est supprimé : les unités douteuses sont gardées avec des attributs | Liste des unités |
| S2 Bornes | Modèle, contrôlé par le code | Place les ancres de phase (début de la découverte, première restitution, première présentation de l'offre, premier prix, conclusion) avec le numéro du tour et une citation exacte | Carte des phases |
| S3 Portes | Modèle | Répond aux questions fermées de la compétence pour chaque unité, avec une citation exacte pour chaque réponse positive | Réponses aux portes |
| S4 Contrôle d'ancrage | Code | Vérifie que chaque citation est une sous-chaîne exacte du tour cité, dite par le rôle attendu | Réponses valides ou invalides |
| S5 Décision | Code | Applique les règles de décision de la partie B dans leur ordre fixe ; la première règle qui s'applique l'emporte | Verdicts par item |
| S6 Reproductibilité | Code | Compare trois passes indépendantes de S3 ; les désaccords partent en arbitrage | Statut de concordance |
| S7 Notation | Code | Calcule les niveaux des items, la note de l'appel et sa liste de preuves | Résultat de l'appel |
| S8 Agrégation | Code | Calcule les notes par période, les volumes, les intervalles de confiance et les écarts entre périodes | Résultat de la période |

## C3. Règles de preuve

1. **Citation exacte.** Chaque réponse positive à une porte porte une citation de 2 à 40 mots copiée caractère pour caractère depuis un tour. Comparaison normalisée : sans tenir compte des majuscules, espaces regroupés, guillemets et apostrophes droits et typographiques considérés comme égaux. Les erreurs de transcription sont gardées telles quelles ; elles ne sont jamais corrigées.
2. **Le bon locuteur.** Une citation qui prouve ce que le prospect a dit doit venir d'un tour `PROSPECT`. Une citation qui prouve une action du commercial doit venir d'un tour `SALES`. Une citation venant du mauvais rôle invalide la réponse.
3. **Le bon endroit.** Une citation doit se trouver dans le tour que le modèle cite, et à l'intérieur de la phase que la règle exige (par exemple « avant la première présentation de l'offre »). Le code vérifie le numéro du tour sur la carte des phases.
4. **Deux citations pour le niveau le plus haut.** Tout item noté au niveau 2 doit être appuyé par deux citations distinctes (deux tours différents, ou deux passages qui ne se chevauchent pas). Une seule citation plafonne l'item au niveau 1.
5. **Une approbation n'est pas une preuve.** Un tour du prospect dont le seul contenu est un accord (« oui », « exactement », « c'est vrai », « c'est sûr », « mm-hmm », « à 100 % » ; en anglais « yes », « exactly », « right », « that's true », « for sure », « mm-hmm », « 100 % ») ne prouve jamais rien d'autre qu'un accord, et seulement là où une règle demande explicitement un accord.
6. **Les mots du commercial ne sont pas les mots du prospect.** Un contenu que le commercial a énoncé et que le prospect a seulement approuvé reçoit l'étiquette `prompted_by_sales` et ne compte jamais comme une chose dite par le prospect. La seule exception est l'**ancrage** : quand le commercial reprend un mot que le prospect avait déjà dit, ce mot appartient toujours au prospect.
7. **Traitement d'une réponse invalide.** Une réponse dont la citation échoue en S4 est rejouée une fois avec le message d'erreur. Si elle échoue encore, l'unité est marquée `to_review` (à revoir) et est exclue de toute note jusqu'à ce qu'une personne ou l'arbitre tranche.

## C4. Reproductibilité et arbitrage

- **Trois passes indépendantes.** L'étape S3 tourne trois fois sur chaque unité, avec la même consigne et les mêmes paramètres, sans qu'aucune passe ne voie les autres. Le code compare les verdicts par item qui en résultent.
- **Concordantes (3/3).** Le verdict est définitif, statut `verified`.
- **Divergentes (2/3 ou moins), ou citation invalide.** L'unité va à un **arbitre** : un appel distinct au modèle, qui n'a pas pris part aux trois passes, reçoit le règlement complet (ce document), l'unité, son contexte et les trois lectures, et tranche en parcourant les règles de décision dans l'ordre. Il ne vote jamais entre les lectures. Statut `arbitrated`, avec une justification d'une phrase et une étiquette de cas : `application_error` (une lecture n'a pas suivi une règle claire), `rule_ambiguity` (deux lectures se défendent avec le texte) ou `uncovered_case` (aucune règle ne tranche). Les deux dernières sont signalées au responsable de la méthodologie et alimentent la version suivante des règles.
- **Non tranchée.** Une unité que l'arbitre ne peut pas trancher reste `to_review` et est exclue des notes.
- **Option de coût.** Quand le volume rend trois passes trop chères, une seule passe est permise en production **seulement** si le protocole de reproductibilité (C7) a montré au moins 95 % de concordance par item sur la version des règles en cours, et trois passes continuent de tourner chaque semaine sur un échantillon aléatoire de 10 % des appels. Toute semaine où cet échantillon tombe sous 95 % rétablit trois passes sur chaque appel.

## C5. Périodes et agrégation

**Périodes.** L'écran propose trois périodes. Toutes sont calculées dans le fuseau horaire du commercial, sur l'heure de début de l'appel.

| Période | Définition | Période de comparaison pour l'écart |
|---|---|---|
| 7 derniers jours | De 00:00 six jours avant aujourd'hui jusqu'à maintenant (aujourd'hui compris, 7 jours calendaires) | Les 7 jours calendaires qui précèdent immédiatement |
| Ce mois-ci | Du 1er du mois calendaire en cours à 00:00 jusqu'à maintenant | Le mois calendaire précédent, de son 1er jusqu'au même numéro de jour (ou à son dernier jour s'il est plus court) |
| Tout | Tous les appels évalués du commercial, depuis le début | Pas d'écart |

**Appels évaluables.** Un appel entre dans la note de période d'une compétence seulement si son statut pour cette compétence est `scored`. Les appels de statut `not_applicable` (par exemple aucune objection n'a été soulevée), `excluded` ou `to_review` sont comptés et affichés, jamais moyennés.

**Note de la période.** La note de la période est la moyenne arithmétique des notes des appels évaluables de la période. Chaque appel pèse autant, quelle que soit sa durée.

**Taux par item.** Chaque item est aussi affiché comme un taux sur la période : la part des appels évaluables où l'item a atteint le niveau 2, et la part où il a atteint au moins le niveau 1.

**Volume minimal.** Avec moins de 5 appels évaluables, la note de la période s'affiche en gris avec la mention « volume insuffisant (n appels) » et aucun niveau n'est attribué. De 5 à 19 appels, la note s'affiche avec son intervalle de confiance à 95 %. À partir de 20 appels, l'intervalle est toujours calculé mais n'apparaît qu'au survol.

**Intervalle de confiance.** Intervalle à 95 % de la moyenne avec la loi de Student : moyenne ± t(0,975, n−1) × écart-type / √n, borné à [0, 100]. Pour les taux par item, on utilise l'intervalle de Wilson.

**Écart entre périodes.** Écart = note de la période − note de la période de comparaison, en points, affiché seulement si les deux périodes ont au moins 5 appels évaluables. Un écart dont la valeur absolue est inférieure à la moitié de la largeur de l'intervalle de confiance en cours s'affiche « stable ».

## C6. Niveaux et affichage

| Note | Niveau | Sens |
|---|---|---|
| 85 à 100 | Maîtrisé | Exécuté correctement sur presque chaque appel |
| 60 à 84 | En progrès | Exécuté, avec des manques récurrents |
| 0 à 59 | À travailler | Pas exécuté de façon fiable |

**Règle du plancher.** Si un item de la compétence a un taux de niveau 2 inférieur à 25 % sur la période, le niveau de la compétence ne peut pas dépasser « En progrès », quelle que soit la note. Cela empêche une moyenne de cacher un geste presque jamais fait.

**Point de blocage.** À l'écran, la compétence qui a la note de période la plus basse (parmi celles qui ont au moins 5 appels évaluables) porte la mention « Point de blocage n° 1 ». Les égalités sont départagées par le taux de niveau 2 le plus bas sur un seul item.

**Chaque nombre est cliquable.** Chaque niveau d'item de chaque appel ouvre ses preuves : les citations, leurs tours et horodatages, et l'extrait de la transcription autour (± 3 minutes).

## C7. Protocole de fiabilité

Aucun chiffre de précision n'est publié avant d'avoir été mesuré.

| Ce qui est mesuré | Méthode | Seuil |
|---|---|---|
| Accord humain sur les unités | Deux annotateurs certifiés segmentent les 3 mêmes appels séparément | ≥ 95 % d'unités identiques |
| Accord humain sur les items | Deux annotateurs notent les mêmes appels sans voir le travail de l'autre | Accord brut ≥ 85 % et κ de Cohen ≥ 0,80 par item |
| Machine contre référence | 30 vrais appels dont l'issue est connue, 20 pour la calibration, 10 pour le test, répartition figée avant l'annotation | Accord par item ≥ accord humain − 5 points |
| Reproductibilité | Même verdict sur 3 passes indépendantes | ≥ 95 % par item |
| Ancrage | Citations retrouvées mot pour mot dans la transcription | 100 % (tout le reste est un défaut) |
| Santé | Unités qu'aucune règle n'a pu trancher | ≤ 5 % par appel ; au-delà, l'appel n'est pas montré au commercial |

Tant que chaque seuil n'est pas atteint sur la version des règles en cours, chaque note porte la mention **« provisoire »** à l'écran. L'ensemble de test ne sert jamais à ajuster une règle, une consigne ou un seuil. Sous un seuil, on réécrit la règle ; jamais le seuil.

## C8. Versions et audit

- Chaque résultat d'appel garde la version des règles, l'identifiant du modèle, l'empreinte de la consigne, les trois passes brutes, la décision de l'arbitre s'il y en a une, et l'heure du calcul.
- Une note calculée avec une version des règles n'est jamais comparée à une note calculée avec une autre. Quand une version change, les appels passés de la période sont notés à nouveau avant qu'un écart ne s'affiche.
- Chaque arbitrage et chaque correction humaine est consigné avec : identifiant de l'unité, lectures, décision, étiquette de cas, auteur, date. Une personne peut corriger un verdict ; personne ne peut modifier à la main une note enregistrée.
