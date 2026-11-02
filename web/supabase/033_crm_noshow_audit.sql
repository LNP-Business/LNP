-- 033: the no-show audit of 2026-11-01 (Romain: "vérifie si le taux de no show est fiable à 98 %"). On the 99 leads of the last
-- 30 days, 6 leads who came were counted as no-shows:
--   * a won lead whose call was recorded by another account (success@): a won lead always came;
--   * 5 leads booked on the same slot as another lead (a tie, the recording stayed ambiguous) whose call the sales rep had
--     declared held: the recording is theirs (rule booking_declared).
-- After this file, the Fathom history is imported again (crm-import ?source=fathom&since=2026-06-14).

alter table crm_fathom_recordings drop constraint if exists crm_fathom_recordings_rule_check;
alter table crm_fathom_recordings add constraint crm_fathom_recordings_rule_check check (rule in ('known', 'email', 'booking', 'booking_closest', 'booking_declared', 'name'));

create or replace function crm_fathom_person(it jsonb) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare ps uuid[]; e text; rstart timestamptz := coalesce(nullif(it#>>'{data,start}', '')::timestamptz, (it->>'occurred_at')::timestamptz);
        recorder text := lower(it#>>'{refs,recorder_email}'); win int; close int; ds numeric[]; held uuid[];
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
  -- 033: a tie (two people booked on the same slot): the one whose call the sales rep declared held takes the recording
  if cardinality(ps) > 1 and ds[1] <= close * 60 then
    select coalesce(array_agg(distinct coalesce(p.merged_into, p.id)), '{}') into held
      from crm_calls k join crm_cycles c on c.id = k.cycle_id join crm_people p on p.id = c.person_id
     where coalesce(p.merged_into, p.id) = any(ps) and k.fathom_recording_id is null
       and abs(extract(epoch from k.scheduled_start - rstart)) <= close * 60
       and exists (select 1 from crm_call_outcomes oc where oc.call_id = k.id and oc.superseded_at is null and oc.attendance = 'held');
    if cardinality(held) = 1 then return jsonb_build_object('person', held[1], 'rule', 'booking_declared'); end if;
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

-- the Sales cockpit window: a won lead counts as shown
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
           (cy.status = 'won' or exists (select 1 from crm_calls k where k.cycle_id = cy.id and crm_call_complete(k) and coalesce(k.recording_start, k.scheduled_start) <= now())) shown,
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
