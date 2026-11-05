/* LNP CRM — the sales cycle of one lead as a vertical feed, and its « À faire » card (Romain, 2026-11-05: the lead record and
   Ma journée take the approach of the reference screenshots, in LNP's own design).
   window.SKL_LEADFEED.feed(lead, opts) → html: « Cycle de vente · N événements · depuis le … », filters Tous · Appels ·
   Messages · Paiements (E-mails only when there are some), then the events by day, oldest first: what it is, who (Prospect,
   Commercial, Automatique), the message status, the time and the text. lead = a lead of SKL_CRM.salesCycleView (opened, age,
   ev: [{t (hours since the cycle opened), w: s | p | a, k, r, txt, st}]). opts.max = the height of the scrolling list
   (px), opts.newest = scroll to the latest event, opts.calls = false leaves out the « Appels » filter.
   window.SKL_LEADFEED.todo(lead, opts) → html: what the sales rep must do now (an outcome to declare, a call to prepare, a
   reschedule, a follow-up…) with its action: the outcome form (window.sklOutcome) or « Qu'avez-vous fait ? » saved as a note
   on the lead (window.sklCrmNote). opts.ro = read only. window.SKL_LEADFEED.css: the styles (also for a shadow root).
   The filters work with no script of the page: the buttons set data-f on the feed, the styles do the rest. */
