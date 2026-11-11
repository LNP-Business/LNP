# LNP · Ventes

LNP est l'application commerciale de **Les Nouveaux Profs** : Cockpit commercial, Ma journée, CRM (Pipeline, Prospects, Cycle de
vente, fiche prospect, analyse d'appel, encaissements, alertes SLA) et Paramètres (Alertes, Compte, Accès). Elle est entièrement en
français (`docs/lnp/GLOSSAIRE.md` fixe les termes) et aux couleurs du site https://www.lesnouveauxprofs.fr/.

En ligne : https://lnp-sales.vercel.app (projet Vercel `lnp`, dossier racine `web/`, déployé depuis `main`).

```bash
./build.sh            # construit app/lnp.html et web/public/index.html (la page LNP)
./build.sh --verify   # compare le résultat à l'empreinte de référence app/EXPECTED.sha256
```

## La marque : `edition.json`

- `brand`, `title` : « LNP Ventes » dans la barre latérale, « LNP · Ventes » dans l'onglet.
- `wordmark`, `logo` : le nom « Les Nouveaux Profs » et le logo LNP (`app/brand/lnp-logo.png`) dans la barre latérale, le logo en
  icône d'onglet (`app/nav.py`, `app/build.py`).
- `recolor` et `fonts` : la charte de Les Nouveaux Profs (nuit `#1E2A5E`, vif `#2B6CF5`, vif-clair `#5B8DF7`, ciel `#AECBF2`,
  pâle `#E3ECFB`, ardoise `#5A6478`, cassé `#F7F8FB`) et la police Poppins, appliquées par `app/build.py` à la page finie.
- `systems`, `settings`, `home` : la page ne contient que les écrans de LNP et s'ouvre sur le Cockpit commercial.

## Le back end

Tous les comptes sont ceux de LNP (GitHub `LNP-Business`, Vercel, Anthropic, Slack, iClosed, Fathom, WhatsApp Business (Meta), Close).
Seule exception, Supabase : le projet `LNP` (réf. `lludbqyosuzgwvvphmqc`, eu-central-1) est encore rangé dans une organisation
Supabase qui n'est pas celle de LNP ; sa base ne contient que les données de LNP. À transférer dans une organisation LNP
(Supabase › Project Settings › General › Transfer project).

1. **Base Supabase** : chaque fichier de `web/supabase/` (`001` puis `003` à `058`), dans l'ordre. `034_lnp_fr_labels.sql` passe
   en français les libellés d'une base déjà remplie ; il peut être rejoué. `crm_sales_team` liste les commerciaux de LNP.
   `crm_settings.functions_url` = `https://lludbqyosuzgwvvphmqc.supabase.co/functions/v1` (`006_crm_cron.sql`).
2. **Fonctions Edge** (`supabase/functions/`) : déployées par `.github/workflows/crm-functions.yml` depuis `main`, avec les secrets
   GitHub `SUPABASE_ACCESS_TOKEN` et `SUPABASE_PROJECT_REF`.
3. **Secrets des fonctions** (Supabase › Edge Functions › Secrets), comptes de LNP : `ICLOSED_API_KEY`, `ICLOSED_INBOUND_TOKEN`,
   `FATHOM_API_KEY`, `WHATSAPP_INBOUND_TOKEN` (messages WhatsApp ; `WHATSAPP_APP_SECRET` si Meta envoie directement les
   webhooks), `CLOSE_API_KEY` (si utilisé), `ANTHROPIC_API_KEY` (analyse d'appel, Simulateur), `ELEVENLABS_API_KEY` (facultatif : la voix du prospect du Simulateur ; sans elle,
   le navigateur parle), `SLACK_SALES_CYCLE_WEBHOOK_URL` (alertes SLA). Étapes : `docs/crm/setup.md`. Lien des alertes Slack :
   `crm_settings.sla_alerts.link` = `https://lnp-sales.vercel.app/#crm`.
4. **Vercel** : projet `lnp`, dossier racine `web/`, variables `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
   (sensible), `SITE_URL`. Premier administrateur : `BOOTSTRAP_TOKEN` le temps d'appeler `/api/bootstrap`, puis le retirer.
5. **Analyse d'appel** (`.github/workflows/call-analysis.yml`) : variable de dépôt `SUPABASE_URL` et secret `SUPABASE_SERVICE_ROLE_KEY`
   = la clé **secret** du projet (`sb_secret_…`, Project Settings › API Keys) : la fonction `callqa-llm` refuse l'ancienne clé `service_role`.

Ne jamais mettre de clé dans ce dépôt.
