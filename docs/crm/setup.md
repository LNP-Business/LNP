# CRM phase 0 — setup guide

This guide is for Romain. It says, step by step, where to paste each secret and what to set in
Supabase, GitHub, iClosed, Fathom, Sendblue and Whop, so that the four "inbox" functions
start receiving real data.

Everything stays in one place (decision D13): the **existing Supabase project `skl-os`** and the
**existing GitHub repository RomainSKL/skl-os**. No second project. Phase 0 only adds one table
(`crm_webhook_log`, invisible to the app and to every signed-in person) and four functions; the app at
https://skl-os.vercel.app works exactly as before.

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

## Step 1 — Create the inbox table in `skl-os`

1. Go to https://supabase.com/dashboard and open the project **`skl-os`**.
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
   (https://supabase.com/dashboard/account/tokens) › **Generate new token**. Name: `github-skl-os`.
   Copy the token (it starts with `sbp_`). This token can manage your Supabase projects: paste it only in GitHub, just below.
2. GitHub: open https://github.com/RomainSKL/skl-os › **Settings** › **Secrets and variables** › **Actions** ›
   **New repository secret**, twice:

   | Name | Value |
   |---|---|
   | `SUPABASE_ACCESS_TOKEN` | the `sbp_…` token |
   | `SUPABASE_PROJECT_REF` | `<ref>` from step 1 |

3. Merge the phase 0 pull request into `main` (it changes nothing in the app). GitHub then runs
   **Actions › CRM functions** by itself; when its job *deploy* is green, Supabase › **Edge Functions** lists
   `iclosed-in`, `fathom-in`, `sendblue-in` and `whop-in`. If you added the secrets after the merge, open
   **Actions › CRM functions** › **Run workflow** (branch `main`).
   After that, every change to the functions merged into `main` redeploys them by itself.

The addresses of the functions (not secret):

| Function | Address |
|---|---|
| iClosed | `https://<ref>.supabase.co/functions/v1/iclosed-in?k=<ICLOSED_INBOUND_TOKEN>` |
| Fathom | `https://<ref>.supabase.co/functions/v1/fathom-in` |
| Sendblue | `https://<ref>.supabase.co/functions/v1/sendblue-in?k=<SENDBLUE_INBOUND_TOKEN>` |
| Whop | `https://<ref>.supabase.co/functions/v1/whop-in` |

## Step 3 — Make the two tokens and where to paste secrets

Two secrets are ours (we invent them): `ICLOSED_INBOUND_TOKEN` and `SENDBLUE_INBOUND_TOKEN`.
Make each one with your password manager's generator: **48 characters, letters and digits only**
(no symbols: the Sendblue one goes in a web address).

**Where every secret goes:** Supabase › `skl-os` › **Edge Functions** › **Secrets** › **Add new secret**
(name exactly as written, value pasted, then **Save**). The functions read them at once, no redeploy needed.

| Secret name | Where it comes from | Used in phase |
|---|---|---|
| `ICLOSED_INBOUND_TOKEN` | you generate it (step 3) | 0 |
| `SENDBLUE_INBOUND_TOKEN` | you generate it (step 3) | 0 |
| `FATHOM_WEBHOOK_SECRET` | Fathom, when you create the webhook (step 5) | 0 |
| `WHOP_WEBHOOK_SECRET` | Whop sandbox, when you create the webhook (step 7) | 0 |
| `FATHOM_API_KEY` | Fathom › Settings › API Access (step 5) | 4 (can wait) |
| `SENDBLUE_API_KEY_ID`, `SENDBLUE_API_SECRET` | Sendblue dashboard › API keys (step 6) | 7 (can wait) |
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
   `https://ohocejgkkwanbpdbypye.supabase.co/functions/v1/iclosed-in?k=<ICLOSED_INBOUND_TOKEN>`
   (replace `<ICLOSED_INBOUND_TOKEN>` with the value you made in step 3). If iClosed lets you add a header instead,
   you can use the header `x-skl-token` = your token and the address without `?k=…`.
3. **Events**: call booked (scheduled), call rescheduled, call cancelled. If iClosed offers more (no-show, outcome…),
   tick them too: they are only stored for now, and help decide the mapping in phase 2.
4. Save, then use iClosed's **Test** button if there is one, or book a test call with yourself. A row appears in
   `crm_webhook_log` with `source = iclosed` and `auth_ok = true`.
5. Write in the checklist which events iClosed offers.

If one day a Zap is needed after all, it posts the JSON contract of `05-integration-iclosed.md` §3 with the header
`x-skl-token`; the same function accepts both.

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

## Step 6 — Sendblue (iMessage, SMS, calls)

1. Sendblue dashboard › **API** (or **Settings › API keys**): copy the **API key id** and **API secret**, paste them in
   Supabase as `SENDBLUE_API_KEY_ID` and `SENDBLUE_API_SECRET` (used in phase 7; they can wait).
2. Sendblue dashboard › **Webhooks**: for each of these types, set the URL to the Sendblue address of step 2
   (with `?k=` followed by your `SENDBLUE_INBOUND_TOKEN`):
   **receive**, **outbound**, **call_log**, **inbound_call**. Leave the other types empty.
3. Test: from your own phone, text the Sendblue line; reply from Sendblue; if calls are on, make a short call.
   Rows appear with `source = sendblue`.
4. Write down in the checklist every **automation** set up in Sendblue (automatic messages, sequences,
   auto-replies): what triggers it, what it sends, to whom (question Q5).

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

## Step 7b — Slack #sales-cycle (SLA alerts)

The Sales cycle SLAs (docs/crm/18) post each new Late or Critical miss to Slack #sales-cycle, in the IDA workspace
(theinteriordesign). It needs an incoming webhook of that channel, kept as a Supabase secret; never paste it in a chat.

1. In Slack (IDA workspace), create the channel **#sales-cycle** if it does not exist.
2. Open https://api.slack.com/apps › **Create New App** › **From scratch**: name **SKL OS alerts**, workspace
   **theinteriordesign**.
3. **Incoming Webhooks** › turn it on › **Add New Webhook to Workspace** › choose **#sales-cycle** › **Allow**.
4. Copy the webhook URL (starts with `https://hooks.slack.com/services/`).
5. Supabase › project **skl-os** › **Edge Functions** › **Secrets** › add `SLACK_SALES_CYCLE_WEBHOOK_URL` = that URL.
6. Check: within 5 minutes of the next miss, a message arrives in #sales-cycle. Until the secret exists, nothing is posted
   (sla-tick answers 409) and nothing is lost: misses of the last 6 hours are posted once it is set.

## Step 8 — Check and hand over

1. Supabase › `skl-os` › **Table Editor** › `crm_webhook_log`: one row per test, `auth_ok = true`.
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
| Q5 | Automations in Sendblue: trigger, message, recipient | |
| Q9 | Region of `skl-os`: ap-southeast-2 (Sydney). Origin of the leads (US / EU) to confirm later | |
| Q10 | Done? Supabase `skl-os` › Authentication › URL Configuration: Site URL = `https://skl-os.vercel.app`, Redirect URLs include `https://skl-os.vercel.app/**` | |
| Q10 | Done? Supabase `skl-os` › Authentication › Sign In / Providers › Email: Email OTP Expiration = `86400` | |
| — | iClosed webhook events offered (step 4.5) | |
| — | Whop plan id of each product (step 7.5) | |
