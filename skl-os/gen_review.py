"""Weekly Review: the Saturday ritual in 6 guided steps, saved for the team, with the history of past reviews."""
from shell import *

def H(x):  # template hole
    return '{{' + x + '}}'

ROW_KR = ('<div role="link" tabindex="0" onClick="{{b.open}}" style="{{b.rowStyle}}">'
          '<div><div style="font-size: 14px; font-weight: 600">{{b.name}}</div><div style="{{b.subStyle}}">{{b.sub}}</div></div>'
          '<svg viewBox="0 0 260 60" width="200" height="46" role="img" aria-label="{{b.aria}}">'
          '<line x1="8" y1="54" x2="252" y2="54" stroke="#ECE8DF" stroke-width="1"></line>'
          '<line x1="{{b.todayX}}" y1="2" x2="{{b.todayX}}" y2="58" stroke="#D8D3C7" stroke-width="1"></line>'
          '<polyline points="{{b.expPts}}" fill="none" stroke="#1B1B18" stroke-width="1.5" stroke-dasharray="4 4"></polyline>'
          '<polyline points="{{b.actPts}}" fill="none" stroke="{{b.actCol}}" stroke-width="2.5" stroke-linejoin="round"></polyline>'
          '<sc-if value="{{b.projOn}}" hint-placeholder-val="{{true}}"><line x1="{{b.projX1}}" y1="{{b.projY1}}" x2="252" y2="{{b.projY2}}" stroke="{{b.projCol}}" stroke-width="2" stroke-dasharray="1 4" stroke-linecap="round"></line><circle cx="252" cy="{{b.projY2}}" r="3.5" fill="{{b.projCol}}"></circle></sc-if>'
          '<sc-if value="{{b.stale}}" hint-placeholder-val="{{false}}"><text x="{{b.staleX}}" y="40" font-size="11" fill="#5E5B53" font-family="IBM Plex Sans, sans-serif">? no recent data</text></sc-if>'
          '<line x1="242" y1="6" x2="258" y2="6" stroke="#1B1B18" stroke-width="2"></line></svg>'
          '<div><div style="{{b.ratioStyle}}">{{b.ratio}} <span style="{{b.arrowStyle}}">{{b.arrow}}</span></div><div style="font-size: 12px; color: #5E5B53; margin-top: 2px">{{b.ratioSub}}</div></div>'
          '<div style="font-size: 13px; line-height: 1.55"><div>Forecast: <strong style="{{b.fcStyle}}">{{b.fcText}}</strong></div><div style="{{b.nextStyle}}">{{b.nextText}}</div></div>'
          '<span style="{{b.pillStyle}}"><span style="{{b.dotStyle}}"></span>{{b.label}}</span></div>')

STEP_HEAD = (f'<div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 16px">'
             f'<div><div style="{EYEBROW}">Step {H("cur.n")} of 6 · {H("cur.min")}</div><h2 style="{H2}; font-size: 28px; margin-top: 4px">{H("cur.title")}</h2>'
             f'<p style="margin: 6px 0 0; max-width: 640px; font-size: 14px; line-height: 1.55; color: #3D3A33">{H("cur.why")}</p></div>'
             f'<span style="font-family: \'IBM Plex Mono\', monospace; font-size: 14px; font-weight: 600; color: #5E5B53; white-space: nowrap">{H("cur.count")}</span></div>')

