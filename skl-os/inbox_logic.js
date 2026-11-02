class Component extends DCLogic {
  constructor(props) {
    super(props);
    const S = window.SKL;
    this.state = { tab: (S && S.me) ? 'mine' : 'team', sev: 'All', area: 'All', sel: null, info: false, handling: false };
    this.draft = '';
  }
  renderVals() {
    const S = window.SKL;
    const fa = S.takeFocus && S.takeFocus('inbox'); if (fa) { this.state.sel = fa; this.state.tab = 'team'; }
    const s = this.state;
    const me = S.me;
    const SEV = ['Critical', 'High', 'Medium', 'Low'];
    const SEVC = { Critical: '#B42318', High: '#B45309', Medium: '#8E8A80', Low: '#C9C4B7' };
    const SEVP = { Critical: 'background: #FDECEA; color: #9B1C12;', High: 'background: #FDF1E3; color: #8A3F06;', Medium: 'background: #EFECE4; color: #3D3A33;', Low: 'background: #F6F4EF; color: #5E5B53;' };
    const TO = { roadmap: 'Open the key result', person: 'Open in Execute', decisions: 'Open in Decisions' };
    const all = S.inbox();
    const resolved = S.resolvedInbox();
    const isMine = a => me && (a.assignee === me || a.escalateTo === me);
    const inTab = {
      mine: a => a.status === 'open' && isMine(a),
      team: a => a.status === 'open',
      escalated: a => a.escalated,
      snoozed: a => a.status === 'snoozed',
      handled: a => a.status === 'handled'
    };
    const count = k => all.filter(inTab[k]).length;
    const TABS = [['mine', 'Mine'], ['team', 'All open'], ['escalated', 'Escalated'], ['snoozed', 'Snoozed'], ['handled', 'Handled'], ['resolved', 'Resolved']];
    const tabs = TABS.map(([k, l]) => {
      const on = s.tab === k, n = k === 'resolved' ? resolved.length : count(k);
      const alert = (k === 'escalated' || k === 'mine') && n;
      return {
        label: l, count: n, on,
        go: () => this.setState({ tab: k, sel: null, handling: false }),
        style: 'min-height: 40px; padding: 0 14px; border: 0; border-radius: 9px; font: inherit; font-size: 14px; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; ' +
          (on ? 'background: #1B1B18; color: #FFFFFF; font-weight: 600;' : 'background: transparent; color: #3D3A33; font-weight: 500;'),
        countStyle: 'min-width: 20px; padding: 0 6px; box-sizing: border-box; border-radius: 999px; font-size: 12px; font-weight: 600; text-align: center; ' +
          (alert ? 'background: #B42318; color: #FFFFFF;' : on ? 'background: #34322C; color: #D9B46A;' : 'background: #E3DFD5; color: #3D3A33;')
      };
    });
    const chip = (on) => 'min-height: 32px; padding: 0 12px; border-radius: 999px; font: inherit; font-size: 13px; cursor: pointer; ' +
      (on ? 'border: 1px solid #1B1B18; background: #1B1B18; color: #FFFFFF; font-weight: 600;' : 'border: 1px solid #D8D3C7; background: #FFFFFF; color: #3D3A33; font-weight: 500;');
    const sevChips = ['All'].concat(SEV).map(v => ({ label: v, style: chip(s.sev === v), go: () => this.setState({ sev: v }) }));
    const areaChips = ['All', 'Key results', 'Tasks', 'Decisions', 'Load'].map(v => ({ label: v, style: chip(s.area === v), go: () => this.setState({ area: v }) }));

    const ageText = h => h < 24 ? h + ' h' : Math.round(h / 24) + ' d';
    const itemView = a => {
      const on = s.sel === a.id;
      const flags = [];
      if (a.escalated) flags.push({ label: 'Escalated to ' + S.member(a.escalateTo).name, style: 'background: #B42318; color: #FFFFFF;' });
      if (a.back) flags.push({ label: 'Back from snooze', style: 'background: #F4ECDD; color: #7A4B00;' });
      if (a.status === 'snoozed') flags.push({ label: 'Snoozed until ' + S.shortDate(a.snoozeUntil), style: 'background: #EFECE4; color: #3D3A33;' });
      if (a.status === 'handled') flags.push({ label: 'Handled', style: 'background: #E6F2EA; color: #1E5E38;' });
      if (a.assignee !== a.pid) flags.push({ label: 'Assigned by triage', style: 'background: #F6F4EF; color: #5E5B53;' });
      return Object.assign({}, a, {
        flags: flags.map(f => ({ label: f.label, style: 'display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 600; white-space: nowrap; ' + f.style })),
        dot: 'width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; margin-top: 5px; background: ' + SEVC[a.sev],
        age: ageText(a.ageH), who: a.assigneeName + (a.assignee === me ? ' (you)' : ''),
        rowStyle: 'display: grid; grid-template-columns: 14px minmax(0, 1fr) 130px 56px; gap: 12px; align-items: start; width: 100%; padding: 14px 16px; border: 0; border-top: 1px solid #EFEBE3; text-align: left; font: inherit; color: #1B1B18; cursor: pointer; ' +
          (on ? 'background: #FBF6EC; box-shadow: inset 3px 0 0 #D9B46A;' : a.escalated ? 'background: #FFF8F6;' : 'background: #FFFFFF;'),
        pick: () => { this.draft = ''; this.setState({ sel: a.id, handling: false }); }
      });
    };

    let groups = [], empty = '';
    let visible = [];
    if (s.tab !== 'resolved') {
      visible = all.filter(inTab[s.tab]).filter(a => (s.sev === 'All' || a.sev === s.sev) && (s.area === 'All' || a.area === s.area));
      groups = SEV.map(v => ({ label: v, count: visible.filter(a => a.sev === v).length, dot: 'width: 8px; height: 8px; border-radius: 50%; background: ' + SEVC[v], items: visible.filter(a => a.sev === v).map(itemView) })).filter(g => g.items.length);
      if (!visible.length) empty = s.tab === 'mine' && !me ? 'Pick your name under “You are” in the sidebar to see the alerts assigned to you.'
        : s.tab === 'mine' ? 'Nothing assigned to you. Inbox zero.' : s.tab === 'escalated' ? 'No escalated alert. Every Critical and High alert is being handled in time.'
        : s.tab === 'snoozed' ? 'No snoozed alert.' : s.tab === 'handled' ? 'No alert marked handled.' : 'No open alert matches these filters.';
    }
    const resolvedRows = resolved.map(d => {
      const last = (d.log || [])[d.log.length - 1];
      return { subject: d.subject, alert: d.alert, person: S.member(d.pid).name, when: d.lastAt ? S.dayLabel(d.lastAt) : '—', last: last ? S.member(last.by).name + ' ' + last.what : '', dot: 'width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; background: #2E7D4F' };
    });
    if (s.tab === 'resolved' && !resolvedRows.length) empty = 'An alert lands here when the data behind it is fixed: the task is unblocked, the KR checked in, the decision taken. Nothing yet.';

    // detail panel
    const a = all.find(x => x.id === s.sel);
    let d = null;
    if (a) {
      const ownerOpts = S.members.map(m => ({ v: m.id, l: m.name + ' · ' + m.role, sel: m.id === a.assignee }));
      const fri = S.weekFriday(S.week);
      const snoozeOpts = [{ v: '', l: 'Snooze…', sel: true }, { v: S.iso(new Date(S.today.getTime() + 86400000)), l: 'Until tomorrow', sel: false },
        { v: fri, l: 'Until the Weekly Review (' + S.shortDate(fri) + ')', sel: false }, { v: S.iso(new Date(S.today.getTime() + 7 * 86400000)), l: 'For one week', sel: false }];
      const log = (a.log || []).slice().reverse().map(l => ({ text: (S.member(l.by).name || 'Someone') + ' ' + l.what, when: S.dayLabel(l.at) }));
      log.push({ text: 'Alert raised by the rule “' + a.ruleName + '”', when: a.since });
      const escLine = a.escalated ? 'Escalated to ' + S.member(a.escalateTo).name + ': open for ' + ageText(a.ageH) + ', beyond the ' + S.escHours() + ' h limit.'
        : a.escIn !== null ? 'Escalates to ' + S.member(S.lead(a.assignee)).name + (a.escIn <= 1 ? ' within the hour' : ' in ' + a.escIn + ' h') + ' if nobody acts.' : (a.sev === 'Critical' || a.sev === 'High') ? '' : 'Medium and Low alerts never escalate. They go to the Friday digest.';
      const ro = S.readOnly;
      d = {
        title: a.subject, alert: a.alert, detail: a.detail, sev: a.sev, sevStyle: 'display: inline-block; padding: 3px 10px; border-radius: 999px; font-size: 12px; font-weight: 600; ' + SEVP[a.sev],
        area: a.area, person: a.person, since: a.since, age: ageText(a.ageH), status: a.status === 'open' ? (a.back ? 'Open · back from snooze' : 'Open') : a.status === 'snoozed' ? 'Snoozed until ' + S.shortDate(a.snoozeUntil) : 'Handled',
        escLine, escStyle: 'font-size: 13px; line-height: 1.5; padding: 10px 12px; border-radius: 8px; ' + (a.escalated ? 'background: #FDECEA; color: #9B1C12; font-weight: 600;' : 'background: #F6F4EF; color: #5E5B53;'),
        hasEsc: !!escLine,
        ownerOpts, snoozeOpts, log,
        openLabel: TO[a.to] || 'Open',
        open: () => { if (a.to === 'roadmap') S.openKr(a.ref); else if (a.to === 'decisions') S.goto('decisions', a.ref.charAt(0) === 't' ? null : a.ref); else S.goto('monjour', a.pid); },
        notMine: a.assignee !== me,
        take: () => { if (!me) return; S.inboxAct(a, 'take', { assignee: me, status: a.status === 'handled' ? 'handled' : 'open' }); },
        canTake: !!me && a.assignee !== me,
        assign: e => { const v = e.target.value; if (v && v !== a.assignee) S.inboxAct(a, 'assign', { assignee: v }, S.member(v).name); },
        snooze: e => { const v = e.target.value; if (v) S.inboxAct(a, 'snooze', { status: 'snoozed', snoozeUntil: v }, S.shortDate(v)); },
        isOpen: a.status === 'open', isDone: a.status !== 'open',
        reopen: () => S.inboxAct(a, 'reopen', { status: 'open', snoozeUntil: '' }),
        handling: s.handling,
        startHandle: () => this.setState({ handling: true }),
        cancelHandle: () => this.setState({ handling: false }),
        draftIn: e => { this.draft = e.target.value; },
        confirmHandle: () => { S.inboxAct(a, 'handled', { status: 'handled', snoozeUntil: '', note: this.draft || a.note }); this.draft = ''; this.setState({ handling: false }); },
        note: a.note,
        setNote: e => S.inboxAct(a, 'note', { note: e.target.value }),
        toDecision: () => {
          const links = { kr: [], task: [], del: [] };
          if (a.to === 'roadmap') links.kr.push(a.ref);
          const t = S.get('tasks', a.ref); if (t) { links.task.push(t.id); if (t.kr) links.kr.push(t.kr); }
          const id = S.createDecision({ title: a.alert + ': ' + a.subject, question: 'What do we do about “' + a.subject + '”?', owner: a.assignee, source: 'From the Inbox · ' + a.alert, links,
            frame: { problem: a.detail, vars: [{ name: '', w: 34, ctx: '' }, { name: '', w: 33, ctx: '' }, { name: '', w: 33, ctx: '' }], opts: [{ name: '', desc: '', sc: [0, 0, 0] }, { name: '', desc: '', sc: [0, 0, 0] }, { name: '', desc: '', sc: [0, 0, 0] }] } });
          S.inboxAct(a, 'decision', { status: 'handled', note: a.note || 'Tracked as a decision.' });
          S.goto('decisions', id);
        },
        toTask: () => {
          const t = S.get('tasks', a.ref);
          const kr = a.to === 'roadmap' ? a.ref : t ? t.kr : '';
          S.save('tasks', { title: 'Fix: ' + a.subject, kr: kr || '', init: -1, owner: a.assignee, due: S.iso(new Date(S.today.getTime() + 86400000)), est: 1, status: 'todo', start: null, end: null, kind: 'L', unc: 'C', note: 'From the Inbox · ' + a.alert, since: '' });
          S.inboxAct(a, 'task', { status: 'handled', note: a.note || 'Fix task created for ' + S.member(a.assignee).name + '.' });
        },
        ro
      };
    }
    const openN = all.filter(x => x.status === 'open').length;
    const escN = all.filter(x => x.escalated).length;
    const critN = all.filter(x => x.status === 'open' && x.sev === 'Critical').length;
    return {
      info: !!s.info, openInfo: () => this.setState({ info: true }), closeInfo: () => this.setState({ info: false }),
      eyebrow: 'Q4 2026 · ' + S.wl(S.week) + ' · week ' + S.week + ' of 13 · ' + S.today.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }),
      stats: [
        { n: openN, l: 'open alerts', style: 'font-family: Fraunces, Georgia, serif; font-size: 34px; line-height: 1; color: #1B1B18' },
        { n: critN, l: 'critical', style: 'font-family: Fraunces, Georgia, serif; font-size: 34px; line-height: 1; color: ' + (critN ? '#9B1C12' : '#1B1B18') },
        { n: escN, l: 'escalated', style: 'font-family: Fraunces, Georgia, serif; font-size: 34px; line-height: 1; color: ' + (escN ? '#9B1C12' : '#1B1B18') },
        { n: resolved.length, l: 'resolved by the data', style: 'font-family: Fraunces, Georgia, serif; font-size: 34px; line-height: 1; color: #1E5E38' }
      ],
      tabs, sevChips, areaChips, groups, isResolved: s.tab === 'resolved', notResolved: s.tab !== 'resolved', resolvedRows,
      empty, hasEmpty: !!empty, d, hasSel: !!d, noSel: !d,
      escRule: 'Critical and High alerts escalate after ' + S.escHours() + ' h without action (Settings).'
    };
  }
}
