# 07 · Procédure de réplication

Objectif : une copie complète et indépendante de LNP pour une autre entreprise (appelée « NOUVEAU » ci-dessous), avec ses propres
comptes, sa propre base et sa propre marque. Compter une demi-journée pour l'installation, hors branchement des outils externes.

Règle d'or : **chaque compte appartient à la nouvelle entreprise** (créé avec son e-mail). Ne jamais réutiliser une clé, un token
ou un projet de LNP.

## 1. Le dépôt

1. Créer l'organisation GitHub de NOUVEAU et un dépôt (privé conseillé).
2. Y copier le dépôt LNP (« Import repository », ou `git clone` puis `git push` vers le nouveau dépôt).
3. Changer la marque dans `edition.json` (chapitre 06) : `wordmark`, `logo` (nouveau PNG dans `skl-os/brand/`), `brand`, `title`,
   `recolor`, `fonts` ; reporter les couleurs et polices dans `web/public/skl-web.js` et `web/api/oauth.js`.
4. Remplacer les mentions « LNP », « Les Nouveaux Profs » et l'adresse `lnp-sales.vercel.app` dans les textes : `edition.json`
   (`rename`), `LNP.md`, `CLAUDE.md`, `README.md`, `docs/`, les données d'exemple (`skl-os/store.js` : équipe de démonstration ;
   `docs/crm/reference/sales-cycle-v6.html` : messages d'exemple « de LNP »), le nom du serveur MCP (`web/api/mcp.js`).
5. `./build.sh`, puis ouvrir `skl-os/skl-os-en.html` et vérifier chaque écran (chapitre 06, « Tests »). Quand la page est validée :
   `cd skl-os && sha256sum skl-os-en.html > EXPECTED.sha256` pour fixer la nouvelle référence.

## 2. Supabase

