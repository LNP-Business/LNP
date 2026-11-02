"""Cockpit on the shared data: header counts, velocity tiles we can compute, waiting-on-you, what's slowing execution,
hygiene, the key result table, active explorations, and the Marketing department KRs.
Patches from Main.pre-store.dc.html (kept as the untouched source) so it can be re-run."""
import pathlib, re
HERE = pathlib.Path(__file__).resolve().parent
SRC = HERE / 'Main.pre-store.dc.html'
OUT = HERE.parent / 'skl-en' / 'project' / 'Main.dc.html'
s = SRC.read_text(encoding='utf-8')

def cut(s, start, end_marker, repl, include_end=True):
    i = s.index(start)
    j = s.index(end_marker, i) + (len(end_marker) if include_end else 0)
    return s[:i] + repl + s[j:]

# ---- header ----
s = s.replace('<div style="font-size: 14px; color: #5E5B53; margin-bottom: 6px">Tuesday, October 13</div>\n<h1 style="margin: 0; font-family: Fraunces, Georgia, serif; font-size: 40px; font-weight: 500">Good morning, Romain</h1>',
              '<div style="font-size: 14px; color: #5E5B53; margin-bottom: 6px">{{todayLabel}}</div>\n<h1 style="margin: 0; font-family: Fraunces, Georgia, serif; font-size: 40px; font-weight: 500">{{hello}}</h1>')
s = cut(s, '<div style="font-size: 15px; color: #5E5B53">5 KRs:', '</div>',
        '<div style="font-size: 15px; color: #5E5B53">{{kc.total}} KRs: <strong style="color: #1E5E38">{{kc.green}} green</strong> · <strong style="color: #8A3F06">{{kc.amber}} amber</strong> · <strong style="color: #9B1C12">{{kc.red}} red</strong> · <strong style="color: #5E5B53">{{kc.stale}} not tracked</strong><sc-if value="{{kc.new}}" hint-placeholder-val="{{false}}"> · <strong style="color: #7A4B00">{{kc.new}} new</strong></sc-if></div>')

# ---- Milestones reached last week (Romain 2026-11-01: no more promises) ----
s = cut(s, '<div style="font-size: 13px; color: #C9C4B7">Promise reliability</div>', 'Content 64% ↓</div>',
        '<div style="font-size: 13px; color: #C9C4B7">Milestones reached</div>\n'
        '<div style="display: flex; align-items: baseline; gap: 8px"><span style="font-family: Fraunces, Georgia, serif; font-size: 38px; font-weight: 500; line-height: 1">{{pr.pct}}</span><span style="{{pr.trendStyle}}">{{pr.trend}}</span></div>\n'
        '<div style="font-size: 12px; color: #C9C4B7; line-height: 1.45">last finished week · target ≥ 80%</div>\n'
        '<div style="{{pr.subStyle}}">{{pr.sub}}</div>')

# ---- no greeting, no date, no KR count at the top: the page opens on the tabs ----
i = s.index('<header style="display: flex; justify-content: space-between; align-items: flex-end; gap: 24px">')
j = s.index('</header>', i) + len('</header>')
s = s[:i] + s[j:]

# ---- Blockers and Team load tiles ----
s = cut(s, '<div style="font-size: 13px; color: #5E5B53">Blockers</div>', '</span>\n</div>',
        '<div style="font-size: 13px; color: #5E5B53">Blockers</div>\n'
        '<div style="display: flex; align-items: baseline; gap: 8px"><span style="font-family: Fraunces, Georgia, serif; font-size: 38px; font-weight: 500; line-height: 1">{{blk.n}}</span></div>\n'
        '<div style="font-size: 12px; color: #5E5B53; line-height: 1.45">{{blk.sub}}</div>\n'
        '<span style="{{blk.flagStyle}}"><span style="{{blk.dotStyle}}"></span>{{blk.flag}}</span>\n</div>')
s = cut(s, '<div style="font-size: 13px; color: #5E5B53">Team load</div>', '</span>\n</div>',
        '<div style="font-size: 13px; color: #5E5B53">Team load</div>\n'
        '<div style="display: flex; align-items: baseline; gap: 8px"><span style="font-family: Fraunces, Georgia, serif; font-size: 38px; font-weight: 500; line-height: 1">{{ld.pct}}</span></div>\n'
        '<div style="font-size: 12px; color: #5E5B53; line-height: 1.45">Planned load, next 7 days · target ≤ 70%, 30% for the unplanned</div>\n'
        '<span style="{{ld.flagStyle}}"><span style="{{ld.dotStyle}}"></span>{{ld.flag}}</span>\n</div>')

