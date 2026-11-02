"""Inbox: every alert of the OS in one place, with its owner, its escalation clock and its history."""
from shell import *

MAIN = f'''<main style="flex-grow: 1; min-width: 0; box-sizing: border-box; padding: 40px 96px 48px 48px; display: flex; flex-direction: column; gap: 20px">

<header style="display: flex; justify-content: space-between; align-items: flex-end; gap: 24px; flex-wrap: wrap">
<div style="min-width: 0">
<div style="font-size: 14px; color: #5E5B53; margin-bottom: 6px">{{{{eyebrow}}}}</div>
<h1 style="margin: 0; font-family: Fraunces, Georgia, serif; font-size: 40px; font-weight: 500">Inbox</h1>
<p style="margin: 8px 0 0; max-width: 640px; font-size: 15px; line-height: 1.55; color: #3D3A33">Every alert raised by the OS, in one place. Take it, assign it, snooze it or turn it into a decision. An alert leaves the inbox on its own when the data behind it is fixed.</p>
</div>
<div style="display: flex; gap: 26px">
<sc-for list="{{{{stats}}}}" as="st" hint-placeholder-count="4"><div style="display: flex; flex-direction: column; gap: 4px; align-items: flex-end"><span style="{{{{st.style}}}}">{{{{st.n}}}}</span><span style="font-size: 12px; color: #5E5B53">{{{{st.l}}}}</span></div></sc-for>
</div>
</header>

<div style="display: flex; justify-content: space-between; align-items: center; gap: 16px; flex-wrap: wrap">
<div role="tablist" aria-label="Inbox views" style="display: flex; gap: 4px; padding: 5px; background: #ECE8DF; border-radius: 12px; flex-wrap: wrap">
<sc-for list="{{{{tabs}}}}" as="tb" hint-placeholder-count="6"><button type="button" role="tab" aria-selected="{{{{tb.on}}}}" onClick="{{{{tb.go}}}}" style="{{{{tb.style}}}}">{{{{tb.label}}}}<span style="{{{{tb.countStyle}}}}">{{{{tb.count}}}}</span></button></sc-for>
</div>
<span style="font-size: 13px; color: #5E5B53">{{{{escRule}}}}</span>
</div>

<sc-if value="{{{{notResolved}}}}" hint-placeholder-val="{{{{true}}}}">
<div style="display: flex; gap: 24px; flex-wrap: wrap; align-items: center">
<div style="display: flex; gap: 6px; align-items: center; flex-wrap: wrap"><span style="{EYEBROW}; margin-right: 4px">Severity</span><sc-for list="{{{{sevChips}}}}" as="c" hint-placeholder-count="5"><button type="button" onClick="{{{{c.go}}}}" style="{{{{c.style}}}}">{{{{c.label}}}}</button></sc-for></div>
<div style="display: flex; gap: 6px; align-items: center; flex-wrap: wrap"><span style="{EYEBROW}; margin-right: 4px">Area</span><sc-for list="{{{{areaChips}}}}" as="c" hint-placeholder-count="5"><button type="button" onClick="{{{{c.go}}}}" style="{{{{c.style}}}}">{{{{c.label}}}}</button></sc-for></div>
</div>
</sc-if>

<div style="display: grid; grid-template-columns: minmax(0, 1fr) 440px; gap: 20px; align-items: start">

<section aria-label="Alerts" style="{CARD}; overflow: hidden; display: flex; flex-direction: column">
<sc-if value="{{{{notResolved}}}}" hint-placeholder-val="{{{{true}}}}">
<sc-for list="{{{{groups}}}}" as="g" hint-placeholder-count="3">
<div style="display: flex; align-items: center; gap: 8px; padding: 14px 16px 10px; background: #F6F4EF; border-top: 1px solid #E3DFD5; font-size: 12px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: #3D3A33"><span style="{{{{g.dot}}}}"></span>{{{{g.label}}}} · {{{{g.count}}}}</div>
<sc-for list="{{{{g.items}}}}" as="a" hint-placeholder-count="3">
<button type="button" onClick="{{{{a.pick}}}}" style="{{{{a.rowStyle}}}}">
<span style="{{{{a.dot}}}}"></span>
<span style="min-width: 0; display: flex; flex-direction: column; gap: 4px">
<span style="font-size: 12px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; color: #5E5B53">{{{{a.alert}}}} · {{{{a.area}}}}</span>
<span style="font-size: 15px; font-weight: 600; line-height: 1.35">{{{{a.subject}}}}</span>
<span style="font-size: 13px; line-height: 1.45; color: #3D3A33">{{{{a.detail}}}}</span>
<span style="display: flex; gap: 6px; flex-wrap: wrap"><sc-for list="{{{{a.flags}}}}" as="f" hint-placeholder-count="1"><span style="{{{{f.style}}}}">{{{{f.label}}}}</span></sc-for></span>
</span>
<span style="font-size: 13px; line-height: 1.4"><span style="display: block; font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase; color: #8E8A80">Assigned to</span>{{{{a.who}}}}</span>
<span style="font-family: 'IBM Plex Mono', monospace; font-size: 13px; color: #5E5B53; text-align: right">{{{{a.age}}}}</span>
</button>
</sc-for>
</sc-for>
</sc-if>
<sc-if value="{{{{isResolved}}}}" hint-placeholder-val="{{{{false}}}}">
<sc-for list="{{{{resolvedRows}}}}" as="r" hint-placeholder-count="2">
<div style="display: grid; grid-template-columns: 14px minmax(0, 1fr) 110px; gap: 12px; align-items: start; padding: 14px 16px; border-top: 1px solid #EFEBE3">
<span style="{{{{r.dot}}}}; margin-top: 5px"></span>
<span style="min-width: 0; display: flex; flex-direction: column; gap: 3px"><span style="font-size: 12px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; color: #5E5B53">{{{{r.alert}}}} · {{{{r.person}}}}</span><span style="font-size: 15px; font-weight: 600">{{{{r.subject}}}}</span><span style="font-size: 13px; color: #5E5B53">Last action: {{{{r.last}}}}</span></span>
<span style="font-size: 13px; color: #1E5E38; font-weight: 600; text-align: right">Resolved · {{{{r.when}}}}</span>
</div>
</sc-for>
</sc-if>
<sc-if value="{{{{hasEmpty}}}}" hint-placeholder-val="{{{{false}}}}"><div style="padding: 36px 24px; font-size: 15px; line-height: 1.55; color: #5E5B53; text-align: center">{{{{empty}}}}</div></sc-if>
</section>

<aside aria-label="Selected alert" style="position: sticky; top: 24px; {CARD}; padding: 22px 24px; display: flex; flex-direction: column; gap: 14px">
<sc-if value="{{{{noSel}}}}" hint-placeholder-val="{{{{true}}}}">
<div style="{EYEBROW}">How to triage</div>
<h2 style="{H2}">Pick an alert on the left</h2>
<ol style="margin: 0; padding-left: 20px; display: flex; flex-direction: column; gap: 8px; font-size: 14px; line-height: 1.5; color: #3D3A33">
<li><strong>Open</strong> it where it lives: the KR, the task, the decision.</li>
<li><strong>Take it</strong> or <strong>assign</strong> it: one name per alert.</li>
<li>Can't act now? <strong>Snooze</strong> it until a date. It comes back on its own.</li>
<li>Needs a real choice? <strong>Turn it into a decision</strong>. A one-hour fix? <strong>Create a task</strong>.</li>
<li><strong>Mark it handled</strong> with a note. It leaves the inbox for good once the data is fixed.</li>
</ol>
</sc-if>
<sc-if value="{{{{hasSel}}}}" hint-placeholder-val="{{{{false}}}}">
<div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap"><span style="{{{{d.sevStyle}}}}">{{{{d.sev}}}}</span><span style="font-size: 13px; color: #5E5B53">{{{{d.alert}}}} · {{{{d.area}}}}</span></div>
<h2 style="{H2}; line-height: 1.25">{{{{d.title}}}}</h2>
<p style="margin: 0; font-size: 14px; line-height: 1.55; color: #3D3A33">{{{{d.detail}}}}</p>
<div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; padding: 12px 14px; border-radius: 10px; background: #F6F4EF; font-size: 14px">
<div><div style="font-size: 12px; color: #5E5B53">Owner</div><strong>{{{{d.person}}}}</strong></div>
<div><div style="font-size: 12px; color: #5E5B53">Since</div><strong>{{{{d.since}}}}</strong></div>
<div><div style="font-size: 12px; color: #5E5B53">Status</div><strong>{{{{d.status}}}}</strong></div>
</div>
<sc-if value="{{{{d.hasEsc}}}}" hint-placeholder-val="{{{{true}}}}"><div style="{{{{d.escStyle}}}}">{{{{d.escLine}}}}</div></sc-if>
<button type="button" onClick="{{{{d.open}}}}" style="{BTN_DARK}">{{{{d.openLabel}}}} →</button>
<div style="display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 10px; align-items: end">
<label style="{LABEL}">Assigned to<select onChange="{{{{d.assign}}}}" style="{FIELD}"><sc-for list="{{{{d.ownerOpts}}}}" as="o" hint-placeholder-count="5"><option value="{{{{o.v}}}}" selected="{{{{o.sel}}}}">{{{{o.l}}}}</option></sc-for></select></label>
<sc-if value="{{{{d.canTake}}}}" hint-placeholder-val="{{{{true}}}}"><button type="button" onClick="{{{{d.take}}}}" style="{BTN_LINE}">Take it</button></sc-if>
</div>
<sc-if value="{{{{d.isOpen}}}}" hint-placeholder-val="{{{{true}}}}">
<div style="display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 10px">
<select onChange="{{{{d.snooze}}}}" aria-label="Snooze" style="{FIELD}"><sc-for list="{{{{d.snoozeOpts}}}}" as="o" hint-placeholder-count="4"><option value="{{{{o.v}}}}" selected="{{{{o.sel}}}}">{{{{o.l}}}}</option></sc-for></select>
<button type="button" onClick="{{{{d.startHandle}}}}" style="{BTN_LINE}">Mark handled</button>
<button type="button" onClick="{{{{d.toDecision}}}}" style="{BTN_LINE}">Turn into a decision</button>
<button type="button" onClick="{{{{d.toTask}}}}" style="{BTN_LINE}">Create a fix task</button>
</div>
</sc-if>
<sc-if value="{{{{d.handling}}}}" hint-placeholder-val="{{{{false}}}}">
<div style="display: flex; flex-direction: column; gap: 8px; padding: 12px; border: 1px solid #D9B46A; border-radius: 10px; background: #FBF6EC">
<label style="{LABEL}">What was done<textarea rows="3" onInput="{{{{d.draftIn}}}}" placeholder="e.g. Called the editor, new date agreed for Thursday" style="{FIELD}; resize: vertical"></textarea></label>
<div style="display: flex; gap: 8px; justify-content: flex-end"><button type="button" onClick="{{{{d.cancelHandle}}}}" style="{BTN_LINE}">Cancel</button><button type="button" onClick="{{{{d.confirmHandle}}}}" style="{BTN_DARK}">Mark handled</button></div>
</div>
</sc-if>
<sc-if value="{{{{d.isDone}}}}" hint-placeholder-val="{{{{false}}}}"><button type="button" onClick="{{{{d.reopen}}}}" style="{BTN_LINE}">Reopen</button></sc-if>
<label style="{LABEL}">Note for the team<textarea rows="2" onChange="{{{{d.setNote}}}}" placeholder="Context, next step, who you talked to" style="{FIELD}; resize: vertical">{{{{d.note}}}}</textarea></label>
<div style="display: flex; flex-direction: column; gap: 0">
<div style="{EYEBROW}; margin-bottom: 6px">History</div>
<sc-for list="{{{{d.log}}}}" as="l" hint-placeholder-count="2"><div style="display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 10px; padding: 8px 0; border-top: 1px solid #EFEBE3; font-size: 13px"><span>{{{{l.text}}}}</span><span style="color: #5E5B53">{{{{l.when}}}}</span></div></sc-for>
</div>
</sc-if>
</aside>
</div>
</main>'''

