import type { ApiActivation } from './api'

/**
 * EL CLUB — lógica pura de los niveles MENSUALES del vecino.
 *
 * Todo se deriva de los canjes que la app ya baja (status 'canjeado', con
 * `redeemedAt` + `ahorroEstimado`). Sin backend. Ver ClubCard para la UI.
 *
 * El nivel es por CANJES del mes calendario (distinto del ahorro en $).
 */

// ─── Constantes tuneables ────────────────────────────────────────────
// Canjes en el mes calendario actual para alcanzar cada nivel.
export const BRONCE = 1
export const PLATA = 4
export const ORO = 8

export type Nivel = {
  /** null = todavía sin nivel este mes */
  label: string | null
  medal: string
  /** null = ya es el máximo (Oro) */
  next: { label: string; min: number } | null
}

export function nivelDe(canjes: number): Nivel {
  if (canjes >= ORO) return { label: 'Oro', medal: '🥇', next: null }
  if (canjes >= PLATA) return { label: 'Plata', medal: '🥈', next: { label: 'Oro', min: ORO } }
  if (canjes >= BRONCE) return { label: 'Bronce', medal: '🥉', next: { label: 'Plata', min: PLATA } }
  return { label: null, medal: '🎯', next: { label: 'Bronce', min: BRONCE } }
}

/** Índice de mes monótono (año*12+mes) para comparar y restar meses. */
function monthIndex(d: Date): number {
  return d.getFullYear() * 12 + d.getMonth()
}

export type ClubStats = {
  canjesEsteMes: number
  nivel: Nivel
  /** Canjes que faltan para el próximo nivel (0 si ya es Oro). */
  faltan: number
  /** % de avance al próximo nivel (100 si ya es Oro). */
  progress: number
  /** Permanente: suma de ahorroEstimado de TODOS los canjes. */
  ahorroTotal: number
  /** Meses calendario consecutivos con ≥1 canje, terminando en el mes actual
   *  (o en el último mes con canje si este mes todavía no hubo). */
  racha: number
}

type CanjeLike = Pick<ApiActivation, 'redeemedAt' | 'ahorroEstimado'>

export function computeClub(canjeados: CanjeLike[], now: Date): ClubStats {
  const nowIdx = monthIndex(now)

  const canjesEsteMes = canjeados.filter(
    (a) => a.redeemedAt && monthIndex(new Date(a.redeemedAt)) === nowIdx,
  ).length

  const ahorroTotal = canjeados.reduce((s, a) => s + (a.ahorroEstimado ?? 0), 0)

  // Racha: contamos hacia atrás desde el mes actual (o el último con canje).
  const meses = new Set(
    canjeados.filter((a) => a.redeemedAt).map((a) => monthIndex(new Date(a.redeemedAt!))),
  )
  let racha = 0
  let cursor: number | null = meses.has(nowIdx) ? nowIdx : meses.size ? Math.max(...meses) : null
  while (cursor !== null && meses.has(cursor)) {
    racha++
    cursor--
  }

  const nivel = nivelDe(canjesEsteMes)
  const faltan = nivel.next ? nivel.next.min - canjesEsteMes : 0
  const progress = nivel.next
    ? Math.min(100, Math.round((canjesEsteMes / nivel.next.min) * 100))
    : 100

  return { canjesEsteMes, nivel, faltan, progress, ahorroTotal, racha }
}
