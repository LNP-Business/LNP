/* LNP · l'analyse d'appel d'un lead, section « La découverte » (Romain, 2026-11-20) : la frise de la découverte (chaque question
   à son heure, la lettre SPIN dans la couleur de son sujet, l'heure dessous), la colonne Profondeur en échelle de 0 à 10, et la
   question choisie lue dans un panneau à droite (frise ou tableau), qui se remplace d'une lettre à l'autre.
   La vue est lue dans la page construite (window.LNP_CAV dans LNP_CRM_DOC) et jouée sur un enregistrement synthétique.
   Usage : node app/crm/analyse_decouverte_test.js $PWD/app/lnp.html <dossier de sortie> */
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const FILE = process.argv[2], OUT = process.argv[3] || '.';
if (!FILE) { console.error('usage: node app/crm/analyse_decouverte_test.js <app/lnp.html> <dossier>'); process.exit(2); }

// the call analysis view, as embedded in the CRM document of the page
const html = fs.readFileSync(FILE, 'utf8');
const i0 = html.indexOf('window.LNP_CRM_DOC = "'), i1 = html.indexOf('";</script>', i0);
const doc = JSON.parse(html.slice(i0 + 'window.LNP_CRM_DOC = '.length, i1 + 1));
const k = doc.indexOf('window.LNP_CAV'), s0 = doc.lastIndexOf('<script>', k) + 8, e0 = doc.indexOf('</script>', k);
const view = doc.slice(s0, e0);

// a synthetic R1: twelve turns, six questions of discovery (four subjects) and two other questions, 14 minutes of discovery
const T = (id, ts, role, text) => ({ id, ts, role, speaker: role === 'SALES' ? 'Yanis' : 'Camille', text, repaired: false, attribution_doubtful: false });
const turns = [
  T('T001', '00:00:05', 'SALES', 'Bonjour Camille, merci d’être là. On a trente minutes, ça te va ?'), T('T002', '00:00:12', 'PROSPECT', 'Oui, très bien.'),
  T('T003', '00:01:10', 'SALES', 'Alors dis-moi, tu enseignes depuis combien de temps ?'), T('T004', '00:01:18', 'PROSPECT', 'Je suis prof des écoles depuis huit ans, à Nantes.'),
  T('T005', '00:03:40', 'SALES', 'Et aujourd’hui, qu’est-ce qui coince avec les cours particuliers ?'), T('T006', '00:03:52', 'PROSPECT', 'J’ai du mal à trouver des élèves, c’est épuisant.'),
  T('T007', '00:06:05', 'SALES', 'Ça te coûte quoi, concrètement, chaque mois ?'), T('T008', '00:06:20', 'PROSPECT', 'Facilement 400 euros de moins que ce que je pourrais faire.'),
  T('T009', '00:08:30', 'SALES', 'Et si tu avais cinq élèves réguliers, ça changerait quoi pour vous ?'), T('T010', '00:08:45', 'PROSPECT', 'On pourrait enfin mettre de côté pour la maison.'),
  T('T011', '00:11:15', 'SALES', 'Tu as déjà regardé des formations pour ça ?'), T('T012', '00:11:30', 'PROSPECT', 'Non, jamais.'),
  T('T013', '00:13:50', 'SALES', 'Est-ce que ça te parle, ce que je te décris ?'), T('T014', '00:14:00', 'PROSPECT', 'Oui.'),
  T('T015', '00:15:00', 'SALES', 'Alors je t’explique comment on travaille : l’accompagnement dure quatre mois, c’est 3 000 euros.'), T('T016', '00:15:30', 'PROSPECT', 'D’accord.'),
];
const Q = (id, turn, ts, letter, register, answers, out_reason) => ({ id, turn, ts, letter, gate_letter: letter, out_reason: out_reason || null, tags: [], in_perimeter: true, status: 'coded', answer_turns: answers, followed_up: false, register: register, register_status: register ? 'verified' : null });
const sols = [
  Q('Q003.1', 'T003', '00:01:10', 'S', 'identity_status', ['T004']), Q('Q005.1', 'T005', '00:03:40', 'P', 'mental_emotional', ['T006']),
  Q('Q007.1', 'T007', '00:06:05', 'I', 'financial', ['T008']), Q('Q009.1', 'T009', '00:08:30', 'N', 'financial', ['T010']),
  Q('Q011.1', 'T011', '00:11:15', 'S', 'other', ['T012']), Q('Q013.1', 'T013', '00:13:50', 'OUT', null, ['T014'], 'agreement'),
];
const E = (turn, ts, quote, atom, question_id, question_letter, quantified) => ({ turn, ts, quote, atom, question_id, question_letter, quantified: !!quantified, domain: null, speaker: 'PROSPECT' });
const record = {
  job: 'j1', call_id: 'c1', status: 'ok', flags: [], provisional: false, created_at: '2026-11-20T08:00:00Z', turns,
  phases: { discovery_start: 'T003', discovery_end: 'T015', pitch_start: 'T015', pitch_end: 'T016', first_price: 'T015', offer_mentions: [], flags: [], early_price: null, decision_request: null },
  meta: { round: 'R1', duration_seconds: 930 },
  results: {
    SPIN: { competence: 'SPIN', rules_version: 'v1.3', status: 'scored', verdict: null, reasons: [], score: 62, items: {}, flags: [],
      details: { perimeter: { start: 'T003', end: 'T015', reopenings: [] }, solicitations: sols, chains: [{ opening: 'Q005.1', links: ['Q005.1', 'Q007.1', 'Q009.1'], deep: true, broken_at: null }],
        registers: { counts: {}, agreement: 1, flags: [] },
        items_evidence: { D1: { level: 'ok', evidence: [E('T004', '00:01:18', 'Je suis prof des écoles depuis huit ans', 'SITUATION', 'Q003.1', 'S')] },
          D2: { level: 'ok', evidence: [E('T006', '00:03:52', 'J’ai du mal à trouver des élèves, c’est épuisant', 'PAIN', 'Q005.1', 'P')] },
          D3: { level: 'ok', evidence: [E('T008', '00:06:20', '400 euros de moins', 'IMPACT', 'Q007.1', 'I', true), E('T010', '00:08:45', 'mettre de côté pour la maison', 'DESIRE', 'Q009.1', 'N')] } },
        diagnostics: {}, health: {}, unit_status: {} } },
    GAP: { competence: 'GAP', status: 'not_applicable', reasons: ['no_restitution'], score: null, details: {} },
    PITCH: { competence: 'PITCH', status: 'not_applicable', reasons: [], score: null, details: {} },
    OBJECTIONS: { competence: 'OBJECTIONS', status: 'not_applicable', reasons: [], score: null, details: {} },
  },
};
const page = '<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Analyse</title><style>body{margin:0;background:#F4F6FB;padding:20px}#wrap{max-width:1180px;margin:0 auto}</style></head><body><div id="wrap"><div class="cav" id="caLead" data-cycle="x"></div></div>' +
  '<script>' + view + '</script><script>var REC = ' + JSON.stringify(record) + '; var UI = {};' +
  'function repaint(){ document.getElementById("caLead").innerHTML = window.LNP_CAV.html(REC, UI); }' +
  'document.addEventListener("click", function (e) { var b = e.target.closest("button"); if (!b) return; if (b.hasAttribute("data-cav-sol")) { var id = b.getAttribute("data-cav-sol"); UI.sol = id && UI.sol !== id ? id : null; return repaint(); } });' +
  'repaint();</script></body></html>';
