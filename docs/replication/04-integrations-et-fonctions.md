# 04 · Intégrations, fonctions Edge et analyse d'appel

Ce chapitre décrit tout ce qui tourne côté serveur en dehors de la page et de l'édition web : les huit fonctions Edge de
`supabase/functions/`, leurs modules partagés (`supabase/functions/_shared/`), les tâches planifiées qui les appellent, la
configuration à faire chez chaque service externe, puis la chaîne d'analyse d'appel (worker Python, moteur
`alkimiy_callqa`, passerelle `callqa-llm`, workflow GitHub Actions). Chaque fait vient du code ; le fichier est cité.
Quand `docs/crm/` dit autre chose que le code, c'est le code qui fait foi (voir §13).

Aucun secret n'apparaît ici : seuls les **noms** des secrets sont donnés.

---

## 1. Vue d'ensemble

```
Fournisseur ──POST──► <source>-in ──► crm_webhook_log (requête brute)
                                              │  pg_cron chaque minute (006)
                                              ▼
                                       process-inbox ── mapper ──► crm_apply_* (une transaction par ligne)
                                                                      │
                                         crm_people / crm_cycles / crm_calls / crm_events … ──► crm_recompute_cycle

pg_cron minute 23 ──► crm-import ?source=fathom&queue=1 ──► API Fathom ──► crm_import_recordings ──► crm_ca_jobs
pg_cron */5 min   ──► sla-tick ──► crm_sla_snapshot ──► sla_rules.js ──► crm_sla_claim ──► Slack #sales-cycle
GitHub Actions :07 ──► call-analysis/worker/run.py ──► crm_ca_claim ──► moteur ──► callqa-llm ──► API Anthropic
                                                                       └──► crm_ca_store / crm_ca_fail
```

| Fonction | Rôle | Déclencheur | Authentification |
|---|---|---|---|
| `iclosed-in` | Stocke le webhook iClosed brut | Webhook natif iClosed (ou Zap) | Jeton `ICLOSED_INBOUND_TOKEN` en `?k=` ou en en-tête `x-skl-token` |
| `fathom-in` | Stocke le webhook Fathom brut | Webhook Fathom (non utilisé en production, voir §6.3) | Signature Standard Webhooks, secrets `FATHOM_WEBHOOK_SECRETS` / `FATHOM_WEBHOOK_SECRET` |
| `sendblue-in` | Stocke le webhook Sendblue brut | Webhooks Sendblue `receive`, `outbound`, `call_log`, `inbound_call` | Jeton `SENDBLUE_INBOUND_TOKEN` en `?k=` |
| `whop-in` | Stocke le webhook Whop brut | Webhooks Whop | Signature Standard Webhooks, secret `WHOP_WEBHOOK_SECRET` |
| `process-inbox` | Transforme les lignes brutes en faits du CRM | pg_cron chaque minute (`crm-process-inbox`) | Aucune (ne prend aucune entrée) |
| `crm-import` | Imports (Close, iClosed, Sendblue, Fathom), rapports, sondes | pg_cron minute 23 (`crm-fathom-hourly`) et appels manuels | Aucune ; noms dans un rapport seulement avec `x-skl-token` = `CRM_REPORT_TOKEN` |
| `sla-tick` | Alertes SLA du cycle de vente vers Slack | pg_cron toutes les 5 min (`crm-sla-tick`) | Aucune (ne prend aucune entrée) |
| `callqa-llm` | Passerelle de modèle du worker d'analyse | Appels du worker (GitHub Actions) | Bearer = clé service role (`SUPABASE_SERVICE_ROLE_KEY` ou `SUPABASE_SECRET_KEY`) |

Les points d'entrée sont minimes : `supabase/functions/<nom>/index.ts` importe un module de `_shared/` et appelle
`Deno.serve(...)`. Toute la logique est dans `_shared/`, ce qui permet de la tester sans réseau (`supabase/tests/`).

## 2. Déploiement, configuration et planification

### 2.1 `supabase/config.toml`

Le dossier `supabase/` est l'espace de travail de la CLI Supabase pour les fonctions seulement (le schéma est géré par les
fichiers SQL numérotés de `web/supabase/`). `project_id = "skl-os"` (identifiant technique). Les huit fonctions ont
`verify_jwt = false` : aucun fournisseur n'envoie de JWT Supabase, chacune vérifie elle-même son jeton ou sa signature, ou
ne prend aucune entrée.

### 2.2 Déploiement (`.github/workflows/crm-functions.yml`)

- Déclenché sur `push` vers `main` ou `crm-*`, sur `pull_request` (chemins `supabase/**`, `web/supabase/**`,
  `skl-os/crm/**`, `web/api/**`, `web/tests/**`, `web/package*.json`, le workflow lui-même) et à la main.
- Job `test` : Deno 2.x, `deno check supabase/functions/*/index.ts` puis `deno test --allow-env --allow-read supabase/tests`.
- Job `sql` : Postgres 16 en service, `web/supabase/tests/run.sh` puis `node skl-os/crm/data.test.js`.
- Job `connector` : Node 22, `cd web && npm ci && npm test` (chapitre 05).
- Job `deploy` (après `test` et `sql`, sur `main` hors PR) : ignoré tant que les secrets GitHub `SUPABASE_ACCESS_TOKEN` et
  `SUPABASE_PROJECT_REF` manquent ; sinon, pour chaque fonction `iclosed-in fathom-in sendblue-in whop-in process-inbox
  crm-import callqa-llm sla-tick` : `supabase functions deploy "$f" --remote="$PROJECT_REF" --no-verify-jwt --yes`.

### 2.3 Variables fournies par Supabase

`SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` sont injectées par Supabase dans chaque fonction (ne pas les créer).
`callqa-llm` accepte aussi `SUPABASE_SECRET_KEY` comme clé de service (nouveau format de clé).

### 2.4 Secrets des fonctions (noms seulement)

À créer dans Supabase › Edge Functions › Secrets (lus à chaud, sans redéploiement).

