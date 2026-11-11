import { useEffect, useState } from 'react'
import { fetchPhotoBlob } from '../sync/photoSync'
import type { SessionPhoto } from '../domain/types'

/** Resolve a displayable object URL for a photo (local cache or Storage), revoked on unmount. */
export function usePhotoUrl(photo: SessionPhoto): string | undefined {
  const [url, setUrl] = useState<string | undefined>()
  useEffect(() => {
    let objectUrl: string | undefined
    let cancelled = false
    void fetchPhotoBlob(photo).then((blob) => {
      if (cancelled || !blob) return
      objectUrl = URL.createObjectURL(blob)
      setUrl(objectUrl)
    })
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [photo.id, photo.storagePath])
  return url
}
