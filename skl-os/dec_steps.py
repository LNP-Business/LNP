import re, pathlib
P = pathlib.Path(__file__).resolve().parent.parent / 'skl-en' / 'project' / 'Decisions.dc.html'
s = P.read_text(encoding='utf-8')

FIELD = 'font: inherit; font-size: 14px; padding: 10px 12px; border: 1px solid #1B1B18; background: #1B1B18; color: #FFFFFF; caret-color: #FFFFFF; border-radius: 8px; width: 100%; box-sizing: border-box'
LBL = 'font-size: 12px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: #5E5B53'
STEP = lambda n, t, sub: (f'<div style="display: flex; align-items: baseline; gap: 10px"><span style="width: 26px; height: 26px; flex-shrink: 0; border-radius: 50%; background: #1B1B18; color: #D9B46A; font-size: 13px; font-weight: 600; display: inline-flex; align-items: center; justify-content: center; align-self: center">{n}</span>'
                          f'<h3 style="margin: 0; font-family: Fraunces, Georgia, serif; font-size: 20px; font-weight: 500">{t}</h3><span style="margin-left: auto; font-size: 12px; color: #5E5B53; text-align: right">{sub}</span></div>')
SEC = 'display: flex; flex-direction: column; gap: 12px; padding-top: 18px; border-top: 1px solid #EFEBE3'

# 1. header: Archive to the left of New decision
old_btn = re.search(r'<button type="button" style="min-height: 44px; padding: 0 20px; border: 0; border-radius: 10px; background: #1B1B18; color: #FFFFFF; font: inherit; font-size: 15px; font-weight: 600; cursor: pointer">New decision</button>', s).group(0)
s = s.replace(old_btn, '<div style="display: flex; gap: 10px">'
    '<button type="button" onClick="{{openArchive}}" aria-haspopup="dialog" style="min-height: 44px; padding: 0 18px; border: 1px solid #1B1B18; border-radius: 10px; background: #FFFFFF; color: #1B1B18; font: inherit; font-size: 15px; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 8px">'
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="4" rx="1"></rect><path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8"></path><path d="M10 12h4"></path></svg>'
    'Archive<span style="min-width: 22px; padding: 1px 7px; box-sizing: border-box; border-radius: 999px; background: #F4ECDD; color: #7A4B00; font-size: 12px; text-align: center">{{archiveCount}}</span></button>'
    + old_btn.replace('color: #FFFFFF', 'color: #D9B46A') + '</div>', 1)

