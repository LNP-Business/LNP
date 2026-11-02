/* Cockpit › Key results: one screen per key result, across teams. Mounted in a shadow root. */
const R = ROOT, el = id => R.getElementById(id);
const POLE = { marketing: "Marketing", contenu: "Content", sales: "Sales", romain: "Leadership", amin: "Leadership" };
const ST = { done: ["#2E7D4F", "Done"], progress: ["#D9B46A", "In progress"], todo: ["#C9C4B7", "To do"], blocked: ["#B42318", "Blocked"], split: ["#B45309", "To split"] };
let cur = null;

function render() {
  if (!R.host.isConnected) return;
  const list = S.list("krs");
  if (window.SKL_KRROOM_SEL) { const i = list.findIndex(k => k.id === window.SKL_KRROOM_SEL); if (i >= 0) cur = i; window.SKL_KRROOM_SEL = null; }
  if (!list.length) { el("id").innerHTML = `<div class="who">No key result yet.</div>`; ["chart", "gauges", "inits", "way", "ci", "chips"].forEach(i => el(i).innerHTML = ""); return; }
  const krs = list.map(krData);
  if (cur === null || cur >= krs.length) { const rk = k => k.status === "red" ? 0 : k.status === "amber" ? 1 + (k.landing == null ? 1 : k.landing) : k.status === "stale" ? 5 : 9; cur = krs.reduce((b, k, i) => rk(k) < rk(krs[b]) ? i : b, 0); }
  const k = krs[cur], raw = k.raw, col = COL[k.status], P = paces(k);
  el("chips").innerHTML = krs.map((x, i) => `<button class="chip ${i === cur ? "on" : ""}" style="background:${COL[x.status]}" data-i="${i}" data-tip="${esc(x.name)} · ${x.label}">${i + 1}</button>`).join("");
  el("chips").querySelectorAll("button").forEach(b => b.onclick = () => { cur = +b.dataset.i; render(); });

  // who is involved: teams owning tasks on this key result
  const tasks = S.list("tasks").filter(t => t.kr === k.id);
  const poles = {}; tasks.forEach(t => { const p = POLE[t.owner] || "Other"; poles[p] = (poles[p] || 0) + 1; });
  const ratio = k.status === "stale" ? "?" : (P.lb && k.current <= k.target) ? "✓" : k.ratio.toFixed(2);
  el("id").innerHTML = `<span class="o" title="${esc(k.obj)} · ${esc(shortObj(k.obj))}">${esc(k.obj)} · ${esc(shortObj(k.obj))}</span><h1 title="${esc(k.name)}">${esc(k.name)}</h1><span class="who">Owner: ${esc(k.ownerName)}</span>
    <span style="display:flex;gap:6px"><span class="st s-${k.status}"><i></i>${k.status === "stale" ? (k.isNew ? "No check-in yet" : "No check-in · " + k.age + " d") : k.label}</span></span>
    <div class="pol" data-tip="Teams with tasks on this key result">${Object.entries(poles).map(([p, n]) => `<span>${p} · ${n}</span>`).join("") || "<span>No task yet</span>"}</div>
    <div class="big"><b style="color:${col}">${ratio}</b><span>actual ÷<br>expected</span></div>
    <div style="font-family:var(--mono);font-size:13px;color:var(--mut)">${esc(fmt(k.current, k.unit))} of ${esc(fmt(k.target, k.unit))} · expected ${esc(fmt(k.expected, k.unit))}</div>
    <button class="open" data-tip="Edit the definition, initiatives, milestones and risks">Open in Build ↗</button>`;
  el("id").querySelector(".open").onclick = () => S.openKr(k.id);
  krChart(el("chart"), k, { tight: true });

  // the three gauges
  const mx = Math.max(Math.abs(P.p || 0), Math.abs(P.need), 1e-9) * 1.15, L = k.lead;
  el("gauges").innerHTML = `
   <div class="g" data-tip="Change per week over the last two check-ins, against what the target needs from today"><span class="k"><span>Pace / week</span><span>needed ${P.lb && k.current <= k.target ? "at target" : pf(P.need, k)}</span></span>
     <span class="v" style="color:${P.ok === null ? "var(--mut)" : P.ok ? "var(--greent)" : "var(--redt)"}">${pf(P.p, k)}</span>
     <div class="bar"><i style="width:${P.p === null ? 0 : Math.min(100, Math.abs(P.p) / mx * 100)}%;background:${P.ok ? "var(--green)" : "var(--red)"}"></i><u style="left:${Math.min(100, Math.abs(P.need) / mx * 100)}%"></u></div></div>
   <div class="g" data-tip="Leading indicator: it moves before the key result. It is part of the key result definition."><span class="k"><span>Leading indicator</span><span>${esc(L.note)}</span></span>
     <span class="v" style="color:${COL[L.tone] || "#8E8A80"}">${esc(L.v)}<small>${esc(L.n)}</small></span></div>
   <div class="g" data-tip="Where the key result lands at the recent pace, capped at 125% of the target"><span class="k"><span>Landing at this pace</span><span>target ${esc(fmt(k.target, k.unit))}</span></span>
     <span class="v" style="color:${P.landOk === null ? "var(--mut)" : P.landOk ? "var(--greent)" : "var(--redt)"}">${P.land === null ? "unknown" : esc(fmtLand(P.land, k))}</span></div>`;

  // initiatives and their tasks
  const inits = raw.inits || [];
  const groups = inits.map((x, i) => ({ name: x.name, hyp: x.hyp, contrib: x.contrib || "", idx: i, tasks: tasks.filter(t => Number(t.init) === i) }));
  const loose = tasks.filter(t => !(Number(t.init) >= 0 && Number(t.init) < inits.length));
  if (loose.length) groups.push({ name: "Not tied to an initiative", hyp: "", contrib: "", idx: -1, tasks: loose });
  el("inits").innerHTML = (groups.length ? groups.map(g => `<div class="ir"><div style="min-width:0"><div class="n">${g.idx >= 0 ? "I" + (g.idx + 1) + " · " : ""}${esc(g.name)}</div>${g.hyp ? `<div class="h" data-tip="${esc(g.hyp)}">${esc(g.hyp)}</div>` : `<div class="h">Run and coordination</div>`}</div>
      <span class="c" data-tip="Expected contribution: ${esc(g.contrib)}">${esc(((g.contrib || "").match(/^[+−-]?\s?[€$]?\d[\d.,]*\s?(%|k|pts)?/) || [""])[0].trim())}</span>
      <div class="tk">${g.tasks.map(t => { const s = ST[t.status] || ST.todo; return `<i style="background:${s[0]}" data-task="${t.id}" data-tip="${esc(t.title)} · ${esc(pname(t.owner))} · ${s[1]} · due ${t.due ? D(t.due).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "—"}${t.kind === "E" ? " · exploration" : ""}">${esc(ini(t.owner))}</i>`; }).join("") || '<span style="font-size:11px;color:var(--mut)">no task yet</span>'}</div></div>`).join("")
    : `<div class="empty">No initiative yet.</div>`) +
    `<div class="legend">${Object.values(ST).map(([c, l]) => `<span><em style="background:${c}"></em>${l}</span>`).join("")}</div>`;
  el("inits").querySelectorAll("[data-task]").forEach(n => { n.style.cursor = "pointer"; n.onclick = () => { const t = S.get("tasks", n.dataset.task); if (t) S.goto("monjour", t.owner); }; });

  // decisions and risks on this key result
  const decs = S.list("decisions").filter(d => d.links && (d.links.kr || []).indexOf(k.id) >= 0 && (d.col === "todo" || d.col === "review"));
  const pm = { low: 0, medium: 1, high: 2 }, risks = raw.risks || [];
  el("wq").textContent = `${decs.filter(d => d.col === "todo").length} decision${decs.filter(d => d.col === "todo").length === 1 ? "" : "s"} · ${risks.length} risk${risks.length === 1 ? "" : "s"}`;
  el("way").innerHTML = `<div class="sub">Decisions</div>` + (decs.length ? decs.sort((a, b) => ((a.deadline || a.review) < (b.deadline || b.review) ? -1 : 1)).map(d => {
      const due = d.col === "todo" ? d.deadline : d.review, late = due && due < TODAY(), c = d.col === "review" ? "#8E8A80" : late ? "#B42318" : !d.reversible ? "#B45309" : "#1B1B18", nb = openTasks(d.links.task).length;
      return `<div class="lr" data-dec="${d.id}" data-tip="${esc(d.title)} · ${esc(pname(d.owner))}${nb ? " · blocks " + nb + " task" + (nb > 1 ? "s" : "") : ""}"><span class="${d.col === "review" ? "sq" : "dot"}" style="background:${c}"></span>
        <div style="min-width:0"><div class="t">${esc(d.title)}</div><div class="m">${esc(pname(d.owner))} · ${d.col === "review" ? "review" : "decide"} ${due ? (late ? (today() - day(due)) + " d late" : wd(due)) : ""}</div></div>
        ${nb && d.col === "todo" ? `<span class="tag" style="background:var(--reds);color:var(--redt)">blocks ${nb}</span>` : !d.reversible ? '<span class="tag" style="background:var(--ambers);color:var(--ambert)">irreversible</span>' : "<span></span>"}</div>`;
    }).join("") : `<div class="lr" style="cursor:default"><span></span><div class="m">No open decision</div><span></span></div>`) +
    `<div class="sub" style="margin-top:10px">Risks · probability × impact</div>` + (risks.length ? risks.map(r => {
      const p = pm[r.p] || 0, im = pm[r.i] || 0, sc = p + im, c = sc >= 4 ? "#B42318" : sc >= 3 ? "#B45309" : "#8E8A80";
      return `<div class="lr" data-kr="1" data-tip="${esc(r.text)}<br>Mitigation: ${esc(r.fix)}"><span class="pi">${[2, 1, 0].map(row => [0, 1, 2].map(cl => `<i style="${row === im && cl === p ? "background:" + c : ""}"></i>`).join("")).join("")}</span>
        <div style="min-width:0;padding-left:14px"><div class="t">${esc(r.text)}</div><div class="m">${esc(S.member(r.owner).name)} · ${esc(r.fix)}</div></div><span></span></div>`;
    }).join("") : `<div class="lr" style="cursor:default"><span></span><div class="m">No risk listed</div><span></span></div>`);
  el("way").querySelectorAll("[data-dec]").forEach(n => n.onclick = () => S.goto("decisions", n.dataset.dec));
  el("way").querySelectorAll("[data-kr]").forEach(n => n.onclick = () => S.openKr(k.id));

  // check-ins and the Saturday go / no-go
  const cs = k.checkins.slice().reverse(), stale = k.status === "stale", call = raw.call && raw.call.week === S.week ? raw.call : null;
  el("ci").innerHTML = (stale ? `<div class="cw" style="border-top:0"><span class="w" style="color:var(--ambert)">${S.wl(S.week)}</span><div><div class="val" style="color:var(--ambert)">missing</div><div class="bl">${k.isNew ? "No check-in yet" : "No check-in for " + k.age + " days"}</div></div><span></span></div>` : "") +
    cs.slice(0, stale ? 1 : 2).map(c => { const o = c[3] || {}; return `<div class="cw"><span class="w">${S.wl(o.week || S.weekOf(c[0]))}</span><div style="min-width:0"><div class="val">${esc(fmt(c[1], k.unit))}</div>${o.moved ? `<div class="mv" data-tip="What moved it: ${esc(o.moved)}">↑ ${esc(o.moved)}</div>` : ""}${o.blocks ? `<div class="bl" data-tip="What blocks: ${esc(o.blocks)}">■ ${esc(o.blocks)}</div>` : ""}</div><span class="conf" style="color:${c[2] >= 7 ? "var(--greent)" : c[2] >= 5 ? "var(--ambert)" : "var(--redt)"}">${c[2] ? c[2] + "/10" : ""}</span></div>`; }).join("") +
    `<div class="gonogo"><div class="l"><span>Saturday call · ${esc(k.ownerName)}</span><span>${call ? (call.v === "go" ? "go" : "no-go") + " · " + esc(pname(call.by)) : "will we hit " + esc(fmt(k.target, k.unit)) + "?"}</span></div><div class="b"><button class="go ${call && call.v === "go" ? "on" : ""}" data-v="go">Go</button><button class="no ${call && call.v === "no" ? "on" : ""}" data-v="no">No-go</button></div></div>`;
  el("ci").querySelectorAll(".gonogo button").forEach(b => b.onclick = () => {
    if (S.readOnly) { toastIn(TOAST, "Read-only access: not saved"); return; }
    const kk = JSON.parse(JSON.stringify(S.get("krs", k.id)));
    kk.call = { week: S.week, v: b.dataset.v, by: S.me || "", at: TODAY() };
    S.save("krs", kk);
    toastIn(TOAST, b.dataset.v === "go" ? "Go recorded for the Weekly Review" : "No-go recorded: a recovery plan is expected on Saturday");
  });
  el("weeks").onclick = () => openWeeks(k.id);
  if (!el("wkv").hidden) drawWeeks();
  bindTips(R, TIP);
}
// ---- every week's result (Romain 2026-10-31): typed here, or from the Weekly Review; a recorded value asks before it changes ----
let wkId = null;
function openWeeks(id) { wkId = id; el("wkv").hidden = false; drawWeeks(); const f = el("wkB").querySelector("input:not([disabled])"); if (f) f.focus(); }
function drawWeeks() {
  const k = S.get("krs", wkId); if (!k) { el("wkv").hidden = true; return; }
  const by = S.krWeeks(k), Q = Array.from({ length: 13 }, (_, i) => i + 1), cur = S.week;
  const pts = Q.filter(q => by[q] && by[q].value !== "" && by[q].value != null).map(q => [q, Number(by[q].value)]);
  const plan = (k.plan || []).map(p => [+p[0], +p[1]]), all = pts.map(p => p[1]).concat(plan.map(p => p[1]), [+k.target || 0, +k.baseline || 0]);
  const lo = Math.min(...all), hi = Math.max(...all), sp = hi - lo || 1, X = q => 10 + (q - 1) * (680 / 12), Y = v => 80 - ((v - lo) / sp) * 68;
  const line = a => a.map(p => X(p[0]).toFixed(1) + "," + Y(p[1]).toFixed(1)).join(" ");
  // expected on the Sunday that ends the week (the plan is read on day 7q - 1 of the quarter)
  const expAt = q => { try { const v = plan.length ? S.planAt(k, 7 * q - 1) : null; return v == null || isNaN(v) ? null : v; } catch (e) { return null; } };
  el("wkO").textContent = k.name;
  el("wkB").innerHTML = `<svg class="wks" viewBox="0 0 700 90" role="img" aria-label="Weekly results of ${esc(k.name)}"><line x1="${X(cur)}" y1="4" x2="${X(cur)}" y2="86" stroke="#D8D3C7"/>` +
    (plan.length > 1 ? `<polyline points="${line(plan)}" fill="none" stroke="#1B1B18" stroke-width="1.2" stroke-dasharray="4 4"/>` : "") +
    (pts.length > 1 ? `<polyline points="${line(pts)}" fill="none" stroke="#9A6614" stroke-width="2.5" stroke-linejoin="round"/>` : "") +
    pts.map(p => `<circle cx="${X(p[0])}" cy="${Y(p[1])}" r="4" fill="#9A6614"><title>${S.wl(p[0])}: ${esc(fmt(p[1], k.unit))}</title></circle>`).join("") + `</svg>` +
    `<table class="wkt"><thead><tr><th>Week</th><th>Result</th><th>Expected</th><th>Recorded</th><th>Confidence</th></tr></thead><tbody>` +
    Q.map(q => { const c = by[q], has = c && c.value !== "" && c.value != null, exp = expAt(q);
      return `<tr class="${q === cur ? "now" : ""}"><td class="w">${S.wl(q)}</td><td><input data-wk="${q}" type="number" step="any" inputmode="decimal" value="${has ? esc(c.value) : ""}" ${q > cur || S.readOnly ? "disabled" : ""} aria-label="${S.wl(q)} result"></td>` +
        `<td class="src">${exp != null ? esc(fmtLand(exp, k)) : "—"}</td><td class="src">${has ? (c.manual ? "By hand" : "Weekly Review") + (c.date ? " · " + esc(S.dayLabel(c.date)) : "") + (c.editedAt ? " · changed " + esc(S.dayLabel(c.editedAt)) : "") : q > cur ? "to come" : "—"}</td><td class="src">${has && c.conf ? c.conf + "/10" : ""}</td></tr>`; }).join("") +
    `</tbody></table><div class="wkn">Type the result of a week and leave the cell: a new value is saved at once; changing or removing a recorded value (by hand or from the Weekly Review) asks first. The latest week is the key result's current value. Target ${esc(fmt(k.target, k.unit))}; dashed: the plan.</div>`;
}
el("wkX").onclick = () => { el("wkv").hidden = true; };
el("wkv").onclick = e => { if (e.target === el("wkv")) el("wkv").hidden = true; };
el("wkv").addEventListener("keydown", e => { if (e.key === "Escape") el("wkv").hidden = true; });
el("wkB").addEventListener("change", e => {
  const q = +e.target.dataset.wk; if (!q) return;
  S.krWeekAsk(wkId, q, e.target.value, (ok, msg) => { if (msg) toastIn(TOAST, msg); if (!ok) drawWeeks(); });
});
// ---- add a task or a decision on the key result on screen ----
const isoD = d => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
const plus = n => isoD(new Date(D(TODAY()).getTime() + n * 864e5));
const pop = document.createElement("div"); pop.className = "addv"; pop.hidden = true;
pop.innerHTML = `<form class="addf" autocomplete="off"><div class="ah"><b id="aT"></b><span id="aK"></span></div><div id="aF"></div>
  <div class="ab"><button type="button" class="ghost" id="aX">Cancel</button><button type="submit" class="prim" id="aS">Add</button></div></form>`;
