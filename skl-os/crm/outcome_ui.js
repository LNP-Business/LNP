/* LNP CRM — declare a call's outcome from the Pipeline (Romain, 2026-11-05: « le commercial peut aussi déclarer l'issue
   d'un appel à travers le pipeline, et pas que le cycle de vente »), and move a lead from one column to another (Romain,
   2026-11-05: « il faut pouvoir mettre à jour le statut de chaque lead en le déplaçant dans la colonne appropriée ; s'il faut
   déclarer l'issue d'un appel, un popup invite à le faire »).
   The outcome form is the one of CRM › Cycle de vente (attendance, then the decision: yes with the amount and the payment
   terms, follow-up with the next step, no or disqualified with the reason, long-term follow-up after a no), saved through
   crm_declare_outcome (004) by window.sklCrmDeclare, which reloads the board. Its call is the lead's oldest past call with
   no outcome (the « meetdue » event of SKL_CRM.salesCycleView, window.sklScData) or, for a correction, its latest past call.
   window.sklMove(lead, to) turns a move (a Pipeline column or a status of the lead record) into what it means:
     - an outcome to declare or to correct → this form, filled in for the column (Absent, Oui, Non, Disqualifié, Relance);
     - lost or disqualified with no call to declare → the closing form (crm_close_cycle, 045, window.sklCrmClose);
     - a closed lead back in the pipeline → a confirmation, then crm_reopen_cycle (045, window.sklCrmReopen);
     - a column the CRM computes (Nouveau, R2 before it is booked, Relance longue…) → a message that says why.
   A viewer sees no button and moves nothing. window.sklOutcome.button(lead) → the card's button (or "");
   window.sklOutcome.open(id, opts) opens the outcome form; window.sklOutcome.close(id, decision) the closing form. */
