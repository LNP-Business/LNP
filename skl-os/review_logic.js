class Component extends DCLogic {
  constructor(props) {
    super(props);
    this.state = { view: 'week', step: 1, info: false, open: null };
    this.ci = {};
    this.add = {};
    this.msHint = {};
    this.nm = {};
    this.taskMsg = '';
  }
  renderVals() {
    const S = window.SKL;
    const s = this.state;
    // the week under review (Romain 2026-11-02): once a week's review is closed, the screen moves on to the next week
    let W = S.week;
    while (W < 13) { const rv = S.get('reviews', S.reviewId(W)); if (rv && rv.status === 'closed') W++; else break; }
    const rid = S.reviewId(W);
    const me = S.me;
    const krs = S.list('krs');
    const tasks = S.list('tasks');
    const reviews = S.list('reviews');
    const prev = reviews.filter(r => r.status === 'closed' && r.week < W).sort((a, b) => b.week - a.week)[0] || null;
    const stored = S.get('reviews', rid);
    const base = () => ({ id: rid, week: W, date: S.weekSaturday(W), status: 'draft', facilitator: me || 'romain', startedBy: me || '',
      recovery: {}, triage: {}, rescheduled: {}, notes: '' });
    const r = stored ? JSON.parse(JSON.stringify(stored)) : base();
    const closed = r.status === 'closed';
    // no step can be done before the review itself: it opens on its Saturday, or earlier when a lead starts it in the room
    const reviewDay = S.weekSaturday(W), started = closed || !!r.startedAt || S.iso(S.today) >= reviewDay;
    const put = mut => { const x = stored ? JSON.parse(JSON.stringify(S.get('reviews', rid))) : base(); mut(x); S.save('reviews', x); };
    const nextSat = S.weekSaturday(Math.min(13, W + 1));
    const FIELD = 'font: inherit; font-size: 14px; padding: 8px 10px; border: 1px solid #1B1B18; background: #1B1B18; color: #FFFFFF; caret-color: #FFFFFF; border-radius: 8px; width: 100%; box-sizing: border-box; min-width: 0';
    const pill = (txt, st) => ({ label: txt, style: 'display: inline-block; white-space: nowrap; padding: 3px 10px; border-radius: 999px; font-size: 12px; font-weight: 600; ' + st });
    const OK = 'background: #E6F2EA; color: #1E5E38;', WARN = 'background: #FDF1E3; color: #8A3F06;', BAD = 'background: #FDECEA; color: #9B1C12;', NEU = 'background: #EFECE4; color: #3D3A33;';
    const memberOpts = cur => S.members.map(m => ({ v: m.id, l: m.name, sel: m.id === cur }));

    // ---- step 1: check-ins ----
    const ciRows = krs.map(k => {
      const done = S.checkedThisWeek(k), last = S.lastCheck(k), st = S.krStatus(k);
      const f = this.ci[k.id] || (this.ci[k.id] = { value: '', conf: '', moved: '', blocks: '' });
      // Actual = the value before this week's check-in (Romain 2026-10-31: compare before and after the weekly report)
      const ch = k.checkins || [], before = ch.filter(c => c.week < W).slice(-1)[0], now = ch.filter(c => c.week === W).slice(-1)[0];
      const actualV = done ? (before ? before.value : k.baseline) : (last ? last.value : (k.current !== undefined ? k.current : k.baseline));
      const diff = done && now && actualV !== undefined && actualV !== '' && actualV !== null ? Math.round((Number(now.value) - Number(actualV)) * 100) / 100 : null;
      const set = key => e => { f[key] = e.target.value; };
      return {
        name: k.name, owner: S.member(k.owner).name, done, todo: !done,
        last: last ? S.fmtVal(last.value, k.unit) + ' · ' + S.dayLabel(last.date) + ' · confidence ' + last.conf + '/10' : 'No check-in yet',
        badge: done ? pill('Checked in', OK) : pill(st.key === 'stale' ? 'Missing · ' + st.age + ' d' : 'Missing this week', BAD),
        actual: S.fmtVal(actualV, k.unit),
        compare: done && now ? 'Actual before ' + S.fmtVal(actualV, k.unit) + ' → new value ' + S.fmtVal(now.value, k.unit) + (diff === null ? '' : ' (' + (diff > 0 ? '+' : diff < 0 ? '−' : '±') + (k.unit === 'pct' ? Math.abs(diff) + ' pts' : S.fmtVal(Math.abs(diff), k.unit)) + ')') : '',
        compareStyle: 'font-size: 13px; font-weight: 600; color: ' + (diff === null || diff === 0 ? '#5E5B53' : (diff > 0) === (k.kind !== 'ceiling') ? '#1E5E38' : '#9B1C12'),
        unit: k.unit === 'pct' ? '%' : k.unit === 'eur' ? '€' : k.unit === 'eur2' ? '€' : k.unit === 'usd' ? '$' : '',
        setValue: set('value'), setConf: set('conf'), setMoved: set('moved'), setBlocks: set('blocks'),
        save: () => {
          if (f.value === '' || isNaN(Number(f.value))) return;
          const kk = JSON.parse(JSON.stringify(k));
          kk.checkins = (kk.checkins || []).concat([{ week: W, date: S.iso(S.today), value: Number(f.value), conf: Number(f.conf) || '', moved: f.moved, blocks: f.blocks, prios: [] }]);
          kk.current = Number(f.value);
          S.save('krs', kk);
          this.ci[k.id] = { value: '', conf: '', moved: '', blocks: '' };
        }
      };
    });
    const ciDone = ciRows.filter(x => x.done).length;

    // ---- step 2: scoreboard + recovery plans ----
    const board = krs.map(k => {
      const v = S.krView(k);
      v.open = () => S.openKr(k.id);
      v.rowStyle = v.rowStyle.replace('grid-template-columns: 250px 260px 120px minmax(0, 1fr) 96px; gap: 18px', 'grid-template-columns: minmax(0, 1.1fr) 200px 96px minmax(0, 1fr) 104px; gap: 14px');
      const needs = v.key === 'red' || v.key === 'stale';
      const plan = (r.recovery || {})[k.id] || { plan: '', owner: k.owner, due: S.iso(new Date(S.today.getTime() + 2 * 86400000)) };
      // a change to the plan asks for its validation again
      const setP = key => e => { const val = e.target.value; put(x => { x.recovery = x.recovery || {}; const n = Object.assign({}, plan, { [key]: val }); delete n.validated; delete n.kept; x.recovery[k.id] = n; }); };
      v.needs = needs; v.plan = plan.plan; v.planOwnerOpts = memberOpts(plan.owner); v.planDue = plan.due;
      v.setPlan = setP('plan'); v.setPlanOwner = setP('owner'); v.setPlanDue = setP('due');
      // Romain 2026-11-01: the room validates the proposed plan, or keeps the key result as it is because it is not a priority;
      // either one settles the key result for the scoreboard
      const ready = !!plan.plan && !!plan.owner, val = !!plan.validated, kept = !!plan.kept;
      const mark = (f, on) => put(x => { x.recovery = x.recovery || {}; const n = Object.assign({}, plan); delete n.validated; delete n.kept; if (on) n[f] = { at: S.iso(S.today), by: me || '' }; x.recovery[k.id] = n; });
      v.planOk = needs && (val || kept);
      v.validatePlan = () => { if (closed || !ready) return; mark('validated', !val); };
      v.keepIt = () => { if (closed) return; mark('kept', !kept); };
      v.valLabel = val ? '✓ Plan validated' : 'Validate the plan';
      v.keepLabel = kept ? '✓ Kept as is · not a priority' : 'Keep as is · not a priority';
      const B2 = 'min-height: 36px; padding: 0 14px; border-radius: 9px; font: inherit; font-size: 13px; font-weight: 600; cursor: pointer; ';
      v.valStyle = B2 + (val ? 'border: 1px solid #2E7D4F; background: #2E7D4F; color: #FFFFFF;' : ready ? 'border: 1px solid #1B1B18; background: #1B1B18; color: #D9B46A;' : 'border: 1px solid #D8D3C7; background: #ECE8DF; color: #8E8A80; cursor: not-allowed;');
      v.keepStyle = B2 + (kept ? 'border: 1px solid #5E5B53; background: #5E5B53; color: #FFFFFF;' : 'border: 1px solid #D8D3C7; background: #FFFFFF; color: #1B1B18;');
      v.planState = val ? 'Validated ' + S.dayLabel(plan.validated.at) + ' by ' + S.member(plan.validated.by).name + '.' : kept ? 'No recovery plan this week: it is not a priority. It comes back next Saturday.' : ready ? 'Validate the plan in the room, or keep the key result as it is.' : 'Write the plan and its owner to validate it, or keep the key result as it is.';
      v.planLabel = v.key === 'red' ? 'Recovery plan · required within 48 h for a red KR' : 'Plan to get the data back · no check-in means no steering';
      return v;
    });
    const needPlans = board.filter(b => b.needs), plansOk = needPlans.filter(b => b.planOk).length;

    // ---- step 1: alert triage and the tasks still open this week; a task is deleted in one click and Enter (Romain 2026-10-31) ----
    const delTask = (t, after) => {
      if (!t) return;
      S.confirm({ title: 'Delete this task?', body: '“' + t.title + '” (' + S.member(t.owner).name + ') will be deleted. Press Enter to confirm.', ok: 'Delete', quick: true,
        onOk: () => { const res = S.taskDelete(t.id, { review: true }); this.taskMsg = res.ok ? '' : res.why; if (res.ok && after) after(); this.setState({}); } });
    };
    const weekEnd = S.weekSaturday(W);
    // this week's open tasks, or every open task (Romain 2026-11-01: an admin deletes anyone's task in the review)
    const allT = !!this.allTasks;
    const remTasks = tasks.filter(t => S.isOpen(t) && t.status !== 'split' && (allT || (t.due && t.due <= weekEnd)))
      .sort((a, b) => ((a.due || '9') < (b.due || '9') ? -1 : (a.due || '9') > (b.due || '9') ? 1 : 0)).map(t => {
        const late = S.daysFromToday(t.due) < 0, kr = t.kr ? S.get('krs', t.kr) : null;
        return { title: t.title, meta: S.member(t.owner).name + (t.due ? ' · due ' + S.dayLabel(t.due) : ' · no due date') + (kr ? ' · KR ' + S.krNumber(kr) : ''),
          badge: late ? pill('Overdue', BAD) : t.due && t.due <= weekEnd ? pill('Due this week', WARN) : pill(t.due ? 'Later' : 'No date', NEU), del: () => delTask(t), canDel: S.canDeleteTask(t) };
      });
    const hot = S.inbox().filter(a => (a.sev === 'Critical' || a.sev === 'High') && (a.status === 'open' || (r.triage || {})[a.id]));
    const tri = (a, what, patch, extra, outcome) => { S.inboxAct(a, what, patch, extra); put(x => { x.triage = x.triage || {}; x.triage[a.id] = outcome; }); };
    const triage = hot.map(a => {
      const out = (r.triage || {})[a.id];
      return {
        sev: a.sev, alert: a.alert, subject: a.subject, detail: a.detail, who: a.assigneeName, age: a.ageH < 24 ? a.ageH + ' h' : Math.round(a.ageH / 24) + ' d',
        dot: 'width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; margin-top: 5px; background: ' + (a.sev === 'Critical' ? '#B42318' : '#B45309'),
        done: !!out, todo: !out, outcome: out ? pill(out, OK) : pill(a.escalated ? 'Escalated · decide now' : 'To triage', a.escalated ? BAD : WARN),
        ownerOpts: memberOpts(a.assignee),
        assign: e => { const v = e.target.value; tri(a, 'assign', { assignee: v }, S.member(v).name, 'Assigned to ' + S.member(v).name + ' in review'); },
        keep: () => tri(a, 'assign', { assignee: a.assignee }, a.assigneeName + ' (confirmed in review)', 'Owner confirmed: ' + a.assigneeName),
        snooze: () => tri(a, 'snooze', { status: 'snoozed', snoozeUntil: nextSat }, S.shortDate(nextSat), 'Snoozed to next review'),
        decide: () => {
          const links = { kr: a.to === 'roadmap' ? [a.ref] : [], task: S.get('tasks', a.ref) ? [a.ref] : [], del: [] };
          S.createDecision({ title: a.alert + ': ' + a.subject, question: 'What do we do about “' + a.subject + '”?', owner: a.assignee, source: 'Weekly Review W' + W, links,
            deadline: S.iso(new Date(S.today.getTime() + 2 * 86400000)),
            frame: { problem: a.detail, vars: [{ name: '', w: 34, ctx: '' }, { name: '', w: 33, ctx: '' }, { name: '', w: 33, ctx: '' }], opts: [{ name: '', desc: '', sc: [0, 0, 0] }, { name: '', desc: '', sc: [0, 0, 0] }, { name: '', desc: '', sc: [0, 0, 0] }] } });
          tri(a, 'decision', { status: 'handled' }, '', 'Turned into a decision');
        },
        handled: () => tri(a, 'handled', { status: 'handled', note: 'Settled in the Weekly Review W' + W }, '', 'Settled in the room'),
        hasTask: !!S.get('tasks', a.ref), delTask: () => delTask(S.get('tasks', a.ref), () => tri(a, 'handled', { status: 'handled', note: 'Task deleted in the Weekly Review W' + W }, '', 'Task deleted'))
      };
    });
    const triDone = triage.filter(t => t.done).length;

    // ---- step 4: decisions ----
    const decs = S.list('decisions').filter(d => (d.col === 'todo' && d.deadline && d.deadline <= nextSat) || (d.col === 'review' && d.review && d.review <= nextSat) || (r.rescheduled || {})[d.id]);
    const decRows = decs.map(d => {
      const late = d.col === 'todo' && S.daysFromToday(d.deadline) < 0;
      const res = (r.rescheduled || {})[d.id];
      const settled = d.col === 'done' || !!res;
      return {
        title: d.title, owner: S.member(d.owner).name, rev: d.col === 'review' ? 'Review due ' + S.shortDate(d.review) : (d.reversible ? 'Reversible' : 'Irreversible') + ' · due ' + S.shortDate(d.deadline),
        badge: d.col === 'done' ? pill('Decided', OK) : res ? pill(res, OK) : late ? pill('Overdue', BAD) : d.col === 'review' ? pill('Review due', WARN) : pill('Due this week', WARN),
        settled, open: () => S.goto('decisions', d.id), isTodo: d.col === 'todo', deadline: d.deadline,
        setDeadline: e => { const v = e.target.value; if (!v) return; const dd = JSON.parse(JSON.stringify(d)); dd.deadline = v; S.save('decisions', dd); put(x => { x.rescheduled = x.rescheduled || {}; x.rescheduled[d.id] = 'New deadline ' + S.shortDate(v); }); }
      };
    });
    const decDone = decRows.filter(x => x.settled).length;

    // ---- step 5: weekly milestones: tick each mini goal, then done or not done (a miss names its cause) ----
    const CAUSES = S.msCauses;
    const saveMs = (kid, i, mut) => {
      const kk = JSON.parse(JSON.stringify(S.get('krs', kid))), mm = kk.miles && kk.miles[i]; if (!mm) return;
      mm.doneDef = S.msGoals(mm); mut(mm); mm.done = mm.status === 'done';
      ['status', 'cause'].forEach(f => { if (!mm[f]) delete mm[f]; });
      S.save('krs', kk);
    };
    const BTN = 'min-height: 36px; padding: 0 14px; border-radius: 9px; font: inherit; font-size: 13px; font-weight: 600; cursor: pointer; ';
    const msRows = [];
    krs.forEach(k => (k.miles || []).forEach((m, i) => {
      const st = S.msStatus(m);
      // this week's milestones; an earlier one only while it still waits for its verdict (a closed review settled the others)
      if (m.week > W || (m.week < W && st !== 'review')) return;
      const key = k.id + ':' + i, goals = S.msGoals(m), okN = goals.filter(g => g.ok).length, all = goals.length > 0 && okN === goals.length;
      const verdict = m.status === 'done' || (m.done && m.status !== 'notdone') ? 'done' : m.status === 'notdone' ? 'notdone' : '';
      const setVerdict = v => {
        if (v === 'done' && goals.length && !all) { this.msHint[key] = 'Tick every mini goal to mark it done (' + okN + ' of ' + goals.length + ' reached). Otherwise it is not done: name the cause.'; this.setState({}); return; }
        delete this.msHint[key];
        const next = verdict === v ? '' : v;
        saveMs(k.id, i, mm => { mm.status = next; if (next !== 'notdone') mm.cause = ''; });
        put(x => { x.ms = x.ms || {}; x.ms[key] = { status: next, week: m.week }; });
      };
      msRows.push({
        eyebrow: S.wl(m.week) + (m.week < W ? ' · week over' : ' · due ' + S.msBy(m).split(' of ')[0]) + ' · KR ' + S.krNumber(k),
        formula: S.msFormula(m, k), meta: S.member(m.owner || k.owner).name + (m.rag && !verdict ? ' · Wednesday status ' + m.rag : '') + (m.proof ? ' · proof: ' + m.proof : ''),
        badge: verdict === 'done' ? pill('Done', OK) : verdict === 'notdone' ? pill('Not done' + (m.cause ? ' · ' + m.cause : ''), BAD) : pill(m.week < W ? 'Verdict due' : 'Due Sunday', WARN),
        goals: goals.map((g, j) => ({
          t: g.t, ok: g.ok ? 'true' : 'false', mark: g.ok ? '✓' : '',
          toggle: () => { delete this.msHint[key]; saveMs(k.id, i, mm => { mm.doneDef[j].ok = !mm.doneDef[j].ok; if (mm.status === 'done' && !mm.doneDef[j].ok) mm.status = ''; }); },
          style: 'display: flex; gap: 10px; align-items: center; width: 100%; text-align: left; padding: 8px 10px; border-radius: 8px; font: inherit; font-size: 14px; cursor: pointer; color: #1B1B18; ' + (g.ok ? 'border: 1px solid #2E7D4F; background: #E6F2EA;' : 'border: 1px solid #E3DFD5; background: #FFFFFF;'),
          boxStyle: 'width: 20px; height: 20px; flex-shrink: 0; border-radius: 5px; display: inline-flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; ' + (g.ok ? 'background: #2E7D4F; color: #FFFFFF;' : 'border: 1.5px solid #8E8A80; background: #FFFFFF;')
        })),
        noGoals: !goals.length, count: goals.length ? okN + ' of ' + goals.length + ' mini goals reached' : 'No mini goal defined: add them in Build',
        doneGo: () => setVerdict('done'), notGo: () => setVerdict('notdone'),
        doneStyle: BTN + (verdict === 'done' ? 'border: 1px solid #2E7D4F; background: #2E7D4F; color: #FFFFFF;' : 'border: 1px solid #D8D3C7; background: #FFFFFF; color: #1B1B18;'),
        notStyle: BTN + (verdict === 'notdone' ? 'border: 1px solid #B42318; background: #B42318; color: #FFFFFF;' : 'border: 1px solid #D8D3C7; background: #FFFFFF; color: #1B1B18;'),
        isNot: verdict === 'notdone',
        causeOpts: [{ v: '', l: 'Cause of the miss?', sel: !m.cause }].concat(CAUSES.map(c => ({ v: c[0], l: c[1], sel: m.cause === c[0] }))),
        setCause: e => { const v = e.target.value; saveMs(k.id, i, mm => { mm.cause = v; }); },
        hint: this.msHint[key] || '', hasHint: !!this.msHint[key],
        settled: verdict === 'done' || (verdict === 'notdone' && !!m.cause), past: m.week < W,
        cardStyle: 'border: 1px solid ' + (verdict === 'done' ? '#B9DCC6' : verdict === 'notdone' ? '#F2C4BE' : '#E3DFD5') + '; border-radius: 12px; padding: 16px 18px; display: flex; flex-direction: column; gap: 12px'
      });
    }));
    msRows.sort((a, b) => (b.past - a.past));
    const msDone = msRows.filter(x => x.settled).length, msPast = msRows.filter(x => x.past);

    // ---- step 8: next week's milestones, made official (Romain 2026-10-31): validate those already built, pull one from a
    // later week, or create a new one; at most R.msWeek (3) per key result and week ----
    const NW = Math.min(13, W + 1);   // no maximum of milestones per key result in the review (Romain 2026-11-01)
    const saveKr = (kid, mut) => { const kk = JSON.parse(JSON.stringify(S.get('krs', kid))); delete kk.expected; kk.miles = kk.miles || []; mut(kk); S.save('krs', kk); };
    const newMsId = kk => { const ids = new Set(kk.miles.map(m => m.id)); let i = kk.miles.length; while (ids.has(kk.id + '-m' + i)) i++; return kk.id + '-m' + i; };
    const stamp = () => ({ week: NW, at: S.iso(S.today), by: me || '', review: rid });
    const nextRows = krs.map(k => {
      const ms = (k.miles || []).map((m, i) => ({ m, i })).filter(x => Number(x.m.week) === NW);
      const later = (k.miles || []).map((m, i) => ({ m, i })).filter(x => Number(x.m.week) > NW && !x.m.done && x.m.status !== 'done');
      const f = this.nm[k.id] || (this.nm[k.id] = { text: '', owner: k.owner, proof: '' });
      const okN = ms.filter(x => x.m.validated && x.m.validated.week === NW).length;
      return {
        kr: 'KR ' + S.krNumber(k) + ' · ' + k.name.replace(/^\d+\.\d+\s*[·.-]?\s*/, ''), owner: S.member(k.owner).name,
        badge: !ms.length ? pill('No milestone next week', NEU) : okN === ms.length ? pill('Official · ' + okN, OK) : pill(okN + ' / ' + ms.length + ' validated', WARN),
        items: ms.map(x => {
          const on = !!(x.m.validated && x.m.validated.week === NW);
          return { text: S.msFormula(x.m, k), meta: S.member(x.m.owner || k.owner).name + ' · ' + (S.msGoals(x.m).length ? S.msGoals(x.m).length + ' mini goals' : 'no mini goal yet'),
            label: on ? '✓ Validated' : 'Validate', toggle: () => saveKr(k.id, kk => { const mm = kk.miles[x.i]; if (on) delete mm.validated; else mm.validated = stamp(); }),
            style: 'min-height: 36px; padding: 0 14px; border-radius: 9px; font: inherit; font-size: 13px; font-weight: 600; cursor: pointer; white-space: nowrap; ' + (on ? 'border: 1px solid #2E7D4F; background: #2E7D4F; color: #FFFFFF;' : 'border: 1px solid #D8D3C7; background: #FFFFFF; color: #1B1B18;') };
        }),
        none: !ms.length, canAdd: true, full: false, hasLater: later.length > 0,
        laterOpts: [{ v: '', l: 'Bring forward a milestone already built…', sel: true }].concat(later.map(x => ({ v: String(x.i), l: S.wl(x.m.week) + ' · ' + (x.m.text || '').slice(0, 80), sel: false }))),
        pull: e => { const i = Number(e.target.value); if (!(i >= 0)) return; saveKr(k.id, kk => { kk.miles[i].week = NW; kk.miles[i].validated = stamp(); }); },
        ownerOpts: memberOpts(f.owner),
        setText: e => { f.text = e.target.value; }, setOwner: e => { f.owner = e.target.value; }, setProof: e => { f.proof = e.target.value; },
        add: () => {
          const text = (f.text || '').trim(); if (!text) return;
          const dd = String(f.proof || '').split(/[;\n]/).map(x => x.trim()).filter(Boolean).map(t => ({ t, ok: false }));
          saveKr(k.id, kk => { kk.miles.push({ id: newMsId(kk), week: NW, text, owner: f.owner || k.owner, doneDef: dd, validated: stamp() }); });
          this.nm[k.id] = { text: '', owner: k.owner, proof: '' };
        },
        done: okN === ms.length, none: !ms.length, k
      };
    });
    // Romain 2026-11-01: a key result may have no milestone next week (others come first); the step is validated once, and the
    // key results left without one are shown first in a confirmation: their risk, the milestones they reached so far and their
    // last 3 weeks
    const unvalidated = nextRows.filter(x => !x.done).length, bare = nextRows.filter(x => x.none);
    const nextOk = !!(r.nextOk && r.nextOk.week === NW);
    const krBrief = k => {
      const past = (k.miles || []).filter(m => Number(m.week) < W + 1 && Number(m.week) <= W), done = past.filter(m => S.msStatus(m) === 'done').length;
      const by = S.krWeeks(k), wks = [W - 2, W - 1, W].filter(q => q >= 1), st = S.krStatus(k);
      const vals = wks.map(q => by[q] && by[q].value !== '' && by[q].value != null ? Number(by[q].value) : null);
      const known = vals.filter(v => v !== null), trend = known.length >= 2 ? known[known.length - 1] - known[0] : null;
      const lower = k.kind === 'ceiling', good = trend === null || trend === 0 ? null : (trend > 0) !== lower;
      const esc = t => String(t == null ? '' : t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
      return '<div style="border:1px solid #E3DFD5;border-radius:10px;padding:10px 12px;display:flex;flex-direction:column;gap:6px">' +
        '<div style="display:flex;justify-content:space-between;gap:10px"><b style="color:#1B1B18">KR ' + esc(S.krNumber(k)) + ' · ' + esc(k.name.replace(/^\d+\.\d+\s*[·.-]?\s*/, '')) + '</b>' +
        '<span style="white-space:nowrap;font-size:12px;font-weight:600;color:' + (st.key === 'red' ? '#9B1C12' : st.key === 'amber' ? '#8A3F06' : st.key === 'green' ? '#1E5E38' : '#5E5B53') + '">' + esc(st.label || st.key) + '</span></div>' +
        '<div style="font-size:13px;color:#3D3A33">Milestones reached so far: <b>' + done + ' of ' + past.length + '</b>' + (past.length ? '' : ' (none planned before)') + ' · owner ' + esc(S.member(k.owner).name) + '</div>' +
        '<div style="font-size:13px;color:#3D3A33;display:flex;gap:12px;flex-wrap:wrap">' + wks.map((q, i) => '<span>' + S.wl(q) + ' <b style="font-family:IBM Plex Mono,monospace">' + (vals[i] === null ? '—' : esc(S.fmtVal(vals[i], k.unit))) + '</b></span>').join('<span>→</span>') +
        '<span style="color:' + (good === null ? '#5E5B53' : good ? '#1E5E38' : '#9B1C12') + ';font-weight:600">' + (trend === null ? 'not enough measures' : trend === 0 ? 'flat' : (good ? 'improving' : 'getting worse')) + '</span>' +
        '<span style="color:#5E5B53">target ' + esc(S.fmtVal(k.target, k.unit)) + '</span></div></div>';
    };
    // validating the step makes every milestone listed for next week official at once: none has to be validated one by one
    const msCount = nextRows.reduce((n, x) => n + x.items.length, 0);
    const validateNext = () => {
      if (closed) return;
      const save = () => {
        nextRows.filter(x => !x.done && !x.none).forEach(x => saveKr(x.k.id, kk => kk.miles.forEach(m => { if (Number(m.week) === NW && !(m.validated && m.validated.week === NW)) m.validated = stamp(); })));
        put(x => { x.nextOk = { week: NW, at: S.iso(S.today), by: me || '', without: bare.map(b => b.k.id) }; });
      };
      if (!bare.length) return save();
      S.confirm({ title: bare.length + ' key result' + (bare.length > 1 ? 's' : '') + ' without a milestone in ' + S.wl(NW) + '?', ok: 'Validate anyway', width: 640,
        body: 'Nothing is planned next week to move ' + (bare.length > 1 ? 'these key results' : 'this key result') + '. The risk: the gap to the target grows a week, and the weeks left to catch up shrink.',
        html: '<div style="font-size:14px;line-height:1.55;color:#5E5B53">Nothing is planned in ' + S.wl(NW) + ' to move ' + (bare.length > 1 ? 'these key results' : 'this key result') +
          '. The risk: the gap to the target grows by a week, and the weeks left to catch up shrink. Check their record before you choose to leave them aside:</div>' +
          '<div style="display:flex;flex-direction:column;gap:8px;max-height:52vh;overflow:auto">' + bare.map(b => krBrief(b.k)).join('') + '</div>',
        onOk: save });
    };

    // ---- steps ----

    // ---- steps ----
    const ALL = [
      { n: 1, title: 'Check-ins', min: '10 min', done: ciDone === krs.length, count: ciDone + ' / ' + krs.length + ' KRs', why: 'Every key result gets its number for the week before anyone discusses it. No number, no steering.' },
      { n: 2, title: 'Scoreboard', min: '10 min', done: plansOk === needPlans.length, count: needPlans.length ? plansOk + ' / ' + needPlans.length + ' settled' : 'No red KR', why: 'Read every KR against its expected value. Every red or untracked KR is settled in the room: its recovery plan (owner, date) is validated, or it is kept as it is because it is not a priority.' },
      { n: 3, title: 'Alert triage', min: '10 min', done: triDone === triage.length, count: triage.length ? triDone + ' / ' + triage.length + ' alerts' : 'Nothing open', why: 'The work first: every Critical and High alert still open gets an outcome in the room (owner confirmed, reassigned, snoozed, decided, settled or its task deleted), then the tasks still open this week are kept or deleted.' },
      { n: 4, title: 'Decisions', min: '5 min', done: decDone === decRows.length, count: decRows.length ? decDone + ' / ' + decRows.length + ' decisions' : 'Nothing due', why: 'Overdue decisions and those due before next Saturday: decide now or set a new date in front of everyone.' },
      { n: 5, title: 'Milestones', min: '10 min', done: msPast.every(x => x.settled), count: msRows.length ? msDone + ' / ' + msRows.length + ' closed' : 'None due', why: 'Every weekly milestone is closed on its mini goals: tick each one reached. All ticked is done; anything else is not done, with its cause. A miss is data, not a debate.' },
      null, null,
      { n: 8, title: 'Next milestones', min: '10 min', done: nextOk, count: nextOk ? 'Validated' : msCount + ' milestone' + (msCount === 1 ? '' : 's'), why: 'The milestones of ' + S.wl(NW) + ' are made official: validate those already built, bring one forward from a later week, or create new ones. There is no minimum and no maximum: a key result may have none next week when others come first, and the validation shows what that risks.' }
    ];
    // the order of the room (Romain 2026-10-31): tasks (alert triage), then milestones, then key results, …, then next milestones
    const ORDER = [3, 5, 1, 2, 4, 8], NSTEPS = ORDER.length;   // 6 and 7 were the promises (removed 2026-11-01)
    const STEPS = ORDER.map((c, j) => Object.assign({}, ALL[c - 1], { c, n: j + 1 }, started ? {} : { done: false }));
    const cur = STEPS[Math.min(s.step, NSTEPS) - 1], curC = cur.c;
    const doneN = STEPS.filter(x => x.done).length;
    const byC = c => STEPS.filter(x => x.c === c)[0];
    const canClose = !closed && started && byC(8).done;
    const startNow = () => S.confirm({ title: 'Start the review of ' + S.wl(W) + ' now?', body: 'It is planned on ' + S.parse(reviewDay).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }) + '. Starting it now opens every step for the whole team.', ok: 'Start now',
      onOk: () => put(x => { x.startedAt = S.iso(S.today); x.startedBy = me || ''; }) });
    const steps = STEPS.map(x => ({
      n: x.n, title: x.title, min: x.min, count: x.count, on: s.step === x.n,
      go: () => this.setState({ step: x.n }),
      style: 'display: grid; grid-template-columns: 30px minmax(0, 1fr); gap: 12px; align-items: start; width: 100%; padding: 12px 14px; border: 0; border-radius: 10px; text-align: left; font: inherit; color: #1B1B18; cursor: pointer; ' + (s.step === x.n ? 'background: #1B1B18; color: #FFFFFF;' : 'background: transparent;'),
      numStyle: 'width: 30px; height: 30px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 600; ' + (x.done ? 'background: #2E7D4F; color: #FFFFFF;' : s.step === x.n ? 'background: #D9B46A; color: #1B1B18;' : 'background: #E3DFD5; color: #3D3A33;'),
      num: x.done ? '✓' : String(x.n),
      subStyle: 'display: block; font-size: 12px; margin-top: 2px; color: ' + (s.step === x.n ? '#C9C4B7' : '#5E5B53')
    }));

    // ---- history ----
    const stats = S.milestoneStats();
    const hist = reviews.filter(x => x.status === 'closed').sort((a, b) => b.week - a.week).map(x => {
      const DOT = { green: '#2E7D4F', amber: '#B45309', red: '#B42318', stale: '#8E8A80', new: '#C9C4B7' };
      const openIt = s.open === x.id, wk = stats.filter(p => p.week === x.week)[0];
      return {
        week: 'Week ' + x.week, date: S.shortDate(x.date), by: S.member(x.facilitator).name,
        dots: (x.snapshot || []).map(k => ({ style: 'width: 12px; height: 12px; border-radius: 50%; background: ' + (DOT[k.status] || '#C9C4B7'), tip: k.name + ' · ' + k.status })),
        reached: wk ? wk.done + ' / ' + wk.total : '—', pct: wk ? wk.pct + '%' : '',
        triaged: Object.keys(x.triage || {}).length, plans: Object.keys(x.recovery || {}).length, made: (x.nextMs || []).length,
        gaps: x.gaps || '', hasGaps: !!x.gaps,
        toggle: () => this.setState({ open: openIt ? null : x.id }), isOpen: openIt, chev: openIt ? '▾' : '▸',
        msWeek: (x.msWeek || []).map(m => ({ who: 'KR ' + m.kr, text: m.text, res: m.status === 'done' ? 'Reached' : m.status === 'notdone' ? 'Not reached' + (m.cause ? ' · ' + m.cause : '') : '—', style: 'font-size: 13px; font-weight: 600; color: ' + (m.status === 'done' ? '#1E5E38' : '#9B1C12') })),
        nextMs: (x.nextMs || []).map(m => ({ who: 'KR ' + m.kr, text: m.text })),
        without: (x.nextOk && x.nextOk.without || []).map(id => 'KR ' + S.krNumber(S.get('krs', id) || { id })).join(', ')
      };
    });
    const bars = stats.map(p => ({ label: S.wl(p.week), pct: p.pct + '%', style: 'width: 36px; border-radius: 6px 6px 0 0; height: ' + Math.max(4, Math.round(p.pct * 0.9)) + 'px; background: ' + (p.pct >= 80 ? '#2E7D4F' : p.pct >= 60 ? '#B45309' : '#B42318') }));
    const lastPct = stats.length ? stats[stats.length - 1].pct : null;

    const statusPill = closed ? pill('Closed · ' + S.dayLabel(r.closedAt), OK) : stored ? pill('In progress · ' + doneN + ' / ' + NSTEPS + ' steps', WARN) : pill('Not started', NEU);
    const close = () => {
      if (!canClose) return;
      const gaps = STEPS.filter(x => !x.done).map(x => x.title + ' (' + x.count + ')').join(' · ');
      put(x => {
        x.status = 'closed'; x.closedAt = S.iso(S.today); x.closedBy = me || '';
        x.msWeek = []; x.nextMs = [];
        krs.forEach(k => (k.miles || []).forEach(m => {
          if (Number(m.week) === W) x.msWeek.push({ kr: S.krNumber(k), text: m.text || '', status: S.msStatus(m), cause: m.cause || '' });
          if (Number(m.week) === NW && m.validated && m.validated.week === NW) x.nextMs.push({ kr: S.krNumber(k), text: m.text || '', owner: m.owner || k.owner });
        }));
        x.snapshot = krs.map(k => { const st = S.krStatus(k); return { id: k.id, name: k.name, status: st.key, ratio: st.ratio === null || st.ratio === undefined ? null : Math.round(st.ratio * 100) / 100, value: k.current }; });
        x.gaps = gaps ? 'Closed with open points: ' + gaps : '';
      });
      this.setState({ view: 'history', open: rid });
    };
    const reopen = () => put(x => { x.status = 'draft'; x.closedAt = ''; });

    return {
      info: !!s.info, openInfo: () => this.setState({ info: true }), closeInfo: () => this.setState({ info: false }),
      eyebrow: 'Q4 2026 · ' + S.wl(W) + ' · week ' + W + ' of 13 · review on ' + S.parse(S.weekSaturday(W)).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }),
      title: 'Weekly Review · week ' + W,
      facilitator: 'Facilitator: ' + S.member(r.facilitator).name + ' · 45 minutes · the whole team',
      statusPill,
      isWeek: s.view === 'week', isHist: s.view === 'history',
      goWeek: () => this.setState({ view: 'week' }), goHist: () => this.setState({ view: 'history' }),
      tabWeek: 'min-height: 44px; padding: 0 20px; border: 0; border-radius: 9px; font: inherit; font-size: 15px; cursor: pointer; ' + (s.view === 'week' ? 'background: #1B1B18; color: #FFFFFF; font-weight: 600;' : 'background: transparent; color: #3D3A33; font-weight: 500;'),
      tabHist: 'min-height: 44px; padding: 0 20px; border: 0; border-radius: 9px; font: inherit; font-size: 15px; cursor: pointer; ' + (s.view === 'history' ? 'background: #1B1B18; color: #FFFFFF; font-weight: 600;' : 'background: transparent; color: #3D3A33; font-weight: 500;'),
      steps, cur, curN: s.step, nSteps: NSTEPS, is1: curC === 1, is2: curC === 2, is3: curC === 3, is4: curC === 4, is5: curC === 5, is6: curC === 6, is7: curC === 7, is8: curC === 8,
      prev: () => this.setState({ step: Math.max(1, s.step - 1) }), next: () => this.setState({ step: Math.min(NSTEPS, s.step + 1) }),
      hasPrev: s.step > 1, hasNext: s.step < NSTEPS,
      progress: doneN + ' of ' + NSTEPS + ' steps done', progressW: 'height: 6px; border-radius: 3px; background: #D9B46A; width: ' + Math.round(doneN / NSTEPS * 100) + '%',
      remTasks, noRem: !remTasks.length, remCount: remTasks.length ? remTasks.length + ' task' + (remTasks.length > 1 ? 's' : '') + (allT ? ' open' : ' still open this week') : '',
      showWeek: () => { this.allTasks = false; this.setState({}); }, showAll: () => { this.allTasks = true; this.setState({}); },
      tabTW: 'min-height: 32px; padding: 0 12px; border: 0; border-radius: 8px; font: inherit; font-size: 13px; cursor: pointer; ' + (!allT ? 'background: #1B1B18; color: #FFFFFF; font-weight: 600;' : 'background: transparent; color: #3D3A33;'),
      tabAll: 'min-height: 32px; padding: 0 12px; border: 0; border-radius: 8px; font: inherit; font-size: 13px; cursor: pointer; ' + (allT ? 'background: #1B1B18; color: #FFFFFF; font-weight: 600;' : 'background: transparent; color: #3D3A33;'), taskMsg: this.taskMsg, hasTaskMsg: !!this.taskMsg,
      nextRows, nextWeek: S.wl(NW),
      ciRows, board, triage, noTriage: !triage.length, decRows, noDecs: !decRows.length,
      msRows, noMs: !msRows.length,
      validateNext, nextOk, canValidate: !closed, validateLabel: nextOk ? '✓ Validated' + (r.nextOk.without && r.nextOk.without.length ? ' · ' + r.nextOk.without.length + ' KR without a milestone' : '') : 'Validate the milestones of ' + S.wl(NW),
      validateHint: nextOk ? 'Next week\'s milestones are official.' : (msCount ? msCount + ' milestone' + (msCount === 1 ? '' : 's') + ' listed: validating the step makes them all official. ' : 'No milestone listed for next week. ') + (bare.length ? bare.length + ' key result' + (bare.length > 1 ? 's have' : ' has') + ' no milestone next week: you will see what that risks before validating.' : 'Every key result has a milestone next week.'),
      validateStyle: 'min-height: 44px; padding: 0 18px; border: 0; border-radius: 10px; font: inherit; font-size: 15px; font-weight: 600; ' + (nextOk ? 'background: #2E7D4F; color: #FFFFFF; cursor: default;' : !closed ? 'background: #1B1B18; color: #D9B46A; cursor: pointer;' : 'background: #D8D3C7; color: #5E5B53; cursor: not-allowed;'),
      closed, notClosed: !closed, canClose, close, reopen,
      locked: !started, startNow, bodyStyle: started ? 'display: flex; flex-direction: column; gap: 14px' : 'display: flex; flex-direction: column; gap: 14px; pointer-events: none; opacity: 0.5',
      lockText: 'The review of ' + S.wl(W) + ' opens on ' + S.parse(reviewDay).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }) + '. Until then you can read every step, but none can be done.',
      closeHint: closed ? 'This review is closed. Its snapshot is in History.' : canClose ? (doneN === NSTEPS ? 'All ' + NSTEPS + ' steps are done.' : 'You can close now. Open points are recorded with the review.') : 'Validate next week\'s milestones (step 6) before closing.',
      closeStyle: 'min-height: 48px; padding: 0 22px; border: 0; border-radius: 10px; font: inherit; font-size: 15px; font-weight: 600; ' + (canClose ? 'background: #1B1B18; color: #D9B46A; cursor: pointer;' : 'background: #D8D3C7; color: #5E5B53; cursor: not-allowed;'),
      notes: r.notes || '', setNotes: e => { const v = e.target.value; put(x => { x.notes = v; }); },
      hist, noHist: !hist.length, bars, hasBars: !!bars.length,
      reliability: lastPct === null ? '—' : lastPct + '%',
      reliabilityText: stats.length ? 'of the milestones of ' + S.wl(stats[stats.length - 1].week) + ' reached · target ≥ 80%' : 'No finished week with milestones yet'
    };
  }
}
