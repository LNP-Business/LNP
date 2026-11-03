-- LNP CRM — imported cycles read again with the corrected rules (web/supabase/013_crm_reclassify.sql), after 012.
-- Romain, 2026-10-25: won leads showed as disqualified or lost. iClosed almost never records a sale, and its REJECTED
-- outcome goes with a canceled discovery call (178 canceled by the team, 43 by the lead), not with a disqualification.
-- Rules, for every cycle closed or opened by an import (never one with a declared outcome or a payment):
--   won          Close "Customer" or a won Close opportunity, an onboarding or case-study call ("…Onboarding Call",
--                "Case Studies…"), or a WON outcome in iClosed
--   disqualified iClosed contact status DISQUALIFIED, or the person's latest call ended UNQUALIFIED, BAD_FIT, or
--                REJECTED without a cancellation, with no call after it
--   active       a call ahead, or the latest call less than 30 days ago
--   lost         otherwise (reason unreachable after a no-show, timing otherwise)
-- crm_reclassify_imported(true) returns the moves (from → to) and changes nothing. Safe to run again.

create or replace function crm_reclassify_imported(p_dry boolean default true)
returns jsonb language plpgsql security definer set search_path = public as $$
declare cy record; won_at timestamptz; dq_at timestamptz; last record; ahead boolean; nst text; nreason text; nat timestamptz;
        moves jsonb := '{}'; k text; pid uuid;
begin
  begin
    for cy in
      select c.* from crm_cycles c
       where exists (select 1 from crm_events e where e.cycle_id = c.id and e.source = 'import')
         and not exists (select 1 from crm_call_outcomes o join crm_calls k on k.id = o.call_id where k.cycle_id = c.id)
         and not exists (select 1 from crm_events e where e.cycle_id = c.id and e.type = 'payment_succeeded')
    loop
      pid := cy.person_id;
      -- won
      select min(at) into won_at from (
        select e.occurred_at as at from crm_events e where e.person_id = pid and e.type = 'imported'
           and e.source_id not like 'import:import:iclosed:%'
           and (e.data->>'status_label' = 'Customer'
                or exists (select 1 from jsonb_array_elements(coalesce(e.data->'opportunities', '[]')) o where o->>'status_type' = 'won'))
        union all
        select coalesce(k.scheduled_start, e.occurred_at) from crm_events e left join crm_calls k on k.id = e.call_id
         where e.cycle_id = cy.id and e.type = 'call_booked'
           and (e.data->>'event_name' ilike '%onboarding%' or e.data->>'event_name' ilike '%case stud%' or e.data->>'iclosed_outcome' = 'WON')) w;
      -- the latest call of the cycle, with its iClosed result
      select k.scheduled_start, k.status, e.data->>'iclosed_outcome' as outcome, e.data->>'no_sale_reason' as nsr into last
        from crm_calls k left join crm_events e on e.call_id = k.id and e.type = 'call_booked'
       where k.cycle_id = cy.id order by k.scheduled_start desc nulls last limit 1;
      ahead := exists (select 1 from crm_calls k where k.cycle_id = cy.id and k.status = 'scheduled' and k.scheduled_start > now());
      dq_at := null;
      if exists (select 1 from crm_events e where e.person_id = pid and e.type = 'imported'
                  and e.source_id like 'import:import:iclosed:%' and e.data->>'status_label' = 'DISQUALIFIED') then
        dq_at := coalesce(last.scheduled_start, cy.opened_at);
      elsif last.scheduled_start is not null and (last.nsr in ('UNQUALIFIED', 'BAD_FIT')
            or (last.outcome = 'REJECTED' and coalesce(last.nsr, '') not in ('ADMIN_CANCELLED', 'CONTACT_CANCELLED'))) then
        dq_at := last.scheduled_start;
      end if;
      if won_at is not null then nst := 'won'; nreason := null; nat := won_at;
      elsif dq_at is not null then nst := 'disqualified'; nreason := 'dq_off_target'; nat := dq_at;
      elsif ahead or (last.scheduled_start is not null and last.scheduled_start > now() - interval '30 days') then nst := 'active'; nreason := null; nat := null;
      elsif last.scheduled_start is null then nst := cy.status::text; nreason := cy.close_reason; nat := cy.closed_at;   -- no call, nothing to read
      else nst := 'lost'; nreason := case when last.status = 'no_show' or last.nsr = 'NO_SHOW' then 'unreachable' else 'timing' end; nat := last.scheduled_start;
      end if;
      if nst = 'active' and exists (select 1 from crm_cycles x where x.person_id = pid and x.status = 'active' and x.id <> cy.id) then
        nst := 'lost'; nreason := 'timing'; nat := coalesce(last.scheduled_start, cy.opened_at);   -- one active cycle per person
      end if;
      k := cy.status::text || ' → ' || nst;
      moves := jsonb_set(moves, array[k], to_jsonb(coalesce((moves->>k)::int, 0) + 1));
      if nst = cy.status::text and coalesce(nreason, '') = coalesce(cy.close_reason, '') then continue; end if;
      delete from crm_events where cycle_id = cy.id and source in ('import', 'crm') and type in ('cycle_won', 'cycle_lost', 'cycle_disqualified');
      if nst <> 'active' then
        insert into crm_events (person_id, cycle_id, occurred_at, actor, channel, type, data, source, source_id)
        values (pid, cy.id, nat, 'system', 'crm', 'cycle_' || nst, jsonb_build_object('reason', nreason, 'from', 'import history (013)'),
                'import', 'import:close:' || cy.id)
        on conflict (source, source_id) do update set type = excluded.type, data = excluded.data, occurred_at = excluded.occurred_at;
      end if;
      update crm_cycles set status = nst::cycle_status, closed_at = nat, close_reason = case when nst in ('lost', 'disqualified') then nreason end
       where id = cy.id;
      perform crm_recompute_cycle(cy.id);
    end loop;
    if p_dry then raise exception 'dry run' using errcode = 'P0D01'; end if;
  exception when sqlstate 'P0D01' then
    null;
  end;
  return moves;
end $$;
revoke execute on function crm_reclassify_imported(boolean) from public, anon, authenticated;
grant execute on function crm_reclassify_imported(boolean) to service_role;
