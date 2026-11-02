"""Knowledge System › SKL Map: the SKL map (online map, model v5) ported as a shadow-DOM module.
Data, rules, layout, interactions and wording are the source's, unchanged. Only the design is re-skinned to SKL OS:
light bone canvas, Fraunces / IBM Plex, OS segmented controls, chips, buttons and panels, no page title.
Writes carto.json (module) and the five screens CartoMap / CartoEvents / CartoWorks / CartoSim / CartoModel."""
import json, pathlib, re

HERE = pathlib.Path(__file__).resolve().parent
P = HERE.parent / 'skl-en' / 'project'
src = (HERE / 'carto' / 'cartographie-skl.en.html').read_text(encoding='utf-8')

css = src.split('<style>', 1)[1].split('</style>', 1)[0]
html = src.split('</style>', 1)[1].split('<script>', 1)[0].strip()
js = src.split('<script>', 1)[1].rsplit('</script>', 1)[0]

# ---------- CSS: OS tokens, scoped to the module root ----------
TOKENS = """
:host{display:block;position:relative;height:100%;min-height:0}
[hidden]{display:none!important}
img{max-width:100%}
.cx{
  --bg:#F6F4EF; --surface:#FFFFFF; --surface-2:#FBFAF7; --line:#E4DFD4; --line-strong:#D8D3C7;
  --fg:#1B1B18; --muted:#5E5B53; --gold:#94681A; --gold-dim:#F4ECDD;
  --ok:#2F7A3E; --wip:#2D5C9C; --missing:#B42318; --loop:#1F6A66; --esc:#6B4FA0;
  --es-ev:#C2601A; --es-pol:#7A55B0; --es-cmd:#2F68AE; --es-act:#9A7A10; --es-read:#2E7F50;
  --dot:rgba(27,27,24,.075); --shadow:0 12px 32px rgba(27,27,24,.10); --scrim:rgba(246,244,239,.96);
  --f-display:'Fraunces', Georgia, serif;
  --f-body:'IBM Plex Sans', system-ui, -apple-system, 'Segoe UI', sans-serif;
  --f-mono:'IBM Plex Mono', ui-monospace, Menlo, Consolas, monospace;
  color-scheme:light;
}
"""
i = css.index(':root{'); j = css.index('html,body{height:100%}')
css = css[:i] + TOKENS + css[j:]
css = css.replace('html,body{height:100%}\n', '')
css = css.replace('body{background:var(--bg);color:var(--fg);font-family:var(--f-body);overflow:hidden}',
                  '.cx{position:absolute;inset:0;background:var(--bg);color:var(--fg);font-family:var(--f-body);font-size:14px;line-height:normal;overflow:hidden}')
css = re.sub(r'\bbody\.', '.cx.', css)
css = css.replace('#app{position:fixed;inset:0}', '#app{position:absolute;inset:0}')
css = css.replace('#confirm{position:fixed;', '#confirm{position:absolute;')
assert not re.search(r'(^|[\s,}])body[\s{.,:]', css), 'unscoped body rule'
assert ':root' not in css

