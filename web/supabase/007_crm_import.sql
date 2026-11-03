-- LNP CRM — import of the leads that already exist (web/supabase/007_crm_import.sql), after 006.
-- The Edge Function crm-import reads Close (and later iClosed) page by page and hands each page to crm_import_people.
-- One person per contact; a person is found again by any of its identifiers (email, phone, Close / iClosed ids), so a
-- lead present in both tools, or imported twice, stays one person (03). A dry run goes through exactly the same code and
-- rolls it back, returning only counts (send the whole source in one call for exact duplicate counts). Each lead's status and opportunities are kept as an `imported` event on the
-- person; cycles from that history come once Romain maps the Close statuses (crm_settings.close_status_map).
-- Safe to run again.

alter type identity_kind add value if not exists 'close_contact_id';

create table if not exists crm_import_runs (
  id          uuid primary key default gen_random_uuid(),
  source      event_source not null,
  dry_run     boolean not null,
  status      text not null default 'running' check (status in ('running', 'done', 'failed')),
  cursor      jsonb not null default '{}'::jsonb,          -- where the next page starts (e.g. {"skip": 300})
  stats       jsonb not null default '{}'::jsonb,          -- counts only, never personal data
  error       text,
  started_at  timestamptz not null default now(),
  finished_at timestamptz
);
alter table crm_import_runs enable row level security;
revoke all on crm_import_runs from anon, authenticated;
grant select on crm_import_runs to authenticated;
drop policy if exists read_import on crm_import_runs;
create policy read_import on crm_import_runs for select using (crm_sees_all());

-- p_items: [{source_ref, name, identity: {email: [..], phone: [..], close_contact_id, iclosed_contact_id},
--            occurred_at, data: {status_label, opportunities, ...}}]. Returns the counts of this page.
create or replace function crm_import_people(p_run uuid, p_source event_source, p_items jsonb, p_dry boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare it jsonb; ids jsonb; persons uuid[]; pid uuid; st jsonb := '{"created":0,"matched":0,"conflicts":0,"skipped":0,"statuses":{}}';
        lbl text; k text; v text; em text; ph text;
begin
  begin
    for it in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
      -- every identifier of the contact, as {kind: value} pairs
      ids := '[]'::jsonb;
      for em in select lower(trim(x)) from jsonb_array_elements_text(coalesce(it#>'{identity,email}', '[]')) x where x like '%@%' loop
        ids := ids || jsonb_build_object('k', 'email', 'v', em);
      end loop;
      for ph in select x from jsonb_array_elements_text(coalesce(it#>'{identity,phone}', '[]')) x where x ~ '^\+[0-9]{8,15}$' loop
        ids := ids || jsonb_build_object('k', 'phone', 'v', ph);
      end loop;
      foreach k in array array['close_contact_id', 'iclosed_contact_id'] loop
        v := nullif(trim(it#>>array['identity', k]), '');
        if v is not null then ids := ids || jsonb_build_object('k', k, 'v', v); end if;
      end loop;
      lbl := coalesce(nullif(it#>>'{data,status_label}', ''), '(none)');
      st := jsonb_set(st, array['statuses', lbl], to_jsonb(coalesce((st#>>array['statuses', lbl])::int, 0) + 1));
      if jsonb_array_length(ids) = 0 then
        st := jsonb_set(st, '{skipped}', to_jsonb((st->>'skipped')::int + 1));
        continue;
      end if;
      select coalesce(array_agg(distinct coalesce(p.merged_into, p.id)), '{}') into persons
        from jsonb_array_elements(ids) x
        join crm_person_identities i on i.kind::text = x->>'k' and i.value = x->>'v'
        join crm_people p on p.id = i.person_id;
      if array_length(persons, 1) > 1 then
        st := jsonb_set(st, '{conflicts}', to_jsonb((st->>'conflicts')::int + 1));
        continue;   -- never guess: the identifiers point to several people (merge them in the CRM, then re-run)
      end if;
      pid := persons[1];
      if pid is null then
        insert into crm_people (full_name, primary_email, primary_phone)
        values (nullif(trim(it->>'name'), ''),
                (select x->>'v' from jsonb_array_elements(ids) x where x->>'k' = 'email' limit 1),
                (select x->>'v' from jsonb_array_elements(ids) x where x->>'k' = 'phone' limit 1))
        returning id into pid;
        st := jsonb_set(st, '{created}', to_jsonb((st->>'created')::int + 1));
      else
        update crm_people set full_name = coalesce(full_name, nullif(trim(it->>'name'), '')), updated_at = now() where id = pid;
        st := jsonb_set(st, '{matched}', to_jsonb((st->>'matched')::int + 1));
      end if;
      insert into crm_person_identities (person_id, kind, value, source)
      select pid, (x->>'k')::identity_kind, x->>'v', p_source from jsonb_array_elements(ids) x
      on conflict (kind, value) do nothing;
      insert into crm_events (person_id, occurred_at, actor, channel, type, data, source, source_id)
      values (pid, coalesce((it->>'occurred_at')::timestamptz, now()), 'system', 'crm', 'imported',
        coalesce(it->'data', '{}'::jsonb) || jsonb_build_object('from', p_source), 'import',
        'import:' || p_source || ':' || (it->>'source_ref'))
      on conflict (source, source_id) do update set data = excluded.data, occurred_at = excluded.occurred_at;
    end loop;
    if p_dry then raise exception 'dry run' using errcode = 'P0D01'; end if;
  exception when sqlstate 'P0D01' then
    null;   -- dry run: everything above is rolled back, the counts stay
  end;
  return st;
end $$;

revoke execute on function crm_import_people(uuid, event_source, jsonb, boolean) from public, anon, authenticated;
grant execute on function crm_import_people(uuid, event_source, jsonb, boolean) to service_role;

-- the function keeps its run here: where to start next, the running counts (no personal data), the end
create or replace function crm_import_save(p_run uuid, p_cursor jsonb, p_stats jsonb, p_status text, p_error text default null)
returns void language sql security definer set search_path = public as $$
  update crm_import_runs set cursor = coalesce(p_cursor, cursor), stats = coalesce(p_stats, stats), status = p_status,
    error = left(p_error, 2000), finished_at = case when p_status <> 'running' then now() end
   where id = p_run
$$;
revoke execute on function crm_import_save(uuid, jsonb, jsonb, text, text) from public, anon, authenticated;
grant execute on function crm_import_save(uuid, jsonb, jsonb, text, text) to service_role;
