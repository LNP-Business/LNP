/**
 * state-parse-helpers.ts — helpers purs du gestionnaire d'état.
 * Extrait verbatim de simulation-state-manager.ts (chantier #2, mai 2026).
 */

export function safeParseJson(raw: string): any {
  const cleaned = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    // Tentative extraction objet JSON
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error('JSON parse failed');
  }
}

export function isNovelArgument(argumentsUsed: string[], commercialMessage: string): boolean {
  if (argumentsUsed.length === 0) return true;
  const truncated = commercialMessage.substring(0, 80);
  return !argumentsUsed.some(arg => arg.substring(0, 50) === truncated.substring(0, 50));
}
