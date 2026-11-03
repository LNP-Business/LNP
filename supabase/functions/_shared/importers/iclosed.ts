// iClosed contacts -> import items (GET /v1/contacts, ?limit=100&page=N with N from 0; Bearer iclosed_<key>).
// The iClosed status (DISCOVERY_CALL_BOOKED, POTENTIAL, QUALIFIED, STRATEGY_CALL_BOOKED, DISQUALIFIED) is kept as
// status_label on the person's `imported` event, like the Close status.
import { normEmail, normPhone } from "../normalize.ts";
import type { ImportItem } from "./close.ts";
import { ICLOSED_BASE, iclosedHeaders } from "./probe.ts";

type Obj = Record<string, any>;

// iClosed limits its API (HTTP 429 "RATE_LIMIT_EXCEEDED" seen on 2026-11-03 when pages came back to back; its Retry-After is
// shorter than the time its quota takes to refill, so six retries one second apart all failed): pages are read at most one
// every ICLOSED_PAGE_GAP_MS, and a 429 waits at least 5, 10, 20, then 30 s (longer if Retry-After says so) before the same
// page is asked again, 6 times at most (about 2 min, inside a function's run time). The error then names the last Retry-After.
export const ICLOSED_PAGE_GAP_MS = 1100;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
type Wait = (ms: number) => Promise<unknown>;

async function iclosedGet(url: string, headers: HeadersInit, fetchFn: typeof fetch, wait: Wait): Promise<Obj> {
  let r = await fetchFn(url, { headers });
  for (let retry = 0; r.status === 429 && retry < 6; retry++) {
    const after = Number(r.headers.get("retry-after"));
    await wait(Math.max(after > 0 ? after * 1000 : 0, Math.min(5000 * 2 ** retry, 30000)));
    r = await fetchFn(url, { headers });
  }
  if (!r.ok) throw new Error(`iClosed API: HTTP ${r.status}${r.status === 429 ? ` (Retry-After ${r.headers.get("retry-after") ?? "—"})` : ""} ${(await r.text()).slice(0, 200)}`);
  return await r.json();
}

export function iclosedContactToItem(c: Obj): ImportItem {
  const name = [c.firstName, c.lastName].map((x) => String(x ?? "").trim()).filter(Boolean).join(" ") || null;
  return {
    source_ref: `iclosed:${c.id}`,
    name,
    occurred_at: c.createdAt ?? null,
    identity: {
      email: [...new Set([c.email, c.secondary_email].map(normEmail).filter(Boolean) as string[])],
      phone: [...new Set([c.phoneNumber, c.secondary_phoneNumber].map(normPhone).filter(Boolean) as string[])],
      iclosed_contact_id: String(c.id),
    },
    data: {
      iclosed_contact_id: c.id, status_label: c.status ?? null, country: c.country ?? null, time_zone: c.timeZone ?? null,
      owner_email: normEmail(c.user?.email), events: (c.ContactEvents ?? []).map((e: Obj) => e.name).filter(Boolean),
    },
  };
}

// Stops on an empty page, on a page with nothing new (the API repeating itself) or once the announced count is reached.
export async function* iclosedPages(apiKey: string, startPage = 0, limit = 100, fetchFn: typeof fetch = fetch, wait: Wait = sleep) {
  const headers = iclosedHeaders(apiKey), seen = new Set<number>();
  for (let page = startPage; page < startPage + 500; page++) {
    if (page > startPage) await wait(ICLOSED_PAGE_GAP_MS);
    const j = await iclosedGet(`${ICLOSED_BASE}/v1/contacts?limit=${limit}&page=${page}`, headers, fetchFn, wait);
    const total = Number(j?.data?.count ?? 0);
    const contacts = ((j?.data?.contacts ?? []) as Obj[]).filter((c) => !seen.has(c.id));
    contacts.forEach((c) => seen.add(c.id));
    const more = contacts.length > 0 && (page + 1) * limit < total;
    yield { contacts, next: page + 1, more };
    if (!more) return;
  }
}

// ── calls (GET /v1/eventCalls) → one item per contact for crm_import_calls (009) ──
const CANCELED = new Set(["ADMIN_CANCELLED", "CONTACT_CANCELLED"]);
const DISQUALIFIED = new Set(["UNQUALIFIED", "BAD_FIT"]);   // and REJECTED when the call was not canceled

export function iclosedCallStatus(c: Obj): "scheduled" | "canceled" | "held" | "no_show" {
  const t = (c.task ?? [])[0] ?? {};
  if (c.cancelReason || c.cancelledBy || CANCELED.has(t.noSaleReason)) return "canceled";
  if (t.noSaleReason === "NO_SHOW") return "no_show";
  return t.outcome ? "held" : "scheduled";
}

