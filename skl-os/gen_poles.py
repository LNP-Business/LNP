"""Cockpit › Marketing and Cockpit › Finance: one screen each, health of the engine, linked to the key results it feeds.
Adds 'mkt' and 'fin' modules to cockpit_v2.json (run after gen_cockpit_v2.py)."""
import json, pathlib
HERE = pathlib.Path(__file__).resolve().parent
COMMON = (HERE / 'cv2_common.js').read_text(encoding='utf-8')
BASE = """:host{--bg:#F6F4EF;--card:#FFFFFF;--ink:#1B1B18;--ink2:#3D3A33;--mut:#5E5B53;--mut2:#8E8A80;--line:#E3DFD5;--line2:#EFEBE3;--soft:#ECE8DF;
--gold:#D9B46A;--gold2:#9A6614;--goldsoft:#FBF6EC;--green:#2E7D4F;--greent:#1E5E38;--greens:#E6F2EA;--amber:#B45309;--ambert:#8A3F06;--ambers:#FDF1E3;--red:#B42318;--redt:#9B1C12;--reds:#FDECEA;
--sans:'IBM Plex Sans',system-ui,sans-serif;--mono:'IBM Plex Mono',ui-monospace,Menlo,monospace;--serif:Fraunces,Georgia,serif;
display:block;position:relative;height:calc(var(--screen-h, 900px) - 162px);min-height:640px;font-family:var(--sans);color:var(--ink)}
*{box-sizing:border-box}
.sv{position:relative;height:100%;display:grid;grid-template-rows:minmax(0,1.1fr) minmax(0,1fr);gap:12px}
.top{position:absolute;right:40px;top:-82px;height:54px;display:flex;align-items:center;gap:12px}
.row{display:grid;gap:12px;min-height:0}
.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px 18px;display:flex;flex-direction:column;min-height:0;min-width:0;position:relative}
.ch{display:flex;justify-content:space-between;align-items:baseline;gap:10px;margin-bottom:8px}
.ch h2{margin:0;font-family:var(--serif);font-weight:500;font-size:19px;white-space:nowrap}
.q{font-size:12px;color:var(--mut);white-space:nowrap}
.num{font-family:var(--mono)}
svg{display:block;overflow:visible}
.verdict{display:flex;align-items:center;gap:10px;padding:6px 12px 6px 6px;border-radius:12px;background:var(--card);border:1px solid var(--line)}
.vb{font-family:var(--mono);font-weight:600;font-size:13px;padding:6px 10px;border-radius:8px}
.vb.fail{background:var(--ambers);color:var(--ambert)}.vb.pass{background:var(--greens);color:var(--greent)}
.vt{font-size:12px;line-height:1.35;color:var(--ink2)}.vt b{color:var(--ink)}
.smp{font-size:9.5px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--mut2);border:1px solid var(--line);border-radius:4px;padding:1px 5px}
.krc{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--line);background:#fff;border-radius:999px;padding:3px 10px;font:inherit;font-size:11.5px;font-weight:600;color:var(--ink);cursor:pointer;white-space:nowrap}
.krc i{width:8px;height:8px;border-radius:50%;background:var(--c)}
.krc:hover{border-color:var(--gold)}
.st{display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:600;padding:2px 8px;border-radius:999px;white-space:nowrap}
.st i{width:7px;height:7px;border-radius:50%}
.s-green{background:var(--greens);color:var(--greent)}.s-green i{background:var(--green)}
.s-amber{background:var(--ambers);color:var(--ambert)}.s-amber i{background:var(--amber)}
.s-red{background:var(--reds);color:var(--redt)}.s-red i{background:var(--red)}
.s-stale{background:var(--soft);color:var(--ink2)}.s-stale i{border:2px solid var(--mut);background:transparent;width:8px;height:8px}
.empty{padding:14px 2px;font-size:13px;color:var(--mut)}
.dot{width:10px;height:10px;border-radius:50%;flex-shrink:0}
.t{font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.m{font-size:11px;color:var(--mut);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.legend{display:flex;gap:12px;font-size:11px;color:var(--mut);margin-top:auto;padding-top:6px}
.legend span{display:inline-flex;align-items:center;gap:5px}.legend em{width:10px;height:10px;border-radius:3px;display:inline-block}
.bar{position:relative;height:10px;border-radius:5px;background:var(--soft)}.bar i{position:absolute;left:0;top:0;bottom:0;border-radius:5px}.bar u{position:absolute;top:-4px;width:2px;height:18px;background:var(--ink)}
"""
MKT_CSS = BASE + """
.rA{grid-template-columns:minmax(0,7fr) minmax(0,5fr)}.rB{grid-template-columns:minmax(0,4.4fr) minmax(0,4fr) minmax(0,3.6fr)}
#flowwrap{position:relative;flex:1;min-height:0}#flow{position:absolute;inset:0}#flowkr{position:absolute;bottom:4px;width:140px;display:flex;justify-content:center}
.sh{position:relative;display:flex;height:16px;border-radius:5px;overflow:visible;gap:2px}.sh i{display:block;height:100%}.sh i:first-child{border-radius:5px 0 0 5px}.sh i:last-child{border-radius:0 5px 5px 0}.sh u{position:absolute;top:-4px;width:2px;height:24px;background:var(--red)}
.shl{font-size:11px;margin:4px 0 6px}
.chr{display:grid;grid-template-columns:12px 100px 34px minmax(0,1fr) 54px;gap:10px;align-items:center;padding:6px 0;border-top:1px solid var(--line2);font-size:13px}
.chr .sw{width:10px;height:10px;border-radius:3px}.chr .n{font-weight:600}
.cb{position:relative;height:10px;border-radius:4px;background:var(--soft)}.cb i{position:absolute;left:0;top:0;bottom:0;border-radius:4px}.cb u{position:absolute;top:-3px;width:2px;height:16px;background:var(--ink)}
.blend{display:flex;align-items:center;gap:10px;margin-top:auto;padding:8px 10px;border-radius:10px;background:var(--bg);font-size:12px;color:var(--mut)}.blend b{font-size:16px;margin-right:auto}
#wk{flex:1;min-height:0}
.kr2{display:grid;grid-template-columns:42px minmax(0,1fr) auto;gap:10px;align-items:center;padding:10px 0;border-top:1px solid var(--line2);cursor:pointer}.kr2:first-child{border-top:0}.kr2:hover{background:var(--goldsoft)}
.kn{font-family:var(--mono);font-size:12px;font-weight:600;color:var(--gold2)}
.br2{display:grid;grid-template-columns:12px minmax(0,1fr);gap:10px;align-items:center;padding:8px 0;border-top:1px solid var(--line2);cursor:pointer}.br2:first-child{border-top:0}.br2:hover{background:var(--goldsoft)}
"""
MKT_HTML = """<div class="sv">
<div class="top"><div class="verdict" id="verdict"></div></div>
<section class="row rA">
 <div class="card"><div class="ch"><h2>From audience to qualified lead</h2><span class="q">this week · the page conversion is the leading indicator</span></div><div id="flowwrap"><div id="flow"></div><div id="flowkr"></div></div></div>
 <div class="card"><div class="ch"><h2>Channels</h2><span class="q">share of leads · cost per lead vs €4</span></div><div id="chan" style="display:flex;flex-direction:column;flex:1;min-height:0"></div></div>
</section>
<section class="row rB">
 <div class="card"><div class="ch"><h2>Qualified leads per week</h2><span class="q">target 180</span></div><div id="wk"></div></div>
 <div class="card"><div class="ch"><h2>Key results Marketing drives</h2><span class="q">click to open</span></div><div id="krs"></div></div>
 <div class="card"><div class="ch"><h2>Blocking Marketing</h2><span class="q">decisions · tasks</span></div><div id="blk"></div></div>
</section></div>"""
FIN_CSS = BASE + """
.rA{grid-template-columns:minmax(0,7fr) minmax(0,5fr)}.rB{grid-template-columns:minmax(0,4.2fr) minmax(0,3.6fr) minmax(0,4.2fr)}
#cash{flex:1;min-height:0}
.bur{display:grid;grid-template-columns:96px minmax(0,1fr) 54px;gap:10px;align-items:center;padding:9px 0;border-top:1px solid var(--line2);font-size:13px}.bur:first-child{border-top:0}
.bur .n{font-weight:600}.bur .num{text-align:right;font-weight:600}
.bb{position:relative;height:14px;border-radius:4px;background:var(--soft)}.bb i{position:absolute;left:0;top:0;bottom:0;border-radius:4px}.bb u{position:absolute;top:-4px;width:2px;height:22px;background:var(--ink)}
#bud,#rec,#unit,#act{display:flex;flex-direction:column;flex:1;min-height:0}
.ue3{display:grid;grid-template-columns:1fr 1fr;gap:10px}.ue3 div{background:var(--bg);border-radius:10px;padding:8px 10px}.ue3 span,.rev span,.g2 .k span{display:block;font-size:11px;color:var(--mut)}.ue3 b{font-size:18px}
.g2{margin-top:12px;display:flex;flex-direction:column;gap:6px}.g2 .k{display:flex;justify-content:space-between;align-items:baseline}.g2 .k b{font-size:18px}
.rev{margin-top:auto;display:flex;justify-content:space-between;align-items:center;gap:10px;padding:8px 10px;border-radius:10px;background:var(--goldsoft);border:1px solid #E6D3A8;cursor:pointer}.rev b{font-size:16px}.rev small{font-size:11px;color:var(--mut);font-weight:500}
.ar2{display:grid;grid-template-columns:52px minmax(0,1fr);gap:10px;align-items:center;padding:8px 0;border-top:1px solid var(--line2)}.ar2:first-child{border-top:0}.ar2:hover{background:var(--goldsoft)}
.dd{font-family:var(--mono);font-size:12px;font-weight:600;color:var(--gold2)}.dd.late{color:var(--redt)}
"""
FIN_HTML = """<div class="sv">
<div class="top"><div class="verdict" id="verdict"></div></div>
<section class="row rA">
 <div class="card"><div class="ch"><h2>Cash and runway</h2><span class="q" id="cashq"></span></div><div id="cash"></div></div>
 <div class="card"><div class="ch"><h2>Budget vs actual · October</h2><span class="q" id="budq"></span></div><div id="bud"></div></div>
</section>
<section class="row rB">
 <div class="card"><div class="ch"><h2>Unit economics</h2><span class="q">does each sale pay for itself?</span></div><div id="unit"></div></div>
 <div class="card"><div class="ch"><h2>Overdue receivables</h2><span class="q" id="recq"></span></div><div id="rec"></div></div>
 <div class="card"><div class="ch"><h2>Next deadlines and actions</h2><span class="q">Finance · Legal</span></div><div id="act"></div></div>
</section></div>"""
p = HERE / 'cockpit_v2.json'
cv = json.loads(p.read_text(encoding='utf-8'))
wrap = lambda f: '(function(ROOT,TIP,TOAST){\n' + COMMON + '\n' + (HERE / f).read_text(encoding='utf-8') + '\n})'
cv['mkt'] = {'css': MKT_CSS, 'html': MKT_HTML, 'js': wrap('cv2_mkt.js')}
cv['fin'] = {'css': FIN_CSS, 'html': FIN_HTML, 'js': wrap('cv2_fin.js')}
p.write_text(json.dumps(cv), encoding='utf-8')
print('poles ok')
