/**
 * Ammunition (load) CRUD, scoped to a rifle. Sessions reference a load by id;
 * deleting a load does not touch sessions (their `ammunitionId` simply dangles,
 * mirroring the server's ON DELETE SET NULL), so a load can be removed without
 * rewriting history.
 */

import { db } from '../schema';
import { newUuid } from '../syncStamp';
import type { Ammunition, NewRow } from '../../domain/types';

export function listAmmunition(rifleId: string): Promise<Ammunition[]> {
  return db.ammunition.where('rifleId').equals(rifleId).toArray();
}

export function getAmmunition(id: string): Promise<Ammunition | undefined> {
  return db.ammunition.get(id);
}

export async function createAmmunition(data: NewRow<Ammunition>): Promise<string> {
  const id = newUuid();
  const now = new Date();
  await db.ammunition.add({ ...data, id, createdAt: now, updatedAt: now, deletedAt: null });
  return id;
}

export async function updateAmmunition(
  id: string,
  changes: Partial<NewRow<Ammunition>>,
): Promise<void> {
  await db.ammunition.update(id, { ...changes, updatedAt: new Date() });
}

export async function deleteAmmunition(id: string): Promise<void> {
  await db.ammunition.delete(id);
}
