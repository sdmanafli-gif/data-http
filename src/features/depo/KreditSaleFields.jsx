import MusteriSelect from '../musteri-bazasi/MusteriSelect'

/**
 * Kredit satış forması (Depo → Satış → Kredit).
 * Yuxarıda: Müştəri ID, Müqavilə nömrəsi, Satıcı, Satıcı faizi.
 * Açılıb-bağlanan bölmələr: Satış Məlumatları · Məhsul Məlumatları · Müştəri Məlumatları.
 */

/** Müştəri (Kontaktlar) vəsiqə / əlaqə sahələri — kredit formunda doldurulur */
export const KREDIT_KONTAKT_KEYS = [
  'sv_seriya',
  'fin_kod',
  'dogum_tarixi',
  'sv_verilme_tarixi',
  'sv_veren_orqan',
  'qeydiyyat_unvani',
  'yasayis_unvani',
  'nomre_1_kim',
  'nomre_2_kim',
  'nomre_3_kim',
  'nomre_4_kim',
  'nomre_5_kim',
]

/** SQL 39 ilə əlavə olunan sütunlar (baza hələ yenilənməyibsə yazılmır) */
export const KREDIT_KONTAKT_NEW_KEYS = new Set([
  'sv_veren_orqan',
  'nomre_1_kim',
  'nomre_2_kim',
  'nomre_3_kim',
  'nomre_4_kim',
  'nomre_5_kim',
])

export function emptyKreditKontakt() {
  return Object.fromEntries(KREDIT_KONTAKT_KEYS.map((k) => [k, '']))
}

export function kreditKontaktFromCustomer(c) {
  const out = emptyKreditKontakt()
  if (!c) return out
  for (const k of KREDIT_KONTAKT_KEYS) {
    const v = c[k]
    out[k] = v == null ? '' : String(v).slice(0, k.includes('tarixi') ? 10 : undefined)
  }
  return out
}

/** YYYY-MM-DD + n ay (günü saxlayır, ayın sonunu keçmir) */
export function addMonthsYmd(ymd, n) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(ymd || ''))
  if (!m) return ''
  const y = Number(m[1])
  const mo = Number(m[2]) - 1 + Number(n)
  const d = Number(m[3])
  const target = new Date(y, mo, 1)
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()
  const day = Math.min(d, last)
  const mm = String(target.getMonth() + 1).padStart(2, '0')
  const dd = String(day).padStart(2, '0')
  return `${target.getFullYear()}-${mm}-${dd}`
}

/** Bitmə tarixi = birinci aylıq ödəniş tarixi + (neçə ay − 1) ay */
export function computeBitmeTarixi(birinciTarix, neceAy) {
  const n = Number(neceAy)
  if (!birinciTarix || !Number.isFinite(n) || n <= 0) return ''
  return addMonthsYmd(birinciTarix, n - 1)
}

function Field({ label, hint, children }) {
  return (
    <div className="form-group">
      <label>{label}</label>
      {children}
      {hint ? <p>{hint}</p> : null}
    </div>
  )
}

function Section({ title, children }) {
  return (
    <details className="collapse-section" open>
      <summary className="collapse-section__title">{title}</summary>
      <div className="collapse-section__body depo-stack" style={{ paddingTop: 8 }}>
        {children}
      </div>
    </details>
  )
}

const ID_FIELDS = [
  { key: 'sv_seriya', label: 'Seriya Nömrəsi (şəxsiyyət vəsiqəsi)' },
  { key: 'fin_kod', label: 'FİN kodu (şəxsiyyət vəsiqəsi)' },
  { key: 'dogum_tarixi', label: 'Doğum Tarixi', type: 'date' },
  { key: 'sv_verilme_tarixi', label: 'Şəxsiyyət Vəsiqəsinin Verilmə Tarixi', type: 'date' },
  { key: 'sv_veren_orqan', label: 'Şəxsiyyət Vəsiqəsini Verən Orqan' },
  { key: 'qeydiyyat_unvani', label: 'Qeydiyyat Ünvanı' },
  { key: 'yasayis_unvani', label: 'Yaşayış Ünvanı' },
]

const MOBIL_KEYS = ['nomre_1', 'nomre_2', 'nomre_3', 'nomre_4', 'nomre_5']

