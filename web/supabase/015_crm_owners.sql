-- SKL OS CRM — each lead goes to its sales rep (web/supabase/015_crm_owners.sql), after 014.
-- The imports opened every cycle with no owner: iClosed's calls were hosted by sales reps (valentino@…, paul@…) who had no
-- SKL OS account, and crm_owner_for (005) only finds CRM members. Now a cycle with no owner takes the member whose email,
-- or iclosed_email, is the host of its latest booked call (event call_booked, data.host_email); its calls with that host get
-- host_id too. It runs for every cycle with no owner now (crm_assign_owners_from_hosts) and again on its own whenever a CRM
-- member is added or their email / iclosed_email changes (trigger), so inviting Valentino to SKL OS hands him his leads.
-- An owner already set is never changed. A dry run is rolled back and returns counts only. Safe to run again.

create or replace function crm_assign_owners_from_hosts(p_dry boolean, p_member uuid default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare st jsonb := '{}'; r record; n_cycles int := 0; n_calls int := 0;
begin
  begin
    for r in
      with hosts as (   -- the host of each owner-less cycle's latest booked call
        select distinct on (e.cycle_id) e.cycle_id, lower(trim(e.data->>'host_email')) as host
          from crm_events e join crm_cycles c on c.id = e.cycle_id
         where c.owner_id is null and e.type = 'call_booked' and coalesce(e.data->>'host_email', '') <> ''
         order by e.cycle_id, e.occurred_at desc)
      select h.cycle_id, h.host, m.id as member_id, m.member_key
        from hosts h join crm_members m on m.active and (m.email = h.host::citext or m.iclosed_email = h.host::citext)
       where p_member is null or m.id = p_member
    loop
      update crm_cycles set owner_id = r.member_id where id = r.cycle_id and owner_id is null;
      n_cycles := n_cycles + 1;
      st := jsonb_set(st, array[r.member_key], to_jsonb(coalesce((st->>r.member_key)::int, 0) + 1));
    end loop;
    -- calls: host_id from the host of their own booking event
    update crm_calls k set host_id = m.id
      from crm_events e, crm_members m
     where k.host_id is null and e.call_id = k.id and e.type = 'call_booked'
       and m.active and (m.email = lower(trim(e.data->>'host_email'))::citext or m.iclosed_email = lower(trim(e.data->>'host_email'))::citext)
       and (p_member is null or m.id = p_member);
    get diagnostics n_calls = row_count;
    st := jsonb_build_object('cycles', n_cycles, 'calls', n_calls, 'by_member', st,
      'still_unassigned', (select count(*) from crm_cycles where owner_id is null),
      'still_unassigned_live', (select count(*) from crm_cycles where owner_id is null and status = 'active'));
    if p_dry then raise exception 'dry run' using errcode = 'P0D01'; end if;
  exception when sqlstate 'P0D01' then
    null;   -- dry run: rolled back, the counts stay
  end;
  return st;
end $$;
revoke execute on function crm_assign_owners_from_hosts(boolean, uuid) from public, anon, authenticated;

-- a member added (an invitation) or whose email / iclosed_email changed takes the owner-less cycles they hosted
create or replace function crm_members_take_their_leads() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.active then perform crm_assign_owners_from_hosts(false, new.id); end if;
  return new;
end $$;
revoke execute on function crm_members_take_their_leads() from public, anon, authenticated;
drop trigger if exists crm_members_take_leads on crm_members;
create trigger crm_members_take_leads after insert or update of email, iclosed_email, active on crm_members
  for each row execute function crm_members_take_their_leads();

-- the cycles of the people who already have an account (Amin hosted a few calls)
select crm_assign_owners_from_hosts(false);
