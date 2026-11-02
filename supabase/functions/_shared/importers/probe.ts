// Read-only look at an API: the SHAPE of its answers (field names, types, list sizes), never the values, plus the paths
// of its public OpenAPI description. Used to write an importer without seeing personal data.
type Fetch = typeof fetch;

export function shape(v: unknown, depth = 0): unknown {
  if (depth > 6) return "…";
  if (Array.isArray(v)) return v.length ? [shape(v[0], depth + 1), `(${v.length} items)`] : [];
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, shape(x, depth + 1)]));
  return v === null ? "null" : typeof v;
}

export async function probe(base: string, headers: Record<string, string>, paths: string[], specs: string[], fetchFn: Fetch = fetch) {
  const out: Record<string, unknown> = {};
  for (const p of paths) {
    try {
      const r = await fetchFn(base + p, { headers });
      const t = await r.text();
      let body: unknown = null;
      try { body = JSON.parse(t); } catch { body = `(not JSON, ${t.length} chars)`; }
      out[p] = { status: r.status, shape: r.ok ? shape(body) : (typeof body === "object" ? shape(body) : body) };
    } catch (e) { out[p] = { error: String((e as Error)?.message ?? e).slice(0, 120) }; }
  }
  for (const s of specs) {
    try {
      const r = await fetchFn(base + s, { headers: { accept: "application/json" } });
      if (!r.ok) { out[s] = { status: r.status }; continue; }
      const spec = await r.json();
      const paths: Record<string, unknown> = {};
      for (const [path, ops] of Object.entries(spec.paths ?? {})) {
        paths[path] = Object.fromEntries(Object.entries(ops as Record<string, any>).map(([m, op]) =>
          [m, (op?.parameters ?? []).map((x: any) => `${x.in}:${x.name}`)]));
      }
      out[s] = { status: 200, paths };
      break;
    } catch (e) { out[s] = { error: String((e as Error)?.message ?? e).slice(0, 120) }; }
  }
  return out;
}

export const ICLOSED_BASE = "https://public.api.iclosed.io";
export function iclosedHeaders(key: string) {
  const k = key.trim();
  return { authorization: "Bearer " + (k.startsWith("iclosed_") ? k : "iclosed_" + k), "content-type": "application/json", accept: "application/json" };
}
export const ICLOSED_PROBE_PATHS = ["/v1/contacts?limit=1", "/v1/contacts", "/v1/eventCalls?limit=1", "/v1/calls?limit=1",
  "/eventCalls/searchEventCall", "/v1/deals?limit=1", "/deals/get", "/v1/users", "/v1/events"];
export const ICLOSED_SPECS = ["/openapi.json", "/v1/openapi.json", "/docs-json", "/swagger.json", "/api-docs", "/v1/docs-json", "/docs/openapi.json"];

// Which query parameter pages a list: compares the ids of page 1 and page 2 (ids only, no personal data), with the total.
export async function pagination(base: string, headers: Record<string, string>, path: string, listKey: string, fetchFn: Fetch = fetch) {
  const ids = async (q: string) => {
    const r = await fetchFn(`${base}${path}?${q}`, { headers });
    if (!r.ok) return { status: r.status };
    const j = await r.json();
    return { count: j?.data?.count, ids: (j?.data?.[listKey] ?? []).map((x: any) => x.id) };
  };
  const first = await ids("limit=5");
  const out: Record<string, unknown> = { total: (first as any).count, first_page: (first as any).ids?.length };
  for (const q of ["page=2&limit=5", "page=1&limit=5", "offset=5&limit=5", "skip=5&limit=5", "start=5&limit=5", "limit=100", "limit=500"]) {
    const r: any = await ids(q);
    out[q] = r.status ? { status: r.status } : { n: r.ids.length, same_as_first: JSON.stringify(r.ids.slice(0, 5)) === JSON.stringify((first as any).ids) };
  }
  return out;
}
