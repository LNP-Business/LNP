// The rest of SKL OS for the Claude connector (docs/crm/17-claude-connector.md §9): Operating System (Cockpit, Build,
// Execute, Decisions, Weekly Review), Knowledge System (Library, mechanisms, SKL Map), Agent System, Settings, plus every
// screen's Page method and a raw reader for any shared collection.
// Live data: the shared "docs" rows, read with the CALLER's token (row-level security as in the app). The rules are the
// app's own: store.js runs here in a sandbox on those rows (no logic copied), read only (it is told it cannot write).
// What lives in the page itself (SKL Map model, mechanism models, Agent System sample, Page methods) comes from _kb.json,
// built from the sources by web/kb/build_kb.mjs (build.sh stage 4).
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { all, cell, quote, userError } from "./_crm.js";

const KB = JSON.parse(readFileSync(new URL("./_kb.json", import.meta.url), "utf8"));   // vercel.json includeFiles ships it

export const COLS = ["krs", "tasks", "decisions", "deliverables", "acks", "dailies", "config", "mech", "members", "inbox", "reviews", "needs", "weeks", "days", "requests"];
const MAX = 50;

// ---------------- the app's store on the live rows ----------------
function todayIn(tz) { return new Intl.DateTimeFormat("en-CA", { timeZone: tz || "Asia/Dubai", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()); }
// write = true (admins, phase B): the store may write; every write it makes is queued here and flushed by flushOs with the
// caller's own token, after the store's own checks (only a task's owner changes it, only a KR's owner checks it in…).
export async function loadOs(u, user, tz, write, email) {
  const rowsOf = await all(() => u.from("docs").select("col,id,body").in("col", COLS).order("col").order("id"));
  const by = {}; COLS.forEach(c => { by[c] = []; });
  rowsOf.forEach(r => { if (by[r.col]) by[r.col].push(r); });
  const pending = [];
  const snap = c => ({ docs: by[c].map(r => ({ id: r.id, data: () => JSON.parse(JSON.stringify(r.body)) })) });
  const db = { collection: c => ({ onSnapshot: (ok) => { ok(snap(c)); return () => {}; },
    doc: id => ({ set: async body => { if (write) pending.push({ col: c, id, body: JSON.parse(JSON.stringify(body)) }); }, delete: async () => { if (write) pending.push({ col: c, id, del: true }); } }) }) };
  const userApi = { id: async () => user.id, can: async () => !!write };   // read only unless write
  const store = {};
  const ctx = vm.createContext({
    window: { SKL_TODAY: todayIn(tz), claude: { use: async n => (n === "db" ? db : n === "user" ? userApi : null) } },
    localStorage: { getItem: () => null, setItem: () => {} }, setTimeout: () => 0, setInterval: () => 0, console: { error: () => {}, log: () => {} },
    Promise, JSON, Math, Date, Object, Array, Number, String, Map, Set, isNaN, parseFloat, parseInt, Intl
  });
  vm.runInContext(KB.store_js, ctx, { timeout: 3000 });
  for (let i = 0; i < 5 && ctx.window.SKL.mode !== "shared"; i++) await new Promise(r => setImmediate(r));
  const S = ctx.window.SKL;
  if (!S || S.mode !== "shared") throw new Error("could not read the shared data");
  for (let i = 0; i < 3; i++) await new Promise(r => setImmediate(r));   // the user id resolves the caller's member id
  // nobody chose "You are" yet: the team member whose id or first name is the email's name (amin@… → Amin), never a guess
  if (!S.me && email) {
    const local = String(email).split("@")[0].toLowerCase(), m = S.members.find(x => x.id === local || x.name.toLowerCase() === local);
    if (m) store.meGuess = m.id;
  }
  store.S = S; store.raw = by; store.tz = tz; store.pending = pending; store.write = !!write;
  return store;
}
// the caller's member id (from "You are", else from the email), set in the store before a write
export function asMe(os) { if (!os.S.me && os.meGuess) os.S.setMe(os.meGuess); return os.S.me; }
// sends the store's queued writes, in order, with the caller's token; returns how many rows changed
export async function flushOs(os, u) {
  for (let i = 0; i < 5; i++) await new Promise(r => setImmediate(r));
  let n = 0;
  while (os.pending.length) {
    const w = os.pending.shift();
    const r = w.del ? await u.from("docs").delete().eq("col", w.col).eq("id", w.id) : await u.from("docs").upsert({ col: w.col, id: w.id, body: w.body });
    if (r.error) throw new Error("not saved: " + r.error.message);
    n++;
  }
  return n;
}

// ---------------- helpers ----------------
const name = (S, id) => (id ? S.member(id).name : "—");
function personId(S, who) {
  if (!who) return null;
  const q = String(who).trim().toLowerCase();
  const m = S.members.find(x => x.id === q || x.name.toLowerCase() === q || x.name.toLowerCase().startsWith(q));
  if (!m) throw userError("No team member called '" + who + "'. Team: " + S.members.map(x => x.name + " (" + x.id + ")").join(", ") + ".");
  return m.id;
}
function table(head, rows) { return ["| " + head.join(" | ") + " |", "|" + head.map(() => "---").join("|") + "|"].concat(rows.map(r => "| " + r.map(cell).join(" | ") + " |")).join("\n"); }
function krCode(k) { const m = /^(\d+\.\d+)/.exec(k.name || ""); return m ? m[1] : k.id; }
function findKr(S, q) {
  const s = String(q || "").trim().toLowerCase(), krs = S.list("krs");
  const k = krs.find(x => x.id.toLowerCase() === s) || krs.find(x => krCode(x) === s.replace(/^kr\s*/, "")) || krs.find(x => (x.name || "").toLowerCase().includes(s));
  if (!k) throw userError("No key result matches '" + q + "'. Key results: " + krs.map(x => krCode(x)).sort().join(", ") + ".");
  return k;
}
const val = (S, v, k) => S.fmtVal(v, k.unit);
const day = (S, d) => (d ? S.dayLabel(d) : "—");
const wk = (S, w) => (w ? S.wl(w) : "—");
const short = (t, n = 220) => { t = String(t == null ? "" : t).replace(/\s+/g, " ").trim(); return t.length > n ? t.slice(0, n) + "…" : t; };

// ---------------- tools ----------------
export function overview(os, ctx) {
  const S = os.S, b = S.badges();
  const L = ["# SKL OS (ALKIMIY) · " + S.iso(S.today) + " · " + S.wl(S.week) + " (week " + S.week + "/13 of Q4 2026)",
    "You are " + (S.me ? name(S, S.me) + " (`" + S.me + "`)" : ctx.email) + ". Read only.", "",
    "## Waiting now", "- Needs you (alerts): " + b.inbox + " · My Day items: " + b.myday + " · decisions to take or review: " + b.decisions +
      " · key results not checked in this week: " + b.review + " · Roadmap plan gaps: " + b.roadmap, "",
    "## Systems, screens and the tool that reads them",
    "- **Operating System** — Cockpit: `okrs`, `alerts` · Build: `key_result`, `roadmap` (plan health) · Execute: `my_day`, `tasks` · Decisions: `decisions` · Weekly Review: `weekly_review`",
    "- **Sales System** — Cockpit (the Cockpit's Sales view: lead to cash, unit economics, team): `page_method` (screen Sales cockpit) · CRM: `find_lead`, `lead_record`, `clocks_running`, `pipeline_summary`, `call_prep`, `call_analysis`, `performance`",
    "- **Knowledge System** — Library: `library` · Mechanism map, Pre-call, Sales, Operating System: `mechanism` · SKL Map (Journey, Events, Build order, Simulator, Model): `skl_map`",
    "- **Agent System** — Overview, Decisions, Agents, Triggers, Log: `agent_system`",
    "- **Settings** — Alerts: `alerts` (rules) · Registers: `mechanism` (registers)",
    "- Any screen's purpose and how to use it: `page_method` · any shared record, raw: `os_data`", "",
    "## Team", S.members.map(m => "- " + m.name + " (`" + m.id + "`) · " + m.role).join("\n")];
  return { text: L.join("\n"), rows: 1 };
}

export function okrs(os) {
  const S = os.S, objs = ((S.get("config", "objectives") || {}).list) || [];
  const krs = S.list("krs").slice().sort((a, b) => krCode(a).localeCompare(krCode(b), "en", { numeric: true }));
  const L = ["# Objectives and key results · Q4 2026 · " + S.wl(S.week)];
  const groups = objs.length ? objs : [...new Set(krs.map(k => k.obj))].map(id => ({ id, name: id }));
  groups.forEach(o => {
    const ks = krs.filter(k => k.obj === o.id); if (!ks.length) return;
    L.push("", "## " + o.id + " · " + o.name, table(["KR", "Owner", "Now", "Expected today", "Target", "Status", "Why", "Last check-in", "Next milestone"],
      ks.map(k => {
        const st = S.krStatus(k), last = S.lastCheck(k), due = S.checkinDue(k);
        const next = (k.miles || []).filter(m => S.msStatus(m) !== "done").sort((a, b) => a.week - b.week)[0];
        return [krCode(k) + " · " + short((k.name || "").replace(/^\d+\.\d+\s*·\s*/, ""), 90) + " (`" + k.id + "`)", name(S, k.owner), val(S, k.current, k), val(S, k.expected, k), val(S, k.target, k),
          st.label, st.why || "", last ? day(S, last.date) + (last.conf ? " · confidence " + last.conf + "/10" : "") + (due.overdue ? " · **check-in overdue**" : "") : "never" + (due.overdue ? " · **check-in overdue**" : ""),
          next ? wk(S, next.week) + " · " + short(next.text, 80) : "—"];
      })));
  });
  const ph = S.planHealth(null);
  L.push("", "Plan health: " + ph.coverage.length + " coverage gaps or unmarked milestones, " + ph.next.length + " initiatives with no next action, " + ph.load.length + " overloaded weeks (details: `roadmap`).");
  return { text: L.join("\n"), rows: krs.length };
}

export function keyResult(os, ctx, { kr }) {
  const S = os.S, k = findKr(S, kr), st = S.krStatus(k);
  const L = ["# KR " + krCode(k) + " · " + (k.name || "").replace(/^\d+\.\d+\s*·\s*/, "") + " (`" + k.id + "`)",
    "- Objective " + k.obj + " · owner " + name(S, k.owner) + " · " + (k.type || "") + (k.kind === "ceiling" ? " · stay-below key result" : ""),
    "- Metric: " + (k.metric || "—") + (k.source ? " · source " + k.source : "") + (k.freq ? " · " + k.freq : "") + (k.lead ? " · leading indicator: " + k.lead : ""),
    "- Baseline " + val(S, k.baseline, k) + " · now " + val(S, k.current, k) + " · expected today " + val(S, k.expected, k) + " · target " + val(S, k.target, k),
    "- Status: **" + st.label + "**" + (st.why ? " · " + st.why : "") + (st.landing != null ? " · lands at " + Math.round(st.landing * 100) + "% of the target at the recent pace" : ""),
    "- Plan (week → value): " + ((k.plan || []).map(p => S.wl(p[0]) + " " + val(S, p[1], k)).join(" · ") || "none")];
  const ms = (k.miles || []).slice().sort((a, b) => a.week - b.week);
  L.push("", "## Milestones (checked on Sunday 8 pm of their week)");
  ms.forEach(m => {
    L.push("- " + wk(S, m.week) + " · **" + S.msStatus(m) + "** · " + name(S, S.msOwner(k, m)) + " · " + short(m.text, 400) + " (`" + m.id + "`)");
    (m.doneDef || []).forEach(d => L.push("  - [" + (d.ok ? "x" : " ") + "] " + short(d.t, 200)));
  });
  if (!ms.length) L.push("none");
  L.push("", "## Initiatives and their tasks");
  (k.inits || []).forEach((x, i) => {
    L.push("- **" + x.name + "**" + (x.contrib ? " · " + x.contrib : "") + (x.hyp ? "\n  Hypothesis: " + short(x.hyp, 400) : ""));
    S.initTasks(k, i).forEach(t => L.push("  - " + (S.isOpen(t) ? "[ ]" : "[x]") + " " + short(t.title, 160) + " · " + name(S, t.owner) + " · " + (t.status || "todo") + " · due " + day(S, t.due) + (t.est ? " · " + t.est + " h" : "")));
  });
  const cs = (k.checkins || []).slice().sort((a, b) => (a.date < b.date ? 1 : -1));
  L.push("", "## Check-ins (latest first)", cs.length ? cs.slice(0, 15).map(c => "- " + day(S, c.date) + " · " + val(S, c.value, k) + (c.conf ? " · confidence " + c.conf + "/10" : "") + (c.note ? "\n" + quote(c.note, 400) : "")).join("\n") : "none");
  if ((k.risks || []).length) L.push("", "## Risks", k.risks.map(r => "- " + short(r.t || r.text || r.name || JSON.stringify(r), 240) + (r.p ? " · probability " + r.p : "") + (r.i ? " · impact " + r.i : "") + (r.m ? " · mitigation: " + short(r.m, 200) : "")).join("\n"));
  const dels = S.list("deliverables").filter(d => (d.title || "").includes("KR " + krCode(k)) || d.kr === k.id);
  const decs = S.list("decisions").filter(d => ((d.links && d.links.kr) || []).includes(k.id));
  if (dels.length) L.push("", "## Library", dels.map(d => "- " + d.title + " · " + (d.status || "") + (d.file ? " · file " + d.file.name : "")).join("\n"));
  if (decs.length) L.push("", "## Decisions", decs.map(d => "- " + d.title + " · " + d.col).join("\n"));
  if (k.close && Object.values(k.close).some(Boolean)) L.push("", "## Close", Object.entries(k.close).filter(([, v]) => v).map(([a, v]) => "- " + a + ": " + short(v, 300)).join("\n"));
  return { text: L.join("\n"), rows: 1 + ms.length + cs.length };
}

export function tasks(os, ctx, { owner, status, kr, within_days }) {
  const S = os.S, who = personId(S, owner), k = kr ? findKr(S, kr) : null;
  status = status || "open";
  let list = S.list("tasks").filter(t => (!who || t.owner === who) && (!k || t.kr === k.id));
  list = list.filter(t => {
    const n = S.daysFromToday(t.due), open = S.isOpen(t);
    if (status === "open" && !open) return false;
    if (status === "late" && !(open && n !== null && n < 0)) return false;
    if (status === "done" && open) return false;
    if (within_days != null && !(n !== null && n <= within_days)) return false;
    return true;
  }).sort((a, b) => String(a.due || "9").localeCompare(String(b.due || "9")));
  const krs = {}; S.list("krs").forEach(x => { krs[x.id] = x; });
  const L = [(list.length > MAX ? "Showing " + MAX + " of " + list.length : list.length) + " tasks (" + status + (who ? ", " + name(S, who) : "") + (k ? ", KR " + krCode(k) : "") + (within_days != null ? ", due within " + within_days + " days" : "") + ")."];
  if (list.length) L.push("", table(["Task", "Owner", "Status", "Due", "Estimate", "KR · initiative", "Done when", "Id"], list.slice(0, MAX).map(t => {
    const n = S.daysFromToday(t.due), x = krs[t.kr];
    return [short(t.title, 140) + (t.kind === "E" ? " (exploration)" : ""), name(S, t.owner), (t.status || "todo") + (S.isOpen(t) && n !== null && n < 0 ? " · **" + (-n) + " d late**" : "") + (t.status === "blocked" && t.note ? " · " + short(t.note, 80) : ""),
      day(S, t.due), t.est ? t.est + " h" : "—", x ? krCode(x) + (x.inits && x.inits[t.init] ? " · " + x.inits[t.init].name : "") : "—", short(t.doneWhen || "", 100), "`" + t.id + "`"];
  })));
  return { text: L.join("\n"), rows: list.length };
}

export function myDay(os, ctx, { person }) {
  const S = os.S, who = personId(S, person) || S.me;
  if (!who) throw userError("Say whose day: give person (a name or member id). Team: " + S.members.map(x => x.name).join(", ") + ".");
  const today = S.iso(S.today), week = S.week;
  const mine = S.list("tasks").filter(t => t.owner === who && S.isOpen(t) && t.status !== "split");
  const late = mine.filter(t => { const n = S.daysFromToday(t.due); return n !== null && n < 0; });
  const todayT = mine.filter(t => S.daysFromToday(t.due) === 0);
  const weekT = mine.filter(t => { const n = S.daysFromToday(t.due); return n !== null && n > 0 && S.weekOf(t.due) === week; });
  const prog = mine.filter(t => t.status === "progress"), blocked = mine.filter(t => t.status === "blocked");
  const needs = S.needsYou(who);
  const ck = S.list("krs").filter(k => k.owner === who && S.checkinDue(k).overdue);
  const miles = []; S.list("krs").forEach(k => (k.miles || []).forEach(m => { if (m.week === week && S.msOwner(k, m) === who) miles.push([k, m]); }));
  const load = S.milestoneLoad(who, week);
  const line = t => "- " + short(t.title, 160) + " · " + (t.status || "todo") + " · due " + day(S, t.due) + (t.est ? " · " + t.est + " h" : "") + " (`" + t.id + "`)";
  const L = ["# My Day · " + name(S, who) + " · " + today + " · " + S.wl(week),
    "", "## Needs you (" + needs.length + ")", needs.length ? needs.map(a => "- **" + a.sev + "** · " + a.alert + " · " + short(a.subject, 140) + " · " + short(a.detail, 200) + (a.escalated ? " · escalated" : "")).join("\n") : "nothing",
    "", "## Overdue (" + late.length + ")", late.map(line).join("\n") || "nothing",
    "", "## In progress (" + prog.length + ", max " + S.WIP_MAX + ")", prog.map(line).join("\n") || "nothing",
    "", "## Blocked (" + blocked.length + ")", blocked.map(t => line(t) + (t.note ? " · waits for: " + short(t.note, 120) : "")).join("\n") || "nothing",
    "", "## Today (" + todayT.length + ")", todayT.map(line).join("\n") || "nothing",
    "", "## Later this week (" + weekT.length + ")", weekT.map(line).join("\n") || "nothing",
    "", "## Check-ins owed (Saturday)", ck.length ? ck.map(k => "- KR " + krCode(k) + " · last " + (S.lastCheck(k) ? day(S, S.lastCheck(k).date) : "never")).join("\n") : "none",
    "", "## Milestones this Sunday (" + miles.length + ", load " + load.n + "/" + S.MS_MAX + (load.over ? ", **over the limit**" : "") + ")",
    miles.map(([k, m]) => "- KR " + krCode(k) + " · " + S.msStatus(m) + " · " + short(m.text, 220)).join("\n") || "none"];
  return { text: L.join("\n"), rows: mine.length + needs.length };
}

export function roadmap(os, ctx, { person }) {
  const S = os.S, who = personId(S, person), ph = S.planHealth(who || null);
  const krs = {}; S.list("krs").forEach(k => { krs[k.id] = k; });
  const L = ["# Roadmap · plan health" + (who ? " · " + name(S, who) : " · whole team") + " · " + ph.count + " items",
    "", "## Coverage (" + ph.coverage.length + ")", ph.coverage.map(x => x.kind === "gap"
      ? "- KR " + krCode(krs[x.kr]) + " · no milestone from " + S.wl(x.from) + " to " + S.wl(x.to) + " · " + name(S, x.owner)
      : "- KR " + krCode(krs[x.kr]) + " · milestone of " + S.wl(x.week) + " not marked reached or not · " + name(S, x.owner)).join("\n") || "nothing missing",
    "", "## Initiatives with no next action in 2 weeks (" + ph.next.length + ")", ph.next.map(x => "- KR " + krCode(krs[x.kr]) + " · " + x.name + " · " + name(S, x.owner)).join("\n") || "none",
    "", "## Milestone load over " + S.MS_MAX + " a week (" + ph.load.length + ")", ph.load.map(x => "- " + name(S, x.who) + " · " + S.wl(x.week) + " · " + x.n + " milestones").join("\n") || "none",
    "", "## Timeline (milestones by week)"];
  const byW = {}; S.list("krs").forEach(k => (k.miles || []).forEach(m => { (byW[m.week] = byW[m.week] || []).push([k, m]); }));
  Object.keys(byW).map(Number).sort((a, b) => a - b).forEach(w => {
    L.push("- **" + S.wl(w) + "** · " + byW[w].map(([k, m]) => "KR " + krCode(k) + " " + S.msStatus(m) + " (" + name(S, S.msOwner(k, m)) + "): " + short(m.text, 90)).join(" · "));
  });
  return { text: L.join("\n"), rows: ph.count };
}

const DCOL = { todo: "To decide", review: "To review", done: "Decided", archive: "Archived" };
export function decisions(os, ctx, { status, id }) {
  const S = os.S;
  let list = S.list("decisions");
  if (id) { list = list.filter(d => d.id === id); if (!list.length) throw userError("No decision with id " + id + "."); }
  else if (status && status !== "all") list = list.filter(d => d.col === status);
  list.sort((a, b) => String(b.opened || "").localeCompare(String(a.opened || "")));
  const L = [list.length + " decisions" + (status && !id ? " (" + status + ")" : "") + "."];
  list.slice(0, id ? 1 : MAX).forEach(d => {
    const f = d.frame || {}, opts = f.opts || [];
    L.push("", "## " + (d.title || d.question) + " (`" + d.id + "`)",
      "- " + (DCOL[d.col] || d.col) + " · owner " + name(S, d.owner) + " · " + (d.reversible ? "reversible" : "irreversible") + " · opened " + day(S, d.opened) + " · deadline " + day(S, d.deadline) + (d.decided ? " · decided " + day(S, d.decided) : "") + (d.review ? " · review " + day(S, d.review) : ""),
      d.question && d.question !== d.title ? "- Question: " + short(d.question, 400) : "",
      f.problem ? "- Problem: " + short(f.problem, 600) : "",
      (f.vars || []).filter(v => v.name).length ? "- Criteria: " + f.vars.filter(v => v.name).map(v => v.name + " (" + v.w + "%)").join(" · ") : "",
      opts.filter(o => o.name).length ? "- Options: " + opts.map((o, i) => (i === d.chosen ? "**" + o.name + " (chosen)**" : o.name) + (o.desc ? " — " + short(o.desc, 160) : "")).join(" · ") : "",
      d.expected ? "- Expected: " + short(d.expected, 300) : "", d.actual ? "- Actual: " + short(d.actual, 300) : "", d.reviewNote ? "- Review note: " + short(d.reviewNote, 300) : "");
  });
  return { text: L.filter(x => x !== "").join("\n"), rows: list.length };
}

export function weeklyReview(os, ctx, { week }) {
  const S = os.S, w = week || S.week, id = S.reviewId(w), rev = S.get("reviews", id);
  const krs = S.list("krs"), ps = S.milestoneStats ? S.milestoneStats() : null, fl = S.flowStats ? S.flowStats() : null;
  const L = ["# Weekly Review · " + S.wl(w) + " (Saturday)",
    "- Key results checked in this week: " + krs.filter(k => S.checkedThisWeek(k)).length + "/" + krs.length + (w === S.week ? " · missing: " + (krs.filter(k => !S.checkedThisWeek(k)).map(k => krCode(k)).join(", ") || "none") : ""),
    ps ? "- Milestones reached per week: " + short(JSON.stringify(ps), 400) : "", fl ? "- Flow: " + short(JSON.stringify(fl), 400) : "",
    "", "## Review record " + id, rev ? "```json\n" + JSON.stringify(rev, null, 1).slice(0, 12000) + "\n```" : "No review saved for this week yet.",
    "", "Saved reviews: " + (S.list("reviews").map(r => r.id).sort().join(", ") || "none")];
  return { text: L.filter(x => x !== "").join("\n"), rows: rev ? 1 : 0 };
}

export function alerts(os, ctx, { include_rules, include_resolved }) {
  const S = os.S, items = S.inbox(), open = items.filter(a => a.status === "open");
  const L = ["# Alerts · " + open.length + " open of " + items.length + " live", "",
    items.length ? table(["Severity", "Alert", "About", "Who", "Status", "Since", "Detail"], items.slice(0, MAX).map(a => [a.sev, a.alert, short(a.subject, 100), a.assigneeName,
      a.status + (a.escalated ? " · escalated to " + name(S, a.escalateTo) : "") + (a.snoozeUntil && a.status === "snoozed" ? " until " + day(S, a.snoozeUntil) : ""), a.since || "", short(a.detail, 180)])) : "No live alert."];
  if (include_resolved) { const r = S.resolvedInbox(); L.push("", "## Handled or gone (" + r.length + ")", r.slice(0, MAX).map(d => "- " + d.alert + " · " + short(d.subject, 120) + " · " + d.status + " · " + day(S, d.lastAt)).join("\n") || "none"); }
  if (include_rules) {
    L.push("", "## Alert rules (Settings › Alerts)", table(["Rule", "Name", "On", "Severity", "Threshold"], Object.keys(S.ruleNames).map(id => { const r = S.rule(id); return [id, S.ruleNames[id], r.on ? "on" : "off", r.sev, r.v]; })),
      "Escalation after " + S.escHours() + " h for High and Critical alerts left open.");
    const cfg = S.get("config", "alerts"); const crm = cfg && cfg.alerts ? Object.keys(cfg.alerts).filter(x => /^c\d+/.test(x)) : [];
    if (crm.length) L.push("CRM rules: " + crm.map(x => x + " " + (cfg.alerts[x].on ? "on" : "off") + (cfg.values && cfg.values[x + ".param"] != null ? " (" + cfg.values[x + ".param"] + ")" : "")).join(" · "));
  }
  return { text: L.join("\n"), rows: items.length };
}

export function library(os, ctx, { query, domain }) {
  const S = os.S, q = String(query || "").toLowerCase();
  let list = S.list("deliverables").filter(d => (!domain || d.domain === domain) && (!q || JSON.stringify([d.title, d.summary, d.content, d.type, d.domain]).toLowerCase().includes(q)));
  list.sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
  const L = [list.length + " deliverables" + (q ? " matching '" + query + "'" : "") + (domain ? " in " + domain : "") + ". Files open in SKL OS › Library (the connector gives their summary, not the file)."];
  list.slice(0, MAX).forEach(d => L.push("", "## " + d.title + " (`" + d.id + "`)", "- " + [d.type, d.domain, d.status, "owner " + name(S, d.owner), d.date ? day(S, d.date) : "", d.file ? "file " + d.file.name : ""].filter(Boolean).join(" · "),
    d.summary ? quote(d.summary, 800) : "", d.content ? quote(d.content, 2000) : ""));
  return { text: L.filter(x => x !== "").join("\n"), rows: list.length };
}

// ---------------- Knowledge System and Agent System (page content + the team's edits) ----------------
const MAP_SECTIONS = ["states", "transitions", "tools", "chains", "domains", "handoffs", "exits", "shortcuts", "memory", "loops", "orchestrator", "acts", "measures", "labels"];
export function sklMap(os, ctx, { section, query }) {
  const m = KB.skl_map, edits = {}; (os.raw.needs || []).forEach(r => { edits[r.id] = r.body; });
  const q = String(query || "").toLowerCase();
  const withEdits = x => (x && x.id && edits[x.id] ? Object.assign({}, x, { team_edits: edits[x.id] }) : x);
  if (!section) {
    return { text: ["# SKL Map (Knowledge System › SKL Map: Journey, Events, Build order, Simulator, Model)",
      "The student journey as states and transitions, the tools that hold them, the chains and handoffs between agents, humans and systems.",
      "Sections: " + MAP_SECTIONS.map(s => "`" + s + "`" + (Array.isArray(m[s]) ? " (" + m[s].length + ")" : "")).join(", ") + ", `needs` (the team's edits: " + Object.keys(edits).length + ")",
      "", "## States", m.states.map(s => "- " + s.id + " · " + s.name + (s.sub ? " — " + s.sub : "")).join("\n")].join("\n"), rows: 1 };
  }
  if (section === "needs") return { text: "# SKL Map · the team's edits (" + Object.keys(edits).length + ")\n```json\n" + JSON.stringify(edits, null, 1).slice(0, 15000) + "\n```", rows: Object.keys(edits).length };
  if (!MAP_SECTIONS.includes(section)) throw userError("Unknown section '" + section + "'. Sections: " + MAP_SECTIONS.join(", ") + ", needs.");
  let v = m[section];
  if (Array.isArray(v)) { v = v.map(withEdits); if (q) v = v.filter(x => JSON.stringify(x).toLowerCase().includes(q)); }
  return { text: "# SKL Map · " + section + (q ? " matching '" + query + "'" : "") + "\n```json\n" + JSON.stringify(v, null, 1).slice(0, 15000) + "\n```", rows: Array.isArray(v) ? v.length : 1 };
}

const MECH = { "pre-call": "s-preappel", precall: "s-preappel", sales: "s-vente", execution: "s-os-exec", "execution steering": "s-os-exec", results: "s-os-res", "results steering": "s-os-res" };
export function mechanism(os, ctx, { which, part }) {
  const docs = {}; (os.raw.mech || []).forEach(r => { let b = r.body; if (b && typeof b.json === "string") { try { b = JSON.parse(b.json); } catch (e) {} } docs[r.id] = b; });
  if (!which) {
    const list = Object.entries(KB.mechanisms).filter(([id]) => id.startsWith("s-")).map(([id, x]) => "- `" + id + "` · " + x.name + " · " + x.page + (docs["sys-" + id] ? " · edited by the team" : " · as built"));
    return { text: ["# Mechanisms (Knowledge System › Mechanism map, Pre-call, Sales, Operating System)", list.join("\n"), "- `registers` · Settings › Registers (interfaces, resources, events, actors)" + (docs.registers ? " · edited by the team" : " · as built"),
      "", "Ask with which = pre-call, sales, execution, results or registers; part = a key of the model to read only that part."].join("\n"), rows: list.length };
  }
  const w = String(which).toLowerCase();
  let id = w === "registers" ? "registers" : MECH[w] || (KB.mechanisms[w] ? w : null);
  if (!id) throw userError("Unknown mechanism '" + which + "'. Use pre-call, sales, execution, results or registers.");
  const live = docs[id === "registers" ? "registers" : "sys-" + id];
  let model = live ? (live.modele || live) : id === "registers" ? KB.mechanisms.registers_os_lines : KB.mechanisms[id].model;
  const keys = model && typeof model === "object" ? Object.keys(model) : [];
  if (part) { if (!(part in model)) throw userError("No part '" + part + "'. Parts: " + keys.join(", ") + "."); model = model[part]; }
  const title = id === "registers" ? "Registers" : KB.mechanisms[id].name;
  return { text: "# " + title + (part ? " · " + part : "") + " · " + (live ? "the team's current version" : "as built (no team edit saved yet)") + (part ? "" : "\nParts: " + keys.join(", ")) +
    "\n```json\n" + JSON.stringify(model, null, 1).slice(0, 15000) + "\n```", rows: 1 };
}

const AGENT_SECTIONS = { agents: "AGENTS", decisions: "DECISIONS", triggers: "TRIGGERS", log: "LOG", alerts: "ALERTS" };
export function agentSystem(os, ctx, { section }) {
  const A = KB.agent_system, s = section || "agents";
  if (!AGENT_SECTIONS[s]) throw userError("Sections: " + Object.keys(AGENT_SECTIONS).join(", ") + ".");
  return { text: "# Agent System · " + s + "\nThe Agent System screens show the sample of the functional spec (fictitious data, decisions live for the session only); no agent writes here yet.\nAutonomy levels: " + A.LEVELS.map((l, i) => i + " " + l).join(" · ") +
    "\n```json\n" + JSON.stringify(A[AGENT_SECTIONS[s]], null, 1).slice(0, 15000) + "\n```", rows: (A[AGENT_SECTIONS[s]] || []).length };
}

const SCREEN_ALIASES = { cockpit: "Main", main: "Main", build: "Build", roadmap: "Build", execute: "Execute", "my day": "Execute", myday: "Execute", monjour: "Execute", decisions: "Decisions", "weekly review": "Review", review: "Review",
  crm: "CRM", "sales cockpit": "SalesCockpit", salescockpit: "SalesCockpit", library: "Bibliotheque", bibliotheque: "Bibliotheque", "mechanism map": "Mechanisms", mechanisms: "Mechanisms", "pre-call": "MechPrecall", sales: "MechSales", "operating system": "MechOS",
  journey: "CartoMap", events: "CartoEvents", "build order": "CartoWorks", simulator: "CartoSim", model: "CartoModel", overview: "AgentsOverview", agents: "AgentsRegistry", triggers: "AgentsTriggers", log: "AgentsLog",
  settings: "Settings", alerts: "Settings", registers: "Registers", access: "Access", account: "Account" };
export function pageMethod(os, ctx, { screen }) {
  const P = KB.page_methods;
  if (!screen) return { text: "# Page methods\nScreens: " + Object.keys(P).join(", ") + "\nAsk with screen = a screen name (Cockpit, Build, Execute, Decisions, Weekly Review, CRM, Library, Pre-call, Journey…).", rows: 0 };
  const s = String(screen).trim(), key = P[s] ? s : SCREEN_ALIASES[s.toLowerCase()] || Object.keys(P).find(k => k.toLowerCase() === s.toLowerCase());
  if (!key || !P[key]) throw userError("No screen '" + screen + "'. Screens: " + Object.keys(P).join(", ") + ".");
  return { text: "# Page method · " + key + "\n" + P[key], rows: 1 };
}

export function osData(os, ctx, { collection, id, query }) {
  if (!COLS.includes(collection)) throw userError("Collections: " + COLS.join(", ") + ".");
  let list = (os.raw[collection] || []).map(r => Object.assign({ id: r.id }, r.body));
  if (id) list = list.filter(x => x.id === id);
  if (query) { const q = String(query).toLowerCase(); list = list.filter(x => JSON.stringify(x).toLowerCase().includes(q)); }
  const body = JSON.stringify(id ? list[0] || null : list, null, 1);
  return { text: "# " + collection + (id ? "/" + id : "") + " · " + list.length + " record(s)" + (body.length > 20000 ? " (cut at 20 000 characters: ask with id)" : "") + "\n```json\n" + body.slice(0, 20000) + "\n```", rows: list.length };
}
