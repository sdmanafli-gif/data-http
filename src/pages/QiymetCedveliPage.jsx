import { useEffect, useState } from 'react'
import '../styles/shared.css'
import './analitika.css'
import './qiymet-cedveli.css'

/**
 * Qiymət cədvəli — kredit kalkulyatoru.
 * Satış qiyməti və ilkin ödəniş yazılır; qalıq × (1 + faiz) ÷ ay = aylıq ödəniş.
 * Məs.: 5000 − 2000 = 3000; 6 ay, 64% → 3000 × 1,64 ÷ 6 = 820 ₼.
 * Faizlər və aylar dəyişdirilə bilir; bu brauzerdə yadda qalır (bazaya yazılmır).
 */

const STORE_KEY = 'qiymet-cedveli:v1'

const DEFAULT_TERMS = [
  { ay: 6, faiz: 64 },
  { ay: 8, faiz: 70 },
  { ay: 10, faiz: 80 },
  { ay: 12, faiz: 110 },
]

const newRow = () => ({ id: Math.random().toString(36).slice(2), model: '', satis: '', ilkin: '' })

function loadState() {
  try {
    const v = JSON.parse(localStorage.getItem(STORE_KEY) || 'null')
    if (v && Array.isArray(v.terms) && v.terms.length) {
      return {
        terms: v.terms.map((t) => ({ ay: Number(t.ay) || 1, faiz: Number(t.faiz) || 0 })),
        round: [1, 5, 10].includes(Number(v.round)) ? Number(v.round) : 5,
        rows: Array.isArray(v.rows) && v.rows.length ? v.rows.map((r) => ({ ...newRow(), ...r })) : [newRow()],
      }
    }
  } catch {
    /* brauzer yaddaşı əlçatan deyil */
  }
  return { terms: DEFAULT_TERMS, round: 5, rows: [newRow()] }
}

const num = (v) => {
  const n = Number(String(v ?? '').replace(',', '.').replace(/\s/g, ''))
  return Number.isFinite(n) ? n : 0
}

function fmt(n) {
  const v = Math.round(Number(n) || 0)
  return `${v < 0 ? '−' : ''}${String(Math.abs(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}`
}

/** Aylıq ödəniş: (satış − ilkin) × (1 + faiz/100) ÷ ay, seçilən addıma yuvarlaqlaşdırılır */
export function ayliq(satis, ilkin, ay, faiz, step = 5) {
  const qaliq = Math.max(0, num(satis) - num(ilkin))
  const m = Math.max(1, num(ay))
  const raw = (qaliq * (1 + num(faiz) / 100)) / m
  const s = step > 0 ? step : 1
  return Math.round(raw / s) * s
}

