// Constant-time comparison of a shared token (iClosed, WhatsApp through a provider).
// An unset or empty secret never matches.

const enc = new TextEncoder();

export function timingSafeEqualBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export async function tokenMatches(given: string | null | undefined, expected: string | null | undefined): Promise<boolean> {
  if (!given || !expected) return false;
  // Hash both sides first so the comparison time does not depend on the token length either.
  const [g, e] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(given)),
    crypto.subtle.digest("SHA-256", enc.encode(expected)),
  ]);
  return timingSafeEqualBytes(new Uint8Array(g), new Uint8Array(e));
}
