import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { supabase, fetchAllPages } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { formatDate } from '../lib/formatDate'
import { formatMoney } from '../features/odenisler/constants'
import { computeBalances, counterpartPath, LEDGER_TABLE } from '../features/borc-nisye/constants'
import CollapsibleSummary from '../components/CollapsibleSummary'
import { loadPageFilters, savePageFilters } from '../lib/uiPrefs'
import '../styles/shared.css'

/**
 * Kontaktlar (test): müştərilər və təchizatçılar bir yerdə.
 * Yalnız oxuyur — bazada heç nəyi dəyişmir.
 * Təchizatçılar Depodakı "Hardan" (kimden_alinib) adlarından avtomatik yığılır.
 */

const STATUS_LABELS = {
  available: 'Mövcud',
  sold: 'Satılıb',
  reserved: 'Rezerv',
  returned: 'Qaytarılıb',
  other: 'Digər',
}

function norm(s) {
  return String(s || '').trim().replace(/\s+/g, ' ').toLowerCase()
}

function num(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function round2(n) {
  return Math.round(num(n) * 100) / 100
}

function phonesOf(m) {
  return [m.nomre_1, m.nomre_2, m.nomre_3, m.nomre_4, m.nomre_5]
    .map((x) => String(x || '').trim())
    .filter(Boolean)
}

function Modal({ title, subtitle, onClose, children }) {
  return (
    <div className="telefon-modal-overlay musteri-record-overlay" onClick={onClose} role="presentation">
      <div className="telefon-modal musteri-record-modal" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', marginBottom: 12 }}>
          <div>
            <h2 className="card__title" style={{ margin: 0 }}>{title}</h2>
            {subtitle ? (
              <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--color-text-muted)' }}>{subtitle}</p>
            ) : null}
          </div>
          <button type="button" className="btn btn--secondary" onClick={onClose}>
            Bağla
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function SummaryRow({ items }) {
  return (
    <div className="musteri-summary" style={{ marginBottom: 12 }}>
      {items.map((it) => (
        <div key={it.label} className={`musteri-summary__card${it.meta ? ' musteri-summary__card--meta' : ''}`}>
          <div className="musteri-summary__label">{it.label}</div>
          <div className="musteri-summary__value">{it.value}</div>
        </div>
      ))}
    </div>
  )
}

export default function KontaktlarPage() {
  const { isAdmin } = useAuth()
  const [saved] = useState(() => loadPageFilters('kontaktlar', {}) || {})
  const [tab, setTab] = useState(saved.tab === 'techizatci' ? 'techizatci' : 'musteri')
  const [search, setSearch] = useState(saved.search || '')
  const [onlyDebt, setOnlyDebt] = useState(Boolean(saved.onlyDebt))
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [data, setData] = useState({ musteriler: [], satislar: [], odenisler: [], ledger: [], depo: [] })
  const [openCustomer, setOpenCustomer] = useState(null)
  const [openSupplier, setOpenSupplier] = useState(null)

  useEffect(() => {
    savePageFilters('kontaktlar', { tab, search, onlyDebt })
  }, [tab, search, onlyDebt])

  useEffect(() => {
    if (!isAdmin) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const [m, s, o, l, d] = await Promise.all([
          fetchAllPages(() =>
            supabase
              .from('musteriler')
              .select('id, ad_soyad, nomre_1, nomre_2, nomre_3, nomre_4, nomre_5, zamin')
              .order('ad_soyad', { ascending: true })
          ),
          fetchAllPages(() =>
            supabase
              .from('musteri_bazasi')
              .select('id, musteri_id, sira_no, ad_soyad, model, satis_qiymeti, verilib, qalan_borc, veziyyet, verilme_tarixi')
              .order('sira_no', { ascending: true })
          ),
          fetchAllPages(() =>
            supabase.from('odenisler').select('id, musteri_bazasi_id, mebleg, tarix, tip').order('id', { ascending: true })
          ),
          fetchAllPages(() => supabase.from(LEDGER_TABLE).select('kime, tip, mebleg')),
          fetchAllPages(() =>
            supabase
              .from('depo')
              .select('id, sira_no, kimden_alinib, nomre, model, reng, yaddas, imei_1, alis_qiymeti, alis_tarixi, miqdar, status')
              .order('id', { ascending: true })
          ),
        ])
        const err = m.error || s.error || o.error || l.error || d.error
        if (err) throw err
        if (cancelled) return
        setData({
          musteriler: m.data || [],
          satislar: s.data || [],
          odenisler: o.data || [],
          ledger: l.data || [],
          depo: d.data || [],
        })
      } catch (e) {
        if (!cancelled) setError(e.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [isAdmin])

  // Borc / Nisyə qalıqları ada görə
  const ledgerByName = useMemo(() => {
    const map = new Map()
    for (const b of computeBalances(data.ledger)) map.set(norm(b.kime), b)
    return map
  }, [data.ledger])

  const customers = useMemo(() => {
    const salesByCustomer = new Map()
    const saleToCustomer = new Map()
    for (const s of data.satislar) {
      if (!s.musteri_id) continue
      saleToCustomer.set(s.id, s.musteri_id)
      if (!salesByCustomer.has(s.musteri_id)) salesByCustomer.set(s.musteri_id, [])
      salesByCustomer.get(s.musteri_id).push(s)
    }
    const lastPay = new Map()
    for (const p of data.odenisler) {
      const cid = saleToCustomer.get(p.musteri_bazasi_id)
      if (!cid || !p.tarix) continue
      if (!lastPay.has(cid) || p.tarix > lastPay.get(cid)) lastPay.set(cid, p.tarix)
    }
    return data.musteriler.map((m) => {
      const sales = salesByCustomer.get(m.id) || []
      const led = ledgerByName.get(norm(m.ad_soyad))
      return {
        ...m,
        phones: phonesOf(m),
        sales,
        saleCount: sales.length,
        satis: round2(sales.reduce((a, s) => a + num(s.satis_qiymeti), 0)),
        verilib: round2(sales.reduce((a, s) => a + num(s.verilib), 0)),
        qalan: round2(sales.reduce((a, s) => a + num(s.qalan_borc), 0)),
        lastPay: lastPay.get(m.id) || null,
        ledger: led || null,
      }
    })
  }, [data.musteriler, data.satislar, data.odenisler, ledgerByName])

  const suppliers = useMemo(() => {
    const map = new Map()
    for (const d of data.depo) {
      const name = String(d.kimden_alinib || '').trim().replace(/\s+/g, ' ')
      if (!name) continue
      const key = norm(name)
      if (!map.has(key)) map.set(key, { key, name, items: [], phone: '', lastDate: null, total: 0 })
      const g = map.get(key)
      g.items.push(d)
      const qty = Math.max(1, num(d.miqdar) || 1)
      g.total += num(d.alis_qiymeti) * qty
      if (d.alis_tarixi && (!g.lastDate || d.alis_tarixi > g.lastDate)) {
        g.lastDate = d.alis_tarixi
        if (String(d.nomre || '').trim()) g.phone = String(d.nomre).trim()
      }
      if (!g.phone && String(d.nomre || '').trim()) g.phone = String(d.nomre).trim()
    }
    return [...map.values()]
      .map((g) => ({ ...g, total: round2(g.total), count: g.items.length, ledger: ledgerByName.get(g.key) || null }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'az'))
  }, [data.depo, ledgerByName])

  const q = norm(search)

  const shownCustomers = useMemo(
    () =>
      customers.filter((c) => {
        if (onlyDebt && c.qalan <= 0) return false
        if (!q) return true
        return [c.ad_soyad, c.zamin, ...c.phones].some((v) => norm(v).includes(q))
      }),
    [customers, q, onlyDebt]
  )

  const shownSuppliers = useMemo(
    () =>
      suppliers.filter((s) => {
        if (onlyDebt && !(s.ledger && (s.ledger.qaliq_borc !== 0 || s.ledger.qaliq_nisye !== 0))) return false
        if (!q) return true
        return [s.name, s.phone].some((v) => norm(v).includes(q))
      }),
    [suppliers, q, onlyDebt]
  )

  if (!isAdmin) return <Navigate to="/" replace />

  const custTotals = {
    count: shownCustomers.length,
    satis: round2(shownCustomers.reduce((a, c) => a + c.satis, 0)),
    verilib: round2(shownCustomers.reduce((a, c) => a + c.verilib, 0)),
    qalan: round2(shownCustomers.reduce((a, c) => a + c.qalan, 0)),
  }
  const supTotals = {
    count: shownSuppliers.length,
    items: shownSuppliers.reduce((a, s) => a + s.count, 0),
    total: round2(shownSuppliers.reduce((a, s) => a + s.total, 0)),
  }

  return (
    <div>
      <div className="page-header" style={{ marginBottom: 12 }}>
        <div>
          <h1 style={{ marginBottom: 4 }}>Kontaktlar</h1>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text-muted)' }}>
            Müştərilər və təchizatçılar (test). Təchizatçılar Depodakı "Hardan" adlarından avtomatik yığılır.
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        {[
          { id: 'musteri', label: `Müştərilər (${customers.length})` },
          { id: 'techizatci', label: `Təchizatçılar (${suppliers.length})` },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            className={`btn ${tab === t.id ? 'btn--primary' : 'btn--secondary'}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <CollapsibleSummary title="Axtarış / Filtr" storageKey="summary:kontaktlar-filter" defaultOpen>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-end' }}>
          <div className="form-group" style={{ marginBottom: 0, flex: '1 1 260px', maxWidth: 380 }}>
            <label>Axtarış</label>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={tab === 'musteri' ? 'Ad, telefon, zamin…' : 'Təchizatçı adı, telefon…'}
            />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, marginBottom: 4 }}>
            <input type="checkbox" checked={onlyDebt} onChange={(e) => setOnlyDebt(e.target.checked)} />
            {tab === 'musteri' ? 'Yalnız borcu olanlar' : 'Yalnız Borc / Nisyə qalığı olanlar'}
          </label>
        </div>
      </CollapsibleSummary>

      {error && <p style={{ color: 'var(--color-accent)' }}>{error}</p>}

      {!loading && tab === 'musteri' && (
        <CollapsibleSummary title="Cəmlər" storageKey="summary:kontaktlar-musteri">
          <SummaryRow
            items={[
              { label: 'Müştəri', value: custTotals.count, meta: true },
              { label: 'Satış cəmi', value: formatMoney(custTotals.satis) },
              { label: 'Verilib', value: formatMoney(custTotals.verilib) },
              { label: 'Qalan borc', value: formatMoney(custTotals.qalan) },
            ]}
          />
        </CollapsibleSummary>
      )}
      {!loading && tab === 'techizatci' && (
        <CollapsibleSummary title="Cəmlər" storageKey="summary:kontaktlar-techizatci">
          <SummaryRow
            items={[
              { label: 'Təchizatçı', value: supTotals.count, meta: true },
              { label: 'Alınan məhsul (sətir)', value: supTotals.items, meta: true },
              { label: 'Alış cəmi', value: formatMoney(supTotals.total) },
            ]}
          />
        </CollapsibleSummary>
      )}

      <div className="card">
        {loading ? (
          <p className="empty-state">Yüklənir…</p>
        ) : tab === 'musteri' ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Ad Soyad</th>
                  <th>Telefon</th>
                  <th>Zamin</th>
                  <th style={{ textAlign: 'right' }}>Alış sayı</th>
                  <th style={{ textAlign: 'right' }}>Satış cəmi</th>
                  <th style={{ textAlign: 'right' }}>Verilib</th>
                  <th style={{ textAlign: 'right' }}>Qalan borc</th>
                  <th>Son ödəniş</th>
                  <th style={{ textAlign: 'right' }}>Borc / Nisyə</th>
                </tr>
              </thead>
              <tbody>
                {shownCustomers.map((c) => (
                  <tr key={c.id} className="data-table__row--clickable" onClick={() => setOpenCustomer(c)}>
                    <td><strong>{c.ad_soyad}</strong></td>
                    <td>{c.phones.join(', ') || '—'}</td>
                    <td>{c.zamin || '—'}</td>
                    <td style={{ textAlign: 'right' }}>{c.saleCount}</td>
                    <td style={{ textAlign: 'right' }}>{formatMoney(c.satis)}</td>
                    <td style={{ textAlign: 'right' }}>{formatMoney(c.verilib)}</td>
                    <td style={{ textAlign: 'right', color: c.qalan > 0 ? 'var(--color-accent)' : undefined }}>
                      {formatMoney(c.qalan)}
                    </td>
                    <td>{formatDate(c.lastPay)}</td>
                    <td style={{ textAlign: 'right' }}>
                      {c.ledger ? formatMoney(c.ledger.qaliq_borc + c.ledger.qaliq_nisye) : '—'}
                    </td>
                  </tr>
                ))}
                {!shownCustomers.length && (
                  <tr>
                    <td colSpan={9} className="empty-state">Müştəri tapılmadı.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Təchizatçı</th>
                  <th>Telefon (Depodan)</th>
                  <th style={{ textAlign: 'right' }}>Məhsul sayı</th>
                  <th style={{ textAlign: 'right' }}>Alış cəmi</th>
                  <th>Son alış</th>
                  <th style={{ textAlign: 'right' }}>Qalıq borc</th>
                  <th style={{ textAlign: 'right' }}>Qalıq nisyə</th>
                </tr>
              </thead>
              <tbody>
                {shownSuppliers.map((s) => (
                  <tr key={s.key} className="data-table__row--clickable" onClick={() => setOpenSupplier(s)}>
                    <td><strong>{s.name}</strong></td>
                    <td>{s.phone || '—'}</td>
                    <td style={{ textAlign: 'right' }}>{s.count}</td>
                    <td style={{ textAlign: 'right' }}>{formatMoney(s.total)}</td>
                    <td>{formatDate(s.lastDate)}</td>
                    <td style={{ textAlign: 'right' }}>{s.ledger ? formatMoney(s.ledger.qaliq_borc) : '—'}</td>
                    <td style={{ textAlign: 'right' }}>{s.ledger ? formatMoney(s.ledger.qaliq_nisye) : '—'}</td>
                  </tr>
                ))}
                {!shownSuppliers.length && (
                  <tr>
                    <td colSpan={7} className="empty-state">Təchizatçı tapılmadı.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {openCustomer && (
        <Modal
          title={openCustomer.ad_soyad}
          subtitle={[openCustomer.phones.join(', '), openCustomer.zamin ? `Zamin: ${openCustomer.zamin}` : '']
            .filter(Boolean)
            .join(' · ')}
          onClose={() => setOpenCustomer(null)}
        >
          <SummaryRow
            items={[
              { label: 'Alış sayı', value: openCustomer.saleCount, meta: true },
              { label: 'Satış cəmi', value: formatMoney(openCustomer.satis) },
              { label: 'Verilib', value: formatMoney(openCustomer.verilib) },
              { label: 'Qalan borc', value: formatMoney(openCustomer.qalan) },
            ]}
          />
          <h3 className="card__title">Alışları (Müştəri Bazası)</h3>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>№</th>
                  <th>Model</th>
                  <th>Verilmə tarixi</th>
                  <th style={{ textAlign: 'right' }}>Satış</th>
                  <th style={{ textAlign: 'right' }}>Verilib</th>
                  <th style={{ textAlign: 'right' }}>Qalan</th>
                  <th>Vəziyyət</th>
                </tr>
              </thead>
              <tbody>
                {openCustomer.sales.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <Link to={`/musteri-bazasi?open=${s.id}`}>{s.sira_no ?? '—'}</Link>
                    </td>
                    <td>{s.model || '—'}</td>
                    <td>{formatDate(s.verilme_tarixi)}</td>
                    <td style={{ textAlign: 'right' }}>{formatMoney(s.satis_qiymeti)}</td>
                    <td style={{ textAlign: 'right' }}>{formatMoney(s.verilib)}</td>
                    <td style={{ textAlign: 'right' }}>{formatMoney(s.qalan_borc)}</td>
                    <td>{s.veziyyet || '—'}</td>
                  </tr>
                ))}
                {!openCustomer.sales.length && (
                  <tr>
                    <td colSpan={7} className="empty-state">Bu müştəriyə bağlı satış yoxdur.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {openCustomer.ledger && (
            <p style={{ marginTop: 12 }}>
              Borc / Nisyə: qalıq borc <strong>{formatMoney(openCustomer.ledger.qaliq_borc)}</strong>, qalıq nisyə{' '}
              <strong>{formatMoney(openCustomer.ledger.qaliq_nisye)}</strong> ·{' '}
              <Link to={counterpartPath(openCustomer.ad_soyad)}>Borc / Nisyə səhifəsini aç</Link>
            </p>
          )}
        </Modal>
      )}

      {openSupplier && (
        <Modal
          title={openSupplier.name}
          subtitle={openSupplier.phone ? `Telefon: ${openSupplier.phone}` : 'Telefon qeyd olunmayıb'}
          onClose={() => setOpenSupplier(null)}
        >
          <SummaryRow
            items={[
              { label: 'Məhsul sayı', value: openSupplier.count, meta: true },
              { label: 'Alış cəmi', value: formatMoney(openSupplier.total) },
              { label: 'Son alış', value: formatDate(openSupplier.lastDate), meta: true },
            ]}
          />
          <h3 className="card__title">Ondan alınan məhsullar (Depo)</h3>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Tarix</th>
                  <th>Model</th>
                  <th>Rəng</th>
                  <th>Yaddaş</th>
                  <th>IMEI</th>
                  <th style={{ textAlign: 'right' }}>Qiymət</th>
                  <th>Vəziyyət</th>
                </tr>
              </thead>
              <tbody>
                {[...openSupplier.items]
                  .sort((a, b) => String(b.alis_tarixi || '').localeCompare(String(a.alis_tarixi || '')))
                  .map((d) => (
                    <tr key={d.id}>
                      <td>{formatDate(d.alis_tarixi)}</td>
                      <td>{d.model || '—'}</td>
                      <td>{d.reng || '—'}</td>
                      <td>{d.yaddas || '—'}</td>
                      <td>{d.imei_1 || '—'}</td>
                      <td style={{ textAlign: 'right' }}>{formatMoney(d.alis_qiymeti)}</td>
                      <td>{STATUS_LABELS[d.status] || d.status || '—'}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          {openSupplier.ledger && (
            <p style={{ marginTop: 12 }}>
              Borc / Nisyə: qalıq borc <strong>{formatMoney(openSupplier.ledger.qaliq_borc)}</strong>, qalıq nisyə{' '}
              <strong>{formatMoney(openSupplier.ledger.qaliq_nisye)}</strong> ·{' '}
              <Link to={counterpartPath(openSupplier.name)}>Borc / Nisyə səhifəsini aç</Link>
            </p>
          )}
        </Modal>
      )}
    </div>
  )
}