S1 = f'''<sc-if value="{H('is1')}" hint-placeholder-val="{{{{true}}}}">
<sc-for list="{H('ciRows')}" as="c" hint-placeholder-count="5">
<div style="border-top: 1px solid #EFEBE3; padding: 14px 0; display: flex; flex-direction: column; gap: 10px">
<div style="display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 12px; align-items: center">
<div><div style="font-size: 15px; font-weight: 600">{H('c.name')}</div><div style="font-size: 13px; color: #5E5B53; margin-top: 2px">{H('c.owner')} · last: {H('c.last')}</div></div>
<span style="{H('c.badge.style')}">{H('c.badge.label')}</span>
</div>
<sc-if value="{H('c.todo')}" hint-placeholder-val="{{{{false}}}}">
<div style="display: grid; grid-template-columns: 120px 110px minmax(0, 1fr) minmax(0, 1fr) auto; gap: 10px; align-items: end; padding: 12px; border-radius: 10px; background: #F6F4EF">
<label style="{LABEL}">Value {H('c.unit')}<input type="number" step="any" onInput="{H('c.setValue')}" style="{FIELD}"></label>
<label style="{LABEL}">Confidence<input type="number" min="1" max="10" placeholder="1–10" onInput="{H('c.setConf')}" style="{FIELD}"></label>
<label style="{LABEL}">What moved it<input type="text" onInput="{H('c.setMoved')}" style="{FIELD}"></label>
<label style="{LABEL}">What blocks<input type="text" onInput="{H('c.setBlocks')}" style="{FIELD}"></label>
<button type="button" onClick="{H('c.save')}" style="{BTN_DARK}">Save check-in</button>
</div>
</sc-if>
</div>
</sc-for>
</sc-if>'''

S2 = f'''<sc-if value="{H('is2')}" hint-placeholder-val="{{{{false}}}}">
<div style="display: grid; grid-template-columns: minmax(0, 1.1fr) 200px 96px minmax(0, 1fr) 104px; gap: 14px; padding: 0 8px 8px; font-size: 12px; letter-spacing: 0.06em; text-transform: uppercase; color: #5E5B53"><span>Key result</span><span>Quarter trajectory</span><span>Ratio</span><span>Forecast · next milestone</span><span>Status</span></div>
<sc-for list="{H('board')}" as="b" hint-placeholder-count="5">
{ROW_KR}
<sc-if value="{H('b.needs')}" hint-placeholder-val="{{{{false}}}}">
<div style="display: grid; grid-template-columns: minmax(0, 1fr) 160px 160px; gap: 10px; align-items: end; margin: 0 8px 12px; padding: 12px; border-radius: 10px; background: #FBF6EC; border: 1px solid #E6D3A8">
<label style="{LABEL}">{H('b.planLabel')}<input type="text" value="{H('b.plan')}" onChange="{H('b.setPlan')}" placeholder="What changes this week, concretely" style="{FIELD}"></label>
<label style="{LABEL}">Owner<select onChange="{H('b.setPlanOwner')}" style="{FIELD}"><sc-for list="{H('b.planOwnerOpts')}" as="o" hint-placeholder-count="5"><option value="{H('o.v')}" selected="{H('o.sel')}">{H('o.l')}</option></sc-for></select></label>
<label style="{LABEL}">By<input type="date" value="{H('b.planDue')}" onChange="{H('b.setPlanDue')}" style="{FIELD}"></label>
</div>
</sc-if>
</sc-for>
</sc-if>'''

S3 = f'''<sc-if value="{H('is3')}" hint-placeholder-val="{{{{false}}}}">
<sc-if value="{H('noTriage')}" hint-placeholder-val="{{{{false}}}}"><div style="padding: 24px; border-radius: 10px; background: #E6F2EA; color: #1E5E38; font-size: 15px; font-weight: 600">No Critical or High alert is open. Move on.</div></sc-if>
<sc-for list="{H('triage')}" as="t" hint-placeholder-count="4">
<div style="display: grid; grid-template-columns: 14px minmax(0, 1fr) auto; gap: 12px; align-items: start; padding: 14px 0; border-top: 1px solid #EFEBE3">
<span style="{H('t.dot')}"></span>
<div style="min-width: 0; display: flex; flex-direction: column; gap: 4px">
<span style="font-size: 12px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; color: #5E5B53">{H('t.alert')} · {H('t.who')} · {H('t.age')}</span>
<span style="font-size: 15px; font-weight: 600">{H('t.subject')}</span>
<span style="font-size: 13px; line-height: 1.45; color: #3D3A33">{H('t.detail')}</span>
<sc-if value="{H('t.todo')}" hint-placeholder-val="{{{{true}}}}">
<div style="display: flex; gap: 8px; flex-wrap: wrap; margin-top: 6px; align-items: center">
<button type="button" onClick="{H('t.keep')}" style="{BTN_LINE}">Owner confirmed</button>
<select onChange="{H('t.assign')}" aria-label="Reassign" style="{FIELD}; width: 170px"><sc-for list="{H('t.ownerOpts')}" as="o" hint-placeholder-count="5"><option value="{H('o.v')}" selected="{H('o.sel')}">{H('o.l')}</option></sc-for></select>
<button type="button" onClick="{H('t.snooze')}" style="{BTN_LINE}">Snooze to next review</button>
<button type="button" onClick="{H('t.decide')}" style="{BTN_LINE}">Turn into a decision</button>
<button type="button" onClick="{H('t.handled')}" style="{BTN_LINE}">Settled in the room</button>
</div>
</sc-if>
</div>
<span style="{H('t.outcome.style')}">{H('t.outcome.label')}</span>
</div>
</sc-for>
</sc-if>'''

