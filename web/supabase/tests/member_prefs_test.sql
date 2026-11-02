-- 031_crm_member_prefs.sql: each user keeps their own settings.
do $$
declare a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); refused boolean := false;
begin
  perform set_config('request.jwt.claim.sub', a::text, true);
  perform crm_set_pref('crm.pipeline.cols', '["r2","r1"]');
  perform set_config('request.jwt.claim.sub', b::text, true);
  assert crm_get_pref('crm.pipeline.cols') is null, 'another user does not see it';
  perform crm_set_pref('crm.pipeline.cols', '["noshow"]');
  perform set_config('request.jwt.claim.sub', a::text, true);
  assert crm_get_pref('crm.pipeline.cols') = '["r2","r1"]'::jsonb, 'each keeps their own';
  perform crm_set_pref('crm.pipeline.cols', '["r1","r2"]');
  assert crm_get_pref('crm.pipeline.cols') = '["r1","r2"]'::jsonb, 'updated';
  perform crm_set_pref('crm.pipeline.cols', 'null');
  assert crm_get_pref('crm.pipeline.cols') is null, 'reset';
  perform set_config('request.jwt.claim.sub', '', true);
  begin perform crm_set_pref('x', '1'); exception when others then refused := true; end;
  assert refused, 'signed out: refused';
end $$;
select 'member prefs SQL checks: all passed';
