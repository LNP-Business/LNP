"""Assemble the 4 SKL OS screens (Design-canvas .dc.html files) into one standalone prototype page."""
import re, pathlib, sys, json

HERE = pathlib.Path(__file__).resolve().parent
LANG = sys.argv[1] if len(sys.argv) > 1 else "fr"
SRC = HERE.parent / ("skl-en" if LANG == "en" else "skl") / "project"
OUT = HERE / ("skl-os-en.html" if LANG == "en" else "skl-os.html")
TITLE = "SKL OS English" if LANG == "en" else "SKL OS"
_ed = HERE.parent / "edition.json"
EDITION = json.load(open(_ed, encoding="utf-8")) if _ed.exists() else {}
TITLE = EDITION.get("title", TITLE)
# screens kept by the edition: its systems' screens and its Settings screens (None = every screen)
_SYS = {"os": ["cockpit", "review", "build", "execute", "decisions"], "ss": ["salescockpit", "salesday", "crm"]}
EDITION_KEEP = (sum((_SYS.get(x, []) for x in EDITION.get("systems", [])), []) + [f.replace(".dc.html", "").lower() for f in EDITION.get("settings", [])]) if EDITION else None

SCREENS = [
    ("cockpit", "Main"),
    ("review", "Review"),
    ("build", "Build"),
    ("execute", "Execute"),
    ("decisions", "Decisions"),
    ("crm", "CRM"),
    ("bibliotheque", "Bibliotheque"),
    ("mechanisms", "Mechanisms"),
    ("settings", "Settings"),
    ("registers", "Registers"),
    ("mechprecall", "MechPrecall"),
    ("mechsales", "MechSales"),
    ("mechos", "MechOS"),
    ("cartomap", "CartoMap"),
    ("cartoevents", "CartoEvents"),
    ("cartoworks", "CartoWorks"),
    ("cartosim", "CartoSim"),
    ("cartomodel", "CartoModel"),
    ("agentsoverview", "AgentsOverview"),
    ("agentsdecisions", "AgentsDecisions"),
    ("agentsregistry", "AgentsRegistry"),
    ("agentstriggers", "AgentsTriggers"),
    ("agentslog", "AgentsLog"),
    ("access", "Access"),
    ("account", "Account"),
    ("salescockpit", "SalesCockpit"),
    ("salesday", "SalesDay"),
]

templates, classes = [], []
SHELL_ARIA = [('aria-label="Main navigation"', 'aria-label="Navigation principale"'), ('aria-label="Switch system"', 'aria-label="Changer de système"'),
              ('aria-label="Views"', 'aria-label="Vues"'),
              # the round "i" button and its popup on every screen, also on the screens written before (CRM.dc.html, gen_crm.py)
              ('aria-label="How this page works" title="How this page works"', 'aria-label="Mode d’emploi de la page" title="Mode d’emploi de la page"'),
              ('>Page method</div>', '>Mode d’emploi</div>'), ('aria-label="Close"', 'aria-label="Fermer"'), ('>Got it</button>', '>Compris</button>')]
for sid, fname in SCREENS:
    if not (SRC / f"{fname}.dc.html").exists():
        continue
    src = (SRC / f"{fname}.dc.html").read_text(encoding="utf-8")
    body = src.split("</helmet>", 1)[1].split("</x-dc>", 1)[0].strip()
    # the root frame grows with its content instead of the canvas's fixed artboard height
    body, nroot = re.subn(r'<div style="position: relative; width: \d+px; height: \d+px;', '<div data-root style="position: relative; width: 100%; min-width: 1440px; box-sizing: border-box;', body, count=1)
    assert nroot == 1, fname
    # the methodology popup covers the viewport, wherever the viewer has scrolled
    body = body.replace('data-overlay="info" style="position: absolute;', 'data-overlay="info" style="position: fixed;')
    assert "</template>" not in body
    # LNP is in French (Romain 2026-11-03): the shell's landmarks (read aloud by screen readers) and the Page method button and
    # popup. The generators find the sidebar by its English label (nav.py, gen_crm.py), so it is translated here, in the page only.
    for a, z in SHELL_ARIA:
        body = body.replace(a, z)
    templates.append(f'<template id="tpl-{sid}" data-file="{fname}.dc.html">\n{body}\n</template>')
    script = src.split("data-dc-script", 1)[1].split(">", 1)[1].split("</script>", 1)[0].strip()
    assert script.startswith("class Component extends DCLogic")
    classes.append(f'SCREENS["{sid}"] = (function () {{\n{script}\nreturn Component;\n}})();')

