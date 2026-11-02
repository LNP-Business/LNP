-- 032: a Fathom recording among back-to-back calls goes to the closest one (Romain 2026-10-31: "un gros doute sur le pourcentage
-- de no show du sales cockpit"). Valentino's calls follow each other every 30 to 60 minutes, so 025's rule FL-2 (b) often found
-- two or three bookings within ±90 min of a recording and kept it "ambiguous": the call was held but linked to nobody, and
-- 030 then counted every candidate's call as a no-show (25 of the 42 no-shows of the last 30 days on 2026-10-31).
--   * FL-2 (b): several people booked around the recording → the one whose call starts closest, when it starts within
--     fathom_close_minutes (15) of the recording and nobody else's does (rule booking_closest); else still ambiguous.
--   * 030: a call is never made a no-show while a recording of min_minutes or more, still ambiguous, names its person and
--     starts within fathom_match_minutes of it; the no-shows 030 already set on such calls go back to "outcome to declare".
-- Then (Romain 2026-10-31: "tout lead n'ayant jamais fait un appel de vente de plus de 30 minutes qui possède un Fathom doit
-- rentrer dans la catégorie no show; un reschedule n'est ni dans l'un ni dans l'autre car il n'a pas encore été traité"):
--   * a complete call needs a recording of 30 minutes (no_show_rule.min_minutes, was 7);
--   * the Sales cockpit's show rate counts leads: shown (a complete call ever), no-show, or pending (a call booked ahead, or the
--     last call canceled to be rescheduled), which counts in neither.
-- After this file, the Fathom history is imported again (crm-import ?source=fathom&since=2026-06-14): the ambiguous recordings
-- are matched again and their calls held (030's trigger crm_calls_recorded removes the no-show).

insert into crm_settings (key, value, is_proposal) values ('fathom_close_minutes', '15', true) on conflict (key) do nothing;
alter table crm_fathom_recordings drop constraint if exists crm_fathom_recordings_rule_check;
alter table crm_fathom_recordings add constraint crm_fathom_recordings_rule_check check (rule in ('known', 'email', 'booking', 'booking_closest', 'name'));

create or replace function crm_fathom_person(it jsonb) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare ps uuid[]; e text; rstart timestamptz := coalesce(nullif(it#>>'{data,start}', '')::timestamptz, (it->>'occurred_at')::timestamptz);
        recorder text := lower(it#>>'{refs,recorder_email}'); win int; close int; ds numeric[];
begin
  select coalesce((value #>> '{}')::int, 90) into win from crm_settings where key = 'fathom_match_minutes';
  win := coalesce(win, 90);
  select coalesce((value #>> '{}')::int, 15) into close from crm_settings where key = 'fathom_close_minutes';
  close := coalesce(close, 15);
  -- (a) emails of the external invitees and of the speakers, never a team member's
  ps := '{}';
  for e in select distinct lower(x) from jsonb_array_elements_text(coalesce(it#>'{identity,emails}', '[]')) x loop
    continue when e = recorder or exists (select 1 from crm_members m where lower(e) in (lower(m.email::text), lower(m.fathom_email::text), lower(m.iclosed_email::text)));
    ps := ps || crm_people_for(jsonb_build_object('email', e));
  end loop;
  ps := (select coalesce(array_agg(distinct x), '{}') from unnest(ps) x);
  if cardinality(ps) = 1 then return jsonb_build_object('person', ps[1], 'rule', 'email'); end if;
  if cardinality(ps) > 1 then return jsonb_build_object('rule', 'ambiguous', 'candidates', to_jsonb(ps)); end if;
  -- (b) the call the recorder hosted, booked around the recording start, not canceled, not linked to another recording;
  -- 032: several people (back-to-back calls) → the one whose call starts closest to the recording, when it starts within
  -- fathom_close_minutes (15) of it and nobody else's does
  with cand as (select coalesce(p.merged_into, p.id) pid, min(abs(extract(epoch from k.scheduled_start - rstart))) d
    from crm_calls k join crm_cycles c on c.id = k.cycle_id join crm_people p on p.id = c.person_id
   where k.fathom_recording_id is null and k.status <> 'canceled' and k.scheduled_start is not null
     and abs(extract(epoch from k.scheduled_start - rstart)) <= win * 60
     and (exists (select 1 from crm_events b where b.call_id = k.id and b.type in ('call_booked', 'call_rescheduled')
                   and lower(b.data->>'host_email') = recorder)
          or exists (select 1 from crm_members m where m.id = k.host_id
                      and recorder in (lower(m.email::text), lower(m.fathom_email::text), lower(m.iclosed_email::text))))
   group by 1)
  select coalesce(array_agg(pid order by d), '{}'), coalesce(array_agg(d order by d), '{}') into ps, ds from cand;
  if cardinality(ps) = 1 then return jsonb_build_object('person', ps[1], 'rule', 'booking'); end if;
  if cardinality(ps) > 1 and ds[1] <= close * 60 and ds[2] > close * 60 then
    return jsonb_build_object('person', ps[1], 'rule', 'booking_closest');
  end if;
  if cardinality(ps) > 1 then return jsonb_build_object('rule', 'ambiguous', 'candidates', to_jsonb(ps)); end if;
  -- (c) a full name (two words or more) equal to the person's
  select coalesce(array_agg(distinct p.id), '{}') into ps from crm_people p
   where p.merged_into is null and crm_norm_name(p.full_name) like '% %'
     and crm_norm_name(p.full_name) in (select crm_norm_name(x) from jsonb_array_elements_text(coalesce(it#>'{data,names}', '[]')) x);
  if cardinality(ps) = 1 then return jsonb_build_object('person', ps[1], 'rule', 'name'); end if;
  if cardinality(ps) > 1 then return jsonb_build_object('rule', 'ambiguous', 'candidates', to_jsonb(ps)); end if;
  return '{}'::jsonb;
end $$;

-- a recording that may be this call: long enough, still ambiguous, naming the call's person, around the call's start
create or replace function crm_call_has_ambiguous_recording(p_call uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from crm_calls k join crm_cycles c on c.id = k.cycle_id join crm_fathom_recordings f on c.person_id = any(f.candidates)
    where k.id = p_call and f.status = 'ambiguous' and k.scheduled_start is not null
      and f.ended_at - f.recorded_at >= make_interval(mins => coalesce(crm_no_show_setting('min_minutes')::int, 7))
      and abs(extract(epoch from f.recorded_at - k.scheduled_start)) <= coalesce((select (value #>> '{}')::int from crm_settings where key = 'fathom_match_minutes'), 90) * 60)
$$;

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
      continue when k.status in ('canceled', 'missed') or (k.status = 'no_show' and not seen)
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
              jsonb_build_object('rule', 'no_fathom_recording', 'min_minutes', coalesce(crm_no_show_setting('min_minutes')::int, 7)),
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

-- the no-shows 030 set on a call that an ambiguous recording may be: back to "outcome to declare"
do $$ declare k record; cs uuid[] := '{}'; begin
  for k in select kk.id, kk.cycle_id from crm_calls kk
            where kk.status = 'no_show' and exists (select 1 from crm_events e where e.source = 'rules' and e.source_id = 'noshow:' || kk.id)
              and crm_call_has_ambiguous_recording(kk.id) loop
    update crm_calls set status = 'scheduled' where id = k.id;
    delete from crm_events where source = 'rules' and source_id = 'noshow:' || k.id;
    cs := cs || k.cycle_id;
  end loop;
  perform crm_recompute_cycle(x) from (select distinct unnest(cs) x) y;
end $$;

-- a complete call needs 30 minutes of recording (Romain 2026-10-31)
update crm_settings set value = value || '{"min_minutes": 30}'::jsonb where key = 'no_show_rule';
do $$ declare c record; begin
  for c in select distinct cycle_id id from crm_calls where recorded_by is not null loop perform crm_rank_calls(c.id); end loop;
end $$;

-- a call canceled to be moved: its iClosed reason says so (rescheduling, a new or better time, "corresponding with…")
create or replace function crm_call_is_reschedule(p_call uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select coalesce(e.data->>'cancel_reason', e.data->>'reason', '') ~* 'resched|new time|better time|correspond|organi[sz]ing a new|moving accordingly'
                     from crm_events e where e.call_id = p_call and e.type = 'call_canceled' order by e.occurred_at desc limit 1), false)
      or exists (select 1 from crm_events e where e.call_id = p_call and e.type = 'call_rescheduled')
$$;

-- the Sales cockpit window of 017 with the lead counts
create or replace function crm_sales_cockpit_window(p_from timestamptz, p_to timestamptz, p_ids uuid[], p_people_all boolean, p_owner uuid default null, p_all boolean default true)
returns jsonb language sql stable security definer set search_path = public as $$
  with
  cy as (select * from crm_cycles where id = any(p_ids) and (p_all or owner_id is not distinct from p_owner)),
  ppl as (select count(*) n from crm_people p where p.merged_into is null and p.first_seen_at >= p_from and p.first_seen_at < p_to
            and ((p_all and p_people_all) or exists (select 1 from cy where cy.person_id = p.id))),
  bk as (select count(*) n from crm_events e join cy on cy.id = e.cycle_id where e.type = 'call_booked' and e.occurred_at >= p_from and e.occurred_at < p_to),
  ca as (select count(*) filter (where k.status = 'held') held, count(*) filter (where k.status = 'no_show') ns,
                count(*) filter (where k.status = 'scheduled' and k.scheduled_start < now()) pend
           from crm_calls k join cy on cy.id = k.cycle_id where k.scheduled_start >= p_from and k.scheduled_start < p_to),
  wn as (select count(*) n from cy where cy.status = 'won' and cy.closed_at >= p_from and cy.closed_at < p_to),
  dl as (select coalesce(sum(d.amount_sold), 0) signed, count(*) filter (where d.amount_sold > 0) n
           from crm_deals d join cy on cy.id = d.cycle_id where d.yes_at >= p_from and d.yes_at < p_to),
  pay as (select coalesce(sum(p.amount), 0) got, coalesce(sum(p.refunded_amount), 0) back
            from crm_payments p join cy on cy.id = p.cycle_id where p.paid_at >= p_from and p.paid_at < p_to),
  fu as (select count(*) total,
                count(*) filter (where exists (select 1 from crm_events e where e.cycle_id = k.cycle_id
                  and ((e.type = 'message_out' and e.actor = 'sales') or e.type = 'note' or e.type like 'outcome\_%')
                  and e.occurred_at >= coalesce(k.scheduled_end, k.scheduled_start)
                  and e.occurred_at < coalesce(k.scheduled_end, k.scheduled_start) + interval '24 hours')) done
           from crm_calls k join cy on cy.id = k.cycle_id where k.status = 'held' and k.scheduled_start >= p_from and k.scheduled_start < p_to),
  -- 032 (Romain 2026-10-31): leads, not calls. A lead with a call due in the period showed if it ever had a complete sales call
  -- (Fathom recording of no_show_rule.min_minutes = 30 or more, or a transcript added by hand); a lead whose call is booked
  -- ahead or whose last call was canceled to be rescheduled is pending (neither showed nor no-show); every other lead: no-show
  ld as (select cy.id,
           exists (select 1 from crm_calls k where k.cycle_id = cy.id and crm_call_complete(k) and coalesce(k.recording_start, k.scheduled_start) <= now()) shown,
           exists (select 1 from crm_calls k where k.cycle_id = cy.id and k.status = 'scheduled' and k.scheduled_start > now())
             or coalesce((select k.status = 'canceled' and crm_call_is_reschedule(k.id) from crm_calls k where k.cycle_id = cy.id
                           order by k.scheduled_start desc nulls last limit 1), false) pending
           from cy where exists (select 1 from crm_calls k where k.cycle_id = cy.id and k.scheduled_start >= p_from and k.scheduled_start < p_to and k.scheduled_start < now())),
  st as (select percentile_cont(0.5) within group (order by h.hours) / 24 med
           from crm_stage_history h join cy on cy.id = h.cycle_id where h.exited_at >= p_from and h.exited_at < p_to and h.hours is not null)
  select jsonb_build_object(
    'leads', (select n from ppl), 'booked', (select n from bk), 'held', (select held from ca), 'no_show', (select ns from ca), 'no_outcome', (select pend from ca),
    'shown_leads', (select count(*) from ld where shown), 'no_show_leads', (select count(*) from ld where not shown and not pending),
    'pending_leads', (select count(*) from ld where not shown and pending),
    'won', (select n from wn), 'signed', (select signed from dl), 'deals', (select n from dl),
    'cash', (select got - back from pay), 'received', (select got from pay), 'refunded', (select back from pay),
    'follow_total', (select total from fu), 'follow_done', (select done from fu), 'days_per_stage', (select round(med::numeric, 1) from st))
$$;
revoke execute on function crm_sales_cockpit_window(timestamptz, timestamptz, uuid[], boolean, uuid, boolean) from public, anon, authenticated;
