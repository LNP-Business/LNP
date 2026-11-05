# Agent de qualification des leads (SQL) · LNP

Mise en œuvre du document « Qualification SQL des appels LNP — version 2 » (4 novembre 2026, d'après les critères MQL et
SQL proposés par Samy Mkacher le 27 octobre 2026, à valider par Antoine et le Head of Sales).

**Version 2.1 (5 novembre 2026)** : `qualification_lnp.py` et `tests/check_rules.py` sont ceux de Romain (28 cas). Un
enseignant de l'Éducation nationale ouvre la porte Métier quelle que soit sa matière ; un étudiant qui vend déjà des cours
particuliers est qualifié ; un lead « solution aware » (compare d'autres offres ET a pris ou prévoit un rendez-vous avec
l'une d'elles) est qualifié d'office sur les quatre portes. La consigne d'extraction gagne le bloc `concurrence` et la
catégorie `matiere_education_nationale` (prompt `lnp-sql-v2.1-2026-11-05`).

**Version 2.2 (5 novembre 2026, Romain)** : la porte « Douleur et projet » est supprimée (douleur, intention, revenu visé,
échéance ne sont plus extraits ni vérifiés). Trois portes : Métier, Financement, Décision et timing (prompt
`lnp-sql-v2.2-2026-11-05`, règles `qualification_lnp-v2.2`, 29 cas). L'analyse reste lancée à la main (pas de mise en file
automatique, Romain 2026-11-03 et 2026-11-05).

**Dans l'analyse d'appel (046)** : chaque R1 analysé est qualifié par le worker de l'analyse
(`call-analysis/worker/callqa_worker/qualif.py`), sur les mêmes répliques que l'analyse ; le résultat est gardé avec l'analyse
et s'affiche dans l'écran d'analyse d'appel (section « Qualification du lead ») et sur la pastille du prospect. Le workflow
`qualification.yml` reste pour requalifier à la main (`--again`).

- **Étape 1, extraction** (`prompts/extraction.md`, la consigne du document, telle quelle) : le modèle lit la transcription
  Fathom du R1 et rapporte des faits avec verbatim et minutage. Il ne décide rien. Deux lectures : paliers `fast` puis
  `strong` de `crm_ca_config` (aujourd'hui le même modèle ; le document recommande deux modèles différents).
- **Contrôle des preuves** (`agent.py`, en plus du document) : un fait dont la preuve n'est pas un passage de la
  transcription repasse à « inconnu » (une ressource sans preuve est retirée) ; chaque cas est listé dans `verification`.
- **Étape 2, règle** (`qualification_lnp.py`, le script du document, inchangé ; paramètres en tête du fichier) : les quatre
  portes, puis le statut (SQL GAGNÉ, SQL OUVERT, SQL PERDU, NON SQL, MQL EN ATTENTE, À REVOIR), les champs de la BASE, les
  alertes et la confiance. Deux lectures en désaccord sur une porte → porte non vérifiée → À REVOIR.
- **Saisie comparée** : l'issue saisie dans iClosed (WON → Closé ; UNQUALIFIED / BAD_FIT → Pas pitché + Pas qualifié ;
  NOT_INTERESTED → Perdu ; FOLLOW_UP_SCHEDULE → FUP court) déclenche l'alerte « Écart avec la saisie ».
- **Leads traités** : le dernier R1 passé et non annulé de chaque lead, du plus récent au plus ancien, sans les fiches de test
  de l'équipe (`crm_qualif_candidates`, migration 042). Résultats : `crm_lead_qualifications` (un enregistrement par passage).

Lancer : GitHub › Actions › lead-qualification › Run workflow (nombre de leads, 30 par défaut). Le dépôt est public : le
journal ne montre que des identifiants d'appel, des statuts et des nombres de jetons.

Tests : `cd call-analysis/qualification && python3 -m pytest -q tests` (les 19 cas du script et les tests de l'agent).
