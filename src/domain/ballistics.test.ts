import { describe, it, expect } from 'vitest'
import {
  dragCd,
  speedOfSoundFps,
  densityRatio,
  densityAltitudeFt,
  solve,
  trueMuzzleVelocity,
  type SolveInput,
} from './ballistics'

describe('drag tables', () => {
  it('returns exact endpoints', () => {
    expect(dragCd('G7', 0)).toBeCloseTo(0.1198, 4)
    expect(dragCd('G1', 0)).toBeCloseTo(0.2629, 4)
  })
  it('interpolates between rows', () => {
    // Midway between Mach 2.40 (0.2752) and 2.45 (0.2725) on G7.
    expect(dragCd('G7', 2.425)).toBeCloseTo((0.2752 + 0.2725) / 2, 4)
  })
  it('clamps beyond the table', () => {
    expect(dragCd('G7', 99)).toBeCloseTo(0.1618, 4)
  })
})

describe('atmosphere', () => {
  it('speed of sound ~1116 fps at 59 F', () => {
    expect(speedOfSoundFps(59)).toBeGreaterThan(1114)
    expect(speedOfSoundFps(59)).toBeLessThan(1118)
  })
  it('density ratio is ~1.0 at ICAO standard', () => {
    expect(densityRatio({ tempF: 59, pressureInHg: 29.92, humidityPct: 0 })).toBeCloseTo(1, 2)
  })
  it('hot, humid, low-pressure air is thinner', () => {
    const dr = densityRatio({ tempF: 95, pressureInHg: 25, humidityPct: 80 })
    expect(dr).toBeLessThan(0.9)
  })
  it('density altitude ~0 at standard, large when thin', () => {
    expect(Math.abs(densityAltitudeFt({ tempF: 59, pressureInHg: 29.92, humidityPct: 0 }))).toBeLessThan(150)
    expect(densityAltitudeFt({ tempF: 95, pressureInHg: 25, humidityPct: 50 })).toBeGreaterThan(5000)
  })
})

// 6.5 Creedmoor 140 gr, G7 BC 0.310, MV 2710, 1.5" sight height, 100 yd zero.
const cm65: SolveInput = {
  muzzleVelocityFps: 2710,
  bc: 0.31,
  bcModel: 'G7',
  bulletWeightGr: 140,
  sightHeightIn: 1.5,
  zeroRangeYd: 100,
  outputUnit: 'MIL',
  atmosphere: { tempF: 59, pressureInHg: 29.92, humidityPct: 0 },
}

describe('solver — 6.5 Creedmoor reference', () => {
  const table = solve(cm65, [100, 200, 300, 500, 800, 1000])

  it('elevation is ~0 at the zero range', () => {
    const z = table.find((r) => r.rangeYd === 100)!
    expect(Math.abs(z.elevation)).toBeLessThan(0.1)
  })

  it('drop increases monotonically with range', () => {
    for (let i = 1; i < table.length; i++) {
      expect(table[i].elevation).toBeGreaterThan(table[i - 1].elevation)
    }
  })

  it('velocity decays monotonically and stays supersonic to 1000', () => {
    for (let i = 1; i < table.length; i++) {
      expect(table[i].velocityFps).toBeLessThan(table[i - 1].velocityFps)
    }
    const k = table.find((r) => r.rangeYd === 1000)!
    expect(k.velocityFps).toBeGreaterThan(1200)
    expect(k.supersonic).toBe(true)
  })

  it('1000 yd elevation + velocity match published 6.5 CM data', () => {
    const k = table.find((r) => r.rangeYd === 1000)!
    // Hornady 140 ELD-M @ 2710, 100 yd zero: ~9 mil come-up, ~1430 fps retained.
    expect(k.elevation).toBeGreaterThan(8.5)
    expect(k.elevation).toBeLessThan(9.6)
    expect(k.velocityFps).toBeGreaterThan(1380)
    expect(k.velocityFps).toBeLessThan(1480)
  })

  it('retains energy and reports it', () => {
    const m = table.find((r) => r.rangeYd === 100)!
    // 140 gr @ ~2600 fps ≈ 2100 ft-lb near the muzzle.
    expect(m.energyFtLb).toBeGreaterThan(1800)
  })
})

describe('MOA vs MIL consistency', () => {
  it('MOA output is ~3.438x the MIL output at the same range', () => {
    const mil = solve({ ...cm65, outputUnit: 'MIL' }, [800])[0].elevation
    const moa = solve({ ...cm65, outputUnit: 'MOA' }, [800])[0].elevation
    expect(moa / mil).toBeCloseTo(3.4377, 1)
  })
})

describe('wind', () => {
  it('a full-value crosswind pushes the bullet sideways; no wind = ~no drift', () => {
    const calm = solve(cm65, [1000])[0]
    const windy = solve({ ...cm65, wind: { speedMph: 10, angleDeg: 90 } }, [1000])[0]
    expect(Math.abs(calm.driftIn)).toBeLessThan(1)
    expect(Math.abs(windy.driftIn)).toBeGreaterThan(20)
  })
})

describe('true-up', () => {
  it('recovers a muzzle velocity from confirmed holds', () => {
    // Generate "confirmed" holds from a known MV, then see if true-up finds it.
    const trueMv = 2625
    const gen = solve({ ...cm65, muzzleVelocityFps: trueMv }, [400, 700, 1000])
    const confirmed = gen.map((r) => ({ rangeYd: r.rangeYd, elevation: r.elevation, unit: 'MIL' as const }))
    const result = trueMuzzleVelocity(cm65, confirmed)
    expect(result).not.toBeNull()
    expect(result!.muzzleVelocityFps).toBeGreaterThan(trueMv - 25)
    expect(result!.muzzleVelocityFps).toBeLessThan(trueMv + 25)
  })

  it('returns null with too few points', () => {
    expect(trueMuzzleVelocity(cm65, [{ rangeYd: 500, elevation: 2, unit: 'MIL' }])).toBeNull()
  })
})
