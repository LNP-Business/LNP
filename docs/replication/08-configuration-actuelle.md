# 08 · Configuration actuelle de LNP

Relevé en direct le 3 novembre 2026 (API de gestion Supabase, API Vercel, dépôt GitHub). Aucune valeur secrète : seulement des noms,
des réglages publics et des compteurs. À utiliser comme état attendu d'une réplication.

## GitHub

| Élément | Valeur |
|---|---|
| Dépôt | `LNP-Business/LNP` (public), branche par défaut `main` |
| Secrets Actions | `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`, `SUPABASE_SERVICE_ROLE_KEY` (= la clé secret `sb_secret_…` du projet, depuis le 3 novembre) |
| Variable Actions | `SUPABASE_URL` = `https://lludbqyosuzgwvvphmqc.supabase.co` |
| Workflows | `crm-functions.yml`, `call-analysis.yml` (chapitre 06) |

## Supabase

| Élément | Valeur |
|---|---|
| Organisation | pas encore celle de LNP (à transférer dans une organisation LNP ; tous les autres comptes sont ceux de LNP) |
| Projet | `LNP`, réf. `lludbqyosuzgwvvphmqc`, région `eu-central-1`, Postgres 17 |
| Migrations tracées | 33 : `001_init` puis `003_crm_core` … `034_lnp_fr_labels` |
| Tables (`public`) | 41, toutes avec RLS |
| Fonctions (`public`) | 131 |
| Extensions | `citext`, `pg_cron`, `pg_net`, `pg_stat_statements`, `pgcrypto`, `plpgsql`, `supabase_vault`, `uuid-ossp` |
| Stockage | aucun bucket pour l'instant (`library` est créé au premier dépôt de fichier ; `callqa-fixtures` n'existe pas) |
| Fonctions Edge | `iclosed-in`, `fathom-in`, `whatsapp-in`, `whop-in`, `process-inbox`, `crm-import`, `sla-tick`, `callqa-llm` (toutes `verify_jwt = false`) ; `whatsapp-in` remplace `sendblue-in` (Sendblue abandonné le 9 novembre 2026, il n'a jamais envoyé de données) et se met en service avec la migration `052_crm_whatsapp`, pas encore appliquée |
| Secrets des fonctions | seulement ceux créés par Supabase (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_PUBLISHABLE_KEYS`, `SUPABASE_SECRET_KEYS`, `SUPABASE_DB_URL`, `SUPABASE_JWKS`) ; les secrets des outils (iClosed, Fathom, WhatsApp, Close, Anthropic, Slack) restent à ajouter |

### Tâches planifiées (`cron.job`)

| Tâche | Fréquence | Rôle |
|---|---|---|
| `crm-process-inbox` | chaque minute | traite les webhooks reçus en attente |
| `crm-fathom-hourly` | à la minute 23 de chaque heure | importe les enregistrements Fathom des deux derniers jours |
| `crm-no-show-hourly` | à la minute 35 de chaque heure | règle d'absence (inactive tant que `no_show_rule.enabled` = false) |
| `crm-sla-tick` | toutes les 5 minutes | alertes SLA vers Slack |

### Réglages (`crm_settings`)

| Clé | Valeur |
|---|---|
| `alert_rule_defaults` | règles c1 à c18 (noms en français, sévérité, seuil, destinataires) |
| `analysis_model` | `"claude-sonnet-5-5"` |
| `default_owner` | `"sales"` |
| `fathom_close_minutes` | `15` |
| `fathom_match_minutes` | `90` |
| `functions_url` | `"https://lludbqyosuzgwvvphmqc.supabase.co/functions/v1"` |
| `no_show_rule` | `{"since": null, "enabled": false, "grace_hours": 3, "min_minutes": 30}` |
| `nurture_sending_enabled` | `false` |
| `nurture_templates` | `[]` |
| `sla_alerts` | `link` = `https://lnp-sales.vercel.app/#crm`, canal `#sales-cycle`, fuseau `America/New_York`, `max_age_hours` 6 |
| `team_email_domains` | `[]` |
| `whop_plans` | `{}` |

### Authentification

| Réglage | Valeur |
|---|---|
| Site URL | `https://lnp-sales.vercel.app` |
| Redirect URLs | `https://lnp-sales.vercel.app/**` |
| Connexion | e-mail et mot de passe (inscription libre non utilisée : les comptes sont créés par invitation) |
| Mot de passe | 6 caractères minimum côté Supabase, 8 exigés par l'écran |
| Durée du jeton | 3 600 s |

## Vercel

| Élément | Valeur |
|---|---|
| Projet | `lnp`, relié à `LNP-Business/LNP`, branche de production `main` |
| Root Directory | `web` ; Framework Preset : Other ; build : aucun (`web/vercel.json`, sortie `public`) |
| Domaine | `lnp-sales.vercel.app` |
| Variables | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SITE_URL` (production, aperçu, développement), `SUPABASE_SERVICE_ROLE_KEY` (sensible ; production et aperçu) ; `BOOTSTRAP_TOKEN` supprimé après la création du premier administrateur |
| Fonction configurée | `api/mcp.js` (`web/vercel.json`) |
| Réécritures | `/.well-known/oauth-protected-resource`, `/.well-known/oauth-authorization-server`, `/api/oauth/register`, `/api/oauth/authorize`, `/api/oauth/token` |

## Équipe

Un compte : l'administrateur créé le 3 novembre 2026. `crm_sales_team` est vide (commerciaux à ajouter). Aucune donnée CRM.

## Constats vérifiés en direct (points à corriger ou à surveiller)

| Constat | Vérification | Conséquence |
|---|---|---|
| Realtime : seule la table `docs` est dans la publication `supabase_realtime` | `pg_publication_tables` | le CRM s'abonne aussi à `crm_cycles`, `crm_events`, `crm_alerts`, mais ces tables ne sont pas publiées : les écrans du CRM ne se mettent pas à jour seuls (il faut recharger). Correctif : `alter publication supabase_realtime add table crm_cycles, crm_events, crm_alerts;` |
| `crm_members.id` → `members` en `on delete restrict` | `pg_constraint` (`confdeltype = r`) | depuis `011`, chaque membre a sa ligne `crm_members` : retirer une personne depuis Paramètres › Compte risque d'être refusé par la base. À tester, puis corriger (supprimer la ligne `crm_members` d'abord, ou passer la clé en `on delete cascade`) |
| Fonctions du worker d'analyse | `has_function_privilege('service_role', …)` | `crm_ca_claim`, `crm_ca_store`, `crm_ca_fail` sont bien exécutables par `service_role` (droits par défaut de Supabase) ; le worker a déjà appelé `crm_ca_claim` avec succès |
| `crm_alerts` n'est jamais rempli | recherche dans le code (chapitres 02 et 03) | « Encaissements à risque » ne montre que les prochaines étapes en retard ; la vue Alertes du CRM reste vide. Les alertes commerciales actives sont les SLA (`sla_rules.js`, Slack) |
| Paramètres › Alertes ne règle que des alertes de l'ancien système d'exploitation (tâches, objectifs, décisions) | chapitre 02 | sans effet dans LNP tant que ces données n'existent pas |
| `whop-in` stocke les paiements sans les traiter | chapitre 04 | les encaissements se saisissent à la main dans la fenêtre d'encaissement |
