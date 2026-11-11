// node app/training/simulateur_test.js $PWD/app/training/simulateur.html <screenshot dir> — Entraînement › Simulateur
// (Romain 2026-11-11): the screen is loaded in a frame of a stub page whose window.claude answers like LNP on the web
// (use("crm"): canned crm_sim_* rows; use("simulateur").fetch: canned JSON and SSE). Checked: a simulation launched in text,
// a message and its streamed reply, the undo of the last exchange, the end dialog, the note, the self-analysis, the result
// (French labels of the analysis grid, the five dimensions, the exercise, the progression), the history (search, deletion
// confirmed), the admin views (offers and prospects, settings), the demo outside LNP, no console error, no English word.
const { chromium } = require('playwright');
const fs = require('fs');
const FILE = process.argv[2], OUT = process.argv[3] || '.';
const HTML = fs.readFileSync(FILE, 'utf8');
const ORIGIN = 'http://lnp.test';

// ------------------------------------------------------------------ the stub of LNP (runs in the parent page)
const STUB = String.raw`
(function () {
  var ADMIN = /admin=1/.test(location.search), ME = ADMIN ? 'u9' : 'u1';
  var now = Date.now(), iso = function (ms) { return new Date(ms).toISOString(); };
  var VOIX = [{ id: 'v-h1', name: 'Hugo', gender: 'M' }, { id: 'v-h2', name: 'Jérémy', gender: 'M' }, { id: 'v-f1', name: 'Claire', gender: 'F' }, { id: 'v-f2', name: 'Jade', gender: 'F' }];
  var CONFIG = { id: 1, claude_model: 'claude-sonnet-5-5', voice_mode_enabled: true, eleven_labs_model_id: 'eleven_flash_v2_5', eleven_labs_stability: 0.2, eleven_labs_style: 0.2,
    eleven_labs_speed: 1.2, silence_timeout_ms: 800, daily_analysis_limit: 10, updated_at: iso(now - 86400000) };
  var nadia = { id: 'nadia-1', identite: { prenom: 'Nadia', gender: 'F', age: 38, ville: 'Lyon', metier: 'Professeure des écoles en reconversion', situation: 'Veut changer de métier', ca_actuel: '2 300 € par mois', objectif_ca: '3 500 € par mois' },
    etatsInitiaux: { conscience: 3, confiance: 4, engagement: 5, etat_emotionnel: 'Prudente' }, backstory: 'Douze ans d’enseignement, envie de changer.', douleurs: { surface: ['Fatigue'], consequences: ['Moins de temps en famille'], emotionnel: ['Lassitude'], identitaire: ['Peur de l’échec'] },
    objections: [{ texte: 'C’est trop cher pour moi.', vraie_raison: 'Peur de se tromper', declencheur: 'Annonce du prix' }],
    objectionsMode: { prixOffre: '2 400 €', gap: { financier: '1 200 €', temps: '6 mois', total: '...' }, objectionPrix: { surface: 'Trop cher', vraie_objection: 'Peur' } },
    briefing: { attentes_appel: { pourquoi_appel: 'Comprendre la formation', attentes_echange: 'Être rassurée' }, niveau_conscience: { niveau: 3, label: 'SOLUTION AWARE', description: '...', objectif_progression: '...' } } };
  var DB = {
    crm_members: [{ id: 'u1', full_name: 'Paul Martin', email: 'paul@exemple.fr', active: true }, { id: 'u2', full_name: 'Lucie Bernard', email: 'lucie@exemple.fr', active: true }, { id: 'u9', full_name: 'Admin Exemple', email: 'admin@exemple.fr', active: true }],
    crm_sim_config: [CONFIG],
    crm_sim_offers: [
      { id: '11111111-1111-1111-1111-111111111111', name: 'Formation exemple · 6 mois', price: '2 400 €', sector: 'Formation', status: 'ready', archived: false, created_at: iso(now - 9 * 86400000), error: null,
        data: { offer_identity: { company_name: 'Académie Exemple', main_promise: 'Changer de métier en six mois', positioning: 'Accompagnement individuel' }, offer_details: { main_offer: { price: 2400, duration: '6 mois', financing_options: ['3 fois sans frais'] } }, tools_taught: [{ name: 'Tableur' }] },
        sources: [{ type: 'txt', filename: 'contenu-colle.txt', char_count: 1200 }] },
      { id: '22222222-2222-2222-2222-222222222222', name: 'Offre en préparation', price: null, status: 'generating', archived: false, created_at: iso(now - 3600000), data: {}, sources: [] }],
    crm_sim_personas: [
      { id: 'nadia-1', offer_id: '11111111-1111-1111-1111-111111111111', first_name: 'Nadia', age: 38, city: 'Lyon', profession: 'Professeure des écoles en reconversion', situation: 'Veut changer de métier', difficulty: 'moyen', consciousness_level: 3, voice_id: 'v-f1', position: 0, active: true, full_persona_data: nadia },
      { id: 'paul-2', offer_id: '11111111-1111-1111-1111-111111111111', first_name: 'Paul', age: 45, city: 'Nantes', profession: 'Responsable commercial dans l’industrie', situation: '', difficulty: 'difficile', consciousness_level: 2, voice_id: null, position: 1, active: true,
        full_persona_data: { id: 'paul-2', identite: { prenom: 'Paul', gender: 'M', age: 45, ville: 'Nantes', metier: 'Responsable commercial', ca_actuel: null, objectif_ca: null } } }],
    crm_sim_simulations: [
      { id: 41, user_id: 'u1', status: 'completed', started_at: iso(now - 3 * 86400000), ended_at: iso(now - 3 * 86400000 + 900000), duration_seconds: 900, prospect_name: 'Nadia', persona_id: 'nadia-1', offer_id: '11111111-1111-1111-1111-111111111111', difficulty: 'moyen', simulation_mode: 'full', voice: false, persona_data: nadia },
      { id: 42, user_id: 'u1', status: 'active', started_at: iso(now - 600000), prospect_name: 'Paul', persona_id: 'paul-2', offer_id: '11111111-1111-1111-1111-111111111111', difficulty: 'difficile', simulation_mode: 'diagnostic', voice: false, persona_data: null },
      { id: 43, user_id: 'u2', status: 'completed', started_at: iso(now - 7200000), ended_at: iso(now - 6000000), duration_seconds: 1200, prospect_name: 'Nadia', persona_id: 'nadia-1', offer_id: '11111111-1111-1111-1111-111111111111', difficulty: 'moyen', simulation_mode: 'objections', voice: true, persona_data: nadia }],
    crm_sim_messages: [
      { id: 1, simulation_id: 41, role: 'commercial', content: 'Bonjour Nadia, merci d’être là.', created_at: iso(now - 3 * 86400000 + 5000) },
      { id: 2, simulation_id: 41, role: 'prospect', content: 'Bonjour, oui, je voulais en savoir plus.', created_at: iso(now - 3 * 86400000 + 9000) },
      { id: 3, simulation_id: 42, role: 'prospect', content: 'Alors, on en était où ?', created_at: iso(now - 590000) },
      { id: 4, simulation_id: 43, role: 'prospect', content: 'C’est trop cher.', created_at: iso(now - 7100000) }],
    crm_sim_analyses: [], crm_sim_feedback: []
  };
  var seq = 100;
  function resultat(score, niveau) {
    var it = function (id, label, statut, points, verbatim, com) { return { id: id, label: label, statut: statut, points: points, verbatim: verbatim, commentaire: com || '' }; };
    return { score_total: score, niveau: niveau, _modele: 'grille', turning_point: null,
      dimensions: {
        structure: { items: [it('C1', 'Connexion personnelle avant d’entrer dans le vif du sujet', 'correct', 4, 'Bonjour Nadia, merci d’être là.'), it('C2', 'Cadre de l’appel posé et accepté', 'partiel', 3, null, 'Signaux manquants : durée annoncée.')], score: 7, scoreMax: 10 },
        diagnostic: { items: [it('L1', 'Questions de situation (faits)', 'correct', 3, 'Vous enseignez depuis combien de temps ?'), it('L2', 'Problème creusé et verbalisé par le prospect', 'absent', 0, null, 'Signaux manquants : creusement.')], score: 12.5, scoreMax: 26 },
        valeur: { items: [it('E1', 'Synthèse de l’écart : point A, point B, blocage', 'partiel', 3.5, null, 'Signaux manquants : blocage.')], score: 3.5, scoreMax: 20 },
        pcm: { items: [], score: 0, scoreMax: 0 },
        conclusion: { items: [it('R5', 'Demande de décision posée', 'correct', 6, 'On démarre lundi ?')], score: 6, scoreMax: 6 } },
      point_fort: 'Étape la mieux tenue : C · Connexion — 7/10 points.', point_faible: 'Pilier le plus coûteux de l’appel : L2 — problème creusé (7 points perdus).',
      drill: { type: 'decouverte', titre: 'Creuser le problème', duree_estimee: '2min', contexte: 'Le prospect dit qu’il est fatigué.', consigne: 'Pose deux questions pour faire préciser cette fatigue.', exemple_reponse: 'Qu’est-ce qui vous fatigue le plus, concrètement ?' },
      annotations: [{ timestamp: '', dimension: 'structure', critere: 'C1', label: 'C1 — Connexion personnelle', verbatim: 'Bonjour Nadia, je suis Paul', evaluation: 'positif', pourquoi: 'Accueil chaleureux.' },
        { timestamp: '', dimension: 'diagnostic', critere: 'L2', label: 'L2 — Problème creusé', verbatim: '', evaluation: 'negatif', pourquoi: 'Le problème n’a pas été creusé.' }],
      grille: { version_grille: 'GRILLE_v1.0', version_seuils: 'v0.12', score_hors_plafond: null, eliminatoire_declenche: false,
        conditions: [{ code: 'CADRE_NON_POSE', libelle: 'Cadre de l’appel jamais posé', etat: 'active', statut: 'non_declenchee', motif: 'cadre_pose' },
          { code: 'PITCH_AVANT_GAP', libelle: 'Offre présentée avant la synthèse de l’écart', etat: 'active', statut: 'indeterminee', motif: 'offre présentée en prise de parole 40, synthèse de l’écart en 62' },
          { code: 'RETOUR_DIAGNOSTIC', libelle: 'Question de découverte reposée après la présentation', etat: 'suspendue', statut: 'non_declenchee', motif: '' }] } };
  }
  DB.crm_sim_analyses.push({ id: 'a41', simulation_id: 41, user_id: 'u1', status: 'completed', created_at: iso(now - 3 * 86400000 + 1000000), completed_at: iso(now - 3 * 86400000 + 1060000), result: resultat(48, 'insuffisant'), aar: null, miroir: null });
  DB.crm_sim_analyses.push({ id: 'a43', simulation_id: 43, user_id: 'u2', status: 'rejected', reason: 'Le mode Objections n’est pas analysé : seuls l’appel complet et le diagnostic le sont.', created_at: iso(now - 6000000), result: null });
  window.__calls = []; window.__reads = {};
  function match(row, f) { return f.every(function (x) { return x[2] === 'in' ? x[1].indexOf(row[x[0]]) >= 0 : row[x[0]] === x[1]; }); }
  function from(table) {
    var st = { f: [], order: null, limit: null, single: null };
    var b = {
      select: function () { return b; }, eq: function (c, v) { st.f.push([c, v]); return b; }, in: function (c, v) { st.f.push([c, v, 'in']); return b; },
      order: function (c, o) { st.order = [c, !(o && o.ascending === false)]; return b; }, limit: function (n) { st.limit = n; return b; },
      maybeSingle: function () { st.single = 'maybe'; return b; }, single: function () { st.single = 'one'; return b; },
      then: function (res, rej) {
        return new Promise(function (r) { setTimeout(r, 15); }).then(function () {
          var rows = (DB[table] || []).filter(function (r) { return match(r, st.f); });
          if (table === 'crm_sim_analyses') rows.forEach(function (r) { window.__reads[r.id] = (window.__reads[r.id] || 0) + 1; if (r.id === 'a100' && r.status === 'processing' && window.__reads[r.id] >= 2) { r.status = 'completed'; r.completed_at = new Date().toISOString(); r.result = resultat(62, 'discovery'); } });
          if (st.order) rows.sort(function (a, b) { var x = a[st.order[0]], y = b[st.order[0]]; return (x > y ? 1 : x < y ? -1 : 0) * (st.order[1] ? 1 : -1); });
          if (st.limit) rows = rows.slice(0, st.limit);
          rows = JSON.parse(JSON.stringify(rows));
          return { data: st.single ? rows[0] || null : rows, error: null };
        }).then(res, rej);
      } };
    return b;
  }
  function historique(pUser) {
    return DB.crm_sim_simulations.filter(function (s) { return (ADMIN || s.user_id === ME) && (!pUser || s.user_id === pUser); }).map(function (s) {
      var a = DB.crm_sim_analyses.filter(function (x) { return x.simulation_id === s.id; })[0], m = DB.crm_members.filter(function (x) { return x.id === s.user_id; })[0];
      var o = DB.crm_sim_offers.filter(function (x) { return x.id === s.offer_id; })[0], fb = DB.crm_sim_feedback.filter(function (x) { return x.simulation_id === s.id; })[0];
      return { id: s.id, user_id: s.user_id, name: m && m.full_name, status: s.status, started_at: s.started_at, ended_at: s.ended_at, duration_seconds: s.duration_seconds, prospect_name: s.prospect_name,
        persona_id: s.persona_id, offer_id: s.offer_id, offer_name: o && o.name, mode: s.simulation_mode, difficulty: s.difficulty, voice: s.voice,
        messages: DB.crm_sim_messages.filter(function (x) { return x.simulation_id === s.id; }).length,
        analysis: a ? { id: a.id, status: a.status, reason: a.reason || null, score: a.result ? a.result.score_total : null, niveau: a.result ? a.result.niveau : null } : null, rating: fb ? fb.rating : null };
    }).sort(function (a, b) { return a.started_at < b.started_at ? 1 : -1; });
  }
  var CRM = { from: from, rpc: function (fn, args) { return new Promise(function (r) { setTimeout(r, 15); }).then(function () { if (fn === 'crm_sim_history') return historique(args && args.p_user); throw new Error('rpc inconnue'); }); },
    me: function () { return Promise.resolve(DB.crm_members.filter(function (m) { return m.id === ME; })[0]); } };
  var enc = new TextEncoder();
  function json(b, s) { return new Response(JSON.stringify(b), { status: s || 200, headers: { 'Content-Type': 'application/json' } }); }
  function sse(events, delay) {
    return new Response(new ReadableStream({ start: async function (c) {
      for (var i = 0; i < events.length; i++) { c.enqueue(enc.encode('data: ' + JSON.stringify(events[i]) + '\n\n')); await new Promise(function (r) { setTimeout(r, delay); }); }
      c.close(); } }), { headers: { 'Content-Type': 'text/event-stream' } });
  }
  function msgs(id) { return DB.crm_sim_messages.filter(function (m) { return m.simulation_id === id; }); }
  var REPLY = 'Bonjour ! Oui, je vous écoute. Je me demande surtout si la formation est faite pour moi.';
  async function fetchStub(path, init) {
    init = init || {}; var m = (init.method || 'GET').toUpperCase(), body = init.body ? JSON.parse(init.body) : null;
    window.__calls.push({ m: m, path: path, body: body });
    await new Promise(function (r) { setTimeout(r, 20); });
    var p = path.split('/');
    if (path === 'moi') return json({ id: ME, email: ADMIN ? 'admin@exemple.fr' : 'paul@exemple.fr', role: ADMIN ? 'admin' : 'sales', admin: ADMIN, voixElevenLabs: false, voix: VOIX, config: CONFIG });
    if (path === 'config' && m === 'PUT') { Object.assign(CONFIG, body, { updated_at: new Date().toISOString() }); return json(CONFIG); }
    if (path === 'tts') return json({ fallback: 'speechSynthesis', speed: 1.2 });
    if (path === 'simulations' && m === 'POST') {
      var per = DB.crm_sim_personas.filter(function (x) { return x.id === body.personaId; })[0];
      var s = { id: seq, user_id: ME, status: 'active', started_at: new Date().toISOString(), prospect_name: per.first_name, persona_id: per.id, offer_id: per.offer_id, difficulty: per.difficulty, simulation_mode: body.simulationMode, voice: body.voiceMode, persona_data: per.full_persona_data };
      DB.crm_sim_simulations.push(s); seq++;
      return json(Object.assign({}, s, { messages: [] }), 201);
    }
    if (p[0] === 'simulations') {
      var id = Number(p[1]), sim = DB.crm_sim_simulations.filter(function (x) { return x.id === id; })[0];
      if (p[2] === 'messages' && !p[3] && m === 'POST') {
        var u = { id: Date.now(), simulation_id: id, role: 'commercial', content: body.content, created_at: new Date().toISOString() };
        var pr = { id: Date.now() + 1, simulation_id: id, role: 'prospect', content: REPLY, created_at: new Date(Date.now() + 1500).toISOString() };
        DB.crm_sim_messages.push(u, pr);
        var parts = REPLY.match(/.{1,12}/g).map(function (x) { return { content: x }; });
        return sse([{ userMessage: u }].concat(parts, [{ done: true, prospectMessage: pr }]), 120);
      }
      if (p[2] === 'messages' && p[3] === 'undo') {
        var l = msgs(id), last = l.slice(-2);
        DB.crm_sim_messages = DB.crm_sim_messages.filter(function (x) { return last.indexOf(x) < 0; });
        return json({ success: true, deleted: last.length, messageCount: msgs(id).length, messages: msgs(id) });
      }
      if (p[2] === 'end') {
        if (sim.status !== 'active') return json({ error: 'Simulation is not active' }, 400);
        sim.status = 'completed'; sim.ended_at = new Date().toISOString(); sim.duration_seconds = 420;
        if (body && body.skipAnalysis) return json({ simulation: sim, analysisId: null, skippedAnalysis: true });
        DB.crm_sim_analyses.push({ id: 'a100', simulation_id: id, user_id: ME, status: 'processing', created_at: new Date().toISOString(), result: null, aar: null, miroir: null });
        return json({ simulation: sim, analysisId: 'a100' });
      }
      if (p[2] === 'voix') {
        var cu = { id: Date.now(), simulation_id: id, role: 'commercial', content: body.content, created_at: new Date().toISOString() };
        var cp = { id: Date.now() + 1, simulation_id: id, role: 'prospect', content: 'On parlait de mes 2 enfants. Je vous écoute.', created_at: new Date().toISOString() };
        DB.crm_sim_messages.push(cu, cp);
        return sse([{ userMessage: cu }, { content: 'On parlait de mes deux enfants. Je vous écoute.' }, { done: true, prospectMessage: cp, spokenText: 'On parlait de mes deux enfants. Je vous écoute.', voiceId: 'v-h1' }], 60);
      }
      if (p[2] === 'feedback') { DB.crm_sim_feedback.push({ simulation_id: id, rating: body.rating, comment: body.comment }); return json({ success: true }, 201); }
      if (!p[2] && m === 'DELETE') { DB.crm_sim_simulations = DB.crm_sim_simulations.filter(function (x) { return x.id !== id; }); return json({ success: true }); }
    }
    if (p[0] === 'analyses' && p[2] === 'aar') {
      var a = DB.crm_sim_analyses.filter(function (x) { return x.id === p[1]; })[0];
      var mir = { moment_bien_gere: { reponse_commercial: body.momentBienGere, verdict: 'confirme', verdict_label: 'L’IA confirme', explication: 'Ton accueil a bien posé la relation.', lien: { tab: 'analyse', label: 'Voir la connexion' } },
        moment_difficile: { reponse_commercial: body.momentDifficile, verdict: 'nuance', verdict_label: 'L’IA voit autre chose', explication: 'La difficulté venait plutôt du cadre.' },
        ce_que_je_referais: { reponse_commercial: body.ceQueJeReferais, verdict: 'contredit', verdict_label: 'Décalage', explication: 'Le plus utile serait de creuser le problème.' },
        niveau: { estime: 'Découverte', reel: 'Découverte', verdict: 'confirme', message: 'Ta perception est parfaitement alignée avec ton niveau réel.' } };
      a.aar = body; a.miroir = mir;
      return json({ success: true, miroir: mir });
    }
    if (p[0] === 'analyses' && p[1] === 'reprendre') return json({ relancees: 1, echouees: 0, enAttente: 0 });
    if (p[0] === 'offres' && m === 'POST' && !p[1]) {
      var o = { id: '33333333-3333-3333-3333-333333333333', name: body.name || 'Nouvelle offre', status: 'extracting', archived: false, created_at: new Date().toISOString(), data: {}, sources: [] };
      DB.crm_sim_offers.unshift(o); setTimeout(function () { o.status = 'ready'; }, 2500);
      return json({ isNew: true, message: 'Nouvelle offre créée : lecture des sources, puis génération des prospects.', offer: o }, 202);
    }
    if (p[0] === 'personas' && m === 'DELETE') { DB.crm_sim_personas = DB.crm_sim_personas.filter(function (x) { return x.id !== p[1]; }); return json({ success: true }); }
    if (p[0] === 'personas' && m === 'PATCH') { var pp = DB.crm_sim_personas.filter(function (x) { return x.id === p[1]; })[0]; Object.assign(pp, body); return json(pp); }
    if (p[0] === 'offres') return json({ success: true }, 202);
    return json({ error: 'Route inconnue' }, 404);
  }
  window.claude = { web: true, use: function (name) {
    return Promise.resolve(name === 'crm' ? CRM : name === 'simulateur' ? { url: '${ORIGIN}/functions/v1/simulateur', token: function () { return Promise.resolve('jeton-' + ME); }, fetch: fetchStub }
      : name === 'user' ? { id: function () { return Promise.resolve(ME); } } : null);
  } };
})();`;
const WRAP = '<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>LNP</title><style>html,body{margin:0;height:100%}iframe{border:0;width:100%;height:100%;display:block}</style>' +
  '<script>' + STUB + '</script></head><body><iframe title="Simulateur" src="/simulateur.html"></iframe></body></html>';

