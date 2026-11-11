/* LNP CRM › Prospects : le suivi du setter (Romain 2026-11-09, migration 054). Chaque lead a un statut setter (gardé sur la
   personne) : l'écran Prospects montre l'étape, la dernière action, l'action actuelle et son échéance, avec un filtre ; la fiche
   du prospect a un panneau « Setting » avec les actions du statut (une action = crm_setter_action, inscrite dans le fil) et,
   pour un administrateur, le choix du setter. « + Nouveau prospect » crée un lead à la main (crm_create_lead).
   Les actions passent par l'objet CRM donné à lnpCrmLive (window.lnpCrmC) ; hors édition web, rien ne s'affiche. */
(function () {
  "use strict";
  var H = 3600e3;
  // the status labels (the same as LNP_SLA.SETTING of sla_rules.js, which this document does not always load)
  var LBL = { a_contacter: "Lead à contacter", relance: "Relance", qualification: "Appel de qualification", rdv_a_confirmer: "RDV à confirmer",
    appel_confirmation: "Appel de confirmation", rdv_pose: "RDV posé · OK attendu", rdv_confirme: "RDV confirmé", reconfirmation: "Re-confirmation",
    a_replanifier: "À replanifier", absent_rattrapage: "Absent · rattrapage", webinaire_absent: "Webinaire absent · attente de réponse", absent_attente: "Absent · attente de réponse", transmis: "RDV tenu · au commercial", injoignable: "Injoignable · nurture",
    non_qualifie: "Non qualifié · nurture" };
  // ce qu'il faut faire maintenant, par statut, et les actions proposées (dans l'ordre des boutons)
  var NOW = {
    a_contacter: ["Appeler en moins de 5 min ; pas de réponse : message de relance WhatsApp", ["appel_sans_reponse", "joint", "msg_relance", "rdv_pose", "non_qualifie", "injoignable"]],
    relance: ["Tentative suivante à l’heure de la cadence", ["appel_sans_reponse", "joint", "msg_relance", "rdv_pose", "injoignable"]],
    qualification: ["Trier en 4 points et poser le RDV en direct", ["rdv_pose", "non_qualifie"]],
    rdv_a_confirmer: ["Envoyer le message de confirmation", ["msg_confirmation", "confirmation_faite", "ok_recu", "appel_sans_reponse", "non_qualifie", "annule"]],
    appel_confirmation: ["Appeler dans l’heure : valider le créneau, pré-qualifier", ["confirmation_faite", "ok_recu", "appel_sans_reponse", "non_qualifie", "annule"]],
    rdv_pose: ["Envoyer le récap et attendre le « OK »", ["msg_confirmation", "ok_recu", "rappel_j1", "sans_ok_j1", "annule"]],
    rdv_confirme: ["Rappel J−1 puis H−2", ["rappel_j1", "rappel_h2", "sans_ok_j1", "annule"]],
    reconfirmation: ["Appeler le jour même pour re-confirmer", ["confirmation_faite", "ok_recu", "appel_sans_reponse", "annule"]],
    a_replanifier: ["Reposer le RDV en direct, le jour même", ["rdv_pose", "appel_sans_reponse", "non_qualifie"]],
    absent_rattrapage: ["Appeler dans les 15 min et re-booker", ["rdv_pose", "appel_sans_reponse"]],
    webinaire_absent: ["Rien pour l’instant : sans réponse du prospect en 48 h, le lead passe au setter", []],
    absent_attente: ["Le commercial relance : sans réponse en 24 h, le setter rattrape", []],
    transmis: ["Au commercial", []],
    injoignable: ["En nurture", ["relancer"]],
    non_qualifie: ["En nurture", ["relancer"]]
  };
  var ACT = { appel_sans_reponse: "Appel sans réponse", joint: "Joint au téléphone", msg_relance: "Message de relance envoyé", rdv_pose: "RDV posé dans iClosed",
    non_qualifie: "Non qualifié", injoignable: "Classer injoignable", msg_confirmation: "Message de confirmation envoyé", confirmation_faite: "Appel de confirmation fait",
    ok_recu: "« OK » reçu", rappel_j1: "Rappel J−1 envoyé", rappel_h2: "Rappel H−2 envoyé", sans_ok_j1: "Pas de « OK » à J−1", annule: "RDV annulé ou déplacé",
    relancer: "Reprendre le lead" };
  var SRC = { quiz: "Quiz complété", vsl: "Opt-in VSL", quiz_abandon: "Quiz abandonné", webinaire: "Webinaire", manuel: "Saisi à la main", iclosed: "iClosed" };
  var GRP = { a_contacter: "go", relance: "go", qualification: "go", rdv_a_confirmer: "rdv", appel_confirmation: "rdv", rdv_pose: "rdv", rdv_confirme: "ok",
    reconfirmation: "rdv", a_replanifier: "go", absent_rattrapage: "go", webinaire_absent: "off", absent_attente: "off", transmis: "ok", injoignable: "off", non_qualifie: "off" };
  var MAXA = { quiz_abandon: 2 };

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function label(st, l) { var s = LBL[st] || st; if (st === "relance") s += " " + (l && l.set ? l.set.tries : 0) + " / " + (MAXA[l && l.set && l.set.src] || 6); return s; }
  function dur(ms) { ms = Math.abs(ms); return ms < H ? Math.max(1, Math.round(ms / 6e4)) + " min" : ms < 48 * H ? Math.round(ms / H) + " h" : Math.round(ms / 864e5) + " j"; }
  function ctx() { return window.LNP_SETCTX || { me: {}, members: [] }; }
  function memberName(id) { var m = (ctx().members || []).filter(function (x) { return x.id === id; })[0]; return m ? m.full_name : ""; }
  function late(l) { return !!(l.set && l.set.due && l.set.due < Date.now()); }

  // ce que la ligne d'un prospect lit de sa personne (toLead / toNoBooking de gen_crm.py)
  window.lnpSetOf = function (p) {
    if (!p || !p.id) return null;
    var t = function (v) { return v ? Date.parse(v) : null; };
    return { pid: p.id, st: p.setting_status || null, since: t(p.setting_since), last: p.setting_last_action || "", lastAt: t(p.setting_last_at),
      due: t(p.setting_due_at), tries: p.setting_attempts || 0, setter: p.setter_id || null, src: p.lead_source || null, quiz: p.quiz || null };
  };

  // ---------- les trois colonnes de l'écran Prospects ----------
  window.lnpSetCell = function (l) {
    var s = l.set; if (!s || !s.st) return '<span class="mut">—</span>';
    return '<span class="lnps-chip ' + (GRP[s.st] || "go") + '">' + esc(label(s.st, l)) + '</span>' +
      (s.setter ? '<div class="cx-em">' + esc(memberName(s.setter)) + '</div>' : '<div class="cx-em">Sans setter</div>');
  };
  window.lnpSetLast = function (l) {
    var s = l.set; if (!s || !s.last) return '<span class="mut">—</span>';
    return esc(s.last) + (s.lastAt ? '<div class="cx-em">il y a ' + dur(Date.now() - s.lastAt) + '</div>' : "");
  };
  window.lnpSetNow = function (l) {
    var s = l.set; if (!s || !s.st || !NOW[s.st]) return '<span class="mut">—</span>';
    var due = s.due ? (s.due < Date.now() ? '<div class="lnps-late">En retard de ' + dur(Date.now() - s.due) + '</div>' : '<div class="cx-em">avant ' + new Date(s.due).toLocaleString("fr-FR", { weekday: "short", hour: "2-digit", minute: "2-digit" }) + '</div>') : "";
    return esc(NOW[s.st][0]) + due;
  };
  // le filtre « Étape setter »
  window.lnpSetFilter = function (v) {
    var o = '<option value="all">Toutes les étapes setter</option><option value="late"' + (v === "late" ? " selected" : "") + '>En retard</option>' +
      Object.keys(NOW).map(function (k) { return '<option value="' + k + '"' + (v === k ? " selected" : "") + '>' + esc(LBL[k] || k) + '</option>'; }).join("") +
      '<option value="none"' + (v === "none" ? " selected" : "") + '>Sans étape setter</option>';
    return '<select class="sel" id="cxSetf" data-act="lnpsetf" aria-label="Étape setter">' + o + '</select>';
  };
  window.lnpSetMatch = function (l, v) {
    if (!v || v === "all") return true;
    var st = l.set && l.set.st;
    if (v === "none") return !st;
    if (v === "late") return late(l);
    return st === v;
  };

  // ---------- le panneau « Setting » de la fiche du prospect ----------
  window.lnpSetPanel = function (l) {
    var s = l.set; if (!s || !window.lnpCrmC) return "";
    var me = ctx().me || {}, admin = me.role === "admin", st = s.st;
    var acts = st && NOW[st] ? NOW[st][1] : ["joint"];
    var btns = (st ? acts : []).map(function (a) { return '<button class="btn sm' + (a === acts[0] ? " gold" : "") + '" data-lnpset="' + a + '">' + esc(ACT[a]) + '</button>'; }).join("");
    if (!st) btns = '<button class="btn sm gold" data-lnpset="start">Suivre ce lead (à contacter)</button>';
    var setters = (ctx().members || []).filter(function (m) { return m.active !== false && (m.role === "setter" || m.id === s.setter); });
    var who = admin ? '<label class="lnps-k">Setter <select class="sel" data-lnpsetter="1"><option value="">Sans setter</option>' +
      setters.map(function (m) { return '<option value="' + esc(m.id) + '"' + (m.id === s.setter ? " selected" : "") + '>' + esc(m.full_name) + '</option>'; }).join("") + '</select></label>'
      : '<span class="lnps-k">Setter : <b>' + esc(memberName(s.setter) || "aucun") + '</b></span>';
    var quiz = s.quiz && typeof s.quiz === "object" ? Object.keys(s.quiz).slice(0, 12).map(function (k) { return '<li><b>' + esc(k) + '</b> : ' + esc(typeof s.quiz[k] === "object" ? JSON.stringify(s.quiz[k]) : s.quiz[k]) + '</li>'; }).join("") : "";
    return '<section class="lnps" aria-label="Setting"><div class="lnps-h"><span class="eyebrow">Setting</span>' + (st ? window.lnpSetCell(l) : '<span class="mut">Pas encore suivi par un setter</span>') + '</div>' +
      '<div class="lnps-g"><div><span class="lnps-k">Dernière action</span>' + window.lnpSetLast(l) + '</div><div><span class="lnps-k">Action actuelle</span>' + window.lnpSetNow(l) + '</div>' +
      '<div><span class="lnps-k">Source</span>' + esc(SRC[s.src] || s.src || "—") + (s.tries ? '<div class="cx-em">' + s.tries + ' appel' + (s.tries > 1 ? "s" : "") + ' sans réponse</div>' : "") + '</div><div>' + who + '</div></div>' +
      (quiz ? '<details class="lnps-q"><summary>Réponses du quiz</summary><ul>' + quiz + '</ul></details>' : "") +
      '<div class="lnps-a">' + btns + '</div><div class="lnps-n"><input class="cx-in" id="lnpsNote" placeholder="Une note avec l’action (facultatif)" aria-label="Note pour le setting"><button class="btn sm" data-lnpset="note">Ajouter la note</button></div>' +
      '<div class="lnps-msg" role="status"></div></section>';
  };

  function toast(m) { var el = document.querySelector(".lnps-msg"); if (el) el.textContent = m; }
  function reload() { return window.lnpCrmReload ? window.lnpCrmReload() : Promise.resolve(); }
  function leadOf() { try { return typeof S !== "undefined" && S.cx && S.cx.lead && typeof byD === "function" ? byD(S.cx.lead.id) : null; } catch (e) { return null; } }

  document.addEventListener("click", function (e) {
    var b = e.target.closest ? e.target.closest("[data-lnpset]") : null;
    if (!b || !window.lnpCrmC) return;
    e.preventDefault(); e.stopPropagation();
    var l = leadOf(); if (!l || !l.set) return;
    var a = b.getAttribute("data-lnpset"), note = (document.getElementById("lnpsNote") || {}).value || "";
    if (a === "start") a = "relancer";
    if (a === "note" && !note.trim()) { toast("Écrivez la note d’abord."); return; }
    b.disabled = true; toast("Enregistrement…");
    Promise.resolve(window.lnpCrmC.setterAction(l.set.pid, a, note.trim() || null)).then(function () { return reload(); })
      .then(function () { toast("Enregistré : " + (ACT[a] || "note")); if (typeof renderLead === "function") renderLead(); })
      .catch(function (err) { b.disabled = false; toast("Non enregistré : " + ((err && err.message) || err)); });
  }, true);
  document.addEventListener("change", function (e) {
    var t = e.target;
    if (t && t.getAttribute && t.getAttribute("data-lnpsetter") && window.lnpCrmC) {
      var l = leadOf(); if (!l || !l.set) return;
      Promise.resolve(window.lnpCrmC.setSetter(l.set.pid, t.value || null)).then(reload).then(function () { if (typeof renderLead === "function") renderLead(); })
        .catch(function (err) { toast("Non enregistré : " + ((err && err.message) || err)); });
    }
    if (t && t.id === "cxSetf" && typeof S !== "undefined") { S.cx.setf = t.value; if (typeof renderCRM === "function") renderCRM(); }
  }, true);

  // ---------- « + Nouveau prospect » : un lead saisi à la main ----------
  window.lnpNewLead = function () {
    if (!window.lnpCrmC || !window.lnpCrmC.createLead) return false;
    var bg = document.createElement("div");
    bg.className = "lnps-dlg";
    bg.innerHTML = '<form role="dialog" aria-modal="true" aria-labelledby="lnpsT"><h3 id="lnpsT">Nouveau prospect</h3>' +
      '<label>Nom<input class="cx-in" name="n" autocomplete="off"></label><label>E-mail<input class="cx-in" name="e" type="email" autocomplete="off"></label>' +
      '<label>Téléphone<input class="cx-in" name="t" type="tel" placeholder="06 12 34 56 78" autocomplete="off"></label>' +
      '<label>Source<select class="sel" name="s"><option value="manuel">Saisi à la main</option><option value="quiz">Quiz complété</option><option value="vsl">Opt-in VSL</option>' +
      '<option value="quiz_abandon">Quiz abandonné</option><option value="webinaire">Webinaire</option></select></label>' +
      '<p class="lnps-msg" role="status"></p><div class="lnps-a"><button type="button" class="btn" data-x>Annuler</button><button type="submit" class="btn gold">Créer le lead</button></div></form>';
    document.body.appendChild(bg);
    var f = bg.querySelector("form"), close = function () { bg.remove(); };
    bg.querySelector("[data-x]").onclick = close;
    bg.addEventListener("keydown", function (e) { if (e.key === "Escape") close(); });
    f.n.focus();
    f.addEventListener("submit", function (e) {
      e.preventDefault();
      var msg = f.querySelector(".lnps-msg");
      msg.textContent = "Création…";
      Promise.resolve(window.lnpCrmC.createLead(f.n.value, f.e.value, f.t.value, f.s.value)).then(function () { close(); return reload(); })
        .catch(function (err) { msg.textContent = "Non créé : " + ((err && err.message) || err); });
    });
    return true;
  };

  var css = document.createElement("style");
  css.textContent = ".lnps-chip{display:inline-block;font-size:12px;font-weight:600;padding:3px 9px;border-radius:999px;white-space:nowrap}" +
    ".lnps-chip.go{background:#E3ECFB;color:#1B4FBF}.lnps-chip.rdv{background:#FDF1E3;color:#8A3F06}.lnps-chip.ok{background:#E6F2EA;color:#1E5E38}.lnps-chip.off{background:#EFECE4;color:#5E5B53}" +
    ".lnps-late{color:#B42318;font-weight:600;font-size:12.5px}" +
    ".lnps{border:1px solid #E3DFD5;border-radius:14px;padding:14px 16px;display:flex;flex-direction:column;gap:12px;background:#fff}" +
    ".lnps-h{display:flex;gap:12px;align-items:center;flex-wrap:wrap}.lnps-h .cx-em{display:inline;margin-left:6px}" +
    ".lnps-g{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;font-size:14px}" +
    ".lnps-k{display:block;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#5E5B53;margin-bottom:3px}" +
    ".lnps-a{display:flex;gap:8px;flex-wrap:wrap}.lnps-n{display:flex;gap:8px}.lnps-n .cx-in{flex:1}.lnps-msg{font-size:13px;color:#5E5B53;min-height:1em;margin:0}" +
    ".lnps-q summary{cursor:pointer;font-size:13px;font-weight:600}.lnps-q ul{margin:6px 0 0;padding-left:18px;font-size:13.5px}" +
    ".lnps-dlg{position:fixed;inset:0;z-index:90;background:rgba(27,27,24,.55);display:flex;align-items:center;justify-content:center;padding:24px}" +
    ".lnps-dlg form{width:min(440px,100%);background:#fff;border-radius:14px;padding:22px;display:flex;flex-direction:column;gap:12px}" +
    ".lnps-dlg h3{margin:0;font-family:Fraunces,Georgia,serif;font-size:21px;font-weight:600}.lnps-dlg label{display:flex;flex-direction:column;gap:4px;font-size:13px;font-weight:600}" +
    ".lnps-dlg .lnps-a{justify-content:flex-end}";
  document.head.appendChild(css);
})();
