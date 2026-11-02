/* Cockpit › Overview: the three questions on one screen, from the shared data. Mounted in a shadow root. */
const R = ROOT, el = id => R.getElementById(id);
const tips = n => bindTips(n, TIP);
let cur = null, actTab = "mine";

function brief(krs) {
  const items = [];
  const rank = k => (k.status === "red" ? 0 : 1) * 10 + (k.landing === null || k.landing === undefined ? 1 : k.landing) + k.ratio / 100;
  const worst = krs.filter(k => k.status !== "stale" && k.status !== "green").sort((a, b) => rank(a) - rank(b))[0];
  if (worst) { const P = paces(worst); items.push({ c: COL[worst.status], ref: "kr:" + worst.id, h: `<b>${esc(worst.name)}</b> · <b>${esc(worst.label.toLowerCase())}</b>: ` + (P.p === null ? "needs a second check-in to read its pace" : P.ok ? `pace ${pf(P.p, worst)}/wk covers the ${pf(P.need, worst)} needed, still ${worst.ratio.toFixed(2)} of plan` : `needs ${pf(P.need, worst)}/wk, doing ${pf(P.p, worst)}`) }); }
  else items.push({ c: COL.green, ref: "", h: `<b>Every tracked key result is on plan</b>` });
  const decs = S.list("decisions").filter(d => d.col === "todo" && d.deadline);
  const late = decs.filter(d => d.deadline < TODAY()).sort((a, b) => a.deadline < b.deadline ? -1 : 1)[0];
  if (late) { const n = openTasks(late.links && late.links.task).length; items.push({ c: COL.red, ref: "dec:" + late.id, h: `<b>${esc(late.title)}</b> is <b>${today() - day(late.deadline)} d late</b>` + (n ? ` and blocks ${n} task${n > 1 ? "s" : ""}` : "") }); }
  const irr = decs.filter(d => !d.reversible && d.deadline >= TODAY()).sort((a, b) => a.deadline < b.deadline ? -1 : 1)[0];
  const stale = krs.find(k => k.status === "stale");
  if (irr) { const n = openTasks(irr.links && irr.links.task).length; items.push({ c: COL.amber, ref: "dec:" + irr.id, h: `<b>${esc(irr.title)}</b>, irreversible, due <b>${wd(irr.deadline)}</b>` + (n ? `: blocks ${n} task${n > 1 ? "s" : ""}` : "") }); }
  else if (stale) items.push({ c: COL.stale, ref: "kr:" + stale.id, h: `<b>${esc(stale.name)}</b> is not tracked: no recent check-in` });
  while (items.length < 3) { const nd = decs.filter(d => d.deadline >= TODAY() && !items.some(x => x.ref === "dec:" + d.id)).sort((a, b) => a.deadline < b.deadline ? -1 : 1)[0]; if (!nd) break; items.push({ c: COL.amber, ref: "dec:" + nd.id, h: `<b>${esc(nd.title)}</b> to decide by <b>${wd(nd.deadline)}</b>` }); }
  el("brief").innerHTML = `<span class="lab">Today</span>` + items.slice(0, 3).map(x => `<button class="bi" data-ref="${x.ref}"><i style="background:${x.c}"></i><span>${x.h}</span></button>`).join("");
  el("brief").querySelectorAll(".bi").forEach(b => b.onclick = () => openWhy(b.dataset.ref));
}

function header(krs) {
  const c = { green: 0, amber: 0, red: 0, stale: 0 }; krs.forEach(k => c[k.status]++);
  el("health").innerHTML = `<span>KRs</span><div class="health">${["green", "amber", "red", "stale"].map(s => c[s] ? `<i style="flex:${c[s]};background:${COL[s]}" data-tip="${c[s]} ${LBL[s].toLowerCase()}"></i>` : "").join("")}</div>` +
    ["green", "amber", "red", "stale"].map(s => `<b style="color:${COL[s]}" data-tip="${LBL[s]}">${c[s]}</b>`).join("");
  const hyg = [];
  krs.forEach(k => { if (k.status === "stale") hyg.push(esc(k.name) + (k.isNew ? ": no check-in yet" : ": no check-in for " + k.age + " d")); });
  krs.forEach(k => { if (!k.raw.leadValue) hyg.push(esc(k.name) + ": leading indicator not measured"); });
  const missing = S.members.filter(m => !S.get("dailies", m.id + "-" + TODAY())).length;
  if (missing) hyg.push(missing + " of " + S.members.length + " dailies not filed today");
  el("hyg").innerHTML = `<span>Hygiene</span><b style="color:${hyg.length ? "var(--ambert)" : "var(--greent)"}">${hyg.length}</b>`;
  el("hyg").setAttribute("data-tip", hyg.length ? hyg.join("<br>") : "All green");
}

