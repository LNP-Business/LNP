class Component extends DCLogic {
  constructor(props) {
    super(props);
    this.state = { view: 'global', info: false };
  }
  tab(active) {
    const base = 'min-height: 44px; padding: 0 20px; border: 0; border-radius: 9px; font: inherit; font-size: 15px; cursor: pointer; ';
    return active
      ? base + 'background: #1B1B18; color: #FFFFFF; font-weight: 600;'
      : base + 'background: transparent; color: #3D3A33; font-weight: 500;';
  }
  renderVals() {
    const s = this.state;
    const S = window.SKL;
    const fv = S.takeFocus && S.takeFocus('cockpit'); if (fv) s.view = fv;
    const krs = S.list('krs');
    const tasks = S.list('tasks');
    const me = S.me;
    const meM = me ? S.member(me) : null;
    const dot = c => 'width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; background: ' + c;
    const SEV = { Critical: '#B42318', High: '#B45309', Medium: '#8E8A80', Low: '#C9C4B7' };
    const ACTION = { roadmap: 'Open KR', person: 'Open', decisions: 'Decide' };
    const goAlert = a => () => {
      if (a.to === 'roadmap') S.openKr(a.ref);
      else if (a.to === 'decisions') S.goto('decisions', a.ref.charAt(0) === 't' ? null : a.ref);
      else S.goto('monjour', a.pid);
    };

    // key results
    const rowOf = k => {
      const v = S.krView(k);
      v.open = () => S.openKr(k.id);
      v.key = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); S.openKr(k.id); } };
      return v;
    };
    const objectives = Object.keys(S.OBJ).map(o => ({ label: S.OBJ[o], rows: krs.filter(k => k.obj === o).map(rowOf) })).filter(o => o.rows.length);
    const others = krs.filter(k => !S.OBJ[k.obj]);
    if (others.length) objectives.push({ label: 'Other key results', rows: others.map(rowOf) });
    const kc = S.krCounts();

    // alerts, open ones only (acknowledged ones are handled)
    const all = S.inbox().filter(a => a.status === 'open');
    const mineAll = me ? all.filter(a => a.assignee === me || a.escalateTo === me) : [];
    const mine = mineAll.slice(0, 4).map(a => Object.assign({}, a, {
      go: goAlert(a), action: ACTION[a.to] || 'Open',
      detailStyle: 'font-size: 13px; margin-top: 4px; color: ' + (a.sev === 'Critical' || a.sev === 'High' ? '#F2A99F' : '#C9C4B7'),
      btnStyle: 'display: inline-flex; align-items: center; min-height: 44px; padding: 0 16px; border-radius: 10px; font: inherit; font-size: 14px; font-weight: 600; cursor: pointer; ' +
        (a.sev === 'Critical' || a.sev === 'High' ? 'background: #F6F4EF; color: #1B1B18; border: 0;' : 'background: transparent; color: #F6F4EF; border: 1px solid #5E5B53;')
    }));
    const slowAll = all.filter(a => a.sev === 'Critical' || a.sev === 'High').sort((x, y) => (y.escalated ? 1 : 0) - (x.escalated ? 1 : 0));
    const slow = slowAll.slice(0, 4).map(a => Object.assign({}, a, { go: goAlert(a), action: ACTION[a.to] || 'Open', dot: dot(SEV[a.sev]), person: a.assigneeName + (a.escalated ? ' · escalated to ' + S.member(a.escalateTo).name : '') }));

    // velocity we can compute today
    const blocked = tasks.filter(t => t.status === 'blocked');
    const hrs = blocked.map(t => t.since ? Math.round((S.today - S.parse(t.since)) / 3600000) : 0);
    const avg = hrs.length ? Math.round(hrs.reduce((x, y) => x + y, 0) / hrs.length) : 0;
    const over = hrs.filter(h => h > S.rule('a2').v).length;
    const blk = {
      n: blocked.length,
      sub: blocked.length ? 'Blocked tasks · avg ' + avg + ' h blocked' : 'No blocked task',
      flag: over ? over + ' blocked for more than ' + S.rule('a2').v + ' h' : 'Target: no blocker > ' + S.rule('a2').v + ' h',
      flagStyle: 'align-self: flex-start; display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; color: ' + (over ? '#9B1C12' : '#1E5E38'),
      dotStyle: dot(over ? '#B42318' : '#2E7D4F')
    };
    const loads = S.members.map(m => S.load(m.id));
    const tH = loads.reduce((x, l) => x + l.hours, 0), tC = loads.reduce((x, l) => x + l.cap, 0);
    const tPct = tC ? Math.round(tH / tC * 100) : 0;
    const hot = loads.filter(l => l.pct > 90).length;
    const ld = {
      pct: tPct + '%',
      flag: hot ? hot + (hot === 1 ? ' person' : ' people') + ' above 90%' : (tPct > 70 ? 'Above the 70% target' : 'Within target'),
      flagStyle: 'align-self: flex-start; display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; color: ' + (hot ? '#9B1C12' : tPct > 70 ? '#8A3F06' : '#1E5E38'),
      dotStyle: dot(hot ? '#B42318' : tPct > 70 ? '#B45309' : '#2E7D4F')
    };

    // hygiene
    const hyg = [];
    krs.forEach(k => { const st = S.krStatus(k); if (st.key === 'stale') hyg.push(k.name + ': no check-in for ' + st.age + ' d'); if (st.key === 'new') hyg.push(k.name + ': no check-in yet'); });
    const noOwner = tasks.filter(t => S.isOpen(t) && !t.owner).length;
    if (noOwner) hyg.push(noOwner + ' open task' + (noOwner > 1 ? 's' : '') + ' without an owner');
    const dailyMissing = S.members.filter(m => !S.get('dailies', m.id + '-' + S.iso(S.today))).length;

    // explorations
    const explo = tasks.filter(t => t.kind === 'E' && S.isOpen(t)).sort((a, b) => (a.due < b.due ? -1 : 1)).map(t => {
      const n = S.daysFromToday(t.due);
      const out = n !== null && n < 0;
      const kr = krs.find(k => k.id === t.kr);
      return {
        title: t.title,
        sub: S.member(t.owner).name + (kr ? ' · ' + kr.name : '') + (t.note ? ' · ' + t.note : ''),
        subStyle: 'font-size: 12px; margin-top: 3px; color: ' + (out ? '#9B1C12' : '#5E5B53'),
        when: out ? 'timebox over ' + (-n) + ' d ago' : n === 0 ? 'decision today' : 'decision ' + S.dayLabel(t.due),
        whenStyle: 'color: ' + (out ? '#9B1C12' : '#5E5B53'),
        rowStyle: 'display: grid; grid-template-columns: minmax(0, 1fr) 150px 120px; gap: 16px; align-items: center; padding: 14px 0; border-top: 1px solid #EFEBE3;' + (out ? ' background: #FFF8F6;' : ''),
        action: out ? 'Decide' : t.status === 'todo' ? 'To start' : 'Open',
        btnStyle: 'display: inline-flex; align-items: center; justify-content: center; min-height: 40px; border-radius: 10px; font: inherit; font-size: 13px; font-weight: 600; cursor: pointer; ' +
          (out ? 'background: #B42318; color: #FFFFFF; border: 0;' : 'background: #FFFFFF; color: #1B1B18; border: 1px solid #D8D3C7;'),
        go: () => out ? S.goto('decisions') : S.goto('monjour', t.owner)
      };
    });

    const ps = S.milestoneStats();
    const lastP = ps[ps.length - 1], prevP = ps[ps.length - 2];
    const pr = lastP ? {
      pct: lastP.pct + '%',
      trend: prevP ? (lastP.pct >= prevP.pct ? '↑ ' : '↓ ') + prevP.pct + '%' : '',
      trendStyle: "font-family: 'IBM Plex Mono', monospace; font-size: 13px; color: " + (!prevP || lastP.pct >= prevP.pct ? '#8FD1A8' : '#F2A99F'),
      sub: lastP.done + ' of ' + lastP.total + ' milestones of ' + S.wl(lastP.week) + ' reached',
      subStyle: 'font-size: 12px; line-height: 1.45; color: ' + (lastP.pct >= 80 ? '#8FD1A8' : '#F2A99F')
    } : { pct: '—', trend: '', trendStyle: '', sub: 'Scored once a week with milestones is over', subStyle: 'font-size: 12px; color: #C9C4B7' };
    const d = S.today;
    return {
      info: !!s.info,
      openInfo: () => this.setState({ info: true }),
      closeInfo: () => this.setState({ info: false }),
      todayLabel: d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }).replace(/^(\w+) (\d+) (\w+)$/, '$1, $3 $2'),
      hello: 'Good morning' + (meM ? ', ' + meM.name : ''),
      kc: kc,
      isGlobal: s.view === 'global',
      isKR: s.view === 'kr', tabKR: this.tab(s.view === 'kr'), goKR: () => this.setState({ view: 'kr' }),
      isMarketing: s.view === 'marketing',
      isSales: s.view === 'sales',
      isFinance: s.view === 'finance',
      tabGlobal: this.tab(s.view === 'global'),
      tabMarketing: this.tab(s.view === 'marketing'),
      tabSales: this.tab(s.view === 'sales'),
      tabFinance: this.tab(s.view === 'finance'),
      goGlobal: () => this.setState({ view: 'global' }),
      goMarketing: () => this.setState({ view: 'marketing' }),
      goSales: () => this.setState({ view: 'sales' }),
      goFinance: () => this.setState({ view: 'finance' }),
      objectives: objectives, noKr: !krs.length,
      mkRows: krs.filter(k => k.owner === 'marketing').map(rowOf),
      mine: mine, mineN: mineAll.length, mineEmpty: !!me && !mineAll.length, noMe: !me,
      meName: meM ? meM.name + ' · ' + meM.role : '',
      slow: slow, slowN: slowAll.length, slowEmpty: !slowAll.length,
      blk: blk, ld: ld, pr: pr,
      hyg: hyg,
      hygRest: (dailyMissing ? dailyMissing + ' of ' + S.members.length + ' dailies not filed today. ' : '') + (hyg.length ? 'Everything else is green.' : 'All hygiene indicators are green.'),
      explo: explo, exploEmpty: !explo.length
    };
  }
}