STOREJS = ""
if LANG == "en" and (HERE / "store.js").exists():
    STOREJS = ("<script>window.SKL_SEED = " + (HERE / "seed.json").read_text(encoding="utf-8").replace("</", "<\\/") + ";</script>\n"
               + "<script>" + (HERE / "store.js").read_text(encoding="utf-8") + "</script>\n"
               + "<script>" + (HERE / "kr_view.js").read_text(encoding="utf-8").replace("</", "<\\/") + "</script>\n"
               + "<script>" + (HERE / "crm" / "data.js").read_text(encoding="utf-8").replace("</", "<\\/") + "</script>")
MECH = HERE.parent / "mechapp" / "dist" / "mech.js"
CRMDOC = HERE / "crm_doc.html"
CRMJS = ""
if LANG == "en" and CRMDOC.exists():
    CRMJS = "<script>window.SKL_CRM_DOC = " + json.dumps(CRMDOC.read_text(encoding="utf-8")).replace("</", "<\\/") + ";</script>"
    CV2 = HERE / "cockpit_v2.json"
    if CV2.exists():
        cv = json.loads(CV2.read_text(encoding="utf-8"))
        for key, name in (("ov", "SKL_OV"), ("kr", "SKL_KRROOM"), ("mkt", "SKL_MKT"), ("fin", "SKL_FIN")):
            m = cv[key]
            CRMJS += ("\n<script>window." + name + " = {css: " + json.dumps(m["css"]).replace("</", "<\\/") + ", html: " + json.dumps(m["html"]).replace("</", "<\\/")
                      + ", mount: " + m["js"].replace("</", "<\\/") + "};</script>")
    # Build and Execute: one core (window.SKL_OS2), two modules (gen_build.py, gen_execute.py)
    for fname, name in (("build.json", "SKL_BUILD"), ("execute.json", "SKL_EXECUTE")):
        MJ = HERE / fname
        if MJ.exists():
            m = json.loads(MJ.read_text(encoding="utf-8"))
            if m.get("core"):
                CRMJS += "\n<script>" + m["core"].replace("</", "<\\/") + "</script>"
            CRMJS += ("\n<script>window." + name + " = {css: " + json.dumps(m["css"]).replace("</", "<\\/") + ", html: " + json.dumps(m["html"]).replace("</", "<\\/")
                      + ", mount: " + m["js"].replace("</", "<\\/") + "};</script>")
    SDJ = HERE / "salesday_module.js"
    if SDJ.exists():
        CRMJS += "\n<script>" + SDJ.read_text(encoding="utf-8").replace("</", "<\\/") + "</script>"
    AGJ = HERE / "agents_module.js"
    if AGJ.exists():
        CRMJS += "\n<script>" + AGJ.read_text(encoding="utf-8").replace("</", "<\\/") + "</script>"
    CJ = HERE / "carto.json"
    if CJ.exists():
        m = json.loads(CJ.read_text(encoding="utf-8"))
        CRMJS += ("\n<script>window.SKL_CARTO = {css: " + json.dumps(m["css"]).replace("</", "<\\/") + ", html: " + json.dumps(m["html"]).replace("</", "<\\/")
                  + ", mount: " + m["js"].replace("</", "<\\/") + "};</script>")
    SALESV2 = HERE / "sales_v2.json"
    if SALESV2.exists():
        sv = json.loads(SALESV2.read_text(encoding="utf-8"))
        CRMJS += ("\n<script>window.SKL_SALES = {css: " + json.dumps(sv["css"]).replace("</", "<\\/") + ", html: " + json.dumps(sv["html"]).replace("</", "<\\/")
                  + ", mount: " + sv["js"].replace("</", "<\\/") + "};</script>")
