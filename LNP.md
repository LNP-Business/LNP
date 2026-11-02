# LNP · Sales System

LNP is an exact copy of the **Sales System of SKL OS** (Sales Cockpit, Sales Day, CRM with Sales cycle, call analysis,
cash, SLAs), taken from `RomainSKL/skl-os` at commit `bed45f0` (2026-11-02). Same code, same screens, same rules.
Only `edition.json` differs: the sidebar shows the Sales System and Settings (Alerts, Account, Access), the app opens on
the Sales Cockpit, and every other SKL OS screen (still built, never linked) lands on the Sales Cockpit.

```bash
./build.sh            # builds skl-os/skl-os-en.html and web/public/index.html (the LNP page)
./build.sh --verify   # checks the output against skl-os/EXPECTED.sha256 (the LNP reference)
```

Remove `edition.json` to get the full SKL OS back. Everything else in `CLAUDE.md` applies unchanged.

## Its own back end (a new, empty database: no ALKIMIY data)

1. **Supabase**: create a new project (Supabase dashboard › New project). In the SQL editor run, in order, every file of
   `web/supabase/` **except `002_q4_okrs.sql`** (that one loads ALKIMIY's Q4 key results). `019_crm_sales_team.sql` adds
   Valentino as the sales rep: change the insert to LNP's sales reps before running it, or edit the table afterwards.
   `006_crm_cron.sql`: set `functions_url` to `https://<new-ref>.supabase.co/functions/v1` as its header says.
2. **Edge Functions** (`supabase/functions/`): deploy them to the new project (`supabase link --project-ref <new-ref>`,
   `supabase functions deploy`), or let `.github/workflows/crm-functions.yml` do it from `main` once the GitHub secrets
   `SUPABASE_ACCESS_TOKEN` and `SUPABASE_PROJECT_REF` (the new ref) exist.
3. **Function secrets** (Supabase › Edge Functions › Secrets), LNP's own accounts: `ICLOSED_API_KEY`, `ICLOSED_INBOUND_TOKEN`,
   `FATHOM_API_KEY`, `SENDBLUE_API_KEY_ID`, `SENDBLUE_API_SECRET`, `CLOSE_API_KEY` (if used), `ANTHROPIC_API_KEY` (call analysis),
   `SLACK_SALES_CYCLE_WEBHOOK_URL` (SLA alerts). List and steps: `docs/crm/setup.md` (its webhook URLs show the SKL OS
   project ref: use the new one). The Slack link of SLA alerts: `crm_settings.sla_alerts.link` = the LNP site + `/#crm`.
4. **Vercel**: New project › import `RomainSKL/lnp`, root directory `web/`, env vars `SUPABASE_URL`, `SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY` (sensitive), `SITE_URL`, and `ANTHROPIC_API_KEY` if the Claude features are used.
   First admin: set `BOOTSTRAP_TOKEN` once and use `/api/bootstrap` (see `CLAUDE.md`, Web edition), then remove it.
5. **Call analysis worker** (`.github/workflows/call-analysis.yml`): repository variable `SUPABASE_URL`
   (`https://<new-ref>.supabase.co`) and secret `SUPABASE_SERVICE_ROLE_KEY`.

Never put keys in this repository.
