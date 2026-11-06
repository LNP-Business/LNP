-- 049 · Entraînement (Romain 2026-11-06): « Maîtrise de l'offre » (the « Académie sales LNP », 100 cases), and the results of
-- every training kept on each person's account, never deleted, so the trainer knows who did what.
--   crm_academy_progress    one row per person: exos = {"A12": {best, last, tries, mode, answer, answer2, feedback, at}},
--                           the working state of Maîtrise de l'offre, so it follows them from one device to another (cahier §6)
--   crm_academy_corrections one row per correction by Claude (web/api/academie.js): who, which case, when, the tokens; used to
--                           limit the corrections in a row (never the answer)
--   crm_training_results    one row per exercise done, in Découverte (« Le coup suivant »: one coup, 0 or 1; « La lettre
--                           imposée »: one case, 0 to 3 valid questions) and in Maîtrise de l'offre (one attempt, 0 to 10):
--                           score, active time spent, how it was marked (the app's rules, a self-evaluation, Claude), the
--                           answers. Append only: no one updates or deletes a row, not even the service (trigger). A result
--                           marked by Claude is written by web/api/academie.js only, so a page cannot claim one.
--   crm_training_dashboard(p_days)  per person: the training score (below), the exercises and the time of the period, and the
--                           sales of the period (calls held, sales, signed, collected), for « Mes résultats » (one's own row)
--                           and « Suivi des commerciaux » (admins: everyone).
-- The training score, out of 100, is the mean of three parts, each out of 100 (a training never done counts 0):
--   Le coup suivant     coups justes among the latest 50 coups, out of 50
--   La lettre imposée   valid questions among the latest 20 cases, out of 60
--   Maîtrise de l'offre the best mark of each of the 100 cases, summed, out of 1 000
-- A sales rep reads only their own rows; an admin (the trainer) reads every row. Safe to run again.

create table if not exists crm_academy_progress (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  exos jsonb not null default '{}',
  updated_at timestamptz not null default now());
alter table crm_academy_progress enable row level security;
drop policy if exists academy_read on crm_academy_progress;
create policy academy_read on crm_academy_progress for select using (user_id = auth.uid() or crm_role() = 'admin');
drop policy if exists academy_insert on crm_academy_progress;
create policy academy_insert on crm_academy_progress for insert with check (user_id = auth.uid());
drop policy if exists academy_update on crm_academy_progress;
create policy academy_update on crm_academy_progress for update using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update on crm_academy_progress to authenticated;

create table if not exists crm_academy_corrections (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  case_id text not null,
  usage jsonb,
  created_at timestamptz not null default now());
create index if not exists academy_corrections_user on crm_academy_corrections (user_id, created_at desc);
alter table crm_academy_corrections enable row level security;

-- no foreign key to auth.users: removing someone from the team never removes what they did
create table if not exists crm_training_results (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid(),
  cid text not null check (length(cid) between 8 and 64),   -- written by the page: a result sent twice is kept once
  module text not null check (module in ('coup', 'lettre', 'academie')),
  case_id text not null check (length(case_id) between 1 and 12),
  score numeric(4, 1) not null,
  max numeric(4, 1) not null,
  mode text not null check (mode in ('regles', 'auto', 'claude')),
  duration_s int not null default 0 check (duration_s between 0 and 3600),
  details jsonb not null default '{}' check (jsonb_typeof(details) = 'object' and pg_column_size(details) < 32000),
  created_at timestamptz not null default now(),
  unique (user_id, cid),
  check (max = case module when 'coup' then 1 when 'lettre' then 3 else 10 end),
  check (score >= 0 and score <= max and score * 2 = round(score * 2)),
  check ((module = 'academie') = (mode in ('auto', 'claude'))));
create index if not exists training_results_user on crm_training_results (user_id, module, created_at desc);
alter table crm_training_results enable row level security;
drop policy if exists training_read on crm_training_results;
create policy training_read on crm_training_results for select using (user_id = auth.uid() or crm_role() = 'admin');
drop policy if exists training_insert on crm_training_results;
create policy training_insert on crm_training_results for insert
  with check (user_id = auth.uid() and crm_role() is not null and mode <> 'claude');
revoke all on crm_training_results from public, anon, authenticated;
grant select, insert on crm_training_results to authenticated;

create or replace function crm_training_results_stamp() returns trigger language plpgsql as $$
begin
  new.created_at := now();   -- the time of the server, never the page's
  return new;
end $$;
drop trigger if exists crm_training_results_stamp on crm_training_results;
create trigger crm_training_results_stamp before insert on crm_training_results for each row execute function crm_training_results_stamp();
create or replace function crm_training_results_keep() returns trigger language plpgsql as $$
begin
  raise exception 'Les résultats d''entraînement ne peuvent être ni modifiés ni effacés.' using errcode = '42501';
end $$;
drop trigger if exists crm_training_results_keep on crm_training_results;
create trigger crm_training_results_keep before update or delete on crm_training_results for each row execute function crm_training_results_keep();
drop trigger if exists crm_training_results_keep_all on crm_training_results;
create trigger crm_training_results_keep_all before truncate on crm_training_results for each statement execute function crm_training_results_keep();

-- one person's figures; p_from = the start of the period ('-infinity': since the beginning)
create or replace function crm_training_person(p_user uuid, p_from timestamptz) returns jsonb
language sql stable security definer set search_path = public as $$
  with r as (select * from crm_training_results where user_id = p_user),
  coup as (select coalesce(sum(score), 0) s, count(*) n from (select score from r where module = 'coup' order by created_at desc, id desc limit 50) x),
  lettre as (select coalesce(sum(score), 0) s, count(*) n from (select score from r where module = 'lettre' order by created_at desc, id desc limit 20) x),
  acad as (select coalesce(sum(b), 0) s, count(*) filter (where b >= 8) v, count(*) n from (select max(score) b from r where module = 'academie' group by case_id) x),
  per as (select module, count(*) n, coalesce(sum(duration_s), 0) t, round(100 * avg(score / max)) ok from r where created_at >= p_from group by module),
  cy as (select c.id from crm_cycles c where c.owner_id = p_user and not crm_person_internal(c.person_id)),
  calls as (select count(*) n from crm_calls k join cy on cy.id = k.cycle_id
             where (k.status = 'held' or crm_call_complete(k)) and k.scheduled_start >= p_from and k.scheduled_start < now()),
  sales as (select crm_sales_cockpit_window(p_from, now(), coalesce((select array_agg(id) from cy), '{}'), false) f)
  select jsonb_build_object(
    'score', round(100 * ((select s from coup) / 50 + (select s from lettre) / 60 + (select s from acad) / 1000) / 3),
    'parts', jsonb_build_object('coup', round(100 * (select s from coup) / 50), 'lettre', round(100 * (select s from lettre) / 60),
                                'academie', round((select s from acad) / 10)),
    'academie', jsonb_build_object('validated', (select v from acad), 'tried', (select n from acad)),
    'period', jsonb_build_object(
      'n', coalesce((select sum(n) from per), 0), 'time_s', coalesce((select sum(t) from per), 0),
      'modules', coalesce((select jsonb_object_agg(module, jsonb_build_object('n', n, 'time_s', t, 'ok', ok)) from per), '{}'),
      'last_at', (select max(created_at) from r where created_at >= p_from)),
    'total', jsonb_build_object('n', (select count(*) from r), 'time_s', coalesce((select sum(duration_s) from r), 0),
                                'first_at', (select min(created_at) from r), 'last_at', (select max(created_at) from r)),
    'sales', jsonb_build_object('calls', (select n from calls), 'r1_held', (sales.f->>'held')::int, 'won', (sales.f->>'won')::int,
                                'signed', (sales.f->>'signed')::numeric, 'collected', (sales.f->>'collected')::numeric,
                                'cash', (sales.f->>'cash')::numeric))
  from sales
$$;
revoke execute on function crm_training_person(uuid, timestamptz) from public, anon, authenticated;

-- « Mes résultats »: the caller's row; « Suivi des commerciaux » (admins): every active sales rep and admin, and anyone
-- who has trained. p_days: 7, 30, 90…, 0 or null = since the beginning.
create or replace function crm_training_dashboard(p_days int default 30) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_role member_role := crm_role(); v_admin boolean; v_from timestamptz; v_rows jsonb := '[]'; m record;
begin
  if v_role is null then raise exception 'Aucun rôle dans le CRM' using errcode = '42501'; end if;
  v_admin := v_role = 'admin';
  v_from := case when coalesce(p_days, 0) <= 0 then '-infinity'::timestamptz else now() - make_interval(days => least(p_days, 3650)) end;
  for m in select u.id, cm.full_name, cm.role, coalesce(cm.active, false) active from (
             select id from crm_members where (v_admin and active and role in ('sales', 'sales_lead', 'admin')) or id = auth.uid()
             union select distinct user_id from crm_training_results where v_admin or user_id = auth.uid()) u
           left join crm_members cm on cm.id = u.id
           order by cm.full_name nulls last loop
    v_rows := v_rows || jsonb_build_array(jsonb_build_object('id', m.id, 'name', coalesce(m.full_name, 'Ancien membre'), 'role', m.role,
                                                             'active', m.active, 'me', m.id = auth.uid())
                                          || crm_training_person(m.id, v_from));
  end loop;
  return jsonb_build_object('generated_at', now(), 'days', coalesce(p_days, 0), 'admin', v_admin, 'people', v_rows);
end $$;
revoke execute on function crm_training_dashboard(int) from public, anon;
grant execute on function crm_training_dashboard(int) to authenticated;
