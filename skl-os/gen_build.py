"""Build (Operating System): build the roadmap of a key result in six steps, with the Claude planner. Replaces the Roadmap.
Build and Execute share one core (window.SKL_OS2: os2_common.js, build_module.js, execute_module.js and the planner prompt
pack proposal/os-v2/prompts.js), mounted in two screens; the styles are os2.css, from proposal/os-v2/roadmap-studio.html.
Writes build.json ({css, html, js, core}) and the Build.dc.html page that hosts it."""
import json, pathlib
from shell import write_screen

HERE = pathlib.Path(__file__).resolve().parent
PROMPTS = (HERE.parent / 'proposal' / 'os-v2' / 'prompts.js').read_text(encoding='utf-8')
CSS = (HERE / 'os2.css').read_text(encoding='utf-8')
CORE = ('window.SKL_OS2 = (function(){\n'
        + (HERE / 'os2_common.js').read_text(encoding='utf-8').replace('/*@PROMPTS@*/', PROMPTS) + '\n'
        + (HERE / 'build_module.js').read_text(encoding='utf-8') + '\n'
        + (HERE / 'execute_module.js').read_text(encoding='utf-8')
        + '\nload();\nreturn {attach};\n})();')
BAR = ('<div class="os2bar"><div class="os2seg" role="group" aria-label="Build and Execute"><button data-view="build" aria-pressed="{b}">Build</button>'
       '<button data-view="exec" aria-pressed="{e}">Execute</button></div><span class="ctx" id="os2ctx"></span>'
       '<button class="os2i" data-method="1" aria-label="How this page works" title="How this page works">i</button></div>')
TAIL = '<div id="pop"></div><div id="toast" class="toast" role="status" hidden></div>'
# Build: its two views (the plan, the key results board); Execute has its own screen in the sidebar
BUILD_BAR = BAR.replace('<button data-view="build" aria-pressed="{b}">Build</button><button data-view="exec" aria-pressed="{e}">Execute</button>',
                        '<button data-sub="plan" aria-pressed="true">Build</button><button data-sub="krs" aria-pressed="false">Key Results</button>')
HTML = ('<div class="os2">' + BUILD_BAR + '''
<section id="v-build" class="build">
  <aside class="rail">
    <div class="card score" id="score"></div>
    <nav class="card steps" id="steps" aria-label="Build steps"></nav>
    <section class="card carry" id="carry" aria-label="Carried over from last week"></section>
  </aside>
  <main class="ws" id="ws"></main>
  <div class="col3"><aside class="card guide" aria-label="Claude guide">
    <div class="gh"><span class="mk">C</span><div><b>Claude</b><span id="gmode"></span></div></div>
    <div class="feed" id="feed" aria-live="polite"></div>
    <div class="status" id="gstatus"></div>
    <div class="gq" id="gq"></div>
    <form class="gin" id="gform"><textarea id="gtext" rows="1" placeholder="Ask Claude about this plan…" aria-label="Message to Claude"></textarea><button class="btn p" id="gsend" type="submit">Send</button></form>
  </aside></div>
</section></div>''' + TAIL)
if __name__ == '__main__':
    JS = '(function(ROOT){return window.SKL_OS2.attach(ROOT,"build")})'
    (HERE / 'build.json').write_text(json.dumps({'css': CSS, 'html': HTML, 'js': JS, 'core': CORE}), encoding='utf-8')
    print('build module', len(CSS), len(HTML), len(CORE))

    MAIN = '''<main style="flex-grow: 1; min-width: 0; box-sizing: border-box; padding: 40px 48px 48px; position: relative">
    <div data-build></div>
    </main>'''
    write_screen('Build.dc.html', 'Build', MAIN, '', 'roadmap2_logic.js', info=False)
