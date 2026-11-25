// Small checks with no framework code, so they are easy to test.
export const FACTIONS = ['COSMIC', 'GALACTIC', 'QUANTUM', 'DOMINION', 'ASTRO', 'CORSAIRS', 'VOID', 'OBSIDIAN', 'AEGIS', 'UNITED'];

export function cleanCallsign(value: unknown): string | null {
  const callsign = String(value ?? '').trim().toUpperCase();
  return /^[A-Z0-9_-]{3,14}$/.test(callsign) ? callsign : null;
}

/** Only game routes may go through our server. Registration has its own route. */
export function isAllowedGamePath(method: string, parts: string[]): boolean {
  if (!parts.length || !parts.every((part) => /^[A-Za-z0-9_-]+$/.test(part))) return false;
  if (method === 'GET') return ['my', 'systems', 'factions'].includes(parts[0]);
  return ['POST', 'PATCH'].includes(method) && parts[0] === 'my';
}

/** A request that changes something must come from our own site. */
export function isSameSite(origin: string | null, host: string | null): boolean {
  if (!origin || !host) return false;
  try { return new URL(origin).host === host; } catch { return false; }
}
