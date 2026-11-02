"""SKL OS palette: white / black / gold. Blue actions become black with gold, blue accents become gold."""
import re, pathlib, sys
ROOT = pathlib.Path(__file__).resolve().parent.parent
FILES = list((ROOT / 'skl-en' / 'project').glob('*.dc.html')) + [ROOT / 'lib' / 'gen_lib.py', ROOT / 'iter' / 'gen_iter.py']
GOLD, GOLD_INK, GOLD_DEEP, INK = '#D9B46A', '#9A6614', '#7A4B00', '#1B1B18'

def recolor(s):
    # primary buttons and filled chips: black, with gold text
    def fill(m):
        seg = m.group(0).replace('background: #23408E', 'background: ' + INK)
        seg = re.sub(r'color: #FFFFFF', 'color: ' + GOLD, seg)
        return seg
    s = re.sub(r'[^"\'`]*background: #23408E[^"\'`]*', fill, s)
    s = s.replace('border: 1px solid #23408E', 'border: 1px solid ' + INK).replace('border-color: #23408E', 'border-color: ' + INK)
    s = s.replace('color: #23408E', 'color: ' + GOLD_INK)
    s = s.replace('#23408E', '#C9A04A')          # bars, lines, dots
    for a, b in [('#16295E', GOLD_DEEP), ('#C9D1E6', '#E6D3A8'), ('#E9EDF7', '#F7EEDC'), ('#DDE4F3', '#F7EEDC'),
                 ('#E3E8F4', '#F7EEDC'), ('#EEF1F8', '#FBF6EC'), ('#7C93D0', GOLD)]:
        s = s.replace(a, b)
    return s

for f in FILES:
    t = f.read_text(encoding='utf-8'); n = recolor(t)
    if n != t:
        f.write_text(n, encoding='utf-8'); print('recoloured', f.name, t.count('#23408E'))
