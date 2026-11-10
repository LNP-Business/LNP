// node app/alertes_test.js $PWD/app/lnp.html <dossier> — Ventes › Alertes (Romain 2026-11-09) : la pastille de la barre latérale,
// l'écran (critiques d'abord, compteurs, filtre par commercial), le rappel en tête de Ma journée, Paramètres › Alertes sans Slack
// par défaut, tout en français, aucune erreur dans la console.
const { chromium } = require('playwright');
const FILE = 'file://' + process.argv[2], OUT = process.argv[3];
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/fonts\.g|ERR_/.test(m.text())) errs.push(m.text()); });
  await p.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  const ok = [], bad = []; const check = (n, c, i) => (c ? ok : bad).push(n + (c ? '' : ' → ' + JSON.stringify(i)));
  await p.goto(FILE); await p.waitForTimeout(1500);
  const badge = await p.$eval('#app nav a[href="Alertes.dc.html"] [data-badge="alertes"]', e => ({ t: e.textContent, d: getComputedStyle(e).display })).catch(() => null);
  check('la pastille compte les alertes ouvertes (4 dans l’exemple)', badge && badge.t === '4' && badge.d !== 'none', badge);
  await p.click('nav a[href="Alertes.dc.html"]'); await p.waitForTimeout(700);
  const txt = () => p.evaluate(() => { const h = document.querySelector('#app [data-alertes] > div'); return h && h.shadowRoot ? h.shadowRoot.getElementById('al').innerText : ''; });
  let t = await txt();
  check('écran Alertes : titre, compteurs, fermées aujourd’hui', /Alertes/.test(t) && /CRITIQUE/i.test(t) && /EN RETARD/i.test(t) && /BIENTÔT DÛ/i.test(t) && /Fermées aujourd’hui/i.test(t), t.slice(0, 300));
  const order = await p.evaluate(() => [...document.querySelector('#app [data-alertes] > div').shadowRoot.querySelectorAll('.row')].map(r => r.className.split(' ')[1]));
  check('critiques d’abord, puis en retard, puis bientôt dû', order.join(',') === 'crit,late,late,warn', order);
  check('chaque ligne : prospect, SLA, depuis quand, objectif, commercial', /Prospect fictif A/.test(t) && /SH-2 · Premier contact du commercial/.test(t) && /depuis la prise de RDV/.test(t) && /objectif 5 min/.test(t) && /Commercial fictif 1/.test(t), t);
  check('exemple annoncé hors édition web', /Exemple : hors de l’édition web/.test(t), null);
  await p.evaluate(() => { const r = document.querySelector('#app [data-alertes] > div').shadowRoot; const s = r.querySelector('[data-who]'); s.value = 'm2'; s.dispatchEvent(new Event('change', { bubbles: true })); });
  await p.waitForTimeout(200); t = await txt();
  check('un administrateur filtre par commercial', /Prospect fictif B/.test(t) && !/Prospect fictif A/.test(t), t.slice(0, 400));
  await p.screenshot({ path: OUT + '/alertes.png', fullPage: true });
  // Ma journée : le rappel en tête
  await p.click('nav a:has-text("Ma journée")'); await p.waitForTimeout(700);
  const barTxt = await p.$eval('#app [data-alertbar]', e => e.textContent).catch(() => '');
  check('Ma journée : « Vous avez 4 alertes ouvertes, dont 1 critique »', /Vous avez 4 alertes ouvertes, dont 1 critique/.test(barTxt), barTxt);
  await p.click('#app [data-alertbar]'); await p.waitForTimeout(500);
  check('le rappel ouvre l’écran Alertes', !!(await p.$('#app [data-alertes]')), null);
  // Paramètres › Alertes : le CRM d'abord, Slack en option éteinte
  await p.click('nav a:has-text("Paramètres")'); await p.waitForTimeout(700);
  const st = await p.evaluate(() => document.getElementById('app').innerText);
  check('Paramètres : les alertes du CRM, Slack facultatif', /devient une alerte dans le CRM/.test(st), st.slice(0, 200));
  await p.click('#app button[aria-haspopup="dialog"] >> nth=1'); await p.waitForTimeout(300);
  const dlg = await p.evaluate(() => document.getElementById('app').innerText);
  check('la fenêtre d’un SLA : « Alertes du CRM » et « Copie dans Slack (facultatif) »', /Alertes du CRM/.test(dlg) && /Copie dans Slack \(facultatif\)/.test(dlg), null);
  await p.click('#app [data-overlay] button[aria-label="Fermer"]'); await p.waitForTimeout(200);
  // pas d'anglais à l'écran Alertes
  await p.click('nav a[href="Alertes.dc.html"]'); await p.waitForTimeout(500); t = await txt();
  const english = ['Alerts', 'Late', 'Critical', 'Due soon', 'Open', 'Owner', 'Closed', 'Loading'].filter(w => new RegExp('\\b' + w + '\\b').test(t));
  check('aucun mot anglais', english.length === 0, english);
  check('aucune erreur dans la console', errs.length === 0, errs);
  ok.forEach(x => console.log('OK  ' + x)); bad.forEach(x => console.log('BAD ' + x));
  console.log(ok.length + ' contrôles réussis, ' + bad.length + ' en échec');
  await b.close(); process.exit(bad.length ? 1 : 0);
})();
