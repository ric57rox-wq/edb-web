/**
 * Predicted-DOPE assembly. Bridges the pure ballistic solver (ballistics.ts)
 * and the app's entities: given a rifle, a load and the logged sessions, it
 * builds a come-up table that is *computed* (so it extends to distances never
 * shot) and overlays the shooter's confirmed holds with a predicted-vs-actual
 * delta. Also prepares the inputs for muzzle-velocity true-up.
 *
 * Pure — no Dexie/React — so it unit-tests cleanly and the screen just renders.
 */

import type { Rifle, Ammunition, Session, AngularUnit } from './types'
import {
  solve,
  trueMuzzleVelocity,
  type SolveInput,
  type Atmosphere,
  type ConfirmedHold,
} from './ballistics'

const MIL_PER_RAD = 1000
const MOA_PER_RAD = (180 / Math.PI) * 60
const MIL_TO_MOA = MOA_PER_RAD / MIL_PER_RAD // ≈ 3.4377

/** Convert an angular value between MIL and MOA. */
export function convertAngle(value: number, from: AngularUnit, to: AngularUnit): number {
  if (from === to) return value
  return to === 'MOA' ? value * MIL_TO_MOA : value / MIL_TO_MOA
}

/** A load has enough data to run the solver when it has a BC and a muzzle velocity. */
export function canSolve(load?: Ammunition): boolean {
  return !!load && load.bc != null && load.bc > 0 && load.muzzleVelocity != null && load.muzzleVelocity > 0
}

/** Assemble solver inputs from a rifle + load (+ optional conditions/wind). */
export function solverInputsFor(
  rifle: Rifle,
  load: Ammunition,
  outputUnit: AngularUnit,
  atmosphere?: Atmosphere,
  windMph?: number,
  twistDir?: 'R' | 'L',
): SolveInput {
  return {
    muzzleVelocityFps: load.muzzleVelocity!,
    bc: load.bc!,
    bcModel: load.bcModel ?? 'G7',
    bulletWeightGr: load.bulletWeight,
    sightHeightIn: rifle.sightHeight ?? 1.5,
    zeroRangeYd: rifle.zeroRange ?? 100,
    outputUnit,
    atmosphere,
    wind: windMph != null ? { speedMph: windMph, angleDeg: 90 } : undefined,
    twistDir,
  }
}

export interface ConfirmedEntry {
  distance: number
  elevation?: number // in output unit
  windage?: number
  samples: number
  lastDate?: string
}

/**
 * Collapse sessions to one confirmed elevation/windage per distance, using the
 * most recent structured hold at each distance (converted to the output unit).
 */
export function buildConfirmed(sessions: Session[], outputUnit: AngularUnit): Map<number, ConfirmedEntry> {
  const byDist = new Map<number, Session[]>()
  for (const s of sessions) {
    if (s.distance == null) continue
    if (s.elevationValue == null && s.windageValue == null) continue
    const list = byDist.get(s.distance) ?? []
    list.push(s)
    byDist.set(s.distance, list)
  }
  const out = new Map<number, ConfirmedEntry>()
  for (const [distance, list] of byDist) {
    const latest = [...list].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))[0]
    out.set(distance, {
      distance,
      elevation:
        latest.elevationValue != null
          ? convertAngle(latest.elevationValue, latest.elevationUnit ?? outputUnit, outputUnit)
          : undefined,
      windage:
        latest.windageValue != null
          ? convertAngle(latest.windageValue, latest.windageUnit ?? outputUnit, outputUnit)
          : undefined,
      samples: list.length,
      lastDate: latest.date,
    })
  }
  return out
}

export interface PredictedRow {
  distance: number
  elevation: number // predicted, output unit
  windage: number // predicted at the reference wind, output unit
  velocityFps: number
  supersonic: boolean
  confirmedElevation?: number
  /** confirmed − predicted elevation (output unit), when a confirmed hold exists. */
  elevationDelta?: number
  confirmedSamples?: number
  lastDate?: string
}

