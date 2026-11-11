#!/usr/bin/env bash
# Runs the CRM SQL checks on a throwaway local Postgres database (no Supabase project touched).
# Usage: PGHOST=/tmp PGPORT=5432 PGUSER=postgres web/supabase/tests/run.sh
set -euo pipefail
cd "$(dirname "$0")/.."
DB="lnp_crm_test_$$"
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
run 035_crm_ca_engine_choice.sql
run 035_crm_ca_engine_choice.sql
run 036_crm_cockpit_active_team.sql
run 036_crm_cockpit_active_team.sql
run 037_crm_iclosed_deals.sql
run 037_crm_iclosed_deals.sql
run 038_crm_cockpit_held_r1.sql
run 038_crm_cockpit_held_r1.sql
run 039_crm_cockpit_audit.sql
run 039_crm_cockpit_audit.sql
run 040_crm_cockpit_rep_by_fathom.sql
run 040_crm_cockpit_rep_by_fathom.sql
run 041_crm_cockpit_collected.sql
run 041_crm_cockpit_collected.sql
run 042_crm_lead_qualification.sql
run 042_crm_lead_qualification.sql
run 043_crm_owners_hourly.sql
run 043_crm_owners_hourly.sql
run 044_crm_sla_settings.sql
run 044_crm_sla_settings.sql
run 045_crm_pipeline_moves.sql
run 045_crm_pipeline_moves.sql
run 046_crm_qualif_in_analysis.sql
run 046_crm_qualif_in_analysis.sql
run 047_crm_pipeline_stage_moves.sql
run 047_crm_pipeline_stage_moves.sql
run 048_crm_admin_only_sees_all.sql
run 048_crm_admin_only_sees_all.sql
run 049_crm_training.sql
run 049_crm_training.sql
run 050_crm_sales_execution.sql
run 050_crm_sales_execution.sql
run 051_lnp_heure_de_paris.sql
run 051_lnp_heure_de_paris.sql
run 052_crm_whatsapp.sql
run 052_crm_whatsapp.sql
run 053_crm_alertes.sql
run 053_crm_alertes.sql
run 054_crm_setting.sql
run 054_crm_setting.sql
run 055_crm_refus_six_mois.sql
run 055_crm_refus_six_mois.sql
run 056_crm_regle_absence.sql
run 056_crm_regle_absence.sql
run 057_crm_simulateur.sql
run 057_crm_simulateur.sql
run 058_crm_simulateur_offre_lnp.sql
run 058_crm_simulateur_offre_lnp.sql
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
psql -q -v ON_ERROR_STOP=1 -d "$DB" -At -f tests/refus_six_mois_test.sql | tail -1
psql -q -v ON_ERROR_STOP=1 -d "$DB" -At -f tests/call_ranks_test.sql | tail -1
psql -q -v ON_ERROR_STOP=1 -d "$DB" -At -f tests/no_show_rule_test.sql | tail -1
psql -q -v ON_ERROR_STOP=1 -d "$DB" -At -f tests/member_prefs_test.sql | tail -1
psql -q -v ON_ERROR_STOP=1 -d "$DB" -At -f tests/fathom_closest_test.sql | tail -1
psql -q -v ON_ERROR_STOP=1 -d "$DB" -At -f tests/noshow_audit_test.sql | tail -1
psql -q -v ON_ERROR_STOP=1 -d "$DB" -At -f tests/lnp_fr_labels_test.sql | tail -1
# that test runs 034 again, which redefines crm_sales_cockpit(): the later definitions come back for the next tests
run 036_crm_cockpit_active_team.sql
run 039_crm_cockpit_audit.sql
run 040_crm_cockpit_rep_by_fathom.sql
run 041_crm_cockpit_collected.sql
run 045_crm_pipeline_moves.sql   # and crm_recompute_cycle()
psql -q -v ON_ERROR_STOP=1 -d "$DB" -At -f tests/ca_engine_choice_test.sql | tail -1
psql -q -v ON_ERROR_STOP=1 -d "$DB" -At -f tests/iclosed_deals_test.sql | tail -1
psql -q -v ON_ERROR_STOP=1 -d "$DB" -At -f tests/cockpit_held_r1_test.sql | tail -1
psql -q -v ON_ERROR_STOP=1 -d "$DB" -At -f tests/cockpit_audit_test.sql | tail -1
psql -q -v ON_ERROR_STOP=1 -d "$DB" -At -f tests/cockpit_rep_test.sql | tail -1
psql -q -v ON_ERROR_STOP=1 -d "$DB" -At -f tests/cockpit_collected_test.sql | tail -1
psql -q -v ON_ERROR_STOP=1 -d "$DB" -At -f tests/lead_qualification_test.sql | tail -1
psql -q -v ON_ERROR_STOP=1 -d "$DB" -At -f tests/sla_settings_test.sql | tail -1
psql -q -v ON_ERROR_STOP=1 -d "$DB" -At -f tests/pipeline_moves_test.sql | tail -1
psql -q -v ON_ERROR_STOP=1 -d "$DB" -At -f tests/qualif_in_analysis_test.sql | tail -1
psql -q -v ON_ERROR_STOP=1 -d "$DB" -At -f tests/stage_moves_test.sql | tail -1
psql -q -v ON_ERROR_STOP=1 -d "$DB" -At -f tests/access_scope_test.sql | tail -1
psql -q -v ON_ERROR_STOP=1 -d "$DB" -At -f tests/training_test.sql | tail -1
psql -q -v ON_ERROR_STOP=1 -d "$DB" -At -f tests/sales_execution_test.sql | tail -1
psql -q -v ON_ERROR_STOP=1 -d "$DB" -At -f tests/whatsapp_test.sql | tail -1
psql -q -v ON_ERROR_STOP=1 -d "$DB" -At -f tests/alertes_test.sql | tail -1
psql -q -v ON_ERROR_STOP=1 -d "$DB" -At -f tests/setting_test.sql | tail -1
psql -q -v ON_ERROR_STOP=1 -d "$DB" -At -f tests/regle_absence_test.sql | tail -1
psql -q -v ON_ERROR_STOP=1 -d "$DB" -At -f tests/simulateur_test.sql | tail -1
psql -q -v ON_ERROR_STOP=1 -d "$DB" -At -f tests/simulateur_offre_lnp_test.sql | tail -1
