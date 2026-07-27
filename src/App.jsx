import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import Layout from './layout/Layout'
import SignIn from './pages/SignIn'
import SignUp from './pages/SignUp'
import InviteUser from './pages/InviteUser'
import UserList from './pages/UserList'
import MusteriBazasi from './features/musteri-bazasi'
import MehkemeList from './features/musteri-bazasi/MehkemeList'
import YigimPage from './features/yigim'
import OdenislerFeature from './features/odenisler'
import DepoFeature from './features/depo'
import NagdSatishFeature from './features/nagd-satish'
import BorcNisyeFeature from './features/borc-nisye'

function AppRoutes() {
  return (
    <Layout>
      <Routes>
        <Route path="/admin/invite" element={<InviteUser />} />
        <Route path="/admin/users" element={<UserList />} />
        <Route path="/musteri-bazasi/*" element={<MusteriBazasi />} />
        <Route path="/yigim" element={<YigimPage />} />
        <Route
          path="/mehkeme"
          element={
            <>
              <div className="page-header">
                <h1>Məhkəmə</h1>
              </div>
              <MehkemeList />
            </>
          }
        />
        <Route path="/odenisler/*" element={<OdenislerFeature />} />
        <Route path="/depo/*" element={<DepoFeature />} />
        <Route path="/nagd-satish/*" element={<NagdSatishFeature />} />
        <Route path="/borc-nisye/*" element={<BorcNisyeFeature />} />
        <Route path="/" element={<Navigate to="/musteri-bazasi" replace />} />
        <Route path="*" element={<Navigate to="/musteri-bazasi" replace />} />
      </Routes>
    </Layout>
  )
}

function App() {
  const { session, loading } = useAuth()

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--color-bg)',
        }}
      >
        <p style={{ color: 'var(--color-text-muted)' }}>Yüklənir…</p>
      </div>
    )
  }

  if (!session) {
    return (
      <Routes>
        <Route path="/daxil-ol" element={<SignIn />} />
        <Route path="/qeydiyyat" element={<SignUp />} />
        <Route path="*" element={<SignIn />} />
      </Routes>
    )
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