# 2. drawer body: header + the five steps (step 5 = the existing link groups)
a = s.index('<aside role="dialog"'); b = s.index('<section aria-labelledby="links"')
aside_open = re.match(r'<aside [^>]*>', s[a:]).group(0).replace('width: 560px', 'width: 660px')
close_btn = re.search(r'<button type="button" onClick="\{\{closeDrawer\}\}" aria-label="Close".*?</button>', s[a:b], flags=re.S).group(0)
head = f'''{aside_open}
{close_btn}
<div style="font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; color: #5E5B53; padding-right: 48px">Decision record · {{{{sel.colTitle}}}}</div>
<h2 id="rec" style="margin: 0; font-family: Fraunces, Georgia, serif; font-size: 26px; font-weight: 500; line-height: 1.2; padding-right: 40px">{{{{sel.title}}}}</h2>
<div style="display: flex; gap: 6px; flex-wrap: wrap"><sc-for list="{{{{sel.tags}}}}" as="tg" hint-placeholder-count="2"><span style="{{{{tg.style}}}}">{{{{tg.label}}}}</span></sc-for></div>
<div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; font-size: 14px; padding: 12px 14px; border-radius: 10px; background: #F6F4EF">
<div><div style="font-size: 12px; color: #5E5B53">Decision owner</div><strong>{{{{sel.owner}}}}</strong></div>
<div><div style="font-size: 12px; color: #5E5B53">Deadline</div><strong style="color: {{{{sel.deadlineColor}}}}">{{{{sel.deadline}}}}</strong></div>
<div><div style="font-size: 12px; color: #5E5B53">Best option</div><strong>{{{{best.name}}}} · {{{{best.value}}}}</strong></div>
</div>
<sc-if value="{{{{sel.hasActual}}}}" hint-placeholder-val="{{{{false}}}}">
<div style="display: flex; flex-direction: column; gap: 4px; padding: 12px 14px; border-radius: 10px; background: #FDF1E3"><span style="font-size: 12px; font-weight: 600; color: #8A3F06; text-transform: uppercase; letter-spacing: 0.06em">Review · expected vs actual</span><span style="font-size: 14px; line-height: 1.5"><strong>Expected:</strong> {{{{sel.expected}}}}</span><span style="font-size: 14px; line-height: 1.5"><strong>Actual:</strong> {{{{sel.actual}}}}</span></div>
</sc-if>

<section style="{SEC}">
{STEP(1, 'The problem', 'Write it as one question with its stakes')}
<textarea rows="3" aria-label="The problem" onInput="{{{{fr.setProblem}}}}" style="{FIELD}; resize: vertical; line-height: 1.5">{{{{fr.problem}}}}</textarea>
</section>

<section style="{SEC}">
{STEP(2, 'The 3 major variables', 'Weights must add up to 100')}
<div style="display: grid; grid-template-columns: 26px minmax(0, 1fr) 96px; gap: 8px 10px; align-items: center">
<span></span><span style="{LBL}">Variable</span><span style="{LBL}">Weight</span>
<sc-for list="{{{{fr.vars}}}}" as="v" hint-placeholder-count="3">
<span style="font-family: 'IBM Plex Mono', monospace; font-size: 13px; color: #7A4B00; text-align: center">V{{{{v.n}}}}</span>
<input type="text" value="{{{{v.name}}}}" aria-label="{{{{v.nameLabel}}}}" onChange="{{{{v.setName}}}}" style="{FIELD}">
<span style="display: flex; align-items: center; gap: 6px"><input type="number" min="0" max="100" step="5" value="{{{{v.w}}}}" aria-label="{{{{v.wLabel}}}}" onChange="{{{{v.setW}}}}" style="{FIELD}; font-family: 'IBM Plex Mono', monospace; text-align: right"><span style="font-size: 13px; color: #5E5B53">%</span></span>
</sc-for>
</div>
<div style="display: flex; align-items: center; gap: 10px"><div style="flex-grow: 1; height: 10px; border-radius: 999px; background: #EFECE4; display: flex; overflow: hidden"><sc-for list="{{{{fr.vars}}}}" as="v" hint-placeholder-count="3"><span style="{{{{v.bar}}}}"></span></sc-for></div><strong style="{{{{fr.totalStyle}}}}">{{{{fr.totalLabel}}}}</strong></div>
</section>

<section style="{SEC}">
{STEP(3, 'Context, variable by variable', 'What we know, what we assume, what it depends on')}
<sc-for list="{{{{fr.vars}}}}" as="v" hint-placeholder-count="3">
<label style="display: flex; flex-direction: column; gap: 6px; font-size: 14px; font-weight: 600">V{{{{v.n}}}} · {{{{v.name}}}} <span style="font-weight: 400; color: #5E5B53">· {{{{v.w}}}}%</span>
<textarea rows="3" onInput="{{{{v.setCtx}}}}" style="{FIELD}; font-weight: 400; resize: vertical; line-height: 1.5">{{{{v.ctx}}}}</textarea></label>
</sc-for>
</section>

<section style="{SEC}">
{STEP(4, 'Three options, and their value', 'Score each option 0–10 on each variable')}
<sc-for list="{{{{fr.opts}}}}" as="o" hint-placeholder-count="3">
<div style="{{{{o.card}}}}">
<div style="display: flex; align-items: center; gap: 10px"><span style="font-family: 'IBM Plex Mono', monospace; font-size: 13px; color: #7A4B00">{{{{o.letter}}}}</span>
<input type="text" value="{{{{o.name}}}}" aria-label="{{{{o.nameLabel}}}}" onChange="{{{{o.setName}}}}" style="{FIELD}; font-weight: 600">
<sc-if value="{{{{o.best}}}}" hint-placeholder-val="{{{{false}}}}"><span style="flex-shrink: 0; padding: 3px 9px; border-radius: 999px; background: #1B1B18; color: #D9B46A; font-size: 12px; font-weight: 600">Highest value</span></sc-if>
<sc-if value="{{{{o.chosen}}}}" hint-placeholder-val="{{{{false}}}}"><span style="flex-shrink: 0; padding: 3px 9px; border-radius: 999px; background: #E6F2EA; color: #1E5E38; font-size: 12px; font-weight: 600">Chosen</span></sc-if></div>
<textarea rows="2" aria-label="{{{{o.descLabel}}}}" onInput="{{{{o.setDesc}}}}" style="{FIELD}; resize: vertical; line-height: 1.5">{{{{o.desc}}}}</textarea>
<div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)) 120px; gap: 10px; align-items: end">
<sc-for list="{{{{o.scores}}}}" as="sc" hint-placeholder-count="3"><label style="display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: #5E5B53; min-width: 0"><span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis">V{{{{sc.n}}}} · {{{{sc.var}}}}</span><input type="number" min="0" max="10" value="{{{{sc.v}}}}" onChange="{{{{sc.set}}}}" style="{FIELD}; font-family: 'IBM Plex Mono', monospace; text-align: right"></label></sc-for>
<div style="display: flex; flex-direction: column; gap: 4px; align-items: flex-end"><span style="font-size: 12px; color: #5E5B53">Value</span><span style="font-family: Fraunces, Georgia, serif; font-size: 28px; line-height: 1">{{{{o.value}}}}<span style="font-size: 14px; color: #5E5B53"> / 100</span></span></div>
</div>
<div style="height: 6px; border-radius: 999px; background: #EFECE4; overflow: hidden"><span style="{{{{o.bar}}}}"></span></div>
</div>
</sc-for>
<div style="font-size: 12px; line-height: 1.5; color: #5E5B53">Value = Σ weight × score ÷ 10. It ranks the options; the owner still decides.</div>
</section>

'''
s = s[:a] + head + s[b:]

