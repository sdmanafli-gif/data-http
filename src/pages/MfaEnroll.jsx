import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import '../styles/shared.css'
import './auth.css'

/**
 * Forced enroll after login when MFA_REQUIRED, or voluntary setup at /hesab/tehlukesizlik.
 */
export default function MfaEnroll({ forced = false }) {
  const {
    enrollTotp,
    verifyTotpEnrollment,
    unenrollTotp,
    listTotpFactors,
    signOut,
    mfa,
    mfaLoading,
    mfaRequired,
    isAdmin,
  } = useAuth()

  const [step, setStep] = useState('loading') // loading | ready | enroll | done
  const [factors, setFactors] = useState([])
  const [factorId, setFactorId] = useState(null)
  const [qrCode, setQrCode] = useState(null)
  const [secret, setSecret] = useState(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState(null)
  const [info, setInfo] = useState(null)

  async function loadFactors() {
    setError(null)
    try {
      const list = await listTotpFactors()
      const verified = list.filter((f) => f.status === 'verified')
      setFactors(verified)
      if (forced && verified.length === 0) {
        setStep('ready')
      } else if (!forced && verified.length > 0) {
        setStep('done')
      } else {
        setStep('ready')
      }
    } catch (err) {
      setError(err?.message ?? 'Faktorlar yüklənmədi.')
      setStep('ready')
    }
  }

  useEffect(() => {
    loadFactors()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function startEnroll() {
    setError(null)
    setInfo(null)
    try {
      const data = await enrollTotp('Mobideal')
      setFactorId(data.id)
      setQrCode(data.totp?.qr_code ?? null)
      setSecret(data.totp?.secret ?? null)
      setCode('')
      setStep('enroll')
    } catch (err) {
      setError(
        err?.message ??
          'Quraşdırma başladıla bilmədi. Supabase-də MFA (TOTP) aktivdir?',
      )
    }
  }

  async function confirmEnroll(e) {
    e.preventDefault()
    setError(null)
    const trimmed = code.replace(/\s/g, '')
    if (!/^\d{6}$/.test(trimmed)) {
      setError('6 rəqəmli kod daxil edin.')
      return
    }
    try {
      await verifyTotpEnrollment({ factorId, code: trimmed })
      setInfo('İki mərhələli təsdiq aktivləşdi.')
      setStep('done')
      await loadFactors()
    } catch (err) {
      setError(err?.message ?? 'Kod yanlışdır. Yenidən cəhd edin.')
    }
  }

  async function removeFactor(id) {
    // Admins may remove even the last authenticator (for themselves).
    if (mfaRequired && factors.length <= 1 && !isAdmin) {
      setError('MFA məcburidir — son authenticator silinə bilməz.')
      return
    }
    setError(null)
    try {
      await unenrollTotp(id)
      setInfo('Authenticator silindi.')
      await loadFactors()
    } catch (err) {
      setError(err?.message ?? 'Silmək mümkün olmadı.')
    }
  }

  const card = (
    <div className={`auth-card card${forced ? '' : ' mfa-settings-card'}`}>
      {forced ? <h1 className="auth-card__brand">Mobideal</h1> : null}
      <p className="auth-card__subtitle">
        {forced
          ? 'Davam etmək üçün authenticator tətbiqi ilə bir dəfəlik kod quraşdırın (Google Authenticator, Authy və s.).'
          : 'Girişdə paroldan sonra 6 rəqəmli bir dəfəlik kod tələb olunur.'}
      </p>

      {mfa.hasTotp && mfa.currentLevel === 'aal2' && (
        <p className="auth-card__success">MFA aktivdir (AAL2).</p>
      )}
      {info && <p className="auth-card__success">{info}</p>}
      {error && <p className="auth-card__error">{error}</p>}

      {step === 'loading' && <p className="auth-card__muted">Yüklənir…</p>}

      {step === 'ready' && (
        <button
          type="button"
          className="btn btn--primary"
          disabled={mfaLoading}
          onClick={startEnroll}
          style={{ width: '100%' }}
        >
          {mfaLoading ? 'Hazırlanır…' : 'Authenticator əlavə et'}
        </button>
      )}

      {step === 'enroll' && (
        <div className="mfa-enroll">
          {qrCode && (
            <div className="mfa-enroll__qr">
              {qrCode.startsWith('data:') || qrCode.startsWith('http') ? (
                <img src={qrCode} alt="Authenticator QR kodu" width={180} height={180} />
              ) : (
                <div dangerouslySetInnerHTML={{ __html: qrCode }} />
              )}
            </div>
          )}
          {secret && (
            <p className="mfa-enroll__secret">
              Əl ilə daxil etmək üçün sirri: <code>{secret}</code>
            </p>
          )}
          <form onSubmit={confirmEnroll}>
            <div className="form-group">
              <label htmlFor="mfa-enroll-code">Tətbiqdəki 6 rəqəmli kod</label>
              <input
                id="mfa-enroll-code"
                className="auth-otp-input"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                autoFocus
                required
              />
            </div>
            <button
              type="submit"
              className="btn btn--primary"
              disabled={mfaLoading}
              style={{ width: '100%' }}
            >
              {mfaLoading ? 'Yoxlanılır…' : 'Aktivləşdir'}
            </button>
          </form>
        </div>
      )}

      {step === 'done' && factors.length > 0 && (
        <ul className="mfa-factor-list">
          {factors.map((f) => (
            <li key={f.id} className="mfa-factor-list__item">
              <span>{f.friendly_name || 'Authenticator'}</span>
              {!forced && (
                <button
                  type="button"
                  className="btn btn--secondary btn--sm"
                  disabled={mfaLoading}
                  onClick={() => removeFactor(f.id)}
                >
                  Sil
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {step === 'done' && !forced && (
        <button
          type="button"
          className="btn btn--secondary"
          disabled={mfaLoading}
          onClick={startEnroll}
          style={{ width: '100%', marginTop: 12 }}
        >
          Başqa authenticator əlavə et
        </button>
      )}

      {forced && (
        <p className="auth-card__footer">
          <button type="button" className="auth-text-btn" onClick={() => signOut()}>
            Çıxış
          </button>
        </p>
      )}

      {!forced && (
        <p className="auth-card__footer">
          <Link to="/musteri-bazasi">← Geri</Link>
        </p>
      )}
    </div>
  )

  if (forced) {
    return <div className="auth-page">{card}</div>
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Təhlükəsizlik</h1>
      </div>
      {card}
    </div>
  )
}
