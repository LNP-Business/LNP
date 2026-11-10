# CRM phase 0 — setup guide

This guide is for Romain. It says, step by step, where to paste each secret and what to set in
Supabase, GitHub, iClosed, Fathom, WhatsApp Business and Whop, so that the four "inbox" functions
start receiving real data.

Everything stays in one place (decision D13): the **existing Supabase project `LNP`** and the
**existing GitHub repository LNP-Business/LNP**. No second project. Phase 0 only adds one table
(`crm_webhook_log`, invisible to the app and to every signed-in person) and four functions; the app at
https://lnp-sales.vercel.app works exactly as before.

**Rules for secrets**
- Paste a secret only in the place this guide names (Supabase or GitHub). Never in a chat, an email,
  a Slack message or a file of the repository.
- If a secret leaks, make a new one at the source and replace it in Supabase (the old one stops working).
- Until go-live, use only test people: yourself, a teammate, a personal email or phone. No real prospect.
  Test rows are removed before go-live.

What phase 0 does: each tool sends its events to a small function; the function checks the token or
signature and stores the request exactly as received in the table `crm_webhook_log`. Nothing else
happens yet (no CRM screen changes). The stored rows become the test data ("fixtures") of the next phases.

---

## Step 1 — Create the inbox table in `LNP`

1. Go to https://supabase.com/dashboard and open the project **`LNP`**.
2. **Project Settings › General**: copy the **Project ID** (about 20 letters, for example `abcdefghijklmnopqrst`).
   We call it `<ref>` below. It is not a secret. On the same page, note the **Region** for the checklist (Q9).
3. **SQL Editor** (left menu) › **New query**. (Done on 24 Oct 2026 through the Supabase connector. The file `003a_crm_webhook_log.sql` it used is now folded
   into `003_crm_core.sql`.) For reference: open the SQL file on GitHub, click
   **Copy raw file**, paste it in the editor, click **Run**. You should see *Success. No rows returned*.
   It only creates the new table; it changes nothing else.
4. **Table Editor** now shows a table `crm_webhook_log` (empty).

## Step 2 — Put the four functions online

The functions are deployed by GitHub, from the branch `main` only. GitHub needs two secrets for that.

