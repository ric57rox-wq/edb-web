import type { CSSProperties } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { Crosshair, ListChecks, BarChart3, Settings } from 'lucide-react'

const tabs = [
  { to: '/rifles', label: 'Rifles', Icon: Crosshair },
  { to: '/log', label: 'Log', Icon: ListChecks },
  { to: '/analytics', label: 'Analytics', Icon: BarChart3 },
  { to: '/settings', label: 'Settings', Icon: Settings },
]

export function AppShell() {
  return (
    <div className="app-shell">
      <Outlet />

      <nav style={tabbar}>
        {tabs.map(({ to, label, Icon }) => (
          <NavLink key={to} to={to} style={tabLinkStyle}>
            {({ isActive }) => (
              <div style={{ ...tabInner, color: isActive ? 'var(--impact)' : 'var(--text-faint)' }}>
                <Icon size={20} strokeWidth={2} />
                <span style={tabLabel}>{label}</span>
              </div>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

const tabbar: CSSProperties = {
  position: 'fixed',
  bottom: 0,
  left: '50%',
  transform: 'translateX(-50%)',
  width: '100%',
  maxWidth: 520,
  background: 'var(--panel)',
  borderTop: '1px solid var(--line)',
  display: 'flex',
  padding: '8px 6px calc(8px + env(safe-area-inset-bottom)) 6px',
  zIndex: 10,
}
const tabLinkStyle: CSSProperties = { flex: 1, textDecoration: 'none' }
const tabInner: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 4,
  padding: '6px 2px',
}
const tabLabel: CSSProperties = {
  fontFamily: 'JetBrains Mono, monospace',
  fontSize: 9.5,
  letterSpacing: 0.5,
  textTransform: 'uppercase',
}
