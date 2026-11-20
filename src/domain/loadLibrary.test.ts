import { describe, it, expect } from 'vitest'
import { FACTORY_LOADS, factoryLoads, factoryLoadById, prefillFromFactory } from './loadLibrary'

describe('loadLibrary', () => {
  it('every entry has the fields the solver needs', () => {
    expect(FACTORY_LOADS.length).toBeGreaterThan(0)
    for (const l of FACTORY_LOADS) {
      expect(l.id).toBeTruthy()
      expect(l.name).toBeTruthy()
      expect(l.caliber).toBeTruthy()
      expect(l.bulletWeight).toBeGreaterThan(0)
      expect(l.bcG1).toBeGreaterThan(0)
      expect(l.muzzleVelocity).toBeGreaterThan(1000)
      if (l.bcG7 != null) expect(l.bcG7).toBeGreaterThan(0)
      // G7 is always lower than G1 for the same bullet.
      if (l.bcG7 != null) expect(l.bcG7).toBeLessThan(l.bcG1)
    }
  })

  it('ids are unique', () => {
    const ids = new Set(FACTORY_LOADS.map((l) => l.id))
    expect(ids.size).toBe(FACTORY_LOADS.length)
  })

  it('filters by caliber loosely (ignores spaces and dots)', () => {
    expect(factoryLoads('.308 Win').length).toBe(FACTORY_LOADS.length)
    expect(factoryLoads('308win').length).toBe(FACTORY_LOADS.length)
    expect(factoryLoads('6.5 Creedmoor').length).toBe(0)
    expect(factoryLoads().length).toBe(FACTORY_LOADS.length)
  })

  it('prefers G7 in the prefill when published, else falls back to G1', () => {
    const g7 = factoryLoadById('hdy-308-168-eldm')!
    const p7 = prefillFromFactory(g7)
    expect(p7.bcModel).toBe('G7')
    expect(p7.bc).toBe(g7.bcG7)
    expect(p7.muzzleVelocity).toBe(2700)
    expect(p7.label).toBe('168 gr ELD Match')

    const g1only = factoryLoadById('hdy-308-150-interlock')!
    const p1 = prefillFromFactory(g1only)
    expect(p1.bcModel).toBe('G1')
    expect(p1.bc).toBe(g1only.bcG1)
  })
})
