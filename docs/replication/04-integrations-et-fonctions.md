# 04 · Intégrations et fonctions Edge

Ce chapitre décrit tout ce qui tourne côté serveur en dehors de la page et de l'édition web : les dix fonctions Edge de
`supabase/functions/`, leurs modules partagés (`supabase/functions/_shared/`), les tâches planifiées qui les appellent, ce qu'il
faut configurer chez chaque service externe, et la passerelle de modèle de l'analyse d'appel (`callqa-llm`). Le worker et le
moteur de l'analyse d'appel sont décrits au chapitre 09. Chaque fait vient du code ; le fichier est cité. Quand `docs/crm/` dit
autre chose que le code, c'est le code qui fait foi (voir §14).

Aucun secret n'apparaît ici : seuls les **noms** des secrets sont donnés. L'état de la production (versions déployées, secrets
présents, tâches actives) est relevé au chapitre 08.

---

## 1. Vue d'ensemble

```
Fournisseur ──POST──► <source>-in ──► crm_webhook_log (requête brute)
  iClosed, Fathom, WhatsApp,                  │  pg_cron chaque minute (crm-process-inbox)
  Whop, funnels (lead-in)                     ▼
                                       process-inbox ── mapper ──► crm_apply_* (une transaction par ligne)
                                                                      │
                     crm_people / crm_cycles / crm_calls / crm_events … ──► crm_recompute_cycle

pg_cron :03 / :15 / :41 ──► crm-import ?source=iclosed | iclosed_calls | iclosed_deals ──► API iClosed
pg_cron :23            ──► crm-import ?source=fathom&queue=1 ──► API Fathom ──► crm_import_recordings ──► crm_ca_jobs
pg_cron */5 min        ──► sla-tick ──► sla_rules.js ──► crm_sync_sla_alerts (alertes du CRM)
                                                   └──► (facultatif) crm_sla_claim ──► Slack
pg_cron */10 min       ──► simulateur/balayer (analyses du Simulateur en attente)
page (Entraînement › Simulateur) ──► simulateur (jeton de la personne) ──► API Anthropic, ElevenLabs (facultatif)
GitHub Actions :07     ──► worker d'analyse d'appel ──► callqa-llm ──► API Anthropic          (chapitre 09)
```

| Fonction | Rôle | Déclencheur | Authentification de l'appelant |
|---|---|---|---|
| `iclosed-in` | Stocke le webhook iClosed brut | Webhook natif iClosed (ou un Zap) | Jeton `ICLOSED_INBOUND_TOKEN` en `?k=` ou en en-tête `x-lnp-token` |
| `fathom-in` | Stocke le webhook Fathom brut | Webhook Fathom (non utilisé en production, §5.3) | Signature Standard Webhooks, `FATHOM_WEBHOOK_SECRETS` ou `FATHOM_WEBHOOK_SECRET` |
| `whatsapp-in` | Stocke le webhook WhatsApp Business brut ; répond à la vérification d'adresse de Meta (`GET`) | Webhooks WhatsApp Business (API officielle en coexistence) `messages`, `smb_message_echoes`, `history` | Jeton `WHATSAPP_INBOUND_TOKEN` en `?k=` (fournisseur) ou signature `X-Hub-Signature-256` (Meta, secret `WHATSAPP_APP_SECRET`) |
| `whop-in` | Stocke le webhook Whop brut | Webhooks Whop | Signature Standard Webhooks, `WHOP_WEBHOOK_SECRET` |
| `lead-in` | Stocke le lead brut d'un funnel (quiz, VSL, quiz abandonné, webinaire) | L'outil du funnel (ou un outil d'automatisation) | Jeton `FUNNEL_INBOUND_TOKEN` en `?k=` ou en en-tête `x-lnp-token` |
| `process-inbox` | Transforme les lignes brutes en faits du CRM | pg_cron chaque minute (`crm-process-inbox`) | Aucune (ne prend aucune entrée) |
| `crm-import` | Imports (Close, iClosed, Fathom), rapports, sondes | pg_cron (minutes 3, 15, 23, 41) et appels manuels | Aucune ; noms dans un rapport seulement avec `x-lnp-token` = `CRM_REPORT_TOKEN` |
| `sla-tick` | Ouvre, fait monter et ferme les alertes du CRM ; copie Slack facultative | pg_cron toutes les 5 min (`crm-sla-tick`) | Aucune (ne prend aucune entrée) |
| `callqa-llm` | Passerelle de modèle du worker d'analyse d'appel | Le worker (GitHub Actions) | Bearer = clé de service (`SUPABASE_SERVICE_ROLE_KEY` ou `SUPABASE_SECRET_KEY`) |
| `simulateur` | Entraînement › Simulateur : appel simulé, voix, analyse de fin d'appel, offres et prospects | La page ; pg_cron toutes les 10 min (`simulateur/balayer`) | Jeton Supabase de la personne (membre actif de `crm_members`) ; `balayer` sans authentification |

Les points d'entrée sont minimes : `supabase/functions/<nom>/index.ts` importe un module de `_shared/` et appelle
`Deno.serve(...)`. La logique est dans `_shared/`, ce qui permet de la tester sans réseau (`supabase/tests/`). Deux exceptions :
`crm-import/index.ts` porte le routage des paramètres et sa fonction `restTable`, `sla-tick/index.ts` exporte `tick(...)`.

## 2. Déploiement, configuration et planification

### 2.1 `supabase/config.toml`

Le dossier `supabase/` est l'espace de travail de la CLI Supabase pour les fonctions seulement (le schéma est géré par les
fichiers SQL numérotés de `web/supabase/`). `project_id = "lnp"` (identifiant technique). Les dix fonctions ont
`verify_jwt = false` : aucun fournisseur n'envoie de JWT Supabase ; chacune vérifie elle-même son jeton ou sa signature, ou ne
prend aucune entrée. `simulateur` vérifie le jeton Supabase de la personne elle-même, et le lit aussi dans le corps pour la fin
d'un appel envoyée par `sendBeacon` (qui ne peut pas porter d'en-tête).

`supabase/scripts/export_fixtures.py` : exporte des lignes `crm_webhook_log` en fixtures anonymisées
(`docs/crm/fixtures/<source>-<événement>.json`) ; `--live` lit la base avec `SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` de
l'environnement, `--dry-run` n'écrit rien.

### 2.2 Déploiement (`.github/workflows/crm-functions.yml`)

- Déclenché sur `push` vers `main` ou `crm-*`, sur `pull_request` (chemins `supabase/**`, `web/supabase/**`, `app/crm/**`,
  `web/api/**`, `web/tests/**`, `web/package*.json`, le workflow lui-même) et à la main (`workflow_dispatch`).
- Job `test` : Deno 2.x, `deno check supabase/functions/*/index.ts` puis `deno test --allow-env --allow-read supabase/tests`.
- Job `sql` : Postgres 16 en service, `web/supabase/tests/run.sh` puis `node app/crm/data.test.js`.
- Job `connector` : Node 22, `cd web && npm ci && npm test` (chapitre 05).
- Job `deploy` (après `test` et `sql`, seulement sur `main` hors PR) : ignoré avec un avis tant que les secrets GitHub
  `SUPABASE_ACCESS_TOKEN` et `SUPABASE_PROJECT_REF` manquent ; sinon `supabase/setup-cli@v1` (version `latest`) puis, pour
  chaque fonction `iclosed-in fathom-in whatsapp-in whop-in lead-in process-inbox crm-import callqa-llm sla-tick simulateur` :
  `supabase functions deploy "$f" --remote="$PROJECT_REF" --no-verify-jwt --yes`.

Le job `deploy` n'attend pas `connector`. Les fonctions sont donc redéployées à chaque push sur `main` qui touche un des chemins
ci-dessus, y compris une modification de `web/api/**` seule.

### 2.3 Variables fournies par Supabase

`SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` sont injectées par Supabase dans chaque fonction (ne pas les créer).
`callqa-llm` et `simulateur` acceptent aussi `SUPABASE_SECRET_KEY` comme clé de service (nouveau format de clé).

### 2.4 Secrets des fonctions (noms seulement)

À créer dans Supabase › Edge Functions › Secrets (lus à chaque requête, sans redéploiement).

| Secret | Lu par | Origine | Obligatoire |
|---|---|---|---|
| `ICLOSED_INBOUND_TOKEN` | `iclosed-in` (`_shared/sources.ts`) | Généré par nous (48 lettres et chiffres : il va dans une URL) | Oui |
| `WHATSAPP_INBOUND_TOKEN` | `whatsapp-in` (`?k=` et `hub.verify_token` de la vérification de Meta) | Généré par nous (48 lettres et chiffres) | Pour WhatsApp |
| `WHATSAPP_APP_SECRET` | `whatsapp-in` (signature `X-Hub-Signature-256`) | Meta › application › secret de l'application | Seulement si Meta envoie directement les webhooks |
| `FUNNEL_INBOUND_TOKEN` | `lead-in` | Généré par nous (48 lettres et chiffres) | Pour les funnels |
| `FATHOM_WEBHOOK_SECRET` ou `FATHOM_WEBHOOK_SECRETS` | `fathom-in` | Fathom, à la création du webhook ; `…SECRETS` = objet JSON `id → secret` ou tableau JSON | Seulement avec un webhook Fathom |
| `WHOP_WEBHOOK_SECRET` | `whop-in` | Whop, à la création du webhook (`ws_…`) | Pour Whop |
| `FATHOM_API_KEY` | `crm-import ?source=fathom` | Fathom › Settings › API Access | Oui (appels de vente) |
| `ICLOSED_API_KEY` | `crm-import ?source=iclosed|iclosed_calls|iclosed_deals`, sondes, rapports | iClosed › Settings › Developers › API (préfixe `iclosed_` ajouté s'il manque) | Oui |
| `CLOSE_API_KEY` | `crm-import ?source=close`, `?report=statuses` | Close › Settings › Developer › API Keys | Import d'historique seulement |
| `CRM_REPORT_TOKEN` | `crm-import ?report=statuses` (noms dans la réponse) | Généré par nous, 32 caractères au moins | Non |
| `SLACK_SALES_CYCLE_WEBHOOK_URL` | `sla-tick` (copie Slack) | Slack, webhook entrant d'un canal | Non (copie éteinte par défaut) |
| `ANTHROPIC_API_KEY` | `callqa-llm`, `simulateur` | console.anthropic.com | Oui |
| `ELEVENLABS_API_KEY` | `simulateur` (voix du prospect) | ElevenLabs | Non : sans elle, le navigateur prête sa voix au prospect |

`docs/crm/setup.md` cite aussi `WHOP_API_KEY` et `WHOP_COMPANY_ID` : aucune fonction ne les lit. Un ancien secret
`SENDBLUE_INBOUND_TOKEN` n'est lu par aucune fonction (Sendblue abandonné le 9 novembre 2026, chapitre 08).

### 2.5 Tâches planifiées

Elles utilisent `pg_cron` et `pg_net`. L'URL de base des fonctions est un réglage du CRM, pas un secret :
`crm_settings` clé `functions_url`, valeur JSON `"https://<ref>.supabase.co/functions/v1"`. Sans cette ligne, aucune tâche
n'appelle de fonction Edge. Chaque appel est un `net.http_post` avec le corps `{}` et l'en-tête `content-type:
application/json`, **sans en-tête d'autorisation** (d'où les fonctions sans entrée). Chaque script désinscrit d'abord la tâche par
son nom (`cron.unschedule`) : il peut être rejoué.