# step 5: roadmap = tasks, key result, deliverables
s = s.replace('<h3 id="links" style="margin: 0; font-family: Fraunces, Georgia, serif; font-size: 20px; font-weight: 500">Links</h3>',
              STEP(5, 'Roadmap', '').replace('<h3 ', '<h3 id="links" ').replace('<span style="margin-left: auto; font-size: 12px; color: #5E5B53; text-align: right"></span>', ''), 1)
s = s.replace('<section aria-labelledby="links" style="display: flex; flex-direction: column; gap: 16px; padding-top: 16px; border-top: 1px solid #EFEBE3">',
              '<section aria-labelledby="links" style="display: flex; flex-direction: column; gap: 16px; padding-top: 18px; border-top: 1px solid #EFEBE3">', 1)

# 3. archive popup
arch = '''
<sc-if value="{{archiveOpen}}" hint-placeholder-val="{{false}}">
<div data-overlay="info" style="position: absolute; inset: 0; background: rgba(27,27,24,0.55); display: flex; justify-content: center; align-items: flex-start; padding: 40px 0; overflow: auto; z-index: 50">
<div role="dialog" aria-modal="true" aria-labelledby="arch-t" style="width: 900px; max-width: calc(100% - 48px); box-sizing: border-box; background: #FFFFFF; border-radius: 16px; padding: 30px 36px; display: flex; flex-direction: column; gap: 18px">
<div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 20px">
<div><div style="font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; color: #5E5B53">Decisions</div><h2 id="arch-t" style="margin: 6px 0 6px; font-family: Fraunces, Georgia, serif; font-size: 32px; font-weight: 500">Archive</h2>
<p style="margin: 0; font-size: 14px; line-height: 1.5; color: #3D3A33">Every decision taken more than 2 weeks ago leaves the board and lands here automatically. {{archiveCount}} archived.</p></div>
<button type="button" onClick="{{closeArchive}}" aria-label="Close" style="width: 44px; height: 44px; flex-shrink: 0; border-radius: 50%; border: 1px solid #D8D3C7; background: #FFFFFF; color: #1B1B18; font: inherit; font-size: 22px; line-height: 1; cursor: pointer">×</button>
</div>
<div style="display: grid; grid-template-columns: minmax(0, 1.6fr) 110px minmax(0, 1.3fr) 110px 90px; gap: 14px; padding: 0 12px 8px; border-bottom: 2px solid #1B1B18; font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase; color: #5E5B53"><span>Decision</span><span>Owner</span><span>Option chosen</span><span>Decided</span><span style="text-align: right">Age</span></div>
<sc-for list="{{archive}}" as="a" hint-placeholder-count="4">
<button type="button" onClick="{{a.open}}" style="display: grid; grid-template-columns: minmax(0, 1.6fr) 110px minmax(0, 1.3fr) 110px 90px; gap: 14px; align-items: center; width: 100%; padding: 12px; border: 0; border-bottom: 1px solid #EFEBE3; background: #FFFFFF; font: inherit; color: #1B1B18; text-align: left; cursor: pointer">
<span style="min-width: 0"><span style="display: block; font-size: 15px; font-weight: 600">{{a.title}}</span><span style="display: block; font-size: 12px; color: #5E5B53; margin-top: 2px">{{a.review}}</span></span>
<span style="font-size: 14px">{{a.owner}}</span>
<span style="font-size: 14px">{{a.chosenName}}</span>
<span style="font-size: 14px">{{a.date}}</span>
<span style="font-family: 'IBM Plex Mono', monospace; font-size: 13px; color: #5E5B53; text-align: right">{{a.age}}</span>
</button>
</sc-for>
<button type="button" onClick="{{closeArchive}}" style="align-self: flex-end; min-height: 44px; padding: 0 22px; border: 0; border-radius: 10px; background: #1B1B18; color: #D9B46A; font: inherit; font-size: 15px; font-weight: 600; cursor: pointer">Close</button>
</div>
</div>
</sc-if>
'''
i = s.index('<sc-if value="{{info}}"')
s = s[:i] + arch + s[i:]
P.write_text(s, encoding='utf-8')
print('template ok')

