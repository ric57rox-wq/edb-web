/**
 * Row mapping between the local Dexie shape (camelCase fields, `Date` sync
 * timestamps) and the Supabase shape (snake_case columns, ISO strings). Because
 * ids are global uuids, `id` and every FK pass straight through — the only
 * transforms are case conversion and Date↔ISO for the sync-timestamp fields.
 */

import { DATE_LOCAL_FIELDS } from './tableMeta';

const camelToSnake = (s: string) => s.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase());
const snakeToCamel = (s: string) => s.replace(/_([a-z])/g, (_m, c: string) => c.toUpperCase());

/** Local Dexie row -> Supabase row. `owner_id` is omitted (server default = auth.uid()). */
export function localToRemote(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [field, value] of Object.entries(row)) {
    if (value === undefined) continue;
    out[camelToSnake(field)] = value instanceof Date ? value.toISOString() : value;
  }
  return out;
}

/** Supabase row -> local Dexie row. Drops `owner_id`; rehydrates Date fields. */
export function remoteToLocal(rr: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [col, value] of Object.entries(rr)) {
    if (col === 'owner_id') continue; // ownership is server-side only
    const field = snakeToCamel(col);
    if (DATE_LOCAL_FIELDS.has(field)) {
      // deletedAt is meaningfully null (not-a-tombstone); others stay absent when null.
      out[field] =
        value == null ? (field === 'deletedAt' ? null : undefined) : new Date(value as string);
    } else {
      out[field] = value;
    }
  }
  return out;
}
