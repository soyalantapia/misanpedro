const monthsShort = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
]

export function formatVigencia(iso: string): string {
  const d = new Date(iso)
  return `Vigente hasta el ${d.getDate()} de ${monthsShort[d.getMonth()]}`
}

export function formatRedeemedDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getDate()} ${monthsShort[d.getMonth()]} · ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function formatMoney(amount: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatTimeRemaining(expiresAtIso: string, nowMs = Date.now()): string {
  const remainingMs = new Date(expiresAtIso).getTime() - nowMs
  if (remainingMs <= 0) return 'Expirado'
  const totalSec = Math.floor(remainingMs / 1000)
  const min = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  return `${pad(min)}:${pad(sec)}`
}

export function distanceLabel(km: number): string {
  if (km < 0.4) return `A ${Math.max(1, Math.round(km * 12))} cuadras`
  if (km < 1) return `A ${Math.round(km * 1000)} m`
  return `A ${km.toFixed(1)} km`
}

export function calcAhorro(porcentaje: number, ticketEstimado = 4000) {
  return Math.round((ticketEstimado * porcentaje) / 100)
}

export function pad(n: number): string {
  return String(n).padStart(2, '0')
}

import type { HorariosSemana, DiaSemana } from './types'
import { DIAS_SEMANA } from './types'

/**
 * Convierte HorariosSemana a un string legible agrupando días con el mismo
 * horario. Ej: "Lun a Vie · 9 a 18 hs · Sáb 10 a 14 · Dom cerrado"
 */
export function formatHorariosSemana(detalle: HorariosSemana): string {
  type Group = { from: number; to: number; key: string; label: string }
  const groups: Group[] = []
  let current: Group | null = null

  DIAS_SEMANA.forEach((d, i) => {
    const horario = detalle[d.id]
    const key = horario.abierto
      ? `abierto:${horario.desde}-${horario.hasta}`
      : 'cerrado'
    const label = horario.abierto
      ? `${horario.desde} a ${horario.hasta}`
      : 'cerrado'
    if (current && current.key === key) {
      current.to = i
    } else {
      if (current) groups.push(current)
      current = { from: i, to: i, key, label }
    }
  })
  if (current) groups.push(current)

  return groups
    .map((g) => {
      const fromCorto = DIAS_SEMANA[g.from].corto
      const toCorto = DIAS_SEMANA[g.to].corto
      const range =
        g.from === g.to ? fromCorto : `${fromCorto} a ${toCorto}`
      return g.label === 'cerrado' ? `${range} cerrado` : `${range} · ${g.label}`
    })
    .join(' · ')
}

/** Convierte string viejo a un HorariosSemana sensato (todos abiertos 9-18) */
export function defaultHorariosSemana(): HorariosSemana {
  const dias: DiaSemana[] = ['lun', 'mar', 'mie', 'jue', 'vie', 'sab', 'dom']
  const result: Partial<HorariosSemana> = {}
  dias.forEach((d) => {
    if (d === 'dom') {
      result[d] = { abierto: false }
    } else {
      result[d] = { abierto: true, desde: '09:00', hasta: '20:00' }
    }
  })
  return result as HorariosSemana
}
