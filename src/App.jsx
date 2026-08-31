import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import Layout from './layout/Layout'
import SignIn from './pages/SignIn'
import SignUp from './pages/SignUp'
import InviteUser from './pages/InviteUser'
import UserList from './pages/UserList'
import KassaDesk from './pages/KassaDesk'
import MfaChallenge from './pages/MfaChallenge'
import MfaEnroll from './pages/MfaEnroll'
import MusteriBazasi from './features/musteri-bazasi'
import MehkemeList from './features/musteri-bazasi/MehkemeList'
import ColumnManager from './features/musteri-bazasi/ColumnManager'
import { MEHKEME_COLUMN_SETTINGS_KEY } from './features/musteri-bazasi/constants'
import YigimPage from './features/yigim'
import OdenislerFeature from './features/odenisler'
import DepoFeature from './features/depo'
import NagdSatishFeature from './features/nagd-satish'
import BorcNisyeFeature from './features/borc-nisye'

function RequireAccess({ children }) {
  const { access } = useAuth()
  const location = useLocation()
  if (!access.canAccessPath(location.pathname)) {
    return <Navigate to={access.firstAllowedPath()} replace />
  }
  return children
}

function MehkemeFeature() {
  const location = useLocation()
  const hideHeader = location.pathname.includes('/sutunlar')

  return (
    <>
      {!hideHeader && (
        <div className="page-header">
          <h1>Məhkəmə</h1>
        </div>
      )}
      <Routes>
        <Route index element={<MehkemeList />} />
        <Route
          path="sutunlar"
          element={
            <ColumnManager
              tableKey={MEHKEME_COLUMN_SETTINGS_KEY}
              title="Məhkəmə — sütunları idarə et"
              backTo="/mehkeme"
              description="Bütün Müştəri Bazası sütunları + məhkəmə sahələri. Görünüş, sıra və en yalnız Məhkəmə səhifəsi üçündür (Müştəri Bazasına təsir etmir)."
            />
          }
        />
        <Route path="*" element={<Navigate to="/mehkeme" replace />} />
      </Routes>
    </>
  )
}

function AppRoutes() {
  const { access } = useAuth()
  const home = access.firstAllowedPath()

  return (
    <Layout>
      <Routes>
        <Route path="/admin/invite" element={<InviteUser />} />
        <Route path="/admin/users" element={<UserList />} />
        <Route path="/admin/kassa" element={<KassaDesk />} />
        <Route path="/hesab/tehlukesizlik" element={<MfaEnroll forced={false} />} />
        <Route
          path="/musteri-bazasi/*"
          element={
            <RequireAccess>
              <MusteriBazasi />
            </RequireAccess>
          }
        />
        <Route
          path="/yigim/*"
          element={
            <RequireAccess>
              <YigimPage />
            </RequireAccess>
          }
        />
        <Route
          path="/mehkeme/*"
          element={
            <RequireAccess>
              <MehkemeFeature />
            </RequireAccess>
          }
        />
        <Route
          path="/odenisler/*"
          element={
            <RequireAccess>
              <OdenislerFeature />
            </RequireAccess>
          }
        />
        <Route
          path="/depo/*"
          element={
            <RequireAccess>
              <DepoFeature />
            </RequireAccess>
          }
        />
        <Route
          path="/nagd-satish/*"
          element={
            <RequireAccess>
              <NagdSatishFeature />
            </RequireAccess>
          }
        />
        <Route
          path="/borc-nisye/*"
          element={
            <RequireAccess>
              <BorcNisyeFeature />
            </RequireAccess>
          }
        />
        <Route path="/" element={<Navigate to={home} replace />} />
        <Route path="*" element={<Navigate to={home} replace />} />
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
  const { session, loading, configured, mfa } = useAuth()

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

  // Password OK but MFA factor enrolled → need one-time code
  if (mfa.needsChallenge) {
    return <MfaChallenge />
  }

  // MFA required and not enrolled yet → force setup
  if (mfa.needsEnroll) {
    return <MfaEnroll forced />
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
