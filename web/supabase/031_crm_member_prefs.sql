-- 031: each person's own CRM screen settings (Romain 2026-10-31: "la configuration doit être enregistrée selon l'utilisateur qui
-- le fait; les autres utilisateurs conservent leur propre configuration"). One row per signed-in user and key:
--   crm.pipeline.cols   the order of the Pipeline columns (dragged by their header)
--   salesday.<date>     the leads done, skipped or snoozed that day in Sales System › Sales Day
-- Only the user reads and writes their rows (RLS + the two functions below); nothing else of the CRM depends on them.
create table if not exists crm_member_prefs (
  user_id    uuid not null default auth.uid(),
  key        text not null check (length(key) between 1 and 80),
  value      jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);
alter table crm_member_prefs enable row level security;
drop policy if exists crm_member_prefs_own on crm_member_prefs;
create policy crm_member_prefs_own on crm_member_prefs for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function crm_get_pref(p_key text) returns jsonb
language sql stable security definer set search_path = public as $$
  select value from crm_member_prefs where user_id = auth.uid() and key = p_key
$$;
create or replace function crm_set_pref(p_key text, p_value jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Connectez-vous d''abord' using errcode = '42501'; end if;
  if octet_length(p_value::text) > 20000 then raise exception 'Réglage trop volumineux' using errcode = '22023'; end if;
  if p_value is null or p_value = 'null'::jsonb then
    delete from crm_member_prefs where user_id = auth.uid() and key = p_key;
  else
    insert into crm_member_prefs (user_id, key, value) values (auth.uid(), p_key, p_value)
    on conflict (user_id, key) do update set value = excluded.value, updated_at = now();
  end if;
  -- the day lists of Sales Day older than 30 days go
  delete from crm_member_prefs where user_id = auth.uid() and key like 'salesday.%' and updated_at < now() - interval '30 days';
  return p_value;
end $$;
revoke execute on function crm_get_pref(text) from public, anon;
revoke execute on function crm_set_pref(text, jsonb) from public, anon;
grant execute on function crm_get_pref(text) to authenticated;
grant execute on function crm_set_pref(text, jsonb) to authenticated;
