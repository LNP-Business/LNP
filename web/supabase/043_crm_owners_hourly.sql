-- LNP CRM — leads linked to their sales rep every hour (web/supabase/043_crm_owners_hourly.sql), after 042.
-- Romain, 2026-11-05: « lier les leads avec les commerciaux sans avoir besoin qu'ils aient validé leur invitation ». A sales
-- rep's account exists as soon as they are invited (auth user + members + crm_members, role sales), confirmed or not, so
-- their leads are theirs at once (015: the trigger on crm_members; 005/009/025: a new cycle takes the owner of its booking
-- or recording). This job also gives an owner, every hour, to a cycle opened with none (a booking on the calendar of a
-- former rep or of no one) whose latest booking is now on a sales rep's iClosed calendar. An owner already set is never
-- changed (crm_assign_owners_from_hosts). Safe to run again.
do $$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'crm-assign-owners-hourly';
    perform cron.schedule('crm-assign-owners-hourly', '20 * * * *', $job$ select public.crm_assign_owners_from_hosts(false) $job$);
  end if;
end $$;