export default function QiymetCedveliPage() {
  const [state, setState] = useState(loadState)
  const { terms, round, rows } = state

  useEffect(() => {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(state))
    } catch {
      /* brauzer yaddaşı əlçatan deyil */
    }
  }, [state])

  const setTerm = (i, k, v) =>
    setState((s) => ({ ...s, terms: s.terms.map((t, j) => (j === i ? { ...t, [k]: v } : t)) }))
  const addTerm = () =>
    setState((s) => {
      const last = s.terms[s.terms.length - 1] || { ay: 12, faiz: 100 }
      return { ...s, terms: [...s.terms, { ay: num(last.ay) + 2, faiz: num(last.faiz) + 10 }] }
    })
  const removeTerm = (i) => setState((s) => ({ ...s, terms: s.terms.filter((_, j) => j !== i) }))
  const setRow = (id, k, v) => setState((s) => ({ ...s, rows: s.rows.map((r) => (r.id === id ? { ...r, [k]: v } : r)) }))
  const addRow = () => setState((s) => ({ ...s, rows: [...s.rows, newRow()] }))
  const removeRow = (id) =>
    setState((s) => {
      const left = s.rows.filter((r) => r.id !== id)
      return { ...s, rows: left.length ? left : [newRow()] }
    })

  return (
    <div className="an-page qc-page">
      <div className="page-header" style={{ marginBottom: 12 }}>
        <div>
          <h1 style={{ marginBottom: 4 }}>Qiymət cədvəli</h1>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text-muted)' }}>
            Satış qiymətini və ilkin ödənişi yazın — aylıq ödəniş özü hesablanır: (satış − ilkin) × (1 + faiz) ÷ ay.
          </p>
        </div>
      </div>

      <div className="card an-card">
        <div className="table-wrap">
          <table className="data-table qc-table">
            <thead>
              <tr className="qc-terms">
                <th colSpan={4} className="qc-terms__lbl">
                  Faiz →
                </th>
                {terms.map((t, i) => (
                  <th key={i} className="num">
                    <span className="qc-pct">
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={t.faiz}
                        onChange={(e) => setTerm(i, 'faiz', e.target.value)}
                        aria-label={`${t.ay} ay faizi`}
                      />
                      %
                    </span>
                  </th>
                ))}
                <th />
              </tr>
              <tr>
                <th>Model</th>
                <th className="num">Satış qiyməti</th>
                <th className="num">İlkin ödəniş</th>
                <th className="num">Qalıq</th>
                {terms.map((t, i) => (
                  <th key={i} className="num">
                    <span className="qc-ay">
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={t.ay}
                        onChange={(e) => setTerm(i, 'ay', e.target.value)}
                        aria-label="Ay sayı"
                      />
                      ay
                      {terms.length > 1 && (
                        <button type="button" className="qc-x" title="Bu müddəti sil" onClick={() => removeTerm(i)}>
                          ×
                        </button>
                      )}
                    </span>
                  </th>
                ))}
                <th>
                  <button type="button" className="xerc-chip" onClick={addTerm} title="Yeni müddət əlavə et">
                    + ay
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const qaliq = Math.max(0, num(r.satis) - num(r.ilkin))
                const has = num(r.satis) > 0
                return (
                  <tr key={r.id}>
                    <td>
                      <input
                        className="qc-in qc-in--model"
                        value={r.model}
                        placeholder="məs. 17 Pro"
                        onChange={(e) => setRow(r.id, 'model', e.target.value)}
                      />
                    </td>
                    <td className="num">
                      <input
                        className="qc-in"
                        type="number"
                        min="0"
                        inputMode="decimal"
                        value={r.satis}
                        placeholder="0"
                        onChange={(e) => setRow(r.id, 'satis', e.target.value)}
                      />
                    </td>
                    <td className="num">
                      <input
                        className="qc-in"
                        type="number"
                        min="0"
                        inputMode="decimal"
                        value={r.ilkin}
                        placeholder="0"
                        onChange={(e) => setRow(r.id, 'ilkin', e.target.value)}
                      />
                    </td>
                    <td className="num qc-qaliq">{has ? fmt(qaliq) : '—'}</td>
                    {terms.map((t, i) => {
                      const a = ayliq(r.satis, r.ilkin, t.ay, t.faiz, round)
                      return (
                        <td key={i} className="num qc-cell">
                          {has ? (
                            <>
                              <b>{fmt(a)} ₼</b>
                              <small>cəmi {fmt(num(r.ilkin) + a * num(t.ay))}</small>
                            </>
                          ) : (
                            '—'
                          )}
                        </td>
                      )
                    })}
                    <td>
                      {rows.length > 1 && (
                        <button type="button" className="qc-x" title="Sətri sil" onClick={() => removeRow(r.id)}>
                          ×
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="qc-foot">
          <button type="button" className="btn btn--secondary" onClick={addRow}>
            + Sətir əlavə et
          </button>
          <label className="qc-round">
            Yuvarlaqlaşdır:
            <select value={round} onChange={(e) => setState((s) => ({ ...s, round: Number(e.target.value) }))}>
              <option value={1}>1 ₼</option>
              <option value={5}>5 ₼</option>
              <option value={10}>10 ₼</option>
            </select>
          </label>
          <button
            type="button"
            className="btn btn--secondary"
            onClick={() => setState((s) => ({ ...s, terms: DEFAULT_TERMS }))}
            title="6 ay 64% · 8 ay 70% · 10 ay 80% · 12 ay 110%"
          >
            Faizləri ilkinə qaytar
          </button>
        </div>
        <p className="xerc-note" style={{ marginTop: 10 }}>
          «cəmi» — ilkin ödəniş + bütün aylıq ödənişlər (müştərinin ümumi ödəyəcəyi). Faizlər, aylar və sətirlər bu brauzerdə
          yadda qalır.
        </p>
      </div>
    </div>
  )
}