# ---------------- logic ----------------
s = P.read_text(encoding='utf-8')
def rep(a, b):
    global s
    assert a in s, a[:80]
    s = s.replace(a, b, 1)

rep("""        d7: { kr: ['kr4'], task: [], del: ['l8'] }
      }
    };""", """        d7: { kr: ['kr4'], task: [], del: ['l8'] },
        a1: { kr: ['kr1'], task: [], del: ['l5'] },
        a2: { kr: ['kr3'], task: [], del: ['l7'] },
        a3: { kr: ['kr5'], task: [], del: [] },
        a4: { kr: [], task: [], del: [] },
        a5: { kr: ['kr1'], task: [], del: [] }
      },
      frames: JSON.parse(JSON.stringify(this.frameSeed()))
    };""")

FRAMES = r'''
  frameSeed() {
    const F = (problem, vars, opts) => ({ problem, vars: vars.map(([name, w, ctx]) => ({ name, w, ctx })), opts: opts.map(([name, desc, sc]) => ({ name, desc, sc })) });
    return {
      d1: F('Two launch tasks are blocked because we have no tool to send the sign-up sequences. Which email tool do we commit to, knowing it has to be live before Oct 20?',
        [['Deliverability', 45, 'Launch emails that land in spam cost sign-ups we cannot recover. We have no sending history yet, so the tool\'s own reputation carries us.'],
         ['Time to set up', 30, 'Michael has 5 h budgeted. Anything needing a developer or a domain warm-up longer than a week misses the launch.'],
         ['Cost at 5,000 contacts', 25, 'The KR targets 2,000 sign-ups; plan for 5,000 contacts within the quarter. Budget is tight until the first sales.']],
        [['All-in-one marketing suite', 'Email, landing pages and automations in one place. Powerful, heavier to learn.', [8, 6, 5]],
         ['Lightweight newsletter tool', 'Simple sequences and forms, good deliverability, flat pricing.', [7, 9, 8]],
         ['Transactional email API', 'Best deliverability and price, but forms and sequences must be built.', [9, 3, 9]]]),
      d2: F('The launch offer and the sales pitch cannot be finalised without a price. What price structure do we launch the masterclass series with?',
        [['Speed of the first 30 sales', 40, 'The €50k KR needs momentum in the first 10 days; the sales team needs a reason to call now.'],
         ['Perceived value', 35, 'A discount that looks permanent anchors the series low for every later cohort.'],
         ['Cash per sale', 25, 'Average order value target is €1,500. Instalments help conversion but delay cash.']],
        [['Early-bird then full price', '€990 for 10 days, then €1,490. Creates urgency, keeps the anchor.', [9, 6, 6]],
         ['Single price', '€1,490 from day one. Clean anchor, no urgency lever.', [5, 9, 8]],
         ['Payment plan', '3 × €530. Lowers the entry ticket, spreads the cash.', [7, 7, 4]]]),
      d3: F('Sign-up page conversion fell from 26% to 18% after the offer change and the live sign-ups KR is red. What do we change to get back on track before Live #1?',
        [['Speed of effect', 40, 'Live #1 is in 2 weeks. A fix that needs a new page or new traffic arrives too late.'],
         ['Effort', 25, 'Michael is at 97% load; the fix must fit in a few hours.'],
         ['Risk to the launch date', 35, 'Moving the date resets partner promotion and the sales calendar.']],
        [['Remove the price from the sign-up page', 'Keep the free sign-up free of any price signal; the price appears after the live.', [9, 9, 9]],
         ['Move Live #1 to Oct 29', 'Two more weeks of acquisition at the current conversion.', [5, 8, 3]],
         ['Partner co-promotion', 'Ask the 3 partner communities to push the live this week.', [6, 5, 8]]]),
      d4: F('Home shoots needed too much editing to fix sound and light, and editing is the slowest step. Where do we shoot the masterclasses?',
        [['Editing time', 50, 'Editing takes 5 d per masterclass today; the target is 3 d.'],
         ['Cost per shoot', 30, 'A studio day costs about €450; the home setup is already paid for.'],
         ['Scheduling flexibility', 20, 'Ilya and the speakers need to book slots at least a week ahead in a studio.']],
        [['Rent a studio', 'Controlled light and sound, one day per masterclass.', [9, 5, 6]],
         ['Upgrade the home setup', 'Buy lights and a microphone, keep shooting at home.', [6, 8, 9]],
         ['Hybrid', 'Studio for the main sequences, home for the short inserts.', [7, 6, 7]]]),
      d5: F('Editing is the bottleneck of the production chain and delays every masterclass. How do we remove it?',
        [['Production cycle time', 50, 'The target is a 14-day cycle by masterclass #3.'],
         ['Cost', 25, 'Budget allows one dedicated person part-time, not an agency retainer.'],
         ['Quality consistency', 25, 'Every masterclass must look like the same series.']],
        [['Dedicated freelance editor', 'One person who learns the format and the style guide.', [8, 6, 9]],
         ['Agency on demand', 'Fast capacity, a different editor each time.', [7, 4, 6]],
         ['Ilya edits in-house', 'No new cost, but Ilya is already at 97% load.', [3, 9, 7]]]),
      d6: F('We needed one standard format for every live, so hosting and promotion stop being reinvented each time. Which format do we use?',
        [['Attendance', 45, 'Attendance drives the sales calls booked after the live.'],
         ['Depth of Q&A', 30, 'Questions are where objections surface and get answered.'],
         ['Host effort', 25, 'Every live is prepared and hosted by the same small team.']],
        [['60 minutes', '40 min content, 20 min Q&A.', [6, 9, 5]],
         ['30 minutes', 'Short and dense, Q&A by email afterwards.', [8, 5, 8]],
         ['45 minutes and a replay', '30 min content, 15 min Q&A, replay sent the same day.', [7, 7, 7]]]),
      d7: F('Spreading a small ad budget across channels gave no usable signal. Do we concentrate it on one channel?',
        [['Readable cost-per-lead signal', 45, 'We need enough volume on a channel to read its cost per lead within 2 weeks.'],
         ['Budget', 30, 'The monthly ad budget is fixed for the quarter.'],
         ['Dependence on one channel', 25, 'One channel means one algorithm change can cut lead flow overnight.']],
        [['One channel', 'The whole budget on the channel with the best early CPL.', [9, 8, 3]],
         ['Three channels', 'Keep the budget split evenly.', [4, 5, 9]],
         ['Two channels', '70 / 30 between the best two channels.', [7, 6, 6]]]),
      a1: F('We need one repeatable format before producing the series. Do we build the series on a single masterclass format?',
        [['Production speed', 45, 'A single format lets the playbook and the editor get faster each time.'], ['Learner outcomes', 35, 'The format must work for decision-making topics of different depth.'], ['Brand consistency', 20, 'The series must be recognisable at a glance.']],
        [['One format for all', 'Same structure, length and visual style for every masterclass.', [9, 6, 9]], ['Two formats', 'Short and deep-dive versions.', [6, 8, 6]], ['Free format', 'Each speaker chooses.', [3, 7, 3]]]),
      a2: F('We had no proof that people would attend. Do we run a free pilot live before opening sales of the paid series?',
        [['Learning before spending', 45, 'A pilot tests the topic, the host and the funnel before production money is spent.'], ['Time to revenue', 30, 'A pilot delays the first sale by about 2 weeks.'], ['Audience building', 25, 'Every pilot sign-up joins the list for the launch.']],
        [['Free pilot live', 'One free live, then open sales.', [9, 5, 8]], ['Paid from day one', 'Open sales directly.', [3, 9, 4]], ['Waitlist only', 'Collect sign-ups without a live.', [5, 6, 7]]]),
      a3: F('Sales follow-up was spread across spreadsheets and inboxes. Do we run all sales follow-up in one CRM?',
        [['No lead forgotten', 50, 'Every lead needs a next action with a date.'], ['Adoption by the team', 30, 'A tool nobody updates is worse than a spreadsheet.'], ['Cost', 20, 'Budget is limited to a few seats.']],
        [['One CRM for everything', 'Pipeline, next actions and notes in one place.', [9, 7, 6]], ['Shared spreadsheet', 'Free and familiar.', [4, 8, 10]], ['Inbox and calendar only', 'No extra tool.', [2, 9, 10]]]),
      a4: F('The team needed one moment each week to look at KRs and decide. When do we hold the weekly review?',
        [['Time to act on it', 40, 'Decisions taken in the review should be acted on the same week.'], ['Attendance', 35, 'All five people must be able to attend.'], ['Freshness of data', 25, 'Numbers must include the week\'s results.']],
        [['Friday afternoon', 'Review the week that ends, plan the next.', [7, 8, 9]], ['Monday morning', 'Start the week with priorities.', [9, 6, 6]], ['Wednesday', 'Mid-week check.', [6, 7, 5]]]),
      a5: F('Subtitling took Ilya a full day per masterclass. Do we outsource subtitles?',
        [['Time freed for Ilya', 50, 'Ilya is the bottleneck on content.'], ['Cost', 30, 'About €80 per masterclass outsourced.'], ['Accuracy', 20, 'Technical terms must be right.']],
        [['Outsource to a subtitle service', 'Human-checked subtitles in 48 h.', [9, 6, 8]], ['Automatic subtitles only', 'Free, needs a proofread.', [6, 10, 5]], ['Keep in-house', 'Ilya keeps doing it.', [1, 10, 9]]])
    };
  }'''
