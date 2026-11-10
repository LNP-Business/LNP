// LNP's screens and Settings for the Claude connector (docs/crm/17-claude-connector.md §9): every screen's Page method and
// the alert rules of Settings › Alerts. The CRM itself is read by web/api/_crm.js.
// Page methods live in the page itself: they come from _kb.json, built from the sources by web/kb/build_kb.mjs (build.sh
// stage 4). The alert rules are live data, read with the CALLER's token (row-level security as in the app).
import { readFileSync } from "node:fs";
import { cell, rows, userError } from "./_crm.js";

const KB = JSON.parse(readFileSync(new URL("./_kb.json", import.meta.url), "utf8"));   // vercel.json includeFiles ships it

function table(head, list) { return ["| " + head.join(" | ") + " |", "|" + head.map(() => "---").join("|") + "|"].concat(list.map(r => "| " + r.map(cell).join(" | ") + " |")).join("\n"); }

// ---------------- Page method of each screen ----------------
const ALIASES = { "sales cockpit": "salescockpit", cockpit: "salescockpit", "cockpit commercial": "salescockpit", "sales day": "salescycle", "ma journée": "salescycle", "my day": "salescycle",
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
// The Sales cycle SLAs, the setter's included (catalogue in _kb.json, from supabase/functions/_shared/sla_rules.js) with the settings Settings ›
// Alerts saves (crm_settings.sla_rules, 044: sources connected, per SLA on, warn / late / crit in hours, app = alerts of the CRM,
// slack = copy to Slack, off by default since 053). The alerts open now are in clocks_running.
const hrs = h => h == null ? "—" : h < 1 ? Math.round(h * 60) + " min" : h < 48 ? (Math.round(h * 10) / 10) + " h" : Math.round(h / 24) + " d";
export async function alertRules(u, ctx, { include_off }) {
  const cfgRows = await rows(u.from("crm_settings").select("value").eq("key", "sla_rules"));
  const cfg = (cfgRows[0] && cfgRows[0].value) || {}, src = cfg.sources || {}, rules = cfg.rules || {};
  const srcName = Object.fromEntries((KB.sources || []).map(x => [x.id, x.name]));
  const all = (KB.sla || []).map(d => {
    const r = rules[d.id] || {}, on = r.on === undefined ? true : !!r.on;
    const missing = (d.needs || []).filter(n => !src[n]);
    const state = d.applied ? "applied by the CRM" : !d.measured ? (d.kind === "indicator" ? "indicator (Cockpit)" : "not measured yet") : missing.length ? "waiting for " + missing.map(n => srcName[n] || n).join(", ") : "measured";
    const v = k => (r[k] != null ? Number(r[k]) : d[k]);
    const where = [(r.app === undefined ? true : !!r.app) ? "CRM" : "", r.slack ? "Slack" : ""].filter(Boolean).join(" + ") || "nowhere";
    return { id: d.id, name: d.name, stage: d.stage, on, state, target: d.target || "—", late: hrs(v("late")), crit: hrs(v("crit")), where };
  });
  const shown = include_off ? all : all.filter(r => r.on);
  const L = ["# Alerts of the CRM (Settings › Alerts) · " + all.filter(r => r.on).length + " SLAs on of " + all.length,
    "Each open miss becomes an alert of the CRM for the lead's sales rep (admins see the whole team), closed by itself when the action is done. Slack is an optional copy.",
    "Sources connected: " + ((KB.sources || []).map(x => x.name + " " + (src[x.id] ? "yes" : "no")).join(" · ") || "—") + ".", "",
    shown.length ? table(["SLA", "Name", "Stage", "On", "State", "Target", "Late after", "Critical after", "Where"],
      shown.map(r => [r.id, r.name, r.stage, r.on ? "on" : "off", r.state, r.target, r.late, r.crit, r.where])) : "No SLA is on.",
    "", "The alerts open now on the leads: `clocks_running`."];
  return { text: L.join("\n"), rows: all.length };
}
