import { describe, it, expect } from 'vitest'
import { groupStats, moaToInches, zeroCorrection } from './group'
import type { Impact } from './types'

describe('group', () => {
  it('returns null with no impacts', () => {
    expect(groupStats([], 10)).toBeNull()
    expect(groupStats(undefined, 10)).toBeNull()
  })

  it('computes a centered single-hole group as zero spread', () => {
    const s = groupStats([{ x: 0, y: 0, hit: true }], 10)!
    expect(s.shots).toBe(1)
    expect(s.hits).toBe(1)
    expect(s.extremeSpreadMoa).toBe(0)
    expect(s.centerOffsetMoa).toBe(0)
  })

  it('scales coordinates by targetSpanMoa (half-span)', () => {
    // Two shots at the left and right edges of a 10-MOA diagram = 10 MOA apart.
    const impacts: Impact[] = [
      { x: -1, y: 0, hit: true },
      { x: 1, y: 0, hit: true },
    ]
    const s = groupStats(impacts, 10)!
    expect(s.extremeSpreadMoa).toBeCloseTo(10, 6)
    // Centroid on the x-axis is 0 → no vertical/horizontal offset.
    expect(s.centerOffsetMoa).toBeCloseTo(0, 6)
    expect(s.meanRadiusMoa).toBeCloseTo(5, 6)
  })

  it('reports the group center offset (zero error) and inch conversion', () => {
    // All shots 0.5 of half-span high on a 10-MOA diagram → +2.5 MOA up.
    const impacts: Impact[] = [
      { x: 0, y: 0.5, hit: true },
      { x: 0, y: 0.5, hit: true },
    ]
    const s = groupStats(impacts, 10, 100)!
    expect(s.centerYMoa).toBeCloseTo(2.5, 6)
    expect(s.centerOffsetMoa).toBeCloseTo(2.5, 6)
    // At 100 yd, 2.5 MOA ≈ 2.6175 in.
    expect(s.centerOffsetIn).toBeCloseTo(2.5 * 1.047, 4)
    // zero correction says to come DOWN 2.5 MOA.
    const z = zeroCorrection(s)!
    expect(z.up).toBeCloseTo(-2.5, 6)
    expect(z.left).toBeCloseTo(0, 6)
  })

  it('moaToInches follows 1.047 in / MOA / 100 yd', () => {
    expect(moaToInches(1, 100)).toBeCloseTo(1.047, 6)
    expect(moaToInches(2, 600)).toBeCloseTo(2 * 1.047 * 6, 6)
  })

  it('counts hits and misses', () => {
    const s = groupStats(
      [
        { x: 0, y: 0, hit: true },
        { x: 0.2, y: 0.1, hit: false },
        { x: -0.1, y: 0.1, hit: true },
      ],
      10,
    )!
    expect(s.hits).toBe(2)
    expect(s.misses).toBe(1)
    expect(s.shots).toBe(3)
  })
})
