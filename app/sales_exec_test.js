// node app/sales_exec_test.js $PWD/app/lnp.html <dossier> — Cockpit commercial › Exécution, Qualité, Impact
// (Romain 2026-11-09) : les quatre onglets, les chiffres d'exemple hors édition web, l'explication d'une étape,
// tout en français, aucune erreur dans la console.
const { chromium } = require('playwright');
const FILE = 'file://' + process.argv[2], OUT = process.argv[3];
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/fonts\.g|ERR_/.test(m.text())) errs.push(m.text()); });
  await p.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  const ok = [], bad = []; const check = (n, c, i) => (c ? ok : bad).push(n + (c ? '' : ' → ' + JSON.stringify(i)));
  await p.goto(FILE); await p.waitForTimeout(1500);
  await p.click('nav a:has-text("Cockpit commercial")'); await p.waitForTimeout(800);
  const tabs = await p.$$eval('#app [aria-label="Vues"] button', a => a.map(x => x.textContent.trim()));
  check('quatre onglets : Résultats, Exécution, Qualité, Impact', tabs.join('|') === 'Résultats|Exécution|Qualité|Impact', tabs);
  check('Résultats d’abord : le tableau de bord', (await p.getAttribute('#app [aria-label="Vues"] button >> nth=0', 'aria-pressed')) === 'true' && !!(await p.$('#app [data-dash]')), null);
  const sx = () => p.evaluateHandle(() => { const h = document.querySelector('#app [data-salesexec] > div'); return h && h.shadowRoot; });
  const txt = async () => (await sx()).evaluate(r => r ? r.getElementById('sx').innerText : '');
  // Exécution
  await p.click('#app [aria-label="Vues"] button:has-text("Exécution")'); await p.waitForTimeout(500);
  let t = await txt();
  check('Exécution : titre, délais, relances, interactions', /Exécution/.test(t) && /étapes à travailler/.test(t) && /Relance après une absence/.test(t) && /Relance après une vente manquée/.test(t) && /Interactions commerciales et vente/.test(t) && /Délai de réponse et vente/.test(t), t.slice(0, 300));
  const steps = await (await sx()).evaluate(r => r.querySelectorAll('tr[data-step]').length);
  check('onze étapes mesurées', steps === 11, steps);
  check('chiffres d’exemple annoncés hors édition web', /Chiffres d’exemple/.test(t), null);
  // the same periods as Résultats (B3, 2026-11-09): 7, 30 and 90 days
  check('périodes 7 j, 30 j, 90 j et Actualiser', /7 j/.test(t) && /90 j/.test(t) && !/180 j/.test(t) && /Actualiser/.test(t), null);
  // the SLA codes are secondary (B1): in the tooltip of each step
  const rules = await (await sx()).evaluate(r => [...r.querySelectorAll('tr[data-step]')].map(x => x.title).join(' '));
  check('cibles des SLA de LNP (SH-2, DE-1, CO-1)', /SH-2/.test(rules) && /DE-1/.test(rules) && /CO-1/.test(rules), null);
  await p.screenshot({ path: OUT + '/cockpit-execution.png', fullPage: true });
  // une étape expliquée
  await (await sx()).evaluate(r => r.querySelector('tr[data-step="recap_60"]').click()); await p.waitForTimeout(200);
  const dlg = await (await sx()).evaluate(r => { const d = r.querySelector('.dlg'); return d ? d.innerText : ''; });
  check('une étape s’ouvre : comment ça marche, bonne pratique, vos chiffres', /Récap écrit après le R1/.test(dlg) && /Comment ça marche/i.test(dlg) && /Bonne pratique/i.test(dlg) && /Vos chiffres/i.test(dlg) && /Comment l’atteindre/i.test(dlg), dlg.slice(0, 200));
  await p.screenshot({ path: OUT + '/cockpit-etape.png' });
  await p.keyboard.press('Escape'); await p.waitForTimeout(100);
  check('Échap ferme la fenêtre', !(await (await sx()).evaluate(r => !!r.querySelector('.dlg'))), null);
  // Qualité
  // les onglets restent en haut quand la page défile (Romain 2026-11-14)
  await p.mouse.wheel(0, 1200); await p.waitForTimeout(300);
  const vt = await p.evaluate(() => ({ top: Math.round(document.querySelector('#app [aria-label="Vues"]').getBoundingClientRect().top), y: window.scrollY }));
  check('après défilement, les onglets restent visibles en haut', vt.y > 200 && vt.top >= 0 && vt.top < 80, vt);
  await p.click('#app [aria-label="Vues"] button:has-text("Qualité")'); await p.waitForTimeout(500);
  t = await txt();
  check('Qualité : issues, enregistrements, SPIN, objections', /Qualité/.test(t) && /Appels tenus avec une issue/.test(t) && /Fathom/.test(t) && /Découverte \(SPIN\)/.test(t) && /Traitement des objections/.test(t), t.slice(0, 300));
  check('Qualification : les trois portes de LNP', /Métier/.test(t) && /Financement/.test(t) && /Décision et timing/.test(t) && !/Douleur/.test(t), null);
  check('motifs de perte', /Pourquoi les prospects sont perdus/.test(t), null);
  await p.screenshot({ path: OUT + '/cockpit-qualite.png', fullPage: true });
  // Impact
  await p.click('#app [aria-label="Vues"] button:has-text("Impact")'); await p.waitForTimeout(500);
  t = await txt();
  // « corrélation » is in « En savoir plus », folded (C6)
  const tAll = await (await sx()).evaluate(r => r.getElementById('sx').textContent);
  check('Impact : étapes et vente, ce qu’il faut pousser', /Étapes et vente/.test(t) && /Ce qu’il faut pousser maintenant/.test(t) && /corrélation/.test(tAll), t.slice(0, 300));
  check('Impact : lectures en français', /Fait vendre|Un certain effet|Pas assez de données|Pas d’effet visible|Effet inverse/.test(t), null);
  await p.screenshot({ path: OUT + '/cockpit-impact.png', fullPage: true });
  // retour à Résultats
  await p.click('#app [aria-label="Vues"] button:has-text("Résultats")'); await p.waitForTimeout(500);
  check('retour à Résultats', !!(await p.$('#app [data-dash]')) && !(await p.$('#app [data-salesexec]')), null);
  // pas d'anglais dans les trois onglets
  const english = [];
  for (const v of ['Exécution', 'Qualité', 'Impact']) {
    await p.click(`#app [aria-label="Vues"] button:has-text("${v}")`); await p.waitForTimeout(300);
    const s = await txt();
    for (const w of ['Execution', 'Quality', 'Delays', 'Refresh', 'days', 'Sample', 'closing', 'Closing', 'Step', 'Target', 'Median', 'Cases', 'leads', 'Whop', 'R2'])
      if (new RegExp('\\b' + w + '\\b').test(s)) english.push(v + ':' + w);
  }
  check('aucun mot anglais (ni R2, ni Whop)', english.length === 0, english);
  check('aucune erreur dans la console', errs.length === 0, errs);
  ok.forEach(x => console.log('OK  ' + x)); bad.forEach(x => console.log('BAD ' + x));
  console.log(ok.length + ' contrôles réussis, ' + bad.length + ' en échec');
  await b.close(); process.exit(bad.length ? 1 : 0);
})();
