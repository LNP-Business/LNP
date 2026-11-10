// The cheap auth check and delivery id of each source (docs/crm/05-08, 12 §2).

import { env, IngestOptions, secretList } from "./ingest.ts";
import { tokenMatches } from "./verify/token.ts";
import { swHeaders, verifyStandardWebhook } from "./verify/standard-webhooks.ts";

// iClosed: native webhook (token "k=" in the address, Q1 answered) or a Zap (header x-lnp-token);
// delivery id = zap.task_id of our JSON contract when present.
export const iclosed: IngestOptions = {
  source: "iclosed",
  check: async (req, _raw, url) =>
    await tokenMatches(req.headers.get("x-lnp-token"), env("ICLOSED_INBOUND_TOKEN")) ||
    await tokenMatches(url.searchParams.get("k"), env("ICLOSED_INBOUND_TOKEN")),
  deliveryId: (_req, raw) => {
    const id = JSON.parse(raw)?.zap?.task_id;
    return id ? String(id) : null;
  },
};

// Fathom: Standard Webhooks headers (VERIFY the signed content on a captured request, Q2).
export const fathom: IngestOptions = {
  source: "fathom",
  check: (req, raw) => verifyStandardWebhook(secretList("FATHOM_WEBHOOK_SECRETS", "FATHOM_WEBHOOK_SECRET"), swHeaders(req), raw),
  deliveryId: (req) => req.headers.get("webhook-id"),
};

// WhatsApp Business (docs/crm/07): a provider (360dialog) forwards Meta's payload to an address holding a long random token
// (k=); Meta directly signs the body (X-Hub-Signature-256, HMAC-SHA256 with the app secret) and first checks the address with a
// GET (hub.verify_token = the same token). No delivery id: a payload holds several messages, each found again by its id.
export async function metaSignatureOk(header: string | null, raw: string, secret: string): Promise<boolean> {
  if (!header || !secret || !header.startsWith("sha256=")) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(raw)));
  const hex = Array.from(sig, (b) => b.toString(16).padStart(2, "0")).join("");
  return tokenMatches(header.slice(7).toLowerCase(), hex);
}
export const whatsapp: IngestOptions = {
  source: "whatsapp",
  check: async (req, raw, url) =>
    await tokenMatches(url.searchParams.get("k"), env("WHATSAPP_INBOUND_TOKEN")) ||
    await metaSignatureOk(req.headers.get("x-hub-signature-256"), raw, env("WHATSAPP_APP_SECRET")),
  verifyGet: async (url) => {
    if (url.searchParams.get("hub.mode") !== "subscribe") return null;
    const ok = await tokenMatches(url.searchParams.get("hub.verify_token"), env("WHATSAPP_INBOUND_TOKEN"));
    return ok ? new Response(url.searchParams.get("hub.challenge") ?? "", { status: 200 }) : new Response("Forbidden", { status: 403 });
  },
};

// Whop: Standard Webhooks, HMAC-SHA256, 5-minute window.
export const whop: IngestOptions = {
  source: "whop",
  check: (req, raw) => verifyStandardWebhook(secretList("WHOP_WEBHOOK_SECRET"), swHeaders(req), raw),
  deliveryId: (req) => req.headers.get("webhook-id"),
};
