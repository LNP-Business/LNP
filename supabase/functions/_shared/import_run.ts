// One import run: pages from the source (Close or iClosed) -> crm_import_people, counts saved on crm_import_runs.
import { closeLeadToItems, closePages, ImportItem } from "./importers/close.ts";
import { iclosedAllCalls, iclosedCallsToItems, iclosedContactToItem, iclosedPages } from "./importers/iclosed.ts";
import { sendblueAllMessages, sendblueHistoryItems } from "./importers/sendblue.ts";
import { fathomHistoryItems, fathomMeetings } from "./importers/fathom.ts";
import { Rpc } from "./worker.ts";

type Rest = (method: string, path: string, body?: unknown) => Promise<any>;
type Stats = Record<string, any>;

export function addStats(a: Stats, b: Stats): Stats {
  const out: Stats = { ...a };
  for (const [k, v] of Object.entries(b)) {
    if (typeof v === "number") out[k] = (out[k] ?? 0) + v;
    else if (v && typeof v === "object") out[k] = addStats(out[k] ?? {}, v);
  }
  return out;
}

type Page = { items: ImportItem[]; n: number; cursor: Stats; more: boolean };
type Opts = { rpc: Rpc; rest: Rest; apiKey: string; dry: boolean; run: string | null; budgetMs?: number; fetchFn?: typeof fetch };
type Out = { error?: string; run?: string; dry?: boolean; more?: boolean; stats?: Stats };

export function importClose(o: Opts): Promise<Out> {
  return importRun(o, "close", "CLOSE_API_KEY", "leads", async function* (cursor) {
    for await (const page of closePages(o.apiKey, Number(cursor.skip ?? 0), 100, o.fetchFn)) {
      yield { items: page.leads.flatMap(closeLeadToItems), n: page.leads.length, cursor: { skip: page.skip }, more: page.more };
    }
  });
}

export function importIclosed(o: Opts): Promise<Out> {
  return importRun(o, "iclosed", "ICLOSED_API_KEY", "contacts", async function* (cursor) {
    for await (const page of iclosedPages(o.apiKey, Number(cursor.page ?? 0), 100, o.fetchFn)) {
      yield { items: page.contacts.map(iclosedContactToItem), n: page.contacts.length, cursor: { page: page.next }, more: page.more };
    }
  });
}

// One run of one source: a dry run sends everything in one call (exact duplicate counts), a real run page by page,
// saving where it stopped so ?run=<id> continues after the time budget.
async function importRun(o: Opts, source: string, keyName: string, unit: string,
  pages: (cursor: Stats) => AsyncGenerator<Page>): Promise<Out> {
  if (!o.apiKey) return { error: `${keyName} is not set in Supabase (Edge Functions › Secrets)` };
  const t0 = Date.now(), budget = o.budgetMs ?? 110_000;
  let run: { id: string; cursor: Stats; stats: Stats; dry_run: boolean };
  if (o.run) {
    [run] = await o.rest("GET", `crm_import_runs?id=eq.${encodeURIComponent(o.run)}&select=id,cursor,stats,dry_run`);
    if (!run) return { error: "unknown run" };
    if ((run.cursor?.source ?? "close") !== source) return { error: `run ${o.run} is a ${run.cursor?.source} import` };
  } else {
    const busy = await o.rest("GET", `crm_import_runs?status=eq.running&started_at=gte.${new Date(Date.now() - 10 * 60e3).toISOString()}&select=id`);
    if (busy.length) return { error: "an import is already running", run: busy[0].id };
    [run] = await o.rest("POST", "crm_import_runs", { source: "import", dry_run: o.dry, cursor: { source } });
  }
  let stats: Stats = run.stats ?? {}, cursor: Stats = { ...(run.cursor ?? {}), source }, count = Number(stats[unit] ?? 0);
  const all: ImportItem[] = [];
  try {
    for await (const page of pages(cursor)) {
      count += page.n;
      if (run.dry_run) all.push(...page.items);
      else stats = addStats(stats, (await o.rpc("crm_import_people", { p_run: run.id, p_source: "import", p_items: page.items, p_dry: false })) as Stats);
      cursor = { source, ...page.cursor };
      if (!run.dry_run) await o.rpc("crm_import_save", { p_run: run.id, p_cursor: cursor, p_stats: { ...stats, [unit]: count }, p_status: "running" });
      if (page.more && Date.now() - t0 > budget && !run.dry_run) {
        return { run: run.id, more: true, stats: { ...stats, [unit]: count } };   // call again with ?run=<id>
      }
    }
    if (run.dry_run) stats = addStats(stats, (await o.rpc("crm_import_people", { p_run: run.id, p_source: "import", p_items: all, p_dry: true })) as Stats);
    stats = { ...stats, [unit]: count, ...(run.dry_run ? { contacts: all.length } : {}) };
    await o.rpc("crm_import_save", { p_run: run.id, p_cursor: cursor, p_stats: stats, p_status: "done" });
    return { run: run.id, dry: run.dry_run, more: false, stats };
  } catch (e) {
    await o.rpc("crm_import_save", { p_run: run.id, p_cursor: cursor, p_stats: { ...stats, [unit]: count }, p_status: "failed", p_error: String((e as Error)?.message ?? e) });
    throw e;
  }
}

