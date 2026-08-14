import MusteriDynamicField from './MusteriDynamicField'
import { buildMusteriFormSections, getFieldValue } from './constants'

/**
 * Renders müştəri form fields in the same category sections as the detail view.
 * New / custom columns from column config land in the matching section automatically.
 */
export default function MusteriSectionedFields({
  columns,
  form,
  onFieldChange,
  suggestions,
  computedDisplay = {},
  readonlyKeys = new Set(),
  skipKeys = new Set(),
  forceOpenIds = null,
  requiredKeys = new Set(),
}) {
  const sections = buildMusteriFormSections(columns, { skipKeys })

  return (
    <div className="musteri-sale-sections">
      {sections.map((section) => {
        const open =
          forceOpenIds != null
            ? forceOpenIds.has(section.id) || section.alwaysVisible
            : section.defaultOpen || section.alwaysVisible
        return (
          <details key={section.id} className="collapse-section" defaultOpen={open}>
            <summary className="collapse-section__title">{section.title}</summary>
            <div className="form-row" style={{ paddingTop: 8 }}>
              {section.columns.map((col) => {
                const rendered = {
                  ...col,
                  required: requiredKeys.has(col.key) || Boolean(col.required),
                }
                return (
                  <MusteriDynamicField
                    key={col.key}
                    col={rendered}
                    value={getFieldValue(form, col)}
                    onChange={(v) => onFieldChange(col, v)}
                    computedDisplay={computedDisplay[col.key]}
                    suggestions={suggestions}
                    forceReadonly={readonlyKeys.has(col.key)}
                  />
                )
              })}
            </div>
          </details>
        )
      })}
    </div>
  )
}