S4 = f'''<sc-if value="{H('is4')}" hint-placeholder-val="{{{{false}}}}">
<sc-if value="{H('noDecs')}" hint-placeholder-val="{{{{false}}}}"><div style="padding: 24px; border-radius: 10px; background: #E6F2EA; color: #1E5E38; font-size: 15px; font-weight: 600">No decision is due before next Saturday.</div></sc-if>
<sc-for list="{H('decRows')}" as="d" hint-placeholder-count="3">
<div style="display: grid; grid-template-columns: minmax(0, 1fr) 170px auto auto; gap: 12px; align-items: center; padding: 14px 0; border-top: 1px solid #EFEBE3">
<div><div style="font-size: 15px; font-weight: 600">{H('d.title')}</div><div style="font-size: 13px; color: #5E5B53; margin-top: 2px">{H('d.owner')} · {H('d.rev')}</div></div>
<sc-if value="{H('d.isTodo')}" hint-placeholder-val="{{{{true}}}}"><label style="{LABEL}">New deadline<input type="date" value="{H('d.deadline')}" onChange="{H('d.setDeadline')}" style="{FIELD}"></label></sc-if>
<button type="button" onClick="{H('d.open')}" style="{BTN_LINE}">Decide now →</button>
<span style="{H('d.badge.style')}">{H('d.badge.label')}</span>
</div>
</sc-for>
</sc-if>'''

S5 = f'''<sc-if value="{H('is5')}" hint-placeholder-val="{{{{false}}}}">
<sc-if value="{H('noProm')}" hint-placeholder-val="{{{{false}}}}"><div style="padding: 24px; border-radius: 10px; background: #F6F4EF; color: #5E5B53; font-size: 15px">No promise was recorded last week. They start with step 6 of this review.</div></sc-if>
<sc-for list="{H('promRows')}" as="p" hint-placeholder-count="6">
<div style="display: grid; grid-template-columns: 120px minmax(0, 1fr) auto; gap: 12px; align-items: center; padding: 12px 0; border-top: 1px solid #EFEBE3">
<span style="font-size: 14px; font-weight: 600">{H('p.owner')}</span>
<div style="min-width: 0"><div style="font-size: 15px">{H('p.text')}</div><div style="{H('p.hintStyle')}">{H('p.hint')}</div></div>
<div style="display: flex; gap: 6px; align-items: center">
<button type="button" onClick="{H('p.kept')}" style="{H('p.keptStyle')}">Kept</button>
<button type="button" onClick="{H('p.missed')}" style="{H('p.missedStyle')}">Missed</button>
<sc-if value="{H('p.isMissed')}" hint-placeholder-val="{{{{false}}}}"><select onChange="{H('p.setReason')}" aria-label="Reason" style="{FIELD}; width: 170px"><sc-for list="{H('p.reasonOpts')}" as="o" hint-placeholder-count="5"><option value="{H('o.v')}" selected="{H('o.sel')}">{H('o.l')}</option></sc-for></select></sc-if>
</div>
</div>
</sc-for>
</sc-if>'''

