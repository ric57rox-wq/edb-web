/**
 * Group & zero statistics from a session's points of impact. Pure (no I/O), so
 * it is trivially unit-testable and reused by the session detail plot.
 *
 * Impacts are stored as fractions of the diagram HALF-span (x,y in [-1,1]); the
 * session's `targetSpanMoa` is the diagram's FULL width in MOA, so a coordinate
 * of magnitude 1 is `targetSpanMoa / 2` MOA from center. MOA converts to inches
 * at a distance with the standard 1.047 in / MOA / 100 yd.
 */

import type { Impact } from './types'

const INCHES_PER_MOA_PER_100YD = 1.047

export interface GroupStats {
  /** Number of impacts recorded. */
  shots: number
  hits: number
  misses: number
  /** Group center (centroid) offset from aim, MOA. x right+, y up+. */
  centerXMoa: number
  centerYMoa: number
  /** Radial distance of the group center from aim, MOA (the zero correction). */
  centerOffsetMoa: number
  /** Extreme spread — largest center-to-center distance between two shots, MOA. */
  extremeSpreadMoa: number
  /** Mean radius — average distance of shots from the group centroid, MOA. */
  meanRadiusMoa: number
  /** Same metrics in inches at `distanceYd`, when a distance is provided. */
  distanceYd?: number
  centerOffsetIn?: number
  extremeSpreadIn?: number
  meanRadiusIn?: number
}

/** MOA → inches at a distance (yards). */
export function moaToInches(moa: number, distanceYd: number): number {
  return moa * INCHES_PER_MOA_PER_100YD * (distanceYd / 100)
}

/**
 * Compute group / zero statistics. Returns null when there are no impacts.
 * `targetSpanMoa` defaults to 10 (a 10-MOA-wide diagram) and `distanceYd` is
 * optional (adds the inch conversions when present).
 */
export function groupStats(
  impacts: Impact[] | undefined,
  targetSpanMoa = 10,
  distanceYd?: number,
): GroupStats | null {
  if (!impacts || impacts.length === 0) return null
  const half = (targetSpanMoa || 10) / 2

  // Each impact in MOA from aim.
  const pts = impacts.map((i) => ({ x: i.x * half, y: i.y * half }))
  const n = pts.length
  const hits = impacts.filter((i) => i.hit).length

  const cx = pts.reduce((s, p) => s + p.x, 0) / n
  const cy = pts.reduce((s, p) => s + p.y, 0) / n
  const centerOffsetMoa = Math.hypot(cx, cy)

  // Extreme spread: max pairwise center-to-center distance.
  let extreme = 0
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const d = Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y)
      if (d > extreme) extreme = d
    }
  }

  // Mean radius from the centroid.
  const meanRadius = pts.reduce((s, p) => s + Math.hypot(p.x - cx, p.y - cy), 0) / n

  const out: GroupStats = {
    shots: n,
    hits,
    misses: n - hits,
    centerXMoa: cx,
    centerYMoa: cy,
    centerOffsetMoa,
    extremeSpreadMoa: extreme,
    meanRadiusMoa: meanRadius,
  }
  if (distanceYd != null && distanceYd > 0) {
    out.distanceYd = distanceYd
    out.centerOffsetIn = moaToInches(centerOffsetMoa, distanceYd)
    out.extremeSpreadIn = moaToInches(extreme, distanceYd)
    out.meanRadiusIn = moaToInches(meanRadius, distanceYd)
  }
  return out
}

/**
 * A plain-language zero correction from the group center: how far, and which way,
 * to move the point of impact TO center the group on aim (opposite the offset).
 * Returns null when the group is already effectively centered.
 */
export function zeroCorrection(stats: GroupStats, minMoa = 0.1): { up: number; left: number } | null {
  if (stats.centerOffsetMoa < minMoa) return null
  // To center, move impact opposite the current offset.
  return { up: -stats.centerYMoa, left: -stats.centerXMoa }
}
