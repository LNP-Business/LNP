// Server helpers shared by the API routes. Files starting with "_" are not routes on Vercel.
import { createClient } from "@supabase/supabase-js";

export const SUPABASE_URL = process.env.SUPABASE_URL;
export const ANON_KEY = process.env.SUPABASE_ANON_KEY;

export function admin() {
  return createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function send(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

// The caller, from the "Authorization: Bearer <access token>" header, with their team role (or null).
export async function caller(req, sb) {
  const m = /^Bearer\s+(.+)$/i.exec(req.headers.authorization || "");
  if (!m) return null;
  const { data, error } = await sb.auth.getUser(m[1]);
  if (error || !data || !data.user) return null;
  const { data: row } = await sb.from("members").select("role").eq("user_id", data.user.id).maybeSingle();
  return { id: data.user.id, email: data.user.email, role: row ? row.role : null };
}

// The address links point to: the domain the admin is using (so a new Vercel domain works with no setting to change),
// SITE_URL only when the request has no usable host (local runs). Links are shown to the admin, never emailed.
export function origin(req) {
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "").split(",")[0].trim();
  if (host && !/^(localhost|127\.|0\.0\.0\.0)/.test(host)) {
    const proto = String(req.headers["x-forwarded-proto"] || "https").split(",")[0].trim();
    return proto + "://" + host;
  }
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/+$/, "");
  return "https://" + (host || "localhost");
}

export async function readJson(req) {
  if (req.body && typeof req.body === "object") return req.body;
  const chunks = [];
  for await (const c of req) chunks.push(c);
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"); } catch (e) { return {}; }
}

// A Supabase client acting AS the caller (their access token): row-level security applies as in the app.
export function asUser(token) {
  return createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: "Bearer " + token } } });
}
// A public client (anon key) for sign-in and token refresh.
export function anon() {
  return createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
}
// CORS for the connector's public endpoints (MCP clients and inspectors may run in a browser).
export function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, Mcp-Protocol-Version, Mcp-Session-Id, Last-Event-ID");
  res.setHeader("Access-Control-Expose-Headers", "WWW-Authenticate, Mcp-Session-Id");
}
