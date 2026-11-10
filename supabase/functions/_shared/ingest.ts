// Ingestion: store the raw request in crm_webhook_log and answer fast (docs/crm/04-event-pipeline.md §1).
// No parsing, mapping or matching here: the worker process-inbox (phase 2) does that from the stored row.

export type Source = "iclosed" | "fathom" | "whatsapp" | "whop";

export type LogRow = {
  source: Source;
  delivery_id: string | null;
  headers: Record<string, string>;
  body: string;
  auth_ok: boolean;
  status: "received" | "rejected";
};

export type InsertResult = "ok" | "duplicate" | "error";

export type IngestOptions = {
  source: Source;
  // Cheap auth check of the source: token or signature. Gets the raw body as text.
  check: (req: Request, rawBody: string, url: URL) => Promise<boolean>;
  // Provider delivery id, when the provider gives one (used to drop duplicate deliveries).
  deliveryId?: (req: Request, rawBody: string) => string | null;
  // Extra header names holding a secret, stored as "<redacted>".
  secretHeaders?: string[];
  // A GET the provider sends to check the address (Meta: hub.challenge); null = not such a request.
  verifyGet?: (url: URL) => Promise<Response | null>;
};

export type Deps = {
  insert: (row: LogRow) => Promise<InsertResult>;
};

export const MAX_BODY = 2 * 1024 * 1024;
const ALWAYS_REDACTED = ["authorization", "cookie", "apikey", "x-lnp-token"];

export function redactHeaders(req: Request, extra: string[] = []): Record<string, string> {
  const secret = new Set([...ALWAYS_REDACTED, ...extra.map((h) => h.toLowerCase())]);
  const out: Record<string, string> = {};
  req.headers.forEach((v, k) => {
    out[k] = secret.has(k.toLowerCase()) ? "<redacted>" : v;
  });
  return out;
}

const text = (status: number, body: string) =>
  new Response(body, { status, headers: { "content-type": "text/plain; charset=utf-8" } });

export function makeHandler(opts: IngestOptions, deps: Deps = { insert: restInsert }) {
  return async (req: Request): Promise<Response> => {
    if (req.method === "GET" && opts.verifyGet) {
      const r = await opts.verifyGet(new URL(req.url)).catch(() => null);
      if (r) return r;
    }
    if (req.method !== "POST") return text(405, "POST only");
    const len = Number(req.headers.get("content-length") || 0);
    if (len > MAX_BODY) return text(413, "Body too large");
    const raw = await req.text();
    if (new TextEncoder().encode(raw).length > MAX_BODY) return text(413, "Body too large");

    const url = new URL(req.url);
    let ok = false;
    try {
      ok = await opts.check(req, raw, url);
    } catch {
      ok = false;
    }
    // A rejected row keeps no delivery id: a forged request must not block the genuine delivery as a duplicate.
    let deliveryId: string | null = null;
    if (ok && opts.deliveryId) {
      try {
        deliveryId = opts.deliveryId(req, raw) || null;
      } catch {
        deliveryId = null;
      }
    }
    const res = await deps.insert({
      source: opts.source,
      delivery_id: deliveryId,
      headers: redactHeaders(req, opts.secretHeaders),
      body: raw,
      auth_ok: ok,
      status: ok ? "received" : "rejected",
    });
    // Never log the URL: a token is in the query string (iClosed, WhatsApp).
    if (res === "error") {
      console.error(`${opts.source}-in: could not store the request`);
      return text(500, "Not stored, retry later");
    }
    if (!ok) return text(401, "Unauthorized");
    return text(200, res === "duplicate" ? "Duplicate, already stored" : "Stored");
  };
}

// Insert through PostgREST with the service role (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set by Supabase
// in every Edge Function). crm_webhook_log has no policy: only the service role can read or write it.
export async function restInsert(row: LogRow): Promise<InsertResult> {
  const base = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!base || !key) return "error";
  try {
    const r = await fetch(`${base}/rest/v1/crm_webhook_log`, {
      method: "POST",
      headers: {
        apikey: key,
        authorization: `Bearer ${key}`,
        "content-type": "application/json",
        prefer: "return=minimal",
      },
      body: JSON.stringify(row),
    });
    if (r.ok) return "ok";
    const detail = await r.text();
    if (r.status === 409 || detail.includes("23505")) return "duplicate";
    console.error(`crm_webhook_log insert failed: HTTP ${r.status}`);
    return "error";
  } catch {
    return "error";
  }
}

export function env(name: string): string {
  return Deno.env.get(name) ?? "";
}

// FATHOM_WEBHOOK_SECRETS may hold several secrets (one per webhook): a JSON object id -> secret, or a JSON array.
export function secretList(...names: string[]): string[] {
  const out: string[] = [];
  for (const n of names) {
    const v = env(n).trim();
    if (!v) continue;
    if (v.startsWith("{") || v.startsWith("[")) {
      try {
        const parsed = JSON.parse(v);
        out.push(...(Object.values(parsed) as unknown[]).filter((s): s is string => typeof s === "string"));
        continue;
      } catch {
        // not JSON: use as one secret
      }
    }
    out.push(v);
  }
  return out;
}
