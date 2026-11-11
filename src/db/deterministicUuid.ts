/**
 * Deterministic UUID from a stable key. If sample/reference data is ever seeded,
 * two devices that independently seed the same key converge on one row instead
 * of creating duplicates once they sync. Pure function via the cyrb128 hash,
 * formatted as a syntactically valid uuid (good enough for Postgres `uuid`; not
 * a cryptographic RFC-4122 v5).
 */

export function deterministicUuid(key: string): string {
  let h1 = 1779033703;
  let h2 = 3144134277;
  let h3 = 1013904242;
  let h4 = 2773480762;
  for (let i = 0; i < key.length; i++) {
    const k = key.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);

  const hex = [h1, h2, h3, h4].map((n) => (n >>> 0).toString(16).padStart(8, '0')).join('');
  const s = hex.split('');
  s[12] = '5';
  s[16] = ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  const u = s.join('');
  return `${u.slice(0, 8)}-${u.slice(8, 12)}-${u.slice(12, 16)}-${u.slice(16, 20)}-${u.slice(20, 32)}`;
}
