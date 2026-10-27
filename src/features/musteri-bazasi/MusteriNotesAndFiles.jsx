import { useEffect, useRef, useState } from 'react'
import SenedlerField from '../../components/SenedlerField'
import { getFieldValue, isMusteriFormColumnActive } from './constants'
import './musteri-komment.css'

/**
 * Komment xanası: 2 sətirlik, tam en; komment varsa qırmızı çərçivə.
 * autosave=true (kartda baxış rejimi): yazılan dərhal görünür, bazaya
 * yazmaq dayandıqdan 0,7 san. sonra (və xanadan çıxanda) gedir — hər hərfdə yox.
 */
function KommentField({ label, value, onChange, autosave }) {
  const [draft, setDraft] = useState(value ?? '')
  const [status, setStatus] = useState('')
  const dirty = useRef(false)
  const timer = useRef(null)
  const saved = useRef(value ?? '')

  // Kənardan dəyər dəyişəndə (başqa qeyd açılanda) — yazmırıqsa yenilə
  useEffect(() => {
    if (!dirty.current) {
      setDraft(value ?? '')
      saved.current = value ?? ''
    }
  }, [value])

  useEffect(() => () => clearTimeout(timer.current), [])

  async function flush(text) {
    clearTimeout(timer.current)
    if (text === saved.current) {
      dirty.current = false
      return
    }
    setStatus('Saxlanılır…')
    try {
      await onChange(text)
      saved.current = text
      setStatus('Saxlanıldı')
    } catch {
      setStatus('Saxlanmadı')
    } finally {
      dirty.current = false
    }
  }

  function handleChange(e) {
    const text = e.target.value
    setDraft(text)
    if (!autosave) {
      onChange(text)
      return
    }
    dirty.current = true
    setStatus('')
    clearTimeout(timer.current)
    timer.current = setTimeout(() => flush(text), 700)
  }

  const has = String(draft || '').trim() !== ''

  return (
    <div className={`musteri-komment${has ? ' musteri-komment--has' : ''}`}>
      <label>
        {label}
        {autosave && status ? <span className="musteri-komment__status">{status}</span> : null}
      </label>
      <textarea
        rows={2}
        value={draft}
        onChange={handleChange}
        onBlur={() => autosave && dirty.current && flush(draft)}
        placeholder="Komment yazın…"
      />
    </div>
  )
}

/**
 * Kommentlər + Sənədlər together (not inside a category section).
 */
export default function MusteriNotesAndFiles({
  columns,
  form,
  onKommentChange,
  senedlerProps,
  asDetails = false,
  showKomment = true,
  showSenedler = true,
}) {
  const kommentCol = (columns || []).find((c) => c.key === 'kommentler')
  const kommentActive =
    showKomment &&
    kommentCol &&
    isMusteriFormColumnActive(columns, 'kommentler')
  const senedlerActive = showSenedler && isMusteriFormColumnActive(columns, 'senedler')

  if (!kommentActive && !senedlerActive) return null

  const body = (
    <div className="form-row" style={{ paddingTop: asDetails ? 8 : 0 }}>
      {kommentActive && (
        <div className="form-group" style={{ flex: '1 1 100%' }}>
          <KommentField
            label={kommentCol.label || 'Kommentlər'}
            value={getFieldValue(form, kommentCol)}
            onChange={onKommentChange}
            autosave={asDetails}
          />
        </div>
      )}
      {senedlerActive && senedlerProps && (
        <div className="form-group" style={{ flex: '1 1 100%' }}>
          <SenedlerField {...senedlerProps} />
        </div>
      )}
    </div>
  )

  if (asDetails) {
    return (
      <details className="collapse-section" open>
        <summary className="collapse-section__title">
          {[kommentActive ? 'Kommentlər' : null, senedlerActive ? 'Sənədlər' : null]
            .filter(Boolean)
            .join(' / ')}
        </summary>
        <div className="collapse-section__body">{body}</div>
      </details>
    )
  }

  return <div style={{ marginTop: 16 }}>{body}</div>
}
