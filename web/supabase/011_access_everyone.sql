-- LNP — everyone sees everything (web/supabase/011_access_everyone.sql), after 010. Romain, 2026-10-25: the CRM and every
-- LNP screen are open to every person of the team, and to every person added later.
-- 1. Screens: the default access (web/api/_screens.js) is now every screen; the narrower lists saved so far are cleared.
-- 2. CRM data: row-level security shows the CRM to its members (crm_members); every LNP member now gets a CRM member
--    row, at once and when invited later (trigger on members): LNP admin = CRM admin, member = sales lead (sees and acts
--    on every cycle), viewer = viewer (reads only). Rows already set by hand (Romain) are kept. Safe to run again.

update auth.users set raw_app_meta_data = raw_app_meta_data - 'screens' where raw_app_meta_data ? 'screens';

create or replace function crm_member_from_team(p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
declare m record; k text; n int := 1;
begin
  select user_id, lower(email) as email, role into m from members where user_id = p_user;
  if m.user_id is null or exists (select 1 from crm_members where id = p_user) then return; end if;
  k := regexp_replace(split_part(m.email, '@', 1), '[^a-z0-9]+', '', 'g');
  if k = '' then k := 'member'; end if;
  while exists (select 1 from crm_members where member_key = case when n = 1 then k else k || n end) loop n := n + 1; end loop;
  insert into crm_members (id, member_key, full_name, email, role)
  values (p_user, case when n = 1 then k else k || n end, initcap(split_part(m.email, '@', 1)), m.email,
          case m.role when 'admin' then 'admin' when 'viewer' then 'viewer' else 'sales_lead' end::member_role)
  on conflict do nothing;
end $$;
revoke execute on function crm_member_from_team(uuid) from public, anon, authenticated;

create or replace function crm_members_follow_team() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform crm_member_from_team(new.user_id);
  return new;
end $$;
revoke execute on function crm_members_follow_team() from public, anon, authenticated;
drop trigger if exists members_to_crm on members;
create trigger members_to_crm after insert on members for each row execute function crm_members_follow_team();

select crm_member_from_team(user_id) from members;
