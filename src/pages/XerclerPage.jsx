import { useEffect, useMemo, useState } from 'react'
import { supabase, fetchAllPages } from '../lib/supabase'
import { confirmDelete } from '../lib/confirmDelete'
import { useAuth } from '../contexts/AuthContext'
import '../styles/shared.css'
import './analitika.css'
import './xercler.css'

/**
 * Xərclər — işə aid rasxodlar (icarə, maaş, kommunal…). Ay-ay baxış, kateqoriya üzrə bölgü.
 * Analitikada xalis mənfəətdən çıxılır.
 */

const TABLE = 'xercler'

export const XERC_KATEQORIYALAR = [
  'İcarə',
  'Maaş',
  'Kommunal (işıq, su, qaz)',
  'İnternet / telefon',
  'Reklam',
  'Vergi',
  'Nəqliyyat / yol',
  'Təmir',
  'Ləvazimat',
  'Yemək',
  'Bank / komissiya',
  'Digər',
]

const MONTHS_FULL = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'İyun', 'İyul', 'Avqust', 'Sentyabr', 'Oktyabr', 'Noyabr', 'Dekabr']
const MONTHS = ['Yan', 'Fev', 'Mar', 'Apr', 'May', 'İyn', 'İyl', 'Avq', 'Sen', 'Okt', 'Noy', 'Dek']
const COLORS = ['#c41e2a', '#2f6fed', '#1f8a65', '#d9a400', '#8e44ad', '#c45c26', '#16a2b8', '#6b6560', '#e67e22', '#2c3e50', '#7f8c8d', '#b9c3d6']

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100
const num = (v) => {
  const n = Number(String(v ?? '').replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

function azn(n) {
  const v = r2(n)
  const [i, d] = Math.abs(v).toFixed(2).split('.')
  return `${v < 0 ? '−' : ''}${i.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}${d === '00' ? '' : `,${d}`} ₼`
}

function todayYmd() {
  const d = new Date()
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}

function dmy(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || ''))
  return m ? `${m[3]}.${m[2]}.${m[1]}` : '—'
}

const monthKeyOf = (y, m) => `${y}-${String(m + 1).padStart(2, '0')}`

function emptyForm() {
  return { tarix: todayYmd(), kateqoriya: '', mebleg: '', odenis_usulu: 'nagd', qeyd: '' }
}

