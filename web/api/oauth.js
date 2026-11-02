// SKL OS connector for Claude: the small OAuth 2.1 authorization server (docs/crm/17-claude-connector.md §3, option 2).
// One function for every endpoint (vercel.json rewrites):
//   /.well-known/oauth-protected-resource[/api/mcp]   → ?op=resource   RFC 9728
//   /.well-known/oauth-authorization-server[/…]       → ?op=metadata   RFC 8414
//   /api/oauth/register                               → ?op=register   RFC 7591 dynamic client registration
//   /api/oauth/authorize                              → ?op=authorize  SKL OS sign-in + consent, one-time code (PKCE S256)
//   /api/oauth/token                                  → ?op=token      code → the person's own Supabase tokens; refresh
// The tokens Claude receives are the person's Supabase access and refresh tokens, from a sign-in made for Claude only
// (its own session), so row-level security applies to every tool exactly as in the app, and removing a person in Team
// access stops the connector at the next refresh. The service role touches only the OAuth tables (014_mcp.sql).
import { createHash, randomBytes } from "node:crypto";
import { admin, anon, asUser, cors, origin, readJson } from "./_lib.js";
import { accessOf } from "./_screens.js";

const SCOPE = "skl.read";
const CODE_TTL = 60;   // seconds
// Claude's callbacks (claude.ai, and claude.com should the domain move) and local tools (MCP Inspector, Claude Code)
export function redirectAllowed(uri) {
  let u; try { u = new URL(uri); } catch (e) { return false; }
  if (u.hash) return false;
  if (u.protocol === "https:" && (u.host === "claude.ai" || u.host === "claude.com") && u.pathname === "/api/mcp/auth_callback") return true;
  return u.protocol === "http:" && (u.hostname === "localhost" || u.hostname === "127.0.0.1");
}
const b64url = buf => Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const sha = s => createHash("sha256").update(s).digest();

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}
async function readForm(req) {
  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) return req.body;
  let raw = typeof req.body === "string" ? req.body : Buffer.isBuffer(req.body) ? req.body.toString("utf8") : null;
  if (raw == null) { const chunks = []; for await (const c of req) chunks.push(c); raw = Buffer.concat(chunks).toString("utf8"); }
  if (/json/i.test(req.headers["content-type"] || "")) { try { return JSON.parse(raw || "{}"); } catch (e) { return {}; } }
  return Object.fromEntries(new URLSearchParams(raw));
}
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export function metadata(base) {
  return {
    issuer: base,
    authorization_endpoint: base + "/api/oauth/authorize",
    token_endpoint: base + "/api/oauth/token",
    registration_endpoint: base + "/api/oauth/register",
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    scopes_supported: [SCOPE],
    service_documentation: base + "/"
  };
}
export function resourceMetadata(base) {
  return { resource: base + "/api/mcp", resource_name: "SKL OS", authorization_servers: [base], bearer_methods_supported: ["header"], scopes_supported: [SCOPE] };
}

// ---------------- dynamic client registration ----------------
async function register(req, res, sb) {
  const b = await readJson(req);
  const uris = Array.isArray(b.redirect_uris) ? b.redirect_uris.map(String) : [];
  if (!uris.length || uris.length > 5) return json(res, 400, { error: "invalid_redirect_uri", error_description: "Give 1 to 5 redirect_uris." });
  const bad = uris.find(x => !redirectAllowed(x));
  if (bad) return json(res, 400, { error: "invalid_redirect_uri", error_description: "Redirect URI not allowed: " + bad });
  if (b.token_endpoint_auth_method && b.token_endpoint_auth_method !== "none") return json(res, 400, { error: "invalid_client_metadata", error_description: "Only public clients (token_endpoint_auth_method none, PKCE) are supported." });
  const client_id = "skl_" + b64url(randomBytes(18));
  const name = String(b.client_name || "MCP client").slice(0, 80);
  const { error } = await sb.from("mcp_oauth_clients").insert({ client_id, client_name: name, redirect_uris: uris });
  if (error) return json(res, 500, { error: "server_error", error_description: error.message });
  return json(res, 201, { client_id, client_id_issued_at: Math.floor(Date.now() / 1000), client_name: name, redirect_uris: uris,
    token_endpoint_auth_method: "none", grant_types: ["authorization_code", "refresh_token"], response_types: ["code"], scope: SCOPE });
}

