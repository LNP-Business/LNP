// One-time setup: creates the first admin and returns their invitation link.
// Works only while the BOOTSTRAP_TOKEN environment variable is set and the team has no admin yet.
import { admin, send, origin, readJson } from "./_lib.js";

export default async function handler(req, res) {
  const token = process.env.BOOTSTRAP_TOKEN;
  if (!token || req.method !== "POST" || req.headers["x-bootstrap-token"] !== token) return send(res, 404, { error: "Introuvable." });
  const sb = admin();
  const b0 = await readJson(req);
  // test accounts for end-to-end checks, only while BOOTSTRAP_TOKEN exists
  if (b0.action === "testuser") {
    const role = ["member", "viewer"].includes(b0.role) ? b0.role : "member";
    const { data, error } = await sb.auth.admin.createUser({ email: b0.email, password: b0.password, email_confirm: true });
    if (error) return send(res, 400, { error: error.message });
    const { error: e2 } = await sb.from("members").upsert({ user_id: data.user.id, email: b0.email, role });
    if (e2) return send(res, 500, { error: e2.message });
    return send(res, 200, { id: data.user.id });
  }
  if (b0.action === "deleteuser") {
    const { data } = await sb.from("members").select("user_id, role").eq("email", String(b0.email || "")).maybeSingle();
    if (!data || data.role === "admin") return send(res, 400, { error: "Seuls les comptes de test peuvent être supprimés ici." });
    const { error } = await sb.auth.admin.deleteUser(data.user_id);
    return error ? send(res, 500, { error: error.message }) : send(res, 200, { ok: true });
  }
  const { count, error: e1 } = await sb.from("members").select("user_id", { count: "exact", head: true }).eq("role", "admin");
  if (e1) return send(res, 500, { error: e1.message });
  if (count) return send(res, 409, { error: "L’équipe a déjà un administrateur." });
  const email = String(b0.email || "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return send(res, 400, { error: "Saisissez une adresse e-mail valide." });
  const redirectTo = origin(req) + "/";
  let link = await sb.auth.admin.generateLink({ type: "invite", email, options: { redirectTo } });
  if (link.error && /already|registered|exists/i.test(link.error.message)) link = await sb.auth.admin.generateLink({ type: "recovery", email, options: { redirectTo } });
  if (link.error) return send(res, 400, { error: link.error.message });
  const { error } = await sb.from("members").upsert({ user_id: link.data.user.id, email, role: "admin" });
  if (error) return send(res, 500, { error: error.message });
  return send(res, 200, { email, link: link.data.properties.action_link });
}
