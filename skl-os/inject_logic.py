"""Put each screen's logic file into its template (between 'class Component extends DCLogic' and '</script>')."""
import pathlib
HERE = pathlib.Path(__file__).resolve().parent
P = HERE.parent / 'skl-en' / 'project'
for logic, tpl in [('decisions_logic.js', 'Decisions.dc.html'), ('review_logic.js', 'Review.dc.html')]:
    s = (P / tpl).read_text(encoding='utf-8'); L = (HERE / logic).read_text(encoding='utf-8').strip()
    i = s.index('class Component extends DCLogic'); j = s.index('</script>', i)
    s = s[:i] + L + '\n' + s[j:]
    (P / tpl).write_text(s, encoding='utf-8'); print(tpl, 'ok')