S6 = f'''<sc-if value="{H('is6')}" hint-placeholder-val="{{{{false}}}}">
<div style="font-size: 14px; color: #5E5B53">Promises are due by Saturday {H('nextSat')}. At most 3 per person. Load above 70% means something else must give.</div>
<div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px">
<sc-for list="{H('people')}" as="p" hint-placeholder-count="5">
<div style="{H('p.cardStyle')}">
<div style="display: flex; justify-content: space-between; align-items: baseline; gap: 10px"><div><strong style="font-size: 16px">{H('p.name')}</strong> <span style="font-size: 13px; color: #5E5B53">{H('p.role')}</span></div><div style="text-align: right"><span style="{H('p.loadStyle')}">{H('p.load')}</span><div style="font-size: 11px; color: #5E5B53">{H('p.loadText')}</div></div></div>
<sc-for list="{H('p.items')}" as="i" hint-placeholder-count="2"><div style="display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px; align-items: center; padding: 8px 10px; border-radius: 8px; background: #F6F4EF"><div><div style="font-size: 14px; font-weight: 600">{H('i.text')}</div><div style="font-size: 12px; color: #5E5B53">{H('i.meta')}</div></div><button type="button" onClick="{H('i.remove')}" aria-label="Remove" style="width: 32px; height: 32px; border-radius: 50%; border: 1px solid #D8D3C7; background: #FFFFFF; color: #1B1B18; font: inherit; cursor: pointer">×</button></div></sc-for>
<sc-if value="{H('p.none')}" hint-placeholder-val="{{{{false}}}}"><div style="font-size: 13px; color: #8A3F06; font-weight: 600">No promise yet</div></sc-if>
<sc-if value="{H('p.canAdd')}" hint-placeholder-val="{{{{true}}}}">
<select onChange="{H('p.pickTask')}" aria-label="Add one of their tasks" style="{FIELD}"><sc-for list="{H('p.taskOpts')}" as="o" hint-placeholder-count="3"><option value="{H('o.v')}" selected="{H('o.sel')}">{H('o.l')}</option></sc-for></select>
<div style="display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px"><input type="text" placeholder="…or write a promise" onInput="{H('p.setText')}" style="{FIELD}"><button type="button" onClick="{H('p.addText')}" style="{BTN_LINE}">Add</button></div>
</sc-if>
</div>
</sc-for>
</div>
</sc-if>'''

WEEK = f'''<sc-if value="{H('isWeek')}" hint-placeholder-val="{{{{true}}}}">
<div style="display: grid; grid-template-columns: 270px minmax(0, 1fr); gap: 20px; align-items: start">
<aside aria-label="Steps" style="position: sticky; top: 24px; {CARD}; padding: 14px; display: flex; flex-direction: column; gap: 4px">
<div style="padding: 6px 8px 10px"><div style="font-size: 13px; color: #5E5B53; margin-bottom: 6px">{H('progress')}</div><div style="height: 6px; border-radius: 3px; background: #ECE8DF"><div style="{H('progressW')}"></div></div></div>
<sc-for list="{H('steps')}" as="st" hint-placeholder-count="6"><button type="button" onClick="{H('st.go')}" aria-current="{H('st.on')}" style="{H('st.style')}"><span style="{H('st.numStyle')}">{H('st.num')}</span><span style="min-width: 0"><span style="display: block; font-size: 15px; font-weight: 600">{H('st.title')}</span><span style="{H('st.subStyle')}">{H('st.min')} · {H('st.count')}</span></span></button></sc-for>
<div style="border-top: 1px solid #E3DFD5; margin-top: 8px; padding: 12px 8px 4px; display: flex; flex-direction: column; gap: 8px">
<sc-if value="{H('notClosed')}" hint-placeholder-val="{{{{true}}}}"><button type="button" onClick="{H('close')}" style="{H('closeStyle')}">Close the review</button></sc-if>
<sc-if value="{H('closed')}" hint-placeholder-val="{{{{false}}}}"><button type="button" onClick="{H('reopen')}" style="{BTN_LINE}">Reopen</button></sc-if>
<span style="font-size: 12px; line-height: 1.45; color: #5E5B53">{H('closeHint')}</span>
</div>
</aside>
<section aria-label="Current step" style="{CARD}; padding: 24px 28px; display: flex; flex-direction: column; gap: 14px; min-width: 0">
{STEP_HEAD}
{S1}
{S2}
{S3}
{S4}
{S5}
{S6}
<div style="display: flex; justify-content: space-between; gap: 10px; border-top: 1px solid #E3DFD5; padding-top: 16px; margin-top: 4px">
<sc-if value="{H('hasPrev')}" hint-placeholder-val="{{{{false}}}}"><button type="button" onClick="{H('prev')}" style="{BTN_LINE}">← Previous step</button></sc-if>
<span style="flex-grow: 1"></span>
<sc-if value="{H('hasNext')}" hint-placeholder-val="{{{{true}}}}"><button type="button" onClick="{H('next')}" style="{BTN_DARK}">Next step →</button></sc-if>
</div>
<label style="{LABEL}">Notes of the review<textarea rows="3" onChange="{H('setNotes')}" placeholder="What the room agreed that doesn't fit elsewhere" style="{FIELD}; resize: vertical">{H('notes')}</textarea></label>
</section>
</div>
</sc-if>'''

