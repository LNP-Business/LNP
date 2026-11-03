-- LNP on Supabase: the team, and one shared document store that mirrors the Artifact database.
-- Run once on a fresh project (SQL editor, or the Management API).

-- Who may use the app. Rows are written only by the server (service role), through /api/team.
create table if not exists public.members (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  email      text not null,
  role       text not null default 'member' check (role in ('admin', 'member', 'viewer')),
  created_at timestamptz not null default now()
);

-- Every collection of the app (krs, tasks, decisions, config, carto…) as documents: (col, id) -> body.
create table if not exists public.docs (
  col        text not null,
  id         text not null,
  body       jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid(),
  primary key (col, id)
);

create or replace function public.my_role() returns text
  language sql stable security definer set search_path = public
  as $$ select role from public.members where user_id = auth.uid() $$;

create or replace function public.touch_doc() returns trigger
  language plpgsql as $$ begin new.updated_at := now(); new.updated_by := auth.uid(); return new; end $$;
drop trigger if exists docs_touch on public.docs;
create trigger docs_touch before insert or update on public.docs for each row execute function public.touch_doc();

alter table public.members enable row level security;
alter table public.docs enable row level security;

-- members: the team can see the team; nobody writes from the browser.
drop policy if exists members_read on public.members;
create policy members_read on public.members for select to authenticated using (public.my_role() is not null);

-- docs: every member reads; admins and members write; viewers only read.
drop policy if exists docs_read on public.docs;
create policy docs_read on public.docs for select to authenticated using (public.my_role() is not null);
drop policy if exists docs_insert on public.docs;
create policy docs_insert on public.docs for insert to authenticated with check (public.my_role() in ('admin', 'member'));
drop policy if exists docs_update on public.docs;
create policy docs_update on public.docs for update to authenticated using (public.my_role() in ('admin', 'member')) with check (public.my_role() in ('admin', 'member'));
drop policy if exists docs_delete on public.docs;
create policy docs_delete on public.docs for delete to authenticated using (public.my_role() in ('admin', 'member'));

revoke all on public.docs, public.members from anon;
grant select, insert, update, delete on public.docs to authenticated;
grant select on public.members to authenticated;

-- live updates for every open screen
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'docs') then
    alter publication supabase_realtime add table public.docs;
  end if;
end $$;
