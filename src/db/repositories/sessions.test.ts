/**
 * Barrel round-count integration. Saving a course of fire adds its shots to the
 * barrel; editing reverses the old contribution before applying the new; deleting
 * subtracts it back out. Uses the real singleton db, cleared between tests.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '../schema'
import { createRifle } from './rifles'
import { createBarrel, getBarrel } from './barrels'
import { createSession, updateSession, deleteSession } from './sessions'

beforeEach(async () => {
  await db.transaction('rw', db.tables, async () => {
    await Promise.all(db.tables.map((t) => t.clear()))
  })
})

async function setup() {
  const rifleId = await createRifle({ name: 'Test Rifle' })
  const barrelA = await createBarrel({ rifleId, label: 'A', rounds: 0 })
  const barrelB = await createBarrel({ rifleId, label: 'B', rounds: 0 })
  return { rifleId, barrelA, barrelB }
}

describe('session round-count integration', () => {
  it('adds hits+misses to the barrel on create', async () => {
    const { rifleId, barrelA } = await setup()
    await createSession({ rifleId, barrelId: barrelA, hits: 8, misses: 2 })
    expect((await getBarrel(barrelA))!.rounds).toBe(10)
  })

  it('reverses the old count and applies the new on edit (same barrel)', async () => {
    const { rifleId, barrelA } = await setup()
    const id = await createSession({ rifleId, barrelId: barrelA, hits: 8, misses: 2 })
    expect((await getBarrel(barrelA))!.rounds).toBe(10)

    await updateSession(id, { hits: 5, misses: 0 })
    expect((await getBarrel(barrelA))!.rounds).toBe(5)
  })

  it('moves the count when the session changes barrels', async () => {
    const { rifleId, barrelA, barrelB } = await setup()
    const id = await createSession({ rifleId, barrelId: barrelA, hits: 6, misses: 4 })
    expect((await getBarrel(barrelA))!.rounds).toBe(10)

    await updateSession(id, { barrelId: barrelB })
    expect((await getBarrel(barrelA))!.rounds).toBe(0)
    expect((await getBarrel(barrelB))!.rounds).toBe(10)
  })

  it('subtracts the count on delete', async () => {
    const { rifleId, barrelA } = await setup()
    await createSession({ rifleId, barrelId: barrelA, hits: 3, misses: 0 })
    const id = await createSession({ rifleId, barrelId: barrelA, hits: 7, misses: 0 })
    expect((await getBarrel(barrelA))!.rounds).toBe(10)

    await deleteSession(id)
    expect((await getBarrel(barrelA))!.rounds).toBe(3)
  })

  it('never drives a barrel count negative', async () => {
    const { rifleId, barrelA } = await setup()
    const id = await createSession({ rifleId, barrelId: barrelA, hits: 2, misses: 0 })
    // Corrupt-ish correction: edit to a larger count than exists shouldn't underflow.
    await updateSession(id, { hits: 100, misses: 0 })
    await deleteSession(id)
    expect((await getBarrel(barrelA))!.rounds).toBe(0)
  })
})
