"""One consistent dataset for the whole OS: key results, tasks, decisions (with their 5-step frames).
Used as the demo dataset when the shared database is not available, and written to the shared database once."""
import json, pathlib, re, subprocess
HERE = pathlib.Path(__file__).resolve().parent

# ---- key results: taken from the Roadmap seed (roadmap_logic.js), tasks moved to their own collection ----
seed_src = (HERE / 'kr_seed.js').read_text(encoding='utf-8')
runner = ('global.DCLogic=class{};class X{' + seed_src + '};console.log(JSON.stringify(new X().seed()));')
krs = json.loads(subprocess.check_output(['node', '-e', runner]).decode())
OWN = {'Ilya': 'contenu', 'Michael': 'marketing', 'Romain': 'romain', 'Amin': 'amin', 'Valentino': 'sales', 'Sales Lead': 'sales'}
CHECK_DATES = {'Oct 6': '2026-10-06', 'Sep 29': '2026-09-29', 'Oct 4': '2026-10-04', 'Oct 12': '2026-10-12', 'Oct 5': '2026-10-05',
               'Oct 13': '2026-10-13', 'Oct 11': '2026-10-11'}
for k in krs:
    k.pop('tasks', None); k.pop('stale', None)
    k['owner'] = OWN[k['owner']]
    for r in k['risks']:
        r['owner'] = OWN.get(r['owner'], r['owner'])
    for c in k['checkins']:
        c['date'] = CHECK_DATES[c['date']]
    for i, m in enumerate(k['miles']):   # a stable id per milestone (tasks point to it with "mile")
        m['id'] = k['id'] + '-m' + str(i)

# leading indicators: no reading yet, owners add them at their first check-in

# ---- tasks: one list for Roadmap, My Day and Decisions ----
def T(id, title, kr, init, owner, due, est, status='todo', start=None, end=None, kind='L', unc='C', note='', since=''):
    return dict(id=id, title=title, kr=kr, init=init, owner=owner, due=due, est=est, status=status,
                start=start, end=end, kind=kind, unc=unc, note=note, since=since)
# real Q4 to-dos stated in the KR memos and the KR roadmaps (owners add the rest in Roadmap and My Day)
tasks = [
    T('q4t1', 'Write the raw-footage and engineered-output handoff checklists', 'kr12', 1, 'contenu', '2026-10-17', 3, note='To-do #8 · signed by the sender before measurement starts'),
    T('q4t2', 'Approve the test budget for the new VSL and the CHAIR ads', 'kr22', 1, 'amin', '2026-10-18', 1, note='Dependency of the W42 milestone of KR 2.2'),
    T('q4t3', 'Rebuild October bookings by hand in the sales source of truth', 'kr22', -1, 'marketing', '2026-10-23', 6, note='Baseline and drivers for Oct 5–23 (KR 2.2 milestone 1)'),
    T('q4t4', 'Release Batch 02 from the footage bank', 'kr11', 0, 'marketing', '2026-10-26', 2, note='4 concepts × 2 hooks, ready by Oct 30'),
    T('q4t5', 'Integrate the custom chunker in the engineering pipeline', 'kr12', 0, 'contenu', '2026-11-06', 6, note='Must be live by Nov 8, or KR 1.2 milestone 2 moves'),
]

# ---- decisions and Weekly Reviews: none recorded yet for the real quarter ----
decisions = []
reviews = []

# ---- Library: the KR memos, as their PDF files (uploaded once to the "library" bucket at memos/<file>) ----
deliverables = []
for m in json.loads((HERE / 'library' / 'memos.json').read_text(encoding='utf-8')):
    pdf = HERE / 'library' / m['pdf']
    deliverables.append(dict(id=m['id'], type='memo', title='KR ' + m['kr'] + ' memo · ' + m['title'], summary=m['summary'], content='',
                             file=dict(id='memos/' + pdf.name, name=pdf.name, contentType='application/pdf', sizeBytes=pdf.stat().st_size),
                             domain=m['domain'], owner=m['owner'], status=m['status'], ip=False, date=m['date'], by='romain'))

seed = {'krs': krs, 'tasks': tasks, 'decisions': decisions, 'reviews': reviews, 'deliverables': deliverables}
(HERE / 'seed.json').write_text(json.dumps(seed, ensure_ascii=False), encoding='utf-8')
print('krs', len(krs), 'tasks', len(tasks), 'decisions', len(decisions), 'bytes', len(json.dumps(seed)))