(async () => {
  const b = await chromium.launch();
  const ok = [], bad = []; const check = (n, c, i) => (c ? ok : bad).push(n + (c ? '' : ' → ' + JSON.stringify(i)));
  const errs = [], texts = [];
  async function open(admin, w, h) {
    const ctx = await b.newContext({ viewport: { width: w || 1440, height: h || 900 }, deviceScaleFactor: 1 });
    const p = await ctx.newPage();
    p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/fonts\.g|ERR_|Failed to load resource/.test(m.text())) errs.push(m.text()); });
    await p.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    await p.route(ORIGIN + '/**', r => {
      const u = new URL(r.request().url());
      if (u.pathname === '/simulateur.html') return r.fulfill({ contentType: 'text/html; charset=utf-8', body: HTML });
      if (u.pathname.startsWith('/functions/')) { p.__beacons = (p.__beacons || []).concat([r.request().postData()]); return r.fulfill({ contentType: 'application/json', body: '{"ok":true}' }); }
      return r.fulfill({ contentType: 'text/html; charset=utf-8', body: WRAP });
    });
    // a fake microphone, speech recognition and speech synthesis, in every frame
    await p.addInitScript(() => {
      try { localStorage.setItem('lnp-sim-voix', 'false'); } catch (e) {}
      window.__recs = [];
      class FakeSR { constructor() { window.__recs.push(this); } start() { setTimeout(() => this.onstart && this.onstart(), 10); } stop() { setTimeout(() => this.onend && this.onend(), 5); } abort() { setTimeout(() => this.onend && this.onend(), 5); } }
      window.webkitSpeechRecognition = FakeSR; window.SpeechRecognition = FakeSR;
      Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: async () => ({ getTracks: () => [] }) } });
      window.__dit = [];
      if (window.parent !== window) {
        const OB = window.Blob;
        window.Blob = function (parts, o) { const x = new OB(parts, o); try { x.__txt = parts.map(String).join(''); } catch (e) {} return x; };
        window.Blob.prototype = OB.prototype;
        navigator.sendBeacon = (u, d) => { (window.parent.__beacons = window.parent.__beacons || []).push(u + ' ' + (d && d.__txt != null ? d.__txt : String(d))); return true; };
      }
      if (window.speechSynthesis) speechSynthesis.speak = (u) => { window.__dit.push(u.text); setTimeout(() => u.onend && u.onend(), 150); };
    });
    await p.goto(ORIGIN + '/lnp.html' + (admin ? '?admin=1' : ''));
    const f = p.frames().find(x => x.url().endsWith('/simulateur.html'));
    await f.waitForSelector('h1');
    return { ctx, p, f };
  }
  const visible = async (f, tag) => { const t = await f.evaluate(() => document.body.innerText); texts.push([tag, t]); return t; };
  const wait = ms => new Promise(r => setTimeout(r, ms));

  // ---------------------------------------------------------------- a sales rep
  const { ctx, p, f } = await open(false);
  await f.waitForSelector('.pc');
  let t = await visible(f, 'accueil');
  check('Nouvelle simulation: title, three modes, the offer and its two prospects', /Nouvelle simulation/.test(t) && (await f.$$('.mb')).length === 3 && (await f.$$('.ob')).length === 2 && (await f.$$('.pc')).length === 2, t.slice(0, 300));
  check('the banner of the active simulation with « Reprendre »', /Conversation en cours avec Paul/.test(t) && !!(await f.$('.brow [data-go="#appel/42"]')), null);
  check('no admin section for a sales rep', !(await f.$('[data-go="#offres"]')) && !(await f.$('[data-go="#reglages"]')), null);
  check('Texte chosen (lnp-sim-voix)', (await f.getAttribute('[data-v="0"][data-do="h-voix"]', 'aria-pressed')) === 'true', null);
  // objections: a prospect without the data cannot be launched
  await f.click('[data-do="h-mode"][data-v="objections"]'); await f.click('[data-do="h-prospect"][data-v="paul-2"]'); await wait(50);
  check('Objections: Paul has no data, the launch is closed', /Pas de données pour le mode Objections/.test(await f.textContent('[data-v="paul-2"]')) && await f.$eval('[data-do="lancer"]', e => e.disabled), null);
  await f.click('[data-do="h-mode"][data-v="full"]'); await f.click('[data-do="h-prospect"][data-v="nadia-1"]'); await wait(50);
  await p.screenshot({ path: OUT + '/simulateur-accueil.png' });
  await f.click('[data-do="lancer"]');
  await f.waitForSelector('#ta');
  await p.screenshot({ path: OUT + '/simulateur-appel-debut.png' });
  t = await visible(f, 'appel');
  check('the call: name, 45 min countdown, empty state, fiche prospect', /Nadia/.test(await f.textContent('.cwho')) && /\/ 45:00/.test(await f.textContent('#timer')) && /L’appel commence maintenant/.test(t) && /Fiche prospect/.test(t) && /Professeure des écoles/.test(t), null);
  check('the phase tracker: 7 phases, phase 7 « Conclusion »', (await f.$$('.ph')).length === 7 && /Conclusion \(0\/4\)/.test(await f.textContent('.phs')), await f.textContent('.phs'));
  await f.click('[data-do="crit"][data-v="1"]');
  check('a criterion chip: validated, then missed', (await f.getAttribute('[data-do="crit"][data-v="1"]', 'class')).includes(' y'), null);
  await f.click('[data-do="crit"][data-v="1"]');
  check('… then missed', (await f.getAttribute('[data-do="crit"][data-v="1"]', 'class')).includes(' n'), null);
  check('« Annuler le dernier échange » closed before any exchange', await f.$eval('[data-do="undo"]', e => e.disabled), null);
  await f.fill('#ta', 'Bonjour Nadia, je suis Paul de LNP. Vous avez cinq minutes ?');
  await f.press('#ta', 'Enter');
  await f.waitForSelector('#streamb', { timeout: 3000 });
  const part = await f.textContent('#streamb');
  check('the reply streams in (partial text shown)', part.length > 0 && part.length < 90, part);
  await f.waitForFunction(() => !document.querySelector('#streamb') && document.querySelectorAll('.msg.p').length === 1, null, { timeout: 8000 });
  check('the streamed reply ends as a prospect bubble', /si la formation est faite pour moi/.test(await f.textContent('.msg.p')) && (await f.$$('.msg.s')).length === 1, null);
  await f.fill('#ta', 'Qu’est-ce qui vous amène ?'); await f.press('#ta', 'Enter');
  await f.waitForFunction(() => document.querySelectorAll('.msg.p').length === 2 && !document.querySelector('#streamb'), null, { timeout: 8000 });
  await p.screenshot({ path: OUT + '/simulateur-appel.png' });
  await f.click('[data-do="undo"]');
  await f.waitForSelector('[role="alertdialog"]');
  check('the undo asks for a confirmation', /Annuler le dernier échange \?/.test(await f.textContent('[role="alertdialog"]')), null);
  await f.click('[data-x="yes"]'); await wait(300);
  check('the last exchange is undone', (await f.$$('.msg')).length === 2 && /Dernier échange annulé/.test(await f.textContent('#toasts')), (await f.$$('.msg')).length);
  // the end
  await f.click('[data-do="terminer"]');
  await f.waitForSelector('[role="alertdialog"]');
  t = await f.textContent('[role="alertdialog"]');
  check('the end dialog: three choices, a report, no email', /Terminer l’appel \?/.test(t) && /Quitter sans analyser/.test(t) && /Terminer et analyser/.test(t) && /Continuer l’appel/.test(t) && /Un rapport d’analyse sera généré\./.test(t) && !/mail/i.test(t) && /très courte/.test(t), t);
  await f.press('[role="alertdialog"] [data-x="cont"]', 'Escape'); await wait(50);
  check('Échap closes it', !(await f.$('[role="alertdialog"]')), null);
  await f.click('[data-do="terminer"]'); await f.click('[data-x="end"]');
  await f.waitForSelector('.stars');
  t = await visible(f, 'avis');
  check('the note: « Avez-vous apprécié la simulation ? », 5 stars', /Avez-vous apprécié la simulation \?/.test(t) && (await f.$$('[data-star]')).length === 5, null);
  await f.click('[data-star="5"]');
  check('5 stars: « Merci ! »', /Merci !/.test(await f.textContent('.modal')), null);
  await f.waitForSelector('#aar', { timeout: 3000 });
  const calls = () => p.evaluate(() => window.__calls);
  check('5 stars: sent by itself after 500 ms', (await calls()).some(c => /feedback$/.test(c.path) && c.body.rating === 5 && c.body.comment === null), null);
  t = await visible(f, 'aar');
  check('the self-analysis: French texts', /Auto-analyse/i.test(t) && /Avant de voir le retour/.test(t) && /meilleurs commerciaux/.test(t) && /Question 1 \/ 4/i.test(t), t.slice(0, 400));
  check('« Suivant » closed while the answer is empty', await f.$eval('[data-do="aar-suiv"]', e => e.disabled), null);
  await f.fill('#aar', 'L’accueil, j’ai pris le temps.'); await f.click('[data-do="aar-suiv"]');
  await f.fill('#aar', 'Quand elle a parlé du prix.'); await f.press('#aar', 'Control+Enter');
  check('Ctrl+Entrée passes to the next question', /Question 3 \/ 4/.test(await f.textContent('#fin')), null);
  await f.fill('#aar', 'Je creuserais sa fatigue.'); await f.click('[data-do="aar-suiv"]');
  t = await f.textContent('#fin');
  check('question 4: the four French levels', /Quel niveau de commercial/.test(t) && ['Découverte', 'Diagnostic', 'Stratégique', 'Élite'].every(x => t.includes(x)), t);
  await p.screenshot({ path: OUT + '/simulateur-aar.png' });
  await f.click('[data-lv="discovery"]'); await f.click('[data-do="aar-env"]');
  await f.waitForSelector('#scoreN', { timeout: 10000 });
  check('the AAR is sent', (await calls()).some(c => c.path === 'analyses/a100/aar' && c.body.niveauEstime === 'discovery' && c.body.momentBienGere), null);
  await wait(2300);
  t = await visible(f, 'résultat');
  check('the result: score 62/100, level « Découverte »', (await f.textContent('#scoreN')).trim() === '62' && /Découverte/.test(await f.textContent('.lvl')), await f.textContent('.score'));
  check('the five dimensions in French', ['Connexion', 'Écoute', 'Exposition', 'Alignement', 'Résolution'].every(x => t.includes(x)) && /non évalué/.test(t), null);
  check('point fort, pilier, exercise, conditions', /Point fort/i.test(t) && /Pilier à travailler/i.test(t) && /Exercice ciblé/i.test(t) && /Conditions éliminatoires/.test(t) && /Non constatée/.test(t) && /Suspendue/.test(t) && /synthèse de l’écart en 62/.test(t) && !/cadre_pose/.test(t), null);
  check('the AAR and the mirror', /Ton analyse face à l’IA/.test(t) && /Ton meilleur moment/i.test(t) && /L’accueil, j’ai pris le temps/.test(t) && /Décalage/i.test(t) && /parfaitement alignée/.test(t), null);
  await p.screenshot({ path: OUT + '/simulateur-resultat.png' });
  await f.click('#tab-analyse'); await wait(50);
  t = await visible(f, 'analyse');
  check('Analyse détaillée: items with status and points', /Connexion personnelle avant d’entrer/.test(t) && /Correct/.test(t) && /\+4 pt/.test(t), null);
  await f.click('[data-dim="diagnostic"]'); await f.click('.it summary >> nth=1'); await wait(50);
  check('an item opens: missing signals', /Signaux manquants : creusement\./.test(await f.textContent('#panel')), null);
  await f.click('[data-dim="pcm"]');
  check('a dimension without item', /Aucun élément évaluable/.test(await f.textContent('#panel')), null);
  await f.click('#tab-lignes'); await wait(50);
  t = await visible(f, 'lignes');
  check('Ligne à ligne: the remark next to the line, filters', /Bien joué — C1/.test(t) && /À corriger 1/.test(t), null);
  await p.screenshot({ path: OUT + '/simulateur-lignes.png' });
  await f.click('#tab-exercice'); await wait(50);
  check('Exercice: duration in French, model hidden', /Exercice · 2 min/.test(await f.textContent('#panel')) && /Questions de découverte/.test(await f.textContent('#panel')) && await f.$eval('[data-do="ex-voir"]', e => e.disabled), null);
  await f.fill('#exr', 'Qu’est-ce qui vous fatigue le plus ?'); await f.click('[data-do="ex-voir"]');
  check('the model answer shows', /Réponse modèle/.test(await f.textContent('#panel')), null);
  await f.click('#tab-progression'); await f.waitForSelector('#panel svg.chart');
  t = await visible(f, 'progression');
  check('Progression: a chart over the analysed calls', /Score sur 2 appels analysés/.test(t) && (await f.$$('#panel svg circle')).length === 2, t.slice(0, 200));
  await p.screenshot({ path: OUT + '/simulateur-progression.png' });
  // history
  await f.click('[data-go="#historique"]'); await f.waitForSelector('.hr');
  t = await visible(f, 'historique');
  check('the history: the three simulations of the person', (await f.$$('.hr')).length === 3 && /Analysée/.test(t) && /Appel en cours/.test(t), (await f.$$('.hr')).length);
  check('no person filter for a sales rep', !(await f.$('[data-hf="personne"]')), null);
  await f.selectOption('[data-hf="statut"]', 'completed'); await wait(30);
  check('the status filter', (await f.$$('.hr')).length === 2, (await f.$$('.hr')).length);
  await f.selectOption('[data-hf="statut"]', ''); await f.selectOption('[data-hf="tri"]', 'best'); await wait(30);
  check('sorted by best score', /62/.test(await f.textContent('.hr .hs')), await f.textContent('.hr .hs'));
  await f.fill('[data-hf="q"]', 'diagnostic'); await wait(30);
  check('the search', (await f.$$('.hr')).length === 1, (await f.$$('.hr')).length);
  await f.fill('[data-hf="q"]', ''); await wait(30);
  await p.screenshot({ path: OUT + '/simulateur-historique.png' });
  const [dl] = await Promise.all([p.waitForEvent('download'), f.click('[data-do="h-txt"] >> nth=0')]);
  check('the conversation downloads as .txt', /^conversation-.*\.txt$/.test(dl.suggestedFilename()), dl.suggestedFilename());
  const n0 = (await f.$$('.hr')).length;
  await f.click('[data-do="h-suppr"] >> nth=0'); await f.waitForSelector('[role="alertdialog"]');
  check('the deletion asks first', /Supprimer cette simulation \?/.test(await f.textContent('[role="alertdialog"]')), null);
  await f.click('[data-x="yes"]'); await wait(400);
  check('deleted: DELETE simulations/:id, one row less', (await calls()).some(c => c.m === 'DELETE' && /^simulations\/\d+$/.test(c.path)) && (await f.$$('.hr')).length === n0 - 1, null);
  // the active call reopened, then left: the beacon carries the token
  await f.click('[data-go="#appel/42"]'); await f.waitForSelector('#ta');
  check('« Reprendre » reopens the active call (diagnostic: phases 3 and 4)', (await f.$$('.ph')).length === 2 && /Alors, on en était où/.test(await f.textContent('#msgs')), null);
  // hands-free voice: the greeting is spoken, a turn ends on silence, the reply is spoken sentence by sentence
  await f.click('[data-do="v-voix"]');
  await f.waitForFunction(() => !document.getElementById('orbw').hidden && /Je vous écoute|parle/.test(document.getElementById('orbl').textContent));
  await f.waitForFunction(() => (window.__dit || []).length >= 1, null, { timeout: 4000 });
  check('voice: the first prospect line is spoken (no new bubble)', (await f.evaluate(() => window.__dit))[0] === 'Alors, on en était où ?' && (await f.$$('.msg.p .bub:not(.typing)')).length === 1 &&
    (await calls()).some(c => c.path === 'tts' && c.body.voiceId === 'v-h1'), [await f.evaluate(() => window.__dit), (await calls()).filter(c => c.path === 'tts'), (await f.$$('.msg.p .bub:not(.typing)')).length]);
  await f.waitForFunction(() => document.getElementById('orbl').textContent === 'Je vous écoute…');
  await wait(500);   // half-duplex (browser voice): listening resumes 300 ms after the voice ends
  await f.evaluate(() => { const r = window.__recs[window.__recs.length - 1]; const res = [{ transcript: 'Bonjour Paul, on reprend où on en était ?' }]; res.isFinal = true; r.onresult({ resultIndex: 0, results: [res] }); });
  check('voice: the transcript shows while speaking', /on reprend où on en était/.test(await f.textContent('#vt')), await f.textContent('#vt'));
  await f.waitForFunction(() => document.querySelectorAll('.msg.p .bub:not(.typing)').length === 2, null, { timeout: 5000 });
  check('voice: the turn is sent after the silence (POST simulations/:id/voix)', (await calls()).some(c => c.path === 'simulations/42/voix' && c.body.content === 'Bonjour Paul, on reprend où on en était ?'), null);
  await f.waitForFunction(() => (window.__dit || []).length >= 3 && document.getElementById('orbl').textContent === 'Je vous écoute…', null, { timeout: 5000 });
  check('voice: the reply is spoken sentence by sentence (speechSynthesis), the bubble keeps the figures', (await f.evaluate(() => window.__dit)).slice(1).join('|') === 'On parlait de mes deux enfants.|Je vous écoute.' && /mes 2 enfants/.test(await f.textContent('#msgs')), await f.evaluate(() => window.__dit));
  await p.screenshot({ path: OUT + '/simulateur-voix.png' });
  await f.click('[data-do="v-texte"]'); await f.waitForSelector('#ta');
  check('back to text', await f.$eval('#orbw', e => e.hidden), null);
  // leaving the page during a call: the end goes by beacon, with the token
  await f.evaluate(() => { location.href = 'about:blank'; }); await wait(500);
  const beacons = await p.evaluate(() => (window.__beacons || []).slice());
  check('leaving during a call: sendBeacon end with the token', beacons.some(x => /\/simulateur\/simulations\/42\/end /.test(x) && /"beacon":true/.test(x) && /"token":"jeton-u1"/.test(x)), beacons);
  await ctx.close();

  // ---------------------------------------------------------------- an admin
  const A = await open(true, 1920, 1080);
  const g = A.f;
  await g.waitForSelector('.pc');
  check('admin: four sections', (await g.$$eval('#nav button', x => x.map(e => e.textContent))).join('|') === 'Nouvelle simulation|Historique|Offres et prospects|Réglages', await g.$$eval('#nav button', x => x.map(e => e.textContent)));
  await g.click('[data-go="#offres"]'); await g.waitForSelector('.oi');
  check('the offer being prepared is selected first, its status shown', /Création des prospects en cours/.test(await g.textContent('#view')), null);
  await g.click('.oi >> text=Formation exemple'); await g.waitForSelector('table.t');
  t = await visible(g, 'offres');
  check('Offres et prospects: offers with status, prospects table', /Formation exemple/.test(t) && /Création des prospects…/.test(t) && (await g.$$('table.t tbody tr')).length === 2 && /Voix féminines/.test(await g.innerHTML('table.t')), null);
  await A.p.screenshot({ path: OUT + '/simulateur-offres.png' });
  await g.click('[data-do="o-creer"]'); await wait(30);
  check('an offer needs a source', /Ajoutez une adresse, collez un texte ou joignez au moins un PDF/.test(await g.textContent('#view')), null);
  await g.fill('[data-f="url"]', 'pas une adresse'); await g.click('[data-do="o-creer"]'); await wait(30);
  check('an invalid address is refused', /Adresse invalide/.test(await g.textContent('#view')), null);
  await g.fill('[data-f="url"]', ''); await g.fill('[data-f="text"]', 'Formation de six mois pour changer de métier, 2 400 €.'); await g.click('[data-do="o-creer"]');
  await g.waitForFunction(() => /Lecture des sources…/.test(document.body.innerText), null, { timeout: 4000 });
  const ac = () => A.p.evaluate(() => window.__calls);
  check('POST offres with the text, then followed while it prepares', (await ac()).some(c => c.path === 'offres' && c.m === 'POST' && /six mois/.test(c.body.text)), null);
  await g.click('.oi >> text=Formation exemple'); await g.waitForSelector('[data-do="p-fiche"]');
  await g.click('[data-do="p-fiche"] >> nth=0'); await g.waitForSelector('.modal.wide');
  t = await g.textContent('.modal.wide');
  check('the prospect sheet, in French', /Fiche de Nadia/.test(t) && /Histoire personnelle/.test(t) && /Conscient des solutions/.test(t) && !/SOLUTION AWARE/.test(t), null);
  await A.p.screenshot({ path: OUT + '/simulateur-fiche.png' });
  await g.press('.modal.wide', 'Escape'); await wait(30);
  await g.selectOption('[data-pvoix="paul-2"]', 'v-h2'); await wait(200);
  check('the voice of a prospect: PATCH personas/:id', (await ac()).some(c => c.m === 'PATCH' && c.path === 'personas/paul-2' && c.body.voice_id === 'v-h2'), null);
  await g.click('[data-do="p-suppr"][data-v="paul-2"]'); await g.waitForSelector('[role="alertdialog"]');
  check('deleting a prospect asks first', /Supprimer ce prospect \?/.test(await g.textContent('[role="alertdialog"]')), null);
  await g.click('[data-x="no"]'); await wait(30);
  check('« Annuler » deletes nothing', !(await ac()).some(c => c.m === 'DELETE' && /^personas/.test(c.path)), null);
  await g.click('[data-do="p-suppr"][data-v="paul-2"]'); await g.click('[data-x="yes"]'); await wait(300);
  check('confirmed: DELETE personas/:id', (await ac()).some(c => c.m === 'DELETE' && c.path === 'personas/paul-2') && (await g.$$('table.t tbody tr')).length === 1, null);
  await g.click('[data-do="o-gen"]'); await g.waitForSelector('[role="alertdialog"]');
  check('regenerating asks first', /Régénérer les prospects \?/.test(await g.textContent('[role="alertdialog"]')), null);
  await g.click('[data-x="no"]');
  await g.click('[data-do="o-suppr"]'); await g.waitForSelector('[role="alertdialog"]');
  check('deleting an offer asks first', /Supprimer cette offre \?/.test(await g.textContent('[role="alertdialog"]')), null);
  await g.click('[data-x="no"]');
  // settings
  await g.click('[data-go="#reglages"]'); await g.waitForSelector('[data-r="claude_model"]');
  t = await visible(g, 'réglages');
  check('Réglages: the three models, voice, silence, daily limit', /Sonnet 5\.5 \(recommandé\)/.test(await g.innerHTML('[data-r="claude_model"]')) && /Haiku 5\.5 \(rapide\)/.test(await g.innerHTML('[data-r="claude_model"]')) && /Opus 5\.5/.test(await g.innerHTML('[data-r="claude_model"]')) &&
    /Temps de silence/.test(t) && /Plafond quotidien/.test(t) && await g.$eval('[data-do="r-save"]', e => e.disabled), null);
  await g.selectOption('[data-r="claude_model"]', 'claude-haiku-5-5'); await g.fill('[data-r="silence_timeout_ms"]', '1000');
  await A.p.screenshot({ path: OUT + '/simulateur-reglages.png' });
  await g.click('[data-do="r-save"]'); await wait(300);
  check('saved: PUT config', (await ac()).some(c => c.path === 'config' && c.m === 'PUT' && c.body.claude_model === 'claude-haiku-5-5' && c.body.silence_timeout_ms === 1000) && /Réglages enregistrés/.test(await g.textContent('#toasts')), null);
  await g.click('[data-go="#historique"]'); await g.waitForSelector('.hr');
  t = await visible(g, 'historique admin');
  check('admin history: the whole team, a person filter', (await g.$$('.hr')).length === 3 && !!(await g.$('[data-hf="personne"]')) && /Lucie Bernard/.test(t), null);
  await g.selectOption('[data-hf="personne"]', 'u2'); await g.waitForFunction(() => document.querySelectorAll('.hr').length === 1);
  check('filtered by person (crm_sim_history p_user)', /Sans analyse/.test(await g.textContent('.hl')), null);
  await g.click('.hr [data-go="#resultat/43"]'); await g.waitForSelector('.empty');
  check('a rejected analysis: its French reason', /Le mode Objections n’est pas analysé/.test(await g.textContent('#view')), null);
  await A.ctx.close();

  // ---------------------------------------------------------------- outside LNP: the demo
  const d = await b.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  d.on('pageerror', e => errs.push(e.message));
  await d.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await d.goto('file://' + FILE); await d.waitForSelector('.pc');
  t = await d.evaluate(() => document.body.innerText); texts.push(['démo', t]);
  check('outside LNP: the message and two sample prospects, launch closed', /Le simulateur fonctionne dans LNP en ligne\./.test(t) && (await d.$$('.pc')).length === 2 && await d.$eval('[data-do="lancer"]', e => e.disabled), null);
  await d.screenshot({ path: OUT + '/simulateur-demo.png' });
  await d.close();

  const english = texts.filter(([, x]) => /closer|closing|discovery|loading/i.test(x)).map(([k, x]) => k + ': ' + (x.match(/.{0,30}(closer|closing|discovery|loading).{0,30}/i) || [])[0]);
  check('no English word on screen (closer, closing, Discovery, Loading)', english.length === 0, english);
  check('no console error', errs.length === 0, errs);
  ok.forEach(x => console.log('OK  ' + x)); bad.forEach(x => console.log('BAD ' + x));
  console.log(ok.length + ' checks passed, ' + bad.length + ' failed');
  await b.close(); process.exit(bad.length ? 1 : 0);
})();
