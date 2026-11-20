import { describe, it, expect } from 'vitest'
import { summarizeTrust, rowConfidence } from './trust'
import type { PredictedCard, PredictedRow } from './dopePredict'

function row(distance: number, elevation: number, confirmed?: number): PredictedRow {
  return {
    distance,
    elevation,
    windage: 0,
    velocityFps: 2000,
    supersonic: true,
    confirmedElevation: confirmed,
    elevationDelta: confirmed != null ? confirmed - elevation : undefined,
    confirmedSamples: confirmed != null ? 1 : undefined,
    lastDate: confirmed != null ? '2026-11-01' : undefined,
  }
}

function card(rows: PredictedRow[]): PredictedCard {
  return { rows, outputUnit: 'MIL', referenceWindMph: 10 }
}

describe('trust', () => {
  it('reports no confirmed data cleanly', () => {
    const t = summarizeTrust(card([row(100, 0.5), row(600, 3.2)]))
    expect(t.confirmedCount).toBe(0)
    expect(t.rmsResidual).toBeUndefined()
    expect(t.unit).toBe('MIL')
  })

  it('computes RMS residual, bias, and the confirmed envelope', () => {
    // confirmed deltas: +0.1 at 300, -0.1 at 900 → bias 0, rms 0.1.
    const t = summarizeTrust(
      card([row(100, 0.5), row(300, 1.5, 1.6), row(600, 3.0), row(900, 5.0, 4.9)]),
    )
    expect(t.confirmedCount).toBe(2)
    expect(t.minConfirmedYd).toBe(300)
    expect(t.maxConfirmedYd).toBe(900)
    expect(t.bias).toBeCloseTo(0, 6)
    expect(t.rmsResidual).toBeCloseTo(0.1, 6)
    expect(t.maxAbsResidual).toBeCloseTo(0.1, 6)
  })

  it('classifies rows by the confirmed envelope', () => {
    const c = card([row(100, 0.5), row(300, 1.5, 1.6), row(600, 3.0), row(900, 5.0, 4.9), row(1200, 7.5)])
    const t = summarizeTrust(c)
    expect(rowConfidence(c.rows[1], t)).toBe('confirmed') // 300, has hold
    expect(rowConfidence(c.rows[2], t)).toBe('interpolated') // 600, within 300–900
    expect(rowConfidence(c.rows[0], t)).toBe('extrapolated') // 100, below min
    expect(rowConfidence(c.rows[4], t)).toBe('extrapolated') // 1200, above max
  })

  it('treats everything as extrapolated with no confirmed holds', () => {
    const c = card([row(100, 0.5), row(600, 3.2)])
    const t = summarizeTrust(c)
    expect(rowConfidence(c.rows[0], t)).toBe('extrapolated')
    expect(rowConfidence(c.rows[1], t)).toBe('extrapolated')
  })
})
