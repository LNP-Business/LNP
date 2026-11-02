/* Shared by Cockpit › Overview and Cockpit › Key results: reading the shared data the same way. */
const S = window.SKL;
const QDAYS = 91;
const D = s => new Date(s + "T12:00:00");
const Q0 = () => S.weekMonday(1);
const day = s => Math.round((D(s) - D(Q0())) / 864e5);
const TODAY = () => S.iso(S.today);
const today = () => day(TODAY());
const fmt = (v, u) => S.fmtVal(v, u);
const COL = { green: "#2E7D4F", amber: "#B45309", red: "#B42318", stale: "#8E8A80", "new": "#8E8A80" };
const LBL = { green: "On track", amber: "At risk or recovering", red: "Off track", stale: "Not tracked", "new": "New" };
const esc = x => String(x == null ? "" : x).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const PCOL = { amin: "#3D3A33", romain: "#1B1B18", marketing: "#7A4B00", contenu: "#9A6614", sales: "#5E5B53" };
const pname = id => S.member(id).name;
const ini = id => pname(id).split(" ").map(w => w[0]).join("").slice(0, 2);
const av = (id, sz) => `<span class="av" style="background:${PCOL[id] || "#5E5B53"}${sz ? `;width:${sz}px;height:${sz}px;font-size:${Math.round(sz * .4)}px` : ""}">${esc(ini(id))}</span>`;
const shortObj = o => (S.OBJ[o] || o || "").replace(/^O\d+ · /, "");
const wd = s => D(s).toLocaleDateString("en-GB", { weekday: "short", day: "numeric" });
const age = h => h < 24 ? (h ? h + " h" : "new") : Math.round(h / 24) + " d";
function bindTips(root, TIP) {
  root.querySelectorAll("[data-tip]").forEach(n => {
    n.onmousemove = e => { TIP.innerHTML = n.getAttribute("data-tip"); TIP.style.opacity = 1; TIP.style.left = Math.min(innerWidth - 290, e.clientX + 14) + "px"; TIP.style.top = (e.clientY + 14) + "px"; };
    n.onmouseleave = () => TIP.style.opacity = 0;
  });
}
function toastIn(TOAST, m) { TOAST.textContent = m; TOAST.style.opacity = 1; clearTimeout(TOAST._h); TOAST._h = setTimeout(() => TOAST.style.opacity = 0, 2400); }

// one key result, as both screens read it
function krData(k, i) {
  const st = S.krStatus(k), cs = (k.checkins || []).slice().sort((a, b) => a.date < b.date ? -1 : 1), last = cs[cs.length - 1];
  return {
    raw: k, i, id: k.id, obj: k.obj, name: k.name, owner: k.owner, ownerName: pname(k.owner), unit: k.unit,
    baseline: Number(k.baseline) || 0, target: Number(k.target), current: Number(k.current), expected: Number(k.expected),
    ceiling: k.kind === "ceiling", plan: S.planLine(k), status: st.key === "new" ? "stale" : st.key, isNew: st.key === "new", ratio: st.ratio, age: st.age, label: st.label, why: st.why || "", landing: st.landing,
    checkins: cs.map(c => [c.date, Number(c.value), c.conf, c]), conf: last ? last.conf : null,
    miles: (k.miles || []).map(m => [m.week, m.text, !!m.done, m.owner || k.owner]),
    lead: { n: k.lead || "Leading indicator", v: k.leadValue || "—", note: k.leadValue ? (k.leadNote || "") : "not measured yet", tone: k.leadValue ? (k.leadTone || "stale") : "stale" }
  };
}
function paces(k) {
  const cks = [[0, k.baseline]].concat(k.checkins.map(c => [day(c[0]), c[1]])), a = cks[cks.length - 1], b = cks.length > 1 ? cks[cks.length - 2] : null;
  const wl = Math.max(1, (QDAYS - today()) / 7), need = (k.target - k.current) / wl, lb = k.ceiling || k.target < k.baseline;
  const p = (k.status === "stale" || !b) ? null : (a[1] - b[1]) / Math.max(1, a[0] - b[0]) * 7;
  const ok = p === null ? null : lb ? (k.current <= k.target || p <= need) : p >= need;
  let land = null;
  if (p !== null) { land = k.current + p / 7 * (QDAYS - today()); const cap = k.target + (k.target - k.baseline) * .25; land = lb ? Math.max(land, cap) : Math.min(land, cap); }
  return { p, need, ok, lb, land, landOk: land === null ? null : lb ? land <= k.target : land >= k.target };
}
const pf = (v, k) => { if (v === null || v === undefined) return "—"; const s = v > 0 ? "+" : v < 0 ? "−" : "", a = Math.abs(v); return s + (k.unit === "eur" ? fmt(Math.round(a), "eur") : k.unit === "eur2" ? "€" + a.toFixed(2) : k.unit === "usd" ? fmt(Math.round(a), "usd") : k.unit === "pct" ? (Math.round(a * 10) / 10) + " pts" : (a >= 10 ? Math.round(a) : Math.round(a * 10) / 10)); };
const fmtLand = (v, k) => fmt(k.unit === "eur2" ? Math.round(v * 100) / 100 : k.unit === "pct" ? Math.round(v * 10) / 10 : Math.round(v), k.unit);