| Secret | Lu par | Origine |
|---|---|---|
| `ICLOSED_INBOUND_TOKEN` | `iclosed-in` (`sources.ts`) | Généré par nous (48 caractères alphanumériques, `docs/crm/setup.md` étape 3) |
| `SENDBLUE_INBOUND_TOKEN` | `sendblue-in` | Généré par nous (alphanumérique : il va dans une URL) |
| `FATHOM_WEBHOOK_SECRET` ou `FATHOM_WEBHOOK_SECRETS` | `fathom-in` | Fathom, à la création du webhook ; `…SECRETS` = objet JSON `id → secret` ou tableau JSON |
| `WHOP_WEBHOOK_SECRET` | `whop-in` | Whop, à la création du webhook (`ws_…`) |
| `FATHOM_API_KEY` | `crm-import ?source=fathom` | Fathom › Settings › API Access |
| `ICLOSED_API_KEY` | `crm-import ?source=iclosed|iclosed_calls`, sondes, rapports | iClosed › Settings › Developers › API (préfixe `iclosed_` ajouté s'il manque) |
| `CLOSE_API_KEY` | `crm-import ?source=close`, `?report=statuses` | Close › Settings › Developer › API Keys |
| `SENDBLUE_API_KEY_ID`, `SENDBLUE_API_SECRET` | `crm-import ?source=sendblue`, `?report=sendblue` | Tableau de bord Sendblue › API |
| `CRM_REPORT_TOKEN` | `crm-import ?report=statuses` (noms dans la réponse) | Généré par nous, 32 caractères au moins |
| `SLACK_SALES_CYCLE_WEBHOOK_URL` | `sla-tick` | Slack, webhook entrant du canal `#sales-cycle` |
| `ANTHROPIC_API_KEY` | `callqa-llm` | console.anthropic.com |

`docs/crm/setup.md` cite aussi `WHOP_API_KEY` et `WHOP_COMPANY_ID` : aucune fonction ne les lit aujourd'hui.

### 2.5 Tâches planifiées (`web/supabase/006_crm_cron.sql`)

Elles utilisent `pg_cron` et `pg_net`. L'URL de base des fonctions est un réglage du CRM, pas un secret :
`crm_settings` clé `functions_url`, valeur JSON `"https://<ref>.supabase.co/functions/v1"`. Sans cette ligne, aucune tâche
n'appelle rien.

| Tâche | Horaire | Appel | Condition |
|---|---|---|---|
| `crm-process-inbox` | `* * * * *` | `POST <functions_url>/process-inbox`, corps `{}`, délai 30 s | Il existe une ligne `crm_webhook_log` de source `iclosed`, `sendblue` ou `fathom`, au statut `received` ou `failed`, avec `attempts < 8` |
| `crm-fathom-hourly` | `23 * * * *` | `POST <functions_url>/crm-import?source=fathom&queue=1`, délai 120 s | Toujours (si `functions_url` existe) |
| `crm-sla-tick` | `*/5 * * * *` | `POST <functions_url>/sla-tick`, délai 60 s | Toujours |
| `crm-no-show-hourly` | `35 * * * *` | SQL `select public.crm_no_show_tick()` (pas de fonction Edge) | Ne fait rien tant que `crm_settings.no_show_rule.enabled` n'est pas vrai (030) |

Le script désinscrit d'abord chaque tâche par son nom (`cron.unschedule`), il peut donc être rejoué.

---

## 3. Réception des webhooks (`_shared/ingest.ts`, `_shared/sources.ts`, `_shared/verify/`)

### 3.1 Ce que fait chaque fonction `*-in`

`makeHandler(opts)` (commun aux quatre) :

1. Méthode autre que `POST` → `405 POST only` (texte).
2. Corps de plus de 2 Mio (`MAX_BODY = 2 * 1024 * 1024`, vérifié sur `content-length` puis sur les octets lus) → `413 Body too large`.
3. Lit le corps **brut** en texte (les signatures portent sur les octets bruts), puis appelle `opts.check(req, raw, url)` ;
   une exception vaut échec.
4. Si la vérification passe et que la source donne un identifiant de livraison (`opts.deliveryId`), il est gardé ; une
   ligne rejetée n'a jamais d'identifiant de livraison (une requête forgée ne doit pas bloquer la vraie comme doublon).
5. Insère dans `crm_webhook_log` : `source`, `delivery_id`, `headers` (tous, sauf `authorization`, `cookie`, `apikey`,
   `x-skl-token` et les en-têtes secrets propres à la source, remplacés par `"<redacted>"`), `body` (brut), `auth_ok`,
   `status` = `received` ou `rejected`.
6. Réponses : échec d'écriture → `500 Not stored, retry later` (le fournisseur réessaie) ; vérification échouée →
   `401 Unauthorized` (la ligne est quand même gardée, pour audit) ; doublon (HTTP 409 ou code `23505` de PostgREST) →
   `200 Duplicate, already stored` ; sinon `200 Stored`.
7. L'URL n'est jamais journalisée (le jeton Sendblue est dans la chaîne de requête).

L'insertion passe par PostgREST avec la clé service role (`restInsert`, `prefer: return=minimal`). `crm_webhook_log` n'a
aucune politique RLS : seul le rôle de service y lit et écrit.

### 3.2 Table `crm_webhook_log` (`web/supabase/003_crm_core.sql`)

| Colonne | Type | Rôle |
|---|---|---|
| `id` | `bigint` identité | Clé |
| `source` | `event_source` (`iclosed`, `fathom`, `sendblue`, `whop`, `crm`, `claude`, `rules`, `import`) | Source |
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
| iClosed | `tokenMatches(x-skl-token, ICLOSED_INBOUND_TOKEN)` **ou** `tokenMatches(?k=, ICLOSED_INBOUND_TOKEN)` | `zap.task_id` du contrat Zap s'il existe, sinon aucun |
| Fathom | `verifyStandardWebhook(secretList("FATHOM_WEBHOOK_SECRETS", "FATHOM_WEBHOOK_SECRET"), …)` | En-tête `webhook-id` |
| Sendblue | `tokenMatches(?k=, SENDBLUE_INBOUND_TOKEN)` | Aucun : un `message_handle` revient à chaque changement de statut, ce n'est pas un identifiant de livraison |
| Whop | `verifyStandardWebhook(secretList("WHOP_WEBHOOK_SECRET"), …)` | En-tête `webhook-id` |

- `verify/token.ts` : `tokenMatches` hache les deux valeurs en SHA-256 puis compare en temps constant ; un secret vide ne
  correspond jamais.
- `verify/standard-webhooks.ts` : en-têtes `webhook-id`, `webhook-timestamp`, `webhook-signature`. Contenu signé
  `"<id>.<timestamp>.<corps brut>"`, HMAC-SHA256. Le timestamp doit être à moins de 300 s de l'heure courante. L'en-tête
  peut porter plusieurs signatures `v1,<base64>` séparées par des espaces : une seule suffit, pour l'un quelconque des
  secrets. Un secret `whsec_<base64>` est décodé ; tout autre secret (le `ws_…` de Whop) est pris comme octets bruts,
  comme le fait le SDK Whop.
- `ingest.ts › secretList` accepte un secret simple, un objet JSON (valeurs) ou un tableau JSON.

---

## 4. Le worker `process-inbox` (`_shared/worker.ts`)

Appelé chaque minute par pg_cron, il ne lit rien de la requête. `processPending(rpc, limit = 50)` :

1. `crm_inbox_pending(p_sources := ['iclosed','sendblue','fathom'], p_limit := 50)` (`005_crm_pipeline.sql`) renvoie, par
   `id` croissant, les lignes de ces sources avec `attempts < 8` et soit `status = 'received'`, soit `status = 'failed'`
   dont `coalesce(processed_at, received_at) + 2^(max(attempts-1,0))` minutes est passé (attente 1, 2, 4… minutes).
2. Pour chaque ligne :
   - `auth_ok` faux → `crm_inbox_mark(id, 'rejected', 'failed its token or signature check')` ;
   - le mapper de la source (`MAPPERS = { iclosed: mapIclosed, sendblue: mapSendblue, fathom: mapFathom }`) renvoie
     `{ ignored: raison }` → `crm_inbox_mark(id, 'ignored', raison)` ;
   - sinon `{ items }` : la fonction SQL est `APPLY_TYPE[items[0].type]` (`contact_updated` → `crm_apply_contact`), sinon
     `APPLY[source]` (`iclosed` → `crm_apply_items`, `sendblue` → `crm_apply_messages`, `fathom` → `crm_apply_recordings`).
     Elle écrit tout dans une transaction, met à jour la ligne (`processed`, `unmatched` ou `ignored`) et renvoie ce statut ;
   - exception (JSON illisible, champ obligatoire absent, erreur SQL) → `crm_inbox_mark(id, 'failed', message)`, qui
     incrémente `attempts` (au plus 8 tentatives, puis la ligne reste `failed`).
3. Réponse `200` JSON `{ rows: n, <statut>: nombre, … }` ; si la file elle-même est inaccessible, `500 {"error":"queue unavailable"}`.

`crm_inbox_pending`, `crm_inbox_mark` et les fonctions `crm_apply_*` sont `security definer`, exécutables par
`service_role` seulement. Whop n'a pas de mapper : ses lignes restent `received` et ne sont jamais prises (ni par le worker,
ni par la condition de la tâche cron).

### 4.1 Élément canonique (`_shared/canonical.ts`)

Chaque mapper produit des éléments de cette forme (ou `{ ignored }`, ou lève une erreur) :

