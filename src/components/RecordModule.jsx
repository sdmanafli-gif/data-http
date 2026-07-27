import './record-module.css'

function FieldGrid({ fields, row, formatCell, getRowValue }) {
  if (!fields?.length) return null
  return (
    <dl className="record-module__grid">
      {fields.map((col) => (
        <div key={col.key} className="record-module__field">
          <dt>{col.label}</dt>
          <dd>{formatCell(getRowValue(row, col), col)}</dd>
        </div>
      ))}
    </dl>
  )
}

/**
 * Read-only module layout for a single DB row.
 * Pass `sections` to group fields:
 * - alwaysVisible / defaultOpen sections stay expanded (main fields)
 * - other sections collapse by default
 */
export default function RecordModule({
  title,
  subtitle,
  columns,
  sections,
  row,
  formatCell,
  getRowValue,
  actions,
  children,
}) {
  const fields = (columns || []).filter((c) => c.visible !== false)
  const hasSections = Array.isArray(sections) && sections.length > 0

  return (
    <div className="card record-module">
      <div className="record-module__header">
        <div>
          <h2 className="card__title" style={{ margin: 0 }}>{title}</h2>
          {subtitle && <p className="record-module__subtitle">{subtitle}</p>}
        </div>
        {actions && <div className="record-module__actions">{actions}</div>}
      </div>

      {row && hasSections && (
        <div className="record-module__sections">
          {sections.map((section) => {
            const sectionFields = (section.columns || []).filter((c) => c.visible !== false)
            if (!sectionFields.length) return null

            if (section.alwaysVisible || section.defaultOpen) {
              return (
                <div key={section.id} className="record-module__always">
                  <h3 className="record-module__section-title">{section.title}</h3>
                  <FieldGrid
                    fields={sectionFields}
                    row={row}
                    formatCell={formatCell}
                    getRowValue={getRowValue}
                  />
                </div>
              )
            }

            return (
              <details key={section.id} className="collapse-section">
                <summary className="collapse-section__title">{section.title}</summary>
                <div className="collapse-section__body">
                  <FieldGrid
                    fields={sectionFields}
                    row={row}
                    formatCell={formatCell}
                    getRowValue={getRowValue}
                  />
                </div>
              </details>
            )
          })}
        </div>
      )}

      {row && !hasSections && (
        <FieldGrid
          fields={fields}
          row={row}
          formatCell={formatCell}
          getRowValue={getRowValue}
        />
      )}

      {children}
    </div>
  )
}
