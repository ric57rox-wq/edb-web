/**
 * JSON backup export/import. Export serializes every synced table (Date fields →
 * ISO). Import rehydrates and writes each table with a single `bulkPut` (batched,
 * O(n) — the native app's restore was ~O(n²)); imported rows get a fresh
 * `updatedAt` so a restore wins last-write-wins and is pushed to the cloud on the
 * next sync. Photo BYTES are not in the JSON (they live in Supabase Storage); the
 * photo rows are, so they re-link once Storage is reachable.
 */

import { db } from '../schema'
import { SYNC_TABLES, DATE_LOCAL_FIELDS } from '../../sync/tableMeta'

const BACKUP_VERSION = 1

export interface BackupFile {
  app: 'edb'
  version: number
  exportedAt: string
  data: Record<string, Record<string, unknown>[]>
}

export interface DataCounts {
  rifles: number
  barrels: number
  ammunition: number
  sessions: number
  sessionPhotos: number
}

export async function dataCounts(): Promise<DataCounts> {
  const [rifles, barrels, ammunition, sessions, sessionPhotos] = await Promise.all([
    db.rifles.count(),
    db.barrels.count(),
    db.ammunition.count(),
    db.sessions.count(),
    db.sessionPhotos.count(),
  ])
  return { rifles, barrels, ammunition, sessions, sessionPhotos }
}

export async function exportBackup(): Promise<BackupFile> {
  const data: Record<string, Record<string, unknown>[]> = {}
  for (const t of SYNC_TABLES) {
    const rows = (await db.table(t.local).toArray()) as Record<string, unknown>[]
    data[t.local] = rows.map(serializeRow)
  }
  return { app: 'edb', version: BACKUP_VERSION, exportedAt: new Date().toISOString(), data }
}

function serializeRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(row)) out[k] = v instanceof Date ? v.toISOString() : v
  return out
}

function rehydrateForImport(row: Record<string, unknown>, now: Date): Record<string, unknown> {
  const out: Record<string, unknown> = { ...row }
  for (const f of DATE_LOCAL_FIELDS) {
    const v = out[f]
    out[f] = typeof v === 'string' ? new Date(v) : f === 'deletedAt' ? null : v
  }
  // A restore should win and re-sync.
  out.updatedAt = now
  if (!(out.createdAt instanceof Date)) out.createdAt = now
  out.deletedAt = null
  return out
}

export interface ImportResult {
  imported: number
}

export async function importBackup(file: BackupFile): Promise<ImportResult> {
  if (!file || file.app !== 'edb' || typeof file.data !== 'object') {
    throw new Error('That file is not an EDB backup.')
  }
  const now = new Date()
  let imported = 0
  for (const t of SYNC_TABLES) {
    const rows = file.data[t.local] ?? []
    if (!Array.isArray(rows) || rows.length === 0) continue
    const rehydrated = rows.map((r) => rehydrateForImport(r, now))
    await db.table(t.local).bulkPut(rehydrated as never[])
    imported += rehydrated.length
  }
  return { imported }
}
