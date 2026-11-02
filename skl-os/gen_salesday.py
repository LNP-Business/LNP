"""Sales System › Sales Day (Romain 2026-10-31): the sales rep's day, one lead at a time, like Execute in the Operating System.
The page holds a [data-salesday] slot; build.py mounts the SKL_SALESDAY module (salesday_module.js) in it."""
from shell import write_screen, info_popup
from gen_access import bar, CTX

MAIN = ('<main style="flex-grow: 1; min-width: 0; box-sizing: border-box; padding: 40px 48px 48px; display: flex; flex-direction: column; gap: 28px; position: relative">\n'
        + bar('', f'<span style="{CTX}; max-width: 560px">One lead at a time: outcomes to declare first, then calls, reschedules and follow-ups.</span>')
        + '\n<div data-salesday="1" style="width: 100%"></div>\n</main>')
INFO = info_popup('Sales Day', [
    ('What this page is for', 'p', "The sales rep's day in the CRM, one lead at a time: every lead that needs you today comes as a card, in the "
     "order that protects the cash. First the outcomes to declare (a call is over and nothing is declared), then today's calls to prepare, "
     "the reschedules to plan (an R2 not held, a canceled call), the no-shows to re-engage and the follow-ups due."),
    ('How it helps', 'ul', [
        '<strong>Nothing falls through.</strong> The queue is built from the CRM itself, so a call never stays without its outcome and a lead never waits without a follow-up.',
        '<strong>One thing at a time.</strong> Like Execute, you see one lead, the action to take and what you need to take it, nothing else.',
        '<strong>The CRM stays true.</strong> An outcome declared here is the same as in CRM › Sales cycle; "Done" saves what you did as a note on the lead.']),
    ('How to use it', 'ol', [
        'Start the day here. Choose My leads (or a sales rep, for the leads).',
        'For an outcome: say if the call was held, then the decision (and the reason for a no), then <em>Declare and next</em>.',
        'For the other cards: do the action, write in one line what you did, then <em>Done</em> or swipe the card to the right.',
        '<em>Tomorrow</em> puts a lead aside for today, <em>Skip</em> sends it to the end of the queue; <em>Up next</em> lets you pick another lead first.',
        'Your list of the day (done, put aside) is kept for you only.'])
])
write_screen('SalesDay.dc.html', 'Sales Day', MAIN, INFO, 'roadmap2_logic.js')
