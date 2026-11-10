// Builds web/api/_kb.json: the parts of LNP that live in the page itself, not in the database, for the Claude connector
// (docs/crm/17-claude-connector.md §9). Run by build.sh stage 4: node web/kb/build_kb.mjs
//   - the Page method popup of every LNP screen (gabarits/<Screen>.dc.html, written by stage 2)
//   - the sidebar: where each screen is and the access key that opens it (Settings › Access, web/api/_screens.js)
//   - the catalogue of the 42 Sales cycle SLAs (supabase/functions/_shared/sla_rules.js), for the alert_rules tool
// A screen whose file is missing is left out (never an error), so the connector keeps working when screens change.
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const ROOT = new URL("../../", import.meta.url);
const read = p => readFileSync(new URL(p, ROOT), "utf8");
const has = p => existsSync(new URL(p, ROOT));

// LNP's screens, in the order of the sidebar: file, access key, where it is (the labels the person sees)
const SCREENS = [
  ["SalesCockpit", "salescockpit", "Ventes › Cockpit commercial", "the sales figures from lead to payment: funnel, show and close rates, money collected, pipeline, team"],
  ["Entrainement", "entrainement", "Entraînement › Découverte", "discovery training for the sales reps: « Le coup suivant » (choose the next SPIN gesture L1 to L4, write the question, compare to the reference) and « La lettre imposée » (three implication questions in a row)"],
  ["Academie", "academie", "Entraînement › Maîtrise de l'offre", "the offer training (« Académie sales LNP »): 100 cases from real calls, answer the prospect (format A, 90 s) or review an excerpt (format B), the rep validates their answer, then self-corrects it against the trainer's grid and the corrigé, validated at 8/10"],
  ["Resultats", "resultats", "Entraînement › Mes résultats", "each person's training results, kept on their account and never deleted: training score out of 100, exercises, active time, history"],
  ["SuiviCommerciaux", "suivi", "Entraînement › Suivi des commerciaux", "admins only: per sales rep, the training score, exercises and time spent, next to their calls held, sales, revenue signed and collected"],
  ["SalesDay", "salesday", "Ventes › Ma journée", "the sales rep's day, one lead at a time: outcomes to declare, calls within 24 h, reschedules, no-shows, follow-ups"],
  ["Alertes", "alertes", "Ventes › Alertes", "the alerts of the CRM: each lead late on a sales cycle SLA, for its sales rep (admins: the whole team); closed by itself when the action is done"],
  ["CRM", "crm", "Ventes › CRM", "Pipeline, Leads, Sales cycle, the lead record, call analysis and the payment window"],
  ["Settings", "settings", "Paramètres › Alertes", "the alert rules: on or off, threshold, severity, who is told and how"],
  ["Account", "account", "Paramètres › Compte", "the signed-in account (sign out) and the team; always open"],
  ["Access", "access", "Paramètres › Accès", "which screens each person can open and who may use the Claude connector (admins only)"]
];


const text = h => h.replace(/<(br|\/p|\/li|\/h\d|\/div)\b[^>]*>/gi, "\n").replace(/<li\b[^>]*>/gi, "- ").replace(/<[^>]+>/g, "")
  .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&rsquo;/g, "'")
  .replace(/&[a-z]+;/g, " ").replace(/\{\{[^}]*\}\}/g, "").replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();

function pageMethod(file) {
  const p = "gabarits/" + file + ".dc.html";
  if (!has(p)) return null;
  const h = read(p), i = h.indexOf('aria-labelledby="info-title"');
  if (i < 0) return null;
  const start = h.lastIndexOf("<div", i), stop = h.indexOf("</dialog>", i) > 0 ? h.indexOf("</dialog>", i) : h.indexOf("<main", i);
  return text(h.slice(start, stop > 0 ? stop : i + 8000)).slice(0, 4000);
}

const screens = SCREENS.map(([file, key, where, about]) => ({ screen: file, key, where, about, method: pageMethod(file) }))
  .filter(s => has("gabarits/" + s.screen + ".dc.html"));
// the SLA catalogue, as Settings › Alerts shows it (thresholds in hours; needs = the data sources an SLA reads)
await import(new URL("supabase/functions/_shared/sla_rules.js", ROOT).href);
const L = globalThis.LNP_SLA;
const sla = L.DEFS.map(d => ({ id: d.id, name: d.name, stage: d.stage, kind: d.kind, target: d.target, warn: d.warn, late: d.late, crit: d.crit,
  needs: d.needs || [], measured: !!d.eval, applied: !!d.applied, pending: d.pending || "" }));
const sources = L.SOURCES.map(s => ({ id: s.id, name: s.name }));
const kb = { built_from: "LNP sources (build.sh stage 4)", screens, sla, sources };
writeFileSync(new URL("web/api/_kb.json", ROOT), JSON.stringify(kb));
console.log("kb", screens.map(s => s.screen + (s.method ? " " + s.method.length : " (no page method)")).join(", "));
