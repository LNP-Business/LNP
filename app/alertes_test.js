// node app/alertes_test.js $PWD/app/lnp.html <dossier> — Alertes (Romain 2026-11-09 ; interface Impeccable P1.4 et D1,
// 2026-11-10) : les alertes du CRM se traitent dans Cycle de vente › « Agir maintenant » (l'ancien écran Alertes y renvoie),
// la pastille de la barre latérale sur Cycle de vente, un seul modèle de gravité (critiques d'abord, puis en retard), le rappel
// (Ma journée est fusionnée dans Cycle de vente), Paramètres › Alertes sans Slack par défaut, tout en français, aucune erreur dans la console.
const { chromium } = require('playwright');
const FILE = 'file://' + process.argv[2], OUT = process.argv[3];
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/fonts\.g|ERR_/.test(m.text())) errs.push(m.text()); });
  await p.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  const ok = [], bad = []; const check = (n, c, i) => (c ? ok : bad).push(n + (c ? '' : ' → ' + JSON.stringify(i)));
  await p.goto(FILE); await p.waitForTimeout(1500);
  const badge = await p.$eval('#app nav a[href="SalesCycle.dc.html"] [data-badge="alertes"]', e => ({ t: e.textContent, d: getComputedStyle(e).display })).catch(() => null);
  check('la pastille de Cycle de vente compte les prospects à traiter maintenant (7 dans l’exemple)', badge && badge.t === '7' && badge.d !== 'none', badge);
  // the Cycle de vente desk (a frame inside the CRM frame)
  const desk = async () => { for (let i = 0; i < 30; i++) { const f = p.frames().find(x => { try { return x.url() === 'about:srcdoc' && x.parentFrame() && x.parentFrame() !== p.mainFrame(); } catch (e) { return false; } }); if (f && await f.$('#qs').catch(() => null)) return f; await p.waitForTimeout(200); } return null; };
  await p.click('nav a:has-text("Cycle de vente")'); await p.waitForTimeout(1500);
  let f = await desk();
  check('Cycle de vente s’ouvre avec son bureau', !!f, null);
  if (f) {
    const s = await f.evaluate(() => ({ tab: document.querySelector('#qs [data-b="act"]').textContent.replace(/\s+/g, ' ').trim(),
      secs: [...document.querySelectorAll('#list .sec')].map(x => x.textContent.replace(/\s+/g, ' ').trim()),
      tones: [...document.querySelectorAll('#list .row')].map(r => r.dataset.tone), dues: [...document.querySelectorAll('#list .row .due')].map(x => x.textContent.trim()),
      reds: [...document.querySelectorAll('#list .row')].map(r => r.style.getPropertyValue('--rc')) }));
    // « Agir maintenant » = its three sections, in this order, at the top of « Tous en cours »
    const now = s.secs.filter(x => /^(En premier|Aussi critique|En retard) ·/.test(x)), sum = now.reduce((n, x) => n + +x.match(/· (\d+)/)[1], 0);
    check('« Agir maintenant » : les sections font le total de l’onglet et de la pastille', /À traiter · \d+/.test(s.tab) && sum === 7 && /^En premier/.test(s.secs[0]), s);
    check('critiques d’abord, puis en retard', s.tones.slice(0, 7).join(',') === 'crit,crit,crit,crit,crit,late,late', s.tones);
    // B en bulles (2026-11-14) : une ligne par prospect, la couleur vient de l'état SLA (rouge : critique, orange : en retard)
    check('la couleur vient de l’état SLA (rouge sur chaque critique)', s.reds.slice(0, 5).every(x => /crit/.test(x)) && s.reds.slice(5, 7).every(x => /late/.test(x)), s.reds);
    check('exemple annoncé hors édition web', /Démo/.test(await f.evaluate(() => document.body.innerText)), null);
    const english = ['Alerts', 'Late', 'Critical', 'Due soon', 'Owner', 'Closed', 'Loading'].filter(w => new RegExp('\\b' + w + '\\b').test(s.secs.join(' ') + s.dues.join(' ')));
    check('aucun mot anglais', english.length === 0, english);
  }
  await p.screenshot({ path: OUT + '/alertes.png', fullPage: true });
  // the former Alertes screen sends to Cycle de vente
  await p.evaluate(() => { location.hash = '#alertes'; }); await p.waitForTimeout(800);
  check('l’ancien lien #alertes ouvre Cycle de vente', /salescycle/.test(await p.evaluate(() => location.hash)) || !!(await p.$('#app [data-crmview="cycle"]')), await p.evaluate(() => location.hash));
  // Ma journée is merged into Cycle de vente (2026-11-10): no entry in the sidebar; Cycle de vente opens on « Agir maintenant »
  check('« Ma journée » n’est plus dans la barre latérale', !(await p.$('nav a:has-text("Ma journée")')), null);
  await p.click('nav a:has-text("Cockpit commercial")'); await p.waitForTimeout(600);
  await p.click('nav a:has-text("Cycle de vente")'); await p.waitForTimeout(1500);
  f = await desk();
  const pressed = f ? await f.evaluate(() => document.querySelector('#qs [data-b="act"]').getAttribute('aria-pressed')) : null;
  check('Cycle de vente s’ouvre sur « À traiter »', pressed === 'true', pressed);
  // Paramètres › Alertes : le CRM d'abord, Slack en option éteinte
  await p.click('nav a:has-text("Paramètres")'); await p.waitForTimeout(700);
  const st = await p.evaluate(() => document.getElementById('app').innerText);
  check('Paramètres : les alertes du CRM, Slack facultatif', /devient une alerte dans le CRM/.test(st), st.slice(0, 200));
  await p.click('#app button[aria-haspopup="dialog"] >> nth=1'); await p.waitForTimeout(300);
  const dlg = await p.evaluate(() => document.getElementById('app').innerText);
  check('la fenêtre d’un SLA : « Alertes du CRM » et « Copie dans Slack (facultatif) »', /Alertes du CRM/.test(dlg) && /Copie dans Slack \(facultatif\)/.test(dlg), null);
  check('aucune erreur dans la console', errs.length === 0, errs);
  ok.forEach(x => console.log('OK  ' + x)); bad.forEach(x => console.log('BAD ' + x));
  console.log(ok.length + ' contrôles réussis, ' + bad.length + ' en échec');
  await b.close(); process.exit(bad.length ? 1 : 0);
})();
