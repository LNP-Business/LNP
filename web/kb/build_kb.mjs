// Builds web/api/_kb.json: the parts of SKL OS that live in the page itself, not in the database, for the Claude
// connector (docs/crm/17-claude-connector.md §9). Run by build.sh stage 4: node web/kb/build_kb.mjs
//   - the SKL Map base model (skl-os/carto/cartographie-skl.en.html; the team's edits are the "needs" collection)
//   - the mechanisms' base models (Pre-call, Sales, Execution steering, Results steering) and the registers' OS lines
//     (uploads/editeur-systeme.jsx, mechapp/embed.jsx; the team's edits are the "mech" collection)
//   - the Agent System module's sample data (skl-os/agents_module.js, fictitious sample of the spec)
//   - every screen's Page method popup and the sidebar (skl-en/project/*.dc.html, skl-os/nav.py)
//   - store.js itself, so the connector reads the live data with the same rules as the screens (no logic copied)
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";

const ROOT = new URL("../../", import.meta.url);
const read = p => readFileSync(new URL(p, ROOT), "utf8");

// the object or array literal that follows `marker` (brace matching, strings and comments skipped)
function literalAfter(src, marker) {
  const at = src.indexOf(marker); if (at < 0) throw new Error("not found: " + marker);
  let i = src.indexOf("=", at) + 1; while (/\s/.test(src[i])) i++;
  const open = src[i], close = open === "{" ? "}" : "]"; let depth = 0, q = null;
  for (let j = i; j < src.length; j++) {
    const c = src[j];
    if (q) { if (c === "\\") { j++; continue; } if (c === q) q = null; continue; }
    if (c === '"' || c === "'" || c === "`") { q = c; continue; }
    if (c === "/" && src[j + 1] === "/") { j = src.indexOf("\n", j); continue; }
    if (c === "/" && src[j + 1] === "*") { j = src.indexOf("*/", j) + 1; continue; }
    if (c === open) depth++; else if (c === close && --depth === 0) return src.slice(i, j + 1);
  }
  throw new Error("unbalanced: " + marker);
}
const evalIn = (code, ctx) => vm.runInNewContext(code, Object.assign({}, ctx), { timeout: 2000 });
const plain = x => JSON.parse(JSON.stringify(x));

// ---------------- SKL Map ----------------
function sklMap() {
  const src = read("skl-os/carto/cartographie-skl.en.html");
  const a = src.indexOf("const STATES_B="), b = src.indexOf("const STATUS=");
  const names = ["STATES_B", "TRANS_B", "ACTMAP", "MEAS", "TOOLS_B", "CHAINS_B", "DOMAINS_B", "HAND_B", "EXITS_B", "SHORTS_B", "MEM_B", "ORCH_B", "LOOPS_B"];
  const out = evalIn(src.slice(a, b) + "\n;({" + names.join(",") + "})", {});
  const lab = evalIn(src.slice(b, src.indexOf("const KEY=")) + "\n;({STATUS,COVER,KIND,AUTO,NFIELDS,SPEC})", {});
  return plain({ states: out.STATES_B, transitions: out.TRANS_B, acts: out.ACTMAP, measures: out.MEAS, tools: out.TOOLS_B, chains: out.CHAINS_B,
    domains: out.DOMAINS_B, handoffs: out.HAND_B, exits: out.EXITS_B, shortcuts: out.SHORTS_B, memory: out.MEM_B, orchestrator: out.ORCH_B,
    loops: out.LOOPS_B, labels: lab });
}

