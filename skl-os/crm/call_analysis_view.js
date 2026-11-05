/* LNP CRM — the call analysis as designed (Romain 2026-10-27: "Analyse d'un appel · maquette", call-analysis/docs/SCREEN_SPEC.md,
   reference built on real call 001). Shown inside the lead record, under "Call analysis": header card with the four scores,
   transcript drawer, then 1 The discovery, 2 The gap played back, 3 The pitch, 4 Objections, with the mock-up's
   colours, type and layout, filled from the engine's record (crm_ca_record). The code decides and scores; this file only shows
   what the engine stored. window.SKL_CAV.html(record, ui) returns the markup; ui = {drawer, gesture} is kept by the caller. */
(function () {
  "use strict";
  var COMP = [["SPIN", "Découverte"], ["GAP", "Écart"], ["PITCH", "Présentation de l'offre"], ["OBJECTIONS", "Objections"]];
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
  function level(sc) { return sc >= 85 ? ["Maîtrisé", "tg"] : sc >= 60 ? ["En progrès", "ty"] : ["À travailler", "tr"]; }
  // LNP: the engine's codes (call-analysis/docs/OUTPUT_CONTRACT.md) stay in English in the record; only their labels are French
  function fr(map, code) { return code != null && map[code] != null ? map[code] : lbl(code); }
  var WHY = {
    health_absent_share: "trop de questions de découverte sont restées sans réponse pour noter de façon fiable",
    diarization_suspect: "la transcription confond trop souvent qui a dit quoi",
    no_transcript: "pas de transcription", no_diarization: "la transcription ne dit pas qui parle", engine_error: "erreur du moteur d'analyse",
    no_discovery: "aucune découverte trouvée", no_restitution: "l'écart n'a pas été reformulé",
    restitution_after_pitch: "écart reformulé après la présentation de l'offre", problem_missing: "problème absent de la reformulation",
    cost_missing: "coût absent de la reformulation", not_validated: "reformulation non validée par le prospect",
    no_discovery_no_restitution_no_pitch: "ni découverte, ni reformulation, ni présentation de l'offre",
    pitch_before_gap: "offre présentée avant l'écart", pitch_before_validation: "offre présentée avant le oui",
    out_of_gap_claim: "affirmation hors de l'écart du prospect", outcome_promise: "promesse de résultat",
    offer_mention_only: "offre seulement mentionnée", no_pitch: "pas de présentation de l'offre",
    gap_result_missing: "résultat de l'écart manquant", gap_to_review: "écart à vérifier",
    P_category_unknown: "catégorie du blocage inconnue", missing: "absent",
    several_blockers: "plusieurs blocages", other_blocker: "un autre blocage", paraphrase: "paraphrase",
    no_mechanism: "aucun mécanisme", second_mechanism: "un second mécanisme", wrong_mechanism: "mauvais mécanisme",
    recitation: "récitation", no_principle: "pas de principe", no_phase: "pas de phase", generic_step: "étape générique",
    mechanism_reference_missing: "référence du mécanisme manquante",
    no_A_to_B: "pas de A → B", no_selected_A_B_in_gap: "pas de A et de B retenus dans l'écart", other_unit: "une autre unité",
    invented_date: "date inventée", not_his_figures: "chiffres qui ne sont pas ceux du prospect", no_image: "pas d'image",
    image_not_his_words: "image pas dans les mots du prospect",
    case_library_missing: "aucun cas client enregistré", proof_gap: "aucun cas client correspondant", no_case: "aucun cas client cité",
    case_not_valid: "cas client non valable", case_match_rule_missing: "règle de correspondance des cas manquante", best_case: "cas le plus proche",
    steps_missing: "étapes manquantes", order: "étapes dans le désordre", step_missing: "une étape manque", too_long: "trop long",
    no_roadmap: "pas de feuille de route", price_before_roadmap: "prix avant la feuille de route",
    roadmap_before_step4: "feuille de route avant l'étape 4", steps_not_his_blockers: "étapes sans lien avec ses blocages",
    no_amount: "pas de montant", decision_before_price: "décision demandée avant le prix", no_adhesion: "pas d'adhésion",
    not_in_restitution: "absent de la reformulation",
    other_person: "dit par une autre personne", not_declarative: "pas une affirmation", after_offer_words: "après les mots de l'offre",
    no_source: "sans source", source_not_earlier: "la source n'est pas antérieure", first_said_by_sales: "dit d'abord par le commercial",
    prompted_by_sales: "soufflé par le commercial", income_not_cost: "un revenu, pas un coût",
    all_episodes_to_review: "toutes les objections sont à vérifier", candidates_to_review: "des objections possibles sont à vérifier",
    prevention_to_review: "la prévention est à vérifier", no_resistance_no_price: "ni résistance ni prix",
    "no_resistance: call score = prevention score": "aucune résistance : le score de l'appel est celui de la prévention"
  };
  var UNIT = { category: "catégorie du blocage", roadmap: "feuille de route", step1: "étape 1", step2: "étape 2", step3: "étape 3", step4: "étape 4" };
  var STATUS = { excluded: "Exclu", to_review: "À vérifier", not_applicable: "Non applicable", scored: "Noté" };
  var OUTR = { nothing: "rien", offer_info: "information sur l'offre", solution_load: "solution avancée", sales_list: "liste du commercial", agreement: "demande d'accord", absent: "non lue" };
  var COMPN = { PROBLEM: "Problème", COST: "Coût", A: "A", B: "B" };
  var OUTCOME = { confirmed_with_content: "confirmé avec contenu", confirmed: "confirmé", corrected: "corrigé", rejected: "rejeté", none: "aucune réponse",
    corrected_not_restated: "corrigé sans nouvelle reformulation", corrected_then_confirmed: "corrigé puis confirmé", correction_not_restated: "correction non reformulée" };
  var PCAT = { Skill: "Compétence", Legitimacy: "Légitimité", Pricing: "Tarification", Acquisition: "Acquisition", Selling: "Vente", Delivery: "Réalisation",
    Time: "Temps", "Past failure": "Échec passé", "Financial risk": "Risque financier", not_a_pitch_blocker: "pas un blocage de l'offre", P_category_unknown: "catégorie inconnue" };
  var ADH = { appropriation: "appropriation", projection: "projection", new_link: "nouveau lien" };
  var NATURE = { objection: "Objection", anxiety_capability: "Anxiété · capacité", anxiety_choice: "Anxiété · choix", inertia: "Inertie" };
  var SUBT = { price: "Prix", money_available: "Argent disponible", trust_in_offer: "Confiance dans l'offre", relevance: "Pertinence", time: "Temps",
    co_decider: "Co-décideur", capability: "Capacité", choice: "Choix", timing: "Moment" };
  var REACT = { resolved: "résolue", persisting: "persistante", latent: "latente", acknowledged: "reconnue", to_review: "à vérifier", verified: "vérifiée" };
  function why(s) {
    s = String(s || "");
    if (/^to_review/.test(s)) return "un point attend une vérification" + (s.split(":")[1] ? " (" + fr(UNIT, s.split(":").slice(1).join(":")) + ")" : "");
    if (/^fewer_than_\d+/.test(s)) return "trop peu de questions de découverte pour noter";
    if (WHY[s] == null && s.indexOf("; ") > 0) return s.split("; ").map(why).join(" ; ");
    return fr(WHY, s);
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
    var who = t.role === "SALES" ? "Commercial" : t.role === "PROSPECT" ? "Prospect" : (t.speaker || "Autre");
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
  function notScored(x) { return x.status && x.status !== "scored" ? '<div class="ban">' + esc(fr(STATUS, x.status)) + (arr(x.reasons)[0] ? " : " + esc(why(x.reasons[0])) : "") + ". Ce qui a été trouvé est affiché ci-dessous, " + (x.status === "to_review" ? "sans note finale" : "sans points") + ".</div>" : ""; }

  // ------------------------------------------------------------------ header card and call map
  function header(rec, ui) {
    var scored = COMP.filter(function (c) { var x = obj(rec.res[c[0]]); return x.status === "scored" && x.score != null; });
    var low = scored.length > 1 ? scored.reduce(function (a, b) { return rec.res[b[0]].score < rec.res[a[0]].score ? b : a; })[0] : null;
    var tiles = COMP.map(function (c, i) {
      var x = obj(rec.res[c[0]]), on = x.status === "scored", sc = on && x.score != null ? Math.round(x.score) : "—", tag;
      if (on && c[0] === "GAP" && x.verdict === "absent") tag = ["Écart absent", "tr"];
      else if (on && c[0] === "PITCH" && x.verdict === "non_compliant") tag = ["Non conforme", "tr"];
      else if (on) tag = level(x.score || 0);
      else tag = x.status === "excluded" ? ["Exclu", "tn"] : x.status === "to_review" ? ["À vérifier", "ty"] : x.status === "not_applicable" ? ["Non applicable", "tn"] : ["Aucun résultat", "tn"];
      var bn = low === c[0];
      return '<div style="background:' + (bn ? "#FCEDEC" : "#F8F6F0") + ";border-radius:9px;padding:10px 12px" + (bn ? ";box-shadow:inset 0 0 0 1.5px #E3A49E" : "") + '"><div class="cap" style="font-size:10px' + (bn ? ";color:#9B1C13" : "") + '">' + (i + 1) + " · " + c[1] + (bn ? " · point faible" : "") +
        '</div><div style="display:flex;align-items:baseline;gap:8px;margin-top:4px"><span class="serif" style="font-size:26px;font-weight:700">' + sc + '</span><span class="tag ' + tag[1] + '">' + tag[0] + "</span></div>" +
        (!on && arr(x.reasons)[0] ? '<div class="muted" style="font-size:12px;margin-top:4px">' + esc(why(x.reasons[0])) + "</div>" : "") + "</div>";
    }).join("");
    var rules = COMP.map(function (c) { return obj(rec.res[c[0]]).rules_version; }).filter(Boolean).join(" · ");
    var st = rec.r.status && rec.r.status !== "ok" ? '<div class="err">Cet appel n\'a pas été noté : ' + esc(why(rec.r.status)) + (rec.r.status === "diarization_suspect" ? " (trop de prises de parole ont dû être réattribuées entre le commercial et le prospect ; vérifiez les intervenants dans la transcription)." : ".") + "</div>" : "";
    return '<div class="card" style="padding:20px 22px;display:flex;flex-direction:column;gap:14px"><div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap"><div class="serif" style="font-size:23px;font-weight:700">Analyse d\'appel — ' + esc(rec.meta.person || "") + "</div>" +
      '<button class="btn" type="button" data-cav-drawer="' + (ui.drawer ? "" : "all") + '" aria-pressed="' + !!ui.drawer + '" style="align-self:flex-start"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 3h12v18l-6-4-6 4z"></path></svg>' + (ui.drawer ? "Masquer la transcription" : "Transcription") + "</button></div>" + st +
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px">' + tiles + "</div>" +
      '<div style="font-size:12px" class="muted">' + (rec.r.provisional ? "Scores provisoires tant que les seuils de fiabilité ne sont pas atteints · " : "") + (rules ? "Règles " + esc(rules) + " · " : "") + "le modèle cite, le code note · cliquez sur une lettre SPIN pour lire sa question et la réponse.</div></div>";
  }
  // ------------------------------------------------------------------ the lead qualification of an R1 (046, rules 2.1)
  var QST = { "SQL GAGNÉ": ["SQL gagné", "tg"], "SQL OUVERT": ["SQL ouvert", "tb"], "SQL PERDU": ["SQL perdu", "to"], "NON SQL": ["Non SQL", "tr"],
    "À REVOIR": ["À revoir", "ty"], "MQL EN ATTENTE": ["MQL en attente", "tn"] };
  var GATES = [["metier", "Métier"], ["douleur_projet", "Douleur et projet"], ["financement", "Financement"], ["decision_timing", "Décision et timing"]];
  var GST = { "OUVERTE": ["Ouverte", "tg"], "FERMÉE": ["Fermée", "tr"], "NON VÉRIFIÉE": ["Non vérifiée", "ty"] };
  var RES = { salaire: "Salaire", epargne: "Épargne", pret: "Prêt", proche: "Un proche", autre: "Autre ressource" };
  function qTag(st) { var t = QST[st] || [st || "—", "tn"]; return '<span class="tag ' + t[1] + '">' + esc(t[0]) + "</span>"; }
  function qualification(rec) {
    var q = obj(rec.r.qualification);
    if (!q.status && !q.result) return "";
    var r = obj(q.result), b = obj(r.base), portes = obj(r.portes), al = arr(r.alertes);
    var base = [["Issue du R1", b.issue_r1], ["Outcome", b.outcome], ["Relance", b.date_relance ? new Date(b.date_relance + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) : null]]
      .filter(function (x) { return x[1]; }).map(function (x) { return '<span><span class="muted">' + x[0] + " : </span><b>" + esc(x[1]) + "</b></span>"; }).join('<span class="muted"> · </span>');
    var rows = GATES.map(function (g) {
      var x = obj(portes[g[0]]), t = GST[x.statut] || ["—", "tn"], why = arr(x.raisons);
      return '<tr><td class="td" style="white-space:nowrap;font-weight:600">' + g[1] + '</td><td class="td"><span class="tag ' + t[1] + '" style="white-space:nowrap">' + t[0] + "</span></td>" +
        '<td class="td">' + (why.length ? esc(why.join(" ; ")) : '<span class="muted">—</span>') + "</td>" +
        '<td class="td muted" style="font-size:13px">' + (x.preuve ? "“" + esc(String(x.preuve).replace(/(^|\/ )(salaire|epargne|pret|proche|autre) : /g, function (m, a, k) { return a + RES[k] + " : "; })) + "”" : "—") + "</td></tr>";
    }).join("");
    return '<div class="card" style="padding:20px 22px;display:flex;flex-direction:column;gap:12px">' +
      sectionHead("Q", "Qualification du lead", qTag(q.status)) +
      (r.solution_aware ? '<div class="ban" style="background:#E6EEF9;border-color:#B9CDEB;color:#24497F">Lead « solution aware » : il compare d’autres offres et a un rendez-vous avec l’une d’elles, il est qualifié d’office sur les quatre portes.</div>' : "") +
      (base || b.motif ? '<div style="font-size:14px;display:flex;flex-wrap:wrap;gap:4px 8px">' + base + (b.motif ? (base ? '<span class="muted"> · </span>' : "") + '<span><span class="muted">Motif : </span>' + esc(b.motif) + "</span>" : "") + "</div>" : "") +
      '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:14px"><thead><tr><th class="th">Porte</th><th class="th">État</th><th class="th">Ce qui manque ou ferme</th><th class="th">Ce que le prospect a dit</th></tr></thead><tbody>' + rows + "</tbody></table></div>" +
      (al.length ? '<div style="display:flex;flex-direction:column;gap:4px"><div class="cap">Alertes</div><ul style="margin:0;padding-left:18px;font-size:13.5px;line-height:1.5">' + al.map(function (a) { return "<li>" + esc(a) + "</li>"; }).join("") + "</ul></div>" : "") +
      '<div style="font-size:12px" class="muted">Le modèle extrait les faits en deux lectures, chaque citation est vérifiée dans la transcription, le code décide (règle des quatre portes' + (q.rules_version ? ", " + esc(String(q.rules_version).replace("qualification_lnp-", "")) : "") + ")" +
      (r.confiance ? " · confiance " + esc(r.confiance) : "") + (arr(q.verification).length ? " · " + arr(q.verification).length + " citation" + (arr(q.verification).length > 1 ? "s écartées" : " écartée") : "") + ".</div></div>";
  }
  function drawer(rec, ui) {
    if (!ui.drawer) return "";
    return '<div class="card" id="cav-drawer" style="padding:18px 22px;display:flex;flex-direction:column;gap:12px"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap"><div class="cap">Transcription · appel entier · ' + rec.turns.length + " prises de parole</div>" +
      '<button class="btn" type="button" data-cav-drawer="" style="padding:5px 10px">Fermer</button></div><div style="display:flex;flex-direction:column;gap:10px;max-height:620px;overflow-y:auto">' +
      rec.turns.map(function (t) { return row(rec, t, []); }).join("") + "</div></div>";
  }

  // ------------------------------------------------------------------ 1 · the discovery
  var DOM = { money: ["Argent", "#D9A93F"], clients: ["Clients", "#C2571A"], self_belief: ["Confiance en soi", "#1E1C17"], family: ["Famille", "#8E8A7E"], time: ["Temps", "#8E8A7E"],
    health: ["Santé", "#B42318"], future: ["Avenir", "#2F5DA8"], other: ["Autre", "#8E8A7E"],
    situation: ["Situation", "#2E7D4F"], pain: ["Douleur", "#B42318"], blocker: ["Blocage", "#C2571A"], impact: ["Impact", "#B42318"], desire: ["Désir", "#D9A93F"], value: ["Valeur", "#D9A93F"] };
  var PAIN = { PAIN: 1, BLOCKER: 1, IMPACT: 1 }, WANT = { DESIRE: 1, VALUE: 1 };
  // a short excerpt of the prospect's words (the full quote on hover)
  function short(rec, e) {
    if (!e || !e.quote) return "";
    var w = String(e.quote).split(/\s+/), cut = w.length > 9 ? w.slice(0, 9).join(" ") + "…" : e.quote;
    return '<span title="' + esc(e.quote) + '">“' + esc(cut) + "”</span>";
  }
  function discovery(rec, ui) {
    var x = obj(rec.res.SPIN), d = rec.d("SPIN"), sols = arr(d.solicitations).filter(function (s) { return s.in_perimeter; });
    if (!sols.length && x.status !== "scored") return '<div class="card" style="padding:20px 22px;display:flex;flex-direction:column;gap:10px">' + sectionHead(1, "La découverte") + notScored(x) + "</div>";
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
      var name = s.letter === "OUT" ? "Hors SPIN" + (s.out_reason ? " · " + fr(OUTR, s.out_reason) : "") : ({ S: "Situation", P: "Problème", I: "Implication", N: "Bénéfice" })[s.letter] || s.letter;
      return '<tr><td class="td" colspan="4" style="padding:0 12px 14px;border-bottom:1px solid #EFEBE1"><div style="border:1px solid #E9CF8E;background:#FFFDF7;border-radius:10px;padding:12px 14px;display:flex;flex-direction:column;gap:10px">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap"><b class="serif" style="font-size:15px">' + (s.letter && s.letter !== "OUT" ? esc(s.letter) + " · " : "") + esc(name) + ' — question <span class="mono muted" style="font-size:12px;font-weight:400">' + esc(rec.c(s.turn)) + " · " + esc(s.turn) + "</span></b>" +
        '<button class="btn" type="button" data-cav-sol="" style="padding:4px 10px">Fermer</button></div>' +
        (turns.length ? turns.map(function (t) { return row(rec, excerpt(t, null), []); }).join("") : '<div class="muted" style="font-size:13px">Cette prise de parole n\'est pas dans la transcription.</div>') +
        (arr(s.answer_turns).length ? "" : '<div class="muted" style="font-size:12.5px">Aucune réponse du prospect n\'a été trouvée pour cette question.</div>') + "</div></td></tr>";
    }
    var body;
    // SPIN v1.2 (SB-26..SB-33): rows by register of the question; older records keep the rows by answer domain
    var hasReg = sols.some(function (x) { return "register" in x; });
    if (hasReg) {
      var REG = [["financial", "Financier", "#C9A04A"], ["time_load", "Temps et charge", "#B45309"], ["identity_status", "Identité et statut", "#7A4B00"], ["mental_emotional", "Mental et émotionnel", "#1E1C17"], ["other", "Autre", "#8E8A7E"]];
      var byQ = {}; ev.forEach(function (e) { if (e.question_id) (byQ[e.question_id] = byQ[e.question_id] || []).push(e); });
      var regRow = function (key, label, color, qs, sub) {
        var seen = {}, quotes = [], pain = 0, want = 0, quant = false;
        qs.forEach(function (s) { (byQ[s.id] || []).forEach(function (e) { if (seen[e.quote]) return; seen[e.quote] = 1; quotes.push(e); if (PAIN[e.atom]) pain++; if (WANT[e.atom]) want++; if (e.quantified) quant = true; }); });
        var ids = {}; qs.forEach(function (s) { ids[s.id] = 1; });
        var deep = chains.filter(function (c) { return c.deep && arr(c.links || c.solicitations).some(function (id) { return ids[id]; }); }).length;
        var state = !qs.length ? ["Non exploré", "tn"] : !quotes.length ? ["Aucun fait du prospect", "tn"] : deep ? ["Approfondi", "tg"] : quant ? ["Chiffré", "tb"] : want ? ["Valeur exprimée", "tb"] : pain ? ["Effleuré", "to"] : ["Effleuré", "tn"];
        var mx = Math.max(1, pain, want), red = pain / mx * 46, gold = want / mx * 46;
        return '<tr><td class="td"><div style="display:flex;gap:10px"><span class="dot" style="background:' + color + ';margin-top:5px;border-radius:2px"></span><div style="min-width:0"><b style="font-size:14px">' + esc(label) + '</b><div class="muted" style="font-size:12.5px;margin-top:2px">' +
          (quotes.length ? short(rec, quotes[0]) : esc(sub || (qs.length ? "aucun fait retenu dans les réponses" : "aucune question dans ce registre"))) + "</div></div></div></td>" +
          '<td class="td"><div class="chips">' + qs.map(function (s) { return chip(s, !!byQ[s.id]); }).join("") + '</div><div class="muted" style="margin-top:6px">' + qs.length + " question" + (qs.length <= 1 ? "" : "s") + (deep ? " · " + deep + " chaîne" + (deep <= 1 ? "" : "s") + " approfondie" + (deep <= 1 ? "" : "s") : "") + "</div></td>" +
          '<td class="td">' + (qs.length ? '<div style="display:flex;align-items:center;gap:8px"><span class="mono">' + pain + '</span><div class="bar">' + (red ? '<div style="position:absolute;right:52%;width:' + red + '%;top:0;bottom:0;background:#B42318;border-radius:4px"></div>' : "") +
          (gold ? '<div style="position:absolute;left:54%;width:' + gold + '%;top:0;bottom:0;background:#D9A93F;border-radius:4px"></div>' : "") + '</div><span class="mono">' + want + "</span></div>" : '<span class="muted">—</span>') + "</td>" +
          '<td class="td"><span class="tag ' + state[1] + '">' + state[0] + "</span></td></tr>" + opened(qs);
      };
      body = REG.map(function (g) { return regRow(g[0], g[1], g[2], coded.filter(function (s) { return s.register === g[0]; })); }).join("");
      var noReg = coded.filter(function (s) { return !s.register; });
      if (noReg.length) body += regRow("none", "Sans registre", "#E0B9A4", noReg, noReg.some(function (s) { return s.register_status === "to_review"; }) ? "en attente d'une vérification (aucune règle n'a pu trancher)" : "après la présentation de l'offre ou non lue");
    } else body = order.sort(function (a, b) { return (rows[b].pain + rows[b].want) - (rows[a].pain + rows[a].want); }).map(function (k) {
      var r = rows[k], qs = coded.filter(function (s) { return r.sols[s.id]; }), dm = DOM[k] || [lbl(k), "#8E8A7E"];
      var deep = chains.filter(function (c) { return c.deep && arr(c.links || c.solicitations).some(function (id) { return r.sols[id]; }); }).length;
      var state = deep ? ["Approfondi", "tg"] : r.quant ? ["Chiffré", "tb"] : r.want ? ["Valeur exprimée", "tb"] : r.pain ? ["Effleuré", "to"] : ["Effleuré", "tn"];
      var red = r.pain / max * 46, gold = r.want / max * 46;
      return '<tr><td class="td"><div style="display:flex;gap:10px"><span class="dot" style="background:' + dm[1] + ';margin-top:5px;border-radius:2px"></span><div style="min-width:0"><b style="font-size:14px">' + esc(dm[0]) + '</b><div class="muted" style="font-size:12.5px;margin-top:2px">' +
        short(rec, r.quotes[0]) + "</div></div></div></td>" +
        '<td class="td"><div class="chips">' + qs.map(function (s) { return chip(s, true); }).join("") + "</div>" + '<div class="muted" style="margin-top:6px">' + qs.length + " question" + (qs.length <= 1 ? "" : "s") + (deep ? " · " + deep + " chaîne" + (deep <= 1 ? "" : "s") + " approfondie" + (deep <= 1 ? "" : "s") : "") + "</div></td>" +
        '<td class="td"><div style="display:flex;align-items:center;gap:8px"><span class="mono">' + r.pain + '</span><div class="bar">' + (red ? '<div style="position:absolute;right:52%;width:' + red + '%;top:0;bottom:0;background:#B42318;border-radius:4px"></div>' : "") +
        (gold ? '<div style="position:absolute;left:54%;width:' + gold + '%;top:0;bottom:0;background:#D9A93F;border-radius:4px"></div>' : "") + '</div><span class="mono">' + r.want + "</span></div></td>" +
        '<td class="td"><span class="tag ' + state[1] + '">' + state[0] + "</span></td></tr>" + opened(qs);
    }).join("");
    if (!hasReg && none.length) body += '<tr><td class="td"><div style="display:flex;gap:10px"><span class="dot" style="background:#E0B9A4;margin-top:5px;border-radius:2px"></span><div><b style="font-size:14px">Aucun fait du prospect</b><div class="muted">questions dont la réponse n\'a rien donné que le code ait retenu</div></div></div></td><td class="td">' +
      '<div class="chips">' + none.map(function (s) { return chip(s, false); }).join("") + "</div>" + '<div class="muted" style="margin-top:6px">' + none.length + ' question' + (none.length <= 1 ? "" : "s") + '</div></td><td class="td"><span class="muted">—</span></td><td class="td"><span class="muted">sans effet</span></td></tr>' + opened(none);
    if (out.length) body += '<tr><td class="td"><div style="display:flex;gap:10px"><span class="dot" style="background:#DDD7C9;margin-top:5px;border-radius:2px"></span><div><b style="font-size:14px">Hors SPIN</b><div class="muted">demandes d\'accord, questions sur l\'offre et le financement</div></div></div></td><td class="td">' +
      '<div class="chips">' + out.map(function (s) { return chip(s, true); }).join("") + "</div>" + '<div class="muted" style="margin-top:6px">' + out.length + ' question' + (out.length <= 1 ? "" : "s") + ' · hors SPIN</div></td><td class="td"><span class="muted">—</span></td><td class="td"><span class="muted">aucun point</span></td></tr>' + opened(out);
    return '<div class="card" style="padding:20px 22px;display:flex;flex-direction:column;gap:6px">' + sectionHead(1, "La découverte") +
      sub("De la première question de diagnostic au début de la présentation de l'offre · " + esc(rec.c(pS)) + " → " + esc(rec.c(pE)) + " · " + coded.length + " question" + (coded.length <= 1 ? " codée" : "s codées") + " · lu dans ce que le prospect a dit, jamais dans la lettre") +
      (notScored(x) ? '<div style="margin-top:8px">' + notScored(x) + "</div>" : "") +
      (obj(d.registers).flags && d.registers.flags.indexOf("register_agreement_low") >= 0 ? '<div style="margin-top:8px" class="ban">Registres moins fiables sur cet appel : ' + Math.round((d.registers.agreement || 0) * 100) + " % tranchés à 3/3 par les lecteurs (objectif 92 %).</div>" : "") +
      // Romain 2026-10-27: everything visible without scrolling sideways: fixed columns, the chips wrap, a short excerpt under the domain
      '<div style="margin-top:10px"><table style="width:100%;border-collapse:collapse;table-layout:fixed"><thead><tr><th class="th" style="width:28%">' + (hasReg ? "Registre" : "Domaine") + '</th><th class="th" style="width:36%">Questions posées, dans l\'ordre</th><th class="th" style="width:22%">◂ Douleur · Désir ▸</th><th class="th" style="width:14%">État</th></tr></thead><tbody>' +
      (body || '<tr><td class="td muted" colspan="4">Aucun fait du prospect n\'a été trouvé dans la découverte.</td></tr>') + "</tbody></table></div>" +
      '<div style="display:flex;flex-wrap:wrap;gap:8px 16px;align-items:center;font-size:12px;margin-top:8px" class="muted"><span><span class="chip cS" style="width:20px;height:20px;font-size:10px">S</span>question qui a produit un fait</span><span><span class="chip cX" style="width:20px;height:20px;font-size:10px">P</span>question sans effet</span><span><span class="chip cO" style="width:20px;height:20px"></span>hors SPIN</span>' +
      '<span><b style="color:#2E7D4F">S</b> Situation · <b style="color:#C2571A">P</b> Problème · <b style="color:#B42318">I</b> Implication · <b>N</b> Bénéfice</span></div></div>';
  }

  // ------------------------------------------------------------------ 2 · the gap played back
  var CL = { verbatim: ["green", "mot pour mot"], paraphrased: ["red", "paraphrase"], untraced: ["orange", "mot du commercial"], excluded: ["grey", "non compté"] };
  function clauseMarks(clauses) {
    return arr(clauses).map(function (c) { var k = CL[c.match] || ["grey", c.match || ""]; var n = fr(COMPN, c.component); return mk(c.sales_quote || c.quote, k[0], (n.length > 1 ? n.toLowerCase() : n) + " · " + k[1]); });
  }
  function gap(rec) {
    var x = obj(rec.res.GAP), d = rec.d("GAP"), ph = rec.ph;
    var present = (x.verdict || d.verdict) === "present";
    var tag = x.status === "scored" ? (present ? '<span class="tag tg">Écart présent</span>' : '<span class="tag tr">Écart absent</span>') : "";
    var R = obj(d.restitution), cands = arr(d.restitutions);
    if (!R.span && cands.length) R = cands[0];
    var span = arr(R.span), isRest = present || (R.is_restitution && span.length);
    var val = obj(R.validation), vt = val.turn || d.validation_turn;
    // timing of the gap
    var a = rec.pct(ph.discovery_start), b = rec.pct(ph.pitch_start || ph.discovery_end), r0 = rec.pct(span[0]), r1 = rec.pct(span[1] || span[0]), pv = rec.pct(vt), p0 = rec.pct(ph.pitch_start), p1 = rec.pct(ph.first_price || ph.pitch_end);
    function seg(l, w, top, h, bg, title) { return l == null || w == null ? "" : '<div style="position:absolute;left:' + l + "%;width:" + Math.max(0.6, w) + "%;top:" + top + "px;height:" + h + "px;background:" + bg + ';border-radius:4px" title="' + esc(title) + '"></div>'; }
    function tick(l, bg, title) { return l == null ? "" : '<div style="position:absolute;left:' + l + "%;top:10px;width:2px;height:20px;background:" + bg + '" title="' + esc(title) + '"></div>'; }
    var restS = span[0] ? rec.s(span[1] || span[0]) - rec.s(span[0]) : null;
    var right = span[0] && isRest ? "reformulation " + (dur(restS) || "en une prise de parole") + (vt ? " · validation à " + rec.c(vt) : "") + (ph.pitch_start && vt ? " · " + dur(rec.s(ph.pitch_start) - rec.s(vt)) + " avant la présentation de l'offre" : "") : "aucune reformulation avant la présentation de l'offre";
    var timing = '<div style="border:1px solid #E7E2D6;border-radius:10px;padding:14px 16px;display:flex;flex-direction:column;gap:10px"><div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;align-items:center"><div class="cap">Chronologie de l\'écart</div><span class="mono" style="font-size:12px">' + esc(right) + "</span></div>" +
      '<div style="position:relative;height:40px"><div style="position:absolute;left:0;right:0;top:16px;height:8px;border-radius:4px;background:#EFECE4"></div>' +
      seg(a, b != null && a != null ? b - a : null, 16, 8, "#CFE0F7", "Découverte") + (isRest ? seg(r0, r1 != null && r0 != null ? r1 - r0 : null, 12, 16, "#2E7D4F", "Reformulation") : "") + tick(pv, "#1E1C17", "Validation") +
      seg(p0, p1 != null && p0 != null ? p1 - p0 : null, 16, 8, "#F6D9C4", "Présentation de l'offre") + tick(rec.pct(ph.first_price), "#B42318", "Prix") + "</div>" +
      legend([["#CFE0F7", "Découverte " + esc(rec.c(ph.discovery_start)) + " → " + esc(rec.c(ph.pitch_start || ph.discovery_end))]].concat(isRest ? [["#2E7D4F", '<b style="color:#1E1C17">Reformulation ' + esc(rec.c(span[0])) + " → " + esc(rec.c(span[1] || span[0])) + "</b>" + (arr(R.turns).length ? " · " + R.turns.length + " prise" + (R.turns.length <= 1 ? "" : "s") + " de parole (" + esc(R.turns[0]) + ")" : "")]] : [])
        .concat(vt ? [["#1E1C17", "Validation " + esc(rec.c(vt)) + (val.quote ? " " + q(rec, val.quote, vt) : "")]] : []).concat(ph.pitch_start ? [["#F6D9C4", "Présentation de l'offre " + esc(rec.c(ph.pitch_start))]] : []).concat(ph.first_price ? [["#B42318", "Prix " + esc(rec.c(ph.first_price))]] : [])) + "</div>";
    // what the sales said: the restatement (or the passage that came closest), clause by clause
    var verb = "";
    if (span[0]) {
      var ts = arr(R.turns).length ? R.turns.map(function (id) { return rec.t(id); }).filter(Boolean) : between(rec, span[0], span[1] || span[0]);
      var sales = ts.filter(function (t) { return t.role === "SALES"; }), words = sales.reduce(function (n, t) { return n + String(t.text).split(/\s+/).length; }, 0);
      var marks = clauseMarks(R.clauses);
      verb = '<div style="border:1px solid #E7E2D6;border-radius:10px;padding:14px 16px;display:flex;flex-direction:column;gap:10px"><div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px"><div class="cap">' + (isRest ? "Ce qu'a dit le commercial · mot pour mot" : "Le passage le plus proche · pas une reformulation") + '</div><span class="mono muted" style="font-size:12px">' +
        esc(rec.c(span[0])) + " · " + esc(span[0]) + " · Commercial · " + (sales.length === 1 ? "une prise de parole" : sales.length + " prises de parole") + " · " + words + " mot" + (words <= 1 ? "" : "s") + (restS ? " · " + dur(restS) : "") + "</span></div>" +
        sales.map(function (t) { return '<div style="font-size:15px;line-height:1.9">“' + marked(t.text, marks) + "”</div>"; }).join("") +
        (vt && rec.t(vt) ? '<div style="border-top:1px solid #EFEBE1;padding-top:10px;font-size:15px"><span class="mono muted" style="font-size:12px">' + esc(rec.c(vt)) + " · " + esc(vt) + " · Prospect</span> <span style=\"margin-left:8px\">" + q(rec, rec.t(vt).text, vt) + "</span>" +
          (R.effective_outcome || val.outcome ? ' <span class="tag ' + (/confirm/.test(R.effective_outcome || val.outcome) ? "tn" : "tr") + '" style="margin-left:6px">' + esc(fr(OUTCOME, R.effective_outcome || val.outcome)) + "</span>" : "") + "</div>" : "") +
        legend([["#9BD0AE", "ses mots exacts"], ["#F2A9A2", "paraphrase : ne compte pas"], ["#F2C29E", "formulation du commercial : ne compte pas"], ["#C9C4B8", "non compté"]]) + "</div>";
    }
    // the four checks
    var comps = obj(R.components), conf = obj(R.conformity);
    var checks = [
      ["En une fois", conf.one_go != null ? !!conf.one_go : isRest && arr(R.turns).length <= 2, isRest ? "Problème et coût dans la même reformulation" : "aucune reformulation"],
      ["Avant l'offre et le prix", isRest && R.before_first_pitch !== false && R.before_first_price !== false, isRest ? "Reformulation " + rec.c(span[0]) + (ph.pitch_start ? " · offre " + rec.c(ph.pitch_start) : "") : "—"],
      ["Problème + coût mot pour mot", ["PROBLEM", "COST"].every(function (k) { return obj(comps[k]).match === "verbatim"; }), ["PROBLEM", "COST"].map(function (k) { var c = obj(comps[k]); return c.key_expression ? "“" + c.key_expression + "”" : null; }).filter(Boolean).join(" · ") || "pas dans ses mots"],
      ["Validé", /confirm/.test(R.effective_outcome || val.outcome || ""), vt ? rec.c(vt) + (val.content_quote ? "" : " · sans contenu") : "aucune validation"]];
    var chk = '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px">' + checks.map(function (c) {
      return '<div style="border:1px solid #E7E2D6;border-radius:9px;padding:10px 12px;font-size:13px"><span class="tag ' + (c[1] ? "tg" : "tr") + '">' + (c[1] ? "✓ " : "✗ ") + c[0] + '</span><div style="margin-top:6px" class="muted">' + esc(c[2]) + "</div></div>";
    }).join("") + "</div>";
    // component table: from the clauses, else (absent) from what the prospect gave
    var rowsT = arr(R.clauses).map(function (c) {
      var m = c.match === "verbatim" ? ["oui", "tg"] : ["non · " + (c.match === "paraphrased" ? "paraphrase" : c.match === "untraced" ? "pas ses mots" : CL[c.match] ? CL[c.match][1] : lbl(c.match)), "tr"];
      var src = rec.t(c.source_turn);
      return '<tr><td class="td"><b>' + esc(fr(COMPN, c.component)) + '</b></td><td class="td quote">' + (c.source_quote ? q(rec, c.source_quote, c.source_turn) : c.key_expression ? q(rec, c.key_expression, c.source_turn) : '<span class="muted" style="font-style:normal">non retrouvé</span>') +
        (src ? '<div class="mono muted" style="font-size:11px;font-style:normal">' + esc(rec.c(c.source_turn)) + "</div>" : "") + '</td><td class="td quote">' + q(rec, c.sales_quote || c.quote, c.sales_turn || span[0]) + '</td><td class="td"><span class="tag ' + m[1] + '">' + esc(m[0]) + "</span>" +
        (c.reason && c.reason !== "ok" ? '<div class="muted" style="font-size:12px;margin-top:4px">' + esc(why(c.reason)) + "</div>" : "") + "</td></tr>";
    });
    if (!isRest) {
      var given = [["Problème", d.selected_P]].concat(arr(d.cost).slice(0, 3).map(function (c) { return ["Coût", c]; })).concat([["A", d.selected_A], ["B", d.selected_B]]).filter(function (g) { return g[1] && g[1].quote; });
      rowsT = given.map(function (g) {
        return '<tr><td class="td"><b>' + g[0] + '</b></td><td class="td quote">' + q(rec, g[1].quote, g[1].turn) + '<div class="mono muted" style="font-size:11px;font-style:normal">' + esc(rec.c(g[1].turn)) + '</div></td><td class="td"><span class="muted">—</span></td><td class="td"><span class="tag tr">non reformulé</span></td></tr>';
      });
    }
    var table = rowsT.length ? '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;min-width:640px"><thead><tr><th class="th">Élément</th><th class="th">Ce qu\'a dit le prospect</th><th class="th">Ce qu\'a reformulé le commercial</th><th class="th">Mot pour mot</th></tr></thead><tbody>' + rowsT.join("") + "</tbody></table></div>" : "";
    var rb = obj(d.roadmap), road = '<div style="font-size:13px" class="muted">Matière pour la feuille de route : ' + (rb.count != null ? rb.count : arr(d.roadmap_blockers).length) + " autre(s) blocage(s) relevé(s) dans les réponses P ou I" + (rb.warning ? ' · <b style="color:#A2450E">Alerte Copilot</b> : ' + esc(typeof rb.warning === "string" ? rb.warning : "moins de blocages que d'étapes dans la feuille de route") : "") + ".</div>";
    var absent = !present && x.status === "scored" ? '<div class="ban">Écart absent : ' + esc(why(d.absence_reason || arr(x.reasons)[0])) + "." + (!isRest && cands.length ? " " + cands.length + " passage" + (cands.length === 1 ? " s'en est approché ; il n'était pas valable." : "s s'en sont approchés ; aucun n'était valable.") : "") + "</div>" : "";
    return '<div class="card" style="padding:20px 22px;display:flex;flex-direction:column;gap:12px">' + sectionHead(2, "L'écart reformulé", tag) +
      sub("Problème et coût reformulés en une fois, avec les mots exacts du prospect, validés par le prospect, avant la présentation de l'offre et le prix.") + notScored(x) + absent + timing + verb + chk + table + road + "</div>";
  }

  // ------------------------------------------------------------------ 3 · the pitch
  function pitch(rec) {
    var x = obj(rec.res.PITCH), d = rec.d("PITCH"), ph = rec.ph;
    if (!Object.keys(d).length) return '<div class="card" style="padding:20px 22px;display:flex;flex-direction:column;gap:10px">' + sectionHead(3, "La présentation de l'offre") + notScored(x) + "</div>";
    var nc = arr(d.non_compliance).length ? d.non_compliance : arr(x.reasons).filter(function (r) { return !/^to_review/.test(r); });
    var ok = (x.verdict || d.verdict) === "compliant";
    var tag = ok ? '<span class="tag tg">Conforme</span>' : '<span class="tag tr">Non conforme' + (nc[0] ? " · " + esc(why(nc[0])) : "") + "</span>";
    var vp = obj(d.validated_P), cat = obj(d.diagnostics).P_category || vp.category;
    var subt = (vp.quote ? "Blocage validé " + q(rec, vp.quote, vp.turn) + " → <b style=\"color:#1E1C17\">" + esc(cat ? fr(PCAT, cat) : "catégorie inconnue") + "</b> · " : "") + "un blocage, un mécanisme, quatre étapes, puis feuille de route, montant, décision.";
    var chips = [];
    if (nc.indexOf("pitch_before_gap") >= 0) chips.push('<span class="tag tr">✗ Offre présentée avant la reformulation de l\'écart</span>');
    else chips.push(nc.indexOf("pitch_before_validation") >= 0 ? '<span class="tag tr">✗ Offre présentée avant le oui</span>' : '<span class="tag tg">✓ Offre présentée après le oui</span>');
    var unc = arr(d.claims).filter(function (c) { return /unchecked/.test(c.source || c.lookup || c.status || ""); });
    if (unc.length) chips.push('<span class="tag ty">? ' + (unc.length === 1 ? "Une affirmation" : unc.length + " affirmations") + " à vérifier par rapport à l'offre</span>");
    arr(d.outcome_promises).forEach(function (p) { chips.push('<span class="tag tr" style="white-space:normal">✗ ' + q(rec, p.quote, p.turn) + " · " + esc(p.turn) + "</span>"); });
    var steps = obj(d.steps), names = ["Étape 1 · Blocage", "Étape 2 · Mécanisme", "Étape 3 · A → B", "Étape 4 · Preuve"];
    var cards = ["1", "2", "3", "4"].map(function (k, i) {
      var s = obj(steps[k]), sp = arr(s.span), bad = !!s.failure;
      var head = s.failure ? why(s.failure) : sp[0] ? "Fait" : "Non applicable";
      var detail = [];
      if (s.key_expression) detail.push(q(rec, s.key_expression, sp[0]));
      if (sp[0]) detail.push(esc(rec.c(sp[0])) + (sp[1] && sp[1] !== sp[0] ? " → " + esc(rec.c(sp[1])) : ""));
      if (k === "2" && arr(s.mechanisms).length) detail.push(esc(s.mechanisms.join(", ")));
      if (k === "2" && s.recitation) detail.push("récitation");
      return card(names[i], head, detail.join(" · "), bad);
    });
    var rd = obj(d.roadmap), rsteps = arr(rd.steps).length;
    var priceFirst = !rsteps || rd.before_price === false;
    cards.push(card("Puis feuille de route", rsteps ? rsteps + " étape" + (rsteps <= 1 ? "" : "s") : "Prix d'abord", (ph.first_price ? "prix à " + esc(rec.c(ph.first_price)) : "") + (rsteps ? (rd.before_price === false ? " · après le prix" : " · avant le prix") : ph.first_price ? ", pas de feuille de route" : ""), priceFirst));
    function card(title, value, detail, bad) {
      return '<div style="flex:1 1 130px;border:1px solid ' + (bad ? "#F0C8B4" : "#E7E2D6") + ";background:" + (bad ? "#FFF7F2" : "#F8F6F0") + ';border-radius:9px;padding:10px 12px"><div class="cap" style="font-size:10px">' + esc(title) + '</div><div style="font-weight:600;margin-top:4px' + (bad ? ";color:#A2450E" : "") + '">' + esc(value.charAt(0).toUpperCase() + value.slice(1)) + '</div><div style="font-size:12px;margin-top:3px" class="muted">' + detail + "</div></div>";
    }
    // the full pitch verbatim, marked
    var verb = "";
    if (ph.pitch_start && rec.t(ph.pitch_start)) {
      var endT = ph.first_price || ph.pitch_end || ph.pitch_start, ts = between(rec, ph.pitch_start, endT);
      var marks = arr(d.adhesion).map(function (a) { return mk(a.quote, "green", "adhésion" + (a.kind ? " · " + fr(ADH, a.kind).toLowerCase() : "")); })
        .concat(arr(d.outcome_promises).map(function (p) { return mk(p.quote, "red", "interdit · promesse de résultat"); }))
        .concat(arr(d.claims).map(function (c) { return mk(c.quote, "gold", "affirmation · à vérifier par rapport à l'offre"); }));
      ["1", "2", "3", "4"].forEach(function (k) { var s = obj(steps[k]); if (s.key_expression) marks.push(mk(s.key_expression, s.failure ? "orange" : "green", "étape " + k + (s.failure ? " · " + why(s.failure).toLowerCase() : ""))); });
      var byTurn = {};
      marks.forEach(function (m) { ts.forEach(function (t) { if (m.q && String(t.text).toLowerCase().indexOf(String(m.q).toLowerCase()) >= 0) (byTurn[t.id] = byTurn[t.id] || []).push(m); }); });
      verb = '<div style="border:1px solid #E7E2D6;border-radius:10px;display:flex;flex-direction:column"><div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;padding:12px 16px;border-bottom:1px solid #EFEBE1"><div class="cap">Ce qu\'a dit le commercial · présentation complète, mot pour mot</div><span class="mono muted" style="font-size:12px">' +
        esc(rec.c(ph.pitch_start)) + " → " + esc(rec.c(endT)) + " · " + esc(ph.pitch_start) + " → " + esc(endT) + " · " + ts.length + " prise" + (ts.length <= 1 ? "" : "s") + " de parole · " + dur(rec.s(endT) - rec.s(ph.pitch_start)) + '</span></div><div style="max-height:620px;overflow-y:auto;padding:14px 16px;display:flex;flex-direction:column;gap:12px">' +
        ts.map(function (t) { return row(rec, t, byTurn[t.id]); }).join("") + '</div><div style="padding:10px 16px;border-top:1px solid #EFEBE1">' +
        legend([["#9BD0AE", "ses mots / adhésion"], ["#F2A9A2", "enfreint une règle"], ["#F2C29E", "formulation du commercial"], ["#EBCF8A", "à vérifier par rapport à l'offre"]]) + "</div></div>";
    }
    return '<div class="card" style="padding:20px 22px;display:flex;flex-direction:column;gap:12px">' + sectionHead(3, "La présentation de l'offre", tag) + sub(subt) + notScored(x) +
      '<div style="display:flex;flex-wrap:wrap;gap:8px;font-size:13px">' + chips.join("") + "</div>" +
      '<div style="display:flex;flex-wrap:wrap;gap:8px;align-items:stretch">' + cards.join("") + "</div>" + verb + "</div>";
  }

  // ------------------------------------------------------------------ 4 · objections
  var GEST = [["A", "acknowledge", "H2", "Accueillie", "La première réponse accueille la résistance sans la contredire (OB-13)."],
    ["I", "isolate", "H3", "Isolée", "Demande si, ce point mis à part, le reste convient au prospect (OB-14)."],
    ["E", "explore", "H3", "Explorée", "Interroge le doute lui-même avant d'y répondre (OB-15)."],
    ["M", "gesture_match", "H1", "Réponse adaptée", "Une réponse liée à ce qu'a dit le prospect, donnée après l'exploration (OB-16)."]];
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
      var code = e.subtype || e.nature, name = e.subtype ? fr(SUBT, e.subtype) : fr(NATURE, e.nature), k = String(lbl(code)).toLowerCase();
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
          (react.quote ? '<div style="font-size:13px" class="muted">Commercial : ' + q(rec, react.quote, react.turn) + ' <span class="mono" style="font-size:11px">' + esc(rec.c(react.turn)) + "</span></div>" : "") + "</div>";
      }).join("");
      var dots = G.eps.map(function (i) { var p = rec.pct(obj(eps[i].resistance).turn); return '<div style="position:absolute;left:' + (p || 0) + '%;top:-3px;width:10px;height:10px;margin-left:-5px;border-radius:50%;background:#D9A93F"></div>'; }).join("");
      return '<tr><td class="td" style="vertical-align:top"><b style="font-size:14px">' + esc(G.name) + '</b><div class="muted" style="font-size:12px;margin-top:2px">' + G.eps.length + " fois · " + esc(fr(NATURE, G.nature)) + '</div><div style="margin-top:6px"><span class="tag ' + rc + '">' + esc(String(res ? fr(REACT, res) : "").toLowerCase()) + "</span></div>" +
        '<div style="position:relative;height:4px;background:#EFECE4;border-radius:2px;margin:12px 0 6px">' + dots + '</div><div class="mono muted" style="font-size:11px;display:flex;justify-content:space-between"><span>0</span><span>' + Math.round(rec.end / 60) + " min</span></div></td>" +
        '<td class="td" style="vertical-align:top">' + lines + "</td></tr>";
    }).join("");
    var panel = "";
    if (ui.gesture && eps[ui.gesture.ep]) {
      var e = eps[ui.gesture.ep], g = GEST.filter(function (z) { return z[0] === ui.gesture.g; })[0], s = gState(e, g[1]), ts = gTurns(e, g);
      var tg = s === "y" ? ["oui", "tg"] : s === "h" ? ["partiel", "ty"] : ["non", "tr"];
      var rq = obj(e.resistance), first = rec.t(rq.turn);
      panel = '<div style="border:1px solid #E9CF8E;background:#FFFDF7;border-radius:10px;padding:14px 16px;display:flex;flex-direction:column;gap:12px;margin-top:8px"><div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;align-items:center"><b class="serif" style="font-size:16px">' + g[0] + " · " + g[3] + '</b><span class="tag ' + tg[1] + '">' + tg[0] + "</span></div>" +
        '<div style="font-size:13px" class="muted">' + esc(g[4]) + '</div><div style="display:flex;flex-direction:column;gap:10px">' +
        (first ? row(rec, excerpt(first, rq.quote), []) : "") +
        (ts.length ? ts.map(function (z) { var t = rec.t(z.turn); return t ? row(rec, excerpt(t, z.quote), z.quote ? [mk(z.quote, "gold")] : []) : ""; }).join("") : '<div class="muted" style="font-size:13px">Aucune prise de parole ne montre ce geste.</div>') + "</div></div>";
    }
    var pv = obj(d.prevention);
    function fact(keys) { for (var i = 0; i < keys.length; i++) { var v = pv[keys[i]]; if (v && (typeof v !== "object" || Object.keys(v).length)) return v; } return null; }
    function tile(title, keys, empty) {
      var v = fact(keys);
      return '<div style="background:#F8F6F0;border-radius:9px;padding:10px 12px;font-size:13px"><div class="cap" style="font-size:10px">' + title + '</div><div style="margin-top:4px">' + (v && v.quote ? q(rec, v.quote, v.turn) : v ? esc(typeof v === "string" ? v : "exprimé") : '<span class="muted">' + empty + "</span>") + "</div></div>";
    }
    var sc = x.status === "scored" && x.score != null ? '<span class="tag ' + level(x.score)[1] + '">' + Math.round(x.score) + " · " + level(x.score)[0] + "</span>" : "";
    return '<div class="card" style="padding:20px 22px;display:flex;flex-direction:column;gap:6px">' + sectionHead(4, "Objections", sc) +
      sub("Une résistance, c'est ce que dit le prospect ; les gestes se lisent dans la réponse du commercial qui suit ; la résolution, dans les mots du prospect.") + (notScored(x) ? '<div style="margin-top:8px">' + notScored(x) + "</div>" : "") +
      (eps.length ? '<div style="margin-top:10px"><table style="width:100%;border-collapse:collapse;table-layout:fixed"><thead><tr><th class="th" style="width:24%">Objection</th><th class="th">Mots du prospect, réponse du commercial et A · I · E · M</th></tr></thead><tbody>' + rows + "</tbody></table></div>"
        : '<div class="ban" style="margin-top:10px">Aucune résistance n\'a été trouvée dans cet appel.</div>') + panel +
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px;margin-top:8px">' + tile("Circuit de décision", ["decision_maker", "influencers"], "non établi avant le prix") + tile("Budget et échéance", ["budget", "deadline"], "non établis avant le prix") + tile("Tentative passée", ["past_attempt"], "non mentionnée") + "</div>" +
      '<div style="font-size:12px;margin-top:4px" class="muted">A accueillie · I isolée · E explorée · M réponse adaptée (or = partiel) · cliquez sur une lettre pour ouvrir sa citation</div></div>';
  }

  function html(r, ui) {
    if (!r) return "";
    var rec = new Rec(r);
    ui = ui || {};
    return '<div class="cav">' + header(rec, ui) + qualification(rec) + drawer(rec, ui) + discovery(rec, ui) + gap(rec) + pitch(rec) + objections(rec, ui) + "</div>";
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
