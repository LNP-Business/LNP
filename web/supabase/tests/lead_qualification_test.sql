-- 042_crm_lead_qualification.sql: candidates (latest R1 per lead, team test records out) and storage.
do $$
declare pid uuid; pid2 uuid; c1 uuid; c2 uuid; k1 uuid; k2 uuid; j jsonb;
begin
  insert into crm_people (full_name) values ('Qualif Lead') returning id into pid;
  insert into crm_cycles (person_id, opened_at) values (pid, now() - interval '5 days') returning id into c1;
  insert into crm_people (full_name) values ('Qualif Test Interne') returning id into pid2;
  insert into crm_person_identities (person_id, kind, value, source) values (pid2, 'email', 'qualif@lesnouveauxprofs.fr', 'import');
  insert into crm_cycles (person_id, opened_at) values (pid2, now() - interval '5 days') returning id into c2;
  alter table crm_calls disable trigger user;
  insert into crm_calls (cycle_id, rank, scheduled_start, status, recorded_by, recording_start, transcript, iclosed_call_id)
  values (c1, 1, now() - interval '2 days', 'held', 'sam@lesnouveauxprofs.fr', now() - interval '2 days', '[{"text":"Bonjour"}]', 'q-1')
  returning id into k1;
  insert into crm_calls (cycle_id, rank, scheduled_start, status) values (c2, 1, now() - interval '1 day', 'held') returning id into k2;
  alter table crm_calls enable trigger user;
  insert into crm_events (person_id, cycle_id, occurred_at, actor, channel, type, data, source, source_id)
  values (pid, c1, now() - interval '3 days', 'prospect', 'booking', 'call_booked',
          '{"iclosed_call_id":"q-1","iclosed_outcome":"NO_SALE","no_sale_reason":"UNQUALIFIED"}', 'import', 'import:qualif:1');
  j := crm_qualif_candidates(50, false);
  assert exists (select 1 from jsonb_array_elements(j) x where x->>'call_id' = k1::text and x #>> '{saisie,no_sale_reason}' = 'UNQUALIFIED'
                 and x->'transcript' is not null), 'the lead with its transcript and its iClosed outcome: ' || j;
  assert not exists (select 1 from jsonb_array_elements(j) x where x->>'call_id' = k2::text), 'team test records left out';
  perform crm_qualif_store(k1, 'NON SQL', '{"statut":"NON SQL"}', '[]', '[]', '{}', 'lnp-sql-v2-2026-11-04', 'v2');
  assert (select status from crm_lead_qualifications where call_id = k1) = 'NON SQL', 'stored';
  j := crm_qualif_candidates(50, false, 'lnp-sql-v2-2026-11-04');
  assert not exists (select 1 from jsonb_array_elements(j) x where x->>'call_id' = k1::text), 'already qualified with this version';
  j := crm_qualif_candidates(50, false);
  assert exists (select 1 from jsonb_array_elements(j) x where x->>'call_id' = k1::text), 'a new prompt version (2.1, 046) qualifies it again';
  j := crm_qualif_candidates(50, true);
  assert exists (select 1 from jsonb_array_elements(j) x where x->>'call_id' = k1::text), 'again on request';
  assert not has_function_privilege('authenticated', 'crm_qualif_candidates(int, boolean, text)', 'execute'), 'service role only';
end $$;
select 'lead qualification SQL checks: all passed';
