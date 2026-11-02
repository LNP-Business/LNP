"""Roadmap screen: build, run and review every key result (definition, initiatives, milestones, task roadmap,
risks, weekly check-ins, closure). Generated from the Decisions screen shell so nav, fonts and info button match."""
import re, pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent
P = ROOT / 'skl-en' / 'project'
src = (P / 'Decisions.dc.html').read_text(encoding='utf-8')
m = re.search(r'<div style="position: relative; width: \d+px', src)
head = src[:m.start()].replace('<title>SKL OS — Decisions</title>', '<title>SKL OS — Roadmap</title>')
nav = re.search(r'<nav aria-label="Main navigation".*?</nav>', src, flags=re.S).group(0)
ibtn = re.search(r'<button type="button" onClick="\{\{openInfo\}\}".*?</button>', src, flags=re.S).group(0)

INK, MUTE, BODY, LINE, SOFT = '#1B1B18', '#5E5B53', '#3D3A33', '#E3DFD5', '#F6F4EF'
SERIF = 'Fraunces, Georgia, serif'
MONO = "'IBM Plex Mono', monospace"
F = f'font: inherit; font-size: 14px; padding: 9px 11px; border: 1px solid {INK}; background: {INK}; color: #FFFFFF; caret-color: #FFFFFF; border-radius: 8px; width: 100%; box-sizing: border-box; min-width: 0'
LBL = f'font-size: 11px; font-weight: 600; letter-spacing: 0.07em; text-transform: uppercase; color: {MUTE}'
CARD = f'background: #FFFFFF; border: 1px solid {LINE}; border-radius: 14px'
H2 = f'margin: 0; font-family: {SERIF}; font-size: 22px; font-weight: 500'
BTN_P = f'min-height: 40px; padding: 0 16px; border: 0; border-radius: 10px; background: {INK}; color: #D9B46A; font: inherit; font-size: 14px; font-weight: 600; cursor: pointer; white-space: nowrap'
BTN_S = f'min-height: 36px; padding: 0 12px; border: 1px solid #E6D3A8; border-radius: 8px; background: #FFFFFF; color: #9A6614; font: inherit; font-size: 13px; font-weight: 600; cursor: pointer; white-space: nowrap'
X = f'width: 34px; height: 34px; flex-shrink: 0; border: 0; border-radius: 8px; background: transparent; color: {MUTE}; font: inherit; font-size: 18px; cursor: pointer'


def sec(title, sub, body, right=''):
    return (f'<section style="{CARD}; padding: 22px 24px; display: flex; flex-direction: column; gap: 16px">'
            f'<div style="display: flex; justify-content: space-between; align-items: baseline; gap: 16px"><div><h2 style="{H2}">{title}</h2>'
            f'<div style="font-size: 13px; color: {MUTE}; margin-top: 4px">{sub}</div></div>{right}</div>{body}</section>')


def opts(listname, var='o'):
    return f'<sc-for list="{{{{{listname}}}}}" as="{var}" hint-placeholder-count="3"><option value="{{{{{var}.v}}}}" selected="{{{{{var}.sel}}}}">{{{{{var}.l}}}}</option></sc-for>'


