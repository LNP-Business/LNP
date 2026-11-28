# 10 · Liste de contrôle : la réplique est-elle identique ?

Chaque ligne se vérifie par une commande ou un écran. Les valeurs attendues sont celles de la production au 27 novembre 2026
(chapitre 08). Une réplique est « à 100 % » quand toutes les cases sont cochées.

Les contrôles du code, de la base, des fonctions et du site se lancent d'un coup, en lecture seule :
`docs/replication/scripts/05-verifier.sh <réf> <adresse du site>`. Restent à la main les écrans et les tests.

## Le code

- [ ] La branche déployée est `main`, au même commit que la production (`git rev-parse --short HEAD` → `edcc610` au relevé ;
      comparer avec le commit du dernier déploiement Vercel de la production).
- [ ] La page construite est identique à l'octet près (au commit `edcc610`) :
      ```
      f77614734341ddca2bd97d22a15bd431451fbb0264bf3f37a9b8b48ce2e44214  app/lnp.html
      229e3553c542ea6bdc0504b63170748eae396e784e57936d6671d782630e9daa  web/public/index.html
      ```
      (`sha256sum app/lnp.html web/public/index.html`). `./build.sh --verify` ne s'applique pas : `app/EXPECTED.sha256` décrit
      l'ancienne référence (chapitre 06).
- [ ] Aucune clé dans le dépôt : `git grep -nE "sbp_[0-9a-f]{20}|sb_secret_[A-Za-z0-9_-]{20}|eyJhbGciOi[A-Za-z0-9_-]{20}|sk-ant-[A-Za-z0-9_-]{20}"`
      ne trouve rien (les préfixes seuls, cités dans la documentation, ne comptent pas).

## La base (Supabase)

Requêtes à lancer dans l'éditeur SQL de la réplique :

```sql
select (select count(*) from pg_tables where schemaname = 'public')                          as tables,      -- 53
       (select count(*) from pg_tables where schemaname = 'public' and rowsecurity)          as avec_rls,    -- 53
       (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public')                                                         as fonctions,   -- 176 (212 si pgcrypto est dans public)
       (select count(*) from pg_views where schemaname = 'public')                           as vues,        -- 1
       (select count(*) from pg_trigger t join pg_class c on c.oid = t.tgrelid
         join pg_namespace n on n.oid = c.relnamespace
         where n.nspname = 'public' and not t.tgisinternal)                                  as declencheurs,-- 11
       (select count(*) from cron.job where active)                                          as taches;      -- 11
select extname from pg_extension order by 1;
  -- citext, pg_cron, pg_net, pg_stat_statements, pgcrypto, plpgsql, supabase_vault, uuid-ossp
select string_agg(tablename, ', ' order by tablename) from pg_publication_tables where pubname = 'supabase_realtime';
  -- crm_sla_alerts, docs
select key from crm_settings order by key;            -- les 17 clés du chapitre 08
select engine, tiers from crm_ca_config;              -- lite ; haiku, haiku, sonnet (chapitre 08)
```

- [ ] Les six compteurs, les extensions, la publication temps réel, les 17 clés de `crm_settings` et `crm_ca_config` sont ceux
      attendus.
- [ ] Les 11 tâches planifiées ont les mêmes noms et fréquences que le chapitre 08, et `cron.job_run_details` montre des
      exécutions réussies (celles qui appellent une fonction ont besoin de `crm_settings.functions_url`).
- [ ] L'historique des migrations a une entrée par fichier `web/supabase/0*.sql` (62 ; la production en a 61 : la 056 y est appliquée sans entrée, chapitre 08).
- [ ] Les tests SQL passent sur un Postgres local : `web/supabase/tests/run.sh` (45 fichiers `*_test.sql`).

## Les fonctions Edge

- [ ] 10 fonctions actives, toutes `verify_jwt = false` : `iclosed-in`, `fathom-in`, `whatsapp-in`, `whop-in`, `lead-in`,
      `process-inbox`, `crm-import`, `sla-tick`, `callqa-llm`, `simulateur`.
