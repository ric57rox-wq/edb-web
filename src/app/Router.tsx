import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AppShell } from './AppShell'
import { RiflesScreen } from '../screens/rifles/RiflesScreen'
import { RifleDetailScreen } from '../screens/rifles/RifleDetailScreen'
import { LogScreen, AnalyticsScreen, SettingsScreen } from '../screens/Placeholders'

export function Router() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Navigate to="/rifles" replace />} />
          <Route path="/rifles" element={<RiflesScreen />} />
          <Route path="/rifles/:rifleId" element={<RifleDetailScreen />} />
          <Route path="/log" element={<LogScreen />} />
          <Route path="/analytics" element={<AnalyticsScreen />} />
          <Route path="/settings" element={<SettingsScreen />} />
          <Route path="*" element={<Navigate to="/rifles" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