# ---------------- sections ----------------
S1 = sec('1 · Definition of the key result', 'One metric, a baseline, a target. Measured every week.', f'''
<div style="display: grid; grid-template-columns: minmax(0, 2fr) repeat(4, minmax(0, 1fr)) 120px; gap: 10px; align-items: end">
<span style="{LBL}">Metric</span><span style="{LBL}">Baseline</span><span style="{LBL}">Target</span><span style="{LBL}">Expected now</span><span style="{LBL}">Current</span><span style="{LBL}">Progress</span>
<input type="text" aria-label="Metric" value="{{{{k.metric}}}}" onChange="{{{{k.set.metric}}}}" style="{F}">
<input type="number" step="any" aria-label="Baseline" value="{{{{k.baseline}}}}" onChange="{{{{k.set.baseline}}}}" style="{F}; font-family: {MONO}; text-align: right">
<input type="number" step="any" aria-label="Target" value="{{{{k.target}}}}" onChange="{{{{k.set.target}}}}" style="{F}; font-family: {MONO}; text-align: right">
<input type="number" step="any" aria-label="Expected by now" title="Where the plan says the metric should be this week" value="{{{{k.expected}}}}" onChange="{{{{k.set.expected}}}}" style="{F}; font-family: {MONO}; text-align: right">
<input type="number" step="any" aria-label="Current" value="{{{{k.current}}}}" onChange="{{{{k.set.current}}}}" style="{F}; font-family: {MONO}; text-align: right">
<div style="display: flex; flex-direction: column; gap: 6px; padding-bottom: 4px"><strong style="font-family: {MONO}; font-size: 18px">{{{{k.progressLabel}}}}</strong><div style="height: 8px; border-radius: 999px; background: #EFECE4; overflow: hidden"><span style="{{{{k.progressBar}}}}"></span></div></div>
</div>
<div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px">
<label style="display: flex; flex-direction: column; gap: 6px; {LBL}">Data source<input type="text" value="{{{{k.source}}}}" onChange="{{{{k.set.source}}}}" placeholder="Tool / dashboard / who updates it" style="{F}; text-transform: none; letter-spacing: 0; font-weight: 400"></label>
<label style="display: flex; flex-direction: column; gap: 6px; {LBL}">Measurement frequency<select onChange="{{{{k.set.freq}}}}" style="{F}; text-transform: none; letter-spacing: 0; font-weight: 400">{opts('k.freqOpts')}</select></label>
<label style="display: flex; flex-direction: column; gap: 6px; {LBL}">Leading indicator<input type="text" value="{{{{k.lead}}}}" onChange="{{{{k.set.lead}}}}" placeholder="The metric that moves BEFORE the KR" style="{F}; text-transform: none; letter-spacing: 0; font-weight: 400"></label>
</div>
<div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px">
<label style="display: flex; flex-direction: column; gap: 6px; {LBL}">Leading indicator · value now<input type="text" value="{{{{k.leadValue}}}}" onChange="{{{{k.set.leadValue}}}}" placeholder="e.g. 18%" style="{F}; text-transform: none; letter-spacing: 0; font-weight: 400"></label>
<label style="display: flex; flex-direction: column; gap: 6px; {LBL}">Leading indicator · compared to<input type="text" value="{{{{k.leadNote}}}}" onChange="{{{{k.set.leadNote}}}}" placeholder="e.g. was 26%" style="{F}; text-transform: none; letter-spacing: 0; font-weight: 400"></label>
<label style="display: flex; flex-direction: column; gap: 6px; {LBL}">Leading indicator · reading<select onChange="{{{{k.set.leadTone}}}}" style="{F}; text-transform: none; letter-spacing: 0; font-weight: 400">{opts('k.leadToneOpts')}</select></label>
</div>
<div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px">
<label style="display: flex; flex-direction: column; gap: 6px; {LBL}">Key result<input type="text" value="{{{{k.name}}}}" onChange="{{{{k.set.name}}}}" style="{F}; text-transform: none; letter-spacing: 0; font-weight: 400"></label>
<label style="display: flex; flex-direction: column; gap: 6px; {LBL}">Objective<select onChange="{{{{k.set.obj}}}}" style="{F}; text-transform: none; letter-spacing: 0; font-weight: 400">{opts('k.objOpts')}</select></label>
<label style="display: flex; flex-direction: column; gap: 6px; {LBL}">Owner<select onChange="{{{{k.set.owner}}}}" style="{F}; text-transform: none; letter-spacing: 0; font-weight: 400">{opts('k.ownerOpts')}</select></label>
</div>
<div style="padding: 14px 16px; border-radius: 10px; background: #E7F2EC; color: #1E5E38; font-size: 14px; line-height: 1.55"><strong>✓ Quality check.</strong> The KR measures an outcome, not an activity. “Achieved” is a yes or no, with no debate. If every task is done but the metric does not move, the KR is <strong>not</strong> achieved.</div>
''')

S2 = sec('2 · Initiatives — the levers', '3 to 5 maximum. Each one is a bet written as “if… then…”.', f'''
<sc-for list="{{{{k.inits}}}}" as="it" hint-placeholder-count="3">
<div style="display: grid; grid-template-columns: 34px minmax(0, 1fr) 200px 34px; gap: 8px 10px; align-items: center; padding: 12px 0; border-top: 1px solid #EFEBE3">
<span style="width: 28px; height: 28px; border-radius: 50%; background: {INK}; color: #D9B46A; font-size: 13px; font-weight: 600; display: inline-flex; align-items: center; justify-content: center">{{{{it.n}}}}</span>
<input type="text" aria-label="{{{{it.label}}}}" value="{{{{it.name}}}}" onChange="{{{{it.setName}}}}" placeholder="Initiative" style="{F}; font-weight: 600">
<input type="text" aria-label="{{{{it.contribLabel}}}}" value="{{{{it.contrib}}}}" onChange="{{{{it.setContrib}}}}" placeholder="Estimated contribution" title="Estimated contribution to the KR" style="{F}">
<button type="button" onClick="{{{{it.remove}}}}" aria-label="{{{{it.removeLabel}}}}" title="Remove" style="{X}">×</button>
<span style="grid-column: 2 / 4; {LBL}; margin-top: 2px">Hypothesis · if… then…</span>
<textarea rows="2" aria-label="{{{{it.hypLabel}}}}" onChange="{{{{it.setHyp}}}}" placeholder="If we do X, then the metric moves by Y" style="grid-column: 2 / 4; {F}; resize: vertical; line-height: 1.45">{{{{it.hyp}}}}</textarea>
</div>
</sc-for>
<div style="display: flex; justify-content: space-between; align-items: center; gap: 12px"><span style="{{{{k.initCountStyle}}}}">{{{{k.initCountLabel}}}}</span>
<sc-if value="{{{{k.canAddInit}}}}" hint-placeholder-val="{{{{true}}}}"><button type="button" onClick="{{{{k.addInit}}}}" style="{BTN_S}">+ Add an initiative</button></sc-if></div>
''')

