// Claude connector, phase B: the write tools, for SKL OS admins only (Romain, 2026-10-25: "every admin member must be able
// to edit"). docs/crm/17-claude-connector.md §10.
// Operating System writes go through the app's own store.js (loadOs with write = true): its checks apply as on the screens
// (only a task's owner changes or deletes it, only a key result's owner checks it in or marks its milestones, 8 h max per
// task…), then flushOs saves the rows with the caller's own token. CRM writes go through the same security-definer
// functions as the app (crm_add_note, crm_declare_outcome: role and ownership checks, audit log, events).
// Claude asks the person before each call; nothing is ever written without a tool call.
import { asMe, flushOs } from "./_os.js";
import { userError } from "./_crm.js";

const ISO = /^\d{4}-\d{2}-\d{2}$/;
function need(ok, msg) { if (!ok) throw userError(msg); }
function person(S, who) {
  if (!who) return null;
  const q = String(who).trim().toLowerCase();
  const m = S.members.find(x => x.id === q || x.name.toLowerCase() === q || x.name.toLowerCase().startsWith(q));
  need(m, "No team member called '" + who + "'. Team: " + S.members.map(x => x.name + " (" + x.id + ")").join(", ") + ".");
  return m.id;
}
function krOf(S, q) {
  const s = String(q || "").trim().toLowerCase().replace(/^kr\s*/, ""), krs = S.list("krs");
  const code = k => ((/^(\d+\.\d+)/.exec(k.name || "") || [])[1] || k.id);
  const k = krs.find(x => x.id.toLowerCase() === s) || krs.find(x => code(x) === s) || krs.find(x => (x.name || "").toLowerCase().includes(s));
  need(k, "No key result matches '" + q + "'. Key results: " + krs.map(code).sort().join(", ") + ".");
  return k;
}
function me(os) {
  const id = asMe(os);
  need(id, "SKL OS does not know which team member you are yet: open SKL OS once and pick your name in “You are”.");
  return id;
}
function result(os, r, done) {
  need(r === undefined || r === null || r.ok !== false, r && r.why ? r.why : "Not saved.");
  return done;
}
async function saved(os, u, text) { const n = await flushOs(os, u); return { text: text + (n ? "" : " (nothing changed)"), rows: n }; }

// ---------------- Operating System ----------------
export async function taskCreate(os, ctx, u, a) {
  const S = os.S, who = me(os), k = a.kr ? krOf(S, a.kr) : null;
  let init = -1;
  if (k && a.initiative != null && a.initiative !== "") {
    const i = /^\d+$/.test(String(a.initiative)) ? Number(a.initiative) : (k.inits || []).findIndex(x => x.name.toLowerCase() === String(a.initiative).toLowerCase());
    need(i >= 0 && k.inits && k.inits[i], "No initiative '" + a.initiative + "' in KR " + k.id + ". Initiatives: " + (k.inits || []).map((x, j) => j + " " + x.name).join(", ") + ".");
    init = i;
  }
  if (a.milestone) need(k && (k.miles || []).some(m => m.id === a.milestone), "No milestone " + a.milestone + (k ? " in KR " + k.id : ": give the key result too") + ".");
  if (a.due) need(ISO.test(a.due), "due must be a date like 2026-10-30.");
  const owner = person(S, a.owner) || who;
  const r = S.taskCreate({ title: a.title, owner, kr: k ? k.id : "", init, mile: a.milestone || "", due: a.due || S.weekFriday(S.week), est: a.estimate_hours || 2,
    kind: a.exploration ? "E" : "L", doneWhen: a.done_when || "", note: a.note || "" });
  result(os, r);
  const t = S.list("tasks").find(x => x.title === String(a.title).trim() && x.owner === owner && x.by === who);
  return saved(os, u, "Task created: “" + String(a.title).trim() + "” for " + S.member(owner).name + ", due " + (a.due || S.weekFriday(S.week)) + (t ? " (`" + t.id + "`)" : "") + ".");
}

