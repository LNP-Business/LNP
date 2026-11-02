"""Knowledge System › Operating System: the SKL OS modelled as a mechanism, hosted like Pre-call."""
import pathlib
P = pathlib.Path(__file__).resolve().parent.parent / 'skl-en' / 'project'
s = (P / 'MechPrecall.dc.html').read_text(encoding='utf-8')
s = s.replace('<title>SKL KS — Pre-call</title>', '<title>SKL KS — Operating System</title>')
s = s.replace('data-mech="s-preappel"', 'data-mech="s-os-exec|s-os-res"')
s = s.replace('>Pre-call mechanism</h2>', '>Operating System mechanism</h2>')
s = s.replace('This page models the Pre-call mechanism with the Iteration system:',
              'This page models SKL OS as two mechanisms, one per clock, built with the same Iteration system as Pre-call. Execution steering (daily, owner Romain) turns task and decision alerts into closed alerts and decisions taken. Results steering (weekly, owner Amin) turns KR readings into plans kept or changed, and sends recovery actions back to execution. Switch between them at the top right. Each model uses')
assert 'data-mech="s-os-exec|s-os-res"' in s and 'Operating System mechanism' in s
(P / 'MechOS.dc.html').write_text(s, encoding='utf-8'); print('MechOS ok')