INFO = info_popup('Inbox', [
    ('What this page is for', 'p', 'The Inbox is the single place where every alert of the OS lands: key results turning red or not checked in, tasks blocked or late, decisions overdue, people overloaded. The rules come from Settings; the data comes from Roadmap, My Day and Decisions. Nobody has to hunt for problems across screens.'),
    ('How it makes everyone more efficient', 'ul', [
        '<strong style="color: #1B1B18">One owner per alert.</strong> Each alert goes to the person it concerns. It can be taken or reassigned, and the name is visible to the whole team.',
        '<strong style="color: #1B1B18">Nothing stays stuck in silence.</strong> A Critical or High alert with no action beyond the escalation delay goes up to the lead automatically.',
        '<strong style="color: #1B1B18">No noise.</strong> Snooze pushes an alert to a date; it comes back on its own. Medium and Low alerts never escalate.',
        '<strong style="color: #1B1B18">Closed by the facts.</strong> You mark an alert handled, but it only leaves for good when the data is fixed: the task unblocked, the KR checked in, the decision taken.']),
    ('How to use it', 'ol', [
        'Start each day on the “Mine” tab. The red count in the sidebar is what waits on you.',
        'Click an alert to see its detail, its escalation clock and its history.',
        'Open it where it lives and fix it, or take it, assign it, snooze it, turn it into a decision or create a fix task.',
        'Leads check the “Escalated” tab every morning. On Friday, the Weekly Review triages every Critical and High alert still open.'])
])

write_screen('Inbox.dc.html', 'Inbox', MAIN, INFO, 'inbox_logic.js')
