import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import Layout from './layout/Layout'
import Login from './pages/Login'
import { placeholders } from './config/nav'
import MehsulBazasi from './features/mehsul-bazasi'
import TechizatciBazasi from './features/techizatci-bazasi'
import Inventar from './features/inventar'
import MusteriBazasi from './features/musteri-bazasi'
import Icloud from './features/icloud'
import MonthlyTracking from './features/monthly-tracking'
import QiymetCedveliFeature from './features/qiymet-cedveli'
import BazaraBorc from './features/bazara-borc'
import TelefonNomreleri from './features/telefon-nomreleri'
import CreateUser from './pages/CreateUser'
import UserList from './pages/UserList'

function AppRoutes() {
  return (
    <Layout>
      <Routes>
        <Route path="/admin/create-user" element={<CreateUser />} />
        <Route path="/admin/users" element={<UserList />} />
        {placeholders
          .filter(({ path }) => !['/mehsul-bazasi', '/techizatci-bazasi', '/inventar', '/musteri-bazasi', '/icloud', '/ayliq-yigim', '/qiymet-cedveli', '/bazara-borc', '/telefon-nomreleri'].includes(path))
          .map(({ path, Component }) => (
            <Route key={path} path={path} element={<Component />} />
          ))}
        <Route path="/mehsul-bazasi/*" element={<MehsulBazasi />} />
        <Route path="/techizatci-bazasi/*" element={<TechizatciBazasi />} />
        <Route path="/inventar/*" element={<Inventar />} />
        <Route path="/musteri-bazasi/*" element={<MusteriBazasi />} />
        <Route path="/icloud/*" element={<Icloud />} />
        <Route path="/ayliq-yigim/*" element={<MonthlyTracking />} />
        <Route path="/qiymet-cedveli/*" element={<QiymetCedveliFeature />} />
        <Route path="/bazara-borc/*" element={<BazaraBorc />} />
        <Route path="/telefon-nomreleri/*" element={<TelefonNomreleri />} />
        <Route path="/" element={<Navigate to={placeholders[0].path} replace />} />
        <Route path="*" element={<Navigate to={placeholders[0]?.path ?? '/inventar'} replace />} />
      </Routes>
    </Layout>
  )
}

function App() {
  const { session, loading } = useAuth()
  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg)' }}>
        <p style={{ color: 'var(--color-text-muted)' }}>Yüklənir…</p>
      </div>
    )
  }
  if (!session) {
    return <Login />
  }
  return <AppRoutes />
}

export default function AppWithAuth() {
  return (
    <AuthProvider>
      <App />
    </AuthProvider>
  )
}
