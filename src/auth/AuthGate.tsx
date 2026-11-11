import type { ReactNode } from 'react'
import { useAuth } from './AuthProvider'
import { LoginScreen } from './LoginScreen'

// Blocks the app until authenticated.
export function AuthGate({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth()

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-faint)',
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 12,
          letterSpacing: 1,
        }}
      >
        LOADING…
      </div>
    )
  }

  if (!session) return <LoginScreen />
  return <>{children}</>
}
