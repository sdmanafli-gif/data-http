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

function MissingConfig() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        background: 'var(--color-bg, #f5f5f5)',
      }}
    >
      <div style={{ maxWidth: 480, textAlign: 'center' }}>
        <h1 style={{ fontSize: '1.25rem', marginBottom: 12 }}>Konfiqurasiya çatışmır</h1>
        <p style={{ color: 'var(--color-text-muted, #666)', lineHeight: 1.5 }}>
          Netlify-də <strong>VITE_SUPABASE_URL</strong> və <strong>VITE_SUPABASE_ANON_KEY</strong>{' '}
          əlavə edin, sonra saytı yenidən deploy edin. Bundan sonra giriş səhifəsi görünəcək.
        </p>
      </div>
    </div>
  )
}

function App() {
  const { session, loading, configured } = useAuth()

  if (!configured) {
    return <MissingConfig />
  }

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
