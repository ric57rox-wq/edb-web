import { describe, it, expect } from 'vitest'
import { buildDopeCard } from './dope'
import type { Session } from './types'

function s(partial: Partial<Session>): Session {
  return {
    id: Math.random().toString(36).slice(2),
    rifleId: 'r1',
    hits: 0,
    misses: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...partial,
  }
}

describe('buildDopeCard', () => {
  it('uses the most recent dope per distance, sorted ascending', () => {
    const card = buildDopeCard([
      s({ distance: 100, dopeElevation: '1.0 MIL', date: '2026-01-01' }),
      s({ distance: 600, dopeElevation: '4.0 MIL', date: '2026-02-01' }),
      s({ distance: 100, dopeElevation: '1.2 MIL', date: '2026-03-01' }), // newer @100
    ])
    expect(card.map((e) => e.distance)).toEqual([100, 600])
    expect(card[0].elevation).toBe('1.2 MIL') // most recent at 100
    expect(card[0].samples).toBe(2)
    expect(card[0].lastDate).toBe('2026-03-01')
    expect(card[1].elevation).toBe('4.0 MIL')
  })

  it('ignores sessions with no distance or no dope', () => {
    const card = buildDopeCard([
      s({ distance: 300, dopeWindage: '0.3 L', date: '2026-01-01' }),
      s({ distance: undefined, dopeElevation: '2.0', date: '2026-01-02' }),
      s({ distance: 400, date: '2026-01-03' }), // no dope
    ])
    expect(card).toHaveLength(1)
    expect(card[0].distance).toBe(300)
    expect(card[0].windage).toBe('0.3 L')
  })

  it('returns an empty card when nothing qualifies', () => {
    expect(buildDopeCard([s({ hits: 5, misses: 0 })])).toEqual([])
  })
})