rep("  catalog() {", FRAMES.lstrip('\n') + "\n  catalog() {")

# decided dates and archived decisions
rep("owner: 'Ilya', deadline: 'decided Oct 2', deadlineColor: green, action: 'Schedule the 30-day review' },",
    "owner: 'Ilya', deadline: 'decided Oct 2', deadlineColor: green, action: 'Schedule the 30-day review', decided: '2026-10-02', chosen: 0 },")
rep("owner: 'Romain', deadline: 'decided Oct 6', deadlineColor: green, action: 'Schedule the 30-day review' },",
    "owner: 'Romain', deadline: 'decided Oct 6', deadlineColor: green, action: 'Schedule the 30-day review', decided: '2026-10-06', chosen: 0 },")
rep("""        owner: 'Michael', deadline: 'review due Oct 16', deadlineColor: red, action: 'Close the review and capture the lesson' }
    ];""", """        owner: 'Michael', deadline: 'review due Oct 16', deadlineColor: red, action: 'Close the review and capture the lesson' },
      ...[
        ['a1', 'One masterclass format for the whole series', 'Romain', '2026-09-08', 'Reviewed Oct 8 · confirmed'],
        ['a2', 'Free pilot live before the paid series', 'Romain', '2026-09-15', 'Reviewed Oct 12 · 212 sign-ups'],
        ['a3', 'All sales follow-up in one CRM', 'Sales Lead', '2026-09-18', 'Review on Oct 18'],
        ['a4', 'Weekly review on Friday afternoon', 'Amin', '2026-09-22', 'Review on Oct 22'],
        ['a5', 'Outsource the subtitles', 'Ilya', '2026-09-26', 'Review on Oct 26']
      ].map(([id, title, owner, decided, review]) => ({
        id, col: 'done', title, question: title, owner, decided, review, chosen: 0,
        tags: [tag('Reversible', 'blue'), tag('Archived', 'grey')], meta: 'Decided ' + decided,
        deadline: 'decided ' + new Date(decided + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }), deadlineColor: green,
        action: 'Reopen as a new decision', expected: '', options: [], cause: '', assumption: ''
      }))
    ];""")

