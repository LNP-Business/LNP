// node skl-os/crm/pipeline_outcome_live.js $PWD/skl-os/skl-os-en.html <screenshot dir> — CRM › Pipeline: a lead with a past
// call and no outcome shows « Déclarer l'issue »; the form saves through crm_declare_outcome (Romain 2026-11-05); a viewer
// sees no button. Simulated live cycles (the same as sales_cycle_live.js).
const { chromium } = require('playwright');
const FILE = 'file://' + process.argv[2], OUT = process.argv[3];
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto(FILE + '#crm'); await p.waitForTimeout(2500);
  let cf = null; for (const f of p.frames()) { try { if (await f.$('#v-crm')) { cf = f; break; } } catch (e) {} }
  const ok = [], bad = [];
  const check = (name, cond, info) => (cond ? ok : bad).push(name + (cond ? '' : ' → ' + JSON.stringify(info)));
  async function boot(role) {
    await cf.evaluate(async (role) => {
      const H = 3600e3, iso = (h) => new Date(Date.now() + h * H).toISOString();
      const cyc = (id, name, status, calls, events, extra) => Object.assign({ id, status, opened_at: iso(-200), owner_id: 'u-r', person: { full_name: name, primary_email: id + '@x.com', primary_phone: '+15550000' + id.length, first_seen_at: iso(-200) }, calls, events, deal: null, no_shows: 0 }, extra || {});
      const fake = {
        listMembers: async () => [{ id: 'u-r', member_key: 'romain', full_name: 'Romain' }],
        listNoBooking: async () => [],
        me: async () => ({ member_key: 'romain', role }),
        salesCycleView: window.parent.SKL_CRM.salesCycleView, reasonLabel: window.parent.SKL_CRM.reasonLabel,
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
    await p.waitForTimeout(800);
  }

  await boot('admin');
  const btns = await cf.$$eval('[data-act="outdecl"]', a => a.map(x => x.closest('.cx-card').querySelector('.cx-nm').textContent));
  check('a button on the lead with a past call and no outcome only', JSON.stringify(btns) === JSON.stringify(['Active Due']), btns);
  await cf.click('[data-act="outdecl"]'); await p.waitForTimeout(300);
  check('the form opens over the Pipeline', !!(await cf.$('.sko')), null);
  check('the form is in French', (await cf.$eval('.sko', e => e.textContent)).includes('L’appel a-t-il eu lieu ?'), null);
  await cf.click('[data-of="dec:no"]'); await cf.click('[data-osave="1"]'); await p.waitForTimeout(200);
  check('a reason is asked for a no', (await cf.$eval('.sko', e => e.innerText)).includes('Choisissez un motif.'), null);
  await cf.click('[data-of="reason:price"]'); await cf.click('[data-osave="1"]'); await p.waitForTimeout(800);
  const d = await cf.evaluate(() => window.__declared);
  check('saved through crm_declare_outcome on the due call', d && d[0] === 'k1' && d[1].attendance === 'held' && d[1].decision === 'no' && d[1].reason_code === 'price' && d[1].nurture === 'standard', d);
  check('the form closes after saving', !(await cf.$('.sko')), null);
  await p.screenshot({ path: OUT + '/pipeline-outcome.png' });
  await boot('viewer');
  check('a viewer sees no button', (await cf.$$('[data-act="outdecl"]')).length === 0, null);
  check('no console error', errs.length === 0, errs);
  console.log(ok.map(x => 'OK  ' + x).concat(bad.map(x => 'FAIL ' + x)).join('\n'));
  await b.close(); process.exit(bad.length ? 1 : 0);
})();
