/* Cockpit › Finance: can the company fund the plan, and does revenue follow? */
const R = ROOT, el = id => R.getElementById(id);
// Sample figures until accounting is connected (phase 4). Revenue comes live from the key result it feeds.
const CASH = [{ m: "Jul", cash: 112, runway: 9.4 }, { m: "Aug", cash: 104, runway: 8.8 }, { m: "Sep", cash: 92, runway: 8.1 }, { m: "Oct", cash: 86, runway: 7.2 }];
const RUNWAY_MIN = 6;
const BUDGET = [{ d: "Content", a: 9.8, b: 8 }, { d: "Marketing", a: 9.1, b: 9 }, { d: "Sales", a: 3.4, b: 3.5 }, { d: "Overhead", a: 2.0, b: 1.5 }];
const UNIT = { cac: 290, aov: 1490, target: 3 };
const RECV = [{ l: "0–30 days", n: 2, amt: 3.0 }, { l: "Over 30 days", n: 1, amt: 1.5 }];
const DEADLINES = [{ d: "2026-10-31", t: "Monthly close and runway update", pid: "amin" }, { d: "2026-11-05", t: "October freelancer payments", pid: "amin" }];
const LINK = { revenue: "kr5" };

function krChip(id) {
  const raw = S.get("krs", id); if (!raw) return "";
  const i = S.list("krs").findIndex(k => k.id === id), k = krData(raw, i);
  return `<button class="krc" data-room="${id}" style="--c:${COL[k.status]}" data-tip="Feeds ${esc(k.name)} · ${esc(k.label)}. Click to open the key result."><i></i>KR ${i + 1} · ${esc(k.label)}</button>`;
}
function wire(root) { root.querySelectorAll("[data-room]").forEach(b => b.onclick = e => { e.stopPropagation(); window.SKL_KRROOM_SEL = b.dataset.room; S.goto("cockpit", "kr"); }); }

function cash() {
  const box = el("cash"), W = box.clientWidth, H = box.clientHeight; if (W < 200 || H < 120) return;
  const L = 44, Rr = 44, T = 14, B = 26, iw = W - L - Rr, ih = H - T - B, mx = 130, rmx = 12, bw = Math.min(64, iw / CASH.length * .45);
  const X = i => L + (i + .5) * iw / CASH.length, Y = v => T + ih - v / mx * ih, YR = v => T + ih - v / rmx * ih;
  let s = `<svg width="${W}" height="${H}" role="img" aria-label="Cash and runway by month">`;
  [0, 50, 100].forEach(v => s += `<line x1="${L}" x2="${L + iw}" y1="${Y(v)}" y2="${Y(v)}" stroke="#EFEBE3"/><text x="${L - 6}" y="${Y(v) + 4}" text-anchor="end" font-family="IBM Plex Mono" font-size="10" fill="#8E8A80">€${v}k</text>`);
  [0, 6, 12].forEach(v => s += `<text x="${L + iw + 6}" y="${YR(v) + 4}" font-family="IBM Plex Mono" font-size="10" fill="#9A6614">${v} mo</text>`);
  CASH.forEach((c, i) => { const last = i === CASH.length - 1;
    s += `<g data-tip="${c.m}: €${c.cash}k cash · ${c.runway} months of runway"><rect x="${X(i) - bw / 2}" y="${Y(c.cash)}" width="${bw}" height="${T + ih - Y(c.cash)}" rx="5" fill="${last ? "#1B1B18" : "#C9C4B7"}"/><text x="${X(i)}" y="${Y(c.cash) - 6}" text-anchor="middle" font-family="IBM Plex Mono" font-size="11" font-weight="600" fill="#1B1B18">€${c.cash}k</text></g>`;
    s += `<text x="${X(i)}" y="${H - 6}" text-anchor="middle" font-size="11" fill="${last ? "#1B1B18" : "#8E8A80"}" font-weight="${last ? 700 : 400}">${c.m}</text>`; });
  s += `<line x1="${L}" x2="${L + iw}" y1="${YR(RUNWAY_MIN)}" y2="${YR(RUNWAY_MIN)}" stroke="#B42318" stroke-dasharray="4 4"/>`;
  s += `<polyline points="${CASH.map((c, i) => X(i) + "," + YR(c.runway)).join(" ")}" fill="none" stroke="#D9B46A" stroke-width="3"/>`;
  CASH.forEach((c, i) => s += `<circle cx="${X(i)}" cy="${YR(c.runway)}" r="4.5" fill="#fff" stroke="#9A6614" stroke-width="2"/>`);
  const l = CASH[CASH.length - 1];
  s += `<rect x="${X(CASH.length - 1) + 8}" y="${YR(l.runway) + 4}" width="46" height="16" rx="3" fill="#fff"/><text x="${X(CASH.length - 1) + 12}" y="${YR(l.runway) + 16}" font-family="IBM Plex Mono" font-size="12" font-weight="600" fill="#9A6614">${l.runway} mo</text>`;
  box.innerHTML = s + `</svg>`;
  const p = CASH[CASH.length - 2];
  el("cashq").innerHTML = `<b class="num">€${l.cash}k</b> cash · <b class="num" style="color:${l.runway < RUNWAY_MIN ? "var(--redt)" : l.runway < RUNWAY_MIN + 1.5 ? "var(--ambert)" : "var(--greent)"}">${l.runway} mo</b> runway <span style="color:var(--redt)">(${(l.runway - p.runway).toFixed(1)} in a month)</span> · <span style="color:var(--redt)">- - alert at ${RUNWAY_MIN} mo</span>`;
}

