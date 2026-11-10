"""Assemble the LNP screens (gabarits/*.dc.html) into one standalone page, app/lnp.html."""
import re, pathlib, sys, json

HERE = pathlib.Path(__file__).resolve().parent
SRC = HERE.parent / "gabarits"
OUT = HERE / "lnp.html"
TITLE = "LNP"
_ed = HERE.parent / "edition.json"
EDITION = json.load(open(_ed, encoding="utf-8")) if _ed.exists() else {}
TITLE = EDITION.get("title", TITLE)
# screens kept by the edition: its systems' screens and its Settings screens (None = every screen)
_SYS = {"ss": ["salescockpit", "salesday", "entrainement", "academie", "resultats", "suivi", "crm"]}
EDITION_KEEP = (sum((_SYS.get(x, []) for x in EDITION.get("systems", [])), []) + [f.replace(".dc.html", "").lower() for f in EDITION.get("settings", [])]) if EDITION else None

SCREENS = [
    ("salescockpit", "SalesCockpit"),
    ("salesday", "SalesDay"),
    ("crm", "CRM"),
    ("entrainement", "Entrainement"),
    ("academie", "Academie"),
    ("resultats", "Resultats"),
    ("suivi", "SuiviCommerciaux"),
    ("settings", "Settings"),
    ("account", "Account"),
    ("access", "Access"),
]

# only the screens of the edition are in the page
if EDITION_KEEP is not None:
    SCREENS = [s for s in SCREENS if s[0] in EDITION_KEEP]

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
if (HERE / "store.js").exists():
    STOREJS = ("<script>" + (HERE / "store.js").read_text(encoding="utf-8").replace("</", "<\\/") + "</script>\n"
               + "<script>" + (HERE / "crm" / "data.js").read_text(encoding="utf-8").replace("</", "<\\/") + "</script>"
               # the Sales cycle SLAs (one source with CRM › Sales cycle and sla-tick): the catalogue of Settings › Alerts
               + "<script>" + (HERE.parent / "supabase" / "functions" / "_shared" / "sla_rules.js").read_text(encoding="utf-8").replace("</", "<\\/") + "</script>"
               # the lead's sales cycle feed and « À faire » (CRM lead record and Ma journée)
               + "<script>" + (HERE / "crm" / "lead_feed.js").read_text(encoding="utf-8").replace("</", "<\\/") + "</script>")
CRMDOC = HERE / "crm_doc.html"
CRMJS = ""
if CRMDOC.exists():
    CRMJS = "<script>window.LNP_CRM_DOC = " + json.dumps(CRMDOC.read_text(encoding="utf-8")).replace("</", "<\\/") + ";</script>"
    # Ventes › Entraînement (Romain 2026-11-05): « Entraînement discovery », its own document in a frame, with the cases of
    # app/training/coup_lnp.json and lettre_lnp.json as they are
    TR = HERE / "training"
    # Entraînement (Romain 2026-11-06): every exercise is kept on the account (results_log.js, migration 049), read back in
    # « Mes résultats » and, for admins, « Suivi des commerciaux » (resultats.html, two modes); Maîtrise de l'offre is the
    # « Académie sales LNP » with academie_contenu.json as it is
    RES = (TR / "results_log.js").read_text(encoding="utf-8").replace("</", "<\\/") if (TR / "results_log.js").exists() else ""
    def tr_doc(name, subs):
        d = (TR / name).read_text(encoding="utf-8").replace("/*@RESULTS@*/", RES)
        for a, z in subs:
            assert a in d, (name, a)
            d = d.replace(a, z)
        return d
    if (TR / "entrainement.html").exists():
        coup, lettre = (TR / "coup_lnp.json").read_text(encoding="utf-8").strip(), (TR / "lettre_lnp.json").read_text(encoding="utf-8").strip()
        acad = (TR / "academie_contenu.json").read_text(encoding="utf-8").strip()
        trdoc = tr_doc("entrainement.html", [("/*@COUP@*/[]", coup.replace("</", "<\\/")), ("/*@LETTRE@*/[]", lettre.replace("</", "<\\/"))])
        CRMJS += "\n<script>window.LNP_TRAINING_DOC = " + json.dumps(trdoc).replace("</", "<\\/") + ";</script>"
        acdoc = tr_doc("academie.html", [("/*@ACADEMIE@*/{}", acad.replace("</", "<\\/"))])
        CRMJS += "\n<script>window.LNP_ACADEMIE_DOC = " + json.dumps(acdoc).replace("</", "<\\/") + ";</script>"
        # the case labels of the history: Maîtrise de l'offre titles, the expected move of a coup, the prospect of a lettre
        cat = {"a": {c["id"]: c["titre"] for c in json.loads(acad)["cas"]}, "c": {c["n"]: c["att"] for c in json.loads(coup)},
               "l": {c["n"]: c["qui"].split(",")[0] for c in json.loads(lettre)}}
        catjs = json.dumps(cat, ensure_ascii=False).replace("</", "<\\/")
        for key, mode in (("RESULTATS", "moi"), ("SUIVI", "equipe")):
            rdoc = tr_doc("resultats.html", [('/*@MODE@*/"moi"', json.dumps(mode)), ("/*@CATALOGUE@*/{ a: {}, c: {}, l: {} }", catjs)])
            CRMJS += "\n<script>window.LNP_" + key + "_DOC = " + json.dumps(rdoc).replace("</", "<\\/") + ";</script>"
    SDJ = HERE / "salesday_module.js"
    if SDJ.exists():
        CRMJS += "\n<script>" + SDJ.read_text(encoding="utf-8").replace("</", "<\\/") + "</script>"
    # Cockpit commercial › Exécution, Qualité, Impact (2026-11-09, sales_exec_module.js)
    SXJ = HERE / "sales_exec_module.js"
    if SXJ.exists():
        CRMJS += "\n<script>" + SXJ.read_text(encoding="utf-8").replace("</", "<\\/") + "</script>"
    SALESV2 = HERE / "sales_v2.json"
    if SALESV2.exists():
        sv = json.loads(SALESV2.read_text(encoding="utf-8"))
        CRMJS += ("\n<script>window.LNP_SALES = {css: " + json.dumps(sv["css"]).replace("</", "<\\/") + ", html: " + json.dumps(sv["html"]).replace("</", "<\\/")
                  + ", mount: " + sv["js"].replace("</", "<\\/") + "};</script>")