fs.mkdirSync(OUT, { recursive: true });
const PAGE = path.join(OUT, 'analyse-decouverte.html'); fs.writeFileSync(PAGE, page);

(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/ERR_FAILED/.test(m.text())) errs.push(m.text()); });
  await p.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await p.goto('file://' + PAGE); await p.waitForSelector('.fr');
  const ok = [], bad = []; const check = (n, c, d) => (c ? ok : bad).push(n + (c ? '' : ' :: ' + JSON.stringify(d)));
  const t0 = await p.textContent('.fr');
  check('la frise : du début à la fin de la découverte, sa durée, le nombre de questions', /01:10 → 15:00/.test(t0) && /13 min 50/.test(t0) && /6 questions/.test(t0), t0.slice(0, 160));
  const labels = await p.$$eval('.frt .fl', e => e.map(x => x.textContent));
  check('une lettre par question, l’heure sous chacune (espacées)', (await p.$$eval('.frt .fc', e => e.length)) === 6 && ['01:10', '03:40', '06:05', '08:30', '11:15', '13:50'].every(x => labels.includes(x)), labels);
  const colors = await p.$$eval('.frt .fc:not(.o)', e => e.map(x => [x.textContent, getComputedStyle(x).backgroundColor]));
  check('la couleur de la lettre est celle du sujet (Financier bleu, Mental noir, Identité bleu nuit)', colors.some(c => c[0] === 'I' && c[1] === 'rgb(43, 108, 245)') && colors.some(c => c[0] === 'P' && c[1] === 'rgb(16, 21, 37)') && colors.some(c => c[0] === 'S' && c[1] === 'rgb(30, 42, 94)'), colors);
  check('la question hors SPIN : un petit repère hachuré', (await p.$$eval('.frt .fc.o', e => e.length)) === 1, null);
  check('l’axe : une graduation toutes les 5 minutes (05:00, 10:00, 15:00)', (await p.$$eval('.frt .ft', e => e.length)) === 3 && ['05:00', '10:00', '15:00'].every(x => labels.includes(x)), labels);
  check('le panneau de droite vide au départ', /Cliquez sur une lettre/.test(await p.textContent('#cav-sol-pane')), null);
  const head = await p.textContent('.cav table thead');
  check('le tableau : Sujet abordé, Questions posées, Ce qu’il a confié, Profondeur', /Sujet abordé/.test(head) && /Ce qu’il a confié/.test(head) && /Profondeur/.test(head), head);
  const prof = await p.$$eval('.cav .scb', e => e.map(x => x.parentElement.getAttribute('title')));
  check('Profondeur : une échelle de 10 segments par sujet questionné (pas pour « Temps et charge », sans question), le calcul en infobulle', prof.length === 4 && prof.every(t => /Profondeur \d+ sur 10/.test(t)) && (await p.$$eval('.cav .scb i', e => e.length)) === 40, prof);
  const fin = prof.find(t => /2 faits/.test(t));
  check('Financier : 2 faits, 1 douleur ou blocage, 1 désir, chiffré, chaîne approfondie, implication et bénéfice → 10/10', !!fin && /Profondeur 10 sur 10/.test(fin) && /chiffré/.test(fin) && /1 chaîne approfondie/.test(fin) && /question d’implication/.test(fin), fin);
  check('Identité : 1 fait sans douleur → 2/10', prof.some(t => /Profondeur 2 sur 10 : 1 fait \(\+1,5\)/.test(t)), prof);
  check('Autre : rien de retenu → 0/10', prof.some(t => /Profondeur 0 sur 10/.test(t)), prof);
  const states = await p.$$eval('.cav .scb', e => e.map(x => x.parentElement.nextElementSibling && x.parentElement.nextElementSibling.textContent));
  check('l’état (Effleuré, Chiffré, Approfondi…) reste sous l’échelle', states.includes('Approfondi') && states.includes('Rien de retenu'), states);
  await p.screenshot({ path: path.join(OUT, 'analyse-decouverte-01.png') });
  await p.click('.frt .fc[data-cav-sol="Q007.1"]'); await p.waitForSelector('.pane:not(.empty)');
  let t = await p.textContent('#cav-sol-pane');
  check('un clic sur la frise : la question et la réponse à droite, avec le sujet', /Question 3 · Implication/.test(t) && /à 06:05/.test(t) && /Financier/.test(t) && /400 euros de moins/.test(t) && /Retenu dans la réponse/.test(t), t.slice(0, 240));
  check('la lettre est marquée choisie sur la frise et dans le tableau', (await p.$$eval('[data-cav-sol="Q007.1"][aria-expanded="true"]', e => e.length)) === 2, null);
  check('la frise et le tableau restent à gauche, le panneau à droite', (await p.$eval('.cav .disc', e => getComputedStyle(e).gridTemplateColumns.split(' ').length)) === 2 && !(await p.$('.cav table .pane')), null);
  await p.screenshot({ path: path.join(OUT, 'analyse-decouverte-02.png') });
  await p.click('.cav table .chip[data-cav-sol="Q005.1"]'); await p.waitForFunction(() => /Question 2/.test(document.querySelector('#cav-sol-pane').textContent));
  t = await p.textContent('#cav-sol-pane');
  check('une autre lettre, d’un autre sujet, remplace le panneau', /Question 2 · Problème/.test(t) && /Mental et émotionnel/.test(t) && /épuisant/.test(t), t.slice(0, 200));
  await p.click('#cav-sol-pane [data-cav-sol=""]'); await p.waitForSelector('.pane.empty');
  check('« Fermer » vide le panneau', true, null);
  await p.click('.frt .fc.o'); await p.waitForSelector('.pane:not(.empty)');
  check('une autre question (accord) s’ouvre aussi', /Autre question · demande d’accord|Autre question · demande d'accord/.test(await p.textContent('#cav-sol-pane')), await p.textContent('#cav-sol-pane'));
  const txt = await p.evaluate(() => document.body.innerText);
  check('pas d’anglais à l’écran', !/closer|closing|discovery|loading/i.test(txt), (txt.match(/.{0,30}(closer|closing|discovery|loading).{0,30}/i) || [])[0]);
  await p.setViewportSize({ width: 820, height: 900 }); await p.waitForTimeout(100);
  check('écran étroit : une seule colonne', (await p.$eval('.cav .disc', e => getComputedStyle(e).gridTemplateColumns.split(' ').length)) === 1, null);
  check('aucune erreur dans la console', errs.length === 0, errs);
  ok.forEach(x => console.log('OK  ' + x)); bad.forEach(x => console.log('BAD ' + x));
  console.log(ok.length + ' contrôles réussis, ' + bad.length + ' en échec');
  await b.close(); process.exit(bad.length ? 1 : 0);
})();