// iClosed's calls: all of them first (they are grouped by contact), then crm_import_calls by 100 people. A dry run sends
// everything in one call and is rolled back.
export async function importIclosedCalls(o: Opts): Promise<Out> {
  if (!o.apiKey) return { error: "ICLOSED_API_KEY is not set in Supabase (Edge Functions › Secrets)" };
  const busy = await o.rest("GET", `crm_import_runs?status=eq.running&started_at=gte.${new Date(Date.now() - 10 * 60e3).toISOString()}&select=id`);
  if (busy.length) return { error: "an import is already running", run: busy[0].id };
  const [run] = await o.rest("POST", "crm_import_runs", { source: "import", dry_run: o.dry, cursor: { source: "iclosed_calls" } });
  let stats: Stats = {};
  try {
    const calls = await iclosedAllCalls(o.apiKey, o.fetchFn), items = iclosedCallsToItems(calls);
    const size = o.dry ? items.length : 100;
    for (let i = 0; i < items.length; i += size) {
      stats = addStats(stats, (await o.rpc("crm_import_calls", { p_items: items.slice(i, i + size), p_dry: o.dry })) as Stats);
    }
    stats = { ...stats, iclosed_calls: calls.length, contacts: items.length };
    await o.rpc("crm_import_save", { p_run: run.id, p_cursor: { source: "iclosed_calls" }, p_stats: stats, p_status: "done" });
    return { run: run.id, dry: o.dry, more: false, stats };
  } catch (e) {
    await o.rpc("crm_import_save", { p_run: run.id, p_cursor: { source: "iclosed_calls" }, p_stats: stats, p_status: "failed", p_error: String((e as Error)?.message ?? e) });
    throw e;
  }
}

// Sendblue: every message of the history, then crm_import_messages (012) by batches.
export async function importSendblue(o: Opts & { secret: string }): Promise<Out> {
  if (!o.apiKey || !o.secret) return { error: "SENDBLUE_API_KEY_ID / SENDBLUE_API_SECRET are not set in Supabase (Edge Functions › Secrets)" };
  const busy = await o.rest("GET", `crm_import_runs?status=eq.running&started_at=gte.${new Date(Date.now() - 10 * 60e3).toISOString()}&select=id`);
  if (busy.length) return { error: "an import is already running", run: busy[0].id };
  const [run] = await o.rest("POST", "crm_import_runs", { source: "import", dry_run: o.dry, cursor: { source: "sendblue" } });
  let stats: Stats = {};
  try {
    // by 250 in both modes: one call stays under the database's statement time limit (a dry run's new-people count
    // may then count twice a new number whose messages fall in two batches)
    const msgs = await sendblueAllMessages(o.apiKey, o.secret, o.fetchFn), { items, ignored } = sendblueHistoryItems(msgs);
    const size = 250;
    for (let i = 0; i < items.length; i += size) {
      stats = addStats(stats, (await o.rpc("crm_import_messages", { p_items: items.slice(i, i + size), p_dry: o.dry })) as Stats);
    }
    stats = { ...stats, sendblue_messages: msgs.length, ignored };
    await o.rpc("crm_import_save", { p_run: run.id, p_cursor: { source: "sendblue" }, p_stats: stats, p_status: "done" });
    return { run: run.id, dry: o.dry, more: false, stats };
  } catch (e) {
    await o.rpc("crm_import_save", { p_run: run.id, p_cursor: { source: "sendblue" }, p_stats: stats, p_status: "failed", p_error: String((e as Error)?.message ?? e) });
    throw e;
  }
}

// Fathom recordings since a date (025, FL-1 to FL-6): linked to their lead; `queue` (the hourly job) also queues the R1 / R2
// analyses, a history import does not. By 10 meetings per call
// (transcripts are long); in a dry run each batch is rolled back on its own, so a lead's second recording in a later batch
// may count as a new call instead of a known one.
export async function importFathom(o: Opts & { since: string; until?: string; queue?: boolean }): Promise<Out> {
  if (!o.apiKey) return { error: "FATHOM_API_KEY is not set in Supabase (Edge Functions › Secrets)" };
  const busy = await o.rest("GET", `crm_import_runs?status=eq.running&started_at=gte.${new Date(Date.now() - 10 * 60e3).toISOString()}&select=id`);
  if (busy.length) return { error: "an import is already running", run: busy[0].id };
  const cursor = { source: "fathom", since: o.since, until: o.until ?? null, queue: o.queue === true };
  const [run] = await o.rest("POST", "crm_import_runs", { source: "import", dry_run: o.dry, cursor });
  let stats: Stats = {};
  try {
    const meetings = await fathomMeetings(o.apiKey, o.since, o.fetchFn, o.until), { items, ignored } = fathomHistoryItems(meetings);
    for (let i = 0; i < items.length; i += 10) {
      stats = addStats(stats, (await o.rpc("crm_import_recordings", { p_items: items.slice(i, i + 10), p_dry: o.dry, p_queue: o.queue === true })) as Stats);
    }
    stats = { ...stats, fathom_meetings: meetings.length, ignored };
    await o.rpc("crm_import_save", { p_run: run.id, p_cursor: cursor, p_stats: stats, p_status: "done" });
    return { run: run.id, dry: o.dry, more: false, stats };
  } catch (e) {
    await o.rpc("crm_import_save", { p_run: run.id, p_cursor: cursor, p_stats: stats, p_status: "failed", p_error: String((e as Error)?.message ?? e) });
    throw e;
  }
}