function krWindow(krs) {
  if (!krs.length) { el("kri").innerHTML = `<div class="who">No key result yet.</div>`; el("krchart").innerHTML = ""; el("krx").innerHTML = ""; el("chips").innerHTML = ""; return; }
  if (cur === null || cur >= krs.length) { const rk = k => k.status === "red" ? 0 : k.status === "amber" ? 1 + (k.landing == null ? 1 : k.landing) : k.status === "stale" ? 5 : 9; cur = krs.reduce((b, k, i) => rk(k) < rk(krs[b]) ? i : b, 0); }
  const k = krs[cur], col = COL[k.status], P = paces(k);
  el("chips").innerHTML = krs.map((x, i) => `<button class="chip ${i === cur ? "on" : ""}" style="background:${COL[x.status]}" data-i="${i}" data-tip="${esc(x.name)} · ${x.label}">${i + 1}</button>`).join("");
  el("chips").querySelectorAll("button").forEach(b => b.onclick = () => { cur = +b.dataset.i; render(); });
  const ratio = k.status === "stale" ? "?" : (P.lb && k.current <= k.target) ? "✓" : k.ratio.toFixed(2);
  el("kri").innerHTML = `<span class="o" title="${esc(k.obj)} · ${esc(shortObj(k.obj))}">${esc(k.obj)} · ${esc(shortObj(k.obj))}</span><h3 title="${esc(k.name)}">${esc(k.name)}</h3><span class="who">${esc(k.ownerName)}</span>
    <span style="display:flex;gap:6px;align-items:center"><span class="st s-${k.status}"><i></i>${k.status === "stale" ? (k.isNew ? "No check-in yet" : "No check-in · " + k.age + " d") : k.label}</span>${k.conf ? `<span class="st s-stale" style="background:var(--bg)" data-tip="Owner confidence at the last check-in">conf. ${k.conf}/10</span>` : ""}</span>
    <div class="big"><b style="color:${col}">${ratio}</b><span>actual ÷<br>expected</span></div>
    <div class="facts"><div data-tip="Expected by now: ${esc(fmt(k.expected, k.unit))}"><span>Actual</span><b>${esc(fmt(k.current, k.unit))}</b></div><div><span>Target</span><b>${esc(fmt(k.target, k.unit))}</b></div>
      <div data-tip="Change per week over the last two check-ins"><span>Pace / week</span><b style="color:${P.ok === null ? "var(--mut)" : P.ok ? "var(--greent)" : "var(--redt)"}">${pf(P.p, k)}</b></div><div data-tip="Change per week needed from today to reach the target"><span>Needed / week</span><b>${P.lb && k.current <= k.target ? "at target" : pf(P.need, k)}</b></div></div>
    <div style="display:flex;gap:6px"><button class="why" data-ref="kr:${k.id}">${k.status === "green" ? "Why it is green" : "Why, and what to do"} →</button><button class="why ghost" data-room="${k.id}" data-tip="Open the key result screen">Open ↗</button></div>`;
  const L = k.lead, n = k.miles.find(m => !m[2]);
  el("krx").innerHTML = `<div class="lead" data-tip="Leading indicator: it moves before the key result. It is part of the key result definition."><div><span>Leading indicator</span><b>${esc(L.n)}</b></div><div style="text-align:right"><span class="vv" style="color:${COL[L.tone] || "#8E8A80"}">${esc(L.v)}</span><span>${esc(L.note)}</span></div></div>
    ${n ? `<div class="nextm" style="display:flex;justify-content:space-between;align-items:center;gap:10px"><div><span>Next milestone</span><b>${esc(n[1])}</b></div><span class="vv" style="color:var(--gold2)">${S.wl(n[0])}</span></div>` : `<div class="nextm"><span>Next milestone</span><b>All milestones done</b></div>`}`;
  el("kri").querySelector("[data-ref]").onclick = e => openWhy(e.currentTarget.dataset.ref);
  el("kri").querySelector("[data-room]").onclick = e => { window.SKL_KRROOM_SEL = e.currentTarget.dataset.room; S.goto("cockpit", "kr"); };
  krChart(el("krchart"), k);
}

