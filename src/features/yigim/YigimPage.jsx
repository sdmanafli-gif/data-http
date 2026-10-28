import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase, fetchAllPages } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { loadPageFilters, savePageFilters } from '../../lib/uiPrefs'
import {
  MUSTERI_TABLE,
  formatMoney,
  formatDate,
} from '../musteri-bazasi/constants'
import { ODENISLER_TABLE } from '../odenisler/constants'
import {
  canBuildSchedule,
  resolvePaymentSchedule,
  matchPaymentsToSchedule,
  statusLabel,
} from '../musteri-bazasi/paymentSchedule'
import ResizableDataTable from '../musteri-bazasi/ResizableDataTable'
import MusteriRecordModule from '../musteri-bazasi/MusteriRecordModule'
import CollapsibleSummary from '../../components/CollapsibleSummary'
import { applyKeyOrder } from '../musteri-bazasi/columnOrder'
import { useColumnConfig } from './useColumnConfig'
import { waPhone } from '../../lib/qebz'
import '../../styles/shared.css'
import '../musteri-bazasi/musteri-table.css'
import '../musteri-bazasi/musteri-schedule.css'

const MONTHS = [
  'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'İyun',
  'İyul', 'Avqust', 'Sentyabr', 'Oktyabr', 'Noyabr', 'Dekabr',
]

const PERIODS = [
  { value: 'month', label: 'Ay' },
  { value: 'week', label: 'Həftə' },
  { value: 'year', label: 'İl' },
  { value: 'custom', label: 'Özəl aralıq' },
  { value: 'all', label: 'Hamısı' },
]

const STATUS_FILTERS = [
  { value: '', label: 'Hamısı' },
  { value: 'pending', label: 'Gözləyən / qalan' },
  { value: 'late', label: 'Gecikmiş' },
  { value: 'paid', label: 'Ödənib' },
  { value: 'partial', label: 'Qismən' },
  { value: 'soz', label: 'Söz verdiyi tarix çatıb' },
]

const QEYD_TABLE = 'yigim_qeydler'

/** Yığım sətrinin açarı (komment / söz tarixi üçün) */
const setirOf = (row) => `${row.type}-${row.installment}`
const qeydKey = (musteriId, setir) => `${musteriId}|${setir}`

function todayLocalYmd() {
  const d = new Date()
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}

/** Qismən ödənib: nəsə ödənib, amma hələ qalıq var (gecikmiş olsa da) */
const isPartial = (row) => (Number(row.paid) || 0) > 0.009 && (Number(row.remaining) || 0) > 0.009

/** Söz verdiyi tarix çatıb / keçib və hələ ödənməyib */
const isSozDue = (row, today) => Boolean(row.soz_tarixi) && row.soz_tarixi <= today && (Number(row.remaining) || 0) > 0.009

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.85 9.85 0 0 0 12.04 2Zm0 18.15h-.01a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.21 8.21 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.25-8.24 2.2 0 4.27.86 5.83 2.42a8.18 8.18 0 0 1 2.41 5.83c0 4.54-3.7 8.23-8.24 8.23Zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.25-.64.81-.79.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.02-.38.11-.51.11-.11.25-.29.37-.43.13-.15.17-.25.25-.42.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.41-.42-.56-.43h-.48c-.17 0-.43.06-.66.31-.23.25-.86.85-.86 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.14-1.18-.06-.1-.22-.16-.47-.28Z"
      />
    </svg>
  )
}

/** Komment xanası — yazdıqca yox, xanadan çıxanda (və ya Enter) saxlanır */
function KommentInput({ value, onSave }) {
  const [v, setV] = useState(value || '')
  useEffect(() => {
    setV(value || '')
  }, [value])
  const commit = () => {
    if ((v || '').trim() !== (value || '').trim()) onSave(v.trim())
  }
  return (
    <input
      className="yigim-komment"
      value={v}
      placeholder="Komment…"
      onChange={(e) => setV(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        e.stopPropagation()
        if (e.key === 'Enter') e.currentTarget.blur()
      }}
      title={v || undefined}
    />
  )
}

const YIGIM_PAGE_FILTERS_KEY = 'yigim'

function loadSavedYigimFilters() {
  return loadPageFilters(YIGIM_PAGE_FILTERS_KEY, null)
}