// ---------------- authorization: sign-in page and code ----------------
const PAGE_CSS = "*{box-sizing:border-box}body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#F6F4EF;color:#1B1B18;font-family:'IBM Plex Sans',system-ui,sans-serif;padding:24px}"
  + ".card{width:min(440px,100%);background:#fff;border:1px solid #E3DFD5;border-radius:14px;padding:32px;display:flex;flex-direction:column;gap:16px}"
  + "h1{margin:0;font-family:Fraunces,Georgia,serif;font-weight:500;font-size:26px}.k{font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:#9A6614;font-weight:600}"
  + "p{margin:0;font-size:14px;line-height:1.55;color:#5E5B53}label{display:flex;flex-direction:column;gap:6px;font-size:13px;font-weight:600}"
  + "input{font:inherit;font-size:15px;padding:10px 12px;border:1px solid #D8D3C7;border-radius:10px}input:focus{outline:2px solid #D9B46A;border-color:#D9B46A}"
  + ".row{display:flex;gap:10px;justify-content:flex-end}button{font:inherit;font-size:14px;font-weight:600;border-radius:10px;padding:11px 18px;cursor:pointer}"
  + ".ok{background:#1B1B18;color:#D9B46A;border:1px solid #1B1B18}.no{background:#fff;color:#1B1B18;border:1px solid #D8D3C7}"
  + ".err{background:#FBEAEA;border:1px solid #E7B9B9;color:#8A2D3B;border-radius:10px;padding:10px 12px;font-size:13px}ul{margin:0;padding-left:18px;font-size:14px;color:#5E5B53;line-height:1.6}";
function page(res, status, inner) {
  res.statusCode = status;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; form-action 'self' https://claude.ai https://claude.com http://localhost:* http://127.0.0.1:*; frame-ancestors 'none'; base-uri 'none'");
  res.end('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SKL OS · Connect Claude</title>'
    + '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:wght@500&family=IBM+Plex+Sans:wght@400;600&display=swap">'
    + "<style>" + PAGE_CSS + '</style></head><body><main class="card">' + inner + "</main></body></html>");
}
function problem(res, msg) { return page(res, 400, '<div class="k">SKL OS</div><h1>This link does not work</h1><p>' + esc(msg) + "</p><p>Remove the connector in Claude and add it again.</p>"); }
function form(res, p, clientName, err, email) {
  const hidden = ["response_type", "client_id", "redirect_uri", "code_challenge", "code_challenge_method", "state", "scope", "resource"]
    .map(k => p[k] != null ? '<input type="hidden" name="' + k + '" value="' + esc(p[k]) + '">' : "").join("");
  return page(res, err ? 401 : 200, '<div class="k">SKL OS · ALKIMIY</div><h1>Connect ' + esc(clientName || "Claude") + "</h1>"
    + "<p><strong>" + esc(clientName || "Claude") + "</strong> asks to <strong>read</strong> SKL OS with your rights: the leads, cycles, messages and figures you can see in the app. It cannot change anything.</p>"
    + (err ? '<div class="err" role="alert">' + esc(err) + "</div>" : "")
    + '<form method="post" style="display:flex;flex-direction:column;gap:14px">' + hidden
    + '<label>Email<input name="email" type="email" autocomplete="username" required value="' + esc(email || "") + '"></label>'
    + '<label>Password<input name="password" type="password" autocomplete="current-password" required></label>'
    + '<div class="row"><button class="no" type="submit" name="decision" value="deny" formnovalidate>Cancel</button><button class="ok" type="submit" name="decision" value="allow">Sign in and allow</button></div>'
    + "</form><p>Use your SKL OS account. You can disconnect at any time in Claude (Settings › Connectors).</p>");
}
function back(res, redirectUri, params) {
  const u = new URL(redirectUri);
  Object.entries(params).forEach(([k, v]) => { if (v != null && v !== "") u.searchParams.set(k, v); });
  res.statusCode = 302; res.setHeader("Location", u.toString()); res.setHeader("Cache-Control", "no-store"); res.end();
}
// a signed-in account may use the connector: SKL OS member, CRM role, "claude" access key (read with the person's own token)
export async function mayUseConnector(accessToken, user) {
  const sb = asUser(accessToken);
  const [{ data: mem }, { data: crm }] = await Promise.all([
    sb.from("members").select("role").eq("user_id", user.id).maybeSingle(),
    sb.from("crm_members").select("role,active").eq("id", user.id).maybeSingle()]);
  if (!mem) return "This account is not a member of SKL OS.";
  if (!crm || !crm.active) return "This account has no CRM role. Ask an admin.";
  if (!accessOf(user, mem.role).includes("claude")) return "The Claude connector is not open for this account. Ask an admin to tick it in Settings › Access.";
  return null;
}

