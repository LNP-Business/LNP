"""One page frame for every screen, with the Cockpit as the reference:
main padding 40px 48px, one 54px top bar (views as a segmented control on the left, context and actions on the right),
no page title (the sidebar says where you are), the same button styles everywhere.
Idempotent: pages are rebuilt from their *.pre-hz.dc.html copy; Build and Execute are modules (gen_build.py, gen_execute.py)."""
import pathlib, re, shutil
HERE = pathlib.Path(__file__).resolve().parent
P = HERE.parent / 'skl-en' / 'project'

SEG = 'display: flex; gap: 6px; padding: 5px; background: #ECE8DF; border-radius: 12px; align-self: flex-start; flex-shrink: 0'
TAB = 'display: inline-flex; align-items: center; gap: 8px; min-height: 44px; padding: 0 20px; border: 0; border-radius: 9px; font: inherit; font-size: 15px; cursor: pointer; text-decoration: none; white-space: nowrap; '
TAB_ON = TAB + 'background: #1B1B18; color: #FFFFFF; font-weight: 600'
TAB_OFF = TAB + 'background: transparent; color: #3D3A33; font-weight: 500'
BAR = 'display: flex; align-items: center; gap: 14px; min-height: 54px; padding-right: 72px'
CTX = 'font-size: 13px; line-height: 1.4; color: #5E5B53; text-align: right; min-width: 0'
PRIMARY = 'min-height: 44px; padding: 0 20px; border: 0; border-radius: 10px; background: #1B1B18; color: #D9B46A; font: inherit; font-size: 15px; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; white-space: nowrap'
SECONDARY = 'min-height: 44px; padding: 0 18px; border: 1px solid #D8D3C7; border-radius: 10px; background: #FFFFFF; color: #1B1B18; font: inherit; font-size: 14px; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; white-space: nowrap'
MAIN_PAD = 'padding: 40px 48px 48px'

def bar(left, right):
    return f'<header data-topbar style="{BAR}">{left}<span style="flex: 1"></span>{right}</header>'
def seg(items):  # items: (label, href or None for current)
    out = []
    for label, href in items:
        adm = ' data-admin-only' if href == 'Access.dc.html' else ''
        out.append(f'<span style="{TAB_ON}" aria-current="page">{label}</span>' if href is None else f'<a href="{href}"{adm} style="{TAB_OFF}">{label}</a>')
    return f'<div role="group" aria-label="Views" style="{SEG}">' + ''.join(out) + '</div>'
def restyle(btn, style):
    return re.sub(r'style="[^"]*"', f'style="{style}"', btn, count=1)
def main_pad(s):
    i = s.index('<main'); j = s.index('>', i)
    tag = re.sub(r'padding: [^;"]+', MAIN_PAD, s[i:j])
    tag = re.sub(r'gap: \d+px', 'gap: 28px', tag)
    return s[:i] + tag + s[j:]
def first_header(s):
    i = s.index('<header', s.index('<main')); j = s.index('</header>', i) + len('</header>')
    return i, j, s[i:j]
def source(name):
    f, bak = P / f'{name}.dc.html', P / f'{name}.pre-hz.dc.html'
    if not bak.exists():
        shutil.copy(f, bak)
    return f, bak.read_text(encoding='utf-8')

# ---- Decisions: Board | Archive on the left, lead-time rule and New decision on the right
f, s = source('Decisions')
i, j, h = first_header(s)
btns = re.findall(r'<button.*?</button>', h, re.S)
arch, new = btns[0], btns[1]
arch_inner = re.sub(r'<svg.*?</svg>', '', arch[arch.index('>') + 1:-len('</button>')], flags=re.S)
arch_btn = arch[:arch.index('>') + 1]
arch_btn = restyle(arch_btn, TAB_OFF) + arch_inner + '</button>'
rule = re.search(r'<div style="font-size: 14px[^>]*>(.*?)</div>', h).group(1)
s = s[:i] + bar(f'<div role="group" aria-label="Views" style="{SEG}"><span style="{TAB_ON}" aria-current="page">Board</span>{arch_btn}</div>',
                f'<span style="{CTX}">{rule}</span>' + restyle(new, PRIMARY)) + s[j:]
f.write_text(main_pad(s), encoding='utf-8'); print('Decisions ok')

