import { describe, it, expect } from 'vitest'
import { computeAsesorStats, periodRange, type StatsRedemption } from './merchantStats'

/**
 * Verifica los NÚMEROS EXACTOS del asesor de stats con fixtures de fechas
 * conocidas (no hay datos reales en la DB para comparar). Las fechas se
 * construyen con `new Date(2026, mes0, dia)` → el día de semana es un hecho de
 * calendario, independiente del TZ del runner.
 *
 * Calendario 2026 usado: Jun 1 = lunes → Jun 2 mar, Jun 3 mié, Jun 10 mié,
 * Jun 12 vie, Jun 14 dom.
 */

const cX = 'couponX'
const cY = 'couponY'
// userA: 3 canjes (May20, Jun2, Jun10) — primer canje en MAYO.
// userB: 2 canjes (Jun3, Jun12) — primer canje en JUNIO (nuevo en 'mes').
// userC: 1 canje (Jun14, sin montoTicket) — nuevo en 'mes', una sola vez.
// userD: 1 canje (Apr10) — fuera de mes/mesPasado, una sola vez.
const FIXTURES: StatsRedemption[] = [
  { userId: 'A', couponId: cX, montoTicket: 1000, redeemedAt: new Date(2026, 4, 20) },
  { userId: 'A', couponId: cX, montoTicket: 2000, redeemedAt: new Date(2026, 5, 2) },
  { userId: 'A', couponId: cX, montoTicket: 3000, redeemedAt: new Date(2026, 5, 10) },
  { userId: 'B', couponId: cY, montoTicket: 1500, redeemedAt: new Date(2026, 5, 3) },
  { userId: 'B', couponId: cX, montoTicket: 2500, redeemedAt: new Date(2026, 5, 12) },
  { userId: 'C', couponId: cY, montoTicket: undefined, redeemedAt: new Date(2026, 5, 14) },
  { userId: 'D', couponId: cX, montoTicket: 500, redeemedAt: new Date(2026, 3, 10) },
]
const NOW = new Date(2026, 5, 15, 12, 0, 0) // 15 jun 2026, mediodía

describe('periodRange', () => {
  it('mes = mes calendario actual; anterior = mes pasado completo', () => {
    const { start, end, prevStart, prevEnd } = periodRange('mes', NOW)
    expect(start).toEqual(new Date(2026, 5, 1))
    expect(end).toEqual(new Date(2026, 6, 1))
    expect(prevStart).toEqual(new Date(2026, 4, 1))
    expect(prevEnd).toEqual(new Date(2026, 5, 1))
  })
  it('todo no tiene período anterior', () => {
    const { prevStart, prevEnd } = periodRange('todo', NOW)
    expect(prevStart).toBeNull()
    expect(prevEnd).toBeNull()
  })
})

describe('computeAsesorStats — periodo "mes" (junio)', () => {
  const s = computeAsesorStats(FIXTURES, 'mes', NOW)

  it('ventas = Σ montoTicket de junio (excluye el canje sin monto)', () => {
    // A:2000+3000, B:1500+2500, C:undefined→0 = 9000
    expect(s.ventas).toBe(9000)
  })
  it('clientes distintos en el período = 3 (A,B,C)', () => {
    expect(s.clientes).toBe(3)
  })
  it('nuevos = primer canje de por vida dentro del período = 2 (B,C; A es de mayo)', () => {
    expect(s.nuevos).toBe(2)
  })
  it('crecimiento vs mayo: clientes 1→3 = +200%, ventas 1000→9000 = +800%', () => {
    expect(s.crecimiento.clientesPct).toBe(200)
    expect(s.crecimiento.ventasPct).toBe(800)
  })
  it('volvieron (lifetime ≥2) = 2 (A,B); unaSolaVez = 2 (C,D); total = 4', () => {
    expect(s.volvieron).toBe(2)
    expect(s.unaSolaVez).toBe(2)
    expect(s.totalClientes).toBe(4)
  })
  it('cuandoVienen: mar=1, mié=2, vie=1, dom=1, resto 0; total = 5', () => {
    const map = Object.fromEntries(s.cuandoVienen.map((d) => [d.dia, d.canjes]))
    expect(map).toEqual({ lun: 0, mar: 1, mie: 2, jue: 0, vie: 1, sab: 0, dom: 1 })
    expect(s.cuandoVienen.reduce((a, d) => a + d.canjes, 0)).toBe(5)
  })
  it('cupones del período, desc: cX=3, cY=2', () => {
    expect(s.cupones).toEqual([
      { couponId: cX, canjes: 3 },
      { couponId: cY, canjes: 2 },
    ])
  })
  it('mejores (lifetime) ordenados por visitas: A=3, B=2, y 4 en total', () => {
    expect(s.mejores[0]).toEqual({ userId: 'A', visitas: 3 })
    expect(s.mejores[1]).toEqual({ userId: 'B', visitas: 2 })
    expect(s.mejores).toHaveLength(4)
  })
})