export interface PredictedCard {
  rows: PredictedRow[]
  outputUnit: AngularUnit
  referenceWindMph: number
  /** Nearest range (yd) where the bullet goes transonic (Mach < ~1.2), if within range. */
  transonicYd?: number
}

/** The default printed distances (yards) if we have nothing else to anchor to. */
function defaultDistances(maxConfirmed: number, zeroRange: number): number[] {
  const max = Math.min(1500, Math.max(1000, Math.ceil((maxConfirmed || 0) / 100) * 100))
  const set = new Set<number>()
  for (let d = 100; d <= max; d += 100) set.add(d)
  if (zeroRange) set.add(zeroRange)
  return [...set].sort((a, b) => a - b)
}

/**
 * Build the full predicted card: solver come-ups at standard steps ∪ confirmed
 * distances, each row carrying the confirmed hold and the delta when logged.
 */
export function buildPredictedCard(args: {
  rifle: Rifle
  load: Ammunition
  sessions: Session[]
  outputUnit: AngularUnit
  atmosphere?: Atmosphere
  referenceWindMph?: number
  twistDir?: 'R' | 'L'
}): PredictedCard {
  const { rifle, load, sessions, outputUnit, atmosphere, twistDir } = args
  const referenceWindMph = args.referenceWindMph ?? 10
  const confirmed = buildConfirmed(sessions, outputUnit)
  const maxConfirmed = confirmed.size ? Math.max(...confirmed.keys()) : 0

  const distances = new Set<number>(defaultDistances(maxConfirmed, rifle.zeroRange ?? 100))
  for (const d of confirmed.keys()) distances.add(d)
  const ranges = [...distances].sort((a, b) => a - b)

  const input = solverInputsFor(rifle, load, outputUnit, atmosphere, referenceWindMph, twistDir)
  const solved = solve(input, ranges)

  let transonicYd: number | undefined
  const rows: PredictedRow[] = solved.map((p) => {
    if (transonicYd == null && p.mach < 1.2) transonicYd = p.rangeYd
    const c = confirmed.get(p.rangeYd)
    return {
      distance: p.rangeYd,
      elevation: p.elevation,
      // Reference wind is a fixed full-value crosswind, so show the hold magnitude.
      windage: Math.abs(p.windage),
      velocityFps: p.velocityFps,
      supersonic: p.supersonic,
      confirmedElevation: c?.elevation,
      elevationDelta: c?.elevation != null ? c.elevation - p.elevation : undefined,
      confirmedSamples: c?.samples,
      lastDate: c?.lastDate,
    }
  })

  return { rows, outputUnit, referenceWindMph, transonicYd }
}

export interface TrueUpResult {
  muzzleVelocityFps: number
  previousFps: number
  rmsError: number
  unit: AngularUnit
  pointsUsed: number
}

/**
 * Attempt a muzzle-velocity true-up from the confirmed elevation holds.
 * Returns null if fewer than two distances have a confirmed elevation.
 */
export function trueUpFromSessions(args: {
  rifle: Rifle
  load: Ammunition
  sessions: Session[]
  outputUnit: AngularUnit
  atmosphere?: Atmosphere
  twistDir?: 'R' | 'L'
}): TrueUpResult | null {
  const { rifle, load, sessions, outputUnit, atmosphere, twistDir } = args
  const confirmed = buildConfirmed(sessions, outputUnit)
  const holds: ConfirmedHold[] = []
  for (const c of confirmed.values()) {
    if (c.elevation != null) holds.push({ rangeYd: c.distance, elevation: c.elevation, unit: outputUnit })
  }
  if (holds.length < 2) return null
  const input = solverInputsFor(rifle, load, outputUnit, atmosphere, undefined, twistDir)
  const res = trueMuzzleVelocity(input, holds)
  if (!res) return null
  return {
    muzzleVelocityFps: res.muzzleVelocityFps,
    previousFps: load.muzzleVelocity!,
    rmsError: res.rmsError,
    unit: outputUnit,
    pointsUsed: holds.length,
  }
}
