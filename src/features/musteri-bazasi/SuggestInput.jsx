/**
 * Combobox: pick an existing value from DB suggestions, or type a new one.
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
  const listId = `${id || label || 'field'}-suggestions`

  return (
    <div className="form-group">
      <label htmlFor={id}>{label}{required ? ' *' : ''}</label>
      <input
        id={id}
        list={listId}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || 'Seçin və ya yazın…'}
        required={required}
        autoComplete="off"
      />
      <datalist id={listId}>
        {options.map((opt) => (
          <option key={opt} value={opt} />
        ))}
      </datalist>
      <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--color-text-muted)' }}>
        Mövcuddan seçin və ya yeni dəyər yazın
      </p>
    </div>
  )
}