S3 = sec('3 · Milestones', 'Concrete deliverables on the quarter’s weeks. W6 = mid-point, W12 = closing and scoring.', f'''
<div style="display: flex; flex-direction: column; gap: 8px">
<sc-for list="{{{{k.miles}}}}" as="ml" hint-placeholder-count="5">
<div style="{{{{ml.row}}}}">
<button type="button" role="checkbox" aria-checked="{{{{ml.done}}}}" aria-label="{{{{ml.checkLabel}}}}" onClick="{{{{ml.toggle}}}}" style="{{{{ml.box}}}}">{{{{ml.mark}}}}</button>
<select aria-label="Week" onChange="{{{{ml.setWeek}}}}" style="{F}; width: 84px; font-family: {MONO}">{opts('ml.weekOpts', 'w')}</select>
<input type="text" aria-label="{{{{ml.label}}}}" value="{{{{ml.text}}}}" onChange="{{{{ml.setText}}}}" style="{{{{ml.field}}}}">
<span style="{{{{ml.stateStyle}}}}">{{{{ml.state}}}}</span>
<button type="button" onClick="{{{{ml.remove}}}}" aria-label="Remove milestone" title="Remove" style="{X}">×</button>
</div>
</sc-for>
</div>
<button type="button" onClick="{{{{k.addMile}}}}" style="{BTN_S}; align-self: flex-start">+ Add a milestone</button>
''')

S4 = sec('4 · Task roadmap', 'Timeline of the tasks, grouped by initiative. Click a task to edit it.', f'''
<div style="overflow-x: auto"><div style="min-width: 700px; display: flex; flex-direction: column">
<div style="display: grid; grid-template-columns: 190px repeat(13, minmax(0, 1fr)); align-items: end; padding-bottom: 6px; border-bottom: 2px solid {INK}">
<span style="{LBL}">Task · owner</span>
<sc-for list="{{{{weeks}}}}" as="w" hint-placeholder-count="13"><span style="{{{{w.style}}}}">{{{{w.label}}}}<span style="display: block; font-size: 10px; font-weight: 400; color: #8E8A80">{{{{w.date}}}}</span></span></sc-for>
</div>
<div style="display: grid; grid-template-columns: 190px repeat(13, minmax(0, 1fr)); align-items: center; min-height: 34px; border-bottom: 1px solid #EFEBE3">
<span style="font-size: 12px; font-weight: 600; color: #7A4B00">Milestones</span>
<sc-for list="{{{{k.mileMarks}}}}" as="mm" hint-placeholder-count="5"><span title="{{{{mm.title}}}}" style="{{{{mm.style}}}}">{{{{mm.label}}}}</span></sc-for>
</div>
<sc-for list="{{{{k.groups}}}}" as="g" hint-placeholder-count="3">
<div style="display: flex; align-items: center; gap: 10px; padding: 12px 0 6px"><span style="font-family: {MONO}; font-size: 12px; color: #7A4B00">{{{{g.tag}}}}</span><strong style="font-size: 14px">{{{{g.name}}}}</strong><span style="font-size: 12px; color: {MUTE}">{{{{g.count}}}}</span></div>
<sc-for list="{{{{g.tasks}}}}" as="t" hint-placeholder-count="2">
<div style="display: grid; grid-template-columns: 190px repeat(13, minmax(0, 1fr)); align-items: center; min-height: 40px; border-top: 1px solid #F1EEE7">
<button type="button" onClick="{{{{t.open}}}}" style="grid-row: 1; grid-column: 1; min-width: 0; text-align: left; padding: 4px 10px 4px 0; border: 0; background: transparent; font: inherit; color: {INK}; cursor: pointer"><span style="display: block; font-size: 13px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">{{{{t.title}}}}</span><span style="display: block; font-size: 11px; color: {MUTE}">{{{{t.sub}}}}</span></button>
<span style="grid-row: 1; grid-column: 4; align-self: stretch; background: #FBF6EC"></span>
<button type="button" onClick="{{{{t.open}}}}" aria-label="{{{{t.aria}}}}" style="{{{{t.bar}}}}">{{{{t.barLabel}}}}</button>
</div>
</sc-for>
<sc-if value="{{{{g.empty}}}}" hint-placeholder-val="{{{{false}}}}"><div style="font-size: 13px; color: #8E8A80; padding: 4px 0 8px">No task yet for this initiative.</div></sc-if>
</sc-for>
</div></div>
<div style="display: flex; flex-wrap: wrap; gap: 16px; font-size: 12px; color: {MUTE}">
<span style="display: inline-flex; align-items: center; gap: 6px"><span style="width: 14px; height: 8px; border-radius: 3px; background: #D8D3C7"></span>To do</span>
<span style="display: inline-flex; align-items: center; gap: 6px"><span style="width: 14px; height: 8px; border-radius: 3px; background: #C9A04A"></span>In progress</span>
<span style="display: inline-flex; align-items: center; gap: 6px"><span style="width: 14px; height: 8px; border-radius: 3px; background: #B42318"></span>Blocked or late</span>
<span style="display: inline-flex; align-items: center; gap: 6px"><span style="width: 14px; height: 8px; border-radius: 3px; background: #2E7D4F"></span>Done</span>
<span style="display: inline-flex; align-items: center; gap: 6px"><span style="width: 14px; height: 8px; border-radius: 3px; background: #FBF6EC; border: 1px solid #E6D3A8"></span>This week (W3)</span>
</div>
''', f'<button type="button" onClick="{{{{k.newTask}}}}" style="{BTN_P}">+ Add a task</button>')