(function () {
  "use strict";
  var CSS = ".sko-scrim{position:fixed;inset:0;z-index:180;background:rgba(27,27,24,.55);display:flex;justify-content:center;align-items:flex-start;overflow:auto;padding:40px 16px}"
    + ".sko{width:min(620px,100%);background:#fff;border:1px solid #E3DFD5;border-radius:16px;padding:24px 26px;display:flex;flex-direction:column;gap:16px;font-family:'IBM Plex Sans',system-ui,sans-serif;color:#1B1B18;box-shadow:0 24px 64px rgba(0,0,0,.28)}"
    + ".sko .kick{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#8E8A80;font-weight:600}.sko h2{margin:2px 0 0;font:500 22px Fraunces,Georgia,serif}"
    + ".sko .meta{font-size:13px;color:#5E5B53;margin-top:4px}.sko .hd{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}"
    + ".sko .why{font-size:13.5px;line-height:1.5;color:#3D3A33;background:#F6F4EF;border-radius:10px;padding:10px 12px}"
    + ".sko .x{width:38px;height:38px;border-radius:50%;border:1px solid #D8D3C7;background:#fff;font-size:20px;cursor:pointer;flex:none}"
    + ".sko .fr{display:flex;flex-direction:column;gap:7px}.sko .fr>span{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#5E5B53;font-weight:600}"
    + ".sko .och{display:flex;flex-wrap:wrap;gap:6px}.sko .och button{font:inherit;font-size:13px;font-weight:600;border:1px solid #D8D3C7;background:#fff;color:#1B1B18;border-radius:8px;padding:7px 11px;cursor:pointer}"
    + ".sko .och button[aria-pressed=true]{background:#1B1B18;color:#D9B46A;border-color:#1B1B18}"
    + ".sko input{font:inherit;font-size:14px;color:#1B1B18;padding:9px 10px;border:1px solid #D8D3C7;border-radius:10px;background:#fff}"
    + ".sko .ft{display:flex;justify-content:flex-end;gap:8px;border-top:1px solid #ECE8DF;padding-top:14px}"
    + ".sko .btn{border:0;background:#1B1B18;color:#D9B46A;font:inherit;font-size:14px;font-weight:600;border-radius:10px;padding:10px 16px;cursor:pointer}"
    + ".sko .btnl{border:1px solid #D8D3C7;background:#fff;color:#1B1B18;font:inherit;font-size:14px;font-weight:600;border-radius:10px;padding:10px 16px;cursor:pointer}"
    + ".sko .err{font-size:13px;color:#9B1C12;background:#FDECEA;border-radius:8px;padding:8px 10px}"
    + ".cx-outbtn{font:inherit;font-size:12px;font-weight:600;border:1px solid #1B1B18;background:#1B1B18;color:#D9B46A;border-radius:8px;padding:6px 10px;cursor:pointer}";
  var TERMS = [["1", "Payé en une fois"], ["2", "2 échéances"], ["3", "3"], ["4", "4"], ["6", "6"]];
  var COL = { nouveau: "Nouveau", r1: "R1", r2: "R2", r3: "R3 et plus", noshow: "Absent", longfu: "Relance longue", close: "Gagné", perdu: "Perdu", disq: "Disqualifié", nobook: "Sans rendez-vous", planifie: "RDV planifié", realise: "Appel honoré" };
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function css() { if (document.getElementById("sko-css")) return; var s = document.createElement("style"); s.id = "sko-css"; s.textContent = CSS; document.head.appendChild(s); }
  function data() { return window.sklScData || null; }
  function say(m) { if (typeof window.toast === "function") window.toast(m); return true; }
  function view(id) { var d = data(); return d && (d.leads || []).find(function (z) { return z.id === id; }) || null; }
  function dueCall(id) {
    var l = view(id), c = l && (l.ev || []).find(function (e) { return e.k === "meetdue" && e.cid; });
    return c ? { lead: l, call: c } : null;
  }
  // the latest call that took place or should have (held, no-show or outcome due): the one a move declares or corrects
  function lastCall(l) {
    var past = (l.ev || []).filter(function (e) { return e.cid && (e.k === "meetdue" || e.k === "noshow" || (e.k === "meet" && e.t <= l.age)); });
    return past[past.length - 1] || null;
  }
  function canWrite() { var d = data(); return !!(d && d.role !== "viewer" && typeof window.sklCrmDeclare === "function"); }

  function button(lead) {
    if (!lead || !canWrite() || !dueCall(lead.id)) return "";
    css();
    return '<button class="cx-outbtn" data-act="outdecl" data-id="' + esc(lead.id) + '">Déclarer l’issue</button>';
  }

  var F = null, W = null, SAVING = false;
  function reasons(kind) { var d = data(); return d && d.reasons && d.reasons[kind] ? d.reasons[kind] : []; }
  function ch(k, opts) {
    return '<div class="och">' + opts.map(function (o) { return '<button type="button" data-of="' + k + ':' + esc(o[0]) + '" aria-pressed="' + (F[k] === o[0]) + '">' + esc(o[1]) + "</button>"; }).join("") + "</div>";
  }
  function frame(kick, title, inner, err, saveLbl) {
    return '<div class="sko" role="dialog" aria-modal="true" aria-labelledby="sko-h"><div class="hd"><div><div class="kick">' + esc(kick) + '</div>'
      + '<h2 id="sko-h">' + esc(title) + "</h2></div>"
      + '<button class="x" data-oclose="1" aria-label="Fermer">×</button></div>' + inner
      + (err ? '<div class="err">' + esc(err) + "</div>" : "")
      + '<div class="ft"><button class="btnl" data-oclose="1">Annuler</button><button class="btn" data-osave="1">' + (SAVING ? "Enregistrement…" : saveLbl) + "</button></div></div>";
  }
  function render(err) {
    var l = view(F.id); if (!l) return close();
    if (F.mode === "close") {
      var kind = F.dec === "no" ? "no" : "dq";
      W.innerHTML = frame("Clore le prospect", l.p,
        (F.why ? '<div class="why">' + esc(F.why) + "</div>" : "")
        + '<div class="fr"><span>Décision</span>' + ch("dec", [["no", "Perdu"], ["dq", "Disqualifié"]]) + "</div>"
        + '<div class="fr"><span>Motif</span>' + ch("reason", reasons(kind)) + "</div>"
        + '<div class="fr"><span>Note (facultatif)</span><input id="sko-n" value="' + esc(F.note) + '" placeholder="ex. Ne répond plus après 4 relances"></div>',
        err, "Clore le prospect");
      return;
    }
    var more = "";
    if (F.res === "held") {
      more += '<div class="fr"><span>Décision</span>' + ch("dec", [["yes", "Oui"], ["fu", "Relance"], ["no", "Non"], ["dq", "Disqualifié"]]) + "</div>";
      if (F.dec === "yes") more += '<div class="fr"><span>Montant vendu</span><input id="sko-a" inputmode="numeric" value="' + esc(F.amt) + '"></div>'
        + '<div class="fr"><span>Modalités de paiement</span>' + ch("inst", TERMS) + "</div>";
      if (F.dec === "fu") more += '<div class="fr"><span>Prochaine étape</span><input id="sko-s" value="' + esc(F.step) + '" placeholder="ex. Envoyer l’étude de cas, puis appeler jeudi"></div>';
      if (F.dec === "no" || F.dec === "dq") more += '<div class="fr"><span>Motif</span>' + ch("reason", reasons(F.dec === "no" ? "no" : "dq")) + "</div>";
      if (F.dec === "no") more += '<div class="fr"><span>Suivi long terme</span>' + ch("nur", [["y", "Mettre en suivi long terme"], ["n", "Pas de suivi long terme"]]) + "</div>";
    }
    W.innerHTML = frame(F.correction ? "Corriger l’issue" : "Formulaire d’issue", "R" + (F.call.r || 1) + " · " + l.p,
      (F.why ? '<div class="why">' + esc(F.why) + "</div>" : "")
      + '<div class="fr"><span>L’appel a-t-il eu lieu ?</span>' + ch("res", [["held", "Honoré"], ["noshow", "Absent"]]) + "</div>" + more,
      err, F.correction ? "Corriger l’issue" : "Enregistrer l’issue");
  }
  function close() { if (W) W.remove(); W = null; F = null; }
  function keep() {
    var a = W && W.querySelector("#sko-a"), st = W && W.querySelector("#sko-s"), n = W && W.querySelector("#sko-n");
    if (a) F.amt = a.value; if (st) F.step = st.value; if (n) F.note = n.value;
  }
  function done(msg) {
    return function () { SAVING = false; close(); say(msg); };
  }
  function fail(err) { SAVING = false; render("Non enregistré : " + String(err && err.message || err)); }
  function save() {
    if (!F || SAVING) return;
    keep();
    if (F.mode === "close") {
      if (!F.reason) return render("Choisissez un motif.");
      var dec = F.dec === "no" ? "no" : "disqualified", id = F.id, reason = F.reason, note = (F.note || "").trim(), reopen = F.reopen;
      SAVING = true; render();
      var go = function () { return window.sklCrmClose(id, dec, reason, note); };
      Promise.resolve().then(function () { return reopen ? window.sklCrmReopen(id, true).then(go) : go(); })
        .then(done("Prospect clos · " + (dec === "no" ? "Perdu" : "Disqualifié")), fail);
      return;
    }
    var held = F.res === "held", d2 = held ? { yes: "yes", fu: "follow_up", no: "no", dq: "disqualified" }[F.dec] : null;
    var p = { attendance: held ? "held" : "no_show", decision: d2 };
    if (held && !d2) return render("Choisissez une décision.");
    if (d2 === "yes") { p.amount_sold = String(+F.amt || 0); p.payment_plan = F.inst === "1" ? "Payé en une fois" : F.inst + " échéances"; }
    if (d2 === "follow_up") p.next_step = (F.step || "").trim() || "Relance";
    if (d2 === "no" || d2 === "disqualified") { if (!F.reason) return render("Choisissez un motif."); p.reason_code = F.reason; }
    if (d2 === "no") p.nurture = F.nur === "y" ? "standard" : "none";
    SAVING = true; render();
    var cid = F.call.cid;
    Promise.resolve().then(function () { return window.sklCrmDeclare(cid, p); })
      .then(done("Issue enregistrée · l’étape, la prochaine étape et les alertes sont recalculées"), fail);
  }
  function mount() {
    css(); close();
    W = document.createElement("div"); W.className = "sko-scrim";
    W.addEventListener("click", function (e) {
      var t = e.target.closest("[data-of],[data-oclose],[data-osave]");
      if (e.target === W || (t && t.dataset.oclose)) return close();
      if (!t) return;
      if (t.dataset.osave) return save();
      keep();
      var kv = t.dataset.of.split(":"); F[kv[0]] = kv.slice(1).join(":");
      if (kv[0] === "dec" && F.mode === "close") F.reason = "";
      render();
    });
    document.addEventListener("keydown", function k(e) { if (e.key === "Escape" && W) { close(); document.removeEventListener("keydown", k); } });
    document.body.appendChild(W);
  }
  // opts: {call (an event with cid and r: the due call by default), res "held" | "noshow", dec "yes" | "fu" | "no" | "dq",
  // why (a line on top), correction (the call already has an outcome: it is replaced), amount}
  function open(id, opts) {
    if (opts != null && typeof opts !== "object") opts = { amount: opts };
    opts = opts || {};
    var due = dueCall(id), call = opts.call || (due && due.call);
    if (!canWrite() || !call) return false;
    mount();
    F = { id: id, call: call, res: opts.res || "held", dec: opts.dec || "fu", amt: opts.amount || "", inst: "1", reason: "", nur: "y", step: "",
      why: opts.why || "", correction: !!opts.correction };
    render();
    return true;
  }
  function closeForm(id, dec, opts) {
    if (!canWrite() || typeof window.sklCrmClose !== "function") return false;
    opts = opts || {};
    mount();
    F = { id: id, mode: "close", dec: dec === "dq" || dec === "disqualified" ? "dq" : "no", reason: "", note: "", why: opts.why || "", reopen: !!opts.reopen };
    render();
    return true;
  }

  // ---- a move: lead = the board's lead (st: nouveau, planifie, realise, noshow, longfu, close, perdu, disq, nobook; tour);
  // to = a Pipeline column (nouveau, r1, r2, r3, noshow, longfu, close, perdu, disq, nobook) or a status (planifie, realise)
  var PRESET = { close: ["held", "yes"], perdu: ["held", "no"], disq: ["held", "dq"], noshow: ["noshow", null], realise: ["held", "fu"] };
  function move(lead, to) {
    if (!lead || !to) return false;
    var d = data();
    if (!d) return say("Le pipeline n’est pas encore chargé.");
    if (!canWrite()) return say("Lecture seule : votre rôle ne permet pas de déplacer un prospect.");
    var l = view(lead.id), name = lead.p || (l && l.p) || "ce prospect", where = "« " + (COL[to] || to) + " »";
    if (!l) return say("Ce contact n’a pas encore de cycle de vente : il apparaîtra dans le pipeline dès qu’il réservera un appel.");
    if (lead.st === "close") return say("Ce prospect a payé : une vente ne se déplace pas. Un remboursement se saisit dans sa fenêtre d’encaissement.");
    var due = (l.ev || []).find(function (e) { return e.k === "meetdue" && e.cid; }), last = lastCall(l), call = due || last;
    var future = (l.ev || []).find(function (e) { return e.k === "meet" && e.t > l.age; });
    var round = /^r(\d)$/.exec(to), closed = lead.st === "perdu" || lead.st === "disq";
    var form = function (c, pre, why) {
      return open(lead.id, { call: c, res: pre[0], dec: pre[1] || "fu", correction: c.k !== "meetdue", why: why +
        (c.k !== "meetdue" ? " L’issue déjà déclarée pour le R" + (c.r || 1) + " sera remplacée." : "") });
    };
    if (closed) {
      if (to === "perdu" || to === "disq") {
        if (to === lead.st) return true;
        if (last) return form(last, PRESET[to], "Pour passer en " + where + ", corrigez l’issue du R" + (last.r || 1) + ".");
        return closeForm(lead.id, to === "perdu" ? "no" : "dq", { reopen: true, why: "Le prospect passe en " + where + " avec un nouveau motif." });
      }
      if (to === "close") return say("Une vente se déclare sur l’issue d’un appel tenu : rouvrez d’abord le prospect, puis déclarez l’issue de son appel.");
      var ask = window.sklAsk || function (t, x, ok, fn) { if (window.confirm(t + "\n" + x)) fn(); };
      ask("Rouvrir le prospect ?", name + " revient dans le pipeline, à l’étape que donnent ses appels. Sa clôture reste dans l’historique.", "Rouvrir", function () {
        Promise.resolve().then(function () { return window.sklCrmReopen(lead.id); })
          .then(function () { say("Prospect rouvert"); }, function (e) { say("Non enregistré : " + String(e && e.message || e)); });
      });
      return true;
    }
    if (PRESET[to]) {
      if (call) return form(call, PRESET[to], "Pour passer en " + where + ", " + (call.k === "meetdue" ? "déclarez l’issue du R" + (call.r || 1) + "." : "corrigez l’issue du R" + (call.r || 1) + "."));
      if (to === "perdu" || to === "disq") return closeForm(lead.id, to === "perdu" ? "no" : "dq", { why: "Aucun appel à déclarer : le prospect est clos avec un motif." });
      return say(future ? "Le R" + (future.r || 1) + " n’a pas encore eu lieu : son issue se déclare après l’heure prévue." : "Aucun appel n’a eu lieu : l’issue se déclare après un appel.");
    }
    if (round) {
      var n = +round[1];
      if (due && n > (due.r || 1)) return form(due, ["held", "fu"], "Pour passer en R" + n + ", déclarez d’abord l’issue du R" + (due.r || 1) + " (Honoré, puis Relance). Le prospect arrive en R" + n + " dès que ce rendez-vous est réservé dans iClosed.");
      return say("Le R" + n + " se réserve dans iClosed : le prospect passera dans cette colonne dès la réservation.");
    }
    if (to === "planifie") return say("Un rendez-vous se réserve dans iClosed : le prospect passera en RDV planifié dès la réservation.");
    if (to === "nouveau") return say("« Nouveau » se calcule seul : un prospect sans appel réservé.");
    if (to === "longfu") return say("« Relance longue » se calcule seule : 14 jours sans nouvelles et aucun appel prévu.");
    if (to === "nobook") return say("« Sans rendez-vous » regroupe les contacts qui n’ont jamais réservé d’appel.");
    return say("Ce déplacement n’est pas possible.");
  }
  window.sklOutcome = { button: button, open: open, close: closeForm, _dueCall: dueCall, _lastCall: lastCall };
  window.sklMove = move;
})();
