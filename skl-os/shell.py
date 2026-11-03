"""Common frame for new LNP screens: same head, same sidebar (rewritten by nav.py), same info button and popup."""
import pathlib, re
HERE = pathlib.Path(__file__).resolve().parent
P = HERE.parent / 'skl-en' / 'project'

FIELD = 'font: inherit; font-size: 14px; padding: 8px 10px; border: 1px solid #1B1B18; background: #1B1B18; color: #FFFFFF; caret-color: #FFFFFF; border-radius: 8px; width: 100%; box-sizing: border-box; min-width: 0'
LABEL = 'display: flex; flex-direction: column; gap: 5px; font-size: 11px; font-weight: 600; letter-spacing: 0.07em; text-transform: uppercase; color: #5E5B53'
BTN_DARK = 'min-height: 44px; padding: 0 18px; border: 0; border-radius: 10px; background: #1B1B18; color: #D9B46A; font: inherit; font-size: 15px; font-weight: 600; cursor: pointer; white-space: nowrap'
BTN_LINE = 'min-height: 40px; padding: 0 14px; border: 1px solid #D8D3C7; border-radius: 10px; background: #FFFFFF; color: #1B1B18; font: inherit; font-size: 14px; font-weight: 600; cursor: pointer; white-space: nowrap'
CARD = 'background: #FFFFFF; border: 1px solid #E3DFD5; border-radius: 14px'
H2 = 'margin: 0; font-family: Fraunces, Georgia, serif; font-size: 22px; font-weight: 500'
EYEBROW = 'font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; color: #5E5B53'


def info_popup(title, sections):
    out = ['<sc-if value="{{info}}" hint-placeholder-val="{{false}}">',
           '<div data-overlay="info" style="position: absolute; inset: 0; background: rgba(27,27,24,0.55); display: flex; justify-content: center; align-items: flex-start; padding-top: 32px; overflow: auto; z-index: 50">',
           '<div role="dialog" aria-modal="true" aria-labelledby="info-title" style="width: 820px; max-width: calc(100% - 48px); box-sizing: border-box; background: #FFFFFF; border-radius: 16px; padding: 28px 36px; display: flex; flex-direction: column; gap: 20px; box-shadow: 0 24px 64px rgba(0,0,0,0.28)">',
           '<div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 20px">',
           f'<div><div style="{EYEBROW}">Page method</div><h2 id="info-title" style="margin: 6px 0 0; font-family: Fraunces, Georgia, serif; font-size: 32px; font-weight: 500">{title}</h2></div>',
           '<button type="button" onClick="{{closeInfo}}" aria-label="Close" style="width: 44px; height: 44px; flex-shrink: 0; border-radius: 50%; border: 1px solid #D8D3C7; background: #FFFFFF; color: #1B1B18; font: inherit; font-size: 22px; line-height: 1; cursor: pointer">×</button>',
           '</div>']
    for i, (h, kind, items) in enumerate(sections, 1):
        out.append('<section>')
        out.append(f'<h3 style="margin: 0 0 10px; display: flex; align-items: center; gap: 10px; font-size: 17px; font-weight: 600"><span style="width: 28px; height: 28px; border-radius: 50%; background: #1B1B18; color: #FFFFFF; font-size: 13px; display: inline-flex; align-items: center; justify-content: center">{i}</span>{h}</h3>')
        if kind == 'p':
            out.append(f'<p style="margin: 0; font-size: 15px; line-height: 1.6; color: #3D3A33">{items}</p>')
        else:
            tag = 'ol' if kind == 'ol' else 'ul'
            pad = '22px' if tag == 'ol' else '20px'
            out.append(f'<{tag} style="margin: 0; padding-left: {pad}; display: flex; flex-direction: column; gap: 8px; font-size: 15px; line-height: 1.55; color: #3D3A33">')
            out += [f'<li>{x}</li>' for x in items]
            out.append(f'</{tag}>')
        out.append('</section>')
    out += ['<button type="button" onClick="{{closeInfo}}" style="align-self: flex-end; min-height: 44px; padding: 0 22px; border: 0; border-radius: 10px; background: #1B1B18; color: #FFFFFF; font: inherit; font-size: 15px; font-weight: 600; cursor: pointer">Got it</button>',
            '</div>', '</div>', '</sc-if>']
    return '\n'.join(out)


INFO_BTN = ('<button type="button" onClick="{{openInfo}}" aria-label="How this page works" title="How this page works" style="position: absolute; top: 18px; right: 24px; width: 52px; height: 52px; border-radius: 50%; border: 2px solid #1B1B18; background: #FFFFFF; color: #1B1B18; font-family: Fraunces, Georgia, serif; font-size: 30px; font-weight: 600; font-style: italic; line-height: 1; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 10px rgba(27,27,24,0.14); z-index: 40">i</button>')


def write_screen(fname, title, main, overlays, logic_file, info=True):
    # LNP: the shared head of every screen (the head of the former Decisions screen, before <main>)
    head = (P / 'Shell.base.html').read_text(encoding='utf-8').replace('{title}', title)
    logic = (HERE / logic_file).read_text(encoding='utf-8').strip()
    body = (head + main + '\n\n' + overlays + '\n' + (INFO_BTN if info else '') + '\n</div>\n</x-dc>\n'
            '<script type="text/x-dc" data-dc-script data-props=\'{"$preview":{"width":1440,"height":1180}}\'>\n' + logic + '\n</script>\n</body>\n</html>\n')
    (P / fname).write_text(body, encoding='utf-8')
    print(fname, len(body))
