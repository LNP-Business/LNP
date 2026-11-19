# Analyse d'appel · plan d'intégration

État : plan approuvé par Romain le 2026-10-25 (PR #54). Phase 1 fusionnée ; phase 2 (données et exécutant) dans sa PR.
Document historique : ce qui est décrit était vrai à la date du plan. Les chemins et les noms ont été mis à jour le 2026-11-19
(dossier `call-analysis/` renommé `analyse-appel/`, noms du code en français) ; les tables, les fonctions SQL, les valeurs
enregistrées et les noms des paliers (`fast`, `strong`, `arbiter`) n'ont pas changé.

Objectif (Romain) : dès qu'un appel de vente est terminé, son analyse s'ouvre depuis le **Pipeline** du CRM, depuis la **liste
des prospects** et depuis **Cycle de vente** quand l'appel est choisi dans le cycle.

## 0. Décisions (Romain, 2026-10-25)

| N° | Décision |
|---|---|
| Q1 | Paliers : `fast` = `claude-haiku-5-5`, `strong` = `claude-sonnet-5-5`, `arbiter` = `claude-opus-5-5` (ligne `crm_ca_config`, modifiable sans toucher au code) |
| Q2 | « Il y a déjà une clé Anthropic ». Elle n'est **pas** dans les secrets des fonctions Supabase (vérifié le 2026-10-25 : seulement `FATHOM_API_KEY` et `FATHOM_WEBHOOK_SECRET`) ; il faut l'y ajouter sous le nom `ANTHROPIC_API_KEY`. L'exécutant ne la détient jamais : il appelle la fonction Edge `callqa-llm`, qui la détient. |
| Q3 | Les documents de méthodologie ont été envoyés : ce sont les notes déjà rangées dans `docs/memos/` (à la date du plan). La note de la présentation de l'offre dit elle-même que le contenu des neuf mécanismes est « à fournir » : la référence d'offre reste vide (`crm_ca_offer`), la présentation de l'offre est analysée avec `offer_reference_missing` / `mechanism_reference_missing`. |
| Q4 | Laissé au choix de Claude : la bibliothèque de cas commence vide (`crm_ca_cases`, remplie plus tard par les administrateurs) ; aucun cas n'est inventé, étape 4 de la présentation de l'offre = `case_library_missing`. |
| Q5 | Fathom : la clé API et le secret du webhook sont déjà dans les secrets Supabase → la phase 4 peut lire les enregistrements. |
| Q6 | Les 15 vraies transcriptions vont dans le bucket Storage privé `callqa-fixtures` (`transcripts.tar.gz`) ; la CI les télécharge avec le rôle de service. |
| Q7 | L'analyse est lue par les administrateurs du CRM et par le commercial propriétaire du cycle, sur ses propres appels (`crm_ca_can_read`). |
| Q8 | Gestes face aux objections : **A · I · E · M**. |
| Q9 | Appels de vente R1 et R2 seulement, jamais les appels d'intégration (onboarding) ni d'étude de cas (nom de l'événement iClosed ; `crm_ca_call_info`). |

## 1. Ce qui existait dans le dépôt (2026-10-25)

| Sujet | État |
|---|---|
| Moteur | Alors `call-analysis/engine/`, aujourd'hui `analyse-appel/moteur/` (paquet `lnp_analyse`, Python 3.11+, bibliothèque standard seulement). Les 205 tests passaient en local avec les transcriptions de test (Python 3.13). |
| Transcriptions de test | Les 15 vraies transcriptions (`moteur/tests/fixtures/transcripts/`) et la maquette `docs/screen/` (vrai appel 001) ne sont **pas dans le dépôt** : le CLAUDE.md du moteur interdit d'y mettre des transcriptions contenant des données personnelles. Sans elles, 157 tests passaient, 20 échouaient et 5 étaient ignorés (les cas de l'annexe B). Voir la question Q6. |
| Appels | `crm_calls` (rendez-vous iClosed) a déjà `transcript`, `fathom_recording_id`, `recording_url`, `summary_md`. Tous vides : aucune transcription n'est jamais arrivée. |
| Fathom | Le webhook `fathom-in` ne fait que stocker les requêtes brutes. Fathom n'a jamais envoyé de vrai appel (une ligne de test). Il n'y a pas encore de mapper : c'est la phase 4 de `docs/crm/06`. |
| Table d'analyse | `crm_call_analyses` (003) existe et est vide. Sa grille v0 (`docs/crm/09`) est remplacée par ce moteur. |
| Écrans | Cycle de vente a déjà une fenêtre « Analyse d'appel » (`anHTML` dans `gen_crm.py`). Dans l'édition web, elle dit qu'aucune analyse n'existe encore pour cet appel. Le document du CRM (`crm_doc.html`) contient le tableau (Pipeline) et la liste des prospects. |
| Hébergement | Vercel (fonctions Node, 800 s au plus), Supabase (Postgres, fonctions Edge Deno, 400 s au plus) et GitHub Actions. |

## 2. Où tourne le moteur

Un appel demande environ **700 appels au modèle** (3 passes) avant l'arbitrage : une fonction Vercel ou Edge dépasserait son
délai. **Choix : le moteur Python de référence, sans modification, lancé par un exécutant GitHub Actions.**

- `.github/workflows/analyse-appel.yml` (alors `call-analysis.yml`) :
  - à chaque push qui touche `analyse-appel/` : les 205 tests ;
  - toutes les 10 minutes, et à la demande : `analyse-appel/executant/executer.py` (alors `worker/run.py`), qui prend les
    travaux en file et les traite.
  - Un travail peut durer jusqu'à 6 h, et un passage planifié sans travail en file ne coûte que quelques secondes.
- L'exécutant lit et écrit dans Supabase avec le rôle de service, par les fonctions `crm_ca_claim`, `crm_ca_store` et
  `crm_ca_fail`. Ses appels au modèle passent par la fonction Edge `callqa-llm`, qui détient la clé du modèle.
- Secrets, posés par Romain, jamais dans la conversation ni dans le dépôt : un secret GitHub, `SUPABASE_SERVICE_ROLE_KEY`, et un
  secret des fonctions Supabase, `ANTHROPIC_API_KEY`. L'adresse du projet n'est pas secrète : elle est écrite dans le workflow.
- La planification est toutes les heures, à la minute 7, ce qui borne les minutes GitHub Actions du dépôt privé (environ 720 par
  mois), et à la demande depuis Actions. Un passage sans travail en file prend quelques secondes.
- Les identifiants de modèle par palier viennent d'une ligne de configuration (`crm_ca_config`), pas du code (Q1).
- **Vitesse.** L'exécuteur du moteur est séquentiel. Un seul changement dans `noyau/executeur.py` (alors `core/runner.py`) :
  les trois passes d'une unité tournent dans des fils d'exécution parallèles.
  - Ce changement ne touche aucune règle, aucune consigne, aucune décision ; les 205 tests le gardent.
  - Il ajoute aussi le cache de consigne : les règles communes et les règles de la tâche sont envoyées avec `cache_control`.
  - Attendu : environ 15 à 25 minutes par appel (la cible de l'architecture est moins d'une heure).
  - Faire tourner en parallèle les unités d'une même étape est un levier pour plus tard, qui modifierait les modules des
    compétences.
- **Coût.** Non estimé dans le paquet. Le premier vrai appel le mesure (les jetons sont gardés par passe), et le chiffre est
  donné avant de traiter des appels en nombre.

## 3. Données (migration `020_crm_call_analysis.sql`)

| Table | Contenu | Sécurité par ligne |
|---|---|---|
| `crm_calls` (existante) | Ajout de `transcript_raw`, `speaker_map jsonb`, `transcript_source` (`upload`, `fathom`), `timezone` | Comme aujourd'hui |
| `crm_ca_jobs` | Un par analyse lancée : appel, statut (`queued`, `running`, `done`, `failed`), versions du moteur et des règles, tentatives, erreur, jetons, coût, horaires | Lue comme l'appel ; écrite par l'exécutant seulement |
| `crm_ca_turns` | Tours réparés de la dernière analyse : identifiant (`T050b`…), horodatage, rôle, intervenant, texte, réparé, douteux | Lue comme l'appel |
| `crm_ca_results` | Une ligne par appel × compétence : version des règles, statut, verdict, raisons, note, items avec leurs preuves, détails JSON, concordance | Lue comme l'appel |
| `crm_ca_records` | L'enregistrement complet de l'appel (`enregistrement_resultat`, alors `result_record`) : phases et signaux. L'écran le lit en une requête. | Lue comme l'appel |
| `crm_ca_audit` | Chaque passe du modèle, chaque nouvel essai, chaque arbitrage (classement du cas, justification) et chaque correction humaine | Administrateurs seulement |
| `crm_ca_offer` | Référence d'offre versionnée : prix, options, garanties, composantes, phases, les neuf mécanismes | Lecture : membres ; écriture : administrateurs |
| `crm_ca_cases` | Bibliothèque de cas : accord du client, point de départ (valeur, unité, profil), chiffres | Lecture : membres ; écriture : administrateurs |
| `crm_ca_config` | Identifiant de modèle par palier, passes, l'interrupteur « provisoire » | Administrateurs |

- « Lue comme l'appel » veut dire : tous les cycles pour les administrateurs, les responsables commerciaux et les lecteurs ; ses
  propres cycles pour un commercial (comme dans 017).
- `crm_call_analyses` est supprimée, parce qu'elle est vide et n'a jamais servi.
- Une nouvelle analyse ne modifie jamais une note enregistrée : une correction humaine est une ligne d'audit, suivie d'une
  nouvelle notation (C8).

## 4. Arrivée des transcriptions et travail

1. **« Ajouter une transcription »** (phase 3, disponible en premier). Bouton dans la fenêtre d'analyse d'un appel passé.
   - Coller le texte ou déposer un fichier : un export Fathom, le format `[T001 00:06] SALES: …` (SALES est le commercial), ou
     `Nom (00:06): texte`.
   - Puis la **correspondance des intervenants** : chaque libellé devient Commercial, Prospect ou Autre. Le libellé qui
     correspond au commercial de l'appel est prérempli ; les autres sont demandés quand il y a un doute.
   - RPC `crm_ca_add_transcript(call_id, raw, speaker_map)` : administrateurs et propriétaire de l'appel. Elle enregistre la
     transcription, met le travail en file et écrit un événement `transcript_added`.
2. **Fathom, automatique** (phase 4 du CRM). Mapper `_shared/mappers/fathom.ts` dans `process-inbox`, comme le prévoit
   `docs/crm/06` §4–5.
   - L'appel est retrouvé par l'e-mail de l'invité externe et à ± 90 min du rendez-vous.
   - La correspondance des intervenants vient des données Fathom : un intervenant dont l'e-mail appartient à un membre de
     l'équipe est Commercial, un invité externe est Prospect, toute autre personne est Autre. En cas de doute, le travail attend
     une correspondance faite par une personne.
   - Puis le même travail est mis en file.
   - Historique Fathom : `crm-import ?source=fathom[&dry=1]` lit `GET /meetings` avec les transcriptions, essai à blanc d'abord.
   - Il faut : `FATHOM_API_KEY` et le secret du webhook dans les secrets Supabase (Q5).
3. **Travail de l'exécutant** (`executant/executant_analyse/travail.py`, alors `job.py`).
   - Prise avec `for update skip locked`, puis construction du `ContexteAppel` (alors `CallContext` ; `construire_contexte`).
   - Métadonnées : rang = rang de l'appel, identifiant du cycle, commercial = propriétaire ou hôte, début en UTC, fuseau horaire
     du commercial.
   - Entrées : la référence d'offre et la bibliothèque de cas en vigueur, et les appels précédents du cycle dans
     `entrees_anterieures` (alors `prior_inputs`).
   - Lancer `analyser_appel` (alors `analyse_call`) dans l'ordre fixe, enregistrer l'enregistrement d'appel, les résultats, les
     tours et l'audit, écrire un événement `analysis_ready`.
   - Nouveaux essais : une erreur du modèle ou du réseau relance le travail deux fois, à 10 minutes d'intervalle, puis le marque
     `failed` avec l'erreur.
   - Un plantage dans une compétence donne déjà `to_review` (à revoir) pour cette compétence seulement.

## 5. Écran (phase 4 de la consigne de reprise, `CONSIGNE_DE_REPRISE.md`)

- **Un seul rendu, trois portes d'entrée.**
  - `app/crm/call_analysis.js` définit `window.LNP_CALL_ANALYSIS.render(el, record)`. Il suit `docs/SPEC_ECRAN.md` avec les
    jetons de l'application (système de design du Cockpit : Fraunces, IBM Plex, or `#D9B46A`).
    - En-tête avec quatre tuiles de note, la marque du goulot d'étranglement, les versions des règles et la mention
      **« provisoire »**.
    - Ligne de l'appel avec la durée, et la carte horizontale de l'appel.
    - Tiroir de la transcription : chaque nombre et chaque pastille ouvre les tours qui le prouvent.
    - Les quatre sections : découverte par domaine avec les pastilles S/P/I/N ; barre de temps de l'écart avec la restitution
      mot pour mot annotée, les quatre contrôles et le tableau des composantes ; pastilles de conformité de la présentation de
      l'offre, escalier et texte mot pour mot de la présentation ; tableau des objections avec **A · I · E · M** cliquables et
      les tuiles de prévention.
  - `LNP_CRM.callAnalysis(callId)` lit l'enregistrement à travers la sécurité par ligne.
  1. **Cycle de vente** : choisir un appel dans le cycle ouvre la fenêtre `anHTML` existante, désormais dessinée par le rendu.
     - Sans enregistrement : « Ajouter une transcription ».
     - Pendant le travail : « Analyse en cours… (commencée à hh:mm) ».
     - En cas d'échec : la raison, avec « Réessayer ».
  2. **Pipeline (tableau du CRM)** : une petite pastille sur la carte du prospect quand son dernier appel honoré a un
     enregistrement (les quatre notes en points) ; un clic ouvre l'analyse.
  3. **Liste des prospects** : une colonne « Analyse » avec la même pastille, qui ouvre l'analyse.
  - Le document du CRM et Cycle de vente sont retouchés dans `gen_crm.py` (vérifié par des assertions, comme aujourd'hui), jamais
    à la main dans `crm_doc.html`.
- **Démo / Artifact** : un enregistrement d'exemple d'un appel **fictif**, marqué « Exemple », pour que l'Artifact ne montre
  jamais un vrai prospect. Le vrai appel 001 de la maquette reste hors de la page.
- **Connecteur Claude** : l'outil existant `call_analysis` renvoie cet enregistrement (notes, verdicts, citations de preuve),
  jamais la transcription.

## 6. Performance (phase 5) et calibration (phase 6)

- **Performance** : une étape nocturne de l'exécutant lance `noyau/agregation.py` (alors `core/aggregate.py`) pour chaque
  commercial × compétence × fenêtre (`7d`, `month`, `all`, dans le fuseau du commercial) et écrit `crm_ca_periods`.
  - Affiché dans Ventes › Cockpit commercial (ligne de l'équipe → compétences) et dans un bloc « Qualité des appels » : note,
    intervalle, niveau, écart avec la période précédente, taux par item, goulot d'étranglement, « volume insuffisant
    (n appels) », provisoire.
- **Calibration** : un script de calibration dans `analyse-appel/executant/` (prévu sous le nom `worker/calibrate.py` ; pas
  encore écrit au 2026-11-19), à la demande dans Actions.
  - Il rejoue chaque cas de l'annexe C avec le vrai modèle et affiche la concordance par règle et par compétence.
  - Rapport de reproductibilité : trois passes, par item.
  - File des arbitrages (`rule_ambiguity`, `uncovered_case`), en liste pour les administrateurs, à l'intention du responsable de
    la méthodologie.

## 7. Pull requests (une par phase, tests verts à chaque fois)

| PR | Contenu | Résultat visible |
|---|---|---|
| 1 · Moteur en place (cette PR) | Paquet dans `analyse-appel/` (alors `call-analysis/`), section du CLAUDE.md, ce plan, workflow qui lance les tests | Rien à l'écran |
| 2 · Données et exécutant | Migration 020, `executant/executer.py` (alors `worker/run.py` : passes parallèles, cache, nouveaux essais), tests SQL et tests de l'exécutant avec le client simulé | Un travail peut tourner depuis Actions |
| 3 · Ajouter une transcription et écran | Rendu, les trois portes, « Ajouter une transcription » avec correspondance des intervenants, exemple de démo, outil du connecteur | Premier vrai appel analysé de bout en bout (recette) |
| 4 · Fathom | Mapper, rapprochement des appels, mise en file automatique, import de l'historique (essai à blanc d'abord) | L'analyse apparaît après chaque appel enregistré, sans que personne n'ait rien à faire |
| 5 · Performance | Périodes, bloc du Cockpit | Notes par commercial et par période |
| 6 · Calibration | Banc d'essai, reproductibilité, file des arbitrages | Concordance par compétence affichée |

## 8. Questions pour Romain (bloquantes marquées ●)

- ● **Q1 Identifiants de modèle.** Proposition : `fast` = `claude-haiku-5-5`, `strong` = `claude-sonnet-5-5`,
  `arbiter` = `claude-opus-5-5`.
- ● **Q2 Clé API.** Une clé Anthropic dans les secrets GitHub (`ANTHROPIC_API_KEY`), plus `SUPABASE_URL` et
  `SUPABASE_SERVICE_ROLE_KEY`. Vous les posez vous-même ; je ne les vois jamais.
- ● **Q3 Référence d'offre** (`docs/DECISIONS_OUVERTES.md` A2) : prix et options de paiement, garanties, composantes, phases,
  et les neuf mécanismes (principe en une phrase, phase de l'offre qui le porte, indices lexicaux).
  - Sans elle, la présentation de l'offre est analysée avec des contrôles réduits et les signaux `offer_reference_missing` /
    `mechanism_reference_missing`. C'est acceptable pour commencer.
- **Q4 Bibliothèque de cas** (A3) : cas clients avec accord et point de départ. Sans elle, l'étape 4 de la présentation de
  l'offre est « sans objet » (`case_library_missing`).
- **Q5 Fathom.**
  - Le webhook (`FATHOM_WEBHOOK_SECRET`) et une clé API (`FATHOM_API_KEY`), dans les secrets Supabase.
  - Quels comptes enregistrent (celui de Valentino) ?
  - En attendant, les transcriptions arrivent par « Ajouter une transcription ».
- **Q6 Transcriptions de test.** Les 15 vraies transcriptions sont nécessaires aux 20 tests de l'annexe B dans la CI.
  - Proposition : un bucket Storage privé `callqa-fixtures`, que la CI télécharge avec le rôle de service.
  - Autre possibilité : les mettre dans le dépôt (il est privé), ce que la règle du paquet interdit.
- **Q7 Qui voit les notes.** La phase pilote de l'architecture ne les montre qu'au responsable de la méthodologie et au
  responsable commercial. Proposition : administrateurs seulement tant que vous n'avez pas levé « provisoire » ; Valentino voit
  les siennes ensuite.
- **Q8 A · I · C ou A · I · E · M** (`docs/DECISIONS_OUVERTES.md` B). La spécification de l'écran utilise A · I · E · M.
  Proposition : A · I · E · M.
- **Q9 Quels appels.** Proposition : chaque appel passé qui a une transcription, tous les rangs (R1, R2…). Les appels
  d'intégration et d'étude de cas sont laissés de côté (titre ou type d'événement iClosed).
- La section B de `docs/DECISIONS_OUVERTES.md` (poids, seuils, règle du mot pour mot…) reste telle qu'écrite (« à valider ») ;
  rien n'est changé sans votre décision.