| Champ | Contenu |
|---|---|
| `source` | `iclosed`, `fathom`, `sendblue`, `whop` |
| `source_id` | Identifiant stable du fait chez la source (clé d'idempotence : `crm_events` a `on conflict (source, source_id)`) |
| `type` | Type canonique (`call_booked`, `message_in`, `call_recorded`…) |
| `occurred_at` | Heure ISO du fait chez la source (pas l'heure de réception) |
| `actor` | `sales`, `prospect`, `auto`, `system` |
| `channel` | `booking`, `sms`, `imessage`, `phone`, `video`… |
| `content` | Texte éventuel |
| `identity` | `email`, `phone`, `iclosed_contact_id`, `whop_user_id`, `whop_member_id`, `name`, `emails[]` (Fathom) |
| `refs` | Références (`iclosed_call_id`, `fathom_recording_id`, `recorder_email`…) |
| `data` | Champs utiles au CRM et à l'écran |

### 4.2 Normalisation (`_shared/normalize.ts`)

- `normEmail` : chaîne, espaces et `<…>` retirés, minuscules ; `null` si ce n'est pas une adresse.
- `normPhone` : chiffres et `+` gardés, `00` initial → `+` ; un numéro sans indicatif n'est **jamais** deviné (`null`) ;
  validation et format E.164 avec `libphonenumber-js@1.13.14/max` (import `npm:`).
- `normId` : chaîne non vide ou `null`.

---

## 5. Formats reçus et règles de correspondance

Les exemples de charge utile sont dans `docs/crm/fixtures/*.json` (données remplacées, marquées `_illustrative`). On décrit
ici les champs, pas les valeurs.

### 5.1 iClosed (agenda seulement) · `_shared/mappers/iclosed.ts`

iClosed ne fournit que trois faits : appel réservé, déplacé, annulé (plus les coordonnées d'un contact). Les issues, notes et
transactions sont créées dans le CRM.

**Deux formes acceptées.**

- Webhooks natifs (depuis le 25/10/2026, fixtures `iclosed-native-*.json`) : `hookType` (`"Call booked"`,
  `"Call rescheduled"`, `"Call cancelled"`, `"Contact updated"`, `"Outcome added"`…), l'appel sous `event` (`type`, `uuid` =
  identifiant d'appel, `start_time`, `end_time`, `utc_start_time`, `utc_end_time`, `old_start_time`, `created_at`,
  `canceled_at`, `cancel_reason`, identifiant, nom et e-mail de l'hôte, `location_type`…), `contact` (`id`, `email`,
  `firstName`, `lastName`, `phoneNumber`), `invitee`, `event_type.name`, `questions_and_answers`. Pour « Contact updated » :
  `id`, `email`, `secondary_email`, `firstName`, `lastName`, `phoneNumber`, `status`, `updatedAt`, `updatedAttributes[]`.
- Contrat de Zap `skl.iclosed.v1` (fixture `iclosed-call_booked.json`, solution de repli) : `contract`, `event`
  (`call_booked|call_rescheduled|call_cancelled`), `occurred_at`, `call {id, start, end, event_type, host_email,
  cancel_reason, previous_start}`, `contact {id, first_name, last_name, email, phone}`, `zap {id, task_id}`.

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
| `daily_snapshot` | Ignoré (« reconciliation comes later ») |
| Tout autre (`outcome_added`…) | Ignoré (« stored, not used by the CRM ») |

**Lecture des champs** (chemins essayés dans l'ordre, première valeur non vide) :

- racine = `data`, `payload` ou le corps ; appel = `call`, `event`, `booking`, `appointment`, `meeting` ou la racine ;
  contact = `contact`, `invitee`, `lead`, `prospect`, `call.contact`, `call.invitee`, `attendee` ;
- identifiant d'appel : `id`, `callId`, `call_id`, `uuid`, `eventId`, `event_id`, `bookingId`, `booking_id` (dans l'appel puis
  la racine). **Absent → erreur** (la ligne passe en `failed`, avec la liste des clés) ;
- nom : `name`, `fullName`, `full_name`, sinon prénom + nom ; e-mail : `email`, `emailAddress`, `email_address` ; téléphone :
  `phone`, `phoneNumber`, `phone_number`, `mobile` ; identifiant de contact : `id`, `contactId`, `contact_id`, `uuid` ;
- début : `utc_start_time`, `start`, `startTime`, `start_time`, `startAt`, `start_at`, `scheduledStart`, `scheduled_start`,
  `startDate`, `date` ; fin : `utc_end_time`, `end`, `endTime`… ; un nombre < 10¹² est lu en secondes ;
- e-mail de l'hôte : `host_email`, `hostEmail`, `host.email`, l'e-mail du commercial iClosed (`closerEmail`,
  `closer.email`), `user.email`, `assignedTo.email`, `owner.email`, `organizer.email` ;
- `occurred_at` : `occurred_at`, `occurredAt`, `timestamp` du corps, puis `createdAt` (réservation) ou
  `updatedAt` / `cancelledAt` (autres) de la racine, puis `canceled_at` (annulation) ou `created_at` de l'appel, sinon l'heure
  de réception.

**Élément produit** : `source_id = iclosed:<type>:<callId>:<occurred_at>`, `actor = prospect`, `channel = booking`,
`identity {email, phone, iclosed_contact_id, name}`, `refs.iclosed_call_id`, `data {start, end, host_email, event_type,
cancel_reason, phone_raw (le numéro brut seulement s'il n'a pas pu être normalisé), summary}`.

**« Contact updated »** (`mapContact`, règle de 023) : seuls les attributs `name`, `firstname`, `lastname`, `email`, `phone`,
`phonenumber` de `updatedAttributes` comptent ; aucun → ignoré (« the CRM keeps its own status » : le statut iClosed n'est
jamais repris). Identifiant de contact obligatoire. Élément `type = contact_updated`,
`source_id = iclosed:contact_updated:<id>:<updatedAt>`, `data {changed[], summary}`.

**Application en base** (`crm_apply_items`, `005_crm_pipeline.sql`, redéfinie avec libellés français dans
`034_lnp_fr_labels.sql`) :

- appel connu par `crm_calls.iclosed_call_id` → son cycle et sa personne ;
- appel inconnu : un `call_rescheduled` devient `call_booked` ; un `call_canceled` va dans `crm_unmatched_inbox`
  (« Annulation d'un appel inconnu du CRM ») ; sinon la personne est cherchée par ses identifiants (`crm_people_for`) :
  plusieurs personnes → `crm_unmatched_inbox` ; aucune → nouvelle `crm_people` ; les identifiants sont ajoutés
  (`crm_add_identities`) ;
- nouvelle réservation : propriétaire = `crm_owner_for(host_email)`, cycle actif de la personne ou nouveau
  (`crm_open_cycle`), nouvel appel `rank = max + 1`, `status = scheduled` ;
- réservation d'un appel connu = déplacement ; un événement plus ancien n'écrase jamais un plus récent ; un nouveau début
  sans fin garde la durée ; un appel annulé redevient `scheduled` ;
- annulation : `status = canceled` (si `scheduled` ou `outcome_pending`) ;
- un événement `crm_events` par élément (`on conflict (source, source_id) do nothing`), puis `crm_recompute_cycle` de
  chaque cycle touché.

`crm_apply_contact` (`023_crm_contact_update.sql`, redéfinie dans 034) : personne trouvée par `iclosed_contact_id` (sinon
`crm_unmatched_inbox` « Mise à jour d'un contact inconnu du CRM ») ; l'ancien e-mail ou téléphone reste une identité, le
nouveau devient principal ; un nouvel e-mail ou téléphone qui appartient déjà à quelqu'un d'autre n'est pas déplacé (ligne
en `crm_unmatched_inbox`) ; aucun événement n'est écrit.

### 5.2 Sendblue (iMessage, SMS, appels) · `_shared/mappers/sendblue.ts`

Champs lus (vérifiés sur des webhooks capturés, fixtures `sendblue-receive.json`, `sendblue-outbound.json`) : `content`,
`is_outbound`, `status`, `message_handle`, `date_sent`, `date_updated`, `from_number`, `to_number`, `number`,
`sendblue_number`, `service`, `message_type`, `media_url`, `opted_out`, `group_id`, `source`, `error_code`,
`error_message` ; pour un appel : `call_id`, `direction`, `status`, `answered`, `duration`, `created_at`.

Règles (`sendblueItems`) :

1. `group_id` présent → ignoré (pas de règle pour les groupes).
2. `call_id` présent → appel téléphonique : sortant si `direction = outbound` ou si `from_number` = la ligne Sendblue ;
   numéro du prospect = `to_number` (sortant) ou `from_number` (entrant), sinon `number` ; aucun → ignoré.
   `type = phone_call_out | phone_call_in`, `source_id = sendblue:call:<call_id>`, `actor = sales | prospect`,
   `channel = phone`, `data {status, answered, duration, sendblue_number}`.
3. Sinon `message_handle` obligatoire (sans lui : ignoré, événement de ligne, de saisie ou de contact).
   Sortant si `is_outbound` vaut `true` ou `"true"`. Numéro = `number`, sinon `to_number` / `from_number`. Aucun → ignoré.
   `type = message_out | message_in`, `source_id = sendblue:<handle>`, `occurred_at = date_sent`,
   `actor` = `prospect` (entrant), `auto` si `source` ∈ {`workflow`, `automation`, `api`}, sinon `sales` ;
   `channel = sms` si `service` = `SMS`, sinon `imessage` ; `data {handle, status, service, origin, media_url,
   sendblue_number, error_code, error_message}`.
4. `opted_out = true`, ou message entrant dont tout le texte est `stop`, `arret`, `arrêt` ou `unsubscribe` (casse ignorée) →
   élément supplémentaire `type = opt_out`, `source_id = sendblue:optout:<handle>`.

Application (`crm_apply_messages` → `crm_apply_message_item`, `012_crm_messages.sql`, redéfinie dans 034) : la personne est
trouvée par téléphone ; plusieurs personnes → `crm_unmatched_inbox` (« Plusieurs personnes ont ce numéro de téléphone ») ;
aucune → nouvelle personne (règle d'équipe : une ligne Sendblue ne sert qu'avec des prospects, aucun message n'est perdu).
`opt_out` remplit `crm_people.opted_out_at`. Le cycle est le dernier ouvert avant le message, sinon le premier. Un message
est **un** événement : `on conflict (source, source_id) do update` fusionne `data` (le statut SENT → DELIVERED → READ) et
garde le texte.

### 5.3 Fathom (enregistrements) · `_shared/mappers/fathom.ts`

Depuis le 29/10/2026 (règles FL-1 à FL-6, `docs/crm/06-integration-fathom.md` §0, `025_crm_fathom_calls.sql`), Fathom est la
source de vérité des appels de vente. **Aucun webhook n'est utilisé en production** : la tâche `crm-fathom-hourly` lit l'API
chaque heure (§6). Le même mapper sert au webhook `fathom-in` s'il est un jour configuré (même `source_id`, rien n'est
compté deux fois).

Champs d'une réunion (fixture `fathom-new_meeting_content_ready.json`, forme de `GET /meetings`) : `recording_id`, `title`,
`url`, `share_url`, `created_at`, `scheduled_start_time`, `recording_start_time`, `recording_end_time`,
`calendar_invitees[] {name, email, email_domain, is_external}`, `recorded_by {name, email}`,
`transcript[] {speaker {display_name, matched_calendar_invitee_email}, text, timestamp}`,
`default_summary {template_name, markdown_formatted}`, `action_items[]`. Le corps d'un webhook est lu tel quel s'il a
`recording_id`, sinon sous `meeting` ou `data`.

`fathomItem` :

- `recording_id` absent ou non numérique → ignoré ;
- e-mails candidats : invités externes (`is_external` différent de `false`) et e-mails des intervenants, sauf celui de la
  personne qui enregistre ;
- noms candidats (deux mots ou plus) : invités, intervenants et nom tiré du titre (`titleNames` : « Nom x … »,
  « Updated - Nom x … », « Nom: … », « Nom | … »), sauf la personne qui enregistre ;
- début = `recording_start_time`, sinon `scheduled_start_time`, `created_at`, l'heure de réception ;
- élément : `type = call_recorded`, `source_id = fathom:recorded:<recording_id>`, `actor = sales`, `channel = video`,
  `identity.emails[]`, `refs {fathom_recording_id, recorder_email}`, `data {start, end, scheduled_start, title, url,
  share_url, recorder_name, names[], speakers[{name, email}], transcript (lignes brutes), transcript_raw, summary_md}` ;
- `transcript_raw` = format du moteur `"[hh:mm:ss] Intervenant: texte"` (`engineTranscript` : deux-points retirés des noms,
  horodatage invalide → `00:00:00`, lignes vides retirées).

Application (`crm_apply_recording_item`, appelée par `crm_apply_recordings` pour un webhook et par `crm_import_recordings`
pour l'import) :

| Règle | Effet |
|---|---|
| FL-1 | Candidat appel de vente si la personne qui enregistre est un commercial de `crm_sales_team` (par clé de membre ou partie locale de l'e-mail, `crm_fathom_sales_recorder`) ; sinon statut `not_sales_recorder` |
| FL-2 | Le prospect est trouvé par la première règle qui donne exactement une personne : (a) e-mail ; (b) réservation hébergée par cette personne à ± `fathom_match_minutes` (90) du début, non annulée, non liée ; (c) nom complet égal (`crm_norm_name`). 032 ajoute `booking_closest` : la réservation la plus proche gagne si elle commence à 15 min ou moins (`fathom_close_minutes`) et aucune autre. Plusieurs → `ambiguous` |
| FL-3 | Aucun prospect → `not_sales` (gardé dans `crm_fathom_recordings`, jamais de nouvelle personne) |
| FL-4 | Enregistrement lié = appel tenu : il remplit l'appel réservé correspondant, sinon devient un nouvel appel du cycle |
| FL-5 | R1, R2… = ordre des enregistrements de vente du cycle (`crm_rank_calls`) |
| FL-6 | L'appel demande son issue ; sa transcription part à l'analyse s'il est R1 ou R2, que les intervenants sont reconnus (`crm_fathom_speaker_map`) et que l'import a `p_queue` vrai (tâche horaire ou webhook) ; un import d'historique ne met jamais en file. Une transcription ajoutée à la main n'est jamais remplacée |

Mise en file (025) : si la transcription change, que `p_queue` est vrai, que `crm_ca_call_info(call).eligible` est vrai,
que la transcription fait 200 caractères ou plus et qu'il n'existe aucun job `queued`, `running` ou `done` pour cet appel →
`insert into crm_ca_jobs (call_id)`.

Résultat d'un webhook : `linked` → `processed` ; `ambiguous` → `crm_unmatched_inbox` (« Enregistrement Fathom : plusieurs
prospects correspondent ») et `unmatched` ; sinon `ignored` avec la note FL-1 ou FL-3.

### 5.4 Whop (paiements)

Seule la réception existe : `whop-in` vérifie la signature et stocke la requête. Il n'y a pas de mapper Whop, la file ne prend
pas les lignes `whop`. La fixture `whop-payment_succeeded.json` montre la forme attendue : `type`, `account_id`,
`data {id, status, total, currency, paid_at, user {id, email}, member {id, phone}, plan {id}, metadata {skl_cycle_id,
skl_person_id}}` et les en-têtes Standard Webhooks. La correspondance prévue (`docs/crm/08-integration-whop.md` §4) n'est pas
codée.

---

## 6. `crm-import` (imports, rapports, sondes)

`supabase/functions/crm-import/index.ts`. `POST` seulement (`405 POST only`). Aucune authentification de l'appelant : la
fonction répond par des comptes, jamais par des données personnelles, sauf `report=statuses` avec le bon jeton. Elle lit
et écrit la base par PostgREST avec la clé service role (`restRpc` pour les RPC, `restTable` pour les tables).

### 6.1 Paramètres de requête

| Requête | Effet |
|---|---|
| `?source=close[&dry=1][&run=<id>]` | Prospects Close → `crm_import_people`, par page de 100 |
| `?source=iclosed[&dry=1][&run=<id>]` | Contacts iClosed → `crm_import_people` |
| `?source=iclosed_calls[&dry=1]` | Appels iClosed → cycles et appels (`crm_import_calls`) |
| `?source=sendblue[&dry=1]` | Historique Sendblue → `crm_import_messages` |
| `?source=fathom[&since=AAAA-MM-JJ][&until=AAAA-MM-JJ][&queue=1][&dry=1]` | Enregistrements Fathom → `crm_import_recordings` ; `since` par défaut = il y a 2 jours ; `queue=1` met les analyses R1 / R2 en file (tâche horaire seulement) |
| `?source=iclosed&probe=1` | Lecture seule : forme (noms et types de champs, jamais de valeurs) des réponses de l'API iClosed sur des chemins connus, et chemins de sa description OpenAPI |
| `?source=iclosed&probe=2` | Lecture seule : quel paramètre pagine `/v1/contacts` et `/v1/eventCalls` (comparaison d'identifiants seulement) |
| `?report=statuses` | Statuts iClosed croisés avec les contacts Close (par e-mail ou téléphone) ; comptes seulement, et la liste des disqualifiés (nom, téléphone, statuts, date) seulement si l'en-tête `x-skl-token` égale `CRM_REPORT_TOKEN` (32 caractères au moins) |
| `?report=calls` | Comptes sur les appels iClosed (types, annulations, issues, mois, appels par contact) |
| `?report=sendblue` | Comptes sur l'historique Sendblue (sens, service, statut, source, type, groupe, mois) |

Autre `source` → `400 {"error":"source must be close, iclosed or iclosed_calls"}`. Dates `since` / `until` mal formées →
`400`.

### 6.2 Déroulement d'un import (`_shared/import_run.ts`)

- Clé absente → `409 {error: "<CLÉ> is not set in Supabase (Edge Functions › Secrets)"}`.
- Un seul import à la fois : une ligne `crm_import_runs` au statut `running` commencée il y a moins de 10 min → `409`
  `{error: "an import is already running", run: <id>}` (la tâche horaire Fathom saute alors son heure).
- Une ligne `crm_import_runs` est créée (`source = 'import'`, `dry_run`, `cursor {source, …}`) ; table de
  `007_crm_import.sql` : `status` `running|done|failed`, `cursor`, `stats` (comptes seulement), `error`, `started_at`,
  `finished_at` ; lisible par les membres du CRM qui voient tout (`crm_sees_all()`).
- **Close et iClosed (contacts)** : un vrai import avance page par page, appelle `crm_import_people(p_run, 'import', items,
  false)` et enregistre le curseur (`crm_import_save(..., 'running')`) après chaque page. Au-delà de 110 s (`budgetMs`) avec
  des pages restantes, il renvoie `{run, more: true, stats}` : rappeler avec `?run=<id>` pour continuer (le run doit être de la
  même source). Un essai à blanc (`dry=1`) lit tout puis envoie **tout** en un seul appel `p_dry = true` (comptes exacts de
  doublons), annulé en base.
- **iClosed (appels)** : lit tous les appels, les groupe par contact (`iclosedCallsToItems`), puis `crm_import_calls` par 100
  personnes (tout en un appel pour un essai à blanc).
- **Sendblue** : tout l'historique, puis `crm_import_messages` par lots de 250 (sous la limite de durée d'une requête).
- **Fathom** : `crm_import_recordings(items, p_dry, p_queue)` par lots de 10 réunions (les transcriptions sont longues).
- Fin : `crm_import_save(..., 'done')` et réponse `{run, dry, more: false, stats}` ; erreur : `crm_import_save(...,
  'failed', p_error)` puis `500 {error}` (message tronqué à 300 caractères).

**Comptes renvoyés (`stats`).**

| Source | Clés |
|---|---|
| Close / iClosed | `created`, `matched`, `conflicts`, `skipped`, `statuses {}` (007), plus `leads` ou `contacts` |
| iClosed (appels) | `people`, `created_people`, `cycles_opened`, `calls`, `calls_known`, `closed {}`, `conflicts`, `skipped` (009), plus `iclosed_calls`, `contacts` |
| Sendblue | `items`, `new`, `known`, `new_people`, `no_cycle`, `conflicts` (012), plus `sendblue_messages`, `ignored` |
| Fathom | `items`, un compte par statut (`linked`, `not_sales`, `not_sales_recorder`, `ambiguous`), `rule_<règle>`, `queued`, `speakers_unmapped` (025), plus `fathom_meetings`, `ignored` |

### 6.3 Lecture des sources (`_shared/importers/`)

| Source | Appel | Pagination | Conversion |
|---|---|---|---|
| Close (`close.ts`) | `GET https://api.close.com/api/v1/lead/?_limit=100&_skip=N&_fields=id,display_name,status_label,date_created,contacts,opportunities`, Basic auth (clé comme nom d'utilisateur) | `_skip`, `has_more` | Un élément par contact : `source_ref = <lead>:<contact>`, e-mails et téléphones normalisés, `close_contact_id`, `data {close_lead_id, lead_name, status_label, opportunities[] (statut, valeur, devise, dates)}` |
| iClosed contacts (`iclosed.ts`) | `GET https://public.api.iclosed.io/v1/contacts?limit=100&page=N` (N depuis 0), `Authorization: Bearer iclosed_<clé>` | Arrêt sur page vide, page sans nouveauté ou total `data.count` atteint ; 500 pages au plus | `source_ref = iclosed:<id>`, e-mails et téléphones principaux et secondaires, `data {iclosed_contact_id, status_label, country, time_zone, owner_email, events[]}` |
| iClosed appels (`iclosed.ts`) | `GET …/v1/eventCalls?limit=100&page=N` | Idem | Statut d'appel : `canceled` (motif ou auteur d'annulation, ou `noSaleReason` `ADMIN_CANCELLED` / `CONTACT_CANCELLED`), `no_show` (`NO_SHOW`), `held` (une issue), sinon `scheduled`. Statut de cycle : `won` (issue `WON`, une vente, ou événement « onboarding » / « case stud… ») ; `disqualified` / `dq_off_target` si le dernier appel finit `UNQUALIFIED`, `BAD_FIT` ou `REJECTED` sans annulation ; actif (`null`) si un appel est à venir ou date de moins de 30 jours ; sinon `lost` (`unreachable` après une absence, `timing` sinon) |
| Sendblue (`sendblue.ts`) | `GET https://api.sendblue.co/api/v2/messages?limit=100&offset=N`, en-têtes `sb-api-key-id`, `sb-api-secret-key` | `offset`, `pagination.hasMore` ; doublons de `message_handle` écartés ; 2000 pages au plus | Même mapper que les webhooks |
| Fathom (`fathom.ts`) | `GET https://api.fathom.ai/external/v1/meetings?created_after=…&include_transcript=true&include_summary=true[&created_before=…][&cursor=…]`, en-tête `X-Api-Key` | `next_cursor` ; une page au plus toutes les 1,1 s (`PAGE_GAP_MS`) ; sur `429`, attente `Retry-After` (sinon 5, 10, 20… s), 6 fois au plus ; 500 pages au plus | Même mapper que le webhook |

Toute réponse HTTP non 2xx d'une API externe lève `"<Source> API: HTTP <code> <200 premiers caractères>"`.

---

## 7. `sla-tick` et les règles SLA

### 7.1 Une seule source de règles (`_shared/sla_rules.js`)

Fichier JavaScript sans module (IIFE) qui expose `SKL_SLA = {DEFS, evaluate, worst, fmt, RANK}` sur `window` ou
`globalThis`. Il est inséré dans l'écran Cycle de vente par `skl-os/gen_crm.py` et importé par `sla-tick` : l'écran et Slack
appliquent exactement les mêmes règles (« SLA du cycle de vente v3 », `docs/crm/18-sales-cycle-slas.md`).

Seuils en heures (`M = 1/60`) : `warn` (préventif, « bientôt dû »), `late` (dépassé), `crit` (critique).

| Id | Nom (affiché) | Étape | Objectif | warn | late | crit | Démarre | S'arrête |
|---|---|---|---|---|---|---|---|---|
| SH-2 | Premier contact du commercial | Présence | 5 min | 3 min | 15 min | 1 h | Réservation (`booked`) | Premier message ou appel du commercial |
| SH-6 | R1 honoré à l'heure prévue | Présence | à l'heure prévue | — | 0,75 h | 48 h | R1 en absence (`noshow`) | Un appel tenu ensuite |
| SH-8 | Relance après une absence | Présence | 15 min | — | 1 h | 24 h | Chaque absence | Contact du commercial |
| SH-11 | Issue déclarée | Présence | 15 min | 10 min | 1 h | 24 h | Fin de l'appel (`meetdue`, ou `meet` suivi d'une décision) | Décision déclarée |
| DE-1 | Récap écrit après l'appel | Décision | 60 min | 0,75 h | 3 h | 24 h | Fin d'un appel tenu | Message du commercial |
| DE-7 | Relance sans réponse | Décision | 24 h | 20 h | 48 h | 96 h | Dernier message, s'il vient du commercial (étape Décision, pas d'appel à venir, pas de décision) | — (horloge ouverte) |
| DE-9 | Étape de décision | Décision | 72 h | 60 h | 72 h | 144 h | Premier appel tenu | Oui ou non |
| CA-2 | Premier paiement | Encaissement | 24 h | 12 h | 24 h | 48 h | Oui | Premier paiement |
| CO-1 | Réponse à un message du prospect | Conversation | 15 min | 10 min | 1 h | 4 h | Premier message sans réponse d'une rafale (CO-2 : hors 08:00-22:00 dans `opt.tz`, départ au 08:00 suivant) | Contact du commercial ou appel tenu |

Détails de `evaluate(lead, opt)` :

- Un prospect = `{age, ev: [{t (heures depuis l'ouverture du cycle), w: s|p|a, k, r, dur (min), yes, no}]}` ; « contact » =
  `k` ∈ {`im`, `sms`, `call`} ; `w = s` commercial, `p` prospect ; un appel dure 45 min par défaut.
- Niveau d'une horloge : `crit` si écoulé ≥ `crit`, `late` si ≥ `late`, `warn` si l'horloge est ouverte, a un `warn` et
  écoulé ≥ `warn`, sinon rien n'est produit.
- Un cycle fermé (paiement, ou décision « non ») arrête toutes les horloges ouvertes à ce moment.
- Chaque résultat : `{id, name, stage, target, level, open, start, stop, elapsed, at (heure du franchissement), late, extra
  (texte : « depuis la prise de RDV »…)}`.
- `worst(list)` = pire niveau ouvert ; `fmt(h)` = `N min` (< 1 h), `x,y h` (< 72 h), sinon `x,y j` (virgule décimale).

Non mesurés faute de données : SH-1, SH-3 à SH-5, SH-7, SH-9, SH-10, DE-2 à DE-6, DE-8, CA-1, CA-3 à CA-7, CO-3 à CO-5,
CL-*, DO-*.

### 7.2 Modèle d'un cycle (`_shared/sla_view.ts › toLead`)

Entrée = une ligne de `crm_sla_snapshot` : `{id, opened_at, person, owner, owner_key, events[{type, at, actor, channel,
call_id, source}], calls[{id, rank, status, start, end}]}`. Conversion des événements :

| Type CRM | Événement de règle |
|---|---|
| `call_booked`, `call_rescheduled` | `p booked` (rang de l'appel) |
| `message_in` | `p sms` ou `p im` |
| `message_out` | `a remind` si `actor` `auto` / `system`, sinon `s sms` / `s im` |
| `phone_call_in` / `phone_call_out` | `p call` / `s call` |
| `payment_succeeded` | `p paid` |
| `outcome_yes` / `outcome_follow_up` / `outcome_no`, `outcome_disqualified` | `s decision` `yes` / `fu` / `no` |
| `cycle_lost`, `cycle_disqualified` | `s decision no` (s'il n'y en a pas déjà) |
| `cycle_won` | `s decision yes`, plus `p paid` s'il n'y a aucun paiement |

Appels (hors annulés et sans début) : `held` → `s meet` ; `no_show` → `p noshow` ; `missed` → ignoré (030 : un R2+ manqué est
à replanifier) ; `outcome_pending` ou appel passé → `s meetdue` ; sinon `s meet` (à venir).

### 7.3 La fonction `sla-tick`

1. `POST` seulement. Sans `SLACK_SALES_CYCLE_WEBHOOK_URL` → `409` : rien n'est réservé, les dépassements des 6 dernières
   heures partiront une fois le secret posé.
2. Réglages `crm_sla_settings()` = `crm_settings.sla_alerts` (028) : `since` (date de la migration), `channel`
   (`#sales-cycle`), `max_age_hours` (6), `window_tz` (`America/New_York`) ; `link` facultatif.
3. `crm_sla_snapshot(p_days := 60)` (028, service role, sans texte de message ni transcription) : cycles `active` dont le
   dernier événement date de moins de 60 jours, avec leurs événements des 60 derniers jours et leurs appels.
4. Pour chaque dépassement **ouvert** de niveau `late` ou `crit` dont l'heure de franchissement est après `since` et à moins de
   `max_age_hours` : clé `<cycle>:<sla>:<début en minutes>:<niveau>`.
5. `crm_sla_claim(p_items)` insère les clés dans `crm_sla_notices` (`on conflict do nothing`) et renvoie celles qui sont
   nouvelles : chaque dépassement n'est publié qu'une fois. Table `crm_sla_notices` : `key`, `cycle_id`, `sla`, `level`
   (`late|crit`), `crossed_at`, `sent_at` ; RLS sans politique.
6. Un seul message Slack par passage (`POST` JSON `{text}` sur le webhook entrant). Réponse `{cycles, new, posted}` ; erreur
   `500 {error}`.

**Message Slack** (`slackText`, en français) :

```
<N> SLA du cycle de vente dépassé(s)
:red_circle: *Critique* · <id> <nom> · *<prospect>* (<commercial>) · <durée> <précision>, objectif <objectif>
:large_orange_circle: *En retard* · …
<lien|Ouvrir le cycle de vente>
```

Critiques d'abord. Prospect inconnu → « un prospect » ; sans propriétaire → « sans commercial attitré ». Le lien vient de
`crm_settings.sla_alerts.link` ; à défaut le code utilise `https://lnp-sales.vercel.app/#crm` (`sla-tick/index.ts`) : dans une réplique,
renseigner `link` avec l'adresse de l'application suivie de `/#crm`.

---

## 8. `callqa-llm` (passerelle de modèle)

`_shared/callqa_llm.ts › handleLlm`, appelée seulement par le worker d'analyse (qui ne détient aucune clé de modèle).

| Point | Règle |
|---|---|
| Méthode | `POST` seulement, sinon `405` |
| Authentification | `Authorization: Bearer <clé>` égale à `SUPABASE_SERVICE_ROLE_KEY` ou `SUPABASE_SECRET_KEY`, sinon `401 unauthorized` |
| Clé du modèle | `ANTHROPIC_API_KEY` absente → `409` |
| Corps | `{model, system, prompt, max_tokens?, effort?, cache_prompt?}` ; `model` doit correspondre à `^claude-[a-z0-9.\-]+$` ; `system` chaîne et `prompt` non vide obligatoires (`400`) |
| `max_tokens` | Défaut 4000, borné entre 1 et 16000 |
| `effort` | `low` par défaut ; valeurs `low`, `medium`, `high`, `xhigh`, `max`, `default` ; `default` n'envoie aucun effort (le modèle prend le sien) ; sinon `output_config: {effort}` |
| Cache | Le `system` porte toujours `cache_control: {type: "ephemeral"}` ; le `prompt` aussi si `cache_prompt === true` |
| Appel | `POST https://api.anthropic.com/v1/messages`, en-têtes `x-api-key`, `anthropic-version: 2023-06-01` ; pas de `temperature` (refusée par les modèles actuels) ; un seul message `user` |
| Réponse | `{text (blocs texte concaténés), usage, model, stop_reason}` |
| Erreurs du fournisseur | `429` ou `5xx` → `503 {error, retry: true}` ; autre → `502 {error, retry: false}` ; seuls le type et le message d'erreur sont renvoyés |

Rien n'est journalisé : ni consigne, ni transcription.

---

## 9. Analyse d'appel

Le moteur a ses propres règles : `call-analysis/CLAUDE.md` est à lire avant toute modification. Règle qui prime sur tout :
**le modèle extrait et cite, le code décide et note**. Les consignes envoyées au modèle
(`call-analysis/engine/alkimiy_callqa/prompts/*.md`) restent en anglais.

### 9.1 Données (`web/supabase/020_crm_call_analysis.sql`, 025, 034)

- `crm_calls` + `transcript_raw` (format du moteur), `speaker_map` (libellé → `SALES` / `PROSPECT` / `OTHER`),
  `transcript_source`, `transcript_added_at`.
- `crm_ca_config` (une ligne) : `tiers` (modèle par niveau ; valeur initiale `fast` = `claude-haiku-5-5`,
  `strong` = `claude-sonnet-5-5`, `arbiter` = `claude-opus-5-5`), `passes` (1 ou 3, défaut 3), `default_timezone`
  (`Asia/Dubai`), `provisional` (vrai). Les identifiants de modèle ne sont jamais dans le code.
- `crm_ca_offer` (référence d'offre versionnée, une seule active ; vide), `crm_ca_cases` (bibliothèque de cas ; vide).
- `crm_ca_jobs` : `status` `queued → running → done | failed`, `attempts`, `not_before`, `worker`, `error`,
  `engine_version`, `usage` (appels et jetons par niveau, secondes, effort).
- `crm_ca_records` (enregistrement d'appel), `crm_ca_turns` (tours réparés), `crm_ca_results` (une ligne par compétence),
  `crm_ca_audit` (chaque passe du modèle ; administrateurs seulement).
- Éligibilité (`crm_ca_call_info`) : appel de vente R1 ou R2, passé, non annulé ; dans un cycle avec des enregistrements
  Fathom, seuls les appels enregistrés par un commercial ; sinon les événements « onboarding » / « case stud… » sont exclus.
  La fonction renvoie aussi `sales_round`, `sales_id`, `sales_name`, `timezone`, `person` et la raison d'inéligibilité.
- Mise en file : automatique depuis Fathom (§5.3), ou depuis l'écran (`crm_ca_add_transcript`, `crm_ca_retry` : administrateurs
  et propriétaire du cycle).

### 9.2 Fonctions du worker (service role)

| Fonction | Effet |
|---|---|
| `crm_ca_claim(p_worker)` | Prend le plus ancien job `queued` dont `not_before` est passé, ou un job `running` depuis plus de 2 h (`for update skip locked`) ; le passe `running`, `attempts + 1` ; renvoie `{job, attempt, call (crm_ca_call_info), transcript, speaker_map, config {tiers, passes}, offer_reference, case_library, prior}` (`prior` = résultats des appels déjà analysés du même cycle) ; `null` s'il n'y a rien |
| `crm_ca_store(p_job, p_record, p_usage, p_engine)` | Job `running` obligatoire ; écrit enregistrement, tours, résultats et audit en une transaction ; job `done` ; événement `analysis_ready` (`source_id = analysis:<job>`, scores par compétence) |
| `crm_ca_fail(p_job, p_error, p_final)` | Si non final et `attempts < 3` : de nouveau `queued` dans 10 min ; sinon `failed` |

### 9.3 Le worker (`call-analysis/worker/`)

Python, bibliothèque standard seulement. `run.py [--once] [--budget-min 300]` :

1. Lit `SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` ; si l'une manque, ne fait rien.
2. Boucle tant que le budget n'est pas épuisé : `crm_ca_claim({"p_worker": "gha:<hôte>"})` ; plus de job → fin.
3. `GatewayClient(<SUPABASE_URL>/functions/v1/callqa-llm, clé, config.tiers, effort = CALLQA_EFFORT ou config.effort ou "low")`.
4. `run_job(claim, client, rounds=True, workers=24, budget_s=90*60)` puis `crm_ca_store` avec
   `usage = {tiers, seconds, effort}` et `ENGINE_VERSION = "alkimiy_callqa-1.0"`.
5. Échecs : `ModelErrors` (plus de la moitié des questions du modèle en erreur : l'enregistrement serait vide) et `TooLong`
   (budget de 90 min dépassé) → `crm_ca_fail(..., p_final = true)` ; `GatewayError` → final selon l'erreur ; toute autre
   exception → non final. Les journaux ne contiennent que des identifiants, statuts, scores et comptes de jetons.

Modules :

- `callqa_worker/supabase.py` : `POST /rest/v1/rpc/<nom>` avec la clé service role ; 4 tentatives sur erreur 5xx ou réseau
  (attente 2, 4, 8 s) ; une erreur 4xx est levée aussitôt.
- `callqa_worker/gateway.py` : client de modèle du moteur. Un niveau sans modèle (`fast`, `strong`, `arbiter`) → erreur
  finale. Corps `{model, system, prompt, max_tokens: 4000, effort, cache_prompt: pass_no >= 1}`. Effort par tâche
  (`TASK_EFFORT`) : `foundation.attribution` et `foundation.phases` = `default`, `spin.register` = `medium`, les autres =
  effort du job. 5 tentatives, délai 180 s, attente `min(2^(i+1), 30)` s ; `401`, `409` ou `502` avec `retry: false` →
  erreur finale ; `429`, `500`, `502`, `503`, `504` et erreurs réseau → nouvel essai. Cumule `calls`, `input_tokens`,
  `output_tokens`, `cache_read_input_tokens`, `cache_creation_input_tokens` par niveau.
- `callqa_worker/prefetch.py` : le moteur pose ses questions une par une (environ 2 000 pour un appel d'une heure). Le worker
  rejoue tout le pipeline (code pur) par **tours** : les réponses déjà reçues viennent d'un cache (clé = tâche, unité, passe,
  niveau, SHA-256 de `system + prompt`) ; une question sans réponse lève `Pending`, que le moteur traite comme une erreur
  pour ce tour ; le worker envoie en parallèle les questions de la première tâche en attente (passe 1 et arbitrages dont les
  trois passes sont connues d'abord, puis passes 2 et 3, qui lisent la consigne en cache), puis recommence. Quand un tour ne
  manque de rien, le résultat est celui d'une exécution séquentielle. 400 tours au plus.
- `callqa_worker/job.py` : `build_context` (transcription analysée par `parse_transcript` avec la carte des intervenants,
  bibliothèque de cas, épisodes d'objection des appels précédents) et `result_record`.

### 9.4 Le moteur (`call-analysis/engine/alkimiy_callqa`, résumé de `call-analysis/docs/ARCHITECTURE.md`)

Un **pipeline fixe** à trois couches : une fondation commune calculée une fois, de nombreuses petites tâches du modèle (une
question fermée sur une unité, avec citations exactes), du code déterministe qui vérifie chaque citation et prend chaque
décision et chaque note.

Ordre des étapes : F0 analyse de la transcription (tours `T001…`, rôles) → F1 contrôle de diarisation (statuts
`no_transcript`, `no_diarization`, `diarization_suspect`) → F2 contrôle d'attribution (modèle `fast`, blocs de 60 tours,
tours scindés `T050b`) → F3 carte des phases (début du pitch, premier prix, demande de décision…) → C1 SPIN → C2 Gap →
C3 Pitch → C4 Objections. Une compétence ne replace jamais un repère d'une étape précédente ; un plantage dans une compétence
la met `to_review` sans arrêter les autres.

Exécution d'une tâche (30 tâches, une consigne par tâche dans `prompts/`) :

1. trois passes indépendantes, même consigne ;
2. chaque passe est validée par le code : la citation doit être une sous-chaîne exacte du tour cité, dite par le bon rôle,
   dans la bonne phase ; une réponse invalide est rejouée **une** fois avec le message d'erreur, puis la passe est invalide ;
3. trois passes valides et clés de concordance égales → `verified` ;
4. sinon **arbitrage** (niveau `arbiter`), qui décide en suivant les règles dans l'ordre, jamais par vote, et classe le cas
   `application_error`, `rule_ambiguity` ou `uncovered_case` → `arbitrated` ;
5. indécidable → `to_review`, l'unité est exclue des notes.

Le code décide seul : vérifications de citations, ordres, lettre SPIN, sélections A / B / P du Gap, règle du mot pour mot
(GB-22), portes et exclusions, niveaux d'item, notes d'appel et de période.

**Contrat de sortie** (`call-analysis/docs/OUTPUT_CONTRACT.md`, `pipeline.result_record(ctx)`) :

```
{ call_id, sales_id, start_utc, timezone,
  status: ok | no_transcript | no_diarization | diarization_suspect, flags: [],
  turns: [{id, ts, role, speaker, text, repaired, attribution_doubtful}],
  phases: {discovery_start, discovery_end, pitch_start, first_price, decision_request, pitch_end, offer_mentions, early_price, flags},
  results: { SPIN, GAP, PITCH, OBJECTIONS: CompetenceResult },
  audit: [{task, unit, pass, tier, prompt_hash, answer, errors}] }

CompetenceResult = { competence, rules_version (ex. "GAP-1.3"),
  status: scored | not_applicable | excluded | to_review, verdict: present | absent | compliant | non_compliant | null,
  reasons: [], score: 0..100 | null,
  items: [{id, weight, level: 0|1|2|null, evidence: [{quote, turn, role}], note}],
  flags: [], details: {…propre à la compétence…}, concordance: "3/3" | null }
```

`crm_ca_store` répartit ce contrat dans les tables de §9.1. L'écran et le connecteur ne renvoient jamais la transcription.

Coût mesuré (ARCHITECTURE.md §7) : effort `low`, cache de consigne et envoi de la passe 1 avant les passes 2 et 3 ont fait
passer deux appels de 7,10 à 3,65 USD et de 10,15 à 4,40 USD.

Commandes du moteur (`call-analysis/CLAUDE.md`) : `cd call-analysis/engine && python3 -m pytest -q tests` ;
`CALLQA_CORPUS=<dossier> python3 -m pytest -q tests` (cas de l'annexe B sur un autre corpus) ;
`python3 -m alkimiy_callqa.pipeline transcript.txt --config call.json` (un appel, modèle réel).

### 9.5 Le workflow `.github/workflows/call-analysis.yml`

- `push` sur `main` et `pull_request` (chemins `call-analysis/**` et le workflow) → job `test` : Python 3.11, `pytest` ; si le
  secret `SUPABASE_SERVICE_ROLE_KEY` existe, télécharge `callqa-fixtures/transcripts.tar.gz` (bucket Storage privé) dans
  `call-analysis/engine/tests/fixtures/transcripts`, sinon pose `CALLQA_SKIP_MISSING_CORPUS=1` (tests de l'annexe B sautés) ;
  puis tests du moteur et du worker.
- `schedule: "7 * * * *"` et `workflow_dispatch` (entrée `effort` : `low` ou `default`) → job `worker` : délai 150 min,
  `concurrency: call-analysis-worker` sans annulation, ignoré sans le secret ; `python3 call-analysis/worker/run.py
  --budget-min 120` avec `SUPABASE_SERVICE_ROLE_KEY` et `CALLQA_EFFORT`.
- `SUPABASE_URL` vient de la **variable** de dépôt `vars.SUPABASE_URL` (`https://<ref>.supabase.co`).

---

## 10. Ce qu'il faut configurer chez chaque service

Les adresses ont la forme `https://<ref>.supabase.co/functions/v1/<fonction>` (`<ref>` = identifiant du projet Supabase).

| Service | Côté service | Côté Supabase |
|---|---|---|
| **iClosed** | Settings › Integrations / Webhooks : URL `…/iclosed-in?k=<ICLOSED_INBOUND_TOKEN>` (ou en-tête `x-skl-token` sans `?k=`) ; événements appel réservé, déplacé, annulé (et « Contact updated ») ; clé API (Settings › Developers › API) pour les imports | `ICLOSED_INBOUND_TOKEN`, `ICLOSED_API_KEY` |
| **iClosed par Zapier** (repli) | Un Zap par déclencheur (Call Booked / Rescheduled / Cancelled) → Webhooks by Zapier POST JSON du contrat `skl.iclosed.v1`, en-tête `x-skl-token`, Autoreplay activé (`docs/crm/05` §2-3) | Idem |
| **Fathom** | Settings › API Access : clé API créée depuis un compte qui voit les enregistrements des commerciaux. Webhook facultatif (non utilisé) : URL `…/fathom-in`, « My recordings », transcript, summary et action items cochés | `FATHOM_API_KEY` ; si webhook, `FATHOM_WEBHOOK_SECRET` (ou `FATHOM_WEBHOOK_SECRETS`) |
| **Sendblue** | Webhooks `receive`, `outbound`, `call_log`, `inbound_call` vers `…/sendblue-in?k=<SENDBLUE_INBOUND_TOKEN>` ; clés API pour l'historique | `SENDBLUE_INBOUND_TOKEN`, `SENDBLUE_API_KEY_ID`, `SENDBLUE_API_SECRET` |
| **Whop** | Developer › Webhooks : URL `…/whop-in`, version d'API v1, événements `payment.succeeded`, `payment.failed`, `payment.pending`, `payment.requires_action`, `refund.created`, `refund.updated`, `dispute.created`, `dispute.updated`, `membership.activated` (stockés seulement) | `WHOP_WEBHOOK_SECRET` |
| **Close** | Settings › Developer › API Keys : nouvelle clé (import des prospects existants seulement, aucun webhook) | `CLOSE_API_KEY` |
| **Slack** | App « From scratch » dans l'espace de travail de l'équipe, Incoming Webhooks activés, webhook du canal `#sales-cycle` | `SLACK_SALES_CYCLE_WEBHOOK_URL` ; `crm_settings.sla_alerts.link` |
| **Anthropic** | Clé API (console.anthropic.com) | `ANTHROPIC_API_KEY` ; modèles dans `crm_ca_config.tiers` |
| **Supabase** | `crm_settings.functions_url` ; extensions `pg_cron`, `pg_net` ; bucket privé `callqa-fixtures` (tests seulement) | — |
| **GitHub** | Secrets `SUPABASE_ACCESS_TOKEN` (jeton `sbp_…`), `SUPABASE_PROJECT_REF`, `SUPABASE_SERVICE_ROLE_KEY` ; variable `SUPABASE_URL` | — |

Contrôle : chaque essai crée une ligne `crm_webhook_log` avec `auth_ok = true` ; `false` signifie que le jeton ou le secret
diffère entre l'outil et Supabase. Une ligne `failed` ou `unmatched` se rejoue en remettant `status = 'received'` et
`attempts = 0` (les événements sont idempotents). Une ligne `rejected` garde `auth_ok = false` : rejouée telle quelle, elle
serait rejetée de nouveau ; c'est la livraison suivante du fournisseur, avec le bon secret, qui compte.

## 11. Tests des fonctions (`supabase/tests/`)

Commande : `deno test --allow-env --allow-read supabase/tests` (sans réseau ni base ; les appels HTTP et RPC sont simulés).

| Fichier | Ce qu'il vérifie |
|---|---|
| `ingest.test.ts` | Standard Webhooks (signature valide, mauvais secret, corps modifié, plusieurs signatures et secrets, fenêtre de 5 min, en-tête absent) ; jeton ; `iclosed-in` (stockage brut, doublon, mauvais jeton, jeton dans l'URL) ; `sendblue-in` (URL jamais stockée) ; `whop-in` ; limites de méthode et de taille ; échec de stockage → 500 |
| `pipeline.test.ts` | Normalisation des e-mails et téléphones ; iClosed (contrat Zap, formes natives, `hookType`, « Contact updated », événements ignorés, erreurs) ; worker (application, ignorés, rejetés, échecs) ; Sendblue (reçus, envoyés, statuts sur un handle, STOP, groupes, appels) |
| `fathom.test.ts` | Mapper (fixture, enregistrement sans invité, noms des titres, format de transcription, sans `recording_id`) ; lecture de l'historique par curseur ; routage vers `crm_apply_recordings` ; attente sur 429 |
| `import.test.ts` | Close (un élément par contact), addition des comptes, essai à blanc en un appel contre vraie exécution par pages, clé absente, sonde sans valeurs, rapport des statuts, contacts et appels iClosed, historique Sendblue |
| `sla.test.ts` | SH-2, CO-1 (rafale, appel tenu, nuit), SH-11, DE-1, SH-6, SH-8, DE-9, CA-2, DE-7, cycle fermé ; modèle d'un cycle ; `sla-tick` (une seule publication, jamais le passé, jamais avant `since`) |
| `callqa_llm.test.ts` | Refus sans clé de service ; transmission d'une question avec cache des règles ; cache de la question et contrôle de l'effort ; mauvais modèle, clé absente, erreurs du fournisseur |

Autres tests liés : SQL `web/supabase/tests/run.sh` (dont `sla_alerts_test.sql`, `no_show_rule_test.sql`,
`fathom_closest_test.sql`) ; moteur et worker `cd call-analysis/engine && python3 -m pytest -q tests`,
`cd call-analysis/worker && python3 -m pytest -q tests`.

## 12. Ordre de mise en place dans un nouveau projet

1. Appliquer les migrations `web/supabase/*.sql` dans l'ordre (le chapitre sur les données les détaille).
2. Insérer `crm_settings.functions_url`.
3. Déployer les huit fonctions avec `--no-verify-jwt` (ou laisser `crm-functions.yml` le faire).
4. Créer les secrets du §2.4, puis configurer chaque service (§10) et vérifier `crm_webhook_log`.
5. Lancer les imports dans cet ordre, chaque fois d'abord avec `dry=1` : `close`, `iclosed`, `iclosed_calls`, `sendblue`,
   puis `fathom&since=<date>` ; relancer avec `?run=<id>` tant que la réponse dit `more: true`.
6. Poser `SLACK_SALES_CYCLE_WEBHOOK_URL` et `crm_settings.sla_alerts.link`.
7. Poser `ANTHROPIC_API_KEY` (Supabase) et `SUPABASE_SERVICE_ROLE_KEY` + `vars.SUPABASE_URL` (GitHub) pour l'analyse d'appel.

## 13. Écarts entre `docs/crm/` et le code (le code fait foi)

| Sujet | `docs/crm/` | Code |
|---|---|---|
| Déclenchement de `process-inbox` | Webhook de base sur insertion + cron toutes les 5 min (04 §2 ; 14 §1) | pg_cron chaque minute, seulement s'il reste des lignes à traiter (006) |
| Projection | `_shared/projector.ts` (04 §3) | En SQL : `crm_recompute_cycle` |
| Statut Sendblue | Type `message_status` et `source_id` `sendblue:status:<handle>:<statut>` (04 §4, 07 §1) | Un seul événement par handle, mis à jour (`on conflict do update`) |
| Message automatique Sendblue | `auto` si le handle est dans `crm_outbound_messages` (07 §1) | `auto` si le champ `source` vaut `workflow`, `automation` ou `api` |
| Fathom | Webhook + rapprochement nocturne (06 §2, §7) | Pas de webhook ; import horaire par l'API (minute 23), règles FL-1 à FL-6 |
| Whop | Mapper `mappers/whop.ts`, `whop-checkout` (08) | Réception seulement, aucun mapper |
| Fonctions prévues | `sendblue-send`, `whop-checkout`, `claude-analyze`, `rules-tick`, `nurture-tick`, `reconcile`, `retention` | N'existent pas ; l'analyse d'appel passe par le worker GitHub et `callqa-llm` |
| Analyse d'appel | `crm_call_analyses`, schéma v0 (09) | Tables `crm_ca_*` (020), moteur `alkimiy_callqa` |
| Worker d'analyse | Toutes les 10 minutes (`call-analysis/PLAN.md` §2) | Chaque heure à la minute 7 |
| Nombre de tests du moteur | 209 (`call-analysis/CLAUDE.md`) | Libellé d'étape « Engine (184 tests) » dans le workflow (simple libellé) |
