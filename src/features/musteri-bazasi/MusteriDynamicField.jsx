import SuggestInput from './SuggestInput'
import { SUGGEST_FIELDS } from './constants'

/**
 * Shared field control for Müştəri Bazası forms and Depo kredit satış.
 * Driven by column defs — new columns appear automatically.
 */
export default function MusteriDynamicField({
  col,
  value,
  onChange,
  computedDisplay,
  suggestions,
  forceReadonly = false,
}) {
  if (!col || col.type === 'files') return null

  const readonly = forceReadonly || col.readonly

  if (readonly) {
    return (
      <div className="form-group" key={col.key}>
        <label>
          {col.label}
          {forceReadonly ? ' (depodan)' : col.readonly && col.key !== 'faiz' ? ' (avtomatik)' : ''}
        </label>
        <input
          readOnly
          value={computedDisplay ?? (value === '' || value == null ? '—' : String(value))}
        />
        {col.key === 'faiz' && (
          <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--color-text-muted)' }}>
            Cərimə məbləği — gələcəkdə ayrı cədvəldən avtomatik gələcək
          </p>
        )}
      </div>
    )
  }

  if (col.type === 'checkbox' || col.key === 'mehkeme_isare') {
    return (
      <div className="form-group" key={col.key}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="checkbox"
            checked={Boolean(value === true || value === 'true' || value === '1' || value === 1)}
            onChange={(e) => onChange(e.target.checked)}
          />
          {col.label}
        </label>
      </div>
    )
  }

  if (SUGGEST_FIELDS.has(col.key)) {
    return (
      <SuggestInput
        key={col.key}
        id={`field-${col.key}`}
        label={col.label}
        value={value}
        onChange={onChange}
        options={suggestions?.[col.key] || []}
        required={col.required}
      />
    )
  }

  if (col.type === 'select') {
    const hint =
      col.key === 'veziyyet'
        ? 'Avtomatik: alış və satış 0 → Bitib; qalan borc = 0 → Bitib. Məhkəmə əl ilə seçiləndə dəyişmir.'
        : null
    return (
      <div className="form-group" key={col.key}>
        <label>
          {col.label}
          {col.required ? ' *' : ''}
        </label>
        <select
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          required={col.required}
        >
          <option value="">— Seçin —</option>
          {(col.options || []).map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
        {hint && (
          <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--color-text-muted)' }}>
            {hint}
          </p>
        )}
      </div>
    )
  }

  const inputType =
    col.type === 'date' ? 'date' : col.type === 'number' || col.type === 'money' ? 'number' : 'text'

  const dateHint =
    col.key === 'birinci_ayliq_odenis_tarixi'
      ? 'Kredit ödəniş cədvəli bu tarixdən başlayır; növbəti aylar eyni gündə hesablanır. Ödəniş günündən üstünlük götürür.'
      : null

  return (
    <div className="form-group" key={col.key}>
      <label>
        {col.label}
        {col.required ? ' *' : ''}
      </label>
      <input
        type={inputType}
        step={col.type === 'money' || col.type === 'number' ? '0.01' : undefined}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        required={col.required}
      />
      {dateHint && (
        <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--color-text-muted)' }}>
          {dateHint}
        </p>
      )}
    </div>
  )
}
