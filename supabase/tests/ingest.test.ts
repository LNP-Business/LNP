// deno test supabase/tests  (no network, no database)
import { verifyStandardWebhook } from "../functions/_shared/verify/standard-webhooks.ts";
import { tokenMatches } from "../functions/_shared/verify/token.ts";
import { LogRow, makeHandler, MAX_BODY } from "../functions/_shared/ingest.ts";
import { iclosed, metaSignatureOk, whatsapp, whop } from "../functions/_shared/sources.ts";

function eq<T>(a: T, b: T, msg = "") {
  if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${msg} expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}

// Example of the Standard Webhooks specification (svix).
const SW = {
  secret: "whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw",
  id: "msg_p5jXN8AQM9LWM0D4loKWxJek",
  ts: "1614265330",
  body: '{"test": 2432232314}',
  sig: "v1,g0hM9SsE+OTPJTGt/tmIKtSyZlE3uFJELVlNIOLJ1OE=",
};
const h = (sig = SW.sig, ts = SW.ts) => ({ id: SW.id, timestamp: ts, signature: sig });

Deno.test("standard webhooks: valid signature", async () => {
  eq(await verifyStandardWebhook([SW.secret], h(), SW.body, 1614265330), true);
});
Deno.test("standard webhooks: wrong secret, altered body", async () => {
  eq(await verifyStandardWebhook(["whsec_" + btoa("other")], h(), SW.body, 1614265330), false);
  eq(await verifyStandardWebhook([SW.secret], h(), SW.body + " ", 1614265330), false);
});
Deno.test("standard webhooks: several signatures, several secrets", async () => {
  eq(await verifyStandardWebhook([SW.secret], h("v1,AAAA " + SW.sig), SW.body, 1614265330), true);
  eq(await verifyStandardWebhook(["whsec_" + btoa("other"), SW.secret], h(), SW.body, 1614265330), true);
});
Deno.test("standard webhooks: timestamp too old or in the future, missing header", async () => {
  eq(await verifyStandardWebhook([SW.secret], h(), SW.body, 1614265330 + 301), false);
  eq(await verifyStandardWebhook([SW.secret], h(), SW.body, 1614265330 - 301), false);
  eq(await verifyStandardWebhook([SW.secret], { id: SW.id, timestamp: SW.ts, signature: null }, SW.body, 1614265330), false);
  eq(await verifyStandardWebhook([], h(), SW.body, 1614265330), false);
});
Deno.test("token: match, mismatch, missing", async () => {
  eq(await tokenMatches("abc", "abc"), true);
  eq(await tokenMatches("abd", "abc"), false);
  eq(await tokenMatches(null, "abc"), false);
  eq(await tokenMatches("abc", ""), false);
});

// Handler with an in-memory log instead of the database.
function memory() {
  const rows: LogRow[] = [];
  return {
    rows,
    insert: (row: LogRow) => {
      if (row.delivery_id && rows.some((r) => r.source === row.source && r.delivery_id === row.delivery_id)) {
        return Promise.resolve("duplicate" as const);
      }
      rows.push(row);
      return Promise.resolve("ok" as const);
    },
  };
}
const post = (url: string, body: string, headers: Record<string, string> = {}) =>
  new Request(url, { method: "POST", body, headers: { "content-type": "application/json", ...headers } });

Deno.test("iclosed-in: stores the raw body, drops a duplicate delivery, rejects a bad token", async () => {
  Deno.env.set("ICLOSED_INBOUND_TOKEN", "tok-123");
  const db = memory();
  const handler = makeHandler(iclosed, db);
  const body = '{"contract":"lnp.iclosed.v1","event":"call_booked","zap":{"task_id":"t1"}}';
  eq((await handler(post("https://x/iclosed-in", body, { "x-lnp-token": "tok-123" }))).status, 200);
  eq((await handler(post("https://x/iclosed-in", body, { "x-lnp-token": "tok-123" }))).status, 200);
  eq(db.rows.length, 1, "duplicate stored once:");
  eq(db.rows[0].body, body);
  eq(db.rows[0].delivery_id, "t1");
  eq(db.rows[0].headers["x-lnp-token"], "<redacted>");
  const bad = await handler(post("https://x/iclosed-in", body, { "x-lnp-token": "nope" }));
  eq(bad.status, 401);
  eq(db.rows.length, 2, "rejected row kept for audit:");
  eq(db.rows[1].status, "rejected");
  eq(db.rows[1].delivery_id, null, "a rejected row has no delivery id:");
});

