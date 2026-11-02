// One-time setup: creates the first admin and returns their invitation link.
// Works only while the BOOTSTRAP_TOKEN environment variable is set and the team has no admin yet.
import { admin, send, origin, readJson } from "./_lib.js";
import { BUCKET, ensureBucket } from "./files.js";

export default async function handler(req, res) {
  const token = process.env.BOOTSTRAP_TOKEN;
  if (!token || req.method !== "POST" || req.headers["x-bootstrap-token"] !== token) return send(res, 404, { error: "Not found." });
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
  // one-time import of files shipped with the repository (for example the KR memos) into the Library bucket
  if (b0.action === "storefile") {
    const e = await ensureBucket(sb); if (e) return send(res, 500, { error: e.message });
    const body = Buffer.from(String(b0.base64 || ""), "base64");
    const { error } = await sb.storage.from(BUCKET).upload(String(b0.path), body, { contentType: b0.contentType || "application/octet-stream", upsert: true });
    return error ? send(res, 500, { error: error.message }) : send(res, 200, { path: b0.path, size: body.length });
  }
  // one-time data load (same rows as web/supabase/002_q4_okrs.sql): upsert, or insert only when absent
  if (b0.action === "upsert") {
    const rows = (Array.isArray(b0.rows) ? b0.rows : []).filter(r => r && r.col && r.id && r.body);
    let n = 0;
    for (const r of rows) {
      const q = sb.from("docs").upsert({ col: String(r.col), id: String(r.id), body: r.body }, { onConflict: "col,id", ignoreDuplicates: !!r.ifAbsent });
      const { error } = await q; if (error) return send(res, 500, { error: error.message, done: n }); n++;
    }
    return send(res, 200, { done: n });
  }
  if (b0.action === "removefile") {
    const { error } = await sb.storage.from(BUCKET).remove([String(b0.path || "")]);
    return error ? send(res, 500, { error: error.message }) : send(res, 200, { ok: true });
  }
  if (b0.action === "deleteuser") {
    const { data } = await sb.from("members").select("user_id, role").eq("email", String(b0.email || "")).maybeSingle();
    if (!data || data.role === "admin") return send(res, 400, { error: "Only test accounts can be deleted here." });
    const { error } = await sb.auth.admin.deleteUser(data.user_id);
    return error ? send(res, 500, { error: error.message }) : send(res, 200, { ok: true });
  }
  const { count, error: e1 } = await sb.from("members").select("user_id", { count: "exact", head: true }).eq("role", "admin");
  if (e1) return send(res, 500, { error: e1.message });
  if (count) return send(res, 409, { error: "The team already has an admin." });
  const email = String(b0.email || "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return send(res, 400, { error: "Enter a valid email address." });
  const redirectTo = origin(req) + "/";
  let link = await sb.auth.admin.generateLink({ type: "invite", email, options: { redirectTo } });
  if (link.error && /already|registered|exists/i.test(link.error.message)) link = await sb.auth.admin.generateLink({ type: "recovery", email, options: { redirectTo } });
  if (link.error) return send(res, 400, { error: link.error.message });
  const { error } = await sb.from("members").upsert({ user_id: link.data.user.id, email, role: "admin" });
  if (error) return send(res, 500, { error: error.message });
  return send(res, 200, { email, link: link.data.properties.action_link });
}
