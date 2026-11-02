-- 029: R1, R2, R3 follow the analysed calls only (Romain 2026-10-31: "un R2 ou R3 ne peut exister que s'il y a eu une
-- analyse d'appel"). A call takes a new number only once it can be analysed: it has a Fathom recording (025) or a transcript
-- (020). Every other call (booked, rescheduled, canceled, no-show, past with no recording) keeps the next number: a canceled or
-- rescheduled R1 and its new booking are both R1, and an R2 exists only after an R1 with a recording or a transcript.
-- 025's crm_rank_calls did this only for cycles with a recording; the others kept iClosed's "max + 1" (005, 009) at every booking.

create or replace function crm_rank_calls(p_cycle uuid) returns void
language plpgsql security definer set search_path = public as $$
declare k record; n int := 0; r int;
begin
  for k in select id, rank, (recorded_by is not null or coalesce(transcript_raw, '') <> '') as counts from crm_calls where cycle_id = p_cycle
            order by coalesce(recording_start, scheduled_start, created_at), created_at, id loop
    if k.counts then n := n + 1; r := n; else r := n + 1; end if;
    if k.rank is distinct from r then update crm_calls set rank = r where id = k.id; end if;
  end loop;
end $$;
revoke execute on function crm_rank_calls(uuid) from public, anon, authenticated;
grant execute on function crm_rank_calls(uuid) to service_role;

-- also when a transcript is added (crm_ca_add_transcript)
drop trigger if exists crm_calls_rank on crm_calls;
create trigger crm_calls_rank after insert or update of scheduled_start, recording_start, recorded_by, transcript_raw, cycle_id on crm_calls
  for each row when (pg_trigger_depth() < 1) execute function crm_calls_rank_trigger();

-- every cycle once, then the live ones' next move ("Call R2" → "Call R1")
do $$ declare c record; begin
  for c in select id from crm_cycles loop perform crm_rank_calls(c.id); end loop;
  for c in select id from crm_cycles where status = 'active' loop perform crm_recompute_cycle(c.id); end loop;
end $$;
