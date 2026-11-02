-- SKL OS CRM — schedule of process-inbox (web/supabase/006_crm_cron.sql), after 005. Phase 2.
-- pg_cron calls the Edge Function every minute through pg_net while raw rows of a mapped source wait (04 §2: within
-- 2 minutes). The base URL of the project's functions is a CRM setting (not a secret), e.g.
--   insert into crm_settings (key, value, is_proposal) values ('functions_url', '"https://<ref>.supabase.co/functions/v1"', false);
-- Safe to run again. Add a source to the list below when its mapper ships (phase 5 whop; sendblue since 012, fathom since 025).
create extension if not exists pg_net;
create extension if not exists pg_cron;

select cron.unschedule(jobid) from cron.job where jobname = 'crm-process-inbox';
select cron.schedule('crm-process-inbox', '* * * * *', $job$
  select net.http_post(
    url := (select value #>> '{}' from public.crm_settings where key = 'functions_url') || '/process-inbox',
    body := '{}'::jsonb,
    headers := '{"content-type": "application/json"}'::jsonb,
    timeout_milliseconds := 30000)
  where exists (select 1 from public.crm_settings where key = 'functions_url')
    and exists (select 1 from public.crm_webhook_log
                 where source::text in ('iclosed', 'sendblue', 'fathom') and status in ('received', 'failed') and attempts < 8)
$job$);

-- Fathom (025, Romain 2026-10-29: no webhook, the API key is read every hour): at minute 23, the recordings of the last two
-- days through crm-import, linked to their lead, R1 / R2 analyses queued (same source_id: nothing is counted twice). An
-- import already running (a history import) makes the hour skip. Needs FATHOM_API_KEY.
select cron.unschedule(jobid) from cron.job where jobname in ('crm-fathom-nightly', 'crm-fathom-hourly');
select cron.schedule('crm-fathom-hourly', '23 * * * *', $job$
  select net.http_post(
    url := (select value #>> '{}' from public.crm_settings where key = 'functions_url') || '/crm-import?source=fathom&queue=1',
    body := '{}'::jsonb,
    headers := '{"content-type": "application/json"}'::jsonb,
    timeout_milliseconds := 120000)
  where exists (select 1 from public.crm_settings where key = 'functions_url')
$job$);

-- Sales cycle SLAs (028, Romain 2026-10-30): every 5 minutes sla-tick posts the new Late and Critical misses to Slack #sales-cycle.
select cron.unschedule(jobid) from cron.job where jobname = 'crm-sla-tick';
select cron.schedule('crm-sla-tick', '*/5 * * * *', $job$
  select net.http_post(
    url := (select value #>> '{}' from public.crm_settings where key = 'functions_url') || '/sla-tick',
    body := '{}'::jsonb,
    headers := '{"content-type": "application/json"}'::jsonb,
    timeout_milliseconds := 60000)
  where exists (select 1 from public.crm_settings where key = 'functions_url')
$job$);

-- No-show rule (030, Romain 2026-10-31): at minute 35, after the Fathom import of minute 23, past calls with no Fathom recording
-- of 7 minutes become no-shows (R1) or missed (R2+). Does nothing until crm_settings.no_show_rule.enabled is true.
select cron.unschedule(jobid) from cron.job where jobname = 'crm-no-show-hourly';
select cron.schedule('crm-no-show-hourly', '35 * * * *', $job$ select public.crm_no_show_tick() $job$);
