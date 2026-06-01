import type { Categoria } from '@/lib/types'

/**
 * "Ocasiones" del planificador "Armá tu plan": traducen el lenguaje de la
 * persona ("¿qué querés hacer?") a las Categoria de comercio que ya existen.
 * Así el vecino elige una intención, no un rubro.
 */
export type Ocasion = {
  /** Id estable (para query string / matching). */
  id: string
  /** Etiqueta en lenguaje de persona. */
  label: string
  /** Emoji para el chip grande. */
  emoji: string
  /** Categorías de comercio que matchean esta ocasión. */
  categorias: Categoria[]
}

export const OCASIONES: Ocasion[] = [
  { id: 'comer', label: 'Comer afuera', emoji: '🍽️', categorias: ['gastronomia'] },
  { id: 'cafe', label: 'Un café / merienda', emoji: '☕', categorias: ['cafeteria', 'panaderia'] },
  { id: 'picar', label: 'Picar algo / salir', emoji: '🍻', categorias: ['gastronomia', 'cafeteria'] },
  { id: 'mimo', label: 'Un mimo / cuidarme', emoji: '💆', categorias: ['belleza', 'salud'] },
  {
    id: 'mandado',
    label: 'El mandado',
    emoji: '🛒',
    categorias: ['supermercado', 'panaderia', 'farmacia', 'kiosco'],
  },
  {
    id: 'chicos',
    label: 'Para los chicos',
    emoji: '🧸',
    categorias: ['indumentaria', 'calzado', 'libreria', 'deporte'],
  },
  {
    id: 'capricho',
    label: 'Un capricho / regalo',
    emoji: '🎁',
    categorias: ['indumentaria', 'calzado', 'tecnologia', 'belleza', 'hogar'],
  },
]

export function getOcasion(id: string | null | undefined): Ocasion | undefined {
  return OCASIONES.find((o) => o.id === id)
}
