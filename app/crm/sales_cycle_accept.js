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
  check('1 onglets et compteurs', tabs.join('|') === 'Tous en cours 11|Agir maintenant 7|À faire 0|Appels prévus 3|En attente 1|Clos 2', tabs);
  check('1 en-tête : prospects à traiter, appels du jour', /7 prospects à traiter maintenant/.test(await txt('#sub')), await txt('#sub'));
  // 2 « Agir maintenant »: three sections, one order, the label from the SLA state
  const secs = await sc.$$eval('#list .sec', a => a.map(x => x.textContent.replace(/\s+/g, ' ').trim()));
  check('2 sections En premier · 3, Aussi critique · 2, En retard · 2', secs.slice(0, 3).join('|') === 'En premier · 3|Aussi critique · 2|En retard · 2', secs);
  const row = (id) => sc.evaluate((i) => { const r = document.querySelector('.row[data-id="' + i + '"]'); return r ? r.innerText.replace(/\s+/g, ' ') : null; }, id);
  const yd = await row('yd');
  check('2 Yassine : critique, action, montant en jeu', /Yassine Diallo/.test(yd) && /Critique · 1 h/.test(yd) && /Appeler Yassine pour la décision/.test(yd) && /3 400 € en jeu/.test(yd), yd);
  // 3 the selected lead
  const det = await txt('#det');
  check('3 fiche : « À faire », où en est le prospect, fil du cycle', /Olivier Masson/.test(det) && /À faire/.test(det) && /Envoyer l’étude de cas du T1 promise au R2/.test(det) && /Où en est le prospect/.test(det) && /Cycle de vente/.test(det) && /Faits clés/.test(det), det.slice(0, 300));
  await p.screenshot({ path: OUT + '/sc-desk.png' });
  // 4 « Fait » with a note, then « Annuler »
  const r = await sc.evaluate(async () => {
    const sel0 = S.sel, inp = document.querySelector('[data-ff=note]'); inp.value = 'Étude de cas envoyée'; inp.dispatchEvent(new Event('input', { bubbles: true }));
    document.querySelector('[data-do=note]').click(); await new Promise(r => setTimeout(r, 400));
    const sel1 = S.sel, ub = document.getElementById('undo'), shown = !!ub && !ub.hidden;
    if (ub) ub.querySelector('button').click(); await new Promise(r => setTimeout(r, 400));
    return { sel0, sel1, shown, sel2: S.sel, back: document.querySelector('[data-ff=note]').value }; });
  check('4 « Fait » passe au prospect suivant, « Annuler » revient avec la note', r.sel0 === 'om' && r.sel1 !== 'om' && r.shown && r.sel2 === 'om' && r.back === 'Étude de cas envoyée', r);
  // 5 a search without result keeps the counts and says so
  await sc.fill('#q', 'zzzzqq'); await p.waitForTimeout(300);
  const empty = await txt('#list'), sub = await txt('#sub'), tabs2 = await sc.$$eval('#qs .qc', a => a.map(x => x.textContent.replace(/\s+/g, ' ').trim()).join('|'));
  check('5 recherche sans résultat : message, compteurs gardés, « 0 sur 11 affichés »', /Aucun résultat pour « zzzzqq »/.test(empty) && /Effacer la recherche/.test(empty) && /0 sur 11/.test(sub) && tabs2 === tabs.join('|'), { empty, sub, tabs2 });
  await sc.click('[data-clearq]'); await p.waitForTimeout(300);
  check('5 « Effacer la recherche » rend la liste', (await sc.$$eval('#list .row', a => a.length)) > 0, null);
  // 6 French only
  const all = await sc.evaluate(() => document.body.innerText);
  const english = ['Due soon', 'Overdue', 'Critical', 'Late', 'Owner', 'Next step', 'Loading', 'Sales'].filter(w => new RegExp('\\b' + w + '\\b').test(all));
  check('6 aucun mot anglais', english.length === 0, english);
  check('6 aucune erreur dans la console', errs.length === 0, errs);
  ok.forEach(x => console.log('OK   ' + x)); bad.forEach(x => console.log('FAIL ' + x));
  console.log(ok.length + ' contrôles réussis, ' + bad.length + ' en échec');
  await b.close(); process.exit(bad.length ? 1 : 0);
})();
