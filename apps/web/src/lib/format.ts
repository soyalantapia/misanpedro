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
  return `Vigente hasta el ${d.getDate()} de ${monthsShort[d.getMonth()]} de ${d.getFullYear()}`
}

export function formatRedeemedDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getDate()} ${monthsShort[d.getMonth()]} · ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/**
 * Locale/moneda activos para el formateo de plata. Por defecto es-AR/ARS
 * (compatibilidad con el deploy histórico de Mi San Pedro). El tenant activo
 * lo sobrescribe vía setMoneyLocale() al cargar su config (ver lib/tenant.ts),
 * habilitando ciudades multi-país (ej. Colombia → es-CO/COP).
 */
let _money = { locale: 'es-AR', currency: 'ARS' }

/**
 * Setea el locale (BCP-47) y la moneda (ISO-4217) usados por formatMoney().
 * Valida construyendo un formatter de prueba: un locale o una moneda inválidos
 * hacen que Intl.NumberFormat lance RangeError, lo que rompería el render de TODO
 * precio en la sesión. Si no son válidos, conservamos el valor anterior (default
 * es-AR/ARS) y avisamos, en vez de envenenar formatMoney().
 */
export function setMoneyLocale(locale: string, currency: string): void {
  try {
    new Intl.NumberFormat(locale, { style: 'currency', currency }).format(0)
    _money = { locale, currency }
  } catch {
    console.warn(
      `[format] locale/moneda inválidos (${locale}/${currency}) — mantengo ${_money.locale}/${_money.currency}`,
    )
  }
}

export function formatMoney(amount: number): string {
  return new Intl.NumberFormat(_money.locale, {
    style: 'currency',
    currency: _money.currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

/**
 * Como formatMoney pero devuelve el símbolo y el número por separado, para UIs
 * que los estilan distinto (ej. el número grande del ahorro con el símbolo chico).
 * Respeta la moneda/locale del tenant (no asume "$").
 */
export function formatMoneyParts(amount: number): { symbol: string; value: string } {
  try {
    const parts = new Intl.NumberFormat(_money.locale, {
      style: 'currency',
      currency: _money.currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).formatToParts(amount)
    const symbol = parts
      .filter((p) => p.type === 'currency')
      .map((p) => p.value)
      .join('')
    const value = parts
      .filter((p) => p.type === 'integer' || p.type === 'group' || p.type === 'decimal' || p.type === 'fraction')
      .map((p) => p.value)
      .join('')
    return { symbol: symbol || '$', value: value || String(Math.round(amount)) }
  } catch {
    return { symbol: '$', value: String(Math.round(amount)) }
  }
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

export function pad(n: number): string {
  return String(n).padStart(2, '0')
}

import type { HorariosSemana, DiaSemana } from './types'
import { DIAS_SEMANA } from './types'

/**
 * Convierte HorariosSemana a un string legible agrupando días con el mismo
 * horario. Ej: "Lun a Vie · 9 a 18 hs · Sáb 10 a 14 · Dom cerrado"
 *
 * Si el detalle es inválido (undefined, vacío o le faltan días) retorna ''.
 * Los callers pueden hacer fallback al string viejo de `merchant.horarios`.
 */
export function formatHorariosSemana(detalle: HorariosSemana | undefined | null): string {
  if (!detalle || typeof detalle !== 'object') return ''
  // Si falta cualquier día, no se puede formatear de forma confiable.
  const completo = DIAS_SEMANA.every((d) => detalle[d.id] !== undefined)
  if (!completo) return ''

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

/** Convierte string viejo a un HorariosSemana sensato (Lun–Vie 9–18, Sáb 9–13, Dom cerrado) */
export function defaultHorariosSemana(): HorariosSemana {
  const result: Partial<HorariosSemana> = {}
  const dias: DiaSemana[] = ['lun', 'mar', 'mie', 'jue', 'vie', 'sab', 'dom']
  dias.forEach((d) => {
    if (d === 'dom') {
      result[d] = { abierto: false }
    } else if (d === 'sab') {
      result[d] = { abierto: true, desde: '09:00', hasta: '13:00' }
    } else {
      result[d] = { abierto: true, desde: '09:00', hasta: '18:00' }
    }
  })
  return result as HorariosSemana
}

/**
 * ¿El comercio está abierto ahora según su horario por día?
 *   - `true`  → abierto en este momento
 *   - `false` → cerrado (hoy no abre, o fuera de franja)
 *   - `null`  → sin info de horarios (la ficha oculta el chip)
 * Maneja franjas que cruzan medianoche (ej. 20:00–02:00).
 */
export function isOpenNow(
  detalle: HorariosSemana | undefined | null,
  now: Date = new Date(),
): boolean | null {
  if (!detalle || typeof detalle !== 'object') return null
  const map: DiaSemana[] = ['dom', 'lun', 'mar', 'mie', 'jue', 'vie', 'sab']
  const h = detalle[map[now.getDay()]]
  if (!h) return null
  if (!h.abierto) return false
  const toMin = (s: string) => {
    const [hh, mm] = s.split(':').map(Number)
    return Number.isNaN(hh) || Number.isNaN(mm) ? null : hh * 60 + mm
  }
  const desde = toMin(h.desde)
  const hasta = toMin(h.hasta)
  if (desde == null || hasta == null) return null
  const cur = now.getHours() * 60 + now.getMinutes()
  return hasta < desde ? cur >= desde || cur <= hasta : cur >= desde && cur <= hasta
}

/** Convierte "1992-06-15" → "15 de junio de 1992" (es-AR).
 *  Importante: agregamos T12:00:00 para evitar bug de timezone — `new Date("1992-06-15")`
 *  se interpreta como UTC midnight, que en zonas al oeste de UTC (ej. AR = UTC-3)
 *  hace que `.getDate()` devuelva el día anterior. */
export function formatBirthdate(iso: string): string {
  if (!iso) return '—'
  // Si ya viene con hora (ISO completo), usar tal cual. Si es solo "YYYY-MM-DD",
  // anclamos al mediodía local para que el día renderizado sea siempre el correcto.
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T12:00:00` : iso
  const d = new Date(normalized)
  if (Number.isNaN(d.getTime())) return iso
  const meses = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
  ]
  return `${d.getDate()} de ${meses[d.getMonth()]} de ${d.getFullYear()}`
}
