import { useState } from 'react'
import { supabase } from '../../lib/supabase'

/**
 * Depo: Məhsul Kateqoriyası (qrup) → Növ.
 * Siyahı depo_kateqoriyalar cədvəlindədir (parent_id boş = qrup, dolu = həmin qrupun növü).
 * Depo qeydində adlar saxlanılır: depo.kateqoriya və depo.nov.
 */
export const KATEQORIYA_TABLE = 'depo_kateqoriyalar'
const NEW = '__new__'

export async function loadKateqoriyalar() {
  const { data, error } = await supabase
    .from(KATEQORIYA_TABLE)
    .select('id, ad, parent_id, sira')
    .order('sira', { ascending: true })
    .order('ad', { ascending: true })
  if (error) return { data: [], error }
  return { data: data || [], error: null }
}

const lc = (s) => String(s || '').trim().toLocaleLowerCase('az')

function AddInline({ placeholder, busy, onAdd, onCancel }) {
  const [text, setText] = useState('')
  return (
    <div className="depo-inline" style={{ marginTop: 6 }}>
      <input
        autoFocus
        placeholder={placeholder}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            if (text.trim()) onAdd(text.trim())
          }
          if (e.key === 'Escape') onCancel()
        }}
      />
      <button
        type="button"
        className="btn btn--primary depo-file-slot__btn"
        disabled={busy || !text.trim()}
        onClick={() => onAdd(text.trim())}
      >
        {busy ? 'Əlavə olunur…' : 'Əlavə et'}
      </button>
      <button type="button" className="btn btn--secondary depo-file-slot__btn" disabled={busy} onClick={onCancel}>
        Ləğv et
      </button>
    </div>
  )
}

/**
 * @param {{
 *   list: {id,ad,parent_id,sira}[],
 *   setList: (fn) => void,
 *   kateqoriya: string, nov: string,
 *   onChange: (patch: {kateqoriya?: string, nov?: string}) => void,
 * }} p
 */
export default function DepoKateqoriyaBlock({ list, setList, kateqoriya, nov, onChange }) {
  const [adding, setAdding] = useState(null) // 'group' | 'type' | null
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const groups = list.filter((x) => !x.parent_id)
  const group = groups.find((g) => lc(g.ad) === lc(kateqoriya)) || null
  const types = group ? list.filter((x) => x.parent_id === group.id) : []
  const legacyGroup = kateqoriya && !group ? kateqoriya : null
  const legacyType = nov && !types.some((t) => lc(t.ad) === lc(nov)) ? nov : null

  async function add(name, parentId) {
    setError(null)
    const siblings = list.filter((x) => (x.parent_id || null) === (parentId || null))
    const existing = siblings.find((x) => lc(x.ad) === lc(name))
    if (existing) return existing
    setBusy(true)
    const sira = siblings.reduce((m, x) => Math.max(m, Number(x.sira) || 0), 0) + 1
    const { data, error: e } = await supabase
      .from(KATEQORIYA_TABLE)
      .insert({ ad: name, parent_id: parentId || null, sira })
      .select('id, ad, parent_id, sira')
      .single()
    setBusy(false)
    if (e) {
      setError(
        /does not exist|schema cache/i.test(e.message || '')
          ? 'Bazada kateqoriya cədvəli hələ yoxdur (SQL 38 işə salınmalıdır).'
          : e.message
      )
      return null
    }
    setList((prev) => [...prev, data])
    return data
  }

  return (
    <div className="depo-box">
      <div className="form-group" style={{ marginBottom: 0 }}>
        <label>Məhsul Kateqoriyası</label>
        <select
          value={adding === 'group' ? NEW : group ? group.ad : kateqoriya || ''}
          onChange={(e) => {
            const v = e.target.value
            if (v === NEW) {
              setAdding('group')
              return
            }
            setAdding(null)
            onChange({ kateqoriya: v, nov: '' })
          }}
        >
          <option value="">— Seçin —</option>
          <option value={NEW}>+ Yeni Qrup</option>
          {legacyGroup && <option value={legacyGroup}>{legacyGroup}</option>}
          {groups.map((g) => (
            <option key={g.id} value={g.ad}>
              {g.ad}
            </option>
          ))}
        </select>
        {adding === 'group' && (
          <AddInline
            placeholder="Yeni qrupun adı (məs. Planşet)"
            busy={busy}
            onCancel={() => setAdding(null)}
            onAdd={async (name) => {
              const row = await add(name, null)
              if (row) {
                setAdding(null)
                onChange({ kateqoriya: row.ad, nov: '' })
              }
            }}
          />
        )}
      </div>

      {(group || legacyGroup) && adding !== 'group' && (
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>Növ</label>
          <select
            value={adding === 'type' ? NEW : legacyType || (types.find((t) => lc(t.ad) === lc(nov))?.ad ?? '')}
            onChange={(e) => {
              const v = e.target.value
              if (v === NEW) {
                setAdding('type')
                return
              }
              setAdding(null)
              onChange({ nov: v })
            }}
          >
            <option value="">— Seçin —</option>
            {group && <option value={NEW}>+ Yeni Növ</option>}
            {legacyType && <option value={legacyType}>{legacyType}</option>}
            {types.map((t) => (
              <option key={t.id} value={t.ad}>
                {t.ad}
              </option>
            ))}
          </select>
          {adding === 'type' && group && (
            <AddInline
              placeholder={`${group.ad} üçün yeni növ`}
              busy={busy}
              onCancel={() => setAdding(null)}
              onAdd={async (name) => {
                const row = await add(name, group.id)
                if (row) {
                  setAdding(null)
                  onChange({ nov: row.ad })
                }
              }}
            />
          )}
        </div>
      )}
      {error && <p style={{ color: 'var(--color-accent)', fontSize: 12, margin: 0 }}>{error}</p>}
    </div>
  )
}
