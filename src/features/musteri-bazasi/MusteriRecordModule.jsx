import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import RecordModule from '../../components/RecordModule'
import SenedlerField from '../../components/SenedlerField'
import PaymentScheduleList from './PaymentScheduleList'
import ClientPaymentsPanel from '../odenisler/ClientPaymentsPanel'
import { useColumnConfig } from './useColumnConfig'
import {
  MUSTERI_TABLE,
  formatCell,
  getRowValue,
  buildMusteriViewSections,
} from './constants'
import '../../components/record-module.css'
import './musteri-schedule.css'

/**
 * In-page module for one müştəri record (fields + payment schedule list).
 */
export default function MusteriRecordModule({ record, onClose, onEdit, onUpdated }) {
  const { columns } = useColumnConfig()
  const [row, setRow] = useState(record)
  const [error, setError] = useState(null)

  const viewSections = useMemo(
    () => buildMusteriViewSections((columns || []).filter((c) => c.visible !== false)),
    [columns]
  )

  const title =
    row?.ad_soyad || (row?.sira_no != null ? `# ${row.sira_no}` : 'Müştəri qeydi')

  return (
    <RecordModule
      title={title}
      subtitle={row?.sira_no != null ? `# ${row.sira_no}` : undefined}
      sections={viewSections}
      row={row}
      formatCell={formatCell}
      getRowValue={getRowValue}
      actions={
        <>
          <Link to={`/musteri-bazasi/${row.id}/geri-qaytarma`} className="btn btn--secondary">
            Geri qaytarma
          </Link>
          <Link to={`/odenisler/yeni?musteri=${row.id}`} className="btn btn--primary">
            Ödəniş et
          </Link>
          <button type="button" className="btn btn--secondary" onClick={() => onEdit?.(row)}>
            Redaktə
          </button>
          <button type="button" className="btn btn--secondary" onClick={onClose}>
            Bağla
          </button>
        </>
      }
    >
      {error && <p style={{ color: 'var(--color-accent)' }}>{error}</p>}

      <details className="collapse-section">
        <summary className="collapse-section__title">Sənədlər</summary>
        <div className="collapse-section__body">
          <SenedlerField
            folder="musteri_bazasi"
            recordId={row.id}
            value={row.senedler}
            onChange={async (next) => {
              const { error: e } = await supabase
                .from(MUSTERI_TABLE)
                .update({ senedler: next, updated_at: new Date().toISOString() })
                .eq('id', row.id)
              if (e) {
                setError(e.message)
                return
              }
              const updated = { ...row, senedler: next }
              setRow(updated)
              onUpdated?.(updated)
            }}
          />
        </div>
      </details>

      <PaymentScheduleList record={row} />
      <ClientPaymentsPanel musteriId={row.id} />
    </RecordModule>
  )
}