# ---- Weekly Review: This week | History on the left, week, status and facilitator on the right
f, s = source('Review')
i, j, h = first_header(s)
tabs = re.search(r'<div role="tablist".*?</div>', h, re.S).group(0)
tabs = re.sub(r'style="display: flex; gap: 4px; padding: 5px; background: #ECE8DF; border-radius: 12px"', f'style="{SEG}"', tabs)
right = (f'<span style="{CTX}">{{{{eyebrow}}}}<br>{{{{facilitator}}}}</span><span style="{{{{statusPill.style}}}}">{{{{statusPill.label}}}}</span>')
s = s[:i] + bar(tabs, right) + s[j:]
old_tab = 'min-height: 40px; padding: 0 16px; border: 0; border-radius: 9px; font: inherit; font-size: 14px; cursor: pointer; '
assert s.count(old_tab) >= 2, 'review tab style'
s = s.replace(old_tab, 'min-height: 44px; padding: 0 20px; border: 0; border-radius: 9px; font: inherit; font-size: 15px; cursor: pointer; ')
s = s.replace("'background: transparent; color: #3D3A33;'),", "'background: transparent; color: #3D3A33; font-weight: 500;'),")
f.write_text(main_pad(s), encoding='utf-8'); print('Review ok')

# ---- Settings: Alerts | Registers, save state and buttons on the right
f, s = source('Settings')
i, j, h = first_header(s)
btns = re.findall(r'<button.*?</button>', h, re.S)
save_txt = re.search(r'<span style="font-size: 13px; color: \{\{saveColor\}\}">\{\{saveText\}\}</span>', h).group(0)
s = s[:i] + bar(seg([('Alerts &amp; notifications', None), ('Registers', 'Registers.dc.html'), ('Account', 'Account.dc.html'), ('Access', 'Access.dc.html')]), save_txt + restyle(btns[0], SECONDARY) + btns[1]) + s[j:]
f.write_text(main_pad(s), encoding='utf-8'); print('Settings ok')

f, s = source('Registers')
i, j, h = first_header(s)
s = s[:i] + bar(seg([('Alerts &amp; notifications', 'Settings.dc.html'), ('Registers', None), ('Account', 'Account.dc.html'), ('Access', 'Access.dc.html')]),
                f'<span style="{CTX}; max-width: 520px">What belongs to several mechanisms at once, written once so nobody reconciles two copies.</span>') + s[j:]
f.write_text(main_pad(s), encoding='utf-8'); print('Registers ok')

# ---- Library: Library | Mechanism map, IP legend and New deliverable on the right
f, s = source('Bibliotheque')
i, j, h = first_header(s)
new = re.search(r'<button.*?</button>', h, re.S).group(0)
legend_start = s.index('<div style="display: flex; align-items: center; gap: 18px; font-size: 12px; color: #5E5B53">', j)
legend_end = s.index('</div>', s.index('</span></div>', legend_start)) if False else s.index('</span></div>', legend_start) + len('</span></div>')
s = (s[:i] + bar('',
                 f'<span style="{CTX}"><span style="padding: 2px 7px; border-radius: 5px; background: #F4ECDD; color: #7A4B00; font-weight: 600">IP</span> SKL intellectual property · click a deliverable to open it</span>' + restyle(new, PRIMARY))
     + s[j:legend_start] + s[legend_end:])
f.write_text(main_pad(s), encoding='utf-8'); print('Library ok')

# ---- CRM (its own document): same top bar for Pipeline | Leads, same frame
crm = HERE / 'crm_doc.html'; c = crm.read_text(encoding='utf-8')
MARK = '<style id="hz">'
c = re.sub(r'<style id="hz">.*?</style>', '', c, flags=re.S)
CSS = ('.cx-head{display:none!important}.wrap{max-width:none!important;padding:40px 48px 48px 48px!important}'
       '.cx-tabs-row{margin:0 0 28px!important;min-height:54px;padding-right:72px}'
       '.cx-tabs{background:#ECE8DF!important;border:0!important;padding:5px!important;gap:6px!important;border-radius:12px!important}'
       '.cx-tabs button{min-height:44px;padding:0 20px!important;border-radius:9px!important;font-size:15px!important;font-weight:500!important;color:#3D3A33!important}'
       '.cx-tabs button.on{background:#1B1B18!important;color:#FFFFFF!important;font-weight:600!important}.cx-tabs button.on .cx-n{background:#34322C;color:#D9B46A}')
c = c.replace('</body>', MARK + CSS + '</style></body>', 1) if '</body>' in c else c + MARK + CSS + '</style>'
crm.write_text(c, encoding='utf-8'); print('CRM ok')
