import MuqavileYarat from './MuqavileYarat'

/** Barter: müştəri köhnə cihazını verir, dəyəri kredit üzrə ilkin ödənişə sayılır */
export const EMPTY_BARTER = {
  aktiv: false,
  kateqoriya: 'Telefon',
  nov: '',
  model: '',
  reng: '',
  yaddas: '',
  imei_1: '',
  imei_2: '',
  serial_no: '',
  veziyyet: '',
  qiymet: '',
}

const YADDAS = ['32 Gb', '64 Gb', '128 Gb', '256 Gb', '512 Gb', '1 Tb', '2 Tb']

export function barterAmount(b) {
  if (!b?.aktiv) return 0
  return Math.max(0, Math.round((Number(b.qiymet) || 0) * 100) / 100)
}

export function barterMissing(b) {
  if (!b?.aktiv) return ''
  if (!String(b.model || '').trim()) return 'Barter cihazının modelini yazın.'
  if (!(Number(b.qiymet) > 0)) return 'Barter cihazının qiymətini (AZN) yazın.'
  return ''
}

function Row({ label, children, hint }) {
  return (
    <div className="form-group">
      <label>{label}</label>
      {children}
      {hint ? <p>{hint}</p> : null}
    </div>
  )
}

/**
 * @param {{ value: typeof EMPTY_BARTER, onChange: (next) => void, satici: object,
 *   file: File|null, onFile: (f) => void, onCreate: () => Promise<File>, stale: boolean }} p
 */
export default function BarterAlis({ value, onChange, satici, file, onFile, onCreate, stale }) {
  const b = value || EMPTY_BARTER
  const set = (k, v) => onChange({ ...b, [k]: v })

  if (!b.aktiv) {
    return (
      <div>
        <button type="button" className="btn btn--primary muqavile-yarat__btn" onClick={() => onChange({ ...EMPTY_BARTER, aktiv: true })}>
          Məhsul Alışı (BARTER)
        </button>
      </div>
    )
  }

  const missing = barterMissing(b)
  const sat = satici || {}
  return (
    <div className="depo-box" style={{ display: 'grid', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <strong style={{ fontSize: 14 }}>Alış (barter) — müştərinin verdiyi cihaz</strong>
        <button
          type="button"
          className="btn btn--danger"
          style={{ padding: '2px 10px', fontSize: 12 }}
          onClick={() => {
            onFile(null)
            onChange({ ...EMPTY_BARTER })
          }}
        >
          Ləğv et
        </button>
      </div>
      <p className="depo-msg depo-msg--hint" style={{ margin: 0 }}>
        Satıcı (müştəri): <strong>{sat.ad || '—'}</strong> · vəsiqə {sat.seriya || '—'} · FİN {sat.fin || '—'} · tel {sat.tel || '—'} — yuxarıdakı
        müştəri məlumatlarından avtomatik götürülür.
      </p>
      <Row label="Kateqoriya">
        <select value={b.kateqoriya} onChange={(e) => set('kateqoriya', e.target.value)}>
          {['Telefon', 'Noutbook', 'Aksesuarlar', 'Kamera', 'Playstation', 'Toz Soran', 'Digər'].map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </Row>
      <Row label="Növ (məs. iPhone, Samsung)">
        <input value={b.nov} onChange={(e) => set('nov', e.target.value)} />
      </Row>
      <Row label="Model *">
        <input value={b.model} onChange={(e) => set('model', e.target.value)} placeholder="məs. 13 Pro" />
      </Row>
      <Row label="Rəng">
        <input value={b.reng} onChange={(e) => set('reng', e.target.value)} />
      </Row>
      <Row label="Yaddaş">
        <select value={b.yaddas} onChange={(e) => set('yaddas', e.target.value)}>
          <option value="">—</option>
          {YADDAS.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </Row>
      <Row label="IMEI 1">
        <input value={b.imei_1} onChange={(e) => set('imei_1', e.target.value)} inputMode="numeric" />
      </Row>
      <Row label="IMEI 2">
        <input value={b.imei_2} onChange={(e) => set('imei_2', e.target.value)} inputMode="numeric" />
      </Row>
      <Row label="Seriya №">
        <input value={b.serial_no} onChange={(e) => set('serial_no', e.target.value)} />
      </Row>
      <Row label="Vəziyyəti və komplekti">
        <input value={b.veziyyet} onChange={(e) => set('veziyyet', e.target.value)} placeholder="məs. işlək, qutusuz" />
      </Row>
      <Row label="Qiyməti (AZN) *" hint="Bu məbləğ ilkin ödənişə sayılır və Depoya alış qiyməti kimi düşür.">
        <input type="number" step="0.01" min="0" value={b.qiymet} onChange={(e) => set('qiymet', e.target.value)} />
      </Row>
      <MuqavileYarat
        title="Alış Müqaviləsi"
        buttonLabel="MÜQAVİLƏ YARAT"
        note="Satış tamamlananda cihaz avtomatik Depoya düşür, alış müqaviləsi həm Depodakı cihaza, həm müştərinin sənədlərinə əlavə olunur."
        file={file}
        stale={stale}
        disabledReason={missing || (!String(sat.ad || '').trim() ? 'Əvvəlcə müştərinin adını yazın.' : '')}
        onCreate={onCreate}
        onChange={onFile}
      />
    </div>
  )
}
