// node app/crm/sales_cycle_accept.js $PWD/app/lnp.html <dossier> — Cycle de vente, son propre écran (bureau v2, 2026-11-09 ;
// interface Impeccable C2, D1, D6, 2026-11-10), données d'exemple : les onglets et leurs compteurs, « Agir maintenant » en trois
// sections (étiquette tirée de l'état SLA), la fiche du prospect (« À faire », où il en est, SLA ouverts, fil du cycle), « Fait »
// avec une note puis « Annuler », une recherche sans résultat, tout en français, aucune erreur dans la console.
const { chromium } = require('playwright');
const FILE = 'file://' + process.argv[2], OUT = process.argv[3];
const ok = [], bad = [];
const check = (n, c, info) => (c ? ok : bad).push(n + (c ? '' : ' — ' + JSON.stringify(info)));
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/fonts\.g|ERR_/.test(m.text())) errs.push(m.text()); });
  await p.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await p.goto(FILE + '#salescycle'); await p.waitForTimeout(3000);
  let sc = null;
  for (let i = 0; i < 30 && !sc; i++) { for (const f of p.frames()) { try { if (f.parentFrame() && f.parentFrame() !== p.mainFrame() && await f.$('#qs')) { sc = f; break; } } catch (e) {} } if (!sc) await p.waitForTimeout(200); }
  check('0 l’écran Cycle de vente ouvre son bureau', !!sc, null);
  if (!sc) { console.log('FAIL 0'); await b.close(); process.exit(1); }
  const txt = (sel) => sc.$eval(sel, e => e.innerText.replace(/\s+/g, ' ').trim());
  // 1 tabs and counts
  const tabs = await sc.$$eval('#qs .qc', a => a.map(x => x.textContent.replace(/\s+/g, ' ').trim()));
  // B en bulles (Romain 2026-11-14) : deux onglets, une ligne par prospect, la conversation du cycle, l'action à faire en bas
  check('1 deux onglets et leurs compteurs', tabs.join('|') === 'À traiter · 10|Tous · 11', tabs);
  check('1 en-tête : à traiter, en retard', /10 à traiter/.test(await txt('#sub')) && /7 en retard/.test(await txt('#sub')), await txt('#sub'));
  // 2 one line per lead: name, action, how late; the most urgent first
  const row = (id) => sc.evaluate((i) => { const r = document.querySelector('.row[data-id="' + i + '"]'); return r ? r.innerText.replace(/\s+/g, ' ') : null; }, id);
  const yd = await row('yd');
  check('2 Yassine : nom, action, retard', /Yassine Diallo/.test(yd) && /Appeler Yassine pour la décision/.test(yd) && /1 h/.test(yd), yd);
  const ids = await sc.$$eval('#list .row', a => a.map(r => r.dataset.tone));
  check('2 les critiques d’abord, puis en retard', ids.slice(0, 7).join(',') === 'crit,crit,crit,crit,crit,late,late', ids);
  // 3 the selected lead: its header on one line, the conversation (lead on the left, the team on the right), the action at the bottom
  const det = await txt('#det');
  const chat = await sc.evaluate(() => ({ L: document.querySelectorAll('#cl .bub.L').length, R: document.querySelectorAll('#cl .bub.R').length,
    last: document.querySelectorAll('#cl .bub.last').length, lastIsLast: [...document.querySelectorAll('#cl .bub')].pop().classList.contains('last'),
    bottom: (() => { const c = document.getElementById('cl'); return c.scrollHeight - c.scrollTop - c.clientHeight < 4; })(),
    share: document.getElementById('cl').getBoundingClientRect().height / innerHeight }));
  check('3 fiche : nom, « À faire » et l’action en bas', /Olivier Masson/.test(det) && /À faire/i.test(det) && /Envoyer l’étude de cas du T1 promise au R2/.test(det) && !/Où en est le prospect/.test(det), det.slice(0, 300));
  check('3 conversation : le lead à gauche, l’équipe à droite, la dernière action en bas et visible', chat.L > 0 && chat.R > 0 && chat.last === 1 && chat.lastIsLast && chat.bottom, chat);
  check('3 la conversation occupe l’essentiel de la hauteur', chat.share > 0.55, chat.share);
  await p.screenshot({ path: OUT + '/sc-desk.png' });
  // 4 « Fait » with a note, then « Annuler »
  const r = await sc.evaluate(async () => {
    const sel0 = S.sel, inp = document.querySelector('[data-ff=note]'); inp.value = 'Étude de cas envoyée'; inp.dispatchEvent(new Event('input', { bubbles: true }));
    document.querySelector('[data-do=note]').click(); await new Promise(r => setTimeout(r, 400));
    const sel1 = S.sel, ub = document.getElementById('undo'), shown = !!ub && !ub.hidden;
    if (ub) ub.querySelector('button').click(); await new Promise(r => setTimeout(r, 400));
    return { sel0, sel1, shown, sel2: S.sel, back: document.querySelector('[data-ff=note]').value }; });
  check('4 « Fait » passe au prospect suivant, « Annuler » revient avec la note', r.sel0 === 'om' && r.sel1 !== 'om' && r.shown && r.sel2 === 'om' && r.back === 'Étude de cas envoyée', r);
  // 5 « Tous » shows every lead in progress, « À traiter » comes back
  const n1 = await sc.$$eval('#list .row', a => a.length);
  await sc.click('.qc[data-b="all"]'); await p.waitForTimeout(300);
  const n2 = await sc.$$eval('#list .row', a => a.length);
  await sc.click('.qc[data-b="act"]'); await p.waitForTimeout(300);
  check('5 « Tous » montre plus de prospects, « À traiter » revient', n2 > n1 && (await sc.$$eval('#list .row', a => a.length)) === n1, { n1, n2 });
  // 6 French only
  const all = await sc.evaluate(() => document.body.innerText);
  const english = ['Due soon', 'Overdue', 'Critical', 'Late', 'Owner', 'Next step', 'Loading', 'Sales'].filter(w => new RegExp('\\b' + w + '\\b').test(all));
  check('6 aucun mot anglais', english.length === 0, english);
  check('6 aucune erreur dans la console', errs.length === 0, errs);
  ok.forEach(x => console.log('OK   ' + x)); bad.forEach(x => console.log('FAIL ' + x));
  console.log(ok.length + ' contrôles réussis, ' + bad.length + ' en échec');
  await b.close(); process.exit(bad.length ? 1 : 0);
})();
