-- 050 · Cockpit commercial : les onglets Exécution, Qualité et Impact (Romain 2026-11-09, tout en français) :
-- · l'appel de vente est le premier appel tenu du cycle (chez LNP, le R1 est l'appel de vente) ;
--   tous les appels de LNP sont des appels de vente (pas de crm_calls.kind) ;
-- · vente « gagnée » pour ces onglets = un premier paiement dans les 14 jours après la fin de ce premier appel tenu, lu sur les appels
--   d'au moins 14 jours ; les paiements de LNP viennent d'iClosed (crm_payments), nets des remboursements ;
-- · qualifié = la qualification de LNP (portes 2.2, crm_lead_qualifications, 042 / 046), la plus récente du cycle : SQL GAGNÉ, SQL
--   OUVERT ou SQL PERDU = qualifié, NON SQL = non qualifié ; sans lecture (ou MQL EN ATTENTE, À REVOIR) : « inconnu
--   compte comme qualifié », c'est-à-dire qualifié sauf cycle disqualifié ;
-- · les délais et leurs cibles sont les SLA de LNP (supabase/functions/_shared/sla_rules.js : SH-2, SH-3, SH-8, SH-9, SH-11, DE-1,
--   DE-9, CA-2, CA-6, CO-1) ; l'appel après un R1 sans décision reste une bonne pratique ;
-- · la plage d'un commercial pour répondre est 8 h – 22 h, heure de Paris ;
-- · un contact commercial = un message, un e-mail ou un appel envoyé par une personne de l'équipe (acteur 'sales'), jamais un texte
--   automatique. Sans Sendblue branché, ces délais restent vides.
-- crm_sales_execution(p_days, p_owner) : security definer, refuse une personne sans rôle CRM, ne lit que les cycles que la personne
-- voit (tous pour un administrateur, sinon les siens, 048). Chaque taux vient avec son effectif ; l'écran marque « indicatif » un taux
-- calculé sur moins de 20 prospects. Impact = corrélation, jamais preuve. Peut être rejoué.

