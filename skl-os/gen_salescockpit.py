"""Sales System › Cockpit: the Cockpit's Sales view on a screen of its own (Romain, 2026-10-25: "the same window, unit
economics included"). The page holds the same [data-dash] slot as Cockpit › Sales; build.py mounts the same SKL_SALES
module (sales_v2.json) in whichever of the two slots is on screen, so both always show exactly the same thing."""
from shell import write_screen, info_popup
from gen_access import bar

MAIN = ('<main style="flex-grow: 1; min-width: 0; box-sizing: border-box; padding: 40px 48px 48px; display: flex; flex-direction: column; gap: 28px; position: relative">\n'
        # no context on the right: the module draws its own period switch and parity gate there, as under Cockpit › Sales
        # no view switch: the sidebar already lists Cockpit and CRM (Romain, 2026-10-25)
        + bar('', '')
        + '\n<div data-dash="1" style="width: 100%"></div>\n</main>')
INFO = info_popup('Sales cockpit', [
    ('What this page is for', 'p', 'The sales view of SKL OS in one screen: how leads turn into cash, what each call and each sale costs and brings, '
     'how every sales rep is doing, what is coming in the next 30 days and which cash is at risk. It is the same view as Cockpit › Sales.'),
    ('How it helps', 'ul', [
        '<strong>From lead to cash</strong> shows where the funnel leaks, step by step, so the team works on the weakest step first.',
        '<strong>Unit economics</strong> follows the last 8 weeks against the baseline (dashed line): what a call, a sale and a client cost and return.',
        '<strong>Sales team</strong> ranks the sales reps by cash; a click opens their pipeline in the CRM.',
        "<strong>What's coming</strong> and <strong>Cash at risk</strong> say what to prepare and what to secure this month."]),
    ('How to use it', 'ol', [
        'Read it top to bottom on Monday morning and at the Saturday review.',
        'Hover a figure to see how it is computed; click a sales rep to open their leads in the CRM.',
        'Open the CRM (in the sidebar) to act on a lead: declare an outcome, follow up, add a note.'])
])
write_screen('SalesCockpit.dc.html', 'Sales cockpit', MAIN, INFO, 'roadmap2_logic.js')
