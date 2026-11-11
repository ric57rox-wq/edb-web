/**
 * Dexie write hooks that keep every row's sync metadata current:
 *   - `id`        global uuid (also the Supabase row id) — generated if absent
 *   - `createdAt` first-write clock
 *   - `updatedAt` last-write clock (last-write-wins across devices)
 *   - `deletedAt` soft-delete sentinel (null locally; a tombstone is logged on delete)
 *
 * Deletes are HARD locally (the row is removed) but recorded as a tombstone in
 * localStorage so the next push propagates a soft-delete to the server and on to
 * other devices. While the sync engine applies a remote change it sets
 * `applyingRemote`, so an applied remote delete is not re-logged (no echo loop).
 */

import type Dexie from 'dexie';
import { DATA_TABLE_NAMES } from '../sync/tableMeta';
import { recordTombstone } from '../sync/localState';

let applyingRemote = false;
export function beginSyncApply(): void {
  applyingRemote = true;
}
export function endSyncApply(): void {
  applyingRemote = false;
}

/** v4 UUID, preferring the platform CSPRNG. */
export function newUuid(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    const v = ch === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** Attach creating/updating/deleting hooks to the synced data tables. Call once per db. */
export function installSyncHooks(db: Dexie): void {
  for (const table of db.tables) {
    // Non-synced local stores (e.g. the photo blob cache) carry no sync columns.
    if (!DATA_TABLE_NAMES.includes(table.name)) continue

    table.hook('creating', (_primKey, obj) => {
      const row = obj as Record<string, unknown>;
      if (row.id == null) row.id = newUuid();
      if (row.createdAt == null) row.createdAt = new Date();
      if (row.updatedAt == null) row.updatedAt = new Date();
      if (row.deletedAt === undefined) row.deletedAt = null;
    });

    // Bump the clock on any change, unless the caller set it explicitly (the
    // sync engine applies remote rows with their own updatedAt).
    table.hook('updating', (modifications) => {
      const mods = modifications as Record<string, unknown>;
      if ('updatedAt' in mods) return undefined;
      return { updatedAt: new Date() };
    });

    if (DATA_TABLE_NAMES.includes(table.name)) {
      const localTable = table.name;
      table.hook('deleting', (primKey, obj) => {
        if (applyingRemote) return;
        const id = (obj as Record<string, unknown>)?.id ?? primKey;
        if (typeof id === 'string') {
          recordTombstone(db.name, {
            localTable,
            id,
            deletedAt: new Date().toISOString(),
          });
        }
      });
    }
  }
}
