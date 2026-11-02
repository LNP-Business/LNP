// SKL CRM · Sales cycle SLAs v3 (docs/crm/18-sales-cycle-slas.md, Romain 2026-10-25 / 2026-10-30). One source for the
// Sales cycle screen (inlined by skl-os/gen_crm.py) and the Slack alerts (supabase/functions/sla-tick).
// A lead is the screen's model: {age, ev: [{t (hours since the cycle opened), w: s|p|a, k, r, dur (min)}]}; opt.t0 = the
// cycle's opening (ms) turns on the sales window of CO-1 / CO-2 (08:00-22:00, opt.tz, default America/New_York).
// Each SLA: a start event, a stop event, thresholds in hours: warn (preventive), late (missed), crit (critical).
// Not measured yet (no data): SH-1, SH-3 to SH-5, SH-7, SH-9, SH-10, DE-2 to DE-6, DE-8, CA-1, CA-3 to CA-7, CO-3 to CO-5, CL-*, DO-*.
(function (root) {
  "use strict";
  var M = 1 / 60;
  var DEFS = [
    { id: "SH-2", name: "First sales contact", stage: "Show", target: "5 min", warn: 3 * M, late: 15 * M, crit: 1 },
    { id: "SH-6", name: "R1 held at the planned time", stage: "Show", target: "at the planned time", warn: null, late: 0.75, crit: 48 },
    { id: "SH-8", name: "Follow-up after a no-show", stage: "Show", target: "15 min", warn: null, late: 1, crit: 24 },
    { id: "SH-11", name: "Outcome declared", stage: "Show", target: "15 min", warn: 10 * M, late: 1, crit: 24 },
    { id: "DE-1", name: "Written recap after the call", stage: "Decision", target: "60 min", warn: 0.75, late: 3, crit: 24 },
    { id: "DE-7", name: "Follow-up with no reply", stage: "Decision", target: "24 h", warn: 20, late: 48, crit: 96 },
    { id: "DE-9", name: "Decision stage", stage: "Decision", target: "72 h", warn: 60, late: 72, crit: 144 },
    { id: "CA-2", name: "First payment", stage: "Cash", target: "24 h", warn: 12, late: 24, crit: 48 },
    { id: "CO-1", name: "Reply to a prospect message", stage: "Conversation", target: "15 min", warn: 10 * M, late: 1, crit: 4 }
  ];
  var BY = {}; DEFS.forEach(function (d) { BY[d.id] = d; });
  var RANK = { ok: 0, warn: 1, late: 2, crit: 3 };
  var TOUCH = { im: 1, sms: 1, call: 1 };
  function sTouch(e) { return e.w === "s" && TOUCH[e.k]; }
  function pTouch(e) { return e.w === "p" && TOUCH[e.k]; }
  function held(e, age) { return e.k === "meet" && e.t <= age; }
  function callEnd(e) { return e.t + (e.dur || 45) / 60; }
  function first(ev, f, from) { for (var i = 0; i < ev.length; i++) if (ev[i].t >= (from || 0) && f(ev[i])) return ev[i]; return null; }

  // CO-2: a message received outside 08:00-22:00 starts the clock at the next 08:00
  function windowStart(t, opt) {
    if (!opt || !opt.t0) return t;
    var ms = opt.t0 + t * 3600e3, p = {};
    new Intl.DateTimeFormat("en-US", { timeZone: opt.tz || "America/New_York", hour: "numeric", minute: "numeric", hourCycle: "h23" })
      .formatToParts(new Date(ms)).forEach(function (x) { p[x.type] = Number(x.value); });
    var h = (p.hour || 0) + (p.minute || 0) / 60;
    return h < 8 ? t + (8 - h) : h >= 22 ? t + (24 - h + 8) : t;
  }

  function evaluate(l, opt) {
    var ev = (l.ev || []).slice().sort(function (a, b) { return a.t - b.t; }), age = l.age, out = [];
    var closedEv = first(ev, function (e) { return e.t <= age && (e.k === "paid" || (e.k === "decision" && e.no)); });
    var closedAt = closedEv ? closedEv.t : null;
    // one clock: start, stop (null = still running), the SLA's thresholds; nothing when it stays within the warning
    function clock(id, start, stop, extra) {
      var d = BY[id]; if (start == null || start > age) return;
      if (stop == null && closedAt != null && closedAt >= start) stop = closedAt;
      var end = stop == null ? age : stop, el = end - start, open = stop == null;
      var lv = el >= d.crit ? "crit" : el >= d.late ? "late" : open && d.warn != null && el >= d.warn ? "warn" : "ok";
      if (lv === "ok") return;
      out.push({ id: id, name: d.name, stage: d.stage, target: d.target, level: lv, open: open, start: start, stop: stop, elapsed: el,
        at: start + (lv === "crit" ? d.crit : lv === "late" ? d.late : d.warn), late: start + d.late, extra: extra || "" });
    }
    var booked = first(ev, function (e) { return e.k === "booked"; });
    if (booked) { var c1 = first(ev, sTouch, booked.t); clock("SH-2", booked.t, c1 ? c1.t : null, "since the booking"); }
    // SH-6: the original R1 at its planned time; a no-show starts the recovery, held when a call is held from then on
    // (an R1 past with no outcome and no recording is SH-11's: declare what happened first)
    var r1 = first(ev, function (e) { return (e.k === "meet" || e.k === "meetdue" || e.k === "noshow") && (e.r || 1) === 1; });
    if (r1 && r1.k === "noshow") {
      var h1 = first(ev, function (e) { return held(e, age); }, r1.t);
      clock("SH-6", r1.t, h1 ? h1.t : null, "since the planned R1");
    }
    ev.forEach(function (e, i) {
      if (e.t > age) return;
      if (e.k === "noshow") { var f = first(ev, sTouch, e.t); clock("SH-8", e.t, f ? f.t : null, "since the R" + (e.r || 1) + " no-show"); }
      if (e.k === "meetdue") clock("SH-11", callEnd(e), null, "since the end of R" + (e.r || 1));
      if (e.k === "meet") {
        var end = callEnd(e), dec = first(ev, function (z) { return z.k === "decision" && (z.r || 0) === (e.r || 0); }, end);
        if (dec) clock("SH-11", end, dec.t, "after R" + (e.r || 1));
        if (end <= age) { var rc = first(ev, sTouch, end); clock("DE-1", end, rc ? rc.t : null, "since the end of R" + (e.r || 1)); }
      }
      // CO-1: the first unanswered prospect message of a burst; a call held in between counts as the answer
      if (pTouch(e)) {
        var prev = null; for (var j = i - 1; j >= 0; j--) { if (sTouch(ev[j]) || held(ev[j], age)) break; if (pTouch(ev[j])) { prev = ev[j]; break; } }
        if (prev) return;
        var ans = first(ev, function (z) { return sTouch(z) || held(z, age); }, e.t + 1e-9);
        clock("CO-1", windowStart(e.t, opt), ans ? ans.t : null, "since the prospect wrote");
      }
    });
    var h = first(ev, function (e) { return held(e, age); });
    var decided = h && first(ev, function (e) { return e.k === "decision" && (e.yes || e.no); }, h.t);
    if (h) clock("DE-9", h.t, decided ? decided.t : null, "in the Decision stage");
    // DE-7: in the Decision stage, the sales wrote last, no call ahead
    if (h && !decided && !first(ev, function (e) { return e.k === "meet" && e.t > age; })) {
      var past = ev.filter(function (e) { return e.t <= age && (sTouch(e) || pTouch(e)); }), last = past[past.length - 1];
      if (last && last.w === "s") clock("DE-7", last.t, null, "since the last sales message");
    }
    var yes = first(ev, function (e) { return e.k === "decision" && e.yes; });
    if (yes) { var pd = first(ev, function (e) { return e.k === "paid"; }, yes.t); clock("CA-2", yes.t, pd ? pd.t : null, "since the yes"); }
    return out;
  }
  // the worst open level of a lead: crit, late, warn or ok
  function worst(list) { var w = "ok"; (list || []).forEach(function (b) { if (b.open && RANK[b.level] > RANK[w]) w = b.level; }); return w; }
  function fmt(h) { return h < 1 ? Math.round(h * 60) + " min" : h < 72 ? (Math.round(h * 10) / 10) + " h" : Math.round(h / 24 * 10) / 10 + " d"; }
  root.SKL_SLA = { DEFS: DEFS, evaluate: evaluate, worst: worst, fmt: fmt, RANK: RANK };
})(typeof window !== "undefined" ? window : globalThis);
