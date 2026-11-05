-- 048 · Who sees which leads (Romain, 2026-11-05: « l'accès des leads dans le CRM est restrictif en fonction de l'utilisateur :
-- le commercial ne voit que ses leads, seuls les admins peuvent tout voir »).
-- Every read of the CRM goes through crm_sees_all() (003: the RLS policies of crm_cycles, crm_calls, crm_events, crm_people,
-- crm_payments… and the Sales cockpit, 040): until now admin, sales lead and viewer saw every lead. From now on only an admin
-- does; anyone else (sales, sales lead, viewer) sees the leads whose cycle they own, and only those (a viewer owns none).
-- On 2026-11-05 nobody has the sales lead or viewer role (4 admins, 5 sales): nothing changes for the team today. Idempotent.

create or replace function crm_sees_all() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(crm_role() = 'admin', false)
$$;
