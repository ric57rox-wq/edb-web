/**
 * Bottom-sheet modal and a confirm dialog. Used for quick add/edit forms
 * (barrels, ammo, rifles) and destructive confirmations, so the user stays in
 * context instead of navigating away.
 */

import { useEffect, type CSSProperties, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { Button } from './kit'

export function Sheet({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return (
    <div style={overlay} onClick={onClose}>
      <div style={sheet} onClick={(e) => e.stopPropagation()}>
        <div style={handle} />
        <div style={headerRow}>
          <h2 style={sheetTitle}>{title}</h2>
          <button style={closeBtn} onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div style={{ paddingTop: 4 }}>{children}</div>
      </div>
    </div>
  )
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Delete',
  danger = true,
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: string
  message?: string
  confirmLabel?: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  if (!open) return null
  return (
    <div style={overlay} onClick={onCancel}>
      <div style={dialog} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ ...sheetTitle, marginBottom: 8 }}>{title}</h2>
        {message && <p style={{ color: 'var(--text-dim)', fontSize: 13, lineHeight: 1.5, margin: '0 0 18px' }}>{message}</p>}
        <div style={{ display: 'flex', gap: 10 }}>
          <Button variant="secondary" full onClick={onCancel}>
            Cancel
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} full onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}

const overlay: CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.6)',
  display: 'flex',
  alignItems: 'flex-end',
  justifyContent: 'center',
  zIndex: 100,
  backdropFilter: 'blur(2px)',
}
const sheet: CSSProperties = {
  width: '100%',
  maxWidth: 520,
  background: 'var(--panel)',
  borderTop: '1px solid var(--line)',
  borderRadius: '16px 16px 0 0',
  padding: '10px 18px calc(22px + env(safe-area-inset-bottom))',
  maxHeight: '90dvh',
  overflowY: 'auto',
}
const dialog: CSSProperties = {
  width: '100%',
  maxWidth: 400,
  margin: 'auto 18px',
  alignSelf: 'center',
  background: 'var(--panel)',
  border: '1px solid var(--line)',
  borderRadius: 12,
  padding: 22,
}
const handle: CSSProperties = {
  width: 36,
  height: 4,
  borderRadius: 2,
  background: 'var(--line)',
  margin: '2px auto 10px',
}
const headerRow: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: 4,
}
const sheetTitle: CSSProperties = {
  fontFamily: 'Rajdhani, sans-serif',
  fontWeight: 700,
  fontSize: 22,
  letterSpacing: 0.5,
  textTransform: 'uppercase',
  color: '#f2f4f0',
  margin: 0,
}
const closeBtn: CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'var(--text-dim)',
  cursor: 'pointer',
  padding: 4,
}
