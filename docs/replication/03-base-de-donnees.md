# 03 — Base de données (Supabase / Postgres)

Ce chapitre décrit tout le back end Postgres de LNP tel que le définissent les fichiers `web/supabase/001_init.sql` et
`web/supabase/003_crm_core.sql` à `web/supabase/034_lnp_fr_labels.sql` (il n'y a plus de `002`), plus, pour les messages,
`web/supabase/052_crm_whatsapp.sql` (WhatsApp Business à la place de Sendblue, décision de Romain du 9 novembre 2026). Il suffit pour recréer la base
et la comprendre sans lire le SQL d'abord ; chaque fait renvoie au fichier qui le pose. Quand une migration redéfinit une
fonction écrite plus tôt, la colonne « définition finale » donne le fichier dont le texte fait foi.

Les Edge Functions, le connecteur Claude et le moteur d'analyse d'appel sont décrits dans leurs propres chapitres ; ici on ne
dit d'eux que ce qu'ils appellent dans la base.

## Sommaire

1. [Vue d'ensemble et conventions](#1-vue-densemble-et-conventions)
2. [Ordre d'application des migrations](#2-ordre-dapplication-des-migrations)
3. [Recréer la base pas à pas](#3-recréer-la-base-pas-à-pas)
4. [Extensions et prérequis Supabase](#4-extensions-et-prérequis-supabase)
5. [Types énumérés](#5-types-énumérés)
6. [Rôles, droits et sécurité au niveau des lignes](#6-rôles-droits-et-sécurité-au-niveau-des-lignes)
7. [Tables, par domaine](#7-tables-par-domaine)
8. [Vue](#8-vue)
9. [Fonctions et RPC](#9-fonctions-et-rpc)
10. [Déclencheurs](#10-déclencheurs)
11. [La chaîne des événements et le projecteur](#11-la-chaîne-des-événements-et-le-projecteur)
12. [Règles métier écrites en SQL](#12-règles-métier-écrites-en-sql)
13. [Réglages `crm_settings`](#13-réglages-crm_settings)
14. [Tâches planifiées (pg_cron)](#14-tâches-planifiées-pg_cron)
15. [Tests SQL](#15-tests-sql)
16. [Écarts avec `docs/crm/` et points d'attention](#16-écarts-avec-docscrm-et-points-dattention)

---

## 1. Vue d'ensemble et conventions

- **Deux mondes dans le schéma `public`.**
  - L'application (001) : `members` (qui peut entrer, avec un rôle d'application) et `docs`, un magasin de documents JSON
    `(col, id) → body` qui sert toutes les collections de l'application (indicateurs, tâches, décisions, `config`…). Le
    navigateur le lit et l'écrit directement (`web/public/lnp-web.js`), en temps réel.
  - Le CRM (003 et suivants) : des tables relationnelles préfixées `crm_` (plus `mcp_oauth_*` pour le connecteur Claude).
    L'en-tête de `003_crm_core.sql` explique cette **exception volontaire** à la convention « tout est un document de `docs` » :
    idempotence garantie par la base (identifiants de source uniques), cloisonnement réel par commercial (RLS ; une ligne de
    `docs` est lisible par tout membre), gros volumes (messages, transcriptions). Ne pas déplacer le CRM dans `docs`.
- **Le navigateur ne fait que lire les tables `crm_*`** (la RLS choisit les lignes). Toute écriture passe par une fonction
  `security definer` qui vérifie le rôle et la propriété du cycle, écrit `crm_audit_log` et l'événement correspondant dans
  `crm_events` (004). Exceptions : `docs` (écrit directement), `crm_member_prefs` (lignes de la personne, via RPC ou en direct).
- **Le journal fait foi.** `crm_events` est le journal de tout ce qui arrive à un prospect ; l'état dérivé d'un cycle
  (étape, statut, compteurs, prochaine action) est **recalculé** à partir du journal par `crm_recompute_cycle` (le
  « projecteur »), de façon déterministe : le relancer donne le même résultat.
- **Idempotence partout** : `crm_events` a une clé unique `(source, source_id)` et toutes les écritures font
  `on conflict … do nothing` (ou `do update`). Les conventions de `source_id` sont listées au §11.4.
- **Horodatages** en `timestamptz` (UTC) ; durées en heures calendaires (003).
- **Textes lus par une personne** (libellés d'étapes, motifs, prochaines actions, messages d'erreur) : en français depuis
  `034_lnp_fr_labels.sql`. Les clés, codes, valeurs d'énumérations et noms de colonnes restent en anglais.
- **Essais à blanc** : les fonctions d'import et de rattrapage prennent un `p_dry boolean`. Le travail est fait dans un bloc
  `begin … exception when sqlstate 'P0D01' then null; end;` ; en mode essai, la fonction lève `P0D01` à la fin, ce qui annule
  tout le bloc mais garde les compteurs calculés, qu'elle renvoie.
- **Valeurs « à décider »** : les seuils et règles que Romain fixe plus tard vivent dans des tables de configuration
  (`crm_stage_definitions`, `crm_rules`, `crm_reason_codes`, `crm_settings`) avec `is_proposal = true` tant qu'ils sont des
  propositions ; `crm_update_config` remet `is_proposal = false` à l'enregistrement.

---

## 2. Ordre d'application des migrations

Appliquer dans l'ordre des numéros. Toutes sont ré-exécutables (« Safe to run again ») **sauf `003_crm_core.sql`**, qui fait des
`create type` et `create table` sans `if not exists` (seuls `event_source`, `inbox_status` et `crm_webhook_log`, créés en phase 0
par un ancien `003a`, sont protégés). Les tests (§15) appliquent 004 et 007 à 034 deux fois de suite.

| Fichier | Ce qu'il ajoute |
|---|---|
| `001_init.sql` | Tables `members` et `docs`, `my_role()`, déclencheur `docs_touch`, RLS de l'application, `docs` dans la publication `supabase_realtime`. |
| `003_crm_core.sql` | Extensions `pgcrypto`, `citext` ; les 16 énumérations ; les 23 tables du CRM (équipe, personnes, configuration, cycles, appels, issues, journal, ventes, paiements, maturation, messages sortants, historique d'étapes, alertes, journal brut des webhooks, éléments non rattachés, rapprochements, exécutions d'agents, analyses, audit) ; `crm_role()`, `crm_sees_all()`, `crm_owns_cycle()`, `crm_sees_person()` ; RLS en lecture ; données initiales (3 étapes, 13 motifs, 6 règles, réglages) ; droits (lecture seule pour `authenticated`). |
| `004_crm_rpc.sql` | Les écritures du navigateur : `crm_require`, `crm_audit`, `crm_admin_set_member`, `crm_declare_outcome`, `crm_add_note`, `crm_reassign_cycle`, `crm_cancel_auto_close`, `crm_set_nurture`, `crm_resolve_unmatched`, `crm_dismiss_unmatched`, `crm_merge_people`, `crm_update_config`, `crm_create_checkout` (bouchon), `crm_merge_alert_defaults`. |
| `005_crm_pipeline.sql` | Le projecteur `crm_recompute_cycle`, `crm_recompute_all`, la recherche de personne (`crm_people_for`, `crm_add_identities`), `crm_owner_for`, `crm_open_cycle`, `crm_apply_items` (rendez-vous iClosed), la file `crm_inbox_pending` / `crm_inbox_mark`. |
| `006_crm_cron.sql` | Extensions `pg_net`, `pg_cron` ; les 4 tâches planifiées (`crm-process-inbox`, `crm-fathom-hourly`, `crm-sla-tick`, `crm-no-show-hourly`). |
| `007_crm_import.sql` | Valeur d'énumération `close_contact_id` ; table `crm_import_runs` ; `crm_import_people`, `crm_import_save`. |
| `008_crm_import_cycles.sql` | `crm_import_iclosed_disqualified` : un cycle disqualifié pour chaque personne importée d'iClosed au statut `DISQUALIFIED`. |
| `009_crm_import_calls.sql` | `crm_import_calls` (cycles et appels R1, R2… à partir de l'historique iClosed) ; vue `crm_people_without_cycle`. |
| `010_crm_first_seen.sql` | Colonne `crm_people.first_seen_at` (remplie), déclencheur `crm_events_first_seen`, vue redéfinie avec la colonne. |
| `011_access_everyone.sql` | Efface `app_metadata.screens` de chaque compte ; `crm_member_from_team` et le déclencheur `members_to_crm` (chaque membre de l'application devient membre du CRM) ; rattrapage pour les membres existants. |
| `012_crm_messages.sql` | Messages et appels (écrits pour Sendblue, abandonné le 9 novembre 2026) : `crm_apply_message_item`, `crm_apply_messages`, `crm_import_messages` ; définition finale dans 052. |
| `013_crm_reclassify.sql` | `crm_reclassify_imported` : relit les cycles importés avec les règles corrigées (gagné, disqualifié, en cours, perdu). |
| `014_mcp.sql` | Tables `mcp_oauth_clients`, `mcp_oauth_codes` ; index `crm_audit_log_actor_at` ; `crm_mcp_call`, `crm_mcp_done` (audit et limite de 60 appels par minute). |
| `015_crm_owners.sql` | `crm_assign_owners_from_hosts`, déclencheur `crm_members_take_leads` ; rattrapage immédiat. |
| `016_crm_sales_cockpit.sql` | Première version de `crm_sales_cockpit_window` et `crm_sales_cockpit` (en `security invoker`). |
| `017_crm_sales_cockpit_fast.sql` | Supprime l'ancienne signature de `crm_sales_cockpit_window` ; les deux fonctions passent en `security definer` (la fenêtre devient interne). |
| `018_crm_won_calls_held.sql` | `crm_mark_won_calls_held` (exécutée une fois) ; `crm_sales_cockpit` regroupe l'équipe par commercial (propriétaire ou hôte iClosed). |
| `019_crm_sales_team.sql` | Table `crm_sales_team` (ligne `valentino`) ; `crm_sales_cockpit` ne montre que ces commerciaux (définition finale). |
| `020_crm_call_analysis.sql` | Colonnes de transcription sur `crm_calls` ; tables `crm_ca_*` (config, offre, cas, travaux, fiches, tours, résultats, audit) ; `crm_ca_can_read`, `crm_ca_call_info`, `crm_ca_add_transcript`, `crm_ca_retry`, `crm_ca_claim`, `crm_ca_store`, `crm_ca_fail`, `crm_ca_latest`, `crm_ca_record` ; RLS. |
| `021_crm_call_analysis_board.sql` | `crm_ca_board()` : un rang par appel R1/R2 passé analysable, avec l'état de son analyse. |
| `022_crm_manual_cash.sql` | `crm_payments` accepte les paiements saisis à la main (`source`, `method`, `note`, `created_by`, `created_at`) ; `crm_set_deal`, `crm_add_payment`, `crm_delete_payment`. |
| `023_crm_contact_update.sql` | `crm_apply_contact` (iClosed « Contact updated » : nom, e-mail, téléphone). |
| `024_crm_payment_plan.sql` | Colonne `crm_deals.schedule` ; `crm_set_payment_plan`. |
| `025_crm_fathom_calls.sql` | Fathom source de vérité des appels (FL-1 à FL-6) : suppression de l'unicité `(cycle_id, rank)`, colonne `recorded_by`, index `calls_cycle_rank`, réglage `fathom_match_minutes`, table `crm_fathom_recordings`, `crm_fathom_sales_recorder`, `crm_norm_name`, `crm_fathom_person`, `crm_rank_calls`, déclencheur `crm_calls_rank`, `crm_fathom_speaker_map`, `crm_apply_recording_item`, `crm_apply_recordings`, `crm_import_recordings` ; `crm_ca_call_info` et le projecteur redéfinis. |
| `026_crm_refunds.sql` | Motif `refunded` ; `crm_add_refund` ; projecteur : tout remboursé = perdu. |
| `027_crm_yes_keeps_deal.sql` | `crm_declare_outcome` : un « oui » ne remplit que ce qu'il apporte (définition finale). |
| `028_crm_sla_alerts.sql` | Table `crm_sla_notices` ; réglage `sla_alerts` ; `crm_sla_snapshot`, `crm_sla_claim`, `crm_sla_settings`. |
| `029_crm_call_ranks.sql` | `crm_rank_calls` pour tous les cycles (un nouveau numéro seulement après un appel analysable) ; déclencheur `crm_calls_rank` aussi sur `transcript_raw` ; renumérotation. |
| `030_crm_no_show_rule.sql` | Valeur `missed` de `call_status` ; réglage `no_show_rule` ; `crm_no_show_setting`, `crm_call_complete`, `crm_rank_calls` (définition finale), `crm_apply_no_show_rule`, `crm_no_show_tick`, déclencheur `crm_calls_recorded` ; projecteur (définition finale). |
| `031_crm_member_prefs.sql` | Table `crm_member_prefs` ; `crm_get_pref`, `crm_set_pref`. |
| `032_crm_fathom_closest.sql` | Réglage `fathom_close_minutes` ; règle `booking_closest` ; `crm_call_has_ambiguous_recording` ; `crm_apply_no_show_rule` (définition finale) ; remise en « issue à déclarer » des fausses absences ; `no_show_rule.min_minutes` passe à 30 ; `crm_call_is_reschedule` ; fenêtre du cockpit comptée en prospects. |
| `033_crm_noshow_audit.sql` | Règle `booking_declared` ; `crm_fathom_person` (définition finale) ; `crm_sales_cockpit_window` (définition finale : un cycle gagné compte comme présent). |
| `034_lnp_fr_labels.sql` | Passe en français les libellés déjà chargés d'une base construite en anglais (sans toucher un libellé modifié à la main) et recrée, à l'identique des fichiers 004 à 031, chaque fonction qui renvoie ou lève du texte. |
| `052_crm_whatsapp.sql` | WhatsApp Business, seul canal de messages : valeur `whatsapp` d'`event_source` ; `crm_members.sendblue_number` renommée `whatsapp_number` (index `team_members_whatsapp_uq`) ; `crm_outbound_messages.sendblue_message_handle` renommée `whatsapp_message_id` ; `crm_admin_set_member` recréée avec `p_whatsapp_number` ; `crm_set_member_whatsapp` ; `crm_apply_message_item`, `crm_apply_messages`, `crm_import_messages` (définition finale : la source vient de chaque élément, membre de l'équipe rattaché) ; tâche `crm-process-inbox` replanifiée sur `whatsapp`. Rejouable sans danger. Pas encore appliquée en production. |

**À propos de 034.** Ses redéfinitions sont des copies exactes de la dernière définition de chaque fonction (vérifié en comparant
les textes : identiques pour les 30 fonctions qu'il recrée). Sur une base neuve, 034 ne change donc que les données de la partie 1,
qui ne trouvent rien à traduire puisque 003 à 033 ensemencent déjà en français.

**Rattrapages exécutés à l'application.** Certaines migrations agissent sur les données au moment où on les applique :
011 (`select crm_member_from_team(user_id) from members`), 015 (`select crm_assign_owners_from_hosts(false)`),
018 (`select crm_mark_won_calls_held(false)`), 026 (recalcul des cycles gagnés ayant un remboursement), 029 (renumérotation de
tous les cycles et recalcul des cycles en cours), 030 et 033 (renumérotation des cycles ayant un enregistrement), 032 (remise des
fausses absences en `scheduled`). Sur une base vide ils ne font rien.

---

## 3. Recréer la base pas à pas

1. Créer un projet Supabase (il fournit le schéma `auth`, `auth.uid()`, les rôles `anon`, `authenticated`, `service_role` et la
   publication `supabase_realtime` ; voir §4).
2. Exécuter, en tant que propriétaire (`postgres`, éditeur SQL ou `psql`), `001_init.sql`, puis `003_crm_core.sql` à
   `034_lnp_fr_labels.sql` dans l'ordre.
3. Déclarer l'adresse des Edge Functions (réglage non secret, absent des migrations ; sans lui, aucune tâche planifiée qui passe
   par HTTP ne part) :
   ```sql
   insert into crm_settings (key, value, is_proposal) values ('functions_url', '"https://<ref>.supabase.co/functions/v1"', false);
   ```
4. L'équipe : inviter chaque personne par Paramètres › Accès (`/api/team`, qui écrit `members`) ; le déclencheur `members_to_crm`
   lui crée une ligne `crm_members` (administrateur → `admin`, membre → `sales_lead`, lecteur → `viewer`). Pour un commercial qui
   ne doit voir que ses prospects, passer son rôle CRM à `sales` et renseigner son responsable, son e-mail iClosed et Fathom avec
   `crm_admin_set_member(...)` (§9.2). Ajouter les commerciaux affichés au Cockpit commercial dans `crm_sales_team`
   (`insert into crm_sales_team (rep, name) values ('<clé>', '<Prénom>')`).
5. Règles d'alerte du CRM dans Paramètres › Alertes : `select crm_merge_alert_defaults();` (ajoute c1 à c18 dans `docs`
   `config/alerts` sans toucher l'existant).
6. Imports d'historique éventuels par l'Edge Function `crm-import` (chapitre des intégrations), puis, selon les données, les
   rattrapages manuels `crm_import_iclosed_disqualified(false)`, `crm_reclassify_imported(false)`,
   `crm_mark_won_calls_held(false)` (toutes acceptent d'abord un essai à blanc `true`).
7. Règle d'absence : une fois l'historique Fathom importé, fixer la date de départ puis l'activer :
   ```sql
   update crm_settings set value = value || jsonb_build_object('since', '<date ISO>', 'enabled', true) where key = 'no_show_rule';
   ```
8. Temps réel du CRM : le CRM s'abonne à `crm_cycles`, `crm_events` et `crm_alerts` (`app/crm/data.js`, `subscribe`), mais
   aucune migration ne les ajoute à la publication `supabase_realtime` (seule `docs` l'est, 001). À ajouter à la main si l'on
   veut les mises à jour en direct (voir §16).

La base en ligne ne change qu'après accord de Romain sur la PR (`CLAUDE.md`).

---

## 4. Extensions et prérequis Supabase

| Extension | Fichier | Usage |
|---|---|---|
| `pgcrypto` | 003 | `gen_random_uuid()` (clés primaires `uuid`). |
| `citext` | 003 | E-mails insensibles à la casse (`crm_members.email`, `iclosed_email`, `fathom_email`, `crm_people.primary_email`, `crm_calls.recorded_by`, `crm_fathom_recordings.recorder`). |
| `pg_net` | 006 | `net.http_post` depuis les tâches planifiées. |
| `pg_cron` | 006 | `cron.schedule` / `cron.unschedule`. |

Ce que les fichiers supposent de la plateforme (reproduit pour les tests par `web/supabase/tests/supabase_stub.sql`) :
les rôles `anon`, `authenticated`, `service_role` (ce dernier avec `bypassrls`) ; le schéma `auth` avec la table `auth.users`
(colonnes utilisées : `id`, `email`, `raw_app_meta_data`) et la fonction `auth.uid()` (sujet du jeton) ; l'usage du schéma `public`
par ces rôles ; les privilèges par défaut qui accordent toute nouvelle table aux trois rôles (la RLS décide ensuite) ; la
publication `supabase_realtime`.

---

## 5. Types énumérés

Tous créés par 003, sauf mention.

| Type | Valeurs | Notes |
|---|---|---|
| `member_role` | `admin`, `sales_lead`, `sales`, `viewer` | Rôle dans le CRM (`crm_members.role`). |
| `identity_kind` | `email`, `phone`, `iclosed_contact_id`, `whop_user_id`, `whop_member_id`, `close_contact_id` | `close_contact_id` ajouté par 007. |
| `cycle_status` | `active`, `won`, `lost`, `disqualified` | En cours / gagné / perdu / disqualifié. |
| `cycle_origin` | `new`, `nurture`, `reopened` | `reopened` n'est jamais écrit par le code (une réouverture remet le même cycle à `active`). |
| `call_status` | `scheduled`, `canceled`, `held`, `no_show`, `outcome_pending`, `missed` | `missed` ajouté par 030. `outcome_pending` n'est écrit par aucune fonction SQL (lu par 005, 025 et `supabase/functions/_shared/sla_view.ts`). |
| `attendance` | `held`, `no_show` | Présence déclarée. |
| `decision` | `yes`, `no`, `follow_up`, `disqualified` | Décision déclarée. |
| `nurture_choice` | `none`, `standard`, `light` | Intensité de maturation. |
| `nurture_status` | `active`, `reactivated`, `archived`, `opted_out`, `removed` | `archived` et `opted_out` ne sont écrits par aucune fonction. |
| `actor_kind` | `sales`, `prospect`, `auto`, `system` | Qui a produit l'événement. |
| `event_source` | `iclosed`, `fathom`, `sendblue`, `whop`, `crm`, `claude`, `rules`, `import`, `whatsapp` | Créé avec garde `duplicate_object` (aussi en phase 0) ; `whatsapp` est dans la liste de 003 et ajouté par 052 à une base existante (`add value if not exists`). `sendblue` reste dans l'énumération mais n'est plus écrit (Sendblue abandonné, aucune ligne). |
| `reason_kind` | `lost`, `disqualified` | Nature d'un motif. |
| `alert_severity` | `low`, `medium`, `high`, `critical` | Même échelle que Paramètres › Alertes. |
| `inbox_status` | `received`, `processed`, `ignored`, `failed`, `unmatched`, `rejected` | Créé avec garde `duplicate_object`. |
| `analysis_status` | `queued`, `done`, `insufficient`, `failed` | Pour l'ancienne table `crm_call_analyses`. |
| `outbound_status` | `pending_approval`, `queued`, `sent`, `delivered`, `failed`, `blocked`, `rejected` | Messages envoyés par le CRM. |

Les statuts des tables ajoutées plus tard sont des `text` avec `check` : `crm_import_runs.status`, `crm_ca_jobs.status`,
`crm_ca_results.competence`, `crm_fathom_recordings.status` / `rule`, `crm_sla_notices.level`, `crm_payments.source`,
`crm_rules.kind`, `crm_agent_runs.status`, `members.role`.

---

## 6. Rôles, droits et sécurité au niveau des lignes

### 6.1 Deux rôles par personne

| Où | Valeurs | Sert à |
|---|---|---|
| `members.role` (001) | `admin`, `member`, `viewer` | Rôle d'application : écrire `docs`, gérer l'équipe (`/api/team`, administrateurs), accès par écran (`app_metadata.screens`, `web/api/_screens.js`). Lu par `my_role()`. |
| `crm_members.role` (003) | `admin`, `sales_lead`, `sales`, `viewer` | Rôle dans le CRM : quelles lignes on lit, quelles RPC on peut appeler. Lu par `crm_role()` (seulement si `active`). |

Correspondance automatique (011, `crm_member_from_team`) à l'arrivée d'un membre : `admin` → `admin`, `viewer` → `viewer`,
toute autre valeur (`member`) → `sales_lead`. Une ligne `crm_members` déjà présente n'est jamais modifiée par ce mécanisme ; le rôle
`sales` (commercial qui ne voit que ses cycles) se pose à la main. Un changement de `members.role` après coup **ne se répercute
pas** sur `crm_members.role` (le déclencheur ne réagit qu'à l'insertion).

### 6.2 Fonctions d'aide à la sécurité

Toutes `language sql stable security definer set search_path = public`.

| Fonction | Renvoie | Définition |
|---|---|---|
| `my_role()` (001) | `text` | `members.role` de `auth.uid()`, `null` si la personne n'est pas membre. |
| `crm_role()` (003) | `member_role` | `crm_members.role` de `auth.uid()` si `active`, sinon `null`. |
| `crm_sees_all()` (003, 048) | `boolean` | `crm_role() = 'admin'` (faux si `null`). Depuis 048 (Romain, 5 novembre 2026), seul un administrateur voit tous les prospects ; commercial, responsable commercial et lecteur ne voient que les cycles dont ils sont propriétaires. |
| `crm_owns_cycle(c uuid)` (003) | `boolean` | Le cycle `c` a `owner_id = auth.uid()`. |
| `crm_sees_person(p uuid)` (003) | `boolean` | `crm_sees_all()` ou la personne a un cycle dont l'appelant est propriétaire. |
| `crm_ca_can_read(p_call uuid)` (020) | `boolean` | `crm_role() = 'admin'` ou l'appelant possède le cycle de l'appel. **Plus étroit** que `crm_sees_all()` : ni `sales_lead` ni `viewer` ne lisent l'analyse d'appel d'un cycle qui n'est pas le leur. |

`crm_require(p_roles member_role[], p_cycle uuid default null) → crm_members` (004, `plpgsql stable security definer`) est le
contrôle d'accès de toutes les écritures : erreur `42501` « Vous n'êtes pas membre du CRM » si l'appelant n'a pas de ligne active ;
passe si son rôle est dans `p_roles` ; passe aussi pour un `sales` si `p_cycle` est donné et qu'il en est propriétaire ; sinon
erreur `42501` « Action non autorisée pour le rôle … ». Un `viewer` n'écrit donc jamais.

### 6.3 Qui peut écrire quoi (résumé)

| Action (RPC) | admin | sales_lead | sales | viewer | Autre condition |
|---|---|---|---|---|---|
| Déclarer une issue, ajouter une note, montant signé, échéancier, paiement, suppression d'un paiement manuel, remboursement, maturation, annuler une perte automatique | oui | oui | sur ses cycles | non | `crm_require(['admin','sales_lead'], cycle)` |
| Réattribuer un cycle, rattacher / écarter un élément non rattaché, fusionner deux personnes, modifier la configuration | oui | oui | non | non | `crm_require(['admin','sales_lead'])` |
| Ajouter une transcription, relancer une analyse | oui | sur ses cycles | sur ses cycles | non | `crm_role() = 'admin'` ou `crm_owns_cycle` |
| Définir un membre du CRM (`crm_admin_set_member`) | oui | non | non | non | ou administrateur d'application (`my_role() = 'admin'`) |
| Ajouter les règles c1–c18 à `config/alerts` (`crm_merge_alert_defaults`) | — | — | — | — | administrateur d'application, ou appel sans jeton (propriétaire, service) |
| Tout recalculer (`crm_recompute_all`) | oui | non | non | non | ou appel sans jeton |
| Ses propres réglages (`crm_set_pref`) | oui | oui | oui | oui | tout compte connecté |

### 6.4 Modèle de droits SQL

- 001 : `revoke all on docs, members from anon` ; `grant select, insert, update, delete on docs` et `grant select on members` à
  `authenticated`.
- 003 : pour chaque table `crm_%` existante, `revoke all from anon, authenticated`, puis `grant select to authenticated` sauf
  `crm_webhook_log` (rôle de service seulement). Les tables ajoutées ensuite règlent leurs droits elles-mêmes (tableau §6.5).
- Fonctions : chaque fichier fait `revoke execute … from public, anon` puis `grant execute … to authenticated` (RPC du
  navigateur), ou `revoke … from public, anon, authenticated` puis `grant … to service_role` (fonctions des Edge Functions et du
  worker). Les aides internes (`crm_require`, `crm_audit`) sont retirées à `authenticated` (004).
- Le rôle de service contourne la RLS (`bypassrls`).

### 6.5 Politiques RLS par table

La RLS est activée sur toutes les tables. Les politiques de 003 n'ont pas de clause `to` (elles s'appliquent à tous les rôles,
mais `anon` n'a aucun droit de table). Aucune table du CRM n'a de politique d'écriture pour le navigateur, sauf `crm_member_prefs`.

| Table | Politique | Commande | Condition |
|---|---|---|---|
| `members` | `members_read` | select, `to authenticated` | `my_role() is not null` |
| `docs` | `docs_read` | select, `to authenticated` | `my_role() is not null` |
| `docs` | `docs_insert` / `docs_update` / `docs_delete` | insert / update / delete, `to authenticated` | `my_role() in ('admin', 'member')` (lecteurs : lecture seule) |
| `crm_members` | `read_team` | select | `auth.uid() is not null` |
| `crm_stage_definitions` | `read_config1` | select | `auth.uid() is not null` |
| `crm_reason_codes` | `read_config2` | select | `auth.uid() is not null` |
| `crm_rules` | `read_config3` | select | `crm_sees_all()` |
| `crm_settings` | `read_config4` | select | `auth.uid() is not null` |
| `crm_people` | `read_people` | select | `crm_sees_person(id)` |
| `crm_person_identities` | `read_ident` | select | `crm_sees_person(person_id)` |
| `crm_cycles` | `read_cycles` | select | `crm_sees_all() or owner_id = auth.uid()` |
| `crm_calls` | `read_calls` | select | `crm_sees_all() or crm_owns_cycle(cycle_id)` |
| `crm_call_outcomes` | `read_outc` | select | `crm_sees_all()` ou propriétaire du cycle de l'appel |
| `crm_events` | `read_events` | select | `crm_sees_all() or crm_owns_cycle(cycle_id) or (cycle_id is null and crm_sees_person(person_id))` |
| `crm_deals` | `read_deals` | select | `crm_sees_all() or crm_owns_cycle(cycle_id)` |
| `crm_payments` | `read_pay` | select | `crm_sees_all() or crm_owns_cycle(cycle_id)` |
| `crm_nurture_tracks` | `read_nurt` | select | `crm_sees_all() or owner_id = auth.uid()` |
| `crm_outbound_messages` | `read_out` | select | `crm_sees_all() or crm_sees_person(person_id)` |
| `crm_stage_history` | `read_stage` | select | `crm_sees_all() or crm_owns_cycle(cycle_id)` |
| `crm_alerts` | `read_alerts` | select | `crm_sees_all() or owner_id = auth.uid()` |
| `crm_unmatched_inbox` | `read_unm` | select | `crm_sees_all()` |
| `crm_reconciliation_runs` | `read_recon` | select | `crm_sees_all()` |
| `crm_call_analyses` | `read_anal` | select | `crm_sees_all()` ou propriétaire du cycle de l'appel |
| `crm_audit_log` | `read_audit` | select | `crm_role() = 'admin'` |
| `crm_agent_runs` | `read_runs` | select | `crm_sees_all()` |
| `crm_webhook_log` | aucune | — | rôle de service seulement (aucun droit pour `authenticated`) |
| `crm_import_runs` (007) | `read_import` | select | `crm_sees_all()` |
| `mcp_oauth_clients`, `mcp_oauth_codes` (014) | aucune | — | droits retirés à `anon` et `authenticated` : code serveur seulement |
| `crm_sales_team` (019) | aucune | — | droits retirés à `public`, `anon`, `authenticated` ; lue par les fonctions `security definer` |
| `crm_ca_config` (020) | `ca_config_admin` | select | `crm_role() = 'admin'` |
| `crm_ca_offer` | `ca_offer_read` | select | `crm_role() is not null` |
| `crm_ca_cases` | `ca_cases_read` | select | `crm_role() is not null` |
| `crm_ca_jobs` | `ca_jobs_read` | select | `crm_ca_can_read(call_id)` |
| `crm_ca_records` | `ca_records_read` | select | `crm_ca_can_read(call_id)` |
| `crm_ca_turns` | `ca_turns_read` | select | `crm_ca_can_read` de l'appel du travail (`job_id`) |
| `crm_ca_results` | `ca_results_read` | select | `crm_ca_can_read(call_id)` |
| `crm_ca_audit` | `ca_audit_admin` | select | `crm_role() = 'admin'` |
| `crm_fathom_recordings` (025) | `fathom_recordings_admin` | select | `crm_role() = 'admin'` |
| `crm_sla_notices` (028) | aucune | — | rôle de service seulement |
| `crm_member_prefs` (031) | `crm_member_prefs_own` | all, `to authenticated` | `user_id = auth.uid()` (lecture et écriture de ses seules lignes) |

---

## 7. Tables, par domaine

Notation : **N** = `not null` ; « défaut » vide = aucun ; PK = clé primaire ; FK = clé étrangère (comportement à la suppression
indiqué quand il n'est pas `no action`).

### 7.1 Application

#### `members` (001)

Qui peut utiliser l'application. Écrite seulement par le serveur (rôle de service) via `/api/team` et `/api/bootstrap`.

| Colonne | Type | N | Défaut | Contraintes |
|---|---|---|---|---|
| `user_id` | `uuid` | oui | | PK ; FK `auth.users(id)` `on delete cascade` |
| `email` | `text` | oui | | |
| `role` | `text` | oui | `'member'` | `check (role in ('admin', 'member', 'viewer'))` |
| `created_at` | `timestamptz` | oui | `now()` | |

Déclencheur : `members_to_crm` (011, §10).

#### `docs` (001)

Toutes les collections de l'application en documents. Publiée dans `supabase_realtime` (chaque écran ouvert reçoit les changements).

| Colonne | Type | N | Défaut | Contraintes |
|---|---|---|---|---|
| `col` | `text` | oui | | PK (`col`, `id`) |
| `id` | `text` | oui | | PK |
| `body` | `jsonb` | oui | | |
| `updated_at` | `timestamptz` | oui | `now()` | posé par le déclencheur |
| `updated_by` | `uuid` | non | `auth.uid()` | posé par le déclencheur |

Le CRM y écrit une seule ligne : `config/alerts` (`crm_merge_alert_defaults`, §9.2).

### 7.2 Équipe du CRM

#### `crm_members` (003)

Une ligne par compte qui prend part aux ventes. `member_key` est l'identifiant de membre utilisé partout dans LNP (par exemple
`'sales'` ou `'romain'` dans les commentaires de 003).

| Colonne | Type | N | Défaut | Contraintes |
|---|---|---|---|---|
| `id` | `uuid` | oui | | PK ; FK `members(user_id)` `on delete restrict` |
| `member_key` | `text` | oui | | unique |
| `full_name` | `text` | oui | | |
| `email` | `citext` | oui | | unique |
| `role` | `member_role` | oui | `'sales'` | |
| `lead_id` | `uuid` | non | | FK `crm_members(id)` (responsable d'escalade) |
| `iclosed_email` | `citext` | non | | e-mail du compte iClosed |
| `fathom_email` | `citext` | non | | e-mail d'enregistrement Fathom |
| `whatsapp_number` | `text` | non | | numéro WhatsApp Business de la personne (E.164, `+33612345678`) : rattache ses messages (`crm_events.member_id`) ; index unique partiel `team_members_whatsapp_uq` `where whatsapp_number is not null` ; créée sous ce nom par 003 (une base plus ancienne avait `sendblue_number`, renommée par 052) ; écrite par `crm_set_member_whatsapp` (Paramètres › Compte › Accès de l'équipe) |
| `timezone` | `text` | oui | `'Asia/Dubai'` | |
| `active` | `boolean` | oui | `true` | |
| `created_at` | `timestamptz` | oui | `now()` | |

Déclencheur : `crm_members_take_leads` (015).

#### `crm_sales_team` (019)

Les commerciaux affichés dans le tableau « équipe » du Cockpit commercial et reconnus comme enregistreurs Fathom de ventes (FL-1).
Clé `rep` = clé de membre du CRM, ou partie locale de l'e-mail de l'hôte iClosed. Ensemencée avec `('valentino', 'Valentino')`.

| Colonne | Type | N | Défaut | Contraintes |
|---|---|---|---|---|
| `rep` | `text` | oui | | PK |
| `name` | `text` | oui | | |
| `added_at` | `timestamptz` | oui | `now()` | |

#### `crm_member_prefs` (031)

Réglages d'écran propres à chaque personne. Clés utilisées : `crm.pipeline.cols` (ordre des colonnes du Pipeline,
`app/gen_crm.py`) et `salesday.<date>` (prospects faits, passés ou reportés ce jour-là dans Ma journée,
`app/salesday_module.js`).

| Colonne | Type | N | Défaut | Contraintes |
|---|---|---|---|---|
| `user_id` | `uuid` | oui | `auth.uid()` | PK (`user_id`, `key`) |
| `key` | `text` | oui | | `check (length(key) between 1 and 80)` |
| `value` | `jsonb` | oui | | |
| `updated_at` | `timestamptz` | oui | `now()` | |

### 7.3 Personnes

#### `crm_people` (003, 010)

| Colonne | Type | N | Défaut | Contraintes |
|---|---|---|---|---|
| `id` | `uuid` | oui | `gen_random_uuid()` | PK |
| `full_name` | `text` | non | | |
| `primary_email` | `citext` | non | | |
| `primary_phone` | `text` | non | | E.164 |
| `messaging_consent` | `boolean` | non | | `null` = inconnu |
| `opted_out_at` | `timestamptz` | non | | STOP reçu : plus jamais de message automatique |
| `merged_into` | `uuid` | non | | FK `crm_people(id)` (personne fusionnée dans une autre) |
| `created_at` | `timestamptz` | oui | `now()` | jour d'écriture de la ligne |
| `updated_at` | `timestamptz` | oui | `now()` | |
| `first_seen_at` | `timestamptz` | oui | `now()` | 010 : premier moment connu de la personne (le plus ancien de ses événements) ; tenu à jour par `crm_events_first_seen`. Filtre « Créé » du CRM. |

#### `crm_person_identities` (003)

Identifiants normalisés d'une personne ; c'est par eux qu'on retrouve quelqu'un.

| Colonne | Type | N | Défaut | Contraintes |
|---|---|---|---|---|
| `id` | `uuid` | oui | `gen_random_uuid()` | PK |
| `person_id` | `uuid` | oui | | FK `crm_people(id)` `on delete cascade` ; index `person_identities_person` |
| `kind` | `identity_kind` | oui | | unique (`kind`, `value`) |
| `value` | `text` | oui | | normalisé (e-mail en minuscules, téléphone E.164) |
| `source` | `event_source` | oui | | |
| `created_at` | `timestamptz` | oui | `now()` | |

### 7.4 Configuration

#### `crm_stage_definitions` (003)

| Colonne | Type | N | Défaut | Contraintes |
|---|---|---|---|---|
| `key` | `text` | oui | | PK |
| `label` | `text` | oui | | |
| `position` | `int` | oui | | ordre des étapes |
| `enter_on` | `text[]` | oui | | types d'événements qui font entrer un cycle dans l'étape |
| `target_hours` | `numeric` | non | | objectif (à décider) |
| `critical_hours` | `numeric` | non | | seuil critique (à décider) |
| `color` | `text` | non | | |
| `active` | `boolean` | oui | `true` | |
| `is_proposal` | `boolean` | oui | `true` | |
| `updated_at` | `timestamptz` | oui | `now()` | |

Données initiales :

| `key` | `label` | `position` | `enter_on` | `target_hours` | `critical_hours` | `color` |
|---|---|---|---|---|---|---|
| `show` | Présence | 1 | `{call_booked}` | 96 | 168 | `#2A9D8F` |
| `decision` | Décision | 2 | `{outcome_held}` | 72 | 144 | `#8B67C9` |
| `cash` | Encaissement | 3 | `{outcome_yes}` | 24 | 48 | `#4F9A5B` |

#### `crm_reason_codes` (003, 026)

| Colonne | Type | N | Défaut | Contraintes |
|---|---|---|---|---|
| `code` | `text` | oui | | PK |
| `kind` | `reason_kind` | oui | | |
| `label` | `text` | oui | | |
| `nurture_default` | `nurture_choice` | oui | `'none'` | |
| `automatic` | `boolean` | oui | `false` | posé par une règle, pas choisi par un commercial |
| `position` | `int` | oui | `0` | |
| `active` | `boolean` | oui | `true` | |
| `is_proposal` | `boolean` | oui | `true` | |

Données initiales (`refunded` ajouté par 026) :

| `code` | `kind` | `label` | `nurture_default` | `automatic` | `position` |
|---|---|---|---|---|---|
| `timing` | lost | Pas le bon moment | standard | non | 1 |
| `partner` | lost | Conjoint ou associé | standard | non | 2 |
| `price` | lost | Prix | standard | non | 3 |
| `trust` | lost | Manque de confiance | standard | non | 4 |
| `competitor` | lost | Concurrent | none | non | 5 |
| `unreachable` | lost | Injoignable | light | oui | 6 |
| `unpaid` | lost | Paiement non effectué | none | oui | 7 |
| `refunded` | lost | Remboursé | none | oui | 8 |
| `dq_off_target` | disqualified | Hors cible | none | non | 1 |
| `dq_budget` | disqualified | Budget impossible | none | non | 2 |
| `dq_not_decider` | disqualified | Pas décisionnaire | none | non | 3 |
| `dq_fake` | disqualified | Faux contact ou spam | none | non | 4 |
| `dq_customer` | disqualified | Déjà client | none | non | 5 |
| `dq_out_of_offer` | disqualified | Demande hors offre | none | non | 6 |

#### `crm_rules` (003)

| Colonne | Type | N | Défaut | Contraintes |
|---|---|---|---|---|
| `key` | `text` | oui | | PK |
| `kind` | `text` | oui | | `check (kind in ('auto_close', 'auto_flag', 'next_move', 'nurture', 'warming'))` |
| `enabled` | `boolean` | oui | `true` | |
| `params` | `jsonb` | oui | `'{}'` | seuils, destinataires, gravité (à décider) |
| `description` | `text` | non | | |
| `is_proposal` | `boolean` | oui | `true` | |
| `updated_at` | `timestamptz` | oui | `now()` | |

Données initiales :

| `key` | `kind` | `params` | `is_proposal` | Lu par |
|---|---|---|---|---|
| `auto_lost_unreachable` | auto_close | `{"silence_days":30,"min_attempts":4,"min_distinct_days":3,"notice_hours":24,"reason":"unreachable","snooze_days":7}` | false | `crm_cancel_auto_close` (`snooze_days`) |
| `unpaid_yes` | auto_close | `{"close_days":14,"reason":"unpaid","snooze_days":7}` | true | `crm_cancel_auto_close` (`snooze_days`) |
| `not_recorded` | auto_flag | `{"after_hours":6}` | true | aucune fonction |
| `next_move` | next_move | `{"reply_hours":2,"follow_up_hours":48,"reopen_days":30}` | true | `crm_open_cycle` (`reopen_days`) |
| `nurture_cadence` | nurture | `{"standard_days":[14,21],"light_days":30,"archive_after_days":182}` | true | aucune fonction |
| `warming_steps` | warming | `{"steps":["D-3","D-1","D0"]}` | true | aucune fonction |

#### `crm_settings` (003)

Clé-valeur JSON. Liste complète des clés au §13.

| Colonne | Type | N | Défaut | Contraintes |
|---|---|---|---|---|
| `key` | `text` | oui | | PK |
| `value` | `jsonb` | oui | | |
| `is_proposal` | `boolean` | oui | `true` | |
| `updated_at` | `timestamptz` | oui | `now()` | |

### 7.5 Cycles, appels, issues, étapes

#### `crm_cycles` (003)

Un cycle de vente : du premier rendez-vous à gagné / perdu / disqualifié. Les colonnes « dérivées » sont écrites par le projecteur,
jamais par le navigateur.

| Colonne | Type | N | Défaut | Contraintes / sens |
|---|---|---|---|---|
| `id` | `uuid` | oui | `gen_random_uuid()` | PK |
| `person_id` | `uuid` | oui | | FK `crm_people(id)` ; index `cycles_person` |
| `owner_id` | `uuid` | non | | FK `crm_members(id)` (commercial attitré) ; index `cycles_owner_status (owner_id, status)` |
| `status` | `cycle_status` | oui | `'active'` | index unique partiel `cycles_one_active_per_person (person_id) where status = 'active'` : un seul cycle en cours par personne |
| `origin` | `cycle_origin` | oui | `'new'` | |
| `previous_cycle_id` | `uuid` | non | | FK `crm_cycles(id)` |
| `opened_at` | `timestamptz` | oui | | moment du rendez-vous qui l'a ouvert |
| `closed_at` | `timestamptz` | non | | |
| `close_reason` | `text` | non | | FK `crm_reason_codes(code)` |
| `current_stage` | `text` | non | | dérivé ; FK `crm_stage_definitions(key)` |
| `stage_entered_at` | `timestamptz` | non | | dérivé |
| `calls_held` | `int` | oui | `0` | dérivé |
| `no_shows` | `int` | oui | `0` | dérivé |
| `sales_attempts` | `int` | oui | `0` | dérivé |
| `last_prospect_at` | `timestamptz` | non | | dérivé |
| `last_sales_at` | `timestamptz` | non | | dérivé |
| `last_event_at` | `timestamptz` | non | | dérivé |
| `next_move` | `jsonb` | non | | dérivé : `{who, code, label, due_at}` (+ `missed`) |
| `projected_at` | `timestamptz` | non | | dérivé : dernier passage du projecteur |
| `created_at` | `timestamptz` | oui | `now()` | |

#### `crm_calls` (003, 020, 025)

| Colonne | Type | N | Défaut | Contraintes / sens |
|---|---|---|---|---|
| `id` | `uuid` | oui | `gen_random_uuid()` | PK |
| `cycle_id` | `uuid` | oui | | FK `crm_cycles(id)` `on delete cascade` ; index `calls_cycle_rank (cycle_id, rank)` (025) |
| `rank` | `int` | oui | | 1 = R1, 2 = R2… ; l'unicité `(cycle_id, rank)` de 003 est supprimée par 025 (un R2 annulé et le R2 honoré partagent le numéro) ; renuméroté par `crm_rank_calls` |
| `iclosed_call_id` | `text` | non | | unique |
| `scheduled_start` | `timestamptz` | non | | index `calls_schedule` |
| `scheduled_end` | `timestamptz` | non | | |
| `status` | `call_status` | oui | `'scheduled'` | |
| `host_id` | `uuid` | non | | FK `crm_members(id)` |
| `fathom_recording_id` | `bigint` | non | | unique |
| `recording_start` | `timestamptz` | non | | |
| `recording_end` | `timestamptz` | non | | |
| `recording_url` | `text` | non | | |
| `share_url` | `text` | non | | |
| `summary_md` | `text` | non | | |
| `transcript` | `jsonb` | non | | `[{speaker, email, text, timestamp}]` (Fathom) |
| `created_at` | `timestamptz` | oui | `now()` | |
| `transcript_raw` | `text` | non | | 020 : format du moteur `"[mm:ss] Intervenant: texte"` |
| `speaker_map` | `jsonb` | non | | 020 : intervenant → `SALES` / `PROSPECT` / `OTHER` |
| `transcript_source` | `text` | non | | 020 : `upload` (défaut de `crm_ca_add_transcript`) ou `fathom` |
| `transcript_added_at` | `timestamptz` | non | | 020 |
| `recorded_by` | `citext` | non | | 025 : e-mail du commercial qui a enregistré l'appel dans Fathom |

Déclencheurs : `crm_calls_rank` (025, 029) et `crm_calls_recorded` (030).

#### `crm_call_outcomes` (003)

L'issue déclarée d'un appel. Une correction remplace l'issue courante sans l'effacer (historique conservé).

| Colonne | Type | N | Défaut | Contraintes |
|---|---|---|---|---|
| `id` | `uuid` | oui | `gen_random_uuid()` | PK |
| `call_id` | `uuid` | oui | | FK `crm_calls(id)` `on delete cascade` ; index unique partiel `call_outcomes_current (call_id) where superseded_at is null` (une issue courante par appel) |
| `attendance` | `attendance` | oui | | |
| `decision` | `decision` | non | | `null` si absent |
| `reason_code` | `text` | non | | FK `crm_reason_codes(code)` |
| `nurture` | `nurture_choice` | oui | `'none'` | |
| `return_date` | `date` | non | | |
| `next_step` | `text` | non | | |
| `amount_sold` | `numeric(12,2)` | non | | |
| `currency` | `text` | non | | |
| `product` | `text` | non | | |
| `payment_plan` | `text` | non | | |
| `note` | `text` | non | | |
| `extra` | `jsonb` | oui | `'{}'` | champs supplémentaires (à décider) |
| `declared_by` | `uuid` | oui | | FK `crm_members(id)` |
| `declared_at` | `timestamptz` | oui | `now()` | |
| `superseded_at` | `timestamptz` | non | | issue courante = `null` |

Contraintes `check` : `attendance = 'held' or decision is null` ; `decision not in ('no', 'disqualified') or reason_code is not null`.

#### `crm_stage_history` (003)

Reconstruite à chaque passage du projecteur.

| Colonne | Type | N | Défaut | Contraintes |
|---|---|---|---|---|
| `id` | `bigint` | oui | identité (`generated always`) | PK |
| `cycle_id` | `uuid` | oui | | FK `crm_cycles(id)` `on delete cascade` ; index `stage_history_cycle` |
| `stage` | `text` | oui | | FK `crm_stage_definitions(key)` |
| `entered_at` | `timestamptz` | oui | | |
| `exited_at` | `timestamptz` | non | | |
| `hours` | `numeric` | — | colonne générée stockée | `extract(epoch from (coalesce(exited_at, entered_at) - entered_at)) / 3600` (vaut 0 pour l'étape en cours) |

### 7.6 Le journal

#### `crm_events` (003)

| Colonne | Type | N | Défaut | Contraintes |
|---|---|---|---|---|
| `id` | `bigint` | oui | identité (`generated always`) | PK |
| `person_id` | `uuid` | non | | FK `crm_people(id)` ; index `events_person_time (person_id, occurred_at)` |
| `cycle_id` | `uuid` | non | | FK `crm_cycles(id)` ; index `events_cycle_time (cycle_id, occurred_at)` |
| `call_id` | `uuid` | non | | FK `crm_calls(id)` |
| `occurred_at` | `timestamptz` | oui | | moment du fait |
| `received_at` | `timestamptz` | oui | `now()` | |
| `actor` | `actor_kind` | oui | | |
| `member_id` | `uuid` | non | | FK `crm_members(id)` |
| `channel` | `text` | oui | | `booking`, `video`, `whatsapp`, `payment`, `crm`, `analysis` (`imessage`, `sms`, `phone` restent possibles mais plus aucune source ne les écrit) |
| `type` | `text` | oui | | type canonique (§11.3) ; index `events_type` |
| `content` | `text` | non | | texte (message, note) |
| `data` | `jsonb` | oui | `'{}'` | |
| `source` | `event_source` | oui | | unique (`source`, `source_id`) |
| `source_id` | `text` | oui | | |
| `inbox_id` | `bigint` | non | | ligne brute d'origine (`crm_webhook_log.id`, sans FK) |

Déclencheur : `crm_events_first_seen` (010).

### 7.7 Argent

#### `crm_deals` (003, 024)

Une vente par cycle.

| Colonne | Type | N | Défaut | Contraintes |
|---|---|---|---|---|
| `id` | `uuid` | oui | `gen_random_uuid()` | PK |
| `cycle_id` | `uuid` | oui | | unique ; FK `crm_cycles(id)` `on delete cascade` |
| `product` | `text` | non | | |
| `amount_sold` | `numeric(12,2)` | non | | montant signé |
| `currency` | `text` | non | | |
| `payment_plan` | `text` | non | | « Payé en une fois » ou « N échéances » |
| `yes_at` | `timestamptz` | non | | moment du « oui » (gardé au premier) |
| `whop_checkout_id` | `text` | non | | unique |
| `whop_purchase_url` | `text` | non | | |
| `created_at` | `timestamptz` | oui | `now()` | |
| `schedule` | `jsonb` | non | | 024 : `[{"due": "AAAA-MM-JJ", "amount": n}, …]` triées par échéance |

#### `crm_payments` (003, 022)

| Colonne | Type | N | Défaut | Contraintes |
|---|---|---|---|---|
| `id` | `uuid` | oui | `gen_random_uuid()` | PK |
| `deal_id` | `uuid` | non | | FK `crm_deals(id)` |
| `cycle_id` | `uuid` | non | | FK `crm_cycles(id)` ; index `payments_cycle` |
| `whop_payment_id` | `text` | non (022) | | unique ; `not null` levé par 022 |
| `amount` | `numeric(12,2)` | non | | |
| `currency` | `text` | non | | |
| `status` | `text` | oui | | tel que Whop l'annonce ; `'paid'` pour un paiement manuel |
| `paid_at` | `timestamptz` | non | | |
| `refunded_amount` | `numeric(12,2)` | oui | `0` | |
| `data` | `jsonb` | oui | `'{}'` | |
| `updated_at` | `timestamptz` | oui | `now()` | |
| `source` | `text` | oui | `'whop'` | 022 ; contrainte `crm_payments_source check (source in ('whop', 'manual'))` |
| `method` | `text` | non | | 022 : `bank_transfer`, `card`, `cash`, `other` (contrôlé par `crm_add_payment`) |
| `note` | `text` | non | | 022 |
| `created_by` | `uuid` | non | | 022 ; FK `crm_members(id)` |
| `created_at` | `timestamptz` | oui | `now()` | 022 |

### 7.8 Maturation et messages sortants (structure prête, peu écrite)

#### `crm_nurture_tracks` (003)

| Colonne | Type | N | Défaut | Contraintes |
|---|---|---|---|---|
| `id` | `uuid` | oui | `gen_random_uuid()` | PK |
| `person_id` | `uuid` | oui | | FK `crm_people(id)` ; index unique partiel `nurture_one_active (person_id) where status = 'active'` |
| `origin_cycle_id` | `uuid` | oui | | FK `crm_cycles(id)` |
| `reason_code` | `text` | non | | FK `crm_reason_codes(code)` |
| `intensity` | `nurture_choice` | oui | | `check (intensity in ('standard', 'light'))` |
| `owner_id` | `uuid` | non | | FK `crm_members(id)` |
| `entered_at` | `timestamptz` | oui | | |
| `return_date` | `date` | non | | |
| `status` | `nurture_status` | oui | `'active'` | |
| `last_signal_at` | `timestamptz` | non | | |
| `next_message_at` | `timestamptz` | non | | |
| `ended_at` | `timestamptz` | non | | |
| `reactivated_cycle_id` | `uuid` | non | | FK `crm_cycles(id)` |

Écrite par `crm_set_nurture` (004) et `crm_open_cycle` (005, réactivation).

#### `crm_outbound_messages` (003)

Messages qu'enverrait le CRM. Aucune fonction SQL ni Edge Function du dépôt ne l'écrit.

| Colonne | Type | N | Défaut | Contraintes |
|---|---|---|---|---|
| `id` | `uuid` | oui | `gen_random_uuid()` | PK |
| `person_id` | `uuid` | oui | | FK `crm_people(id)` |
| `cycle_id` | `uuid` | non | | FK `crm_cycles(id)` |
| `nurture_id` | `uuid` | non | | FK `crm_nurture_tracks(id)` |
| `from_member_id` | `uuid` | non | | FK `crm_members(id)` |
| `purpose` | `text` | oui | | par exemple `nurture`, `no_show_followup`, `warming` |
| `agent_key` | `text` | non | | agent qui l'a proposé |
| `approved_by` | `uuid` | non | | FK `crm_members(id)` |
| `approved_at` | `timestamptz` | non | | |
| `content` | `text` | oui | | |
| `to_number` | `text` | oui | | |
| `from_number` | `text` | non | | |
| `status` | `outbound_status` | oui | `'queued'` | |
| `whatsapp_message_id` | `text` | non | | unique ; créée sous ce nom par 003 (une base plus ancienne avait `sendblue_message_handle`, renommée par 052) |
| `error` | `text` | non | | |
| `requested_at` | `timestamptz` | oui | `now()` | |
| `sent_at` | `timestamptz` | non | | |

### 7.9 Entrée des données et exploitation

#### `crm_webhook_log` (003, phase 0)

Chaque requête reçue, stockée brute avant tout traitement (rejouable). Écrite par `supabase/functions/_shared/ingest.ts` (REST,
rôle de service) ; lue et marquée par la file (§11.1).

| Colonne | Type | N | Défaut | Contraintes |
|---|---|---|---|---|
| `id` | `bigint` | oui | identité | PK |
| `source` | `event_source` | oui | | index unique partiel `webhook_log_delivery (source, delivery_id) where delivery_id is not null` |
| `delivery_id` | `text` | non | | identifiant de livraison du fournisseur |
| `received_at` | `timestamptz` | oui | `now()` | index `webhook_log_status (status, received_at)` |
| `headers` | `jsonb` | oui | | |
| `body` | `text` | oui | | corps exact (nécessaire aux signatures) |
| `auth_ok` | `boolean` | non | | contrôle léger à l'entrée (jeton ou signature) |
| `status` | `inbox_status` | oui | `'received'` | |
| `attempts` | `int` | oui | `0` | |
| `error` | `text` | non | | |
| `processed_at` | `timestamptz` | non | | |

#### `crm_unmatched_inbox` (003)

Éléments qu'on n'a pas su rattacher à une seule personne.

| Colonne | Type | N | Défaut | Contraintes |
|---|---|---|---|---|
| `id` | `uuid` | oui | `gen_random_uuid()` | PK |
| `inbox_id` | `bigint` | oui | | FK `crm_webhook_log(id)` |
| `source` | `event_source` | oui | | |
| `reason` | `text` | oui | | texte en français (voir §12.1) |
| `summary` | `text` | non | | résumé lisible |
| `candidate_person_ids` | `uuid[]` | non | | |
| `created_at` | `timestamptz` | oui | `now()` | |
| `resolved_person_id` | `uuid` | non | | FK `crm_people(id)` |
| `resolved_cycle_id` | `uuid` | non | | FK `crm_cycles(id)` |
| `resolved_by` | `uuid` | non | | FK `crm_members(id)` |
| `resolved_at` | `timestamptz` | non | | |
| `dismissed` | `boolean` | oui | `false` | |

Raisons écrites : « Annulation d'un appel inconnu du CRM », « Les identifiants désignent plusieurs personnes » (005) ; « Plusieurs
personnes ont ce numéro de téléphone » (012) ; « Mise à jour d'un contact inconnu du CRM », « Nouvel e-mail ou téléphone déjà
attribué à une autre personne » (023) ; « Enregistrement Fathom : plusieurs prospects correspondent » (025).

#### `crm_import_runs` (007)

| Colonne | Type | N | Défaut | Contraintes |
|---|---|---|---|---|
| `id` | `uuid` | oui | `gen_random_uuid()` | PK |
| `source` | `event_source` | oui | | `import` dans le code (`_shared/import_run.ts`) |
| `dry_run` | `boolean` | oui | | |
| `status` | `text` | oui | `'running'` | `check (status in ('running', 'done', 'failed'))` |
| `cursor` | `jsonb` | oui | `'{}'` | où reprendre (par exemple `{"skip": 300}`, `{"source": "fathom"}`) |
| `stats` | `jsonb` | oui | `'{}'` | comptes seulement, jamais de donnée personnelle |
| `error` | `text` | non | | |
| `started_at` | `timestamptz` | oui | `now()` | |
| `finished_at` | `timestamptz` | non | | |

Créée et lue par `_shared/import_run.ts` en REST (rôle de service) ; un import « en cours » depuis moins de 10 minutes bloque le
suivant ; mise à jour par `crm_import_save`.

#### `crm_reconciliation_runs` (003)

Aucune fonction du dépôt ne l'écrit.

| Colonne | Type | N | Défaut | Contraintes |
|---|---|---|---|---|
| `id` | `bigint` | oui | identité | PK |
| `run_for_date` | `date` | oui | | |
| `source` | `event_source` | oui | | |
| `expected` | `int` | non | | |
| `found` | `int` | non | | |
| `discrepancies` | `jsonb` | oui | `'[]'` | |
| `ok` | `boolean` | oui | | |
| `created_at` | `timestamptz` | oui | `now()` | |

#### `crm_agent_runs` (003)

Aucune fonction du dépôt ne l'écrit.

| Colonne | Type | N | Défaut | Contraintes |
|---|---|---|---|---|
| `id` | `uuid` | oui | `gen_random_uuid()` | PK |
| `agent_key` | `text` | oui | | index `agent_runs_agent_time (agent_key, started_at desc)` |
| `trigger` | `text` | oui | | |
| `cycle_id` | `uuid` | non | | FK `crm_cycles(id)` `on delete set null` |
| `call_id` | `uuid` | non | | FK `crm_calls(id)` `on delete set null` |
| `status` | `text` | oui | | `check (status in ('running', 'ok', 'escalated', 'error'))` |
| `output_ref` | `text` | non | | |
| `started_at` | `timestamptz` | oui | `now()` | |
| `finished_at` | `timestamptz` | non | | |
| `duration_ms` | `int` | non | | |
| `input_tokens` | `int` | non | | |
| `output_tokens` | `int` | non | | |
| `cost_usd` | `numeric(10,4)` | non | | |
| `error` | `text` | non | | |

#### `crm_alerts` (003)

Instances d'alertes des règles c1 à c18 (la définition des règles est dans `docs` `config/alerts`). Lue par le CRM
(`app/crm/data.js`), le connecteur (`web/api/_crm.js`) et `crm_sales_cockpit` ; mise à jour par `crm_reassign_cycle` et
`crm_merge_people`. **Aucune fonction du dépôt n'y insère de ligne** (le `rules-tick` prévu par `docs/crm/` n'existe pas).

| Colonne | Type | N | Défaut | Contraintes |
|---|---|---|---|---|
| `id` | `uuid` | oui | `gen_random_uuid()` | PK |
| `rule_id` | `text` | oui | | `c1` … `c18` |
| `cycle_id` | `uuid` | non | | FK `crm_cycles(id)` `on delete cascade` |
| `person_id` | `uuid` | non | | FK `crm_people(id)` |
| `severity` | `alert_severity` | oui | | |
| `owner_key` | `text` | oui | | clé de membre ; index partiel `alerts_owner_open (owner_key) where resolved_at is null` |
| `owner_id` | `uuid` | non | | FK `crm_members(id)` |
| `title` | `text` | oui | | |
| `detail` | `text` | non | | |
| `link` | `text` | non | | lien vers le CRM |
| `dedupe_key` | `text` | oui | | index unique partiel `alerts_open_dedupe (dedupe_key) where resolved_at is null` |
| `opened_at` | `timestamptz` | oui | `now()` | |
| `resolved_at` | `timestamptz` | non | | |
| `resolution` | `text` | non | | |

#### `crm_sla_notices` (028)

Ce que `sla-tick` a déjà posté dans Slack (jamais deux fois).

| Colonne | Type | N | Défaut | Contraintes |
|---|---|---|---|---|
| `key` | `text` | oui | | PK : `cycle:sla:minute de départ:niveau` |
| `cycle_id` | `uuid` | non | | FK `crm_cycles(id)` `on delete cascade` ; index `crm_sla_notices_cycle` |
| `sla` | `text` | oui | | |
| `level` | `text` | oui | | `check (level in ('late', 'crit'))` |
| `crossed_at` | `timestamptz` | oui | | moment où le seuil a été franchi |
| `sent_at` | `timestamptz` | oui | `now()` | |

#### `crm_audit_log` (003, 014)

| Colonne | Type | N | Défaut | Contraintes |
|---|---|---|---|---|
| `id` | `bigint` | oui | identité | PK |
| `actor_id` | `uuid` | non | | FK `crm_members(id)` ; index `crm_audit_log_actor_at (actor_id, at desc)` (014) |
| `action` | `text` | oui | | par exemple `declare_outcome`, `correct_outcome`, `add_payment`, `mcp:<outil>` |
| `entity` | `text` | oui | | table ou `mcp` |
| `entity_id` | `text` | oui | | |
| `before` | `jsonb` | non | | |
| `after` | `jsonb` | non | | |
| `at` | `timestamptz` | oui | `now()` | |

### 7.10 Fathom

#### `crm_fathom_recordings` (025, 032, 033)

Chaque enregistrement Fathom lu, rattaché ou non (gardé pour revue, jamais transformé en nouvelle personne).

| Colonne | Type | N | Défaut | Contraintes |
|---|---|---|---|---|
| `recording_id` | `bigint` | oui | | PK |
| `recorded_at` | `timestamptz` | non | | |
| `ended_at` | `timestamptz` | non | | |
| `recorder` | `citext` | non | | |
| `title` | `text` | non | | |
| `url` | `text` | non | | |
| `status` | `text` | oui | | `check (status in ('linked', 'not_sales', 'not_sales_recorder', 'ambiguous'))` |
| `rule` | `text` | non | | contrainte `crm_fathom_recordings_rule_check` : `known`, `email`, `booking`, `booking_closest` (032), `booking_declared` (033), `name` |
| `person_id` | `uuid` | non | | FK `crm_people(id)` `on delete set null` |
| `call_id` | `uuid` | non | | FK `crm_calls(id)` `on delete set null` |
| `candidates` | `uuid[]` | non | | personnes possibles quand `ambiguous` |
| `updated_at` | `timestamptz` | oui | `now()` | |

### 7.11 Analyse d'appel

#### `crm_call_analyses` (003, ancienne)

Prévue avant le moteur ; le moteur écrit les tables `crm_ca_*`. Seul le CRM la lit encore (`app/crm/data.js`, fiche prospect).

| Colonne | Type | N | Défaut | Contraintes |
|---|---|---|---|---|
| `id` | `uuid` | oui | `gen_random_uuid()` | PK |
| `call_id` | `uuid` | oui | | FK `crm_calls(id)` `on delete cascade` |
| `method_version` | `text` | oui | | |
| `model` | `text` | oui | | |
| `status` | `analysis_status` | oui | `'queued'` | |
| `result` | `jsonb` | non | | |
| `input_tokens` | `int` | non | | |
| `output_tokens` | `int` | non | | |
| `created_at` | `timestamptz` | oui | `now()` | |
| `completed_at` | `timestamptz` | non | | |
| `reviewed_by` | `uuid` | non | | FK `crm_members(id)` |
| `review_score` | `int` | non | | |
| `review_note` | `text` | non | | |

#### `crm_ca_config` (020)

Une seule ligne (`id = true`).

| Colonne | Type | N | Défaut | Contraintes |
|---|---|---|---|---|
| `id` | `boolean` | oui | `true` | PK ; `check (id)` |
| `tiers` | `jsonb` | oui | | modèle par niveau ; ensemencé `{"fast": "claude-haiku-5-5", "strong": "claude-sonnet-5-5", "arbiter": "claude-opus-5-5"}` |
| `passes` | `int` | oui | `3` | `check (passes in (1, 3))` |
| `default_timezone` | `text` | oui | `'Asia/Dubai'` | |
| `provisional` | `boolean` | oui | `true` | notes « provisoires » à l'écran |
| `updated_at` | `timestamptz` | oui | `now()` | |

#### `crm_ca_offer` (020)

Référence de l'offre, versionnée (vide tant que Romain ne l'a pas fournie).

| Colonne | Type | N | Défaut | Contraintes |
|---|---|---|---|---|
| `id` | `uuid` | oui | `gen_random_uuid()` | PK |
| `version` | `text` | oui | | unique |
| `data` | `jsonb` | oui | | |
| `active` | `boolean` | oui | `false` | index unique partiel `crm_ca_offer_one_active (active) where active` |
| `created_at` | `timestamptz` | oui | `now()` | |
| `created_by` | `uuid` | non | | FK `crm_members(id)` |

#### `crm_ca_cases` (020)

Bibliothèque de cas clients (vide tant qu'il n'y a pas de cas avec consentement).

| Colonne | Type | N | Défaut |
|---|---|---|---|
| `id` | `uuid` | oui | `gen_random_uuid()` (PK) |
| `title` | `text` | oui | |
| `consent` | `boolean` | oui | `false` |
| `start_value` | `numeric` | non | |
| `start_unit` | `text` | non | |
| `start_profile` | `text` | non | |
| `figures` | `jsonb` | oui | `'{}'` |
| `active` | `boolean` | oui | `true` |
| `created_at` | `timestamptz` | oui | `now()` |

#### `crm_ca_jobs` (020)

Une ligne par analyse demandée.

| Colonne | Type | N | Défaut | Contraintes |
|---|---|---|---|---|
| `id` | `uuid` | oui | `gen_random_uuid()` | PK |
| `call_id` | `uuid` | oui | | FK `crm_calls(id)` `on delete cascade` ; index `crm_ca_jobs_call (call_id, created_at desc)` |
| `status` | `text` | oui | `'queued'` | `check (status in ('queued', 'running', 'done', 'failed'))` ; index `crm_ca_jobs_queue (status, not_before)` |
| `attempts` | `int` | oui | `0` | |
| `not_before` | `timestamptz` | oui | `now()` | |
| `worker` | `text` | non | | |
| `error` | `text` | non | | |
| `engine_version` | `text` | non | | |
| `usage` | `jsonb` | oui | `'{}'` | appels de modèle et jetons par niveau |
| `created_by` | `uuid` | non | | FK `crm_members(id)` |
| `created_at` | `timestamptz` | oui | `now()` | |
| `started_at` | `timestamptz` | non | | |
| `finished_at` | `timestamptz` | non | | |

#### `crm_ca_records` (020)

| Colonne | Type | N | Défaut | Contraintes |
|---|---|---|---|---|
| `job_id` | `uuid` | oui | | PK ; FK `crm_ca_jobs(id)` `on delete cascade` |
| `call_id` | `uuid` | oui | | FK `crm_calls(id)` `on delete cascade` ; index `crm_ca_records_call (call_id, created_at desc)` |
| `status` | `text` | oui | | `ok`, `no_transcript`, `no_diarization`, `diarization_suspect` |
| `flags` | `jsonb` | oui | `'[]'` | |
| `phases` | `jsonb` | oui | `'{}'` | |
| `meta` | `jsonb` | oui | `'{}'` | infos de l'appel + `engine`, `rules` (version par compétence), `duration` |
| `created_at` | `timestamptz` | oui | `now()` | |

#### `crm_ca_turns` (020)

| Colonne | Type | N | Défaut | Contraintes |
|---|---|---|---|---|
| `job_id` | `uuid` | oui | | PK (`job_id`, `idx`) ; FK `crm_ca_jobs(id)` `on delete cascade` |
| `idx` | `int` | oui | | |
| `turn_id` | `text` | oui | | |
| `ts` | `text` | non | | |
| `role` | `text` | oui | | |
| `speaker` | `text` | non | | |
| `text` | `text` | oui | | |
| `repaired` | `boolean` | oui | `false` | |
| `doubtful` | `boolean` | oui | `false` | |

#### `crm_ca_results` (020)

| Colonne | Type | N | Défaut | Contraintes |
|---|---|---|---|---|
| `job_id` | `uuid` | oui | | PK (`job_id`, `competence`) ; FK `crm_ca_jobs(id)` `on delete cascade` |
| `call_id` | `uuid` | oui | | FK `crm_calls(id)` `on delete cascade` ; index `crm_ca_results_call` |
| `competence` | `text` | oui | | `check (competence in ('SPIN', 'GAP', 'PITCH', 'OBJECTIONS'))` |
| `rules_version` | `text` | oui | | |
| `status` | `text` | oui | | |
| `verdict` | `text` | non | | |
| `reasons` | `jsonb` | oui | `'[]'` | |
| `score` | `numeric` | non | | |
| `items` | `jsonb` | oui | `'[]'` | |
| `flags` | `jsonb` | oui | `'[]'` | |
| `details` | `jsonb` | oui | `'{}'` | |
| `concordance` | `text` | non | | |

#### `crm_ca_audit` (020)

| Colonne | Type | N | Contraintes |
|---|---|---|---|
| `job_id` | `uuid` | oui | PK (`job_id`, `seq`) ; FK `crm_ca_jobs(id)` `on delete cascade` |
| `seq` | `int` | oui | |
| `entry` | `jsonb` | oui | une passe de modèle |

Droits des tables `crm_ca_*` : `revoke all from anon`, `grant select to authenticated` (la RLS du §6.5 décide).

### 7.12 Connecteur Claude (OAuth)

#### `mcp_oauth_clients` (014)

Clients enregistrés par Claude (RFC 7591), écrits par `web/api/oauth.js`.

| Colonne | Type | N | Défaut | Contraintes |
|---|---|---|---|---|
| `client_id` | `text` | oui | | PK |
| `client_name` | `text` | non | | |
| `redirect_uris` | `text[]` | oui | | |
| `created_at` | `timestamptz` | oui | `now()` | |

#### `mcp_oauth_codes` (014)

Codes d'autorisation à usage unique (60 s), stockés hachés.

| Colonne | Type | N | Défaut | Contraintes |
|---|---|---|---|---|
| `code_hash` | `text` | oui | | PK |
| `client_id` | `text` | oui | | FK `mcp_oauth_clients(client_id)` `on delete cascade` |
| `redirect_uri` | `text` | oui | | |
| `code_challenge` | `text` | oui | | |
| `user_id` | `uuid` | oui | | |
| `access_token` | `text` | oui | | |
| `refresh_token` | `text` | oui | | |
| `expires_in` | `int` | oui | `3600` | |
| `expires_at` | `timestamptz` | oui | | index `mcp_oauth_codes_expires` |
| `created_at` | `timestamptz` | oui | `now()` | |

---

## 8. Vue

### `crm_people_without_cycle` (009, redéfinie par 010)

`with (security_invoker = true)` : la RLS de `crm_people` s'applique (administrateurs, responsables commerciaux et lecteurs voient
tout le monde ; un commercial `sales` ne voit personne, faute de cycle à posséder). Droits : `revoke all from anon`,
`grant select to authenticated`. Lue par le CRM (`app/crm/data.js`) pour le statut « Sans rendez-vous ».

Une ligne par personne non fusionnée (`merged_into is null`) sans aucun cycle. Colonnes (définition finale, 010) :

| Colonne | Valeur |
|---|---|
| `id`, `full_name`, `primary_email`, `primary_phone`, `created_at` | de `crm_people` |
| `iclosed_status` | `data->>'status_label'` du dernier événement `imported` dont `source_id` commence par `import:import:iclosed:` |
| `last_event_at` | `max(occurred_at)` des événements de la personne |
| `first_seen_at` | de `crm_people` (ajoutée en dernière colonne par 010) |

---

## 9. Fonctions et RPC

Sauf mention, chaque fonction est `security definer` avec `set search_path = public`. « Droits » indique qui peut l'exécuter
(`auth` = `authenticated`, `service` = `service_role`, « interne » = retirée à tous, appelée seulement par d'autres fonctions,
un déclencheur ou pg_cron). « Appelants » vient d'une recherche dans le code JS / TS / Python du dépôt.

Le navigateur appelle les RPC par `app/crm/data.js` (`call(nom, arguments)`, client Supabase de `web/public/lnp-web.js`) ; le
connecteur Claude par `web/api/_crm.js`, `_write.js`, `mcp.js` avec le jeton de la personne ; les Edge Functions par REST avec la
clé du rôle de service (`supabase/functions/_shared/worker.ts`, `import_run.ts`, `sla-tick/index.ts`) ; le worker d'analyse d'appel
par `call-analysis/worker/run.py`.

### 9.1 Application et sécurité

| Fonction | Mode | Droits | Ce qu'elle fait | Appelants | Définition finale |
|---|---|---|---|---|---|
| `my_role() → text` | sql stable definer | défaut (aucun `revoke`) | Rôle d'application de l'appelant. | Politiques de `members`, `docs` ; `crm_admin_set_member`, `crm_merge_alert_defaults`. | 001 |
| `touch_doc() → trigger` | plpgsql invoker | — | Pose `updated_at = now()`, `updated_by = auth.uid()`. | Déclencheur `docs_touch`. | 001 |
| `crm_role()`, `crm_sees_all()`, `crm_owns_cycle(uuid)`, `crm_sees_person(uuid)` | sql stable definer | auth | §6.2. | Politiques RLS ; nombreuses fonctions. | 003 |
| `crm_require(member_role[], uuid default null) → crm_members` | plpgsql stable definer | interne (service) | Contrôle d'accès, §6.2. | Toutes les RPC d'écriture. | 004 (copie 034) |
| `crm_audit(uuid, text, text, text, jsonb, jsonb) → void` | sql definer | interne (service) | Insère une ligne dans `crm_audit_log`. | RPC d'écriture. | 004 |

### 9.2 Écritures du navigateur (004 et suivants)

| Fonction | Droits | Contrôle | Ce qu'elle fait et écrit | Appelants | Définition finale |
|---|---|---|---|---|---|
| `crm_admin_set_member(p_email, p_member_key, p_full_name, p_role member_role, p_lead_key default null, p_iclosed_email default null, p_fathom_email default null, p_whatsapp_number default null, p_active default true) → uuid` | auth, service | administrateur d'application ou du CRM | Retrouve le compte dans `members` par e-mail (erreur s'il n'existe pas : « invitez d'abord la personne »), résout le responsable par sa clé (erreur s'il est inconnu ou s'il s'agit de la personne elle-même), insère ou met à jour `crm_members`, audit `set_member`. | Aucun dans le code (éditeur SQL). | 004 (copie 034) |
| `crm_declare_outcome(p_call uuid, p jsonb) → uuid` | auth, service | `crm_require(['admin','sales_lead'], cycle)` | Voir §12.5. Écrit `crm_call_outcomes` (remplace l'issue courante), `crm_calls.status`, les événements `outcome_<présence>` et `outcome_<décision>`, la vente si « oui », l'audit, puis recalcule le cycle. | `data.js` `declareOutcome` (fiche prospect du CRM, Ma journée `app/salesday_module.js`) ; connecteur `web/api/_write.js` (outil « issue d'un appel »). | 027 (copie 034) |
| `crm_add_note(p_cycle uuid, p_text text) → bigint` | auth, service | idem | Refuse une note vide ; événement `note` (`content` = texte, `source_id` `crm:note:<uuid>`) ; audit `add_note`. Renvoie l'id de l'événement. | `data.js` `addNote` (CRM, Ma journée) ; `web/api/_write.js` (outil « note sur un prospect »). | 004 (copie 034) |
| `crm_reassign_cycle(p_cycle uuid, p_member uuid) → void` | auth, service | `crm_require(['admin','sales_lead'])` | Le nouveau commercial doit être actif et pas `viewer` ; change `owner_id` du cycle et des alertes ouvertes (`owner_id`, `owner_key`) ; audit. | `data.js` `reassignCycle` (CRM, `gen_crm.py`). | 004 (copie 034) |
| `crm_cancel_auto_close(p_cycle uuid) → timestamptz` | auth, service | `crm_require([...], cycle)` | Renvoie maintenant + `max(params.snooze_days)` des règles `auto_close` (7 par défaut) et l'écrit **seulement dans l'audit** (`suppressed_until`). Rien ne le relit. | Exposée par `data.js`, aucun écran. | 004 (copie 034) |
| `crm_set_nurture(p_person uuid, p jsonb) → uuid` | auth, service | `crm_require([...], cycle)` | `p.action` = `enter` (refusé si déjà en maturation, sans cycle d'origine, ou si la personne a refusé les messages ; crée `crm_nurture_tracks` + événement `nurture_entered`), `leave` (statut `removed`, `ended_at`), `set_return` (`return_date`). Cycle = `p.cycle_id` ou le dernier ouvert. Audit `nurture_<action>`. | Exposée par `data.js`, aucun écran. | 004 (copie 034) |
| `crm_resolve_unmatched(p_item uuid, p_person uuid, p_cycle uuid default null) → void` | auth, service | `crm_require(['admin','sales_lead'])` | Marque l'élément résolu et remet sa ligne brute dans la file (`status = 'received'`, `attempts = 0`) pour qu'elle soit retraitée. | Exposée par `data.js`, aucun écran. | 004 (copie 034) |
| `crm_dismiss_unmatched(p_item uuid) → void` | auth, service | idem | `dismissed = true`, résolu par l'appelant. | Exposée, aucun écran. | 004 (copie 034) |
| `crm_merge_people(p_keep uuid, p_merge uuid) → void` | auth, service | idem | Refusé si les deux ont un cycle en cours, ou sont tous deux en maturation. Déplace identités (doublons supprimés), cycles, événements, maturations, messages sortants, alertes ; `merged_into` ; garde le refus de messages le plus ancien. | Exposée, aucun écran. | 004 (copie 034) |
| `crm_update_config(p_table text, p_key text, p_value jsonb) → void` | auth, service | idem | `crm_settings` (valeur entière), `crm_rules` (`enabled`, `params` ; règle inconnue refusée), `crm_stage_definitions` et `crm_reason_codes` (création possible, colonnes données). `is_proposal = false`. Audit `update_config`. Ne recalcule pas les cycles. | Exposée, aucun écran. | 004 (copie 034) |
| `crm_create_checkout(p_cycle uuid) → text` | auth, service | idem | Bouchon : lève `0A000` « Les liens de paiement arrivent en phase 5 (Whop) ». | Exposée, aucun écran. | 004 (copie 034) |
| `crm_merge_alert_defaults() → int` | auth, service | administrateur d'application, ou appel sans `auth.uid()` | Ajoute à `docs` `config/alerts` chaque règle c1–c18 absente : `alerts.cN = {on: true, sev: Initcap(severity), who: [propriétaire, responsable, romain] en 0/1, ch: [1,0,0], crm: true}` et `values["cN.<param>"]` pour chaque seuil numérique absent. Ne touche ni a1–a18 ni une règle c déjà modifiée. Renvoie le nombre de règles ajoutées. | Aucun dans le code ; `web/api/_os.js` lit `crm_settings.alert_rule_defaults` « comme 004 les enregistrerait ». | 004 (copie 034) |
| `crm_set_deal(p_cycle uuid, p_amount numeric, p_currency text default 'EUR') → uuid` | auth | `crm_require([...], cycle)` | Montant signé ≥ 0 ; insère ou met à jour la vente (devise en majuscules, `yes_at` gardé) ; audit `set_deal`. | Exposée (`data.js` `setDeal`), aucun écran. | 022 (copie 034) |
| `crm_add_payment(p_cycle uuid, p_amount numeric, p_paid_at timestamptz, p_method text, p_note text default null) → uuid` | auth | idem | §12.9. | Fenêtre d'encaissement (`app/crm/cash_ui.js` → `data.js` `addPayment`). | 022 (copie 034) |
| `crm_delete_payment(p_payment uuid) → void` | auth | idem (cycle du paiement) | Seulement un paiement `source = 'manual'` ; supprime le paiement et son événement `payment:<id>`, recalcule, audit. La confirmation est demandée dans le navigateur. | `cash_ui.js` (`deletePayment`). | 022 (copie 034) |
| `crm_set_payment_plan(p_cycle uuid, p_amount numeric, p_currency text, p_schedule jsonb) → uuid` | auth | idem | §12.10. | `cash_ui.js` (`setPlan`). | 024 (copie 034) |
| `crm_add_refund(p_payment uuid, p_amount numeric default null, p_refunded_at timestamptz default null, p_note text default null) → numeric` | auth | idem | §12.11. Renvoie le total remboursé du paiement. | `cash_ui.js` (`addRefund`). | 026 (copie 034) |
| `crm_get_pref(p_key text) → jsonb` | auth | ses lignes | Valeur de la clé pour `auth.uid()`. | `gen_crm.py` (`crm.pipeline.cols`), `salesday_module.js` (`salesday.<date>`) via `data.js`. | 031 |
| `crm_set_pref(p_key text, p_value jsonb) → jsonb` | auth | connecté | Refuse sans connexion et au-delà de 20 000 octets ; `null` supprime la clé ; sinon insère ou met à jour ; supprime les clés `salesday.%` de la personne vieilles de plus de 30 jours. | Idem. | 031 (copie 034) |

### 9.3 Chaîne des événements (rôle de service)

| Fonction | Droits | Ce qu'elle fait | Appelants | Définition finale |
|---|---|---|---|---|
| `crm_inbox_pending(p_sources text[], p_limit int default 50) → table (id, source, headers, body, auth_ok, attempts, received_at)` | service | Lignes brutes à traiter (§11.1). `sql stable`. | `worker.ts` (`process-inbox`). | 005 |
| `crm_inbox_mark(p_inbox bigint, p_status inbox_status, p_error text default null) → void` | service | Pose le statut, l'erreur (2 000 caractères max), `processed_at` ; +1 tentative si `failed`. | `worker.ts`. | 005 |
| `crm_apply_items(p_inbox bigint, p_items jsonb) → text` | service | Rendez-vous iClosed (§11.2). | `worker.ts` (source `iclosed`). | 005 (copie 034) |
| `crm_apply_contact(p_inbox bigint, p_items jsonb) → text` | service | iClosed « Contact updated » (§12.13). | `worker.ts` (type `contact_updated`, quelle que soit la source). | 023 (copie 034) |
| `crm_apply_messages(p_inbox bigint, p_items jsonb) → text` | service | Messages WhatsApp d'une ligne brute (§12.12) ; numéro partagé → non rattaché (source de l'élément). | `worker.ts` (source `whatsapp`). | 052 |
| `crm_apply_message_item(it jsonb) → uuid` | interne | Un message : personne, cycle, membre de l'équipe, événement (§12.12). Renvoie le cycle. | `crm_apply_messages`, `crm_import_messages`. | 052 |
| `crm_set_member_whatsapp(p_member uuid, p_number text) → text` | service | Numéro WhatsApp Business d'une personne de l'équipe : chiffres et `+` gardés, `00` → `+`, format `^\+[1-9][0-9]{7,14}$` sinon `22023` « Numéro WhatsApp invalide : écrivez-le avec l'indicatif, par exemple +33 6 12 34 56 78 » ; déjà pris → `23505` « Ce numéro est déjà celui de <nom> » ; membre inconnu → `P0002` ; vide → effacé. Renvoie le numéro gardé. | `web/api/team.js` (`action:"whatsapp"`, après contrôle administrateur). | 052 |
| `crm_apply_recordings(p_inbox bigint, p_items jsonb) → text` | service | Enregistrements Fathom d'une ligne brute : `linked` → `processed`, `ambiguous` → `unmatched`, sinon `ignored` avec une note FL-1 / FL-3 dans `error`. | `worker.ts` (source `fathom`, si un webhook existe). | 025 (copie 034) |
| `crm_apply_recording_item(it jsonb, p_queue boolean) → jsonb` | service | Un enregistrement (§12.7). | `crm_apply_recordings`, `crm_import_recordings`. | 025 |
| `crm_people_for(p_identity jsonb) → uuid[]` | service | Personnes (après fusion) désignées par `{kind: valeur}` parmi `iclosed_contact_id`, `phone`, `email`, `whop_user_id`, `whop_member_id`. `sql stable`. | Fonctions d'application. | 005 |
| `crm_add_identities(p_person uuid, p_identity jsonb, p_source event_source) → void` | service | Ajoute les mêmes types d'identifiants (`on conflict do nothing`). | Idem. | 005 |
| `crm_owner_for(p_host_email text) → uuid` | service | Membre actif dont `iclosed_email` ou `email` est l'hôte ; sinon le membre actif dont `member_key` = `crm_settings.default_owner` ; sinon `null`. | `crm_apply_items`, `crm_import_calls`, `crm_apply_recording_item`. | 005 |
| `crm_open_cycle(p_person uuid, p_at timestamptz, p_owner uuid) → uuid` | service | §12.2. | `crm_apply_items`, `crm_apply_recording_item`. | 005 |
| `crm_recompute_cycle(p_cycle uuid) → void` | service | Le projecteur (§11.5). | Presque toutes les fonctions d'écriture. | 030 (copie 034) ; versions 005, 025, 026 |
| `crm_recompute_all() → int` | auth, service | Recalcule tous les cycles ; réservé à un administrateur du CRM ou à un appel sans jeton. | Aucun dans le code. | 005 (copie 034) |

### 9.4 Imports et rattrapages

| Fonction | Droits | Ce qu'elle fait | Appelants | Définition finale |
|---|---|---|---|---|
| `crm_import_people(p_run uuid, p_source event_source, p_items jsonb, p_dry boolean) → jsonb` | service | §12.15. Compteurs `{created, matched, conflicts, skipped, statuses}`. | `import_run.ts` (`crm-import ?source=close` / `iclosed`). | 007 |
| `crm_import_save(p_run uuid, p_cursor jsonb, p_stats jsonb, p_status text, p_error text default null) → void` | service | Met à jour le curseur, les compteurs, le statut et `finished_at` d'un `crm_import_runs`. `sql`. | `import_run.ts`. | 007 |
| `crm_import_iclosed_disqualified(p_dry boolean default true) → jsonb` | service | §12.15. `{created, already_had_a_cycle, dry}`. | Aucun (manuel). | 008 |
| `crm_import_calls(p_items jsonb, p_dry boolean) → jsonb` | service | §12.15. | `import_run.ts` (`?source=iclosed_calls`). | 009 |
| `crm_import_messages(p_items jsonb, p_dry boolean) → jsonb` | service | Lot de messages déjà lus ; `{items, new, known, new_people, no_cycle, conflicts}`. | Aucun dans le code depuis le retrait de l'import Sendblue (tests SQL seulement ; l'historique WhatsApp arrive par webhook). | 052 |
| `crm_import_recordings(p_items jsonb, p_dry boolean, p_queue boolean default false) → jsonb` | service | Historique Fathom par lots de 10 ; compte par statut et par règle (`rule_<règle>`), `queued`, `speakers_unmapped`. `p_queue` (tâche horaire) met en file les analyses R1/R2 ; un import d'historique non. | `import_run.ts` (`?source=fathom`, tâche `crm-fathom-hourly` avec `queue=1`). | 025 |
| `crm_reclassify_imported(p_dry boolean default true) → jsonb` | service | §12.16. Renvoie les mouvements `"ancien → nouveau": n`. | Aucun (manuel). | 013 |
| `crm_assign_owners_from_hosts(p_dry boolean, p_member uuid default null) → jsonb` | interne | §12.4. | Déclencheur `crm_members_take_leads` ; 015 à l'application. | 015 |
| `crm_mark_won_calls_held(p_dry boolean) → jsonb` | interne | §12.17. | 018 à l'application. | 018 |
| `crm_member_from_team(p_user uuid) → void` | interne | §6.1 et §12.3. | Déclencheur `members_to_crm` ; 011 à l'application. | 011 |

### 9.5 Cockpit commercial

| Fonction | Droits | Ce qu'elle fait | Appelants | Définition finale |
|---|---|---|---|---|
| `crm_sales_cockpit() → jsonb` | auth | §12.19. `plpgsql stable definer` ; refuse un compte sans rôle CRM ; limite aux cycles visibles. | `data.js` `salesCockpit`, module du Cockpit commercial (`app/gen_sales_v2.py`). | 019 (copie 034) ; versions 016 (invoker), 017, 018 |
| `crm_sales_cockpit_window(p_from timestamptz, p_to timestamptz, p_ids uuid[], p_people_all boolean, p_owner uuid default null, p_all boolean default true) → jsonb` | interne | Les chiffres d'une fenêtre (§12.19). `sql stable definer`. | `crm_sales_cockpit`. | 033 ; versions 016 (autre signature, supprimée par 017), 017, 032 |
| `crm_call_is_reschedule(p_call uuid) → boolean` | défaut (aucun `revoke`) | Vrai si le dernier `call_canceled` de l'appel a un motif (`data.cancel_reason` ou `data.reason`) qui correspond à `resched|new time|better time|correspond|organi[sz]ing a new|moving accordingly` (insensible à la casse), ou si l'appel a un `call_rescheduled`. | Fenêtre du cockpit. | 032 |

### 9.6 Fathom, numéros d'appel, absences

| Fonction | Droits | Ce qu'elle fait | Appelants | Définition finale |
|---|---|---|---|---|
| `crm_fathom_sales_recorder(p_email text) → boolean` | service | FL-1 : vrai si la partie locale de l'e-mail est une clé de `crm_sales_team`, ou si l'e-mail (`email`, `fathom_email`, `iclosed_email`) est celui d'un membre dont la clé est dans `crm_sales_team`. | `crm_apply_recording_item`. | 025 |
| `crm_norm_name(p text) → text` | défaut | `sql immutable` (invoker) : minuscules, tout sauf lettres et espaces → espace, espaces réduits, `null` si vide. | Règles par nom. | 025 |
| `crm_fathom_person(it jsonb) → jsonb` | service | FL-2 (§12.7) : `{person, rule}` ou `{rule: 'ambiguous', candidates}` ou `{}`. | `crm_apply_recording_item`. | 033 ; versions 025, 032 |
| `crm_fathom_speaker_map(it jsonb, p_person uuid) → jsonb` | service | Carte des intervenants (§12.7). | `crm_apply_recording_item`. | 025 |
| `crm_rank_calls(p_cycle uuid) → void` | service | §12.6. | Déclencheur `crm_calls_rank` ; 029, 030, 033 à l'application. | 030 ; versions 025, 029 |
| `crm_calls_rank_trigger() → trigger` | — | `perform crm_rank_calls(new.cycle_id)`. | Déclencheur `crm_calls_rank`. | 025 |
| `crm_no_show_setting(p_key text) → text` | défaut | `crm_settings.no_show_rule ->> p_key`. | Règle d'absence. | 030 |
| `crm_call_complete(k crm_calls) → boolean` | défaut | Appel « complet » (§12.8). | Numérotation, règle d'absence, cockpit. | 030 |
| `crm_call_has_ambiguous_recording(p_call uuid) → boolean` | défaut | Un enregistrement encore `ambiguous`, d'au moins `min_minutes`, qui cite la personne de l'appel parmi ses candidats et démarre à ±`fathom_match_minutes` du début prévu. | Règle d'absence, 032 à l'application. | 032 |
| `crm_apply_no_show_rule(p_dry boolean default true, p_cycle uuid default null) → jsonb` | service | §12.8. `{dry, since, no_show_r1, missed_r2_plus, cycles}` ou `{error}` si `since` n'est pas fixé. | `crm_no_show_tick` ; manuel. | 032 ; version 030 |
| `crm_no_show_tick() → jsonb` | interne | Lance `crm_apply_no_show_rule(false)` seulement si `no_show_rule.enabled`. | pg_cron `crm-no-show-hourly`. | 030 |
| `crm_calls_recorded_trigger() → trigger` | — | §12.8 (un enregistrement complet tardif l'emporte). | Déclencheur `crm_calls_recorded`. | 030 |

### 9.7 Analyse d'appel

| Fonction | Droits | Ce qu'elle fait | Appelants | Définition finale |
|---|---|---|---|---|
| `crm_ca_can_read(p_call uuid) → boolean` | auth | §6.2. | Politiques `crm_ca_*`, `crm_ca_latest`, `crm_ca_record`. | 020 |
| `crm_ca_call_info(p_call uuid) → jsonb` | interne | Place de l'appel parmi les appels de vente du cycle : `{call_id, cycle_id, start_utc, event_name, sales_round, eligible, reason, sales_id, sales_name, timezone, person}` (§12.18). | `crm_ca_add_transcript`, `crm_ca_claim`, `crm_ca_store`, `crm_apply_recording_item`. | 025 (copie 034) ; version 020 |
| `crm_ca_add_transcript(p_call uuid, p_raw text, p_speaker_map jsonb, p_source text default 'upload') → jsonb` | auth | Administrateur ou propriétaire du cycle ; appel éligible ; transcription ≥ 200 caractères ; carte avec au moins un `SALES` et un `PROSPECT`, valeurs dans `SALES`/`PROSPECT`/`OTHER`. Écrit les colonnes de transcription, passe les travaux en file à `failed` (« remplacée par une nouvelle transcription »), crée un travail, événement `transcript_added`. Renvoie `{job, status: 'queued'}`. | `app/crm/call_analysis.js` (`caAddTranscript`). | 020 (copie 034) |
| `crm_ca_retry(p_call uuid) → jsonb` | auth | Mêmes droits ; exige une transcription ; ne crée rien si un travail est déjà `queued`/`running` (`{status: 'already queued'}`). | `call_analysis.js` (`caRetry`). | 020 (copie 034) |
| `crm_ca_claim(p_worker text) → jsonb` | interne* | Prend le plus ancien travail `queued` (avec `not_before` passé) ou `running` depuis plus de 2 h (`for update skip locked`), le passe `running`, +1 tentative, renvoie `{job, attempt, call (crm_ca_call_info), transcript, speaker_map, config {tiers, passes}, offer_reference, case_library, prior}` (`prior` = résultats des appels de vente analysés plus tôt dans le cycle). `null` s'il n'y a rien. | `call-analysis/worker/run.py`. | 020 |
| `crm_ca_store(p_job uuid, p_record jsonb, p_usage jsonb, p_engine text) → jsonb` | interne* | Travail `running` obligatoire ; écrit `crm_ca_records` (meta = infos de l'appel + `engine`, `rules`, `duration` = horodatage du dernier tour), `crm_ca_turns`, `crm_ca_results`, `crm_ca_audit` ; travail `done` ; événement `analysis_ready` (`data.scores`). Une note enregistrée n'est jamais modifiée : une nouvelle analyse fait une nouvelle fiche. | `run.py`. | 020 |
| `crm_ca_fail(p_job uuid, p_error text, p_final boolean default false) → jsonb` | interne* | Retente (statut `queued`, `not_before` + 10 min) tant que la tentative < 3 et que l'erreur n'est pas finale ; sinon `failed`. | `run.py`. | 020 |
| `crm_ca_latest(p_calls uuid[]) → jsonb` | auth | Dernier travail de chaque appel lisible, avec notes de la dernière fiche et `provisional`. | Aucun dans le code. | 020 |
| `crm_ca_record(p_job uuid) → jsonb` | auth | Une fiche complète (tours, résultats) si lisible. | `call_analysis.js` / `call_analysis_view.js` (`caRecord`) ; connecteur `web/api/_crm.js`. | 020 |
| `crm_ca_board() → jsonb` | auth | Un élément par appel R1/R2 passé et analysable des cycles visibles (administrateur : tous ; sinon ses cycles) : `{call_id, cycle_id, round, start, transcript, job, status, error, queued_at, started_at, done_job, scores}`. | `data.js` `caBoard` (Pipeline, Prospects, Cycle de vente via `gen_crm.py` ; `call_analysis.js`). | 021 |

\* `crm_ca_claim`, `crm_ca_store`, `crm_ca_fail` sont retirées à `public`, `anon` et `authenticated` **sans** `grant` explicite au
rôle de service : le worker, qui appelle avec la clé du rôle de service, compte sur les privilèges par défaut de Supabase
(voir §16).

### 9.8 SLA et connecteur Claude

| Fonction | Droits | Ce qu'elle fait | Appelants | Définition finale |
|---|---|---|---|---|
| `crm_sla_snapshot(p_days int default 60) → jsonb` | service | §12.20. | `sla-tick`. | 028 |
| `crm_sla_claim(p_items jsonb) → jsonb` | service | Insère les clés pas encore postées dans `crm_sla_notices` et renvoie exactement celles-là. | `sla-tick`. | 028 |
| `crm_sla_settings() → jsonb` | service | `crm_settings.sla_alerts`. | `sla-tick`. | 028 |
| `crm_mcp_call(p_tool text, p_input jsonb) → bigint` | auth | Refuse sans rôle CRM (`42501`) ; refuse le 61e appel de la minute (`P0M60`) ; écrit l'audit `mcp:<outil>` (40 caractères max) avec `after = {input}` ; renvoie l'id. | `web/api/mcp.js` (jeton de la personne). | 014 (copie 034) |
| `crm_mcp_done(p_id bigint, p_rows int, p_ms int, p_error text) → void` | auth | Ajoute `rows`, `ms`, `error` (200 caractères) à la ligne d'audit de l'appelant. | `web/api/mcp.js`. | 014 |

### 9.9 Fonctions de déclencheur restantes

| Fonction | Fichier | Rôle |
|---|---|---|
| `crm_people_first_seen()` | 010 | Abaisse `crm_people.first_seen_at` au `occurred_at` d'un nouvel événement plus ancien. |
| `crm_members_follow_team()` | 011 | `perform crm_member_from_team(new.user_id)`. |
| `crm_members_take_their_leads()` | 015 | Si le membre est actif : `crm_assign_owners_from_hosts(false, new.id)`. |

---

## 10. Déclencheurs

| Déclencheur | Table | Quand | Fonction | Fichier final |
|---|---|---|---|---|
| `docs_touch` | `docs` | `before insert or update`, par ligne | `touch_doc()` | 001 |
| `crm_events_first_seen` | `crm_events` | `after insert`, par ligne | `crm_people_first_seen()` | 010 |
| `members_to_crm` | `members` | `after insert`, par ligne | `crm_members_follow_team()` | 011 |
| `crm_members_take_leads` | `crm_members` | `after insert or update of email, iclosed_email, active`, par ligne | `crm_members_take_their_leads()` | 015 |
| `crm_calls_rank` | `crm_calls` | `after insert or update of scheduled_start, recording_start, recorded_by, transcript_raw, cycle_id`, par ligne, `when (pg_trigger_depth() < 1)` | `crm_calls_rank_trigger()` | 029 (025 sans `transcript_raw`) |
| `crm_calls_recorded` | `crm_calls` | `after update of recorded_by, recording_end, transcript_raw`, par ligne | `crm_calls_recorded_trigger()` | 030 |

La condition `pg_trigger_depth() < 1` empêche la renumérotation de se relancer elle-même (les `update crm_calls set rank` faits par
`crm_rank_calls` ne touchent pas les colonnes surveillées, et un déclencheur imbriqué ne repart pas).

---

## 11. La chaîne des événements et le projecteur

### 11.1 De la requête brute au fait

```
fournisseur ──HTTP──▶ Edge Function *-in ──insert──▶ crm_webhook_log (status received, auth_ok)
                                                            │
pg_cron chaque minute (si des lignes iclosed / whatsapp / fathom attendent) ──▶ process-inbox
                                                            │
             crm_inbox_pending ──▶ mapper de la source (TS) ──▶ éléments canoniques
                                                            │
     auth_ok faux → crm_inbox_mark(rejected) · rien à faire → ignored · exception → failed (+1 tentative)
                                                            │
   crm_apply_items (iclosed) · crm_apply_messages (whatsapp) · crm_apply_recordings (fathom) · crm_apply_contact (contact_updated)
                                                            │
         personne (identités) → cycle (crm_open_cycle) → appel → crm_events (on conflict do nothing)
                                                            │
                     crm_recompute_cycle(cycle touché) ──▶ colonnes dérivées, crm_stage_history, cycle_<statut>
                                                            │
                     crm_webhook_log.status = processed / unmatched / ignored (même transaction)
```

- **File** (`crm_inbox_pending`, 005) : lignes des sources demandées (les sources qui ont un mapper : `iclosed`, `whatsapp`,
  `fathom` ; `worker.ts`), avec moins de 8 tentatives, au statut `received`, ou `failed` après un délai de 2^(tentatives − 1)
  minutes compté depuis `coalesce(processed_at, received_at)` (1, 2, 4… minutes) ; triées par `id`, 50 par défaut.
- Les lignes `whop` restent `received` (pas de mapper ; phase 5).
- Chaque fonction `crm_apply_*` traite tous les éléments d'une ligne brute dans **une transaction**, recalcule chaque cycle touché
  une fois, et pose elle-même le statut final de la ligne (`processed` dès qu'un élément a servi, sinon `unmatched` si un élément
  est parti dans `crm_unmatched_inbox`, sinon `ignored`).
- Format d'un élément (005) : `{source, source_id, type, occurred_at, actor, channel, content, identity{}, refs{}, data{}}`. La clé
  `data.summary` sert aux éléments non rattachés et n'est pas copiée dans l'événement.
- Une ligne rattachée à la main (`crm_resolve_unmatched`) repasse en `received` et sera retraitée comme si elle avait été reconnue.

### 11.2 Rendez-vous iClosed (`crm_apply_items`, 005)

Types traités : `call_booked`, `call_rescheduled`, `call_canceled` (les autres sont sautés).

1. L'appel est cherché par `refs.iclosed_call_id`. Un report d'un appel inconnu est traité comme une prise de rendez-vous.
2. Appel inconnu :
   - annulation → élément non rattaché « Annulation d'un appel inconnu du CRM » ;
   - les identifiants désignent plusieurs personnes → non rattaché « Les identifiants désignent plusieurs personnes » (avec les
     candidats) ;
   - aucune personne → création (`full_name`, `primary_email`, `primary_phone` de `identity`) ; une personne → ses champs vides
     sont complétés.
3. Les identifiants sont ajoutés (`crm_add_identities`).
4. Nouveau rendez-vous : propriétaire = `crm_owner_for(data.host_email)` ; cycle = le cycle en cours de la personne, sinon
   `crm_open_cycle` ; nouvel appel au rang `max + 1`, statut `scheduled`, `host_id` = propriétaire (le déclencheur de rang
   renumérote ensuite).
5. Appel connu, rendez-vous ou report : appliqué seulement si aucun `call_booked`/`call_rescheduled` plus récent n'existe pour
   l'appel (un événement ancien n'écrase jamais un plus récent) ; un nouveau début sans fin garde la durée ; un appel annulé repasse
   `scheduled`. Le type enregistré devient `call_rescheduled` si l'appel a déjà un `call_booked`, sinon `call_booked`.
6. Annulation d'un appel connu : même garde d'ancienneté ; statut `canceled` si `scheduled` ou `outcome_pending`.
7. Événement inséré (acteur par défaut `prospect`, canal par défaut `booking`, `inbox_id`), `on conflict (source, source_id) do
   nothing` : rejouer une ligne ne double rien.

### 11.3 Types d'événements écrits

| Type | Écrit par | `source` | `actor` / `channel` | Effet sur le projecteur |
|---|---|---|---|---|
| `call_booked` | `crm_apply_items` ; `crm_import_calls` | iclosed / import | élément (défaut prospect) / booking | entre dans l'étape `show` |
| `call_rescheduled` | `crm_apply_items` | iclosed | idem | — |
| `call_canceled` | `crm_apply_items` ; `crm_import_calls` | iclosed / import | élément ; import : system / booking | — |
| `call_recorded` | `crm_apply_recording_item` | fathom | sales / video | — |
| `call_missed` | `crm_apply_no_show_rule` | rules | system / crm | — (le statut d'appel `missed` donne la prochaine action) |
| `outcome_held`, `outcome_no_show` | `crm_declare_outcome` ; `crm_import_calls` ; `crm_mark_won_calls_held` (held) ; `crm_apply_no_show_rule` (no_show) | crm / import / crm / rules | sales ou system / crm | `outcome_held` entre dans l'étape `decision` |
| `outcome_yes`, `outcome_no`, `outcome_follow_up`, `outcome_disqualified` | `crm_declare_outcome` | crm | sales / crm | `outcome_yes` entre dans l'étape `cash` ; le statut se lit dans `crm_call_outcomes` |
| `note` | `crm_add_note` | crm | sales / crm | compte comme relance dans le cockpit |
| `nurture_entered` | `crm_set_nurture` | crm | sales / crm | — |
| `nurture_reactivated`, `cycle_reopened` | `crm_open_cycle` | crm | system / crm | `cycle_reopened` remet le cycle en cours |
| `cycle_won`, `cycle_lost`, `cycle_disqualified` | projecteur ; `crm_import_iclosed_disqualified`, `crm_import_calls`, `crm_reclassify_imported` | crm / import | system / crm | ceux de source `import` ferment le cycle (règle 4 du §11.5) ; un `cycle_lost` de source `rules` aussi (règle 5) |
| `imported` | `crm_import_people` | import | system / crm | sur la personne, sans cycle |
| `message_in`, `message_out`, `opt_out` (`phone_call_in`, `phone_call_out` acceptés mais plus reçus) | `crm_apply_message_item` | whatsapp (celle de l'élément) | élément / élément (`whatsapp` ; `member_id` = le membre dont c'est le numéro) | compteurs de tentatives et derniers contacts |
| `payment_succeeded` | `crm_add_payment` | crm | sales / payment | le premier gagne le cycle |
| `payment_refunded` | `crm_add_refund` | crm | sales / payment | date de la perte « Remboursé » |
| `transcript_added` | `crm_ca_add_transcript` | crm | sales / analysis | — |
| `analysis_ready` | `crm_ca_store` | crm | system / analysis | — |

### 11.4 Conventions de `source_id`

| Forme | Écrit par |
|---|---|
| `crm:crm_call_outcomes:<issue>:attendance` / `:decision` | `crm_declare_outcome` |
| `crm:note:<uuid>` | `crm_add_note` |
| `crm:crm_nurture_tracks:<id>:entered` / `:reactivated` | `crm_set_nurture`, `crm_open_cycle` |
| `reopen:<cycle>:<moment>` | `crm_open_cycle` |
| `status:<cycle>:<statut>:<moment>` | projecteur |
| `import:<source>:<source_ref>` (donc `import:import:…` puisque `import_run.ts` passe `p_source = 'import'`) | `crm_import_people` |
| `import:dq:<personne>` | `crm_import_iclosed_disqualified` |
| `import:call:<iclosed_call_id>:booked` / `:canceled` / `:held` / `:no_show` | `crm_import_calls` |
| `import:close:<cycle>` | `crm_import_calls`, `crm_reclassify_imported` |
| `backfill:held:<appel>` | `crm_mark_won_calls_held` |
| `payment:<paiement>` | `crm_add_payment` |
| `refund:<paiement>:<total remboursé>` | `crm_add_refund` |
| `transcript:<travail>` | `crm_ca_add_transcript` |
| `analysis:<travail>` | `crm_ca_store` |
| `noshow:<appel>` (source `rules`) | `crm_apply_no_show_rule` |
| celui de l'élément (`whatsapp:<wamid>` pour un message, `whatsapp:optout:<wamid>` pour un STOP ; celui du mapper pour iClosed et Fathom) | `crm_apply_items`, `crm_apply_message_item`, `crm_apply_recording_item` |

### 11.5 Le projecteur `crm_recompute_cycle` (définition finale : 030, recopiée par 034)

Il verrouille le cycle (`for update`) et reconstruit tout ce qui est dérivé.

**Étapes.** L'historique d'étapes du cycle est effacé puis recréé : pour chaque étape active, dans l'ordre de `position`, la date
d'entrée est le plus ancien `occurred_at` d'un événement du cycle dont le type figure dans `enter_on` ; une étape sans événement est
sautée ; l'étape précédente reçoit `exited_at = greatest(entrée suivante, sa propre entrée)`. L'étape courante est **la dernière
atteinte dans l'ordre des positions** (pas la plus récente dans le temps), et `stage_entered_at` sa date d'entrée.

**Statut**, dans cet ordre de priorité :

1. **Tout remboursé → perdu** (026) : il existe un `payment_succeeded`, au moins un paiement a `refunded_amount > 0` et aucun
   paiement n'a `amount − refunded_amount > 0` → `lost`, motif `refunded`, fermé au dernier `payment_refunded` (à défaut, au plus
   récent `updated_at` des paiements). Un remboursement partiel garde le cycle gagné.
2. **Premier paiement → gagné** : `won`, fermé au premier `payment_succeeded`.
3. **Issue déclarée** : la plus récente issue courante (par `declared_at`) ; si sa décision est `no` ou `disqualified` et qu'elle
   est postérieure au dernier `cycle_reopened` → `lost` ou `disqualified`, motif de l'issue, fermé à `declared_at`. Un « oui » sans
   paiement laisse le cycle **en cours** (étape `cash`).
4. **Fermeture importée** : s'il n'y a **aucune** issue courante et qu'un `cycle_won`/`cycle_lost`/`cycle_disqualified` de source
   `import` est postérieur à la dernière réouverture → le statut du plus récent de ces événements, avec son `data.reason`.
5. **Perte par règle** : le plus récent `cycle_lost` de source `rules`, s'il est postérieur à la dernière réouverture → `lost`.
6. Sinon **en cours** (`active`), sans motif ni date de fermeture.

Si le statut change et n'est pas `active`, un événement `cycle_<statut>` est écrit (source `crm`, `data.reason`,
`on conflict do nothing`).

**Prochaine action** (`next_move`), `null` si le cycle n'est pas en cours, sinon la première qui s'applique :

| Condition | `next_move` |
|---|---|
| Un appel terminé (`coalesce(recording_end, scheduled_end) < maintenant`) encore `scheduled`, ou `held` avec enregistrement Fathom (`recorded_by`) et sans issue courante — le plus ancien | `{who: 'sales', code: 'declare_outcome', label: "Déclarer l'issue de l'appel", due_at: fin de cet appel}` |
| Un appel `scheduled` à venir — le plus proche | `{who: 'prospect', code: 'attend_call', label: 'Appel R<rang>', due_at: début}` |
| Le dernier appel (rang le plus haut, puis début le plus récent) est `missed` | `{who: 'sales', code: 'rebook', label: "Replanifier l'appel", missed: <rang>}` |
| Le dernier appel est `canceled` | `{who: 'sales', code: 'rebook', label: 'Reprendre un rendez-vous'}` |
| Sinon | `{who: 'sales', code: 'follow_up', label: 'Relancer'}` |

**Compteurs** : `calls_held` (appels `held`), `no_shows` (appels `no_show`), `sales_attempts` (événements `message_out` /
`phone_call_out` d'acteur `sales`), `last_prospect_at` (dernier `message_in` / `phone_call_in` d'acteur `prospect`),
`last_sales_at`, `last_event_at` (dernier événement du cycle), `closed_at`, `close_reason` (seulement pour `lost` /
`disqualified`), `projected_at = now()`.

Historique des versions : 005 (première), 025 (FL-6 : un appel enregistré sans issue demande son issue ; dernier appel trié par
rang puis enregistrement), 026 (règle du remboursement), 030 (prochaine action après un appel manqué).

---

## 12. Règles métier écrites en SQL

### 12.1 Retrouver une personne

Une personne est retrouvée par **n'importe lequel** de ses identifiants normalisés (`crm_person_identities`, unique par
`(kind, value)`), en suivant `merged_into`. Plusieurs personnes désignées → on ne devine jamais : élément non rattaché (flux en
direct) ou compteur `conflicts` (imports). Les imports normalisent : e-mails en minuscules et contenant `@`, téléphones conformes
à `^\+[0-9]{8,15}$`.

### 12.2 Ouvrir un cycle (`crm_open_cycle`, 005)

Au premier rendez-vous d'une personne sans cycle en cours :
- si elle n'est pas en maturation et que son dernier cycle est **perdu depuis moins de `reopen_days`** (`crm_rules.next_move.params`,
  30 par défaut) → ce cycle repasse `active` et reçoit un `cycle_reopened` (le projecteur le garde en cours tant qu'aucune issue
  plus récente ne le ferme) ;
- sinon un nouveau cycle : origine `nurture` si une maturation est active (la maturation passe `reactivated`, `ended_at`,
  `reactivated_cycle_id`, événement `nurture_reactivated`), sinon `new` ; `previous_cycle_id` = cycle d'origine de la maturation ou
  dernier cycle.

### 12.3 Tout le monde voit tout (011)

Décision de Romain du 2026-10-25 : chaque écran et le CRM sont ouverts à toute l'équipe. 011 efface la liste d'écrans
(`raw_app_meta_data - 'screens'`) de chaque compte (l'accès par défaut de `web/api/_screens.js` devient « tous les écrans ») et donne
une ligne `crm_members` à chaque membre (clé = partie locale de l'e-mail réduite à `[a-z0-9]`, suffixée 2, 3… en cas de doublon,
`member` si vide ; nom = partie locale avec majuscule ; rôle selon §6.1).

### 12.4 Propriétaires d'après les hôtes (005, 015)

- En direct : le propriétaire d'un nouveau cycle est le membre dont l'e-mail ou l'e-mail iClosed est l'hôte iClosed, sinon le membre
  `default_owner` (`"sales"`), sinon personne.
- Rattrapage (015) : un cycle **sans propriétaire** prend le membre actif dont l'`email` ou l'`iclosed_email` est l'hôte de son
  dernier `call_booked` (`data.host_email`) ; ses appels réservés avec cet hôte reçoivent `host_id`. Un propriétaire déjà posé
  n'est jamais changé. Relancé automatiquement pour un membre quand il est ajouté ou que son `email`, `iclosed_email` ou `active`
  change (déclencheur), de sorte qu'inviter un commercial lui donne ses prospects. Renvoie `{cycles, calls, by_member,
  still_unassigned, still_unassigned_live}`.

### 12.5 Déclarer une issue (`crm_declare_outcome`, 027)

`p = {attendance, decision, reason_code, nurture, return_date, next_step, amount_sold, currency, product, payment_plan, note, extra}`.

- Présence obligatoire ; une absence n'a pas de décision ; un appel honoré en demande une.
- `no` exige un motif actif de nature `lost`, `disqualified` un motif de nature `disqualified`.
- L'issue courante est marquée `superseded_at` (correction, audit `correct_outcome`), la nouvelle est insérée (audit
  `declare_outcome`), `crm_calls.status` prend la présence (`held` / `no_show`).
- Événements : `outcome_<présence>` (`data.outcome_id`, `correction`), puis `outcome_<décision>` (`content` = note, `data` avec motif,
  maturation, date de retour, prochaine étape, montant, devise, échéancier).
- **« Oui » garde la vente** (027) : la vente du cycle est créée ou mise à jour, mais chaque champ (`product`, `amount_sold`,
  `currency`, `payment_plan`) ne remplace l'existant que si l'issue le fournit ; `yes_at` garde le premier « oui ». Avant 027, un
  « oui » sans montant effaçait le montant saisi par `crm_set_deal` / `crm_set_payment_plan`.
- Puis recalcul du cycle. Un « oui » ne gagne pas le cycle : seul un paiement le fait.

### 12.6 Numéros d'appel R1, R2… (025, 029, 030)

Définition finale (`crm_rank_calls`, 030) : les appels du cycle sont parcourus par
`coalesce(recording_start, scheduled_start, created_at)`, puis `created_at`, puis `id`. Un appel **complet** (§12.8) prend le
numéro suivant `n + 1` et fait avancer le compteur ; tout autre appel (réservé, reporté, annulé, absent, passé sans enregistrement)
porte le numéro de l'appel complet à venir (`n + 1` sans avancer). Ainsi un R1 annulé et sa nouvelle réservation sont tous deux R1,
et un R2 n'existe qu'après un R1 complet (« un R2 ou R3 ne peut exister que s'il y a eu une analyse d'appel », Romain
2026-10-31). Historique : 025 ne numérotait que les cycles ayant un enregistrement (FL-5), 029 comptait tout enregistrement ou
transcription, 030 exige un appel complet.

### 12.7 Fathom, source de vérité des appels (FL-1 à FL-6 ; 025, 032, 033)

Pour chaque enregistrement (`crm_apply_recording_item`) :

- **FL-1** : l'enregistreur doit être un commercial (`crm_fathom_sales_recorder`) ; sinon statut `not_sales_recorder`.
- **FL-2** : la personne est trouvée par la première règle qui donne exactement une personne (`crm_fathom_person`, définition
  finale 033). Un enregistrement déjà lié à un appel (`fathom_recording_id`) garde sa personne (règle `known`).
  1. **`email`** : e-mails des invités externes et des intervenants (`identity.emails`), jamais celui de l'enregistreur ni d'un
     membre de l'équipe. Plusieurs personnes → `ambiguous`.
  2. **`booking`** : les personnes dont un appel non annulé, non encore lié à un enregistrement, démarre à ±`fathom_match_minutes`
     (90) du début de l'enregistrement et a pour hôte l'enregistreur (hôte iClosed de la réservation ou `host_id`). Une seule →
     `booking`. Plusieurs : **`booking_closest`** (032) si la plus proche démarre à moins de `fathom_close_minutes` (15) et la
     suivante au-delà ; sinon **`booking_declared`** (033) si, parmi celles dont l'appel démarre à moins de 15 minutes, une seule a
     une issue courante déclarée `held` ; sinon `ambiguous` avec les candidats.
  3. **`name`** : un nom (invités, intervenants, titre : `data.names`) normalisé égal au nom complet (deux mots au moins) d'une
     personne. Plusieurs → `ambiguous`.
- **FL-3** : aucune personne → `not_sales` : gardé dans `crm_fathom_recordings`, jamais une nouvelle personne.
- **FL-4** : un enregistrement lié est un appel honoré : il remplit l'appel réservé de la personne le plus proche dans la fenêtre de
  90 minutes (les appels non annulés d'abord) ; sinon un nouvel appel `held` est créé dans le cycle ouvert à ce moment (cycle ouvert
  au plus tard un jour après le début, le plus récent ; sinon le premier ; sinon `crm_open_cycle`). L'appel reçoit
  `fathom_recording_id`, `recorded_by`, `recording_start` / `end`, liens, résumé, transcription ; un statut `scheduled`,
  `outcome_pending` ou `canceled` devient `held`. Événement `call_recorded` (`data` : id, titre, lien, durée, règle, enregistreur,
  `speakers_mapped`).
- **Carte des intervenants** (`crm_fathom_speaker_map`) : l'enregistreur (par e-mail ou nom) = `SALES`, la personne (par e-mail ou
  nom) = `PROSPECT`, les autres `OTHER` ; si personne n'est reconnu comme prospect et qu'il reste un seul autre intervenant, il
  devient `PROSPECT`. `null` s'il manque un `SALES` ou un `PROSPECT`.
- La transcription Fathom (`data.transcript_raw`) n'est copiée dans `transcript_raw` que si la carte existe et qu'aucune
  transcription n'a été ajoutée à la main (`transcript_source` vide ou `fathom`).
- **FL-5** : numérotation (§12.6).
- **FL-6** : un appel enregistré demande son issue tant qu'aucune n'est déclarée (projecteur) ; sa transcription part en analyse
  (R1 et R2 seulement, appel éligible, ≥ 200 caractères, aucun travail `queued`/`running`/`done`) **seulement** quand l'appel vient
  de la tâche horaire ou d'un webhook (`p_queue`), jamais d'un import d'historique.
- La ligne de `crm_fathom_recordings` est insérée ou mise à jour à chaque passage (une `rule` déjà connue est gardée si la nouvelle
  est vide).

### 12.8 Règle d'absence (030, 032, 033)

- **Appel complet** (`crm_call_complete`) : un enregistrement Fathom (`recorded_by`, début et fin) d'au moins
  `no_show_rule.min_minutes` minutes (**30** depuis 033 ; 7 en 030 ; 7 si le réglage manque), **ou** une transcription ajoutée à la
  main (`transcript_raw` non vide et `transcript_source` différent de `fathom`).
- **Règle** (`crm_apply_no_show_rule`) : pour chaque cycle non gagné ayant un appel depuis `no_show_rule.since`, appels parcourus
  dans l'ordre de numérotation. Un appel complet marque « déjà vu ». Un appel est jugé s'il n'est ni `canceled` ni `missed`, ni
  déjà `no_show` en phase R1, qu'il a un début ≥ `since`, que `grace_hours` (3) sont passées après sa fin, qu'il n'a pas d'issue
  déclarée et (032) qu'**aucun enregistrement encore ambigu** ne peut être le sien (`crm_call_has_ambiguous_recording`). Alors :
  - aucun appel complet avant lui (phase R1) → statut `no_show` + événement `outcome_no_show` (source `rules`) ;
  - un appel complet avant lui (R2, R3…) → statut `missed` + événement `call_missed` ; le prospect reste dans son tour et la
    prochaine action devient « Replanifier l'appel ».
  - Les cycles touchés sont recalculés. Sans `since`, la fonction renvoie une erreur et ne fait rien.
- **Lancement** : toutes les heures à la minute 35 (`crm_no_show_tick`), seulement si `no_show_rule.enabled` (faux par défaut).
- **Un enregistrement complet tardif l'emporte** (déclencheur `crm_calls_recorded`) : un appel `no_show` ou `missed` qui devient
  complet sans issue déclarée repasse `held`, l'événement `noshow:<appel>` est supprimé et le cycle recalculé.
- 032 a remis en `scheduled` les absences posées par la règle sur un appel qu'un enregistrement ambigu peut couvrir.

### 12.9 Encaissement saisi à la main (022)

`crm_add_payment` : montant > 0 ; date pas plus d'un jour dans le futur ; moyen `bank_transfer`, `card`, `cash` ou `other` ; crée la
vente si elle manque (devise `EUR`, `yes_at` = date du paiement) ; insère `crm_payments` (`source = 'manual'`, `status = 'paid'`,
devise de la vente) et l'événement `payment_succeeded` (`data` : montant, devise, moyen, `manual: true`, `payment_id`) ; recalcule
(le premier paiement **gagne** le cycle) ; audit. `crm_delete_payment` défait tout cela pour un paiement manuel.

### 12.10 Échéancier (024)

`crm_set_payment_plan` : montant signé > 0 ; échéancier = tableau de 1 à 12 échéances, chacune avec une date et un montant > 0
(arrondi au centime) ; la somme doit égaler le montant signé à 0,01 près ; les échéances sont triées par date. Écrit
`crm_deals.amount_sold`, `currency` (en majuscules ; sinon celle de la vente, sinon `EUR`), `schedule`, `payment_plan` = « Payé en une
fois » (une échéance) ou « N échéances ». Les paiements reçus sont rapprochés des échéances **par l'écran**, dans l'ordre des dates ;
rien n'est lié en base.

### 12.11 Remboursements = perdu (026)

`crm_add_refund` : montant par défaut = le reste du paiement ; > 0 ; ne peut pas dépasser le paiement ; pas plus d'un jour dans le
futur ; augmente `refunded_amount` ; événement `payment_refunded` (`data.full` vrai quand tout est remboursé) ; recalcul ; audit.
Un cycle dont **tous** les paiements sont remboursés est perdu avec le motif automatique `refunded` (§11.5, règle 1). Le montant
encaissé du cockpit est toujours net des remboursements.

### 12.12 Messages WhatsApp (012, définition finale 052)

Types : `message_in`, `message_out`, `opt_out` (la fonction accepte encore `phone_call_in` et `phone_call_out`, que plus aucune
source n'envoie). La source est celle de l'élément (`whatsapp` par défaut). La personne est trouvée par ses identifiants ; un
numéro inconnu crée une personne, avec le nom de son profil WhatsApp s'il est connu (règle d'équipe : le WhatsApp Business déclaré
ne sert qu'avec des prospects), donc aucun message n'est perdu ; un numéro partagé par plusieurs personnes lève `P0M02` (non
rattaché « Plusieurs personnes ont ce numéro de téléphone » en direct, compteur `conflicts` en import). `opt_out` pose
`opted_out_at`. La personne de l'équipe est celle dont `crm_members.whatsapp_number` vaut `data.line` (le numéro WhatsApp Business
du message) : elle va dans `crm_events.member_id`. Cycle : le dernier ouvert avant le message, sinon le premier.
Un message est un seul événement retrouvé par son `source_id` (`whatsapp:<wamid>`) : un webhook ultérieur fusionne `data` (sans
les `null`), ne garde le nouveau contenu que s'il n'est pas vide (envoyé → distribué → lu), garde la date la plus ancienne et le
premier membre trouvé ; l'acteur devient `sales` dès qu'une des livraisons vaut `sales` (un message vu d'abord par son seul
statut, donc envoyé par l'API et `auto`, devient « commercial » quand l'écho de l'application arrive).

### 12.13 Mise à jour de contact iClosed (023)

Seuls le nom, l'e-mail et le téléphone listés dans `data.changed` sont repris ; le statut iClosed n'est jamais lu (le statut se décide
dans le CRM). Personne trouvée par `iclosed_contact_id` (inconnue → non rattaché). Un nouvel e-mail ou téléphone qui appartient
déjà à quelqu'un d'autre → non rattaché, rien n'est modifié. Sinon la nouvelle valeur devient principale et l'ancienne reste un
identifiant. Aucun événement n'est écrit.

### 12.14 Première apparition (010)

`first_seen_at` = le plus ancien de `created_at` et des `occurred_at` de ses événements ; abaissé à chaque nouvel événement plus
ancien. C'est la date « Créé » du CRM et la base du compte de « prospects » du cockpit (`created_at` n'est que le jour d'écriture : les
imports ont écrit 1 501 lignes le 2026-10-24).

### 12.15 Imports (007, 008, 009)

- **`crm_import_people`** : une personne par contact, retrouvée par n'importe quel identifiant (e-mails, téléphones,
  `close_contact_id`, `iclosed_contact_id`) ; aucun identifiant → `skipped` ; plusieurs personnes → `conflicts` ; sinon création ou
  complément du nom. Le statut et les opportunités du contact sont gardés dans un événement `imported` sur la personne (mis à jour
  à chaque import). Aucun cycle n'est créé (il faudrait d'abord la table de correspondance `close_status_map`, jamais créée).
- **`crm_import_iclosed_disqualified`** : chaque personne importée d'iClosed au statut `DISQUALIFIED` et **sans cycle** reçoit un
  cycle fermé `disqualified` (motif `dq_off_target`, ouvert et fermé à la date de l'import) avec un `cycle_disqualified` de source
  `import`.
- **`crm_import_calls`** : par personne, ses appels iClosed triés (statuts traduits par l'Edge Function ; `REJECTED` =
  disqualifié selon Romain 2026-10-24). Cycle = celui qui contient déjà l'un de ces appels, sinon le dernier de la personne, sinon un
  nouveau ouvert au premier rendez-vous (propriétaire d'après l'hôte du premier appel) ; `opened_at` est ramené au plus ancien. Chaque
  appel inconnu devient un appel avec ses vraies dates et son statut, un `call_booked`, puis `call_canceled` ou
  `outcome_held` / `outcome_no_show`. Une fermeture (`close`) n'est écrite que si le cycle n'a pas déjà de fermeture importée et n'a
  aucun appel à venir ; le statut du cycle est alors posé directement (pour que le projecteur n'en ajoute pas une seconde). Les
  personnes sans aucun appel n'ont pas de cycle (vue `crm_people_without_cycle`).

### 12.16 Reclassement des cycles importés (013)

Pour chaque cycle qui a un événement d'import, **aucune issue déclarée et aucun paiement** (Romain 2026-10-25 : des prospects gagnés
apparaissaient disqualifiés ou perdus) :

| Nouveau statut | Condition (dans l'ordre) |
|---|---|
| `won` | Close « Customer » ou une opportunité Close gagnée, un appel d'accueil ou d'étude de cas (nom d'événement contenant « onboarding » ou « case stud »), ou une issue iClosed `WON` — à la plus ancienne de ces dates |
| `disqualified` (`dq_off_target`) | Contact iClosed `DISQUALIFIED`, ou dernier appel terminé en `UNQUALIFIED`, `BAD_FIT`, ou `REJECTED` sans annulation (`ADMIN_CANCELLED`, `CONTACT_CANCELLED`) |
| `active` | Un appel à venir, ou le dernier appel il y a moins de 30 jours (mais `lost`/`timing` si la personne a déjà un autre cycle en cours) |
| inchangé | Aucun appel : rien à lire |
| `lost` | Sinon : motif `unreachable` si le dernier appel est une absence, `timing` sinon |

Les anciens événements de fermeture (`import`, `crm`) sont supprimés et remplacés par un `import:close:<cycle>`.

### 12.17 Appels des cycles gagnés honorés (018)

Dans chaque cycle gagné, tout appel passé encore `scheduled` devient `held` avec un `outcome_held` (source `crm`, acteur `system`).
Aucune issue n'est déclarée (un « oui » sans paiement rouvrirait le cycle). La fonction vérifie que le nombre de cycles gagnés n'a
pas changé, sinon elle annule tout.

### 12.18 Quels appels sont analysés (020, 025)

`crm_ca_call_info` (définition finale 025) :
- cycle **avec** au moins un enregistrement Fathom de commercial : seuls les appels enregistrés sont des appels de vente, leur tour
  = leur rang (FL-5) ;
- cycle **sans** enregistrement : les appels non annulés dont le nom d'événement iClosed ne correspond pas à
  `(onboarding|case stud)`, numérotés dans l'ordre de leur début.
- Éligible : appel de vente, tour 1 ou 2, déjà commencé. Raisons de refus : « aucun enregistrement Fathom de cet appel par un
  commercial », « pas un appel de vente (accueil ou étude de cas) », « appel annulé », « l'appel n'a pas encore eu lieu », « seuls les
  appels de vente R1 et R2 sont analysés ».
- Commercial = propriétaire du cycle, sinon partie locale de l'enregistreur ou de l'hôte ; nom = membre, sinon `crm_sales_team`,
  sinon partie locale avec majuscule ; fuseau = celui du propriétaire, sinon `crm_ca_config.default_timezone`.

### 12.19 Chiffres du Cockpit commercial (016 → 019, 032, 033)

`crm_sales_cockpit()` (019) décide une fois ce que l'appelant voit (tous les cycles si `crm_sees_all()`, sinon les siens) puis
renvoie :

```
{ generated_at, periods: {"7": {now, base}, "30": {…}, "56": {…}}, team: {"7": [{id, name, figures}], …},
  weekly: [8 fenêtres d'une semaine, la plus ancienne d'abord], pipeline, aov_180, alerts: [{c, o, imp, t, obj, at}],
  has_payments, has_deals }
```

- **Périodes** : 7, 30 et 56 jours avant maintenant ; `base` = la même durée juste avant (référence).
- **Équipe** : les cycles visibles regroupés par commercial = clé du propriétaire, sinon partie locale de l'hôte du dernier
  `call_booked` ; **seuls les commerciaux de `crm_sales_team` ont une ligne** (les cycles des autres comptent dans les totaux).
- **Panier moyen 180 j** (`aov_180`) : moyenne des montants signés > 0 des ventes dont le « oui » date de moins de 180 jours.
- **Pipeline pondéré** : pour chaque cycle en cours visible, (montant de sa vente s'il est > 0, sinon `aov_180`) × taux de
  conversion observé de son étape = part de gagnés parmi les cycles fermés depuis 180 jours dont l'étape courante est à cette
  position ou au-delà.
- **Encaissements à risque** (`alerts`, 60 au plus, triés par valeur puis date) : les alertes ouvertes visibles de `crm_alerts`, puis
  les cycles en cours dont `next_move.due_at` est passé et qui n'ont pas d'alerte ouverte (titre = libellé de la prochaine action
  + « · en retard », objet = nom · libellé de l'étape) ; valeur = montant ou `aov_180` × max(taux de l'étape, 0,05).
- `has_payments`, `has_deals` : ce que le CRM ne peut pas encore mesurer.

**Fenêtre** `crm_sales_cockpit_window` (définition finale 033), sur `[p_from, p_to)` et les cycles donnés :

| Clé | Calcul |
|---|---|
| `leads` | personnes non fusionnées dont `first_seen_at` est dans la fenêtre (toutes si l'appelant voit tout et que la fenêtre porte sur tous les cycles ; sinon seulement celles des cycles donnés) |
| `booked` | événements `call_booked` des cycles dans la fenêtre |
| `held`, `no_show` | appels `held` / `no_show` dont le début est dans la fenêtre |
| `no_outcome` | appels de la fenêtre encore `scheduled` alors que leur début est passé |
| `shown_leads` | cycles ayant un appel passé dans la fenêtre et qui sont gagnés (033) ou ont eu au moins un appel complet déjà commencé |
| `pending_leads` | parmi les autres : un appel à venir, ou dernier appel annulé pour être reporté (`crm_call_is_reschedule`) |
| `no_show_leads` | les autres (ni présents ni en attente) — le taux de présence se compte en prospects depuis 032 |
| `won` | cycles gagnés dont `closed_at` est dans la fenêtre |
| `signed`, `deals` | somme des montants signés et nombre de ventes avec montant > 0 dont `yes_at` est dans la fenêtre |
| `received`, `refunded`, `cash` | somme des paiements et des remboursements dont `paid_at` est dans la fenêtre ; `cash = received − refunded` |
| `follow_total`, `follow_done` | appels honorés de la fenêtre ; ceux suivis dans les 24 h après leur fin par un `message_out` d'un commercial, une `note` ou un `outcome_*` |
| `days_per_stage` | médiane (en jours, une décimale) des durées des passages d'étape sortis dans la fenêtre |

Les ratios (taux de présence, de conversion, revenu par appel, part payée à la signature…) sont calculés par l'écran à partir de ces
comptes ; leurs définitions sont rappelées en tête de `016_crm_sales_cockpit.sql`.

### 12.20 SLA du cycle de vente (028)

Toutes les 5 minutes, `sla-tick` lit `crm_sla_snapshot(60)` : les cycles **en cours** dont le dernier événement (ou l'ouverture) date
de moins de 60 jours, avec `id`, `opened_at`, `person` (nom), `owner`, `owner_key`, leurs événements des 60 derniers jours (`type`,
`at`, `actor`, `channel`, `call_id`, `source` — jamais le texte d'un message) et leurs appels (`id`, `rank`, `status`, `start`,
`end`). Les règles elles-mêmes sont dans `supabase/functions/_shared/sla_rules.js` (même fichier que l'écran Cycle de vente).
`sla-tick` n'envoie que les dépassements « en retard » ou « critiques » franchis après `sla_alerts.since` et depuis moins de
`max_age_hours`, réclame leurs clés par `crm_sla_claim` (seules celles qui n'existaient pas reviennent) et poste exactement celles-là
dans Slack.

---

## 13. Réglages `crm_settings`

| Clé | Posée par | Valeur par défaut | Sens | Lue par |
|---|---|---|---|---|
| `alert_rule_defaults` | 003 | Tableau des règles c1 à c18 : `{id, name, severity, threshold, to}` (noms français ; seuils : c1 `after_minutes` 0, c2 `hours` 2, c3 `silence_hours` 48, c4 `hours` 2, c5/c6 étapes, c7 `hours` 48, c13 `silence_days` 30 / `attempts_below` 4, c14 `notice_hours` 24, c16 `after_hours` 2, c17 `iclosed_hours` 6 / `whatsapp_hours` 6 / `fathom_missed_calls` 2) | Définitions par défaut des alertes du CRM | `crm_merge_alert_defaults`, `web/api/_os.js` |
| `team_email_domains` | 003 | `["lesnouveauxprofs.fr"]` | Domaines internes (invités internes / externes) | Aucun code |
| `default_owner` | 003 | `"sales"` | Clé du membre propriétaire quand l'hôte iClosed est inconnu | `crm_owner_for` |
| `whop_plans` | 003 | `{}` | Produit → identifiant de plan Whop | Aucun code |
| `analysis_model` | 003 | `"claude-sonnet-5-5"` | Modèle d'analyse (ancien) | Aucun code (le moteur lit `crm_ca_config.tiers`) |
| `nurture_sending_enabled` | 003 | `false` | Envoi des messages de maturation (attend l'accord juridique) | Aucun code |
| `nurture_templates` | 003 | `[]` | Modèles de messages de maturation | Aucun code |
| `functions_url` | à la main (006) | — | Adresse de base des Edge Functions, par exemple `https://<ref>.supabase.co/functions/v1` | Tâches pg_cron |
| `fathom_match_minutes` | 025 | `90` | Fenêtre FL-2 (b) et FL-4 autour du début de l'enregistrement | `crm_fathom_person`, `crm_apply_recording_item`, `crm_call_has_ambiguous_recording` |
| `sla_alerts` | 028 | `{since: <moment de la migration>, channel: "#sales-cycle", max_age_hours: 6, window_tz: "America/New_York"}` | SLA vers Slack : rien d'antérieur à `since` ni de plus vieux que `max_age_hours` n'est posté ; fuseau des fenêtres | `crm_sla_settings` → `sla-tick` |
| `no_show_rule` | 030, 033 | `{enabled: false, min_minutes: 30 (7 avant 033), grace_hours: 3, since: null}` | Règle d'absence (§12.8) | `crm_no_show_setting` |
| `fathom_close_minutes` | 032 | `15` | Écart maximal pour `booking_closest` / `booking_declared` | `crm_fathom_person` |

`close_status_map` est cité par 007 comme futur réglage mais n'est jamais créé ni lu.

---

## 14. Tâches planifiées (pg_cron)

Toutes définies dans `006_crm_cron.sql` (supprimées puis recréées à chaque exécution). Les trois premières passent par `pg_net`
et ne partent que si `crm_settings.functions_url` existe ; elles appellent l'Edge Function sans jeton (les fonctions ont
`verify_jwt = false` ; `process-inbox` ne prend aucune entrée).

| Nom | Planning | Action | Condition / délai |
|---|---|---|---|
| `crm-process-inbox` | `* * * * *` (chaque minute) | `POST <functions_url>/process-inbox`, corps `{}` | seulement s'il existe une ligne `iclosed`, `whatsapp` ou `fathom` au statut `received` ou `failed` avec moins de 8 tentatives ; délai 30 s |
| `crm-fathom-hourly` | `23 * * * *` (minute 23) | `POST <functions_url>/crm-import?source=fathom&queue=1` | enregistrements des deux derniers jours, analyses R1/R2 mises en file ; un import déjà en cours fait sauter l'heure ; demande `FATHOM_API_KEY` ; délai 120 s |
| `crm-sla-tick` | `*/5 * * * *` (toutes les 5 min) | `POST <functions_url>/sla-tick` | délai 60 s |
| `crm-no-show-hourly` | `35 * * * *` (minute 35, après l'import Fathom) | `select public.crm_no_show_tick()` en SQL direct | ne fait rien tant que `no_show_rule.enabled` est faux |

L'ancienne tâche `crm-fathom-nightly` est supprimée par 006 si elle existe.

---

## 15. Tests SQL

### 15.1 Lancer

```bash
PGHOST=/tmp PGPORT=5432 PGUSER=postgres web/supabase/tests/run.sh
```

Il faut `psql` et un Postgres local dont l'utilisateur peut créer des bases et des rôles (aucun projet Supabase n'est touché). Le
script crée une base jetable `lnp_crm_test_<pid>`, la supprime à la sortie, et s'arrête à la première erreur (`ON_ERROR_STOP`,
message d'erreur affiché). Chaque suite affiche une dernière ligne « … SQL checks: all passed ».

Déroulé :
1. `tests/supabase_stub.sql` (rôles `anon`, `authenticated`, `service_role` ; schéma `auth`, `auth.users`, `auth.uid()` lu dans le
   réglage `request.jwt.claim.sub` que les tests changent ; privilèges par défaut sur les tables et séquences ; publication
   `supabase_realtime`), `001_init.sql`, puis une simulation de la phase 0 (`event_source`, `inbox_status`, `crm_webhook_log` créés
   avant 003), `003`, `004` deux fois, `005`, `004` encore → **`crm_phase1_test.sql`**.
2. Base neuve : stub, 001, 003, 004, 005 → **`crm_phase2_test.sql`**.
3. Base neuve : stub, 001, 003, 004, 005, puis **007 à 034, chacun deux fois** → les 18 autres suites.

`006_crm_cron.sql` n'est jamais appliqué par les tests (pas de `pg_cron` ni de `pg_net` en local).

### 15.2 Ce que vérifie chaque suite

| Suite | Vérifie |
|---|---|
| `crm_phase1_test.sql` | Qui voit quoi (un commercial ne voit que son cycle, son prospect, son appel ; responsables et administrateurs voient tout ; un compte sans rôle ne voit rien ; lecture anonyme refusée ; journal brut illisible ; insertion directe refusée ; aide interne non appelable) ; qui écrit (un membre ne se fait pas administrateur, e-mail inconnu refusé, issue sur le cycle d'un autre refusée, « non » sans motif refusé, motif de disqualification refusé pour un « non », configuration refusée à un commercial, fusion de deux cycles en cours refusée) ; règles c1–c18 ajoutées à `config/alerts`, rien au second passage, refus pour un membre. |
| `crm_phase2_test.sql` | `crm_apply_items` et projecteur : premier rendez-vous (personne et 3 identités, cycle à l'étape Présence, propriétaire d'après l'hôte, appel R1, événement) ; même livraison rejouée sans effet ; un report puis une mise à jour plus ancienne arrivée en retard qui n'écrase pas l'heure récente ; annulation puis nouveau rendez-vous de la même personne trouvée par téléphone (même cycle) ; annulation d'un appel inconnu et identifiants désignant deux personnes → deux éléments non rattachés ; issue « non » → perdu, nouveau rendez-vous sous 30 jours → même cycle rouvert ; après 30 jours → nouveau cycle, hôte inconnu → propriétaire par défaut ; un commercial lit ses cycles ; fonctions du worker non appelables par le navigateur ; file : une ligne en échec revient après son délai, 8 tentatives au plus. |
| `crm_import_test.sql` | 007 à 013 : essai à blanc sans écriture, création, pas de doublon au second passage ni d'une seconde source, conflit compté, run enregistré ; cycle disqualifié de 008 ; cycles et appels de 009 (ouvert au premier rendez-vous, une seule fermeture, un appel à venir garde le cycle en cours) ; vue « Sans rendez-vous » ; `first_seen_at` (un événement plus ancien le recule, pas un plus récent) ; 011 (écrans effacés, administrateur = administrateur du CRM, lecteur reste lecteur, tout le monde voit le CRM) ; messages 012 ; reclassement 013. |
| `mcp_test.sql` | Ligne d'audit par appel d'outil (`mcp:whoami/3/42`), 61e appel refusé, compte sans rôle refusé, tables OAuth fermées à `authenticated` et `anon`. |
| `owners_test.sql` | Sans membre, rien n'est attribué ; le commercial invité possède le cycle et héberge l'appel ; un propriétaire posé est gardé. |
| `cockpit_test.sql` | Structure (`periods.7.now`), rendez-vous compté, relance sous 24 h comptée, 8 points hebdomadaires, alertes et pipeline, fenêtre fermée au navigateur, `crm_mark_won_calls_held` (appel honoré, cycle toujours gagné). |
| `call_analysis_test.sql` | Fuseau du propriétaire, R3 et appel futur exclus ; un autre commercial ne peut pas ajouter de transcription ; carte sans prospect refusée ; travail en file et événement ; prise, échec et seconde tentative, stockage (résultats, durée, versions de règles, `analysis_ready`) ; lecture : un autre commercial ne voit rien (y compris au tableau), l'administrateur et le propriétaire voient ; relance ; audit et config réservés aux administrateurs ; fonctions du worker fermées. |
| `manual_cash_test.sql` | Montant signé, paiement manuel (zéro, futur, moyen inconnu refusés ; un autre commercial refusé), événement, le premier paiement gagne, audit, un paiement Whop ne se supprime pas, suppression → retour en cours, un administrateur peut saisir. |
| `contact_update_test.sql` | Nom et e-mail repris, téléphone non listé gardé, ancien et nouvel e-mail retrouvent la personne, aucun événement, conflit → non rattaché, contact inconnu → non rattaché. |
| `payment_plan_test.sql` | Droits, montant / devise / libellé « 2 échéances », échéances triées, « Payé en une fois » garde la devise, somme, date, au moins une échéance, pas de montant négatif, audit. |
| `fathom_calls_test.sql` | FL-1 à FL-6 : appel réservé rempli et honoré, carte des intervenants, R1 en file par webhook, issue demandée, R2 = deuxième enregistrement, réservation annulée ou non enregistrée avant R2 porte R2, un import ne met jamais en file, pas d'analyse sans enregistrement, cycle créé pour un prospect sans cycle, jamais de nouvelle personne, homonymes ambigus avec candidats, enregistrement connu, compteurs et annulation de l'essai à blanc. |
| `refunds_test.sql` | Payé = gagné ; droits ; dépassement refusé ; remboursement partiel garde gagné ; tout remboursé = perdu « refunded » daté au dernier remboursement ; un autre paiement encore payé garde gagné ; événements et audit ; payé de nouveau = gagné. |
| `yes_keeps_deal_test.sql` | Un « oui » sans montant garde la vente ; un « oui » avec montant la met à jour. |
| `sla_alerts_test.sql` | Instantané d'un cycle en cours sans texte de message, première réclamation puis jamais deux fois, réglages, fonction fermée au navigateur. |
| `call_ranks_test.sql` | Un nouveau numéro seulement après un appel avec enregistrement ou transcription. |
| `no_show_rule_test.sql` | Enregistrement de moins de 7 minutes sans numéro (le test force `min_minutes`), essai à blanc, appels avant `since` intacts, R1 sans enregistrement complet = absent, R1 complet reste honoré, R2 manqué ≠ absent, prochaine action après un R2 manqué, absences comptées en R1 seulement, second passage sans changement, enregistrement tardif l'emporte et l'événement de la règle disparaît, cycle gagné laissé tranquille. |
| `member_prefs_test.sql` | Chacun garde ses réglages ; un autre ne les voit pas. |
| `fathom_closest_test.sql` | Parmi des rendez-vous rapprochés, le plus proche l'emporte (`booking_closest`) ; une égalité reste ambiguë et ne crée pas de fausse absence ; comptes de prospects du cockpit (présent, absent, en attente). Sa dernière ligne affichée est « cockpit lead counts SQL checks: all passed ». |
| `noshow_audit_test.sql` | Une égalité va au prospect dont l'appel a été déclaré honoré (`booking_declared`) ; un prospect gagné compte comme présent. |
| `lnp_fr_labels_test.sql` | Une base aux libellés anglais reçoit les libellés français (étape, motifs, description de règle, nom d'alerte, prochaine action, échéancier, raison d'élément non rattaché) ; un libellé modifié à la main reste ; le canal Slack reste ; les fonctions sont recréées et appelables ; un second passage ne change rien. |
| `whatsapp_test.sql` | 052 : numéro WhatsApp normalisé (`+33 6 12 34 56 78`, `0033…`), invalide ou pris deux fois refusé, effacé ; message d'un numéro inconnu → nouveau prospect avec le nom de son profil ; statut seul puis écho de l'application → un seul événement, acteur `sales`, membre rattaché, contenu et statut à jour ; envoyé par l'API seulement → reste `auto` ; STOP retenu ; ligne brute traitée. |

Autres tests qui touchent la base : `deno test --allow-env --allow-read supabase/tests` (fonctions, dont `pipeline.test.ts` et
`fathom.test.ts` qui appellent `crm_apply_items`, `crm_apply_contact`, `crm_apply_recordings`), `node app/crm/data.test.js`
(couche de données du navigateur), `cd web && npm test` (connecteur Claude, avec `web/tests/fake_supabase.js`).

---

## 16. Écarts avec `docs/crm/` et points d'attention

Le code fait foi. Écarts relevés avec la spécification `docs/crm/` :

- **`002_q4_okrs.sql`** est encore cité par `docs/crm/01-architecture.md` et par l'en-tête de `003_crm_core.sql`, mais le fichier
  n'existe plus ; rien dans 003 à 034 n'en dépend.
- **Le projecteur est en SQL** (`crm_recompute_cycle`), pas dans `_shared/projector.ts` comme l'annonce `docs/crm/01-architecture.md`.
  Les Edge Functions `rules-tick`, `nurture-tick`, `reconcile`, `sendblue-send` (Sendblue abandonné le 9 novembre 2026), `whop-checkout`, `claude-analyze` décrites là
  n'existent pas dans `supabase/functions/` (présentes : `iclosed-in`, `fathom-in`, `whatsapp-in`, `whop-in`, `process-inbox`,
  `crm-import`, `sla-tick`, `callqa-llm`).
- En conséquence, **`crm_alerts`, `crm_outbound_messages`, `crm_reconciliation_runs` et `crm_agent_runs` ne reçoivent aucune
  ligne** ; les règles `crm_rules` autres que `next_move.reopen_days` et `snooze_days` ne sont lues par aucun code ; aucun
  `cycle_lost` de source `rules` n'est écrit (la règle 5 du projecteur attend un moteur de règles absent).
- **Types d'événements** : le code écrit `payment_refunded` (la spécification dit `refund`), et aussi `call_missed`,
  `transcript_added`, `imported`, absents de la liste de `docs/crm/02-data-model.md` ; `analysis_ready` a l'acteur `system` et la
  source `crm` (spécification : `auto` / `claude`). `message_status`, `payment_failed`, `checkout_created`, `auto_close_notice`,
  `nurture_message`, `nurture_archived`… ne sont écrits par aucune fonction SQL.
- **Analyse d'appel** : le moteur écrit `crm_ca_*` (020) ; la table `crm_call_analyses` de 003 n'est plus écrite, seule la fiche
  prospect du CRM la lit encore.

Points d'attention pour une réplique :

- **Temps réel du CRM** : `app/crm/data.js` s'abonne à `crm_cycles`, `crm_events`, `crm_alerts`, mais seule `docs` est ajoutée à
  `supabase_realtime` par les migrations. Impossible de savoir d'ici si la base en ligne a été complétée à la main.
- **Retirer un membre** : `crm_members.id` référence `members(user_id)` `on delete restrict`, alors que `members` est supprimé en
  cascade avec `auth.users`. Depuis 011 tout membre a une ligne `crm_members` : la suppression d'un compte par `/api/team`
  (`auth.admin.deleteUser`) devrait donc être refusée par cette contrainte tant que la ligne `crm_members` existe (non testé ici).
- **Changement de rôle** : modifier `members.role` ne change pas `crm_members.role` (§6.1).
- **Privilèges par défaut des fonctions** : sur Supabase, les privilèges par défaut du schéma `public` accordent en général
  `EXECUTE` sur chaque nouvelle fonction à `anon`, `authenticated` et `service_role` (le stub de test ne le reproduit pas). Les
  fonctions sans `revoke` explicite (`my_role`, `crm_norm_name`, `crm_no_show_setting`, `crm_call_complete`,
  `crm_call_has_ambiguous_recording`, `crm_call_is_reschedule`, les fonctions de déclencheur) restent donc appelables ; elles ne font
  que lire. À l'inverse, `crm_ca_claim`, `crm_ca_store`, `crm_ca_fail` n'ont pas de `grant` explicite au rôle de service et en
  dépendent. À vérifier sur le projet cible.
- **RPC exposées mais inutilisées par les écrans** : `crm_cancel_auto_close`, `crm_set_nurture`, `crm_resolve_unmatched`,
  `crm_dismiss_unmatched`, `crm_merge_people`, `crm_update_config`, `crm_create_checkout`, `crm_set_deal` (dans `data.js`, aucun
  appelant), `crm_ca_latest`, `crm_recompute_all`, `crm_admin_set_member`, `crm_merge_alert_defaults` (aucun appelant).
- **Valeurs d'énumération jamais écrites** : `cycle_origin.reopened`, `call_status.outcome_pending`, `nurture_status.archived` /
  `opted_out`, la plupart d'`outbound_status`.
- **`crm_settings.team_email_domains`** contient encore une valeur d'avant LNP et n'est lue par aucun code.
- **Réglages à poser à la main** : `functions_url` (sans lui, ni la file, ni Fathom, ni les SLA ne tournent) ; `no_show_rule.since`
  et `enabled` (la règle d'absence est éteinte par défaut).

### Ce qui n'a pas pu être déterminé depuis le dépôt

- L'état réel de la base en ligne (publication temps réel, privilèges par défaut, tâches pg_cron effectivement planifiées, valeurs
  actuelles de `crm_settings`, lignes de `crm_sales_team`).
- Le format exact des éléments produits par les mappers TypeScript (`supabase/functions/_shared/mappers/`) au-delà de ce que les
  fonctions SQL lisent : voir le chapitre des intégrations.
