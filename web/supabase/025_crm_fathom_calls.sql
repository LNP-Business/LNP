-- LNP CRM — Fathom is the source of truth of the sales calls (web/supabase/025_crm_fathom_calls.sql), after 024.
-- Romain, 2026-10-29: "100 % of the Fathom calls that are sales calls, recorded by Valentino, are linked to a lead. A Fathom
-- call with no link to an existing lead is probably a professional call, not a sales call. The source of truth of the calls
-- is Fathom, not iClosed: booked calls can be canceled or rescheduled. Several Fathom calls with one lead = R1 + R2, or more."
-- Rules FL-1 to FL-6 (docs/crm/06-integration-fathom.md §0):
--   FL-1 a recording is a candidate sales call when its recorder is a sales rep (crm_sales_team, by member key or by the
--        local part of the email, as 019); any other recorder (onboarding, team meetings) → `not_sales_recorder`.
--   FL-2 the lead is found by the first rule that gives exactly one person: (a) an external invitee's or a speaker's email;
--        (b) the person whose call, hosted by the recorder, was booked within ±fathom_match_minutes (90) of the recording
--        start; (c) an invitee, speaker or title name equal to the person's full name. Several people → `ambiguous`.
--   FL-3 no lead → `not_sales`: kept in crm_fathom_recordings for review, never a new person.
--   FL-4 a linked recording is a held call: it fills the booked call it matches (FL-2 b window) or becomes a new call.
--   FL-5 R1, R2, R3… = the order of the cycle's sales recordings; a call with no recording (booked, canceled, no-show,
--        onboarding) carries the number of the next sales call to come. Cycles without any recording keep their numbers.
--   FL-6 a recorded call keeps asking for its outcome until one is declared; its transcript goes to the call analysis
--        (R1 and R2 only; the hourly import and webhooks queue it, a history import never does).
-- Used by crm-import ?source=fathom (hourly job of 006 and history, crm_import_recordings) and process-inbox (webhooks, if one
-- is ever set up, crm_apply_recordings). Romain 2026-10-29: no webhook, the API key is read every hour.
-- Safe to run again.

alter table crm_calls drop constraint if exists crm_calls_cycle_id_rank_key;   -- FL-5: a canceled R2 and the held R2 share a number
alter table crm_calls add column if not exists recorded_by citext;              -- the sales rep who recorded it in Fathom
create index if not exists calls_cycle_rank on crm_calls(cycle_id, rank);

insert into crm_settings (key, value, is_proposal) values ('fathom_match_minutes', '90', true) on conflict (key) do nothing;

create table if not exists crm_fathom_recordings (
  recording_id  bigint primary key,
  recorded_at   timestamptz,
  ended_at      timestamptz,
  recorder      citext,
  title         text,
  url           text,
  status        text not null check (status in ('linked', 'not_sales', 'not_sales_recorder', 'ambiguous')),
  rule          text check (rule in ('known', 'email', 'booking', 'name')),
  person_id     uuid references crm_people(id) on delete set null,
  call_id       uuid references crm_calls(id) on delete set null,
  candidates    uuid[],
  updated_at    timestamptz not null default now()
);
alter table crm_fathom_recordings enable row level security;
revoke all on crm_fathom_recordings from public, anon, authenticated;
grant select on crm_fathom_recordings to authenticated;
drop policy if exists fathom_recordings_admin on crm_fathom_recordings;
create policy fathom_recordings_admin on crm_fathom_recordings for select using (coalesce(crm_role() = 'admin', false));

