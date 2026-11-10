// deno test --allow-env --allow-read supabase/tests
import { closeLeadToItems } from "../functions/_shared/importers/close.ts";
import { addStats, importClose } from "../functions/_shared/import_run.ts";

function eq<T>(a: T, b: T, msg = "") {
  if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${msg} expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}
const lead = (id: string, contacts: unknown[]) => ({ id, display_name: "Lead " + id, status_label: "Interested", date_created: "2026-09-01T10:00:00Z",
  contacts, opportunities: [{ id: "o1", status_label: "Won", status_type: "won", value: 350000, value_currency: "USD", date_won: "2026-09-10" }] });

Deno.test("close: one item per contact, normalised identifiers, history kept", () => {
  const items = closeLeadToItems(lead("lead_1", [
    { id: "cont_1", name: "Jane Roe", emails: [{ email: " Jane@Ex.com " }, { email: "jane@ex.com" }], phones: [{ phone: "+1 415 555 2671" }, { phone: "0612" }] },
    { id: "cont_2", name: "Partner", emails: [], phones: [] },
  ]));
  eq(items.length, 2);
  eq(items[0].source_ref, "lead_1:cont_1");
  eq(items[0].identity, { email: ["jane@ex.com"], phone: ["+14155552671"], close_contact_id: "cont_1" });
  eq(items[0].data.opportunities[0].status_type, "won");
  eq(items[0].data.close_lead_id, "lead_1");
  eq(closeLeadToItems(lead("lead_2", [])).length, 1, "a lead with no contact still counts:");
});

Deno.test("stats add up, nested statuses too", () => {
  eq(addStats({ created: 1, statuses: { Won: 1 } }, { created: 2, statuses: { Won: 1, Lost: 3 } }), { created: 3, statuses: { Won: 2, Lost: 3 } });
});

function fakes(pages: unknown[][]) {
  const calls: [string, any][] = [], rest: any[] = [];
  let i = 0;
  const fetchFn = (async (url: string, init: any) => {
    if (!String(init.headers.authorization).startsWith("Basic ")) throw new Error("no auth");
    const data = pages[i] ?? []; i++;
    return new Response(JSON.stringify({ data, has_more: i < pages.length }), { status: 200 });
  }) as unknown as typeof fetch;
  const rpc = (fn: string, a: any) => { calls.push([fn, a]); return Promise.resolve(fn === "crm_import_people" ? { created: a.p_items.length, statuses: { Interested: a.p_items.length } } : null); };
  const restFn = (m: string, p: string, b?: any) => { rest.push([m, p, b]); return Promise.resolve(m === "POST" ? [{ id: "run1", cursor: b.cursor, stats: {}, dry_run: b.dry_run }] : []); };
  return { calls, rest, fetchFn, rpc, restFn };
}

Deno.test("import run: a dry run sends everything at once, a real run page by page", async () => {
  let f = fakes([[lead("a", [{ id: "c1" }]), lead("b", [{ id: "c2" }])], [lead("c", [{ id: "c3" }])]]);
  let out = await importClose({ rpc: f.rpc, rest: f.restFn, apiKey: "k", dry: true, run: null, fetchFn: f.fetchFn });
  const people = f.calls.filter((c) => c[0] === "crm_import_people");
  eq(people.length, 1, "one call:"); eq(people[0][1].p_items.length, 3); eq(people[0][1].p_dry, true);
  eq(out.stats!.leads, 3); eq(out.dry, true);

  f = fakes([[lead("a", [{ id: "c1" }])], [lead("b", [{ id: "c2" }])]]);
  out = await importClose({ rpc: f.rpc, rest: f.restFn, apiKey: "k", dry: false, run: null, fetchFn: f.fetchFn });
  eq(f.calls.filter((c) => c[0] === "crm_import_people").map((c) => c[1].p_dry), [false, false]);
  eq(out.stats!.created, 2);
  eq(f.calls.at(-1)![1].p_status, "done");
});

Deno.test("import run: refuses without the API key", async () => {
  const f = fakes([]);
  const out = await importClose({ rpc: f.rpc, rest: f.restFn, apiKey: "", dry: true, run: null, fetchFn: f.fetchFn });
  eq(typeof out.error, "string");
});

