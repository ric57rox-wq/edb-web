/**
 * Pure derived-metric helpers (ported from the native EDB app). No I/O, so they
 * are trivially unit-testable and reused across list cards, detail screens, and
 * analytics roll-ups.
 */

export type BarrelHealth = 'ok' | 'warn' | 'danger' | 'replace';

/**
 * Barrel wear band from current rounds vs. target life:
 * ok `<75%`, warn `75–90%`, danger `90–99%`, replace `≥100%`.
 * With no life target set, there is nothing to measure against → `ok`.
 */
export function barrelHealth(rounds: number, life?: number | null): BarrelHealth {
  if (!life || life <= 0) return 'ok';
  const pct = rounds / life;
  if (pct >= 1) return 'replace';
  if (pct >= 0.9) return 'danger';
  if (pct >= 0.75) return 'warn';
  return 'ok';
}

/** Fraction of barrel life consumed, clamped to [0, 1] for progress bars. */
export function barrelLifePct(rounds: number, life?: number | null): number {
  if (!life || life <= 0) return 0;
  return Math.max(0, Math.min(1, rounds / life));
}

export type HitRateBand = 'high' | 'mid' | 'low';

/** Hit-rate badge band: high `≥80%`, mid `≥50%`, low `<50%`. Null when no shots. */
export function hitRateBand(hits: number, misses: number): HitRateBand | null {
  const total = hits + misses;
  if (total <= 0) return null;
  const rate = hits / total;
  if (rate >= 0.8) return 'high';
  if (rate >= 0.5) return 'mid';
  return 'low';
}

/** Hit rate as a fraction in [0, 1]; 0 when no shots were fired. */
export function hitRate(hits: number, misses: number): number {
  const total = hits + misses;
  return total <= 0 ? 0 : hits / total;
}

/** Rounds a session contributes to its barrel's count. */
export function roundsFired(hits: number, misses: number): number {
  return (hits || 0) + (misses || 0);
}
