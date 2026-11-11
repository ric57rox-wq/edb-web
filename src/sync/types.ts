/** A row as stored in Supabase (snake_case columns, uuid `id`, ISO timestamps). */
export type RemoteRow = Record<string, unknown> & {
  id: string;
  updated_at: string;
  deleted_at?: string | null;
};

/**
 * The remote backend, abstracted so the engine is testable with an in-memory
 * fake. `pullSince` returns rows changed after a cursor (tombstoned rows
 * included, so deletes propagate); `upsert` writes by uuid PK; `tombstone` marks
 * rows deleted without removing them.
 */
export interface RemoteGateway {
  pullSince(remoteTable: string, sinceIso: string): Promise<RemoteRow[]>;
  upsert(remoteTable: string, rows: RemoteRow[]): Promise<void>;
  tombstone(remoteTable: string, ids: string[], deletedAtIso: string): Promise<void>;
}
