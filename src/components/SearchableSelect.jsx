import { useEffect, useId, useMemo, useRef, useState } from 'react'

/**
 * Searchable single-select: type to filter, click (or Enter) to choose.
 * options: [{ value, label, keywords? }]
 */
export default function SearchableSelect({
  id,
  label,
  options = [],
  value = '',
  onChange,
  placeholder = 'Axtar və seçin…',
  emptyOption = null, // { value: '', label: '— Seçin —' } | null
  disabled = false,
  required = false,
  hint = null,
  noResultsText = 'Uyğun nəticə yoxdur.',
}) {
  const autoId = useId()
  const inputId = id || autoId
  const rootRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [highlight, setHighlight] = useState(0)

  const selected = useMemo(
    () => options.find((o) => String(o.value) === String(value)) || null,
    [options, value]
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = emptyOption ? [emptyOption, ...options] : options
    if (!q) return list
    return list.filter((o) => {
      const hay = `${o.label || ''} ${o.keywords || ''} ${o.value || ''}`.toLowerCase()
      return hay.includes(q)
    })
  }, [options, emptyOption, query])

  useEffect(() => {
    if (!open) {
      setQuery('')
      setHighlight(0)
    }
  }, [open])

  useEffect(() => {
    function onDoc(e) {
      if (!rootRef.current?.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  function pick(opt) {
    onChange?.(opt?.value ?? '', opt || null)
    setOpen(false)
    setQuery('')
  }

  function onKeyDown(e) {
    if (disabled) return
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter')) {
      e.preventDefault()
      setOpen(true)
      return
    }
    if (!open) return
    if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlight((i) => Math.min(i + 1, Math.max(filtered.length - 1, 0)))
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight((i) => Math.max(i - 1, 0))
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      const opt = filtered[highlight]
      if (opt) pick(opt)
    }
  }

  const display = open ? query : selected?.label || ''

  return (
    <div className="form-group searchable-select" ref={rootRef}>
      {label ? (
        <label htmlFor={inputId}>
          {label}
          {required ? ' *' : ''}
        </label>
      ) : null}
      <div className={`searchable-select__control${open ? ' searchable-select__control--open' : ''}`}>
        <input
          id={inputId}
          type="search"
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          aria-controls={`${inputId}-list`}
          disabled={disabled}
          required={required && !value}
          placeholder={placeholder}
          value={display}
          autoComplete="off"
          onFocus={() => {
            if (!disabled) setOpen(true)
          }}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
            setHighlight(0)
          }}
          onKeyDown={onKeyDown}
        />
        {value && !disabled ? (
          <button
            type="button"
            className="searchable-select__clear"
            aria-label="Təmizlə"
            onClick={() => pick(emptyOption || { value: '', label: '' })}
          >
            ×
          </button>
        ) : null}
        <span className="searchable-select__chevron" aria-hidden>
          ▾
        </span>
      </div>

      {open && (
        <ul id={`${inputId}-list`} className="searchable-select__list" role="listbox">
          {filtered.length === 0 ? (
            <li className="searchable-select__empty">{noResultsText}</li>
          ) : (
            filtered.map((opt, index) => {
              const active = String(opt.value) === String(value)
              return (
                <li key={`${opt.value}-${index}`}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={active}
                    className={[
                      'searchable-select__option',
                      active ? 'searchable-select__option--active' : '',
                      index === highlight ? 'searchable-select__option--highlight' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    onMouseEnter={() => setHighlight(index)}
                    onClick={() => pick(opt)}
                  >
                    {opt.label}
                  </button>
                </li>
              )
            })
          )}
        </ul>
      )}

      {hint ? <p className="form-hint">{hint}</p> : null}
    </div>
  )
}
