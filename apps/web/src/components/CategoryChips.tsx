import { CATEGORIAS, type Categoria } from '@/lib/types'
import { cn } from '@/lib/cn'

export function CategoryChips({
  selected,
  onChange,
}: {
  selected: Categoria | null
  onChange: (c: Categoria | null) => void
}) {
  return (
    <div role="group" aria-label="Filtrar por categoría" className="flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <Chip active={selected === null} onClick={() => onChange(null)}>
        Todas
      </Chip>
      {CATEGORIAS.map((c) => (
        <Chip
          key={c.id}
          active={selected === c.id}
          onClick={() => onChange(selected === c.id ? null : c.id)}
        >
          {c.label}
        </Chip>
      ))}
    </div>
  )
}

function Chip({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'shrink-0 rounded-full px-4 py-1.5 text-xs font-semibold whitespace-nowrap transition-all duration-200',
        active
          ? 'bg-neutral-900 text-white shadow-cta-neutral'
          : 'bg-white text-neutral-600 ring-1 ring-neutral-100 hover:bg-primary-50',
      )}
    >
      {children}
    </button>
  )
}
