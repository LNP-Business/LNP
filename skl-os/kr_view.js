/* SKL OS · one way to show a key result everywhere (Cockpit overview, department views, Sales dashboard).
   Everything is computed from the shared key results: check-ins, expected value, milestones. */
(function () {
  var S = window.SKL;
  var OBJ = { O1: "O1 · Build world-class operations that iterate at PMF speed, without compromising student results", O2: "O2 · Build a world-class marketing engine that makes guru #1 the obvious choice in its market", O3: "O3 · Build a world-class sales system, ready to be replicated for every guru" };
  var DEPT = { contenu: "Content", marketing: "Marketing", sales: "Sales", romain: "Leadership", amin: "Leadership" };
  var COL = { green: "#2E7D4F", amber: "#B45309", red: "#B42318", stale: "#8E8A80", "new": "#8E8A80" };
  var TXT = { green: "#1E5E38", amber: "#8A3F06", red: "#9B1C12", stale: "#5E5B53", "new": "#7A4B00" };
  var PILL = { green: "background: #E6F2EA; color: #1E5E38;", amber: "background: #FDF1E3; color: #8A3F06;", red: "background: #FDECEA; color: #9B1C12;", stale: "background: #EFECE4; color: #3D3A33;", "new": "background: #F4ECDD; color: #7A4B00;" };
  var QDAYS = 91, X0 = 8, X1 = 252, YB = 54, YT = 6;

  function qStart() { return S.parse(S.weekMonday(1)); }
  function dayOfQ(isoDate) { return Math.round((S.parse(isoDate) - qStart()) / 86400000); }
  function xAt(day) { return Math.round(X0 + (X1 - X0) * Math.max(0, Math.min(QDAYS, day)) / QDAYS); }
  function pace(v, u) {
    if (u === "pct") return (Math.round(v * 10) / 10) + " pts";
    if (u === "eur") return S.fmtVal(Math.round(v), u);
    if (u === "eur2") return "€" + Math.abs(v).toFixed(2);
    if (u === "usd") return S.fmtVal(Math.round(Math.abs(v)), u);
    return String(Math.abs(v) >= 10 ? Math.round(v) : Math.round(v * 10) / 10);
  }

  function view(k) {
    var st = S.krStatus(k), key = st.key;
    var b = Number(k.baseline) || 0, t = Number(k.target), cur = Number(k.current);
    // the bottom of the chart is 0 (for a "stay below" KR, the baseline): progress reads against the whole way
    var lo = t >= b ? Math.min(0, b) : b, span = (t - lo) || 1;
    var y = function (v) { return Math.round(Math.max(2, Math.min(58, YB - (YB - YT) * (Number(v) - lo) / span))); };
    var today = dayOfQ(S.iso(S.today)), tx = xAt(today);
    var cs = (k.checkins || []).slice().sort(function (a, c) { return a.date < c.date ? -1 : 1; });
    var last = cs[cs.length - 1], prev = cs[cs.length - 2];
    var age = last ? -S.daysFromToday(last.date) : null;

    // trajectory: actual from the check-ins, expected along the plan, projection at the recent pace
    var pts = [X0 + "," + y(b)];
    cs.forEach(function (c) { pts.push(xAt(dayOfQ(c.date)) + "," + y(c.value)); });
    var lastX = last ? xAt(dayOfQ(last.date)) : X0;
    var lastV = last ? Number(last.value) : b;
    if (!isNaN(cur) && key !== "stale") { pts.push(tx + "," + y(cur)); lastX = tx; lastV = cur; }
    var perDay = null;
    if (prev && last) { var dd = dayOfQ(last.date) - dayOfQ(prev.date); if (dd > 0) perDay = (Number(last.value) - Number(prev.value)) / dd; }
    var remain = Math.max(0, QDAYS - today);
    var forecast = perDay === null ? (last ? lastV : null) : Math.max(0, lastV + perDay * remain);
    if (forecast !== null) { var capV = t + (t - b) * 0.25; forecast = (t < b) ? Math.max(forecast, capV) : Math.min(forecast, capV); }
    if (forecast !== null && k.unit === "n") forecast = Math.round(forecast);
    var known = key !== "stale" && key !== "new" && forecast !== null;
    var lowerBetter = S.lowerBetter(k);
    var reqPerWk = remain ? (t - lastV) / remain * 7 : 0;
    var arrow = "→", arrowCol = "#5E5B53";
    if (prev && last && Number(last.value) !== Number(prev.value)) {
      var up = Number(last.value) > Number(prev.value), good = lowerBetter ? !up : up;
      arrow = up ? "↑" : "↓"; arrowCol = good ? "#1E5E38" : "#9B1C12";
    }
    var fcGood = forecast !== null && (lowerBetter ? forecast <= t : forecast >= t);
    var next = (k.miles || []).filter(function (m) { return !m.done; }).sort(function (a, c) { return a.week - c.week; })[0];
    var nextTxt = next ? next.text + " · " + S.wl(next.week) + " · " + S.shortDate(S.weekSunday(next.week)) : "All milestones done";
    var nextLate = next && next.week < S.week;
    var fmt = function (v) { return S.fmtVal(v, k.unit); };
    var sub = DEPT[k.owner] + " · " + S.member(k.owner).name + " · " +
      (last ? (age === 0 ? "updated today" : "updated " + age + " d ago") : "no check-in yet") +
      (last && last.conf ? " · confidence " + last.conf + "/10" : "");
    var ratio = st.ratio === null || st.ratio === undefined ? "—" : st.ratio.toFixed(2);
    var sw = lowerBetter ? 'above the line = cheaper' : '';
    var col = COL[key];
    var projY = known ? y(forecast) : y(lastV);
    return {
      id: k.id, obj: k.obj, objLabel: S.OBJ[k.obj] || k.obj, owner: k.owner, dept: DEPT[k.owner] || "",
      name: k.name, sub: sub, subStyle: "font-size: 12px; margin-top: 3px; " + (key === "stale" ? "color: #8A3F06; font-weight: 600" : "color: #5E5B53"),
      key: key, label: st.label, pillStyle: "justify-self: start; display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 999px; font-size: 13px; font-weight: 600; white-space: nowrap; " + PILL[key],
      dotStyle: "width: 8px; height: 8px; border-radius: 50%; box-sizing: border-box; " + (key === "stale" || key === "new" ? "border: 2px solid #5E5B53" : "background: " + col),
      rowStyle: "display: grid; grid-template-columns: 250px 260px 120px minmax(0, 1fr) 96px; gap: 18px; align-items: center; padding: 10px 8px; border-top: 1px solid #EFEBE3; text-decoration: none; color: #1B1B18; cursor: pointer;" + (key === "red" ? " background: #FFF8F6;" : ""),
      // svg
      aria: known ? "Actual " + fmt(lastV) + ", projected " + fmt(forecast) + " for a target of " + fmt(t) : "No recent data, trajectory unknown",
      todayX: tx, expPts: S.planLine(k).map(function (p) { return xAt(p[0]) + "," + y(p[1]); }).join(" "),
      actPts: pts.join(" "), actCol: key === "stale" ? "#8E8A80" : col,
      projOn: known, projOp: known ? 1 : 0, staleOp: (key === "stale" || key === "new") ? 1 : 0, projX1: lastX, projY1: y(lastV), projY2: projY, projCol: col,
      stale: key === "stale" || key === "new", staleX: Math.min(200, lastX + 16),
      targetY: YT, cheaper: sw,
      // ratio column
      ratio: ratio, arrow: key === "stale" ? "?" : arrow, arrowStyle: "color: " + (key === "stale" ? "#5E5B53" : arrowCol),
      ratioStyle: "font-family: 'IBM Plex Mono', monospace; font-size: 15px;" + (key === "stale" ? " color: #5E5B53" : ""),
      ratioSub: key === "stale" && last ? fmt(last.value) + " " + age + " d ago" : fmt(cur) + " · expected " + fmt(k.expected),
      // forecast column
      fcText: known ? fmt(forecast) + " / " + fmt(t) : "unknown",
      fcStyle: "color: " + (known ? (fcGood ? "#1E5E38" : TXT[key === "green" ? "amber" : key]) : "#5E5B53"),
      paceText: known && perDay !== null ? pace(perDay * 7, k.unit) + " / wk" : (known ? "needs 2 check-ins" : "unknown, no recent data"),
      reqText: known ? (lowerBetter ? (lastV <= t ? "at target" : pace(reqPerWk, k.unit) + " / wk") : (reqPerWk <= 0 ? "target reached" : pace(reqPerWk, k.unit) + " / wk")) : "—",
      paceStyle: "color: " + (known && perDay !== null && (lowerBetter ? perDay * 7 <= reqPerWk || lastV <= t : perDay * 7 >= reqPerWk) ? "#1E5E38" : (known ? "#8A3F06" : "#5E5B53")),
      nextText: nextTxt, nextStyle: "color: " + (nextLate ? "#9B1C12" : key === "green" ? "#5E5B53" : TXT[key])
    };
  }

  function counts() {
    var c = { total: 0, green: 0, amber: 0, red: 0, stale: 0, "new": 0 };
    S.list("krs").forEach(function (k) { c.total++; c[S.krStatus(k).key]++; });
    return c;
  }

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (ch) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]; }); }
  function svgHTML(v) {
    var h = '<svg viewBox="0 0 260 60" width="260" height="60" role="img" aria-label="' + esc(v.aria) + '">' +
      '<line x1="8" y1="54" x2="252" y2="54" stroke="#ECE8DF" stroke-width="1"></line>' +
      '<line x1="' + v.todayX + '" y1="2" x2="' + v.todayX + '" y2="58" stroke="#D8D3C7" stroke-width="1"></line>' +
      '<polyline points="' + v.expPts + '" fill="none" stroke="#1B1B18" stroke-width="1.5" stroke-dasharray="4 4"></polyline>' +
      '<polyline points="' + v.actPts + '" fill="none" stroke="' + v.actCol + '" stroke-width="2.5" stroke-linejoin="round"></polyline>';
    if (v.projOn) h += '<line x1="' + v.projX1 + '" y1="' + v.projY1 + '" x2="252" y2="' + v.projY2 + '" stroke="' + v.projCol + '" stroke-width="2" stroke-dasharray="1 4" stroke-linecap="round"></line><circle cx="252" cy="' + v.projY2 + '" r="3.5" fill="' + v.projCol + '"></circle>';
    if (v.stale) h += '<text x="' + v.staleX + '" y="40" font-size="11" fill="#5E5B53" font-family="IBM Plex Sans, sans-serif">? no recent data</text>';
    h += '<line x1="242" y1="6" x2="258" y2="6" stroke="#1B1B18" stroke-width="2"></line>';
    if (v.cheaper) h += '<text x="150" y="48" font-size="10" fill="#5E5B53" font-family="IBM Plex Sans, sans-serif">' + v.cheaper + '</text>';
    return h + '</svg>';
  }
  function rowHTML(v) {
    return '<a href="#" data-kr="' + esc(v.id) + '" style="' + v.rowStyle + '">' +
      '<div><div style="font-size: 14px; font-weight: 600">' + esc(v.name) + '</div><div style="' + v.subStyle + '">' + esc(v.sub) + '</div></div>' +
      svgHTML(v) +
      '<div><div style="' + v.ratioStyle + '">' + v.ratio + ' <span style="' + v.arrowStyle + '">' + v.arrow + '</span></div><div style="font-size: 12px; color: #5E5B53; margin-top: 2px">' + esc(v.ratioSub) + '</div></div>' +
      '<div style="font-size: 13px; line-height: 1.55"><div>Forecast: <strong style="' + v.fcStyle + '">' + esc(v.fcText) + '</strong></div>' +
      '<div>7-d pace: <strong style="' + v.paceStyle + '">' + esc(v.paceText) + '</strong> · required <strong>' + esc(v.reqText) + '</strong></div>' +
      '<div style="' + v.nextStyle + '">' + esc(v.nextText) + '</div></div>' +
      '<span style="' + v.pillStyle + '"><span style="' + v.dotStyle + '"></span>' + esc(v.label) + '</span></a>';
  }
  function sectionHTML(owner, title) {
    var rows = S.list("krs").filter(function (k) { return k.owner === owner; }).map(view);
    return '<section aria-label="' + esc(title) + '" style="background: #FFFFFF; border: 1px solid #E3DFD5; border-radius: 14px; padding: 24px 28px; display: flex; flex-direction: column">' +
      '<h2 style="margin: 0 0 14px; font-family: Fraunces, Georgia, serif; font-size: 22px; font-weight: 500">' + esc(title) + '</h2>' +
      (rows.length ? '<div style="display: grid; grid-template-columns: 250px 260px 120px minmax(0, 1fr) 96px; gap: 18px; padding: 0 8px 8px; font-size: 12px; letter-spacing: 0.06em; text-transform: uppercase; color: #5E5B53"><span>Key result</span><span>Quarter trajectory</span><span>Ratio</span><span>Forecast · pace · next milestone</span><span>Status</span></div>' + rows.map(rowHTML).join("") :
        '<div style="padding: 14px 8px; border-top: 1px solid #EFEBE3; font-size: 14px; color: #5E5B53">No key result owned by this department yet. Create one in Roadmap.</div>') +
      '</section>';
  }
  // Opening a key result: go to the Roadmap with it selected
  var FILES = { inbox: "Inbox", review: "Review", build: "Build", execute: "Execute", decisions: "Decisions", cockpit: "Main", bibliotheque: "Bibliotheque" };
  var MOVED = { monjour: "execute", roadmap: "build" };   // My Day and Roadmap were replaced by Execute and Build
  var focus = {};
  function goto(screen, id) {
    if (screen === "inbox") { screen = "execute"; if (id !== undefined && id !== null) focus.alert = id; id = null; }
    screen = MOVED[screen] || screen;
    if (id !== undefined && id !== null) focus[screen] = id;
    var a = document.querySelector('#app a[href="' + (FILES[screen] || screen) + '.dc.html"]');
    if (a) a.click(); else location.hash = screen;
  }
  function takeFocus(screen) { var v = focus[screen]; delete focus[screen]; return v; }
  function openKr(id) { goto("build", id); }

  // objective labels: the defaults, renamed or completed by the shared "objectives" config
  function objLabels() {
    var o = {}, c = S.get("config", "objectives");
    Object.keys(OBJ).forEach(function (id) { o[id] = OBJ[id]; });
    ((c && c.list) || []).forEach(function (x) { if (x && x.id && x.name) o[x.id] = x.id + " · " + x.name; });
    return o;
  }
  Object.defineProperty(S, "OBJ", { get: objLabels, enumerable: true, configurable: true });
  // One confirmation popup for every delete or remove button of the OS (screens, modules, web edition):
  // sklConfirm({ title, body, ok: "Delete", onOk }). Esc, Cancel or a click outside keep everything as it was.
  function confirmBox(o) {
    var prev = document.activeElement, bg = document.createElement("div");
    bg.setAttribute("data-skl-confirm", "");
    bg.style.cssText = "position:fixed;inset:0;z-index:90;background:rgba(27,27,24,.55);display:flex;align-items:center;justify-content:center;padding:24px;font-family:'IBM Plex Sans',system-ui,sans-serif";
    var box = document.createElement("div");
    box.setAttribute("role", "alertdialog"); box.setAttribute("aria-modal", "true"); box.setAttribute("aria-labelledby", "sklcfT");
    box.style.cssText = "width:min(460px,100%);background:#fff;border:1px solid #E3DFD5;border-radius:14px;padding:24px;box-shadow:0 18px 50px rgba(27,27,24,.25);display:flex;flex-direction:column;gap:14px;color:#1B1B18";
    box.innerHTML = '<h3 id="sklcfT" style="margin:0;font-family:Fraunces,Georgia,serif;font-weight:600;font-size:22px"></h3><p style="margin:0;font-size:14px;line-height:1.55;color:#5E5B53"></p>' +
      '<div style="display:flex;justify-content:flex-end;gap:10px;margin-top:6px"><button type="button" data-no style="font:inherit;font-size:14px;font-weight:600;border-radius:10px;padding:10px 16px;cursor:pointer;background:#fff;border:1px solid #D8D3C7;color:#1B1B18">Cancel</button>' +
      '<button type="button" data-yes style="font:inherit;font-size:14px;font-weight:600;border-radius:10px;padding:10px 16px;cursor:pointer;background:#B42318;border:1px solid #B42318;color:#fff"></button></div>';
    box.querySelector("h3").textContent = o.title || "Delete this item?";
    box.querySelector("p").textContent = o.body || "This cannot be undone.";
    // o.html: a richer body built by the caller from escaped values (Weekly Review: key results left without a milestone)
    if (o.html) { var hb = document.createElement("div"); hb.style.cssText = "display:flex;flex-direction:column;gap:10px"; hb.innerHTML = o.html; box.querySelector("p").replaceWith(hb); }
    if (o.width) box.style.width = "min(" + Number(o.width) + "px,100%)";
    box.querySelector("[data-yes]").textContent = o.ok || "Delete";
    // o.primary: an action that changes nothing for good (Rename), dark button with gold text; o.focus: the field to type in, Enter confirms
    if (o.primary) box.querySelector("[data-yes]").style.cssText += ";background:#1B1B18;border-color:#1B1B18;color:#D9B46A";
    bg.appendChild(box);
    function close() { bg.remove(); document.removeEventListener("keydown", key, true); try { if (prev && prev.focus && prev.isConnected) prev.focus(); } catch (e) {} }
    function key(e) { if (e.key === "Escape") { e.stopPropagation(); e.preventDefault(); close(); if (o.onCancel) o.onCancel(); } }
    bg.addEventListener("mousedown", function (e) { if (e.target === bg) { close(); if (o.onCancel) o.onCancel(); } });
    box.querySelector("[data-no]").onclick = function () { close(); if (o.onCancel) o.onCancel(); };
    box.querySelector("[data-yes]").onclick = function () { var f = o.focus ? box.querySelector(o.focus) : null, v = f ? f.value : undefined; close(); if (o.onOk) o.onOk(v); };
    document.addEventListener("keydown", key, true);
    document.body.appendChild(bg);
    // quick: the delete button has the focus, so Enter confirms at once (Weekly Review task triage)
    var fld = o.focus ? box.querySelector(o.focus) : null;
    if (fld) { fld.focus(); try { fld.select(); } catch (e) {} fld.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); box.querySelector("[data-yes]").click(); } }); }
    else box.querySelector(o.quick ? "[data-yes]" : "[data-no]").focus();
  }
  window.sklConfirm = confirmBox;
  // a week's result of a key result: a new one is saved at once; changing or removing a recorded one asks first
  S.krWeekAsk = function (id, q, raw, done) {
    var k = S.get("krs", id); if (!k) return;
    var old = S.krWeeks(k)[q], v = String(raw == null ? "" : raw).trim();
    if (v !== "" && isNaN(Number(v))) { if (done) done(false, "A number, please."); return; }
    var go = function () { var r = S.setKrWeek(id, q, v === "" ? null : Number(v)); if (done) done(r.ok, r.ok ? (v === "" ? S.wl(q) + " result removed." : S.wl(q) + ": " + S.fmtVal(Number(v), k.unit) + " saved.") : r.why); };
    if (!old || old.value === "" || old.value == null) { if (v === "") { if (done) done(false); return; } return go(); }
    if (v !== "" && Number(v) === Number(old.value)) { if (done) done(false); return; }
    var src = (old.manual ? "typed by hand" : "recorded at the Weekly Review") + (old.locked ? " and validated" : "");
    confirmBox({ title: v === "" ? "Remove the " + S.wl(q) + " result?" : "Change the " + S.wl(q) + " result?",
      body: (k.name || "") + ": " + S.fmtVal(old.value, k.unit) + ", " + src + (old.date ? " (" + S.dayLabel(old.date) + ")" : "") + "." +
        (v === "" ? " The check-in of that week goes with it." : " New value: " + S.fmtVal(Number(v), k.unit) + "."),
      ok: v === "" ? "Remove" : "Change", onOk: go, onCancel: function () { if (done) done(false); } });
  };
  S.confirm = confirmBox;
  S.krView = view;
  S.krCounts = counts;
  S.krSectionHTML = sectionHTML;
  S.openKr = openKr;
  S.goto = goto;
  S.takeFocus = takeFocus;
})();
