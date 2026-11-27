# 03 — Base de données (Supabase / Postgres)

Ce chapitre décrit tout le back end Postgres de LNP tel que le définissent les 62 fichiers `web/supabase/001_init.sql` et
`web/supabase/003_crm_core.sql` à `web/supabase/063_crm_ca_corrections.sql` (il n'y a plus de `002`), état de la branche `main`
au 27 novembre 2026. Il suffit pour recréer la base et la comprendre sans lire le SQL d'abord ; chaque fait renvoie au fichier qui
le pose. Quand une migration redéfinit une fonction écrite plus tôt, la colonne « définition finale » donne le fichier dont le
texte fait foi (le numéro seul, par exemple « 055 », désigne `web/supabase/055_*.sql`).

Ce que les fichiers créent, au total : 53 tables (toutes avec RLS), 1 vue, 11 déclencheurs, 129 fonctions nommées, 11 tâches
planifiées, 17 clés de `crm_settings`, 2 tables dans la publication temps réel. C'est ce que montre le relevé de production
(`08-configuration-actuelle.md`), sauf le nombre de fonctions (176 en production : voir §16).

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
  `crm_events` (004). Exceptions : `docs` (écrit directement), `crm_member_prefs` (lignes de la personne, via RPC ou en direct),
  `crm_academy_progress` (sa ligne, insertion et mise à jour, 049) et `crm_training_results` (insertion de ses résultats, 049).
  Les tables du Simulateur (`crm_sim_*`, 057) ne sont écrites que par la fonction Edge `simulateur` avec la clé de service.
- **Tables en ajout seulement** : `crm_training_results` (déclencheurs qui refusent toute modification, effacement ou
  `truncate`, 049) et `crm_ca_corrections` (aucun droit d'écriture pour le navigateur, écriture par `crm_ca_correct`, 063).
- **Heure de référence : Europe/Paris** pour tout ce qui se compte en jours ou en plages horaires (échéances du setter 054 et 059,
  échéanciers et encaissé 041, journée des alertes 053, qualification 042/046, plage 8 h – 22 h de l'Exécution 050/060,
  `crm_settings.sla_alerts.window_tz` 028/051).
- **Le CRM est la seule source de vérité des statuts** (059) : d'iClosed, la base ne garde que le lead, la date des rendez-vous
  (déplacements, annulations) et le montant d'une vente, pour information.
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

Appliquer dans l'ordre des numéros. Toutes sont ré-exécutables (« Safe to run again », « Peut être rejoué ») **sauf
`003_crm_core.sql`**, qui fait des `create type` et `create table` sans `if not exists` (seuls `event_source`, `inbox_status` et
`crm_webhook_log`, créés en phase 0 par un ancien `003a`, sont protégés). Les tests (§15) appliquent 004 et 007 à 063 deux fois de
suite. Rejouer un fichier remet toutefois ce qu'il pose : 039 et 040 repassent leurs anciens commerciaux à `active = false`, 056
réécrit `no_show_rule` (`since`, `min_minutes`, `grace_hours`, `enabled = true`) et relance `crm_close_before`, 041 relance
`crm_apply_auto_plans()`. **Ne jamais rejouer 034 seule sur une base à jour** : elle recrée des versions antérieures de
`crm_require` (004, sans le setter), `crm_sales_cockpit` (019), `crm_recompute_cycle` (030) et `crm_apply_messages` (sa propre
version) ; il faut ensuite rejouer 052, 054, 055 et 060, qui portent leurs définitions finales (`tests/run.sh`, qui rejoue 034 dans
`lnp_fr_labels_test`, rejoue de même 036, 039, 040, 041 et 045 avant d'appliquer 059 à 063).

Toutes les migrations sont appliquées en production (relevé du 27 novembre 2026, `08-configuration-actuelle.md`), avec deux écarts
dans l'historique des migrations de Supabase (`supabase_migrations.schema_migrations`), sans effet sur le schéma :
- **`056_crm_regle_absence` a été appliquée sans entrée dans l'historique** (ses fonctions `crm_apply_no_show_rule` et
  `crm_close_before` existent bien en base) ;
- **`061` est tracée sous le nom `crm_simulateur_realisme_061`** (le fichier s'appelle `061_crm_simulateur_realisme.sql`).
L'historique compte donc 61 entrées pour 62 fichiers. Une réplique qui applique les fichiers dans l'ordre obtient le même schéma ;
il faut seulement le savoir avant de comparer les deux historiques.

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
| `028_crm_sla_alerts.sql` | Table `crm_sla_notices` (copie Slack déjà postée) ; réglage `sla_alerts` ; `crm_sla_snapshot`, `crm_sla_claim`, `crm_sla_settings`. |
| `029_crm_call_ranks.sql` | `crm_rank_calls` pour tous les cycles (un nouveau numéro seulement après un appel analysable) ; déclencheur `crm_calls_rank` aussi sur `transcript_raw` ; renumérotation. |
| `030_crm_no_show_rule.sql` | Valeur `missed` de `call_status` ; réglage `no_show_rule` ; `crm_no_show_setting`, `crm_call_complete`, `crm_rank_calls` (définition finale), `crm_apply_no_show_rule`, `crm_no_show_tick`, déclencheur `crm_calls_recorded` ; projecteur (définition finale). |
| `031_crm_member_prefs.sql` | Table `crm_member_prefs` ; `crm_get_pref`, `crm_set_pref`. |
| `032_crm_fathom_closest.sql` | Réglage `fathom_close_minutes` ; règle `booking_closest` ; `crm_call_has_ambiguous_recording` ; `crm_apply_no_show_rule` (définition finale) ; remise en « issue à déclarer » des fausses absences ; `no_show_rule.min_minutes` passe à 30 ; `crm_call_is_reschedule` ; fenêtre du cockpit comptée en prospects. |
| `033_crm_noshow_audit.sql` | Règle `booking_declared` ; `crm_fathom_person` (définition finale) ; `crm_sales_cockpit_window` (définition finale : un cycle gagné compte comme présent). |
| `034_lnp_fr_labels.sql` | Passe en français les libellés déjà chargés d'une base construite en anglais (sans toucher un libellé modifié à la main) et recrée, à l'identique des fichiers 004 à 031, chaque fonction qui renvoie ou lève du texte. |
| `035_crm_ca_engine_choice.sql` | Colonne `crm_ca_config.engine` (`full` par défaut ou `lite`, contrainte `crm_ca_config_engine_check`) ; `crm_ca_claim` (définition finale : `config.engine` transmis au worker) ; `crm_ca_store` (définition finale : `meta.engine`, `meta.engine_version`, `meta.engine_steps` du moteur allégé gardés dans `crm_ca_records.meta`). |
| `036_crm_cockpit_active_team.sql` | `crm_sales_cockpit` : seuls les commerciaux actifs dans la période ont une ligne, un commercial à plusieurs adresses est une seule ligne (groupé par nom) ; `crm_sales_cockpit_window` : « RDV pris » = prospects de la période qui ont réservé. |
| `037_crm_iclosed_deals.sql` | Colonnes `crm_deals.iclosed_deal_ids`, `crm_payments.iclosed_deal_id` (index unique `crm_payments_iclosed_deal_id_key`) ; contrainte `crm_payments_source` élargie à `iclosed` ; première version de `crm_import_deals` (ventes iClosed → vente, paiements, `payment_succeeded`) ; tâche `crm-iclosed-deals-hourly`. |
| `038_crm_cockpit_held_r1.sql` | `crm_sales_cockpit_window` : « appels honorés » = R1 seulement ; taux de présence sur les R1 dus. |
| `039_crm_cockpit_audit.sql` | Colonne `crm_sales_team.active` (9 anciens commerciaux passés à `false`) ; réglages `internal_domains`, `show_pending_hours` ; `crm_person_internal`, `crm_show_pending_hours` ; cockpit : honorés = prospects présents à leur R1, R1 sans issue « en attente » 48 h, fiches de test exclues, anciens commerciaux sans ligne ; tâches `crm-iclosed-contacts-hourly`, `crm-iclosed-calls-hourly`. |
| `040_crm_cockpit_rep_by_fathom.sql` | Un ancien commercial de plus à `active = false` ; `crm_sales_cockpit` : le commercial d'un cycle est son propriétaire, sinon l'enregistreur Fathom de son dernier appel enregistré jusqu'à la clôture, sinon l'hôte iClosed. |
| `041_crm_cockpit_collected.sql` | Colonnes `crm_deals.plan_source`, `plan_match` ; réglage `offer_catalogue` ; `crm_plan_for_amount`, `crm_auto_schedule`, `crm_apply_auto_plans`, `crm_deal_collected` ; déclencheur `crm_deals_plan_source` ; `crm_import_deals` (version 2) ; `crm_sales_cockpit_window` (définition finale : `collected`, `remaining`, encaissé des échéances) ; `select crm_apply_auto_plans()` à l'application. |
| `042_crm_lead_qualification.sql` | Table `crm_lead_qualifications` (RLS sans politique : rôle de service) ; `crm_qualif_config` (définition finale), `crm_qualif_candidates`, `crm_qualif_store` (premières versions). |
| `043_crm_owners_hourly.sql` | Tâche `crm-assign-owners-hourly` (`crm_assign_owners_from_hosts(false)` à la minute 20). |
| `044_crm_sla_settings.sql` | Réglage `sla_rules` ; `crm_sla_settings` (définition finale : `sla_alerts` + `sla_rules`) ; `crm_save_sla_rules` (Paramètres › Alertes). |
| `045_crm_pipeline_moves.sql` | Valeur `manual` d'`event_source` ; `crm_close_cycle`, `crm_reopen_cycle` ; `crm_recompute_cycle` (fermetures à la main, source `manual`). |
| `046_crm_qualif_in_analysis.sql` | Colonne `crm_lead_qualifications.job_id` (FK `crm_ca_jobs`, index `lead_qualifications_job`) ; `crm_qualif_context` ; `crm_qualif_store` (définition finale, 9 arguments ; l'ancienne signature est supprimée) ; `crm_qualif_candidates` (définition finale, version de consigne `lnp-sql-v2.1-2026-11-05`) ; `crm_ca_record` et `crm_ca_board` + qualification. |
| `047_crm_pipeline_stage_moves.sql` | `crm_stage_data_types`, `crm_move_cycle` (événement `stage_moved`). |
| `048_crm_admin_only_sees_all.sql` | `crm_sees_all()` (définition finale) : seul un administrateur voit tous les prospects. |
| `049_crm_training.sql` | Tables `crm_academy_progress`, `crm_academy_corrections`, `crm_training_results` ; déclencheurs `crm_training_results_stamp`, `crm_training_results_keep`, `crm_training_results_keep_all` ; `crm_training_person`, `crm_training_dashboard`. |
| `050_crm_sales_execution.sql` | `crm_sales_exec_window`, `crm_sales_execution` (onglets Exécution, Qualité, Impact du Cockpit commercial ; premières versions). |
| `051_lnp_heure_de_paris.sql` | `sla_alerts.window_tz` = `Europe/Paris` sur une base existante (sans effet sur une base neuve : 028 pose déjà ce fuseau). |
| `052_crm_whatsapp.sql` | WhatsApp Business, seul canal de messages : valeur `whatsapp` d'`event_source` ; `crm_members.sendblue_number` renommée `whatsapp_number` (index `team_members_whatsapp_uq`) ; `crm_outbound_messages.sendblue_message_handle` renommée `whatsapp_message_id` ; `crm_admin_set_member` recréée avec `p_whatsapp_number` (définition finale) ; `crm_set_member_whatsapp` ; `crm_apply_message_item`, `crm_apply_messages`, `crm_import_messages` (définitions finales : la source vient de chaque élément, membre de l'équipe rattaché) ; tâche `crm-process-inbox` replanifiée sur `iclosed`, `whatsapp`, `fathom`. Appliquée en production (les secrets WhatsApp, eux, ne sont pas encore posés : chapitre 08). |
| `053_crm_alertes.sql` | Table `crm_sla_alerts` (index `crm_sla_alerts_open`, `_owner`, `_cycle`, politique `read_sla_alerts`), ajoutée à la publication `supabase_realtime` ; `crm_sync_sla_alerts` (première version), `crm_sla_alerts_open`. |
| `054_crm_setting.sql` | Valeurs `setter` de `member_role` et `funnel` d'`event_source` ; colonnes `crm_people.setter_id`, `lead_source`, `quiz`, `setting_*` (index `crm_people_setting`, `crm_people_setter`) ; réglage `setting` ; `crm_sets_person` ; `crm_owns_cycle`, `crm_sees_person`, `crm_require` (définitions finales, setter compris) ; politique `read_cycles` recréée ; vue `crm_people_without_cycle` (définition finale) ; `crm_setting_open_at`, `crm_setting_end_of_day`, `crm_setting_move`, `crm_setter_action`, `crm_set_setter`, `crm_pick_setter`, `crm_apply_leads`, `crm_create_lead`, `crm_setting_snapshot`, `crm_sync_sla_alerts` (définition finale), `crm_set_member_role` ; `crm_setting_due`, `crm_lead_item`, `crm_setting_on_call`, `crm_sla_snapshot` (redéfinies par 059) ; déclencheur `crm_setting_on_call` ; `crm_sla_alerts.cycle_id` devient facultatif ; tâche `crm-process-inbox` replanifiée avec `funnel` (définition finale). |
| `055_crm_refus_six_mois.sql` | Motif `refus_6_mois` ; `crm_recompute_cycle` (définition finale) ; `crm_refusal_tick` ; tâche `crm-refusal-daily`. |
| `056_crm_regle_absence.sql` | `no_show_rule` = `{since: "2026-10-27T00:00:00+01:00", min_minutes: 30, grace_hours: 3, enabled: true}` ; `crm_apply_no_show_rule` (définition finale : seulement un appel sans enregistrement ni présence donnée) ; `crm_close_before`, lancée une fois (`'2026-10-27T00:00:00+01:00'`, `false`). **Absente de l'historique des migrations en production.** |
| `057_crm_simulateur.sql` | Tables `crm_sim_offers`, `crm_sim_personas`, `crm_sim_simulations`, `crm_sim_messages`, `crm_sim_feedback`, `crm_sim_analyses`, `crm_sim_config` (ligne `id = 1`), RLS et droits ; `crm_sim_history` (première version) ; tâche `crm-simulateur-balayer`. |
| `058_crm_simulateur_offre_lnp.sql` | Données seulement : l'offre « Accompagnement Les Nouveaux Profs » dans `crm_sim_offers` (id `b1a7c0de-0000-4000-8000-000000000057`, empreinte `lnp:accompagnement-les-nouveaux-profs`, statut `ready`), sans prospect. |
| `059_crm_source_de_verite.sql` | `crm_import_calls`, `crm_import_deals` (définitions finales : iClosed ne donne que les dates et un montant pour information) ; `crm_sla_snapshot`, `crm_setting_due`, `crm_lead_item`, `crm_setting_on_call` (définitions finales, règles du webinaire) ; `crm_setting_tick` ; tâche `crm-setting-tick`. |
| `060_crm_cockpit_corrections.sql` | `crm_sales_exec_window`, `crm_sales_execution` (définitions finales : premier appel tenu du cycle, sources branchées) ; `crm_sales_cockpit` (définition finale, même calcul que 040). |
| `061_crm_simulateur_realisme.sql` | `crm_sim_history` (définition finale : `version_referentiel`, `realisme`, `variante`). **Tracée en production sous le nom `crm_simulateur_realisme_061`.** |
| `062_crm_ca_board_rounds.sql` | `crm_ca_board` (définition finale : numérote les appels comme `crm_ca_call_info`). |
| `063_crm_ca_corrections.sql` | Table `crm_ca_corrections` (ajout seulement, politique `crm_ca_corrections_read`) ; `crm_ca_correct` ; `crm_ca_record` (définition finale : `corrections`, `can_correct`). |

**À propos de 034.** Ses redéfinitions sont des copies exactes de la dernière définition de chaque fonction (vérifié en comparant
les textes : identiques pour les 30 fonctions qu'il recrée). Sur une base neuve, 034 ne change donc que les données de la partie 1,
qui ne trouvent rien à traduire puisque 003 à 033 ensemencent déjà en français.

**Rattrapages exécutés à l'application.** Certaines migrations agissent sur les données au moment où on les applique :
011 (`select crm_member_from_team(user_id) from members`), 015 (`select crm_assign_owners_from_hosts(false)`),
018 (`select crm_mark_won_calls_held(false)`), 026 (recalcul des cycles gagnés ayant un remboursement), 029 (renumérotation de
tous les cycles et recalcul des cycles en cours), 030 et 033 (renumérotation des cycles ayant un enregistrement), 032 (remise des
fausses absences en `scheduled`), 039 et 040 (`update crm_sales_team set active = false` sur des clés d'anciens commerciaux),
041 (`select crm_apply_auto_plans()`), 056 (`no_show_rule` réécrit, puis `select crm_close_before('2026-10-27T00:00:00+01:00',
false)`), 058 (insertion de l'offre du Simulateur). Sur une base vide ils ne font rien, sauf 056 (la règle d'absence est allumée,
§13) et 058 (l'offre est créée).

**Ce que la production a de plus que les fichiers.** Les données écrites par des versions de fonctions remplacées depuis ne
disparaissent pas : par exemple les paiements `source = 'iclosed'` et leurs `payment_succeeded` (`deal:<id>`) écrits par
`crm_import_deals` en 037 / 041, que 059 n'écrit plus (« l'historique déjà importé reste tel quel »). Une réplique partie d'une base
vide ne les aura pas.

---

## 3. Recréer la base pas à pas

1. Créer un projet Supabase (il fournit le schéma `auth`, `auth.uid()`, les rôles `anon`, `authenticated`, `service_role` et la
   publication `supabase_realtime` ; voir §4).
2. Exécuter, en tant que propriétaire (`postgres`, éditeur SQL ou `psql`), `001_init.sql`, puis `003_crm_core.sql` à
   `063_crm_ca_corrections.sql` dans l'ordre, chacun une fois. Les blocs `cron.schedule` ne s'exécutent que si `pg_cron` est là
   (006 l'installe ; certains fichiers testent `pg_extension`, d'autres le schéma `cron`) : les 11 tâches du §14 sont alors
   planifiées. Pour retrouver l'historique de production à l'identique, enregistrer 061 sous le nom `crm_simulateur_realisme_061`
   et ne pas enregistrer 056 (§2) ; ce n'est pas nécessaire au fonctionnement.
3. Déclarer l'adresse des Edge Functions (réglage non secret, absent des migrations ; sans lui, aucune tâche planifiée qui passe
   par HTTP ne part : `crm-process-inbox`, `crm-sla-tick`, `crm-fathom-hourly`, les trois imports iClosed, `crm-simulateur-balayer`) :
   ```sql
   insert into crm_settings (key, value, is_proposal) values ('functions_url', '"https://<ref>.supabase.co/functions/v1"', false);
   ```
4. L'équipe : inviter chaque personne par Paramètres › Accès (`/api/team`, qui écrit `members`) ; le déclencheur `members_to_crm`
   lui crée une ligne `crm_members` (administrateur → `admin`, membre → `sales_lead`, lecteur → `viewer`). La fonction de chacun
   (commercial `sales` ou setter `setter`) et son numéro WhatsApp Business se posent dans Paramètres › Compte › Accès de l'équipe
   (`/api/team` → `crm_set_member_role`, `crm_set_member_whatsapp`) ; le responsable, l'e-mail iClosed et l'e-mail Fathom avec
   `crm_admin_set_member(...)` (§9.2). Ajouter les commerciaux du Cockpit commercial (et enregistreurs Fathom reconnus, FL-1) dans
   `crm_sales_team` (`insert into crm_sales_team (rep, name) values ('<clé>', '<Prénom>')` ; `active = false` pour un ancien
   commercial). La production en a 22 lignes.
5. Règles d'alerte du CRM : `select crm_merge_alert_defaults();` (ajoute c1 à c18 dans `docs` `config/alerts` sans toucher
   l'existant ; ancien catalogue). Le catalogue actuel des SLA (SH, DE, CA, CO, CL, DO, SE) est dans
   `supabase/functions/_shared/sla_rules.js` ; ses réglages vivent dans `crm_settings.sla_rules` (posé par 044, sources toutes
   débranchées) : marquer une source branchée dans Paramètres › Alertes quand elle l'est (`messages` une fois WhatsApp branché).
6. Analyse d'appel : la production tourne avec le moteur allégé et d'autres niveaux de modèle que la valeur des fichiers (§7.11) :
   ```sql
   update crm_ca_config set engine = 'lite',
     tiers = '{"fast": "claude-haiku-5-5", "strong": "claude-haiku-5-5", "arbiter": "claude-sonnet-5-5"}';
   ```
7. Valeurs propres à LNP à vérifier ou recopier depuis la production : `internal_domains` et `offer_catalogue` (039, 041 :
   les fichiers posent les valeurs de LNP du 4 novembre 2026), `setting.default_setter` (054 : `null`), `sla_rules`.
8. Imports d'historique éventuels par l'Edge Function `crm-import` (chapitre des intégrations ; les tâches horaires de §14 font
   ensuite le reste). Les anciens rattrapages manuels (essai à blanc `true` d'abord) : `crm_import_iclosed_disqualified` et
   `crm_reclassify_imported` lisent les statuts iClosed, que le CRM ignore depuis 059 : ne pas les lancer sur une nouvelle base
   (§16) ; `crm_mark_won_calls_held` (appels passés des cycles gagnés marqués honorés) ne sert qu'à un historique importé.
9. Règle d'absence : **056 l'allume** avec la date de départ de LNP (`since` = 27 octobre 2026). Pour une autre date de départ :
   ```sql
   update crm_settings set value = value || jsonb_build_object('since', '<date ISO>', 'enabled', true) where key = 'no_show_rule';
   ```
10. Temps réel : 001 publie `docs`, 053 publie `crm_sla_alerts` (bandeau et pastille des alertes, `app/crm/data.js` `onAlerts`).
    Le CRM s'abonne aussi à `crm_cycles`, `crm_events` et `crm_alerts` (`app/crm/data.js`, `subscribe`), qu'aucune migration ne
    publie ; la production ne les publie pas non plus (relevé du 27 novembre 2026) : ne rien ajouter pour une réplique à
    l'identique.

La base en ligne ne change qu'après accord de Romain sur la PR (`CLAUDE.md`).

---

## 4. Extensions et prérequis Supabase

| Extension | Fichier | Usage |
|---|---|---|
| `pgcrypto` | 003 | `gen_random_uuid()` (clés primaires `uuid`). |
| `citext` | 003 | E-mails insensibles à la casse (`crm_members.email`, `iclosed_email`, `fathom_email`, `crm_people.primary_email`, `crm_calls.recorded_by`, `crm_fathom_recordings.recorder`). |
| `pg_net` | 006 | `net.http_post` depuis les tâches planifiées. |
| `pg_cron` | 006 | `cron.schedule` / `cron.unschedule` (tâches de 006, 037, 039, 043, 052, 054, 055, 057, 059). |

La production a aussi `pg_stat_statements`, `plpgsql`, `supabase_vault` et `uuid-ossp`, posées par Supabase et qu'aucune migration
ne demande.

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
| `member_role` | `admin`, `sales_lead`, `sales`, `viewer`, `setter` | Rôle dans le CRM (`crm_members.role`). `setter` ajouté par 054 (`add value if not exists`) : la personne qui appelle les leads avant le RDV. |
| `identity_kind` | `email`, `phone`, `iclosed_contact_id`, `whop_user_id`, `whop_member_id`, `close_contact_id` | `close_contact_id` ajouté par 007. |
| `cycle_status` | `active`, `won`, `lost`, `disqualified` | En cours / gagné / perdu / disqualifié. |
| `cycle_origin` | `new`, `nurture`, `reopened` | `reopened` n'est jamais écrit par le code (une réouverture remet le même cycle à `active`). |
| `call_status` | `scheduled`, `canceled`, `held`, `no_show`, `outcome_pending`, `missed` | `missed` ajouté par 030. `outcome_pending` n'est écrit par aucune fonction SQL (lu par 005, 025 et `supabase/functions/_shared/sla_view.ts`). |
| `attendance` | `held`, `no_show` | Présence déclarée. |
| `decision` | `yes`, `no`, `follow_up`, `disqualified` | Décision déclarée. |
| `nurture_choice` | `none`, `standard`, `light` | Intensité de maturation. |
| `nurture_status` | `active`, `reactivated`, `archived`, `opted_out`, `removed` | `archived` et `opted_out` ne sont écrits par aucune fonction. |
| `actor_kind` | `sales`, `prospect`, `auto`, `system` | Qui a produit l'événement. |
| `event_source` | `iclosed`, `fathom`, `sendblue`, `whop`, `crm`, `claude`, `rules`, `import`, `whatsapp`, `manual`, `funnel` | Créé avec garde `duplicate_object` (aussi en phase 0) ; `whatsapp` est dans la liste de 003 et ajouté par 052 à une base existante (`add value if not exists`) ; `manual` (045 : déplacements et fermetures à la main depuis le Pipeline) ; `funnel` (054 : leads des funnels et saisis à la main). `sendblue` reste dans l'énumération mais n'est plus écrit (Sendblue abandonné, aucune ligne). |
| `reason_kind` | `lost`, `disqualified` | Nature d'un motif. |
| `alert_severity` | `low`, `medium`, `high`, `critical` | Même échelle que Paramètres › Alertes. |
| `inbox_status` | `received`, `processed`, `ignored`, `failed`, `unmatched`, `rejected` | Créé avec garde `duplicate_object`. |
| `analysis_status` | `queued`, `done`, `insufficient`, `failed` | Pour l'ancienne table `crm_call_analyses`. |
| `outbound_status` | `pending_approval`, `queued`, `sent`, `delivered`, `failed`, `blocked`, `rejected` | Messages envoyés par le CRM. |

Les statuts des tables ajoutées plus tard sont des `text` avec `check` : `crm_import_runs.status`, `crm_ca_jobs.status`,
`crm_ca_results.competence`, `crm_fathom_recordings.status` / `rule`, `crm_sla_notices.level`, `crm_payments.source`,
`crm_rules.kind`, `crm_agent_runs.status`, `members.role`, `crm_ca_config.engine` (035), `crm_sla_alerts.level` (053),
`crm_training_results.module` / `mode` (049), `crm_sim_offers.status`, `crm_sim_personas.difficulty` / `pcm_type`,
`crm_sim_simulations.status` / `difficulty` / `simulation_mode`, `crm_sim_messages.role`, `crm_sim_analyses.status`,
`crm_sim_config.claude_model` (057). Sans `check` : `crm_people.setting_status` et `lead_source` (054, valeurs au §12.24),
`crm_sla_alerts.kind` (`sales` ou `tech`), `crm_lead_qualifications.status` (verdicts de la qualification, §12.30),
`crm_deals.plan_source` (`auto` ou `manual`) et `plan_match` (`total`, `instalment`, `to_check`).

---

## 6. Rôles, droits et sécurité au niveau des lignes

### 6.1 Deux rôles par personne

| Où | Valeurs | Sert à |
|---|---|---|
| `members.role` (001) | `admin`, `member`, `viewer` | Rôle d'application : écrire `docs`, gérer l'équipe (`/api/team`, administrateurs), accès par écran (`app_metadata.screens`, `web/api/_screens.js`). Lu par `my_role()`. |
| `crm_members.role` (003, 054) | `admin`, `sales_lead`, `sales`, `viewer`, `setter` | Rôle dans le CRM : quelles lignes on lit, quelles RPC on peut appeler. Lu par `crm_role()` (seulement si `active`). |

Correspondance automatique (011, `crm_member_from_team`) à l'arrivée d'un membre : `admin` → `admin`, `viewer` → `viewer`,
toute autre valeur (`member`) → `sales_lead`. Une ligne `crm_members` déjà présente n'est jamais modifiée par ce mécanisme ; les
rôles `sales` (commercial) et `setter` se posent ensuite par `crm_set_member_role` (054, rôle de service, appelée par
`web/api/team.js` : seulement entre `sales`, `setter` et `viewer`, jamais pour un administrateur) ou à la main. Un changement de
`members.role` après coup **ne se répercute pas** sur `crm_members.role` (le déclencheur ne réagit qu'à l'insertion).

Depuis 048, **seul `admin` voit tous les prospects** ; `sales_lead`, `sales` et `viewer` ne voient que les cycles dont ils sont
propriétaires (un `viewer` n'en possède aucun) ; depuis 054, un `setter` voit les personnes dont il est le setter
(`crm_people.setter_id`) et leurs cycles.

### 6.2 Fonctions d'aide à la sécurité

Toutes `language sql stable security definer set search_path = public`.

| Fonction | Renvoie | Définition |
|---|---|---|
| `my_role()` (001) | `text` | `members.role` de `auth.uid()`, `null` si la personne n'est pas membre. |
| `crm_role()` (003) | `member_role` | `crm_members.role` de `auth.uid()` si `active`, sinon `null`. |
| `crm_sees_all()` (003, définition finale 048) | `boolean` | `coalesce(crm_role() = 'admin', false)`. Depuis 048 (Romain, 5 novembre 2026), seul un administrateur voit tous les prospects ; commercial, responsable commercial et lecteur ne voient que les cycles dont ils sont propriétaires (avant : tout rôle sauf `sales`). |
| `crm_sets_person(p uuid)` (054) | `boolean` | La personne `p` a `setter_id = auth.uid()`. |
| `crm_owns_cycle(c uuid)` (003, 054) | `boolean` | Le cycle `c` a `owner_id = auth.uid()`, **ou** (054) sa personne a l'appelant pour setter (`crm_sets_person`). |
| `crm_sees_person(p uuid)` (003, 054) | `boolean` | `crm_sees_all()`, ou l'appelant est le setter de `p` (054), ou la personne a un cycle dont l'appelant est propriétaire. |
| `crm_ca_can_read(p_call uuid)` (020) | `boolean` | `crm_role() = 'admin'` ou l'appelant est le **propriétaire** (`owner_id`) du cycle de l'appel. N'utilise pas `crm_owns_cycle` : un setter ne lit pas l'analyse d'appel des leads qu'il suit (alors qu'il peut y ajouter une transcription, §9.7). |
| `crm_person_internal(p_person uuid)` (039) | `boolean` | La personne a un e-mail d'un domaine de `crm_settings.internal_domains` (fiche de test de l'équipe, exclue des chiffres). Retirée à `public` et `anon`. |

`crm_require(p_roles member_role[], p_cycle uuid default null) → crm_members` (004, définition finale 054,
`plpgsql stable security definer`) est le contrôle d'accès de presque toutes les écritures : erreur `42501` « Vous n'êtes pas
membre du CRM » si l'appelant n'a pas de ligne active ; passe si son rôle est dans `p_roles` ; passe aussi pour un `sales` si
`p_cycle` est donné et qu'il en est propriétaire, et (054) pour un `setter` si `p_cycle` est donné et qu'il est le setter de la
personne du cycle ; sinon erreur `42501` « Action non autorisée pour le rôle … ». Un `viewer` n'écrit donc jamais.

### 6.3 Qui peut écrire quoi (résumé)

« ses cycles » = cycles dont la personne est propriétaire ; « ses leads » = personnes dont elle est le setter, et leurs cycles.

| Action (RPC) | admin | sales_lead | sales | setter | viewer | Autre condition |
|---|---|---|---|---|---|---|
| Déclarer une issue, ajouter une note, montant signé, échéancier, paiement, suppression d'un paiement manuel, remboursement, maturation, annuler une perte automatique, clore ou rouvrir un cycle (045), déplacer dans le Pipeline (047) | oui | oui | ses cycles | ses leads | non | `crm_require(['admin','sales_lead'], cycle)` |
| Réattribuer un cycle, rattacher / écarter un élément non rattaché, fusionner deux personnes, modifier la configuration, enregistrer les réglages des SLA (`crm_save_sla_rules`, 044) | oui | oui | non | non | non | `crm_require(['admin','sales_lead'])` (`crm_save_sla_rules` passe par `crm_update_config`) |
| Ajouter une transcription, relancer une analyse | oui | ses cycles | ses cycles | ses leads | non | `crm_role() = 'admin'` ou `crm_owns_cycle` |
| Corriger la lettre d'une question (`crm_ca_correct`, 063) | oui | non | non | non | non | `crm_role() = 'admin'` |
| Action du setter (`crm_setter_action`, 054) | oui | ses cycles | ses cycles | ses leads | — | membre actif ; administrateur, setter de la personne, ou propriétaire d'un de ses cycles |
| Choisir le setter d'un lead (`crm_set_setter`, 054) | oui | non | non | non | non | `crm_role() = 'admin'` ; le setter choisi doit être actif, `setter`, `admin` ou `sales` |
| Nouveau prospect (`crm_create_lead`, 054) | oui | non | oui | oui | non | membre actif `admin`, `setter` ou `sales` |
| Définir un membre du CRM (`crm_admin_set_member`) | oui | non | non | non | non | ou administrateur d'application (`my_role() = 'admin'`) |
| Fonction (`crm_set_member_role`) et numéro WhatsApp (`crm_set_member_whatsapp`) d'une personne de l'équipe | — | — | — | — | — | rôle de service seulement, après contrôle administrateur par `web/api/team.js` |
| Ajouter les règles c1–c18 à `config/alerts` (`crm_merge_alert_defaults`) | — | — | — | — | — | administrateur d'application, ou appel sans jeton (propriétaire, service) |
| Tout recalculer (`crm_recompute_all`) | oui | non | non | non | non | ou appel sans jeton |
| Ses propres réglages (`crm_set_pref`) | oui | oui | oui | oui | oui | tout compte connecté |
| Sa progression de Maîtrise de l'offre (`crm_academy_progress`, en direct) | oui | oui | oui | oui | oui | sa propre ligne (`user_id = auth.uid()`) |
| Ses résultats d'entraînement (`crm_training_results`, insertion directe) | oui | oui | oui | oui | oui | sa ligne, un rôle CRM, jamais `mode = 'claude'` ; jamais de modification ni d'effacement |

Lectures par RPC (049, 050, 053, 057) : `crm_training_dashboard`, `crm_sales_execution`, `crm_sla_alerts_open` exigent un rôle CRM
et ne rendent que ce que la personne voit (administrateur : tout) ; `crm_sim_history` ne vérifie pas le rôle mais ne rend que les
simulations de l'appelant (administrateur : toutes).

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

La RLS est activée sur les 53 tables. Les politiques de 003 n'ont pas de clause `to` (elles s'appliquent à tous les rôles,
mais `anon` n'a aucun droit de table). Aucune table du CRM n'a de politique d'écriture pour le navigateur, sauf `crm_member_prefs`
(031), `crm_academy_progress` et `crm_training_results` (049). Les politiques qui passent par `crm_owns_cycle` ou `crm_sees_person`
(`read_calls`, `read_events`, `read_deals`, `read_pay`, `read_stage`, `read_people`, `read_ident`, `read_out`…) couvrent le setter
depuis 054 ; celles qui comparent `owner_id = auth.uid()` (`read_nurt`, `read_alerts`) non.

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
| `crm_cycles` | `read_cycles` (recréée par 054) | select | `crm_sees_all() or owner_id = auth.uid() or crm_sets_person(person_id)` |
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
| `crm_lead_qualifications` (042) | aucune | — | rôle de service seulement (worker) ; l'écran la lit à travers `crm_ca_record` et `crm_ca_board` |
| `crm_academy_progress` (049) | `academy_read` | select | `user_id = auth.uid() or crm_role() = 'admin'` |
| `crm_academy_progress` | `academy_insert` | insert | `with check (user_id = auth.uid())` |
| `crm_academy_progress` | `academy_update` | update | `using` et `with check (user_id = auth.uid())` ; droits `select, insert, update` à `authenticated` |
| `crm_academy_corrections` (049) | aucune | — | rôle de service seulement |
| `crm_training_results` (049) | `training_read` | select | `user_id = auth.uid() or crm_role() = 'admin'` |
| `crm_training_results` | `training_insert` | insert | `with check (user_id = auth.uid() and crm_role() is not null and mode <> 'claude')` ; `revoke all` puis `grant select, insert` à `authenticated` |
| `crm_sla_alerts` (053) | `read_sla_alerts` | select | `crm_sees_all() or (owner_id = auth.uid() and kind <> 'tech')` ; `grant select` à `authenticated` |
| `crm_sim_offers` (057) | `sim_offers_read` | select | `crm_role() is not null and (not archived or crm_role() = 'admin')` |
| `crm_sim_personas` | `sim_personas_read` | select | `crm_role() is not null and (active or crm_role() = 'admin')` |
| `crm_sim_config` | `sim_config_read` | select | `crm_role() is not null` |
| `crm_sim_simulations` | `sim_simulations_read` | select | `user_id = auth.uid() or crm_role() = 'admin'` |
| `crm_sim_messages` | `sim_messages_read` | select | la simulation est à l'appelant, ou administrateur |
| `crm_sim_feedback` | `sim_feedback_read` | select | `user_id = auth.uid() or crm_role() = 'admin'` |
| `crm_sim_analyses` | `sim_analyses_read` | select | `user_id = auth.uid() or crm_role() = 'admin'` |
| les sept `crm_sim_*` | — | — | `revoke all from public, anon, authenticated`, `grant select to authenticated`, `grant all to service_role` |
| `crm_ca_corrections` (063) | `crm_ca_corrections_read` | select, `to authenticated` | `crm_ca_can_read(call_id)` ; `revoke insert, update, delete from anon, authenticated` |

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
Clé `rep` = clé de membre du CRM, ou partie locale de l'e-mail de l'enregistreur Fathom ou de l'hôte iClosed. Ensemencée avec
`('valentino', 'Valentino')` ; 22 lignes en production. Plusieurs clés d'une même personne (adresses iClosed et Fathom) portent
le même `name` et ne font qu'une ligne du Cockpit (036).

| Colonne | Type | N | Défaut | Contraintes |
|---|---|---|---|---|
| `rep` | `text` | oui | | PK |
| `name` | `text` | oui | | |
| `added_at` | `timestamptz` | oui | `now()` | |
| `active` | `boolean` | oui | `true` | 039 : un ancien commercial (`false`) n'a plus de ligne au Cockpit, ses enregistrements Fathom restent reconnus (FL-1) et ses cycles comptent dans les totaux |

#### `crm_member_prefs` (031)

Réglages d'écran propres à chaque personne. Clés utilisées : `crm.pipeline.cols` (ordre des colonnes du Pipeline, document du
CRM de `app/lnp.html`) et `salesday.<jour>` (prospects faits, passés ou reportés ce jour-là dans Cycle de vente › « Aujourd'hui »,
`LNP_SB_DOC` de `app/lnp.html` ; avant la fusion du 10 novembre 2026, `app/salesday_module.js`).

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
| `setter_id` | `uuid` | non | | 054 : FK `crm_members(id)` `on delete set null` ; index partiel `crm_people_setter` ; le setter du lead |
| `lead_source` | `text` | non | | 054 : `quiz`, `vsl`, `quiz_abandon`, `webinaire`, `iclosed`, `manuel` (gardé à la première entrée) |
| `quiz` | `jsonb` | non | | 054 : réponses du quiz, telles que reçues |
| `setting_status` | `text` | non | | 054 : statut setter (§12.24) ; index partiel `crm_people_setting` |
| `setting_since` | `timestamptz` | non | | 054 : entrée dans le statut |
| `setting_last_action` | `text` | non | | 054 : libellé de la dernière action |
| `setting_last_at` | `timestamptz` | non | | 054 |
| `setting_due_at` | `timestamptz` | non | | 054 : échéance de l'action actuelle (`null` : rien à faire), calculée par `crm_setting_due` |
| `setting_attempts` | `int` | oui | `0` | 054 : tentatives d'appel du setter |

Le statut setter est gardé **sur la personne** (un lead sans RDV n'a pas encore de cycle). Déclencheur lié : `crm_setting_on_call`
sur `crm_calls` (§10).

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

#### `crm_reason_codes` (003, 026, 055)

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

Données initiales (`refunded` ajouté par 026, `refus_6_mois` par 055) :

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
| `refus_6_mois` | disqualified | Refus sans suite depuis 6 mois | none | oui | 99 (`is_proposal = false` ; 055 le remet `active` et `automatic` à chaque passage) |

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
| `nurture_cadence` | nurture | `{"standard_days":[14,21],"light_days":30,"archive_after_days":182}` | true | `crm_refusal_tick` (`archive_after_days`, 055) |
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

#### `crm_deals` (003, 024, 037, 041)

Une vente par cycle. Déclencheur `crm_deals_plan_source` (041, §10).

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
| `iclosed_deal_ids` | `text[]` | non | | 037 : les ventes iClosed agrégées dans cette vente (écrites par `crm_import_deals` de 037 / 041 ; plus écrites depuis 059) |
| `plan_source` | `text` | non | | 041 : `auto` (échéancier déduit du montant iClosed par `crm_apply_auto_plans`) ou `manual` (posé par le déclencheur dès qu'autre chose change `schedule`, `amount_sold` ou `payment_plan`) |
| `plan_match` | `text` | non | | 041 : comment le montant a été reconnu : `total`, `instalment`, `to_check` |

#### `crm_payments` (003, 022, 037)

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
| `source` | `text` | oui | `'whop'` | 022 ; contrainte `crm_payments_source check (source in ('whop', 'manual', 'iclosed'))` (`iclosed` ajouté par 037) |
| `method` | `text` | non | | 022 : `bank_transfer`, `card`, `cash`, `other` (contrôlé par `crm_add_payment`) |
| `note` | `text` | non | | 022 |
| `created_by` | `uuid` | non | | 022 ; FK `crm_members(id)` |
| `created_at` | `timestamptz` | oui | `now()` | 022 |
| `iclosed_deal_id` | `text` | non | | 037 : index unique `crm_payments_iclosed_deal_id_key` ; `method` vaut alors `won` ou `deposit`. Écrit par `crm_import_deals` de 037 / 041 seulement : depuis 059, une vente iClosed n'est plus un paiement |

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

Écrite par `crm_set_nurture` (004), `crm_open_cycle` (005, réactivation) et `crm_close_before` (056 : suivi long terme
`standard`, motif `timing`, des leads ouverts avant le 27 octobre 2026).

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
attribué à une autre personne » (023) ; « Enregistrement Fathom : plusieurs prospects correspondent » (025) ; « Plusieurs
personnes ont cet e-mail ou ce numéro » (054, lead d'un funnel, source `funnel`).

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
`crm_merge_people`. **Aucune fonction du dépôt n'y insère de ligne** (le `rules-tick` prévu par `docs/crm/` n'existe pas). Les
alertes réellement ouvertes par le CRM sont dans `crm_sla_alerts` (053, ci-dessous).

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

Ce que `sla-tick` a déjà posté dans Slack (jamais deux fois). Depuis 053, Slack n'est qu'une copie facultative, éteinte par défaut
(`supabase/functions/_shared/sla_rules.js`) : la table ne se remplit que si une règle a `slack: true` et que le secret
`SLACK_SALES_CYCLE_WEBHOOK_URL` existe.

| Colonne | Type | N | Défaut | Contraintes |
|---|---|---|---|---|
| `key` | `text` | oui | | PK : `cycle:sla:minute de départ:niveau` |
| `cycle_id` | `uuid` | non | | FK `crm_cycles(id)` `on delete cascade` ; index `crm_sla_notices_cycle` |
| `sla` | `text` | oui | | |
| `level` | `text` | oui | | `check (level in ('late', 'crit'))` |
| `crossed_at` | `timestamptz` | oui | | moment où le seuil a été franchi |
| `sent_at` | `timestamptz` | oui | `now()` | |

#### `crm_sla_alerts` (053, 054)

Le centre d'alertes du CRM (Romain, 9 novembre 2026 : « je ne veux pas que ce soit Slack qui soit la base des notifications »).
Toutes les 5 minutes, `sla-tick` évalue les SLA de chaque cycle en cours et de chaque lead suivi par un setter, puis appelle
`crm_sync_sla_alerts` (§12.25). Publiée dans `supabase_realtime` (053). Lue par `crm_sla_alerts_open` (écran Alertes, pastille,
bandeau, `app/alerts_module.js`) et en direct par `app/crm/data.js` (`onAlerts`).

| Colonne | Type | N | Défaut | Contraintes / sens |
|---|---|---|---|---|
| `id` | `uuid` | oui | `gen_random_uuid()` | PK |
| `key` | `text` | oui | | `cycle:SLA:minute du départ de l'horloge` (un lead sans cycle : `p:<personne>:SE-n:<minute>`) ; index unique partiel `crm_sla_alerts_open (key) where resolved_at is null` : une seule alerte ouverte par clé |
| `cycle_id` | `uuid` | non (054) | | FK `crm_cycles(id)` `on delete cascade` ; index `crm_sla_alerts_cycle` ; `not null` levé par 054 (alerte du setter avant le RDV) |
| `person_id` | `uuid` | non | | FK `crm_people(id)` `on delete set null` |
| `owner_id` | `uuid` | non | | FK `crm_members(id)` `on delete set null` : qui doit agir (commercial du cycle, ou setter) ; index partiel `crm_sla_alerts_owner (owner_id) where resolved_at is null` |
| `sla` | `text` | oui | | `SH-2`, `DE-1`, `CO-1`, `SE-1`… |
| `kind` | `text` | oui | `'sales'` | `sales` (la personne agit) ou `tech` (intégration, données : administrateurs seulement) |
| `level` | `text` | oui | | `check (level in ('warn', 'late', 'crit'))` : Bientôt dû, En retard, Critique |
| `name` | `text` | oui | | nom du SLA, en français |
| `detail` | `text` | non | | « depuis la prise de RDV »… |
| `target` | `text` | non | | objectif (« 5 min ») |
| `started_at` | `timestamptz` | oui | | départ de l'horloge |
| `crossed_at` | `timestamptz` | oui | | passage du niveau actuel |
| `opened_at` | `timestamptz` | oui | `now()` | |
| `updated_at` | `timestamptz` | oui | `now()` | |
| `resolved_at` | `timestamptz` | non | | l'alerte est fermée |
| `resolution` | `text` | non | | `done` (le SLA s'est arrêté : action faite) ou `closed` (cycle terminé) |

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

#### `crm_ca_config` (020, 035)

Une seule ligne (`id = true`). Lue par le worker dans `crm_ca_claim` (`config.tiers`, `passes`, `engine`) et par la qualification
(`crm_qualif_config`).

| Colonne | Type | N | Défaut | Contraintes |
|---|---|---|---|---|
| `id` | `boolean` | oui | `true` | PK ; `check (id)` |
| `tiers` | `jsonb` | oui | | modèle par niveau ; ensemencé `{"fast": "claude-haiku-5-5", "strong": "claude-sonnet-5-5", "arbiter": "claude-opus-5-5"}` ; **en production** `{"fast": "claude-haiku-5-5", "strong": "claude-haiku-5-5", "arbiter": "claude-sonnet-5-5"}` (changé à la main, §3) |
| `passes` | `int` | oui | `3` | `check (passes in (1, 3))` |
| `default_timezone` | `text` | oui | `'Asia/Dubai'` | fuseau d'un appel sans propriétaire (aucune migration ne le passe à Paris) |
| `provisional` | `boolean` | oui | `true` | notes « provisoires » à l'écran |
| `updated_at` | `timestamptz` | oui | `now()` | |
| `engine` | `text` | oui | `'full'` | 035 : contrainte `crm_ca_config_engine_check (engine in ('full', 'lite'))` ; `full` = moteur de `call-analysis/engine`, `lite` = moteur allégé `call-analysis/lite` ; **`lite` en production** |

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
| `meta` | `jsonb` | oui | `'{}'` | infos de l'appel (`crm_ca_call_info`) + `engine` (version du moteur ; `lite` pour le moteur allégé, 035), `engine_version` (035, moteur allégé), `engine_steps` (035 : ce que chaque étape du moteur allégé a écarté), `rules` (version par compétence), `duration` |
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

Droits des tables `crm_ca_*` de 020 : `revoke all from anon`, `grant select to authenticated` (la RLS du §6.5 décide).

#### `crm_ca_corrections` (063)

Les corrections d'un administrateur sur la lettre SPIN d'une question de la découverte (méthode, partie C, C8 : « une personne peut
corriger un verdict ; personne ne modifie une note à la main »). Ajout seulement : aucun droit d'écriture pour `anon` et
`authenticated`, écriture par `crm_ca_correct` ; rien n'empêche le rôle de service de modifier une ligne (pas de déclencheur,
contrairement à `crm_training_results`). La note de l'analyse n'est pas recalculée. Lue par `crm_ca_record` et par
`call-analysis/qa/corrections_to_reference.py` (jeu de référence de la mesure).

| Colonne | Type | N | Défaut | Contraintes |
|---|---|---|---|---|
| `id` | `bigint` | oui | `bigserial` | PK |
| `job_id` | `uuid` | oui | | FK `crm_ca_jobs(id)` (sans `on delete`) ; index `crm_ca_corrections_job` |
| `call_id` | `uuid` | oui | | FK `crm_calls(id)` (sans `on delete`) |
| `competence` | `text` | oui | `'SPIN'` | |
| `unit_id` | `text` | oui | | identifiant de la question dans la fiche (`details.solicitations[].id`, par exemple `Q030.1`) |
| `field` | `text` | oui | `'letter'` | |
| `engine_value` | `text` | non | | lettre décidée par le moteur (`OUT` si la question n'a pas de lettre) |
| `value` | `text` | oui | | lettre décidée par la personne : `S`, `P`, `I`, `N` ou `OUT` (hors découverte) |
| `note` | `text` | non | | raison facultative |
| `author` | `uuid` | non | `auth.uid()` | |
| `created_at` | `timestamptz` | oui | `now()` | |

### 7.11 bis Qualification du lead

#### `crm_lead_qualifications` (042, 046)

Une ligne par qualification d'un R1 (la plus récente d'un appel est la qualification courante). Écrite par le worker de l'analyse
d'appel (`call-analysis/worker/callqa_worker/qualif.py`, à chaque R1 analysé, avec le travail d'analyse) et par le rattrapage manuel
`call-analysis/qualification/run.py` (`.github/workflows/qualification.yml`) via `crm_qualif_store`. RLS sans politique : le
navigateur la lit seulement à travers `crm_ca_record` (`qualification`) et `crm_ca_board` (`qualification.status`,
`solution_aware`) ; `crm_sales_exec_window` en tire « qualifié » (§12.21).

| Colonne | Type | N | Défaut | Contraintes |
|---|---|---|---|---|
| `id` | `bigint` | oui | identité | PK |
| `call_id` | `uuid` | oui | | FK `crm_calls(id)` `on delete cascade` ; index `lead_qualifications_call (call_id, created_at desc)` |
| `cycle_id` | `uuid` | non | | FK `crm_cycles(id)` `on delete cascade` |
| `status` | `text` | oui | | verdict : `SQL GAGNÉ`, `SQL OUVERT`, `SQL PERDU`, `NON SQL`, `MQL EN ATTENTE`, `À REVOIR` |
| `result` | `jsonb` | oui | | décision du code (dont `portes.{metier, financement, decision_timing, …}.statut`, `solution_aware`) |
| `readings` | `jsonb` | oui | `'[]'` | les lectures du modèle (faits extraits) |
| `verification` | `jsonb` | oui | `'[]'` | |
| `usage` | `jsonb` | non | | |
| `prompt_version` | `text` | non | | par exemple `lnp-sql-v2.1-2026-11-05` |
| `rules_version` | `text` | non | | |
| `created_at` | `timestamptz` | oui | `now()` | |
| `job_id` | `uuid` | non | | 046 : FK `crm_ca_jobs(id)` `on delete set null` ; index `lead_qualifications_job` ; l'analyse avec laquelle elle a été faite |

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

### 7.13 Entraînement

#### `crm_academy_progress` (049)

L'état de travail de Maîtrise de l'offre (« Académie sales LNP », 100 cas), une ligne par personne, pour le retrouver d'un appareil à
l'autre. Écrite en direct par `app/training/academie.html` (insertion et mise à jour de sa ligne).

| Colonne | Type | N | Défaut | Contraintes |
|---|---|---|---|---|
| `user_id` | `uuid` | oui | `auth.uid()` | PK ; FK `auth.users(id)` `on delete cascade` |
| `exos` | `jsonb` | oui | `'{}'` | `{"A12": {best, last, tries, mode, answer, answer2, feedback, at}, …}` |
| `updated_at` | `timestamptz` | oui | `now()` | |

#### `crm_academy_corrections` (049)

Prévue pour compter les corrections par Claude (« web/api/academie.js », dit l'en-tête de 049) et limiter les corrections d'affilée.
**Aucun code ne l'écrit** : `web/api/academie.js` n'existe pas et la correction par Claude a été retirée (Romain, 8 novembre 2026 :
la réponse est validée puis auto-corrigée). RLS sans politique.

| Colonne | Type | N | Défaut | Contraintes |
|---|---|---|---|---|
| `id` | `bigint` | oui | identité | PK |
| `user_id` | `uuid` | oui | | FK `auth.users(id)` `on delete cascade` ; index `academy_corrections_user (user_id, created_at desc)` |
| `case_id` | `text` | oui | | |
| `usage` | `jsonb` | non | | jetons |
| `created_at` | `timestamptz` | oui | `now()` | |

#### `crm_training_results` (049)

Un exercice terminé, gardé pour toujours (ajout seulement). Écrite par `app/training/results_log.js` (Découverte : « Le coup
suivant », « La lettre imposée » ; Maîtrise de l'offre) ; lue par « Mes résultats » et « Suivi des commerciaux »
(`app/training/resultats.html` via `crm_training_dashboard`). **Pas de FK vers `auth.users`** : retirer quelqu'un de l'équipe
n'efface jamais ce qu'il a fait. Déclencheurs : `crm_training_results_stamp` (l'heure du serveur, jamais celle de la page),
`crm_training_results_keep` et `crm_training_results_keep_all` (§10).

| Colonne | Type | N | Défaut | Contraintes |
|---|---|---|---|---|
| `id` | `bigint` | oui | identité | PK |
| `user_id` | `uuid` | oui | `auth.uid()` | unique (`user_id`, `cid`) ; index `training_results_user (user_id, module, created_at desc)` |
| `cid` | `text` | oui | | `check (length(cid) between 8 and 64)` : identifiant écrit par la page, un résultat envoyé deux fois n'est gardé qu'une fois |
| `module` | `text` | oui | | `check (module in ('coup', 'lettre', 'academie'))` |
| `case_id` | `text` | oui | | `check (length(case_id) between 1 and 12)` |
| `score` | `numeric(4,1)` | oui | | `check (score >= 0 and score <= max and score * 2 = round(score * 2))` (demi-points) |
| `max` | `numeric(4,1)` | oui | | `check (max = case module when 'coup' then 1 when 'lettre' then 3 else 10 end)` |
| `mode` | `text` | oui | | `check (mode in ('regles', 'auto', 'claude'))` et `check ((module = 'academie') = (mode in ('auto', 'claude')))` |
| `duration_s` | `int` | oui | `0` | `check (duration_s between 0 and 3600)` : temps actif |
| `details` | `jsonb` | oui | `'{}'` | `check (jsonb_typeof(details) = 'object' and pg_column_size(details) < 32000)` : les réponses |
| `created_at` | `timestamptz` | oui | `now()` | reposé par le déclencheur |

### 7.14 Simulateur

Sept tables (057) écrites seulement par la fonction Edge `simulateur` (clé de service ; moteur dans
`supabase/functions/_shared/simulateur/`) ; le navigateur les lit par la RLS (§6.5) et l'historique par `crm_sim_history`.

#### `crm_sim_offers` (057, 058)

| Colonne | Type | N | Défaut | Contraintes |
|---|---|---|---|---|
| `id` | `uuid` | oui | `gen_random_uuid()` | PK |
| `name` | `text` | oui | | `check (length(name) between 1 and 200)` |
| `description`, `price`, `sector` | `text` | non | | |
| `data` | `jsonb` | oui | `'{}'` | `check (jsonb_typeof(data) = 'object')` : modules de l'offre lus par le prospect (`identity`, `value_proposition`… et `offer_identity`, `offer_details`, `tools_taught`) |
| `sources` | `jsonb` | oui | `'[]'` | |
| `fingerprint` | `text` | non | | empreinte des sources ; index unique partiel `crm_sim_offers_fingerprint (fingerprint) where fingerprint is not null and not archived` |
| `status` | `text` | oui | `'ready'` | `check (status in ('extracting', 'generating', 'ready', 'failed'))` |
| `error` | `text` | non | | |
| `archived` | `boolean` | oui | `false` | |
| `created_by` | `uuid` | non | | |
| `created_at`, `updated_at` | `timestamptz` | oui | `now()` | |

058 y insère l'offre de LNP « Accompagnement Les Nouveaux Profs » (prix « 3 000 € », secteur `coaching`, écrite d'après
`app/training/academie_contenu.json`, `on conflict do nothing`) ; aucun prospect : un administrateur les génère depuis l'écran.

#### `crm_sim_personas` (057)

| Colonne | Type | N | Défaut | Contraintes |
|---|---|---|---|---|
| `id` | `text` | oui | | PK ; `check (id ~ '^[a-z0-9_-]{3,80}$')` |
| `offer_id` | `uuid` | non | | FK `crm_sim_offers(id)` `on delete cascade` ; index `crm_sim_personas_offer (offer_id, position)` |
| `first_name` | `text` | oui | | |
| `age` | `int` | non | | |
| `city`, `profession`, `situation` | `text` | non | | |
| `difficulty` | `text` | oui | `'moyen'` | `check (difficulty in ('moyen', 'difficile', 'expert'))` |
| `consciousness_level` | `int` | non | | `check (consciousness_level between 1 and 5)` |
| `pcm_type` | `text` | non | | `check (pcm_type in ('travaillomane', 'empathique', 'promoteur', 'perseverant'))` |
| `voice_id` | `text` | non | | voix ElevenLabs |
| `full_persona_data` | `jsonb` | oui | `'{}'` | `check (jsonb_typeof(...) = 'object')` : identité, douleurs, objections, style, briefing |
| `position` | `int` | oui | `0` | |
| `active` | `boolean` | oui | `true` | |
| `created_at`, `updated_at` | `timestamptz` | oui | `now()` | |

#### `crm_sim_simulations` (057)

| Colonne | Type | N | Défaut | Contraintes |
|---|---|---|---|---|
| `id` | `bigint` | oui | identité | PK |
| `user_id` | `uuid` | oui | | index `crm_sim_simulations_user (user_id, started_at desc)`, index partiel `crm_sim_simulations_active (user_id) where status = 'active'` |
| `status` | `text` | oui | `'active'` | `check (status in ('active', 'completed', 'cancelled'))` |
| `started_at` | `timestamptz` | oui | `now()` | |
| `ended_at` | `timestamptz` | non | | |
| `duration_seconds` | `int` | non | | |
| `prospect_name` | `text` | oui | | |
| `prospect_profile` | `text` | oui | `''` | |
| `persona_id` | `text` | non | | FK `crm_sim_personas(id)` `on delete set null` |
| `offer_id` | `uuid` | non | | FK `crm_sim_offers(id)` `on delete set null` |
| `difficulty` | `text` | oui | `'moyen'` | `check (difficulty in ('moyen', 'difficile', 'expert'))` |
| `simulation_mode` | `text` | oui | `'full'` | `check (simulation_mode in ('full', 'diagnostic', 'objections'))` |
| `call_structure` | `text` | oui | `'lnp'` | |
| `persona_data` | `jsonb` | non | | dont `variante` (humeur, contexte, objection de plus, loquacité : `variantes.ts`) |
| `simulation_state` | `jsonb` | non | | état du moteur (confiance, conscience, résistance) |
| `use_modular_prompt` | `boolean` | oui | `true` | |
| `version_referentiel` | `text` | non | | |
| `voice` | `boolean` | oui | `false` | démarrée à la voix |
| `usage` | `jsonb` | oui | `'{}'` | jetons consommés ; `usage.realisme` = mesure de réalisme (061, `realisme.ts`) |
| `created_at` | `timestamptz` | oui | `now()` | |

#### `crm_sim_messages` (057)

| Colonne | Type | N | Défaut | Contraintes |
|---|---|---|---|---|
| `id` | `bigint` | oui | identité | PK |
| `simulation_id` | `bigint` | oui | | FK `crm_sim_simulations(id)` `on delete cascade` ; index `crm_sim_messages_sim (simulation_id, id)` |
| `role` | `text` | oui | | `check (role in ('commercial', 'prospect'))` |
| `content` | `text` | oui | | |
| `created_at` | `timestamptz` | oui | `clock_timestamp()` | |

#### `crm_sim_feedback` (057)

| Colonne | Type | N | Défaut | Contraintes |
|---|---|---|---|---|
| `id` | `uuid` | oui | `gen_random_uuid()` | PK |
| `simulation_id` | `bigint` | oui | | unique ; FK `crm_sim_simulations(id)` `on delete cascade` |
| `user_id` | `uuid` | oui | | |
| `user_email` | `text` | non | | |
| `rating` | `int` | oui | | `check (rating between 1 and 5)` |
| `comment` | `text` | non | | `check (comment is null or length(comment) <= 2000)` |
| `created_at` | `timestamptz` | oui | `now()` | |

#### `crm_sim_analyses` (057)

| Colonne | Type | N | Défaut | Contraintes |
|---|---|---|---|---|
| `id` | `uuid` | oui | `gen_random_uuid()` | PK |
| `simulation_id` | `bigint` | oui | | FK `crm_sim_simulations(id)` `on delete cascade` ; index unique `crm_sim_analyses_sim` (une analyse par simulation) |
| `user_id` | `uuid` | oui | | |
| `status` | `text` | oui | | `check (status in ('processing', 'deferred', 'completed', 'failed', 'rejected'))` ; index `crm_sim_analyses_status (status, created_at)` |
| `reason` | `text` | non | | |
| `type_appel` | `text` | non | | |
| `transcript` | `text` | non | | |
| `result` | `jsonb` | non | | dont `score_total` (sur 100) et `niveau` |
| `raw` | `jsonb` | non | | |
| `aar` | `jsonb` | non | | retour d'expérience |
| `miroir` | `jsonb` | non | | |
| `cost` | `jsonb` | oui | `'{}'` | |
| `attempts` | `int` | oui | `0` | |
| `created_at`, `updated_at` | `timestamptz` | oui | `now()` | |
| `completed_at` | `timestamptz` | non | | |

#### `crm_sim_config` (057)

Une seule ligne (`id = 1`, insérée par 057).

| Colonne | Type | N | Défaut | Contraintes |
|---|---|---|---|---|
| `id` | `int` | oui | `1` | PK ; `check (id = 1)` |
| `claude_model` | `text` | oui | `'claude-sonnet-5-5'` | `check (claude_model in ('claude-sonnet-5-5', 'claude-haiku-5-5', 'claude-opus-5-5'))` : modèle du prospect |
| `voice_mode_enabled` | `boolean` | oui | `true` | |
| `eleven_labs_model_id` | `text` | oui | `'eleven_flash_v2_5'` | |
| `eleven_labs_stability` | `numeric(3,2)` | oui | `0.20` | entre 0 et 1 |
| `eleven_labs_style` | `numeric(3,2)` | oui | `0.20` | entre 0 et 1 |
| `eleven_labs_speed` | `numeric(3,2)` | oui | `1.20` | entre 0,7 et 1,2 |
| `silence_timeout_ms` | `int` | oui | `800` | entre 300 et 5 000 |
| `daily_analysis_limit` | `int` | oui | `10` | entre 0 et 1 000 : au-delà, l'analyse est `deferred` et repart avec `crm-simulateur-balayer` |
| `updated_at` | `timestamptz` | oui | `now()` | |
| `updated_by` | `uuid` | non | | |

---

## 8. Vue

### `crm_people_without_cycle` (009, redéfinie par 010 et 054)

`with (security_invoker = true)` : la RLS de `crm_people` s'applique (depuis 048 un administrateur voit tout le monde ; depuis 054
un setter voit les personnes qu'il suit ; un commercial, un responsable commercial ou un lecteur ne voit personne ici, faute de
cycle à posséder). Droits : `revoke all from anon`, `grant select to authenticated`. Lue par le CRM (`app/crm/data.js`) pour
les prospects « Sans rendez-vous » et leur suivi setter (écran Prospects, `app/crm/setting_ui.js`).

Une ligne par personne non fusionnée (`merged_into is null`) sans aucun cycle. Colonnes (définition finale, 054) :

| Colonne | Valeur |
|---|---|
| `id`, `full_name`, `primary_email`, `primary_phone`, `created_at` | de `crm_people` |
| `iclosed_status` | `data->>'status_label'` du dernier événement `imported` dont `source_id` commence par `import:import:iclosed:` |
| `last_event_at` | `max(occurred_at)` des événements de la personne |
| `first_seen_at` | de `crm_people` (ajoutée par 010) |
| `setter_id`, `lead_source`, `quiz`, `setting_status`, `setting_since`, `setting_last_action`, `setting_last_at`, `setting_due_at`, `setting_attempts` | de `crm_people` (ajoutées en fin par 054) |

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
| `crm_role()`, `crm_sees_all()`, `crm_owns_cycle(uuid)`, `crm_sees_person(uuid)` | sql stable definer | auth | §6.2. | Politiques RLS ; nombreuses fonctions. | `crm_role` 003 ; `crm_sees_all` 048 ; `crm_owns_cycle`, `crm_sees_person` 054 |
| `crm_require(member_role[], uuid default null) → crm_members` | plpgsql stable definer | interne (service) | Contrôle d'accès, §6.2. | Toutes les RPC d'écriture. | 054 (setter) ; versions 004, 034 |
| `crm_audit(uuid, text, text, text, jsonb, jsonb) → void` | sql definer | interne (service) | Insère une ligne dans `crm_audit_log`. | RPC d'écriture. | 004 |

### 9.2 Écritures du navigateur (004 et suivants)

| Fonction | Droits | Contrôle | Ce qu'elle fait et écrit | Appelants | Définition finale |
|---|---|---|---|---|---|
| `crm_admin_set_member(p_email, p_member_key, p_full_name, p_role member_role, p_lead_key default null, p_iclosed_email default null, p_fathom_email default null, p_whatsapp_number default null, p_active default true) → uuid` | auth, service | administrateur d'application ou du CRM | Retrouve le compte dans `members` par e-mail (erreur s'il n'existe pas : « invitez d'abord la personne »), résout le responsable par sa clé (erreur s'il est inconnu ou s'il s'agit de la personne elle-même), insère ou met à jour `crm_members`, audit `set_member`. | Aucun dans le code (éditeur SQL). | 052 (supprimée puis recréée) ; versions 004, 034 |
| `crm_declare_outcome(p_call uuid, p jsonb) → uuid` | auth, service | `crm_require(['admin','sales_lead'], cycle)` | Voir §12.5. Écrit `crm_call_outcomes` (remplace l'issue courante), `crm_calls.status`, les événements `outcome_<présence>` et `outcome_<décision>`, la vente si « oui », l'audit, puis recalcule le cycle. | `data.js` `declareOutcome` (fiche du lead et formulaire d'issue `app/crm/outcome_ui.js`, Pipeline, Cycle de vente) ; connecteur `web/api/_write.js` (outil « issue d'un appel »). | 027 (copie 034) |
| `crm_add_note(p_cycle uuid, p_text text) → bigint` | auth, service | idem | Refuse une note vide ; événement `note` (`content` = texte, `source_id` `crm:note:<uuid>`) ; audit `add_note`. Renvoie l'id de l'événement. | `data.js` `addNote` (CRM, Cycle de vente) ; `web/api/_write.js` (outil « note sur un prospect »). | 004 (copie 034) |
| `crm_reassign_cycle(p_cycle uuid, p_member uuid) → void` | auth, service | `crm_require(['admin','sales_lead'])` | Le nouveau commercial doit être actif et pas `viewer` ; change `owner_id` du cycle et des alertes ouvertes (`owner_id`, `owner_key`) ; audit. | `data.js` `reassignCycle` (CRM, `gen_crm.py`). | 004 (copie 034) |
| `crm_cancel_auto_close(p_cycle uuid) → timestamptz` | auth, service | `crm_require([...], cycle)` | Renvoie maintenant + `max(params.snooze_days)` des règles `auto_close` (7 par défaut) et l'écrit **seulement dans l'audit** (`suppressed_until`). Rien ne le relit. | Exposée par `data.js`, aucun écran. | 004 (copie 034) |
| `crm_set_nurture(p_person uuid, p jsonb) → uuid` | auth, service | `crm_require([...], cycle)` | `p.action` = `enter` (refusé si déjà en maturation, sans cycle d'origine, ou si la personne a refusé les messages ; crée `crm_nurture_tracks` + événement `nurture_entered`), `leave` (statut `removed`, `ended_at`), `set_return` (`return_date`). Cycle = `p.cycle_id` ou le dernier ouvert. Audit `nurture_<action>`. | Exposée par `data.js`, aucun écran. | 004 (copie 034) |
| `crm_resolve_unmatched(p_item uuid, p_person uuid, p_cycle uuid default null) → void` | auth, service | `crm_require(['admin','sales_lead'])` | Marque l'élément résolu et remet sa ligne brute dans la file (`status = 'received'`, `attempts = 0`) pour qu'elle soit retraitée. | Exposée par `data.js`, aucun écran. | 004 (copie 034) |
| `crm_dismiss_unmatched(p_item uuid) → void` | auth, service | idem | `dismissed = true`, résolu par l'appelant. | Exposée, aucun écran. | 004 (copie 034) |
| `crm_merge_people(p_keep uuid, p_merge uuid) → void` | auth, service | idem | Refusé si les deux ont un cycle en cours, ou sont tous deux en maturation. Déplace identités (doublons supprimés), cycles, événements, maturations, messages sortants, alertes ; `merged_into` ; garde le refus de messages le plus ancien. | Exposée, aucun écran. | 004 (copie 034) |
| `crm_update_config(p_table text, p_key text, p_value jsonb) → void` | auth, service | idem | `crm_settings` (valeur entière), `crm_rules` (`enabled`, `params` ; règle inconnue refusée), `crm_stage_definitions` et `crm_reason_codes` (création possible, colonnes données). `is_proposal = false`. Audit `update_config`. Ne recalcule pas les cycles. | Exposée, aucun écran. | 004 (copie 034) |
| `crm_create_checkout(p_cycle uuid) → text` | auth, service | idem | Bouchon : lève `0A000` « Les liens de paiement arrivent en phase 5 (Whop) ». | Exposée, aucun écran. | 004 (copie 034) |
| `crm_merge_alert_defaults() → int` | auth, service | administrateur d'application, ou appel sans `auth.uid()` | Ajoute à `docs` `config/alerts` chaque règle c1–c18 absente : `alerts.cN = {on: true, sev: Initcap(severity), who: [propriétaire, responsable, romain] en 0/1, ch: [1,0,0], crm: true}` et `values["cN.<param>"]` pour chaque seuil numérique absent. Ne touche ni a1–a18 ni une règle c déjà modifiée. Renvoie le nombre de règles ajoutées. | Aucun dans le code (`web/api/_os.js` lit aujourd'hui `crm_settings.sla_rules`, plus `alert_rule_defaults`). | 004 (copie 034) |
| `crm_set_deal(p_cycle uuid, p_amount numeric, p_currency text default 'EUR') → uuid` | auth | `crm_require([...], cycle)` | Montant signé ≥ 0 ; insère ou met à jour la vente (devise en majuscules, `yes_at` gardé) ; audit `set_deal`. | Exposée (`data.js` `setDeal`), aucun écran. | 022 (copie 034) |
| `crm_add_payment(p_cycle uuid, p_amount numeric, p_paid_at timestamptz, p_method text, p_note text default null) → uuid` | auth | idem | §12.9. | Fenêtre d'encaissement (`app/crm/cash_ui.js` → `data.js` `addPayment`). | 022 (copie 034) |
| `crm_delete_payment(p_payment uuid) → void` | auth | idem (cycle du paiement) | Seulement un paiement `source = 'manual'` ; supprime le paiement et son événement `payment:<id>`, recalcule, audit. La confirmation est demandée dans le navigateur. | `cash_ui.js` (`deletePayment`). | 022 (copie 034) |
| `crm_set_payment_plan(p_cycle uuid, p_amount numeric, p_currency text, p_schedule jsonb) → uuid` | auth | idem | §12.10. | `cash_ui.js` (`setPlan`). | 024 (copie 034) |
| `crm_add_refund(p_payment uuid, p_amount numeric default null, p_refunded_at timestamptz default null, p_note text default null) → numeric` | auth | idem | §12.11. Renvoie le total remboursé du paiement. | `cash_ui.js` (`addRefund`). | 026 (copie 034) |
| `crm_get_pref(p_key text) → jsonb` | auth | ses lignes | Valeur de la clé pour `auth.uid()`. | Pipeline (`crm.pipeline.cols`), Cycle de vente (`salesday.<jour>`, `LNP_SB_DOC` de `app/lnp.html`) via `data.js`. | 031 |
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
| `crm_recompute_cycle(p_cycle uuid) → void` | service | Le projecteur (§11.5). | Presque toutes les fonctions d'écriture. | 055 ; versions 005, 025, 026, 030, 034 (copie), 045 |
| `crm_recompute_all() → int` | auth, service | Recalcule tous les cycles ; réservé à un administrateur du CRM ou à un appel sans jeton. | Aucun dans le code. | 005 (copie 034) |

### 9.4 Imports et rattrapages

| Fonction | Droits | Ce qu'elle fait | Appelants | Définition finale |
|---|---|---|---|---|
| `crm_import_people(p_run uuid, p_source event_source, p_items jsonb, p_dry boolean) → jsonb` | service | §12.15. Compteurs `{created, matched, conflicts, skipped, statuses}`. | `import_run.ts` (`crm-import ?source=close` / `iclosed`). | 007 |
| `crm_import_save(p_run uuid, p_cursor jsonb, p_stats jsonb, p_status text, p_error text default null) → void` | service | Met à jour le curseur, les compteurs, le statut et `finished_at` d'un `crm_import_runs`. `sql`. | `import_run.ts`. | 007 |
| `crm_import_iclosed_disqualified(p_dry boolean default true) → jsonb` | service | §12.15. `{created, already_had_a_cycle, dry}`. | Aucun (manuel). | 008 |
| `crm_import_calls(p_items jsonb, p_dry boolean) → jsonb` | service | §12.15. | `import_run.ts` (`?source=iclosed_calls`, tâche `crm-iclosed-calls-hourly`). | 059 ; version 009 |
| `crm_import_messages(p_items jsonb, p_dry boolean) → jsonb` | service | Lot de messages déjà lus ; `{items, new, known, new_people, no_cycle, conflicts}`. | Aucun dans le code depuis le retrait de l'import Sendblue (tests SQL seulement ; l'historique WhatsApp arrive par webhook). | 052 |
| `crm_import_recordings(p_items jsonb, p_dry boolean, p_queue boolean default false) → jsonb` | service | Historique Fathom par lots de 10 ; compte par statut et par règle (`rule_<règle>`), `queued`, `speakers_unmapped`. `p_queue` (tâche horaire) met en file les analyses R1/R2 ; un import d'historique non. | `import_run.ts` (`?source=fathom`, tâche `crm-fathom-hourly` avec `queue=1`). | 025 |
| `crm_reclassify_imported(p_dry boolean default true) → jsonb` | service | §12.16. Renvoie les mouvements `"ancien → nouveau": n`. | Aucun (manuel). | 013 |
| `crm_assign_owners_from_hosts(p_dry boolean, p_member uuid default null) → jsonb` | interne | §12.4. | Déclencheur `crm_members_take_leads` ; 015 à l'application ; pg_cron `crm-assign-owners-hourly` (043). | 015 |
| `crm_mark_won_calls_held(p_dry boolean) → jsonb` | interne | §12.17. | 018 à l'application. | 018 |
| `crm_member_from_team(p_user uuid) → void` | interne | §6.1 et §12.3. | Déclencheur `members_to_crm` ; 011 à l'application. | 011 |

### 9.5 Cockpit commercial

| Fonction | Droits | Ce qu'elle fait | Appelants | Définition finale |
|---|---|---|---|---|
| `crm_sales_cockpit() → jsonb` | auth | §12.19. `plpgsql stable definer` ; refuse un compte sans rôle CRM ; limite aux cycles visibles. | `data.js` `salesCockpit`, module du Cockpit commercial (`app/gen_sales_v2.py`). | 060 ; versions 016 (invoker), 017, 018, 019, 034 (copie), 036, 039, 040 |
| `crm_sales_cockpit_window(p_from timestamptz, p_to timestamptz, p_ids uuid[], p_people_all boolean, p_owner uuid default null, p_all boolean default true) → jsonb` | interne | Les chiffres d'une fenêtre (§12.19). `sql stable definer`. | `crm_sales_cockpit`, `crm_training_person`. | 041 ; versions 016 (autre signature, supprimée par 017), 017, 032, 033, 036, 038, 039 |
| `crm_call_is_reschedule(p_call uuid) → boolean` | défaut (aucun `revoke`) | Vrai si le dernier `call_canceled` de l'appel a un motif (`data.cancel_reason` ou `data.reason`) qui correspond à `resched\|new time\|better time\|correspond\|organi[sz]ing a new\|moving accordingly` (insensible à la casse), ou si l'appel a un `call_rescheduled`. | Plus aucune (la fenêtre de 038 à 041 ne la lit plus). | 032 |
| `crm_person_internal(p_person uuid) → boolean` | retirée à `public`, `anon` | §6.2 : fiche de test de l'équipe (`internal_domains`). `sql stable definer`. | Fenêtre du cockpit, `crm_sales_execution`, `crm_training_person`, `crm_qualif_candidates`. | 039 |
| `crm_show_pending_hours() → int` | retirée à `public`, `anon` | `crm_settings.show_pending_hours`, 48 à défaut. | Fenêtre du cockpit. | 039 |
| `crm_sales_execution(p_days int default 90, p_owner uuid default null) → jsonb` | auth | Onglets Exécution, Qualité, Impact (§12.21). Refuse un compte sans rôle CRM ; `p_days` ramené entre 7 et 365 ; cycles visibles (administrateur : tous ; sinon les siens), d'un commercial si `p_owner`, sans les fiches de test. Renvoie `{days, from, at, rules, sources}` ‖ la fenêtre. | `data.js` (`salesExecution`), `app/sales_exec_module.js`. | 060 ; version 050 |
| `crm_sales_exec_window(p_from timestamptz, p_ids uuid[]) → jsonb` | interne | Les chiffres de l'Exécution sur une période (§12.21). `sql stable definer`. | `crm_sales_execution`. | 060 ; version 050 |

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
| `crm_apply_no_show_rule(p_dry boolean default true, p_cycle uuid default null) → jsonb` | service | §12.8. `{dry, since, no_show_r1, missed_r2_plus, cycles}` ou `{error}` si `since` n'est pas fixé. | `crm_no_show_tick` ; manuel. | 056 ; versions 030, 032 |
| `crm_no_show_tick() → jsonb` | interne | Lance `crm_apply_no_show_rule(false)` seulement si `no_show_rule.enabled`. | pg_cron `crm-no-show-hourly`. | 030 |
| `crm_calls_recorded_trigger() → trigger` | — | §12.8 (un enregistrement complet tardif l'emporte). | Déclencheur `crm_calls_recorded`. | 030 |

### 9.7 Analyse d'appel

| Fonction | Droits | Ce qu'elle fait | Appelants | Définition finale |
|---|---|---|---|---|
| `crm_ca_can_read(p_call uuid) → boolean` | auth | §6.2. | Politiques `crm_ca_*`, `crm_ca_latest`, `crm_ca_record`. | 020 |
| `crm_ca_call_info(p_call uuid) → jsonb` | interne | Place de l'appel parmi les appels de vente du cycle : `{call_id, cycle_id, start_utc, event_name, sales_round, eligible, reason, sales_id, sales_name, timezone, person}` (§12.18). | `crm_ca_add_transcript`, `crm_ca_claim`, `crm_ca_store`, `crm_apply_recording_item`. | 025 (copie 034) ; version 020 |
| `crm_ca_add_transcript(p_call uuid, p_raw text, p_speaker_map jsonb, p_source text default 'upload') → jsonb` | auth | Administrateur ou `crm_owns_cycle` (propriétaire du cycle, ou setter de sa personne depuis 054) ; appel éligible ; transcription ≥ 200 caractères ; carte avec au moins un `SALES` et un `PROSPECT`, valeurs dans `SALES`/`PROSPECT`/`OTHER`. Écrit les colonnes de transcription, passe les travaux en file à `failed` (« remplacée par une nouvelle transcription »), crée un travail, événement `transcript_added`. Renvoie `{job, status: 'queued'}`. | `app/crm/call_analysis.js` (`caAddTranscript`). | 020 (copie 034) |
| `crm_ca_retry(p_call uuid) → jsonb` | auth | Mêmes droits ; exige une transcription ; ne crée rien si un travail est déjà `queued`/`running` (`{status: 'already queued'}`). | `call_analysis.js` (`caRetry`). | 020 (copie 034) |
| `crm_ca_claim(p_worker text) → jsonb` | interne* | Prend le plus ancien travail `queued` (avec `not_before` passé) ou `running` depuis plus de 2 h (`for update skip locked`), le passe `running`, +1 tentative, renvoie `{job, attempt, call (crm_ca_call_info), transcript, speaker_map, config {tiers, passes, engine}, offer_reference, case_library, prior}` (`prior` = résultats des appels de vente analysés plus tôt dans le cycle ; `engine` = `crm_ca_config.engine`, 035). `null` s'il n'y a rien. | `call-analysis/worker/run.py` (`callqa_worker/job.py`). | 035 ; version 020 |
| `crm_ca_store(p_job uuid, p_record jsonb, p_usage jsonb, p_engine text) → jsonb` | interne* | Travail `running` obligatoire ; écrit `crm_ca_records` (meta = infos de l'appel + `engine`, `rules`, `duration` = horodatage du dernier tour ; 035 : `engine` du moteur allégé, `engine_version`, `engine_steps`), `crm_ca_turns`, `crm_ca_results`, `crm_ca_audit` ; travail `done` ; événement `analysis_ready` (`data.scores`). Une note enregistrée n'est jamais modifiée : une nouvelle analyse fait une nouvelle fiche. | `run.py`. | 035 ; version 020 |
| `crm_ca_fail(p_job uuid, p_error text, p_final boolean default false) → jsonb` | interne* | Retente (statut `queued`, `not_before` + 10 min) tant que la tentative < 3 et que l'erreur n'est pas finale ; sinon `failed`. | `run.py`. | 020 |
| `crm_ca_latest(p_calls uuid[]) → jsonb` | auth | Dernier travail de chaque appel lisible, avec notes de la dernière fiche et `provisional`. | Aucun dans le code. | 020 |
| `crm_ca_record(p_job uuid) → jsonb` | auth | Une fiche complète si lisible : `{job, call_id, status, flags, phases, meta, provisional, created_at, turns, results, qualification (046 : celle faite avec ce travail, sinon la plus récente de l'appel : status, result, verification, versions), corrections (063 : unit_id, field, engine_value, value, note, created_at, author ; la plus récente d'abord), can_correct (063 : administrateur)}`. | `call_analysis.js` / `call_analysis_view.js` (`caRecord`), vue embarquée `LNP_CAV` de `app/lnp.html` ; connecteur `web/api/_crm.js`. | 063 ; versions 020, 046 |
| `crm_ca_board() → jsonb` | auth | Un élément par appel R1/R2 passé et analysable des cycles visibles (administrateur : tous ; sinon ses cycles) : `{call_id, cycle_id, round, start, transcript, job, status, error, queued_at, started_at, done_job, scores, qualification {status, solution_aware}}` ; depuis 062, le tour est celui de `crm_ca_call_info` (§12.18 : dans un cycle enregistré par Fathom, seuls les appels enregistrés, numérotés par leur rang ; sinon les appels de vente non annulés comptés dans l'ordre), et non plus le compte des appels non annulés (absences comprises). | `data.js` `caBoard` (Leads, fiche du lead ligne « Appels », Cycle de vente ; `call_analysis.js`). | 062 ; versions 021, 046 |

| `crm_ca_correct(p_job uuid, p_unit text, p_value text, p_note text default null) → jsonb` | auth | Administrateur seulement (`42501` « Action non autorisée ») ; `p_value` dans `S`, `P`, `I`, `N`, `OUT` (`22023` « Lettre inconnue : S, P, I, N ou hors découverte ») ; analyse inconnue ou question absente de `details.solicitations` du résultat `SPIN` → `P0002`. Insère une ligne `crm_ca_corrections` (`engine_value` = lettre du moteur, `OUT` à défaut) et la renvoie. La note n'est pas recalculée. | `data.js` (panneau « Corriger la lettre » de l'analyse). | 063 |
| `crm_qualif_config() → jsonb` | service | `{tiers}` de `crm_ca_config`. | `call-analysis/qualification/run.py`. | 042 |
| `crm_qualif_candidates(p_limit int default 30, p_again boolean default false, p_prompt_version text default 'lnp-sql-v2.1-2026-11-05') → jsonb` | service | Le dernier R1 de chaque cycle (passé, non annulé, enregistré d'abord, sans fiche de test), du plus récent au plus ancien, `p_limit` entre 1 et 200 : `{call_id, cycle_id, at, date_appel (Paris), recorded_by, transcript (si enregistré), saisie {outcome, no_sale_reason} (du dernier call_booked)}` ; sans `p_again`, un appel déjà qualifié avec cette version de consigne est sauté. | `run.py` de la qualification (rattrapage manuel). | 046 ; version 042 |
| `crm_qualif_context(p_call uuid) → jsonb` | service | `{call_id, cycle_id, round, date_appel, recorded_by, saisie}` d'un appel. | `call-analysis/worker/callqa_worker/qualif.py`. | 046 |
| `crm_qualif_store(p_call uuid, p_status text, p_result jsonb, p_readings jsonb, p_verification jsonb, p_usage jsonb, p_prompt_version text, p_rules_version text, p_job uuid default null) → bigint` | service | Insère une qualification (cycle de l'appel, `job_id`). | `qualif.py`, `run.py`. | 046 (l'ancienne signature à 8 arguments de 042 est supprimée) |

\* `crm_ca_claim`, `crm_ca_store`, `crm_ca_fail` sont retirées à `public`, `anon` et `authenticated` **sans** `grant` explicite au
rôle de service : le worker, qui appelle avec la clé du rôle de service, compte sur les privilèges par défaut de Supabase
(voir §16). 035 recrée `crm_ca_claim` et `crm_ca_store` et refait ce `revoke`, toujours sans `grant`.

### 9.8 SLA et connecteur Claude

| Fonction | Droits | Ce qu'elle fait | Appelants | Définition finale |
|---|---|---|---|---|
| `crm_sla_snapshot(p_days int default 60) → jsonb` | service | §12.20 ; sans les événements `setter_action`, `lead_in` (054) ni `iclosed_deal` (059). | `sla-tick`. | 059 ; versions 028, 054 |
| `crm_sla_claim(p_items jsonb) → jsonb` | service | Insère les clés pas encore postées dans `crm_sla_notices` et renvoie exactement celles-là. | `sla-tick`. | 028 |
| `crm_sla_settings() → jsonb` | service | `crm_settings.sla_alerts` ‖ `{sla_rules: crm_settings.sla_rules}` (044). | `sla-tick`. | 044 ; version 028 |
| `crm_mcp_call(p_tool text, p_input jsonb) → bigint` | auth | Refuse sans rôle CRM (`42501`) ; refuse le 61e appel de la minute (`P0M60`) ; écrit l'audit `mcp:<outil>` (40 caractères max) avec `after = {input}` ; renvoie l'id. | `web/api/mcp.js` (jeton de la personne). | 014 (copie 034) |
| `crm_mcp_done(p_id bigint, p_rows int, p_ms int, p_error text) → void` | auth | Ajoute `rows`, `ms`, `error` (200 caractères) à la ligne d'audit de l'appelant. | `web/api/mcp.js`. | 014 |
| `crm_save_sla_rules(p_value jsonb) → jsonb` | auth | Vérifie la forme : objet ; `sources` = booléens de `messages`, `whop`, `analysis` seulement ; `rules` = clés `^(SH\|DE\|CA\|CO\|CL\|DO)-[0-9]{1,2}$`, chacune avec seulement `on`, `app`, `slack` (booléens) et `warn`, `late`, `crit` (nombres de 0 à 8 760 heures) ; sinon `22023` « Réglages des SLA : … ». Puis `crm_update_config('crm_settings', 'sla_rules', …)` (droits et audit de 004). Renvoie la valeur enregistrée. **Les règles `SE-n` du setter sont refusées par ce motif** (§16). | Paramètres › Alertes (`gabarits/Settings.pre-hz.dc.html`, `saveSla` dans `app/lnp.html`). | 044 |

### 9.9 Pipeline : fermer, rouvrir, déplacer (045, 047)

| Fonction | Droits | Ce qu'elle fait | Appelants | Définition finale |
|---|---|---|---|---|
| `crm_close_cycle(p_cycle uuid, p_decision text, p_reason text, p_note text default null) → void` | auth | `crm_require(['admin','sales_lead'], cycle)`. Cycle en cours seulement (« Ce prospect est déjà clos ») ; décision `no` ou `disqualified` ; motif actif de la liste, de la nature de la décision (« Un motif de la liste est obligatoire », « Le motif … ne correspond pas à la décision … »). Écrit `cycle_lost` ou `cycle_disqualified` (source `manual`, acteur `sales`, `content` = note, `data.reason`, `source_id` `manual:close:<cycle>:<uuid>`), audit `close_cycle`, recalcule. Pour un lead sans appel à déclarer. | `data.js`, `app/crm/outcome_ui.js` (Pipeline). | 045 |
| `crm_reopen_cycle(p_cycle uuid) → void` | auth | Même contrôle. Refuse un cycle en cours et un cycle gagné (« Une vente payée ne se rouvre pas ») ; écrit `cycle_reopened` (source `manual`, `data.from`, `manual:reopen:<cycle>:<uuid>`), audit `reopen_cycle`, recalcule. | Idem. | 045 |
| `crm_stage_data_types() → text[]` | défaut | `sql immutable` : les types d'événements qui disent où en est un lead d'après ses appels (`call_booked`, `call_rescheduled`, `call_canceled`, `call_missed`, `call_recorded`, `outcome_held`, `outcome_no_show`, `outcome_yes`, `outcome_follow_up`, `outcome_no`, `outcome_disqualified`, `cycle_reopened`, `cycle_won`, `cycle_lost`, `cycle_disqualified`, `payment_succeeded`). | `crm_move_cycle`. | 047 |
| `crm_move_cycle(p_cycle uuid, p_to text) → jsonb` | auth | §12.23. Écrit `stage_moved` (source `manual`, `data.to`), audit `move_cycle`. Renvoie `{cycle, to}`. Ne recalcule pas le cycle (le tableau lit l'événement). | `data.js`, `outcome_ui.js`. | 047 |

### 9.10 Ventes iClosed et échéanciers (037, 041, 059)

| Fonction | Droits | Ce qu'elle fait | Appelants | Définition finale |
|---|---|---|---|---|
| `crm_import_deals(p_items jsonb, p_dry boolean default false) → jsonb` | service | §12.22 : un événement `iclosed_deal` pour information par vente iClosed (plus de vente ni de paiement depuis 059). Renvoie `{deals, matched, unmatched, new, updated, info_only: true, dry}`. | `supabase/functions/_shared/importers/iclosed.ts` via `import_run.ts` (`crm-import ?source=iclosed_deals`, tâche `crm-iclosed-deals-hourly`). | 059 ; versions 037, 041 |
| `crm_plan_for_amount(p_amount numeric) → jsonb` | interne | Le plan d'un montant d'après `offer_catalogue` (§12.22). `sql stable definer`. | `crm_apply_auto_plans`. | 041 |
| `crm_auto_schedule(p_plan jsonb, p_start date) → jsonb` | défaut | `sql immutable` (invoker) : l'échéancier d'un plan, une échéance par mois à partir de `p_start` ; un acompte (`to_check`) = l'acompte puis le reste un mois plus tard. | `crm_apply_auto_plans`. | 041 |
| `crm_apply_auto_plans() → int` | interne | Pour chaque vente iClosed (`iclosed_deal_ids` non nul) dont `plan_source` n'est pas `manual` : `amount_sold` = total du plan, `plan_source = 'auto'`, `plan_match`, `payment_plan` (« N échéances », « Acompte » ou « Payé en une fois »), `schedule` à partir du jour du oui (Paris). Pose `lnp.auto_plan = on` pour que le déclencheur ne la prenne pas pour une saisie. Renvoie le nombre de ventes. | 041 à l'application ; `crm_import_deals` de 041 (plus depuis 059). | 041 |
| `crm_deal_collected(p_deal uuid, p_at timestamptz) → numeric` | interne | Encaissé à une date : plan `auto` → échéances dues (Paris) ; sinon paiements reçus nets des remboursements. | Fenêtre du cockpit. | 041 |
| `crm_deals_plan_source() → trigger` | — | Un changement de `schedule`, `amount_sold` ou `payment_plan` hors `crm_apply_auto_plans` pose `plan_source = 'manual'`. | Déclencheur `crm_deals_plan_source`. | 041 |

### 9.11 Alertes du CRM (053, 054)

| Fonction | Droits | Ce qu'elle fait | Appelants | Définition finale |
|---|---|---|---|---|
| `crm_sync_sla_alerts(p_items jsonb) → jsonb` | service | §12.25. `{opened, updated, done, closed}`. | `supabase/functions/sla-tick/index.ts`. | 054 ; version 053 |
| `crm_sla_alerts_open(p_owner uuid default null) → jsonb` | auth | Refuse sans rôle CRM. `{sees_all, alerts: [{id, cycle_id, person_id, person, owner_id, owner, sla, kind, level, name, detail, target, started_at, crossed_at, opened_at}] (critiques, puis en retard, puis bientôt dues, par passage), closed_today}` : un administrateur voit toutes les alertes ouvertes (ou celles de `p_owner`), les autres celles dont ils sont `owner_id`, jamais `tech` ; `closed_today` compte les fermetures depuis minuit, heure de Paris. | `data.js`, `app/alerts_module.js` (écran Alertes, pastille, bandeau). | 053 |
| `crm_setting_snapshot() → jsonb` | service | Les leads au statut setter ouvert (§12.24) : `{id, person, setter_id, status, since, due_at, last_at, attempts, source, cycle_id}`. | `sla-tick` (alertes SE). | 054 |

### 9.12 Setter et entrée des leads (054, 059)

| Fonction | Droits | Ce qu'elle fait | Appelants | Définition finale |
|---|---|---|---|---|
| `crm_sets_person(p uuid) → boolean` | défaut | §6.2. | `crm_owns_cycle`, `crm_sees_person`, `read_cycles`. | 054 |
| `crm_setting_open_at(t timestamptz) → timestamptz` | défaut | La prochaine heure couverte par le setter à partir de `t` (plages `setting.coverage`, heure de Paris, lundi = 1) ; `t` sans plage. | `crm_setting_due`. | 054 |
| `crm_setting_end_of_day(t timestamptz) → timestamptz` | défaut | 21 h (Paris) le jour de `t` ; après 19 h, 21 h le lendemain. `sql stable` invoker. | `crm_setting_due`. | 054 |
| `crm_setting_due(p_person uuid, p_status text, p_since timestamptz, p_attempts int) → timestamptz` | défaut | Échéance de l'action d'un statut (§12.24). | `crm_setting_move`, `crm_setting_on_call`. | 059 ; version 054 |
| `crm_setting_move(p_person uuid, p_to text, p_action text, p_label text, p_note text, p_actor uuid, p_attempts int default null, p_at timestamptz default now()) → void` | interne | Change le statut setter (verrou sur la personne), remet les tentatives à 0 en entrant dans `a_contacter`, `qualification`, `rdv_a_confirmer`, `rdv_pose`, recalcule `setting_due_at`, écrit `setter_action` (acteur `sales` ou `system`, `data {action, label, from, to, attempts}`, sur le cycle en cours). | Les fonctions du setter, le déclencheur. | 054 |
| `crm_setter_action(p_person uuid, p_action text, p_note text default null) → jsonb` | auth | §12.24 ; refuse une action inconnue ou qui ne s'applique pas au statut (`22023`) ; un lead sans setter prend celui qui agit s'il est setter. Renvoie `{status, due_at, attempts}`. | `data.js`, `app/crm/setting_ui.js` (écran Prospects, fiche « Prise de RDV · setter »). | 054 |
| `crm_set_setter(p_person uuid, p_member uuid) → void` | auth | Administrateur ; `null` retire le setter. | `data.js`. | 054 |
| `crm_pick_setter() → uuid` | défaut | `setting.default_setter` s'il est un setter actif, sinon le setter actif qui a le moins de leads ouverts (puis le plus ancien). | `crm_lead_item`, `crm_setting_tick`. | 054 |
| `crm_lead_item(it jsonb, p_actor uuid default null) → uuid` | interne | Un lead (§12.24). Renvoie la personne. Plusieurs personnes → `P0M02`. | `crm_apply_leads`, `crm_create_lead`. | 059 ; version 054 |
| `crm_apply_leads(p_inbox bigint, p_items jsonb) → text` | service | Les leads d'une ligne brute `funnel`, une transaction ; conflit → non rattaché ; statut final de la ligne. | `supabase/functions/_shared/worker.ts` (`process-inbox`, source `funnel` ; requêtes reçues par `lead-in`). | 054 |
| `crm_create_lead(p_name text, p_email text, p_phone text, p_source text default 'manuel') → uuid` | auth | « + Nouveau prospect » : membre actif `admin`, `setter` ou `sales` ; e-mail ou téléphone obligatoire ; téléphone nettoyé (`00` → `+`, `0` → `+33`) ; `crm_lead_item` avec `source_id` `manuel:<uuid>`. | `data.js`, `setting_ui.js`. | 054 |
| `crm_setting_on_call() → trigger` | — | iClosed fait avancer le statut (§12.24). | Déclencheur `crm_setting_on_call`. | 059 ; version 054 |
| `crm_setting_tick(p_now timestamptz default now()) → jsonb` | service | Leads webinaire en attente (§12.24) : `{to_setter, replied}`. | pg_cron `crm-setting-tick`. | 059 |
| `crm_set_member_role(p_member uuid, p_role text) → text` | service | `sales` ou `setter`, seulement pour un membre `sales`, `setter` ou `viewer` (`P0002` « Fonction inchangée : la personne est administratrice ou n'a pas de fiche dans le CRM »). | `web/api/team.js`. | 054 |

### 9.13 Tâches de maintenance (055, 056)

| Fonction | Droits | Ce qu'elle fait | Appelants | Définition finale |
|---|---|---|---|---|
| `crm_refusal_tick(p_now timestamptz default now()) → int` | interne | §12.26. Renvoie le nombre de cycles passés en disqualifié. | pg_cron `crm-refusal-daily`. | 055 |
| `crm_close_before(p_before timestamptz, p_dry boolean default true) → jsonb` | service | §12.27. `{dry, before, lost, long_term_follow_up}`. | 056 à l'application (une fois). | 056 |

### 9.14 Entraînement (049)

| Fonction | Droits | Ce qu'elle fait | Appelants | Définition finale |
|---|---|---|---|---|
| `crm_training_person(p_user uuid, p_from timestamptz) → jsonb` | interne | Les chiffres d'une personne (§12.28) : `{score, parts {coup, lettre, academie}, academie {validated, tried}, period {n, time_s, modules, last_at}, total {n, time_s, first_at, last_at}, sales {calls, r1_held, won, signed, collected, cash}}`. | `crm_training_dashboard`. | 049 |
| `crm_training_dashboard(p_days int default 30) → jsonb` | auth | Refuse sans rôle CRM. `p_days` 0 ou `null` = depuis le début (au plus 3 650 jours). Un administrateur reçoit chaque membre actif `sales`, `sales_lead` ou `admin` et toute personne qui s'est entraînée ; les autres, leur seule ligne. `{generated_at, days, admin, people: [{id, name ('Ancien membre' sans fiche), role, active, me} ‖ crm_training_person]}`. | `app/training/resultats.html` (« Mes résultats », « Suivi des commerciaux »). | 049 |
| `crm_training_results_stamp() → trigger` | — | `new.created_at := now()`. | Déclencheur `crm_training_results_stamp`. | 049 |
| `crm_training_results_keep() → trigger` | — | Lève `42501` « Les résultats d'entraînement ne peuvent être ni modifiés ni effacés. » | Déclencheurs `crm_training_results_keep`, `crm_training_results_keep_all`. | 049 |

### 9.15 Simulateur (057, 061)

| Fonction | Droits | Ce qu'elle fait | Appelants | Définition finale |
|---|---|---|---|---|
| `crm_sim_history(p_user uuid default null, p_limit int default 200) → jsonb` | auth | Une ligne par simulation visible (la sienne, ou toutes pour un administrateur ; une personne avec `p_user`), la plus récente d'abord, 1 à 1 000 : `{id, user_id, name, status, started_at, ended_at, duration_seconds, prospect_name, persona_id, offer_id, offer_name, mode, difficulty, voice, version_referentiel, messages (nombre), analysis {id, status, reason, score (result.score_total), niveau}, rating, realisme (usage.realisme), variante (persona_data.variante)}`. | `app/training/simulateur.html`. | 061 ; version 057 |

Le reste du Simulateur (offres, prospects, conversation, analyse) est écrit par la fonction Edge `simulateur` directement dans les
tables, avec la clé de service.

### 9.16 Fonctions de déclencheur restantes

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
| `crm_deals_plan_source` | `crm_deals` | `before update`, par ligne | `crm_deals_plan_source()` | 041 |
| `crm_training_results_stamp` | `crm_training_results` | `before insert`, par ligne | `crm_training_results_stamp()` | 049 |
| `crm_training_results_keep` | `crm_training_results` | `before update or delete`, par ligne | `crm_training_results_keep()` | 049 |
| `crm_training_results_keep_all` | `crm_training_results` | `before truncate`, par instruction | `crm_training_results_keep()` | 049 |
| `crm_setting_on_call` | `crm_calls` | `after insert or update of status, scheduled_start`, par ligne | `crm_setting_on_call()` | 054 (fonction : 059) |

Onze déclencheurs, comme en production. La condition `pg_trigger_depth() < 1` empêche la renumérotation de se relancer elle-même (les `update crm_calls set rank` faits par
`crm_rank_calls` ne touchent pas les colonnes surveillées, et un déclencheur imbriqué ne repart pas).

---

## 11. La chaîne des événements et le projecteur

### 11.1 De la requête brute au fait

```
fournisseur ──HTTP──▶ Edge Function *-in ──insert──▶ crm_webhook_log (status received, auth_ok)
                                                            │
pg_cron chaque minute (si des lignes iclosed / whatsapp / fathom / funnel attendent) ──▶ process-inbox
                                                            │
             crm_inbox_pending ──▶ mapper de la source (TS) ──▶ éléments canoniques
                                                            │
     auth_ok faux → crm_inbox_mark(rejected) · rien à faire → ignored · exception → failed (+1 tentative)
                                                            │
   crm_apply_items (iclosed) · crm_apply_messages (whatsapp) · crm_apply_recordings (fathom) · crm_apply_leads (funnel)
                                 · crm_apply_contact (type contact_updated, quelle que soit la source)
                                                            │
         personne (identités) → cycle (crm_open_cycle) → appel → crm_events (on conflict do nothing)
                                                            │
                     crm_recompute_cycle(cycle touché) ──▶ colonnes dérivées, crm_stage_history, cycle_<statut>
                                                            │
                     crm_webhook_log.status = processed / unmatched / ignored (même transaction)
```

- **File** (`crm_inbox_pending`, 005) : lignes des sources demandées (les sources qui ont un mapper : `iclosed`, `whatsapp`,
  `fathom`, `funnel` ; `MAPPERS` et `APPLY` de `supabase/functions/_shared/worker.ts`), avec moins de 8 tentatives, au statut `received`, ou `failed` après un délai de 2^(tentatives − 1)
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
| `call_booked` | `crm_apply_items` ; `crm_import_calls` | iclosed / import | élément (défaut prospect) ; import : prospect / booking | entre dans l'étape `show` |
| `call_rescheduled` | `crm_apply_items` | iclosed | idem | — |
| `call_canceled` | `crm_apply_items` ; `crm_import_calls` | iclosed / import | élément ; import : system / booking | — |
| `call_recorded` | `crm_apply_recording_item` | fathom | sales / video | — |
| `call_missed` | `crm_apply_no_show_rule` | rules | system / crm | — (le statut d'appel `missed` donne la prochaine action) |
| `stage_moved` | `crm_move_cycle` (047) | manual | sales / crm (`member_id`) | aucun sur le projecteur ; lu par le tableau du Pipeline jusqu'à un événement plus récent de `crm_stage_data_types()` |
| `outcome_held`, `outcome_no_show` | `crm_declare_outcome` ; `crm_import_calls` (jusqu'à 059 seulement) ; `crm_mark_won_calls_held` (held) ; `crm_apply_no_show_rule` (no_show) | crm / import / crm / rules | sales ou system / crm | `outcome_held` entre dans l'étape `decision` |
| `outcome_yes`, `outcome_no`, `outcome_follow_up`, `outcome_disqualified` | `crm_declare_outcome` | crm | sales / crm | `outcome_yes` entre dans l'étape `cash` ; le statut se lit dans `crm_call_outcomes` |
| `note` | `crm_add_note` | crm | sales / crm | compte comme relance dans le cockpit |
| `nurture_entered` | `crm_set_nurture` ; `crm_close_before` (056) | crm | sales ou system / crm | — |
| `nurture_reactivated`, `cycle_reopened` | `crm_open_cycle` ; `crm_reopen_cycle` (045, `cycle_reopened`, source `manual`) | crm / manual | system ou sales / crm | `cycle_reopened` remet le cycle en cours |
| `cycle_won`, `cycle_lost`, `cycle_disqualified` | projecteur ; `crm_import_iclosed_disqualified`, `crm_import_calls` (jusqu'à 059), `crm_reclassify_imported` ; `crm_close_cycle` (045) ; `crm_close_before` (056, `cycle_lost`) ; `crm_refusal_tick` (055, `cycle_disqualified`) | crm / import / manual / rules | system / crm ; sales / crm pour `manual` | ceux de source `import` ferment le cycle (règle 4 du §11.5) ; `manual` et `rules` aussi (règles 5 et 6) |
| `imported` | `crm_import_people` | import | system / crm | sur la personne, sans cycle |
| `message_in`, `message_out`, `opt_out` (`phone_call_in`, `phone_call_out` acceptés mais plus reçus) | `crm_apply_message_item` | whatsapp (celle de l'élément) | élément / élément (`whatsapp` ; `member_id` = le membre dont c'est le numéro) | compteurs de tentatives et derniers contacts |
| `payment_succeeded` | `crm_add_payment` ; `crm_import_deals` de 037 / 041 (source `iclosed`, plus écrit depuis 059) | crm / iclosed | sales / payment | le premier gagne le cycle |
| `iclosed_deal` | `crm_import_deals` (059) | iclosed | system / crm (`content` = « iClosed (pour information) : vente de … € … ») | aucun ; exclu de l'instantané des SLA |
| `lead_in` | `crm_lead_item` (054, 059) | funnel | prospect / crm | aucun ; exclu de l'instantané des SLA |
| `setter_action` | `crm_setting_move` (054) | crm | sales ou system / crm | aucun ; exclu de l'instantané des SLA ; `data.action = 'appel_sans_reponse'` sert aux échéances des relances |
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
| `manual:close:<cycle>:<uuid>`, `manual:reopen:<cycle>:<uuid>`, `manual:move:<cycle>:<uuid>` (source `manual`) | `crm_close_cycle`, `crm_reopen_cycle`, `crm_move_cycle` |
| `deal:<id de la vente iClosed>` (source `iclosed`) | `crm_import_deals` de 037 / 041 |
| `deal-info:<id de la vente iClosed>` (source `iclosed`) | `crm_import_deals` (059) |
| `setting:<personne>:<action>:<epoch>` | `crm_setting_move` |
| celui de l'élément, sinon `funnel:<personne>:<epoch>` ; `manuel:<uuid>` pour un lead saisi à la main (source `funnel`) | `crm_lead_item` |
| `rules:refus_6_mois:<cycle>` (source `rules`) | `crm_refusal_tick` |
| `lost_before:<cycle>` (source `rules`) et `crm:crm_nurture_tracks:<id>:entered` | `crm_close_before` |
| celui de l'élément (`whatsapp:<wamid>` pour un message, `whatsapp:optout:<wamid>` pour un STOP ; celui du mapper pour iClosed et Fathom) | `crm_apply_items`, `crm_apply_message_item`, `crm_apply_recording_item` |

### 11.5 Le projecteur `crm_recompute_cycle` (définition finale : 055)

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
5. **Fermeture par règle ou à la main** (045) : le plus récent de ces événements — un `cycle_lost` de source `rules` (056 :
   `crm_close_before`), ou un `cycle_lost` / `cycle_disqualified` de source `manual` (045 : `crm_close_cycle`) postérieur à l'issue
   courante s'il y en a une — s'il est postérieur à la dernière réouverture → `lost` (ou `disqualified` pour un
   `cycle_disqualified`), motif `data.reason`, fermé à sa date.
6. Sinon **en cours** (`active`), sans motif ni date de fermeture.
7. **Refus de plus de 6 mois** (055) : si le statut trouvé est `lost` et qu'un `cycle_disqualified` de source `rules`
   (`crm_refusal_tick`) date de la fermeture ou d'après, et d'après la dernière réouverture → `disqualified`, motif
   `refus_6_mois`, fermé à sa date (il le reste ensuite, comme tout disqualifié).

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
rang puis enregistrement), 026 (règle du remboursement), 030 (prochaine action après un appel manqué), 034 (copie de 030),
045 (fermetures à la main), 055 (refus de plus de 6 mois). La prochaine action et les compteurs n'ont pas changé depuis 030.

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

Depuis, deux décisions ont restreint ce qui se voit : 048 (5 novembre 2026, seul un administrateur voit tous les prospects, §6.1)
et l'accès par écran de Paramètres › Accès (`app_metadata.screens`, `web/api/_screens.js`, chapitre de l'édition web). Ce qui
reste de 011 : chaque membre de l'application a une ligne `crm_members`.

### 12.4 Propriétaires d'après les hôtes (005, 015, 043)

- En direct : le propriétaire d'un nouveau cycle est le membre dont l'e-mail ou l'e-mail iClosed est l'hôte iClosed, sinon le membre
  `default_owner` (`"sales"`), sinon personne.
- Rattrapage (015) : un cycle **sans propriétaire** prend le membre actif dont l'`email` ou l'`iclosed_email` est l'hôte de son
  dernier `call_booked` (`data.host_email`) ; ses appels réservés avec cet hôte reçoivent `host_id`. Un propriétaire déjà posé
  n'est jamais changé. Relancé automatiquement pour un membre quand il est ajouté ou que son `email`, `iclosed_email` ou `active`
  change (déclencheur), de sorte qu'inviter un commercial lui donne ses prospects. Renvoie `{cycles, calls, by_member,
  still_unassigned, still_unassigned_live}`.
- Toutes les heures (043, tâche `crm-assign-owners-hourly`, minute 20) : le même rattrapage pour tous les membres, pour qu'un cycle
  ouvert sans propriétaire (réservation sur le calendrier d'un ancien commercial ou de personne) prenne le commercial dont le
  calendrier iClosed porte maintenant sa dernière réservation. Le compte d'un commercial existe dès l'invitation, confirmée ou non.

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

### 12.8 Règle d'absence (030, 032, 033, 056)

Romain, 11 novembre 2026 : « La règle d'absence, c'est de ne pas venir au R2 » ; l'appel de setting (15 minutes, par le setter)
n'est jamais une réservation iClosed, donc jamais une ligne `crm_calls` : la règle lit les réservations iClosed (le R2 du cycle de
vente et les suivantes, numérotées R1, R2… dans la base).

- **Appel complet** (`crm_call_complete`, 030) : un enregistrement Fathom (`recorded_by`, début et fin) d'au moins
  `no_show_rule.min_minutes` minutes (**30** depuis 033 ; 7 en 030 ; 7 si le réglage manque), **ou** une transcription ajoutée à la
  main (`transcript_raw` non vide et `transcript_source` différent de `fathom`). Un enregistrement de 30 minutes ou plus rend l'appel
  honoré tout de suite (025) et l'issue reste à déclarer par le commercial.
- **Règle** (`crm_apply_no_show_rule`, définition finale 056) : pour chaque cycle non gagné ayant un appel depuis
  `no_show_rule.since`, appels parcourus dans l'ordre de numérotation. Un appel complet marque « déjà vu ». Depuis 056, un appel
  n'est jugé que si **personne n'a donné sa présence** : statut encore `scheduled` ou `outcome_pending` (iClosed n'a rien dit),
  **aucun enregistrement** (ni `recorded_by` ni `recording_start` : un enregistrement court est laissé au commercial), début
  ≥ `since`, `grace_hours` (3) passées après sa fin, aucune issue courante déclarée, et (032) aucun enregistrement encore ambigu
  qui puisse être le sien (`crm_call_has_ambiguous_recording`). Alors :
  - aucun appel complet avant lui (première réservation du cycle) → statut `no_show` + événement `outcome_no_show` (source
    `rules`, `data {rule: 'no_fathom_recording', min_minutes}`) ;
  - un appel complet avant lui → statut `missed` + événement `call_missed` ; le prospect reste dans son tour et la prochaine action
    devient « Replanifier l'appel ».
  - Les cycles touchés sont recalculés. Sans `since`, la fonction renvoie une erreur et ne fait rien.
- **Lancement** : toutes les heures à la minute 35 (`crm_no_show_tick`), seulement si `no_show_rule.enabled`. **056 l'allume**
  (`since` = `2026-10-27T00:00:00+01:00`, `min_minutes` 30, `grace_hours` 3, `enabled` vrai), y compris sur une base neuve.
- **Un enregistrement complet tardif l'emporte** (déclencheur `crm_calls_recorded`) : un appel `no_show` ou `missed` qui devient
  complet sans issue déclarée repasse `held`, l'événement `noshow:<appel>` est supprimé et le cycle recalculé.
- 032 a remis en `scheduled` les absences posées par la règle sur un appel qu'un enregistrement ambigu peut couvrir.
- Pas encore : l'absence de réponse aux messages WhatsApp (WhatsApp n'est pas branché, en-tête de 056).

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

### 12.15 Imports (007, 008, 009, 059)

- **`crm_import_people`** : une personne par contact, retrouvée par n'importe quel identifiant (e-mails, téléphones,
  `close_contact_id`, `iclosed_contact_id`) ; aucun identifiant → `skipped` ; plusieurs personnes → `conflicts` ; sinon création ou
  complément du nom. Le statut et les opportunités du contact sont gardés dans un événement `imported` sur la personne (mis à jour
  à chaque import). Aucun cycle n'est créé (il faudrait d'abord la table de correspondance `close_status_map`, jamais créée).
  Lancé toutes les heures pour iClosed (`crm-iclosed-contacts-hourly`, 039).
- **`crm_import_iclosed_disqualified`** : chaque personne importée d'iClosed au statut `DISQUALIFIED` et **sans cycle** reçoit un
  cycle fermé `disqualified` (motif `dq_off_target`, ouvert et fermé à la date de l'import) avec un `cycle_disqualified` de source
  `import`. Manuel ; contraire à la règle de 059 (le statut iClosed est ignoré) : ne plus le lancer.
- **`crm_import_calls`** (définition finale 059, lancé toutes les heures par `crm-iclosed-calls-hourly`, 039) : par personne
  (e-mails, téléphones E.164, `iclosed_contact_id` ; aucun identifiant ou aucun appel → `skipped` ; plusieurs personnes →
  `conflicts`), ses appels iClosed. Cycle = celui qui contient déjà l'un de ces appels, sinon le dernier de la personne, sinon un
  nouveau ouvert au premier rendez-vous (propriétaire d'après l'hôte du premier appel) ; `opened_at` est ramené au plus ancien.
  Chaque appel inconnu devient un appel avec ses vraies dates, au statut `canceled` s'il est annulé et **`scheduled` sinon**, un
  `call_booked` (acteur `prospect`, `data` avec `start`, `end`, `host_email`), plus un `call_canceled` s'il est annulé. **Depuis
  059, iClosed ne donne plus ni présence ni issue (`outcome_held` / `outcome_no_show`), et ne ferme plus aucun cycle** : la
  fonction se contente de recalculer le cycle. Un appel déjà connu est laissé tel quel (`calls_known`). Les personnes sans aucun
  appel n'ont pas de cycle (vue `crm_people_without_cycle`). Avant 059 (009) : statut traduit, `outcome_*`, fermeture importée
  `import:close:<cycle>` quand aucun appel n'était à venir.

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

### 12.18 Quels appels sont analysés (020, 025, 062)

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
- `crm_ca_board` (062) liste et numérote les appels de la fiche d'un lead avec exactement la même règle (avant 062, il comptait tous
  les appels non annulés, absences comprises : un R1 honoré après deux absences devenait « R3 » et son analyse était cachée).

### 12.19 Chiffres du Cockpit commercial (016 → 019, 032, 033, 036 → 041, 060)

`crm_sales_cockpit()` (définition finale 060) décide une fois ce que l'appelant voit (tous les cycles si `crm_sees_all()`, c'est-à-dire
un administrateur, sinon les siens) puis renvoie :

```
{ generated_at, periods: {"7": {now, base}, "30": {…}, "56": {…}}, team: {"7": [{id, name, figures}], …},
  weekly: [8 fenêtres d'une semaine, la plus ancienne d'abord], pipeline, aov_180, alerts: [{c, o, imp, t, obj, at}],
  has_payments, has_deals }
```

- **Périodes** : 7, 30 et 56 jours avant maintenant ; `base` = la même durée juste avant (référence).
- **Équipe** (036, 039, 040) : les cycles visibles regroupés par commercial. Le commercial d'un cycle = clé de son propriétaire,
  sinon (040) la partie locale de l'enregistreur Fathom de son dernier appel enregistré jusqu'au jour de sa clôture (heure de Paris :
  un appel d'accueil après la vente n'est pas la vente), sinon la partie locale de l'hôte du dernier `call_booked`. Seules les clés
  d'une ligne **active** de `crm_sales_team` ont une ligne, groupées par `name` (une personne à plusieurs adresses = une ligne) ; une
  ligne n'apparaît que si le commercial a eu une activité dans la période (réservation, appel honoré, absent ou sans issue, vente,
  montant signé ou encaissé). Les cycles des autres comptent dans les totaux.
- **Panier moyen 180 j** (`aov_180`) : moyenne des montants signés > 0 des ventes dont le « oui » date de moins de 180 jours.
- **Pipeline pondéré** : pour chaque cycle en cours visible, (montant de sa vente s'il est > 0, sinon `aov_180`) × taux de
  conversion observé de son étape = part de gagnés parmi les cycles fermés depuis 180 jours dont l'étape courante est à cette
  position ou au-delà.
- **Encaissements à risque** (`alerts`, 60 au plus, triés par valeur puis date) : les alertes ouvertes visibles de `crm_alerts`
  (table jamais remplie, §7.9), puis les cycles en cours dont `next_move.due_at` est passé et qui n'ont pas d'alerte ouverte (titre =
  libellé de la prochaine action + « · en retard », objet = nom · libellé de l'étape) ; valeur = montant ou `aov_180` × max(taux de
  l'étape, 0,05). `crm_sla_alerts` n'y est pas lue.
- `has_payments`, `has_deals` : ce que le CRM ne peut pas encore mesurer.

**Fenêtre** `crm_sales_cockpit_window` (définition finale 041), sur `[p_from, p_to)` et les cycles donnés, **sans les fiches de
test** (`crm_person_internal`, 039) :

| Clé | Calcul |
|---|---|
| `leads` | personnes non fusionnées, hors fiches de test, dont `first_seen_at` est dans la fenêtre (toutes si l'appelant voit tout et que la fenêtre porte sur tous les cycles ; sinon seulement celles des cycles donnés) |
| `booked` | (036) personnes de la fenêtre (`first_seen_at`) qui ont réservé au moins un appel, à n'importe quelle date : « RDV pris » ne dépasse jamais « Prospects » |
| `held` | (039) = `shown_leads` : les prospects présents à leur R1 |
| `no_show` | appels `no_show` dont le début est dans la fenêtre |
| `no_outcome` | appels de la fenêtre encore `scheduled` alors que leur début est passé |
| `shown_leads`, `no_show_leads`, `pending_leads` | (038, 039) sur les cycles qui ont un **R1** (`rank = 1`) dû dans la fenêtre (début passé ; un cycle dont tous les R1 sont annulés est écarté) : présent = cycle gagné, ou un R1 `held` ou complet (`crm_call_complete`) ; en attente = aucun R1 `no_show` et chaque R1 annulé ou encore `scheduled` depuis moins de `show_pending_hours` (48) ; absent = les autres |
| `won` | cycles gagnés dont `closed_at` est dans la fenêtre |
| `signed`, `deals` | somme des montants signés et nombre de ventes avec montant > 0 dont `yes_at` est dans la fenêtre |
| `collected`, `remaining` | (041) ce que ces ventes ont rapporté à ce jour (`crm_deal_collected` : échéances dues pour un plan `auto`, paiements nets sinon) ; `remaining = signed − collected` |
| `received`, `refunded`, `cash` | (041) échéances dues dans la fenêtre (et déjà passées) des plans `auto`, plus les paiements reçus dans la fenêtre des autres ventes ; remboursements de ces paiements ; `cash = received − refunded` |
| `follow_total`, `follow_done` | (039) premiers R1 honorés de la fenêtre ; ceux suivis dans les 24 h après leur fin par un `message_out` d'un commercial, une `note` ou un `outcome_*` |
| `days_per_stage` | médiane (en jours, une décimale) des durées des passages d'étape sortis dans la fenêtre |

Les ratios (taux de présence, de conversion, revenu par appel, part payée à la signature…) sont calculés par l'écran à partir de ces
comptes ; leurs définitions sont rappelées en tête de `016_crm_sales_cockpit.sql`.

### 12.20 SLA du cycle de vente (028, 044, 053, 054, 059)

Toutes les 5 minutes, `sla-tick` lit `crm_sla_snapshot(60)` : les cycles **en cours** dont le dernier événement (ou l'ouverture) date
de moins de 60 jours, avec `id`, `opened_at`, `person` (nom), `owner`, `owner_key`, leurs événements des 60 derniers jours (`type`,
`at`, `actor`, `channel`, `call_id`, `source` — jamais le texte d'un message ; sans `setter_action`, `lead_in` ni `iclosed_deal`) et
leurs appels (`id`, `rank`, `status`, `start`, `end`). Il lit aussi `crm_setting_snapshot()` (leads suivis par un setter, alertes
SE) et `crm_sla_settings()` (`sla_alerts` + `sla_rules`). Les règles elles-mêmes sont dans
`supabase/functions/_shared/sla_rules.js` (même fichier que l'écran Cycle de vente et le catalogue de Paramètres › Alertes ; 52
règles : SH ×12, DE ×9, CA ×7, CO ×5, CL ×4, DO ×5, SE ×10). Avec ces dépassements, `sla-tick` :
1. ouvre, fait monter et ferme les alertes du CRM par `crm_sync_sla_alerts` (§12.25) ;
2. copie dans Slack, seulement pour les règles marquées `slack` (éteint par défaut) et si `SLACK_SALES_CYCLE_WEBHOOK_URL` existe, les
   dépassements « en retard » ou « critiques » franchis après `sla_alerts.since` et depuis moins de `max_age_hours`, après les avoir
   réclamés par `crm_sla_claim` (seules les clés qui n'existaient pas reviennent, `crm_sla_notices`).

Réglages (`crm_settings.sla_rules`, 044) : `{sources: {messages, whop, analysis}, rules: {"SH-2": {on, warn, late, crit, app, slack},
…}}`. Une source débranchée (toutes le sont par défaut : le 5 novembre 2026, aucun message WhatsApp, aucun lien Whop, aucune analyse
automatique n'arrivait, et chaque lead était « Critique ») éteint les règles qui en ont besoin.

### 12.21 Cockpit commercial › Exécution, Qualité, Impact (050, 060)

`crm_sales_execution(p_days, p_owner)` (définition finale 060) rend, sur les cycles visibles (hors fiches de test) et la période
`now() − p_days` :
- `rules` : `won` = premier paiement dans les 14 jours après la fin du premier appel tenu ; `qualified` = qualification LNP (la plus
  récente du cycle dans `crm_lead_qualifications` : `SQL GAGNÉ`, `SQL OUVERT`, `SQL PERDU` = qualifié, `NON SQL` = non qualifié ;
  sinon « non disqualifié ») ; `indicative_below` = 20 (l'écran marque « indicatif » un taux sur moins de 20 prospects) ;
- `sources` (060) : `crm_settings.sla_rules.sources` (sans messages, l'écran dit « non mesuré » au lieu de 0 %) ;
- `cohort` : `{held, qualified, qual_read, matured, won14}` ; la cohorte « appels tenus » est **le premier appel tenu du cycle**,
  gardé s'il tombe dans la période (060 ; avant, le premier tenu de la période, souvent un R2 ou un appel d'après-vente) ; un
  paiement compte s'il suit cet appel ; « mûr » = fin d'appel il y a plus de 14 jours ;
- `delays` : une ligne par délai `{id, label, rule, target, unit, n, met, median, impact {met_n, met_won, miss_n, miss_won}}` :
  `speed_to_lead` (SH-2, 5 min après la première réservation), `r1_within_48h` (SH-3, 48 h), `noshow_contact` (SH-8, 15 min),
  `noshow_rebook` (SH-9, 24 h), `outcome_declared` (SH-11, 15 min), `recap_60` (DE-1, 60 min), `call_after_r1` (bonne pratique,
  72 h), `decision_72` (DE-9, 72 h), `yes_to_payment` (CA-2, 24 h), `handover_2h` (CA-6, 2 h), `reply_15` (CO-1, 15 min, réponse
  dans la plage 8 h – 22 h heure de Paris) ; un contact commercial = `message_out`, `email_out` ou `phone_call_out` d'acteur `sales` ;
- `reactivation` : absences (`no_show`) et échecs de vente (appel tenu, qualifié, sans paiement en 14 jours) : contactés, reprogrammés,
  réactivés, gagnés ensuite ;
- `interactions` : contacts après l'appel par tranche, appel téléphonique ou non, réponse du prospect, délai de réponse, avec le
  nombre de ventes ;
- `quality` : appels tenus, issues déclarées, enregistrés ; moyennes de la dernière analyse (`SPIN`, `OBJECTIONS`, écart présent,
  pitch conforme) ; `references_missing` (aucune offre ou aucun cas actif dans `crm_ca_offer` / `crm_ca_cases`) ; portes `metier`,
  `financement`, `decision_timing` (`OUVERTE`, `FERMÉE`, autre) ; verdicts ; motifs de perte et de disqualification de la période.
Impact = corrélation, jamais preuve (en-tête de 050).

### 12.22 Ventes iClosed : de la vente au montant pour information (037, 041, 059)

- **037 → 041** (3 et 4 novembre 2026) : chaque vente iClosed (`GET /v1/deals`) devenait la vente du cycle (`crm_deals`, une par
  cycle, `iclosed_deal_ids`), un paiement `source = 'iclosed'` (`method` `won` ou `deposit`) et un `payment_succeeded`
  (`deal:<id>`), donc un cycle gagné ; 041 déduisait le prix de l'offre et ses échéances du montant saisi (`crm_plan_for_amount`) :
  le total d'un plan de `offer_catalogue`, sinon une échéance d'un plan à plusieurs échéances (la première payée), sinon un acompte
  sur l'offre par défaut (`to_check`, total = max(montant, 3 000 €)). Un montant saisi à la main n'était jamais écrasé
  (`manual_deal_kept`) ; un plan modifié à la main devient `plan_source = 'manual'` (déclencheur).
- **Depuis 059** (Romain, 11 novembre 2026 : « C'est le status du CRM LNP qui est source de vérité ») : `crm_import_deals` n'écrit
  plus qu'un événement `iclosed_deal` par vente (`deal-info:<id>`, `content` « iClosed (pour information) : vente | acompte de N € ·
  produit · le statut et les paiements se gèrent dans le CRM », `data {amount, kind, product, iclosed_deal_id}`) sur le cycle de
  l'appel iClosed (`eventCallId`), sinon le dernier cycle de la personne (`iclosed_contact_id`) ; sans cycle → `unmatched`. Rien
  n'arrête ni ne démarre une alerte (exclu de l'instantané). Les paiements viennent de Whop ou de la fenêtre d'encaissement.
- `crm_apply_auto_plans`, `crm_deal_collected`, `crm_plan_for_amount` restent : ils servent aux ventes iClosed déjà importées
  (`plan_source = 'auto'`) et à l'encaissé du cockpit.

### 12.23 Déplacer un lead dans le Pipeline (045, 047)

Un déplacement qui est une issue passe par `crm_declare_outcome`. Les autres :
- **Clore** (`crm_close_cycle`) un lead sans appel à déclarer : perdu ou disqualifié avec un motif de la liste ; une issue déclarée
  ensuite, ou une réouverture, l'emporte (règle 5 du §11.5).
- **Rouvrir** (`crm_reopen_cycle`) un lead perdu ou disqualifié ; jamais un lead gagné.
- **Déplacer** (`crm_move_cycle`, colonnes `r1`, `r2`, `r3`, `longfu` ; sinon « Colonne non déplaçable à la main ») un lead en cours
  (sinon « Ce prospect est clos : rouvrez-le d'abord »). Le tour courant = max(rang du dernier appel non annulé, dernier
  `stage_moved` vers `rN` encore valable — postérieur au dernier événement de `crm_stage_data_types()`), plafonné à 3. Refus : revenir
  à un tour déjà atteint (« Ce prospect est déjà en R… : il ne revient pas en R… »), sauter un tour (« Un prospect passe par chaque
  tour »), passer au tour suivant avec une issue à déclarer, un appel à venir, ou un tour courant non honoré. `longfu` (Relance
  longue) n'a pas de contrôle. Le déplacement est gardé comme `stage_moved` ; le tableau le montre jusqu'à ce que des données plus
  récentes sur les appels disent où est le lead.

### 12.24 Le suivi du setter (054, 059)

Statuts (`crm_people.setting_status`) : ouverts `a_contacter`, `relance`, `qualification`, `rdv_a_confirmer`,
`appel_confirmation`, `rdv_pose`, `rdv_confirme`, `reconfirmation`, `a_replanifier`, `absent_rattrapage` ; en attente (059)
`webinaire_absent`, `absent_attente` ; terminés `transmis`, `injoignable`, `non_qualifie`.

**Échéance de l'action** (`crm_setting_due`, définition finale 059 ; plages de `setting.coverage`, heure de Paris) :

| Statut | Échéance |
|---|---|
| `a_contacter` | première heure couverte + 5 min |
| `relance` | depuis le premier appel sans réponse : tentative 1 → +2 h ; 2 → max(+3 h, 21 h − 2 h) ; 3 → J+1 17 h ; 4 → J+2 17 h ; au-delà → J+4 17 h, ramené à une heure couverte ; quiz abandonné : +24 h |
| `qualification`, `a_replanifier` | fin de journée (21 h ; le lendemain après 19 h) |
| `rdv_a_confirmer` | +1 h |
| `appel_confirmation` | l'échéance déjà posée, sinon +1 h |
| `rdv_pose` | max(+1 h, RDV − 24 h) ; rien sans RDV à venir |
| `reconfirmation` | min(+4 h, RDV − 2 h) |
| `absent_rattrapage` | +15 min |
| `webinaire_absent` / `absent_attente` | +48 h / +24 h |
| autres | aucune |

**Actions du setter** (`crm_setter_action`) : `appel_sans_reponse` (+1 tentative ; `a_contacter` / `relance` → `relance`, ou
`injoignable` à `setting.max_attempts` = 6, `abandon_attempts` = 2 pour un quiz abandonné), `msg_relance`, `msg_confirmation`
(`rdv_a_confirmer` → `appel_confirmation`), `joint` (→ `qualification`), `rdv_pose` (→ `rdv_pose`), `non_qualifie`, `ok_recu` et
`confirmation_faite` (→ `rdv_confirme`), `rappel_j1`, `sans_ok_j1` (→ `reconfirmation`), `rappel_h2`, `annule` (→ `a_replanifier`),
`injoignable`, `relancer` (`injoignable` / `non_qualifie` → `a_contacter`, tentatives à 0), `note`. Chaque action est un
`setter_action` dans le fil du prospect.

**iClosed fait avancer le statut seul** (déclencheur `crm_setting_on_call`, R1 seulement, jamais un appel de plus de 2 jours) : R1
réservé → `rdv_a_confirmer` (ou `rdv_pose` si le setter a posé le RDV dans les 3 h, ou déjà `rdv_pose` / `rdv_confirme`) ; absent →
`absent_rattrapage` ; tenu → `transmis` (« RDV tenu · au commercial », depuis 059 seulement pour un lead qui a un statut setter) ; annulé sans autre RDV → `a_replanifier` ; déplacé →
`rdv_a_confirmer`. Un lead webinaire (059) qui réserve seul va directement au commercial (statut effacé) ; absent à son RDV de vente,
il attend une réponse 24 h (`absent_attente`).

**Entrée d'un lead** (`crm_lead_item`, définition finale 059 ; élément `{source_id, occurred_at, identity {email, phone, name},
data {source, booked, attended, answers}}`) : personne retrouvée par ses identifiants (plusieurs → `P0M02`, non rattaché), sinon
créée (identités de source `funnel`) ; `lead_source` et `quiz` gardés ; setter = celui qui saisit s'il est setter, sinon
`crm_pick_setter()` (pas de setter pour un lead webinaire tant qu'il ne passe pas au setter) ; événement `lead_in` « Lead reçu :
quiz complété | opt-in VSL | quiz abandonné | webinaire… | saisi à la main » (une livraison rejouée ne fait rien). Un lead sans statut
(ou injoignable, non qualifié, webinaire absent) devient `a_contacter`, sauf : avec RDV (il va au commercial) ; webinaire absent →
`webinaire_absent` (attente d'une réponse 48 h). `crm_setting_tick` (toutes les 10 min) : une réponse du prospect (`message_in`)
efface le statut d'attente ; sinon, le délai passé, `webinaire_absent` → `a_contacter`, `absent_attente` → `absent_rattrapage`, avec
un setter.

### 12.25 Le centre d'alertes (053, 054)

`crm_sync_sla_alerts(p_items)` reçoit **tous** les dépassements ouverts à cet instant (`{key, cycle_id, person_id, owner_id, sla,
kind, level, name, detail, target, started_at, crossed_at}`) :
- une alerte ouverte de même clé change de niveau, de propriétaire ou de cycle → mise à jour ; une clé nouvelle → nouvelle alerte
  (une alerte sans personne est sautée) ; `owner_id` donné par l'élément (le setter pour une alerte SE), sinon le propriétaire du
  cycle ;
- une alerte ouverte absente de la liste → fermée `done` (le SLA s'est arrêté : l'action est faite) ;
- une alerte d'un cycle qui n'est plus en cours → fermée `closed`.
Un commercial voit les alertes dont il est `owner_id` (jamais les techniques), un administrateur toutes. Les alertes se traitent
dans Cycle de vente › « Agir maintenant ».

### 12.26 Relance après refus, puis disqualifié après 6 mois (055)

Un refus d'achat clôt le cycle en `lost` (« Clos » dans Cycle de vente, branche « Relance après refus »). Chaque jour à 3 h 17 UTC,
`crm_refusal_tick` passe en `disqualified` (événement `cycle_disqualified`, source `rules`, motif `refus_6_mois`, `data.after_days`)
chaque cycle perdu depuis plus de `crm_rules.nurture_cadence.params.archive_after_days` (182) jours, dont le motif n'est ni
`refunded` ni `unreachable`, qui a eu un appel `held` avant sa clôture (un « non » après un appel tenu) et dont la personne n'a pas
ouvert de cycle plus récent. Puis recalcul : le projecteur garde le disqualifié (règle 7 du §11.5) sauf réouverture plus récente.

### 12.27 Leads ouverts avant le 27 octobre 2026 (056)

`crm_close_before(p_before, p_dry)`, lancée une fois par 056 avec `2026-10-27T00:00:00+01:00` : chaque cycle en cours ouvert avant
cette date, sans réservation non annulée depuis et sans paiement `paid`, reçoit un `cycle_lost` (source `rules`, `data {reason:
'timing', rule: 'open_before', before}`, `lost_before:<cycle>`) et, si la personne n'est ni en maturation ni désinscrite, un suivi
long terme `standard` (motif `timing`) avec `nurture_entered`, comme un « non » avec « Mettre en suivi long terme ». Les gagnés ne
sont pas touchés. Sur une base vide, rien.

### 12.28 Score d'entraînement (049)

Sur 100, moyenne de trois parts sur 100 (un entraînement jamais fait compte 0) : « Le coup suivant » = coups justes parmi les 50
derniers, sur 50 ; « La lettre imposée » = questions valides parmi les 20 derniers cas, sur 60 ; Maîtrise de l'offre = la meilleure
note de chacun des 100 cas, additionnées, sur 1 000 (un cas est « validé » à 8 sur 10 ou plus). La période compte les exercices, le
temps et le taux de réussite par module ; les ventes de la période (`sales`) viennent de la fenêtre du cockpit sur les cycles dont
la personne est propriétaire (`calls` = appels honorés ou complets).

### 12.29 Simulateur (057, 058, 061)

Toutes les règles du Simulateur (prospect, état, analyse sur 100, variantes, réalisme) sont dans le code TypeScript
(`supabase/functions/_shared/simulateur/`, chapitre des intégrations). La base garde : l'offre et ses prospects, chaque simulation et
ses répliques, la note de la personne (une par simulation), l'analyse de fin d'appel (une par simulation ; au-delà de
`crm_sim_config.daily_analysis_limit` par jour elle est `deferred`, et `crm-simulateur-balayer` la relance toutes les 10 minutes dans
la limite du plafond, et clôt en échec celles bloquées depuis 30 minutes), la mesure de réalisme (`usage.realisme`) et la variante
du jour (`persona_data.variante`), rendues par `crm_sim_history` (061).

### 12.30 Qualification du lead (042, 046)

Chaque R1 analysé est qualifié par le worker de l'analyse d'appel (règles de `call-analysis/qualification` : le modèle extrait les
faits en deux lectures, le code applique la règle des portes et décide) et gardé dans `crm_lead_qualifications` avec son travail
d'analyse. La qualification courante d'un appel est la plus récente ; dans la fiche d'analyse, celle faite avec ce travail l'emporte.
Rien ici ne met une analyse en file.

### 12.31 Corriger une lettre de l'analyse (063)

Un administrateur choisit la lettre d'une question de la découverte (`S`, `P`, `I`, `N` ou hors découverte) dans le panneau de la
question ; `crm_ca_correct` garde la correction (lettre du moteur, lettre choisie, raison, auteur, date). L'écran montre la lettre
corrigée en pointillés et celle du moteur en infobulle ; la note n'est pas recalculée (C8).

### 12.32 Le CRM, seule source de vérité des statuts (059)

D'iClosed, la base garde : le lead (nom, e-mail, téléphone : `crm_apply_items`, `crm_apply_contact`, `crm_import_people`), la date et
l'heure de chaque RDV, ses déplacements et annulations (`crm_apply_items`, `crm_import_calls`), le montant d'une vente pour
information (`crm_import_deals`). Elle ignore : honoré, absent, gagné, perdu, disqualifié, et les paiements iClosed. L'historique
déjà importé reste tel quel. Une présence vient de Fathom (§12.7), d'une issue déclarée, ou de la règle d'absence (§12.8).

---

## 13. Réglages `crm_settings`

Dix-sept clés, les mêmes qu'en production (relevé du 27 novembre 2026). Seize sont posées par les migrations (`on conflict do
nothing` : une valeur déjà là n'est pas écrasée, sauf mention) ; `functions_url` se pose à la main.

| Clé | Posée par | Valeur par défaut | Sens | Lue par |
|---|---|---|---|---|
| `alert_rule_defaults` | 003 | Tableau des règles c1 à c18 : `{id, name, severity, threshold, to}` (noms français ; seuils : c1 `after_minutes` 0, c2 `hours` 2, c3 `silence_hours` 48, c4 `hours` 2, c5/c6 étapes, c7 `hours` 48, c13 `silence_days` 30 / `attempts_below` 4, c14 `notice_hours` 24, c16 `after_hours` 2, c17 `iclosed_hours` 6 / `whatsapp_hours` 6 / `fathom_missed_calls` 2) | Définitions par défaut de l'ancien catalogue d'alertes du CRM | `crm_merge_alert_defaults` seulement |
| `team_email_domains` | 003 | `["lesnouveauxprofs.fr"]` | Domaines internes (invités internes / externes) | Aucun code (`internal_domains` sert à sa place) |
| `default_owner` | 003 | `"sales"` | Clé du membre propriétaire quand l'hôte iClosed est inconnu | `crm_owner_for` |
| `whop_plans` | 003 | `{}` | Produit → identifiant de plan Whop | Aucun code |
| `analysis_model` | 003 | `"claude-sonnet-5-5"` | Modèle d'analyse (ancien) | Aucun code (le moteur lit `crm_ca_config.tiers`) |
| `nurture_sending_enabled` | 003 | `false` | Envoi des messages de maturation (attend l'accord juridique) | Aucun code |
| `nurture_templates` | 003 | `[]` | Modèles de messages de maturation | Aucun code |
| `functions_url` | à la main (§3) | — | Adresse de base des Edge Functions, par exemple `https://<ref>.supabase.co/functions/v1` | Les 7 tâches pg_cron qui passent par HTTP (§14) |
| `fathom_match_minutes` | 025 | `90` | Fenêtre FL-2 (b) et FL-4 autour du début de l'enregistrement | `crm_fathom_person`, `crm_apply_recording_item`, `crm_call_has_ambiguous_recording` |
| `sla_alerts` | 028, 051 | `{since: <moment de la migration>, channel: "#sales-cycle", max_age_hours: 6, window_tz: "Europe/Paris"}` (`is_proposal = true`) | Copie Slack : rien d'antérieur à `since` ni de plus vieux que `max_age_hours` n'est posté ; fuseau des plages (8 h – 22 h du commercial, heures d'envoi). 028 écrit déjà `Europe/Paris` ; 051 corrige une base qui avait `America/New_York` | `crm_sla_settings` → `sla-tick` |
| `no_show_rule` | 030, 033, 056 | 030 : `{enabled: false, min_minutes: 7, grace_hours: 3, since: null}` ; 033 : `min_minutes` 30 ; **056 (écrase à chaque passage)** : `since: "2026-10-27T00:00:00+01:00"`, `min_minutes: 30`, `grace_hours: 3`, `enabled: true` | Règle d'absence (§12.8) | `crm_no_show_setting`, `crm_no_show_tick`, `crm_call_complete`, `crm_apply_no_show_rule` |
| `fathom_close_minutes` | 032 | `15` | Écart maximal pour `booking_closest` / `booking_declared` | `crm_fathom_person` |
| `internal_domains` | 039 | `["lesnouveauxprofs.fr"]` | Les e-mails de ces domaines sont des fiches de test de l'équipe : jamais comptées | `crm_person_internal` |
| `show_pending_hours` | 039 | `48` | Un R1 sans issue reste « en attente » ce nombre d'heures avant de compter comme absent (cockpit) | `crm_show_pending_hours` |
| `offer_catalogue` | 041 | `{observed, default: {offer: "Accompagnement 4 mois", total: 3000}, plans: [...]}` : Accompagnement 4 mois 3 000 € en une fois, 2 × 1 600 € (3 200), 3 × 1 100 € (3 300), 4 × 850 € (3 400) ; Starter Solo 1 490 € ou 4 × 397 € (1 588) ; Mentorat 5 490 € ; anciennes offres LNP 2100 (4 × 525 €) et Cours particuliers 2.0 (1 497 €), `older: true` | Les offres de LNP et leurs plans, pour reconnaître le prix d'une vente saisie dans iClosed. À modifier quand un prix change | `crm_plan_for_amount` |
| `sla_rules` | 044 | `{sources: {messages: false, whop: false, analysis: false}, rules: {}}` (`is_proposal = false`) | Réglages des SLA de Paramètres › Alertes : sources branchées, par règle `on`, `warn`, `late`, `crit` (heures ; DE-8 : appels), `app`, `slack` | `crm_sla_settings` (`sla-tick`), `crm_sales_execution` (`sources`), l'écran Cycle de vente (`app/crm/data.js`), `web/api/_os.js`, écrit par `crm_save_sla_rules` |
| `setting` | 054 | `{coverage: {"1"…"5": [["12:00","13:30"],["17:00","20:00"]], "6": [["09:00","12:00"]]}, max_attempts: 6, abandon_attempts: 2, default_setter: null}` (`is_proposal = true` ; dimanche sans plage) | Heures de couverture du setter (heure de Paris, lundi = 1), tentatives avant « injoignable » (quiz abandonné : `abandon_attempts`), setter par défaut | `crm_setting_open_at`, `crm_setter_action`, `crm_pick_setter` |

`close_status_map` est cité par 007 comme futur réglage mais n'est jamais créé ni lu.

---

## 14. Tâches planifiées (pg_cron)

Onze tâches, les mêmes qu'en production (`cron.job`, relevé du 27 novembre 2026). Chaque fichier supprime la tâche de même nom
puis la recrée ; les tâches HTTP passent par `pg_net`, ne partent que si `crm_settings.functions_url` existe et appellent la
fonction Edge sans jeton (les fonctions ont `verify_jwt = false`, chacune vérifie son entrée ; ces points d'entrée ne prennent rien
en entrée).

| Nom | Planning (UTC) | Action | Condition / délai | Fichier final |
|---|---|---|---|---|
| `crm-process-inbox` | `* * * * *` (chaque minute) | `POST <functions_url>/process-inbox`, corps `{}` | seulement s'il existe une ligne `iclosed`, `whatsapp`, `fathom` ou `funnel` au statut `received` ou `failed` avec moins de 8 tentatives ; délai 30 s | 054 (006 : `sendblue` ; 052 : `whatsapp`) |
| `crm-sla-tick` | `*/5 * * * *` | `POST <functions_url>/sla-tick` | délai 60 s | 006 |
| `crm-setting-tick` | `*/10 * * * *` | `select public.crm_setting_tick()` en SQL direct | leads webinaire en attente (§12.24) | 059 |
| `crm-simulateur-balayer` | `*/10 * * * *` | `POST <functions_url>/simulateur/balayer` | seulement s'il existe une analyse `deferred` ou `processing` ; délai 60 s | 057 |
| `crm-iclosed-contacts-hourly` | `3 * * * *` | `POST <functions_url>/crm-import?source=iclosed` | contacts iClosed ; délai 150 s | 039 |
| `crm-iclosed-calls-hourly` | `15 * * * *` | `POST <functions_url>/crm-import?source=iclosed_calls` | appels iClosed (dates seulement depuis 059) ; délai 150 s | 039 |
| `crm-assign-owners-hourly` | `20 * * * *` | `select public.crm_assign_owners_from_hosts(false)` en SQL direct | §12.4 | 043 |
| `crm-fathom-hourly` | `23 * * * *` | `POST <functions_url>/crm-import?source=fathom&queue=1` | enregistrements des deux derniers jours, analyses R1/R2 mises en file ; un import déjà en cours fait sauter l'heure ; demande `FATHOM_API_KEY` ; délai 120 s | 006 |
| `crm-no-show-hourly` | `35 * * * *` (après l'import Fathom) | `select public.crm_no_show_tick()` en SQL direct | ne fait rien tant que `no_show_rule.enabled` est faux (056 l'allume) | 006 |
| `crm-iclosed-deals-hourly` | `41 * * * *` | `POST <functions_url>/crm-import?source=iclosed_deals` | ventes iClosed (pour information depuis 059) ; délai 120 s | 037 |
| `crm-refusal-daily` | `17 3 * * *` (3 h 17 UTC) | `select public.crm_refusal_tick()` en SQL direct | §12.26 | 055 |

L'ancienne tâche `crm-fathom-nightly` est supprimée par 006 si elle existe. 006 installe `pg_net` et `pg_cron` et planifie sans
condition (c'est pourquoi les tests ne l'appliquent jamais) ; les autres fichiers ne planifient que si `pg_cron` est là : 037,
039, 043, 055 et 059 testent l'extension (`pg_extension where extname = 'pg_cron'`), 052, 054 et 057 le schéma `cron`. En local
(tests), aucune tâche n'est donc planifiée.

---

## 15. Tests SQL

### 15.1 Lancer

```bash
PGHOST=/tmp PGPORT=5432 PGUSER=postgres web/supabase/tests/run.sh
```

Il faut `psql` et un Postgres local dont l'utilisateur peut créer des bases et des rôles (aucun projet Supabase n'est touché ; la CI,
`.github/workflows/crm-functions.yml`, tâche `sql`, utilise `postgres:16` puis lance aussi `node app/crm/data.test.js`). Le script
crée une base jetable `lnp_crm_test_<pid>`, la supprime à la sortie, et s'arrête à la première erreur (`ON_ERROR_STOP`, message
d'erreur affiché). Chaque suite affiche une dernière ligne de réussite (« … SQL checks: all passed », ou « … ok » pour
`iclosed_deals_test`, `simulateur_test` et `simulateur_offre_lnp_test`).

Déroulé (`web/supabase/tests/run.sh`) :
1. `tests/supabase_stub.sql` (rôles `anon`, `authenticated`, `service_role` ; schéma `auth`, `auth.users`, `auth.uid()` lu dans le
   réglage `request.jwt.claim.sub` que les tests changent ; privilèges par défaut sur les tables et séquences ; publication
   `supabase_realtime`), `001_init.sql`, puis une simulation de la phase 0 (`event_source`, `inbox_status`, `crm_webhook_log` créés
   avant 003), `003`, `004` deux fois, `005`, `004` encore → **`crm_phase1_test.sql`**.
2. Base neuve : stub, 001, 003, 004, 005 → **`crm_phase2_test.sql`**.
3. Base neuve : stub, 001, 003, 004, 005, puis **007 à 046, chacun deux fois**, **062 une fois** (le tableau de 046 remplacé, pour
   les suites d'analyse), **047 à 058, chacun deux fois** → 19 suites (`crm_import_test` à `lnp_fr_labels_test`, dans l'ordre du
   tableau ci-dessous).
4. Puisque `lnp_fr_labels_test` rejoue 034, le script rejoue **036, 039, 040, 041 et 045** pour remettre les définitions
   ultérieures → 18 suites (`ca_engine_choice_test` à `regle_absence_test`).
5. **059 et 061** deux fois → `simulateur_test`, `simulateur_offre_lnp_test`, `source_de_verite_test` ; **060** deux fois →
   `cockpit_corrections_test` ; **062** deux fois → `ca_board_rounds_test` ; **063** deux fois → `ca_corrections_test`.

`006_crm_cron.sql` n'est jamais appliqué par les tests (pas de `pg_cron` ni de `pg_net` en local), ni aucun bloc `cron.schedule`
des fichiers suivants. 45 suites en tout (`web/supabase/tests/*_test.sql`).

Limite à connaître : `lnp_fr_labels_test` rejoue 034 (`\ir ../034_lnp_fr_labels.sql`, deux fois) et le script ne rejoue ensuite
que 036, 039, 040, 041 et 045. Les suites des étapes 4 et 5 tournent donc avec `crm_require` de 034 (sans la règle du setter de 054),
`crm_recompute_cycle` de 045 (sans la règle des 6 mois de 055) et `crm_apply_messages` de 034 ; aucune base de test ne porte
exactement le schéma final de toutes les fonctions à la fois.

### 15.2 Ce que vérifie chaque suite

| Suite | Vérifie |
|---|---|
| `crm_phase1_test.sql` | Qui voit quoi (un commercial ne voit que son cycle, son prospect, son appel ; responsables et administrateurs voient tout — écrit avant 048 ; un compte sans rôle ne voit rien ; lecture anonyme refusée ; journal brut illisible ; insertion directe refusée ; aide interne non appelable) ; qui écrit (un membre ne se fait pas administrateur, e-mail inconnu refusé, issue sur le cycle d'un autre refusée, « non » sans motif refusé, motif de disqualification refusé pour un « non », configuration refusée à un commercial, fusion de deux cycles en cours refusée) ; règles c1–c18 ajoutées à `config/alerts`, rien au second passage, refus pour un membre. Tourne sur 003 à 005 seulement. |
| `crm_phase2_test.sql` | `crm_apply_items` et projecteur : premier rendez-vous (personne et 3 identités, cycle à l'étape Présence, propriétaire d'après l'hôte, appel R1, événement) ; même livraison rejouée sans effet ; un report puis une mise à jour plus ancienne arrivée en retard qui n'écrase pas l'heure récente ; annulation puis nouveau rendez-vous de la même personne trouvée par téléphone (même cycle) ; annulation d'un appel inconnu et identifiants désignant deux personnes → deux éléments non rattachés ; issue « non » → perdu, nouveau rendez-vous sous 30 jours → même cycle rouvert ; après 30 jours → nouveau cycle, hôte inconnu → propriétaire par défaut ; un commercial lit ses cycles ; fonctions du worker non appelables par le navigateur ; file : une ligne en échec revient après son délai, 8 tentatives au plus. |
| `crm_import_test.sql` | 007 à 013 : essai à blanc sans écriture, création, pas de doublon au second passage ni d'une seconde source, conflit compté, run enregistré ; cycle disqualifié de 008 ; cycles et appels de 009 (ouvert au premier rendez-vous, une seule fermeture, un appel à venir garde le cycle en cours) ; vue « Sans rendez-vous » ; `first_seen_at` (un événement plus ancien le recule, pas un plus récent) ; 011 (écrans effacés, administrateur = administrateur du CRM, lecteur reste lecteur) ; messages 012 ; reclassement 013. Tourne avant 059 (`crm_import_calls` de 009). |
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
| `refus_six_mois_test.sql` | 055 : un refus (perdu après un appel tenu) sans nouveau RDV depuis 6 mois passe en disqualifié et le reste ; les autres perdus (récent, injoignable, remboursé, revenu avec un nouveau cycle) ne bougent pas. |
| `call_ranks_test.sql` | Un nouveau numéro seulement après un appel avec enregistrement ou transcription. |
| `no_show_rule_test.sql` | 030 et 056 : enregistrement de moins de 7 minutes sans numéro (le test force `min_minutes`), essai à blanc, appels avant `since` intacts, R1 sans enregistrement complet = absent, R1 complet reste honoré, R2 manqué ≠ absent, prochaine action après un R2 manqué, absences comptées en R1 seulement, second passage sans changement, enregistrement tardif l'emporte et l'événement de la règle disparaît, cycle gagné laissé tranquille ; 056 : seul un appel sans enregistrement ni présence donnée est jugé, un enregistrement court est laissé au commercial. |
| `member_prefs_test.sql` | Chacun garde ses réglages ; un autre ne les voit pas. |
| `fathom_closest_test.sql` | Parmi des rendez-vous rapprochés, le plus proche l'emporte (`booking_closest`) ; une égalité reste ambiguë et ne crée pas de fausse absence ; comptes de prospects du cockpit (présent, absent, en attente). Sa dernière ligne affichée est « cockpit lead counts SQL checks: all passed ». |
| `noshow_audit_test.sql` | Une égalité va au prospect dont l'appel a été déclaré honoré (`booking_declared`) ; un prospect gagné compte comme présent. |
| `lnp_fr_labels_test.sql` | Une base aux libellés anglais reçoit les libellés français (étape, motifs, description de règle, nom d'alerte, prochaine action, échéancier, raison d'élément non rattaché) ; un libellé modifié à la main reste ; le canal Slack reste ; les fonctions sont recréées et appelables ; un second passage ne change rien. |
| `ca_engine_choice_test.sql` | 035 : `crm_ca_config.engine` (`full` par défaut, ou `lite`) arrive au worker dans la prise ; le `meta.engine` d'une fiche du moteur allégé est gardé. |
| `iclosed_deals_test.sql` | 037 : une vente iClosed devient la vente et les paiements du cycle ; rejouée = même résultat (tourne avant 059). |
| `cockpit_held_r1_test.sql` | 038 : seul le premier R1 honoré d'un prospect compte comme honoré. |
| `cockpit_audit_test.sql` | 039 : R1 en attente 48 h, fiches de test exclues, anciens commerciaux sans ligne d'équipe. |
| `cockpit_rep_test.sql` | 040 : un appel réservé sur un calendrier partagé appartient à celui qui l'a enregistré dans Fathom. |
| `cockpit_collected_test.sql` | 041 : prix de l'offre d'après le montant iClosed, échéances, encaissé à ce jour. |
| `lead_qualification_test.sql` | 042 : candidats (dernier R1 de chaque lead, fiches de test exclues) et stockage. |
| `sla_settings_test.sql` | 044 : sources débranchées par défaut ; réglages enregistrés par un administrateur et audités, lus par `sla-tick` ; seuil négatif, règle ou source inconnue refusés ; un lecteur ne peut pas enregistrer ; `crm_sla_settings` fermée au navigateur. |
| `pipeline_moves_test.sql` | 045 : un lead sans appel clos à la main depuis le Pipeline, rouvert ; une issue déclarée ensuite l'emporte ; droits. |
| `qualif_in_analysis_test.sql` | 046 : la qualification d'un R1 est gardée avec son travail d'analyse, lue avec l'analyse et montrée au tableau ; les fonctions du worker restent fermées au navigateur. |
| `stage_moves_test.sql` | 047 : un déplacement sans rien à déclarer est gardé ; jamais vers un tour déjà atteint, jamais un tour sauté, jamais au-delà d'un appel à venir, d'une issue à déclarer ou d'une absence. |
| `access_scope_test.sql` | 048 : un administrateur voit tous les leads ; un commercial, un responsable commercial et un lecteur seulement ceux dont ils possèdent le cycle (appels, événements, paiements, personnes compris), dans les tables et dans le Cockpit. |
| `training_test.sql` | 049 : progression de Maîtrise de l'offre (sa ligne ; le formateur lit tout) ; résultats en ajout seulement (ni modification, ni effacement, ni `truncate`), ses lignes, jamais une note « claude » depuis le navigateur ; tableau des résultats (sa ligne ; un administrateur voit tout le monde). |
| `sales_execution_test.sql` | 050 : un administrateur voit tout, un commercial ses cycles ; un prospect tenu, qualifié, payé dans les 14 jours compte comme vente ; les portes de la qualification sont comptées. |
| `whatsapp_test.sql` | 052 : numéro WhatsApp normalisé (`+33 6 12 34 56 78`, `0033…`), invalide ou pris deux fois refusé, effacé ; message d'un numéro inconnu → nouveau prospect avec le nom de son profil ; statut seul puis écho de l'application → un seul événement, acteur `sales`, membre rattaché, contenu et statut à jour ; envoyé par l'API seulement → reste `auto` ; STOP retenu ; ligne brute traitée. |
| `alertes_test.sql` | 053 : une alerte s'ouvre, monte de niveau, se ferme seule ; un commercial ne voit que les alertes de ses cycles (jamais les techniques), un administrateur voit tout. |
| `setting_test.sql` | 054 : un lead entre (quiz, VSL, quiz abandonné, saisi à la main), le setter le fait avancer par ses actions, iClosed le fait avancer seul (RDV réservé, absent, tenu, annulé) ; le setter ne voit que ses leads et reçoit leurs alertes SE. |
| `regle_absence_test.sql` | 056 : absent seulement sans enregistrement ni présence donnée ; les leads encore ouverts d'avant une date deviennent perdus, en suivi long terme. |
| `simulateur_test.sql` | 057 : chacun lit ses simulations (un administrateur toutes), l'équipe lit les offres et les prospects actifs, personne n'écrit depuis le navigateur ; l'historique ne montre que ce que la personne peut voir. |
| `simulateur_offre_lnp_test.sql` | 058 : l'offre LNP est là une seule fois (rejouée deux fois), prête, avec les champs lus par le prospect, sans prospect. |
| `source_de_verite_test.sql` | 059 : iClosed ne donne que le lead, la date des RDV et un montant pour information ; le statut est celui du CRM ; webinaire : au setter seulement si présent sans RDV, ou absent sans réponse (48 h au webinaire, 24 h au RDV). |
| `cockpit_corrections_test.sql` | 060 : la cohorte « appels tenus » d'Exécution, Qualité, Impact est le premier appel tenu du cycle ; un appel tenu plus tard (après-vente) ne fait pas entrer dans la période un prospect déjà payé ; les sources branchées sont rendues. |
| `ca_board_rounds_test.sql` | 062 : deux absences puis un R1 honoré, enregistré et analysé apparaît en R1 avec son analyse (`crm_ca_board` numérote comme `crm_ca_call_info`). |
| `ca_corrections_test.sql` | 063 : un administrateur corrige la lettre d'une question (lettre du moteur gardée, `OUT` pour hors découverte), chaque correction est rendue par la fiche, la plus récente d'abord ; la note ne change pas (C8) ; un commercial lit les corrections mais ne corrige pas (`can_correct` faux) ; lettre ou question inconnue refusée ; aucun droit d'insertion directe. |

Autres tests qui touchent la base : `deno test --allow-env --allow-read supabase/tests` (fonctions, dont `pipeline.test.ts`,
`fathom.test.ts` et `sla.test.ts`, qui simulent les appels aux fonctions SQL ; les `simulateur_*.test.ts` du moteur du Simulateur),
`node app/crm/data.test.js` (couche de données du navigateur), `cd web && npm test` (connecteur Claude, avec
`web/tests/fake_supabase.js`).

---

## 16. Écarts avec `docs/crm/` et points d'attention

Le code fait foi. Écarts relevés avec la spécification `docs/crm/` et les commentaires :

- **`002_q4_okrs.sql`** est encore cité par `docs/crm/01-architecture.md` et par l'en-tête de `003_crm_core.sql`, mais le fichier
  n'existe plus ; rien dans 003 à 063 n'en dépend.
- **Le projecteur est en SQL** (`crm_recompute_cycle`), pas dans `_shared/projector.ts` comme l'annonce `docs/crm/01-architecture.md`.
  Les Edge Functions `rules-tick`, `nurture-tick`, `reconcile`, `sendblue-send` (Sendblue abandonné le 9 novembre 2026),
  `whop-checkout`, `claude-analyze` décrites là n'existent pas dans `supabase/functions/` (présentes : `iclosed-in`, `fathom-in`,
  `whatsapp-in`, `whop-in`, `lead-in`, `process-inbox`, `crm-import`, `sla-tick`, `callqa-llm`, `simulateur`).
- En conséquence, **`crm_alerts`, `crm_outbound_messages`, `crm_reconciliation_runs` et `crm_agent_runs` ne reçoivent aucune
  ligne** : les alertes du CRM sont dans `crm_sla_alerts` (053), mais le Cockpit commercial (`crm_sales_cockpit`, « encaissements à
  risque ») et l'abonnement temps réel de `app/crm/data.js` (`subscribe`) lisent encore `crm_alerts`. Les règles `crm_rules` autres
  que `next_move.reopen_days`, `snooze_days` et `nurture_cadence.archive_after_days` (055) ne sont lues par aucun code. Un
  `cycle_lost` de source `rules` n'est écrit que par `crm_close_before` (056, une fois).
- **`docs/crm/02-data-model.md`** ne décrit aucune des tables ajoutées depuis le 3 novembre 2026 (`crm_sla_alerts`,
  `crm_lead_qualifications`, `crm_training_results`, `crm_academy_*`, `crm_sim_*`, `crm_ca_corrections`) ni les colonnes du setter ;
  elles sont décrites par leurs propres documents (`docs/crm/18-sales-cycle-slas.md`, `19-setting.md`, `20-simulateur.md`) et ici.
- **Types d'événements** : le code écrit `payment_refunded` (la spécification dit `refund`), et aussi `call_missed`,
  `transcript_added`, `imported`, `stage_moved`, `setter_action`, `lead_in`, `iclosed_deal`, absents de la liste de
  `docs/crm/02-data-model.md` ; `analysis_ready` a l'acteur `system` et la source `crm` (spécification : `auto` / `claude`).
  `message_status`, `payment_failed`, `checkout_created`, `auto_close_notice`, `nurture_message`, `nurture_archived`… ne sont écrits
  par aucune fonction SQL.
- **Analyse d'appel** : le moteur écrit `crm_ca_*` (020) ; la table `crm_call_analyses` de 003 n'est plus écrite, seule la fiche
  prospect du CRM la lit encore.
- **`crm_academy_corrections`** : l'en-tête de 049 dit qu'elle est écrite par `web/api/academie.js` et que seul ce fichier écrit un
  résultat `mode = 'claude'` ; ce fichier n'existe pas (la correction par Claude a été retirée le 8 novembre 2026). La table reste vide
  et aucun résultat `claude` ne peut être écrit (la politique d'insertion le refuse au navigateur).
- **`crm_save_sla_rules` refuse les règles du setter** : son motif de clé est `^(SH|DE|CA|CO|CL|DO)-[0-9]{1,2}$` (044), alors que le
  catalogue (`supabase/functions/_shared/sla_rules.js`) a aussi SE-1 à SE-10 et que Paramètres › Alertes les liste (`web/api/_os.js` :
  « the setter's included »). Enregistrer un réglage d'une règle SE depuis l'écran lèverait « Réglages des SLA : règle inconnue
  (SE-n) » (non testé par `sla_settings_test.sql`, ni vérifié dans le navigateur).
- **`crm_import_iclosed_disqualified` et `crm_reclassify_imported`** (008, 013) lisent encore le statut iClosed, contraire à la règle
  de 059 ; ils ne sont lancés par rien (rattrapages manuels) : ne plus les lancer.
- **`CLAUDE.md`** dit qu'iClosed ne donne jamais un paiement : c'est vrai depuis 059, mais les paiements `iclosed` et leurs
  `payment_succeeded` importés par 037 / 041 restent en production (§2).

Points d'attention pour une réplique :

- **Historique des migrations** : 056 sans entrée, 061 sous le nom `crm_simulateur_realisme_061` (§2).
- **Nombre de fonctions** : les fichiers créent 129 fonctions nommées (aucune surcharge ne reste : les anciennes signatures de
  `crm_sales_cockpit_window`, `crm_import_recordings`, `crm_qualif_store` et `crm_admin_set_member` sont supprimées) ; le relevé de
  production compte 176 fonctions dans `public`. La différence ne se lit pas dans le dépôt (probablement les fonctions d'une
  extension installée dans `public`, comme `citext`, que 003 crée sans schéma) : à comparer sur le projet cible plutôt que de la
  reproduire.
- **Temps réel** : `docs` et `crm_sla_alerts` seulement (001, 053), comme en production ; `app/crm/data.js` s'abonne aussi à
  `crm_cycles`, `crm_events`, `crm_alerts`, qui ne sont pas publiées : ces abonnements ne reçoivent rien.
- **Retirer un membre** : `crm_members.id` référence `members(user_id)` `on delete restrict`, alors que `members` est supprimé en
  cascade avec `auth.users`. Depuis 011 tout membre a une ligne `crm_members` : la suppression d'un compte par `/api/team`
  (`auth.admin.deleteUser`) devrait donc être refusée par cette contrainte tant que la ligne `crm_members` existe (non testé ici).
  `crm_training_results` n'a volontairement aucune FK (les résultats restent) ; `crm_academy_progress` et
  `crm_academy_corrections` sont effacées en cascade avec le compte.
- **Changement de rôle** : modifier `members.role` ne change pas `crm_members.role` (§6.1) ; la fonction commercial / setter passe par
  `crm_set_member_role`.
- **Le setter et l'analyse d'appel** : `crm_owns_cycle` (054) laisse un setter ajouter une transcription ou relancer une analyse sur
  le cycle d'un lead qu'il suit, mais `crm_ca_can_read` (propriétaire seulement) l'empêche de lire l'analyse et `crm_ca_board` ne
  liste que les cycles dont il est propriétaire.
- **Privilèges par défaut des fonctions** : sur Supabase, les privilèges par défaut du schéma `public` accordent en général
  `EXECUTE` sur chaque nouvelle fonction à `anon`, `authenticated` et `service_role` (le stub de test ne le reproduit pas). Les
  fonctions sans `revoke` explicite (`my_role`, `crm_norm_name`, `crm_no_show_setting`, `crm_call_complete`,
  `crm_call_has_ambiguous_recording`, `crm_call_is_reschedule`, `crm_stage_data_types`, `crm_auto_schedule`, `crm_sets_person`,
  `crm_setting_open_at`, `crm_setting_end_of_day`, `crm_setting_due`, `crm_pick_setter`, les fonctions de déclencheur) restent donc
  appelables ; elles ne font que lire ou calculer. À l'inverse, `crm_ca_claim`, `crm_ca_store`, `crm_ca_fail`, `crm_refusal_tick`,
  `crm_training_person`, `crm_lead_item`, `crm_setting_move`, `crm_sales_exec_window`, `crm_plan_for_amount`,
  `crm_apply_auto_plans`, `crm_deal_collected` sont retirées à tous sans `grant` au rôle de service : celles qu'un client de service
  appelle directement (`crm_ca_claim`, `crm_ca_store`, `crm_ca_fail` par le worker) dépendent des privilèges par défaut ; les autres
  ne sont appelées que par d'autres fonctions ou par pg_cron (propriétaire). À vérifier sur le projet cible.
- **RPC exposées mais inutilisées par les écrans** : `crm_cancel_auto_close`, `crm_set_nurture`, `crm_resolve_unmatched`,
  `crm_dismiss_unmatched`, `crm_merge_people`, `crm_update_config`, `crm_create_checkout`, `crm_set_deal` (dans `data.js`, aucun
  appelant), `crm_ca_latest`, `crm_recompute_all`, `crm_admin_set_member`, `crm_merge_alert_defaults` (aucun appelant).
- **Valeurs d'énumération jamais écrites** : `cycle_origin.reopened`, `call_status.outcome_pending`, `nurture_status.archived` /
  `opted_out`, la plupart d'`outbound_status`, `event_source.sendblue` et `claude`.
- **`crm_settings.team_email_domains`** n'est lue par aucun code (c'est `internal_domains`, 039, qui sert).
- **`crm_ca_config.default_timezone`** vaut encore `Asia/Dubai`, comme `crm_members.timezone` par défaut (003) : seuls les appels
  sans propriétaire en dépendent ; aucune migration ne les passe à `Europe/Paris`.
- **Réglages à poser à la main** : `functions_url` (sans lui, ni la file, ni Fathom, ni les imports iClosed, ni les SLA, ni le
  balayage du Simulateur ne tournent) ; `crm_ca_config.engine` et `tiers` pour retrouver la production ; les sources de `sla_rules`.

### Ce qui n'a pas pu être déterminé depuis le dépôt

- L'état réel de la base en ligne au-delà du relevé de `08-configuration-actuelle.md` (privilèges par défaut des fonctions, valeurs
  actuelles de `sla_rules`, `setting`, `offer_catalogue`, lignes de `crm_sales_team`), et l'origine des 47 fonctions de plus.
- Si Paramètres › Alertes envoie vraiment un réglage SE à `crm_save_sla_rules` (refus attendu d'après le code, non essayé).
- Le format exact des éléments produits par les mappers TypeScript (`supabase/functions/_shared/mappers/`, dont `funnel.ts`) au-delà
  de ce que les fonctions SQL lisent : voir le chapitre des intégrations.
