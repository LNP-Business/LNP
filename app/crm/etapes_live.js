// node app/crm/etapes_live.js $PWD/app/lnp.html <dossier> — les étapes du lead (LNP_ETAPES, Romain 2026-11-11) : une seule liste
// dans Prospects (colonne Progrès, Répartition par étape, filtre), dans la fiche du lead et dans Cycle de vente, avec la ligne
// principale et les deux branches « Rattrapage » (absence, silence) et « Relance après refus ». Cycles simulés, comme setting_live.js.
const { chromium } = require('playwright');
const FILE = 'file://' + process.argv[2], OUT = process.argv[3];
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1500, height: 1000 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto(FILE + '#crm'); await p.waitForTimeout(2500);
  let cf = null; for (const f of p.frames()) { try { if (await f.$('#v-crm')) { cf = f; break; } } catch (e) {} }
  const ok = [], bad = []; const check = (n, c, i) => (c ? ok : bad).push(n + (c ? '' : ' → ' + JSON.stringify(i)));
  await cf.evaluate(async () => {
    const H = 3600e3, iso = (h) => new Date(Date.now() + h * H).toISOString();
    const cyc = (id, name, o, calls, events, extra) => Object.assign({ id, status: 'active', opened_at: iso(o), owner_id: 'u-r', last_event_at: iso(-1),
      person: { id: 'p' + id, full_name: name, primary_email: id + '@x.com', first_seen_at: iso(o) }, calls, events, deal: null, payments: [] }, extra || {});
    const ev = (type, h, x) => Object.assign({ type, occurred_at: iso(h), source: 'crm', actor: 'sales', data: {} }, x || {});
    const board = [
      cyc('c1', 'Paul Payé', -100, [{ id: 'k1', rank: 1, status: 'held', scheduled_start: iso(-80), scheduled_end: iso(-79) }],
        [ev('call_booked', -100, { call_id: 'k1', source: 'iclosed', actor: 'prospect' }), ev('message_out', -99), ev('outcome_yes', -79, { call_id: 'k1', data: { amount_sold: 3400 } }),
         ev('payment_succeeded', -70, { actor: 'prospect', data: { amount: 850 } })]),
      cyc('c2', 'Nora Absente', -40, [{ id: 'k2', rank: 1, status: 'no_show', scheduled_start: iso(-20), scheduled_end: iso(-19) }],
        [ev('call_booked', -40, { call_id: 'k2', source: 'iclosed', actor: 'prospect' }), ev('message_out', -39), ev('message_in', -38, { actor: 'prospect' }), ev('message_out', -18)]),
      cyc('c3', 'Rémi Refus', -60, [{ id: 'k3', rank: 1, status: 'held', scheduled_start: iso(-40), scheduled_end: iso(-39) }],
        [ev('call_booked', -60, { call_id: 'k3', source: 'iclosed', actor: 'prospect' }), ev('message_out', -59),
         ev('outcome_no', -39, { call_id: 'k3', data: { reason_code: 'price' } })]),
      cyc('c4', 'Dina Disq', -60, [{ id: 'k4', rank: 1, status: 'held', scheduled_start: iso(-40), scheduled_end: iso(-39) }],
        [ev('call_booked', -60, { call_id: 'k4', source: 'iclosed', actor: 'prospect' }), ev('outcome_disqualified', -39, { call_id: 'k4', data: { reason_code: 'off_target' } })]),
      cyc('c5', 'Céline Confirmée', -10, [{ id: 'k5', rank: 1, status: 'scheduled', scheduled_start: iso(20), scheduled_end: iso(21) }],
        [ev('call_booked', -10, { call_id: 'k5', source: 'iclosed', actor: 'prospect' }), ev('message_out', -9.5)])
    ];
    const fake = {
      listMembers: async () => [{ id: 'u-r', member_key: 'romain', full_name: 'Romain', role: 'admin', active: true }],
      listNoBooking: async () => [], me: async () => ({ id: 'u-r', member_key: 'romain', role: 'admin' }),
      salesCycleView: window.parent.LNP_CRM.salesCycleView, reasonLabel: window.parent.LNP_CRM.reasonLabel,
      listBoard: async () => board, listReasons: async () => [], addNote: async () => 1, subscribe: () => () => {},
      setterAction: async () => ({}), setSetter: async () => null, createLead: async () => 'new'
    };
    await window.lnpCrmLive(fake);
  });
  await p.waitForTimeout(800);
  const prog = await cf.$$eval('.cx-tbl tbody tr', rs => rs.map(r => ({ n: (r.querySelector('.cx-pn') || {}).textContent, p: (r.querySelector('.lp-prog') || {}).textContent || '',
    br: !!r.querySelector('.lp-prog.br') })));
  const P = (n) => (prog.find(x => x.n && x.n.includes(n)) || {});
  check('Progrès · Paul payé, R1 sauté (facultatif) : « payé »', /payé/.test(P('Paul').p), prog);
  check('Progrès · Céline : 3/6, le R1 facultatif sauté ne compte pas', /3\/6/.test(P('Céline').p), prog);
  check('Progrès · Nora absente : branche Rattrapage', P('Nora').br && /Rattrapage/.test(P('Nora').p), P('Nora'));
  check('Progrès · Rémi : branche Relance après refus', P('Rémi').br && /Relance après refus/.test(P('Rémi').p), P('Rémi'));
  check('Progrès · Dina : disqualifiée, sans branche', !P('Dina').br && /disqualifié/.test(P('Dina').p), P('Dina'));
  const leg = await cf.$$eval('.lp-lg', a => a.map(x => x.textContent.replace(/\s+/g, ' ').trim()));
  check('Répartition par étape : les étapes partagées (Rattrapage, Relance après refus, Payé, Disqualifié, Appel honoré)',
    ['Rattrapage', 'Relance après refus', 'Payé', 'Disqualifié', 'Appel honoré'].every(w => leg.some(x => x.startsWith(w))), leg);
  check('Répartition : plus de colonnes du pipeline (R1, R2, Absent, Relance longue)', !leg.some(x => /^(R1|R2|R3|Absent|Relance longue|Nouveau)\b/.test(x)), leg);
  await cf.click('.lp-lg[data-lpstage="ratt"]'); await p.waitForTimeout(300);
  const only = await cf.$$eval('.cx-tbl tbody tr .cx-pn', a => a.map(x => x.textContent));
  check('un clic sur « Rattrapage » filtre le tableau', only.length === 1 && /Nora/.test(only[0]), only);
  await cf.click('.lp-clr'); await p.waitForTimeout(200);
  await p.screenshot({ path: OUT + '/etapes-prospects.png' });
  // la fiche du lead
  await cf.evaluate(() => openLead('c3')); await p.waitForTimeout(500);
  const fiche = await cf.$eval('.et', e => e.innerText).catch(() => '');
  const head = await cf.$eval('.cx-stc', e => e.textContent).catch(() => '');
  check('fiche : la liste des étapes, ligne principale et branche', /Ligne principale/.test(fiche) && /RDV pris/.test(fiche) && /Payé/.test(fiche) && /Relance après refus/.test(fiche) && /Objection notée/.test(fiche), fiche);
  check('fiche : l’en-tête dit l’étape actuelle', /Relance après refus/.test(head), head);
  await p.screenshot({ path: OUT + '/etapes-fiche.png' });
  await cf.evaluate(() => closeLayer()); await p.waitForTimeout(200);
  // Cycle de vente: the same list in the lead, and the « Étape » filter
  const sf = p.frames().find(f => { try { return /CRM Cycle de vente/.test(f.name()) || false; } catch (e) { return false; } });
  await cf.evaluate(() => { const b = [...document.querySelectorAll('[data-act="cxtab"]')].find(x => /Cycle de vente/.test(x.textContent)); if (b) b.click(); });
  await p.waitForTimeout(1500);
  let scv = null; for (const f of p.frames()) { try { if (await f.$('#list') && await f.$('#fp')) { scv = f; } } catch (e) {} }
  check('Cycle de vente ouvert', !!scv, p.frames().map(f => f.url().slice(0, 40)));
  if (scv) {
    await scv.evaluate(() => { S.showClosed = true; S.b = ''; render(); S.sel = 'c3'; render(); });
    await p.waitForTimeout(500);
    const det = await scv.$eval('.et', e => e.innerText).catch(() => '');
    check('Cycle de vente : la même liste d’étapes dans la fiche', /Ligne principale/.test(det) && /Relance après refus/.test(det) && /Appel honoré \(R2\)/.test(det), det);
    const opts = await scv.$$eval('select[data-sel="stg"] option', a => a.map(o => o.textContent));
    check('Cycle de vente : le filtre « Étape » propose les étapes partagées', ['Rattrapage', 'Relance après refus', 'Confirmation de présence', 'Payé'].every(w => opts.includes(w)), opts);
    await p.screenshot({ path: OUT + '/etapes-cycle.png' });
  }
  check('aucune erreur dans la console', errs.length === 0, errs);
  ok.forEach(x => console.log('OK  ' + x)); bad.forEach(x => console.log('BAD ' + x));
  console.log(ok.length + ' contrôles réussis, ' + bad.length + ' en échec');
  await b.close(); process.exit(bad.length ? 1 : 0);
})();
