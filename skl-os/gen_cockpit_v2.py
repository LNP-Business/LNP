"""Cockpit › Overview (v4) and Cockpit › Key results: the approved mockups turned into modules that read the shared data.
Writes cockpit_v2.json = {ov: {css, html, js}, kr: {css, html, js}}, mounted in shadow roots by build.py."""
import json, pathlib, re
HERE = pathlib.Path(__file__).resolve().parent
PROP = HERE.parent / 'proposal'
COMMON = (HERE / 'cv2_common.js').read_text(encoding='utf-8')

DROP = [r'\.grp\+\.grp,\.it\+\.grp\{[^}]*\}', r'\.it\+\.grp\{[^}]*\}', r'\*\{box-sizing:border-box\}', r'html,body\{[^}]*\}', r'#stage\{[^}]*\}',
        r'(?<![\w.#-])nav\{[^}]*\}', r'\.logo\{[^}]*\}', r'\.logo span\{[^}]*\}', r'\.sys\{[^}]*\}', r'\.sys span\{[^}]*\}', r'\.sys \.on\{[^}]*\}',
        r'\.grp\{[^}]*\}', r'\.it\{[^}]*\}', r'\.it\.on\{[^}]*\}', r'\.it b\{[^}]*\}', r'#tip\{[^}]*\}', r'#toast\{[^}]*\}', r'\.note\{[^}]*\}',
        r'(?<![\w.#-])main\{[^}]*\}', r'(?<![\w-])\.top\{[^}]*\}', r'(?<![\w-])\.seg\{[^}]*\}', r'(?<![\w-])\.seg button\{[^}]*\}', r'(?<![\w-])\.seg button\.on\{[^}]*\}', r'(?<![\w-])\.sp\{[^}]*\}']

def css_of(src, rows):
    css = re.search(r'<style>(.*?)</style>', src, re.S).group(1).replace(':root{', ':host{')
    for d in DROP:
        css = re.sub(d, '', css)
    # the frame fills the window, and grows (the page scrolls) when a row needs more room than its share:
    # rows never shrink below their content, so nothing spills out of a card on a short window
    rows = rows.replace('minmax(0,', 'minmax(max-content,')
    host = (':host{display:block;position:relative;min-height:max(640px, calc(var(--screen-h, 900px) - 162px));font-family:var(--sans);color:var(--ink)}'
            '*{box-sizing:border-box}'
            '.sv{position:relative;min-height:max(640px, calc(var(--screen-h, 900px) - 162px));display:grid;grid-template-rows:' + rows + ';gap:12px}'
            '.top{position:absolute;right:40px;top:-82px;height:54px;display:flex;align-items:center;gap:12px}'
            '.av{width:26px;height:26px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:#fff;flex-shrink:0}'
            '.empty{padding:18px 4px;font-size:13px;color:var(--mut)}'
            '.smp{font-style:normal;font-size:9.5px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--mut2);border:1px solid var(--line);border-radius:4px;padding:0 4px;margin-left:4px}'
            '.why{white-space:nowrap;font-size:12px}.why.ghost{background:#fff;color:var(--ink);border:1px solid var(--line)}'
            '.open{margin-top:6px;align-self:flex-start;border:1px solid var(--line);background:#fff;color:var(--ink);font:inherit;font-size:12px;font-weight:600;border-radius:8px;padding:6px 10px;cursor:pointer}'
            'button:disabled{opacity:.45;cursor:not-allowed}')
    return host + css

def body_of(src):
    return re.search(r'<main>(.*?)</main>', src, re.S).group(1)

# ---- Overview ----
ov_src = (PROP / 'cockpit-overview-v2.html').read_text(encoding='utf-8')
ov_body = body_of(ov_src)
ov_body = re.sub(r'\s*<header class="top">.*?</header>', '\n<div class="top"><div class="pill" id="health"></div><div class="pill" id="hyg"></div></div>', ov_body, flags=re.S)
ov_body = ov_body.replace('<span class="q">last review · 9 Oct</span>', '<span class="q" id="feedq"></span>')
ov_body = ov_body.replace('<div id="toast" role="status"></div>', '')
ov_body = ov_body.replace('<aside id="drawer" role="dialog" aria-modal="true" aria-label="Why and what to do"></aside>', '<aside id="drawer" role="dialog" aria-modal="true" aria-label="Why, and what to do" tabindex="-1"></aside>')
ov_body += '\n<div id="veil"></div>\n<aside id="drawer" role="dialog" aria-modal="true" aria-label="Why, and what to do"></aside>'
for must in ['id="brief"', 'id="krprev"', 'id="chips"', 'id="kri"', 'id="krchart"', 'id="krx"', 'id="pulse"', 'id="decs"', 'id="decq"', 'id="acts"', 'id="actseg"', 'id="feed"', 'id="feedq"', 'id="veil"', 'id="drawer"', 'id="health"']:
    assert must in ov_body, must
