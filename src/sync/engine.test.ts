/**
 * Sync engine convergence. Two EdbDB instances (distinct names ⇒ isolated
 * localStorage cursors/tombstones) share one in-memory fake remote, standing in
 * for two devices. Verifies: cross-device create (parent + child with uuid FK),
 * last-write-wins edits, delete propagation without resurrection, and idempotent
 * (duplicate-free) re-syncs.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { EdbDB } from '../db/schema'
import { newUuid } from '../db/syncStamp'
import { syncOnce } from './engine'
import type { RemoteRow, RemoteGateway } from './types'

/** In-memory remote shared by both devices. */
function makeFakeRemote(): RemoteGateway {
  const tables = new Map<string, Map<string, RemoteRow>>()
  const t = (name: string) => {
    if (!tables.has(name)) tables.set(name, new Map())
    return tables.get(name)!
  }
  return {
    async pullSince(table, since) {
      return [...t(table).values()]
        .filter((r) => String(r.updated_at) > since)
        .sort((a, b) => (String(a.updated_at) < String(b.updated_at) ? -1 : 1))
        .map((r) => ({ ...r }))
    },
    async upsert(table, rows) {
      for (const r of rows) t(table).set(r.id, { ...t(table).get(r.id), ...r })
    },
    async tombstone(table, ids, deletedAt) {
      for (const id of ids) {
        const cur = t(table).get(id)
        if (cur) t(table).set(id, { ...cur, deleted_at: deletedAt, updated_at: deletedAt })
      }
    },
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const uniqueName = () => `dev-${Math.random().toString(36).slice(2)}`

let remote: RemoteGateway
let A: EdbDB
let B: EdbDB

beforeEach(() => {
  localStorage.clear()
  remote = makeFakeRemote()
  A = new EdbDB(uniqueName())
  B = new EdbDB(uniqueName())
})

afterEach(async () => {
  await A.delete()
  await B.delete()
  A.close()
  B.close()
  localStorage.clear()
})

describe('cross-device sync', () => {
  it('propagates a create from A to B', async () => {
    const id = newUuid()
    const now = new Date()
    await A.rifles.add({
      id,
      name: 'Tikka T3x',
      caliber: '6.5 Creedmoor',
      rounds: 0,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    } as never)

    await syncOnce(A, remote)
    await syncOnce(B, remote)

    const onB = await B.rifles.toArray()
    expect(onB).toHaveLength(1)
    expect(onB[0].id).toBe(id)
    expect(onB[0].name).toBe('Tikka T3x')
    expect(onB[0].updatedAt instanceof Date).toBe(true)
  })

  it('carries a uuid foreign key across devices (rifle → session)', async () => {
    const now = new Date()
    const rifleId = newUuid()
    const barrelId = newUuid()
    const sessionId = newUuid()
    await A.rifles.add({ id: rifleId, name: 'AR-10', rounds: 0, createdAt: now, updatedAt: now, deletedAt: null } as never)
    await A.barrels.add({ id: barrelId, rifleId, label: '20in', rounds: 0, createdAt: now, updatedAt: now, deletedAt: null } as never)
    await A.sessions.add({
      id: sessionId,
      rifleId,
      barrelId,
      distance: 600,
      hits: 9,
      misses: 1,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    } as never)

    await syncOnce(A, remote)
    await syncOnce(B, remote)

    const sB = await B.sessions.get(sessionId)
    expect(sB).toBeTruthy()
    expect(sB!.rifleId).toBe(rifleId)
    expect(sB!.barrelId).toBe(barrelId)
    const rB = await B.rifles.get(sB!.rifleId)
    expect(rB!.name).toBe('AR-10')
    expect(sB!.distance).toBe(600)
  })

  it('resolves edits by last-write-wins', async () => {
    const id = newUuid()
    const now = new Date()
    await A.rifles.add({ id, name: 'Original', rounds: 0, createdAt: now, updatedAt: now, deletedAt: null } as never)

    await syncOnce(A, remote)
    await syncOnce(B, remote)

    await sleep(5)
    await B.rifles.update(id, { name: 'Edited on B' })
    await syncOnce(B, remote)
    await syncOnce(A, remote)

    const rA = await A.rifles.get(id)
    expect(rA!.name).toBe('Edited on B')
  })

  it('propagates deletes without resurrecting them', async () => {
    const id = newUuid()
    const now = new Date()
    await A.rifles.add({ id, name: 'Temp', rounds: 0, createdAt: now, updatedAt: now, deletedAt: null } as never)

    await syncOnce(A, remote)
    await syncOnce(B, remote)
    expect(await B.rifles.count()).toBe(1)

    await A.rifles.delete(id)
    await syncOnce(A, remote)
    await syncOnce(B, remote)
    expect(await B.rifles.count()).toBe(0)

    // A second round must not bring it back.
    await syncOnce(A, remote)
    await syncOnce(B, remote)
    expect(await B.rifles.count()).toBe(0)
    expect(await A.rifles.count()).toBe(0)
  })

  it('is idempotent — repeated syncs never duplicate', async () => {
    const id = newUuid()
    const now = new Date()
    await A.ammunition.add({ id, rifleId: newUuid(), label: '140 ELD-M', createdAt: now, updatedAt: now, deletedAt: null } as never)

    await syncOnce(A, remote)
    await syncOnce(A, remote)
    await syncOnce(B, remote)
    await syncOnce(B, remote)
    await syncOnce(A, remote)

    expect(await A.ammunition.count()).toBe(1)
    expect(await B.ammunition.count()).toBe(1)
  })
})
