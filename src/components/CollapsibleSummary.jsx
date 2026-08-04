import { useEffect, useState } from 'react'
import { loadUiFlag, saveUiFlag } from '../lib/uiPrefs'

/**
 * Collapsible summary cards block — collapsed by default unless storageKey was opened before.
 */
export default function CollapsibleSummary({
  title = 'Cəmlər',
  children,
  className = '',
  storageKey,
  defaultOpen = false,
}) {
  const [open, setOpen] = useState(() =>
    storageKey ? loadUiFlag(storageKey, defaultOpen) : defaultOpen
  )

  useEffect(() => {
    if (!storageKey) return
    saveUiFlag(storageKey, open)
  }, [storageKey, open])

  return (
    <details
      className={`collapsible-summary ${className}`.trim()}
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary className="collapsible-summary__toggle">
        <span className="collapsible-summary__title">{title}</span>
        <span className="collapsible-summary__hint" aria-hidden>
          aç / bağla
        </span>
      </summary>
      <div className="collapsible-summary__body">{children}</div>
    </details>
  )
}
