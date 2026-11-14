-- 060 · Un appel est honoré quand deux personnes s'y connectent (Romain, 2026-11-13 : « change la règle, un appel où 2 personnes
-- se connectent au meeting compte comme honoré »).
-- Avant : l'import Fathom mettait « tenu » tout appel enregistré, quelle que soit sa durée (025), et la règle d'absence demandait
-- 30 minutes (030, 032, 056). Sur la semaine du 6 au 12 novembre, 20 des 59 « honorés » du cockpit duraient moins de 30 minutes,
-- et 23 appels « tenus » de la base n'avaient qu'une seule personne qui parle (le commercial, seul dans la salle).
-- Maintenant : deux personnes au moins parlent dans la transcription Fathom (le commercial et le prospect) = appel honoré, quelle
-- que soit la durée ; une seule = absence (règle d'absence, 056) ; un enregistrement sans transcription garde le critère de
-- durée (no_show_rule.min_minutes) en attendant. Une issue déclarée par le commercial l'emporte toujours (059).
-- Reprise : les appels « tenus » par l'import seul, avec une transcription d'une seule personne et sans issue déclarée, repassent
-- « à déclarer » puis la règle d'absence les traite (absent au 1er appel, à replanifier ensuite) depuis sa date de départ.
-- Sans danger si rejoué.

-- the number of people who speak in a Fathom transcript (array of {speaker, text, timestamp}; 0 for anything else, so a
-- transcript « counts » only when it names at least one speaker)
create or replace function crm_transcript_people(t jsonb) returns int
language sql immutable as $$
  select count(distinct lower(btrim(coalesce(x->'speaker'->>'display_name', x->>'speaker_name', x->>'speaker'))))::int
    from jsonb_array_elements(case when jsonb_typeof(t) = 'array' then t else '[]'::jsonb end) x
   where coalesce(x->'speaker'->>'display_name', x->>'speaker_name', x->>'speaker', '') <> ''
$$;

-- honoured: two people at least in the transcript; without a transcript yet, a recording of min_minutes or more
create or replace function crm_call_attended(k crm_calls) returns boolean
language sql stable security definer set search_path = public as $$
  select case when crm_transcript_people(k.transcript) > 0 then crm_transcript_people(k.transcript) >= 2
              else k.recording_start is not null and k.recording_end is not null
                   and k.recording_end - k.recording_start >= make_interval(mins => coalesce(crm_no_show_setting('min_minutes')::int, 30)) end
$$;

-- a complete call: a Fathom recording where the prospect came (crm_call_attended), or a transcript added by hand
create or replace function crm_call_complete(k crm_calls) returns boolean
language sql stable security definer set search_path = public as $$
  select (k.recorded_by is not null and k.recording_start is not null and coalesce(crm_call_attended(k), false))
      or (coalesce(k.transcript_raw, '') <> '' and k.transcript_source is distinct from 'fathom')
$$;

-- latest definition: 025, with the two-people rule
create or replace function crm_apply_recording_item(it jsonb, p_queue boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
declare rid bigint := (it#>>'{refs,fathom_recording_id}')::bigint; recorder text := lower(it#>>'{refs,recorder_email}');
        rstart timestamptz := coalesce(nullif(it#>>'{data,start}', '')::timestamptz, (it->>'occurred_at')::timestamptz);
        rend timestamptz := nullif(it#>>'{data,end}', '')::timestamptz; win int;
        call crm_calls; pf jsonb; n int; pid uuid; cid uuid; rule text; smap jsonb; info jsonb; queued boolean := false;
        link text;
        -- 060: honoured when two people at least speak in the recording (the prospect came); a recording with no
        -- transcript yet falls back on its length (no_show_rule.min_minutes)
        attended boolean := case when crm_transcript_people(it#>'{data,transcript}') > 0
                                 then crm_transcript_people(it#>'{data,transcript}') >= 2
                                 else nullif(it#>>'{data,end}', '')::timestamptz - coalesce(nullif(it#>>'{data,start}', '')::timestamptz, (it->>'occurred_at')::timestamptz)
                                        >= make_interval(mins => coalesce(crm_no_show_setting('min_minutes')::int, 30)) end;
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
      values (cid, (select coalesce(max(rank), 0) + 1 from crm_calls where cycle_id = cid), rstart, coalesce(rend, rstart), case when attended then 'held' else 'scheduled' end::call_status,
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
      status = case when coalesce(attended, false) and status in ('scheduled', 'outcome_pending', 'canceled') then 'held'
                    -- a call held by an earlier import alone (no outcome declared) and with one person only: not honoured
                    when not coalesce(attended, false) and status = 'held'
                         and not exists (select 1 from crm_call_outcomes oc where oc.call_id = crm_calls.id and oc.superseded_at is null) then 'scheduled'
                    else status end
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
        'recorder', recorder, 'speakers_mapped', smap is not null, 'people', crm_transcript_people(it#>'{data,transcript}'))),
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

-- latest definition: 056, a recording of one person is an absence
create or replace function crm_apply_no_show_rule(p_dry boolean default true, p_cycle uuid default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare since timestamptz := nullif(crm_no_show_setting('since'), '')::timestamptz;
        grace interval := make_interval(hours => coalesce(crm_no_show_setting('grace_hours')::int, 3));
        cy record; k crm_calls; seen boolean; ns int := 0; ms int := 0; cycles uuid[] := '{}';
begin
  if since is null then return jsonb_build_object('error', 'no_show_rule.since is not set (the date the Fathom history starts)'); end if;
  for cy in select c.id, c.person_id from crm_cycles c where c.status <> 'won' and (p_cycle is null or c.id = p_cycle)
             and exists (select 1 from crm_calls x where x.cycle_id = c.id and x.scheduled_start >= since) loop
    seen := false;
    for k in select * from crm_calls where cycle_id = cy.id order by coalesce(recording_start, scheduled_start, created_at), created_at, id loop
      if crm_call_complete(k) then seen := true; continue; end if;
      -- 056: only a call nobody has given an attendance for: still scheduled (iClosed gave no outcome), with no recording
      continue when k.status::text not in ('scheduled', 'outcome_pending')
        -- 060: a recording with its transcript and one person only is an absence; one without a transcript yet waits
        or ((k.recorded_by is not null or k.recording_start is not null)
            and not (crm_transcript_people(k.transcript) > 0))
        or k.scheduled_start is null or k.scheduled_start < since
        or coalesce(k.scheduled_end, k.scheduled_start) + grace > now()
        or exists (select 1 from crm_call_outcomes oc where oc.call_id = k.id and oc.superseded_at is null)
        or crm_call_has_ambiguous_recording(k.id);
      if not seen then ns := ns + 1; else ms := ms + 1; end if;
      cycles := array_append(cycles, cy.id);
      continue when p_dry;
      update crm_calls set status = case when seen then 'missed' else 'no_show' end::call_status where id = k.id;
      insert into crm_events (person_id, cycle_id, call_id, occurred_at, actor, channel, type, data, source, source_id)
      values (cy.person_id, cy.id, k.id, coalesce(k.scheduled_end, k.scheduled_start), 'system', 'crm',
              case when seen then 'call_missed' else 'outcome_no_show' end,
              jsonb_build_object('rule', case when k.recording_start is not null then 'one_person_on_recording' else 'no_fathom_recording' end, 'min_minutes', coalesce(crm_no_show_setting('min_minutes')::int, 30)),
              'rules', 'noshow:' || k.id)
      on conflict (source, source_id) do nothing;
    end loop;
  end loop;
  if not p_dry then
    perform crm_recompute_cycle(c) from (select distinct unnest(cycles) c) x;
  end if;
  return jsonb_build_object('dry', p_dry, 'since', since, 'no_show_r1', ns, 'missed_r2_plus', ms,
                            'cycles', (select count(distinct c) from unnest(cycles) c));
end $$;
revoke execute on function crm_apply_no_show_rule(boolean, uuid) from public, anon, authenticated;
grant execute on function crm_apply_no_show_rule(boolean, uuid) to service_role;

-- reprise: the calls held by the import alone with one person only go back to « à déclarer », then the absence rule
do $$
declare ids uuid[]; c uuid;
begin
  with x as (
    update crm_calls k set status = 'scheduled'
     where k.status = 'held' and k.fathom_recording_id is not null and not coalesce(crm_call_attended(k), false)
       and crm_transcript_people(k.transcript) > 0
       and not exists (select 1 from crm_call_outcomes oc where oc.call_id = k.id and oc.superseded_at is null)
    returning k.cycle_id)
  select array_agg(distinct cycle_id) into ids from x;
  foreach c in array coalesce(ids, '{}') loop
    perform crm_apply_no_show_rule(false, c);
    perform crm_recompute_cycle(c);
  end loop;
end $$;