| Tâche | Horaire (UTC) | Appel | Condition | Défini dans |
|---|---|---|---|---|
| `crm-process-inbox` | `* * * * *` | `POST <functions_url>/process-inbox`, délai 30 s | Il existe une ligne `crm_webhook_log` de source `iclosed`, `whatsapp`, `fathom` ou `funnel`, au statut `received` ou `failed`, avec `attempts < 8` | 006, redéfinie en 052 puis en 054 (ajout de `funnel`) |
| `crm-sla-tick` | `*/5 * * * *` | `POST <functions_url>/sla-tick`, délai 60 s | Toujours | 006 |
| `crm-setting-tick` | `*/10 * * * *` | SQL `select public.crm_setting_tick()` | — (webinaire et absents : passage au setter, §5.4) | 059 |
| `crm-simulateur-balayer` | `*/10 * * * *` | `POST <functions_url>/simulateur/balayer`, délai 60 s | Il existe une ligne `crm_sim_analyses` au statut `deferred` ou `processing` | 057 |
| `crm-iclosed-contacts-hourly` | `3 * * * *` | `POST <functions_url>/crm-import?source=iclosed`, délai 150 s | Toujours | 039 |
| `crm-iclosed-calls-hourly` | `15 * * * *` | `POST <functions_url>/crm-import?source=iclosed_calls`, délai 150 s | Toujours | 039 |
| `crm-assign-owners-hourly` | `20 * * * *` | SQL `select public.crm_assign_owners_from_hosts(false)` | — | 043 |
| `crm-fathom-hourly` | `23 * * * *` | `POST <functions_url>/crm-import?source=fathom&queue=1`, délai 120 s | Toujours | 006 |
| `crm-no-show-hourly` | `35 * * * *` | SQL `select public.crm_no_show_tick()` (règle des absences, §5.3) | Ne fait rien si `crm_settings.no_show_rule.enabled` n'est pas vrai (056 l'allume) | 006 |
| `crm-iclosed-deals-hourly` | `41 * * * *` | `POST <functions_url>/crm-import?source=iclosed_deals`, délai 120 s | Toujours | 037 |
| `crm-refusal-daily` | `17 3 * * *` | SQL `select public.crm_refusal_tick()` (disqualifié 6 mois après un refus) | — | 055 |

Les imports se gênent : un import refuse de démarrer tant qu'une ligne `crm_import_runs` est `running` depuis moins de 10 min
(§7.2) ; une tâche qui tombe pendant un autre import saute son heure.

Le worker d'analyse d'appel ne passe pas par pg_cron : il tourne dans GitHub Actions (`.github/workflows/call-analysis.yml`,
minute 7 de chaque heure, chapitre 09).

---

## 3. Réception des webhooks (`_shared/ingest.ts`, `_shared/sources.ts`, `_shared/verify/`)

### 3.1 Ce que fait chaque fonction `*-in`

`makeHandler(opts)` (commun aux cinq : `iclosed-in`, `fathom-in`, `whatsapp-in`, `whop-in`, `lead-in`) :

1. `GET` d'une source qui vérifie son adresse (`opts.verifyGet`, WhatsApp seulement) : `hub.mode=subscribe` et `hub.verify_token`
   égal à `WHATSAPP_INBOUND_TOKEN` → `200` avec le texte de `hub.challenge` ; mauvais jeton → `403 Forbidden` ; rien n'est
   stocké. Sinon, une méthode autre que `POST` → `405 POST only` (texte).
2. Corps de plus de 2 Mio (`MAX_BODY = 2 * 1024 * 1024`, vérifié sur `content-length` puis sur les octets lus) → `413 Body too large`.
3. Lit le corps **brut** en texte (les signatures portent sur les octets bruts), puis appelle `opts.check(req, raw, url)` ;
   une exception vaut échec.
4. Si la vérification passe et que la source donne un identifiant de livraison (`opts.deliveryId`), il est gardé ; une
   ligne rejetée n'a jamais d'identifiant de livraison (une requête forgée ne doit pas bloquer la vraie comme doublon).
5. Insère dans `crm_webhook_log` : `source`, `delivery_id`, `headers` (tous, sauf `authorization`, `cookie`, `apikey`,
   `x-lnp-token` et les en-têtes secrets propres à la source, remplacés par `"<redacted>"`), `body` (brut), `auth_ok`,
   `status` = `received` ou `rejected`.
6. Réponses : échec d'écriture → `500 Not stored, retry later` (le fournisseur réessaie) ; vérification échouée →
   `401 Unauthorized` (la ligne est quand même gardée, pour audit) ; doublon (HTTP 409 ou code `23505` de PostgREST) →
   `200 Duplicate, already stored` ; sinon `200 Stored`.
7. L'URL n'est jamais journalisée (un jeton est dans la chaîne de requête : iClosed, WhatsApp, funnels).

L'insertion passe par PostgREST avec la clé de service (`restInsert`, `prefer: return=minimal`). `crm_webhook_log` n'a aucune
politique RLS : seul le rôle de service y lit et écrit.

### 3.2 Table `crm_webhook_log` (`web/supabase/003_crm_core.sql`)

| Colonne | Type | Rôle |
|---|---|---|
| `id` | `bigint` identité | Clé |
| `source` | `event_source` (`iclosed`, `fathom`, `whatsapp`, `whop`, `funnel` (054), `crm`, `claude`, `rules`, `import`, `manual` (045) ; `sendblue` reste dans le type, jamais écrit) | Source |
| `delivery_id` | `text` | Identifiant de livraison du fournisseur ; index unique `(source, delivery_id)` quand non nul |
| `received_at` | `timestamptz` | Réception |
| `headers` | `jsonb` | En-têtes, secrets masqués |
| `body` | `text` | Corps exact |
| `auth_ok` | `boolean` | Résultat de la vérification à la réception |
| `status` | `inbox_status` (`received`, `processed`, `ignored`, `failed`, `unmatched`, `rejected`) | État de traitement |
| `attempts` | `int` | Tentatives en échec |
| `error` | `text` | Dernière erreur ou raison d'ignorer |
| `processed_at` | `timestamptz` | Dernier traitement |

### 3.3 Vérification par source (`_shared/sources.ts`)

| Source | Vérification | Identifiant de livraison |
|---|---|---|
| iClosed | `tokenMatches(x-lnp-token, ICLOSED_INBOUND_TOKEN)` **ou** `tokenMatches(?k=, ICLOSED_INBOUND_TOKEN)` | `zap.task_id` du contrat Zap s'il existe, sinon aucun |
| Fathom | `verifyStandardWebhook(secretList("FATHOM_WEBHOOK_SECRETS", "FATHOM_WEBHOOK_SECRET"), …)` | En-tête `webhook-id` |
| WhatsApp | `tokenMatches(?k=, WHATSAPP_INBOUND_TOKEN)` (fournisseur) **ou** `metaSignatureOk(X-Hub-Signature-256, corps brut, WHATSAPP_APP_SECRET)` (Meta directement : `sha256=<hex>`, HMAC-SHA256 du corps brut, comparé en temps constant) ; `GET` de vérification d'adresse : §3.1 | Aucun : une requête porte plusieurs messages, chacun retrouvé par son identifiant WhatsApp (`wamid`) |
| Funnels (`lead-in`) | `tokenMatches(x-lnp-token, FUNNEL_INBOUND_TOKEN)` **ou** `tokenMatches(?k=, FUNNEL_INBOUND_TOKEN)` | Aucun (le même identifiant de lead donne le même `source_id`, §5.4) |
| Whop | `verifyStandardWebhook(secretList("WHOP_WEBHOOK_SECRET"), …)` | En-tête `webhook-id` |

- `verify/token.ts` : `tokenMatches` hache les deux valeurs en SHA-256 puis compare en temps constant ; un secret vide ne
  correspond jamais.
- `verify/standard-webhooks.ts` : en-têtes `webhook-id`, `webhook-timestamp`, `webhook-signature`. Contenu signé
  `"<id>.<timestamp>.<corps brut>"`, HMAC-SHA256. Le timestamp doit être à moins de 300 s de l'heure courante. L'en-tête peut
  porter plusieurs signatures `v1,<base64>` séparées par des espaces : une seule suffit, pour l'un quelconque des secrets. Un
  secret `whsec_<base64>` est décodé ; tout autre secret (le `ws_…` de Whop) est pris comme octets bruts.
- `ingest.ts › secretList` accepte un secret simple, un objet JSON (valeurs) ou un tableau JSON.

---

## 4. Le worker `process-inbox` (`_shared/worker.ts`)

Appelé chaque minute par pg_cron, il ne lit rien de la requête. `processPending(rpc, limit = 50)` :

1. `crm_inbox_pending(p_sources := Object.keys(MAPPERS), p_limit := 50)` (`005_crm_pipeline.sql`), soit les sources
   `iclosed`, `whatsapp`, `fathom`, `funnel` : par `id` croissant, les lignes de ces sources avec `attempts < 8` et soit
   `status = 'received'`, soit `status = 'failed'` dont `coalesce(processed_at, received_at) + 2^(max(attempts-1,0))` minutes est
   passé (attente 1, 2, 4… minutes).
2. Pour chaque ligne :
   - `auth_ok` faux → `crm_inbox_mark(id, 'rejected', 'failed its token or signature check')` ;
   - le mapper de la source (`MAPPERS = { iclosed: mapIclosed, whatsapp: mapWhatsapp, fathom: mapFathom, funnel: mapFunnel }`)
     renvoie `{ ignored: raison }` → `crm_inbox_mark(id, 'ignored', raison)` ;
   - sinon `{ items }` : la fonction SQL est `APPLY_TYPE[items[0].type]` (`contact_updated` → `crm_apply_contact`), sinon
     `APPLY[source]` (`iclosed` → `crm_apply_items`, `whatsapp` → `crm_apply_messages`, `fathom` → `crm_apply_recordings`,
     `funnel` → `crm_apply_leads`). Elle écrit tout dans une transaction, met à jour la ligne (`processed`, `unmatched` ou
     `ignored`) et renvoie ce statut ;
   - exception (JSON illisible, champ obligatoire absent, erreur SQL) → `crm_inbox_mark(id, 'failed', message)`, qui
     incrémente `attempts` (au plus 8 tentatives, puis la ligne reste `failed`).
3. Réponse `200` JSON `{ rows: n, <statut>: nombre, … }` ; si la file elle-même est inaccessible, `500 {"error":"queue unavailable"}`.

`crm_inbox_pending`, `crm_inbox_mark` et les fonctions `crm_apply_*` sont `security definer`, exécutables par `service_role`
seulement. Whop n'a pas de mapper : ses lignes restent `received` et ne sont jamais prises (ni par le worker, ni par la
condition de la tâche cron).

### 4.1 Élément canonique (`_shared/canonical.ts`)

Chaque mapper produit des éléments de cette forme (ou `{ ignored }`, ou lève une erreur) :

