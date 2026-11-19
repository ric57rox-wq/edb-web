import { describe, it, expect } from 'vitest'
import {
  convertAngle,
  canSolve,
  buildConfirmed,
  buildPredictedCard,
  trueUpFromSessions,
} from './dopePredict'
import type { Rifle, Ammunition, Session } from './types'

const sync = { createdAt: new Date(), updatedAt: new Date(), deletedAt: null }

const rifle: Rifle = { ...sync, id: 'r1', name: 'Test', sightHeight: 1.5, zeroRange: 100, zeroUnit: 'MIL' }
const load: Ammunition = {
  ...sync,
  id: 'l1',
  rifleId: 'r1',
  label: '140 ELD-M',
  bulletWeight: 140,
  bc: 0.31,
  bcModel: 'G7',
  muzzleVelocity: 2710,
}

function session(partial: Partial<Session>): Session {
  return { ...sync, id: Math.random().toString(36), rifleId: 'r1', hits: 0, misses: 0, ...partial }
}

describe('convertAngle', () => {
  it('MIL<->MOA round trips', () => {
    expect(convertAngle(1, 'MIL', 'MOA')).toBeCloseTo(3.4377, 2)
    expect(convertAngle(3.4377, 'MOA', 'MIL')).toBeCloseTo(1, 2)
    expect(convertAngle(5, 'MIL', 'MIL')).toBe(5)
  })
})

describe('canSolve', () => {
  it('needs BC and muzzle velocity', () => {
    expect(canSolve(load)).toBe(true)
    expect(canSolve({ ...load, bc: undefined })).toBe(false)
    expect(canSolve({ ...load, muzzleVelocity: undefined })).toBe(false)
    expect(canSolve(undefined)).toBe(false)
  })
})

describe('buildConfirmed', () => {
  it('keeps the most recent structured hold per distance, converting units', () => {
    const sessions = [
      session({ distance: 500, elevationValue: 3.0, elevationUnit: 'MIL', date: '2026-01-01' }),
      session({ distance: 500, elevationValue: 3.1, elevationUnit: 'MIL', date: '2026-02-01' }),
      session({ distance: 800, elevationValue: 20, elevationUnit: 'MOA', date: '2026-02-01' }),
    ]
    const c = buildConfirmed(sessions, 'MIL')
    expect(c.get(500)!.elevation).toBeCloseTo(3.1, 3)
    expect(c.get(500)!.samples).toBe(2)
    // 20 MOA -> MIL
    expect(c.get(800)!.elevation).toBeCloseTo(convertAngle(20, 'MOA', 'MIL'), 3)
  })
})

describe('buildPredictedCard', () => {
  const sessions = [
    session({ distance: 500, elevationValue: 3.1, elevationUnit: 'MIL', date: '2026-02-01', ammunitionId: 'l1' }),
  ]
  const card = buildPredictedCard({ rifle, load, sessions, outputUnit: 'MIL' })

  it('extends to standard distances beyond what was shot', () => {
    expect(card.rows.some((r) => r.distance === 1000)).toBe(true)
    expect(card.rows.find((r) => r.distance === 1000)!.elevation).toBeGreaterThan(5)
  })

  it('overlays confirmed holds with a delta', () => {
    const row = card.rows.find((r) => r.distance === 500)!
    expect(row.confirmedElevation).toBeCloseTo(3.1, 3)
    expect(row.elevationDelta).toBeCloseTo(3.1 - row.elevation, 3)
    expect(row.confirmedSamples).toBe(1)
  })

  it('reports a reference wind column', () => {
    const row = card.rows.find((r) => r.distance === 1000)!
    expect(row.windage).toBeGreaterThan(0)
  })
})

describe('trueUpFromSessions', () => {
  it('finds the MV that fits confirmed holds (and null with < 2)', () => {
    // Generate confirmed holds from a different "true" MV via the card itself.
    const trueLoad = { ...load, muzzleVelocity: 2640 }
    const gen = buildPredictedCard({ rifle, load: trueLoad, sessions: [], outputUnit: 'MIL' })
    const pick = [400, 700, 1000].map((d) => gen.rows.find((r) => r.distance === d)!)
    const sessions = pick.map((r) =>
      session({ distance: r.distance, elevationValue: r.elevation, elevationUnit: 'MIL' }),
    )
    const res = trueUpFromSessions({ rifle, load, sessions, outputUnit: 'MIL' })
    expect(res).not.toBeNull()
    expect(res!.muzzleVelocityFps).toBeGreaterThan(2615)
    expect(res!.muzzleVelocityFps).toBeLessThan(2665)

    const one = trueUpFromSessions({ rifle, load, sessions: sessions.slice(0, 1), outputUnit: 'MIL' })
    expect(one).toBeNull()
  })
})
