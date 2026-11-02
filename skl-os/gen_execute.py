"""Execute (Operating System): the week gate, the day set-up, one task at a time, requests, end of day and replan.
Replaces My Day. Same core and styles as Build (gen_build.py writes the core into build.json).
Writes execute.json ({css, html, js}) and the Execute.dc.html page that hosts it."""
import json, pathlib
from shell import write_screen
from gen_build import BAR, TAIL, CSS

HERE = pathlib.Path(__file__).resolve().parent
HTML = '<div class="os2">' + BAR.format(b='false', e='true') + '<section id="v-exec"></section></div>' + TAIL
JS = '(function(ROOT){return window.SKL_OS2.attach(ROOT,"exec")})'
(HERE / 'execute.json').write_text(json.dumps({'css': CSS, 'html': HTML, 'js': JS}), encoding='utf-8')
print('execute module', len(HTML))

MAIN = '''<main style="flex-grow: 1; min-width: 0; box-sizing: border-box; padding: 40px 48px 48px; position: relative">
<div data-execute></div>
</main>'''
write_screen('Execute.dc.html', 'Execute', MAIN, '', 'roadmap2_logic.js', info=False)