-- ───────────────────────── FL-1, FL-2 ─────────────────────────
create or replace function crm_fathom_sales_recorder(p_email text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(nullif(trim(p_email), ''), '') <> '' and (
    exists (select 1 from crm_sales_team t where t.rep = lower(split_part(trim(p_email), '@', 1)))
    or exists (select 1 from crm_members m join crm_sales_team t on t.rep = m.member_key
                where lower(trim(p_email)) in (lower(m.email::text), lower(m.fathom_email::text), lower(m.iclosed_email::text))))
$$;

create or replace function crm_norm_name(p text) returns text
language sql immutable as $$
  select nullif(trim(regexp_replace(regexp_replace(lower(coalesce(p, '')), '[^[:alpha:] ]', ' ', 'g'), '\s+', ' ', 'g')), '')
$$;

-- the person of a recording: {person, rule, candidates}; rule null when nobody, 'ambiguous' when several
create or replace function crm_fathom_person(it jsonb) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare ps uuid[]; e text; rstart timestamptz := coalesce(nullif(it#>>'{data,start}', '')::timestamptz, (it->>'occurred_at')::timestamptz);
        recorder text := lower(it#>>'{refs,recorder_email}'); win int;
begin
  select coalesce((value #>> '{}')::int, 90) into win from crm_settings where key = 'fathom_match_minutes';
  win := coalesce(win, 90);
  -- (a) emails of the external invitees and of the speakers, never a team member's
  ps := '{}';
  for e in select distinct lower(x) from jsonb_array_elements_text(coalesce(it#>'{identity,emails}', '[]')) x loop
    continue when e = recorder or exists (select 1 from crm_members m where lower(e) in (lower(m.email::text), lower(m.fathom_email::text), lower(m.iclosed_email::text)));
    ps := ps || crm_people_for(jsonb_build_object('email', e));
  end loop;
  ps := (select coalesce(array_agg(distinct x), '{}') from unnest(ps) x);
  if cardinality(ps) = 1 then return jsonb_build_object('person', ps[1], 'rule', 'email'); end if;
  if cardinality(ps) > 1 then return jsonb_build_object('rule', 'ambiguous', 'candidates', to_jsonb(ps)); end if;
  -- (b) the call the recorder hosted, booked around the recording start, not canceled, not linked to another recording
  select coalesce(array_agg(distinct coalesce(p.merged_into, p.id)), '{}') into ps
    from crm_calls k join crm_cycles c on c.id = k.cycle_id join crm_people p on p.id = c.person_id
   where k.fathom_recording_id is null and k.status <> 'canceled' and k.scheduled_start is not null
     and abs(extract(epoch from k.scheduled_start - rstart)) <= win * 60
     and (exists (select 1 from crm_events b where b.call_id = k.id and b.type in ('call_booked', 'call_rescheduled')
                   and lower(b.data->>'host_email') = recorder)
          or exists (select 1 from crm_members m where m.id = k.host_id
                      and recorder in (lower(m.email::text), lower(m.fathom_email::text), lower(m.iclosed_email::text))));
  if cardinality(ps) = 1 then return jsonb_build_object('person', ps[1], 'rule', 'booking'); end if;
  if cardinality(ps) > 1 then return jsonb_build_object('rule', 'ambiguous', 'candidates', to_jsonb(ps)); end if;
  -- (c) a full name (two words or more) equal to the person's
  select coalesce(array_agg(distinct p.id), '{}') into ps from crm_people p
   where p.merged_into is null and crm_norm_name(p.full_name) like '% %'
     and crm_norm_name(p.full_name) in (select crm_norm_name(x) from jsonb_array_elements_text(coalesce(it#>'{data,names}', '[]')) x);
  if cardinality(ps) = 1 then return jsonb_build_object('person', ps[1], 'rule', 'name'); end if;
  if cardinality(ps) > 1 then return jsonb_build_object('rule', 'ambiguous', 'candidates', to_jsonb(ps)); end if;
  return '{}'::jsonb;
end $$;

-- ───────────────────────── FL-5 numbering ─────────────────────────
-- R numbers of a cycle that has sales recordings: recordings 1, 2, 3… in time order; any other call takes the next number.
create or replace function crm_rank_calls(p_cycle uuid) returns void
language plpgsql security definer set search_path = public as $$
declare k record; n int := 0;
begin
  if not exists (select 1 from crm_calls where cycle_id = p_cycle and recorded_by is not null) then return; end if;
  for k in select id, recorded_by, rank from crm_calls where cycle_id = p_cycle
            order by coalesce(recording_start, scheduled_start, created_at), created_at, id loop
    if k.recorded_by is not null then n := n + 1; end if;
    if k.rank is distinct from (case when k.recorded_by is not null then n else n + 1 end) then
      update crm_calls set rank = case when k.recorded_by is not null then n else n + 1 end where id = k.id;
    end if;
  end loop;
end $$;

create or replace function crm_calls_rank_trigger() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform crm_rank_calls(new.cycle_id);
  return null;
end $$;
drop trigger if exists crm_calls_rank on crm_calls;
create trigger crm_calls_rank after insert or update of scheduled_start, recording_start, recorded_by, cycle_id on crm_calls
  for each row when (pg_trigger_depth() < 1) execute function crm_calls_rank_trigger();

-- ───────────────────────── FL-4, FL-6: one recording ─────────────────────────
-- speaker map of a linked recording: the recorder SALES, the lead PROSPECT (by email or name), the others OTHER; with no
-- speaker recognised and exactly one other speaker, that speaker is the PROSPECT. Null when no PROSPECT can be told.
create or replace function crm_fathom_speaker_map(it jsonb, p_person uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare s jsonb; m jsonb := '{}'; recorder text := lower(it#>>'{refs,recorder_email}'); rname text := crm_norm_name(it#>>'{data,recorder_name}');
        pname text; others text[] := '{}'; prospect boolean := false; nm text;
begin
  select crm_norm_name(full_name) into pname from crm_people where id = p_person;
  for s in select * from jsonb_array_elements(coalesce(it#>'{data,speakers}', '[]')) loop
    nm := s->>'name';
    continue when coalesce(nm, '') = '' or m ? nm;
    if lower(coalesce(s->>'email', '')) = recorder or (rname is not null and crm_norm_name(nm) = rname) then
      m := m || jsonb_build_object(nm, 'SALES');
    elsif (coalesce(s->>'email', '') <> '' and p_person = any(crm_people_for(jsonb_build_object('email', lower(s->>'email')))))
          or (pname is not null and crm_norm_name(nm) = pname) then
      m := m || jsonb_build_object(nm, 'PROSPECT'); prospect := true;
    else
      others := others || nm;
    end if;
  end loop;
  if not prospect and cardinality(others) = 1 then m := m || jsonb_build_object(others[1], 'PROSPECT'); prospect := true; others := '{}'; end if;
  for nm in select unnest(others) loop m := m || jsonb_build_object(nm, 'OTHER'); end loop;
  if not prospect or not exists (select 1 from jsonb_each_text(m) x where x.value = 'SALES') then return null; end if;
  return m;
end $$;

create or replace function crm_apply_recording_item(it jsonb, p_queue boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
declare rid bigint := (it#>>'{refs,fathom_recording_id}')::bigint; recorder text := lower(it#>>'{refs,recorder_email}');
        rstart timestamptz := coalesce(nullif(it#>>'{data,start}', '')::timestamptz, (it->>'occurred_at')::timestamptz);
        rend timestamptz := nullif(it#>>'{data,end}', '')::timestamptz; win int;
        call crm_calls; pf jsonb; n int; pid uuid; cid uuid; rule text; smap jsonb; info jsonb; queued boolean := false;
        link text;
begin
  if rid is null then return jsonb_build_object('status', 'invalid'); end if;
  -- FL-1
  if not crm_fathom_sales_recorder(recorder) then
    link := 'not_sales_recorder';
  else
    select * into call from crm_calls where fathom_recording_id = rid;
    if call.id is not null then
      select person_id into pid from crm_cycles where id = call.cycle_id; rule := 'known';
    else
      pf := crm_fathom_person(it);
      rule := pf->>'rule'; pid := (pf->>'person')::uuid;
    end if;
    link := case when pid is not null then 'linked' when rule = 'ambiguous' then 'ambiguous' else 'not_sales' end;
  end if;

  if link = 'linked' and call.id is null then
    select coalesce((value #>> '{}')::int, 90) into win from crm_settings where key = 'fathom_match_minutes';
    win := coalesce(win, 90);
    -- FL-4: the booked call of this person around the recording start, else a new call in the cycle open at that time
    select k.* into call from crm_calls k join crm_cycles c on c.id = k.cycle_id
     where c.person_id = pid and k.fathom_recording_id is null and k.scheduled_start is not null
       and abs(extract(epoch from k.scheduled_start - rstart)) <= win * 60
     order by (k.status = 'canceled'), abs(extract(epoch from k.scheduled_start - rstart)) limit 1;
    if call.id is null then
      select id into cid from crm_cycles where person_id = pid
       order by (opened_at <= rstart + interval '1 day') desc, case when opened_at <= rstart + interval '1 day' then opened_at end desc nulls last, opened_at
       limit 1;
      if cid is null then cid := crm_open_cycle(pid, rstart, crm_owner_for(recorder)); end if;
      insert into crm_calls (cycle_id, rank, scheduled_start, scheduled_end, status, host_id)
      values (cid, (select coalesce(max(rank), 0) + 1 from crm_calls where cycle_id = cid), rstart, coalesce(rend, rstart), 'held',
              crm_owner_for(recorder))
      returning * into call;
    end if;
  end if;

  if link = 'linked' then
    cid := call.cycle_id;
    smap := crm_fathom_speaker_map(it, pid);
    update crm_calls set fathom_recording_id = rid, recorded_by = recorder, recording_start = rstart, recording_end = rend,
      recording_url = coalesce(nullif(it#>>'{data,url}', ''), recording_url), share_url = coalesce(nullif(it#>>'{data,share_url}', ''), share_url),
      summary_md = coalesce(nullif(it#>>'{data,summary_md}', ''), summary_md),
      transcript = coalesce(it#>'{data,transcript}', transcript),
      status = case when status in ('scheduled', 'outcome_pending', 'canceled') then 'held' else status end
     where id = call.id;
    -- the transcript for the call analysis, unless one was added by hand
    if coalesce(nullif(it#>>'{data,transcript_raw}', ''), '') <> '' and smap is not null
       and (call.transcript_raw is null or call.transcript_source = 'fathom') then
      update crm_calls set transcript_raw = it#>>'{data,transcript_raw}', speaker_map = smap, transcript_source = 'fathom',
        transcript_added_at = coalesce(transcript_added_at, now())
       where id = call.id and transcript_raw is distinct from it#>>'{data,transcript_raw}';
      get diagnostics n = row_count;
      if n > 0 and p_queue then
        info := crm_ca_call_info(call.id);
        if (info->>'eligible')::boolean and length(it#>>'{data,transcript_raw}') >= 200
           and not exists (select 1 from crm_ca_jobs where call_id = call.id and status in ('queued', 'running', 'done')) then
          insert into crm_ca_jobs (call_id) values (call.id);
          queued := true;
        end if;
      end if;
    end if;
    insert into crm_events (person_id, cycle_id, call_id, occurred_at, actor, channel, type, data, source, source_id)
    values (pid, cid, call.id, rstart, 'sales', 'video', 'call_recorded',
      jsonb_strip_nulls(jsonb_build_object('fathom_recording_id', rid, 'title', it#>>'{data,title}', 'url', it#>>'{data,url}',
        'duration_s', case when rend is not null then extract(epoch from rend - rstart)::int end, 'rule', rule,
        'recorder', recorder, 'speakers_mapped', smap is not null)),
      'fathom', it->>'source_id')
    on conflict (source, source_id) do update set data = excluded.data, call_id = excluded.call_id, cycle_id = excluded.cycle_id;
  end if;

  insert into crm_fathom_recordings (recording_id, recorded_at, ended_at, recorder, title, url, status, rule, person_id, call_id,
                                     candidates, updated_at)
  values (rid, rstart, rend, recorder, it#>>'{data,title}', it#>>'{data,url}', link,
          case when link = 'linked' then rule end, pid, call.id,
          case when link = 'ambiguous' then (select array_agg(x::uuid) from jsonb_array_elements_text(pf->'candidates') x) end, now())
  on conflict (recording_id) do update set recorded_at = excluded.recorded_at, ended_at = excluded.ended_at, recorder = excluded.recorder,
    title = excluded.title, url = excluded.url, status = excluded.status, rule = coalesce(excluded.rule, crm_fathom_recordings.rule),
    person_id = excluded.person_id, call_id = excluded.call_id, candidates = excluded.candidates, updated_at = now();
  return jsonb_strip_nulls(jsonb_build_object('status', link, 'rule', case when link = 'linked' then rule end, 'cycle', cid,
                                              'call', call.id, 'queued', queued, 'speakers_mapped', smap is not null));
end $$;

-- webhooks (process-inbox): a linked recording is processed, a professional call ignored, several candidate leads unmatched
create or replace function crm_apply_recordings(p_inbox bigint, p_items jsonb) returns text
language plpgsql security definer set search_path = public as $$
declare it jsonb; r jsonb; result text := 'ignored'; note text; touched uuid[] := '{}'; c uuid;
begin
  for it in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    r := crm_apply_recording_item(it, true);
    if r->>'status' = 'linked' then
      result := 'processed'; touched := touched || (r->>'cycle')::uuid;
    elsif r->>'status' = 'ambiguous' then
      insert into crm_unmatched_inbox (inbox_id, source, reason, summary, candidate_person_ids)
      select p_inbox, 'fathom', 'Enregistrement Fathom : plusieurs prospects correspondent', it#>>'{data,title}', candidates
        from crm_fathom_recordings where recording_id = (it#>>'{refs,fathom_recording_id}')::bigint;
      if result <> 'processed' then result := 'unmatched'; end if;
    else
      note := case when r->>'status' = 'not_sales_recorder' then 'Fathom: not recorded by a sales rep (FL-1)'
                   else 'Fathom: no lead found, not a sales call (FL-3)' end;
    end if;
  end loop;
  foreach c in array coalesce((select array_agg(distinct x) from unnest(touched) x), '{}') loop perform crm_recompute_cycle(c); end loop;
  update crm_webhook_log set status = result::inbox_status, processed_at = now(),
    error = case when result = 'ignored' then note end where id = p_inbox;
  return result;
end $$;

-- crm-import ?source=fathom: the same items, many at a time; p_queue (the hourly job) queues the R1 / R2 analyses, a history
-- import does not; a dry run is rolled back and returns counts only (by status and by FL-2 rule)
drop function if exists crm_import_recordings(jsonb, boolean);
create or replace function crm_import_recordings(p_items jsonb, p_dry boolean, p_queue boolean default false) returns jsonb
language plpgsql security definer set search_path = public as $$
declare it jsonb; r jsonb; st jsonb := '{"items":0}'; touched uuid[] := '{}'; c uuid; k text;
begin
  begin
    for it in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
      r := crm_apply_recording_item(it, p_queue and not p_dry);
      foreach k in array array['items', r->>'status', coalesce('rule_' || (r->>'rule'), '')] loop
        continue when k = '';
        st := jsonb_set(st, array[k], to_jsonb(coalesce((st->>k)::int, 0) + 1));
      end loop;
      if (r->>'queued')::boolean then st := jsonb_set(st, '{queued}', to_jsonb(coalesce((st->>'queued')::int, 0) + 1)); end if;
      if r->>'status' = 'linked' then
        touched := touched || (r->>'cycle')::uuid;
        if not (r->>'speakers_mapped')::boolean then st := jsonb_set(st, '{speakers_unmapped}', to_jsonb(coalesce((st->>'speakers_unmapped')::int, 0) + 1)); end if;
      end if;
    end loop;
    foreach c in array coalesce((select array_agg(distinct x) from unnest(touched) x), '{}') loop perform crm_recompute_cycle(c); end loop;
    if p_dry then raise exception 'dry run' using errcode = 'P0D01'; end if;
  exception when sqlstate 'P0D01' then
    null;
  end;
  return st;
end $$;

-- ───────────────────────── call analysis: which calls (020), with Fathom as the truth ─────────────────────────
-- A cycle with sales recordings: its R1 and R2 are its first two recordings (FL-5), nothing else is a sales call. A cycle
-- without any recording keeps the 020 reading (iClosed bookings, onboarding and case-study calls left out).
create or replace function crm_ca_call_info(p_call uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  with b as (
    select k.id, k.cycle_id, k.scheduled_start, k.status, k.recorded_by, k.rank,
           (select e.data from crm_events e where e.call_id = k.id and e.type = 'call_booked' order by e.occurred_at desc limit 1) bk,
           exists (select 1 from crm_calls x where x.cycle_id = k.cycle_id and x.recorded_by is not null) fathom
      from crm_calls k
     where k.cycle_id = (select cycle_id from crm_calls where id = p_call)),
  s as (
    select b.*, case when b.fathom then b.recorded_by is null
                     else coalesce(b.bk->>'event_name', '') ~* '(onboarding|case stud)' end as other_kind,
           lower(coalesce(b.recorded_by::text, nullif(b.bk->>'host_email', ''))) host
      from b),
  r as (
    select s.*, case when s.fathom then case when s.recorded_by is not null then s.rank end
                     when not s.other_kind and s.status <> 'canceled'
                     then count(*) filter (where not s.other_kind and s.status <> 'canceled')
                            over (order by s.scheduled_start, s.id) end as sales_round
      from s)
  select jsonb_build_object(
    'call_id', r.id, 'cycle_id', r.cycle_id, 'start_utc', r.scheduled_start, 'event_name', r.bk->>'event_name',
    'sales_round', r.sales_round,
    'eligible', coalesce(not r.other_kind and r.sales_round between 1 and 2 and r.scheduled_start < now(), false),
    'reason', case when r.other_kind and r.fathom then 'aucun enregistrement Fathom de cet appel par un commercial'
                   when r.other_kind then 'pas un appel de vente (accueil ou étude de cas)'
                   when r.status = 'canceled' then 'appel annulé'
                   when r.scheduled_start >= now() then 'l''appel n''a pas encore eu lieu'
                   when r.sales_round > 2 then 'seuls les appels de vente R1 et R2 sont analysés' end,
    'sales_id', coalesce(cm.member_key, nullif(split_part(r.host, '@', 1), ''), 'none'),
    'sales_name', coalesce(cm.full_name, st.name, initcap(nullif(split_part(split_part(r.host, '@', 1), '.', 1), ''))),
    'timezone', coalesce(cm.timezone, (select default_timezone from crm_ca_config)),
    'person', (select coalesce(p.full_name, p.primary_email) from crm_cycles c join crm_people p on p.id = c.person_id where c.id = r.cycle_id))
  from r
  left join crm_cycles cy on cy.id = r.cycle_id
  left join crm_members cm on cm.id = cy.owner_id
  left join crm_sales_team st on st.rep = nullif(split_part(r.host, '@', 1), '')
  where r.id = p_call
$$;

-- ───────────────────────── projector (005), FL-6 ─────────────────────────
-- Same as 005, with one change: a call recorded in Fathom that has no outcome yet asks for its outcome, like a booked call
-- that ended.
create or replace function crm_recompute_cycle(p_cycle uuid) returns void
language plpgsql security definer set search_path = public as $$
declare cy crm_cycles; st record; prev_stage text; prev_at timestamptz; new_status cycle_status := 'active';
        close_at timestamptz; reason text; o record; lost_at timestamptz; reopen_at timestamptz; won_at timestamptz;
        nm jsonb; nxt crm_calls; late crm_calls; last_call crm_calls; t timestamptz := now();
begin
  select * into cy from crm_cycles where id = p_cycle for update;
  if cy.id is null then return; end if;

  -- stages: entered at the first event whose type the stage lists; the current stage is the furthest reached
  delete from crm_stage_history where cycle_id = p_cycle;
  prev_stage := null; prev_at := null;
  for st in
    select d.key, (select min(e.occurred_at) from crm_events e where e.cycle_id = p_cycle and e.type = any(d.enter_on)) as at
      from crm_stage_definitions d where d.active order by d.position
  loop
    continue when st.at is null;
    if prev_stage is not null then
      update crm_stage_history set exited_at = greatest(st.at, entered_at) where cycle_id = p_cycle and stage = prev_stage;
    end if;
    insert into crm_stage_history (cycle_id, stage, entered_at) values (p_cycle, st.key, st.at);
    prev_stage := st.key; prev_at := st.at;
  end loop;

  -- status: won at the first succeeded payment; lost / disqualified at the latest current outcome no / disqualified
  -- (or a rules cycle_lost event); back to active after a later cycle_reopened
  select min(occurred_at) into won_at from crm_events where cycle_id = p_cycle and type = 'payment_succeeded';
  select oc.decision, oc.reason_code, oc.declared_at into o from crm_call_outcomes oc join crm_calls c on c.id = oc.call_id
   where c.cycle_id = p_cycle and oc.superseded_at is null order by oc.declared_at desc limit 1;
  select max(occurred_at) into reopen_at from crm_events where cycle_id = p_cycle and type = 'cycle_reopened';
  if won_at is not null then
    new_status := 'won'; close_at := won_at; reason := null;
  elsif o.decision in ('no', 'disqualified') and (reopen_at is null or o.declared_at > reopen_at) then
    new_status := case when o.decision = 'no' then 'lost' else 'disqualified' end; close_at := o.declared_at; reason := o.reason_code;
  elsif o.declared_at is null and exists (select 1 from crm_events where cycle_id = p_cycle and source = 'import' and type in ('cycle_won', 'cycle_lost', 'cycle_disqualified')
                  and (reopen_at is null or occurred_at > reopen_at)) then
    -- closed in the tool the lead came from (008 / 009 / 013 imports), until a declared outcome or a reopening says otherwise
    select substr(type, 7)::cycle_status, occurred_at, data->>'reason' into new_status, close_at, reason from crm_events
     where cycle_id = p_cycle and source = 'import' and type in ('cycle_won', 'cycle_lost', 'cycle_disqualified') order by occurred_at desc limit 1;
  else
    select occurred_at, data->>'reason' into lost_at, reason from crm_events
     where cycle_id = p_cycle and type = 'cycle_lost' and source = 'rules' order by occurred_at desc limit 1;
    if lost_at is not null and (reopen_at is null or lost_at > reopen_at) then
      new_status := 'lost'; close_at := lost_at;
    else
      reason := null;
    end if;
  end if;
  if new_status <> cy.status and new_status <> 'active' then
    insert into crm_events (person_id, cycle_id, occurred_at, actor, channel, type, data, source, source_id)
    values (cy.person_id, p_cycle, close_at, 'system', 'crm', 'cycle_' || new_status::text, jsonb_build_object('reason', reason),
      'crm', 'status:' || p_cycle || ':' || new_status::text || ':' || close_at)
    on conflict (source, source_id) do nothing;
  end if;

  -- who must act (DEFERRED wording and logic, 10 §3): outcome missing, then the next call, then rebook, then follow up
  -- (025, FL-6: a Fathom recording with no current outcome counts as a call whose outcome is missing)
  select * into late from crm_calls k where k.cycle_id = p_cycle and coalesce(k.recording_end, k.scheduled_end) < t
     and (k.status = 'scheduled'
          or (k.status = 'held' and k.recorded_by is not null
              and not exists (select 1 from crm_call_outcomes oc where oc.call_id = k.id and oc.superseded_at is null)))
   order by coalesce(k.recording_end, k.scheduled_end) limit 1;
  select * into nxt from crm_calls where cycle_id = p_cycle and status = 'scheduled' and scheduled_start >= t
   order by scheduled_start limit 1;
  select * into last_call from crm_calls where cycle_id = p_cycle order by rank desc, coalesce(recording_start, scheduled_start) desc limit 1;
  nm := case
    when new_status <> 'active' then null
    when late.id is not null then jsonb_build_object('who', 'sales', 'code', 'declare_outcome', 'label', 'Déclarer l''issue de l''appel', 'due_at', coalesce(late.recording_end, late.scheduled_end))
    when nxt.id is not null then jsonb_build_object('who', 'prospect', 'code', 'attend_call', 'label', 'Appel R' || nxt.rank, 'due_at', nxt.scheduled_start)
    when last_call.status = 'canceled' then jsonb_build_object('who', 'sales', 'code', 'rebook', 'label', 'Reprendre un rendez-vous')
    else jsonb_build_object('who', 'sales', 'code', 'follow_up', 'label', 'Relancer') end;

  update crm_cycles set
    current_stage = prev_stage, stage_entered_at = prev_at,
    calls_held = (select count(*) from crm_calls where cycle_id = p_cycle and status = 'held'),
    no_shows = (select count(*) from crm_calls where cycle_id = p_cycle and status = 'no_show'),
    sales_attempts = (select count(*) from crm_events where cycle_id = p_cycle and actor = 'sales' and type in ('message_out', 'phone_call_out')),
    last_prospect_at = (select max(occurred_at) from crm_events where cycle_id = p_cycle and actor = 'prospect' and type in ('message_in', 'phone_call_in')),
    last_sales_at = (select max(occurred_at) from crm_events where cycle_id = p_cycle and actor = 'sales' and type in ('message_out', 'phone_call_out')),
    last_event_at = (select max(occurred_at) from crm_events where cycle_id = p_cycle),
    status = new_status, closed_at = case when new_status = 'active' then null else close_at end,
    close_reason = case when new_status in ('lost', 'disqualified') then reason end,
    next_move = nm, projected_at = t
  where id = p_cycle;
end $$;

-- ───────────────────────── privileges ─────────────────────────
do $$ declare f text; begin
  foreach f in array array['crm_fathom_sales_recorder(text)', 'crm_fathom_person(jsonb)', 'crm_rank_calls(uuid)',
    'crm_fathom_speaker_map(jsonb, uuid)', 'crm_apply_recording_item(jsonb, boolean)', 'crm_apply_recordings(bigint, jsonb)',
    'crm_import_recordings(jsonb, boolean, boolean)', 'crm_recompute_cycle(uuid)'] loop
    execute 'revoke execute on function ' || f || ' from public, anon, authenticated';
    execute 'grant execute on function ' || f || ' to service_role';
  end loop;
end $$;