Deno.test("iclosed-in: native webhook with the token in the address", async () => {
  Deno.env.set("ICLOSED_INBOUND_TOKEN", "tok-123");
  const db = memory();
  const handler = makeHandler(iclosed, db);
  eq((await handler(post("https://x/iclosed-in?k=tok-123", '{"type":"call_booked"}'))).status, 200);
  eq((await handler(post("https://x/iclosed-in?k=nope", '{"type":"call_booked"}'))).status, 401);
  eq(JSON.stringify(db.rows).includes("tok-123"), false);
  eq(db.rows[0].delivery_id, null);
});

Deno.test("whatsapp-in: token in the query string or Meta's signature, Meta's address check, URL never stored", async () => {
  Deno.env.set("WHATSAPP_INBOUND_TOKEN", "wa-secret");
  Deno.env.set("WHATSAPP_APP_SECRET", "app-secret");
  const db = memory();
  const handler = makeHandler(whatsapp, db);
  const body = '{"object":"whatsapp_business_account","entry":[]}';
  eq((await handler(post("https://x/whatsapp-in?k=wa-secret", body))).status, 200);
  eq((await handler(post("https://x/whatsapp-in?k=wa-secret", body))).status, 200);
  eq(db.rows.length, 2, "no delivery id for WhatsApp (each message is found again by its id):");
  eq(JSON.stringify(db.rows).includes("wa-secret"), false);
  eq((await handler(post("https://x/whatsapp-in", body))).status, 401);
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode("app-secret"), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const hex = Array.from(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body))), (x) => x.toString(16).padStart(2, "0")).join("");
  eq(await metaSignatureOk("sha256=" + hex, body, "app-secret"), true);
  eq((await handler(post("https://x/whatsapp-in", body, { "x-hub-signature-256": "sha256=" + hex }))).status, 200);
  eq((await handler(post("https://x/whatsapp-in", body, { "x-hub-signature-256": "sha256=00" }))).status, 401);
  const ok = await handler(new Request("https://x/whatsapp-in?hub.mode=subscribe&hub.verify_token=wa-secret&hub.challenge=42", { method: "GET" }));
  eq([ok.status, await ok.text()], [200, "42"]);
  eq((await handler(new Request("https://x/whatsapp-in?hub.mode=subscribe&hub.verify_token=nope&hub.challenge=42", { method: "GET" }))).status, 403);
});

Deno.test("whop-in: Standard Webhooks signature", async () => {
  Deno.env.set("WHOP_WEBHOOK_SECRET", SW.secret);
  const db = memory();
  const handler = makeHandler(whop, db);
  const ts = String(Math.floor(Date.now() / 1000));
  const key = await crypto.subtle.importKey(
    "raw",
    Uint8Array.from(atob(SW.secret.slice(6)), (c) => c.charCodeAt(0)),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const body = '{"type":"payment.succeeded","data":{"id":"pay_1"}}';
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`msg_1.${ts}.${body}`)));
  const sig = "v1," + btoa(String.fromCharCode(...mac));
  eq((await handler(post("https://x/whop-in", body, { "webhook-id": "msg_1", "webhook-timestamp": ts, "webhook-signature": sig }))).status, 200);
  eq(db.rows[0].delivery_id, "msg_1");
  eq((await handler(post("https://x/whop-in", body, { "webhook-id": "msg_2", "webhook-timestamp": ts, "webhook-signature": "v1,AAAA" }))).status, 401);
});

Deno.test("method and size limits", async () => {
  const db = memory();
  const handler = makeHandler(whatsapp, db);
  eq((await handler(new Request("https://x/whatsapp-in", { method: "GET" }))).status, 405);
  eq((await handler(post("https://x/whatsapp-in?k=wa-secret", "x".repeat(MAX_BODY + 1)))).status, 413);
  eq(db.rows.length, 0);
});

Deno.test("a storage failure answers 500 so the provider retries", async () => {
  Deno.env.set("WHATSAPP_INBOUND_TOKEN", "wa-secret");
  const handler = makeHandler(whatsapp, { insert: () => Promise.resolve("error" as const) });
  eq((await handler(post("https://x/whatsapp-in?k=wa-secret", "{}"))).status, 500);
});
