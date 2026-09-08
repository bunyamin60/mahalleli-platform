import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { namesMatch, uniqueSelectOptions } from '../utils/matchers'

function normalizeSearch(text) {
  return String(text || '')
    .toLocaleLowerCase('tr-TR')
    .trim()
}

/**
 * Yazarak aranabilir (autocomplete) seçim kutusu — react-select benzeri, bağımlılıksız.
 * options: string[] | { value: string, label: string }[]
 */
function SearchableSelect({
  options = [],
  value = '',
  onChange,
  placeholder = 'Seçiniz veya yazarak arayın…',
  disabled = false,
  required = false,
  emptyLabel = 'Sonuç bulunamadı',
}) {
  const listId = useId()
  const rootRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const normalizedOptions = useMemo(
    () =>
      uniqueSelectOptions(
        options.map((item) => (typeof item === 'string' ? { value: item, label: item } : item)),
      ),
    [options],
  )

  const selected = normalizedOptions.find(
    (item) =>
      item.value === value ||
      namesMatch(item.value, value) ||
      namesMatch(item.label, value),
  )
  const displayValue = open ? query : selected?.label || ''

  const filtered = useMemo(() => {
    const q = normalizeSearch(query)
    if (!q) {
      return normalizedOptions
    }
    return normalizedOptions.filter(
      (item) =>
        normalizeSearch(item.label).includes(q) || normalizeSearch(item.value).includes(q),
    )
  }, [normalizedOptions, query])

  useEffect(() => {
    if (!open) {
      setQuery('')
    }
  }, [open, value])

  useEffect(() => {
    const onPointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [])

  const selectOption = (option) => {
    onChange(option.value)
    setOpen(false)
    setQuery('')
  }

  return (
    <div className={`searchable-select ${disabled ? 'is-disabled' : ''}`} ref={rootRef}>
      <input
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        disabled={disabled}
        required={required && !value}
        value={displayValue}
        placeholder={placeholder}
        onFocus={() => {
          if (!disabled) {
            setOpen(true)
            setQuery('')
          }
        }}
        onChange={(event) => {
          setQuery(event.target.value)
          setOpen(true)
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            setOpen(false)
          }
          if (event.key === 'Enter' && filtered[0]) {
            event.preventDefault()
            selectOption(filtered[0])
          }
        }}
        autoComplete="off"
      />
      {open && !disabled && (
        <ul id={listId} className="searchable-select-menu" role="listbox">
          {!filtered.length && <li className="searchable-select-empty">{emptyLabel}</li>}
          {filtered.map((option) => (
            <li key={option.value} role="option" aria-selected={namesMatch(option.value, value)}>
              <button
                type="button"
                className={`searchable-select-option ${namesMatch(option.value, value) ? 'is-active' : ''}`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => selectOption(option)}
              >
                {option.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default SearchableSelect
