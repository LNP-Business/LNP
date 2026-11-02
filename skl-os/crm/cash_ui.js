/* SKL OS CRM — cash of a signed client, entered by hand (web/supabase/022_crm_manual_cash.sql; Romain, 2026-10-26).
   A window over the CRM document, opened from the lead's "Invoicing and payment" panel or its card: the amount signed,
   the payments received (date, amount, source: entered by hand or Whop), a form to add one, and Remove (asked first) for a
   payment entered by hand. Whop's payments will arrive on their own later (phase 5) and show here too.
   Payment plan (024, Romain 2026-10-28): the terms of the deal, paid in full or in 2 to 12 instalments with their dates and
   amounts (crm_set_payment_plan); the payments received settle the instalments in due order. The method is not asked.
   window.sklCash.open(lead, C, reload, canWrite): lead = the CRM document's lead (id = cycle id, p, a, pays);
   C = window.parent.SKL_CRM (setPlan, addPayment, deletePayment); reload() re-reads the board and returns a promise.
   lead.cur = the deal's currency (EUR by default), lead.plan / lead.sched = the plan label and its instalments. */
(function () {
  "use strict";
  var TERMS = [[1, "Paid in full"], [2, "2 instalments"], [3, "3 instalments"], [4, "4 instalments"], [6, "6 instalments"], [12, "12 instalments"]];
  var CSS = ".skc-scrim{position:fixed;inset:0;z-index:180;background:rgba(27,27,24,.55);display:flex;justify-content:center;align-items:flex-start;overflow:auto;padding:40px 16px}"
    + ".skc{width:min(760px,100%);background:#fff;border:1px solid #E3DFD5;border-radius:16px;padding:26px 28px;display:flex;flex-direction:column;gap:18px;font-family:'IBM Plex Sans',system-ui,sans-serif;color:#1B1B18;box-shadow:0 24px 64px rgba(0,0,0,.28)}"
    + ".skc h2{margin:0;font:500 24px Fraunces,Georgia,serif}.skc h3{margin:0;font:500 17px Fraunces,Georgia,serif}"
    + ".skc .q{font-size:13px;color:#5E5B53;line-height:1.5;margin:0}.skc .row{display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap}"
    + ".skc label{display:flex;flex-direction:column;gap:5px;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#5E5B53;font-weight:600}"
    + ".skc input,.skc select{font:inherit;font-size:14px;letter-spacing:0;text-transform:none;font-weight:400;color:#1B1B18;padding:9px 10px;border:1px solid #D8D3C7;border-radius:10px;background:#fff}"
    + ".skc .btn{border:0;background:#1B1B18;color:#D9B46A;font:inherit;font-size:14px;font-weight:600;border-radius:10px;padding:10px 16px;cursor:pointer;white-space:nowrap}"
    + ".skc .btnl{border:1px solid #D8D3C7;background:#fff;color:#1B1B18;font:inherit;font-size:13px;font-weight:600;border-radius:8px;padding:6px 11px;cursor:pointer}"
    + ".skc .rm{color:#9B1C12}.skc .x{width:38px;height:38px;border-radius:50%;border:1px solid #D8D3C7;background:#fff;font-size:20px;cursor:pointer}"
    + ".skc table{width:100%;border-collapse:collapse;font-size:14px}.skc th{text-align:left;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#8E8A80;font-weight:600;padding:6px 8px;border-bottom:1px solid #E3DFD5}"
    + ".skc td{padding:9px 8px;border-bottom:1px solid #ECE8DF;vertical-align:middle}.skc .num{font-family:'IBM Plex Mono',monospace;text-align:right;white-space:nowrap}"
    + ".skc .tag{display:inline-block;font-size:12px;font-weight:600;padding:2px 8px;border-radius:6px;background:#EFECE4;color:#3D3A33}.skc .tag.w{background:#E6EEF9;color:#2F5DA8}"
    + ".skc .tot{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.skc .tot div{background:#F6F4EF;border-radius:12px;padding:10px 12px}.skc .tot b{display:block;font:500 22px Fraunces,Georgia,serif;margin-top:2px}"
    + ".skc .st{font-size:12px;font-weight:600;padding:2px 8px;border-radius:6px}.skc .st.p{background:#E3F1E7;color:#1E5E38}.skc .st.o{background:#FDECEA;color:#9B1C12}.skc .st.h{background:#FBF1DC;color:#7A4B00}.skc .st.d{background:#EFECE4;color:#3D3A33}"
    + ".skc .err{font-size:13px;color:#9B1C12;background:#FDECEA;border-radius:8px;padding:8px 10px}.skc .ok{font-size:13px;color:#1E5E38}";
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function money(n, cur) {
    try { return (Number(n) || 0).toLocaleString("en-GB", { style: "currency", currency: cur || "EUR", maximumFractionDigits: 0 }); }
    catch (e) { return (cur || "") + " " + Math.round(Number(n) || 0); }
  }
  function ymd(d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function addMonths(s, k) { var d = new Date(s + "T12:00:00"), m = d.getDate(); d.setMonth(d.getMonth() + k); if (d.getDate() !== m) d.setDate(0); return ymd(d); }
  // n instalments of the amount, one a month from the first date; the cents left over go on the last one
  function split(total, n, first) {
    var base = Math.floor((total / n) * 100) / 100, out = [];
    for (var i = 0; i < n; i++) out.push({ due: addMonths(first, i), amount: i < n - 1 ? base : Math.round((total - base * (n - 1)) * 100) / 100 });
    return out;
  }
  // the payments received settle the instalments in due order
  function settle(sched, got) {
    var left = got, now = today();
    return (sched || []).map(function (x) {
      var a = Number(x.amount) || 0, paid = Math.min(a, Math.max(0, left)); left -= paid;
      var st = paid >= a - 0.005 ? "p" : paid > 0 ? "h" : x.due < now ? "o" : "d";
      return { due: x.due, amount: a, paid: paid, st: st };
    });
  }
  function planCount(l) { var m = /^(\d+) instal/.exec(l.plan || ""); return l.sched && l.sched.length ? l.sched.length : m ? +m[1] : 1; }
  function day(iso) { try { return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }); } catch (e) { return ""; } }
  function today() { return ymd(new Date()); }
  function css() { if (document.getElementById("skc-css")) return; var s = document.createElement("style"); s.id = "skc-css"; s.textContent = CSS; document.head.appendChild(s); }

  var W = null, ST = null;
  function close() { if (W) { W.remove(); W = null; document.removeEventListener("keydown", key, true); } }
  function key(e) { if (e.key === "Escape") { e.stopPropagation(); close(); } }
  function collected(pays) { return (pays || []).reduce(function (s, p) { return s + (Number(p.amount) || 0) - (Number(p.refunded_amount) || 0); }, 0); }

  function edRows(l) {
    var n = ST.ed.n, signed = ST.ed.signed;
    if (!ST.ed.rows || ST.ed.rows.length !== n) ST.ed.rows = l.sched && l.sched.length === n && !ST.ed.touched ? l.sched.map(function (x) { return { due: x.due, amount: Number(x.amount) }; }) : split(signed || 0, n, ST.ed.first);
    return ST.ed.rows;
  }
  function draw(msg, err) {
    var l = ST.lead, cur = l.cur || "EUR", pays = (l.pays || []).slice().sort(function (a, b) { return (a.paid_at < b.paid_at ? 1 : -1); });
    var got = collected(pays), signed = Number(l.a) || 0, w = ST.canWrite, f = function (n) { return money(n, cur); };
    var plan = settle(l.sched, got), next = plan.filter(function (x) { return x.st !== "p"; })[0];
    if (!ST.ed) ST.ed = { n: planCount(l), signed: signed, first: (l.sched && l.sched[0] && l.sched[0].due) || today() };
    W.querySelector(".skc").innerHTML =
      '<div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start"><div><div class="q" style="text-transform:uppercase;letter-spacing:.08em;font-size:11px;font-weight:600">Cash · signed client</div><h2>' + esc(l.p) + '</h2></div><button class="x" data-c="close" aria-label="Close">×</button></div>' +
      '<p class="q">Entered by hand for now. When Whop is connected, its payments will appear here on their own, marked Whop.</p>' +
      (err ? '<div class="err">' + esc(err) + "</div>" : msg ? '<div class="ok">' + esc(msg) + "</div>" : "") +
      '<div class="tot"><div><span class="q">Signed</span><b>' + f(signed) + '</b></div><div><span class="q">Collected</span><b>' + f(got) + '</b></div><div><span class="q">Left to collect</span><b>' + f(Math.max(0, signed - got)) + "</b>" +
        (next ? '<span class="q">Next: ' + f(next.amount - next.paid) + " · " + esc(day(next.due + "T12:00:00")) + "</span>" : "") + "</div></div>" +
      '<div style="display:flex;flex-direction:column;gap:8px"><h3>Payment plan' + (l.plan ? ' · <span style="font-family:\'IBM Plex Sans\';font-size:14px;color:#5E5B53">' + esc(l.plan) + "</span>" : "") + "</h3>" +
      (plan.length ? '<table><thead><tr><th>#</th><th>Due</th><th style="text-align:right">Amount</th><th>Status</th></tr></thead><tbody>' + plan.map(function (x, i) {
        var lab = { p: "Paid", h: "Part paid · " + f(x.paid), o: "Overdue", d: "Due" }[x.st];
        return "<tr><td>" + (i + 1) + "</td><td>" + esc(day(x.due + "T12:00:00")) + '</td><td class="num">' + f(x.amount) + '</td><td><span class="st ' + x.st + '">' + esc(lab) + "</span></td></tr>";
      }).join("") + "</tbody></table>" : '<p class="q">' + (l.plan ? esc(l.plan) + " chosen at close; set the dates and amounts below." : "No payment plan yet: set the terms of the deal below.") + "</p>") + "</div>" +
      (w ? '<div style="display:flex;flex-direction:column;gap:10px;border-top:1px solid #ECE8DF;padding-top:16px"><h3>' + (plan.length ? "Change the plan" : "Set the plan") + '</h3><div class="row">' +
        '<label>Amount signed (' + esc(cur) + ')<input id="skc-signed" type="number" min="1" step="100" inputmode="numeric" style="width:140px" value="' + (ST.ed.signed || "") + '"></label>' +
        '<label>Terms<select id="skc-n">' + TERMS.map(function (x) { return '<option value="' + x[0] + '"' + (x[0] === ST.ed.n ? " selected" : "") + ">" + x[1] + "</option>"; }).join("") +
          (TERMS.some(function (x) { return x[0] === ST.ed.n; }) ? "" : '<option value="' + ST.ed.n + '" selected>' + ST.ed.n + " instalments</option>") + "</select></label>" +
        '<label>First due date<input id="skc-first" type="date" value="' + esc(ST.ed.first) + '"></label></div>' +
        '<table><thead><tr><th>#</th><th>Due</th><th style="text-align:right">Amount (' + esc(cur) + ")</th></tr></thead><tbody>" + edRows(l).map(function (x, i) {
          return "<tr><td>" + (i + 1) + '</td><td><input type="date" data-r="due" data-i="' + i + '" value="' + esc(x.due) + '"></td><td style="text-align:right"><input type="number" min="1" step="50" data-r="amount" data-i="' + i + '" value="' + x.amount + '" style="width:130px;text-align:right"></td></tr>';
        }).join("") + "</tbody></table>" +
        '<div class="row" style="justify-content:flex-end"><span class="q" id="skc-sum"></span><button class="btn" data-c="plan">Save the plan</button></div></div>' : "") +
      '<div style="display:flex;flex-direction:column;gap:8px"><h3>Payments received</h3>' +
      (pays.length ? '<table><thead><tr><th>Date</th><th style="text-align:right">Amount</th><th>Source</th><th>Note</th><th></th></tr></thead><tbody>' + pays.map(function (p) {
        return "<tr><td>" + esc(day(p.paid_at)) + '</td><td class="num">' + f((Number(p.amount) || 0) - (Number(p.refunded_amount) || 0)) +
          (Number(p.refunded_amount) ? ' <span class="q">(' + f(p.refunded_amount) + " refunded)</span>" : "") + '</td><td><span class="tag ' + (p.source === "manual" ? "" : "w") + '">' + (p.source === "manual" ? "By hand" : "Whop") + "</span></td><td>" + esc(p.note || "") + "</td><td>" +
          (w && (Number(p.amount) || 0) > (Number(p.refunded_amount) || 0) ? '<button class="btnl" data-c="refund" data-id="' + esc(p.id) + '">Refunded</button> ' : "") +
          (w && p.source === "manual" ? '<button class="btnl rm" data-c="rm" data-id="' + esc(p.id) + '">Remove</button>' : "") + "</td></tr>";
      }).join("") + "</tbody></table>" : '<p class="q">No payment recorded yet.</p>') + "</div>" +
      (w ? '<div style="display:flex;flex-direction:column;gap:10px;border-top:1px solid #ECE8DF;padding-top:16px"><h3>Add a payment received</h3><div class="row">' +
        '<label>Amount (' + esc(cur) + ')<input id="skc-amt" type="number" min="1" step="50" inputmode="numeric" style="width:130px" value="' + (next ? Math.round((next.amount - next.paid) * 100) / 100 : "") + '"></label>' +
        '<label>Date<input id="skc-date" type="date" value="' + today() + '" max="' + today() + '"></label>' +
        '<label style="flex:1;min-width:160px">Note<input id="skc-note" placeholder="' + (next ? "Instalment " + (plan.indexOf(next) + 1) + " of " + plan.length : "Deposit, first instalment…") + '"></label>' +
        '<button class="btn" data-c="add">Add the payment</button></div></div>' : '<p class="q">You can read the cash; an admin, a sales lead or the lead\'s sales rep enters it.</p>');
    sum();
  }
  function readRows() {
    return Array.prototype.map.call(W.querySelectorAll('[data-r="due"]'), function (el) {
      var i = el.dataset.i, a = W.querySelector('[data-r="amount"][data-i="' + i + '"]');
      return { due: el.value, amount: Math.round(Number(a && a.value) * 100) / 100 };
    });
  }
  function sum() {
    var el = W && W.querySelector("#skc-sum"); if (!el) return;
    var rows = readRows(), t = rows.reduce(function (s, x) { return s + (x.amount || 0); }, 0), sg = Number(W.querySelector("#skc-signed").value) || 0;
    el.textContent = Math.abs(t - sg) > 0.01 ? "The instalments add up to " + money(t, ST.lead.cur) + ", not " + money(sg, ST.lead.cur) + "." : "";
    el.style.color = "#9B1C12";
  }
  function onInput(e) {
    var t = e.target; if (!W || !t.id && !t.dataset.r) return;
    if (t.dataset.r) { ST.ed.rows = readRows(); ST.ed.touched = true; return sum(); }
    if (t.id === "skc-n" || t.id === "skc-signed" || t.id === "skc-first") {
      ST.ed.n = +W.querySelector("#skc-n").value; ST.ed.signed = Number(W.querySelector("#skc-signed").value) || 0;
      ST.ed.first = W.querySelector("#skc-first").value || today();
      ST.ed.rows = split(ST.ed.signed, ST.ed.n, ST.ed.first); ST.ed.touched = true; draw();
    }
  }
  function busy(on) { W.querySelectorAll("button,input,select").forEach(function (b) { if (b.dataset.c !== "close") b.disabled = on; }); }
  async function act(fn, ok) {
    busy(true);
    try { await fn(); await ST.reload(); ST.lead = ST.find(ST.lead.id) || ST.lead; ST.ed = null; draw(ok); }
    catch (e) { busy(false); draw(null, String(e && e.message || e)); }
  }
  function onClick(e) {
    var b = e.target.closest("[data-c]"); if (!b) return;
    var c = b.dataset.c, C = ST.C, id = ST.lead.id;
    if (c === "close") return close();
    if (c === "plan") {
      var sg = Number(W.querySelector("#skc-signed").value), rows = readRows();
      if (!(sg > 0)) return draw(null, "Enter the amount signed.");
      if (rows.some(function (x) { return !x.due || !(x.amount > 0); })) return draw(null, "Each instalment needs a date and an amount.");
      return act(function () { return C.setPlan(id, sg, ST.lead.cur || "EUR", rows); }, "Payment plan saved.");
    }
    if (c === "add") {
      var amt = Number(W.querySelector("#skc-amt").value), d = W.querySelector("#skc-date").value;
      if (!(amt > 0)) return draw(null, "Enter the amount received.");
      if (!d) return draw(null, "Enter the date the money was received.");
      var p = { amount: amt, paid_at: new Date(d + "T12:00:00").toISOString(), note: W.querySelector("#skc-note").value.trim() || (/^Instalment /.test(W.querySelector("#skc-note").placeholder) ? W.querySelector("#skc-note").placeholder : "") };
      return act(function () { return C.addPayment(id, p); }, "Payment added: the lead counts as won and the cockpit's cash includes it.");
    }
    if (c === "refund") {
      var rid = b.dataset.id, back = function () { act(function () { return C.addRefund(rid); }, "Refund recorded."); };
      if (window.sklAsk) return window.sklAsk("Mark this payment as refunded?", "The cash collected goes down by what is left of it. When every payment of the lead is refunded, the lead is lost (reason Refunded).", "Refunded", back);
      return back();
    }
    if (c === "rm") {
      var pid = b.dataset.id, go = function () { act(function () { return C.deletePayment(pid); }, "Payment removed."); };
      if (window.sklAsk) return window.sklAsk("Remove this payment?", "It was entered by hand. The cash collected and the cockpit go back without it; if it was the only payment, the lead is no longer won.", "Remove", go);
      return go();
    }
  }
  function open(lead, C, reload, canWrite, find) {
    if (!lead || !C) return;
    css(); close();
    ST = { lead: lead, C: C, reload: reload, canWrite: canWrite !== false, find: find || function () { return null; }, ed: null };
    W = document.createElement("div"); W.className = "skc-scrim";
    W.innerHTML = '<div class="skc" role="dialog" aria-modal="true" aria-label="Cash of a signed client"></div>';
    W.addEventListener("mousedown", function (e) { if (e.target === W) close(); });
    W.addEventListener("click", onClick);
    W.addEventListener("change", onInput);
    W.addEventListener("input", function (e) { if (e.target.dataset.r) onInput(e); });
    document.addEventListener("keydown", key, true);
    document.body.appendChild(W);
    draw();
  }
  window.sklCash = { open: open, close: close, collected: collected };
})();
