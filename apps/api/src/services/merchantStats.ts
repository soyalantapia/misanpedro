/**
 * Lógica pura de las stats del "Asesor" del comercio. Sin DB ni Mongoose: recibe
 * los canjes ya cargados y devuelve los agregados. El route (merchants.ts) se
 * encarga del scoping (appId+merchantId) y de los joins a Coupon/User.
 *
 * Extraído del handler para poder testear los números exactos con fixtures.
 */

export type Periodo = 'mes' | '7dias' | 'mesPasado' | 'todo'

export interface StatsRedemption {
  userId: string
  couponId: string
  montoTicket?: number | null
  redeemedAt: Date
}

export const DIAS_SEMANA = ['lun', 'mar', 'mie', 'jue', 'vie', 'sab', 'dom'] as const

/** Rango [start, end) del período + el período anterior del MISMO largo. */
export function periodRange(
  periodo: Periodo,
  now: Date,
): { start: Date; end: Date; prevStart: Date | null; prevEnd: Date | null } {
  const DAY = 24 * 60 * 60 * 1000
  if (periodo === 'mesPasado') {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const end = new Date(now.getFullYear(), now.getMonth(), 1)
    return { start, end, prevStart: new Date(now.getFullYear(), now.getMonth() - 2, 1), prevEnd: start }
  }
  if (periodo === '7dias') {
    const end = now
    const start = new Date(now.getTime() - 7 * DAY)
    return { start, end, prevStart: new Date(now.getTime() - 14 * DAY), prevEnd: start }
  }
  if (periodo === 'todo') {
    return { start: new Date(0), end: now, prevStart: null, prevEnd: null }
  }
  // mes (default): mes calendario actual; anterior = mes pasado completo
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  return { start, end, prevStart: new Date(now.getFullYear(), now.getMonth() - 1, 1), prevEnd: start }
}

export interface AsesorStatsRaw {
  periodo: Periodo
  /** Σ montoTicket del período — ESTIMADO. */
  ventas: number
  clientes: number
  nuevos: number
  crecimiento: { ventasPct: number | null; clientesPct: number | null }
  volvieron: number
  unaSolaVez: number
  totalClientes: number
  cuandoVienen: { dia: string; canjes: number }[]
  /** desc por canjes — el route resuelve el título. */
  cupones: { couponId: string; canjes: number }[]
  /** desc por visitas, top 8 — el route resuelve el nombre. */
  mejores: { userId: string; visitas: number }[]
}

function pctVar(cur: number, prev: number): number | null {
  if (prev === 0) return cur > 0 ? 100 : null
  return Math.round(((cur - prev) / prev) * 100)
}

export function computeAsesorStats(
  redemptions: StatsRedemption[],
  periodo: Periodo,
  now: Date,
): AsesorStatsRaw {
  const { start, end, prevStart, prevEnd } = periodRange(periodo, now)
  const inPeriod = periodo === 'todo' ? () => true : (d: Date) => d >= start && d < end

  // Agregado LIFETIME por usuario: cantidad + primer canje (min).
  const byUser = new Map<string, { count: number; first: Date }>()
  for (const r of redemptions) {
    if (!r.userId) continue
    const cur = byUser.get(r.userId)
    if (cur) {
      cur.count += 1
      if (r.redeemedAt < cur.first) cur.first = r.redeemedAt
    } else {
      byUser.set(r.userId, { count: 1, first: r.redeemedAt })
    }
  }

  const period = redemptions.filter((r) => inPeriod(r.redeemedAt))

  // ① Retorno
  const ventas = period.reduce((s, r) => s + (r.montoTicket || 0), 0)
  const clientes = new Set(period.map((r) => r.userId).filter(Boolean)).size
  const nuevos = [...byUser.values()].filter((u) => inPeriod(u.first)).length

  let crecimiento: { ventasPct: number | null; clientesPct: number | null } = {
    ventasPct: null,
    clientesPct: null,
  }
  if (prevStart && prevEnd) {
    const prev = redemptions.filter((r) => r.redeemedAt >= prevStart && r.redeemedAt < prevEnd)
    const ventasPrev = prev.reduce((s, r) => s + (r.montoTicket || 0), 0)
    const clientesPrev = new Set(prev.map((r) => r.userId).filter(Boolean)).size
    crecimiento = { ventasPct: pctVar(ventas, ventasPrev), clientesPct: pctVar(clientes, clientesPrev) }
  }

  // ② Volvieron (lifetime)
  let volvieron = 0
  let unaSolaVez = 0
  for (const u of byUser.values()) {
    if (u.count >= 2) volvieron += 1
    else unaSolaVez += 1
  }

  // ③ Cuándo vienen (período, lun..dom)
  const cuentaDia = [0, 0, 0, 0, 0, 0, 0]
  for (const r of period) {
    const gd = r.redeemedAt.getDay() // 0=dom..6=sab
    cuentaDia[gd === 0 ? 6 : gd - 1] += 1
  }
  const cuandoVienen = DIAS_SEMANA.map((dia, i) => ({ dia, canjes: cuentaDia[i] }))

  // ④ Cupones (período, desc)
  const byCoupon = new Map<string, number>()
  for (const r of period) byCoupon.set(r.couponId, (byCoupon.get(r.couponId) ?? 0) + 1)
  const cupones = [...byCoupon.entries()]
    .map(([couponId, canjes]) => ({ couponId, canjes }))
    .sort((a, b) => b.canjes - a.canjes)

  // ⑤ Mejores clientes (lifetime, top 8 por visitas)
  const mejores = [...byUser.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 8)
    .map(([userId, info]) => ({ userId, visitas: info.count }))

  return {
    periodo,
    ventas,
    clientes,
    nuevos,
    crecimiento,
    volvieron,
    unaSolaVez,
    totalClientes: byUser.size,
    cuandoVienen,
    cupones,
    mejores,
  }
}
