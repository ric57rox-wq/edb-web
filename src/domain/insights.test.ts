import { describe, it, expect } from 'vitest'
import { buildInsights } from './insights'
import type { Session } from './types'

function s(partial: Partial<Session>): Session {
  return {
    id: crypto.randomUUID(),
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    rifleId: 'r1',
    hits: 0,
    misses: 0,
    ...partial,
  }
}

describe('insights', () => {
  it('buckets hit rate by temperature band', () => {
    const ins = buildInsights([
      s({ weatherTemp: 30, hits: 2, misses: 8 }), // <40 → 20%
      s({ weatherTemp: 70, hits: 9, misses: 1 }), // 60-79 → 90%
      s({ weatherTemp: 72, hits: 8, misses: 2 }), // 60-79
    ])
    const cold = ins.temp.find((b) => b.label === '< 40°F')!
    const mild = ins.temp.find((b) => b.label === '60–79°F')!
    expect(cold.hitRate).toBeCloseTo(0.2, 6)
    expect(mild.hits).toBe(17)
    expect(mild.misses).toBe(3)
    expect(mild.hitRate).toBeCloseTo(0.85, 6)
    expect(ins.hasTemp).toBe(true)
  })

  it('ignores sessions with no rounds or no temperature', () => {
    const ins = buildInsights([s({ hits: 0, misses: 0, weatherTemp: 50 }), s({ hits: 5, misses: 0 })])
    expect(ins.temp.every((b) => b.sessions === 0)).toBe(true)
    expect(ins.hasTemp).toBe(false)
  })

  it('computes DA bands only when temp and pressure are present', () => {
    const ins = buildInsights([
      s({ weatherTemp: 59, pressure: 29.92, humidity: 0, hits: 5, misses: 5 }), // ~sea level
      s({ weatherTemp: 90, pressure: 24.5, humidity: 50, hits: 7, misses: 3 }), // high DA
    ])
    const totalDa = ins.da.reduce((n, b) => n + b.sessions, 0)
    expect(totalDa).toBe(2)
  })
})
