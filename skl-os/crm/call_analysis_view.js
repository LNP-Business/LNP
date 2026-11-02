/* SKL OS CRM — the call analysis as designed (Romain 2026-10-27: "Analyse d'un appel · maquette", call-analysis/docs/SCREEN_SPEC.md,
   reference built on real call 001). Shown inside the lead record, under "Call analysis": header card with the four scores,
   transcript drawer, then 1 The discovery, 2 The gap played back, 3 The pitch, 4 Objections, with the mock-up's
   colours, type and layout, filled from the engine's record (crm_ca_record). The code decides and scores; this file only shows
   what the engine stored. window.SKL_CAV.html(record, ui) returns the markup; ui = {drawer, gesture} is kept by the caller. */
(function () {
  "use strict";
  var COMP = [["SPIN", "Discovery"], ["GAP", "Gap"], ["PITCH", "Pitch"], ["OBJECTIONS", "Objections"]];
  var CSS = [
    ".cav{font-family:'IBM Plex Sans',system-ui,sans-serif;color:#1E1C17;display:flex;flex-direction:column;gap:18px;min-width:0;max-width:100%}.cav>*,.cav .card{min-width:0}",
    ".cav .serif{font-family:'Source Serif 4',Georgia,serif}.cav .mono{font-family:'IBM Plex Mono',monospace}",
    ".cav .card{background:#FFFFFF;border:1px solid #E7E2D6;border-radius:12px}",
    ".cav .cap{font-size:11px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:#4A463D}",
    ".cav .muted{color:#6B675C}",
    ".cav .num{width:26px;height:26px;border-radius:6px;background:#FBF1DA;color:#7A5A12;font-weight:600;font-size:13px;display:inline-flex;align-items:center;justify-content:center;flex:none}",
    ".cav .btn{font-family:'IBM Plex Sans',sans-serif;font-size:13px;font-weight:600;color:#1E1C17;background:#FFFFFF;border:1px solid #DDD7C9;border-radius:8px;padding:8px 13px;cursor:pointer;display:inline-flex;align-items:center;gap:7px}",
    ".cav .chip{display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:5px;font-weight:600;font-size:12px;margin:0 4px 4px 0;box-sizing:border-box;font-family:inherit;padding:0}",
    ".cav button.chip{cursor:pointer}",
    ".cav .cS{border:1.5px solid #2E7D4F;color:#2E7D4F;background:#EEF7F1}.cav .cP{border:1.5px solid #C2571A;color:#C2571A;background:#FDF0E7}",
    ".cav .cI{border:1.5px solid #B42318;color:#B42318;background:#FCEDEC}.cav .cN{border:1.5px solid #1E1C17;color:#1E1C17;background:#F2F0EA}",
    ".cav .cX{border:1.5px dashed #E0B9A4;color:#D99A79;background:#FFFFFF}",
    ".cav .cO{border:1px solid #E2DDD0;background:repeating-linear-gradient(135deg,#F3F0E8 0 4px,#FFFFFF 4px 8px)}",
    ".cav .cNo{border:1.5px dashed #E3A49E;color:#B42318;background:#FFFFFF}.cav .cHalf{border:1.5px solid #C9A24A;color:#8A6417;background:#FBF1DA}",
    ".cav .cNa{border:1px solid #E7E2D6;color:#C0BBAE;background:#FFFFFF;cursor:default!important}",
    ".cav .tag{display:inline-block;font-size:12px;font-weight:600;padding:2px 8px;border-radius:5px}",
    ".cav .tg{background:#E3F1E8;color:#1F6B40}.cav .tb{background:#E6EEF9;color:#2F5DA8}.cav .to{background:#FCEBDD;color:#A2450E}.cav .tn{background:#EFECE4;color:#4A463D}.cav .tr{background:#FCE3E1;color:#9B1C13}.cav .ty{background:#FBF1DA;color:#8A6417}",
    ".cav .th{font-size:11px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:#4A463D;padding:10px 12px;border-bottom:1px solid #E7E2D6;text-align:left}",
    ".cav .td{padding:14px 12px;border-bottom:1px solid #EFEBE1;vertical-align:top;font-size:13px}",
    ".cav .chips{display:flex;flex-wrap:wrap}.cav .td>div>div{min-width:0}.cav .td{overflow-wrap:anywhere;white-space:normal}.cav .q{white-space:normal}",
    ".cav .bar{height:8px;border-radius:4px;background:#EFECE4;position:relative;flex:1}",
    ".cav .quote{font-style:italic;font-size:14px;line-height:1.5;color:#1E1C17}",
    ".cav .dot{width:9px;height:9px;border-radius:50%;display:inline-block;flex:none}",
    ".cav .q{background:none;border:0;padding:0;font:inherit;color:inherit;text-align:left;cursor:pointer;text-decoration:underline dotted #CFC8B6;text-underline-offset:3px}",
    ".cav .q:hover{background:#FBF1DA}",
    ".cav .mk{border-radius:4px;padding:1px 3px}",
    ".cav sup.sl{font-family:'IBM Plex Sans',sans-serif;font-style:normal;font-size:10px;font-weight:600;margin-left:2px}",
    ".cav .row{display:flex;gap:12px}.cav .row.p{background:#F8F6F0;border-radius:8px;padding:8px 10px}.cav .row.hl{box-shadow:inset 3px 0 0 #D9A93F;background:#FFFBF0}",
    ".cav .row .w{flex:none;width:92px}.cav .row .tx{font-size:14px;line-height:1.75;color:#1E1C17;min-width:0}.cav .row.p .tx{color:#6B675C}",
    ".cav .ban{font-size:13px;background:#FBF1DA;border:1px solid #E9CF8E;border-radius:9px;padding:10px 12px;color:#6E5110}",
    ".cav .err{font-size:13px;background:#FCE3E1;border:1px solid #F2A9A2;border-radius:9px;padding:10px 12px;color:#9B1C13}"
  ].join("\n");

  // ------------------------------------------------------------------ helpers
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function arr(x) { return Array.isArray(x) ? x : []; }
  function obj(x) { return x && typeof x === "object" && !Array.isArray(x) ? x : {}; }
  function lbl(s) { s = String(s || "").replace(/_/g, " "); return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase(); }
  function secs(ts) { if (!ts) return null; var p = String(ts).split(":").map(Number); if (p.some(isNaN)) return null; return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p[0] * 60 + p[1]; }
  function two(n) { return (n < 10 ? "0" : "") + n; }
  function clock(s) { if (s == null) return "—"; s = Math.round(s); return two(Math.floor(s / 60)) + ":" + two(s % 60); }          // 62:00, never 1:02:00
  function dur(s) { if (s == null || s < 0) return ""; s = Math.round(s); var m = Math.floor(s / 60), r = s % 60; return m ? m + " min" + (r ? " " + two(r) : "") : r + " s"; }
  function level(sc) { return sc >= 85 ? ["Mastered", "tg"] : sc >= 60 ? ["Developing", "ty"] : ["Needs work", "tr"]; }
  var WHY = {
    health_absent_share: "too many discovery questions got no answer to be scored reliably",
    diarization_suspect: "the transcript mixes up who said what too often",
    no_discovery: "no discovery was found", no_restitution: "the gap was not played back",
    pitch_before_gap: "pitch before the gap", pitch_before_validation: "pitch before the yes",
    outcome_promise: "outcome promise", P_category_unknown: "blocker category unknown", missing: "missing",
    no_A_to_B: "no A → B", case_library_missing: "no client case on file", not_in_restitution: "not in the restatement"
  };
  function why(s) {
    s = String(s || "");
    if (/^to_review/.test(s)) return "a point waits for a person" + (s.split(":")[1] ? " (" + lbl(s.split(":").slice(1).join(" ")) + ")" : "");
    if (/^fewer_than_\d+/.test(s)) return "too few discovery questions to score";
    return WHY[s] || lbl(s);
  }

  function Rec(r) {
    var self = this;
    this.r = r; this.turns = arr(r.turns); this.idx = {};
    this.turns.forEach(function (t, i) { self.idx[t.id] = i; });
    this.res = obj(r.results); this.ph = obj(r.phases); this.meta = obj(r.meta);
    this.end = secs((this.turns[this.turns.length - 1] || {}).ts) || 1;
  }
  Rec.prototype.t = function (id) { return this.turns[this.idx[id]] || null; };
  Rec.prototype.s = function (id) { var t = this.t(id); return t ? secs(t.ts) : null; };
  Rec.prototype.c = function (id) { return clock(this.s(id)); };
  Rec.prototype.pct = function (id) { var s = this.s(id); return s == null ? null : Math.max(0, Math.min(100, s / this.end * 100)); };
  Rec.prototype.d = function (c) { return obj(obj(this.res[c]).details); };
  function between(rec, a, b) { var i = rec.idx[a], j = rec.idx[b]; if (i == null) return []; if (j == null || j < i) j = i; return rec.turns.slice(i, j + 1); }

  // a quote of the call (the transcript itself opens only from its button, Romain 2026-10-27)
  function q(rec, text, turn, wrap) {
    if (!text) return "";
    return wrap === false ? esc(text) : "“" + esc(text) + "”";
  }
  // marks: [{q, bg, fg, label}] highlighted inside a turn's text, with the mock-up's superscript label
  function marked(text, marks) {
    var out = esc(text);
    arr(marks).forEach(function (m) {
      if (!m || !m.q) return;
      var e = esc(m.q), i = out.toLowerCase().indexOf(e.toLowerCase());
      if (i < 0 || out.lastIndexOf("<", i) > out.lastIndexOf(">", i)) return;
      out = out.slice(0, i) + '<span class="mk" style="background:' + m.bg + '">' + out.slice(i, i + e.length) + "</span>" +
        (m.label ? '<sup class="sl" style="color:' + (m.fg || "#4A463D") + '">' + esc(m.label) + "</sup>" : "") + out.slice(i + e.length);
    });
    return out;
  }
  function row(rec, t, marks, hl) {
    var who = t.role === "SALES" ? "Sales" : t.role === "PROSPECT" ? "Prospect" : (t.speaker || "Other");
    return '<div class="row ' + (t.role === "PROSPECT" ? "p" : "") + (hl ? " hl" : "") + '" data-tid="' + esc(t.id) + '"><div class="w"><div class="mono" style="font-size:12px;color:#1E1C17">' + esc(rec.c(t.id)) +
      '</div><div class="mono muted" style="font-size:11px">' + esc(t.id) + " · " + esc(who) + '</div></div><div class="tx">“' + marked(t.text, marks) + "”</div></div>";
  }
  var MK = {
    green: ["#E3F1E8", "#1F6B40"], red: ["#FCE3E1", "#9B1C13"], orange: ["#FCEBDD", "#A2450E"], grey: ["#EFECE4", "#4A463D"],
    blue: ["#E6EEF9", "#2F5DA8"], gold: ["#FBF1DA", "#8A6417"]
  };
  function mk(qt, kind, label) { var k = MK[kind] || MK.grey; return { q: qt, bg: k[0], fg: k[1], label: label }; }
  function legend(items) { return '<div style="display:flex;flex-wrap:wrap;gap:6px 14px;font-size:12px" class="muted">' + items.map(function (x) { return '<span><span class="dot" style="background:' + x[0] + '"></span> ' + x[1] + "</span>"; }).join("") + "</div>"; }
  function sectionHead(n, title, tag) {
    return '<div style="display:flex;gap:12px;align-items:center;justify-content:space-between;flex-wrap:wrap"><div style="display:flex;gap:12px;align-items:center"><span class="num">' + n + '</span><span class="serif" style="font-size:20px;font-weight:700">' + esc(title) + "</span></div>" + (tag || "") + "</div>";
  }
  function sub(text) { return '<div style="font-size:14px;padding-left:38px" class="muted">' + text + "</div>"; }
  function notScored(x) { return x.status && x.status !== "scored" ? '<div class="ban">' + (x.status === "excluded" ? "Excluded" : x.status === "to_review" ? "To review" : x.status === "not_applicable" ? "Not applicable" : lbl(x.status)) + (arr(x.reasons)[0] ? ": " + esc(why(x.reasons[0])) : "") + ". What was found is shown below, without " + (x.status === "to_review" ? "a final score" : "points") + ".</div>" : ""; }

  // ------------------------------------------------------------------ header card and call map
  function header(rec, ui) {
    var scored = COMP.filter(function (c) { var x = obj(rec.res[c[0]]); return x.status === "scored" && x.score != null; });
    var low = scored.length > 1 ? scored.reduce(function (a, b) { return rec.res[b[0]].score < rec.res[a[0]].score ? b : a; })[0] : null;
    var tiles = COMP.map(function (c, i) {
      var x = obj(rec.res[c[0]]), on = x.status === "scored", sc = on && x.score != null ? Math.round(x.score) : "—", tag;
      if (on && c[0] === "GAP" && x.verdict === "absent") tag = ["Gap absent", "tr"];
      else if (on && c[0] === "PITCH" && x.verdict === "non_compliant") tag = ["Non-compliant", "tr"];
      else if (on) tag = level(x.score || 0);
      else tag = x.status === "excluded" ? ["Excluded", "tn"] : x.status === "to_review" ? ["To review", "ty"] : x.status === "not_applicable" ? ["Not applicable", "tn"] : ["No result", "tn"];
      var bn = low === c[0];
      return '<div style="background:' + (bn ? "#FCEDEC" : "#F8F6F0") + ";border-radius:9px;padding:10px 12px" + (bn ? ";box-shadow:inset 0 0 0 1.5px #E3A49E" : "") + '"><div class="cap" style="font-size:10px' + (bn ? ";color:#9B1C13" : "") + '">' + (i + 1) + " · " + c[1] + (bn ? " · bottleneck" : "") +
        '</div><div style="display:flex;align-items:baseline;gap:8px;margin-top:4px"><span class="serif" style="font-size:26px;font-weight:700">' + sc + '</span><span class="tag ' + tag[1] + '">' + tag[0] + "</span></div>" +
        (!on && arr(x.reasons)[0] ? '<div class="muted" style="font-size:12px;margin-top:4px">' + esc(why(x.reasons[0])) + "</div>" : "") + "</div>";
    }).join("");
    var rules = COMP.map(function (c) { return obj(rec.res[c[0]]).rules_version; }).filter(Boolean).join(" · ");
    var st = rec.r.status && rec.r.status !== "ok" ? '<div class="err">This call was not scored: ' + esc(why(rec.r.status)) + (rec.r.status === "diarization_suspect" ? " (too many turns had to be reassigned between the sales and the prospect; check the speakers in the transcript)." : ".") + "</div>" : "";
    return '<div class="card" style="padding:20px 22px;display:flex;flex-direction:column;gap:14px"><div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap"><div class="serif" style="font-size:23px;font-weight:700">Call analysis — ' + esc(rec.meta.person || "") + "</div>" +
      '<button class="btn" type="button" data-cav-drawer="' + (ui.drawer ? "" : "all") + '" aria-pressed="' + !!ui.drawer + '" style="align-self:flex-start"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 3h12v18l-6-4-6 4z"></path></svg>' + (ui.drawer ? "Hide transcript" : "Transcript") + "</button></div>" + st +
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px">' + tiles + "</div>" +
      '<div style="font-size:12px" class="muted">' + (rec.r.provisional ? "Provisional scores until the reliability thresholds are met · " : "") + (rules ? "Rules " + esc(rules) + " · " : "") + "the model quotes, the code scores · click a SPIN letter to read its question and the answer.</div></div>";
  }
  function drawer(rec, ui) {
    if (!ui.drawer) return "";
    return '<div class="card" id="cav-drawer" style="padding:18px 22px;display:flex;flex-direction:column;gap:12px"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap"><div class="cap">Transcript · whole call · ' + rec.turns.length + " turns</div>" +
      '<button class="btn" type="button" data-cav-drawer="" style="padding:5px 10px">Close</button></div><div style="display:flex;flex-direction:column;gap:10px;max-height:620px;overflow-y:auto">' +
      rec.turns.map(function (t) { return row(rec, t, []); }).join("") + "</div></div>";
  }

  // ------------------------------------------------------------------ 1 · the discovery
  var DOM = { money: ["Money", "#D9A93F"], clients: ["Clients", "#C2571A"], self_belief: ["Self-belief", "#1E1C17"], family: ["Family", "#8E8A7E"], time: ["Time", "#8E8A7E"],
    health: ["Health", "#B42318"], future: ["Future", "#2F5DA8"], other: ["Other", "#8E8A7E"],
    situation: ["Situation", "#2E7D4F"], pain: ["Pain", "#B42318"], blocker: ["Blocker", "#C2571A"], impact: ["Impact", "#B42318"], desire: ["Desire", "#D9A93F"], value: ["Value", "#D9A93F"] };
  var PAIN = { PAIN: 1, BLOCKER: 1, IMPACT: 1 }, WANT = { DESIRE: 1, VALUE: 1 };
  // a short excerpt of the prospect's words (the full quote on hover)
  function short(rec, e) {
    if (!e || !e.quote) return "";
    var w = String(e.quote).split(/\s+/), cut = w.length > 9 ? w.slice(0, 9).join(" ") + "…" : e.quote;
    return '<span title="' + esc(e.quote) + '">“' + esc(cut) + "”</span>";
  }
  function discovery(rec, ui) {
    var x = obj(rec.res.SPIN), d = rec.d("SPIN"), sols = arr(d.solicitations).filter(function (s) { return s.in_perimeter; });
    if (!sols.length && x.status !== "scored") return '<div class="card" style="padding:20px 22px;display:flex;flex-direction:column;gap:10px">' + sectionHead(1, "The discovery") + notScored(x) + "</div>";
    var per = obj(d.perimeter), pS = per.start || rec.ph.discovery_start, pE = per.end || rec.ph.pitch_start || rec.ph.discovery_end;
    // the facts the prospect gave: the scored items' evidence, else (not scored) the atoms the engine kept
    var ev = [];
    Object.keys(obj(d.items_evidence)).forEach(function (k) { ev = ev.concat(arr(obj(d.items_evidence[k]).evidence)); });
    if (!ev.length) ev = arr(d.atom_decisions).filter(function (a) { return a.decision === "kept"; }).map(function (a) { return { atom: a.type, turn: a.turn, quote: a.quote, question_id: a.solicitation, quantified: a.quantified }; });
    var rows = {}, order = [], solDom = {};
    ev.forEach(function (e) {
      var k = e.domain || String(e.atom || "other").toLowerCase(), r = rows[k];
      if (!r) { r = rows[k] = { quotes: [], seen: {}, pain: 0, want: 0, sols: {}, quant: false }; order.push(k); }
      if (!r.seen[e.quote]) { r.seen[e.quote] = 1; r.quotes.push(e); if (PAIN[e.atom]) r.pain++; if (WANT[e.atom]) r.want++; if (e.quantified) r.quant = true; }
      if (e.question_id) { r.sols[e.question_id] = 1; solDom[e.question_id] = k; }
    });
    var chains = arr(d.chains), coded = sols.filter(function (s) { return "SPIN".indexOf(s.letter) >= 0 && s.letter && s.letter !== "OUT"; });
    var out = sols.filter(function (s) { return s.letter === "OUT"; }), none = coded.filter(function (s) { return !solDom[s.id]; });
    var max = Math.max(1, Math.max.apply(null, order.map(function (k) { return Math.max(rows[k].pain, rows[k].want); }).concat([1])));
    function chip(s, solid) { var on = ui.sol === s.id; return '<button type="button" class="chip ' + (s.letter === "OUT" ? "cO" : solid ? "c" + s.letter : "cX") + '" data-cav-sol="' + esc(s.id) + '" aria-expanded="' + on + '" title="' + esc((s.ts ? clock(secs(s.ts)) + " · " : "") + s.turn) + '" style="' + (on ? "box-shadow:0 0 0 2px #FFFFFF,0 0 0 4px #1E1C17" : "") + '">' + (s.letter === "OUT" ? "" : esc(s.letter)) + "</button>"; }
    // the transcript of the chosen letter: the sales' question and the prospect's answer, under the row of its domain
    function opened(list) {
      var s = list.filter(function (x) { return x.id === ui.sol; })[0]; if (!s) return "";
      var turns = [s.turn].concat(arr(s.answer_turns)).map(function (id) { return rec.t(id); }).filter(Boolean);
      var name = s.letter === "OUT" ? "Out of SPIN" + (s.out_reason ? " · " + lbl(s.out_reason) : "") : ({ S: "Situation", P: "Problem", I: "Implication", N: "Need-payoff" })[s.letter] || s.letter;
      return '<tr><td class="td" colspan="4" style="padding:0 12px 14px;border-bottom:1px solid #EFEBE1"><div style="border:1px solid #E9CF8E;background:#FFFDF7;border-radius:10px;padding:12px 14px;display:flex;flex-direction:column;gap:10px">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap"><b class="serif" style="font-size:15px">' + (s.letter && s.letter !== "OUT" ? esc(s.letter) + " · " : "") + esc(name) + ' question <span class="mono muted" style="font-size:12px;font-weight:400">' + esc(rec.c(s.turn)) + " · " + esc(s.turn) + "</span></b>" +
        '<button class="btn" type="button" data-cav-sol="" style="padding:4px 10px">Close</button></div>' +
        (turns.length ? turns.map(function (t) { return row(rec, excerpt(t, null), []); }).join("") : '<div class="muted" style="font-size:13px">The turn is not in the transcript.</div>') +
        (arr(s.answer_turns).length ? "" : '<div class="muted" style="font-size:12.5px">No answer from the prospect was found for this question.</div>') + "</div></td></tr>";
    }
    var body;
    // SPIN v1.2 (SB-26..SB-33): rows by register of the question; older records keep the rows by answer domain
    var hasReg = sols.some(function (x) { return "register" in x; });
    if (hasReg) {
      var REG = [["financial", "Financial", "#C9A04A"], ["time_load", "Time & load", "#B45309"], ["identity_status", "Identity & status", "#7A4B00"], ["mental_emotional", "Mental & emotional", "#1E1C17"], ["other", "Other", "#8E8A7E"]];
      var byQ = {}; ev.forEach(function (e) { if (e.question_id) (byQ[e.question_id] = byQ[e.question_id] || []).push(e); });
      var regRow = function (key, label, color, qs, sub) {
        var seen = {}, quotes = [], pain = 0, want = 0, quant = false;
        qs.forEach(function (s) { (byQ[s.id] || []).forEach(function (e) { if (seen[e.quote]) return; seen[e.quote] = 1; quotes.push(e); if (PAIN[e.atom]) pain++; if (WANT[e.atom]) want++; if (e.quantified) quant = true; }); });
        var ids = {}; qs.forEach(function (s) { ids[s.id] = 1; });
        var deep = chains.filter(function (c) { return c.deep && arr(c.links || c.solicitations).some(function (id) { return ids[id]; }); }).length;
        var state = !qs.length ? ["Not explored", "tn"] : !quotes.length ? ["No prospect fact", "tn"] : deep ? ["Deep", "tg"] : quant ? ["Quantified", "tb"] : want ? ["Value stated", "tb"] : pain ? ["Touched", "to"] : ["Touched", "tn"];
        var mx = Math.max(1, pain, want), red = pain / mx * 46, gold = want / mx * 46;
        return '<tr><td class="td"><div style="display:flex;gap:10px"><span class="dot" style="background:' + color + ';margin-top:5px;border-radius:2px"></span><div style="min-width:0"><b style="font-size:14px">' + esc(label) + '</b><div class="muted" style="font-size:12.5px;margin-top:2px">' +
          (quotes.length ? short(rec, quotes[0]) : esc(sub || (qs.length ? "no fact kept from the answers" : "no question in this register"))) + "</div></div></div></td>" +
          '<td class="td"><div class="chips">' + qs.map(function (s) { return chip(s, !!byQ[s.id]); }).join("") + '</div><div class="muted" style="margin-top:6px">' + qs.length + " question" + (qs.length === 1 ? "" : "s") + (deep ? " · " + deep + " deep chain" + (deep === 1 ? "" : "s") : "") + "</div></td>" +
          '<td class="td">' + (qs.length ? '<div style="display:flex;align-items:center;gap:8px"><span class="mono">' + pain + '</span><div class="bar">' + (red ? '<div style="position:absolute;right:52%;width:' + red + '%;top:0;bottom:0;background:#B42318;border-radius:4px"></div>' : "") +
          (gold ? '<div style="position:absolute;left:54%;width:' + gold + '%;top:0;bottom:0;background:#D9A93F;border-radius:4px"></div>' : "") + '</div><span class="mono">' + want + "</span></div>" : '<span class="muted">—</span>') + "</td>" +
          '<td class="td"><span class="tag ' + state[1] + '">' + state[0] + "</span></td></tr>" + opened(qs);
      };
      body = REG.map(function (g) { return regRow(g[0], g[1], g[2], coded.filter(function (s) { return s.register === g[0]; })); }).join("");
      var noReg = coded.filter(function (s) { return !s.register; });
      if (noReg.length) body += regRow("none", "No register", "#E0B9A4", noReg, noReg.some(function (s) { return s.register_status === "to_review"; }) ? "waiting for a person (no rule could decide)" : "after the pitch or not read");
    } else body = order.sort(function (a, b) { return (rows[b].pain + rows[b].want) - (rows[a].pain + rows[a].want); }).map(function (k) {
      var r = rows[k], qs = coded.filter(function (s) { return r.sols[s.id]; }), dm = DOM[k] || [lbl(k), "#8E8A7E"];
      var deep = chains.filter(function (c) { return c.deep && arr(c.links || c.solicitations).some(function (id) { return r.sols[id]; }); }).length;
      var state = deep ? ["Deep", "tg"] : r.quant ? ["Quantified", "tb"] : r.want ? ["Value stated", "tb"] : r.pain ? ["Touched", "to"] : ["Touched", "tn"];
      var red = r.pain / max * 46, gold = r.want / max * 46;
      return '<tr><td class="td"><div style="display:flex;gap:10px"><span class="dot" style="background:' + dm[1] + ';margin-top:5px;border-radius:2px"></span><div style="min-width:0"><b style="font-size:14px">' + esc(dm[0]) + '</b><div class="muted" style="font-size:12.5px;margin-top:2px">' +
        short(rec, r.quotes[0]) + "</div></div></div></td>" +
        '<td class="td"><div class="chips">' + qs.map(function (s) { return chip(s, true); }).join("") + "</div>" + '<div class="muted" style="margin-top:6px">' + qs.length + " question" + (qs.length === 1 ? "" : "s") + (deep ? " · " + deep + " deep chain" + (deep === 1 ? "" : "s") : "") + "</div></td>" +
        '<td class="td"><div style="display:flex;align-items:center;gap:8px"><span class="mono">' + r.pain + '</span><div class="bar">' + (red ? '<div style="position:absolute;right:52%;width:' + red + '%;top:0;bottom:0;background:#B42318;border-radius:4px"></div>' : "") +
        (gold ? '<div style="position:absolute;left:54%;width:' + gold + '%;top:0;bottom:0;background:#D9A93F;border-radius:4px"></div>' : "") + '</div><span class="mono">' + r.want + "</span></div></td>" +
        '<td class="td"><span class="tag ' + state[1] + '">' + state[0] + "</span></td></tr>" + opened(qs);
    }).join("");
    if (!hasReg && none.length) body += '<tr><td class="td"><div style="display:flex;gap:10px"><span class="dot" style="background:#E0B9A4;margin-top:5px;border-radius:2px"></span><div><b style="font-size:14px">No prospect fact</b><div class="muted">questions whose answer gave nothing the code kept</div></div></div></td><td class="td">' +
      '<div class="chips">' + none.map(function (s) { return chip(s, false); }).join("") + "</div>" + '<div class="muted" style="margin-top:6px">' + none.length + ' question' + (none.length === 1 ? "" : "s") + '</div></td><td class="td"><span class="muted">—</span></td><td class="td"><span class="muted">no effect</span></td></tr>' + opened(none);
    if (out.length) body += '<tr><td class="td"><div style="display:flex;gap:10px"><span class="dot" style="background:#DDD7C9;margin-top:5px;border-radius:2px"></span><div><b style="font-size:14px">Out of SPIN</b><div class="muted">agreement tails, offer and financing questions</div></div></div></td><td class="td">' +
      '<div class="chips">' + out.map(function (s) { return chip(s, true); }).join("") + "</div>" + '<div class="muted" style="margin-top:6px">' + out.length + ' questions · OUT</div></td><td class="td"><span class="muted">—</span></td><td class="td"><span class="muted">no points</span></td></tr>' + opened(out);
    return '<div class="card" style="padding:20px 22px;display:flex;flex-direction:column;gap:6px">' + sectionHead(1, "The discovery") +
      sub("From the first diagnostic question to the pitch start · " + esc(rec.c(pS)) + " → " + esc(rec.c(pE)) + " · " + coded.length + " coded questions · read from what the prospect said, never from the letter") +
      (notScored(x) ? '<div style="margin-top:8px">' + notScored(x) + "</div>" : "") +
      (obj(d.registers).flags && d.registers.flags.indexOf("register_agreement_low") >= 0 ? '<div style="margin-top:8px" class="ban">Registers less reliable on this call: ' + Math.round((d.registers.agreement || 0) * 100) + "% decided 3/3 by the readers (target 92%).</div>" : "") +
      // Romain 2026-10-27: everything visible without scrolling sideways: fixed columns, the chips wrap, a short excerpt under the domain
      '<div style="margin-top:10px"><table style="width:100%;border-collapse:collapse;table-layout:fixed"><thead><tr><th class="th" style="width:28%">' + (hasReg ? "Register" : "Domain") + '</th><th class="th" style="width:36%">Questions asked, in order</th><th class="th" style="width:22%">◂ Pain · Desire ▸</th><th class="th" style="width:14%">State</th></tr></thead><tbody>' +
      (body || '<tr><td class="td muted" colspan="4">No prospect fact was found in the discovery.</td></tr>') + "</tbody></table></div>" +
      '<div style="display:flex;flex-wrap:wrap;gap:8px 16px;align-items:center;font-size:12px;margin-top:8px" class="muted"><span><span class="chip cS" style="width:20px;height:20px;font-size:10px">S</span>question that produced an atom</span><span><span class="chip cX" style="width:20px;height:20px;font-size:10px">P</span>question with no effect</span><span><span class="chip cO" style="width:20px;height:20px"></span>OUT</span>' +
      '<span><b style="color:#2E7D4F">S</b> Situation · <b style="color:#C2571A">P</b> Problem · <b style="color:#B42318">I</b> Implication · <b>N</b> Need-payoff</span></div></div>';
  }

  // ------------------------------------------------------------------ 2 · the gap played back
  var CL = { verbatim: ["green", "verbatim"], paraphrased: ["red", "paraphrase"], untraced: ["orange", "sales' word"], excluded: ["grey", "not counted"] };
  function clauseMarks(clauses) {
    return arr(clauses).map(function (c) { var k = CL[c.match] || ["grey", c.match || ""]; return mk(c.sales_quote || c.quote, k[0], lbl(c.component).replace(/^Cost$/, "cost").replace(/^Problem$/, "problem") + " · " + k[1]); });
  }
  function gap(rec) {
    var x = obj(rec.res.GAP), d = rec.d("GAP"), ph = rec.ph;
    var present = (x.verdict || d.verdict) === "present";
    var tag = x.status === "scored" ? (present ? '<span class="tag tg">Gap present</span>' : '<span class="tag tr">Gap absent</span>') : "";
    var R = obj(d.restitution), cands = arr(d.restitutions);
    if (!R.span && cands.length) R = cands[0];
    var span = arr(R.span), isRest = present || (R.is_restitution && span.length);
    var val = obj(R.validation), vt = val.turn || d.validation_turn;
    // timing of the gap
    var a = rec.pct(ph.discovery_start), b = rec.pct(ph.pitch_start || ph.discovery_end), r0 = rec.pct(span[0]), r1 = rec.pct(span[1] || span[0]), pv = rec.pct(vt), p0 = rec.pct(ph.pitch_start), p1 = rec.pct(ph.first_price || ph.pitch_end);
    function seg(l, w, top, h, bg, title) { return l == null || w == null ? "" : '<div style="position:absolute;left:' + l + "%;width:" + Math.max(0.6, w) + "%;top:" + top + "px;height:" + h + "px;background:" + bg + ';border-radius:4px" title="' + esc(title) + '"></div>'; }
    function tick(l, bg, title) { return l == null ? "" : '<div style="position:absolute;left:' + l + "%;top:10px;width:2px;height:20px;background:" + bg + '" title="' + esc(title) + '"></div>'; }
    var restS = span[0] ? rec.s(span[1] || span[0]) - rec.s(span[0]) : null;
    var right = span[0] && isRest ? "restatement " + (dur(restS) || "one turn") + (vt ? " · validation at " + rec.c(vt) : "") + (ph.pitch_start && vt ? " · " + dur(rec.s(ph.pitch_start) - rec.s(vt)) + " before the pitch" : "") : "no restatement before the pitch";
    var timing = '<div style="border:1px solid #E7E2D6;border-radius:10px;padding:14px 16px;display:flex;flex-direction:column;gap:10px"><div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;align-items:center"><div class="cap">Timing of the gap</div><span class="mono" style="font-size:12px">' + esc(right) + "</span></div>" +
      '<div style="position:relative;height:40px"><div style="position:absolute;left:0;right:0;top:16px;height:8px;border-radius:4px;background:#EFECE4"></div>' +
      seg(a, b != null && a != null ? b - a : null, 16, 8, "#CFE0F7", "Discovery") + (isRest ? seg(r0, r1 != null && r0 != null ? r1 - r0 : null, 12, 16, "#2E7D4F", "Restatement") : "") + tick(pv, "#1E1C17", "Validation") +
      seg(p0, p1 != null && p0 != null ? p1 - p0 : null, 16, 8, "#F6D9C4", "Pitch") + tick(rec.pct(ph.first_price), "#B42318", "Price") + "</div>" +
      legend([["#CFE0F7", "Discovery " + esc(rec.c(ph.discovery_start)) + " → " + esc(rec.c(ph.pitch_start || ph.discovery_end))]].concat(isRest ? [["#2E7D4F", '<b style="color:#1E1C17">Restatement ' + esc(rec.c(span[0])) + " → " + esc(rec.c(span[1] || span[0])) + "</b>" + (arr(R.turns).length ? " · " + R.turns.length + " turn" + (R.turns.length === 1 ? "" : "s") + " (" + esc(R.turns[0]) + ")" : "")]] : [])
        .concat(vt ? [["#1E1C17", "Validation " + esc(rec.c(vt)) + (val.quote ? " " + q(rec, val.quote, vt) : "")]] : []).concat(ph.pitch_start ? [["#F6D9C4", "Pitch " + esc(rec.c(ph.pitch_start))]] : []).concat(ph.first_price ? [["#B42318", "Price " + esc(rec.c(ph.first_price))]] : [])) + "</div>";
    // what the sales said: the restatement (or the passage that came closest), clause by clause
    var verb = "";
    if (span[0]) {
      var ts = arr(R.turns).length ? R.turns.map(function (id) { return rec.t(id); }).filter(Boolean) : between(rec, span[0], span[1] || span[0]);
      var sales = ts.filter(function (t) { return t.role === "SALES"; }), words = sales.reduce(function (n, t) { return n + String(t.text).split(/\s+/).length; }, 0);
      var marks = clauseMarks(R.clauses);
      verb = '<div style="border:1px solid #E7E2D6;border-radius:10px;padding:14px 16px;display:flex;flex-direction:column;gap:10px"><div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px"><div class="cap">' + (isRest ? "What the sales said · exact verbatim" : "The passage that came closest · not a restatement") + '</div><span class="mono muted" style="font-size:12px">' +
        esc(rec.c(span[0])) + " · " + esc(span[0]) + " · Sales · " + (sales.length === 1 ? "one turn" : sales.length + " turns") + " · " + words + " words" + (restS ? " · " + dur(restS) : "") + "</span></div>" +
        sales.map(function (t) { return '<div style="font-size:15px;line-height:1.9">“' + marked(t.text, marks) + "”</div>"; }).join("") +
        (vt && rec.t(vt) ? '<div style="border-top:1px solid #EFEBE1;padding-top:10px;font-size:15px"><span class="mono muted" style="font-size:12px">' + esc(rec.c(vt)) + " · " + esc(vt) + " · Prospect</span> <span style=\"margin-left:8px\">" + q(rec, rec.t(vt).text, vt) + "</span>" +
          (R.effective_outcome || val.outcome ? ' <span class="tag ' + (/confirm/.test(R.effective_outcome || val.outcome) ? "tn" : "tr") + '" style="margin-left:6px">' + esc(lbl(R.effective_outcome || val.outcome)) + "</span>" : "") + "</div>" : "") +
        legend([["#9BD0AE", "her exact words"], ["#F2A9A2", "paraphrase: does not count"], ["#F2C29E", "sales' own framing: does not count"], ["#C9C4B8", "not counted"]]) + "</div>";
    }
    // the four checks
    var comps = obj(R.components), conf = obj(R.conformity);
    var checks = [
      ["In one go", conf.one_go != null ? !!conf.one_go : isRest && arr(R.turns).length <= 2, isRest ? "Problem and cost in the same restatement" : "no restatement"],
      ["Before pitch & price", isRest && R.before_first_pitch !== false && R.before_first_price !== false, isRest ? "Restatement " + rec.c(span[0]) + (ph.pitch_start ? " · pitch " + rec.c(ph.pitch_start) : "") : "—"],
      ["Problem + cost verbatim", ["PROBLEM", "COST"].every(function (k) { return obj(comps[k]).match === "verbatim"; }), ["PROBLEM", "COST"].map(function (k) { var c = obj(comps[k]); return c.key_expression ? "“" + c.key_expression + "”" : null; }).filter(Boolean).join(" · ") || "not in her words"],
      ["Validated", /confirm/.test(R.effective_outcome || val.outcome || ""), vt ? rec.c(vt) + (val.content_quote ? "" : " · no content") : "no validation"]];
    var chk = '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px">' + checks.map(function (c) {
      return '<div style="border:1px solid #E7E2D6;border-radius:9px;padding:10px 12px;font-size:13px"><span class="tag ' + (c[1] ? "tg" : "tr") + '">' + (c[1] ? "✓ " : "✗ ") + c[0] + '</span><div style="margin-top:6px" class="muted">' + esc(c[2]) + "</div></div>";
    }).join("") + "</div>";
    // component table: from the clauses, else (absent) from what the prospect gave
    var rowsT = arr(R.clauses).map(function (c) {
      var m = c.match === "verbatim" ? ["yes", "tg"] : ["no · " + (c.match === "paraphrased" ? "paraphrase" : c.match === "untraced" ? "not her words" : lbl(c.match)), "tr"];
      var src = rec.t(c.source_turn);
      return '<tr><td class="td"><b>' + esc(lbl(c.component)) + '</b></td><td class="td quote">' + (c.source_quote ? q(rec, c.source_quote, c.source_turn) : c.key_expression ? q(rec, c.key_expression, c.source_turn) : '<span class="muted" style="font-style:normal">not traced</span>') +
        (src ? '<div class="mono muted" style="font-size:11px;font-style:normal">' + esc(rec.c(c.source_turn)) + "</div>" : "") + '</td><td class="td quote">' + q(rec, c.sales_quote || c.quote, c.sales_turn || span[0]) + '</td><td class="td"><span class="tag ' + m[1] + '">' + esc(m[0]) + "</span>" +
        (c.reason && c.reason !== "ok" ? '<div class="muted" style="font-size:12px;margin-top:4px">' + esc(why(c.reason)) + "</div>" : "") + "</td></tr>";
    });
    if (!isRest) {
      var given = [["Problem", d.selected_P]].concat(arr(d.cost).slice(0, 3).map(function (c) { return ["Cost", c]; })).concat([["A", d.selected_A], ["B", d.selected_B]]).filter(function (g) { return g[1] && g[1].quote; });
      rowsT = given.map(function (g) {
        return '<tr><td class="td"><b>' + g[0] + '</b></td><td class="td quote">' + q(rec, g[1].quote, g[1].turn) + '<div class="mono muted" style="font-size:11px;font-style:normal">' + esc(rec.c(g[1].turn)) + '</div></td><td class="td"><span class="muted">—</span></td><td class="td"><span class="tag tr">not played back</span></td></tr>';
      });
    }
    var table = rowsT.length ? '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;min-width:640px"><thead><tr><th class="th">Component</th><th class="th">Prospect said</th><th class="th">Sales played back</th><th class="th">Verbatim</th></tr></thead><tbody>' + rowsT.join("") + "</tbody></table></div>" : "";
    var rb = obj(d.roadmap), road = '<div style="font-size:13px" class="muted">Roadmap material: ' + (rb.count != null ? rb.count : arr(d.roadmap_blockers).length) + " other blockers ticked in P or I answers" + (rb.warning ? ' · <b style="color:#A2450E">Copilot warning</b>: ' + esc(typeof rb.warning === "string" ? rb.warning : "fewer blockers than roadmap steps") : "") + ".</div>";
    var absent = !present && x.status === "scored" ? '<div class="ban">Gap absent: ' + esc(why(d.absence_reason || arr(x.reasons)[0])) + "." + (!isRest && cands.length ? " " + cands.length + " passage" + (cands.length === 1 ? "" : "s") + " came close; none qualified." : "") + "</div>" : "";
    return '<div class="card" style="padding:20px 22px;display:flex;flex-direction:column;gap:12px">' + sectionHead(2, "The gap played back", tag) +
      sub("Problem and cost restated in one go, in the prospect's exact words, validated by the prospect, before the pitch and the price.") + notScored(x) + absent + timing + verb + chk + table + road + "</div>";
  }

  // ------------------------------------------------------------------ 3 · the pitch
  function pitch(rec) {
    var x = obj(rec.res.PITCH), d = rec.d("PITCH"), ph = rec.ph;
    if (!Object.keys(d).length) return '<div class="card" style="padding:20px 22px;display:flex;flex-direction:column;gap:10px">' + sectionHead(3, "The pitch") + notScored(x) + "</div>";
    var nc = arr(d.non_compliance).length ? d.non_compliance : arr(x.reasons).filter(function (r) { return !/^to_review/.test(r); });
    var ok = (x.verdict || d.verdict) === "compliant";
    var tag = ok ? '<span class="tag tg">Compliant</span>' : '<span class="tag tr">Non-compliant' + (nc[0] ? " · " + esc(why(nc[0])) : "") + "</span>";
    var vp = obj(d.validated_P), cat = obj(d.diagnostics).P_category || vp.category;
    var subt = (vp.quote ? "Validated blocker " + q(rec, vp.quote, vp.turn) + " → <b style=\"color:#1E1C17\">" + esc(cat ? lbl(cat) : "category unknown") + "</b> · " : "") + "one blocker, one mechanism, four steps, then roadmap, amount, decision.";
    var chips = [];
    if (nc.indexOf("pitch_before_gap") >= 0) chips.push('<span class="tag tr">✗ Pitched before the gap was played back</span>');
    else chips.push(nc.indexOf("pitch_before_validation") >= 0 ? '<span class="tag tr">✗ Pitched before the yes</span>' : '<span class="tag tg">✓ Pitched after the yes</span>');
    var unc = arr(d.claims).filter(function (c) { return /unchecked/.test(c.source || c.lookup || c.status || ""); });
    if (unc.length) chips.push('<span class="tag ty">? ' + (unc.length === 1 ? "One claim" : unc.length + " claims") + " to check against the offer</span>");
    arr(d.outcome_promises).forEach(function (p) { chips.push('<span class="tag tr" style="white-space:normal">✗ ' + q(rec, p.quote, p.turn) + " · " + esc(p.turn) + "</span>"); });
    var steps = obj(d.steps), names = ["Step 1 · Blocker", "Step 2 · Mechanism", "Step 3 · A → B", "Step 4 · Proof"];
    var cards = ["1", "2", "3", "4"].map(function (k, i) {
      var s = obj(steps[k]), sp = arr(s.span), bad = !!s.failure;
      var head = s.failure ? why(s.failure) : sp[0] ? "Done" : "Not applicable";
      var detail = [];
      if (s.key_expression) detail.push(q(rec, s.key_expression, sp[0]));
      if (sp[0]) detail.push(esc(rec.c(sp[0])) + (sp[1] && sp[1] !== sp[0] ? " → " + esc(rec.c(sp[1])) : ""));
      if (k === "2" && arr(s.mechanisms).length) detail.push(esc(s.mechanisms.join(", ")));
      if (k === "2" && s.recitation) detail.push("recitation");
      return card(names[i], head, detail.join(" · "), bad);
    });
    var rd = obj(d.roadmap), rsteps = arr(rd.steps).length;
    var priceFirst = !rsteps || rd.before_price === false;
    cards.push(card("Then roadmap", rsteps ? rsteps + " steps" : "Price first", (ph.first_price ? "price at " + esc(rec.c(ph.first_price)) : "") + (rsteps ? (rd.before_price === false ? " · after the price" : " · before the price") : ph.first_price ? ", no roadmap" : ""), priceFirst));
    function card(title, value, detail, bad) {
      return '<div style="flex:1 1 130px;border:1px solid ' + (bad ? "#F0C8B4" : "#E7E2D6") + ";background:" + (bad ? "#FFF7F2" : "#F8F6F0") + ';border-radius:9px;padding:10px 12px"><div class="cap" style="font-size:10px">' + esc(title) + '</div><div style="font-weight:600;margin-top:4px' + (bad ? ";color:#A2450E" : "") + '">' + esc(value.charAt(0).toUpperCase() + value.slice(1)) + '</div><div style="font-size:12px;margin-top:3px" class="muted">' + detail + "</div></div>";
    }
    // the full pitch verbatim, marked
    var verb = "";
    if (ph.pitch_start && rec.t(ph.pitch_start)) {
      var endT = ph.first_price || ph.pitch_end || ph.pitch_start, ts = between(rec, ph.pitch_start, endT);
      var marks = arr(d.adhesion).map(function (a) { return mk(a.quote, "green", "adhesion" + (a.kind ? " · " + lbl(a.kind).toLowerCase() : "")); })
        .concat(arr(d.outcome_promises).map(function (p) { return mk(p.quote, "red", "forbidden · outcome promise"); }))
        .concat(arr(d.claims).map(function (c) { return mk(c.quote, "gold", "claim · to check against the offer"); }));
      ["1", "2", "3", "4"].forEach(function (k) { var s = obj(steps[k]); if (s.key_expression) marks.push(mk(s.key_expression, s.failure ? "orange" : "green", "step " + k + (s.failure ? " · " + why(s.failure).toLowerCase() : ""))); });
      var byTurn = {};
      marks.forEach(function (m) { ts.forEach(function (t) { if (m.q && String(t.text).toLowerCase().indexOf(String(m.q).toLowerCase()) >= 0) (byTurn[t.id] = byTurn[t.id] || []).push(m); }); });
      verb = '<div style="border:1px solid #E7E2D6;border-radius:10px;display:flex;flex-direction:column"><div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;padding:12px 16px;border-bottom:1px solid #EFEBE1"><div class="cap">What the sales said · full pitch verbatim</div><span class="mono muted" style="font-size:12px">' +
        esc(rec.c(ph.pitch_start)) + " → " + esc(rec.c(endT)) + " · " + esc(ph.pitch_start) + " → " + esc(endT) + " · " + ts.length + " turns · " + dur(rec.s(endT) - rec.s(ph.pitch_start)) + '</span></div><div style="max-height:620px;overflow-y:auto;padding:14px 16px;display:flex;flex-direction:column;gap:12px">' +
        ts.map(function (t) { return row(rec, t, byTurn[t.id]); }).join("") + '</div><div style="padding:10px 16px;border-top:1px solid #EFEBE1">' +
        legend([["#9BD0AE", "her words / adhesion"], ["#F2A9A2", "fails a rule"], ["#F2C29E", "sales' own framing"], ["#EBCF8A", "to check against the offer"]]) + "</div></div>";
    }
    return '<div class="card" style="padding:20px 22px;display:flex;flex-direction:column;gap:12px">' + sectionHead(3, "The pitch", tag) + sub(subt) + notScored(x) +
      '<div style="display:flex;flex-wrap:wrap;gap:8px;font-size:13px">' + chips.join("") + "</div>" +
      '<div style="display:flex;flex-wrap:wrap;gap:8px;align-items:stretch">' + cards.join("") + "</div>" + verb + "</div>";
  }

  // ------------------------------------------------------------------ 4 · objections
  var GEST = [["A", "acknowledge", "H2", "Acknowledged", "The first response receives the resistance without contradiction (OB-13)."],
    ["I", "isolate", "H3", "Isolated", "Asks whether, apart from this point, the rest is right for the prospect (OB-14)."],
    ["E", "explore", "H3", "Explored", "Asks about the doubt itself before answering it (OB-15)."],
    ["M", "gesture_match", "H1", "Matching gesture", "An answer tied to what the prospect said, given after exploring (OB-16)."]];
  function gState(e, k) {
    var v = e[k];
    if (k === "explore") v = obj(v).asked == null ? null : obj(v).asked ? (obj(v).answered_with_content ? "yes" : "partial") : "no";
    if (k === "isolate" && v == null) return "na";
    if (v && typeof v === "object") v = v.done != null ? (v.done ? "yes" : "no") : v.level === 2 ? "yes" : v.level === 1 ? "partial" : v.level === 0 ? "no" : v.verdict || v.status;
    if (v === true) v = "yes"; if (v === false) v = "no";
    return v === "yes" ? "y" : v === "partial" ? "h" : v === "no" ? "n" : "na";
  }
  function gTurns(e, g) {
    var out = [], rq = obj(e.resistance).turn;
    function push(t, qq) { if (t && !out.some(function (o) { return o.turn === t && o.quote === qq; })) out.push({ turn: t, quote: qq }); }
    var it = arr(e.items).filter(function (i) { return i.id === g[2]; })[0];
    arr(it && it.evidence).forEach(function (ev) { if (ev && !(ev.turn === rq && ev.role === "PROSPECT")) push(ev.turn, ev.quote); });
    if (!out.length && g[1] === "gesture_match") arr(e.response_turns).slice(0, 3).forEach(function (t) { push(t); });
    return out;
  }
  function excerpt(t, qq) {
    var txt = String(t.text || ""), max = 700;
    if (txt.length <= max) return t;
    var i = qq ? txt.toLowerCase().indexOf(String(qq).toLowerCase()) : -1, a = i < 0 ? 0 : Math.max(0, i - 250), b = i < 0 ? max : Math.min(txt.length, i + String(qq).length + 250);
    return Object.assign({}, t, { text: (a ? "… " : "") + txt.slice(a, b) + (b < txt.length ? " …" : "") });
  }
  function objections(rec, ui) {
    var x = obj(rec.res.OBJECTIONS), d = rec.d("OBJECTIONS"), eps = arr(d.episodes);
    // Romain 2026-10-29: one row per objection (Time is one objection however often it comes back), its verbatims together
    var groups = [], byName = {};
    eps.forEach(function (e, i) {
      var name = lbl(e.subtype || e.nature), k = String(name).toLowerCase();
      if (!byName[k]) { byName[k] = { name: name, nature: e.nature, eps: [] }; groups.push(byName[k]); }
      byName[k].eps.push(i);
    });
    function chips(e, i) {
      return GEST.map(function (g) {
        var s = gState(e, g[1]), on = ui.gesture && ui.gesture.ep === i && ui.gesture.g === g[0];
        var cls = s === "y" ? "cS" : s === "n" ? "cNo" : s === "h" ? "cHalf" : "cNa";
        return '<button type="button" class="chip ' + cls + '" ' + (s === "na" ? "disabled" : 'data-cav-ep="' + i + '" data-cav-g="' + g[0] + '"') + ' aria-label="' + esc(g[3]) + '" style="' + (on ? "box-shadow:0 0 0 2px #FFFFFF,0 0 0 4px #1E1C17" : "") + '">' + g[0] + "</button>";
      }).join("");
    }
    var rows = groups.map(function (G) {
      var last = eps[G.eps[G.eps.length - 1]], res = obj(last.reaction).level || last.status;
      var rc = res === "resolved" ? "tg" : res === "persisting" ? "tr" : res === "latent" ? "tn" : "ty";
      var lines = G.eps.map(function (i) {
        var e = eps[i], r = obj(e.resistance), react = obj(e.reaction);
        return '<div style="display:flex;flex-direction:column;gap:6px;padding:8px 0;border-top:1px solid #F1EEE6"><div style="display:flex;gap:10px;align-items:flex-start;justify-content:space-between;flex-wrap:wrap">' +
          '<div style="flex:1;min-width:200px"><span class="mono muted" style="font-size:11px;margin-right:6px">' + esc(rec.c(r.turn)) + "</span>" + q(rec, r.quote, r.turn) + "</div>" +
          '<div style="display:flex;gap:4px;flex-shrink:0">' + chips(e, i) + "</div></div>" +
          (react.quote ? '<div style="font-size:13px" class="muted">Sales: ' + q(rec, react.quote, react.turn) + ' <span class="mono" style="font-size:11px">' + esc(rec.c(react.turn)) + "</span></div>" : "") + "</div>";
      }).join("");
      var dots = G.eps.map(function (i) { var p = rec.pct(obj(eps[i].resistance).turn); return '<div style="position:absolute;left:' + (p || 0) + '%;top:-3px;width:10px;height:10px;margin-left:-5px;border-radius:50%;background:#D9A93F"></div>'; }).join("");
      return '<tr><td class="td" style="vertical-align:top"><b style="font-size:14px">' + esc(G.name) + '</b><div class="muted" style="font-size:12px;margin-top:2px">' + G.eps.length + " time" + (G.eps.length === 1 ? "" : "s") + " · " + esc(lbl(G.nature)) + '</div><div style="margin-top:6px"><span class="tag ' + rc + '">' + esc(String(res || "").toLowerCase()) + "</span></div>" +
        '<div style="position:relative;height:4px;background:#EFECE4;border-radius:2px;margin:12px 0 6px">' + dots + '</div><div class="mono muted" style="font-size:11px;display:flex;justify-content:space-between"><span>0</span><span>' + Math.round(rec.end / 60) + " min</span></div></td>" +
        '<td class="td" style="vertical-align:top">' + lines + "</td></tr>";
    }).join("");
    var panel = "";
    if (ui.gesture && eps[ui.gesture.ep]) {
      var e = eps[ui.gesture.ep], g = GEST.filter(function (z) { return z[0] === ui.gesture.g; })[0], s = gState(e, g[1]), ts = gTurns(e, g);
      var tg = s === "y" ? ["yes", "tg"] : s === "h" ? ["partial", "ty"] : ["no", "tr"];
      var rq = obj(e.resistance), first = rec.t(rq.turn);
      panel = '<div style="border:1px solid #E9CF8E;background:#FFFDF7;border-radius:10px;padding:14px 16px;display:flex;flex-direction:column;gap:12px;margin-top:8px"><div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;align-items:center"><b class="serif" style="font-size:16px">' + g[0] + " · " + g[3] + '</b><span class="tag ' + tg[1] + '">' + tg[0] + "</span></div>" +
        '<div style="font-size:13px" class="muted">' + esc(g[4]) + '</div><div style="display:flex;flex-direction:column;gap:10px">' +
        (first ? row(rec, excerpt(first, rq.quote), []) : "") +
        (ts.length ? ts.map(function (z) { var t = rec.t(z.turn); return t ? row(rec, excerpt(t, z.quote), z.quote ? [mk(z.quote, "gold")] : []) : ""; }).join("") : '<div class="muted" style="font-size:13px">No turn shows this gesture.</div>') + "</div></div>";
    }
    var pv = obj(d.prevention);
    function fact(keys) { for (var i = 0; i < keys.length; i++) { var v = pv[keys[i]]; if (v && (typeof v !== "object" || Object.keys(v).length)) return v; } return null; }
    function tile(title, keys, empty) {
      var v = fact(keys);
      return '<div style="background:#F8F6F0;border-radius:9px;padding:10px 12px;font-size:13px"><div class="cap" style="font-size:10px">' + title + '</div><div style="margin-top:4px">' + (v && v.quote ? q(rec, v.quote, v.turn) : v ? esc(typeof v === "string" ? v : "stated") : '<span class="muted">' + empty + "</span>") + "</div></div>";
    }
    var sc = x.status === "scored" && x.score != null ? '<span class="tag ' + level(x.score)[1] + '">' + Math.round(x.score) + " · " + level(x.score)[0] + "</span>" : "";
    return '<div class="card" style="padding:20px 22px;display:flex;flex-direction:column;gap:6px">' + sectionHead(4, "Objections", sc) +
      sub("A resistance is what the prospect says; the gestures are read on what the sales answers next; the resolution, in her words.") + (notScored(x) ? '<div style="margin-top:8px">' + notScored(x) + "</div>" : "") +
      (eps.length ? '<div style="margin-top:10px"><table style="width:100%;border-collapse:collapse;table-layout:fixed"><thead><tr><th class="th" style="width:24%">Objection</th><th class="th">Prospect\'s words, the sales\' answer and A · I · E · M</th></tr></thead><tbody>' + rows + "</tbody></table></div>"
        : '<div class="ban" style="margin-top:10px">No resistance was found in this call.</div>') + panel +
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px;margin-top:8px">' + tile("Decision circuit", ["decision_maker", "influencers"], "not established before the price") + tile("Budget & deadline", ["budget", "deadline"], "not established before the price") + tile("Past attempt", ["past_attempt"], "not mentioned") + "</div>" +
      '<div style="font-size:12px;margin-top:4px" class="muted">A acknowledged · I isolated · E explored · M matching gesture (gold = partial) · click a letter to open its verbatim</div></div>';
  }

  function html(r, ui) {
    if (!r) return "";
    var rec = new Rec(r);
    ui = ui || {};
    return '<div class="cav">' + header(rec, ui) + drawer(rec, ui) + discovery(rec, ui) + gap(rec) + pitch(rec) + objections(rec, ui) + "</div>";
  }
  function css() {
    if (document.getElementById("cav-css")) return;
    var l = document.createElement("link"); l.rel = "stylesheet";
    l.href = "https://fonts.googleapis.com/css2?family=Source+Serif+4:opsz,wght@8..60,600;8..60,700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap";
    document.head.appendChild(l);
    var s = document.createElement("style"); s.id = "cav-css"; s.textContent = CSS; document.head.appendChild(s);
  }
  css();
  window.SKL_CAV = { html: html, css: CSS };
})();