export default function KreditSaleFields({
  basket,
  linePrices,
  onSatisChange,
  lineCihaz,
  cihazFields,
  emptyCihaz,
  onCihazChange,
  musteriForm,
  setMusteriField,
  saticiOptions = [],
  ilkinOdenis,
  onIlkinChange,
  ilkinOdenisVerilib,
  setIlkinOdenisVerilib,
  ilkinRemaining,
  ilkinQaliqTarixi,
  setIlkinQaliqTarixi,
  totalSatis,
  formatMoney,
  customers,
  selectValue,
  onSelectExisting,
  onSelectNew,
  mode,
  kontakt,
  setKontaktField,
  addPicker = null,
  onOpenAdd,
  onRemoveItem,
  barterSlot = null,
  barterAmount = 0,
  children,
}) {
  const bitme = computeBitmeTarixi(musteriForm.birinci_ayliq_odenis_tarixi, musteriForm.nece_ay)
  const v = (k) => musteriForm[k] ?? ''

  return (
    <div className="depo-stack kredit-stack">
      <Field label="Müştəri ID" hint="Avtomatik (növbəti nömrə)">
        <input readOnly value={v('sira_no') || '—'} />
      </Field>
      <Field label="Müqavilə nömrəsi">
        <input value={v('muqavile_nomresi')} onChange={(e) => setMusteriField('muqavile_nomresi', e.target.value)} />
      </Field>
      <Field label="Satıcı">
        <input
          list="kredit-satici-list"
          value={v('satici')}
          onChange={(e) => setMusteriField('satici', e.target.value)}
          autoComplete="off"
        />
        <datalist id="kredit-satici-list">
          {saticiOptions.map((o) => (
            <option key={o} value={o} />
          ))}
        </datalist>
      </Field>
      <Field label="Satıcı Faizi">
        <input
          type="number"
          step="0.01"
          value={v('satici_faizi')}
          onChange={(e) => setMusteriField('satici_faizi', e.target.value)}
        />
      </Field>

      <Section title="Satış Məlumatları">
        {basket.length === 1 ? (
          <Field label="Satış qiyməti *">
            <input
              type="number"
              step="0.01"
              required
              value={linePrices[basket[0].id]?.satis ?? ''}
              onChange={(e) => onSatisChange(basket[0].id, e.target.value)}
            />
          </Field>
        ) : (
          <>
            {basket.map((item) => (
              <Field key={item.id} label={`Satış qiyməti — ${item.model || '—'} *`}>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={linePrices[item.id]?.satis ?? ''}
                  onChange={(e) => onSatisChange(item.id, e.target.value)}
                />
              </Field>
            ))}
            <Field label="Ümumi satış qiyməti">
              <input readOnly value={formatMoney(totalSatis)} />
            </Field>
          </>
        )}
        <Field label="İlkin ödəniş" hint="Avtomatik: satış − (aylıq × neçə ay). Əl ilə dəyişə bilərsiniz.">
          <input type="number" step="0.01" min="0" value={ilkinOdenis} onChange={(e) => onIlkinChange(e.target.value)} />
        </Field>
        <Field
          label={barterAmount > 0 ? 'İlkin ödəniş verilib (nağd)' : 'İlkin ödəniş verilib'}
          hint={
            barterAmount > 0
              ? `+ barter ${formatMoney(barterAmount)} = cəmi ${formatMoney((Number(ilkinOdenisVerilib) || 0) + barterAmount)}`
              : 'Satışdan sonra Ödənişlər tabına əlavə olunur.'
          }
        >
          <input
            type="number"
            step="0.01"
            min="0"
            value={ilkinOdenisVerilib}
            onChange={(e) => setIlkinOdenisVerilib(e.target.value)}
          />
        </Field>
        {ilkinRemaining > 0.009 && (
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <div className="form-group" style={{ flex: '0 1 200px', display: 'block' }}>
              <label>Qalan ilkin ödəniş</label>
              <input readOnly value={formatMoney(ilkinRemaining)} />
            </div>
            <div className="form-group" style={{ flex: '0 1 200px', display: 'block' }}>
              <label>Qalan ilkin ödəniş tarixi *</label>
              <input
                type="date"
                required
                value={ilkinQaliqTarixi}
                onChange={(e) => setIlkinQaliqTarixi(e.target.value)}
              />
            </div>
          </div>
        )}
        <Field label="Aylıq ödəniş *">
          <input
            type="number"
            step="0.01"
            value={v('ayliq_odenis')}
            onChange={(e) => setMusteriField('ayliq_odenis', e.target.value)}
          />
        </Field>
        <Field label="Neçə ay *">
          <input type="number" step="1" value={v('nece_ay')} onChange={(e) => setMusteriField('nece_ay', e.target.value)} />
        </Field>
        <Field label="Ödəniş günü">
          <input
            type="number"
            step="1"
            min="1"
            max="31"
            value={v('odenis_gunu')}
            onChange={(e) => setMusteriField('odenis_gunu', e.target.value)}
          />
        </Field>
        <Field label="Birinci Aylıq Ödəniş Tarixi *">
          <input
            type="date"
            value={String(v('birinci_ayliq_odenis_tarixi')).slice(0, 10)}
            onChange={(e) => setMusteriField('birinci_ayliq_odenis_tarixi', e.target.value)}
          />
        </Field>
        <Field label="Verilmə Tarixi" hint="Avtomatik: bu gün">
          <input
            type="date"
            value={String(v('verilme_tarixi')).slice(0, 10)}
            onChange={(e) => setMusteriField('verilme_tarixi', e.target.value)}
          />
        </Field>
        <Field label="Bitmə Tarixi" hint="Avtomatik: birinci aylıq ödəniş tarixi + neçə ay">
          <input readOnly value={bitme ? bitme.split('-').reverse().join('.') : '—'} />
        </Field>
      </Section>

      <Section title="Məhsul Məlumatları">
        {basket.map((item, idx) => {
          const cihaz = lineCihaz[item.id] || emptyCihaz(item)
          return (
            <div key={item.id} className={basket.length > 1 ? 'depo-box' : undefined} style={{ display: 'grid', gap: 8 }}>
              {basket.length > 1 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <strong style={{ fontSize: 13 }}>
                    Məhsul {idx + 1}: {item.model || '—'}
                  </strong>
                  {onRemoveItem && (
                    <button
                      type="button"
                      className="btn btn--danger"
                      style={{ padding: '2px 10px', fontSize: 12 }}
                      onClick={() => onRemoveItem(item.id)}
                    >
                      Çıxar
                    </button>
                  )}
                </div>
              )}
              {cihazFields.map((f) => (
                <Field key={f.key} label={f.label}>
                  {f.editable ? (
                    <input value={cihaz[f.key] ?? ''} onChange={(e) => onCihazChange(item.id, f.key, e.target.value)} />
                  ) : (
                    <input readOnly value={cihaz[f.key] || '—'} />
                  )}
                </Field>
              ))}
            </div>
          )
        })}
        {onOpenAdd && !addPicker && (
          <div>
            <button type="button" className="btn btn--secondary" onClick={onOpenAdd}>
              + Əlavə məhsul
            </button>
          </div>
        )}
        {addPicker}
      </Section>

      <Section title="Müştəri Məlumatları">
        <MusteriSelect
          customers={customers}
          value={selectValue}
          onSelectExisting={onSelectExisting}
          onSelectNew={onSelectNew}
        />
        {mode !== 'pick' && (
          <>
            <Field label="Ad Soyad Ata adı *">
              <input required value={v('ad_soyad')} onChange={(e) => setMusteriField('ad_soyad', e.target.value)} />
            </Field>
            {ID_FIELDS.map((f) => (
              <Field key={f.key} label={f.label}>
                <input
                  type={f.type === 'date' ? 'date' : 'text'}
                  value={kontakt[f.key] ?? ''}
                  onChange={(e) => setKontaktField(f.key, e.target.value)}
                />
              </Field>
            ))}
            {MOBIL_KEYS.map((k, i) => (
              <div key={k} className="form-group">
                <label>Mobil {i + 1}</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <input
                    style={{ flex: '0 1 200px', minWidth: 0 }}
                    value={v(k)}
                    onChange={(e) => setMusteriField(k, e.target.value)}
                    placeholder="Nömrə"
                  />
                  <input
                    style={{ flex: '0 1 190px', minWidth: 0 }}
                    value={kontakt[`${k}_kim`] ?? ''}
                    onChange={(e) => setKontaktField(`${k}_kim`, e.target.value)}
                    placeholder="Kimdir (məs. özü, yoldaşı)"
                  />
                </div>
              </div>
            ))}
          </>
        )}
        {barterSlot}
      </Section>

      {children}
    </div>
  )
}
