# 07 · Procédure de réplication

Objectif : une copie complète et indépendante de LNP, **identique à la production** (chapitre 08), avec ses propres comptes et sa
propre base. Compter une journée pour l'installation, hors branchement des outils externes et reprise des données.

Trois règles :
- **Chaque compte appartient à la nouvelle installation** (GitHub, Supabase, Vercel, outils). Ne jamais réutiliser une clé, un
  jeton ou un projet de la production.
- **La page est déjà construite** : `app/lnp.html` fait foi (`CLAUDE.md`, « Interface en production »). **Ne pas lancer
  `./build.sh`** : il régénérerait la page depuis des générateurs qui n'ont pas encore reçu l'interface actuelle, et l'effacerait.
- **Aucune donnée ne se copie avec le code** : le dépôt ne contient ni clé ni donnée personnelle. Les données du CRM, les
  transcriptions et le jeu de référence de l'analyse d'appel restent dans la base et le stockage d'origine (§ 9 pour une reprise
  de données, si elle est décidée).

## 1. Le code

1. Recevoir le code (au choix) :
   - un accès au dépôt `LNP-Business/LNP` (ou un transfert, ou un fork dans l'organisation du collègue) ;
   - une copie autonome : `git clone --mirror` (tout l'historique et toutes les branches), ou le paquet Git remis avec ce dossier
     (`git clone -b main lnp.bundle LNP`).
2. Se placer sur `main` : c'est la version en production (commit `edcc610` au relevé du chapitre 08). Les branches non fusionnées
   (PR `#81`, `#82`, `#83`, analyse d'appel) ne tournent pas en production.
3. Créer le dépôt de la nouvelle installation (privé conseillé) et y pousser `main` :
   ```bash
   git remote set-url origin git@github.com:<organisation>/<dépôt>.git
   git push -u origin main
   ```
4. Vérifier que la page est identique à l'octet près (chapitre 10) :
   ```bash
   sha256sum app/lnp.html web/public/index.html
   ```

Prérequis sur le poste : Git, Python 3.10+, Node 22, la CLI Supabase (pour le déploiement manuel des fonctions), Deno 2 (tests des
fonctions), Postgres 16 en local (tests SQL), Playwright avec Chromium (tests d'écrans).

## 2. Supabase : le projet et la base

1. Créer un projet Supabase (région `eu-central-1` comme la production, Postgres 17). Noter la réf. du projet.
2. Appliquer **dans l'ordre** les 62 fichiers `web/supabase/001_init.sql`, `003_crm_core.sql` … `063_crm_ca_corrections.sql`
   (il n'y a pas de `002`). Méthode conseillée, qui trace chaque migration dans l'historique :
   ```bash
   for f in web/supabase/0*.sql; do
     n=$(basename "$f" .sql)
     jq -Rs --arg n "$n" '{query: ., name: $n}' "$f" |
       curl -sf -X POST "https://api.supabase.com/v1/projects/<réf>/database/migrations" \
         -H "Authorization: Bearer <jeton personnel Supabase>" -H "Content-Type: application/json" --data-binary @- \
       || { echo "échec : $n"; break; }
   done
   ```
   (ou l'éditeur SQL, fichier par fichier, dans le même ordre). Une migration qui échoue arrête la boucle : corriger, puis reprendre
   à partir d'elle.
3. Réglages à adapter avant ou juste après les migrations (chapitre 03, § 13) :
   - `crm_sales_team` : les commerciaux et setters (clé `rep` = la partie avant `@` de leur e-mail d'hôte iClosed) ;
   - `crm_settings` : `team_email_domains`, `internal_domains`, `default_owner`, `offer_catalogue`, `setting`, `sla_alerts`
     (dont `link`), destinataires de `alert_rule_defaults` ; recopier les valeurs de la production si la réplique doit se
     comporter à l'identique (elles ne sont pas dans le dépôt quand elles ont été changées depuis l'écran) ;
   - `crm_ca_config` : `engine = 'lite'`, `tiers` = `{"fast": "claude-haiku-5-5", "strong": "claude-haiku-5-5", "arbiter":
     "claude-sonnet-5-5"}` (valeurs de la production).
4. Contrôles (chapitre 10) : 53 tables, RLS partout, 176 fonctions, 11 déclencheurs, 1 vue, les 8 extensions, 11 tâches
   `cron.job` actives.
5. Authentification (Authentication › URL Configuration) : `Site URL` = l'adresse du site, `Redirect URLs` = `https://<site>/**`.
   Fermer l'inscription libre (Sign In / Providers › décocher « Allow new users to sign up ») : les comptes se créent par
   invitation (la production l'a encore ouverte, chapitre 08).
6. Temps réel : la publication `supabase_realtime` doit contenir `crm_sla_alerts` (créé par `053_crm_alertes.sql`) et `docs`.
7. Stockage : créer le seau privé `callqa-fixtures` (il recevra le jeu de référence de la mesure de l'analyse d'appel, § 7).

## 3. Fonctions Edge

1. Secrets du dépôt GitHub (Settings › Secrets and variables › Actions) : `SUPABASE_ACCESS_TOKEN` (jeton personnel Supabase d'un
   compte qui ne voit que ce projet), `SUPABASE_PROJECT_REF`, `SUPABASE_SERVICE_ROLE_KEY` (la clé **secrète** du projet,
   `sb_secret_…`, Project Settings › API Keys : `callqa-llm` refuse l'ancienne clé `service_role`) ; variable
   `SUPABASE_URL` = `https://<réf>.supabase.co`.
2. GitHub › Actions › « CRM functions » › Run workflow sur `main` : les tests passent puis les 10 fonctions sont déployées
   (`supabase functions deploy <f> --no-verify-jwt`). Contrôle : `iclosed-in`, `fathom-in`, `whatsapp-in`, `whop-in`,
   `lead-in`, `process-inbox`, `crm-import`, `sla-tick`, `callqa-llm`, `simulateur` (chapitre 04).
3. Activer les tâches planifiées qui appellent des fonctions :
   ```sql
   insert into crm_settings (key, value, is_proposal)
   values ('functions_url', '"https://<réf>.supabase.co/functions/v1"', false)
   on conflict (key) do update set value = excluded.value;
   ```
4. Secrets des fonctions (Edge Functions › Secrets), aux comptes de la nouvelle installation (chapitre 08 pour la liste et qui
   les lit) : `ANTHROPIC_API_KEY`, `ICLOSED_API_KEY`, `ICLOSED_INBOUND_TOKEN`, `FATHOM_API_KEY`, `WHATSAPP_INBOUND_TOKEN` et
   `WHATSAPP_APP_SECRET`, `FUNNEL_INBOUND_TOKEN` ; facultatifs : `ELEVENLABS_API_KEY` (voix du Simulateur),
   `SLACK_SALES_CYCLE_WEBHOOK_URL` (copie Slack des alertes), `CLOSE_API_KEY` (import d'historique). Sans son secret, une fonction
   répond une erreur claire et n'écrit rien.

## 4. Vercel

1. Compte Vercel de la nouvelle installation (offre Pro pour un usage commercial), application GitHub de Vercel autorisée sur le
   seul dépôt.
2. Add New › Project › importer le dépôt. **Root Directory = `web`**, Framework Preset = **Other**, aucune commande de build
   (`web/vercel.json` : sortie `public`, en-têtes, réécritures OAuth).
3. Variables : `SUPABASE_URL`, `SUPABASE_ANON_KEY` (production, aperçu, développement), `SUPABASE_SERVICE_ROLE_KEY` (sensible ;
   production et aperçu), `SITE_URL` (l'adresse du site), et temporairement `BOOTSTRAP_TOKEN` (longue chaîne aléatoire). Deploy.
4. Domaine : Settings › Domains (adresse `<nom>.vercel.app` ou domaine acheté). Reporter l'adresse dans Supabase (§ 2.5) et dans
   `crm_settings.sla_alerts.link` :
   ```sql
   update crm_settings set value = value || '{"link": "https://<site>/#crm"}'::jsonb where key = 'sla_alerts';
   ```

## 5. Premier administrateur et équipe

1. ```bash
   curl -sS -X POST https://<site>/api/bootstrap -H "x-bootstrap-token: <BOOTSTRAP_TOKEN>" \
     -H "content-type: application/json" -d '{"email":"<e-mail>"}'
   ```
   La réponse contient un lien au format de l'application (`https://<site>/#lnp-link=…`), aucun e-mail n'est envoyé.
2. Supprimer `BOOTSTRAP_TOKEN` dans Vercel et redéployer (sinon `/api/bootstrap` reste ouvert).
3. Ouvrir le lien, choisir le mot de passe, inviter l'équipe (Paramètres › Compte), régler les accès par écran (Paramètres ›
   Accès : `salescockpit`, `salescycle`, `crm`, `entrainement`, `academie`, `simulateur`, `settings`, `claude`), saisir le numéro
   WhatsApp Business de chaque commercial et setter.

## 6. Outils externes (chapitre 04)

1. iClosed : webhook vers `https://<réf>.supabase.co/functions/v1/iclosed-in` avec le jeton `ICLOSED_INBOUND_TOKEN` ; les imports
   horaires (contacts, appels, ventes) lisent l'API avec `ICLOSED_API_KEY`.
2. Fathom : rien à brancher, `crm-fathom-hourly` lit l'API toutes les heures (`FATHOM_API_KEY`).
3. WhatsApp Business (API officielle en coexistence, un numéro par commercial et par setter) : webhook vers
   `…/functions/v1/whatsapp-in` (chapitre 04 pour le jeton de vérification et la signature `WHATSAPP_APP_SECRET`).
4. Funnels : webhook vers `…/functions/v1/lead-in` avec `FUNNEL_INBOUND_TOKEN`.
5. Whop : webhook vers `…/functions/v1/whop-in`.
6. Slack (facultatif) : webhook entrant dans `SLACK_SALES_CYCLE_WEBHOOK_URL`, copie activée dans les règles d'alerte.
7. Historique : `crm-import` toujours d'abord à blanc (`dry=1`), puis pour de bon (chapitre 04).

## 7. Analyse d'appel (chapitre 09)

1. Secret `ANTHROPIC_API_KEY` (§ 3.4), secrets GitHub du § 3.1 : le workflow « Call analysis » tourne toutes les heures à la
   minute 7 et analyse les appels en file.
2. La mesure (`call-analysis/qa`) a besoin d'un jeu de référence privé dans `callqa-fixtures` (lectures expertes et analyses, avec
   des transcriptions) : il ne se copie pas, il se reconstitue sur les appels de la nouvelle installation (chapitre 09).
3. Qualification des leads : workflow `qualification.yml` (à la demande) et étape de l'analyse (chapitre 09).

## 8. Connecteur Claude (facultatif)

Dans Claude : Settings › Connectors › Add custom connector › URL `https://<site>/api/mcp`, puis Connect avec un compte de
l'application. L'accès se règle par la clé `claude` dans Paramètres › Accès (chapitre 05).

## 9. Reprise des données (seulement si elle est décidée)

Le dossier réplique l'application, pas ses données. Une reprise des données de la production (prospects, cycles, appels,
transcriptions, analyses, résultats d'entraînement) touche des données personnelles : elle demande l'accord du responsable de la
production, un export par la base (`pg_dump` du schéma `public` et du schéma `auth` pour les comptes), et un transfert chiffré.
Ne jamais faire passer ces données par le dépôt, une messagerie ou un document partagé.

## Annexe · Une autre marque

Pour une copie au nom d'une autre entreprise : changer `edition.json` (`wordmark`, `logo`, `brand`, `title`, `recolor`, `fonts`,
`rename`, chapitre 06), reporter couleurs et polices dans `web/public/lnp-web.js` et `web/api/oauth.js`, remplacer « LNP »,
« Les Nouveaux Profs » et `lnp-sales.vercel.app` dans les textes, les données d'exemple et le nom du serveur MCP. Tant que
l'interface actuelle n'est pas reportée dans les générateurs, ces changements se font **dans `app/lnp.html`** (et non par
`./build.sh`), puis `python3 web/build_web.py` et `node web/kb/build_kb.mjs`.