create or replace function crm_sales_exec_window(p_from timestamptz, p_ids uuid[]) returns jsonb
language sql stable security definer set search_path = public as $$
  with
  cy as (select c.* from crm_cycles c where c.id = any(p_ids)),
  touch as (   -- les contacts humains de l'équipe, par personne
    select e.person_id, e.occurred_at, e.type::text type from crm_events e
     where e.actor::text = 'sales' and e.type::text in ('message_out', 'email_out', 'phone_call_out')
       and e.person_id in (select person_id from cy)),
  inbound as (
    select e.person_id, e.cycle_id, e.occurred_at from crm_events e
     where e.actor::text = 'prospect' and e.type::text in ('message_in', 'email_in', 'phone_call_in')
       and e.occurred_at >= p_from and e.person_id in (select person_id from cy)),
  -- la qualification la plus récente de chaque cycle (portes 2.2)
  qual as (
    select distinct on (q.cycle_id) q.cycle_id, q.status verdict, q.result
      from crm_lead_qualifications q where q.cycle_id = any(p_ids)
     order by q.cycle_id, q.created_at desc, q.id desc),
  -- cohorte des appels prévus : les cycles dont le premier appel (non annulé) a lieu dans la période et est passé
  bk as (
    select distinct on (k.cycle_id) k.cycle_id, k.id call_id, k.scheduled_start s,
           (select min(e.occurred_at) from crm_events e where e.call_id = k.id and e.type::text = 'call_booked') booked_at
      from crm_calls k join cy on cy.id = k.cycle_id
     where k.status::text <> 'canceled' and k.scheduled_start >= p_from and k.scheduled_start < now()
     order by k.cycle_id, k.scheduled_start),
  bkf as (
    select bk.*, cy.owner_id, cy.person_id,
           (select min(e.occurred_at) from crm_events e where e.cycle_id = bk.cycle_id and e.type::text = 'call_booked') first_booked
      from bk join cy on cy.id = bk.cycle_id),
  bkd as (
    select bkf.*,
           (select min(t.occurred_at) from touch t where t.person_id = bkf.person_id and t.occurred_at >= bkf.first_booked) first_touch
      from bkf),
  -- cohorte des appels tenus : les cycles dont le premier appel tenu est dans la période
  hd as (
    select distinct on (k.cycle_id) k.cycle_id, k.id call_id, k.scheduled_start s,
           coalesce(k.recording_end, k.scheduled_end, k.scheduled_start + interval '1 hour') e
      from crm_calls k join cy on cy.id = k.cycle_id
     where k.status::text = 'held' and k.scheduled_start >= p_from
     order by k.cycle_id, k.scheduled_start),
  hdf as (
    select hd.*, cy.owner_id, cy.person_id, cy.status, q.verdict qverdict,
           case when q.verdict in ('SQL GAGNÉ', 'SQL OUVERT', 'SQL PERDU') then true when q.verdict = 'NON SQL' then false
                else cy.status::text <> 'disqualified' end qualified,
           (select min(p.paid_at) from crm_payments p where p.cycle_id = hd.cycle_id and p.amount > coalesce(p.refunded_amount, 0)) paid_at,
           (select min(e.occurred_at) from crm_events e where e.call_id = hd.call_id and e.type::text = 'call_booked') booked_at,
           (select min(t.occurred_at) from touch t where t.person_id = cy.person_id and t.type in ('message_out', 'email_out')
              and t.occurred_at >= hd.e and t.occurred_at < hd.e + interval '24 hours') recap_at,
           (select min(t.occurred_at) from touch t where t.person_id = cy.person_id and t.type = 'phone_call_out'
              and t.occurred_at > hd.e and t.occurred_at <= hd.e + interval '72 hours') call_after_at,
           (select min(o.declared_at) from crm_call_outcomes o join crm_calls k2 on k2.id = o.call_id
             where k2.cycle_id = hd.cycle_id and o.superseded_at is null and o.decision::text in ('yes', 'no') and o.declared_at >= hd.s) decided_at,
           (select min(e.occurred_at) from crm_events e where e.cycle_id = hd.cycle_id and e.type::text = 'call_booked') first_booked
      from hd join cy on cy.id = hd.cycle_id left join qual q on q.cycle_id = hd.cycle_id),
  hdx as (
    select hdf.*,
           (hdf.paid_at is not null and hdf.paid_at <= hdf.e + interval '14 days') won14,
           hdf.e < now() - interval '14 days' matured,
           (select min(t.occurred_at) from touch t where t.person_id = hdf.person_id and t.occurred_at >= hdf.first_booked) first_touch,
           (select count(*) from touch t where t.person_id = hdf.person_id and t.occurred_at > hdf.e
              and t.occurred_at <= least(hdf.e + interval '14 days', coalesce(hdf.paid_at, 'infinity'))) touches_after,
           (select count(*) from inbound i where i.person_id = hdf.person_id and i.occurred_at > hdf.e
              and i.occurred_at <= least(hdf.e + interval '14 days', coalesce(hdf.paid_at, 'infinity'))) replies_after
      from hdf),
  -- délai de réponse au prospect, dans la plage 8 h – 22 h, heure de Paris (CO-1)
  rep as (
    select i.person_id, i.occurred_at,
           extract(epoch from ((select min(t.occurred_at) from touch t where t.person_id = i.person_id and t.occurred_at > i.occurred_at) - i.occurred_at)) / 60 mins
      from inbound i
     where extract(hour from i.occurred_at at time zone 'Europe/Paris') between 8 and 21 and i.occurred_at < now() - interval '15 minutes'),
  repc as (select person_id, percentile_cont(0.5) within group (order by coalesce(mins, 1e9)) med from rep group by person_id),
  g as (   -- la cohorte tenue, qualifiée et d'au moins 14 jours : la base de chaque taux de vente
    select hdx.*, r.med reply_med from hdx left join repc r on r.person_id = hdx.person_id where hdx.matured and hdx.qualified),
  -- absences : la première absence d'un cycle dans la période, d'au moins un jour
  ns as (
    select distinct on (k.cycle_id) k.cycle_id, k.scheduled_start t, cy.person_id
      from crm_calls k join cy on cy.id = k.cycle_id
     where k.status::text = 'no_show' and k.scheduled_start >= p_from and k.scheduled_start < now() - interval '1 day'
     order by k.cycle_id, k.scheduled_start),
  nsf as (
    select ns.*,
           (select min(t.occurred_at) from touch t where t.person_id = ns.person_id and t.occurred_at > ns.t) touch_at,
           (select min(e.occurred_at) from crm_events e where e.person_id = ns.person_id and e.type::text = 'call_booked' and e.occurred_at > ns.t) rebook_at,
           exists (select 1 from crm_calls k join crm_cycles c2 on c2.id = k.cycle_id where c2.person_id = ns.person_id and k.status::text = 'held' and k.scheduled_start > ns.t) held_after,
           exists (select 1 from crm_payments p join crm_cycles c2 on c2.id = p.cycle_id where c2.person_id = ns.person_id and p.paid_at > ns.t) won_after
      from ns),
  -- échecs de vente : un appel tenu, qualifié, sans paiement dans les 14 jours, d'au moins 28 jours
  cf as (
    select hdx.cycle_id, hdx.person_id, hdx.e,
           (select min(t.occurred_at) from touch t where t.person_id = hdx.person_id and t.occurred_at > hdx.e + interval '14 days') touch_at,
           (select min(x.at) from (
              select e.occurred_at at from crm_events e where e.person_id = hdx.person_id and e.type::text in ('call_booked', 'cycle_reopened') and e.occurred_at > hdx.e + interval '14 days'
              union all select i.occurred_at from inbound i where i.person_id = hdx.person_id and i.occurred_at > hdx.e + interval '14 days') x) react_at,
           exists (select 1 from crm_payments p join crm_cycles c2 on c2.id = p.cycle_id where c2.person_id = hdx.person_id and p.paid_at > hdx.e + interval '14 days') won_after
      from hdx where hdx.qualified and not hdx.won14 and hdx.e < now() - interval '28 days'),
  yes as (
    select d.cycle_id, d.yes_at, (select min(p.paid_at) from crm_payments p where p.cycle_id = d.cycle_id and p.paid_at >= d.yes_at and p.amount > coalesce(p.refunded_amount, 0)) paid_at
      from crm_deals d join cy on cy.id = d.cycle_id where d.yes_at >= p_from and d.yes_at < now() - interval '24 hours'),
  paid as (
    select distinct on (p.cycle_id) p.cycle_id, p.paid_at, cy.person_id
      from crm_payments p join cy on cy.id = p.cycle_id where p.paid_at >= p_from and p.paid_at < now() - interval '2 hours' and p.amount > coalesce(p.refunded_amount, 0)
     order by p.cycle_id, p.paid_at),
  heldcalls as (
    select k.id, coalesce(k.recording_end, k.scheduled_end, k.scheduled_start + interval '1 hour') e, k.fathom_recording_id,
           (select min(o.declared_at) from crm_call_outcomes o where o.call_id = k.id) declared_at
      from crm_calls k join cy on cy.id = k.cycle_id
     where k.status::text = 'held' and k.scheduled_start >= p_from and k.scheduled_start < now() - interval '15 minutes'),
  -- une ligne par délai : effectif, dans les temps, médiane, et le taux de vente dans les temps / hors délai sur la cohorte g
  d as (
    select 'speed_to_lead' id, 'Premier contact du commercial après la prise de RDV' label, 'SH-2' rule, 5::numeric target, 'min' unit,
           (select count(*) from bkd where first_booked < now() - interval '1 hour') n,
           (select count(*) from bkd where first_booked < now() - interval '1 hour' and first_touch <= first_booked + interval '5 minutes') met,
           (select percentile_cont(0.5) within group (order by extract(epoch from first_touch - first_booked) / 60) from bkd where first_touch is not null) med,
           (select jsonb_build_object('met_n', count(*) filter (where first_touch <= first_booked + interval '5 minutes'),
                   'met_won', count(*) filter (where won14 and first_touch <= first_booked + interval '5 minutes'),
                   'miss_n', count(*) filter (where not coalesce(first_touch <= first_booked + interval '5 minutes', false)),
                   'miss_won', count(*) filter (where won14 and not coalesce(first_touch <= first_booked + interval '5 minutes', false))) from g) imp
    union all
    select 'r1_within_48h', 'R1 tenu dans les 48 h après sa réservation', 'SH-3', 48, 'h',
           (select count(*) from bkd where booked_at is not null), (select count(*) from bkd where s <= booked_at + interval '48 hours'),
           (select percentile_cont(0.5) within group (order by extract(epoch from s - booked_at) / 3600) from bkd where booked_at is not null),
           (select jsonb_build_object('met_n', count(*) filter (where s <= booked_at + interval '48 hours'), 'met_won', count(*) filter (where won14 and s <= booked_at + interval '48 hours'),
                   'miss_n', count(*) filter (where s > booked_at + interval '48 hours'), 'miss_won', count(*) filter (where won14 and s > booked_at + interval '48 hours')) from g where booked_at is not null)
    union all
    select 'noshow_contact', 'Absence : message et appel', 'SH-8', 15, 'min',
           (select count(*) from nsf), (select count(*) from nsf where touch_at <= t + interval '25 minutes'),
           (select percentile_cont(0.5) within group (order by extract(epoch from touch_at - t) / 60) from nsf where touch_at is not null), null
    union all
    select 'noshow_rebook', 'Absence : nouveau créneau réservé', 'SH-9', 24, 'h',
           (select count(*) from nsf), (select count(*) from nsf where rebook_at <= t + interval '24 hours'),
           (select percentile_cont(0.5) within group (order by extract(epoch from rebook_at - t) / 3600) from nsf where rebook_at is not null), null
    union all
    select 'outcome_declared', 'Issue déclarée après l''appel', 'SH-11', 15, 'min',
           (select count(*) from heldcalls), (select count(*) from heldcalls where declared_at <= e + interval '15 minutes'),
           (select percentile_cont(0.5) within group (order by extract(epoch from declared_at - e) / 60) from heldcalls where declared_at is not null), null
    union all
    select 'recap_60', 'Récap écrit après le R1', 'DE-1', 60, 'min',
           (select count(*) from hdx where e < now() - interval '1 hour'), (select count(*) from hdx where recap_at <= e + interval '60 minutes'),
           (select percentile_cont(0.5) within group (order by extract(epoch from recap_at - e) / 60) from hdx where recap_at is not null),
           (select jsonb_build_object('met_n', count(*) filter (where recap_at <= e + interval '60 minutes'), 'met_won', count(*) filter (where won14 and recap_at <= e + interval '60 minutes'),
                   'miss_n', count(*) filter (where not coalesce(recap_at <= e + interval '60 minutes', false)), 'miss_won', count(*) filter (where won14 and not coalesce(recap_at <= e + interval '60 minutes', false))) from g)
    union all
    select 'call_after_r1', 'Appel téléphonique après un R1 sans décision', 'Bonne pratique (fenêtre DE-9)', 72, 'h',
           (select count(*) from hdx where e < now() - interval '72 hours' and not coalesce(paid_at <= e + interval '24 hours', false)),
           (select count(*) from hdx where e < now() - interval '72 hours' and not coalesce(paid_at <= e + interval '24 hours', false) and call_after_at is not null),
           (select percentile_cont(0.5) within group (order by extract(epoch from call_after_at - e) / 3600) from hdx where call_after_at is not null),
           (select jsonb_build_object('met_n', count(*) filter (where call_after_at is not null), 'met_won', count(*) filter (where won14 and call_after_at is not null),
                   'miss_n', count(*) filter (where call_after_at is null), 'miss_won', count(*) filter (where won14 and call_after_at is null))
              from g where not coalesce(paid_at <= e + interval '24 hours', false))
    union all
    select 'decision_72', 'Décision après l''offre', 'DE-9', 72, 'h',
           (select count(*) from hdx where e < now() - interval '72 hours' and qualified),
           (select count(*) from hdx where e < now() - interval '72 hours' and qualified and (least(decided_at, paid_at) <= e + interval '72 hours')),
           (select percentile_cont(0.5) within group (order by extract(epoch from least(decided_at, paid_at) - e) / 3600) from hdx where least(decided_at, paid_at) is not null and qualified), null
    union all
    select 'yes_to_payment', 'Premier paiement après un oui', 'CA-2', 24, 'h',
           (select count(*) from yes), (select count(*) from yes where paid_at <= yes_at + interval '24 hours'),
           (select percentile_cont(0.5) within group (order by extract(epoch from paid_at - yes_at) / 3600) from yes where paid_at is not null), null
    union all
    select 'handover_2h', 'Message de bienvenue après le premier paiement', 'CA-6', 2, 'h',
           (select count(*) from paid),
           (select count(*) from paid where exists (select 1 from touch t where t.person_id = paid.person_id and t.occurred_at > paid.paid_at and t.occurred_at <= paid.paid_at + interval '2 hours')), null, null
    union all
    select 'reply_15', 'Réponse à un message du prospect (8 h – 22 h)', 'CO-1', 15, 'min',
           (select count(*) from rep), (select count(*) from rep where mins <= 15),
           (select percentile_cont(0.5) within group (order by mins) from rep where mins is not null),
           (select jsonb_build_object('met_n', count(*) filter (where reply_med <= 15), 'met_won', count(*) filter (where won14 and reply_med <= 15),
                   'miss_n', count(*) filter (where reply_med > 15), 'miss_won', count(*) filter (where won14 and reply_med > 15)) from g where reply_med is not null)
  ),
  -- les portes de la qualification, par cycle dont le premier appel tenu est dans la période
  portes as (
    select x.k, x.v->>'statut' statut
      from hdx join qual q on q.cycle_id = hdx.cycle_id, jsonb_each(coalesce(q.result->'portes', '{}')) x(k, v)
     where x.k in ('metier', 'financement', 'decision_timing'))
  select jsonb_build_object(
    'cohort', jsonb_build_object('held', (select count(*) from hdx), 'qualified', (select count(*) from hdx where qualified),
      'qual_read', (select count(*) from hdx where qverdict is not null), 'matured', (select count(*) from g), 'won14', (select count(*) from g where won14)),
    'delays', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'label', label, 'rule', rule, 'target', target, 'unit', unit,
                 'n', n, 'met', met, 'median', round(med::numeric, 1), 'impact', imp)), '[]') from d),
    'reactivation', jsonb_build_object(
      'no_show', (select jsonb_build_object('n', count(*), 'contacted_15', count(*) filter (where touch_at <= t + interval '25 minutes'),
          'rebooked', count(*) filter (where rebook_at is not null), 'rebooked_24h', count(*) filter (where rebook_at <= t + interval '24 hours'),
          'rebook_median_h', round((percentile_cont(0.5) within group (order by extract(epoch from rebook_at - t) / 3600))::numeric, 1),
          'held_after', count(*) filter (where held_after), 'won_after', count(*) filter (where won_after),
          'never_contacted', count(*) filter (where touch_at is null)) from nsf),
      'closing_failure', (select jsonb_build_object('n', count(*), 'touched', count(*) filter (where touch_at is not null),
          'silent', count(*) filter (where touch_at is null), 'reactivated', count(*) filter (where react_at is not null),
          'react_median_days', round((percentile_cont(0.5) within group (order by extract(epoch from react_at - e) / 86400))::numeric, 1),
          'won_after', count(*) filter (where won_after)) from cf)),
    'interactions', (select jsonb_build_object(
      'touches', (select coalesce(jsonb_agg(x order by x.ord), '[]') from (
          select case when touches_after = 0 then '0' when touches_after <= 3 then '1 à 3' when touches_after <= 8 then '4 à 8' else '9 et plus' end bucket,
                 min(touches_after) ord, count(*) n, count(*) filter (where won14) won from g group by 1) x),
      'phone_call', jsonb_build_object('with_n', count(*) filter (where call_after_at is not null), 'with_won', count(*) filter (where won14 and call_after_at is not null),
                                       'without_n', count(*) filter (where call_after_at is null), 'without_won', count(*) filter (where won14 and call_after_at is null)),
      'replied', jsonb_build_object('yes_n', count(*) filter (where replies_after > 0), 'yes_won', count(*) filter (where won14 and replies_after > 0),
                                    'no_n', count(*) filter (where replies_after = 0), 'no_won', count(*) filter (where won14 and replies_after = 0)),
      'reply_time', (select coalesce(jsonb_agg(x order by x.ord), '[]') from (
          select case when reply_med is null then 'Pas de réponse attendue' when reply_med <= 15 then '15 min ou moins' when reply_med <= 60 then '15 à 60 min' else 'Plus de 60 min' end bucket,
                 case when reply_med is null then 4 when reply_med <= 15 then 1 when reply_med <= 60 then 2 else 3 end ord,
                 count(*) n, count(*) filter (where won14) won from g group by 1, 2) x)) from g),
    'quality', jsonb_build_object(
      'held_calls', (select count(*) from heldcalls), 'declared', (select count(*) from heldcalls where declared_at is not null),
      'recorded', (select count(*) from heldcalls where fathom_recording_id is not null),
      'analysis', (select jsonb_build_object('n', count(distinct j.call_id),
            'spin', round(avg(r.score) filter (where r.competence = 'SPIN')), 'objections', round(avg(r.score) filter (where r.competence = 'OBJECTIONS')),
            'gap_present', count(*) filter (where r.competence = 'GAP' and r.verdict = 'present'), 'gap_n', count(*) filter (where r.competence = 'GAP'),
            'pitch_ok', count(*) filter (where r.competence = 'PITCH' and r.verdict = 'compliant'), 'pitch_n', count(*) filter (where r.competence = 'PITCH'))
          from (select distinct on (x.call_id) x.* from crm_ca_jobs x where x.status = 'done' order by x.call_id, x.created_at desc) j   -- la dernière analyse d'un appel
          join crm_calls k on k.id = j.call_id join cy on cy.id = k.cycle_id join crm_ca_results r on r.job_id = j.id
         where k.scheduled_start >= p_from),
      'references_missing', (select count(*) = 0 from crm_ca_offer where active) or (select count(*) = 0 from crm_ca_cases where active),
      'criteria', (select coalesce(jsonb_agg(jsonb_build_object('k', x.k, 'name', x.name, 'pass', x.pass, 'fail', x.fail, 'unknown', x.unknown) order by x.ord), '[]') from (
          select k, case k when 'metier' then 'Métier' when 'financement' then 'Financement' else 'Décision et timing' end name,
                 array_position(array['metier', 'financement', 'decision_timing'], k) ord,
                 count(*) filter (where statut = 'OUVERTE') pass, count(*) filter (where statut = 'FERMÉE') fail,
                 count(*) filter (where statut not in ('OUVERTE', 'FERMÉE')) unknown
            from portes group by k) x),
      'verdicts', (select coalesce(jsonb_object_agg(v, n), '{}') from (select qverdict v, count(*) n from hdx where qverdict is not null group by qverdict) x),
      'reasons', (select coalesce(jsonb_agg(x order by x.n desc), '[]') from (
          select coalesce(rc.label, c.close_reason::text, 'Sans motif') label, c.status::text status, count(*) n
            from cy c left join crm_reason_codes rc on rc.code = c.close_reason
           where c.status::text in ('lost', 'disqualified') and c.closed_at >= p_from group by 1, 2) x)))
$$;
revoke execute on function crm_sales_exec_window(timestamptz, uuid[]) from public, anon, authenticated;

create or replace function crm_sales_execution(p_days int default 90, p_owner uuid default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_sees boolean := crm_sees_all(); v_ids uuid[]; v_days int := greatest(least(coalesce(p_days, 90), 365), 7);
begin
  if crm_role() is null then raise exception 'Aucun rôle dans le CRM' using errcode = '42501'; end if;
  select coalesce(array_agg(id), '{}') into v_ids from crm_cycles
   where (v_sees or owner_id = auth.uid()) and (p_owner is null or owner_id = p_owner) and not crm_person_internal(person_id);
  return jsonb_build_object('days', v_days, 'from', now() - make_interval(days => v_days), 'at', now(),
    'rules', jsonb_build_object('won', 'premier paiement dans les 14 jours après le premier appel tenu',
                                'qualified', 'qualification LNP (portes 2.2), sinon non disqualifié', 'indicative_below', 20))
    || crm_sales_exec_window(now() - make_interval(days => v_days), v_ids);
end $$;
revoke execute on function crm_sales_execution(int, uuid) from public, anon;
grant execute on function crm_sales_execution(int, uuid) to authenticated;
