"""Worker of the LNP call analysis: takes queued calls from the CRM, runs the engine, stores the call record.

See call-analysis/PLAN.md §2–4. Stdlib only: the CRM is reached through Supabase's REST API (functions crm_ca_claim,
crm_ca_store, crm_ca_fail of web/supabase/020_crm_call_analysis.sql) and the model through the Edge Function callqa-llm.
Never logs a prompt, a quote or a transcript.
"""
