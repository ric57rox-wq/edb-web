/**
 * Rifle CRUD. Deletes are hard locally (and cascade to the rifle's barrels,
 * ammunition, and sessions) — each removed row logs its own tombstone via the
 * Dexie deleting hook, so every deletion propagates on the next push.
 */

import { db } from '../schema';
import { newUuid } from '../syncStamp';
import type { Rifle, NewRow } from '../../domain/types';

export function listRifles(): Promise<Rifle[]> {
  return db.rifles.orderBy('updatedAt').reverse().toArray();
}

export function getRifle(id: string): Promise<Rifle | undefined> {
  return db.rifles.get(id);
}

export async function createRifle(data: NewRow<Rifle>): Promise<string> {
  const id = newUuid();
  const now = new Date();
  await db.rifles.add({ ...data, id, createdAt: now, updatedAt: now, deletedAt: null });
  return id;
}

export async function updateRifle(id: string, changes: Partial<NewRow<Rifle>>): Promise<void> {
  await db.rifles.update(id, { ...changes, updatedAt: new Date() });
}

/** Hard-delete the rifle and everything that hangs off it (each logs a tombstone). */
export async function deleteRifle(id: string): Promise<void> {
  await db.transaction(
    'rw',
    [db.rifles, db.barrels, db.ammunition, db.sessions, db.sessionPhotos],
    async () => {
      const sessions = await db.sessions.where('rifleId').equals(id).toArray();
      for (const s of sessions) {
        const photos = await db.sessionPhotos.where('sessionId').equals(s.id).toArray();
        for (const p of photos) await db.sessionPhotos.delete(p.id);
        await db.sessions.delete(s.id);
      }
      for (const b of await db.barrels.where('rifleId').equals(id).toArray()) {
        await db.barrels.delete(b.id);
      }
      for (const a of await db.ammunition.where('rifleId').equals(id).toArray()) {
        await db.ammunition.delete(a.id);
      }
      await db.rifles.delete(id);
    },
  );
}
