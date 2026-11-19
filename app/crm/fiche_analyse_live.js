// node app/crm/fiche_analyse_live.js $PWD/app/lnp.html <dossier> — le lien « Analyse » de la fiche d'un lead (Leads et Cycle de vente)
// ouvre l'analyse de l'appel (Découverte SPIN, Écart, Présentation de l'offre, Objections) dans une fenêtre au-dessus de la
// fiche (2026-11-19 : la fiche n'a plus d'onglet « Analyse », le lien ne faisait plus rien). Cycles et analyse simulés.
const { chromium } = require('playwright');
(async () => {
  const OUT = process.argv[3]; const ok = [], bad = []; const check = (n, c, i) => (c ? ok : bad).push(n + (c ? '' : ' → ' + JSON.stringify(i)));
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('file://' + process.argv[2] + '#crm'); await p.waitForTimeout(2500);
  let cf = null; for (const f of p.frames()) { try { if (await f.$('#v-crm')) { cf = f; break; } } catch (e) {} }
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
      caBoard: async () => [{ cycle_id: 'c1', call_id: 'k1', round: 1, start: iso(-80), status: 'done', job: 'j1', done_job: 'j1', transcript: true, scores: { SPIN: { score: 64, status: 'scored' }, GAP: { score: 50, status: 'scored', verdict: 'partial' }, PITCH: { score: 70, status: 'scored' }, OBJECTIONS: { score: 40, status: 'scored' } } }, { cycle_id: 'c2', call_id: 'k2', round: 1, start: iso(-20), status: 'done', job: 'j2', done_job: 'j2', transcript: true, scores: { SPIN: { score: 58, status: 'scored' } } }],
      caRecord: async () => ({ status: 'ok', flags: [], phases: {}, meta: { duration: '45:00' }, results: { SPIN: { competence: 'SPIN', status: 'scored', score: 64, items: [], details: {} }, GAP: { competence: 'GAP', status: 'scored', verdict: 'partial', score: 50, reasons: [] } }, turns: [{ role: 'SALES', speaker: 'Romain', ts: '00:00:04', text: 'Bonjour Paul, merci d’être là. On a 45 minutes ensemble : je vous propose de commencer par votre situation.' }, { role: 'PROSPECT', speaker: 'Paul', ts: '00:00:15', text: 'Avec plaisir. Je suis prof de maths au lycée depuis 12 ans, et j’ai envie de développer les cours particuliers.' }, { role: 'SALES', speaker: 'Romain', ts: '00:00:31', text: 'Qu’est-ce qui fait que vous cherchez maintenant ?' }, { role: 'PROSPECT', speaker: 'Paul', ts: '00:00:38', text: 'Je suis épuisé par la charge de travail, et je voudrais 2 000 € de plus par mois.' }] })
    };
    await window.lnpCrmLive(fake);
  });
  await p.waitForTimeout(1200);
  const win = () => cf.evaluate(() => { const w = document.querySelector('.ca-scrim'); if (!w) return null; const r = w.querySelector('.ca-dlg').getBoundingClientRect();
    const top = document.elementFromPoint(r.left + r.width / 2, r.top + 40); return { txt: w.innerText, z: +getComputedStyle(w).zIndex, onTop: !!(top && w.contains(top)) }; });
  // Leads › fiche › « Analyse »
  await cf.evaluate(() => openLead('c1')); await p.waitForTimeout(900);
  await cf.click('#layer .ls-calls [data-ca]'); await p.waitForTimeout(1200);
  let w = await win();
  check('Leads : « Analyse » ouvre la fenêtre de l’analyse', !!w, null);
  check('la fenêtre montre l’analyse : Découverte, Écart, Présentation de l’offre, Objections', w && /DÉCOUVERTE/i.test(w.txt) && /ÉCART/i.test(w.txt) && /PRÉSENTATION DE L.OFFRE/i.test(w.txt) && /OBJECTIONS/i.test(w.txt), w && w.txt.slice(0, 300));
  check('la fenêtre est au-dessus de la fiche', w && w.onTop, w && w.z);
  if (OUT) await p.screenshot({ path: OUT + '/fiche-analyse.png' });
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  check('Échap ferme la fenêtre, la fiche reste ouverte', !(await win()) && await cf.evaluate(() => !!document.querySelector('#layer .ls-calls')), null);
  // le lien de l'historique (bulle « R1 honoré · analyse et transcription »)
  const chatLink = await cf.$('#layer #lrChat [data-ca]');
  if (chatLink) { await chatLink.click(); await p.waitForTimeout(900); w = await win();
    check('historique : « analyse et transcription » ouvre aussi l’analyse', w && /DÉCOUVERTE/i.test(w.txt), w && w.txt.slice(0, 200));
    await p.keyboard.press('Escape'); await p.waitForTimeout(300); }
  // Cycle de vente : la fiche posée à droite de la file
  await p.click('nav >> text=Cycle de vente'); await p.waitForTimeout(2500);
  let dk = null; for (const f of p.frames()) { try { if (f.parentFrame() === cf && await f.$('#qs')) { dk = f; break; } } catch (e) {} }
  if (dk) { await dk.click('.qc[data-b="all"]').catch(() => {}); await p.waitForTimeout(300); await dk.click('.row[data-id="c2"]').catch(() => {}); await p.waitForTimeout(1200); }
  const dockBtn = await cf.$('#layer .lr-dock .ls-calls [data-ca]');
  if (dockBtn) { await dockBtn.click(); await p.waitForTimeout(1200); w = await win();
    check('Cycle de vente : « Analyse » ouvre l’analyse au-dessus de la fiche', w && w.onTop && /DÉCOUVERTE/i.test(w.txt), w && { z: w.z, top: w.onTop });
    if (OUT) await p.screenshot({ path: OUT + '/cycle-analyse.png' });
    await p.keyboard.press('Escape'); await p.waitForTimeout(300); }
  else check('Cycle de vente : la fiche du premier lead a un appel analysé', false, await cf.evaluate(() => { const d = document.querySelector('#layer .lr-dock'); return d ? d.innerText.slice(0, 200) : 'pas de fiche'; }));
  check('aucune erreur dans la console', errs.length === 0, errs);
  ok.forEach(x => console.log('OK  ' + x)); bad.forEach(x => console.log('BAD ' + x));
  console.log(ok.length + ' contrôles réussis, ' + bad.length + ' en échec');
  await b.close(); process.exit(bad.length ? 1 : 0);
})();
