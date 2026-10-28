import { useEffect, useMemo, useState } from 'react'
import { supabase, fetchAllPages } from '../lib/supabase'
import { confirmDelete } from '../lib/confirmDelete'
import { useAuth } from '../contexts/AuthContext'
import '../styles/shared.css'
import './nomreler.css'

/**
 * Nömrələr — mağazanın SIM nömrələri və balans artırma vaxtları.
 * Nömrə · Kimin adınadır · Son balans artırılma · Neçə gündən bir · Növbəti tarix (hesablanır).
 */

const TABLE = 'nomreler'
const SOON_DAYS = 3

function todayYmd() {
  const d = new Date()
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}

function addDaysYmd(ymd, days) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(ymd || ''))
  const n = Number(days)
  if (!m || !Number.isFinite(n)) return ''
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + n)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

function daysBetween(fromYmd, toYmd) {
  const a = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(fromYmd || ''))
  const b = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(toYmd || ''))
  if (!a || !b) return null
  const da = Date.UTC(+a[1], +a[2] - 1, +a[3])
  const db = Date.UTC(+b[1], +b[2] - 1, +b[3])
  return Math.round((db - da) / 86400000)
}

function dmy(ymd) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(ymd || ''))
  return m ? `${m[3]}.${m[2]}.${m[1]}` : '—'
}

function emptyForm() {
  return { nomre: '', kimin_adina: '', son_artirma: todayYmd(), gun_araligi: '30', qeyd: '' }
}

function withNext(row, today) {
  const novbeti = row.son_artirma && row.gun_araligi ? addDaysYmd(row.son_artirma, row.gun_araligi) : ''
  const qalib = novbeti ? daysBetween(today, novbeti) : null
  let status = 'none'
  if (qalib != null) status = qalib < 0 ? 'late' : qalib <= SOON_DAYS ? 'soon' : 'ok'
  return { ...row, novbeti, qalib, status }
}

function qalibText(q) {
  if (q == null) return '—'
  if (q < 0) return `${-q} gün keçib`
  if (q === 0) return 'Bu gün'
  return `${q} gün qalıb`
}

