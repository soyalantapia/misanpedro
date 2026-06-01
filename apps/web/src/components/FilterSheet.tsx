import { useEffect } from 'react'
import { X, MapPin, Percent, ArrowDownWideNarrow, Sparkles } from 'lucide-react'
import { cn } from '@/lib/cn'

export type SortMode = 'cerca' | 'descuento' | 'nuevos'

export const PCT_OPTIONS = [0, 15, 25, 40] as const
export type MinPct = (typeof PCT_OPTIONS)[number]

const SORTS: { value: SortMode; label: string; icon: typeof MapPin; needsGeo?: boolean }[] = [
  { value: 'cerca', label: 'Cerca tuyo', icon: MapPin, needsGeo: true },
  { value: 'descuento', label: 'Mayor descuento', icon: ArrowDownWideNarrow },
  { value: 'nuevos', label: 'Más nuevos', icon: Sparkles },
]

export function FilterSheet({
  open,
  onClose,
  minPct,
  onMinPct,
  sort,
  onSort,
  geoAvailable,
  onClearAll,
  resultCount,
}: {
  open: boolean
  onClose: () => void
  minPct: MinPct
  onMinPct: (p: MinPct) => void
  sort: SortMode
  onSort: (s: SortMode) => void
  geoAvailable: boolean
  onClearAll: () => void
  resultCount: number
}) {
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Cerrar filtros"
        onClick={onClose}
        className="animate-fade-in absolute inset-0 bg-black/60 backdrop-blur-sm"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Filtros"
        className="animate-toast-in-mobile relative w-full rounded-t-3xl bg-fin-surface p-5 ring-1 ring-fin-line shadow-fin-card sm:m-4 sm:max-w-md sm:rounded-3xl"
        style={{ paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom))' }}
      >
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-fin-line sm:hidden" />
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-fin-ink">Filtros y orden</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="grid h-8 w-8 place-items-center rounded-full text-fin-soft hover:bg-fin-surface2 hover:text-fin-ink"
          >
            <X size={16} />
          </button>
        </div>

        <section className="mt-5">
          <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-fin-faint">
            <Percent size={12} /> Descuento mínimo
          </p>
          <div className="mt-2 grid grid-cols-4 gap-2">
            {PCT_OPTIONS.map((p) => (
              <button
                key={p}
                type="button"
                aria-pressed={minPct === p}
                onClick={() => onMinPct(p)}
                className={cn(
                  'rounded-xl py-2.5 text-sm font-bold transition-all duration-200',
                  minPct === p
                    ? 'bg-fin-lime text-fin-bg shadow-fin-glow'
                    : 'bg-fin-surface2 text-fin-soft ring-1 ring-fin-line hover:text-fin-ink',
                )}
              >
                {p === 0 ? 'Todos' : `${p}%+`}
              </button>
            ))}
          </div>
        </section>

        <section className="mt-5">
          <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-fin-faint">
            <ArrowDownWideNarrow size={12} /> Ordenar por
          </p>
          <div className="mt-2 flex flex-col gap-2">
            {SORTS.map(({ value, label, icon: Icon, needsGeo }) => {
              const disabled = needsGeo && !geoAvailable
              const active = sort === value
              return (
                <button
                  key={value}
                  type="button"
                  disabled={disabled}
                  aria-pressed={active}
                  onClick={() => onSort(value)}
                  className={cn(
                    'flex items-center gap-2.5 rounded-2xl px-4 py-3 text-sm font-semibold transition-all duration-200',
                    active
                      ? 'bg-fin-lime/15 text-fin-lime ring-1 ring-fin-lime/30'
                      : 'bg-fin-surface2 text-fin-soft ring-1 ring-fin-line hover:text-fin-ink',
                    disabled && 'cursor-not-allowed opacity-40',
                  )}
                >
                  <Icon size={16} className={active ? 'text-fin-lime' : 'text-fin-faint'} />
                  {label}
                  {disabled && (
                    <span className="ml-auto text-[10px] font-medium text-fin-faint">
                      activá ubicación
                    </span>
                  )}
                  {active && <span className="ml-auto h-2 w-2 rounded-full bg-fin-lime" />}
                </button>
              )
            })}
          </div>
        </section>

        <div className="mt-6 flex items-center gap-3">
          <button
            type="button"
            onClick={onClearAll}
            className="rounded-2xl px-4 py-3 text-sm font-semibold text-fin-soft hover:text-fin-ink"
          >
            Limpiar
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-2xl bg-fin-lime py-3 text-sm font-bold text-fin-bg shadow-fin-glow transition-transform active:scale-[0.98]"
          >
            Ver {resultCount} {resultCount === 1 ? 'resultado' : 'resultados'}
          </button>
        </div>
      </div>
    </div>
  )
}
