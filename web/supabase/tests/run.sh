#!/usr/bin/env bash
# Runs the CRM SQL checks on a throwaway local Postgres database (no Supabase project touched).
# Usage: PGHOST=/tmp PGPORT=5432 PGUSER=postgres web/supabase/tests/run.sh
set -euo pipefail
cd "$(dirname "$0")/.."
DB="skl_crm_test_$$"
psql -q -v ON_ERROR_STOP=1 -c "create database $DB" >/dev/null
trap 'psql -q -c "drop database if exists $DB" >/dev/null' EXIT
run() { psql -q -v ON_ERROR_STOP=1 -d "$DB" -f "$1" >/dev/null 2>"$DB.err" || { cat "$DB.err"; rm -f "$DB.err"; exit 1; }; rm -f "$DB.err"; }
run tests/supabase_stub.sql
run 001_init.sql
# phase 0 file first (as in production), then the phase 1 files on top of it
psql -q -v ON_ERROR_STOP=1 -d "$DB" >/dev/null <<'SQL'
do $$ begin create type event_source as enum ('iclosed', 'fathom', 'sendblue', 'whop', 'crm', 'claude', 'rules', 'import'); end $$;
do $$ begin create type inbox_status as enum ('received', 'processed', 'ignored', 'failed', 'unmatched', 'rejected'); end $$;
create table crm_webhook_log (id bigint generated always as identity primary key, source event_source not null, delivery_id text,
  received_at timestamptz not null default now(), headers jsonb not null, body text not null, auth_ok boolean,
  status inbox_status not null default 'received', attempts int not null default 0, error text, processed_at timestamptz);
SQL
run 003_crm_core.sql
run 004_crm_rpc.sql
run 004_crm_rpc.sql   # safe to run again
run 005_crm_pipeline.sql
run 004_crm_rpc.sql
psql -q -v ON_ERROR_STOP=1 -d "$DB" -At -f tests/crm_phase1_test.sql | tail -1
# phase 2 on a fresh database
psql -q -c "drop database $DB" >/dev/null && psql -q -v ON_ERROR_STOP=1 -c "create database $DB" >/dev/null
for f in tests/supabase_stub.sql 001_init.sql 003_crm_core.sql 004_crm_rpc.sql 005_crm_pipeline.sql; do run "$f"; done
psql -q -v ON_ERROR_STOP=1 -d "$DB" -At -f tests/crm_phase2_test.sql | tail -1
# import on a fresh database
psql -q -c "drop database $DB" >/dev/null && psql -q -v ON_ERROR_STOP=1 -c "create database $DB" >/dev/null
for f in tests/supabase_stub.sql 001_init.sql 003_crm_core.sql 004_crm_rpc.sql 005_crm_pipeline.sql; do [ -f "$f" ] && run "$f"; done
run 007_crm_import.sql
run 007_crm_import.sql
run 008_crm_import_cycles.sql
run 008_crm_import_cycles.sql
run 009_crm_import_calls.sql
run 009_crm_import_calls.sql
run 010_crm_first_seen.sql
run 010_crm_first_seen.sql
run 011_access_everyone.sql
run 011_access_everyone.sql
run 012_crm_messages.sql
run 012_crm_messages.sql
run 013_crm_reclassify.sql
run 013_crm_reclassify.sql
run 014_mcp.sql
run 014_mcp.sql
run 015_crm_owners.sql
run 015_crm_owners.sql
run 016_crm_sales_cockpit.sql
run 016_crm_sales_cockpit.sql
run 017_crm_sales_cockpit_fast.sql
run 017_crm_sales_cockpit_fast.sql
run 018_crm_won_calls_held.sql
run 018_crm_won_calls_held.sql
run 019_crm_sales_team.sql
run 019_crm_sales_team.sql
run 020_crm_call_analysis.sql
run 020_crm_call_analysis.sql
run 021_crm_call_analysis_board.sql
run 021_crm_call_analysis_board.sql
run 022_crm_manual_cash.sql
run 022_crm_manual_cash.sql
run 023_crm_contact_update.sql
run 023_crm_contact_update.sql
run 024_crm_payment_plan.sql
run 024_crm_payment_plan.sql
run 025_crm_fathom_calls.sql
run 025_crm_fathom_calls.sql
run 026_crm_refunds.sql
run 026_crm_refunds.sql
run 027_crm_yes_keeps_deal.sql
run 027_crm_yes_keeps_deal.sql
run 028_crm_sla_alerts.sql
run 028_crm_sla_alerts.sql
run 029_crm_call_ranks.sql
run 029_crm_call_ranks.sql
run 030_crm_no_show_rule.sql
run 030_crm_no_show_rule.sql
run 031_crm_member_prefs.sql
run 031_crm_member_prefs.sql
run 032_crm_fathom_closest.sql
run 032_crm_fathom_closest.sql
run 033_crm_noshow_audit.sql
run 033_crm_noshow_audit.sql
run 034_lnp_fr_labels.sql
run 034_lnp_fr_labels.sql
run 036_crm_cockpit_active_team.sql
run 036_crm_cockpit_active_team.sql
psql -q -v ON_ERROR_STOP=1 -d "$DB" -At -f tests/crm_import_test.sql | tail -1
psql -q -v ON_ERROR_STOP=1 -d "$DB" -At -f tests/mcp_test.sql | tail -1
psql -q -v ON_ERROR_STOP=1 -d "$DB" -At -f tests/owners_test.sql | tail -1
psql -q -v ON_ERROR_STOP=1 -d "$DB" -At -f tests/cockpit_test.sql | tail -1
psql -q -v ON_ERROR_STOP=1 -d "$DB" -At -f tests/call_analysis_test.sql | tail -1
psql -q -v ON_ERROR_STOP=1 -d "$DB" -At -f tests/manual_cash_test.sql | tail -1
psql -q -v ON_ERROR_STOP=1 -d "$DB" -At -f tests/contact_update_test.sql | tail -1
psql -q -v ON_ERROR_STOP=1 -d "$DB" -At -f tests/payment_plan_test.sql | tail -1
psql -q -v ON_ERROR_STOP=1 -d "$DB" -At -f tests/fathom_calls_test.sql | tail -1
psql -q -v ON_ERROR_STOP=1 -d "$DB" -At -f tests/refunds_test.sql | tail -1
psql -q -v ON_ERROR_STOP=1 -d "$DB" -At -f tests/yes_keeps_deal_test.sql | tail -1
psql -q -v ON_ERROR_STOP=1 -d "$DB" -At -f tests/sla_alerts_test.sql | tail -1
psql -q -v ON_ERROR_STOP=1 -d "$DB" -At -f tests/call_ranks_test.sql | tail -1
psql -q -v ON_ERROR_STOP=1 -d "$DB" -At -f tests/no_show_rule_test.sql | tail -1
psql -q -v ON_ERROR_STOP=1 -d "$DB" -At -f tests/member_prefs_test.sql | tail -1
psql -q -v ON_ERROR_STOP=1 -d "$DB" -At -f tests/fathom_closest_test.sql | tail -1
psql -q -v ON_ERROR_STOP=1 -d "$DB" -At -f tests/noshow_audit_test.sql | tail -1
psql -q -v ON_ERROR_STOP=1 -d "$DB" -At -f tests/lnp_fr_labels_test.sql | tail -1
