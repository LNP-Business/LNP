-- 051 · LNP à l'heure de Paris (Romain 2026-11-09 : « je veux que tu mettes pour LNP le fuseau horaire Paris »). Les alertes
-- SLA (sla-tick et l'écran Cycle de vente) comptaient la plage du commercial (8 h – 22 h) et les heures d'envoi automatique à
-- l'heure de New York, réglage hérité d'un autre projet. Peut être rejoué.
update crm_settings set value = jsonb_set(value, '{window_tz}', '"Europe/Paris"'), updated_at = now()
 where key = 'sla_alerts';