- [ ] Les secrets nécessaires existent (chapitre 08) ; aucun secret obsolète (`SENDBLUE_INBOUND_TOKEN`).
- [ ] Tests : `deno test --allow-env --allow-read supabase/tests` (12 fichiers) passe.
- [ ] Un rendez-vous iClosed de test apparaît dans Leads et le Pipeline en moins de 2 minutes (`process-inbox` chaque minute).

## Le site (Vercel)

- [ ] Projet relié au dépôt, branche de production `main`, Root Directory `web`, aucune commande de build.
- [ ] Variables : `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SITE_URL`, `SUPABASE_SERVICE_ROLE_KEY` ; `BOOTSTRAP_TOKEN` absent.
- [ ] `https://<site>/version.json` répond le même identifiant de build que la production.
- [ ] Tests du connecteur et de l'API : `cd web && npm ci && npm test`.

## Les écrans (avec un compte administrateur)

Ouvrir chaque écran, sans erreur dans la console et sans texte anglais (`CLAUDE.md`, « Vérifier après un changement ») :

- [ ] Cockpit commercial (7 j, 30 j, 8 sem. ; onglets Exécution, Qualité, Impact, Résultats).
- [ ] Cycle de vente (« Agir maintenant », Aujourd'hui, Demain, Passer ; la fiche du lead à droite).
- [ ] Leads et la fiche d'un lead ; Pipeline ; Alertes (écran, pastille).
- [ ] Analyse d'appel d'un appel analysé (notes, « Pour ton prochain appel », qualification, découverte, écart, objections).
- [ ] Entraînement : Découverte, Maîtrise de l'offre, Résultats, Suivi des commerciaux, Simulateur (une partie en texte).
- [ ] Paramètres : Alertes, Compte, Accès ; chaque « Mode d'emploi ».

Tests d'écrans (Playwright, Chromium), tous sur `$PWD/app/lnp.html` et un dossier de sortie :

```bash
node app/crm/sales_cycle_accept.js $PWD/app/lnp.html /tmp/ecrans
node app/cycle_day_test.js $PWD/app/lnp.html /tmp/ecrans
node app/crm/cycle_fiche_live.js $PWD/app/lnp.html /tmp/ecrans
node app/crm/etapes_live.js $PWD/app/lnp.html /tmp/ecrans
node app/crm/setting_live.js $PWD/app/lnp.html /tmp/ecrans
node app/crm/fiche_analyse_live.js $PWD/app/lnp.html /tmp/ecrans
node app/crm/analyse_decouverte_test.js $PWD/app/lnp.html /tmp/ecrans
node app/alertes_test.js $PWD/app/lnp.html /tmp/ecrans
node app/sales_exec_test.js $PWD/app/lnp.html /tmp/ecrans
node app/training/training_test.js $PWD/app/lnp.html /tmp/ecrans
node app/training/academie_test.js $PWD/app/lnp.html /tmp/ecrans
node app/training/results_test.js $PWD/app/lnp.html /tmp/ecrans
node app/training/simulateur_test.js $PWD/app/training/simulateur.html /tmp/ecrans
node app/crm/data.test.js
node app/crm/transcript_parse.test.js
```

## L'analyse d'appel (chapitre 09)

- [ ] `cd call-analysis/engine && python3 -m pytest -q tests` (les cas qui demandent le corpus réel sont ignorés sans lui).
- [ ] `cd call-analysis/lite && python3 -m pytest -q tests` ; `cd call-analysis/worker && python3 -m pytest -q tests` ;
      `cd call-analysis/qa && python3 -m pytest -q tests`.
- [ ] Le workflow « Call analysis » a tourné à l'heure et une analyse apparaît dans la fiche d'un lead (`crm_ca_jobs` en `done`).
- [ ] Le coût moyen d'une analyse (`usage.usd` des tâches) reste sous le plafond (chapitre 09).
