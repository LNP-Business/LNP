// Entraînement (Romain 2026-11-06): every exercise done is kept on the person's account, in crm_training_results (migration
// 049: append only, never changed nor deleted), and read back in « Mes résultats » and « Suivi des commerciaux ». Injected by
// skl-os/build.py into the training apps (Découverte, Maîtrise de l'offre) in place of the RESULTS placeholder.
//   LNP_RESULTS.mark()        the active time so far, to start an exercise
//   LNP_RESULTS.since(m)      the active seconds since the mark (at most one hour)
//   LNP_RESULTS.add(row)      {module, case_id, score, max, mode, duration_s, details}: queued on this device, sent to the
//                             account one at a time; a row sent twice is kept once (cid); answers the cid
//   LNP_RESULTS.onChange(fn)  fn(text) when the state of the queue changes
// Active time: a second counts when the page is shown and the person has clicked, typed, scrolled or moved the pointer in the
// last two minutes, so a training left open does not count.
window.LNP_RESULTS = (function () {
  var QKEY = "lnp-entrainement-a-envoyer", IDLE = 120000;
  var P = (function () { try { return window.parent !== window && window.parent.claude && window.parent.claude.web ? window.parent : null; } catch (e) { return null; } })();
  var Q = [], active = 0, last = Date.now(), busy = false, crm = null, uid = null, fns = [], state = "", retry = null;
  try { Q = JSON.parse(window.localStorage.getItem(QKEY) || "[]"); if (!Array.isArray(Q)) Q = []; } catch (e) { Q = []; }
  function keep() { try { window.localStorage.setItem(QKEY, JSON.stringify(Q.slice(-500))); } catch (e) {} }
  function seen() { last = Date.now(); }
  ["pointerdown", "keydown", "input", "wheel", "scroll", "touchstart"].forEach(function (t) { window.addEventListener(t, seen, true); });
  var lm = 0; window.addEventListener("pointermove", function () { var n = Date.now(); if (n - lm > 1000) { lm = n; seen(); } }, true);
  setInterval(function () { if (!document.hidden && Date.now() - last < IDLE) active++; }, 1000);
  function newId() {
    try { if (window.crypto && crypto.randomUUID) return crypto.randomUUID(); } catch (e) {}
    return "r" + Date.now().toString(36) + Math.random().toString(36).slice(2, 12);
  }
  function tell(t) { state = t; fns.forEach(function (f) { try { f(t); } catch (e) {} }); }
  function text() {
    if (!P) return "Résultats gardés sur cet appareil : ouvre LNP en ligne pour les enregistrer sur ton compte.";
    return Q.length ? Q.length + " résultat" + (Q.length > 1 ? "s" : "") + " en attente d’envoi vers ton compte." : "Résultats enregistrés sur ton compte.";
  }
  function connect() {
    if (crm) return Promise.resolve(crm);
    return Promise.all([P.claude.use("crm"), P.claude.use("user")]).then(function (r) {
      return Promise.resolve(r[1].id()).then(function (id) { uid = id; crm = r[0]; return crm; });
    });
  }
  function later() { clearTimeout(retry); retry = setTimeout(flush, 30000); }
  function flush() {
    if (!P || busy) return;
    busy = true;
    connect().then(function (c) {
      // a row queued by another account on this device waits for that account
      var i = -1; Q.some(function (x, k) { if (!x.uid || x.uid === uid) { i = k; return true; } return false; });
      if (i < 0) { busy = false; tell(text()); return; }
      var x = Q[i], row = { cid: x.cid, module: x.module, case_id: x.case_id, score: x.score, max: x.max, mode: x.mode, duration_s: x.duration_s, details: x.details || {} };
      return Promise.resolve(c.from("crm_training_results").insert(row)).then(function (r) {
        var err = r && r.error;
        if (err && err.code !== "23505") throw err;          // 23505: already on the account
        Q.splice(i, 1); keep(); busy = false;
        try { P.dispatchEvent(new CustomEvent("lnp-training-result")); } catch (e) {}
        tell(text()); if (Q.length) flush();
      });
    }).catch(function () { busy = false; tell(Q.length ? "Compte injoignable : " + Q.length + " résultat" + (Q.length > 1 ? "s" : "") + " gardé" + (Q.length > 1 ? "s" : "") + " sur cet appareil, envoyé" + (Q.length > 1 ? "s" : "") + " dès que possible." : text()); later(); });
  }
  function clampInt(v, a, b) { v = Math.round(Number(v) || 0); return Math.max(a, Math.min(b, v)); }
  function add(r) {
    var x = { cid: newId(), uid: uid, module: r.module, case_id: String(r.case_id).slice(0, 12), score: Math.round(Number(r.score) * 2) / 2, max: r.max,
      mode: r.mode, duration_s: clampInt(r.duration_s, 0, 3600), details: r.details || {}, at: new Date().toISOString() };
    Q.push(x); keep(); tell(text()); flush();
    return x.cid;
  }
  if (P) setTimeout(flush, 1500);
  window.addEventListener("online", flush);
  return {
    mark: function () { return active; },
    since: function (m) { return clampInt(active - (m || 0), 0, 3600); },
    add: add, flush: flush, newId: newId, pending: function () { return Q.length; },
    onChange: function (f) { fns.push(f); f(state || text()); },
    online: !!P
  };
})();
