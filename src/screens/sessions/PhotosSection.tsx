import { useRef, useState, type CSSProperties } from 'react'
import { ImagePlus, X, Trash2, Loader } from 'lucide-react'
import { SectionLabel, Button } from '../../ui/kit'
import { ConfirmDialog } from '../../ui/Sheet'
import { useSessionPhotos } from '../../hooks/useData'
import { usePhotoUrl } from '../../hooks/usePhotoUrl'
import { addPhoto, deleteSessionPhoto } from '../../db/repositories/photos'
import { triggerPhotoSync } from '../../sync/photoSync'
import type { SessionPhoto } from '../../domain/types'

/** Target photos for a session: capture → compress → local cache → Storage upload. */
export function PhotosSection({ sessionId }: { sessionId: string }) {
  const photos = useSessionPhotos(sessionId)
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [viewer, setViewer] = useState<SessionPhoto | null>(null)

  async function onFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    setBusy(true)
    try {
      for (const file of Array.from(files)) {
        if (file.type.startsWith('image/')) await addPhoto(sessionId, file)
      }
      triggerPhotoSync()
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <>
      <SectionLabel
        right={
          <Button small variant="ghost" onClick={() => inputRef.current?.click()} disabled={busy}>
            {busy ? <Loader size={14} /> : <ImagePlus size={14} />} Add
          </Button>
        }
      >
        Photos
      </SectionLabel>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: 'none' }}
        onChange={(e) => void onFiles(e.target.files)}
      />

      {photos == null ? null : photos.length === 0 ? (
        <button style={addTile} onClick={() => inputRef.current?.click()} disabled={busy}>
          <ImagePlus size={20} />
          <span>Add target photos</span>
        </button>
      ) : (
        <div style={grid}>
          {photos.map((p) => (
            <Thumb key={p.id} photo={p} onOpen={() => setViewer(p)} />
          ))}
        </div>
      )}

      {viewer && (
        <Lightbox photo={viewer} onClose={() => setViewer(null)} onDeleted={() => setViewer(null)} />
      )}
    </>
  )
}

function Thumb({ photo, onOpen }: { photo: SessionPhoto; onOpen: () => void }) {
  const url = usePhotoUrl(photo)
  return (
    <button style={thumb} onClick={onOpen}>
      {url ? (
        <img src={url} alt="" style={thumbImg} />
      ) : (
        <div style={{ ...thumbImg, display: 'grid', placeItems: 'center', color: 'var(--text-faint)' }}>
          {photo.storagePath ? <Loader size={16} /> : <X size={16} />}
        </div>
      )}
    </button>
  )
}

function Lightbox({
  photo,
  onClose,
  onDeleted,
}: {
  photo: SessionPhoto
  onClose: () => void
  onDeleted: () => void
}) {
  const url = usePhotoUrl(photo)
  const [confirm, setConfirm] = useState(false)
  return (
    <div style={lbOverlay} onClick={onClose}>
      <button style={lbClose} onClick={onClose} aria-label="Close">
        <X size={22} />
      </button>
      {url ? (
        <img src={url} alt="" style={lbImg} onClick={(e) => e.stopPropagation()} />
      ) : (
        <div style={{ color: 'var(--text-dim)', fontSize: 13 }}>Loading…</div>
      )}
      <button
        style={lbDelete}
        onClick={(e) => {
          e.stopPropagation()
          setConfirm(true)
        }}
      >
        <Trash2 size={15} /> Delete
      </button>
      <ConfirmDialog
        open={confirm}
        title="Delete this photo?"
        onConfirm={async () => {
          await deleteSessionPhoto(photo.id)
          setConfirm(false)
          onDeleted()
        }}
        onCancel={() => setConfirm(false)}
      />
    </div>
  )
}

const grid: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }
const thumb: CSSProperties = {
  padding: 0,
  border: '1px solid var(--line)',
  borderRadius: 8,
  overflow: 'hidden',
  background: 'var(--panel)',
  cursor: 'pointer',
  aspectRatio: '1 / 1',
}
const thumbImg: CSSProperties = { width: '100%', height: '100%', objectFit: 'cover', display: 'block' }
const addTile: CSSProperties = {
  width: '100%',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 8,
  padding: '26px 0',
  background: 'var(--panel)',
  border: '1px dashed var(--line)',
  borderRadius: 10,
  color: 'var(--text-dim)',
  fontSize: 12.5,
  cursor: 'pointer',
}
const lbOverlay: CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.92)',
  zIndex: 200,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 16,
}
const lbImg: CSSProperties = { maxWidth: '100%', maxHeight: '82vh', objectFit: 'contain', borderRadius: 6 }
const lbClose: CSSProperties = {
  position: 'absolute',
  top: 'calc(14px + env(safe-area-inset-top))',
  right: 16,
  background: 'rgba(255,255,255,0.1)',
  border: 'none',
  borderRadius: 999,
  padding: 8,
  color: '#fff',
  cursor: 'pointer',
}
const lbDelete: CSSProperties = {
  position: 'absolute',
  bottom: 'calc(20px + env(safe-area-inset-bottom))',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  background: 'rgba(200,90,74,0.15)',
  border: '1px solid var(--danger)',
  color: 'var(--danger)',
  borderRadius: 6,
  padding: '9px 16px',
  fontSize: 13,
  cursor: 'pointer',
}
