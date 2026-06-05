import { CATEGORIAS, type Categoria } from '@/lib/types'
import { cn } from '@/lib/cn'

/** Emoji + etiqueta corta por categoría (para los cuadraditos del filtro). */
const CAT_META: Record<Categoria, { emoji: string; short: string }> = {
  gastronomia: { emoji: '🍴', short: 'Comida' },
  cafeteria: { emoji: '☕', short: 'Café' },
  panaderia: { emoji: '🥐', short: 'Panadería' },
  supermercado: { emoji: '🛒', short: 'Súper' },
  kiosco: { emoji: '🍬', short: 'Kiosco' },
  indumentaria: { emoji: '👕', short: 'Ropa' },
  calzado: { emoji: '👟', short: 'Calzado' },
  belleza: { emoji: '💄', short: 'Belleza' },
  salud: { emoji: '🩺', short: 'Salud' },
  farmacia: { emoji: '💊', short: 'Farmacia' },
  hogar: { emoji: '🛋️', short: 'Hogar' },
  libreria: { emoji: '📚', short: 'Librería' },
  ferreteria: { emoji: '🔧', short: 'Ferretería' },
  tecnologia: { emoji: '📱', short: 'Tecno' },
  mascotas: { emoji: '🐾', short: 'Mascotas' },
  deporte: { emoji: '⚽', short: 'Deporte' },
  servicios: { emoji: '💼', short: 'Servicios' },
  inmobiliaria: { emoji: '🏠', short: 'Inmob.' },
  otro: { emoji: '🧩', short: 'Otro' },
}

export function CategoryChips({
  selected,
  onChange,
}: {
  selected: Categoria | null
  onChange: (c: Categoria | null) => void
}) {
  return (
    <div
      role="group"
      aria-label="Filtrar por categoría"
      className="flex gap-1.5 overflow-x-auto px-1 pt-1.5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <Tile emoji="🔥" label="Todas" active={selected === null} onClick={() => onChange(null)} />
      {CATEGORIAS.map((c) => {
        const meta = CAT_META[c.id]
        return (
          <Tile
            key={c.id}
            emoji={meta.emoji}
            label={meta.short}
            fullLabel={c.label}
            active={selected === c.id}
            onClick={() => onChange(selected === c.id ? null : c.id)}
          />
        )
      })}
    </div>
  )
}

/** Cuadradito de categoría: emoji arriba + etiqueta corta debajo. */
function Tile({
  emoji,
  label,
  fullLabel,
  active,
  onClick,
}: {
  emoji: string
  label: string
  fullLabel?: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={fullLabel ?? label}
      title={fullLabel ?? label}
      onClick={onClick}
      className="flex w-16 shrink-0 flex-col items-center gap-1"
    >
      <span
        className={cn(
          'grid h-12 w-12 place-items-center rounded-2xl text-2xl leading-none transition-all duration-200',
          active
            ? 'bg-fin-lime/15 ring-2 ring-fin-lime'
            : 'bg-fin-surface2 ring-1 ring-fin-line hover:-translate-y-0.5',
        )}
      >
        {emoji}
      </span>
      <span
        className={cn(
          'w-full whitespace-nowrap text-center text-[10px] font-semibold leading-tight',
          active ? 'text-fin-lime' : 'text-fin-soft',
        )}
      >
        {label}
      </span>
    </button>
  )
}