async function authorize(req, res, sb) {
  const p = req.method === "POST" ? await readForm(req) : Object.fromEntries(new URL(req.url, "http://x").searchParams);
  if (!p.client_id) return problem(res, "The request has no client_id.");
  const { data: client } = await sb.from("mcp_oauth_clients").select("client_id,client_name,redirect_uris").eq("client_id", p.client_id).maybeSingle();
  if (!client) return problem(res, "This connector registration is unknown (it may have been reset).");
  if (!p.redirect_uri || !client.redirect_uris.includes(p.redirect_uri)) return problem(res, "The return address does not match the connector's registration.");
  // from here errors go back to the client, as OAuth asks
  if (p.response_type !== "code") return back(res, p.redirect_uri, { error: "unsupported_response_type", state: p.state });
  if (!p.code_challenge || p.code_challenge_method !== "S256") return back(res, p.redirect_uri, { error: "invalid_request", error_description: "PKCE with S256 is required.", state: p.state });
  if (req.method !== "POST") return form(res, p, client.client_name);
  if (p.decision !== "allow") return back(res, p.redirect_uri, { error: "access_denied", state: p.state });
  const email = String(p.email || "").trim().toLowerCase();
  const pub = anon();
  const { data, error } = await pub.auth.signInWithPassword({ email, password: String(p.password || "") });
  if (error || !data || !data.session) return form(res, p, client.client_name, /invalid/i.test(error ? error.message : "") ? "Wrong email or password. Use the same password as the SKL OS web app; if you never chose one or forgot it, ask an admin for a link (Team access › Reset link, or New invite link for someone who never signed in)." : (error ? error.message : "Sign-in failed."), email);
  const why = await mayUseConnector(data.session.access_token, data.user);
  if (why) { try { await pub.auth.signOut(); } catch (e) {} return form(res, p, client.client_name, why, email); }
  const code = b64url(randomBytes(32));
  await sb.from("mcp_oauth_codes").delete().lt("expires_at", new Date().toISOString());
  const { error: e2 } = await sb.from("mcp_oauth_codes").insert({
    code_hash: b64url(sha(code)), client_id: client.client_id, redirect_uri: p.redirect_uri, code_challenge: p.code_challenge, user_id: data.user.id,
    access_token: data.session.access_token, refresh_token: data.session.refresh_token, expires_in: data.session.expires_in || 3600,
    expires_at: new Date(Date.now() + CODE_TTL * 1000).toISOString() });
  if (e2) return back(res, p.redirect_uri, { error: "server_error", state: p.state });
  return back(res, p.redirect_uri, { code, state: p.state });
}

