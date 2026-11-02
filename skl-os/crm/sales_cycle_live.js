// node skl-os/crm/sales_cycle_live.js $PWD/skl-os/skl-os-en.html <screenshot dir> — Sales cycle on simulated live cycles: no invented analysis, writes wait for phase 3, viewer and sales roles
const { chromium } = require('playwright');
const FILE = 'file://' + process.argv[2], OUT = process.argv[3];
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto(FILE + '#crm'); await p.waitForTimeout(2500);
  let cf = null; for (const f of p.frames()) { try { if (await f.$('#v-crm')) { cf = f; break; } } catch (e) {} }
  const res = {};
  async function boot(role) {
    await cf.evaluate(async (role) => {
      const H = 3600e3, iso = (h) => new Date(Date.now() + h * H).toISOString();
      const cyc = (id, name, status, calls, events, extra) => Object.assign({ id, status, opened_at: iso(-200), owner_id: 'u-r', person: { full_name: name, primary_email: id + '@x.com', primary_phone: '+15550000' + id.length, first_seen_at: iso(-200) }, calls, events, deal: null, no_shows: 0 }, extra || {});
      const fake = {
        listMembers: async () => [{ id: 'u-r', member_key: 'romain', full_name: 'Romain' }],
        listNoBooking: async () => [],
        me: async () => ({ member_key: 'romain', role }),
        salesCycleView: window.parent.SKL_CRM.salesCycleView,
        listBoard: async () => [
          cyc('a1', 'Active Due', 'active', [{ id: 'k1', rank: 1, status: 'scheduled', scheduled_start: iso(-30), scheduled_end: iso(-29) }], [{ type: 'call_booked', occurred_at: iso(-200), call_id: 'k1', source: 'import', data: { event_name: 'Design Career Roadmap Call' } }], { next_move: { code: 'declare_outcome' } }),
          cyc('a2', 'Active Soon', 'active', [{ id: 'k2', rank: 1, status: 'scheduled', scheduled_start: iso(5), scheduled_end: iso(5.75) }], [{ type: 'call_booked', occurred_at: iso(-20), call_id: 'k2', source: 'iclosed', data: {} }], { opened_at: iso(-20) }),
          cyc('l1', 'Lost One', 'lost', [{ id: 'k3', rank: 1, status: 'no_show', scheduled_start: iso(-150), scheduled_end: iso(-149) }], [{ type: 'call_booked', occurred_at: iso(-200), call_id: 'k3', data: {} }, { type: 'cycle_lost', occurred_at: iso(-150), source: 'import', data: { reason: 'unreachable' } }], { close_reason: 'unreachable' }),
          cyc('h1', 'Held Lead', 'active', [{ id: 'k4', rank: 1, status: 'held', scheduled_start: iso(-10), scheduled_end: iso(-9.25) }], [{ type: 'call_booked', occurred_at: iso(-60), call_id: 'k4', data: {} }], { opened_at: iso(-60) })
        ],
        listReasons: async () => [{ code: 'price', kind: 'lost', label: 'Price', active: true }, { code: 'unreachable', kind: 'lost', label: 'Unreachable', active: true, automatic: true },
          { code: 'dq_off_target', kind: 'disqualified', label: 'Off target', active: true }],
        declareOutcome: async (callId, p) => { window.__declared = [callId, p]; return 'o1'; },
        addNote: async () => 1, subscribe: () => () => {}
      };
      await window.sklCrmLive(fake);
    }, role);
    await cf.click('[data-act="cxtab"][data-t="cycle"]'); await p.waitForTimeout(800);
  }
  await boot('admin');
  const sc = cf.childFrames()[0];
  res.mockHidden = await sc.$eval('#scMock', e => e.hidden);
  res.kpis = await sc.$$eval('#kpis .kpi', a => a.map(x => x.innerText.replace(/\s+/g, ' ')));
  res.rows = await sc.$$eval('.r', a => a.map(x => x.innerText.replace(/\s+/g, ' ').slice(0, 140)));
  res.reps = await sc.$$eval('#rep option', a => a.map(o => o.innerText));
  await p.screenshot({ path: OUT + '/sc-live.png' });
  // open the held lead record, analysis popup must not invent anything
  await sc.evaluate(() => { const r = [...document.querySelectorAll('.r')].find(x => x.querySelector('.nm').innerText === 'Held Lead'); r.querySelector('.who').click(); });
  await p.waitForTimeout(200); await sc.click('.det [data-pop]'); await p.waitForTimeout(200);
  res.summaryLabel = await sc.$eval('.sum3 .pk', e => e.innerText);
  await sc.click('.rec [data-an]'); await p.waitForTimeout(150);
  res.analysis = (await sc.$eval('.adlg', e => e.innerText)).replace(/\s+/g, ' ').slice(0, 220);
  await p.keyboard.press('Escape'); await p.keyboard.press('Escape'); await p.waitForTimeout(100);
  // a write in live mode: declare the outcome → says phase 3, changes nothing
  await sc.evaluate(() => { const r = [...document.querySelectorAll('.r')].find(x => x.querySelector('.nm').innerText === 'Active Due'); r.querySelector('.who').click(); });
  await p.waitForTimeout(200); await sc.click('[data-act="outcome"]'); await p.waitForTimeout(100);
  await sc.click('[data-of="dec:no"]'); res.reasons = await sc.$$eval('[data-of^="reason:"]', a => a.map(x => x.innerText));
  await sc.click('[data-of="dec:fu"]'); await sc.fill('#ofs', 'Call back Thursday'); await sc.click('[data-ofsave]'); await p.waitForTimeout(400);
  res.writeToast = await sc.$eval('#toast', e => e.innerText); res.declared = await cf.evaluate(() => window.__declared);
  await sc.click('[data-send], [data-act="whop"], [data-act="book"]').catch(() => {}); 
  res.needsGoes = await sc.evaluate(() => { let sent = null; const o = parent.parent.postMessage; return true; });
  // viewer: no write buttons; sales: no sales filter
  await sc.click('[data-cxtab="pipeline"]'); await p.waitForTimeout(200);
  await boot('viewer');
  res.viewerWrites = await sc.evaluate(() => [...document.querySelectorAll('[data-act=outcome],[data-act=reply],[data-act=book]')].filter(b => b.offsetParent).length);
  await sc.click('[data-cxtab="pipeline"]'); await p.waitForTimeout(200);
  await boot('sales');
  res.salesRepHidden = await sc.$eval('#rep', e => e.hidden);
  res.errors = errs;
  console.log(JSON.stringify(res, null, 1)); await b.close();
})().catch(e => { console.error(e); process.exit(1); });
