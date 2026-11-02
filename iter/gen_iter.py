"""Generate the SKL KS mechanism screens (Pre-call, Sales) and the Settings > Registers screen
from the Iteration-system engine output (engine.json, reg.json). SKL OS visual language."""
import json, html, pathlib

HERE = pathlib.Path(__file__).resolve().parent
OUT = HERE.parent / "skl-en" / "project"
E = json.load(open(HERE / "engine.json", encoding="utf-8"))
R = json.load(open(HERE / "reg.json", encoding="utf-8"))

esc = lambda s: html.escape(str(s), quote=True)
INK, INK2, INK3, LINE, PAPER = "#1B1B18", "#3D3A33", "#5E5B53", "#E3DFD5", "#F6F4EF"
FN_COLOR = {"frame": "#9A6410", "matter": "#0E6E7A", "machinery": "#5B3A9E", "control": "#14705A", "epistemic": "#A81D3A"}
FN_KEY = {f[1]: f[0] for f in E["functions"]}
TY = {"choice": ("Choice", "A decision you make"), "fact": ("Fact", "Something you observe"),
      "construct": ("Construct", "Something you build to steer"), "annotation": ("Annotation", "What you know about what you know")}
MECH = {"precall": ("Pre-call", "MechPrecall.dc.html"), "sales": ("Sales", "MechSales.dc.html")}
MECH_HREF = {"Pre-call": "MechPrecall.dc.html", "Sales": "MechSales.dc.html"}

