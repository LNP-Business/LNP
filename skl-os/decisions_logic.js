class Component extends DCLogic {
  constructor(props) {
    super(props);
    this.state = { info: false, sel: 'd1', open: null };
  }
  frameworks() {
    return [['fw1', 'Iteration system'], ['fw2', 'Mechanisms'], ['fw3', 'Registers'], ['fw4', 'Organs']];
  }
  // everything a decision can be linked to comes from the shared data
  catalog() {
    const S = window.SKL;
    const red = '#B42318', amber = '#B45309', green = '#2E7D4F', gold = '#C9A04A', grey = '#B7B2A6', teal = '#0F5E5C';
    const krDot = { red: red, amber: amber, green: green, stale: grey, new: gold };
    const SL = { todo: 'To do', progress: 'In progress', blocked: 'Blocked', done: 'Done', split: 'Split needed' };
    return {
      kr: S.list('krs').map(k => { const st = S.krStatus(k); return { id: k.id, name: k.name, sub: k.obj + ' · ' + st.label + (st.ratio !== null && st.ratio !== undefined ? ' · ratio ' + st.ratio.toFixed(2) : ''), dot: krDot[st.key] }; }),
      task: S.list('tasks').map(t => ({ id: t.id, name: t.title, sub: S.member(t.owner).name + ' · ' + (SL[t.status] || 'To do') + ' · ' + t.est + ' h · due ' + S.dayLabel(t.due),
        dot: t.status === 'blocked' ? red : t.status === 'done' ? green : t.kind === 'E' ? teal : t.status === 'progress' ? gold : grey })),
      del: this.frameworks().map(([id, name]) => ({ id, name, sub: 'Library · Operations · Framework · IP', dot: green }))
        .concat(S.list('deliverables').map(x => ({ id: x.id, name: x.title, sub: 'Library · ' + x.domain + ' · ' + x.status, dot: x.status === 'validated' ? green : grey })))
    };
  }
  view(d) {
    const S = window.SKL;
    const tag = (label, kind) => {
      const k = {
        blue: 'background: #FBF6EC; color: #9A6614;', red: 'background: #FDECEA; color: #9B1C12; font-weight: 600;',
        gold: 'background: #F4ECDD; color: #7A4B00;', grey: 'background: #F6F4EF; color: #5E5B53;',
        amber: 'background: #FDF1E3; color: #8A3F06; font-weight: 600;', green: 'background: #E6F2EA; color: #1E5E38;'
      }[kind];
      return { label, style: 'font-size: 12px; padding: 3px 8px; border-radius: 6px; ' + k };
    };
    const ink = '#1B1B18', red = '#9B1C12', green = '#1E5E38';
    const tags = [d.reversible ? tag('Reversible', 'blue') : tag('Irreversible', 'gold')];
    let meta = 'Owner: ' + S.member(d.owner).name, deadline = '—', deadlineColor = ink, action = '';
    if (d.col === 'todo') {
      const n = S.daysFromToday(d.deadline);
      if (n !== null && n < 0) tags.push(tag('+' + (-n) + ' d late', 'red')); else if (n !== null) tags.push(tag(n === 0 ? 'Due today' : 'D-' + n, 'grey'));
      if (d.source) tags.push(tag(d.source, 'grey'));
      deadline = (n !== null && n < 0 ? 'overdue · ' : '') + S.shortDate(d.deadline); deadlineColor = n !== null && n < 0 ? red : ink;
      action = 'decide';
    } else if (d.col === 'done') {
      tags.push(tag('Decided', 'green'));
      meta = 'Decided ' + S.shortDate(d.decided) + (d.review ? ' · review on ' + S.shortDate(d.review) : '');
      deadline = 'decided ' + S.shortDate(d.decided); deadlineColor = green; action = 'review';
    } else {
      tags.push(tag('Review due', 'amber'));
      meta = 'Review ' + S.dayLabel(d.review) + (d.expected ? ' · expected: ' + d.expected : '');
      deadline = 'review ' + S.shortDate(d.review); deadlineColor = S.daysFromToday(d.review) < 0 ? red : ink; action = 'close';
    }
    return Object.assign({}, d, { tags, meta, deadlineText: deadline, deadlineColor, action, ownerName: S.member(d.owner).name });
  }
  linkLine(l) {
    const p = (n, one, many) => n + ' ' + (n === 1 ? one : many);
    return p(l.kr.length, 'KR', 'KRs') + ' · ' + p(l.task.length, 'task', 'tasks') + ' · ' + p(l.del.length, 'deliverable', 'deliverables');
  }
  renderVals() {
    const S = window.SKL;
    const fd = S.takeFocus && S.takeFocus('decisions'); if (fd) { this.state.sel = fd; this.state.edit = 'rec'; this.state.open = null; }
    const s = this.state;
    const cat = this.catalog();
    const raw = S.list('decisions');
    const save = d => S.save('decisions', d);
    const ageOf = d => d.decided ? -S.daysFromToday(d.decided) : 0;
    const isArchived = d => d.col === 'done' && ageOf(d) > 14;
    const everything = raw.map(d => this.view(d));
    const all = everything.filter(d => !isArchived(d));
    const archivedList = everything.filter(isArchived).sort((x, y) => ageOf(x) - ageOf(y));
    const colDefs = [['todo', 'To decide'], ['done', 'Decided'], ['review', 'To review']];
    const cardBase = 'display: flex; flex-direction: column; gap: 10px; align-items: stretch; width: 100%; box-sizing: border-box; text-align: left; font: inherit; color: #1B1B18; background: #FFFFFF; border-radius: 12px; cursor: pointer; ';
    const order = { todo: d => d.deadline || '9', done: d => d.decided || '9', review: d => d.review || '9' };
    const cols = colDefs.map(([key, title]) => {
      const items = all.filter(d => d.col === key).sort((a, b) => order[key](a) < order[key](b) ? -1 : 1).map(d => ({
        title: d.title, tags: d.tags, meta: d.meta,
        selected: d.id === s.sel,
        cardStyle: cardBase + (s.edit === 'rec' && d.id === s.sel ? 'border: 2px solid #C9A04A; padding: 15px;' : 'border: 1px solid #E3DFD5; padding: 16px;'),
        linkLine: this.linkLine(d.links),
        select: () => this.setState({ sel: d.id, open: null, edit: 'rec' })
      }));
      const top = { todo: '#D9B46A', done: '#2E7D4F', review: '#1B1B18' }[key];
      const hint = { todo: 'Open decisions, oldest deadline first', done: 'Taken and waiting for their review date', review: 'Review date reached: compare expected and actual' }[key];
      return { title, hint, count: items.length, items, empty: items.length === 0,
        style: 'background: #EFECE4; border-radius: 14px; border-top: 4px solid ' + top + '; padding: 14px 12px 16px; display: flex; flex-direction: column; gap: 10px; min-width: 0' };
    });

    const empty = { info: !!s.info, openInfo: () => this.setState({ info: true }), closeInfo: () => this.setState({ info: false }),
      cols, sel: {}, groups: [], fr: { vars: [], opts: [] }, best: {}, archive: [], archiveCount: 0, archiveOpen: false, drawer: false,
      openArchive: () => this.setState({ edit: 'arch' }), closeArchive: () => this.setState({ edit: null }), closeDrawer: () => this.setState({ edit: null }), newDecision: () => this.newDecision() };
    if (!everything.length) return empty;
    const dv = everything.find(x => x.id === s.sel) || all[0] || everything[0];
    const d = S.get('decisions', dv.id);
    const l = d.links;

    const gdefs = [
      ['task', 'Tasks', 'a task', 'No task linked yet. List the tasks that carry out the chosen option.'],
      ['kr', 'Key result', 'a key result', 'No key result linked. Every decision should serve a key result.'],
      ['del', 'Deliverables', 'a deliverable', 'No deliverable linked yet.']
    ];
    const setLink = (g, ids) => { d.links = Object.assign({}, d.links, { [g]: ids }); save(d); this.setState({}); };
    const groups = gdefs.map(([g, label, what, emptyText]) => {
      const ids = (l[g] || []).filter(id => cat[g].some(x => x.id === id));
      const open = s.open === g;
      const items = ids.map(id => {
        const it = cat[g].find(x => x.id === id);
        return Object.assign({}, it, { removeLabel: 'Unlink ' + it.name, remove: () => S.confirm({ title: 'Unlink this item?', body: '“' + it.name + '” will no longer be linked to this decision. The item itself is not deleted.', ok: 'Unlink', onOk: () => setLink(g, ids.filter(x => x !== id)) }) });
      });
      const pool = g === 'task' ? cat[g].filter(x => { const t = S.get('tasks', x.id); return t && t.status !== 'done'; }) : cat[g];
      const options = pool.filter(x => ids.indexOf(x.id) < 0).map(x => Object.assign({}, x, { add: () => setLink(g, ids.concat([x.id])) }));
      return {
        label, open, items, options,
        empty: ids.length === 0, emptyText,
        noOptions: options.length === 0,
        btn: open ? 'Done' : '+ Link ' + what,
        pickTitle: 'Pick ' + what + ' to link',
        toggle: () => this.setState({ open: open ? null : g })
      };
    });

    // the five-step frame of the selected decision
    const f = d.frame;
    const vars = f.vars;
    const total = vars.reduce((a, v) => a + (Number(v.w) || 0), 0);
    const valueOf = o => Math.round(vars.reduce((a, v, i) => a + (Number(v.w) || 0) * (Number(o.sc[i]) || 0), 0) / 10);
    const values = f.opts.map(valueOf);
    const bestIdx = values.indexOf(Math.max.apply(null, values));
    const upd = () => { save(d); this.setState({}); };
    const quiet = () => save(d);
    const shades = ['#1B1B18', '#C9A04A', '#8E8A80'];
    const fr = {
      title: d.title, problem: f.problem,
      setTitle: (e) => { d.title = e.target.value || d.title; d.question = d.title; upd(); },
      setProblem: (e) => { f.problem = e.target.value; quiet(); },
      totalLabel: total === 100 ? 'Total 100 ✓' : 'Total ' + total + ' · must be 100',
      totalStyle: 'font-size: 13px; white-space: nowrap; color: ' + (total === 100 ? '#1E5E38' : '#B42318'),
      vars: vars.map((v, i) => ({
        n: i + 1, name: v.name, w: v.w, ctx: v.ctx,
        nameLabel: 'Variable ' + (i + 1), wLabel: 'Weight of variable ' + (i + 1),
        bar: 'display: block; height: 100%; width: ' + Math.max(0, Math.min(100, Number(v.w) || 0)) + '%; background: ' + shades[i] + ';',
        setName: (e) => { v.name = e.target.value; upd(); },
        setW: (e) => { v.w = Math.max(0, Math.min(100, Math.round(Number(e.target.value) || 0))); upd(); },
        setCtx: (e) => { v.ctx = e.target.value; quiet(); }
      })),
      opts: f.opts.map((o, i) => ({
        letter: 'ABC'[i], name: o.name, desc: o.desc, value: values[i],
        nameLabel: 'Option ' + 'ABC'[i], descLabel: 'Option ' + 'ABC'[i] + ' description',
        best: i === bestIdx, chosen: d.col !== 'todo' && d.chosen === i,
        card: 'display: flex; flex-direction: column; gap: 10px; padding: 14px; border-radius: 12px; ' + (i === bestIdx ? 'border: 2px solid #C9A04A; background: #FBF6EC;' : 'border: 1px solid #E3DFD5; background: #FFFFFF;'),
        bar: 'display: block; height: 100%; width: ' + Math.min(100, values[i]) + '%; background: ' + (i === bestIdx ? '#C9A04A' : '#B7B2A6') + ';',
        setName: (e) => { o.name = e.target.value; upd(); },
        setDesc: (e) => { o.desc = e.target.value; quiet(); },
        scores: vars.map((v, j) => ({
          n: j + 1, var: v.name, v: o.sc[j],
          set: (e) => { o.sc[j] = Math.max(0, Math.min(10, Math.round(Number(e.target.value) || 0))); upd(); }
        }))
      }))
    };
    const best = { name: f.opts[bestIdx].name, value: values[bestIdx] + ' / 100' };
    const plus = n => S.iso(new Date(S.today.getTime() + n * 86400000));
    const actions = {
      decide: ['Decide: ' + f.opts[bestIdx].name, () => { d.col = 'done'; d.chosen = bestIdx; d.decided = S.iso(S.today); d.review = plus(d.reversible ? 30 : 90); upd(); }],
      review: ['Start the review now', () => { d.col = 'review'; d.review = S.iso(S.today); upd(); }],
      close: ['Close the review and archive it', () => { d.col = 'done'; d.reviewNote = 'Reviewed ' + S.shortDate(S.iso(S.today)) + (d.actual ? ' · ' + d.actual : ''); if (!d.decided || -S.daysFromToday(d.decided) <= 14) d.decided = plus(-15); upd(); this.setState({ edit: null }); }]
    };
    const act = actions[dv.action] || ['', () => {}];
    const sel = Object.assign({}, dv, {
      colTitle: isArchived(dv) ? 'Archived' : colDefs.find(c => c[0] === dv.col)[1],
      hasActual: dv.col === 'review' || !!dv.actual,
      linkLine: this.linkLine(l),
      actionLabel: act[0], doAction: act[1],
      ownerOpts: S.members.map(m => ({ v: m.id, l: m.name, sel: m.id === d.owner })),
      setOwner: (e) => { d.owner = e.target.value; upd(); },
      isTodo: d.col === 'todo', deadlineIso: d.deadline || '',
      setDeadline: (e) => { if (e.target.value) { d.deadline = e.target.value; upd(); } },
      setActual: (e) => { d.actual = e.target.value; quiet(); },
      revOpts: [{ v: 'r', l: 'Reversible', sel: !!d.reversible }, { v: 'i', l: 'Irreversible', sel: !d.reversible }],
      setRev: (e) => { d.reversible = e.target.value === 'r'; upd(); }
    });
    const archive = archivedList.map(a => ({
      title: a.title, owner: a.ownerName, review: a.reviewNote || (a.review ? 'Review on ' + S.shortDate(a.review) : ''),
      chosenName: a.frame.opts[a.chosen] ? a.frame.opts[a.chosen].name : '—',
      date: S.parse(a.decided).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
      age: ageOf(a) + ' d',
      open: () => this.setState({ sel: a.id, edit: 'rec', open: null })
    }));

    return {
      fr, best, archive, archiveCount: archive.length,
      archiveOpen: s.edit === 'arch',
      openArchive: () => this.setState({ edit: 'arch', open: null }),
      closeArchive: () => this.setState({ edit: null }),
      newDecision: () => this.newDecision(),
      info: !!s.info,
      openInfo: () => this.setState({ info: true }),
      closeInfo: () => this.setState({ info: false }),
      cols, sel, groups,
      drawer: s.edit === 'rec',
      closeDrawer: () => this.setState({ edit: null, open: null })
    };
  }
  newDecision() {
    const S = window.SKL;
    const V = (name, w) => ({ name, w, ctx: '' });
    const O = name => ({ name, desc: '', sc: [5, 5, 5] });
    const id = S.newId('d');
    S.save('decisions', { id, col: 'todo', title: 'New decision', question: 'New decision', owner: S.me || 'romain', reversible: true,
      deadline: S.iso(new Date(S.today.getTime() + 2 * 86400000)), opened: S.iso(S.today), chosen: -1, expected: '', actual: '', decided: '', review: '',
      frame: { problem: '', vars: [V('Variable 1', 40), V('Variable 2', 35), V('Variable 3', 25)], opts: [O('Option A'), O('Option B'), O('Option C')] },
      links: { kr: [], task: [], del: [] } });
    this.setState({ sel: id, edit: 'rec', open: null });
  }
}