S5 = sec('5 · Risks & dependencies', 'What could stop the KR, how likely, how bad, and who handles it.', f'''
<div style="display: grid; grid-template-columns: minmax(0, 1.4fr) 110px 110px minmax(0, 1.4fr) 130px 34px; gap: 8px 10px; align-items: start">
<span style="{LBL}">Risk / dependency</span><span style="{LBL}">Probability</span><span style="{LBL}">Impact</span><span style="{LBL}">Mitigation</span><span style="{LBL}">Owner</span><span></span>
<sc-for list="{{{{k.risks}}}}" as="r" hint-placeholder-count="2">
<textarea rows="3" aria-label="Risk" onChange="{{{{r.setText}}}}" style="{F}; resize: vertical; line-height: 1.45">{{{{r.text}}}}</textarea>
<select aria-label="Probability" onChange="{{{{r.setP}}}}" style="{{{{r.pStyle}}}}">{opts('r.pOpts', 'x')}</select>
<select aria-label="Impact" onChange="{{{{r.setI}}}}" style="{{{{r.iStyle}}}}">{opts('r.iOpts', 'x')}</select>
<textarea rows="3" aria-label="Mitigation" onChange="{{{{r.setFix}}}}" style="{F}; resize: vertical; line-height: 1.45">{{{{r.fix}}}}</textarea>
<select aria-label="Owner" onChange="{{{{r.setOwner}}}}" style="{F}">{opts('r.ownerOpts', 'x')}</select>
<button type="button" onClick="{{{{r.remove}}}}" aria-label="Remove risk" title="Remove" style="{X}">×</button>
</sc-for>
</div>
<sc-if value="{{{{k.noRisk}}}}" hint-placeholder-val="{{{{false}}}}"><div style="font-size: 13px; color: #8E8A80">No risk listed yet.</div></sc-if>
<button type="button" onClick="{{{{k.addRisk}}}}" style="{BTN_S}; align-self: flex-start">+ Add a risk</button>
''')

S6 = sec('6 · Weekly check-in', 'Every week, the owner updates the value and says what moved it.', f'''
<div style="display: flex; flex-direction: column; gap: 12px; padding: 16px; border-radius: 12px; background: {SOFT}">
<div style="display: flex; justify-content: space-between; align-items: baseline"><strong style="font-size: 15px">Week 3 — Tuesday, Oct 13</strong><span style="font-size: 12px; color: {MUTE}">{{{{k.checkState}}}}</span></div>
<div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px">
<label style="display: flex; flex-direction: column; gap: 6px; font-size: 13px; font-weight: 600">Current value<input type="number" step="any" value="{{{{ci.value}}}}" onChange="{{{{ci.setValue}}}}" style="{F}; font-family: {MONO}"></label>
<label style="display: flex; flex-direction: column; gap: 6px; font-size: 13px; font-weight: 600">Confidence of reaching it (1–10)<input type="number" min="1" max="10" value="{{{{ci.conf}}}}" onChange="{{{{ci.setConf}}}}" style="{F}; font-family: {MONO}"></label>
<label style="display: flex; flex-direction: column; gap: 6px; font-size: 13px; font-weight: 600">What moved the metric<textarea rows="2" onChange="{{{{ci.setMoved}}}}" style="{F}; font-weight: 400; resize: vertical">{{{{ci.moved}}}}</textarea></label>
<label style="display: flex; flex-direction: column; gap: 6px; font-size: 13px; font-weight: 600">What is blocking<textarea rows="2" onChange="{{{{ci.setBlocks}}}}" style="{F}; font-weight: 400; resize: vertical">{{{{ci.blocks}}}}</textarea></label>
</div>
<div style="display: flex; flex-direction: column; gap: 6px"><span style="font-size: 13px; font-weight: 600">The 3 priorities for next week</span>
<div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px">
<input type="text" aria-label="Priority 1" value="{{{{ci.p1}}}}" onChange="{{{{ci.setP1}}}}" placeholder="1." style="{F}">
<input type="text" aria-label="Priority 2" value="{{{{ci.p2}}}}" onChange="{{{{ci.setP2}}}}" placeholder="2." style="{F}">
<input type="text" aria-label="Priority 3" value="{{{{ci.p3}}}}" onChange="{{{{ci.setP3}}}}" placeholder="3." style="{F}"></div></div>
<button type="button" onClick="{{{{ci.post}}}}" style="{BTN_P}; align-self: flex-end">Post the check-in</button>
</div>
<sc-for list="{{{{k.checkins}}}}" as="c" hint-placeholder-count="2">
<article style="display: grid; grid-template-columns: 170px minmax(0, 1fr); gap: 16px; padding: 14px 0; border-top: 1px solid #EFEBE3">
<div><div style="font-size: 14px; font-weight: 600">{{{{c.title}}}}</div><div style="font-family: {MONO}; font-size: 20px; margin-top: 6px">{{{{c.value}}}}</div><div style="font-size: 12px; color: {MUTE}; margin-top: 4px">Confidence <strong style="{{{{c.confStyle}}}}">{{{{c.conf}}}} / 10</strong></div></div>
<div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; font-size: 13px; line-height: 1.5; color: {BODY}">
<div><div style="{LBL}; margin-bottom: 4px">What moved it</div>{{{{c.moved}}}}</div>
<div><div style="{LBL}; margin-bottom: 4px">What blocks</div>{{{{c.blocks}}}}</div>
<div><div style="{LBL}; margin-bottom: 4px">Next week’s priorities</div><ol style="margin: 0; padding-left: 18px"><sc-for list="{{{{c.prios}}}}" as="p" hint-placeholder-count="3"><li>{{{{p.t}}}}</li></sc-for></ol></div>
</div></article>
</sc-for>
''')

