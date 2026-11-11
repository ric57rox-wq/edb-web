import { useRef, useState, type CSSProperties } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Download, Upload, LogOut, Check } from 'lucide-react'
import { Screen, ScreenHeader, Card, Button, SectionLabel, Stat } from '../ui/kit'
import { TurretDivider } from '../ui/TurretDivider'
import { ConfirmDialog } from '../ui/Sheet'
import { useAuth } from '../auth/AuthProvider'
import { exportBackup, importBackup, dataCounts, type BackupFile } from '../db/repositories/backup'
import { resetLocalUserData } from '../sync/resetLocal'
import { today } from '../lib/format'

export function SettingsScreen() {
  const { session, signOut } = useAuth()
  const counts = useLiveQuery(() => dataCounts())
  const inputRef = useRef<HTMLInputElement>(null)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [pendingImport, setPendingImport] = useState<BackupFile | null>(null)
  const [signingOut, setSigningOut] = useState(false)

  async function doExport() {
    const file = await exportBackup()
    const blob = new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `edb-backup-${today()}.json`
    a.click()
    URL.revokeObjectURL(url)
    setMsg({ kind: 'ok', text: 'Backup downloaded.' })
  }

  async function onPickFile(file: File | undefined) {
    if (!file) return
    try {
      const parsed = JSON.parse(await file.text()) as BackupFile
      if (parsed?.app !== 'edb') throw new Error('Not an EDB backup file.')
      setPendingImport(parsed)
    } catch {
      setMsg({ kind: 'err', text: 'Could not read that file as an EDB backup.' })
    }
    if (inputRef.current) inputRef.current.value = ''
  }

  async function confirmImport() {
    if (!pendingImport) return
    try {
      const { imported } = await importBackup(pendingImport)
      setMsg({ kind: 'ok', text: `Restored ${imported} records.` })
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : 'Import failed.' })
    } finally {
      setPendingImport(null)
    }
  }

  return (
    <Screen>
      <ScreenHeader title="Settings" />
      <TurretDivider />

      <SectionLabel>Data</SectionLabel>
      <Card>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
          <Stat label="Rifles" value={counts?.rifles ?? '—'} />
          <Stat label="Barrels" value={counts?.barrels ?? '—'} />
          <Stat label="Loads" value={counts?.ammunition ?? '—'} />
          <Stat label="Sessions" value={counts?.sessions ?? '—'} />
        </div>
      </Card>

      <SectionLabel>Backup</SectionLabel>
      <div style={{ display: 'flex', gap: 10 }}>
        <Button variant="secondary" full onClick={() => void doExport()}>
          <Download size={15} /> Export
        </Button>
        <Button variant="secondary" full onClick={() => inputRef.current?.click()}>
          <Upload size={15} /> Import
        </Button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="application/json,.json"
        style={{ display: 'none' }}
        onChange={(e) => void onPickFile(e.target.files?.[0])}
      />
      <div style={hint}>
        Export saves a JSON file of all rifles, barrels, loads and courses of fire. Import merges a
        backup back in (photos are restored from cloud storage).
      </div>
      {msg && (
        <div style={{ ...banner, color: msg.kind === 'ok' ? 'var(--ok)' : 'var(--danger)' }}>
          {msg.kind === 'ok' && <Check size={14} style={{ verticalAlign: '-2px', marginRight: 5 }} />}
          {msg.text}
        </div>
      )}

      <SectionLabel>Account</SectionLabel>
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
          <div style={{ minWidth: 0 }}>
            <div style={accEmail}>{session?.user?.email ?? 'Signed in'}</div>
            <div style={hint2}>Private account · data synced to your cloud</div>
          </div>
          <Button small variant="danger" onClick={() => setSigningOut(true)}>
            <LogOut size={14} /> Sign out
          </Button>
        </div>
      </Card>

      <div style={appInfo}>EDB — Electronic Data Book · offline-first</div>
      <div style={{ height: 16 }} />

      <ConfirmDialog
        open={pendingImport != null}
        title="Restore this backup?"
        message="Records in the backup are written over any with the same id. Nothing else is deleted."
        confirmLabel="Restore"
        danger={false}
        onConfirm={() => void confirmImport()}
        onCancel={() => setPendingImport(null)}
      />
      <ConfirmDialog
        open={signingOut}
        title="Sign out?"
        message="Synced data stays safe in your cloud account and loads again when you sign back in."
        confirmLabel="Sign out"
        onConfirm={async () => {
          setSigningOut(false)
          // Push any pending edits, then wipe local data so nothing is left for
          // the next account on this device.
          await resetLocalUserData({ pushFirst: true })
          await signOut()
        }}
        onCancel={() => setSigningOut(false)}
      />
    </Screen>
  )
}

const hint: CSSProperties = { color: 'var(--text-faint)', fontSize: 11.5, lineHeight: 1.5, margin: '8px 2px 0' }
const hint2: CSSProperties = { color: 'var(--text-faint)', fontSize: 11, marginTop: 2 }
const banner: CSSProperties = { fontSize: 12.5, margin: '10px 2px 0' }
const accEmail: CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  color: 'var(--text)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}
const appInfo: CSSProperties = {
  textAlign: 'center',
  color: 'var(--text-faint)',
  fontSize: 10.5,
  fontFamily: 'JetBrains Mono, monospace',
  letterSpacing: 0.5,
  marginTop: 28,
}
