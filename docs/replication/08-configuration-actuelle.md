# 08 · Configuration actuelle de LNP

Relevé en direct le 3 novembre 2026 (API de gestion Supabase, API Vercel, dépôt GitHub). Aucune valeur secrète : seulement des noms,
des réglages publics et des compteurs. À utiliser comme état attendu d'une réplication.

## GitHub

| Élément | Valeur |
|---|---|
| Dépôt | `LNP-Business/LNP` (public), branche par défaut `main` |
| Secrets Actions | `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`, `SUPABASE_SERVICE_ROLE_KEY` |
| Variable Actions | `SUPABASE_URL` = `https://lludbqyosuzgwvvphmqc.supabase.co` |
| Workflows | `crm-functions.yml`, `call-analysis.yml` (chapitre 06) |

## Supabase

| Élément | Valeur |
|---|---|
| Organisation | ALKIMIY (exception décidée par Romain le 2026-11-03 ; tous les autres comptes sont ceux de LNP) |
| Projet | `LNP`, réf. `lludbqyosuzgwvvphmqc`, région `eu-central-1`, Postgres 17 |
| Migrations tracées | 33 : `001_init` puis `003_crm_core` … `034_lnp_fr_labels` |
| Tables (`public`) | 41, toutes avec RLS |
| Fonctions (`public`) | 131 |
| Extensions | `citext`, `pg_cron`, `pg_net`, `pg_stat_statements`, `pgcrypto`, `plpgsql`, `supabase_vault`, `uuid-ossp` |
| Stockage | aucun bucket pour l'instant (`library` est créé au premier dépôt de fichier ; `callqa-fixtures` n'existe pas) |
| Fonctions Edge | `iclosed-in`, `fathom-in`, `sendblue-in`, `whop-in`, `process-inbox`, `crm-import`, `sla-tick`, `callqa-llm` (toutes `verify_jwt = false`) |
| Secrets des fonctions | seulement ceux créés par Supabase (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_PUBLISHABLE_KEYS`, `SUPABASE_SECRET_KEYS`, `SUPABASE_DB_URL`, `SUPABASE_JWKS`) ; les secrets des outils (iClosed, Fathom, Sendblue, Close, Anthropic, Slack) restent à ajouter |

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
