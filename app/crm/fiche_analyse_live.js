// node app/crm/fiche_analyse_live.js $PWD/app/lnp.html <dossier> — le lien « Analyse » de la fiche d'un lead (Leads et Cycle de vente)
// ouvre l'analyse de l'appel (Découverte SPIN, Écart, Présentation de l'offre, Objections) en plein écran, le nom du lead et la croix
// restant en haut au défilement ; la qualification en tableau, le détail au survol (Romain 2026-11-19). Cycles et analyse simulés.
const { chromium } = require('playwright');
(async () => {
  const OUT = process.argv[3]; const ok = [], bad = []; const check = (n, c, i) => (c ? ok : bad).push(n + (c ? '' : ' → ' + JSON.stringify(i)));
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('file://' + process.argv[2] + '#crm'); await p.waitForTimeout(2500);
  let cf = null; for (const f of p.frames()) { try { if (await f.$('#v-crm')) { cf = f; break; } } catch (e) {} }
  await cf.evaluate(async () => {
    const H = 3600e3, iso = (h) => new Date(Date.now() + h * H).toISOString();
    const cyc = (id, name, o, calls, events, extra) => Object.assign({ id, status: 'active', opened_at: iso(o), owner_id: 'u-r', last_event_at: iso(-1),
      person: { id: 'p' + id, full_name: name, primary_email: id + '@x.com', first_seen_at: iso(o) }, calls, events, deal: null, payments: [] }, extra || {});
    const ev = (type, h, x) => Object.assign({ type, occurred_at: iso(h), source: 'crm', actor: 'sales', data: {} }, x || {});
    const board = [
      cyc('c1', 'Paul Payé', -100, [{ id: 'k1', rank: 1, status: 'held', scheduled_start: iso(-80), scheduled_end: iso(-79) }],
        [ev('call_booked', -100, { call_id: 'k1', source: 'iclosed', actor: 'prospect' }), ev('message_out', -99), ev('outcome_yes', -79, { call_id: 'k1', data: { amount_sold: 3400 } }),
         ev('payment_succeeded', -70, { actor: 'prospect', data: { amount: 850 } })]),
      cyc('c2', 'Nora Absente', -40, [{ id: 'k2', rank: 1, status: 'no_show', scheduled_start: iso(-20), scheduled_end: iso(-19) }],
        [ev('call_booked', -40, { call_id: 'k2', source: 'iclosed', actor: 'prospect' }), ev('message_out', -39), ev('message_in', -38, { actor: 'prospect' }), ev('message_out', -18)]),
      cyc('c3', 'Rémi Refus', -60, [{ id: 'k3', rank: 1, status: 'held', scheduled_start: iso(-40), scheduled_end: iso(-39) }],
        [ev('call_booked', -60, { call_id: 'k3', source: 'iclosed', actor: 'prospect' }), ev('message_out', -59),
         ev('outcome_no', -39, { call_id: 'k3', data: { reason_code: 'price' } })]),
      cyc('c4', 'Dina Disq', -60, [{ id: 'k4', rank: 1, status: 'held', scheduled_start: iso(-40), scheduled_end: iso(-39) }],
        [ev('call_booked', -60, { call_id: 'k4', source: 'iclosed', actor: 'prospect' }), ev('outcome_disqualified', -39, { call_id: 'k4', data: { reason_code: 'off_target' } })]),
      cyc('c5', 'Céline Confirmée', -10, [{ id: 'k5', rank: 1, status: 'scheduled', scheduled_start: iso(20), scheduled_end: iso(21) }],
        [ev('call_booked', -10, { call_id: 'k5', source: 'iclosed', actor: 'prospect' }), ev('message_out', -9.5)]),
      // a refusal 190 days ago with no new RDV: out of « Relance après refus », disqualified (055)
      cyc('c6', 'Simon Six Mois', -4600, [{ id: 'k6', rank: 1, status: 'held', scheduled_start: iso(-4580), scheduled_end: iso(-4579) }],
        [ev('call_booked', -4600, { call_id: 'k6', source: 'iclosed', actor: 'prospect' }), ev('outcome_no', -4560, { call_id: 'k6', data: { reason_code: 'price' } })]),
      // lost without any call held (an old import never reached): « Perdu », not a refusal, no branch
      cyc('c7', 'Pierre Perdu', -900, [], [ev('call_booked', -900, { source: 'import', actor: 'prospect' }), ev('cycle_lost', -800, { source: 'import', data: { reason: 'timing' } })], { status: 'lost' })
    ];
    const fake = {
      listMembers: async () => [{ id: 'u-r', member_key: 'romain', full_name: 'Romain', role: 'admin', active: true }],
      listNoBooking: async () => [], me: async () => ({ id: 'u-r', member_key: 'romain', role: 'admin' }),
      salesCycleView: window.parent.LNP_CRM.salesCycleView, reasonLabel: window.parent.LNP_CRM.reasonLabel,
      listBoard: async () => board, listReasons: async () => [], addNote: async () => 1, subscribe: () => () => {},
      setterAction: async () => ({}), setSetter: async () => null, createLead: async () => 'new',
      caBoard: async () => [{ cycle_id: 'c1', call_id: 'k1', round: 1, start: iso(-80), status: 'done', job: 'j1', done_job: 'j1', transcript: true, scores: { SPIN: { score: 64, status: 'scored' }, GAP: { score: 50, status: 'scored', verdict: 'partial' }, PITCH: { score: 70, status: 'scored' }, OBJECTIONS: { score: 40, status: 'scored' } } }, { cycle_id: 'c2', call_id: 'k2', round: 1, start: iso(-20), status: 'done', job: 'j2', done_job: 'j2', transcript: true, scores: { SPIN: { score: 58, status: 'scored' } } }],
      caRecord: async () => ({ status: 'ok', flags: [], meta: { duration: '45:00', person: 'Paul Payé' },
        phases: { discovery_start: 'T010', discovery_end: 'T041', pitch_start: 'T050', first_price: 'T060' },
        qualification: { status: 'À REVOIR', rules_version: 'qualification_lnp-v2.2', result: { statut: 'À REVOIR', confiance: 'basse', solution_aware: false, base: { motif: 'Portes à vérifier : Porte 3 — Décision et timing' }, portes: { metier: { statut: 'OUVERTE', raisons: [], preuve: 'je suis professeur de maths au lycée [00:15] / je donne aussi des cours le soir [02:10]' }, financement: { statut: 'FERMÉE', raisons: ['Aucune ressource : au RSA'], preuve: 'Je suis au RSA en ce moment [31:02]' }, decision_timing: { statut: 'NON VÉRIFIÉE', raisons: ['Date ou délai de démarrage non établi'], preuve: 'Je vais réfléchir [44:30]' } }, alertes: ['Synthèse des portes absente en fin de découverte', 'Contradiction du prospect : dit ne rien avoir puis cite une épargne'] } },
        results: { SPIN: { competence: 'SPIN', status: 'scored', score: 64, items: [], details: {
            solicitations: [{ id: 'Q005', letter: 'S', turn: 'T005', answer_turns: ['T010'], in_perimeter: true, ts: '00:04:50' }, { id: 'Q015', letter: 'P', turn: 'T015', answer_turns: ['T020'], in_perimeter: true, ts: '00:07:40' }],
            items_evidence: { S1: { evidence: [{ atom: 'SITUATION', domain: 'revenus', turn: 'T010', quote: 'ça me rapporte 300 euros par mois', question_id: 'Q005', quantified: true }] },
              P1: { evidence: [{ atom: 'BLOCKER', domain: 'vente', turn: 'T020', quote: 'Je ne sais pas me vendre', question_id: 'Q015' }] } } } },
          OBJECTIONS: { competence: 'OBJECTIONS', status: 'scored', score: 62, reasons: [], details: { prevention: {}, episodes: [
            { nature: 'objection', subtype: 'price', resistance: { turn: 'T061', quote: 'C’est quand même cher pour moi' }, reaction: { turn: 'T063', quote: 'D’accord, ça me paraît plus clair', level: 'resolved' },
              acknowledge: { done: true }, isolate: { done: false }, explore: { asked: true, answered_with_content: true }, gesture_match: { level: 2 },
              items: [{ id: 'H2', evidence: [{ turn: 'T062', role: 'SALES', quote: 'Je comprends tout à fait' }] }], response_turns: ['T062'] },
            { nature: 'objection', subtype: 'co_decider', resistance: { turn: 'T064', quote: 'Je dois en parler à ma femme' }, reaction: { turn: 'T066', quote: 'Oui, on peut se rappeler jeudi', level: 'persisting' },
              acknowledge: { done: true }, isolate: { done: true }, explore: { asked: false }, gesture_match: { level: 0 },
              items: [{ id: 'H2', evidence: [{ turn: 'T065', role: 'SALES', quote: 'C’est normal d’en parler à deux' }] }], response_turns: ['T065'] }] } },
          GAP: { competence: 'GAP', status: 'scored', verdict: 'present', score: 55, reasons: [],
            items: [{ id: 'G1', weight: 10, level: 2 }, { id: 'G2', weight: 10, level: 2 }, { id: 'G3', weight: 10, level: 2 }, { id: 'G4', weight: 20, level: 0 }, { id: 'G5', weight: 25, level: 1 }, { id: 'G6', weight: 25, level: 1 }],
            details: { verdict: 'present', gap: { gap_value: 1200 },
              selected_A: { turn: 'T010', quote: 'Aujourd’hui j’ai trois élèves, ça me rapporte 300 euros par mois', quantified: true },
              selected_B: { turn: 'T030', quote: 'Je voudrais arriver à 1 500 euros par mois d’ici juin', quantified: true, horizon: 'juin' },
              selected_P: { turn: 'T020', quote: 'Je ne sais pas me vendre auprès des parents' },
              cost: [{ turn: 'T025', quote: 'Ça me prend tous mes week-ends pour presque rien', quantified: false }],
              roadmap: { count: 2 },
              restitution: { span: ['T040', 'T040'], turns: ['T040'], is_restitution: true, before_first_pitch: true, before_first_price: true,
                conformity: { one_go: true, deviations: [] }, effective_outcome: 'confirmed',
                validation: { turn: 'T041', quote: 'Oui, c’est exactement ça', outcome: 'confirmed' },
                clauses: [
                  { component: 'A', match: 'verbatim', key_expression: '300 euros par mois', sales_turn: 'T040', sales_quote: 'tu es à 300 euros par mois', source_turn: 'T010', source_quote: 'Aujourd’hui j’ai trois élèves, ça me rapporte 300 euros par mois' },
                  { component: 'B', match: 'verbatim', key_expression: '1 500 euros par mois', sales_turn: 'T040', sales_quote: 'tu veux arriver à 1 500 euros par mois', source_turn: 'T030', source_quote: 'Je voudrais arriver à 1 500 euros par mois d’ici juin' },
                  { component: 'PROBLEM', match: 'verbatim', key_expression: 'me vendre', sales_turn: 'T040', sales_quote: 'ce qui te bloque, c’est que tu ne sais pas te vendre', source_turn: 'T020', source_quote: 'Je ne sais pas me vendre auprès des parents' },
                  { component: 'COST', match: 'paraphrased', key_expression: null, sales_turn: 'T040', sales_quote: 'et ça te fatigue beaucoup', source_turn: 'T025', source_quote: 'Ça me prend tous mes week-ends pour presque rien', reason: 'paraphrased' }] } } } },
        turns: [
          { id: 'T001', role: 'SALES', speaker: 'Romain', ts: '00:00:04', text: 'Bonjour Paul, merci d’être là.' },
          { id: 'T005', role: 'SALES', speaker: 'Romain', ts: '00:04:50', text: 'Combien d’élèves avez-vous aujourd’hui ?' },
          { id: 'T010', role: 'PROSPECT', speaker: 'Paul', ts: '00:05:10', text: 'Aujourd’hui j’ai trois élèves, ça me rapporte 300 euros par mois.' },
          { id: 'T015', role: 'SALES', speaker: 'Romain', ts: '00:07:40', text: 'Qu’est-ce qui vous bloque pour trouver des élèves ?' },
          { id: 'T020', role: 'PROSPECT', speaker: 'Paul', ts: '00:08:00', text: 'Je ne sais pas me vendre auprès des parents.' },
          { id: 'T025', role: 'PROSPECT', speaker: 'Paul', ts: '00:10:00', text: 'Ça me prend tous mes week-ends pour presque rien.' },
          { id: 'T030', role: 'PROSPECT', speaker: 'Paul', ts: '00:12:00', text: 'Je voudrais arriver à 1 500 euros par mois d’ici juin.' },
          { id: 'T040', role: 'SALES', speaker: 'Romain', ts: '00:20:00', text: 'Si je résume : tu es à 300 euros par mois, tu veux arriver à 1 500 euros par mois, ce qui te bloque, c’est que tu ne sais pas te vendre, et ça te fatigue beaucoup.' },
          { id: 'T041', role: 'PROSPECT', speaker: 'Paul', ts: '00:20:40', text: 'Oui, c’est exactement ça.' },
          { id: 'T050', role: 'SALES', speaker: 'Romain', ts: '00:25:00', text: 'Je vous présente l’accompagnement.' },
          { id: 'T060', role: 'SALES', speaker: 'Romain', ts: '00:35:00', text: 'L’investissement est de 3 000 euros.' },
          { id: 'T061', role: 'PROSPECT', speaker: 'Paul', ts: '00:36:00', text: 'C’est quand même cher pour moi.' },
          { id: 'T062', role: 'SALES', speaker: 'Romain', ts: '00:36:20', text: 'Je comprends tout à fait. Qu’est-ce qui vous fait dire que c’est cher ?' },
          { id: 'T063', role: 'PROSPECT', speaker: 'Paul', ts: '00:37:30', text: 'D’accord, ça me paraît plus clair.' },
          { id: 'T064', role: 'PROSPECT', speaker: 'Paul', ts: '00:40:00', text: 'Je dois en parler à ma femme.' },
          { id: 'T065', role: 'SALES', speaker: 'Romain', ts: '00:40:15', text: 'C’est normal d’en parler à deux. À part ça, tout vous convient ?' },
          { id: 'T066', role: 'PROSPECT', speaker: 'Paul', ts: '00:41:00', text: 'Oui, on peut se rappeler jeudi.' },
          { id: 'T070', role: 'PROSPECT', speaker: 'Paul', ts: '00:45:00', text: 'Merci, je vous redis.' }] })
    };
    // the analysis window reads the CRM of the page (window.parent.LNP_CRM): the same simulated analysis
    window.parent.LNP_CRM.caBoard = fake.caBoard; window.parent.LNP_CRM.caRecord = fake.caRecord;
    await window.lnpCrmLive(fake);
  });
  await p.waitForTimeout(1200);
  const win = () => cf.evaluate(() => { const w = document.querySelector('.ca-scrim'); if (!w) return null; const r = w.querySelector('.ca-dlg').getBoundingClientRect();
    const top = document.elementFromPoint(r.left + r.width / 2, r.top + 40); return { txt: w.innerText, z: +getComputedStyle(w).zIndex, onTop: !!(top && w.contains(top)) }; });
  // Leads › fiche › « Analyse »
  await cf.evaluate(() => openLead('c1')); await p.waitForTimeout(900);
  await cf.click('#layer .ls-calls [data-ca]'); await p.waitForTimeout(1200);
  let w = await win();
  check('Leads : « Analyse » ouvre la fenêtre de l’analyse', !!w, null);
  check('la fenêtre montre l’analyse : Découverte, Écart, Présentation de l’offre, Objections', w && /DÉCOUVERTE/i.test(w.txt) && /ÉCART/i.test(w.txt) && /PRÉSENTATION DE L.OFFRE/i.test(w.txt) && /OBJECTIONS/i.test(w.txt), w && w.txt.slice(0, 300));
  check('l’analyse est au-dessus de la fiche', w && w.onTop, w && w.z);
  const lay = await cf.evaluate(() => { const w = document.querySelector('.ca-scrim'), d = w.querySelector('.ca-dlg').getBoundingClientRect();
    return { w: d.width, vw: innerWidth, top: d.top, left: d.left }; });
  check('l’analyse prend tout l’écran, comme un nouvel écran', Math.abs(lay.w - lay.vw) < 20 && lay.top < 4 && lay.left < 4, lay);
  const rows = await cf.$$eval('.ca-scrim table.qx tbody tr', rs => rs.map(r => r.innerText.replace(/\s+/g, ' ').trim()));
  check('qualification : un tableau, une ligne par critère (Métier, Financement, Décision et timing)', rows.length === 3 && /^Métier/.test(rows[0]) && /^Financement/.test(rows[1]) && /^Décision et timing/.test(rows[2]), rows);
  check('qualification : validé, invalidé, à vérifier, avec une raison courte', /Validé/.test(rows[0]) && /Invalidé/.test(rows[1]) && /Aucune ressource/.test(rows[1]) && /À vérifier/.test(rows[2]), rows);
  // l'écart : la chronologie lisible, le tableau élément par élément, ce qui manque
  const gx = await cf.evaluate(() => { const c = [...document.querySelectorAll('.ca-scrim .card')].find(x => /L'écart reformulé/.test(x.textContent)); if (!c) return null;
    return { leg: [...c.querySelectorAll('.gx-ev')].map(e => e.innerText.replace(/\s+/g, ' ')), rows: [...c.querySelectorAll('.gx3 > .gx-box:last-child .gx-nd')].map(r => r.innerText.replace(/\s+/g, ' ')), refo: (c.querySelector('.gx3 > .gx-box:first-child') || {}).innerText.replace(/\s+/g, ' ') || '',
      todo: [...c.querySelectorAll('.gx-todo li')].map(l => l.innerText.replace(/\s+/g, ' ')), formula: (c.querySelector('.gx-formula') || {}).innerText || '' }; });
  check('écart : la légende de la chronologie, un repère par case avec son heure', gx && gx.leg.length === 5 && /Découverte 05:10/.test(gx.leg[0]) && /Reformulation 20:00/.test(gx.leg[1]) && /Validation 20:40/.test(gx.leg[2]) && /Prix 35:00/.test(gx.leg[4]), gx && gx.leg);
  check('écart : à gauche la reformulation en un seul texte, les étapes surlignées, puis la validation ; à droite les mots exacts du lead par étape, statués', gx && /la reformulation/i.test(gx.refo) && /tu ne sais pas te vendre/.test(gx.refo) && /ça te fatigue/.test(gx.refo) && /Oui, c’est exactement ça/.test(gx.refo) && gx.rows.length === 5 && gx.rows.some(r => /^Problème/.test(r) && /Ses mots/.test(r) && /me vendre/.test(r)) && gx.rows.some(r => /^Coût/.test(r) && /Paraphrase/.test(r) && /tous mes week-ends/.test(r)) && gx.rows.some(r => /^Validation/.test(r) && /« oui »/.test(r)), gx && [gx.refo.slice(0, 300), gx.rows]);
  check('écart : ce qui manque pour un écart parfait, avec les points à gagner', gx && gx.todo.some(t => /chiffrer ce coût/.test(t) && /\+20/.test(t)) && gx.todo.some(t => /Reprendre ce coût avec ses mots/.test(t)) && gx.todo.some(t => /validation dans ses mots/.test(t) && /\+13/.test(t)), gx && gx.todo);
  check('écart : la reformulation parfaite remplie avec ses mots', gx && /300 euros par mois/.test(gx.formula) && /1 500 euros par mois/.test(gx.formula) && /me vendre/.test(gx.formula), gx && gx.formula);
  if (OUT) { await cf.evaluate(() => { const c = [...document.querySelectorAll('.ca-scrim .card')].find(x => /L'écart reformulé/.test(x.textContent)); c.scrollIntoView(); document.querySelector('.ca-scrim').scrollTop -= 110; }); await p.waitForTimeout(200); await p.screenshot({ path: OUT + '/ecart.png', fullPage: false }); await cf.evaluate(() => document.querySelector('.ca-scrim').scrollTop += 560); await p.waitForTimeout(200); await p.screenshot({ path: OUT + '/ecart-manque.png' }); }
  // découverte : une lettre SPIN montre la question et la réponse en clair, les répliques autour atténuées (une couleur lisible, pas une opacité)
  await cf.click('.ca-scrim [data-cav-sol="Q015"]'); await p.waitForTimeout(300);
  const sp = await cf.evaluate(() => { const r = document.querySelector('.ca-scrim [data-cav-sol=""]'); const box = r && r.closest('#cav-sol-pane'); return box ? [...box.querySelectorAll('.row')].map(x => ({ id: x.dataset.tid, dim: x.classList.contains('dim'), op: getComputedStyle(x.querySelector('.tx')).color })) : null; });
  check('découverte : la lettre P montre la question et la réponse en clair dans le panneau de droite, les répliques autour atténuées', sp && sp.filter(r => !r.dim).map(r => r.id).join() === 'T015,T020' && sp.filter(r => r.dim).length >= 3 && sp.filter(r => r.dim).every(r => r.op === 'rgb(90, 100, 120)'), sp);
  if (OUT) { await cf.evaluate(() => document.querySelector('.ca-scrim [data-cav-sol=""]').closest('#cav-sol-pane').scrollIntoView({ block: 'center' })); await p.waitForTimeout(150); await p.screenshot({ path: OUT + '/spin-lettre.png' }); }
  await cf.click('.ca-scrim [data-cav-sol=""]'); await p.waitForTimeout(200);
  // objections : la lettre ouvre sa citation sous l'objection qui la porte, un second clic la referme
  const obRows = () => cf.evaluate(() => { const c = [...document.querySelectorAll('.ca-scrim .card')].find(x => /Objections/.test((x.querySelector('.serif') || {}).textContent || '') || /^\s*4\s*Objections/.test(x.textContent)); const t = c && c.querySelector('table'); const side = c && c.querySelector('#cav-ob-side'); const ep = side && side.querySelector('.ob-x') ? side.querySelector('.ob-x').dataset.cavEp : null;
    return t ? [...t.querySelectorAll('tbody > tr')].map((r, i) => ({ name: r.querySelector('b').textContent, pan: ep === String(i), txt: ep === String(i) ? side.innerText.replace(/\s+/g, ' ') : '' })) : null; });
  let ob = await obRows();
  check('objections : deux objections, aucun détail ouvert au départ', ob && ob.length === 2 && !ob.some(r => r.pan), ob);
  await cf.click('.ca-scrim [data-cav-ep="1"][data-cav-g="A"]'); await p.waitForTimeout(300);
  ob = await obRows();
  check('objections : la lettre A de la 2e objection ouvre sa citation dans le panneau à gauche du tableau', ob && !ob[0].pan && ob[1].pan && /Accueillie/.test(ob[1].txt) && /parler à deux/.test(ob[1].txt) && (await cf.$eval('.ca-scrim .ob-grid', e => e.firstElementChild.id)) === 'cav-ob-side', ob);
  const obCtx = await cf.evaluate(() => { const e = document.querySelector('.ca-scrim .ob-pan'); return [...e.querySelectorAll('.row')].map(r => ({ id: r.dataset.tid, dim: r.classList.contains('dim'), op: getComputedStyle(r.querySelector('.tx')).color })); });
  check('objections : le passage concerné (résistance et réponse) en clair, les répliques autour atténuées', obCtx.length >= 4 && obCtx.filter(r => !r.dim).map(r => r.id).join() === 'T064,T065' && obCtx.filter(r => r.dim).every(r => r.op === 'rgb(90, 100, 120)') && obCtx.some(r => r.dim && r.id === 'T063') && obCtx.some(r => r.dim && r.id === 'T066'), obCtx);
  const obPop = await cf.evaluate(() => { const e = document.querySelector('.ca-scrim .ob-pan'); return { pos: getComputedStyle(e).position, x: !!e.querySelector('.ob-x'), cols: getComputedStyle(e.parentElement).gridTemplateColumns.split(' ').length }; });
  check('objections : un panneau collant à gauche du tableau, avec une croix', obPop.pos === 'sticky' && obPop.x && obPop.cols === 2, obPop);
  if (OUT) { await cf.evaluate(() => document.querySelector('.ca-scrim .ob-pan').scrollIntoView({ block: 'center' })); await p.waitForTimeout(150); await p.screenshot({ path: OUT + '/objection-lettre.png' }); }
  await cf.click('.ca-scrim [data-cav-ep="1"][data-cav-g="A"]'); await p.waitForTimeout(300);
  ob = await obRows();
  check('objections : un second clic sur la lettre la referme', ob && !ob.some(r => r.pan), ob);
  await cf.click('.ca-scrim [data-cav-ep="0"][data-cav-g="E"]'); await p.waitForTimeout(300);
  ob = await obRows(); const opened = ob && ob[0].pan;
  await cf.click('.ca-scrim .ob-pan .ob-x'); await p.waitForTimeout(300);
  ob = await obRows();
  check('objections : la croix en haut à droite referme la fenêtre', opened && ob && !ob.some(r => r.pan), { opened, ob });
  const pw = await cf.$('.ca-scrim table.qx tbody tr:nth-child(2) .qx-w'); if (!pw) { console.log(bad.join('\n')); console.log((await win()).txt.slice(0, 1500)); process.exit(1); }
  await pw.scrollIntoViewIfNeeded(); await pw.hover(); await p.waitForTimeout(250);
  const pop = await cf.evaluate(() => { const e = document.querySelector('.ca-scrim table.qx tbody tr:nth-child(2) .qx-pop'); return e && getComputedStyle(e).display !== 'none' ? e.innerText : null; });
  check('survol de la raison : le détail (pourquoi, ce que le prospect a dit, pour valider)', pop && /RSA/.test(pop) && /Je suis au RSA/.test(pop) && /Pour valider/i.test(pop), pop);
  if (OUT) await p.screenshot({ path: OUT + '/qualif-survol.png' });
  const up = await cf.evaluate(() => { const w = document.querySelector('.ca-scrim table.qx tbody tr:nth-child(2) .qx-w'), pp = w.querySelector('.qx-pop').getBoundingClientRect(); return { bottom: Math.round(pp.bottom), top: Math.round(pp.top), vh: innerHeight }; });
  check('le détail reste dans l’écran (il s’ouvre vers le haut près du bas)', up.top >= 0 && up.bottom <= up.vh, up);
  await cf.evaluate(() => document.querySelector('.ca-scrim').scrollTop = 1500); await p.waitForTimeout(300);
  const hd = await cf.evaluate(() => { const t = document.querySelector('.ca-scrim .ca-top').getBoundingClientRect(), x = document.querySelector('.ca-scrim .ca-x').getBoundingClientRect();
    return { top: Math.round(t.top), name: document.querySelector('.ca-scrim #ca-t').textContent, xTop: Math.round(x.top), scrolled: document.querySelector('.ca-scrim').scrollTop }; });
  check('en défilant, le nom du lead et la croix restent en haut', hd.scrolled > 500 && hd.top === 0 && hd.xTop > 0 && hd.xTop < 80 && hd.name === 'Paul Payé', hd);
  if (OUT) await p.screenshot({ path: OUT + '/analyse-defile.png' });
  if (OUT) await cf.evaluate(() => document.querySelector('.ca-scrim').scrollTop = 0);
  if (OUT) await p.screenshot({ path: OUT + '/fiche-analyse.png' });
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  check('Échap ferme la fenêtre, la fiche reste ouverte', !(await win()) && await cf.evaluate(() => !!document.querySelector('#layer .ls-calls')), null);
  // 063 : corriger une lettre de la découverte (administrateur), la correction gardée et affichée
  await cf.evaluate(() => openLead('c1')); await p.waitForTimeout(700);
  await cf.click('#layer .ls-calls [data-ca]'); await p.waitForTimeout(1000);
  const fix = await cf.evaluate(async () => {
    const C = window.parent.LNP_CRM, base = await C.caRecord('j1'), store = [], calls = [];
    C.caCorrect = async (job, unit, value, note) => { calls.push([job, unit, value, note]);
      store.unshift({ unit_id: unit, field: 'letter', engine_value: 'S', value, note, author: 'Romain', created_at: '2026-11-20T10:00:00Z' }); return {}; };
    C.caRecord = async () => Object.assign(JSON.parse(JSON.stringify(base)), { can_correct: true, corrections: store.slice() });
    const root = document.querySelector('#caLead'); if (!root) return { err: 'pas de #caLead' };
    const holder = document.createElement('div');
    holder.innerHTML = '<input id="cav-fix-note" value="la question demande la difficulté"><button type="button" data-cav-fix="P" data-cav-unit="Q005">P</button>';
    root.appendChild(holder); holder.querySelector('button').click();
    await new Promise(r => setTimeout(r, 900));
    const chipEl = document.querySelector('#caLead [data-cav-sol="Q005"]');
    return { calls, title: chipEl && chipEl.title, outline: chipEl && chipEl.getAttribute('style') };
  });
  check('corriger une lettre : la correction part avec la note, puis la lettre corrigée s’affiche', fix && fix.calls && fix.calls.length === 1 && fix.calls[0][0] === 'j1' && fix.calls[0][2] === 'P' && /difficulté/.test(fix.calls[0][3]) && /lettre corrigée \(moteur : S\)/.test(fix.title || '') && /dashed/.test(fix.outline || ''), fix);
  await cf.click('#caLead [data-cav-sol="Q005"]'); await p.waitForTimeout(300);
  const panel = await cf.evaluate(() => { const b = document.querySelector('#caLead [data-cav-fix]'); const box = b && b.closest('#cav-sol-pane'); return box ? box.innerText : null; });
  check('le panneau de la question : la correction faite (auteur, note) et les lettres pour corriger', panel && /Lettre corrigée : S → P · par Romain/.test(panel) && /Corriger la lettre/.test(panel) && /Hors SPIN/.test(panel), panel && panel.slice(0, 300));
  if (OUT) await p.screenshot({ path: OUT + '/correction-lettre.png' });
  const reader = await cf.evaluate(() => { const C = window.parent.LNP_CAV || window.LNP_CAV; if (!C) return null;
    const d = document.createElement('div'); d.innerHTML = C.html({ results: { SPIN: { status: 'scored', details: { solicitations: [{ id: 'Q005', letter: 'S', turn: 'T005', in_perimeter: true }] } } }, corrections: [], can_correct: false }, { sol: 'Q005' });
    return !d.querySelector('[data-cav-fix]'); });
  check('un commercial voit la correction mais ne peut pas corriger', reader === true, reader);
  for (let k = 0; k < 3 && await win(); k++) { await p.keyboard.press('Escape'); await p.waitForTimeout(300); }   // Échap ferme par étapes
  // C9 (Romain, 2026-11-20) : le rendu d'un R2 après un bon écart et une offre déjà présentée au R1, puis d'un écart à reprendre
  const c9 = await cf.evaluate(async () => {
    const CAV = window.LNP_CAV || window.parent.LNP_CAV; if (!CAV) return null;
    const base = await window.parent.LNP_CRM.caRecord('j1'), out = [];
    for (const v of [1, 2]) {
      const r = JSON.parse(JSON.stringify(base));
      if (v === 1) {
        r.results.SPIN = { competence: 'SPIN', status: 'not_applicable', reasons: ['gap_made_in_previous_call'], details: {} };
        r.results.PITCH = { competence: 'PITCH', status: 'not_applicable', reasons: ['pitch_made_in_previous_call'], details: {} };
        r.results.GAP = { competence: 'GAP', status: 'not_applicable', reasons: ['gap_made_in_previous_call'], details: Object.assign({}, r.results.GAP.details, { carried_from: 'r1' }) };
      } else {
        Object.assign(r.results.GAP, { verdict: 'absent', score: 0 });
        Object.assign(r.results.GAP.details, { verdict: 'absent', absence_reason: 'not_validated', remediation: { needed: true, done: null, after: 'T040' } });
      }
      const d = document.createElement('div'); d.innerHTML = CAV.html(r); out.push(d.textContent);
    }
    const r3 = JSON.parse(JSON.stringify(base)); r3.phases.flags = ['disguised_price'];
    r3.results.PITCH = { competence: 'PITCH', status: 'scored', verdict: 'non_compliant', score: 0, reasons: ['price_before_roadmap'], items: [],
      details: { verdict: 'non_compliant', non_compliance: ['price_before_roadmap'], steps: {}, claims: [], adhesion: [], roadmap: { steps: [] } } };
    const d3 = document.createElement('div'); d3.innerHTML = CAV.html(r3); out.push(d3.textContent);
    return out; });
  check('R2 : découverte, écart et offre « déjà faits lors d’un appel précédent »', c9 && /écart déjà fait lors d.un appel précédent du cycle/.test(c9[0]) && /offre déjà présentée lors d.un appel précédent du cycle/.test(c9[0]) && !/Si je résume/.test(c9[0]), c9 && c9[0].slice(0, 500));
  check('prix déguisé en « tour du marché » : bandeau dans la présentation de l’offre', c9 && /Prix donné trop tôt, déguisé en « tour du marché »/.test(c9[2]), c9 && c9[2].slice(0, 300));
  check('écart mauvais non repris : « Écart à reprendre »', c9 && /Écart à reprendre : il n.a été suivi ni d.une nouvelle reformulation ni d.un retour à la découverte/.test(c9[1]), c9 && c9[1].slice(0, 300));
  // Romain 2026-11-21 : une question incertaine porte une lettre orange avec « ? » et ses raisons dans le panneau
  const unc = await cf.evaluate(() => {
    const CAV = window.LNP_CAV || window.parent.LNP_CAV; if (!CAV) return null;
    const turns = [['T001', 'SALES', 'Tu fais quoi aujourd’hui ?'], ['T002', 'PROSPECT', 'Je donne des cours.'], ['T003', 'SALES', 'Qu’est-ce qui te bloque ?'],
      ['T004', 'PROSPECT', 'Trouver des élèves.'], ['T005', 'SALES', 'Et donc ?'], ['T006', 'PROSPECT', 'Voilà.']].map((x, i) => ({ id: x[0], role: x[1], text: x[2], ts: '00:0' + i + ':00' }));
    const sol = (id, turn, letter, status, extra) => Object.assign({ id, turn, letter, status, in_perimeter: true, answer_turns: ['T00' + (+turn.slice(-1) + 1)], tags: ['gates_by_code'], register: 'other', register_status: 'single_reading' }, extra || {});
    const r = { status: 'ok', turns, phases: { discovery_start: 'T001', pitch_start: 'T006' }, corrections: [], can_correct: false,
      results: { SPIN: { competence: 'SPIN', status: 'excluded', reasons: ['health_absent_share'], details: { solicitations: [
        sol('Q001.1', 'T001', 'S', 'agreed'), sol('Q003.1', 'T003', 'P', 'arbitrated'), sol('Q005.1', 'T005', 'OUT', 'agreed', { out_reason: 'absent' })] } } } };
    const d = document.createElement('div'); d.innerHTML = CAV.html(r, { sol: 'Q003.1' });
    const old = JSON.parse(JSON.stringify(r)); old.results.SPIN.details.solicitations.forEach((q) => { q.status = 'single_reading'; q.tags = []; });
    old.results.SPIN.details.solicitations[2].out_reason = 'nothing';
    const e = document.createElement('div'); e.innerHTML = CAV.html(old, {});
    return { unc: [...d.querySelectorAll('.chip.unc')].map((b) => b.getAttribute('data-cav-sol')), text: d.textContent, pane: (d.querySelector('#cav-sol-pane .unc-box') || {}).textContent || '',
      old: e.querySelectorAll('.chip.unc').length };
  });
  check('question incertaine : lettre orange avec « ? » (arbitrée, aucune porte franchie), le nombre dans la découverte', unc && unc.unc.join() === 'Q003.1,Q005.1' && /2 questions incertaines/.test(unc.text), unc && { unc: unc.unc, t: unc.text.slice(0, 200) });
  check('question incertaine : le panneau donne la raison', unc && /Question incertaine/.test(unc.pane) && /l'arbitre a tranché/.test(unc.pane), unc && unc.pane);
  check('une analyse plus ancienne, lue une seule fois sans les portes, n’est pas marquée incertaine', unc && unc.old === 0, unc && unc.old);
  // le lien de l'historique (bulle « R1 honoré · analyse et transcription »)
  const chatLink = await cf.$('#layer #lrChat [data-ca]');
  if (chatLink) { await chatLink.click(); await p.waitForTimeout(900); w = await win();
    check('historique : « analyse et transcription » ouvre aussi l’analyse', w && /DÉCOUVERTE/i.test(w.txt), w && w.txt.slice(0, 200));
    await p.keyboard.press('Escape'); await p.waitForTimeout(300); }
  // Cycle de vente : la fiche posée à droite de la file
  await p.click('nav >> text=Cycle de vente'); await p.waitForTimeout(2500);
  let dk = null; for (const f of p.frames()) { try { if (f.parentFrame() === cf && await f.$('#qs')) { dk = f; break; } } catch (e) {} }
  if (dk) { await dk.click('.qc[data-b="all"]').catch(() => {}); await p.waitForTimeout(300); await dk.click('.row[data-id="c2"]').catch(() => {}); await p.waitForTimeout(1200); }
  const dockBtn = await cf.$('#layer .lr-dock .ls-calls [data-ca]');
  if (dockBtn) { await dockBtn.click(); await p.waitForTimeout(1200); w = await win();
    check('Cycle de vente : « Analyse » ouvre l’analyse au-dessus de la fiche', w && w.onTop && /DÉCOUVERTE/i.test(w.txt), w && { z: w.z, top: w.onTop });
    if (OUT) await p.screenshot({ path: OUT + '/cycle-analyse.png' });
    await p.keyboard.press('Escape'); await p.waitForTimeout(300); }
  else check('Cycle de vente : la fiche du premier lead a un appel analysé', false, await cf.evaluate(() => { const d = document.querySelector('#layer .lr-dock'); return d ? d.innerText.slice(0, 200) : 'pas de fiche'; }));
  check('aucune erreur dans la console', errs.length === 0, errs);
  ok.forEach(x => console.log('OK  ' + x)); bad.forEach(x => console.log('BAD ' + x));
  console.log(ok.length + ' contrôles réussis, ' + bad.length + ' en échec');
  await b.close(); process.exit(bad.length ? 1 : 0);
})();
