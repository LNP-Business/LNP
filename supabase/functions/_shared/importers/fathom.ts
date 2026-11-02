// Fathom meeting history (docs/crm/06 §1 and §7): GET https://api.fathom.ai/external/v1/meetings with the X-Api-Key header,
// created_after, include_transcript / include_summary and cursor pages ({items, next_cursor}; VERIFY on the first run). Every
// meeting the key can see is read: the database keeps the sales reps' recordings (025, FL-1), so a recording with no
// calendar invitee is never missed. The items go through the webhook's mapper (mappers/fathom.ts).
import { Canonical } from "../canonical.ts";
import { fathomItem } from "../mappers/fathom.ts";

type Obj = Record<string, any>;
export const FATHOM_BASE = "https://api.fathom.ai/external/v1";

// Fathom limits the API per user (HTTP 429 seen on 2026-10-30 when pages came back to back): pages are read at most one
// every PAGE_GAP_MS, and a 429 waits for Retry-After (else 5, 10, 20… s) before the same page is asked again, 6 times at most.
export const PAGE_GAP_MS = 1100;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function fathomMeetings(key: string, since: string, fetchFn: typeof fetch = fetch, until?: string,
  wait: (ms: number) => Promise<unknown> = sleep): Promise<Obj[]> {
  const out: Obj[] = [], seen = new Set<string>();
  let cursor: string | null = null;
  for (let page = 0; page < 500; page++) {
    const q = new URLSearchParams({ created_after: since, include_transcript: "true", include_summary: "true" });
    if (until) q.set("created_before", until);
    if (cursor) q.set("cursor", cursor);
    if (page) await wait(PAGE_GAP_MS);
    let r = await fetchFn(`${FATHOM_BASE}/meetings?${q}`, { headers: { "X-Api-Key": key, accept: "application/json" } });
    for (let retry = 0; r.status === 429 && retry < 6; retry++) {
      const after = Number(r.headers.get("retry-after"));
      await wait(after > 0 ? after * 1000 : 5000 * 2 ** retry);
      r = await fetchFn(`${FATHOM_BASE}/meetings?${q}`, { headers: { "X-Api-Key": key, accept: "application/json" } });
    }
    if (!r.ok) throw new Error(`Fathom API: HTTP ${r.status} ${(await r.text()).slice(0, 200)}`);
    const j = await r.json();
    for (const m of (j?.items ?? []) as Obj[]) {
      const id = String(m?.recording_id ?? "");
      if (id && seen.has(id)) continue;
      if (id) seen.add(id);
      out.push(m);
    }
    cursor = j?.next_cursor ?? null;
    if (!cursor || !(j?.items ?? []).length) break;
  }
  return out;
}

export function fathomHistoryItems(meetings: Obj[]): { items: Canonical[]; ignored: number } {
  const items: Canonical[] = []; let ignored = 0;
  for (const m of meetings) {
    const r = fathomItem(m, String(m?.created_at ?? new Date().toISOString()));
    if ("ignored" in r) ignored++; else items.push(r);
  }
  return { items, ignored };
}
