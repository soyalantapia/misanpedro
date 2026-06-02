/**
 * Select custom con diseño consistente con el resto de los inputs del PWA.
 * Reemplaza al <select> nativo del browser que es feo y no se puede estilizar.
 *
 * Soporta:
 *   - Teclado: ↑/↓ navegan, Enter selecciona, Esc cierra
 *   - Click outside cierra
 *   - Scroll automático al option highlighted
 *   - aria-* básicos (listbox / option / selected / expanded)
 *
 * No usamos ninguna librería headless (Radix, HeadlessUI) — esto es chiquito
 * y queremos cero dependencias extra en el bundle del PWA.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, Check } from 'lucide-react'
import { cn } from '@/lib/cn'

export type SelectOption<T extends string> = {
  value: T
  label: string
}

export function Select<T extends string>({
  value,
  onChange,
  options,
  placeholder = 'Elegí…',
  className,
  disabled = false,
  ariaLabel,
}: {
  value: T
  onChange: (v: T) => void
  options: SelectOption<T>[]
  placeholder?: string
  className?: string
  disabled?: boolean
  ariaLabel?: string
}) {
  const [open, setOpen] = useState(false)
  const [highlightedIdx, setHighlightedIdx] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  const selected = useMemo(
    () => options.find((o) => o.value === value),
    [options, value],
  )

  // Cuando se abre, ponemos el highlight en la opción seleccionada (o 0).
  useEffect(() => {
    if (!open) return
    const idx = options.findIndex((o) => o.value === value)
    setHighlightedIdx(idx >= 0 ? idx : 0)
  }, [open, options, value])

  // Click outside + tecla Esc cierran.
  useEffect(() => {
    if (!open) return
    function onDocPointer(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        setOpen(false)
        triggerRef.current?.focus()
        return
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setHighlightedIdx((i) => Math.min(i + 1, options.length - 1))
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setHighlightedIdx((i) => Math.max(i - 1, 0))
        return
      }
      if (e.key === 'Home') {
        e.preventDefault()
        setHighlightedIdx(0)
        return
      }
      if (e.key === 'End') {
        e.preventDefault()
        setHighlightedIdx(options.length - 1)
        return
      }
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        const opt = options[highlightedIdx]
        if (opt) {
          onChange(opt.value)
          setOpen(false)
          triggerRef.current?.focus()
        }
        return
      }
    }
    document.addEventListener('mousedown', onDocPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, highlightedIdx, options, onChange])

  // Scroll automático al highlight para que siempre esté visible.
  useEffect(() => {
    if (!open || !listRef.current) return
    const el = listRef.current.querySelector<HTMLLIElement>(
      `[data-idx="${highlightedIdx}"]`,
    )
    el?.scrollIntoView({ block: 'nearest' })
  }, [open, highlightedIdx])

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => !disabled && setOpen((o) => !o)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        className={cn(
          'flex w-full items-center justify-between gap-2 rounded-2xl bg-surface px-4 py-3 text-sm text-ink ring-1 ring-line transition-all',
          'focus:outline-none focus:ring-2 focus:ring-brand',
          'hover:ring-line',
          open && 'ring-2 ring-brand',
          disabled && 'cursor-not-allowed opacity-60',
        )}
      >
        <span className={cn('truncate text-left', !selected && 'text-ink-faint')}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown
          size={16}
          className={cn(
            'shrink-0 text-ink-faint transition-transform duration-150',
            open && 'rotate-180 text-brand-strong',
          )}
        />
      </button>

      {open && (
        <ul
          ref={listRef}
          role="listbox"
          className={cn(
            'absolute left-0 right-0 z-30 mt-1.5 max-h-72 overflow-auto rounded-2xl bg-surface p-1.5 shadow-floating ring-1 ring-line',
            'animate-in fade-in-0 zoom-in-95 duration-100',
          )}
        >
          {options.map((o, i) => {
            const isSelected = o.value === value
            const isHi = i === highlightedIdx
            return (
              <li
                key={o.value}
                role="option"
                aria-selected={isSelected}
                data-idx={i}
                onMouseEnter={() => setHighlightedIdx(i)}
                onClick={() => {
                  onChange(o.value)
                  setOpen(false)
                  triggerRef.current?.focus()
                }}
                className={cn(
                  'flex cursor-pointer items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm transition-colors',
                  isHi ? 'bg-surface-2 text-ink' : 'text-ink',
                  isSelected && 'font-semibold',
                )}
              >
                <span className="truncate">{o.label}</span>
                {isSelected && (
                  <Check size={14} className="shrink-0 text-brand-strong" />
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
