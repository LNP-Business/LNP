// Close (close.com) leads -> import items (one per contact). VERIFY on the first dry run: field names follow Close's
// public API (GET /api/v1/lead/, Basic auth with the API key as user name).
import { normEmail, normPhone } from "../normalize.ts";

type Obj = Record<string, any>;
export type ImportItem = {
  source_ref: string; name: string | null; occurred_at: string | null;
  identity: { email: string[]; phone: string[]; close_contact_id?: string; iclosed_contact_id?: string };
  data: Obj;
};

export function closeLeadToItems(lead: Obj): ImportItem[] {
  const opps = (lead.opportunities ?? []).map((o: Obj) => ({
    status_label: o.status_label ?? null, status_type: o.status_type ?? null, value: o.value ?? null,
    value_currency: o.value_currency ?? null, date_won: o.date_won ?? null, date_created: o.date_created ?? null,
  }));
  const data = { close_lead_id: lead.id, lead_name: lead.display_name ?? lead.name ?? null, status_label: lead.status_label ?? null, opportunities: opps };
  const contacts: Obj[] = lead.contacts?.length ? lead.contacts : [{}];
  return contacts.map((c, i) => ({
    source_ref: `${lead.id}:${c.id ?? i}`,
    name: c.name ?? lead.display_name ?? null,
    occurred_at: lead.date_created ?? null,
    identity: {
      email: [...new Set((c.emails ?? []).map((e: Obj) => normEmail(e.email)).filter(Boolean) as string[])],
      phone: [...new Set((c.phones ?? []).map((p: Obj) => normPhone(p.phone ?? p.phone_formatted)).filter(Boolean) as string[])],
      ...(c.id ? { close_contact_id: String(c.id) } : {}),
    },
    data,
  }));
}

export async function* closePages(apiKey: string, startSkip = 0, limit = 100, fetchFn: typeof fetch = fetch) {
  const auth = "Basic " + btoa(apiKey + ":");
  let skip = startSkip;
  while (true) {
    const url = `https://api.close.com/api/v1/lead/?_limit=${limit}&_skip=${skip}` +
      "&_fields=id,display_name,status_label,date_created,contacts,opportunities";
    const r = await fetchFn(url, { headers: { authorization: auth, accept: "application/json" } });
    if (!r.ok) throw new Error(`Close API: HTTP ${r.status} ${(await r.text()).slice(0, 200)}`);
    const j = await r.json();
    const leads: Obj[] = j.data ?? [];
    skip += leads.length;
    yield { leads, skip, more: !!j.has_more && leads.length > 0 };
    if (!j.has_more || !leads.length) return;
  }
}