ov_css = css_of(ov_src, 'auto minmax(0,1.2fr) minmax(0,1fr)')
# long objective and KR names (Q4 2026) must not push the card content out: objective on 1 line, name on 2
ov_css += '#kri .o{display:-webkit-box;-webkit-box-orient:vertical;overflow:hidden;-webkit-line-clamp:1}#kri h3{display:-webkit-box;-webkit-box-orient:vertical;overflow:hidden;-webkit-line-clamp:2}'
ov_css += '#drawer{top:-82px}#drawer:not(.open){visibility:hidden}#veil{top:-82px}.lead{background:var(--bg)}.nextm{background:var(--goldsoft);border:1px solid #E6D3A8;border-radius:8px;padding:6px 10px}'
ov_html = '<div class="sv">' + ov_body + '</div>'
ov_js = '(function(ROOT,TIP,TOAST){\n' + COMMON + '\n' + (HERE / 'cv2_overview.js').read_text(encoding='utf-8') + '\n})'

# ---- Key result room ----
kr_src = (PROP / 'kr-room.html').read_text(encoding='utf-8')
kr_body = body_of(kr_src)
kr_body = re.sub(r'\s*<header class="top">.*?</header>', '', kr_body, flags=re.S)
KRNAV = '<div class="krnav"><button class="arrow" id="prev" aria-label="Previous key result">←</button><div class="chips" id="chips"></div><button class="arrow" id="next" aria-label="Next key result">→</button></div>'
TRAJ_OLD = '<div class="ch"><h2>Trajectory</h2><span class="q">plan · actual · projection · confidence at each check-in</span></div>'
assert TRAJ_OLD in kr_body
kr_body = kr_body.replace(TRAJ_OLD, '<div class="ch"><h2 data-tip="Plan, actual, projection and confidence at each check-in">Trajectory</h2>' + KRNAV + '</div>')
kr_body = kr_body.replace('<div id="toast" role="status"></div>', '')
ADD_I = '<div class="ch"><h2>Initiatives</h2><span class="q">contribution · tasks</span></div>'
ADD_W = '<div class="ch"><h2>What stands in the way</h2><span class="q" id="wq"></span></div>'
assert ADD_I in kr_body and ADD_W in kr_body
kr_body = kr_body.replace(ADD_I, '<div class="ch"><h2>Initiatives</h2><span class="chr"><span class="q">contribution · tasks</span><button class="add" id="addTask" data-tip="Add a task on this key result">+ Task</button></span></div>')
kr_body = kr_body.replace(ADD_W, '<div class="ch"><h2>What stands in the way</h2><span class="chr"><span class="q" id="wq"></span><button class="add" id="addDec" data-tip="Add a decision on this key result">+ Decision</button></span></div>')
# every week's result of the key result on screen (Romain 2026-10-31): a button on the Check-ins card opens its history
CI_OLD = '<div class="card"><div class="ch"><h2>Check-ins</h2><span class="q">confidence /10</span></div>'
assert CI_OLD in kr_body
kr_body = kr_body.replace(CI_OLD, '<div class="card"><div class="ch"><h2>Check-ins</h2><span class="chr"><span class="q">confidence /10</span><button class="add" id="weeks" data-tip="The result of every week: type it, or change it (asked first)">Weekly results</button></span></div>')
kr_body += '<div class="wkv" id="wkv" hidden><div class="wkp" role="dialog" aria-modal="true" aria-labelledby="wkT"><div class="wkh"><div><div class="o" id="wkO"></div><h3 id="wkT">Weekly results</h3></div><button class="wkx" id="wkX" aria-label="Close">×</button></div><div id="wkB"></div></div></div>'
for must in ['id="weeks"', 'id="wkv"', 'id="id"', 'id="chart"', 'id="gauges"', 'id="inits"', 'id="way"', 'id="wq"', 'id="ci"', 'id="prev"', 'id="chips"']:
    assert must in kr_body, must
