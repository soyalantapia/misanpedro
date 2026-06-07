import { useMemo } from 'react'
import { useApiMyActivations } from './apiQueries'
import { tokens } from './api'
import type { Coupon } from './types'

/**
 * Estado del límite de uso por persona, calculado CLIENT-SIDE (complemento del
 * guard real del backend). Espeja la lógica de packages/shared/usageLimit.ts
 * (el front no importa @misanpedro/shared, por eso la duplicamos chica acá).
 */

export type UsoVentana = 'devida' | 'semana' | 'quincena' | 'mes' | 'ilimitado'

const VENTANA_DIAS: Record<UsoVentana, number | null> = {
  ilimitado: null,
  devida: 0,
  semana: 7,
  quincena: 15,
  mes: 30,
}
const DIA_MS = 24 * 60 * 60 * 1000

export type UsoEstado = {
  ventana: UsoVentana
  max: number
  usos: number
  /** Usos que le quedan en la ventana (Infinity si ilimitado). */
  restantes: number
  bloqueado: boolean
  nextDisponible: Date | null
}

export function estadoUsoCupon(
  coupon: Pick<Coupon, 'usoMaxPorPersona' | 'usoVentana'>,
  fechasDeCanje: Date[],
  now: Date = new Date(),
): UsoEstado {
  const ventana = (coupon.usoVentana ?? 'devida') as UsoVentana
  const max = Math.max(1, coupon.usoMaxPorPersona ?? 1)
  if (ventana === 'ilimitado') {
    return { ventana, max, usos: 0, restantes: Infinity, bloqueado: false, nextDisponible: null }
  }
  const dias = VENTANA_DIAS[ventana] ?? 0
  const inicio = dias > 0 ? now.getTime() - dias * DIA_MS : 0
  const enVentana = fechasDeCanje
    .filter((d) => d.getTime() >= inicio)
    .sort((a, b) => a.getTime() - b.getTime())
  const usos = enVentana.length
  const bloqueado = usos >= max
  const restantes = Math.max(0, max - usos)
  let nextDisponible: Date | null = null
  if (bloqueado && dias > 0 && enVentana.length > 0) {
    nextDisponible = new Date(enVentana[0].getTime() + dias * DIA_MS)
  }
  return { ventana, max, usos, restantes, bloqueado, nextDisponible }
}

/** "Disponible mañana" / "Disponible en 3 días" / "Disponible el 12 de junio". */
export function textoDisponible(next: Date | null, now: Date = new Date()): string | null {
  if (!next) return null
  const dias = Math.ceil((next.getTime() - now.getTime()) / DIA_MS)
  if (dias <= 0) return 'Disponible de nuevo'
  if (dias === 1) return 'Disponible mañana'
  if (dias <= 7) return `Disponible en ${dias} días`
  return `Disponible el ${next.toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })}`
}

/**
 * Baja los canjeados del vecino UNA vez y devuelve `getEstado(coupon)`.
 * El padre (DescuentosPage / MerchantDetailPage) lo llama una vez y pasa el
 * estado por prop a cada card (sin fetch por card).
 */
export function useUsoEstado() {
  const loggedIn = !!(tokens.get('user').access || tokens.get('user').refresh)
  const { data } = useApiMyActivations('canjeado', loggedIn)
  const porCupon = useMemo(() => {
    const m = new Map<string, Date[]>()
    for (const a of data ?? []) {
      if (!a.redeemedAt) continue
      const arr = m.get(a.couponId) ?? []
      arr.push(new Date(a.redeemedAt))
      m.set(a.couponId, arr)
    }
    return m
  }, [data])
  return useMemo(
    () =>
      (coupon: Pick<Coupon, 'id' | 'usoMaxPorPersona' | 'usoVentana'>): UsoEstado =>
        estadoUsoCupon(coupon, porCupon.get(coupon.id) ?? []),
    [porCupon],
  )
}
