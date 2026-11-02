import json, pathlib
H = pathlib.Path(__file__).parent
d = json.load(open(H.parent/'skl-os'/'seed.json'))
seed = json.dumps({'krs': d['krs'], 'tasks': d['tasks']}, ensure_ascii=False)
for src, out in [('roadmap-review.src.html', 'roadmap-review.html')]:
    s = (H/src).read_text(encoding='utf-8').replace('/*SEED*/null', seed)
    (H/out).write_text(s, encoding='utf-8'); print(out, len(s))