S7 = sec('7 · Closing the key result', 'At W12: score it, read it, and decide what happens next.', f'''
<div style="display: grid; grid-template-columns: 180px minmax(0, 1fr); gap: 16px; align-items: center">
<label style="display: flex; flex-direction: column; gap: 6px; font-size: 13px; font-weight: 600">Final score (0 → 1.0)<input type="number" min="0" max="1" step="0.1" value="{{{{k.close.score}}}}" onChange="{{{{k.close.setScore}}}}" style="{F}; font-family: {MONO}; font-size: 18px"></label>
<div style="display: flex; flex-direction: column; gap: 8px"><div style="display: grid; grid-template-columns: 3fr 3fr 4fr; gap: 4px; font-size: 12px; text-align: center">
<span style="{{{{k.close.b1}}}}">0.0–0.3 · failure</span><span style="{{{{k.close.b2}}}}">0.4–0.6 · progress</span><span style="{{{{k.close.b3}}}}">0.7–1.0 · success (ambitious KR)</span></div>
<span style="font-size: 13px; color: {MUTE}">{{{{k.close.reading}}}}</span></div>
</div>
<div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px">
<label style="display: flex; flex-direction: column; gap: 6px; font-size: 13px; font-weight: 600">Initiatives that really had an impact<textarea rows="3" onChange="{{{{k.close.setWorked}}}}" style="{F}; font-weight: 400; resize: vertical">{{{{k.close.worked}}}}</textarea></label>
<label style="display: flex; flex-direction: column; gap: 6px; font-size: 13px; font-weight: 600">Initiatives with no effect (not to renew)<textarea rows="3" onChange="{{{{k.close.setNoEffect}}}}" style="{F}; font-weight: 400; resize: vertical">{{{{k.close.noEffect}}}}</textarea></label>
<label style="display: flex; flex-direction: column; gap: 6px; font-size: 13px; font-weight: 600">Lessons for the next cycle<textarea rows="3" onChange="{{{{k.close.setLessons}}}}" style="{F}; font-weight: 400; resize: vertical">{{{{k.close.lessons}}}}</textarea></label>
<label style="display: flex; flex-direction: column; gap: 6px; font-size: 13px; font-weight: 600">What next<select onChange="{{{{k.close.setNext}}}}" style="{F}; font-weight: 400">{opts('k.close.nextOpts')}</select></label>
</div>
''')

TABS = [('def', S1), ('init', S2), ('miles', S3), ('road', S4), ('risk', S5), ('check', S6), ('close', S7)]
tabbody = ''.join(f'<sc-if value="{{{{tab.{t}}}}}" hint-placeholder-val="{{{{false}}}}">{body}</sc-if>\n' for t, body in TABS)

main = f'''<main style="flex-grow: 1; min-width: 0; box-sizing: border-box; padding: 40px 96px 48px 48px; display: flex; flex-direction: column; gap: 20px">
<header style="display: flex; justify-content: space-between; align-items: flex-end; gap: 16px">
<div><div style="font-size: 14px; color: {MUTE}; margin-bottom: 6px">Q4 2026 · week 3 of 13 · build, run and review every key result</div>
<h1 style="margin: 0; font-family: {SERIF}; font-size: 40px; font-weight: 500">Roadmap</h1></div>
<button type="button" onClick="{{{{openNewKr}}}}" aria-haspopup="dialog" style="{BTN_P}; min-height: 44px; font-size: 15px; padding: 0 20px"><span style="font-size: 18px">+</span> New key result</button>
</header>
<div style="display: grid; grid-template-columns: 250px minmax(0, 1fr); gap: 18px; align-items: start">
<nav aria-label="Key results" style="display: flex; flex-direction: column; gap: 14px">
<sc-for list="{{{{objectives}}}}" as="ob" hint-placeholder-count="3">
<div style="display: flex; flex-direction: column; gap: 6px">
<div style="{LBL}; padding: 0 4px">{{{{ob.label}}}}</div>
<sc-for list="{{{{ob.krs}}}}" as="r" hint-placeholder-count="2">
<button type="button" onClick="{{{{r.pick}}}}" aria-pressed="{{{{r.on}}}}" style="{{{{r.style}}}}">
<span style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px"><span style="font-size: 14px; font-weight: 600; line-height: 1.3">{{{{r.name}}}}</span><span style="{{{{r.pill}}}}">{{{{r.status}}}}</span></span>
<span style="font-size: 12px; color: {MUTE}">{{{{r.owner}}}} · {{{{r.progressLabel}}}}</span>
<span style="height: 5px; border-radius: 999px; background: #EFECE4; overflow: hidden; display: block"><span style="{{{{r.bar}}}}"></span></span>
</button>
</sc-for>
</div>
</sc-for>
</nav>
<div style="display: flex; flex-direction: column; gap: 16px; min-width: 0">
<section style="background: {INK}; color: #F6F4EF; border-radius: 14px; padding: 22px 24px; display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 18px; align-items: center">
<div style="min-width: 0"><div style="font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; color: #D9B46A">{{{{k.objLabel}}}}</div>
<h2 style="margin: 6px 0 8px; font-family: {SERIF}; font-size: 30px; font-weight: 500">{{{{k.name}}}}</h2>
<div style="font-size: 14px; color: #C9C4B7">{{{{k.metric}}}} · owner {{{{k.owner}}}} · {{{{k.freq}}}}</div></div>
<div style="display: grid; grid-template-columns: repeat(4, auto); gap: 24px; text-align: right">
<div><div style="font-size: 12px; color: #A8A396">Current</div><div style="font-family: {SERIF}; font-size: 26px">{{{{k.currentLabel}}}}</div><div style="font-size: 12px; color: #A8A396">target {{{{k.targetLabel}}}}</div></div>
<div><div style="font-size: 12px; color: #A8A396">Progress</div><div style="font-family: {SERIF}; font-size: 26px; color: #D9B46A">{{{{k.progressLabel}}}}</div><div style="font-size: 12px; color: #A8A396">from {{{{k.baselineLabel}}}}</div></div>
<div><div style="font-size: 12px; color: #A8A396">Confidence</div><div style="font-family: {SERIF}; font-size: 26px">{{{{k.confLabel}}}}</div><div style="font-size: 12px; color: #A8A396">last check-in</div></div>
<div><div style="font-size: 12px; color: #A8A396">Status</div><div style="margin-top: 6px"><span style="{{{{k.pillBig}}}}">{{{{k.status}}}}</span></div></div>
</div>
</section>
<div role="tablist" aria-label="Key result sections" style="display: flex; flex-wrap: wrap; gap: 4px; padding: 4px; background: #ECE8DF; border-radius: 12px; align-self: flex-start">
<sc-for list="{{{{tabs}}}}" as="tb" hint-placeholder-count="7"><button type="button" role="tab" aria-selected="{{{{tb.on}}}}" onClick="{{{{tb.go}}}}" style="{{{{tb.style}}}}">{{{{tb.label}}}}<span style="{{{{tb.countStyle}}}}">{{{{tb.count}}}}</span></button></sc-for>
</div>
{tabbody}
</div>
</div>
</main>
'''