// ---------------- mechanisms ----------------
function mechanisms() {
  const ed = read("uploads/editeur-systeme.jsx"), em = read("mechapp/embed.jsx");
  const get = (src, name) => { try { return plain(evalIn("(" + literalAfter(src, "const " + name + " =") + ")", {})); } catch (e) { return { error: String(e.message || e) }; } };
  return { "s-preappel": { name: "Pre-call", page: "Knowledge System › Pre-call", model: get(ed, "PREAPPEL") },
    "s-vente": { name: "Sales", page: "Knowledge System › Sales", model: get(ed, "DEFAUT") },
    "s-os-exec": { name: "Execution steering", page: "Knowledge System › Operating System", model: get(em, "OS_EXEC") },
    "s-os-res": { name: "Results steering", page: "Knowledge System › Operating System", model: get(em, "OS_RES") },
    registers_os_lines: get(em, "OS_REG") };
}

// ---------------- Agent System ----------------
function agents() {
  const src = read("skl-os/agents_module.js");
  const a = src.indexOf("var LEVELS"), b = src.indexOf("var S = {");
  return plain(evalIn(src.slice(a, b) + "\n;({LEVELS,STATUS,TYPE,RESULT,STATE,AGENTS,DECISIONS,TRIGGERS,LOG,ALERTS})", {}));
}

// ---------------- screens: Page method and sidebar ----------------
const text = h => h.replace(/<(br|\/p|\/li|\/h\d|\/div)\b[^>]*>/gi, "\n").replace(/<li\b[^>]*>/gi, "- ").replace(/<[^>]+>/g, "")
  .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&rsquo;/g, "'")
  .replace(/&[a-z]+;/g, " ").replace(/\{\{[^}]*\}\}/g, "").replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();
function screens() {
  const dir = "skl-en/project/", out = {};
  for (const f of readdirSync(new URL(dir, ROOT)).filter(f => f.endsWith(".dc.html") && !/\.pre-/.test(f))) {
    const h = read(dir + f);
    const i = h.indexOf('aria-labelledby="info-title"');
    if (i < 0) continue;
    const start = h.lastIndexOf("<div", i), end = h.indexOf("</dialog>", i) > 0 ? h.indexOf("</dialog>", i) : h.indexOf("<main", i);
    out[f.replace(".dc.html", "")] = text(h.slice(start, end > 0 ? end : i + 8000)).slice(0, 4000);
  }
  // Build and Execute draw their own Page method (renderPop in skl-os/os2_common.js), with the rules of R
  const os2 = read("skl-os/os2_common.js"), R = { taskMax: 4, msWeek: 3, dayH: 9, days: 6, weekMax: 54 };
  const a = os2.indexOf("<section><h4>What it is for"), b = os2.indexOf("</div></div></div>`}", a);
  const method = text(os2.slice(a, b).replace(/\$\{R\.(\w+)\}/g, (m, k) => String(R[k])).replace(/<h4>/g, "\n").replace(/<\/h4>/g, "\n"));
  out.Build = "Build\n" + method; out.Execute = "Execute\n" + method;
  return out;
}
function sidebar() {
  const src = read("skl-os/nav.py");
  return src.slice(src.indexOf("SYSTEMS = {"), src.indexOf("SCREENS = {")).replace(/\s+\n/g, "\n").slice(0, 6000);
}

// the app's own rules (store.js) and the screen and person lists, run by the connector on the live data (web/api/_os.js)
const kb = { built_from: "SKL OS sources (build.sh stage 4)", store_js: read("skl-os/store.js"), skl_map: sklMap(), mechanisms: mechanisms(), agent_system: agents(), page_methods: screens(), sidebar: sidebar() };
writeFileSync(new URL("web/api/_kb.json", ROOT), JSON.stringify(kb));
const n = (o) => JSON.stringify(o).length;
console.log("kb", Object.fromEntries(Object.entries(kb).map(([k, v]) => [k, n(v)])));

// the Claude planner prompt pack of Build (proposal/os-v2/prompts.js), one source for the page and /api/planner
writeFileSync(new URL("web/api/_prompts.json", ROOT), JSON.stringify(createRequire(import.meta.url)(new URL("proposal/os-v2/prompts.js", ROOT).pathname)));
