import type { CSSProperties, ReactNode } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { useSyncedDatabase } from '../sync/useSyncedDatabase'
import { TurretDivider } from '../ui/TurretDivider'

/**
 * Runs the one-time synced boot (pull → push) for the signed-in user, then keeps
 * the local DB syncing in the background. Renders a brief tactical splash until
 * the first pass finishes, so the UI never flashes empty before remote data
 * arrives. Mounted inside AuthGate, so a session is already present.
 */
export function SyncedGate({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  const ready = useSyncedDatabase(session?.user?.id)

  if (!ready) {
    return (
      <div style={wrap}>
        <div className="eyebrow">Electronic Data Book</div>
        <div style={title}>SYNCING</div>
        <TurretDivider />
        <div style={sub}>Loading your data book…</div>
      </div>
    )
  }

  return <>{children}</>
}

const wrap: CSSProperties = {
  minHeight: '100dvh',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  padding: 24,
  textAlign: 'center',
}
const title: CSSProperties = {
  fontFamily: 'Rajdhani, sans-serif',
  fontWeight: 700,
  fontSize: 26,
  letterSpacing: 2,
  color: '#f2f4f0',
}
const sub: CSSProperties = {
  marginTop: 8,
  fontFamily: 'JetBrains Mono, monospace',
  fontSize: 11,
  letterSpacing: 0.5,
  color: 'var(--text-dim)',
}
