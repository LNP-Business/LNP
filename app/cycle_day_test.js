// Cycle de vente with Ma journée merged in (Romain 2026-11-10): « Aujourd’hui », « Fait aujourd’hui », Demain, Passer, Annuler,
// the old Ma journée address. Usage: node app/cycle_day_test.js $PWD/app/lnp.html <dossier>
const { chromium } = require('playwright');
(async () => {
  const [file, out] = process.argv.slice(2);
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
  const errs = []; p.on('pageerror', e => errs.push(String(e))); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
  let fail = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fail++; };
  await p.goto('file://' + file + '#salesday'); await p.waitForTimeout(3000);
  const nav = await p.evaluate(() => [...document.querySelectorAll('nav a')].map(a => a.innerText.trim()).filter(Boolean));
  ok(!nav.some(x => /Ma journée/.test(x)), 'no « Ma journée » in the sidebar: ' + nav.join(' | '));
  ok(await p.evaluate(() => location.hash === '#salescycle'), '#salesday opens Cycle de vente (' + await p.evaluate(() => location.hash) + ')');
  const crm = p.frameLocator('main [data-crm] iframe'), desk = crm.frameLocator('iframe').first();
  await p.waitForTimeout(1500);
  const dsk = async () => { for (const f of p.frames()) { try { if (await f.$('#dayw')) return f; } catch (e) {} } return null; };
  const f = await dsk(); ok(!!f, 'desk frame found');
  const pressed = await f.evaluate(() => (document.querySelector('.qc[aria-pressed="true"]') || {}).textContent || '');
  ok(/À traiter/.test(pressed), 'opens on « À traiter »: ' + pressed);
  const sum = async () => (await f.evaluate(() => document.querySelector('#day summary').textContent));
  ok(/Aujourd’hui · 0 prospect traité/.test(await sum()), 'day summary: ' + await sum());
  const cur = async () => f.evaluate(() => (document.querySelector('.row[aria-selected="true"]') || {}).dataset?.id);
  const name = async () => f.evaluate(() => document.querySelector('#det h2, #det .dn, #det [class*="nm"]')?.textContent || '');
  const nowCount = async () => f.evaluate(() => +document.querySelector('.qc[data-b="act"] b').textContent);
  ok(await f.evaluate(() => !!document.querySelector('[data-do="snooze"]') && !!document.querySelector('[data-do="skip"]')), 'Demain and Passer buttons shown');
  const n0 = await nowCount(), a = await cur();
  await f.click('[data-do="skip"]'); await p.waitForTimeout(300);
  const b1 = await cur(); ok(b1 && b1 !== a, 'Passer opens the next lead');
  const order = await f.evaluate(() => [...document.querySelectorAll('.row')].map(r => r.dataset.id));
  ok(order.indexOf(a) > order.indexOf(b1), 'the passed lead goes after the next one');
  ok(await nowCount() === n0, 'Passer keeps the count (' + n0 + ')');
  await f.click('[data-do="snooze"]'); await p.waitForTimeout(300);
  ok(await nowCount() === n0 - 1, 'Demain takes the lead out of « À traiter » (' + await nowCount() + ')');
  ok(/1 à demain/.test(await sum()), 'summary counts it: ' + await sum());
  ok(await f.evaluate(id => !!document.querySelector(`[data-unsnooze="${id}"]`), b1), '« Remettre aujourd’hui » listed under Demain');
  // keyboard: P passes
  const c1 = await cur(); await f.evaluate(() => document.activeElement && document.activeElement.blur()); await f.press('body', 'p'); await p.waitForTimeout(300);
  ok((await cur()) !== c1, 'key P passes');
  // Fait with a note on a lead the rep must act on
  let done = false;
  for (let k = 0; k < 8 && !done; k++) {
    const btn = await f.$('[data-do="note"].p');
    if (btn) { await f.fill('[data-ff="note"]', 'Message envoyé'); await btn.click(); done = true; }
    else { await f.evaluate(() => document.activeElement && document.activeElement.blur()); await f.press('body', 'ArrowDown'); await p.waitForTimeout(150); }
  }
  ok(done, 'a « Fait · prospect suivant » was found');
  await p.waitForTimeout(400);
  ok(/1 prospect traité/.test(await sum()), 'Fait counts in the day: ' + await sum());
  await f.click('#day summary'); await p.waitForTimeout(200);
  const list = await f.evaluate(() => document.querySelector('.dayp').innerText);
  ok(/Fait aujourd’hui/.test(list) && /fait · /.test(list), 'Fait aujourd’hui lists it: ' + list.replace(/\n/g, ' / '));
  await p.screenshot({ path: out + '/desk-day.png' });
  // Annuler takes it back
  await f.click('#undo button'); await p.waitForTimeout(300);
  ok(/0 prospect traité/.test(await sum()), 'Annuler takes it back: ' + await sum());
  // Remettre aujourd'hui
  await f.click(`[data-unsnooze="${b1}"]`); await p.waitForTimeout(300);
  ok(await nowCount() === n0 && !/à demain/.test(await sum()), 'Remettre aujourd’hui brings it back');
  ok(errs.length === 0, 'no console errors ' + JSON.stringify(errs.slice(0, 3)));
  await b.close(); process.exit(fail ? 1 : 0);
})();