kr_css = css_of(kr_src, 'minmax(0,1fr) minmax(0,1.25fr)')
kr_css += '#id .o{display:-webkit-box;-webkit-box-orient:vertical;overflow:hidden;-webkit-line-clamp:2}#id h1{display:-webkit-box;-webkit-box-orient:vertical;overflow:hidden;-webkit-line-clamp:3}'
kr_css += '.krnav{gap:6px}.krnav .arrow{width:28px;height:28px;font-size:14px}.krnav .chip{width:24px;height:24px;font-size:11px}.id{flex:1;min-height:0}.id .open{margin-top:auto;align-self:stretch;width:100%;padding:10px 12px;font-size:13px;border-radius:10px;background:var(--ink);color:#fff;border-color:var(--ink);text-align:center}.id .open:hover{background:#34322C}'
kr_css += '.ch h2{flex-shrink:0}.chr{display:flex;align-items:center;justify-content:flex-end;gap:10px;min-width:0;flex:1}.chr .q{overflow:hidden;text-overflow:ellipsis;min-width:0}.add{flex-shrink:0}.add{border:1px solid var(--ink);background:var(--ink);color:#fff;font:inherit;font-size:12px;font-weight:600;border-radius:999px;padding:4px 11px;cursor:pointer;white-space:nowrap}.add:hover{background:#34322C}.addv{position:absolute;inset:-82px 0 0 0;background:rgba(27,27,24,.32);display:flex;align-items:center;justify-content:center;z-index:30}.addv[hidden]{display:none}.addf{width:440px;max-width:calc(100% - 32px);background:var(--card);border-radius:14px;padding:18px 20px;display:flex;flex-direction:column;gap:12px;box-shadow:0 18px 48px rgba(0,0,0,.22)}.ah{display:flex;flex-direction:column;gap:2px}.ah b{font-family:var(--serif);font-weight:500;font-size:20px}.ah span{font-size:12px;color:var(--mut)}#aF{display:flex;flex-direction:column;gap:10px}.f{display:flex;flex-direction:column;gap:4px;font-size:11px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:var(--mut);min-width:0}.f input,.f select{font:inherit;font-size:14px;font-weight:400;letter-spacing:0;text-transform:none;color:var(--ink);border:1px solid var(--line);border-radius:8px;padding:8px 10px;background:#fff;min-width:0;width:100%}.f input:focus,.f select:focus{outline:2px solid var(--gold);border-color:var(--gold)}.f2{display:grid;grid-template-columns:1fr 1fr;gap:10px}.ck{display:flex;align-items:center;gap:8px;font-size:13px;color:var(--ink2)}.ab{display:flex;justify-content:flex-end;gap:8px;margin-top:4px}.ab button{font:inherit;font-size:13px;font-weight:600;border-radius:8px;padding:8px 14px;cursor:pointer}.ab .ghost{border:1px solid var(--line);background:#fff;color:var(--ink)}.ab .prim{border:1px solid var(--ink);background:var(--ink);color:#fff}'
kr_css += ('.wkv{position:absolute;inset:-82px -8px auto -8px;min-height:calc(100% + 82px);background:rgba(27,27,24,.45);display:flex;justify-content:center;align-items:flex-start;padding:24px;z-index:30}'
           '.wkv[hidden]{display:none}.wkp{width:min(760px,100%);background:#fff;border:1px solid var(--line);border-radius:16px;padding:22px 24px;display:flex;flex-direction:column;gap:14px;box-shadow:0 24px 64px rgba(0,0,0,.2)}'
           '.wkh{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}.wkh h3{margin:0;font-family:var(--serif);font-weight:500;font-size:22px}.wkh .o{font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--mut)}'
           '.wkx{width:36px;height:36px;border-radius:50%;border:1px solid var(--line);background:#fff;font-size:18px;cursor:pointer}'
           '.wks{width:100%;height:90px;background:var(--bg);border-radius:10px}'
           '.wkt{width:100%;border-collapse:collapse;font-size:13px}.wkt th{font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--mut);text-align:left;padding:6px 8px;border-bottom:1px solid var(--line)}'
           '.wkt td{padding:6px 8px;border-bottom:1px solid #EFECE4}.wkt tr.now td{background:#FBF6EC}.wkt td.w{font-weight:600;white-space:nowrap}.wkt .src{color:var(--mut);font-size:12px}'
           '.wkt input{width:110px;font:600 13px var(--mono);padding:6px 8px;border:1px solid var(--line);border-radius:8px}.wkt input:disabled{background:transparent;border-style:dashed}'
           '.wkn{font-size:12px;color:var(--mut)}')
kr_html = '<div class="sv">' + kr_body + '</div>'
kr_js = '(function(ROOT,TIP,TOAST){\n' + COMMON + '\n' + (HERE / 'cv2_krroom.js').read_text(encoding='utf-8') + '\n})'

(HERE / 'cockpit_v2.json').write_text(json.dumps({'ov': {'css': ov_css, 'html': ov_html, 'js': ov_js}, 'kr': {'css': kr_css, 'html': kr_html, 'js': kr_js}}), encoding='utf-8')
for c in (ov_css, kr_css):
    assert re.search(r'(^|[}\s])\.it\+', c) is None and '.kr\n' not in c
print('cockpit v2', len(ov_css), len(ov_html), len(ov_js), '|', len(kr_css), len(kr_html), len(kr_js))
