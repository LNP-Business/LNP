/* SKL OS CRM — call analysis (call-analysis/docs/SCREEN_SPEC.md, plan call-analysis/PLAN.md phase 3).
   The analysis of a call shows in its lead record, under "Call analysis" (leadView: the lead's past R1 / R2 sales calls,
   then the chosen one drawn by SKL_CAV, call_analysis_view.js, as in Romain's mock-up of 2026-10-27). Opened from the pipeline
   card chip, the lead list "Analysis" column and Sales cycle (a call's "Call analysis" button): a call with a transcript opens
   its lead record (SKL_CA.showInLead, set by the CRM document); "Add transcript" opens a window to paste it and say who the
   sales and the prospect are. Scores are the engine's (the code decides; these files only display). Data:
   window.parent.SKL_CRM (caBoard, caRecord, caAddTranscript, caRetry). Needs window.SKL_TRANSCRIPT (transcript_parse.js). */
(function () {
  "use strict";
  var COMP = [["SPIN", "Découverte"], ["GAP", "Écart"], ["PITCH", "Présentation de l'offre"], ["OBJECTIONS", "Objections"]];
  var CSS = [
    ".ca-scrim{position:fixed;inset:0;z-index:200;background:rgba(27,27,24,.55);display:flex;justify-content:center;align-items:flex-start;overflow:auto;padding:28px 16px}",
    ".ca-dlg{width:1180px;max-width:100%;background:#F6F4EF;border-radius:16px;box-shadow:0 24px 64px rgba(0,0,0,.3);font-family:'IBM Plex Sans',system-ui,sans-serif;color:#1B1B18}",
    ".ca-top{background:#fff;border-bottom:1px solid #E3DFD5;border-radius:16px 16px 0 0;padding:20px 26px;display:flex;gap:16px;align-items:center;justify-content:space-between;flex-wrap:wrap}",
    ".ca-av{width:46px;height:46px;border-radius:10px;background:linear-gradient(160deg,#D9B46A,#9A6614);color:#fff;display:flex;align-items:center;justify-content:center;font:600 22px Fraunces,Georgia,serif}",
    ".ca-h1{font:500 24px Fraunces,Georgia,serif;margin:0}.ca-h2{font:500 21px Fraunces,Georgia,serif;margin:0}",
    ".ca-body{padding:20px 26px 28px;display:flex;flex-direction:column;gap:18px}",
    ".ca-card{background:#fff;border:1px solid #E3DFD5;border-radius:14px;padding:20px 22px}",
    ".ca-cap{font-size:11px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:#5E5B53}",
    ".ca-mut{color:#5E5B53}.ca-mono{font-family:'IBM Plex Mono',ui-monospace,monospace}",
    ".ca-btn{font:600 13px 'IBM Plex Sans',sans-serif;color:#1B1B18;background:#fff;border:1px solid #D8D3C7;border-radius:10px;padding:8px 13px;cursor:pointer}",
    ".ca-btn.p{background:#1B1B18;color:#D9B46A;border-color:#1B1B18}.ca-btn:disabled{opacity:.5;cursor:default}",
    ".ca-x{width:38px;height:38px;border-radius:50%;border:1px solid #D8D3C7;background:#fff;font-size:20px;cursor:pointer}",
    ".ca-tag{display:inline-block;font-size:12px;font-weight:600;padding:2px 8px;border-radius:6px;white-space:nowrap}",
    ".tg{background:#E6F2EA;color:#1E5E38}.tr{background:#FDECEA;color:#9B1C12}.ty{background:#F7EEDC;color:#7A4B00}.tn{background:#EFECE4;color:#3D3A33}.tb{background:#E6EEF9;color:#2F5DA8}.to{background:#FDF1E3;color:#8A3F06}",
    ".ca-tbl{width:100%;border-collapse:collapse;margin-top:12px}.ca-tbl th{font-size:11px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:#5E5B53;padding:9px 10px;border-bottom:1px solid #E3DFD5;text-align:left}",
    ".ca-tbl td{padding:12px 10px;border-bottom:1px solid #EFEBE3;vertical-align:top;font-size:13px}",
    ".ca-ban{font-size:13px;background:#F7EEDC;border:1px solid #EAD9B3;border-radius:10px;padding:10px 14px}",
    ".ca-err{font-size:13px;background:#FDECEA;border:1px solid #F1B8B2;border-radius:10px;padding:10px 14px;color:#9B1C12}",
    ".ca-ta{width:100%;min-height:220px;box-sizing:border-box;border:1px solid #D8D3C7;border-radius:10px;padding:10px 12px;font:12.5px 'IBM Plex Mono',monospace;resize:vertical}",
    ".ca-sel{font:inherit;font-size:13px;border:1px solid #D8D3C7;border-radius:8px;padding:5px 8px;background:#fff}",
  ].join("\n");

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function level(sc) { return sc >= 85 ? ["Maîtrisé", "tg"] : sc >= 60 ? ["En progrès", "ty"] : ["À travailler", "tr"]; }
  function arr(x) { return Array.isArray(x) ? x : []; }
  function obj(x) { return x && typeof x === "object" && !Array.isArray(x) ? x : {}; }
  // ------------------------------------------------------------------ window and states
  var W = null;
  function api() { try { return window.parent && window.parent.SKL_CRM; } catch (e) { return null; } }
  function close() { if (W) { W.remove(); W = null; document.removeEventListener("keydown", onKey, true); } }
  function onKey(e) { if (e.key === "Escape") { e.stopPropagation(); close(); } }
  function frame(ctx) {
    close();
    W = document.createElement("div"); W.className = "ca-scrim";
    W.innerHTML = '<div class="ca-dlg" role="dialog" aria-modal="true" aria-labelledby="ca-t"><div class="ca-top"><div style="display:flex;gap:14px;align-items:center"><div class="ca-av">' + esc((ctx.person || "?").charAt(0).toUpperCase()) +
      '</div><div><div class="ca-h1" id="ca-t">' + esc(ctx.person || "Appel") + '</div><div class="ca-mut" style="font-size:13px;margin-top:4px">Analyse d\'appel' + (ctx.round ? ' · <span class="ca-mono">R' + esc(ctx.round) + "</span>" : "") + (ctx.when ? " · " + esc(ctx.when) : "") + '</div></div></div><button class="ca-x" data-close aria-label="Fermer">×</button></div><div class="ca-body" id="ca-body"></div></div>';
    W.addEventListener("mousedown", function (e) { if (e.target === W) close(); });
    W.addEventListener("click", onClick);
    document.addEventListener("keydown", onKey, true);
    document.body.appendChild(W);
    return W.querySelector("#ca-body");
  }
  function body(html) { var b = W && W.querySelector("#ca-body"); if (b) b.innerHTML = html; return b; }
  function fmtWhen(iso) { try { return new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }); } catch (e) { return ""; } }

  var CUR = null; // {callId, ctx, row}
  function rowOf(callId) { return arr(window.SKL_CA_ROWS).filter(function (x) { return x.call_id === callId; })[0] || null; }
  // a call with a transcript opens in its lead record (SKL_CA.showInLead, set by the CRM document); one without, or "Add
  // transcript", opens the window to add it
  async function open(callId, ctx) {
    ctx = ctx || {};
    var C = api();
    if (!C || !C.caBoard) { frame(ctx); return body('<div class="ca-ban">L\'analyse d\'appel fonctionne dans la version web, où le CRM est en ligne.</div>'); }
    var row = rowOf(callId);
    if (!row) { try { window.SKL_CA_ROWS = await C.caBoard(); } catch (e) { console.error(e); } row = rowOf(callId); }
    if (row && !ctx.add && (row.job || row.done_job) && API.showInLead && API.showInLead(row.cycle_id, callId)) return;
    frame(ctx);
    CUR = { callId: callId, ctx: ctx, row: row };
    if (!row) return body('<div class="ca-ban">Cet appel n\'est pas analysé : seuls les appels de vente R1 et R2 passés le sont (pas les appels d\'intégration ni d\'étude de cas), et seuls un administrateur ou le commercial attitré du prospect voient l\'analyse.</div>');
    ctx.round = ctx.round || row.round; ctx.when = ctx.when || fmtWhen(row.start);
    W.querySelector(".ca-mut").innerHTML = "Analyse d'appel · <span class=\"ca-mono\">R" + esc(row.round) + "</span> · " + esc(ctx.when);
    if (!ctx.add && (row.status === "queued" || row.status === "running")) return showPending(row);
    if (!ctx.add && row.status === "failed") return showFailed(row);
    return showAdd(row);
  }
  function pendingText(row) {
    return "La transcription est enregistrée" + (row.queued_at ? " (ajoutée le " + esc(fmtWhen(row.queued_at)) + ")" : "") + ". " +
      (row.status === "running" ? "L'analyse a commencé le " + esc(fmtWhen(row.started_at)) + " : comptez 15 à 30 minutes environ pour un appel d'une heure." : "Elle attend le prochain passage de l'analyse, toutes les heures à la 7e minute, puis prend 15 à 30 minutes environ.") +
      " Les quatre scores s'affichent ici et sur le prospect une fois l'analyse terminée.";
  }
  function showPending(row) { body('<div class="ca-card"><h2 class="ca-h2">Analyse en cours…</h2><p class="ca-mut" style="font-size:14px;line-height:1.55">' + pendingText(row) + "</p></div>"); }
  function showFailed(row) {
    body('<div class="ca-card"><h2 class="ca-h2">L\'analyse n\'a pas abouti</h2><div class="ca-err" style="margin-top:10px">' + esc(row.error || "Erreur inconnue") + '</div><div style="display:flex;gap:10px;margin-top:12px"><button class="ca-btn p" data-retry>Relancer l\'analyse</button><button class="ca-btn" data-replace>Remplacer la transcription</button></div></div>');
  }
  function showAdd(row, err) {
    body('<div class="ca-card"><h2 class="ca-h2">' + (row && row.transcript ? "Remplacer la transcription" : "Ajouter la transcription") + '</h2><p class="ca-mut" style="font-size:14px;line-height:1.55;margin:8px 0 12px">Collez la transcription de l\'appel (Fathom, Zoom, Google Meet, un export .vtt ou .txt), ou déposez le fichier. Chaque prise de parole a besoin d\'une heure et du nom de la personne qui parle. Indiquez ensuite qui est le commercial et qui est le prospect : l\'analyse lit les mots du prospect lui-même.</p>' +
      (err ? '<div class="ca-err" style="margin-bottom:10px">' + esc(err) + "</div>" : "") +
      '<textarea class="ca-ta" id="ca-raw" placeholder="Camille  0:06\nVous me voyez et m’entendez bien ?\n\nAlex  0:09\nOui."></textarea>' +
      '<div style="display:flex;gap:10px;align-items:center;margin-top:10px;flex-wrap:wrap"><label class="ca-btn" style="display:inline-flex;align-items:center">Choisir un fichier<input type="file" id="ca-file" accept=".txt,.vtt,.srt,.json,text/*" hidden></label><button class="ca-btn" data-parse>Lire les intervenants</button><span class="ca-mut" id="ca-pinfo" style="font-size:13px"></span></div>' +
      '<div id="ca-map" style="margin-top:14px"></div></div>');
    var ta = W.querySelector("#ca-raw"), file = W.querySelector("#ca-file");
    file.addEventListener("change", function () { var f = file.files[0]; if (!f) return; f.text().then(function (t) { ta.value = t; parseNow(); }); });
    ta.addEventListener("drop", function (e) { var f = e.dataTransfer.files[0]; if (!f) return; e.preventDefault(); f.text().then(function (t) { ta.value = t; parseNow(); }); });
    ta.addEventListener("paste", function () { setTimeout(parseNow, 0); });
  }
  var PARSED = null;
  function parseNow() {
    var ta = W && W.querySelector("#ca-raw"); if (!ta) return;
    var P = window.SKL_TRANSCRIPT.parse(ta.value); PARSED = P;
    W.querySelector("#ca-pinfo").textContent = P.turns.length ? P.turns.length + " prise" + (P.turns.length <= 1 ? "" : "s") + " de parole · " + P.speakers.length + " intervenant" + (P.speakers.length <= 1 ? "" : "s") + (P.turns.length ? " · se termine à " + P.turns[P.turns.length - 1].ts : "") : "";
    var map = window.SKL_TRANSCRIPT.guessMap(P.speakers, CUR.ctx.sales || (CUR.row && CUR.row.sales_name) || "");
    W.querySelector("#ca-map").innerHTML = (P.warnings.length ? '<div class="ca-err" style="margin-bottom:10px">' + P.warnings.map(esc).join("<br>") + "</div>" : "") +
      (P.speakers.length ? '<table class="ca-tbl"><thead><tr><th>Intervenant dans la transcription</th><th>Prises de parole</th><th>Mots</th><th>Rôle</th></tr></thead><tbody>' + P.speakers.map(function (s) {
        return "<tr><td><b>" + esc(s.name) + "</b></td><td class=\"ca-mono\">" + s.turns + '</td><td class="ca-mono">' + s.words + '</td><td><select class="ca-sel" data-spk="' + esc(s.name) + '">' +
          [["SALES", "Commercial"], ["PROSPECT", "Prospect"], ["OTHER", "Autre (associé, assistant…)"]].map(function (o) { return '<option value="' + o[0] + '"' + (map[s.name] === o[0] ? " selected" : "") + ">" + o[1] + "</option>"; }).join("") + "</select></td></tr>";
      }).join("") + '</tbody></table><div style="display:flex;justify-content:flex-end;margin-top:12px"><button class="ca-btn p" data-submit>Analyser cet appel</button></div>' : "");
  }
  async function submit() {
    var C = api(), P = PARSED; if (!P || !P.turns.length) return;
    var map = {}; W.querySelectorAll("[data-spk]").forEach(function (s) { map[s.dataset.spk] = s.value; });
    var roles = Object.keys(map).map(function (k) { return map[k]; });
    if (roles.indexOf("SALES") < 0 || roles.indexOf("PROSPECT") < 0) return W.querySelector("#ca-map").insertAdjacentHTML("afterbegin", '<div class="ca-err" style="margin-bottom:10px">Choisissez au moins un commercial et un prospect.</div>');
    var b = W.querySelector("[data-submit]"); b.disabled = true; b.textContent = "Enregistrement…";
    try {
      await C.caAddTranscript(CUR.callId, window.SKL_TRANSCRIPT.toEngine(P.turns), map);
      var rows = await C.caBoard(); window.SKL_CA_ROWS = rows; CUR.row = rowOf(CUR.callId) || { status: "queued" };
      showPending(CUR.row); notify(); repaint();
    } catch (err) { b.disabled = false; b.textContent = "Analyser cet appel"; W.querySelector("#ca-map").insertAdjacentHTML("afterbegin", '<div class="ca-err" style="margin-bottom:10px">Non enregistré : ' + esc(err && err.message || err) + "</div>"); }
  }
  function retry(callId, done, fail) {
    return api().caRetry(callId).then(function () { return api().caBoard(); }).then(function (rows) { window.SKL_CA_ROWS = rows; notify(); repaint(); if (done) done(rowOf(callId)); }, fail);
  }
  function onClick(e) {
    var t = e.target.closest("button"); if (!t) return;
    if (t.hasAttribute("data-close")) return close();
    if (t.hasAttribute("data-parse")) return parseNow();
    if (t.hasAttribute("data-submit")) return submit();
    if (t.hasAttribute("data-replace")) return showAdd(CUR.row || {});
    if (t.hasAttribute("data-retry")) {
      t.disabled = true;
      return retry(CUR.callId, function (row) { CUR.row = row; showPending(row || {}); }, function (err) { t.disabled = false; body('<div class="ca-err">' + esc(err && err.message || err) + "</div>"); });
    }
  }

  // ------------------------------------------------------------------ the analysis in the lead record (the mock-up's layout)
  // the lead's past R1 / R2 sales calls as chips; the chosen one shows below "Call analysis", drawn by SKL_CAV
  var SEL = {}, RECS = {}, UI = {}, META = {};
  function pickRow(cycleId) {
    var rows = rowsOf(cycleId), s = SEL[cycleId];
    return rows.filter(function (x) { return x.call_id === s; })[0] || leadRow(cycleId) || rows[rows.length - 1] || null;
  }
  function select(cycleId, callId) { SEL[cycleId] = callId; }
  function load(job) {
    if (RECS[job]) return;
    RECS[job] = { loading: true };
    api().caRecord(job).then(function (r) { RECS[job] = r ? { rec: r } : { error: "Impossible de lire l'analyse." }; repaint(); },
      function (err) { RECS[job] = { error: String(err && err.message || err) }; repaint(); });
  }
  function day(iso) { try { return new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).replace(",", ""); } catch (e) { return ""; } }
  function minutes(d) { var s = String(d || "").split(":").map(Number); if (s.length < 2 || s.some(isNaN)) return ""; var m = s.length === 3 ? s[0] * 60 + s[1] : s[0]; return m + " min"; }
  function leadInner(cycleId) {
    var rows = rowsOf(cycleId), r = pickRow(cycleId), m = META[cycleId] || {};
    var phone = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6B675C" stroke-width="2" aria-hidden="true"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"></path></svg>';
    // Romain 2026-10-29: the sales calls of the cycle (R1, R2) stand out as a segmented control, the chosen one dark
    var calls = '<div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap"><span class="cap" style="font-size:11px">Appels de vente</span>' +
      '<div role="tablist" aria-label="Appels de vente de ce cycle" style="display:inline-flex;gap:4px;padding:4px;background:#ECE8DF;border-radius:12px">' + rows.map(function (x) {
      var on = r && x.call_id === r.call_id, rec = x.done_job && RECS[x.done_job] && RECS[x.done_job].rec, len = rec ? minutes(obj(rec.meta).duration) : "";
      var st = x.status === "queued" ? "En file" : x.status === "running" ? "En cours" : x.status === "failed" ? "Échec" : x.done_job ? "Analysé" : "Sans transcription";
      return '<button type="button" role="tab" data-ca-sel="' + esc(x.call_id) + '" aria-selected="' + on + '" aria-pressed="' + on + '" style="cursor:pointer;border:0;border-radius:9px;padding:9px 18px;display:flex;flex-direction:column;align-items:flex-start;gap:2px;min-width:132px;text-align:left;' +
        (on ? "background:#1B1B18;color:#FFFFFF;box-shadow:0 2px 8px rgba(27,27,24,.18)" : "background:transparent;color:#1B1B18") + '">' +
        '<span style="font-family:Fraunces,Georgia,serif;font-size:20px;font-weight:600;line-height:1.1;color:' + (on ? "#D9B46A" : "#1B1B18") + '">R' + esc(x.round) + '</span>' +
        '<span class="mono" style="font-size:11.5px;opacity:.85">' + esc(day(x.start)) + (len ? " · " + esc(len) : "") + " · " + st + "</span></button>";
    }).join("") + "</div>" + (m.next ? '<span class="muted" style="font-size:13px">Prochain appel : ' + m.next + "</span>" : "") + "</div>";
    var title = '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px"><div class="serif" style="font-size:17px;font-weight:600">Analyse d\'appel</div>' +
      (r ? '<button class="btn" type="button" data-ca-add="' + esc(r.call_id) + '"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 15V3M7 8l5-5 5 5M4 15v5h16v-5"></path></svg>' + (r.transcript ? "Remplacer la transcription" : "Ajouter la transcription") + "</button>" : "") + "</div>";
    function box(inner) { return '<div class="card" style="padding:18px 22px;font-size:14px;line-height:1.55">' + inner + "</div>"; }
    if (!r) return calls + title + box('<span class="muted">Aucun appel de vente R1 ou R2 passé à analyser pour ce prospect pour l\'instant (les appels d\'intégration et d\'étude de cas ne sont pas analysés). Seuls les administrateurs et le commercial attitré du prospect voient l\'analyse.</span>');
    var busy = r.status === "queued" || r.status === "running", out = "";
    if (busy) out += box('<b class="serif" style="font-size:17px">Analyse en cours…</b><div class="muted" style="margin-top:6px">' + pendingText(r) + (r.done_job ? " Ci-dessous : l'analyse précédente." : "") + "</div>");
    if (r.status === "failed") out += box('<b class="serif" style="font-size:17px">L\'analyse n\'a pas abouti</b><div class="err" style="margin-top:10px">' + esc(r.error || "Erreur inconnue") + '</div><div style="margin-top:12px"><button class="btn" type="button" data-ca-retry="' + esc(r.call_id) + '">Relancer l\'analyse</button></div>');
    if (r.done_job) {
      var st = RECS[r.done_job];
      if (!st) { load(r.done_job); st = RECS[r.done_job]; }
      out += st.rec ? window.SKL_CAV.html(st.rec, UI[r.call_id] || {}) : st.error ? '<div class="err">' + esc(st.error) + "</div>" : box('<span class="muted">Chargement de l\'analyse…</span>');
    } else if (!busy && r.status !== "failed") out += box('<span class="muted">Pas encore de transcription pour cet appel. Ajoutez-la (Fathom, Zoom, Google Meet…) pour analyser la découverte, l\'écart, la présentation de l\'offre et les objections.</span>');
    return calls + title + out;
  }
  function leadView(cycleId, meta) { META[cycleId] = meta || {}; return '<div class="cav" id="caLead" data-cycle="' + esc(cycleId) + '">' + leadInner(cycleId) + "</div>"; }
  function repaint() { var el = document.getElementById("caLead"); if (el) el.innerHTML = leadInner(el.dataset.cycle); }
  function reveal(sel) { var n = document.querySelector(sel); if (n) n.scrollIntoView({ behavior: "smooth", block: "start" }); }
  document.addEventListener("click", function (e) {
    var root = e.target.closest("#caLead"); if (!root) return;
    var b = e.target.closest("button"); if (!b || b.disabled) return;
    var cy = root.dataset.cycle, r = pickRow(cy); if (!r) return;
    var ui = UI[r.call_id] = UI[r.call_id] || {}, m = META[cy] || {};
    if (b.dataset.caSel) { SEL[cy] = b.dataset.caSel; return repaint(); }
    if (b.hasAttribute("data-ca-add")) return open(r.call_id, { add: true, person: m.person, sales: m.sales, round: r.round });
    if (b.hasAttribute("data-ca-retry")) { b.disabled = true; return retry(r.call_id, null, function (err) { b.disabled = false; alert(String(err && err.message || err)); }); }
    if (b.hasAttribute("data-cav-drawer")) { var v = b.getAttribute("data-cav-drawer"); ui.drawer = v ? { turn: v } : null; repaint(); if (v) reveal("#cav-drawer"); return; }
    if (b.hasAttribute("data-cav-sol")) { var id = b.getAttribute("data-cav-sol"); ui.sol = id && ui.sol !== id ? id : null; return repaint(); }
    if (b.dataset.cavG) { var ep = +b.dataset.cavEp, g = b.dataset.cavG; ui.gesture = ui.gesture && ui.gesture.ep === ep && ui.gesture.g === g ? null : { ep: ep, g: g }; repaint(); }
  });
  var LISTENERS = [];
  function notify() { LISTENERS.forEach(function (f) { try { f(); } catch (e) { console.error(e); } }); }

  // ------------------------------------------------------------------ the chip on a lead (pipeline card, lead list)
  // rows: crm_ca_board(); picks the lead's latest R1 / R2 call with an analysis, else a recent one (30 days) to add
  function rowsOf(cycleId) { return arr(window.SKL_CA_ROWS).filter(function (x) { return x.cycle_id === cycleId; }); }
  function leadRow(cycleId) {
    var rows = rowsOf(cycleId); if (!rows.length) return null;
    var withJob = rows.filter(function (x) { return x.job; });
    if (withJob.length) return withJob[withJob.length - 1];
    var recent = rows.filter(function (x) { return Date.now() - new Date(x.start).getTime() < 30 * 864e5; });
    return recent.length ? recent[recent.length - 1] : null;
  }
  function dot(sc) { var x = obj(sc); if (x.status !== "scored" || x.score == null) return '<i style="color:#B7B2A6;font-style:normal">—</i>'; var l = level(x.score); if (x.verdict === "absent" || x.verdict === "non_compliant") l = ["", "tr"]; return '<span class="ca-tag ' + l[1] + '" style="padding:0 5px;font-size:11px">' + Math.round(x.score) + "</span>"; }
  function chip(cycleId) {
    var r = leadRow(cycleId); if (!r) return "";
    var base = 'class="sklca-chip" data-ca="' + esc(r.call_id) + '" data-cycle="' + esc(cycleId) + '" style="display:inline-flex;align-items:center;gap:4px;margin-top:6px;font:600 11.5px \'IBM Plex Sans\',sans-serif;border-radius:8px;padding:3px 8px;cursor:pointer;';
    if (r.status === "done" || r.done_job) {
      var s = obj(r.scores);
      return "<button " + base + 'border:1px solid #E3DFD5;background:#fff;color:#1B1B18" title="Analyse d\'appel R' + r.round + ' · Découverte, Écart, Présentation de l\'offre, Objections">R' + r.round + " " + COMP.map(function (c) { return dot(s[c[0]]); }).join("") + "</button>";
    }
    if (r.status === "queued" || r.status === "running") return "<button " + base + 'border:1px solid #EAD9B3;background:#F7EEDC;color:#7A4B00">Analyse R' + r.round + " en cours…</button>";
    if (r.status === "failed") return "<button " + base + 'border:1px solid #F1B8B2;background:#FDECEA;color:#9B1C12">Échec de l\'analyse R' + r.round + "</button>";
    return "<button " + base + 'border:1px dashed #D8D3C7;background:#fff;color:#5E5B53">+ Transcription R' + r.round + "</button>";
  }

  // the lead record's "Prospect analysis" tab: every past R1 / R2 sales call of the lead with its analysis state
  function leadPanel(cycleId) {
    var rows = rowsOf(cycleId);
    var head = '<div class="cx-panel"><h3>Analyse d\'appel</h3>';
    if (!rows.length) return head + '<p class="mut" style="margin:0">Aucun appel de vente R1 ou R2 passé à analyser pour ce prospect pour l\'instant (les appels d\'intégration et d\'étude de cas ne sont pas analysés). Seuls les administrateurs et le commercial attitré du prospect voient l\'analyse.</p></div>';
    return head + '<p class="mut" style="margin:0 0 10px">Découverte · Écart · Présentation de l\'offre · Objections, notés à partir de la transcription. Ouvrez un appel pour voir son analyse, ou ajoutez sa transcription.</p>' +
      rows.map(function (r) {
        var st = r.status === "done" || r.done_job ? COMP.map(function (c) { return dot(obj(r.scores)[c[0]]); }).join(" ") :
          r.status === "queued" || r.status === "running" ? '<span class="ca-tag ty">Analyse en cours…</span>' :
          r.status === "failed" ? '<span class="ca-tag tr">Échec</span>' : '<span class="ca-tag tn">Sans transcription</span>';
        var when = ""; try { when = new Date(r.start).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }); } catch (e) {}
        return '<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-top:1px solid #EFEBE3"><b class="ca-mono">R' + esc(r.round) + '</b><span class="mut">' + esc(when) + "</span>" + st +
          '<span style="flex:1"></span><button class="btn sm" data-ca="' + esc(r.call_id) + '" data-cycle="' + esc(cycleId) + '">' + (r.status === "done" || r.done_job ? "Ouvrir l'analyse" : r.status ? "Voir" : "Ajouter la transcription") + "</button></div>";
      }).join("") + "</div>";
  }
  function latestRow(cycleId) { var rows = rowsOf(cycleId); return rows.length ? rows[rows.length - 1] : null; }

  // styles once per document
  function injectCss() { if (document.getElementById("sklca-css")) return; var s = document.createElement("style"); s.id = "sklca-css"; s.textContent = CSS; document.head.appendChild(s); }
  injectCss();
  var API = window.SKL_CA = { open: open, close: close, chip: chip, leadRow: leadRow, leadPanel: leadPanel, leadView: leadView, select: select, latestRow: latestRow, showInLead: null, onChange: function (f) { LISTENERS.push(f); }, css: CSS };
})();