# renderVals: archive split, frame, best option, drawer states
rep("""    const all = this.decisions();""", """    const everything = this.decisions();
    const TODAY = new Date('2026-10-13T12:00:00');
    const ageOf = d => d.decided ? Math.round((TODAY - new Date(d.decided + 'T12:00:00')) / 86400000) : 0;
    const isArchived = d => d.col === 'done' && ageOf(d) > 14;
    const all = everything.filter(d => !isArchived(d));
    const archivedList = everything.filter(isArchived).sort((x, y) => ageOf(x) - ageOf(y));""")
rep("cardStyle: cardBase + (s.edit && d.id === s.sel ? ", "cardStyle: cardBase + (s.edit === 'rec' && d.id === s.sel ? ")
rep("select: () => this.setState({ sel: d.id, open: null, edit: true })", "select: () => this.setState({ sel: d.id, open: null, edit: 'rec' })")
rep("""    const d = all.find(x => x.id === s.sel) || all[0];""", """    const d = everything.find(x => x.id === s.sel) || all[0];""")
rep("""      colTitle: colDefs.find(c => c[0] === d.col)[1],""", """      colTitle: isArchived(d) ? 'Archived' : colDefs.find(c => c[0] === d.col)[1],""")

rep("""    const gdefs = [
      ['kr', 'Key results', 'a key result', 'No key result linked. Every decision should serve a key result.'],
      ['task', 'Tasks', 'a task', 'No task linked yet.'],""", """    const gdefs = [
      ['task', 'Tasks', 'a task', 'No task linked yet. List the tasks that carry out the chosen option.'],
      ['kr', 'Key result', 'a key result', 'No key result linked. Every decision should serve a key result.'],""")