# SKL OS components, written after the source rules so they win at equal specificity
OS = """
/* ---- SKL OS frame ---- */
.topbar{padding:17px 96px 14px 24px;gap:14px;background:linear-gradient(var(--scrim),var(--scrim) 78%,transparent)}
.cx.model-open .topbar,.cx.model-open .fbar{display:none}
.seg2{display:inline-flex;gap:6px;padding:5px;background:#ECE8DF;border:0;border-radius:12px;flex-wrap:nowrap;flex-shrink:0}
.seg2 button{min-height:44px;padding:0 20px;border-radius:9px;font-size:15px;font-weight:500;color:#3D3A33;background:transparent}
.seg2 button[aria-pressed="true"]{background:#1B1B18;color:#FFFFFF;font-weight:600}
.chip{padding:7px 12px;border-color:var(--line);font-size:13px;color:var(--fg)}
.chip[aria-pressed="true"]{border-color:#1B1B18;background:var(--gold-dim)}
.search input{min-height:44px;box-sizing:border-box;width:220px;padding:0 14px;border:1px solid var(--line-strong);border-radius:10px;background:#FFFFFF;font-size:14px}
.tb-btn{min-height:40px;padding:0 16px;border:1px solid var(--line-strong);border-radius:10px;background:#FFFFFF;font-size:14px;font-weight:600}
.fbtn{min-height:44px;padding:0 18px;border:1px solid var(--line-strong);border-radius:10px;background:#FFFFFF;color:#1B1B18;font-size:14px;font-weight:600;box-shadow:0 2px 10px rgba(27,27,24,.08)}
.fbtn[aria-pressed="true"]{background:#1B1B18;color:#FFFFFF;border-color:#1B1B18}
.fbtn[aria-pressed="true"]::before{background:linear-gradient(#D9B46A,#D9B46A) 0 0/100% 2px no-repeat,linear-gradient(#D9B46A,#D9B46A) 2px 4px/10px 2px no-repeat,linear-gradient(#D9B46A,#D9B46A) 4px 8px/6px 2px no-repeat}
.fbtn[aria-pressed="true"] .cnt{color:#D9B46A}
.btn{border-color:var(--line-strong);background:#FFFFFF;border-radius:8px;font-weight:500}
.btn:hover{border-color:#1B1B18}
.btn.add{border-color:var(--gold);color:var(--gold)}
.close{background:#FFFFFF;border-color:var(--line-strong)}
.cf-box{border-color:var(--line);border-radius:16px;box-shadow:0 24px 64px rgba(0,0,0,.22)}
.cf-box h2{font:500 28px/1.15 var(--f-display)}
.cf-a .btn{min-height:44px;padding:0 18px;font-size:14px;font-weight:600}
.cf-a .cf-danger{background:#B42318;color:#FFFFFF;border-color:#B42318}
#confirm{background:rgba(27,27,24,.45)}
.toast{background:#1B1B18;color:#F6F4EF;border-color:#1B1B18}
.toast button{border-color:#D9B46A;color:#D9B46A}
#layers,#panel{border-color:var(--line);border-radius:14px}
#layers h3{letter-spacing:.1em}
.zoombar,#minimap{border-color:var(--line);box-shadow:0 2px 10px rgba(27,27,24,.08)}
.lane-label b,.chain-label b,.act b,.zone h2,.world-title h1{font-weight:500}
.world-title .k,.act .k,.chain-label .k,.asset .k,.head .tag,.mblock .mh span,.lev .rk,.wv-h .k,.es-gl{color:#7A4B00}
.state{border-color:#C9A35A;border-width:1.5px}
.state.pole-end{background:var(--gold-dim);border-color:#1B1B18}
.card.sel,.strip.sel{border-color:#1B1B18;box-shadow:0 0 0 3px var(--gold-dim),var(--shadow)}
.card.match{box-shadow:0 0 0 3px #D9B46A}
.e-spine{stroke:#C9A35A}
/* ---- other views: OS page frame, no page title (the sidebar says where you are) ---- */
.page{padding:40px 48px 48px}
.page .wrap{max-width:none;margin:0;gap:32px}
.page .wrap>div:first-child>h2:first-child{display:none}
.page .lead{max-width:80ch;font-size:15px;color:#3D3A33}
.page h3.es-h{font:500 24px/1.15 var(--f-display)}
.tbl{border-color:var(--line);border-radius:14px}
.tbl th{background:#F6F4EF;letter-spacing:.08em}
.kpi,.lev,.wk,.principles div{border-radius:14px}
.kpi.hero{border-color:#1B1B18}
.prog i,.flow .bar i{background:#D9B46A}
.kr{border-color:var(--gold);color:var(--gold)}
"""
css = css + OS

# ---------- HTML: one root, no brand, no view switch (the sidebar is the view switch) ----------
html = re.sub(r'\s*<div class="brand">.*?</div>', '', html, count=1, flags=re.S)
html, n = re.subn(r'\s*<div class="seg2" role="group" aria-label="View">.*?</div>', '', html, count=1, flags=re.S)
assert n == 1
html = html.replace('<div id="app">', '<div id="cxroot" class="cx"><div id="app">', 1) + '</div>'

# ---------- JS: same code, run against the shadow root ----------
js = js.replace('db.collection("needs")', 'db.collection("carto")').replace('DB.doc("needs/"+id)', 'DB.doc("carto/"+id)')
assert js.count('"carto') == 3
old_esc = 'else if(e.key==="Escape"){if(V.model)setView("map");else if(V.sel)closePanel()}'
assert old_esc in js
js = js.replace(old_esc, 'else if(e.key==="Escape"){if(V.sel)closePanel()}')
# the first frame is fitted when the module is first shown, not at load
old_fit = '(function(){const W=vp.clientWidth,H=vp.clientHeight-90;'
assert old_fit in js
js = js.replace(old_fit, 'function __cxFit(){const W=vp.clientWidth,H=vp.clientHeight-90;if(!W||!H)return false;').replace(
    'ty=90+(H-bounds.h*s)/2-bounds.y*s;apply()})();', 'ty=90+(H-bounds.h*s)/2-bounds.y*s;apply();return true}')

PRE = r"""function (__cxRoot, TIP, TOAST) {
  const __cxEl = __cxRoot.getElementById("cxroot"), __cxHost = __cxRoot.host;
  const __cxOn = () => __cxHost.isConnected && __cxHost.offsetParent !== null;
  // keyboard events reach the page with the shadow host as target: hand the handlers the real target, and only while the map is on screen
  const __cxWrapped = new Map();
  const __cxGate = (t, f) => {
    if (t !== "keydown") return f;
    let g = __cxWrapped.get(f);
    if (!g) {
      g = e => {
        if (!__cxOn()) return;
        const real = (e.composedPath && e.composedPath()[0]) || e.target;
        f(new Proxy(e, { get: (o, k) => k === "target" ? real : (typeof o[k] === "function" ? o[k].bind(o) : o[k]) }));
      };
      __cxWrapped.set(f, g);
    }
    return g;
  };
  const document = {
    getElementById: id => __cxRoot.getElementById(id),
    querySelector: s => __cxRoot.querySelector(s),
    querySelectorAll: s => __cxRoot.querySelectorAll(s),
    get body() { return __cxEl; },
    get documentElement() { return __cxEl; },
    get activeElement() { return __cxRoot.activeElement; },
    addEventListener: (t, f, o) => window.document.addEventListener(t, __cxGate(t, f), o),
    removeEventListener: (t, f, o) => window.document.removeEventListener(t, __cxWrapped.get(f) || f, o)
  };
  const addEventListener = (t, f, o) => window.addEventListener(t, __cxGate(t, f), o);
"""
POST = r"""
  let __cxFitted = false;
  const __cxView = () => { const p = __cxHost.parentNode; return (p && p.getAttribute && p.getAttribute("data-carto")) || "map"; };
  const __cxShow = () => {
    const v = __cxView();
    if (v !== V.view) setView(v);
    if (!__cxFitted) __cxFitted = __cxFit();
    syncTop(); drawMini();
  };
  requestAnimationFrame(__cxShow);
  return { render: __cxShow };
}
"""
js = PRE + js + POST

