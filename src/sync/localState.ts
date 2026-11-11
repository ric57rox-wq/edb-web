/**
 * Sync bookkeeping in localStorage: the pull/push cursors and the delete-
 * tombstone log. Kept out of Dexie so a `deleting` hook can record a tombstone
 * synchronously (no extra table in its transaction) and so the log survives a
 * reload before the next sync.
 *
 * Everything is namespaced by the Dexie database NAME. Production uses one stable
 * name ('edb') so state persists across reloads; tests use a unique name per
 * simulated device, isolating their cursors and tombstones for free.
 */

function store(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

const keyFor = (dbName: string, k: string) => `sync:${dbName}:${k}`;

export function getCursor(
  dbName: string,
  name: 'lastPulledAt' | 'lastPushedAt',
): string | undefined {
  return store()?.getItem(keyFor(dbName, `cursor:${name}`)) ?? undefined;
}

export function setCursor(
  dbName: string,
  name: 'lastPulledAt' | 'lastPushedAt',
  valueIso: string,
): void {
  store()?.setItem(keyFor(dbName, `cursor:${name}`), valueIso);
}

export interface Tombstone {
  localTable: string;
  id: string;
  deletedAt: string;
}

export function listTombstones(dbName: string): Tombstone[] {
  const raw = store()?.getItem(keyFor(dbName, 'tombstones'));
  if (!raw) return [];
  try {
    return JSON.parse(raw) as Tombstone[];
  } catch {
    return [];
  }
}

export function recordTombstone(dbName: string, t: Tombstone): void {
  const s = store();
  if (!s) return;
  const list = listTombstones(dbName);
  list.push(t);
  s.setItem(keyFor(dbName, 'tombstones'), JSON.stringify(list));
}

export function clearTombstones(dbName: string): void {
  store()?.removeItem(keyFor(dbName, 'tombstones'));
}

/**
 * Supabase Storage object keys whose photo rows were deleted locally. The blob
 * is gone from the device immediately, but the Storage object can only be
 * removed while online, so the path is queued here (survives reloads) until the
 * next photo sync removes it.
 */
export function listPendingStorageDeletes(dbName: string): string[] {
  const raw = store()?.getItem(keyFor(dbName, 'photoDeletes'));
  if (!raw) return [];
  try {
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
}

export function addPendingStorageDelete(dbName: string, path: string): void {
  const s = store();
  if (!s) return;
  const list = listPendingStorageDeletes(dbName);
  if (!list.includes(path)) list.push(path);
  s.setItem(keyFor(dbName, 'photoDeletes'), JSON.stringify(list));
}

export function clearPendingStorageDeletes(dbName: string): void {
  store()?.removeItem(keyFor(dbName, 'photoDeletes'));
}

/**
 * Remove ALL sync bookkeeping (cursors + tombstone log) for a database. Used
 * when wiping this device's local data on sign-out / account switch, so the next
 * user starts from a clean pull cursor instead of inheriting the previous user's.
 */
export function resetSyncState(dbName: string): void {
  const s = store();
  if (!s) return;
  const prefix = `sync:${dbName}:`;
  const toRemove: string[] = [];
  for (let i = 0; i < s.length; i++) {
    const key = s.key(i);
    if (key != null && key.startsWith(prefix)) toRemove.push(key);
  }
  for (const key of toRemove) s.removeItem(key);
}