function budget() {
  const tot = BUDGET.reduce((a, b) => a + b.a, 0), totB = BUDGET.reduce((a, b) => a + b.b, 0), mx = Math.max(...BUDGET.map(b => Math.max(b.a, b.b))) * 1.15;
  el("budq").innerHTML = `<b class="num" style="color:${tot > totB ? "var(--redt)" : "var(--greent)"}">€${tot.toFixed(1)}k</b> of €${totB.toFixed(1)}k · ${tot > totB ? "+" : ""}${Math.round((tot / totB - 1) * 100)}%`;
  el("bud").innerHTML = BUDGET.map(b => { const o = b.a / b.b - 1, c = o > .1 ? "var(--red)" : o > 0 ? "var(--amber)" : "var(--green)";
    return `<div class="bur" data-tip="${b.d}: €${b.a}k spent for a €${b.b}k budget (${o >= 0 ? "+" : ""}${Math.round(o * 100)}%)"><span class="n">${b.d}</span><span class="bb"><i style="width:${b.a / mx * 100}%;background:${c}"></i><u style="left:${b.b / mx * 100}%"></u></span><span class="num" style="color:${c}">${o >= 0 ? "+" : ""}${Math.round(o * 100)}%</span></div>`; }).join("") +
    `<div class="legend"><span><em style="background:var(--ink)"></em>actual</span><span><em style="background:var(--ink);width:2px"></em>budget</span></div>`;
}

function unit() {
  const ratio = UNIT.aov / UNIT.cac, kr = S.get("krs", LINK.revenue), i = S.list("krs").findIndex(k => k.id === LINK.revenue), d = kr ? krData(kr, i) : null;
  el("unit").innerHTML = `<div class="ue3"><div><span>Acquisition cost</span><b class="num">€${UNIT.cac}</b></div><div><span>Order value</span><b class="num">€${UNIT.aov.toLocaleString("en-GB")}</b></div></div>
    <div class="g2" data-tip="Order value ÷ acquisition cost. Healthy at ${UNIT.target}× or more."><div class="k"><span>Order value ÷ acquisition cost</span><b class="num" style="color:${ratio >= UNIT.target ? "var(--greent)" : "var(--redt)"}">${ratio.toFixed(1)}×</b></div><div class="bar"><i style="width:${Math.min(100, ratio / 8 * 100)}%;background:${ratio >= UNIT.target ? "var(--green)" : "var(--red)"}"></i><u style="left:${UNIT.target / 8 * 100}%"></u></div></div>
    ${d ? `<div class="rev" data-room="${d.id}"><div><span>Revenue collected</span><b class="num">${esc(fmt(d.current, d.unit))} <small>of ${esc(fmt(d.target, d.unit))}</small></b></div>${krChip(d.id)}</div>` : ""}`;
}

