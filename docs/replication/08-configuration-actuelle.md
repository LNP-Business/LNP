# 08 · Configuration actuelle de LNP

Relevé en direct le 27 novembre 2026 (API de gestion Supabase, API Vercel, dépôt GitHub), en lecture seule. Aucune valeur
secrète : seulement des noms, des réglages publics et des compteurs. C'est l'**état attendu d'une réplication à 100 %** : le
chapitre 10 en tire la liste de contrôle.

## Ce qui tourne en production

| Élément | Version en production |
|---|---|
| Page et API (Vercel) | branche `main`, commit `edcc610` (« Merge pull request #80 »), déploiement automatique à chaque push sur `main` |
| Fonctions Edge (Supabase) | déployées par le workflow `crm-functions.yml` à chaque push sur `main` (ou une branche `crm-*`) qui touche `supabase/**` |
| Analyse d'appel (worker) | `call-analysis.yml` sur `main`, toutes les heures à la minute 7 |
| Base de données | les 63 fichiers `web/supabase/001_init.sql` … `063_crm_ca_corrections.sql` (il n'y a pas de `002`) |

Les branches non fusionnées ne tournent pas : à la date du relevé, les PR `#81`, `#82` et `#83` (analyse d'appel) attendent leur
fusion. Une réplication à l'identique part de `main`.

## GitHub

| Élément | Valeur |
|---|---|
| Dépôt | `LNP-Business/LNP`, branche par défaut `main` |
| Secrets Actions (lus dans les workflows) | `SUPABASE_ACCESS_TOKEN` (jeton personnel de l'API de gestion Supabase), `SUPABASE_PROJECT_REF`, `SUPABASE_SERVICE_ROLE_KEY` (la clé secrète du projet) |
| Variable Actions | `SUPABASE_URL` = `https://<réf du projet>.supabase.co` |
| Workflows | `crm-functions.yml` (tests SQL et des fonctions, déploiement des fonctions Edge), `call-analysis.yml` (tests du moteur, worker toutes les heures, mesure à la demande), `qualification.yml` (tests et lancement à la demande de la qualification) |

## Supabase

| Élément | Valeur |
|---|---|
| Projet | `LNP`, région `eu-central-1`, Postgres 17.11 |
| Historique des migrations | 61 entrées : `001_init` puis `003_crm_core` … `063_crm_ca_corrections`. **Deux écarts avec le dépôt**, sans effet sur le schéma : `056_crm_regle_absence` a été appliquée sans entrée dans l'historique (ses fonctions `crm_apply_no_show_rule` et `crm_close_before` existent bien en base) ; `061` est tracée sous le nom `crm_simulateur_realisme_061` |
| Schéma `public` | 53 tables, toutes avec RLS ; 176 fonctions ; 1 vue ; 11 déclencheurs |
| Extensions | `citext`, `pg_cron`, `pg_net`, `pg_stat_statements`, `pgcrypto`, `plpgsql`, `supabase_vault`, `uuid-ossp` |
| Temps réel (`supabase_realtime`) | `crm_sla_alerts`, `docs` |
| Stockage | `callqa-fixtures` (privé) : le jeu de référence de la mesure de l'analyse d'appel (`qa/reference.tar.gz`, `qa/cases.tar.gz`) et ses rapports. **Données personnelles : ne se copie pas dans une réplication**, il se reconstitue (chapitre 09) |
| Comptes | 11 comptes de connexion, 22 lignes dans `crm_sales_team` |

### Fonctions Edge (toutes `verify_jwt = false`, chacune vérifie son propre jeton)

| Fonction | Version déployée | Rôle |
|---|---|---|
| `iclosed-in` | 11 | reçoit les webhooks d'iClosed (rendez-vous) |
| `fathom-in` | 11 | reçoit les webhooks de Fathom |
| `whatsapp-in` | 4 | reçoit les messages WhatsApp Business (API officielle) |
| `whop-in` | 11 | reçoit les paiements Whop |
| `lead-in` | 3 | reçoit les leads des funnels |
| `process-inbox` | 19 | transforme chaque minute les requêtes reçues en prospects, cycles, appels, événements |
| `crm-import` | 24 | imports d'iClosed, Fathom et Close (historique et chaque heure) |
| `sla-tick` | 23 | ouvre, fait monter et ferme les alertes du CRM toutes les 5 minutes (copie Slack facultative) |
| `callqa-llm` | 10 | passerelle vers le modèle pour le worker d'analyse d'appel |
| `simulateur` | 10 | le Simulateur d'appel de vente (conversation, voix, analyse de fin d'appel) |

### Secrets des fonctions (noms seulement)

| Secret | Présent en production | Lu par |
|---|---|---|
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, `SUPABASE_DB_URL`, `SUPABASE_JWKS`, `SUPABASE_PUBLISHABLE_KEYS`, `SUPABASE_SECRET_KEYS` | oui (créés par Supabase) | toutes |
| `ANTHROPIC_API_KEY` | oui | `callqa-llm`, `simulateur` |
| `FATHOM_API_KEY` | oui | `crm-import` |
| `ICLOSED_API_KEY` | oui | `crm-import` |
| `ICLOSED_INBOUND_TOKEN` | oui | `iclosed-in` |
| `WHATSAPP_APP_SECRET`, `WHATSAPP_INBOUND_TOKEN` | **non** | `whatsapp-in` (messages WhatsApp pas encore branchés) |
| `FUNNEL_INBOUND_TOKEN` | **non** | `lead-in` |
| `ELEVENLABS_API_KEY` | non (facultatif) | `simulateur` : sans lui, la voix du prospect est celle du navigateur |
| `SLACK_SALES_CYCLE_WEBHOOK_URL` | non (facultatif) | `sla-tick` : copie Slack des alertes, éteinte par défaut |
| `CLOSE_API_KEY`, `CRM_REPORT_TOKEN` | non | `crm-import` (import d'historique Close, rapport) |
| `SENDBLUE_INBOUND_TOKEN` | oui, **obsolète** | plus aucune fonction (Sendblue abandonné le 9 novembre 2026) : à supprimer |

### Tâches planifiées (`cron.job`, 11 tâches actives)

| Tâche | Fréquence | Ce qu'elle lance |
|---|---|---|
| `crm-process-inbox` | chaque minute | `process-inbox` |
| `crm-sla-tick` | toutes les 5 minutes | `sla-tick` |
| `crm-setting-tick` | toutes les 10 minutes | `crm_setting_tick()` (suivi du setter, webinaire) |
| `crm-simulateur-balayer` | toutes les 10 minutes | `simulateur/balayer` (relance les analyses en attente) |
| `crm-iclosed-contacts-hourly` | minute 3 de chaque heure | `crm-import` (contacts iClosed) |
| `crm-iclosed-calls-hourly` | minute 15 | `crm-import` (appels iClosed) |
| `crm-assign-owners-hourly` | minute 20 | `crm_assign_owners_from_hosts(false)` |
| `crm-fathom-hourly` | minute 23 | `crm-import` (enregistrements Fathom) |
| `crm-no-show-hourly` | minute 35 | `crm_no_show_tick()` |
| `crm-iclosed-deals-hourly` | minute 41 | `crm-import` (ventes iClosed) |
| `crm-refusal-daily` | 3 h 17 chaque jour | `crm_refusal_tick()` (disqualifié 6 mois après un refus) |

Les tâches qui appellent une fonction Edge lisent son adresse dans `crm_settings.functions_url`.

### Réglages (`crm_settings`, clés présentes)

`alert_rule_defaults`, `analysis_model`, `default_owner`, `fathom_close_minutes`, `fathom_match_minutes`, `functions_url`,
`internal_domains`, `no_show_rule`, `nurture_sending_enabled`, `nurture_templates`, `offer_catalogue`, `setting`,
`show_pending_hours`, `sla_alerts`, `sla_rules`, `team_email_domains`, `whop_plans`. Leur sens et leurs valeurs par défaut :
chapitre 03 ; les valeurs propres à LNP (domaines internes, catalogue d'offres) se recopient à la main après la réplication.

### Analyse d'appel (`crm_ca_config`)

| Réglage | Valeur |
|---|---|
| `engine` | `lite` (moteur allégé) |
| `tiers` | `fast` = `claude-haiku-5-5`, `strong` = `claude-haiku-5-5`, `arbiter` = `claude-sonnet-5-5` |

### Authentification

| Réglage | Valeur |
|---|---|
| Site URL | `https://lnp-sales.vercel.app` |
| Redirect URLs | `https://lnp-sales.vercel.app/**` |
| Connexion | e-mail et mot de passe ; confirmation de l'e-mail exigée ; envoi par le service d'e-mails de Supabase (pas de SMTP propre) |
| Inscription libre | **ouverte** côté Supabase (`disable_signup = false`), alors que les comptes se créent par invitation : à fermer (Authentication › Sign In / Providers › « Allow new users to sign up ») |
| Mot de passe | 6 caractères minimum côté Supabase, 8 exigés par l'écran |
| Durée du jeton | 3 600 s |

## Vercel

| Élément | Valeur |
|---|---|
| Projet | `lnp`, relié à `LNP-Business/LNP`, branche de production `main` |
| Root Directory | `web` ; pas de framework, pas de commande de build (`web/vercel.json`, sortie `public`) |
| Domaine | `lnp-sales.vercel.app` |
| Variables | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SITE_URL` (production, aperçu, développement) ; `SUPABASE_SERVICE_ROLE_KEY` (production et aperçu) ; `BOOTSTRAP_TOKEN` absent (supprimé après la création du premier administrateur) |

## Constats à corriger ou à surveiller

| Constat | Conséquence | Correctif |
|---|---|---|
| Inscription libre ouverte | n'importe qui peut créer un compte de connexion (il n'a aucun écran sans accès donné par un administrateur, mais le compte existe) | fermer l'inscription dans Supabase |
| `SENDBLUE_INBOUND_TOKEN` encore présent | aucun | supprimer le secret |
| WhatsApp et les leads des funnels non branchés en production | les messages et les leads des funnels n'arrivent pas | créer `WHATSAPP_APP_SECRET`, `WHATSAPP_INBOUND_TOKEN`, `FUNNEL_INBOUND_TOKEN` et brancher les webhooks (chapitre 04) |
| `056` absente de l'historique des migrations, `061` sous un autre nom | aucune sur le schéma ; une réplication qui applique les fichiers dans l'ordre obtient le même schéma | aucun (à savoir avant de comparer les historiques) |
| Temps réel limité à `crm_sla_alerts` et `docs` | les autres tables du CRM ne se mettent pas à jour seules à l'écran | décider s'il faut publier `crm_cycles` et `crm_events` |
