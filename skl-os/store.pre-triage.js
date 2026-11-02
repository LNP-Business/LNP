/* SKL OS — one shared source of truth for every screen.
   Key results, tasks, decisions, deliverables, alert acknowledgements, dailies, alert settings and
   mechanism models live in the artifact's shared database when it is available; otherwise the page runs
   on the demo dataset, locally. Every screen reads and writes through window.SKL. */
(function () {
  "use strict";
  var SEED = window.SKL_SEED || { krs: [], tasks: [], decisions: [] };
  var COLS = ["krs", "tasks", "decisions", "deliverables", "acks", "dailies", "config", "mech", "members", "inbox", "reviews"];
  var TODAY = new Date("2026-10-13T12:00:00");      // the OS clock (week 3 of Q4 2026)
  var Q_START = new Date("2026-09-28T12:00:00");    // Monday of week 1
  var DAY = 86400000;
  var MEMBERS = [
    { id: "amin", name: "Amin", role: "CEO", cap: 10, stats: { done: 4, doneWas: "→ 4", cycle: "2.0 d", fiab: "90%", prec: "× 1.1" } },
    { id: "romain", name: "Romain", role: "CPO", cap: 8, stats: { done: 8, doneWas: "↑ 7", cycle: "1.8 d", fiab: "85%", prec: "× 1.1" } },
    { id: "marketing", name: "Michael", role: "CMO · Marketing", cap: 24, stats: { done: 8, doneWas: "↑ 6", cycle: "3.8 d", fiab: "78%", prec: "× 1.3" } },
    { id: "contenu", name: "Ilya", role: "Content Lead", cap: 20, stats: { done: 6, doneWas: "↓ 8", cycle: "3.9 d", fiab: "64%", prec: "× 1.6" } },
    { id: "sales", name: "Sales Lead", role: "Sales", cap: 20, stats: { done: 9, doneWas: "↑ 7", cycle: "2.4 d", fiab: "81%", prec: "× 1.2" } }
  ];

  var data = {};
  COLS.forEach(function (c) { data[c] = new Map(); });
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function loadDemo() {
    COLS.forEach(function (c) { data[c] = new Map(); });
    ["krs", "tasks", "decisions", "reviews"].forEach(function (c) { (SEED[c] || []).forEach(function (d) { data[c].set(d.id, clone(d)); }); });
  }
  loadDemo();

  var listeners = [];
  var db = null, userApi = null, uid = null, readOnly = false, mode = "loading";
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
      if (e && e.code === "invalid_argument") { readOnly = true; SKL.notice = "Read-only access: changes are not saved."; emit(true); }
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
    a11: [true, "High", 100], a13: [true, "High", 110], a14: [true, "Medium", 70]
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
  function krProgress(k) {
    var dd = Number(k.target) - Number(k.baseline); if (!dd) return 0;
    return Math.max(0, Math.min(1.2, (Number(k.current) - Number(k.baseline)) / dd));
  }
  function krRatio(k) {
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
    if (cs.length < 2) return null;
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
      var l = load(m.id);
      var wip = tasks.filter(function (t) { return t.owner === m.id && t.status === "progress"; }).length;
      if (l.pct > rule("a13").v) A("load-over-" + m.id, "a13", "Person overloaded", "Planned load " + l.pct + "%", m.id, l.hours + " h planned for " + l.cap + " h available over the next 7 days.", "today", "person", m.id);
      else if (l.pct > rule("a14").v) A("load-" + m.id, "a14", "No buffer left", "Planned load " + l.pct + "%", m.id, "Above " + rule("a14").v + "% of capacity for the next 7 days (" + l.hours + " h of " + l.cap + " h).", "today", "person", m.id);
      if (wip > rule("a4").v) A("wip-" + m.id, "a4", "Too much work in progress", wip + " tasks in progress", m.id, "Limit is " + rule("a4").v + ". Finish before starting.", "today", "person", m.id);
    });
    var order = { Critical: 0, High: 1, Medium: 2, Low: 3 };
    out.sort(function (a, b) { return (order[a.sev] - order[b.sev]) || (a.person < b.person ? -1 : 1); });
    return out;
  }
  var AREA = { a1: "Tasks", a2: "Tasks", a3: "Tasks", a4: "Load", a5: "Key results", a6: "Key results", a7: "Key results", a8: "Decisions", a9: "Decisions", a10: "Decisions", a11: "Tasks", a13: "Load", a14: "Load" };
  var RULE_NAMES = { a1: "Task overdue", a2: "Task blocked too long", a3: "Task too big", a4: "Too much work in progress", a5: "KR off track", a6: "KR at risk or recovering", a7: "Missing check-in",
    a8: "Reversible decision overdue", a9: "Irreversible decision overdue", a10: "Decision review due", a11: "Timebox used up", a13: "Person overloaded", a14: "No buffer left" };

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
  function checkedThisWeek(k) { var l = lastCheck(k); return !!(l && l.date >= weekMonday(weekOf(iso(TODAY)))); }
  function promiseStats() {
    // results live in the review that followed the commitments
    return list("reviews").filter(function (r) { return r.status === "closed" && r.results && r.prevCommitments && r.prevCommitments.length; }).sort(function (a, b) { return a.week - b.week; }).map(function (r) {
      var tot = r.prevCommitments.length, kept = r.prevCommitments.filter(function (c) { return r.results[c.id] && r.results[c.id].kept; }).length;
      return { week: r.week - 1, kept: kept, total: tot, pct: tot ? Math.round(kept / tot * 100) : 0 };
    });
  }

  // ---------- public API ----------
  function list(col) { return Array.from(data[col].values()).sort(natural); }
  function get(col, id) { return data[col].get(id) || null; }
  function save(col, doc) {
    if (!doc.id) doc.id = mkId(col.charAt(0));
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
    today: TODAY, week: weekOf(iso(TODAY)), iso: iso, parse: parse, daysFromToday: daysFromToday, weekOf: weekOf,
    weekFriday: weekFriday, weekMonday: weekMonday, dayLabel: dayLabel, shortDate: shortDate,
    members: MEMBERS, member: member,
    list: list, get: get, save: save, remove: remove, newId: mkId,
    krStatus: krStatus, krLanding: krLanding, krProgress: krProgress, krRatio: krRatio, lastCheck: lastCheck, fmtVal: fmtVal,
    taskWeeks: taskWeeks, load: load, isOpen: isOpen,
    alerts: alerts, isAcked: isAcked, setAck: setAck, rule: rule,
    inbox: inbox, resolvedInbox: resolvedInbox, inboxAct: inboxAct, escHours: escHours, lead: lead, area: AREA, ruleNames: RULE_NAMES,
    createDecision: createDecision, reviewId: reviewId, checkedThisWeek: checkedThisWeek, promiseStats: promiseStats,
    get me() { return meId; }, setMe: setMe,
    get mode() { return mode; }, get readOnly() { return readOnly; }, notice: "",
    onChange: function (fn) { listeners.push(fn); },
    badges: function () {
      var open = inbox().filter(function (a) { return a.status === "open"; });
      var mine = meId ? open.filter(function (a) { return a.assignee === meId || a.escalateTo === meId; }) : open;
      var mytasks = list("tasks").filter(function (t) { var n = daysFromToday(t.due); return isOpen(t) && t.status !== "split" && (!meId || t.owner === meId) && n !== null && n <= 0; }).length;
      var dec = list("decisions").filter(function (d) { return d.col === "todo" || d.col === "review"; }).length;
      var missing = list("krs").filter(function (k) { return !checkedThisWeek(k); }).length;
      return { inbox: mine.length, myday: mytasks, decisions: dec, review: missing };
    }
  };

  // ---------- connect to the shared database ----------
  function start() {
    if (!window.claude || typeof window.claude.use !== "function") { mode = "demo"; emit(true); return; }
    Promise.all([window.claude.use("db"), window.claude.use("user")]).then(function (res) {
      db = res[0]; userApi = res[1];
      if (!db) { mode = "demo"; emit(true); return; }
      mode = "shared";
      var first = {};
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
      if (userApi && userApi.can) userApi.can("data.write").then(function (w) { if (w === false) { readOnly = true; SKL.notice = "Read-only access: changes are not saved."; emit(true); } });
      emit(true);
    }).catch(function (e) { console.error(e); mode = "demo"; emit(true); });
  }
  start();
})();
