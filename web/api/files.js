// Library files in Supabase Storage (private bucket "library"). The browser never gets a storage key:
//  - upload: admins and members get a one-time signed upload URL, then send the file straight to Storage;
//  - url: any member gets a short-lived signed link to open or download a file.
import { admin, send, caller, readJson } from "./_lib.js";

export const BUCKET = "library";
export async function ensureBucket(sb) {
  const { data } = await sb.storage.getBucket(BUCKET);
  if (data) return null;
  const { error } = await sb.storage.createBucket(BUCKET, { public: false });
  return error && !/exists/i.test(error.message) ? error : null;
}
const safe = n => String(n || "file").normalize("NFKD").replace(/[^\w.\- ]+/g, "").replace(/\s+/g, "-").slice(-120) || "file";

export default async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { error: "Method not allowed." });
  const sb = admin();
  const me = await caller(req, sb);
  if (!me || !me.role) return send(res, 401, { error: "Sign in first." });
  const b = await readJson(req);
  if (b.action === "upload") {
    if (me.role !== "admin" && me.role !== "member") return send(res, 403, { error: "Read-only access: files cannot be added." });
    const e = await ensureBucket(sb); if (e) return send(res, 500, { error: e.message });
    const d = new Date().toISOString().slice(0, 10);
    const path = d.slice(0, 7) + "/" + d + "-" + Math.random().toString(36).slice(2, 10) + "-" + safe(b.name);
    const { data, error } = await sb.storage.from(BUCKET).createSignedUploadUrl(path);
    if (error) return send(res, 500, { error: error.message });
    return send(res, 200, { path: data.path, token: data.token });
  }
  if (b.action === "url") {
    const path = String(b.path || "");
    if (!path || path.includes("..")) return send(res, 400, { error: "Unknown file." });
    const opts = b.download ? { download: String(b.download) } : undefined;
    const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(path, 600, opts);
    if (error) return send(res, 404, { error: "This file is no longer available." });
    return send(res, 200, { url: data.signedUrl });
  }
  return send(res, 400, { error: "Unknown action." });
}
