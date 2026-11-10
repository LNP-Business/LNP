// sla-tick: every 5 minutes (pg_cron, 006_crm_cron.sql) the Sales cycle SLAs v3 of every active cycle (docs/crm/18). The rules are
// _shared/sla_rules.js, the same file the Sales cycle screen runs, with the settings of Settings › Alerts (crm_settings.sla_rules,
// through crm_sla_settings: sources, SLAs on or off, thresholds, CRM and Slack).
// 1. The CRM first (053, Romain 2026-11-09): every open miss (Bientôt dû, En retard, Critique) becomes an alert of the CRM
//    (crm_sync_sla_alerts): opened, moved up a level, closed by itself when the SLA stops. The sales rep sees the alerts of the
//    cycles they own, an admin all of them (Alertes screen, badge, Ma journée).
// 2. Slack, only for the SLAs switched on for Slack (off by default) and only when the secret SLACK_SALES_CYCLE_WEBHOOK_URL is
//    set: each new Late or Critical miss posted once (028: crm_sla_notices, crm_settings.sla_alerts).
// Takes no input; answers counts only, never names.
import "../_shared/sla_rules.js";
import { restRpc, type Rpc } from "../_shared/worker.ts";
import { slackText, toLead, type Snap } from "../_shared/sla_view.ts";

// deno-lint-ignore no-explicit-any
const SLA = (globalThis as any).LNP_SLA;

export async function tick(rpc: Rpc, post: ((text: string) => Promise<boolean>) | null, now = Date.now(), settings?: Record<string, unknown>) {
  const cfg = settings ?? {};
  const since = cfg.since ? Date.parse(String(cfg.since)) : now, maxAge = Number(cfg.max_age_hours ?? 6) * 3600e3;
  const tz = String(cfg.window_tz || "Europe/Paris");
  // the settings saved in Settings › Alerts (crm_settings.sla_rules): sources connected, SLAs on, thresholds, CRM and Slack
  SLA.configure(cfg.sla_rules || {});
  const cycles = ((await rpc("crm_sla_snapshot", { p_days: 60 })) as Snap[]) || [];
  // 1. the alerts of the CRM: every open miss, whatever its age (an alert stays open until the action is done)
  const alerts: Record<string, unknown>[] = [];
  for (const c of cycles) {
    const l = toLead(c, now);
    for (const b of SLA.evaluate(l, { t0: l.opened, tz, surface: "screen" })) {
      if (!b.open || b.kind === "indicator" || !["warn", "late", "crit"].includes(b.level)) continue;
      const iso = (h: number) => new Date(l.opened + h * 3600e3).toISOString();
      alerts.push({ key: `${c.id}:${b.id}:${Math.round(b.start * 60)}`, cycle_id: c.id, sla: b.id, kind: b.kind, level: b.level, name: b.name,
        detail: b.extra || null, target: b.target || null, started_at: iso(b.start), crossed_at: iso(b.at) });
    }
  }
  const crm = await rpc("crm_sync_sla_alerts", { p_items: alerts });
  // 2. Slack, as a copy, for the SLAs switched on for it
  if (!post) return { cycles: cycles.length, alerts: crm, new: 0, posted: false };
  const items: Record<string, unknown>[] = [];
  for (const c of cycles) {
    const l = toLead(c, now);
    for (const b of SLA.evaluate(l, { t0: l.opened, tz, surface: "slack" })) {
      if (!b.open || (b.level !== "late" && b.level !== "crit")) continue;
      const crossed = l.opened + b.at * 3600e3;
      if (crossed < since || now - crossed > maxAge) continue;
      items.push({ key: `${c.id}:${b.id}:${Math.round(b.start * 60)}:${b.level}`, cycle_id: c.id, sla: b.id, level: b.level,
        crossed_at: new Date(crossed).toISOString(), name: b.name, person: c.person || "un prospect", owner: c.owner || "sans commercial attitré",
        elapsed: SLA.said(b), extra: b.extra, target: b.target, kind: b.kind });
    }
  }
  if (!items.length) return { cycles: cycles.length, alerts: crm, new: 0, posted: false };
  const fresh = new Set((await rpc("crm_sla_claim", { p_items: items.map(({ key, cycle_id, sla, level, crossed_at }) => ({ key, cycle_id, sla, level, crossed_at })) })) as string[]);
  const send = items.filter((x) => fresh.has(String(x.key)));
  if (!send.length) return { cycles: cycles.length, alerts: crm, new: 0, posted: false };
  // deno-lint-ignore no-explicit-any
  const ok = await post(slackText(send as any, String(cfg.link || "https://lnp-sales.vercel.app/#alertes")));
  return { cycles: cycles.length, alerts: crm, new: send.length, posted: ok };
}

if (import.meta.main) Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("POST only", { status: 405 });
  // Slack is optional: without the webhook only the alerts of the CRM are written
  const hook = Deno.env.get("SLACK_SALES_CYCLE_WEBHOOK_URL") ?? "";
  try {
    const rpc = restRpc(), cfg = (await rpc("crm_sla_settings", {})) as Record<string, unknown> | null;
    const post = hook ? async (text: string) => (await fetch(hook, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text }) })).ok : null;
    return Response.json(await tick(rpc, post, Date.now(), cfg ?? {}));
  } catch (e) {
    return Response.json({ error: String((e as Error).message || e) }, { status: 500 });
  }
});
