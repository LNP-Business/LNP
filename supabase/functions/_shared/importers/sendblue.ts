// Sendblue message history (GET https://api.sendblue.co/api/v2/messages?limit=&offset=, headers sb-api-key-id and
// sb-api-secret-key; answer {data: [...], pagination: {total, limit, offset, hasMore}}, checked 2026-10-25). The items have
// the webhook's fields, so they go through the same mapper (mappers/sendblue.ts) and the same database function.
import { Canonical } from "../canonical.ts";
import { sendblueItems } from "../mappers/sendblue.ts";

type Obj = Record<string, unknown>;
export const SENDBLUE_BASE = "https://api.sendblue.co";
export const sendblueHeaders = (id: string, secret: string) => ({ "sb-api-key-id": id, "sb-api-secret-key": secret, accept: "application/json" });

export async function sendblueAllMessages(id: string, secret: string, fetchFn: typeof fetch = fetch, limit = 100) {
  const out: Obj[] = [], seen = new Set<string>();
  for (let offset = 0, page = 0; page < 2000; page++) {
    const r = await fetchFn(`${SENDBLUE_BASE}/api/v2/messages?limit=${limit}&offset=${offset}`, { headers: sendblueHeaders(id, secret) });
    if (!r.ok) throw new Error(`Sendblue API: HTTP ${r.status} ${(await r.text()).slice(0, 200)}`);
    const j = await r.json();
    const list: Obj[] = j?.data ?? [];
    for (const m of list) { const h = String(m.message_handle ?? ""); if (h && seen.has(h)) continue; if (h) seen.add(h); out.push(m); }
    offset += list.length;
    if (!list.length || !j?.pagination?.hasMore) break;
  }
  return out;
}

// counts only (no content, no number): what an import would bring
export function sendblueReport(msgs: Obj[]) {
  const out: Obj = { messages: msgs.length };
  const count = (k: string, v: unknown) => { const m = (out[k] ??= {}) as Obj; const s = String(v ?? "(none)"); m[s] = ((m[s] as number) ?? 0) + 1; };
  for (const m of msgs) {
    count("direction", m.is_outbound ? "out" : "in"); count("service", m.service); count("status", m.status); count("source", m.source);
    count("message_type", m.message_type); count("group", m.group_id ? "group" : "one-to-one"); count("month", String(m.date_sent ?? "").slice(0, 7));
  }
  return out;
}

export function sendblueHistoryItems(msgs: Obj[]): { items: Canonical[]; ignored: number } {
  const items: Canonical[] = []; let ignored = 0;
  for (const m of msgs) {
    const r = sendblueItems(m, String(m.date_sent ?? new Date().toISOString()));
    if (Array.isArray(r)) items.push(...r); else ignored++;
  }
  return { items, ignored };
}