rep("""    return {
      info: !!s.info,""", """    // the five-step frame of the selected decision
    const f = s.frames[d.id];
    const vars = f.vars;
    const total = vars.reduce((a, v) => a + (Number(v.w) || 0), 0);
    const valueOf = o => Math.round(vars.reduce((a, v, i) => a + (Number(v.w) || 0) * (Number(o.sc[i]) || 0), 0) / 10);
    const values = f.opts.map(valueOf);
    const bestIdx = values.indexOf(Math.max.apply(null, values));
    const upd = () => this.setState({ frames: Object.assign({}, s.frames) });
    const shades = ['#1B1B18', '#C9A04A', '#8E8A80'];
    const fr = {
      problem: f.problem,
      setProblem: (e) => { f.problem = e.target.value; },
      totalLabel: total === 100 ? 'Total 100 ✓' : 'Total ' + total + ' · must be 100',
      totalStyle: 'font-size: 13px; white-space: nowrap; color: ' + (total === 100 ? '#1E5E38' : '#B42318'),
      vars: vars.map((v, i) => ({
        n: i + 1, name: v.name, w: v.w, ctx: v.ctx,
        nameLabel: 'Variable ' + (i + 1), wLabel: 'Weight of variable ' + (i + 1),
        bar: 'display: block; height: 100%; width: ' + Math.max(0, Math.min(100, Number(v.w) || 0)) + '%; background: ' + shades[i] + ';',
        setName: (e) => { v.name = e.target.value; upd(); },
        setW: (e) => { v.w = Math.max(0, Math.min(100, Math.round(Number(e.target.value) || 0))); upd(); },
        setCtx: (e) => { v.ctx = e.target.value; }
      })),
      opts: f.opts.map((o, i) => ({
        letter: 'ABC'[i], name: o.name, desc: o.desc, value: values[i],
        nameLabel: 'Option ' + 'ABC'[i], descLabel: 'Option ' + 'ABC'[i] + ' description',
        best: i === bestIdx, chosen: d.col !== 'todo' && d.chosen === i,
        card: 'display: flex; flex-direction: column; gap: 10px; padding: 14px; border-radius: 12px; ' + (i === bestIdx ? 'border: 2px solid #C9A04A; background: #FBF6EC;' : 'border: 1px solid #E3DFD5; background: #FFFFFF;'),
        bar: 'display: block; height: 100%; width: ' + Math.min(100, values[i]) + '%; background: ' + (i === bestIdx ? '#C9A04A' : '#B7B2A6') + ';',
        setName: (e) => { o.name = e.target.value; upd(); },
        setDesc: (e) => { o.desc = e.target.value; },
        scores: vars.map((v, j) => ({
          n: j + 1, var: v.name, v: o.sc[j],
          set: (e) => { o.sc[j] = Math.max(0, Math.min(10, Math.round(Number(e.target.value) || 0))); upd(); }
        }))
      }))
    };
    const best = { name: f.opts[bestIdx].name, value: values[bestIdx] + ' / 100' };
    const archive = archivedList.map(a => ({
      title: a.title, owner: a.owner, review: a.review,
      chosenName: s.frames[a.id].opts[a.chosen].name,
      date: new Date(a.decided + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
      age: ageOf(a) + ' d',
      open: () => this.setState({ sel: a.id, edit: 'rec', open: null })
    }));

    return {
      fr, best, archive, archiveCount: archive.length,
      archiveOpen: s.edit === 'arch',
      openArchive: () => this.setState({ edit: 'arch', open: null }),
      closeArchive: () => this.setState({ edit: null }),
      info: !!s.info,""")
rep("drawer: !!s.edit,", "drawer: s.edit === 'rec',")
rep("closeDrawer: () => this.setState({ edit: false, open: null })", "closeDrawer: () => this.setState({ edit: null, open: null })")
P.write_text(s, encoding='utf-8')
print('logic ok')
