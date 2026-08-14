import { useEffect, useId, useMemo, useRef, useState } from 'react'

/**
 * Combobox: type freely (new value) or pick a filtered suggestion.
 */
export default function SuggestInput({
  id,
  label,
  value,
  onChange,
  options = [],
  required,
  placeholder,
}) {
  const autoId = useId()
  const inputId = id || autoId
  const rootRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(0)

  const filtered = useMemo(() => {
    const q = String(value || '').trim().toLowerCase()
    const uniq = [...new Set((options || []).map((o) => String(o).trim()).filter(Boolean))]
    if (!q) return uniq.slice(0, 80)
    return uniq.filter((o) => o.toLowerCase().includes(q)).slice(0, 80)
  }, [options, value])

  useEffect(() => {
    function onDoc(e) {
      if (!rootRef.current?.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  function pick(opt) {
    onChange(opt)
    setOpen(false)
  }

  function onKeyDown(e) {
    if (!open && e.key === 'ArrowDown') {
      e.preventDefault()
      setOpen(true)
      return
    }
    if (!open) return
    if (e.key === 'Escape') {
      setOpen(false)
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlight((i) => Math.min(i + 1, Math.max(filtered.length - 1, 0)))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && filtered[highlight]) {
      e.preventDefault()
      pick(filtered[highlight])
    }
  }

  return (
    <div className="form-group searchable-select" ref={rootRef}>
      <label htmlFor={inputId}>
        {label}
        {required ? ' *' : ''}
      </label>
      <div className={`searchable-select__control${open ? ' searchable-select__control--open' : ''}`}>
        <input
          id={inputId}
          type="text"
          role="combobox"
          aria-expanded={open}
          value={value ?? ''}
          onChange={(e) => {
            onChange(e.target.value)
            setOpen(true)
            setHighlight(0)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={placeholder || 'Seçin və ya yazın…'}
          required={required}
          autoComplete="off"
        />
        <span className="searchable-select__chevron" aria-hidden>
          ▾
        </span>
      </div>
      {open && filtered.length > 0 && (
        <ul className="searchable-select__list" role="listbox">
          {filtered.map((opt, index) => (
            <li key={opt}>
              <button
                type="button"
                role="option"
                className={[
                  'searchable-select__option',
                  index === highlight ? 'searchable-select__option--highlight' : '',
                  opt === value ? 'searchable-select__option--active' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onMouseEnter={() => setHighlight(index)}
                onClick={() => pick(opt)}
              >
                {opt}
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="form-hint">Mövcuddan axtarıb seçin və ya yeni dəyər yazın</p>
    </div>
  )
}
