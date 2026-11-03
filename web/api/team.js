// Team access, for admins only: list members, invite, change a role, send a password reset link, remove.
// Invitation and reset links are returned to the admin, who sends them (no email server needed). A link opens the
// app itself (#skl-link=<token hash>&type=…); the one-time token is spent only when the person saves a password, so
// link previews (Slack, mail scanners) that open the link first cannot use it up.
import { admin, send, caller, origin, readJson } from "./_lib.js";
import { SCREENS, DEFAULT_ACCESS, defaultAccess, accessOf } from "./_screens.js";

const ROLES = ["admin", "member", "viewer"];

export default async function handler(req, res) {
  const sb = admin();
  const me = await caller(req, sb);
  if (!me) return send(res, 401, { error: "Connectez-vous d’abord." });
  if (me.role !== "admin") return send(res, 403, { error: "Seuls les administrateurs gèrent les accès de l’équipe." });

  if (req.method === "GET") {
    const { data: rows, error } = await sb.from("members").select("user_id, email, role, created_at").order("created_at");
    if (error) return send(res, 500, { error: error.message });
    const seen = {};
    for (let page = 1; page < 20; page++) {
      const { data } = await sb.auth.admin.listUsers({ page, perPage: 200 });
      const users = (data && data.users) || [];
      users.forEach(u => { seen[u.id] = { lastSignIn: u.last_sign_in_at, confirmed: !!(u.email_confirmed_at || u.last_sign_in_at), user: u }; });
      if (users.length < 200) break;
    }
    return send(res, 200, { me: me.id, screens: SCREENS, defaultAccess: DEFAULT_ACCESS, members: rows.map(r => { const s = seen[r.user_id] || {};
      return Object.assign({}, r, { lastSignIn: s.lastSignIn, confirmed: s.confirmed, access: accessOf(s.user, r.role) }); }) });
  }
  if (req.method !== "POST") return send(res, 405, { error: "Méthode non autorisée." });

  const b = await readJson(req);
  const redirectTo = origin(req) + "/";
  const adminsLeft = async () => { const { count } = await sb.from("members").select("user_id", { count: "exact", head: true }).eq("role", "admin"); return count || 0; };
  const appLink = (l, type) => redirectTo + "#skl-link=" + encodeURIComponent(l.data.properties.hashed_token) + "&type=" + type;
  const target = async id => { const { data } = await sb.from("members").select("user_id, email, role").eq("user_id", id).maybeSingle(); return data; };

  if (b.action === "invite") {
    const email = String(b.email || "").trim().toLowerCase();
    const role = ROLES.includes(b.role) ? b.role : "member";
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return send(res, 400, { error: "Saisissez une adresse e-mail valide." });
    let type = "invite", link = await sb.auth.admin.generateLink({ type, email, options: { redirectTo } });
    if (link.error && /already|registered|exists/i.test(link.error.message)) {
      type = "recovery"; link = await sb.auth.admin.generateLink({ type, email, options: { redirectTo } });
    }
    if (link.error) return send(res, 400, { error: link.error.message });
    const user = link.data.user;
    const { error } = await sb.from("members").upsert({ user_id: user.id, email, role });
    if (error) return send(res, 500, { error: error.message });
    return send(res, 200, { email, role, link: appLink(link, type) });
  }
  if (b.action === "role") {
    const t = await target(b.user_id);
    if (!t) return send(res, 404, { error: "Membre inconnu." });
    if (!ROLES.includes(b.role)) return send(res, 400, { error: "Rôle inconnu." });
    if (t.role === "admin" && b.role !== "admin" && (await adminsLeft()) <= 1) return send(res, 400, { error: "Gardez au moins un administrateur." });
    const { error } = await sb.from("members").update({ role: b.role }).eq("user_id", t.user_id);
    if (error) return send(res, 500, { error: error.message });
    return send(res, 200, { ok: true });
  }
  if (b.action === "access") {
    const t = await target(b.user_id);
    if (!t) return send(res, 404, { error: "Membre inconnu." });
    // admins too can be narrowed (Romain, 2026-10-25); nobody changes their own access, so nobody locks themselves out
    if (t.user_id === me.id) return send(res, 400, { error: "Vous ne pouvez pas changer vos propres accès. Demandez à un autre administrateur." });
    const screens = b.access === null ? null : (Array.isArray(b.access) ? SCREENS.filter(x => b.access.includes(x)) : undefined);
    if (screens === undefined) return send(res, 400, { error: "Liste d’accès inconnue." });
    const { data: cur, error: e0 } = await sb.auth.admin.getUserById(t.user_id);
    if (e0) return send(res, 500, { error: e0.message });
    const meta = Object.assign({}, (cur.user && cur.user.app_metadata) || {});
    if (screens === null) delete meta.screens; else meta.screens = screens;
    const { error } = await sb.auth.admin.updateUserById(t.user_id, { app_metadata: meta });
    if (error) return send(res, 500, { error: error.message });
    return send(res, 200, { access: screens === null ? defaultAccess(t.role) : screens });
  }
  if (b.action === "reset") {
    const t = await target(b.user_id);
    if (!t) return send(res, 404, { error: "Membre inconnu." });
    const link = await sb.auth.admin.generateLink({ type: "recovery", email: t.email, options: { redirectTo } });
    if (link.error) return send(res, 400, { error: link.error.message });
    return send(res, 200, { email: t.email, link: appLink(link, "recovery") });
  }
  if (b.action === "remove") {
    const t = await target(b.user_id);
    if (!t) return send(res, 404, { error: "Membre inconnu." });
    if (t.user_id === me.id) return send(res, 400, { error: "Vous ne pouvez pas vous retirer vous-même." });
    if (t.role === "admin" && (await adminsLeft()) <= 1) return send(res, 400, { error: "Gardez au moins un administrateur." });
    const { error } = await sb.auth.admin.deleteUser(t.user_id);
    if (error) return send(res, 500, { error: error.message });
    return send(res, 200, { ok: true });
  }
  return send(res, 400, { error: "Action inconnue." });
}