describe('computeAsesorStats — otros períodos', () => {
  it('todo: todos los clientes son "nuevos", crecimiento null, ventas totales', () => {
    const s = computeAsesorStats(FIXTURES, 'todo', NOW)
    expect(s.clientes).toBe(4)
    expect(s.nuevos).toBe(4)
    expect(s.ventas).toBe(10500) // 1000+2000+3000+1500+2500+0+500
    expect(s.crecimiento).toEqual({ ventasPct: null, clientesPct: null })
  })

  it('mesPasado (mayo): solo el canje de A; nuevo en mayo; crecimiento vs abril', () => {
    const s = computeAsesorStats(FIXTURES, 'mesPasado', NOW)
    expect(s.clientes).toBe(1)
    expect(s.nuevos).toBe(1) // A: primer canje 20-may ∈ mayo
    expect(s.ventas).toBe(1000)
    expect(s.crecimiento.ventasPct).toBe(100) // abril 500 → mayo 1000
    expect(s.crecimiento.clientesPct).toBe(0) // abril 1 (D) → mayo 1 (A)
  })

  it('7dias (Jun8 12:00 → Jun15 12:00): Jun10/12/14; 1 nuevo (C)', () => {
    const s = computeAsesorStats(FIXTURES, '7dias', NOW)
    expect(s.clientes).toBe(3) // A(Jun10), B(Jun12), C(Jun14)
    expect(s.nuevos).toBe(1) // solo C estrena en esta ventana
    expect(s.ventas).toBe(5500) // 3000+2500+0
  })

  it('comercio sin canjes → todo en cero, sin crash', () => {
    const s = computeAsesorStats([], 'mes', NOW)
    expect(s).toMatchObject({ ventas: 0, clientes: 0, nuevos: 0, volvieron: 0, totalClientes: 0 })
    expect(s.cupones).toEqual([])
    expect(s.mejores).toEqual([])
    expect(s.cuandoVienen.reduce((a, d) => a + d.canjes, 0)).toBe(0)
  })
})

describe('timezone del comercio (no la del server)', () => {
  // Canje a las 23:30 de Argentina (UTC-3) del miércoles 10/06 = jueves 11/06 02:30 UTC.
  const canjeNocturno = [
    { userId: 'A', couponId: cX, montoTicket: 100, redeemedAt: new Date('2026-06-11T02:30:00Z') },
  ]
  const nowJun = new Date('2026-06-15T12:00:00Z')

  it("histograma por día usa la TZ del comercio: cuenta el canje en MIÉ (no JUE de UTC)", () => {
    const ar = computeAsesorStats(canjeNocturno, 'mes', nowJun, 'America/Argentina/Buenos_Aires')
    expect(ar.cuandoVienen.find((d) => d.dia === 'mie')?.canjes).toBe(1)
    expect(ar.cuandoVienen.find((d) => d.dia === 'jue')?.canjes).toBe(0)
  })

  it('borde de mes en la TZ del comercio: 30/06 22:00 ART (=01/07 01:00 UTC) cuenta en JUNIO', () => {
    const canje = [
      { userId: 'A', couponId: cX, montoTicket: 500, redeemedAt: new Date('2026-07-01T01:00:00Z') },
    ]
    const now = new Date('2026-06-30T23:00:00Z') // 30/06 20:00 ART
    const ar = computeAsesorStats(canje, 'mes', now, 'America/Argentina/Buenos_Aires')
    expect(ar.cuandoVienen.reduce((a, d) => a + d.canjes, 0)).toBe(1)
  })
})
