/**
 * Dexie schema for EDB. One database; entities joined by uuid foreign keys.
 * Primary key is the global `id` uuid (inbound/string key — the SAME id stored
 * in Supabase), so no local-id↔uuid translation is needed on sync. Secondary
 * indexes cover the common lookups (children by parent, sessions by date).
 */

import Dexie, { type EntityTable } from 'dexie';
import { installSyncHooks } from './syncStamp';
import type { Rifle, Barrel, Ammunition, Session, SessionPhoto, PhotoBlob } from '../domain/types';

export class EdbDB extends Dexie {
  rifles!: EntityTable<Rifle, 'id'>;
  barrels!: EntityTable<Barrel, 'id'>;
  ammunition!: EntityTable<Ammunition, 'id'>;
  sessions!: EntityTable<Session, 'id'>;
  sessionPhotos!: EntityTable<SessionPhoto, 'id'>;
  /** Local-only binary cache (not synced as rows). */
  photoBlobs!: EntityTable<PhotoBlob, 'id'>;

  constructor(name = 'edb') {
    super(name);
    this.version(1).stores({
      // `id` first = inbound string (uuid) primary key; rest are secondary indexes.
      rifles: 'id, updatedAt',
      barrels: 'id, rifleId, updatedAt',
      ammunition: 'id, rifleId, updatedAt',
      sessions: 'id, rifleId, barrelId, ammunitionId, date, updatedAt',
      sessionPhotos: 'id, sessionId, updatedAt',
    });
    // v2 — local blob cache for photos (Phase 5). Additive: Dexie keeps the
    // v1 stores and just creates this one.
    this.version(2).stores({
      photoBlobs: 'id',
    });

    installSyncHooks(this);
  }
}

/** Singleton database instance for the running app. */
export const db = new EdbDB();