MECHJS = ("<script>" + MECH.read_text(encoding="utf-8") + "</script>") if (LANG == "en" and MECH.exists()) else ""
page = f"""<title>{TITLE}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,500;0,9..144,600;1,9..144,600&amp;family=IBM+Plex+Sans:wght@400;500;600;700&amp;family=IBM+Plex+Mono:wght@400;500;600&amp;display=swap">
<style>
/* Single light product UI, as designed in the SKL OS canvas: warm paper ground, ink sidebar, blue action. */
:root {{
  color-scheme: light;
  --paper: #F6F4EF;
  --ink: #1B1B18;
  --action: #9A6614;
  --action-strong: #7A4B00;
}}
html, body {{ background: var(--paper); color: var(--ink); }}
body {{ margin: 0; font-family: 'IBM Plex Sans', system-ui, -apple-system, 'Segoe UI', sans-serif; }}
a {{ color: var(--action); }}
a:hover {{ color: var(--action-strong); }}
#app {{ overflow-x: clip; }}
/* admin-only entries (Settings › Access): shown only when the web edition signs in an admin */
html:not(.skl-admin) [data-admin-only] {{ display: none !important; }}
#app :focus-visible {{ outline: 3px solid var(--action); outline-offset: 2px; }}
/* The sidebar stays on screen while the page scrolls, so Settings is always in the bottom-left corner */
[data-navgrp]:hover {{ color: #E8E4DA !important; background: #2C2B26 !important; }}
[data-navgrp]:focus-visible {{ outline: 2px solid #D9B46A; outline-offset: 2px; }}
[data-root] > nav {{ position: sticky; top: 0; align-self: flex-start; height: var(--screen-h, 100vh); overflow-y: auto; }}
#app input[style*="background: #1B1B18"]::placeholder, #app textarea[style*="background: #1B1B18"]::placeholder {{ color: #B7B2A6; opacity: 1; }}
#app select[style*="background: #1B1B18"] {{ color-scheme: dark; }}
@media (prefers-reduced-motion: reduce) {{ * {{ scroll-behavior: auto !important; }} }}
</style>

<div id="app" aria-live="polite"></div>

{chr(10).join(templates)}

{STOREJS}
{MECHJS}
{CRMJS}
<script>
(function () {{
  "use strict";
  var app = document.getElementById("app");
  try {{ document.documentElement.lang = "fr"; }} catch (e) {{}}   // LNP is in French (Romain 2026-11-03)
  var SCREENS = {{}};
  var instances = {{}};
  var current = "cockpit";
  var fileToScreen = {{}};

  function DCLogic(props) {{ this.props = props || {{}}; this.state = {{}}; }}
  DCLogic.prototype.setState = function (patch) {{
    var next = typeof patch === "function" ? patch(this.state, this.props) : patch;
    this.state = Object.assign({{}}, this.state, next);
    render();
  }};
  DCLogic.prototype.forceUpdate = function () {{ render(); }};

  // Each screen's own logic, exactly as authored in the canvas
  (function (DCLogic, SCREENS) {{
{chr(10).join(classes)}
  }})(DCLogic, SCREENS);

  var HOLE = /\\{{\\{{\\s*([^}}]+?)\\s*\\}}\\}}/g;
  var ONLY_HOLE = /^\\s*\\{{\\{{\\s*([^}}]+?)\\s*\\}}\\}}\\s*$/;

  function lookup(path, scope) {{
    path = path.trim();
    if (path === "true") return true;
    if (path === "false") return false;
    if (path === "null") return null;
    if (/^-?\\d+(\\.\\d+)?$/.test(path)) return Number(path);
    if (/^(['"]).*\\1$/.test(path)) return path.slice(1, -1);
    var parts = path.split("."), v = scope;
    for (var i = 0; i < parts.length; i++) {{
      if (v === null || v === undefined) return undefined;
      v = v[parts[i]];
    }}
    return v;
  }}
  function holeValue(raw, scope) {{
    var m = ONLY_HOLE.exec(raw || "");
    return m ? lookup(m[1], scope) : raw;
  }}
  function interpolate(str, scope) {{
    return str.replace(HOLE, function (_, p) {{
      var v = lookup(p, scope);
      return v === undefined || v === null ? "" : String(v);
    }});
  }}

  function renderNodes(nodes, scope, out) {{
    for (var i = 0; i < nodes.length; i++) renderNode(nodes[i], scope, out);
  }}
  function renderNode(node, scope, out) {{
    if (node.nodeType === 3) {{
      out.appendChild(document.createTextNode(node.nodeValue.indexOf("{{{{") >= 0 ? interpolate(node.nodeValue, scope) : node.nodeValue));
      return;
    }}
    if (node.nodeType !== 1) return;
    var tag = node.localName;
    if (tag === "sc-if") {{
      if (holeValue(node.getAttribute("value"), scope)) renderNodes(node.childNodes, scope, out);
      return;
    }}
    if (tag === "sc-for") {{
      var list = holeValue(node.getAttribute("list"), scope) || [];
      var as = node.getAttribute("as") || "item";
      for (var k = 0; k < list.length; k++) {{
        var s = Object.create(scope);
        s[as] = list[k];
        s.$index = k;
        renderNodes(node.childNodes, s, out);
      }}
      return;
    }}
    var el = node.namespaceURI === "http://www.w3.org/2000/svg"
      ? document.createElementNS(node.namespaceURI, tag)
      : document.createElement(tag);
    for (var a = 0; a < node.attributes.length; a++) {{
      var name = node.attributes[a].name, raw = node.attributes[a].value;
      if (name.indexOf("hint-") === 0) continue;
      if (/^on[a-z]+$/.test(name)) {{
        var fn = holeValue(raw, scope);
        if (typeof fn === "function") el.addEventListener(name.slice(2), (function (f) {{ return function (e) {{ f(e); }}; }})(fn));
        continue;
      }}
      if (raw.indexOf("{{{{") >= 0) {{
        var m = ONLY_HOLE.exec(raw);
        var v = m ? lookup(m[1], scope) : interpolate(raw, scope);
        if (v === undefined || v === null) continue;
        if (v === false && name.indexOf("aria-") !== 0) continue;
        el.setAttribute(name, v === true && name.indexOf("aria-") !== 0 ? "" : String(v));
      }} else {{
        el.setAttribute(name, raw);
      }}
    }}
    renderNodes(node.childNodes, scope, el);
    out.appendChild(el);
  }}

  function instanceFor(id) {{
    if (!instances[id]) instances[id] = new SCREENS[id]({{}});
    return instances[id];
  }}

  function render() {{
    // Called from a field's "change" (fired while it loses the focus): redraw once the focus has reached the field
    // clicked or tabbed to, so focusMark finds it and gives it back after the redraw.
    if (window.event && window.event.type === "change" && !(window.event.target && window.event.target.tagName === "SELECT")) {{
      if (!render.later) render.later = setTimeout(function () {{ render.later = null; render(); }}, 0);
      return;
    }}
    var tpl = document.getElementById("tpl-" + current);
    var vals;
    try {{ vals = instanceFor(current).renderVals() || {{}}; }} catch (err) {{ console.error(err); vals = {{}}; }}
    var keep = focusMark();
    var frag = document.createDocumentFragment();
    renderNodes(tpl.content.childNodes, vals, frag);
    app.replaceChildren(frag);
    fit();
    if (window.SKLMech) {{ try {{ window.SKLMech.mount(app); }} catch (err) {{ console.error(err); }} }}
    placeCrm();
    decorate();
    focusBack(keep);
  }}
  // A redraw never takes the cursor out of the field the person is in (Romain 2026-11-02): the field focused before it
  // (or the one just clicked when leaving a field saved and redrew the screen) gets the focus and the caret back, found
  // again at the same place in the screen; a field inside a module (shadow root) is the same element, moved back in.
  function focusMark() {{
    var a = deepActive(), top = document.activeElement;
    if (!a || !top || !app.contains(top) || !(a.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName))) return null;
    var k = {{ a: a, tag: a.tagName, s: null, e: null, path: null }};
    try {{ k.s = a.selectionStart; k.e = a.selectionEnd; }} catch (err) {{}}
    if (top === a) {{ var path = [], n = a; while (n && n !== app) {{ var p = n.parentNode; if (!p) return null; path.unshift(Array.prototype.indexOf.call(p.children, n)); n = p; }} k.path = path; }}
    return k;
  }}
  function focusBack(k) {{
    if (!k) return;
    var el = null;
    if (k.a.isConnected) el = k.a;
    else if (k.path) {{ el = app; for (var i = 0; el && i < k.path.length; i++) el = el.children[k.path[i]]; if (el && el.tagName !== k.tag) el = null; }}
    if (!el || deepActive() === el) return;
    // text typed in the old field and not saved yet (it saves on "change") is carried over
    if (el !== k.a && "value" in el && el.tagName !== "SELECT" && k.a.value !== k.a.defaultValue && el.value === el.defaultValue) el.value = k.a.value;
    try {{ el.focus({{ preventScroll: true }}); if (k.s !== null && typeof el.setSelectionRange === "function") el.setSelectionRange(k.s, k.e); }} catch (err) {{}}
  }}

  // Shared data: badges in the sidebar, who is using the OS, and whether the data is shared
  function fieldFocused() {{
    var a = deepActive(), top = document.activeElement;
    return !!(a && top && app.contains(top) && (a.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)));
  }}
  function deepActive() {{
    var a = document.activeElement;
    while (a && a.shadowRoot && a.shadowRoot.activeElement) a = a.shadowRoot.activeElement;
    return a;
  }}
  function textFocused() {{
    var a = deepActive(), top = document.activeElement;
    if (!a || !top || !app.contains(top)) return false;
    if (a.isContentEditable || a.tagName === "TEXTAREA") return true;
    return a.tagName === "INPUT" && /^(text|search|email|url|tel|password|number|)$/.test((a.getAttribute("type") || "").toLowerCase());
  }}
  var pendingRemote = false;
  if (window.SKL) {{
    // A local save made while the person types in a text field (Build saves its draft as you type) waits for the field
    // to lose the focus: redrawing the screen then took the focus away mid-sentence (Romain 2026-11-02).
    window.SKL.onChange(function (remote) {{
      if (remote ? fieldFocused() : textFocused()) {{ pendingRemote = true; return; }}
      render();
    }});
    app.addEventListener("focusout", function () {{
      setTimeout(function () {{ if (pendingRemote && !fieldFocused() && !textFocused()) {{ pendingRemote = false; render(); }} }}, 0);
    }});
  }}
  // Sidebar groups fold and unfold on their title; the choice is kept across screens
  var navFold = {{}}, navSeen = null;
  try {{ navFold = JSON.parse(localStorage.getItem("skl-nav-fold") || "{{}}") || {{}}; }} catch (e) {{ navFold = {{}}; }}
  function applyNav() {{
    app.querySelectorAll("[data-navgrp]").forEach(function (b) {{
      var k = b.getAttribute("data-navgrp"), box = app.querySelector('[data-navitems="' + k + '"]');
      if (!box) return;
      if (navSeen !== current && box.querySelector('[aria-current="page"]')) delete navFold[k];
      var shut = !!navFold[k];
      box.style.display = shut ? "none" : "flex";
      b.setAttribute("aria-expanded", shut ? "false" : "true");
      var c = b.querySelector("[data-chev]"); if (c) c.style.transform = shut ? "rotate(-90deg)" : "none";
    }});
    navSeen = current;
  }}
  app.addEventListener("click", function (e) {{
    var b = e.target.closest ? e.target.closest("[data-navgrp]") : null;
    if (!b) return;
    var k = b.getAttribute("data-navgrp");
    if (navFold[k]) delete navFold[k]; else navFold[k] = 1;
    try {{ localStorage.setItem("skl-nav-fold", JSON.stringify(navFold)); }} catch (err) {{}}
    navSeen = current; applyNav();
  }});
  function decorate() {{
    applyNav();
    var S = window.SKL; if (!S) return;
    // the week of the quarter in the sidebar footer follows the OS clock (French: ISO week "S45", T4 = the fourth quarter)
    app.querySelectorAll("nav div").forEach(function (el) {{
      var t = el.firstChild;
      if (t && t.nodeType === 3 && /^T4 2026 · semaine \d+\/13/.test(t.nodeValue)) t.nodeValue = t.nodeValue.replace(/semaine \d+\/13/, S.wl(S.week).replace(/^W/, "S") + " · semaine " + S.week + "/13");
    }});
    var b = S.badges();
    app.querySelectorAll("[data-badge]").forEach(function (el) {{
      var key = el.getAttribute("data-badge");
      var n = key === "agentdec" ? (window.__sklAgentsPending || 0) : (b[key] || 0);
      el.textContent = String(n); el.style.display = n ? "" : "none";
    }});
    var box = app.querySelector("[data-me]"); if (!box) return;
    var ROLE_FR = {{ "Content Lead": "Responsable contenu", "Sales": "Commercial" }};   // shown only: the roles stay as stored
    box.textContent = "";
    var lab = document.createElement("label");
    lab.style.cssText = "display: flex; flex-direction: column; gap: 6px; font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; color: #5E5B53";
    lab.appendChild(document.createTextNode("Vous êtes"));
    var sel = document.createElement("select");
    sel.style.cssText = "font: inherit; font-size: 15px; letter-spacing: 0; text-transform: none; padding: 10px 12px; border-radius: 10px; border: 1px solid #D8D3C7; background: #FFFFFF; color: #1B1B18";
    var o0 = document.createElement("option"); o0.value = ""; o0.textContent = "Choisissez qui vous êtes…"; sel.appendChild(o0);
    S.members.forEach(function (m) {{ var o = document.createElement("option"); o.value = m.id; o.textContent = m.name + " · " + (ROLE_FR[m.role] || m.role); if (S.me === m.id) o.selected = true; sel.appendChild(o); }});
    sel.addEventListener("change", function () {{ if (sel.value) S.setMe(sel.value); }});
    lab.appendChild(sel); box.appendChild(lab);
    var st = document.createElement("div");
    st.style.cssText = "display: flex; align-items: center; gap: 6px; font-size: 13px; color: #5E5B53";
    var dot = document.createElement("span");
    dot.style.cssText = "width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; background: " + (S.mode === "shared" ? (S.readOnly ? "#D9B46A" : "#2E7D4F") : "#8E8A80");
    st.appendChild(dot);
    st.appendChild(document.createTextNode(S.mode === "shared" ? (S.readOnly ? "Données partagées · lecture seule" : "Données partagées · enregistrées pour l’équipe") : S.mode === "loading" ? "Connexion…" : "Données de démonstration · non enregistrées"));
    box.appendChild(st);
  }}

  // ALKIMIY Lite screens run in their own frames, kept alive outside the re-rendered app so their state survives.
  var frames = {{}};
  var FRAME_DOCS = {{ crm: window.SKL_CRM_DOC }};
  function frameFor(key, bg) {{
    if (!frames[key] && FRAME_DOCS[key]) {{
      var f = document.createElement("iframe");
      f.title = key === "crm" ? "CRM" : "Tableau de bord commercial";
      f.setAttribute("srcdoc", FRAME_DOCS[key]);
      f.style.cssText = "position: fixed; border: 0; z-index: 1; background: " + bg + ";";
      document.body.appendChild(f);
      frames[key] = f;
    }}
    return frames[key];
  }}
  function placeOne(key, sel, bg, fill) {{
    var slot = app.querySelector(sel);
    if (!slot) {{ if (frames[key]) frames[key].style.display = "none"; return; }}
    if (fill) {{
      var z = parseFloat(app.style.zoom) || 1;
      var top = slot.getBoundingClientRect().top + window.scrollY;
      slot.style.height = Math.max(480, Math.floor((window.innerHeight - top) / z) - 24) + "px";
    }}
    var f = frameFor(key, bg);
    if (!f) return;
    var r = slot.getBoundingClientRect();
    f.style.display = "block";
    f.style.left = r.left + "px"; f.style.top = r.top + "px";
    f.style.width = r.width + "px"; f.style.height = r.height + "px";
  }}
  function placeCrm() {{
    placeOne("crm", "[data-crm]", "#F6F4EF", false);
    mountDash();
  }}

  // The sales dashboard lives in the cockpit page itself, isolated in a shadow root, and keeps its state
  var dashHost = null;
  // Cockpit modules live in shadow roots, keep their state between renders, and redraw when the shared data changes
  var modHosts = {{}}, modTip = null, modToast = null;
  function modChrome() {{
    if (modTip) return;
    modTip = document.createElement("div");
    modTip.setAttribute("role", "tooltip");
    modTip.style.cssText = "position:fixed;pointer-events:none;background:#1B1B18;color:#F6F4EF;font:12px/1.4 'IBM Plex Sans',system-ui,sans-serif;padding:8px 10px;border-radius:8px;max-width:280px;opacity:0;transition:opacity .12s;z-index:60";
    modToast = document.createElement("div");
    modToast.setAttribute("role", "status");
    modToast.style.cssText = "position:fixed;left:50%;bottom:18px;transform:translateX(-50%);background:#1B1B18;color:#F6F4EF;font:13px 'IBM Plex Sans',system-ui,sans-serif;padding:10px 16px;border-radius:10px;opacity:0;transition:opacity .2s;z-index:60;pointer-events:none";
    document.body.appendChild(modTip); document.body.appendChild(modToast);
  }}
  function mountModule(sel, mod) {{
    var slot = app.querySelector(sel);
    var mo = window[mod];
    if (!slot || !mo) return;
    modChrome();
    var h = modHosts[mod];
    if (!h) {{
      h = modHosts[mod] = document.createElement("div");
      var root = h.attachShadow({{ mode: "open" }});
      root.innerHTML = '<style>' + mo.css + '</style>' + mo.html;
      slot.appendChild(h);
      try {{ h.__api = mo.mount(root, modTip, modToast); }} catch (err) {{ console.error(err); }}
      // While the person types in a field of this module, a data change (their own save coming back through the shared
      // database, or a colleague's) waits until the field loses the focus: redrawing then took the cursor away (Romain 2026-11-02).
      var redraw = function () {{ if (h.__api && h.isConnected) {{ try {{ h.__api.render(); }} catch (err) {{ console.error(err); }} }} }};
      var typingHere = function () {{ return document.activeElement === h && fieldFocused(); }};
      if (window.SKL) SKL.onChange(function () {{ if (typingHere()) {{ h.__pending = true; return; }} redraw(); }});
      h.addEventListener("focusout", function () {{ setTimeout(function () {{ if (h.__pending && !typingHere()) {{ h.__pending = false; redraw(); }} }}, 0); }});
      return;
    }}
    if (h.parentNode !== slot) {{ slot.appendChild(h); }}
    if (h.__api) {{ try {{ h.__api.render(); }} catch (err) {{ console.error(err); }} }}
  }}
  function mountDash() {{
    mountModule("[data-dash]", "SKL_SALES");
    mountModule("[data-ov]", "SKL_OV");
    mountModule("[data-krroom]", "SKL_KRROOM");
    mountModule("[data-mkt]", "SKL_MKT");
    mountModule("[data-fin]", "SKL_FIN");
    mountModule("[data-build]", "SKL_BUILD");
    mountModule("[data-execute]", "SKL_EXECUTE");
    mountModule("[data-carto]", "SKL_CARTO");
    mountModule("[data-agents]", "SKL_AGENTS");
    mountModule("[data-salesday]", "SKL_SALESDAY");
    if (modTip) modTip.style.opacity = 0;
  }}
  // A team row on the sales dashboard opens the CRM filtered on that sales rep
  window.addEventListener("message", function (e) {{
    var d = e.data || {{}};
    if (d.skl === "go" && typeof d.screen === "string") {{ go(d.screen); return; }}   // e.g. CRM › Sales cycle → Execute, Build ↔ Execute
    if (d.skl !== "crm") return;
    go("crm");
    var f = frames.crm;
    var apply = function () {{
      try {{
        if (d.view === "alerts") f.contentWindow.eval("S.view='alerts';renderAll();");
        else f.contentWindow.eval("S.view='crm';S.cx.owner=" + JSON.stringify(String(d.owner)) + ";S.cx.tab='pipeline';S.cx.quick=null;renderAll();");
      }} catch (err) {{ console.error(err); }}
    }};
    if (!f) return;
    var ready = false;
    try {{ ready = f.contentDocument && f.contentDocument.readyState === "complete" && f.contentDocument.getElementById("v-crm"); }} catch (err) {{}}
    if (ready) apply(); else f.addEventListener("load", apply, {{ once: true }});
  }});
  window.addEventListener("scroll", placeCrm, {{ passive: true }});

  // Design width is 1440 px. Narrower windows scale the whole app down; wider ones let it grow.
  // The root always fills the full window height so the sidebar runs to the bottom of the screen.
  function fit() {{
    var root = app.querySelector("[data-root]");
    if (!root) return;
    var vw = document.documentElement.clientWidth;
    var z = Math.min(1, vw / 1440);
    app.style.zoom = z < 1 ? String(z) : "";
    var h = Math.ceil(window.innerHeight / z) + "px";
    root.style.minHeight = h;
    root.style.setProperty("--screen-h", h);
  }}

  // My Day and Roadmap were replaced by Execute and Build (2026-10-30): their old links and #hashes land on the new screens
  var MOVED = {{ monjour: "execute", inbox: "execute", roadmap: "build" }};
  // edition.json (LNP: the Sales System only): the home screen, and every screen outside the edition lands on it
  var HOME = {json.dumps(EDITION.get("home", "cockpit"))}, KEEP = {json.dumps(EDITION_KEEP)};
  if (KEEP) Object.keys(SCREENS).forEach(function (id) {{ if (KEEP.indexOf(id) < 0) MOVED[id] = HOME; }});
  window.SKL_EDITION = {{ home: HOME, keep: KEEP }};   // read by web/public/skl-web.js (Settings › Access lists only these screens)
  function go(id) {{
    id = MOVED[id] || id;
    if (!SCREENS[id]) return;
    current = id;
    render();
    window.scrollTo(0, 0);
    try {{ history.replaceState(null, "", "#" + id); }} catch (e) {{}}
  }}

  document.querySelectorAll("template[data-file]").forEach(function (t) {{
    fileToScreen[t.getAttribute("data-file")] = t.id.replace("tpl-", "");
  }});
  fileToScreen["MonJour.dc.html"] = "execute"; fileToScreen["Roadmap.dc.html"] = "build";   // links written before Build and Execute

  app.addEventListener("click", function (e) {{
    var a = e.target.closest ? e.target.closest("a[href]") : null;
    if (!a) return;
    var href = a.getAttribute("href");
    if (fileToScreen[href]) {{ e.preventDefault(); go(fileToScreen[href]); }}
    else if (href === "#" || href.charAt(0) === "#") {{ e.preventDefault(); }}
  }});
  app.addEventListener("submit", function (e) {{ e.preventDefault(); }});
  document.addEventListener("keydown", function (e) {{
    var inst = instances[current];
    if (e.key === "Escape" && inst && inst.state && (inst.state.info || inst.state.edit)) inst.setState({{ info: false, edit: null }});
  }});
  window.addEventListener("resize", function () {{ fit(); placeCrm(); }});

  var start = (location.hash || "").replace("#", "");
  start = MOVED[start] || start;
  current = SCREENS[start] ? start : HOME;
  if (KEEP && location.hash && location.hash.replace("#", "") !== current) {{ try {{ history.replaceState(null, "", "#" + current); }} catch (e) {{}} }}
  render();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
}})();
</script>
"""
# edition.json "rename" (LNP, 2026-11-03): its own name instead of SKL OS / ALKIMIY in every text of the page, in order
for a, z in EDITION.get("rename", []):
    page = page.replace(a, z)


