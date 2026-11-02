class Component extends DCLogic {
  constructor(props) {
    super(props);
    this.state = { sel: null, tab: 'road', edit: null };
    this.ci = {};
    this.td = null;
    this.nk = null;
  }
  renderVals() {
    const S = window.SKL;
    const fk = S.takeFocus && S.takeFocus('roadmap'); if (fk) { this.state.sel = fk; this.state.tab = 'road'; this.state.edit = null; }
    const s = this.state;
    const WEEK = S.week;
    const OBJ = S.OBJ;
    const OWNERS = S.members.map(m => [m.id, m.name]);
    const nm = id => S.member(id).name;
    const wdate = n => { const d = new Date('2026-09-28T12:00:00'); d.setDate(d.getDate() + 7 * (n - 1)); return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); };
    const fmt = (v, u) => {
      if (v === '' || v === null || v === undefined || isNaN(Number(v))) return '—';
      v = Number(v);
      if (u === 'pct') return v + '%';
      if (u === 'eur') return v >= 1000 ? '€' + (Math.round(v / 100) / 10) + 'k' : '€' + v;
      if (u === 'eur2') return '€' + v.toFixed(2);
      if (u === 'usd') return S.fmtVal(v, u);
      return v.toLocaleString('en-GB');
    };
    const prog = k => S.krProgress(k);
    const STY = { new: 'background: #F4ECDD; color: #7A4B00;', stale: 'background: #F6F4EF; color: #5E5B53;', green: 'background: #E6F2EA; color: #1E5E38;', amber: 'background: #FDF1E3; color: #8A3F06;', red: 'background: #FDECEA; color: #9B1C12;' };
    const status = k => { const x = S.krStatus(k); return [x.label, STY[x.key]]; };
    const pill = (st, big) => 'display: inline-block; white-space: nowrap; padding: ' + (big ? '4px 12px' : '2px 8px') + '; border-radius: 999px; font-size: ' + (big ? 14 : 11) + 'px; font-weight: 600; ' + st;
    const krs = S.list('krs');
    if (!krs.length) return this.emptyVals();
    const k = krs.find(x => x.id === s.sel) || krs[0];
    const allTasks = S.list('tasks');
    const tasksOf = allTasks.filter(t => t.kr === k.id);
    const upd = () => { S.save('krs', k); };
    const saveTask = t => { S.save('tasks', t); };
    const num = v => (v === '' ? '' : Number(v));
    const opt = (list, cur) => list.map(x => Array.isArray(x) ? { v: x[0], l: x[1], sel: String(x[0]) === String(cur) } : { v: x, l: x, sel: String(x) === String(cur) });
    const weeksList = Array.from({ length: 13 }, (_, i) => [i + 1, 'W' + (i + 1)]);

    // left rail
    const objectives = Object.keys(OBJ).map(o => ({
      label: OBJ[o],
      krs: krs.filter(x => x.obj === o).map(x => {
        const st = status(x), on = x.id === k.id, p = prog(x);
        return {
          name: x.name, owner: nm(x.owner), status: st[0], pill: pill(st[1]), on,
          progressLabel: (p >= 1 ? 'target reached' : Math.round(p * 100) + '% of target'),
          bar: 'display: block; height: 100%; width: ' + Math.min(100, p * 100) + '%; background: ' + (on ? '#C9A04A' : '#1B1B18') + ';',
          style: 'display: flex; flex-direction: column; gap: 6px; width: 100%; text-align: left; font: inherit; color: #1B1B18; cursor: pointer; border-radius: 12px; padding: 12px 14px; background: #FFFFFF; ' + (on ? 'border: 2px solid #C9A04A; padding: 11px 13px;' : 'border: 1px solid #E3DFD5;'),
          pick: () => { this.ci = {}; this.setState({ sel: x.id }); }
        };
      })
    }));

    // header + definition
    const st = status(k), p = prog(k);
    const last = S.lastCheck(k);
    const set = f => (e) => { k[f] = e.target.value; upd(); };
    const setN = f => (e) => { k[f] = num(e.target.value); upd(); };
    const inits = k.inits.map((it, i) => ({
      n: i + 1, name: it.name, hyp: it.hyp, contrib: it.contrib,
      label: 'Initiative ' + (i + 1), hypLabel: 'Hypothesis ' + (i + 1), contribLabel: 'Contribution ' + (i + 1), removeLabel: 'Remove initiative ' + (i + 1),
      setName: (e) => { it.name = e.target.value; upd(); }, setHyp: (e) => { it.hyp = e.target.value; upd(); }, setContrib: (e) => { it.contrib = e.target.value; upd(); },
      remove: () => { k.inits.splice(i, 1); tasksOf.forEach(t => { if (t.init === i) { t.init = -1; saveTask(t); } else if (t.init > i) { t.init -= 1; saveTask(t); } }); upd(); }
    }));
    const nInit = k.inits.length;
    const miles = k.miles.slice().sort((a, b) => a.week - b.week);
    const mileItems = miles.map(ml => {
      const late = !ml.done && ml.week < WEEK, now = !ml.done && ml.week === WEEK;
      return {
        text: ml.text, done: ml.done, mark: ml.done ? '✓' : '', label: 'Milestone week ' + ml.week,
        checkLabel: 'Milestone done: ' + ml.text,
        weekOpts: opt(weeksList, ml.week),
        state: ml.done ? 'Done' : late ? 'Late' : now ? 'This week' : 'Planned · ' + wdate(ml.week),
        stateStyle: 'white-space: nowrap; font-size: 12px; font-weight: 600; color: ' + (ml.done ? '#1E5E38' : late ? '#B42318' : now ? '#9A6614' : '#5E5B53'),
        row: 'display: grid; grid-template-columns: 34px 84px minmax(0, 1fr) 130px 34px; gap: 10px; align-items: center',
        box: 'width: 30px; height: 30px; border-radius: 8px; font: inherit; font-size: 16px; font-weight: 700; cursor: pointer; ' + (ml.done ? 'border: 0; background: #2E7D4F; color: #FFFFFF;' : 'border: 2px solid #8E8A80; background: #FFFFFF; color: #1B1B18;'),
        field: 'font: inherit; font-size: 14px; padding: 9px 11px; border: 1px solid #1B1B18; background: #1B1B18; color: #FFFFFF; border-radius: 8px; width: 100%; box-sizing: border-box; min-width: 0; ' + (ml.done ? 'text-decoration: line-through; color: #C9C4B7;' : ''),
        toggle: () => { ml.done = !ml.done; upd(); },
        setWeek: (e) => { ml.week = Number(e.target.value); upd(); },
        setText: (e) => { ml.text = e.target.value; upd(); },
        remove: () => { k.miles.splice(k.miles.indexOf(ml), 1); upd(); }
      };
    });
    const mileMarks = miles.map(ml => ({
      label: (ml.done ? '✓ ' : '○ ') + 'W' + ml.week, title: ml.text,
      style: 'grid-row: 1; grid-column: ' + (ml.week + 1) + '; justify-self: center; font-size: 11px; font-weight: 600; padding: 2px 6px; border-radius: 6px; white-space: nowrap; ' + (ml.done ? 'background: #E6F2EA; color: #1E5E38;' : 'background: #F4ECDD; color: #7A4B00;')
    }));

    // task roadmap
    const SC = { todo: '#D8D3C7', progress: '#C9A04A', blocked: '#B42318', done: '#2E7D4F', split: '#F2C38B' };
    const SL = { todo: 'To do', progress: 'In progress', blocked: 'Blocked', done: 'Done', split: 'Split needed' };
    const taskItem = t => {
      const w = S.taskWeeks(t);
      const late = t.status !== 'done' && S.daysFromToday(t.due) < 0;
      const col = late ? '#B42318' : (SC[t.status] || '#D8D3C7');
      const txt = (t.status === 'todo' || t.status === 'split') ? '#1B1B18' : '#FFFFFF';
      return {
        title: t.title, sub: nm(t.owner) + ' · ' + t.est + ' h · ' + (late ? 'Late · due ' + S.dayLabel(t.due) : (SL[t.status] || 'To do') + ' · due ' + S.dayLabel(t.due)),
        aria: 'Edit task ' + t.title,
        barLabel: w.end - w.start >= 1 ? (SL[t.status] || '') : '',
        bar: 'grid-row: 1; grid-column: ' + (w.start + 1) + ' / ' + (w.end + 2) + '; height: 24px; margin: 0 3px; border: 0; border-radius: 6px; background: ' + col + '; color: ' + txt + '; font: inherit; font-size: 11px; font-weight: 600; cursor: pointer; overflow: hidden; white-space: nowrap; position: relative;',
        open: () => { this.td = Object.assign({}, t, w, { editId: t.id }); this.setState({ edit: 'task', tdErr: false }); }
      };
    };
    const groups = k.inits.map((it, i) => ({ tag: 'I' + (i + 1), name: it.name || 'Initiative ' + (i + 1), tasks: tasksOf.filter(t => t.init === i) }))
      .concat(tasksOf.some(t => t.init < 0 || t.init >= nInit) ? [{ tag: '—', name: 'Not tied to an initiative', tasks: tasksOf.filter(t => t.init < 0 || t.init >= nInit) }] : [])
      .map(g => ({ tag: g.tag, name: g.name, count: g.tasks.length + (g.tasks.length === 1 ? ' task' : ' tasks'), empty: g.tasks.length === 0,
        tasks: g.tasks.slice().sort((a, b) => S.taskWeeks(a).start - S.taskWeeks(b).start || (a.due < b.due ? -1 : 1)).map(taskItem) }));
    const weeks = weeksList.map(([n, l]) => ({ label: l, date: wdate(n),
      style: 'text-align: center; font-size: 12px; font-weight: 600; padding: 4px 0; border-radius: 6px 6px 0 0; ' + (n === WEEK ? 'background: #F4ECDD; color: #7A4B00;' : 'color: #5E5B53;') }));

    // risks
    const LVL = [['low', 'Low'], ['medium', 'Medium'], ['high', 'High']];
    const lvlStyle = v => 'font: inherit; font-size: 14px; padding: 9px 11px; border-radius: 8px; width: 100%; box-sizing: border-box; font-weight: 600; ' + (v === 'high' ? 'border: 1px solid #B42318; background: #B42318; color: #FFFFFF;' : v === 'medium' ? 'border: 1px solid #1B1B18; background: #1B1B18; color: #D9B46A;' : 'border: 1px solid #1B1B18; background: #1B1B18; color: #FFFFFF;');
    const risks = k.risks.map((r, i) => ({
      text: r.text, fix: r.fix,
      pOpts: opt(LVL, r.p), iOpts: opt(LVL, r.i), ownerOpts: opt(OWNERS, r.owner),
      pStyle: lvlStyle(r.p), iStyle: lvlStyle(r.i),
      setText: (e) => { r.text = e.target.value; upd(); }, setFix: (e) => { r.fix = e.target.value; upd(); },
      setP: (e) => { r.p = e.target.value; upd(); }, setI: (e) => { r.i = e.target.value; upd(); }, setOwner: (e) => { r.owner = e.target.value; upd(); },
      remove: () => { k.risks.splice(i, 1); upd(); }
    }));

    // check-in draft
    const ci = this.ci;
    if (ci.kr !== k.id) { Object.assign(ci, { kr: k.id, value: k.current, conf: last ? last.conf : 5, moved: '', blocks: '', p1: '', p2: '', p3: '' }); }
    const TODAY_ISO = S.iso(S.today);
    const posted = k.checkins.some(c => c.date === TODAY_ISO);
    const cin = Object.assign({}, ci, {
      setValue: (e) => { ci.value = num(e.target.value); }, setConf: (e) => { ci.conf = Math.max(1, Math.min(10, Number(e.target.value) || 1)); },
      setMoved: (e) => { ci.moved = e.target.value; }, setBlocks: (e) => { ci.blocks = e.target.value; },
      setP1: (e) => { ci.p1 = e.target.value; }, setP2: (e) => { ci.p2 = e.target.value; }, setP3: (e) => { ci.p3 = e.target.value; },
      post: () => {
        k.checkins.unshift({ week: WEEK, date: TODAY_ISO, value: ci.value, conf: ci.conf, moved: ci.moved || '—', blocks: ci.blocks || '—', prios: [ci.p1, ci.p2, ci.p3].filter(Boolean), by: S.me || '' });
        if (ci.value !== '') { k.current = ci.value; }
        this.ci = {}; upd();
      }
    });
    const checkins = k.checkins.slice().sort((a, b) => a.date < b.date ? 1 : -1).map(c => ({
      title: 'Week ' + c.week + ' — ' + S.shortDate(c.date), value: fmt(c.value, k.unit), conf: c.conf,
      confStyle: 'color: ' + (c.conf >= 7 ? '#1E5E38' : c.conf >= 5 ? '#8A3F06' : '#9B1C12'),
      moved: c.moved, blocks: c.blocks, prios: (c.prios.length ? c.prios : ['—']).map(t => ({ t }))
    }));

    // closing
    const cl = k.close;
    const sc = cl.score === '' ? null : Number(cl.score);
    const band = (lo, hi) => 'padding: 6px; border-radius: 6px; font-weight: 600; ' + (sc !== null && sc >= lo && sc <= hi ? 'background: #1B1B18; color: #D9B46A;' : 'background: #F6F4EF; color: #5E5B53;');
    const close = {
      score: cl.score, worked: cl.worked, noEffect: cl.noEffect, lessons: cl.lessons,
      nextOpts: opt([['', 'Choose…'], ['renew', 'Renewed'], ['adjust', 'Adjusted'], ['drop', 'Dropped']], cl.next),
      b1: band(0, 0.35), b2: band(0.35, 0.65), b3: band(0.65, 1),
      reading: sc === null ? 'Score it at W12, from the final value of the metric.' : sc < 0.35 ? 'Failure: the levers did not move the metric.' : sc < 0.65 ? 'Progress: the metric moved, not enough.' : 'Success for an ambitious key result.',
      setScore: (e) => { const v = e.target.value; cl.score = v === '' ? '' : Math.max(0, Math.min(1, Math.round(Number(v) * 10) / 10)); upd(); },
      setWorked: (e) => { cl.worked = e.target.value; upd(); }, setNoEffect: (e) => { cl.noEffect = e.target.value; upd(); },
      setLessons: (e) => { cl.lessons = e.target.value; upd(); }, setNext: (e) => { cl.next = e.target.value; upd(); }
    };

    const kv = {
      name: k.name, metric: k.metric, owner: nm(k.owner), expected: k.expected, baseline: k.baseline, target: k.target, current: k.current,
      source: k.source, lead: k.lead, leadValue: k.leadValue || '', leadNote: k.leadNote || '',
      leadToneOpts: opt([['', 'Not measured yet'], ['green', 'On track'], ['amber', 'Watch'], ['red', 'Off track']], k.leadTone || ''), freq: ({ weekly: 'measured weekly', biweekly: 'measured every 2 weeks', monthly: 'measured monthly' })[k.freq] || 'measured weekly',
      objLabel: OBJ[k.obj], status: st[0], pillBig: pill(st[1], true),
      currentLabel: fmt(k.current, k.unit), targetLabel: fmt(k.target, k.unit), baselineLabel: fmt(k.baseline, k.unit),
      progressLabel: Math.min(100, Math.round(p * 100)) + '%',
      progressBar: 'display: block; height: 100%; width: ' + Math.min(100, p * 100) + '%; background: #C9A04A;',
      confLabel: last ? last.conf + ' / 10' : '—',
      freqOpts: opt([['weekly', 'Weekly'], ['biweekly', 'Every 2 weeks'], ['monthly', 'Monthly']], k.freq),
      objOpts: opt(Object.keys(OBJ).map(o => [o, OBJ[o]]), k.obj), ownerOpts: opt(OWNERS, k.owner),
      set: { metric: set('metric'), source: set('source'), lead: set('lead'), leadValue: set('leadValue'), leadNote: set('leadNote'), leadTone: set('leadTone'), freq: set('freq'), name: set('name'), obj: set('obj'), owner: set('owner'),
             baseline: setN('baseline'), target: setN('target'), current: setN('current'), expected: setN('expected') },
      inits, canAddInit: nInit < 5,
      initCountLabel: nInit + ' initiative' + (nInit === 1 ? '' : 's') + (nInit < 3 ? ' · add at least ' + (3 - nInit) + ' more' : nInit > 5 ? ' · 5 maximum' : ' · within 3 to 5'),
      initCountStyle: 'font-size: 13px; font-weight: 600; color: ' + (nInit >= 3 && nInit <= 5 ? '#1E5E38' : '#B42318'),
      addInit: () => { k.inits.push({ name: '', hyp: '', contrib: '' }); upd(); },
      miles: mileItems, mileMarks,
      addMile: () => { k.miles.push({ week: Math.min(13, WEEK + 1), text: '', done: false }); upd(); },
      groups,
      newTask: () => { this.td = { title: '', init: nInit ? 0 : -1, owner: k.owner, start: WEEK, end: WEEK, est: 4, status: 'todo', editId: null }; this.setState({ edit: 'task', tdErr: false }); },
      taskCount: tasksOf.length,
      risks, noRisk: k.risks.length === 0,
      addRisk: () => { k.risks.push({ text: '', p: 'medium', i: 'medium', fix: '', owner: k.owner }); upd(); },
      checkins, checkState: posted ? 'Posted this week · you can post an update' : 'Not posted yet this week',
      close
    };

    // task popup
    const td = this.td || {};
    const tdv = {
      heading: td.editId ? 'Edit the task' : 'New task', saveLabel: td.editId ? 'Save' : 'Add the task', isEdit: !!td.editId,
      title: td.title, est: td.est, titleErr: !!s.tdErr, tooBig: Number(td.est) > 8,
      initOpts: opt(k.inits.map((it, i) => [i, 'I' + (i + 1) + ' · ' + (it.name || 'Initiative ' + (i + 1))]).concat([[-1, 'Not tied to an initiative']]), td.init),
      ownerOpts: opt(OWNERS, td.owner), startOpts: opt(weeksList, td.start), endOpts: opt(weeksList, td.end),
      statusOpts: opt([['todo', 'To do'], ['progress', 'In progress'], ['blocked', 'Blocked'], ['split', 'Split needed'], ['done', 'Done']], td.status),
      setTitle: (e) => { td.title = e.target.value; }, setInit: (e) => { td.init = Number(e.target.value); },
      setOwner: (e) => { td.owner = e.target.value; },
      setStart: (e) => { td.start = Number(e.target.value); if (td.end < td.start) td.end = td.start; this.setState({}); },
      setEnd: (e) => { td.end = Number(e.target.value); if (td.end < td.start) td.start = td.end; this.setState({}); },
      setEst: (e) => { td.est = Math.max(1, Number(e.target.value) || 1); this.setState({}); },
      setStatus: (e) => { td.status = e.target.value; },
      save: () => {
        if (!String(td.title || '').trim()) { this.setState({ tdErr: true }); return; }
        const base = td.editId ? (S.get('tasks', td.editId) || {}) : { kind: 'L', unc: 'C', note: '', since: '' };
        const dueWeek = S.weekOf(base.due);
        const t = Object.assign({}, base, { id: td.editId || S.newId('t'), kr: k.id, init: td.init, title: td.title.trim(), owner: td.owner, start: td.start, end: td.end, est: td.est, status: td.status });
        if (!t.due || dueWeek < td.start || dueWeek > td.end) t.due = S.weekFriday(td.end);
        if (t.status === 'blocked' && !t.since) t.since = S.iso(S.today);
        if (t.status !== 'blocked') t.since = '';
        saveTask(t);
        this.td = null; this.setState({ edit: null, tdErr: false });
      },
      remove: () => { S.remove('tasks', td.editId); this.td = null; this.setState({ edit: null }); }
    };

    // new key result popup
    const nk = this.nk || (this.nk = { name: '', obj: 'O1', owner: S.me || 'romain', metric: '', unit: 'n', baseline: 0, target: '' });
    const nkv = Object.assign({}, nk, {
      err: !!s.nkErr,
      objOpts: opt(Object.keys(OBJ).map(o => [o, OBJ[o]]), nk.obj), ownerOpts: opt(OWNERS, nk.owner),
      unitOpts: opt([['n', 'Number'], ['pct', 'Percent'], ['eur', 'Euros'], ['eur2', 'Euros, with cents'], ['usd', 'US dollars']], nk.unit),
      setName: (e) => { nk.name = e.target.value; }, setObj: (e) => { nk.obj = e.target.value; }, setOwner: (e) => { nk.owner = e.target.value; },
      setMetric: (e) => { nk.metric = e.target.value; }, setUnit: (e) => { nk.unit = e.target.value; },
      setBaseline: (e) => { nk.baseline = num(e.target.value); }, setTarget: (e) => { nk.target = num(e.target.value); },
      create: () => {
        if (!String(nk.name).trim() || nk.target === '') { this.setState({ nkErr: true }); return; }
        const id = S.newId('kr');
        const b = Number(nk.baseline) || 0;
        S.save('krs', { id, obj: nk.obj, name: nk.name.trim(), owner: nk.owner, metric: nk.metric || nk.name.trim(), unit: nk.unit,
          baseline: b, target: nk.target, current: b, expected: b, source: '', freq: 'weekly', lead: '',
          inits: [{ name: '', hyp: '', contrib: '' }, { name: '', hyp: '', contrib: '' }, { name: '', hyp: '', contrib: '' }],
          miles: [{ week: 2, text: '', done: false }, { week: 4, text: '', done: false }, { week: 6, text: 'Mid-point: keep or pivot the initiatives', done: false }, { week: 9, text: '', done: false }, { week: 12, text: 'Closing and scoring', done: false }],
          risks: [], checkins: [], close: { score: '', worked: '', noEffect: '', lessons: '', next: '' } });
        this.nk = null; this.ci = {};
        this.setState({ sel: id, tab: 'def', edit: null, nkErr: false });
      }
    });

    const TABS = [['def', '1 · Definition', ''], ['init', '2 · Initiatives', nInit], ['miles', '3 · Milestones', k.miles.filter(m => m.done).length + '/' + k.miles.length],
                  ['road', '4 · Task roadmap', tasksOf.length], ['risk', '5 · Risks', k.risks.length], ['check', '6 · Check-ins', k.checkins.length], ['close', '7 · Closing', '']];
    const tabs = TABS.map(([id, label, count]) => ({
      label, count: count === '' ? '' : String(count), on: s.tab === id,
      style: 'display: inline-flex; align-items: center; gap: 6px; min-height: 34px; padding: 0 9px; border: 0; border-radius: 8px; font: inherit; font-size: 13px; cursor: pointer; ' + (s.tab === id ? 'background: #1B1B18; color: #D9B46A; font-weight: 600;' : 'background: transparent; color: #3D3A33;'),
      countStyle: count === '' ? 'display: none;' : 'font-size: 11px; padding: 1px 6px; border-radius: 999px; ' + (s.tab === id ? 'background: #34322C; color: #F6F4EF;' : 'background: #FFFFFF; color: #5E5B53;'),
      go: () => this.setState({ tab: id })
    }));
    const tab = {}; TABS.forEach(([id]) => { tab[id] = s.tab === id; });

    return {
      info: !!s.info, openInfo: () => this.setState({ info: true }), closeInfo: () => this.setState({ info: false }),
      objectives, k: kv, tabs, tab, weeks, ci: cin, td: tdv, nk: nkv,
      showTask: s.edit === 'task', showNewKr: s.edit === 'newkr',
      openNewKr: () => { this.nk = null; this.setState({ edit: 'newkr', nkErr: false }); },
      closePop: () => this.setState({ edit: null }),
      stop: (ev) => { if (ev && ev.stopPropagation) ev.stopPropagation(); }
    };
  }
  emptyVals() {
    return { info: !!this.state.info, openInfo: () => this.setState({ info: true }), closeInfo: () => this.setState({ info: false }),
      objectives: [], k: { set: {}, close: {}, inits: [], miles: [], mileMarks: [], groups: [], risks: [], checkins: [] }, tabs: [], tab: {}, weeks: [], ci: {}, td: {}, nk: {},
      showTask: false, showNewKr: false, openNewKr: () => {}, closePop: () => {}, stop: () => {} };
  }
}
