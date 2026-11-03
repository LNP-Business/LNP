"""One page frame for every screen, with the Cockpit as the reference:
main padding 40px 48px, one 54px top bar (views as a segmented control on the left, context and actions on the right),
no page title (the sidebar says where you are), the same button styles everywhere.
Idempotent: pages are rebuilt from their *.pre-hz.dc.html copy. LNP: Settings and the CRM only."""
import pathlib, re, shutil, json
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
# Settings views, in French (LNP, Romain 2026-11-03); an edition (edition.json "settings") keeps only its own Settings screens
_ed = HERE.parent / 'edition.json'
_keep = json.load(open(_ed, encoding='utf-8')).get('settings') if _ed.exists() else None
SETTINGS_TABS = [('Alertes et notifications', 'Settings.dc.html'), ('Registres', 'Registers.dc.html'), ('Compte', 'Account.dc.html'), ('Accès', 'Access.dc.html')]
def settings_seg(current):
    return seg([(l, None if f == current else f) for l, f in SETTINGS_TABS if not _keep or f in _keep or f == current])
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

# ---- Settings: Alerts, save state and buttons on the right
f, s = source('Settings')
i, j, h = first_header(s)
btns = re.findall(r'<button.*?</button>', h, re.S)
save_txt = re.search(r'<span style="font-size: 13px; color: \{\{saveColor\}\}">\{\{saveText\}\}</span>', h).group(0)
s = s[:i] + bar(settings_seg('Settings.dc.html'), save_txt + restyle(btns[0], SECONDARY) + btns[1]) + s[j:]
f.write_text(main_pad(s), encoding='utf-8'); print('Settings ok')


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
