// The screens an admin can open to other people in LNP (Settings › Access itself is never grantable, Settings › Account is
// always open). "claude" is not a screen: it lets a person use the LNP connector in Claude (docs/crm/17-claude-connector.md).
export const SCREENS = ["salescockpit", "salesday", "entrainement", "academie", "crm", "settings", "claude"];
// Not in Settings › Access: « Mes résultats » opens with any training (Découverte or Maîtrise de l'offre), « Alertes » with the
// CRM or Ma journée, « Suivi des commerciaux » is for admins only (web/api/me.js), like Settings › Access.
export const DERIVED = ["resultats", "alertes"];
// Everyone opens every screen, new people included (Romain, 2026-10-25); an admin can still narrow it in Settings › Access.
// The Claude connector is for admins only by default; an admin can open it to anyone.
export const DEFAULT_ACCESS = SCREENS.filter(x => x !== "claude");
// A list saved from Settings › Access after the training screens were split (2026-11-06) carries this mark, so a training
// closed on purpose stays closed; a list saved before gets the new screens of what it opens.
export const MARK = "v2026-11-06";
export function defaultAccess(role) { return withDerived(role === "admin" ? SCREENS.slice() : DEFAULT_ACCESS.slice()); }
function withDerived(l) {
  if (l.includes("entrainement") || l.includes("academie")) l = l.concat(["resultats"]);
  // Alertes (2026-11-09) opens with the CRM or Ma journée: everyone who works leads sees the alerts of their leads
  if (l.includes("crm") || l.includes("salesday")) l = l.concat(["alertes"]);
  return l;
}

// What a person may open: stored in their auth app_metadata (only the server can write it). A list written before may
// hold keys of screens LNP does not have (cockpit, build, library…): they are ignored, never an error.
export function accessOf(user, role) {
  const a = user && user.app_metadata && user.app_metadata.screens;
  if (!Array.isArray(a)) return defaultAccess(role);
  let l = a.map(String);
  if (!l.includes(MARK)) {
    // Sales Day (2026-10-31) and Entraînement (2026-11-05) open to whoever opens the CRM or Sales Day, and Maîtrise de
    // l'offre (2026-11-06) to whoever opens Entraînement, in lists written before they existed
    if (l.includes("crm")) l.push("salesday");
    if (l.includes("crm") || l.includes("salesday")) l.push("entrainement");
    if (l.includes("entrainement")) l.push("academie");
  }
  l = [...new Set(l)].filter(x => SCREENS.includes(x));
  return withDerived(l);
}