page = f"""<title>{TITLE}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,500;0,9..144,600;1,9..144,600&amp;family=IBM+Plex+Sans:wght@400;500;600;700&amp;family=IBM+Plex+Mono:wght@400;500;600&amp;display=swap">
<style>
/* Single light product UI, as designed in the LNP canvas: warm paper ground, ink sidebar, blue action. */
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
html:not(.lnp-admin) [data-admin-only] {{ display: none !important; }}
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

  // a field being typed in: a redraw waits until it loses the focus
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
  if (window.LNP) {{
    // A local save made while the person types in a text field (Build saves its draft as you type) waits for the field
    // to lose the focus: redrawing the screen then took the focus away mid-sentence (Romain 2026-11-02).
    window.LNP.onChange(function (remote) {{
      if (remote ? fieldFocused() : textFocused()) {{ pendingRemote = true; return; }}
      render();
    }});
    app.addEventListener("focusout", function () {{
      setTimeout(function () {{ if (pendingRemote && !fieldFocused() && !textFocused()) {{ pendingRemote = false; render(); }} }}, 0);
    }});
  }}
  // Sidebar groups fold and unfold on their title; the choice is kept across screens
  var navFold = {{}}, navSeen = null;
  try {{ navFold = JSON.parse(localStorage.getItem("lnp-nav-fold") || "{{}}") || {{}}; }} catch (e) {{ navFold = {{}}; }}
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
    try {{ localStorage.setItem("lnp-nav-fold", JSON.stringify(navFold)); }} catch (err) {{}}
    navSeen = current; applyNav();
  }});
  function decorate() {{
    applyNav();
  }}

  // CRM LNP screens run in their own frames, kept alive outside the re-rendered app so their state survives.
  var frames = {{}};
  var FRAME_DOCS = {{ crm: window.LNP_CRM_DOC, training: window.LNP_TRAINING_DOC, academie: window.LNP_ACADEMIE_DOC, resultats: window.LNP_RESULTATS_DOC, suivi: window.LNP_SUIVI_DOC }};
  var FRAME_TITLES = {{ crm: "CRM", training: "Découverte", academie: "Maîtrise de l’offre", resultats: "Mes résultats", suivi: "Suivi des commerciaux" }};
  function frameFor(key, bg) {{
    if (!frames[key] && FRAME_DOCS[key]) {{
      var f = document.createElement("iframe");
      f.title = FRAME_TITLES[key] || "Tableau de bord commercial";
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
    placeOne("training", "[data-training]", "#F7F8FB", true);
    placeOne("academie", "[data-academie]", "#F7F8FB", true);
    placeOne("resultats", "[data-resultats]", "#F7F8FB", true);
    placeOne("suivi", "[data-suivi]", "#F7F8FB", true);
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
      if (window.LNP) LNP.onChange(function () {{ if (typingHere()) {{ h.__pending = true; return; }} redraw(); }});
      h.addEventListener("focusout", function () {{ setTimeout(function () {{ if (h.__pending && !typingHere()) {{ h.__pending = false; redraw(); }} }}, 0); }});
      return;
    }}
    if (h.parentNode !== slot) {{ slot.appendChild(h); }}
    if (h.__api) {{ try {{ h.__api.render(); }} catch (err) {{ console.error(err); }} }}
  }}
  function mountDash() {{
    mountModule("[data-dash]", "LNP_SALES");
    mountModule("[data-salesexec]", "LNP_SALESEXEC");
    mountModule("[data-salesday]", "LNP_SALESDAY");
    if (modTip) modTip.style.opacity = 0;
  }}
  // A team row on the sales dashboard opens the CRM filtered on that sales rep
  window.addEventListener("message", function (e) {{
    var d = e.data || {{}};
    if (d.lnp === "go" && typeof d.screen === "string") {{ go(d.screen); return; }}
    if (d.lnp !== "crm") return;
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

  var MOVED = {{}};
  // edition.json (LNP: the Sales System only): the home screen, and every screen outside the edition lands on it
  var HOME = {json.dumps(EDITION.get("home", "salescockpit"))}, KEEP = {json.dumps(EDITION_KEEP)};
  if (KEEP) Object.keys(SCREENS).forEach(function (id) {{ if (KEEP.indexOf(id) < 0) MOVED[id] = HOME; }});
  window.LNP_EDITION = {{ home: HOME, keep: KEEP }};   // read by web/public/lnp-web.js (Settings › Access lists only these screens)
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


def restyle(text, edition=EDITION):
    """edition.json "recolor" and "fonts" (LNP, 2026-11-03): the colours and fonts of Les Nouveaux Profs in every
    screen, applied to the finished page (hex colours, rgb()/rgba() triples, then font names)."""
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
