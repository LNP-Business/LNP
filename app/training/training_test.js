// node app/training/training_test.js $PWD/app/lnp.html <screenshot dir> — Ventes › Entraînement (Romain 2026-11-05):
// the tab under Ma journée, « Le coup suivant » (a coup played to its verdict, a whole session to the bilan, the rules of form),
// « La lettre imposée » (a chain of three links to its end), « Nouvelle séance », the keyboard, no console error.
const { chromium } = require('playwright');
const FILE = 'file://' + process.argv[2], OUT = process.argv[3];
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/fonts\.g/.test(m.text())) errs.push(m.text()); });
  const ok = [], bad = []; const check = (n, c, i) => (c ? ok : bad).push(n + (c ? '' : ' → ' + JSON.stringify(i)));
  await p.goto(FILE); await p.waitForTimeout(1500);
  const nav = await p.$$eval('nav a', a => a.map(x => x.textContent.trim()).filter(Boolean));
  // Ma journée is merged into Cycle de vente (2026-11-10): the training group comes right after Leads
  const iJ = nav.indexOf('Leads'), iE = nav.indexOf('Découverte');
  check('« Entraînement › Découverte » comes right after « Leads »', iJ >= 0 && iE === iJ + 1 && nav[iE + 1] === 'Maîtrise de l’offre'.replace('’', "'") && nav[iE + 2] === 'Mes résultats', nav);
  check('« Suivi des commerciaux » is for admins only', !(await p.isVisible('nav a:has-text("Suivi des commerciaux")')), null);
  await p.click('nav a:has-text("Découverte")'); await p.waitForTimeout(1200);
  const fr = p.frames().find(f => f.url().startsWith('about:srcdoc') && f.name() === '' && f !== p.mainFrame() && f.parentFrame() === p.mainFrame() && f.url());
  let tf = null; for (const f of p.frames()) { try { if (await f.$('#view-coup')) { tf = f; break; } } catch (e) {} }
  check('the training shows in its frame', !!tf, null);
  const box = await p.evaluate(() => { const f = [...document.querySelectorAll('iframe')].find(x => x.title === 'Découverte'); if (!f) return null; const r = f.getBoundingClientRect(); return { w: r.width, h: r.height, d: getComputedStyle(f).display }; });
  check('the frame fills the screen', box && box.d === 'block' && box.w > 1000 && box.h > 700, box);
  check('top bar: title, two trainings, « Nouvelle séance »', (await tf.evaluate(() => [...document.querySelectorAll('.top > :not(.sync)')].map(x => x.textContent).join(' '))).replace(/\s+/g, ' ').includes('Découverte Le coup suivant La lettre imposée Nouvelle séance'), null);   // the screen's name (B2, 2026-11-09)
  check('a session of 20 coups starts at once', /coup 1 \/ 20/.test(await tf.textContent('#view-coup .sess')), null);
  await p.screenshot({ path: OUT + '/coup-step1.png' });
  // coup 1: the right gesture, then a question that passes the rules
  const c0 = await tf.evaluate(() => LNP_TRAINING.C.cases[0]);
  await tf.click(`[data-geste="${c0.att}"]`); await tf.click('[data-do="valider"]'); await p.waitForTimeout(100);
  check('step 2: « Bon geste »', (await tf.textContent('#exC .fb')).startsWith('Bon geste : ' + c0.att), null);
  await tf.fill('#qC', 'Est-ce que tu as des élèves ou pas ? et pourquoi ?');
  const chips = await tf.$$eval('#exC [data-live-rules] .chip', a => a.map(x => x.className + ':' + x.textContent));
  check('the rules are checked while typing (faults)', chips.some(x => /ko.*Ouverte/.test(x)) && chips.some(x => /ko.*pourquoi/.test(x)) && chips.some(x => /ko.*Une seule question/.test(x)) && chips.some(x => /ok.*Sans choix/.test(x)), chips);
  check('the first fault is spelt out', /appelle un oui ou un non/.test(await tf.textContent('#exC .fault')), null);
  await tf.fill('#qC', 'Ces quelques cours à côté, ça te rapporte combien par mois aujourd’hui ?');
  const chips2 = await tf.$$eval('#exC [data-live-rules] .chip', a => a.map(x => x.className));
  check('a good question: every rule ✓', chips2.length === 6 && chips2.every(x => /ok/.test(x)), chips2);
  check('the gauge counts the words (« aujourd’hui » is two words: the cahier splits on anything not a letter, a digit or %)', /13 mots/.test(await tf.textContent('#exC .gline')), await tf.textContent('#exC .gline'));
  check('« Toi » fills in live', (await tf.textContent('#scC .me')).includes('ça te rapporte combien'), null);
  await tf.press('#qC', 'Control+Enter'); await p.waitForTimeout(100);
  check('Ctrl + Entrée → the corrigé', /La question étalon/.test(await tf.textContent('#exC')), null);
  check('no verdict before the two judgments', /Réponds aux deux questions/.test(await tf.textContent('#exC')), null);
  await tf.click('body'); await tf.press('body', 'o'); await tf.press('body', 'o'); await p.waitForTimeout(100);
  check('O, O → « Coup juste »', /Coup juste/.test(await tf.textContent('#exC .verdict')), await tf.textContent('#exC .verdict'));
  await p.screenshot({ path: OUT + '/coup-corrige.png' });
  await tf.press('body', 'Enter'); await p.waitForTimeout(100);
  check('Entrée → coup 2, one coup juste', /coup 2 \/ 20/.test(await tf.textContent('#view-coup .sess')) && (await tf.textContent('#view-coup .big')).trim() === '1', null);
  // coup 2 with the hint and a wrong gesture
  await tf.click('[data-do="indice"]');
  check('the hint shows the state of the conversation', /ce coup ne comptera pas dans le score/.test(await tf.textContent('#scC')), null);
  const c1 = await tf.evaluate(() => LNP_TRAINING.C.cases[1]);
  const wrong = ['L1', 'L2', 'L3', 'L4'].find(x => x !== c1.att);
  await tf.click('body'); await tf.press('body', String(['L1', 'L2', 'L3', 'L4'].indexOf(wrong) + 1)); await tf.press('body', 'Enter'); await p.waitForTimeout(100);
  check('a wrong gesture: « Le coup à jouer était … »', /le coup à jouer était/i.test(await tf.textContent('#exC .fb')), null);
  await tf.click('[data-do="etalon"]'); await p.waitForTimeout(50);
  check('no question → « Geste manqué » at once', /Geste manqué/.test(await tf.textContent('#exC .verdict')) && /Pas de question écrite/.test(await tf.textContent('#exC')), null);
  await tf.click('[data-do="suivant"]');
  // the 18 others, played through the page's own buttons
  for (let k = 2; k < 20; k++) {
    const c = await tf.evaluate((k) => LNP_TRAINING.C.cases[k], k);
    await tf.click(`[data-geste="${k % 3 ? c.att : (c.att === 'L1' ? 'L2' : 'L1')}"]`); await tf.click('[data-do="valider"]');
    await tf.fill('#qC', c.ok); await tf.click('[data-do="comparer"]');
    await tf.click('[data-j="j1:1"]'); await tf.click('[data-j="j2:' + (k % 4 ? 1 : 0) + '"]'); await tf.click('[data-do="suivant"]');
  }
  const bil = await tf.textContent('#view-coup .bilan');
  check('the bilan: score, objective, three figures, the matrix', /\/20/.test(bil) && /Objectif (atteint|non atteint : 16 coups justes visés)/.test(bil) && /gestes justes sur 20/.test(bil) && /Où se trompe ton choix de geste/.test(bil) && !!(await tf.$('table.mx')), bil.slice(0, 200));
  check('the most frequent confusion is named', /Ta confusion la plus fréquente : jouer L\d/.test(bil), null);
  check('the coups to rework and « Rejouer ces N cas »', /Les coups à retravailler/.test(bil) && /Rejouer ces \d+ cas/.test(bil), null);
  await p.screenshot({ path: OUT + '/coup-bilan.png' });
  // « La lettre imposée »
  await tf.click('[data-tab="lettre"]'); await p.waitForTimeout(150);
  check('the URL follows (#lettre-imposee)', (await tf.evaluate(() => location.hash)) === '#lettre-imposee', await tf.evaluate(() => location.href));
  check('a session of 5 cases starts at once, 15 questions', /cas 1 \/ 5/.test(await tf.textContent('#view-lettre .sess')) && /objectif 12 · 15/.test(await tf.textContent('#view-lettre .sess')), await tf.textContent('#view-lettre .sess'));
  const l0 = await tf.evaluate(() => LNP_TRAINING.L.cases[0]);
  check('the persona and the chrono in the header', (await tf.textContent('#view-lettre .win .hd')).includes(l0.qui) && !!(await tf.$('#chrono')), null);
  for (let k = 0; k < 3; k++) {
    await tf.fill('#qL', l0.r[k].ok);
    const ch = await tf.$$eval('#exL [data-live-rules] .chip', a => a.map(x => x.className + ':' + x.textContent));
    if (k === 0) check('I1: the 7 rules and the advice « Repart de ses mots »', ch.length === 8 && ch.slice(0, 7).every(x => /ok/.test(x)) && /Repart de ses mots/.test(ch[7]), ch);
    await tf.press('#qL', 'Control+Enter'); await p.waitForTimeout(80);
    if (k === 0) check('the étalon with the prospect’s words highlighted', !!(await tf.$('#exL .panel.std mark')), null);
    await tf.click('body'); await tf.press('body', 'o'); await tf.press('body', 'o'); await p.waitForTimeout(50);
    if (k === 0) check('a valid implication question', /Question d’implication valide/.test(await tf.textContent('#exL .verdict')), null);
    await tf.press('body', 'Enter'); await p.waitForTimeout(100);
    if (k === 0) {
      const sc = await tf.textContent('#scL');
      check('the étalon and the answer join the script, « Ta version »', sc.includes('Commercial · I1') && sc.includes('Ta version : ' + l0.r[0].ok) && sc.includes(l0.r[0].rep) && /Il vient de répondre/.test(sc), null);
    }
  }
  check('the end of the case: « Chaîne tenue sur les trois tours »', /Chaîne tenue sur les trois tours/.test(await tf.textContent('#exL')), null);
  await p.screenshot({ path: OUT + '/lettre-fin.png' });
  await tf.press('body', 'Enter'); await p.waitForTimeout(100);
  check('Entrée → case 2', /cas 2 \/ 5/.test(await tf.textContent('#view-lettre .sess')), null);
  await tf.fill('#qL', 'Si tu avais plus d’élèves, ce serait comment ?');
  const chp = await tf.$$eval('#exL [data-live-rules] .chip', a => a.map(x => x.className + ':' + x.textContent));
  check('projection refused', chp.some(x => /ko.*Pas de projection/.test(x)), chp);
  await p.screenshot({ path: OUT + '/lettre-ecriture.png' });
  // the coup state kept when coming back
  await tf.click('[data-tab="coup"]');
  check('each training keeps its session', !!(await tf.$('#view-coup .bilan')), null);
  // « Nouvelle séance »
  await tf.click('#newSession'); await p.waitForTimeout(80);
  check('the window: « X cas tirés sur Y disponibles »', /20 cas tirés sur 100 disponibles/.test(await tf.textContent('.modal')), await tf.textContent('.modal'));
  await tf.click('[data-mg="geste"][data-mv="L3"]'); await tf.click('[data-mg="nb"][data-mv="40"]');
  check('filters: 25 L3 cases', /25 cas tirés sur 25 disponibles/.test(await tf.textContent('.modal')), await tf.textContent('.modal .info'));
  await tf.click('[data-mg="reg"][data-mv="F"]'); await tf.click('[data-mg="quels"][data-mv="errors"]');
  const info = await tf.textContent('.modal .info');
  check('« Mes erreurs » among the L3 Financier cases', /cas tirés|Aucun cas ne correspond/.test(info), info);
  await p.screenshot({ path: OUT + '/nouvelle-seance.png' });
  await tf.press('body', 'Escape'); await p.waitForTimeout(50);
  check('Échap closes the window', !(await tf.$('.modal')), null);
  await tf.click('#newSession'); await tf.click('[data-mg="nb"][data-mv="10"]'); await tf.click('[data-mstart="1"]'); await p.waitForTimeout(80);
  check('« Commencer » starts a new session', /coup 1 \/ 10/.test(await tf.textContent('#view-coup .sess')), null);
  check('no console error', errs.length === 0, errs);
  console.log(ok.map(x => 'OK  ' + x).concat(bad.map(x => 'FAIL ' + x)).join('\n'));
  await b.close(); process.exit(bad.length ? 1 : 0);
})();
