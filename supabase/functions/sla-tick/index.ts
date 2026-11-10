// sla-tick: every 5 minutes (pg_cron, 006_crm_cron.sql) the Sales cycle SLAs v3 of every active cycle (docs/crm/18). The rules are
// _shared/sla_rules.js, the same file the Sales cycle screen runs, with the settings of Settings › Alerts (crm_settings.sla_rules,
// through crm_sla_settings: sources, SLAs on or off, thresholds, Slack or not); each new Late or Critical miss is posted once to Slack
// #sales-cycle (IDA workspace) through the incoming webhook in the secret SLACK_SALES_CYCLE_WEBHOOK_URL (028: crm_sla_notices,
// crm_settings.sla_alerts). Takes no input; answers counts only, never names.
import "../_shared/sla_rules.js";
import { restRpc, type Rpc } from "../_shared/worker.ts";
import { slackText, toLead, type Snap } from "../_shared/sla_view.ts";

// deno-lint-ignore no-explicit-any
const SLA = (globalThis as any).LNP_SLA;

export async function tick(rpc: Rpc, post: (text: string) => Promise<boolean>, now = Date.now(), settings?: Record<string, unknown>) {
  const cfg = settings ?? {};
  const since = cfg.since ? Date.parse(String(cfg.since)) : now, maxAge = Number(cfg.max_age_hours ?? 6) * 3600e3;
  // the settings saved in Settings › Alerts (crm_settings.sla_rules): sources connected, SLAs on, thresholds, Slack or not
  SLA.configure(cfg.sla_rules || {});
  const cycles = (await rpc("crm_sla_snapshot", { p_days: 60 })) as Snap[];
  const items: Record<string, unknown>[] = [];
  for (const c of cycles || []) {
    const l = toLead(c, now);
    for (const b of SLA.evaluate(l, { t0: l.opened, tz: cfg.window_tz || "Europe/Paris", surface: "slack" })) {
      if (!b.open || (b.level !== "late" && b.level !== "crit")) continue;
      const crossed = l.opened + b.at * 3600e3;
      if (crossed < since || now - crossed > maxAge) continue;
      items.push({ key: `${c.id}:${b.id}:${Math.round(b.start * 60)}:${b.level}`, cycle_id: c.id, sla: b.id, level: b.level,
        crossed_at: new Date(crossed).toISOString(), name: b.name, person: c.person || "un prospect", owner: c.owner || "sans commercial attitré",
        elapsed: SLA.said(b), extra: b.extra, target: b.target, kind: b.kind });
    }
  }
  if (!items.length) return { cycles: (cycles || []).length, new: 0, posted: false };
  const fresh = new Set((await rpc("crm_sla_claim", { p_items: items.map(({ key, cycle_id, sla, level, crossed_at }) => ({ key, cycle_id, sla, level, crossed_at })) })) as string[]);
  const send = items.filter((x) => fresh.has(String(x.key)));
  if (!send.length) return { cycles: cycles.length, new: 0, posted: false };
  // deno-lint-ignore no-explicit-any
  const ok = await post(slackText(send as any, String(cfg.link || "https://lnp-sales.vercel.app/#crm")));
  return { cycles: cycles.length, new: send.length, posted: ok };
}

if (import.meta.main) Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("POST only", { status: 405 });
  const hook = Deno.env.get("SLACK_SALES_CYCLE_WEBHOOK_URL") ?? "";
  // without the webhook nothing is claimed: the misses stay to post once it is set (within max_age_hours)
  if (!hook) return Response.json({ error: "SLACK_SALES_CYCLE_WEBHOOK_URL is not set" }, { status: 409 });
  try {
    const rpc = restRpc(), cfg = (await rpc("crm_sla_settings", {})) as Record<string, unknown> | null;
    const out = await tick(rpc, async (text) => (await fetch(hook, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text }) })).ok,
      Date.now(), cfg ?? {});
    return Response.json(out);
  } catch (e) {
    return Response.json({ error: String((e as Error).message || e) }, { status: 500 });
  }
});
