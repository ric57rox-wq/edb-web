/**
 * Remote gateway. The engine talks to Supabase only through this interface, so
 * tests can substitute an in-memory fake and verify convergence without a
 * network. `pullSince` returns rows changed after a cursor (including tombstoned
 * rows, so deletes propagate); `upsert` writes by uuid primary key; `tombstone`
 * marks rows deleted without removing them.
 */

import type { RemoteRow, RemoteGateway } from './types';
import { supabase } from '../lib/supabase';

export const supabaseGateway: RemoteGateway = {
  async pullSince(remoteTable, sinceIso) {
    const { data, error } = await supabase
      .from(remoteTable)
      .select('*')
      .gt('updated_at', sinceIso)
      .order('updated_at', { ascending: true });
    if (error) throw new Error(`pull ${remoteTable}: ${error.message}`);
    return (data ?? []) as RemoteRow[];
  },

  async upsert(remoteTable, rows) {
    if (rows.length === 0) return;
    const { error } = await supabase.from(remoteTable).upsert(rows, { onConflict: 'id' });
    if (error) throw new Error(`upsert ${remoteTable}: ${error.message}`);
  },

  async tombstone(remoteTable, ids, deletedAtIso) {
    if (ids.length === 0) return;
    const { error } = await supabase
      .from(remoteTable)
      .update({ deleted_at: deletedAtIso, updated_at: deletedAtIso })
      .in('id', ids);
    if (error) throw new Error(`tombstone ${remoteTable}: ${error.message}`);
  },
};
