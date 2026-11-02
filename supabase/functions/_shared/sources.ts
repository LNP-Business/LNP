// The cheap auth check and delivery id of each source (docs/crm/05-08, 12 §2).

import { env, IngestOptions, secretList } from "./ingest.ts";
import { tokenMatches } from "./verify/token.ts";
import { swHeaders, verifyStandardWebhook } from "./verify/standard-webhooks.ts";

// iClosed: native webhook (token "k=" in the address, Q1 answered) or a Zap (header x-skl-token);
// delivery id = zap.task_id of our JSON contract when present.
export const iclosed: IngestOptions = {
  source: "iclosed",
  check: async (req, _raw, url) =>
    await tokenMatches(req.headers.get("x-skl-token"), env("ICLOSED_INBOUND_TOKEN")) ||
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

// Sendblue: long random token in the query string (k=) until a signature is confirmed (Q4).
// A message handle is not a delivery id (status updates reuse it), so no duplicate check here.
export const sendblue: IngestOptions = {
  source: "sendblue",
  check: (_req, _raw, url) => tokenMatches(url.searchParams.get("k"), env("SENDBLUE_INBOUND_TOKEN")),
};

// Whop: Standard Webhooks, HMAC-SHA256, 5-minute window.
export const whop: IngestOptions = {
  source: "whop",
  check: (req, raw) => verifyStandardWebhook(secretList("WHOP_WEBHOOK_SECRET"), swHeaders(req), raw),
  deliveryId: (req) => req.headers.get("webhook-id"),
};
