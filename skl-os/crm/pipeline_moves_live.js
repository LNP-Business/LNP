// node skl-os/crm/pipeline_moves_live.js $PWD/skl-os/skl-os-en.html <screenshot dir> — CRM › Pipeline moves (Romain 2026-11-05):
// dropping a lead in a column opens the outcome form filled in for that column (declare, or correct the latest outcome), the
// closing form for a lead with no call (045), the reopening of a closed lead, or says why the column is computed; the lead
// record shows its sales cycle as a feed with filters and « À faire » (lead_feed.js). Simulated live cycles.
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
      const cyc = (id, name, status, calls, events, extra) => Object.assign({ id, status, opened_at: iso(-200), owner_id: 'u-r', person: { full_name: name, primary_email: id + '@x.com', primary_phone: '+1555000' + id.length, first_seen_at: iso(-200) }, calls, events, deal: null, no_shows: 0 }, extra || {});
      const msg = (h, actor, type, content, ch) => ({ type, occurred_at: iso(h), actor, channel: ch || 'imessage', content, data: { status: 'delivered' } });
      window.__declared = []; window.__rpc = [];
      const fake = {
        listMembers: async () => [{ id: 'u-r', member_key: 'romain', full_name: 'Romain' }, { id: 'u-c', member_key: 'colin', full_name: 'Colin' }],
        listNoBooking: async () => [],
        me: async () => ({ member_key: 'romain', role }),
        salesCycleView: window.parent.SKL_CRM.salesCycleView, reasonLabel: window.parent.SKL_CRM.reasonLabel,
        listBoard: async () => [
          cyc('a1', 'Gina Villeneuve', 'active', [{ id: 'k1', rank: 1, status: 'held', scheduled_start: iso(-150), scheduled_end: iso(-149) }, { id: 'k1b', rank: 2, status: 'scheduled', scheduled_start: iso(-30), scheduled_end: iso(-29) }],
            [msg(-199, 'auto', 'message_out', 'Bonjour Gina ! Ici Amelia de LNP'), { type: 'call_booked', occurred_at: iso(-199), call_id: 'k1', source: 'iclosed', data: { event_name: 'Appel découverte' } },
             msg(-198, 'prospect', 'message_in', 'Merci, c’est noté pour 16 h'), { type: 'call_recorded', occurred_at: iso(-148.5), call_id: 'k1', actor: 'sales', channel: 'video' },
             { type: 'outcome_held', occurred_at: iso(-148), call_id: 'k1', source: 'crm' }, { type: 'outcome_follow_up', occurred_at: iso(-148), call_id: 'k1', source: 'crm', data: { next_step: 'Envoyer l’étude de cas' } },
             msg(-147, 'sales', 'message_out', 'Voici l’étude de cas promise'), { type: 'call_booked', occurred_at: iso(-140), call_id: 'k1b', source: 'iclosed', data: {} },
             { type: 'payment_succeeded', occurred_at: iso(-1000), data: {} }].filter(e => e.type !== 'payment_succeeded'), { next_move: { code: 'declare_outcome' } }),
          cyc('a2', 'Active Soon', 'active', [{ id: 'k2', rank: 1, status: 'scheduled', scheduled_start: iso(5), scheduled_end: iso(5.75) }], [{ type: 'call_booked', occurred_at: iso(-20), call_id: 'k2', source: 'iclosed', data: {} }], { opened_at: iso(-20) }),
          cyc('n1', 'New Lead', 'active', [], [{ type: 'imported', occurred_at: iso(-5), data: {} }], { opened_at: iso(-5) }),
          cyc('l1', 'Lost One', 'lost', [{ id: 'k3', rank: 1, status: 'no_show', scheduled_start: iso(-150), scheduled_end: iso(-149) }], [{ type: 'call_booked', occurred_at: iso(-200), call_id: 'k3', data: {} }, { type: 'cycle_lost', occurred_at: iso(-150), source: 'import', data: { reason: 'unreachable' } }], { close_reason: 'unreachable' }),
          cyc('m1', 'Moved Lead', 'active', [{ id: 'k5', rank: 1, status: 'held', scheduled_start: iso(-50), scheduled_end: iso(-49.25) }], [{ type: 'call_booked', occurred_at: iso(-80), call_id: 'k5', data: {} }, { type: 'outcome_held', occurred_at: iso(-49), call_id: 'k5', source: 'crm' }, { type: 'outcome_follow_up', occurred_at: iso(-49), call_id: 'k5', source: 'crm', data: {} }, { type: 'stage_moved', occurred_at: iso(-48), source: 'manual', data: { to: 'r2' } }], { opened_at: iso(-80) }),
                cyc('h1', 'Held Lead', 'active', [{ id: 'k4', rank: 1, status: 'held', scheduled_start: iso(-10), scheduled_end: iso(-9.25) }], [{ type: 'call_booked', occurred_at: iso(-60), call_id: 'k4', data: {} }, { type: 'outcome_held', occurred_at: iso(-9), call_id: 'k4', source: 'crm' }, { type: 'outcome_follow_up', occurred_at: iso(-9), call_id: 'k4', source: 'crm', data: {} }], { opened_at: iso(-60) })
        ],
        listReasons: async () => [{ code: 'price', kind: 'lost', label: 'Price', active: true }, { code: 'unreachable', kind: 'lost', label: 'Unreachable', active: true, automatic: true },
          { code: 'dq_off_target', kind: 'disqualified', label: 'Off target', active: true }],
        declareOutcome: async (callId, p) => { window.__declared.push([callId, p]); return 'o1'; },
        closeCycle: async (id, d, r) => { window.__rpc.push(['close', id, d, r]); return null; },
        reopenCycle: async (id) => { window.__rpc.push(['reopen', id]); return null; },
        moveCycle: async (id, to) => { window.__rpc.push(['move', id, to]); return {}; },
        addNote: async (id, txt) => { window.__rpc.push(['note', id, txt]); return 1; }, subscribe: () => () => {}
      };
      await window.sklCrmLive(fake);
    }, role);
  
    await p.waitForTimeout(800);
  }
  // the board's own drag and drop listeners, with the events a browser sends (the far columns are off screen)
  const drop = async (id, col) => {
    await cf.evaluate(([id, col]) => {
      const card = document.querySelector('.cx-card[data-id="' + id + '"]'), to = document.querySelector('.cx-col[data-st="' + col + '"]'), dt = new DataTransfer();
      card.dispatchEvent(new DragEvent('dragstart', { dataTransfer: dt, bubbles: true }));
      to.dispatchEvent(new DragEvent('dragover', { dataTransfer: dt, bubbles: true, cancelable: true }));
      to.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
      card.dispatchEvent(new DragEvent('dragend', { dataTransfer: dt, bubbles: true }));
    }, [id, col]);
    await p.waitForTimeout(300);
  };
  const toast = async () => (await cf.evaluate(() => { const t = document.querySelector('.toast,#toast,[role=status]'); return t ? t.textContent : ''; }));
  await boot('admin');
  // 1. a call to declare: Perdu → the outcome form, Honoré · Non
  await drop('a1', 'perdu');
  const f1 = await cf.$eval('.sko', e => e.textContent).catch(() => '');
  check('Perdu on a lead with a call to declare opens the outcome form', /Formulaire d’issue/.test(f1) && /déclarez l’issue du R2/.test(f1), f1.slice(0, 200));
  check('filled in: Honoré, Non', await cf.$eval('[data-of="res:held"]', e => e.getAttribute('aria-pressed')) === 'true' && await cf.$eval('[data-of="dec:no"]', e => e.getAttribute('aria-pressed')) === 'true', null);
  await p.screenshot({ path: OUT + '/move-outcome.png' });
  await cf.click('[data-of="reason:price"]'); await cf.click('[data-osave="1"]'); await p.waitForTimeout(500);
  let d = await cf.evaluate(() => window.__declared.slice(-1)[0]);
  check('saved: the R2 declared held, no, price', d && d[0] === 'k1b' && d[1].attendance === 'held' && d[1].decision === 'no' && d[1].reason_code === 'price', d);
  // 2. no call: Disqualifié → the closing form (045)
  await drop('n1', 'disq');
  const f2 = await cf.$eval('.sko', e => e.textContent).catch(() => '');
  check('Disqualifié on a lead with no call opens the closing form', /Clore le prospect/.test(f2), f2.slice(0, 120));
  await cf.click('[data-osave="1"]'); await p.waitForTimeout(200);
  check('a reason is asked', (await cf.$eval('.sko', e => e.innerText)).includes('Choisissez un motif.'), null);
  await cf.click('[data-of="reason:dq_off_target"]'); await cf.click('[data-osave="1"]'); await p.waitForTimeout(500);
  let r = await cf.evaluate(() => window.__rpc.slice(-1)[0]);
  check('saved through crm_close_cycle', JSON.stringify(r) === JSON.stringify(['close', 'n1', 'disqualified', 'dq_off_target']), r);
  // 3. a closed lead back in the pipeline: confirmation, then crm_reopen_cycle
  await drop('l1', 'r1');
  const ask = await cf.$eval('[role=alertdialog]', e => e.innerText).catch(() => '');
  check('a closed lead asks before reopening', /Rouvrir le prospect/.test(ask), ask);
  await cf.click('[role=alertdialog] [data-y]'); await p.waitForTimeout(400);
  r = await cf.evaluate(() => window.__rpc.slice(-1)[0]);
  check('reopened', JSON.stringify(r) === JSON.stringify(['reopen', 'l1']), r);
  // 4. a call already declared: Absent → the correction of its outcome
  await drop('h1', 'noshow');
  const f4 = await cf.$eval('.sko', e => e.textContent).catch(() => '');
  check('Absent on a declared call opens the correction', /Corriger l’issue/.test(f4) && /sera remplacée/.test(f4), f4.slice(0, 200));
  await cf.click('[data-osave="1"]'); await p.waitForTimeout(500);
  d = await cf.evaluate(() => window.__declared.slice(-1)[0]);
  check('saved: the R1 corrected to no-show', d && d[0] === 'k4' && d[1].attendance === 'no_show' && d[1].decision === null, d);
  // 5. a call ahead: Gagné says why nothing moves
  await drop('a2', 'close');
  check('a call not held yet: no form', !(await cf.$('.sko')), null);
  // a lead moved by hand to R2 (stage_moved, 047) shows in R2 and never goes back to R1
  check('a lead moved by hand to R2 shows in the R2 column', !!(await cf.$('.cx-col[data-st="r2"] .cx-card[data-id="m1"]')), null);
  // 5 bis. the rules of the rounds (047): nothing to declare → the lead moves at once; never back, never a round skipped
  const rpcN = async () => cf.evaluate(() => window.__rpc.length);
  let n0 = await rpcN();
  await drop('h1', 'r2');
  r = await cf.evaluate(() => window.__rpc.slice(-1)[0]);
  check('R1 held and declared → R2: moved at once, no window', !(await cf.$('.sko')) && JSON.stringify(r) === JSON.stringify(['move', 'h1', 'r2']), r);
  n0 = await rpcN();
  await drop('a1', 'r1');
  check('R2 → R1 is refused (no window, nothing saved)', !(await cf.$('.sko')) && (await rpcN()) === n0, null);
  await drop('m1', 'r1');
  check('moved by hand to R2 → R1 is refused', !(await cf.$('.sko')) && (await rpcN()) === n0, null);
  await drop('n1', 'r3');
  check('Nouveau → R3 is refused (a round is never skipped)', !(await cf.$('.sko')) && (await rpcN()) === n0, null);
  await drop('a2', 'r2');
  check('R1 still ahead → R2 is refused', !(await cf.$('.sko')) && (await rpcN()) === n0, null);
  await drop('n1', 'r1');
  r = await cf.evaluate(() => window.__rpc.slice(-1)[0]);
  check('Nouveau → R1: moved at once', JSON.stringify(r) === JSON.stringify(['move', 'n1', 'r1']), r);
  await drop('a1', 'r3');
  const f5 = await cf.$eval('.sko', e => e.textContent).catch(() => '');
  check('R2 with its outcome to declare → R3: the outcome form first', /Formulaire d’issue/.test(f5) && /Pour passer en R3/.test(f5), f5.slice(0, 160));
  await cf.click('[data-osave="1"]'); await p.waitForTimeout(500);
  d = await cf.evaluate(() => window.__declared.slice(-1)[0]); r = await cf.evaluate(() => window.__rpc.slice(-1)[0]);
  check('then the lead moves: R2 declared held, follow-up, moved to R3', d && d[0] === 'k1b' && d[1].decision === 'follow_up' && JSON.stringify(r) === JSON.stringify(['move', 'a1', 'r3']), [d, r]);
  await drop('h1', 'longfu');
  r = await cf.evaluate(() => window.__rpc.slice(-1)[0]);
  check('Relance longue: moved at once', JSON.stringify(r) === JSON.stringify(['move', 'h1', 'longfu']), r);
  // 6. the lead record: its sales cycle as a feed, the filters, « À faire »
  await cf.click('.cx-card[data-id="a1"] .cx-nm'); await p.waitForTimeout(800);
  const feed = await cf.$eval('.lf', e => e.innerText).catch(() => '');
  check('the lead record shows the sales cycle feed', /Cycle de vente/.test(feed) && /événements/.test(feed) && /Messages/.test(feed), feed.slice(0, 120));
  check('« À faire »: the outcome to declare', /Déclarer l’issue du R2/.test(await cf.$eval('.lt', e => e.innerText).catch(() => '')), null);
  check('no « Appels » filter in the lead record (its calls and their analysis are on the right)', !(await cf.$('.lf [data-lff="calls"]')), null);
  await cf.click('[data-lff="msgs"]'); await p.waitForTimeout(100);
  const vis = await cf.$$eval('.lf-it', a => a.filter(x => x.offsetParent).map(x => x.dataset.g));
  check('the Messages filter shows messages only', vis.length > 0 && vis.every(g => g === 'msgs'), vis);
  await cf.click('[data-lff="all"]');
  await p.screenshot({ path: OUT + '/lead-record.png' });
  // the status menu of the lead record moves the same way
  await cf.click('[data-act="lstmenu"], [data-act="stmenu"]').catch(() => {}); await p.waitForTimeout(200);
  const pick = await cf.$('[data-act="lstpick"][data-s="perdu"]');
  if (pick) { await pick.click(); await p.waitForTimeout(300); }
  check('the status menu « Perdu » opens the outcome form', !!pick && /Formulaire d’issue/.test(await cf.$eval('.sko', e => e.textContent).catch(() => '')), !!pick);
  await cf.evaluate(() => { const x = document.querySelector('.sko-scrim'); if (x) x.remove(); });
  // « Fait » on a follow-up saves a note
  await cf.evaluate(() => { if (typeof S !== 'undefined' && S.cx) { S.cx.lead = null; } document.querySelectorAll('.cx-modal,.cx-scrim').forEach(x => x.remove()); });
  await cf.evaluate(() => openLead('h1')); await p.waitForTimeout(500);
  await cf.fill('[data-ltn]', 'Étude de cas envoyée'); await cf.click('[data-ltdone]'); await p.waitForTimeout(400);
  r = await cf.evaluate(() => window.__rpc.slice(-1)[0]);
  check('« Fait » saves a note on the lead', JSON.stringify(r) === JSON.stringify(['note', 'h1', 'Étude de cas envoyée']), r);
  // a viewer moves nothing
  await boot('viewer');
  await drop('a1', 'perdu');
  check('a viewer moves nothing', !(await cf.$('.sko')), null);
  check('no console error', errs.length === 0, errs);
  console.log(ok.map(x => 'OK  ' + x).concat(bad.map(x => 'FAIL ' + x)).join('\n'));
  await b.close(); process.exit(bad.length ? 1 : 0);
})();
