import {
  UtensilsCrossed,
  Shirt,
  Stethoscope,
  Sparkles,
  Wrench,
  Sofa,
  Coffee,
  Croissant,
  ShoppingCart,
  Store as StoreIcon,
  Footprints,
  Pill,
  BookOpen,
  Hammer,
  Laptop,
  PawPrint,
  Dumbbell,
  Tag,
  type LucideIcon,
} from 'lucide-react'
import type { Categoria } from '@/lib/types'
import { cn } from '@/lib/cn'

type Variant = {
  bg: string
  Icon: LucideIcon
}

const variants: Record<Categoria, Variant> = {
  gastronomia: {
    bg: 'from-amber-300 via-amber-400 to-orange-500',
    Icon: UtensilsCrossed,
  },
  cafeteria: {
    bg: 'from-amber-200 via-orange-300 to-amber-600',
    Icon: Coffee,
  },
  panaderia: {
    bg: 'from-yellow-200 via-amber-300 to-orange-400',
    Icon: Croissant,
  },
  supermercado: {
    bg: 'from-emerald-300 via-teal-400 to-cyan-600',
    Icon: ShoppingCart,
  },
  kiosco: {
    bg: 'from-cyan-300 via-sky-400 to-blue-600',
    Icon: StoreIcon,
  },
  indumentaria: {
    bg: 'from-pink-300 via-rose-400 to-fuchsia-600',
    Icon: Shirt,
  },
  calzado: {
    bg: 'from-fuchsia-300 via-pink-400 to-rose-600',
    Icon: Footprints,
  },
  belleza: {
    bg: 'from-rose-300 via-pink-400 to-pink-600',
    Icon: Sparkles,
  },
  salud: {
    bg: 'from-teal-300 via-emerald-400 to-emerald-600',
    Icon: Stethoscope,
  },
  farmacia: {
    bg: 'from-green-300 via-emerald-400 to-teal-600',
    Icon: Pill,
  },
  hogar: {
    bg: 'from-lime-300 via-green-400 to-emerald-600',
    Icon: Sofa,
  },
  libreria: {
    bg: 'from-orange-300 via-amber-400 to-red-500',
    Icon: BookOpen,
  },
  ferreteria: {
    bg: 'from-zinc-300 via-slate-400 to-gray-600',
    Icon: Hammer,
  },
  tecnologia: {
    bg: 'from-indigo-300 via-blue-400 to-violet-600',
    Icon: Laptop,
  },
  mascotas: {
    bg: 'from-orange-300 via-rose-400 to-red-500',
    Icon: PawPrint,
  },
  deporte: {
    bg: 'from-lime-300 via-emerald-400 to-green-600',
    Icon: Dumbbell,
  },
  servicios: {
    bg: 'from-sky-300 via-blue-400 to-indigo-600',
    Icon: Wrench,
  },
  otro: {
    bg: 'from-neutral-300 via-zinc-400 to-stone-500',
    Icon: Tag,
  },
}

export function CardImage({
  categoria,
  className,
  size = 'md',
  coverImageUrl,
}: {
  categoria: Categoria
  className?: string
  size?: 'sm' | 'md' | 'lg'
  /** URL o dataURL — si está, reemplaza el gradiente categórico */
  coverImageUrl?: string
}) {
  const v = variants[categoria]
  const iconSize = size === 'lg' ? 64 : size === 'sm' ? 28 : 44

  if (coverImageUrl) {
    return (
      <div className={cn('relative overflow-hidden', className)}>
        <img
          src={coverImageUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          loading="lazy"
        />
      </div>
    )
  }

  return (
    <div
      className={cn(
        'relative overflow-hidden bg-gradient-to-br text-white/90',
        v.bg,
        className,
      )}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.3),transparent_55%)]" />
      <div className="absolute inset-0 grid place-items-center">
        <v.Icon size={iconSize} strokeWidth={1.6} />
      </div>
    </div>
  )
}