// the quarter chart: plan, actual, projection (capped), target, milestones, confidence at check-ins
function krChart(box, k, opt) {
  const W = box.clientWidth, H = box.clientHeight; if (W < 100 || H < 80) return;
  const L = 56, R = 16, T = opt && opt.tight ? 14 : 22, B = 44, iw = W - L - R, ih = H - T - B, lb = k.ceiling || k.target < k.baseline, td = today();
  const pts = [[0, k.baseline, null]].concat(k.checkins.map(c => [day(c[0]), c[1], c[2]]));
  const lastCk = pts[pts.length - 1];
  if (k.status !== "stale" && (td - lastCk[0] > 2 || lastCk[1] !== k.current)) pts.push([td, k.current, null]);
  const P = paces(k), last = pts[pts.length - 1];
  const vals = [k.baseline, k.target, k.current, k.expected].concat(k.plan.map(p => p[1])).concat(pts.map(p => p[1])).concat(P.land === null ? [] : [P.land]);
  // the axis starts at 0: progress reads against the whole way, not against the starting point
  let lo = Math.min(0, ...vals), hi = Math.max(...vals); const pad = (hi - lo) * .1 || 1; hi += pad; if (lo < 0) lo -= pad;
  const X = d => L + iw * Math.max(0, Math.min(QDAYS, d)) / QDAYS, Y = v => T + ih - (v - lo) / (hi - lo) * ih, col = COL[k.status];
  const wk = S.week;
  let s = `<svg width="${W}" height="${H}" role="img" aria-label="${esc(k.name)}: plan, actual and projection over the quarter">`;
  const ticks = []; [lo, k.baseline, (k.baseline + k.target) / 2, k.target].forEach(v => { if (ticks.every(t => Math.abs(Y(t) - Y(v)) >= 14)) ticks.push(v); });
  ticks.forEach(v => { s += `<line x1="${L}" x2="${L + iw}" y1="${Y(v)}" y2="${Y(v)}" stroke="#EFEBE3"/><text x="${L - 8}" y="${Y(v) + 4}" text-anchor="end" font-family="IBM Plex Mono" font-size="11" fill="#8E8A80">${fmt(Math.round(v * 100) / 100, k.unit)}</text>`; });
  s += `<rect x="${X((wk - 1) * 7)}" y="${T}" width="${X(wk * 7) - X((wk - 1) * 7)}" height="${ih}" fill="#FBF6EC"/>`;
  for (let w = 1; w <= 13; w++) s += `<text x="${X((w - .5) * 7)}" y="${T + ih + 16}" text-anchor="middle" font-size="10.5" fill="${w === wk ? "#1B1B18" : "#8E8A80"}" font-weight="${w === wk ? 700 : 400}">${S.wl(w)}</text>`;
  const nx = k.miles.find(m => !m[2]);
  k.miles.forEach(m => { s += `<g data-tip="${S.wl(m[0])} · ${esc(m[1])} · ${esc(pname(m[3]))}${m[2] ? " · done" : ""}"><circle cx="${X((m[0] - .5) * 7)}" cy="${T + ih + 31}" r="5.5" fill="${m[2] ? "#2E7D4F" : m === nx ? "#D9B46A" : "#fff"}" stroke="${m[2] ? "#2E7D4F" : m === nx ? "#9A6614" : "#C9C4B7"}" stroke-width="1.5"/></g>`; });
  s += `<polyline points="${k.plan.map(p => X(p[0]) + "," + Y(p[1])).join(" ")}" fill="none" stroke="#1B1B18" stroke-width="1.5" stroke-dasharray="5 5"/>`;
  s += `<line x1="${X(QDAYS) - 14}" x2="${X(QDAYS) + 6}" y1="${Y(k.target)}" y2="${Y(k.target)}" stroke="#1B1B18" stroke-width="3"/>`;
  if (P.land !== null) s += `<line x1="${X(last[0])}" y1="${Y(last[1])}" x2="${X(QDAYS)}" y2="${Y(P.land)}" stroke="${col}" stroke-width="2" stroke-dasharray="1 5" stroke-linecap="round"/>`;
  s += `<polyline points="${pts.map(p => X(p[0]) + "," + Y(p[1])).join(" ")}" fill="none" stroke="${col}" stroke-width="3" stroke-linejoin="round"/>`;
  pts.slice(1).forEach(p => {
    if (p[2] !== null && p[2] !== "" && p[2] !== undefined) {
      const cc = p[2] >= 7 ? "#2E7D4F" : p[2] >= 5 ? "#B45309" : "#B42318";
      s += `<g data-tip="Check-in ${esc(fmt(p[1], k.unit))} · confidence ${p[2]}/10"><circle cx="${X(p[0])}" cy="${Y(p[1])}" r="11" fill="#fff" stroke="${cc}" stroke-width="2"/><text x="${X(p[0])}" y="${Y(p[1]) + 4}" text-anchor="middle" font-family="IBM Plex Mono" font-size="10.5" font-weight="600" fill="${cc}">${p[2]}</text></g>`;
    } else s += `<circle cx="${X(p[0])}" cy="${Y(p[1])}" r="4" fill="${col}"/>`;
  });
  if (k.status === "stale") s += `<text x="${X(last[0]) + 16}" y="${Math.max(T + 12, Y(last[1]) - 10)}" font-size="12" font-weight="600" fill="#8A3F06" stroke="#fff" stroke-width="4" stroke-linejoin="round" paint-order="stroke">${k.isNew ? "no check-in yet" : "no check-in for " + k.age + " d"}</text>`;
  box.innerHTML = s + `</svg>`;
}