function receivables() {
  const tot = RECV.reduce((a, r) => a + r.amt, 0), n = RECV.reduce((a, r) => a + r.n, 0), mx = Math.max(...RECV.map(r => r.amt));
  el("recq").innerHTML = `<b class="num" style="color:var(--ambert)">€${tot.toFixed(1)}k</b> · ${n} invoices`;
  el("rec").innerHTML = RECV.map((r, i) => `<div class="bur" data-tip="${r.n} invoice${r.n > 1 ? "s" : ""} · €${r.amt.toFixed(1)}k"><span class="n">${r.l}</span><span class="bb"><i style="width:${r.amt / mx * 100}%;background:${i ? "var(--red)" : "var(--amber)"}"></i></span><span class="num">€${r.amt.toFixed(1)}k</span></div>`).join("");
}

function actions() {
  const T = TODAY();
  const tasks = S.list("tasks").filter(t => S.isOpen(t) && !t.kr && /finance|legal|budget|runway/i.test((t.note || "") + " " + t.title));
  const rows = tasks.map(t => ({ d: t.due, t: t.title, pid: t.owner, late: t.due < T, go: () => S.goto("monjour", t.owner) }))
    .concat(DEADLINES.map(x => ({ d: x.d, t: x.t, pid: x.pid, late: false, go: null }))).sort((a, b) => a.d < b.d ? -1 : 1);
  el("act").innerHTML = rows.slice(0, 6).map((r, i) => `<div class="ar2" data-i="${i}"><span class="dd ${r.late ? "late" : ""}">${D(r.d).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span><div style="min-width:0"><div class="t">${esc(r.t)}</div><div class="m">${esc(pname(r.pid))}${r.go ? " · task" : " · deadline"}</div></div></div>`).join("");
  el("act").querySelectorAll(".ar2").forEach(n => { const r = rows[+n.dataset.i]; if (r.go) { n.style.cursor = "pointer"; n.onclick = r.go; } });
}

function verdict() {
  const l = CASH[CASH.length - 1], tot = BUDGET.reduce((a, b) => a + b.a, 0), totB = BUDGET.reduce((a, b) => a + b.b, 0), rec = RECV.find(r => r.l.startsWith("Over"));
  const checks = [["Cash", true], ["Runway", l.runway >= RUNWAY_MIN + 1.5], ["Spend vs budget", tot <= totB * 1.05], ["Receivables", !(rec && rec.n)]];
  const bad = checks.filter(c => !c[1]);
  el("verdict").innerHTML = `<span class="vb ${bad.length ? "fail" : "pass"}">${checks.length - bad.length}/${checks.length}</span><span class="vt" data-tip="${bad.length ? "To watch: " + esc(bad.map(c => c[0].toLowerCase()).join(", ")) : "All clear"}"><b>Financial health</b><br>${bad.length ? bad.length + " of " + checks.length + " to watch" : "all clear"}</span><span class="smp" data-tip="Cash, budget, unit economics and receivables are sample data until accounting is connected. Revenue collected is live from its key result.">sample</span>`;
}

function render() {
  if (!R.host.isConnected) return;
  verdict(); cash(); budget(); unit(); receivables(); actions();
  wire(R); bindTips(R, TIP);
}
render();
if (document.fonts) document.fonts.ready.then(render);
let rw = ""; new ResizeObserver(() => { const w = R.host.clientWidth + "x" + R.host.clientHeight; if (w !== rw) { rw = w; render(); } }).observe(R.host);
return { render };
