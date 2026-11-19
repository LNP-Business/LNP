# Moteur d'analyse des appels LNP · Architecture
_Spécification technique : comment un appel de vente devient quatre notes de compétence fiables et vérifiables (SPIN, écart, présentation de l'offre, objections)_

**Version :** version 1.0 · 25 octobre 2026  
**Statut :** brouillon à valider par le directeur technique et le responsable de la méthodologie. Les valeurs marquées « à valider » ou « à confirmer » sont des propositions ou des faits manquants.  
**Périmètre :** analyse après l'appel des appels de vente enregistrés. Applique les quatre documents de méthodologie : SPIN 1.1, écart 1.3, présentation 2.0, objections 1.1, et leur moteur commun (Partie C). Implémentation de référence : paquet Python `lnp_analyse`.  
# 1. La décision en une page

**Question.** Pour analyser des appels de vente avec une très grande fiabilité, le système doit-il être fait de quatre agents, un par compétence ?

**Réponse : non.** Le système est une **chaîne d'analyse fixe** à trois couches :
1. une **fondation commune**, calculée une fois par appel, que chaque compétence lit ;
2. de nombreuses **petites tâches du modèle**, chacune répondant à une question fermée sur une unité, avec des citations exactes ;
3. du **code déterministe** qui vérifie chaque citation et prend chaque décision et calcule chaque note.

**Pourquoi pas quatre agents.**
- **Les compétences dépendent les unes des autres.** L'écart choisit A, B et P à partir des lettres SPIN ; la présentation traite le P que l'écart a validé et n'est pas conforme si elle commence avant la validation de l'écart ; les objections ont besoin du premier prix et de la feuille de route. Quatre agents indépendants placeraient chacun différemment le début de la présentation, le prix ou le blocage : les quatre notes se contrediraient et ne pourraient pas être vérifiées.
- **La précision baisse avec la charge.** Un modèle qui lit d'un coup 25 pages de règles et une transcription de 90 minutes fait plus d'erreurs que de courts appels qui lisent chacun un passage et une section de règles.
- **Reproductibilité.** Une réponse fermée avec une citation peut être comparée sur trois lectures, redemandée, arbitrée et testée. Le verdict libre d'un agent ne le peut pas.

**Où un vrai agent est utilisé.** Seulement là où le travail est un raisonnement ouvert : l'**arbitre** (cas où les trois lectures ne sont pas d'accord ou où aucune règle ne tranche), la **synthèse d'accompagnement par période** et le **Copilote en direct** (un système à part qui lit les mêmes faits sur le prospect).

# 2. Principes

| # | Principe | Conséquence dans l'architecture |
|---|---|---|
| 1 | Le modèle extrait et cite ; le code décide et note | Aucune consigne ne demande une note, un niveau ou un verdict. Chaque sortie du modèle est une réponse fermée + une citation exacte + un numéro de tour |
| 2 | Un fait, un seul endroit | Les ancres des phases, les lettres SPIN, les atomes du prospect et le choix de l'écart sont calculés une fois et figés ; les étapes suivantes les lisent, ne les recalculent jamais |
| 3 | Les mots exacts du prospect | Chaque fait sur le prospect est une citation exacte vérifiée par le code ; les reformulations sont vérifiées avec la règle du mot pour mot (écart GB-22) |
| 4 | Petites unités, contexte court | Chaque tâche du modèle reçoit l'unité, une courte fenêtre de tours autour d'elle et seulement la section de règles dont elle a besoin |
| 5 | Mesuré avant d'être cru | Aucune note n'est affichée sans la mention « provisoire » tant que les seuils de fiabilité de la Partie C (C7) ne sont pas atteints sur la version actuelle des règles |
| 6 | Tout est versionné et rejouable | Chaque résultat garde la version des règles, l'identifiant du modèle, l'empreinte de la consigne, les trois lectures brutes et l'arbitrage |

# 3. Chaîne d'analyse

## 3.1 Étapes et dépendances

