import { cn } from '@/lib/cn'

export type View = 'descuento' | 'local'

export function ViewToggle({
  value,
  onChange,
}: {
  value: View
  onChange: (v: View) => void
}) {
  return (
    <div className="grid grid-cols-2 rounded-full bg-primary-100 p-1 ring-1 ring-neutral-100">
      <button
        type="button"
        onClick={() => onChange('descuento')}
        className={cn(
          'rounded-full px-4 py-2 text-xs font-bold transition-all duration-200',
          value === 'descuento'
            ? 'bg-white text-neutral-900 shadow-card'
            : 'text-neutral-500 hover:text-neutral-800',
        )}
      >
        Por descuento
      </button>
      <button
        type="button"
        onClick={() => onChange('local')}
        className={cn(
          'rounded-full px-4 py-2 text-xs font-bold transition-all duration-200',
          value === 'local'
            ? 'bg-white text-neutral-900 shadow-card'
            : 'text-neutral-500 hover:text-neutral-800',
        )}
      >
        Por local
      </button>
    </div>
  )
}
