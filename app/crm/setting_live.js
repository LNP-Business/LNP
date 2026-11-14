// node app/crm/setting_live.js $PWD/app/lnp.html <dossier> — CRM › Prospects : le suivi du setter (054). Les colonnes Étape setter,
// Dernière action, Action actuelle ; le filtre « En retard » ; la fiche d'un lead sans RDV avec son panneau Setting et ses
// actions (crm_setter_action) ; « + Nouveau prospect » (crm_create_lead). Cycles simulés, comme pipeline_outcome_live.js.
const { chromium } = require('playwright');
const FILE = 'file://' + process.argv[2], OUT = process.argv[3];
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto(FILE + '#crm'); await p.waitForTimeout(2500);
  let cf = null; for (const f of p.frames()) { try { if (await f.$('#v-crm')) { cf = f; break; } } catch (e) {} }
  const ok = [], bad = []; const check = (n, c, i) => (c ? ok : bad).push(n + (c ? '' : ' → ' + JSON.stringify(i)));
  await cf.evaluate(async () => {
    const H = 3600e3, iso = (h) => new Date(Date.now() + h * H).toISOString();
    const set = (st, extra) => Object.assign({ setter_id: 'u-s', lead_source: 'quiz', setting_status: st, setting_since: iso(-2), setting_last_action: 'Lead reçu : quiz complété',
      setting_last_at: iso(-2), setting_due_at: iso(1), setting_attempts: 0, quiz: { matiere: 'SVT', objectif: '2 000 €' } }, extra || {});
    window.__acts = []; window.__created = [];
    const fake = {
      listMembers: async () => [{ id: 'u-r', member_key: 'romain', full_name: 'Romain', role: 'admin', active: true }, { id: 'u-s', member_key: 'sam', full_name: 'Sam Setter', role: 'setter', active: true }],
      listNoBooking: async () => [
        Object.assign({ id: 'n1', full_name: 'Léa Quiz', primary_email: 'lea@x.com', first_seen_at: iso(-2), created_at: iso(-2) }, set('a_contacter', { setting_due_at: iso(-1) })),
        Object.assign({ id: 'n2', full_name: 'Vic VSL', primary_email: 'vic@x.com', first_seen_at: iso(-30), created_at: iso(-30) }, set('relance', { lead_source: 'vsl', setting_attempts: 2, setting_last_action: 'Appel sans réponse' }))],
      me: async () => ({ id: 'u-r', member_key: 'romain', role: 'admin' }),
      salesCycleView: window.parent.LNP_CRM.salesCycleView, reasonLabel: window.parent.LNP_CRM.reasonLabel,
      listBoard: async () => [{ id: 'c1', status: 'active', opened_at: iso(-20), owner_id: 'u-r', last_event_at: iso(-1),
        person: Object.assign({ id: 'pc1', full_name: 'Paul RDV', primary_email: 'paul@x.com', first_seen_at: iso(-20) }, set('rdv_confirme', { setting_due_at: null, setting_last_action: '« OK » reçu' })),
        calls: [{ id: 'k1', rank: 1, status: 'scheduled', scheduled_start: iso(20), scheduled_end: iso(20.75) }], events: [{ type: 'call_booked', occurred_at: iso(-20), call_id: 'k1', source: 'iclosed', data: {} }], deal: null, payments: [] }],
      listReasons: async () => [], addNote: async () => 1, subscribe: () => () => {},
      setterAction: async (pid, a, note) => { window.__acts.push([pid, a, note]); return {}; },
      setSetter: async () => null,
      createLead: async (n, e, t, s) => { window.__created.push([n, e, t, s]); return 'new'; }
    };
    await window.lnpCrmLive(fake);
  });
  await p.waitForTimeout(800);
  await cf.click('[data-act="cxtab"][data-t="leads"]'); await p.waitForTimeout(400);
  // 7 columns by default (2026-11-10): « Dernière action » is switched on, as from the « Colonnes » menu
  await cf.evaluate(() => { S.cx.cols.slast = true; renderCRM(); }); await p.waitForTimeout(200);
  const heads = await cf.$$eval('.cx-tbl thead th', a => a.map(x => x.textContent.trim()));
  check('colonnes Prise de RDV (étape du setter), Dernière action, Action actuelle', heads.some(h => /Prise de RDV/.test(h)) && heads.some(h => /Dernière action/.test(h)) && heads.some(h => /Action actuelle/.test(h)), heads);
  const row = (name) => cf.$$eval('.cx-tbl tbody tr', (rs, n) => { const r = rs.find(x => x.textContent.includes(n)); return r ? r.innerText.replace(/\s+/g, ' ') : ''; }, name);
  const lea = await row('Léa Quiz');
  check('Léa : Lead à contacter, Sam Setter, en retard', /Lead à contacter/.test(lea) && /Sam Setter/.test(lea) && /En retard de/.test(lea) && /Appeler en moins de 5 min/.test(lea), lea);
  const vic = await row('Vic VSL');
  check('Vic : Relance 2 / 6, dernière action', /Relance 2 \/ 6/.test(vic) && /Appel sans réponse/.test(vic) && /Tentative suivante/.test(vic), vic);
  const paul = await row('Paul RDV');
  check('Paul (cycle) : RDV confirmé', /RDV confirmé/.test(paul) && /« OK » reçu/.test(paul), paul);
  await cf.selectOption('#cxSetf', 'late'); await p.waitForTimeout(300);
  const n = await cf.$$eval('.cx-tbl tbody tr', a => a.length);
  check('filtre « En retard » : Léa seule', n === 1 && /Léa Quiz/.test(await row('Léa Quiz')), n);
  await p.screenshot({ path: OUT + '/prospects-setter.png' });
  await cf.selectOption('#cxSetf', 'all'); await p.waitForTimeout(200);
  // la fiche de Léa : le panneau Setting et ses actions
  await cf.evaluate(() => openLead('p-n1')); await p.waitForTimeout(500);
  const panel = await cf.$eval('.lnps', e => e.innerText).catch(() => '');
  check('fiche : panneau du setter en trois lignes (action actuelle, dernière faite, à faire ensuite)', /PRISE DE RDV · SETTER/i.test(panel) && /Action actuelle/i.test(panel) && /Appeler le lead/.test(panel) && /Dernière faite/i.test(panel) && /À faire ensuite/i.test(panel) && /message de relance WhatsApp/.test(panel) && !/Appel sans réponse/.test(panel), panel.slice(0, 300));
  const rec = await cf.$eval('#layer', e => e.innerText).catch(() => '');
  check('fiche sans RDV : la source et les réponses du quiz restent, repliées', /Source et réponses du quiz/.test(rec), rec.slice(0, 300));
  await cf.click('.lnps-more summary'); await p.waitForTimeout(200);
  const panel2 = await cf.$eval('.lnps', e => e.innerText).catch(() => '');
  check('« Enregistrer une action du setter » montre les actions', /Appel sans réponse/.test(panel2) && /Joint au téléphone/.test(panel2), panel2.slice(0, 300));
  check('un administrateur choisit le setter', !!(await cf.$('.lnps select[data-lnpsetter]')), null);
  await cf.fill('#lnpsNote', 'Messagerie, rappel à 18 h');
  await cf.click('.lnps [data-lnpset="appel_sans_reponse"]'); await p.waitForTimeout(500);
  const acts = await cf.evaluate(() => window.__acts);
  check('« Appel sans réponse » appelle crm_setter_action avec la note', acts.length === 1 && acts[0][0] === 'n1' && acts[0][1] === 'appel_sans_reponse' && acts[0][2] === 'Messagerie, rappel à 18 h', acts);
  await p.screenshot({ path: OUT + '/fiche-setting.png' });
  await cf.evaluate(() => closeLayer()); await p.waitForTimeout(200);
  // nouveau prospect
  await cf.click('[data-act="cxnew"]'); await p.waitForTimeout(300);
  check('« + Nouveau prospect » ouvre le formulaire', !!(await cf.$('.lnps-dlg form')), null);
  await cf.fill('.lnps-dlg input[name="n"]', 'Nina Main'); await cf.fill('.lnps-dlg input[name="t"]', '06 12 34 56 78');
  await cf.selectOption('.lnps-dlg select[name="s"]', 'webinaire');
  await cf.click('.lnps-dlg button[type="submit"]'); await p.waitForTimeout(400);
  const created = await cf.evaluate(() => window.__created);
  check('le lead est créé (crm_create_lead)', created.length === 1 && created[0][0] === 'Nina Main' && created[0][3] === 'webinaire' && !(await cf.$('.lnps-dlg')), created);
  check('aucune erreur dans la console', errs.length === 0, errs);
  ok.forEach(x => console.log('OK  ' + x)); bad.forEach(x => console.log('BAD ' + x));
  console.log(ok.length + ' contrôles réussis, ' + bad.length + ' en échec');
  await b.close(); process.exit(bad.length ? 1 : 0);
})();