# ---- hygiene ----
s = cut(s, '<span style="display: inline-flex; align-items: center; gap: 6px; color: #8A3F06; font-weight: 600"><span style="width: 8px; height: 8px; border-radius: 50%; background: #B45309"></span>1 KR with no check-in', '<a href="#" style="margin-left: auto; font-weight: 600; text-decoration: none">Follow up</a>',
        '<sc-for list="{{hyg}}" as="h" hint-placeholder-count="1"><span style="display: inline-flex; align-items: center; gap: 6px; color: #8A3F06; font-weight: 600"><span style="width: 8px; height: 8px; border-radius: 50%; background: #B45309"></span>{{h}}</span></sc-for>\n'
        '<span style="color: #5E5B53">{{hygRest}}</span>\n'
        '<a href="Inbox.dc.html" style="margin-left: auto; font-weight: 600; text-decoration: none">Open the Inbox</a>')

# ---- waiting on you ----
ROW_DARK = ('<sc-for list="{{mine}}" as="a" hint-placeholder-count="3">'
            '<div style="display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 16px; align-items: center; padding: 14px 0; border-top: 1px solid #34322C">'
            '<div><div style="font-size: 15px; font-weight: 600">{{a.subject}}</div><div style="{{a.detailStyle}}">{{a.alert}} · {{a.detail}}</div></div>'
            '<button type="button" onClick="{{a.go}}" style="{{a.btnStyle}}">{{a.action}}</button></div></sc-for>'
            '<sc-if value="{{noMe}}" hint-placeholder-val="{{false}}"><div style="padding: 14px 0; border-top: 1px solid #34322C; font-size: 14px; color: #C9C4B7">Pick your name under “You are” in the sidebar to see what is waiting on you.</div></sc-if>'
            '<sc-if value="{{mineEmpty}}" hint-placeholder-val="{{false}}"><div style="padding: 14px 0; border-top: 1px solid #34322C; font-size: 14px; color: #C9C4B7">Nothing is waiting on you. Good.</div></sc-if>')
s = cut(s, '<h2 id="toi"', '</section>',
        '<h2 id="toi" style="margin: 0; font-family: Fraunces, Georgia, serif; font-size: 22px; font-weight: 500">Waiting on you · {{mineN}}</h2>\n'
        '<span style="font-size: 13px; color: #C9C4B7">{{meName}}</span>\n</div>\n' + ROW_DARK + '\n</section>')

# ---- what's slowing execution ----
ROW_LIGHT = ('<sc-for list="{{slow}}" as="a" hint-placeholder-count="3">'
             '<div style="display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 16px; align-items: center; padding: 14px 0; border-top: 1px solid #EFEBE3">'
             '<div><div style="display: flex; align-items: center; gap: 8px; font-size: 15px; font-weight: 600"><span style="{{a.dot}}"></span>{{a.alert}}: {{a.subject}}</div>'
             '<div style="font-size: 13px; color: #5E5B53; margin-top: 4px; padding-left: 16px">{{a.detail}} · {{a.person}}</div></div>'
             '<button type="button" onClick="{{a.go}}" style="display: inline-flex; align-items: center; min-height: 44px; padding: 0 16px; border-radius: 10px; border: 1px solid #D8D3C7; background: #FFFFFF; color: #1B1B18; font: inherit; font-size: 14px; font-weight: 600; cursor: pointer">{{a.action}}</button></div></sc-for>'
             '<sc-if value="{{slowEmpty}}" hint-placeholder-val="{{false}}"><div style="padding: 14px 0; border-top: 1px solid #EFEBE3; font-size: 14px; color: #5E5B53">No critical or high alert on the team.</div></sc-if>')
s = cut(s, '<h2 id="menace"', '</section>',
        '<h2 id="menace" style="margin: 0; font-family: Fraunces, Georgia, serif; font-size: 22px; font-weight: 500">What\'s slowing execution · {{slowN}}</h2>\n'
        '<a href="Inbox.dc.html" style="font-size: 13px; font-weight: 600; text-decoration: none">Open the Inbox →</a>\n</div>\n' + ROW_LIGHT + '\n</section>')

