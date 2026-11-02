"""Settings › Access: which screens each person can open. Admins only, web edition only.
Settings › Account (below): who you are, sign-in and sign-out, and Team access for admins.
The screen is a frame; web/public/skl-web.js fills [data-access] for admins. In a claude.ai Artifact the
entry is hidden (no admin session), and the frame explains where access is managed."""
from shell import write_screen, info_popup, CARD, H2

# same top bar as harmonize.py (not imported: importing it would re-run its page rewrites)
SEG = 'display: flex; gap: 6px; padding: 5px; background: #ECE8DF; border-radius: 12px; align-self: flex-start; flex-shrink: 0'
TAB = 'display: inline-flex; align-items: center; gap: 8px; min-height: 44px; padding: 0 20px; border: 0; border-radius: 9px; font: inherit; font-size: 15px; cursor: pointer; text-decoration: none; white-space: nowrap; '
TAB_ON = TAB + 'background: #1B1B18; color: #FFFFFF; font-weight: 600'
TAB_OFF = TAB + 'background: transparent; color: #3D3A33; font-weight: 500'
BAR = 'display: flex; align-items: center; gap: 14px; min-height: 54px; padding-right: 72px'
CTX = 'font-size: 13px; line-height: 1.4; color: #5E5B53; text-align: right; min-width: 0'
def bar(left, right):
    return f'<header data-topbar style="{BAR}">{left}<span style="flex: 1"></span>{right}</header>'
def seg(items):
    adm = lambda h: ' data-admin-only' if h == 'Access.dc.html' else ''
    out = [f'<span style="{TAB_ON}" aria-current="page">{l}</span>' if h is None else f'<a href="{h}"{adm(h)} style="{TAB_OFF}">{l}</a>' for l, h in items]
    return f'<div role="group" aria-label="Views" style="{SEG}">' + ''.join(out) + '</div>'

MAIN = ('<main style="flex-grow: 1; min-width: 0; box-sizing: border-box; padding: 40px 48px 48px; display: flex; flex-direction: column; gap: 28px; position: relative">\n'
        + bar(seg([('Alerts &amp; notifications', 'Settings.dc.html'), ('Registers', 'Registers.dc.html'), ('Account', 'Account.dc.html'), ('Access', None)]),
              f'<span style="{CTX}; max-width: 520px">Choose which systems and screens each person can open.</span>')
        + f'\n<div data-access><section style="{CARD}; padding: 28px; display: flex; flex-direction: column; gap: 8px">'
          f'<h2 style="{H2}">Access is managed in the web edition</h2>'
          '<p style="margin: 0; font-size: 15px; line-height: 1.6; color: #5E5B53">Sign in to SKL OS on the web as an admin to choose which screens each person can open.</p>'
          '</section></div>\n</main>')
INFO = info_popup('Access', [
    ('What this page is for', 'p', 'Decide which systems and screens each person can open: Operating, Sales, Knowledge, Agent and Settings. Only admins see this page.'),
    ('How it helps', 'ul', [
        'Keep the team focused: close a system (for example the Sales System) for someone who does not need it.',
        'Open a whole system in one click, or only some of its screens.']),
    ('How to use it', 'ol', [
        'Each person has a card with the five areas: Operating System, Sales System, Knowledge System, Agent System and Settings.',
        'Untick an area to close all its screens, or untick screens one by one. Changes are saved at once.',
        'The person sees the change the next time they open or reload SKL OS. A hidden area disappears from their sidebar.',
        'Everyone, new people included, starts with every system open. <strong>Open everything</strong> brings a person back to that.',
        'Admins can be narrowed too but always keep this page; nobody changes their own access. Closing a screen hides it, not its data.'])
])
write_screen('Access.dc.html', 'Access', MAIN, INFO, 'roadmap2_logic.js')


# ---- Settings › Account: who uses SKL OS here, sign-in and sign-out, Team access (Romain, 2026-10-26: out of the sidebar)
# [data-me] is filled by the shell (build.py: the "You are" choice and where the data is saved); [data-account] by
# web/public/skl-web.js in the web edition (signed-in person, Sign out, Team access for admins).
AMAIN = ('<main style="flex-grow: 1; min-width: 0; box-sizing: border-box; padding: 40px 48px 48px; display: flex; flex-direction: column; gap: 28px; position: relative">\n'
         + bar(seg([('Alerts &amp; notifications', 'Settings.dc.html'), ('Registers', 'Registers.dc.html'), ('Account', None), ('Access', 'Access.dc.html')]),
               f'<span style="{CTX}; max-width: 520px">Who is using SKL OS here, how to sign out, and who is on the team.</span>')
         + f'\n<section style="{CARD}; padding: 28px; display: flex; flex-direction: column; gap: 14px; max-width: 760px">'
           f'<h2 style="{H2}">Who uses SKL OS here</h2>'
           '<p style="margin: 0; font-size: 15px; line-height: 1.6; color: #5E5B53">My Day, the alerts and the plan show your own tasks, check-ins and milestones for the person chosen here.</p>'
           '<div data-me style="display: flex; flex-direction: column; gap: 10px; max-width: 420px"></div></section>'
         + f'\n<div data-account style="display: flex; flex-direction: column; gap: 28px; max-width: 980px"><section style="{CARD}; padding: 28px; display: flex; flex-direction: column; gap: 8px">'
           f'<h2 style="{H2}">Sign-in and team</h2>'
           '<p style="margin: 0; font-size: 15px; line-height: 1.6; color: #5E5B53">In the web edition of SKL OS, this is where you see the account you are signed in with, sign out, and, as an admin, invite the team and set their roles.</p>'
           '</section></div>\n</main>')
AINFO = info_popup('Account', [
    ('What this page is for', 'p', 'Who is using SKL OS here: the person the screens show their own work for, the account signed in, and the team.'),
    ('How it helps', 'ul', [
        'The sidebar keeps only the screens; your account and the team live in one place.',
        'Admins invite people and set their role without leaving Settings.']),
    ('How to use it', 'ol', [
        '<strong>You are</strong>: choose your name so My Day, the alerts and the plan show your own work.',
        'In the web edition, <strong>Sign out</strong> ends your session on this browser.',
        'Admins: <strong>Team access</strong> invites someone (send them the link it gives), changes a role, gives a reset link or removes a person. Which screens each person opens is in the Access tab.'])
])
write_screen('Account.dc.html', 'Account', AMAIN, AINFO, 'roadmap2_logic.js')
