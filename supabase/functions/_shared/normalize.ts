// Normalisation of identifiers before matching (docs/crm/03-identity-matching.md §1).
import { parsePhoneNumberFromString } from "npm:libphonenumber-js@1.13.14/max";

// trim, lowercase, no surrounding <>; null when it is not an email
export function normEmail(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim().replace(/^<|>$/g, "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) ? s : null;
}

// E.164 or null. A number without a country code is never guessed (it goes unmatched instead).
export function normPhone(v: unknown): string | null {
  if (typeof v !== "string" && typeof v !== "number") return null;
  let s = String(v).trim().replace(/[^\d+]/g, "");
  if (s.startsWith("00")) s = "+" + s.slice(2);
  if (!s.startsWith("+")) return null;
  const p = parsePhoneNumberFromString(s);
  return p && p.isValid() ? p.number : null;
}

export function normId(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s ? s : null;
}