export async function taskUpdate(os, ctx, u, a) {
  const S = os.S; me(os);
  const t = S.get("tasks", a.id); need(t, "No task " + a.id + ". The tasks tool lists them with their ids.");
  const patch = {};
  if (a.status) patch.status = a.status;
  if (a.due) { need(ISO.test(a.due), "due must be a date like 2026-10-30."); patch.due = a.due; patch.start = S.weekOf(a.due); patch.end = S.weekOf(a.due); }
  if (a.title) patch.title = a.title;
  if (a.estimate_hours != null) { need(a.estimate_hours <= S.TASK_MAX_H, "Over " + S.TASK_MAX_H + " h: split it."); patch.est = a.estimate_hours; }
  if (a.note != null) patch.note = a.note;
  if (a.done_when != null) patch.doneWhen = a.done_when;
  need(Object.keys(patch).length, "Nothing to change: give status, due, title, estimate_hours, note or done_when.");
  result(os, S.taskUpdate(a.id, patch));
  return saved(os, u, "Task “" + t.title + "” updated: " + Object.keys(patch).filter(x => x !== "start" && x !== "end").join(", ") + ".");
}

export async function taskDelete(os, ctx, u, a) {
  const S = os.S; me(os);
  const t = S.get("tasks", a.id); need(t, "No task " + a.id + ".");
  result(os, S.taskDelete(a.id, { admin: true }));   // the write tools are for admins only
  return saved(os, u, "Task “" + t.title + "” deleted.");
}

export async function krCheckin(os, ctx, u, a) {
  const S = os.S, who = me(os), k = krOf(S, a.kr);
  need(k.owner === who, "Only " + S.member(k.owner).name + " checks in this key result (its owner).");
  need(a.confidence >= 1 && a.confidence <= 10, "Confidence goes from 1 to 10.");
  const today = S.iso(S.today), kk = JSON.parse(JSON.stringify(k));
  kk.checkins = (kk.checkins || []).filter(x => x.date !== today);
  kk.checkins.unshift({ week: S.week, date: today, value: Number(a.value), conf: a.confidence, moved: (a.note || "").trim() || "—", blocks: (a.blocks || "").trim() || "—", prios: [], by: who });
  kk.current = Number(a.value);
  S.save("krs", kk);
  return saved(os, u, "Check-in saved for KR " + k.name.split(" · ")[0] + ": " + S.fmtVal(a.value, k.unit) + ", confidence " + a.confidence + "/10.");
}

export async function milestoneMark(os, ctx, u, a) {
  const S = os.S, who = me(os), k = krOf(S, a.kr);
  const kk = JSON.parse(JSON.stringify(k)), m = (kk.miles || []).find(x => x.id === a.milestone || (x.text || "").toLowerCase().includes(String(a.milestone).toLowerCase()));
  need(m, "No milestone '" + a.milestone + "' in KR " + k.id + ". Milestones: " + (k.miles || []).map(x => x.id).join(", ") + ".");
  need(S.msOwner(k, m) === who, "Only " + S.member(S.msOwner(k, m)).name + " marks this milestone (its owner).");
  m.doneDef = S.msGoals(m);
  (a.proofs_done || []).forEach(i => { need(m.doneDef[i], "No proof line " + i + " (0 to " + (m.doneDef.length - 1) + ")."); m.doneDef[i].ok = true; });
  if (a.reached) {
    need(!m.doneDef.length || m.doneDef.every(x => x.ok), "Every proof line must be ticked first: " + m.doneDef.map((x, i) => i + " " + (x.ok ? "✓ " : "· ") + x.t).join(" · "));
    m.status = "done"; m.done = true;
  }
  S.save("krs", kk);
  return saved(os, u, a.reached ? "Milestone reached: " + m.text.slice(0, 120) : "Proof lines ticked on: " + m.text.slice(0, 120));
}

export async function decisionCreate(os, ctx, u, a) {
  const S = os.S, who = me(os);
  if (a.deadline) need(ISO.test(a.deadline), "deadline must be a date like 2026-10-30.");
  const id = S.createDecision({ title: a.title, question: a.question || a.title, owner: person(S, a.owner) || who, reversible: a.reversible !== false,
    ...(a.deadline ? { deadline: a.deadline } : {}), ...(a.problem ? { frame: { problem: a.problem, vars: [{ name: "", w: 34, ctx: "" }, { name: "", w: 33, ctx: "" }, { name: "", w: 33, ctx: "" }], opts: (a.options || []).map(n => ({ name: n, desc: "", sc: [0, 0, 0] })) } } : {}) });
  return saved(os, u, "Decision created: “" + a.title + "” (`" + id + "`).");
}