def restyle(text, edition=EDITION):
    """edition.json "recolor" and "fonts" (LNP, 2026-11-03): the colours and fonts of Les Nouveaux Profs in every
    screen, applied to the finished page like "rename" (hex colours, rgb()/rgba() triples, then font names)."""
    rc = edition.get("recolor") or {}
    hx = {k.lower(): v for k, v in rc.get("hex", {}).items()}
    if hx:
        text = re.sub(r"#[0-9a-fA-F]{6}\b", lambda m: hx.get(m.group(0).lower(), m.group(0)), text)
    rg = rc.get("rgb", {})
    if rg:
        def _rgb(m):
            z = rg.get(f"{m.group(2)},{m.group(3)},{m.group(4)}")
            return f"rgb{m.group(1)}({z}" if z else m.group(0)
        text = re.sub(r"rgb(a?)\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)", _rgb, text)
    for a, z in edition.get("fonts", []):
        text = text.replace(a, z)
    return text


page = restyle(page)
_logo = HERE.parent / EDITION["logo"] if EDITION.get("logo") else None
if _logo and _logo.exists():  # LNP: its logo as the tab icon
    import base64
    page = page.replace("</title>", '</title>\n<link rel="icon" type="image/png" href="data:image/png;base64,'
                        + base64.b64encode(_logo.read_bytes()).decode() + '">', 1)
OUT.write_text(page, encoding="utf-8")
print(OUT, len(page))
