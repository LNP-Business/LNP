// POST /api/academie {id, answer, answer2, cid, duration_s}: a case of Entraînement › Maîtrise de l'offre corrected by Claude (cahier §4.2).
// The caller is a signed-in member of the team who may open the screen (Settings › Access, key academie); the prompt is built
// here from the case (never sent by the page) and goes to the model gateway callqa-llm (the Anthropic key stays in the Supabase
// function secrets). At most 6 corrections a minute per person (429). Answers {feedback} (web/api/_academie.js › normalize);
// logs the case id and the tokens only, never the answer; keeps the attempt in crm_training_results (the person's own results).
import { admin, caller, readJson, send, SUPABASE_URL } from "./_lib.js";
import { accessOf } from "./_screens.js";
import { BY_ID, buildPrompt, hasAnswer, normalize, parseModel } from "./_academie.js";

export const MODEL = process.env.ACADEMIE_MODEL || "claude-sonnet-5-5";
const PER_MINUTE = 6;

export default async function handler(req, res, deps = {}) {
  if (req.method !== "POST") return send(res, 405, { error: "POST seulement" });
  const sb = deps.sb || admin();
  const who = await caller(req, sb);
  if (!who || !who.role) return send(res, 401, { error: "Connectez-vous d’abord." });
  const { data: u } = await sb.auth.admin.getUserById(who.id);
  const access = who.role === "admin" ? ["academie"] : accessOf(u && u.user, who.role);
  if (access.indexOf("academie") < 0) return send(res, 403, { error: "Cet entraînement n’est pas ouvert pour vous (Paramètres › Accès)." });
  const body = await readJson(req);
  const cas = BY_ID[String(body.id || "")];
  if (!cas) return send(res, 400, { error: "Cas inconnu." });
  const answer = String(body.answer || "").slice(0, 4000), answer2 = String(body.answer2 || "").slice(0, 4000);
  if (!hasAnswer(answer, answer2)) return send(res, 400, { error: "Écris d’abord ta réponse, quelques phrases au moins." });
  const since = new Date(Date.now() - 60e3).toISOString();
  const { count } = await sb.from("crm_academy_corrections").select("id", { count: "exact", head: true }).eq("user_id", who.id).gte("created_at", since);
  if ((count || 0) >= PER_MINUTE) return send(res, 429, { error: "Trop de corrections d’affilée : réessaie dans une minute." });
  const call = deps.fetch || fetch;
  let out;
  try {
    const r = await call(SUPABASE_URL.replace(/\/+$/, "") + "/functions/v1/callqa-llm", {
      method: "POST", headers: { authorization: "Bearer " + process.env.SUPABASE_SERVICE_ROLE_KEY, "content-type": "application/json" },
      body: JSON.stringify({ model: MODEL, system: "Tu réponds uniquement avec un objet JSON valide, sans texte autour.", prompt: buildPrompt(cas, answer, answer2), max_tokens: 2500, effort: "none" }) });
    out = await r.json().catch(() => ({}));
    if (!r.ok) return send(res, r.status === 503 ? 429 : 502, { error: r.status === 503 ? "Trop de corrections d’affilée : réessaie dans une minute." : "La correction n’a pas abouti. Réessaie, ou auto-évalue-toi." });
  } catch (e) {
    return send(res, 502, { error: "La correction n’a pas abouti. Réessaie, ou auto-évalue-toi." });
  }
  const feedback = normalize(cas, parseModel(out.text));
  await sb.from("crm_academy_corrections").insert({ user_id: who.id, case_id: cas.id, usage: out.usage || null });
  if (!feedback) return send(res, 502, { error: "La correction n’a pas abouti. Réessaie, ou auto-évalue-toi." });
  // the attempt, kept on the person's account (crm_training_results, migration 049: never changed nor deleted); a mark by
  // Claude is written here only, so a page cannot claim one
  const cid = /^[A-Za-z0-9-]{8,64}$/.test(String(body.cid || "")) ? String(body.cid) : "srv-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  const secs = Math.max(0, Math.min(3600, Math.round(Number(body.duration_s) || 0)));
  const { error: e1 } = await sb.from("crm_training_results").insert({ user_id: who.id, cid, module: "academie", case_id: cas.id, score: feedback.score, max: 10,
    mode: "claude", duration_s: secs, details: { format: cas.fmt, criteres: feedback.criteres.map(c => c.points), eliminatoire: feedback.eliminatoire.declenche, reponse: answer, reponse2: cas.fmt === "B" ? answer2 : "" } });
  if (e1 && e1.code !== "23505") console.error("academie: result not kept", e1.code || "");
  return send(res, 200, { feedback });
}
