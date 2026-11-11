/**
 * Session photos. The `session_photos` row (session link, Storage path, size) is
 * synced like any other row; the compressed JPEG bytes live in the local-only
 * `photoBlobs` cache and are uploaded to Supabase Storage by the photo sync. On
 * delete the row is tombstoned, the local blob removed, and the Storage key
 * queued for removal on the next sync.
 */

import { db } from '../schema'
import { newUuid } from '../syncStamp'
import { compressImage } from '../../lib/image'
import { addPendingStorageDelete } from '../../sync/localState'
import type { SessionPhoto } from '../../domain/types'

export function listSessionPhotos(sessionId: string): Promise<SessionPhoto[]> {
  return db.sessionPhotos.where('sessionId').equals(sessionId).toArray()
}

/** Compress, store the blob locally, and create the synced metadata row. */
export async function addPhoto(sessionId: string, file: File): Promise<string> {
  const { blob, width, height } = await compressImage(file)
  const id = newUuid()
  const now = new Date()
  await db.transaction('rw', db.sessionPhotos, db.photoBlobs, async () => {
    await db.sessionPhotos.add({ id, sessionId, width, height, createdAt: now, updatedAt: now, deletedAt: null })
    await db.photoBlobs.put({ id, blob })
  })
  return id
}

export async function deleteSessionPhoto(id: string): Promise<void> {
  const row = await db.sessionPhotos.get(id)
  if (row?.storagePath) addPendingStorageDelete(db.name, row.storagePath)
  await db.transaction('rw', db.sessionPhotos, db.photoBlobs, async () => {
    await db.sessionPhotos.delete(id)
    await db.photoBlobs.delete(id)
  })
}

export async function getPhotoBlob(id: string): Promise<Blob | undefined> {
  return (await db.photoBlobs.get(id))?.blob
}

export async function cachePhotoBlob(id: string, blob: Blob): Promise<void> {
  await db.photoBlobs.put({ id, blob })
}
