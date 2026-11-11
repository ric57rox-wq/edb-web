/**
 * Session (course-of-fire) CRUD with barrel round-count integration (ported from
 * the native app, done in the data layer so it works offline):
 *   - create: add (hits+misses) to the chosen barrel's rounds
 *   - update: reverse the OLD contribution, then apply the NEW one (handles a
 *     changed barrel or changed shot counts)
 *   - delete: subtract the contribution back out
 * All three run in a transaction spanning sessions + barrels so the count and
 * the session never diverge.
 */

import { db } from '../schema';
import { newUuid } from '../syncStamp';
import { adjustBarrelRounds } from './barrels';
import { roundsFired } from '../../domain/metrics';
import type { Session, NewRow } from '../../domain/types';

export async function listSessions(): Promise<Session[]> {
  // Sort in memory (ISO date strings sort chronologically); a session with no
  // date sorts last rather than being dropped from an index scan.
  const all = await db.sessions.toArray();
  return all.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
}

export function listSessionsForRifle(rifleId: string): Promise<Session[]> {
  return db.sessions.where('rifleId').equals(rifleId).toArray();
}

export function getSession(id: string): Promise<Session | undefined> {
  return db.sessions.get(id);
}

export async function createSession(data: NewRow<Session>): Promise<string> {
  const id = newUuid();
  const now = new Date();
  const row: Session = { ...data, id, createdAt: now, updatedAt: now, deletedAt: null };
  await db.transaction('rw', db.sessions, db.barrels, async () => {
    await db.sessions.add(row);
    await adjustBarrelRounds(row.barrelId, roundsFired(row.hits, row.misses));
  });
  return id;
}

export async function updateSession(
  id: string,
  changes: Partial<NewRow<Session>>,
): Promise<void> {
  await db.transaction('rw', db.sessions, db.barrels, async () => {
    const old = await db.sessions.get(id);
    if (!old) return;
    const next = { ...old, ...changes };

    // Reverse the old contribution, apply the new one.
    await adjustBarrelRounds(old.barrelId, -roundsFired(old.hits, old.misses));
    await adjustBarrelRounds(next.barrelId, roundsFired(next.hits, next.misses));

    await db.sessions.update(id, { ...changes, updatedAt: new Date() });
  });
}

export async function deleteSession(id: string): Promise<void> {
  await db.transaction('rw', db.sessions, db.barrels, db.sessionPhotos, async () => {
    const s = await db.sessions.get(id);
    if (!s) return;
    await adjustBarrelRounds(s.barrelId, -roundsFired(s.hits, s.misses));
    for (const p of await db.sessionPhotos.where('sessionId').equals(id).toArray()) {
      await db.sessionPhotos.delete(p.id);
    }
    await db.sessions.delete(id);
  });
}
