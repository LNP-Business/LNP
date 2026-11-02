// Model gateway of the call analysis worker (call-analysis/PLAN.md §2). The worker runs outside Supabase (GitHub Actions)
// and holds no model key: it sends each closed question here, with the project's service role key as bearer, and this
// function forwards it to the Anthropic Messages API with ANTHROPIC_API_KEY. The rules part of the prompt (system) is
// marked for prompt caching; the question itself too when the worker says it will be asked again (the 3 passes of a unit,
// call-analysis/docs/ARCHITECTURE.md §7). effort (low by default) keeps the model's thinking short: the answer is one
// closed JSON; "default" sends no effort, so the model uses its own. Answers the model's text and token usage only; never logs a prompt or a transcript.
export type LlmEnv = { anthropicKey: string; serviceKeys: string[] };
type Fetch = (url: string, init: RequestInit) => Promise<Response>;

export const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
export const EFFORTS = ["low", "medium", "high", "xhigh", "max", "default"];

export async function handleLlm(req: Request, env: LlmEnv, fetchFn: Fetch = fetch): Promise<Response> {
  if (req.method !== "POST") return Response.json({ error: "POST only" }, { status: 405 });
  const bearer = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!bearer || !env.serviceKeys.some((k) => k && k === bearer)) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!env.anthropicKey) return Response.json({ error: "ANTHROPIC_API_KEY is not set in the Supabase function secrets" }, { status: 409 });
  let b: { model?: unknown; system?: unknown; prompt?: unknown; max_tokens?: unknown; effort?: unknown; cache_prompt?: unknown };
  try { b = await req.json(); } catch { return Response.json({ error: "JSON body expected" }, { status: 400 }); }
  if (typeof b.model !== "string" || !/^claude-[a-z0-9.\-]+$/.test(b.model)) return Response.json({ error: "model must be a claude-* id" }, { status: 400 });
  if (typeof b.system !== "string" || typeof b.prompt !== "string" || !b.prompt) return Response.json({ error: "system and prompt are required" }, { status: 400 });
  const maxTokens = Math.min(Math.max(Number(b.max_tokens) || 4000, 1), 16000);
  const effort = b.effort === undefined ? "low" : b.effort;
  if (typeof effort !== "string" || !EFFORTS.includes(effort)) return Response.json({ error: "effort must be one of " + EFFORTS.join(", ") }, { status: 400 });
  const text: Record<string, unknown> = { type: "text", text: b.prompt };
  if (b.cache_prompt === true) text.cache_control = { type: "ephemeral" };
  const res = await fetchFn(ANTHROPIC_URL, {
    method: "POST",
    headers: { "x-api-key": env.anthropicKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      // no temperature: the current models refuse it ("deprecated for this model", 2026-10-26); three independent passes
      // and the arbiter carry the reproducibility (Part C, C4)
      model: b.model, max_tokens: maxTokens, ...(effort === "default" ? {} : { output_config: { effort } }),
      system: [{ type: "text", text: b.system, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: [text] }],
    }),
  });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) {
    // the provider's error type and message only (no prompt); 429 and 5xx are worth a retry for the worker
    const e = (out as { error?: { type?: string; message?: string } }).error ?? {};
    return Response.json({ error: `${res.status} ${e.type ?? ""} ${e.message ?? ""}`.trim(), retry: res.status === 429 || res.status >= 500 },
      { status: res.status === 429 || res.status >= 500 ? 503 : 502 });
  }
  const o = out as { content?: { type: string; text?: string }[]; usage?: Record<string, number>; model?: string; stop_reason?: string };
  return Response.json({
    text: (o.content ?? []).filter((c) => c.type === "text").map((c) => c.text ?? "").join(""),
    usage: o.usage ?? {}, model: o.model ?? b.model, stop_reason: o.stop_reason ?? null,
  });
}
