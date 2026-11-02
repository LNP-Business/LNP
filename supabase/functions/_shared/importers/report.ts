// Read-only report before the import: iClosed contact statuses (e.g. DISQUALIFIED) crossed with the Close contacts, matched
// by email or phone like crm_import_people. Counts by default; names only for a caller holding CRM_REPORT_TOKEN.
import { normEmail, normPhone } from "../normalize.ts";
import { closePages } from "./close.ts";
import { ICLOSED_BASE } from "./probe.ts";

type Obj = Record<string, any>;
type Fetch = typeof fetch;

// iClosed pages its lists with ?page= starting at 0 (page=1 is the second page); stops on an empty or repeated page.
export async function iclosedContacts(headers: Record<string, string>, fetchFn: Fetch = fetch, limit = 100) {
  const seen = new Map<number, Obj>();
  let total = 0;
  for (let page = 0; page < 200; page++) {
    const r = await fetchFn(`${ICLOSED_BASE}/v1/contacts?limit=${limit}&page=${page}`, { headers });
    if (!r.ok) throw new Error(`iClosed API: HTTP ${r.status} ${(await r.text()).slice(0, 200)}`);
    const j = await r.json();
    total = j?.data?.count ?? total;
    const list: Obj[] = j?.data?.contacts ?? [];
    const before = seen.size;
    for (const c of list) seen.set(c.id, c);
    if (!list.length || seen.size === before || seen.size >= total) break;
  }
  return { total, contacts: [...seen.values()] };
}

export function crossStatuses(iclosed: Obj[], close: { name: string | null; status: string | null; emails: string[]; phones: string[] }[]) {
  const byKey = new Map<string, Obj>();
  for (const c of iclosed) {
    for (const e of [c.email, c.secondary_email].map(normEmail)) if (e) byKey.set("e:" + e, c);
    for (const p of [c.phoneNumber, c.secondary_phoneNumber].map(normPhone)) if (p) byKey.set("p:" + p, c);
  }
  const count = (m: Obj, k: string) => { m[k] = (m[k] ?? 0) + 1; };
  const iclosedStatuses: Obj = {}, matchedStatuses: Obj = {};
  for (const c of iclosed) count(iclosedStatuses, String(c.status ?? "(none)"));
  const matchedIds = new Set<number>(), disqualified: Obj[] = [];
  let matched = 0;
  for (const p of close) {
    const hit = [...p.emails.map((e) => "e:" + e), ...p.phones.map((x) => "p:" + x)].map((k) => byKey.get(k)).find(Boolean);
    if (!hit) continue;
    matched++; matchedIds.add(hit.id);
    const st = String(hit.status ?? "(none)");
    count(matchedStatuses, st);
    if (/disqualif/i.test(st)) disqualified.push({ name: p.name, phone: p.phones[0] ?? null, close_status: p.status, iclosed_status: st, iclosed_since: hit.createdAt ?? null });
  }
  const iclosedOnlyDisqualified = iclosed.filter((c) => !matchedIds.has(c.id) && /disqualif/i.test(String(c.status)));
  return {
    counts: { iclosed_contacts: iclosed.length, iclosed_statuses: iclosedStatuses, close_contacts: close.length,
      close_found_in_iclosed: matched, statuses_of_close_contacts_in_iclosed: matchedStatuses,
      close_contacts_disqualified_in_iclosed: disqualified.length, disqualified_in_iclosed_not_in_close: iclosedOnlyDisqualified.length },
    disqualified,
  };
}

export async function statusReport(o: { iclosedHeaders: Record<string, string>; closeKey: string; names: boolean; fetchFn?: Fetch }) {
  const { contacts } = await iclosedContacts(o.iclosedHeaders, o.fetchFn);
  const close: { name: string | null; status: string | null; emails: string[]; phones: string[] }[] = [];
  for await (const page of closePages(o.closeKey, 0, 100, o.fetchFn)) {
    for (const lead of page.leads) for (const c of (lead.contacts?.length ? lead.contacts : [{}])) close.push({
      name: c.name ?? lead.display_name ?? null, status: lead.status_label ?? null,
      emails: (c.emails ?? []).map((e: Obj) => normEmail(e.email)).filter(Boolean),
      phones: (c.phones ?? []).map((p: Obj) => normPhone(p.phone ?? p.phone_formatted)).filter(Boolean),
    });
  }
  const r = crossStatuses(contacts, close);
  return o.names ? r : { counts: r.counts };
}

// Read-only counts over iClosed's calls (no personal data): what a call import would have to translate.
export async function callsReport(headers: Record<string, string>, fetchFn: Fetch = fetch, limit = 100) {
  const seen = new Map<number, Obj>();
  for (let page = 0; page < 200; page++) {
    const r = await fetchFn(`${ICLOSED_BASE}/v1/eventCalls?limit=${limit}&page=${page}`, { headers });
    if (!r.ok) throw new Error(`iClosed API: HTTP ${r.status} ${(await r.text()).slice(0, 200)}`);
    const j = await r.json();
    const list: Obj[] = j?.data?.eventCalls ?? [];
    const before = seen.size;
    for (const c of list) seen.set(c.id, c);
    if (!list.length || seen.size === before || seen.size >= Number(j?.data?.count ?? 0)) break;
  }
  const calls = [...seen.values()], now = Date.now(), out: Obj = {};
  const count = (k: string, v: unknown) => { const m = (out[k] ??= {}); const s = String(v ?? "(none)"); m[s] = (m[s] ?? 0) + 1; };
  const perContact = new Map<number, number>();
  for (const c of calls) {
    count("call_type", c.callType); count("event_type", c.eventType); count("event_name", c.event?.name);
    count("when", new Date(c.dateTimeUTC ?? c.dateTime).getTime() < now ? "past" : "future");
    count("canceled", c.cancelReason || c.cancelledBy ? "yes" : "no");
    count("rescheduled", c.rescheduledBy || c.rescheduleReason ? "yes" : "no");
    const t = (c.task ?? [])[0] ?? {};
    count("task_outcome", t.outcome); count("task_completed", t.completed); count("no_sale_reason", t.noSaleReason);
    count("objection", t.objection); count("deals", (c.deals ?? []).length);
    count("month", String(c.dateTimeUTC ?? c.dateTime).slice(0, 7));
    perContact.set(c.contactId, (perContact.get(c.contactId) ?? 0) + 1);
  }
  for (const n of perContact.values()) count("calls_per_contact", n);
  return { calls: calls.length, contacts_with_calls: perContact.size, ...out };
}
