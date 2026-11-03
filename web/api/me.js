// The signed-in person: team role and the screens they may open (fresh on every load). Admins always keep Settings › Access.
import { admin, send } from "./_lib.js";
import { accessOf } from "./_screens.js";

export default async function handler(req, res) {
  const m = /^Bearer\s+(.+)$/i.exec(req.headers.authorization || "");
  if (!m) return send(res, 401, { error: "Connectez-vous d’abord." });
  const sb = admin();
  const { data, error } = await sb.auth.getUser(m[1]);
  if (error || !data || !data.user) return send(res, 401, { error: "Connectez-vous d’abord." });
  const { data: row } = await sb.from("members").select("role").eq("user_id", data.user.id).maybeSingle();
  const role = row ? row.role : null;
  if (!role) return send(res, 200, { role: null, access: [] });
  return send(res, 200, { role, access: role === "admin" ? accessOf(data.user, role).concat(["access"]) : accessOf(data.user, role) });
}