TASKPOP = f'''<sc-if value="{{{{showTask}}}}" hint-placeholder-val="{{{{false}}}}">
<div data-overlay="info" onClick="{{{{closePop}}}}" style="position: absolute; inset: 0; background: rgba(27,27,24,0.55); display: flex; justify-content: center; align-items: flex-start; padding: 48px 0; overflow: auto; z-index: 50">
<div role="dialog" aria-modal="true" aria-labelledby="task-t" onClick="{{{{stop}}}}" style="width: 620px; max-width: calc(100% - 48px); box-sizing: border-box; background: #FFFFFF; border-radius: 16px; padding: 28px 32px; display: flex; flex-direction: column; gap: 14px">
<div style="display: flex; justify-content: space-between; align-items: center"><div><div style="{LBL}">{{{{k.name}}}}</div><h2 id="task-t" style="margin: 4px 0 0; font-family: {SERIF}; font-size: 28px; font-weight: 500">{{{{td.heading}}}}</h2></div>
<button type="button" onClick="{{{{closePop}}}}" aria-label="Close" style="width: 40px; height: 40px; border-radius: 50%; border: 1px solid #D8D3C7; background: #FFFFFF; color: {INK}; font: inherit; font-size: 20px; cursor: pointer">×</button></div>
<label style="display: flex; flex-direction: column; gap: 6px; font-size: 13px; font-weight: 600">Task<input type="text" value="{{{{td.title}}}}" onChange="{{{{td.setTitle}}}}" placeholder="A concrete task of 8 h max" style="{F}; font-weight: 400"></label>
<sc-if value="{{{{td.titleErr}}}}" hint-placeholder-val="{{{{false}}}}"><div role="alert" style="margin-top: -8px; font-size: 13px; font-weight: 600; color: #B42318">Give the task a title.</div></sc-if>
<div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px">
<label style="display: flex; flex-direction: column; gap: 6px; font-size: 13px; font-weight: 600">Initiative<select onChange="{{{{td.setInit}}}}" style="{F}; font-weight: 400">{opts('td.initOpts')}</select></label>
<label style="display: flex; flex-direction: column; gap: 6px; font-size: 13px; font-weight: 600">Owner<select onChange="{{{{td.setOwner}}}}" style="{F}; font-weight: 400">{opts('td.ownerOpts')}</select></label>
<label style="display: flex; flex-direction: column; gap: 6px; font-size: 13px; font-weight: 600">Start week<select onChange="{{{{td.setStart}}}}" style="{F}; font-weight: 400">{opts('td.startOpts')}</select></label>
<label style="display: flex; flex-direction: column; gap: 6px; font-size: 13px; font-weight: 600">End week<select onChange="{{{{td.setEnd}}}}" style="{F}; font-weight: 400">{opts('td.endOpts')}</select></label>
<label style="display: flex; flex-direction: column; gap: 6px; font-size: 13px; font-weight: 600">Estimate (hours)<input type="number" min="1" max="40" value="{{{{td.est}}}}" onChange="{{{{td.setEst}}}}" style="{F}; font-weight: 400; font-family: {MONO}"></label>
<label style="display: flex; flex-direction: column; gap: 6px; font-size: 13px; font-weight: 600">Status<select onChange="{{{{td.setStatus}}}}" style="{F}; font-weight: 400">{opts('td.statusOpts')}</select></label>
</div>
<sc-if value="{{{{td.tooBig}}}}" hint-placeholder-val="{{{{false}}}}"><div style="padding: 10px 12px; border-radius: 8px; background: #FDF1E3; color: #8A3F06; font-size: 13px; font-weight: 600">Over 8 h: split it into several tasks.</div></sc-if>
<div style="font-size: 12px; color: {MUTE}">The task also appears in the owner’s My Day, tied to this key result.</div>
<div style="display: flex; justify-content: space-between; gap: 10px">
<sc-if value="{{{{td.isEdit}}}}" hint-placeholder-val="{{{{false}}}}"><button type="button" onClick="{{{{td.remove}}}}" style="min-height: 44px; padding: 0 16px; border: 1px solid #F1C9C4; border-radius: 10px; background: #FFFFFF; color: #B42318; font: inherit; font-size: 14px; font-weight: 600; cursor: pointer">Delete the task</button></sc-if>
<span></span>
<div style="display: flex; gap: 10px"><button type="button" onClick="{{{{closePop}}}}" style="min-height: 44px; padding: 0 18px; border: 1px solid #D8D3C7; border-radius: 10px; background: #FFFFFF; color: {INK}; font: inherit; font-size: 14px; font-weight: 600; cursor: pointer">Cancel</button>
<button type="button" onClick="{{{{td.save}}}}" style="{BTN_P}; min-height: 44px">{{{{td.saveLabel}}}}</button></div>
</div>
</div>
</div>
</sc-if>
'''