| Étape | Qui | Lit | Écrit | Méthodologie |
|---|---|---|---|---|
| F0 Lecture | Code | Transcription brute, correspondance des locuteurs | Tours numérotés T001… avec le rôle SALES (le commercial) / PROSPECT / OTHER | Partie C, C1, S0 |
| F1 Porte de diarisation | Code | Tours | Statut de l'appel (`no_transcript`, `no_diarization`, `diarization_suspect`) | C1 |
| F2 Contrôle de l'attribution | Modèle (rapide) + code | Tours, par blocs de 60 | Tours réparés : tours fusionnés coupés (`T050b`), inversés réétiquetés, échos exclus | C1 |
| F3 Carte des phases | Inventaire par le code + modèle (rapide) + décision du code | Tours du commercial avec des indices d'offre, de montant ou de décision | Début de la présentation, mentions de l'offre, premier prix, prix précoce, demande de décision, fin de la présentation | Annexe de la présentation PB-1 à PB-4, PB-17 à PB-19 |
| C1 SPIN | Code + modèle + code | Tours, carte des phases | Périmètre de la découverte, sollicitations avec leurs lettres, atomes du prospect avec leurs libellés d'objet ; résultat SPIN | SPIN 1.1, annexe A |
| C2 Écart | Code + modèle + code | Atomes, lettres, carte des phases | A, B, P choisis ; restitutions ; validation ; blocages de la feuille de route ; résultat de l'écart | Écart 1.3, annexe A |
| C3 Présentation | Code + modèle + code | Détails de l'écart, carte des phases, référence de l'offre, bibliothèque de cas | Étapes 1 à 4, mécanismes, affirmations, plage de la feuille de route ; résultat de la présentation | Présentation 2.0, annexe A |
| C4 Objections | Code + modèle + code | Carte des phases, détails de la présentation | Épisodes, gestes, résolutions, faits de prévention ; résultat des objections | Objections 1.1, annexe A |
| A1 Agrégation | Code | Résultats enregistrés des appels | Notes par période, intervalles, écarts, niveaux, goulot | C5, C6 |

L'ordre est fixe : F0 → F1 → F2 → F3 → C1 → C2 → C3 → C4. Une compétence ne replace jamais une ancre d'une étape précédente. Une panne dans une compétence met cette compétence « à revoir » (`to_review`) et n'arrête pas les autres.

## 3.2 La base commune des faits sur le prospect

La fondation et SPIN produisent les faits que toutes les autres étapes utilisent :

| Objet | Contenu | Utilisé par |
|---|---|---|
| Carte des phases | Numéros de tour du début et de la fin de la découverte, du début de la présentation, des mentions de l'offre, du premier prix, du prix précoce, de la demande de décision, de la fin de la présentation, avec leurs citations | Toutes |
| Sollicitations | Chaque sollicitation du commercial : texte, tour, lettre S / P / I / N / OUT, raison OUT, tours de réponse, relancée | SPIN, écart (A à partir de S et I, B à partir de N, P à partir de P) |
| Atomes | Chaque atome du prospect : type (SITUATION, PAIN, BLOCKER, IMPACT, DESIRE, VALUE), citation exacte, sollicitation et lettre, libellé d'objet, domaine, quantifié, valeur, unité, spontané, soufflé par le commercial | SPIN, écart, présentation |
| Détails de l'écart | Verdict, tour de validation, A / B / P choisis, P validé et son expression clé, citations du coût, blocages de la feuille de route | Présentation, Copilote |
| Détails de la présentation | Catégorie du P validé, étapes, plage de la feuille de route | Objections, Copilote |

Types d'atomes : SITUATION (situation), PAIN (douleur), BLOCKER (blocage), IMPACT (impact), DESIRE (désir), VALUE (valeur).

# 4. Tâches du modèle

## 4.1 Anatomie d'une tâche

Chaque tâche du modèle est définie par :
- **un identifiant** (par exemple `gap.validation`) et un **identifiant d'unité** déterministe (par exemple `restit:T081`), pour que les réponses puissent être mises en cache, comparées et redemandées ;
- **un palier** : `fast` (rapide) pour l'inventaire et les classements simples, `strong` (fort) pour les jugements fins, `arbiter` (arbitre) pour l'arbitrage (les identifiants des modèles relèvent de la configuration, à confirmer) ;
- **une consigne** : les règles système communes (règles de preuve de la Partie C, C3), la section de règles de l'annexe pour cette seule question, et l'unité avec une courte fenêtre de tours autour d'elle ;
- **un schéma JSON** de réponses fermées, chaque réponse positive avec `quote` (citation) et `turn` (tour) ;
- **une fonction de validation** (code) : chaque citation doit être un extrait exact du tour cité, dit par le rôle attendu, dans la phase attendue ; les nombres et les listes doivent appartenir à leurs ensembles fermés ;
- **une clé de concordance** : la partie de la réponse qui doit être la même dans les trois lectures (les champs qui comptent pour la décision, pas la formulation des citations).