import { probe, shape } from "../functions/_shared/importers/probe.ts";
Deno.test("probe: only shapes, never values", async () => {
  eq(shape({ email: "jane@x.com", n: 3, tags: ["a", "b"], o: null }), { email: "string", n: "number", tags: ["string", "(2 items)"], o: "null" });
  const f = (async (url: string) => url.endsWith("/openapi.json")
    ? new Response(JSON.stringify({ paths: { "/v1/contacts": { get: { parameters: [{ in: "query", name: "page" }] } } } }))
    : new Response(JSON.stringify({ data: [{ email: "secret@x.com" }] }))) as unknown as typeof fetch;
  const out = await probe("https://x", {}, ["/v1/contacts"], ["/openapi.json"], f);
  eq(JSON.stringify(out).includes("secret@x.com"), false);
  eq((out["/openapi.json"] as any).paths["/v1/contacts"].get, ["query:page"]);
});

Deno.test("status report: Close contacts matched to iClosed by email or phone, disqualified listed", async () => {
  const { crossStatuses } = await import("../functions/_shared/importers/report.ts");
  const r = crossStatuses(
    [{ id: 1, email: "A@x.com", phoneNumber: null, status: "DISQUALIFIED" }, { id: 2, email: null, phoneNumber: "+1 347 720 7993", status: "LEAD" },
     { id: 3, email: "z@x.com", status: "DISQUALIFIED" }],
    [{ name: "A", status: "New", emails: ["a@x.com"], phones: [] }, { name: "B", status: "New", emails: [], phones: ["+13477207993"] },
     { name: "C", status: "New", emails: ["c@x.com"], phones: [] }]);
  eq(r.counts.close_found_in_iclosed, 2);
  eq(r.counts.close_contacts_disqualified_in_iclosed, 1);
  eq(r.counts.disqualified_in_iclosed_not_in_close, 1);
  eq(r.disqualified.map((d: any) => d.name), ["A"]);
});

Deno.test("iclosed: contact -> item with its status, pages from 0 until the count", async () => {
  const { iclosedContactToItem } = await import("../functions/_shared/importers/iclosed.ts");
  const { importIclosed } = await import("../functions/_shared/import_run.ts");
  const it = iclosedContactToItem({ id: 7, firstName: "Adisa", lastName: " Decaj", email: " A@X.com", secondary_email: "a@x.com",
    phoneNumber: "+1 347 720 7993", status: "DISQUALIFIED", createdAt: "2026-10-01T00:00:00Z", user: { email: "Rep@x.com" } });
  eq(it.identity, { email: ["a@x.com"], phone: ["+13477207993"], iclosed_contact_id: "7" });
  eq([it.name, it.source_ref, it.data.status_label, it.data.owner_email], ["Adisa Decaj", "iclosed:7", "DISQUALIFIED", "rep@x.com"]);

  const urls: string[] = [];
  const fetchFn = (async (url: string, init: any) => {
    if (!String(init.headers.authorization).startsWith("Bearer iclosed_")) throw new Error("no auth");
    urls.push(url);
    const page = Number(new URL(url).searchParams.get("page"));
    const contacts = page === 0 ? Array.from({ length: 100 }, (_, i) => ({ id: i })) : page === 1 ? [{ id: 100 }, { id: 101 }] : [];
    return new Response(JSON.stringify({ data: { count: 102, contacts } }));
  }) as unknown as typeof fetch;
  const f = fakes([]);
  const out = await importIclosed({ rpc: f.rpc, rest: f.restFn, apiKey: "k", dry: true, run: null, fetchFn });
  eq(urls.map((u) => new URL(u).searchParams.get("page")), ["0", "1"]);
  eq(out.stats!.contacts, 102);
  eq(f.calls.filter((c) => c[0] === "crm_import_people")[0][1].p_items.length, 102);
});

