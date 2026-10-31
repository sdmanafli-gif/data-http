import { Fragment, useEffect, useMemo, useState } from 'react'
import { supabase, fetchAllPages } from '../lib/supabase'
import { confirmDelete } from '../lib/confirmDelete'
import { useAuth } from '../contexts/AuthContext'
import '../styles/shared.css'
import './nomreler.css'

/**
 * Nömrələr — mağazanın SIM nömrələri, alış məlumatları və balans artırma tarixçəsi.
 * Hər balans artırma «nomre_balanslar» cədvəlinə ayrıca yazılır;
 * ümumi xərc = alış qiyməti + bütün balans artırmaların cəmi.
 */

const TABLE = 'nomreler'
const BAL_TABLE = 'nomre_balanslar'
const SOON_DAYS = 3

const NOV_OPTIONS = [
  { value: 'icloud', label: 'iCloud' },
  { value: 'satdiq', label: 'Satdıq' },
]
const SEBEKE_OPTIONS = [
  { value: 'azercell', label: 'Azercell' },
  { value: 'bakcell', label: 'Bakcell' },
  { value: 'nar', label: 'Nar' },
]
const VEZIYYET_OPTIONS = [
  { value: 'yeni', label: 'Yeni' },
  { value: 'islenmis', label: 'İşlənmiş' },
]
const labelOf = (opts, v) => opts.find((o) => o.value === v)?.label || ''

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

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100
function azn(n) {
  const v = r2(n)
  const [i, d] = Math.abs(v).toFixed(2).split('.')
  return `${v < 0 ? '−' : ''}${i.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}${d === '00' ? '' : `,${d}`} ₼`
}

function emptyForm() {
  return {
    nomre: '',
    kimin_adina: '',
    alis_tarixi: '',
    nov: '',
    sebeke: '',
    veziyyet: '',
    alis_qiymeti: '',
    son_artirma: todayYmd(),
    gun_araligi: '30',
    qeyd: '',
  }
}

function withNext(row, today, balanslar) {
  const novbeti = row.son_artirma && row.gun_araligi ? addDaysYmd(row.son_artirma, row.gun_araligi) : ''
  const qalib = novbeti ? daysBetween(today, novbeti) : null
  let status = 'none'
  if (qalib != null) status = qalib < 0 ? 'late' : qalib <= SOON_DAYS ? 'soon' : 'ok'
  const hist = balanslar.get(row.id) || []
  const balansCemi = r2(hist.reduce((a, b) => a + (Number(b.mebleg) || 0), 0))
  const umumi = r2((Number(row.alis_qiymeti) || 0) + balansCemi)
  return { ...row, novbeti, qalib, status, hist, balansCemi, umumi }
}

function qalibText(q) {
  if (q == null) return '—'
  if (q < 0) return `${-q} gün keçib`
  if (q === 0) return 'Bu gün'
  return `${q} gün qalıb`
}

