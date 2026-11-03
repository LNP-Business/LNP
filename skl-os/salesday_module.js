/* SKL OS › Sales System › Sales Day (Romain 2026-10-31): the sales rep's day, one lead at a time, like Execute in the
   Operating System. The queue is built from the CRM: outcomes to declare first (the call is over and nothing is declared),
   then today's calls to prepare, reschedules to plan (a missed R2, a canceled call), no-shows to re-engage and follow-ups due.
   A card is finished with its action (an outcome declared, or "Done" with what was done, saved as a note on the lead); it
   swipes away and the next lead comes. "Tomorrow" puts it aside for today, "Skip" sends it to the end of the queue.
   Web edition: the real cycles (SKL_CRM.listBoard), writes through the CRM RPCs (crm_declare_outcome, crm_add_note) and the
   day list in the person's own settings (crm_member_prefs, 031). Elsewhere: sample leads, nothing saved. */
(function () {
  "use strict";
  var H = 3600e3, DAY = 24 * H;
  var CSS = [
    ":host{all:initial;display:block;container-type:inline-size;font:15px/1.5 'IBM Plex Sans',system-ui,sans-serif;color:#1B1B18;--line:#E3DFD5;--soft:#ECE8DF;--mut:#5E5B53;--gold:#D9B46A;--goldt:#9A6614;--ok:#2F7D4F;--oks:#E6F2EA;--late:#B4561E;--lates:#F8E9DE;--crit:#B42318}",
    "*{box-sizing:border-box}button,input,select,textarea{font:inherit;color:inherit}",
    ".wrap{display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:24px;align-items:start}",
    "@container (max-width:1000px){.wrap{grid-template-columns:1fr}}",
    ".card{background:#fff;border:1px solid var(--line);border-radius:14px}",
    ".pk{font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--mut)}",
    "h2,h3{font-family:Fraunces,Georgia,serif;font-weight:500;margin:0}",
    ".main{padding:22px 26px;display:flex;flex-direction:column;gap:18px}",
    ".head{display:flex;gap:16px;align-items:flex-end;flex-wrap:wrap}.head h2{font-size:26px}",
    ".sp{flex:1}",
    ".sel{height:38px;border:1px solid #D8D3C7;border-radius:10px;background:#fff;padding:0 10px;font-size:14px}",
    ".prog{display:flex;flex-direction:column;gap:6px}.bar{height:8px;border-radius:4px;background:var(--soft);overflow:hidden}.bar i{display:block;height:100%;background:#1B1B18;border-radius:4px;transition:width .3s}",
    ".kinds{display:flex;gap:8px;flex-wrap:wrap}",
    ".kd{display:inline-flex;gap:6px;align-items:center;font-size:12.5px;padding:4px 10px;border-radius:999px;background:var(--soft);color:#3D3A33}",
    ".kd b{font-family:'IBM Plex Mono',monospace;font-weight:600}.kd i{width:8px;height:8px;border-radius:50%;display:inline-block}",
    ".stage{display:flex;flex-direction:column;align-items:center;padding:12px 0 18px}",
    ".deck{position:relative;width:min(600px,100%)}",
    ".deck::before,.deck::after{content:'';position:absolute;left:16px;right:16px;bottom:-8px;height:20px;border-radius:0 0 18px 18px;background:#fff;border:1px solid var(--line);z-index:0}",
    ".deck::after{left:32px;right:32px;bottom:-16px;opacity:.6}",
    ".tc{position:relative;z-index:1;background:#fff;border:1px solid var(--line);border-radius:18px;padding:24px 26px;display:flex;flex-direction:column;gap:14px;box-shadow:0 12px 32px rgba(27,27,24,.08);transition:transform .25s ease,opacity .25s ease;touch-action:pan-y}",
    ".tc.out{transform:translateX(70px) rotate(4deg);opacity:0}.tc.aside{transform:translateX(-70px) rotate(-4deg);opacity:0}.tc.drag{transition:none}",
    "@media (prefers-reduced-motion:reduce){.tc{transition:none}}",
    ".ctx{display:flex;gap:8px;flex-wrap:wrap;align-items:center;font-size:12.5px;color:var(--mut)}",
    ".tag{font-size:11px;font-weight:700;padding:3px 10px;border-radius:999px;color:#fff}",
    ".tc h2{font-size:28px;line-height:1.2}",
    ".act{display:flex;gap:10px;font-size:15px;background:var(--soft);border-radius:10px;padding:10px 12px}.act b{white-space:nowrap}",
    ".facts{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}",
    ".facts div{display:flex;flex-direction:column;gap:2px;border-left:2px solid var(--line);padding-left:10px;min-width:0}",
    ".facts b{font:600 15px 'IBM Plex Mono',monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.facts span{font-size:11.5px;color:var(--mut)}",
    ".lbl{font-size:13px;font-weight:600}",
    ".chips{display:flex;gap:8px;flex-wrap:wrap}",
    ".chip{min-height:40px;padding:0 14px;border-radius:999px;border:1px solid #D8D3C7;background:#fff;cursor:pointer;font-size:14px}",
    ".chip[aria-pressed=true]{background:#1B1B18;color:#fff;border-color:#1B1B18}",
    ".inp{width:100%;border:1px solid #D8D3C7;border-radius:10px;padding:9px 12px;background:#fff;font-size:14px}textarea.inp{resize:vertical;min-height:62px}",
    ".cacts{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;padding-top:4px}",
    ".btn{min-height:44px;padding:0 18px;border-radius:10px;border:1px solid #D8D3C7;background:#fff;cursor:pointer;font-size:14px;font-weight:600}",
    ".btn.p{background:#1B1B18;color:var(--gold);border-color:#1B1B18}.btn:disabled{opacity:.5;cursor:default}",
    ".btn.sm{min-height:34px;padding:0 12px;font-size:13px}.btn.ln{border:0;background:none;text-decoration:underline;text-underline-offset:3px;font-weight:500;color:var(--mut)}",
    ".hint{font-size:12px;color:var(--mut);text-align:center}",
    ".err{font-size:13px;color:var(--crit)}",
    ".side{display:flex;flex-direction:column;gap:16px}",
    ".side .card{padding:16px 18px;display:flex;flex-direction:column;gap:6px}",
    ".side h3{font-size:18px;margin-bottom:4px}",
    ".li{display:flex;gap:10px;align-items:center;font-size:13.5px;padding:7px 0;border-bottom:1px solid #EFECE4;width:100%;background:none;border-left:0;border-right:0;border-top:0;text-align:left;cursor:pointer}",
    ".li:last-child{border-bottom:0}.li i{width:8px;height:8px;border-radius:50%;flex-shrink:0}.li span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.li em{font-style:normal;color:var(--mut);font-size:12px;white-space:nowrap}",
    ".li.done span{text-decoration:line-through;color:var(--mut)}",
    ".empty{font-size:13px;color:var(--mut)}",
    ".cover{padding:60px 20px;text-align:center;color:var(--mut)}",
    ".clear{text-align:center;align-items:center}.clear h2{font-size:26px}"
  ].join("\n");

  // what a card asks, in the order of the queue
  var KIND = {
    outcome: { n: "Issue à déclarer", c: "#B42318", act: "Déclarer l'issue de l'appel" },
    prep: { n: "Appel aujourd'hui", c: "#3B6FD4", act: "Préparer et confirmer l'appel" },
    resched: { n: "À replanifier", c: "#6366F1", act: "Replanifier l'appel" },
    reengage: { n: "Absent", c: "#8B5CF6", act: "Relancer après l'absence" },
    follow: { n: "Relance", c: "#9A6614", act: "Relancer" }
  };
  var ORDER = ["outcome", "prep", "resched", "reengage", "follow"];
  var DEMO_REASONS = [{ code: "price", kind: "lost", label: "Prix" }, { code: "timing", kind: "lost", label: "Mauvais moment" },
    { code: "trust", kind: "lost", label: "Manque de confiance" }, { code: "partner", kind: "lost", label: "Conjoint ou associé" },
    { code: "dq_off_target", kind: "disqualified", label: "Hors cible" }, { code: "dq_budget", kind: "disqualified", label: "Aucun budget" }];

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function dayKey(t) { var d = new Date(t); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function ago(ms, now) {
    var d = now - ms, a = Math.abs(d), f = a < H ? Math.max(1, Math.round(a / 60e3)) + " min" : a < 72 * H ? Math.round(a / H) + " h" : Math.round(a / DAY) + " j";
    return d >= 0 ? "il y a " + f : "dans " + f;
  }
  // shown labels of a "Done today" row (the stored `how` values stay as they are)
  var HOW = { done: "fait", "no-show": "absent", yes: "oui", "follow-up": "relance", no: "non", disqualified: "disqualifié" };
  function hm(ms) { var d = new Date(ms); return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); }
  function t(iso) { return iso ? Date.parse(iso) : null; }
  function callEnd(k) { return t(k.scheduled_end) || (t(k.scheduled_start) ? t(k.scheduled_start) + 45 * 60e3 : null); }

  // sample leads for the Artifact and the plain file (fictional people)
  function demo(now) {
    var iso = function (ms) { return new Date(ms).toISOString(); };
    var me = { id: "demo-sales", full_name: "Valentino", role: "sales" };
    var cy = function (id, name, extra) { return Object.assign({ id: id, status: "active", owner_id: me.id, opened_at: iso(now - 9 * DAY), person: { full_name: name, primary_email: name.toLowerCase().replace(/ /g, ".") + "@example.com", primary_phone: "+1 555 0100" }, calls: [], events: [], deal: null }, extra); };
    return { me: me, members: [me], reasons: DEMO_REASONS, cycles: [
      cy("d1", "Prospect fictif A", { next_move: { code: "declare_outcome" }, last_event_at: iso(now - 20 * H),
        calls: [{ id: "d1k1", rank: 1, status: "held", scheduled_start: iso(now - 21 * H), scheduled_end: iso(now - 20 * H) }] }),
      cy("d2", "Prospect fictif B", { next_move: { code: "declare_outcome" }, last_event_at: iso(now - 4 * H),
        calls: [{ id: "d2k1", rank: 1, status: "scheduled", scheduled_start: iso(now - 5 * H), scheduled_end: iso(now - 4 * H) }] }),
      cy("d3", "Prospect fictif C", { next_move: { code: "attend_call" }, last_event_at: iso(now - 2 * DAY),
        calls: [{ id: "d3k1", rank: 1, status: "scheduled", scheduled_start: iso(now + 3 * H), scheduled_end: iso(now + 4 * H) }] }),
      cy("d4", "Prospect fictif D", { next_move: { code: "rebook", missed: 2 }, last_event_at: iso(now - DAY),
        calls: [{ id: "d4k1", rank: 1, status: "held", scheduled_start: iso(now - 6 * DAY), scheduled_end: iso(now - 6 * DAY + H) },
                { id: "d4k2", rank: 2, status: "missed", scheduled_start: iso(now - DAY - H), scheduled_end: iso(now - DAY) }] }),
      cy("d5", "Prospect fictif E", { next_move: { code: "follow_up" }, last_event_at: iso(now - 2 * DAY),
        calls: [{ id: "d5k1", rank: 1, status: "no_show", scheduled_start: iso(now - 2 * DAY), scheduled_end: iso(now - 2 * DAY + H) }] }),
      cy("d6", "Prospect fictif F", { next_move: { code: "follow_up" }, last_event_at: iso(now - 4 * DAY), last_sales_at: iso(now - 4 * DAY),
        calls: [{ id: "d6k1", rank: 1, status: "held", scheduled_start: iso(now - 5 * DAY), scheduled_end: iso(now - 5 * DAY + H) }],
        events: [{ type: "outcome_follow_up", source: "crm", call_id: "d6k1", occurred_at: iso(now - 5 * DAY), data: { next_step: "Envoyer l'étude de cas et rappeler" } }] })
    ] };
  }

  // the queue: one card per live lead that needs the sales rep today (same signals as the projector, 005 / 030)
  function queue(cycles, now) {
    var out = [];
    cycles.forEach(function (c) {
      if (c.status !== "active") return;
      var calls = (c.calls || []).slice().sort(function (a, b) { return (t(a.scheduled_start) || 0) - (t(b.scheduled_start) || 0); });
      var ev = c.events || [], nm = c.next_move || {};
      var declared = function (id) { return ev.some(function (e) { return e.call_id === id && /^outcome_/.test(e.type) && e.source === "crm"; }); };
      var base = { c: c, name: (c.person && (c.person.full_name || c.person.primary_email || c.person.primary_phone)) || "—" };
      if (nm.code === "declare_outcome") {
        var late = calls.filter(function (k) { var e = callEnd(k); return e && e < now && (k.status === "scheduled" || k.status === "outcome_pending" || (k.status === "held" && !declared(k.id))); });
        var k = late[0];
        if (k) { out.push(Object.assign({ kind: "outcome", call: k, due: callEnd(k), id: c.id + ":outcome:" + k.id }, base)); return; }
      }
      var next = calls.filter(function (k) { return k.status === "scheduled" && t(k.scheduled_start) >= now; })[0];
      if (next && t(next.scheduled_start) - now < 24 * H) { out.push(Object.assign({ kind: "prep", call: next, due: t(next.scheduled_start), id: c.id + ":prep:" + next.id }, base)); return; }
      if (next) return;   // a call is booked: nothing to do before the day before
      // silent for over 14 days: the lead is in the CRM's Long follow-up column, not in the day (outcomes above always are)
      if (now - (t(c.last_event_at) || t(c.opened_at) || now) > 14 * DAY) return;
      var last = calls.filter(function (k) { return k.status !== "canceled" || nm.code === "rebook"; }).pop();
      if (nm.code === "rebook") { out.push(Object.assign({ kind: "resched", call: last, due: last ? callEnd(last) : now, id: c.id + ":resched:" + (last ? last.id : "") }, base)); return; }
      if (last && last.status === "no_show" && now - callEnd(last) < 14 * DAY) { out.push(Object.assign({ kind: "reengage", call: last, due: callEnd(last), id: c.id + ":reengage:" + last.id }, base)); return; }
      if (nm.code === "follow_up") {
        var touch = t(c.last_sales_at) || 0;
        if (now - touch >= 48 * H) out.push(Object.assign({ kind: "follow", call: last, due: touch || t(c.last_event_at) || now, id: c.id + ":follow:" + dayKey(now) }, base));
      }
    });
    return out.sort(function (a, b) { return ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind) || a.due - b.due; });
  }

  function goScreen(file) { var a = document.querySelector('#app a[href="' + file + '"]'); if (a) a.click(); }

  window.SKL_SALESDAY = {
    css: CSS,
    html: '<div id="sd"><div class="card cover">Chargement de votre journée…</div></div>',
    mount: function (root, tip, toast) {
      var box = root.getElementById("sd");
      var C = window.SKL_CRM, S = { live: false, loading: true, error: "", me: null, members: [], reasons: DEMO_REASONS, cycles: [],
        who: "me", day: { done: [], snoozed: [] }, dayKey: dayKey(Date.now()), skipped: [], form: {}, busy: false, front: null, msg: "" };
      function say(m) { if (!toast) return; toast.textContent = m; toast.style.opacity = 1; clearTimeout(say.t); say.t = setTimeout(function () { toast.style.opacity = 0; }, 2400); }
      function lead() { return S.me && ["admin", "sales_lead", "viewer"].indexOf(S.me.role) >= 0; }
      function saveDay() { if (C) C.setPref("salesday." + S.dayKey, S.day).catch(function () { say("La liste du jour n'a pas pu être enregistrée"); }); }
      function load() {
        S.loading = true; S.error = ""; render();
        var now = Date.now();
        Promise.resolve(C && C.ready()).then(function () {
          S.live = !!(C && C.mode() === "live");
          if (!S.live) { var d = demo(now); S.me = d.me; S.members = d.members; S.cycles = d.cycles; S.reasons = d.reasons; return; }
          return Promise.all([C.me(), C.listMembers(), C.listBoard(), C.listReasons()]).then(function (r) {
            S.me = r[0] || { id: null, role: "viewer" }; S.members = r[1] || []; S.cycles = r[2] || [];
            S.reasons = (r[3] || []).filter(function (x) { return x.active !== false && !x.automatic && (x.kind === "lost" || x.kind === "disqualified"); });
            if (S.who === "me" && !S.cycles.some(function (c) { return c.owner_id === S.me.id; }) && lead()) S.who = "all";
          });
        }).then(function () { return C ? C.getPref("salesday." + S.dayKey).catch(function () { return null; }) : null; })
          .then(function (d) { if (d && d.done) S.day = { done: d.done || [], snoozed: d.snoozed || [] }; S.loading = false; render(); })
          .catch(function (e) { S.loading = false; S.error = String((e && e.message) || e); render(); });
      }
      function mine(c) { return S.who === "all" ? true : S.who === "me" ? c.owner_id === (S.me && S.me.id) : c.owner_id === S.who; }
      function lists() {
        var now = Date.now(), q = queue(S.cycles.filter(mine), now);
        // a lead handled today does not come back today (a no-show declared here is re-engaged tomorrow)
        var done = {}; S.day.done.forEach(function (d) { done[d.id] = 1; done[String(d.id).split(":")[0]] = 1; });
        var snz = {}; S.day.snoozed.forEach(function (id) { snz[id] = 1; });
        var open = q.filter(function (i) { return !done[i.id] && !done[i.c.id] && !snz[i.id]; });
        // skipped cards go to the end; a card picked in "Up next" comes first
        open.sort(function (a, b) { return (S.skipped.indexOf(a.id) >= 0) - (S.skipped.indexOf(b.id) >= 0) || S.skipped.indexOf(a.id) - S.skipped.indexOf(b.id); });
        if (S.front) { var f = open.filter(function (i) { return i.id === S.front; })[0]; if (f) open = [f].concat(open.filter(function (i) { return i !== f; })); }
        var mineDone = S.day.done.filter(function (d) { return S.who === "all" || d.who === S.who || (S.who === "me" && d.who === (S.me && S.me.id)) || !d.who; });
        return { now: now, open: open, done: mineDone, snoozed: q.filter(function (i) { return snz[i.id]; }), total: open.length + mineDone.length };
      }
      function facts(i, now) {
        var c = i.c, k = i.call, out = [];
        if (k) out.push([(i.kind === "prep" ? hm(t(k.scheduled_start)) : ago(callEnd(k), now)), "R" + (k.rank || 1) + " · " + (k.status === "missed" ? "manqué" : k.status === "no_show" ? "absent" : i.kind === "prep" ? "aujourd'hui" : "appel")]);
        out.push([c.last_event_at ? ago(t(c.last_event_at), now) : "—", "dernière activité"]);
        var owner = S.members.filter(function (m) { return m.id === c.owner_id; })[0];
        out.push([owner ? owner.full_name : "—", "commercial"]);
        return out;
      }
      function nextStep(c) {
        var e = (c.events || []).filter(function (x) { return /^outcome_/.test(x.type) && x.data && x.data.next_step; }).pop();
        return e ? e.data.next_step : "";
      }
      function cardHTML(i, n, of, now) {
        var K = KIND[i.kind], F = S.form, c = i.c;
        var head = '<div class="ctx"><span class="tag" style="background:' + K.c + '">' + K.n + '</span><span>Prospect ' + n + ' sur ' + of + '</span>' +
          (c.person && c.person.primary_phone ? '<span>· ' + esc(c.person.primary_phone) + '</span>' : '') + '</div><h2>' + esc(i.name) + '</h2>';
        var act = K.act + (i.kind === "resched" && c.next_move && c.next_move.missed ? " · R" + c.next_move.missed + " n'a pas eu lieu (pas d'enregistrement Fathom)" : "") +
          (i.kind === "follow" && nextStep(c) ? " · " + nextStep(c) : "");
        var body = '<div class="act"><b>À faire</b><span>' + esc(act) + '</span></div><div class="facts">' +
          facts(i, now).map(function (f) { return '<div><b title="' + esc(f[0]) + '">' + esc(f[0]) + '</b><span>' + esc(f[1]) + '</span></div>'; }).join("") + '</div>';
        var ro = S.live && S.me && S.me.role === "viewer";
        if (i.kind === "outcome") {
          var att = F.att, dec = F.dec, rs = S.reasons.filter(function (r) { return r.kind === (dec === "no" ? "lost" : "disqualified"); });
          body += '<div class="lbl">L\'appel a-t-il eu lieu ?</div><div class="chips">' +
            [["held", "Honoré"], ["no_show", "Absent"]].map(function (x) { return '<button class="chip" data-att="' + x[0] + '" aria-pressed="' + (att === x[0]) + '">' + x[1] + '</button>'; }).join("") + '</div>';
          if (att === "held") {
            body += '<div class="lbl">Décision</div><div class="chips">' + [["yes", "Oui"], ["follow_up", "Relance"], ["no", "Non"], ["disqualified", "Disqualifié"]]
              .map(function (x) { return '<button class="chip" data-dec="' + x[0] + '" aria-pressed="' + (dec === x[0]) + '">' + x[1] + '</button>'; }).join("") + '</div>';
            if (dec === "follow_up") body += '<input class="inp" id="sdnext" placeholder="Prochaine étape (ce qui a été convenu)" value="' + esc(F.next || "") + '">';
            if (dec === "no" || dec === "disqualified") body += '<select class="inp" id="sdreason" aria-label="Motif"><option value="">Motif…</option>' +
              rs.map(function (r) { return '<option value="' + esc(r.code) + '"' + (F.reason === r.code ? " selected" : "") + '>' + esc(r.label) + '</option>'; }).join("") + '</select>';
            if (dec === "yes") body += '<input class="inp" id="sdamount" inputmode="decimal" placeholder="Montant signé (facultatif)" value="' + esc(F.amount || "") + '">';
          }
          var ok = att === "no_show" || (att === "held" && dec && (dec === "yes" || dec === "follow_up" || F.reason));
          body += (F.err ? '<div class="err">' + esc(F.err) + '</div>' : '') +
            '<div class="cacts"><button class="btn p" data-do="declare"' + (ok && !S.busy && !ro ? "" : " disabled") + '>' + (S.busy ? "Enregistrement…" : "Déclarer et suivant") + '</button>' +
            '<button class="btn" data-do="snooze">Demain</button><button class="btn" data-do="skip">Passer</button></div>';
        } else {
          body += '<textarea class="inp" id="sdnote" placeholder="Qu\'avez-vous fait ? (enregistré en note sur le prospect)">' + esc(F.note || "") + '</textarea>' +
            (F.err ? '<div class="err">' + esc(F.err) + '</div>' : '') +
            '<div class="cacts"><button class="btn p" data-do="done"' + (S.busy || ro ? " disabled" : "") + '>' + (S.busy ? "Enregistrement…" : "Fait") + '</button>' +
            '<button class="btn" data-do="snooze">Demain</button><button class="btn" data-do="skip">Passer</button></div>' +
            '<div class="hint">Faites glisser la carte vers la droite une fois l\'action faite.</div>';
        }
        return '<div class="deck"><article class="tc" id="tc" data-id="' + esc(i.id) + '">' + head + body +
          '<div class="cacts"><button class="btn ln sm" data-go="CRM.dc.html">Ouvrir le CRM</button></div></article></div>';
      }
      function render() {
        if (!box.isConnected) return;
        if (S.loading) { box.innerHTML = '<div class="card cover">Chargement de votre journée…</div>'; return; }
        if (S.error) { box.innerHTML = '<div class="card cover">Votre journée n\'a pas pu être chargée : ' + esc(S.error) + '<div class="cacts"><button class="btn" data-do="reload">Réessayer</button></div></div>'; return; }
        if (dayKey(Date.now()) !== S.dayKey) { S.dayKey = dayKey(Date.now()); S.day = { done: [], snoozed: [] }; S.skipped = []; }
        var L = lists(), now = L.now, cur = L.open[0];
        var counts = {}; L.open.forEach(function (i) { counts[i.kind] = (counts[i.kind] || 0) + 1; });
        var who = (lead() || !S.live) ? '<select class="sel" data-who aria-label="Prospects affichés"><option value="me"' + (S.who === "me" ? " selected" : "") + '>Mes prospects</option>' +
          (lead() ? '<option value="all"' + (S.who === "all" ? " selected" : "") + '>Toute l\'équipe</option>' + S.members.filter(function (m) { return m.active !== false && S.me && m.id !== S.me.id; })
            .map(function (m) { return '<option value="' + esc(m.id) + '"' + (S.who === m.id ? " selected" : "") + '>' + esc(m.full_name) + '</option>'; }).join("") : "") + '</select>' : "";
        var dateLbl = new Date(now).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
        var pct = L.total ? Math.round(L.done.length / L.total * 100) : 0;
        var main = '<div class="card main"><div class="head"><div><span class="pk">Ma journée · ' + (S.live ? "" : "prospects fictifs · ") + L.done.length + ' sur ' + L.total + ' fait' + (L.done.length > 1 ? 's' : '') + '</span><h2>' + esc(dateLbl) + '</h2></div><span class="sp"></span>' + who +
          '<button class="btn sm" data-do="reload" title="Relire le CRM">Actualiser</button></div>' +
          '<div class="prog"><div class="bar"><i style="width:' + pct + '%"></i></div></div>' +
          '<div class="kinds">' + ORDER.filter(function (k) { return counts[k]; }).map(function (k) { return '<span class="kd"><i style="background:' + KIND[k].c + '"></i>' + KIND[k].n + ' <b>' + counts[k] + '</b></span>'; }).join("") + '</div>' +
          '<div class="stage">' + (cur ? cardHTML(cur, L.done.length + 1, L.total, now) :
            '<div class="deck"><article class="tc clear"><span class="pk">Tout est fait</span><h2>Tous les prospects du jour sont traités</h2><p class="empty">Les nouvelles issues et relances s\'affichent ici dès que le CRM les reçoit. ' +
            (L.snoozed.length ? L.snoozed.length + ' mis de côté pour demain.' : '') + '</p></article></div>') + '</div></div>';
        var next = L.open.slice(1, 9).map(function (i) { return '<button class="li" data-front="' + esc(i.id) + '"><i style="background:' + KIND[i.kind].c + '"></i><span>' + esc(i.name) + '</span><em>' + KIND[i.kind].n + '</em></button>'; }).join("");
        var done = L.done.slice().reverse().map(function (d) { return '<div class="li done"><i style="background:' + (KIND[d.kind] || KIND.follow).c + '"></i><span>' + esc(d.name) + '</span><em>' + esc(HOW[d.how] || d.how || "") + " · " + hm(t(d.at)) + '</em></div>'; }).join("");
        var side = '<div class="side"><div class="card"><h3>À suivre</h3>' + (next || '<div class="empty">Rien d\'autre en attente.</div>') + (L.open.length > 9 ? '<div class="empty">+ ' + (L.open.length - 9) + ' autres</div>' : '') + '</div>' +
          '<div class="card"><h3>Fait aujourd\'hui</h3>' + (done || '<div class="empty">Rien pour l\'instant.</div>') + '</div>' +
          (L.snoozed.length ? '<div class="card"><h3>Demain</h3>' + L.snoozed.map(function (i) { return '<div class="li"><i style="background:' + KIND[i.kind].c + '"></i><span>' + esc(i.name) + '</span><button class="btn ln sm" data-unsnooze="' + esc(i.id) + '">Remettre aujourd\'hui</button></div>'; }).join("") + '</div>' : '') + '</div>';
        box.innerHTML = '<div class="wrap">' + main + side + '</div>';
        swipe();
      }
      // a finished card swipes away, then the next lead comes
      function finish(cls, then) {
        var el = root.getElementById("tc");
        if (el) el.classList.add(cls);
        setTimeout(function () { then(); S.form = {}; S.front = null; render(); }, el ? 260 : 0);
      }
      function current() { var L = lists(); return L.open[0]; }
      function markDone(i, how) {
        S.day.done.push({ id: i.id, kind: i.kind, name: i.name, how: how, at: new Date().toISOString(), who: i.c.owner_id || null });
        saveDay();
      }
      function act(kind) {
        var i = current(); if (!i || S.busy) return;
        var F = S.form;
        if (kind === "skip") { S.skipped = S.skipped.filter(function (x) { return x !== i.id; }).concat([i.id]); return finish("aside", function () {}); }
        if (kind === "snooze") { S.day.snoozed.push(i.id); saveDay(); return finish("aside", function () {}); }
        if (kind === "done") {
          var note = (F.note || "").trim();
          S.busy = true; F.err = ""; render();
          Promise.resolve(S.live ? C.addNote(i.c.id, "Ma journée · " + KIND[i.kind].act + (note ? " : " + note : "")) : { demo: true }).then(function (r) {
            S.busy = false;
            if (r && r.error) { F.err = r.error.message || "Non enregistré"; return render(); }
            finish("out", function () { markDone(i, "done"); });
          }, function (e) { S.busy = false; F.err = String((e && e.message) || e); render(); });
          return;
        }
        if (kind === "declare") {
          var p = { attendance: F.att };
          if (F.att === "held") {
            p.decision = F.dec;
            if (F.dec === "no" || F.dec === "disqualified") p.reason_code = F.reason;
            if (F.dec === "follow_up" && (F.next || "").trim()) p.next_step = F.next.trim();
            // a French amount ("1 500,50") is read as 1500.50
            var amt = Number(String(F.amount || "").replace(/[\s\u00a0\u202f]/g, "").replace(",", "."));
            if (F.dec === "yes" && F.amount && !isNaN(amt)) p.amount_sold = amt;
          }
          S.busy = true; F.err = ""; render();
          Promise.resolve(S.live ? C.declareOutcome(i.call.id, p) : { demo: true }).then(function (r) {
            S.busy = false;
            if (r && r.error) { F.err = r.error.message || "Non enregistré"; return render(); }
            var how = F.att === "no_show" ? "no-show" : { yes: "yes", follow_up: "follow-up", no: "no", disqualified: "disqualified" }[F.dec];
            finish("out", function () {
              markDone(i, how);
              // the cycle's next move changes on the server: drop its outcome from the board until the next refresh
              i.c.next_move = F.att === "no_show" ? { code: "follow_up" } : F.dec === "follow_up" ? { code: "follow_up" } : { code: "done" };
              i.c.events = (i.c.events || []).concat([{ type: "outcome_" + (F.att === "no_show" ? "no_show" : F.dec), source: "crm", call_id: i.call.id, occurred_at: new Date().toISOString() }]);
              if (F.att === "no_show") i.call.status = "no_show"; else i.call.status = "held";
              i.c.last_sales_at = new Date().toISOString();
              if (F.dec === "no" || F.dec === "disqualified") i.c.status = F.dec === "no" ? "lost" : "disqualified";
            });
            say("Issue déclarée pour " + i.name);
          }, function (e) { S.busy = false; F.err = String((e && e.message) || e); render(); });
        }
      }
      box.addEventListener("click", function (e) {
        var b = e.target.closest("button"); if (!b) return;
        if (b.dataset.go) return goScreen(b.dataset.go);
        if (b.dataset.front) { S.front = b.dataset.front; S.form = {}; return render(); }
        if (b.dataset.unsnooze) { S.day.snoozed = S.day.snoozed.filter(function (x) { return x !== b.dataset.unsnooze; }); saveDay(); return render(); }
        if (b.dataset.att) { S.form.att = b.dataset.att; if (b.dataset.att === "no_show") S.form.dec = null; S.form.err = ""; return render(); }
        if (b.dataset.dec) { S.form.dec = b.dataset.dec; S.form.reason = ""; S.form.err = ""; return render(); }
        if (b.dataset.do === "reload") return load();
        if (b.dataset.do) return act(b.dataset.do);
      });
      box.addEventListener("input", function (e) {
        var id = e.target.id;
        if (id === "sdnote") S.form.note = e.target.value;
        if (id === "sdnext") S.form.next = e.target.value;
        if (id === "sdamount") S.form.amount = e.target.value;
      });
      box.addEventListener("change", function (e) {
        if (e.target.id === "sdreason") { S.form.reason = e.target.value; render(); }
        if (e.target.hasAttribute("data-who")) { S.who = e.target.value; S.front = null; S.form = {}; render(); }
      });
      // drag the card to the right (Done) or to the left (Skip); outcomes are declared with their buttons
      function swipe() {
        var el = root.getElementById("tc"); if (!el) return;
        var i = current(), x0 = null, dx = 0;
        el.addEventListener("pointerdown", function (e) { if (e.target.closest("button,input,select,textarea")) return; x0 = e.clientX; dx = 0; el.classList.add("drag"); el.setPointerCapture(e.pointerId); });
        el.addEventListener("pointermove", function (e) { if (x0 == null) return; dx = e.clientX - x0; el.style.transform = "translateX(" + dx + "px) rotate(" + dx / 30 + "deg)"; });
        var up = function () {
          if (x0 == null) return; x0 = null; el.classList.remove("drag"); el.style.transform = "";
          if (dx > 120 && i && i.kind !== "outcome") act("done");
          else if (dx < -120) act("skip");
        };
        el.addEventListener("pointerup", up); el.addEventListener("pointercancel", up);
      }
      load();
      return { render: render };
    }
  };
})();
