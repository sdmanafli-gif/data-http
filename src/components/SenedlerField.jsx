import { useRef, useState } from 'react'
import {
  parseSenedler,
  senedlerPublicUrl,
  uploadSenedlerFiles,
  removeSenedlerFile,
} from '../lib/senedler'
import { confirmDelete } from '../lib/confirmDelete'
import './senedler-field.css'

/**
 * Multi-file attachments for a record (Supabase Storage).
 *
 * @param {object} props
 * @param {Array|{}} props.value - current senedler list
 * @param {(next: Array) => void} props.onChange
 * @param {string} props.folder - storage folder prefix (e.g. musteri_bazasi)
 * @param {string|null} props.recordId - DB id (required for upload)
 * @param {boolean} [props.readOnly]
 */
export default function SenedlerField({
  value,
  onChange,
  folder,
  recordId,
  readOnly = false,
  label = 'Sənədlər',
}) {
  const inputRef = useRef(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const files = parseSenedler(value)

  async function onPick(e) {
    const list = e.target.files
    e.target.value = ''
    if (!list?.length) return
    setError(null)
    if (!recordId) {
      setError('Əvvəlcə qeydi saxlayın, sonra sənəd əlavə edin.')
      return
    }
    setBusy(true)
    const { files: uploaded, error: upErr } = await uploadSenedlerFiles(folder, recordId, list)
    setBusy(false)
    if (upErr) setError(upErr)
    if (uploaded.length) onChange?.([...files, ...uploaded])
  }

  async function onRemove(idx) {
    const item = files[idx]
    if (!item) return
    if (!confirmDelete(`«${item.name}» silinsin?`)) return
    setBusy(true)
    setError(null)
    const err = await removeSenedlerFile(item.path)
    setBusy(false)
    if (err) {
      setError(err)
      return
    }
    onChange?.(files.filter((_, i) => i !== idx))
  }

  return (
    <div className="senedler-field">
      {label && <div className="senedler-field__label">{label}</div>}
      {error && <p className="senedler-field__error">{error}</p>}

      {files.length === 0 ? (
        <p className="senedler-field__empty">Fayl yoxdur</p>
      ) : (
        <ul className="senedler-field__list">
          {files.map((f, i) => (
            <li key={`${f.path}-${i}`}>
              <a href={senedlerPublicUrl(f.path)} target="_blank" rel="noopener noreferrer">
                {f.name || 'fayl'}
              </a>
              {!readOnly && (
                <button
                  type="button"
                  className="btn btn--secondary"
                  style={{ padding: '2px 8px', fontSize: 12 }}
                  disabled={busy}
                  onClick={() => onRemove(i)}
                >
                  Sil
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {!readOnly && (
        <div className="senedler-field__actions">
          <input
            ref={inputRef}
            type="file"
            multiple
            hidden
            onChange={onPick}
          />
          <button
            type="button"
            className="btn btn--secondary"
            disabled={busy || !recordId}
            title={!recordId ? 'Əvvəlcə qeydi saxlayın' : 'Fayl əlavə et'}
            onClick={() => inputRef.current?.click()}
          >
            {busy ? 'Yüklənir…' : 'Fayl əlavə et'}
          </button>
          {!recordId && (
            <span className="senedler-field__hint">Saxladıqdan sonra yükləyə bilərsiniz</span>
          )}
        </div>
      )}
    </div>
  )
}