(HERE / 'carto.json').write_text(json.dumps({'css': css, 'html': html, 'js': js}, ensure_ascii=False), encoding='utf-8')
print('carto.json', len(css), len(html), len(js))

# ---------- the five screens, hosted like the mechanism pages ----------
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

WHY = ul([("One model, several views.", "Journey, Events, Build order, Simulator and Model read the same data. Nothing is entered twice."),
          ("The need comes first.", "Every card is a need. AI agents, humans and systems are means attached to the need."),
          ("Gaps are computed.", "Coverage, complete cells, contracts and agent sheets are computed by rules, never entered by hand."),
          ("Base model plus overlay.", "Model v5 is fixed; every change the team makes is stored on top of it and can be undone or restored.")])
SCREENS_C = [
    ('CartoMap', 'map', 'Journey',
     "The map of all of SKL: the individual's journey from Point A (E0) to Ambassador (E13), the transition cells between states, and every need that moves the individual forward, in production, conversion, support and at the meta level, with their means, memories and tools.",
     ["Pick the reading at the top left: Needs, Means or Fully AI target.",
      "Drag to move; Ctrl or ⌘ + wheel to zoom; 0 to fit all. The minimap at the bottom right is a shortcut.",
      "Click a card: everything not linked to it fades and its detail opens on the right, where everything can be edited.",
      "Filters (F key): lanes, links, coverage, add a need or a tool, jump straight to an act or a lane.",
      "Search (/ key); Undo at the bottom left or Ctrl/⌘ + Z."]),
    ('CartoEvents', 'events', 'Events',
     "Every handoff read as an event, Event Storming style: sending need, event, data, receiving need and its means, with the hot spots that still block.",
     ["Read the groups by act, chain, meta or support.", "Start with the red labels: they are the hot spots of the receiving need.",
      "Click a label to open it on the Journey."]),
    ('CartoWorks', 'works', 'Build order',
     "The build order computed from the model's dependencies: every tool, memory, orchestrator or need that is not finished becomes a build item, sorted into waves.",
     ["Start with “What unblocks the most”.", "A wave starts only once its prerequisites exist.",
      "In each wave, items tied to objectives come first, then those that unlock the most.", "Click an item to open it on the Journey."]),
    ('CartoSim', 'sim', 'Simulator',
     "The journey as stocks and flows: exposed people per week, the rate of each cell, recovery of no-shows and undecided prospects, the referral loop. It computes clients per month and net revenue.",
     ["Each value is marked Measured, Scenario or Assumption.", "Change a rate to build a scenario; it stays in this browser and does not touch the measures.",
      "The levers show the revenue gain if a cell's rate rises by 5 points."]),
    ('CartoModel', 'model', 'Model',
     "All the map's data in tables: states, cells, needs, means, agent sheets, handoffs, memories, tools and deleted items.",
     ["Click a row to open the item on the Journey.", "“Reset the whole map” clears every change the team made and returns to model v5."]),
]
for fname, view, label, what, how in SCREENS_C:
    s = tpl.replace('<title>SKL KS — Operating System</title>', f'<title>SKL KS — SKL Map · {label}</title>')
    s = s.replace('<div data-mech="s-os-exec|s-os-res" style="flex-grow: 1; min-width: 0"></div>',
                  f'<div data-carto="{view}" style="flex-grow: 1; min-width: 0; height: var(--screen-h, 100vh); position: relative"></div>')
    s = s.replace('>Operating System mechanism</h2>', f'>SKL Map · {label}</h2>')
    a = s.index('<section>'); b = s.rindex('</section>') + len('</section>')
    s = s[:a] + sec(1, 'What this page is for', para(what)) + '\n' + sec(2, 'The principles of the map', WHY) + '\n' + sec(3, "How to use it", ol(how)) + s[b:]
    s = re.sub(r'(<button[^>]*onClick="\{\{closeInfo\}\}"[^>]*>)(?!×)[^<]*(</button>)', r'\1×\2', s)
    assert f'data-carto="{view}"' in s
    (P / f'{fname}.dc.html').write_text(s, encoding='utf-8')
print('Carto screens ok')
