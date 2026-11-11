/**
 * Barrel CRUD plus the round-count helper. `rounds` is maintained automatically
 * by the session repository (saving/editing/deleting a course of fire adjusts
 * the barrel it was fired through); `adjustBarrelRounds` is that single choke
 * point, clamped at zero so a correction can never drive the count negative.
 */

import { db } from '../schema';
import { newUuid } from '../syncStamp';
import type { Barrel, NewRow } from '../../domain/types';

export function listBarrels(rifleId: string): Promise<Barrel[]> {
  return db.barrels.where('rifleId').equals(rifleId).toArray();
}

export function getBarrel(id: string): Promise<Barrel | undefined> {
  return db.barrels.get(id);
}

export async function createBarrel(data: NewRow<Barrel>): Promise<string> {
  const id = newUuid();
  const now = new Date();
  await db.barrels.add({ ...data, id, createdAt: now, updatedAt: now, deletedAt: null });
  return id;
}

export async function updateBarrel(id: string, changes: Partial<NewRow<Barrel>>): Promise<void> {
  await db.barrels.update(id, { ...changes, updatedAt: new Date() });
}

export async function deleteBarrel(id: string): Promise<void> {
  await db.barrels.delete(id);
}

/**
 * Add `delta` (may be negative) to a barrel's round count, clamped at 0. No-op
 * when `barrelId` is undefined (a session fired through no recorded barrel).
 * Call inside a transaction that already includes `db.barrels`.
 */
export async function adjustBarrelRounds(
  barrelId: string | undefined,
  delta: number,
): Promise<void> {
  if (!barrelId || delta === 0) return;
  const barrel = await db.barrels.get(barrelId);
  if (!barrel) return;
  const next = Math.max(0, (barrel.rounds ?? 0) + delta);
  await db.barrels.update(barrelId, { rounds: next, updatedAt: new Date() });
}
