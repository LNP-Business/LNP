-- 044 · Sales cycle SLAs in Settings › Alerts (Romain, 2026-11-05: « un bouton de sauvegarde de la configuration à côté de
-- Terminé » and « toutes les alertes manquantes liées à la gestion des leads en terme de SLA »).
-- Settings › Alerts lists the 42 SLAs of the reference v3 (catalogue: supabase/functions/_shared/sla_rules.js) and saves
-- here what an admin changes; the Sales cycle screen (skl-os/crm/data.js › slaRules) and sla-tick (crm_sla_settings) both
-- apply it through SKL_SLA.configure:
--   crm_settings.sla_rules = {sources: {messages, whop, analysis}, rules: {"SH-2": {on, warn, late, crit, app, slack}, …}}
-- sources: the data an SLA needs beyond iClosed and Fathom. On 2026-11-05 no message (Sendblue), no Whop link and no automatic
-- analysis reaches the CRM: their SLAs are off until an admin marks the source connected (otherwise every lead was Critical:
-- 171 of 171, SH-2 « no first message » and DE-1 « no recap » on every lead). Thresholds in hours (DE-8: calls).
-- Idempotent.

insert into crm_settings (key, value, is_proposal)
values ('sla_rules', '{"sources": {"messages": false, "whop": false, "analysis": false}, "rules": {}}', false)
on conflict (key) do nothing;

-- sla-tick reads the Slack settings and, under sla_rules, the SLA settings (service role only, as in 028)
create or replace function crm_sla_settings() returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce((select value from crm_settings where key = 'sla_alerts'), '{}'::jsonb)
         || jsonb_build_object('sla_rules', coalesce((select value from crm_settings where key = 'sla_rules'), '{}'::jsonb))
$$;
revoke execute on function crm_sla_settings() from public, anon, authenticated;
grant execute on function crm_sla_settings() to service_role;

-- Settings › Alerts saves the SLA settings: an admin or the sales lead; the shape is checked, then crm_update_config (004)
-- writes it and keeps the audit line
create or replace function crm_save_sla_rules(p_value jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare k text; v jsonb; f text;
begin
  if jsonb_typeof(p_value) <> 'object' then raise exception 'Réglages des SLA : un objet est attendu' using errcode = '22023'; end if;
  if p_value ? 'sources' then
    if jsonb_typeof(p_value->'sources') <> 'object' then raise exception 'Réglages des SLA : sources invalides' using errcode = '22023'; end if;
    for k, v in select * from jsonb_each(p_value->'sources') loop
      if k not in ('messages', 'whop', 'analysis') or jsonb_typeof(v) <> 'boolean' then
        raise exception 'Réglages des SLA : source inconnue ou invalide (%)', k using errcode = '22023';
      end if;
    end loop;
  end if;
  if p_value ? 'rules' then
    if jsonb_typeof(p_value->'rules') <> 'object' then raise exception 'Réglages des SLA : règles invalides' using errcode = '22023'; end if;
    for k, v in select * from jsonb_each(p_value->'rules') loop
      if k !~ '^(SH|DE|CA|CO|CL|DO)-[0-9]{1,2}$' or jsonb_typeof(v) <> 'object' then
        raise exception 'Réglages des SLA : règle inconnue (%)', k using errcode = '22023';
      end if;
      for f in select jsonb_object_keys(v) loop
        if f in ('on', 'app', 'slack') then
          if jsonb_typeof(v->f) <> 'boolean' then raise exception 'Réglages des SLA : % de % doit être vrai ou faux', f, k using errcode = '22023'; end if;
        elsif f in ('warn', 'late', 'crit') then
          if jsonb_typeof(v->f) <> 'number' or (v->>f)::numeric < 0 or (v->>f)::numeric > 8760 then
            raise exception 'Réglages des SLA : seuil % de % invalide', f, k using errcode = '22023';
          end if;
        else
          raise exception 'Réglages des SLA : champ inconnu % pour %', f, k using errcode = '22023';
        end if;
      end loop;
    end loop;
  end if;
  perform crm_update_config('crm_settings', 'sla_rules',
    jsonb_build_object('sources', coalesce(p_value->'sources', '{}'::jsonb), 'rules', coalesce(p_value->'rules', '{}'::jsonb)));
  return (select value from crm_settings where key = 'sla_rules');
end $$;
revoke execute on function crm_save_sla_rules(jsonb) from public, anon;
grant execute on function crm_save_sla_rules(jsonb) to authenticated;
