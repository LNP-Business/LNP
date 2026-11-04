# Agent de qualification des leads (SQL) · LNP

Mise en œuvre du document « Qualification SQL des appels LNP — version 2 » (4 novembre 2026, d'après les critères MQL et
SQL proposés par Samy Mkacher le 27 octobre 2026, à valider par Antoine et le Head of Sales).

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
