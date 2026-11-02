/* Cockpit › Marketing: is the acquisition engine healthy, and which key results does it feed? */
const R = ROOT, el = id => R.getElementById(id);
// Sample figures until analytics are connected (phase 4). Live values come from the key results they feed.
const FUNNEL = { reached: 24000, visits: 3200, qualified: 142, qualifiedPrev: 168, qualifiedTarget: 180, convWas: 26, convTarget: 25 };
const CHANNELS = [{ n: "Paid ads", leads: 78, cpl: 3.9 }, { n: "Partnerships", leads: 31, cpl: 2.1 }, { n: "Organic", leads: 24, cpl: null }, { n: "Email", leads: 9, cpl: null }];
const WEEKS = [{ w: 1, q: 155 }, { w: 2, q: 168 }, { w: 3, q: 142 }];
const LINK = { signups: "kr3", cpl: "kr4" };

function krChip(id) {
  const raw = S.get("krs", id); if (!raw) return "";
  const i = S.list("krs").findIndex(k => k.id === id), k = krData(raw, i);
  return `<button class="krc" data-room="${id}" style="--c:${COL[k.status]}" data-tip="Feeds ${esc(k.name)} · ${esc(k.label)}. Click to open the key result."><i></i>KR ${i + 1} · ${esc(k.label)}</button>`;
}
function wire(root) {
  root.querySelectorAll("[data-room]").forEach(b => b.onclick = e => { e.stopPropagation(); window.SKL_KRROOM_SEL = b.dataset.room; S.goto("cockpit", "kr"); });
}

function flow() {
  const box = el("flow"), W = box.clientWidth, H = box.clientHeight; if (W < 200 || H < 120) return;
  const kr = S.get("krs", LINK.signups), signups = kr ? Number(kr.current) : 580;
  const conv = kr && kr.leadValue ? parseFloat(kr.leadValue) : 18;
  const st = [{ l: "Audience reached", v: FUNNEL.reached }, { l: "Page visits", v: FUNNEL.visits }, { l: "Sign-ups", v: signups, kr: LINK.signups }, { l: "Qualified leads", v: FUNNEL.qualified }];
  const rates = [{ v: FUNNEL.visits / FUNNEL.reached * 100, l: "visit rate" }, { v: conv, l: "page conversion", was: FUNNEL.convWas, target: FUNNEL.convTarget, lead: true }, { v: FUNNEL.qualified / signups * 100, l: "qualified" }];
  const top = 28, bot = 74, hMax = H - top - bot, pad = 18, colW = Math.min(96, (W - 40) / 7), gap = (W - 2 * pad - colW * 4) / 3, mid = top + hMax / 2;
  const hOf = v => Math.max(12, hMax * Math.sqrt(v / st[0].v));
  let s = `<svg width="${W}" height="${H}" role="img" aria-label="Acquisition funnel"><defs><linearGradient id="rib" x1="0" x2="1"><stop offset="0" stop-color="#ECE8DF"/><stop offset="1" stop-color="#F6F4EF"/></linearGradient></defs>`;
  st.forEach((x, i) => {
    if (i === 3) return;
    const h1 = hOf(x.v), h2 = hOf(st[i + 1].v), x1 = pad + i * (colW + gap) + colW, x2 = pad + (i + 1) * (colW + gap);
    s += `<path d="M${x1},${mid - h1 / 2} C${x1 + gap / 2},${mid - h1 / 2} ${x2 - gap / 2},${mid - h2 / 2} ${x2},${mid - h2 / 2} L${x2},${mid + h2 / 2} C${x2 - gap / 2},${mid + h2 / 2} ${x1 + gap / 2},${mid + h1 / 2} ${x1},${mid + h1 / 2}Z" fill="url(#rib)"/>`;
    const r = rates[i], bad = r.target && r.v < r.target, c = bad ? "#B42318" : "#1B1B18", cx = (x1 + x2) / 2;
    s += `<g data-tip="${r.l}: ${Math.round(r.v)}%${r.was ? " · was " + r.was + "%" : ""}${r.target ? " · target " + r.target + "%" : ""}${r.lead ? " · leading indicator of the sign-ups KR" : ""}"><rect x="${cx - 46}" y="${mid - 21}" width="92" height="42" rx="9" fill="#fff" stroke="${bad ? c : "#E3DFD5"}" stroke-width="${bad ? 1.6 : 1}"/>
      <text x="${cx}" y="${mid - 1}" text-anchor="middle" font-family="IBM Plex Mono" font-size="15" font-weight="600" fill="${c}">${Math.round(r.v)}%${r.was ? ` <tspan font-size="10" fill="#8E8A80">was ${r.was}%</tspan>` : ""}</text>
      <text x="${cx}" y="${mid + 13}" text-anchor="middle" font-size="10" fill="#5E5B53">${r.l}</text></g>`;
  });
  st.forEach((x, i) => {
    const h = hOf(x.v), x0 = pad + i * (colW + gap);
    s += `<rect x="${x0}" y="${mid - h / 2}" width="${colW}" height="${h}" rx="6" fill="${x.kr ? "#1B1B18" : "#3D3A33"}" opacity="${x.kr ? 1 : .88 - i * .12}"/>`;
    s += `<text x="${x0 + colW / 2}" y="${top - 12}" text-anchor="middle" font-size="11" font-weight="600" letter-spacing=".06em" fill="#5E5B53">${x.l.toUpperCase()}</text>`;
    s += `<text x="${x0 + colW / 2}" y="${H - bot + 28}" text-anchor="middle" font-family="Fraunces" font-size="22" fill="#1B1B18">${x.v.toLocaleString("en-GB")}</text>`;
  });
  box.innerHTML = s + `</svg>`;
  const kx = pad + 2 * (colW + gap) + colW / 2;
  el("flowkr").style.left = (kx - 70) + "px";
  el("flowkr").innerHTML = krChip(LINK.signups);
}

