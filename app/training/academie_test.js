// node app/training/academie_test.js $PWD/app/lnp.html <screenshot dir> — Entraînement › Maîtrise de l'offre
// (« Académie sales LNP », Romain 2026-11-06): the entry of the sidebar, the frame, the 100 cases on one screen without scroll
// (1440×900, 1366×768, 1280×720; the answer and the corrigé tabs), a self-evaluation, the grid, the fiche mémo, the hash, the
// chrono, no console error.
const { chromium } = require('playwright');
const FILE = 'file://' + process.argv[2], OUT = process.argv[3];
(async () => {
  const b = await chromium.launch();
  const ok = [], bad = []; const check = (n, c, i) => (c ? ok : bad).push(n + (c ? '' : ' → ' + JSON.stringify(i)));
  const errs = [];
  async function open(w, h) {
    const p = await b.newPage({ viewport: { width: w, height: h } });
    p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/fonts\.g|ERR_/.test(m.text())) errs.push(m.text()); });
    await p.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    await p.goto(FILE); await p.waitForTimeout(1200);
    await p.click('nav a:has-text("Maîtrise de l\'offre")'); await p.waitForTimeout(1200);
    let af = null; for (const f of p.frames()) { try { if (await f.$('#left') && await f.$('#memo')) { af = f; break; } } catch (e) {} }
    return { p, af };
  }
  const { p, af } = await open(1440, 900);
  const nav = await p.$$eval('nav [data-navitems] a', a => a.map(x => x.textContent.trim()));
  check('the Entraînement group: Découverte, Maîtrise de l’offre, Mes résultats', nav.join('|').includes("Découverte|Maîtrise de l'offre|Mes résultats"), nav);
  check('the app shows in its frame', !!af, null);
  const box = await p.evaluate(() => { const f = [...document.querySelectorAll('iframe')].find(x => x.title === 'Maîtrise de l’offre'); if (!f) return null; const r = f.getBoundingClientRect(); return { w: r.width, h: r.height, d: getComputedStyle(f).display }; });
  check('the frame fills the screen', box && box.d === 'block' && box.w > 1000 && box.h > 700, box);
  const bar = (await af.textContent('.bar')).replace(/\s+/g, ' ');
  check('the bar: case, progress, average, fiche mémo', /Cas A1 · 1 \/ 100/.test(bar) && /0 \/ 100 validés/.test(bar) && /Moyenne/.test(bar) && /Fiche mémo/.test(bar), bar);
  check('no trainer button for someone who is not an admin', await af.$eval('#coach', e => e.hidden), null);
  await p.screenshot({ path: OUT + '/academie-a1.png' });

  // no correction by Claude: the answer is validated, then self-corrected (Romain 2026-11-08)
  check('no correction by Claude', !(await af.$('[data-do="claude"]')) && !/Claude/.test(await af.textContent('#R')), null);
  await af.click('[data-do="validate"]'); await p.waitForTimeout(50);
  check('nothing written: « Valider » asks for an answer first', /Écris d’abord ta réponse/.test(await af.textContent('#R')) && !(await af.$('[data-tab="auto"]')), null);
  const ANS = 'Le seuil de la garantie, c’est le montant que tu as investi, pas un chiffre fixe : on le regarde ensemble.';
  await af.fill('#ta', ANS);
  check('the Corrigé is closed before the answer is validated', await af.$eval('[data-tab="cor"]', e => e.disabled), null);
  await af.click('[data-do="validate"]'); await p.waitForTimeout(50);
  check('« Valider ma réponse » opens the auto-correction', (await af.getAttribute('[data-tab="auto"]', 'aria-selected')) === 'true', null);
  check('the answer validated is shown beside the grid, not editable', (await af.textContent('.autoc .mine')).trim() === ANS && !(await af.$('#ta')) && (await af.$$('.autoc [data-chk]')).length >= 3, null);
  await p.screenshot({ path: OUT + '/academie-auto.png' });
  await af.click('[data-tab="rep"]'); await p.waitForTimeout(50);
  check('the answer tab: locked, « Modifier ma réponse » offered', /Ta réponse est validée/.test(await af.textContent('#R')) && !!(await af.$('[data-do="edit"]')) && !(await af.$('#ta')), null);
  await af.click('[data-tab="cor"]'); await p.waitForTimeout(50);
  check('the Corrigé shows the answer to compare with the model', (await af.textContent('.cor .mine')).trim() === ANS && /Réponse modèle/.test(await af.textContent('.cor')), null);
  await af.click('[data-tab="auto"]'); await p.waitForTimeout(50);
  // self-evaluation: criteria ticked up to 6.5
  const maxes = await af.evaluate(() => LNP_ACADEMIE.CAS[0].attendus.map(a => a[0]));
  let sum = 0; for (let k = 0; k < maxes.length && sum < 6.5; k++) { if (sum + maxes[k] <= 6.5) { await af.click(`[data-chk="${k}"]`); sum += maxes[k]; } }
  await af.click('[data-do="saveself"]'); await p.waitForTimeout(200);
  const best = await af.evaluate(() => LNP_ACADEMIE.REC.exos.A1 && LNP_ACADEMIE.REC.exos.A1.best);
  check('the self-evaluation is kept: best mark ' + sum, best === sum, best);
  check('the case shows its best mark', (await af.textContent('#L')).includes('Meilleure note ' + String(sum).replace('.', ',') + '/10') || sum >= 8, await af.textContent('#L .pills'));
  check('the Corrigé tab opens once tried', !(await af.$eval('[data-tab="cor"]', e => e.disabled)), null);
  await af.click('[data-tab="cor"]'); await p.waitForTimeout(100);
  await p.screenshot({ path: OUT + '/academie-corrige.png' });
  check('the queue: kept on this device without the web edition', /cet appareil|LNP en ligne/.test(await af.evaluate(() => { let t = ''; LNP_RESULTS.onChange(x => { t = x; }); return t; })), null);

  // the grid and the fiche mémo: ✕, Échap, a click outside; the focus goes back
  await af.click('#grid'); await p.waitForTimeout(100);
  check('the grid of the 100 cases', (await af.$$('.modal [data-open]')).length === 100, (await af.$$('.modal [data-open]')).length);
  await af.press('body', 'Escape'); await p.waitForTimeout(50);
  check('Échap closes it, the focus goes back', !(await af.$('.modal')) && (await af.evaluate(() => document.activeElement.id)) === 'grid', null);
  await af.click('#memo'); await p.waitForTimeout(100);
  check('the fiche mémo', !!(await af.$('.modal')) && (await af.textContent('.modal')).length > 200, null);
  await af.click('.modal .x'); await p.waitForTimeout(50);
  check('✕ closes it', !(await af.$('.modal')), null);

  // hash and arrows
  await af.evaluate(() => { location.hash = '#b3'; }); await p.waitForTimeout(150);
  check('#b3 opens B3', (await af.evaluate(() => LNP_ACADEMIE.CAS[LNP_ACADEMIE.S.i].id)) === 'B3', null);
  await af.evaluate(() => { document.activeElement && document.activeElement.blur(); document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })); }); await p.waitForTimeout(50);
  check('→ goes to the next case, the address follows', (await af.evaluate(() => location.hash)) === '#b4', await af.evaluate(() => location.hash));

  // the chrono of a format A case
  await af.evaluate(() => LNP_ACADEMIE.go(0)); await p.waitForTimeout(50);
  await af.click('[data-do="chrono"]'); await p.waitForTimeout(1200);
  check('the chrono counts down from 1:30', /1:2[89]/.test(await af.textContent('#chr')), await af.textContent('#chr'));
  await af.evaluate(() => { LNP_ACADEMIE.S.left = -59; }); await p.waitForTimeout(1300);
  check('it stops at −1:00 and offers « Relancer »', /Relancer/.test(await af.textContent('[data-do="chrono"]')), await af.textContent('[data-do="chrono"]'));
  await p.close();

  // the 100 cases fit on one screen: answer, auto-correction and corrigé, at three sizes
  for (const [w, h] of [[1440, 900], [1366, 768], [1280, 720]]) {
    const { p: q, af: f } = await open(w, h);
    const res = await f.evaluate(async () => {
      const A = window.LNP_ACADEMIE, out = [];
      // 2026-11-10: the text never goes under 12 px; a pane that still does not fit scrolls (class « scroll », focusable) rather
      // than cutting its content. A failure is content cut off, or a text under 12 px.
      const small = (pane) => [...pane.querySelectorAll('*')].some(e => e.childNodes.length && [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()) && e.offsetParent !== null && parseFloat(getComputedStyle(e).fontSize) < 12);
      const over = (pane, inner) => small(pane) || ((inner.scrollHeight > pane.clientHeight + 1 || pane.scrollHeight > pane.clientHeight + 1) && !(pane.classList.contains('scroll') && pane.tabIndex === 0 && getComputedStyle(pane).overflowY === 'auto'));
      A.CAS.forEach(c => { A.REC.exos[c.id] = { best: 5, last: 5, tries: 1, mode: 'Auto-évaluation', at: '2026-11-06T10:00:00Z', feedback: { criteres: c.attendus.map((a, k) => ({ index: k + 1, points: 0, max: a[0], commentaire: '' })), eliminatoire: { declenche: false, raison: '' }, points_forts: '', a_corriger: '', phrase_a_retenir: '' } }; });
      for (let i = 0; i < A.CAS.length; i++) {
        for (const tab of ['rep', 'cor', 'auto']) {
          A.go(i); if (tab === 'cor') document.querySelector('[data-tab="cor"]').click();
          if (tab === 'auto') { document.getElementById('ta').value = 'x'.repeat(600); document.getElementById('ta').dispatchEvent(new Event('input', { bubbles: true })); if (document.getElementById('tb')) { document.getElementById('tb').value = 'y'.repeat(600); document.getElementById('tb').dispatchEvent(new Event('input', { bubbles: true })); } document.querySelector('[data-do="validate"]').click(); }
          const L = document.getElementById('left'), R = document.getElementById('right');
          if (over(L, document.getElementById('L')) || over(R, document.getElementById('R'))) out.push(A.CAS[i].id + ':' + tab);
        }
      }
      const doc = document.documentElement; if (doc.scrollHeight > doc.clientHeight + 1) out.push('page');
      return out;
    });
    check(`${w}×${h}: the 100 cases, answer, auto-correction and corrigé: nothing cut, no text under 12 px (${res.length} failures)`, res.length === 0, res.slice(0, 12));
    await q.close();
  }
  check('no console error', errs.length === 0, errs);
  ok.forEach(x => console.log('OK  ' + x)); bad.forEach(x => console.log('BAD ' + x));
  console.log(ok.length + ' checks passed, ' + bad.length + ' failed');
  await b.close(); process.exit(bad.length ? 1 : 0);
})();
