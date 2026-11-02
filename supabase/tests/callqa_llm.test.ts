// deno test --allow-env --allow-read supabase/tests
import { ANTHROPIC_URL, handleLlm } from "../functions/_shared/callqa_llm.ts";

function eq<T>(a: T, b: T, msg = "") {
  if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${msg} expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}
const env = { anthropicKey: "sk-test", serviceKeys: ["service-key"] };
const post = (body: unknown, auth = "Bearer service-key") =>
  new Request("https://x/functions/v1/callqa-llm", { method: "POST", headers: { authorization: auth }, body: JSON.stringify(body) });
const q = { model: "claude-sonnet-5-5", system: "RULES", prompt: "UNIT", max_tokens: 500 };

Deno.test("callqa-llm: refuses without the service role key", async () => {
  let called = false;
  const r = await handleLlm(post(q, "Bearer nope"), env, () => { called = true; return Promise.resolve(new Response("{}")); });
  eq(r.status, 401); eq(called, false);
});

Deno.test("callqa-llm: forwards one closed question, rules cached, text and usage back", async () => {
  let sent: { url?: string; body?: Record<string, unknown>; key?: string | null } = {};
  const r = await handleLlm(post(q), env, (url, init) => {
    sent = { url, body: JSON.parse(String(init.body)), key: new Headers(init.headers).get("x-api-key") };
    return Promise.resolve(Response.json({ content: [{ type: "text", text: "{\"ok\":true}" }], usage: { input_tokens: 10, output_tokens: 3 }, model: "claude-sonnet-5-5" }));
  });
  eq(r.status, 200);
  eq(await r.json(), { text: "{\"ok\":true}", usage: { input_tokens: 10, output_tokens: 3 }, model: "claude-sonnet-5-5", stop_reason: null });
  eq(sent.url, ANTHROPIC_URL); eq(sent.key, "sk-test");
  eq(sent.body?.system, [{ type: "text", text: "RULES", cache_control: { type: "ephemeral" } }]);
  eq(sent.body?.messages, [{ role: "user", content: [{ type: "text", text: "UNIT" }] }]); eq("temperature" in (sent.body ?? {}), false, "no temperature:");
  eq(sent.body?.output_config, { effort: "low" }, "low effort by default:");
});

Deno.test("callqa-llm: the question is cached when it will be asked again; effort is checked", async () => {
  let body: Record<string, unknown> = {};
  const ok = (_u: string, init: RequestInit) => { body = JSON.parse(String(init.body)); return Promise.resolve(Response.json({ content: [] })); };
  eq((await handleLlm(post({ ...q, cache_prompt: true, effort: "medium" }), env, ok)).status, 200);
  eq(body.messages, [{ role: "user", content: [{ type: "text", text: "UNIT", cache_control: { type: "ephemeral" } }] }]);
  eq(body.output_config, { effort: "medium" });
  eq((await handleLlm(post({ ...q, effort: "none" }), env, ok)).status, 400);
  eq((await handleLlm(post({ ...q, effort: "default" }), env, ok)).status, 200);
  eq("output_config" in body, false, "default: no effort sent:");
});

Deno.test("callqa-llm: bad model id, missing key, provider errors", async () => {
  const ok = () => Promise.resolve(Response.json({}));
  eq((await handleLlm(post({ ...q, model: "gpt-4" }), env, ok)).status, 400);
  eq((await handleLlm(post(q), { ...env, anthropicKey: "" }, ok)).status, 409);
  const busy = await handleLlm(post(q), env, () => Promise.resolve(Response.json({ error: { type: "overloaded_error", message: "busy" } }, { status: 529 })));
  eq(busy.status, 503); eq((await busy.json()).retry, true);
  const bad = await handleLlm(post(q), env, () => Promise.resolve(Response.json({ error: { type: "invalid_request_error", message: "x" } }, { status: 400 })));
  eq(bad.status, 502); eq((await bad.json()).retry, false);
});
