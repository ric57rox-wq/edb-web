/**
 * Photo blob sync (the one piece lock-in-fitness-web had no equivalent for).
 * The `session_photos` ROWS ride the normal sync engine; this moves the BYTES:
 *
 *   - upload: any photo row with a local blob but no `storagePath` is uploaded
 *     to the private `session-photos` bucket at `{owner}/{id}.jpg`, then the
 *     row's `storagePath` is set (which bumps updatedAt → propagates the key to
 *     other devices).
 *   - cleanup: Storage keys queued when photos were deleted are removed.
 *   - download: `fetchPhotoBlob` returns the local blob, or pulls it from
 *     Storage once and caches it (cross-device view; offline-download caching of
 *     yet-unseen photos is deferred per the v1 plan).
 *
 * Best-effort: every failure is swallowed so an offline device keeps working and
 * retries on the next tick.
 */

import { db } from '../db/schema'
import { getPhotoBlob, cachePhotoBlob } from '../db/repositories/photos'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { listPendingStorageDeletes, clearPendingStorageDeletes } from './localState'
import type { SessionPhoto } from '../domain/types'

const BUCKET = 'session-photos'

export async function syncPhotos(): Promise<void> {
  if (!isSupabaseConfigured) return
  const { data: userData } = await supabase.auth.getUser()
  const ownerId = userData.user?.id
  if (!ownerId) return

  // 1) Upload captured-but-not-yet-uploaded photos.
  const rows = await db.sessionPhotos.toArray()
  for (const row of rows) {
    if (row.storagePath) continue
    const blob = await getPhotoBlob(row.id)
    if (!blob) continue
    const path = `${ownerId}/${row.id}.jpg`
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, blob, { contentType: 'image/jpeg', upsert: true })
    if (error) continue // keep the blob; retry next tick
    await db.sessionPhotos.update(row.id, { storagePath: path, updatedAt: new Date() })
  }

  // 2) Remove Storage objects for photos deleted locally.
  const pending = listPendingStorageDeletes(db.name)
  if (pending.length > 0) {
    const { error } = await supabase.storage.from(BUCKET).remove(pending)
    if (!error) clearPendingStorageDeletes(db.name)
  }
}

/** The blob to display: local cache first, else download from Storage and cache. */
export async function fetchPhotoBlob(photo: SessionPhoto): Promise<Blob | undefined> {
  const local = await getPhotoBlob(photo.id)
  if (local) return local
  if (!photo.storagePath || !isSupabaseConfigured) return undefined
  const { data, error } = await supabase.storage.from(BUCKET).download(photo.storagePath)
  if (error || !data) return undefined
  await cachePhotoBlob(photo.id, data)
  return data
}

/** Fire-and-forget upload nudge after capturing, so photos leave the device promptly. */
export function triggerPhotoSync(): void {
  void syncPhotos().catch(() => {
    /* offline — the background tick will retry */
  })
}
