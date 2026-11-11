// Simulateur · appels au modèle (API Messages d'Anthropic, clé ANTHROPIC_API_KEY des secrets des fonctions).
// Même convention que callqa_llm.ts : pas de température (les modèles actuels la refusent), réflexion coupée sur les appels
// courts et sur la voix du prospect (le temps de réponse compte), consignes système marquées pour le cache.
export const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
export const MODELE_PROSPECT = "claude-sonnet-5-5";   // la voix du prospect (réglable dans crm_sim_config.claude_model)
export const MODELE_RAPIDE = "claude-haiku-5-5";      // les analyses de signaux, tour par tour
export const MODELES_PROSPECT = ["claude-sonnet-5-5", "claude-haiku-5-5", "claude-opus-5-5"];

type Fetch = (url: string, init: RequestInit) => Promise<Response>;
export type Bloc = { type: "text"; text: string; cache_control?: { type: "ephemeral" } };
export type MessageModele = { role: "user" | "assistant"; content: string | Bloc[] };

// Couper la réflexion : Sonnet 5.5 refuse « disabled » (400) et prend « between_tools » ; Haiku 5.5 prend « disabled »
// (effort high ou moins) ; Opus 5.5 ne permet pas de la couper : effort bas.
export function sansReflexion(model: string): Record<string, unknown> {
  if (model.startsWith("claude-sonnet-5-5")) return { thinking: { type: "between_tools" }, output_config: { effort: "low" } };
  if (model.startsWith("claude-opus-5-5")) return { output_config: { effort: "low" } };
  return { thinking: { type: "disabled" } };
}

export class ErreurModele extends Error {
  constructor(message: string, public status: number, public retry: boolean) { super(message); }
}

export type Usage = { input_tokens?: number; output_tokens?: number; cache_read_input_tokens?: number; cache_creation_input_tokens?: number };

async function erreur(res: Response): Promise<never> {
  const out = await res.json().catch(() => ({})) as { error?: { type?: string; message?: string } };
  const e = out.error ?? {};
  throw new ErreurModele(`${res.status} ${e.type ?? ""} ${e.message ?? ""}`.trim(), res.status, res.status === 429 || res.status >= 500);
}

function texte(o: { content?: { type: string; text?: string }[] }): string {
  return (o.content ?? []).filter((c) => c.type === "text").map((c) => c.text ?? "").join("");
}

// Un appel complet (non diffusé) : le texte et l'usage. cacheSystem : les consignes système (stables) en cache.
export async function appeler(key: string, p: {
  model: string; system?: string; user: string | Bloc[]; maxTokens: number; cacheSystem?: boolean; reflexion?: boolean;
}, fetchFn: Fetch = fetch): Promise<{ text: string; usage: Usage; stop: string | null }> {
  if (!key) throw new ErreurModele("ANTHROPIC_API_KEY n'est pas défini dans les secrets des fonctions", 409, false);
  const body: Record<string, unknown> = {
    model: p.model, max_tokens: p.maxTokens,
    ...(p.reflexion ? {} : sansReflexion(p.model)),
    messages: [{ role: "user", content: p.user }],
  };
  if (p.system) body.system = p.cacheSystem === false ? p.system : [{ type: "text", text: p.system, cache_control: { type: "ephemeral" } }];
  // 2 nouvelles tentatives sur 429 / 5xx (l'API est parfois surchargée)
  for (let essai = 0; ; essai++) {
    const res = await fetchFn(ANTHROPIC_URL, {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const o = await res.json() as { content?: { type: string; text?: string }[]; usage?: Usage; stop_reason?: string };
      return { text: texte(o), usage: o.usage ?? {}, stop: o.stop_reason ?? null };
    }
    if ((res.status === 429 || res.status >= 500) && essai < 2) { await new Promise((r) => setTimeout(r, 800 * (essai + 1))); continue; }
    await erreur(res);
  }
}

// La réponse du prospect, diffusée morceau par morceau (événements content_block_delta / text_delta de l'API).
export async function* diffuser(key: string, p: {
  model: string; system: Bloc[]; messages: MessageModele[]; maxTokens: number; signal?: AbortSignal;
}, fetchFn: Fetch = fetch): AsyncGenerator<string, Usage> {
  if (!key) throw new ErreurModele("ANTHROPIC_API_KEY n'est pas défini dans les secrets des fonctions", 409, false);
  const res = await fetchFn(ANTHROPIC_URL, {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: p.model, max_tokens: p.maxTokens, stream: true, ...sansReflexion(p.model), system: p.system, messages: p.messages }),
    signal: p.signal,
  });
  if (!res.ok || !res.body) await erreur(res);
  const usage: Usage = {};
  const reader = res.body!.pipeThrough(new TextDecoderStream()).getReader();
  let buf = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += value;
    let i: number;
    while ((i = buf.indexOf("\n\n")) >= 0) {
      const evt = buf.slice(0, i); buf = buf.slice(i + 2);
      const data = evt.split("\n").filter((l) => l.startsWith("data:")).map((l) => l.slice(5).trim()).join("");
      if (!data) continue;
      let o: Record<string, any>;
      try { o = JSON.parse(data); } catch { continue; }
      if (o.type === "content_block_delta" && o.delta?.type === "text_delta" && o.delta.text) yield o.delta.text as string;
      else if (o.type === "message_start" && o.message?.usage) Object.assign(usage, o.message.usage);
      else if (o.type === "message_delta" && o.usage) Object.assign(usage, o.usage);
      else if (o.type === "error") throw new ErreurModele(`${o.error?.type ?? "error"} ${o.error?.message ?? ""}`.trim(), 503, true);
    }
  }
  return usage;
}
