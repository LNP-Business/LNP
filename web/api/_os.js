// LNP's screens and Settings for the Claude connector (docs/crm/17-claude-connector.md §9): every screen's Page method and
// the alert rules of Settings › Alerts. The CRM itself is read by web/api/_crm.js.
// Page methods live in the page itself: they come from _kb.json, built from the sources by web/kb/build_kb.mjs (build.sh
// stage 4). The alert rules are live data, read with the CALLER's token (row-level security as in the app).
import { readFileSync } from "node:fs";
import { cell, rows, userError } from "./_crm.js";

const KB = JSON.parse(readFileSync(new URL("./_kb.json", import.meta.url), "utf8"));   // vercel.json includeFiles ships it

function table(head, list) { return ["| " + head.join(" | ") + " |", "|" + head.map(() => "---").join("|") + "|"].concat(list.map(r => "| " + r.map(cell).join(" | ") + " |")).join("\n"); }

// ---------------- Page method of each screen ----------------
const ALIASES = { "sales cockpit": "salescockpit", cockpit: "salescockpit", "cockpit commercial": "salescockpit", "sales day": "salesday", "ma journée": "salesday", "my day": "salesday",
  pipeline: "crm", leads: "crm", "sales cycle": "crm", alerts: "settings", alertes: "settings", "settings": "settings", paramètres: "settings", compte: "account", accès: "access" };
export function pageMethod(u, ctx, { screen }) {
  const list = KB.screens || [];
  if (!screen) return { text: "# LNP screens\n" + list.map(s => "- **" + s.where + "** (`" + s.screen + "`, access key `" + s.key + "`): " + s.about).join("\n") +
    "\nAsk with screen = a screen name (Sales cockpit, Sales Day, CRM, Alerts, Account, Access) for its Page method (what it is for, how to use it).", rows: list.length };
  const q = String(screen).trim().toLowerCase(), key = ALIASES[q] || q;
  const s = list.find(x => x.key === key || x.screen.toLowerCase() === key || x.where.toLowerCase().includes(q));
  if (!s) throw userError("No screen '" + screen + "'. Screens: " + list.map(x => x.screen).join(", ") + ".");
  return { text: "# Page method · " + s.where + "\n" + (s.method || "This screen has no Page method."), rows: 1 };
}

// ---------------- Settings › Alerts ----------------
// The rules as Settings › Alerts saves them (docs row config/alerts: alerts.<id> = {on, sev, who, ch}, values["<id>.<param>"]);
// the CRM rules' names and default thresholds come from crm_settings.alert_rule_defaults (003, merged by 004).
const WHO = ["owner", "department lead", "Romain"], CH = ["in the app", "Slack", "email"];
export async function alertRules(u, ctx, { include_off }) {
  const [cfgRows, defRows] = await Promise.all([
    rows(u.from("docs").select("body").eq("col", "config").eq("id", "alerts")),
    rows(u.from("crm_settings").select("value").eq("key", "alert_rule_defaults"))]);
  const cfg = (cfgRows[0] && cfgRows[0].body) || {}, defs = Array.isArray(defRows[0] && defRows[0].value) ? defRows[0].value : [];
  const saved = cfg.alerts || {}, vals = cfg.values || {};
  const byNum = (a, b) => Number(a.id.slice(1)) - Number(b.id.slice(1));
  const all = defs.map(d => {
    const s = saved[d.id] || {}, on = s.on !== undefined ? !!s.on : true;
    const th = Object.keys(d.threshold || {}).filter(k => typeof d.threshold[k] === "number").map(k => k + " " + (vals[d.id + "." + k] != null ? vals[d.id + "." + k] : d.threshold[k]))
      .concat(Object.keys(d.threshold || {}).filter(k => typeof d.threshold[k] === "string").map(k => k + ": " + d.threshold[k]));
    // not saved yet: the defaults, read as crm_merge_alert_defaults (004) would save them
    const who = Array.isArray(s.who) ? WHO.filter((_, i) => s.who[i]) : WHO.filter((_, i) => (d.to || []).includes(["owner", "lead", "romain"][i]));
    const ch = Array.isArray(s.ch) ? CH.filter((_, i) => s.ch[i]) : ["in the app"];
    const sev = s.sev || (d.severity ? d.severity[0].toUpperCase() + d.severity.slice(1) : "—");
    return { id: d.id, name: d.name, on, sev, th: th.join(", ") || "—", who: who.join(", ") || "nobody", ch: ch.join(", ") || "none" };
  }).sort(byNum);
  const shown = include_off ? all : all.filter(r => r.on);
  const L = ["# Alert rules of the CRM (Settings › Alerts) · " + all.filter(r => r.on).length + " on of " + all.length,
    shown.length ? table(["Rule", "Name", "On", "Severity", "Threshold", "Who is told", "Channels"], shown.map(r => [r.id, r.name, r.on ? "on" : "off", r.sev, r.th, r.who, r.ch])) : "No alert rule" + (all.length ? " is on." : " is set up yet."),
    "", "Escalation after " + (cfg.escH || 24) + " h for High and Critical alerts left open" + (cfg.quietOn === false ? "" : " · quiet hours on") + (cfg.digestOn === false ? "" : " · daily digest on") + ".",
    "The alerts open now on the leads: `clocks_running`."];
  return { text: L.join("\n"), rows: all.length };
}
