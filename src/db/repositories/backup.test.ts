import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '../schema'
import { createRifle } from './rifles'
import { createBarrel } from './barrels'
import { createSession } from './sessions'
import { exportBackup, importBackup, dataCounts } from './backup'

beforeEach(async () => {
  await db.transaction('rw', db.tables, async () => {
    await Promise.all(db.tables.map((t) => t.clear()))
  })
})

describe('backup export/import', () => {
  it('round-trips data and rehydrates dates', async () => {
    const rifleId = await createRifle({ name: 'Backup Rifle', caliber: '.308' })
    const barrelId = await createBarrel({ rifleId, label: 'A', rounds: 0 })
    await createSession({ rifleId, barrelId, distance: 100, hits: 5, misses: 1, date: '2026-05-01' })

    const file = await exportBackup()
    expect(file.app).toBe('edb')
    expect(file.data.rifles).toHaveLength(1)
    // Serialized dates are strings in the file.
    expect(typeof file.data.rifles[0].updatedAt).toBe('string')

    // Wipe, then restore.
    await db.transaction('rw', db.tables, async () => {
      await Promise.all(db.tables.map((t) => t.clear()))
    })
    expect((await dataCounts()).rifles).toBe(0)

    const result = await importBackup(file)
    expect(result.imported).toBeGreaterThanOrEqual(3)

    const counts = await dataCounts()
    expect(counts.rifles).toBe(1)
    expect(counts.barrels).toBe(1)
    expect(counts.sessions).toBe(1)

    const rifle = await db.rifles.get(rifleId)
    expect(rifle!.name).toBe('Backup Rifle')
    expect(rifle!.updatedAt instanceof Date).toBe(true) // rehydrated
    const session = await db.sessions.get((await db.sessions.toArray())[0].id)
    expect(session!.date).toBe('2026-05-01') // calendar date preserved as string
  })

  it('rejects a non-EDB file', async () => {
    await expect(importBackup({ foo: 'bar' } as never)).rejects.toThrow()
  })
})