// ---------------- token ----------------
async function token(req, res, sb) {
  const b = await readForm(req);
  const fail = (status, error, d) => json(res, status, { error, error_description: d });
  if (b.grant_type === "authorization_code") {
    if (!b.code || !b.code_verifier || !b.client_id) return fail(400, "invalid_request", "code, code_verifier and client_id are required.");
    const { data: client } = await sb.from("mcp_oauth_clients").select("client_id").eq("client_id", b.client_id).maybeSingle();
    if (!client) return fail(401, "invalid_client", "Unknown client: register again.");
    await sb.from("mcp_oauth_codes").delete().lt("expires_at", new Date().toISOString());   // codes never exchanged
    // single use: the row is deleted as it is read
    const { data: got } = await sb.from("mcp_oauth_codes").delete().eq("code_hash", b64url(sha(String(b.code)))).select();
    const c = got && got[0];
    if (!c || c.client_id !== b.client_id || new Date(c.expires_at).getTime() < Date.now()) return fail(400, "invalid_grant", "The code is unknown, used or expired.");
    if (b.redirect_uri && b.redirect_uri !== c.redirect_uri) return fail(400, "invalid_grant", "redirect_uri does not match.");
    if (b64url(sha(String(b.code_verifier))) !== c.code_challenge) return fail(400, "invalid_grant", "PKCE check failed.");
    return json(res, 200, { access_token: c.access_token, token_type: "Bearer", expires_in: c.expires_in, refresh_token: c.refresh_token, scope: SCOPE });
  }
  if (b.grant_type === "refresh_token") {
    if (!b.refresh_token) return fail(400, "invalid_request", "refresh_token is required.");
    if (b.client_id) {
      const { data: client } = await sb.from("mcp_oauth_clients").select("client_id").eq("client_id", b.client_id).maybeSingle();
      if (!client) return fail(401, "invalid_client", "Unknown client: register again.");
    }
    const pub = anon();
    const { data, error } = await pub.auth.refreshSession({ refresh_token: String(b.refresh_token) });
    if (error || !data || !data.session) return fail(400, "invalid_grant", "The SKL OS sign-in has ended. Connect again.");
    const why = await mayUseConnector(data.session.access_token, data.user);
    if (why) { try { await pub.auth.signOut(); } catch (e) {} return fail(400, "invalid_grant", why); }
    return json(res, 200, { access_token: data.session.access_token, token_type: "Bearer", expires_in: data.session.expires_in || 3600, refresh_token: data.session.refresh_token, scope: SCOPE });
  }
  return fail(400, "unsupported_grant_type", "Use authorization_code or refresh_token.");
}

// the endpoint: ?op= from the vercel.json rewrite, else the path itself (a rewrite may keep the original URL)
export function opOf(req) {
  if (req.query && req.query.op) return String(req.query.op);
  const u = new URL(req.url, "http://x");
  if (u.searchParams.get("op")) return u.searchParams.get("op");
  if (u.pathname.startsWith("/.well-known/oauth-protected-resource")) return "resource";
  if (u.pathname.startsWith("/.well-known/oauth-authorization-server")) return "metadata";
  const m = /\/api\/oauth\/(register|authorize|token)\/?$/.exec(u.pathname);
  return m ? m[1] : null;
}

export default async function handler(req, res) {
  const op = opOf(req);
  const base = origin(req);
  if (op !== "authorize") cors(res);
  if (req.method === "OPTIONS") { res.statusCode = 204; return res.end(); }
  if (op === "metadata") return json(res, 200, metadata(base));
  if (op === "resource") return json(res, 200, resourceMetadata(base));
  const sb = admin();
  if (op === "register") return req.method === "POST" ? register(req, res, sb) : json(res, 405, { error: "invalid_request", error_description: "POST only." });
  if (op === "authorize") return (req.method === "GET" || req.method === "POST") ? authorize(req, res, sb) : json(res, 405, { error: "invalid_request" });
  if (op === "token") return req.method === "POST" ? token(req, res, sb) : json(res, 405, { error: "invalid_request", error_description: "POST only." });
  return json(res, 404, { error: "not_found" });
}
