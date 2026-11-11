/**
 * Local-first sync engine. Reconciles the Dexie store with a RemoteGateway:
 *
 *   pull(): for each table, fetch rows changed since the pull cursor. A
 *     tombstoned row (deleted_at set) hard-deletes the local row; otherwise the
 *     remote row is written when it is strictly newer than the local one
 *     (last-write-wins by updated_at).
 *   push(): upsert every local row changed since the push cursor (so the FIRST
 *     push uploads all existing local data — the initial migration), then replay
 *     recorded delete-tombstones. Parents push before children so remote FK
 *     targets exist.
 *
 * syncOnce() pulls then pushes: after the merge, local holds the newest of each
 * row, so the push cannot clobber a newer remote value with an older one. Global
 * uuids make upserts idempotent (re-sending never duplicates). Writes made while
 * applying remote changes are wrapped (beginSyncApply/endSyncApply) so no delete
 * tombstone echoes back.
 */

import type { EdbDB } from '../db/schema';
import { beginSyncApply, endSyncApply } from '../db/syncStamp';
import { SYNC_TABLES } from './tableMeta';
import { localToRemote, remoteToLocal } from './mapping';
import { getCursor, setCursor, listTombstones, clearTombstones } from './localState';
import type { RemoteGateway, RemoteRow } from './types';

const EPOCH = '1970-01-01T00:00:00.000Z';

/** Apply remote changes into Dexie, advancing the pull cursor. */
export async function pull(db: EdbDB, gateway: RemoteGateway): Promise<void> {
  const since = getCursor(db.name, 'lastPulledAt') ?? EPOCH;
  let maxSeen = since;

  for (const t of SYNC_TABLES) {
    const rows = await gateway.pullSince(t.remote, since);
    const table = db.table(t.local);

    for (const rr of rows) {
      const remoteUpdated = String(rr.updated_at);
      if (remoteUpdated > maxSeen) maxSeen = remoteUpdated;

      const existing = (await table.get(rr.id)) as { updatedAt?: Date } | undefined;

      if (rr.deleted_at) {
        if (existing) {
          beginSyncApply();
          try {
            await table.delete(rr.id);
          } finally {
            endSyncApply();
          }
        }
        continue;
      }

      // Last-write-wins: keep local if it is the same age or newer.
      if (
        existing?.updatedAt != null &&
        existing.updatedAt.getTime() >= new Date(remoteUpdated).getTime()
      ) {
        continue;
      }

      const local = remoteToLocal(rr);
      beginSyncApply();
      try {
        await table.put(local as never); // upsert by uuid PK
      } finally {
        endSyncApply();
      }
    }
  }

  setCursor(db.name, 'lastPulledAt', maxSeen);
}

/** Upload local changes + delete-tombstones to the remote, advancing the push cursor. */
export async function push(db: EdbDB, gateway: RemoteGateway): Promise<void> {
  const lastPushedIso = getCursor(db.name, 'lastPushedAt');
  const lastPushed = lastPushedIso ? new Date(lastPushedIso).getTime() : 0;
  const pushStartIso = new Date().toISOString();

  for (const t of SYNC_TABLES) {
    const all = (await db.table(t.local).toArray()) as Array<Record<string, unknown>>;
    const dirty = all.filter((r) => {
      const u = r.updatedAt as Date | undefined;
      return u instanceof Date && u.getTime() > lastPushed;
    });
    if (dirty.length === 0) continue;
    const remoteRows: RemoteRow[] = dirty.map((r) => localToRemote(r) as RemoteRow);
    await gateway.upsert(t.remote, remoteRows);
  }

  const tombstones = listTombstones(db.name);
  if (tombstones.length > 0) {
    for (const t of SYNC_TABLES) {
      const ids = tombstones.filter((d) => d.localTable === t.local).map((d) => d.id);
      if (ids.length > 0) await gateway.tombstone(t.remote, ids, pushStartIso);
    }
    clearTombstones(db.name);
  }

  setCursor(db.name, 'lastPushedAt', pushStartIso);
}

/** One full reconciliation cycle: pull (merge) then push (upload). */
export async function syncOnce(db: EdbDB, gateway: RemoteGateway): Promise<void> {
  await pull(db, gateway);
  await push(db, gateway);
}