HIST = f'''<sc-if value="{H('isHist')}" hint-placeholder-val="{{{{false}}}}">
<div style="display: grid; grid-template-columns: 320px minmax(0, 1fr); gap: 20px; align-items: start">
<section aria-label="Promise reliability" style="{CARD}; padding: 22px 24px; display: flex; flex-direction: column; gap: 10px">
<div style="{EYEBROW}">Promise reliability</div>
<div style="font-family: Fraunces, Georgia, serif; font-size: 48px; line-height: 1">{H('reliability')}</div>
<div style="font-size: 13px; color: #5E5B53">{H('reliabilityText')}</div>
<sc-if value="{H('hasBars')}" hint-placeholder-val="{{{{true}}}}"><div style="display: flex; gap: 12px; align-items: flex-end; height: 120px; padding-top: 10px; border-bottom: 1px solid #E3DFD5"><sc-for list="{H('bars')}" as="b" hint-placeholder-count="2"><div style="display: flex; flex-direction: column; align-items: center; gap: 4px"><span style="font-family: 'IBM Plex Mono', monospace; font-size: 12px">{H('b.pct')}</span><div style="{H('b.style')}"></div></div></sc-for></div>
<div style="display: flex; gap: 12px"><sc-for list="{H('bars')}" as="b" hint-placeholder-count="2"><span style="width: 36px; text-align: center; font-size: 12px; color: #5E5B53">{H('b.label')}</span></sc-for></div></sc-if>
</section>
<section aria-label="Past reviews" style="{CARD}; overflow: hidden">
<div style="display: grid; grid-template-columns: 24px 110px 90px minmax(0, 1fr) 110px 90px 90px; gap: 12px; padding: 14px 18px; background: #F6F4EF; font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase; color: #5E5B53"><span></span><span>Week</span><span>Date</span><span>KRs at closing</span><span>Promises kept</span><span>Alerts triaged</span><span>New promises</span></div>
<sc-if value="{H('noHist')}" hint-placeholder-val="{{{{false}}}}"><div style="padding: 28px; color: #5E5B53">No review closed yet.</div></sc-if>
<sc-for list="{H('hist')}" as="h" hint-placeholder-count="2">
<button type="button" onClick="{H('h.toggle')}" style="display: grid; grid-template-columns: 24px 110px 90px minmax(0, 1fr) 110px 90px 90px; gap: 12px; align-items: center; width: 100%; padding: 14px 18px; border: 0; border-top: 1px solid #EFEBE3; background: #FFFFFF; font: inherit; color: #1B1B18; text-align: left; cursor: pointer">
<span>{H('h.chev')}</span><strong>{H('h.week')}</strong><span style="font-size: 14px">{H('h.date')}</span>
<span style="display: flex; gap: 6px"><sc-for list="{H('h.dots')}" as="dt" hint-placeholder-count="5"><span title="{H('dt.tip')}" style="{H('dt.style')}"></span></sc-for></span>
<span style="font-family: 'IBM Plex Mono', monospace; font-size: 14px">{H('h.kept')} <span style="color: #5E5B53">{H('h.pct')}</span></span>
<span style="font-family: 'IBM Plex Mono', monospace; font-size: 14px">{H('h.triaged')}</span>
<span style="font-family: 'IBM Plex Mono', monospace; font-size: 14px">{H('h.made')}</span>
</button>
<sc-if value="{H('h.isOpen')}" hint-placeholder-val="{{{{false}}}}">
<div style="display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 20px; padding: 6px 18px 18px 54px; background: #FFFFFF">
<div><div style="{EYEBROW}; margin-bottom: 6px">Promises of the week before · facilitated by {H('h.by')}</div><sc-for list="{H('h.results')}" as="x" hint-placeholder-count="3"><div style="display: grid; grid-template-columns: 80px minmax(0, 1fr) 150px; gap: 8px; padding: 6px 0; border-top: 1px solid #EFEBE3; font-size: 13px"><strong>{H('x.who')}</strong><span>{H('x.text')}</span><span style="{H('x.style')}; text-align: right">{H('x.res')}</span></div></sc-for></div>
<div><div style="{EYEBROW}; margin-bottom: 6px">Promises made for the next week</div><sc-for list="{H('h.commits')}" as="x" hint-placeholder-count="3"><div style="display: grid; grid-template-columns: 90px minmax(0, 1fr); gap: 8px; padding: 6px 0; border-top: 1px solid #EFEBE3; font-size: 13px"><strong>{H('x.who')}</strong><span>{H('x.text')}</span></div></sc-for>
<sc-if value="{H('h.hasGaps')}" hint-placeholder-val="{{{{false}}}}"><div style="margin-top: 8px; font-size: 12px; color: #8A3F06">{H('h.gaps')}</div></sc-if></div>
</div>
</sc-if>
</sc-for>
</section>
</div>
</sc-if>'''