KRPOP = f'''<sc-if value="{{{{showNewKr}}}}" hint-placeholder-val="{{{{false}}}}">
<div data-overlay="info" onClick="{{{{closePop}}}}" style="position: absolute; inset: 0; background: rgba(27,27,24,0.55); display: flex; justify-content: center; align-items: flex-start; padding: 48px 0; overflow: auto; z-index: 50">
<div role="dialog" aria-modal="true" aria-labelledby="kr-t" onClick="{{{{stop}}}}" style="width: 640px; max-width: calc(100% - 48px); box-sizing: border-box; background: #FFFFFF; border-radius: 16px; padding: 28px 32px; display: flex; flex-direction: column; gap: 14px">
<div style="display: flex; justify-content: space-between; align-items: center"><div><div style="{LBL}">Roadmap</div><h2 id="kr-t" style="margin: 4px 0 0; font-family: {SERIF}; font-size: 28px; font-weight: 500">New key result</h2></div>
<button type="button" onClick="{{{{closePop}}}}" aria-label="Close" style="width: 40px; height: 40px; border-radius: 50%; border: 1px solid #D8D3C7; background: #FFFFFF; color: {INK}; font: inherit; font-size: 20px; cursor: pointer">×</button></div>
<label style="display: flex; flex-direction: column; gap: 6px; font-size: 13px; font-weight: 600">Key result<input type="text" value="{{{{nk.name}}}}" onChange="{{{{nk.setName}}}}" placeholder="e.g. €20k monthly recurring revenue" style="{F}; font-weight: 400"></label>
<sc-if value="{{{{nk.err}}}}" hint-placeholder-val="{{{{false}}}}"><div role="alert" style="margin-top: -8px; font-size: 13px; font-weight: 600; color: #B42318">Give the key result a name and a target.</div></sc-if>
<div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px">
<label style="display: flex; flex-direction: column; gap: 6px; font-size: 13px; font-weight: 600">Objective<select onChange="{{{{nk.setObj}}}}" style="{F}; font-weight: 400">{opts('nk.objOpts')}</select></label>
<label style="display: flex; flex-direction: column; gap: 6px; font-size: 13px; font-weight: 600">Owner<select onChange="{{{{nk.setOwner}}}}" style="{F}; font-weight: 400">{opts('nk.ownerOpts')}</select></label>
</div>
<label style="display: flex; flex-direction: column; gap: 6px; font-size: 13px; font-weight: 600">Metric<input type="text" value="{{{{nk.metric}}}}" onChange="{{{{nk.setMetric}}}}" placeholder="What is counted, exactly" style="{F}; font-weight: 400"></label>
<div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px">
<label style="display: flex; flex-direction: column; gap: 6px; font-size: 13px; font-weight: 600">Unit<select onChange="{{{{nk.setUnit}}}}" style="{F}; font-weight: 400">{opts('nk.unitOpts')}</select></label>
<label style="display: flex; flex-direction: column; gap: 6px; font-size: 13px; font-weight: 600">Baseline<input type="number" step="any" value="{{{{nk.baseline}}}}" onChange="{{{{nk.setBaseline}}}}" style="{F}; font-weight: 400; font-family: {MONO}"></label>
<label style="display: flex; flex-direction: column; gap: 6px; font-size: 13px; font-weight: 600">Target<input type="number" step="any" value="{{{{nk.target}}}}" onChange="{{{{nk.setTarget}}}}" style="{F}; font-weight: 400; font-family: {MONO}"></label>
</div>
<div style="font-size: 13px; line-height: 1.5; color: {MUTE}">The key result opens with the template ready: 3 empty initiatives, the milestones W2 · W4 · W6 mid-point · W9 · W12 closing, and empty risk, check-in and closing sections.</div>
<div style="display: flex; justify-content: flex-end; gap: 10px"><button type="button" onClick="{{{{closePop}}}}" style="min-height: 44px; padding: 0 18px; border: 1px solid #D8D3C7; border-radius: 10px; background: #FFFFFF; color: {INK}; font: inherit; font-size: 14px; font-weight: 600; cursor: pointer">Cancel</button>
<button type="button" onClick="{{{{nk.create}}}}" style="{BTN_P}; min-height: 44px">Create the key result</button></div>
</div>
</div>
</sc-if>
'''