## 4.2 Exécution d'une tâche

1. **Trois lectures indépendantes**, même consigne, température 0, aucune lecture ne voit les autres.
2. **Validation de chaque lecture par le code.** Une réponse invalide est redemandée **une fois** avec le message d'erreur (« pas un extrait », « mauvais locuteur », « hors de la phase »). Si elle échoue encore, cette lecture est invalide.
3. **Concordance.** Si les trois lectures sont valides et que leurs clés sont égales : statut `verified` (vérifié).
4. **Arbitrage** sinon : un appel à part (palier `arbiter`) reçoit la section de règles complète, l'unité, son contexte et les trois lectures ; il décide en suivant les règles dans l'ordre, jamais par un vote, et étiquette le cas `application_error` (erreur d'application), `rule_ambiguity` (ambiguïté de la règle) ou `uncovered_case` (cas non couvert). Statut `arbitrated` (arbitré). Les deux dernières étiquettes vont dans la liste de travail du responsable de la méthodologie.
5. **Non résolu :** statut `to_review` (à revoir) ; l'unité sort de toutes les notes jusqu'à ce qu'une personne décide.
6. **Option de coût (C4).** Une seule lecture n'est permise en production qu'une fois la reproductibilité arrivée à 95 % sur la version actuelle des règles ; les trois lectures continuent chaque semaine sur un échantillon aléatoire de 10 %, et toute semaine sous 95 % remet les trois lectures partout.

## 4.3 Catalogue des tâches (30 tâches, telles qu'implémentées)

Les identifiants de tâche restent en anglais : ils sont enregistrés dans le journal d'audit.

| Étape | Identifiant de la tâche | Unité | Question fermée (résumé) | Palier |
|---|---|---|---|---|
| F2 | `foundation.attribution` | Bloc de 60 tours | Tours fusionnés, inversés ou en écho, avec la partie étrangère citée (C1) | fast |
| F3 | `foundation.phases` | Un tour du commercial avec un indice d'offre, de montant ou de décision | Description de l'offre ? partage d'écran ? retour à la découverte ? prix de l'offre, montant, hypothétique, fourchette ? demande de décision ? (PB-1 à PB-4, PB-17 à PB-19) | fast |
| C1 | `spin.gates` | Une sollicitation | Les portes ordonnées de la référence SPIN (raisons OUT, S, N, I, P), chacune avec sa preuve ; le code décide de la lettre | fast (volume ; à valider sur les tests de régression) |
| C1 | `spin.atoms` | Une plage de réponse | Les atomes de la réponse du prospect : type, citation, objet, domaine, quantifié, valeur, unité (SB-5 à SB-24) | strong |
| C1 | `spin.link` | Deux sollicitations codées consécutives | Même objet ? (SB-16) | fast |
| C1 | `spin.reopen_end` | Une réouverture | Où la réouverture revient à l'offre (SB-3). Plus posée depuis la v1.2 (SB-34) | fast |
| C1 | `spin.register` | Une question codée de la découverte, avant la présentation | Sur quel domaine porte-t-elle ou, pour une question ouverte, de quel domaine parle sa réponse ? Le code en déduit un registre (SB-26 à SB-35) | fast |
| C2 | `gap.restitution` | Une restitution candidate | Restitution ou non ; chaque proposition avec sa composante, son tour source et son expression clé (GB-1 à GB-7, GB-22) | strong |
| C2 | `gap.validation` | Une restitution | Issue de la réponse du prospect, avec la citation (GB-8 à GB-10, GB-15 à GB-17, GB-26) | strong |
| C2 | `gap.a_current` | Un A quantifié candidat | Décrit-il le présent ? (GB-28, X13) | fast |
| C2 | `gap.stopping` | Sollicitations codées P | Le commercial demande-t-il ce qui arrête le prospect ? (GB-30) | fast |
| C2 | `gap.horizon` | Le B choisi | Échéance donnée par le prospect, impérative ou souhaitée | fast |
| C3 | `pitch.p_category` | Le P validé | Un des neuf blocages, ou inconnu (PB-27) ; une catégorie inconnue est toujours arbitrée | strong |
| C3 | `pitch.step1` à `pitch.step4` | Fenêtre de la présentation | Plage de chaque étape et ses champs : blocage, mécanismes et récitation, transformation, cas de preuve (PB-28 à PB-31) | strong |
| C3 | `pitch.roadmap` | Après l'étape 4 | Plage de la feuille de route et ses étapes (PB-34) | strong |
| C3 | `pitch.claims` | Blocs de 40 tours de la présentation | Chaque chiffre, cas, prix et garantie énoncé par le commercial (PB-35) | strong |
| C3 | `pitch.promises` | Blocs de 40 tours de la présentation | Promesses de résultat (PB-36) | strong |
| C3 | `pitch.adhesion` | Blocs de 40 tours de la présentation | Appropriation, projection concrète, nouveau lien, avec le geste qui précède (PB-14 à PB-16, PB-23, PB-24) | fast |
| C4 | `obj.nominate` | Blocs de tours | Résistances sans aucun marqueur (OB-1) | fast |
| C4 | `obj.resistance` | Une candidate | Exclusion tirée d'une liste fermée ; sujet de chaque doute, dont le code déduit la nature (OB-2 à OB-4, OB-24 à OB-26) | strong |
| C4 | `obj.topic` | Un tour du commercial que le code ne sait pas trancher | Nouveau sujet ou suite ? (OB-8 b, OB-22) | fast |
| C4 | `obj.acknowledge`, `obj.isolate`, `obj.explore` | Un épisode | Les trois gestes (accueillir, isoler, explorer), chacun avec sa citation (OB-13 à OB-15, OB-20) | fast |
| C4 | `obj.gesture` | Un épisode | Faits de la réponse utilisés pour le geste de réponse adapté (OB-16, OB-21) | strong |
| C4 | `obj.resolution` | Un épisode | Genre de réaction du prospect, tiré d'une liste fermée (OB-17, OB-23) | strong |
| C4 | `obj.prevention` | Tours avant le premier prix | Décideur, personnes qui influencent, budget, échéance, tentative passée (OB-18, OB-19) | strong |
| Toutes | arbitre | Toute unité divergente | Même schéma + justification + étiquette du cas | arbiter |

Mesuré sur un vrai appel (appel 001, 204 tours) avec un modèle simulé vide, la chaîne envoie au modèle 4 blocs d'attribution, 13 candidats de phase, 131 sollicitations, 62 plages de réponse, 12 restitutions candidates, 4 blocs de nomination des résistances et 3 résistances candidates : environ 690 appels au modèle avec trois lectures, avant les arbitrages, les nouvelles demandes et les tâches de la présentation (le modèle simulé n'a trouvé aucune présentation). Ce chiffre est le premier facteur de coût et la première cible du levier de regroupement (§ 7).

