import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { supabase, fetchAllPages } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { confirmDelete } from '../../lib/confirmDelete'
import ClientPicker from './ClientPicker'
import RecordModule from '../../components/RecordModule'
import {
  ODENISLER_TABLE,
  MUSTERI_TABLE,
  ODENIS_KARTLAR_TABLE,
  PAYMENT_TYPES,
  ODENIS_USULU_OPTIONS,
  emptyOdenisForm,
  toOdenisPayload,
  rowToForm,
  tipLabel,
  usuluLabel,
  formatMoney,
  formatDate,
  syncMusteriPaymentTotals,
  ensureOdenisKart,
} from './constants'
import '../../styles/shared.css'
import '../../components/record-module.css'

export default function OdenisForm() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const { user } = useAuth()
  const prefMusteri = searchParams.get('musteri') || ''
  const startInEdit = searchParams.get('edit') === '1'

  const [form, setForm] = useState(() => emptyOdenisForm())
  const [record, setRecord] = useState(null)
  const [clients, setClients] = useState([])
  const [knownCards, setKnownCards] = useState([])
  const [enteringNewCard, setEnteringNewCard] = useState(false)
  const [editing, setEditing] = useState(!isEdit || startInEdit)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const [{ data: clientRows, error: cErr }, cardsRes, paysRes] = await Promise.all([
          fetchAllPages(() =>
            supabase
              .from(MUSTERI_TABLE)
              .select('id, sira_no, ad_soyad, model, ayliq_odenis, satis_qiymeti, verilib, faiz, veziyyet')
              .order('sira_no', { ascending: true })
          ),
          supabase.from(ODENIS_KARTLAR_TABLE).select('kart_nomresi').order('kart_nomresi'),
          supabase
            .from(ODENISLER_TABLE)
            .select('kart_nomresi')
            .eq('odenis_usulu', 'kart')
            .not('kart_nomresi', 'is', null)
            .limit(500),
        ])
        if (cErr) throw cErr
        if (cancelled) return
        setClients(clientRows || [])
        const fromTable = (cardsRes.data || []).map((r) => r.kart_nomresi).filter(Boolean)
        const fromPays = (paysRes.data || []).map((r) => r.kart_nomresi).filter(Boolean)
        const merged = [...new Set([...fromTable, ...fromPays])]
        setKnownCards(merged.sort((a, b) => a.localeCompare(b, 'az')))

        if (isEdit) {
          const { data, error: e } = await supabase
            .from(ODENISLER_TABLE)
            .select('*, musteri_bazasi(veziyyet)')
            .eq('id', id)
            .single()
          if (cancelled) return
          if (e) throw e
          const related = data.musteri_bazasi
          const veziyyet = Array.isArray(related) ? related[0]?.veziyyet : related?.veziyyet
          const { musteri_bazasi: _join, ...rest } = data
          const row = { ...rest, veziyyet: veziyyet || null }
          setRecord(row)
          setForm(rowToForm(row))
          setEnteringNewCard(
            row.odenis_usulu === 'kart' &&
              Boolean(row.kart_nomresi) &&
              !(cardsRes.data || []).some((c) => c.kart_nomresi === row.kart_nomresi) &&
              !(paysRes.data || []).some((c) => c.kart_nomresi === row.kart_nomresi)
          )
          setEditing(startInEdit)
        } else {
          let prefill = {}
          if (prefMusteri) {
            const found = (clientRows || []).find((c) => c.id === prefMusteri)
            if (found) {
              prefill = {
                musteri_bazasi_id: found.id,
                sira_no: found.sira_no,
                ad_soyad: found.ad_soyad,
              }
            }
          }
          setRecord(null)
          setForm(emptyOdenisForm(prefill))
          setEditing(true)
        }
      } catch (err) {
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [id, isEdit, prefMusteri, startInEdit])

  function onClientSelect(client) {
    if (!client) {
      setForm((f) => ({
        ...f,
        musteri_bazasi_id: '',
        sira_no: '',
        ad_soyad: '',
      }))
      return
    }
    setForm((f) => ({
      ...f,
      musteri_bazasi_id: client.id,
      sira_no: client.sira_no != null ? String(client.sira_no) : '',
      ad_soyad: client.ad_soyad || '',
      mebleg:
        f.tip === 'ayliq' && !f.mebleg && client.ayliq_odenis != null
          ? String(client.ayliq_odenis)
          : f.mebleg,
    }))
  }

  function onTipChange(tip) {
    setForm((f) => {
      const client = clients.find((c) => c.id === f.musteri_bazasi_id)
      let mebleg = f.mebleg
      if (tip === 'ayliq' && !mebleg && client?.ayliq_odenis != null) {
        mebleg = String(client.ayliq_odenis)
      }
      return { ...f, tip, mebleg }
    })
  }

  async function onSubmit(e) {
    e.preventDefault()
    setError(null)
    const payload = toOdenisPayload(form)
    if (!payload.musteri_bazasi_id) {
      setError('Müştəri seçin.')
      return
    }
    if (!payload.ad_soyad) {
      setError('Ad Soyad mütləqdir.')
      return
    }
    if (!payload.tip) {
      setError('Ödəniş tipini seçin.')
      return
    }
    if (payload.mebleg == null || payload.mebleg <= 0) {
      setError('Məbləğ 0-dan böyük olmalıdır.')
      return
    }
    if (!payload.tarix) {
      setError('Tarix mütləqdir.')
      return
    }
    if (payload.odenis_usulu === 'kart' && !payload.kart_nomresi) {
      setError('Kart seçin və ya kart nömrəsini daxil edin.')
      return
    }

    if (!isEdit && user?.id) {
      payload.created_by = user.id
    }

    setSaving(true)
    try {
      const prevMusteriId = record?.musteri_bazasi_id || null
      let err
      let newId = id
      if (isEdit) {
        ;({ error: err } = await supabase.from(ODENISLER_TABLE).update(payload).eq('id', id))
      } else {
        const { data: created, error: insErr } = await supabase
          .from(ODENISLER_TABLE)
          .insert(payload)
          .select('id')
          .single()
        err = insErr
        newId = created?.id
      }
      if (err) throw err

      if (payload.odenis_usulu === 'kart' && payload.kart_nomresi) {
        await ensureOdenisKart(supabase, payload.kart_nomresi, user?.id)
        setKnownCards((prev) =>
          prev.includes(payload.kart_nomresi)
            ? prev
            : [...prev, payload.kart_nomresi].sort((a, b) => a.localeCompare(b, 'az'))
        )
      }

      const syncIds = new Set([payload.musteri_bazasi_id])
      if (prevMusteriId && prevMusteriId !== payload.musteri_bazasi_id) {
        syncIds.add(prevMusteriId)
      }
      for (const mid of syncIds) {
        const { error: syncErr } = await syncMusteriPaymentTotals(supabase, mid)
        if (syncErr) throw syncErr
      }

      if (isEdit) {
        const { data: refreshed } = await supabase.from(ODENISLER_TABLE).select('*').eq('id', id).single()
        if (refreshed) {
          setRecord(refreshed)
          setForm(rowToForm(refreshed))
        }
        setEditing(false)
      } else if (newId) {
        navigate(`/odenisler/${newId}`)
      } else {
        navigate('/odenisler')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function onDelete() {
    if (!id || !record) return
    if (!confirmDelete('Bu ödəniş silinsin?')) return
    setDeleting(true)
    setError(null)
    try {
      const mid = record.musteri_bazasi_id
      const { error: err } = await supabase.from(ODENISLER_TABLE).delete().eq('id', id)
      if (err) throw err
      if (mid) {
        const { error: syncErr } = await syncMusteriPaymentTotals(supabase, mid)
        if (syncErr) throw syncErr
      }
      navigate('/odenisler')
    } catch (err) {
      setError(err.message)
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return <div className="card"><p className="empty-state">Yüklənir…</p></div>
  }

  if (isEdit && !editing && record) {
    return (
      <RecordModule
        title={record.ad_soyad || 'Ödəniş'}
        subtitle={[
          record.sira_no != null ? `# ${record.sira_no}` : null,
          tipLabel(record.tip),
          formatDate(record.tarix),
        ]
          .filter(Boolean)
          .join(' · ')}
        columns={[
          { key: 'sira_no', label: '# / №' },
          { key: 'ad_soyad', label: 'Ad Soyad Ata adı' },
          { key: 'veziyyet', label: 'Vəziyyət' },
          { key: 'tip', label: 'Tip' },
          { key: 'mebleg', label: 'Məbləğ' },
          { key: 'odenis_usulu', label: 'Üsul' },
          { key: 'kart_nomresi', label: 'Kart' },
          { key: 'tarix', label: 'Tarix' },
          { key: 'qeyd', label: 'Qeyd' },
        ]}
        row={record}
        formatCell={(value, col) => {
          if (col?.key === 'tip') return tipLabel(value)
          if (col?.key === 'odenis_usulu') return usuluLabel(value)
          if (col?.key === 'mebleg') return formatMoney(value)
          if (col?.key === 'tarix') return formatDate(value)
          if (value == null || value === '') return '—'
          return String(value)
        }}
        getRowValue={(row, col) => row?.[col.key]}
        actions={
          <>
            <button type="button" className="btn btn--primary" onClick={() => setEditing(true)}>
              Redaktə
            </button>
            <button
              type="button"
              className="btn btn--secondary"
              disabled={deleting}
              onClick={onDelete}
              style={{ color: 'var(--color-accent)' }}
            >
              {deleting ? 'Silinir…' : 'Sil'}
            </button>
            <Link to="/odenisler" className="btn btn--secondary">Siyahıya qayıt</Link>
            {record.musteri_bazasi_id && (
              <Link
                to={`/musteri-bazasi?open=${record.musteri_bazasi_id}`}
                className="btn btn--secondary"
              >
                Müştəriyə keç
              </Link>
            )}
          </>
        }
      />
    )
  }

  return (
    <div className="card">
      <div className="page-header" style={{ marginBottom: 16 }}>
        <h2 className="card__title" style={{ margin: 0 }}>
          {isEdit ? 'Ödənişi redaktə et' : 'Yeni ödəniş'}
        </h2>
        <Link to="/odenisler" className="btn btn--secondary">Geri</Link>
      </div>

      {error && <p style={{ color: 'var(--color-accent)' }}>{error}</p>}

      <form onSubmit={onSubmit} className="form-grid">
        <ClientPicker
          clients={clients}
          valueId={form.musteri_bazasi_id}
          onSelect={onClientSelect}
          disabled={saving}
        />

        <div className="form-group">
          <label># / №</label>
          <input readOnly value={form.sira_no || '—'} />
        </div>

        <div className="form-group">
          <label>Ad Soyad Ata adı</label>
          <input readOnly value={form.ad_soyad || '—'} />
        </div>

        <div className="form-group">
          <label htmlFor="odenis-tip">Ödəniş tipi *</label>
          <select
            id="odenis-tip"
            value={form.tip}
            onChange={(e) => onTipChange(e.target.value)}
            required
            disabled={saving}
          >
            {PAYMENT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="odenis-mebleg">Məbləğ *</label>
          <input
            id="odenis-mebleg"
            type="number"
            step="0.01"
            min="0.01"
            value={form.mebleg}
            onChange={(e) => setForm((f) => ({ ...f, mebleg: e.target.value }))}
            required
            disabled={saving}
          />
        </div>

        <div className="form-group">
          <label htmlFor="odenis-tarix">Tarix *</label>
          <input
            id="odenis-tarix"
            type="date"
            value={form.tarix}
            onChange={(e) => setForm((f) => ({ ...f, tarix: e.target.value }))}
            required
            disabled={saving}
          />
        </div>

        <div className="form-group">
          <label htmlFor="odenis-usulu">Ödəniş üsulu *</label>
          <select
            id="odenis-usulu"
            value={form.odenis_usulu || 'nagd'}
            onChange={(e) => {
              const usulu = e.target.value
              setEnteringNewCard(false)
              setForm((f) => ({
                ...f,
                odenis_usulu: usulu,
                kart_nomresi: usulu === 'nagd' ? '' : f.kart_nomresi,
              }))
            }}
            required
            disabled={saving}
          >
            {ODENIS_USULU_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {form.odenis_usulu === 'kart' && (
          <div className="form-group">
            <label htmlFor="odenis-kart">Kart nömrəsi *</label>
            {knownCards.length > 0 ? (
              <select
                id="odenis-kart"
                value={
                  enteringNewCard
                    ? '__new__'
                    : knownCards.includes(form.kart_nomresi)
                      ? form.kart_nomresi
                      : ''
                }
                onChange={(e) => {
                  const v = e.target.value
                  if (v === '__new__') {
                    setEnteringNewCard(true)
                    setForm((f) => ({ ...f, kart_nomresi: '' }))
                  } else {
                    setEnteringNewCard(false)
                    setForm((f) => ({ ...f, kart_nomresi: v }))
                  }
                }}
                disabled={saving}
                required={!enteringNewCard}
              >
                <option value="">Kart seçin…</option>
                {knownCards.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
                <option value="__new__">+ Yeni kart…</option>
              </select>
            ) : null}
            {(knownCards.length === 0 || enteringNewCard) && (
              <input
                id="odenis-kart-input"
                value={form.kart_nomresi}
                onChange={(e) => setForm((f) => ({ ...f, kart_nomresi: e.target.value }))}
                placeholder="Kart nömrəsini yazın"
                required
                disabled={saving}
                style={{ marginTop: knownCards.length ? 8 : 0 }}
              />
            )}
          </div>
        )}

        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
          <label htmlFor="odenis-qeyd">Qeyd</label>
          <input
            id="odenis-qeyd"
            value={form.qeyd}
            onChange={(e) => setForm((f) => ({ ...f, qeyd: e.target.value }))}
            disabled={saving}
          />
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', gridColumn: '1 / -1' }}>
          <button type="submit" className="btn btn--primary" disabled={saving}>
            {saving ? 'Saxlanır…' : 'Saxla'}
          </button>
          {isEdit && (
            <button type="button" className="btn btn--secondary" onClick={() => setEditing(false)}>
              Ləğv et
            </button>
          )}
        </div>
      </form>
    </div>
  )
}
