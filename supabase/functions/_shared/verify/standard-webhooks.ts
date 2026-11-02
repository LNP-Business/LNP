// Standard Webhooks signature check (Whop; Fathom uses the same header names: VERIFY, docs/crm/06 §3).
// Signed content: "<webhook-id>.<webhook-timestamp>.<raw body>", HMAC-SHA256, header "v1,<base64> v1,<base64>…".

import { timingSafeEqualBytes } from "./token.ts";

const enc = new TextEncoder();

// "whsec_<base64>" is the Standard Webhooks format. Any other secret (Whop's "ws_…") is used as its raw bytes,
// which is what Whop's SDK does (it passes btoa(secret) to the Standard Webhooks library).
export function secretKey(secret: string): Uint8Array<ArrayBuffer> {
  if (secret.startsWith("whsec_")) {
    const bin = atob(secret.slice(6));
    return Uint8Array.from(bin, (c) => c.charCodeAt(0));
  }
  return enc.encode(secret);
}

function b64decode(s: string): Uint8Array | null {
  try {
    const bin = atob(s);
    return Uint8Array.from(bin, (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}

export type SwHeaders = { id: string | null; timestamp: string | null; signature: string | null };

export async function verifyStandardWebhook(
  secrets: string[],
  h: SwHeaders,
  rawBody: string,
  nowSec = Math.floor(Date.now() / 1000),
  toleranceSec = 300,
): Promise<boolean> {
  if (!h.id || !h.timestamp || !h.signature) return false;
  const ts = Number(h.timestamp);
  if (!Number.isFinite(ts) || Math.abs(nowSec - ts) > toleranceSec) return false;
  const given = h.signature.split(" ")
    .map((p) => p.trim())
    .filter((p) => p.startsWith("v1,"))
    .map((p) => b64decode(p.slice(3)))
    .filter((b): b is Uint8Array => b !== null);
  if (!given.length) return false;
  const content = enc.encode(`${h.id}.${h.timestamp}.${rawBody}`);
  for (const secret of secrets.filter(Boolean)) {
    const key = await crypto.subtle.importKey("raw", secretKey(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, content));
    if (given.some((g) => timingSafeEqualBytes(g, mac))) return true;
  }
  return false;
}

export function swHeaders(req: Request): SwHeaders {
  return {
    id: req.headers.get("webhook-id"),
    timestamp: req.headers.get("webhook-timestamp"),
    signature: req.headers.get("webhook-signature"),
  };
}