## 4.4 Ce que le code décide (jamais le modèle)

- Chaque vérification de citation (extrait, locuteur, phase) et chaque normalisation de nombre (PB-21).
- Chaque ordre : limites du périmètre, restitution avant la présentation et le prix, présentation après la validation, étapes 1 → 4 → feuille de route → prix → décision.
- La lettre SPIN à partir des réponses aux portes ; les choix de A, B et P de l'écart (GB-28 à GB-30) ; la vérification mot pour mot de chaque expression clé (GB-22).
- Chaque porte et chaque exclusion : porte d'absence de l'écart et ses raisons ; porte de conformité de la présentation ; épisodes latents ; récurrences.
- Chaque niveau d'item, chaque note d'appel, chaque note de période, intervalle, écart, niveau et goulot.

# 5. Données et stockage

## 5.1 Données d'entrée par appel

| Donnée | Contenu | Si elle manque |
|---|---|---|
| Transcription | Une entrée par tour de parole, horodatage, étiquette du locuteur | `no_transcript` |
| Correspondance des locuteurs | Étiquette → SALES / PROSPECT / OTHER | `no_diarization` |
| Métadonnées de l'appel | identifiant de l'appel, identifiant du commercial, heure de début en UTC, fuseau horaire du commercial, type d'appel, identifiant du cycle (pour relier les appels de suivi) | exclu des fenêtres de période |
| Référence de l'offre | Nom, composantes, phases, prix et modes de paiement, garanties, les neuf mécanismes (principe, phase, indices) | La présentation signale `offer_reference_missing` ou `mechanism_reference_missing` |
| Bibliothèque de cas | Cas clients avec l'indicateur de consentement, point de départ (valeur, unité, profil) et chiffres | Étape 4 de la présentation `not_applicable`, signal `case_library_missing` |
| Données antérieures | Texte du formulaire de candidature tapé par le prospect, appels précédents du même cycle | Écart GB-19 : les notes du setter ne sont jamais une source mot pour mot |

