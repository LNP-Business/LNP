// node app/training/results_test.js $PWD/app/lnp.html <screenshot dir> — Entraînement (Romain 2026-11-06): every
// exercise kept on the account (results_log.js), « Mes résultats » and « Suivi des commerciaux » (resultats.html). The training
// documents are taken from the built page and run in frames under a test page that plays the web edition (window.claude, a
// fake account in memory: crm_training_results, crm_training_dashboard).
const { chromium } = require('playwright');
const fs = require('fs');
const HTML = fs.readFileSync(process.argv[2], 'utf8'), OUT = process.argv[3];
function doc(name) { const m = new RegExp('window\\.' + name + ' = ("(?:[^"\\\\]|\\\\.)*");').exec(HTML); if (!m) throw new Error(name); return JSON.parse(m[1].replace(/<\\\//g, '</')); }
const DOCS = { training: doc('LNP_TRAINING_DOC'), academie: doc('LNP_ACADEMIE_DOC'), resultats: doc('LNP_RESULTATS_DOC'), suivi: doc('LNP_SUIVI_DOC') };

// the web edition, played in memory: the same rules as migration 049 (own rows, append only, score of the three parts)
const HOST = `<!doctype html><html lang="fr"><head><meta charset="utf-8"></head><body style="margin:0">
<script>
window.DB = { rows: [], seq: 0, uid: "u1", fail: false, admin: true, calls: [], people: { u1: "Valentino Test", u2: "Camille Test" } };
(function () {
  function q(table) {
    var f = [], ord = null, rng = null, single = false;
    var api = {
      select: function () { return api; }, eq: function (k, v) { f.push(function (r) { return r[k] === v; }); return api; },
      gte: function (k, v) { f.push(function (r) { return r[k] >= v; }); return api; }, order: function (k, o) { ord = ord || [k, o && o.ascending === false ? -1 : 1]; return api; },
      range: function (a, b) { rng = [a, b]; return api; }, maybeSingle: function () { single = true; return api; },
      upsert: function () { return Promise.resolve({ error: null }); },
      insert: function (row) {
        if (DB.fail) return Promise.reject(new Error("réseau"));
        if (table !== "crm_training_results") return Promise.resolve({ error: null });
        if (row.mode === "claude") return Promise.resolve({ error: { code: "42501" } });
        if (DB.rows.some(function (r) { return r.user_id === DB.uid && r.cid === row.cid; })) return Promise.resolve({ error: { code: "23505" } });
        DB.rows.push(Object.assign({ id: ++DB.seq, user_id: DB.uid, created_at: new Date().toISOString() }, row)); return Promise.resolve({ error: null });
      },
      then: function (ok, ko) {
        var d = table === "crm_training_results" ? DB.rows.filter(function (r) { return DB.admin || r.user_id === DB.uid; }) : [];
        d = d.filter(function (r) { return f.every(function (g) { return g(r); }); });
        if (ord) d.sort(function (a, b) { return (a[ord[0]] < b[ord[0]] ? -1 : a[ord[0]] > b[ord[0]] ? 1 : b.id - a.id) * ord[1]; });
        if (rng) d = d.slice(rng[0], rng[1] + 1);
        return Promise.resolve({ data: single ? null : d, error: null }).then(ok, ko);
      }
    };
    return api;
  }
  function person(id, from) {
    var r = DB.rows.filter(function (x) { return x.user_id === id; }), last = function (m, k) { return r.filter(function (x) { return x.module === m; }).slice(-k); };
    var sum = function (a) { return a.reduce(function (s, x) { return s + Number(x.score); }, 0); }, best = {};
    r.filter(function (x) { return x.module === "academie"; }).forEach(function (x) { best[x.case_id] = Math.max(best[x.case_id] || 0, Number(x.score)); });
    var ac = Object.keys(best).reduce(function (s, k) { return s + best[k]; }, 0), c = sum(last("coup", 50)), l = sum(last("lettre", 20));
    var per = r.filter(function (x) { return x.created_at >= from; }), mods = {};
    per.forEach(function (x) { var m = mods[x.module] || (mods[x.module] = { n: 0, time_s: 0, s: 0 }); m.n++; m.time_s += x.duration_s; m.s += x.score / x.max; });
    Object.keys(mods).forEach(function (k) { mods[k].ok = Math.round(100 * mods[k].s / mods[k].n); });
    return { id: id, name: DB.people[id], role: id === "u1" ? "admin" : "sales", active: true, me: id === DB.uid,
      score: Math.round(100 * (c / 50 + l / 60 + ac / 1000) / 3), parts: { coup: Math.round(2 * c), lettre: Math.round(100 * l / 60), academie: Math.round(ac / 10) },
      academie: { validated: Object.keys(best).filter(function (k) { return best[k] >= 8; }).length, tried: Object.keys(best).length },
      period: { n: per.length, time_s: per.reduce(function (s, x) { return s + x.duration_s; }, 0), modules: mods, last_at: per.length ? per[per.length - 1].created_at : null },
      total: { n: r.length, time_s: r.reduce(function (s, x) { return s + x.duration_s; }, 0), first_at: r.length ? r[0].created_at : null, last_at: r.length ? r[r.length - 1].created_at : null },
      sales: id === "u2" ? { calls: 12, r1_held: 8, won: 3, signed: 9600, collected: 4200, cash: 4200 } : { calls: 0, r1_held: 0, won: 0, signed: 0, collected: 0, cash: 0 } };
  }
  var CRM = {
    from: q, me: function () { return Promise.resolve({ role: DB.admin ? "admin" : "sales" }); }, token: function () { return Promise.resolve("jeton"); },
    rpc: function (fn, a) {
      DB.calls.push(fn);
      var from = a.p_days ? new Date(Date.now() - a.p_days * 864e5).toISOString() : "";
      var ids = DB.admin ? Object.keys(DB.people) : [DB.uid];
      return Promise.resolve({ generated_at: new Date().toISOString(), days: a.p_days, admin: DB.admin, people: ids.map(function (id) { return person(id, from); }) });
    }
  };
  window.claude = { web: true, use: function (n) { return Promise.resolve(n === "crm" ? CRM : n === "user" ? { id: function () { return Promise.resolve(DB.uid); } } : null); } };
})();
function mount(key, srcdoc) { var f = document.createElement("iframe"); f.id = key; f.style.cssText = "border:0;width:1144px;height:800px;display:block"; f.srcdoc = srcdoc; document.body.appendChild(f); }
</script></body></html>`;

(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1180, height: 860 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/fonts\.g|ERR_|Failed to load resource/.test(m.text())) errs.push(m.text()); });
  const ok = [], bad = []; const check = (n, c, i) => (c ? ok : bad).push(n + (c ? '' : ' → ' + JSON.stringify(i)));
  await p.route('http://lnp.test/**', async (r) => {
    const u = r.request().url();
    if (/fonts\.g/.test(u)) return r.abort();
    return r.fulfill({ status: 200, contentType: 'text/html', body: HOST });
  });
  await p.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await p.goto('http://lnp.test/');
  const frame = async (key) => { await p.evaluate(([k, d]) => mount(k, d), [key, DOCS[key]]); await p.waitForTimeout(900); return (await p.$('#' + key)).contentFrame(); };
  const DB = () => p.evaluate(() => JSON.parse(JSON.stringify(window.DB)));

  // Découverte: one coup played to its verdict is kept on the account
  const tf = await frame('training');
  const c0 = await tf.evaluate(() => LNP_TRAINING.C.cases[0]);
  await tf.click(`[data-geste="${c0.att}"]`); await tf.click('[data-do="valider"]');
  await tf.fill('#qC', c0.ok); await tf.click('[data-do="comparer"]');
  await tf.click('[data-j="j1:1"]'); await tf.click('[data-j="j2:1"]'); await tf.click('[data-do="suivant"]'); await p.waitForTimeout(400);
  let db = await DB();
  const r0 = db.rows[0] || {};
  check('a coup is kept on the account', db.rows.length === 1 && r0.module === 'coup' && r0.case_id === String(c0.n) && r0.score === 1 && r0.max === 1 && r0.mode === 'regles', db.rows);
  check('with its question and its active time', r0.details && r0.details.question === c0.ok && r0.details.attendu === c0.att && Number.isInteger(r0.duration_s) && r0.duration_s >= 0, r0);
  check('the top bar says it is on the account', /Résultats enregistrés sur ton compte/.test(await tf.textContent('#sync')), await tf.textContent('#sync'));
  // offline: kept on the device, sent once the account answers again, never twice
  await p.evaluate(() => { window.DB.fail = true; });
  const c1 = await tf.evaluate(() => LNP_TRAINING.C.cases[1]);
  await tf.click(`[data-geste="${c1.att}"]`); await tf.click('[data-do="valider"]'); await tf.click('[data-do="etalon"]'); await tf.click('[data-do="suivant"]'); await p.waitForTimeout(400);
  check('offline: « Compte injoignable », kept on this device', /Compte injoignable : 1 résultat gardé sur cet appareil/.test(await tf.textContent('#sync')) && (await tf.evaluate(() => JSON.parse(localStorage.getItem('lnp-entrainement-a-envoyer')).length)) === 1, await tf.textContent('#sync'));
  await p.evaluate(() => { window.DB.fail = false; }); await tf.evaluate(() => LNP_RESULTS.flush()); await p.waitForTimeout(400);
  db = await DB();
  check('sent once the account answers', db.rows.length === 2 && db.rows[1].score === 0 && /Résultats enregistrés/.test(await tf.textContent('#sync')), db.rows.length);
  // active time: nothing counts after two minutes without a click, a key or a move
  const idle = await tf.evaluate(() => { const m = LNP_RESULTS.mark(); return new Promise(res => setTimeout(() => res(LNP_RESULTS.since(m)), 2300)); });
  check('active time counts while the person works', idle >= 1 && idle <= 3, idle);

  // Maîtrise de l'offre: the answer validated, then self-corrected, is kept (mode auto)
  const af = await frame('academie');
  await af.evaluate(() => LNP_ACADEMIE.go(0));
  await af.fill('#ta', 'Le seuil de la garantie, c’est ce que tu as investi, et on le regarde ensemble au bout des 4 mois.');
  await af.click('[data-do="validate"]');
  const nCrit = (await af.$$('[data-chk]:not([data-chk="elim"])')).length;
  for (let k = 0; k < nCrit; k++) await af.click(`[data-chk="${k}"]`);
  await af.click('[data-do="saveself"]'); await p.waitForTimeout(400);
  db = await DB();
  const ra = db.rows[2] || {};
  check('a self-evaluation is kept (mode auto, its marks and the answer)', db.rows.length === 3 && ra.module === 'academie' && ra.case_id === 'A1' && ra.mode === 'auto' && ra.score === 10 && Array.isArray(ra.details.criteres) && /seuil/.test(ra.details.reponse), ra);
  check('no correction by Claude', !(await af.$('[data-do="claude"]')), null);
  // a second attempt (A2) and a rep's lettre, as the account would hold them
  await p.evaluate(() => { window.DB.rows.push({ id: ++window.DB.seq, user_id: 'u1', cid: 'u1-a2', module: 'academie', case_id: 'A2', score: 7.5, max: 10, mode: 'auto', duration_s: 95, details: { format: 'A', criteres: [2, 2, 1.5, 2], eliminatoire: false, reponse: 'Ma réponse' }, created_at: new Date().toISOString() });
    window.DB.rows.push({ id: ++window.DB.seq, user_id: 'u2', cid: 'u2-1', module: 'lettre', case_id: '3', score: 2, max: 3, mode: 'regles', duration_s: 300, details: { liens: [{ valide: true, question: 'Ça te coûte combien ?', fautes: [] }, { valide: true, question: 'Et ensuite ?', fautes: [] }, { valide: false, question: '', fautes: [] }] }, created_at: new Date().toISOString() }); });

  // Mes résultats: the score, the figures of the period, the history (never deleted), the detail of a row
  const rf = await frame('resultats');
  await p.waitForTimeout(300);
  const t = (s) => rf.$eval(s, e => e.innerText).then(x => x.replace(/\s+/g, ' ').trim());
  check('the title', (await t('#ttl')) === 'Mes résultats', await t('#ttl'));
  check('the score out of 100 and its three parts', /Ton score d’entraînement/i.test(await t('.tiles')) && /Le coup suivant/.test(await t('.parts')) && /La lettre imposée/.test(await t('.parts')) && /Maîtrise de l’offre/.test(await t('.parts')), await t('.tiles'));
  const exp = Math.round(100 * (1 / 50 + 0 + 17.5 / 1000) / 3);
  check('the score is the dashboard’s', (await t('[data-score]')) === exp + ' / 100', await t('[data-score]'));
  check('exercises of the period', /Exercices faits 4 sur 30 jours/i.test(await t('.tiles')), await t('.tiles'));
  check('one validated case of Maîtrise de l’offre', /Maîtrise de l’offre 1 \/ 100 cas validés/i.test(await t('.tiles')), await t('.tiles'));
  const hist = await rf.$$eval('table.hist tbody tr.row', a => a.map(x => x.innerText.replace(/\s+/g, ' ')));
  check('the history lists my four exercises, newest first, not the others’', hist.length === 4 && /Maîtrise de l’offre A2/.test(hist[0]) && /Le coup suivant/.test(hist[3]), hist);
  check('the history says it cannot be deleted', /ne peut pas être effacé/.test(await t('[aria-label="Ton historique"]')), null);
  check('no delete button anywhere', !(await rf.$('button:has-text("Supprimer"), button:has-text("Effacer")')), null);
  await rf.click('table.hist tbody tr.row >> nth=3'); await p.waitForTimeout(100);
  check('a row opens its detail (the question written)', (await t('tr.det')).includes(c0.ok), await t('tr.det'));
  const ov = await rf.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check('no horizontal scroll', ov <= 0, ov);
  await p.screenshot({ path: OUT + '/mes-resultats.png', fullPage: false, clip: await p.$eval('#resultats', e => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; }) });
  await rf.click('#per [data-d="7"]'); await p.waitForTimeout(300);
  check('the period: 7 days', (await rf.getAttribute('#per [data-d="7"]', 'aria-pressed')) === 'true' && /sur 7 jours/i.test(await t('.tiles')), null);
  const txt = await rf.evaluate(() => document.body.innerText);
  check('no « undefined », « NaN » nor « null » on the screen', !/undefined|NaN|\bnull\b/.test(txt), txt.slice(0, 200));

  // Suivi des commerciaux (admins): one row per person, training and sales, sort, a person's detail
  const sf = await frame('suivi');
  await p.waitForTimeout(300);
  const st = (s) => sf.$eval(s, e => e.innerText).then(x => x.replace(/\s+/g, ' ').trim());
  check('the title', (await st('#ttl')) === 'Suivi des commerciaux', null);
  const rows = await sf.$$eval('table.team tbody tr.row', a => a.map(x => x.innerText.replace(/\s+/g, ' ')));
  check('one row per person', rows.length === 2, rows);
  const cam = rows.find(x => /Camille Test/.test(x)) || '';
  check('the sales: calls held, sales, signed, collected, revenue per call', /12/.test(cam) && /9 600 €/.test(cam) && /4 200 €/.test(cam) && /800 €/.test(cam), cam);
  check('the training of the period: exercises and time', /Camille Test.*Commercial/.test(cam) && /5 min/.test(cam), cam);
  check('columns: Entraînement and Ventes', /Entraînement/i.test(await st('table.team thead')) && /Ventes/i.test(await st('table.team thead')) && /CA signé/i.test(await st('table.team thead')) && /Encaissé/i.test(await st('table.team thead')), await st('table.team thead'));
  await sf.click('th button[data-sort="signed"]'); await p.waitForTimeout(100);
  check('sort by CA signé, highest first', /Camille/.test(await st('table.team tbody tr.row >> nth=0')), null);
  await sf.click('table.team tbody tr.row:has-text("Camille Test")'); await p.waitForTimeout(400);
  check('a person: their score and their history', /Score de Camille Test/i.test(await st('.wrap')) && /Historique de Camille Test/i.test(await st('.wrap')) && (await sf.$$('table.hist tbody tr.row')).length === 1, await st('.wrap'));
  const ov2 = await sf.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check('no horizontal scroll (1 144 px)', ov2 <= 0, ov2);
  await p.screenshot({ path: OUT + '/suivi.png', clip: await p.$eval('#suivi', e => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; }) });
  // a sales rep never sees the team
  await p.evaluate(() => { window.DB.admin = false; window.DB.uid = 'u2'; });
  await sf.evaluate(() => LNP_RESULTATS.load()); await p.waitForTimeout(300);
  check('a sales rep: « réservé aux administrateurs »', /réservé aux administrateurs/.test(await st('#main')), await st('#main'));
  // a new result refreshes Mes résultats
  const before = (await DB()).calls.length;
  await p.evaluate(() => window.dispatchEvent(new CustomEvent('lnp-training-result'))); await p.waitForTimeout(1300);
  check('a new result refreshes the figures', (await DB()).calls.length > before, null);

  check('no console error', errs.length === 0, errs);
  ok.forEach(x => console.log('OK  ' + x)); bad.forEach(x => console.log('BAD ' + x));
  console.log(ok.length + ' checks passed, ' + bad.length + ' failed');
  await b.close(); process.exit(bad.length ? 1 : 0);
})();