function profileFaktikiGelir(m) {
  if (m?.faktiki_gelir != null && m.faktiki_gelir !== '') {
    const n = Number(m.faktiki_gelir)
    if (Number.isFinite(n)) return n
  }
  return (
    (Number(m?.verilib) || 0) +
    (Number(m?.faiz) || 0) -
    (Number(m?.alis_qiymeti) || 0)
  )
}

function yigimGetValue(row, col) {
  const key = col?.key
  if (!key) return ''
  if (key === 'delayDays') {
    const n = Number(row.delayDays) || 0
    return n > 0 ? n : ''
  }
  const v = row[key]
  return v == null ? '' : v
}

function toYmd(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function addDays(date, n) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  d.setDate(d.getDate() + n)
  return d
}

function startOfWeek(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const weekday = (d.getDay() + 6) % 7
  return addDays(d, -weekday)
}

function periodRange(period, { year, month, weekStart, customFrom, customTo }) {
  if (period === 'all') return { from: null, to: null }
  if (period === 'week') {
    return { from: toYmd(weekStart), to: toYmd(addDays(weekStart, 6)) }
  }
  if (period === 'month') {
    return {
      from: toYmd(new Date(year, month, 1)),
      to: toYmd(new Date(year, month + 1, 0)),
    }
  }
  if (period === 'year') {
    return { from: `${year}-01-01`, to: `${year}-12-31` }
  }
  let from = customFrom || null
  let to = customTo || null
  if (from && to && from > to) {
    const t = from
    from = to
    to = t
  }
  return { from, to }
}

function periodTitle(period, ctx) {
  if (period === 'week') {
    return `${formatDate(toYmd(ctx.weekStart))} – ${formatDate(toYmd(addDays(ctx.weekStart, 6)))}`
  }
  if (period === 'month') return `${MONTHS[ctx.month]} ${ctx.year}`
  if (period === 'year') return String(ctx.year)
  if (period === 'custom') {
    if (!ctx.customFrom && !ctx.customTo) return 'Özəl aralıq'
    return `${formatDate(ctx.customFrom) || '…'} – ${formatDate(ctx.customTo) || '…'}`
  }
  return 'Bütün tarixlər'
}

function inRange(ymd, from, to) {
  if (!ymd) return false
  if (from && ymd < from) return false
  if (to && ymd > to) return false
  return true
}

function matchesStatusFilter(row, filter) {
  if (!filter) return true
  if (filter === 'pending') {
    return row.remaining > 0
  }
  if (filter === 'late') {
    return row.status === 'gecikib' || row.status === 'odenib_gec' || row.delayDays > 0
  }
  if (filter === 'paid') {
    return row.status === 'odenib' || row.status === 'odenib_gec'
  }
  if (filter === 'partial') {
    return isPartial(row)
  }
  if (filter === 'soz') {
    return isSozDue(row, todayLocalYmd())
  }
  return true
}

/**
 * Build flat yığım rows from müştəri + ödənişlər.
 */
export function buildYigimRows(musteriler, payments) {
  const byMusteri = new Map()
  for (const p of payments || []) {
    const mid = p.musteri_bazasi_id
    if (!mid) continue
    if (!byMusteri.has(mid)) byMusteri.set(mid, [])
    byMusteri.get(mid).push(p)
  }

  const rows = []
  for (const m of musteriler || []) {
    if (!canBuildSchedule(m)) continue
    const schedule = resolvePaymentSchedule(m)
    const matched = matchPaymentsToSchedule(schedule, byMusteri.get(m.id) || [], {
      aylıq: Number(m.ayliq_odenis) || 0,
    })
    for (const line of matched) {
      rows.push({
        id: `${m.id}-${line.type}-${line.installment}`,
        musteriId: m.id,
        sira_no: m.sira_no,
        ad_soyad: m.ad_soyad || '—',
        model: m.model || null,
        nomre_1: m.nomre_1 || null,
        veziyyet: m.veziyyet || null,
        type: line.type,
        label: line.label,
        installment: line.installment,
        tarix: line.tarix,
        owed: line.owed,
        paid: line.paid,
        remaining: line.remaining,
        delayDays: line.delayDays,
        penalty: line.penalty,
        status: line.status,
        statusText: statusLabel(line.status),
        coveredAt: line.coveredAt,
        faktiki_gelir: profileFaktikiGelir(m),
      })
    }
  }

  rows.sort((a, b) => {
    if (a.tarix !== b.tarix) return a.tarix.localeCompare(b.tarix)
    const na = a.sira_no ?? 999999
    const nb = b.sira_no ?? 999999
    if (na !== nb) return na - nb
    return a.installment - b.installment
  })
  return rows
}

