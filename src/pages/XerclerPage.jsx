import { useEffect, useMemo, useState } from 'react'
import { supabase, fetchAllPages } from '../lib/supabase'
import { confirmDelete } from '../lib/confirmDelete'
import { useAuth } from '../contexts/AuthContext'
import '../styles/shared.css'
import './analitika.css'
import './xercler.css'

/**
 * Xərclər — iki qrup: İş (Analitikada mənfəətdən çıxılır) və Şəxsi (ayrıca izlənir).
 * Hər qrup bağlanıb-açılır; ay-ay baxış, növ üzrə bölgü, öz növlərinizi əlavə etmək.
 */

const TABLE = 'xercler'
const KAT_TABLE = 'xerc_kateqoriyalar'

export const QRUPLAR = {
  is: {
    title: 'İş xərcləri',
    hint: 'Analitikada xalis mənfəətdən çıxılır',
    kats: [
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
    ],
  },
  sexsi: {
    title: 'Şəxsi xərclər',
    hint: 'Ayrıca izlənir, iş mənfəətinə qatılmır',
    kats: ['Maşın', 'Benzin', 'Kontur', 'Market', 'Restoran'],
  },
}

const MONTHS_FULL = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'İyun', 'İyul', 'Avqust', 'Sentyabr', 'Oktyabr', 'Noyabr', 'Dekabr']
const MONTHS = ['Yan', 'Fev', 'Mar', 'Apr', 'May', 'İyn', 'İyl', 'Avq', 'Sen', 'Okt', 'Noy', 'Dek']
const COLORS = ['#c41e2a', '#2f6fed', '#1f8a65', '#d9a400', '#8e44ad', '#c45c26', '#16a2b8', '#6b6560', '#e67e22', '#2c3e50', '#7f8c8d', '#b9c3d6']
const OPEN_KEY = 'xercler:open'

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100
const num = (v) => {
  const n = Number(String(v ?? '').replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}
const qrupOf = (r) => (r.qrup === 'sexsi' ? 'sexsi' : 'is')

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

function loadOpen() {
  try {
    const v = JSON.parse(localStorage.getItem(OPEN_KEY) || 'null')
    if (v && typeof v === 'object') return { is: v.is !== false, sexsi: v.sexsi !== false, faiz: v.faiz !== false }
  } catch {
    /* brauzer yaddaşı əlçatan deyil */
  }
  return { is: true, sexsi: true, faiz: true }
}

/** Bir qrupun bloku (İş və ya Şəxsi) */
function XercSection({ qrup, open, onToggle, rows, year, month, onPickMonth, kats, canEdit, onSaved, onDeleted, onAddKat, onRemoveKat, setError }) {
  const cfg = QRUPLAR[qrup]
  const mk = monthKeyOf(year, month)
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState(null)
  const [katFilter, setKatFilter] = useState('')
  const [newKat, setNewKat] = useState(null) // null | string

  useEffect(() => {
    setKatFilter('')
  }, [mk])

  const monthRows = useMemo(() => rows.filter((r) => String(r.tarix || '').slice(0, 7) === mk), [rows, mk])
  const shownRows = katFilter ? monthRows.filter((r) => r.kateqoriya === katFilter) : monthRows
  const monthTotal = r2(monthRows.reduce((s, r) => s + num(r.mebleg), 0))

  const byKat = useMemo(() => {
    const m = new Map()
    for (const r of monthRows) m.set(r.kateqoriya, (m.get(r.kateqoriya) || 0) + num(r.mebleg))
    return [...m.entries()].map(([k, v]) => ({ k, v: r2(v) })).sort((a, b) => b.v - a.v)
  }, [monthRows])

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
  const maxBar = Math.max(1, ...last12.map((m) => m.sum))

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  async function save(e) {
    e.preventDefault()
    if (!form) return
    const kateqoriya = String(form.kateqoriya || '').trim()
    const mebleg = num(form.mebleg)
    if (!kateqoriya) return setError('Xərcin növünü seçin və ya yazın.')
    if (!(mebleg > 0)) return setError('Məbləği yazın.')
    if (!form.tarix) return setError('Tarixi seçin.')
    const payload = {
      tarix: form.tarix,
      kateqoriya,
      mebleg: r2(mebleg),
      qrup,
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
    if (e2) return setError(e2.message)
    // Siyahıda olmayan yeni növ yazılıbsa — yadda saxla
    if (!kats.includes(kateqoriya)) onAddKat(qrup, kateqoriya, true)
    setForm(null)
    onSaved(form.tarix)
  }

  async function remove(r) {
    if (!confirmDelete(`${dmy(r.tarix)} · ${r.kateqoriya} · ${azn(r.mebleg)}\n\nBu xərc silinsin?`)) return
    setBusyId(r.id)
    const { error: e } = await supabase.from(TABLE).delete().eq('id', r.id)
    setBusyId(null)
    if (e) setError(e.message)
    else onDeleted(r.id)
  }

  return (
    <div className={`card an-card xerc-sec xerc-sec--${qrup}`}>
      <button type="button" className="xerc-sec__head" onClick={onToggle} aria-expanded={open}>
        <span className="xerc-sec__arrow">{open ? '▾' : '▸'}</span>
        <span className="xerc-sec__title">{cfg.title}</span>
        <span className="xerc-sec__hint">{cfg.hint}</span>
        <b className="xerc-sec__sum">{azn(monthTotal)}</b>
      </button>

      {open && (
        <div className="xerc-sec__body">
          <div className="xerc-sec__bar">
            <div className="an-kpis" style={{ margin: 0, flex: 1 }}>
              <div className="an-kpi">
                <div className="an-kpi__label">{MONTHS_FULL[month]}</div>
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
                <div className="an-kpi__label">Keçən ay</div>
                <div className="an-kpi__value">{azn(prevTotal)}</div>
              </div>
              <div className="an-kpi">
                <div className="an-kpi__label">{year} ili</div>
                <div className="an-kpi__value">{azn(yearTotal)}</div>
              </div>
              <div className="an-kpi">
                <div className="an-kpi__label">12 ay orta / ay</div>
                <div className="an-kpi__value">{azn(last12.reduce((s, m) => s + m.sum, 0) / 12)}</div>
              </div>
            </div>
            {canEdit && !form && (
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => setForm({ tarix: todayYmd(), kateqoriya: '', mebleg: '', odenis_usulu: 'nagd', qeyd: '' })}
              >
                Yeni xərc
              </button>
            )}
          </div>

          {form && (
            <form className="xerc-form" onSubmit={save}>
              <h3 className="an-h3">{form.id ? 'Xərci redaktə et' : `Yeni xərc — ${cfg.title}`}</h3>
              <div className="xerc-form__grid">
                <label>
                  Tarix *
                  <input type="date" value={form.tarix} onChange={(e) => set('tarix', e.target.value)} />
                </label>
                <label>
                  Nəyə xərclənib *
                  <input
                    list={`xerc-kats-${qrup}`}
                    value={form.kateqoriya}
                    onChange={(e) => set('kateqoriya', e.target.value)}
                    placeholder="Seçin və ya yazın"
                    autoFocus
                  />
                  <datalist id={`xerc-kats-${qrup}`}>
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
                  <input value={form.qeyd} onChange={(e) => set('qeyd', e.target.value)} placeholder="ətraflı qeyd…" />
                </label>
              </div>
              <div className="xerc-chips">
                {kats.map((k) => (
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

          {/* Növlər: hazır + əlavə edilənlər */}
          <div className="xerc-katlist">
            <span className="xerc-katlist__label">Növlər:</span>
            {kats.map((k) => {
              const custom = !cfg.kats.includes(k)
              return (
                <span key={k} className={`xerc-tag${custom ? ' xerc-tag--custom' : ''}`}>
                  {k}
                  {custom && canEdit && (
                    <button type="button" title="Növü siyahıdan sil (yazılmış xərclər qalır)" onClick={() => onRemoveKat(qrup, k)}>
                      ×
                    </button>
                  )}
                </span>
              )
            })}
            {canEdit &&
              (newKat == null ? (
                <button type="button" className="xerc-chip" onClick={() => setNewKat('')}>
                  + Növ əlavə et
                </button>
              ) : (
                <span className="xerc-newkat">
                  <input
                    value={newKat}
                    autoFocus
                    placeholder="məs. Sığorta"
                    onChange={(e) => setNewKat(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        if (newKat.trim()) onAddKat(qrup, newKat.trim())
                        setNewKat(null)
                      } else if (e.key === 'Escape') setNewKat(null)
                    }}
                  />
                  <button
                    type="button"
                    className="btn btn--primary xerc-btn"
                    onClick={() => {
                      if (newKat.trim()) onAddKat(qrup, newKat.trim())
                      setNewKat(null)
                    }}
                  >
                    Əlavə et
                  </button>
                  <button type="button" className="btn btn--secondary xerc-btn" onClick={() => setNewKat(null)}>
                    Ləğv
                  </button>
                </span>
              ))}
          </div>

          <div className="an-grid2">
            <div>
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
            <div>
              <h3 className="an-h3">Son 12 ay</h3>
              <div className="xerc-months">
                {last12.map((m) => (
                  <button
                    key={m.key}
                    type="button"
                    className={`xerc-months__col${m.key === mk ? ' xerc-months__col--on' : ''}`}
                    onClick={() => onPickMonth(m.key)}
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

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
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
      )}
    </div>
  )
}

/**
 * İşçilər faizi — satışlarda seçilən satıcı və yazılan bonus (satıcı faizi) avtomatik yığılır.
 * Mənbə: Nağd / Nisyə satış (nagd_satish) və Kredit satış (musteri_bazasi). Yalnız oxuyur.
 * Bu məbləğ satış mənfəətində artıq çıxılıb — Analitikada ikinci dəfə çıxılmır.
 */
function IscilerFaizSection({ open, onToggle, sales, year, month, onPickMonth }) {
  const mk = monthKeyOf(year, month)
  const [who, setWho] = useState('')

  useEffect(() => {
    setWho('')
  }, [mk])

  const monthRows = useMemo(() => sales.filter((r) => String(r.tarix || '').slice(0, 7) === mk), [sales, mk])
  const shownRows = (who ? monthRows.filter((r) => r.satici === who) : monthRows)
    .slice()
    .sort((a, b) => String(b.tarix).localeCompare(String(a.tarix)))
  const monthTotal = r2(monthRows.reduce((s, r) => s + r.bonus, 0))

  const bySeller = useMemo(() => {
    const m = new Map()
    for (const r of monthRows) {
      const g = m.get(r.satici) || { name: r.satici, count: 0, bonus: 0, satis: 0, nagd: 0, nisye: 0, kredit: 0 }
      g.count += 1
      g.bonus += r.bonus
      g.satis += r.satis
      if (r.nov === 'Kredit') g.kredit += 1
      else if (r.nov === 'Nisyə') g.nisye += 1
      else g.nagd += 1
      m.set(r.satici, g)
    }
    return [...m.values()].sort((a, b) => b.bonus - a.bonus || b.count - a.count)
  }, [monthRows])

  const last12 = useMemo(() => {
    const out = []
    for (let i = 11; i >= 0; i -= 1) {
      const d = new Date(year, month - i, 1)
      const key = monthKeyOf(d.getFullYear(), d.getMonth())
      const sum = sales.filter((r) => String(r.tarix || '').slice(0, 7) === key).reduce((s, r) => s + r.bonus, 0)
      out.push({ key, label: MONTHS[d.getMonth()], full: `${MONTHS_FULL[d.getMonth()]} ${d.getFullYear()}`, sum: r2(sum) })
    }
    return out
  }, [sales, year, month])
  const prevTotal = last12[10]?.sum || 0
  const yearTotal = r2(sales.filter((r) => String(r.tarix || '').slice(0, 4) === String(year)).reduce((s, r) => s + r.bonus, 0))
  const maxBar = Math.max(1, ...last12.map((m) => m.sum))
  const maxSeller = Math.max(1, ...bySeller.map((g) => g.bonus))

  return (
    <div className="card an-card xerc-sec xerc-sec--faiz">
      <button type="button" className="xerc-sec__head" onClick={onToggle} aria-expanded={open}>
        <span className="xerc-sec__arrow">{open ? '▾' : '▸'}</span>
        <span className="xerc-sec__title">İşçilər faizi</span>
        <span className="xerc-sec__hint">Satışlarda seçilən satıcı və bonus — avtomatik yığılır</span>
        <b className="xerc-sec__sum">{azn(monthTotal)}</b>
      </button>

      {open && (
        <div className="xerc-sec__body">
          <div className="an-kpis" style={{ margin: '12px 0' }}>
            <div className="an-kpi">
              <div className="an-kpi__label">{MONTHS_FULL[month]}</div>
              <div className="an-kpi__value">{azn(monthTotal)}</div>
              <div className="an-kpi__hint">
                {monthRows.length} satış · {bySeller.length} işçi
              </div>
            </div>
            <div className="an-kpi">
              <div className="an-kpi__label">Keçən ay</div>
              <div className="an-kpi__value">{azn(prevTotal)}</div>
            </div>
            <div className="an-kpi">
              <div className="an-kpi__label">{year} ili</div>
              <div className="an-kpi__value">{azn(yearTotal)}</div>
            </div>
          </div>
          <p className="xerc-note">
            Bu məbləğ satış mənfəətində artıq çıxılıb (satış − alış − satıcı faizi), ona görə Analitikada ikinci dəfə çıxılmır.
          </p>

          <div className="an-grid2">
            <div>
              <h3 className="an-h3">Kim nə qədər — {MONTHS_FULL[month]}</h3>
              {bySeller.length === 0 ? (
                <p className="empty-state" style={{ margin: 0 }}>Bu ay satıcı seçilmiş satış yoxdur.</p>
              ) : (
                <ul className="xerc-kats">
                  {bySeller.map((g, i) => (
                    <li key={g.name}>
                      <button
                        type="button"
                        className={`xerc-kats__row${who === g.name ? ' xerc-kats__row--on' : ''}`}
                        onClick={() => setWho(who === g.name ? '' : g.name)}
                        title={`Nağd ${g.nagd} · Nisyə ${g.nisye} · Kredit ${g.kredit}`}
                      >
                        <span className="xerc-kats__name">
                          <i style={{ background: COLORS[i % COLORS.length] }} />
                          {g.name} <small>({g.count})</small>
                        </span>
                        <span className="xerc-kats__bar">
                          <span style={{ width: `${(g.bonus / maxSeller) * 100}%`, background: COLORS[i % COLORS.length] }} />
                        </span>
                        <b>{azn(g.bonus)}</b>
                        <small>{Math.round((g.bonus / (monthTotal || 1)) * 100)}%</small>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <h3 className="an-h3">Son 12 ay</h3>
              <div className="xerc-months">
                {last12.map((m) => (
                  <button
                    key={m.key}
                    type="button"
                    className={`xerc-months__col${m.key === mk ? ' xerc-months__col--on' : ''}`}
                    onClick={() => onPickMonth(m.key)}
                    title={`${m.full}: ${azn(m.sum)}`}
                  >
                    <span className="xerc-months__val">{m.sum > 0 ? Math.round(m.sum) : ''}</span>
                    <span className="xerc-months__bar xerc-months__bar--faiz" style={{ height: `${(m.sum / maxBar) * 140}px` }} />
                    <span className="xerc-months__lbl">{m.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
            <h3 className="an-h3" style={{ margin: 0 }}>
              {MONTHS_FULL[month]} {year} — satışlar{who ? ` · ${who}` : ''}
            </h3>
            {who && (
              <button type="button" className="btn btn--secondary" onClick={() => setWho('')}>
                Hamısını göstər
              </button>
            )}
          </div>
          {shownRows.length === 0 ? (
            <p className="empty-state">Satış yoxdur.</p>
          ) : (
            <div className="table-wrap" style={{ marginTop: 10 }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Tarix</th>
                    <th>Satıcı</th>
                    <th>Növ</th>
                    <th>Müştəri</th>
                    <th>Model</th>
                    <th className="num">Satış</th>
                    <th className="num">Bonus</th>
                  </tr>
                </thead>
                <tbody>
                  {shownRows.map((r) => (
                    <tr key={r.key}>
                      <td>{dmy(r.tarix)}</td>
                      <td>{r.satici}</td>
                      <td>{r.nov}</td>
                      <td>{r.kim || '—'}</td>
                      <td>{r.model || '—'}</td>
                      <td className="num">{azn(r.satis)}</td>
                      <td className={`num${r.bonus > 0 ? '' : ' an-muted'}`}>{azn(r.bonus)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={5}>Cəmi ({shownRows.length})</td>
                    <td className="num">{azn(shownRows.reduce((s, r) => s + r.satis, 0))}</td>
                    <td className="num">{azn(shownRows.reduce((s, r) => s + r.bonus, 0))}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function XerclerPage() {
  const { access } = useAuth()
  const canEdit = access.isAdmin || access.canEdit('xercler')
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [rows, setRows] = useState([])
  const [customKats, setCustomKats] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [open, setOpen] = useState(loadOpen)
  const [sales, setSales] = useState([])

  useEffect(() => {
    try {
      localStorage.setItem(OPEN_KEY, JSON.stringify(open))
    } catch {
      /* brauzer yaddaşı əlçatan deyil */
    }
  }, [open])

  async function load() {
    setLoading(true)
    setError('')
    const [{ data, error: e }, { data: k, error: e2 }] = await Promise.all([
      fetchAllPages(() => supabase.from(TABLE).select('*').order('tarix', { ascending: false }).order('created_at', { ascending: false })),
      fetchAllPages(() => supabase.from(KAT_TABLE).select('*').order('created_at', { ascending: true })),
    ])
    if (e) setError(e.message)
    else setRows(data || [])
    if (!e2) setCustomKats(k || [])
    // İşçilər faizi: satıcı seçilən və ya bonus yazılan satışlar
    const [{ data: ns }, { data: ks }] = await Promise.all([
      fetchAllPages(() =>
        supabase
          .from('nagd_satish')
          .select('id, tarix, satis_novu, kime, model, satis_qiymeti, satici, satici_faizi')
          .order('id', { ascending: true })
      ),
      fetchAllPages(() =>
        supabase
          .from('musteri_bazasi')
          .select('id, sira_no, ad_soyad, verilme_tarixi, model, satis_qiymeti, satici, satici_faizi')
          .order('id', { ascending: true })
      ),
    ])
    const list = []
    const push = (r) => {
      let satici = String(r.satici ?? '').trim()
      if (/^(null|undefined|-|—)$/i.test(satici)) satici = ''
      const bonus = r2(num(r.bonus))
      if (!satici && !(bonus > 0)) return
      list.push({ ...r, satici: satici || '— (satıcı seçilməyib)', bonus })
    }
    for (const r of ns || []) {
      push({
        key: `n-${r.id}`,
        tarix: r.tarix,
        nov: r.satis_novu === 'nisye' ? 'Nisyə' : 'Nağd',
        kim: r.kime,
        model: r.model,
        satis: num(r.satis_qiymeti),
        satici: r.satici,
        bonus: r.satici_faizi,
      })
    }
    for (const r of ks || []) {
      push({
        key: `k-${r.id}`,
        tarix: r.verilme_tarixi,
        nov: 'Kredit',
        kim: `${r.sira_no != null ? `#${r.sira_no} ` : ''}${r.ad_soyad || ''}`,
        model: r.model,
        satis: num(r.satis_qiymeti),
        satici: r.satici,
        bonus: r.satici_faizi,
      })
    }
    setSales(list)
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const rowsByQrup = useMemo(
    () => ({ is: rows.filter((r) => qrupOf(r) === 'is'), sexsi: rows.filter((r) => qrupOf(r) === 'sexsi') }),
    [rows]
  )

  const katsOf = (qrup) => {
    const set = new Set(QRUPLAR[qrup].kats)
    for (const c of customKats) if (c.qrup === qrup) set.add(c.ad)
    for (const r of rowsByQrup[qrup]) if (r.kateqoriya) set.add(r.kateqoriya)
    return [...set]
  }

  async function addKat(qrup, ad, silent = false) {
    const name = String(ad || '').trim()
    if (!name) return
    if (katsOf(qrup).includes(name) && !silent) return
    const { data, error: e } = await supabase.from(KAT_TABLE).insert({ qrup, ad: name }).select('*').single()
    if (e) {
      if (!silent && !/duplicate/i.test(e.message)) setError(e.message)
      return
    }
    setCustomKats((prev) => [...prev, data])
  }

  async function removeKat(qrup, ad) {
    if (!confirmDelete(`«${ad}» növü siyahıdan silinsin?\n\nBu növlə yazılmış xərclər silinmir.`)) return
    const { error: e } = await supabase.from(KAT_TABLE).delete().eq('qrup', qrup).eq('ad', ad)
    if (e) return setError(e.message)
    setCustomKats((prev) => prev.filter((c) => !(c.qrup === qrup && c.ad === ad)))
  }

  function shift(dir) {
    const d = new Date(year, month + dir, 1)
    setYear(d.getFullYear())
    setMonth(d.getMonth())
  }

  function pickMonthKey(key) {
    const [y, m] = key.split('-').map(Number)
    setYear(y)
    setMonth(m - 1)
  }

  const mk = monthKeyOf(year, month)
  const monthSum = (qrup) => r2(rowsByQrup[qrup].filter((r) => String(r.tarix || '').slice(0, 7) === mk).reduce((s, r) => s + num(r.mebleg), 0))
  const isSum = monthSum('is')
  const sexsiSum = monthSum('sexsi')
  const faizSum = r2(sales.filter((r) => String(r.tarix || '').slice(0, 7) === mk).reduce((s, r) => s + r.bonus, 0))

  return (
    <div className="an-page">
      <div className="page-header" style={{ marginBottom: 12 }}>
        <div>
          <h1 style={{ marginBottom: 4 }}>Xərclər</h1>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text-muted)' }}>
            İş və şəxsi xərclər ayrı-ayrı. İş xərcləri Analitikada xalis mənfəətdən çıxılır.
          </p>
        </div>
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
          }}
        >
          Bu ay
        </button>
        {!loading && (
          <span className="xerc-total">
            {MONTHS_FULL[month]}: İş <b>{azn(isSum)}</b> · Şəxsi <b>{azn(sexsiSum)}</b> · İşçilər faizi <b>{azn(faizSum)}</b> · Cəmi <b>{azn(isSum + sexsiSum + faizSum)}</b>
          </span>
        )}
      </div>

      {error && <p style={{ color: 'var(--color-accent)' }}>{error}</p>}

      {loading ? (
        <div className="card">
          <p className="empty-state">Yüklənir…</p>
        </div>
      ) : (
        ['is', 'sexsi'].map((q) => (
          <XercSection
            key={q}
            qrup={q}
            open={open[q]}
            onToggle={() => setOpen((o) => ({ ...o, [q]: !o[q] }))}
            rows={rowsByQrup[q]}
            year={year}
            month={month}
            onPickMonth={pickMonthKey}
            kats={katsOf(q)}
            canEdit={canEdit}
            setError={setError}
            onAddKat={addKat}
            onRemoveKat={removeKat}
            onSaved={(tarix) => {
              pickMonthKey(String(tarix).slice(0, 7))
              load()
            }}
            onDeleted={(id) => setRows((prev) => prev.filter((x) => x.id !== id))}
          />
        ))
      )}
      {!loading && (
        <IscilerFaizSection
          open={open.faiz}
          onToggle={() => setOpen((o) => ({ ...o, faiz: !o.faiz }))}
          sales={sales}
          year={year}
          month={month}
          onPickMonth={pickMonthKey}
        />
      )}
    </div>
  )
}
