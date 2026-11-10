// node app/crm/sales_cycle_accept.js $PWD/app/lnp.html <screenshot dir> — docs/crm/16 §14 on the built page (demo data)
const { chromium } = require('playwright');
const FILE = 'file://' + process.argv[2], OUT = process.argv[3];
const ok = [], bad = [];
const check = (n, c, info) => (c ? ok : bad).push(n + (c ? '' : ' — ' + JSON.stringify(info)));
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto(FILE + '#crm'); await p.waitForTimeout(2500);
  const crm = p.frames().find(f => f.url() === 'about:srcdoc' && f.name() === '' && f.parentFrame() === p.mainFrame());
  let cf = null; for (const f of p.frames()) { try { if (await f.$('#v-crm')) { cf = f; break; } } catch (e) {} }
  await cf.click('[data-act="cxtab"][data-t="cycle"]'); await p.waitForTimeout(1200);
  const sc = cf.childFrames()[0];
  sc.on && 0;
  const txt = async (sel) => (await sc.$eval(sel, e => e.innerText)).replace(/\s+/g, ' ');
  // 1
  const k = await sc.$$eval('#kpis .kpi', a => a.map(x => x.innerText.replace(/\s+/g, ' ')));
  const needs = await txt('.needs');
  // SLA v3 (Romain 2026-10-30, docs/crm/18): the levels come from the SLAs (044: M. Ferrand is late on DE-4, a follow-up with no call booked), the row adds Due soon and Closed, the alerts go to Slack
  check('1 KPIs', k.join('|') === 'Prospects en cours 11 dans le pipeline|Critique 5 seuil critique du SLA dépassé|En retard 3 un objectif de SLA manqué|Bientôt dû 1 agir avant que l’objectif soit manqué|Le commercial doit agir 7 la prochaine étape est à nous|Appels sous 24 h 1 à l’agenda|En attente du prospect 1 à lui d’agir|Clos 2 1 gagné · 1 perdu' && /Slack #sales-cycle 8/.test(needs), { k, needs });
  // 2
  const rowOf = async (name) => sc.evaluate((n) => { const r = [...document.querySelectorAll('.r')].find(x => x.querySelector('.nm').innerText === n); return r ? r.innerText.replace(/\s+/g, ' ') : null; }, name);
  const yd = await rowOf('Yassine Diallo');
  check('2 Yassine', /Décision · 9,8 j \/ 3 j/.test(yd)  /* Romain 2026-10-29: past 72 h, days (236 h / 72 h before) */ && /Appeler Yassine pour la décision promise lundi/.test(yd) && /CRITIQUE\s*en retard de 1 h · d’après l’issue du R2/.test(yd), yd);
  const ydCrit = await sc.evaluate(() => { const r = [...document.querySelectorAll('.r')].find(x => x.querySelector('.nm').innerText === 'Yassine Diallo'); return r.querySelector('.sub em').className; });
  check('2 Yassine red', ydCrit === 'crit', ydCrit);
  // 3
  const cv = await rowOf('Claire Vidal');
  check('3 Claire', /R1 · Aujourd’hui 10:21/.test(cv) && /Appel R1 · Aujourd’hui 10:21/.test(cv) && /dans 1,5 h · premier appel/.test(cv), cv);
  // 4
  await sc.click('[data-axis="cal"]'); await p.waitForTimeout(300);
  const ruler = await txt('.ruler');
  const todayGold = await sc.$eval('.dayt.today', e => getComputedStyle(e).color);
  check('4 Calendar', /lun\. 19/.test(ruler) && /jeu\. 29/.test(ruler) && /Aujourd’hui/.test(ruler) && /Maintenant 08:51/.test(ruler), { ruler, todayGold });
  await p.screenshot({ path: OUT + '/sc-calendar.png' });
  await sc.click('[data-axis="book"]'); await p.waitForTimeout(200);
  // 5
  const dotVis = async () => sc.evaluate(() => { const r = [...document.querySelectorAll('.r')].find(x => !x.classList.contains('open')); const n = r.querySelector('.lane .node,.lane .evc'); return n ? getComputedStyle(n).opacity + '/' + getComputedStyle(n).visibility : 'none'; });
  const simple = await dotVis();
  await sc.click('[data-rowd="full"]'); await p.waitForTimeout(200); const full = await dotVis();
  await sc.click('[data-rowd="simple"]'); await p.waitForTimeout(200);
  check('5 Simple/Full', simple !== full, { simple, full });
  // 6
  await sc.selectOption('[data-sel="sort"]', 'call'); await p.waitForTimeout(200);
  const order = await sc.$$eval('.r .nm', a => a.slice(0, 3).map(x => x.innerText));
  check('6 Next call', order.join(',') === 'Claire Vidal,Marc Dupont,Julien Perrot', order);
  await sc.selectOption('[data-sel="sort"]', 'urg'); await sc.selectOption('[data-sel="grp"]', 'who'); await p.waitForTimeout(200);
  const secs = await sc.$$eval('.sec', a => a.map(x => x.innerText.split(' · ')[0]).filter(x => !/clos/i.test(x)));
  check('6 Group who', secs.length === 3, secs);
  await sc.selectOption('[data-sel="grp"]', 'none'); await p.waitForTimeout(200);
  // 7
  await sc.evaluate(() => { const r = [...document.querySelectorAll('.r')].find(x => x.querySelector('.nm').innerText === 'Thomas Girard'); r.querySelector('.who').click(); });
  await p.waitForTimeout(200);
  const hasDecl = await sc.$('[data-act="outcome"]');
  await hasDecl.click(); await p.waitForTimeout(150);
  await sc.click('[data-of="res:held"]'); await sc.click('[data-of="dec:fu"]'); await sc.fill('#ofs', 'Envoyer l’étude de cas, puis appeler jeudi');
  await sc.click('[data-ofsave]'); await p.waitForTimeout(200);
  const tg = await rowOf('Thomas Girard'), toast = await txt('#toast');
  check('7 Outcome', /Décision ·/.test(tg) && /Envoyer l’étude de cas, puis appeler jeudi/.test(tg) && /Issue enregistrée/.test(toast), { tg, toast });
  // 8
  await sc.evaluate(() => { const r = [...document.querySelectorAll('.r')].find(x => x.querySelector('.nm').innerText === 'Yassine Diallo'); if (!r.classList.contains('open')) r.querySelector('.who').click(); });
  await p.waitForTimeout(150);
  await sc.click('.r.open + .det [data-pop], .det [data-pop="yd"]'); await p.waitForTimeout(200);
  const sum = await sc.$$eval('.sum3 li', a => a.length), allN = await txt('[data-flt="all"]');
  await sc.click('[data-flt="msg"]'); await p.waitForTimeout(100); const msgN = await sc.$$eval('.convo .msg', a => a.length);
  await sc.click('[data-flt="all"]'); await sc.click('[data-order]'); const ord = await txt('[data-order]'); await sc.click('[data-order]');
  await sc.fill('#cmp', 'Bonjour Yassine, des nouvelles ?'); await sc.click('[data-send]'); await p.waitForTimeout(200);
  const last = await sc.evaluate(() => { const m = [...document.querySelectorAll('.convo .msg')].pop(); return m.innerText.replace(/\s+/g, ' '); });
  const who = await sc.$eval('.rside .sbox.dark b', e => e.innerText);
  check('8 Lead record', sum === 3 && /Tout 22/.test(allN) && msgN > 0 && /Plus récents d’abord/.test(ord) && /Bonjour Yassine/.test(last) && /Envoyé/.test(last) && who === 'En attente du prospect', { sum, allN, msgN, ord, last, who });
  // 9
  await sc.click('.rec [data-an^="yd:"]'); await p.waitForTimeout(200);
  const secN = await sc.$$eval('.ablk', a => a.length);
  await p.keyboard.press('Escape'); await p.waitForTimeout(100); const anGone = !(await sc.$('.adlg'));
  await p.keyboard.press('Escape'); await p.waitForTimeout(100); const recGone = !(await sc.$('.rec'));
  check('9 Call analysis', secN === 5 && anGone && recGone, { secN, anGone, recGone });
  // 10
  await sc.evaluate(() => { S.view.start = -50; render(); }); const st = await sc.evaluate(() => S.view.start);
  await sc.click('[data-mode="table"]'); await p.waitForTimeout(150);
  const firstRow = await sc.evaluate(() => { const t = document.querySelector('.det table tbody tr td'); return t ? t.innerText : null; });
  await sc.click('[data-mode="story"]');
  check('10 Hour 0', st === 0 && /h 0/.test(firstRow || ''), { st, firstRow });
  // filters (Romain, 2026-10-25): stage and recency, then back to all
  await sc.selectOption('[data-sel="stg"]', 'dec'); await p.waitForTimeout(200);
  const decRows = await sc.$$eval('.r .sub', a => a.map(x => x.innerText));
  check('filter stage', decRows.length > 0 && decRows.every(t => /^Décision|Gagné|Perdu/.test(t)), decRows);
  await sc.selectOption('[data-sel="stg"]', ''); await sc.selectOption('[data-sel="rec"]', '7'); await p.waitForTimeout(200);
  const recN = await sc.$$eval('.r', a => a.length), allLive = await sc.evaluate(() => LEADS.length);
  const stale = await sc.evaluate(() => LEADS.filter(l => l.age - Math.max(0, ...l.ev.filter(e => e.t <= l.age).map(e => e.t)) > 168).map(l => l.p));
  const shown = await sc.$$eval('.r .nm', a => a.map(x => x.innerText));
  check('filter recency', shown.every(n => !stale.includes(n)), { stale, shown });
  await sc.selectOption('[data-sel="rec"]', ''); await p.waitForTimeout(200);
  // 11
  await p.setViewportSize({ width: 400, height: 900 }); await p.waitForTimeout(400);
  const hs = await sc.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check('11 400 px', hs <= 0, hs);
  await p.setViewportSize({ width: 1440, height: 1000 });
  // tab back to Pipeline from the Sales cycle top bar
  await sc.click('[data-cxtab="pipeline"]'); await p.waitForTimeout(300);
  const back = await cf.evaluate(() => S.cx.tab + '/' + (document.querySelector('iframe[title="Cycle de vente"]').style.display));
  check('tab back', back === 'pipeline/none', back);
  check('13 no console error', errs.length === 0, errs);
  console.log('PASS', ok.length, ok); console.log('FAIL', bad.length, bad); await b.close();
})().catch(e => { console.error(e); process.exit(1); });