# ---- key result table ----
SVG = ('<svg viewBox="0 0 260 60" width="260" height="60" role="img" aria-label="{{r.aria}}">'
       '<line x1="8" y1="54" x2="252" y2="54" stroke="#ECE8DF" stroke-width="1"></line>'
       '<line x1="{{r.todayX}}" y1="2" x2="{{r.todayX}}" y2="58" stroke="#D8D3C7" stroke-width="1"></line>'
       '<polyline points="{{r.expPts}}" fill="none" stroke="#1B1B18" stroke-width="1.5" stroke-dasharray="4 4"></polyline>'
       '<polyline points="{{r.actPts}}" fill="none" stroke="{{r.actCol}}" stroke-width="2.5" stroke-linejoin="round"></polyline>'
       '<sc-if value="{{r.projOn}}" hint-placeholder-val="{{true}}"><line x1="{{r.projX1}}" y1="{{r.projY1}}" x2="252" y2="{{r.projY2}}" stroke="{{r.projCol}}" stroke-width="2" stroke-dasharray="1 4" stroke-linecap="round"></line>'
       '<circle cx="252" cy="{{r.projY2}}" r="3.5" fill="{{r.projCol}}"></circle></sc-if>'
       '<sc-if value="{{r.stale}}" hint-placeholder-val="{{false}}"><text x="{{r.staleX}}" y="40" font-size="11" fill="#5E5B53" font-family="IBM Plex Sans, sans-serif">? no recent data</text></sc-if>'
       '<line x1="242" y1="6" x2="258" y2="6" stroke="#1B1B18" stroke-width="2"></line>'
       '<sc-if value="{{r.cheaper}}" hint-placeholder-val="{{false}}"><text x="150" y="48" font-size="10" fill="#5E5B53" font-family="IBM Plex Sans, sans-serif">{{r.cheaper}}</text></sc-if>'
       '</svg>')
ROW = ('<div role="link" tabindex="0" onClick="{{r.open}}" onKeyDown="{{r.key}}" style="{{r.rowStyle}}">'
       '<div><div style="font-size: 14px; font-weight: 600">{{r.name}}</div><div style="{{r.subStyle}}">{{r.sub}}</div></div>'
       + SVG +
       '<div><div style="{{r.ratioStyle}}">{{r.ratio}} <span style="{{r.arrowStyle}}">{{r.arrow}}</span></div><div style="font-size: 12px; color: #5E5B53; margin-top: 2px">{{r.ratioSub}}</div></div>'
       '<div style="font-size: 13px; line-height: 1.55"><div>Forecast: <strong style="{{r.fcStyle}}">{{r.fcText}}</strong></div>'
       '<div>7-d pace: <strong style="{{r.paceStyle}}">{{r.paceText}}</strong> · required <strong>{{r.reqText}}</strong></div>'
       '<div style="{{r.nextStyle}}">{{r.nextText}}</div></div>'
       '<span style="{{r.pillStyle}}"><span style="{{r.dotStyle}}"></span>{{r.label}}</span></div>')
HEAD = ('<div style="display: grid; grid-template-columns: 250px 260px 120px minmax(0, 1fr) 96px; gap: 18px; padding: 0 8px 8px; font-size: 12px; letter-spacing: 0.06em; text-transform: uppercase; color: #5E5B53">\n'
        '<span>Key result</span><span>Quarter trajectory</span><span>Ratio</span><span>Forecast · pace · next milestone</span><span>Status</span>\n</div>\n')
TABLE = (HEAD +
         '<sc-for list="{{objectives}}" as="ob" hint-placeholder-count="3">'
         '<div style="display: flex; align-items: center; gap: 10px; padding: 14px 8px 6px; border-top: 1px solid #E3DFD5">'
         '<span style="font-size: 12px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: #5E5B53">{{ob.label}}</span></div>'
         '<sc-for list="{{ob.rows}}" as="r" hint-placeholder-count="2">' + ROW + '</sc-for></sc-for>'
         '<sc-if value="{{noKr}}" hint-placeholder-val="{{false}}"><div style="padding: 18px 8px; border-top: 1px solid #E3DFD5; font-size: 14px; color: #5E5B53">No key result yet.</div></sc-if>\n')
s = cut(s, '<div style="display: grid; grid-template-columns: 250px 260px 120px minmax(0, 1fr) 96px; gap: 18px; padding: 0 8px 8px; font-size: 12px; letter-spacing: 0.06em; text-transform: uppercase; color: #5E5B53">\n<span>Key result</span>',
        '</a>\n</section>', TABLE + '</section>')
