# CLAUDE.md · système d'analyse des appels de vente LNP

Tu travailles sur le système d'analyse des appels de vente de LNP. Lis ce fichier en premier, à chaque session.

## Ce que fait le système
Il lit la transcription d'un appel de vente et évalue quatre compétences du commercial : **la découverte SPIN**, **la
formalisation de l'écart**, **la présentation de l'offre** et **le traitement des objections**. Chaque résultat est une note
sur 100, des niveaux par item avec des citations exactes comme preuves, et des verdicts (écart présent ou absent,
présentation conforme ou non conforme). Les résultats s'affichent par appel (écran d'analyse d'appel) et par période
(écran de performance).

## La règle qui prime sur tout
**Le modèle extrait et cite ; le code décide et note.**
- Aucune consigne ne demande au modèle une note, un niveau ou un verdict. Le modèle répond à une question fermée sur une
  unité, en JSON, et appuie chaque réponse positive sur une citation exacte et un numéro de tour.
- Le code vérifie chaque citation : extrait exact du tour cité, dit par le rôle attendu, dans la phase attendue (Partie C, C3).
  Une réponse invalide est redemandée une fois, puis l'unité passe « à revoir » (`to_review`) et sort des notes.
- Trois lectures indépendantes par unité ; en cas de désaccord, l'arbitre décide en suivant les règles, jamais par un vote ;
  si rien ne permet de trancher, l'unité est « à revoir » (Partie C, C4).
- Les mots exacts du prospect sont la colonne vertébrale : les reformulations sont vérifiées avec la règle du mot pour mot (GB-22).

## Tout est en français (Romain, 2026-11-19)
« Tout ce qui touche à l'analyse d'appel de vente doit être écrit et codé en français. »
- Le code (noms des modules, des fonctions, des variables, des classes), les commentaires, la documentation, les tests et les
  **consignes envoyées au modèle** sont en français. Les noms du code sont sans accents (`decouverte`, `ecart`, `presentation`).