const DCOLS = ["todo", "review", "done", "archive"];
export async function decisionUpdate(os, ctx, u, a) {
  const S = os.S; me(os);
  const d = S.get("decisions", a.id); need(d, "No decision " + a.id + ". The decisions tool lists them.");
  const n = JSON.parse(JSON.stringify(d)), changed = [];
  if (a.status) { need(DCOLS.includes(a.status), "status: " + DCOLS.join(", ") + "."); n.col = a.status; if (a.status === "done" && !n.decided) n.decided = S.iso(S.today); changed.push("status"); }
  if (a.chosen != null) {
    const opts = (n.frame && n.frame.opts) || [], i = /^\d+$/.test(String(a.chosen)) ? Number(a.chosen) : opts.findIndex(o => (o.name || "").toLowerCase() === String(a.chosen).toLowerCase());
    need(opts[i], "No option '" + a.chosen + "'. Options: " + opts.map((o, j) => j + " " + o.name).join(", ") + ".");
    n.chosen = i; changed.push("chosen option");
  }
  ["expected", "actual"].forEach(f => { if (a[f] != null) { n[f] = a[f]; changed.push(f); } });
  if (a.review_date) { need(ISO.test(a.review_date), "review_date must be a date."); n.review = a.review_date; changed.push("review date"); }
  if (a.review_note != null) { n.reviewNote = a.review_note; changed.push("review note"); }
  need(changed.length, "Nothing to change.");
  S.save("decisions", n);
  return saved(os, u, "Decision “" + d.title + "” updated: " + changed.join(", ") + ".");
}

export async function alertAction(os, ctx, u, a) {
  const S = os.S, who = me(os), q = String(a.alert).toLowerCase();
  const items = S.inbox(), al = items.find(x => x.id === a.alert) || items.find(x => (x.subject || "").toLowerCase().includes(q));
  need(al, "No live alert matches '" + a.alert + "'. The alerts tool lists them.");
  const act = a.action;
  if (act === "handled") S.inboxAct(al, "handled", { status: "handled", snoozeUntil: "" });
  else if (act === "reopen") S.inboxAct(al, "reopen", { status: "open", snoozeUntil: "" });
  else if (act === "snooze") { need(ISO.test(a.until || ""), "Give until as a date like 2026-10-30."); S.inboxAct(al, "snooze", { status: "snoozed", snoozeUntil: a.until }, S.shortDate(a.until)); }
  else if (act === "take") S.inboxAct(al, "take", { assignee: who });
  else if (act === "assign") { const to = person(S, a.to); need(to, "Give to (a team member)."); S.inboxAct(al, "assign", { assignee: to }, S.member(to).name); }
  else if (act === "note") { need(a.note, "Give the note."); S.inboxAct(al, "note", { note: a.note }); }
  return saved(os, u, "Alert “" + al.alert + " · " + al.subject + "”: " + act + ".");
}

// ---------------- CRM (the app's own functions) ----------------
export async function leadNote(os, ctx, u, a) {
  const r = await u.rpc("crm_add_note", { p_cycle: a.cycle_id, p_text: a.text });
  need(!r.error, r.error ? "Not saved: " + r.error.message : "");
  return { text: "Note added to the lead.", rows: 1 };
}
export async function declareOutcome(os, ctx, u, a) {
  const p = { attendance: a.attendance, decision: a.decision || "", reason_code: a.reason_code || "", next_step: a.next_step || "", amount_sold: a.amount_sold != null ? String(a.amount_sold) : "",
    currency: a.currency || (a.amount_sold != null ? "EUR" : ""), product: a.product || "", payment_plan: a.payment_plan || "", nurture: a.nurture || "", return_date: a.return_date || "", note: a.note || "" };
  const r = await u.rpc("crm_declare_outcome", { p_call: a.call_id, p });
  need(!r.error, r.error ? "Not saved: " + r.error.message : "");
  return { text: "Outcome declared: " + a.attendance + (a.decision ? " · " + a.decision : "") + (a.reason_code ? " (" + a.reason_code + ")" : "") + ". The cycle is recomputed.", rows: 1 };
}