function pulse() {
  const ps = S.milestoneStats(), last = ps[ps.length - 1], prev = ps[ps.length - 2], F = S.flowStats();
  const P = [
    last ? { l: "Milestones reached", v: last.pct, prev: prev ? prev.pct : null, unit: "%", target: 80, max: 100, better: "up", tip: "Weekly milestones of " + S.wl(last.week) + " reached (" + last.done + " of " + last.total + "). Target 80% or more." }
      : { l: "Milestones reached", v: null, unit: "%", target: 80, max: 100, better: "up", tip: "Scored once a week with milestones is over" },
    { l: "Cycle time", v: F.cycle.v, prev: F.cycle.prev, unit: " d", target: 3, max: 6, better: "down", tip: F.cycle.n ? "Start to delivery, median of the " + F.cycle.n + " tasks delivered in the last 4 weeks. Target 3 days or less." : "Measured once tasks are started and delivered. Target 3 days or less." },
    { l: "Decision speed", v: F.decision.v, prev: F.decision.prev, unit: " d", target: 2, max: 5, better: "down", tip: F.decision.n ? "Opening to decision, median of the " + F.decision.n + " decisions taken in the last 4 weeks. Target 2 days or less." : "Measured once decisions are taken. Target 2 days or less." }
  ];
  el("pulse").innerHTML = P.map(p => {
    if (p.v === null) return `<div class="pr" data-tip="${p.tip}"><div class="h"><span class="l">${p.l}</span></div><span class="v" style="color:var(--mut)">—</span><div class="bul"></div><small>target ${p.better === "up" ? "≥" : "≤"} ${p.target}${p.unit}</small></div>`;
    const good = p.better === "up" ? p.v >= p.target : p.v <= p.target, c = good ? "var(--green)" : (Math.abs(p.v - p.target) / p.target < .25 ? "var(--amber)" : "var(--red)");
    const dlt = p.prev === null || p.prev === undefined ? "" : ((p.v > p.prev ? "↑ " : "↓ ") + Math.abs(Math.round((p.v - p.prev) * 10) / 10) + p.unit.trim());
    const dGood = p.prev == null ? true : (p.better === "up" ? p.v >= p.prev : p.v <= p.prev);
    return `<div class="pr" data-tip="${p.tip}"><div class="h"><span class="l">${p.l}${p.sample ? ' <em class="smp">sample</em>' : ""}</span><span class="d" style="color:${dGood ? "var(--greent)" : "var(--redt)"}">${dlt}</span></div>
      <span class="v" style="color:${c}">${p.v}${p.unit}</span>
      <div class="bul"><i style="width:${Math.min(100, p.v / p.max * 100)}%;background:${c}"></i><u style="left:${p.target / p.max * 100}%"></u></div><small>target ${p.better === "up" ? "≥" : "≤"} ${p.target}${p.unit}</small></div>`;
  }).join("");
}