HEAD = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>{title}</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&amp;family=IBM+Plex+Sans:wght@400;500;600&amp;family=IBM+Plex+Mono:wght@500&amp;display=swap">
<style>
body{{margin:0;font-family:'IBM Plex Sans',system-ui,sans-serif;background:#F6F4EF;color:#1B1B18}}
a{{color:#C9A04A}}a:hover{{color:#7A4B00}}
</style>
</helmet>
<div style="position: relative; width: 1440px; height: {h}px; display: flex; background: #F6F4EF; font-family: 'IBM Plex Sans', system-ui, sans-serif; color: #1B1B18">

<nav aria-label="Main navigation" style="width: 232px; flex-shrink: 0; box-sizing: border-box; background: #1B1B18; padding: 32px 18px; display: flex; flex-direction: column; gap: 4px">
<div style="flex-grow: 1"></div>
<div style="padding: 14px; border-top: 1px solid #34322C; font-size: 13px; color: #A8A396; line-height: 1.5">{footer}</div>
</nav>

<main style="flex-grow: 1; min-width: 0; box-sizing: border-box; padding: 40px 96px 48px 48px; display: flex; flex-direction: column; gap: 22px">
"""

INFO_BTN = """
<button type="button" onClick="{{openInfo}}" aria-label="How this page works" title="How this page works" style="position: absolute; top: 18px; right: 24px; width: 52px; height: 52px; border-radius: 50%; border: 2px solid #1B1B18; background: #FFFFFF; color: #1B1B18; font-family: Fraunces, Georgia, serif; font-size: 30px; font-weight: 600; font-style: italic; line-height: 1; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 10px rgba(27,27,24,0.14); z-index: 40">i</button>
"""


def info_popup(title, what, eff, how):
    li = lambda items: "\n".join(f'<li>{x}</li>' for x in items)
    num = lambda n: f'<span style="width: 28px; height: 28px; border-radius: 50%; background: #1B1B18; color: #FFFFFF; font-size: 13px; display: inline-flex; align-items: center; justify-content: center">{n}</span>'
    h3 = 'style="margin: 0 0 10px; display: flex; align-items: center; gap: 10px; font-size: 17px; font-weight: 600"'
    lst = 'style="margin: 0; padding-left: 22px; display: flex; flex-direction: column; gap: 8px; font-size: 15px; line-height: 1.55; color: #3D3A33"'
    return f"""
<sc-if value="{{{{info}}}}" hint-placeholder-val="{{{{false}}}}">
<div data-overlay="info" style="position: absolute; inset: 0; background: rgba(27,27,24,0.55); display: flex; justify-content: center; align-items: flex-start; padding-top: 32px; overflow: auto; z-index: 50">
<div role="dialog" aria-modal="true" aria-labelledby="info-title" style="width: 820px; max-width: calc(100% - 48px); box-sizing: border-box; background: #FFFFFF; border-radius: 16px; padding: 28px 36px; display: flex; flex-direction: column; gap: 20px; box-shadow: 0 24px 64px rgba(0,0,0,0.28)">
<div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 20px">
<div><div style="font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; color: #5E5B53">Page method</div><h2 id="info-title" style="margin: 6px 0 0; font-family: Fraunces, Georgia, serif; font-size: 32px; font-weight: 500">{title}</h2></div>
<button type="button" onClick="{{{{closeInfo}}}}" aria-label="Close" style="width: 44px; height: 44px; flex-shrink: 0; border-radius: 50%; border: 1px solid #D8D3C7; background: #FFFFFF; color: #1B1B18; font: inherit; font-size: 22px; line-height: 1; cursor: pointer">×</button>
</div>
<section><h3 {h3}>{num(1)}What this page is for</h3><p style="margin: 0; font-size: 15px; line-height: 1.6; color: #3D3A33">{what}</p></section>
<section><h3 {h3}>{num(2)}How it makes everyone more efficient</h3><ul {lst.replace('22px','20px')}>{li(eff)}</ul></section>
<section><h3 {h3}>{num(3)}How to use it</h3><ol {lst}>{li(how)}</ol></section>
<button type="button" onClick="{{{{closeInfo}}}}" style="align-self: flex-end; min-height: 44px; padding: 0 22px; border: 0; border-radius: 10px; background: #1B1B18; color: #FFFFFF; font: inherit; font-size: 15px; font-weight: 600; cursor: pointer">Got it</button>
</div>
</div>
</sc-if>
"""


def fmt(v):
    if v is None or v == "":
        return "—"
    if isinstance(v, float) and v.is_integer():
        v = int(v)
    if isinstance(v, (int, float)):
        return f"{v:,}".replace(",", " ") if abs(v) >= 10000 else str(v)
    return str(v)


# ------------------------------------------------------------------ stock & flow diagram
def diagram(M):
    inputs = [x["nom"] for x in M.get("06", [])]
    stocks = {x["nom"]: x for x in M.get("08", [])}
    outs = [x for x in M.get("10", [])]
    real_out = [x["nom"] for x in outs if x.get("induite") != "yes"]
    flows = [f for f in M.get("09", []) if f.get("de") and f.get("vers")]
    # depth of each stock from the inputs, ignoring back edges
    depth = {n: 0 for n in inputs}
    changed = True
    while changed:
        changed = False
        for f in flows:
            if f["de"] in depth and f["vers"] in stocks and f["vers"] not in depth:
                depth[f["vers"]] = depth[f["de"]] + 1
                changed = True
    for s in stocks:
        depth.setdefault(s, 1)
    last = max([depth[s] for s in stocks] or [0]) + 1
    for o in real_out:
        depth[o] = last
    cols = {}
    for n, d in depth.items():
        cols.setdefault(d, []).append(n)
    # order outputs by the depth of the stock that feeds them
    src_of = {f["vers"]: f["de"] for f in flows}
    cols[last].sort(key=lambda o: depth.get(src_of.get(o, ""), 0))
    W = {"in": 176, "stock": 196, "out": 186}
    Hn = {"in": 58, "stock": 66, "out": 50}
    COLW, GAP = 262, 18
    kind = lambda n: "in" if n in inputs else "stock" if n in stocks else "out"
    heights = {c: sum(Hn[kind(n)] for n in ns) + GAP * (len(ns) - 1) for c, ns in cols.items()}
    H = max(heights.values()) + 80
    pos = {}
    for c, ns in cols.items():
        y = (H - heights[c]) / 2
        for n in ns:
            k = kind(n)
            pos[n] = (24 + c * COLW, y, W[k], Hn[k])
            y += Hn[k] + GAP
    width = 24 + last * COLW + W["out"] + 24
    out_val = {x["nom"]: x for x in outs}
    main_out = next((x["nom"] for x in outs if x.get("induite") != "yes" and "mechanism" in str(x.get("dest", "")).lower()), None)
    if not main_out:
        main_out = next((x["nom"] for x in outs if x.get("dest") not in ("Outside", "") and x.get("induite") != "yes"), None)

    edges, labels = [], []
    out_ports = {}
    for f in flows:
        out_ports.setdefault(f["de"], []).append(f)
    in_ports = {}
    for f in flows:
        in_ports.setdefault(f["vers"], []).append(f)
    for f in flows:
        if f["de"] not in pos or f["vers"] not in pos:
            continue
        x1, y1, w1, h1 = pos[f["de"]]
        x2, y2, w2, h2 = pos[f["vers"]]
        ol, il = out_ports[f["de"]], in_ports[f["vers"]]
        sy = y1 + h1 * (ol.index(f) + 1) / (len(ol) + 1)
        ty = y2 + h2 * (il.index(f) + 1) / (len(il) + 1)
        rate = f"{fmt(f.get('debit'))}{esc(f.get('unite') or '')}"
        main = f["vers"] == main_out or (f["vers"] in stocks and f["de"] in inputs)
        stroke = "#14705A" if main else "#A8A396"
        sw = 2.2 if main else 1.4
        if x2 > x1:
            sx, ex = x1 + w1, x2
            mx = (sx + ex) / 2
            d = f"M{sx:.0f},{sy:.0f} C{mx:.0f},{sy:.0f} {mx:.0f},{ty:.0f} {ex - 8:.0f},{ty:.0f}"
            lx, ly = mx, (sy + ty) / 2
        else:  # back edge: loop underneath
            sx, sy2 = x1 + w1 / 2, y1 + h1
            ex, ey = x2 + w2 / 2, y2 + h2
            low = max(sy2, ey) + 34
            d = f"M{sx:.0f},{sy2:.0f} C{sx:.0f},{low:.0f} {ex:.0f},{low:.0f} {ex:.0f},{ey + 8:.0f}"
            lx, ly = (sx + ex) / 2, low - 6
        marker = "url(#arG)" if main else "url(#arN)"
        edges.append(f'<path d="{d}" fill="none" stroke="{stroke}" stroke-width="{sw}" marker-end="{marker}"></path>')
        tw = max(len(rate), 3) * 7 + 10
        labels.append(f'<rect x="{lx - tw / 2:.0f}" y="{ly - 10:.0f}" width="{tw}" height="18" rx="4" fill="#FFFFFF" stroke="#E3DFD5"></rect>'
                      f'<text x="{lx:.0f}" y="{ly + 3:.0f}" text-anchor="middle" font-size="11" font-family="IBM Plex Mono, monospace" fill="#3D3A33">{rate}</text>'
                      f'<title>{esc(f["nom"])}</title>')
    nodes = []
    for n, (x, y, w, h) in pos.items():
        k = kind(n)
        if k == "in":
            src = next(i for i in M["06"] if i["nom"] == n)
            nodes.append(f'<rect x="{x}" y="{y:.0f}" width="{w}" height="{h}" rx="29" fill="#E4F0EF" stroke="#0E6E7A" stroke-width="1.4"></rect>'
                         f'<text x="{x + 18}" y="{y + 24:.0f}" font-size="13" font-weight="600" fill="#0F5E5C" font-family="IBM Plex Sans, sans-serif">{esc(n)}</text>'
                         f'<text x="{x + 18}" y="{y + 42:.0f}" font-size="11" fill="#0F5E5C" font-family="IBM Plex Mono, monospace">{fmt(src.get("volume"))} {esc(src.get("unite") or "")} · input</text>')
        elif k == "stock":
            s = stocks[n]
            nodes.append(f'<rect x="{x}" y="{y:.0f}" width="{w}" height="{h}" rx="6" fill="#FFFFFF" stroke="#1B1B18" stroke-width="2.2"></rect>'
                         f'<text x="{x + 14}" y="{y + 25:.0f}" font-size="13" font-weight="600" fill="#1B1B18" font-family="IBM Plex Sans, sans-serif">{esc(n)}</text>'
                         f'<text x="{x + 14}" y="{y + 45:.0f}" font-size="11" fill="#3D3A33" font-family="IBM Plex Mono, monospace">{fmt(s.get("niveau"))} {esc(s.get("unite") or "")} · turns in {fmt(s.get("rotation"))} d</text>')
        else:
            o = out_val.get(n, {})
            main = n == main_out
            fill, strk, col = ("#E6F2EA", "#14705A", "#1E5E38") if main else ("#F6F4EF", "#B7B2A6", "#3D3A33")
            dest = o.get("dest") or ""
            nodes.append(f'<rect x="{x}" y="{y:.0f}" width="{w}" height="{h}" rx="10" fill="{fill}" stroke="{strk}" stroke-width="1.4"></rect>'
                         f'<text x="{x + 14}" y="{y + 21:.0f}" font-size="12.5" font-weight="600" fill="{col}" font-family="IBM Plex Sans, sans-serif">{esc(n)}</text>'
                         f'<text x="{x + 14}" y="{y + 38:.0f}" font-size="11" fill="{col}" font-family="IBM Plex Mono, monospace">{fmt(o.get("valeur"))} → {esc(dest)}</text>')
    colhead = []
    heads = {0: "Inputs"} | {c: ("Stocks" if c == 1 else "") for c in range(1, last)} | {last: "Outputs"}
    for c, t in heads.items():
        if t:
            colhead.append(f'<text x="{24 + c * COLW}" y="18" font-size="11" letter-spacing="1.2" fill="#5E5B53" font-family="IBM Plex Sans, sans-serif">{t.upper()}</text>')
    defs = ('<defs><marker id="arG" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto"><path d="M0,.5 L8,4.5 L0,8.5z" fill="#14705A"></path></marker>'
            '<marker id="arN" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto"><path d="M0,.5 L8,4.5 L0,8.5z" fill="#A8A396"></path></marker></defs>')
    induced = [x for x in outs if x.get("induite") == "yes"]
    svg = (f'<svg viewBox="0 0 {width:.0f} {H:.0f}" width="100%" role="img" aria-label="Stock and flow diagram: inputs on the left, stocks in the middle, outputs on the right, arrows labelled with weekly rates" style="display: block; max-width: {width:.0f}px">'
           + defs + "".join(colhead) + "".join(edges) + "".join(nodes) + "".join(labels) + "</svg>")
    return svg, induced


# ------------------------------------------------------------------ mechanism screen
def mech_screen(key):
    name, file = MECH[key]
    m = E["mech"][key]
    M, S = m["model"], m["summary"]
    org = {o["id"]: o for o in E["organs"]}
    obj2 = M.get("02", {})
    cur = M.get("16", {}).get("mesure")
    target, floor = obj2.get("cible"), obj2.get("plancher")
    if cur is not None and target is not None:
        status = ("#9B1C12", "Below the floor") if floor is not None and cur < floor else ("#8A3F06", "Below target") if cur < target else ("#1E5E38", "On target")
    else:
        status = ("#5E5B53", "Not measured")
    starts = [b["nom"] for b in M.get("01", []) if b["type"] == "start"]
    ends = [b["nom"] for b in M.get("01", []) if b["type"] == "end"]
    owner = M.get("05", {})
    filled = sum(1 for v in m["filled"].values() if v)
    gates_ok = sum(1 for g in m["gates"] if g["res"] and g["res"].get("ok"))
    crit = [n for n in m["notifs"] if n["sev"] == "critique"]
    att = [n for n in m["notifs"] if n["sev"] == "attention"]
    watch = [n for n in m["notifs"] if n["sev"] == "veille"]
    ev = M.get("19", [])
    hunch = sum(1 for v in ev if v.get("niveau") == "hunch") + sum(1 for c in M.get("04", []) if c.get("preuve") == "hunch")
    svg, induced = diagram(M)

    kpi = lambda big, label, sub, color=INK: (
        f'<div style="background: #FFFFFF; border: 1px solid {LINE}; border-radius: 14px; padding: 16px 18px; display: flex; flex-direction: column; gap: 6px; min-width: 0">'
        f'<div style="font-size: 13px; color: {INK3}">{label}</div>'
        f'<div style="font-family: Fraunces, Georgia, serif; font-size: 30px; line-height: 1.05; color: {color}">{big}</div>'
        f'<div style="font-size: 12px; line-height: 1.45; color: {INK3}">{sub}</div></div>')
    kpis = "".join([
        kpi(f"{fmt(cur)} <span style=\"font-size: 16px; color: {INK3}\">/ {fmt(target)}</span>", esc(obj2.get("metrique", "Objective")),
            f'<strong style="color: {status[0]}">{status[1]}</strong> · floor {fmt(floor)} · {esc(obj2.get("unite", ""))} · {esc(obj2.get("horizon", ""))}', status[0]),
        kpi(f"{m['functionsCovered']} / 5", "Functions served", f"{filled} of 21 organs filled in", "#1E5E38" if m["functionsCovered"] == 5 else "#8A3F06"),
        kpi(f"{gates_ok} / 5", "Gates passed", "Closure · conservation · non-linearity · stability · honesty", "#1E5E38" if gates_ok == 5 else "#9B1C12" if gates_ok <= 2 else "#8A3F06"),
        kpi(str(len(crit)), "Frictions", f"{len(att)} to watch closely · {len(watch)} on watch", "#9B1C12" if crit else "#1E5E38"),
        kpi(esc(owner.get("nom", "—")), "Owner", ("Can hold a refusal" if owner.get("refus") == "yes" else "Cannot hold a refusal") + " · " + esc(owner.get("autorite", ""))[:70] + ("…" if len(owner.get("autorite", "")) > 70 else "")),
    ])

    def gate_row(g):
        r = g["res"] or {}
        if r.get("ok"):
            dot, lab, col, txt = "#2E7D4F", "Passed", "#1E5E38", ""
        elif r.get("ko"):
            dot, lab, col, txt = "#B42318", "Failed", "#9B1C12", r["ko"]
        else:
            dot, lab, col, txt = "#B7B2A6", "Not assessable", INK3, r.get("ind", "")
        return (f'<div style="display: grid; grid-template-columns: 130px minmax(0, 1fr); gap: 12px; padding: 12px 0; border-top: 1px solid #EFEBE3">'
                f'<div><div style="font-size: 14px; font-weight: 600">{esc(g["name"])}</div><div style="display: inline-flex; align-items: center; gap: 6px; margin-top: 4px; font-size: 12px; font-weight: 600; color: {col}"><span style="width: 8px; height: 8px; border-radius: 50%; background: {dot}"></span>{lab}</div></div>'
                f'<div style="min-width: 0"><div style="font-family: \'IBM Plex Mono\', monospace; font-size: 12px; color: {INK2}">{esc(r.get("c", "—"))}</div>'
                + (f'<div style="font-size: 13px; line-height: 1.5; color: {INK2}; margin-top: 4px">{esc(txt)}</div>' if txt else "") + '</div></div>')

    def notif_row(n, full=True):
        sev = {"critique": ("#B42318", "Friction"), "attention": ("#B45309", "Attention"), "veille": ("#8E8A80", "Watch")}[n["sev"]]
        body = f'<div style="font-size: 13px; line-height: 1.5; color: {INK2}; margin-top: 4px">{esc(n["txt"])}</div>' if full else ""
        act = ('<a href="Decisions.dc.html" style="flex-shrink: 0; align-self: flex-start; font-size: 13px; font-weight: 600; text-decoration: none; padding: 6px 10px; border: 1px solid #E6D3A8; border-radius: 8px">Open a decision</a>'
               if n["sev"] == "critique" else "")
        orgs = " · ".join(n.get("org") or [])
        return (f'<div style="display: flex; gap: 12px; padding: 12px 0; border-top: 1px solid #EFEBE3">'
                f'<span style="width: 8px; height: 8px; border-radius: 50%; background: {sev[0]}; flex-shrink: 0; margin-top: 7px"></span>'
                f'<div style="flex-grow: 1; min-width: 0"><div style="font-size: 14px; font-weight: 600">{esc(n["titre"])}</div>'
                f'<div style="font-family: \'IBM Plex Mono\', monospace; font-size: 12px; color: {INK3}; margin-top: 2px">{esc(n.get("calc") or "")}{(" · organs " + orgs) if orgs else ""}</div>{body}</div>{act}</div>')

    fn_blocks = []
    for fkey, fname, verb, fdesc in E["functions"]:
        col = FN_COLOR[fkey]
        cards = []
        for o in E["organs"]:
            if FN_KEY[o["fam"]] != fkey:
                continue
            summ = S.get(o["id"]) or ""
            ok = m["filled"][o["id"]]
            ty = TY[o["ty"]][0]
            cards.append(
                f'<button type="button" onClick="{{{{open.o{o["id"]}}}}}" aria-haspopup="dialog" style="display: flex; flex-direction: column; gap: 6px; min-height: 108px; padding: 14px 16px; border: 1px solid {LINE}; border-radius: 12px; background: #FFFFFF; font: inherit; color: {INK}; text-align: left; cursor: pointer">'
                f'<span style="display: flex; align-items: center; gap: 8px; width: 100%"><span style="font-family: \'IBM Plex Mono\', monospace; font-size: 12px; color: {col}; font-weight: 500">{o["id"]}</span>'
                f'<span style="font-size: 15px; font-weight: 600; flex-grow: 1">{esc(o["name"])}</span>'
                f'<span style="font-size: 11px; padding: 2px 7px; border-radius: 5px; background: {PAPER}; color: {INK3}">{ty}</span></span>'
                + (f'<span style="font-size: 13px; line-height: 1.45; color: {INK2}; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden">{esc(summ)}</span>' if (ok and summ)
                   else f'<span style="font-size: 13px; color: {INK2}">Filled in · open for details</span>' if ok
                   else '<span style="font-size: 13px; font-weight: 600; color: #8A3F06">Not filled in</span>')
                + '</button>')
        fn_blocks.append(
            f'<div style="display: flex; flex-direction: column; gap: 10px">'
            f'<div style="display: flex; align-items: baseline; gap: 12px; padding-bottom: 6px; border-bottom: 2px solid {col}">'
            f'<h3 style="margin: 0; font-size: 15px; font-weight: 600; color: {col}">{esc(fname)}</h3><span style="font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; color: {INK3}">{esc(verb)}</span>'
            f'<span style="font-size: 13px; color: {INK3}; margin-left: 8px">{esc(fdesc)}</span></div>'
            f'<div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px">{"".join(cards)}</div></div>')

    induced_html = ""
    if induced:
        chips = "".join(f'<span style="display: inline-flex; gap: 8px; align-items: baseline; padding: 6px 12px; border: 1px dashed #B7B2A6; border-radius: 8px; font-size: 13px">'
                        f'<strong style="font-weight: 600">{esc(x["nom"])}</strong><span style="font-family: \'IBM Plex Mono\', monospace; font-size: 12px; color: {INK3}">{fmt(x["valeur"])} → {esc(x["dest"])}</span></span>' for x in induced)
        induced_html = f'<div style="display: flex; flex-wrap: wrap; gap: 8px; align-items: center"><span style="font-size: 12px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: {INK3}; margin-right: 4px">Induced outputs</span>{chips}</div>'

    body = f"""
<header style="display: flex; flex-direction: column; gap: 8px">
<div style="font-size: 14px; color: {INK3}">Mechanism · Knowledge System · 21 organs across 5 functions</div>
<h1 style="margin: 0; font-family: Fraunces, Georgia, serif; font-size: 40px; font-weight: 500">{esc(name)}</h1>
<div style="display: flex; flex-wrap: wrap; gap: 8px 20px; font-size: 14px; color: {INK2}">
<span><strong style="color: {INK}">Starts when</strong> {esc(" · ".join(starts))}</span>
<span><strong style="color: {INK}">Ends when</strong> {esc(" · or · ".join(ends))}</span>
</div>
</header>

<div style="display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 12px">{kpis}</div>

<section aria-labelledby="flow" style="background: #FFFFFF; border: 1px solid {LINE}; border-radius: 14px; padding: 22px 24px; display: flex; flex-direction: column; gap: 14px">
<div style="display: flex; justify-content: space-between; align-items: baseline; gap: 16px; flex-wrap: wrap">
<h2 id="flow" style="margin: 0; font-family: Fraunces, Georgia, serif; font-size: 22px; font-weight: 500">Stocks and flows</h2>
<span style="font-size: 13px; color: {INK3}">What enters, accumulates and leaves, per week. Green = the path to the next mechanism.</span>
</div>
<div style="overflow-x: auto">{svg}</div>
{induced_html}
</section>

<div style="display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.25fr); gap: 16px; align-items: start">
<section aria-labelledby="gates" style="background: #FFFFFF; border: 1px solid {LINE}; border-radius: 14px; padding: 22px 24px">
<div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 6px"><h2 id="gates" style="margin: 0; font-family: Fraunces, Georgia, serif; font-size: 22px; font-weight: 500">Gates</h2><span style="font-size: 13px; color: {INK3}">{gates_ok} of 5 passed</span></div>
<div style="font-size: 13px; color: {INK3}; margin-bottom: 6px">A model that fails a gate cannot be trusted to choose an iteration.</div>
{"".join(gate_row(g) for g in m["gates"])}
</section>
<section aria-labelledby="diag" style="background: #FFFFFF; border: 1px solid {LINE}; border-radius: 14px; padding: 22px 24px">
<div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 6px"><h2 id="diag" style="margin: 0; font-family: Fraunces, Georgia, serif; font-size: 22px; font-weight: 500">Diagnosis</h2><span style="font-size: 13px; color: {INK3}">{len(crit)} frictions · {len(att)} attention · {len(watch)} watch</span></div>
<div style="font-size: 13px; color: {INK3}; margin-bottom: 6px">Each friction is a candidate decision: open it in Decisions and test one lever at a time.</div>
{"".join(notif_row(n) for n in crit + att)}
<details style="margin-top: 8px"><summary style="cursor: pointer; font-size: 14px; font-weight: 600; padding: 10px 0; color: #9A6614">Show the {len(watch)} watch items</summary>
{"".join(notif_row(n, full=False) for n in watch)}
</details>
</section>
</div>

<section aria-labelledby="organs" style="display: flex; flex-direction: column; gap: 18px">
<div style="display: flex; justify-content: space-between; align-items: baseline; gap: 16px">
<h2 id="organs" style="margin: 0; font-family: Fraunces, Georgia, serif; font-size: 22px; font-weight: 500">The 21 organs</h2>
<span style="font-size: 13px; color: {INK3}">Click an organ to see its content, why it matters and its rules</span>
</div>
{"".join(fn_blocks)}
</section>
</main>
"""

    popup = """
<sc-if value="{{hasOrgan}}" hint-placeholder-val="{{false}}">
<div data-overlay="info" style="position: absolute; inset: 0; background: rgba(27,27,24,0.55); display: flex; justify-content: center; align-items: flex-start; padding-top: 40px; overflow: auto; z-index: 50">
<div role="dialog" aria-modal="true" aria-labelledby="org-title" style="width: 860px; max-width: calc(100% - 48px); box-sizing: border-box; background: #FFFFFF; border-radius: 16px; padding: 28px 32px; display: flex; flex-direction: column; gap: 18px; box-shadow: 0 24px 64px rgba(0,0,0,0.28)">
<div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 16px">
<div><div style="font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; color: {{og.color}}">{{og.fn}} · organ {{og.id}} · {{og.ty}}</div><h2 id="org-title" style="margin: 6px 0 0; font-family: Fraunces, Georgia, serif; font-size: 30px; font-weight: 500">{{og.name}}</h2><div style="font-size: 13px; color: #5E5B53; margin-top: 4px">{{og.tyHint}}</div></div>
<button type="button" onClick="{{closeOrgan}}" aria-label="Close" style="width: 44px; height: 44px; flex-shrink: 0; border-radius: 50%; border: 1px solid #D8D3C7; background: #FFFFFF; color: #1B1B18; font: inherit; font-size: 22px; line-height: 1; cursor: pointer">×</button>
</div>
<div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px">
<div style="padding: 14px 16px; border-radius: 12px; background: #F6F4EF"><div style="font-size: 12px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: #5E5B53; margin-bottom: 6px">Why it matters</div><div style="font-size: 14px; line-height: 1.55; color: #3D3A33">{{og.why}}</div></div>
<div style="padding: 14px 16px; border-radius: 12px; background: #F6F4EF"><div style="font-size: 12px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: #5E5B53; margin-bottom: 6px">How to fill it in</div><div style="font-size: 14px; line-height: 1.55; color: #3D3A33">{{og.how}}</div></div>
</div>
<div style="display: flex; flex-direction: column; gap: 8px">
<div style="font-size: 12px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: #5E5B53">Content in this mechanism</div>
<sc-if value="{{og.empty}}" hint-placeholder-val="{{false}}"><div style="font-size: 14px; font-weight: 600; color: #8A3F06">Not filled in yet.</div></sc-if>
<sc-if value="{{og.isList}}" hint-placeholder-val="{{true}}">
<div style="overflow-x: auto; border: 1px solid #E3DFD5; border-radius: 10px">
<div style="display: grid; grid-template-columns: {{og.grid}}; gap: 10px; padding: 9px 12px; background: #FAF8F3; border-bottom: 1px solid #E3DFD5; font-size: 11px; letter-spacing: 0.04em; text-transform: uppercase; color: #5E5B53">
<sc-for list="{{og.cols}}" as="c" hint-placeholder-count="3"><span>{{c}}</span></sc-for>
</div>
<sc-for list="{{og.rows}}" as="r" hint-placeholder-count="3">
<div style="display: grid; grid-template-columns: {{og.grid}}; gap: 10px; padding: 10px 12px; border-top: 1px solid #EFEBE3; font-size: 13px; line-height: 1.45">
<sc-for list="{{r.cells}}" as="v" hint-placeholder-count="3"><span style="min-width: 0">{{v}}</span></sc-for>
</div>
</sc-for>
</div>
</sc-if>
<sc-if value="{{og.isFields}}" hint-placeholder-val="{{false}}">
<div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px">
<sc-for list="{{og.fields}}" as="fl" hint-placeholder-count="3"><div style="padding: 10px 12px; border: 1px solid #E3DFD5; border-radius: 10px"><div style="font-size: 12px; color: #5E5B53">{{fl.l}}</div><div style="font-size: 14px; font-weight: 600; margin-top: 3px">{{fl.v}}</div></div></sc-for>
</div>
</sc-if>
</div>
<div style="display: flex; flex-direction: column; gap: 8px">
<div style="font-size: 12px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: #5E5B53">Rules</div>
<ul style="margin: 0; padding-left: 20px; display: flex; flex-direction: column; gap: 6px; font-size: 14px; line-height: 1.5; color: #3D3A33"><sc-for list="{{og.rules}}" as="rl" hint-placeholder-count="3"><li>{{rl}}</li></sc-for></ul>
</div>
<button type="button" onClick="{{closeOrgan}}" style="align-self: flex-end; min-height: 44px; padding: 0 22px; border: 0; border-radius: 10px; background: #1B1B18; color: #FFFFFF; font: inherit; font-size: 15px; font-weight: 600; cursor: pointer">Done</button>
</div>
</div>
</sc-if>
"""

    info = info_popup(esc(name) + " mechanism",
        f"This page models the {esc(name)} mechanism with the Iteration system: 21 organs spread across 5 functions (frame, matter, machinery, control, epistemic). From that model the page computes the stocks and flows, checks 5 gates, and lists the frictions that should become decisions.",
        ["<strong style=\"color: #1B1B18\">You act on causes, not symptoms.</strong> The diagnosis points to the organ that limits the result, so effort goes to the one lever that matters.",
         "<strong style=\"color: #1B1B18\">No iteration on a broken model.</strong> The gates stop you from testing a lever while the model leaks units or corrects faster than the system can answer.",
         "<strong style=\"color: #1B1B18\">Facts are separated from hunches.</strong> Every value carries its evidence level, so nobody defends a guess with the confidence of a measurement.",
         "<strong style=\"color: #1B1B18\">One shared picture.</strong> Anyone can read how the mechanism works, who owns which lever and what is deliberately left out."],
        ["Check the objective card: the current value against the target and the floor.",
         "Read the stocks and flows from left to right: where units pile up and where they leave.",
         "Fix failed gates first: a model that fails a gate cannot choose a good iteration.",
         "Take the top friction and open a decision: one lever, one test, one verdict.",
         "Click any organ to see its content, why it matters and the rules for filling it in.",
         "After each test, update the organs it changed: the model improves with every cycle."])

    # data for the organ popup
    org_data = {}
    for o in E["organs"]:
        v = M.get(o["id"])
        fam = FN_KEY[o["fam"]]
        d = {"id": o["id"], "name": o["name"], "fn": next(f[1] for f in E["functions"] if f[0] == fam), "color": FN_COLOR[fam],
             "ty": TY[o["ty"]][0], "tyHint": TY[o["ty"]][1], "why": o["why"], "how": o["how"], "rules": o["rules"],
             "cols": [c["l"] for c in o["cols"]], "isList": o["list"], "isFields": not o["list"]}
        if o["list"]:
            rows = v if isinstance(v, list) else []
            d["rows"] = [{"cells": [fmt(r.get(c["k"])) for c in o["cols"]]} for r in rows]
            d["empty"] = len(rows) == 0
            d["isList"] = len(rows) > 0
            n = len(o["cols"])
            d["grid"] = "minmax(160px, 1.8fr) " + " ".join(["minmax(80px, 1fr)"] * (n - 1)) if n > 1 else "minmax(0, 1fr)"
        else:
            vv = v if isinstance(v, dict) else {}
            d["fields"] = [{"l": c["l"], "v": fmt(vv.get(c["k"]))} for c in o["cols"]]
            d["empty"] = not any(vv.get(c["k"]) not in (None, "") for c in o["cols"])
            d["isFields"] = not d["empty"]
        org_data[o["id"]] = d
    js = f"""<script type="text/x-dc" data-dc-script data-props='{{"$preview":{{"width":1440,"height":2900}}}}'>
class Component extends DCLogic {{
  constructor(props) {{
    super(props);
    this.state = {{ info: false, edit: null }};
  }}
  organs() {{
    return {json.dumps(org_data, ensure_ascii=False)};
  }}
  renderVals() {{
    const s = this.state;
    const all = this.organs();
    const open = {{}};
    Object.keys(all).forEach(id => {{ open['o' + id] = () => this.setState({{ edit: id }}); }});
    const og = s.edit ? all[s.edit] : null;
    return {{
      info: !!s.info,
      openInfo: () => this.setState({{ info: true }}),
      closeInfo: () => this.setState({{ info: false }}),
      open,
      hasOrgan: !!og,
      og: og || {{}},
      closeOrgan: () => this.setState({{ edit: null }})
    }};
  }}
}}
</script>
</body>
</html>
"""
    page = (HEAD.format(title=f"SKL KS — {esc(name)}", h=2900, footer="Q4 2026 · week 3/13<br>Model from the Iteration system")
            + body + INFO_BTN + popup + info + "</div>\n</x-dc>\n" + js)
    (OUT / file).write_text(page, encoding="utf-8")
    print("wrote", file, len(page))


# ------------------------------------------------------------------ registers screen
def registers_screen():
    seed = R["seed"]
    # lines read off the Sales sheet, the way the seed was read off Pre-call
    sales = E["mech"]["sales"]["model"]
    for c in sales.get("04", []):
        seed["ressources"].append({"nom": c["nom"], "nature": c.get("nature", ""), "unite": c.get("unite", ""), "borne": c.get("borne"),
                                   "charge": c.get("charge"), "seuil": c.get("seuil"), "puisent": "Sales", "note": "From the Sales sheet · evidence: " + str(c.get("preuve", ""))})
    o5 = sales.get("05", {})
    seed["acteurs"].append({"nom": o5.get("nom", ""), "role": "Owns the mechanism", "leviers": " · ".join(x["nom"] for x in sales.get("11", [])),
                            "rouages": "Sales", "note": "From the Sales sheet", "refus": o5.get("refus", "")})
    for d in sales.get("07", []):
        if d.get("gravite") == "high":
            seed["evenements"].append({"date": "", "nom": d["nom"], "rompt": "Show and close comparisons before and after. Listed as a high-severity observable disturbance in Sales", "rouages": "Sales"})
    seed["interfaces"].append({"point": "Closed", "de": "Sales", "part": "100 %", "vers": "Onboarding", "mode": "duplication", "debit": 14, "unite": "week",
                               "def": "From the Sales sheet — onboarding load is an induced output nobody counts yet"})
    regs = []
    for r in R["registers"]:
        rows = []
        for line in seed[r["id"]]:
            cells = []
            for c in r["cols"]:
                v = line.get(c["k"], "")
                cell = {"v": fmt(v), "link": "", "bar": False, "todo": isinstance(v, str) and (v.startswith("TO ARBITRATE") or v.startswith("FILL IN") or v.startswith("CONFIRM") or v.startswith("CHECK"))}
                if c["t"] in ("mec1", "mecs") and str(v) in MECH_HREF:
                    cell["link"] = MECH_HREF[str(v)]
                cells.append(cell)
            if r["id"] == "ressources":
                try:
                    b, ch, th = float(line.get("borne") or 0), float(line.get("charge") or 0), line.get("seuil")
                    nat = line.get("nature", "")
                    if b and nat in ("throughput", "threshold", "stock threshold"):
                        pct = ch / b
                        # throughput: alert when load reaches the threshold; threshold: alert when the headroom left falls to it
                        alert = th not in ("", None) and (ch >= float(th) if nat == "throughput" else (b - ch) <= float(th))
                        rows.append({"cells": cells, "load": f"{round(pct * 100)}%", "pct": min(100, round(pct * 100)), "alert": alert})
                        continue
                except (TypeError, ValueError):
                    pass
                rows.append({"cells": cells, "load": "", "pct": 0, "alert": False})
            else:
                rows.append({"cells": cells})
        n = len(r["cols"])
        widths = " ".join(f"minmax(90px, {c['w'].rstrip('%')}fr)" for c in r["cols"])
        regs.append({"id": r["id"], "name": r["nom"], "sub": r["sous"], "what": r["quoi"], "detects": r["detecte"], "filter": r["filtre"], "when": r["quand"],
                     "cols": [c["l"] for c in r["cols"]], "grid": widths, "rows": rows, "count": len(rows)})

    body = """
<header style="display: flex; justify-content: space-between; align-items: flex-end; gap: 24px; flex-wrap: wrap">
<div>
<div style="font-size: 14px; color: #5E5B53; margin-bottom: 6px">Settings · what connects the mechanisms</div>
<h1 style="margin: 0; font-family: Fraunces, Georgia, serif; font-size: 40px; font-weight: 500">Registers</h1>
</div>
<div style="font-size: 13px; color: #5E5B53; max-width: 520px; line-height: 1.5">A mechanism sheet describes one mechanism. Registers hold what belongs to several at once, so it is written once and nobody has to reconcile two copies.</div>
</header>

<div role="tablist" aria-label="Registers" style="display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px">
<sc-for list="{{tabs}}" as="t" hint-placeholder-count="4">
<button type="button" role="tab" aria-selected="{{t.on}}" onClick="{{t.go}}" style="{{t.style}}">
<span style="display: flex; justify-content: space-between; align-items: baseline; gap: 8px"><span style="font-size: 16px; font-weight: 600">{{t.name}}</span><span style="font-family: 'IBM Plex Mono', monospace; font-size: 13px">{{t.count}}</span></span>
<span style="display: block; font-size: 12px; margin-top: 4px; opacity: 0.8">{{t.sub}}</span>
</button>
</sc-for>
</div>

<section aria-labelledby="reg" style="background: #FFFFFF; border: 1px solid #E3DFD5; border-radius: 14px; padding: 22px 24px; display: flex; flex-direction: column; gap: 18px">
<div style="display: flex; justify-content: space-between; align-items: baseline; gap: 16px">
<h2 id="reg" style="margin: 0; font-family: Fraunces, Georgia, serif; font-size: 24px; font-weight: 500">{{r.name}}</h2>
<span style="font-size: 13px; color: #5E5B53">{{r.count}} lines · items to settle are highlighted</span>
</div>
<div style="display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px">
<div style="padding: 12px 14px; border-radius: 10px; background: #F6F4EF"><div style="font-size: 11px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: #5E5B53; margin-bottom: 4px">What it holds</div><div style="font-size: 13px; line-height: 1.5; color: #3D3A33">{{r.what}}</div></div>
<div style="padding: 12px 14px; border-radius: 10px; background: #F6F4EF"><div style="font-size: 11px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: #5E5B53; margin-bottom: 4px">What it detects</div><div style="font-size: 13px; line-height: 1.5; color: #3D3A33">{{r.detects}}</div></div>
<div style="padding: 12px 14px; border-radius: 10px; background: #FDF1E3"><div style="font-size: 11px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: #8A3F06; margin-bottom: 4px">Filter on iterations</div><div style="font-size: 13px; line-height: 1.5; color: #6B3205">{{r.filter}}</div></div>
<div style="padding: 12px 14px; border-radius: 10px; background: #F6F4EF"><div style="font-size: 11px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: #5E5B53; margin-bottom: 4px">When to fill it in</div><div style="font-size: 13px; line-height: 1.5; color: #3D3A33">{{r.when}}</div></div>
</div>
<div style="overflow-x: auto; border: 1px solid #E3DFD5; border-radius: 10px">
<div style="min-width: 900px">
<div style="display: grid; grid-template-columns: {{r.grid}}; gap: 12px; padding: 10px 14px; background: #FAF8F3; border-bottom: 1px solid #E3DFD5; font-size: 11px; letter-spacing: 0.05em; text-transform: uppercase; color: #5E5B53">
<sc-for list="{{r.cols}}" as="c" hint-placeholder-count="4"><span>{{c}}</span></sc-for>
</div>
<sc-for list="{{r.rows}}" as="row" hint-placeholder-count="4">
<div style="display: grid; grid-template-columns: {{r.grid}}; gap: 12px; align-items: start; padding: 12px 14px; border-top: 1px solid #EFEBE3; font-size: 13px; line-height: 1.45">
<sc-for list="{{row.cells}}" as="cell" hint-placeholder-count="4">
<span style="{{cell.style}}"><sc-if value="{{cell.hasLink}}" hint-placeholder-val="{{false}}"><a href="{{cell.link}}" style="font-weight: 600; text-decoration: none">{{cell.v}}</a></sc-if><sc-if value="{{cell.plain}}" hint-placeholder-val="{{true}}">{{cell.v}}</sc-if><sc-if value="{{cell.showBar}}" hint-placeholder-val="{{false}}"><span style="display: block; margin-top: 6px; height: 6px; border-radius: 3px; background: #ECE8DF"><span style="{{cell.barStyle}}"></span></span><span style="display: block; margin-top: 3px; font-family: 'IBM Plex Mono', monospace; font-size: 11px; color: {{cell.barColor}}">{{cell.barLabel}}</span></sc-if></span>
</sc-for>
</div>
</sc-for>
</div>
</div>
<button type="button" style="align-self: flex-start; min-height: 40px; padding: 0 14px; border: 1px dashed #B7B2A6; border-radius: 10px; background: #FFFFFF; color: #9A6614; font: inherit; font-size: 14px; font-weight: 600; cursor: pointer">+ Add a line</button>
</section>
</main>
"""
    info = info_popup("Registers",
        "Registers hold what several mechanisms share: the interfaces where one mechanism hands units to the next, the resources they compete for, the events that break comparisons, and the people who own the levers. A mechanism sheet describes one mechanism; a register describes what sits between them.",
        ["<strong style=\"color: #1B1B18\">No orphan leaks.</strong> If Pre-call sends 61 shows and Sales counts 90 bookings, the Interfaces register shows the gap nobody owns.",
         "<strong style=\"color: #1B1B18\">Hidden contention becomes visible.</strong> Two mechanisms that slow down together often share a saturated resource with no arrow between them.",
         "<strong style=\"color: #1B1B18\">Honest comparisons.</strong> The Events register tells you which before/after comparison is no longer valid.",
         "<strong style=\"color: #1B1B18\">The real human bottleneck.</strong> The Owners register shows how many levers depend on the same two or three people."],
        ["Pick a register with the four tabs at the top.",
         "Read the four boxes: what the register holds, what it detects, how it filters iterations and when to fill it in.",
         "Settle the highlighted lines first: they are open questions written as TO ARBITRATE, CONFIRM or FILL IN.",
         "Watch the Resources load bars: a resource past its alert threshold blocks any iteration that adds volume.",
         "Log an event the day it happens: it takes thirty seconds and saves a wrong conclusion.",
         "Click a mechanism name to open its model in the Knowledge System."])
    js = f"""<script type="text/x-dc" data-dc-script data-props='{{"$preview":{{"width":1440,"height":1500}}}}'>
class Component extends DCLogic {{
  constructor(props) {{
    super(props);
    this.state = {{ info: false, tab: 'interfaces' }};
  }}
  regs() {{
    return {json.dumps(regs, ensure_ascii=False)};
  }}
  renderVals() {{
    const s = this.state;
    const all = this.regs();
    const tabBase = 'min-height: 72px; padding: 12px 16px; border-radius: 12px; font: inherit; text-align: left; cursor: pointer; ';
    const tabs = all.map(r => ({{
      name: r.name, sub: r.sub, count: r.count, on: r.id === s.tab,
      style: tabBase + (r.id === s.tab ? 'border: 2px solid #1B1B18; background: #1B1B18; color: #FFFFFF;' : 'border: 1px solid #D8D3C7; background: #FFFFFF; color: #1B1B18;'),
      go: () => this.setState({{ tab: r.id }})
    }}));
    const cur = all.find(r => r.id === s.tab) || all[0];
    const loadCol = cur.cols.indexOf('Load');
    const r = Object.assign({{}}, cur, {{
      rows: cur.rows.map(row => ({{
        cells: row.cells.map((c, i) => {{
          const bar = i === loadCol && !!row.load;
          return {{
            v: c.v, link: c.link, hasLink: !!c.link, plain: !c.link,
            style: 'min-width: 0; ' + (c.todo ? 'padding: 4px 8px; border-radius: 6px; background: #FDF1E3; color: #6B3205;' : ''),
            showBar: bar,
            barStyle: bar ? 'display: block; height: 6px; border-radius: 3px; width: ' + row.pct + '%; background: ' + (row.alert ? '#B42318' : '#2E7D4F') + ';' : '',
            barColor: row.alert ? '#9B1C12' : '#1E5E38',
            barLabel: bar ? row.load + (row.alert ? ' · alert' : '') : ''
          }};
        }})
      }}))
    }});
    return {{
      info: !!s.info,
      openInfo: () => this.setState({{ info: true }}),
      closeInfo: () => this.setState({{ info: false }}),
      tabs, r
    }};
  }}
}}
</script>
</body>
</html>
"""
    page = HEAD.format(title="SKL OS — Registers", h=1500, footer="Q4 2026 · week 3/13<br>Registers from the Iteration system") + body + INFO_BTN + info + "</div>\n</x-dc>\n" + js
    (OUT / "Registers.dc.html").write_text(page, encoding="utf-8")
    print("wrote Registers.dc.html", len(page))


for k in MECH:
    mech_screen(k)
registers_screen()
