import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AppShell } from './AppShell'
import { RiflesScreen } from '../screens/rifles/RiflesScreen'
import { RifleDetailScreen } from '../screens/rifles/RifleDetailScreen'
import { SessionForm } from '../screens/sessions/SessionForm'
import { SessionDetailScreen } from '../screens/sessions/SessionDetailScreen'
import { LogScreen } from '../screens/sessions/LogScreen'
import { AnalyticsScreen, SettingsScreen } from '../screens/Placeholders'

export function Router() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Navigate to="/rifles" replace />} />
          <Route path="/rifles" element={<RiflesScreen />} />
          <Route path="/rifles/:rifleId" element={<RifleDetailScreen />} />
          <Route path="/rifles/:rifleId/sessions/new" element={<SessionForm />} />
          <Route path="/sessions/:sessionId" element={<SessionDetailScreen />} />
          <Route path="/sessions/:sessionId/edit" element={<SessionForm />} />
          <Route path="/log" element={<LogScreen />} />
          <Route path="/analytics" element={<AnalyticsScreen />} />
          <Route path="/settings" element={<SettingsScreen />} />
          <Route path="*" element={<Navigate to="/rifles" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