Deno.test("iclosed calls: call status and the cycle status the history gives", async () => {
  const { iclosedCallStatus, iclosedClose, iclosedCallsToItems } = await import("../functions/_shared/importers/iclosed.ts");
  const now = Date.parse("2026-10-24T00:00:00Z");
  const call = (id: number, at: string, task: Record<string, unknown> = {}, extra: Record<string, unknown> = {}) =>
    ({ id, contactId: 5, dateTimeUTC: at, duration: 45, durationUnit: "minutes", task: [task], deals: [], contact: { email: "a@x.com" }, ...extra });
  eq(iclosedCallStatus(call(1, "2026-01-01T10:00:00Z", { noSaleReason: "ADMIN_CANCELLED", outcome: "REJECTED" })), "canceled");
  eq(iclosedCallStatus(call(1, "2026-01-01T10:00:00Z", { noSaleReason: "NO_SHOW", outcome: "NO_SALE" })), "no_show");
  eq(iclosedCallStatus(call(1, "2026-01-01T10:00:00Z", { outcome: "NO_SALE", noSaleReason: "NOT_INTERESTED" })), "held");
  eq(iclosedCallStatus(call(1, "2026-01-01T10:00:00Z", {}, { cancelReason: "x" })), "canceled");
  eq(iclosedClose([call(1, "2026-03-01T10:00:00Z", { outcome: "REJECTED", noSaleReason: "ADMIN_CANCELLED" })], now)?.status, "lost", "a canceled REJECTED call is not a disqualification:");
  eq(iclosedClose([call(1, "2026-03-01T10:00:00Z", { outcome: "REJECTED", noSaleReason: "OTHER" })], now)?.status, "disqualified");
  eq(iclosedClose([call(1, "2026-03-01T10:00:00Z", { outcome: "NO_SALE", noSaleReason: "UNQUALIFIED" }), call(2, "2026-03-05T10:00:00Z")], now)?.status, "lost", "a later call:");
  eq(iclosedClose([call(1, "2026-03-01T10:00:00Z"), call(2, "2026-03-09T10:00:00Z", {}, { event: { name: "Your Interior Academy Onboarding Call" } })], now)?.status, "won");
  eq(iclosedClose([call(1, "2026-03-01T10:00:00Z", { outcome: "WON" }), call(2, "2026-04-01T10:00:00Z", { outcome: "REJECTED" })], now)?.status, "won");
  eq(iclosedClose([call(1, "2026-03-01T10:00:00Z", { outcome: "NO_SALE", noSaleReason: "NO_SHOW" })], now), { status: "lost", reason: "unreachable", at: "2026-03-01T10:00:00.000Z" });
  eq(iclosedClose([call(1, "2026-03-01T10:00:00Z")], now)?.reason, "timing");
  eq(iclosedClose([call(1, "2026-10-10T10:00:00Z")], now), null, "recent call: still active");
  eq(iclosedClose([call(1, "2026-03-01T10:00:00Z", { outcome: "NO_SALE", noSaleReason: "NO_SHOW" }), call(2, "2026-11-02T10:00:00Z")], now), null, "call ahead");
  const items = iclosedCallsToItems([call(2, "2026-04-01T10:00:00Z"), call(1, "2026-03-01T10:00:00Z")], now);
  eq(items.length, 1);
  eq(items[0].calls.map((c: any) => c.iclosed_call_id), ["1", "2"]);
  eq(items[0].calls[0].end, "2026-03-01T10:45:00.000Z");
  eq(items[0].identity, { email: ["a@x.com"], phone: [], iclosed_contact_id: "5" });
});

Deno.test("iClosed deals: one item each, time read as UTC, value and product kept", async () => {
  const { iclosedDealsToItems, dealsReport } = await import("../functions/_shared/importers/iclosed.ts");
  const deals = [
    { id: 7, eventCallId: 11, contactId: 3, value: "3000", time: "2026-10-20 10:00:00.000", transactionType: "WON", product: { name: "LNP 3000" } },
    { id: 8, eventCallId: null, contactId: 4, value: "500", time: "", createdAt: "2026-10-21T09:00:00.000Z", transactionType: "DEPOSIT", product: { name: " Acompte " } },
  ];
  const items = iclosedDealsToItems(deals);
  eq(items[0], { iclosed_deal_id: "7", iclosed_call_id: "11", iclosed_contact_id: "3", type: "WON", value: "3000", product: "LNP 3000", at: "2026-10-20T10:00:00.000Z" });
  eq(items[1].iclosed_call_id, null);
  eq(items[1].at, "2026-10-21T09:00:00.000Z");
  eq(items[1].product, "Acompte");
  const rep = dealsReport(deals);
  eq(rep.types, { WON: 1, DEPOSIT: 1 });
  eq(rep.by_type.WON.sum, 3000);
});