export default function NomrelerPage() {
  const { access } = useAuth()
  const canEdit = access.isAdmin || access.canEdit('nomreler')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [form, setForm] = useState(null) // null | { id?, ...fields }
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState(null)

  async function load() {
    setLoading(true)
    setError('')
    const { data, error: e } = await fetchAllPages(() => supabase.from(TABLE).select('*'))
    if (e) setError(e.message)
    else setRows(data || [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const today = todayYmd()
  const list = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('az')
    return rows
      .map((r) => withNext(r, today))
      .filter((r) => !q || `${r.nomre || ''} ${r.kimin_adina || ''} ${r.qeyd || ''}`.toLocaleLowerCase('az').includes(q))
      .sort((a, b) => {
        // Vaxtı yaxın olanlar yuxarıda; tarixi olmayanlar ən aşağıda
        if (a.qalib == null && b.qalib == null) return String(a.nomre).localeCompare(String(b.nomre))
        if (a.qalib == null) return 1
        if (b.qalib == null) return -1
        return a.qalib - b.qalib
      })
  }, [rows, search, today])

  const counts = useMemo(() => {
    const all = rows.map((r) => withNext(r, today))
    return {
      late: all.filter((r) => r.status === 'late').length,
      soon: all.filter((r) => r.status === 'soon').length,
      total: all.length,
    }
  }, [rows, today])

  async function save(e) {
    e.preventDefault()
    if (!form) return
    const nomre = String(form.nomre || '').trim()
    if (!nomre) {
      setError('Nömrəni yazın.')
      return
    }
    const gun = String(form.gun_araligi || '').trim()
    if (gun && !(Number(gun) > 0)) {
      setError('«Neçə gündən bir» müsbət rəqəm olmalıdır.')
      return
    }
    const payload = {
      nomre,
      kimin_adina: String(form.kimin_adina || '').trim() || null,
      son_artirma: form.son_artirma || null,
      gun_araligi: gun ? Math.round(Number(gun)) : null,
      qeyd: String(form.qeyd || '').trim() || null,
      updated_at: new Date().toISOString(),
    }
    setSaving(true)
    setError('')
    const { error: e2 } = form.id
      ? await supabase.from(TABLE).update(payload).eq('id', form.id)
      : await supabase.from(TABLE).insert(payload)
    setSaving(false)
    if (e2) {
      setError(e2.message)
      return
    }
    setForm(null)
    load()
  }

  async function markToday(row) {
    setBusyId(row.id)
    setError('')
    const { error: e } = await supabase
      .from(TABLE)
      .update({ son_artirma: today, updated_at: new Date().toISOString() })
      .eq('id', row.id)
    setBusyId(null)
    if (e) setError(e.message)
    else setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, son_artirma: today } : r)))
  }

  async function remove(row) {
    if (!confirmDelete(`${row.nomre}${row.kimin_adina ? ` — ${row.kimin_adina}` : ''}\n\nBu nömrə silinsin?`)) return
    setBusyId(row.id)
    const { error: e } = await supabase.from(TABLE).delete().eq('id', row.id)
    setBusyId(null)
    if (e) setError(e.message)
    else setRows((prev) => prev.filter((r) => r.id !== row.id))
  }

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))
  const formNext =
    form && form.son_artirma && Number(form.gun_araligi) > 0 ? addDaysYmd(form.son_artirma, form.gun_araligi) : ''

  return (
    <div>
      <div className="page-header" style={{ marginBottom: 16 }}>
        <h1>Nömrələr</h1>
        {canEdit && !form && (
          <button type="button" className="btn btn--primary" onClick={() => setForm(emptyForm())}>
            Yeni nömrə
          </button>
        )}
      </div>

      <div className="nomre-summary">
        <span className="nomre-chip nomre-chip--late">Vaxtı keçib: {counts.late}</span>
        <span className="nomre-chip nomre-chip--soon">{SOON_DAYS} gün içində: {counts.soon}</span>
        <span className="nomre-chip">Cəmi: {counts.total}</span>
      </div>

      {error && <p style={{ color: 'var(--color-accent)' }}>{error}</p>}

      {form && (
        <form className="card nomre-form" onSubmit={save}>
          <h2 className="card__title" style={{ marginTop: 0 }}>{form.id ? 'Nömrəni redaktə et' : 'Yeni nömrə'}</h2>
          <div className="nomre-form__grid">
            <div className="form-group">
              <label>Nömrə *</label>
              <input value={form.nomre} onChange={(e) => set('nomre', e.target.value)} placeholder="050 123 45 67" inputMode="tel" autoFocus />
            </div>
            <div className="form-group">
              <label>Kimin adınadır</label>
              <input value={form.kimin_adina} onChange={(e) => set('kimin_adina', e.target.value)} placeholder="Ad Soyad" />
            </div>
            <div className="form-group">
              <label>Son balans artırılma vaxtı</label>
              <input type="date" value={form.son_artirma || ''} onChange={(e) => set('son_artirma', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Neçə gün sonra artırılmalıdır</label>
              <input type="number" min="1" step="1" value={form.gun_araligi} onChange={(e) => set('gun_araligi', e.target.value)} placeholder="30" />
            </div>
            <div className="form-group">
              <label>Hansı tarixə düşür</label>
              <input readOnly value={formNext ? dmy(formNext) : '—'} />
            </div>
            <div className="form-group nomre-form__wide">
              <label>Qeyd</label>
              <input value={form.qeyd} onChange={(e) => set('qeyd', e.target.value)} placeholder="məs. Azercell, tarif…" />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button type="submit" className="btn btn--primary" disabled={saving}>
              {saving ? 'Saxlanılır…' : 'Saxla'}
            </button>
            <button type="button" className="btn btn--secondary" onClick={() => setForm(null)} disabled={saving}>
              Ləğv et
            </button>
          </div>
        </form>
      )}

      <div className="card">
        <div className="form-group" style={{ maxWidth: 360, marginBottom: 12 }}>
          <label>Axtarış</label>
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nömrə, ad, qeyd…" />
        </div>
        {loading ? (
          <p className="empty-state">Yüklənir…</p>
        ) : list.length === 0 ? (
          <p className="empty-state">{rows.length ? 'Axtarışa uyğun nömrə yoxdur.' : 'Hələ nömrə əlavə olunmayıb.'}</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table nomre-table">
              <thead>
                <tr>
                  <th>Nömrə</th>
                  <th>Kimin adınadır</th>
                  <th>Son balans artırılma</th>
                  <th className="num">Neçə gündən bir</th>
                  <th>Hansı tarixə düşür</th>
                  <th>Vəziyyət</th>
                  {canEdit && <th></th>}
                </tr>
              </thead>
              <tbody>
                {list.map((r) => (
                  <tr key={r.id} className={`nomre-row nomre-row--${r.status}`}>
                    <td className="nomre-table__no">{r.nomre}</td>
                    <td>
                      {r.kimin_adina || '—'}
                      {r.qeyd ? <div className="nomre-table__qeyd">{r.qeyd}</div> : null}
                    </td>
                    <td>{dmy(r.son_artirma)}</td>
                    <td className="num">{r.gun_araligi ? `${r.gun_araligi} gün` : '—'}</td>
                    <td className="nomre-table__next">{r.novbeti ? dmy(r.novbeti) : '—'}</td>
                    <td>
                      <span className={`nomre-badge nomre-badge--${r.status}`}>{qalibText(r.qalib)}</span>
                    </td>
                    {canEdit && (
                      <td>
                        <div className="nomre-actions">
                          <button
                            type="button"
                            className="btn btn--primary"
                            disabled={busyId === r.id || r.son_artirma === today}
                            onClick={() => markToday(r)}
                            title="Son balans artırılma tarixini bu günə yazır"
                          >
                            {r.son_artirma === today ? 'Bu gün artırılıb' : 'Bu gün artırdım'}
                          </button>
                          <button
                            type="button"
                            className="btn btn--secondary"
                            onClick={() =>
                              setForm({
                                id: r.id,
                                nomre: r.nomre || '',
                                kimin_adina: r.kimin_adina || '',
                                son_artirma: r.son_artirma || '',
                                gun_araligi: r.gun_araligi != null ? String(r.gun_araligi) : '',
                                qeyd: r.qeyd || '',
                              })
                            }
                          >
                            Redaktə
                          </button>
                          <button type="button" className="btn btn--secondary" style={{ color: 'var(--color-accent)' }} disabled={busyId === r.id} onClick={() => remove(r)}>
                            Sil
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
