import { describe, it, expect } from 'vitest'
import { barrelHealth, barrelLifePct, hitRateBand, hitRate, roundsFired } from './metrics'

describe('barrelHealth', () => {
  it('bands wear by percent of life (ok<75, warn 75-90, danger 90-99, replace>=100)', () => {
    expect(barrelHealth(0, 1000)).toBe('ok')
    expect(barrelHealth(740, 1000)).toBe('ok')
    expect(barrelHealth(750, 1000)).toBe('warn')
    expect(barrelHealth(899, 1000)).toBe('warn')
    expect(barrelHealth(900, 1000)).toBe('danger')
    expect(barrelHealth(999, 1000)).toBe('danger')
    expect(barrelHealth(1000, 1000)).toBe('replace')
    expect(barrelHealth(1500, 1000)).toBe('replace')
  })
  it('is ok when no life target is set', () => {
    expect(barrelHealth(5000)).toBe('ok')
    expect(barrelHealth(5000, 0)).toBe('ok')
    expect(barrelHealth(5000, null)).toBe('ok')
  })
})

describe('barrelLifePct', () => {
  it('clamps to [0,1]', () => {
    expect(barrelLifePct(500, 1000)).toBeCloseTo(0.5)
    expect(barrelLifePct(2000, 1000)).toBe(1)
    expect(barrelLifePct(500)).toBe(0)
  })
})

describe('hitRateBand', () => {
  it('bands by rate (high>=80, mid>=50, low<50), null with no shots', () => {
    expect(hitRateBand(0, 0)).toBeNull()
    expect(hitRateBand(8, 2)).toBe('high')
    expect(hitRateBand(5, 5)).toBe('mid')
    expect(hitRateBand(4, 6)).toBe('low')
  })
})

describe('hitRate & roundsFired', () => {
  it('computes the fraction and total', () => {
    expect(hitRate(9, 1)).toBeCloseTo(0.9)
    expect(hitRate(0, 0)).toBe(0)
    expect(roundsFired(9, 1)).toBe(10)
  })
})
