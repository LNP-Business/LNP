// The worker behind process-inbox: pending rows -> mapper -> crm_apply_items (one transaction per row in the database).
import { MapResult } from "./canonical.ts";
import { mapIclosed } from "./mappers/iclosed.ts";
import { mapWhatsapp } from "./mappers/whatsapp.ts";
import { mapFunnel } from "./mappers/funnel.ts";
import { mapFathom } from "./mappers/fathom.ts";

type Row = { id: number; source: string; body: string; auth_ok: boolean | null; received_at: string };
export type Rpc = (fn: string, args: Record<string, unknown>) => Promise<unknown>;

// sources with a mapper; the others stay "received" until their phase
export const MAPPERS: Record<string, (raw: string, receivedAt: string) => MapResult> = { iclosed: mapIclosed, whatsapp: mapWhatsapp, fathom: mapFathom, funnel: mapFunnel };
// the database function that applies each source's items (005 for bookings, 052 for WhatsApp messages, 025 for recordings)
export const APPLY: Record<string, string> = { iclosed: "crm_apply_items", whatsapp: "crm_apply_messages", fathom: "crm_apply_recordings", funnel: "crm_apply_leads" };
// item types with their own database function, whatever the source (023: an iClosed lead's new name, email or phone)
export const APPLY_TYPE: Record<string, string> = { contact_updated: "crm_apply_contact" };

export async function processPending(rpc: Rpc, limit = 50): Promise<Record<string, number>> {
  const rows = (await rpc("crm_inbox_pending", { p_sources: Object.keys(MAPPERS), p_limit: limit })) as Row[];
  const done: Record<string, number> = {};
  const count = (k: string) => (done[k] = (done[k] ?? 0) + 1);
  for (const row of rows) {
    try {
      if (!row.auth_ok) {
        await rpc("crm_inbox_mark", { p_inbox: row.id, p_status: "rejected", p_error: "failed its token or signature check" });
        count("rejected");
        continue;
      }
      const res = MAPPERS[row.source](row.body, new Date(row.received_at).toISOString());
      if ("ignored" in res) {
        await rpc("crm_inbox_mark", { p_inbox: row.id, p_status: "ignored", p_error: res.ignored });
        count("ignored");
        continue;
      }
      const fn = APPLY_TYPE[res.items[0]?.type] ?? APPLY[row.source] ?? "crm_apply_items";
      count(String(await rpc(fn, { p_inbox: row.id, p_items: res.items })));
    } catch (e) {
      await rpc("crm_inbox_mark", { p_inbox: row.id, p_status: "failed", p_error: String((e as Error)?.message ?? e) }).catch(() => {});
      count("failed");
    }
  }
  return { rows: rows.length, ...done };
}

export function restRpc(): Rpc {
  const base = Deno.env.get("SUPABASE_URL"), key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  return async (fn, args) => {
    const r = await fetch(`${base}/rest/v1/rpc/${fn}`, {
      method: "POST",
      headers: { apikey: key!, authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify(args),
    });
    const text = await r.text();
    if (!r.ok) throw new Error(`${fn}: HTTP ${r.status} ${text.slice(0, 300)}`);
    return text ? JSON.parse(text) : null;
  };
}

export function makeWorker(rpc: Rpc = restRpc()) {
  return async (_req: Request): Promise<Response> => {
    try {
      const summary = await processPending(rpc);
      return new Response(JSON.stringify(summary), { headers: { "content-type": "application/json" } });
    } catch (e) {
      console.error("process-inbox:", String((e as Error)?.message ?? e).slice(0, 300));
      return new Response(JSON.stringify({ error: "queue unavailable" }), { status: 500, headers: { "content-type": "application/json" } });
    }
  };
}
