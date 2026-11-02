# Setting up the SKL OS connector in Claude

What it gives you: in any Claude conversation, ask about SKL OS ("Which clocks are critical this morning?",
"Prepare my next call with Yassine Diallo", "How many no-shows this month?") and Claude answers from the live
CRM, with **your** rights: what you can see in the app, nothing more. Admins can also make changes (phase B). It covers the whole app: Operating System, Sales System, Knowledge System, Agent System and Settings.
Specification: `17-claude-connector.md`.

## 1. Once, by Romain (after the PR is approved)

1. **Apply the migration.** Open the Supabase SQL editor (project `skl-os` › SQL Editor › New query), paste the whole
   file `web/supabase/014_mcp.sql` (raw file on GitHub, branch `main`) and click **Run**. It adds two small tables
   for the sign-in codes and the audit functions; it is safe to run again.
2. **Deploy.** Nothing to do: Vercel deploys `main`. No new secret or environment variable.
3. **Check.** Open `https://<your SKL OS domain>/.well-known/oauth-authorization-server` in a browser: you see a short
   JSON text with `"issuer"`. Open `https://os.stealthkairoslabs.com/api/mcp`: you see "Method not allowed" (normal: only
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
3. Name: `SKL OS`. URL: `https://os.stealthkairoslabs.com/api/mcp` (the SKL OS domain; `https://skl-os.vercel.app/api/mcp` works
   too, but never an address that redirects: Claude refuses a connector whose address changes on the way). Leave the advanced OAuth fields (client ID, secret)
   empty: Claude registers itself.
4. Click **Add**, then **Connect**. A new tab opens on the SKL OS sign-in page ("Connect Claude": it says Claude asks
   to read SKL OS with your rights and cannot change anything).
5. Type your SKL OS email and password, click **Sign in and allow**. The tab closes and Claude shows SKL OS as connected.

On a Team or Enterprise plan: an owner adds it once in **Organization settings › Connectors** (same name and URL),
then each person opens Settings › Connectors, finds SKL OS and clicks **Connect** (steps 4–5).

## 4. Use it

In a conversation, open the tools menu (the sliders icon under the message box) and make sure **SKL OS** is on.
Then ask in plain words, about any part of SKL OS. Claude picks among 23 tools:

| Ask for | Tool |
|---|---|
| What is waiting, which screen shows what, the team | `os_overview` |
| Objectives and key results, their status | `okrs`, `key_result` |
| The plan: gaps, milestones by week | `roadmap` |
| Someone's day, tasks | `my_day`, `tasks` |
| Decisions | `decisions` |
| The weekly review | `weekly_review` |
| Alerts and alert rules | `alerts` |
| A lead, the pipeline, what is late, a call to prepare, sales KPIs | `find_lead`, `lead_record`, `clocks_running`, `pipeline_summary`, `call_prep`, `call_analysis`, `performance` |
| The library, memos | `library` |
| Mechanisms and registers | `mechanism` |
| The SKL Map | `skl_map` |
| The Agent System | `agent_system` |
| How a screen works | `page_method` |
| Any record, raw | `os_data` |

A screen closed for someone in Settings › Access is closed in Claude too.

**Admins can also change things** (10 write tools): create, update or delete a task, check in a key result, mark a
milestone reached, open or decide a decision, act on an alert, add a note to a lead, declare a call's outcome. Claude asks
before each change. The app's rules apply: only a task's owner changes it, only a key result's owner checks it in.
If Claude says SKL OS does not know who you are, open SKL OS once and pick your name in "You are".

Claude asks your permission the first time it uses each tool; you can allow it for the conversation or always.

## 5. If something goes wrong

- "The Claude connector is not open for this account": an admin must tick Claude for you in Settings › Access.
- "Wrong email or password": the same password as the SKL OS web edition; an admin can send a reset link (Team access).
- Claude says the sign-in has expired, or tools stop answering: Settings › Connectors › SKL OS › **Disconnect**, then
  **Connect** again.
- "Too many requests": more than 60 tool calls in a minute; wait a minute.
- To stop: Settings › Connectors › SKL OS › Disconnect (or remove).

## 6. For a developer: test without Claude

`cd web && npm test` runs the whole flow on an in-memory database. Against a deployment:
`npx @modelcontextprotocol/inspector`, transport "Streamable HTTP", URL `https://<domain>/api/mcp`, then "Open Auth
Settings" › "Quick OAuth Flow" (its local callback is allowed), sign in, then List Tools and run each one. Every call
leaves a row in `crm_audit_log` (action `mcp:<tool>`), readable by CRM admins.
