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
  T('T015', '00:14:20', 'SALES', 'Si je résume : tu es à 300 euros par mois, tu veux atteindre 1 200 euros, ce qui te bloque c’est de trouver des élèves, et ça te coûte 400 euros de moins chaque mois. C’est bien ça ?'),
  T('T016', '00:14:40', 'PROSPECT', 'Oui, c’est ça, et surtout le temps que je perds.'),
  T('T017', '00:15:00', 'SALES', 'Alors je t’explique comment on travaille : l’accompagnement dure quatre mois, c’est 3 000 euros.'), T('T018', '00:15:30', 'PROSPECT', '3 000 euros, c’est beaucoup pour nous.'),
  T('T019', '00:15:40', 'SALES', 'Je comprends, c’est une vraie somme. Si on met le prix de côté une seconde, est-ce que le programme te paraît être la bonne solution ?'), T('T020', '00:15:55', 'PROSPECT', 'Oui, ça oui.'),
  T('T021', '00:16:05', 'SALES', 'Qu’est-ce qui te fait dire que c’est beaucoup, par rapport à quoi ?'), T('T022', '00:16:15', 'PROSPECT', 'Par rapport à ce que je gagne avec les cours, 300 euros par mois.'),
  T('T023', '00:16:30', 'SALES', 'Alors en deux fois 1 500 euros sans frais, avec cinq élèves la mise est récupérée au troisième mois.'), T('T024', '00:16:45', 'PROSPECT', 'Ok, dit comme ça, ça va.'),
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
  phases: { discovery_start: 'T003', discovery_end: 'T015', pitch_start: 'T017', pitch_end: 'T018', first_price: 'T017', offer_mentions: [], flags: [], early_price: null, decision_request: null },
  meta: { round: 'R1', duration_seconds: 930 },
  results: {
    SPIN: { competence: 'SPIN', rules_version: 'v1.3', status: 'scored', verdict: null, reasons: [], score: 62, items: {}, flags: [],
      details: { perimeter: { start: 'T003', end: 'T015', reopenings: [] }, solicitations: sols, chains: [{ opening: 'Q005.1', links: ['Q005.1', 'Q007.1', 'Q009.1'], deep: true, broken_at: null }],
        registers: { counts: {}, agreement: 1, flags: [] },
        items_evidence: { D1: { level: 'ok', evidence: [E('T004', '00:01:18', 'Je suis prof des écoles depuis huit ans', 'SITUATION', 'Q003.1', 'S')] },
          D2: { level: 'ok', evidence: [E('T006', '00:03:52', 'J’ai du mal à trouver des élèves, c’est épuisant', 'PAIN', 'Q005.1', 'P')] },
          D3: { level: 'ok', evidence: [E('T008', '00:06:20', '400 euros de moins', 'IMPACT', 'Q007.1', 'I', true), E('T010', '00:08:45', 'mettre de côté pour la maison', 'DESIRE', 'Q009.1', 'N')] } },
        diagnostics: {}, health: {}, unit_status: {} } },
    GAP: { competence: 'GAP', status: 'scored', verdict: 'present', reasons: [], score: 70, items: [], flags: [],
      details: { verdict: 'present', gap: { problem: [{ quote: 'J’ai du mal à trouver des élèves', turn: 'T006' }], gap_value: 900 }, cost: [{ quote: '400 euros de moins', turn: 'T008', quantified: true }],
        selected_A: { quote: '300 euros par mois', turn: 'T008', quantified: true }, selected_B: { quote: 'mettre de côté pour la maison', turn: 'T010', quantified: false, horizon: null }, selected_P: null,
        restitution: { span: ['T015', 'T015'], turns: ['T015'], is_restitution: true, effective_outcome: 'confirmed_with_content', before_first_pitch: true, before_first_price: true, conformity: { deviations: [], one_go: true },
          clauses: [{ component: 'A', match: 'verbatim', sales_turn: 'T015', sales_quote: 'tu es à 300 euros par mois', source_turn: 'T008', source_quote: 'Facilement 400 euros de moins que ce que je pourrais faire.', key_expression: '300 euros' },
            { component: 'B', match: 'untraced', sales_turn: 'T015', sales_quote: 'tu veux atteindre 1 200 euros', source_turn: 'T010', source_quote: 'On pourrait enfin mettre de côté pour la maison.', key_expression: '1 200 euros' },
            { component: 'PROBLEM', match: 'paraphrased', sales_turn: 'T015', sales_quote: 'ce qui te bloque c’est de trouver des élèves', source_turn: 'T006', source_quote: 'J’ai du mal à trouver des élèves, c’est épuisant.', key_expression: 'trouver des élèves' },
            { component: 'COST', match: 'verbatim', sales_turn: 'T015', sales_quote: 'ça te coûte 400 euros de moins chaque mois', source_turn: 'T008', source_quote: 'Facilement 400 euros de moins que ce que je pourrais faire.', key_expression: '400 euros de moins' }],
          validation: { turn: 'T016', quote: 'Oui, c’est ça, et surtout le temps que je perds.', outcome: 'confirmed_with_content', content_quote: 'surtout le temps que je perds' } },
        restitutions: [], validation_turn: 'T016', roadmap: { count: 0 }, roadmap_blockers: [], absence_reasons: [] } },
    PITCH: { competence: 'PITCH', status: 'not_applicable', reasons: [], score: null, details: {} },
    OBJECTIONS: { competence: 'OBJECTIONS', status: 'scored', reasons: [], score: 75, items: [], flags: [],
      details: { prevention: {}, episodes: [{ id: 'E1', nature: 'objection', subtype: 'money_available', status: 'scored', resistance: { role: 'PROSPECT', turn: 'T018', quote: '3 000 euros, c’est beaucoup pour nous.' },
        response_turns: ['T019', 'T021', 'T023'], acknowledge: true, isolate: true, explore: { asked: true, answered_with_content: true }, gesture_match: { done: true },
        items: [{ id: 'H2', level: 2, evidence: [{ role: 'SALES', turn: 'T019', quote: 'Je comprends, c’est une vraie somme.' }] }, { id: 'H3', level: 2, evidence: [{ role: 'SALES', turn: 'T019', quote: 'Si on met le prix de côté une seconde' }, { role: 'SALES', turn: 'T021', quote: 'par rapport à quoi' }] }, { id: 'H1', level: 2, evidence: [{ role: 'SALES', turn: 'T023', quote: 'en deux fois 1 500 euros sans frais' }] }],
        reaction: { turn: 'T024', level: 'resolved', quote: 'Ok, dit comme ça, ça va.' } }] } },
  },
};
const page = '<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Analyse</title><style>body{margin:0;background:#F4F6FB;padding:20px}#wrap{max-width:1180px;margin:0 auto}</style></head><body><div id="wrap"><div class="cav" id="caLead" data-cycle="x"></div></div>' +
  '<script>' + view + '</script><script>var REC = ' + JSON.stringify(record) + '; var UI = {};' +
  'function repaint(){ document.getElementById("caLead").innerHTML = window.LNP_CAV.html(REC, UI); }' +
  'document.addEventListener("click", function (e) { var b = e.target.closest("button"); if (!b) return; if (b.hasAttribute("data-cav-sol")) { var id = b.getAttribute("data-cav-sol"); UI.sol = id && UI.sol !== id ? id : null; return repaint(); }' +
  ' if (b.dataset.cavG) { var ep = +b.dataset.cavEp, g = b.dataset.cavG; UI.gesture = UI.gesture && UI.gesture.ep === ep && UI.gesture.g === g ? null : { ep: ep, g: g }; return repaint(); } });' +
  'repaint();</script></body></html>';