export default function XerclerPage() {
  const { access } = useAuth()
  const canEdit = access.isAdmin || access.canEdit('xercler')
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState(null)
  const [katFilter, setKatFilter] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    const { data, error: e } = await fetchAllPages(() =>
      supabase.from(TABLE).select('*').order('tarix', { ascending: false }).order('created_at', { ascending: false })
    )
    if (e) setError(e.message)
    else setRows(data || [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const mk = monthKeyOf(year, month)
  const monthRows = useMemo(
    () => rows.filter((r) => String(r.tarix || '').slice(0, 7) === mk),
    [rows, mk]
  )
  const shownRows = useMemo(
    () => (katFilter ? monthRows.filter((r) => r.kateqoriya === katFilter) : monthRows),
    [monthRows, katFilter]
  )
  const monthTotal = r2(monthRows.reduce((s, r) => s + num(r.mebleg), 0))

  // Kateqoriyalar üzrə bölgü (bu ay)
  const byKat = useMemo(() => {
    const m = new Map()
    for (const r of monthRows) m.set(r.kateqoriya, (m.get(r.kateqoriya) || 0) + num(r.mebleg))
    return [...m.entries()].map(([k, v]) => ({ k, v: r2(v) })).sort((a, b) => b.v - a.v)
  }, [monthRows])

  // Son 12 ay (seçilmiş aya qədər)
  const last12 = useMemo(() => {
    const out = []
    for (let i = 11; i >= 0; i -= 1) {
      const d = new Date(year, month - i, 1)
      const key = monthKeyOf(d.getFullYear(), d.getMonth())
      const sum = rows.filter((r) => String(r.tarix || '').slice(0, 7) === key).reduce((s, r) => s + num(r.mebleg), 0)
      out.push({ key, label: MONTHS[d.getMonth()], full: `${MONTHS_FULL[d.getMonth()]} ${d.getFullYear()}`, sum: r2(sum) })
    }
    return out
  }, [rows, year, month])

  const prevTotal = last12[10]?.sum || 0
  const yearTotal = r2(rows.filter((r) => String(r.tarix || '').slice(0, 4) === String(year)).reduce((s, r) => s + num(r.mebleg), 0))
  const kats = useMemo(() => {
    const set = new Set(XERC_KATEQORIYALAR)
    for (const r of rows) if (r.kateqoriya) set.add(r.kateqoriya)
    return [...set]
  }, [rows])

  function shift(dir) {
    const d = new Date(year, month + dir, 1)
    setYear(d.getFullYear())
    setMonth(d.getMonth())
    setKatFilter('')
  }

  async function save(e) {
    e.preventDefault()
    if (!form) return
    const kateqoriya = String(form.kateqoriya || '').trim()
    const mebleg = num(form.mebleg)
    if (!kateqoriya) {
      setError('Xərcin növünü seçin və ya yazın.')
      return
    }
    if (!(mebleg > 0)) {
      setError('Məbləği yazın.')
      return
    }
    if (!form.tarix) {
      setError('Tarixi seçin.')
      return
    }
    const payload = {
      tarix: form.tarix,
      kateqoriya,
      mebleg: r2(mebleg),
      odenis_usulu: form.odenis_usulu || null,
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
    // Yazılan xərcin ayına keç
    const [y, m] = form.tarix.split('-').map(Number)
    setYear(y)
    setMonth(m - 1)
    setForm(null)
    load()
  }

  async function remove(r) {
    if (!confirmDelete(`${dmy(r.tarix)} · ${r.kateqoriya} · ${azn(r.mebleg)}\n\nBu xərc silinsin?`)) return
    setBusyId(r.id)
    const { error: e } = await supabase.from(TABLE).delete().eq('id', r.id)
    setBusyId(null)
    if (e) setError(e.message)
    else setRows((prev) => prev.filter((x) => x.id !== r.id))
  }

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))
  const maxBar = Math.max(1, ...last12.map((m) => m.sum))

  return (
    <div className="an-page">
      <div className="page-header" style={{ marginBottom: 12 }}>
        <div>
          <h1 style={{ marginBottom: 4 }}>Xərclər</h1>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text-muted)' }}>
            İşə aid rasxodlar — ay-ay, növünə görə. Analitikada xalis mənfəətdən çıxılır.
          </p>
        </div>
        {canEdit && !form && (
          <button type="button" className="btn btn--primary" onClick={() => setForm(emptyForm())}>
            Yeni xərc
          </button>
        )}
      </div>

      <div className="an-periods">
        <button type="button" className="btn btn--secondary" onClick={() => shift(-1)}>
          ‹
        </button>
        <strong style={{ minWidth: 150, textAlign: 'center' }}>
          {MONTHS_FULL[month]} {year}
        </strong>
        <button type="button" className="btn btn--secondary" onClick={() => shift(1)}>
          ›
        </button>
        <button
          type="button"
          className="btn btn--secondary"
          onClick={() => {
            const n = new Date()
            setYear(n.getFullYear())
            setMonth(n.getMonth())
            setKatFilter('')
          }}
        >
          Bu ay
        </button>
      </div>

      {error && <p style={{ color: 'var(--color-accent)' }}>{error}</p>}

      {form && (
        <form className="card an-card xerc-form" onSubmit={save}>
          <h3 className="an-h3">{form.id ? 'Xərci redaktə et' : 'Yeni xərc'}</h3>
          <div className="xerc-form__grid">
            <label>
              Tarix *
              <input type="date" value={form.tarix} onChange={(e) => set('tarix', e.target.value)} />
            </label>
            <label>
              Nəyə xərclənib *
              <input
                list="xerc-kats"
                value={form.kateqoriya}
                onChange={(e) => set('kateqoriya', e.target.value)}
                placeholder="Seçin və ya yazın"
                autoFocus
              />
              <datalist id="xerc-kats">
                {kats.map((k) => (
                  <option key={k} value={k} />
                ))}
              </datalist>
            </label>
            <label>
              Məbləğ (₼) *
              <input type="number" min="0" step="0.01" value={form.mebleg} onChange={(e) => set('mebleg', e.target.value)} />
            </label>
            <label>
              Ödəniş üsulu
              <select value={form.odenis_usulu || ''} onChange={(e) => set('odenis_usulu', e.target.value)}>
                <option value="nagd">Nağd</option>
                <option value="hesab">Hesab</option>
              </select>
            </label>
            <label className="xerc-form__wide">
              Qeyd
              <input value={form.qeyd} onChange={(e) => set('qeyd', e.target.value)} placeholder="məs. oktyabr icarəsi, Elvinin maaşı…" />
            </label>
          </div>
          <div className="xerc-chips">
            {XERC_KATEQORIYALAR.map((k) => (
              <button
                key={k}
                type="button"
                className={`xerc-chip${form.kateqoriya === k ? ' xerc-chip--on' : ''}`}
                onClick={() => set('kateqoriya', k)}
              >
                {k}
              </button>
            ))}
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

      {loading ? (
        <div className="card">
          <p className="empty-state">Yüklənir…</p>
        </div>
      ) : (
        <>
          <div className="an-kpis">
            <div className="an-kpi an-kpi--bad">
              <div className="an-kpi__label">{MONTHS_FULL[month]} xərcləri</div>
              <div className="an-kpi__value">{azn(monthTotal)}</div>
              <div className="an-kpi__hint">
                {monthRows.length} qeyd
                {prevTotal > 0 && (
                  <>
                    {' · '}
                    <span className={monthTotal > prevTotal ? 'an-delta--down' : 'an-delta--up'}>
                      {monthTotal > prevTotal ? '▲' : '▼'} {Math.abs(Math.round(((monthTotal - prevTotal) / prevTotal) * 100))}%
                    </span>{' '}
                    keçən aya görə
                  </>
                )}
              </div>
            </div>
            <div className="an-kpi">
              <div className="an-kpi__label">Keçən ay ({last12[10] ? last12[10].full : ''})</div>
              <div className="an-kpi__value">{azn(prevTotal)}</div>
            </div>
            <div className="an-kpi">
              <div className="an-kpi__label">{year} ili cəmi</div>
              <div className="an-kpi__value">{azn(yearTotal)}</div>
            </div>
            <div className="an-kpi">
              <div className="an-kpi__label">Son 12 ay orta / ay</div>
              <div className="an-kpi__value">{azn(last12.reduce((s, m) => s + m.sum, 0) / 12)}</div>
            </div>
          </div>

          <div className="an-grid2">
            <div className="card an-card">
              <h3 className="an-h3">Nəyə nə qədər — {MONTHS_FULL[month]}</h3>
              {byKat.length === 0 ? (
                <p className="empty-state" style={{ margin: 0 }}>Bu ay xərc yazılmayıb.</p>
              ) : (
                <ul className="xerc-kats">
                  {byKat.map((x, i) => (
                    <li key={x.k}>
                      <button
                        type="button"
                        className={`xerc-kats__row${katFilter === x.k ? ' xerc-kats__row--on' : ''}`}
                        onClick={() => setKatFilter(katFilter === x.k ? '' : x.k)}
                        title="Bu növün qeydlərini göstər"
                      >
                        <span className="xerc-kats__name">
                          <i style={{ background: COLORS[i % COLORS.length] }} />
                          {x.k}
                        </span>
                        <span className="xerc-kats__bar">
                          <span style={{ width: `${(x.v / (byKat[0].v || 1)) * 100}%`, background: COLORS[i % COLORS.length] }} />
                        </span>
                        <b>{azn(x.v)}</b>
                        <small>{Math.round((x.v / (monthTotal || 1)) * 100)}%</small>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="card an-card">
              <h3 className="an-h3">Son 12 ay</h3>
              <div className="xerc-months">
                {last12.map((m) => (
                  <button
                    key={m.key}
                    type="button"
                    className={`xerc-months__col${m.key === mk ? ' xerc-months__col--on' : ''}`}
                    onClick={() => {
                      const [y, mm] = m.key.split('-').map(Number)
                      setYear(y)
                      setMonth(mm - 1)
                      setKatFilter('')
                    }}
                    title={`${m.full}: ${azn(m.sum)}`}
                  >
                    <span className="xerc-months__val">{m.sum > 0 ? Math.round(m.sum) : ''}</span>
                    <span className="xerc-months__bar" style={{ height: `${(m.sum / maxBar) * 140}px` }} />
                    <span className="xerc-months__lbl">{m.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="card an-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <h3 className="an-h3" style={{ margin: 0 }}>
                {MONTHS_FULL[month]} {year} — qeydlər{katFilter ? ` · ${katFilter}` : ''}
              </h3>
              {katFilter && (
                <button type="button" className="btn btn--secondary" onClick={() => setKatFilter('')}>
                  Hamısını göstər
                </button>
              )}
            </div>
            {shownRows.length === 0 ? (
              <p className="empty-state">Qeyd yoxdur.</p>
            ) : (
              <div className="table-wrap" style={{ marginTop: 10 }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Tarix</th>
                      <th>Nəyə</th>
                      <th className="num">Məbləğ</th>
                      <th>Üsul</th>
                      <th>Qeyd</th>
                      {canEdit && <th></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {shownRows.map((r) => (
                      <tr key={r.id}>
                        <td>{dmy(r.tarix)}</td>
                        <td>{r.kateqoriya}</td>
                        <td className="num">{azn(r.mebleg)}</td>
                        <td>{r.odenis_usulu === 'hesab' ? 'Hesab' : r.odenis_usulu === 'nagd' ? 'Nağd' : '—'}</td>
                        <td>{r.qeyd || '—'}</td>
                        {canEdit && (
                          <td style={{ whiteSpace: 'nowrap' }}>
                            <button
                              type="button"
                              className="btn btn--secondary xerc-btn"
                              onClick={() =>
                                setForm({
                                  id: r.id,
                                  tarix: r.tarix,
                                  kateqoriya: r.kateqoriya,
                                  mebleg: String(r.mebleg),
                                  odenis_usulu: r.odenis_usulu || 'nagd',
                                  qeyd: r.qeyd || '',
                                })
                              }
                            >
                              Redaktə
                            </button>{' '}
                            <button
                              type="button"
                              className="btn btn--secondary xerc-btn"
                              style={{ color: 'var(--color-accent)' }}
                              disabled={busyId === r.id}
                              onClick={() => remove(r)}
                            >
                              Sil
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={2}>Cəmi ({shownRows.length})</td>
                      <td className="num">{azn(shownRows.reduce((s, r) => s + num(r.mebleg), 0))}</td>
                      <td colSpan={canEdit ? 3 : 2}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