s = s.replace('One row per KR. The projection shows where we land at the current pace. Click a row for details.',
              'One row per KR. The projection shows where we land at the recent pace. Click a row to open it in Build.')

# ---- active explorations ----
EXP = ('<sc-for list="{{explo}}" as="e" hint-placeholder-count="3">'
       '<div style="{{e.rowStyle}}">'
       '<div style="padding-left: 10px"><div style="font-size: 14px; font-weight: 600">{{e.title}}</div><div style="{{e.subStyle}}">{{e.sub}}</div></div>'
       '<div style="font-family: \'IBM Plex Mono\', monospace; font-size: 12px; {{e.whenStyle}}">{{e.when}}</div>'
       '<button type="button" onClick="{{e.go}}" style="{{e.btnStyle}}">{{e.action}}</button></div></sc-for>'
       '<sc-if value="{{exploEmpty}}" hint-placeholder-val="{{false}}"><div style="padding: 14px 10px; border-top: 1px solid #EFEBE3; font-size: 14px; color: #5E5B53">No exploration open. Add one as a task with the Explore type.</div></sc-if>\n')
i = s.index('<div style="font-size: 13px; color: #5E5B53; margin: 4px 0 14px">We commit to a timebox')
i = s.index('</div>', i) + len('</div>\n')
j = s.index('<div style="display: flex; flex-direction: column; gap: 18px">', i)
s = s[:i] + '\n' + EXP + '</div>\n\n' + s[j:]

# ---- Marketing department KRs ----
s = cut(s, '<section aria-labelledby="minit"', '</section>',
        '<section aria-labelledby="minit" style="background: #FFFFFF; border: 1px solid #E3DFD5; border-radius: 14px; padding: 24px 28px; display: flex; flex-direction: column">\n'
        '<h2 id="minit" style="margin: 0 0 14px; font-family: Fraunces, Georgia, serif; font-size: 22px; font-weight: 500">Marketing department KRs</h2>\n'
        + HEAD + '<sc-for list="{{mkRows}}" as="r" hint-placeholder-count="2">' + ROW + '</sc-for>\n</section>')

# ---- Overview v4 and the Key results screen: mounted modules (cockpit_v2) ----
i = s.index('<sc-if value="{{isGlobal}}" hint-placeholder-val="{{true}}">')
j = s.index('<!-- ============ MARKETING ============ -->', i)
s = s[:i] + '<sc-if value="{{isGlobal}}" hint-placeholder-val="{{true}}">\n<div data-ov="1" style="width: 100%"></div>\n</sc-if>\n\n<sc-if value="{{isKR}}" hint-placeholder-val="{{false}}">\n<div data-krroom="1" style="width: 100%"></div>\n</sc-if>\n\n' + s[j:]
s = s.replace('<button type="button" onClick="{{goGlobal}}" aria-pressed="{{isGlobal}}" style="{{tabGlobal}}">Overview</button>',
              '<button type="button" onClick="{{goGlobal}}" aria-pressed="{{isGlobal}}" style="{{tabGlobal}}">Overview</button>\n<button type="button" onClick="{{goKR}}" aria-pressed="{{isKR}}" style="{{tabKR}}">Key results</button>', 1)

# ---- Marketing and Finance: mounted modules (gen_poles) ----
i = s.index('<sc-if value="{{isMarketing}}"'); j = s.index('<!-- ============ SALES ============ -->', i)
s = s[:i] + '<sc-if value="{{isMarketing}}" hint-placeholder-val="{{false}}">\n<div data-mkt="1" style="width: 100%"></div>\n</sc-if>\n\n' + s[j:]
i = s.index('<sc-if value="{{isFinance}}"'); j = s.index('</sc-if>', s.index('</section>', s.rindex('<section aria-labelledby="fech"', 0))) + len('</sc-if>')
s = s[:i] + '<sc-if value="{{isFinance}}" hint-placeholder-val="{{false}}">\n<div data-fin="1" style="width: 100%"></div>\n</sc-if>' + s[j:]

# ---- logic ----
LOGIC = (HERE / 'cockpit_logic.js').read_text(encoding='utf-8')
i = s.index('class Component extends DCLogic')
j = s.index('</script>', i)
s = s[:i] + LOGIC.strip() + '\n' + s[j:]
OUT.write_text(s, encoding='utf-8')
print('cockpit', len(s), 'holes', s.count('{{'))
