// crm-import: brings the leads that already exist in Close and iClosed into the CRM, without duplicates
// (web/supabase/007_crm_import.sql). POST ?source=close|iclosed|iclosed_calls|iclosed_deals|sendblue|fathom&dry=1 for a dry run (counts only, nothing written), without dry
// for the import; ?run=<id> continues a run that stopped on the time budget. Answers counts only, never personal data.
import { importClose, importFathom, importIclosed, importIclosedCalls, importIclosedDeals, importSendblue } from "../_shared/import_run.ts";
import { sendblueAllMessages, sendblueReport } from "../_shared/importers/sendblue.ts";
import { restRpc } from "../_shared/worker.ts";
import { callsReport, statusReport } from "../_shared/importers/report.ts";
import { dealsReport, iclosedAllDeals } from "../_shared/importers/iclosed.ts";
import { ICLOSED_BASE, ICLOSED_PROBE_PATHS, ICLOSED_SPECS, iclosedHeaders, pagination, probe } from "../_shared/importers/probe.ts";

Deno.serve(async (req) => {
  const u = new URL(req.url);
  if (req.method !== "POST") return new Response("POST only", { status: 405 });
  if (u.searchParams.get("source") === "iclosed" && u.searchParams.get("probe") === "1") {
    // read-only: field names and types of iClosed's answers, no values (to write the iClosed importer)
    const key = Deno.env.get("ICLOSED_API_KEY") ?? "";
    if (!key) return Response.json({ error: "ICLOSED_API_KEY is not set" }, { status: 409 });
    return Response.json(await probe(ICLOSED_BASE, iclosedHeaders(key), ICLOSED_PROBE_PATHS, ICLOSED_SPECS));
  }
  if (u.searchParams.get("source") === "iclosed" && u.searchParams.get("probe") === "2") {
    const key = Deno.env.get("ICLOSED_API_KEY") ?? "", h = iclosedHeaders(key);
    return Response.json({
      contacts: await pagination(ICLOSED_BASE, h, "/v1/contacts", "contacts"),
      eventCalls: await pagination(ICLOSED_BASE, h, "/v1/eventCalls", "eventCalls"),
    });
  }
  if (u.searchParams.get("report") === "statuses") {
    // read-only: iClosed statuses (DISQUALIFIED…) of the Close contacts; names only with the CRM_REPORT_TOKEN secret
    const tok = Deno.env.get("CRM_REPORT_TOKEN") ?? "";
    const names = tok.length >= 32 && req.headers.get("x-lnp-token") === tok;
    try {
      return Response.json(await statusReport({ iclosedHeaders: iclosedHeaders(Deno.env.get("ICLOSED_API_KEY") ?? ""),
        closeKey: Deno.env.get("CLOSE_API_KEY") ?? "", names }));
    } catch (e) {
      return Response.json({ error: String((e as Error)?.message ?? e).slice(0, 300) }, { status: 500 });
    }
  }
  if (u.searchParams.get("report") === "calls") {
    // read-only counts over iClosed's calls (types, cancellations, outcomes), to map them onto the CRM's cycles
    try { return Response.json(await callsReport(iclosedHeaders(Deno.env.get("ICLOSED_API_KEY") ?? ""))); }
    catch (e) { return Response.json({ error: String((e as Error)?.message ?? e).slice(0, 300) }, { status: 500 }); }
  }
  if (u.searchParams.get("report") === "deals") {
    // read-only counts over iClosed's deals (transaction types, products, amounts by month), to map them onto crm_deals / crm_payments
    try { return Response.json(dealsReport(await iclosedAllDeals(Deno.env.get("ICLOSED_API_KEY") ?? ""))); }
    catch (e) { return Response.json({ error: String((e as Error)?.message ?? e).slice(0, 300) }, { status: 500 }); }
  }
  if (u.searchParams.get("report") === "sendblue") {
    // read-only counts over Sendblue's message history (directions, services, statuses, sources, months)
    try { return Response.json(sendblueReport(await sendblueAllMessages(Deno.env.get("SENDBLUE_API_KEY_ID") ?? "", Deno.env.get("SENDBLUE_API_SECRET") ?? ""))); }
    catch (e) { return Response.json({ error: String((e as Error)?.message ?? e).slice(0, 300) }, { status: 500 }); }
  }
  if (u.searchParams.get("source") === "sendblue") {
    try {
      const out = await importSendblue({ rpc: restRpc(), rest: restTable, apiKey: Deno.env.get("SENDBLUE_API_KEY_ID") ?? "",
        secret: Deno.env.get("SENDBLUE_API_SECRET") ?? "", dry: u.searchParams.get("dry") === "1", run: null });
      return Response.json(out, { status: out.error ? 409 : 200 });
    } catch (e) {
      return Response.json({ error: String((e as Error)?.message ?? e).slice(0, 300) }, { status: 500 });
    }
  }
  if (u.searchParams.get("source") === "fathom") {
    // Fathom recordings (025): ?since=YYYY-MM-DD (default: 2 days ago, the hourly job of 006), &until=, &queue=1 (queue the
    // R1 / R2 analyses: the hourly job only, never a history import)
    const day = /^\d{4}-\d{2}-\d{2}$/;
    const since = u.searchParams.get("since") ?? new Date(Date.now() - 2 * 86400e3).toISOString().slice(0, 10);
    const until = u.searchParams.get("until") ?? undefined;
    if (!day.test(since) || (until && !day.test(until))) return Response.json({ error: "since and until are dates YYYY-MM-DD" }, { status: 400 });
    try {
      const out = await importFathom({ rpc: restRpc(), rest: restTable, apiKey: Deno.env.get("FATHOM_API_KEY") ?? "",
        dry: u.searchParams.get("dry") === "1", run: null, since: since + "T00:00:00Z", until: until ? until + "T00:00:00Z" : undefined,
        queue: u.searchParams.get("queue") === "1" });
      return Response.json(out, { status: out.error ? 409 : 200 });
    } catch (e) {
      return Response.json({ error: String((e as Error)?.message ?? e).slice(0, 300) }, { status: 500 });
    }
  }
  const source = u.searchParams.get("source");
  if (source !== "close" && source !== "iclosed" && source !== "iclosed_calls" && source !== "iclosed_deals") {
    return Response.json({ error: "source must be close, iclosed, iclosed_calls or iclosed_deals" }, { status: 400 });
  }
  try {
    const out = await (source === "close" ? importClose : source === "iclosed" ? importIclosed : source === "iclosed_calls" ? importIclosedCalls : importIclosedDeals)({
      rpc: restRpc(), rest: restTable,
      apiKey: Deno.env.get(source === "close" ? "CLOSE_API_KEY" : "ICLOSED_API_KEY") ?? "",
      dry: u.searchParams.get("dry") === "1", run: u.searchParams.get("run"),
    });
    return Response.json(out, { status: out.error ? 409 : 200 });
  } catch (e) {
    console.error("crm-import:", String((e as Error)?.message ?? e).slice(0, 300));
    return Response.json({ error: String((e as Error)?.message ?? e).slice(0, 300) }, { status: 500 });
  }
});

async function restTable(method: string, path: string, body?: unknown) {
  const base = Deno.env.get("SUPABASE_URL"), key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const r = await fetch(`${base}/rest/v1/${path}`, {
    method, headers: { apikey: key, authorization: `Bearer ${key}`, "content-type": "application/json", prefer: "return=representation" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const t = await r.text();
  if (!r.ok) throw new Error(`${path}: HTTP ${r.status} ${t.slice(0, 200)}`);
  return t ? JSON.parse(t) : null;
}
