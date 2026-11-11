/** Small formatting + aggregate helpers shared across screens. */

import type { Barrel } from '../domain/types'
import { barrelHealth, type BarrelHealth } from '../domain/metrics'

/** Today's local date as 'YYYY-MM-DD' (default for new session date fields). */
export function today(): string {
  const d = new Date()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

/** 'YYYY-MM-DD' -> a compact human label like 'Nov 11, 2026'. */
export function formatDate(iso?: string): string {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${months[m - 1]} ${d}, ${y}`
}

/** Total rounds across a rifle's barrels. */
export function totalRounds(barrels: Barrel[]): number {
  return barrels.reduce((sum, b) => sum + (b.rounds ?? 0), 0)
}

const HEALTH_RANK: Record<BarrelHealth, number> = { ok: 0, warn: 1, danger: 2, replace: 3 }

/** The worst health across a rifle's barrels (for the rifle-card badge), or null. */
export function worstBarrelHealth(barrels: Barrel[]): BarrelHealth | null {
  let worst: BarrelHealth | null = null
  for (const b of barrels) {
    const h = barrelHealth(b.rounds ?? 0, b.life)
    if (worst == null || HEALTH_RANK[h] > HEALTH_RANK[worst]) worst = h
  }
  return worst
}

/** Coerce a form string to a number or undefined (empty -> undefined). */
export function numOrUndef(s: string): number | undefined {
  const t = s.trim()
  if (t === '') return undefined
  const n = Number(t)
  return Number.isFinite(n) ? n : undefined
}
