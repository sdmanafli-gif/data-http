import { useId, useState } from 'react'
import { parseSenedler, senedlerPublicUrl, uploadSenedlerFiles, removeSenedlerFile } from '../../lib/senedler'
import { confirmDelete } from '../../lib/confirmDelete'

/**
 * Depo: 3 fayl yeri ("Haradan" qutusunun içində).
 * Fayllar əvvəlki kimi depo.senedler sütununda saxlanılır, hər faylda `slot` (1–3) olur.
 * Köhnə qeydlərdə 3-dən çox fayl varsa, artıqları "Digər fayllar" kimi göstərilir — heç nə itmir.
 */
export const DEPO_FILE_SLOTS = [1, 2, 3]

/** Faylları 1–3 yerə paylayır (yeri olmayan köhnə faylları ilk boş yerə qoyur) */
export function depoFilesWithSlots(value) {
  const list = parseSenedler(value).map((f) => ({ ...f }))
  const used = new Set(list.map((f) => Number(f.slot)).filter((n) => DEPO_FILE_SLOTS.includes(n)))
  for (const f of list) {
    if (DEPO_FILE_SLOTS.includes(Number(f.slot))) continue
    const free = DEPO_FILE_SLOTS.find((n) => !used.has(n))
    if (free === undefined) break
    f.slot = free
    used.add(free)
  }
  return list
}

/** Yeni qeyd saxlandıqdan sonra gözləyən faylları yükləyir */
export async function uploadPendingSlots(recordId, existing, pending) {
  let files = depoFilesWithSlots(existing)
  let lastError = null
  for (const slot of DEPO_FILE_SLOTS) {
    const file = pending?.[slot]
    if (!file) continue
    const { files: up, error } = await uploadSenedlerFiles('depo', recordId, [file])
    if (error) lastError = error
    if (up[0]) files = [...files.filter((f) => Number(f.slot) !== slot), { ...up[0], slot }]
  }
  return { files, error: lastError }
}

function Slot({ slot, file, pendingFile, enabled, onPick, onRemove }) {
  const inputId = useId()
  const [busy, setBusy] = useState(false)
  const shown = file || (pendingFile ? { name: pendingFile.name } : null)

  return (
    <div className="depo-file-slot">
      <span className="depo-file-slot__label">Fayl {slot}</span>
      <span className="depo-file-slot__name">
        {file ? (
          <a href={senedlerPublicUrl(file.path)} target="_blank" rel="noreferrer">
            {file.name || 'fayl'}
          </a>
        ) : pendingFile ? (
          <span title="Qeyd saxlananda yüklənəcək">{pendingFile.name} (saxlananda yüklənəcək)</span>
        ) : (
          <span style={{ color: 'var(--color-text-muted)' }}>Fayl yoxdur</span>
        )}
      </span>
      <input
        id={inputId}
        type="file"
        accept="image/*,application/pdf"
        style={{ display: 'none' }}
        disabled={!enabled || busy}
        onChange={async (e) => {
          const picked = Array.from(e.target.files || [])[0]
          e.target.value = ''
          if (!picked) return
          setBusy(true)
          await onPick(picked)
          setBusy(false)
        }}
      />
      <label
        htmlFor={inputId}
        className="btn btn--secondary depo-file-slot__btn"
        style={{ opacity: enabled && !busy ? 1 : 0.5, cursor: enabled && !busy ? 'pointer' : 'not-allowed' }}
      >
        {busy ? 'Yüklənir…' : shown ? 'Dəyiş' : 'Fayl yüklə'}
      </label>
      {shown && (
        <button
          type="button"
          className="btn btn--secondary depo-file-slot__btn"
          disabled={!enabled || busy}
          onClick={async () => {
            setBusy(true)
            await onRemove()
            setBusy(false)
          }}
        >
          Sil
        </button>
      )}
    </div>
  )
}

/**
 * @param {{
 *   value: any,                       // depo.senedler
 *   recordId: string|null,            // yoxdursa (yeni qeyd) fayllar gözləyir, saxlananda yüklənir
 *   pending?: Record<number, File>,
 *   onPendingChange?: (p) => void,
 *   onChange: (nextFiles) => Promise<boolean>,  // bazaya yazır
 *   readOnly?: boolean,
 * }} p
 */
export default function DepoFileSlots({ value, recordId, pending = {}, onPendingChange, onChange, readOnly = false }) {
  const [error, setError] = useState(null)
  const files = depoFilesWithSlots(value)
  const extra = files.filter((f) => !DEPO_FILE_SLOTS.includes(Number(f.slot)))
  const enabled = !readOnly && (Boolean(recordId) || Boolean(onPendingChange))

  async function pick(slot, file) {
    setError(null)
    if (!recordId) {
      onPendingChange?.({ ...pending, [slot]: file })
      return
    }
    const old = files.find((f) => Number(f.slot) === slot) || null
    const { files: up, error: upErr } = await uploadSenedlerFiles('depo', recordId, [file])
    if (upErr) setError(upErr)
    if (!up[0]) return
    const ok = await onChange([...files.filter((f) => Number(f.slot) !== slot), { ...up[0], slot }])
    if (ok && old) await removeSenedlerFile(old.path)
  }

  async function remove(slot, file) {
    setError(null)
    if (!file) {
      const next = { ...pending }
      delete next[slot]
      onPendingChange?.(next)
      return
    }
    if (!confirmDelete(`«${file.name}» silinsin?`)) return
    const ok = await onChange(files.filter((f) => f !== file))
    if (ok) {
      const e2 = await removeSenedlerFile(file.path)
      if (e2) setError(e2)
    }
  }

  return (
    <div className="depo-files">
      <div className="depo-files__title">Fayllar</div>
      {DEPO_FILE_SLOTS.map((slot) => {
        const file = files.find((f) => Number(f.slot) === slot) || null
        return (
          <Slot
            key={slot}
            slot={slot}
            file={file}
            pendingFile={file ? null : pending[slot] || null}
            enabled={enabled}
            onPick={(f) => pick(slot, f)}
            onRemove={() => remove(slot, file)}
          />
        )
      })}
      {extra.length > 0 && (
        <div className="depo-files__extra">
          <span className="depo-file-slot__label">Digər fayllar</span>
          {extra.map((f) => (
            <span key={f.path} className="depo-files__extra-item">
              <a href={senedlerPublicUrl(f.path)} target="_blank" rel="noreferrer">
                {f.name || 'fayl'}
              </a>
              {!readOnly && (
                <button
                  type="button"
                  className="btn btn--secondary depo-file-slot__btn"
                  onClick={() => remove(null, f)}
                >
                  Sil
                </button>
              )}
            </span>
          ))}
        </div>
      )}
      {error && <div style={{ color: 'var(--color-accent)', fontSize: 12 }}>{error}</div>}
    </div>
  )
}