(function () {
  "use strict";
  var H = 3600e3;
  var CSS = [
    ".lf{display:flex;flex-direction:column;min-height:0;font-family:'IBM Plex Sans',system-ui,sans-serif;color:#1B1B18}",
    ".lf-hd{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}.lf-hd h3{margin:0;font:500 20px Fraunces,Georgia,serif}",
    ".lf-hd span{font-size:13px;color:#5E5B53}",
    ".lf-fl{display:flex;gap:6px;flex-wrap:wrap;margin:12px 0 4px;padding-bottom:12px;border-bottom:1px solid #ECE8DF}",
    ".lf-fl button{font:inherit;font-size:13px;font-weight:600;min-height:32px;padding:0 13px;border-radius:999px;border:1px solid #D8D3C7;background:#fff;color:#3D3A33;cursor:pointer}",
    ".lf-fl button[aria-pressed=true]{background:#1B1B18;border-color:#1B1B18;color:#fff}",
    ".lf-ls{overflow:auto;padding:4px 4px 8px 0;display:flex;flex-direction:column}",
    ".lf-day{display:flex;flex-direction:column}",
    ".lf-dh{font-size:11.5px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#3D3A33;margin:16px 0 8px 30px}",
    ".lf-it{position:relative;padding:0 0 10px 30px}",
    ".lf-it::before{content:'';position:absolute;left:9px;top:0;bottom:0;width:2px;background:#ECE8DF}",
    ".lf-dh+.lf-it::before{top:16px}.lf-day .lf-it:last-child::before{bottom:calc(100% - 16px)}",
    ".lf-it>i{position:absolute;left:3px;top:12px;width:14px;height:14px;border-radius:50%;border:2px solid #fff;box-shadow:0 0 0 1px #D8D3C7;background:#8E8A80}",
    ".lf-it[data-w=p]>i{background:#2D5C9C}.lf-it[data-w=s]>i{background:#9A6614}.lf-it.due>i{background:#B4561E}.lf-it.ok>i{background:#2F7D4F}.lf-it.fut>i{background:#fff;box-shadow:0 0 0 2px #2D5C9C}",
    ".lf-c{border:1px solid #E3DFD5;border-radius:12px;background:#fff;padding:10px 14px;display:flex;flex-direction:column;gap:4px}",
    ".lf-it[data-w=p] .lf-c{background:#FAF8F3}.lf-it.due .lf-c{border-color:#E8C9AE;background:#FDF6EF}",
    ".lf-t{display:flex;align-items:baseline;gap:8px;font-size:12.5px;color:#5E5B53}.lf-t b{font-size:14px;color:#1B1B18;font-weight:600}",
    ".lf-t time{margin-left:auto;font-family:'IBM Plex Mono',monospace;font-size:12px;color:#5E5B53;white-space:nowrap}",
    ".lf-x{font-size:14px;line-height:1.5;color:#1B1B18;white-space:pre-wrap;overflow-wrap:anywhere}",
    ".lf-em{font-size:13.5px;color:#5E5B53;padding:18px 0}",
    ".lf[data-f=calls] .lf-it:not([data-g=calls]),.lf[data-f=msgs] .lf-it:not([data-g=msgs]),.lf[data-f=mails] .lf-it:not([data-g=mails]),.lf[data-f=pay] .lf-it:not([data-g=pay]){display:none}",
    ".lf[data-f=calls] .lf-day:not(:has(.lf-it[data-g=calls])),.lf[data-f=msgs] .lf-day:not(:has(.lf-it[data-g=msgs])),.lf[data-f=mails] .lf-day:not(:has(.lf-it[data-g=mails])),.lf[data-f=pay] .lf-day:not(:has(.lf-it[data-g=pay])){display:none}",
    // the « À faire » card
    ".lt{border:1px solid #E3DFD5;border-left:4px solid var(--k,#1B1B18);border-radius:14px;background:#fff;padding:16px 18px;display:flex;flex-direction:column;gap:12px;font-family:'IBM Plex Sans',system-ui,sans-serif;color:#1B1B18}",
    ".lt-h{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.lt-h .tg{font-size:11.5px;font-weight:700;color:#fff;background:var(--k,#1B1B18);border-radius:999px;padding:3px 10px}",
    ".lt-h b{font-size:16px}.lt-h span{font-size:13px;color:#5E5B53}",
    ".lt-r{display:flex;gap:8px;align-items:center;flex-wrap:wrap}",
    ".lt-r input{flex:1;min-width:200px;font:inherit;font-size:14px;padding:10px 12px;border:1px solid #D8D3C7;border-radius:10px;background:#fff;color:#1B1B18}",
    ".lt-b{font:inherit;font-size:14px;font-weight:600;border:0;border-radius:10px;padding:10px 16px;cursor:pointer;background:#1B1B18;color:#D9B46A}",
    ".lt-b:disabled{background:#D8D3C7;color:#5E5B53;cursor:default}",
    ".lt-m{font-size:13px;color:#5E5B53}"
  ].join("");

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function css() { if (document.getElementById("lf-css")) return; var s = document.createElement("style"); s.id = "lf-css"; s.textContent = CSS; document.head.appendChild(s); }
  function at(l, t) { return new Date(Date.parse(l.opened) + t * H); }
  function dayKey(d) { return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate(); }
  function hm(d) { return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); }
  function dayLbl(d) { return d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: d.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined }); }
  var WHO = { p: "Prospect", s: "Commercial", a: "Automatique" };
  // message statuses as Sendblue sends them, in French
  var ST = { delivered: "Distribué", sent: "Envoyé", read: "Lu", failed: "Échec de l’envoi", error: "Échec de l’envoi", queued: "En attente", received: "Reçu", undelivered: "Non distribué" };

  // what one event of the lead model reads as: [group, title, who, extra class]
  function kind(e, l) {
    var fut = e.t > l.age, r = "R" + (e.r || 1);
    switch (e.k) {
      case "booked": return ["calls", "Rendez-vous", WHO.p, ""];
      case "meet": return ["calls", fut ? "Appel prévu" : "Appel tenu", fut ? r : WHO.s, fut ? "fut" : "ok"];
      case "meetdue": return ["calls", "Appel · issue à déclarer", WHO.s, "due"];
      case "noshow": return ["calls", "Absence", WHO.p, "due"];
      case "decision": return ["calls", "Issue déclarée", WHO.s, e.yes ? "ok" : ""];
      case "call": return ["calls", e.w === "p" ? "Appel téléphonique entrant" : "Appel téléphonique", WHO[e.w] || "", ""];
      case "im": return ["msgs", "iMessage", WHO[e.w] || "", ""];
      case "sms": return ["msgs", "SMS", WHO[e.w] || "", ""];
      case "email": return ["mails", "E-mail", WHO[e.w] || "", ""];
      case "remind": return ["msgs", "Message automatique", WHO.a, ""];
      case "paylink": return ["pay", "Lien de paiement", WHO.s, ""];
      case "paid": return ["pay", "Paiement", WHO.p, "ok"];
      default: return ["sys", e.stop ? "STOP" : "Note", WHO[e.w] || "", ""];
    }
  }

  function feed(l, opts) {
    opts = opts || {};
    css();
    if (!l) return '<div class="lf"><div class="lf-em">Pas encore de cycle de vente : ce contact n’a jamais réservé d’appel.</div></div>';
    var ev = (l.ev || []).slice().sort(function (a, b) { return a.t - b.t; });
    var since = at(l, 0).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
    var groups = {}, days = [], has = {};
    ev.forEach(function (e, i) {
      var d = at(l, e.t), k = dayKey(d), K = kind(e, l);
      has[K[0]] = 1;
      if (!groups[k]) { groups[k] = { d: d, items: [] }; days.push(k); }
      var meta = [K[2], ST[String(e.st || "").toLowerCase()] || e.st].filter(Boolean).join(" · ");
      var txt = String(e.txt || "").replace(/^Issue déclarée · /, "");
      groups[k].items.push('<div class="lf-it' + (K[3] ? " " + K[3] : "") + '" data-g="' + K[0] + '" data-w="' + esc(e.w || "a") + '"' + (i === ev.length - 1 ? ' data-last="1"' : "") + '><i></i>'
        + '<div class="lf-c"><div class="lf-t"><b>' + esc(K[1]) + "</b>" + (meta ? "<span>" + esc(meta) + "</span>" : "") + "<time>" + hm(d) + "</time></div>"
        + (txt ? '<div class="lf-x">' + esc(txt) + "</div>" : "") + "</div></div>");
    });
    // opts.calls === false: no « Appels » filter (the lead record lists the sales calls and their analysis on the right)
    var F = [["all", "Tous"]].concat(opts.calls === false ? [] : [["calls", "Appels"]]).concat([["msgs", "Messages"]]).concat(has.mails ? [["mails", "E-mails"]] : []).concat([["pay", "Paiements"]]);
    var pick = "var r=this.closest('.lf');r.dataset.f=this.dataset.lff;r.querySelectorAll('[data-lff]').forEach(function(b){b.setAttribute('aria-pressed',String(b.dataset.lff===r.dataset.f))})";
    var list = days.map(function (k) {
      return '<div class="lf-day"><div class="lf-dh">' + esc(dayLbl(groups[k].d)) + "</div>" + groups[k].items.join("") + "</div>";
    }).join("") || '<div class="lf-em">Aucun événement pour l’instant.</div>';
    var n = ev.length;
    return '<div class="lf" data-f="all"><div class="lf-hd"><h3>Cycle de vente</h3><span>' + n + " événement" + (n > 1 ? "s" : "") + " · depuis le " + esc(since) + "</span></div>"
      + '<div class="lf-fl" role="group" aria-label="Filtrer le cycle de vente">' + F.map(function (f) {
        return '<button type="button" data-lff="' + f[0] + '" aria-pressed="' + (f[0] === "all") + '" onclick="' + pick + '">' + f[1] + "</button>";
      }).join("") + "</div>"
      + '<div class="lf-ls"' + (opts.max ? ' style="max-height:' + opts.max + 'px"' : "") + (opts.newest ? ' data-newest="1"' : "") + ">" + list + "</div></div>";
  }
  // scroll each feed marked « newest » to its latest event (call after the html is in the page)
  function settle(root) {
    (root || document).querySelectorAll(".lf-ls[data-newest]").forEach(function (x) { x.scrollTop = x.scrollHeight; });
  }

  // ---- « À faire »: what the sales rep does now, from the lead model (the same signals as the Sales cycle and Ma journée)
  function todo(l, opts) {
    opts = opts || {};
    css();
    if (!l) return "";
    var ev = l.ev || [], due = ev.filter(function (e) { return e.k === "meetdue" && e.cid; })[0];
    var ahead = ev.filter(function (e) { return e.k === "meet" && e.t > l.age; })[0];
    var closed = ev.filter(function (e) { return e.t <= l.age && (e.k === "paid" || (e.k === "decision" && e.no)); }).pop();
    var card = function (k, tag, title, sub, body) {
      return '<div class="lt" style="--k:' + k + '" data-lt="' + esc(l.id) + '"><div class="lt-h"><span class="tg">' + esc(tag) + "</span><b>" + esc(title) + "</b>"
        + (sub ? "<span>" + esc(sub) + "</span>" : "") + "</div>" + (body || "") + "</div>";
    };
    var note = function (ph) {
      return opts.ro ? '<div class="lt-m">Lecture seule.</div>' : '<div class="lt-r"><input data-ltn placeholder="' + esc(ph || "Qu’avez-vous fait ? (enregistré en note sur le prospect)") + '" aria-label="Ce que vous avez fait">'
        + '<button class="lt-b" type="button" data-ltdone="' + esc(l.id) + '">Fait</button></div>';
    };
    if (closed) {
      var paid = closed.k === "paid";
      return card(paid ? "#2F7D4F" : "#8E8A80", paid ? "Gagné" : "Clos", paid ? "Vente encaissée" : "Prospect clos",
        paid ? "" : (closed.txt || "").replace(/^Issue déclarée · /, ""), paid ? "" : '<div class="lt-m">Pour le remettre dans le pipeline, glissez-le dans une autre colonne ou changez son statut.</div>');
    }
    if (due) {
      var d = at(l, due.t);
      return card("#B42318", "Issue à déclarer", "Déclarer l’issue du R" + (due.r || 1),
        "appel du " + d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) + " à " + hm(d) + ", rien n’est déclaré",
        opts.ro ? "" : '<div class="lt-r"><button class="lt-b" type="button" data-ltout="' + esc(l.id) + '">Déclarer l’issue</button></div>');
    }
    if (ahead) {
      var a = at(l, ahead.t), soon = ahead.t - l.age < 24;
      return card("#2D5C9C", soon ? "Appel aujourd’hui" : "Appel à venir", "Préparer le R" + (ahead.r || 1),
        a.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" }) + " à " + hm(a), note("Préparation faite ? (enregistré en note sur le prospect)"));
    }
    var nx = l.nx;
    if (nx && nx.txt) return card("#6B4FA0", /plan|rendez/i.test(nx.txt) ? "À replanifier" : "Relance", nx.txt, nx.src || "", note());
    var ns = ev.filter(function (e) { return e.k === "noshow" && e.t <= l.age; }).pop();
    if (ns) return card("#6B4FA0", "Absent", "Reprendre contact après l’absence au R" + (ns.r || 1), "", note());
    if (!ev.some(function (e) { return e.k === "booked"; })) return card("#8E8A80", "Nouveau", "Obtenir un premier rendez-vous", "", note());
    return card("#9A6614", "Relance", "Relancer le prospect", "", note());
  }
  // the clicks of a « À faire » card: the outcome form, or the note of « Fait »; root = the document or a shadow root
  function bind(root, after) {
    if (!root || root.__lt) return; root.__lt = true;
    root.addEventListener("click", function (e) {
      var o = e.target.closest && e.target.closest("[data-ltout]");
      if (o) { if (window.sklOutcome && !window.sklOutcome.open(o.dataset.ltout) && typeof window.toast === "function") window.toast("Aucun appel passé sans issue pour ce prospect."); return; }
      var b = e.target.closest && e.target.closest("[data-ltdone]");
      if (!b) return;
      var box = b.closest(".lt"), inp = box && box.querySelector("[data-ltn]"), txt = inp ? inp.value.trim() : "";
      var msg = function (m) { if (typeof window.toast === "function") window.toast(m); };
      if (!txt) { if (inp) inp.focus(); return msg("Écrivez en une ligne ce que vous avez fait."); }
      if (typeof window.sklCrmNote !== "function") return msg("Rien n’est enregistré dans la démo.");
      b.disabled = true; b.textContent = "Enregistrement…";
      window.sklCrmNote(b.dataset.ltdone, txt).then(function () { msg("Note enregistrée sur le prospect"); if (after) after(); },
        function (err) { b.disabled = false; b.textContent = "Fait"; msg("Non enregistré : " + String(err && err.message || err)); });
    });
  }
  window.SKL_LEADFEED = { css: CSS, feed: feed, todo: todo, bind: bind, settle: settle };
})();
