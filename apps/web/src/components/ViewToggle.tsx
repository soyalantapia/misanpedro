import { Tag, Store } from 'lucide-react'
import { cn } from '@/lib/cn'

export type View = 'descuento' | 'local'

const OPTIONS: { value: View; label: string; icon: typeof Tag }[] = [
  { value: 'descuento', label: 'Cupones', icon: Tag },
  { value: 'local', label: 'Locales', icon: Store },
]

export function ViewToggle({
  value,
  onChange,
}: {
  value: View
  onChange: (v: View) => void
}) {
  return (
    <div
      role="group"
      aria-label="Cómo querés explorar"
      className="grid grid-cols-2 gap-1 rounded-2xl bg-fin-surface p-1 ring-1 ring-fin-line"
    >
      {OPTIONS.map(({ value: v, label, icon: Icon }) => {
        const active = value === v
        return (
          <button
            key={v}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(v)}
            className={cn(
              'flex items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-xs font-bold transition-all duration-200',
              active
                ? 'bg-fin-surface2 text-fin-ink ring-1 ring-fin-line'
                : 'text-fin-soft hover:text-fin-ink',
            )}
          >
            <Icon size={14} className={active ? 'text-fin-lime' : 'text-fin-faint'} />
            {label}
          </button>
        )
      })}
    </div>
  )
}
