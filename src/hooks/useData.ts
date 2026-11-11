/**
 * Reactive data hooks over Dexie (via dexie-react-hooks). Every list/detail
 * screen reads through these, so a local write — or a row that arrives from a
 * background sync — re-renders the UI automatically.
 */

import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/schema'
import type { Rifle, Barrel, Ammunition, Session, SessionPhoto } from '../domain/types'

export function useRifles(): Rifle[] | undefined {
  return useLiveQuery(() => db.rifles.orderBy('updatedAt').reverse().toArray())
}

export function useRifle(id: string | undefined): Rifle | undefined {
  return useLiveQuery(() => (id ? db.rifles.get(id) : undefined), [id])
}

/** All barrels, for grouping per rifle on the list screen. */
export function useAllBarrels(): Barrel[] | undefined {
  return useLiveQuery(() => db.barrels.toArray())
}

export function useBarrels(rifleId: string | undefined): Barrel[] | undefined {
  return useLiveQuery(
    () => (rifleId ? db.barrels.where('rifleId').equals(rifleId).toArray() : []),
    [rifleId],
  )
}

export function useAmmunition(rifleId: string | undefined): Ammunition[] | undefined {
  return useLiveQuery(
    () => (rifleId ? db.ammunition.where('rifleId').equals(rifleId).toArray() : []),
    [rifleId],
  )
}

export function useSessions(): Session[] | undefined {
  return useLiveQuery(async () => {
    const all = await db.sessions.toArray()
    return all.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
  })
}

export function useSessionsForRifle(rifleId: string | undefined): Session[] | undefined {
  return useLiveQuery(async () => {
    if (!rifleId) return []
    const all = await db.sessions.where('rifleId').equals(rifleId).toArray()
    return all.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
  }, [rifleId])
}

export function useSession(id: string | undefined): Session | undefined {
  return useLiveQuery(() => (id ? db.sessions.get(id) : undefined), [id])
}

export function useSessionPhotos(sessionId: string | undefined): SessionPhoto[] | undefined {
  return useLiveQuery(
    () => (sessionId ? db.sessionPhotos.where('sessionId').equals(sessionId).toArray() : []),
    [sessionId],
  )
}
