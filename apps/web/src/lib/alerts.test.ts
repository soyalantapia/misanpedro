import { describe, it, expect, beforeEach } from 'vitest'
import {
  addAlert,
  removeAlert,
  setAlertCoupons,
  couponsForAlert,
  getAlertsSnapshot,
  type AlertCoupon,
} from './alerts'

// ObjectId hex de 24 chars cuyo timestamp embebido es `whenMs`. Sirve para
// simular cupones "viejos" (cargados hace >21 días) vs recientes (bug #4).
function oidAt(whenMs: number, tail = '0000000000000000'): string {
  const secs = Math.floor(whenMs / 1000)
  return secs.toString(16).padStart(8, '0') + tail
}

const DIA = 86_400_000

function mkCoupon(id: string, over: Partial<AlertCoupon> = {}): AlertCoupon {
  return {
    id,
    titulo: 'Cupón',
    porcentaje: 20,
    merchantSlug: 'comercio-1',
    merchantNombre: 'Comercio 1',
    categoria: 'gastronomia',
    ...over,
  }
}

beforeEach(() => {
  // Limpiamos las alertas existentes del store (persistido en localStorage stub).
  for (const a of getAlertsSnapshot().alerts) removeAlert(a.id)
  setAlertCoupons([])
})

describe('couponsForAlert — contador no recorta por antigüedad (bug #4)', () => {
  it('cuenta un cupón vigente cargado hace >21 días', () => {
    const a = addAlert({ categorias: ['gastronomia'] })
    const viejo = mkCoupon(oidAt(Date.now() - 40 * DIA, '1111111111111111'))
    setAlertCoupons([viejo])
    // Antes daba 0 (el cutoff de 21 días lo descartaba). Ahora cuenta.
    expect(couponsForAlert(a.id)).toHaveLength(1)
  })

  it('respeta los criterios de la alerta (categoría/% mínimo)', () => {
    const a = addAlert({ categorias: ['gastronomia'], minDescuento: 30 })
    setAlertCoupons([
      mkCoupon(oidAt(Date.now() - 40 * DIA, 'aaaaaaaaaaaaaaaa'), { porcentaje: 50 }),
      mkCoupon(oidAt(Date.now() - 40 * DIA, 'bbbbbbbbbbbbbbbb'), { porcentaje: 10 }),
      mkCoupon(oidAt(Date.now() - 40 * DIA, 'cccccccccccccccc'), { categoria: 'belleza', porcentaje: 50 }),
    ])
    // Solo el de 50% gastronomía cumple.
    expect(couponsForAlert(a.id)).toHaveLength(1)
    expect(couponsForAlert(a.id)[0].porcentaje).toBe(50)
  })
})

describe('setAlertCoupons — dedup por contenido (bug #19)', () => {
  it('refresca el store cuando cambia el % de un cupón con el mismo id', () => {
    const a = addAlert({ categorias: ['gastronomia'], minDescuento: 40 })
    const id = oidAt(Date.now() - 2 * DIA, 'dddddddddddddddd')
    // Primero 30% → no matchea la alerta de 40%+.
    setAlertCoupons([mkCoupon(id, { porcentaje: 30 })])
    expect(couponsForAlert(a.id)).toHaveLength(0)
    // El comercio lo sube a 50% (mismo id, misma longitud y orden de lista).
    setAlertCoupons([mkCoupon(id, { porcentaje: 50 })])
    // Antes el early-return ignoraba el cambio; ahora el store toma el % nuevo.
    expect(couponsForAlert(a.id)).toHaveLength(1)
    expect(couponsForAlert(a.id)[0].porcentaje).toBe(50)
  })
})
