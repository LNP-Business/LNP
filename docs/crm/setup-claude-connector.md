# Setting up the LNP connector in Claude

What it gives you: in any Claude conversation, ask about LNP ("Which clocks are critical this morning?",
"Prepare my next call with Yassine Diallo", "How many no-shows this month?") and Claude answers from the live
CRM, with **your** rights: what you can see in the app, nothing more. Admins can also add a note to a lead or declare a call's outcome. It covers LNP: the Sales cockpit, Sales Day, the CRM and Settings › Alerts.
Specification: `17-claude-connector.md`.

## 1. Once, by Romain (after the PR is approved)

1. **Apply the migration.** Open the Supabase SQL editor (project `LNP` › SQL Editor › New query), paste the whole
   file `web/supabase/014_mcp.sql` (raw file on GitHub, branch `main`) and click **Run**. It adds two small tables
   for the sign-in codes and the audit functions; it is safe to run again.
2. **Deploy.** Nothing to do: Vercel deploys `main`. No new secret or environment variable.
3. **Check.** Open `https://<your LNP domain>/.well-known/oauth-authorization-server` in a browser: you see a short
   JSON text with `"issuer"`. Open `https://lnp-sales.vercel.app/api/mcp`: you see "Method not allowed" (normal: only
   Claude talks to it).

## 2. Who may use it

Settings › Access (web edition, admins): each card now has a **Claude** column with one box, "Claude connector".
Admins have it by default; tick it for anyone else who should use the connector. Untick it to take it away: the
connector stops working for that person within the hour (at the next token refresh). Removing someone in Team access
does the same.

## 3. Add the connector in Claude (each person)

On a personal plan (Pro, Max):

1. In claude.ai, open **Settings › Connectors** (in some versions: **Customize › Connectors**).
2. Click **Add custom connector**.
3. Name: `LNP`. URL: `https://lnp-sales.vercel.app/api/mcp` (the LNP domain; `https://lnp-sales.vercel.app/api/mcp` works
   too, but never an address that redirects: Claude refuses a connector whose address changes on the way). Leave the advanced OAuth fields (client ID, secret)
   empty: Claude registers itself.
4. Click **Add**, then **Connect**. A new tab opens on the LNP sign-in page ("Connecter Claude": it says Claude asks
   to read LNP with your rights, and that only admins can also have it add a note or declare a call's outcome).
5. Type your LNP email and password, click **Se connecter et autoriser**. The tab closes and Claude shows LNP as connected.

On a Team or Enterprise plan: an owner adds it once in **Organization settings › Connectors** (same name and URL),
then each person opens Settings › Connectors, finds LNP and clicks **Connect** (steps 4–5).

## 4. Use it

In a conversation, open the tools menu (the sliders icon under the message box) and make sure **LNP** is on.
Then ask in plain words, about any part of LNP. Claude picks among 10 tools:

| Ask for | Tool |
|---|---|
| Who you are, which leads you see | `whoami` |
| A lead, its story, a call to prepare | `find_lead`, `lead_record`, `call_prep` |
| What is late or critical, the pipeline by stage | `clocks_running`, `pipeline_summary` |
| The analysis of an R1 or R2 call | `call_analysis` |
| Sales figures for a week, 4 weeks or the quarter (Cockpit commercial) | `performance` |
| The alert rules (Paramètres › Alertes) | `alert_rules` |
| What a screen is for, how to use it | `page_method` |

A screen closed for someone in Settings › Access is closed in Claude too.

**Admins can also change things** (2 write tools): add a note to a lead, declare a call's outcome. Claude asks before
each change, and the CRM's own rules apply (a reason is required for "no", the cycle is recomputed).

Claude asks your permission the first time it uses each tool; you can allow it for the conversation or always.

## 5. If something goes wrong

- "Le connecteur Claude n’est pas ouvert pour ce compte": an admin must tick Claude for you in Settings › Access.
- "E-mail ou mot de passe incorrect": the same password as the LNP web edition; an admin can send a reset link (Team access).
- Claude says the sign-in has expired, or tools stop answering: Settings › Connectors › LNP › **Disconnect**, then
  **Connect** again.
- "Too many requests": more than 60 tool calls in a minute; wait a minute.
- To stop: Settings › Connectors › LNP › Disconnect (or remove).

## 6. For a developer: test without Claude

`cd web && npm test` runs the whole flow on an in-memory database. Against a deployment:
`npx @modelcontextprotocol/inspector`, transport "Streamable HTTP", URL `https://<domain>/api/mcp`, then "Open Auth
Settings" › "Quick OAuth Flow" (its local callback is allowed), sign in, then List Tools and run each one. Every call
leaves a row in `crm_audit_log` (action `mcp:<tool>`), readable by CRM admins.