## 5.2 Enregistré pour chaque appel (C8)

L'enregistrement de l'appel garde : les tours réparés, la carte des phases, la base commune des faits, le résultat de chaque compétence (statut, verdict, raisons, items avec leurs preuves, note, signaux, détails), et l'**audit** : pour chaque lecture du modèle, l'identifiant de la tâche, l'identifiant de l'unité, le palier, l'empreinte de la consigne, la réponse brute et les erreurs de validation ; chaque arbitrage avec sa justification et l'étiquette du cas ; chaque correction humaine avec son auteur et sa date. Une note enregistrée n'est jamais modifiée à la main : une personne corrige un verdict, le code renote.

## 5.3 Versions

Une note calculée avec une version des règles n'est jamais comparée à une note calculée avec une autre. Quand une version des règles change (par exemple présentation 1.1 → 2.0), les appels des fenêtres affichées sont renotés avant d'afficher un écart. Les fichiers de consignes sont versionnés avec les règles ; l'empreinte de la consigne est gardée avec chaque lecture.

# 6. Programme de fiabilité

| Couche | Quoi | Seuil | Quand |
|---|---|---|---|
| Tests unitaires | Chaque paire minimale des quatre sections de l'annexe A, comme tests de décision sur des appels synthétiques | 100 % verts | À chaque commit |
| Régression de la calibration | Chaque vrai cas de l'annexe B, rejoué avec les réponses enregistrées du modèle | 100 % des verdicts attendus | À chaque changement de règle, de consigne ou de modèle |
| Régression en direct | Cas de l'annexe B relancés avec le modèle réel | ≥ 95 % des verdicts attendus | À chaque changement de consigne ou de modèle |
| Jeu de référence | 30 vrais appels annotés par deux annotateurs certifiés, 20 de calibration / 10 de test, partage figé | Accord par item ≥ accord humain − 5 points | Avant de retirer « provisoire » |
| Reproductibilité | Même verdict sur trois lectures | ≥ 95 % par item | Chaque semaine sur un échantillon de 10 % |
| Ancrage | Citations retrouvées mot pour mot | 100 % | À chaque appel (un échec est un défaut) |
| Santé | Unités qu'aucune règle n'a pu trancher | ≤ 5 % par appel | À chaque appel |

La partie test du jeu de référence ne sert jamais à ajuster une règle, une consigne ou un seuil. Sous un seuil, on réécrit la règle ; jamais le seuil.

# 7. Paliers du modèle, coût et délai

