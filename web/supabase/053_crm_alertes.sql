-- 053 · Le centre d'alertes dans le CRM (Romain 2026-11-09 : « je ne veux pas que ce soit Slack qui soit la base des
-- notifications, je veux que ce soit l'application CRM » ; « les alertes sont reçues par les commerciaux selon les alertes qui
-- concernent uniquement leurs leads à eux, et les admins peuvent suivre toutes les alertes de tous les commerciaux »).
-- Toutes les 5 minutes, sla-tick évalue les SLA de chaque cycle actif (supabase/functions/_shared/sla_rules.js, réglages de
-- Paramètres › Alertes) et appelle crm_sync_sla_alerts : une alerte s'ouvre au premier seuil franchi (Bientôt dû, En retard,
-- Critique), change de niveau, et se ferme seule quand le SLA s'arrête (l'action est faite) ou que le cycle se termine.
-- Une seule alerte ouverte par cycle, SLA et départ d'horloge. Un commercial voit les alertes des cycles qu'il possède ; un
-- administrateur voit tout (crm_sees_all, 048). Les alertes techniques (intégrations, données) ne vont qu'aux administrateurs.
-- Slack devient une option par SLA, éteinte par défaut (sla_rules.js). Sans danger si rejoué.

create table if not exists crm_sla_alerts (
  id          uuid primary key default gen_random_uuid(),
  key         text not null,                    -- cycle:SLA:minute du départ de l'horloge
  cycle_id    uuid not null references crm_cycles(id) on delete cascade,
  person_id   uuid references crm_people(id) on delete set null,
  owner_id    uuid references crm_members(id) on delete set null,   -- le commercial du cycle
  sla         text not null,                    -- SH-2, DE-1, CO-1…
  kind        text not null default 'sales',    -- sales (le commercial agit) | tech (intégration, données : administrateurs)
  level       text not null check (level in ('warn', 'late', 'crit')),
  name        text not null,                    -- nom du SLA, en français
  detail      text,                             -- « depuis la prise de RDV »…
  target      text,                             -- objectif du SLA (« 5 min »)
  started_at  timestamptz not null,             -- départ de l'horloge
  crossed_at  timestamptz not null,             -- passage du niveau actuel
  opened_at   timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  resolved_at timestamptz,                      -- l'action est faite ou le cycle est terminé : l'alerte se ferme
  resolution  text                              -- done | closed
);
create unique index if not exists crm_sla_alerts_open on crm_sla_alerts(key) where resolved_at is null;
create index if not exists crm_sla_alerts_owner on crm_sla_alerts(owner_id) where resolved_at is null;
create index if not exists crm_sla_alerts_cycle on crm_sla_alerts(cycle_id);
alter table crm_sla_alerts enable row level security;
drop policy if exists read_sla_alerts on crm_sla_alerts;
create policy read_sla_alerts on crm_sla_alerts for select
  using (crm_sees_all() or (owner_id = auth.uid() and kind <> 'tech'));
grant select on crm_sla_alerts to authenticated;

-- en direct dans la page (Supabase Realtime, filtré par la même règle de lecture)
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'crm_sla_alerts') then
    alter publication supabase_realtime add table public.crm_sla_alerts;
  end if;
end $$;

-- sla-tick : p_items = tous les dépassements ouverts des cycles actifs, à cet instant ; ouvre, met à jour, ferme les autres
create or replace function crm_sync_sla_alerts(p_items jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare it jsonb; k text; n_open int := 0; n_upd int := 0; n_done int := 0; n_closed int := 0; keys text[] := '{}';
begin
  for it in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    k := it->>'key';
    keys := keys || k;
    update crm_sla_alerts a set level = it->>'level', crossed_at = (it->>'crossed_at')::timestamptz, detail = it->>'detail',
           owner_id = c.owner_id, person_id = c.person_id, updated_at = now()
      from crm_cycles c
     where a.key = k and a.resolved_at is null and c.id = a.cycle_id
       and (a.level is distinct from it->>'level' or a.owner_id is distinct from c.owner_id);
    if found then n_upd := n_upd + 1; continue; end if;
    if exists (select 1 from crm_sla_alerts where key = k and resolved_at is null) then continue; end if;
    insert into crm_sla_alerts (key, cycle_id, person_id, owner_id, sla, kind, level, name, detail, target, started_at, crossed_at)
    select k, c.id, c.person_id, c.owner_id, it->>'sla', coalesce(nullif(it->>'kind', ''), 'sales'), it->>'level', it->>'name',
           it->>'detail', it->>'target', (it->>'started_at')::timestamptz, (it->>'crossed_at')::timestamptz
      from crm_cycles c where c.id = (it->>'cycle_id')::uuid;
    if found then n_open := n_open + 1; end if;
  end loop;
  -- une alerte ouverte qui n'est plus dans la liste : son SLA s'est arrêté, l'action est faite
  update crm_sla_alerts set resolved_at = now(), resolution = 'done', updated_at = now()
   where resolved_at is null and not (key = any(keys));
  get diagnostics n_done = row_count;
  -- un cycle terminé (gagné, perdu, disqualifié) ferme ses alertes
  update crm_sla_alerts a set resolved_at = now(), resolution = 'closed', updated_at = now()
    from crm_cycles c where a.resolved_at is null and c.id = a.cycle_id and c.status::text <> 'active';
  get diagnostics n_closed = row_count;
  return jsonb_build_object('opened', n_open, 'updated', n_upd, 'done', n_done, 'closed', n_closed);
end $$;
revoke execute on function crm_sync_sla_alerts(jsonb) from public, anon, authenticated;
grant execute on function crm_sync_sla_alerts(jsonb) to service_role;

-- l'écran Alertes : les alertes ouvertes que la personne peut voir (un commercial : les siennes ; un administrateur : toutes,
-- ou celles d'un commercial), plus les comptes du jour
create or replace function crm_sla_alerts_open(p_owner uuid default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_all boolean := crm_sees_all(); me uuid := auth.uid();
begin
  if crm_role() is null then raise exception 'Aucun rôle dans le CRM' using errcode = '42501'; end if;
  return jsonb_build_object(
    'sees_all', v_all,
    'alerts', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', a.id, 'cycle_id', a.cycle_id, 'person_id', a.person_id, 'person', p.full_name, 'owner_id', a.owner_id, 'owner', m.full_name,
        'sla', a.sla, 'kind', a.kind, 'level', a.level, 'name', a.name, 'detail', a.detail, 'target', a.target,
        'started_at', a.started_at, 'crossed_at', a.crossed_at, 'opened_at', a.opened_at)
        order by case a.level when 'crit' then 0 when 'late' then 1 else 2 end, a.crossed_at), '[]'::jsonb)
      from crm_sla_alerts a left join crm_people p on p.id = a.person_id left join crm_members m on m.id = a.owner_id
      where a.resolved_at is null
        and (v_all or (a.owner_id = me and a.kind <> 'tech'))
        and (p_owner is null or a.owner_id = p_owner)),
    'closed_today', (select count(*) from crm_sla_alerts a
      where a.resolved_at >= date_trunc('day', now() at time zone 'Europe/Paris') at time zone 'Europe/Paris'
        and (v_all or (a.owner_id = me and a.kind <> 'tech')) and (p_owner is null or a.owner_id = p_owner)));
end $$;
revoke execute on function crm_sla_alerts_open(uuid) from public, anon;
grant execute on function crm_sla_alerts_open(uuid) to authenticated;
