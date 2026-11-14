// node app/crm/cycle_fiche_live.js $PWD/app/lnp.html <dossier> — Cycle de vente (Romain 2026-11-14) : à droite, la fiche du lead,
// la même que dans Leads (renderLead2 : Où il en est, appels et transcriptions, cycle de vente en bulles), posée par le CRM à la place
// que réserve le bureau ; la barre « À faire » du bureau en dessous ; les touches du bureau marchent depuis la fiche ; la fiche s'en va
// quand on revient à Leads. Cycles simulés, comme etapes_live.js.
const { chromium } = require('playwright');
const FILE = 'file://' + process.argv[2], OUT = process.argv[3];
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: +(process.argv[4] || 1440), height: 900 } });
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
        [ev('call_booked', -10, { call_id: 'k5', source: 'iclosed', actor: 'prospect' }), ev('message_out', -9.5)]),
      // a refusal 190 days ago with no new RDV: out of « Relance après refus », disqualified (055)
      cyc('c6', 'Simon Six Mois', -4600, [{ id: 'k6', rank: 1, status: 'held', scheduled_start: iso(-4580), scheduled_end: iso(-4579) }],
        [ev('call_booked', -4600, { call_id: 'k6', source: 'iclosed', actor: 'prospect' }), ev('outcome_no', -4560, { call_id: 'k6', data: { reason_code: 'price' } })]),
      // lost without any call held (an old import never reached): « Perdu », not a refusal, no branch
      cyc('c7', 'Pierre Perdu', -900, [], [ev('call_booked', -900, { source: 'import', actor: 'prospect' }), ev('cycle_lost', -800, { source: 'import', data: { reason: 'timing' } })], { status: 'lost' })
    ];
    const fake = {
      listMembers: async () => [{ id: 'u-r', member_key: 'romain', full_name: 'Romain', role: 'admin', active: true }],
      listNoBooking: async () => [], me: async () => ({ id: 'u-r', member_key: 'romain', role: 'admin' }),
      salesCycleView: window.parent.LNP_CRM.salesCycleView, reasonLabel: window.parent.LNP_CRM.reasonLabel,
      listBoard: async () => board, listReasons: async () => [], addNote: async () => 1, subscribe: () => () => {},
      setterAction: async () => ({}), setSetter: async () => null, createLead: async () => 'new',
      caBoard: async () => [{ cycle_id: 'c1', call_id: 'k1', round: 1, start: iso(-80), status: 'done', job: 'j1', scores: {} }, { cycle_id: 'c2', call_id: 'k2', round: 1, start: iso(-20), status: 'done', job: 'j2', scores: {} }],
      caRecord: async () => ({ turns: [{ role: 'SALES', speaker: 'Romain', ts: '00:00:04', text: 'Bonjour Paul, merci d’être là. On a 45 minutes ensemble : je vous propose de commencer par votre situation.' }, { role: 'PROSPECT', speaker: 'Paul', ts: '00:00:15', text: 'Avec plaisir. Je suis prof de maths au lycée depuis 12 ans, et j’ai envie de développer les cours particuliers.' }, { role: 'SALES', speaker: 'Romain', ts: '00:00:31', text: 'Qu’est-ce qui fait que vous cherchez maintenant ?' }, { role: 'PROSPECT', speaker: 'Paul', ts: '00:00:38', text: 'Je suis épuisé par la charge de travail, et je voudrais 2 000 € de plus par mois.' }] })
    };
    await window.lnpCrmLive(fake);
  });
  await p.waitForTimeout(900);
  await cf.evaluate(() => { S.cx.tab = 'cycle'; renderCRM(); }); await p.waitForTimeout(2000);
  let dk = null; for (const f of p.frames()) { try { if (f.parentFrame() === cf && await f.$('#qs')) { dk = f; break; } } catch (e) {} }
  check('le bureau Cycle de vente est ouvert', !!dk, null);
  if (!dk) { console.log(bad.join('\n')); await b.close(); process.exit(1); }
  const fiche = () => cf.evaluate(() => { const d = document.querySelector('#layer .lr-dock'); if (!d) return null; const r = d.getBoundingClientRect();
    return { name: (d.querySelector('#lT') || {}).textContent, x: r.left, y: r.top, w: r.width, h: r.height, where: !!d.querySelector('.lr-where'), calls: !!d.querySelector('.lr-calls'),
      bulles: d.querySelectorAll('#lrChat .ch-row, #lrChat [class^="ch-b"]').length, todo: getComputedStyle(d.querySelector('.lr-todo') || d).display, scrim: !!document.querySelector('#layer .scrim') }; });
  const sel = () => dk.evaluate(() => { const r = document.querySelector('.row[aria-selected="true"]'); return r ? { id: r.dataset.id, name: r.innerText.split('\n')[0] } : null; });
  const place = () => dk.evaluate(() => { const d = document.getElementById('dock'); if (!d) return null; const r = d.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
  let f = await fiche(), s = await sel(), pl = await place();
  check('à droite, la fiche du lead sélectionné (la même que dans Leads)', f && s && f.name === s.name && f.where && f.calls, { f, s });
  check('la fiche occupe la place réservée par le bureau, sans fond grisé', f && pl && Math.abs(f.x - pl.x) < 2 && Math.abs(f.y - pl.y) < 2 && Math.abs(f.w - pl.w) < 2 && Math.abs(f.h - pl.h) < 2 && !f.scrim, { f, pl });
  check('la chronologie en bulles est dans la fiche', f && f.bulles > 0, f);
  check('la barre « À faire » du bureau est sous la fiche, celle de la fiche est cachée', await dk.evaluate(() => { const t = document.querySelector('#det .todo2'), d = document.getElementById('dock'); return !!t && t.getBoundingClientRect().top >= d.getBoundingClientRect().bottom - 1 && !!document.querySelector('[data-do="snooze"]'); }) && f.todo === 'none', f);
  await p.screenshot({ path: OUT + '/cycle-fiche.png' });
  // un autre lead : la fiche suit
  await dk.click('.qc[data-b="all"]'); await p.waitForTimeout(400);
  const s0 = await sel(); await dk.evaluate(() => document.activeElement && document.activeElement.blur()); await dk.press('body', 'ArrowDown'); await p.waitForTimeout(500);
  s = await sel(); f = await fiche();
  check('la flèche bas ouvre le lead suivant et sa fiche', s && s0 && s.id !== s0.id && f && f.name === s.name, { s0, s, f });
  // une touche du bureau depuis la fiche
  await cf.click('#layer .lr-dock .lr-where'); await p.keyboard.press('p'); await p.waitForTimeout(500);
  const s2 = await sel(); f = await fiche();
  check('« P » appuyé dans la fiche passe au lead suivant', s2 && s2.id !== s.id && f && f.name === s2.name, { s, s2, f });
  // la transcription s'ouvre depuis la fiche
  for (let k = 0; k < 6 && !(await cf.$('#layer .lr-dock [data-lrtr]')); k++) { await dk.evaluate(() => document.activeElement && document.activeElement.blur()); await dk.press('body', 'ArrowDown'); await p.waitForTimeout(400); }
  const tr = await cf.$('#layer .lr-dock [data-lrtr]');
  if (tr) { await tr.click(); await p.waitForTimeout(700); }
  check('« Lire la transcription » s\'ouvre au-dessus de la fiche', !!tr && await cf.evaluate(() => { const t = document.querySelector('#layer2 .lr-trx'); return !!t && t.innerText.includes('Paul'); }), !!tr);
  await p.screenshot({ path: OUT + '/cycle-fiche-trx.png' });
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  check('Échap ferme la transcription, la fiche reste', !(await cf.$('#layer2 .lr-trx')) && !!(await fiche()), null);
  // retour à Leads : la fiche posée s'en va
  await cf.evaluate(() => { S.cx.tab = 'leads'; renderCRM(); }); await p.waitForTimeout(800);
  check('de retour dans Leads, la fiche posée s\'en va', !(await fiche()) && !(await cf.evaluate(() => document.getElementById('layer').innerHTML.trim())), null);
  check('aucune erreur dans la console', errs.length === 0, errs);
  console.log(ok.map(x => 'OK  ' + x).join('\n')); if (bad.length) console.log(bad.map(x => 'BAD ' + x).join('\n'));
  console.log(`${ok.length} contrôles réussis, ${bad.length} en échec`);
  await b.close(); process.exit(bad.length ? 1 : 0);
})();