function decisions(krs) {
  const mon = S.weekMonday(S.week), days = [0, 1, 2, 3, 4].map(i => S.iso(new Date(D(mon).getTime() + i * 864e5))), fri = days[4], T = TODAY();
  const krNo = id => { const i = krs.findIndex(k => k.id === id); return i < 0 ? "" : "KR " + (i + 1); };
  const rows = [];
  S.list("decisions").forEach(d => {
    if (d.col === "todo" && d.deadline && d.deadline <= fri) rows.push({ kind: "decide", ref: "dec:" + d.id, title: d.title, pid: d.owner, due: d.deadline, rev: d.reversible, blocks: openTasks(d.links && d.links.task).length, kr: krNo(((d.links && d.links.kr) || [])[0]) });
    if (d.col === "review" && d.review && d.review <= fri) rows.push({ kind: "review", ref: "dec:" + d.id, title: "Review: " + d.title, pid: d.owner, due: d.review, rev: true, blocks: 0, kr: krNo(((d.links && d.links.kr) || [])[0]) });
  });
  S.list("tasks").forEach(t => { if (t.kind === "E" && S.isOpen(t) && t.due && t.due <= fri) rows.push({ kind: "explore", ref: "task:" + t.id, title: t.title, pid: t.owner, due: t.due, rev: true, blocks: 0, kr: krNo(t.kr) }); });
  rows.sort((a, b) => a.due < b.due ? -1 : a.due > b.due ? 1 : 0);
  const late = rows.filter(r => r.kind === "decide" && r.due < T).length;
  el("decq").innerHTML = `<span class="lg"><span><i></i>decide</span><span><i style="background:#fff;border:2px solid #0F5E5C;width:7px;height:7px"></i>end of exploration</span><span><i style="border-radius:2px;background:#8E8A80"></i>review</span>${late ? `<b style="color:var(--redt)">${late} late</b>` : ""}</span>`;
  const colOf = d => d < days[0] ? 0 : days.indexOf(d) + 1;
  el("decs").innerHTML = `<div class="dh"><span>This week</span><div class="days"><span>late</span>${days.map(d => `<span class="${d === T ? "td" : ""}">${D(d).toLocaleDateString("en-GB", { weekday: "short" }).slice(0, 2)}<br>${D(d).getDate()}</span>`).join("")}</div></div>` +
    (rows.length ? rows.slice(0, 8).map(r => {
      const c = colOf(r.due), isLate = r.due < T, col = r.kind === "review" ? "#8E8A80" : isLate ? "#B42318" : !r.rev ? "#B45309" : "#1B1B18";
      return `<div class="dr" data-ref="${r.ref}" data-tip="${esc(r.title)} · ${esc(pname(r.pid))} · ${r.kind === "review" ? "review" : r.kind === "explore" ? "decide at the end of the exploration" : "decide"} by ${D(r.due).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" })}${r.blocks ? " · blocks " + r.blocks + " task" + (r.blocks > 1 ? "s" : "") : ""}${r.kr ? " · " + r.kr : ""}">
        <div class="k">${av(r.pid, 20)}<span class="t">${esc(r.title)}</span>${!r.rev ? '<span class="tag" style="background:var(--ambers);color:var(--ambert)">irreversible</span>' : ""}${r.blocks ? `<span class="tag" style="background:var(--reds);color:var(--redt)">blocks ${r.blocks}</span>` : ""}</div>
        <div class="strip">${[0, 1, 2, 3, 4, 5].map(i => `<i class="${i > 0 && days[i - 1] === T ? "td" : ""}"></i>`).join("")}<span class="mk ${r.kind === "review" ? "rv" : r.kind === "explore" ? "ex" : ""}" style="--c:#0F5E5C;left:${(c === 0 ? .55 : 1.1 + (c - 1) + .5) / 6.1 * 100}%;${r.kind === "explore" ? "" : "background:" + col}"></span></div></div>`;
    }).join("") : `<div class="empty">Nothing to decide this week.</div>`);
  el("decs").querySelectorAll(".dr").forEach(n => n.onclick = () => openWhy(n.dataset.ref));
}

function needsAction() {
  const me = S.me, all = S.inbox().filter(a => a.status === "open" && a.area === "Tasks");
  const mine = me ? all.filter(a => a.assignee === me || a.escalateTo === me) : [];
  if (!me) actTab = "team";
  el("actseg").innerHTML = `<button class="${actTab === "mine" ? "on" : ""}" data-t="mine"${me ? "" : " disabled title=\"Choose who you are in the sidebar\""}>Mine<b>${mine.length}</b></button><button class="${actTab === "team" ? "on" : ""}" data-t="team">Team<b>${all.length}</b></button>`;
  el("actseg").querySelectorAll("button").forEach(b => b.onclick = () => { if (b.disabled) return; actTab = b.dataset.t; render(); });
  const L = (actTab === "mine" ? mine : all).slice().sort((a, b) => (b.escalated ? 1 : 0) - (a.escalated ? 1 : 0) || b.ageH - a.ageH);
  el("acts").innerHTML = L.length ? L.slice(0, 7).map(a => `<div class="ar" data-ref="task:${a.ref}" data-tip="${esc(a.ruleName)} · ${esc(a.assigneeName)}${a.escalated ? " · escalated to " + esc(pname(a.escalateTo)) : ""}. Click: why, and what to do">
      <span class="dot" style="background:${a.sev === "Critical" ? "var(--red)" : a.sev === "High" ? "var(--amber)" : "var(--mut2)"}"></span>
      <div style="min-width:0"><div class="t">${esc(a.subject)}</div><div class="k">${esc(a.ruleName.replace("Task ", "").replace(/^./, c => c.toUpperCase()))}${a.escalated ? ` · <b>escalated</b>` : ""}</div></div>
      ${av(a.assignee)}<span class="age">${age(a.ageH)}</span></div>`).join("")
    : `<div class="empty">${actTab === "mine" ? "Nothing blocked or late on your side." : "No blocked or late task."}</div>`;
  el("acts").querySelectorAll(".ar").forEach(n => n.onclick = () => openWhy(n.dataset.ref));
}

