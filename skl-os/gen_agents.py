"""Agent System: the five screens of the agent cockpit, hosted like the mechanism pages (module: agents_module.js)."""
import pathlib, re

P = pathlib.Path(__file__).resolve().parent.parent / 'skl-en' / 'project'
tpl = (P / 'MechOS.dc.html').read_text(encoding='utf-8')
assert 'data-mech="s-os-exec|s-os-res"' in tpl

def sec(n, title, body):
    return (f'<section><h3 style="margin: 0 0 10px; display: flex; align-items: center; gap: 10px; font-size: 17px; font-weight: 600">'
            f'<span style="width: 28px; height: 28px; border-radius: 50%; background: #1B1B18; color: #FFFFFF; font-size: 13px; display: inline-flex; align-items: center; justify-content: center">{n}</span>{title}</h3>{body}</section>')
def para(t): return f'<p style="margin: 0; font-size: 15px; line-height: 1.6; color: #3D3A33">{t}</p>'
def ul(items): return ('<ul style="margin: 0; padding-left: 20px; display: flex; flex-direction: column; gap: 8px; font-size: 15px; line-height: 1.55; color: #3D3A33">'
                       + ''.join(f'<li><strong style="color: #1B1B18">{a}</strong> {b}</li>' for a, b in items) + '</ul>')
def ol(items): return ('<ol style="margin: 0; padding-left: 22px; display: flex; flex-direction: column; gap: 8px; font-size: 15px; line-height: 1.55; color: #3D3A33">'
                       + ''.join(f'<li>{x}</li>' for x in items) + '</ol>')

WHY = ul([("Agents propose, humans decide.", "Every output an agent is not yet trusted to send alone waits here for a person, and every decision teaches the agent."),
          ("Autonomy is earned.", "An agent moves up a level only when its figured criterion is met: tests passed and outputs approved without edits."),
          ("One owner per agent.", "Every agent has a person who answers for it and a person who receives what it must not handle."),
          ("Everything is traced.", "Every run keeps its trigger, result, duration and cost.")])
SCREENS = [
    ('AgentsOverview', 'overview', 'Overview',
     "The agent cockpit at a glance: what your agents do, what waits for your decision and what is drifting.",
     ["Read the five indicators; the dark one is what waits for you.", "Check the agent health table; click an agent to open its sheet.",
      "Handle the items in “To handle”: a click opens them in Decisions.", "Read the alerts: an agent below the quality threshold or in error."]),
    ('AgentsDecisions', 'decisions', 'Decisions',
     "The human control of the agents: approve, edit or reject what they propose, and handle the escalations.",
     ["Pick an item in the list on the left.", "Read why it needs you, the agent's proposal, its destination and the sources it read.",
      "Approve to send it, or reject it: the next pending item opens on its own.", "Decided items stay in the list, faded, with the decision recorded."]),
    ('AgentsRegistry', 'agents', 'Agents',
     "The registry of SKL's AI agents: what each one does, who answers for it and at what level of autonomy it works.",
     ["Click a card to open the agent sheet: how it works, its autonomy ladder, allowed actions and guardrails, performance and accountability.",
      "From the sheet, pause or reactivate the agent, or rerun its tests.", "“New agent” starts the creation of an agent."]),
    ('AgentsTriggers', 'triggers', 'Triggers',
     "The orchestration: which event wakes which agent, what it produces, who decides what happens to it, and the connectors it uses.",
     ["Read each row from left to right: when, agent, output, decision.", "Click an agent's name to open its sheet."]),
    ('AgentsLog', 'log', 'Log',
     "The traceability of the agents: every run with its trigger, result, duration and cost, most recent first.",
     ["Scan the Result column first: “Error” and “Escalation” need a look.", "Compare durations and costs between runs of the same agent."]),
]
for fname, view, label, what, how in SCREENS:
    s = tpl.replace('<title>SKL KS — Operating System</title>', f'<title>SKL AS — {label}</title>')
    s = s.replace('<div data-mech="s-os-exec|s-os-res" style="flex-grow: 1; min-width: 0"></div>',
                  f'<div data-agents="{view}" style="flex-grow: 1; min-width: 0"></div>')
    s = s.replace('>Operating System mechanism</h2>', f'>Agent System · {label}</h2>')
    a = s.index('<section>'); b = s.rindex('</section>') + len('</section>')
    s = s[:a] + sec(1, 'What this page is for', para(what)) + '\n' + sec(2, 'How it makes everyone more efficient', WHY) + '\n' + sec(3, 'How to use it', ol(how)) + s[b:]
    s = re.sub(r'(font-size: 13px; color: #A8A396; line-height: 1.5">)(.*?)(</div>)', r'\1Q4 2026 · week 3/13<br>Agent cockpit · sample data\3', s, count=1, flags=re.S)
    assert f'data-agents="{view}"' in s
    (P / f'{fname}.dc.html').write_text(s, encoding='utf-8')
print('Agent screens ok')
