/* LNP CRM data layer (docs/crm/11-crm-frontend.md §2): window.LNP_CRM.
   Web edition: reads crm_* tables through the Supabase client of web/public/lnp-web.js (claude.use("crm")), so row-level
   security decides what each person sees; writes go only through the crm_* RPCs (web/supabase/004_crm_rpc.sql).
   Artifact or plain file: demo mode, sample data, nothing saved. Screens start using it in phases 2-3. */
(function () {
  "use strict";
  var api = null, mode = "loading", waiting = [];

  // A tiny sample so screens have something to draw in demo mode (fictional people).
  var now = Date.now(), H = 3600 * 1000;
  var DEMO = {
    me: { id: "demo-sales", member_key: "sales", full_name: "Camille Martin", role: "sales" },
    cycles: [
      { id: "demo-c1", status: "active", origin: "new", owner_key: "sales", opened_at: new Date(now - 50 * H).toISOString(),
        current_stage: "show", person: { id: "demo-p1", full_name: "Prospect d’exemple A", primary_email: "a@example.com" },
        calls: [{ id: "demo-call1", rank: 1, status: "scheduled", scheduled_start: new Date(now + 20 * H).toISOString() }] },
      { id: "demo-c2", status: "active", origin: "new", owner_key: "sales", opened_at: new Date(now - 120 * H).toISOString(),
        current_stage: "decision", person: { id: "demo-p2", full_name: "Prospect d’exemple B", primary_email: "b@example.com" },
        calls: [{ id: "demo-call2", rank: 1, status: "held", scheduled_start: new Date(now - 30 * H).toISOString() }] }
    ]
  };
  function clone(x) { return JSON.parse(JSON.stringify(x)); }

  function start() {
    // only the web edition serves "crm"; inside a claude.ai Artifact or as a plain file: demo
    var use = window.claude && window.claude.web && typeof window.claude.use === "function" ? window.claude.use : null;
    if (!use) return settle(null);
    Promise.resolve().then(function () { return use("crm"); }).then(settle, function () { settle(null); });
  }
  function settle(a) {
    api = a || null; mode = api ? "live" : "demo";
    waiting.splice(0).forEach(function (fn) { fn(); });
  }
  function ready() { return mode === "loading" ? new Promise(function (r) { waiting.push(r); }) : Promise.resolve(); }

  async function rows(q) { var r = await q; if (r.error) { var e = new Error(r.error.message); e.code = r.error.code; throw e; } return r.data; }
  // every row, past the API's 1000-row page (build returns a fresh query each time)
  async function all(build) {
    var out = [], page;
    do { page = await rows(build().range(out.length, out.length + 999)); out = out.concat(page || []); } while (page && page.length === 1000);
    return out;
  }
  // rows of a cycle table for many cycles, by 100 ids (a long id list does not fit in one request)
  async function forCycles(table, cols, ids, order) {
    var parts = [];
    for (var i = 0; i < ids.length; i += 100) {
      (function (chunk) { parts.push(all(function () { return api.from(table).select(cols).in("cycle_id", chunk).order(order); })); })(ids.slice(i, i + 100));
    }
    return [].concat.apply([], await Promise.all(parts));
  }
  async function call(fn, args) {
    await ready();
    if (mode !== "live") return { demo: true };   // demo mode: nothing is saved
    return api.rpc(fn, args);
  }

  // CRM › Sales cycle (docs/crm/16 §3): the board's cycles as the screen's view model. Pure: cycles from listBoard,
  // members from listMembers, now in ms. t = hours since the booking (opened_at); events after now are scheduled.
  // labels shown on screen, by reason code (the codes are data; LNP shows French)
  var REASON = { price: "Prix", timing: "Pas le bon moment", partner: "Associé ou conjoint", trust: "Manque de confiance", competitor: "A choisi une autre offre",
    unreachable: "Injoignable", unpaid: "Paiement non effectué", refunded: "Remboursé", dq_off_target: "Hors cible", dq_budget: "Aucun budget",
    dq_not_decider: "Pas décisionnaire", dq_fake: "Faux contact ou spam", dq_customer: "Déjà client", dq_out_of_offer: "Demande hors de l’offre" };
  function reasonLabel(code, fallback) { return REASON[code] || fallback || code || "—"; }
  // a payment plan label (stored "Paid in full" / "N instalments", or the French ones) as shown on screen
  function planLabel(x) { x = String(x || ""); var m = /^(\d+) (instal|échéance)/.exec(x); return /^(paid in full|payé en une fois)$/i.test(x) ? "payé en une fois" : m ? m[1] + " échéances" : x; }
  function eur(v) { return Number(v).toLocaleString("fr-FR") + " €"; }
  function salesCycleView(cycles, members, now) {
    var H = 3600e3, keys = {};
    (members || []).forEach(function (m) { keys[m.id] = m.member_key; });
    return (cycles || []).map(function (c) {
      var opened = Date.parse(c.opened_at), age = Math.max(0, (now - opened) / H), ev = [], rank = {};
      var t = function (iso) { return Math.max(0, (Date.parse(iso) - opened) / H); };
      (c.calls || []).forEach(function (k) { rank[k.id] = k.rank; });
      var add = function (o) { ev.push(o); }, lastOut = null, rec = {}, ana = {};
      // SLAs DO-2 / DE-2 (supabase/functions/_shared/sla_rules.js): when each call got its Fathom recording and its analysis
      (c.events || []).forEach(function (e) {
        if (!e.call_id) return;
        if (e.type === "call_recorded" && rec[e.call_id] === undefined) rec[e.call_id] = t(e.occurred_at);
        if (e.type === "analysis_ready" && ana[e.call_id] === undefined) ana[e.call_id] = t(e.occurred_at);
      });
      var stOf = function (x) { x = String(x || "").toLowerCase(); return x ? x.charAt(0).toUpperCase() + x.slice(1) : undefined; };
      (c.events || []).forEach(function (e) {
        var d = e.data || {}, r = rank[e.call_id] || 1, at = t(e.occurred_at), txt = e.content || "";
        var auto = e.actor === "auto" || e.actor === "system", sms = e.channel === "sms";
        switch (e.type) {
          case "call_booked": add({ t: at, w: "p", k: "booked", r: r, txt: "RDV R" + r + " pris" + (d.event_name ? " · " + d.event_name : "") }); break;
          case "call_rescheduled": add({ t: at, w: "p", k: "booked", r: r, txt: "RDV R" + r + " reporté" }); break;
          case "call_canceled": add({ t: at, w: "a", k: "note", txt: "R" + r + " annulé" + (d.cancel_reason ? " · " + d.cancel_reason : "") }); break;
          case "message_in": add({ t: at, w: "p", k: sms ? "sms" : "im", txt: txt }); break;
          case "message_out": add(auto ? { t: at, w: "a", k: "remind", txt: txt, st: stOf(d.status) } : { t: at, w: "s", k: sms ? "sms" : "im", txt: txt, st: stOf(d.status) }); break;
          case "phone_call_in": add({ t: at, w: "p", k: "call", txt: txt || "Appel téléphonique entrant" }); break;
          case "phone_call_out": add({ t: at, w: "s", k: "call", txt: txt || "Appel téléphonique sortant" }); break;
          case "note": add({ t: at, w: "s", k: "note", txt: txt }); break;
          case "opt_out": add({ t: at, w: "a", k: "note", stop: 1, txt: "STOP : le prospect ne veut plus de messages automatiques" }); break;
          case "checkout_created": add({ t: at, w: "s", k: "paylink", txt: "Lien Whop envoyé" }); break;
          case "payment_succeeded": add({ t: at, w: "p", k: "paid", txt: "Paiement Whop" + (d.amount ? " · " + eur(d.amount) : "") }); break;
          case "cycle_won":
            add({ t: at, w: "s", k: "decision", yes: 1, txt: "Issue déclarée · Gagné" + (e.source === "import" ? " (depuis iClosed)" : "") });
            if (!(c.events || []).some(function (x) { return x.type === "payment_succeeded"; })) add({ t: at, w: "p", k: "paid", txt: "Gagné · paiement enregistré dans iClosed" });
            break;
          // outcomes declared in the CRM (phase 3): the decision line and, for the latest one, the next step
          case "outcome_yes":
            add({ t: at, w: "s", k: "decision", yes: 1, r: r, txt: "Issue déclarée · Honoré · Oui" + (d.amount_sold ? " · " + eur(d.amount_sold) : "") +
              (d.payment_plan ? " · " + planLabel(d.payment_plan) : "") });
            lastOut = { t: at, nx: { txt: "Envoyer le lien Whop", src: "oui au R" + r, due: at + 1 } }; break;
          case "outcome_follow_up":
            add({ t: at, w: "s", k: "decision", fu: 1, r: r, txt: "Issue déclarée · Honoré · Relance" + (d.next_step ? " · prochaine étape : " + d.next_step : "") });
            lastOut = { t: at, nx: d.next_step ? { txt: d.next_step, src: "d’après l’issue du R" + r } : null }; break;
          case "outcome_no_show": if (e.source === "crm" || e.source === "rules") lastOut = { t: at, nx: { txt: "Reprendre contact après l’absence", src: e.source === "rules" ? "aucun enregistrement Fathom" : "votre issue", due: at + 2 } }; break;
          case "outcome_no": case "outcome_disqualified":
            add({ t: at, w: "s", k: "decision", no: 1, r: r, txt: "Issue déclarée · Honoré · " + (e.type === "outcome_no" ? "Non" : "Disqualifié") +
              " · motif : " + reasonLabel(d.reason_code) + (d.nurture && d.nurture !== "none" ? " · suivi long terme" : "") });
            lastOut = { t: at, nx: null }; break;
          case "cycle_reopened": add({ t: at, w: "s", k: "note", txt: "Prospect rouvert dans le pipeline" }); break;
          case "stage_moved": add({ t: at, w: "s", k: "note", txt: "Déplacé dans le pipeline · " + ({ r1: "R1", r2: "R2", r3: "R3 et plus", longfu: "Relance longue" }[d.to] || d.to) }); break;
          case "cycle_lost": case "cycle_disqualified":
            // 045: closed by hand from the Pipeline (a lead with no call to declare)
            if (e.source === "manual") { add({ t: at, w: "s", k: "decision", no: 1, txt: "Clos à la main · " + (e.type === "cycle_lost" ? "Perdu" : "Disqualifié") +
              " · motif : " + reasonLabel(d.reason) + (txt ? " · " + txt : "") }); break; }
            if (ev.some(function (x) { return x.k === "decision" && x.no; })) break;   // one closing step
            add({ t: at, w: "s", k: "decision", no: 1, txt: "Issue déclarée · " + (e.type === "cycle_lost" ? "Non" : "Disqualifié") +
              " · motif : " + reasonLabel(d.reason || c.close_reason) }); break;
        }
      });
      (c.calls || []).forEach(function (k) {
        var s = k.scheduled_start ? t(k.scheduled_start) : null, end = k.scheduled_end ? Date.parse(k.scheduled_end) : null;
        if (s == null || k.status === "canceled") return;
        var dur = end && k.scheduled_start ? Math.round((end - Date.parse(k.scheduled_start)) / 60e3) : undefined;
        if (k.status === "held") add({ t: s, w: "s", k: "meet", r: k.rank, dur: dur, cid: k.id, rec: rec[k.id], ana: ana[k.id], txt: "R" + k.rank + " · Appel" });
        else if (k.status === "no_show") add({ t: s, w: "p", k: "noshow", r: k.rank, cid: k.id, txt: "Absence R" + k.rank });
        // 030: an R2+ with no Fathom recording of 7 min is not a no-show: the lead stays in its round, to reschedule
        else if (k.status === "missed") add({ t: s, w: "a", k: "note", r: k.rank, cid: k.id, txt: "R" + k.rank + " non honoré (aucun enregistrement Fathom) · à replanifier" });
        else if (k.status === "outcome_pending" || (end ? end < now : s < age)) add({ t: s, w: "s", k: "meetdue", r: k.rank, cid: k.id, txt: "R" + k.rank + " · Appel" });
        else add({ t: s, w: "s", k: "meet", r: k.rank, dur: dur, cid: k.id, txt: "R" + k.rank + " · Appel" });
      });
      ev.sort(function (a, b) { return a.t - b.t; });
      var p = c.person || {}, nm = c.next_move && c.next_move.code;
      return { id: c.id, p: p.full_name || p.primary_email || p.primary_phone || "—", o: keys[c.owner_id] || "none",
        prod: (c.deal && c.deal.product) || "—", a: (c.deal && Number(c.deal.amount_sold)) || 0, ph: p.primary_phone || "—", em: p.primary_email || "—",
        opened: c.opened_at, age: age, ev: ev, rec: true,
        nx: lastOut && !ev.some(function (x) { return x.t > lastOut.t && x.t <= age && x.w === "s" && x.k !== "decision"; }) ? lastOut.nx
          : nm === "rebook" ? (c.next_move.missed ? { txt: "Replanifier l’appel", src: "R" + c.next_move.missed + " non honoré" } : { txt: "Reprendre un rendez-vous", src: "le dernier appel a été annulé" }) : null };
    });
  }

  var CYCLE_COLS = "id,status,origin,opened_at,closed_at,close_reason,current_stage,stage_entered_at,calls_held,no_shows," +
    "sales_attempts,last_prospect_at,last_sales_at,last_event_at,next_move,owner_id,person:crm_people(id,full_name,primary_email,primary_phone,first_seen_at,setter_id,lead_source,quiz,setting_status,setting_since,setting_last_action,setting_last_at,setting_due_at,setting_attempts)";

  window.LNP_CRM = {
    mode: function () { return mode; },
    ready: ready,
    // the signed-in person's CRM profile (null: no CRM role)
    me: async function () {
      await ready();
      if (mode !== "live") return clone(DEMO.me);
      return api.me();
    },
    // filters: {status: 'active'|'won'|'lost'|'disqualified', owner_id}
    listCycles: async function (filters) {
      await ready(); filters = filters || {};
      if (mode !== "live") return clone(DEMO.cycles).filter(function (c) { return !filters.status || c.status === filters.status; });
      var q = api.from("crm_cycles").select(CYCLE_COLS).order("opened_at", { ascending: false });
      if (filters.status) q = q.eq("status", filters.status);
      if (filters.owner_id) q = q.eq("owner_id", filters.owner_id);
      return rows(q);
    },
    // every visible cycle with its calls, events and deal, for the CRM board (one query per table)
    // onCycles(cycles): called as soon as the cycles are in, before their calls and events, so a screen can draw them at once
    listBoard: async function (onCycles) {
      await ready();
      if (mode !== "live") return [];
      var cycles = await all(function () { return api.from("crm_cycles").select(CYCLE_COLS).order("opened_at", { ascending: false }).order("id"); });
      if (typeof onCycles === "function") {
        try { onCycles(cycles.map(function (c) { return Object.assign({}, c, { calls: [], events: [], deal: null }); })); } catch (e) { console.error(e); }
      }
      var ids = cycles.map(function (c) { return c.id; });
      if (!ids.length) return [];
      var r = await Promise.all([
        forCycles("crm_calls", "id,cycle_id,rank,status,scheduled_start,scheduled_end", ids, "rank"),
        forCycles("crm_events", "id,cycle_id,call_id,type,occurred_at,source,content,actor,channel,data", ids, "occurred_at"),
        forCycles("crm_deals", "cycle_id,product,amount_sold,currency,payment_plan,schedule,yes_at", ids, "cycle_id"),
        forCycles("crm_payments", "id,cycle_id,amount,refunded_amount,currency,status,paid_at,source,method,note", ids, "paid_at")
      ]);
      var by = function (list) { var m = {}; list.forEach(function (x) { (m[x.cycle_id] = m[x.cycle_id] || []).push(x); }); return m; };
      var calls = by(r[0]), events = by(r[1]), deals = by(r[2]), pays = by(r[3]);
      return cycles.map(function (c) {
        return Object.assign(c, { calls: calls[c.id] || [], events: events[c.id] || [], deal: (deals[c.id] || [])[0] || null, payments: pays[c.id] || [] });
      });
    },
    // people who never booked a call (no cycle): the CRM's "No booking" status, with their iClosed status
    listNoBooking: async function () {
      await ready();
      if (mode !== "live") return [];
      return all(function () {
        return api.from("crm_people_without_cycle").select("id,full_name,primary_email,primary_phone,created_at,iclosed_status,last_event_at,first_seen_at,setter_id,lead_source,quiz,setting_status,setting_since,setting_last_action,setting_last_at,setting_due_at,setting_attempts")
          .order("first_seen_at", { ascending: false }).order("id");
      });
    },
    salesCycleView: salesCycleView,
    // the French label of a loss or disqualification reason code, and of a payment plan
    reasonLabel: reasonLabel,
    planLabel: planLabel,
    // the CRM team: id, member_key, full_name, role (readable by every signed-in person)
    listMembers: async function () {
      await ready();
      if (mode !== "live") return [clone(DEMO.me)];
      return rows(api.from("crm_members").select("id,member_key,full_name,role,active"));
    },
    // reasons of loss and disqualification (crm_reason_codes)
    listReasons: async function () {
      await ready();
      if (mode !== "live") return [];
      return rows(api.from("crm_reason_codes").select("code,kind,label,active,automatic").order("position"));
    },
    // the SLA settings saved in Settings › Alerts (crm_settings.sla_rules: sources connected, SLAs on, thresholds, places)
    slaRules: async function () {
      await ready();
      if (mode !== "live") return null;
      var r = await rows(api.from("crm_settings").select("value").eq("key", "sla_rules"));
      return r[0] ? r[0].value : null;
    },
    getCycle: async function (id) {
      await ready();
      if (mode !== "live") return clone(DEMO.cycles.find(function (c) { return c.id === id; }) || null);
      var cycle = (await rows(api.from("crm_cycles").select(CYCLE_COLS).eq("id", id)))[0];
      if (!cycle) return null;
      var r = await Promise.all([
        rows(api.from("crm_calls").select("*").eq("cycle_id", id).order("rank")),
        rows(api.from("crm_events").select("*").eq("cycle_id", id).order("occurred_at")),
        rows(api.from("crm_deals").select("*").eq("cycle_id", id)),
        rows(api.from("crm_payments").select("*").eq("cycle_id", id)),
        rows(api.from("crm_nurture_tracks").select("*").eq("origin_cycle_id", id))
      ]);
      var callIds = r[0].map(function (c) { return c.id; });
      var outcomes = callIds.length ? await rows(api.from("crm_call_outcomes").select("*").in("call_id", callIds).is("superseded_at", null)) : [];
      var analyses = callIds.length ? await rows(api.from("crm_call_analyses").select("*").in("call_id", callIds)) : [];
      return Object.assign(cycle, { calls: r[0], events: r[1], deal: r[2][0] || null, payments: r[3], nurture: r[4], outcomes: outcomes, analyses: analyses });
    },
    // writes (02 §5): each one checks the role on the server and is audited
    declareOutcome: function (callId, p) { return call("crm_declare_outcome", { p_call: callId, p: p }); },
    // call analysis (020 / 021, call-analysis/PLAN.md): past R1 / R2 sales calls the caller may analyse with their state,
    // one full call record, adding a transcript (queues the analysis), running it again; nothing outside the web edition
    caBoard: async function () { await ready(); if (mode !== "live") return []; return call("crm_ca_board", {}); },
    caRecord: function (jobId) { return call("crm_ca_record", { p_job: jobId }); },
    caAddTranscript: function (callId, raw, speakerMap) { return call("crm_ca_add_transcript", { p_call: callId, p_raw: raw, p_speaker_map: speakerMap, p_source: "upload" }); },
    caRetry: function (callId) { return call("crm_ca_retry", { p_call: callId }); },
    // cash entered by hand (022): the amount signed, a payment received, removing a payment entered by hand
    setDeal: function (cycleId, amount, currency) { return call("crm_set_deal", { p_cycle: cycleId, p_amount: amount, p_currency: currency || "EUR" }); },
    // the payment method is not asked (Romain 2026-10-28: the terms matter, not the method)
    addPayment: function (cycleId, p) { return call("crm_add_payment", { p_cycle: cycleId, p_amount: p.amount, p_paid_at: p.paid_at, p_method: p.method || "other", p_note: p.note || null }); },
    // payment plan (024): amount signed + instalments [{due: "YYYY-MM-DD", amount}]
    setPlan: function (cycleId, amount, currency, schedule) { return call("crm_set_payment_plan", { p_cycle: cycleId, p_amount: amount, p_currency: currency || "EUR", p_schedule: schedule }); },
    deletePayment: function (paymentId) { return call("crm_delete_payment", { p_payment: paymentId }); },
    // a refund on a payment (026): the rest of it by default; every payment refunded = lost, reason Refunded
    addRefund: function (paymentId, amount) { return call("crm_add_refund", { p_payment: paymentId, p_amount: amount == null ? null : amount }); },
    // the Sales cockpit figures (016_crm_sales_cockpit.sql): periods 7 / 30 / 56 days with baselines, team, 8 weeks, cash at risk
    salesCockpit: function () { return call("crm_sales_cockpit", {}); },
    // Cockpit commercial › Exécution, Qualité, Impact (050_crm_sales_execution.sql): the delays, reactivation, interactions,
    // quality and impact of a period (7 to 365 days), for every visible cycle or one sales rep's
    // the setter's follow-up of a lead (054): an action of the setter, the setter of a lead (admins), a lead entered by hand
    setterAction: function (personId, action, note) { return call("crm_setter_action", { p_person: personId, p_action: action, p_note: note || null }); },
    setSetter: function (personId, memberId) { return call("crm_set_setter", { p_person: personId, p_member: memberId || null }); },
    createLead: function (name, email, phone, source) { return call("crm_create_lead", { p_name: name || "", p_email: email || "", p_phone: phone || "", p_source: source || "manuel" }); },
    // the alerts of the CRM (053): the open ones the person may see, and the count closed today
    slaAlerts: function (owner) { return call("crm_sla_alerts_open", { p_owner: owner || null }); },
    // live changes of the alerts (Realtime); returns an unsubscribe function
    onAlerts: function (fn) { if (mode !== "live" || !api.subscribe) return function () {}; return api.subscribe(["crm_sla_alerts"], fn); },
    salesExecution: function (days, owner) { return call("crm_sales_execution", { p_days: days || 90, p_owner: owner || null }); },
    // the signed-in person's own screen settings (031): Pipeline column order, Sales Day lists; in demo mode kept in this browser
    getPref: async function (key) {
      await ready();
      if (mode !== "live") { try { return JSON.parse(localStorage.getItem("lnp_crm_pref:" + key) || "null"); } catch (e) { return null; } }
      var r = await api.rpc("crm_get_pref", { p_key: key });
      if (r.error) throw new Error(r.error.message);
      return r.data;
    },
    setPref: async function (key, value) {
      await ready();
      if (mode !== "live") { try { if (value == null) localStorage.removeItem("lnp_crm_pref:" + key); else localStorage.setItem("lnp_crm_pref:" + key, JSON.stringify(value)); } catch (e) {} return value; }
      var r = await api.rpc("crm_set_pref", { p_key: key, p_value: value == null ? null : value });
      if (r.error) throw new Error(r.error.message);
      return r.data;
    },
    addNote: function (cycleId, text) { return call("crm_add_note", { p_cycle: cycleId, p_text: text }); },
    // CRM › Pipeline moves with no call to declare (045): close a lead lost or disqualified with a reason; reopen a closed lead
    closeCycle: function (cycleId, decision, reason, note) { return call("crm_close_cycle", { p_cycle: cycleId, p_decision: decision, p_reason: reason, p_note: note || null }); },
    reopenCycle: function (cycleId) { return call("crm_reopen_cycle", { p_cycle: cycleId }); },
    // a move with nothing to declare (047): the next round, the same round after a no-show, Relance longue
    moveCycle: function (cycleId, to) { return call("crm_move_cycle", { p_cycle: cycleId, p_to: to }); },
    reassignCycle: function (cycleId, memberId) { return call("crm_reassign_cycle", { p_cycle: cycleId, p_member: memberId }); },
    cancelAutoClose: function (cycleId) { return call("crm_cancel_auto_close", { p_cycle: cycleId }); },
    setNurture: function (personId, p) { return call("crm_set_nurture", { p_person: personId, p: p }); },
    resolveUnmatched: function (itemId, personId, cycleId) { return call("crm_resolve_unmatched", { p_item: itemId, p_person: personId, p_cycle: cycleId || null }); },
    dismissUnmatched: function (itemId) { return call("crm_dismiss_unmatched", { p_item: itemId }); },
    mergePeople: function (keepId, mergeId) { return call("crm_merge_people", { p_keep: keepId, p_merge: mergeId }); },
    updateCrmConfig: function (table, key, value) { return call("crm_update_config", { p_table: table, p_key: key, p_value: value }); },
    createCheckout: function (cycleId) { return call("crm_create_checkout", { p_cycle: cycleId }); },
    // live changes of cycles, events and CRM alerts; returns an unsubscribe function
    subscribe: function (fn) {
      if (mode !== "live") return function () {};
      return api.subscribe(["crm_cycles", "crm_events", "crm_alerts"], fn);
    }
  };
  start();
})();