function channels() {
  const tot = CHANNELS.reduce((a, c) => a + c.leads, 0), paid = CHANNELS[0].leads / tot * 100, kr = S.get("krs", LINK.cpl), blended = kr ? Number(kr.current) : 3.6;
  const C = ["#1B1B18", "#9A6614", "#D9B46A", "#C9C4B7"];
  el("chan").innerHTML = `<div class="sh" data-tip="Share of leads by channel. Alert above 50% on one channel.">${CHANNELS.map((c, i) => `<i style="flex:${c.leads};background:${C[i]}"></i>`).join("")}<u style="left:50%"></u></div>
    <div class="shl"><span style="color:${paid > 50 ? "var(--ambert)" : "var(--mut)"}">Paid ads ${Math.round(paid)}% of leads · limit 50%</span></div>
    ${CHANNELS.map((c, i) => `<div class="chr" data-tip="${c.n}: ${c.leads} leads${c.cpl ? " · €" + c.cpl.toFixed(2) + " per lead" : ""}"><span class="sw" style="background:${C[i]}"></span><span class="n">${c.n}</span><span class="num">${c.leads}</span>
      <span class="cb">${c.cpl ? `<i style="width:${Math.min(100, c.cpl / 5 * 100)}%;background:${c.cpl > 4 ? "var(--red)" : "var(--green)"}"></i><u style="left:80%"></u>` : ""}</span><span class="num">${c.cpl ? "€" + c.cpl.toFixed(2) : "—"}</span></div>`).join("")}
    <div class="blend"><span>Blended cost per lead</span><b class="num" style="color:${blended <= 4 ? "var(--greent)" : "var(--redt)"}">€${blended.toFixed(2)}</b>${krChip(LINK.cpl)}</div>`;
}

function weekly() {
  const box = el("wk"), W = box.clientWidth, H = box.clientHeight; if (W < 120 || H < 80) return;
  const L = 34, B = 24, T = 10, iw = W - L - 8, ih = H - T - B, mx = FUNNEL.qualifiedTarget * 1.15, bw = Math.min(46, iw / 13 * .7);
  const X = w => L + (w - .5) * iw / 13, Y = v => T + ih - v / mx * ih;
  let s = `<svg width="${W}" height="${H}">`;
  [0, 90, 180].forEach(v => s += `<line x1="${L}" x2="${W - 8}" y1="${Y(v)}" y2="${Y(v)}" stroke="#EFEBE3"/><text x="${L - 6}" y="${Y(v) + 4}" text-anchor="end" font-family="IBM Plex Mono" font-size="10" fill="#8E8A80">${v}</text>`);
  s += `<line x1="${L}" x2="${W - 8}" y1="${Y(FUNNEL.qualifiedTarget)}" y2="${Y(FUNNEL.qualifiedTarget)}" stroke="#1B1B18" stroke-dasharray="4 4"/><text x="${W - 10}" y="${Y(FUNNEL.qualifiedTarget) - 5}" text-anchor="end" font-size="10.5" font-weight="600" fill="#1B1B18">target ${FUNNEL.qualifiedTarget}</text>`;
  for (let w = 1; w <= 13; w++) s += `<text x="${X(w)}" y="${H - 6}" text-anchor="middle" font-size="10" fill="${w === S.week ? "#1B1B18" : "#8E8A80"}" font-weight="${w === S.week ? 700 : 400}">${S.wl(w)}</text>`;
  WEEKS.forEach(p => { const c = p.q >= FUNNEL.qualifiedTarget ? "#2E7D4F" : p.q >= FUNNEL.qualifiedTarget * .85 ? "#B45309" : "#B42318";
    s += `<g data-tip="${S.wl(p.w)}: ${p.q} qualified leads"><rect x="${X(p.w) - bw / 2}" y="${Y(p.q)}" width="${bw}" height="${T + ih - Y(p.q)}" rx="4" fill="${c}"/><text x="${X(p.w)}" y="${Y(p.q) - 5}" text-anchor="middle" font-family="IBM Plex Mono" font-size="11" font-weight="600" fill="${c}">${p.q}</text></g>`; });
  box.innerHTML = s + `</svg>`;
}