// what is behind an item: effect → cause, then the actions that exist in the OS
function openTasks(ids) { return (ids || []).map(id => S.get("tasks", id)).filter(t => t && S.isOpen(t)); }
function hoursSince(iso) { return Math.max(0, Math.round((S.today - D(iso)) / 36e5)); }
function alertFor(ref) { return S.inbox().find(a => a.ref === ref && a.status === "open"); }
function nudge(ref, pid, TOAST) {
  const a = alertFor(ref);
  if (a) S.inboxAct(a, "nudge", {}, pname(pid));
  toastIn(TOAST, "Reminder logged for " + pname(pid) + (a ? " in Execute" : ""));
}
function chainKR(id) {
  const raw = S.get("krs", id); if (!raw) return null;
  const k = krData(raw, 0), nodes = [], acts = [];
  if (k.status === "stale") nodes.push({ k: "Key result", t: k.isNew ? "No check-in yet" : "No check-in for " + k.age + " d", m: "Owner " + k.ownerName, c: "stale" });
  else nodes.push({ k: "Key result · " + k.label, t: k.why || (k.ratio.toFixed(2) + " actual ÷ expected"), m: k.ratio.toFixed(2) + " actual ÷ expected · " + fmt(k.current, k.unit) + " for " + fmt(k.expected, k.unit) + " expected", c: k.status });
  if (raw.leadValue) nodes.push({ k: "Leading indicator", t: k.lead.n + " " + raw.leadValue, m: raw.leadNote || "", c: k.lead.tone });
  const tasks = S.list("tasks").filter(t => t.kr === id && S.isOpen(t));
  tasks.filter(t => t.status === "blocked").forEach(t => nodes.push({ k: "Blocked task", t: t.title, m: pname(t.owner) + (t.since ? " · blocked " + age(hoursSince(t.since)) : ""), c: "amber" }));
  const decs = S.list("decisions").filter(d => d.col === "todo" && (d.links && (d.links.kr || []).indexOf(id) >= 0));
  decs.sort((a, b) => a.deadline < b.deadline ? -1 : 1).slice(0, 2).forEach(d => {
    const late = d.deadline && d.deadline < TODAY();
    nodes.push({ k: late ? "Cause" : "Decision", t: d.title, m: pname(d.owner) + " · " + (late ? (today() - day(d.deadline)) + " d late" : "due " + wd(d.deadline)) + (d.reversible ? "" : " · irreversible"), c: late ? "red" : "amber" });
  });
  const late = decs.find(d => d.deadline && d.deadline < TODAY()), blk = tasks.find(t => t.status === "blocked");
  if (k.status === "stale") acts.push(["p", "Ask " + k.ownerName + " for a check-in", () => ({ nudge: [id, k.owner] })]);
  if (late) acts.push(["p", "Open the decision", () => ({ goto: ["decisions", late.id] })]);
  if (blk) acts.push(["s", "Nudge " + pname(blk.owner), () => ({ nudge: [blk.id, blk.owner] })]);
  if (late && late.owner !== S.me && S.me) acts.push(["s", "Take the decision", () => ({ save: ["decisions", Object.assign({}, late, { owner: S.me })], msg: "You now own “" + late.title + "”" })]);
  acts.push(["s", "Open in Build", () => ({ kr: id })]);
  return { ey: k.status === "green" ? "On track" : k.status === "stale" ? "Why it is not tracked" : "Why it is " + k.label.toLowerCase(), title: k.name, nodes, acts };
}
function chainTask(id) {
  const t = S.get("tasks", id); if (!t) return null;
  const nodes = [{ k: t.status === "blocked" ? "Blocked task" : "Task", t: t.title, m: pname(t.owner) + (t.status === "blocked" && t.since ? " · blocked " + age(hoursSince(t.since)) : " · due " + wd(t.due)) + (t.note ? " · " + t.note : ""), c: t.status === "blocked" ? "amber" : "stale" }];
  const dec = S.list("decisions").find(d => d.col === "todo" && d.links && (d.links.task || []).indexOf(id) >= 0);
  if (dec) nodes.push({ k: "Waiting on a decision", t: dec.title, m: pname(dec.owner) + " · " + (dec.deadline < TODAY() ? (today() - day(dec.deadline)) + " d late" : "due " + wd(dec.deadline)), c: dec.deadline < TODAY() ? "red" : "amber" });
  const kr = t.kr && S.get("krs", t.kr);
  if (kr) { const k = krData(kr, 0); nodes.push({ k: "Key result at stake", t: k.name, m: k.status === "stale" ? "not tracked" : k.label + " · " + k.ratio.toFixed(2), c: k.status }); }
  const acts = [];
  if (dec) acts.push(["p", "Open the decision", () => ({ goto: ["decisions", dec.id] })]);
  acts.push([dec ? "s" : "p", "Open in Execute", () => ({ goto: ["monjour", t.owner] })]);
  acts.push(["s", "Nudge " + pname(t.owner), () => ({ nudge: [id, t.owner] })]);
  if (t.est > 8) acts.push(["s", "Turn into an exploration", () => ({ save: ["tasks", Object.assign({}, t, { kind: "E", unc: "I", est: 8, status: t.status === "split" ? "todo" : t.status, note: "Timeboxed exploration (was " + t.est + " h)" })], msg: "Turned into an exploration, timebox 8 h" })]);
  return { ey: t.status === "blocked" ? "Why it is stuck" : "Why it is flagged", title: t.title, nodes, acts };
}
function chainDec(id) {
  const d = S.get("decisions", id); if (!d) return null;
  const late = d.col === "todo" && d.deadline && d.deadline < TODAY();
  const nodes = [{ k: d.col === "review" ? "Review due" : late ? "Late decision" : "Decision", t: d.title, m: pname(d.owner) + " · " + (d.col === "review" ? "review " + wd(d.review) : late ? (today() - day(d.deadline)) + " d late" : "due " + wd(d.deadline)) + (d.reversible ? "" : " · irreversible"), c: late ? "red" : d.col === "review" ? "stale" : "amber" }];
  openTasks(d.links && d.links.task).forEach(t => nodes.push({ k: t.status === "blocked" ? "Blocked task" : "Waiting task", t: t.title, m: pname(t.owner), c: t.status === "blocked" ? "amber" : "stale" }));
  ((d.links && d.links.kr) || []).forEach(kid => { const kr = S.get("krs", kid); if (kr) { const k = krData(kr, 0); nodes.push({ k: "Key result at stake", t: k.name, m: k.status === "stale" ? "not tracked" : k.label + " · " + k.ratio.toFixed(2), c: k.status }); } });
  const acts = [["p", d.col === "review" ? "Start the review" : "Decide now", () => ({ goto: ["decisions", id] })]];
  if (d.owner !== S.me) acts.push(["s", "Nudge " + pname(d.owner), () => ({ nudge: [id, d.owner] })]);
  if (d.col === "todo") acts.push(["s", "Push the deadline by 2 days", () => ({ save: ["decisions", Object.assign({}, d, { deadline: S.iso(new Date(D(d.deadline < TODAY() ? TODAY() : d.deadline).getTime() + 2 * 864e5)) })], msg: "New deadline set" })]);
  if (S.me && d.owner !== S.me && d.col === "todo") acts.push(["s", "Take the decision", () => ({ save: ["decisions", Object.assign({}, d, { owner: S.me })], msg: "You now own this decision" })]);
  return { ey: d.col === "review" ? "Review" : late ? "Late decision" : "Decision", title: d.title, nodes, acts };
}
function chainFor(ref) {
  if (!ref) return null;
  const [type, id] = ref.split(":");
  return type === "kr" ? chainKR(id) : type === "task" ? chainTask(id) : type === "dec" ? chainDec(id) : null;
}
function runAct(res, TOAST, close) {
  if (!res) return;
  if (res.nudge) nudge(res.nudge[0], res.nudge[1], TOAST);
  if (res.save) { if (S.readOnly) { toastIn(TOAST, "Read-only access: not saved"); return; } S.save(res.save[0], res.save[1]); toastIn(TOAST, res.msg || "Saved"); }
  if (res.goto) { close && close(); S.goto(res.goto[0], res.goto[1]); }
  if (res.kr) { close && close(); S.openKr(res.kr); }
}
