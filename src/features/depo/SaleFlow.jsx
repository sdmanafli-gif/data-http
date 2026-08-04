import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { supabase, fetchAllPages } from '../../lib/supabase'
import MusteriSelect from '../musteri-bazasi/MusteriSelect'
import SuggestInput from '../musteri-bazasi/SuggestInput'
import {
  MUSTERI_TABLE,
  MUSTERILER_TABLE,
  NEW_MUSTERI_VALUE,
  VEZIYYET_OPTIONS,
  personFieldsFromMusteri,
  mergePersonPrefill,
  toMusterilerPayload,
  toMusteriPayload,
  formatMoney,
  applyVeziyyetFromAmounts,
} from '../musteri-bazasi/constants'
import { DEPO_TABLE, SALE_TYPES } from './constants'
import {
  NAGD_TABLE,
  depoItemToNagdPayload,
  formatMoney as formatNagdMoney,
  computeXeyirFaizle,
} from '../nagd-satish/constants'
import {
  LEDGER_TABLE,
  depoItemToLedgerPayload,
  counterpartPath,
} from '../borc-nisye/constants'
import '../../styles/shared.css'

function uniqueSorted(values) {
  return [...new Set(values.map((v) => String(v).trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, 'az')
  )
}

/**
 * Sale from Depo (basket):
 * 0) Review basket — add/remove items
 * 1) Choose type Kredit / Nağd / Borc·Nisyə
 * 2) Müştəri + terms → creates Müştəri Bazası / Nağd / Borc ledger + updates Depo
 */
export default function SaleFlow() {
  const { id: routeId } = useParams()
  const location = useLocation()
  const navigate = useNavigate()

  const initialIds = useMemo(() => {
    const fromState = location.state?.ids
    if (Array.isArray(fromState) && fromState.length) return [...new Set(fromState)]
    if (routeId) return [routeId]
    return []
  }, [location.state, routeId])

  const [basket, setBasket] = useState([])
  const [linePrices, setLinePrices] = useState({}) // id → { alis, satis }
  const [lineMehsul, setLineMehsul] = useState({}) // id → mehsul label
  const [ledgerNames, setLedgerNames] = useState([])
  const [ledgerMehsul, setLedgerMehsul] = useState([])
  const [availableExtras, setAvailableExtras] = useState([])
  const [showAddPicker, setShowAddPicker] = useState(false)
  const [step, setStep] = useState(0) // 0 basket, 1 type, 2 form
  const [saleType, setSaleType] = useState('')
  const [customers, setCustomers] = useState([])
  const [mode, setMode] = useState('pick')
  const [person, setPerson] = useState({
    musteri_id: '',
    ad_soyad: '',
    nomre_1: '',
    nomre_2: '',
    nomre_3: '',
    nomre_4: '',
    nomre_5: '',
    zamin: '',
  })
  const [form, setForm] = useState({
    verilib: '0',
    nece_ay: '',
    ayliq_odenis: '',
    odenis_gunu: '',
    birinci_ayliq_odenis_tarixi: '',
    verilme_tarixi: new Date().toISOString().slice(0, 10),
    bitme_tarixi: '',
    veziyyet: 'Qalıb',
    veziyyet_manual: false,
    satici: '',
    satici_faizi: '0',
    kommentler: '',
    ledger_tip: 'nisye_verdim',
    qaytarma_tarixi: '',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        if (!initialIds.length) throw new Error('Satış üçün məhsul seçilməyib.')

        const [{ data: cust }, { data: items, error: e1 }, { data: ledgerRows }, { data: depoModels }] =
          await Promise.all([
            fetchAllPages(() => supabase.from(MUSTERILER_TABLE).select('*').order('ad_soyad')),
            supabase.from(DEPO_TABLE).select('*').in('id', initialIds),
            fetchAllPages(() => supabase.from(LEDGER_TABLE).select('kime, mehsul')),
            fetchAllPages(() => supabase.from(DEPO_TABLE).select('model')),
          ])
        if (cancelled) return
        if (e1) throw e1

        const ordered = initialIds
          .map((iid) => (items || []).find((r) => r.id === iid))
          .filter(Boolean)

        if (!ordered.length) throw new Error('Məhsullar tapılmadı.')
        const notAvailable = ordered.filter((r) => r.status !== 'available')
        if (notAvailable.length) {
          throw new Error('Seçilmiş məhsullardan bəziləri satış üçün mövcud deyil.')
        }

        setBasket(ordered)
        setLinePrices(
          Object.fromEntries(
            ordered.map((r) => [
              r.id,
              {
                alis: r.alis_qiymeti != null ? String(r.alis_qiymeti) : '',
                satis: '',
              },
            ])
          )
        )
        setLineMehsul(Object.fromEntries(ordered.map((r) => [r.id, r.model || ''])))
        setCustomers(cust || [])
        setLedgerNames(uniqueSorted((ledgerRows || []).map((r) => r.kime)))
        setLedgerMehsul(
          uniqueSorted([
            ...(ledgerRows || []).map((r) => r.mehsul),
            ...(depoModels || []).map((r) => r.model),
            ...ordered.map((r) => r.model),
          ])
        )
      } catch (err) {
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [initialIds])

  async function loadExtras() {
    const inBasket = new Set(basket.map((b) => b.id))
    const { data, error: e } = await fetchAllPages(() =>
      supabase
        .from(DEPO_TABLE)
        .select('*')
        .eq('status', 'available')
        .order('sira_no', { ascending: true })
    )
    if (e) {
      setError(e.message)
      return
    }
    setAvailableExtras((data || []).filter((r) => !inBasket.has(r.id)))
  }

  function openAddPicker() {
    setShowAddPicker(true)
    loadExtras()
  }

  function addToBasket(item) {
    setBasket((prev) => [...prev, item])
    setLinePrices((prev) => ({
      ...prev,
      [item.id]: {
        alis: item.alis_qiymeti != null ? String(item.alis_qiymeti) : '',
        satis: '',
      },
    }))
    setLineMehsul((prev) => ({ ...prev, [item.id]: item.model || '' }))
    if (item.model) {
      setLedgerMehsul((prev) => uniqueSorted([...prev, item.model]))
    }
    setAvailableExtras((prev) => prev.filter((r) => r.id !== item.id))
  }

  function removeFromBasket(itemId) {
    if (basket.length <= 1) {
      setError('Səbətdə ən azı 1 məhsul olmalıdır.')
      return
    }
    setBasket((prev) => prev.filter((r) => r.id !== itemId))
    setLinePrices((prev) => {
      const next = { ...prev }
      delete next[itemId]
      return next
    })
    setLineMehsul((prev) => {
      const next = { ...prev }
      delete next[itemId]
      return next
    })
    setError(null)
  }

  const totals = useMemo(() => {
    let alis = 0
    let satis = 0
    for (const item of basket) {
      const lp = linePrices[item.id] || {}
      alis += Number(lp.alis) || 0
      satis += Number(lp.satis) || 0
    }
    const verilib = saleType === 'nagd' ? (Number(form.verilib) || satis) : Number(form.verilib) || 0
    return {
      alis,
      satis,
      gozlenilen: satis - alis,
      qalan: satis - verilib,
    }
  }, [basket, linePrices, form.verilib, saleType])

  function selectType(type) {
    setSaleType(type)
    setStep(2)
    const totalSatis = String(totals.satis || 0)
    if (type === 'borc_nisye') {
      setMode('new')
      setForm((prev) => ({
        ...prev,
        ledger_tip: 'nisye_verdim',
        verilib: '0',
        nece_ay: '',
        ayliq_odenis: '',
        odenis_gunu: '',
        birinci_ayliq_odenis_tarixi: '',
        bitme_tarixi: '',
      }))
      return
    }
    if (type === 'nagd') {
      setForm((prev) =>
        applyVeziyyetFromAmounts({
          ...prev,
          verilib: totalSatis,
          satis_qiymeti: totalSatis,
          nece_ay: '',
          ayliq_odenis: '',
          odenis_gunu: '',
          birinci_ayliq_odenis_tarixi: '',
          bitme_tarixi: '',
          veziyyet_manual: false,
        })
      )
    } else {
      setForm((prev) =>
        applyVeziyyetFromAmounts({
          ...prev,
          satis_qiymeti: totalSatis,
          veziyyet_manual: false,
        })
      )
    }
  }

  async function handleSelectExisting(customer) {
    setMode('existing')
    const { data: latest } = await supabase
      .from(MUSTERI_TABLE)
      .select('ad_soyad, nomre_1, nomre_2, nomre_3, nomre_4, nomre_5, zamin')
      .eq('musteri_id', customer.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    setPerson(mergePersonPrefill(customer, latest))
  }

  function handleSelectNew() {
    setMode('new')
    setPerson(personFieldsFromMusteri(null))
  }

  async function ensureMusteriId() {
    const payload = toMusterilerPayload(person)
    if (!payload.ad_soyad) throw new Error('Ad Soyad Ata adı doldurulmalıdır.')
    if (mode === 'existing' && person.musteri_id) {
      await supabase.from(MUSTERILER_TABLE).update(payload).eq('id', person.musteri_id)
      return person.musteri_id
    }
    const { data, error: e } = await supabase.from(MUSTERILER_TABLE).insert(payload).select('id').single()
    if (e) throw e
    return data.id
  }

  async function markDepoSold(item) {
    const currentQty = Math.max(1, Number(item.miqdar) || 1)
    const nextQty = currentQty - 1
    const patch = {
      miqdar: Math.max(0, nextQty),
      updated_at: new Date().toISOString(),
    }
    if (nextQty <= 0) {
      patch.status = 'sold'
      patch.sold_at = new Date().toISOString()
      patch.miqdar = 0
    }
    const { error: depoErr } = await supabase.from(DEPO_TABLE).update(patch).eq('id', item.id)
    if (depoErr) throw depoErr
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)

    for (const item of basket) {
      if (!linePrices[item.id]?.satis) {
        setError(`«${item.model || item.id}» üçün satış qiyməti doldurulmalıdır.`)
        return
      }
    }

    // —— Borc / Nisyə ledger sale ——
    if (saleType === 'borc_nisye') {
      const kime = String(person.ad_soyad || '').trim()
      if (!kime) {
        setError('Kontragent (Kimə) doldurulmalıdır.')
        return
      }
      if (!form.qaytarma_tarixi) {
        setError('Nisyə / borc satışı üçün qaytarma tarixi mütləqdir.')
        return
      }
      for (const item of basket) {
        const mehsul = String(lineMehsul[item.id] ?? item.model ?? '').trim()
        if (!mehsul) {
          setError(`«${item.model || item.id}» üçün məhsul adı doldurulmalıdır.`)
          return
        }
      }
      setSaving(true)
      try {
        for (const item of basket) {
          const lp = linePrices[item.id]
          const mehsul = String(lineMehsul[item.id] ?? item.model ?? '').trim()
          const payload = depoItemToLedgerPayload(item, {
            kime,
            tip: form.ledger_tip || 'nisye_verdim',
            tarix: form.verilme_tarixi,
            qaytarma_tarixi: form.qaytarma_tarixi || null,
            mebleg: lp.satis,
            mehsul,
            qeyd: form.kommentler || null,
          })
          const { error: ledErr } = await supabase.from(LEDGER_TABLE).insert(payload)
          if (ledErr) throw ledErr
          await markDepoSold(item)
        }
        navigate(counterpartPath(kime))
      } catch (err) {
        setError(err.message)
      } finally {
        setSaving(false)
      }
      return
    }

    if (mode === 'pick') {
      setError('Müştəri seçin və ya yeni yaradın.')
      return
    }
    if (saleType === 'kredit' && !form.nece_ay) {
      setError('Kredit üçün «Neçə ay» doldurulmalıdır.')
      return
    }
    if (saleType === 'kredit' && !form.birinci_ayliq_odenis_tarixi) {
      setError('Kredit üçün «Birinci aylıq ödəniş tarixi» doldurulmalıdır.')
      return
    }

    setSaving(true)
    try {
      const musteriId = await ensureMusteriId()

      for (const item of basket) {
        const lp = linePrices[item.id]
        const satis = lp.satis
        const alis = lp.alis

        if (saleType === 'nagd') {
          const payload = depoItemToNagdPayload(item, {
            kime: person.ad_soyad,
            musteriId,
            tarix: form.verilme_tarixi,
            alis,
            satis,
            satici: form.satici,
            saticiFaizi: form.satici_faizi,
            kommentler: form.kommentler,
          })
          const { error: nagdErr } = await supabase.from(NAGD_TABLE).insert(payload)
          if (nagdErr) throw nagdErr
          await markDepoSold(item)
          continue
        }

        const verilib =
          basket.length === 1
            ? form.verilib || '0'
            : '0'

        const saleForm = {
          ...person,
          alis_qiymeti: alis,
          satis_qiymeti: satis,
          verilib,
          faiz: '0',
          nece_ay: form.nece_ay,
          ayliq_odenis: form.ayliq_odenis,
          odenis_gunu: form.odenis_gunu,
          birinci_ayliq_odenis_tarixi: form.birinci_ayliq_odenis_tarixi,
          verilme_tarixi: form.verilme_tarixi,
          bitme_tarixi: form.bitme_tarixi,
          veziyyet: form.veziyyet || 'Qalıb',
          veziyyet_manual: Boolean(form.veziyyet_manual),
          model: item.model || '',
          reng: item.reng || '',
          yaddas: item.yaddas || '',
          imei_1: item.imei_1 || '',
          imei_2: item.imei_2 || '',
          battery_faiz: item.battery_faiz != null ? String(item.battery_faiz) : '',
          kimden_alinib: item.kimden_alinib || '',
          kommentler: form.kommentler || '',
          extra: {},
        }

        const payload = {
          ...toMusteriPayload(saleForm, musteriId),
          depo_id: item.id,
          satis_novu: saleType,
        }

        const { error: saleErr } = await supabase.from(MUSTERI_TABLE).insert(payload)
        if (saleErr) throw saleErr
        await markDepoSold(item)
      }

      navigate(saleType === 'nagd' ? '/nagd-satish' : '/musteri-bazasi')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="card"><p className="empty-state">Yüklənir…</p></div>
  if (!basket.length) {
    return (
      <div className="card">
        <p style={{ color: 'var(--color-accent)' }}>{error || 'Səbət boşdur'}</p>
        <Link to="/depo" className="btn btn--secondary">Depoya qayıt</Link>
      </div>
    )
  }

  const selectValue = mode === 'new' ? NEW_MUSTERI_VALUE : person.musteri_id || ''

  return (
    <div className="card">
      <div className="page-header" style={{ marginBottom: 16 }}>
        <h2 className="card__title" style={{ margin: 0 }}>
          Satış səbəti ({basket.length})
        </h2>
        <Link to="/depo" className="btn btn--secondary">Geri</Link>
      </div>

      {error && <p style={{ color: 'var(--color-accent)', marginBottom: 12 }}>{error}</p>}

      {/* Basket always visible as summary when past step 0 */}
      {step > 0 && (
        <div style={{ marginBottom: 16, padding: 12, background: 'var(--color-bg)', borderRadius: 6, fontSize: 13 }}>
          {basket.map((item) => (
            <div key={item.id}>
              {item.model || '—'} · {item.reng || '—'} · IMEI {item.imei_1 || '—'}
              {' · '}Satış: {formatMoney(linePrices[item.id]?.satis)}
            </div>
          ))}
          <button type="button" className="btn btn--secondary" style={{ marginTop: 8 }} onClick={() => setStep(0)}>
            Səbəti dəyiş
          </button>
        </div>
      )}

      {step === 0 && (
        <>
          <h3 className="card__title">Səbətdəki məhsullar</h3>
          <div className="table-wrap" style={{ marginBottom: 16 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Model</th>
                  <th>Rəng</th>
                  <th>IMEI</th>
                  <th>Miqdar</th>
                  <th>Alış</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {basket.map((item) => (
                  <tr key={item.id}>
                    <td>{item.model || '—'}</td>
                    <td>{item.reng || '—'}</td>
                    <td>{item.imei_1 || '—'}</td>
                    <td className="num">{item.miqdar ?? 1}</td>
                    <td className="num">{formatMoney(item.alis_qiymeti)}</td>
                    <td>
                      <button
                        type="button"
                        className="btn btn--danger"
                        disabled={basket.length <= 1}
                        onClick={() => removeFromBasket(item.id)}
                      >
                        Çıxar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
            <button type="button" className="btn btn--secondary" onClick={openAddPicker}>
              Əlavə məhsul əlavə et
            </button>
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => {
                setShowAddPicker(false)
                setStep(1)
              }}
            >
              Davam et — satış növü
            </button>
          </div>

          {showAddPicker && (
            <div style={{ border: '1px solid var(--color-border)', borderRadius: 8, padding: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <h3 className="card__title" style={{ margin: 0 }}>Mövcud məhsullardan seçin</h3>
                <button type="button" className="btn btn--secondary" onClick={() => setShowAddPicker(false)}>
                  Bağla
                </button>
              </div>
              {availableExtras.length === 0 ? (
                <p className="empty-state">Əlavə edilə biləcək məhsul yoxdur.</p>
              ) : (
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Model</th>
                        <th>Rəng</th>
                        <th>IMEI</th>
                        <th>Qiymət</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {availableExtras.map((item) => (
                        <tr key={item.id}>
                          <td>{item.model || '—'}</td>
                          <td>{item.reng || '—'}</td>
                          <td>{item.imei_1 || '—'}</td>
                          <td className="num">{formatMoney(item.alis_qiymeti)}</td>
                          <td>
                            <button type="button" className="btn btn--primary" onClick={() => addToBasket(item)}>
                              Səbətə əlavə et
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {step === 1 && (
        <>
          <h3 className="card__title">Satış növünü seçin</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
            {SALE_TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                className="btn btn--secondary"
                style={{ padding: '20px 16px', fontSize: 16, fontWeight: 600 }}
                onClick={() => selectType(t.value)}
              >
                {t.label}
              </button>
            ))}
          </div>
          <p style={{ marginTop: 16, fontSize: 13, color: 'var(--color-text-muted)' }}>
            Kredit — aylıq şərtlər · Nağd — nağd satış · Borc / Nisyə — kontragent jurnalı
          </p>
        </>
      )}

      {step === 2 && (
        <form onSubmit={handleSubmit}>
          <p style={{ marginBottom: 16 }}>
            Satış növü: <strong>{SALE_TYPES.find((t) => t.value === saleType)?.label}</strong>{' '}
            <button type="button" className="btn btn--secondary" style={{ marginLeft: 8 }} onClick={() => setStep(1)}>
              Dəyiş
            </button>
          </p>

          {saleType === 'borc_nisye' ? (
            <>
              <SuggestInput
                id="sale-borc-kime"
                label="Kontragent (Kimə)"
                value={person.ad_soyad}
                onChange={(v) => setPerson((p) => ({ ...p, ad_soyad: v }))}
                options={ledgerNames}
                placeholder="Mövcuddan seçin və ya yeni yazın…"
                required
              />

              <div className="form-group">
                <label>Əməliyyat</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {[
                    { value: 'nisye_verdim', label: 'Nisyə verdim' },
                    { value: 'borc_verdim', label: 'Borc verdim' },
                  ].map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      className={`btn ${form.ledger_tip === t.value ? 'btn--primary' : 'btn--secondary'}`}
                      onClick={() => setForm((f) => ({ ...f, ledger_tip: t.value }))}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label>Tarix</label>
                <input
                  type="date"
                  value={form.verilme_tarixi}
                  onChange={(e) => setForm((f) => ({ ...f, verilme_tarixi: e.target.value }))}
                />
              </div>

              <div className="form-group">
                <label>Qaytarma / ödəniş tarixi *</label>
                <input
                  type="date"
                  value={form.qaytarma_tarixi || ''}
                  onChange={(e) => setForm((f) => ({ ...f, qaytarma_tarixi: e.target.value }))}
                  required
                />
                <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--color-text-muted)' }}>
                  Nə vaxt məbləğ alınmalı / ödənilməlidir (kalendarda görünəcək)
                </p>
              </div>

              <h3 className="card__title">Məhsul qiymətləri</h3>
              {basket.map((item) => (
                <div key={item.id} style={{ marginBottom: 16 }}>
                  <p style={{ margin: '0 0 8px', fontSize: 13, color: 'var(--color-text-muted)' }}>
                    Depo: {item.model || '—'} · {item.reng || '—'} · {item.imei_1 || '—'}
                  </p>
                  <div className="form-row" style={{ alignItems: 'flex-end' }}>
                    <div style={{ flex: '2 1 200px' }}>
                      <SuggestInput
                        id={`sale-borc-mehsul-${item.id}`}
                        label="Məhsul"
                        value={lineMehsul[item.id] ?? ''}
                        onChange={(v) => setLineMehsul((prev) => ({ ...prev, [item.id]: v }))}
                        options={ledgerMehsul}
                        placeholder="Mövcuddan seçin və ya yeni yazın…"
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>Alış</label>
                      <input
                        type="number"
                        step="0.01"
                        value={linePrices[item.id]?.alis ?? ''}
                        onChange={(e) =>
                          setLinePrices((prev) => ({
                            ...prev,
                            [item.id]: { ...prev[item.id], alis: e.target.value },
                          }))
                        }
                      />
                    </div>
                    <div className="form-group">
                      <label>Satış (məbləğ) *</label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        value={linePrices[item.id]?.satis ?? ''}
                        onChange={(e) =>
                          setLinePrices((prev) => ({
                            ...prev,
                            [item.id]: { ...prev[item.id], satis: e.target.value },
                          }))
                        }
                      />
                    </div>
                  </div>
                </div>
              ))}

              <div className="form-group">
                <label>Qeyd</label>
                <textarea
                  rows={2}
                  value={form.kommentler}
                  onChange={(e) => setForm((f) => ({ ...f, kommentler: e.target.value }))}
                />
              </div>

              {error && <p style={{ color: 'var(--color-accent)' }}>{error}</p>}

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16 }}>
                <button type="button" className="btn btn--secondary" onClick={() => setStep(0)}>
                  Səbətə qayıt
                </button>
                <button type="submit" className="btn btn--primary" disabled={saving}>
                  {saving ? 'Saxlanılır…' : `Satışı tamamla (${basket.length})`}
                </button>
              </div>
            </>
          ) : (
            <>
          <MusteriSelect
            customers={customers}
            value={selectValue}
            onSelectExisting={handleSelectExisting}
            onSelectNew={handleSelectNew}
          />

          {(mode === 'new' || mode === 'existing') && (
            <>
              <div className="form-row">
                <div className="form-group">
                  <label>Ad Soyad Ata adı *</label>
                  <input
                    value={person.ad_soyad}
                    onChange={(e) => setPerson((p) => ({ ...p, ad_soyad: e.target.value }))}
                    required
                  />
                </div>
                {['nomre_1', 'nomre_2', 'nomre_3'].map((k, i) => (
                  <div className="form-group" key={k}>
                    <label>Nömrə {i + 1}</label>
                    <input value={person[k]} onChange={(e) => setPerson((p) => ({ ...p, [k]: e.target.value }))} />
                  </div>
                ))}
                <div className="form-group">
                  <label>Zamin</label>
                  <input value={person.zamin} onChange={(e) => setPerson((p) => ({ ...p, zamin: e.target.value }))} />
                </div>
              </div>

              <hr style={{ border: 0, borderTop: '1px solid var(--color-border)', margin: '20px 0' }} />

              <h3 className="card__title">Məhsul qiymətləri</h3>
              {basket.map((item) => (
                <div key={item.id} className="form-row" style={{ alignItems: 'flex-end' }}>
                  <div className="form-group" style={{ flex: '2 1 200px' }}>
                    <label>Məhsul</label>
                    <input
                      readOnly
                      value={`${item.model || '—'} · ${item.reng || '—'} · ${item.imei_1 || '—'}`}
                    />
                  </div>
                  <div className="form-group">
                    <label>Alış</label>
                    <input
                      type="number"
                      step="0.01"
                      value={linePrices[item.id]?.alis ?? ''}
                      onChange={(e) =>
                        setLinePrices((prev) => ({
                          ...prev,
                          [item.id]: { ...prev[item.id], alis: e.target.value },
                        }))
                      }
                    />
                  </div>
                  <div className="form-group">
                    <label>Satış *</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={linePrices[item.id]?.satis ?? ''}
                      onChange={(e) => {
                        const v = e.target.value
                        setLinePrices((prev) => ({
                          ...prev,
                          [item.id]: { ...prev[item.id], satis: v },
                        }))
                        if (saleType === 'nagd' && basket.length === 1) {
                          setForm((f) => ({ ...f, verilib: v }))
                        }
                      }}
                    />
                  </div>
                </div>
              ))}

              <div className="form-row">
                {saleType !== 'nagd' && basket.length === 1 && (
                  <div className="form-group">
                    <label>İlkin ödəniş / Verilib</label>
                    <input
                      type="number"
                      step="0.01"
                      value={form.verilib}
                      onChange={(e) => setForm((f) => ({ ...f, verilib: e.target.value }))}
                    />
                  </div>
                )}
                <div className="form-group">
                  <label>{saleType === 'nagd' ? 'Ümumi xeyir (satış − alış)' : 'Ümumi gözlənilən gəlir'}</label>
                  <input readOnly value={formatMoney(totals.gozlenilen)} />
                </div>
                <div className="form-group">
                  <label>Ümumi satış</label>
                  <input readOnly value={formatMoney(totals.satis)} />
                </div>
                {saleType !== 'nagd' && (
                  <div className="form-group">
                    <label>Vəziyyət</label>
                    <select
                      value={form.veziyyet}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, veziyyet: e.target.value, veziyyet_manual: true }))
                      }
                    >
                      {VEZIYYET_OPTIONS.map((o) => (
                        <option key={o} value={o}>{o}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {saleType === 'nagd' && (
                <div className="form-row">
                  <div className="form-group">
                    <label>Satış tarixi</label>
                    <input type="date" value={form.verilme_tarixi} onChange={(e) => setForm((f) => ({ ...f, verilme_tarixi: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label>Satıcı</label>
                    <input value={form.satici} onChange={(e) => setForm((f) => ({ ...f, satici: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label>Satıcı Faizi</label>
                    <input
                      type="number"
                      step="0.01"
                      value={form.satici_faizi}
                      onChange={(e) => setForm((f) => ({ ...f, satici_faizi: e.target.value }))}
                    />
                  </div>
                  <div className="form-group">
                    <label>Xeyir (Faizlə)</label>
                    <input
                      readOnly
                      value={formatNagdMoney(
                        computeXeyirFaizle(totals.alis, totals.satis, form.satici_faizi)
                      )}
                    />
                  </div>
                </div>
              )}

              {saleType === 'kredit' && (
                <div className="form-row">
                  <div className="form-group">
                    <label>Neçə ay *</label>
                    <input type="number" required value={form.nece_ay} onChange={(e) => setForm((f) => ({ ...f, nece_ay: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label>Aylıq ödəniş</label>
                    <input type="number" step="0.01" value={form.ayliq_odenis} onChange={(e) => setForm((f) => ({ ...f, ayliq_odenis: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label>Ödəniş günü (1–31)</label>
                    <input type="number" min={1} max={31} value={form.odenis_gunu} onChange={(e) => setForm((f) => ({ ...f, odenis_gunu: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label>Birinci aylıq ödəniş tarixi *</label>
                    <input
                      type="date"
                      required
                      value={form.birinci_ayliq_odenis_tarixi}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, birinci_ayliq_odenis_tarixi: e.target.value }))
                      }
                    />
                    <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--color-text-muted)' }}>
                      Ödəniş cədvəli bu tarixdən başlayır; növbəti aylar eyni gündə hesablanır.
                    </p>
                  </div>
                  <div className="form-group">
                    <label>Verilmə tarixi</label>
                    <input type="date" value={form.verilme_tarixi} onChange={(e) => setForm((f) => ({ ...f, verilme_tarixi: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label>Bitmə tarixi</label>
                    <input type="date" value={form.bitme_tarixi} onChange={(e) => setForm((f) => ({ ...f, bitme_tarixi: e.target.value }))} />
                  </div>
                </div>
              )}

              <div className="form-group">
                <label>Kommentlər</label>
                <input value={form.kommentler} onChange={(e) => setForm((f) => ({ ...f, kommentler: e.target.value }))} />
              </div>
            </>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button type="submit" className="btn btn--primary" disabled={saving || mode === 'pick'}>
              {saving ? 'Saxlanılır…' : `Satışı tamamla (${basket.length})`}
            </button>
            <Link to="/depo" className="btn btn--secondary">Ləğv et</Link>
          </div>
            </>
          )}
        </form>
      )}
    </div>
  )
}
