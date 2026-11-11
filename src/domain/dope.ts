/**
 * DOPE-card derivation. For a set of sessions (already filtered to one rifle and
 * load), collapse to one row per distance using the MOST-RECENTLY-LOGGED
 * elevation/windage at that distance, with how many sessions confirm it and the
 * last date it was shot. Pure — easy to unit-test and reuse for the share text.
 */

import type { Session } from './types'

export interface DopeEntry {
  distance: number
  elevation?: string
  windage?: string
  samples: number
  lastDate?: string
}

export function buildDopeCard(sessions: Session[]): DopeEntry[] {
  const byDistance = new Map<number, Session[]>()
  for (const s of sessions) {
    if (s.distance == null) continue
    if (!s.dopeElevation && !s.dopeWindage) continue
    const list = byDistance.get(s.distance) ?? []
    list.push(s)
    byDistance.set(s.distance, list)
  }

  const entries: DopeEntry[] = []
  for (const [distance, list] of byDistance) {
    const latest = [...list].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))[0]
    entries.push({
      distance,
      elevation: latest.dopeElevation,
      windage: latest.dopeWindage,
      samples: list.length,
      lastDate: latest.date,
    })
  }
  return entries.sort((a, b) => a.distance - b.distance)
}
