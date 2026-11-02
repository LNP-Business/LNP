// The screens an admin can open to other people (Settings › Access itself is never grantable). "claude" is not a screen:
// it lets a person use the SKL OS connector in Claude (docs/crm/17-claude-connector.md).
export const SCREENS = [
  "cockpit", "build", "execute", "decisions", "review", "crm", "salescockpit", "salesday",
  "bibliotheque", "mechanisms", "mechprecall", "mechsales", "mechos",
  "cartomap", "cartoevents", "cartoworks", "cartosim", "cartomodel",
  "agentsoverview", "agentsdecisions", "agentsregistry", "agentstriggers", "agentslog",
  "settings", "registers", "claude"
];
// Everyone opens every screen, new people included (Romain, 2026-10-25); an admin can still narrow it in Settings › Access.
// The Claude connector is for admins only by default while it is read only (phase A); an admin can open it to anyone.
export const DEFAULT_ACCESS = SCREENS.filter(x => x !== "claude");
export function defaultAccess(role) { return role === "admin" ? SCREENS.slice() : DEFAULT_ACCESS.slice(); }

// What a person may open: stored in their auth app_metadata (only the server can write it).
// Roadmap and My Day were replaced by Build and Execute (2026-10-30): an access list written before keeps them open
const MOVED = { roadmap: "build", monjour: "execute" };
export function accessOf(user, role) {
  const a = user && user.app_metadata && user.app_metadata.screens;
  if (!Array.isArray(a)) return defaultAccess(role);
  // Sales Day (2026-10-31) opens to whoever opens the CRM, in lists written before it existed
  const l = a.map(x => MOVED[x] || x).concat(a.includes("crm") ? ["salesday"] : []);
  return [...new Set(l)].filter(x => SCREENS.includes(x));
}
