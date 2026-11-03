/* SKL OS — one shared source of truth for every screen.
   Key results, tasks, decisions, deliverables, alert acknowledgements, dailies, alert settings and
   mechanism models live in the artifact's shared database when it is available; otherwise the page runs
   on the demo dataset, locally. Every screen reads and writes through window.SKL. */
(function () {
  "use strict";
  var SEED = window.SKL_SEED || { krs: [], tasks: [], decisions: [] };
  var COLS = ["krs", "tasks", "decisions", "deliverables", "acks", "dailies", "config", "mech", "members", "inbox", "reviews", "weeks", "days", "requests"];
  // the OS clock: today's date (noon, local time); window.SKL_TODAY = "YYYY-MM-DD" pins it, for tests and demos
  var TODAY = (function () { var d = window.SKL_TODAY ? new Date(window.SKL_TODAY + "T12:00:00") : new Date(); d.setHours(12, 0, 0, 0); return d; })();
  var Q_START = new Date("2026-09-28T12:00:00");    // Monday of week 1
  var DAY = 86400000;
  var MEMBERS = [
    { id: "amin", name: "Claire Dubois", role: "CEO", cap: 10, stats: { done: 4, doneWas: "→ 4", cycle: "2.0 d", fiab: "90%", prec: "× 1.1" } },
    { id: "romain", name: "Romain", role: "CPO", cap: 8, stats: { done: 8, doneWas: "↑ 7", cycle: "1.8 d", fiab: "85%", prec: "× 1.1" } },
    { id: "marketing", name: "Julie Bernard", role: "CMO · Marketing", cap: 24, stats: { done: 8, doneWas: "↑ 6", cycle: "3.8 d", fiab: "78%", prec: "× 1.3" } },
    { id: "contenu", name: "Hugo Petit", role: "Content Lead", cap: 20, stats: { done: 6, doneWas: "↓ 8", cycle: "3.9 d", fiab: "64%", prec: "× 1.6" } },
    { id: "sales", name: "Camille Martin", role: "Sales", cap: 20, stats: { done: 9, doneWas: "↑ 7", cycle: "2.4 d", fiab: "81%", prec: "× 1.2" } }
  ];

  var data = {};
  COLS.forEach(function (c) { data[c] = new Map(); });
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function loadDemo() {
    COLS.forEach(function (c) { data[c] = new Map(); });
    ["krs", "tasks", "decisions", "reviews", "deliverables"].forEach(function (c) { (SEED[c] || []).forEach(function (d) { data[c].set(d.id, clone(d)); }); });
  }
  loadDemo();

  var listeners = [];
  var db = null, userApi = null, uid = null, readOnly = false, mode = "loading";
  var first = {}; // shared collections whose first snapshot has arrived
  var pendingEmit = false;
  function emit(remote) {
    if (pendingEmit) return;
    pendingEmit = true;
    setTimeout(function () { pendingEmit = false; listeners.forEach(function (fn) { try { fn(remote); } catch (e) { console.error(e); } }); }, 0);
  }

  // ---------- natural id order ----------
  function natural(a, b) {
    var ra = String(a.id).match(/^(\D*)(\d*)(.*)$/), rb = String(b.id).match(/^(\D*)(\d*)(.*)$/);
    if (ra[1] !== rb[1]) return ra[1] < rb[1] ? -1 : 1;
    if (ra[2] !== rb[2]) return (Number(ra[2]) || 0) - (Number(rb[2]) || 0);
    return ra[3] < rb[3] ? -1 : ra[3] > rb[3] ? 1 : 0;
  }

  // ---------- writes: one at a time per document ----------
  var queues = {};
  function write(col, id, body, del) {
    if (!db || readOnly) return;
    var key = col + "/" + id;
    queues[key] = (queues[key] || Promise.resolve()).then(function () {
      var ref = db.collection(col).doc(id);
      return del ? ref.delete() : ref.set(body);
    }).catch(function (e) {
      if (e && e.code === "invalid_argument") { readOnly = true; SKL.notice = "Accès en lecture seule : les modifications ne sont pas enregistrées."; emit(true); }
      else if (e && e.code === "unavailable") { setTimeout(function () { write(col, id, body, del); }, 800 + Math.random() * 800); }
      else console.error("SKL write", key, e);
    });
  }

  function mkId(prefix) { return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  // ---------- dates ----------
  function iso(d) { var x = new Date(d); return x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0") + "-" + String(x.getDate()).padStart(2, "0"); }
  function parse(s) { return s ? new Date(s + "T12:00:00") : null; }
  function daysFromToday(s) { var d = parse(s); return d ? Math.round((d - TODAY) / DAY) : null; }
  function weekOf(s) { var d = parse(s); return d ? Math.max(1, Math.min(13, Math.floor((d - Q_START) / (7 * DAY)) + 1)) : null; }
  function weekFriday(n) { return iso(new Date(Q_START.getTime() + ((n - 1) * 7 + 4) * DAY)); }
  function weekSaturday(n) { return iso(new Date(Q_START.getTime() + ((n - 1) * 7 + 5) * DAY)); }   // the Weekly Review and the check-ins
  function weekSunday(n) { return iso(new Date(Q_START.getTime() + ((n - 1) * 7 + 6) * DAY)); }     // milestones are due Sunday 8 pm
  function weekMonday(n) { return iso(new Date(Q_START.getTime() + (n - 1) * 7 * DAY)); }
  function dayLabel(s) {
    var n = daysFromToday(s); if (n === null) return "—";
    if (n === 0) return "today"; if (n === -1) return "yesterday"; if (n === 1) return "tomorrow";
    var d = parse(s);
    if (n > 1 && n < 7) return d.toLocaleDateString("en-GB", { weekday: "short" }) + " " + d.getDate();
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  }
  function shortDate(s) { var d = parse(s); return d ? d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "—"; }

  // ---------- members ----------
  function member(id) { return MEMBERS.find(function (m) { return m.id === id; }) || { id: id, name: id || "—", role: "", cap: 0, stats: {} }; }

  // ---------- config (alert rules, saved from Settings) ----------
  var RULE_DEFAULTS = {
    a1: [true, "High", 0], a2: [true, "High", 24], a3: [true, "Medium", 8], a4: [true, "Low", 3], a5: [true, "Critical", 0.9],
    a6: [true, "Medium", 0.9], a7: [true, "High", 7], a8: [true, "High", 48], a9: [true, "High", 7], a10: [true, "Medium", 0],
    a11: [true, "High", 100]
  };
  function rule(id) {
    var c = data.config.get("alerts"), d = RULE_DEFAULTS[id];
    var a = c && c.alerts && c.alerts[id], v = c && c.values && c.values[id];
    return { on: a ? !!a.on : d[0], sev: (a && a.sev) || d[1], v: (v === undefined || v === null) ? d[2] : Number(v) };
  }

  // ---------- key results ----------
  function lastCheck(k) {
    var cs = (k.checkins || []).slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; });
    return cs[0] || null;
  }
  // The result of each week of a key result (Romain 2026-10-31): one check-in per quarter week, from the Weekly Review or typed by
  // hand (manual: true). krWeeks(k) = {week: check-in}; setKrWeek(id, week, value) writes or removes (value null) that week's
  // result, keeps the confidence and notes of a check-in that exists, and sets current = the latest week measured. The screens ask
  // first before a recorded value is changed or removed (krWeekAsk).
  function krWeeks(k) { var by = {}; (k && k.checkins || []).forEach(function (c) { if (c && c.week) by[c.week] = c; }); return by; }
  function setKrWeek(id, q, v, lock) {
    var k = get("krs", id); if (!k) return { ok: false, why: "Key result not found" };
    if (readOnly) return { ok: false, why: "Accès en lecture seule : non enregistré" };
    var k2 = clone(k); delete k2.expected; k2.checkins = k2.checkins || [];
    var i = k2.checkins.map(function (c) { return c && c.week; }).lastIndexOf(q);
    if (v === null || v === "" || v === undefined) k2.checkins = k2.checkins.filter(function (c) { return !(c && c.week === q); });
    else if (i >= 0) { k2.checkins[i].value = Number(v); k2.checkins[i].editedAt = iso(TODAY); k2.checkins[i].editedBy = meId || ""; }
    else k2.checkins.push({ week: q, date: weekSaturday(q), value: Number(v), conf: "", moved: "", blocks: "", prios: [], manual: true, by: meId || "" });
    if (lock && v !== null && v !== "" && v !== undefined) { var lc = k2.checkins.filter(function (c) { return c && c.week === q; }).pop(); if (lc) lc.locked = { at: iso(TODAY), by: meId || "" }; }
    k2.checkins.sort(function (a, b) { return (a.week || 0) - (b.week || 0); });
    var ws = k2.checkins.filter(function (c) { return c && c.week && c.value !== "" && c.value != null; });
    k2.current = ws.length ? Number(ws[ws.length - 1].value) : k2.baseline;
    save("krs", k2); return { ok: true };
  }
  // a week's result validated = locked (Romain 2026-11-01): it is changed only after "Modify", asked first on screen
  function lockKrWeek(id, q, on) {
    var k = get("krs", id); if (!k) return { ok: false, why: "Key result not found" };
    if (readOnly) return { ok: false, why: "Accès en lecture seule : non enregistré" };
    var k2 = clone(k); delete k2.expected; var c = (k2.checkins || []).filter(function (x) { return x && x.week === q; }).pop();
    if (!c) return { ok: false, why: "No result for that week yet" };
    if (on) c.locked = { at: iso(TODAY), by: meId || "" }; else delete c.locked;
    save("krs", k2); return { ok: true };
  }
  // A ceiling KR ("stay below X") is on target whenever the value is at or under the target; above it, the ratio drops.
  function isCeiling(k) { return k && k.kind === "ceiling"; }
  function lowerBetter(k) { return isCeiling(k) || Number(k.target) < Number(k.baseline); }
  function ceilRatio(k) { var c = Number(k.current), t = Number(k.target); return c <= t ? 1 : (c > 0 ? t / c : 0); }
  // The plan of a key result: [week, value] points read on the Sunday that ends each week (W1 ends on day 6). Before the first
  // point the plan holds its first value, between points it moves in a straight line, after the last it holds.
  // Without a plan, the expected value is the one stored on the key result.
  function planPts(k) { return (k && Array.isArray(k.plan) ? k.plan : []).map(function (p) { return [Math.max(0, Number(p[0]) * 7 - 1), Number(p[1])]; }).sort(function (a, b) { return a[0] - b[0]; }); }
  function planAt(k, d) {
    var pts = planPts(k); if (!pts.length) return Number(k.expected);
    if (d <= pts[0][0]) return pts[0][1];
    for (var i = 1; i < pts.length; i++) if (d <= pts[i][0]) { var a = pts[i - 1], b = pts[i]; return Math.round((a[1] + (b[1] - a[1]) * (d - a[0]) / ((b[0] - a[0]) || 1)) * 100) / 100; }
    return pts[pts.length - 1][1];
  }
  function planLine(k) {
    var b = Number(k.baseline), t = Number(k.target), pts = planPts(k);
    if (isCeiling(k)) return [[0, t], [91, t]];
    if (!pts.length) return [[0, b], [91, t]];
    return [[0, pts[0][1]]].concat(pts).concat([[91, pts[pts.length - 1][1]]]);
  }
  function withPlan(k) { if (k && Array.isArray(k.plan) && k.plan.length) k.expected = planAt(k, Math.round((TODAY - Q_START) / DAY)); return k; }
  function krProgress(k) {
    if (isCeiling(k)) return ceilRatio(k);
    var dd = Number(k.target) - Number(k.baseline); if (!dd) return 0;
    return Math.max(0, Math.min(1.2, (Number(k.current) - Number(k.baseline)) / dd));
  }
  function krRatio(k) {
    if (isCeiling(k)) return ceilRatio(k);
    var exp = Number(k.expected) - Number(k.baseline), got = Number(k.current) - Number(k.baseline);
    if (!exp) return krProgress(k) >= 1 ? 1 : 0;
    return got / exp;
  }
  function krStatus(k) {
    var last = lastCheck(k);
    if (!last) return { key: "new", label: "New", ratio: null };
    var age = -daysFromToday(last.date);
    var r7 = rule("a7");
    if (r7.on && age > r7.v) return { key: "stale", label: "Not tracked", ratio: krRatio(k), age: age };
    var r = krRatio(k), L = krLanding(k);
    // Without a pace (fewer than two check-ins), the gap to plan decides.
    if (L === null) {
      if (r >= rule("a6").v) return { key: "green", label: "On track", ratio: r, landing: null, why: "At or ahead of plan" };
      if (r >= 0.7) return { key: "amber", label: "At risk", ratio: r, landing: null, why: "Behind plan" };
      return { key: "red", label: "Off track", ratio: r, landing: null, why: "Far behind plan" };
    }
    // With a pace, the projected landing decides; the gap to plan and the owner's confidence can only lower the colour.
    var conf = Number(last.conf) || null;
    if (L < rule("a5").v) return { key: "red", label: "Off track", ratio: r, landing: L, why: "Lands at " + Math.round(L * 100) + "% of the target at the recent pace" };
    if (L < 1) return { key: "amber", label: "At risk", ratio: r, landing: L, why: "Lands short of the target at the recent pace" };
    if (r < rule("a6").v) return { key: "amber", label: "Recovering", ratio: r, landing: L, why: "Behind plan, but the recent pace reaches the target" };
    if (conf !== null && conf < 5) return { key: "amber", label: "Low confidence", ratio: r, landing: L, why: "On pace, but the owner's confidence is " + conf + "/10" };
    return { key: "green", label: "On track", ratio: r, landing: L, why: "On plan and on pace" };
  }
  // Where the KR lands at the pace of its last two check-ins, as a share of the way from baseline to target (capped at 1.25).
  function krLanding(k) {
    var cs = (k.checkins || []).slice().sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    if (cs.length < 2 || isCeiling(k)) return null;
    var a = cs[cs.length - 1], b = cs[cs.length - 2];
    var da = Math.round((parse(a.date) - Q_START) / DAY), db = Math.round((parse(b.date) - Q_START) / DAY);
    if (da <= db) return null;
    var perDay = (Number(a.value) - Number(b.value)) / (da - db);
    var now = Math.round((TODAY - Q_START) / DAY), cur = Number(k.current);
    var land = cur + perDay * Math.max(0, 91 - now);
    var span = Number(k.target) - Number(k.baseline); if (!span) return null;
    return Math.max(-1, Math.min(1.25, (land - Number(k.baseline)) / span));
  }
  function fmtVal(v, u) {
    if (v === "" || v === null || v === undefined || isNaN(Number(v))) return "—";
    v = Number(v);
    if (u === "pct") return v + "%";
    if (u === "eur") return v >= 1000 ? "€" + (Math.round(v / 100) / 10) + "k" : "€" + v;
    if (u === "eur2") return "€" + v.toFixed(2);
    if (u === "usd") return v >= 10000 ? "$" + (Math.round(v / 100) / 10) + "k" : "$" + Math.round(v).toLocaleString("en-GB");
    return v.toLocaleString("en-GB");
  }

  // ---------- tasks ----------
  function isOpen(t) { return t.status !== "done"; }
  function taskWeeks(t) {
    var e = t.end || weekOf(t.due) || 3; var s = t.start || e;
    return { start: Math.min(s, e), end: Math.max(s, e) };
  }
  function load(mid) {
    var m = member(mid), h = 0;
    list("tasks").forEach(function (t) {
      if (t.owner !== mid || !isOpen(t) || t.status === "split") return;
      var n = daysFromToday(t.due); if (n === null || n > 6) return;
      h += Number(t.est) || 0;
    });
    return { hours: h, cap: m.cap, pct: m.cap ? Math.round(h / m.cap * 100) : 0 };
  }

  // ---------- alerts: computed from the data, acknowledged in the shared database ----------
  function alerts() {
    var out = [], tasks = list("tasks"), decs = list("decisions"), krs = list("krs");
    function A(id, rid, alert, subject, pid, detail, since, to, ref, at) {
      var r = rule(rid); if (!r.on) return;
      out.push({ id: id, rule: rid, sev: r.sev, alert: alert, subject: subject, pid: pid, person: member(pid).name, detail: detail, since: since, to: to, ref: ref, at: at || iso(TODAY), area: AREA[rid] || "Other", ruleName: RULE_NAMES[rid] || alert });
    }
    krs.forEach(function (k) {
      var st = krStatus(k);
      if (st.key === "red") A("kr-red-" + k.id, "a5", "KR off track", k.name, k.owner, st.why + ". " + fmtVal(k.current, k.unit) + " for " + fmtVal(k.expected, k.unit) + " expected by now.", lastCheck(k) ? dayLabel(lastCheck(k).date) : "—", "roadmap", k.id, lastCheck(k) && lastCheck(k).date);
      if (st.key === "amber") A("kr-amber-" + k.id, "a6", "KR " + st.label.toLowerCase(), k.name, k.owner, st.why + ". " + fmtVal(k.current, k.unit) + " for " + fmtVal(k.expected, k.unit) + " expected by now.", lastCheck(k) ? dayLabel(lastCheck(k).date) : "—", "roadmap", k.id, lastCheck(k) && lastCheck(k).date);
      if (st.key === "stale") A("kr-stale-" + k.id, "a7", "Missing check-in", k.name, k.owner, "No check-in for " + st.age + " d (threshold " + rule("a7").v + " d). The KR is now Not tracked.", dayLabel(lastCheck(k).date), "roadmap", k.id, iso(new Date(parse(lastCheck(k).date).getTime() + rule("a7").v * DAY)));
    });
    tasks.forEach(function (t) {
      if (!isOpen(t)) return;
      var n = daysFromToday(t.due);
      if (t.status === "blocked" && t.since) {
        var h = Math.round((TODAY - parse(t.since)) / 3600000);
        if (h > rule("a2").v) A("task-blocked-" + t.id, "a2", "Task blocked too long", t.title, t.owner, "Blocked for " + h + " h (threshold " + rule("a2").v + " h)" + (t.note ? ", " + t.note.charAt(0).toLowerCase() + t.note.slice(1) : "") + ".", dayLabel(t.since), "person", t.id, iso(new Date(parse(t.since).getTime() + rule("a2").v * 3600000)));
      }
      if (t.kind === "E" && n !== null && n < 0) A("timebox-" + t.id, "a11", "Timebox used up", t.title, t.owner, "The timebox ended " + dayLabel(t.due) + " with no decision.", dayLabel(t.due), "decisions", t.id, t.due);
      else if (n !== null && n < 0 && t.status !== "split" && (-n * 24) > rule("a1").v) A("task-late-" + t.id, "a1", "Task overdue", t.title, t.owner, (-n) + " d past its committed date" + (t.note ? ". " + t.note : "") + ".", dayLabel(t.due), "person", t.id, t.due);
      if (Number(t.est) > rule("a3").v) A("task-big-" + t.id, "a3", "Task too big", t.title, t.owner, t.est + " h estimate (max " + rule("a3").v + " h)" + (t.unc === "I" ? " on unknown work. Turn it into an exploration." : ". Split it."), dayLabel(t.due), "person", t.id);
    });
    decs.forEach(function (d) {
      if (d.col === "todo" && d.deadline && daysFromToday(d.deadline) < 0) {
        var rid = d.reversible ? "a8" : "a9";
        var nTasks = ((d.links && d.links.task) || []).length;
        A("dec-late-" + d.id, rid, (d.reversible ? "Reversible" : "Irreversible") + " decision overdue", d.title, d.owner, "Deadline " + shortDate(d.deadline) + " passed" + (nTasks ? ". Blocks " + nTasks + (nTasks === 1 ? " task." : " tasks.") : "."), dayLabel(d.deadline), "decisions", d.id, d.deadline);
      }
      if (d.col === "review" && d.review && daysFromToday(d.review) < -rule("a10").v) A("dec-review-" + d.id, "a10", "Decision review due", d.title, d.owner, "The review was due " + shortDate(d.review) + ".", dayLabel(d.review), "decisions", d.id, d.review);
    });
    MEMBERS.forEach(function (m) {
      var wip = tasks.filter(function (t) { return t.owner === m.id && t.status === "progress"; }).length;
      if (wip > rule("a4").v) A("wip-" + m.id, "a4", "Too much work in progress", wip + " tasks in progress", m.id, "Limit is " + rule("a4").v + ". Finish before starting.", "today", "person", m.id);
    });
    var order = { Critical: 0, High: 1, Medium: 2, Low: 3 };
    out.sort(function (a, b) { return (order[a.sev] - order[b.sev]) || (a.person < b.person ? -1 : 1); });
    return out;
  }
  var AREA = { a1: "Tasks", a2: "Tasks", a3: "Tasks", a4: "Tasks", a5: "Key results", a6: "Key results", a7: "Key results", a8: "Decisions", a9: "Decisions", a10: "Decisions", a11: "Tasks" };
  var RULE_NAMES = { a1: "Task overdue", a2: "Task blocked too long", a3: "Task too big", a4: "Too much work in progress", a5: "KR off track", a6: "KR at risk or recovering", a7: "Missing check-in",
    a8: "Reversible decision overdue", a9: "Irreversible decision overdue", a10: "Decision review due", a11: "Timebox used up" };

  // ---------- inbox: the life of each alert, shared by the team ----------
  // inbox/{alertId} = { status: open | handled | snoozed, assignee, snoozeUntil, note, log: [{at, by, what}] }
  function escHours() { var c = data.config.get("alerts"); return (c && c.escH) || 24; }
  function lead(pid) { return pid === "romain" ? "amin" : "romain"; }
  function inboxItem(a) {
    var st = data.inbox.get(a.id) || {};
    var status = st.status || "open", back = false;
    if (status === "snoozed" && st.snoozeUntil && daysFromToday(st.snoozeUntil) <= 0) { status = "open"; back = true; }
    if (!st.status && data.acks.has(a.id)) status = "handled";
    var assignee = st.assignee || a.pid;
    var ageH = Math.max(0, Math.round((TODAY - (parse(a.at) || TODAY)) / 3600000));
    var hot = a.sev === "Critical" || a.sev === "High";
    var esc = hot && status === "open" && ageH > escHours();
    return Object.assign({}, a, {
      status: status, back: back, assignee: assignee, assigneeName: member(assignee).name, snoozeUntil: st.snoozeUntil || "",
      note: st.note || "", log: st.log || [], ageH: ageH, escalated: esc, escalateTo: esc ? lead(assignee) : "",
      escIn: hot && status === "open" && !esc ? escHours() - ageH : null
    });
  }
  function inbox() { return alerts().map(inboxItem); }
  function resolvedInbox() {
    var live = {}; alerts().forEach(function (a) { live[a.id] = 1; });
    return list("inbox").filter(function (d) { return !live[d.id] && d.subject; }).sort(function (a, b) { return (a.lastAt || "") < (b.lastAt || "") ? 1 : -1; });
  }
  var ACT_TEXT = { nudge: "sent a reminder to ", take: "took it", assign: "assigned it to ", snooze: "snoozed it until ", handled: "marked it handled", reopen: "reopened it", note: "added a note", decision: "turned it into a decision", task: "created a fix task" };
  function inboxAct(a, what, patch, extra) {
    var cur = data.inbox.get(a.id) || { id: a.id, status: "open", log: [] };
    var who = meId || "";
    var doc = Object.assign({}, cur, patch || {}, { id: a.id, subject: a.subject, alert: a.alert, sev: a.sev, pid: a.pid, lastAt: iso(TODAY) });
    if (what !== "note") doc.log = (cur.log || []).concat([{ at: iso(TODAY), by: who, what: ACT_TEXT[what] + (extra || "") }]);
    save("inbox", doc);
  }
  // an alert about a person's own task is already visible on that task in My Day
  function onPlan(a, pid) {
    if (a.escalated || a.assignee !== pid || a.pid !== pid) return false;
    return a.area === "Tasks" && a.rule !== "a11";
  }
  function needsYou(pid) { return inbox().filter(function (a) { return a.status === "open" && (a.assignee === pid || a.escalateTo === pid) && !onPlan(a, pid); }); }
  function isAcked(id) {
    var st = data.inbox.get(id);
    if (st && st.status) return st.status === "handled" || (st.status === "snoozed" && st.snoozeUntil && daysFromToday(st.snoozeUntil) > 0);
    return data.acks.has(id);
  }
  function setAck(id, on) {
    var a = alerts().find(function (x) { return x.id === id; }) || { id: id, subject: "", alert: "", sev: "", pid: "" };
    inboxAct(a, on ? "handled" : "reopen", { status: on ? "handled" : "open", snoozeUntil: "" });
  }

  // ---------- helpers other screens share ----------
  function createDecision(d) {
    var body = Object.assign({ title: "", question: "", col: "todo", owner: meId || "romain", reversible: true, deadline: iso(new Date(TODAY.getTime() + 2 * DAY)),
      opened: iso(TODAY), decided: "", review: "", reviewNote: "", source: "", chosen: -1, expected: "", actual: "",
      frame: { problem: "", vars: [{ name: "", w: 34, ctx: "" }, { name: "", w: 33, ctx: "" }, { name: "", w: 33, ctx: "" }], opts: [{ name: "", desc: "", sc: [0, 0, 0] }, { name: "", desc: "", sc: [0, 0, 0] }, { name: "", desc: "", sc: [0, 0, 0] }] },
      links: { kr: [], task: [], del: [] } }, d || {});
    return save("decisions", body);
  }

  // ---------- weekly review ----------
  function reviewId(w) { return "2026-W" + String(w).padStart(2, "0"); }
  // Pulse: median days over the last 4 weeks, and over the 4 weeks before (prev)
  function median(a) { if (!a.length) return null; a = a.slice().sort(function (x, y) { return x - y; }); var m = Math.floor(a.length / 2); return Math.round((a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2) * 10) / 10; }
  function flowStats() {
    var now = TODAY.getTime(), w4 = 28 * DAY;
    function span(items, from, to, end) {
      var cur = [], prev = [];
      items.forEach(function (x) {
        var a = parse(x[from]), b = parse(x[to]); if (!a || !b || b < a) return;
        var age = now - b.getTime(), d = Math.max(0, Math.round((b - a) / DAY));
        if (age >= 0 && age < w4) cur.push(d); else if (age >= w4 && age < 2 * w4) prev.push(d);
      });
      return { v: median(cur), prev: median(prev), n: cur.length };
    }
    return { cycle: span(list("tasks").filter(function (t) { return t.status === "done"; }), "startedAt", "doneAt"),
             decision: span(list("decisions").filter(function (d) { return d.decided; }), "opened", "decided") };
  }
  // calendar week (ISO 8601) of week w of the quarter: what every screen shows ("W42"); data keeps 1..13
  function isoWeek(w) {
    var d = new Date(Q_START.getTime() + (w - 1) * 7 * DAY + 3 * DAY);   // Thursday of that week
    var y = d.getFullYear(), jan4 = new Date(y, 0, 4, 12), mon1 = new Date(jan4.getTime() - ((jan4.getDay() + 6) % 7) * DAY);
    return 1 + Math.round((d - mon1) / (7 * DAY));
  }
  function wl(w) { return "W" + isoWeek(w); }
  // ---------- weekly milestones (SKL operating standard: one person, one week, one verifiable result) ----------
  // Formula: "By [day, time], [verifiable result], which moves KR x.y. Done = [binary proof]".
  // A milestone: { week, text (the result), owner?, byDay, byTime, doneDef: [{t, ok}] (mini goals, ticked at the weekly review), deps: [{who, what, by}], noDeps,
  //   chk: {fit, stretch}, rag: "green"|"amber"|"red", ragNote, status: "done"|"notdone", proof, cause, causeNote, changedV }
  var MS_DAYS = [["mon", "Monday"], ["tue", "Tuesday"], ["wed", "Wednesday"], ["thu", "Thursday"], ["fri", "Friday"], ["sat", "Saturday"], ["sun", "Sunday"]];
  var MS_CAUSES = [["estimation", "Estimation"], ["dependency", "Dependency"], ["priority", "Priority"], ["skill", "Skill"], ["commitment", "Commitment"]];
  var MS_ACTIVITY = ["work on", "working on", "prepare", "preparing", "improve", "improving", "look into", "looking into", "follow up", "following up", "continue", "start working", "think about", "help with"];
  function msStatus(m) {   // done · notdone · review (past week, no verdict yet) · current · planned
    var wk = weekOf(iso(TODAY));
    if (m.status === "done" || (m.done && m.status !== "notdone")) return "done";
    if (m.status === "notdone") return "notdone";
    if (m.week < wk) return "review";
    return m.week === wk ? "current" : "planned";
  }
  function msDueDate(m) {
    var i = Math.max(0, MS_DAYS.map(function (d) { return d[0]; }).indexOf(m.byDay || "sun"));
    return new Date(Q_START.getTime() + ((m.week - 1) * 7 + i) * DAY);
  }
  function msBy(m) {
    var day = (MS_DAYS.filter(function (d) { return d[0] === (m.byDay || "sun"); })[0] || MS_DAYS[6])[1];
    var t = (m.byTime || "20:00").split(":"), h = Number(t[0]), mn = t[1] || "00";
    var time = (h % 12 || 12) + (mn !== "00" ? ":" + mn : "") + (h < 12 ? " am" : " pm");
    return day + " " + time + " of " + wl(m.week) + " (" + msDueDate(m).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) + ")";
  }
  function krNumber(k) { var x = /^(\d+\.\d+)/.exec((k && k.name) || ""); return x ? x[1] : (k && k.id) || ""; }
  function msFormula(m, k) {
    return "By " + msBy(m) + ", " + ((m.text || "").trim().replace(/\.$/, "") || "[verifiable result]") + ", which moves KR " + krNumber(k) + ".";
  }
  function msActivity(text) {
    var t = " " + String(text || "").toLowerCase().replace(/[^a-z ]+/g, " ") + " ";
    return MS_ACTIVITY.filter(function (v) { return t.indexOf(" " + v + " ") >= 0; })[0] || "";
  }
  // mini goals of a milestone ("Done ="): as many as needed, each ticked at the weekly review; old data kept plain strings
  function msGoals(m) {
    return (m && m.doneDef || []).map(function (x) { return typeof x === "string" ? { t: x, ok: false } : { t: String(x && x.t || ""), ok: !!(x && x.ok) }; })
      .filter(function (g) { return g.t.trim(); });
  }
  // the 7-point check before Saturday; auto: true when the OS can verify it, false when the owner confirms it
  function msChecks(m, k) {
    var defs = msGoals(m);
    var deps = (m.deps || []).filter(function (d) { return d && (d.who || d.what); });
    return [
      { id: "result", label: "It is a result, not an activity", ok: !!(m.text || "").trim() && !msActivity(m.text), auto: true },
      { id: "kr", label: "It names the one KR it moves (KR " + krNumber(k) + ")", ok: true, auto: true },
      { id: "owner", label: "It has one owner, who proposed it", ok: !!(m.owner || (k && k.owner)), auto: true },
      { id: "done", label: "“Done” is binary: 2 or more mini goals anyone can check", ok: defs.length >= 2, auto: true },
      { id: "fit", label: "It fits in 50–60% of the week", ok: !!(m.chk && m.chk.fit), auto: false },
      { id: "deps", label: "Its dependencies are assigned", ok: m.noDeps ? true : deps.length > 0 && deps.every(function (d) { return d.who && d.what && d.by; }), auto: true },
      { id: "stretch", label: "It stretches you: uncomfortable, but doable", ok: !!(m.chk && m.chk.stretch), auto: false }
    ];
  }
  // 13-week roadmap versions: v1 frozen at the first weekly review, never overwritten; each change is a dated version
  function rmVersion(k) { return k && k.rm && k.rm.v ? k.rm.v : 0; }
  function checkedThisWeek(k) { var l = lastCheck(k); return !!(l && l.date >= weekMonday(weekOf(iso(TODAY)))); }
  // milestones reached per finished week (Romain 2026-11-01: the promises are gone; the weekly milestones are the commitment):
  // [{week, done, total, pct}] for each past quarter week that had milestones; "Target…" milestones do not count
  function milestoneStats() {
    var wk = weekOf(iso(TODAY)), by = {};
    list("krs").forEach(function (k) { (k.miles || []).forEach(function (m) {
      var q = Number(m.week); if (!(q >= 1 && q < wk) || /^target/i.test(String(m.text || "").trim())) return;
      var b = by[q] || (by[q] = { week: q, done: 0, total: 0 }); b.total++; if (msStatus(m) === "done") b.done++;
    }); });
    return Object.keys(by).map(Number).sort(function (a, b) { return a - b; }).map(function (q) { var b = by[q]; b.pct = Math.round(b.done / b.total * 100); return b; });
  }


  // ---------- the plan (Roadmap v2) and the work (My Day v2) ----------
  // A milestone: { id, week, text, owner? (default: the KR owner), inits? (indexes of the initiatives that deliver it;
  //   default: all of them), sharedWith? (["krId:mileId"], one piece of work that counts for several KRs), done, … }.
  // A task: { id, title, kr, init, mile? (milestone id; required for tasks created in My Day), owner, due, est, status,
  //   kind ("L" deliver, "E" explore), doneWhen?, note, … }. Old documents get their defaults when read.
  var MS_MAX = 3, WIP_MAX = 3, TASK_MAX_H = 8;
  function normKr(k) {
    if (!k) return k;
    (k.miles || []).forEach(function (m, i) { if (!m.id) m.id = k.id + "-m" + i; });
    return k;
  }
  function msOwner(k, m) { return (m && m.owner) || (k && k.owner) || ""; }
  function msInits(k, m) { return Array.isArray(m && m.inits) ? m.inits.slice() : (k.inits || []).map(function (_, i) { return i; }); }
  function msIsTarget(m) { return /^\s*target\b/i.test((m && m.text) || ""); }
  function msReached(m) { return m.status === "done" || (!!m.done && m.status !== "notdone"); }
  function findMile(mid) {
    var out = null;
    list("krs").some(function (k) { return (k.miles || []).some(function (m, i) { if (m.id === mid) { out = { kr: k, mile: m, i: i }; return true; } return false; }); });
    return out;
  }
  // milestones of one person in one week: a shared milestone counts once, targets do not count (max 3)
  function milestoneLoad(who, week) {
    var seen = {}, items = [];
    list("krs").forEach(function (k) {
      (k.miles || []).forEach(function (m) {
        if (Number(m.week) !== Number(week) || msOwner(k, m) !== who || msIsTarget(m)) return;
        var key = [k.id + ":" + m.id].concat(m.sharedWith || []).sort()[0];
        if (seen[key]) return; seen[key] = 1;
        items.push({ kr: k, mile: m });
      });
    });
    return { n: items.length, max: MS_MAX, over: items.length > MS_MAX, full: items.length >= MS_MAX, items: items };
  }
  function loadOver() {
    var out = [], wk = weekOf(iso(TODAY));
    MEMBERS.forEach(function (p) { for (var w = wk; w <= 13; w++) { var l = milestoneLoad(p.id, w); if (l.over) out.push({ who: p.id, week: w, n: l.n }); } });
    return out;
  }
  // from the current week to week 13, two weeks in a row without a milestone is a gap
  function coverageGaps(k) {
    var wk = weekOf(iso(TODAY)), has = {}, gaps = [], run = null;
    (k.miles || []).forEach(function (m) { has[Number(m.week)] = 1; });
    for (var w = wk; w <= 13; w++) {
      if (!has[w]) { if (!run) run = { from: w, to: w }; else run.to = w; }
      else { if (run && run.to > run.from) gaps.push(run); run = null; }
    }
    if (run && run.to > run.from) gaps.push(run);
    return gaps;
  }
  function uncoveredWeeks(k) { return coverageGaps(k).reduce(function (a, g) { return a + g.to - g.from + 1; }, 0); }
  function inGap(k, w) { return coverageGaps(k).some(function (g) { return w >= g.from && w <= g.to; }); }
  // past milestones nobody marked reached (or not reached)
  function unmarked(k) { return (k.miles || []).filter(function (m) { return msStatus(m) === "review"; }); }
  // every initiative needs an open task due within the next 2 weeks
  function initTasks(k, i) { return list("tasks").filter(function (t) { return t.kr === k.id && Number(t.init) === Number(i); }); }
  function hasNextAction(k, i) {
    return initTasks(k, i).some(function (t) { var n = daysFromToday(t.due); return isOpen(t) && t.status !== "split" && n !== null && n <= 14; });
  }
  function nextActionGaps(k) { return (k.inits || []).map(function (x, i) { return { i: i, name: x.name }; }).filter(function (x) { return !hasNextAction(k, x.i); }); }
  // check-ins are done on Saturday: overdue once a Saturday has passed with no check-in in the week that ends on it
  function lastSaturday() { var d = new Date(TODAY), back = (d.getDay() + 1) % 7 || 7; return new Date(d.getTime() - back * DAY); }
  function checkinDue(k) {
    var sat = lastSaturday(), from = iso(new Date(sat.getTime() - 6 * DAY)), l = lastCheck(k);
    var ok = !!(l && l.date >= from);
    return { overdue: !ok, due: iso(sat), last: l };
  }
  // Plan health: what the plan is missing (Roadmap cards, Roadmap badge)
  function planHealth(who) {
    var cov = [], next = [], krs = list("krs");
    krs.forEach(function (k) {
      coverageGaps(k).forEach(function (g) { cov.push({ kind: "gap", kr: k.id, from: g.from, to: g.to, owner: k.owner }); });
      unmarked(k).forEach(function (m) { cov.push({ kind: "unmarked", kr: k.id, mile: m.id, week: m.week, owner: msOwner(k, m) }); });
      nextActionGaps(k).forEach(function (x) { next.push({ kr: k.id, i: x.i, name: x.name, owner: k.owner }); });
    });
    var load = loadOver();
    if (who) { cov = cov.filter(function (x) { return x.owner === who; }); next = next.filter(function (x) { return x.owner === who; }); load = load.filter(function (x) { return x.who === who; }); }
    return { coverage: cov, next: next, load: load, count: cov.length + next.length + load.length };
  }
  // quick add: "Review two lost calls @valentino fri 3h"; "Explore: …" makes an exploration
  var DOW = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  function quickAdd(text, ctx) {
    ctx = ctx || {};
    var t = " " + String(text || "") + " ", out = { owner: ctx.owner || meId || "", due: ctx.due || weekFriday(weekOf(iso(TODAY))), est: ctx.est || 2, kind: "L" };
    t = t.replace(/\s@([A-Za-zÀ-ÿ][\w.-]*)/g, function (all, n) {
      var q = n.toLowerCase(), m = MEMBERS.find(function (x) { return x.name.toLowerCase().indexOf(q) === 0 || x.id.toLowerCase().indexOf(q) === 0; });
      if (m) { out.owner = m.id; return " "; } return all;
    });
    t = t.replace(/\s(\d+(?:[.,]\d+)?)\s?h(?=\s)/i, function (all, n) { out.est = Number(n.replace(",", ".")); return " "; });
    t = t.replace(/\s(today|tomorrow|mon(?:day)?|tue(?:s|sday)?|wed(?:nesday)?|thu(?:rs|rsday)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)(?=\s)/i, function (all, d) {
      d = d.toLowerCase();
      if (d === "today") out.due = iso(TODAY);
      else if (d === "tomorrow") out.due = iso(new Date(TODAY.getTime() + DAY));
      else { var target = DOW.indexOf(d.slice(0, 3)), n = (target - TODAY.getDay() + 7) % 7; out.due = iso(new Date(TODAY.getTime() + n * DAY)); }
      return " ";
    });
    var title = t.replace(/\s+/g, " ").trim();
    if (/^explore\s*:/i.test(title)) out.kind = "E";
    out.title = title;
    out.tooBig = out.est > TASK_MAX_H;
    out.preview = "Will create: @" + member(out.owner).name + " · Due " + dayName(out.due) + " · " + out.est + " h · " + (out.kind === "E" ? "Explore" : "Deliver");
    return out;
  }
  function dayName(s) { var d = parse(s); return d ? d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }).replace(",", "") : "—"; }
  // tasks: only their owner checks, moves, re-dates or deletes them (My Day enforces it here, not only on screen)
  function canEditTask(t) { return !!(meId && t && t.owner === meId && !readOnly); }
  function taskUpdate(id, patch) {
    var t = get("tasks", id); if (!t) return { ok: false, why: "Task not found" };
    if (!canEditTask(t)) return { ok: false, why: meId ? "Only " + member(t.owner).name + " can change this task" : "Choose who you are first" };
    var n = Object.assign(clone(t), patch);
    if (n.status === "blocked" && !n.since) n.since = iso(TODAY);
    if (n.status !== "blocked") n.since = "";
    if (n.status === "done") n.doneAt = n.doneAt || iso(TODAY); else n.doneAt = "";
    save("tasks", n); return { ok: true };
  }
  // An admin deletes any task of the OS, anyone's (Romain 2026-10-31): the admins of the web edition (html.skl-admin, set by
  // skl-web.js from the account's role); in the Artifact and the plain file, where there are no accounts, the leads (CEO, CPO).
  // The connector's write tools are for admins only and pass opts.admin. opts.review: in the Weekly Review a lead may too.
  function isAdmin() {
    if (readOnly) return false;
    // the web edition's admin is the signed-in account: no need to have chosen "You are" first
    try { if (window.claude && window.claude.web) return document.documentElement.classList.contains("skl-admin"); } catch (e) {}
    return !!meId && /CEO|CPO/.test(member(meId).role || "");
  }
  function canDeleteTask(t) { return !!t && (canEditTask(t) || isAdmin()); }
  function taskDelete(id, opts) {
    var t = get("tasks", id); if (!t) return { ok: false, why: "Task not found" };
    var leadOk = !!(opts && (opts.admin || opts.review) && meId && !readOnly && (opts.admin || /CEO|CPO/.test(member(meId).role || "")));
    if (!canDeleteTask(t) && !leadOk) return { ok: false, why: meId || readOnly ? "Only " + member(t.owner).name + " or an admin can delete this task" : "Choose who you are first (Settings › Account)" };
    remove("tasks", id); return { ok: true };
  }
  // a new task; from My Day it needs a milestone and an initiative (opts.needMile)
  function taskCreate(f, opts) {
    opts = opts || {};
    var miss = [];
    if (opts.needMile && !f.mile) miss.push("choose a milestone");
    if (opts.needMile && !(Number(f.init) >= 0)) miss.push("choose an initiative");
    if (!String(f.title || "").trim()) miss.push("write the task");
    if (miss.length) return { ok: false, why: "Still missing: " + miss.join(", ") + "." };
    if (Number(f.est) > TASK_MAX_H) return { ok: false, why: "Over 8 h: split it before you start" };
    if (readOnly) return { ok: false, why: "Accès en lecture seule : non enregistré" };
    var t = { id: mkId("t"), title: String(f.title).trim(), kr: f.kr || "", init: Number(f.init) >= 0 ? Number(f.init) : -1, mile: f.mile || "", owner: f.owner || meId || "",
      due: f.due, est: f.est === 0 ? 0 : Number(f.est) || 2, status: f.status || "todo", kind: f.kind || "L", unc: f.kind === "E" ? "I" : "C", note: f.note || "", since: "",
      doneWhen: f.doneWhen || "", start: weekOf(f.due), end: weekOf(f.due), by: meId || "" };
    if (Array.isArray(f.deps) && f.deps.length) t.deps = f.deps.slice();     // Build: tasks it waits on
    if (Number(f.notBefore) > 0) t.notBefore = Number(f.notBefore);          // Build: ISO week it cannot start before
    if (t.status === "blocked") t.since = iso(TODAY);
    save("tasks", t); return { ok: true, id: t.id, task: t };
  }
  // deleting an initiative removes its tasks and shifts the indexes after it; returns what Undo needs
  function deleteInit(krId, i) {
    var k = get("krs", krId); if (!k || !k.inits || !k.inits[i]) return null;
    var before = { kr: clone(k), tasks: list("tasks").filter(function (t) { return t.kr === krId; }).map(clone) };
    var k2 = clone(k); k2.inits.splice(i, 1);
    (k2.miles || []).forEach(function (m) { if (Array.isArray(m.inits)) m.inits = m.inits.filter(function (x) { return x !== i; }).map(function (x) { return x > i ? x - 1 : x; }); });
    var gone = 0;
    before.tasks.forEach(function (t) {
      var ti = Number(t.init);
      if (ti === i) { remove("tasks", t.id); gone++; }
      else if (ti > i) save("tasks", Object.assign(clone(t), { init: ti - 1 }));
    });
    save("krs", k2);
    return { before: before, tasks: gone };
  }
  function restore(snap) {
    if (!snap) return;
    save("krs", clone(snap.kr));
    var ids = {}; snap.tasks.forEach(function (t) { ids[t.id] = 1; save("tasks", clone(t)); });
    return ids;
  }

  // ---------- public API ----------
  function list(col) { var a = Array.from(data[col].values()).sort(natural); if (col === "krs") a.forEach(function (k) { withPlan(normKr(k)); }); return a; }
  function get(col, id) { var d = data[col].get(id) || null; return col === "krs" ? withPlan(normKr(d)) : d; }
  function save(col, doc) {
    if (!doc.id) doc.id = mkId(col.charAt(0));
    if (col === "tasks") { // start and delivery dates, for the cycle time
      if (!doc.startedAt && (doc.status === "progress" || doc.status === "blocked" || doc.status === "done")) doc.startedAt = iso(TODAY);
      if (doc.status === "done" && !doc.doneAt) doc.doneAt = iso(TODAY);
    }
    var body = clone(doc);
    data[col].set(doc.id, body);
    write(col, doc.id, body);
    emit(false);
    return doc.id;
  }
  function remove(col, id) { data[col].delete(id); write(col, id, null, true); emit(false); }

  var meId = null;
  try { meId = localStorage.getItem("skl_me"); } catch (e) {}
  function setMe(mid) {
    meId = mid;
    try { localStorage.setItem("skl_me", mid); } catch (e) {}
    if (db && uid) write("members", uid, { id: uid, member: mid });
    emit(false);
  }

  var SKL = window.SKL = {
    get today() { return TODAY; }, get week() { return weekOf(iso(TODAY)); }, iso: iso, parse: parse, daysFromToday: daysFromToday, weekOf: weekOf,
    weekFriday: weekFriday, weekSaturday: weekSaturday, weekSunday: weekSunday, weekMonday: weekMonday, dayLabel: dayLabel, shortDate: shortDate,
    members: MEMBERS, member: member,
    list: list, get: get, save: save, remove: remove, newId: mkId,
    isoWeek: isoWeek, wl: wl,
    msStatus: msStatus, msBy: msBy, msFormula: msFormula, msChecks: msChecks, msGoals: msGoals, msActivity: msActivity, msDueDate: msDueDate, krNumber: krNumber, rmVersion: rmVersion,
    msDays: MS_DAYS, msCauses: MS_CAUSES, krStatus: krStatus, krLanding: krLanding, krProgress: krProgress, krRatio: krRatio, lowerBetter: lowerBetter, planAt: planAt, planLine: planLine, flowStats: flowStats, lastCheck: lastCheck, krWeeks: krWeeks, setKrWeek: setKrWeek, lockKrWeek: lockKrWeek, fmtVal: fmtVal,
    taskWeeks: taskWeeks, load: load, isOpen: isOpen,
    MS_MAX: MS_MAX, WIP_MAX: WIP_MAX, TASK_MAX_H: TASK_MAX_H, msOwner: msOwner, msInits: msInits, msIsTarget: msIsTarget, msReached: msReached, findMile: findMile,
    milestoneLoad: milestoneLoad, loadOver: loadOver, coverageGaps: coverageGaps, uncoveredWeeks: uncoveredWeeks, inGap: inGap, unmarked: unmarked,
    initTasks: initTasks, hasNextAction: hasNextAction, nextActionGaps: nextActionGaps, checkinDue: checkinDue, lastSaturday: lastSaturday, planHealth: planHealth,
    quickAdd: quickAdd, dayName: dayName, canEditTask: canEditTask, canDeleteTask: canDeleteTask, isAdmin: isAdmin, taskUpdate: taskUpdate, taskDelete: taskDelete, taskCreate: taskCreate,
    deleteInit: deleteInit, restore: restore,
    alerts: alerts, isAcked: isAcked, setAck: setAck, rule: rule,
    inbox: inbox, resolvedInbox: resolvedInbox, onPlan: onPlan, needsYou: needsYou, inboxAct: inboxAct, escHours: escHours, lead: lead, area: AREA, ruleNames: RULE_NAMES,
    createDecision: createDecision, reviewId: reviewId, checkedThisWeek: checkedThisWeek, milestoneStats: milestoneStats,
    get me() { return meId; }, setMe: setMe,
    get mode() { return mode; }, get readOnly() { return readOnly; }, notice: "",
    onChange: function (fn) { listeners.push(fn); },
    // true once a collection holds the shared data (demo: at once); a screen must not save over a collection not read yet
    isLoaded: function (c) { return mode === "demo" || (mode === "shared" && !!first[c]); },
    badges: function () {
      var open = inbox().filter(function (a) { return a.status === "open"; });
      var mine = meId ? needsYou(meId) : open.filter(function (a) { return a.escalated; });
      var mytasks = list("tasks").filter(function (t) { var n = daysFromToday(t.due); return isOpen(t) && t.status !== "split" && (!meId || t.owner === meId) && n !== null && n <= 0; }).length;
      var dec = list("decisions").filter(function (d) { return d.col === "todo" || d.col === "review"; }).length;
      var missing = list("krs").filter(function (k) { return !checkedThisWeek(k); }).length;
      var overdueCk = meId ? list("krs").filter(function (k) { return k.owner === meId && checkinDue(k).overdue; }).length : 0;
      return { inbox: mine.length, myday: mine.length + mytasks + overdueCk, decisions: dec, review: missing, roadmap: planHealth(meId || null).count };
    }
  };

  // ---------- the clock follows the calendar: a page left open overnight moves to the new day ----------
  if (!window.SKL_TODAY) setInterval(function () {
    var d = new Date(); d.setHours(12, 0, 0, 0);
    if (iso(d) !== iso(TODAY)) { TODAY = d; emit(true); }
  }, 60000);

  // ---------- connect to the shared database ----------
  function start() {
    if (!window.claude || typeof window.claude.use !== "function") { mode = "demo"; emit(true); return; }
    Promise.all([window.claude.use("db"), window.claude.use("user")]).then(function (res) {
      db = res[0]; userApi = res[1];
      if (!db) { mode = "demo"; emit(true); return; }
      mode = "shared";
      COLS.forEach(function (c) {
        db.collection(c).onSnapshot(function (snap) {
          var m = new Map(), changed = !first[c];
          snap.docs.forEach(function (d) {
            var body = d.data(); if (!body) return;
            var b = Object.assign({}, clone(body), { id: d.id });
            var cur = data[c].get(d.id);
            if (!cur || JSON.stringify(cur) !== JSON.stringify(b)) changed = true;
            m.set(d.id, b);
          });
          if (m.size !== data[c].size) changed = true;
          first[c] = true;
          data[c] = m;
          if (c === "members" && uid) { var mine = m.get(uid); if (mine && mine.member && mine.member !== meId) { meId = mine.member; try { localStorage.setItem("skl_me", meId); } catch (e) {} changed = true; } }
          if (changed) emit(true);
        }, function (err) { console.error("SKL snapshot", c, err); });
      });
      if (userApi) userApi.id().then(function (id) {
        uid = id;
        if (uid && data.members.get(uid)) { meId = data.members.get(uid).member; emit(true); }
        else if (uid && meId) write("members", uid, { id: uid, member: meId });
      });
      if (userApi && userApi.can) userApi.can("data.write").then(function (w) { if (w === false) { readOnly = true; SKL.notice = "Accès en lecture seule : les modifications ne sont pas enregistrées."; emit(true); } });
      emit(true);
    }).catch(function (e) { console.error(e); mode = "demo"; emit(true); });
  }
  start();
})();