- Les listes de mots du code (approbations, queues de validation, marqueurs d'objection…) contiennent les tournures françaises,
  à côté des tournures anglaises des transcriptions de référence des tests.
- **Le format de l'analyse enregistrée ne change pas** (choix de Romain, 2026-11-19) : l'écran d'analyse, la fiche du lead, le
  connecteur Claude et les fonctions SQL lisent des clés anglaises (`results`, `status`, `verdict`, `items`, `quote`, `turn`…).
  Les objets du moteur ont des champs français ; `vers_dict` (`noyau/modeles.py`) les écrit sous leur clé enregistrée
  (`CHAMPS_ENREGISTRES`). Restent aussi en anglais, parce qu'ils sont enregistrés ou comparés : les codes de raison et de signal,
  les statuts (`verified`, `arbitrated`, `to_review`), les identifiants de tâche (`spin.register`, `lite.s1_discovery`), les
  versions (`lnp_callqa-1.0`, `callqa-lite-1.0`), les valeurs fermées (`SITUATION`, `PAIN`, `money`, `OUT`…), les rôles des tours
  (`SALES`, `PROSPECT`, `OTHER`) et les schémas JSON des réponses du modèle (gardées telles quelles dans le journal d'audit).
- Un nouveau champ d'un objet enregistré s'ajoute à `CHAMPS_ENREGISTRES` avec sa clé enregistrée.

## Sources de vérité (dans cet ordre)
1. `docs/methodologie/` : notation (A), **règles de bornage (B)** et cas de calibration (C) par compétence, plus
   `00_regles_communes_partie_C.md`. `docs/INDEX_DES_BORNES.md` liste chaque règle de bornage et où elle se trouve.
2. `docs/memos/` : les mémos LNP lisibles par une personne (PDF), un par compétence.
3. `moteur/` : l'implémentation de référence (Python, bibliothèque standard seulement).
4. `docs/ARCHITECTURE.md`, `docs/CONTRAT_DE_SORTIE.md`, `docs/SPEC_ECRAN.md`, `docs/DECISIONS_OUVERTES.md`.
Si le code et la méthodologie ne disent pas la même chose, la méthodologie l'emporte : corriger le code et ajouter un test.

## Jamais
- Inventer un fait métier : un seuil, un poids, un prix, le texte d'un mécanisme, un cas client, un identifiant de modèle. S'il
  manque : constante de configuration, signal, et entrée dans `docs/DECISIONS_OUVERTES.md`.
- Laisser le modèle donner une note, un niveau ou un verdict ; sauter les vérifications de citation pour « économiser des appels ».
- Changer une règle sans mettre à jour, dans le même changement : la méthodologie, le moteur, les tests (et dire quel mémo doit
  être mis à jour).
- Utiliser les cas de test de la calibration pour régler une consigne ou un seuil (Partie C, C7).
- Comparer des notes calculées avec des versions de règles différentes ; tout renoter quand la version change (C8).
- Écrire « closer » ou « closing » : toujours « le commercial », « conclure », « vente ».
- Mettre la clé du modèle ou des transcriptions avec des données personnelles dans le dépôt ou dans les journaux.
- Changer le format de l'analyse enregistrée sans accord de Romain (écran, base et connecteur le lisent).

## Plan du moteur (`moteur/lnp_analyse`)
`noyau/modeles.py` modèle de données et `vers_dict` · `noyau/texte.py` vérification des citations, règle du mot pour mot,
nombres, phrases · `noyau/client_modele.py` client du modèle (réel et simulé) · `noyau/executeur.py` lectures, nouvelle
demande, arbitrage, audit · `noyau/fondation.py` lecture de la transcription, diarisation, réparation de l'attribution, carte
des phases · `noyau/notation.py` · `noyau/agregation.py` périodes · `competences/{spin,ecart,presentation,objections}.py` ·
`consignes/*.md` (une par tâche du modèle, 30 tâches, plus `systeme_commun.md` en tête de chacune) · `chaine_analyse.py`
ordre fixe : fondation → SPIN → écart → présentation → objections, et `enregistrement_resultat` (l'analyse enregistrée).

## Moteur allégé (`allege/analyse_allegee`, 2026-11-03)
Cinq étapes sur l'appel entier (phases, découverte, écart, présentation, objections après le premier prix), au palier rapide,
une seule lecture ; le code vérifie chaque citation et reprend le code de décision du moteur complet (compétences écart et
présentation inchangées, par `adaptateur.ExecuteurEtape`). Choisi par analyse avec `crm_ca_config.engine = 'lite'`. Lire
d'abord `allege/README.md` (les approximations).

## Exécutant et qualification
`executant/executer.py` tourne chaque heure dans `.github/workflows/analyse-appel.yml` : il prend les analyses en attente
(`crm_ca_claim`), lance le moteur choisi (`executant_analyse/travail.py`), passe par la fonction Edge `callqa-llm`
(`executant_analyse/passerelle.py`) et enregistre le résultat (`crm_ca_store`). Chaque R1 analysé est aussi qualifié
(`executant_analyse/qualif.py`, règle des portes de `qualification/`).

## Commandes
```
cd moteur && pip install pytest && python3 -m pytest -q tests           # doit rester vert
CALLQA_CORPUS=<dossier des NNN/transcript_compact.txt> python3 -m pytest -q tests   # cas de l'annexe B sur un autre corpus
python3 -m lnp_analyse.chaine_analyse transcription.txt --config appel.json   # un appel, modèle réel (anthropic + clé)
cd allege && python3 -m pytest -q tests                                  # moteur allégé
cd executant && python3 -m pytest -q tests                               # exécutant
cd qualification && python3 -m pytest -q tests                           # qualification
```
Sans les vraies transcriptions (`moteur/tests/fixtures/transcripts/`, jamais dans le dépôt), `CALLQA_SKIP_MISSING_CORPUS=1`
compte comme ignorés les tests de l'annexe B qui les lisent. La CI les télécharge depuis le stockage privé `callqa-fixtures`.