function feed(krs) {
  const reviews = S.list("reviews").filter(r => r.status === "closed").sort((a, b) => a.date < b.date ? 1 : -1);
  const since = reviews[0] ? reviews[0].date : Q0(), T = TODAY(), ev = [];
  el("feedq").textContent = reviews[0] ? "last review · " + D(since).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "this quarter";
  krs.forEach(k => {
    k.checkins.forEach(c => { if (c[0] > since && c[0] <= T) ev.push({ d: c[0], c: "green", i: "✓", t: k.name + " checked in at " + fmt(c[1], k.unit), ref: "kr:" + k.id }); });
    const lc = k.checkins[k.checkins.length - 1];
    if (k.status === "red" && lc && lc[0] > since) ev.push({ d: lc[0], c: "red", i: "!", t: k.name + " is red at " + k.ratio.toFixed(2), ref: "kr:" + k.id });
    if (k.status === "stale" && lc) { const sd = S.iso(new Date(D(lc[0]).getTime() + S.rule("a7").v * 864e5)); if (sd > since && sd <= T) ev.push({ d: sd, c: "stale", i: "?", t: k.name + " became not tracked", ref: "kr:" + k.id }); }
  });
  S.list("decisions").forEach(d => {
    if (d.decided && d.decided > since && d.decided <= T) ev.push({ d: d.decided, c: "green", i: "✓", t: "Decided: " + d.title, ref: "dec:" + d.id });
    if (d.col === "todo" && d.deadline && d.deadline > since && d.deadline < T) ev.push({ d: d.deadline, c: "red", i: "!", t: d.title + " went overdue", ref: "dec:" + d.id });
  });
  S.list("tasks").forEach(t => {
    if (t.status === "blocked" && t.since && t.since > since) ev.push({ d: t.since, c: "amber", i: "‖", t: t.title + " blocked", ref: "task:" + t.id });
    if (t.status === "done" && t.doneAt && t.doneAt > since) ev.push({ d: t.doneAt, c: "green", i: "✓", t: t.title + " delivered", ref: "task:" + t.id });
  });
  ev.sort((a, b) => a.d < b.d ? 1 : -1);
  el("feed").innerHTML = ev.length ? ev.slice(0, 9).map(e => `<div class="ev" data-ref="${e.ref}" data-tip="${esc(e.t)}"><span class="ic" style="background:${COL[e.c]}">${e.i}</span><span class="tx">${esc(e.t)}</span><span class="d">${D(e.d).toLocaleDateString("en-GB", { weekday: "short" })}</span></div>`).join("") : `<div class="empty">Nothing new since the last review.</div>`;
  el("feed").querySelectorAll(".ev").forEach(n => n.onclick = () => openWhy(n.dataset.ref));
}

/* the side panel: effect → cause, then the actions that exist in the OS */
function openWhy(ref) {
  const c = chainFor(ref); if (!c) return;
  const dr = el("drawer");
  dr.innerHTML = `<button class="x" aria-label="Close">×</button><span class="ey">${esc(c.ey)}</span><h3>${esc(c.title)}</h3>
    <div class="chain">${c.nodes.map((n, i) => `<div class="node"><span class="c" style="background:${COL[n.c] || "#8E8A80"}">${i + 1}</span><div><div class="k">${esc(n.k)}</div><div class="t">${esc(n.t)}</div><div class="m">${esc(n.m)}</div></div></div>`).join("")}</div>
    <div class="acts2">${c.acts.map((a, i) => `<button class="btn ${a[0]}" data-i="${i}">${esc(a[1])}<span>→</span></button>`).join("")}</div>`;
  dr.querySelectorAll(".btn").forEach(b => b.onclick = () => runAct(c.acts[+b.dataset.i][2](), TOAST, closeWhy));
  dr.querySelector(".x").onclick = closeWhy;
  dr.classList.add("open"); el("veil").classList.add("open");
}
function closeWhy() { el("drawer").classList.remove("open"); el("veil").classList.remove("open"); }
el("veil").onclick = closeWhy;
el("krprev").onclick = () => { const n = S.list("krs").length; if (n) { cur = ((cur || 0) - 1 + n) % n; render(); } };
el("krnext").onclick = () => { const n = S.list("krs").length; if (n) { cur = ((cur || 0) + 1) % n; render(); } };
R.host.addEventListener("keydown", e => { if (e.key === "Escape") closeWhy(); });

function render() {
  if (!R.host.isConnected) return;
  const krs = S.list("krs").map(krData);
  header(krs); brief(krs); krWindow(krs); pulse(); decisions(krs); needsAction(); feed(krs);
  tips(R);
}
render();
if (document.fonts) document.fonts.ready.then(render);
let rw = ""; new ResizeObserver(() => { const w = R.host.clientWidth + "x" + R.host.clientHeight; if (w !== rw) { rw = w; render(); } }).observe(R.host);
return { render };
