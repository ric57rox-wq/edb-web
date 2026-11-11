import type { CSSProperties, ReactNode } from 'react'
import { TurretDivider } from '../ui/TurretDivider'

// Phase-0 placeholder screens. Each tab's real UI lands in its own build phase.
function Screen({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ padding: '22px 20px 0' }}>
      <div className="eyebrow">Electronic Data Book</div>
      <h1 style={heading}>{title}</h1>
      <TurretDivider />
      <div style={placeholder}>{children}</div>
    </div>
  )
}

export function RiflesScreen() {
  return (
    <Screen title="Rifles">
      Your rifle profiles, barrels, loads, and courses of fire will live here.
    </Screen>
  )
}
export function LogScreen() {
  return <Screen title="Log">A searchable log of every course of fire, across all rifles.</Screen>
}
export function AnalyticsScreen() {
  return (
    <Screen title="Analytics">Hit %, rounds fired, and per-rifle roll-ups will appear here.</Screen>
  )
}
export function SettingsScreen() {
  return (
    <Screen title="Settings">Account, data summary, and backup export/import will live here.</Screen>
  )
}

const heading: CSSProperties = {
  fontFamily: 'Rajdhani, sans-serif',
  fontWeight: 700,
  fontSize: 30,
  letterSpacing: 0.5,
  textTransform: 'uppercase',
  margin: '2px 0 0',
  color: '#f2f4f0',
}
const placeholder: CSSProperties = {
  marginTop: 14,
  background: 'var(--panel)',
  border: '1px dashed var(--line)',
  borderRadius: 10,
  padding: '30px 22px',
  textAlign: 'center',
  color: 'var(--text-dim)',
  fontSize: 13,
  lineHeight: 1.6,
}