1. Créer un compte et un projet Supabase (région proche des utilisateurs ; LNP : `eu-central-1`). Noter la réf. du projet.
2. Appliquer, dans l'ordre, `web/supabase/001_init.sql` puis `003` … `034` (éditeur SQL, ou CLI, ou API de gestion
   `POST /v1/projects/{ref}/database/migrations` pour qu'elles soient tracées). Il n'y a pas de `002`.
   - Avant `019_crm_sales_team.sql`, ou après dans la table : les commerciaux de NOUVEAU (`insert into crm_sales_team (rep, name) …` ;
     `rep` = la partie avant `@` de leur e-mail d'hôte iClosed, ou leur clé de membre CRM).
   - `003_crm_core.sql` : `team_email_domains` = les domaines e-mail de NOUVEAU (distingue invités internes et externes) ; revoir les
     destinataires des règles d'alerte (`"romain"`, `"lead"`, `"owner"`) et `default_owner`.
   - `006_crm_cron.sql` crée les tâches planifiées ; elles ne font rien tant que `functions_url` n'existe pas (étape 3).
3. Vérifier : 41 tables dans `public`, RLS active partout, 4 tâches dans `cron.job`, extensions `pgcrypto`, `citext`, `pg_net`,
   `pg_cron` (chapitre 08 : l'état attendu).
4. Authentification (Authentication › URL Configuration) : `Site URL` = l'adresse du site, `Redirect URLs` = `https://<site>/**`
   (à faire après l'étape 4 si l'adresse n'est pas encore connue).

## 3. Fonctions Edge

1. Secrets GitHub du dépôt (Settings › Secrets and variables › Actions) : `SUPABASE_ACCESS_TOKEN` (token Supabase créé pour ce
   déploiement, sur un compte qui ne voit que les projets de NOUVEAU), `SUPABASE_PROJECT_REF` (la réf.), `SUPABASE_SERVICE_ROLE_KEY`
   (clé `service_role` du projet) ; variable `SUPABASE_URL` = `https://<ref>.supabase.co`.
2. GitHub › Actions › « CRM functions » › Run workflow sur `main` : les 8 fonctions sont déployées (`--no-verify-jwt --yes`).
   Contrôle : Supabase › Edge Functions montre `iclosed-in`, `fathom-in`, `sendblue-in`, `whop-in`, `process-inbox`, `crm-import`,
   `sla-tick`, `callqa-llm`.
3. Activer les tâches planifiées :
   ```sql
   insert into crm_settings (key, value, is_proposal)
   values ('functions_url', '"https://<ref>.supabase.co/functions/v1"', false)
   on conflict (key) do update set value = excluded.value;
   ```
4. Secrets des fonctions (Supabase › Edge Functions › Secrets), comptes de NOUVEAU : `ICLOSED_API_KEY`, `ICLOSED_INBOUND_TOKEN`,
   `FATHOM_API_KEY`, `SENDBLUE_API_KEY_ID`, `SENDBLUE_API_SECRET`, `CLOSE_API_KEY` (si utilisé), `ANTHROPIC_API_KEY`,
   `SLACK_SALES_CYCLE_WEBHOOK_URL`. Sans un secret, la fonction concernée répond une erreur claire et n'écrit rien.

## 4. Vercel

1. Créer le compte Vercel de NOUVEAU (offre Pro pour un usage commercial), autoriser l'application GitHub de Vercel sur le seul dépôt.
2. Add New › Project › importer le dépôt. **Root Directory = `web`**, Framework Preset = **Other**, rien d'autre (`web/vercel.json`).
3. Variables d'environnement : `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (Sensitive), `SITE_URL`
   (l'adresse du site), et temporairement `BOOTSTRAP_TOKEN` (longue chaîne aléatoire). Deploy.
4. Domaine : Settings › Domains › l'adresse gratuite `<nom>.vercel.app` (Edit pour la choisir) ou un domaine acheté.
5. Revenir à l'étape 2.4 (URL du site dans Supabase) et mettre `crm_settings.sla_alerts.link` = `https://<site>/#crm` :
   ```sql
   update crm_settings set value = value || '{"link": "https://<site>/#crm"}'::jsonb where key = 'sla_alerts';
   ```

## 5. Premier administrateur

1. ```bash
   curl -sS -X POST https://<site>/api/bootstrap -H "x-bootstrap-token: <BOOTSTRAP_TOKEN>" -H "content-type: application/json" -d '{"email":"<e-mail>"}'
   ```
   La réponse contient un lien d'invitation (aucun e-mail n'est envoyé). Les liens Supabase classiques sont à usage unique et peuvent
   être consommés par l'aperçu d'une messagerie : préférer le format de l'application, `https://<site>/#skl-link=<hashed_token>&type=recovery`
   (c'est celui que produit Paramètres › Compte pour les invitations suivantes).
2. Supprimer `BOOTSTRAP_TOKEN` dans Vercel et redéployer (sinon `/api/bootstrap` reste ouvert).
3. Ouvrir le lien, choisir le mot de passe, inviter l'équipe depuis Paramètres › Compte, régler les accès dans Paramètres › Accès.

## 6. Outils externes (chapitre 04)

1. iClosed : webhook vers `https://<ref>.supabase.co/functions/v1/iclosed-in` (RDV pris, reporté, annulé, contact modifié) avec le
   jeton `ICLOSED_INBOUND_TOKEN`.
2. Sendblue : webhook vers `…/functions/v1/sendblue-in`.
3. Fathom : rien à brancher, la tâche `crm-fathom-hourly` lit l'API toutes les heures (`FATHOM_API_KEY`).
4. Whop : webhook vers `…/functions/v1/whop-in` (stocké brut ; les encaissements se saisissent à la main en attendant son traitement).
5. Slack : webhook entrant du canal des alertes dans `SLACK_SALES_CYCLE_WEBHOOK_URL`.
6. Historique : `crm-import` avec `?source=iclosed&dry=1`, puis sans `dry` ; idem `close`, `iclosed_calls`, `sendblue`, `fathom`
   (`&since=`) ; toujours un essai à blanc d'abord.

## 7. Analyse d'appel

1. Secret Supabase `ANTHROPIC_API_KEY` ; secret GitHub `SUPABASE_SERVICE_ROLE_KEY` et variable `SUPABASE_URL` (étape 3.1).
2. Le workflow « Call analysis » tourne toutes les heures et analyse les appels R1 / R2 en file. Lancement manuel possible.
3. Les tests de l'annexe B demandent un corpus de transcriptions réelles dans le bucket `callqa-fixtures` (jamais dans git) ; sans lui,
   voir la note du chapitre 06.

## 8. Connecteur Claude (facultatif)

Dans Claude : Settings › Connectors › Add custom connector › URL `https://<site>/api/mcp`, puis Connect (connexion avec le compte de
l'application). L'accès se règle par la clé `claude` dans Paramètres › Accès (chapitre 05).

## Liste de contrôle finale

- [ ] `./build.sh --verify` affiche OK sur la nouvelle référence.
- [ ] Le site s'ouvre sur le Cockpit commercial, aux couleurs et au nom de NOUVEAU, sans texte d'une autre entreprise.
- [ ] Connexion de l'administrateur, invitation d'un membre, accès par écran.
- [ ] 41 tables, RLS partout, 4 tâches planifiées qui réussissent (`cron.job_run_details`), 33 migrations tracées (`001`, puis `003` à `034`).
- [ ] 8 fonctions Edge actives ; `sla-tick` répond « secret manquant » tant que Slack n'est pas branché, puis poste dans le canal.
- [ ] Un RDV iClosed de test apparaît dans le Pipeline en moins de 2 minutes.
- [ ] Les workflows GitHub passent (hors corpus de l'analyse d'appel).
- [ ] `BOOTSTRAP_TOKEN` supprimé de Vercel.
- [ ] Aucune clé dans le dépôt (`git grep -nE "sbp_|eyJhbGci|sk-ant-"` ne trouve rien).