MAIN = f'''<main style="flex-grow: 1; min-width: 0; box-sizing: border-box; padding: 40px 96px 48px 48px; display: flex; flex-direction: column; gap: 20px">
<header style="display: flex; justify-content: space-between; align-items: flex-end; gap: 24px; flex-wrap: wrap">
<div style="min-width: 0">
<div style="font-size: 14px; color: #5E5B53; margin-bottom: 6px">{H('eyebrow')}</div>
<h1 style="margin: 0; font-family: Fraunces, Georgia, serif; font-size: 40px; font-weight: 500">{H('title')}</h1>
<div style="display: flex; gap: 10px; align-items: center; margin-top: 10px; flex-wrap: wrap"><span style="{H('statusPill.style')}">{H('statusPill.label')}</span><span style="font-size: 14px; color: #5E5B53">{H('facilitator')}</span></div>
</div>
<div role="tablist" aria-label="Review views" style="display: flex; gap: 4px; padding: 5px; background: #ECE8DF; border-radius: 12px">
<button type="button" role="tab" aria-selected="{H('isWeek')}" onClick="{H('goWeek')}" style="{H('tabWeek')}">This week</button>
<button type="button" role="tab" aria-selected="{H('isHist')}" onClick="{H('goHist')}" style="{H('tabHist')}">History</button>
</div>
</header>
{WEEK}
{HIST}
</main>'''

INFO = info_popup('Weekly Review', [
    ('What this page is for', 'p', 'The Weekly Review is the Saturday ritual that keeps the quarter on track: 45 minutes, the whole team, always the same 6 steps. Everything is read from the shared data (key results, alerts, decisions, tasks) and everything decided in the room is written back to it. Each closed review is kept in History with a snapshot of the key results and the promises made.'),
    ('How it makes everyone more efficient', 'ul', [
        '<strong style="color: #1B1B18">Numbers before opinions.</strong> Every KR is checked in before it is discussed.',
        '<strong style="color: #1B1B18">No red KR without a plan.</strong> A red or untracked KR leaves the room with a plan, an owner and a date.',
        '<strong style="color: #1B1B18">Nothing stuck survives Saturday.</strong> Every Critical and High alert still open gets an outcome in front of the team.',
        '<strong style="color: #1B1B18">Promises you can count on.</strong> Each person commits to at most 3 things, checked against their load. Next Saturday they are scored kept or missed: that score is the team’s promise reliability.']),
    ('How to use it', 'ol', [
        'Before Saturday, each KR owner saves the check-in in step 1 (or in Roadmap). The red count in the sidebar shows the KRs still missing.',
        'On Saturday, the facilitator runs the 6 steps in order on a shared screen. The left rail shows what is done.',
        'Steps 5 and 6 are required. Steps 1 to 4 can stay open: the gaps are recorded with the review.',
        'Close the review. It moves to History, and next Saturday its promises come back in step 5.'])
])

write_screen('Review.dc.html', 'Weekly Review', MAIN, INFO, 'review_logic.js')