const startOf = (c: Obj) => new Date(c.dateTimeUTC ?? c.dateTime).toISOString();
function endOf(c: Obj) {
  const mins = Number(c.duration ?? 0) * (/hour/i.test(String(c.durationUnit ?? "")) ? 60 : 1);
  return mins > 0 ? new Date(new Date(startOf(c)).getTime() + mins * 60e3).toISOString() : null;
}

// The CRM status the call history gives the cycle (corrected 2026-10-25, see 013_crm_reclassify.sql): a sale, a deal, an
// onboarding or case-study call = won; the LATEST call ended UNQUALIFIED, BAD_FIT or REJECTED without a cancellation =
// disqualified (iClosed puts REJECTED on canceled discovery calls); a call ahead or in the last 30 days = active (null);
// else lost (unreachable after a no-show, timing otherwise).
const WON_EVENT = /onboarding|case stud/i;
export function iclosedClose(calls: Obj[], now = Date.now()): { status: string; reason: string | null; at: string } | null {
  const sorted = [...calls].sort((a, b) => startOf(a).localeCompare(startOf(b)));
  const task = (c: Obj) => (c.task ?? [])[0] ?? {};
  const won = sorted.find((c) => task(c).outcome === "WON" || (c.deals ?? []).length || WON_EVENT.test(String(c.event?.name ?? "")));
  if (won) return { status: "won", reason: null, at: startOf(won) };
  const last = sorted[sorted.length - 1], t = task(last);
  if (DISQUALIFIED.has(t.noSaleReason) || (t.outcome === "REJECTED" && !CANCELED.has(t.noSaleReason))) {
    return { status: "disqualified", reason: "dq_off_target", at: startOf(last) };
  }
  const lastResult = [...sorted].reverse().find((c) => task(c).outcome || task(c).noSaleReason);
  const ahead = sorted.some((c) => new Date(startOf(c)).getTime() > now && iclosedCallStatus(c) !== "canceled");
  if (ahead || new Date(startOf(last)).getTime() > now - 30 * 864e5) return null;
  return { status: "lost", reason: lastResult && task(lastResult).noSaleReason === "NO_SHOW" ? "unreachable" : "timing", at: startOf(last) };
}

export function iclosedCallsToItems(calls: Obj[], now = Date.now()) {
  const byContact = new Map<string, Obj[]>();
  for (const c of calls) {
    const k = String(c.contactId ?? c.contact?.email ?? c.inviteeEmail ?? c.id);
    byContact.set(k, [...(byContact.get(k) ?? []), c]);
  }
  return [...byContact.values()].map((list) => {
    const sorted = [...list].sort((a, b) => startOf(a).localeCompare(startOf(b)));
    const emails = new Set<string>(), phones = new Set<string>();
    for (const c of sorted) {
      for (const e of [c.contact?.email, c.inviteeEmail, c.contact?.secondary_email].map(normEmail)) if (e) emails.add(e);
      for (const p of [c.contact?.phoneNumber, c.phoneNumber, c.contact?.secondary_phoneNumber].map(normPhone)) if (p) phones.add(p);
    }
    const first = sorted[0];
    return {
      name: String(first.inviteeName ?? "").trim() || null,
      identity: { email: [...emails], phone: [...phones], ...(first.contactId ? { iclosed_contact_id: String(first.contactId) } : {}) },
      calls: sorted.map((c) => {
        const t = (c.task ?? [])[0] ?? {};
        return {
          iclosed_call_id: String(c.id), booked_at: c.createdAt ?? null, start: startOf(c), end: endOf(c),
          host_email: normEmail(c.user?.email), status: iclosedCallStatus(c), canceled_at: c.updatedAt ?? null,
          data: { iclosed_call_type: c.callType ?? null, event_name: c.event?.name ?? null, iclosed_outcome: t.outcome ?? null,
            no_sale_reason: t.noSaleReason ?? null, objection: t.objection ?? null, cancel_reason: c.cancelReason ?? null,
            reschedule_reason: c.rescheduleReason ?? null },
        };
      }),
      close: iclosedClose(sorted, now),
    };
  });
}

export async function iclosedAllCalls(apiKey: string, fetchFn: typeof fetch = fetch, limit = 100, wait: Wait = sleep) {
  const headers = iclosedHeaders(apiKey), seen = new Map<number, Obj>();
  for (let page = 0; page < 500; page++) {
    if (page) await wait(ICLOSED_PAGE_GAP_MS);
    const j = await iclosedGet(`${ICLOSED_BASE}/v1/eventCalls?limit=${limit}&page=${page}`, headers, fetchFn, wait);
    const list: Obj[] = j?.data?.eventCalls ?? [];
    const before = seen.size;
    for (const c of list) seen.set(c.id, c);
    if (!list.length || seen.size === before || seen.size >= Number(j?.data?.count ?? 0)) break;
  }
  return [...seen.values()];
}