export default function YigimPage() {
  const now = new Date()
  const savedFilters = useMemo(() => loadSavedYigimFilters(), [])
  const { access } = useAuth()
  const navigate = useNavigate()
  // Müştəri Bazasındakı kimi ayrıca pəncərədə açılan müştəri
  const [openRecord, setOpenRecord] = useState(null)
  const recordChanged = useRef(false)

  async function openMusteri(musteriId) {
    if (!musteriId) return
    const { data, error: e } = await supabase
      .from(MUSTERI_TABLE)
      .select('*')
      .eq('id', musteriId)
      .maybeSingle()
    if (e) {
      setError(e.message)
      return
    }
    if (data) {
      recordChanged.current = false
      setOpenRecord(data)
    }
  }

  function closeRecord() {
    setOpenRecord(null)
    // Ödəniş edilibsə, yığım siyahısını yenilə
    if (recordChanged.current) {
      recordChanged.current = false
      load()
    }
  }

  // Adi klik pəncərə açır; Ctrl/Cmd/orta düymə ilə klik əvvəlki kimi yeni tabda açır
  function handleMusteriLinkClick(e, musteriId) {
    e.stopPropagation()
    if (e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return
    e.preventDefault()
    openMusteri(musteriId)
  }
  const { columns, loading: colsLoading, saveColumns } = useColumnConfig()
  const [localCols, setLocalCols] = useState([])
  const resizeTimer = useRef(null)
  const [period, setPeriod] = useState(() =>
    PERIODS.some((p) => p.value === savedFilters?.period) ? savedFilters.period : 'month'
  )
  const [year, setYear] = useState(() => {
    const y = Number(savedFilters?.year)
    return Number.isFinite(y) && y >= 2000 && y <= 2100 ? y : now.getFullYear()
  })
  const [month, setMonth] = useState(() => {
    const m = Number(savedFilters?.month)
    return Number.isFinite(m) && m >= 0 && m <= 11 ? m : now.getMonth()
  })
  const [weekStart, setWeekStart] = useState(() => {
    if (savedFilters?.weekStart && /^\d{4}-\d{2}-\d{2}$/.test(savedFilters.weekStart)) {
      const [y, m, d] = savedFilters.weekStart.split('-').map(Number)
      return startOfWeek(new Date(y, m - 1, d))
    }
    return startOfWeek(now)
  })
  const [customFrom, setCustomFrom] = useState(() =>
    typeof savedFilters?.customFrom === 'string' ? savedFilters.customFrom : ''
  )
  const [customTo, setCustomTo] = useState(() =>
    typeof savedFilters?.customTo === 'string' ? savedFilters.customTo : ''
  )
  const [statusFilter, setStatusFilter] = useState(() => {
    const s = savedFilters?.statusFilter
    return STATUS_FILTERS.some((x) => x.value === s) ? s : 'pending'
  })
  const [search, setSearch] = useState(() =>
    typeof savedFilters?.search === 'string' ? savedFilters.search : ''
  )
  const [viewRows, setViewRows] = useState([])

  const [rows, setRows] = useState([])
  const [qeydler, setQeydler] = useState(() => new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const today = todayLocalYmd()

  useEffect(() => {
    setLocalCols(columns)
  }, [columns])

  useEffect(() => {
    savePageFilters(YIGIM_PAGE_FILTERS_KEY, {
      period,
      year,
      month,
      weekStart: toYmd(weekStart),
      customFrom,
      customTo,
      statusFilter,
      search,
    })
  }, [period, year, month, weekStart, customFrom, customTo, statusFilter, search])

  const visibleCols = useMemo(
    () => access.filterColumns('yigim', localCols).filter((c) => c.visible !== false),
    [localCols, access]
  )

  const handleReorder = useCallback(
    async (orderedVisible) => {
      const next = applyKeyOrder(localCols, orderedVisible.map((c) => c.key))
      setLocalCols(next)
      try {
        await saveColumns(next)
      } catch (err) {
        setError(err.message)
      }
    },
    [localCols, saveColumns]
  )

  const handleResize = useCallback(
    (key, width) => {
      setLocalCols((prev) => {
        const next = prev.map((c) => (c.key === key ? { ...c, width } : c))
        clearTimeout(resizeTimer.current)
        resizeTimer.current = setTimeout(() => {
          saveColumns(next).catch((err) => setError(err.message))
        }, 400)
        return next
      })
    },
    [saveColumns]
  )

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const [{ data: musteriler, error: mErr }, { data: payments, error: pErr }] = await Promise.all([
        fetchAllPages(() => {
          let q = supabase
            .from(MUSTERI_TABLE)
            .select(
              'id, sira_no, ad_soyad, model, nomre_1, veziyyet, satis_qiymeti, alis_qiymeti, verilib, faiz, faktiki_gelir, ayliq_odenis, nece_ay, odenis_gunu, birinci_ayliq_odenis_tarixi, odenis_qrafiki, verilme_tarixi'
            )
            .eq('veziyyet', 'Qalıb')
            .order('sira_no', { ascending: true })
          return access.applyDataFilters(q, 'yigim')
        }),
        fetchAllPages(() =>
          supabase
            .from(ODENISLER_TABLE)
            .select('id, musteri_bazasi_id, tip, mebleg, tarix')
            .in('tip', ['ilkin', 'ayliq'])
        ),
      ])
      if (mErr) throw mErr
      if (pErr) throw pErr
      setRows(buildYigimRows(musteriler || [], payments || []))
      // Komment / söz tarixi — alınmasa da yığım cədvəli göstərilir
      const { data: q, error: qErr } = await fetchAllPages(() =>
        supabase.from(QEYD_TABLE).select('musteri_id, setir, komment, soz_tarixi')
      )
      if (qErr) {
        setError(`Komment / söz tarixi yüklənmədi: ${qErr.message}`)
      } else {
        const m = new Map()
        for (const x of q || []) m.set(qeydKey(x.musteri_id, x.setir), x)
        setQeydler(m)
      }
    } catch (err) {
      setError(err.message)
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const range = useMemo(
    () => periodRange(period, { year, month, weekStart, customFrom, customTo }),
    [period, year, month, weekStart, customFrom, customTo]
  )

  /** Sətirlərə komment və söz tarixi əlavə olunur */
  const rowsWithQeyd = useMemo(
    () =>
      rows.map((r) => {
        const q = qeydler.get(qeydKey(r.musteriId, setirOf(r)))
        return q ? { ...r, komment: q.komment || '', soz_tarixi: q.soz_tarixi || '' } : { ...r, komment: '', soz_tarixi: '' }
      }),
    [rows, qeydler]
  )

  async function saveQeyd(row, patch) {
    const setir = setirOf(row)
    const key = qeydKey(row.musteriId, setir)
    const prev = qeydler.get(key) || { musteri_id: row.musteriId, setir, komment: null, soz_tarixi: null }
    const next = { ...prev, ...patch }
    setQeydler((m) => new Map(m).set(key, next))
    const { error: e } = await supabase
      .from(QEYD_TABLE)
      .upsert(
        { musteri_id: row.musteriId, setir, ...patch, updated_at: new Date().toISOString() },
        { onConflict: 'musteri_id,setir' }
      )
    if (e) {
      setError(`Yadda saxlanmadı: ${e.message}`)
      setQeydler((m) => new Map(m).set(key, prev))
    }
  }

  const periodFiltered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return rowsWithQeyd.filter((r) => {
      // Söz verdiyi tarix bu dövrə düşürsə (və hələ ödənməyibsə) sətir yenə göstərilir — xatırlatma
      const sozInRange = r.soz_tarixi && r.remaining > 0 && inRange(r.soz_tarixi, range.from, range.to)
      if (!inRange(r.tarix, range.from, range.to) && !sozInRange) return false
      if (!matchesStatusFilter(r, statusFilter)) return false
      if (r.veziyyet !== 'Qalıb') return false
      if (term) {
        const hay = `${r.sira_no ?? ''} ${r.ad_soyad} ${r.model || ''} ${r.nomre_1 || ''} ${r.komment || ''}`.toLowerCase()
        if (!hay.includes(term) && !(term.match(/^\d+$/) && String(r.sira_no) === term)) {
          return false
        }
      }
      return true
    })
  }, [rowsWithQeyd, range, statusFilter, search])

  const totals = useMemo(() => {
    let owed = 0
    let paid = 0
    let remaining = 0
    let penalty = 0
    let lateCount = 0
    const faktikiByMusteri = new Map()
    for (const r of viewRows) {
      owed += r.owed || 0
      paid += r.paid || 0
      remaining += r.remaining || 0
      penalty += r.penalty || 0
      if (r.status === 'gecikib' || (r.delayDays > 0 && r.remaining > 0)) lateCount += 1
      if (r.musteriId && !faktikiByMusteri.has(r.musteriId)) {
        faktikiByMusteri.set(r.musteriId, Number(r.faktiki_gelir) || 0)
      }
    }
    let faktiki = 0
    for (const v of faktikiByMusteri.values()) faktiki += v
    return {
      owed,
      paid,
      remaining,
      penalty,
      faktiki,
      lateCount,
      count: viewRows.length,
      musteriCount: faktikiByMusteri.size,
    }
  }, [viewRows])

  function formatYigimCell(value, col) {
    if (col.type === 'money') return formatMoney(value)
    if (col.type === 'date' || col.key === 'tarix') return formatDate(value)
    if (col.key === 'delayDays') {
      const n = Number(value) || 0
      return n > 0 ? `${n} gün` : '—'
    }
    if (value === null || value === undefined || value === '') return '—'
    return String(value)
  }

  function renderYigimCell(row, col, raw) {
    if (col.key === 'sira_no') {
      return (
        <Link
          to={`/musteri-bazasi/${row.musteriId}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => handleMusteriLinkClick(e, row.musteriId)}
        >
          {row.sira_no ?? '—'}
        </Link>
      )
    }
    if (col.key === 'ad_soyad') {
      const wa = waPhone(row.nomre_1)
      return (
        <span className="yigim-musteri">
          {wa ? (
            <a
              className="yigim-wa"
              href={`https://wa.me/${wa}`}
              target="_blank"
              rel="noopener noreferrer"
              title={`WhatsApp: ${row.nomre_1}`}
              onClick={(e) => e.stopPropagation()}
            >
              <WhatsAppIcon />
            </a>
          ) : (
            <span className="yigim-wa yigim-wa--none" title="Nömrə yoxdur və ya düzgün deyil">
              <WhatsAppIcon />
            </span>
          )}
          <Link
            to={`/musteri-bazasi/${row.musteriId}`}
            target="_blank"
            rel="noopener noreferrer"
            title={row.nomre_1 || undefined}
            onClick={(e) => handleMusteriLinkClick(e, row.musteriId)}
          >
            {row.ad_soyad}
          </Link>
        </span>
      )
    }
    if (col.key === 'komment') {
      return <KommentInput value={row.komment} onSave={(komment) => saveQeyd(row, { komment: komment || null })} />
    }
    if (col.key === 'soz_tarixi') {
      const due = isSozDue(row, today)
      const gun = due && row.soz_tarixi < today ? Math.round((new Date(today) - new Date(row.soz_tarixi)) / 86400000) : 0
      return (
        <span className="yigim-soz">
          <input
            type="date"
            value={row.soz_tarixi || ''}
            onChange={(e) => saveQeyd(row, { soz_tarixi: e.target.value || null })}
            onKeyDown={(e) => e.stopPropagation()}
          />
          {due && (
            <span className="yigim-soz__badge" title="Müştərinin söz verdiyi tarix çatıb, ödəniş hələ yoxdur">
              🔔 {gun > 0 ? `${gun} gün keçib` : 'Bu gün'}
            </span>
          )}
        </span>
      )
    }
    if (col.key === 'delayDays') {
      return row.delayDays > 0 ? (
        <span className="musteri-schedule__overdue">{row.delayDays} gün</span>
      ) : (
        '—'
      )
    }
    if (col.key === 'penalty') {
      return row.penalty > 0 ? (
        <span className="musteri-schedule__overdue">{formatMoney(row.penalty)}</span>
      ) : (
        '—'
      )
    }
    if (col.key === 'statusText') {
      return (
        <span
          className={
            row.status === 'gecikib'
              ? 'musteri-schedule__overdue'
              : row.status === 'odenib_gec'
                ? 'musteri-schedule__paid-late'
                : row.status === 'odenib'
                  ? 'musteri-schedule__paid'
                  : 'musteri-schedule__upcoming'
          }
        >
          {row.statusText}
        </span>
      )
    }
    return formatYigimCell(raw, col)
  }

  function getYigimRowClass(row) {
    const soz = isSozDue(row, today) ? ' yigim-row--soz' : ''
    // Qismən ödənənlər — tam açıq göy (gecikmiş olsa da)
    if (isPartial(row)) return `musteri-schedule__row--partial${soz}`
    return getYigimStatusClass(row) + soz
  }

  function getYigimStatusClass(row) {
    if (row.status === 'gecikib' || (row.delayDays > 0 && row.remaining > 0)) {
      return 'musteri-schedule__row--late'
    }
    if (row.status === 'odenib_gec') return 'musteri-schedule__row--paid-late'
    if (row.status === 'odenib') return 'musteri-schedule__row--paid'
    return ''
  }

  function renderYigimFooter(displayRows, footerColumns) {
    let owed = 0
    let paid = 0
    let remaining = 0
    let penalty = 0
    const faktikiByMusteri = new Map()
    for (const r of displayRows) {
      owed += r.owed || 0
      paid += r.paid || 0
      remaining += r.remaining || 0
      penalty += r.penalty || 0
      if (r.musteriId && !faktikiByMusteri.has(r.musteriId)) {
        faktikiByMusteri.set(r.musteriId, Number(r.faktiki_gelir) || 0)
      }
    }
    let faktiki = 0
    for (const v of faktikiByMusteri.values()) faktiki += v

    const totalsByKey = {
      owed: formatMoney(owed),
      paid: formatMoney(paid),
      remaining: formatMoney(remaining),
      faktiki_gelir: formatMoney(faktiki),
      penalty:
        penalty > 0 ? (
          <span className="musteri-schedule__overdue">{formatMoney(penalty)}</span>
        ) : (
          formatMoney(0)
        ),
    }

    return (
      <tr className="yigim-table-totals">
        {footerColumns.map((col, i) => {
          if (i === 0) {
            return (
              <td key={col.key}>
                Cəmi ({displayRows.length} sətir)
              </td>
            )
          }
          if (col.key in totalsByKey) {
            return (
              <td key={col.key} className="num" title={col.key === 'faktiki_gelir' ? 'Unikal müştərilərin faktiki gəlir cəmi' : undefined}>
                {totalsByKey[col.key]}
              </td>
            )
          }
          return <td key={col.key}>—</td>
        })}
      </tr>
    )
  }

  const yigimSummaryKeys = access.allowedSummaryCards('yigim')
  const showYigimCard = (key) => yigimSummaryKeys == null || yigimSummaryKeys.includes(key)

  const title = periodTitle(period, { year, month, weekStart, customFrom, customTo })

  function shiftPeriod(dir) {
    if (period === 'week') {
      setWeekStart((w) => addDays(w, dir * 7))
      return
    }
    if (period === 'month') {
      const d = new Date(year, month + dir, 1)
      setYear(d.getFullYear())
      setMonth(d.getMonth())
      return
    }
    if (period === 'year') setYear((y) => y + dir)
  }

  return (
    <>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 12,
          alignItems: 'flex-end',
          marginBottom: 16,
        }}
      >
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>Dövr</label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {PERIODS.map((p) => (
              <button
                key={p.value}
                type="button"
                className={`btn ${period === p.value ? 'btn--primary' : 'btn--secondary'}`}
                onClick={() => setPeriod(p.value)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {(period === 'month' || period === 'week' || period === 'year') && (
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Naviqasiya</label>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <button type="button" className="btn btn--secondary" onClick={() => shiftPeriod(-1)}>
                ‹
              </button>
              <span style={{ minWidth: 140, textAlign: 'center', fontWeight: 600 }}>{title}</span>
              <button type="button" className="btn btn--secondary" onClick={() => shiftPeriod(1)}>
                ›
              </button>
              <button
                type="button"
                className="btn btn--secondary"
                onClick={() => {
                  const n = new Date()
                  setYear(n.getFullYear())
                  setMonth(n.getMonth())
                  setWeekStart(startOfWeek(n))
                }}
              >
                Bu gün
              </button>
            </div>
          </div>
        )}

        {period === 'custom' && (
          <>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Başlanğıc</label>
              <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Son</label>
              <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
            </div>
          </>
        )}

        <div className="form-group" style={{ marginBottom: 0, minWidth: 180 }}>
          <label>Ödəniş statusu</label>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            {STATUS_FILTERS.map((s) => (
              <option key={s.value || 'all'} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>

        <div className="form-group" style={{ marginBottom: 0, flex: '1 1 200px', maxWidth: 280 }}>
          <label>Axtarış</label>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="№, ad, model, nömrə…"
          />
        </div>

        <button type="button" className="btn btn--secondary" onClick={load} disabled={loading}>
          Yenilə
        </button>
        <Link to="/yigim/sutunlar" className="btn btn--secondary">
          Sütunları idarə et
        </Link>
      </div>

      {error && <p style={{ color: 'var(--color-accent)' }}>{error}</p>}

      {!loading && !colsLoading && access.canSeeSummary('yigim') && (
        <CollapsibleSummary title="Cəmlər" storageKey="summary:yigim">
          <div className="musteri-summary">
            {showYigimCard('owed') && (
              <div className="musteri-summary__card">
                <div className="musteri-summary__label">Gözlənilən yığım</div>
                <div className="musteri-summary__value">{formatMoney(totals.owed)}</div>
              </div>
            )}
            {showYigimCard('paid') && (
              <div className="musteri-summary__card">
                <div className="musteri-summary__label">Ödənilib</div>
                <div className="musteri-summary__value">{formatMoney(totals.paid)}</div>
              </div>
            )}
            {showYigimCard('remaining') && (
              <div className="musteri-summary__card">
                <div className="musteri-summary__label">Qalan / pending</div>
                <div className="musteri-summary__value">{formatMoney(totals.remaining)}</div>
              </div>
            )}
            {showYigimCard('penalty') && (
              <div className="musteri-summary__card">
                <div className="musteri-summary__label">Cərimə</div>
                <div className="musteri-summary__value">{formatMoney(totals.penalty)}</div>
              </div>
            )}
            {showYigimCard('faktiki') && (
              <div className="musteri-summary__card">
                <div className="musteri-summary__label">Faktiki gəlir (müştərilər)</div>
                <div className="musteri-summary__value">{formatMoney(totals.faktiki)}</div>
              </div>
            )}
            {showYigimCard('lateCount') && (
              <div className="musteri-summary__card">
                <div className="musteri-summary__label">Gecikmiş sətir</div>
                <div className="musteri-summary__value">{totals.lateCount}</div>
              </div>
            )}
            {showYigimCard('row_musteri') && (
              <div className="musteri-summary__card musteri-summary__card--meta">
                <div className="musteri-summary__label">Sətir / müştəri</div>
                <div className="musteri-summary__value">
                  {totals.count} / {totals.musteriCount}
                </div>
              </div>
            )}
          </div>
        </CollapsibleSummary>
      )}

      <div className="card">
        {loading || colsLoading ? (
          <p className="empty-state">Yüklənir…</p>
        ) : (
          <ResizableDataTable
            columns={visibleCols}
            rows={periodFiltered}
            formatCell={formatYigimCell}
            getRowValue={yigimGetValue}
            renderCell={renderYigimCell}
            getRowClassName={getYigimRowClass}
            renderFooter={renderYigimFooter}
            onReorderColumns={handleReorder}
            onResizeColumn={handleResize}
            onDisplayRowsChange={setViewRows}
            onRowOpen={(row) => openMusteri(row.musteriId)}
            emptyText="Bu filtrə uyğun yığım yoxdur."
            prefsKey="yigim"
            autoHeight
          />
        )}
      </div>

      {openRecord && (
        <div
          className="telefon-modal-overlay musteri-record-overlay"
          onClick={closeRecord}
          role="presentation"
        >
          <div className="telefon-modal musteri-record-modal" onClick={(e) => e.stopPropagation()}>
            <MusteriRecordModule
              key={openRecord.id}
              record={openRecord}
              onClose={closeRecord}
              onEdit={(row) => {
                setOpenRecord(null)
                navigate(`/musteri-bazasi/${row.id}?edit=1`)
              }}
              onUpdated={(updated) => {
                recordChanged.current = true
                setOpenRecord(updated)
              }}
            />
          </div>
        </div>
      )}
    </>
  )
}
