import { useId, useRef, useState } from 'react'
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
 * On new records (no recordId), files can be staged as pending and uploaded after save.
 */
export default function SenedlerField({
  value,
  onChange,
  folder,
  recordId,
  readOnly = false,
  label = 'Sənədlər',
  pendingFiles = [],
  onPendingChange,
}) {
  const inputRef = useRef(null)
  const inputId = useId()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const files = parseSenedler(value)
  const canStagePending = Boolean(onPendingChange) && !recordId
  const pickEnabled = !busy && !readOnly && (Boolean(recordId) || canStagePending)

  async function onPick(e) {
    // Copy FileList before resetting input — clearing value can empty a live FileList
    const picked = Array.from(e.target.files || [])
    e.target.value = ''
    if (!picked.length) return
    setError(null)

    if (!recordId) {
      if (!canStagePending) {
        setError('Əvvəlcə qeydi saxlayın, sonra sənəd əlavə edin.')
        return
      }
      onPendingChange?.([...pendingFiles, ...picked])
      return
    }

    setBusy(true)
    const { files: uploaded, error: upErr } = await uploadSenedlerFiles(folder, recordId, picked)
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

  function onRemovePending(idx) {
    const item = pendingFiles[idx]
    if (!item) return
    if (!confirmDelete(`«${item.name}» silinsin?`)) return
    onPendingChange?.(pendingFiles.filter((_, i) => i !== idx))
  }

  return (
    <div className="senedler-field">
      {label && <div className="senedler-field__label">{label}</div>}
      {error && <p className="senedler-field__error">{error}</p>}

      {files.length === 0 && pendingFiles.length === 0 ? (
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
          {pendingFiles.map((f, i) => (
            <li key={`pending-${f.name}-${f.size}-${i}`}>
              <span>{f.name || 'fayl'} (gözləyir)</span>
              {!readOnly && (
                <button
                  type="button"
                  className="btn btn--secondary"
                  style={{ padding: '2px 8px', fontSize: 12 }}
                  disabled={busy}
                  onClick={() => onRemovePending(i)}
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
            id={inputId}
            ref={inputRef}
            type="file"
            multiple
            className="senedler-field__file-input"
            disabled={!pickEnabled}
            onChange={onPick}
          />
          <label
            htmlFor={inputId}
            className={`btn btn--secondary senedler-field__pick${pickEnabled ? '' : ' senedler-field__pick--disabled'}`}
            aria-disabled={!pickEnabled}
            title={pickEnabled ? 'Fayl əlavə et' : 'Əvvəlcə qeydi saxlayın'}
          >
            {busy ? 'Yüklənir…' : 'Fayl əlavə et'}
          </label>
          {canStagePending && (
            <span className="senedler-field__hint">
              {pendingFiles.length
                ? `${pendingFiles.length} fayl saxlandıqdan sonra yüklənəcək`
                : 'Seçilmiş fayllar saxlandıqdan sonra yüklənəcək'}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
