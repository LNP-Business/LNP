-- LNP CRM — cycles from the imported history (web/supabase/008_crm_import_cycles.sql), after 007 and the 005 projector
-- that reads `source = 'import'` closing events. A person imported from iClosed with the status DISQUALIFIED gets one
-- closed cycle with the CRM's own status `disqualified` (reason dq_off_target: iClosed disqualifies on its qualification
-- form), so the methodology reads it like any disqualification. People who already have a cycle are left alone; a new
-- booking later opens a new cycle as usual. A dry run is rolled back and returns counts only. Safe to run again.

create or replace function crm_import_iclosed_disqualified(p_dry boolean default true)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r record; cid uuid; n int := 0; has_cycle int := 0;
begin
  begin
    for r in
      select distinct on (pid) pid, at from (
        select coalesce(p.merged_into, p.id) as pid, e.occurred_at as at
          from crm_events e join crm_people p on p.id = e.person_id
         where e.type = 'imported' and e.source = 'import' and e.source_id like 'import:import:iclosed:%'
           and e.data->>'status_label' = 'DISQUALIFIED') x
      order by pid, at desc
    loop
      if exists (select 1 from crm_cycles where person_id = r.pid) then has_cycle := has_cycle + 1; continue; end if;
      insert into crm_cycles (person_id, status, origin, opened_at, closed_at, close_reason)
      values (r.pid, 'disqualified', 'new', r.at, r.at, 'dq_off_target') returning id into cid;
      insert into crm_events (person_id, cycle_id, occurred_at, actor, channel, type, data, source, source_id)
      values (r.pid, cid, r.at, 'system', 'crm', 'cycle_disqualified',
              jsonb_build_object('reason', 'dq_off_target', 'from', 'iclosed status DISQUALIFIED'), 'import', 'import:dq:' || r.pid)
      on conflict (source, source_id) do nothing;
      perform crm_recompute_cycle(cid);
      n := n + 1;
    end loop;
    if p_dry then raise exception 'dry run' using errcode = 'P0D01'; end if;
  exception when sqlstate 'P0D01' then
    null;   -- dry run: everything above is rolled back, the counts stay
  end;
  return jsonb_build_object('created', n, 'already_had_a_cycle', has_cycle, 'dry', p_dry);
end $$;

revoke execute on function crm_import_iclosed_disqualified(boolean) from public, anon, authenticated;
grant execute on function crm_import_iclosed_disqualified(boolean) to service_role;
