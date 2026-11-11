/**
 * Sync table metadata. Maps each Dexie store (camelCase) to its Postgres table
 * (snake_case). Ordered PARENTS-FIRST so that on push the remote FK target
 * exists before a child references it (the server enforces real foreign keys).
 * Because ids are global uuids shared by local and remote, there is no FK-id
 * translation — foreign keys ride along as ordinary uuid fields.
 *
 * Leaf module (no app imports) so both the db layer and the sync engine can
 * depend on it without a cycle.
 */

export interface SyncTable {
  /** Dexie store name (camelCase). */
  local: string;
  /** Postgres table name (snake_case). */
  remote: string;
}

export const SYNC_TABLES: SyncTable[] = [
  { local: 'rifles', remote: 'rifles' },
  { local: 'barrels', remote: 'barrels' },
  { local: 'ammunition', remote: 'ammunition' },
  { local: 'sessions', remote: 'sessions' },
  { local: 'sessionPhotos', remote: 'session_photos' },
];

/** Dexie store names that participate in sync (all data tables). */
export const DATA_TABLE_NAMES: readonly string[] = SYNC_TABLES.map((t) => t.local);

/**
 * Local fields stored as `Date`, so ISO strings are re-hydrated on pull and
 * serialized on push. Calendar-only fields (`acquired`, `installed`, `date`)
 * are deliberately NOT here — they stay plain 'YYYY-MM-DD' strings end to end.
 */
export const DATE_LOCAL_FIELDS: ReadonlySet<string> = new Set([
  'createdAt',
  'updatedAt',
  'deletedAt',
]);
