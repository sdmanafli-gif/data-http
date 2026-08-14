import MusteriDynamicField from './MusteriDynamicField'
import SenedlerField from '../../components/SenedlerField'
import { getFieldValue, isMusteriFormColumnActive } from './constants'

/**
 * Kommentlər + Sənədlər together (not inside a category section).
 */
export default function MusteriNotesAndFiles({
  columns,
  form,
  onKommentChange,
  senedlerProps,
  asDetails = false,
  showKomment = true,
  showSenedler = true,
}) {
  const kommentCol = (columns || []).find((c) => c.key === 'kommentler')
  const kommentActive =
    showKomment &&
    kommentCol &&
    isMusteriFormColumnActive(columns, 'kommentler')
  const senedlerActive = showSenedler && isMusteriFormColumnActive(columns, 'senedler')

  if (!kommentActive && !senedlerActive) return null

  const body = (
    <div className="form-row" style={{ paddingTop: asDetails ? 8 : 0 }}>
      {kommentActive && (
        <div className="form-group" style={{ flex: '1 1 100%' }}>
          <MusteriDynamicField
            col={kommentCol}
            value={getFieldValue(form, kommentCol)}
            onChange={onKommentChange}
          />
        </div>
      )}
      {senedlerActive && senedlerProps && (
        <div className="form-group" style={{ flex: '1 1 100%' }}>
          <SenedlerField {...senedlerProps} />
        </div>
      )}
    </div>
  )

  if (asDetails) {
    return (
      <details className="collapse-section" open>
        <summary className="collapse-section__title">
          {[kommentActive ? 'Kommentlər' : null, senedlerActive ? 'Sənədlər' : null]
            .filter(Boolean)
            .join(' / ')}
        </summary>
        <div className="collapse-section__body">{body}</div>
      </details>
    )
  }

  return <div style={{ marginTop: 16 }}>{body}</div>
}