function teamKrs() {
  const list = S.list("krs"), mine = list.map((k, i) => ({ k, i })).filter(x => x.k.owner === "marketing");
  el("krs").innerHTML = mine.length ? mine.map(({ k, i }) => { const d = krData(k, i), P = paces(d);
    return `<div class="kr2" data-room="${k.id}" data-tip="${esc(d.why || d.label)}"><span class="kn">KR ${i + 1}</span><div style="min-width:0"><div class="t">${esc(d.name)}</div><div class="m">${d.status === "stale" ? "no recent check-in" : "pace " + pf(P.p, d) + "/wk · needed " + (P.lb && d.current <= d.target ? "at target" : pf(P.need, d))}</div></div>
      <span class="st s-${d.status}"><i></i>${esc(d.label)}</span></div>`; }).join("") : `<div class="empty">No key result owned by Marketing.</div>`;
}

function blockers() {
  const decs = S.list("decisions").filter(d => d.owner === "marketing" && d.col === "todo");
  const al = S.inbox().filter(a => a.status === "open" && a.pid === "marketing" && a.area === "Tasks");
  const rows = decs.map(d => ({ c: d.deadline < TODAY() ? "#B42318" : "#1B1B18", t: d.title, m: "Decision · " + (d.deadline < TODAY() ? (today() - day(d.deadline)) + " d late" : "due " + wd(d.deadline)), go: () => S.goto("decisions", d.id) }))
    .concat(al.map(a => ({ c: a.sev === "High" || a.sev === "Critical" ? "#B45309" : "#8E8A80", t: a.subject, m: a.ruleName + (a.escalated ? " · escalated" : "") + " · " + age(a.ageH), go: () => S.goto("monjour", a.pid) })));
  el("blk").innerHTML = rows.length ? rows.slice(0, 6).map((r, i) => `<div class="br2" data-i="${i}"><span class="dot" style="background:${r.c}"></span><div style="min-width:0"><div class="t">${esc(r.t)}</div><div class="m">${esc(r.m)}</div></div></div>`).join("") : `<div class="empty">Nothing blocking Marketing.</div>`;
  el("blk").querySelectorAll(".br2").forEach(n => n.onclick = () => rows[+n.dataset.i].go());
}

function verdict() {
  const kr = S.get("krs", LINK.signups), conv = kr && kr.leadValue ? parseFloat(kr.leadValue) : 18, cpl = S.get("krs", LINK.cpl), blended = cpl ? Number(cpl.current) : 3.6;
  const tot = CHANNELS.reduce((a, c) => a + c.leads, 0), paid = CHANNELS[0].leads / tot * 100;
  const checks = [["Page conversion", conv >= FUNNEL.convTarget], ["Qualified leads / week", FUNNEL.qualified >= FUNNEL.qualifiedTarget], ["Cost per lead", blended <= 4], ["Channel dependency", paid <= 50]];
  const bad = checks.filter(c => !c[1]);
  el("verdict").innerHTML = `<span class="vb ${bad.length ? "fail" : "pass"}">${checks.length - bad.length}/${checks.length}</span><span class="vt" data-tip="${bad.length ? "Off target: " + esc(bad.map(c => c[0].toLowerCase()).join(", ")) : "All on target"}"><b>Engine health</b><br>${bad.length ? bad.length + " of " + checks.length + " off target" : "all on target"}</span><span class="smp" data-tip="Funnel, channel and weekly figures are sample data until analytics are connected. Sign-ups, page conversion and cost per lead are live from the key results.">sample</span>`;
}

function render() {
  if (!R.host.isConnected) return;
  verdict(); flow(); channels(); weekly(); teamKrs(); blockers();
  wire(R); bindTips(R, TIP);
}
render();
if (document.fonts) document.fonts.ready.then(render);
let rw = ""; new ResizeObserver(() => { const w = R.host.clientWidth + "x" + R.host.clientHeight; if (w !== rw) { rw = w; render(); } }).observe(R.host);
return { render };
