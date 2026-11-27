# 09 · Analyse d'appel

Ce chapitre permet de réinstaller et de faire tourner l'analyse d'appel **exactement comme sur `main`** (commit `edcc610`,
relevé du 27 novembre 2026) : le moteur, le worker, la passerelle de modèle, les tables et fonctions de la base, la
qualification du lead, la mesure de qualité, les tests et les workflows. Le code fait foi ; les écarts avec la
documentation sont listés au § 18. Aucune transcription, aucune donnée personnelle : seulement des chemins, des noms de
tables, de fonctions, de clés et de secrets.

Le moteur a ses propres règles, à lire avant toute modification : `call-analysis/CLAUDE.md` (en anglais). Ce chapitre ne
remplace pas la méthodologie (`call-analysis/docs/methodology/`), il dit comment la faire tourner.

## Sommaire

1. [Ce que fait le système](#1-ce-que-fait-le-système)
2. [Arborescence de `call-analysis/`](#2-arborescence-de-call-analysis)
3. [La chaîne complète](#3-la-chaîne-complète)
4. [Base de données](#4-base-de-données)
5. [La passerelle `callqa-llm`](#5-la-passerelle-callqa-llm)
6. [Le worker](#6-le-worker)
7. [Les deux moteurs](#7-les-deux-moteurs)
8. [Paliers de modèle, effort et coût](#8-paliers-de-modèle-effort-et-coût)
9. [Les consignes envoyées au modèle](#9-les-consignes-envoyées-au-modèle)
10. [La qualification du lead](#10-la-qualification-du-lead)
11. [Comment l'écran lit les résultats](#11-comment-lécran-lit-les-résultats)
12. [La mesure de qualité (`call-analysis/qa`)](#12-la-mesure-de-qualité-call-analysisqa)
13. [Tests](#13-tests)
14. [Workflows, déclencheurs et secrets](#14-workflows-déclencheurs-et-secrets)
15. [Réinstaller pas à pas](#15-réinstaller-pas-à-pas)
16. [Relancer les analyses après un changement de règles (C8)](#16-relancer-les-analyses-après-un-changement-de-règles-c8)
17. [Hors de `main` : les PR #81, #82 et #83](#17-hors-de-main--les-pr-81-82-et-83)
18. [Écarts entre la documentation et le code](#18-écarts-entre-la-documentation-et-le-code)

---

## 1. Ce que fait le système

L'analyse lit la transcription d'un appel de vente (R1 ou R2) et évalue **quatre compétences** du commercial, puis, pour un
R1, **qualifie le lead**.

| Compétence | Clé (`crm_ca_results.competence`) | Version des règles sur `main` | Ce qui est rendu |
|---|---|---|---|
| Découverte SPIN | `SPIN` | `SPIN-1.3` | chaque question de la découverte avec sa lettre (S, P, I, N, hors découverte) et son registre, les effets de la réponse, items D1 à D5, note sur 100 |
| Écart reformulé | `GAP` | `GAP-1.5` | verdict `present` / `absent`, problème, coût, points A et B, validation, état du blocage, reformulation parfaite, items G1 à G6 |
| Présentation de l'offre | `PITCH` | `PITCH-2.0` | verdict `compliant` / `non_compliant`, les quatre étapes, la feuille de route, affirmations, promesses, adhésion, items K1 à K7 |
| Objections | `OBJECTIONS` | `OBJ-1.1` | chaque objection après le premier prix, les gestes A · I · E · M, la réaction du prospect, la prévention, items H1 à H5 et R1 à R3 (combinaison 70 / 30) |
| Qualification du lead (R1) | `crm_lead_qualifications` | `qualification_lnp-v2.3` | statut SQL GAGNÉ, SQL OUVERT, SQL PERDU, NON SQL, MQL EN ATTENTE ou À REVOIR, cinq portes (§ 10) |

Les versions de règles sont écrites dans le code : `RULES` de `call-analysis/lite/callqa_lite/engine.py`, et
`rules_version` / `RULES_VERSION` de `call-analysis/engine/lnp_callqa/competences/{spin,gap,pitch,objections}.py`.

**La règle qui prime sur tout : le modèle extrait et cite, le code décide et note.** Aucune consigne ne demande au modèle
une note, un niveau ou un verdict. Le modèle répond à des questions fermées, en JSON, et appuie chaque réponse positive sur
une citation exacte ; le code vérifie chaque citation (sous-chaîne exacte de la réplique citée, dite par le bon rôle, dans
la bonne phase : Partie C, C3) et calcule chaque lettre, chaque niveau, chaque verdict et chaque note. Une réponse qui ne
passe pas les contrôles est écartée ; une unité indécidable est `to_review` et sort des notes.

Sources de vérité, dans cet ordre (`call-analysis/CLAUDE.md`) :

1. `call-analysis/docs/methodology/` : `00_engine_common_part_C.md` (règles communes C1 à C9) et, par compétence,
   `0N_<x>_A_scoring.md` (notation), `0N_<x>_B_bounding_rules.md` (règles de bornage), `0N_<x>_C_calibration_cases.md`
   (cas de calibration) ; `call-analysis/docs/BOUNDING_INDEX.md` liste chaque règle de bornage (SEG, SB, GB, PB, OB) ;
2. `call-analysis/docs/memos/` : les cinq mémos en français (`LNP_Memo_0_Regles_communes.pdf` à `LNP_Memo_4_Objections.pdf`),
   produits depuis `docs/memos/src/` (`build_memos.py`, `print_pdf.js`, exemples inventés seulement) ;
3. `call-analysis/engine/` : l'implémentation de référence ;
4. `call-analysis/docs/ARCHITECTURE.md`, `OUTPUT_CONTRACT.md`, `SCREEN_SPEC.md`, `OPEN_DECISIONS.md`.

Si le code et la méthodologie divergent, la méthodologie gagne : on corrige le code et on ajoute un test. Un changement de
règle se fait dans le même changement dans la méthodologie, le moteur et les tests (et le mémo concerné).

## 2. Arborescence de `call-analysis/`

| Chemin | Contenu |
|---|---|
| `CLAUDE.md` | règles du moteur (à lire d'abord) |
| `README.md`, `PLAN.md`, `HANDOFF_PROMPT.md` | paquet de départ du 25 octobre 2026 et plan d'intégration (historique) |
| `docs/` | `ARCHITECTURE.md`, `OUTPUT_CONTRACT.md` (l'enregistrement d'un appel), `SCREEN_SPEC.md`, `OPEN_DECISIONS.md` (décisions ouvertes et tranchées, sections A à H), `BOUNDING_INDEX.md`, `methodology/` (13 fichiers), `memos/` |
| `engine/lnp_callqa/` | moteur de référence, Python bibliothèque standard seulement : `core/` (`models.py`, `text.py`, `llm.py`, `runner.py`, `foundation.py`, `scoring.py`, `aggregate.py`, `rounds.py`, `figures.py`, `costs.py`, `blockers.py`, `restate.py`, `lang_fr.py`), `competences/` (`spin.py`, `gap.py`, `pitch.py`, `objections.py`), `prompts/` (31 fichiers), `pipeline.py` ; `engine/CONTRACT.md`, `engine/README.md` |
| `engine/tests/` | tests du moteur ; `tests/fixtures/transcripts/` est **ignoré par git** (`.gitignore`) et rempli en CI depuis le stockage privé |
| `lite/callqa_lite/` | moteur allégé : `engine.py` (chaîne), `voices.py` (SV), `steps.py` (appels au modèle, JSON, rejeu, client simulé), `shim.py`, `phases.py` (S0), `spin.py` (S1, S1g), `gap.py` (S2), `pitch.py` (S3), `objections.py` (S4), `cost.py`, `prompts/` (10 fichiers) ; `lite/README.md` ; `lite/tests/` (appel fictif `synthetic_call.py`) |
| `worker/` | `run.py` (boucle), `callqa_worker/` (`supabase.py`, `gateway.py`, `job.py`, `prefetch.py`, `qualif.py`), `tests/` |
| `qualification/` | qualification du lead : `agent.py`, `qualification_lnp.py`, `run.py`, `prompts/extraction.md`, `tests/`, `README.md` (en français) |
| `qa/` | mesure de qualité : `qa_run.py`, `corrections_to_reference.py`, `callqa_qa/` (`reference.py`, `score.py`), `tests/`, `README.md` |

Ignorés par git (`.gitignore`) : `call-analysis/engine/tests/fixtures/transcripts/` (vrais appels) et
`call-analysis/docs/screen/` (la maquette citée par `SCREEN_SPEC.md`, faite sur un vrai appel). Ils ne sont pas dans le dépôt.

## 3. La chaîne complète

```
Fathom (enregistrement) ─ crm-import / fathom-in ─ crm_apply_recording_item (025)
   └─ crm_calls.transcript_raw + speaker_map, transcript_source = 'fathom' ─ appel éligible ─ crm_ca_jobs 'queued'
Écran (administrateur ou commercial du cycle) ─ crm_ca_add_transcript / crm_ca_retry ─ crm_ca_jobs 'queued'

GitHub Actions call-analysis.yml (minute 7 de chaque heure) ─ python3 call-analysis/worker/run.py --budget-min 120
   boucle : crm_ca_claim ─ moteur (crm_ca_config.engine : 'lite' ou 'full')
              └─ chaque question au modèle : POST <SUPABASE_URL>/functions/v1/callqa-llm (clé service role)
                                              └─ API Anthropic Messages (secret ANTHROPIC_API_KEY)
            ─ R1 : qualification du lead (même client, mêmes répliques)
            ─ crm_ca_store (enregistrement, répliques, résultats, audit ; événement analysis_ready)
            ─ crm_qualif_store (R1) ; en cas d'échec : crm_ca_fail

Écran : crm_ca_board (une ligne par appel R1 / R2 analysable) ─ crm_ca_record(job) ─ LNP_CA / LNP_CAV (app/lnp.html)
```

Le worker ne détient aucune clé de modèle : il n'a que `SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY`. La clé Anthropic
reste dans les secrets des fonctions Supabase, lue par `callqa-llm`.

## 4. Base de données

### 4.1 Tables

| Table | Fichier | Rôle | Lecture (RLS) |
|---|---|---|---|
| `crm_calls` (colonnes ajoutées) | 020 | `transcript_raw` (format `[mm:ss] Nom: texte`), `speaker_map` (libellé → `SALES` / `PROSPECT` / `OTHER`), `transcript_source` (`fathom` ou `upload`), `transcript_added_at` | celle de `crm_calls` |
| `crm_ca_config` | 020, 035 | une seule ligne (`id = true`) : `tiers` (modèle par palier), `passes` (1 ou 3, défaut 3), `default_timezone` (défaut `Asia/Dubai`), `provisional` (défaut vrai : notes « provisoires »), `engine` (`full` ou `lite`, défaut `full`, 035), `updated_at` | administrateurs (`ca_config_admin`) |
| `crm_ca_offer` | 020 | référence d'offre versionnée (`version`, `data`), une seule `active` ; vide | tout membre (`ca_offer_read`) |
| `crm_ca_cases` | 020 | bibliothèque de cas clients (`consent`, point de départ, `figures`) ; vide | tout membre (`ca_cases_read`) |
| `crm_ca_jobs` | 020 | une ligne par analyse : `status` `queued` → `running` → `done` / `failed`, `attempts`, `not_before`, `worker`, `error`, `engine_version`, `usage`, `created_by`, horodatages ; index `crm_ca_jobs_call`, `crm_ca_jobs_queue` | `crm_ca_can_read(call_id)` |
| `crm_ca_records` | 020 | l'enregistrement d'une analyse : `status`, `flags`, `phases`, `meta` (infos de l'appel, `engine`, `rules`, `duration`, et pour le moteur allégé `engine_version`, `engine_steps`) | `crm_ca_can_read(call_id)` |
| `crm_ca_turns` | 020 | les répliques réparées (`turn_id`, `ts`, `role`, `speaker`, `text`, `repaired`, `doubtful`) | `crm_ca_can_read` de l'appel du job |
| `crm_ca_results` | 020 | une ligne par compétence : `rules_version`, `status`, `verdict`, `reasons`, `score`, `items`, `flags`, `details`, `concordance` | `crm_ca_can_read(call_id)` |
| `crm_ca_audit` | 020 | chaque appel au modèle (`entry` : tâche, unité, passe, palier, empreinte de la consigne, réponse, erreurs) : c'est ce que rejoue la mesure | administrateurs (`ca_audit_admin`) |
| `crm_lead_qualifications` | 042, 046 | une ligne par qualification : `status`, `result`, `readings` (les faits extraits), `verification`, `usage`, `prompt_version`, `rules_version`, `job_id` (046) | aucune règle : service role et fonctions `security definer` seulement |
| `crm_ca_corrections` | 063 | corrections humaines d'une lettre SPIN, **en ajout seulement** (`unit_id`, `field = 'letter'`, `engine_value`, `value`, `note`, `author`) | `crm_ca_can_read(call_id)` ; `insert`, `update`, `delete` retirés à `anon` et `authenticated` |

`crm_call_analyses` (003) est l'ancienne table prévue avant le moteur : le moteur ne l'écrit pas. Le réglage
`crm_settings.analysis_model` (003) n'est lu par aucun code.

`crm_ca_can_read(p_call)` : vrai pour un administrateur (`crm_role() = 'admin'`) ou le propriétaire du cycle de l'appel.
C'est plus étroit que les autres lectures du CRM : un `sales_lead` ne lit pas l'analyse d'un cycle qui n'est pas le sien.

### 4.2 Fonctions

| Fonction | Définition finale | Appelée par | Effet |
|---|---|---|---|
| `crm_ca_call_info(p_call)` | 034 | les autres fonctions (exécution retirée à `authenticated`) | rang de vente (`sales_round`), éligibilité (`eligible`, `reason` en français), `sales_id`, `sales_name`, `timezone` (fuseau du membre, sinon `crm_ca_config.default_timezone`), `person` (§ 4.3) |
| `crm_ca_add_transcript(p_call, p_raw, p_speaker_map, p_source = 'upload')` | 034 | écran | administrateur ou propriétaire du cycle ; appel éligible ; au moins 200 caractères ; rôles parmi `SALES`, `PROSPECT`, `OTHER` avec au moins un commercial et un prospect ; enregistre la transcription, passe en échec les jobs encore en file (« remplacée par une nouvelle transcription »), crée un job et l'événement `transcript_added` |
| `crm_ca_retry(p_call)` | 034 | écran (« Relancer l'analyse » après un échec) | administrateur ou propriétaire ; transcription présente ; si un job est `queued` ou `running` → `already queued`, sinon un nouveau job |
| `crm_ca_claim(p_worker)` | 035 | worker (service role) | prend le plus ancien job `queued` dont `not_before` est passé, ou `running` depuis plus de 2 h (`for update skip locked`, ordre `created_at`) ; `running`, `attempts + 1` ; renvoie `{job, attempt, call (crm_ca_call_info), transcript, speaker_map, config {tiers, passes, engine}, offer_reference, case_library, prior}` ; `prior` = pour chaque appel plus ancien du même cycle, sa dernière analyse (`details` par compétence) |
| `crm_ca_store(p_job, p_record, p_usage, p_engine)` | 035 | worker | job `running` exigé ; écrit enregistrement, répliques, résultats et audit en une transaction ; job `done` avec `usage` et `engine_version` ; événement `analysis_ready` (`source_id = analysis:<job>`, notes par compétence) |
| `crm_ca_fail(p_job, p_error, p_final)` | 020 | worker | non final et `attempts < 3` → de nouveau `queued` dans 10 min (deux nouvelles tentatives au plus) ; sinon `failed` |
| `crm_ca_board()` | 062 | écran | une ligne par appel R1 / R2 analysable visible (§ 11) |
| `crm_ca_record(p_job)` | 063 | écran | l'enregistrement complet, plus `qualification` (046), `corrections` et `can_correct` (063) |
| `crm_ca_latest(p_calls)` | 020 | aucun écran ne l'appelle aujourd'hui | dernier job et notes de chaque appel |
| `crm_ca_correct(p_job, p_unit, p_value, p_note)` | 063 | écran, administrateurs | ajoute une correction de lettre (`S`, `P`, `I`, `N`, `OUT`) avec la lettre du moteur ; la note n'est pas recalculée |
| `crm_qualif_config()` | 042 | `qualification/run.py` | `{tiers}` de `crm_ca_config` |
| `crm_qualif_candidates(p_limit, p_again, p_prompt_version)` | 046 | `qualification/run.py` | le dernier R1 (`rank = 1`) passé, non annulé, de chaque lead, hors fiches de test (`crm_person_internal`), du plus récent au plus ancien (200 au plus) |
| `crm_qualif_context(p_call)` | 046 | worker | date de l'appel (Europe/Paris), enregistreur, issue saisie dans iClosed (`iclosed_outcome`, `no_sale_reason`) |
| `crm_qualif_store(..., p_job)` | 046 | worker, `qualification/run.py` | une ligne dans `crm_lead_qualifications` |

Les fonctions du worker et de la qualification sont réservées au service role (`revoke ... from public, anon,
authenticated`, `grant ... to service_role` pour celles de 042 et 046).

### 4.3 Quels appels sont analysés, et leur numéro

`crm_ca_call_info` (définition finale de `034_lnp_fr_labels.sql`, règle de 025) :

- **cycle enregistré par Fathom** (au moins un appel du cycle a un `recorded_by`) : un appel de vente est un appel
  enregistré par un commercial ; son numéro est son rang (`crm_calls.rank`, posé par `crm_rank_calls`, chapitre 03) ; un
  appel sans enregistrement n'est pas analysé (« aucun enregistrement Fathom de cet appel par un commercial ») ;
- **sinon** : on compte les appels non annulés dans l'ordre (`scheduled_start`, `id`), en excluant les événements iClosed
  dont le nom contient « onboarding » ou « case stud » ;
- **éligible** : numéro 1 ou 2, appel passé, non annulé. Raisons d'inéligibilité affichées : appel annulé, pas encore eu
  lieu, « seuls les appels de vente R1 et R2 sont analysés ».

`crm_ca_board` (062) applique exactement la même règle à tous les appels visibles en une requête : la fiche liste les appels
que l'analyse traite, ni plus ni moins (avant 062, les absences décalaient le numéro et cachaient des analyses). Test :
`web/supabase/tests/ca_board_rounds_test.sql`.

### 4.4 Mise en file

- **Automatique** (Fathom, `crm_apply_recording_item`, 025) : quand un enregistrement est rattaché, sa transcription
  remplace celle de l'appel sauf si une transcription a été ajoutée à la main ; si elle a changé, que l'appel est éligible,
  que le texte fait au moins 200 caractères et qu'aucun job `queued`, `running` ou `done` n'existe pour l'appel, un job est
  créé. Format reçu et carte des intervenants (`crm_fathom_speaker_map`) : chapitre 04, § 5.3.
- **À l'écran** : `crm_ca_add_transcript` (coller une transcription, dire qui est le commercial et le prospect),
  `crm_ca_retry`.
- Une analyse déjà faite n'est jamais modifiée : relancer crée un nouveau job et un nouvel enregistrement (C8, § 16).

### 4.5 `crm_ca_config` après les migrations et en production

| Colonne | Après les migrations (020, 035) | En production (chapitre 08) |
|---|---|---|
| `engine` | `full` | `lite` |
| `tiers` | `fast` = `claude-haiku-5-5`, `strong` = `claude-sonnet-5-5`, `arbiter` = `claude-opus-5-5` | `fast` = `claude-haiku-5-5`, `strong` = `claude-haiku-5-5`, `arbiter` = `claude-sonnet-5-5` |
| `passes` | 3 | non relevé |
| `default_timezone` | `Asia/Dubai` | non relevé |
| `provisional` | vrai | non relevé |

Pour retrouver la production après les migrations (éditeur SQL de Supabase) :

```sql
update crm_ca_config set engine = 'lite',
  tiers = '{"fast": "claude-haiku-5-5", "strong": "claude-haiku-5-5", "arbiter": "claude-sonnet-5-5"}', updated_at = now();
```

Les identifiants de modèle ne sont jamais dans le code : seulement dans `crm_ca_config.tiers`. Les trois paliers doivent
être remplis, même avec le moteur allégé : `GatewayClient` refuse un palier vide (erreur finale « model id missing for
tier »). `passes`, `default_timezone` et `provisional` ne sont pas dans le relevé du 27 novembre : à relever sur la base en
ligne avant de les recopier (l'heure de référence de LNP est Europe/Paris, la valeur par défaut est `Asia/Dubai`).

## 5. La passerelle `callqa-llm`

`supabase/functions/callqa-llm/index.ts` → `supabase/functions/_shared/callqa_llm.ts › handleLlm`. Déployée par
`.github/workflows/crm-functions.yml` avec les autres fonctions (`verify_jwt = false` : elle vérifie elle-même sa clé).

| Point | Règle |
|---|---|
| Méthode | `POST` seulement, sinon `405` |
| Authentification | `Authorization: Bearer <clé>` égale à `SUPABASE_SERVICE_ROLE_KEY` ou `SUPABASE_SECRET_KEY`, sinon `401` |
| Clé du modèle | `ANTHROPIC_API_KEY` absente → `409` |
| Corps | `{model, system, prompt, prefix?, max_tokens?, effort?, cache_prompt?}` ; `model` doit suivre `^claude-[a-z0-9.\-]+$` ; `system` et `prompt` (non vide) obligatoires ; `prefix` chaîne ou absent (`400` sinon) |
| `max_tokens` | 4000 par défaut, borné de 1 à 16 000 |
| `effort` | `low` par défaut ; valeurs `none`, `low`, `medium`, `high`, `xhigh`, `max`, `default` ; `none` envoie `thinking: {type: "disabled"}`, `default` n'envoie rien, les autres `output_config: {effort}` |
| Cache | le `system` porte toujours `cache_control: {type: "ephemeral"}` ; `prefix` (la transcription du moteur allégé) est un premier bloc du message, toujours mis en cache ; le `prompt` est mis en cache si `cache_prompt === true` |
| Appel | `POST https://api.anthropic.com/v1/messages`, `anthropic-version: 2023-06-01`, sans `temperature` (refusée par les modèles actuels), un seul message `user` |
| Réponse | `{text, usage, model, stop_reason}` |
| Erreurs du fournisseur | `429` ou `5xx` → `503 {error, retry: true}` ; autre → `502 {error, retry: false}` ; seuls le type et le message d'erreur sont renvoyés |

Rien n'est journalisé : ni consigne, ni transcription. Tests : `supabase/tests/callqa_llm.test.ts` (5 tests).

## 6. Le worker

### 6.1 La boucle (`call-analysis/worker/run.py`)

`python3 call-analysis/worker/run.py [--once] [--budget-min 300]` ; le workflow lance `--budget-min 120`.

1. Lit `SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` ; si l'une manque : « nothing to do », code 0.
2. Tant que le budget n'est pas épuisé : `crm_ca_claim({"p_worker": "gha:<hôte>"})` ; plus rien en file → fin.
3. `GatewayClient(<SUPABASE_URL>/functions/v1/callqa-llm, clé, config.tiers, effort = CALLQA_EFFORT ou config.effort ou
   "none", passes = config.passes ou 3)`.
4. `run_job(claim, client, rounds=True, workers=24, budget_s=90*60)` (§ 6.3).
5. R1 : `qualify(claim, client, db)` (§ 10) ; un échec de la qualification n'arrête jamais l'analyse.
6. `usage = {tiers (jetons par palier), seconds, effort, engine, usd}` (+ `qualification` pour un R1) ; pour le moteur
   allégé, `effort` est celui de l'enregistrement (`meta.effort`). `usd` vient de `callqa_lite.cost.estimate(usage.tiers,
   config.tiers)`, calculé après la qualification : il comprend ses jetons.
7. `crm_ca_store(job, record, usage, engine_version)` puis `crm_qualif_store` ; `engine_version` = `lnp_callqa-1.0`
   (référence) ou `callqa-lite-1.1` (`LITE_VERSION`).

Le journal (dépôt lu par d'autres) ne montre que des identifiants de job et d'appel, des statuts, des notes, des coûts et des
comptes de jetons, jamais une citation (`summary`).

### 6.2 Échecs et nouvelles tentatives

| Cas | Levé par | Suite |
|---|---|---|
| `ModelErrors` | référence : plus de la moitié des questions au modèle en erreur (`check_model_errors`) ; allégé : `LiteModelError` (S0 sans JSON valide, ou plus de la moitié des étapes tentées sans JSON valide) | `crm_ca_fail(..., p_final = true)` : jamais relancé tel quel |
| `TooLong` | `prefetch.py` : budget de 90 min dépassé (moteur de référence) | final |
| `GatewayError` | `gateway.py` : `401`, `409`, ou `502` avec `retry: false` → final ; un palier sans modèle → final ; passerelle injoignable après 5 essais → non final | selon `final` |
| autre exception | | non final : de nouveau en file 10 min plus tard, deux fois au plus (`crm_ca_fail`) |

### 6.3 Le choix du moteur et le contexte (`callqa_worker/job.py`)

- `engine_of(claim)` : `lite` si `claim.config.engine == "lite"`, sinon `full`.
- `build_context(claim)` : `parse_transcript(transcript, speaker_map)` (répliques `T001…`), `parse_lines` (les lignes de
  l'enregistreur, pour la vérification des voix), bibliothèque de cas, épisodes d'objection des appels précédents
  (`prior_inputs`), `ctx.sales_round` et `ctx.cycle = rounds.plan(sales_round, prior)` (C9, § 7.4).
- Moteur allégé : `run_lite` → `callqa_lite.engine.analyse(ctx, client, {"effort": CALLQA_LITE_EFFORT ou "low"})`.
- Moteur de référence : `analyse_in_rounds` (`prefetch.py`) : le moteur pose ses questions une par une ; le worker rejoue
  toute la chaîne (code pur) par tours, les réponses déjà reçues venant d'un cache (clé : tâche, unité, passe, palier,
  SHA-256 de `system + prompt`), envoie en parallèle (24 fils) les questions de la première tâche en attente, et recommence ;
  le résultat est celui d'une exécution séquentielle. `crm_ca_config.passes = 1` active l'option à une passe de C4.

### 6.4 Le client de la passerelle (`callqa_worker/gateway.py`, `supabase.py`)

- `ask(...)` (moteur de référence) : corps `{model, system, prompt, max_tokens: 4000, effort, cache_prompt}` ;
  `cache_prompt` vrai à partir de la passe 1 quand `passes > 1`. Effort par tâche (`TASK_EFFORT`) :
  `foundation.attribution` et `foundation.phases` = `default`, `spin.register` = `medium` ; avec l'effort `none`, tout est
  `none` sauf la fondation.
- `complete(...)` (moteur allégé, qualification) : `{model, system, prefix, prompt, max_tokens, effort, cache_prompt: false}`.
- 5 essais, délai 180 s, attente `min(2^(i+1), 30)` s ; nouvel essai sur `429`, `500`, `502` (avec `retry` vrai), `503`,
  `504` et erreurs réseau. Jetons cumulés par palier : `calls`, `input_tokens`, `output_tokens`,
  `cache_read_input_tokens`, `cache_creation_input_tokens`.
- `supabase.py` : `POST /rest/v1/rpc/<nom>` avec la clé service role, 4 essais sur `5xx` ou erreur réseau (2, 4, 8 s),
  une erreur `4xx` levée aussitôt.

## 7. Les deux moteurs

### 7.1 Le choix

`crm_ca_config.engine` (035), lu à chaque job dans la réclamation :

```sql
update crm_ca_config set engine = 'lite';   -- retour : engine = 'full' (valeur par défaut)
```

En production : `lite`. Le moteur de référence reste dans le dépôt, testé, et sert de bibliothèque de décision au moteur
allégé (`decide_phases`, `decide_letter`, `GapCompetence`, `PitchCompetence`, fonctions des objections, `rounds`,
`figures`, `costs`, `blockers`, `restate`).

### 7.2 Le moteur de référence (`engine/`, `engine = 'full'`)

Chaîne fixe (`pipeline.py`) : porte d'enregistrement (C1, moins de 20 min → `recording_incomplete`) → F0 analyse de la
transcription → F1 porte de diarisation (`no_transcript`, `no_diarization`, `diarization_suspect`) → F2 contrôle
d'attribution (palier `fast`, blocs de 60 répliques) → F3 carte des phases → C1 SPIN → C2 Écart → C3 Présentation → C4
Objections. Environ 30 tâches fermées (une consigne par tâche dans `prompts/`), chacune posée **trois fois** ; une
réponse invalide est rejouée une fois avec l'erreur ; trois passes concordantes → `verified`, sinon l'arbitre (palier
`arbiter`) suit les règles dans l'ordre → `arbitrated`, indécidable → `to_review`. Environ 540 questions par appel :
mesuré à environ 3 USD par appel sur les appels LNP, d'où le moteur allégé (`docs/ARCHITECTURE.md` § 7).

Un appel en direct hors du worker : `cd call-analysis/engine && python3 -m lnp_callqa.pipeline transcript.txt --config
call.json` (paquet `anthropic` et `ANTHROPIC_API_KEY` en local ; format de `call.json` dans `engine/README.md`).

### 7.3 Le moteur allégé (`lite/`, `engine = 'lite'`), tel que sur `main`

`callqa_lite.engine.analyse(ctx, client, config)` ; réglages `DEFAULTS` : palier `fast`, effort `low`, S1 par blocs de 40
répliques (15 au moins quand un bloc est coupé), S1g par paquets de 25 questions et deux lectures, arbitre `arbiter`, SV
par blocs de 150 lignes (40 au moins), `max_tokens` SV 8 000, S0 12 000, S1 16 000, S1g 12 000, S1a 8 000, S2 16 000, S3
10 000, S4 10 000. Chaque étape passe par `client.complete` ; la consigne système (`prompts/system.md`) et la transcription
(`T001 [SALES] texte`, une réplique par ligne) sont les deux premiers blocs, mis en cache : la transcription est écrite
une fois dans le cache puis relue par les étapes suivantes. Une réponse qui n'est pas un JSON valide est redemandée une
fois avec l'erreur.

| Ordre | Étape | Le modèle | Le code |
|---|---|---|---|
| 1 | porte d'enregistrement (`recording_gate`) | rien | dernier horodatage sous 20 min (`MIN_RECORDING_MINUTES`) → statut `recording_incomplete`, drapeau `recording_minutes:<n>`, les quatre compétences `excluded`, **aucun appel au modèle** |
| 2 | SV, vérification des voix (`voices.py`, `lite.sv_voices` puis `lite.sv_control`, toujours actif) | lit les lignes de l'enregistreur (`L001 [SALES] texte`, son propre préfixe et `prompts/sv_system.md`) par blocs de 150 et liste les lignes attribuées à la mauvaise personne (toute la ligne, ou à partir d'une citation exacte) | vérifie chaque correction, réétiquette et coupe les lignes (`L073b`), reconstruit les répliques ; puis **contrôle** : relit les lignes réparées ; plus de 10 % de lignes encore fausses ou douteuses (`RESIDUAL_MAX_SHARE`) → `diarization_suspect`, appel non analysé ; `meta.voices` |
| 3 | porte de diarisation (`diarization_gate`) | rien | parts de parole après réparation ; un statut autre que `ok` → les quatre compétences `excluded` |
| 4 | S0 phases (`lite.s0_phases`) | chaque réplique du commercial qui décrit l'offre, partage l'écran, donne un montant ou demande une décision | vérifie les citations, place les repères avec `decide_phases` (PB-1 à PB-4, PB-17 à PB-19 ; prix déguisé PB-3 → `disguised_price`), fin de découverte (SB-1) ; S0 sans réponse valide → `LiteModelError` |
| 5 | plan du cycle (C9) | rien | `rounds.skip_reason` : après un bon écart dans un appel précédent, SPIN et Écart `not_applicable` (`gap_made_in_previous_call`) |
| 6 | S1 découverte (`lite.s1_discovery`) | le code liste les questions (SEG-1 : une par réplique du commercial, lue sur sa question prioritaire, `inventory`) ; le modèle lit chaque question listée **par son identifiant** (sans recopier la question), sa réponse et les effets de la réponse (citations du prospect), le registre ; une question oubliée est redemandée une fois | écarte ce qui n'est pas un passage exact ou vient après le début de la présentation (SB-34), règles dures (§ 3 de SPIN), périmètre et début de la découverte sur un registre (SB-1, SB-2), réponses, effets (`build_atoms`), relances, chaînes, registres, items D1 à D5 |
| 7 | S1g portes (`lite.s1_gates`, `lite.s1_gates_arbiter`) | pour chaque question listée, par paquets de 25 avec son contexte : les portes fermées de SPIN § 3, réponse par identifiant, seulement ce qui est vrai ; **deux lectures** (la seconde dans l'ordre inverse) | décide la lettre avec `decide_letter` ; même lettre → `agreed` ; sinon l'arbitre (`tiers.arbiter`, sans la transcription) relit les portes des seules questions en désaccord → `arbitrated` ; indécidable → `to_review`, hors des notes ; une question sans porte franchie dont la réponse porte un effet est relue par l'arbitre (`gates:absent_reread`) |
| 8 | S2 écart (`lite.s2_gap`) | chaque passage de reformulation jusqu'au premier prix, chaque élément repris, la validation | `GapCompetence` du moteur de référence : règle du mot pour mot GB-22 (et GB-22b : le code retrouve lui-même les mots repris), chiffres et cibles du prospect (`figures.py`, GB-28b), coûts (`costs.py`, GB-7b), état du blocage (`blockers.py`, GB-30), reformulation parfaite (`restate.py`), items G1 à G6 ; fin de découverte ramenée à la validation d'un écart présent (`_gap_rules`) ; `gap_not_remedied` (C9) |
| 9 | S3 présentation (`lite.s3_pitch`) | les questions de la présentation en une réponse | `PitchCompetence` : porte de conformité (PB-35 à PB-37), items K1 à K7 ; `not_applicable` sans début de présentation ou après une présentation dans un appel précédent (`pitch_made_in_previous_call`) |
| 10 | S4 objections (`lite.s4_objections`) | chaque résistance une fois, après le premier prix (OB-27), avec ses citations, le changement de sujet, les gestes, la réaction ; les faits de prévention | citations après le premier prix seulement (ou depuis le début si le prix a été donné dans un appel précédent, sans prévention) ; nature par les sujets (OB-3, OB-24), répétition ou récurrence (OB-11), gestes, résolution, latence, H1 à H5, R1 à R3, 70 / 30 ; sans prix → `not_applicable` (`no_resistance_no_price`) |

Un plantage dans une compétence la met `to_review` (raison `engine_error`) sans arrêter les autres. L'enregistrement est
celui de `lnp_callqa.pipeline.result_record` (`docs/OUTPUT_CONTRACT.md`), plus `meta` : `engine: "lite"`, `version`,
`tier`, `effort`, `cycle`, `voices`, `steps` (ce que le code a écarté, par étape et par raison), `failed_steps`,
`discovery_end_rule`, `gap_remediation` ; `concordance: "single_reading"` sur chaque compétence. `crm_ca_store` garde
`meta.engine`, `engine_version` et `meta.steps` (en `engine_steps`) dans `crm_ca_records.meta`. Les approximations par
rapport à la méthodologie (une lecture, pas d'arbitre hors des lettres SPIN, preuves écartées au lieu d'être rejouées…) sont
listées dans `lite/README.md` et `docs/OPEN_DECISIONS.md` § E : les notes restent « provisoires ».

### 7.4 Les appels d'un même cycle (C9, `engine/lnp_callqa/core/rounds.py`, les deux moteurs)

| Dans cet appel | Évalué si | Sinon |
|---|---|---|
| Découverte et Écart | premier appel du cycle, ou le dernier écart lu avant est **mauvais** (absent, incomplet ou non validé) | `not_applicable`, `gap_made_in_previous_call` (l'écart précédent est reporté pour la présentation) |
| Présentation de l'offre | aucun appel précédent du cycle n'a de début de présentation | `not_applicable`, `pitch_made_in_previous_call` |
| Objections | toujours ; depuis le début de l'appel si le prix a été donné avant, sans prévention | — |

Un appel précédent non analysé est inconnu : l'appel est lu comme un premier appel. Un mauvais écart ni reformulé ni suivi
d'une question de découverte avant l'offre est signalé `gap_not_remedied` (sans poids). Les appels précédents viennent de
`crm_ca_claim.prior` : il faut donc analyser un R1 avant son R2 (§ 16).

## 8. Paliers de modèle, effort et coût

| Palier | Production | Utilisé par |
|---|---|---|
| `fast` | `claude-haiku-5-5` | moteur allégé : toutes les étapes (SV, S0, S1, S1g, S2, S3, S4) ; qualification, première lecture ; référence : fondation, inventaires |
| `strong` | `claude-haiku-5-5` | qualification, seconde lecture ; référence : questions fines |
| `arbiter` | `claude-sonnet-5-5` | moteur allégé : arbitrage des lettres SPIN (S1g) et relecture `absent_reread` ; référence : tous les arbitrages |

Effort : le workflow pose `CALLQA_EFFORT` (entrée `effort`, défaut `none`), qui ne vaut que pour le moteur de référence ;
le moteur allégé lit `CALLQA_LITE_EFFORT` (non posé par le workflow) et tourne donc à `low` ; la qualification envoie `low`.

Coût (`lite/callqa_lite/cost.py`) : `PRICES` en USD par million de jetons (liste du fournisseur du 3 novembre 2026, à
revérifier avant de s'y fier) : `claude-haiku-5-5` 0,10 entrée, 0,50 sortie, 0,01 lecture du cache, 0,125 écriture ;
`claude-sonnet-5-5` 2, 10, 0,10, 2,50. Chaque palier est compté au prix du modèle que nomme `crm_ca_config.tiers` (sinon
`DEFAULT_TIERS` : Haiku, Haiku, Sonnet) ; un modèle sans ligne de prix est compté au prix du modèle par défaut du palier et
signalé (`unknown_models`). Le worker enregistre `crm_ca_jobs.usage.usd` à chaque job.

Ordres de grandeur mesurés (`lite/README.md`, `qa/README.md`) : 0,019 à 0,028 USD pour les cinq étapes en novembre 2026 ;
avec la vérification des voix et la double lecture des portes, 0,0685 USD en moyenne sur 25 analyses le 23 novembre (0,038
à 0,108). Plafonds dans le code : la mesure échoue au-delà de 0,08 USD en moyenne (`qa_run.py --max-cost`, défaut et
workflow) ; le plafond fixé par Romain dans la documentation de `main` est 0,10 USD par appel (`docs/OPEN_DECISIONS.md` § H).

Suivre le coût en production :

```sql
select date_trunc('day', finished_at) jour, count(*), round(avg((usage->>'usd')::numeric), 4) usd_moyen
  from crm_ca_jobs where status = 'done' and usage ? 'usd' group by 1 order by 1 desc;
```

## 9. Les consignes envoyées au modèle

| Dossier | Fichiers | Langue |
|---|---|---|
| `engine/lnp_callqa/prompts/` | `system_common.md` et une consigne par tâche (30 : `foundation_*`, `spin_*`, `gap_*`, `pitch_*`, `objections_*`) | anglais |
| `lite/callqa_lite/prompts/` | `system.md`, `sv_system.md`, `sv_voices.md`, `s0_phases.md`, `s1_discovery.md`, `s1_gates.md`, `s1_gates_arbiter.md`, `s2_gap.md`, `s3_pitch.md`, `s4_objections.md` | anglais |
| `qualification/prompts/` | `extraction.md` (la consigne du document de qualification, telle quelle ; version `lnp-sql-v2.3-2026-11-21`) | français |

Les consignes de l'analyse **restent en anglais** : les traduire changerait la lecture du modèle (`CLAUDE.md` du dépôt et
`lite/README.md`). Le code lit le français des appels (`engine/lnp_callqa/core/lang_fr.py`, listes françaises à côté des
listes anglaises ; test `engine/tests/test_french.py`). Chaque appel au modèle garde l'empreinte de sa consigne dans
`crm_ca_audit` : un changement de consigne est traçable et se mesure (§ 12). Les exemples des consignes sont inventés.

## 10. La qualification du lead

Règles « Qualification SQL des appels LNP », **version 2.3** (21 novembre 2026) : `call-analysis/qualification/`.

- **Cinq portes** (`qualification_lnp.py` : `porte_metier`, `porte_financement`, `porte_decision_timing`,
  `porte_douleur`, `porte_projet`), chacune `OUVERTE`, `FERMÉE` ou `NON VÉRIFIÉE` ; un lead « solution aware » est
  qualifié d'office ; statut SQL GAGNÉ, SQL OUVERT, SQL PERDU, NON SQL, MQL EN ATTENTE ou À REVOIR ; l'issue saisie dans
  iClosed est comparée (alerte « Écart avec la saisie »).
- **Deux lectures** (`agent.qualify_call`, paliers `fast` puis `strong`, effort `low`, `max_tokens` 8 000) : le modèle
  extrait des faits avec leur verbatim ; `agent.verify` remet à « inconnu » un fait dont la preuve n'est pas dans la
  transcription ; deux lectures en désaccord sur une porte → porte non vérifiée → À REVOIR.
- Versions : `PROMPT_VERSION = "lnp-sql-v2.3-2026-11-21"`, `RULES_VERSION = "qualification_lnp-v2.3"` (`agent.py`).
- **Dans l'analyse** (046) : chaque R1 analysé (`sales_round = 1`) est qualifié par le worker sur les mêmes répliques que
  l'analyse (`callqa_worker/qualif.py`), avec le contexte `crm_qualif_context` ; le résultat est gardé avec le job
  (`crm_qualif_store(..., p_job)`), rendu par `crm_ca_record` (`qualification`) et `crm_ca_board` (statut et
  `solution_aware` du R1). Les faits extraits (`readings`) restent dans la table, jamais à l'écran.
- **À la main** : workflow `lead-qualification` (`qualification.yml`), `python3 call-analysis/qualification/run.py --limit
  30 [--again]` sur les candidats de `crm_qualif_candidates` (transcription Fathom `crm_calls.transcript`, rendue par
  `render_transcript`) ; `--again` requalifie aussi les appels déjà faits avec la version de consigne courante.

## 11. Comment l'écran lit les résultats

Données : `app/crm/data.js` (`caBoard` → `crm_ca_board`, en direct seulement ; `caRecord(job)` → `crm_ca_record` ;
`caCorrect` → `crm_ca_correct` ; `caAddTranscript` → `crm_ca_add_transcript` ; `caRetry` → `crm_ca_retry`). Affichage :
`LNP_CA` (fenêtre, pastilles, fiche) et `LNP_CAV` (rendu de l'enregistrement) dans `app/lnp.html`, qui fait foi (sources
d'origine `app/crm/call_analysis.js` et `call_analysis_view.js`, pas encore à jour : `CLAUDE.md` du dépôt). Description de
l'écran : chapitre 02, § 8.

- `crm_ca_board()` : une ligne par appel R1 / R2 analysable que la personne peut lire (administrateur : tous ; commercial :
  ses cycles) : `call_id`, `cycle_id`, `round`, `start`, `transcript` (présente ou non), dernier job (`job`, `status`,
  `error`, `queued_at`, `started_at`), dernière analyse terminée (`done_job`), `scores` par compétence (`score`, `status`,
  `verdict`) et `qualification`. La page le lit une fois au chargement (`window.LNP_CA_ROWS`) ; la ligne « Appels » de la
  fiche numérote les appels comme l'analyse (§ 4.3).
- `crm_ca_record(done_job)` : l'enregistrement complet (répliques réparées, phases, résultats, `meta`, `provisional`,
  `qualification`, `corrections`, `can_correct`). L'écran montre toujours la **dernière** analyse d'un appel.
- États : en file ou en cours (« Elle attend le prochain passage de l'analyse, toutes les heures à la 7e minute… ») ; échec
  (erreur et « Relancer l'analyse ») ; sans transcription (« Ajouter la transcription »).
- Corrections (063) : un administrateur corrige la lettre d'une question ; la lettre corrigée s'affiche en pointillés, celle
  du moteur en infobulle ; la note n'est pas recalculée. Une correction est attachée à son job : une nouvelle analyse de
  l'appel ne les reprend pas.
- Le connecteur Claude lit `crm_ca_records`, `crm_ca_jobs` et `crm_ca_results` avec le jeton de la personne
  (`web/api/_crm.js`) et ne renvoie jamais une transcription (chapitre 05).

## 12. La mesure de qualité (`call-analysis/qa`)

Avant de changer une consigne, une règle ou un modèle, on mesure sur un **jeu de référence** : des appels lus par une
personne (phases, questions, lettres, registres, effets, écart, présentation, objections, plages de notes), comparés à
l'enregistrement d'une analyse (`callqa_qa/score.py`) ; avec plusieurs analyses d'un même appel, la reproductibilité (C4 :
95 % identiques ; SB-33 : 92 % des registres).

- **Fichiers** : un fichier de référence par appel, repéré par les **mots** de la transcription, jamais par les numéros de
  réplique (format dans `callqa_qa/reference.py`, `split` `tuning` ou `control`) ; un fichier de cas par appel (`{call:
  {call_id, transcript_raw, speaker_map, scheduled_start, sales_round}, prior, config: {tiers}, audit}`, docstring de
  `qa_run.py`).
- **Données personnelles : jamais dans git.** Ils vivent dans le bucket privé **`callqa-fixtures`** du stockage Supabase :
  `qa/reference.tar.gz`, `qa/cases.tar.gz`, les rapports `qa/reports/<run_id>.json` ; et `transcripts.tar.gz` (le corpus
  des cas de calibration de l'annexe B, dossiers `NNN/transcript_compact.txt`) que télécharge le job de tests.
- **Commandes** :

```
cd call-analysis/qa && python3 -m pytest -q tests                                              # la mesure elle-même (appel fictif)
python3 call-analysis/qa/qa_run.py --cases DIR --refs DIR --out report.json                   # rejeu des réponses gardées (sans coût)
python3 call-analysis/qa/qa_run.py --cases DIR --refs DIR --mode live --repeat 5 --out report.json   # le modèle, 5 fois
```

  `replay` rejoue les réponses du modèle gardées avec l'analyse (`crm_ca_audit`) : il mesure un changement du code. `live`
  interroge le modèle par `callqa-llm` (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) : il mesure une consigne ou un modèle ;
  options `--split tuning|control|all`, `--effort` (défaut `low`), `--workers`, `--max-cost` (défaut 0,08). Sortie 1 si un
  fichier de référence est invalide ou si le coût moyen dépasse `--max-cost`. Ce qui s'affiche ne contient que des nombres ;
  les erreurs avec leurs citations ne vont que dans `--out`.
- **Corrections de l'écran** : `qa/corrections_to_reference.py --corrections corrections.json --refs DIR [--split tuning]`
  transforme les lignes de `crm_ca_corrections` (requête dans sa docstring, lue avec le service role, jamais dans un
  journal) en réponses de référence.
- **Reconstituer le jeu dans une réplique** (le bucket ne se copie pas : chapitre 08) : créer le bucket privé
  `callqa-fixtures` ; pour chaque appel retenu, construire le fichier de cas depuis la base (`crm_calls`,
  `crm_ca_call_info`, `crm_ca_audit` de son analyse, `crm_ca_config.tiers`) et faire lire l'appel par une personne pour le
  fichier de référence, ou partir des corrections de l'écran ; mettre les deux archives dans `qa/`. Il n'y a pas de script
  d'export des cas dans le dépôt. Sans le corpus `transcripts.tar.gz`, les tests de l'annexe B sont sautés (§ 13).

## 13. Tests

| Suite | Commande | Résultat sur `main` |
|---|---|---|
| Moteur de référence | `cd call-analysis/engine && pip install pytest && python3 -m pytest -q tests` | 288 tests : 263 réussis, 25 lisent le corpus réel (sautés avec `CALLQA_SKIP_MISSING_CORPUS=1`, en échec sans lui et sans corpus) ; autre corpus : `CALLQA_CORPUS=<dossier>` |
| Worker | `cd call-analysis/worker && python3 -m pytest -q tests` | 28 tests : 26 réussis, 2 lisent le corpus réel |
| Moteur allégé | `cd call-analysis/lite && python3 -m pytest -q tests` | 89 réussis (appel fictif) |
| Mesure | `cd call-analysis/qa && python3 -m pytest -q tests` | 14 réussis |
| Qualification | `cd call-analysis/qualification && python3 -m pytest -q tests` | 10 réussis, dont `tests/check_rules.py` (33 cas des règles : `python3 tests/check_rules.py`) |
| Passerelle | `deno test --allow-env --allow-read supabase/tests` | dont `callqa_llm.test.ts` (5 tests) |
| SQL | `web/supabase/tests/run.sh` (Postgres local) | dont `call_analysis_test.sql`, `ca_engine_choice_test.sql`, `lead_qualification_test.sql`, `qualif_in_analysis_test.sql`, `ca_board_rounds_test.sql`, `ca_corrections_test.sql` |
| Écran | `node app/crm/fiche_analyse_live.js $PWD/app/lnp.html <dossier>`, `node app/crm/analyse_decouverte_test.js $PWD/app/lnp.html <dossier>`, `node app/crm/transcript_parse.test.js` | Playwright, données simulées |

Les cinq suites Python ont été lancées le 27 novembre 2026 pour ce chapitre (sans corpus) ; les suites SQL, Deno et
d'écran ne l'ont pas été.

## 14. Workflows, déclencheurs et secrets

`.github/workflows/call-analysis.yml` (« Call analysis ») :

| Job | Déclencheur | Ce qu'il fait |
|---|---|---|
| `test` | `push` sur `main` et `pull_request`, chemins `call-analysis/**` et le workflow | Python 3.11, `pytest` ; télécharge `callqa-fixtures/transcripts.tar.gz` avec la clé service role dans `call-analysis/engine/tests/fixtures/transcripts` (sans clé ou sans archive : `CALLQA_SKIP_MISSING_CORPUS=1`) ; puis moteur, worker, moteur allégé, mesure |
| `worker` | `schedule: "7 * * * *"` et `workflow_dispatch` (`task = worker`) | délai 150 min, `concurrency: call-analysis-worker` sans annulation (un seul worker à la fois) ; rien sans le secret ; `python3 call-analysis/worker/run.py --budget-min 120` avec `CALLQA_EFFORT = inputs.effort` ou `none` |
| `measure` | `workflow_dispatch` avec `task = measure` (entrées `repeat`, `mode` `live` ou `replay`, `effort` : `none` devient `low`) | télécharge `qa/reference.tar.gz` et `qa/cases.tar.gz`, lance `qa_run.py --workers 5 --max-cost 0.08`, renvoie le rapport dans `callqa-fixtures/qa/reports/<run_id>.json` (jamais dans le journal ni en artefact), échoue ensuite si `qa_run.py` a échoué |

`.github/workflows/qualification.yml` (« lead-qualification ») : `push` et `pull_request` sur `call-analysis/qualification/**`
(toutes branches) → tests ; `workflow_dispatch` (entrées `limit`, défaut 30, et `again`) → `qualification/run.py`, délai 90
min, `concurrency: lead-qualification`.

`.github/workflows/crm-functions.yml` déploie `callqa-llm` avec les autres fonctions et lance ses tests Deno et les tests SQL.

| Où | Nom | Lu par |
|---|---|---|
| Secret GitHub Actions | `SUPABASE_SERVICE_ROLE_KEY` | `call-analysis.yml` (tests, worker, mesure), `qualification.yml` |
| Variable GitHub Actions | `SUPABASE_URL` (`https://<réf du projet>.supabase.co`) | les deux workflows (`vars.SUPABASE_URL`) |
| Secret des fonctions Supabase | `ANTHROPIC_API_KEY` | `callqa-llm` |
| Variables d'environnement facultatives | `CALLQA_EFFORT`, `CALLQA_LITE_EFFORT`, `CALLQA_CORPUS`, `CALLQA_SKIP_MISSING_CORPUS` | worker, tests |

## 15. Réinstaller pas à pas

1. Appliquer les migrations dans l'ordre (chapitre 03), dont `020`, `021`, `025`, `029`, `030`, `034`, `035`, `042`,
   `046`, `062`, `063`.
2. Régler `crm_ca_config` comme en production (§ 4.5) et relever `passes`, `default_timezone`, `provisional` sur la base
   d'origine.
3. Créer le secret de fonction `ANTHROPIC_API_KEY` et déployer `callqa-llm` (workflow `crm-functions.yml`).
4. Dans GitHub : secret `SUPABASE_SERVICE_ROLE_KEY`, variable `SUPABASE_URL`.
5. Créer le bucket de stockage privé `callqa-fixtures` (vide au départ : les tests de l'annexe B sont sautés, la mesure ne
   tourne qu'une fois le jeu reconstitué, § 12).
6. Brancher Fathom (chapitre 04) : chaque enregistrement rattaché à un R1 ou un R2 met l'appel en file. Pour vérifier sans
   attendre : coller une transcription depuis la fiche d'un lead, puis Actions › Call analysis › Run workflow
   (`task = worker`), ou `SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… python3 call-analysis/worker/run.py --once` en local.
7. Contrôler : `select status, error, usage->>'usd', engine_version from crm_ca_jobs order by created_at desc limit 5;` ;
   l'analyse s'ouvre depuis la fiche (lien « Analyse ») ; un R1 porte sa qualification.

## 16. Relancer les analyses après un changement de règles (C8)

Une note calculée sous une version de règles ne se compare jamais à une note calculée sous une autre (Partie C, C8) : quand
une version change (par exemple `GAP-1.4` → `GAP-1.5`), les analyses gardées sont à relancer. Une analyse gardée n'est
jamais modifiée : on crée de nouveaux jobs, le worker écrit de nouveaux enregistrements, l'écran montre le plus récent.

- Un appel : « Relancer l'analyse » (`crm_ca_retry`) n'est offert qu'après un échec ; sinon « Remplacer la transcription »
  remet l'appel en file.
- En série (éditeur SQL de Supabase ; sur la base en ligne, seulement après accord de Romain) : mettre en file les R1 dont
  la dernière analyse porte une ancienne version, **puis**, dans une seconde requête, les R2, pour que chaque R2 lise
  l'analyse à jour de son R1 (`crm_ca_claim` prend les jobs par `created_at`, un seul worker à la fois) :

```sql
insert into crm_ca_jobs (call_id)
select d.call_id
  from (select distinct on (call_id) call_id, job_id from crm_ca_records order by call_id, created_at desc) d
 where (crm_ca_call_info(d.call_id)->>'sales_round')::int = 1            -- puis 2 dans une seconde requête
   and exists (select 1 from crm_ca_results x where x.job_id = d.job_id and x.competence = 'GAP' and x.rules_version <> 'GAP-1.5')
   and not exists (select 1 from crm_ca_jobs j where j.call_id = d.call_id and j.status in ('queued', 'running'));
```

  Adapter la compétence et la version à la règle changée. Coût : environ 0,07 USD par appel (§ 8) ; le worker traite les
  jobs pendant 120 min à chaque heure. Les corrections de l'écran restent sur l'ancien job.
- Mesurer d'abord sans coût : `qa_run.py --mode replay` rejoue les réponses gardées avec le nouveau code (§ 12).

## 17. Hors de `main` : les PR #81, #82 et #83

À la date du relevé, trois PR de l'analyse d'appel ne sont pas fusionnées (chapitre 08) : elles changent encore le moteur
allégé et la mesure, **elles ne tournent pas en production** et une réplication à l'identique part de `main`. D'après les
branches non fusionnées du dépôt, elles portent notamment : l'appel qui n'est pas un appel de vente (C1b,
`not_sales_call`) et la double lecture de la reformulation (C4) ; la référence experte (appels lus en entier, mention de
l'offre comptée à la fin de la description, seuil d'exclusion de la découverte à 20 %, accueil et exploration d'une
objection par le code) ; la réaction du prospect et les résistances lues réplique par réplique (OB-28, OB-29) et un plafond
de coût porté à 0,20 USD. Rien de cela n'est dans le code de `main` décrit ici.

## 18. Écarts entre la documentation et le code

| Documentation | Code sur `main` (fait foi) |
|---|---|
| `call-analysis/CLAUDE.md` : 263 tests réussis, « 20 need CALLQA_CORPUS » ; « Sources of truth » : 236 tests ; `README.md` et `engine/README.md` : 205 tests ; workflow : « Engine (184 tests) » | 288 tests, 263 réussis et 25 sur le corpus réel |
| `call-analysis/README.md` : les transcriptions de test sont dans `engine/tests/fixtures/transcripts/` | dossier ignoré par git, rempli en CI depuis `callqa-fixtures/transcripts.tar.gz` |
| `qualification/README.md` et le nom de test `test_the_rules_script_passes_its_19_cases` : 19 cas | `tests/check_rules.py` : 33 cas |
| `docs/OUTPUT_CONTRACT.md` : qualification 2.2, trois portes ; statuts `ok`, `no_transcript`, `no_diarization`, `diarization_suspect` | qualification 2.3, cinq portes ; statut `recording_incomplete` en plus (porte des 20 minutes) |
| Commentaires de 042 et 046, docstring de `callqa_worker/qualif.py` : règles 2.1, « quatre portes » ; défaut SQL de `crm_qualif_candidates` : `lnp-sql-v2.1-2026-11-05` | `qualification_lnp-v2.3` ; `run.py` passe `PROMPT_VERSION` (`lnp-sql-v2.3-2026-11-21`) |
| `lite/README.md` (tableau des étapes) : S1 par blocs de 160 répliques | `DEFAULTS["s1_chunk_turns"] = 40` (le même README le dit plus bas) |
| `lite/README.md` : cible de 0,10 USD ; `docs/ARCHITECTURE.md` § 7 : arbitre Opus, effort `none` par défaut | paliers de production Haiku, Haiku, Sonnet ; moteur allégé à l'effort `low` (`CALLQA_LITE_EFFORT` non posé) ; `none` ne vaut que pour le moteur de référence |
| Chapitre 04 du dossier (§ 8, § 9) : effort par défaut `low` du worker, pas de `prefix` ni de `none` dans la passerelle, moteur de référence seul | remplacé par ce chapitre : worker `none`, passerelle avec `prefix` et `none`, moteur allégé en production |
| `crm_ca_config.default_timezone` = `Asia/Dubai` (020) | l'heure de référence de LNP est Europe/Paris ; la valeur de production n'est pas relevée |
| `SCREEN_SPEC.md` renvoie à `docs/screen/call_analysis_mockup.dc.html` | dossier ignoré par git, absent du dépôt |

Non vérifié pour ce chapitre : l'existence de `transcripts.tar.gz` dans le bucket (le chapitre 08 ne cite que `qa/`),
les valeurs de production de `passes`, `default_timezone` et `provisional`, la correspondance exacte entre les numéros
#81, #82, #83 et les branches non fusionnées, et les suites SQL, Deno et d'écran (non lancées).
