// node app/training/reformulation_test.js $PWD/app/lnp.html <screenshot dir> — Entraînement › Reformulation de l'écart
// (Romain 2026-11-25): the sidebar entry, the frame on one screen, the call read once and one turn at a time (no way back,
// the place kept after a reload), the restitution written without the call, the correction of the code (the perfect
// restitution of each case gets 10, the traps are named), the result queued for « Mes résultats », no console error.
const { chromium } = require('playwright');
const FILE = 'file://' + process.argv[2], OUT = process.argv[3];
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/fonts\.g/.test(m.text())) errs.push(m.text()); });
  const ok = [], bad = []; const check = (n, c, i) => (c ? ok : bad).push(n + (c ? '' : ' → ' + JSON.stringify(i)));
  await p.goto(FILE); await p.waitForTimeout(1500);
  const nav = await p.$$eval('nav a', a => a.map(x => x.textContent.trim()).filter(Boolean));
  check('the entry comes right after « Découverte »', nav[nav.indexOf('Découverte') + 1] === 'Reformulation de l’écart', nav);
  await p.click('nav a:has-text("Reformulation de l’écart")'); await p.waitForTimeout(1200);
  check('the screen is named', (await p.title()).includes('Reformulation de l’écart'), await p.title());
  let f = null; for (const x of p.frames()) { try { if (await x.$('#cases')) { f = x; break; } } catch (e) {} }
  check('the training shows in its frame', !!f, null);
  const box = await p.evaluate(() => { const fr = [...document.querySelectorAll('iframe')].find(x => x.title === 'Reformulation de l’écart'); if (!fr) return null; const r = fr.getBoundingClientRect(); return { w: r.width, h: r.height, d: getComputedStyle(fr).display }; });
  check('the frame fills the screen', box && box.d === 'block' && box.w > 1000 && box.h > 700, box);
  const fits = () => f.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1 && document.documentElement.scrollWidth <= innerWidth + 1);
  await f.evaluate(() => localStorage.removeItem('lnp-ecart-v1')); await p.reload(); await p.waitForTimeout(1500);
  await p.click('nav a:has-text("Reformulation de l’écart")'); await p.waitForTimeout(1200);
  f = null; for (const x of p.frames()) { try { if (await x.$('#cases')) { f = x; break; } } catch (e) {} }
  check('six calls to choose from', (await f.$$('#cases [data-case]')).length === 6, null);
  check('the intro says the rules (once, one turn after the other)', /une seule fois/.test(await f.textContent('main')) && /une réplique après l'autre/.test(await f.textContent('main')), null);
  check('intro: one screen', await fits(), null);
  await p.screenshot({ path: OUT + '/ecart-intro.png' });
  const c = await f.evaluate(() => window.LNP_ECART.cas[0]);
  await f.click('#go'); await p.waitForTimeout(150);
  check('reading: one turn on screen, the first', (await f.$$('.turn')).length === 1 && (await f.textContent('.turn')).includes(c.tours[0][1]), null);
  check('reading: « Réplique 1 sur N »', (await f.textContent('.count')).includes('Réplique 1 sur ' + c.tours.length), null);
  check('reading: one screen', await fits(), null);
  await f.fill('#notes', '600 euros par mois · 1 500 · trouver des élèves');
  await f.click('body'); await f.press('body', ' '); await p.waitForTimeout(100);
  check('Espace → the next turn replaces the first', (await f.$$('.turn')).length === 1 && (await f.textContent('.turn')).includes(c.tours[1][1]) && !(await f.textContent('main')).includes(c.tours[0][1]), null);
  check('no way back: no previous button', !(await f.$('text=Réplique précédente')) && !(await f.$('[id=prev]')), null);
  await f.press('body', 'ArrowLeft'); await p.waitForTimeout(50);
  check('← does not go back', (await f.textContent('.turn')).includes(c.tours[1][1]), null);
  await f.click('#next'); await f.click('#next'); await p.waitForTimeout(100);
  await p.screenshot({ path: OUT + '/ecart-lecture.png' });
  // a reload keeps the place: the turns already read do not come back
  await p.reload(); await p.waitForTimeout(1500); await p.click('nav a:has-text("Reformulation de l’écart")'); await p.waitForTimeout(1200);
  f = null; for (const x of p.frames()) { try { if (await x.$('#cases')) { f = x; break; } } catch (e) {} }
  check('after a reload: the same turn, never the first again', (await f.textContent('.turn')).includes(c.tours[3][1]) && (await f.inputValue('#notes')).includes('600 euros'), await f.textContent('.count'));
  for (let i = 3; i < c.tours.length; i++) await f.click('#next');
  await p.waitForTimeout(100);
  check('writing: the call is gone, the notes stay', !(await f.$('.turn')) && /La transcription n'est plus visible/.test(await f.textContent('main')) && (await f.inputValue('#notes')).includes('600 euros'), null);
  check('writing: « Corriger » waits for a real text', await f.isDisabled('#check'), null);
  check('writing: one screen', await fits(), null);
  await f.fill('#mine', "Aujourd'hui tu fais à peu près 600 euros par mois avec les cours, tu voudrais faire 2 000 euros par mois, ton problème c'est la visibilité, et tu ne vois presque plus tes enfants le soir. Notre accompagnement va t'aider. C'est bien ça ?");
  await p.screenshot({ path: OUT + '/ecart-ecriture.png' });
  await f.click('#check'); await p.waitForTimeout(200);
  const txt = await f.textContent('main');
  check('a faulty restitution: « Écart absent », 0', /Écart absent/.test(txt) && (await f.textContent('.score .n')).trim() === '0', (await f.textContent('.score')));
  check('the sales\' word is named', /Les mots du commercial/.test(txt) && /Visibilité/i.test(txt), null);
  check('the figure he never said is named', /2000/.test(txt) && /Pas son chiffre/.test(txt), null);
  check('the offer is named', /Tu parles de l'offre/.test(txt), null);
  check('his words are highlighted in the restitution', (await f.$$('.mine mark')).length >= 3, null);
  check('correction: one screen', await fits(), null);
  await p.screenshot({ path: OUT + '/ecart-correction-ko.png' });
  check('the result is queued for « Mes résultats »', await f.evaluate(() => JSON.parse(localStorage.getItem('lnp-entrainement-a-envoyer') || '[]').some(x => x.module === 'ecart' && x.case_id === 'E1' && x.max === 10 && x.mode === 'regles')), null);
  await f.click('#t-appel'); await p.waitForTimeout(100);
  check('after the correction, the call can be read again, his words highlighted', (await f.$$('#h-ref .tr')).length === c.tours.length && (await f.$$('#h-ref mark')).length === 4, null);
  // again, with the perfect restitution
  await f.click('#again'); await f.click('#go');
  for (let i = 0; i < c.tours.length; i++) await f.click('#next');
  await f.fill('#mine', c.parfaite); await f.click('#check'); await p.waitForTimeout(200);
  check('the perfect restitution gets 10 / 10, « Écart présent »', (await f.textContent('.score .n')).trim() === '10' && /Écart présent/.test(await f.textContent('main')), await f.textContent('.score'));
  check('the best mark shows on the call', /10\/10/.test(await f.textContent('#cases [data-case="E1"]')), null);
  await p.screenshot({ path: OUT + '/ecart-correction-ok.png' });
  // the code's correction on every case
  const all = await f.evaluate(() => window.LNP_ECART.cas.map(c => { const r = window.LNP_ECART.correct(c, c.parfaite); return [c.id, r.score, r.present]; }));
  check('every perfect restitution gets 10', all.every(x => x[1] === 10 && x[2]), all);
  const traps = await f.evaluate(() => {
    const E = window.LNP_ECART, c2 = E.cas[1], c5 = E.cas[4], c4 = E.cas[3];
    const r1 = E.correct(c2, "Tu gagnes 1 800 euros par mois, tu veux passer à 40 euros de l'heure, tu as peur de perdre tes élèves si tu augmentes tes tarifs et tu n'as plus de temps pour ta compagne. C'est bien ça ?");
    const r2 = E.correct(c5, "Tu gagnes 2 100 euros net par mois, tu veux au moins 2 500 euros, tu ne sais pas te vendre et tu dors mal depuis la rentrée. C'est bien ça ?");
    const r3 = E.correct(c4, "Le soutien te rapporte 300 euros par mois, tu veux 1 000 euros par mois d'ici la rentrée, tu n'as pas de méthode pour structurer tes séances et tu manques de confiance en toi, et tu es à découvert tous les mois. C'est bien ça ?");
    const r4 = E.correct(c4, "Le soutien te rapporte 300 euros par mois, tu veux 1 000 euros par mois d'ici la rentrée, tu n'as pas de méthode pour structurer tes séances, et tu as honte.");
    return [r1.comps.A.label, r1.score, r2.comps.B.label, r3.comps.P.label, r3.score, r4.comps.C.label, r4.comps.V.label, r4.score];
  });
  check('A off B\'s dimension: « Pas le bon chiffre »', traps[0] === 'Pas le bon chiffre' && traps[1] === 8.5, traps);
  check('the older target: « Pas la bonne cible »', traps[2] === 'Pas la bonne cible', traps);
  check('two blockers: « Plusieurs blocages »', traps[3] === 'Plusieurs blocages' && traps[4] === 8.5, traps);
  check('another cost, no validation request', traps[5] === 'Un autre coût, avec ses mots' && traps[6] === 'Absente' && traps[7] === 8, traps);
  // leaving a call in progress asks in a window, never the browser's
  await f.click('#cases [data-case="E2"]'); await f.click('#go'); await f.click('#next');
  await f.click('#cases [data-case="E3"]'); await p.waitForTimeout(100);
  check('leaving a call being read asks first, in a window', await f.isVisible('.dlg') && /Quitter cet appel/.test(await f.textContent('.dlg')), null);
  await f.press('body', 'Escape'); await p.waitForTimeout(50);
  check('Échap keeps the call', !(await f.$('.dlg')) && (await f.$$('.turn')).length === 1, null);
  const english = await f.evaluate(() => /\b(the|and|loading|error|submit|next|back)\b/i.test(document.body.innerText));
  check('no English text', !english, null);
  check('no console error', !errs.length, errs);
  ok.forEach(x => console.log('OK  ' + x)); bad.forEach(x => console.log('BAD ' + x));
  await b.close(); process.exit(bad.length ? 1 : 0);
})();