H3 = 'margin: 0 0 10px; display: flex; align-items: center; gap: 10px; font-size: 17px; font-weight: 600'
NUM = 'width: 28px; height: 28px; border-radius: 50%; background: #1B1B18; color: #FFFFFF; font-size: 13px; display: inline-flex; align-items: center; justify-content: center'
TXT = 'margin: 0; padding-left: 20px; display: flex; flex-direction: column; gap: 8px; font-size: 15px; line-height: 1.55; color: #3D3A33'
INFO = f'''<sc-if value="{{{{info}}}}" hint-placeholder-val="{{{{false}}}}">
<div data-overlay="info" style="position: absolute; inset: 0; background: rgba(27,27,24,0.55); display: flex; justify-content: center; align-items: flex-start; padding-top: 48px; overflow: auto; z-index: 50">
<div role="dialog" aria-modal="true" aria-labelledby="info-title" style="width: 820px; max-width: calc(100% - 48px); box-sizing: border-box; background: #FFFFFF; border-radius: 16px; padding: 32px 36px; display: flex; flex-direction: column; gap: 24px">
<div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 20px">
<div><div style="font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; color: #5E5B53">Page method</div><h2 id="info-title" style="margin: 6px 0 0; font-family: Fraunces, Georgia, serif; font-size: 32px; font-weight: 500">Roadmap</h2></div>
<button type="button" onClick="{{{{closeInfo}}}}" aria-label="Close" style="width: 44px; height: 44px; flex-shrink: 0; border-radius: 50%; border: 1px solid #D8D3C7; background: #FFFFFF; color: #1B1B18; font: inherit; font-size: 22px; line-height: 1; cursor: pointer">×</button>
</div>
<section><h3 style="{H3}"><span style="{NUM}">1</span>What this page is for</h3>
<p style="margin: 0; font-size: 15px; line-height: 1.6; color: #3D3A33">Where key results are built, run and closed. Each key result follows the same template: definition, 3 to 5 initiatives, milestones, the task roadmap, risks, a weekly check-in and the closing score. Anyone can add tasks here, like in a project manager.</p></section>
<section><h3 style="{H3}"><span style="{NUM}">2</span>How it makes everyone more efficient</h3>
<ul style="{TXT}">
<li><strong style="color: #1B1B18">Outcomes, not activity.</strong> A key result is achieved only if its metric moves, whatever the number of tasks done.</li>
<li><strong style="color: #1B1B18">Every task serves a bet.</strong> Tasks hang under an initiative, and each initiative states what it should move.</li>
<li><strong style="color: #1B1B18">Early warning.</strong> The leading indicator and the weekly confidence show trouble weeks before the result does.</li></ul></section>
<section><h3 style="{H3}"><span style="{NUM}">3</span>How to use it</h3>
<ol style="{TXT}; padding-left: 22px">
<li>Pick a key result on the left, or create one with “+ New key result”.</li>
<li>Definition: set the metric, baseline, target, data source and leading indicator.</li>
<li>Initiatives: write 3 to 5 levers as “if… then…”, with their expected contribution.</li>
<li>Milestones: one concrete deliverable per step; W6 is the mid-point to keep or pivot initiatives.</li>
<li>Task roadmap: add tasks of 8 h max, tied to an initiative, with an owner and weeks.</li>
<li>Every week, the owner posts the check-in. At W12, close the key result with its score.</li></ol></section>
<button type="button" onClick="{{{{closeInfo}}}}" style="align-self: flex-end; min-height: 44px; padding: 0 22px; border: 0; border-radius: 10px; background: #1B1B18; color: #FFFFFF; font: inherit; font-size: 15px; font-weight: 600; cursor: pointer">Got it</button>
</div>
</div>
</sc-if>
'''

SCRIPT = (ROOT / 'skl-os' / 'roadmap_logic.js').read_text(encoding='utf-8')

out = (head + '<div style="position: relative; width: 1440px; height: 1400px; display: flex; background: #F6F4EF; font-family: \'IBM Plex Sans\', system-ui, sans-serif; color: #1B1B18">\n\n'
       + nav + '\n\n' + main + '\n' + ibtn + '\n\n' + TASKPOP + KRPOP + INFO + '</div>\n</x-dc>\n'
       + '<script type="text/x-dc" data-dc-script data-props=\'{"$preview":{"width":1440,"height":1400}}\'>\n' + SCRIPT + '\n</script>\n</body>\n</html>\n')
(P / 'Roadmap.dc.html').write_text(out, encoding='utf-8')
print('Roadmap', len(out))