| Champ | Contenu |
|---|---|
| `source` | `iclosed`, `fathom`, `whatsapp`, `whop`, `funnel` |
| `source_id` | Identifiant stable du fait chez la source (clé d'idempotence : `crm_events` a `on conflict (source, source_id)`) |
| `type` | Type canonique (`call_booked`, `message_in`, `call_recorded`, `lead_in`…) |
| `occurred_at` | Heure ISO du fait chez la source (pas l'heure de réception) |
| `actor` | `sales`, `prospect`, `auto`, `system` |
| `channel` | `booking`, `whatsapp`, `video`, `crm`… |
| `content` | Texte éventuel |
| `identity` | `email`, `phone`, `iclosed_contact_id`, `whop_user_id`, `whop_member_id`, `name`, `emails[]` (Fathom) |
| `refs` | Références (`iclosed_call_id`, `fathom_recording_id`, `recorder_email`…) |
| `data` | Champs utiles au CRM et à l'écran |

### 4.2 Normalisation (`_shared/normalize.ts`)

- `normEmail` : chaîne, espaces et `<…>` retirés, minuscules ; `null` si ce n'est pas une adresse.
- `normPhone` : chiffres et `+` gardés, `00` initial → `+` ; un numéro sans indicatif n'est **jamais** deviné (`null`) ;
  validation et format E.164 avec `libphonenumber-js@1.13.14/max` (import `npm:`). Exception : le mapper des funnels lit un
  numéro français `06…` comme `+33 6…` (§5.4).
- `normId` : chaîne non vide ou `null`.

---

## 5. Formats reçus et règles de correspondance

Les exemples de charge utile sont dans `docs/crm/fixtures/*.json` (données remplacées, marquées `_illustrative`). On décrit ici
les champs, pas les valeurs.

**Règle de fond (Romain, 11 novembre 2026, migration `059_crm_source_de_verite.sql`) : le CRM LNP est la seule source de vérité
des statuts.** D'iClosed, le CRM ne garde que le lead (nom, e-mail, téléphone), la date et l'heure de chaque RDV avec ses
déplacements et ses annulations, et le montant d'une vente, affiché pour information. Il ignore honoré, absent, gagné, perdu,
disqualifié et les paiements iClosed. Les appels tenus viennent de Fathom (§5.3), les issues du formulaire d'issue du CRM, les
paiements de Whop (pas encore branché, §5.5) ou de la fenêtre d'encaissement (saisie à la main, 022). L'historique déjà importé
avant 059 reste tel quel. Test : `web/supabase/tests/source_de_verite_test.sql`.

### 5.1 iClosed (agenda seulement) · `_shared/mappers/iclosed.ts`

iClosed ne fournit en direct que trois faits : appel réservé, déplacé, annulé (plus les coordonnées d'un contact). Spécification :
`docs/crm/05-integration-iclosed.md`.

**Deux formes acceptées.**

- Webhooks natifs (depuis le 25/10/2026, fixtures `iclosed-native-*.json`) : `hookType` (`"Call booked"`, `"Call rescheduled"`,
  `"Call cancelled"`, `"Contact updated"`, `"Outcome added"`…), l'appel sous `event` (`type`, `uuid` = identifiant d'appel,
  `start_time`, `end_time`, `utc_start_time`, `utc_end_time`, `old_start_time`, `created_at`, `canceled_at`, `cancel_reason`,
  identifiant, nom et e-mail de l'hôte, `location_type`…), `contact` (`id`, `email`, `firstName`, `lastName`, `phoneNumber`),
  `invitee`, `event_type.name`, `questions_and_answers`. Pour « Contact updated » : `id`, `email`, `secondary_email`,
  `firstName`, `lastName`, `phoneNumber`, `status`, `updatedAt`, `updatedAttributes[]`.
- Contrat de Zap `lnp.iclosed.v1` (fixture `iclosed-call_booked.json`, solution de repli) : `contract`, `event`
  (`call_booked|call_rescheduled|call_cancelled`), `occurred_at`, `call {id, start, end, event_type, host_email, cancel_reason,
  previous_start}`, `contact {id, first_name, last_name, email, phone}`, `zap {id, task_id}`.

Un corps tableau est lu par son premier élément.

**Nom d'événement** (`eventName`) : `hookType` (ou `hook_type`) s'il est une chaîne, sinon le premier de `event`, `type`,
`eventType`, `event_type`, `trigger`, `triggerType`, `action`, `data.event`, `data.type` qui n'est pas un objet ; mis en
minuscules, espaces, points et tirets → `_`.

| Nom normalisé | Résultat |
|---|---|
| `call_booked`, `booked`, `call_scheduled`, `event_scheduled`, `new_booking`, `booking_created`, `call_created` | `call_booked` |
| `call_rescheduled`, `rescheduled`, `event_rescheduled`, `booking_rescheduled` | `call_rescheduled` |
| `call_cancelled`, `call_canceled`, `cancelled`, `canceled`, `event_cancelled`, `event_canceled`, `booking_cancelled` | `call_canceled` |
| `contact_updated` | `mapContact` (ci-dessous) |
| `daily_snapshot` | Ignoré |
| Tout autre (`outcome_added`…) | Ignoré (« stored, not used by the CRM ») : l'issue iClosed n'est jamais reprise |

**Lecture des champs** (chemins essayés dans l'ordre, première valeur non vide) :

- racine = `data`, `payload` ou le corps ; appel = `call`, `event`, `booking`, `appointment`, `meeting` ou la racine ;
  contact = `contact`, `invitee`, `lead`, `prospect`, `call.contact`, `call.invitee`, `attendee` ;
- identifiant d'appel : `id`, `callId`, `call_id`, `uuid`, `eventId`, `event_id`, `bookingId`, `booking_id` (dans l'appel puis
  la racine). **Absent → erreur** (la ligne passe en `failed`, avec la liste des clés) ;
- nom : `name`, `fullName`, `full_name`, sinon prénom + nom ; e-mail : `email`, `emailAddress`, `email_address` ; téléphone :
  `phone`, `phoneNumber`, `phone_number`, `mobile` ; identifiant de contact : `id`, `contactId`, `contact_id`, `uuid` ;
- début : `utc_start_time`, `start`, `startTime`, `start_time`, `startAt`, `start_at`, `scheduledStart`, `scheduled_start`,
  `startDate`, `date` ; fin : `utc_end_time`, `end`, `endTime`… ; un nombre < 10¹² est lu en secondes ;
- e-mail de l'hôte (dans l'appel, puis à la racine) : `host_email`, `hostEmail`, `host.email`, puis les deux champs d'e-mail du
  commercial propres à iClosed, puis `user.email`, `assignedTo.email` (appel seulement), `owner.email`, `organizer.email` (appel
  seulement) ; liste exacte dans `mapIclosed` (`const host = …`) ;
- `occurred_at` : `occurred_at`, `occurredAt`, `timestamp` du corps, puis `createdAt` (réservation) ou `updatedAt` /
  `cancelledAt` (autres) de la racine, puis `canceled_at` (annulation) ou `created_at` de l'appel, sinon l'heure de réception.

**Élément produit** : `source_id = iclosed:<type>:<callId>:<occurred_at>`, `actor = prospect`, `channel = booking`,
`identity {email, phone, iclosed_contact_id, name}`, `refs.iclosed_call_id`, `data {start, end, host_email, event_type,
cancel_reason, phone_raw (le numéro brut seulement s'il n'a pas pu être normalisé), summary}`.

**« Contact updated »** (`mapContact`, règle de 023) : seuls les attributs `name`, `firstname`, `lastname`, `email`, `phone`,
`phonenumber` de `updatedAttributes` comptent ; aucun → ignoré (« the CRM keeps its own status » : le statut iClosed n'est jamais
repris). Identifiant de contact obligatoire. Élément `type = contact_updated`,
`source_id = iclosed:contact_updated:<id>:<updatedAt>`, `data {changed[], summary}`.

**Application en base** (`crm_apply_items`, `005_crm_pipeline.sql`, redéfinie avec libellés français dans `034_lnp_fr_labels.sql`) :

- appel connu par `crm_calls.iclosed_call_id` → son cycle et sa personne ;
- appel inconnu : un `call_rescheduled` devient `call_booked` ; un `call_canceled` va dans `crm_unmatched_inbox`
  (« Annulation d'un appel inconnu du CRM ») ; sinon la personne est cherchée par ses identifiants (`crm_people_for`) :
  plusieurs personnes → `crm_unmatched_inbox` ; aucune → nouvelle `crm_people` ; les identifiants sont ajoutés
  (`crm_add_identities`) ;
- nouvelle réservation : propriétaire = `crm_owner_for(host_email)`, cycle actif de la personne ou nouveau (`crm_open_cycle`),
  nouvel appel `rank = max + 1`, `status = scheduled` ;
- réservation d'un appel connu = déplacement ; un événement plus ancien n'écrase jamais un plus récent ; un nouveau début sans
  fin garde la durée ; un appel annulé redevient `scheduled` ;
- annulation : `status = canceled` (si `scheduled` ou `outcome_pending`) ;
- un événement `crm_events` par élément (`on conflict (source, source_id) do nothing`), puis `crm_recompute_cycle` de chaque
  cycle touché. Le déclencheur `crm_setting_on_call` (054, redéfini en 059) fait aussi bouger le statut setter de la personne
  sur une réservation, un déplacement ou une annulation (chapitre 03).

`crm_apply_contact` (`023_crm_contact_update.sql`, redéfinie dans 034) : personne trouvée par `iclosed_contact_id` (sinon
`crm_unmatched_inbox` « Mise à jour d'un contact inconnu du CRM ») ; l'ancien e-mail ou téléphone reste une identité, le nouveau
devient principal ; un nouvel e-mail ou téléphone qui appartient déjà à quelqu'un d'autre n'est pas déplacé (ligne en
`crm_unmatched_inbox`) ; aucun événement n'est écrit.

### 5.2 WhatsApp Business (messages de l'équipe) · `_shared/mappers/whatsapp.ts`

Décision de Romain (9 novembre 2026, migration 052) : WhatsApp Business est le seul canal de messages du CRM ; Sendblue n'est pas
utilisé. Chaque commercial et chaque setter écrit aux prospects depuis son numéro WhatsApp Business, relié à l'API officielle
(WhatsApp Business Platform, Cloud API) **en coexistence** : la personne garde l'application WhatsApp Business sur son
téléphone, et le CRM reçoit ce qu'elle reçoit et ce qu'elle envoie depuis l'application. Spécification :
`docs/crm/07-integration-whatsapp.md`.

Une requête = la charge utile de Meta `{object: "whatsapp_business_account", entry: [{changes: [{field, value}]}]}`, relayée
telle quelle par le fournisseur ou envoyée par Meta, avec parfois plusieurs messages. Le numéro de l'équipe est
`value.metadata.display_phone_number` (`data.line`). Les numéros WhatsApp arrivent sans `+` : le mapper l'ajoute avant `normPhone`.

| `field` | Partie lue | Type canonique | `actor` |
|---|---|---|---|
| `messages` | `value.messages[]` (message du prospect ; nom de son profil lu dans `value.contacts[]`) | `message_in` | `prospect` |
| `messages` | `value.statuses[]` (message envoyé par l'API, par exemple un rappel automatique : `sent`, `delivered`, `read`, `failed`) | `message_out` (contenu vide, `data.status`, `error_code`, `error_message`) | `auto` |
| `smb_message_echoes` | `value.message_echoes[]` (message écrit dans l'application par le commercial ou le setter) | `message_out` (`data.status = sent`) | `sales` |
| `history` | `value.history[].threads[].messages[]` (conversations partagées à la connexion ; sortant si `from` = le numéro de l'équipe) | `message_in` / `message_out` (`data.history = true`) | `prospect` / `sales` |

Règles (`whatsappItems`) :

1. `channel = whatsapp`, `source = whatsapp`, `source_id = whatsapp:<wamid>` : **un événement par message**. Un statut ou une
   seconde livraison du même identifiant le met à jour ; un message vu d'abord par son seul statut (donc envoyé par l'API,
   `auto`) devient `sales` quand l'écho de l'application arrive.
2. Contenu (`textOf`) : le texte, la réponse à un bouton ou à une liste, ou la légende (sinon le nom de fichier) d'un média ;
   `data.kind` garde le type du message. `occurred_at` = `timestamp` (secondes), sinon l'heure de réception.
3. Ignorés : messages de groupe (`group_id`), réactions, messages `unsupported` et `system`, statuts inconnus, synchronisation des
   contacts et tout autre `field`. Une requête sans rien à garder → `{ ignored }`.
4. Message entrant dont tout le texte est `stop`, `arret`, `arrêt` ou `unsubscribe` (casse ignorée) → élément supplémentaire
   `type = opt_out`, `source_id = whatsapp:optout:<wamid>`.
5. Les appels téléphoniques ne sont pas reçus : WhatsApp ne les transmet pas au CRM (aucun `phone_call_in` / `phone_call_out`).

Application (`crm_apply_messages` → `crm_apply_message_item`, définition finale `052_crm_whatsapp.sql`) : la personne est trouvée
par téléphone ; plusieurs personnes → `crm_unmatched_inbox` (« Plusieurs personnes ont ce numéro de téléphone ») ; aucune →
nouvelle personne, avec le nom du profil WhatsApp (règle d'équipe : le WhatsApp Business déclaré ne sert qu'avec des prospects,
aucun message n'est perdu). La personne de l'équipe est celle dont `crm_members.whatsapp_number` vaut `data.line`
(`crm_events.member_id`) : ce numéro se saisit dans Paramètres › Compte › Accès de l'équipe, colonne « WhatsApp Business »
(`/api/team` action `whatsapp`, chapitre 05). `opt_out` remplit `crm_people.opted_out_at`. Le cycle est le dernier ouvert avant
le message, sinon le premier. Un message est **un** événement : `on conflict (source, source_id) do update` fusionne `data` (le
statut sent → delivered → read), garde le texte non vide, la date la plus ancienne et le premier membre trouvé, et passe l'acteur
à `sales` dès qu'une livraison le dit.

Envoi : le CRM n'envoie aucun message WhatsApp. La confirmation automatique après une prise de RDV (SH-1) et les rappels (SH-5)
demandent des modèles de message WhatsApp (approuvés par Meta, payants) : qui les envoie reste à décider.

État en production (chapitre 08) : `WHATSAPP_INBOUND_TOKEN` et `WHATSAPP_APP_SECRET` ne sont pas posés, aucun message n'arrive ;
les SLA qui lisent les messages restent éteints tant que la source `messages` n'est pas marquée reliée (§8.1).

### 5.3 Fathom (enregistrements) · `_shared/mappers/fathom.ts`

Depuis le 29/10/2026 (règles FL-1 à FL-6, `docs/crm/06-integration-fathom.md` §0, `025_crm_fathom_calls.sql`), Fathom est la
source de vérité des appels de vente. **Aucun webhook n'est utilisé en production** : la tâche `crm-fathom-hourly` lit l'API
chaque heure (§7). Le même mapper sert au webhook `fathom-in` s'il est un jour configuré (même `source_id`, rien n'est compté
deux fois).

Champs d'une réunion (fixture `fathom-new_meeting_content_ready.json`, forme de `GET /meetings`) : `recording_id`, `title`, `url`,
`share_url`, `created_at`, `scheduled_start_time`, `recording_start_time`, `recording_end_time`,
`calendar_invitees[] {name, email, email_domain, is_external}`, `recorded_by {name, email}`,
`transcript[] {speaker {display_name, matched_calendar_invitee_email}, text, timestamp}`,
`default_summary {template_name, markdown_formatted}`, `action_items[]`. Le corps d'un webhook est lu tel quel s'il a
`recording_id`, sinon sous `meeting` ou `data`.

`fathomItem` :

- `recording_id` absent ou non numérique → ignoré ;
- e-mails candidats : invités externes (`is_external` différent de `false`) et e-mails des intervenants, sauf celui de la personne
  qui enregistre ;
- noms candidats (deux mots ou plus) : invités, intervenants et nom tiré du titre (`titleNames` : « Nom x … », « Updated - Nom x
  … », « Nom: … », « Nom | … »), sauf la personne qui enregistre ;
- début = `recording_start_time`, sinon `scheduled_start_time`, `created_at`, l'heure de réception ;
- élément : `type = call_recorded`, `source_id = fathom:recorded:<recording_id>`, `actor = sales`, `channel = video`,
  `identity.emails[]`, `refs {fathom_recording_id, recorder_email}`, `data {start, end, scheduled_start, title, url, share_url,
  recorder_name, names[], speakers[{name, email}], transcript (lignes brutes), transcript_raw, summary_md}` ;
- `transcript_raw` = format du moteur `"[hh:mm:ss] Intervenant: texte"` (`engineTranscript` : deux-points retirés des noms,
  horodatage invalide → `00:00:00`, lignes vides retirées).

Application (`crm_apply_recording_item`, appelée par `crm_apply_recordings` pour un webhook et par `crm_import_recordings` pour
l'import) :

| Règle | Effet |
|---|---|
| FL-1 | Candidat appel de vente si la personne qui enregistre est un commercial de `crm_sales_team` (par clé de membre ou partie locale de l'e-mail, `crm_fathom_sales_recorder`) ; sinon statut `not_sales_recorder` |
| FL-2 | Le prospect est trouvé par la première règle qui donne exactement une personne : (a) e-mail ; (b) réservation hébergée par cette personne à ± `fathom_match_minutes` (90) du début, non annulée, non liée ; (c) nom complet égal (`crm_norm_name`). 032 ajoute `booking_closest` : la réservation la plus proche gagne si elle commence à 15 min ou moins (`fathom_close_minutes`) et aucune autre. Plusieurs → `ambiguous` |
| FL-3 | Aucun prospect → `not_sales` (gardé dans `crm_fathom_recordings`, jamais de nouvelle personne) |
| FL-4 | Enregistrement lié = appel tenu : il remplit l'appel réservé correspondant, sinon devient un nouvel appel du cycle |
| FL-5 | R1, R2… = ordre des enregistrements de vente du cycle (`crm_rank_calls`) |
| FL-6 | L'appel demande son issue ; sa transcription part à l'analyse s'il est R1 ou R2, que les intervenants sont reconnus (`crm_fathom_speaker_map`) et que l'import a `p_queue` vrai (tâche horaire ou webhook) ; un import d'historique ne met jamais en file. Une transcription ajoutée à la main n'est jamais remplacée |

Mise en file (025) : si la transcription change, que `p_queue` est vrai, que `crm_ca_call_info(call).eligible` est vrai, que la
transcription fait 200 caractères ou plus et qu'il n'existe aucun job `queued`, `running` ou `done` pour cet appel →
`insert into crm_ca_jobs (call_id)`. La suite (worker, moteur, numérotation des appels : migration 062) est au chapitre 09.

Résultat d'un webhook : `linked` → `processed` ; `ambiguous` → `crm_unmatched_inbox` (« Enregistrement Fathom : plusieurs
prospects correspondent ») et `unmatched` ; sinon `ignored` avec la note FL-1 ou FL-3.

La règle des absences (`crm_no_show_tick` → `crm_apply_no_show_rule`, tâche de la minute 35, 030 puis 056) lit ces
enregistrements, seulement quand `crm_settings.no_show_rule.enabled` est vrai (056 l'allume, avec `since` = 27/10/2026,
`min_minutes` = 30, `grace_hours` = 3) : un enregistrement de 30 minutes ou plus rend l'appel tenu ; aucun enregistrement ni
présence déclarée 3 h après la fin de l'appel → absence (première réservation du cycle, `no_show`) ou appel manqué (une
réservation suivante, `missed`) ; un enregistrement court ne change rien (le commercial décide). Un enregistrement complet arrivé
plus tard l'emporte (`crm_calls_recorded_trigger`, 030).

### 5.4 Funnels (leads du setter) · `_shared/mappers/funnel.ts`

Spécification : `docs/crm/19-setting.md` (« Brancher le quiz et la VSL »), migrations 054 et 059. L'outil du quiz ou de la VSL
(ou un outil d'automatisation) poste un lead JSON, une liste, ou `{leads: [...]}` sur `lead-in`. Les noms de champs sont lus
largement :

| Champ | Clés lues | Règle |
|---|---|---|
| source | `source`, `funnel`, `type` | `funnelSource` (accents retirés) : contient `aband`, `partial` ou `incomplet` → `quiz_abandon` ; `webin` → `webinaire` ; `vsl`, `video` ou `opt` → `vsl` ; sinon `quiz` |
| e-mail | `email`, `contact.email` | En minuscules |
| téléphone | `phone`, `telephone`, `tel`, `contact.phone` | `funnelPhone` : un numéro qui commence par `0` est lu `+33…`, sans `+` ni `00` → `+` ajouté, puis `normPhone` |
| nom | `name`, `full_name`, `contact.name`, sinon `first_name` / `prenom` + `last_name` / `nom` | — |
| RDV pris | `booked`, `rdv`, `has_booking` | Vrai pour `true`, `oui`, `yes`, `1` (une réservation iClosed suit) |
| réponses | `answers`, `quiz`, `responses` | Gardées telles quelles (`crm_people.quiz`, fiche du lead) |
| présence | `attended`, `present`, `showed_up` | Webinaire seulement ; absent → `null` (059) |
| identifiant | `id`, `lead_id`, `submission_id` | Sinon `<e-mail ou téléphone>:<jour>` |
| date | `submitted_at`, `created_at`, `date` | Sinon l'heure de réception |

Un lead sans e-mail ni téléphone est écarté ; une requête sans lead valable → `{ignored: "funnel: no lead with an email or a
phone"}`. Élément : `source = funnel`, `source_id = funnel:<source>:<id>`, `type = lead_in`, `actor = prospect`, `channel = crm`,
`identity {email, phone, name}`, `data {source, booked, answers, attended}`.

Application (`crm_apply_leads` → `crm_lead_item`, définition finale 059) : la personne est trouvée par `crm_people_for` (plusieurs →
`crm_unmatched_inbox` « Plusieurs personnes ont cet e-mail ou ce numéro », ligne `unmatched`) ou créée ; `lead_source` et `quiz`
sont remplis ; un setter est attribué (`crm_pick_setter`), sauf pour un lead webinaire qui ne passe pas encore au setter ; un
événement `lead_in` (« Lead reçu : … ») est écrit une fois (`on conflict do nothing` : un lead reçu deux fois n'est traité
qu'une fois). Le statut setter ne change que pour un lead nouveau, en nurture (`injoignable`, `non_qualifie`) ou en
`webinaire_absent` :

| Cas | Statut setter |
|---|---|
| RDV pris (`booked`) | Aucun changement (le RDV va au commercial ; un `webinaire_absent` est effacé) |
| Quiz, VSL, quiz abandonné | `a_contacter` |
| Webinaire, présent sans RDV | `a_contacter` |
| Webinaire, absent (ou présence inconnue) | `webinaire_absent` (attente d'une réponse) |

`crm_setting_tick` (toutes les 10 min) : un `webinaire_absent` sans message du prospect en 48 h passe `a_contacter` ; un
`absent_attente` (absent au RDV de vente) sans réponse en 24 h passe `absent_rattrapage` ; un prospect qui a répondu sort du statut
setter. Le reste du suivi du setter (statuts, cadence, actions `crm_setter_action`, lead saisi à la main `crm_create_lead`) est au
chapitre 03.

État en production : `FUNNEL_INBOUND_TOKEN` n'est pas posé (chapitre 08), aucun lead de funnel n'arrive par `lead-in`.

### 5.5 Whop (paiements)

Seule la réception existe : `whop-in` vérifie la signature et stocke la requête. Il n'y a pas de mapper Whop, la file ne prend pas
les lignes `whop`. La fixture `whop-payment_succeeded.json` montre la forme attendue : `type`, `account_id`, `data {id, status,
total, currency, paid_at, user {id, email}, member {id, phone}, plan {id}, metadata {lnp_cycle_id, lnp_person_id}}` et les
en-têtes Standard Webhooks. La correspondance prévue (`docs/crm/08-integration-whop.md` §4) n'est pas codée. Les paiements du CRM
se saisissent aujourd'hui dans la fenêtre d'encaissement (`crm_payments`, 022).

### 5.6 Ventes iClosed : un montant pour information (037, puis 059)

`crm-import ?source=iclosed_deals` lit toutes les ventes (`GET /v1/deals`, `iclosedAllDeals`) et les convertit
(`iclosedDealsToItems`) : `iclosed_deal_id`, `iclosed_call_id` (`eventCallId`), `iclosed_contact_id` (`contactId`), `type`
(`transactionType`, `WON` ou `DEPOSIT`), `value` (virgule → point), `product` (`product.name`), `at` (`time`, sinon `createdAt`,
lu en UTC sans fuseau). `crm_import_deals` (définition finale 059) les applique par lots de 100 :

| iClosed | CRM |
|---|---|
| le cycle | celui de l'appel (`crm_calls.iclosed_call_id = eventCallId`), sinon le dernier cycle de la personne dont l'identité `iclosed_contact_id` vaut `contactId` ; sans cycle : compté `unmatched`, rien n'est écrit |
| chaque vente de montant > 0 | un événement `iclosed_deal` (`source = 'iclosed'`, `source_id = 'deal-info:<id>'`, `actor = system`, `channel = crm`), texte « iClosed (pour information) : vente (ou acompte) de N € · produit · le statut et les paiements se gèrent dans le CRM », `data {amount, kind, product, iclosed_deal_id}` ; une seconde lecture le met à jour |

Depuis 059, une vente iClosed n'écrit **ni** `crm_payments`, ni `crm_deals`, ni `payment_succeeded`, et ne fait pas passer le
cycle à gagné ; `crm_sla_snapshot` exclut les événements `iclosed_deal` (aucune alerte n'en dépend). Réponse :
`{deals, matched, unmatched, new, updated, info_only: true, dry}`. `?report=deals` donne des comptes seulement (types, produits,
montants par mois, `dealsReport`).

---

## 6. iClosed, Close et Fathom par leurs API (`_shared/importers/`)

| Source | Appel | Pagination | Conversion |
|---|---|---|---|
| Close (`close.ts`) | `GET https://api.close.com/api/v1/lead/?_limit=100&_skip=N&_fields=id,display_name,status_label,date_created,contacts,opportunities`, Basic auth (clé comme nom d'utilisateur) | `_skip`, `has_more` | Un élément par contact : `source_ref = <lead>:<contact>`, e-mails et téléphones normalisés, `close_contact_id`, `data {close_lead_id, lead_name, status_label, opportunities[] (statut, valeur, devise, dates)}` |
| iClosed contacts (`iclosed.ts`) | `GET https://public.api.iclosed.io/v1/contacts?limit=100&page=N` (N depuis 0), `Authorization: Bearer iclosed_<clé>` | Arrêt sur page vide, page sans nouveauté ou total `data.count` atteint ; 500 pages au plus | `source_ref = iclosed:<id>`, e-mails et téléphones principaux et secondaires, `data {iclosed_contact_id, status_label, country, time_zone, owner_email, events[]}` |
| iClosed appels (`iclosed.ts`) | `GET …/v1/eventCalls?limit=100&page=N` | Idem | Un élément par contact avec ses appels (`iclosedCallsToItems`). Le code calcule encore un statut d'appel (`canceled`, `no_show`, `held`, `scheduled`) et une clôture de cycle (`iclosedClose`), mais `crm_import_calls` (059) ne garde que `canceled` ou `scheduled` et ne ferme jamais un cycle |
| iClosed ventes (`iclosed.ts`) | `GET …/v1/deals?limit=100&page=N` | Idem | §5.6 |
| Fathom (`fathom.ts`) | `GET https://api.fathom.ai/external/v1/meetings?created_after=…&include_transcript=true&include_summary=true[&created_before=…][&cursor=…]`, en-tête `X-Api-Key` | `next_cursor` ; une page au plus toutes les 1,1 s (`PAGE_GAP_MS`) ; sur `429`, attente `Retry-After` (sinon 5, 10, 20… s), 6 fois au plus ; 500 pages au plus | Même mapper que le webhook (§5.3) |

iClosed limite son API (`429 RATE_LIMIT_EXCEEDED` vu le 3 novembre 2026) : une page au plus toutes les 1,1 s
(`ICLOSED_PAGE_GAP_MS`), et sur `429` une attente d'au moins 5, 10, 20 puis 30 s (plus si `Retry-After` le dit), 6 fois au plus ;
l'erreur nomme alors le dernier `Retry-After`. Toute autre réponse non 2xx d'une API externe lève
`"<Source> API: HTTP <code> <200 premiers caractères>"`.

`crm_import_calls` (définition finale 059) : la personne est trouvée par ses identifiants (plusieurs → `conflicts`, jamais
devinée) ou créée ; le cycle est celui qui contient déjà un de ses appels, sinon son dernier, sinon un nouveau (propriétaire =
`crm_owner_for(host_email)`) ; chaque appel inconnu devient un `crm_calls` (`scheduled` ou `canceled`, jamais `held` ni `no_show`)
avec un événement `call_booked` (`source = import`, `source_id = import:call:<id>:booked`) et, s'il est annulé, `call_canceled` ;
puis `crm_recompute_cycle`. Un appel déjà connu (vu en direct ou avant) est compté `calls_known`.

---

## 7. `crm-import` (imports, rapports, sondes)

`supabase/functions/crm-import/index.ts`. `POST` seulement (`405 POST only`). Aucune authentification de l'appelant : la fonction
répond par des comptes, jamais par des données personnelles, sauf `report=statuses` avec le bon jeton. Elle lit et écrit la base
par PostgREST avec la clé de service (`restRpc` de `worker.ts` pour les RPC, `restTable` pour les tables).

### 7.1 Paramètres de requête

| Requête | Effet |
|---|---|
| `?source=close[&dry=1][&run=<id>]` | Prospects Close → `crm_import_people`, par page de 100 |
| `?source=iclosed[&dry=1][&run=<id>]` | Contacts iClosed → `crm_import_people` (tâche de la minute 3) |
| `?source=iclosed_calls[&dry=1]` | Appels iClosed → cycles et appels (`crm_import_calls`, tâche de la minute 15) |
| `?source=iclosed_deals[&dry=1]` | Ventes iClosed → événements `iclosed_deal` (`crm_import_deals`, tâche de la minute 41) |
| `?source=fathom[&since=AAAA-MM-JJ][&until=AAAA-MM-JJ][&queue=1][&dry=1]` | Enregistrements Fathom → `crm_import_recordings` ; `since` par défaut = il y a 2 jours ; `queue=1` met les analyses R1 / R2 en file (tâche de la minute 23 seulement) |
| `?source=iclosed&probe=1` | Lecture seule : forme (noms et types de champs, jamais de valeurs) des réponses de l'API iClosed sur des chemins connus, et chemins de sa description OpenAPI (`probe.ts`) |
| `?source=iclosed&probe=2` | Lecture seule : quel paramètre pagine `/v1/contacts` et `/v1/eventCalls` (comparaison d'identifiants seulement) |
| `?report=statuses` | Statuts iClosed croisés avec les contacts Close (par e-mail ou téléphone) ; comptes seulement, et la liste des disqualifiés (nom, téléphone, statuts, date) seulement si l'en-tête `x-lnp-token` égale `CRM_REPORT_TOKEN` (32 caractères au moins) |
| `?report=calls` | Comptes sur les appels iClosed (types, annulations, issues, mois, appels par contact) |
| `?report=deals` | Comptes sur les ventes iClosed (§5.6) |

Autre `source` → `400 {"error":"source must be close, iclosed, iclosed_calls or iclosed_deals"}`. Dates `since` / `until` mal
formées → `400`. Une clé absente → `409` (`probe=1` : `ICLOSED_API_KEY is not set`). Il n'y a pas d'import d'historique WhatsApp :
les conversations partagées à la connexion d'un numéro arrivent par `whatsapp-in` (`field` `history`, §5.2).

### 7.2 Déroulement d'un import (`_shared/import_run.ts`)

- Clé absente → `409 {error: "<CLÉ> is not set in Supabase (Edge Functions › Secrets)"}`.
- Un seul import à la fois : une ligne `crm_import_runs` au statut `running` commencée il y a moins de 10 min → `409`
  `{error: "an import is already running", run: <id>}`.
- Une ligne `crm_import_runs` est créée (`source = 'import'`, `dry_run`, `cursor {source, …}`) ; table de `007_crm_import.sql` :
  `status` `running|done|failed`, `cursor`, `stats` (comptes seulement), `error`, `started_at`, `finished_at` ; lisible par les
  membres du CRM qui voient tout (`crm_sees_all()`, administrateurs seulement depuis 048).
- **Close et iClosed (contacts)** (`importRun`) : un vrai import avance page par page, appelle `crm_import_people(p_run, 'import',
  items, false)` et enregistre le curseur (`crm_import_save(..., 'running')`) après chaque page. Au-delà de 110 s (`budgetMs`) avec
  des pages restantes, il renvoie `{run, more: true, stats}` : rappeler avec `?run=<id>` pour continuer (le run doit être de la
  même source). La tâche horaire n'envoie pas `run` : chaque heure repart de la page 0. Un essai à blanc (`dry=1`) lit tout puis
  envoie **tout** en un seul appel `p_dry = true` (comptes exacts de doublons), annulé en base.
- **iClosed (appels)** : lit tous les appels, les groupe par contact, puis `crm_import_calls` par 100 personnes (tout en un appel
  pour un essai à blanc).
- **iClosed (ventes)** : lit toutes les ventes, puis `crm_import_deals` par 100.
- **Fathom** : `crm_import_recordings(items, p_dry, p_queue)` par lots de 10 réunions (les transcriptions sont longues) ; en essai
  à blanc chaque lot est annulé à part.
- Fin : `crm_import_save(..., 'done')` et réponse `{run, dry, more: false, stats}` ; erreur : `crm_import_save(..., 'failed',
  p_error)` puis `500 {error}` (message tronqué à 300 caractères).

**Comptes renvoyés (`stats`).**

| Source | Clés |
|---|---|
| Close / iClosed contacts | `created`, `matched`, `conflicts`, `skipped`, `statuses {}` (007), plus `leads` ou `contacts` |
| iClosed appels | `people`, `created_people`, `cycles_opened`, `calls`, `calls_known`, `closed {}` (toujours vide depuis 059), `conflicts`, `skipped`, plus `iclosed_calls`, `contacts` |
| iClosed ventes | `deals`, `matched`, `unmatched`, `new`, `updated`, `info_only`, `dry` |
| Fathom | `items`, un compte par statut (`linked`, `not_sales`, `not_sales_recorder`, `ambiguous`), `rule_<règle>`, `queued`, `speakers_unmapped` (025), plus `fathom_meetings`, `ignored` |

---

## 8. `sla-tick` et les alertes du CRM

Décision de Romain (9 novembre 2026, migration `053_crm_alertes.sql`) : **le CRM est la base des notifications, pas Slack.**
Spécification : `docs/crm/18-sales-cycle-slas.md` (SLA du cycle de vente v3) et `docs/crm/19-setting.md` (alertes SE du setter).
L'écran des alertes, la pastille et le bandeau sont décrits au chapitre 02.

### 8.1 Une seule source de règles (`_shared/sla_rules.js`)

Fichier JavaScript sans module (IIFE) qui expose sur `window` ou `globalThis`
`LNP_SLA = {DEFS, BY, BASE, STAGES, SOURCES, sources, configure, active, status, evaluate, worst, fmt, said, RANK, SETTING,
setting}`. Il est inséré dans l'écran Cycle de vente (`app/gen_crm.py`), sert le catalogue de Paramètres › Alertes
(`app/build.py`), est importé par `sla-tick` et lu par `web/kb/build_kb.mjs` pour le connecteur (chapitre 05) : l'écran, les
alertes, Slack et Claude appliquent les mêmes règles.

- **52 SLA** (`DEFS`) en sept étapes (`STAGES`) : Setting (SE-1 à SE-10), Présence (SH-1 à SH-12), Décision (DE-1 à DE-9),
  Encaissement (CA-1 à CA-7), Conversation (CO-1 à CO-5), Clôture et suivi long terme (CL-1 à CL-4), Données et fiabilité (DO-1
  à DO-5). Chacun : `id`, `name`, `stage`, `kind`, `needs`, `eval`, `unit`, `start`, `stop`, `target`, `warn` / `late` / `crit`
  (heures ; `null` = pas de seuil ; DE-8 compte des appels, SH-4 des heures avant le R1), `esc`, `why`, parfois `pending`,
  `applied`, `setting` (statuts setter), `from`.
- `kind` : `sales` (fait le niveau du lead), `tech` (défaut d'intégration ou de données : administrateurs seulement, jamais le
  niveau du lead), `indicator` (lu dans le Cockpit, jamais une alerte), `form` (règle de formulaire, sans horloge).
- `needs` : les sources au-delà d'iClosed et de Fathom (`SOURCES`) : `messages` (« Messages WhatsApp de l’équipe »), `whop`
  (« Liens et paiements Whop »), `analysis` (« Analyse automatique de chaque appel »).
- `configure(cfg)` applique `crm_settings.sla_rules` (044, enregistré par Paramètres › Alertes) :
  `{sources: {messages, whop, analysis}, rules: {"<ID>": {on, warn, late, crit, app, slack}}}`. Une source absente du réglage
  vaut reliée, une règle absente vaut allumée, `app` vaut vrai, `slack` vaut **faux** (valeur de base) ; un seuil n'est remplacé
  que si la référence en a un ; les seuils sont remis dans l'ordre (préventif ≤ dépassé ≤ critique, l'inverse pour SH-4). La
  ligne créée par 044 est `{"sources": {"messages": false, "whop": false, "analysis": false}, "rules": {}}` : les SLA de ces trois
  sources sont éteints tant qu'un administrateur ne marque pas la source reliée.
- `active(id, surface)` : mesuré (`eval`), allumé, sources reliées, et montré à cet endroit (`screen` → `app`, `slack` → `slack`).
- `evaluate(lead, opt)` : `lead = {age, ev: [{t (heures depuis l'ouverture), w: s|p|a, k, r, dur, rec, ana, stop, yes, no, fu}],
  rec}` ; `opt = {t0, tz, surface}` ; « contact » = `k` ∈ {`im`, `sms`, `call`} ; un appel dure 45 min par défaut ; un cycle fermé
  (paiement, ou décision « non ») arrête les horloges ouvertes. Niveau : `crit` si écoulé ≥ `crit`, `late` si ≥ `late`, `warn` si
  l'horloge est ouverte et écoulé ≥ `warn`. Chaque résultat : `{id, name, stage, kind, target, level, open, start, stop, elapsed,
  at, late, extra, label}`. CO-1 et CO-2 comptent la plage du commercial de 08:00 à 22:00 dans `opt.tz` (défaut `Europe/Paris`) ;
  CO-5 la plage d'envoi de 09:00 à 20:00.
- `setting(p, now)` : les alertes SE d'un lead au statut setter `p = {status, due, last}` (ms) : départ = `setting_due_at`
  (l'échéance de l'action en cours, calculée par le CRM, `crm_setting_due`) ou `setting_last_at` pour SE-8 (`from: "last"`) ;
  niveaux `late` et `crit` seulement ; seulement si la règle est active pour l'écran.
- `worst(list)` = pire niveau ouvert des SLA `sales` ; `fmt(h)` = `N min` (< 1 h), `x,y h` (< 72 h), sinon `x,y j` ;
  `said(b)` = `label` ou `fmt(elapsed)` ; `status(id)` = l'état montré dans Paramètres (mesurée, en attente de données, règle de
  formulaire, indicateur, pas encore mesurée).

**Les 32 SLA mesurés** (`eval: true`), seuils de référence :

| Id | Nom | Étape | `kind` | Sources | Objectif | warn | late | crit |
|---|---|---|---|---|---|---|---|---|
| SH-1 | Confirmation automatique | Présence | tech | messages | 1 min | — | 5 min | 15 min |
| SH-2 | Premier contact du commercial | Présence | sales | messages | 5 min | 3 min | 15 min | 1 h |
| SH-3 | Délai jusqu’au R1 | Présence | indicator | — | 48 h | — | 72 h | 96 h |
| SH-4 | Échange avant l’appel | Présence | sales | messages | avant le R1 | 12 h avant | 3 h avant | — |
| SH-6 | R1 honoré à l’heure prévue | Présence | sales | — | à l’heure prévue | — | 45 min | 48 h |
| SH-8 | Relance après une absence | Présence | sales | messages | 15 min | — | 1 h | 24 h |
| SH-9 | Nouveau créneau après une absence | Présence | sales | — | 24 h | 12 h | 24 h | — |
| SH-11 | Issue déclarée | Présence | sales | — | 15 min | 10 min | 1 h | 24 h |
| DE-1 | Récap écrit après l’appel | Décision | sales | messages | 60 min | 45 min | 3 h | 24 h |
| DE-2 | Analyse d’appel disponible | Décision | tech | analysis | 15 min | — | 1 h | 4 h |
| DE-4 | Prochain appel réservé | Décision | sales | — | 24 h | 12 h | 24 h | 48 h |
| DE-5 | Délai entre deux appels | Décision | sales | — | 72 h | — | 120 h | 168 h |
| DE-7 | Relance sans réponse | Décision | sales | messages | 24 h | 20 h | 48 h | 96 h |
| DE-8 | Appels sans décision | Décision | sales | — | 2 appels au plus | 2 appels | 3 appels | — |
| DE-9 | Étape de décision | Décision | sales | — | 72 h | 60 h | 72 h | 144 h |
| CA-1 | Lien de paiement envoyé | Encaissement | sales | whop | 5 min, idéalement pendant l’appel | — | 30 min | 2 h |
| CA-2 | Premier paiement | Encaissement | sales | — | 24 h | 12 h | 24 h | 48 h |
| CA-5 | Oui non payé : clôture | Encaissement | sales | — | 14 jours | 168 h | — | 336 h |
| CO-1 | Réponse à un message du prospect | Conversation | sales | messages | 15 min dans la plage du commercial | 10 min | 1 h | 4 h |
| CO-2 | Message hors plage du commercial | Conversation | sales | messages | dans les 15 premières minutes de la plage suivante | — | — | — |
| CO-4 | Demande d’arrêt (STOP) | Conversation | tech | messages | immédiat | — | — | — |
| CO-5 | Heures d’envoi automatique | Conversation | tech | messages | 100 % dans la plage | — | — | — |
| CL-1 | Perte automatique | Clôture et suivi long terme | sales | messages | 30 jours (règle D5) | 648 h | 720 h | — |
| CL-3 | Réponse à un prospect en suivi long terme | Clôture et suivi long terme | sales | messages | 15 min dans la plage du commercial | 10 min | 1 h | 4 h |
| DO-2 | Enregistrement rattaché | Données et fiabilité | tech | — | 30 min | — | 2 h | 24 h |
| SE-1 | Premier appel du setter | Setting | sales | — | 5 min | — | 10 min | 55 min |
| SE-3 | Relance due | Setting | sales | — | à l’heure de la cadence | — | 2 h | 24 h |
| SE-6 | Confirmation d’un RDV auto-booké | Setting | sales | — | 1 h | — | 1 h | 3 h |
| SE-7 | Issue de l’appel setter notée | Setting | sales | — | le jour même (21 h) | — | 0 | 24 h |
| SE-8 | Lead sans action | Setting | sales | — | 24 h | — | 24 h | 48 h |
| SE-9 | Pas de « OK » à J−1 | Setting | sales | — | le jour même | — | 0 | 2 h |
| SE-10 | RDV replanifié ou annulé | Setting | sales | — | le jour même (21 h) | — | 0 | 24 h |

Pour SE-1 à SE-10, les seuils comptent après l'échéance de l'action du setter. Non mesurés (`eval: false`, 20) : SH-5, SH-7,
SH-10, SH-12, DE-3, DE-6, CA-3, CA-4, CA-6, CA-7, CO-3, CL-2, CL-4, DO-1, DO-3, DO-4, DO-5, SE-2, SE-4, SE-5 ; CL-2, SE-4 et
SE-5 sont des règles appliquées par le CRM (`applied`). CA-1 attend un événement `checkout_created` qu'aucune source n'écrit
aujourd'hui.

### 8.2 Modèle d'un cycle (`_shared/sla_view.ts › toLead`)

Entrée = une ligne de `crm_sla_snapshot(p_days)` (définition finale 059, service role, sans texte de message ni transcription) :
cycles `active` dont le dernier événement date de moins de `p_days` jours, `{id, opened_at, person, owner, owner_key,
events[{type, at, actor, channel, call_id, source}], calls[{id, rank, status, start, end}]}` ; les événements `setter_action`,
`lead_in` et `iclosed_deal` sont exclus. Conversion des événements :

| Type CRM | Événement de règle |
|---|---|
| `call_booked`, `call_rescheduled` | `p booked` (rang de l'appel) |
| `message_in` | `p im` (canal `whatsapp`) ; `p sms` seulement pour un canal `sms` |
| `message_out` | `a remind` si `actor` `auto` / `system` (envoyé par l'API WhatsApp), sinon `s im` (`s sms` pour un canal `sms`) |
| `phone_call_in` / `phone_call_out` | `p call` / `s call` (plus aucune source ne les écrit) |
| `payment_succeeded` | `p paid` |
| `checkout_created` | `s paylink` |
| `opt_out` | `a note` avec `stop` |
| `outcome_yes` / `outcome_follow_up` / `outcome_no`, `outcome_disqualified` | `s decision` `yes` / `fu` / `no` |
| `cycle_lost`, `cycle_disqualified` | `s decision no` (s'il n'y en a pas déjà) |
| `cycle_won` | `s decision yes`, plus `p paid` s'il n'y a aucun paiement |

Appels (hors annulés et sans début) : `held` → `s meet` avec `rec` (heure du premier `call_recorded`) et `ana` (heure du premier
`analysis_ready`) ; `no_show` → `p noshow` ; `missed` → ignoré (030 : un R2+ manqué est à replanifier) ; `outcome_pending` ou appel
passé → `s meetdue` ; sinon `s meet` (à venir).

### 8.3 La fonction `sla-tick`

`POST` seulement (`405`). Aucune entrée ; répond par des comptes, jamais par des noms. `tick(rpc, post, now, settings)` :

1. Réglages `crm_sla_settings()` (044) = `crm_settings.sla_alerts` (028 : `since`, `channel`, `max_age_hours` 6, `window_tz`
   `Europe/Paris` depuis 051, `link` facultatif) **plus** `sla_rules` ; `LNP_SLA.configure(cfg.sla_rules)`.
2. **Alertes du CRM.** `crm_sla_snapshot(p_days := 60)` ; pour chaque cycle, `evaluate(..., {surface: "screen", tz})` ; chaque
   dépassement **ouvert** de niveau `warn`, `late` ou `crit`, hors `indicator`, devient un élément
   `{key: "<cycle>:<sla>:<départ en minutes>", cycle_id, sla, kind, level, name, detail, target, started_at, crossed_at}`, quel que
   soit son âge. Puis `crm_setting_snapshot()` (054 : les personnes aux statuts setter actifs, avec `setter_id`, `due_at`,
   `last_at`, le cycle actif) ; chaque alerte SE devient `{key: "p:<personne>:<sla>:<départ en minutes>", person_id, cycle_id,
   owner_id: <setter>, …, detail: <libellé du statut setter>}`.
3. `crm_sync_sla_alerts(p_items)` (053, redéfinie en 054) : met à jour le niveau d'une alerte ouverte de même clé (et son
   propriétaire, son cycle), ouvre les nouvelles (propriétaire = celui donné, sinon le propriétaire du cycle ; une alerte sans
   personne est sautée), ferme `done` les alertes ouvertes absentes de la liste (le SLA s'est arrêté : l'action est faite) et
   `closed` celles d'un cycle qui n'est plus actif. Renvoie `{opened, updated, done, closed}`.
4. **Copie Slack (facultative).** Seulement si `SLACK_SALES_CYCLE_WEBHOOK_URL` existe : `evaluate(..., {surface: "slack"})`
   (seuls les SLA dont `slack` est vrai, aucun par défaut ; jamais les SE) ; dépassements ouverts `late` ou `crit` franchis après
   `since` et depuis moins de `max_age_hours` ; clé `<cycle>:<sla>:<départ en minutes>:<niveau>` ; `crm_sla_claim(p_items)` (028)
   insère dans `crm_sla_notices` (`on conflict do nothing`) et renvoie les clés nouvelles : chaque dépassement n'est publié qu'une
   fois ; un seul message par passage (`POST` JSON `{text}`).
5. Réponse `{cycles, alerts: {opened, updated, done, closed}, new, posted}` ; erreur `500 {error}`.

Table `crm_sla_alerts` (053, 054) : `id`, `key` (unique tant que `resolved_at` est nul), `cycle_id` (nul pour un lead sans
cycle), `person_id`, `owner_id`, `sla`, `kind` (`sales` | `tech`), `level` (`warn`, `late`, `crit`), `name`, `detail`, `target`,
`started_at`, `crossed_at`, `opened_at`, `updated_at`, `resolved_at`, `resolution` (`done` | `closed`). RLS : lecture si
`crm_sees_all()` ou (`owner_id = auth.uid()` et `kind <> 'tech'`) ; publiée dans `supabase_realtime` (la page se met à jour
seule). `crm_sla_alerts_open(p_owner)` sert l'écran (chapitre 03). `crm_sla_notices` (028) : `key`, `cycle_id`, `sla`, `level`
(`late|crit`), `crossed_at`, `sent_at` ; RLS sans politique.

**Message Slack** (`slackText`, en français, critiques d'abord) :

```
<N> SLA du cycle de vente dépassé(s)
:red_circle: *Critique* · <id> <nom> · *<prospect>* (<commercial>) · <durée> <précision>, objectif <objectif>
:large_orange_circle: *En retard* (technique) · …
<lien|Ouvrir le cycle de vente>
```

Prospect inconnu → « un prospect » ; sans propriétaire → « sans commercial attitré ». Le lien vient de
`crm_settings.sla_alerts.link` ; à défaut le code utilise `https://lnp-sales.vercel.app/#alertes` (`sla-tick/index.ts`) : dans
une réplique, renseigner `link` avec l'adresse de l'application suivie de `/#alertes`.

---

## 9. `callqa-llm` (passerelle de modèle de l'analyse d'appel)

`_shared/callqa_llm.ts › handleLlm`, appelée seulement par le worker d'analyse (qui tourne dans GitHub Actions et ne détient
aucune clé de modèle). Le worker, le moteur complet et le moteur allégé sont décrits au chapitre 09.

| Point | Règle |
|---|---|
| Méthode | `POST` seulement, sinon `405` |
| Authentification | `Authorization: Bearer <clé>` égale à `SUPABASE_SERVICE_ROLE_KEY` ou `SUPABASE_SECRET_KEY`, sinon `401 unauthorized` |
| Clé du modèle | `ANTHROPIC_API_KEY` absente → `409` |
| Corps | `{model, system, prompt, prefix?, max_tokens?, effort?, cache_prompt?}` ; `model` doit correspondre à `^claude-[a-z0-9.\-]+$` ; `system` chaîne et `prompt` non vide obligatoires ; `prefix` chaîne ou absent (`400` sinon) |
| `max_tokens` | Défaut 4000, borné entre 1 et 16000 |
| `effort` | `low` par défaut ; valeurs `none`, `low`, `medium`, `high`, `xhigh`, `max`, `default` ; `none` envoie `thinking: {type: "disabled"}` ; `default` n'envoie rien (le modèle prend le sien) ; sinon `output_config: {effort}` |
| Cache | Le `system` porte toujours `cache_control: {type: "ephemeral"}` ; le `prompt` aussi si `cache_prompt === true` ; `prefix` (moteur allégé : la transcription) est un premier bloc du message, toujours en cache |
| Appel | `POST https://api.anthropic.com/v1/messages`, en-têtes `x-api-key`, `anthropic-version: 2023-06-01` ; pas de `temperature` (refusée par les modèles actuels) ; un seul message `user` |
| Réponse | `{text (blocs texte concaténés), usage, model, stop_reason}` |
| Erreurs du fournisseur | `429` ou `5xx` → `503 {error, retry: true}` ; autre → `502 {error, retry: false}` ; seuls le type et le message d'erreur sont renvoyés |

Rien n'est journalisé : ni consigne, ni transcription. Les modèles par niveau sont dans `crm_ca_config.tiers` (jamais dans le
code) ; le workflow `call-analysis.yml` passe l'effort `none` par défaut (`CALLQA_EFFORT`).

---

## 10. `simulateur` (Entraînement › Simulateur)

Spécification : `docs/crm/20-simulateur.md` ; écran : chapitre 02 ; tables `crm_sim_*` : chapitre 03 (migrations 057, 058, 061).
Point d'entrée `supabase/functions/simulateur/index.ts`, routes `_shared/simulateur/routes.ts › app(deps)`, offres
`_shared/simulateur/offres.ts › routesOffres`, analyse de fin d'appel `_shared/simulateur/grille/index.ts › creerAnalyse`, voix
`_shared/simulateur/voix.ts › elevenLabs`. La page l'appelle par `window.claude.use("simulateur")` (`web/public/lnp-web.js`,
chapitre 05), toujours avec le jeton de la personne.

### 10.1 Accès et base

- `OPTIONS` → `200 ok` ; CORS `Access-Control-Allow-Origin: *`, en-têtes `authorization, x-client-info, apikey, content-type`,
  méthodes `GET, POST, PUT, PATCH, DELETE, OPTIONS`.
- Le chemin après `/simulateur/` donne la route. Jeton : `Authorization: Bearer <jeton>` ; pour `POST simulations/:id/end`, un
  corps `{beacon: true, token}` le remplace (fin envoyée par `sendBeacon` quand la page se ferme).
- `auth(jeton)` : la clé de service (`SUPABASE_SERVICE_ROLE_KEY` ou `SUPABASE_SECRET_KEY`) agit en administrateur ; sinon
  `appelant` (`base.ts`) : `GET <SUPABASE_URL>/auth/v1/user` avec le jeton, puis la ligne `crm_members` (`role`, `active`) : sans
  rôle actif → `401 Non authentifié`. `admin` = rôle CRM `admin`.
- Une simulation n'est lisible et modifiable que par la personne qui l'a lancée, ou par un administrateur (`403`).
- La base est lue et écrite avec la clé de service par PostgREST (`dbRest`, filtres d'égalité seulement).
- Les erreurs du flux sont rendues en codes (`codeErreurFlux`) : `SCENARIO_UNAVAILABLE`, `PROVIDER_UNAVAILABLE`, `SESSION_EXPIRED`,
  `RESPONSE_FAILED`, `STREAM_INCOMPLETE` ; l'écran les traduit.

### 10.2 Routes

| Route | Qui | Effet |
|---|---|---|
| `POST balayer` | Aucune authentification (tâche `crm-simulateur-balayer`) | Comme `analyses/reprendre`, en administrateur : une analyse `processing` sans nouvelle depuis 30 min passe `failed` (« Analyse interrompue »), puis 5 analyses `deferred` au plus (les plus anciennes) repartent |
| `GET moi` | Membre | `{id, email, role, admin, voixElevenLabs, voix, config}` |
| `PUT config` | Administrateur | Réglages `crm_sim_config` (ligne `id = 1`) : `claude_model` ∈ `claude-sonnet-5-5`, `claude-haiku-5-5`, `claude-opus-5-5` ; `eleven_labs_stability` et `eleven_labs_style` 0 à 1 ; `eleven_labs_speed` 0,7 à 1,2 ; `silence_timeout_ms` 300 à 5000 ; `daily_analysis_limit` 0 à 1000 ; `voice_mode_enabled` ; `eleven_labs_model_id` |
| `POST tts` | Membre | `{text (1 à 1500), voiceId}` → flux `audio/mpeg` d'ElevenLabs ; sans clé ou voix coupée → `{fallback: "speechSynthesis", speed}` (le navigateur parle) ; texte trop court → `204` |
| `POST simulations` | Membre | Lance une simulation : `personaId` obligatoire, `simulationMode` ∈ `full`, `diagnostic`, `objections` (défaut `full`) ; tire la variante du jour (`variantes.ts`) ; écrit la simulation et la première réplique du prospect |
| `DELETE simulations/:id` | Propriétaire ou administrateur | Supprime la simulation |
| `POST simulations/:id/messages` | Idem | Une réplique du commercial ; la réponse du prospect arrive en flux (`text/event-stream`) ; une erreur du modèle retire la réplique du commercial |
| `DELETE simulations/:id/messages/undo` | Idem | Retire le dernier échange |
| `POST simulations/:id/voix` | Idem | Un tour à la voix (flux ; texte nettoyé pour la voix) |
| `POST simulations/:id/end` | Idem | Termine (`completed`, durée, mesure de réalisme `mesurerRealisme` gardée dans `usage.realisme`) puis lance l'analyse, sauf `skipAnalysis` ou fin par beacon |
| `POST simulations/:id/feedback` | Propriétaire | Note 1 à 5 et commentaire (2 000 caractères au plus), une seule fois (`409`) |
| `POST analyses/:id/aar` | Propriétaire ou administrateur | Le retour d'expérience de la personne (`aar`) et son miroir |
| `POST analyses/reprendre` | Administrateur | Idem que `balayer` |
| `POST offres` | Administrateur | Crée une offre depuis un texte, une adresse de site ou des PDF (10 au plus par envoi, 20 Mo chacun) ; répond `202` (`extracting`), extraction puis 6 prospects en tâche de fond (`generating` → `ready`, ou `failed`) |
| `POST offres/:id/prospects` | Administrateur | Régénère les 6 prospects (les anciens sont effacés) |
| `POST offres/:id/reanalyser` | Administrateur | Relit les sources sans toucher aux prospects |
| `PATCH offres/:id` | Administrateur | `{archived}` |
| `DELETE offres/:id` | Administrateur | Supprime l'offre et ses prospects |
| `PATCH personas/:id` | Administrateur | `active`, `voice_id`, `difficulty` (`moyen`, `difficile`, `expert`), `loquacite` (`bref`, `moyen`, `bavard`) |
| `DELETE personas/:id` | Administrateur | Supprime le prospect |
| autre | — | `404 Route inconnue` ; exception → `500 Erreur du simulateur` |

L'historique des simulations est lu par la page avec la fonction SQL `crm_sim_history(p_user, p_limit)` (057, redéfinie en 061),
pas par cette fonction Edge.

### 10.3 Modèles et services appelés

| Usage | Modèle ou service | Fichier |
|---|---|---|
| La voix du prospect | `crm_sim_config.claude_model`, défaut `claude-sonnet-5-5` (`MODELE_PROSPECT`) ; réflexion coupée (`sansReflexion`) | `llm.ts`, `routes.ts` |
| Les analyses de signaux, tour par tour | `claude-haiku-5-5` (`MODELE_RAPIDE`) | `prospect.ts` |
| L'analyse de fin d'appel (grille sur 100) | P1 segmentation, P2-C, P2-L, P2-E, P2-R, P2-A, P4 exercice : `claude-haiku-5-5` ; P3 vérificateur : `claude-sonnet-5-5` | `grille/pipeline.ts` |
| Les offres et les prospects générés | `claude-sonnet-5-5` (`MODELE_OFFRES`) | `offres.ts` |
| Voix (facultatif) | ElevenLabs `POST https://api.elevenlabs.io/v1/text-to-speech/<voix>/stream`, en-tête `xi-api-key`, modèle `eleven_flash_v2_5` par défaut, une nouvelle tentative sur 429 / 5xx | `voix.ts` |
| Lecture d'un site pour une offre | Lecteur de pages externe `https://r.jina.ai/<adresse>` (sans clé), borné dans le temps ; PDF lus par la bibliothèque `unpdf` | `offres.ts` |

Toutes les requêtes à Anthropic vont à `https://api.anthropic.com/v1/messages` avec `ANTHROPIC_API_KEY`, sans `temperature`, les
consignes système marquées pour le cache. Les consignes envoyées au modèle viennent de `_shared/simulateur/prompts/` (offres et
prospects, construites par `prompts/build.mjs` en `prompts.ts`) et `grille/prompts.ts`.

Analyse de fin d'appel (`creerAnalyse`) : une ligne `crm_sim_analyses` par simulation ; type d'appel `R1` (mode `full`),
`diagnostic` ou `objections` (phase R seule ramenée sur 100, depuis le 2026-11-15) ; conversation trop courte ou à un seul
interlocuteur → refusée avec la raison ; plafond quotidien `crm_sim_config.daily_analysis_limit` (défaut 10) par jour
d'Europe/Paris, compté dans `cost.lances` : au-delà, l'analyse est `deferred` et reprise par `balayer` ; chaîne en arrière-plan
(`EdgeRuntime.waitUntil`) ; sans nouvelle depuis 30 min → `failed` à la reprise suivante.

---

## 11. Ce qu'il faut configurer chez chaque service

Les adresses ont la forme `https://<ref>.supabase.co/functions/v1/<fonction>` (`<ref>` = identifiant du projet Supabase). Détails
par service : `docs/crm/05-integration-iclosed.md`, `06-integration-fathom.md`, `07-integration-whatsapp.md`,
`08-integration-whop.md`, `19-setting.md`, `docs/crm/setup.md`.

| Service | Côté service | Côté Supabase |
|---|---|---|
| **iClosed** | Webhooks : URL `…/iclosed-in?k=<ICLOSED_INBOUND_TOKEN>` (ou en-tête `x-lnp-token` sans `?k=`) ; événements appel réservé, déplacé, annulé et « Contact updated ». Clé API (Settings › Developers › API) pour les imports horaires des contacts, des appels et des ventes | `ICLOSED_INBOUND_TOKEN`, `ICLOSED_API_KEY` |
| **iClosed par un Zap** (repli) | Un Zap par déclencheur (Call Booked / Rescheduled / Cancelled) → requête HTTP POST JSON du contrat `lnp.iclosed.v1`, en-tête `x-lnp-token`, nouvel essai automatique activé (`docs/crm/05` §2-3) | Idem |
| **Fathom** | Settings › API Access : clé API créée depuis un compte qui voit les enregistrements des commerciaux. Webhook facultatif (non utilisé) : URL `…/fathom-in`, transcription, résumé et actions cochés | `FATHOM_API_KEY` ; avec un webhook, `FATHOM_WEBHOOK_SECRET` (ou `FATHOM_WEBHOOK_SECRETS`) |
| **WhatsApp Business** (Meta) | Portefeuille Meta Business de l'entreprise, vérifié ; un numéro WhatsApp Business par personne, relié en coexistence par un fournisseur agréé par Meta (`docs/crm/07` en conseille un), historique des conversations partagé à la connexion. Webhook vers `…/whatsapp-in?k=<WHATSAPP_INBOUND_TOKEN>`, événements `messages`, `smb_message_echoes`, `history`. Meta directement (sans fournisseur) : même adresse sans `k=`, jeton de vérification = `WHATSAPP_INBOUND_TOKEN`, corps signés avec le secret de l'application. Dans LNP : le numéro de chacun dans Paramètres › Compte › Accès de l'équipe, colonne « WhatsApp Business », puis la source `messages` marquée reliée dans Paramètres › Alertes | `WHATSAPP_INBOUND_TOKEN` ; `WHATSAPP_APP_SECRET` (Meta directement seulement) |
| **Funnels** (quiz, VSL, webinaire) | L'outil du funnel poste chaque lead en JSON sur `…/lead-in?k=<FUNNEL_INBOUND_TOKEN>` (ou en-tête `x-lnp-token`) ; champs de §5.4 ; pour le webinaire, `attended` vrai ou faux | `FUNNEL_INBOUND_TOKEN` |
| **Whop** | Developer › Webhooks : URL `…/whop-in`, version d'API v1, événements `payment.succeeded`, `payment.failed`, `payment.pending`, `payment.requires_action`, `refund.created`, `refund.updated`, `dispute.created`, `dispute.updated`, `membership.activated` (stockés seulement) | `WHOP_WEBHOOK_SECRET` |
| **Close** | Settings › Developer › API Keys : nouvelle clé (import de l'historique des prospects seulement, aucun webhook) | `CLOSE_API_KEY` |
| **Slack** (facultatif) | Application avec webhooks entrants, webhook d'un canal ; puis cocher « Slack » sur les SLA voulus dans Paramètres › Alertes | `SLACK_SALES_CYCLE_WEBHOOK_URL` ; `crm_settings.sla_alerts.link` |
| **Anthropic** | Clé API (console.anthropic.com) | `ANTHROPIC_API_KEY` ; modèles de l'analyse d'appel dans `crm_ca_config.tiers` |
| **ElevenLabs** (facultatif) | Clé API | `ELEVENLABS_API_KEY` |
| **Supabase** | `crm_settings.functions_url` ; extensions `pg_cron`, `pg_net` ; publication `supabase_realtime` avec `crm_sla_alerts` ; bucket privé `callqa-fixtures` (mesure de l'analyse d'appel, chapitre 09) | — |
| **GitHub** | Secrets `SUPABASE_ACCESS_TOKEN` (jeton `sbp_…`), `SUPABASE_PROJECT_REF`, `SUPABASE_SERVICE_ROLE_KEY` ; variable `SUPABASE_URL` | — |

Hôtes externes appelés par les fonctions : `api.anthropic.com`, `api.fathom.ai`, `public.api.iclosed.io`, `api.close.com`,
`api.elevenlabs.io`, `r.jina.ai` et l'adresse du webhook Slack.

Contrôle : chaque essai crée une ligne `crm_webhook_log` avec `auth_ok = true` ; `false` signifie que le jeton ou le secret diffère
entre l'outil et Supabase. Une ligne `failed` ou `unmatched` se rejoue en remettant `status = 'received'` et `attempts = 0` (les
événements sont idempotents). Une ligne `rejected` garde `auth_ok = false` : rejouée telle quelle, elle serait rejetée de nouveau ;
c'est la livraison suivante du fournisseur, avec le bon secret, qui compte.

## 12. Tests des fonctions (`supabase/tests/`)

Commande : `deno test --allow-env --allow-read supabase/tests` (sans réseau ni base ; les appels HTTP et RPC sont simulés).

| Fichier | Tests | Ce qu'il vérifie |
|---|---|---|
| `ingest.test.ts` | 12 | Standard Webhooks (signature valide, mauvais secret, corps modifié, plusieurs signatures et secrets, fenêtre de 5 min, en-tête absent) ; jeton ; `iclosed-in` (stockage brut, doublon, mauvais jeton, jeton dans l'URL) ; `whatsapp-in` (jeton ou signature de Meta, `hub.challenge`, URL jamais stockée) ; `lead-in` (jeton dans l'URL ou en en-tête) ; `whop-in` ; limites de méthode et de taille ; échec de stockage → 500 |
| `pipeline.test.ts` | 10 | Normalisation ; iClosed (contrat Zap, formes natives, `hookType`, « Contact updated », événements ignorés, erreurs) ; worker (application, ignorés, rejetés, échecs) ; WhatsApp (reçus, envoyés depuis l'application, statuts, historique, STOP, types ignorés) ; funnels (quiz, VSL, quiz abandonné, webinaire, noms de champs) |
| `fathom.test.ts` | 8 | Mapper, historique par curseur, routage vers `crm_apply_recordings`, attente sur 429 |
| `import.test.ts` | 9 | Close, addition des comptes, essai à blanc contre vraie exécution, clé absente, sonde sans valeurs, rapport des statuts, contacts, appels et ventes iClosed |
| `sla.test.ts` | 10 | SH-2, CO-1, SH-11, DE-1, SH-6, SH-8, DE-9, CA-2, DE-7, cycle fermé ; SH-1, SH-3, SH-4, SH-9 ; DE-4, DE-5, DE-8, DE-2, DO-2 ; CA-1, CA-5, CL-1, CL-3, CO-4, CO-5 ; réglages (source non reliée, SLA éteint, seuil changé, surface) ; modèle d'un cycle ; `sla-tick` (alertes du CRM, Slack seulement pour les SLA allumés, une fois) |
| `callqa_llm.test.ts` | 5 | Refus sans clé de service ; transmission avec cache des règles ; cache de la question et contrôle de l'effort ; mauvais modèle, clé absente, erreurs du fournisseur ; bloc `prefix` en cache |
| `simulateur_routes.test.ts` | 10 | Jeton exigé, lancement, réplique, erreur du modèle, annulation, fin dans les trois modes, fin par beacon, tour à la voix, réglages réservés aux administrateurs, outils de la voix |
| `simulateur_offres.test.ts` | 14 | Consignes neutralisées, création → 6 prospects, réponses illisibles, panne, doublons, réservé aux administrateurs, limites des PDF, régénération, ré-analyse, prospects, lecture d'un site |
| `simulateur_grille.test.ts`, `simulateur_etat.test.ts`, `simulateur_realisme.test.ts`, `simulateur_variantes.test.ts` | 3, 2, 8, 3 | Grille d'analyse, moteur d'état du prospect, mesure de réalisme (référentiel v0.13), variante du jour |

Autres tests liés : SQL `web/supabase/tests/run.sh` (dont `whatsapp_test.sql`, `setting_test.sql`, `source_de_verite_test.sql`,
`alertes_test.sql`, `sla_alerts_test.sql`, `sla_settings_test.sql`, `iclosed_deals_test.sql`, `no_show_rule_test.sql`,
`fathom_closest_test.sql`, `simulateur_test.sql`) ; `node app/training/simulateur_test.js $PWD/app/training/simulateur.html
<dossier>` (écran du Simulateur).

## 13. Ordre de mise en place dans un nouveau projet

1. Appliquer les migrations `web/supabase/*.sql` dans l'ordre (chapitre 03) ; vérifier `pg_cron` et `pg_net`.
2. Insérer `crm_settings.functions_url` (les tâches de §2.5 existent déjà : elles ne font rien sans cette ligne).
3. Déployer les dix fonctions avec `--no-verify-jwt` (ou poser les secrets GitHub et laisser `crm-functions.yml` le faire).
4. Créer les secrets de §2.4, puis configurer chaque service (§11) et vérifier `crm_webhook_log`.
5. Lancer les imports d'historique, chaque fois d'abord avec `dry=1` : `close`, `iclosed`, `iclosed_calls`, `iclosed_deals`, puis
   `fathom&since=<date>` ; relancer avec `?run=<id>` tant que la réponse dit `more: true` (Close, contacts iClosed).
6. Dans Paramètres › Alertes, marquer reliées les sources réellement branchées (`messages`, `whop`, `analysis`) ; pour Slack, poser
   `SLACK_SALES_CYCLE_WEBHOOK_URL`, `crm_settings.sla_alerts.link` et cocher les SLA à copier.
7. Poser `ANTHROPIC_API_KEY` (Supabase) et `SUPABASE_SERVICE_ROLE_KEY` + `vars.SUPABASE_URL` (GitHub) pour l'analyse d'appel
   (chapitre 09) ; `ELEVENLABS_API_KEY` si la voix du prospect doit être celle d'ElevenLabs.

## 14. Écarts entre la documentation et le code (le code fait foi)

| Sujet | Documentation | Code |
|---|---|---|
| Déclenchement de `process-inbox` | Webhook de base sur insertion + cron toutes les 5 min (`docs/crm/04` §2 ; 14 §1) | pg_cron chaque minute, seulement s'il reste des lignes à traiter (006, 054) |
| Projection | `_shared/projector.ts` (04 §3) | En SQL : `crm_recompute_cycle` |
| Fathom | Webhook + rapprochement nocturne (06 §2, §7) | Pas de webhook ; import horaire par l'API (minute 23), règles FL-1 à FL-6 |
| Whop | Mapper `mappers/whop.ts`, `whop-checkout` (08) | Réception seulement, aucun mapper |
| Fonctions prévues | `whop-checkout`, `claude-analyze`, `rules-tick`, `nurture-tick`, `reconcile`, `retention` | N'existent pas |
| Ventes iClosed | `docs/crm/05-integration-iclosed.md` : rien n'est pris des transactions iClosed | Import horaire des ventes (037), en événement `iclosed_deal` pour information seulement depuis 059 ; la doc ne mentionne ni l'import ni 059 |
| Nombre de SLA | « 42 SLA » (`docs/crm/18-sales-cycle-slas.md`, commentaires de 044 et de `web/kb/build_kb.mjs`) | 52 dans `sla_rules.js` (les 10 SE du setter ajoutés en 054) |
| Secrets | `docs/crm/setup.md` : `WHOP_API_KEY`, `WHOP_COMPANY_ID` ; ne cite ni `FUNNEL_INBOUND_TOKEN`, ni `ELEVENLABS_API_KEY`, ni `SLACK_SALES_CYCLE_WEBHOOK_URL` | Les trois derniers sont lus (`lead-in`, `simulateur`, `sla-tick`) ; les deux premiers ne le sont pas |
| Commentaire de `crm-import/index.ts` | « brings the leads that already exist in Close and iClosed » | Fait aussi Fathom, les ventes iClosed, les sondes et les rapports |
| Commentaire de `006_crm_cron.sql` | `sla-tick` « posts the new Late and Critical misses to Slack » | Depuis 053, `sla-tick` écrit d'abord les alertes du CRM ; Slack est une copie éteinte par défaut |
| Commentaire de `supabase/config.toml` | `sla-tick` : « Sales cycle SLAs to Slack » | Idem |
| `simulateur/balayer` | `index.ts` : la tâche planifiée passerait par la clé de service | La tâche n'envoie aucun en-tête ; la route `balayer` ne demande aucune authentification (elle ne prend aucune entrée et renvoie des nombres) |
| Analyse d'appel | `crm_call_analyses`, schéma v0 (09) | Tables `crm_ca_*` (020), moteur `lnp_callqa` ou moteur allégé (chapitre 09) |