- **Paliers.** `fast` (rapide) pour le contrôle de l'attribution, les ancres des phases, les inventaires et les classements simples ; `strong` (fort) pour les portes, les atomes, les restitutions, les validations, les catégories de P, les étapes, les affirmations, les gestes et les résolutions ; `arbiter` (arbitre) pour l'arbitrage. Les identifiants des modèles relèvent de la configuration (à confirmer).
- **Volume par appel.** Le nombre d'appels au modèle est : (nombre d'unités) × 3 lectures + arbitrages + nouvelles demandes. Mesuré sur les 95 appels du corpus de référence déjà traités (du 10e au 90e centile, médiane entre parenthèses) : 101 à 452 tours par appel (265), donc 2 à 8 blocs d'attribution de 60 tours ; 39 à 219 sollicitations du commercial sur tout l'appel (135), dont seules celles du périmètre de la découverte sont codées ; 5 à 29 candidats de phase avec les listes d'indices actuelles (18). La présentation ajoute environ six tâches sur une fenêtre. Les restitutions et les résistances candidates n'ont pas encore été comptées : elles sont mesurées pendant le pilote, comme le coût par appel (non estimé ici).
- **Leviers quand le coût compte.** Regrouper les unités d'une même étape dans une seule consigne quand les tests de fiabilité ne montrent aucune perte (à valider tâche par tâche) ; mettre en cache la consigne système et les sections de règles ; appliquer l'option de coût à une seule lecture seulement après avoir atteint le seuil de reproductibilité.
- **Coût mesuré (2026-10-26, premiers vrais appels, avant les leviers ci-dessous).** Environ 5 à 10 USD par appel de 75 000 à 120 000 caractères (≈ 800 à 1 200 questions) : Sonnet `strong` ≈ 50 %, Opus `arbiter` ≈ 46 %, Haiku `fast` ≈ 4 %. L'essentiel venait de la réflexion du modèle (facturée comme sortie, 800 à 1 200 jetons pour une réponse JSON d'environ 150) et de la consigne de l'unité envoyée en entier à chacune des trois lectures. La consommation par palier est gardée sur chaque travail (`crm_ca_jobs.usage`).
- **Étape de coût 1 (Romain 2026-10-28, objectif ≤ 3 USD par appel).** Aucun changement de règle : les trois lectures, l'arbitre et chaque vérification de citation restent. (1) Effort `low` sur chaque question (`output_config.effort`, passerelle `callqa-llm` ; la réponse est une question JSON fermée). (2) La consigne d'une lecture est marquée pour le cache, et l'exécutant envoie la lecture 1 (et les arbitrages) avant les lectures 2 et 3 du même tour de traitement, pour que les lectures 2 et 3 lisent la consigne dans le cache. Attendu : ≈ 3,5 USD pour un appel type, à mesurer sur les prochains vrais travaux. Étape 2, si besoin et sur décision de Romain : l'arbitre sur le modèle `strong`, ou l'API Batch (moitié prix, résultats en quelques heures).
- **Mesuré après l'étape 1 (2026-10-28, les mêmes appels).** 7,10 → 3,65 USD et 10,15 → 4,40 USD (−54 % sur les cinq appels) ; notes inchangées ou proches, deux résultats de présentation ne sont plus `to_review`. L'arbitre est désormais la plus grosse part (≈ 58 %). Le registre d'une question SPIN (SB-33) n'a pas atteint la porte d'accord de 92 % sur les deux appels (84,6 %, 90 %) : `spin.register` est posée à l'effort `medium` (`EFFORT_TACHE` dans la passerelle de l'exécutant, `executant_analyse/passerelle.py` ; palier rapide, quelques centimes par appel).
- **Stabilité (2026-10-28).** Le même appel a donné des résultats différents d'une exécution à l'autre à l'effort low (Amber Peterson : analysé, puis exclu comme `diarization_suspect` ; accord sur le registre de Jaci Sung 90 % puis 80 % ; coût de Jaci 4,40 puis 6,05 USD). La fondation (attribution, phases) garde l'effort par défaut du modèle (`EFFORT_TACHE`), puisqu'une mauvaise réponse à cet endroit exclut tout l'appel. L'exécution de l'exécutant prend une entrée `effort` (`low` ou `default`, `CALLQA_EFFORT`), gardée dans `crm_ca_jobs.usage.effort`, pour comparer les deux sur les mêmes appels avant de décider.
- **Étape de coût 2 (LNP, Romain 2026-11-03, objectif ≤ 0,10 par appel).** Aucun changement de règle. Mesuré avant elle, sur six appels LNP à l'effort low : environ 3,1 USD par appel (Opus `arbiter` ≈ 58 %, Sonnet `strong` ≈ 36 %, Haiku `fast` ≈ 5 %), environ 540 questions par appel, 340 000 jetons de sortie par appel (surtout de la réflexion), et 258 arbitrages pour 940 unités posées trois fois : concordance au niveau des items ≈ 73 %, sous les 95 % dont l'option à une lecture de C4 a besoin. (1) Chaque palier sur `claude-haiku-5-5` (`crm_ca_config.tiers`). (2) Effort `none` : réflexion coupée sur chaque question (la passerelle `callqa-llm` envoie `thinking: {type: "disabled"}`), sauf pour la fondation (attribution, phases), qui garde l'effort par défaut du modèle (`executant_analyse/passerelle.py`, entrée `effort` du workflow, `none` par défaut). (3) Une question n'est marquée pour le cache que si une autre lecture la pose à nouveau. Ensuite, mesurer sur de vrais appels le coût et la concordance : si la concordance atteint 95 % (C7), `crm_ca_config.passes = 1` active l'option à une lecture de C4 (`executant_analyse/travail.py` : une lecture, 10 % des unités encore avec trois) ; sinon le levier suivant est l'API Message Batches (−50 %).
- **Moteur allégé (2026-11-03, `analyse-appel/allege`, objectif de Romain ≤ 0,10 USD par appel).** Mesuré avant lui :
  3,12 USD par appel avec Sonnet / Opus, 0,22 USD avec chaque palier sur Haiku et la réflexion coupée, et alors SPIN
  `excluded`, davantage de présentations `to_review`, 65 % de concordance entre les lectures. Le moteur allégé pose cinq
  questions sur l'appel entier au lieu d'environ 540 petites posées trois fois : S0 carte des phases, S1 chaque question de
  la découverte avant la présentation (lettre SPIN, registre, la réponse du prospect et ses atomes), S2 l'écart restitué,
  S3 la présentation, S4 les objections après la présentation (chacune une fois, A · I · E · M) et les faits de
  prévention. Un seul modèle (`tiers.fast`, claude-haiku-5-5), effort `low` ; les règles système et la transcription
  forment un préfixe en cache commun aux cinq appels (champ `prefix` de la passerelle, jusqu'à 16 000 jetons de sortie).
  Le code vérifie chaque citation et lance le code de décision du moteur de référence : `decider_phases`, les fonctions
  SPIN des atomes, des chaînes et des items, `CompetenceEcart` et `CompetencePresentation` inchangées (leurs questions
  fermées reçoivent leurs réponses à partir des étapes et sont vérifiées par leurs propres validateurs), les fonctions des
  gestes, de la résolution et de la prévention des objections. Estimation pour un appel de 60 minutes (15 000 jetons de
  transcription) : environ 0,02 USD, 0,03 avec une nouvelle demande. Approximations (une seule lecture, pas d'arbitre, pas
  de contrôle de l'attribution, objections seulement après la présentation) : `analyse-appel/allege/README.md` et
  `docs/DECISIONS_OUVERTES.md` § E. Choisi par travail avec `crm_ca_config.engine` (`full` par défaut, migration 035).
- **Robustesse.** Une réponse dont un validateur ne sait pas lire la forme (un objet là où une liste est attendue) est une réponse invalide (C3 règle 7 : redemandée une fois, puis `to_review` pour cette unité), jamais une panne de la compétence (`executeur._verifier`).
- **Délai.** Analyse après l'appel, pas en direct : les étapes s'enchaînent, les unités d'une même étape tournent en parallèle. Objectif : résultats disponibles dans l'heure qui suit l'enregistrement (à valider).

# 8. Interfaces

| Utilisateur | Ce qu'il lit | Quand |
|---|---|---|
| Écran de performance (un seul écran, quatre compétences) | Résultats par période et par commercial : note, intervalle, niveau, écart, taux par item, goulot, preuves de chaque item | À la demande, par fenêtre (7 jours, ce mois-ci, tout) |
| Carte de l'appel | Résultats de l'appel avec leurs preuves : citations, tours, horodatages, extrait de la transcription ± 3 minutes | Au clic |
| Copilote (présentation en direct) | La même base de faits sur le prospect pendant l'appel : A, B, P choisis, catégorie du P validé, blocages de la feuille de route, chiffres manquants (« À demander ») | En direct ; un système à part avec ses propres contraintes de délai |
| Responsable de la méthodologie | Liste de travail des arbitrages : `rule_ambiguity` et `uncovered_case` avec leurs citations | Chaque semaine |
| Administration › Preuves manquantes | Appels pour lesquels aucun cas client correspondant n'existait, par catégorie de P et par point de départ | Chaque semaine |

# 9. Implémentation de référence

Le paquet Python `lnp_analyse` (dossier `moteur/lnp_analyse`) implémente cette architecture sans aucune dépendance externe (le SDK Anthropic est facultatif, pour les exécutions réelles).

| Chemin | Contenu |
|---|---|
| `noyau/modeles.py` | Modèle de données : `Tour`, `Preuve`, `CartePhases`, `Sollicitation`, `Atome`, `NoteItem`, `ResultatCompetence`, `ContexteAppel` |
| `noyau/texte.py` | Comparaison normalisée, vérification des citations exactes (C3), tours d'approbation seule, normalisation des nombres (PB-21), règle du mot pour mot (GB-22), découpage en phrases (PB-33) |
| `noyau/client_modele.py` | Interface du client du modèle ; client réel (paliers en configuration) ; client simulé qui rejoue les réponses enregistrées |
| `noyau/executeur.py` | Tâches du modèle ; trois lectures, validation, nouvelle demande, concordance, arbitrage, audit |
| `noyau/fondation.py` | Lecture de la transcription, porte de diarisation, contrôle et réparation de l'attribution, carte des phases |
| `noyau/notation.py` | Niveaux des items, règle des deux citations, note de l'appel avec la répartition des poids sans objet |
| `noyau/agregation.py` | Fenêtres, note de période, intervalles de Student et de Wilson, écart, niveaux, règle du plancher, goulot |
| `competences/spin.py`, `ecart.py`, `presentation.py`, `objections.py` | Inventaire, tâches du modèle et code de décision de chaque compétence |
| `consignes/` | Règles système communes et un fichier de règles par tâche du modèle |
| `chaine_analyse.py` | L'ordre fixe des étapes, l'enregistrement de l'appel, un point d'entrée en ligne de commande |
| `tests/` (`moteur/tests/`) | Tests du noyau, paires minimales et cas de l'annexe B par compétence |

**Ce qu'il ne contient pas encore :** la configuration du modèle réel (identifiants des modèles, clé de l'API), la référence de l'offre et ses neuf mécanismes, la bibliothèque de cas, la couche de stockage et les écrans. Ce sont les prérequis du déploiement ci-dessous.

# 10. Feuille de route du déploiement

| Phase | Contenu | Critère de sortie |
|---|---|---|
| 1 · Prérequis | Identifiants des modèles par palier et accès à l'API ; correspondance des locuteurs depuis l'outil d'enregistrement ; référence de l'offre avec les neuf mécanismes (principe, phase, indices) ; bibliothèque de cas avec consentement et points de départ ; métadonnées de l'appel avec l'identifiant du cycle | Toutes les données du § 5.1 disponibles pour 10 vrais appels |
| 2 · Construction | Implémentation de référence branchée sur le modèle réel ; stockage des enregistrements d'appel ; fichiers de consignes relus face aux annexes | La chaîne tourne de bout en bout sur 10 appels sans erreur du moteur |
| 3 · Tests | Régression de la calibration et régression en direct sur l'annexe B ; première mesure de la reproductibilité ; liste des arbitrages relue | Annexe B ≥ 95 % avec le modèle réel ; reproductibilité mesurée par item |
| 4 · Jeu de référence | Deux annotateurs certifiés sur 30 appels ; calibration sur 20 ; test sur 10 | Seuils de C7 atteints sur la partie test |
| 5 · Pilote | Notes montrées seulement au responsable de la méthodologie et au responsable commercial, marquées « provisoire » ; revue hebdomadaire des désaccords | Deux semaines de suite sans nouveau `uncovered_case` fréquent |
| 6 · Autonomie croissante | Notes montrées aux commerciaux ; option de coût à une lecture si la reproductibilité ≥ 95 % ; échantillon hebdomadaire de 10 % | Échantillon hebdomadaire ≥ 95 % |
| 7 · Pilotage continu | Versions des règles, renotation à chaque changement de version, preuves manquantes, liste des arbitrages, protocole de changement de modèle (régression en direct avant tout changement) | En continu |

# 11. Décisions ouvertes

- Identifiants des modèles pour les paliers `fast`, `strong` et `arbiter` (à confirmer).
- Regrouper ou non plusieurs unités d'une étape dans une seule consigne (à valider tâche par tâche avec les tests de régression).
- Délai visé après l'enregistrement (proposition : dans l'heure, à valider).
- Stockage et hébergement des enregistrements d'appel et des audits (à confirmer avec le directeur technique).
- Toutes les décisions listées dans la section 10 ou 11 de chaque document de méthodologie (poids, seuils, les neuf mécanismes, la règle de correspondance des cas).
