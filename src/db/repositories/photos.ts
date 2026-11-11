/**
 * Session photo rows. Phase 2 covers only the synced metadata row (session link,
 * Storage path, dimensions). Client-side compression, the local blob cache, and
 * the Supabase Storage upload land in Phase 5 — this repository is the row-level
 * foundation they build on.
 */

import { db } from '../schema';
import { newUuid } from '../syncStamp';
import type { SessionPhoto, NewRow } from '../../domain/types';

export function listSessionPhotos(sessionId: string): Promise<SessionPhoto[]> {
  return db.sessionPhotos.where('sessionId').equals(sessionId).toArray();
}

export async function createSessionPhoto(data: NewRow<SessionPhoto>): Promise<string> {
  const id = newUuid();
  const now = new Date();
  await db.sessionPhotos.add({ ...data, id, createdAt: now, updatedAt: now, deletedAt: null });
  return id;
}

export async function updateSessionPhoto(
  id: string,
  changes: Partial<NewRow<SessionPhoto>>,
): Promise<void> {
  await db.sessionPhotos.update(id, { ...changes, updatedAt: new Date() });
}

export async function deleteSessionPhoto(id: string): Promise<void> {
  await db.sessionPhotos.delete(id);
}