function Select({ value, onChange, options }) {
  return (
    <select value={value || ''} onChange={(e) => onChange(e.target.value)}>
      <option value="">—</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

export default function NomrelerPage() {
  const { access } = useAuth()
  const canEdit = access.isAdmin || access.canEdit('nomreler')
  const [rows, setRows] = useState([])
  const [balRows, setBalRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [form, setForm] = useState(null) // null | { id?, ...fields }
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState(null)
  const [topup, setTopup] = useState(null) // { id, tarix, mebleg, qeyd }
  const [openId, setOpenId] = useState(null) // tarixçəsi açıq olan nömrə

  async function load() {
    setLoading(true)
    setError('')
    const [{ data, error: e }, { data: bal, error: e2 }] = await Promise.all([
      fetchAllPages(() => supabase.from(TABLE).select('*')),
      fetchAllPages(() => supabase.from(BAL_TABLE).select('*')),
    ])
    if (e || e2) setError((e || e2).message)
    setRows(data || [])
    setBalRows(bal || [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const balanslar = useMemo(() => {
    const m = new Map()
    for (const b of balRows) {
      if (!m.has(b.nomre_id)) m.set(b.nomre_id, [])
      m.get(b.nomre_id).push(b)
    }
    for (const list of m.values()) {
      list.sort((a, b) => String(b.tarix).localeCompare(String(a.tarix)) || String(b.created_at).localeCompare(String(a.created_at)))
    }
    return m
  }, [balRows])

  const today = todayYmd()
  const all = useMemo(() => rows.map((r) => withNext(r, today, balanslar)), [rows, today, balanslar])

  const list = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('az')
    return all
      .filter((r) => {
        if (!q) return true
        const hay = [
          r.nomre,
          r.kimin_adina,
          r.qeyd,
          labelOf(NOV_OPTIONS, r.nov),
          labelOf(SEBEKE_OPTIONS, r.sebeke),
          labelOf(VEZIYYET_OPTIONS, r.veziyyet),
        ]
          .join(' ')
          .toLocaleLowerCase('az')
        return hay.includes(q)
      })
      .sort((a, b) => {
        // Vaxtı yaxın olanlar yuxarıda; tarixi olmayanlar ən aşağıda
        if (a.qalib == null && b.qalib == null) return String(a.nomre).localeCompare(String(b.nomre))
        if (a.qalib == null) return 1
        if (b.qalib == null) return -1
        return a.qalib - b.qalib
      })
  }, [all, search])

  const counts = useMemo(
    () => ({
      late: all.filter((r) => r.status === 'late').length,
      soon: all.filter((r) => r.status === 'soon').length,
      total: all.length,
      xerc: r2(all.reduce((a, r) => a + r.umumi, 0)),
    }),
    [all]
  )

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
    const qiy = String(form.alis_qiymeti ?? '').trim().replace(',', '.')
    if (qiy && !(Number(qiy) >= 0)) {
      setError('Alış qiyməti düzgün rəqəm olmalıdır.')
      return
    }
    const payload = {
      nomre,
      kimin_adina: String(form.kimin_adina || '').trim() || null,
      alis_tarixi: form.alis_tarixi || null,
      nov: form.nov || null,
      sebeke: form.sebeke || null,
      veziyyet: form.veziyyet || null,
      alis_qiymeti: qiy ? r2(qiy) : null,
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

  /** Balans artırma: tarixçəyə yazır, «Son balans artırılma» tarixini yeniləyir */
  async function saveTopup(e) {
    e.preventDefault()
    if (!topup) return
    const mebleg = Number(String(topup.mebleg || '').replace(',', '.'))
    if (!(mebleg > 0)) {
      setError('Balans məbləğini yazın.')
      return
    }
    const tarix = topup.tarix || today
    const row = rows.find((r) => r.id === topup.id)
    setBusyId(topup.id)
    setError('')
    const { error: e1 } = await supabase.from(BAL_TABLE).insert({
      nomre_id: topup.id,
      tarix,
      mebleg: r2(mebleg),
      qeyd: String(topup.qeyd || '').trim() || null,
    })
    if (e1) {
      setBusyId(null)
      setError(e1.message)
      return
    }
    // Son artırma tarixi yalnız irəli gedir (köhnə tarixli yazı onu geri çəkmir)
    if (!row?.son_artirma || tarix > row.son_artirma) {
      const { error: e2 } = await supabase
        .from(TABLE)
        .update({ son_artirma: tarix, updated_at: new Date().toISOString() })
        .eq('id', topup.id)
      if (e2) setError(e2.message)
    }
    setBusyId(null)
    setTopup(null)
    load()
  }

  async function removeTopup(b) {
    if (!confirmDelete(`${dmy(b.tarix)} — ${azn(b.mebleg)}\n\nBu balans artırma silinsin?`)) return
    setBusyId(b.nomre_id)
    const { error: e } = await supabase.from(BAL_TABLE).delete().eq('id', b.id)
    setBusyId(null)
    if (e) setError(e.message)
    else setBalRows((prev) => prev.filter((x) => x.id !== b.id))
  }

  async function remove(row) {
    const extra = row.hist.length ? `\n(${row.hist.length} balans artırma qeydi də silinəcək)` : ''
    if (!confirmDelete(`${row.nomre}${row.kimin_adina ? ` — ${row.kimin_adina}` : ''}\n\nBu nömrə silinsin?${extra}`)) return
    setBusyId(row.id)
    const { error: e } = await supabase.from(TABLE).delete().eq('id', row.id)
    setBusyId(null)
    if (e) setError(e.message)
    else {
      setRows((prev) => prev.filter((r) => r.id !== row.id))
      setBalRows((prev) => prev.filter((b) => b.nomre_id !== row.id))
    }
  }

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))
  const formNext =
    form && form.son_artirma && Number(form.gun_araligi) > 0 ? addDaysYmd(form.son_artirma, form.gun_araligi) : ''
  const colCount = canEdit ? 10 : 9

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
        <span className="nomre-chip">Ümumi xərc: {azn(counts.xerc)}</span>
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
              <label>Nömrə alış tarixi</label>
              <input type="date" value={form.alis_tarixi || ''} onChange={(e) => set('alis_tarixi', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Alış qiyməti (₼)</label>
              <input type="number" min="0" step="0.01" value={form.alis_qiymeti} onChange={(e) => set('alis_qiymeti', e.target.value)} placeholder="0" />
            </div>
            <div className="form-group">
              <label>Növ</label>
              <Select value={form.nov} onChange={(v) => set('nov', v)} options={NOV_OPTIONS} />
            </div>
            <div className="form-group">
              <label>Şəbəkə</label>
              <Select value={form.sebeke} onChange={(v) => set('sebeke', v)} options={SEBEKE_OPTIONS} />
            </div>
            <div className="form-group">
              <label>Yeni / İşlənmiş</label>
              <Select value={form.veziyyet} onChange={(v) => set('veziyyet', v)} options={VEZIYYET_OPTIONS} />
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
              <input value={form.qeyd} onChange={(e) => set('qeyd', e.target.value)} placeholder="məs. tarif, kimdə qalıb…" />
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
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nömrə, ad, şəbəkə, qeyd…" />
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
                  <th>Alış</th>
                  <th>Son balans artırılma</th>
                  <th className="num">Neçə gündən bir</th>
                  <th>Hansı tarixə düşür</th>
                  <th>Vəziyyət</th>
                  <th className="num">Balans cəmi</th>
                  <th className="num">Ümumi xərc</th>
                  {canEdit && <th></th>}
                </tr>
              </thead>
              <tbody>
                {list.map((r) => {
                  const tags = [labelOf(SEBEKE_OPTIONS, r.sebeke), labelOf(NOV_OPTIONS, r.nov), labelOf(VEZIYYET_OPTIONS, r.veziyyet)].filter(Boolean)
                  const open = openId === r.id
                  return (
                    <Fragment key={r.id}>
                      <tr className={`nomre-row nomre-row--${r.status}`}>
                        <td className="nomre-table__no">
                          {r.nomre}
                          {tags.length > 0 && (
                            <div className="nomre-tags">
                              {tags.map((t) => (
                                <span key={t} className="nomre-tag">{t}</span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td>
                          {r.kimin_adina || '—'}
                          {r.qeyd ? <div className="nomre-table__qeyd">{r.qeyd}</div> : null}
                        </td>
                        <td>
                          {r.alis_qiymeti != null ? azn(r.alis_qiymeti) : '—'}
                          {r.alis_tarixi ? <div className="nomre-table__qeyd">{dmy(r.alis_tarixi)}</div> : null}
                        </td>
                        <td>{dmy(r.son_artirma)}</td>
                        <td className="num">{r.gun_araligi ? `${r.gun_araligi} gün` : '—'}</td>
                        <td className="nomre-table__next">{r.novbeti ? dmy(r.novbeti) : '—'}</td>
                        <td>
                          <span className={`nomre-badge nomre-badge--${r.status}`}>{qalibText(r.qalib)}</span>
                        </td>
                        <td className="num">
                          <button type="button" className="nomre-link" onClick={() => setOpenId(open ? null : r.id)} title="Balans artırma tarixçəsi">
                            {azn(r.balansCemi)} · {r.hist.length} dəfə {open ? '▴' : '▾'}
                          </button>
                        </td>
                        <td className="num nomre-table__next">{azn(r.umumi)}</td>
                        {canEdit && (
                          <td>
                            <div className="nomre-actions">
                              <button
                                type="button"
                                className="btn btn--primary"
                                disabled={busyId === r.id}
                                onClick={() => setTopup({ id: r.id, tarix: today, mebleg: '', qeyd: '' })}
                                title="Balans artırmanı yazır və son artırma tarixini yeniləyir"
                              >
                                Balans artırdım
                              </button>
                              <button
                                type="button"
                                className="btn btn--secondary"
                                onClick={() =>
                                  setForm({
                                    id: r.id,
                                    nomre: r.nomre || '',
                                    kimin_adina: r.kimin_adina || '',
                                    alis_tarixi: r.alis_tarixi || '',
                                    nov: r.nov || '',
                                    sebeke: r.sebeke || '',
                                    veziyyet: r.veziyyet || '',
                                    alis_qiymeti: r.alis_qiymeti != null ? String(r.alis_qiymeti) : '',
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
                      {topup?.id === r.id && (
                        <tr className="nomre-sub">
                          <td colSpan={colCount}>
                            <form className="nomre-topup" onSubmit={saveTopup}>
                              <strong>Balans artırma — {r.nomre}</strong>
                              <label>
                                Tarix
                                <input type="date" value={topup.tarix} onChange={(e) => setTopup((t) => ({ ...t, tarix: e.target.value }))} />
                              </label>
                              <label>
                                Məbləğ (₼) *
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  autoFocus
                                  value={topup.mebleg}
                                  onChange={(e) => setTopup((t) => ({ ...t, mebleg: e.target.value }))}
                                />
                              </label>
                              <label className="nomre-topup__qeyd">
                                Qeyd
                                <input value={topup.qeyd} onChange={(e) => setTopup((t) => ({ ...t, qeyd: e.target.value }))} />
                              </label>
                              <button type="submit" className="btn btn--primary" disabled={busyId === r.id}>
                                Yadda saxla
                              </button>
                              <button type="button" className="btn btn--secondary" onClick={() => setTopup(null)}>
                                Ləğv et
                              </button>
                            </form>
                          </td>
                        </tr>
                      )}
                      {open && (
                        <tr className="nomre-sub">
                          <td colSpan={colCount}>
                            <div className="nomre-hist">
                              <div className="nomre-hist__sum">
                                <span>Alış qiyməti: <b>{azn(r.alis_qiymeti)}</b></span>
                                <span>Balans artırmalar ({r.hist.length} dəfə): <b>{azn(r.balansCemi)}</b></span>
                                <span>Ümumi: <b>{azn(r.umumi)}</b></span>
                              </div>
                              {r.hist.length === 0 ? (
                                <p className="empty-state" style={{ margin: 0 }}>Hələ balans artırılmayıb.</p>
                              ) : (
                                <table className="data-table nomre-hist__table">
                                  <thead>
                                    <tr>
                                      <th>Tarix</th>
                                      <th className="num">Məbləğ</th>
                                      <th>Qeyd</th>
                                      {canEdit && <th></th>}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {r.hist.map((b) => (
                                      <tr key={b.id}>
                                        <td>{dmy(b.tarix)}</td>
                                        <td className="num">{azn(b.mebleg)}</td>
                                        <td>{b.qeyd || '—'}</td>
                                        {canEdit && (
                                          <td>
                                            <button type="button" className="nomre-link nomre-link--danger" onClick={() => removeTopup(b)}>
                                              Sil
                                            </button>
                                          </td>
                                        )}
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
