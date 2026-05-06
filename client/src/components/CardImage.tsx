import {
  UtensilsCrossed,
  Shirt,
  Stethoscope,
  Sparkles,
  Wrench,
  Sofa,
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
  indumentaria: {
    bg: 'from-pink-300 via-rose-400 to-fuchsia-600',
    Icon: Shirt,
  },
  salud: {
    bg: 'from-teal-300 via-emerald-400 to-emerald-600',
    Icon: Stethoscope,
  },
  belleza: {
    bg: 'from-rose-300 via-pink-400 to-pink-600',
    Icon: Sparkles,
  },
  servicios: {
    bg: 'from-sky-300 via-blue-400 to-indigo-600',
    Icon: Wrench,
  },
  hogar: {
    bg: 'from-lime-300 via-green-400 to-emerald-600',
    Icon: Sofa,
  },
}

export function CardImage({
  categoria,
  className,
  size = 'md',
}: {
  categoria: Categoria
  className?: string
  size?: 'sm' | 'md' | 'lg'
}) {
  const v = variants[categoria]
  const iconSize = size === 'lg' ? 64 : size === 'sm' ? 28 : 44
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