1. Supabase: click your avatar (top right) › **Account preferences** › **Access Tokens**
   (https://supabase.com/dashboard/account/tokens) › **Generate new token**. Name: `github-lnp`.
   Copy the token (it starts with `sbp_`). This token can manage your Supabase projects: paste it only in GitHub, just below.
2. GitHub: open https://github.com/LNP-Business/LNP › **Settings** › **Secrets and variables** › **Actions** ›
   **New repository secret**, twice:

   | Name | Value |
   |---|---|
   | `SUPABASE_ACCESS_TOKEN` | the `sbp_…` token |
   | `SUPABASE_PROJECT_REF` | `<ref>` from step 1 |

3. Merge the phase 0 pull request into `main` (it changes nothing in the app). GitHub then runs
   **Actions › CRM functions** by itself; when its job *deploy* is green, Supabase › **Edge Functions** lists
   `iclosed-in`, `fathom-in`, `whatsapp-in` and `whop-in`. If you added the secrets after the merge, open
   **Actions › CRM functions** › **Run workflow** (branch `main`).
   After that, every change to the functions merged into `main` redeploys them by itself.

The addresses of the functions (not secret):

| Function | Address |
|---|---|
| iClosed | `https://<ref>.supabase.co/functions/v1/iclosed-in?k=<ICLOSED_INBOUND_TOKEN>` |
| Fathom | `https://<ref>.supabase.co/functions/v1/fathom-in` |
| WhatsApp | `https://<ref>.supabase.co/functions/v1/whatsapp-in?k=<WHATSAPP_INBOUND_TOKEN>` |
| Whop | `https://<ref>.supabase.co/functions/v1/whop-in` |

## Step 3 — Make the two tokens and where to paste secrets

Two secrets are ours (we invent them): `ICLOSED_INBOUND_TOKEN` and `WHATSAPP_INBOUND_TOKEN`.
Make each one with your password manager's generator: **48 characters, letters and digits only**
(no symbols: they go in a web address).

**Where every secret goes:** Supabase › `LNP` › **Edge Functions** › **Secrets** › **Add new secret**
(name exactly as written, value pasted, then **Save**). The functions read them at once, no redeploy needed.

| Secret name | Where it comes from | Used in phase |
|---|---|---|
| `ICLOSED_INBOUND_TOKEN` | you generate it (step 3) | 0 |
| `WHATSAPP_INBOUND_TOKEN` | you generate it (step 3) | 0 |
| `FATHOM_WEBHOOK_SECRET` | Fathom, when you create the webhook (step 5) | 0 |
| `WHOP_WEBHOOK_SECRET` | Whop sandbox, when you create the webhook (step 7) | 0 |
| `FATHOM_API_KEY` | Fathom › Settings › API Access (step 5) | 4 (can wait) |
| `WHATSAPP_APP_SECRET` | Meta app › Settings › Basic › App secret (step 6), only when Meta sends the webhooks directly | 7 |
| `WHOP_API_KEY`, `WHOP_COMPANY_ID` | Whop sandbox › Developer (step 7) | 5 (can wait) |
| `CLOSE_API_KEY` | Close › Settings › Developer › API Keys › New API Key | import of existing leads |
| `ICLOSED_API_KEY` | iClosed › Settings › Developers › API | import of existing leads (iClosed) |
| `ANTHROPIC_API_KEY` | console.anthropic.com | 9 (later) |

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set by Supabase itself: do not add them.
The Vercel variables of the app do not change.

## Step 4 — iClosed bookings (native webhook, no Zapier)

iClosed has its own webhooks (Q1 answered), so Zapier is not needed.

1. iClosed › **Settings** › **Integrations / Webhooks** › add a webhook.
2. **URL** (the token goes at the end of the address):
   `https://lludbqyosuzgwvvphmqc.supabase.co/functions/v1/iclosed-in?k=<ICLOSED_INBOUND_TOKEN>`
   (replace `<ICLOSED_INBOUND_TOKEN>` with the value you made in step 3). If iClosed lets you add a header instead,
   you can use the header `x-lnp-token` = your token and the address without `?k=…`.
3. **Events**: call booked (scheduled), call rescheduled, call cancelled. If iClosed offers more (no-show, outcome…),
   tick them too: they are only stored for now, and help decide the mapping in phase 2.
4. Save, then use iClosed's **Test** button if there is one, or book a test call with yourself. A row appears in
   `crm_webhook_log` with `source = iclosed` and `auth_ok = true`.
5. Write in the checklist which events iClosed offers.

If one day a Zap is needed after all, it posts the JSON contract of `05-integration-iclosed.md` §3 with the header
`x-lnp-token`; the same function accepts both.

## Step 5 — Fathom (recordings)

1. Fathom › **Settings** › **API Access** › **Generate API key**. Paste it in Supabase as `FATHOM_API_KEY`
   (used in phase 4; it can wait).
2. Same page › **Webhooks** › **Add webhook**:
   - Destination URL: the Fathom address of step 2.
   - Recordings: **My recordings**.
   - Include: **transcript**, **summary** and **action items** (all three on).
   - Save, then copy the **webhook secret** shown and paste it in Supabase as `FATHOM_WEBHOOK_SECRET`.
3. Test: record a short Google Meet / Zoom call with Fathom, inviting a personal email of yours
   (an "external" person). A few minutes after the end, a row appears with `source = fathom`.
4. If `auth_ok` is **false** on that row, nothing is lost (the request is kept): tell Claude, who will check
   Fathom's signature format on the stored row. If you do not see a Webhooks section in Fathom, tell Claude too:
   it will prepare another way, without you sharing the key.
5. Write in the checklist whether your Fathom plan shows API Access (question Q2).
6. Since 2026-10-29 (rules FL-1 to FL-6, `06-integration-fathom.md` §0) the webhook of point 2 is not needed: the job
   `crm-fathom-hourly` reads the Fathom API every hour with `FATHOM_API_KEY`. Calls already recorded: tell Claude.
   It runs `crm-import ?source=fathom&since=2026-06-01&dry=1` (counts only: linked by email, booking or name, not a sales
   call, ambiguous), shows you the recordings left unlinked, then runs it without `dry`. The key must see Valentino's
   recordings: create it from Valentino's Fathom account, or from an admin account of the team that sees them.

## Step 6 — WhatsApp Business (messages of the sales reps and setters)

Details: `docs/crm/07-integration-whatsapp.md`.

1. Meta Business portfolio of LNP, verified (business.facebook.com › Security Centre › Business verification).
2. Each sales rep and setter: the WhatsApp Business app on their phone, with their professional number.
3. Provider (360dialog recommended): onboarding « number already used in the WhatsApp Business app » (coexistence), link
   LNP's Meta Business portfolio, scan the QR code from the person's app, accept sharing the chat history.
4. Webhook at the provider: the WhatsApp address of step 2 (with `?k=` followed by your `WHATSAPP_INBOUND_TOKEN`), events
   **messages**, **smb_message_echoes** and **history**.
5. LNP › Paramètres › Compte › Accès de l'équipe: each person's number in the column « WhatsApp Business » (+33…).
6. Test: from your own phone, write to a team number; answer from the WhatsApp Business app. Rows appear with
   `source = whatsapp`, the answer attached to the right person.

## Step 7 — Whop (payments) — sandbox only

1. Open https://sandbox.whop.com and create a test company with one test product and price
   (same names as the real ones).
2. Sandbox › **Developer** › **Webhooks** › **Create webhook**:
   - URL: the Whop address of step 2. API version: **v1**.
   - Events: `payment.succeeded`, `payment.failed`, `payment.pending`, `payment.requires_action`,
     `refund.created`, `refund.updated`, `dispute.created`, `dispute.updated`, `membership.activated`.
   - Save, copy the **webhook secret** (starts with `ws_`) and paste it in Supabase as `WHOP_WEBHOOK_SECRET`.
3. Sandbox › **Developer** › **API keys**: create a company key; paste it as `WHOP_API_KEY`, and your company id
   (starts with `biz_`) as `WHOP_COMPANY_ID` (used in phase 5; they can wait).
4. Test: buy the test product with Whop's test card, once with a card that fails and once with one that
   succeeds, then refund it. Rows appear with `source = whop`.
5. Write in the checklist the **plan id** (starts with `plan_`) of each real product. It is not a secret.

## Step 7b — Alerts (in the CRM; Slack optional)

The alerts of the Sales cycle SLAs (docs/crm/18) live in the CRM (migration 053): every 5 minutes `sla-tick` opens, moves up
and closes them; each sales rep sees the alerts of their own leads in Ventes › Alertes (badge in the sidebar), admins those of
the whole team. Nothing to set up beyond migration 053 and the team (Settings › Account › Team access).

Optional copy to Slack, per SLA (off by default):

1. Open https://api.slack.com/apps › **Create New App** › **From scratch**: name **Alertes LNP**, LNP's Slack workspace.
2. **Incoming Webhooks** › turn it on › **Add New Webhook to Workspace** › choose the channel › **Allow**.
3. Copy the webhook URL (starts with `https://hooks.slack.com/services/`) and add it in Supabase › project **LNP** ›
   **Edge Functions** › **Secrets** as `SLACK_SALES_CYCLE_WEBHOOK_URL`. Never paste it in a chat.
4. Settings › Alerts: on each SLA wanted in Slack, switch on « Copie dans Slack (facultatif) ».

## Step 8 — Check and hand over

1. Supabase › `LNP` › **Table Editor** › `crm_webhook_log`: one row per test, `auth_ok = true`.
   `false` means the token or secret in Supabase does not match the one in the tool (paste it again).
2. **SQL Editor** › New query › paste and run:
   ```sql
   select id, source, delivery_id, received_at, headers, body, auth_ok, status from crm_webhook_log order by id;
   ```
   then **Export › Copy as JSON** (or download), and save it as `crm-rows.json`.
3. In a Claude session, attach `crm-rows.json` and ask: *"export the captured rows as fixtures"*.
   Claude runs `supabase/scripts/export_fixtures.py`, which replaces emails, phones, names, free text and links,
   and commits only the anonymised files `docs/crm/fixtures/<source>-<event>.json`. The raw file is never committed.

## Checklist to send back (no secrets in it)

| # | Question | Your answer |
|---|---|---|
| Q2 | Does your Fathom plan show API Access and Webhooks? | |
| Q5 | Automations in iClosed (reminders, follow-ups, workflows): trigger, message, recipient | |
| Q5 | Automatic WhatsApp messages (confirmation, reminders): who sends them, which templates | |
| Q9 | Region of `LNP`: ap-southeast-2 (Sydney). Origin of the leads (US / EU) to confirm later | |
| Q10 | Done? Supabase `LNP` › Authentication › URL Configuration: Site URL = `https://lnp-sales.vercel.app`, Redirect URLs include `https://lnp-sales.vercel.app/**` | |
| Q10 | Done? Supabase `LNP` › Authentication › Sign In / Providers › Email: Email OTP Expiration = `86400` | |
| — | iClosed webhook events offered (step 4.5) | |
| — | Whop plan id of each product (step 7.5) | |
