import { AuthProvider } from './auth/AuthProvider'
import { AuthGate } from './auth/AuthGate'
import { SyncedGate } from './app/SyncedGate'
import { Router } from './app/Router'

export default function App() {
  return (
    <AuthProvider>
      <AuthGate>
        <SyncedGate>
          <Router />
        </SyncedGate>
      </AuthGate>
    </AuthProvider>
  )
}