fs.mkdirSync(OUT, { recursive: true });
const PAGE = path.join(OUT, 'analyse-decouverte.html'); fs.writeFileSync(PAGE, page);

(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/ERR_FAILED/.test(m.text())) errs.push(m.text()); });
  await p.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await p.goto('file://' + PAGE); await p.waitForSelector('.cav table .tk');
  const ok = [], bad = []; const check = (n, c, d) => (c ? ok : bad).push(n + (c ? '' : ' :: ' + JSON.stringify(d)));
  check('plus de frise à part : le temps est dans le tableau', !(await p.$('.fr')), null);
  const head = await p.textContent('#cav-s1 table thead');
  check('le tableau : Sujet abordé, Questions, Profondeur ; plus de colonne « Ce qu’il a confié »', /Sujet abordé/.test(head) && /Questions/.test(head) && !/Questions posées/.test(head) && /Profondeur/.test(head) && !/Ce qu’il a confié/.test(head), head);
  const widths = await p.$$eval('#cav-s1 table thead th', e => e.map(x => x.style.width));
  check('la colonne des questions est la plus large (60 %), Profondeur réduite (18 %)', JSON.stringify(widths) === JSON.stringify(['22%', '60%', '18%']), widths);
  const axe = await p.$$eval('#cav-s1 table thead .tkl', e => e.map(x => [x.textContent, x.style.left]));
  check('l’axe dans l’en-tête : une graduation toutes les 5 minutes de la découverte (01:10 → 14:20)', axe.length === 2 && axe[0][0] === '05:00' && axe[1][0] === '10:00', axe);
  const leg = await p.textContent('#cav-s1');
  check('rien d’expliqué à l’écran : ni la légende des lettres, ni « cliquez », ni l’échelle, ni la définition de la profondeur', !/S Situation/.test(leg) && !/cliquez/i.test(leg) && !/même échelle/.test(leg) && !/intensité émotionnelle/.test(leg), null);
  const tq = await p.getAttribute('#cav-s1 th .th-i', 'title'), tp = await p.$$eval('#cav-s1 th .th-i', e => e[1].getAttribute('title'));
  check('les explications sont dans une fenêtre au survol des titres « Questions » et « Profondeur »', /S Situation · P Problème/.test(tq) && /01:10 → 14:20, à la même échelle/.test(tq) && /intensité émotionnelle/.test(tp) && /Approfondi/.test(tp), [tq, tp]);
  const rows = await p.$$eval('#cav-s1 table tbody tr', e => e.map(r => [r.querySelector('td b') && r.querySelector('td b').textContent, !!r.querySelector('.tk'), [...r.querySelectorAll('.tk .chip')].map(c => [c.textContent, c.style.left, c.className])]));
  check('chaque sujet a sa piste, les questions placées à leur heure sur la même échelle', rows.length === 6 && rows.every(r => r[1]) && rows.filter(r => r[2].length).length === 5, rows.map(r => [r[0], r[2].length]));
  const pos = {}; rows.forEach(r => r[2].forEach(c => { pos[c[1]] = (pos[c[1]] || 0) + 1; }));
  const fin = rows.find(r => r[0] === 'Financier')[2], men = rows.find(r => r[0] === 'Mental et émotionnel')[2];
  const pct = s => parseFloat(s);
  check('les pistes sont alignées : I à 06:05 (Financier) est à 37 % de la découverte, P à 03:40 (Mental) à 19 %, à gauche du I', Math.abs(pct(fin[0][1]) - 37.3) < 1 && Math.abs(pct(men[0][1]) - 19) < 1 && pct(men[0][1]) < pct(fin[0][1]), [fin, men]);
  check('les lettres gardent leur sens : a donné un fait (plein) ou rien retenu (pointillé), autre question', fin.every(c => /cF/.test(c[2])) && rows.find(r => r[0] === 'Autre')[2][0][2].indexOf('cX') >= 0 && rows.find(r => r[0] === 'Autres questions')[2][0][2].indexOf('cO') >= 0, null);
  const tops = await p.$$eval('#cav-s1 table tbody .tk .chip', e => e.map(x => x.style.top));
  check('chaque piste tient sur une seule ligne', tops.length === 6 && tops.every(x => x === '0px'), tops);
  const grid = await p.$$eval('#cav-s1 table tbody .tk .tkt', e => e.length);
  check('les graduations se prolongent dans chaque piste pour lire l’alignement', grid === 6 * 2, grid);
  check('pas de panneau ni de consigne au départ : le tableau prend toute la largeur', !(await p.$('#cav-sol-pane')) && (await p.$eval('.cav .disc', e => getComputedStyle(e).gridTemplateColumns.split(' ').length)) === 1, null);
  const prof = await p.$$eval('.cav .scb', e => e.map(x => x.parentElement.getAttribute('title').replace(/ · (Effleuré|Chiffré|Valeur exprimée|Approfondi|Rien de retenu|Non exploré)$/, '')));
  check('Profondeur : une échelle de 10 segments par sujet questionné (pas pour « Temps et charge », sans question), le calcul en infobulle', prof.length === 4 && prof.every(t => /Profondeur \d+ sur 10/.test(t)) && (await p.$$eval('.cav .scb i', e => e.length)) === 40, prof);
  const finP = prof.find(t => /2 faits/.test(t));
  check('Financier : 2 faits, 1 douleur ou blocage, 1 désir, chiffré, chaîne approfondie, implication et bénéfice → 10/10', !!finP && /Profondeur 10 sur 10/.test(finP) && /chiffré/.test(finP) && /1 chaîne approfondie/.test(finP) && /question d’implication/.test(finP), finP);
  check('Identité : 1 fait sans douleur → 2/10', prof.some(t => /Profondeur 2 sur 10 : 1 fait \(\+1,5\)/.test(t)), prof);
  check('Autre : rien de retenu → 0/10', prof.some(t => /Profondeur 0 sur 10/.test(t)), prof);
  const under = await p.$$eval('.cav .scb', e => e.map(x => x.parentElement.nextElementSibling && x.parentElement.nextElementSibling.textContent));
  const profFull = await p.$$eval('.cav .scb', e => e.map(x => x.parentElement.getAttribute('title')));
  check('sous l’échelle : seulement ce qu’il a confié, l’état au survol', under.includes('1 douleur · 1 désir') && under.includes('1 fait de sa situation') && under.includes('rien de retenu') && !under.some(x => /Approfondi|Effleuré|Rien de retenu/.test(x || '')) && profFull.some(x => / · Approfondi$/.test(x)), [under, profFull]);
  await p.screenshot({ path: path.join(OUT, 'analyse-decouverte-01.png') });
  await p.click('.cav table .tk .chip[data-cav-sol="Q007.1"]'); await p.waitForSelector('#cav-sol-pane');
  let t = await p.textContent('#cav-sol-pane');
  check('un clic sur une lettre de la piste : la question et la réponse à droite, avec le sujet', /Question 3 · Implication/.test(t) && /à 06:05/.test(t) && /Financier/.test(t) && /400 euros de moins/.test(t) && /Retenu dans la réponse/.test(t), t.slice(0, 240));
  check('la lettre est marquée choisie', (await p.$$eval('[data-cav-sol="Q007.1"][aria-expanded="true"]', e => e.length)) === 1, null);
  check('le tableau reste à gauche, le panneau à droite', (await p.$eval('.cav .disc', e => getComputedStyle(e).gridTemplateColumns.split(' ').length)) === 2 && !(await p.$('.cav table .pane')), null);
  await p.screenshot({ path: path.join(OUT, 'analyse-decouverte-02.png') });
  await p.click('.cav table .chip[data-cav-sol="Q005.1"]'); await p.waitForFunction(() => /Question 2/.test(document.querySelector('#cav-sol-pane').textContent));
  t = await p.textContent('#cav-sol-pane');
  check('une autre lettre, d’un autre sujet, remplace le panneau', /Question 2 · Problème/.test(t) && /Mental et émotionnel/.test(t) && /épuisant/.test(t), t.slice(0, 200));
  await p.click('#cav-sol-pane [data-cav-sol=""]'); await p.waitForFunction(() => !document.querySelector('#cav-sol-pane'));
  check('« Fermer » retire le panneau', true, null);
  await p.click('.cav table .chip.cO'); await p.waitForSelector('#cav-sol-pane');
  check('une autre question (accord) s’ouvre aussi', /Autre question · demande d’accord|Autre question · demande d'accord/.test(await p.textContent('#cav-sol-pane')), await p.textContent('#cav-sol-pane'));
  // ── 2 · the gap: the whole reformulation on the left, the checklist of its elements on the right
  await p.setViewportSize({ width: 1280, height: 900 });
  const gl = await p.textContent('#cav-s2 .gx2 > .gx-box:first-child'), gr = await p.textContent('#cav-s2 .gx2 > .gx-box:last-child');
  check('l’écart : à gauche la reformulation entière, mot pour mot, avec son heure et la validation', /La reformulation du commercial/.test(gl) && /Si je résume : tu es à 300 euros par mois/.test(gl) && /C’est bien ça \?/.test(gl) && /14:20/.test(gl) && /surtout le temps que je perds/.test(gl), gl.slice(0, 200));
  check('chaque élément repris est surligné dans la reformulation (point A, point B, problème, coût)', (await p.$$eval('#cav-s2 .gx2 > .gx-box:first-child .mk', e => e.length)) >= 5, null);
  check('à droite la liste des éléments : Problème, Coût, Point A, Point B, Validation, et le compte des retrouvés', /Les éléments de l’écart/.test(gr) && /3 sur 5 retrouvés/.test(gr) && ['Problème', 'Coût', 'Point A', 'Point B', 'Validation'].every(x => gr.includes(x)), gr.slice(0, 200));
  const st = await p.$$eval('#cav-s2 .gx-ci', e => e.map(x => [x.className.replace('gx-ci ', ''), x.querySelector('.qx-s').textContent.trim()]));
  check('chaque élément est statué : retrouvé avec ses mots, paraphrase, pas ses mots, validé', JSON.stringify(st) === JSON.stringify([['miss', '✕Paraphrase'], ['ok', '✓Ses mots'], ['ok', '✓Ses mots'], ['miss', '✕Pas ses mots'], ['ok', '✓Validé, avec ses mots']]), st);
  check('pour chaque élément : ce que le prospect a dit, mot pour mot, et ce qui est dans la reformulation', /Le prospect a dit/.test(gr) && /J’ai du mal à trouver des élèves, c’est épuisant/.test(gr) && /Dans la reformulation/.test(gr) && /ce qui te bloque c’est de trouver des élèves/.test(gr) && /03:52/.test(gr), null);
  check('l’écart en deux colonnes', (await p.$eval('#cav-s2 .gx2', e => getComputedStyle(e).gridTemplateColumns.split(' ').length)) === 2, null);
  await (await p.$('#cav-s2')).screenshot({ path: path.join(OUT, 'analyse-ecart.png') });
  // ── 4 · the objections: the letter's passage on the left, whole, following the scroll
  check('objections : ni panneau ni consigne au départ, l’explication des lettres au survol du titre', !(await p.$('#cav-ob-side')) && /A accueillie · I isolée/.test(await p.getAttribute('#cav-s4 th .th-i', 'title')) && !/cliquez/i.test(await p.textContent('#cav-s4')), null);
  await p.click('#cav-s4 .chip[data-cav-ep="0"][data-cav-g="A"]'); await p.waitForSelector('#cav-ob-side');
  let o = await p.textContent('#cav-ob-side');
  check('un clic sur A : le passage à gauche, avec l’objection, le geste et la réponse', /A · Accueillie/.test(o) && /fait/.test(o) && /Argent disponible/.test(o) && /c’est beaucoup pour nous/.test(o) && /Je comprends, c’est une vraie somme/.test(o), o.slice(0, 240));
  const gcols = await p.$eval('#cav-s4 .ob-grid', e => getComputedStyle(e).gridTemplateColumns.split(' '));
  check('le panneau est la colonne de gauche, le tableau à droite', gcols.length === 2 && (await p.$eval('#cav-s4 .ob-grid', e => e.firstElementChild.id)) === 'cav-ob-side', gcols);
  await p.evaluate(() => { document.querySelector('#cav-s4').scrollIntoView(); window.scrollBy(0, 200); }); await p.waitForTimeout(100);
  const box = await p.$eval('#cav-ob-side', e => { const b = e.getBoundingClientRect(); return { top: Math.round(b.top), bottom: Math.round(b.bottom), h: window.innerHeight, sticky: getComputedStyle(e).position, scroll: e.scrollHeight <= e.clientHeight + 1 }; });
  check('le panneau reste entièrement visible à l’écran quand la page défile (collant, sous la barre des notes)', box.sticky === 'sticky' && box.top >= 0 && box.bottom <= box.h && box.scroll, box);
  await p.screenshot({ path: path.join(OUT, 'analyse-objections.png') });
  await p.click('#cav-s4 table .chip[data-cav-g="E"]'); await p.waitForFunction(() => /E · Explorée/.test(document.querySelector('#cav-ob-side').textContent));
  check('une autre lettre remplace le panneau', /par rapport à quoi/.test(await p.textContent('#cav-ob-side')), null);
  await p.click('#cav-ob-side .ob-x'); await p.waitForFunction(() => !document.querySelector('#cav-ob-side'));
  check('la croix referme le panneau', true, null);
  const txt = await p.evaluate(() => document.body.innerText);
  check('pas d’anglais à l’écran', !/closer|closing|discovery|loading/i.test(txt), (txt.match(/.{0,30}(closer|closing|discovery|loading).{0,30}/i) || [])[0]);
  await p.setViewportSize({ width: 820, height: 900 }); await p.waitForTimeout(100);
  check('écran étroit : une seule colonne', (await p.$eval('.cav .disc', e => getComputedStyle(e).gridTemplateColumns.split(' ').length)) === 1, null);
  check('aucune erreur dans la console', errs.length === 0, errs);
  ok.forEach(x => console.log('OK  ' + x)); bad.forEach(x => console.log('BAD ' + x));
  console.log(ok.length + ' contrôles réussis, ' + bad.length + ' en échec');
  await b.close(); process.exit(bad.length ? 1 : 0);
})();
