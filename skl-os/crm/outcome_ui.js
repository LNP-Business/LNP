/* LNP CRM — declare a call's outcome from the Pipeline (Romain, 2026-11-05: « le commercial peut aussi déclarer l'issue
   d'un appel à travers le pipeline, et pas que le cycle de vente »). The same form as CRM › Cycle de vente (attendance,
   then the decision: yes with the amount and the payment terms, follow-up with the next step, no or disqualified with the
   reason, long-term follow-up after a no), saved through the same crm_declare_outcome (004) by window.sklCrmDeclare,
   which reloads the board. The call is the lead's oldest past call with no outcome (the « meetdue » event of
   SKL_CRM.salesCycleView, window.sklScData); a lead with none shows no button. A viewer sees no button.
   window.sklOutcome.button(lead) → the card's button (or ""); window.sklOutcome.open(id, find) opens the form. */
(function () {
  "use strict";
  var CSS = ".sko-scrim{position:fixed;inset:0;z-index:180;background:rgba(27,27,24,.55);display:flex;justify-content:center;align-items:flex-start;overflow:auto;padding:40px 16px}"
    + ".sko{width:min(620px,100%);background:#fff;border:1px solid #E3DFD5;border-radius:16px;padding:24px 26px;display:flex;flex-direction:column;gap:16px;font-family:'IBM Plex Sans',system-ui,sans-serif;color:#1B1B18;box-shadow:0 24px 64px rgba(0,0,0,.28)}"
    + ".sko .kick{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#8E8A80;font-weight:600}.sko h2{margin:2px 0 0;font:500 22px Fraunces,Georgia,serif}"
    + ".sko .meta{font-size:13px;color:#5E5B53;margin-top:4px}.sko .hd{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}"
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
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function css() { if (document.getElementById("sko-css")) return; var s = document.createElement("style"); s.id = "sko-css"; s.textContent = CSS; document.head.appendChild(s); }
  function data() { return window.sklScData || null; }
  function dueCall(id) {
    var d = data(), l = d && (d.leads || []).find(function (z) { return z.id === id; });
    var c = l && (l.ev || []).find(function (e) { return e.k === "meetdue" && e.cid; });
    return c ? { lead: l, call: c } : null;
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
  function render(err) {
    var x = dueCall(F.id); if (!x) return close();
    var more = "";
    if (F.res === "held") {
      more += '<div class="fr"><span>Décision</span>' + ch("dec", [["yes", "Oui"], ["fu", "Relance"], ["no", "Non"], ["dq", "Disqualifié"]]) + "</div>";
      if (F.dec === "yes") more += '<div class="fr"><span>Montant vendu</span><input id="sko-a" inputmode="numeric" value="' + esc(F.amt) + '"></div>'
        + '<div class="fr"><span>Modalités de paiement</span>' + ch("inst", TERMS) + "</div>";
      if (F.dec === "fu") more += '<div class="fr"><span>Prochaine étape</span><input id="sko-s" value="' + esc(F.step) + '" placeholder="ex. Envoyer l’étude de cas, puis appeler jeudi"></div>';
      if (F.dec === "no" || F.dec === "dq") more += '<div class="fr"><span>Motif</span>' + ch("reason", reasons(F.dec === "no" ? "no" : "dq")) + "</div>";
      if (F.dec === "no") more += '<div class="fr"><span>Suivi long terme</span>' + ch("nur", [["y", "Mettre en suivi long terme"], ["n", "Pas de suivi long terme"]]) + "</div>";
    }
    W.innerHTML = '<div class="sko" role="dialog" aria-modal="true" aria-labelledby="sko-h"><div class="hd"><div><div class="kick">Formulaire d’issue</div>'
      + '<h2 id="sko-h">R' + esc(x.call.r || 1) + " · " + esc(x.lead.p) + "</h2></div>"
      + '<button class="x" data-oclose="1" aria-label="Fermer">×</button></div>'
      + '<div class="fr"><span>L’appel a-t-il eu lieu ?</span>' + ch("res", [["held", "Honoré"], ["noshow", "Absent"]]) + "</div>" + more
      + (err ? '<div class="err">' + esc(err) + "</div>" : "")
      + '<div class="ft"><button class="btnl" data-oclose="1">Annuler</button><button class="btn" data-osave="1">' + (SAVING ? "Enregistrement…" : "Enregistrer l’issue") + "</button></div></div>";
  }
  function close() { if (W) W.remove(); W = null; F = null; }
  function save() {
    var x = dueCall(F.id); if (!x || SAVING) return;
    var held = F.res === "held", dec = held ? { yes: "yes", fu: "follow_up", no: "no", dq: "disqualified" }[F.dec] : null;
    var p = { attendance: held ? "held" : "no_show", decision: dec };
    var a = W.querySelector("#sko-a"), st = W.querySelector("#sko-s");
    if (dec === "yes") { p.amount_sold = String(+(a && a.value || F.amt) || 0); p.payment_plan = F.inst === "1" ? "Payé en une fois" : F.inst + " échéances"; }
    if (dec === "follow_up") p.next_step = (st && st.value.trim()) || "Relance";
    if (dec === "no" || dec === "disqualified") { if (!F.reason) return render("Choisissez un motif."); p.reason_code = F.reason; }
    if (dec === "no") p.nurture = F.nur === "y" ? "standard" : "none";
    SAVING = true; render();
    Promise.resolve().then(function () { return window.sklCrmDeclare(x.call.cid, p); }).then(function () {
      SAVING = false; close();
      if (typeof window.toast === "function") window.toast("Issue enregistrée · l’étape, la prochaine étape et les alertes sont recalculées");
    }, function (err) { SAVING = false; render("Non enregistré : " + String(err && err.message || err)); });
  }
  function open(id, amount) {
    if (!canWrite() || !dueCall(id)) return false;
    css(); close();
    F = { id: id, res: "held", dec: "fu", amt: amount || "", inst: "1", reason: "", nur: "y", step: "" };
    W = document.createElement("div"); W.className = "sko-scrim";
    W.addEventListener("click", function (e) {
      var t = e.target.closest("[data-of],[data-oclose],[data-osave]");
      if (e.target === W || (t && t.dataset.oclose)) return close();
      if (!t) return;
      if (t.dataset.osave) return save();
      var kv = t.dataset.of.split(":"); F[kv[0]] = kv.slice(1).join(":");
      var a = W.querySelector("#sko-a"), st = W.querySelector("#sko-s");
      if (a) F.amt = a.value; if (st) F.step = st.value;
      render();
    });
    document.addEventListener("keydown", function k(e) { if (e.key === "Escape" && W) { close(); document.removeEventListener("keydown", k); } });
    document.body.appendChild(W); render();
    return true;
  }
  window.sklOutcome = { button: button, open: open, _dueCall: dueCall };
})();