R.querySelector(".sv").appendChild(pop);
const close = () => { pop.hidden = true; };
pop.onclick = e => { if (e.target === pop) close(); };
pop.querySelector("#aX").onclick = close;
const opts = (arr, sel) => arr.map(([v, l]) => `<option value="${esc(v)}" ${v === sel ? "selected" : ""}>${esc(l)}</option>`).join("");
const people = () => S.members.map(m => [m.id, m.name + (m.role ? " · " + m.role : "")]);
let mode = "";
function openAdd(m) {
  if (S.readOnly) { toastIn(TOAST, "Read-only access: you cannot add here"); return; }
  const list = S.list("krs"); if (!list.length) return;
  const raw = list[cur || 0], k = krData(raw, cur || 0); mode = m;
  pop.querySelector("#aT").textContent = m === "task" ? "New task" : "New decision";
  pop.querySelector("#aK").textContent = "on KR " + ((cur || 0) + 1) + " · " + k.name;
  pop.querySelector("#aS").textContent = m === "task" ? "Add task" : "Add decision";
  if (m === "task") {
    const inits = (raw.inits || []).map((x, i) => [String(i), "I" + (i + 1) + " · " + x.name]).concat([["-1", "Not tied to an initiative"]]);
    pop.querySelector("#aF").innerHTML = `<label class="f">Task<input name="title" required maxlength="120" placeholder="What has to be done"></label>
      <label class="f">Initiative<select name="init">${opts(inits, inits.length > 1 ? "0" : "-1")}</select></label>
      <div class="f2"><label class="f">Owner<select name="owner">${opts(people(), raw.owner)}</select></label><label class="f">Due<input type="date" name="due" value="${plus(7)}"></label></div>
      <div class="f2"><label class="f">Type<select name="kind">${opts([["L", "Delivery"], ["E", "Exploration"]], "L")}</select></label><label class="f">Estimate (days)<input type="number" name="est" min="0.5" step="0.5" value="1"></label></div>`;
  } else {
    const open = S.list("tasks").filter(t => t.kr === raw.id && S.isOpen(t)).map(t => [t.id, t.title]);
    pop.querySelector("#aF").innerHTML = `<label class="f">Decision<input name="title" required maxlength="120" placeholder="What has to be decided"></label>
      <div class="f2"><label class="f">Owner<select name="owner">${opts(people(), S.me || raw.owner)}</select></label><label class="f">Decide by<input type="date" name="deadline" value="${plus(2)}"></label></div>
      <label class="f">Blocks a task<select name="task">${opts([["", "None"]].concat(open), "")}</select></label>
      <label class="ck"><input type="checkbox" name="irr"> Irreversible: hard to undo once taken</label>`;
  }
  pop.hidden = false; setTimeout(() => pop.querySelector("[name=title]").focus(), 30);
}
pop.querySelector("form").onsubmit = e => {
  e.preventDefault();
  const f = new FormData(e.target), list = S.list("krs"), raw = list[cur || 0], title = String(f.get("title") || "").trim();
  if (!raw || !title) return;
  if (mode === "task") {
    S.save("tasks", { title, kr: raw.id, init: Number(f.get("init")), owner: f.get("owner"), due: f.get("due") || plus(7), est: Number(f.get("est")) || 1,
      status: "todo", start: null, end: null, kind: f.get("kind") || "L", unc: "C", note: "", since: "" });
    toastIn(TOAST, "Task added to " + raw.name);
  } else {
    const t = f.get("task");
    S.createDecision({ title, question: title, owner: f.get("owner"), deadline: f.get("deadline") || plus(2), reversible: !f.get("irr"), source: "kr:" + raw.id,
      links: { kr: [raw.id], task: t ? [t] : [], del: [] } });
    toastIn(TOAST, "Decision added. Frame the options in Decisions.");
  }
  close();
};
el("addTask").onclick = () => openAdd("task");
el("addDec").onclick = () => openAdd("decision");
el("prev").onclick = () => { const n = S.list("krs").length; if (n) { cur = ((cur || 0) - 1 + n) % n; render(); } };
el("next").onclick = () => { const n = S.list("krs").length; if (n) { cur = ((cur || 0) + 1) % n; render(); } };
render();
if (document.fonts) document.fonts.ready.then(render);
let rw = ""; new ResizeObserver(() => { const w = R.host.clientWidth + "x" + R.host.clientHeight; if (w !== rw) { rw = w; render(); } }).observe(R.host);
return { render };
