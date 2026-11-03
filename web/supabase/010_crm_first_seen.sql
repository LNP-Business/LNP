-- LNP CRM — when a lead came in (web/supabase/010_crm_first_seen.sql), after 009.
-- crm_people.created_at is the day a row was written (the imports wrote 1 501 rows on 2026-10-24), not the day the lead
-- arrived. first_seen_at is the earliest moment the CRM knows of the person: the earliest of its events (iClosed contact
-- creation, Close lead creation, first booking…), kept up to date by a trigger on every new event. The CRM's
-- "Created" filter (last 7 days, last 30 days, all) reads it. Safe to run again.

alter table crm_people add column if not exists first_seen_at timestamptz;
update crm_people p set first_seen_at = least(coalesce(p.first_seen_at, p.created_at),
  (select min(e.occurred_at) from crm_events e where e.person_id = p.id));
alter table crm_people alter column first_seen_at set default now();
alter table crm_people alter column first_seen_at set not null;

create or replace function crm_people_first_seen() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.person_id is not null then
    update crm_people set first_seen_at = new.occurred_at where id = new.person_id and first_seen_at > new.occurred_at;
  end if;
  return new;
end $$;
revoke execute on function crm_people_first_seen() from public, anon, authenticated;
drop trigger if exists crm_events_first_seen on crm_events;
create trigger crm_events_first_seen after insert on crm_events for each row execute function crm_people_first_seen();

-- 009's view, with first_seen_at (new columns go last)
create or replace view crm_people_without_cycle with (security_invoker = true) as
  select p.id, p.full_name, p.primary_email, p.primary_phone, p.created_at,
         (select e.data->>'status_label' from crm_events e
           where e.person_id = p.id and e.type = 'imported' and e.source_id like 'import:import:iclosed:%'
           order by e.occurred_at desc limit 1) as iclosed_status,
         (select max(e.occurred_at) from crm_events e where e.person_id = p.id) as last_event_at,
         p.first_seen_at
    from crm_people p
   where p.merged_into is null and not exists (select 1 from crm_cycles c where c.person_id = p.id);
revoke all on crm_people_without_cycle from anon;
grant select on crm_people_without_cycle to authenticated;
