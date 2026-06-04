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
  Building2,
  type LucideIcon,
} from 'lucide-react'
import type { Categoria } from '@/lib/types'
import { cn } from '@/lib/cn'

// Placeholder por categoría: superficie en TINTE CLARO + ícono en el color de la
// categoría. Antes eran gradientes saturados full-bleed que (a) se fundían con el
// naranja de marca en los rubros cálidos y (b) chocaban con el verde de "ahorrás"
// en los rubros verdes. Con tinte claro, cada rubro se distingue sin competir con
// la marca ni con el semáforo de ahorro, y el naranja queda reservado para acciones.
type Variant = {
  tint: string // fondo claro (superficie)
  ink: string // color del ícono / acento de la categoría
  Icon: LucideIcon
}

const variants: Record<Categoria, Variant> = {
  gastronomia: { tint: 'bg-amber-100', ink: 'text-amber-900', Icon: UtensilsCrossed },
  cafeteria: { tint: 'bg-orange-100', ink: 'text-orange-900', Icon: Coffee },
  panaderia: { tint: 'bg-yellow-100', ink: 'text-yellow-900', Icon: Croissant },
  supermercado: { tint: 'bg-teal-100', ink: 'text-teal-900', Icon: ShoppingCart },
  kiosco: { tint: 'bg-sky-100', ink: 'text-sky-900', Icon: StoreIcon },
  indumentaria: { tint: 'bg-pink-100', ink: 'text-pink-800', Icon: Shirt },
  calzado: { tint: 'bg-rose-100', ink: 'text-rose-800', Icon: Footprints },
  belleza: { tint: 'bg-fuchsia-100', ink: 'text-fuchsia-800', Icon: Sparkles },
  salud: { tint: 'bg-emerald-100', ink: 'text-emerald-900', Icon: Stethoscope },
  farmacia: { tint: 'bg-green-100', ink: 'text-green-900', Icon: Pill },
  hogar: { tint: 'bg-lime-100', ink: 'text-lime-900', Icon: Sofa },
  libreria: { tint: 'bg-red-100', ink: 'text-red-900', Icon: BookOpen },
  ferreteria: { tint: 'bg-slate-200', ink: 'text-slate-700', Icon: Hammer },
  tecnologia: { tint: 'bg-indigo-100', ink: 'text-indigo-900', Icon: Laptop },
  mascotas: { tint: 'bg-rose-100', ink: 'text-rose-800', Icon: PawPrint },
  deporte: { tint: 'bg-lime-100', ink: 'text-lime-900', Icon: Dumbbell },
  servicios: { tint: 'bg-blue-100', ink: 'text-blue-900', Icon: Wrench },
  inmobiliaria: { tint: 'bg-slate-100', ink: 'text-slate-800', Icon: Building2 },
  otro: { tint: 'bg-stone-100', ink: 'text-stone-700', Icon: Tag },
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
  /** URL o dataURL — si está, reemplaza el placeholder categórico */
  coverImageUrl?: string
}) {
  const v = variants[categoria]
  const iconSize = size === 'lg' ? 88 : size === 'sm' ? 34 : 60

  if (coverImageUrl) {
    // MO16: width/height intrínsecos para reservar layout y evitar CLS.
    // El contenedor maneja el tamaño real vía `className` (h-32, h-56, etc.),
    // pero el browser necesita los attrs para calcular el aspect ratio antes
    // de que la imagen se baje.
    const intrinsic = size === 'lg' ? { w: 800, h: 400 } : size === 'sm' ? { w: 320, h: 200 } : { w: 600, h: 300 }
    return (
      <div className={cn('relative overflow-hidden', className)}>
        <img
          src={coverImageUrl}
          alt=""
          width={intrinsic.w}
          height={intrinsic.h}
          className="absolute inset-0 h-full w-full object-cover"
          loading="lazy"
          decoding="async"
        />
      </div>
    )
  }

  return (
    <div className={cn('relative overflow-hidden', v.tint, className)}>
      {/* leve brillo para que no quede plano */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.55),transparent_60%)]" />
      <div className="absolute inset-0 grid place-items-center">
        <v.Icon size={iconSize} strokeWidth={2} className={v.ink} />
      </div>
    </div>
  )
}
