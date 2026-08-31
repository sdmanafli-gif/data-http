import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import '../styles/shared.css'

/**
 * Shown when an account was deleted / access revoked.
 * Intentional deadpan 404 copy.
 */
export default function AccountGone() {
  const { clearAccessRevoked } = useAuth()

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        background: 'var(--color-bg, #f4f4f5)',
      }}
    >
      <div
        className="card"
        style={{
          maxWidth: 420,
          width: '100%',
          textAlign: 'center',
          padding: '40px 28px',
        }}
      >
        <p
          style={{
            margin: '0 0 8px',
            fontSize: 64,
            fontWeight: 700,
            lineHeight: 1,
            letterSpacing: '-0.04em',
            color: 'var(--color-text, #18181b)',
          }}
        >
          404
        </p>
        <h1
          style={{
            margin: '0 0 12px',
            fontSize: 20,
            fontWeight: 600,
            lineHeight: 1.35,
          }}
        >
          Bu səhifə 2021-ci ildən mövcud deyil
        </h1>
        <p
          style={{
            margin: '0 0 24px',
            fontSize: 14,
            color: 'var(--color-text-muted, #71717a)',
            lineHeight: 1.5,
          }}
        >
          Giriş hüququnuz silinib. Yenidən daxil olmaq üçün adminlə əlaqə saxlayın.
        </p>
        <Link
          to="/daxil-ol"
          className="btn btn--primary"
          replace
          onClick={() => clearAccessRevoked()}
        >
          Giriş səhifəsinə qayıt
        </Link>
      </div>
    </div>
  )
}
