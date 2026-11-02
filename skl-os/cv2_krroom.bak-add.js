/* Cockpit › Key results: one screen per key result, across teams. Mounted in a shadow root. */
const R = ROOT, el = id => R.getElementById(id);
const POLE = { marketing: "Marketing", contenu: "Content", sales: "Sales", romain: "Leadership", amin: "Leadership" };
const ST = { done: ["#2E7D4F", "Done"], progress: ["#D9B46A", "In progress"], todo: ["#C9C4B7", "To do"], blocked: ["#B42318", "Blocked"], split: ["#B45309", "To split"] };
let cur = null;

function render() {
  if (!R.host.isConnected) return;
  const list = S.list("krs");
  if (window.SKL_KRROOM_SEL) { const i = list.findIndex(k => k.id === window.SKL_KRROOM_SEL); if (i >= 0) cur = i; window.SKL_KRROOM_SEL = null; }
  if (!list.length) { el("id").innerHTML = `<div class="who">No key result yet. Create one in Roadmap.</div>`; ["chart", "gauges", "inits", "way", "ci", "chips"].forEach(i => el(i).innerHTML = ""); return; }
  const krs = list.map(krData);
  if (cur === null || cur >= krs.length) { const rk = k => k.status === "red" ? 0 : k.status === "amber" ? 1 + (k.landing == null ? 1 : k.landing) : k.status === "stale" ? 5 : 9; cur = krs.reduce((b, k, i) => rk(k) < rk(krs[b]) ? i : b, 0); }
  const k = krs[cur], raw = k.raw, col = COL[k.status], P = paces(k);
  el("chips").innerHTML = krs.map((x, i) => `<button class="chip ${i === cur ? "on" : ""}" style="background:${COL[x.status]}" data-i="${i}" data-tip="${esc(x.name)} · ${x.label}">${i + 1}</button>`).join("");
  el("chips").querySelectorAll("button").forEach(b => b.onclick = () => { cur = +b.dataset.i; render(); });

  // who is involved: teams owning tasks on this key result
  const tasks = S.list("tasks").filter(t => t.kr === k.id);
  const poles = {}; tasks.forEach(t => { const p = POLE[t.owner] || "Other"; poles[p] = (poles[p] || 0) + 1; });
  const ratio = k.status === "stale" ? "?" : (P.lb && k.current <= k.target) ? "✓" : k.ratio.toFixed(2);
  el("id").innerHTML = `<span class="o">${esc(k.obj)} · ${esc(shortObj(k.obj))}</span><h1>${esc(k.name)}</h1><span class="who">Owner: ${esc(k.ownerName)}</span>
    <span style="display:flex;gap:6px"><span class="st s-${k.status}"><i></i>${k.status === "stale" ? (k.isNew ? "No check-in yet" : "No check-in · " + k.age + " d") : k.label}</span></span>
    <div class="pol" data-tip="Teams with tasks on this key result">${Object.entries(poles).map(([p, n]) => `<span>${p} · ${n}</span>`).join("") || "<span>No task yet</span>"}</div>
    <div class="big"><b style="color:${col}">${ratio}</b><span>actual ÷<br>expected</span></div>
    <div style="font-family:var(--mono);font-size:13px;color:var(--mut)">${esc(fmt(k.current, k.unit))} of ${esc(fmt(k.target, k.unit))} · expected ${esc(fmt(k.expected, k.unit))}</div>
    <button class="open" data-tip="Edit the definition, initiatives, milestones and risks">Open in Roadmap ↗</button>`;
  el("id").querySelector(".open").onclick = () => S.openKr(k.id);
  krChart(el("chart"), k, { tight: true });

  // the three gauges
  const mx = Math.max(Math.abs(P.p || 0), Math.abs(P.need), 1e-9) * 1.15, L = k.lead;
  el("gauges").innerHTML = `
   <div class="g" data-tip="Change per week over the last two check-ins, against what the target needs from today"><span class="k"><span>Pace / week</span><span>needed ${P.lb && k.current <= k.target ? "at target" : pf(P.need, k)}</span></span>
     <span class="v" style="color:${P.ok === null ? "var(--mut)" : P.ok ? "var(--greent)" : "var(--redt)"}">${pf(P.p, k)}</span>
     <div class="bar"><i style="width:${P.p === null ? 0 : Math.min(100, Math.abs(P.p) / mx * 100)}%;background:${P.ok ? "var(--green)" : "var(--red)"}"></i><u style="left:${Math.min(100, Math.abs(P.need) / mx * 100)}%"></u></div></div>
   <div class="g" data-tip="Leading indicator: it moves before the key result. Set it in Roadmap › Definition."><span class="k"><span>Leading indicator</span><span>${esc(L.note)}</span></span>
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
    : `<div class="empty">No initiative yet. Add 3 to 5 in Roadmap.</div>`) +
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

  // check-ins and the Friday go / no-go
  const cs = k.checkins.slice().reverse(), stale = k.status === "stale", call = raw.call && raw.call.week === S.week ? raw.call : null;
  el("ci").innerHTML = (stale ? `<div class="cw" style="border-top:0"><span class="w" style="color:var(--ambert)">W${S.week}</span><div><div class="val" style="color:var(--ambert)">missing</div><div class="bl">${k.isNew ? "No check-in yet" : "No check-in for " + k.age + " days"}</div></div><span></span></div>` : "") +
    cs.slice(0, stale ? 1 : 2).map(c => { const o = c[3] || {}; return `<div class="cw"><span class="w">W${o.week || S.weekOf(c[0])}</span><div style="min-width:0"><div class="val">${esc(fmt(c[1], k.unit))}</div>${o.moved ? `<div class="mv" data-tip="What moved it: ${esc(o.moved)}">↑ ${esc(o.moved)}</div>` : ""}${o.blocks ? `<div class="bl" data-tip="What blocks: ${esc(o.blocks)}">■ ${esc(o.blocks)}</div>` : ""}</div><span class="conf" style="color:${c[2] >= 7 ? "var(--greent)" : c[2] >= 5 ? "var(--ambert)" : "var(--redt)"}">${c[2] ? c[2] + "/10" : ""}</span></div>`; }).join("") +
    `<div class="gonogo"><div class="l"><span>Friday call · ${esc(k.ownerName)}</span><span>${call ? (call.v === "go" ? "go" : "no-go") + " · " + esc(pname(call.by)) : "will we hit " + esc(fmt(k.target, k.unit)) + "?"}</span></div><div class="b"><button class="go ${call && call.v === "go" ? "on" : ""}" data-v="go">Go</button><button class="no ${call && call.v === "no" ? "on" : ""}" data-v="no">No-go</button></div></div>`;
  el("ci").querySelectorAll(".gonogo button").forEach(b => b.onclick = () => {
    if (S.readOnly) { toastIn(TOAST, "Read-only access: not saved"); return; }
    const kk = JSON.parse(JSON.stringify(S.get("krs", k.id)));
    kk.call = { week: S.week, v: b.dataset.v, by: S.me || "", at: TODAY() };
    S.save("krs", kk);
    toastIn(TOAST, b.dataset.v === "go" ? "Go recorded for the Weekly Review" : "No-go recorded: a recovery plan is expected on Friday");
  });
  bindTips(R, TIP);
}
el("prev").onclick = () => { const n = S.list("krs").length; if (n) { cur = ((cur || 0) - 1 + n) % n; render(); } };
el("next").onclick = () => { const n = S.list("krs").length; if (n) { cur = ((cur || 0) + 1) % n; render(); } };
render();
if (document.fonts) document.fonts.ready.then(render);
let rw = ""; new ResizeObserver(() => { const w = R.host.clientWidth + "x" + R.host.clientHeight; if (w !== rw) { rw = w; render(); } }).observe(R.host);
return { render };
