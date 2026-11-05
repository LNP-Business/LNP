// The screens an admin can open to other people in LNP (Settings › Access itself is never grantable, Settings › Account is
// always open). "claude" is not a screen: it lets a person use the LNP connector in Claude (docs/crm/17-claude-connector.md).
export const SCREENS = ["salescockpit", "salesday", "entrainement", "crm", "settings", "claude"];
// Everyone opens every screen, new people included (Romain, 2026-10-25); an admin can still narrow it in Settings › Access.
// The Claude connector is for admins only by default; an admin can open it to anyone.
export const DEFAULT_ACCESS = SCREENS.filter(x => x !== "claude");
export function defaultAccess(role) { return role === "admin" ? SCREENS.slice() : DEFAULT_ACCESS.slice(); }

// What a person may open: stored in their auth app_metadata (only the server can write it). A list written before may
// hold keys of screens LNP does not have (cockpit, build, library…): they are ignored, never an error.
export function accessOf(user, role) {
  const a = user && user.app_metadata && user.app_metadata.screens;
  if (!Array.isArray(a)) return defaultAccess(role);
  // Sales Day (2026-10-31) and Entraînement (2026-11-05) open to whoever opens the CRM or Sales Day, in lists written
  // before they existed
  const l = a.map(String).concat(a.includes("crm") ? ["salesday"] : []).concat(a.includes("crm") || a.includes("salesday") ? ["entrainement"] : []);
  return [...new Set(l)].filter(x => SCREENS.includes(x));
}
