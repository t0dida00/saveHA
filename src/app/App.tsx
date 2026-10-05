import { useCallback, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { AuthProvider, LoginPage, useAuth } from '@/features/auth'
import { DashboardPage } from '@/features/dashboard'
import { ReportPage } from '@/features/report'
import { SettingsPage } from '@/features/settings'
import { ShipSchedulePage } from '@/features/ship-schedule'
import { SplashScreen } from '@/features/splash'
import { AppLayout } from './layout/AppLayout/AppLayout'

function AppRoutes() {
  const { isAuthenticated } = useAuth()

  // Signed out: every URL shows the login page, and the URL is kept for after sign-in
  if (!isAuthenticated) return <LoginPage />

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/ship-schedule" element={<ShipSchedulePage />} />
        <Route path="/report" element={<ReportPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

export function App() {
  const [splashDone, setSplashDone] = useState(__DEVELOPMENT__)
  const handleSplashDone = useCallback(() => setSplashDone(true), [])

  return (
    <AuthProvider>
      <BrowserRouter>{splashDone ? <AppRoutes /> : <SplashScreen onDone={handleSplashDone} />}</BrowserRouter>
    </AuthProvider>
  )
}
