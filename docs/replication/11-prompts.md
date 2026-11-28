# 11 · Les prompts

Ce chapitre est le catalogue de **chaque prompt que l'application envoie à un modèle de langue** : où il vit dans le dépôt, à
quelle étape et à quel moment il part, avec quel modèle, ce qui y entre et ce qui doit en sortir, et qui lit la réponse dans le
code. Il sert à vérifier qu'une réplique envoie exactement les mêmes prompts que `main`, et à les modifier sans casser
l'analyse. Relevé sur `main` le 28 novembre 2026 ; le code fait foi.

Tous les modèles sont ceux d'Anthropic, appelés par l'API Messages (`https://api.anthropic.com/v1/messages`) avec le secret
`ANTHROPIC_API_KEY` des fonctions Supabase. Aucune clé n'est dans le dépôt, aucun prompt n'est journalisé. Le fonctionnement
de l'analyse d'appel (worker, passerelle, paliers, coût) est décrit au chapitre 09 ; celui du Simulateur au chapitre 04, § 10.
Ce chapitre ne les répète pas : il dit ce que contient chaque prompt.

## Sommaire

1. [Vue d'ensemble](#1-vue-densemble)
2. [Règles communes](#2-règles-communes)
3. [Analyse d'appel : le moteur allégé (production)](#3-analyse-dappel--le-moteur-allégé-production)
4. [Analyse d'appel : le moteur de référence](#4-analyse-dappel--le-moteur-de-référence)
5. [Qualification du lead](#5-qualification-du-lead)
6. [La passerelle `callqa-llm` (un contrat, pas un prompt)](#6-la-passerelle-callqa-llm-un-contrat-pas-un-prompt)
7. [Simulateur](#7-simulateur)
8. [Connecteur Claude : les descriptions des outils](#8-connecteur-claude--les-descriptions-des-outils)
9. [Ce qui n'est pas un prompt de l'application](#9-ce-qui-nest-pas-un-prompt-de-lapplication)
10. [Hors production : la PR #83](#10-hors-production--la-pr-83)
11. [Vérifier les prompts dans une réplique](#11-vérifier-les-prompts-dans-une-réplique)
12. [Modifier un prompt](#12-modifier-un-prompt)
13. [Écarts entre la documentation et le code](#13-écarts-entre-la-documentation-et-le-code)

---

## 1. Vue d'ensemble

| Famille | Où | Prompts | Langue | Passe par | Modèle en production |
|---|---|---|---|---|---|
| Analyse d'appel, moteur allégé (`crm_ca_config.engine = 'lite'`) | `call-analysis/lite/callqa_lite/prompts/` | 10 fichiers, 9 tâches | anglais | worker GitHub Actions → `callqa-llm` | `tiers.fast` (`claude-haiku-5-5`), `tiers.arbiter` (`claude-sonnet-5-5`) |
| Analyse d'appel, moteur de référence (`engine = 'full'`, hors production) | `call-analysis/engine/lnp_callqa/prompts/` | 31 fichiers (`system_common.md` + 30 tâches) | anglais | worker → `callqa-llm` | `fast`, `strong` (`claude-haiku-5-5`), `arbiter` (`claude-sonnet-5-5`) |
| Qualification du lead (chaque R1 analysé) | `call-analysis/qualification/prompts/extraction.md` | 1 fichier + 1 phrase système | français | worker → `callqa-llm` | `fast` puis `strong` (`claude-haiku-5-5`) |
| Simulateur, le prospect | `supabase/functions/_shared/simulateur/build-gated-*.ts` | 3 gabarits assemblés à chaque tour | français | fonction Edge `simulateur` → API | `crm_sim_config.claude_model` (`claude-sonnet-5-5`) |
| Simulateur, analyses de signaux | `_shared/simulateur/haiku-*.ts`, `prospect.ts` | 5 | français | `simulateur` → API | `claude-haiku-5-5` (écrit dans le code) |
| Simulateur, grille d'analyse de fin d'appel | `_shared/simulateur/grille/prompts.ts` | 9 | français (sans accents) | `simulateur` → API | `claude-haiku-5-5`, `claude-sonnet-5-5` (écrits dans le code) |
| Simulateur, offres et prospects générés | `_shared/simulateur/prompts/*.md` → `prompts.ts` | 12 | français | `simulateur` → API | `claude-sonnet-5-5` (écrit dans le code) |
| Connecteur Claude (lu par Claude côté personne) | `web/api/mcp.js` | 1 consigne de serveur + 12 descriptions d'outils | anglais | — | celui de la personne |

Les réglages qui choisissent un modèle : `crm_ca_config.tiers` (analyse d'appel et qualification) et
`crm_sim_config.claude_model` (la voix du prospect seulement). Leurs valeurs de production sont dans
`docs/replication/configuration/production.sql` (chapitre 08) : **la migration 020 met d'autres valeurs par défaut**
(`fast` Haiku, `strong` Sonnet, `arbiter` Opus), il faut donc appliquer ce fichier. `crm_settings.analysis_model`
(`claude-sonnet-5-5`, migration 003) n'est lu par aucun code.

## 2. Règles communes

- **Le modèle extrait et cite, le code décide et note.** Aucun prompt de l'analyse d'appel ne demande une note, un niveau ou
  un verdict : le modèle répond à des questions fermées, en JSON, chaque réponse positive appuyée sur une citation exacte
  d'une réplique ; le code vérifie chaque citation (sous-chaîne exacte, bon rôle, bonne phase : Partie C, C3) et calcule
  tout le reste. Même principe pour la qualification (le modèle rapporte des faits, `qualification_lnp.py` décide) et pour
  la grille du Simulateur (les P2 « collectent des signaux », le moteur d'agrégation `grille/moteur/` note).
- **Les prompts de l'analyse d'appel restent en anglais** : les traduire changerait la lecture du modèle (`CLAUDE.md` du
  dépôt, `call-analysis/lite/README.md`). Le code lit le français des appels (`engine/lnp_callqa/core/lang_fr.py`). Les
  exemples des prompts sont inventés.
- **Les prompts du Simulateur viennent de la source, neutralisés** : copiés mot pour mot du service d'origine, sauf le nom
  de la méthode (« grille d'analyse »), les noms des étapes, les noms de personnes, d'entreprises et de produits des
  exemples ; aucun autre nom d'entreprise que LNP, jamais le mot anglais pour le commercial qui conclut ni pour la
  conclusion d'une vente. Deux tests le contrôlent (§ 11).
- **Les prompts sont versionnés avec le code.** Une modification de prompt est une modification du moteur : elle va avec
  une version de règles (`RULES` de `lite/callqa_lite/engine.py` : `SPIN-1.3`, `GAP-1.5`, `PITCH-2.0`, `OBJ-1.1` ;
  `rules_version` de chaque compétence du moteur de référence), la version du moteur (`LITE_VERSION = "callqa-lite-1.1"`,
  gardée dans `crm_ca_jobs.engine_version`), la version de la qualification (`PROMPT_VERSION =
  "lnp-sql-v2.3-2026-11-21"`, `RULES_VERSION = "qualification_lnp-v2.3"`, gardées dans `crm_lead_qualifications`), le
  référentiel du Simulateur (`referentiel-version.ts`). Chaque appel au modèle de l'analyse garde l'empreinte de son prompt
  (`prompt_hash`, 16 caractères du SHA-256 de `system + prompt`) dans `crm_ca_audit`.
- **Après un changement de prompt ou de règle, les analyses gardées sont à relancer** (C8, chapitre 09, § 16) : une note
  d'une version ne se compare jamais à une note d'une autre.
- **Ne jamais régler un prompt sur les appels de contrôle** (C7) : le jeu de référence a des appels `tuning` (pour trouver
  et corriger) et `control` (jamais regardés pendant un réglage ; ils disent si la correction se généralise).
- Une réponse qui n'est pas un JSON valide est redemandée **une fois** avec l'erreur (analyse d'appel et qualification), ou
  jusqu'à trois fois (offres, miroir du Simulateur) ; la grille du Simulateur ne redemande pas.

## 3. Analyse d'appel : le moteur allégé (production)

Assemblage (`lite/callqa_lite/steps.py`, `Steps.ask`) : chaque étape envoie à `callqa-llm` trois blocs, `system` (mis en
cache), `prefix` (mis en cache, écrit une fois puis relu par les étapes suivantes) et `prompt` (non mis en cache), avec
`effort = low` (`CALLQA_LITE_EFFORT`, que le workflow ne pose pas). Le `prompt` est le fichier `.md` dont le code remplace
les emplacements `{nom}` (`fill`) ; les accolades des exemples JSON restent. Une réponse refusée est redemandée une fois en
ajoutant « YOUR PREVIOUS ANSWER WAS REJECTED BY THE CODE: <erreur>. Return only the JSON object… ». Le `prefix` est la
transcription réparée (`TRANSCRIPT · n turns` puis `T001 [SALES] texte`, une réplique par ligne, les répliques douteuses
retirées) ; pour SV, les lignes de l'enregistreur (`L001 [SALES] texte`).

| Fichier | Étape (`task_id`) · quand | Modèle (palier) · `max_tokens` | Entrée (emplacements remplis par le code) | Sortie attendue (JSON) | Qui la lit |
|---|---|---|---|---|---|
| `system.md` | consigne système de S0 à S4 et de l'arbitre | — | — | règles de preuve : citation de 2 à 40 mots d'une seule réplique, rôle juste, un « oui » ne prouve qu'un accord, un seul objet JSON | — |
| `sv_system.md` | consigne système de SV | — | — | lister seulement les lignes mal attribuées | — |
| `sv_voices.md` | SV, `lite.sv_voices` puis `lite.sv_control` (même prompt sur les lignes réparées) · chaque appel, avant tout, par blocs de 150 lignes (40 au moins si un bloc est coupé) | `fast` · 8 000 | `{first}`, `{last}` : les lignes du bloc | `{"lines": [{"line", "role", "from"?}]}` | `voices.py` : `check`, `relabel`, `join` ; plus de 10 % de lignes encore fausses → `diarization_suspect` |
| `s0_phases.md` | S0, `lite.s0_phases` · une fois par appel | `fast` · 12 000 | aucun emplacement | `{"turns": [{"turn", "quote", "offer_description", "screen_share", "price_for_offer", "amount", "range", "decision_request", …}]}` | `phases.py` (`apply_phases` → `decide_phases`) ; sans réponse valide → `LiteModelError`, rien n'est gardé |
| `s1_discovery.md` | S1, `lite.s1_discovery` · par blocs de 40 répliques de la découverte (15 au moins) ; redemandé une fois pour les questions oubliées (`…:missing`) ; sauté après un bon écart dans un appel précédent (C9) | `fast` · 16 000 | `{window}` (les répliques du bloc, la limite SB-34), `{inventory}` (les questions listées par le code, `Q030 · T030 · PRIORITY: "…"`) | `{"questions": [{"id", "letter", "object", "register_domain", "answer", "atoms": [{"type", "turn", "quote", …}]}]}` | `engine.py` (`with_inventory`), `spin.py` (`run_spin`, `build_atoms`) |
| `s1_gates.md` | S1g, `lite.s1_gates` · par paquets de 25 questions, deux lectures (la seconde à l'envers, unité `…:p2`) | `fast` · 12 000 | `{units}` : chaque question avec les 2 répliques d'avant, les autres questions de la réplique, la réponse | `{"units": [{"id", "g1"…"g5", "routing", "is_solicitation"}]}`, seulement ce qui est vrai, sans citation | `run_gates` → `spin.normalize_gates`, `decide_letter` |
| `s1_gates_arbiter.md` (+ `s1_gates.md`) | S1g, `lite.s1_gates_arbiter` · seulement les questions dont les deux lectures mènent à des lettres différentes, ou sans porte franchie alors que la réponse porte un effet (`gates:absent_reread`) | `arbiter` · 8 000 | `prefix` = `ARBITER_PREFIX` (pas de transcription) ; `{units}` avec, sous chaque unité, `READER 1: letter …` et `READER 2: …` | même schéma que `s1_gates.md` | `run_gates` → `arbitrated`, ou `to_review` si l'arbitre échoue |
| `s2_gap.md` | S2, `lite.s2_gap` · une fois, sauf compétence sautée (C9) ou plantage de SPIN | `fast` · 16 000 | `{anchors}` (la carte des phases décidée par le code), `{limit}` (premier prix ou demande de décision), `{statements}` (les phrases du prospect par élément, chiffres du code compris, 160 au plus) | `{"passages": [{"turns", "clauses": [{"component", "sales_turn", "sales_quote", "source_turn", "key_expression"}], "validation"}], "deadlines": […]}` | `gap.py` → `GapCompetence` (GB-22, GB-22b, `figures`, `costs`, `blockers`, `restate`) |
| `s3_pitch.md` | S3, `lite.s3_pitch` · si un début de présentation existe et qu'aucun appel précédent n'en a | `fast` · 10 000 | `{anchors}`, `{vp}` (P validé), `{a}`, `{b}`, `{blockers}`, `{references}` (référence d'offre, mécanismes, bibliothèque de cas) | `{"category", "step1"…"step4", "roadmap", "claims", "promises", "adhesion"}` | `pitch.py` (`PitchAnswers`) → `PitchCompetence` |
| `s4_objections.md` | S4, `lite.s4_objections` · s'il y a un premier prix (ou un prix donné dans un appel précédent) | `fast` · 10 000 | `{anchors}`, `{window}` : `WINDOW_PRICE` (après le premier prix, OB-27) ou `WINDOW_START` (tout l'appel, sans prévention) | `{"objections": [{"subjects", "quotes", "topic_change", "acknowledge", "isolate", "explore", "gesture", "reaction"}], "prevention": {…}}` | `objections.py` (`run_objections`) |

Textes ajoutés par le code, à recopier avec le reste : `WINDOW_PRICE`, `WINDOW_START`, `ARBITER_PREFIX`, `anchors()`,
`inventory_text()`, `gates_units_text()` (`engine.py`), `statements_text()` (`gap.py`), `context_text()` (`pitch.py`), la
phrase de nouvel essai (`steps.py`). Une porte d'enregistrement (moins de 20 minutes) ou de diarisation arrête l'appel
**avant** tout prompt.

## 4. Analyse d'appel : le moteur de référence

Assemblage (`engine/lnp_callqa/core/runner.py`) : la consigne système est `system_common.md` + `\n\n` + le fichier de la
tâche ; le message de la personne est construit par la fonction `build` de la tâche (l'extrait de transcription de l'unité
et la question, avec le schéma JSON). Chaque unité est posée **trois fois** (`passes`) ; une réponse invalide est
redemandée une fois avec les codes d'erreur ; trois clés identiques → `verified` ; sinon l'arbitre (palier `arbiter`,
passe 0) reçoit le même message suivi de « THREE INDEPENDENT READINGS OF THIS UNIT (do not vote…) », des trois lectures et
de la demande d'un `justification` et d'un `case_label` → `arbitrated`, ou `to_review` si `undecidable`. Par la passerelle
(`callqa_worker/gateway.py`, `ask`) : `max_tokens` 4 000, `cache_prompt` à partir de la passe 1, effort `none` partout
(`CALLQA_EFFORT` du workflow) sauf `foundation.*` (`default`) ; sans `none`, `spin.register` passe à `medium`. Catalogue
complet des unités : `call-analysis/docs/ARCHITECTURE.md` § 4.3.

| Fichier | Étape (`task_id`) | Palier | Unité envoyée | Sortie attendue | Lu par |
|---|---|---|---|---|---|
| `system_common.md` | consigne système de chaque tâche | — | — | règles de preuve, champ `uncovered` pour un cas non prévu | — |
| `foundation_attribution.md` | F2 `foundation.attribution` | fast | blocs de 60 répliques | répliques fusionnées, inversées ou en écho, avec la partie étrangère citée | `core/foundation.py` |
| `foundation_phases.md` | F3 `foundation.phases` | fast | une réplique du commercial avec offre, montant ou décision | description d'offre, partage d'écran, prix, montant, hypothèse, demande de décision | `core/foundation.py` |
| `spin_gates.md` | C1 `spin.gates` | fast | une sollicitation | `is_solicitation`, `routing`, les portes ordonnées avec preuves | `competences/spin.py` |
| `spin_atoms.md` | C1 `spin.atoms` | strong | une réponse | `{"atoms": [{"type", "turn", "quote", "quantified", "value", "unit", …}]}` | `spin.py` |
| `spin_link.md` | C1 `spin.link` | fast | deux sollicitations codées | `{"same_object", "quote"}` | `spin.py` |
| `spin_reopen.md` | C1 `spin.reopen_end` (plus posée depuis SPIN 1.2, SB-34) | fast | une réouverture | `{"end_turn", "quote"}` | `spin.py` |
| `spin_register.md` | C1 `spin.register` | fast | une question de la découverte | `{"asked_domain", "basis", "quote", "reference_turn"}` | `spin.py` |
| `gap_restitution.md` | C2 `gap.restitution` | strong | un passage candidat | les éléments repris, leur source, l'expression clé | `competences/gap.py` |
| `gap_validation.md` | C2 `gap.validation` | strong | une reformulation | l'issue de la réponse du prospect, citée | `gap.py` |
| `gap_a_current.md` | C2 `gap.a_current` | fast | un chiffre candidat pour A | `present_state`, `quote` | `gap.py` |
| `gap_stopping.md` | C2 `gap.stopping` | fast | les questions codées P | `is_stopping_question`, `quote` | `gap.py` |
| `gap_horizon.md` | C2 `gap.horizon` | fast | le B retenu | `horizon`, `binding` | `gap.py` |
| `pitch_category.md` | C3 `pitch.p_category` | strong | le P validé | une des neuf catégories de blocage, ou inconnue | `competences/pitch.py` |
| `pitch_step1.md` à `pitch_step4.md` | C3 `pitch.step1` à `pitch.step4` (4 fichiers) | strong | la fenêtre de présentation | les bornes de chaque marche et ses champs | `pitch.py` |
| `pitch_roadmap.md` | C3 `pitch.roadmap` | strong | après la marche 4 | bornes et étapes de la feuille de route | `pitch.py` |
| `pitch_claims.md` | C3 `pitch.claims` | strong | blocs de 40 répliques | `{"claims": [{"kind", "quote", "turn", "library_id"}]}` | `pitch.py` |
| `pitch_promises.md` | C3 `pitch.promises` | strong | blocs de 40 répliques | `{"promises": [{"quote", "turn", "action"}]}` | `pitch.py` |
| `pitch_adhesion.md` | C3 `pitch.adhesion` | fast | blocs de 40 répliques | `{"passages": [{"quote", "turn", "kind", "concrete", "gesture"}]}` | `pitch.py` |
| `objections_nominate.md` | C4 `obj.nominate` | fast | blocs de répliques | `{"nominations": [{"turn", "quote"}]}` | `competences/objections.py` |
| `objections_resistance.md` | C4 `obj.resistance` | strong | un candidat | `exclusion` (liste fermée), sujets du doute | `objections.py` |
| `objections_topic.md` | C4 `obj.topic` | fast | une réplique que le code ne tranche pas | `{"new_subject", "receive_and_leave", "quote"}` | `objections.py` |
| `objections_acknowledge.md`, `objections_isolate.md`, `objections_explore.md` | C4 `obj.acknowledge`, `obj.isolate`, `obj.explore` | fast | un épisode | les gestes A, I, E, chacun cité | `objections.py` |
| `objections_gesture.md` | C4 `obj.gesture` | strong | un épisode | `answer_given`, `answer_tied_to_prospect`, citations | `objections.py` |
| `objections_resolution.md` | C4 `obj.resolution` | strong | un épisode | `reaction_kind` (liste fermée), citation | `objections.py` |
| `objections_prevention.md` | C4 `obj.prevention` | strong | les répliques avant le premier prix | décideur, influenceurs, budget, échéance, tentative passée | `objections.py` |

Hors du worker, `python3 -m lnp_callqa.pipeline transcript.txt --config call.json` appelle l'API en direct avec
`core/llm.py › AnthropicClient` (paquet `anthropic`, `max_tokens` 4 000) : voir le § 13 pour la température.

## 5. Qualification du lead

`call-analysis/qualification/agent.py` (`read_once`, `qualify_call`), appelé pour chaque R1 par
`call-analysis/worker/callqa_worker/qualif.py` et, à la main, par `qualification/run.py` (workflow `lead-qualification`).

| Fichier | Étape · quand | Modèle (palier) | Entrée | Sortie attendue | Lu par |
|---|---|---|---|---|---|
| `prompts/extraction.md` (le document de qualification tel quel, version `lnp-sql-v2.3-2026-11-21`) | `qualif.extraction` · chaque R1 analysé (`sales_round = 1`), deux lectures, chacune redemandée une fois si la réponse n'est pas du JSON | lecture 1 `fast`, lecture 2 `strong` (`claude-haiku-5-5` tous deux) · `max_tokens` 8 000 · effort `low` | système : « Tu extrais des faits d'une transcription d'appel et tu réponds uniquement par du JSON valide. » ; `prefix` : `<transcription>` … `</transcription>` (les répliques de l'analyse, `[mm:ss] SALES: texte`) ; emplacements `{{date_appel}}`, `{{oui_ou_non}}` (`oui`), `{{transcription}}` (renvoi au préfixe), `{{analyse}}` (`aucune`) | un JSON de faits : `meta`, `appel`, `metier`, `projet`, `financement`, `decision`, `concurrence`, `vente`, `contradictions`, chaque fait `{valeur, preuve, minutage}` | `agent.verify` (une preuve introuvable remet le fait à « inconnu »), puis `qualification_lnp.qualifier` (cinq portes, statut) ; gardé par `crm_qualif_store` |

## 6. La passerelle `callqa-llm` (un contrat, pas un prompt)

`supabase/functions/callqa-llm/index.ts` → `_shared/callqa_llm.ts › handleLlm` ne contient aucun prompt : elle transmet
`{model, system, prompt, prefix?, max_tokens?, effort?, cache_prompt?}` à l'API (un seul message `user`, `prefix` en premier
bloc mis en cache, `system` toujours mis en cache, `prompt` mis en cache si `cache_prompt`), sans température, et renvoie
`{text, usage, model, stop_reason}`. `max_tokens` 4 000 par défaut (1 à 16 000), effort `low` par défaut (`none` coupe la
réflexion, `default` n'envoie rien). Contrat complet, erreurs et tests : chapitre 09, § 5.

## 7. Simulateur

Client : `supabase/functions/_shared/simulateur/llm.ts`. `appeler` (réponse entière) et `diffuser` (flux) n'envoient pas de
température et coupent la réflexion (`sansReflexion` : Sonnet `thinking: between_tools` + effort `low`, Haiku `thinking:
disabled`, Opus effort `low`) ; `appeler` met la consigne système en cache sauf `cacheSystem: false` et refait deux essais
sur `429` / `5xx`.

### 7.1 Le prospect

| Fichier | Quand | Modèle · `max_tokens` | Entrée | Sortie attendue | Lu par |
|---|---|---|---|---|---|
| `build-gated-prompt.ts › buildGatedDiagnosticPrompt` | chaque réplique du commercial, modes `diagnostic` et `full` (phase diagnostic) | `crm_sim_config.claude_model` si dans `MODELES_PROSPECT` (Sonnet, Haiku, Opus), sinon `claude-sonnet-5-5` · 900 · en flux | système (mis en cache) assemblé à chaque tour depuis le prospect (`crm_sim_personas.full_persona_data`), l'offre (`crm_sim_offers.data`), l'état du moteur (confiance, contenus débloqués, résistance), `RÈGLES DE RÉPONSE` (longueurs mesurées sur les vrais appels R1), `LOQUACITE`, `PCM_BLOCS` (`pcm-blocs.ts`), le bloc « AUJOURD'HUI » de la variante (`variantes.ts › blocVariante`) ; messages : la conversation (commercial = `user`, prospect = `assistant`), 60 au plus (`fenetreGlissante`), l'avant-dernier mis en cache | du texte : la réponse parlée du prospect, sans didascalie | `routes.ts` (`crm_sim_messages`, `simulation_state`) ; à la voix, `voix.ts` la prépare pour ElevenLabs |
| `build-gated-objections-prompt.ts › buildGatedObjectionsPrompt` | mode `objections`, et la phase objections du mode `full` | idem | idem, avec l'état des objections (objection active, résistance, tours) | idem | idem |
| `build-gated-full-prompt.ts` | mode `full` | idem | choisit l'un des deux gabarits selon la phase | idem | idem |
| `prospect.ts › consignesProspect` (repli) | une offre introuvable | idem | « Tu es <nom>, un prospect. Profil : … » | idem | idem |

À la voix, la réponse est redemandée jusqu'à deux fois si elle fait moins de 10 caractères, et les analyses de signaux
tournent pendant la réponse (le prospect répond avec l'état du tour d'avant). Les premières répliques du prospect
(`buildFirstMessage`, `buildObjectionsFirstMessage`) sont écrites par le code, sans modèle.

### 7.2 Les analyses de signaux, tour par tour

Toutes par `prospect.ts › appelRapide` : `claude-haiku-5-5` (`MODELE_RAPIDE`), `max_tokens` 300, consigne système mise en
cache, un échec a toujours un repli (jamais d'erreur à l'écran). Usage compté sous `usage.signaux`.

| Prompt (système · message) | Quand | Sortie attendue (JSON compact) | Lu par |
|---|---|---|---|
| `haiku-commercial-quality.ts` : `HAIKU_A_SYSTEM` · `buildHaikuAInput` | chaque réplique en phase diagnostic, en parallèle du suivant | `{"cq", "r", "e", "dr", "f", "rp", "pd", "pc"?}` (qualité, reformulation, empathie, type de réplique, présentation détectée) | `etat/haiku-diagnostic-mapper.ts`, `simulation-state-manager.ts` (confiance, passage aux objections) |
| `haiku-signal-extractor.ts` : `HAIKU_SIGNAL_EXTRACTOR_SYSTEM` · `buildHaikuSignalExtractorInput` | idem | `{"qt", "qd", "ph", "rv", "sy", "gp", "eg", "vl", "f"}` (type de question, profondeur, contenus révélés) | `etat/haiku-c-postprocess.ts`, `applyHaikuCResult` |
| `haiku-objection-handler.ts` : `HAIKU_OBJECTION_HANDLER_SYSTEM` · `buildHaikuObjectionHandlerInput` | chaque réplique en phase objections | `{"od", "ot", "ac", "is", "ch", "ug", "us", "at", "f", "ao"}` | `etat/haiku-objection-mapper.ts`, `objection-resistance-engine.ts` |
| `haiku-pcm-scorer.ts` : `HAIKU_PCM_SCORER_SYSTEM` · `buildHaikuPcmScorerInput` | une présentation détectée, si le prospect a un type PCM | `{"score": 0 à 10}` | `scorePitchPcm` → résistance initiale des objections |
| `prospect.ts › verdictConclusion` (système et message écrits dans la fonction) | quand le moteur d'état juge le prospect prêt à décider | une phrase à la première personne (« tu y vas ou pas ? ») | `simulation_state.verdictConclusion` |

### 7.3 La grille d'analyse de fin d'appel

`grille/pipeline.ts › analyserGrille`, lancée par `POST simulations/:id/end` (en arrière-plan, plafond quotidien
`crm_sim_config.daily_analysis_limit`, reprise par `balayer` toutes les 10 minutes). Les prompts sont dans
`grille/prompts.ts`, **dans le message de la personne, sans consigne système** ; emplacements `{{…}}` remplis par
`remplir` (chacun doit être présent, vérifié au chargement par `EMPLACEMENTS_ATTENDUS`). JSON lu du premier `{` au dernier
`}`, sans nouvel essai. Le prétraitement (`pretraitement.ts`) rejette un format inconnu ou un seul interlocuteur **avant**
tout prompt.

| Constante | Étape · quand | Modèle · `max_tokens` | Emplacements | Sortie attendue | Lu par |
|---|---|---|---|---|---|
| `P1_SEGMENTATION` | P1 · toujours (échec bloquant) | `claude-haiku-5-5` · 8 192 | `TRANSCRIPT`, `CONTEXTE` (vide, sauf mode objections : `contexteSimulationObjections`) | `SortieP1` : segments C, L, E, A, R et leurs bornes, moments, objections, issue | `moteur/moteur.ts › agreger` |
| `P2_CONNEXION`, `P2_ECOUTE`, `P2_EXPOSITION`, `P2_RESOLUTION` | P2-C, P2-L, P2-E, P2-R en parallèle (mode objections : P2-R seul) | `claude-haiku-5-5` · 4 096 | `TRANSCRIPT`, le segment (`SEGMENT_C`…), `MOMENTS` (C, E), `OBJECTIONS` et `CONTEXTE` (R) | les signaux de l'étape (`Collecte.c`, `.l`, `.e`, `.r`) | `agreger` |
| `P2_ALIGNEMENT` | P2-A, après P2-E | `claude-haiku-5-5` · 4 096 | `TRANSCRIPT`, `SEGMENTS`, `MOMENTS`, `GAP` (l'écart `e1` de P2-E) | `Collecte.a` | `agreger` |
| `P3_VERIFICATEUR` | P3 · après la collecte (échec → aucune contestation) | `claude-sonnet-5-5` · 4 096 | `TRANSCRIPT`, `COLLECTE`, `SEGMENTATION` | `SortieVerifieur.signaux_contestes` | `agreger` |
| `P4_EXERCICE` | P4 · la cible choisie par le code (`choisirCibleDrill`) | `claude-haiku-5-5` · 2 048 | `CIBLE`, `VERBATIMS` (5 au plus) | `{titre, duree_estimee (1min, 2min, 3min), contexte, consigne, exemple_reponse}` | `redigerDrill` → `result.drill` |
| `MIROIR_SYSTEME` (système, non mis en cache) + `messageMiroir` | le retour d'expérience de la personne (`POST analyses/:id/aar`), ou à la fin de l'analyse s'il est déjà là ; 3 essais | `claude-sonnet-5-5` · 16 384 | transcription, notes des cinq dimensions, point fort et faible, les quatre réponses de la personne | `{"miroir": {moment_bien_gere, moment_difficile, ce_que_je_referais, niveau}}` | `calculerMiroir` → `crm_sim_analyses.miroir` |

Sorties gardées dans `crm_sim_analyses` (`raw` : P1, collecte, vérification, mesures ; `result` ; `cost` par prompt) :
`rejouerMoteur` rejoue le moteur sans modèle. `realisme.ts` (mesure de réalisme) est un calcul, sans prompt.

### 7.4 Les offres et les prospects générés

Source : les `.md` de `_shared/simulateur/prompts/` ; `prompts.ts` est **généré** (les fonctions Edge sont empaquetées, un
fichier lu au démarrage ne se déploie pas toujours) : après chaque changement d'un `.md`, lancer
`node supabase/functions/_shared/simulateur/prompts/build.mjs` (il exige 10 modules d'extraction et découpe les deux
consignes de prospects en `SYSTEM PROMPT` / `USER PROMPT TEMPLATE`). Appels de `offres.ts`, tous en `claude-sonnet-5-5`
(`MODELE_OFFRES`, écrit dans le code), administrateurs seulement, en tâche de fond après `POST offres`, `POST
offres/:id/reanalyser` ou `POST offres/:id/prospects`.

| Fichier | Quand | `max_tokens` · essais | Entrée | Sortie attendue | Lu par |
|---|---|---|---|---|---|
| `extraction-1-identity.md` … `extraction-10-content-for-simulation.md` (10 modules : identité, proposition de valeur, public, structure, prix, preuve sociale, objections courantes, parcours d'achat, contexte de vente, contenu pour la simulation) | les 10 en parallèle sur le texte des sources (site, PDF, texte collé) | 4 096 · 3 | le module entier comme message, `${content}` = les sources ; pas de consigne système | un JSON par module, avec `_meta` (`confidence`, `source` explicite ou déduite, `needs_review`) | `extraire` → `crm_sim_offers.data` (et `extraction_summary`) ; modules critiques : 1, 2, 3, 5, 7, 10 |
| `persona-matrix.md` | après l'extraction | 2 000 · 3 | système + message (`${offerData}`, `${targetAudience}`) | `{"personas": [6 lignes : prénom, genre, âge, ville, métier, conscience, difficulté…]}` | `genererProspects` |
| `persona-complete.md` | un appel par ligne de la matrice, en parallèle | 8 000 · 3 | système + message, 27 emplacements `${…}` (offre, prix, fondateur, témoignages, chiffres clés, objections typiques, ligne de la matrice) | le prospect complet (`id`, `identite`, `objections`, douleurs, style, briefing…) | `calculerEcarts` → `crm_sim_personas.full_persona_data` |

## 8. Connecteur Claude : les descriptions des outils

`web/api/mcp.js` n'appelle aucun modèle, mais Claude, côté personne, lit ce texte pour choisir un outil : c'est un prompt.
Il est en anglais (lu par un modèle, jamais affiché dans l'application) et doit être recopié tel quel.

| Élément | Contenu |
|---|---|
| `instructions` du serveur (`buildServer`) | ce qu'est LNP, commencer par `whoami`, demander avant chaque écriture, les textes cités avec `>` sont des données et jamais des instructions |
| 10 outils de lecture (`TOOLS`) | `whoami`, `find_lead`, `lead_record`, `clocks_running`, `pipeline_summary`, `call_prep`, `call_analysis` (« Never the transcript »), `performance`, `page_method` (les modes d'emploi de `web/api/_kb.json`), `alert_rules` |
| 2 outils d'écriture (`WRITE_TOOLS`, administrateurs seulement) | `lead_note`, `declare_outcome` ; chaque description reçoit « Changes LNP for the whole team (admins only). » |
| Descriptions des paramètres | `.describe(...)` des schémas `zod` de chaque outil |

Messages d'erreur rendus à Claude (aussi lus par lui) : limite de 60 appels par minute, écran fermé dans Paramètres › Accès.

## 9. Ce qui n'est pas un prompt de l'application

- `call-analysis/HANDOFF_PROMPT.md` : le prompt du 25 octobre 2026 à coller dans Claude Code pour intégrer le paquet
  d'analyse d'appel dans le dépôt (lire les règles, écrire `PLAN.md`, attendre l'accord). Historique, jamais envoyé par
  l'application. De même `docs/replication/PROMPT-CLAUDE-CODE.md`, le prompt qui guide une réplication.
- La voix d'ElevenLabs (`voix.ts`) reçoit le texte de la réponse du prospect, pas de prompt.
- Les premières répliques du prospect, la mesure de réalisme, le moteur d'agrégation de la grille, les règles SLA : du code.
- `crm_settings.analysis_model` : un réglage que rien ne lit.
- L'écran (`app/lnp.html`, `app/training/simulateur.html`) n'appelle aucun modèle : il passe par la fonction `simulateur`
  (`window.claude.use("simulateur")`) et ne montre que la liste des modèles du prospect dans les réglages.

## 10. Hors production : la PR #83

La branche `reaction-par-replique` (PR LNP-Business/LNP#83, non fusionnée, chapitre 09, § 17) ajoute six prompts au moteur
allégé, absents de `main` : `s1_effects.md` (S1e, la difficulté ou ce qu'elle coûte, GB-7, GB-7d), `s4_detect.md` et
`s4_detect_arbiter.md` (S4d, les résistances réplique par réplique, OB-29, avec arbitrage), `s4_reactions.md` et
`s4_reactions_arbiter.md` (S4r, la réaction du prospect à chaque résistance, OB-28, avec arbitrage), `s4_objections_ids.md`
(S4, la réponse du commercial à chaque résistance, par identifiants). Une réplique de `main` ne les a pas.

## 11. Vérifier les prompts dans une réplique

1. **Mêmes fichiers.** Comparer les empreintes des dossiers de prompts avec celles de `main` (chapitre 10) :

```bash
sha256sum call-analysis/lite/callqa_lite/prompts/*.md call-analysis/engine/lnp_callqa/prompts/*.md \
  call-analysis/qualification/prompts/extraction.md supabase/functions/_shared/simulateur/prompts/* \
  supabase/functions/_shared/simulateur/grille/prompts.ts supabase/functions/_shared/simulateur/{haiku-*,build-gated-*,pcm-blocs,variantes,prospect}.ts
```

2. **`prompts.ts` à jour** : relancer `node supabase/functions/_shared/simulateur/prompts/build.mjs`, puis vérifier que le
   fichier n'a pas changé (`git diff --exit-code -- supabase/functions/_shared/simulateur/prompts/prompts.ts`). Vrai sur
   `main` le 28 novembre 2026.
3. **Mêmes modèles** : `select tiers, engine, passes from crm_ca_config;` et `select claude_model from crm_sim_config;`
   doivent rendre les valeurs de `configuration/production.sql`.
4. **Les tests** (sans modèle, réponses simulées) :

| Suite | Commande | Ce qu'elle vérifie des prompts |
|---|---|---|
| Moteur allégé | `cd call-analysis/lite && python3 -m pytest -q tests` (89 réussis le 28 novembre 2026) | le prompt assemblé de chaque étape (`MockLiteClient.calls` : inventaire, unités des portes, lectures montrées à l'arbitre, fenêtre de S4, contexte de S3), le nouvel essai, les blocs coupés |
| Moteur de référence | `cd call-analysis/engine && python3 -m pytest -q tests` | les tâches rejouées par `MockClient` (trois passes, nouvel essai, arbitrage), le français lu par le code |
| Worker | `cd call-analysis/worker && python3 -m pytest -q tests` | le corps envoyé à la passerelle (`ask`, `complete`), l'effort par tâche, le choix du moteur, la qualification dans l'analyse |
| Qualification | `cd call-analysis/qualification && python3 -m pytest -q tests` (10 réussis) et `python3 tests/check_rules.py` | emplacements de `extraction.md`, vérification des preuves, deux lectures |
| Fonctions Edge | `deno test --allow-env --allow-read supabase/tests` | `callqa_llm.test.ts` (contrat de la passerelle) ; `simulateur_offres.test.ts` (« les consignes sont embarquées et neutralisées » : 10 modules, emplacements, aucun nom de la source) ; `simulateur_grille.test.ts` (« chaque emplacement présent, aucun nom ni mot interdit », JSON) ; `simulateur_etat.test.ts`, `simulateur_routes.test.ts`, `simulateur_variantes.test.ts` (la variante entre dans les consignes des deux modes), `simulateur_realisme.test.ts` |
| Écran du Simulateur | `node app/training/simulateur_test.js $PWD/app/training/simulateur.html <dossier>` | aucun mot anglais à l'écran |

5. **La mesure** (chapitre 09, § 12) : `qa_run.py --mode replay` rejoue les réponses gardées (mesure un changement du code,
   sans coût) ; `--mode live --repeat 5` repose les prompts au modèle par `callqa-llm` (mesure un prompt ou un modèle :
   justesse, reproductibilité C4, coût moyen sous `--max-cost`, 0,08 USD par défaut). Le workflow `call-analysis.yml`
   (`task = measure`) le fait avec le jeu du bucket `callqa-fixtures`.

## 12. Modifier un prompt

**Analyse d'appel et qualification**

1. Lire `call-analysis/CLAUDE.md` et la règle concernée de `call-analysis/docs/methodology/` : le prompt applique une règle,
   il ne la crée pas. Un changement de règle se fait dans le même changement dans la méthodologie, le moteur, les tests (et
   le mémo concerné).
2. Modifier le `.md` **en anglais**, garder le schéma JSON, ne jamais demander une note, un niveau ni un verdict, garder les
   emplacements (`{window}`, `{units}`…, `{{date_appel}}`…). Exemples inventés seulement, aucune transcription.
3. Ajouter ou adapter un test du moteur allégé ou de référence (réponse simulée de la nouvelle forme).
4. Mesurer sur les appels `tuning` seulement (`qa_run.py --split tuning --mode live`), puis lire les appels `control`
   **sans rien régler dessus** (C7). Comparer au rapport précédent : justesse, reproductibilité, coût.
5. Monter la version : la règle (`RULES` de `engine.py` ou `rules_version` de la compétence), `LITE_VERSION` si la chaîne
   change, `PROMPT_VERSION` de la qualification ; documenter dans `lite/README.md` ou `qualification/README.md`.
6. Après accord de Romain sur la PR et le déploiement, relancer les analyses gardées (C8, chapitre 09, § 16), R1 avant R2.

**Simulateur**

1. Prospect et analyses de signaux : modifier le `.ts` concerné ; garder le français, aucun nom d'entreprise autre que LNP,
   jamais le mot anglais pour le commercial qui conclut.
2. Offres et prospects : modifier le `.md`, puis relancer `prompts/build.mjs` et livrer le `prompts.ts` régénéré avec lui.
3. Grille : modifier `grille/prompts.ts` en gardant chaque emplacement `{{…}}` de `EMPLACEMENTS_ATTENDUS` (le chargement
   échoue sinon) ; une nouvelle version de la grille va avec `referentiel-version.ts` et `docs/crm/20-simulateur.md`.
4. Lancer `deno test --allow-env --allow-read supabase/tests` ; déployer la fonction `simulateur`
   (`.github/workflows/crm-functions.yml`).

Dans tous les cas : ne jamais coller une clé ni une transcription réelle dans un prompt, un test ou une conversation.

## 13. Écarts entre la documentation et le code

| Documentation | Code sur `main` |
|---|---|
| `CLAUDE.md` du dépôt : moteur allégé, « cinq questions au modèle sur l'appel entier » | sept familles d'appels : SV (réparation puis contrôle), S0, S1 (par blocs de 40 répliques), S1g (deux lectures et arbitre), S2, S3, S4 |
| Migration 020 : `tiers` par défaut Haiku, Sonnet, Opus | production Haiku, Haiku, Sonnet (`production.sql`, `cost.py › DEFAULT_TIERS`) : appliquer la configuration |
| `docs/crm/09-call-analysis.md` : le modèle se règle dans `crm_settings.analysis_model` | rien ne lit ce réglage ; les modèles viennent de `crm_ca_config.tiers` |
| Chapitre 04, § 10.3 : « les consignes système marquées pour le cache » pour toutes les requêtes du Simulateur | les prompts de la grille et les modules d'extraction n'ont pas de consigne système ; le miroir envoie la sienne sans cache |
| `llm.ts` et `callqa_llm.ts` : les modèles actuels refusent la température | `engine/lnp_callqa/core/llm.py › AnthropicClient` (appel en direct hors worker) envoie `temperature=0.0` : à retirer avant de s'en servir (non essayé) |
| Docstrings de `agent.py` (règle « à quatre portes ») et de `qualif.py` (règles 2.1) | règles 2.3, cinq portes (déjà au chapitre 09, § 18) |
| Descriptions du connecteur : écran « Sales Day » | Ma journée est fusionnée dans Cycle de vente depuis le 10 novembre 2026 |
| Règle de vocabulaire du dépôt (jamais le mot anglais pour le commercial qui conclut ni pour la conclusion d'une vente) | deux prompts anglais du moteur de référence emploient le second (`pitch_category.md`, `pitch_promises.md`) ; `call-analysis/CLAUDE.md` n'interdit que le premier |
| `extraction.md` : document de qualification « tel quel » | il contient encore une note interne sur ses exemples (à remplacer par des appels réels codés), envoyée au modèle à chaque lecture |
