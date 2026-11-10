/* LNP › Ventes › Alertes (Romain 2026-11-09 : « je veux que ce soit l'application CRM qui soit la base des notifications » ;
   « les alertes sont reçues par les commerciaux selon les alertes qui concernent uniquement leurs leads, et les admins peuvent
   suivre toutes les alertes de tous les commerciaux »).
   Le serveur (sla-tick, toutes les 5 minutes) ouvre, fait monter et ferme les alertes (crm_sla_alerts, migration 053) ; ici :
   - LNP_ALERTS.store : les alertes ouvertes que la personne peut voir (crm_sla_alerts_open), rechargées en direct (Realtime) et
     chaque minute ; la pastille de la barre latérale, le bandeau « Nouvelle alerte » et, si la personne l'a accepté, une
     notification du navigateur pour une alerte critique ;
   - l'écran Alertes (module monté dans [data-alertes] par build.py) : critiques d'abord, puis en retard, puis bientôt dues ; un
     administrateur choisit un commercial ou toute l'équipe ; « Ouvrir la fiche » ouvre le prospect dans le CRM.
   Hors édition web : un exemple, rien n'est enregistré. */
(function () {
  "use strict";
  var MIN = 60e3, H = 3600e3;
  var LV = { crit: "Critique", late: "En retard", warn: "Bientôt dû" };
  var ORDER = ["crit", "late", "warn"];

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  // « 2 h 10 », « 35 min », « 3 j »
  function dur(ms) {
    ms = Math.max(0, ms);
    if (ms < H) return Math.max(1, Math.round(ms / MIN)) + " min";
    if (ms < 48 * H) { var h = Math.floor(ms / H), m = Math.round((ms - h * H) / MIN); return h + " h" + (m ? " " + String(m).padStart(2, "0") : ""); }
    return Math.round(ms / (24 * H)) + " j";
  }

  // un exemple pour le fichier seul (personnes fictives)
  function demo(now) {
    var iso = function (ms) { return new Date(ms).toISOString(); };
    var a = function (id, lv, sla, name, person, owner, ownerId, startedH, detail, target, kind) {
      return { id: id, cycle_id: "demo-" + id, person: person, owner: owner, owner_id: ownerId, sla: sla, kind: kind || "sales", level: lv, name: name,
        detail: detail, target: target, started_at: iso(now - startedH * H), crossed_at: iso(now - startedH * H / 2), opened_at: iso(now - startedH * H / 2) };
    };
    return { sees_all: true, closed_today: 4, alerts: [
      a("a1", "crit", "SH-2", "Premier contact du commercial", "Prospect fictif A", "Commercial fictif 1", "m1", 1.6, "depuis la prise de RDV", "5 min"),
      a("a2", "late", "SH-11", "Issue déclarée", "Prospect fictif B", "Commercial fictif 2", "m2", 1.2, "depuis la fin du R1", "15 min"),
      a("a3", "late", "DE-1", "Récap écrit après l’appel", "Prospect fictif C", "Commercial fictif 1", "m1", 3.5, "depuis la fin du R1", "60 min"),
      a("a4", "warn", "CO-1", "Réponse à un message du prospect", "Prospect fictif D", "Commercial fictif 2", "m2", 0.2, "depuis le message du prospect", "15 min dans la plage du commercial")] };
  }

  // ---------- les alertes de la personne, partagées par la pastille, le bandeau et l'écran ----------
  var store = (function () {
    var S = { live: false, loaded: false, data: { alerts: [], closed_today: 0, sees_all: false }, error: "", seen: null }, subs = [], timer = null, C = null;
    function emit() {
      subs.forEach(function (fn) { try { fn(); } catch (e) { console.error(e); } });
      try { window.dispatchEvent(new Event("lnp-alerts")); } catch (e) {}
    }
    function load() {
      if (!S.live) { S.data = demo(Date.now()); S.loaded = true; emit(); return Promise.resolve(); }
      return C.slaAlerts().then(function (d) {
        var fresh = [];
        var list = (d && d.alerts) || [];
        if (S.seen) list.forEach(function (x) { var k = x.id + ":" + x.level; if (!S.seen[k] && x.level !== "warn") fresh.push(x); });
        S.seen = {}; list.forEach(function (x) { S.seen[x.id + ":" + x.level] = 1; });
        S.data = { alerts: list, closed_today: (d && d.closed_today) || 0, sees_all: !!(d && d.sees_all) };
        S.loaded = true; S.error = "";
        emit();
        if (fresh.length) announce(fresh);
      }, function (e) { S.error = String((e && e.message) || e); S.loaded = true; emit(); });
    }
    var later = null;
    function soon() { clearTimeout(later); later = setTimeout(load, 1500); }
    function start() {
      C = window.LNP_CRM;
      Promise.resolve(C && C.ready()).then(function () {
        S.live = !!(C && C.mode() === "live");
        load();
        if (!S.live) return;
        if (C.onAlerts) C.onAlerts(soon);
        timer = setInterval(load, MIN);
        document.addEventListener("visibilitychange", function () { if (document.visibilityState === "visible") load(); });
      });
    }
    return {
      start: start, load: load, state: function () { return S; },
      on: function (fn) { subs.push(fn); return function () { subs = subs.filter(function (x) { return x !== fn; }); }; },
      count: function () { return S.data.alerts.length; },
      critical: function () { return S.data.alerts.filter(function (x) { return x.level === "crit"; }).length; }
    };
  })();

  // ---------- « Nouvelle alerte » : un bandeau dans la page, une notification du navigateur pour une critique ----------
  var bar = null;
  function open(cycleId) { try { window.postMessage({ lnp: "crm", lead: cycleId }, "*"); } catch (e) {} }
  function goAlerts() { try { window.postMessage({ lnp: "go", screen: "alertes" }, "*"); } catch (e) {} }
  function announce(list) {
    var x = list[0], more = list.length - 1;
    var txt = (list.length > 1 ? list.length + " nouvelles alertes · " : "Nouvelle alerte · ") + LV[x.level] + " · " + x.sla + " " + x.name + " · " + (x.person || "un prospect") + (more ? " (et " + more + " autre" + (more > 1 ? "s" : "") + ")" : "");
    if (!document.body) return;
    if (!bar) {
      bar = document.createElement("div");
      bar.setAttribute("role", "status");
      bar.setAttribute("data-lnp-alertbar", "");
      bar.style.cssText = "position:fixed;top:16px;right:16px;z-index:80;max-width:min(460px,calc(100vw - 32px));display:flex;gap:12px;align-items:center;background:#1B1B18;color:#F6F4EF;border-radius:12px;padding:12px 14px;font:14px/1.4 'IBM Plex Sans',system-ui,sans-serif;box-shadow:0 12px 32px rgba(0,0,0,.25)";
      document.body.appendChild(bar);
    }
    bar.innerHTML = '<span style="width:10px;height:10px;border-radius:50%;flex:none;background:' + (x.level === "crit" ? "#E5484D" : "#D9B46A") + '"></span><span style="flex:1"></span>' +
      '<button type="button" data-see style="font:inherit;font-weight:600;border:0;border-radius:8px;padding:6px 10px;background:#F6F4EF;color:#1B1B18;cursor:pointer">Voir</button>' +
      '<button type="button" data-x aria-label="Fermer" style="font:inherit;border:0;background:transparent;color:#F6F4EF;cursor:pointer;font-size:18px;line-height:1">×</button>';
    bar.children[1].textContent = txt;
    bar.querySelector("[data-see]").onclick = function () { bar.remove(); bar = null; goAlerts(); };
    bar.querySelector("[data-x]").onclick = function () { bar.remove(); bar = null; };
    clearTimeout(announce.t); announce.t = setTimeout(function () { if (bar) { bar.remove(); bar = null; } }, 15000);
    var crit = list.filter(function (y) { return y.level === "crit"; })[0];
    if (crit && "Notification" in window && Notification.permission === "granted" && document.visibilityState !== "visible") {
      try { var n = new Notification("LNP · Alerte critique", { body: crit.sla + " " + crit.name + " · " + (crit.person || "un prospect"), tag: "lnp-" + crit.id }); n.onclick = function () { window.focus(); open(crit.cycle_id); n.close(); }; } catch (e) {}
    }
  }

  var CSS = [
    ":host{all:initial;display:block;font:15px/1.5 'IBM Plex Sans',system-ui,sans-serif;color:#1B1B18;--line:#E3DFD5;--soft:#ECE8DF;--mut:#5E5B53;--crit:#B42318;--crits:#FDECEA;--late:#B4561E;--lates:#F8E9DE;--warn:#8A6417;--warns:#F4ECDD}",
    "*{box-sizing:border-box}button,select{font:inherit;color:inherit}",
    ".wrap{display:flex;flex-direction:column;gap:20px;max-width:1080px}",
    ".head{display:flex;gap:16px;align-items:flex-end;flex-wrap:wrap}.head h2{font-family:Fraunces,Georgia,serif;font-weight:500;font-size:30px;margin:0}",
    ".sub{color:var(--mut);font-size:14px;max-width:640px;margin:4px 0 0}.sp{flex:1}",
    ".sel{height:38px;border:1px solid #D8D3C7;border-radius:10px;background:#fff;padding:0 10px;font-size:14px}",
    ".btn{height:38px;border:1px solid #D8D3C7;border-radius:10px;background:#fff;padding:0 14px;font-size:14px;font-weight:600;cursor:pointer}",
    ".btn:focus-visible,.sel:focus-visible,.row button:focus-visible{outline:3px solid #9A6614;outline-offset:2px}",
    ".chips{display:flex;gap:10px;flex-wrap:wrap}",
    ".chip{display:flex;flex-direction:column;gap:2px;min-width:140px;background:#fff;border:1px solid var(--line);border-radius:12px;padding:12px 16px}",
    ".chip b{font-size:26px;font-weight:600;line-height:1.1}.chip span{font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--mut)}",
    ".chip.crit b{color:var(--crit)}.chip.late b{color:var(--late)}.chip.warn b{color:var(--warn)}",
    ".grp{display:flex;flex-direction:column;gap:8px}.grp h3{margin:6px 0 0;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--mut)}",
    ".row{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:14px;align-items:center;background:#fff;border:1px solid var(--line);border-radius:12px;padding:14px 16px}",
    ".row.crit{border-left:4px solid var(--crit)}.row.late{border-left:4px solid var(--late)}.row.warn{border-left:4px solid var(--warn)}",
    ".tag{font-size:11px;font-weight:700;letter-spacing:.04em;padding:3px 10px;border-radius:999px;white-space:nowrap}",
    ".tag.crit{background:var(--crits);color:var(--crit)}.tag.late{background:var(--lates);color:var(--late)}.tag.warn{background:var(--warns);color:var(--warn)}",
    ".what{display:flex;flex-direction:column;gap:2px;min-width:0}.what b{font-size:15px}.what .who{font-size:16px;font-weight:600}",
    ".meta{font-size:13px;color:var(--mut)}.code{font-family:'IBM Plex Mono',monospace;font-size:12.5px;font-weight:600;color:#3D3A33}",
    ".tech{font-size:11px;font-weight:700;color:#3D3A33;background:var(--soft);border-radius:999px;padding:2px 8px;margin-left:6px}",
    ".row button{height:36px;border:1px solid #1B1B18;border-radius:10px;background:#1B1B18;color:#F6F4EF;padding:0 14px;font-size:14px;font-weight:600;cursor:pointer;white-space:nowrap}",
    ".empty{background:#fff;border:1px solid var(--line);border-radius:12px;padding:28px;text-align:center;color:var(--mut)}",
    ".note{font-size:13px;color:var(--mut)}.err{color:var(--crit);font-size:14px}",
    "@media (max-width:760px){.row{grid-template-columns:1fr}.row button{justify-self:start}}"
  ].join("\n");

  window.LNP_ALERTS = {
    store: store,
    css: CSS,
    html: '<div id="al" class="wrap"><div class="note">Chargement des alertes…</div></div>',
    mount: function (root, tip, toast) {
      var box = root.getElementById("al"), who = "all";
      function say(m) { if (!toast) return; toast.textContent = m; toast.style.opacity = 1; clearTimeout(say.t); say.t = setTimeout(function () { toast.style.opacity = 0; }, 2400); }
      function render() {
        var S = store.state(), D = S.data, all = D.sees_all, now = Date.now();
        if (!S.loaded) { box.innerHTML = '<div class="note">Chargement des alertes…</div>'; return; }
        var owners = {};
        D.alerts.forEach(function (x) { owners[x.owner_id || "none"] = x.owner || "Sans commercial attitré"; });
        if (who !== "all" && !owners[who]) who = "all";
        var list = D.alerts.filter(function (x) { return who === "all" || (x.owner_id || "none") === who; });
        var n = { crit: 0, late: 0, warn: 0 }; list.forEach(function (x) { n[x.level]++; });
        var h = '<div class="head"><div><h2>Alertes</h2><p class="sub">' + (all
          ? "Les retards de tous les prospects de l’équipe, du plus urgent au moins urgent. Une alerte se ferme seule dès que l’action est faite."
          : "Les retards de vos prospects, du plus urgent au moins urgent. Une alerte se ferme seule dès que l’action est faite.") + '</p></div><div class="sp"></div>';
        if (all) {
          h += '<label class="note" style="display:flex;flex-direction:column;gap:4px">Commercial<select class="sel" data-who><option value="all">Toute l’équipe</option>';
          Object.keys(owners).sort(function (a, b) { return owners[a].localeCompare(owners[b], "fr"); }).forEach(function (k) {
            h += '<option value="' + esc(k) + '"' + (k === who ? " selected" : "") + '>' + esc(owners[k]) + '</option>';
          });
          h += '</select></label>';
        }
        if ("Notification" in window && Notification.permission === "default") h += '<button type="button" class="btn" data-notif>Être prévenu des alertes critiques</button>';
        h += '</div>';
        h += '<div class="chips">' + ORDER.map(function (k) { return '<div class="chip ' + k + '"><b>' + n[k] + '</b><span>' + LV[k] + '</span></div>'; }).join("") +
          '<div class="chip"><b>' + (D.closed_today || 0) + '</b><span>Fermées aujourd’hui</span></div></div>';
        if (S.error) h += '<div class="err">Les alertes n’ont pas pu être chargées : ' + esc(S.error) + '</div>';
        if (!list.length) h += '<div class="empty">Aucune alerte ouverte. Tout est dans les temps.</div>';
        ORDER.forEach(function (k) {
          var rows = list.filter(function (x) { return x.level === k; });
          if (!rows.length) return;
          h += '<section class="grp" aria-label="' + LV[k] + '"><h3>' + LV[k] + ' · ' + rows.length + '</h3>';
          rows.forEach(function (x) {
            var since = x.started_at ? dur(now - Date.parse(x.started_at)) : "";
            h += '<div class="row ' + k + '"><span class="tag ' + k + '">' + LV[k] + '</span><div class="what">' +
              '<span class="who">' + esc(x.person || "Prospect sans nom") + (x.kind === "tech" ? '<span class="tech">Technique</span>' : "") + '</span>' +
              '<b><span class="code">' + esc(x.sla) + '</span> · ' + esc(x.name) + '</b>' +
              '<span class="meta">' + esc(since ? since + " " + (x.detail || "") : x.detail || "") + (x.target ? " · objectif " + esc(x.target) : "") +
              (all ? " · " + esc(x.owner || "sans commercial attitré") : "") + '</span></div>' +
              (x.kind === "tech" ? "<span></span>" : '<button type="button" data-open="' + esc(x.cycle_id) + '">Ouvrir la fiche</button>') + '</div>';
          });
          h += '</section>';
        });
        if (!S.live) h += '<p class="note">Exemple : hors de l’édition web, ces alertes sont fictives.</p>';
        box.innerHTML = h;
      }
      box.addEventListener("change", function (e) { if (e.target.matches("[data-who]")) { who = e.target.value; render(); } });
      box.addEventListener("click", function (e) {
        var b = e.target.closest("button"); if (!b) return;
        if (b.hasAttribute("data-open")) { if (!store.state().live) { say("Exemple : la fiche s’ouvre dans l’édition web."); return; } open(b.getAttribute("data-open")); return; }
        if (b.hasAttribute("data-notif")) {
          Notification.requestPermission().then(function (p) { say(p === "granted" ? "Vous serez prévenu des alertes critiques tant que LNP est ouvert." : "Notifications refusées : les alertes restent dans cet écran."); render(); });
        }
      });
      store.on(render);
      render();
      return { render: render };
    }
  };
  store.start();
})();
